/**
 * Shared Item Rendering Utilities
 * 
 * RESPONSIBILITY:
 * Provides common item card rendering logic and color utilities used across
 * all scheduler sections (weekly, monthly, goals, backlog).
 * 
 * USED BY:
 * - weeklyRenderer.ts (for items in weekly grid cells)
 * - monthlyRenderer.ts (for items in monthly columns)
 * - goalsRenderer.ts (for goal cards)
 * - backlogRenderer.ts (for backlog items)
 * 
 * FEATURES:
 * - Color calculation (contrast, hex to RGB conversion)
 * - Item type styling (regular, task, goal, deadline)
 * - Category color application
 * - Button rendering (edit, delete, checkbox, reorder)
 */
import type SchedulerPlugin from '../main';
import { SchedulerItem, CategoryConfig } from '../types';

export class ItemRenderer {
    private plugin: SchedulerPlugin;

    constructor(plugin: SchedulerPlugin) {
        this.plugin = plugin;
    }

    /**
     * Calculate contrast color (black or white) for given background color
     * Uses luminance formula to determine readability
     */
    getContrastColor(bgColor: string): string {
        const hex = bgColor.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance > 0.5 ? '#1a1a1a' : '#ffffff';
    }

    /**
     * Convert hex color to RGB object
     * Used for CSS variable assignment with RGB values
     */
    hexToRgb(hex: string): { r: number; g: number; b: number } {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    }

    /**
     * Apply category color and item type styling to card element
     * Handles different visual styles for: regular, task, goal, deadline
     */
    applyItemStyling(
        itemCard: HTMLElement,
        item: SchedulerItem,
        category: CategoryConfig | undefined
    ) {
        // Add type-specific class
        itemCard.addClass(`item-type-${item.itemType || 'regular'}`);

        // Add completed class for tasks
        if (item.itemType === 'task' && item.completed) {
            itemCard.addClass('item-completed');
        }

        if (!category) return;

        const baseColor = category.color;
        const rgb = this.hexToRgb(baseColor);

        // Set border colors
        itemCard.style.borderLeftColor = baseColor;
        itemCard.style.setProperty('--category-color-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);

        // For goal: full border outline
        if (item.itemType === 'goal') {
            itemCard.style.borderRightColor = baseColor;
            itemCard.style.borderTopColor = baseColor;
            itemCard.style.borderBottomColor = baseColor;
        }

        // For regular and deadline: solid background
        if (item.itemType === 'regular' || item.itemType === 'deadline') {
            itemCard.style.backgroundColor = baseColor;
        }

        // Calculate text color based on item type
        let textColor: string;
        if (item.itemType === 'task' || item.itemType === 'goal') {
            textColor = '#1a1a1a'; // Dark text on light gradient background
        } else {
            textColor = this.getContrastColor(baseColor); // Contrast for solid backgrounds
        }

        return textColor;
    }

    /**
     * Create name and description elements for item card
     */
    createItemContent(
        itemCard: HTMLElement,
        item: SchedulerItem,
        textColor: string
    ) {
        const nameDiv = itemCard.createDiv({ cls: 'item-name' });
        nameDiv.setText(item.name);
        nameDiv.style.color = textColor;

        if (item.description) {
            const descDiv = itemCard.createDiv({ cls: 'item-description' });
            descDiv.setText(item.description);
            descDiv.style.color = textColor;
            descDiv.style.opacity = '0.75';
        }
    }

    /**
     * Create checkbox button for task items
     */
    createCheckboxButton(
        container: HTMLElement,
        item: SchedulerItem,
        onToggle: () => void
    ): HTMLElement | null {
        if (item.itemType !== 'task') return null;

        const checkBtn = container.createEl('button', {
            cls: 'item-check-btn',
            text: item.completed ? '☑' : '☐'
        });
        checkBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            onToggle();
        });
        return checkBtn;
    }

    /**
     * Create edit button (✎)
     */
    createEditButton(
        container: HTMLElement,
        onEdit: () => void
    ): HTMLElement {
        const editBtn = container.createEl('button', {
            cls: 'item-edit-btn',
            text: '✎'
        });
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            onEdit();
        });
        return editBtn;
    }

    /**
     * Create delete button (×)
     */
    createDeleteButton(
        container: HTMLElement,
        onDelete: () => void
    ): HTMLElement {
        const deleteBtn = container.createEl('button', {
            cls: 'item-delete-btn',
            text: '×'
        });
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            onDelete();
        });
        return deleteBtn;
    }

    /**
     * Create up/down reorder buttons
     * Only shows buttons if item is not at top/bottom of list
     */
    createReorderButtons(
        container: HTMLElement,
        index: number,
        totalCount: number,
        onMove: (direction: 'up' | 'down') => void
    ) {
        // Up button (if not first)
        if (index > 0) {
            const upBtn = container.createEl('button', {
                cls: 'task-reorder-btn task-up-btn',
                text: '▲'
            });
            upBtn.addEventListener('click', () => {
                onMove('up');
            });
        }

        // Down button (if not last)
        if (index < totalCount - 1) {
            const downBtn = container.createEl('button', {
                cls: 'task-reorder-btn task-down-btn',
                text: '▼'
            });
            downBtn.addEventListener('click', () => {
                onMove('down');
            });
        }
    }

    /**
     * Get category by ID from plugin settings
     */
    getCategoryById(id: string): CategoryConfig | undefined {
        return this.plugin.settings.categories.find(cat => cat.id === id);
    }
}