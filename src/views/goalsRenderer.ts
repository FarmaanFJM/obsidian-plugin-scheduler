/**
 * General Goals Section Renderer
 * 
 * RESPONSIBILITY:
 * Renders the general goals section displaying long-term goals organized by category.
 * Goals are displayed in a grid layout with 3 categories per row.
 * 
 * USED BY:
 * - view.ts (main scheduler view calls renderGoals())
 * 
 * FEATURES:
 * - Grid layout (3 columns per row)
 * - Goals grouped by category
 * - Add goal button per category (locks category and type)
 * - Clear category goals button
 * - Reorder goals within category (up/down buttons)
 * - Edit and delete goal cards
 * 
 * VISUAL LAYOUT:
 * - Each category gets its own column
 * - Goals appear as cards with gold/colored borders
 * - Empty categories still show header with add button
 */
import type SchedulerPlugin from '../main';
import { SchedulerItem, CategoryConfig, ItemType } from '../types';
import { AddItemModal } from '../modals/addItemModal';
import { EditItemModal } from '../modals/editItemModal';
import { ItemRenderer } from './itemRenderer';

export class GoalsRenderer {
    private plugin: SchedulerPlugin;
    private itemRenderer: ItemRenderer;
    private refreshView: () => void;

    constructor(plugin: SchedulerPlugin, refreshView: () => void) {
        this.plugin = plugin;
        this.itemRenderer = new ItemRenderer(plugin);
        this.refreshView = refreshView;
    }

    /**
     * Render goals section header (just title, no controls)
     */
    renderGoalsHeader(container: Element) {
        const goalsHeader = container.createDiv({ cls: 'scheduler-section-header' });
        const titleContainer = goalsHeader.createDiv({ cls: 'header-title-container' });
        titleContainer.createEl('h2', { text: 'General Goals' });
    }

    /**
     * Render goals grid with categories in rows of 3
     */
    renderGeneralGoals(container: Element) {
        const goalsGrid = container.createDiv({ cls: 'goals-grid' });

        const allGoals = this.plugin.getGeneralGoals();

        // Group goals by category
        const goalsByCategory: Record<string, SchedulerItem[]> = {};

        this.plugin.settings.categories.forEach((cat: CategoryConfig) => {
            goalsByCategory[cat.id] = [];
        });

        allGoals.forEach((goal: SchedulerItem) => {
            if (goalsByCategory[goal.categoryId]) {
                goalsByCategory[goal.categoryId].push(goal);
            }
        });

        // Render in rows of 3 categories each
        const categories = this.plugin.settings.categories;
        for (let i = 0; i < categories.length; i += 3) {
            const goalsRow = goalsGrid.createDiv({ cls: 'goals-row' });

            for (let j = 0; j < 3 && i + j < categories.length; j++) {
                const category = categories[i + j];
                const goals = goalsByCategory[category.id] || [];
                this.renderGoalsCategoryColumn(goalsRow, category, goals);
            }
        }
    }

    /**
     * Render a single category column with its goals
     */
    private renderGoalsCategoryColumn(
        row: HTMLElement,
        category: CategoryConfig,
        goals: SchedulerItem[]
    ) {
        const categoryCol = row.createDiv({ cls: 'goals-category-column' });

        // Category header with controls
        const categoryHeader = categoryCol.createDiv({ cls: 'goals-category-header' });
        categoryHeader.createEl('h3', { text: category.name });

        // Add button (locked to this category)
        const addBtn = categoryHeader.createEl('button', {
            cls: 'add-task-btn',
            text: '+'
        });
        addBtn.addEventListener('click', () => {
            this.openAddGeneralGoalModal(category.id);
        });

        // Trash button (clear all goals for this category)
        const trashBtn = categoryHeader.createEl('button', {
            cls: 'trash-task-btn',
            text: '🗑️'
        });
        trashBtn.addEventListener('click', () => {
            const confirmed = confirm(`Clear all goals for ${category.name}?`);
            if (confirmed) {
                this.plugin.clearCategoryGoals(category.id);
            }
        });

        // Category divider (only if there are goals)
        if (goals.length > 0) {
            const header = categoryCol.createDiv({ cls: 'monthly-type-header' });
            header.setText(`──────── ${category.name.toUpperCase()} ────────`);
        }

        // Render goal cards
        const goalsList = categoryCol.createDiv({ cls: 'goals-list' });
        goals.forEach((goal, index) => {
            this.renderGoalCard(goalsList, goal, index, goals.length);
        });
    }

    /**
     * Render a single goal card with controls
     */
    private renderGoalCard(
        goalsList: HTMLElement,
        goal: SchedulerItem,
        index: number,
        totalCount: number
    ) {
        const category = this.itemRenderer.getCategoryById(goal.categoryId);
        const goalCard = goalsList.createDiv({ cls: 'task-card item-type-goal' });

        // Apply goal styling (gold frame)
        if (category) {
            const textColor = this.itemRenderer.applyItemStyling(goalCard, goal, category);
            if (textColor) {
                this.itemRenderer.createItemContent(goalCard, goal, textColor);
            }
        } else {
            // Fallback if no category
            goalCard.createDiv({ cls: 'task-name', text: goal.name });
            if (goal.description) {
                goalCard.createDiv({ cls: 'task-description', text: goal.description });
            }
        }

        // Button container
        const btnContainer = goalCard.createDiv({ cls: 'task-buttons' });

        // Reorder buttons (within same category)
        this.itemRenderer.createReorderButtons(
            btnContainer,
            index,
            totalCount,
            (direction) => {
                this.plugin.reorderGeneralGoal(goal.id, direction);
            }
        );

        // Edit button
        this.itemRenderer.createEditButton(btnContainer, () => {
            this.openEditGeneralGoalModal(goal);
        });

        // Delete button
        this.itemRenderer.createDeleteButton(btnContainer, () => {
            this.plugin.removeItem(goal.id);
            this.refreshView();
        });
    }

    /**
     * Open modal to add new goal
     * Locks category and type to 'goal'
     */
    private openAddGeneralGoalModal(categoryId?: string) {
        const categoryName = categoryId
            ? this.plugin.settings.categories.find((c: CategoryConfig) => c.id === categoryId)?.name
            : 'General';

        const modal = new AddItemModal(
            this.plugin.app,
            this.plugin.settings.categories,
            `New Goal - ${categoryName}`,
            (item: Omit<SchedulerItem, 'id'>) => {
                // Ensure it's a goal type
                const goalItem = {
                    ...item,
                    itemType: 'goal' as ItemType,
                    categoryId: categoryId || item.categoryId
                };
                this.plugin.addGeneralGoal(goalItem);
            },
            {
                lockedCategoryId: categoryId,
                lockedItemType: 'goal'
            }
        );
        modal.open();
    }

    /**
     * Open modal to edit existing goal
     */
    private openEditGeneralGoalModal(goal: SchedulerItem) {
        const modal = new EditItemModal(
            this.plugin.app,
            this.plugin.settings.categories,
            goal,
            (updates: Partial<SchedulerItem>) => {
                this.plugin.updateItem(goal.id, updates);
            }
        );
        modal.open();
    }
}