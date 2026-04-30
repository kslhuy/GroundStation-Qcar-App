
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
  Plug,
  PlugZap,
  Link2,
  Settings2,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  PanelBottomClose,
  PanelBottomOpen,
  Maximize2,
  Minimize2,
  Skull
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

// Internal imports
import { Vehicle, VehicleStatus, LogEntry } from './types';
import { REFRESH_RATE_MS } from './constants';
import { updateVehiclePhysics } from './services/mockVehicleService';
import { VehicleCard } from './components/VehicleCard';
import { TelemetryMap } from './components/TelemetryMap';
import { bridgeService, ConnectionStatus, TelemetryMessage, VehicleStatusMessage, GlobalStatusMessage } from './services/websocketBridgeService';

// New Components
import ManualControlPanel from './components/ManualControlPanel';
import PlatoonControl from './components/PlatoonControl';
import { RealTimeDataPlot } from './components/RealTimeDataPlot';
import VehicleControlPanel from './components/VehicleControlPanel';
import AttackControlPanel from './components/AttackControlPanel';

const BRIDGE_AUTO_CONNECT_STORAGE_KEY = 'qcar-bridge-auto-connect-enabled';

const App: React.FC = () => {
  // -- State --
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);  // Start empty, populate from bridge
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [globalEStop, setGlobalEStop] = useState(false);
  const [v2vActive, setV2VActive] = useState(false); // Used primarily for map visualization 
  const [bridgeStatus, setBridgeStatus] = useState<ConnectionStatus>('disconnected');

  // GS Global Sync State
  const [v2vActivating, setV2vActivating] = useState(false);
  const [v2vNetworkEstablished, setV2vNetworkEstablished] = useState(false);
  const [platoonSetupComplete, setPlatoonSetupComplete] = useState(false);
  const [platoonLeaderId, setPlatoonLeaderId] = useState<string | number | undefined>(undefined);
  const [platoonFormation, setPlatoonFormation] = useState<Record<string, number>>({});

  // UI State
  const [rightPanelMode, setRightPanelMode] = useState<'DETAILS' | 'MANUAL' | 'PLATOON' | 'SCOPE' | 'ATTACK' | 'CLOSED'>('CLOSED');
  const [viewMode, setViewMode] = useState<'map' | 'local' | 'fleet' | 'playback'>('map'); // Map/Data toggle
  const [isFleetSidebarOpen, setIsFleetSidebarOpen] = useState(window.innerWidth >= 768);
  const [isLogsPanelOpen, setIsLogsPanelOpen] = useState(true);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsFleetSidebarOpen(false);
      } else {
        setIsFleetSidebarOpen(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update right panel when a new vehicle is selected
  useEffect(() => {
    if (selectedVehicleId) {
      setRightPanelMode('DETAILS');
    }
  }, [selectedVehicleId]);


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
    // Auto-connect unless the user previously disconnected the bridge manually.
    const shouldAutoConnect = window.localStorage.getItem(BRIDGE_AUTO_CONNECT_STORAGE_KEY) !== 'false';
    if (shouldAutoConnect) {
      bridgeService.connect();
    }

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
            ...(msg.acceleration !== undefined && { acceleration: msg.acceleration }),
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

            // Local RKNet sensor attack status
            ...(msg.local_sensor_attack_supported !== undefined && { local_sensor_attack_supported: msg.local_sensor_attack_supported }),
            ...(msg.local_sensor_attack_enabled !== undefined && { local_sensor_attack_enabled: msg.local_sensor_attack_enabled }),
            ...(msg.local_sensor_attack_active !== undefined && { local_sensor_attack_active: msg.local_sensor_attack_active }),
            ...(msg.local_sensor_attack_branch_types !== undefined && { local_sensor_attack_branch_types: msg.local_sensor_attack_branch_types }),
            ...(msg.local_sensor_attack_gps_type !== undefined && { local_sensor_attack_gps_type: msg.local_sensor_attack_gps_type }),
            ...(msg.local_sensor_attack_remaining_steps !== undefined && { local_sensor_attack_remaining_steps: msg.local_sensor_attack_remaining_steps }),
            ...(msg.local_sensor_attack_intensity !== undefined && { local_sensor_attack_intensity: msg.local_sensor_attack_intensity }),

            // Gear (from operational_status in periodic broadcast or direct)
            ...(msg.operational_status?.gear !== undefined && { gear: msg.operational_status.gear }),
            ...(msg.gear !== undefined && { gear: msg.gear }),

            // Reference Path
            ...(msg.path_x !== undefined && { path_x: msg.path_x }),
            ...(msg.path_y !== undefined && { path_y: msg.path_y }),

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

    // Global Status
    const unsubGlobalStatus = bridgeService.onGlobalStatus((msg: GlobalStatusMessage) => {
        if (msg.v2v_activating !== undefined) setV2vActivating(msg.v2v_activating);
        if (msg.v2v_network_established !== undefined) {
            setV2vNetworkEstablished(msg.v2v_network_established);
            setV2VActive(msg.v2v_network_established); // Align local state for map
        }
        if (msg.platoon_setup_complete !== undefined) setPlatoonSetupComplete(msg.platoon_setup_complete);
        if (msg.platoon_leader_id !== undefined) setPlatoonLeaderId(msg.platoon_leader_id);
        if (msg.platoon_formation !== undefined) setPlatoonFormation(msg.platoon_formation);
    });

    return () => {
      unsubStatus();
      unsubTelemetry();
      unsubVehicleStatus();
      unsubGlobalStatus();
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
    if (bridgeStatus === 'connected' || bridgeStatus === 'connecting') {
      window.localStorage.setItem(BRIDGE_AUTO_CONNECT_STORAGE_KEY, 'false');
      bridgeService.disconnect();
    } else {
      window.localStorage.setItem(BRIDGE_AUTO_CONNECT_STORAGE_KEY, 'true');
      bridgeService.connect();
    }
  };

  const toggleGlobalEStop = () => {
    const newState = !globalEStop;
    setGlobalEStop(newState);
    bridgeService.emergencyStop('all');
    addLog(newState ? "GLOBAL EMERGENCY STOP" : "Emergency Stop Release", 'ERROR');
  };

  const toggleV2V = () => {
    // If it's established or activating, user probably wants to turn it off. Otherwise, turn on.
    const isCurrentlyActiveOrActivating = v2vNetworkEstablished || v2vActivating;
    bridgeService.setV2V(!isCurrentlyActiveOrActivating, 'all');
    addLog(`Requested V2V Network ${!isCurrentlyActiveOrActivating ? 'Establishment' : 'Termination'}`, 'INFO');
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
          <button
            onClick={() => setIsFleetSidebarOpen(!isFleetSidebarOpen)}
            className="text-slate-400 hover:text-white transition-colors"
            title={isFleetSidebarOpen ? "Collapse Fleet Panel" : "Expand Fleet Panel"}
          >
            {isFleetSidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
          </button>
          <div className="bg-indigo-600 p-1.5 rounded-lg">
            <Globe className="text-white" size={18} />
          </div>
          <div>
            <h1 className="font-bold text-base tracking-tight text-white leading-tight">QCar Ground Station</h1>
            <p className="hidden md:block text-[10px] text-slate-400">Advanced Fleet Control</p>
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
        <div className="flex items-center gap-2 md:gap-3">
          <button
            onClick={handleConnectBridge}
            className={`p-2 rounded-lg transition-all ${bridgeStatus === 'connected' ? 'bg-emerald-900/20 text-emerald-400 hover:bg-emerald-900/40' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
            title={bridgeStatus === 'connected' ? 'Disconnect Bridge' : 'Connect Bridge'}
          >
            {bridgeStatus === 'connected' ? <PlugZap size={18} /> : <Plug size={18} />}
          </button>

          <button
            onClick={toggleV2V}
            className={`p-2 rounded-lg transition-all ${v2vNetworkEstablished ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : v2vActivating ? 'bg-orange-500 text-white animate-pulse' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
            title="Toggle V2V Network"
          >
            <Network size={18} />
          </button>

          <button
            onClick={toggleGlobalEStop}
            className={`flex items-center gap-2 px-3 md:px-4 py-1.5 rounded-lg font-bold text-xs transition-all ${globalEStop ? 'bg-red-600 text-white animate-pulse shadow-[0_0_15px_rgba(220,38,38,0.5)]' : 'bg-red-950/30 text-red-500 border border-red-900/50 hover:bg-red-900/50'}`}
          >
            <AlertTriangle size={14} />
            <span className="hidden md:inline">{globalEStop ? 'E-STOP ENGAGED' : 'EMERGENCY STOP'}</span>
            <span className="md:hidden">STOP</span>
          </button>

          <div className="w-px h-5 bg-slate-800 mx-1 hidden md:block" />

          <button
            onClick={() => setRightPanelMode(rightPanelMode === 'CLOSED' ? 'DETAILS' : 'CLOSED')}
            className="text-slate-400 hover:text-white transition-colors hidden md:block"
            title={rightPanelMode !== 'CLOSED' ? "Collapse Control Panel" : "Expand Control Panel"}
          >
            {rightPanelMode !== 'CLOSED' ? <PanelRightClose size={20} /> : <PanelRightOpen size={20} />}
          </button>
        </div>
      </header>

      {/* 2. Main Workspace */}
      <main className="flex-1 flex overflow-hidden relative">

        {/* Backdrop for Mobile Sidebar */}
        {isFleetSidebarOpen && (
          <div
            className="md:hidden absolute inset-0 bg-black/50 z-20 backdrop-blur-sm"
            onClick={() => setIsFleetSidebarOpen(false)}
          />
        )}

        {/* Left: Fleet Sidebar */}
        <aside className={`
            absolute md:relative z-30 h-full
            w-64 md:w-52
            bg-slate-900 border-r border-slate-800 
            flex flex-col shrink-0 overflow-hidden
            transition-all duration-300 ease-in-out
            ${isFleetSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:!w-0 md:!border-0'}
        `}>
          <div className="p-3 border-b border-slate-800 flex justify-between items-center text-xs font-semibold text-slate-400">
            <span className="flex items-center gap-2"><Radio size={14} /> FLEET UNITS</span>
            <span className="bg-slate-800 px-1.5 py-0.5 rounded text-white">{vehicles.length}</span>
            {/* Mobile Close Button */}
            <button className="md:hidden text-slate-500" onClick={() => setIsFleetSidebarOpen(false)}>
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
            {vehicles.map(v => {
              // Extract raw car id number from "qcar-X" or just pass ID
              const numericIdMatch = v.id.match(/\d+/);
              const numericId = numericIdMatch ? numericIdMatch[0] : null;
              
              // Find global platoon role
              let globalPlatoonPosition = null;
              let isGlobalLeader = false;
              
              if (platoonSetupComplete && numericId && platoonFormation[numericId]) {
                 globalPlatoonPosition = platoonFormation[numericId];
                 isGlobalLeader = (globalPlatoonPosition === 1);
              }
              
              return (
              <VehicleCard
                key={v.id}
                vehicle={v}
                isSelected={v.id === selectedVehicleId}
                globalPlatoonPosition={globalPlatoonPosition}
                isGlobalLeader={isGlobalLeader}
                onSelect={() => {
                  setSelectedVehicleId(v.id);
                  setRightPanelMode('DETAILS');
                  if (window.innerWidth < 768) setIsFleetSidebarOpen(false);
                }}
                onNameChange={handleVehicleNameChange}
              />
            )})}
          </div>

          {/* Quick Actions Footer */}
          <div className="p-3 border-t border-slate-800 bg-slate-950/30 grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                bridgeService.setupPlatoon();
                addLog("Requested Platoon Setup", "INFO");
              }}
              className={`${platoonSetupComplete ? 'bg-indigo-600/50 text-indigo-200 border-indigo-500/50' : 'bg-slate-800 hover:bg-slate-700 text-indigo-300 border-slate-700'} text-xs py-2 rounded flex items-center justify-center gap-2`}
              title="Use Python GS logic to setup platoon from current config"
            >
              <Link2 size={14} /> {platoonSetupComplete ? 'Platoon Setup' : 'Setup Platoon'}
            </button>

            <button
              onClick={() => {
                bridgeService.triggerPlatoon();
                addLog("Requested Platoon Trigger", "INFO");
              }}
              className="bg-emerald-900/30 hover:bg-emerald-900/50 text-xs text-emerald-300 py-2 rounded border border-emerald-900/50 flex items-center justify-center gap-2"
              title="Trigger Platoon Start (Global)"
            >
              <Play size={14} /> Trigger Platoon
            </button>

            <button onClick={() => setRightPanelMode('PLATOON')} className="col-span-2 bg-slate-800 hover:bg-slate-700 text-xs text-slate-400 py-1 rounded border border-slate-700 flex items-center justify-center gap-2">
              Configure Details
            </button>
            <button onClick={() => setRightPanelMode('ATTACK')} className="col-span-2 bg-red-900/30 hover:bg-red-900/50 text-xs text-red-400 py-2 rounded border border-red-900/50 flex items-center justify-center gap-2 font-bold focus:outline-none focus:ring-1 focus:ring-red-500 transition-colors">
              <Skull size={14} className="text-red-500" /> V2V ATTACKS
            </button>
          </div>
        </aside>

        {/* Center: Mission & Visualization */}
        <section className="flex-1 flex flex-col relative w-full min-w-0">

          {/* Visualization Area */}
          <div className="flex-1 bg-slate-950 relative">
            {viewMode === 'map' ? (
              <div className="absolute inset-0">
                <TelemetryMap
                  vehicles={vehicles}
                  selectedVehicleId={selectedVehicleId}
                  onSelectVehicle={(id) => {
                    setSelectedVehicleId(id);
                    setRightPanelMode('DETAILS');
                  }}
                  isV2VActive={v2vActive}
                />
              </div>
            ) : (
              <div className="absolute inset-0">
                <RealTimeDataPlot
                  vehicles={vehicles}
                  selectedVehicleId={selectedVehicleId}
                  mode={viewMode === 'local' ? 'local' : viewMode === 'playback' ? 'playback' : 'fleet'}
                />
              </div>
            )}

            {/* View Mode Toggle */}
            <div className="absolute z-20 top-0 left-1/2 transform -translate-x-1/2 bg-slate-900/90 backdrop-blur border border-slate-700 rounded-b-full rounded-t-none p-1 shadow-md flex gap-1 transition-all">
              <button
                onClick={() => setViewMode('map')}
                className={`px-4 py-1 rounded-full text-xs font-bold transition-all ${viewMode === 'map' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
              >
                Map
              </button>
              <button
                onClick={() => setViewMode('local')}
                className={`px-4 py-1 rounded-full text-xs font-bold transition-all ${viewMode === 'local' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
              >
                Local
              </button>
              <button
                onClick={() => setViewMode('fleet')}
                className={`hidden sm:block px-4 py-1 rounded-full text-xs font-bold transition-all ${viewMode === 'fleet' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
              >
                Fleet
              </button>
              <button
                onClick={() => setViewMode('playback')}
                className={`px-4 py-1 rounded-full text-xs font-bold transition-all ${viewMode === 'playback' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
              >
                Replay
              </button>
            </div>
          </div>


          {/* Bottom: System Logs */}
          <div className={`${isLogsPanelOpen ? 'h-48' : 'h-8'} bg-slate-900/90 backdrop-blur border-t border-slate-700 flex flex-col transition-all duration-300 z-10`}>
            <div className="px-4 py-2 border-b border-slate-800/50 flex justify-between items-center bg-slate-800/20">
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                  <Terminal size={10} /> LOGS
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleMissionStart}
                    className="flex items-center gap-1 bg-emerald-600/80 hover:bg-emerald-600 text-white px-2 py-1 rounded text-[10px] font-medium transition-all"
                    title="Broadcast START"
                  >
                    <Play size={12} /> <span className="hidden sm:inline">Start All</span>
                  </button>
                  <button
                    onClick={handleMissionStop}
                    className="flex items-center gap-1 bg-amber-600/80 hover:bg-amber-600 text-white px-2 py-1 rounded text-[10px] font-medium transition-all"
                    title="Broadcast STOP"
                  >
                    <Square size={12} /> <span className="hidden sm:inline">Stop All</span>
                  </button>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <button onClick={() => setLogs([])} className="text-[10px] text-slate-500 hover:text-white">CLEAR</button>
                  <button
                    onClick={() => setIsLogsPanelOpen(!isLogsPanelOpen)}
                    className="text-slate-400 hover:text-white"
                    title={isLogsPanelOpen ? "Minimize Logs" : "Maximize Logs"}
                  >
                    {isLogsPanelOpen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                  </button>
                </div>
              </div>
            </div>
            {isLogsPanelOpen && (
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
            )}
          </div>
        </section>

        {/* Right: Dynamic Panel */}
        {/* Backdrop for Mobile Right Panel */}
        {rightPanelMode !== 'CLOSED' && (
          <div
            className="md:hidden absolute inset-0 bg-black/50 z-20 backdrop-blur-sm"
            onClick={() => setRightPanelMode('CLOSED')}
          />
        )}

        <aside className={`
            absolute md:relative z-30 h-full
            w-full md:w-80
            bg-slate-900 border-l border-slate-800 
            flex flex-col shrink-0 overflow-hidden
            transition-all duration-300 ease-in-out
            ${rightPanelMode !== 'CLOSED' ? 'translate-x-0' : 'translate-x-full md:translate-x-0 md:!w-0 md:!border-0'}
        `}>
          {/* Header for Right Panel */}
          <div className="p-3 border-b border-slate-800 flex justify-between items-center text-xs font-semibold text-slate-400 shrink-0">
            <span className="flex items-center gap-2"><Settings2 size={14} /> CONTROL PANEL</span>
            <button onClick={() => setRightPanelMode('CLOSED')} className="text-slate-500 hover:text-white transition-colors" title="Close Panel">
              <X size={16} />
            </button>
          </div>

          {rightPanelMode === 'MANUAL' && selectedVehicle ? (
            <ManualControlPanel
              vehicleId={selectedVehicle.id}
              onClose={() => setRightPanelMode('DETAILS')}
            />
          ) : rightPanelMode === 'PLATOON' ? (
            <PlatoonControl
              vehicles={vehicles}
              globalSetupComplete={platoonSetupComplete}
              globalLeaderId={platoonLeaderId?.toString()}
              onClose={() => setRightPanelMode('DETAILS')}
            />
          ) : rightPanelMode === 'ATTACK' ? (
            <div className="flex-1 overflow-y-auto">
              <AttackControlPanel
                vehicles={vehicles}
                onClose={() => setRightPanelMode('CLOSED')}
              />
            </div>
          ) : (
            // Default DETAILS View - Using VehicleControlPanel
            <div className="flex flex-col h-full p-4 overflow-y-auto">
              {!selectedVehicle ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-600 gap-2">
                  <Radio size={32} />
                  <p className="text-sm">Select a vehicle to view details</p>
                </div>
              ) : (
                <VehicleControlPanel
                  vehicle={selectedVehicle}
                  onManualMode={() => setRightPanelMode('MANUAL')}
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
                />
              )}
            </div>
          )}
        </aside>


      </main>
    </div>
  );
};

export default App;
