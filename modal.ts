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

    constructor(
        app: App,
        categories: CategoryConfig[],
        title: string,
        onSubmit: (item: Omit<SchedulerItem, 'id'>) => void
    ) {
        super(app);
        this.categories = categories;
        this.title = title;
        this.onSubmit = onSubmit;
        
        // Set default category
        if (categories.length > 0) {
            this.selectedCategoryId = categories[0].id;
        }
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('scheduler-modal');

        contentEl.createEl('h2', { text: 'Add Item' });
        contentEl.createEl('p', { 
            text: this.title,
            cls: 'scheduler-modal-subtitle'
        });

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

        // Item Type dropdown
        new Setting(contentEl)
            .setName('Type')
            .setDesc('Item type affects visual appearance')
            .addDropdown(dropdown => {
                dropdown.addOption('regular', 'Regular');
                dropdown.addOption('task', 'Task (with checkbox)');
                dropdown.addOption('goal', 'Goal');
                dropdown.addOption('deadline', 'Deadline (urgent)');
                dropdown.setValue(this.selectedItemType)
                    .onChange(value => {
                        this.selectedItemType = value as ItemType;
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

        const addBtn = buttonContainer.createEl('button', { 
            text: 'Add Item',
            cls: 'mod-cta'
        });
        addBtn.addEventListener('click', () => {
            this.handleSubmit();
        });
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
            completed: false
        };

        this.onSubmit(item);
        this.close();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}