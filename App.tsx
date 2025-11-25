import React, { useState, useEffect, useCallback } from 'react';
import { 
  Activity, 
  AlertTriangle, 
  Globe, 
  Radio, 
  Terminal, 
  Network,
  Play,
  Square,
  Route,
  Settings2,
  Code
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

  // -- Mission Parameters (Global) --
  // These allow the user to "Modify" the data before sending
  const [globalSpeed, setGlobalSpeed] = useState<number>(1.0);
  const [globalPath, setGlobalPath] = useState<string>('FIGURE_8');

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

  // -- Command Broadcasting (Global) --
  // This helper function simulates the network transmission and logs the EXACT data payload
  const broadcastCommand = (action: string, params: object = {}) => {
    if (globalEStop && action !== 'EMERGENCY_STOP') return;

    // 1. Construct the Protocol Payload
    // This is the actual JSON that would be sent over TCP/IP to the fleet
    const payload = {
      header: {
        timestamp: Date.now(),
        msg_id: uuidv4().slice(0, 8),
        type: "FLEET_COMMAND"
      },
      body: {
        action: action,
        parameters: params,
        target_group: "ALL_ACTIVE"
      }
    };

    // 2. Log the Payload for the user to see
    addLog(`TX >> ${JSON.stringify(payload.body)}`, 'SUCCESS');

    return payload;
  };

  const handleGlobalStart = () => {
    // Execute Broadcast
    broadcastCommand("START_MISSION", { 
      target_speed: globalSpeed, 
      sync_mode: "IMMEDIATE" 
    });

    // Update State
    setVehicles(prev => prev.map(v => {
      if (v.status !== VehicleStatus.DISCONNECTED && v.status !== VehicleStatus.ERROR) {
        return { ...v, status: VehicleStatus.ACTIVE, targetSpeed: globalSpeed };
      }
      return v;
    }));
  };

  const handleGlobalStop = () => {
    broadcastCommand("HALT_MISSION", { 
      deceleration_profile: "STANDARD",
      final_state: "IDLE" 
    });

    setVehicles(prev => prev.map(v => {
      if (v.status !== VehicleStatus.DISCONNECTED && v.status !== VehicleStatus.EMERGENCY_STOP) {
        return { ...v, status: VehicleStatus.IDLE, targetSpeed: 0 };
      }
      return v;
    }));
  };

  const handleGlobalPathUpdate = () => {
    // Construct the specific Path Data Payload
    const pathData = {
      path_id: globalPath,
      waypoints_count: globalPath === 'FIGURE_8' ? 42 : 24,
      curvature_max: 0.8,
      speed_limit: globalSpeed
    };

    broadcastCommand("UPDATE_WAYPOINTS", pathData);

    setVehicles(prev => prev.map(v => {
      if (v.status !== VehicleStatus.DISCONNECTED) {
        return { 
          ...v, 
          mode: VehicleMode.AUTONOMOUS,
          status: VehicleStatus.ACTIVE,
          targetSpeed: globalSpeed 
        };
      }
      return v;
    }));
  };

  const toggleGlobalEStop = () => {
    const newState = !globalEStop;
    setGlobalEStop(newState);
    
    // High Priority Safety Command
    broadcastCommand("EMERGENCY_OVERRIDE", { state: newState ? "ENGAGED" : "RELEASED" });

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
       setVehicles(prev => prev.map(v => ({
        ...v,
        status: VehicleStatus.IDLE
      })));
    }
  };

  const toggleV2V = () => {
    const newState = !v2vActive;
    setV2VActive(newState);
    broadcastCommand("V2V_NETWORK_CONFIG", { enabled: newState, protocol: "MESH_V2" });
    addLog(newState ? "V2V Mesh Network Activated" : "V2V Mesh Network Disabled", 'INFO');
  };

  // -- Derived Metrics & Calculations --
  
  const activeVehicles = vehicles.filter(v => v.status === VehicleStatus.ACTIVE).length;
  const connectedCount = vehicles.filter(v => v.status !== VehicleStatus.DISCONNECTED).length;
  const totalSpeed = vehicles.reduce((acc, v) => acc + v.telemetry.velocity, 0);
  
  // -- Network Load Calculation Explanation --
  // The system estimates the current bandwidth usage on the control network.
  // 
  // Formula: Load = (Base_KeepAlive * N_Cars) + (Telemetry_Rate * Total_Velocity * Scale_Factor)
  // 
  // 1. Base_KeepAlive (1 KB/s): Constant heartbeat data (status, battery, mode) per connected vehicle.
  // 2. Telemetry_Rate (~12 KB/s): When moving, vehicles send high-freq pose updates (LiDAR/IMU fusion data).
  //    Higher velocity requires more frequent updates for the Distributed Observer to converge.
  // 
  // Example: 3 cars @ 1.0 m/s = (3 * 1) + (3 * 1.0 * 12) = 3 + 36 = 39 KB/s
  const networkLoadValue = (connectedCount * 1) + (totalSpeed * 12); 

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
        
        {/* Left Column: Fleet List */}
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
             
             <button className="w-full py-3 border-2 border-dashed border-slate-800 rounded-xl text-slate-600 hover:text-slate-400 hover:border-slate-700 transition-colors text-sm font-medium flex items-center justify-center gap-2">
                + Add Vehicle
             </button>
           </div>
        </section>

        {/* Middle Column: Map & Mission Control */}
        <section className="flex-1 flex flex-col gap-4 overflow-y-auto lg:overflow-hidden">
          
          {/* Mission Control Panel */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-shrink-0">
            
            {/* Stat: Active Units */}
            <div className="md:col-span-1">
               <StatCard 
                title="Active Units" 
                value={activeVehicles} 
                icon={Radio} 
                color="text-green-400"
              />
            </div>
            
            {/* Mission Control Center (Wider) */}
            <div className="md:col-span-2 bg-slate-800/50 backdrop-blur-sm border border-slate-700 p-3 rounded-xl shadow-sm flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs font-medium text-slate-400 border-b border-slate-700/50 pb-1">
                <span className="flex items-center gap-2"><Terminal size={12} /> MISSION CONTROL CENTER</span>
                <span className="text-[10px] text-slate-500">BROADCAST</span>
              </div>
              
              <div className="flex gap-4 h-full">
                 {/* Left: Controls */}
                 <div className="flex-1 flex flex-col justify-between gap-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>Ref Speed: <span className="text-indigo-300">{globalSpeed.toFixed(1)} m/s</span></span>
                      <Settings2 size={10} />
                    </div>
                    <input 
                      type="range" min="0" max="2.0" step="0.1"
                      value={globalSpeed}
                      onChange={(e) => setGlobalSpeed(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                    
                    <div className="flex items-center gap-2 mt-1">
                       <select 
                        value={globalPath}
                        onChange={(e) => setGlobalPath(e.target.value)}
                        className="bg-slate-900 border border-slate-700 text-xs text-slate-300 rounded px-2 py-1 flex-1 focus:ring-1 focus:ring-indigo-500 outline-none"
                       >
                         <option value="OVAL_TRACK">Oval Track</option>
                         <option value="FIGURE_8">Figure 8</option>
                         <option value="INFINITE_LOOP">Infinite Loop</option>
                         <option value="CONVOY_LINE">Convoy Line</option>
                       </select>
                    </div>
                 </div>

                 {/* Right: Actions */}
                 <div className="flex flex-col gap-2 w-1/2">
                    <div className="flex gap-1">
                      <button 
                        onClick={handleGlobalStart}
                        disabled={globalEStop}
                        className="flex-1 bg-green-900/30 hover:bg-green-600 hover:text-white border border-green-800 text-green-400 rounded p-1.5 flex items-center justify-center transition-all disabled:opacity-30"
                        title="Start Mission (Broadcast)"
                      >
                        <Play size={16} />
                      </button>
                      <button 
                        onClick={handleGlobalStop}
                        className="flex-1 bg-yellow-900/30 hover:bg-yellow-600 hover:text-white border border-yellow-800 text-yellow-400 rounded p-1.5 flex items-center justify-center transition-all"
                        title="Halt Mission (Idle)"
                      >
                        <Square size={14} />
                      </button>
                    </div>
                    <button 
                      onClick={handleGlobalPathUpdate}
                      disabled={globalEStop}
                      className="flex-1 bg-indigo-900/30 hover:bg-indigo-600 hover:text-white border border-indigo-800 text-indigo-400 rounded p-1 flex items-center justify-center gap-2 text-xs font-medium transition-all disabled:opacity-30"
                      title="Upload New Path Data"
                    >
                      <Route size={14} /> Deploy Path
                    </button>
                 </div>
              </div>
            </div>

            {/* Stat: Network Load */}
            <div className="md:col-span-1">
               <StatCard 
                title="Network Load" 
                value={`${networkLoadValue.toFixed(0)} KB/s`} 
                icon={Activity} 
                color="text-blue-400"
              />
            </div>
          </div>

          {/* Map Visualization */}
          <div className="flex-1 flex flex-col bg-slate-900/50 border border-slate-800 rounded-xl p-1 relative min-h-[400px]">
             <div className="absolute top-4 left-4 z-10 bg-slate-900/80 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-700 shadow-sm pointer-events-none">
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

        {/* Right Column: System Logs */}
        <section className="lg:w-1/4 flex flex-col gap-4 min-w-[300px]">
          
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
                <div key={log.id} className="flex gap-2 animate-in fade-in slide-in-from-left-1 duration-200 break-all">
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
                    {log.message.includes("TX >>") ? (
                      <span className="font-mono text-[10px] text-green-300/80 block border-l-2 border-green-800 pl-2 mt-1">
                         <span className="flex items-center gap-1 opacity-50 mb-0.5"><Code size={8}/> PAYLOAD SENT</span>
                         {log.message.replace("TX >> ", "")}
                      </span>
                    ) : (
                      log.message
                    )}
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