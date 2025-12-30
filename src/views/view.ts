/**
 * Main Scheduler View
 * 
 * RESPONSIBILITY:
 * Orchestrates the entire scheduler interface by coordinating specialized renderers.
 * Manages view lifecycle (open, close, refresh) and time indicator updates.
 * 
 * ARCHITECTURE:
 * This view acts as a coordinator, delegating rendering responsibilities to:
 * - WeeklyRenderer: 7-day Ã— hour grid with navigation
 * - MonthlyRenderer: 12-month grid with tasks grouped by type
 * - GoalsRenderer: General goals organized by category
 * - BacklogRenderer: Collapsible to-do sidebar
 * - ItemRenderer: Shared utilities for item styling and buttons
 * 
 * FEATURES:
 * - Data loading on view open
 * - Time indicator updates (highlights current hour)
 * - View refresh coordination
 * - Interval cleanup on close
 * 
 * LAYOUT STRUCTURE:
 * - Main content area (left): Weekly â†’ Monthly â†’ Goals
 * - Fixed sidebar (right): Backlog
 */

import { ItemView, WorkspaceLeaf } from 'obsidian';
import SchedulerPlugin from '../main';
import { DateUtils } from '../utils/dateUtils';
import { WeeklyRenderer } from './weeklyRenderer';
import { MonthlyRenderer } from './monthlyRenderer';
import { GoalsRenderer } from './goalsRenderer';
import { BacklogRenderer } from './backlogRenderer';

export const VIEW_TYPE_SCHEDULER = 'scheduler-view';

export class SchedulerView extends ItemView {
    plugin: SchedulerPlugin;
    private timeUpdateInterval: number | null = null;

    // Renderer instances
    private weeklyRenderer: WeeklyRenderer;
    private monthlyRenderer: MonthlyRenderer;
    private goalsRenderer: GoalsRenderer;
    private backlogRenderer: BacklogRenderer;

    constructor(leaf: WorkspaceLeaf, plugin: SchedulerPlugin) {
        super(leaf);
        this.plugin = plugin;

        // Initialize renderers with refresh callback
        const refreshCallback = () => this.refresh();
        this.weeklyRenderer = new WeeklyRenderer(plugin, refreshCallback);
        this.monthlyRenderer = new MonthlyRenderer(plugin, refreshCallback);
        this.goalsRenderer = new GoalsRenderer(plugin, refreshCallback);
        this.backlogRenderer = new BacklogRenderer(plugin, refreshCallback);
    }

    // ==================== View Lifecycle ====================

    getViewType(): string {
        return VIEW_TYPE_SCHEDULER;
    }

    getDisplayText(): string {
        return 'Scheduler';
    }

    getIcon(): string {
        return 'calendar';
    }

    /**
     * Called when view is opened
     * Forces data reload and renders all sections
     */
    async onOpen() {
        // Force reload every time view opens
        this.plugin.dataLoaded = false;
        await this.plugin.ensureDataLoaded();

        const container = this.containerEl.children[1];
        container.empty();
        container.addClass('scheduler-container');
        this.renderScheduler(container);
        this.startTimeUpdates();
    }

    /**
     * Called when view is closed
     * Cleans up time update interval
     */
    async onClose() {
        if (this.timeUpdateInterval !== null) {
            window.clearInterval(this.timeUpdateInterval);
        }
    }

    // ==================== Main Rendering ====================

    /**
     * Render all scheduler sections using specialized renderers
     */
    renderScheduler(container: Element) {
        const mainDiv = container.createDiv({ cls: 'scheduler-main' });

        // Weekly Schedule Section
        const weeklySection = mainDiv.createDiv({ cls: 'scheduler-weekly-section' });
        this.weeklyRenderer.renderWeeklyHeader(weeklySection);
        this.weeklyRenderer.renderWeeklyScheduler(weeklySection);

        // Monthly Tasks Section
        const monthlySection = mainDiv.createDiv({ cls: 'scheduler-monthly-section' });
        this.monthlyRenderer.renderMonthlyHeader(monthlySection);
        this.monthlyRenderer.renderMonthlyTasks(monthlySection);

        // General Goals Section
        const goalsSection = mainDiv.createDiv({ cls: 'scheduler-goals-section' });
        this.goalsRenderer.renderGoalsHeader(goalsSection);
        this.goalsRenderer.renderGeneralGoals(goalsSection);

        // Backlog Section (Fixed sidebar on right)
        const backlogSection = container.createDiv({ cls: 'scheduler-backlog-section' });
        this.backlogRenderer.renderBacklog(backlogSection);
    }

    /**
     * Refresh the entire view
     * Called after data changes (add/edit/delete/reorder items)
     */
    refresh() {
        const container = this.containerEl.children[1];
        container.empty();
        this.renderScheduler(container);
        this.updateTimeIndicator();
    }

    // ==================== Time Indicator System ====================

    /**
     * Start time indicator updates (every minute)
     * Highlights current hour in weekly grid
     */
    startTimeUpdates() {
        if (this.timeUpdateInterval !== null) {
            window.clearInterval(this.timeUpdateInterval);
        }

        this.updateTimeIndicator();

        this.timeUpdateInterval = window.setInterval(() => {
            this.updateTimeIndicator();
        }, 60000); // Update every minute

        this.registerInterval(this.timeUpdateInterval);
    }

    /**
     * Update time indicator highlighting
     * Highlights current hour cell and time label only for current day
     */
    updateTimeIndicator() {
        // Remove old highlights
        const oldHighlights = this.containerEl.querySelectorAll('.current-hour-cell');
        oldHighlights.forEach(el => el.classList.remove('current-hour-cell'));

        const oldTimeLabels = this.containerEl.querySelectorAll('.current-hour-label');
        oldTimeLabels.forEach(el => el.classList.remove('current-hour-label'));

        const now = new Date();
        const currentHour = now.getHours();
        const currentDay = (now.getDay() + 6) % 7; // Convert Sunday=0 to Monday=0

        // Check if current hour is within visible range (respects sleep schedule)
        const startHour = this.plugin.settings.sleepSchedule.enabled
            ? this.plugin.settings.sleepSchedule.wakeTime
            : 0;
        const endHour = this.plugin.settings.sleepSchedule.enabled
            ? this.plugin.settings.sleepSchedule.sleepTime
            : 23;

        if (currentHour < startHour || currentHour > endHour) return;

        // Only highlight if viewing current week
        const { weekNumber, year } = DateUtils.getCurrentWeekInfo();
        const isCurrentWeek = (
            this.plugin.currentWeek === weekNumber &&
            this.plugin.currentYear === year
        );

        if (!isCurrentWeek) return;

        // Highlight current hour cell for current day only
        const allCells = this.containerEl.querySelectorAll('.day-cell');
        allCells.forEach((cell: Element) => {
            const htmlCell = cell as HTMLElement;
            const cellHour = parseInt(htmlCell.dataset.hour || '-1');
            const cellDay = parseInt(htmlCell.dataset.day || '-1');

            // Only highlight if it's the current hour AND current day
            if (cellHour === currentHour && cellDay === currentDay) {
                cell.classList.add('current-hour-cell');
            }
        });

        // Highlight the time label for current hour
        const timeCells = this.containerEl.querySelectorAll('.time-cell');
        const rowIndex = currentHour - startHour;
        if (rowIndex >= 0 && rowIndex < timeCells.length) {
            timeCells[rowIndex].classList.add('current-hour-label');
            timeCells[rowIndex].classList.add('current-hour-cell');
        }
    }
}