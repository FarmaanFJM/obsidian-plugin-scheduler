/**
 * Settings UI for the Scheduler Plugin
 * 
 * Provides configuration interface for:
 * - Color-coded categories for task organization
 * - Sleep schedule (auto-hide hours outside wake/sleep times)
 * - Recurring standard tasks (weekly repeating items)
 * - Quick task management actions
 */

import type SchedulerPlugin from '../main';
import { CategoryConfig, StandardItemConfig } from '../types';
import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import { EditStandardTaskModal } from '../modals/editStandardTaskModal';

/**
 * Main settings tab displayed in Obsidian's settings panel
 */
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

        // ==================== Category Configuration ====================

        containerEl.createEl('h3', { text: 'Categories' });
        containerEl.createEl('p', {
            text: 'Define color categories for your scheduler items.',
            cls: 'setting-item-description'
        });

        // Render each existing category with edit/delete controls
        this.plugin.settings.categories.forEach((category: CategoryConfig, index: number) => {
            this.createCategorySetting(containerEl, category, index);
        });

        // Add new category button
        new Setting(containerEl)
            .setName('Add New Category')
            .setDesc('Create a new color category')
            .addButton(button => button
                .setButtonText('Add Category')
                .setCta()
                .onClick(() => {
                    this.addNewCategory();
                }));

        // ==================== Sleep Schedule Configuration ====================

        containerEl.createEl('h3', { text: 'Sleep Schedule' });
        containerEl.createEl('p', {
            text: 'Configure your sleep schedule to automatically adjust the visible time range.',
            cls: 'setting-item-description'
        });

        // Enable/disable sleep schedule feature
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

        // Sleep time (hour when schedule ends)
        new Setting(containerEl)
            .setName('Sleep Time')
            .setDesc('Time you go to bed (e.g., 22:00)')
            .addDropdown(dropdown => {
                // Populate 24-hour dropdown
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

        // Wake time (hour when schedule starts)
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

        // Day exclusions for wake-up task
        new Setting(containerEl)
            .setName('Skip "Wake Up" on Days')
            .setDesc('Select days where Wake Up task should NOT be added')
            .setClass('sleep-exception-setting');

        const wakeDaysContainer = containerEl.createDiv({ cls: 'sleep-days-selection' });
        const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

        // Create toggleable day buttons for wake-up exceptions
        dayNames.forEach((dayName, index) => {
            const dayBtn = wakeDaysContainer.createEl('button', {
                text: dayName,
                cls: 'sleep-day-toggle-btn'
            });

            // Mark as excluded if in settings
            if (this.plugin.settings.sleepSchedule.excludeWakeDays?.includes(index)) {
                dayBtn.addClass('excluded');
            }

            // Toggle exclusion on click
            dayBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                const excludeDays = this.plugin.settings.sleepSchedule.excludeWakeDays || [];
                const dayIndex = excludeDays.indexOf(index);

                if (dayIndex > -1) {
                    // Remove from exclusions
                    excludeDays.splice(dayIndex, 1);
                    dayBtn.removeClass('excluded');
                } else {
                    // Add to exclusions
                    excludeDays.push(index);
                    dayBtn.addClass('excluded');
                }

                this.plugin.settings.sleepSchedule.excludeWakeDays = excludeDays;
                await this.plugin.saveSettings();
            });
        });

        // Day exclusions for sleep task
        new Setting(containerEl)
            .setName('Skip "Sleep" on Days')
            .setDesc('Select days where Sleep task should NOT be added')
            .setClass('sleep-exception-setting');

        const sleepDaysContainer = containerEl.createDiv({ cls: 'sleep-days-selection' });

        // Create toggleable day buttons for sleep exceptions
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

        // ==================== Recurring Tasks Configuration ====================

        containerEl.createEl('h3', { text: 'Recurring Tasks' });
        containerEl.createEl('p', {
            text: 'Configure tasks that appear automatically on specific days and times.',
            cls: 'setting-item-description'
        });

        // Render each existing recurring task with edit/delete controls
        this.plugin.settings.standardItems.forEach((task: StandardItemConfig, index: number) => {
            this.createStandardTaskSetting(containerEl, task, index);
        });

        // Add new recurring task button
        new Setting(containerEl)
            .setName('Add Recurring Task')
            .setDesc('Create a new task that repeats weekly')
            .addButton(button => button
                .setButtonText('Add Task')
                .setCta()
                .onClick(() => {
                    this.addNewStandardTask();
                }));

        // ==================== Quick Task Management Actions ====================

        containerEl.createEl('h3', { text: 'Task Management' });

        // Populate standard tasks for current week
        new Setting(containerEl)
            .setName('Populate Standard Tasks')
            .setDesc('Add Sleep, Wake-up, and recurring tasks to current week')
            .addButton(button => button
                .setButtonText('Populate Now')
                .onClick(() => {
                    this.plugin.populateStandardTasks();
                }));

        // Clear non-recurring tasks (keeps Sleep, Wake, and recurring)
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

        // Clear ALL tasks including standard ones (destructive)
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

        // Placeholder for future notifications section
        containerEl.createEl('h3', { text: 'Notifications' });
    }

    // ==================== Category Management ====================

    /**
     * Create UI for a single category (name input, color picker, delete button)
     */
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
                    this.display(); // Refresh settings UI
                }));
    }

    /**
     * Add a new category with default values
     */
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

    // ==================== Recurring Task Management ====================

    /**
     * Create UI for a single recurring task
     * Shows task name, schedule summary, and edit/delete buttons
     */
    private createStandardTaskSetting(
        containerEl: HTMLElement,
        task: StandardItemConfig,
        index: number
    ) {
        const setting = new Setting(containerEl)
            .setName(task.name);

        // Build human-readable schedule description
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

        // Edit button - opens modal with day/hour grid
        setting.addButton(button => button
            .setButtonText('Edit')
            .onClick(() => {
                this.editStandardTask(index);
            }));

        // Delete button - removes task from settings
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

    /**
     * Create new recurring task with default schedule (Monday 9am)
     */
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
            async (createdTask: StandardItemConfig) => {
                this.plugin.settings.standardItems.push(createdTask);
                await this.plugin.saveSettings();
                new Notice('Added new recurring task!');
                this.display();
            }
        );
        modal.open();
    }

    /**
     * Edit existing recurring task
     * Updates all instances in scheduler if task properties change
     */
    private editStandardTask(index: number) {
        const task = this.plugin.settings.standardItems[index];
        const oldName = task.name;

        const modal = new EditStandardTaskModal(
            this.app,
            this.plugin,
            task,
            oldName,
            async (updatedTask: StandardItemConfig) => {
                this.plugin.settings.standardItems[index] = updatedTask;
                await this.plugin.saveSettings();

                this.plugin.updateStandardTask(oldName, updatedTask);

                new Notice('Updated recurring task!');
                this.display();
            }

        );
        modal.open();
    }
}