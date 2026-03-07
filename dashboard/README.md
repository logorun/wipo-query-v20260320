# WIPO Trademark Dashboard

Web interface for WIPO trademark query system with real-time monitoring.

## Features

### Real-time Task Monitoring
- Live progress bars showing task completion percentage
- Real-time processing logs with status icons (✓ ✗ ⟳ ○)
- Auto-refresh every 5 seconds for task list

### Drawer-based Task Details
- Click any task row to open detail drawer from right side
- Shows processing progress, logs, and results in real-time
- Updates via polling every 3 seconds while task is processing
- Close via X button, backdrop click, or Escape key

### Results Visualization
- Results table with expandable card details
- Shows: trademark, status, date, country, registration number
- Expandable cards show: holder, Nice classes, EU/Europe status
- Color-coded status badges

### Task Management
- Submit new trademark queries (comma-separated)
- Filter tasks by status (all/completed/processing/pending/failed)
- View task statistics (total/completed/processing/failed)
- Charts showing status distribution and daily query volume

## Quick Start

1. Start the API server:
   ```bash
   cd /root/.openclaw/workspace/projects/wipo-trademark-batch/api
   pm2 start ecosystem.config.js
   ```

2. Open dashboard:
   ```bash
   # Option 1: Direct file open
   open dashboard/index.html
   
   # Option 2: Use start script
   cd dashboard && ./start.sh
   ```

3. The dashboard will connect to `http://localhost:3000`

## Usage

### View Task Details
1. Click any task row in the task list
2. Drawer slides in from right showing:
   - Progress bar with percentage
   - Processing logs for each trademark
   - Results table with expandable details
3. Drawer auto-updates while task is processing
4. Close drawer via X button or clicking backdrop

### Submit New Query
1. Enter trademark names in the input field (comma-separated)
2. Click "提交查询" button
3. New task appears in the list
4. Click task to monitor progress in real-time

### Filter Tasks
Use the status dropdown to filter by:
- 全部状态 (All)
- 已完成 (Completed)
- 处理中 (Processing)
- 待处理 (Pending)
- 失败 (Failed)

## File Structure

```
dashboard/
├── index.html              # Main page
├── css/
│   ├── styles.css         # Main styles (Tailwind + custom)
│   └── drawer.css         # Drawer component styles
├── js/
│   ├── api.js             # API client with pollTask method
│   ├── app.js             # Main application logic
│   ├── drawer.js          # Task detail drawer component
│   └── charts.js          # Chart.js integration
├── README.md              # This file
└── start.sh               # Quick start script
```

## API Endpoints

The dashboard uses these API endpoints:

- `GET /api/v1/health` - Health check
- `GET /api/v1/tasks` - List tasks with pagination
- `GET /api/v1/tasks/:id` - Get task details (returns partial results during processing)
- `POST /api/v1/tasks` - Submit new trademark query

## Real-time Updates

### Polling Mechanism
- Task list refreshes every 30 seconds
- Active drawer polls every 3 seconds for updates
- Polling stops automatically when task completes or fails

### Update Flow
1. User opens drawer for processing task
2. `api.pollTask()` starts polling every 3 seconds
3. Each poll updates:
   - Progress bar percentage
   - Processing logs
   - Results table
4. Polling stops when status is 'completed' or 'failed'
5. Cleanup function prevents memory leaks

## Browser Requirements

- Chrome/Edge 88+
- Firefox 78+
- Safari 14+

Requires:
- CSS Grid/Flexbox support
- ES6+ JavaScript (async/await, arrow functions)
- Fetch API
- CSS backdrop-filter (for glass effect)

## Troubleshooting

### Dashboard shows "API Offline"
- Check if API server is running: `pm2 status`
- Verify API is on port 3000
- Check browser console for CORS errors

### Drawer not opening
- Check browser console for JavaScript errors
- Verify `drawer.js` is loaded in Network tab
- Ensure `api.js` is loaded before `drawer.js`

### Real-time updates not working
- Check if task status is 'processing' (only processing tasks update)
- Verify no ad blockers are interfering
- Check Network tab for polling requests

## Design

- **Theme**: Dark industrial with cyan/green accents
- **Color Palette**: Slate grays with cyan-500 and green-500 highlights
- **Typography**: System fonts with JetBrains Mono for code elements
- **Animations**: Smooth transitions (300ms), gradient progress bars

## Development

To modify the dashboard:

1. Edit relevant file in `dashboard/js/` or `dashboard/css/`
2. Refresh browser to see changes (no build step needed)
3. Test with active tasks to verify real-time updates

## Changelog

### 2026-03-07
- Added drawer component for task details
- Implemented real-time polling for processing tasks
- Added progress bars to task list
- Created expandable result cards
