import React, { useState, useEffect } from 'react';
import { Vehicle, PATH_LONGITUDINAL_CONTROLLERS, PATH_LATERAL_CONTROLLERS, LEADER_LONGITUDINAL_CONTROLLERS, LEADER_LATERAL_CONTROLLERS, LongitudinalControllerType, LateralControllerType } from '../types';
import { CONTROLLER_SCHEMAS, ParamDef, getSchema } from '../config/controllerConfig';
import { bridgeService } from '../services/websocketBridgeService';
import { Settings2, Sliders, X, RefreshCw } from 'lucide-react';

interface ControllerSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    vehicle: Vehicle;
}

type TabType = 'path' | 'leader';

const ControllerSettingsModal: React.FC<ControllerSettingsModalProps> = ({
    isOpen,
    onClose,
    vehicle
}) => {
    const [activeTab, setActiveTab] = useState<TabType>('path');

    // Default controller types from telemetry. Defaults if null.
    const [pathLongCtrl, setPathLongCtrl] = useState<LongitudinalControllerType>('pid');
    const [pathLatCtrl, setPathLatCtrl] = useState<LateralControllerType>('pp_map');
    const [leaderLongCtrl, setLeaderLongCtrl] = useState<LongitudinalControllerType>('cacc');
    const [leaderLatCtrl, setLeaderLatCtrl] = useState<LateralControllerType>('pure_pursuit');

    // Parameters for currently active tab
    const [longParams, setLongParams] = useState<Record<string, any>>({});
    const [latParams, setLatParams] = useState<Record<string, any>>({});

    // Keep state synced with telemetry updates
    useEffect(() => {
        if (vehicle.telemetry.path_long_ctrl) setPathLongCtrl(vehicle.telemetry.path_long_ctrl as LongitudinalControllerType);
        if (vehicle.telemetry.path_lat_ctrl) setPathLatCtrl(vehicle.telemetry.path_lat_ctrl as LateralControllerType);
        if (vehicle.telemetry.leader_long_ctrl) setLeaderLongCtrl(vehicle.telemetry.leader_long_ctrl as LongitudinalControllerType);
        if (vehicle.telemetry.leader_lat_ctrl) setLeaderLatCtrl(vehicle.telemetry.leader_lat_ctrl as LateralControllerType);
    }, [vehicle.telemetry]);

    // Active controllers for the currently selected tab
    const activeLongCtrl = activeTab === 'path' ? pathLongCtrl : leaderLongCtrl;
    const activeLatCtrl = activeTab === 'path' ? pathLatCtrl : leaderLatCtrl;

    // Load schemas when active controller changes
    useEffect(() => {
        const loadSchema = (ctrl: string, setParams: any) => {
            const schema = getSchema(ctrl, vehicle.telemetry.config_data?.controller_params);
            if (schema) {
                const initial: Record<string, any> = {};
                schema.forEach(p => { initial[p.key] = p.defaultValue; });
                setParams(initial);
            } else {
                setParams({});
            }
        };

        loadSchema(activeLongCtrl, setLongParams);
        loadSchema(activeLatCtrl, setLatParams);
    }, [activeLongCtrl, activeLatCtrl, vehicle.telemetry.config_data]);

    if (!isOpen) return null;

    // Command Handlers
    const handleSetController = (category: 'longitudinal' | 'lateral', type: string) => {
        bridgeService.setController(category, type, activeTab, vehicle.id);
        // Optimistically update local state so UI feels snappy
        if (activeTab === 'path') {
            if (category === 'longitudinal') setPathLongCtrl(type as LongitudinalControllerType);
            else setPathLatCtrl(type as LateralControllerType);
        } else {
            if (category === 'longitudinal') setLeaderLongCtrl(type as LongitudinalControllerType);
            else setLeaderLatCtrl(type as LateralControllerType);
        }
    };

    const handleApplyParams = (category: 'longitudinal' | 'lateral') => {
        const params = category === 'longitudinal' ? longParams : latParams;
        if (Object.keys(params).length > 0) {
            bridgeService.setControllerParams(category, params, activeTab, vehicle.id);
        }
    };

    // Rendering Helpers
    const renderParamInput = (param: ParamDef, value: any, onChange: (key: string, val: any) => void) => {
        if (param.type === 'boolean') {
            return (
                <label className="flex items-center gap-2 cursor-pointer mt-1">
                    <input
                        type="checkbox"
                        checked={!!value}
                        onChange={(e) => onChange(param.key, e.target.checked)}
                        className="w-4 h-4 rounded text-indigo-500 bg-slate-800 border-slate-600 focus:ring-indigo-500 focus:ring-1 outline-none"
                    />
                    <span className="text-xs text-slate-300 select-none">Enabled</span>
                </label>
            );
        }

        return (
            <input
                type="number"
                value={value ?? 0}
                onChange={(e) => onChange(param.key, parseFloat(e.target.value))}
                min={param.min}
                max={param.max}
                step={param.step}
                className="w-full bg-slate-900 border border-slate-700/80 text-slate-200 text-xs rounded px-2 py-1.5 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
            />
        );
    };

    const getControllerOptions = (category: string) => {
        const dynamicConfig = vehicle.telemetry.config_data;
        if (activeTab === 'path') {
            if (category === 'longitudinal') return dynamicConfig?.path_longitudinal_controllers || PATH_LONGITUDINAL_CONTROLLERS;
            return dynamicConfig?.path_lateral_controllers || PATH_LATERAL_CONTROLLERS;
        } else {
            if (category === 'longitudinal') return dynamicConfig?.leader_longitudinal_controllers || LEADER_LONGITUDINAL_CONTROLLERS;
            return dynamicConfig?.leader_lateral_controllers || LEADER_LATERAL_CONTROLLERS;
        }
    };

    const renderTuningSection = (category: 'longitudinal' | 'lateral', controllerType: string, params: Record<string, any>, setParams: any) => {
        const schema = getSchema(controllerType, vehicle.telemetry.config_data?.controller_params);
        const options = getControllerOptions(category) as string[];

        return (
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-3 space-y-3">
                {/* Header & Controller Selector */}
                <div className="flex items-center justify-between border-b border-slate-700/50 pb-3 mb-2">
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${category === 'longitudinal' ? 'bg-blue-500' : 'bg-emerald-500'}`}></div>
                        <h4 className="text-sm font-semibold text-slate-200 capitalize">{category}</h4>
                    </div>

                    <div className="flex items-center gap-2">
                        <select
                            value={controllerType}
                            onChange={(e) => handleSetController(category, e.target.value)}
                            className="bg-slate-900 border border-slate-600 text-slate-200 text-xs rounded px-2 py-1 outline-none focus:border-indigo-500 transition-colors"
                        >
                            {options.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Parameters Grid */}
                {!schema || schema.length === 0 ? (
                    <div className="text-xs text-slate-500 italic py-2 text-center">
                        No tuning parameters available for {controllerType}
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
                            {schema.map(param => (
                                <div key={param.key} className="flex flex-col gap-1">
                                    <span className="text-[10px] text-slate-400 font-medium tracking-wide" title={param.description || param.key}>
                                        {param.label}
                                    </span>
                                    {renderParamInput(param, params[param.key], (k, v) => setParams((prev: any) => ({ ...prev, [k]: v })))}
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={() => handleApplyParams(category)}
                            className="w-full bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 font-medium text-xs px-3 py-2 rounded-lg transition-all flex items-center justify-center gap-2"
                        >
                            <Sliders size={14} />
                            Apply {controllerType.toUpperCase()} Params
                        </button>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 shadow-2xl rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/10 rounded-lg">
                            <Settings2 size={20} className="text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white tracking-tight">Controller Settings</h2>
                            <p className="text-xs text-slate-400">Configure routing and parameters for {vehicle.name}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-800 bg-slate-900/50 px-5 pt-2 gap-4">
                    <button
                        onClick={() => setActiveTab('path')}
                        className={`pb-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'path'
                            ? 'border-indigo-500 text-indigo-400'
                            : 'border-transparent text-slate-400 hover:text-slate-200'
                            }`}
                    >
                        Following Path
                    </button>
                    <button
                        onClick={() => setActiveTab('leader')}
                        className={`pb-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'leader'
                            ? 'border-indigo-500 text-indigo-400'
                            : 'border-transparent text-slate-400 hover:text-slate-200'
                            }`}
                    >
                        Following Leader
                    </button>

                    <div className="ml-auto flex items-center text-xs text-slate-500 gap-1 pb-3">
                        <RefreshCw size={12} className="animate-spin-slow" /> Synced with telemetry
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="p-5 overflow-y-auto custom-scrollbar flex-1 bg-slate-900/50 space-y-5">
                    {renderTuningSection('longitudinal', activeLongCtrl, longParams, setLongParams)}
                    {renderTuningSection('lateral', activeLatCtrl, latParams, setLatParams)}
                </div>

            </div>
        </div>
    );
};

export default ControllerSettingsModal;
