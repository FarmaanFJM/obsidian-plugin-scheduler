/**
 * Monthly Tasks Renderer
 * 
 * RESPONSIBILITY:
 * Renders the monthly schedule section showing tasks organized by month.
 * Tasks are grouped by type (deadline, goal, task, regular) within each month.
 * 
 * USED BY:
 * - view.ts (main scheduler view calls renderMonthlyTasks())
 * 
 * FEATURES:
 * - 12-month grid layout (3 rows × 4 columns)
 * - Tasks grouped by type within each month
 * - Year navigation (prev/next/current year buttons)
 * - Add task button per month
 * - Clear month button per month
 * - Reorder tasks within type group (up/down buttons)
 * - Edit, delete, and checkbox (for tasks) buttons
 * 
 * TASK TYPE ORDERING:
 * 1. Deadlines (urgent items with specific dates)
 * 2. Goals (monthly objectives)
 * 3. Tasks (checkable to-do items)
 * 4. Regular (other items)
 */
import type SchedulerPlugin from '../main';
import { SchedulerItem } from '../types';
import { AddItemModal } from '../modals/addItemModal';
import { EditItemModal } from '../modals/editItemModal';
import { ItemRenderer } from './itemRenderer';

export class MonthlyRenderer {
    private plugin: SchedulerPlugin;
    private itemRenderer: ItemRenderer;
    private refreshView: () => void;

    constructor(plugin: SchedulerPlugin, refreshView: () => void) {
        this.plugin = plugin;
        this.itemRenderer = new ItemRenderer(plugin);
        this.refreshView = refreshView;
    }

    /**
     * Render monthly section header with year navigation
     */
    renderMonthlyHeader(container: Element) {
        const monthlyHeader = container.createDiv({ cls: 'scheduler-section-header' });

        const titleContainer = monthlyHeader.createDiv({ cls: 'header-title-container' });
        titleContainer.createEl('h2', { text: 'Monthly Schedule' });

        const yearNavContainer = titleContainer.createDiv({ cls: 'year-navigation' });

        // Previous year button
        const prevYearBtn = yearNavContainer.createEl('button', {
            cls: 'nav-btn',
            text: '◀'
        });
        prevYearBtn.addEventListener('click', async () => {
            await this.plugin.changeYear(-1);
        });

        // Year label
        const yearLabel = yearNavContainer.createEl('span', {
            cls: 'year-label',
            text: this.plugin.currentYear.toString()
        });

        // Next year button
        const nextYearBtn = yearNavContainer.createEl('button', {
            cls: 'nav-btn',
            text: '▶'
        });
        nextYearBtn.addEventListener('click', async () => {
            await this.plugin.changeYear(1);
        });

        // Current year button
        const currentYearBtn = yearNavContainer.createEl('button', {
            cls: 'today-btn',
            text: 'Current Year'
        });
        currentYearBtn.addEventListener('click', async () => {
            const currentYear = new Date().getFullYear();
            if (this.plugin.currentYear !== currentYear) {
                this.plugin.currentYear = currentYear;
                await this.plugin.loadYearData(currentYear);
                this.refreshView();
            }
        });
    }

    /**
     * Render 12-month grid (3 rows × 4 columns)
     */
    renderMonthlyTasks(container: Element) {
        const monthlyGrid = container.createDiv({ cls: 'monthly-grid' });
        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];

        // Create 3 rows of 4 months each
        for (let row = 0; row < 3; row++) {
            const monthRow = monthlyGrid.createDiv({ cls: 'monthly-row' });
            for (let col = 0; col < 4; col++) {
                const monthIndex = row * 4 + col;
                if (monthIndex < 12) {
                    this.renderMonthColumn(monthRow, monthIndex, months[monthIndex]);
                }
            }
        }
    }

    /**
     * Render a single month column with its tasks
     */
    private renderMonthColumn(row: HTMLElement, monthIndex: number, monthName: string) {
        const monthCol = row.createDiv({ cls: 'month-column' });

        // Month header with controls
        const monthHeader = monthCol.createDiv({ cls: 'month-header' });
        monthHeader.createEl('h3', { text: monthName });

        // Add button
        const addBtn = monthHeader.createEl('button', {
            cls: 'add-task-btn',
            text: '+'
        });
        addBtn.addEventListener('click', () => {
            this.openAddMonthlyTaskModal(monthIndex, monthName);
        });

        // Trash button (clear all tasks for this month)
        const trashBtn = monthHeader.createEl('button', {
            cls: 'trash-task-btn',
            text: '🗑️'
        });
        trashBtn.addEventListener('click', () => {
            const confirmed = confirm(`Clear all tasks for ${monthName}?`);
            if (confirmed) {
                this.plugin.clearMonthTasks(monthIndex);
            }
        });

        // Tasks list
        const tasksList = monthCol.createDiv({ cls: 'tasks-list' });
        const allTasks = this.plugin.getMonthlyTasks(monthIndex);

        // Group tasks by type (deadline, goal, task, regular)
        const groups: Record<'deadline' | 'goal' | 'task' | 'regular', SchedulerItem[]> = {
            deadline: [],
            goal: [],
            task: [],
            regular: [],
        };

        for (const t of allTasks) {
            switch (t.itemType) {
                case 'deadline':
                    groups.deadline.push(t);
                    break;
                case 'goal':
                    groups.goal.push(t);
                    break;
                case 'task':
                    groups.task.push(t);
                    break;
                default:
                    groups.regular.push(t);
            }
        }

        // Render each type group in order
        const order: { key: keyof typeof groups; label: string }[] = [
            { key: 'deadline', label: 'Deadlines' },
            { key: 'goal', label: 'Goals' },
            { key: 'task', label: 'Tasks' },
            { key: 'regular', label: 'Regular' },
        ];

        for (const { key, label } of order) {
            const items = groups[key];
            if (!items.length) continue;

            // Section header
            const header = tasksList.createDiv({ cls: 'monthly-type-header' });
            header.setText(`──────── ${label} ────────`);

            items.forEach((task, index) => {
                this.renderMonthlyTaskCard(tasksList, task, monthIndex, key, index, items.length);
            });
        }
    }

    /**
     * Render a single task card within a month
     * Includes reordering within its type group
     */
    private renderMonthlyTaskCard(
        tasksList: HTMLElement,
        task: SchedulerItem,
        monthIndex: number,
        taskType: string,
        index: number,
        totalCount: number
    ) {
        const category = this.itemRenderer.getCategoryById(task.categoryId);
        const taskCard = tasksList.createDiv({ cls: 'task-card' });

        // Apply styling
        const textColor = this.itemRenderer.applyItemStyling(taskCard, task, category);

        // Create content
        if (textColor && category) {
            this.itemRenderer.createItemContent(taskCard, task, textColor);
        } else {
            // Fallback if no category
            taskCard.createDiv({ cls: 'task-name', text: task.name });
            if (task.description) {
                taskCard.createDiv({ cls: 'task-description', text: task.description });
            }
        }

        // Button container
        const btnContainer = taskCard.createDiv({ cls: 'task-buttons' });

        // Reorder buttons (within same type group in this month)
        this.itemRenderer.createReorderButtons(
            btnContainer,
            index,
            totalCount,
            (direction) => {
                this.plugin.reorderMonthlyTask(task.id, monthIndex, taskType, direction);
            }
        );

        // Checkbox for tasks
        this.itemRenderer.createCheckboxButton(btnContainer, task, () => {
            this.plugin.updateItem(task.id, { completed: !task.completed });
        });

        // Edit button
        this.itemRenderer.createEditButton(btnContainer, () => {
            this.openEditMonthlyTaskModal(task);
        });

        // Delete button
        this.itemRenderer.createDeleteButton(btnContainer, () => {
            this.plugin.removeItem(task.id);
            this.refreshView();
        });
    }

    /**
     * Open modal to add new monthly task
     * Passes month context for deadline date selection
     */
    private openAddMonthlyTaskModal(month: number, monthName: string) {
        const modal = new AddItemModal(
            this.plugin.app,
            this.plugin.settings.categories,
            `Task for ${monthName}`,
            (item: Omit<SchedulerItem, 'id'>) => {
                this.plugin.addMonthlyTask(month, item);
                this.refreshView();
            },
            {
                monthIndex: month,
                year: this.plugin.currentYear
            }
        );
        modal.open();
    }

    /**
     * Open modal to edit existing monthly task
     */
    private openEditMonthlyTaskModal(task: SchedulerItem) {
        const modal = new EditItemModal(
            this.plugin.app,
            this.plugin.settings.categories,
            task,
            (updates: Partial<SchedulerItem>) => {
                this.plugin.updateItem(task.id, updates);
            }
        );
        modal.open();
    }
}