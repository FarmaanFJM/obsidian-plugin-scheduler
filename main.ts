import { Notice, Plugin, WorkspaceLeaf } from 'obsidian';
import { SchedulerSettings, SchedulerItem, CategoryConfig, StandardItemConfig, YearData, WeekData, WeeklySchedule } from './types';
import { SchedulerSettingTab } from './settings';
import { SchedulerView, VIEW_TYPE_SCHEDULER } from './view';
import { DateUtils } from './dateUtils';

const SCHEDULER_DATA_FOLDER = 'SchedulerData';
const SETTINGS_FILE = `${SCHEDULER_DATA_FOLDER}/settings.json`;
const BACKLOG_FILE = `${SCHEDULER_DATA_FOLDER}/backlog.json`;
const GOALS_FILE = `${SCHEDULER_DATA_FOLDER}/goals.json`;

const DEFAULT_SETTINGS: SchedulerSettings = {
    categories: [
        { id: 'personal', name: 'Personal', color: '#2ECC71' },
        { id: 'health', name: 'Health', color: '#E74C3C' },
        { id: 'school', name: 'School', color: '#8B4513' },
        { id: 'work', name: 'Work', color: '#3498DB' },
        { id: 'projects', name: 'Projects', color: '#9B59B6' },
        { id: 'other', name: 'Other', color: '#95A5A6' }
    ],
    standardItems: [
        {
            name: 'Gym',
            description: 'Morning workout',
            categoryId: 'health',
            schedule: {
                0: [5],
                2: [5],
                4: [5]
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
};

export default class SchedulerPlugin extends Plugin {
    settings: SchedulerSettings;
    private backlogItems: SchedulerItem[] = [];
    private generalGoals: SchedulerItem[] = [];
    public dataLoaded: boolean = false;

    currentWeek: number;
    currentYear: number;
    currentYearData: YearData | null = null;

    async onload() {
        const { weekNumber, year } = DateUtils.getCurrentWeekInfo();
        this.currentWeek = weekNumber;
        this.currentYear = year;

        this.registerView(
            VIEW_TYPE_SCHEDULER,
            (leaf) => new SchedulerView(leaf, this)
        );

        this.addRibbonIcon('calendar', 'Open Scheduler', () => {
            this.activateView();
        });

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

        this.addSettingTab(new SchedulerSettingTab(this.app, this));
    }

    async activateView() {
        const { workspace } = this.app;
        let leaf = workspace.getLeavesOfType(VIEW_TYPE_SCHEDULER).first();

        if (!leaf) {
            leaf = workspace.getLeaf('tab');
            await leaf.setViewState({
                type: VIEW_TYPE_SCHEDULER,
                active: true,
            });
        }

        workspace.revealLeaf(leaf);
    }

    // ========== FILE I/O - ATOMIC OPERATIONS ==========

    private async ensureFolder() {
        const adapter = this.app.vault.adapter;
        if (!(await adapter.exists(SCHEDULER_DATA_FOLDER))) {
            await adapter.mkdir(SCHEDULER_DATA_FOLDER);
        }
    }

    private async atomicWrite(filePath: string, data: any) {
        await this.ensureFolder();
        const dataString = JSON.stringify(data, null, 2);
        await this.app.vault.adapter.write(filePath, dataString);
        // Force file system flush
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    private async atomicRead(filePath: string): Promise<any | null> {
        const adapter = this.app.vault.adapter;
        if (!(await adapter.exists(filePath))) {
            return null;
        }
        try {
            const raw = await adapter.read(filePath);
            return JSON.parse(raw);
        } catch (e) {
            console.error(`Scheduler: Failed to read ${filePath}:`, e);
            return null;
        }
    }

    async ensureDataLoaded(): Promise<void> {
        if (this.dataLoaded) return;

        // Small delay to let sync catch up (optional but helps)
        await new Promise(resolve => setTimeout(resolve, 1000));

        await this.loadSettings();
        await this.loadBacklog();
        await this.loadGoals();
        await this.loadYearData(this.currentYear);

        this.dataLoaded = true;
    }

    // ========== SETTINGS ==========

    async loadSettings() {
        const loaded = await this.atomicRead(SETTINGS_FILE);
        this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);
    }

    async saveSettings() {
        await this.atomicWrite(SETTINGS_FILE, this.settings);
    }

    // ========== BACKLOG ==========

    async loadBacklog() {
        const data = await this.atomicRead(BACKLOG_FILE);
        this.backlogItems = data?.items || [];
    }

    async saveBacklog() {
        await this.atomicWrite(BACKLOG_FILE, { items: this.backlogItems });
    }

    getBacklogItems(): SchedulerItem[] {
        return this.backlogItems;
    }

    async addBacklogItem(item: Omit<SchedulerItem, 'id'>) {
        const newItem: SchedulerItem = {
            ...item,
            id: `backlog-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        };

        this.backlogItems.push(newItem);
        await this.saveBacklog();
        this.refreshView();
    }

    async clearBacklogItems() {
        this.backlogItems = [];
        await this.saveBacklog();
        this.refreshView();
        new Notice('Backlog cleared!');
    }

    async reorderBacklogItemInCategory(itemId: string, categoryId: string, direction: 'up' | 'down') {
        const index = this.backlogItems.findIndex(i => i.id === itemId);
        if (index === -1) return;

        const item = this.backlogItems[index];

        // Get all items in the same category
        const categoryItems = this.backlogItems.filter(i => i.categoryId === categoryId);
        const indexInCategory = categoryItems.findIndex(i => i.id === itemId);

        if (direction === 'up' && indexInCategory > 0) {
            const itemAbove = categoryItems[indexInCategory - 1];
            const globalIndexAbove = this.backlogItems.findIndex(i => i.id === itemAbove.id);
            [this.backlogItems[index], this.backlogItems[globalIndexAbove]] =
                [this.backlogItems[globalIndexAbove], this.backlogItems[index]];
        } else if (direction === 'down' && indexInCategory < categoryItems.length - 1) {
            const itemBelow = categoryItems[indexInCategory + 1];
            const globalIndexBelow = this.backlogItems.findIndex(i => i.id === itemBelow.id);
            [this.backlogItems[index], this.backlogItems[globalIndexBelow]] =
                [this.backlogItems[globalIndexBelow], this.backlogItems[index]];
        }

        await this.saveBacklog();
        this.refreshView();
    }

    // ========== GENERAL GOALS ==========

    async loadGoals() {
        const data = await this.atomicRead(GOALS_FILE);
        this.generalGoals = data?.items || [];
    }

    async saveGoals() {
        await this.atomicWrite(GOALS_FILE, { items: this.generalGoals });
    }

    getGeneralGoals(): SchedulerItem[] {
        return this.generalGoals;
    }

    async addGeneralGoal(item: Omit<SchedulerItem, 'id'>) {
        const newItem: SchedulerItem = {
            ...item,
            id: `goal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            itemType: 'goal'
        };

        this.generalGoals.push(newItem);
        await this.saveGoals();
        this.refreshView();
    }

    async clearGeneralGoals() {
        this.generalGoals = [];
        await this.saveGoals();
        this.refreshView();
        new Notice('General goals cleared!');
    }

    async clearCategoryGoals(categoryId: string) {
        this.generalGoals = this.generalGoals.filter(goal => goal.categoryId !== categoryId);
        await this.saveGoals();
        this.refreshView();
        new Notice('Category goals cleared!');
    }

    async reorderGeneralGoal(itemId: string, direction: 'up' | 'down') {
        const index = this.generalGoals.findIndex(g => g.id === itemId);
        if (index === -1) return;

        const goal = this.generalGoals[index];
        const categoryGoals = this.generalGoals.filter(g => g.categoryId === goal.categoryId);
        const indexInCategory = categoryGoals.findIndex(g => g.id === itemId);

        if (direction === 'up' && indexInCategory > 0) {
            const goalAbove = categoryGoals[indexInCategory - 1];
            const globalIndexAbove = this.generalGoals.findIndex(g => g.id === goalAbove.id);
            [this.generalGoals[index], this.generalGoals[globalIndexAbove]] =
                [this.generalGoals[globalIndexAbove], this.generalGoals[index]];
        } else if (direction === 'down' && indexInCategory < categoryGoals.length - 1) {
            const goalBelow = categoryGoals[indexInCategory + 1];
            const globalIndexBelow = this.generalGoals.findIndex(g => g.id === goalBelow.id);
            [this.generalGoals[index], this.generalGoals[globalIndexBelow]] =
                [this.generalGoals[globalIndexBelow], this.generalGoals[index]];
        }

        await this.saveGoals();
        this.refreshView();
    }

    // ========== YEAR DATA ==========

    async loadYearData(year: number): Promise<void> {
        const yearFile = `${SCHEDULER_DATA_FOLDER}/${year}.json`;
        let yearData = await this.atomicRead(yearFile);

        if (!yearData) {
            yearData = this.createEmptyYearData(year);
        }

        this.currentYearData = yearData;
    }

    async saveYearData(): Promise<void> {
        if (!this.currentYearData) return;
        const yearFile = `${SCHEDULER_DATA_FOLDER}/${this.currentYearData.year}.json`;
        await this.atomicWrite(yearFile, this.currentYearData);
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
        const currentMonday = DateUtils.getDateOfWeek(this.currentWeek, this.currentYear);
        const newMonday = DateUtils.addWeeks(currentMonday, delta);
        const newWeekNumber = DateUtils.getWeekNumber(newMonday);
        const newYear = DateUtils.getYearForWeek(newWeekNumber, newMonday);

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

        if (!weekData) {
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

    async reorderMonthlyTask(itemId: string, month: number, taskType: string, direction: 'up' | 'down') {
        if (!this.currentYearData) return;

        const tasks = this.currentYearData.monthlyTasks[month];
        if (!tasks) return;

        const typeTasks = tasks.filter(t => {
            switch (taskType) {
                case 'deadline': return t.itemType === 'deadline';
                case 'goal': return t.itemType === 'goal';
                case 'task': return t.itemType === 'task';
                case 'regular': return t.itemType !== 'deadline' && t.itemType !== 'goal' && t.itemType !== 'task';
                default: return false;
            }
        });

        const indexInType = typeTasks.findIndex(t => t.id === itemId);
        if (indexInType === -1) return;

        if (direction === 'up' && indexInType > 0) {
            const currentTask = typeTasks[indexInType];
            const taskAbove = typeTasks[indexInType - 1];

            const globalIndex = tasks.findIndex(t => t.id === currentTask.id);
            const globalIndexAbove = tasks.findIndex(t => t.id === taskAbove.id);

            [tasks[globalIndex], tasks[globalIndexAbove]] = [tasks[globalIndexAbove], tasks[globalIndex]];
        } else if (direction === 'down' && indexInType < typeTasks.length - 1) {
            const currentTask = typeTasks[indexInType];
            const taskBelow = typeTasks[indexInType + 1];

            const globalIndex = tasks.findIndex(t => t.id === currentTask.id);
            const globalIndexBelow = tasks.findIndex(t => t.id === taskBelow.id);

            [tasks[globalIndex], tasks[globalIndexBelow]] = [tasks[globalIndexBelow], tasks[globalIndex]];
        }

        await this.saveYearData();
        this.refreshView();
    }

    async addItemToSchedule(day: number, hour: number, item: Omit<SchedulerItem, 'id'>) {
        const weekData = this.getCurrentWeekData();
        if (!weekData) return;

        const newItem: SchedulerItem = {
            ...item,
            id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        };

        if (newItem.itemType === 'deadline' && this.currentYearData) {
            const monday = DateUtils.getDateOfWeek(this.currentWeek, this.currentYear);
            const date = new Date(monday);
            date.setDate(monday.getDate() + day);

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
        await this.saveYearData();
    }

    async addMonthlyTask(month: number, item: Omit<SchedulerItem, 'id'>) {
        if (!this.currentYearData) return;

        const newItem: SchedulerItem = {
            ...item,
            id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        };

        if (!this.currentYearData.monthlyTasks[month]) {
            this.currentYearData.monthlyTasks[month] = [];
        }

        this.currentYearData.monthlyTasks[month].push(newItem);

        if (newItem.itemType === 'deadline') {
            this.syncDeadlineIntoWeekly(newItem);
        }

        await this.saveYearData();
    }

    private syncDeadlineIntoWeekly(item: SchedulerItem) {
        if (!this.currentYearData || !item.deadlineDate || item.deadlineHour == null) {
            return;
        }

        const date = DateUtils.fromISODateString(item.deadlineDate);
        const weekNumber = DateUtils.getWeekNumber(date);
        const weekYear = DateUtils.getYearForWeek(weekNumber, date);

        if (weekYear !== this.currentYearData.year) {
            return;
        }

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

        const dayOfWeek = (date.getDay() + 6) % 7;
        const hour = item.deadlineHour;

        if (!weekData.schedule[dayOfWeek]) {
            weekData.schedule[dayOfWeek] = {};
        }
        if (!weekData.schedule[dayOfWeek][hour]) {
            weekData.schedule[dayOfWeek][hour] = [];
        }

        const already = weekData.schedule[dayOfWeek][hour].some(i => i.id === item.id);
        if (!already) {
            weekData.schedule[dayOfWeek][hour].push(item);
        }
    }

    async updateItem(itemId: string, updates: Partial<SchedulerItem>) {
        if (!this.currentYearData) return;

        let needsSaveBacklog = false;
        let needsSaveGoals = false;
        let needsSaveYear = false;

        // 1) Update in weekly schedules
        for (const weekData of this.currentYearData.weeks) {
            for (const day in weekData.schedule) {
                for (const hour in weekData.schedule[day]) {
                    const items = weekData.schedule[day][hour];
                    const index = items.findIndex(item => item.id === itemId);
                    if (index !== -1) {
                        items[index] = { ...items[index], ...updates };
                        needsSaveYear = true;
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
                needsSaveYear = true;
            }
        }

        // 3) Update in general goals
        const goalIndex = this.generalGoals.findIndex(item => item.id === itemId);
        if (goalIndex !== -1) {
            this.generalGoals[goalIndex] = { ...this.generalGoals[goalIndex], ...updates };
            needsSaveGoals = true;
        }

        // 4) Update in backlog
        const backlogIndex = this.backlogItems.findIndex(item => item.id === itemId);
        if (backlogIndex !== -1) {
            this.backlogItems[backlogIndex] = { ...this.backlogItems[backlogIndex], ...updates };
            needsSaveBacklog = true;
        }

        // 5) Handle deadline relocation
        const updatedItem = this.findItemById(itemId);
        if (updatedItem && updatedItem.itemType === 'deadline') {
            if (this.currentYearData) {
                for (const weekData of this.currentYearData.weeks) {
                    for (const day in weekData.schedule) {
                        for (const hour in weekData.schedule[day]) {
                            weekData.schedule[day][hour] =
                                weekData.schedule[day][hour].filter(i => i.id !== itemId);
                        }
                    }
                }

                for (const month in this.currentYearData.monthlyTasks) {
                    this.currentYearData.monthlyTasks[month] =
                        this.currentYearData.monthlyTasks[month].filter(i => i.id !== itemId);
                }
            }

            if (updatedItem.deadlineDate && updatedItem.deadlineHour != null && this.currentYearData) {
                const date = DateUtils.fromISODateString(updatedItem.deadlineDate);
                const monthIdx = date.getMonth();

                if (!this.currentYearData.monthlyTasks[monthIdx]) {
                    this.currentYearData.monthlyTasks[monthIdx] = [];
                }

                this.currentYearData.monthlyTasks[monthIdx].push(updatedItem);
                this.syncDeadlineIntoWeekly(updatedItem);
                needsSaveYear = true;
            }
        }

        // Save only what changed
        if (needsSaveBacklog) await this.saveBacklog();
        if (needsSaveGoals) await this.saveGoals();
        if (needsSaveYear) await this.saveYearData();

        this.refreshView();
    }

    findItemById(itemId: string): SchedulerItem | null {
        if (!this.currentYearData) return null;

        // Search weeks
        for (const weekData of this.currentYearData.weeks) {
            for (const day in weekData.schedule) {
                for (const hour in weekData.schedule[day]) {
                    const found = weekData.schedule[day][hour].find(i => i.id === itemId);
                    if (found) return found;
                }
            }
        }

        // Search monthly tasks
        for (const month in this.currentYearData.monthlyTasks) {
            const found = this.currentYearData.monthlyTasks[month].find(i => i.id === itemId);
            if (found) return found;
        }

        // Search goals
        const goalFound = this.generalGoals.find(i => i.id === itemId);
        if (goalFound) return goalFound;

        // Search backlog
        const backlogFound = this.backlogItems.find(i => i.id === itemId);
        if (backlogFound) return backlogFound;

        return null;
    }

    async removeItem(itemId: string) {
        if (!this.currentYearData) return;

        let needsSaveBacklog = false;
        let needsSaveGoals = false;
        let needsSaveYear = false;

        // Remove from weeks
        for (const weekData of this.currentYearData.weeks) {
            for (const day in weekData.schedule) {
                for (const hour in weekData.schedule[day]) {
                    const originalLength = weekData.schedule[day][hour].length;
                    weekData.schedule[day][hour] =
                        weekData.schedule[day][hour].filter(item => item.id !== itemId);
                    if (weekData.schedule[day][hour].length < originalLength) {
                        needsSaveYear = true;
                    }
                }
            }
        }

        // Remove from months
        for (const month in this.currentYearData.monthlyTasks) {
            const originalLength = this.currentYearData.monthlyTasks[month].length;
            this.currentYearData.monthlyTasks[month] =
                this.currentYearData.monthlyTasks[month].filter(item => item.id !== itemId);
            if (this.currentYearData.monthlyTasks[month].length < originalLength) {
                needsSaveYear = true;
            }
        }

        // Remove from goals
        const originalGoalsLength = this.generalGoals.length;
        this.generalGoals = this.generalGoals.filter(item => item.id !== itemId);
        if (this.generalGoals.length < originalGoalsLength) {
            needsSaveGoals = true;
        }

        // Remove from backlog
        const originalBacklogLength = this.backlogItems.length;
        this.backlogItems = this.backlogItems.filter(item => item.id !== itemId);
        if (this.backlogItems.length < originalBacklogLength) {
            needsSaveBacklog = true;
        }

        // Save only what changed
        if (needsSaveBacklog) await this.saveBacklog();
        if (needsSaveGoals) await this.saveGoals();
        if (needsSaveYear) await this.saveYearData();
    }

    refreshView() {
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_SCHEDULER);
        leaves.forEach(leaf => {
            if (leaf.view instanceof SchedulerView) {
                leaf.view.refresh();
            }
        });
    }

    async populateStandardTasks() {
        const weekData = this.getCurrentWeekData();
        if (!weekData) return;

        let addedCount = 0;

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
                if (!this.settings.sleepSchedule.excludeSleepDays.includes(day)) {
                    const sleepExists = weekData.schedule[day][this.settings.sleepSchedule.sleepTime]
                        .some(i => i.name === 'Sleep' && i.isStandard);
                    if (!sleepExists) {
                        await this.addItemToSchedule(day, this.settings.sleepSchedule.sleepTime, sleepItem);
                        addedCount++;
                    }
                }

                if (!this.settings.sleepSchedule.excludeWakeDays.includes(day)) {
                    const wakeExists = weekData.schedule[day][this.settings.sleepSchedule.wakeTime]
                        .some(i => i.name === 'Wake Up' && i.isStandard);
                    if (!wakeExists) {
                        await this.addItemToSchedule(day, this.settings.sleepSchedule.wakeTime, wakeItem);
                        addedCount++;
                    }
                }
            }
        }

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

            for (const dayStr in standard.schedule) {
                const day = parseInt(dayStr);
                const hours = standard.schedule[day];

                for (const hour of hours) {
                    const existing = weekData.schedule[day][hour];
                    const alreadyExists = existing.some(i =>
                        i.standardTaskName === standard.name && i.isStandard
                    );

                    if (!alreadyExists) {
                        await this.addItemToSchedule(day, hour, item);
                        addedCount++;
                    }
                }
            }
        }

        await this.saveYearData();
        this.refreshView();

        if (addedCount === 0) {
            new Notice('All standard tasks already populated!');
        } else {
            new Notice(`Added ${addedCount} standard tasks!`);
        }
    }

    async updateStandardTask(oldName: string, newTask: StandardItemConfig) {
        const weekData = this.getCurrentWeekData();
        if (!weekData) return;

        for (const day in weekData.schedule) {
            for (const hour in weekData.schedule[day]) {
                weekData.schedule[day][hour] =
                    weekData.schedule[day][hour].filter(
                        item => !(item.standardTaskName === oldName && item.isStandard)
                    );
            }
        }

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
                await this.addItemToSchedule(day, hour, item);
            }
        }

        await this.saveYearData();
        this.refreshView();
    }

    async clearNonStandardTasks() {
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

        await this.saveYearData();
        this.refreshView();
        new Notice(`Cleared ${cleared} non-standard tasks!`);
    }

    async clearMonthTasks(month: number) {
        if (!this.currentYearData) return;

        this.currentYearData.monthlyTasks[month] = [];
        await this.saveYearData();
        this.refreshView();
        new Notice('Month tasks cleared!');
    }

    async clearAllTasks() {
        const weekData = this.getCurrentWeekData();
        if (!weekData) return;

        let cleared = 0;

        for (const day in weekData.schedule) {
            for (const hour in weekData.schedule[day]) {
                cleared += weekData.schedule[day][hour].length;
                weekData.schedule[day][hour] = [];
            }
        }

        await this.saveYearData();
        this.refreshView();
        new Notice(`Cleared all ${cleared} tasks!`);
    }

    async onunload() {
        this.app.workspace.detachLeavesOfType(VIEW_TYPE_SCHEDULER);
    }
}
