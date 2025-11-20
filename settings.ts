import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import type SchedulerPlugin from './main';
import { CategoryConfig } from './types';

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
}