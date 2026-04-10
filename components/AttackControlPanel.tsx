import React, { useState } from 'react';
import { Skull, Play, XCircle, AlertTriangle } from 'lucide-react';
import { bridgeService } from '../services/websocketBridgeService';
import { Vehicle } from '../types';

interface AttackControlPanelProps {
    vehicles: Vehicle[];
    onClose: () => void;
}

const ATTACK_TYPES = [
    'Bogus',
    'DoS',
    'Velocity',
    'Position',
    'Acceleration',
    'Heading'
];

const AttackControlPanel: React.FC<AttackControlPanelProps> = ({ vehicles, onClose }) => {
    const [attackType, setAttackType] = useState<string>('Bogus');
    const [caseNum, setCaseNum] = useState<number>(1);
    const [attackerId, setAttackerId] = useState<string>('');
    const [victims, setVictims] = useState<string[]>([]);
    const [dataType, setDataType] = useState<string>('local');
    const [status, setStatus] = useState<'idle' | 'active'>('idle');

    const availableVictims = vehicles.filter(v => v.id !== attackerId);

    const toggleVictim = (id: string) => {
        setVictims(prev =>
            prev.includes(id) ? prev.filter(vid => vid !== id) : [...prev, id]
        );
    };

    const handleTrigger = () => {
        if (!attackerId) return;
        
        const attackerIdNum = attackerId === 'all'
            ? -1
            : (parseInt(attackerId.replace(/\\D/g, '')) || parseInt(attackerId));
        const victimIdsNum = victims.map(v => parseInt(v.replace(/\\D/g, '')) || parseInt(v));

        bridgeService.triggerAttack(
            attackerId, // Target the selected attacker vehicle(s) to enact the attack scenario
            attackType,
            caseNum,
            attackerIdNum,
            victimIdsNum,
            dataType
        );
        
        setStatus('active');
    };

    const handleDisable = () => {
        // Send disable command to everyone to be safe, or just the attacker
        if (attackerId) {
            bridgeService.disableAttack(attackerId);
        } else {
            bridgeService.disableAttack('all');
        }
        setStatus('idle');
    };

    return (
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 flex flex-col gap-4 shadow-xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <h3 className="font-bold text-slate-200 flex items-center gap-2">
                    <Skull size={20} className="text-red-500" />
                    V2V Attack Control
                </h3>
                <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                    <XCircle size={18} />
                </button>
            </div>

            <div className="flex flex-col gap-4">
                {/* Attacker Selection */}
                <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">Select Attacker</label>
                    <select
                        value={attackerId}
                        onChange={(e) => {
                            setAttackerId(e.target.value);
                            setVictims([]); // Reset victims if attacker changes
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-white focus:border-red-500 outline-none transition-colors"
                        disabled={status === 'active'}
                    >
                        <option value="">-- Choose Attacker --</option>
                        <option value="all">Every Vehicle (Global Attack)</option>
                        {vehicles.map(v => (
                            <option key={v.id} value={v.id}>{v.name} ({v.id})</option>
                        ))}
                    </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    {/* Attack Type */}
                    <div>
                        <label className="text-xs font-semibold text-slate-400 block mb-1">Attack Type</label>
                        <select
                            value={attackType}
                            onChange={(e) => setAttackType(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-white focus:border-red-500 outline-none"
                            disabled={status === 'active'}
                        >
                            {ATTACK_TYPES.map(type => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                    </div>

                    {/* Case Number */}
                    <div>
                        <label className="text-xs font-semibold text-slate-400 block mb-1">Case Number</label>
                        <input
                            type="number"
                            min="1"
                            max="10"
                            value={caseNum}
                            onChange={(e) => setCaseNum(parseInt(e.target.value))}
                            className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-white focus:border-red-500 outline-none"
                            disabled={status === 'active'}
                        />
                    </div>
                </div>

                {/* Victim Selection */}
                <div className="flex-1">
                    <label className="text-xs font-semibold text-slate-400 block mb-1">Select Victims</label>
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-2 max-h-[120px] overflow-y-auto space-y-1">
                        {availableVictims.length === 0 && <span className="text-xs text-slate-600 italic p-1">No other vehicles</span>}
                        {availableVictims.map(v => (
                            <div
                                key={v.id}
                                onClick={() => status !== 'active' && toggleVictim(v.id)}
                                className={`p-2 rounded cursor-pointer text-sm flex justify-between items-center transition-colors
                                    ${victims.includes(v.id) ? 'bg-red-900/30 border border-red-800 text-red-200' : 'bg-slate-900 border border-transparent text-slate-400 hover:bg-slate-800'}
                                `}
                            >
                                <span>{v.name}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Data Type Modification */}
                <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">Target Dimension</label>
                    <select
                        value={dataType}
                        onChange={(e) => setDataType(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-white focus:border-red-500 outline-none"
                        disabled={status === 'active'}
                    >
                        <option value="local">Local State Only</option>
                        <option value="fleet">Fleet State Only</option>
                        <option value="both">Both</option>
                    </select>
                </div>

                {/* Actions */}
                <div className="mt-2 pt-4 border-t border-slate-800">
                    {status === 'idle' ? (
                        <button
                            onClick={handleTrigger}
                            disabled={!attackerId}
                            className="w-full bg-red-700 hover:bg-red-600 disabled:bg-slate-800 disabled:text-slate-500 text-white py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-lg shadow-red-900/20"
                        >
                            <AlertTriangle size={16} /> TRIGGER ATTACK
                        </button>
                    ) : (
                        <button
                            onClick={handleDisable}
                            className="w-full bg-amber-600 hover:bg-amber-500 text-white py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-lg shadow-amber-900/20"
                        >
                            <XCircle size={16} /> DISABLE ATTACK / RESTORE
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AttackControlPanel;
