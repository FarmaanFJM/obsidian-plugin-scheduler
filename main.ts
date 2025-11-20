import { Notice, Plugin, WorkspaceLeaf } from 'obsidian';
import { SchedulerSettings, SchedulerItem, CategoryConfig, StandardItemConfig } from './types';
import { SchedulerSettingTab } from './settings';
import { SchedulerView, VIEW_TYPE_SCHEDULER } from './view';

const DEFAULT_SETTINGS: SchedulerSettings = {
    categories: [
        { id: 'school', name: 'School', color: '#8B4513' },
        { id: 'projects', name: 'Projects', color: '#9B59B6' },
        { id: 'health', name: 'Health', color: '#E74C3C' },
        { id: 'work', name: 'Work', color: '#3498DB' },
        { id: 'personal', name: 'Personal', color: '#2ECC71' },
        { id: 'other', name: 'Other', color: '#95A5A6' }
    ],
    weeklySchedule: {},
    monthlyTasks: {},
    standardItems: [
        {
            name: 'Gym',
            description: 'Morning workout',
            categoryId: 'health',
            schedule: {
                0: [6], // Monday 06:00
                2: [6], // Wednesday 06:00
                4: [6]  // Friday 06:00
            }
        }
    ],
    sleepSchedule: {
        enabled: true,
        sleepTime: 22,
        wakeTime: 4,
        excludeWakeDays: [],
        excludeSleepDays: []
    },
    showNotifications: true
};

export default class SchedulerPlugin extends Plugin {
    settings: SchedulerSettings;
    private lastNotifiedHour: number = -1;
    private notificationInterval: number | null = null;

    async onload() {
        await this.loadSettings();

        // Register the view
        this.registerView(
            VIEW_TYPE_SCHEDULER,
            (leaf) => new SchedulerView(leaf, this)
        );

        // Add ribbon icon
        this.addRibbonIcon('calendar', 'Open Scheduler', () => {
            this.activateView();
        });

        // Add commands
        this.addCommand({
            id: 'open-scheduler',
            name: 'Open Scheduler',
            callback: () => this.activateView()
        });

        this.addCommand({
            id: 'populate-standard-tasks',
            name: 'Populate Standard Tasks',
            callback: () => this.populateStandardTasks()
        });

        this.addCommand({
            id: 'clear-non-standard-tasks',
            name: 'Clear All Non-Standard Tasks',
            callback: () => this.clearNonStandardTasks()
        });

        this.addCommand({
            id: 'clear-all-tasks',
            name: 'Clear ALL Tasks (Including Standard)',
            callback: () => {
                const confirmed = confirm('Clear ALL tasks including standard/recurring tasks? This cannot be undone!');
                if (confirmed) {
                    this.clearAllTasks();
                }
            }
        });

        this.addCommand({
            id: 'refresh-scheduler',
            name: 'Refresh Scheduler View',
            callback: () => this.refreshView()
        });

        // Add settings tab
        this.addSettingTab(new SchedulerSettingTab(this.app, this));

        // Initialize schedule
        this.initializeSchedule();

        // Start notification checker
        if (this.settings.showNotifications) {
            this.startNotificationChecker();
        }
    }

    async activateView() {
        const { workspace } = this.app;
        let leaf: WorkspaceLeaf | null = null;
        const leaves = workspace.getLeavesOfType(VIEW_TYPE_SCHEDULER);

        if (leaves.length > 0) {
            leaf = leaves[0];
        } else {
            leaf = workspace.getRightLeaf(false);
            if (leaf) {
                await leaf.setViewState({
                    type: VIEW_TYPE_SCHEDULER,
                    active: true,
                });
            }
        }

        if (leaf) {
            workspace.revealLeaf(leaf);
        }
    }

    initializeSchedule() {
        if (!this.settings.weeklySchedule) {
            this.settings.weeklySchedule = {};
        }

        for (let day = 0; day < 7; day++) {
            if (!this.settings.weeklySchedule[day]) {
                this.settings.weeklySchedule[day] = {};
            }
            for (let hour = 0; hour < 24; hour++) {
                if (!this.settings.weeklySchedule[day][hour]) {
                    this.settings.weeklySchedule[day][hour] = [];
                }
            }
        }

        if (!this.settings.monthlyTasks) {
            this.settings.monthlyTasks = {};
        }

        for (let month = 0; month < 12; month++) {
            if (!this.settings.monthlyTasks[month]) {
                this.settings.monthlyTasks[month] = [];
            }
        }

        // Initialize excludeDays if not present
        if (!this.settings.sleepSchedule.excludeWakeDays) {
            this.settings.sleepSchedule.excludeWakeDays = [];
        }
        if (!this.settings.sleepSchedule.excludeSleepDays) {
            this.settings.sleepSchedule.excludeSleepDays = [];
        }
    }

    getItemsForCell(day: number, hour: number): SchedulerItem[] {
        if (!this.settings.weeklySchedule[day]) return [];
        if (!this.settings.weeklySchedule[day][hour]) return [];
        return this.settings.weeklySchedule[day][hour];
    }

    getMonthlyTasks(month: number): SchedulerItem[] {
        if (!this.settings.monthlyTasks[month]) return [];
        return this.settings.monthlyTasks[month];
    }

    getCategoryById(id: string): CategoryConfig | undefined {
        return this.settings.categories.find(cat => cat.id === id);
    }

    addItemToSchedule(day: number, hour: number, item: Omit<SchedulerItem, 'id'>) {
        const newItem: SchedulerItem = {
            ...item,
            id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        };

        if (!this.settings.weeklySchedule[day]) {
            this.settings.weeklySchedule[day] = {};
        }
        if (!this.settings.weeklySchedule[day][hour]) {
            this.settings.weeklySchedule[day][hour] = [];
        }

        this.settings.weeklySchedule[day][hour].push(newItem);
        this.saveSettings();
    }

    addMonthlyTask(month: number, item: Omit<SchedulerItem, 'id'>) {
        const newItem: SchedulerItem = {
            ...item,
            id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        };

        if (!this.settings.monthlyTasks[month]) {
            this.settings.monthlyTasks[month] = [];
        }

        this.settings.monthlyTasks[month].push(newItem);
        this.saveSettings();
    }

    updateItem(itemId: string, updates: Partial<SchedulerItem>) {
        // Update in weekly schedule
        for (const day in this.settings.weeklySchedule) {
            for (const hour in this.settings.weeklySchedule[day]) {
                const items = this.settings.weeklySchedule[day][hour];
                const index = items.findIndex(item => item.id === itemId);
                if (index !== -1) {
                    items[index] = { ...items[index], ...updates };
                }
            }
        }

        // Update in monthly tasks
        for (const month in this.settings.monthlyTasks) {
            const items = this.settings.monthlyTasks[month];
            const index = items.findIndex(item => item.id === itemId);
            if (index !== -1) {
                items[index] = { ...items[index], ...updates };
            }
        }

        this.saveSettings();
        this.refreshView();
    }

    removeItem(itemId: string) {
        // Remove from weekly schedule
        for (const day in this.settings.weeklySchedule) {
            for (const hour in this.settings.weeklySchedule[day]) {
                this.settings.weeklySchedule[day][hour] =
                    this.settings.weeklySchedule[day][hour].filter(item => item.id !== itemId);
            }
        }

        // Remove from monthly tasks
        for (const month in this.settings.monthlyTasks) {
            this.settings.monthlyTasks[month] =
                this.settings.monthlyTasks[month].filter(item => item.id !== itemId);
        }

        this.saveSettings();
    }

    refreshView() {
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_SCHEDULER);
        leaves.forEach(leaf => {
            if (leaf.view instanceof SchedulerView) {
                leaf.view.refresh();
            }
        });
    }

    populateStandardTasks() {
        let addedCount = 0;

        // Add sleep schedule (excluding specified days)
        if (this.settings.sleepSchedule.enabled) {
            const sleepItem: Omit<SchedulerItem, 'id'> = {
                name: 'Sleep',
                description: '',
                categoryId: 'other',
                isStandard: true,
                standardTaskName: 'Sleep'
            };

            const wakeItem: Omit<SchedulerItem, 'id'> = {
                name: 'Wake Up',
                description: '',
                categoryId: 'other',
                isStandard: true,
                standardTaskName: 'Wake Up'
            };

            for (let day = 0; day < 7; day++) {
                // Add Sleep task (unless day is excluded)
                if (!this.settings.sleepSchedule.excludeSleepDays.includes(day)) {
                    const sleepExists = this.settings.weeklySchedule[day][this.settings.sleepSchedule.sleepTime]
                        .some(i => i.name === 'Sleep' && i.isStandard);
                    if (!sleepExists) {
                        this.addItemToSchedule(day, this.settings.sleepSchedule.sleepTime, sleepItem);
                        addedCount++;
                    }
                }

                // Add Wake Up task (unless day is excluded)
                if (!this.settings.sleepSchedule.excludeWakeDays.includes(day)) {
                    const wakeExists = this.settings.weeklySchedule[day][this.settings.sleepSchedule.wakeTime]
                        .some(i => i.name === 'Wake Up' && i.isStandard);
                    if (!wakeExists) {
                        this.addItemToSchedule(day, this.settings.sleepSchedule.wakeTime, wakeItem);
                        addedCount++;
                    }
                }
            }
        }

        // Add other standard items with new schedule structure
        for (const standard of this.settings.standardItems) {
            const item: Omit<SchedulerItem, 'id'> = {
                name: standard.name,
                description: standard.description,
                categoryId: standard.categoryId,
                isStandard: true,
                standardTaskName: standard.name
            };

            // Iterate through each day in the schedule
            for (const dayStr in standard.schedule) {
                const day = parseInt(dayStr);
                const hours = standard.schedule[day];

                for (const hour of hours) {
                    const existing = this.settings.weeklySchedule[day][hour];
                    const alreadyExists = existing.some(i =>
                        i.standardTaskName === standard.name && i.isStandard
                    );

                    if (!alreadyExists) {
                        this.addItemToSchedule(day, hour, item);
                        addedCount++;
                    }
                }
            }
        }

        this.saveSettings();
        this.refreshView();

        if (addedCount === 0) {
            new Notice('All standard tasks already populated!');
        } else {
            new Notice(`Added ${addedCount} standard tasks!`);
        }
    }

    updateStandardTask(oldName: string, newTask: StandardItemConfig) {
        // Remove all instances of old standard task
        for (const day in this.settings.weeklySchedule) {
            for (const hour in this.settings.weeklySchedule[day]) {
                this.settings.weeklySchedule[day][hour] =
                    this.settings.weeklySchedule[day][hour].filter(
                        item => !(item.standardTaskName === oldName && item.isStandard)
                    );
            }
        }

        // Add new standard task instances
        const item: Omit<SchedulerItem, 'id'> = {
            name: newTask.name,
            description: newTask.description,
            categoryId: newTask.categoryId,
            isStandard: true,
            standardTaskName: newTask.name
        };

        for (const dayStr in newTask.schedule) {
            const day = parseInt(dayStr);
            const hours = newTask.schedule[day];

            for (const hour of hours) {
                this.addItemToSchedule(day, hour, item);
            }
        }

        this.saveSettings();
        this.refreshView();
    }

    clearNonStandardTasks() {
        let cleared = 0;

        for (const day in this.settings.weeklySchedule) {
            for (const hour in this.settings.weeklySchedule[day]) {
                const original = this.settings.weeklySchedule[day][hour].length;
                this.settings.weeklySchedule[day][hour] =
                    this.settings.weeklySchedule[day][hour].filter(item => item.isStandard);
                cleared += original - this.settings.weeklySchedule[day][hour].length;
            }
        }

        this.saveSettings();
        this.refreshView();
        new Notice(`Cleared ${cleared} non-standard tasks!`);
    }

    clearMonthTasks(month: number) {
        this.settings.monthlyTasks[month] = [];
        this.saveSettings();
        this.refreshView();
        new Notice('Month tasks cleared!');
    }

    clearAllTasks() {
        let cleared = 0;

        for (const day in this.settings.weeklySchedule) {
            for (const hour in this.settings.weeklySchedule[day]) {
                cleared += this.settings.weeklySchedule[day][hour].length;
                this.settings.weeklySchedule[day][hour] = [];
            }
        }

        this.saveSettings();
        this.refreshView();
        new Notice(`Cleared all ${cleared} tasks!`);
    }

    startNotificationChecker() {
        this.notificationInterval = window.setInterval(() => {
            this.checkHourlyNotification();
        }, 60000);

        this.registerInterval(this.notificationInterval);
    }

    checkHourlyNotification() {
        if (!this.settings.showNotifications) return;

        const now = new Date();
        const currentHour = now.getHours();
        const currentDay = (now.getDay() + 6) % 7;

        if (now.getMinutes() === 0 && this.lastNotifiedHour !== currentHour) {
            this.lastNotifiedHour = currentHour;
            this.showHourNotification(currentDay, currentHour);
        }
    }

    showHourNotification(day: number, hour: number) {
        const items = this.getItemsForCell(day, hour);

        if (items.length === 0) return;

        const hourStr = hour.toString().padStart(2, '0') + ':00';
        let message = `📅 Tasks for ${hourStr}:\n\n`;

        items.forEach(item => {
            message += `• ${item.name}`;
            if (item.description) {
                message += `\n  ${item.description}`;
            }
            message += '\n';
        });

        new Notice(message, 10000);
    }

    async onunload() {
        this.app.workspace.detachLeavesOfType(VIEW_TYPE_SCHEDULER);

        if (this.notificationInterval !== null) {
            window.clearInterval(this.notificationInterval);
        }
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
        this.initializeSchedule();
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}