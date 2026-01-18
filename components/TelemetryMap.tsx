import React from 'react';
import { Vehicle, VehicleStatus } from '../types';
import { Navigation, Wifi } from 'lucide-react';

// New Map Config
const MAP_WIDTH_METERS = 12; // -6 to 6
const MAP_HEIGHT_METERS = 6; // -3 to 3
const MAP_OFFSET_X = 6;      // Offset to center
const MAP_OFFSET_Y = 3;      // Offset to center

interface TelemetryMapProps {
  vehicles: Vehicle[];
  selectedVehicleId: string | null;
  onSelectVehicle: (id: string) => void;
  isV2VActive: boolean;
}

export const TelemetryMap: React.FC<TelemetryMapProps> = ({ vehicles, selectedVehicleId, onSelectVehicle, isV2VActive }) => {
  // Convert meters to percentage for CSS positioning
  // Convert meters to percentage for CSS positioning
  // Input: x [-6, 6], y [-3, 3] -> Output: [0, 100]%
  const scaleX = (x: number) => ((x + MAP_OFFSET_X) / MAP_WIDTH_METERS) * 100;
  const scaleY = (y: number) => (100 - ((y + MAP_OFFSET_Y) / MAP_HEIGHT_METERS) * 100); // Invert Y

  // Filter active vehicles for V2V lines
  const activeVehicles = vehicles.filter(v => v.status !== VehicleStatus.DISCONNECTED && v.status !== VehicleStatus.ERROR);

  return (
    <div className="relative w-full h-[400px] bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-inner group">
      {/* Grid Lines */}
      <div className="absolute inset-0"
        style={{
          backgroundImage: 'linear-gradient(#334155 1px, transparent 1px), linear-gradient(90deg, #334155 1px, transparent 1px)',
          backgroundSize: '10% 10%'
        }}>
      </div>

      <div className="absolute bottom-2 left-2 text-xs text-slate-500 font-mono">
        (0,0) Center
      </div>

      {/* V2V Network Visualization Layer */}
      {isV2VActive && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
          <defs>
            <linearGradient id="v2vGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(99, 102, 241, 0)" />
              <stop offset="50%" stopColor="rgba(99, 102, 241, 0.6)" />
              <stop offset="100%" stopColor="rgba(99, 102, 241, 0)" />
            </linearGradient>
            <marker id="dot" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5">
              <circle cx="5" cy="5" r="5" fill="#818cf8" />
            </marker>
          </defs>
          {activeVehicles.map((v1, i) =>
            activeVehicles.slice(i + 1).map(v2 => (
              <line
                key={`${v1.id}-${v2.id}`}
                x1={`${scaleX(v1.telemetry.x)}%`}
                y1={`${scaleY(v1.telemetry.y)}%`}
                x2={`${scaleX(v2.telemetry.x)}%`}
                y2={`${scaleY(v2.telemetry.y)}%`}
                stroke="url(#v2vGradient)"
                strokeWidth="2"
                strokeDasharray="5,5"
                className="animate-pulse"
              />
            ))
          )}
        </svg>
      )}

      {/* Vehicles */}
      {vehicles.map((v) => {
        const isSelected = v.id === selectedVehicleId;
        const isOffline = v.status === VehicleStatus.DISCONNECTED;

        return (
          <div
            key={v.id}
            onClick={() => onSelectVehicle(v.id)}
            className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300 cursor-pointer
              ${isSelected ? 'z-50 scale-110' : 'z-10 hover:scale-110'}
            `}
            style={{
              left: `${scaleX(v.telemetry.x)}%`,
              top: `${scaleY(v.telemetry.y)}%`,
            }}
          >
            {/* V2V Indicator Badge */}
            {isV2VActive && !isOffline && (
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-indigo-600/90 text-white text-[8px] px-1 rounded-full flex items-center gap-0.5 border border-indigo-400 animate-bounce shadow-[0_0_10px_rgba(99,102,241,0.5)]">
                <Wifi size={8} /> V2V
              </div>
            )}

            {/* Vehicle Icon/Shape */}
            <div className="relative">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 shadow-lg transition-colors
                  ${isSelected ? 'border-blue-400 shadow-blue-500/30' : 'border-slate-600'}
                  ${isOffline ? 'bg-slate-800' : v.status === VehicleStatus.ERROR ? 'bg-red-900/80' : 'bg-indigo-600'}
                `}
                style={{
                  transform: `rotate(${-v.telemetry.theta}rad)` // Visual rotation
                }}
              >
                <Navigation size={16} className="text-white transform rotate-45" />
              </div>

              {/* Label */}
              <div className={`absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-bold px-2 py-0.5 rounded bg-slate-900/80 backdrop-blur
                 ${isSelected ? 'text-blue-400 border border-blue-500/30' : 'text-slate-300'}
              `}>
                {v.name}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};