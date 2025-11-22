import type SchedulerPlugin from './main';
import { CategoryConfig, StandardItemConfig, DayHourSchedule } from './types';
import { App, PluginSettingTab, Setting, Notice, Modal, TextComponent, DropdownComponent } from 'obsidian';

export class SchedulerSettingTab extends PluginSettingTab {
    plugin: SchedulerPlugin;

    constructor(app: App, plugin: SchedulerPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Scheduler Settings' });

        // Categories section
        containerEl.createEl('h3', { text: 'Categories' });
        containerEl.createEl('p', {
            text: 'Define color categories for your scheduler items.',
            cls: 'setting-item-description'
        });

        this.plugin.settings.categories.forEach((category, index) => {
            this.createCategorySetting(containerEl, category, index);
        });

        new Setting(containerEl)
            .setName('Add New Category')
            .setDesc('Create a new color category')
            .addButton(button => button
                .setButtonText('Add Category')
                .setCta()
                .onClick(() => {
                    this.addNewCategory();
                }));

        // Sleep Schedule Section
        containerEl.createEl('h3', { text: 'Sleep Schedule' });
        containerEl.createEl('p', {
            text: 'Configure your sleep schedule to automatically adjust the visible time range.',
            cls: 'setting-item-description'
        });

        new Setting(containerEl)
            .setName('Enable Sleep Schedule')
            .setDesc('Automatically shrink schedule to show only wake-to-sleep hours')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.sleepSchedule.enabled)
                .onChange(async (value) => {
                    this.plugin.settings.sleepSchedule.enabled = value;
                    await this.plugin.saveSettings();
                    this.plugin.refreshView();
                }));

        new Setting(containerEl)
            .setName('Sleep Time')
            .setDesc('Time you go to bed (e.g., 22:00)')
            .addDropdown(dropdown => {
                for (let h = 0; h < 24; h++) {
                    const hour = h.toString().padStart(2, '0') + ':00';
                    dropdown.addOption(h.toString(), hour);
                }
                dropdown.setValue(this.plugin.settings.sleepSchedule.sleepTime.toString())
                    .onChange(async (value) => {
                        this.plugin.settings.sleepSchedule.sleepTime = parseInt(value);
                        await this.plugin.saveSettings();
                        this.plugin.refreshView();
                    });
            });

        new Setting(containerEl)
            .setName('Wake Time')
            .setDesc('Time you wake up (e.g., 04:00)')
            .addDropdown(dropdown => {
                for (let h = 0; h < 24; h++) {
                    const hour = h.toString().padStart(2, '0') + ':00';
                    dropdown.addOption(h.toString(), hour);
                }
                dropdown.setValue(this.plugin.settings.sleepSchedule.wakeTime.toString())
                    .onChange(async (value) => {
                        this.plugin.settings.sleepSchedule.wakeTime = parseInt(value);
                        await this.plugin.saveSettings();
                        this.plugin.refreshView();
                    });
            });

        // Wake Up Exception Days
        new Setting(containerEl)
            .setName('Skip "Wake Up" on Days')
            .setDesc('Select days where Wake Up task should NOT be added')
            .setClass('sleep-exception-setting');

        const wakeDaysContainer = containerEl.createDiv({ cls: 'sleep-days-selection' });
        const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

        dayNames.forEach((dayName, index) => {
            const dayBtn = wakeDaysContainer.createEl('button', {
                text: dayName,
                cls: 'sleep-day-toggle-btn'
            });

            if (this.plugin.settings.sleepSchedule.excludeWakeDays?.includes(index)) {
                dayBtn.addClass('excluded');
            }

            dayBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                const excludeDays = this.plugin.settings.sleepSchedule.excludeWakeDays || [];
                const dayIndex = excludeDays.indexOf(index);

                if (dayIndex > -1) {
                    excludeDays.splice(dayIndex, 1);
                    dayBtn.removeClass('excluded');
                } else {
                    excludeDays.push(index);
                    dayBtn.addClass('excluded');
                }

                this.plugin.settings.sleepSchedule.excludeWakeDays = excludeDays;
                await this.plugin.saveSettings();
            });
        });

        // Sleep Exception Days
        new Setting(containerEl)
            .setName('Skip "Sleep" on Days')
            .setDesc('Select days where Sleep task should NOT be added')
            .setClass('sleep-exception-setting');

        const sleepDaysContainer = containerEl.createDiv({ cls: 'sleep-days-selection' });

        dayNames.forEach((dayName, index) => {
            const dayBtn = sleepDaysContainer.createEl('button', {
                text: dayName,
                cls: 'sleep-day-toggle-btn'
            });

            if (this.plugin.settings.sleepSchedule.excludeSleepDays?.includes(index)) {
                dayBtn.addClass('excluded');
            }

            dayBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                const excludeDays = this.plugin.settings.sleepSchedule.excludeSleepDays || [];
                const dayIndex = excludeDays.indexOf(index);

                if (dayIndex > -1) {
                    excludeDays.splice(dayIndex, 1);
                    dayBtn.removeClass('excluded');
                } else {
                    excludeDays.push(index);
                    dayBtn.addClass('excluded');
                }

                this.plugin.settings.sleepSchedule.excludeSleepDays = excludeDays;
                await this.plugin.saveSettings();
            });
        });

        // Recurring Tasks Section
        containerEl.createEl('h3', { text: 'Recurring Tasks' });
        containerEl.createEl('p', {
            text: 'Configure tasks that appear automatically on specific days and times.',
            cls: 'setting-item-description'
        });

        this.plugin.settings.standardItems.forEach((task, index) => {
            this.createStandardTaskSetting(containerEl, task, index);
        });

        new Setting(containerEl)
            .setName('Add Recurring Task')
            .setDesc('Create a new task that repeats weekly')
            .addButton(button => button
                .setButtonText('Add Task')
                .setCta()
                .onClick(() => {
                    this.addNewStandardTask();
                }));

        // Task Management Section
        containerEl.createEl('h3', { text: 'Task Management' });

        new Setting(containerEl)
            .setName('Populate Standard Tasks')
            .setDesc('Add Sleep, Wake-up, and recurring tasks to current week')
            .addButton(button => button
                .setButtonText('Populate Now')
                .onClick(() => {
                    this.plugin.populateStandardTasks();
                }));

        new Setting(containerEl)
            .setName('Clear Non-Standard Tasks')
            .setDesc('Remove all manually added tasks from current week while keeping recurring tasks')
            .addButton(button => button
                .setButtonText('Clear Now')
                .setWarning()
                .onClick(() => {
                    const confirmed = confirm('Clear all non-standard tasks from current week? This cannot be undone.');
                    if (confirmed) {
                        this.plugin.clearNonStandardTasks();
                    }
                }));

        new Setting(containerEl)
            .setName('Clear ALL Tasks')
            .setDesc('Remove ALL tasks from current week including standard/recurring tasks')
            .addButton(button => button
                .setButtonText('Clear Everything')
                .setWarning()
                .onClick(() => {
                    const confirmed = confirm('⚠️ Clear ALL tasks from current week including Sleep, Wake-up, and recurring tasks? This CANNOT be undone!');
                    if (confirmed) {
                        this.plugin.clearAllTasks();
                    }
                }));

        // Notifications Section
        containerEl.createEl('h3', { text: 'Notifications' });

        new Setting(containerEl)
            .setName('Show Hourly Notifications')
            .setDesc('Display a notification at the start of each hour with your scheduled tasks')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showNotifications)
                .onChange(async (value) => {
                    this.plugin.settings.showNotifications = value;
                    await this.plugin.saveSettings();

                    if (value) {
                        this.plugin.startNotificationChecker();
                    }
                }));
    }

    private createCategorySetting(containerEl: HTMLElement, category: CategoryConfig, index: number) {
        const setting = new Setting(containerEl)
            .setName(category.name)
            .addText(text => {
                text.setPlaceholder('Category name')
                    .setValue(category.name)
                    .onChange(async (value) => {
                        this.plugin.settings.categories[index].name = value;
                        await this.plugin.saveSettings();
                        this.plugin.refreshView();
                    });
                text.inputEl.style.width = '150px';
            })
            .addColorPicker(color => {
                color.setValue(category.color)
                    .onChange(async (value) => {
                        this.plugin.settings.categories[index].color = value;
                        await this.plugin.saveSettings();
                        this.plugin.refreshView();
                    });
            })
            .addButton(button => button
                .setButtonText('Delete')
                .setWarning()
                .onClick(async () => {
                    this.plugin.settings.categories.splice(index, 1);
                    await this.plugin.saveSettings();
                    new Notice(`Deleted category: ${category.name}`);
                    this.plugin.refreshView();
                    this.display();
                }));
    }

    private async addNewCategory() {
        const newCategory: CategoryConfig = {
            id: `category-${Date.now()}`,
            name: 'New Category',
            color: '#000000'
        };

        this.plugin.settings.categories.push(newCategory);
        await this.plugin.saveSettings();
        new Notice('Added new category');
        this.display();
    }

    private createStandardTaskSetting(
        containerEl: HTMLElement,
        task: StandardItemConfig,
        index: number
    ) {
        const setting = new Setting(containerEl)
            .setName(task.name);

        // Build description from schedule
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        let scheduleDesc = '';

        for (const dayStr in task.schedule) {
            const day = parseInt(dayStr);
            const hours = task.schedule[day];
            if (hours.length > 0) {
                const hoursList = hours.map(h => h.toString().padStart(2, '0') + ':00').join(', ');
                scheduleDesc += `${days[day]}: ${hoursList}; `;
            }
        }

        setting.setDesc(scheduleDesc || 'No schedule set');

        setting.addButton(button => button
            .setButtonText('Edit')
            .onClick(() => {
                this.editStandardTask(index);
            }));

        setting.addButton(button => button
            .setButtonText('Delete')
            .setWarning()
            .onClick(async () => {
                this.plugin.settings.standardItems.splice(index, 1);
                await this.plugin.saveSettings();
                new Notice(`Deleted recurring task: ${task.name}`);
                this.display();
            }));
    }

    private async addNewStandardTask() {
        const newTask: StandardItemConfig = {
            name: 'New Task',
            description: '',
            categoryId: this.plugin.settings.categories[0]?.id || 'other',
            schedule: {
                0: [9], // Monday 09:00 by default
            }
        };

        const modal = new EditStandardTaskModal(
            this.app,
            this.plugin,
            newTask,
            null,
            async (createdTask) => {
                this.plugin.settings.standardItems.push(createdTask);
                await this.plugin.saveSettings();
                new Notice('Added new recurring task!');
                this.display();
            }
        );
        modal.open();
    }

    private editStandardTask(index: number) {
        const task = this.plugin.settings.standardItems[index];
        const oldName = task.name;

        const modal = new EditStandardTaskModal(
            this.app,
            this.plugin,
            task,
            oldName,
            async (updatedTask) => {
                this.plugin.settings.standardItems[index] = updatedTask;
                await this.plugin.saveSettings();

                // Update all instances in the scheduler
                this.plugin.updateStandardTask(oldName, updatedTask);

                new Notice('Updated recurring task!');
                this.display();
            }
        );
        modal.open();
    }
}

// Edit Standard Task Modal with Day×Hour Grid
class EditStandardTaskModal extends Modal {
    task: StandardItemConfig;
    plugin: SchedulerPlugin;
    oldTaskName: string | null;
    onSubmit: (task: StandardItemConfig) => void;

    private nameInput: TextComponent;
    private descInput: HTMLTextAreaElement;
    private categoryDropdown: DropdownComponent;
    private selectedSchedule: DayHourSchedule;

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

        // Deep clone schedule
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

        // Name
        new Setting(contentEl)
            .setName('Task Name')
            .addText(text => {
                this.nameInput = text;
                text.setPlaceholder('e.g., Gym, School')
                    .setValue(this.task.name);
            });

        // Description
        const descSetting = new Setting(contentEl)
            .setName('Description');
        const descContainer = descSetting.controlEl.createDiv();
        this.descInput = descContainer.createEl('textarea');
        this.descInput.placeholder = 'Optional details';
        this.descInput.value = this.task.description;
        this.descInput.rows = 3;
        this.descInput.style.width = '100%';

        // Category
        new Setting(contentEl)
            .setName('Category')
            .addDropdown(dropdown => {
                this.categoryDropdown = dropdown;
                this.plugin.settings.categories.forEach(cat => {
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

        // Day×Hour Grid
        this.renderScheduleGrid(contentEl);

        // Buttons
        const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });

        const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
        cancelBtn.addEventListener('click', () => this.close());

        const saveBtn = buttonContainer.createEl('button', {
            text: 'Save',
            cls: 'mod-cta'
        });
        saveBtn.addEventListener('click', () => this.handleSave());
    }

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

        // Hour rows (00:00 - 23:00)
        for (let hour = 0; hour < 24; hour++) {
            const hourRow = grid.createDiv({ cls: 'schedule-grid-row' });

            // Time label
            const timeLabel = hourRow.createDiv({
                cls: 'schedule-time-label',
                text: hour.toString().padStart(2, '0') + ':00'
            });

            // Day cells
            for (let day = 0; day < 7; day++) {
                const cell = hourRow.createDiv({ cls: 'schedule-grid-cell' });
                cell.dataset.day = day.toString();
                cell.dataset.hour = hour.toString();

                // Check if this slot is selected
                if (this.selectedSchedule[day]?.includes(hour)) {
                    cell.addClass('selected');
                }

                // Click to toggle
                cell.addEventListener('click', () => {
                    this.toggleScheduleSlot(day, hour, cell);
                });
            }
        }

        // Quick select buttons
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

    toggleScheduleSlot(day: number, hour: number, cell: HTMLElement) {
        if (!this.selectedSchedule[day]) {
            this.selectedSchedule[day] = [];
        }

        const index = this.selectedSchedule[day].indexOf(hour);
        if (index > -1) {
            // Remove
            this.selectedSchedule[day].splice(index, 1);
            cell.removeClass('selected');
        } else {
            // Add
            this.selectedSchedule[day].push(hour);
            this.selectedSchedule[day].sort((a, b) => a - b);
            cell.addClass('selected');
        }
    }

    selectAll() {
        for (let day = 0; day < 7; day++) {
            this.selectedSchedule[day] = [];
            for (let hour = 0; hour < 24; hour++) {
                this.selectedSchedule[day].push(hour);
            }
        }
    }

    clearAll() {
        this.selectedSchedule = {};
    }

    selectWeekdaysWorkHours() {
        this.clearAll();
        for (let day = 0; day < 5; day++) { // Mon-Fri
            this.selectedSchedule[day] = [];
            for (let hour = 9; hour <= 17; hour++) {
                this.selectedSchedule[day].push(hour);
            }
        }
    }

    rerenderGrid(container: HTMLElement) {
        const gridContainer = container.querySelector('.schedule-grid-container');
        if (gridContainer) {
            gridContainer.remove();
        }
        this.renderScheduleGrid(container);
    }

    handleSave() {
        const name = this.nameInput.getValue().trim();
        if (!name) {
            new Notice('Task name is required!');
            return;
        }

        // Check if at least one slot is selected
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