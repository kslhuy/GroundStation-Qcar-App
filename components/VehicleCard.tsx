import React from 'react';
import { Vehicle, VehicleStatus, VehicleMode, ControllerType, EstimationType } from '../types';
import { Battery, Wifi, WifiOff, AlertOctagon, Play, Square, Activity, Settings2, Cpu, BarChart2 } from 'lucide-react';
import { MAX_VELOCITY } from '../constants';

interface VehicleCardProps {
  vehicle: Vehicle;
  isSelected: boolean;
  onSelect: () => void;
  onStatusChange: (id: string, status: VehicleStatus) => void;
  onSpeedChange: (id: string, speed: number) => void;
  onConfigChange: (id: string, field: 'controllerType' | 'estimationType', value: string) => void;
}

export const VehicleCard: React.FC<VehicleCardProps> = ({
  vehicle,
  isSelected,
  onSelect,
  onStatusChange,
  onSpeedChange,
  onConfigChange,
}) => {
  const isOnline = vehicle.status !== VehicleStatus.DISCONNECTED;
  const isEmergency = vehicle.status === VehicleStatus.EMERGENCY_STOP;

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
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full animate-pulse ${isOnline ? (isEmergency ? 'bg-red-500' : 'bg-green-500') : 'bg-slate-500'}`} />
          <h3 className="font-semibold text-slate-100">{vehicle.name}</h3>
        </div>
        {isOnline ? <Wifi size={16} className="text-green-500" /> : <WifiOff size={16} className="text-slate-500" />}
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="flex items-center gap-2 text-slate-400 text-xs bg-slate-900/50 p-2 rounded">
          <Battery size={14} className={vehicle.telemetry.battery < 20 ? 'text-red-400' : 'text-green-400'} />
          <span>{vehicle.telemetry.battery.toFixed(0)}%</span>
        </div>
        <div className="flex items-center gap-2 text-slate-400 text-xs bg-slate-900/50 p-2 rounded">
          <Activity size={14} className="text-blue-400" />
          <span>{vehicle.telemetry.velocity.toFixed(1)} m/s</span>
        </div>
      </div>

      {/* Controls - Only visible if selected/expanded */}
      {isSelected && isOnline && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          
          {/* Action Buttons */}
          <div className="flex gap-2">
            {vehicle.status === VehicleStatus.IDLE || vehicle.status === VehicleStatus.ERROR ? (
              <button 
                onClick={(e) => { e.stopPropagation(); onStatusChange(vehicle.id, VehicleStatus.ACTIVE); }}
                className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-1.5 rounded text-sm font-medium transition-colors"
              >
                <Play size={14} /> Start
              </button>
            ) : (
              <button 
                onClick={(e) => { e.stopPropagation(); onStatusChange(vehicle.id, VehicleStatus.IDLE); }}
                className="flex-1 flex items-center justify-center gap-2 bg-yellow-600 hover:bg-yellow-700 text-white py-1.5 rounded text-sm font-medium transition-colors"
              >
                <Square size={14} /> Idle
              </button>
            )}
            
            <button 
              onClick={(e) => { e.stopPropagation(); onStatusChange(vehicle.id, VehicleStatus.EMERGENCY_STOP); }}
              className="flex items-center justify-center px-3 bg-red-900/50 border border-red-700 hover:bg-red-800 text-red-200 rounded transition-colors"
              title="Individual E-Stop"
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

          {/* Advanced Configuration Section */}
          <div className="pt-3 border-t border-slate-700 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1">
              <Settings2 size={12} />
              <span>LOGIC CONFIGURATION</span>
            </div>

            {/* Controller Logic */}
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500 uppercase flex items-center gap-1">
                <Cpu size={10} /> Controller
              </label>
              <div className="flex bg-slate-900 rounded-md p-0.5 border border-slate-700">
                <button
                  onClick={() => onConfigChange(vehicle.id, 'controllerType', ControllerType.PID)}
                  className={`flex-1 py-1 text-xs rounded-sm transition-all ${vehicle.controllerType === ControllerType.PID ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  PID
                </button>
                <button
                  onClick={() => onConfigChange(vehicle.id, 'controllerType', ControllerType.ACC)}
                  className={`flex-1 py-1 text-xs rounded-sm transition-all ${vehicle.controllerType === ControllerType.ACC ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  ACC
                </button>
              </div>
            </div>

            {/* Estimation Logic */}
            <div className="space-y-1">
               <label className="text-[10px] text-slate-500 uppercase flex items-center gap-1">
                <BarChart2 size={10} /> Estimation
              </label>
              <div className="grid grid-cols-2 gap-1">
                <button
                  onClick={() => onConfigChange(vehicle.id, 'estimationType', EstimationType.LOCAL_KALMAN)}
                  className={`py-1.5 px-2 text-[10px] rounded border transition-all truncate ${
                    vehicle.estimationType === EstimationType.LOCAL_KALMAN 
                    ? 'bg-slate-700 border-indigo-500 text-indigo-300' 
                    : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-600'
                  }`}
                >
                  Local Kalman
                </button>
                <button
                  onClick={() => onConfigChange(vehicle.id, 'estimationType', EstimationType.DISTRIBUTED_OBSERVER)}
                  className={`py-1.5 px-2 text-[10px] rounded border transition-all truncate ${
                    vehicle.estimationType === EstimationType.DISTRIBUTED_OBSERVER 
                    ? 'bg-slate-700 border-indigo-500 text-indigo-300' 
                    : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-600'
                  }`}
                >
                  Dist. Observer
                </button>
              </div>
            </div>
          </div>

          {/* Mode Indicator */}
          <div className="text-xs text-center text-slate-500 pt-1">
            Mode: <span className="text-slate-300 uppercase">{vehicle.mode}</span>
          </div>
        </div>
      )}

      {/* Offline Overlay */}
      {!isOnline && (
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[1px] flex items-center justify-center z-10">
           <button 
             onClick={(e) => { e.stopPropagation(); onStatusChange(vehicle.id, VehicleStatus.IDLE); }}
             className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-full shadow-lg border border-slate-500 transition-all"
           >
             Connect
           </button>
        </div>
      )}
    </div>
  );
};