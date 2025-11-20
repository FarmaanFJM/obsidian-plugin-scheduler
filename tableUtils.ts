import { SchedulerItem } from './types';

/**
 * Utilities for parsing and manipulating Markdown tables
 */
export class TableUtils {
    /**
     * Parse a Markdown table into a 2D array
     */
    static parseTable(tableText: string): string[][] {
        const lines = tableText.trim().split('\n');
        const rows: string[][] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Skip separator line
            if (line.match(/^\|[\s\-:|]+\|$/)) {
                continue;
            }

            // Parse cell content
            const cells = line
                .split('|')
                .map(cell => cell.trim())
                .filter((_, index, arr) => index > 0 && index < arr.length - 1); // Remove empty first/last

            rows.push(cells);
        }

        return rows;
    }

    /**
     * Convert 2D array back to Markdown table
     */
    static arrayToTable(data: string[][]): string {
        if (data.length === 0) return '';

        const lines: string[] = [];

        // Header row
        lines.push('| ' + data[0].join(' | ') + ' |');

        // Separator
        const separator = data[0].map(() => '-----').join(' | ');
        lines.push('| ' + separator + ' |');

        // Data rows
        for (let i = 1; i < data.length; i++) {
            lines.push('| ' + data[i].join(' | ') + ' |');
        }

        return lines.join('\n');
    }

    /**
     * Find scheduler table in document
     */
    static findSchedulerTable(content: string): { start: number; end: number; table: string } | null {
        const startMarker = '<!-- scheduler-start -->';
        const endMarker = '<!-- scheduler-end -->';

        const startIndex = content.indexOf(startMarker);
        if (startIndex === -1) return null;

        const endIndex = content.indexOf(endMarker, startIndex);
        if (endIndex === -1) return null;

        const tableStart = startIndex + startMarker.length;
        const table = content.substring(tableStart, endIndex).trim();

        return {
            start: startIndex,
            end: endIndex + endMarker.length,
            table
        };
    }

    /**
     * Update a specific cell in the table
     */
    static updateCell(data: string[][], row: number, col: number, content: string): string[][] {
        const newData = data.map(r => [...r]);
        if (row >= 0 && row < newData.length && col >= 0 && col < newData[row].length) {
            newData[row][col] = content;
        }
        return newData;
    }

    /**
     * Get cell content at specific position
     */
    static getCell(data: string[][], row: number, col: number): string {
        if (row >= 0 && row < data.length && col >= 0 && col < data[row].length) {
            return data[row][col];
        }
        return '';
    }

    /**
     * Format an item as HTML for cell content
     */
    static formatItem(item: SchedulerItem): string {
        const nameSpan = `<span style="color:${item.color}; font-weight:bold;">${item.name}</span>`;
        if (item.description) {
            return `- ${nameSpan}  \n  ${item.description}`;
        }
        return `- ${nameSpan}`;
    }

    /**
     * Append an item to existing cell content
     */
    static appendItemToCell(existingContent: string, item: SchedulerItem): string {
        const formattedItem = this.formatItem(item);
        
        if (!existingContent || existingContent.trim() === '') {
            return formattedItem;
        }

        return existingContent + '  \n' + formattedItem;
    }

    /**
     * Generate empty weekly scheduler table
     */
    static generateEmptyScheduler(): string {
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const hours: string[] = [];

        // Generate hours from 04:00 to 23:00
        for (let h = 4; h <= 23; h++) {
            hours.push(`${h.toString().padStart(2, '0')}:00`);
        }

        // Build table data
        const data: string[][] = [];
        
        // Header
        data.push(['Time', ...days]);

        // Rows
        for (const hour of hours) {
            data.push([hour, '', '', '', '', '', '', '']);
        }

        const table = this.arrayToTable(data);
        return `<!-- scheduler-start -->\n\n${table}\n\n<!-- scheduler-end -->`;
    }

    /**
     * Find row index for a given time
     */
    static findTimeRow(data: string[][], time: string): number {
        for (let i = 1; i < data.length; i++) {
            if (data[i][0] === time) {
                return i;
            }
        }
        return -1;
    }

    /**
     * Convert day name to column index (1-7, since column 0 is Time)
     */
    static dayToColumn(day: number): number {
        return day + 1; // day 0 (Monday) -> column 1
    }
}