import React, { useState, useEffect } from 'react';
import { CONTROLLER_SCHEMAS, ParamDef, getSchema } from '../config/controllerConfig';
import { bridgeService } from '../services/websocketBridgeService';
import { Sliders } from 'lucide-react';
import { Vehicle } from '../types';

interface ControllerTuningPanelProps {
    vehicle: Vehicle;
    longController: string;
    latController: string;
}

const ControllerTuningPanel: React.FC<ControllerTuningPanelProps> = ({
    vehicle,
    longController,
    latController
}) => {
    // We maintain state for the current configuration of both controllers
    const [longParams, setLongParams] = useState<Record<string, any>>({});
    const [latParams, setLatParams] = useState<Record<string, any>>({});

    // We also need to know whether the user wants to apply changes to the 'path' context or 'leader' context
    const [stateContext, setStateContext] = useState<'path' | 'leader'>('path');

    // Initialize params when controller type changes
    useEffect(() => {
        const schema = getSchema(longController, vehicle.telemetry.config_data?.controller_params);
        if (schema && schema.length > 0) {
            const initial: Record<string, any> = {};
            schema.forEach(p => { initial[p.key] = p.defaultValue; });
            setLongParams(initial);
        } else {
            setLongParams({});
        }
    }, [longController, vehicle.telemetry.config_data]);

    useEffect(() => {
        const schema = getSchema(latController, vehicle.telemetry.config_data?.controller_params);
        if (schema && schema.length > 0) {
            const initial: Record<string, any> = {};
            schema.forEach(p => { initial[p.key] = p.defaultValue; });
            setLatParams(initial);
        } else {
            setLatParams({});
        }
    }, [latController, vehicle.telemetry.config_data]);

    const handleLongParamChange = (key: string, value: any) => {
        setLongParams(prev => ({ ...prev, [key]: value }));
    };

    const handleLatParamChange = (key: string, value: any) => {
        setLatParams(prev => ({ ...prev, [key]: value }));
    };

    const handleApplyAll = (category: 'longitudinal' | 'lateral') => {
        const params = category === 'longitudinal' ? longParams : latParams;
        if (Object.keys(params).length > 0) {
            bridgeService.setControllerParams(category, params, stateContext, vehicle.id);
        }
    };

    const renderParamInput = (param: ParamDef, value: any, onChange: (key: string, val: any) => void) => {
        if (param.type === 'boolean') {
            return (
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={!!value}
                        onChange={(e) => onChange(param.key, e.target.checked)}
                        className="w-4 h-4 rounded text-indigo-500 bg-slate-800 border-slate-600"
                    />
                    <span className="text-xs text-slate-300">Enabled</span>
                </label>
            );
        }

        return (
            <div className="flex flex-col gap-1 w-full">
                <input
                    type="number"
                    value={value ?? 0}
                    onChange={(e) => onChange(param.key, parseFloat(e.target.value))}
                    min={param.min}
                    max={param.max}
                    step={param.step}
                    className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                />
            </div>
        );
    };

    const renderControllerSection = (category: 'longitudinal' | 'lateral', controllerType: string, params: Record<string, any>, onChange: (key: string, val: any) => void) => {
        const schema = getSchema(controllerType, vehicle.telemetry.config_data?.controller_params);

        if (!schema || schema.length === 0) {
            return (
                <div className="text-xs text-slate-500 italic py-2">
                    No tuning parameters available for {controllerType}
                </div>
            );
        }

        return (
            <div className="space-y-3">
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    {schema.map(param => (
                        <div key={param.key} className="flex flex-col gap-1">
                            <span className="text-[10px] text-slate-400 font-medium" title={param.description || param.key}>
                                {param.label}
                            </span>
                            {renderParamInput(param, params[param.key], onChange)}
                        </div>
                    ))}
                </div>
                <button
                    onClick={() => handleApplyAll(category)}
                    className="w-full bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 font-medium text-xs px-3 py-2 rounded-lg transition-all flex items-center justify-center gap-2"
                >
                    <Sliders size={14} />
                    Apply {controllerType.toUpperCase()} Params
                </button>
            </div>
        );
    };

    return (
        <div className="space-y-4 pt-3 border-t border-slate-700">
            <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <Sliders size={12} /> Controller Tuning
                </p>
                <select
                    value={stateContext}
                    onChange={(e) => setStateContext(e.target.value as 'path' | 'leader')}
                    className="bg-slate-900 border border-slate-700 text-slate-200 text-[10px] rounded px-2 py-1 outline-none focus:border-indigo-500 uppercase font-medium"
                >
                    <option value="path">Following Path</option>
                    <option value="leader">Following Leader</option>
                </select>
            </div>

            <div className="space-y-4">
                <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-3 space-y-3">
                    <div className="flex items-center gap-2 border-b border-slate-700/50 pb-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        <h4 className="text-xs font-semibold text-slate-300">Longitudinal: {longController.toUpperCase()}</h4>
                    </div>
                    {renderControllerSection('longitudinal', longController, longParams, handleLongParamChange)}
                </div>

                <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-3 space-y-3">
                    <div className="flex items-center gap-2 border-b border-slate-700/50 pb-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                        <h4 className="text-xs font-semibold text-slate-300">Lateral: {latController.toUpperCase()}</h4>
                    </div>
                    {renderControllerSection('lateral', latController, latParams, handleLatParamChange)}
                </div>
            </div>
        </div>
    );
};

export default ControllerTuningPanel;
