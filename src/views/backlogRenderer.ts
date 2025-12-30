/**
 * Backlog Sidebar Renderer
 * 
 * RESPONSIBILITY:
 * Renders the collapsible backlog sidebar on the right side of the scheduler.
 * Displays to-do items organized by category with expand/collapse functionality.
 * 
 * USED BY:
 * - view.ts (main scheduler view calls renderBacklog())
 * 
 * FEATURES:
 * - Collapsible sidebar with toggle button
 * - Items grouped by category
 * - Reorder items within category (up/down buttons)
 * - Edit, delete, and checkbox (for tasks) buttons
 * - Add new items and clear all functionality
 * 
 * VISUAL HIERARCHY:
 * - Collapsed: Only shows toggle button (→)
 * - Expanded: Shows title, buttons, and categorized item list
 */
import type SchedulerPlugin from '../main';
import { SchedulerItem, CategoryConfig } from '../types';
import { AddItemModal } from '../modals/addItemModal';
import { EditItemModal } from '../modals/editItemModal';
import { ItemRenderer } from './itemRenderer';

export class BacklogRenderer {
    private plugin: SchedulerPlugin;
    private itemRenderer: ItemRenderer;
    private refreshView: () => void;

    constructor(plugin: SchedulerPlugin, refreshView: () => void) {
        this.plugin = plugin;
        this.itemRenderer = new ItemRenderer(plugin);
        this.refreshView = refreshView;
    }

    /**
     * Render the backlog sidebar section
     * Adapts UI based on expanded/collapsed state
     */
    renderBacklog(container: Element) {
        // Add collapsed/expanded class
        if (this.plugin.settings.backlogExpanded) {
            container.addClass('backlog-expanded');
        } else {
            container.addClass('backlog-collapsed');
        }

        const backlogHeader = container.createDiv({ cls: 'backlog-header' });

        // Toggle button (always visible)
        const toggleBtn = backlogHeader.createEl('button', {
            cls: 'backlog-toggle-btn',
            text: this.plugin.settings.backlogExpanded ? '→' : '←'
        });
        toggleBtn.setAttribute(
            'aria-label',
            this.plugin.settings.backlogExpanded ? 'Collapse sidebar' : 'Expand sidebar'
        );
        toggleBtn.addEventListener('click', () => {
            this.plugin.toggleBacklogSidebar();
        });

        // Only show title and buttons when expanded
        if (this.plugin.settings.backlogExpanded) {
            backlogHeader.createEl('h3', { text: 'To-Do Backlog' });

            // Create button container
            const buttonContainer = backlogHeader.createDiv({ cls: 'backlog-header-buttons' });

            // Add button
            const addBtn = buttonContainer.createEl('button', {
                cls: 'add-task-btn',
                text: '+'
            });
            addBtn.addEventListener('click', () => {
                this.openAddBacklogItemModal();
            });

            // Trash button
            const trashBtn = buttonContainer.createEl('button', {
                cls: 'trash-task-btn',
                text: '🗑️'
            });
            trashBtn.addEventListener('click', () => {
                const confirmed = confirm('Clear all backlog items?');
                if (confirmed) {
                    this.plugin.clearBacklogItems();
                }
            });
        }

        // Only render list when expanded
        if (this.plugin.settings.backlogExpanded) {
            this.renderBacklogList(container);
        }
    }

    /**
     * Render the list of backlog items grouped by category
     */
    private renderBacklogList(container: Element) {
        const backlogList = container.createDiv({ cls: 'backlog-list' });
        const allItems = this.plugin.getBacklogItems();

        if (allItems.length === 0) {
            backlogList.createDiv({
                cls: 'backlog-empty',
                text: 'No items in backlog'
            });
            return;
        }

        // Group backlog items by category
        const itemsByCategory: Record<string, SchedulerItem[]> = {};

        this.plugin.settings.categories.forEach((cat: CategoryConfig) => {
            itemsByCategory[cat.id] = [];
        });

        allItems.forEach((item: SchedulerItem) => {
            if (itemsByCategory[item.categoryId]) {
                itemsByCategory[item.categoryId].push(item);
            }
        });

        // Render each category that has items
        this.plugin.settings.categories.forEach((category: CategoryConfig) => {
            const items = itemsByCategory[category.id];
            if (items.length === 0) return;

            // Category divider
            const header = backlogList.createDiv({ cls: 'monthly-type-header' });
            header.setText(`──────── ${category.name.toUpperCase()} ────────`);

            // Render items in this category
            items.forEach((item, index) => {
                this.renderBacklogItemCard(
                    backlogList,
                    item,
                    index,
                    items.length,
                    category.id
                );
            });
        });
    }

    /**
     * Render a single backlog item card with controls
     */
    private renderBacklogItemCard(
        backlogList: HTMLElement,
        item: SchedulerItem,
        index: number,
        totalCount: number,
        categoryId: string
    ) {
        const category = this.itemRenderer.getCategoryById(item.categoryId);
        const itemCard = backlogList.createDiv({ cls: 'task-card' });

        // Apply styling
        const textColor = this.itemRenderer.applyItemStyling(itemCard, item, category);

        // Create content (name and description)
        if (textColor && category) {
            this.itemRenderer.createItemContent(itemCard, item, textColor);
        } else {
            // Fallback if no category
            itemCard.createDiv({ cls: 'task-name', text: item.name });
            if (item.description) {
                itemCard.createDiv({ cls: 'task-description', text: item.description });
            }
        }

        // Button container
        const btnContainer = itemCard.createDiv({ cls: 'task-buttons' });

        // Reorder buttons (within same category)
        this.itemRenderer.createReorderButtons(
            btnContainer,
            index,
            totalCount,
            (direction) => {
                this.plugin.reorderBacklogItemInCategory(item.id, categoryId, direction);
            }
        );

        // Checkbox for tasks
        this.itemRenderer.createCheckboxButton(btnContainer, item, () => {
            this.plugin.updateItem(item.id, { completed: !item.completed });
        });

        // Edit button
        this.itemRenderer.createEditButton(btnContainer, () => {
            this.openEditBacklogItemModal(item);
        });

        // Delete button
        this.itemRenderer.createDeleteButton(btnContainer, () => {
            this.plugin.removeItem(item.id);
            this.refreshView();
        });
    }

    /**
     * Open modal to add new backlog item
     */
    private openAddBacklogItemModal() {
        const modal = new AddItemModal(
            this.plugin.app,
            this.plugin.settings.categories,
            'New Backlog Item',
            (item: Omit<SchedulerItem, 'id'>) => {
                this.plugin.addBacklogItem(item);
            }
        );
        modal.open();
    }

    /**
     * Open modal to edit existing backlog item
     */
    private openEditBacklogItemModal(item: SchedulerItem) {
        const modal = new EditItemModal(
            this.plugin.app,
            this.plugin.settings.categories,
            item,
            (updates: Partial<SchedulerItem>) => {
                this.plugin.updateItem(item.id, updates);
            }
        );
        modal.open();
    }
}