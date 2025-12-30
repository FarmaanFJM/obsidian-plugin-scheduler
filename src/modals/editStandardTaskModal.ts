/**
 * Modal for creating and editing recurring (standard) tasks
 * 
 * RESPONSIBILITY:
 * Configure task templates that automatically populate into weekly schedules.
 * These are "standard" tasks that repeat on the same days/times each week.
 * 
 * USED BY:
 * - Settings Tab (SchedulerSettingTab)
 *   → When user clicks "Add Recurring Task" or "Edit" on existing recurring task
 * 
 * FEATURES:
 * - Visual 7-day × 24-hour grid selector (168 clickable cells)
 * - Click to toggle individual time slots on/off
 * - Quick selection presets: "All", "Clear", "Weekdays 9-17"
 * - Task name, description, and category configuration
 * 
 * EXAMPLES:
 * - "Gym" appears every Mon/Wed/Fri at 6:00 AM
 * - "Team Meeting" appears every Tuesday at 10:00 AM
 * - "Sleep" appears every day at 22:00 (10 PM)
 * 
 */
import type SchedulerPlugin from '../main';
import { StandardItemConfig, DayHourSchedule, CategoryConfig } from '../types';
import { App, Modal, Setting, Notice, TextComponent, DropdownComponent } from 'obsidian';

export class EditStandardTaskModal extends Modal {
    task: StandardItemConfig;
    plugin: SchedulerPlugin;
    oldTaskName: string | null;
    onSubmit: (task: StandardItemConfig) => void;

    private nameInput: TextComponent;
    private descInput: HTMLTextAreaElement;
    private categoryDropdown: DropdownComponent;
    private selectedSchedule: DayHourSchedule;

    /**
     * @param app - Obsidian app instance
     * @param plugin - Scheduler plugin instance
     * @param task - Task configuration to edit
     * @param oldTaskName - Original task name (null if creating new task)
     * @param onSubmit - Callback fired when user saves changes
     */
    constructor(
        app: App,
        plugin: SchedulerPlugin,
        task: StandardItemConfig,
        oldTaskName: string | null,
        onSubmit: (task: StandardItemConfig) => void
    ) {
        super(app);
        this.plugin = plugin;
        this.task = { ...task };
        this.oldTaskName = oldTaskName;
        this.onSubmit = onSubmit;

        // Deep clone schedule to avoid mutating original
        this.selectedSchedule = {};
        for (const day in task.schedule) {
            this.selectedSchedule[parseInt(day)] = [...task.schedule[day]];
        }
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('edit-standard-task-modal');
        contentEl.createEl('h2', { text: this.oldTaskName ? 'Edit Recurring Task' : 'Add Recurring Task' });

        // Task name input
        new Setting(contentEl)
            .setName('Task Name')
            .addText(text => {
                this.nameInput = text;
                text.setPlaceholder('e.g., Gym, School')
                    .setValue(this.task.name);
            });

        // Optional description
        const descSetting = new Setting(contentEl)
            .setName('Description');
        const descContainer = descSetting.controlEl.createDiv();
        this.descInput = descContainer.createEl('textarea');
        this.descInput.placeholder = 'Optional details';
        this.descInput.value = this.task.description;
        this.descInput.rows = 3;
        this.descInput.style.width = '100%';

        // Category dropdown
        new Setting(contentEl)
            .setName('Category')
            .addDropdown(dropdown => {
                this.categoryDropdown = dropdown;
                this.plugin.settings.categories.forEach((cat: CategoryConfig) => {
                    dropdown.addOption(cat.id, cat.name);
                });
                dropdown.setValue(this.task.categoryId);
            });

        // Schedule Grid Header
        contentEl.createEl('h3', { text: 'Schedule (Click to toggle time slots)' });
        contentEl.createEl('p', {
            text: 'Select which hours this task appears on each day',
            cls: 'schedule-grid-subtitle'
        });

        // Render the day×hour selection grid
        this.renderScheduleGrid(contentEl);

        // Modal action buttons
        const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });

        const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
        cancelBtn.addEventListener('click', () => this.close());

        const saveBtn = buttonContainer.createEl('button', {
            text: 'Save',
            cls: 'mod-cta'
        });
        saveBtn.addEventListener('click', () => this.handleSave());
    }

    /**
     * Render 7-day × 24-hour grid with toggleable cells
     * Creates interactive grid where clicking cells toggles time slot selection
     */
    renderScheduleGrid(container: HTMLElement) {
        const gridContainer = container.createDiv({ cls: 'schedule-grid-container' });
        const grid = gridContainer.createDiv({ cls: 'schedule-grid' });

        const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

        // Header row with day names
        const headerRow = grid.createDiv({ cls: 'schedule-grid-header' });
        headerRow.createDiv({ cls: 'schedule-time-label', text: 'Time' });
        dayNames.forEach(day => {
            headerRow.createDiv({ cls: 'schedule-day-header', text: day });
        });

        // Create row for each hour (00:00 - 23:00)
        for (let hour = 0; hour < 24; hour++) {
            const hourRow = grid.createDiv({ cls: 'schedule-grid-row' });

            // Time label (left column)
            const timeLabel = hourRow.createDiv({
                cls: 'schedule-time-label',
                text: hour.toString().padStart(2, '0') + ':00'
            });

            // Create cell for each day
            for (let day = 0; day < 7; day++) {
                const cell = hourRow.createDiv({ cls: 'schedule-grid-cell' });
                cell.dataset.day = day.toString();
                cell.dataset.hour = hour.toString();

                // Mark cell as selected if in current schedule
                if (this.selectedSchedule[day]?.includes(hour)) {
                    cell.addClass('selected');
                }

                // Toggle selection on click
                cell.addEventListener('click', () => {
                    this.toggleScheduleSlot(day, hour, cell);
                });
            }
        }

        // Quick selection helper buttons
        const quickSelect = gridContainer.createDiv({ cls: 'quick-select-buttons' });

        const selectAllBtn = quickSelect.createEl('button', { text: 'Select All' });
        selectAllBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.selectAll();
            this.rerenderGrid(container);
        });

        const clearAllBtn = quickSelect.createEl('button', { text: 'Clear All' });
        clearAllBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.clearAll();
            this.rerenderGrid(container);
        });

        const selectWeekdaysBtn = quickSelect.createEl('button', { text: 'Weekdays 9-17' });
        selectWeekdaysBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.selectWeekdaysWorkHours();
            this.rerenderGrid(container);
        });
    }

    /**
     * Toggle a single time slot on/off
     * Maintains sorted hour array for each day
     */
    toggleScheduleSlot(day: number, hour: number, cell: HTMLElement) {
        if (!this.selectedSchedule[day]) {
            this.selectedSchedule[day] = [];
        }

        const index = this.selectedSchedule[day].indexOf(hour);
        if (index > -1) {
            // Remove hour from this day
            this.selectedSchedule[day].splice(index, 1);
            cell.removeClass('selected');
        } else {
            // Add hour to this day (keep sorted)
            this.selectedSchedule[day].push(hour);
            this.selectedSchedule[day].sort((a, b) => a - b);
            cell.addClass('selected');
        }
    }

    /**
     * Select all 168 time slots (7 days × 24 hours)
     */
    selectAll() {
        for (let day = 0; day < 7; day++) {
            this.selectedSchedule[day] = [];
            for (let hour = 0; hour < 24; hour++) {
                this.selectedSchedule[day].push(hour);
            }
        }
    }

    /**
     * Clear all selected time slots
     */
    clearAll() {
        this.selectedSchedule = {};
    }

    /**
     * Select Monday-Friday 9:00-17:00 (standard work hours)
     * Common preset for office/school schedules
     */
    selectWeekdaysWorkHours() {
        this.clearAll();
        for (let day = 0; day < 5; day++) { // Mon-Fri
            this.selectedSchedule[day] = [];
            for (let hour = 9; hour <= 17; hour++) {
                this.selectedSchedule[day].push(hour);
            }
        }
    }

    /**
     * Refresh grid display after batch selection changes
     * Used by quick select buttons to update UI
     */
    rerenderGrid(container: HTMLElement) {
        const gridContainer = container.querySelector('.schedule-grid-container');
        if (gridContainer) {
            gridContainer.remove();
        }
        this.renderScheduleGrid(container);
    }

    /**
     * Validate and save recurring task configuration
     * Ensures task has name and at least one time slot selected
     */
    handleSave() {
        const name = this.nameInput.getValue().trim();
        if (!name) {
            new Notice('Task name is required!');
            return;
        }

        // Ensure at least one time slot is selected
        let hasSlots = false;
        for (const day in this.selectedSchedule) {
            if (this.selectedSchedule[day].length > 0) {
                hasSlots = true;
                break;
            }
        }

        if (!hasSlots) {
            new Notice('Please select at least one time slot!');
            return;
        }

        const updatedTask: StandardItemConfig = {
            name: name,
            description: this.descInput.value.trim(),
            categoryId: this.categoryDropdown.getValue(),
            schedule: this.selectedSchedule
        };

        this.onSubmit(updatedTask);
        this.close();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}