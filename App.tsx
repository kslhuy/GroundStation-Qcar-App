import React, { useState, useEffect, useCallback } from 'react';
import { 
  Activity, 
  AlertTriangle, 
  Globe, 
  Radio, 
  Terminal, 
  Zap,
  LayoutDashboard,
  Settings,
  Network
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

// Internal imports
import { Vehicle, VehicleStatus, LogEntry, VehicleMode } from './types';
import { INITIAL_FLEET, REFRESH_RATE_MS } from './constants';
import { updateVehiclePhysics } from './services/mockVehicleService';
import { VehicleCard } from './components/VehicleCard';
import { TelemetryMap } from './components/TelemetryMap';
import { StatCard } from './components/StatCard';

const App: React.FC = () => {
  // -- State --
  const [vehicles, setVehicles] = useState<Vehicle[]>(INITIAL_FLEET);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(INITIAL_FLEET[0].id);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [globalEStop, setGlobalEStop] = useState(false);
  const [v2vActive, setV2VActive] = useState(false);

  // -- Helpers --
  const addLog = useCallback((message: string, level: LogEntry['level'] = 'INFO', vehicleId?: string) => {
    const newLog: LogEntry = {
      id: uuidv4(),
      timestamp: new Date(),
      message,
      level,
      vehicleId
    };
    setLogs(prev => [newLog, ...prev].slice(0, 50)); // Keep last 50 logs
  }, []);

  // -- Simulation Loop (Physics & Telemetry) --
  useEffect(() => {
    const interval = setInterval(() => {
      setVehicles(currentVehicles => {
        return currentVehicles.map(v => {
          // If global E-Stop is active, force stop physics
          if (globalEStop && v.status !== VehicleStatus.EMERGENCY_STOP) {
            return { ...v, status: VehicleStatus.EMERGENCY_STOP, targetSpeed: 0 };
          }
          return updateVehiclePhysics(v, REFRESH_RATE_MS / 1000);
        });
      });
    }, REFRESH_RATE_MS);

    return () => clearInterval(interval);
  }, [globalEStop]);

  // -- Handlers --
  const handleStatusChange = (id: string, newStatus: VehicleStatus) => {
    setVehicles(prev => prev.map(v => {
      if (v.id === id) {
        addLog(`${v.name} status changed to ${newStatus}`, newStatus === 'ERROR' ? 'ERROR' : 'INFO', v.id);
        return { ...v, status: newStatus, targetSpeed: newStatus === VehicleStatus.IDLE ? 0 : v.targetSpeed };
      }
      return v;
    }));
  };

  const handleSpeedChange = (id: string, speed: number) => {
    setVehicles(prev => prev.map(v => {
      if (v.id === id) return { ...v, targetSpeed: speed };
      return v;
    }));
  };

  const handleConfigChange = (id: string, field: 'controllerType' | 'estimationType', value: string) => {
    setVehicles(prev => prev.map(v => {
      if (v.id === id) {
        addLog(`Updated ${field} to ${value}`, 'INFO', v.id);
        return { ...v, [field]: value };
      }
      return v;
    }));
  };

  const toggleGlobalEStop = () => {
    const newState = !globalEStop;
    setGlobalEStop(newState);
    addLog(
      newState ? "GLOBAL EMERGENCY STOP ACTIVATED" : "Global Emergency Stop Release", 
      newState ? 'ERROR' : 'WARNING'
    );
    
    if (newState) {
      setVehicles(prev => prev.map(v => ({
        ...v,
        status: VehicleStatus.EMERGENCY_STOP,
        targetSpeed: 0
      })));
    } else {
       // Reset to IDLE
       setVehicles(prev => prev.map(v => ({
        ...v,
        status: VehicleStatus.IDLE
      })));
    }
  };

  const toggleV2V = () => {
    const newState = !v2vActive;
    setV2VActive(newState);
    addLog(newState ? "V2V Mesh Network Activated" : "V2V Mesh Network Disabled", 'INFO');
  };

  // -- Derived Metrics --
  const activeVehicles = vehicles.filter(v => v.status === VehicleStatus.ACTIVE).length;
  const avgBattery = vehicles.reduce((acc, v) => acc + v.telemetry.battery, 0) / vehicles.length;
  const totalSpeed = vehicles.reduce((acc, v) => acc + v.telemetry.velocity, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col overflow-hidden">
      
      {/* Top Navigation Bar */}
      <header className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between flex-shrink-0 z-20 shadow-md">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg">
             <Globe className="text-white" size={20} />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight text-white">QCar Ground Station</h1>
            <p className="text-xs text-slate-400">Autonomous Fleet Control</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4 text-sm text-slate-400">
            <span className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${activeVehicles > 0 ? 'bg-green-500 animate-pulse' : 'bg-slate-600'}`} />
              Sys: {activeVehicles > 0 ? 'ONLINE' : 'STANDBY'}
            </span>
            <span className="hidden md:inline">|</span>
            <button 
              onClick={toggleV2V}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-semibold transition-all
                ${v2vActive 
                  ? 'bg-indigo-900/50 border-indigo-500 text-indigo-300 shadow-[0_0_10px_rgba(99,102,241,0.3)]' 
                  : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'
                }
              `}
            >
              <Network size={14} />
              {v2vActive ? 'V2V ONLINE' : 'ENABLE V2V'}
            </button>
          </div>

          <button 
            onClick={toggleGlobalEStop}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold transition-all shadow-lg
              ${globalEStop 
                ? 'bg-red-600 text-white animate-pulse ring-4 ring-red-900' 
                : 'bg-slate-800 text-red-500 border border-red-900/50 hover:bg-red-950'
              }
            `}
          >
            <AlertTriangle size={18} />
            {globalEStop ? 'E-STOP ACTIVE' : 'EMERGENCY STOP'}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden p-4 gap-4">
        
        {/* Left Column: Fleet List (Scrollable) */}
        <section className="lg:w-1/4 flex flex-col gap-4 min-w-[300px]">
           <div className="flex items-center justify-between mb-1 px-1">
              <h2 className="font-semibold text-slate-300 flex items-center gap-2">
                <Radio size={18} /> Fleet Overview
              </h2>
              <span className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-400">Total: {vehicles.length}</span>
           </div>
           
           <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
             {vehicles.map(v => (
               <VehicleCard 
                  key={v.id} 
                  vehicle={v} 
                  isSelected={v.id === selectedVehicleId}
                  onSelect={() => setSelectedVehicleId(v.id)}
                  onStatusChange={handleStatusChange}
                  onSpeedChange={handleSpeedChange}
                  onConfigChange={handleConfigChange}
               />
             ))}
             
             {/* Add New Mock Button */}
             <button className="w-full py-3 border-2 border-dashed border-slate-800 rounded-xl text-slate-600 hover:text-slate-400 hover:border-slate-700 transition-colors text-sm font-medium flex items-center justify-center gap-2">
                + Add Vehicle
             </button>
           </div>
        </section>

        {/* Middle Column: Map & Telemetry (Main View) */}
        <section className="flex-1 flex flex-col gap-4 overflow-y-auto lg:overflow-hidden">
          
          {/* Metrics Strip */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-shrink-0">
            <StatCard 
              title="Active Units" 
              value={activeVehicles} 
              icon={Radio} 
              color="text-green-400"
            />
            <StatCard 
              title="Fleet Battery" 
              value={`${avgBattery.toFixed(0)}%`} 
              icon={Zap} 
              color="text-yellow-400"
              trend={avgBattery < 20 ? "Low Power" : "Stable"}
              trendColor={avgBattery < 20 ? "text-red-500" : "text-green-500"}
            />
             <StatCard 
              title="Network Load" 
              value={`${(totalSpeed * 12).toFixed(0)} KB/s`} 
              icon={Activity} 
              color="text-blue-400"
            />
          </div>

          {/* Map Visualization */}
          <div className="flex-1 flex flex-col bg-slate-900/50 border border-slate-800 rounded-xl p-1 relative min-h-[400px]">
             <div className="absolute top-4 left-4 z-10 bg-slate-900/80 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-700 shadow-sm">
               <h3 className="text-xs font-mono text-slate-400 uppercase">Spatial Telemetry</h3>
             </div>
             <div className="flex-1 p-2">
                <TelemetryMap 
                  vehicles={vehicles} 
                  selectedVehicleId={selectedVehicleId} 
                  onSelectVehicle={setSelectedVehicleId}
                  isV2VActive={v2vActive}
                />
             </div>
          </div>
        </section>

        {/* Right Column: Logs (Expanded since Copilot removed) */}
        <section className="lg:w-1/4 flex flex-col gap-4 min-w-[300px]">
          
          {/* System Logs (Now taking full height of this column) */}
          <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl flex flex-col overflow-hidden shadow-sm h-full">
            <div className="p-3 border-b border-slate-800 flex justify-between items-center bg-slate-800/30">
              <div className="flex items-center gap-2 text-slate-300">
                <Terminal size={16} />
                <span className="text-sm font-medium">System Log</span>
              </div>
              <button onClick={() => setLogs([])} className="text-xs text-slate-500 hover:text-slate-300">Clear</button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 font-mono text-xs space-y-2 custom-scrollbar bg-slate-950">
              {logs.length === 0 && (
                <div className="text-center text-slate-700 mt-10 italic">No recent activity</div>
              )}
              {logs.map(log => (
                <div key={log.id} className="flex gap-2 animate-in fade-in slide-in-from-left-1 duration-200">
                  <span className="text-slate-600 shrink-0">
                    {log.timestamp.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' })}
                  </span>
                  <span className={`
                    ${log.level === 'ERROR' ? 'text-red-400 font-bold' : ''}
                    ${log.level === 'WARNING' ? 'text-yellow-400' : ''}
                    ${log.level === 'SUCCESS' ? 'text-green-400' : ''}
                    ${log.level === 'INFO' ? 'text-slate-300' : ''}
                  `}>
                    {log.vehicleId && <span className="text-slate-500 mr-1">[{log.vehicleId}]</span>}
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;