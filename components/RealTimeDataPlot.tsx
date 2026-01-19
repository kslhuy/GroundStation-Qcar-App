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
    const maxDataPoints = 300; // 6 seconds at 50Hz
    const timeWindow = 15; // seconds to display

    // Helper to create empty PlotData
    const createEmptyPlotData = (): PlotData => ({
        velocity: [],
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
                    const newData = new Map(prev);
                    const vehicleData: PlotData = newData.get(vehicle.id) ?? createEmptyPlotData();

                    // Add new data points
                    vehicleData.velocity.push({ time: now, value: vehicle.telemetry.velocity });
                    vehicleData.throttle.push({ time: now, value: vehicle.telemetry.throttle });
                    vehicleData.steering.push({ time: now, value: vehicle.telemetry.steering });
                    vehicleData.x.push({ time: now, value: vehicle.telemetry.x });
                    vehicleData.y.push({ time: now, value: vehicle.telemetry.y });

                    // Trim old data
                    Object.keys(vehicleData).forEach(key => {
                        const arr = vehicleData[key as keyof PlotData];
                        while (arr.length > maxDataPoints) arr.shift();
                    });

                    newData.set(vehicle.id, vehicleData);
                    return newData;
                });
            }
        } else if (mode === 'fleet') {
            setFleetData(prev => {
                const newData = new Map(prev);
                vehicles.forEach(vehicle => {
                    const vehicleData: PlotData = newData.get(vehicle.id) ?? createEmptyPlotData();

                    vehicleData.velocity.push({ time: now, value: vehicle.telemetry.velocity });
                    vehicleData.x.push({ time: now, value: vehicle.telemetry.x });
                    vehicleData.y.push({ time: now, value: vehicle.telemetry.y });

                    Object.keys(vehicleData).forEach(key => {
                        const arr = vehicleData[key as keyof PlotData];
                        while (arr.length > maxDataPoints) arr.shift();
                    });

                    newData.set(vehicle.id, vehicleData);
                });
                return newData;
            });
        }
    }, [vehicles, selectedVehicleId, mode]);

    // Render plots
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

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

        // Layout: 3x3 grid similar to Python GS
        const margin = 40;
        const plotWidth = (width - 4 * margin) / 3;
        const plotHeight = (height - 4 * margin) / 3;

        // Row 1: Trajectory (2 cols), Velocity
        drawTrajectoryPlot(ctx, margin, margin, plotWidth * 2 + margin, plotHeight * 2 + margin, data);
        drawTimePlot(ctx, margin * 2 + plotWidth * 2, margin, plotWidth, plotHeight,
            data.velocity, 'Velocity [m/s]', '#3b82f6', startTime, endTime, 0, 2);

        // Row 2: Heading (skip for now - need theta data)

        // Row 3: Controls
        const ctrlY = margin * 2 + plotHeight * 2;
        drawTimePlot(ctx, margin, ctrlY, plotWidth, plotHeight,
            data.throttle, 'Throttle', '#22c55e', startTime, endTime, -1, 1);
        drawTimePlot(ctx, margin * 2 + plotWidth, ctrlY, plotWidth, plotHeight,
            data.steering, 'Steering', '#ef4444', startTime, endTime, -1, 1);
    };

    const renderFleetPlot = (
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
        startTime: number,
        endTime: number
    ) => {
        const margin = 40;
        const plotWidth = (width - 3 * margin) / 2;
        const plotHeight = (height - 3 * margin) / 2;

        // Row 1: Fleet Trajectories (left), Fleet Velocities (right)
        drawFleetTrajectories(ctx, margin, margin, plotWidth, plotHeight * 2 + margin);
        drawFleetVelocities(ctx, margin * 2 + plotWidth, margin, plotWidth, plotHeight,
            startTime, endTime);
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

        // Title
        ctx.fillStyle = '#94a3b8';
        ctx.font = '12px Inter';
        ctx.fillText('Trajectory (X-Y)', x + 5, y + 15);

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

        // Title
        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px Inter';
        ctx.fillText(label, x + 5, y + 15);

        // Plot data
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
        ctx.fillStyle = '#94a3b8';
        ctx.font = '12px Inter';
        ctx.fillText('Fleet Trajectories', x + 5, y + 15);

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

        // Title
        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px Inter';
        ctx.fillText('Fleet Velocities [m/s]', x + 5, y + 15);

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
            <div className="flex-1 relative p-4">
                <canvas
                    ref={canvasRef}
                    width={1200}
                    height={800}
                    className="w-full h-full rounded-lg border border-slate-700"
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
