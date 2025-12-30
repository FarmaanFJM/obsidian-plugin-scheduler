import { Notice } from 'obsidian';
import { SchedulerItem, SchedulerSettings } from '../types';
import { DataManager } from './dataManager';

export class BacklogManager {
    private backlogItems: SchedulerItem[] = [];
    private dataManager: DataManager;
    private getSettings: () => SchedulerSettings;
    private saveSettings: () => Promise<void>;
    private refreshView: () => void;

    constructor(
        dataManager: DataManager,
        getSettings: () => SchedulerSettings,
        saveSettings: () => Promise<void>,
        refreshView: () => void
    ) {
        this.dataManager = dataManager;
        this.getSettings = getSettings;
        this.saveSettings = saveSettings;
        this.refreshView = refreshView;
    }

    async loadBacklog() {
        this.backlogItems = await this.dataManager.loadBacklog();
    }

    async saveBacklog() {
        await this.dataManager.saveBacklog(this.backlogItems);
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

    async toggleBacklogSidebar() {
        const settings = this.getSettings();
        settings.backlogExpanded = !settings.backlogExpanded;
        await this.saveSettings();
        this.refreshView();
    }
}