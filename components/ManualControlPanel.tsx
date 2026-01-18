
import React, { useState, useEffect, useRef } from 'react';
import { Joystick } from 'react-joystick-component';
import { IJoystickUpdateEvent } from 'react-joystick-component/build/lib/Joystick';
import { Gamepad2, Keyboard, MoveVertical, MoveHorizontal } from 'lucide-react';
import { bridgeService } from '../services/websocketBridgeService';

interface ManualControlPanelProps {
    vehicleId: string;
    onClose: () => void;
}

const ManualControlPanel: React.FC<ManualControlPanelProps> = ({ vehicleId, onClose }) => {
    const [mode, setMode] = useState<'keyboard' | 'joystick'>('joystick'); // Default to Joystick per request
    const [throttle, setThrottle] = useState(0);
    const [steering, setSteering] = useState(0);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // Track keys pressed for smooth keyboard control
    const keysPressed = useRef<{ [key: string]: boolean }>({});

    useEffect(() => {
        // Enable manual mode on mount
        bridgeService.enableManualMode(vehicleId, mode);
        console.log(`Manual mode enabled for ${vehicleId} (${mode})`);

        return () => {
            // Disable on unmount
            if (intervalRef.current) clearInterval(intervalRef.current);
            bridgeService.disableManualMode(vehicleId);
            console.log(`Manual mode disabled for ${vehicleId}`);
        };
    }, [vehicleId]);

    useEffect(() => {
        // Switch internal mode if updated
        bridgeService.enableManualMode(vehicleId, mode);
    }, [mode, vehicleId]);

    // -- Keyboard Logic --
    useEffect(() => {
        if (mode !== 'keyboard') return;

        const handleKeyDown = (e: KeyboardEvent) => {
            keysPressed.current[e.key] = true;
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            keysPressed.current[e.key] = false;
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        // Control Loop for Smooth Ramping
        intervalRef.current = setInterval(() => {
            let targetThrottle = 0;
            let targetSteering = 0;

            if (keysPressed.current['w'] || keysPressed.current['ArrowUp']) targetThrottle = 0.3;
            if (keysPressed.current['s'] || keysPressed.current['ArrowDown']) targetThrottle = -0.3;
            if (keysPressed.current['a'] || keysPressed.current['ArrowLeft']) targetSteering = 0.5;
            if (keysPressed.current['d'] || keysPressed.current['ArrowRight']) targetSteering = -0.5;

            // Simple implementation: Instant update (can add ramping later)
            setThrottle(targetThrottle);
            setSteering(targetSteering);

            if (targetThrottle !== 0 || targetSteering !== 0) {
                bridgeService.sendManualControl(targetThrottle, targetSteering, vehicleId);
            } else {
                // Send zero command if established connection to ensure stop
                bridgeService.sendManualControl(0, 0, vehicleId);
            }
        }, 50); // 20Hz

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [mode, vehicleId]);

    // -- Joystick Logic --
    // Left Stick: Throttle (Y-axis only)
    const handleThrottleMove = (event: IJoystickUpdateEvent) => {
        if (mode !== 'joystick') return;
        const y = event.y ?? 0;
        setThrottle(y);
        bridgeService.sendManualControl(y, steering, vehicleId);
    };

    // Right Stick: Steering (X-axis only)
    const handleSteeringMove = (event: IJoystickUpdateEvent) => {
        if (mode !== 'joystick') return;
        const x = event.x ?? 0;
        setSteering(x);
        bridgeService.sendManualControl(throttle, x, vehicleId);
    };

    const handleStop = () => {
        // If both released, we might set both to 0, but this fires individually.
        // We rely on state. ideally we'd track active touch but simplistic approach:
        // If this is called, we don't know which one stopped easily without more state logic or just setting that specific axis to 0
        // But react-joystick-component `stop` event doesn't tell us which stick if we have two.
        // So we create separate handlers.
    };

    const handleThrottleStop = () => {
        setThrottle(0);
        bridgeService.sendManualControl(0, steering, vehicleId);
    }

    const handleSteeringStop = () => {
        setSteering(0);
        bridgeService.sendManualControl(throttle, 0, vehicleId);
    }


    return (
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 flex flex-col gap-4 shadow-xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <h3 className="font-bold text-slate-200 flex items-center gap-2">
                    <Gamepad2 size={20} className="text-indigo-400" />
                    Manual Control: <span className="text-white">{vehicleId}</span>
                </h3>
                <button onClick={onClose} className="text-xs text-red-400 hover:text-red-300 border border-red-900 px-2 py-1 rounded">
                    EXIT
                </button>
            </div>

            {/* Mode Switcher */}
            <div className="flex bg-slate-950 p-1 rounded-lg">
                <button
                    onClick={() => setMode('joystick')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded text-xs font-semibold
            ${mode === 'joystick' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    <Gamepad2 size={14} /> Dual Stick
                </button>
                <button
                    onClick={() => setMode('keyboard')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded text-xs font-semibold
            ${mode === 'keyboard' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    <Keyboard size={14} /> Keyboard
                </button>
            </div>

            <div className="flex-1 min-h-[180px] flex items-center justify-center gap-6 bg-slate-950/50 rounded-xl border border-slate-800/50 relative overflow-hidden p-4">

                {mode === 'joystick' ? (
                    <>
                        {/* Left Stick: Throttle */}
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1"><MoveVertical size={10} /> Throttle</span>
                            <Joystick
                                size={80}
                                baseColor="#1e293b"
                                stickColor="#6366f1"
                                move={handleThrottleMove}
                                stop={handleThrottleStop}
                                controlPlaneShape="axisY" // Limit to Y axis
                            />
                        </div>

                        {/* Right Stick: Steering */}
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1"><MoveHorizontal size={10} /> Steering</span>
                            <Joystick
                                size={80}
                                baseColor="#1e293b"
                                stickColor="#10b981"
                                move={handleSteeringMove}
                                stop={handleSteeringStop}
                                controlPlaneShape="axisX" // Limit to X axis
                            />
                        </div>
                    </>
                ) : (
                    <div className="text-center text-slate-500 text-xs">
                        Use WASD or Arrow Keys
                    </div>
                )}

            </div>

            <div className="flex justify-between px-2 text-[10px] font-mono text-slate-400">
                <span>THRO: {throttle.toFixed(2)}</span>
                <span>STR: {steering.toFixed(2)}</span>
            </div>

        </div>
    );
};

export default ManualControlPanel;
