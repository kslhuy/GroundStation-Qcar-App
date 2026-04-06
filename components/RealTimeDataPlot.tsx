import React, { useEffect, useRef, useState } from 'react';
import { Vehicle } from '../types';
import { Activity, TrendingUp, Gauge, MapPin } from 'lucide-react';

interface RealTimeDataPlotProps {
    vehicles: Vehicle[];
    selectedVehicleId: string | null;
    mode: 'local' | 'fleet';
}

interface DataPoint {
    time: number;
    value: number;
}

interface PlotData {
    velocity: DataPoint[];
    acceleration: DataPoint[];
    throttle: DataPoint[];
    steering: DataPoint[];
    x: DataPoint[];
    y: DataPoint[];
}

export const RealTimeDataPlot: React.FC<RealTimeDataPlotProps> = ({
    vehicles,
    selectedVehicleId,
    mode
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [localData, setLocalData] = useState<Map<string, PlotData>>(new Map());
    const [fleetData, setFleetData] = useState<Map<string, PlotData>>(new Map());
    const maxDataPoints = 1000; // 20 seconds at 50Hz (Safety margin over 15s window)
    const timeWindow = 15; // seconds to display

    useEffect(() => {
        setFleetData(new Map());
        setLocalData(new Map());
    }, [selectedVehicleId, mode]);

    // Helper to create empty PlotData
    const createEmptyPlotData = (): PlotData => ({
        velocity: [],
        acceleration: [],
        throttle: [],
        steering: [],
        x: [],
        y: []
    });

    // Update data buffers
    useEffect(() => {
        const now = Date.now() / 1000;

        if (mode === 'local' && selectedVehicleId) {
            const vehicle = vehicles.find(v => v.id === selectedVehicleId);
            if (vehicle) {
                setLocalData(prev => {
                    const newData = new Map<string, PlotData>(prev);
                    const vehicleData: PlotData = newData.get(vehicle.id) ?? createEmptyPlotData();

                    // Add new data points
                    vehicleData.velocity.push({ time: now, value: vehicle.telemetry.velocity });
                    vehicleData.acceleration.push({ time: now, value: vehicle.telemetry.acceleration ?? 0 });
                    vehicleData.throttle.push({ time: now, value: vehicle.telemetry.throttle });
                    vehicleData.steering.push({ time: now, value: vehicle.telemetry.steering });
                    vehicleData.x.push({ time: now, value: vehicle.telemetry.x });
                    vehicleData.y.push({ time: now, value: vehicle.telemetry.y });

                    // Trim old data immutably and avoid slow O(N) shift
                    Object.keys(vehicleData).forEach(key => {
                        const arr = vehicleData[key as keyof PlotData];
                        if (arr.length > maxDataPoints) {
                            (vehicleData as any)[key] = arr.slice(arr.length - maxDataPoints);
                        }
                    });

                    newData.set(vehicle.id, vehicleData);
                    return newData;
                });
            }
        } else if (mode === 'fleet') {
            setFleetData(prev => {
                const newData = new Map<string, PlotData>(prev);
                
                // Target the selected vehicle to view the fleet from its perspective.
                // If none selected, default to the first available vehicle.
                const observerVehicle = selectedVehicleId 
                    ? vehicles.find(v => v.id === selectedVehicleId) 
                    : vehicles[0];

                if (!observerVehicle) return newData;

                const fleetEst = (observerVehicle.telemetry as any).fleet_estimation;

                if (fleetEst) {
                    // We iterate up to a reasonable max fleet size or dynamic
                    for (let i = 0; i < 10; i++) {
                        const hasX = `fleet_x_${i}` in fleetEst;
                        if (!hasX) continue; // skip if car i doesn't exist in estimation

                        // Use a specific ID like "observed-0" for the state estimation
                        const fakeVehicleId = `observed-${i}`;
                        const vehicleData: PlotData = newData.get(fakeVehicleId) ?? createEmptyPlotData();

                        // Some estimators produce 'fleet_v' or 'fleet_velocity', try to be flexible
                        const v = fleetEst[`fleet_velocity_${i}`] ?? fleetEst[`fleet_v_${i}`] ?? 0;
                        const thLoc = fleetEst[`fleet_throttle_${i}`] ?? 0;
                        const stLoc = fleetEst[`fleet_steering_${i}`] ?? fleetEst[`fleet_theta_${i}`] ?? 0; // Use theta if steering missing
                        const xLoc = fleetEst[`fleet_x_${i}`] ?? 0;
                        const yLoc = fleetEst[`fleet_y_${i}`] ?? 0;

                        vehicleData.velocity.push({ time: now, value: v });
                        vehicleData.acceleration.push({ time: now, value: 0 }); // Not available in fleet estimate yet
                        vehicleData.throttle.push({ time: now, value: thLoc });
                        vehicleData.steering.push({ time: now, value: stLoc });
                        vehicleData.x.push({ time: now, value: xLoc });
                        vehicleData.y.push({ time: now, value: yLoc });

                        // Shift is O(N), use slice instead
                        Object.keys(vehicleData).forEach(key => {
                            const arr = vehicleData[key as keyof PlotData];
                            if (arr.length > maxDataPoints) {
                                (vehicleData as any)[key] = arr.slice(arr.length - maxDataPoints);
                            }
                        });

                        newData.set(fakeVehicleId, vehicleData);
                    }
                } else {
                    // Fallback: If no fleet estimation data is found, show actual telemetry
                    vehicles.forEach(vehicle => {
                        const vehicleData: PlotData = newData.get(vehicle.id) ?? createEmptyPlotData();

                        vehicleData.velocity.push({ time: now, value: vehicle.telemetry.velocity });
                        vehicleData.acceleration.push({ time: now, value: vehicle.telemetry.acceleration ?? 0 });
                        vehicleData.throttle.push({ time: now, value: vehicle.telemetry.throttle });
                        vehicleData.steering.push({ time: now, value: vehicle.telemetry.steering });
                        vehicleData.x.push({ time: now, value: vehicle.telemetry.x });
                        vehicleData.y.push({ time: now, value: vehicle.telemetry.y });

                        Object.keys(vehicleData).forEach(key => {
                            const arr = vehicleData[key as keyof PlotData];
                            if (arr.length > maxDataPoints) {
                                (vehicleData as any)[key] = arr.slice(arr.length - maxDataPoints);
                            }
                        });

                        newData.set(vehicle.id, vehicleData);
                    });
                }
                
                return newData;
            });
        }
    }, [vehicles, selectedVehicleId, mode]);

    // Render plots
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const container = canvas.parentElement;
        if (container) {
            // Set canvas size to match container
            const rect = container.getBoundingClientRect();
            // Subtract padding if any, the container has padding. 
            // Better yet, remove padding from container or account for it.
            // The container has p-4 (16px), so rect.width - 32
            canvas.width = rect.width - 32;
            canvas.height = rect.height - 32;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;

        // Clear canvas
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, width, height);

        const now = Date.now() / 1000;
        const startTime = now - timeWindow;

        if (mode === 'local' && selectedVehicleId) {
            renderLocalPlot(ctx, width, height, startTime, now);
        } else if (mode === 'fleet') {
            renderFleetPlot(ctx, width, height, startTime, now);
        }
    }, [localData, fleetData, selectedVehicleId, mode]);

    const renderLocalPlot = (
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
        startTime: number,
        endTime: number
    ) => {
        if (!selectedVehicleId) return;

        const data = localData.get(selectedVehicleId);
        if (!data) return;

        const leftMargin = 45;
        const rightMargin = 20;
        const topMargin = 20;
        const bottomMargin = 20;
        const gap = 35; // space between plots

        // 2-row layout
        const rowHeight = (height - topMargin - bottomMargin - gap) / 2;

        // Top row
        const topColWidth = (width - leftMargin - rightMargin - gap) / 2;
        drawTrajectoryPlot(ctx, leftMargin, topMargin, topColWidth, rowHeight, data);
        drawTimePlot(ctx, leftMargin + topColWidth + gap, topMargin, topColWidth, rowHeight,
            data.velocity, 'Velocity [m/s]', '#3b82f6', startTime, endTime, 0, 2);

        // Bottom row
        const bottomColWidth = (width - leftMargin - rightMargin - 2 * gap) / 3;
        const row2Y = topMargin + rowHeight + gap;
        drawTimePlot(ctx, leftMargin, row2Y, bottomColWidth, rowHeight,
            data.throttle, 'Throttle', '#22c55e', startTime, endTime, -1, 1);
        drawTimePlot(ctx, leftMargin + bottomColWidth + gap, row2Y, bottomColWidth, rowHeight,
            data.steering, 'Steering', '#ef4444', startTime, endTime, -1, 1);
        drawTimePlot(ctx, leftMargin + 2 * (bottomColWidth + gap), row2Y, bottomColWidth, rowHeight,
            data.acceleration, '|a| [m/s^2]', '#a855f7', startTime, endTime, 0, 5);
    };

    const renderFleetPlot = (
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
        startTime: number,
        endTime: number
    ) => {
        const leftMargin = 45;
        const rightMargin = 20;
        const topMargin = 20;
        const bottomMargin = 20;
        const gap = 35;

        const colWidth = (width - leftMargin - rightMargin - gap) / 2;
        const rowHeight = (height - topMargin - bottomMargin - gap) / 2;

        // Row 1: Fleet Trajectories, Fleet Velocities
        drawFleetTrajectories(ctx, leftMargin, topMargin, colWidth, rowHeight);
        drawFleetVelocities(ctx, leftMargin + colWidth + gap, topMargin, colWidth, rowHeight,
            startTime, endTime);

        // Row 2: Fleet Throttle, Fleet Steering
        const row2Y = topMargin + rowHeight + gap;
        drawFleetControls(ctx, leftMargin, row2Y, colWidth, rowHeight,
            startTime, endTime, 'throttle', 'Fleet Throttle', -1, 1);
        drawFleetControls(ctx, leftMargin + colWidth + gap, row2Y, colWidth, rowHeight,
            startTime, endTime, 'steering', 'Fleet Steering', -1, 1);
    };

    const drawTrajectoryPlot = (
        ctx: CanvasRenderingContext2D,
        x: number, y: number, w: number, h: number,
        data: PlotData
    ) => {
        // Background
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(x, y, w, h);

        // Grid
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 10; i++) {
            ctx.beginPath();
            ctx.moveTo(x + (w * i / 10), y);
            ctx.lineTo(x + (w * i / 10), y + h);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x, y + (h * i / 10));
            ctx.lineTo(x + w, y + (h * i / 10));
            ctx.stroke();
        }

        // Draw Data Lines

        // Title (Rendered over grid and lines)
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.font = '12px Inter';
        const labelStr = 'Trajectory (X-Y)';
        const textWidth = ctx.measureText(labelStr).width;
        ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
        ctx.fillRect(x + 2, y + 2, textWidth + 8, 18);
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(labelStr, x + 6, y + 14);

        // Plot X-Y
        if (data.x.length > 0 && data.y.length > 0) {
            const xRange = 12; // -6 to 6
            const yRange = 6;  // -3 to 3
            const xOffset = 6;
            const yOffset = 3;

            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 2;
            ctx.beginPath();

            data.x.forEach((point, i) => {
                if (i >= data.y.length) return;
                const px = x + ((point.value + xOffset) / xRange) * w;
                const py = y + h - ((data.y[i].value + yOffset) / yRange) * h;

                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            });

            ctx.stroke();

            // Draw head marker
            if (data.x.length > 0) {
                const lastX = data.x[data.x.length - 1].value;
                const lastY = data.y[data.y.length - 1].value;
                const px = x + ((lastX + xOffset) / xRange) * w;
                const py = y + h - ((lastY + yOffset) / yRange) * h;

                ctx.fillStyle = '#3b82f6';
                ctx.beginPath();
                ctx.arc(px, py, 4, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Center marker
        const centerX = x + w / 2;
        const centerY = y + h / 2;
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
        ctx.fill();
    };

    const drawTimePlot = (
        ctx: CanvasRenderingContext2D,
        x: number, y: number, w: number, h: number,
        data: DataPoint[],
        label: string,
        color: string,
        startTime: number,
        endTime: number,
        minVal: number,
        maxVal: number
    ) => {
        // Background
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(x, y, w, h);

        // Grid
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 5; i++) {
            ctx.beginPath();
            ctx.moveTo(x, y + (h * i / 5));
            ctx.lineTo(x + w, y + (h * i / 5));
            ctx.stroke();
        }
        for (let i = 0; i <= 10; i++) {
            ctx.beginPath();
            ctx.moveTo(x + (w * i / 10), y);
            ctx.lineTo(x + (w * i / 10), y + h);
            ctx.stroke();
        }

        // Draw Data Lines
        if (data.length > 0) {
            const filteredData = data.filter(p => p.time >= startTime && p.time <= endTime);

            if (filteredData.length > 1) {
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.beginPath();

                filteredData.forEach((point, i) => {
                    const px = x + ((point.time - startTime) / (endTime - startTime)) * w;
                    const py = y + h - ((point.value - minVal) / (maxVal - minVal)) * h;

                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                });

                ctx.stroke();
            }
        }

        // Title (Rendered after grid & data lines to prevent overlay issue)
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.font = '11px Inter';
        const textWidth = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(30, 41, 59, 0.85)'; // semi-transparent background
        ctx.fillRect(x + 2, y + 2, textWidth + 8, 18);
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(label, x + 6, y + 14);

        // Draw Y-axis labels
        ctx.fillStyle = '#64748b'; // slate-500
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        // Draw 3 labels: Max, Mid, Min
        const labelX = x - 5;

        // Max
        ctx.fillText(maxVal.toFixed(1), labelX, y);

        // Mid
        ctx.fillText(((maxVal + minVal) / 2).toFixed(1), labelX, y + h / 2);

        // Min
        ctx.fillText(minVal.toFixed(1), labelX, y + h);

        // Border
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, w, h);
    };

    const drawFleetTrajectories = (
        ctx: CanvasRenderingContext2D,
        x: number, y: number, w: number, h: number
    ) => {
        // Background
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(x, y, w, h);

        // Grid
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 10; i++) {
            ctx.beginPath();
            ctx.moveTo(x + (w * i / 10), y);
            ctx.lineTo(x + (w * i / 10), y + h);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x, y + (h * i / 10));
            ctx.lineTo(x + w, y + (h * i / 10));
            ctx.stroke();
        }

        // Title
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.font = '12px Inter';
        const labelStr = 'Fleet Trajectories';
        const textWidth = ctx.measureText(labelStr).width;
        ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
        ctx.fillRect(x + 2, y + 2, textWidth + 8, 18);
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(labelStr, x + 6, y + 14);

        // Colors for different vehicles
        const colors = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];
        const xRange = 12;
        const yRange = 6;
        const xOffset = 6;
        const yOffset = 3;

        let colorIndex = 0;
        fleetData.forEach((data, vehicleId) => {
            const color = colors[colorIndex % colors.length];

            if (data.x.length > 0 && data.y.length > 0) {
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.beginPath();

                data.x.forEach((point, i) => {
                    if (i >= data.y.length) return;
                    const px = x + ((point.value + xOffset) / xRange) * w;
                    const py = y + h - ((data.y[i].value + yOffset) / yRange) * h;

                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                });

                ctx.stroke();

                // Head marker
                if (data.x.length > 0) {
                    const lastX = data.x[data.x.length - 1].value;
                    const lastY = data.y[data.y.length - 1].value;
                    const px = x + ((lastX + xOffset) / xRange) * w;
                    const py = y + h - ((lastY + yOffset) / yRange) * h;

                    ctx.fillStyle = color;
                    ctx.beginPath();
                    ctx.arc(px, py, 5, 0, Math.PI * 2);
                    ctx.fill();

                    // Vehicle label
                    ctx.fillStyle = '#e2e8f0';
                    ctx.font = 'bold 10px Inter';
                    ctx.fillText(`V${colorIndex}`, px + 8, py + 4);
                }
            }

            colorIndex++;
        });

        // Center marker
        const centerX = x + w / 2;
        const centerY = y + h / 2;
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
        ctx.fill();
    };

    const drawFleetVelocities = (
        ctx: CanvasRenderingContext2D,
        x: number, y: number, w: number, h: number,
        startTime: number,
        endTime: number
    ) => {
        // Background
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(x, y, w, h);

        // Grid
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 5; i++) {
            ctx.beginPath();
            ctx.moveTo(x, y + (h * i / 5));
            ctx.lineTo(x + w, y + (h * i / 5));
            ctx.stroke();
        }
        for (let i = 0; i <= 10; i++) {
            ctx.beginPath();
            ctx.moveTo(x + (w * i / 10), y);
            ctx.lineTo(x + (w * i / 10), y + h);
            ctx.stroke();
        }

        // Colors
        const colors = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];
        let colorIndex = 0;

        fleetData.forEach((data, vehicleId) => {
            const color = colors[colorIndex % colors.length];
            const velocityData = data.velocity.filter(p => p.time >= startTime && p.time <= endTime);

            if (velocityData.length > 1) {
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.beginPath();

                velocityData.forEach((point, i) => {
                    const px = x + ((point.time - startTime) / (endTime - startTime)) * w;
                    const py = y + h - ((point.value - 0) / 2) * h; // 0-2 m/s range

                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                });

                ctx.stroke();
            }

            colorIndex++;
        });

        // Title
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.font = '11px Inter';
        const labelStr = 'Fleet Velocities [m/s]';
        const textWidth = ctx.measureText(labelStr).width;
        ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
        ctx.fillRect(x + 2, y + 2, textWidth + 8, 18);
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(labelStr, x + 6, y + 14);

        // Draw Y-axis labels
        ctx.fillStyle = '#64748b'; // slate-500
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        // Fleet vel range is fixed 0-2 (from code: (point.value - 0) / 2)
        const minVal = 0;
        const maxVal = 2;
        const labelX = x - 5;

        ctx.fillText(maxVal.toFixed(1), labelX, y);
        ctx.fillText(((maxVal + minVal) / 2).toFixed(1), labelX, y + h / 2);
        ctx.fillText(minVal.toFixed(1), labelX, y + h);

        // Border
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, w, h);
    };

    const drawFleetControls = (
        ctx: CanvasRenderingContext2D,
        x: number, y: number, w: number, h: number,
        startTime: number,
        endTime: number,
        field: 'throttle' | 'steering',
        label: string,
        minVal: number,
        maxVal: number
    ) => {
        // Background
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(x, y, w, h);

        // Grid
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 5; i++) {
            ctx.beginPath();
            ctx.moveTo(x, y + (h * i / 5));
            ctx.lineTo(x + w, y + (h * i / 5));
            ctx.stroke();
        }
        for (let i = 0; i <= 10; i++) {
            ctx.beginPath();
            ctx.moveTo(x + (w * i / 10), y);
            ctx.lineTo(x + (w * i / 10), y + h);
            ctx.stroke();
        }

        // Colors
        const colors = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];
        let colorIndex = 0;

        fleetData.forEach((data, vehicleId) => {
            const color = colors[colorIndex % colors.length];
            const points = data[field].filter(p => p.time >= startTime && p.time <= endTime);

            if (points.length > 1) {
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.beginPath();

                points.forEach((point, i) => {
                    const px = x + ((point.time - startTime) / (endTime - startTime)) * w;
                    // Normalize to height: (val - min) / (max - min)
                    const py = y + h - ((point.value - minVal) / (maxVal - minVal)) * h;

                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                });

                ctx.stroke();
            }

            colorIndex++;
        });

        // Title 
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.font = '11px Inter';
        const textWidth = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
        ctx.fillRect(x + 2, y + 2, textWidth + 8, 18);
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(label, x + 6, y + 14);

        // Draw Y-axis labels
        ctx.fillStyle = '#64748b'; // slate-500
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        // Draw 3 labels: Max, Mid, Min
        const labelX = x - 5;

        ctx.fillText(maxVal.toFixed(1), labelX, y);
        ctx.fillText(((maxVal + minVal) / 2).toFixed(1), labelX, y + h / 2);
        ctx.fillText(minVal.toFixed(1), labelX, y + h);

        // Border
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, w, h);
    };

    const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);

    return (
        <div className="h-full bg-slate-950 flex flex-col">
            {/* Header */}
            <div className="px-4 py-2 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Activity size={16} className="text-indigo-400" />
                    <h3 className="text-sm font-semibold text-slate-200">
                        {mode === 'local' ? 'Local State Data' : 'Fleet State Data'}
                    </h3>
                    {mode === 'local' && selectedVehicle && (
                        <span className="text-xs text-slate-400">- {selectedVehicle.name}</span>
                    )}
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                    <div className="flex items-center gap-1">
                        <TrendingUp size={12} />
                        <span>{timeWindow}s window</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Gauge size={12} />
                        <span>50Hz</span>
                    </div>
                </div>
            </div>

            {/* Canvas */}
            <div className="flex-1 relative p-4 w-full h-full overflow-hidden">
                <canvas
                    ref={canvasRef}
                    className="block rounded-lg shadow-inner bg-slate-900 border border-slate-700"
                />

                {mode === 'local' && !selectedVehicleId && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center text-slate-500">
                            <MapPin size={32} className="mx-auto mb-2 opacity-50" />
                            <p className="text-sm">Select a vehicle to view local state data</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
