import { Plugin, WorkspaceLeaf } from 'obsidian';
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
    monthlyTasks: {}
};

export default class SchedulerPlugin extends Plugin {
    settings: SchedulerSettings;

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

    async onunload() {
        // Detach all scheduler views
        this.app.workspace.detachLeavesOfType(VIEW_TYPE_SCHEDULER);
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
        this.initializeSchedule();
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}