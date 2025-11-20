import { ItemView, WorkspaceLeaf } from 'obsidian';
import SchedulerPlugin from './main';
import { AddItemModal } from './modal';
import { SchedulerItem, CategoryConfig } from './types';

export const VIEW_TYPE_SCHEDULER = 'scheduler-view';

export class SchedulerView extends ItemView {
    plugin: SchedulerPlugin;

    constructor(leaf: WorkspaceLeaf, plugin: SchedulerPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return VIEW_TYPE_SCHEDULER;
    }

    getDisplayText(): string {
        return 'Scheduler';
    }

    getIcon(): string {
        return 'calendar';
    }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        container.addClass('scheduler-container');

        this.renderScheduler(container);
    }

    renderScheduler(container: Element) {
        // Main container
        const mainDiv = container.createDiv({ cls: 'scheduler-main' });

        // Weekly Scheduler Section
        const weeklySection = mainDiv.createDiv({ cls: 'scheduler-weekly-section' });
        weeklySection.createEl('h2', { text: 'Weekly Schedule' });
        this.renderWeeklyScheduler(weeklySection);

        // Monthly Tasks Section
        const monthlySection = mainDiv.createDiv({ cls: 'scheduler-monthly-section' });
        monthlySection.createEl('h2', { text: 'Monthly Goals' });
        this.renderMonthlyTasks(monthlySection);
    }

    renderWeeklyScheduler(container: Element) {
        const weeklyGrid = container.createDiv({ cls: 'weekly-grid' });

        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

        // Create header row
        const headerRow = weeklyGrid.createDiv({ cls: 'weekly-header-row' });
        headerRow.createDiv({ cls: 'time-header', text: 'Time' });
        
        days.forEach(day => {
            headerRow.createDiv({ cls: 'day-header', text: day });
        });

        // Create hourly rows
        for (let hour = 0; hour < 24; hour++) {
            const hourRow = weeklyGrid.createDiv({ cls: 'weekly-hour-row' });
            
            // Time column
            const hourStr = hour.toString().padStart(2, '0');
            hourRow.createDiv({ 
                cls: 'time-cell', 
                text: `${hourStr}:00` 
            });

            // Day columns
            days.forEach((_, dayIndex) => {
                const dayCell = hourRow.createDiv({ cls: 'day-cell' });
                dayCell.dataset.day = dayIndex.toString();
                dayCell.dataset.hour = hour.toString();

                // Render existing items
                const items = this.plugin.getItemsForCell(dayIndex, hour);
                this.renderCellItems(dayCell, items);

                // Add click handler
                dayCell.addEventListener('click', () => {
                    this.openAddItemModal(dayIndex, hour);
                });
            });
        }
    }

    renderCellItems(cell: HTMLElement, items: SchedulerItem[]) {
        cell.empty();
        
        items.forEach(item => {
            const category = this.plugin.getCategoryById(item.categoryId);
            const itemCard = cell.createDiv({ cls: 'scheduler-item-card' });
            
            if (category) {
                itemCard.style.backgroundColor = category.color;
                itemCard.style.borderLeft = `4px solid ${category.color}`;
            }

            const itemName = itemCard.createDiv({ 
                cls: 'item-name', 
                text: item.name 
            });

            if (item.description) {
                const itemDesc = itemCard.createDiv({ 
                    cls: 'item-description', 
                    text: item.description 
                });
            }

            // Add delete button
            const deleteBtn = itemCard.createEl('button', { 
                cls: 'item-delete-btn',
                text: '×'
            });
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.plugin.removeItem(item.id);
                this.refresh();
            });
        });
    }

    renderMonthlyTasks(container: Element) {
        const monthlyGrid = container.createDiv({ cls: 'monthly-grid' });

        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];

        // First row (Jan-Jun)
        const row1 = monthlyGrid.createDiv({ cls: 'monthly-row' });
        for (let i = 0; i < 6; i++) {
            this.renderMonthColumn(row1, i, months[i]);
        }

        // Second row (Jul-Dec)
        const row2 = monthlyGrid.createDiv({ cls: 'monthly-row' });
        for (let i = 6; i < 12; i++) {
            this.renderMonthColumn(row2, i, months[i]);
        }
    }

    renderMonthColumn(row: HTMLElement, monthIndex: number, monthName: string) {
        const monthCol = row.createDiv({ cls: 'month-column' });
        
        // Month header
        const monthHeader = monthCol.createDiv({ cls: 'month-header' });
        monthHeader.createEl('h3', { text: monthName });

        // Add task button
        const addBtn = monthHeader.createEl('button', { 
            cls: 'add-task-btn',
            text: '+' 
        });
        addBtn.addEventListener('click', () => {
            this.openAddMonthlyTaskModal(monthIndex, monthName);
        });

        // Tasks list
        const tasksList = monthCol.createDiv({ cls: 'tasks-list' });
        const tasks = this.plugin.getMonthlyTasks(monthIndex);
        
        tasks.forEach(task => {
            const category = this.plugin.getCategoryById(task.categoryId);
            const taskCard = tasksList.createDiv({ cls: 'task-card' });
            
            if (category) {
                taskCard.style.borderLeft = `4px solid ${category.color}`;
            }

            taskCard.createDiv({ cls: 'task-name', text: task.name });
            
            if (task.description) {
                taskCard.createDiv({ cls: 'task-description', text: task.description });
            }

            // Delete button
            const deleteBtn = taskCard.createEl('button', { 
                cls: 'task-delete-btn',
                text: '×'
            });
            deleteBtn.addEventListener('click', () => {
                this.plugin.removeItem(task.id);
                this.refresh();
            });
        });
    }

    openAddItemModal(day: number, hour: number) {
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const title = `${days[day]} at ${hour.toString().padStart(2, '0')}:00`;
        
        const modal = new AddItemModal(
            this.app,
            this.plugin.settings.categories,
            title,
            (item) => {
                this.plugin.addItemToSchedule(day, hour, item);
                this.refresh();
            }
        );
        modal.open();
    }

    openAddMonthlyTaskModal(month: number, monthName: string) {
        const modal = new AddItemModal(
            this.app,
            this.plugin.settings.categories,
            `Task for ${monthName}`,
            (item) => {
                this.plugin.addMonthlyTask(month, item);
                this.refresh();
            }
        );
        modal.open();
    }

    refresh() {
        const container = this.containerEl.children[1];
        container.empty();
        this.renderScheduler(container);
    }

    async onClose() {
        // Cleanup
    }
}