import { Notice, Plugin, WorkspaceLeaf } from 'obsidian';
import { SchedulerSettings, SchedulerItem, CategoryConfig, WeeklySchedule, MonthlyTasks } from './types';
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
            days: [0, 2, 4], // Mon, Wed, Fri
            hours: [6]
        }
    ],
    sleepSchedule: {
        enabled: true,
        sleepTime: 22,
        wakeTime: 4
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

        // Add command to open scheduler
        this.addCommand({
            id: 'open-scheduler',
            name: 'Open Scheduler',
            callback: () => {
                this.activateView();
            }
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

        // Add command to clear all data
        this.addCommand({
            id: 'clear-scheduler',
            name: 'Clear All Scheduler Data',
            callback: async () => {
                this.settings.weeklySchedule = {};
                this.settings.monthlyTasks = {};
                await this.saveSettings();
                this.refreshView();
            }
        });

        // Add settings tab
        this.addSettingTab(new SchedulerSettingTab(this.app, this));

        // Initialize empty schedule if needed
        this.initializeSchedule();

        // Auto-populate standard tasks on first load
        if (Object.keys(this.settings.weeklySchedule).length === 0) {
            this.populateStandardTasks();
        }

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
            // View already exists, reveal it
            leaf = leaves[0];
        } else {
            // Create new leaf in right sidebar
            leaf = workspace.getRightLeaf(false);
            if (leaf) {
                await leaf.setViewState({
                    type: VIEW_TYPE_SCHEDULER,
                    active: true,
                });
            }
        }

        // Reveal the leaf
        if (leaf) {
            workspace.revealLeaf(leaf);
        }
    }

    initializeSchedule() {
        // Initialize weekly schedule structure
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

        // Initialize monthly tasks structure
        if (!this.settings.monthlyTasks) {
            this.settings.monthlyTasks = {};
        }

        for (let month = 0; month < 12; month++) {
            if (!this.settings.monthlyTasks[month]) {
                this.settings.monthlyTasks[month] = [];
            }
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

        // Add sleep schedule
        if (this.settings.sleepSchedule.enabled) {
            const sleepItem: Omit<SchedulerItem, 'id'> = {
                name: 'Sleep',
                description: '',
                categoryId: 'other',
                isStandard: true
            };

            const wakeItem: Omit<SchedulerItem, 'id'> = {
                name: 'Wake Up',
                description: '',
                categoryId: 'other',
                isStandard: true
            };

            // Add to all days
            for (let day = 0; day < 7; day++) {
                // Check if Sleep already exists
                const sleepExists = this.settings.weeklySchedule[day][this.settings.sleepSchedule.sleepTime]
                    .some(i => i.name === 'Sleep' && i.isStandard);
                if (!sleepExists) {
                    this.addItemToSchedule(day, this.settings.sleepSchedule.sleepTime, sleepItem);
                    addedCount++;
                }

                // Check if Wake Up already exists
                const wakeExists = this.settings.weeklySchedule[day][this.settings.sleepSchedule.wakeTime]
                    .some(i => i.name === 'Wake Up' && i.isStandard);
                if (!wakeExists) {
                    this.addItemToSchedule(day, this.settings.sleepSchedule.wakeTime, wakeItem);
                    addedCount++;
                }
            }
        }

        // Add other standard items
        for (const standard of this.settings.standardItems) {
            const item: Omit<SchedulerItem, 'id'> = {
                name: standard.name,
                description: standard.description,
                categoryId: standard.categoryId,
                isStandard: true
            };

            const days = standard.days.length > 0 ? standard.days : [0, 1, 2, 3, 4, 5, 6];

            for (const day of days) {
                for (const hour of standard.hours) {
                    const existing = this.settings.weeklySchedule[day][hour];
                    const alreadyExists = existing.some(i => i.name === standard.name && i.isStandard);

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

    startNotificationChecker() {
        this.notificationInterval = window.setInterval(() => {
            this.checkHourlyNotification();
        }, 60000); // Check every minute

        this.registerInterval(this.notificationInterval);
    }

    checkHourlyNotification() {
        if (!this.settings.showNotifications) return;

        const now = new Date();
        const currentHour = now.getHours();
        const currentDay = (now.getDay() + 6) % 7; // Convert to Mon=0

        // Only notify at top of hour
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

    clearAllTasks() {
        let cleared = 0;

        // Clear weekly schedule
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