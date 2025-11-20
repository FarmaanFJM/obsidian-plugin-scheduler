import { App, Modal, Setting, Notice } from 'obsidian';
import { SchedulerItem, CategoryConfig } from './types';

export class EditItemModal extends Modal {
    private item: SchedulerItem;
    private name: string;
    private description: string;
    private selectedCategoryId: string;
    private categories: CategoryConfig[];
    private onSubmit: (updates: Partial<SchedulerItem>) => void;

    constructor(
        app: App,
        categories: CategoryConfig[],
        item: SchedulerItem,
        onSubmit: (updates: Partial<SchedulerItem>) => void
    ) {
        super(app);
        this.item = item;
        this.categories = categories;
        this.onSubmit = onSubmit;
        
        // Initialize with current values
        this.name = item.name;
        this.description = item.description;
        this.selectedCategoryId = item.categoryId;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('scheduler-modal');

        contentEl.createEl('h2', { text: 'Edit Item' });
        
        // Show if standard task
        if (this.item.isStandard) {
            const warning = contentEl.createDiv({ cls: 'standard-task-warning' });
            warning.createEl('p', { 
                text: '⚠️ This is a standard/recurring task. Changes here only affect this instance.',
            });
        }

        // Name input
        new Setting(contentEl)
            .setName('Name')
            .setDesc('Item name (required)')
            .addText(text => text
                .setPlaceholder('e.g., Gym, Study, Meeting')
                .setValue(this.name)
                .onChange(value => {
                    this.name = value;
                }));

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

        // Category dropdown
        new Setting(contentEl)
            .setName('Category')
            .setDesc('Select a category')
            .addDropdown(dropdown => {
                this.categories.forEach(cat => {
                    dropdown.addOption(cat.id, cat.name);
                });
                dropdown.setValue(this.selectedCategoryId)
                    .onChange(value => {
                        this.selectedCategoryId = value;
                    });
            });

        // Buttons
        const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });
        
        const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
        cancelBtn.addEventListener('click', () => {
            this.close();
        });

        const saveBtn = buttonContainer.createEl('button', { 
            text: 'Save Changes',
            cls: 'mod-cta'
        });
        saveBtn.addEventListener('click', () => {
            this.handleSubmit();
        });
    }

    private handleSubmit() {
        if (!this.name.trim()) {
            new Notice('Item name is required!');
            return;
        }

        const updates: Partial<SchedulerItem> = {
            name: this.name.trim(),
            description: this.description.trim(),
            categoryId: this.selectedCategoryId
        };

        this.onSubmit(updates);
        this.close();
        new Notice('Item updated!');
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}