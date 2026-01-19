import React, { useState } from 'react';
import {
  Vehicle, VehicleStatus,
  LOCAL_OBSERVERS, FLEET_OBSERVERS, LONGITUDINAL_CONTROLLERS, LATERAL_CONTROLLERS,
  LocalObserverType, FleetObserverType, LongitudinalControllerType, LateralControllerType
} from '../types';
import { Battery, Wifi, WifiOff, AlertOctagon, Play, Square, Activity, Settings2, Edit2, Check, Eye, Route, MapPin } from 'lucide-react';
import { MAX_VELOCITY } from '../constants';
import { bridgeService } from '../services/websocketBridgeService';

interface VehicleCardProps {
  vehicle: Vehicle;
  isSelected: boolean;
  onSelect: () => void;
  onStatusChange: (id: string, status: VehicleStatus) => void;
  onSpeedChange: (id: string, speed: number) => void;
  onNameChange?: (id: string, name: string) => void;
}

export const VehicleCard: React.FC<VehicleCardProps> = ({
  vehicle,
  isSelected,
  onSelect,
  onStatusChange,
  onSpeedChange,
  onNameChange,
}) => {
  const isOnline = vehicle.status !== VehicleStatus.DISCONNECTED;
  const isEmergency = vehicle.status === VehicleStatus.EMERGENCY_STOP;

  // Editable name state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(vehicle.name);

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

  const handleNameSave = () => {
    if (editedName.trim() && onNameChange) {
      onNameChange(vehicle.id, editedName.trim());
    }
    setIsEditingName(false);
  };

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
    if (isActive) {
      bridgeService.setPerception(false, vehicle.id);
    } else {
      bridgeService.setPerception(true, vehicle.id);
    }
  };

  // Get state color based on raw state string from Python
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
    <div
      onClick={onSelect}
      className={`relative p-4 rounded-xl border transition-all cursor-pointer overflow-hidden
        ${isSelected
          ? 'bg-slate-800/80 border-blue-500 shadow-lg shadow-blue-900/20'
          : 'bg-slate-800/30 border-slate-700 hover:border-slate-600'
        }
      `}
    >
      {/* Header Status Line */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 flex-1">
          <div className={`w-2 h-2 rounded-full animate-pulse ${isOnline ? (isEmergency ? 'bg-red-500' : 'bg-green-500') : 'bg-slate-500'}`} />
          {isEditingName ? (
            <div className="flex items-center gap-1 flex-1">
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleNameSave(); }}
                className="bg-slate-700 text-slate-100 px-2 py-0.5 rounded text-sm font-semibold flex-1 max-w-[120px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
              <button
                onClick={(e) => { e.stopPropagation(); handleNameSave(); }}
                className="p-1 hover:bg-slate-700 rounded"
              >
                <Check size={14} className="text-green-400" />
              </button>
            </div>
          ) : (
            <h3
              className="font-semibold text-slate-100 cursor-pointer hover:text-indigo-400 transition-colors flex items-center gap-1 group"
              onDoubleClick={(e) => { e.stopPropagation(); setIsEditingName(true); }}
              title="Double-click to edit"
            >
              {vehicle.name}
              <Edit2 size={12} className="opacity-0 group-hover:opacity-50 transition-opacity" />
            </h3>
          )}
        </div>
        {isOnline ? <Wifi size={16} className="text-green-500" /> : <WifiOff size={16} className="text-slate-500" />}
      </div>

      {/* Vehicle State Display - Show raw state from Python */}
      <div className="mb-3 px-2 py-1 bg-slate-900/70 rounded border border-slate-700">
        <div className="text-[10px] text-slate-500 uppercase tracking-wide">State from Vehicle</div>
        <div className={`text-xs font-mono font-semibold ${getStateColor(vehicle.telemetry.state)}`}>
          {isOnline ? (vehicle.telemetry.state || 'UNKNOWN') : 'OFFLINE'}
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="flex items-center gap-2 text-slate-400 text-xs bg-slate-900/50 p-2 rounded">
          <Battery size={14} className={vehicle.telemetry.battery < 20 ? 'text-red-400' : 'text-green-400'} />
          <span>{vehicle.telemetry.battery.toFixed(0)}%</span>
        </div>
        <div className="flex items-center gap-2 text-slate-400 text-xs bg-slate-900/50 p-2 rounded">
          <Activity size={14} className="text-blue-400" />
          <span>{vehicle.telemetry.velocity.toFixed(2)} m/s</span>
        </div>
      </div>

      {/* Controls - Only visible if selected/expanded */}
      {isSelected && isOnline && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">

          {/* Action Buttons - Always clickable */}
          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStatusChange(vehicle.id, VehicleStatus.ACTIVE);
              }}
              className="flex-1 flex items-center justify-center gap-2 py-1.5 rounded text-sm font-medium bg-green-600 hover:bg-green-700 text-white transition-colors"
            >
              <Play size={14} /> Start
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStatusChange(vehicle.id, VehicleStatus.STOPPED);
              }}
              className="flex-1 flex items-center justify-center gap-2 py-1.5 rounded text-sm font-medium bg-amber-600 hover:bg-amber-700 text-white transition-colors"
            >
              <Square size={14} /> Stop
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onStatusChange(vehicle.id, VehicleStatus.EMERGENCY_STOP); }}
              className="flex items-center justify-center px-3 bg-red-900/50 border border-red-700 hover:bg-red-800 text-red-200 rounded transition-colors"
              title="Emergency Stop"
            >
              <AlertOctagon size={16} />
            </button>
          </div>

          {/* Speed Control */}
          <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
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
          <div className="pt-3 border-t border-slate-700 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1">
              <Route size={12} />
              <span>PATH & POSITION</span>
            </div>

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
              <input type="text" value={initX} onChange={(e) => setInitX(e.target.value)} placeholder="X" className="w-12 bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded px-1 py-1" />
              <input type="text" value={initY} onChange={(e) => setInitY(e.target.value)} placeholder="Y" className="w-12 bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded px-1 py-1" />
              <input type="text" value={initTheta} onChange={(e) => setInitTheta(e.target.value)} placeholder="θ" className="w-12 bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded px-1 py-1" />
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
              className={`w-full flex items-center justify-center gap-2 py-1.5 rounded text-xs font-medium transition-colors ${vehicle.telemetry.perception_active
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-300 border border-slate-600'
                }`}
            >
              <Eye size={14} /> {vehicle.telemetry.perception_active ? 'YOLO: ON' : 'Activate YOLO'}
            </button>
          </div>

          {/* Runtime Configuration - Matching Python car_panel.py */}
          <div className="pt-3 border-t border-slate-700 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1">
              <Settings2 size={12} />
              <span>RUNTIME CONFIG</span>
            </div>

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
      )}

      {/* Offline Overlay */}
      {!isOnline && (
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[1px] flex items-center justify-center z-10">
          <span className="text-slate-400 text-sm">Waiting for connection...</span>
        </div>
      )}
    </div>
  );
};