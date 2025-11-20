import { App, Modal, Setting } from 'obsidian';
import { SchedulerItem, CategoryConfig, CellPosition } from './types';

/**
 * Modal for adding scheduler items
 */
export class SchedulerItemModal extends Modal {
    private name: string = '';
    private description: string = '';
    private selectedCategoryId: string = '';
    private customColor: string = '';
    private useCustomColor: boolean = false;
    
    private categories: CategoryConfig[];
    private cellPosition: CellPosition;
    private onSubmit: (item: SchedulerItem) => void;

    constructor(
        app: App,
        categories: CategoryConfig[],
        cellPosition: CellPosition,
        onSubmit: (item: SchedulerItem) => void
    ) {
        super(app);
        this.categories = categories;
        this.cellPosition = cellPosition;
        this.onSubmit = onSubmit;
        
        // Set default category
        if (categories.length > 0) {
            this.selectedCategoryId = categories[0].id;
        }
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: 'Add Scheduler Item' });

        // Display cell position info
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        contentEl.createEl('p', { 
            text: `${days[this.cellPosition.day]} at ${this.cellPosition.time}`,
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
                text.setPlaceholder('e.g., Cardio and weights')
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
                        this.useCustomColor = false;
                        this.updateColorPreview();
                    });
            });

        // Color preview
        const colorPreviewSetting = new Setting(contentEl)
            .setName('Color Preview')
            .setDesc('Current item color');

        const previewDiv = colorPreviewSetting.controlEl.createDiv({
            cls: 'scheduler-color-preview'
        });
        previewDiv.style.cssText = 'width: 50px; height: 30px; border: 1px solid #ccc; border-radius: 4px;';
        
        const updateColorPreview = () => {
            const color = this.useCustomColor ? this.customColor : this.getCurrentCategoryColor();
            previewDiv.style.backgroundColor = color;
        };
        this.updateColorPreview = updateColorPreview;
        updateColorPreview();

        // Custom color option
        new Setting(contentEl)
            .setName('Use Custom Color')
            .setDesc('Override category color')
            .addToggle(toggle => toggle
                .setValue(this.useCustomColor)
                .onChange(value => {
                    this.useCustomColor = value;
                    this.updateColorPreview();
                }));

        // Custom color input
        new Setting(contentEl)
            .setName('Custom Hex Color')
            .setDesc('e.g., #FF5733')
            .addText(text => text
                .setPlaceholder('#000000')
                .setValue(this.customColor)
                .onChange(value => {
                    this.customColor = value;
                    if (this.useCustomColor) {
                        this.updateColorPreview();
                    }
                }));

        // Buttons
        const buttonContainer = contentEl.createDiv({ cls: 'scheduler-modal-buttons' });
        buttonContainer.style.cssText = 'display: flex; gap: 10px; margin-top: 20px; justify-content: flex-end;';

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

    private updateColorPreview: () => void = () => {};

    private getCurrentCategoryColor(): string {
        const category = this.categories.find(cat => cat.id === this.selectedCategoryId);
        return category ? category.color : '#000000';
    }

    private handleSubmit() {
        if (!this.name.trim()) {
            // Show error - name is required
            return;
        }

        const color = this.useCustomColor ? this.customColor : this.getCurrentCategoryColor();

        const item: SchedulerItem = {
            name: this.name.trim(),
            description: this.description.trim(),
            categoryId: this.selectedCategoryId,
            color: color
        };

        this.onSubmit(item);
        this.close();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}