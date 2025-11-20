import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import SchedulerPlugin from './main';
import { CategoryConfig } from './types';

/**
 * Settings tab for the Scheduler plugin
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

        // Standard items section
        containerEl.createEl('h3', { text: 'Standard Items' });
        containerEl.createEl('p', { 
            text: 'Configure recurring items that can be auto-inserted into your schedule.',
            cls: 'setting-item-description'
        });

        // Note about standard items
        new Setting(containerEl)
            .setName('Standard Items Configuration')
            .setDesc('Use the "Insert Standard Items" command to populate your schedule with predefined items like Sleep, Gym, and Meals.');
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
                        this.display(); // Refresh display
                    });
                text.inputEl.style.width = '150px';
            })
            .addColorPicker(color => {
                color.setValue(category.color)
                    .onChange(async (value) => {
                        this.plugin.settings.categories[index].color = value;
                        await this.plugin.saveSettings();
                    });
            })
            .addButton(button => button
                .setButtonText('Delete')
                .setWarning()
                .onClick(async () => {
                    this.plugin.settings.categories.splice(index, 1);
                    await this.plugin.saveSettings();
                    new Notice(`Deleted category: ${category.name}`);
                    this.display(); // Refresh display
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
        this.display(); // Refresh display
    }
}