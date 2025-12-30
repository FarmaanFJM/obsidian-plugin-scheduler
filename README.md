# Scheduler Plugin for Obsidian

An interactive weekly scheduler plugin that lets you create color-coded weekly planners with clickable cells.

## Features

**Interactive Weekly Scheduler**
- Click any cell to add items
- Color-coded categories (School, Projects, Health, etc.)
- Multiple items per cell
- Custom colors supported

**Standard Items**
- Pre-configure recurring items (Sleep, Gym, Meals)
- Auto-insert standard items into your schedule

**Monthly Task Lists**
- Generate monthly task templates
- Track tasks across the year

**Customizable Categories**
- Add, edit, or remove categories
- Set custom colors for each category

## Installation

### From Obsidian Community Plugins (Recommended)

1. Open **Settings** in Obsidian
2. Navigate to **Community Plugins** and disable **Restricted Mode**
3. Click **Browse** and search for "Scheduler"
4. Click **Install**, then **Enable**

### Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/yourusername/obsidian-scheduler-plugin/releases)
2. Create a folder named `obsidian-scheduler-plugin` in your vault's `.obsidian/plugins/` directory
3. Copy the downloaded files into that folder
4. Reload Obsidian
5. Enable the plugin in **Settings → Community Plugins**

## Usage

### Creating a Weekly Scheduler

1. Open any note
2. Open Command Palette (Ctrl/Cmd + P)
3. Run: **"Insert Weekly Scheduler Table"**
4. A weekly table will be inserted (04:00 - 23:00, Monday - Sunday)

### Adding Items to Your Schedule

1. **Click any cell** in the scheduler table
2. A modal will appear with:
   - **Name** (required): e.g., "Gym", "Study", "Meeting"
   - **Description** (optional): Additional details
   - **Category**: Choose from predefined categories
   - **Custom Color**: Override category color if needed
3. Click **"Add Item"**
4. The item appears in the cell with color formatting

### Adding Multiple Items

- Click the same cell multiple times to add more items
- Each item appears as a separate bullet point
- Items stack vertically in the cell

### Using Standard Items

1. Open Command Palette
2. Run: **"Insert Standard Items Into Week"**
3. Predefined items (Sleep, Gym, Meals) are added to your schedule
4. Standard items won't duplicate if already present

### Configuring Categories

1. Go to **Settings → Scheduler**
2. Under "Categories":
   - **Edit name**: Change category names
   - **Change color**: Click the color picker
   - **Delete**: Remove unwanted categories
   - **Add New Category**: Create custom categories

### Resetting Your Schedule

1. Open Command Palette
2. Run: **"Reset Weekly Scheduler"**
3. All items are cleared, but the table structure remains

### Creating Monthly Task Lists

1. Open Command Palette
2. Run: **"Insert Monthly Tasklist"**
3. A template with all 12 months is inserted
4. Add tasks under each month

## Example Workflow

```markdown
# My 2025 Schedule

<!-- scheduler-start -->

| Time  | Monday | Tuesday | Wednesday | Thursday | Friday | Saturday | Sunday |
| ----- | ------ | ------- | --------- | -------- | ------ | -------- | ------ |
| 06:00 | - <span style="color:#FFA500; font-weight:bold;">Gym</span>  <br>  Cardio workout | | - <span style="color:#FFA500; font-weight:bold;">Gym</span>  <br>  Strength training | | - <span style="color:#FFA500; font-weight:bold;">Gym</span>  <br>  Full body | | |
| 09:00 | - <span style="color:#8B4513; font-weight:bold;">School</span>  <br>  Math class | - <span style="color:#8B4513; font-weight:bold;">School</span>  <br>  Programming | - <span style="color:#8B4513; font-weight:bold;">School</span>  <br>  Database Design | | | | |

<!-- scheduler-end -->
```

## Default Categories

- **School** - Brown (#8B4513)
- **Projects** - Purple (#563E78)
- **Health** - Orange (#FFA500)
- **Other** - Blue (#00A0C8)

## Tips

1. **Color Coding**: Use consistent colors for similar activities
2. **Descriptions**: Add details like locations, specific exercises, or meeting topics
3. **Multi-Year**: Create separate files like `Schedule-2025.md`, `Schedule-2026.md`
4. **Backup**: The plugin works with Markdown, so your data is always readable

## Commands Summary

| Command | Description |
|---------|-------------|
| Insert Weekly Scheduler Table | Creates a new empty scheduler |
| Insert Standard Items Into Week | Populates predefined recurring items |
| Reset Weekly Scheduler | Clears all items from the table |
| Insert Monthly Tasklist | Creates a 12-month task template |

## Troubleshooting

**Items not appearing when clicked?**
- Make sure the table has the `<!-- scheduler-start -->` and `<!-- scheduler-end -->` markers
- Try switching to Reading mode or Live Preview

**Can't click cells?**
- Ensure you're in Reading mode or Live Preview (not Source mode)
- Refresh the note (close and reopen)

**Colors not showing?**
- HTML spans should render in Reading/Live Preview mode
- Check that your theme supports inline HTML

## Development

Want to contribute or modify the plugin?

```bash
# Clone the repository
git clone https://github.com/FarmaanFJM/obsidian-plugin-scheduler.git

# Install dependencies
npm install

# Start development build (watch mode)
npm run dev

# Production build
npm run build
```

The plugin follows TypeScript best practices with organized file structure:
- `main.ts` - Plugin entry point
- `settings.ts` - Settings management
- `*Manager.ts` - Feature managers (schedule, backlog, goals)
- `*Renderer.ts` - UI rendering logic
- `*Modal.ts` - Modal dialogs

## Technical Details

- Built with TypeScript
- Uses Obsidian Plugin API
- Stores data directly in Markdown
- No external dependencies
- Works offline
- Compatible with mobile devices

## Support

For issues or feature requests, please visit the [GitHub repository](https://github.com/yourusername/obsidian-scheduler-plugin/issues).

## License

MIT

---

Enjoy organizing your schedule! 📅