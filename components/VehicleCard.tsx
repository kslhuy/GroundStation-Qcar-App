import React, { useState } from 'react';
import { Vehicle, VehicleStatus } from '../types';
import { Battery, Wifi, WifiOff, Activity, Edit2, Check } from 'lucide-react';

interface VehicleCardProps {
  vehicle: Vehicle;
  isSelected: boolean;
  onSelect: () => void;
  onNameChange?: (id: string, name: string) => void;
}

export const VehicleCard: React.FC<VehicleCardProps> = ({
  vehicle,
  isSelected,
  onSelect,
  onNameChange,
}) => {
  const isOnline = vehicle.status !== VehicleStatus.DISCONNECTED;

  // Editable name state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(vehicle.name);

  const handleNameSave = () => {
    if (editedName.trim() && onNameChange) {
      onNameChange(vehicle.id, editedName.trim());
    }
    setIsEditingName(false);
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
      className={`relative p-3 rounded-xl border transition-all cursor-pointer overflow-hidden
        ${isSelected
          ? 'bg-slate-800/80 border-blue-500 shadow-lg shadow-blue-900/20'
          : 'bg-slate-800/30 border-slate-700 hover:border-slate-600'
        }
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 flex-1">
          <div className={`w-2 h-2 rounded-full animate-pulse ${isOnline ? 'bg-green-500' : 'bg-slate-500'}`} />
          {isEditingName ? (
            <div className="flex items-center gap-1 flex-1">
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleNameSave(); }}
                className="bg-slate-700 text-slate-100 px-2 py-0.5 rounded text-sm font-semibold flex-1 max-w-[100px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
              <button
                onClick={(e) => { e.stopPropagation(); handleNameSave(); }}
                className="p-1 hover:bg-slate-700 rounded"
              >
                <Check size={12} className="text-green-400" />
              </button>
            </div>
          ) : (
            <h3
              className="font-semibold text-slate-100 text-sm cursor-pointer hover:text-indigo-400 transition-colors flex items-center gap-1 group"
              onDoubleClick={(e) => { e.stopPropagation(); setIsEditingName(true); }}
              title="Double-click to edit"
            >
              {vehicle.name}
              <Edit2 size={10} className="opacity-0 group-hover:opacity-50 transition-opacity" />
            </h3>
          )}
        </div>
        {isOnline ? <Wifi size={14} className="text-green-500" /> : <WifiOff size={14} className="text-slate-500" />}
      </div>

      {/* State from Python */}
      <div className={`text-xs font-mono font-semibold mb-2 ${getStateColor(vehicle.telemetry.state)}`}>
        {isOnline ? (vehicle.telemetry.state || 'UNKNOWN') : 'OFFLINE'}
      </div>

      {/* Quick Stats */}
      <div className="flex gap-3 text-[10px] text-slate-400">
        <div className="flex items-center gap-1">
          <Battery size={12} className={vehicle.telemetry.battery < 20 ? 'text-red-400' : 'text-green-400'} />
          <span>{vehicle.telemetry.battery.toFixed(0)}%</span>
        </div>
        <div className="flex items-center gap-1">
          <Activity size={12} className="text-blue-400" />
          <span>{vehicle.telemetry.velocity.toFixed(1)} m/s</span>
        </div>
      </div>

      {/* Offline Overlay */}
      {!isOnline && (
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[1px] flex items-center justify-center z-10">
          <span className="text-slate-400 text-xs">Waiting...</span>
        </div>
      )}
    </div>
  );
};