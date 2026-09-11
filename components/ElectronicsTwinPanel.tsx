import React, { useEffect, useState } from 'react';
import { CircuitBoard, RotateCcw, Zap } from 'lucide-react';
import { Vehicle } from '../types';
import { bridgeService } from '../services/websocketBridgeService';

interface ElectronicsTwinPanelProps {
    vehicle: Vehicle;
}

const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));

const ElectronicsTwinPanel: React.FC<ElectronicsTwinPanelProps> = ({ vehicle }) => {
    const status = vehicle.telemetry.electronics;
    const [bus, setBus] = useState<'sensor_compute' | 'vehicle' | 'v2v_radio'>('sensor_compute');
    const [v2vMode, setV2VMode] = useState<'mirror' | 'firmware'>('firmware');
    const [coreMode, setCoreMode] = useState<'shadow' | 'native_authority'>('shadow');
    const [delayMs, setDelayMs] = useState(0);
    const [jitterMs, setJitterMs] = useState(0);
    const [dropPercent, setDropPercent] = useState(0);
    const [bitErrorRate, setBitErrorRate] = useState(0);
    const [sensor, setSensor] = useState<'imu' | 'gnss' | 'magnetometer'>('imu');
    const [sensorMode, setSensorMode] = useState<'none' | 'dropout' | 'freeze' | 'bias' | 'noise_scale'>('none');
    const [sensorValue, setSensorValue] = useState(0);
    const [inputVoltage, setInputVoltage] = useState(12);
    const [feedback, setFeedback] = useState('');

    useEffect(() => {
        if (status?.v2v?.mode) setV2VMode(status.v2v.mode);
    }, [status?.v2v?.mode]);

    useEffect(() => {
        if (status?.embedded_core?.mode) setCoreMode(status.embedded_core.mode);
    }, [status?.embedded_core?.mode]);

    const applyBusFault = () => {
        const sent = bridgeService.setElectronicsBusFault(vehicle.id, bus, {
            enabled: true,
            fixed_delay_s: Math.max(0, delayMs) / 1000,
            jitter_s: Math.max(0, jitterMs) / 1000,
            drop_probability: clamp(dropPercent, 0, 100) / 100,
            bit_error_rate: clamp(bitErrorRate, 0, 1),
        });
        setFeedback(sent ? 'Bus fault command sent.' : 'Bridge is not connected.');
    };

    const applySensorFault = () => {
        const sent = bridgeService.setElectronicsSensorFault(
            vehicle.id, sensor, sensorMode, sensorValue
        );
        setFeedback(sent ? 'Sensor fault command sent.' : 'Bridge is not connected.');
    };

    const applyPower = () => {
        const sent = bridgeService.setElectronicsInputVoltage(
            vehicle.id, Math.max(0, inputVoltage)
        );
        setFeedback(sent ? 'Input voltage command sent.' : 'Bridge is not connected.');
    };

    const resetTwin = () => {
        const sent = bridgeService.resetElectronicsTwin(vehicle.id);
        setFeedback(sent ? 'Electronics reset command sent.' : 'Bridge is not connected.');
    };

    const applyV2VMode = () => {
        const sent = bridgeService.setElectronicsV2VMode(vehicle.id, v2vMode);
        setFeedback(sent ? 'V2V path mode command sent.' : 'Bridge is not connected.');
    };

    const applyCoreMode = () => {
        const sent = bridgeService.setEmbeddedCoreMode(vehicle.id, coreMode);
        setFeedback(sent
            ? 'Embedded-core mode requested; verify the authority telemetry below.'
            : 'Bridge is not connected.');
    };

    const resetCoreParity = () => {
        const sent = bridgeService.resetEmbeddedCoreParity(vehicle.id);
        setFeedback(sent
            ? 'Parity evidence reset; core returned to Shadow.'
            : 'Bridge is not connected.');
    };

    const sendNominalPreset = () => [
        bridgeService.setElectronicsBusFault(vehicle.id, 'sensor_compute', {
            enabled: true, fixed_delay_s: 0, jitter_s: 0,
            drop_probability: 0, bit_error_rate: 0,
        }),
        bridgeService.setElectronicsBusFault(vehicle.id, 'vehicle', {
            enabled: true, fixed_delay_s: 0, jitter_s: 0,
            drop_probability: 0, bit_error_rate: 0,
        }),
        bridgeService.setElectronicsBusFault(vehicle.id, 'v2v_radio', {
            enabled: true, fixed_delay_s: 0, jitter_s: 0,
            drop_probability: 0, bit_error_rate: 0,
        }),
        bridgeService.setElectronicsSensorFault(vehicle.id, 'imu', 'none', 0),
        bridgeService.setElectronicsSensorFault(vehicle.id, 'gnss', 'none', 0),
        bridgeService.setElectronicsSensorFault(vehicle.id, 'magnetometer', 'none', 0),
        bridgeService.setElectronicsInputVoltage(vehicle.id, 12),
    ].every(Boolean);

    const applyPreset = (preset: 'nominal' | 'delay' | 'loss' | 'gnss' | 'brownout') => {
        const nominalSent = sendNominalPreset();
        let sent = nominalSent;
        if (preset === 'delay') {
            sent = bridgeService.setElectronicsBusFault(vehicle.id, 'v2v_radio', {
                enabled: true, fixed_delay_s: 0.08, jitter_s: 0.02,
                drop_probability: 0, bit_error_rate: 0,
            }) && sent;
        } else if (preset === 'loss') {
            sent = bridgeService.setElectronicsBusFault(vehicle.id, 'v2v_radio', {
                enabled: true, fixed_delay_s: 0, jitter_s: 0,
                drop_probability: 0.3, bit_error_rate: 0,
            }) && sent;
        } else if (preset === 'gnss') {
            sent = bridgeService.setElectronicsSensorFault(
                vehicle.id, 'gnss', 'dropout', 0
            ) && sent;
        } else if (preset === 'brownout') {
            sent = bridgeService.setElectronicsInputVoltage(vehicle.id, 2) && sent;
        }
        setFeedback(sent
            ? `Preset ${preset.toUpperCase()} sent.`
            : 'One or more preset commands were not sent.');
    };

    const sensorNode = status?.hardware_target?.sensor_node;
    const computeNode = status?.hardware_target?.compute_node;

    return (
        <div className="space-y-3 pt-3 border-t border-slate-700">
            <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <CircuitBoard size={13} /> Electronics Digital Twin
                </p>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${status?.healthy
                    ? 'text-emerald-300 border-emerald-700 bg-emerald-950/40'
                    : 'text-amber-300 border-amber-800 bg-amber-950/40'}`}>
                    {status ? (status.healthy ? 'HEALTHY' : 'FAULT') : 'NO DATA'}
                </span>
            </div>

            {status && (
                <div className="grid grid-cols-2 gap-1 text-[10px] font-mono bg-slate-900/60 border border-slate-800 rounded p-2">
                    <span className="text-slate-500">Hardware target</span>
                    <span className="text-slate-200" title={status.target_id}>
                        {status.target_profile ?? 'legacy'} / {status.topology ?? 'dual_node'}
                    </span>
                    <span className="text-slate-500">Sensor node</span>
                    <span className="text-slate-200" title={`${sensorNode?.architecture ?? ''} / ${sensorNode?.runtime ?? ''}`}>
                        {sensorNode?.platform ?? 'NAV legacy'} / {status.sensor_node_state ?? status.nav_mcu_state}
                    </span>
                    <span className="text-slate-500">Compute node</span>
                    <span className="text-slate-200" title={`${computeNode?.architecture ?? ''} / ${computeNode?.runtime ?? ''}`}>
                        {computeNode?.platform ?? 'COM legacy'} / {status.compute_node_state ?? status.com_mcu_state}
                    </span>
                    <span className="text-slate-500">Power</span>
                    <span className="text-slate-200">{status.input_voltage_v.toFixed(2)} V → {status.rail_3v3_v.toFixed(2)} V</span>
                    <span className="text-slate-500">Links</span>
                    <span className="text-slate-200">{(status.sensor_compute_interface ?? status.nav_com_interface).toUpperCase()} / {status.vehicle_interface.toUpperCase()}</span>
                    <span className="text-slate-500">Execution / Firmware</span>
                    <span className="text-slate-200">{status.execution_mode ?? 'legacy'} / {status.firmware_backend}</span>
                    {status.firmware_backend === 'hil_external' && <>
                        <span className="text-slate-500">HIL handshake</span>
                        <span className={status.hil?.handshake_ready && status.hil?.link_alive ? 'text-emerald-300' : 'text-rose-300'} title={status.hil?.capability_negotiation?.blockers?.join('; ')}>
                            {status.hil?.handshake_ready && status.hil?.link_alive
                                ? `READY / ${status.hil.capability_negotiation.remote_platform ?? 'external target'}`
                                : 'BLOCKED'}
                        </span>
                    </>}
                    <span className="text-slate-500">Sensor frames</span>
                    <span className="text-slate-200">{status.nav_frames_delivered} ok, {status.nav_frames_dropped} drop, {status.nav_decode_errors} decode</span>
                    <span className="text-slate-500">V2V path</span>
                    <span className="text-slate-200">{status.v2v?.mode ?? 'not attached'} · {status.v2v?.radio_tx_delivered ?? 0} TX / {status.v2v?.host_rx_delivered ?? 0} RX</span>
                    <span className="text-slate-500">Trust/Observer core</span>
                    <span className={status.embedded_core?.parity_pass ? 'text-emerald-300' : 'text-amber-300'}>
                        {status.embedded_core
                            ? `${status.embedded_core.available ? (status.embedded_core.authority_active ? 'C++ AUTHORITY' : 'C++ shadow') : 'unavailable'} / ${status.embedded_core.comparisons} checks / ${status.embedded_core.failures} fail`
                            : 'not attached'}
                    </span>
                    {status.embedded_core?.available && <>
                        <span className="text-slate-500">T / W / C / P checks</span>
                        <span className="text-slate-200">
                            {status.embedded_core.trust_comparisons} / {status.embedded_core.weight_comparisons} / {status.embedded_core.observer_comparisons} / {status.embedded_core.prediction_comparisons}
                        </span>
                        <span className="text-slate-500">Max T / W / C / P error</span>
                        <span className="text-slate-200">
                            {status.embedded_core.max_trust_error.toExponential(1)} / {status.embedded_core.max_weight_error.toExponential(1)} / {status.embedded_core.max_state_error.toExponential(1)} / {status.embedded_core.max_prediction_error.toExponential(1)}
                        </span>
                        <span className="text-slate-500">Authority gate</span>
                        <span className={status.embedded_core.authority_ready ? 'text-emerald-300' : 'text-amber-300'} title={status.embedded_core.authority_blockers.join('; ')}>
                            {status.embedded_core.authority_ready
                                ? 'READY'
                                : `BLOCKED / ${status.embedded_core.authority_min_comparisons_per_stage} per stage`}
                        </span>
                        <span className="text-slate-500">Safety failback</span>
                        <span className={status.embedded_core.failback_count > 0 ? 'text-rose-300' : 'text-slate-200'} title={status.embedded_core.last_failback_reason ?? ''}>
                            {status.embedded_core.failback_count > 0
                                ? `${status.embedded_core.failback_count} / ${status.embedded_core.last_failback_stage}`
                                : 'armed / no trip'}
                        </span>
                        <span className="text-slate-500">Native T / W / C / P used</span>
                        <span className="text-slate-200">
                            {status.embedded_core.native_trust_uses} / {status.embedded_core.native_weight_uses} / {status.embedded_core.native_correction_uses} / {status.embedded_core.native_prediction_uses}
                        </span>
                    </>}
                </div>
            )}

            <div className="flex gap-2">
                <select value={v2vMode} onChange={e => setV2VMode(e.target.value as 'mirror' | 'firmware')} className="flex-1 bg-slate-900 border border-slate-700 text-xs rounded px-2 py-1">
                    <option value="firmware">V2V through compute target</option>
                    <option value="mirror">V2V host mirror compatibility</option>
                </select>
                <button onClick={applyV2VMode} className="bg-cyan-700 hover:bg-cyan-600 text-white text-xs rounded px-2 py-1">Set V2V path</button>
            </div>

            <div className="flex gap-2">
                <select value={coreMode} onChange={e => setCoreMode(e.target.value as 'shadow' | 'native_authority')} className="flex-1 bg-slate-900 border border-slate-700 text-xs rounded px-2 py-1">
                    <option value="shadow">C++ Shadow (Python authority)</option>
                    <option value="native_authority" disabled={!status?.embedded_core?.authority_ready}>C++ Native authority</option>
                </select>
                <button onClick={applyCoreMode} className="bg-emerald-700 hover:bg-emerald-600 disabled:bg-slate-700 text-white text-xs rounded px-2 py-1" disabled={!status?.embedded_core?.available}>Apply core</button>
                <button onClick={resetCoreParity} className="bg-slate-700 hover:bg-slate-600 text-white text-xs rounded px-2 py-1">Reset parity</button>
            </div>

            <div>
                <p className="text-[10px] text-slate-500 mb-1">Repeatable fault presets</p>
                <div className="grid grid-cols-5 gap-1">
                    <button onClick={() => applyPreset('nominal')} className="bg-emerald-800 hover:bg-emerald-700 text-white text-[10px] rounded px-1 py-1">Nominal</button>
                    <button onClick={() => applyPreset('delay')} className="bg-indigo-700 hover:bg-indigo-600 text-white text-[10px] rounded px-1 py-1">V2V delay</button>
                    <button onClick={() => applyPreset('loss')} className="bg-indigo-700 hover:bg-indigo-600 text-white text-[10px] rounded px-1 py-1">V2V loss</button>
                    <button onClick={() => applyPreset('gnss')} className="bg-amber-700 hover:bg-amber-600 text-white text-[10px] rounded px-1 py-1">GNSS drop</button>
                    <button onClick={() => applyPreset('brownout')} className="bg-rose-800 hover:bg-rose-700 text-white text-[10px] rounded px-1 py-1">Brownout</button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <select value={bus} onChange={e => setBus(e.target.value as typeof bus)} className="bg-slate-900 border border-slate-700 text-xs rounded px-2 py-1">
                    <option value="sensor_compute">Sensor ↔ Compute</option>
                    <option value="vehicle">Compute ↔ Vehicle</option>
                    <option value="v2v_radio">Compute ↔ V2V Radio</option>
                </select>
                <button onClick={applyBusFault} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded px-2 py-1">Apply bus fault</button>
                <label className="text-[10px] text-slate-500">Delay ms<input type="number" min="0" value={delayMs} onChange={e => setDelayMs(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded px-2 py-1" /></label>
                <label className="text-[10px] text-slate-500">Jitter ms<input type="number" min="0" value={jitterMs} onChange={e => setJitterMs(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded px-2 py-1" /></label>
                <label className="text-[10px] text-slate-500">Drop %<input type="number" min="0" max="100" value={dropPercent} onChange={e => setDropPercent(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded px-2 py-1" /></label>
                <label className="text-[10px] text-slate-500">Bit error rate<input type="number" min="0" max="1" step="0.000001" value={bitErrorRate} onChange={e => setBitErrorRate(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded px-2 py-1" /></label>
            </div>

            <div className="grid grid-cols-4 gap-1">
                <select value={sensor} onChange={e => setSensor(e.target.value as typeof sensor)} className="bg-slate-900 border border-slate-700 text-[10px] rounded px-1 py-1">
                    <option value="imu">IMU</option><option value="gnss">GNSS</option><option value="magnetometer">MAG</option>
                </select>
                <select value={sensorMode} onChange={e => setSensorMode(e.target.value as typeof sensorMode)} className="bg-slate-900 border border-slate-700 text-[10px] rounded px-1 py-1">
                    <option value="none">none</option><option value="dropout">dropout</option><option value="freeze">freeze</option><option value="bias">bias</option><option value="noise_scale">noise ×</option>
                </select>
                <input type="number" value={sensorValue} onChange={e => setSensorValue(Number(e.target.value))} className="bg-slate-900 border border-slate-700 text-xs rounded px-2 py-1" title="Fault value" />
                <button onClick={applySensorFault} className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] rounded px-1 py-1">Apply sensor</button>
            </div>

            <div className="flex gap-2">
                <label className="flex-1 text-[10px] text-slate-500">Input voltage
                    <input type="number" min="0" step="0.1" value={inputVoltage} onChange={e => setInputVoltage(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded px-2 py-1" />
                </label>
                <button onClick={applyPower} className="self-end flex items-center gap-1 bg-amber-700 hover:bg-amber-600 text-white text-[10px] rounded px-2 py-1.5"><Zap size={11} /> Set power</button>
                <button onClick={resetTwin} className="self-end flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-white text-[10px] rounded px-2 py-1.5"><RotateCcw size={11} /> Reset</button>
            </div>
            {feedback && <p className="text-[10px] text-slate-400">{feedback}</p>}
        </div>
    );
};

export default ElectronicsTwinPanel;
