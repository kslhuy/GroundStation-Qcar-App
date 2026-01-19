
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
  Plug,
  PlugZap,
  Gamepad2,
  Link2,
  Eye,
  X
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

// Internal imports
import { Vehicle, VehicleStatus, LogEntry } from './types';
import { INITIAL_FLEET, REFRESH_RATE_MS } from './constants';
import { updateVehiclePhysics } from './services/mockVehicleService';
import { VehicleCard } from './components/VehicleCard';
import { TelemetryMap } from './components/TelemetryMap';
import { StatCard } from './components/StatCard';
import { bridgeService, ConnectionStatus, TelemetryMessage, VehicleStatusMessage } from './services/websocketBridgeService';

// New Components
import ManualControlPanel from './components/ManualControlPanel';
import PlatoonControl from './components/PlatoonControl';
import { RealTimeDataPlot } from './components/RealTimeDataPlot';

const App: React.FC = () => {
  // -- State --
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);  // Start empty, populate from bridge
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [globalEStop, setGlobalEStop] = useState(false);
  const [v2vActive, setV2VActive] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState<ConnectionStatus>('disconnected');

  // UI State
  const [rightPanelMode, setRightPanelMode] = useState<'DETAILS' | 'MANUAL' | 'PLATOON' | 'SCOPE'>('DETAILS');
  const [viewMode, setViewMode] = useState<'map' | 'local' | 'fleet'>('map'); // Map/Data toggle



  // -- Helpers --
  const addLog = useCallback((message: string, level: LogEntry['level'] = 'INFO', vehicleId?: string) => {
    const newLog: LogEntry = {
      id: uuidv4(),
      timestamp: new Date(),
      message,
      level,
      vehicleId
    };
    setLogs(prev => [newLog, ...prev].slice(0, 50));
  }, []);

  // -- WebSocket Bridge --
  useEffect(() => {
    // Auto-connect to bridge on mount
    bridgeService.connect();

    // Status
    const unsubStatus = bridgeService.onStatusChange((status) => {
      setBridgeStatus(status);
      addLog(`Bridge ${status}`, status === 'connected' ? 'SUCCESS' : status === 'error' ? 'ERROR' : 'INFO');

      // When bridge connects, request vehicle status to sync existing connections
      if (status === 'connected') {
        setTimeout(() => {
          bridgeService.requestStatus();
          addLog('Requesting vehicle status from Python GS...', 'INFO');
        }, 500);
      }
    });

    // Telemetry - handles both 'telemetry' and 'v2v_status' message types
    const unsubTelemetry = bridgeService.onTelemetry((msg: TelemetryMessage) => {
      setVehicles(prev => prev.map(v => {
        if (v.id === msg.vehicle_id) {
          // Merge telemetry data - support both Python (th, v, u, delta) and Web (theta, velocity, throttle, steering) field names
          const updatedTelemetry = {
            ...v.telemetry,
            ...(msg.x !== undefined && { x: msg.x }),
            ...(msg.y !== undefined && { y: msg.y }),
            // theta: accept both 'theta' (Web) and 'th' (Python)
            ...((msg.theta !== undefined || msg.th !== undefined) && { theta: msg.theta ?? msg.th }),
            // velocity: accept both 'velocity' (Web) and 'v' (Python)
            ...((msg.velocity !== undefined || msg.v !== undefined) && { velocity: msg.velocity ?? msg.v }),
            ...(msg.battery !== undefined && { battery: msg.battery }),
            // steering: accept both 'steering' (Web) and 'delta' (Python)
            ...((msg.steering !== undefined || msg.delta !== undefined) && { steering: msg.steering ?? msg.delta }),
            // throttle: accept both 'throttle' (Web) and 'u' (Python)
            ...((msg.throttle !== undefined || msg.u !== undefined) && { throttle: msg.throttle ?? msg.u }),
            ...(msg.state !== undefined && { state: msg.state }),
            ...(msg.gps_valid !== undefined && { gps_valid: msg.gps_valid }),

            // V2V Status (from periodic broadcast)
            ...(msg.v2v_active !== undefined && { v2v_active: msg.v2v_active }),
            ...(msg.v2v_peers !== undefined && { v2v_peers: msg.v2v_peers }),
            ...(msg.v2v_protocol !== undefined && { v2v_protocol: msg.v2v_protocol }),

            // Platoon Status (from periodic broadcast)
            ...(msg.platoon_enabled !== undefined && { platoon_enabled: msg.platoon_enabled }),
            ...(msg.platoon_is_leader !== undefined && { platoon_is_leader: msg.platoon_is_leader }),
            ...(msg.platoon_position !== undefined && { platoon_position: msg.platoon_position }),
            ...(msg.platoon_leader_id !== undefined && { platoon_leader_id: msg.platoon_leader_id }),

            // Observer and Controller Types (from periodic broadcast)
            ...(msg.local_observer_type !== undefined && { local_observer_type: msg.local_observer_type }),
            ...(msg.fleet_observer_type !== undefined && { fleet_observer_type: msg.fleet_observer_type }),
            ...(msg.longitudinal_ctrl_type !== undefined && { longitudinal_ctrl_type: msg.longitudinal_ctrl_type }),
            ...(msg.lateral_ctrl_type !== undefined && { lateral_ctrl_type: msg.lateral_ctrl_type }),

            // Perception Status
            ...(msg.perception_active !== undefined && { perception_active: msg.perception_active }),
            ...(msg.scopes_active !== undefined && { scopes_active: msg.scopes_active }),

            lastUpdate: Date.now()
          };

          // Just update telemetry - state is displayed raw from Python
          return {
            ...v,
            telemetry: updatedTelemetry
          };
        }
        return v;
      }));
    });

    // Vehicle Status - dynamically add/update vehicles
    const unsubVehicleStatus = bridgeService.onVehicleStatus((msg: VehicleStatusMessage) => {
      setVehicles(prev => {
        const existingIndex = prev.findIndex(v => v.id === msg.vehicle_id);

        if (msg.status === 'connected') {
          if (existingIndex >= 0) {
            // Update existing vehicle
            return prev.map((v, idx) => idx === existingIndex ? { ...v, status: VehicleStatus.IDLE } : v);
          } else {
            // Add new vehicle
            const newVehicle: Vehicle = {
              id: msg.vehicle_id,
              name: `QCar ${msg.vehicle_id.replace('qcar-', '')}`,
              status: VehicleStatus.IDLE,
              config: {
                controllerId: 'pid',
                estimatorId: 'ekf',
                pathId: 'default'
              },
              targetSpeed: 0,
              telemetry: {
                x: 0,
                y: 0,
                theta: 0,
                velocity: 0,
                battery: 100,
                steering: 0,
                throttle: 0,
                lastUpdate: Date.now()
              }
            };
            addLog(`Vehicle ${msg.vehicle_id} connected from ${msg.ip || 'unknown'}`, 'SUCCESS');
            return [...prev, newVehicle];
          }
        } else {
          // Disconnected
          if (existingIndex >= 0) {
            return prev.map((v, idx) => idx === existingIndex ? { ...v, status: VehicleStatus.DISCONNECTED } : v);
          }
        }
        return prev;
      });
    });

    return () => {
      unsubStatus();
      unsubTelemetry();
      unsubVehicleStatus();
    };
  }, [addLog]);

  // Auto-select first vehicle when vehicles arrive
  useEffect(() => {
    if (vehicles.length > 0 && !selectedVehicleId) {
      setSelectedVehicleId(vehicles[0].id);
    }
  }, [vehicles, selectedVehicleId]);

  // -- Mock Physics Loop --
  useEffect(() => {
    const interval = setInterval(() => {
      setVehicles(currentVehicles => {
        return currentVehicles.map(v => {
          if (globalEStop && v.status !== VehicleStatus.EMERGENCY_STOP) {
            return { ...v, status: VehicleStatus.EMERGENCY_STOP, targetSpeed: 0 };
          }
          // Only use mock physics if disconnected or specific testing mode
          if (bridgeStatus !== 'connected') {
            return updateVehiclePhysics(v, REFRESH_RATE_MS / 1000);
          }
          return v;
        });
      });
    }, REFRESH_RATE_MS);
    return () => clearInterval(interval);
  }, [globalEStop, bridgeStatus]);

  // -- Handlers --

  const handleConnectBridge = () => {
    if (bridgeStatus === 'connected') bridgeService.disconnect();
    else bridgeService.connect();
  };

  const toggleGlobalEStop = () => {
    const newState = !globalEStop;
    setGlobalEStop(newState);
    bridgeService.emergencyStop('all');
    addLog(newState ? "GLOBAL EMERGENCY STOP" : "Emergency Stop Release", 'ERROR');
  };

  const toggleV2V = () => {
    const newState = !v2vActive;
    setV2VActive(newState);
    // Assuming we have a v2v command or just log it for now as per previous, 
    // but the implementation plan didn't strictly specify logic for this beyond the button.
    // bridgeService.sendCommand('v2v_config', 'all', { enabled: newState });
    addLog(`V2V Network ${newState ? 'Enabled' : 'Disabled'}`, 'INFO');
  };

  const handleMissionStart = () => {
    bridgeService.startMission('all');
    addLog('Mission START Broadcast', 'SUCCESS');
  };

  const handleMissionStop = () => {
    bridgeService.stopMission('all');
    addLog('Mission STOP Broadcast', 'WARNING');
  };

  const handleVehicleNameChange = (id: string, newName: string) => {
    setVehicles(prev => prev.map(v => v.id === id ? { ...v, name: newName } : v));
    addLog(`Vehicle ${id} renamed to ${newName}`, 'INFO');
  };

  // -- Derived --
  const activeVehicles = vehicles.filter(v => v.status === VehicleStatus.ACTIVE).length;
  const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);

  return (
    <div className="h-screen bg-slate-950 text-slate-200 flex flex-col overflow-hidden font-inter selection:bg-indigo-500/30">

      {/* 1. Header */}
      <header className="h-14 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between shrink-0 shadow-md z-20">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-1.5 rounded-lg">
            <Globe className="text-white" size={18} />
          </div>
          <div>
            <h1 className="font-bold text-base tracking-tight text-white leading-tight">QCar Ground Station</h1>
            <p className="text-[10px] text-slate-400">Advanced Fleet Control</p>
          </div>
        </div>

        {/* Center Status Pill */}
        <div className="hidden md:flex items-center gap-6 bg-slate-950/50 px-4 py-1.5 rounded-full border border-slate-800/50">
          <div className="flex items-center gap-2 text-xs">
            <span className={`w-2 h-2 rounded-full ${bridgeStatus === 'connected' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500'}`} />
            <span className="text-slate-400">Bridge:</span>
            <span className={bridgeStatus === 'connected' ? 'text-emerald-400 font-medium' : 'text-slate-500'}>{bridgeStatus.toUpperCase()}</span>
          </div>
          <div className="w-px h-3 bg-slate-800" />
          <div className="flex items-center gap-2 text-xs">
            <Activity size={12} className="text-indigo-400" />
            <span className="text-slate-400">Active:</span>
            <span className="text-white font-mono">{activeVehicles} / {vehicles.length}</span>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleConnectBridge}
            className={`p-2 rounded-lg transition-all ${bridgeStatus === 'connected' ? 'bg-emerald-900/20 text-emerald-400 hover:bg-emerald-900/40' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
            title={bridgeStatus === 'connected' ? 'Disconnect Bridge' : 'Connect Bridge'}
          >
            {bridgeStatus === 'connected' ? <PlugZap size={18} /> : <Plug size={18} />}
          </button>

          <button
            onClick={toggleV2V}
            className={`p-2 rounded-lg transition-all ${v2vActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
            title="Toggle V2V Network"
          >
            <Network size={18} />
          </button>

          <button
            onClick={toggleGlobalEStop}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg font-bold text-xs transition-all ${globalEStop ? 'bg-red-600 text-white animate-pulse shadow-[0_0_15px_rgba(220,38,38,0.5)]' : 'bg-red-950/30 text-red-500 border border-red-900/50 hover:bg-red-900/50'}`}
          >
            <AlertTriangle size={14} />
            {globalEStop ? 'E-STOP ENGAGED' : 'EMERGENCY STOP'}
          </button>
        </div>
      </header>

      {/* 2. Main Workspace */}
      <main className="flex-1 flex overflow-hidden">

        {/* Left: Fleet Sidebar */}
        <aside className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 z-10">
          <div className="p-3 border-b border-slate-800 flex justify-between items-center text-xs font-semibold text-slate-400">
            <span className="flex items-center gap-2"><Radio size={14} /> FLEET UNITS</span>
            <span className="bg-slate-800 px-1.5 py-0.5 rounded text-white">{vehicles.length}</span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
            {vehicles.map(v => (
              <VehicleCard
                key={v.id}
                vehicle={v}
                isSelected={v.id === selectedVehicleId}
                onSelect={() => {
                  setSelectedVehicleId(v.id);
                  if (rightPanelMode === 'MANUAL') {
                    // optional: keep manual mode open but switch target?
                  } else {
                    setRightPanelMode('DETAILS');
                  }
                }}
                onStatusChange={(id, status) => {
                  if (status === VehicleStatus.ACTIVE) {
                    bridgeService.startMission(id);
                    addLog(`Sending START to ${id}`, 'SUCCESS');
                  } else if (status === VehicleStatus.STOPPED) {
                    bridgeService.stopMission(id);
                    addLog(`Sending STOP to ${id}`, 'WARNING');
                  } else if (status === VehicleStatus.EMERGENCY_STOP) {
                    bridgeService.emergencyStop(id);
                    addLog(`Sending E-STOP to ${id}`, 'ERROR');
                  }
                }}
                onSpeedChange={(id, speed) => {
                  bridgeService.setVelocity(speed, id);
                  setVehicles(prev => prev.map(veh => veh.id === id ? { ...veh, targetSpeed: speed } : veh));
                }}
                onNameChange={handleVehicleNameChange}
              />
            ))}
          </div>

          {/* Quick Actions Footer */}
          <div className="p-3 border-t border-slate-800 bg-slate-950/30 grid grid-cols-2 gap-2">
            <button onClick={() => setRightPanelMode('PLATOON')} className="col-span-2 bg-slate-800 hover:bg-slate-700 text-xs text-indigo-300 py-2 rounded border border-slate-700 flex items-center justify-center gap-2">
              <Link2 size={14} /> Configure Platoon
            </button>
          </div>
        </aside>

        {/* Center: Mission & Visualization */}
        <section className="flex-1 flex flex-col relative min-w-[400px]">

          {/* Visualization Area */}
          <div className="flex-1 bg-slate-950 relative">
            {viewMode === 'map' ? (
              <div className="absolute inset-0">
                <TelemetryMap
                  vehicles={vehicles}
                  selectedVehicleId={selectedVehicleId}
                  onSelectVehicle={setSelectedVehicleId}
                  isV2VActive={v2vActive}
                />
              </div>
            ) : (
              <div className="absolute inset-0">
                <RealTimeDataPlot
                  vehicles={vehicles}
                  selectedVehicleId={selectedVehicleId}
                  mode={viewMode === 'local' ? 'local' : 'fleet'}
                />
              </div>
            )}

            {/* View Mode Toggle */}
            <div className="absolute top-4 left-4 bg-slate-900/90 backdrop-blur border border-slate-700 rounded-lg p-1 shadow-lg flex gap-1">
              <button
                onClick={() => setViewMode('map')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${viewMode === 'map' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
              >
                Map View
              </button>
              <button
                onClick={() => setViewMode('local')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${viewMode === 'local' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
              >
                Local Data
              </button>
              <button
                onClick={() => setViewMode('fleet')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${viewMode === 'fleet' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
              >
                Fleet Data
              </button>
            </div>
          </div>


          {/* Bottom: System Logs */}
          <div className="h-48 bg-slate-900/90 backdrop-blur border-t border-slate-700 flex flex-col">
            <div className="px-4 py-2 border-b border-slate-800/50 flex justify-between items-center bg-slate-800/20">
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                  <Terminal size={10} /> SYSTEM LOGS
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleMissionStart}
                    className="flex items-center gap-1 bg-emerald-600/80 hover:bg-emerald-600 text-white px-2 py-1 rounded text-[10px] font-medium transition-all"
                    title="Broadcast START"
                  >
                    <Play size={12} /> Start All
                  </button>
                  <button
                    onClick={handleMissionStop}
                    className="flex items-center gap-1 bg-amber-600/80 hover:bg-amber-600 text-white px-2 py-1 rounded text-[10px] font-medium transition-all"
                    title="Broadcast STOP"
                  >
                    <Square size={12} /> Stop All
                  </button>
                </div>
              </div>
              <button onClick={() => setLogs([])} className="text-[10px] text-slate-500 hover:text-white">CLEAR</button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 font-mono text-[10px] space-y-1.5 custom-scrollbar">
              {logs.length === 0 && <div className="text-center text-slate-600 italic py-2">System Ready</div>}
              {logs.map(log => (
                <div key={log.id} className="flex gap-2 opacity-90">
                  <span className="text-slate-600 shrink-0">{log.timestamp.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  <span className={`${log.level === 'ERROR' ? 'text-red-400' :
                    log.level === 'WARNING' ? 'text-amber-400' :
                      log.level === 'SUCCESS' ? 'text-emerald-400' : 'text-slate-300'
                    }`}>
                    {log.vehicleId && <span className="text-indigo-400 mr-1">[{log.vehicleId}]</span>}
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Right: Dynamic Panel */}
        {/* If Mode is DETAILS but no vehicle selected, show placeholder */}
        {rightPanelMode !== 'SCOPE' && (
          <aside className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col shrink-0 z-10 transition-all duration-300">

            {rightPanelMode === 'MANUAL' && selectedVehicle ? (
              <ManualControlPanel
                vehicleId={selectedVehicle.id}
                onClose={() => setRightPanelMode('DETAILS')}
              />
            ) : rightPanelMode === 'PLATOON' ? (
              <PlatoonControl
                vehicles={vehicles}
                onClose={() => setRightPanelMode('DETAILS')}
              />
            ) : (
              // Default DETAILS View
              <div className="flex flex-col h-full p-4 gap-6">
                {!selectedVehicle ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-600 gap-2">
                    <Radio size={32} />
                    <p className="text-sm">Select a vehicle to view details</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-bold text-white tracking-tight">{selectedVehicle.name}</h2>
                      <div className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${selectedVehicle.status === 'ACTIVE' ? 'bg-emerald-900/30 border-emerald-500 text-emerald-400' : 'bg-slate-800 border-slate-600 text-slate-400'}`}>
                        {selectedVehicle.status}
                      </div>
                    </div>

                    {/* Quick Telemetry */}
                    <div className="grid grid-cols-2 gap-3">
                      <StatCard title="Velocity" value={`${selectedVehicle.telemetry.velocity.toFixed(2)} m/s`} icon={Activity} color="text-indigo-400" />
                      <StatCard title="Battery" value={`${selectedVehicle.telemetry.battery.toFixed(0)}%`} icon={Activity} color="text-emerald-400" />
                    </div>

                    {/* Control Actions */}
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</p>

                      <button
                        onClick={() => setRightPanelMode('MANUAL')}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-semibold shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all"
                      >
                        <Gamepad2 size={18} /> Manual Control
                      </button>

                      <div className="grid grid-cols-2 gap-2">
                        <button className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-2">
                          <Eye size={14} /> Toggle YOLO
                        </button>
                        <button className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-2">
                          <Route size={14} /> Set Path
                        </button>
                      </div>
                    </div>

                    {/* Scope / Advanced */}
                    <div className="mt-auto border-t border-slate-800 pt-4">
                      <button className="w-full text-slate-500 hover:text-white text-xs flex items-center justify-center gap-2 py-2">
                        Advanced Settings <Settings2 size={12} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </aside>
        )}

      </main>
    </div>
  );
};

export default App;