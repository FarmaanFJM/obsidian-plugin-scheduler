import { Plugin, WorkspaceLeaf } from 'obsidian';
import { SchedulerSettings, SchedulerItem, StandardItemConfig, CategoryConfig } from './types';
import { SchedulerSettingTab } from './settings/settings';
import { SchedulerView, VIEW_TYPE_SCHEDULER } from './views/view';
import { DateUtils } from './utils/dateUtils';
import { DataManager } from './managers/dataManager';
import { BacklogManager } from './managers/backlogManager';
import { GoalsManager } from './managers/goalsManager';
import { ScheduleManager } from './managers/scheduleManager';
import { StandardTasksManager } from './managers/standardTasksManager';

export default class SchedulerPlugin extends Plugin {
    settings: SchedulerSettings;
    public dataLoaded: boolean = false;

    // Manager instances
    private dataManager: DataManager;
    private backlogManager: BacklogManager;
    private goalsManager: GoalsManager;
    private scheduleManager: ScheduleManager;
    private standardTasksManager: StandardTasksManager;

    async onload() {
        const { weekNumber, year } = DateUtils.getCurrentWeekInfo();

        // Initialize managers
        this.dataManager = new DataManager(this.app);

        this.backlogManager = new BacklogManager(
            this.dataManager,
            () => this.settings,
            () => this.saveSettings(),
            () => this.refreshView()
        );

        this.goalsManager = new GoalsManager(
            this.dataManager,
            () => this.refreshView()
        );

        this.scheduleManager = new ScheduleManager(
            this.dataManager,
            weekNumber,
            year,
            () => this.settings,
            () => this.refreshView()
        );

        this.standardTasksManager = new StandardTasksManager(
            this.scheduleManager,
            () => this.settings,
            () => this.scheduleManager.saveYearData(),
            () => this.refreshView()
        );

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

    async ensureDataLoaded(): Promise<void> {
        if (this.dataLoaded) return;

        // Small delay to let sync catch up (optional but helps)
        await new Promise(resolve => setTimeout(resolve, 1000));

        await this.loadSettings();
        await this.backlogManager.loadBacklog();
        await this.goalsManager.loadGoals();
        await this.scheduleManager.loadYearData(this.scheduleManager.currentYear);

        this.dataLoaded = true;
    }

    // Settings
    async loadSettings() {
        this.settings = await this.dataManager.loadSettings();
    }

    async saveSettings() {
        await this.dataManager.saveSettings(this.settings);
    }

    // Backlog methods - delegate to BacklogManager
    async toggleBacklogSidebar() {
        await this.backlogManager.toggleBacklogSidebar();
    }

    getBacklogItems(): SchedulerItem[] {
        return this.backlogManager.getBacklogItems();
    }

    async addBacklogItem(item: Omit<SchedulerItem, 'id'>) {
        await this.backlogManager.addBacklogItem(item);
    }

    async clearBacklogItems() {
        await this.backlogManager.clearBacklogItems();
    }

    async reorderBacklogItemInCategory(itemId: string, categoryId: string, direction: 'up' | 'down') {
        await this.backlogManager.reorderBacklogItemInCategory(itemId, categoryId, direction);
    }

    // Goals methods - delegate to GoalsManager
    getGeneralGoals(): SchedulerItem[] {
        return this.goalsManager.getGeneralGoals();
    }

    async addGeneralGoal(item: Omit<SchedulerItem, 'id'>) {
        await this.goalsManager.addGeneralGoal(item);
    }

    async clearGeneralGoals() {
        await this.goalsManager.clearGeneralGoals();
    }

    async clearCategoryGoals(categoryId: string) {
        await this.goalsManager.clearCategoryGoals(categoryId);
    }

    async reorderGeneralGoal(itemId: string, direction: 'up' | 'down') {
        await this.goalsManager.reorderGeneralGoal(itemId, direction);
    }

    // Schedule methods - delegate to ScheduleManager
    get currentWeek(): number {
        return this.scheduleManager.currentWeek;
    }

    set currentWeek(value: number) {
        this.scheduleManager.currentWeek = value;
    }

    get currentYear(): number {
        return this.scheduleManager.currentYear;
    }

    set currentYear(value: number) {
        this.scheduleManager.currentYear = value;
    }

    get currentYearData() {
        return this.scheduleManager.getYearData();
    }

    async changeWeek(delta: number): Promise<void> {
        await this.scheduleManager.changeWeek(delta);
    }

    async changeYear(delta: number): Promise<void> {
        await this.scheduleManager.changeYear(delta);
    }

    getCurrentWeekData() {
        return this.scheduleManager.getCurrentWeekData();
    }

    getItemsForCell(day: number, hour: number): SchedulerItem[] {
        return this.scheduleManager.getItemsForCell(day, hour);
    }

    getMonthlyTasks(month: number): SchedulerItem[] {
        return this.scheduleManager.getMonthlyTasks(month);
    }

    getCategoryById(id: string): CategoryConfig | undefined {
        return this.scheduleManager.getCategoryById(id);
    }

    async reorderMonthlyTask(itemId: string, month: number, taskType: string, direction: 'up' | 'down') {
        await this.scheduleManager.reorderMonthlyTask(itemId, month, taskType, direction);
    }

    async addItemToSchedule(day: number, hour: number, item: Omit<SchedulerItem, 'id'>) {
        await this.scheduleManager.addItemToSchedule(day, hour, item);
    }

    async addMonthlyTask(month: number, item: Omit<SchedulerItem, 'id'>) {
        await this.scheduleManager.addMonthlyTask(month, item);
    }

    async updateItem(itemId: string, updates: Partial<SchedulerItem>) {
        const result = await this.scheduleManager.updateItem(
            itemId,
            updates,
            this.backlogManager.getBacklogItems(),
            this.goalsManager.getGeneralGoals()
        );

        if (result) {
            if (result.needsSaveBacklog) await this.backlogManager.saveBacklog();
            if (result.needsSaveGoals) await this.goalsManager.saveGoals();
            if (result.needsSaveYear) await this.scheduleManager.saveYearData();
        }

        this.refreshView();
    }

    async removeItem(itemId: string) {
        const result = await this.scheduleManager.removeItem(
            itemId,
            this.backlogManager.getBacklogItems(),
            this.goalsManager.getGeneralGoals()
        );

        if (result.newGoals) {
            this.goalsManager.updateGoals(result.newGoals);
        }

        if (result.needsSaveBacklog) await this.backlogManager.saveBacklog();
        if (result.needsSaveGoals) await this.goalsManager.saveGoals();
        if (result.needsSaveYear) await this.scheduleManager.saveYearData();
    }

    async clearMonthTasks(month: number) {
        await this.scheduleManager.clearMonthTasks(month);
    }

    async clearAllTasks() {
        await this.scheduleManager.clearAllTasks();
    }

    async loadYearData(year: number) {
        await this.scheduleManager.loadYearData(year);
    }

    // Standard tasks methods - delegate to StandardTasksManager
    async populateStandardTasks() {
        await this.standardTasksManager.populateStandardTasks();
    }

    async updateStandardTask(oldName: string, newTask: StandardItemConfig) {
        await this.standardTasksManager.updateStandardTask(oldName, newTask);
    }

    async clearNonStandardTasks() {
        await this.standardTasksManager.clearNonStandardTasks();
    }

    // View refresh
    refreshView() {
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_SCHEDULER);
        leaves.forEach(leaf => {
            if (leaf.view instanceof SchedulerView) {
                leaf.view.refresh();
            }
        });
    }

    async onunload() {
        this.app.workspace.detachLeavesOfType(VIEW_TYPE_SCHEDULER);
    }
}