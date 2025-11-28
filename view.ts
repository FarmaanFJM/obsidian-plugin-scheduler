import { ItemView, Notice, WorkspaceLeaf } from 'obsidian';
import SchedulerPlugin from './main';
import { AddItemModal } from './modal';
import { EditItemModal } from './editModal';
import { SchedulerItem, CategoryConfig, ItemType } from './types';
import { DateUtils } from './dateUtils';

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
        await this.plugin.ensureDataLoaded();

        const container = this.containerEl.children[1];
        container.empty();
        container.addClass('scheduler-container');
        this.renderScheduler(container);
        this.startTimeUpdates();
    }

    renderScheduler(container: Element) {
        const mainDiv = container.createDiv({ cls: 'scheduler-main' });

        // Weekly Scheduler Section
        const weeklySection = mainDiv.createDiv({ cls: 'scheduler-weekly-section' });
        this.renderWeeklyHeader(weeklySection);
        this.renderWeeklyScheduler(weeklySection);

        // Monthly Tasks Section
        const monthlySection = mainDiv.createDiv({ cls: 'scheduler-monthly-section' });
        this.renderMonthlyHeader(monthlySection);
        this.renderMonthlyTasks(monthlySection);

        // General Goals Section
        const goalsSection = mainDiv.createDiv({ cls: 'scheduler-goals-section' });
        this.renderGoalsHeader(goalsSection);
        this.renderGeneralGoals(goalsSection);

        // Backlog Section (Fixed on right side)
        const backlogSection = container.createDiv({ cls: 'scheduler-backlog-section' }); // ADD THIS
        this.renderBacklog(backlogSection);
    }

    renderWeeklyHeader(container: Element) {
        const weeklyHeader = container.createDiv({ cls: 'scheduler-section-header' });

        const titleContainer = weeklyHeader.createDiv({ cls: 'header-title-container' });
        titleContainer.createEl('h2', { text: 'Weekly Schedule' });

        // Get week date range
        const startDate = DateUtils.getDateOfWeek(this.plugin.currentWeek, this.plugin.currentYear);
        const endDate = DateUtils.getSunday(startDate);
        const weekRangeString = DateUtils.getWeekRangeString(startDate, endDate);

        const weekNavContainer = titleContainer.createDiv({ cls: 'week-navigation' });

        const prevWeekBtn = weekNavContainer.createEl('button', {
            cls: 'nav-btn',
            text: '◀'
        });
        prevWeekBtn.addEventListener('click', async () => {
            await this.plugin.changeWeek(-1);
        });

        const weekLabel = weekNavContainer.createEl('span', {
            cls: 'week-label',
            text: weekRangeString
        });

        const nextWeekBtn = weekNavContainer.createEl('button', {
            cls: 'nav-btn',
            text: '▶'
        });
        nextWeekBtn.addEventListener('click', async () => {
            await this.plugin.changeWeek(1);
        });

        const todayBtn = weekNavContainer.createEl('button', {
            cls: 'today-btn',
            text: 'Today'
        });
        todayBtn.addEventListener('click', async () => {
            const { weekNumber, year } = DateUtils.getCurrentWeekInfo();
            if (this.plugin.currentYear !== year) {
                await this.plugin.loadYearData(year);
            }
            this.plugin.currentWeek = weekNumber;
            this.plugin.currentYear = year;
            this.refresh();
        });

        // Jump to Date
        const jumpContainer = weekNavContainer.createDiv({ cls: 'week-jump-container' });

        const jumpInput = jumpContainer.createEl('input') as HTMLInputElement;
        jumpInput.type = 'date';
        jumpInput.addClass('week-jump-input');

        // Prefill with current Monday
        const isoMonday = DateUtils.toISODateString(startDate);
        jumpInput.value = isoMonday;

        const jumpBtn = jumpContainer.createEl('button', {
            cls: 'nav-btn week-jump-btn',
            text: 'Go'
        });

        jumpBtn.addEventListener('click', async () => {
            if (!jumpInput.value) return;

            const targetDate = new Date(jumpInput.value);
            if (isNaN(targetDate.getTime())) return;

            const newWeekNumber = DateUtils.getWeekNumber(targetDate);
            const newYear = DateUtils.getYearForWeek(newWeekNumber, targetDate);

            if (this.plugin.currentYear !== newYear) {
                await this.plugin.loadYearData(newYear);
            }

            this.plugin.currentWeek = newWeekNumber;
            this.plugin.currentYear = newYear;
            this.refresh();
        });

        const buttonGroup = weeklyHeader.createDiv({ cls: 'header-button-group' });

        // Refresh button
        const refreshBtn = buttonGroup.createEl('button', {
            cls: 'refresh-btn',
            text: 'Refresh'
        });
        refreshBtn.addEventListener('click', () => {
            this.refresh();
            new Notice('Scheduler refreshed!');
        });

        // Populate Tasks button
        const populateBtn = buttonGroup.createEl('button', {
            cls: 'populate-btn',
            text: 'Insert Standard Tasks'
        });
        populateBtn.addEventListener('click', () => {
            this.plugin.populateStandardTasks();
        });

        // Clear Non-Standard button
        const clearNonStandardBtn = buttonGroup.createEl('button', {
            cls: 'clear-weekly-btn',
            text: '🗑️ Clear Non-Standard Tasks'
        });
        clearNonStandardBtn.addEventListener('click', () => {
            const confirmed = confirm('Clear all non-standard tasks for current week?');
            if (confirmed) {
                this.plugin.clearNonStandardTasks();
            }
        });

        // Clear All Week Tasks button
        const clearAllBtn = buttonGroup.createEl('button', {
            cls: 'clear-all-btn',
            text: '🗑️ Clear All Week Tasks'
        });
        clearAllBtn.addEventListener('click', () => {
            const confirmed = confirm('Clear ALL tasks for current week (including standard/recurring)?');
            if (confirmed) {
                this.plugin.clearAllTasks();
            }
        });
    }


    renderMonthlyHeader(container: Element) {
        const monthlyHeader = container.createDiv({ cls: 'scheduler-section-header' });

        const titleContainer = monthlyHeader.createDiv({ cls: 'header-title-container' });
        titleContainer.createEl('h2', { text: 'Monthly Schedule' });

        const yearNavContainer = titleContainer.createDiv({ cls: 'year-navigation' });

        const prevYearBtn = yearNavContainer.createEl('button', {
            cls: 'nav-btn',
            text: '◀'
        });
        prevYearBtn.addEventListener('click', async () => {
            await this.plugin.changeYear(-1);
        });

        const yearLabel = yearNavContainer.createEl('span', {
            cls: 'year-label',
            text: this.plugin.currentYear.toString()
        });

        const nextYearBtn = yearNavContainer.createEl('button', {
            cls: 'nav-btn',
            text: '▶'
        });
        nextYearBtn.addEventListener('click', async () => {
            await this.plugin.changeYear(1);
        });

        const currentYearBtn = yearNavContainer.createEl('button', {
            cls: 'today-btn',
            text: 'Current Year'
        });
        currentYearBtn.addEventListener('click', async () => {
            const currentYear = new Date().getFullYear();
            if (this.plugin.currentYear !== currentYear) {
                this.plugin.currentYear = currentYear;
                await this.plugin.loadYearData(currentYear);
                this.refresh();
            }
        });
    }

    renderWeeklyScheduler(container: Element) {
        const weeklyGrid = container.createDiv({ cls: 'weekly-grid' });
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

        // Header row
        const headerRow = weeklyGrid.createDiv({ cls: 'weekly-header-row' });
        headerRow.createDiv({ cls: 'time-header', text: 'Time' });

        const today = new Date();
        const currentDay = (today.getDay() + 6) % 7;

        // Check if we're viewing the current week
        const { weekNumber, year } = DateUtils.getCurrentWeekInfo();
        const isCurrentWeek = (this.plugin.currentWeek === weekNumber && this.plugin.currentYear === year);

        days.forEach((day, index) => {
            const header = headerRow.createDiv({ cls: 'day-header', text: day });
            if (index === currentDay && isCurrentWeek) {
                header.addClass('is-today');
            }
        });

        // Get visible hour range
        const startHour = this.plugin.settings.sleepSchedule.enabled
            ? this.plugin.settings.sleepSchedule.wakeTime
            : 0;
        const endHour = this.plugin.settings.sleepSchedule.enabled
            ? this.plugin.settings.sleepSchedule.sleepTime
            : 23;

        // Create hourly rows
        for (let hour = startHour; hour <= endHour; hour++) {
            const hourRow = weeklyGrid.createDiv({ cls: 'weekly-hour-row' });

            const hourStr = hour.toString().padStart(2, '0');
            hourRow.createDiv({
                cls: 'time-cell',
                text: `${hourStr}:00`
            });

            days.forEach((_, dayIndex) => {
                const dayCell = hourRow.createDiv({ cls: 'day-cell' });
                dayCell.dataset.day = dayIndex.toString();
                dayCell.dataset.hour = hour.toString();

                if (dayIndex === currentDay && isCurrentWeek) {
                    dayCell.addClass('is-today');
                }

                const items = this.plugin.getItemsForCell(dayIndex, hour);
                this.renderCellItems(dayCell, items);

                dayCell.addEventListener('click', () => {
                    this.openAddItemModal(dayIndex, hour);
                });
            });
        }
    }

    // ========== BACKLOG RENDERING ==========

    renderBacklog(container: Element) {
        const backlogHeader = container.createDiv({ cls: 'backlog-header' });
        backlogHeader.createEl('h3', { text: 'To-Do Backlog' });

        // Create button container
        const buttonContainer = backlogHeader.createDiv({ cls: 'backlog-header-buttons' });

        const addBtn = buttonContainer.createEl('button', {
            cls: 'add-task-btn',
            text: '+'
        });
        addBtn.addEventListener('click', () => {
            this.openAddBacklogItemModal();
        });

        const trashBtn = buttonContainer.createEl('button', {
            cls: 'trash-task-btn',
            text: '🗑️'
        });
        trashBtn.addEventListener('click', () => {
            const confirmed = confirm('Clear all backlog items?');
            if (confirmed) {
                this.plugin.clearBacklogItems();
            }
        });

        const backlogList = container.createDiv({ cls: 'backlog-list' });
        const allItems = this.plugin.getBacklogItems();

        if (allItems.length === 0) {
            backlogList.createDiv({
                cls: 'backlog-empty',
                text: 'No items in backlog'
            });
        } else {
            // Group backlog items by category
            const itemsByCategory: Record<string, SchedulerItem[]> = {};

            this.plugin.settings.categories.forEach(cat => {
                itemsByCategory[cat.id] = [];
            });

            allItems.forEach(item => {
                if (itemsByCategory[item.categoryId]) {
                    itemsByCategory[item.categoryId].push(item);
                }
            });

            // Render each category that has items
            this.plugin.settings.categories.forEach(category => {
                const items = itemsByCategory[category.id];
                if (items.length === 0) return;

                // Category divider
                const header = backlogList.createDiv({ cls: 'monthly-type-header' });
                header.setText(`──────── ${category.name.toUpperCase()} ────────`);

                // Render items in this category
                items.forEach((item, index) => {
                    this.renderBacklogItemCard(backlogList, item, index, items.length, category.id);
                });
            });
        }
    }

    renderBacklogItemCard(backlogList: HTMLElement, item: SchedulerItem, index: number, totalCount: number, categoryId: string) {
        const category = this.plugin.getCategoryById(item.categoryId);
        const itemCard = backlogList.createDiv({ cls: 'task-card' });

        // Add type-specific class
        itemCard.addClass(`item-type-${item.itemType || 'regular'}`);

        // Add completed class for tasks
        if (item.itemType === 'task' && item.completed) {
            itemCard.addClass('item-completed');
        }

        if (category) {
            const baseColor = category.color;
            const rgb = this.hexToRgb(baseColor);

            itemCard.style.borderLeftColor = baseColor;
            itemCard.style.setProperty('--category-color-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);

            if (item.itemType === 'goal') {
                itemCard.style.borderRightColor = baseColor;
                itemCard.style.borderTopColor = baseColor;
                itemCard.style.borderBottomColor = baseColor;
            }

            if (item.itemType === 'regular' || item.itemType === 'deadline') {
                itemCard.style.backgroundColor = baseColor;
            }

            let textColor: string;
            if (item.itemType === 'task' || item.itemType === 'goal') {
                textColor = '#1a1a1a';
            } else {
                textColor = this.getContrastColor(baseColor);
            }

            const nameDiv = itemCard.createDiv({ cls: 'task-name' });
            nameDiv.setText(item.name);
            nameDiv.style.color = textColor;

            if (item.description) {
                const descDiv = itemCard.createDiv({ cls: 'task-description' });
                descDiv.setText(item.description);
                descDiv.style.color = textColor;
                descDiv.style.opacity = '0.75';
            }
        } else {
            itemCard.createDiv({ cls: 'task-name', text: item.name });
            if (item.description) {
                itemCard.createDiv({ cls: 'task-description', text: item.description });
            }
        }

        // Button container
        const btnContainer = itemCard.createDiv({ cls: 'task-buttons' });

        // Up button (within same category)
        if (index > 0) {
            const upBtn = btnContainer.createEl('button', {
                cls: 'task-reorder-btn task-up-btn',
                text: '▲'
            });
            upBtn.addEventListener('click', () => {
                this.plugin.reorderBacklogItemInCategory(item.id, categoryId, 'up');
            });
        }

        // Down button (within same category)
        if (index < totalCount - 1) {
            const downBtn = btnContainer.createEl('button', {
                cls: 'task-reorder-btn task-down-btn',
                text: '▼'
            });
            downBtn.addEventListener('click', () => {
                this.plugin.reorderBacklogItemInCategory(item.id, categoryId, 'down');
            });
        }

        // Checkbox for tasks
        if (item.itemType === 'task') {
            const checkBtn = btnContainer.createEl('button', {
                cls: 'task-check-btn',
                text: item.completed ? '☑' : '☐'
            });
            checkBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.plugin.updateItem(item.id, { completed: !item.completed });
            });
        }

        // Edit button
        const editBtn = btnContainer.createEl('button', {
            cls: 'task-edit-btn',
            text: '✎'
        });
        editBtn.addEventListener('click', () => {
            this.openEditBacklogItemModal(item);
        });

        // Delete button
        const deleteBtn = btnContainer.createEl('button', {
            cls: 'task-delete-btn',
            text: '×'
        });
        deleteBtn.addEventListener('click', () => {
            this.plugin.removeItem(item.id);
            this.refresh();
        });
    }

    openAddBacklogItemModal() {
        const modal = new AddItemModal(
            this.app,
            this.plugin.settings.categories,
            'New Backlog Item',
            (item: Omit<SchedulerItem, 'id'>) => {
                this.plugin.addBacklogItem(item);
            }
        );
        modal.open();
    }

    openEditBacklogItemModal(item: SchedulerItem) {
        const modal = new EditItemModal(
            this.app,
            this.plugin.settings.categories,
            item,
            (updates: Partial<SchedulerItem>) => {
                this.plugin.updateItem(item.id, updates);
            }
        );
        modal.open();
    }

    renderCellItems(cell: HTMLElement, items: SchedulerItem[]) {
        cell.empty();

        items.forEach(item => {
            const category = this.plugin.getCategoryById(item.categoryId);
            const itemCard = cell.createDiv({ cls: 'scheduler-item-card' });

            // Add type-specific class
            itemCard.addClass(`item-type-${item.itemType || 'regular'}`);

            // Add completed class for tasks
            if (item.itemType === 'task' && item.completed) {
                itemCard.addClass('item-completed');
            }

            if (category) {
                const baseColor = category.color;
                const rgb = this.hexToRgb(baseColor);

                // Set border colors
                itemCard.style.borderLeftColor = baseColor;

                // For goal and deadline, also set right border
                if (item.itemType === 'goal') {
                    itemCard.style.borderRightColor = baseColor;
                    itemCard.style.borderTopColor = baseColor;
                    itemCard.style.borderBottomColor = baseColor;
                }

                // For task and goal: use RGB variable for gradient backgrounds
                if (item.itemType === 'task' || item.itemType === 'goal') {
                    itemCard.style.setProperty('--category-color-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
                }

                // For regular and deadline: apply full color directly
                if (item.itemType === 'regular' || item.itemType === 'deadline') {
                    itemCard.style.backgroundColor = baseColor;
                }

                // Calculate contrast color for text
                let textColor;

                // TASK + GOAL → light background → use dark text
                if (item.itemType === "task" || item.itemType === "goal") {
                    textColor = "#1a1a1a";
                }
                // REGULAR + DEADLINE → full-color background → use proper contrast
                else {
                    textColor = this.getContrastColor(baseColor);
                }

                // Create name element
                const nameDiv = itemCard.createDiv({ cls: 'item-name' });
                nameDiv.setText(item.name);
                nameDiv.style.color = textColor;

                // Create description element if it exists
                if (item.description) {
                    const descDiv = itemCard.createDiv({ cls: 'item-description' });
                    descDiv.setText(item.description);
                    descDiv.style.color = textColor;
                    descDiv.style.opacity = '0.75';
                }
            } else {
                // Fallback if no category
                itemCard.createDiv({ cls: 'item-name', text: item.name });

                if (item.description) {
                    itemCard.createDiv({
                        cls: 'item-description',
                        text: item.description
                    });
                }
            }

            // Button container
            const btnContainer = itemCard.createDiv({ cls: 'item-buttons' });

            // Checkbox for tasks
            if (item.itemType === 'task') {
                const checkBtn = btnContainer.createEl('button', {
                    cls: 'item-check-btn',
                    text: item.completed ? '☑' : '☐'
                });
                checkBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.plugin.updateItem(item.id, { completed: !item.completed });
                });
            }

            // Edit button
            const editBtn = btnContainer.createEl('button', {
                cls: 'item-edit-btn',
                text: '✎'
            });
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openEditItemModal(item);
            });

            // Delete button
            const deleteBtn = btnContainer.createEl('button', {
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

        const monthHeader = monthCol.createDiv({ cls: 'month-header' });
        monthHeader.createEl('h3', { text: monthName });

        const addBtn = monthHeader.createEl('button', {
            cls: 'add-task-btn',
            text: '+'
        });
        addBtn.addEventListener('click', () => {
            this.openAddMonthlyTaskModal(monthIndex, monthName);
        });

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

        const tasksList = monthCol.createDiv({ cls: 'tasks-list' });
        const allTasks = this.plugin.getMonthlyTasks(monthIndex);

        // Group tasks by type
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

    private renderMonthlyTaskCard(tasksList: HTMLElement, task: SchedulerItem, monthIndex: number, taskType: string, index: number, totalCount: number) {
        const category = this.plugin.getCategoryById(task.categoryId);
        const taskCard = tasksList.createDiv({ cls: 'task-card' });

        // Add type-specific class
        taskCard.addClass(`item-type-${task.itemType || 'regular'}`);

        // Add completed class for tasks
        if (task.itemType === 'task' && task.completed) {
            taskCard.addClass('item-completed');
        }

        if (category) {
            const baseColor = category.color;
            const rgb = this.hexToRgb(baseColor);

            // Left border color
            taskCard.style.borderLeftColor = baseColor;

            // Always expose category color via CSS variable
            taskCard.style.setProperty(
                '--category-color-rgb',
                `${rgb.r}, ${rgb.g}, ${rgb.b}`
            );

            // For goal, also set full border
            if (task.itemType === 'goal') {
                taskCard.style.borderRightColor = baseColor;
                taskCard.style.borderTopColor = baseColor;
                taskCard.style.borderBottomColor = baseColor;
            }

            // For regular and deadline we still give a solid base background
            if (task.itemType === 'regular' || task.itemType === 'deadline') {
                taskCard.style.backgroundColor = baseColor;
            }

            // Text color: dark for light backgrounds (task/goal), contrast for others
            let textColor: string;
            if (task.itemType === 'task' || task.itemType === 'goal') {
                textColor = '#1a1a1a';
            } else {
                textColor = this.getContrastColor(baseColor);
            }

            const nameDiv = taskCard.createDiv({ cls: 'task-name' });
            nameDiv.setText(task.name);
            nameDiv.style.color = textColor;

            if (task.description) {
                const descDiv = taskCard.createDiv({ cls: 'task-description' });
                descDiv.setText(task.description);
                descDiv.style.color = textColor;
                descDiv.style.opacity = '0.75';
            }
        } else {
            taskCard.createDiv({ cls: 'task-name', text: task.name });

            if (task.description) {
                taskCard.createDiv({
                    cls: 'task-description',
                    text: task.description
                });
            }
        }

        // Button container
        const btnContainer = taskCard.createDiv({ cls: 'task-buttons' });

        // Up button (if not first in this type group)
        if (index > 0) {
            const upBtn = btnContainer.createEl('button', {
                cls: 'task-reorder-btn task-up-btn',
                text: '▲'
            });
            upBtn.addEventListener('click', () => {
                this.plugin.reorderMonthlyTask(task.id, monthIndex, taskType, 'up');
            });
        }

        // Down button (if not last in this type group)
        if (index < totalCount - 1) {
            const downBtn = btnContainer.createEl('button', {
                cls: 'task-reorder-btn task-down-btn',
                text: '▼'
            });
            downBtn.addEventListener('click', () => {
                this.plugin.reorderMonthlyTask(task.id, monthIndex, taskType, 'down');
            });
        }

        // Checkbox for tasks
        if (task.itemType === 'task') {
            const checkBtn = btnContainer.createEl('button', {
                cls: 'task-check-btn',
                text: task.completed ? '☑' : '☐'
            });
            checkBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.plugin.updateItem(task.id, { completed: !task.completed });
            });
        }

        // Edit button
        const editBtn = btnContainer.createEl('button', {
            cls: 'task-edit-btn',
            text: '✎'
        });
        editBtn.addEventListener('click', () => {
            this.openEditMonthlyTaskModal(task);
        });

        // Delete button
        const deleteBtn = btnContainer.createEl('button', {
            cls: 'task-delete-btn',
            text: '×'
        });
        deleteBtn.addEventListener('click', () => {
            this.plugin.removeItem(task.id);
            this.refresh();
        });
    }

    // ========== GENERAL GOALS RENDERING ==========

    renderGoalsHeader(container: Element) {
        const goalsHeader = container.createDiv({ cls: 'scheduler-section-header' });

        const titleContainer = goalsHeader.createDiv({ cls: 'header-title-container' });
        titleContainer.createEl('h2', { text: 'General Goals' });
    }

    renderGeneralGoals(container: Element) {
        const goalsGrid = container.createDiv({ cls: 'goals-grid' });

        const allGoals = this.plugin.getGeneralGoals();

        // Group goals by category
        const goalsByCategory: Record<string, SchedulerItem[]> = {};

        this.plugin.settings.categories.forEach(cat => {
            goalsByCategory[cat.id] = [];
        });

        allGoals.forEach(goal => {
            if (goalsByCategory[goal.categoryId]) {
                goalsByCategory[goal.categoryId].push(goal);
            }
        });

        // Render in rows of 3 categories
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

    renderGoalsCategoryColumn(row: HTMLElement, category: CategoryConfig, goals: SchedulerItem[]) {
        const categoryCol = row.createDiv({ cls: 'goals-category-column' });

        const categoryHeader = categoryCol.createDiv({ cls: 'goals-category-header' });
        categoryHeader.createEl('h3', { text: category.name });

        const addBtn = categoryHeader.createEl('button', {
            cls: 'add-task-btn',
            text: '+'
        });
        addBtn.addEventListener('click', () => {
            this.openAddGeneralGoalModal(category.id);
        });

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

        // Category divider (like monthly view)
        if (goals.length > 0) {
            const header = categoryCol.createDiv({ cls: 'monthly-type-header' });
            header.setText(`──────── ${category.name.toUpperCase()} ────────`);
        }

        const goalsList = categoryCol.createDiv({ cls: 'goals-list' });
        goals.forEach((goal, index) => {
            this.renderGoalCard(goalsList, goal, index, goals.length);
        });
    }

    renderGoalCard(goalsList: HTMLElement, goal: SchedulerItem, index: number, totalCount: number) {
        const category = this.plugin.getCategoryById(goal.categoryId);
        const goalCard = goalsList.createDiv({ cls: 'task-card item-type-goal' });

        if (category) {
            const baseColor = category.color;
            const rgb = this.hexToRgb(baseColor);

            // Set border colors for gold frame
            goalCard.style.borderLeftColor = baseColor;
            goalCard.style.borderRightColor = baseColor;
            goalCard.style.borderTopColor = baseColor;
            goalCard.style.borderBottomColor = baseColor;

            goalCard.style.setProperty('--category-color-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);

            const textColor = '#1a1a1a';

            const nameDiv = goalCard.createDiv({ cls: 'task-name' });
            nameDiv.setText(goal.name);
            nameDiv.style.color = textColor;

            if (goal.description) {
                const descDiv = goalCard.createDiv({ cls: 'task-description' });
                descDiv.setText(goal.description);
                descDiv.style.color = textColor;
                descDiv.style.opacity = '0.75';
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

        // Up button (if not first)
        if (index > 0) {
            const upBtn = btnContainer.createEl('button', {
                cls: 'task-reorder-btn task-up-btn',
                text: '▲'
            });
            upBtn.addEventListener('click', () => {
                this.plugin.reorderGeneralGoal(goal.id, 'up');
            });
        }

        // Down button (if not last)
        if (index < totalCount - 1) {
            const downBtn = btnContainer.createEl('button', {
                cls: 'task-reorder-btn task-down-btn',
                text: '▼'
            });
            downBtn.addEventListener('click', () => {
                this.plugin.reorderGeneralGoal(goal.id, 'down');
            });
        }

        // Edit button
        const editBtn = btnContainer.createEl('button', {
            cls: 'task-edit-btn',
            text: '✎'
        });
        editBtn.addEventListener('click', () => {
            this.openEditGeneralGoalModal(goal);
        });

        // Delete button
        const deleteBtn = btnContainer.createEl('button', {
            cls: 'task-delete-btn',
            text: '×'
        });
        deleteBtn.addEventListener('click', () => {
            this.plugin.removeItem(goal.id);
            this.refresh();
        });
    }

    openAddGeneralGoalModal(categoryId?: string) {
        const categoryName = categoryId
            ? this.plugin.settings.categories.find(c => c.id === categoryId)?.name
            : 'General';

        const modal = new AddItemModal(
            this.app,
            this.plugin.settings.categories,
            `New Goal - ${categoryName}`,
            (item: Omit<SchedulerItem, 'id'>) => {
                // Override to ensure it's a goal type
                const goalItem = {
                    ...item,
                    itemType: 'goal' as ItemType,
                    categoryId: categoryId || item.categoryId
                };
                this.plugin.addGeneralGoal(goalItem);
            },
            {
                lockedCategoryId: categoryId // Lock the category if provided
            }
        );
        modal.open();
    }

    openEditGeneralGoalModal(goal: SchedulerItem) {
        const modal = new EditItemModal(
            this.app,
            this.plugin.settings.categories,
            goal,
            (updates: Partial<SchedulerItem>) => {
                this.plugin.updateItem(goal.id, updates);
            }
        );
        modal.open();
    }

    // ========== MODAL HELPERS ==========

    openAddItemModal(day: number, hour: number) {
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const title = `${days[day]} at ${hour.toString().padStart(2, '0')}:00`;

        const modal = new AddItemModal(
            this.app,
            this.plugin.settings.categories,
            title,
            (item: Omit<SchedulerItem, 'id'>) => {
                this.plugin.addItemToSchedule(day, hour, item);
                this.refresh();
            }
        );
        modal.open();
    }

    openEditItemModal(item: SchedulerItem) {
        const modal = new EditItemModal(
            this.app,
            this.plugin.settings.categories,
            item,
            (updates: Partial<SchedulerItem>) => {
                this.plugin.updateItem(item.id, updates);
            }
        );
        modal.open();
    }

    openAddMonthlyTaskModal(month: number, monthName: string) {
        const modal = new AddItemModal(
            this.app,
            this.plugin.settings.categories,
            `Task for ${monthName}`,
            (item: Omit<SchedulerItem, 'id'>) => {
                this.plugin.addMonthlyTask(month, item);
                this.refresh();
            },
            {
                monthIndex: month,
                year: this.plugin.currentYear
            }
        );
        modal.open();
    }


    openEditMonthlyTaskModal(task: SchedulerItem) {
        const modal = new EditItemModal(
            this.app,
            this.plugin.settings.categories,
            task,
            (updates: Partial<SchedulerItem>) => {
                this.plugin.updateItem(task.id, updates);
            }
        );
        modal.open();
    }

    // ========== UTILITY METHODS ==========

    getContrastColor(bgColor: string): string {
        const hex = bgColor.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance > 0.5 ? '#1a1a1a' : '#ffffff';
    }

    hexToRgb(hex: string): { r: number; g: number; b: number } {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    }

    startTimeUpdates() {
        if (this.timeUpdateInterval !== null) {
            window.clearInterval(this.timeUpdateInterval);
        }

        this.updateTimeIndicator();

        this.timeUpdateInterval = window.setInterval(() => {
            this.updateTimeIndicator();
        }, 60000);

        this.registerInterval(this.timeUpdateInterval);
    }

    updateTimeIndicator() {
        // Remove old highlights
        const oldHighlights = this.containerEl.querySelectorAll('.current-hour-cell');
        oldHighlights.forEach(el => el.classList.remove('current-hour-cell'));

        const oldTimeLabels = this.containerEl.querySelectorAll('.current-hour-label');
        oldTimeLabels.forEach(el => el.classList.remove('current-hour-label'));

        const now = new Date();
        const currentHour = now.getHours();
        const currentDay = (now.getDay() + 6) % 7; // Monday = 0

        const startHour = this.plugin.settings.sleepSchedule.enabled
            ? this.plugin.settings.sleepSchedule.wakeTime
            : 0;
        const endHour = this.plugin.settings.sleepSchedule.enabled
            ? this.plugin.settings.sleepSchedule.sleepTime
            : 23;

        if (currentHour < startHour || currentHour > endHour) return;

        // Only highlight if viewing current week
        const { weekNumber, year } = DateUtils.getCurrentWeekInfo();
        const isCurrentWeek = (this.plugin.currentWeek === weekNumber && this.plugin.currentYear === year);

        if (!isCurrentWeek) return;

        // Highlight ONLY the current day's current hour cell
        const allCells = this.containerEl.querySelectorAll('.day-cell');
        allCells.forEach((cell: HTMLElement) => {
            const cellHour = parseInt(cell.dataset.hour || '-1');
            const cellDay = parseInt(cell.dataset.day || '-1');

            // Only highlight if it's the current hour AND current day
            if (cellHour === currentHour && cellDay === currentDay) {
                cell.classList.add('current-hour-cell');
            }
        });

        // Highlight the time label
        const timeCells = this.containerEl.querySelectorAll('.time-cell');
        const rowIndex = currentHour - startHour;
        if (rowIndex >= 0 && rowIndex < timeCells.length) {
            timeCells[rowIndex].classList.add('current-hour-label');
            timeCells[rowIndex].classList.add('current-hour-cell');
        }
    }

    refresh() {
        const container = this.containerEl.children[1];
        container.empty();
        this.renderScheduler(container);
        this.updateTimeIndicator();
    }

    async onClose() {
        if (this.timeUpdateInterval !== null) {
            window.clearInterval(this.timeUpdateInterval);
        }
    }
}