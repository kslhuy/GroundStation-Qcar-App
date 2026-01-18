
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
import { Vehicle, VehicleStatus, LogEntry, VehicleMode } from './types';
import { INITIAL_FLEET, REFRESH_RATE_MS } from './constants';
import { updateVehiclePhysics } from './services/mockVehicleService';
import { VehicleCard } from './components/VehicleCard';
import { TelemetryMap } from './components/TelemetryMap';
import { StatCard } from './components/StatCard';
import { bridgeService, ConnectionStatus, TelemetryMessage, VehicleStatusMessage } from './services/websocketBridgeService';

// New Components
import ManualControlPanel from './components/ManualControlPanel';
import PlatoonControl from './components/PlatoonControl';

const App: React.FC = () => {
  // -- State --
  const [vehicles, setVehicles] = useState<Vehicle[]>(INITIAL_FLEET);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(INITIAL_FLEET[0]?.id || null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [globalEStop, setGlobalEStop] = useState(false);
  const [v2vActive, setV2VActive] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState<ConnectionStatus>('disconnected');

  // UI State
  const [rightPanelMode, setRightPanelMode] = useState<'DETAILS' | 'MANUAL' | 'PLATOON' | 'SCOPE'>('DETAILS');

  // -- Mission Parameters --
  const [globalSpeed, setGlobalSpeed] = useState<number>(0.5);
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
    setLogs(prev => [newLog, ...prev].slice(0, 50));
  }, []);

  // -- WebSocket Bridge --
  useEffect(() => {
    // Status
    const unsubStatus = bridgeService.onStatusChange((status) => {
      setBridgeStatus(status);
      addLog(`Bridge ${status}`, status === 'connected' ? 'SUCCESS' : status === 'error' ? 'ERROR' : 'INFO');
    });

    // Telemetry
    const unsubTelemetry = bridgeService.onTelemetry((msg: TelemetryMessage) => {
      setVehicles(prev => prev.map(v => {
        if (v.id === msg.vehicle_id) {
          return {
            ...v,
            telemetry: {
              x: msg.x ?? v.telemetry.x,
              y: msg.y ?? v.telemetry.y,
              theta: msg.theta ?? v.telemetry.theta,
              velocity: msg.velocity ?? v.telemetry.velocity,
              battery: msg.battery ?? v.telemetry.battery,
              steering: msg.steering ?? v.telemetry.steering,
              throttle: msg.throttle ?? v.telemetry.throttle,
              lastUpdate: Date.now()
            }
          };
        }
        return v;
      }));
    });

    // Vehicle Status
    const unsubVehicleStatus = bridgeService.onVehicleStatus((msg: VehicleStatusMessage) => {
      setVehicles(prev => prev.map(v => {
        if (v.id === msg.vehicle_id) {
          const newStatus = msg.status === 'connected' ? VehicleStatus.IDLE : VehicleStatus.DISCONNECTED;
          return { ...v, status: newStatus };
        }
        return v;
      }));
    });

    return () => {
      unsubStatus();
      unsubTelemetry();
      unsubVehicleStatus();
    };
  }, [addLog]);

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
    bridgeService.startMission('all', globalSpeed);
    addLog('Mission START Broadcast', 'SUCCESS');
  };

  const handleMissionStop = () => {
    bridgeService.stopMission('all');
    addLog('Mission STOP Broadcast', 'WARNING');
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
                    bridgeService.startMission(id, globalSpeed);
                    addLog(`Sending START to ${id}`, 'SUCCESS');
                  } else if (status === VehicleStatus.IDLE) {
                    bridgeService.stopMission(id);
                    addLog(`Sending STOP to ${id}`, 'WARNING');
                  } else if (status === VehicleStatus.EMERGENCY_STOP) {
                    bridgeService.emergencyStop(id);
                    addLog(`Sending E-STOP to ${id}`, 'ERROR');
                  }
                  // Optimistic update
                  setVehicles(prev => prev.map(veh => veh.id === id ? { ...veh, status } : veh));
                }}
                onSpeedChange={() => { }}
                onConfigChange={() => { }}
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

        {/* Center: Mission & Map */}
        <section className="flex-1 flex flex-col relative min-w-[400px]">

          {/* Map Area */}
          <div className="flex-1 bg-slate-950 relative">
            <div className="absolute inset-0">
              <TelemetryMap
                vehicles={vehicles}
                selectedVehicleId={selectedVehicleId}
                onSelectVehicle={setSelectedVehicleId}
                isV2VActive={v2vActive}
              />
            </div>

            {/* Mission Control Overlay (Top Center) */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur border border-slate-700 rounded-xl p-2 shadow-2xl flex items-center gap-4">

              <div className="flex flex-col gap-0.5 px-2 border-r border-slate-700/50">
                <label className="text-[9px] text-slate-400 uppercase font-bold">Ref Speed</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range" min="0" max="2.0" step="0.1"
                    value={globalSpeed} onChange={e => setGlobalSpeed(parseFloat(e.target.value))}
                    className="w-20 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                  <span className="text-xs font-mono text-indigo-300 w-8">{globalSpeed.toFixed(1)}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleMissionStart}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white p-2 rounded-lg shadow-lg hover:shadow-emerald-500/20 transition-all"
                  title="Broadcast START"
                >
                  <Play size={18} fill="currentColor" />
                </button>
                <button
                  onClick={handleMissionStop}
                  className="bg-amber-600 hover:bg-amber-500 text-white p-2 rounded-lg shadow-lg hover:shadow-amber-500/20 transition-all"
                  title="Broadcast STOP"
                >
                  <Square size={18} fill="currentColor" />
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Right: Logs Overlay */}
          <div className="absolute bottom-4 right-4 w-96 max-h-60 bg-slate-900/90 backdrop-blur border border-slate-700 rounded-lg shadow-2xl flex flex-col overflow-hidden z-20">
            <div className="p-2 border-b border-slate-800/50 flex justify-between items-center bg-slate-800/20">
              <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1"><Terminal size={10} /> SYSTEM LOGS</span>
              <button onClick={() => setLogs([])} className="text-[10px] text-slate-500 hover:text-white">CLEAR</button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 font-mono text-[10px] space-y-1.5 custom-scrollbar">
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