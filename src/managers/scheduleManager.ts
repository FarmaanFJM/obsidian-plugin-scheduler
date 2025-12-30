import { Notice } from 'obsidian';
import { SchedulerItem, CategoryConfig, YearData, WeekData, SchedulerSettings } from '../types';
import { DateUtils } from '../utils/dateUtils';
import { DataManager } from './dataManager';

export class ScheduleManager {
    private currentYearData: YearData | null = null;
    currentWeek: number;
    currentYear: number;
    private dataManager: DataManager;
    private getSettings: () => SchedulerSettings;
    private refreshView: () => void;

    constructor(
        dataManager: DataManager,
        currentWeek: number,
        currentYear: number,
        getSettings: () => SchedulerSettings,
        refreshView: () => void
    ) {
        this.dataManager = dataManager;
        this.currentWeek = currentWeek;
        this.currentYear = currentYear;
        this.getSettings = getSettings;
        this.refreshView = refreshView;
    }

    async loadYearData(year: number): Promise<void> {
        this.currentYearData = await this.dataManager.loadYearData(year);
    }

    async saveYearData(): Promise<void> {
        if (!this.currentYearData) return;
        await this.dataManager.saveYearData(this.currentYearData);
    }

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
                schedule: this.dataManager.createEmptyWeeklySchedule()
            };

            this.currentYearData.weeks.push(weekData);
        }

        return weekData;
    }

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
        return this.getSettings().categories.find(cat => cat.id === id);
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
                schedule: this.dataManager.createEmptyWeeklySchedule()
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

    async updateItem(itemId: string, updates: Partial<SchedulerItem>, backlogItems: SchedulerItem[], generalGoals: SchedulerItem[]) {
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
        const goalIndex = generalGoals.findIndex(item => item.id === itemId);
        if (goalIndex !== -1) {
            generalGoals[goalIndex] = { ...generalGoals[goalIndex], ...updates };
            needsSaveGoals = true;
        }

        // 4) Update in backlog
        const backlogIndex = backlogItems.findIndex(item => item.id === itemId);
        if (backlogIndex !== -1) {
            backlogItems[backlogIndex] = { ...backlogItems[backlogIndex], ...updates };
            needsSaveBacklog = true;
        }

        // 5) Handle deadline relocation
        const updatedItem = this.findItemById(itemId, backlogItems, generalGoals);
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

        return { needsSaveBacklog, needsSaveGoals, needsSaveYear };
    }

    findItemById(itemId: string, backlogItems: SchedulerItem[], generalGoals: SchedulerItem[]): SchedulerItem | null {
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
        const goalFound = generalGoals.find(i => i.id === itemId);
        if (goalFound) return goalFound;

        // Search backlog
        const backlogFound = backlogItems.find(i => i.id === itemId);
        if (backlogFound) return backlogFound;

        return null;
    }

    async removeItem(itemId: string, backlogItems: SchedulerItem[], generalGoals: SchedulerItem[]) {
        if (!this.currentYearData) return { needsSaveBacklog: false, needsSaveGoals: false, needsSaveYear: false };

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
        const originalGoalsLength = generalGoals.length;
        const newGoals = generalGoals.filter(item => item.id !== itemId);
        if (newGoals.length < originalGoalsLength) {
            needsSaveGoals = true;
        }

        // Remove from backlog
        const originalBacklogLength = backlogItems.length;
        const newBacklog = backlogItems.filter(item => item.id !== itemId);
        if (newBacklog.length < originalBacklogLength) {
            needsSaveBacklog = true;
        }

        return { needsSaveBacklog, needsSaveGoals, needsSaveYear, newGoals, newBacklog };
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

    getYearData(): YearData | null {
        return this.currentYearData;
    }
}