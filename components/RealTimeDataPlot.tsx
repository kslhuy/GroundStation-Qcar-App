import React, { useEffect, useRef, useState } from 'react';
import { Vehicle } from '../types';
import { Activity, TrendingUp, Gauge, MapPin, Upload, Play, Pause, RotateCcw } from 'lucide-react';

interface RealTimeDataPlotProps {
    vehicles: Vehicle[];
    selectedVehicleId: string | null;
    mode: 'local' | 'fleet' | 'playback';
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

interface PlaybackLog {
    fileName: string;
    duration: number;
    sampleCount: number;
    timeSamples: number[];
    vehicleIds: number[];
    hostVehicleId: number | null;
    focusVehicleId: number;
    data: Map<string, PlotData>;
    series: Map<string, DataPoint[]>;
}

interface PlaybackLine {
    key: string;
    label: string;
    color: string;
    dashed?: boolean;
    stepped?: boolean;
    width?: number;
}

interface PlotBounds {
    min: number;
    max: number;
}

interface PlotRect {
    x: number;
    y: number;
    w: number;
    h: number;
}

const createEmptyPlotData = (): PlotData => ({
    velocity: [],
    acceleration: [],
    throttle: [],
    steering: [],
    x: [],
    y: []
});

const parseCsvLine = (line: string): string[] => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const next = line[i + 1];

        if (char === '"' && inQuotes && next === '"') {
            current += '"';
            i++;
        } else if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            values.push(current);
            current = '';
        } else {
            current += char;
        }
    }

    values.push(current);
    return values;
};

const parseFiniteNumber = (value: string | undefined): number | null => {
    if (value === undefined) return null;
    const trimmed = value.trim();
    if (!trimmed || trimmed.toLowerCase() === 'nan') return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
};

const extractVehicleIds = (headers: string[]): number[] => {
    const ids = new Set<number>();
    headers.forEach(header => {
        const match = header.match(/^(?:vehicle_present|est_x|est_y|est_theta|est_v|est_a|trust|gtrust|w_neighbor)_(\d+)$/);
        if (match) ids.add(Number(match[1]));
    });
    return Array.from(ids).sort((a, b) => a - b);
};

const buildPlaybackColumns = (vehicleIds: number[]): string[] => {
    const columns = new Set([
        'w0',
        'w_self',
        'total_neighbor_weight',
        'trusted_neighbor_count',
        'active_vehicle_count',
        'is_turning',
        'v2v_attack_active',
        'v2v_attack_active_count'
    ]);

    const prefixes = [
        'vehicle_present',
        'trust',
        'gtrust',
        'local_trust',
        'global_trust',
        'w_neighbor',
        'pred_mode',
        'est_x',
        'est_y',
        'est_v',
        'est_a',
        'est_theta',
        'v_score',
        'd_score',
        'a_score',
        'h_score',
        'b_score',
        'q_factor',
        'gamma_host',
        'gamma_local_peer',
        'gamma_self',
        'flag_attack',
        'flag_local',
        'flag_global',
        'rel_meas_used_global',
        'yolo_rel_meas_used_global'
    ];

    vehicleIds.forEach(vehicleId => {
        prefixes.forEach(prefix => columns.add(`${prefix}_${vehicleId}`));
    });

    return Array.from(columns);
};

const parseTrustPlaybackCsv = (csvText: string, fileName: string): PlaybackLog => {
    const cleanedLines = csvText
        .replace(/\0/g, '')
        .split(/\r?\n/)
        .filter(line => line.trim().length > 0 && line.length < 131072);

    if (cleanedLines.length < 2) {
        throw new Error('CSV does not contain data rows.');
    }

    const headers = parseCsvLine(cleanedLines[0]).map(header => header.trim());
    const timeIndex = headers.indexOf('time');
    if (timeIndex < 0) {
        throw new Error('CSV is missing the required time column.');
    }

    const vehicleIds = extractVehicleIds(headers);
    if (vehicleIds.length === 0) {
        throw new Error('No vehicle columns were found in the trust log.');
    }

    const columnIndex = new Map<string, number>();
    headers.forEach((header, index) => columnIndex.set(header, index));

    const data = new Map<string, PlotData>();
    const series = new Map<string, DataPoint[]>();
    vehicleIds.forEach(id => data.set(`playback-${id}`, createEmptyPlotData()));
    buildPlaybackColumns(vehicleIds).forEach(column => series.set(column, []));

    let firstTime: number | null = null;
    let lastTime = 0;
    const timeSamples: number[] = [];

    for (let lineIndex = 1; lineIndex < cleanedLines.length; lineIndex++) {
        const cells = parseCsvLine(cleanedLines[lineIndex]);
        const rawTime = parseFiniteNumber(cells[timeIndex]);
        if (rawTime === null) continue;

        if (firstTime === null) firstTime = rawTime;
        const time = Math.max(0, rawTime - firstTime);
        if (time < lastTime) continue;
        lastTime = time;
        timeSamples.push(time);

        series.forEach((points, column) => {
            const value = parseFiniteNumber(cells[columnIndex.get(column) ?? -1]);
            if (value !== null) {
                points.push({ time, value });
            }
        });

        vehicleIds.forEach(vehicleId => {
            const vehicleData = data.get(`playback-${vehicleId}`);
            if (!vehicleData) return;

            const valueFor = (column: string) => parseFiniteNumber(cells[columnIndex.get(column) ?? -1]);
            const present = valueFor(`vehicle_present_${vehicleId}`);
            const estX = valueFor(`est_x_${vehicleId}`);
            const estY = valueFor(`est_y_${vehicleId}`);
            const estV = valueFor(`est_v_${vehicleId}`);
            const estA = valueFor(`est_a_${vehicleId}`);
            const estTheta = valueFor(`est_theta_${vehicleId}`);

            if (present !== null && present <= 0 && estX === null && estY === null && estV === null) return;

            if (estX !== null) vehicleData.x.push({ time, value: estX });
            if (estY !== null) vehicleData.y.push({ time, value: estY });
            if (estV !== null) vehicleData.velocity.push({ time, value: estV });
            if (estA !== null) vehicleData.acceleration.push({ time, value: estA });
            if (estTheta !== null) vehicleData.steering.push({ time, value: estTheta });
            vehicleData.throttle.push({ time, value: valueFor('w_self') ?? valueFor(`w_neighbor_${vehicleId}`) ?? 0 });
        });
    }

    const activeVehicleIds = vehicleIds.filter(vehicleId => {
        const vehicleData = data.get(`playback-${vehicleId}`);
        const present = series.get(`vehicle_present_${vehicleId}`);
        return (!!present && present.some(point => point.value > 0)) || (!!vehicleData && (
            vehicleData.x.length > 0 ||
            vehicleData.y.length > 0 ||
            vehicleData.velocity.length > 0 ||
            (series.get(`trust_${vehicleId}`)?.length ?? 0) > 0 ||
            (series.get(`gtrust_${vehicleId}`)?.length ?? 0) > 0
        ));
    });

    activeVehicleIds.forEach(vehicleId => {
        const vehicleData = data.get(`playback-${vehicleId}`);
        if (!vehicleData) return;
        if (vehicleData.throttle.length > 0 && vehicleData.velocity.length === 0) {
            vehicleData.throttle = [];
        }
    });

    const activeData = new Map<string, PlotData>();
    activeVehicleIds.forEach(vehicleId => {
        const vehicleData = data.get(`playback-${vehicleId}`);
        if (vehicleData) activeData.set(`playback-${vehicleId}`, vehicleData);
    });

    if (activeData.size === 0 || lastTime <= 0) {
        throw new Error('No valid estimated vehicle state samples were found.');
    }

    const hostMatch = fileName.match(/V(\d+)(?:\.[^.]+)?$/);
    const hostVehicleId = hostMatch ? Number(hostMatch[1]) : null;
    const focusCandidates = hostVehicleId === null
        ? activeVehicleIds
        : activeVehicleIds.filter(vehicleId => vehicleId !== hostVehicleId);
    const focusVehicleId = focusCandidates[0] ?? activeVehicleIds[0];

    return {
        fileName,
        duration: lastTime,
        sampleCount: cleanedLines.length - 1,
        timeSamples,
        vehicleIds: activeVehicleIds,
        hostVehicleId,
        focusVehicleId,
        data: activeData,
        series
    };
};

const filterPlotDataUntil = (source: Map<string, PlotData>, endTime: number): Map<string, PlotData> => {
    const sliceUntil = (points: DataPoint[]) => {
        let low = 0;
        let high = points.length;

        while (low < high) {
            const mid = Math.floor((low + high) / 2);
            if (points[mid].time <= endTime) low = mid + 1;
            else high = mid;
        }

        return points.slice(0, low);
    };

    const filtered = new Map<string, PlotData>();
    source.forEach((data, vehicleId) => {
        filtered.set(vehicleId, {
            velocity: sliceUntil(data.velocity),
            acceleration: sliceUntil(data.acceleration),
            throttle: sliceUntil(data.throttle),
            steering: sliceUntil(data.steering),
            x: sliceUntil(data.x),
            y: sliceUntil(data.y)
        });
    });
    return filtered;
};

export const RealTimeDataPlot: React.FC<RealTimeDataPlotProps> = ({
    vehicles,
    selectedVehicleId,
    mode
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const animationFrameRef = useRef<number | null>(null);
    const lastFrameTimeRef = useRef<number | null>(null);
    const [localData, setLocalData] = useState<Map<string, PlotData>>(new Map());
    const [fleetData, setFleetData] = useState<Map<string, PlotData>>(new Map());
    const [playbackLog, setPlaybackLog] = useState<PlaybackLog | null>(null);
    const [playbackTime, setPlaybackTime] = useState(0);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [isPlaybackPlaying, setIsPlaybackPlaying] = useState(false);
    const [playbackError, setPlaybackError] = useState<string | null>(null);
    const maxDataPoints = 1000; // 20 seconds at 50Hz (Safety margin over 15s window)
    const timeWindow = 15; // seconds to display

    useEffect(() => {
        setFleetData(new Map());
        setLocalData(new Map());
    }, [selectedVehicleId, mode]);

    useEffect(() => {
        if (mode !== 'playback' || !playbackLog || !isPlaybackPlaying) {
            lastFrameTimeRef.current = null;
            return;
        }

        const animate = (timestamp: number) => {
            if (lastFrameTimeRef.current === null) {
                lastFrameTimeRef.current = timestamp;
            }

            const deltaSeconds = ((timestamp - lastFrameTimeRef.current) / 1000) * playbackSpeed;
            lastFrameTimeRef.current = timestamp;

            setPlaybackTime(currentTime => {
                const nextTime = Math.min(playbackLog.duration, currentTime + deltaSeconds);
                if (nextTime >= playbackLog.duration) {
                    return 0;
                }
                return nextTime;
            });

            animationFrameRef.current = requestAnimationFrame(animate);
        };

        animationFrameRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationFrameRef.current !== null) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            animationFrameRef.current = null;
        };
    }, [mode, playbackLog, playbackSpeed, isPlaybackPlaying]);

    useEffect(() => {
        if (mode !== 'playback') {
            setIsPlaybackPlaying(false);
        }
    }, [mode]);

    useEffect(() => {
        if (mode !== 'playback' || !playbackLog) return;

        const handlePlaybackKey = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            if (target && ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(target.tagName)) return;

            if (event.key === ' ' || event.key === 'Spacebar') {
                event.preventDefault();
                setIsPlaybackPlaying(isPlaying => !isPlaying);
            } else if (event.key === 'ArrowRight') {
                event.preventDefault();
                setPlaybackTime(currentTime => Math.min(playbackLog.duration, currentTime + 5));
            } else if (event.key === 'ArrowLeft') {
                event.preventDefault();
                setPlaybackTime(currentTime => Math.max(0, currentTime - 5));
            } else if (event.key === 'Home') {
                event.preventDefault();
                setPlaybackTime(0);
            } else if (event.key === 'End') {
                event.preventDefault();
                setPlaybackTime(playbackLog.duration);
                setIsPlaybackPlaying(false);
            } else if (event.key === '+' || event.key === '=') {
                event.preventDefault();
                setPlaybackSpeed(speed => Math.min(speed * 1.25, 100));
            } else if (event.key === '-' || event.key === '_') {
                event.preventDefault();
                setPlaybackSpeed(speed => Math.max(speed / 1.25, 0.01));
            }
        };

        window.addEventListener('keydown', handlePlaybackKey);
        return () => window.removeEventListener('keydown', handlePlaybackKey);
    }, [mode, playbackLog]);

    const handlePlaybackFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            const parsedLog = parseTrustPlaybackCsv(text, file.name);
            setPlaybackLog(parsedLog);
            setPlaybackTime(0);
            setIsPlaybackPlaying(false);
            setPlaybackError(null);
        } catch (error) {
            setPlaybackLog(null);
            setPlaybackTime(0);
            setIsPlaybackPlaying(false);
            setPlaybackError(error instanceof Error ? error.message : 'Unable to parse CSV file.');
        } finally {
            event.target.value = '';
        }
    };

    const resetPlayback = () => {
        setPlaybackTime(0);
        setIsPlaybackPlaying(false);
    };

    const togglePlayback = () => {
        if (!playbackLog) {
            fileInputRef.current?.click();
            return;
        }

        if (playbackTime >= playbackLog.duration) {
            setPlaybackTime(0);
        }

        setIsPlaybackPlaying(isPlaying => !isPlaying);
    };

    const formatPlaybackTime = (seconds: number) => {
        const safeSeconds = Math.max(0, seconds);
        const minutes = Math.floor(safeSeconds / 60);
        const remainder = safeSeconds - minutes * 60;
        return `${minutes}:${remainder.toFixed(1).padStart(4, '0')}`;
    };

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

        const now = mode === 'playback' ? playbackTime : Date.now() / 1000;
        const startTime = mode === 'playback' ? Math.max(0, now - timeWindow) : now - timeWindow;

        if (mode === 'local' && selectedVehicleId) {
            renderLocalPlot(ctx, width, height, startTime, now);
        } else if (mode === 'fleet') {
            renderFleetPlot(ctx, width, height, startTime, now, fleetData);
        } else if (mode === 'playback' && playbackLog) {
            renderPlaybackDashboard(ctx, width, height, playbackLog, startTime, now);
        }
    }, [localData, fleetData, selectedVehicleId, mode, playbackLog, playbackTime]);

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
        endTime: number,
        dataMap: Map<string, PlotData>,
        isPlayback = false
    ) => {
        const leftMargin = 45;
        const rightMargin = 20;
        const topMargin = 20;
        const bottomMargin = 20;
        const gap = 35;

        const colWidth = (width - leftMargin - rightMargin - gap) / 2;
        const rowHeight = (height - topMargin - bottomMargin - gap) / 2;

        // Row 1: Fleet Trajectories, Fleet Velocities
        drawFleetTrajectories(ctx, leftMargin, topMargin, colWidth, rowHeight, dataMap, isPlayback);
        drawFleetVelocities(ctx, leftMargin + colWidth + gap, topMargin, colWidth, rowHeight,
            startTime, endTime, dataMap);

        // Row 2: Fleet Throttle, Fleet Steering
        const row2Y = topMargin + rowHeight + gap;
        drawFleetControls(ctx, leftMargin, row2Y, colWidth, rowHeight,
            startTime, endTime, dataMap, 'throttle', isPlayback ? 'Self / Neighbor Weight' : 'Fleet Throttle', isPlayback ? 0 : -1, 1);
        drawFleetControls(ctx, leftMargin + colWidth + gap, row2Y, colWidth, rowHeight,
            startTime, endTime, dataMap, 'steering', isPlayback ? 'Estimated Heading [rad]' : 'Fleet Steering', -1, 1);
    };

    const playbackColors = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#14b8a6'];

    const renderPlaybackDashboard = (
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
        log: PlaybackLog,
        startTime: number,
        endTime: number
    ) => {
        const margin = { left: 52, right: 24, top: 22, bottom: 28 };
        const gapX = 34;
        const gapY = 42;
        const titleHeight = 28;
        const plotW = (width - margin.left - margin.right - gapX * 2) / 3;
        const plotH = (height - margin.top - margin.bottom - titleHeight - gapY * 2) / 3;
        const y0 = margin.top + titleHeight;
        const colX = (col: number) => margin.left + col * (plotW + gapX);
        const rowY = (row: number) => y0 + row * (plotH + gapY);

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 15px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const hostLabel = log.hostVehicleId === null ? 'Host V?' : `Host V${log.hostVehicleId}`;
        ctx.fillText(`Realtime Trust Log Playback - ${log.fileName} (${hostLabel}, Focus V${log.focusVehicleId})`, width / 2, margin.top);

        const trustLines: PlaybackLine[] = log.vehicleIds.flatMap((vehicleId, index) => ([
            { key: `trust_${vehicleId}`, label: `trust V${vehicleId}`, color: playbackColors[index % playbackColors.length], width: 1.5 },
            { key: `gtrust_${vehicleId}`, label: `gtrust V${vehicleId}`, color: playbackColors[index % playbackColors.length], dashed: true, width: 1.2 }
        ]));

        const weightLines: PlaybackLine[] = [
            { key: 'w0', label: 'w0', color: '#e2e8f0', dashed: true },
            { key: 'w_self', label: 'w_self', color: '#3b82f6', dashed: true },
            { key: 'total_neighbor_weight', label: 'neighbor total', color: '#f59e0b' },
            ...log.vehicleIds.map((vehicleId, index) => ({
                key: `w_neighbor_${vehicleId}`,
                label: `w V${vehicleId}`,
                color: playbackColors[index % playbackColors.length],
                width: 1.1
            }))
        ];

        const componentLines: PlaybackLine[] = [
            [`v_score_${log.focusVehicleId}`, 'velocity'],
            [`d_score_${log.focusVehicleId}`, 'distance'],
            [`a_score_${log.focusVehicleId}`, 'acceleration'],
            [`h_score_${log.focusVehicleId}`, 'heading'],
            [`b_score_${log.focusVehicleId}`, 'beacon'],
            [`q_factor_${log.focusVehicleId}`, 'quality']
        ].map(([key, label], index) => ({
            key,
            label,
            color: playbackColors[index % playbackColors.length]
        }));

        const gammaLines: PlaybackLine[] = [
            [`gamma_host_${log.focusVehicleId}`, 'gamma_host'],
            [`gamma_local_peer_${log.focusVehicleId}`, 'gamma_local_peer'],
            [`gamma_self_${log.focusVehicleId}`, 'gamma_self']
        ].map(([key, label], index) => ({
            key,
            label,
            color: playbackColors[index % playbackColors.length]
        }));

        const finalLines: PlaybackLine[] = [
            { key: `local_trust_${log.focusVehicleId}`, label: 'local trust', color: playbackColors[0] },
            { key: `global_trust_${log.focusVehicleId}`, label: 'global trust', color: playbackColors[1], dashed: true }
        ];

        drawPlaybackLinePlot(ctx, log, { x: colX(0), y: rowY(0), w: plotW, h: plotH }, trustLines,
            'Direct and Generalized Trust', 'Trust [0,1]', '', startTime, endTime, { min: 0, max: 1 }, endTime, 0.5);
        drawPlaybackLinePlot(ctx, log, { x: colX(1), y: rowY(0), w: plotW, h: plotH }, weightLines,
            'Consensus Weights', 'Weight', '', startTime, endTime, boundsForLines(log, weightLines, { min: 0, max: 1 }), endTime);
        drawPlaybackLinePlot(ctx, log, { x: colX(2), y: rowY(0), w: plotW, h: plotH }, finalLines,
            `Final Trust Score Local and Global V${log.focusVehicleId}`, 'Trust [0,1]', '', startTime, endTime, { min: 0, max: 1 }, endTime);
        drawPlaybackLinePlot(ctx, log, { x: colX(0), y: rowY(1), w: plotW, h: plotH }, componentLines,
            `Component Scores Local Trust V${log.focusVehicleId}`, 'Score [0,1]', '', startTime, endTime, { min: 0, max: 1 }, endTime);
        drawPlaybackLinePlot(ctx, log, { x: colX(1), y: rowY(1), w: plotW, h: plotH }, gammaLines,
            `Component Scores Global Trust V${log.focusVehicleId}`, 'Value [0,1]', '', startTime, endTime, { min: 0, max: 1 }, endTime);
        drawPlaybackXYPlot(ctx, log, { x: colX(2), y: rowY(1), w: plotW, h: plotH }, startTime, endTime);
        drawPlaybackFlagsPlot(ctx, log, { x: colX(0), y: rowY(2), w: plotW * 2 + gapX, h: plotH }, startTime, endTime);
        drawPlaybackStatusPanel(ctx, log, { x: colX(2), y: rowY(2), w: plotW, h: plotH }, endTime, startTime);
    };

    const getPlaybackSeries = (log: PlaybackLog, key: string) => log.series.get(key) ?? [];

    const findPointIndex = (points: DataPoint[], time: number, side: 'left' | 'right' = 'right') => {
        let low = 0;
        let high = points.length;
        while (low < high) {
            const mid = Math.floor((low + high) / 2);
            if (points[mid].time < time || (side === 'right' && points[mid].time <= time)) low = mid + 1;
            else high = mid;
        }
        return low;
    };

    const sampleSeries = (points: DataPoint[], time: number): number | null => {
        if (points.length === 0) return null;
        const right = findPointIndex(points, time, 'right');
        const index = Math.max(0, Math.min(points.length - 1, right - 1));
        const current = points[index];
        const next = points[index + 1];
        if (!next || time <= current.time) return current.value;
        const span = next.time - current.time;
        if (span <= 0) return current.value;
        const alpha = Math.min(1, Math.max(0, (time - current.time) / span));
        return current.value + (next.value - current.value) * alpha;
    };

    const visibleSeries = (points: DataPoint[], startTime: number, endTime: number, maxPoints = 1200): DataPoint[] => {
        if (points.length === 0) return [];
        const start = Math.max(0, findPointIndex(points, startTime, 'left') - 1);
        const end = Math.min(points.length, findPointIndex(points, endTime, 'right'));
        const visible = points.slice(start, end);
        if (visible.length <= maxPoints || maxPoints <= 0) return visible;
        const step = Math.ceil(visible.length / maxPoints);
        return visible.filter((_, index) => index % step === 0 || index === visible.length - 1);
    };

    const boundsForLines = (log: PlaybackLog, lines: PlaybackLine[], fallback: PlotBounds): PlotBounds => {
        let min = Number.POSITIVE_INFINITY;
        let max = Number.NEGATIVE_INFINITY;

        lines.forEach(line => {
            getPlaybackSeries(log, line.key).forEach(point => {
                min = Math.min(min, point.value);
                max = Math.max(max, point.value);
            });
        });

        if (!Number.isFinite(min) || !Number.isFinite(max)) return fallback;
        if (Math.abs(max - min) < 1e-6) return { min: min - 0.5, max: max + 0.5 };
        const pad = (max - min) * 0.08;
        return { min: Math.min(fallback.min, min - pad), max: Math.max(fallback.max, max + pad) };
    };

    const drawPlaybackPlotFrame = (
        ctx: CanvasRenderingContext2D,
        rect: PlotRect,
        title: string,
        yLabel: string,
        xLabel: string,
        xStart: number,
        xEnd: number,
        yBounds: PlotBounds
    ) => {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1;
        ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);

        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        for (let i = 1; i < 5; i++) {
            const gx = rect.x + (rect.w * i) / 5;
            const gy = rect.y + (rect.h * i) / 5;
            ctx.beginPath();
            ctx.moveTo(gx, rect.y);
            ctx.lineTo(gx, rect.y + rect.h);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(rect.x, gy);
            ctx.lineTo(rect.x + rect.w, gy);
            ctx.stroke();
        }
        ctx.setLineDash([]);

        if (title) {
            ctx.fillStyle = '#e2e8f0';
            ctx.font = 'bold 11px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(title, rect.x + rect.w / 2, rect.y - 6);
        }

        ctx.font = '9px Inter, sans-serif';
        ctx.fillStyle = '#94a3b8';
        if (yLabel) {
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(yBounds.max.toFixed(2), rect.x - 6, rect.y);
            ctx.fillText(((yBounds.max + yBounds.min) / 2).toFixed(2), rect.x - 6, rect.y + rect.h / 2);
            ctx.fillText(yBounds.min.toFixed(2), rect.x - 6, rect.y + rect.h);
        }

        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(xStart.toFixed(1), rect.x, rect.y + rect.h + 4);
        ctx.fillText(xEnd.toFixed(1), rect.x + rect.w, rect.y + rect.h + 4);
        if (xLabel) ctx.fillText(xLabel, rect.x + rect.w / 2, rect.y + rect.h + 16);

        if (yLabel) {
            ctx.save();
            ctx.translate(rect.x - 42, rect.y + rect.h / 2);
            ctx.rotate(-Math.PI / 2);
            ctx.textAlign = 'center';
            ctx.fillText(yLabel, 0, 0);
            ctx.restore();
        }
    };

    const mapPlaybackPoint = (rect: PlotRect, xValue: number, yValue: number, xStart: number, xEnd: number, yBounds: PlotBounds) => {
        const xSpan = Math.max(1e-6, xEnd - xStart);
        const ySpan = Math.max(1e-6, yBounds.max - yBounds.min);
        return {
            x: rect.x + ((xValue - xStart) / xSpan) * rect.w,
            y: rect.y + rect.h - ((yValue - yBounds.min) / ySpan) * rect.h
        };
    };

    const drawPlaybackPanelHeader = (
        ctx: CanvasRenderingContext2D,
        rect: PlotRect,
        title: string
    ) => {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(title, rect.x, rect.y + 1);
    };

    const drawPlaybackLegend = (ctx: CanvasRenderingContext2D, log: PlaybackLog, rect: PlotRect, lines: PlaybackLine[]) => {
        const visibleLines = lines.filter(line => getPlaybackSeries(log, line.key).length > 0).slice(0, 8);
        if (visibleLines.length === 0) return;

        ctx.font = '8px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        let x = rect.x;
        let y = rect.y + 18;

        visibleLines.forEach(line => {
            const textWidth = ctx.measureText(line.label).width;
            if (x + textWidth + 28 > rect.x + rect.w) {
                x = rect.x;
                y += 12;
            }
            if (y > rect.y + rect.h - 4) return;
            ctx.strokeStyle = line.color;
            ctx.lineWidth = 1.5;
            ctx.setLineDash(line.dashed ? [5, 3] : []);
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + 16, y);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = '#cbd5e1';
            ctx.fillText(line.label, x + 20, y);
            x += textWidth + 38;
        });
    };

    const drawPlaybackLinePlot = (
        ctx: CanvasRenderingContext2D,
        log: PlaybackLog,
        rect: PlotRect,
        lines: PlaybackLine[],
        title: string,
        yLabel: string,
        xLabel: string,
        startTime: number,
        endTime: number,
        yBounds: PlotBounds,
        currentTime: number,
        threshold?: number
    ) => {
        const legendCount = lines.filter(line => getPlaybackSeries(log, line.key).length > 0).length;
        const headerHeight = legendCount > 4 ? 42 : legendCount > 0 ? 30 : 18;
        const headerRect = { x: rect.x, y: rect.y, w: rect.w, h: headerHeight };
        const plotRect = { x: rect.x, y: rect.y + headerHeight, w: rect.w, h: Math.max(40, rect.h - headerHeight) };

        drawPlaybackPanelHeader(ctx, headerRect, title);
        drawPlaybackLegend(ctx, log, headerRect, lines);
        drawPlaybackPlotFrame(ctx, plotRect, '', yLabel, xLabel, startTime, endTime, yBounds);

        if (threshold !== undefined) {
            const p0 = mapPlaybackPoint(plotRect, startTime, threshold, startTime, endTime, yBounds);
            const p1 = mapPlaybackPoint(plotRect, endTime, threshold, startTime, endTime, yBounds);
            ctx.strokeStyle = '#dc2626';
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 3]);
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        lines.forEach(line => {
            const points = visibleSeries(getPlaybackSeries(log, line.key), startTime, endTime);
            if (points.length === 0) return;

            ctx.strokeStyle = line.color;
            ctx.lineWidth = line.width ?? 1.4;
            ctx.setLineDash(line.dashed ? [6, 4] : []);
            ctx.beginPath();
            points.forEach((point, index) => {
                const mapped = mapPlaybackPoint(plotRect, point.time, point.value, startTime, endTime, yBounds);
                if (index === 0) ctx.moveTo(mapped.x, mapped.y);
                else if (line.stepped) {
                    const previous = mapPlaybackPoint(plotRect, point.time, points[index - 1].value, startTime, endTime, yBounds);
                    ctx.lineTo(mapped.x, previous.y);
                    ctx.lineTo(mapped.x, mapped.y);
                } else {
                    ctx.lineTo(mapped.x, mapped.y);
                }
            });
            ctx.stroke();
            ctx.setLineDash([]);

            const currentValue = sampleSeries(getPlaybackSeries(log, line.key), currentTime);
            if (currentValue !== null) {
                const marker = mapPlaybackPoint(plotRect, currentTime, currentValue, startTime, endTime, yBounds);
                ctx.fillStyle = line.color;
                ctx.beginPath();
                ctx.arc(marker.x, marker.y, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        });

        const playheadTop = mapPlaybackPoint(plotRect, currentTime, yBounds.max, startTime, endTime, yBounds);
        const playheadBottom = mapPlaybackPoint(plotRect, currentTime, yBounds.min, startTime, endTime, yBounds);
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(playheadTop.x, plotRect.y);
        ctx.lineTo(playheadBottom.x, plotRect.y + plotRect.h);
        ctx.stroke();
        ctx.setLineDash([]);
    };

    const finiteBounds = (seriesList: DataPoint[][], fallback: PlotBounds): PlotBounds => {
        let min = Number.POSITIVE_INFINITY;
        let max = Number.NEGATIVE_INFINITY;
        seriesList.forEach(series => {
            series.forEach(point => {
                min = Math.min(min, point.value);
                max = Math.max(max, point.value);
            });
        });
        if (!Number.isFinite(min) || !Number.isFinite(max)) return fallback;
        if (Math.abs(max - min) < 1e-6) return { min: min - 1, max: max + 1 };
        const pad = (max - min) * 0.08;
        return { min: min - pad, max: max + pad };
    };

    const drawPlaybackXYPlot = (
        ctx: CanvasRenderingContext2D,
        log: PlaybackLog,
        rect: PlotRect,
        startTime: number,
        endTime: number
    ) => {
        const xyLines = log.vehicleIds.map((vehicleId, index) => ({
            key: `est_x_${vehicleId}`,
            label: `V${vehicleId}`,
            color: playbackColors[index % playbackColors.length]
        }));
        const headerHeight = xyLines.length > 4 ? 42 : xyLines.length > 0 ? 30 : 18;
        const headerRect = { x: rect.x, y: rect.y, w: rect.w, h: headerHeight };
        const plotRect = { x: rect.x, y: rect.y + headerHeight, w: rect.w, h: Math.max(40, rect.h - headerHeight) };
        const xBounds = finiteBounds(log.vehicleIds.map(vehicleId => getPlaybackSeries(log, `est_x_${vehicleId}`)), { min: -1, max: 1 });
        const yBounds = finiteBounds(log.vehicleIds.map(vehicleId => getPlaybackSeries(log, `est_y_${vehicleId}`)), { min: -1, max: 1 });

        drawPlaybackPanelHeader(ctx, headerRect, 'Estimated XY Trajectory');
        drawPlaybackLegend(ctx, log, headerRect, xyLines);
        drawPlaybackPlotFrame(ctx, plotRect, '', 'Y [m]', 'X [m]', xBounds.min, xBounds.max, yBounds);

        log.vehicleIds.forEach((vehicleId, index) => {
            const xPoints = visibleSeries(getPlaybackSeries(log, `est_x_${vehicleId}`), startTime, endTime);
            const yPoints = visibleSeries(getPlaybackSeries(log, `est_y_${vehicleId}`), startTime, endTime);
            const count = Math.min(xPoints.length, yPoints.length);
            if (count === 0) return;

            const color = playbackColors[index % playbackColors.length];
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            ctx.beginPath();

            for (let i = 0; i < count; i++) {
                const mapped = mapPlaybackPoint(plotRect, xPoints[i].value, yPoints[i].value, xBounds.min, xBounds.max, yBounds);
                if (i === 0) ctx.moveTo(mapped.x, mapped.y);
                else ctx.lineTo(mapped.x, mapped.y);
            }
            ctx.stroke();

            const currentX = sampleSeries(getPlaybackSeries(log, `est_x_${vehicleId}`), endTime);
            const currentY = sampleSeries(getPlaybackSeries(log, `est_y_${vehicleId}`), endTime);
            if (currentX !== null && currentY !== null) {
                const marker = mapPlaybackPoint(plotRect, currentX, currentY, xBounds.min, xBounds.max, yBounds);
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(marker.x, marker.y, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#e2e8f0';
                ctx.font = '8px Inter, sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText(`V${vehicleId}`, marker.x + 6, marker.y + 3);
            }
        });
    };

    const drawPlaybackFlagsPlot = (
        ctx: CanvasRenderingContext2D,
        log: PlaybackLog,
        rect: PlotRect,
        startTime: number,
        endTime: number
    ) => {
        const focus = log.focusVehicleId;
        const flagLines = [
            { key: `flag_attack_${focus}`, label: 'target attack', offset: 0.0 },
            { key: `flag_local_${focus}`, label: 'local bad', offset: 0.15 },
            { key: `flag_global_${focus}`, label: 'global bad', offset: 0.30 },
            { key: `rel_meas_used_global_${focus}`, label: 'rel used', offset: 0.45 },
            { key: `yolo_rel_meas_used_global_${focus}`, label: 'YOLO used', offset: 0.60 },
            { key: `pred_mode_${focus}`, label: 'prediction', offset: 0.75 },
            { key: 'is_turning', label: 'turning', offset: 0.90 },
            { key: 'v2v_attack_active', label: 'V2V attack', offset: 1.05 }
        ];
        const yBounds = { min: -0.05, max: 1.2 };
        drawPlaybackPlotFrame(ctx, rect, `Flags V${focus}`, '', 'Time [s]', startTime, endTime, yBounds);

        ctx.font = '8px Inter, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        flagLines.forEach((flag, index) => {
            const y = mapPlaybackPoint(rect, startTime, flag.offset + 0.05, startTime, endTime, yBounds).y;
            ctx.fillStyle = '#94a3b8';
            ctx.fillText(flag.label, rect.x - 8, y);

            const points = visibleSeries(getPlaybackSeries(log, flag.key), startTime, endTime)
                .map(point => ({ time: point.time, value: flag.offset + Math.max(0, Math.min(1, point.value)) * 0.1 }));
            if (points.length === 0) return;

            ctx.strokeStyle = playbackColors[index % playbackColors.length];
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            points.forEach((point, pointIndex) => {
                const mapped = mapPlaybackPoint(rect, point.time, point.value, startTime, endTime, yBounds);
                if (pointIndex === 0) ctx.moveTo(mapped.x, mapped.y);
                else {
                    const previous = mapPlaybackPoint(rect, point.time, points[pointIndex - 1].value, startTime, endTime, yBounds);
                    ctx.lineTo(mapped.x, previous.y);
                    ctx.lineTo(mapped.x, mapped.y);
                }
            });
            ctx.stroke();
        });

        const top = mapPlaybackPoint(rect, endTime, yBounds.max, startTime, endTime, yBounds);
        ctx.strokeStyle = '#cbd5e1';
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(top.x, rect.y);
        ctx.lineTo(top.x, rect.y + rect.h);
        ctx.stroke();
        ctx.setLineDash([]);
    };

    const samplePlaybackValue = (log: PlaybackLog, key: string, time: number) => {
        const value = sampleSeries(getPlaybackSeries(log, key), time);
        return value === null ? 'nan' : value.toFixed(3);
    };

    const nearestSampleIndex = (samples: number[], time: number) => {
        if (samples.length === 0) return 0;
        let low = 0;
        let high = samples.length;
        while (low < high) {
            const mid = Math.floor((low + high) / 2);
            if (samples[mid] <= time) low = mid + 1;
            else high = mid;
        }
        return Math.max(0, Math.min(samples.length - 1, low - 1));
    };

    const drawPlaybackStatusPanel = (
        ctx: CanvasRenderingContext2D,
        log: PlaybackLog,
        rect: PlotRect,
        currentTime: number,
        startTime: number
    ) => {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
        ctx.strokeStyle = '#475569';
        ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);

        const sampleIndex = nearestSampleIndex(log.timeSamples, currentTime);
        const active = sampleSeries(getPlaybackSeries(log, 'active_vehicle_count'), currentTime);
        const trusted = sampleSeries(getPlaybackSeries(log, 'trusted_neighbor_count'), currentTime);
        const attack = sampleSeries(getPlaybackSeries(log, 'v2v_attack_active'), currentTime);

        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('Playback Status', rect.x + 12, rect.y + 12);

        ctx.font = '9px Consolas, monospace';
        const leftLines = [
            `time    ${currentTime.toFixed(2).padStart(7)} / ${log.duration.toFixed(2).padStart(7)}s`,
            `sample  ${String(sampleIndex + 1).padStart(7)} / ${String(log.timeSamples.length).padStart(7)}`,
            `speed   ${playbackSpeed.toFixed(2).padStart(7)}x`,
            `state   ${isPlaybackPlaying ? 'PLAYING' : 'PAUSED'}`,
            `window  ${(currentTime - startTime).toFixed(2).padStart(7)}s`
        ];
        const midLines = [
            `focus V${log.focusVehicleId}`,
            `local  ${samplePlaybackValue(log, `local_trust_${log.focusVehicleId}`, currentTime)}`,
            `global ${samplePlaybackValue(log, `global_trust_${log.focusVehicleId}`, currentTime)}`,
            `direct ${samplePlaybackValue(log, `trust_${log.focusVehicleId}`, currentTime)}`,
            `weight ${samplePlaybackValue(log, `w_neighbor_${log.focusVehicleId}`, currentTime)}`
        ];
        const rightLines = [
            `active  ${active === null ? 0 : Math.round(active)}`,
            `trusted ${trusted === null ? 0 : Math.round(trusted)}`,
            `attack  ${attack === null ? 0 : Math.round(attack)}`
        ];

        const drawBlock = (lines: string[], x: number, y: number) => {
            lines.forEach((line, index) => {
                ctx.fillText(line, x, y + index * 14);
            });
        };

        ctx.fillStyle = '#cbd5e1';
        drawBlock(leftLines, rect.x + 12, rect.y + 42);
        drawBlock(midLines, rect.x + rect.w * 0.52, rect.y + 42);
        drawBlock(rightLines, rect.x + 12, rect.y + rect.h - 58);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '8px Inter, sans-serif';
        ctx.fillText('Space pause | Left/Right seek | Home/End jump | +/- speed', rect.x + 12, rect.y + rect.h - 18);
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
        x: number, y: number, w: number, h: number,
        dataMap: Map<string, PlotData>,
        isPlayback = false
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
        const labelStr = isPlayback ? 'Estimated Trajectories' : 'Fleet Trajectories';
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
        dataMap.forEach((data, vehicleId) => {
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
                    const vehicleLabel = vehicleId.startsWith('playback-')
                        ? `V${vehicleId.replace('playback-', '')}`
                        : `V${colorIndex}`;
                    ctx.fillText(vehicleLabel, px + 8, py + 4);
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
        endTime: number,
        dataMap: Map<string, PlotData>
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

        dataMap.forEach((data) => {
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
        dataMap: Map<string, PlotData>,
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

        dataMap.forEach((data) => {
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
    const playbackDuration = playbackLog?.duration ?? 0;
    const playbackProgress = playbackDuration > 0 ? Math.min(100, (playbackTime / playbackDuration) * 100) : 0;
    const presetPlaybackSpeeds = [0.25, 0.5, 1, 2, 4];
    const hasPresetPlaybackSpeed = presetPlaybackSpeeds.some(speed => Math.abs(speed - playbackSpeed) < 1e-6);

    return (
        <div className="h-full bg-slate-950 flex flex-col">
            <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handlePlaybackFileChange}
            />

            {/* Header */}
            <div className="px-4 py-2 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Activity size={16} className="text-indigo-400" />
                    <h3 className="text-sm font-semibold text-slate-200">
                        {mode === 'local' ? 'Local State Data' : mode === 'playback' ? 'Trust Log Playback' : 'Fleet State Data'}
                    </h3>
                    {mode === 'local' && selectedVehicle && (
                        <span className="text-xs text-slate-400">- {selectedVehicle.name}</span>
                    )}
                    {mode === 'playback' && playbackLog && (
                        <span className="hidden sm:inline text-xs text-slate-400">- {playbackLog.fileName}</span>
                    )}
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                    <div className="flex items-center gap-1">
                        <TrendingUp size={12} />
                        <span>{timeWindow}s window</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Gauge size={12} />
                        <span>{mode === 'playback' && playbackLog ? `${playbackLog.sampleCount} samples` : '50Hz'}</span>
                    </div>
                </div>
            </div>

            {mode === 'playback' && (
                <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/80 flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-2 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors"
                            title="Load trust_weight_log CSV"
                        >
                            <Upload size={14} />
                            Load CSV
                        </button>
                        <button
                            onClick={togglePlayback}
                            disabled={!playbackLog}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                                playbackLog
                                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            }`}
                            title={isPlaybackPlaying ? 'Pause playback' : 'Play playback'}
                        >
                            {isPlaybackPlaying ? <Pause size={14} /> : <Play size={14} />}
                            {isPlaybackPlaying ? 'Pause' : 'Play'}
                        </button>
                        <button
                            onClick={resetPlayback}
                            disabled={!playbackLog}
                            className={`p-1.5 rounded border transition-colors ${
                                playbackLog
                                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                                    : 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'
                            }`}
                            title="Restart playback"
                        >
                            <RotateCcw size={14} />
                        </button>
                        <select
                            value={playbackSpeed}
                            onChange={event => setPlaybackSpeed(Number(event.target.value))}
                            className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            title="Playback speed"
                        >
                            {!hasPresetPlaybackSpeed && (
                                <option value={playbackSpeed}>{playbackSpeed.toFixed(2)}x</option>
                            )}
                            {presetPlaybackSpeeds.map(speed => (
                                <option key={speed} value={speed}>{speed}x</option>
                            ))}
                        </select>
                        {playbackLog && (
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                                <span>{formatPlaybackTime(playbackTime)}</span>
                                <span>/</span>
                                <span>{formatPlaybackTime(playbackLog.duration)}</span>
                                <span className="hidden sm:inline text-slate-500">
                                    {playbackLog.vehicleIds.length} vehicles
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        <input
                            type="range"
                            min={0}
                            max={playbackDuration || 1}
                            step={0.01}
                            value={playbackLog ? playbackTime : 0}
                            disabled={!playbackLog}
                            onChange={event => {
                                setPlaybackTime(Number(event.target.value));
                                setIsPlaybackPlaying(false);
                            }}
                            className="w-full accent-indigo-500 disabled:opacity-40"
                            title="Playback position"
                        />
                        <span className="w-12 text-right text-[10px] font-mono text-slate-500">
                            {playbackProgress.toFixed(0)}%
                        </span>
                    </div>

                    {playbackError && (
                        <div className="text-xs text-red-300 bg-red-950/40 border border-red-900/60 rounded px-3 py-2">
                            {playbackError}
                        </div>
                    )}
                </div>
            )}

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

                {mode === 'playback' && !playbackLog && !playbackError && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="text-center text-slate-500">
                            <Upload size={34} className="mx-auto mb-3 opacity-60" />
                            <p className="text-sm font-medium text-slate-400">Load a trust_weight_log CSV to replay estimated fleet states</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
