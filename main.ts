import { App, Editor, MarkdownView, Notice, Plugin, MarkdownPostProcessorContext } from 'obsidian';
import { SchedulerSettings, CellPosition, SchedulerItem, StandardItem } from './types';
import { SchedulerSettingTab } from './settings';
import { SchedulerItemModal } from './modal';
import { TableUtils } from './tableUtils';

/**
 * Scheduler Plugin for Obsidian
 * Interactive weekly scheduler with color-coded items
 */
const DEFAULT_SETTINGS: SchedulerSettings = {
    categories: [
        { id: 'school', name: 'School', color: '#8B4513' },
        { id: 'projects', name: 'Projects', color: '#563E78' },
        { id: 'health', name: 'Health', color: '#FFA500' },
        { id: 'other', name: 'Other', color: '#00A0C8' }
    ],
    standardItems: [
        {
            name: 'Sleep',
            description: '',
            categoryId: 'other',
            days: [0, 1, 2, 3, 4, 5, 6], // All days
            startTime: '22:00',
            endTime: '04:00'
        },
        {
            name: 'Gym',
            description: 'Morning workout',
            categoryId: 'health',
            days: [0, 2, 4], // Mon, Wed, Fri
            startTime: '06:00',
            endTime: '07:00'
        },
        {
            name: 'Breakfast',
            description: '',
            categoryId: 'other',
            days: [0, 1, 2, 3, 4, 5, 6],
            startTime: '08:00',
            endTime: '08:00'
        },
        {
            name: 'Lunch',
            description: '',
            categoryId: 'other',
            days: [0, 1, 2, 3, 4, 5, 6],
            startTime: '12:00',
            endTime: '12:00'
        },
        {
            name: 'Dinner',
            description: '',
            categoryId: 'other',
            days: [0, 1, 2, 3, 4, 5, 6],
            startTime: '18:00',
            endTime: '18:00'
        }
    ]
};

export default class SchedulerPlugin extends Plugin {
    settings: SchedulerSettings;

    async onload() {
        await this.loadSettings();

        // Add settings tab
        this.addSettingTab(new SchedulerSettingTab(this.app, this));

        // Command: Insert Weekly Scheduler Table
        this.addCommand({
            id: 'insert-weekly-scheduler',
            name: 'Insert Weekly Scheduler Table',
            editorCallback: (editor: Editor, _view: MarkdownView) => {
                const table = TableUtils.generateEmptyScheduler();
                editor.replaceSelection(table);
                new Notice('Weekly scheduler inserted!');
            }
        });

        // Command: Insert Standard Items
        this.addCommand({
            id: 'insert-standard-items',
            name: 'Insert Standard Items Into Week',
            editorCallback: async (editor: Editor, view: MarkdownView) => {
                await this.insertStandardItems(editor, view);
            }
        });

        // Command: Reset Weekly Scheduler
        this.addCommand({
            id: 'reset-weekly-scheduler',
            name: 'Reset Weekly Scheduler',
            editorCallback: (editor: Editor, _view: MarkdownView) => {
                this.resetScheduler(editor);
            }
        });

        // Command: Insert Monthly Tasklist
        this.addCommand({
            id: 'insert-monthly-tasklist',
            name: 'Insert Monthly Tasklist',
            editorCallback: (editor: Editor, _view: MarkdownView) => {
                const tasklist = this.generateMonthlyTasklist();
                editor.replaceSelection(tasklist);
                new Notice('Monthly tasklist inserted!');
            }
        });

        // Register click handler for scheduler tables
        this.registerMarkdownPostProcessor((element, context) => {
            this.processSchedulerTable(element, context);
        });
    }

    /**
     * Process scheduler tables and make them clickable
     */
    private processSchedulerTable(element: HTMLElement, context: MarkdownPostProcessorContext) {
        // Find tables in the rendered content
        const tables = element.querySelectorAll('table');
        
        tables.forEach(table => {
            // Check if this is a scheduler table by looking for the time column
            const firstCell = table.querySelector('tbody tr td:first-child');
            if (!firstCell) return;
            
            const text = firstCell.textContent?.trim() || '';
            // Check if it matches time format (HH:00)
            if (!/^\d{2}:\d{2}$/.test(text)) return;

            // This is a scheduler table - make cells clickable
            const rows = table.querySelectorAll('tbody tr');
            rows.forEach((row, rowIndex) => {
                const cells = row.querySelectorAll('td');
                
                cells.forEach((cell, cellIndex) => {
                    // Skip time column (first column)
                    if (cellIndex === 0) return;

                    // Add click handler
                    cell.style.cursor = 'pointer';
                    cell.style.minHeight = '40px';
                    cell.style.padding = '8px';
                    
                    // Add hover effect
                    cell.addEventListener('mouseenter', () => {
                        cell.style.backgroundColor = 'var(--background-modifier-hover)';
                    });
                    
                    cell.addEventListener('mouseleave', () => {
                        cell.style.backgroundColor = '';
                    });

                    cell.addEventListener('click', async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        // Get time from first cell
                        const timeCell = cells[0];
                        const time = timeCell.textContent?.trim() || '';
                        
                        // Calculate day (cellIndex - 1 because first column is time)
                        const day = cellIndex - 1;
                        
                        const cellPosition: CellPosition = { day, time };
                        
                        // Open modal
                        const modal = new SchedulerItemModal(
                            this.app,
                            this.settings.categories,
                            cellPosition,
                            async (item: SchedulerItem) => {
                                await this.addItemToScheduler(item, cellPosition, context);
                            }
                        );
                        modal.open();
                    });
                });
            });
        });
    }

    /**
     * Add an item to the scheduler table
     */
    private async addItemToScheduler(
        item: SchedulerItem,
        position: CellPosition,
        context: MarkdownPostProcessorContext
    ) {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) {
            new Notice('No active markdown view');
            return;
        }

        const editor = view.editor;
        const content = editor.getValue();
        
        // Find scheduler table
        const tableInfo = TableUtils.findSchedulerTable(content);
        if (!tableInfo) {
            new Notice('Could not find scheduler table');
            return;
        }

        // Parse table
        const tableData = TableUtils.parseTable(tableInfo.table);
        
        // Find the correct cell
        const rowIndex = TableUtils.findTimeRow(tableData, position.time);
        const colIndex = TableUtils.dayToColumn(position.day);

        if (rowIndex === -1) {
            new Notice(`Could not find time row: ${position.time}`);
            return;
        }

        // Get existing content
        const existingContent = TableUtils.getCell(tableData, rowIndex, colIndex);
        
        // Append new item
        const newContent = TableUtils.appendItemToCell(existingContent, item);
        
        // Update table data
        const updatedData = TableUtils.updateCell(tableData, rowIndex, colIndex, newContent);
        
        // Convert back to markdown
        const updatedTable = TableUtils.arrayToTable(updatedData);
        
        // Replace in document
        const newContent2 = 
            content.substring(0, tableInfo.start) +
            `<!-- scheduler-start -->\n\n${updatedTable}\n\n<!-- scheduler-end -->` +
            content.substring(tableInfo.end);
        
        editor.setValue(newContent2);
        new Notice(`Added: ${item.name}`);
    }

    /**
     * Insert standard items into the scheduler
     */
    private async insertStandardItems(editor: Editor, _view: MarkdownView) {
        const content = editor.getValue();
        const tableInfo = TableUtils.findSchedulerTable(content);
        
        if (!tableInfo) {
            new Notice('No scheduler table found. Insert one first!');
            return;
        }

        const tableData = TableUtils.parseTable(tableInfo.table);
        let updatedData = tableData;

        // Process each standard item
        for (const standardItem of this.settings.standardItems) {
            const category = this.settings.categories.find(c => c.id === standardItem.categoryId);
            const color = category ? category.color : '#000000';

            const item: SchedulerItem = {
                name: standardItem.name,
                description: standardItem.description,
                categoryId: standardItem.categoryId,
                color: color
            };

            // Add to each specified day
            for (const day of standardItem.days) {
                const rowIndex = TableUtils.findTimeRow(updatedData, standardItem.startTime);
                const colIndex = TableUtils.dayToColumn(day);

                if (rowIndex !== -1) {
                    const existingContent = TableUtils.getCell(updatedData, rowIndex, colIndex);
                    
                    // Check if item already exists (simple check)
                    if (!existingContent.includes(standardItem.name)) {
                        const newContent = TableUtils.appendItemToCell(existingContent, item);
                        updatedData = TableUtils.updateCell(updatedData, rowIndex, colIndex, newContent);
                    }
                }
            }
        }

        // Replace table in document
        const updatedTable = TableUtils.arrayToTable(updatedData);
        const newContent = 
            content.substring(0, tableInfo.start) +
            `<!-- scheduler-start -->\n\n${updatedTable}\n\n<!-- scheduler-end -->` +
            content.substring(tableInfo.end);
        
        editor.setValue(newContent);
        new Notice('Standard items inserted!');
    }

    /**
     * Reset the scheduler table (clear all cells except times)
     */
    private resetScheduler(editor: Editor) {
        const content = editor.getValue();
        const tableInfo = TableUtils.findSchedulerTable(content);
        
        if (!tableInfo) {
            new Notice('No scheduler table found');
            return;
        }

        const tableData = TableUtils.parseTable(tableInfo.table);
        
        // Clear all cells except header and time column
        for (let row = 1; row < tableData.length; row++) {
            for (let col = 1; col < tableData[row].length; col++) {
                tableData[row][col] = '';
            }
        }

        const updatedTable = TableUtils.arrayToTable(tableData);
        const newContent = 
            content.substring(0, tableInfo.start) +
            `<!-- scheduler-start -->\n\n${updatedTable}\n\n<!-- scheduler-end -->` +
            content.substring(tableInfo.end);
        
        editor.setValue(newContent);
        new Notice('Scheduler reset!');
    }

    /**
     * Generate monthly tasklist template
     */
    private generateMonthlyTasklist(): string {
        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];

        let output = '## Monthly Tasks\n\n';
        
        for (const month of months) {
            output += `### ${month}\n-\n\n`;
        }

        return output;
    }

    async onunload() {
        // Cleanup
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}