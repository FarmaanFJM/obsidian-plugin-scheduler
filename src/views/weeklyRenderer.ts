/**
 * Weekly Schedule Renderer
 * 
 * RESPONSIBILITY:
 * Renders the weekly schedule grid with 7 days × hours layout.
 * Each cell can contain multiple items and is clickable to add new items.
 * 
 * USED BY:
 * - view.ts (main scheduler view calls renderWeeklyScheduler())
 * 
 * FEATURES:
 * - 7-day grid (Monday-Sunday)
 * - Hourly rows (respects sleep schedule if enabled)
 * - Current day/hour highlighting
 * - Week navigation (prev/next/today/jump to date)
 * - Click cell to add item
 * - Item cards with edit/delete/checkbox controls
 * - Standard tasks population
 * - Clear tasks functionality
 * 
 * SLEEP SCHEDULE:
 * - When enabled: Only shows hours between wake time and sleep time
 * - When disabled: Shows all 24 hours (00:00-23:00)
 */

import type SchedulerPlugin from '../main';
import { SchedulerItem } from '../types';
import { DateUtils } from '../utils/dateUtils';
import { AddItemModal } from '../modals/addItemModal';
import { EditItemModal } from '../modals/editItemModal';
import { ItemRenderer } from './itemRenderer';

export class WeeklyRenderer {
    private plugin: SchedulerPlugin;
    private itemRenderer: ItemRenderer;
    private refreshView: () => void;

    constructor(plugin: SchedulerPlugin, refreshView: () => void) {
        this.plugin = plugin;
        this.itemRenderer = new ItemRenderer(plugin);
        this.refreshView = refreshView;
    }

    /**
     * Render weekly section header with navigation controls
     */
    renderWeeklyHeader(container: Element) {
        const weeklyHeader = container.createDiv({ cls: 'scheduler-section-header' });

        const titleContainer = weeklyHeader.createDiv({ cls: 'header-title-container' });
        titleContainer.createEl('h2', { text: 'Weekly Schedule' });

        // Get week date range for display
        const startDate = DateUtils.getDateOfWeek(this.plugin.currentWeek, this.plugin.currentYear);
        const endDate = DateUtils.getSunday(startDate);
        const weekRangeString = DateUtils.getWeekRangeString(startDate, endDate);

        const weekNavContainer = titleContainer.createDiv({ cls: 'week-navigation' });

        // Previous week button
        const prevWeekBtn = weekNavContainer.createEl('button', {
            cls: 'nav-btn',
            text: '◀'
        });
        prevWeekBtn.addEventListener('click', async () => {
            await this.plugin.changeWeek(-1);
        });

        // Week label (shows date range)
        const weekLabel = weekNavContainer.createEl('span', {
            cls: 'week-label',
            text: weekRangeString
        });

        // Next week button
        const nextWeekBtn = weekNavContainer.createEl('button', {
            cls: 'nav-btn',
            text: '▶'
        });
        nextWeekBtn.addEventListener('click', async () => {
            await this.plugin.changeWeek(1);
        });

        // Today button (jump to current week)
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
            this.refreshView();
        });

        // Jump to date functionality
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
            this.refreshView();
        });

        // Action buttons group
        const buttonGroup = weeklyHeader.createDiv({ cls: 'header-button-group' });

        // Populate standard tasks button
        const populateBtn = buttonGroup.createEl('button', {
            cls: 'populate-btn',
            text: 'Insert Standard Tasks'
        });
        populateBtn.addEventListener('click', () => {
            this.plugin.populateStandardTasks();
        });

        // Clear non-standard tasks button
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

        // Clear ALL tasks button (destructive)
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

    /**
     * Render weekly schedule grid (7 days × hours)
     */
    renderWeeklyScheduler(container: Element) {
        const weeklyGrid = container.createDiv({ cls: 'weekly-grid' });
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

        // Header row with day names
        const headerRow = weeklyGrid.createDiv({ cls: 'weekly-header-row' });
        headerRow.createDiv({ cls: 'time-header', text: 'Time' });

        // Detect current day for highlighting
        const today = new Date();
        const currentDay = (today.getDay() + 6) % 7; // Convert Sunday=0 to Monday=0

        // Check if viewing current week
        const { weekNumber, year } = DateUtils.getCurrentWeekInfo();
        const isCurrentWeek = (this.plugin.currentWeek === weekNumber && this.plugin.currentYear === year);

        days.forEach((day, index) => {
            const header = headerRow.createDiv({ cls: 'day-header', text: day });
            // Highlight current day if viewing current week
            if (index === currentDay && isCurrentWeek) {
                header.addClass('is-today');
            }
        });

        // Get visible hour range (respects sleep schedule)
        const startHour = this.plugin.settings.sleepSchedule.enabled
            ? this.plugin.settings.sleepSchedule.wakeTime
            : 0;
        const endHour = this.plugin.settings.sleepSchedule.enabled
            ? this.plugin.settings.sleepSchedule.sleepTime
            : 23;

        // Create row for each hour
        for (let hour = startHour; hour <= endHour; hour++) {
            const hourRow = weeklyGrid.createDiv({ cls: 'weekly-hour-row' });

            // Time label (left column)
            const hourStr = hour.toString().padStart(2, '0');
            hourRow.createDiv({
                cls: 'time-cell',
                text: `${hourStr}:00`
            });

            // Create cell for each day
            days.forEach((_, dayIndex) => {
                const dayCell = hourRow.createDiv({ cls: 'day-cell' });
                dayCell.dataset.day = dayIndex.toString();
                dayCell.dataset.hour = hour.toString();

                // Highlight current day cells
                if (dayIndex === currentDay && isCurrentWeek) {
                    dayCell.addClass('is-today');
                }

                // Render items in this cell
                const items = this.plugin.getItemsForCell(dayIndex, hour);
                this.renderCellItems(dayCell, items);

                // Click to add new item
                dayCell.addEventListener('click', () => {
                    this.openAddItemModal(dayIndex, hour);
                });
            });
        }
    }

    /**
     * Render items within a single cell
     * Each cell can contain multiple stacked items
     */
    private renderCellItems(cell: HTMLElement, items: SchedulerItem[]) {
        cell.empty();

        items.forEach((item: SchedulerItem) => {
            const category = this.itemRenderer.getCategoryById(item.categoryId);
            const itemCard = cell.createDiv({ cls: 'scheduler-item-card' });

            // Apply styling
            const textColor = this.itemRenderer.applyItemStyling(itemCard, item, category);

            // Create content
            if (textColor && category) {
                this.itemRenderer.createItemContent(itemCard, item, textColor);
            } else {
                // Fallback if no category
                itemCard.createDiv({ cls: 'item-name', text: item.name });
                if (item.description) {
                    itemCard.createDiv({ cls: 'item-description', text: item.description });
                }
            }

            // Button container
            const btnContainer = itemCard.createDiv({ cls: 'item-buttons' });

            // Checkbox for tasks
            this.itemRenderer.createCheckboxButton(btnContainer, item, () => {
                this.plugin.updateItem(item.id, { completed: !item.completed });
            });

            // Edit button
            this.itemRenderer.createEditButton(btnContainer, () => {
                this.openEditItemModal(item);
            });

            // Delete button
            this.itemRenderer.createDeleteButton(btnContainer, () => {
                this.plugin.removeItem(item.id);
                this.refreshView();
            });
        });
    }

    /**
     * Open modal to add new item to specific day/hour
     */
    private openAddItemModal(day: number, hour: number) {
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const title = `${days[day]} at ${hour.toString().padStart(2, '0')}:00`;

        const modal = new AddItemModal(
            this.plugin.app,
            this.plugin.settings.categories,
            title,
            (item: Omit<SchedulerItem, 'id'>) => {
                this.plugin.addItemToSchedule(day, hour, item);
                this.refreshView();
            }
        );
        modal.open();
    }

    /**
     * Open modal to edit existing item
     */
    private openEditItemModal(item: SchedulerItem) {
        const modal = new EditItemModal(
            this.plugin.app,
            this.plugin.settings.categories,
            item,
            (updates: Partial<SchedulerItem>) => {
                this.plugin.updateItem(item.id, updates);
            }
        );
        modal.open();
    }
}