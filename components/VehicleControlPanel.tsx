import React, { useState } from 'react';
import { Vehicle, VehicleStatus, LOCAL_OBSERVERS, FLEET_OBSERVERS, LONGITUDINAL_CONTROLLERS, LATERAL_CONTROLLERS, LocalObserverType, FleetObserverType, LongitudinalControllerType, LateralControllerType } from '../types';
import { Eye, Route, MapPin, Settings2, Cpu, BarChart2, Play, Square, AlertOctagon, Gamepad2, Activity } from 'lucide-react';
import { bridgeService } from '../services/websocketBridgeService';
import { MAX_VELOCITY } from '../constants';

interface VehicleControlPanelProps {
    vehicle: Vehicle;
    onManualMode: () => void;
    onStatusChange: (id: string, status: VehicleStatus) => void;
    onSpeedChange: (id: string, speed: number) => void;
}

const VehicleControlPanel: React.FC<VehicleControlPanelProps> = ({
    vehicle,
    onManualMode,
    onStatusChange,
    onSpeedChange
}) => {
    // Runtime Configuration - matching Python car_panel.py RuntimeSwitchingControl
    const [localObserver, setLocalObserver] = useState<LocalObserverType>('ekf');
    const [fleetObserver, setFleetObserver] = useState<FleetObserverType>('consensus');
    const [longController, setLongController] = useState<LongitudinalControllerType>('cacc');
    const [latController, setLatController] = useState<LateralControllerType>('pure_pursuit');

    // Path and Position controls
    const [pathNodes, setPathNodes] = useState('1,2,3,4');
    const [initX, setInitX] = useState('0.0');
    const [initY, setInitY] = useState('0.0');
    const [initTheta, setInitTheta] = useState('0.0');
    const [calibrateGps, setCalibrateGps] = useState(false);

    // Runtime config apply handlers
    const handleApplyLocalObserver = () => {
        bridgeService.setLocalObserver(localObserver, vehicle.id);
    };

    const handleApplyFleetObserver = () => {
        bridgeService.setFleetObserver(fleetObserver, vehicle.id);
    };

    const handleApplyLongController = () => {
        bridgeService.setController('longitudinal', longController, vehicle.id);
    };

    const handleApplyLatController = () => {
        bridgeService.setController('lateral', latController, vehicle.id);
    };

    // Path and Position handlers
    const handleSetPath = () => {
        const nodes = pathNodes.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
        if (nodes.length >= 2) {
            bridgeService.sendCommand('set_path', vehicle.id, { node_sequence: nodes });
        }
    };

    const handleSetInitialPosition = () => {
        const x = parseFloat(initX);
        const y = parseFloat(initY);
        const theta = parseFloat(initTheta);
        if (!isNaN(x) && !isNaN(y) && !isNaN(theta)) {
            bridgeService.sendCommand('set_initial_position', vehicle.id, {
                x, y, theta, calibrate: calibrateGps
            });
        }
    };

    const handleTogglePerception = () => {
        const isActive = vehicle.telemetry.perception_active;
        bridgeService.setPerception(!isActive, vehicle.id);
    };

    // Get state color
    const getStateColor = (state?: string) => {
        if (!state) return 'text-slate-500';
        const upper = state.toUpperCase();
        if (upper.includes('ACTIVE') || upper.includes('FOLLOWING')) return 'text-green-400';
        if (upper.includes('IDLE') || upper.includes('WAITING')) return 'text-yellow-400';
        if (upper.includes('EMERGENCY') || upper.includes('STOP')) return 'text-red-400';
        if (upper.includes('MANUAL')) return 'text-purple-400';
        if (upper.includes('INIT')) return 'text-blue-400';
        return 'text-slate-300';
    };

    return (
        <div className="flex flex-col h-full gap-4 overflow-y-auto custom-scrollbar">

            {/* Vehicle Header & State */}
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white tracking-tight">{vehicle.name}</h2>
                <div className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${getStateColor(vehicle.telemetry.state)} bg-slate-800 border border-slate-700`}>
                    {vehicle.telemetry.state || 'UNKNOWN'}
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-800/50 rounded-lg p-2 flex items-center gap-2">
                    <Activity size={14} className="text-blue-400" />
                    <span className="text-slate-300">{vehicle.telemetry.velocity.toFixed(2)} m/s</span>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-2 flex items-center gap-2">
                    <MapPin size={14} className="text-green-400" />
                    <span className="text-slate-300">({vehicle.telemetry.x.toFixed(1)}, {vehicle.telemetry.y.toFixed(1)})</span>
                </div>
            </div>

            {/* Control Buttons - Always Clickable */}
            <div className="space-y-2">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Vehicle Control</p>
                <div className="flex gap-2">
                    <button
                        onClick={() => onStatusChange(vehicle.id, VehicleStatus.ACTIVE)}
                        className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium bg-green-600 hover:bg-green-700 text-white transition-colors"
                    >
                        <Play size={14} /> Start
                    </button>
                    <button
                        onClick={() => onStatusChange(vehicle.id, VehicleStatus.STOPPED)}
                        className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium bg-amber-600 hover:bg-amber-700 text-white transition-colors"
                    >
                        <Square size={14} /> Stop
                    </button>
                    <button
                        onClick={() => onStatusChange(vehicle.id, VehicleStatus.EMERGENCY_STOP)}
                        className="flex items-center justify-center px-3 py-2 bg-red-900/50 border border-red-700 hover:bg-red-800 text-red-200 rounded-lg transition-colors"
                        title="Emergency Stop"
                    >
                        <AlertOctagon size={16} />
                    </button>
                </div>

                <button
                    onClick={onManualMode}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-lg font-semibold shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all"
                >
                    <Gamepad2 size={16} /> Manual Control
                </button>
            </div>

            {/* Speed Control */}
            <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-400">
                    <span>Target Speed</span>
                    <span>{vehicle.targetSpeed.toFixed(1)} m/s</span>
                </div>
                <input
                    type="range"
                    min="0"
                    max={MAX_VELOCITY}
                    step="0.1"
                    value={vehicle.targetSpeed}
                    onChange={(e) => onSpeedChange(vehicle.id, parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
            </div>

            {/* Path & Position Control */}
            <div className="space-y-3 pt-3 border-t border-slate-700">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <Route size={12} /> Path & Position
                </p>

                {/* Set Path */}
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={pathNodes}
                        onChange={(e) => setPathNodes(e.target.value)}
                        placeholder="1,2,3,4"
                        className="flex-1 bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded px-2 py-1.5"
                    />
                    <button onClick={handleSetPath} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded">
                        Set Path
                    </button>
                </div>

                {/* Set Initial Position */}
                <div className="flex gap-1 items-center">
                    <input type="text" value={initX} onChange={(e) => setInitX(e.target.value)} placeholder="X" className="w-14 bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded px-2 py-1" />
                    <input type="text" value={initY} onChange={(e) => setInitY(e.target.value)} placeholder="Y" className="w-14 bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded px-2 py-1" />
                    <input type="text" value={initTheta} onChange={(e) => setInitTheta(e.target.value)} placeholder="θ" className="w-14 bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded px-2 py-1" />
                    <label className="flex items-center gap-1 text-[10px] text-slate-400">
                        <input type="checkbox" checked={calibrateGps} onChange={(e) => setCalibrateGps(e.target.checked)} className="w-3 h-3" />
                        GPS
                    </label>
                    <button onClick={handleSetInitialPosition} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-2 py-1 rounded">
                        <MapPin size={12} />
                    </button>
                </div>

                {/* Toggle Perception */}
                <button
                    onClick={handleTogglePerception}
                    className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-colors ${vehicle.telemetry.perception_active
                            ? 'bg-green-600 hover:bg-green-700 text-white'
                            : 'bg-slate-700 hover:bg-slate-600 text-slate-300 border border-slate-600'
                        }`}
                >
                    <Eye size={14} /> {vehicle.telemetry.perception_active ? 'YOLO: ON' : 'Activate YOLO'}
                </button>
            </div>

            {/* Runtime Configuration - Matching Python car_panel.py */}
            <div className="space-y-3 pt-3 border-t border-slate-700">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <Settings2 size={12} /> Runtime Config
                </p>

                {/* Local Observer */}
                <div className="flex gap-2 items-center">
                    <span className="text-[10px] text-slate-500 w-16">Local Obs:</span>
                    <select
                        value={localObserver}
                        onChange={(e) => setLocalObserver(e.target.value as LocalObserverType)}
                        className="flex-1 bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded px-2 py-1"
                    >
                        {LOCAL_OBSERVERS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <button onClick={handleApplyLocalObserver} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-2 py-1 rounded">Apply</button>
                </div>

                {/* Fleet Observer */}
                <div className="flex gap-2 items-center">
                    <span className="text-[10px] text-slate-500 w-16">Fleet Obs:</span>
                    <select
                        value={fleetObserver}
                        onChange={(e) => setFleetObserver(e.target.value as FleetObserverType)}
                        className="flex-1 bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded px-2 py-1"
                    >
                        {FLEET_OBSERVERS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <button onClick={handleApplyFleetObserver} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-2 py-1 rounded">Apply</button>
                </div>

                {/* Longitudinal Controller */}
                <div className="flex gap-2 items-center">
                    <span className="text-[10px] text-slate-500 w-16">Long Ctrl:</span>
                    <select
                        value={longController}
                        onChange={(e) => setLongController(e.target.value as LongitudinalControllerType)}
                        className="flex-1 bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded px-2 py-1"
                    >
                        {LONGITUDINAL_CONTROLLERS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button onClick={handleApplyLongController} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-2 py-1 rounded">Apply</button>
                </div>

                {/* Lateral Controller */}
                <div className="flex gap-2 items-center">
                    <span className="text-[10px] text-slate-500 w-16">Lat Ctrl:</span>
                    <select
                        value={latController}
                        onChange={(e) => setLatController(e.target.value as LateralControllerType)}
                        className="flex-1 bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded px-2 py-1"
                    >
                        {LATERAL_CONTROLLERS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button onClick={handleApplyLatController} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-2 py-1 rounded">Apply</button>
                </div>
            </div>

        </div>
    );
};

export default VehicleControlPanel;
