import { App, Modal, Setting } from 'obsidian';
import { SchedulerItem, CategoryConfig, ItemType } from './types';

export class AddItemModal extends Modal {
    private name: string = '';
    private description: string = '';
    private selectedCategoryId: string = '';
    private selectedItemType: ItemType = 'regular';

    private categories: CategoryConfig[];
    private onSubmit: (item: Omit<SchedulerItem, 'id'>) => void;
    private title: string;

    // Monthly + deadline helpers
    private isMonthlyContext: boolean;
    private monthIndex?: number;
    private year?: number;
    private deadlineDay: number | null = null;
    private deadlineHour: number | null = null;
    private deadlineDaySettingEl?: HTMLElement;
    private deadlineHourSettingEl?: HTMLElement;

    constructor(
        app: App,
        categories: CategoryConfig[],
        title: string,
        onSubmit: (item: Omit<SchedulerItem, 'id'>) => void,
        options?: { monthIndex?: number; year?: number }
    ) {
        super(app);
        this.categories = categories;
        this.title = title;
        this.onSubmit = onSubmit;

        // Set default category
        if (categories.length > 0) {
            this.selectedCategoryId = categories[0].id;
        }

        // Monthly context if month + year passed in
        this.isMonthlyContext =
            options?.monthIndex !== undefined && options?.year !== undefined;
        this.monthIndex = options?.monthIndex;
        this.year = options?.year;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('scheduler-modal');

        contentEl.createEl('h2', { text: 'Add Item' });
        contentEl.createEl('p', {
            text: this.title,
            cls: 'scheduler-modal-subtitle',
        });

        // Name input
        new Setting(contentEl)
            .setName('Name')
            .setDesc('Item name (required)')
            .addText(text =>
                text
                    .setPlaceholder('e.g., Gym, Study, Meeting')
                    .setValue(this.name)
                    .onChange(value => {
                        this.name = value;
                    }),
            );

        // Description input
        new Setting(contentEl)
            .setName('Description')
            .setDesc('Optional details')
            .addTextArea(text => {
                text.setPlaceholder('Additional information')
                    .setValue(this.description)
                    .onChange(value => {
                        this.description = value;
                    });
                text.inputEl.rows = 3;
                text.inputEl.style.width = '100%';
            });

        // Item Type dropdown
        new Setting(contentEl)
            .setName('Type')
            .setDesc('Item type affects visual appearance')
            .addDropdown(dropdown => {
                dropdown.addOption('regular', 'Regular');
                dropdown.addOption('task', 'Task (with checkbox)');
                dropdown.addOption('goal', 'Goal');
                dropdown.addOption('deadline', 'Deadline (urgent)');
                dropdown
                    .setValue(this.selectedItemType)
                    .onChange(value => {
                        this.selectedItemType = value as ItemType;
                        this.updateDeadlineFieldsVisibility();
                    });
            });

        // Category dropdown
        new Setting(contentEl)
            .setName('Category')
            .setDesc('Select a category')
            .addDropdown(dropdown => {
                this.categories.forEach(cat => {
                    dropdown.addOption(cat.id, cat.name);
                });
                dropdown
                    .setValue(this.selectedCategoryId)
                    .onChange(value => {
                        this.selectedCategoryId = value;
                    });
            });

        // --- Monthly deadline fields (day + hour) ---
        if (this.isMonthlyContext) {
            // Default values
            if (this.deadlineDay === null) {
                this.deadlineDay = 1;
            }
            if (this.deadlineHour === null) {
                this.deadlineHour = 9;
            }

            // Day of month
            const daySetting = new Setting(contentEl)
                .setName('Deadline day')
                .setDesc('Day in this month (used for deadline items)')
                .addDropdown(dropdown => {
                    const year = this.year!;
                    const month = this.monthIndex!;
                    const daysInMonth = new Date(year, month + 1, 0).getDate();

                    for (let d = 1; d <= daysInMonth; d++) {
                        dropdown.addOption(d.toString(), d.toString());
                    }

                    dropdown
                        .setValue((this.deadlineDay ?? 1).toString())
                        .onChange(value => {
                            this.deadlineDay = parseInt(value, 10);
                        });
                });
            this.deadlineDaySettingEl = daySetting.settingEl;

            // Hour of day
            const hourSetting = new Setting(contentEl)
                .setName('Deadline hour')
                .setDesc('Hour of the day (0–23)')
                .addDropdown(dropdown => {
                    for (let h = 0; h < 24; h++) {
                        const label = h.toString().padStart(2, '0') + ':00';
                        dropdown.addOption(h.toString(), label);
                    }

                    dropdown
                        .setValue((this.deadlineHour ?? 9).toString())
                        .onChange(value => {
                            this.deadlineHour = parseInt(value, 10);
                        });
                });
            this.deadlineHourSettingEl = hourSetting.settingEl;
        }

        // Initial visibility of deadline controls
        this.updateDeadlineFieldsVisibility();

        // Buttons
        const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });

        const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
        cancelBtn.addEventListener('click', () => {
            this.close();
        });

        const addBtn = buttonContainer.createEl('button', {
            text: 'Add Item',
            cls: 'mod-cta',
        });
        addBtn.addEventListener('click', () => {
            this.handleSubmit();
        });
    }

    private updateDeadlineFieldsVisibility() {
        const show =
            this.isMonthlyContext && this.selectedItemType === 'deadline';
        const display = show ? '' : 'none';

        if (this.deadlineDaySettingEl) {
            this.deadlineDaySettingEl.style.display = display;
        }
        if (this.deadlineHourSettingEl) {
            this.deadlineHourSettingEl.style.display = display;
        }
    }

    private handleSubmit() {
        if (!this.name.trim()) {
            return;
        }

        const item: Omit<SchedulerItem, 'id'> = {
            name: this.name.trim(),
            description: this.description.trim(),
            categoryId: this.selectedCategoryId,
            itemType: this.selectedItemType,
            completed: false,
        };

        // If this is a monthly deadline → attach deadlineDate + deadlineHour
        if (
            this.selectedItemType === 'deadline' &&
            this.isMonthlyContext &&
            this.year !== undefined &&
            this.monthIndex !== undefined &&
            this.deadlineDay !== null &&
            this.deadlineHour !== null
        ) {
            const date = new Date(this.year, this.monthIndex, this.deadlineDay);
            const iso =
                date.getFullYear() +
                '-' +
                String(date.getMonth() + 1).padStart(2, '0') +
                '-' +
                String(date.getDate()).padStart(2, '0');

            (item as any).deadlineDate = iso;
            (item as any).deadlineHour = this.deadlineHour;
        }

        this.onSubmit(item);
        this.close();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
