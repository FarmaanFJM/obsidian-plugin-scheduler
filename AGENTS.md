# Developer Notes for AI Assistants

This file contains guidance for AI coding assistants (like Claude, GitHub Copilot, Cursor, etc.) working on this Obsidian plugin.

## What This File Is For

`AGENTS.md` provides context to AI assistants about:
- Project structure and organization
- Coding conventions specific to this plugin
- Common patterns and anti-patterns
- Development workflow

**Note**: This file is for development purposes only and should not be included in plugin releases.

## Project Structure

```
obsidian-plugin-scheduler/
├── src/                          # All source code
│   ├── main.ts                   # Plugin entry point, lifecycle management
│   ├── types.ts                  # TypeScript interfaces
│   ├── constants.ts              # Shared constants
│   │
│   ├── managers/                 # Business logic layer
│   │   ├── dataManager.ts        # Data persistence (read/write to vault)
│   │   ├── scheduleManager.ts    # Weekly scheduler operations
│   │   ├── backlogManager.ts     # Backlog feature operations
│   │   ├── goalsManager.ts       # Goals feature operations
│   │   └── standardTasksManager.ts  # Standard tasks logic
│   │
│   ├── modals/                   # User interaction dialogs
│   │   ├── addItemModal.ts       # Add new item modal
│   │   ├── editItemModal.ts      # Edit existing item modal
│   │   └── editStandardTaskModal.ts  # Manage standard tasks modal
│   │
│   ├── settings/                 # Settings management
│   │   └── settings.ts           # Settings tab and persistence
│   │
│   ├── utils/                    # Utility functions
│   │   └── dateUtils.ts          # Date/time helpers
│   │
│   └── views/                    # UI rendering layer
│       ├── view.ts               # Custom view base
│       ├── weeklyRenderer.ts     # Weekly schedule table renderer
│       ├── monthlyRenderer.ts    # Monthly task list renderer
│       ├── backlogRenderer.ts    # Backlog view renderer
│       ├── goalsRenderer.ts      # Goals view renderer
│       └── itemRenderer.ts       # Item rendering utilities
│
├── styles.css                    # Plugin styles
├── manifest.json                 # Plugin metadata
├── package.json                  # NPM configuration
├── tsconfig.json                 # TypeScript configuration
├── esbuild.config.mjs           # Build configuration
├── README.md                     # User documentation
├── AGENTS.md                     # This file (AI assistant guide)
└── LICENSE                       # MIT License
```

## Architecture Layers

### 1. Managers Layer (`src/managers/`)
**Purpose**: Business logic and data operations

- **dataManager.ts**: Central data access layer
  - Reads/writes to vault files
  - Parses markdown comment blocks
  - Handles data persistence
  
- **scheduleManager.ts**: Weekly scheduler logic
  - Insert/update/delete schedule items
  - Handle time slots and days
  - Coordinate with dataManager
  
- **backlogManager.ts**: Backlog operations
  - Manage backlog items
  - Priority handling
  
- **goalsManager.ts**: Goals operations
  - CRUD operations for goals
  - Progress tracking
  
- **standardTasksManager.ts**: Standard tasks
  - Manage recurring task templates
  - Auto-insert logic

**Convention**: Managers should be pure functions or minimal classes. They orchestrate data operations but don't render UI.

### 2. Views Layer (`src/views/`)
**Purpose**: Rendering and UI generation

- **Renderers**: Take data and return HTML/DOM elements
- **No state modification**: Renderers are view-only
- **Separation of concerns**: Keep rendering logic separate from business logic

**Convention**: 
```typescript
// Good: Pure rendering
export function renderWeeklySchedule(data: ScheduleData): HTMLElement {
    const container = document.createElement('div');
    // ... render logic
    return container;
}

// Bad: Mixing concerns
export function renderAndSaveWeeklySchedule(data: ScheduleData) {
    // Don't do I/O in renderers!
}
```

### 3. Modals Layer (`src/modals/`)
**Purpose**: User interaction dialogs

- **Obsidian Modal API**: Extends `Modal` class
- **Validation**: Handle input validation in modal
- **Callbacks**: Return validated data via callbacks

**Convention**:
```typescript
export class AddItemModal extends Modal {
    onSubmit: (data: ItemData) => void;
    
    onOpen() {
        // Build form
    }
    
    onClose() {
        // Cleanup
    }
}
```

### 4. Settings Layer (`src/settings/`)
**Purpose**: Plugin configuration

- **PluginSettingTab**: Obsidian's settings API
- **Persistence**: Load/save via `loadData()` / `saveData()`
- **Defaults**: Always provide sensible defaults

### 5. Utils Layer (`src/utils/`)
**Purpose**: Shared utility functions

- **dateUtils.ts**: Date parsing, formatting, validation
- **No side effects**: Utils should be pure functions

## Key Design Patterns

### Manager Pattern
Each feature has a dedicated manager:
```typescript
// scheduleManager.ts
export class ScheduleManager {
    async insertItem(app: App, time: string, day: string, item: Item) {
        const data = await dataManager.loadScheduleData(app);
        // ... modify data
        await dataManager.saveScheduleData(app, data);
    }
}
```

### Renderer Pattern
UI rendering is delegated to view files:
```typescript
// weeklyRenderer.ts
export function renderWeeklyTable(data: WeekData): string {
    let html = '<table>...';
    // ... build HTML
    return html;
}
```

### Modal Pattern
User interactions use Obsidian's Modal API:
```typescript
// addItemModal.ts
export class AddItemModal extends Modal {
    constructor(app: App, onSubmit: (data: ItemData) => void) {
        super(app);
        this.onSubmit = onSubmit;
    }
}
```

### Data Layer Pattern
All file I/O goes through `dataManager.ts`:
```typescript
// dataManager.ts
export class DataManager {
    async loadScheduleData(app: App): Promise<ScheduleData> {
        // Read from vault
    }
    
    async saveScheduleData(app: App, data: ScheduleData): Promise<void> {
        // Write to vault
    }
}
```

## Common Development Tasks

### Adding a New Feature

1. **Create manager**: `src/managers/myFeatureManager.ts`
   ```typescript
   export class MyFeatureManager {
       async doSomething() { /* ... */ }
   }
   ```

2. **Create renderer**: `src/views/myFeatureRenderer.ts`
   ```typescript
   export function renderMyFeature(data: any): HTMLElement {
       // Return DOM elements
   }
   ```

3. **Add types**: `src/types.ts`
   ```typescript
   export interface MyFeatureData {
       // Define structure
   }
   ```

4. **Register command**: `src/main.ts`
   ```typescript
   this.addCommand({
       id: 'my-feature-command',
       name: 'My Feature',
       callback: async () => {
           const manager = new MyFeatureManager();
           await manager.doSomething();
       }
   });
   ```

5. **Add settings** (if needed): `src/settings/settings.ts`

### Adding a New Command

```typescript
// In src/main.ts
this.addCommand({
    id: 'unique-command-id',
    name: 'User-Facing Command Name',
    callback: async () => {
        const manager = new MyManager();
        await manager.execute(this.app, this.settings);
    }
});
```

### Adding a New Setting

```typescript
// In src/types.ts
export interface SchedulerSettings {
    existingSetting: string;
    newSetting: boolean; // Add here
}

// In src/settings/settings.ts
export const DEFAULT_SETTINGS: SchedulerSettings = {
    existingSetting: 'value',
    newSetting: false // Add default
};

// In settings.ts display() method
new Setting(containerEl)
    .setName('New Setting')
    .setDesc('Description')
    .addToggle(toggle => toggle
        .setValue(this.plugin.settings.newSetting)
        .onChange(async (value) => {
            this.plugin.settings.newSetting = value;
            await this.plugin.saveSettings();
        }));
```

## Code Style Guidelines

### TypeScript
- Use strict mode (`"strict": true`)
- Prefer interfaces over type aliases for objects
- Use async/await over promise chains
- Always handle errors gracefully
- Use proper typing (avoid `any`)

### Naming Conventions
- **Files**: camelCase (e.g., `scheduleManager.ts`)
- **Folders**: camelCase (e.g., `src/managers/`)
- **Classes**: PascalCase (e.g., `AddItemModal`)
- **Functions**: camelCase (e.g., `insertWeeklyTable`)
- **Constants**: SCREAMING_SNAKE_CASE (e.g., `DEFAULT_START_HOUR`)
- **Interfaces**: PascalCase with descriptive names (e.g., `ScheduleItem`)

### File Organization
- Keep `main.ts` minimal (only plugin lifecycle)
- One class per file
- Group related functionality in same folder
- Maximum ~200-300 lines per file
- If file grows too large, split into smaller modules

### Import Organization
```typescript
// 1. External imports
import { App, Plugin, Modal } from 'obsidian';

// 2. Type imports
import type { ScheduleItem, Settings } from './types';

// 3. Local imports
import { DataManager } from './managers/dataManager';
import { renderWeeklySchedule } from './views/weeklyRenderer';
```

## Testing Locally

```bash
# Install dependencies
npm install

# Watch mode for development (auto-recompile on save)
npm run dev

# Production build (minified)
npm run build

# Output location
# main.js will be created in project root
```

### Manual Testing Setup
1. Copy these files to vault:
   ```
   <vault>/.obsidian/plugins/scheduler-plugin/
   ├── main.js
   ├── manifest.json
   └── styles.css
   ```

2. Reload Obsidian
3. Enable plugin in Settings → Community Plugins

## Common Pitfalls

1. **Don't bloat `main.ts`**
   - ❌ Bad: Putting all logic in main.ts
   - ✅ Good: Delegate to managers in `src/managers/`

2. **Always clean up resources**
   - Use `this.registerEvent()` for event listeners
   - Use `this.registerDomEvent()` for DOM events
   - Use `this.registerInterval()` for intervals

3. **Don't mix concerns**
   - ❌ Bad: Rendering in manager, data access in renderer
   - ✅ Good: Managers handle logic, renderers handle UI

4. **Handle edge cases**
   - Null/undefined checks
   - Empty data structures
   - Corrupted user data
   - Missing files

5. **Performance considerations**
   - Don't block UI thread during `onload`
   - Use debouncing for expensive operations
   - Lazy load when possible

## Build Process

The plugin uses **esbuild** (configured in `esbuild.config.mjs`):

- **Input**: `src/main.ts` (entry point)
- **Output**: `main.js` (bundled JavaScript)
- **Process**: 
  1. Compiles all TypeScript from `src/`
  2. Bundles into single `main.js`
  3. Minifies in production mode
  4. Watches for changes in dev mode

**Important**: Never commit `main.js` to version control. It's a build artifact.

## Release Checklist

Before publishing:

1. ✅ Bump version in `manifest.json`
2. ✅ Update `versions.json`
3. ✅ Run `npm run build` (production)
4. ✅ Test in clean vault
5. ✅ Create GitHub release (tag = version)
6. ✅ Attach `main.js`, `manifest.json`, `styles.css`

## File Responsibilities Quick Reference

| File | Purpose | What It Should Do | What It Shouldn't Do |
|------|---------|-------------------|---------------------|
| `main.ts` | Plugin lifecycle | Register commands, load settings | Business logic, rendering |
| `*Manager.ts` | Business logic | Coordinate operations, call dataManager | Render UI, direct file I/O |
| `*Renderer.ts` | UI generation | Create DOM/HTML | Modify data, save to disk |
| `*Modal.ts` | User interaction | Collect input, validate | Complex business logic |
| `dataManager.ts` | Data persistence | Read/write vault files | Business logic decisions |
| `settings.ts` | Configuration | Manage plugin settings | Feature-specific logic |
| `dateUtils.ts` | Utilities | Pure helper functions | State modification |

## Resources

- [Obsidian Plugin API](https://docs.obsidian.md)
- [Obsidian Sample Plugin](https://github.com/obsidianmd/obsidian-sample-plugin)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [esbuild Documentation](https://esbuild.github.io/)

---

**Note**: This file is for AI assistants during development. It should remain in the repository but doesn't need to be included in plugin release artifacts.