# GS Web - GS Python Bridge Integration

## Overview

The Ground Station Web (GS Web) now seamlessly integrates with the Ground Station Python (GS Python) through a clean WebSocket bridge architecture. Any changes to vehicle state are automatically reflected in both systems.

## Architecture

```
┌─────────────────┐     WebSocket     ┌──────────────────┐     TCP/IP      ┌──────────┐
│   GS Web App    │ ◄───────────────► │   GS Python      │ ◄──────────────► │ QCar     │
│  (React/TS)     │   (Port 8080)     │  (remote_ctrl.py)│  (Port 5000+)   │ Vehicle  │
└─────────────────┘                   └──────────────────┘                  └──────────┘
```

## Data Flow

### 1. **Telemetry Data (Vehicle → GS Web)**

The Python GS broadcasts two types of telemetry messages:

#### High-Frequency Telemetry (10Hz)
From `vehicle_logic.py::_build_telemetry_data()`:
```json
{
  "type": "telemetry",
  "timestamp": 1234567890.123,
  "time": 45.6,
  "x": 2.5,
  "y": 1.3,
  "th": 0.78,
  "v": 0.75,
  "u": 0.08,
  "delta": 0.12,
  "state": "FOLLOWING_PATH",
  "gps_valid": true
}
```

#### Periodic Status Broadcast (1Hz)
From `vehicle_logic.py::_broadcast_periodic_status()`:
```json
{
  "type": "v2v_status",
  "timestamp": 1234567890.123,
  "car_id": 0,
  
  "v2v_active": true,
  "v2v_peers": 1,
  "v2v_protocol": "UDP-Manager",
  
  "platoon_enabled": true,
  "platoon_is_leader": true,
  "platoon_position": 1,
  "platoon_leader_id": 0,
  
  "local_observer_type": "ekf",
  "fleet_observer_type": "consensus",
  "longitudinal_ctrl_type": "pid",
  "lateral_ctrl_type": "stanley",
  
  "perception_active": false,
  "scopes_active": false
}
```

### 2. **Commands (GS Web → Vehicle)**

Commands flow through the WebSocket bridge to the Python GS, which forwards them to vehicles:

```typescript
// Example: Start mission
bridgeService.startMission('qcar-0');

// Example: Set controller
bridgeService.setController('longitudinal', 'acc', 'qcar-0');

// Example: Enable manual control
bridgeService.enableManualMode('qcar-0', 'joystick');
```

## Key Components

### Web App (`GroundStation-Qcar-App/`)

1. **`services/websocketBridgeService.ts`**
   - WebSocket client connecting to Python GS
   - Handles bidirectional communication
   - Provides clean API for commands

2. **`App.tsx`**
   - Main application component
   - Merges telemetry updates (prevents data loss)
   - Maps state machine states to UI states

3. **`types.ts`**
   - TypeScript definitions matching Python data structures
   - Ensures type safety

### Python GS (`Development/multi_vehicle_self_driving_RealQcar/qcar/GUI/qcar_gui/`)

1. **`controllers/remote_controller.py`**
   - WebSocket server (port 8080)
   - Handles incoming commands from Web GS
   - Broadcasts telemetry to connected clients
   - Merges partial telemetry updates

2. **Vehicle Logic (`vehicle_logic.py`)**
   - Generates high-frequency telemetry (10Hz)
   - Broadcasts periodic status (1Hz)
   - Executes commands received from GS

## State Synchronization

### Vehicle State Mapping

| Python State Machine | Web GS Status           |
|---------------------|------------------------|
| INITIALIZING        | INITIALIZING           |
| WAITING_FOR_START   | IDLE                   |
| FOLLOWING_PATH      | ACTIVE                 |
| FOLLOWING_LEADER    | ACTIVE                 |
| MANUAL_MODE         | MANUAL                 |
| EMERGENCY_STOP      | EMERGENCY_STOP         |
| STOPPED             | STOPPED                |

### Telemetry Merging

The Web GS uses a merging strategy to handle partial updates:

```typescript
const updatedTelemetry = {
  ...v.telemetry,  // Preserve existing values
  ...(msg.x !== undefined && { x: msg.x }),  // Update only if provided
  ...(msg.v2v_active !== undefined && { v2v_active: msg.v2v_active }),
  // ... etc
};
```

This ensures that:
- High-frequency telemetry updates position/velocity
- Low-frequency updates refresh V2V/platoon/controller status
- No data is lost during partial updates

## Command API

### Basic Commands
- `startMission(target)` - Start vehicle(s)
- `stopMission(target)` - Stop vehicle(s)
- `emergencyStop(target)` - Emergency stop

### Manual Control
- `enableManualMode(target, type)` - Enable manual control
- `sendManualControl(throttle, steering, target)` - Send control inputs
- `disableManualMode(target)` - Exit manual mode

### Platoon Control
- `enablePlatoonLeader(target)` - Set as leader
- `enablePlatoonFollower(target, leaderId, gap)` - Set as follower
- `startPlatoon(target, leaderId)` - Start platoon mode

### Runtime Configuration
- `setController(category, type, target)` - Change controller (longitudinal/lateral)
- `setLocalObserver(type, target)` - Change local state estimator
- `setFleetObserver(type, target)` - Change fleet estimator

### Perception
- `setPerception(enabled, target)` - Toggle YOLO perception

## Benefits of This Architecture

1. **Clean Separation**: Web UI is purely presentational, Python handles all vehicle logic
2. **Real-time Updates**: WebSocket ensures instant state reflection
3. **Bi-directional**: Commands from web, telemetry from vehicles
4. **Scalable**: Easy to add new vehicles or commands
5. **Type-Safe**: TypeScript interfaces match Python data structures
6. **Merged Updates**: Partial telemetry updates don't overwrite existing data

## Testing the Integration

1. **Start Python GS**:
   ```bash
   cd Development/multi_vehicle_self_driving_RealQcar/qcar/GUI
   python app_main.py --ws-port 8080
   ```

2. **Start Web GS**:
   ```bash
   cd GroundStation-Qcar-App
   npm run dev
   ```

3. **Connect Vehicles**: QCars will connect to Python GS via TCP

4. **Open Web App**: Navigate to `http://localhost:5173` (or shown port)

5. **Verify**:
   - Vehicle cards show connection status  
   - Telemetry updates in real-time
   - Commands from web affect vehicles
   - Controller/observer types display correctly

## Troubleshooting

- **WebSocket connection fails**: Check Python GS is running on port 8080
- **No telemetry**: Verify vehicles are connected to Python GS
- **Commands not working**: Check browser console for WebSocket errors
- **State not updating**: Verify telemetry merge logic in App.tsx
