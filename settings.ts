import type SchedulerPlugin from './main';
import { CategoryConfig, StandardItemConfig } from './types';
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

        // Display existing categories
        this.plugin.settings.categories.forEach((category, index) => {
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

        // Standard/Recurring Tasks Section
        containerEl.createEl('h3', { text: 'Recurring Tasks' });
        containerEl.createEl('p', {
            text: 'Configure tasks that appear automatically on specific days and times.',
            cls: 'setting-item-description'
        });

        // Display existing standard tasks
        this.plugin.settings.standardItems.forEach((task, index) => {
            this.createStandardTaskSetting(containerEl, task, index);
        });

        // Add new standard task button
        new Setting(containerEl)
            .setName('Add Recurring Task')
            .setDesc('Create a new task that repeats weekly')
            .addButton(button => button
                .setButtonText('Add Task')
                .setCta()
                .onClick(() => {
                    this.addNewStandardTask();
                }));

        // Commands info
        containerEl.createEl('h3', { text: 'Task Management' });

        new Setting(containerEl)
            .setName('Populate Standard Tasks')
            .setDesc('Add Sleep, Wake-up, and recurring tasks to your schedule')
            .addButton(button => button
                .setButtonText('Populate Now')
                .onClick(() => {
                    this.plugin.populateStandardTasks();
                }));

        new Setting(containerEl)
            .setName('Clear Non-Standard Tasks')
            .setDesc('Remove all manually added tasks while keeping recurring tasks')
            .addButton(button => button
                .setButtonText('Clear Now')
                .setWarning()
                .onClick(() => {
                    const confirmed = confirm('Clear all non-standard tasks? This cannot be undone.');
                    if (confirmed) {
                        this.plugin.clearNonStandardTasks();
                    }
                }));

        new Setting(containerEl)
            .setName('Clear ALL Tasks')
            .setDesc('Remove ALL tasks including standard/recurring tasks - complete reset')
            .addButton(button => button
                .setButtonText('Clear Everything')
                .setWarning()
                .onClick(() => {
                    const confirmed = confirm('⚠️ Clear ALL tasks including Sleep, Wake-up, and recurring tasks? This CANNOT be undone!');
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

        // Task details
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const taskDays = task.days.length > 0
            ? task.days.map(d => days[d]).join(', ')
            : 'Every day';
        const taskTimes = task.hours.map(h =>
            h.toString().padStart(2, '0') + ':00'
        ).join(', ');

        setting.setDesc(`Days: ${taskDays} | Times: ${taskTimes}`);

        // Edit button
        setting.addButton(button => button
            .setButtonText('Edit')
            .onClick(() => {
                this.editStandardTask(index);
            }));

        // Delete button
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
            days: [0, 1, 2, 3, 4], // Mon-Fri by default
            hours: [9] // 09:00 by default
        };

        const modal = new EditStandardTaskModal(
            this.app,
            this.plugin,
            newTask,
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
        const modal = new EditStandardTaskModal(
            this.app,
            this.plugin,
            task,
            async (updatedTask) => {
                this.plugin.settings.standardItems[index] = updatedTask;
                await this.plugin.saveSettings();
                new Notice('Updated recurring task!');
                this.display();
            }
        );
        modal.open();
    }
}

// Edit Standard Task Modal Class
class EditStandardTaskModal extends Modal {
    task: StandardItemConfig;
    plugin: SchedulerPlugin;
    onSubmit: (task: StandardItemConfig) => void;

    private nameInput: TextComponent;
    private descInput: HTMLTextAreaElement;
    private categoryDropdown: DropdownComponent;
    private selectedDays: Set<number>;
    private selectedHours: Set<number>;

    constructor(
        app: App,
        plugin: SchedulerPlugin,
        task: StandardItemConfig,
        onSubmit: (task: StandardItemConfig) => void
    ) {
        super(app);
        this.plugin = plugin;
        this.task = { ...task }; // Clone
        this.onSubmit = onSubmit;
        this.selectedDays = new Set(task.days);
        this.selectedHours = new Set(task.hours);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: 'Edit Recurring Task' });

        // Name
        new Setting(contentEl)
            .setName('Task Name')
            .addText(text => {
                this.nameInput = text;
                text.setPlaceholder('e.g., Gym')
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

        // Days selection
        contentEl.createEl('h3', { text: 'Days' });
        const daysContainer = contentEl.createDiv({ cls: 'days-selection' });
        const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

        dayNames.forEach((dayName, index) => {
            const dayBtn = daysContainer.createEl('button', {
                text: dayName.substring(0, 3),
                cls: 'day-toggle-btn'
            });

            if (this.selectedDays.has(index)) {
                dayBtn.addClass('active');
            }

            dayBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (this.selectedDays.has(index)) {
                    this.selectedDays.delete(index);
                    dayBtn.removeClass('active');
                } else {
                    this.selectedDays.add(index);
                    dayBtn.addClass('active');
                }
            });
        });

        // Hours selection
        contentEl.createEl('h3', { text: 'Times' });
        const hoursContainer = contentEl.createDiv({ cls: 'hours-selection' });

        for (let h = 0; h < 24; h++) {
            const hourBtn = hoursContainer.createEl('button', {
                text: h.toString().padStart(2, '0') + ':00',
                cls: 'hour-toggle-btn'
            });

            if (this.selectedHours.has(h)) {
                hourBtn.addClass('active');
            }

            hourBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (this.selectedHours.has(h)) {
                    this.selectedHours.delete(h);
                    hourBtn.removeClass('active');
                } else {
                    this.selectedHours.add(h);
                    hourBtn.addClass('active');
                }
            });
        }

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

    handleSave() {
        const name = this.nameInput.getValue().trim();
        if (!name) {
            new Notice('Task name is required!');
            return;
        }

        if (this.selectedDays.size === 0) {
            new Notice('Please select at least one day!');
            return;
        }

        if (this.selectedHours.size === 0) {
            new Notice('Please select at least one time!');
            return;
        }

        const updatedTask: StandardItemConfig = {
            name: name,
            description: this.descInput.value.trim(),
            categoryId: this.categoryDropdown.getValue(),
            days: Array.from(this.selectedDays).sort((a, b) => a - b),
            hours: Array.from(this.selectedHours).sort((a, b) => a - b)
        };

        this.onSubmit(updatedTask);
        this.close();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}