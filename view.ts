import { ItemView, WorkspaceLeaf } from 'obsidian';
import SchedulerPlugin from './main';
import { AddItemModal } from './modal';
import { SchedulerItem, CategoryConfig } from './types';

export const VIEW_TYPE_SCHEDULER = 'scheduler-view';

export class SchedulerView extends ItemView {
    plugin: SchedulerPlugin;
    private timeUpdateInterval: number | null = null;

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

        // Start time indicator updates
        this.startTimeUpdates();
    }

    renderScheduler(container: Element) {
        // Main container
        const mainDiv = container.createDiv({ cls: 'scheduler-main' });

        // Weekly Scheduler Section
        const weeklySection = mainDiv.createDiv({ cls: 'scheduler-weekly-section' });

        // Create header with title and clear button
        const weeklyHeader = weeklySection.createDiv({ cls: 'scheduler-section-header' });
        weeklyHeader.createEl('h2', { text: 'Weekly Schedule' });

        const clearAllBtn = weeklyHeader.createEl('button', {
            cls: 'clear-weekly-btn',
            text: '🗑️ Clear All Tasks'
        });
        clearAllBtn.addEventListener('click', () => {
            const confirmed = confirm('Clear ALL weekly tasks including standard tasks?');
            if (confirmed) {
                this.plugin.clearAllTasks();
            }
        });
        const clearWeeklyBtn = weeklyHeader.createEl('button', {
            cls: 'clear-weekly-btn',
            text: '🗑️ Clear Weekly Tasks'
        });
        clearWeeklyBtn.addEventListener('click', () => {
            const confirmed = confirm('Clear ALL weekly tasks (excluding standard tasks)?');
            if (confirmed) {
                this.plugin.clearNonStandardTasks();
            }
        });


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

        const today = new Date();
        const currentDay = (today.getDay() + 6) % 7; // Convert to Mon=0

        days.forEach((day, index) => {
            const header = headerRow.createDiv({ cls: 'day-header', text: day });
            if (index === currentDay) {
                header.addClass('is-today');
            }
        });

        // Get visible hour range based on sleep schedule
        const startHour = this.plugin.settings.sleepSchedule.enabled
            ? this.plugin.settings.sleepSchedule.wakeTime
            : 0;
        const endHour = this.plugin.settings.sleepSchedule.enabled
            ? this.plugin.settings.sleepSchedule.sleepTime
            : 23;

        // Create hourly rows (only visible range)
        for (let hour = startHour; hour <= endHour; hour++) {
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

                if (dayIndex === currentDay) {
                    dayCell.addClass('is-today');
                }

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

                // Set text color for contrast
                const textColor = this.getContrastColor(category.color);
                itemCard.style.color = textColor;
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

        // Create 3 rows of 4 columns each
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

        // Add trash button
        const trashBtn = monthHeader.createEl('button', {
            cls: 'trash-task-btn',
            text: '🗑️'
        });
        trashBtn.addEventListener('click', () => {
            // Confirm before clearing
            const confirmed = confirm(`Clear all tasks for ${monthName}?`);
            if (confirmed) {
                this.plugin.clearMonthTasks(monthIndex);
            }
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

    getContrastColor(bgColor: string): string {
        // Remove # if present
        const hex = bgColor.replace('#', '');

        // Convert to RGB
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);

        // Calculate luminance
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

        // Return white for dark, black for light
        return luminance > 0.5 ? '#1a1a1a' : '#ffffff';
    }

    startTimeUpdates() {
        // Clear any existing interval first
        if (this.timeUpdateInterval !== null) {
            window.clearInterval(this.timeUpdateInterval);
        }

        // Initial draw
        this.updateTimeIndicator();

        // Update every minute
        this.timeUpdateInterval = window.setInterval(() => {
            this.updateTimeIndicator();
        }, 60000);

        this.registerInterval(this.timeUpdateInterval);
    }

    updateTimeIndicator() {
        // Remove old highlights
        const oldHighlights = this.containerEl.querySelectorAll('.current-hour-row');
        oldHighlights.forEach(el => el.classList.remove('current-hour-row'));

        const now = new Date();
        const currentHour = now.getHours();

        // Check if current hour is in visible range
        const startHour = this.plugin.settings.sleepSchedule.enabled
            ? this.plugin.settings.sleepSchedule.wakeTime
            : 0;
        const endHour = this.plugin.settings.sleepSchedule.enabled
            ? this.plugin.settings.sleepSchedule.sleepTime
            : 23;

        if (currentHour < startHour || currentHour > endHour) return;

        // Find all cells for the current hour
        const allCells = this.containerEl.querySelectorAll('.day-cell');
        allCells.forEach((cell: HTMLElement) => {
            const cellHour = parseInt(cell.dataset.hour || '-1');
            if (cellHour === currentHour) {
                cell.classList.add('current-hour-row');
            }
        });

        // Also highlight the time cell
        const timeCells = this.containerEl.querySelectorAll('.time-cell');
        const rowIndex = currentHour - startHour;
        if (rowIndex >= 0 && rowIndex < timeCells.length) {
            timeCells[rowIndex].classList.add('current-hour-row');
        }
    }
    refresh() {
        const container = this.containerEl.children[1];
        container.empty();
        this.renderScheduler(container);

        // Restart time updates after refresh
        this.updateTimeIndicator();
    }

    async onClose() {
        if (this.timeUpdateInterval !== null) {
            window.clearInterval(this.timeUpdateInterval);
        }
    }
}