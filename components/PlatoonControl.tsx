
import React, { useState } from 'react';
import { Users, Play, Shield, Link2, XCircle } from 'lucide-react';
import { bridgeService } from '../services/websocketBridgeService';
import { Vehicle } from '../types';

interface PlatoonControlProps {
    vehicles: Vehicle[];
    onClose: () => void;
}

const PlatoonControl: React.FC<PlatoonControlProps> = ({ vehicles, onClose }) => {
    const [leaderId, setLeaderId] = useState<string>('');
    const [followers, setFollowers] = useState<string[]>([]);
    const [gap, setGap] = useState<number>(1.0);
    const [status, setStatus] = useState<'idle' | 'configuring' | 'ready' | 'active'>('idle');

    const availableFollowers = vehicles.filter(v => v.id !== leaderId);

    const toggleFollower = (id: string) => {
        setFollowers(prev =>
            prev.includes(id) ? prev.filter(fid => fid !== id) : [...prev, id]
        );
    };

    const handleSetup = async () => {
        if (!leaderId || followers.length === 0) return;
        setStatus('configuring');

        // 1. Enable Leader
        bridgeService.enablePlatoonLeader(leaderId);

        // 2. Enable Followers (with slight delay or async)
        followers.forEach(fid => {
            bridgeService.enablePlatoonFollower(fid, parseInt(leaderId.replace(/\D/g, '')), gap);
        });

        // Assume success for UI feedback
        setTimeout(() => setStatus('ready'), 500);
    };

    const handleStart = () => {
        if (!leaderId) return;
        // Trigger start on leader (or all?)
        // Typically triggering leader starts the platoon logic
        bridgeService.startPlatoon(leaderId, parseInt(leaderId.replace(/\D/g, '')));
        setStatus('active');
    };

    const handleDisband = () => {
        [leaderId, ...followers].forEach(id => {
            // Send disable platoon command (Assuming sendCommand handles raw types well now)
            bridgeService.sendCommand('disable_platoon', id);
        });
        setStatus('idle');
    };

    return (
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 flex flex-col gap-4 shadow-xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <h3 className="font-bold text-slate-200 flex items-center gap-2">
                    <Link2 size={20} className="text-emerald-400" />
                    Platoon Configuration
                </h3>
                <button onClick={onClose} className="text-gray-500 hover:text-white">
                    <XCircle size={18} />
                </button>
            </div>

            <div className="flex flex-col gap-4">

                {/* Leader Selection */}
                <div>
                    <label className="text-xs text-slate-400 block mb-1">Select Leader</label>
                    <select
                        value={leaderId}
                        onChange={(e) => {
                            setLeaderId(e.target.value);
                            setFollowers([]); // Reset followers if leader changes
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-white focus:border-emerald-500 outline-none"
                        disabled={status === 'active'}
                    >
                        <option value="">-- Choose Leader --</option>
                        {vehicles.map(v => (
                            <option key={v.id} value={v.id}>{v.name} ({v.id})</option>
                        ))}
                    </select>
                </div>

                {/* Follower Selection */}
                <div className="flex-1">
                    <label className="text-xs text-slate-400 block mb-1">Select Followers (Order Matters)</label>
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-2 max-h-[150px] overflow-y-auto space-y-1">
                        {availableFollowers.length === 0 && <span className="text-xs text-slate-600 italic p-1">No other vehicles available</span>}
                        {availableFollowers.map(v => (
                            <div
                                key={v.id}
                                onClick={() => status !== 'active' && toggleFollower(v.id)}
                                className={`p-2 rounded cursor-pointer text-sm flex justify-between items-center
                            ${followers.includes(v.id) ? 'bg-emerald-900/30 border border-emerald-800 text-emerald-200' : 'bg-slate-900 border border-transparent text-slate-400 hover:bg-slate-800'}
                        `}
                            >
                                <span>{v.name}</span>
                                {followers.includes(v.id) && <span className="text-[10px] bg-emerald-900 px-1.5 rounded">#{followers.indexOf(v.id) + 1}</span>}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Gap Setting */}
                <div>
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>Gap Distance</span>
                        <span>{gap.toFixed(1)} m</span>
                    </div>
                    <input
                        type="range" min="0.5" max="5.0" step="0.1"
                        value={gap} onChange={(e) => setGap(parseFloat(e.target.value))}
                        className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                        disabled={status === 'active'}
                    />
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2 mt-2">
                    {status === 'idle' || status === 'configuring' ? (
                        <button
                            onClick={handleSetup}
                            disabled={!leaderId || followers.length === 0}
                            className="col-span-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2"
                        >
                            <Shield size={16} /> Deploy Configuration
                        </button>
                    ) : status === 'ready' ? (
                        <>
                            <button
                                onClick={handleStart}
                                className="col-span-2 bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 animate-pulse"
                            >
                                <Play size={16} /> START PLATOON
                            </button>
                            <button
                                onClick={handleDisband}
                                className="col-span-2 text-xs text-slate-500 hover:text-red-400"
                            >
                                Cancel / Disband
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={handleDisband}
                            className="col-span-2 bg-red-900/50 border border-red-800 text-red-300 hover:bg-red-800 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2"
                        >
                            <XCircle size={16} /> DISBAND PLATOON
                        </button>
                    )}
                </div>

            </div>
        </div>
    );
};

export default PlatoonControl;
