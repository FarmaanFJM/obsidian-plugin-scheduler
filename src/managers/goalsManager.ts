import { Notice } from 'obsidian';
import { SchedulerItem } from '../types';
import { DataManager } from './dataManager';

export class GoalsManager {
    private generalGoals: SchedulerItem[] = [];
    private dataManager: DataManager;
    private refreshView: () => void;

    constructor(dataManager: DataManager, refreshView: () => void) {
        this.dataManager = dataManager;
        this.refreshView = refreshView;
    }

    async loadGoals() {
        this.generalGoals = await this.dataManager.loadGoals();
    }

    async saveGoals() {
        await this.dataManager.saveGoals(this.generalGoals);
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

    updateGoals(items: SchedulerItem[]) {
        this.generalGoals = items;
    }

    findGoalById(itemId: string): SchedulerItem | null {
        return this.generalGoals.find(i => i.id === itemId) || null;
    }
}