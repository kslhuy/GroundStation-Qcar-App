# Quick Reference Guide - Ground Station Controls

## 🗺️ Interactive Map Controls

### Mouse Controls
| Action | Control | Description |
|--------|---------|-------------|
| **Pan** | Click + Drag | Move the map view around |
| **Zoom In** | Scroll Up | Zoom closer (up to 5x) |
| **Zoom Out** | Scroll Down | Zoom farther (down to 0.5x) |
| **Select Vehicle** | Click on vehicle | Select vehicle for details |

### Button Controls
| Button | Icon | Function |
|--------|------|----------|
| **Zoom In** | ➕ | Increase zoom by 0.2x |
| **Zoom Out** | ➖ | Decrease zoom by 0.2x |
| **Reset View** | ⛶ | Return to center view at 1x zoom |

### Touch Controls (Mobile/Tablet)
- **Pan**: Single finger drag
- **Zoom**: Coming soon (pinch gesture)
- **Select**: Tap on vehicle

---

## 🚗 Vehicle Card Features

### State Display
Shows current vehicle state and mode:

| Display | Meaning | Color |
|---------|---------|-------|
| `INITIALIZE \| MANUAL` | Starting up | 🔵 Blue |
| `IDLE \| AUTONOMOUS` | Ready, waiting | 🟡 Yellow |
| `ACTIVE \| AUTONOMOUS` | Running mission | 🟢 Green |
| `EMERGENCY_STOP \| ...` | E-stop engaged | 🔴 Red |
| `OFFLINE \| ...` | Disconnected | ⚫ Gray |

### Action Buttons

**Start Button**
- Always shows "Start"
- **Green** when available → Click to start mission
- **Gray** when vehicle active → Disabled (vehicle already running)
- Does NOT toggle to "Stop"

**E-Stop Button** (🛑)
- Always available
- Immediately stops vehicle
- Use for emergencies

### Name Editing
- **View**: Hover over name to see edit icon
- **Edit**: Double-click name to edit
- **Save**: Press Enter or click ✓ to save
- **Cancel**: Click outside to cancel

---

## ⚙️ Configuration Workflow

### Step 1: Select Configuration
1. Click on a vehicle card to expand
2. Scroll to "LOGIC CONFIGURATION" section
3. Use dropdowns to select:
   - **Controller**: PID, ACC, etc.
   - **Estimator**: Local Kalman, Distributed Observer, etc.

### Step 2: Review Pending Changes
- 🟠 **Amber dot** appears when changes are pending
- Dropdowns show new selection
- Vehicle NOT using new config yet

### Step 3: Apply Configuration
- Click **"Apply Configuration"** button (turns indigo)
- Changes sent to vehicle via bridge
- Amber dot disappears
- Button shows "No Changes" (grayed out)

### Configuration States

| Button State | Appearance | Meaning |
|---------------|-----------|---------|
| **Enabled** | Indigo, "Apply Configuration" | Changes pending, click to apply |
| **Disabled** | Gray, "No Changes" | No pending changes |

---

## 📊 View Modes

Toggle between different visualization modes:

### Map View
- Traditional top-down vehicle map
- Pan, zoom, and click vehicles
- Shows V2V connections
- Grid system with origin marker

### Local Data  
- Real-time plots for selected vehicle
- Trajectory (X-Y plot)
- Velocity over time
- Throttle and steering graphs

### Fleet Data
- Combined plots for all vehicles
- Fleet trajectories (color-coded)
- Fleet velocities comparison
- Useful for multi-vehicle analysis

**Switch modes**: Use the 3-button toggle at top-left of visualization area

---

## 🎮 System Controls

### Header Controls
- **Bridge Connection**: 🔌 Connect/disconnect to Python GS bridge
- **V2V Network**: 📡 Enable vehicle-to-vehicle communication
- **Emergency Stop**: 🚨 Global emergency stop for ALL vehicles

### Broadcast Commands
Located in **System Logs** panel header:

- **Start All**: 🟢 Start missions for all vehicles
- **Stop All**: 🟡 Stop missions for all vehicles

### Logs Panel
- Shows real-time system events
- Color-coded by severity:
  - 🟢 Green = Success
  - 🔵 Blue = Info
  - 🟡 Yellow = Warning
  - 🔴 Red = Error
- **Clear button**: Remove all logs

---

## 💡 Tips & Tricks

### Map Navigation
- Use **mouse wheel** for smooth zoom
- **Click to drag** for quick repositioning
- **Click vehicles** to see details without switching panels
- **Reset view** button to quickly return to overview

### Configuration Best Practices
1. Always **review** selections before applying
2. Watch for the **amber pending indicator**
3. **Apply immediately** or revert changes
4. Test configuration on one vehicle before applying to fleet

### State Monitoring
- Watch for **"INITIALIZE"** state during startup
- **Green "ACTIVE"** means mission running normally
- **Red "E-STOP"** requires investigation
- **Gray "OFFLINE"** means reconnection needed

### Performance
- Map updates at 60 FPS
- Data plots refresh at 50 Hz
- Logs limited to last 50 entries
- Smooth performance with up to 10 vehicles

---

## 🔧 Troubleshooting

### Map not responding?
- Check if mouse is over the map canvas
- Try clicking reset view button
- Refresh browser if needed

### Can't apply configuration?
- Ensure changes are pending (amber dot visible)
- Check vehicle is connected
- Verify bridge connection active

### Start button grayed out?
- Vehicle is already active
- Use E-Stop to stop, then you can restart

### State stuck on "INITIALIZE"?
- Vehicle may still be starting up
- Check Python GS logs
- Verify bridge connection

---

## 📝 Keyboard Shortcuts

Currently no keyboard shortcuts implemented.

**Future enhancements may include**:
- `Space` - Toggle start/stop
- `R` - Reset map view
- `+/-` - Zoom in/out
- `Arrow keys` - Pan map
- `Esc` - Cancel pending changes

---

## 🎯 Common Workflows

### Starting a Mission
1. Ensure vehicle shows "IDLE" or "INITIALIZE"
2. Configure controller/estimator if needed
3. Click green "Start" button
4. Verify state changes to "ACTIVE"

### Monitoring Fleet
1. Switch to "Fleet Data" view mode
2. Enable V2V network
3. Use "Start All" broadcast
4. Watch trajectories on combined plots

### Emergency Response
1. Click individual **E-Stop** button for one vehicle
2. OR click header **EMERGENCY STOP** for all vehicles
3. Investigate issue using logs
4. Reset when safe to resume

### Testing Configuration
1. Select one vehicle as test subject
2. Change controller/estimator in dropdowns
3. Click "Apply Configuration"
4. Monitor performance in Local Data view
5. If successful, apply to other vehicles

---

## 📚 Additional Resources

- **Full Documentation**: `ENHANCEMENTS_COMPLETED.md`
- **Implementation Details**: Check source files in `components/`
- **Python GS Reference**: `qcar/GUI/qcar_gui/` for backend logic

---

**Version**: 2.0  
**Last Updated**: 2026-01-19  
**Compatibility**: Modern browsers with HTML5 Canvas support
