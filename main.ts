import { Notice, Plugin, WorkspaceLeaf } from 'obsidian';
import { SchedulerSettings, SchedulerItem, CategoryConfig, StandardItemConfig, YearData, WeekData, WeeklySchedule } from './types';
import { SchedulerSettingTab } from './settings';
import { SchedulerView, VIEW_TYPE_SCHEDULER } from './view';
import { DateUtils } from './dateUtils';

const SCHEDULER_DATA_FOLDER = 'SchedulerData';
const SCHEDULER_DATA_FILE = `${SCHEDULER_DATA_FOLDER}/data.json`;

const DEFAULT_SETTINGS: SchedulerSettings = {
    categories: [
        { id: 'school', name: 'School', color: '#8B4513' },
        { id: 'projects', name: 'Projects', color: '#9B59B6' },
        { id: 'health', name: 'Health', color: '#E74C3C' },
        { id: 'work', name: 'Work', color: '#3498DB' },
        { id: 'personal', name: 'Personal', color: '#2ECC71' },
        { id: 'other', name: 'Other', color: '#95A5A6' }
    ],
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

    // Current view state
    currentWeek: number;
    currentYear: number;
    currentYearData: YearData | null = null;

    async onload() {
        await this.loadSettings();

        // Initialize current week/year
        const { weekNumber, year } = DateUtils.getCurrentWeekInfo();
        this.currentWeek = weekNumber;
        this.currentYear = year;

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
            name: 'Clear All Non-Standard Tasks (Current Week)',
            callback: () => this.clearNonStandardTasks()
        });

        this.addCommand({
            id: 'clear-all-tasks',
            name: 'Clear ALL Tasks (Current Week)',
            callback: () => {
                const confirmed = confirm('Clear ALL tasks for current week including standard/recurring tasks? This cannot be undone!');
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

        // Load current year data
        await this.loadYearData(this.currentYear);

        // Start notification checker
        if (this.settings.showNotifications) {
            this.startNotificationChecker();
        }
    }

    async activateView() {
        const { workspace } = this.app;

        // Try to find existing scheduler leaf
        let leaf = workspace.getLeavesOfType(VIEW_TYPE_SCHEDULER).first();

        if (!leaf) {
            // Open a brand new main pane (center pane)
            leaf = workspace.getLeaf('tab');
            await leaf.setViewState({
                type: VIEW_TYPE_SCHEDULER,
                active: true,
            });
        }

        workspace.revealLeaf(leaf);
    }

    // ========== YEAR DATA MANAGEMENT ==========

    async loadYearData(year: number): Promise<void> {
        const adapter = this.app.vault.adapter;
        const yearFile = `${SCHEDULER_DATA_FOLDER}/${year}.json`;

        if (await adapter.exists(yearFile)) {
            try {
                const data = await adapter.read(yearFile);
                this.currentYearData = JSON.parse(data);
            } catch (e) {
                console.error(`Scheduler: Failed to read ${year}.json, creating new:`, e);
                this.currentYearData = this.createEmptyYearData(year);
            }
        } else {
            this.currentYearData = this.createEmptyYearData(year);
        }
    }

    async saveYearData(): Promise<void> {
        if (!this.currentYearData) return;

        const adapter = this.app.vault.adapter;
        const yearFile = `${SCHEDULER_DATA_FOLDER}/${this.currentYearData.year}.json`;

        // Ensure folder exists
        if (!(await adapter.exists(SCHEDULER_DATA_FOLDER))) {
            await adapter.mkdir(SCHEDULER_DATA_FOLDER);
        }

        await adapter.write(yearFile, JSON.stringify(this.currentYearData, null, 2));
    }

    createEmptyYearData(year: number): YearData {
        return {
            year,
            weeks: [],
            monthlyTasks: this.createEmptyMonthlyTasks()
        };
    }

    createEmptyMonthlyTasks() {
        const tasks: any = {};
        for (let month = 0; month < 12; month++) {
            tasks[month] = [];
        }
        return tasks;
    }

    createEmptyWeeklySchedule(): WeeklySchedule {
        const schedule: WeeklySchedule = {};
        for (let day = 0; day < 7; day++) {
            schedule[day] = {};
            for (let hour = 0; hour < 24; hour++) {
                schedule[day][hour] = [];
            }
        }
        return schedule;
    }

    // ========== WEEK NAVIGATION ==========

    async changeWeek(delta: number): Promise<void> {
        // Get Monday of current week
        const currentMonday = DateUtils.getDateOfWeek(this.currentWeek, this.currentYear);

        // Add weeks
        const newMonday = DateUtils.addWeeks(currentMonday, delta);

        // Get the week number of the new date
        const newWeekNumber = DateUtils.getWeekNumber(newMonday);

        // Get the correct year for this week (handles ISO week-year edge cases)
        const newYear = DateUtils.getYearForWeek(newWeekNumber, newMonday);

        // Check if year changed
        if (newYear !== this.currentYear) {
            this.currentYear = newYear;
            await this.loadYearData(newYear);
        }

        this.currentWeek = newWeekNumber;
        this.refreshView();
    }

    async changeYear(delta: number): Promise<void> {
        this.currentYear += delta;
        await this.loadYearData(this.currentYear);
        this.refreshView();
    }

    getCurrentWeekData(): WeekData | null {
        if (!this.currentYearData) return null;

        let weekData = this.currentYearData.weeks.find(w => w.weekNumber === this.currentWeek);

        // Create week if it doesn't exist
        if (!weekData) {
            const weekInfo = DateUtils.getCurrentWeekInfo();
            const startDate = DateUtils.getDateOfWeek(this.currentWeek, this.currentYear);
            const endDate = DateUtils.getSunday(startDate);

            weekData = {
                weekNumber: this.currentWeek,
                startDate: DateUtils.toISODateString(startDate),
                endDate: DateUtils.toISODateString(endDate),
                schedule: this.createEmptyWeeklySchedule()
            };

            this.currentYearData.weeks.push(weekData);
        }

        return weekData;
    }

    // ========== ITEM MANAGEMENT ==========

    getItemsForCell(day: number, hour: number): SchedulerItem[] {
        const weekData = this.getCurrentWeekData();
        if (!weekData) return [];
        if (!weekData.schedule[day]) return [];
        if (!weekData.schedule[day][hour]) return [];
        return weekData.schedule[day][hour];
    }

    getMonthlyTasks(month: number): SchedulerItem[] {
        if (!this.currentYearData) return [];
        if (!this.currentYearData.monthlyTasks[month]) return [];
        return this.currentYearData.monthlyTasks[month];
    }

    getCategoryById(id: string): CategoryConfig | undefined {
        return this.settings.categories.find(cat => cat.id === id);
    }

    addItemToSchedule(day: number, hour: number, item: Omit<SchedulerItem, 'id'>) {
        const weekData = this.getCurrentWeekData();
        if (!weekData) return;

        const newItem: SchedulerItem = {
            ...item,
            id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        };

        // If we add a DEADLINE from the weekly grid:
        // attach date/hour and also store it in the correct month.
        if (newItem.itemType === 'deadline' && this.currentYearData) {
            const monday = DateUtils.getDateOfWeek(this.currentWeek, this.currentYear);
            const date = new Date(monday);
            date.setDate(monday.getDate() + day); // day: 0–6 → Mon–Sun

            newItem.deadlineDate = DateUtils.toISODateString(date);
            newItem.deadlineHour = hour;

            const monthIdx = date.getMonth();
            if (!this.currentYearData.monthlyTasks[monthIdx]) {
                this.currentYearData.monthlyTasks[monthIdx] = [];
            }
            this.currentYearData.monthlyTasks[monthIdx].push(newItem);
        }

        if (!weekData.schedule[day]) {
            weekData.schedule[day] = {};
        }
        if (!weekData.schedule[day][hour]) {
            weekData.schedule[day][hour] = [];
        }

        weekData.schedule[day][hour].push(newItem);
        this.saveYearData();
    }

    addMonthlyTask(month: number, item: Omit<SchedulerItem, 'id'>) {
        if (!this.currentYearData) return;

        const newItem: SchedulerItem = {
            ...item,
            id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        };

        if (!this.currentYearData.monthlyTasks[month]) {
            this.currentYearData.monthlyTasks[month] = [];
        }

        this.currentYearData.monthlyTasks[month].push(newItem);

        // If this is a deadline and we know its date/hour, mirror it into the weekly schedule
        if (newItem.itemType === 'deadline') {
            this.syncDeadlineIntoWeekly(newItem);
        }

        this.saveYearData();
    }

    private syncDeadlineIntoWeekly(item: SchedulerItem) {
        if (!this.currentYearData || !item.deadlineDate || item.deadlineHour == null) {
            return;
        }

        const date = DateUtils.fromISODateString(item.deadlineDate);
        const weekNumber = DateUtils.getWeekNumber(date);
        const weekYear = DateUtils.getYearForWeek(weekNumber, date);

        // Only handle deadlines that belong to this year data
        if (weekYear !== this.currentYearData.year) {
            return;
        }

        // Find or create the corresponding week
        let weekData = this.currentYearData.weeks.find(w => w.weekNumber === weekNumber);
        if (!weekData) {
            const startDate = DateUtils.getMonday(date);
            const endDate = DateUtils.getSunday(date);
            weekData = {
                weekNumber,
                startDate: DateUtils.toISODateString(startDate),
                endDate: DateUtils.toISODateString(endDate),
                schedule: this.createEmptyWeeklySchedule()
            };
            this.currentYearData.weeks.push(weekData);
        }

        const dayOfWeek = (date.getDay() + 6) % 7; // Monday = 0
        const hour = item.deadlineHour;

        if (!weekData.schedule[dayOfWeek]) {
            weekData.schedule[dayOfWeek] = {};
        }
        if (!weekData.schedule[dayOfWeek][hour]) {
            weekData.schedule[dayOfWeek][hour] = [];
        }

        // Avoid duplicates by id
        const already = weekData.schedule[dayOfWeek][hour].some(i => i.id === item.id);
        if (!already) {
            weekData.schedule[dayOfWeek][hour].push(item);
        }
    }


    updateItem(itemId: string, updates: Partial<SchedulerItem>) {
        if (!this.currentYearData) return;

        // 1) Update in ALL weekly schedules for this year
        for (const weekData of this.currentYearData.weeks) {
            for (const day in weekData.schedule) {
                for (const hour in weekData.schedule[day]) {
                    const items = weekData.schedule[day][hour];
                    const index = items.findIndex(item => item.id === itemId);
                    if (index !== -1) {
                        items[index] = { ...items[index], ...updates };
                    }
                }
            }
        }

        // 2) Update in monthly tasks
        for (const month in this.currentYearData.monthlyTasks) {
            const items: SchedulerItem[] = this.currentYearData.monthlyTasks[month];
            const index = items.findIndex(item => item.id === itemId);
            if (index !== -1) {
                items[index] = { ...items[index], ...updates };
            }
        }

        // 3) Get the updated snapshot of the item (after above merges)
        const updatedItem = this.findItemById(itemId);

        // 4) If this item is a DEADLINE, we re-locate it:
        //    - remove all old weekly + monthly occurrences
        //    - re-add it to the correct month + week based on deadlineDate/hour
        if (updatedItem && updatedItem.itemType === 'deadline') {

            // Remove from ALL weeks + ALL months in this year
            if (this.currentYearData) {
                // Remove from all weeks
                for (const weekData of this.currentYearData.weeks) {
                    for (const day in weekData.schedule) {
                        for (const hour in weekData.schedule[day]) {
                            weekData.schedule[day][hour] =
                                weekData.schedule[day][hour].filter(i => i.id !== itemId);
                        }
                    }
                }

                // Remove from all months
                for (const month in this.currentYearData.monthlyTasks) {
                    this.currentYearData.monthlyTasks[month] =
                        this.currentYearData.monthlyTasks[month].filter(i => i.id !== itemId);
                }
            }

            // Re-add only if the deadline has valid date + hour
            if (updatedItem.deadlineDate && updatedItem.deadlineHour != null && this.currentYearData) {
                const date = DateUtils.fromISODateString(updatedItem.deadlineDate);
                const monthIdx = date.getMonth();

                if (!this.currentYearData.monthlyTasks[monthIdx]) {
                    this.currentYearData.monthlyTasks[monthIdx] = [];
                }

                // Put into the correct month
                this.currentYearData.monthlyTasks[monthIdx].push(updatedItem);

                // And mirror into the correct week/day/hour
                this.syncDeadlineIntoWeekly(updatedItem);
            }
        }

        this.saveYearData();
        this.refreshView();
    }


    findItemById(itemId: string): SchedulerItem | null {
        if (!this.currentYearData) return null;

        // Search ALL weeks
        for (const weekData of this.currentYearData.weeks) {
            for (const day in weekData.schedule) {
                for (const hour in weekData.schedule[day]) {
                    const found = weekData.schedule[day][hour].find(i => i.id === itemId);
                    if (found) return found;
                }
            }
        }

        // Then search monthly tasks
        for (const month in this.currentYearData.monthlyTasks) {
            const found = this.currentYearData.monthlyTasks[month].find(i => i.id === itemId);
            if (found) return found;
        }

        return null;
    }

    removeItem(itemId: string) {
        if (!this.currentYearData) return;

        // Remove from ALL weeks in this year
        for (const weekData of this.currentYearData.weeks) {
            for (const day in weekData.schedule) {
                for (const hour in weekData.schedule[day]) {
                    weekData.schedule[day][hour] =
                        weekData.schedule[day][hour].filter(item => item.id !== itemId);
                }
            }
        }

        // Remove from ALL months
        for (const month in this.currentYearData.monthlyTasks) {
            this.currentYearData.monthlyTasks[month] =
                this.currentYearData.monthlyTasks[month].filter(item => item.id !== itemId);
        }

        this.saveYearData();
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
        const weekData = this.getCurrentWeekData();
        if (!weekData) return;

        let addedCount = 0;

        // Add sleep schedule (excluding specified days)
        if (this.settings.sleepSchedule.enabled) {
            const sleepItem: Omit<SchedulerItem, 'id'> = {
                name: 'Sleep',
                description: '',
                categoryId: 'other',
                itemType: 'regular',
                completed: false,
                isStandard: true,
                standardTaskName: 'Sleep'
            };

            const wakeItem: Omit<SchedulerItem, 'id'> = {
                name: 'Wake Up',
                description: '',
                categoryId: 'other',
                itemType: 'regular',
                completed: false,
                isStandard: true,
                standardTaskName: 'Wake Up'
            };

            for (let day = 0; day < 7; day++) {
                // Add Sleep task (unless day is excluded)
                if (!this.settings.sleepSchedule.excludeSleepDays.includes(day)) {
                    const sleepExists = weekData.schedule[day][this.settings.sleepSchedule.sleepTime]
                        .some(i => i.name === 'Sleep' && i.isStandard);
                    if (!sleepExists) {
                        this.addItemToSchedule(day, this.settings.sleepSchedule.sleepTime, sleepItem);
                        addedCount++;
                    }
                }

                // Add Wake Up task (unless day is excluded)
                if (!this.settings.sleepSchedule.excludeWakeDays.includes(day)) {
                    const wakeExists = weekData.schedule[day][this.settings.sleepSchedule.wakeTime]
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
                itemType: 'regular',
                completed: false,
                isStandard: true,
                standardTaskName: standard.name
            };

            // Iterate through each day in the schedule
            for (const dayStr in standard.schedule) {
                const day = parseInt(dayStr);
                const hours = standard.schedule[day];

                for (const hour of hours) {
                    const existing = weekData.schedule[day][hour];
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

        this.saveYearData();
        this.refreshView();

        if (addedCount === 0) {
            new Notice('All standard tasks already populated!');
        } else {
            new Notice(`Added ${addedCount} standard tasks!`);
        }
    }

    updateStandardTask(oldName: string, newTask: StandardItemConfig) {
        const weekData = this.getCurrentWeekData();
        if (!weekData) return;

        // Remove all instances of old standard task
        for (const day in weekData.schedule) {
            for (const hour in weekData.schedule[day]) {
                weekData.schedule[day][hour] =
                    weekData.schedule[day][hour].filter(
                        item => !(item.standardTaskName === oldName && item.isStandard)
                    );
            }
        }

        // Add new standard task instances
        const item: Omit<SchedulerItem, 'id'> = {
            name: newTask.name,
            description: newTask.description,
            categoryId: newTask.categoryId,
            itemType: 'regular',
            completed: false,
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

        this.saveYearData();
        this.refreshView();
    }

    clearNonStandardTasks() {
        const weekData = this.getCurrentWeekData();
        if (!weekData) return;

        let cleared = 0;

        for (const day in weekData.schedule) {
            for (const hour in weekData.schedule[day]) {
                const original = weekData.schedule[day][hour].length;
                weekData.schedule[day][hour] =
                    weekData.schedule[day][hour].filter(item => item.isStandard);
                cleared += original - weekData.schedule[day][hour].length;
            }
        }

        this.saveYearData();
        this.refreshView();
        new Notice(`Cleared ${cleared} non-standard tasks!`);
    }

    clearMonthTasks(month: number) {
        if (!this.currentYearData) return;

        this.currentYearData.monthlyTasks[month] = [];
        this.saveYearData();
        this.refreshView();
        new Notice('Month tasks cleared!');
    }

    clearAllTasks() {
        const weekData = this.getCurrentWeekData();
        if (!weekData) return;

        let cleared = 0;

        for (const day in weekData.schedule) {
            for (const hour in weekData.schedule[day]) {
                cleared += weekData.schedule[day][hour].length;
                weekData.schedule[day][hour] = [];
            }
        }

        this.saveYearData();
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
        const adapter = this.app.vault.adapter;

        // Ensure folder exists
        if (!(await adapter.exists(SCHEDULER_DATA_FOLDER))) {
            await adapter.mkdir(SCHEDULER_DATA_FOLDER);
        }

        let loaded: any = null;

        // If file exists → load it
        if (await adapter.exists(SCHEDULER_DATA_FILE)) {
            try {
                const data = await adapter.read(SCHEDULER_DATA_FILE);
                loaded = JSON.parse(data);
            } catch (e) {
                console.error("Scheduler: Failed to read data.json, using defaults:", e);
            }
        }

        // If file does NOT exist → create new file
        if (!loaded) {
            loaded = DEFAULT_SETTINGS;
            await adapter.write(
                SCHEDULER_DATA_FILE,
                JSON.stringify(loaded, null, 2)
            );
        }

        // Apply settings
        this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);
    }

    async saveSettings() {
        const adapter = this.app.vault.adapter;

        // Ensure folder exists
        if (!(await adapter.exists(SCHEDULER_DATA_FOLDER))) {
            await adapter.mkdir(SCHEDULER_DATA_FOLDER);
        }

        // Save settings
        await adapter.write(
            SCHEDULER_DATA_FILE,
            JSON.stringify(this.settings, null, 2)
        );
    }
}