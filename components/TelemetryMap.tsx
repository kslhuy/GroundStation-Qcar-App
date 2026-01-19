import React, { useRef, useEffect, useState } from 'react';
import { Vehicle, VehicleStatus } from '../types';
import { Navigation, Wifi, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface TelemetryMapProps {
  vehicles: Vehicle[];
  selectedVehicleId: string | null;
  onSelectVehicle: (id: string) => void;
  isV2VActive: boolean;
}

export const TelemetryMap: React.FC<TelemetryMapProps> = ({
  vehicles,
  selectedVehicleId,
  onSelectVehicle,
  isV2VActive
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Pan and zoom state
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Map configuration
  const MAP_WIDTH_METERS = 12; // -6 to 6
  const MAP_HEIGHT_METERS = 6; // -3 to 3
  const GRID_SIZE = 1; // 1 meter grid

  // Convert world coordinates to screen coordinates
  const worldToScreen = (x: number, y: number, width: number, height: number) => {
    const centerX = width / 2 + panOffset.x;
    const centerY = height / 2 + panOffset.y;
    const scale = (Math.min(width, height * 2) / MAP_WIDTH_METERS) * zoomLevel;

    return {
      x: centerX + x * scale,
      y: centerY - y * scale // Invert Y for screen coordinates
    };
  };

  // Convert screen coordinates to world coordinates
  const screenToWorld = (screenX: number, screenY: number, width: number, height: number) => {
    const centerX = width / 2 + panOffset.x;
    const centerY = height / 2 + panOffset.y;
    const scale = (Math.min(width, height * 2) / MAP_WIDTH_METERS) * zoomLevel;

    return {
      x: (screenX - centerX) / scale,
      y: -(screenY - centerY) / scale
    };
  };

  // Handle mouse wheel zoom
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    setZoomLevel(prev => Math.max(0.5, Math.min(5, prev + delta)));
  };

  // Handle mouse down
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if clicking on a vehicle
    const clickedVehicle = getVehicleAtPosition(x, y, rect.width, rect.height);
    if (clickedVehicle) {
      onSelectVehicle(clickedVehicle.id);
    } else {
      setIsDragging(true);
      setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    }
  };

  // Handle mouse move
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    setPanOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  // Handle mouse up
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch event handlers for mobile
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      setIsDragging(true);
      setDragStart({
        x: touch.clientX - panOffset.x,
        y: touch.clientY - panOffset.y
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1 && isDragging) {
      const touch = e.touches[0];
      setPanOffset({
        x: touch.clientX - dragStart.x,
        y: touch.clientY - dragStart.y
      });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Get vehicle at position
  const getVehicleAtPosition = (screenX: number, screenY: number, width: number, height: number): Vehicle | null => {
    for (const vehicle of vehicles) {
      const pos = worldToScreen(vehicle.telemetry.x, vehicle.telemetry.y, width, height);
      const distance = Math.sqrt((screenX - pos.x) ** 2 + (screenY - pos.y) ** 2);
      if (distance < 20) { // 20px click radius
        return vehicle;
      }
    }
    return null;
  };

  // Reset view
  const resetView = () => {
    setPanOffset({ x: 0, y: 0 });
    setZoomLevel(1);
  };

  // Zoom in/out
  const zoomIn = () => setZoomLevel(prev => Math.min(5, prev + 0.2));
  const zoomOut = () => setZoomLevel(prev => Math.max(0.5, prev - 0.2));

  // Render the map
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match container
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    drawGrid(ctx, width, height);

    // Draw V2V connections
    if (isV2VActive) {
      drawV2VConnections(ctx, width, height);
    }

    // Draw vehicles
    drawVehicles(ctx, width, height);

    // Draw coordinate display
    drawCoordinateInfo(ctx, width, height);
  }, [vehicles, selectedVehicleId, isV2VActive, panOffset, zoomLevel]);

  const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;

    const scale = (Math.min(width, height * 2) / MAP_WIDTH_METERS) * zoomLevel;
    const centerX = width / 2 + panOffset.x;
    const centerY = height / 2 + panOffset.y;

    // Vertical grid lines
    for (let x = -MAP_WIDTH_METERS / 2; x <= MAP_WIDTH_METERS / 2; x += GRID_SIZE) {
      const screenX = centerX + x * scale;
      if (screenX >= 0 && screenX <= width) {
        ctx.beginPath();
        ctx.moveTo(screenX, 0);
        ctx.lineTo(screenX, height);
        ctx.stroke();
      }
    }

    // Horizontal grid lines
    for (let y = -MAP_HEIGHT_METERS / 2; y <= MAP_HEIGHT_METERS / 2; y += GRID_SIZE) {
      const screenY = centerY - y * scale;
      if (screenY >= 0 && screenY <= height) {
        ctx.beginPath();
        ctx.moveTo(0, screenY);
        ctx.lineTo(width, screenY);
        ctx.stroke();
      }
    }

    // Draw origin marker
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
    ctx.fill();

    // Draw origin label
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';
    ctx.fillText('(0,0)', centerX + 6, centerY - 6);
  };

  const drawV2VConnections = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const activeVehicles = vehicles.filter(v =>
      v.status !== VehicleStatus.DISCONNECTED && v.status !== VehicleStatus.EMERGENCY_STOP
    );

    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.globalAlpha = 0.4;

    for (let i = 0; i < activeVehicles.length; i++) {
      for (let j = i + 1; j < activeVehicles.length; j++) {
        const pos1 = worldToScreen(activeVehicles[i].telemetry.x, activeVehicles[i].telemetry.y, width, height);
        const pos2 = worldToScreen(activeVehicles[j].telemetry.x, activeVehicles[j].telemetry.y, width, height);

        ctx.beginPath();
        ctx.moveTo(pos1.x, pos1.y);
        ctx.lineTo(pos2.x, pos2.y);
        ctx.stroke();
      }
    }

    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  };

  const drawVehicles = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    vehicles.forEach(vehicle => {
      const pos = worldToScreen(vehicle.telemetry.x, vehicle.telemetry.y, width, height);
      const isSelected = vehicle.id === selectedVehicleId;
      const isOffline = vehicle.status === VehicleStatus.DISCONNECTED;

      // Vehicle circle
      const radius = isSelected ? 16 : 12;

      // Draw selection glow
      if (isSelected) {
        ctx.shadowColor = '#3b82f6';
        ctx.shadowBlur = 15;
      }

      // Vehicle body
      ctx.fillStyle = isOffline ? '#1e293b' :
        vehicle.status === VehicleStatus.EMERGENCY_STOP ? '#7f1d1d' :
          '#4f46e5';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;

      // Border
      ctx.strokeStyle = isSelected ? '#60a5fa' : '#475569';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Direction indicator (arrow)
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(-vehicle.telemetry.theta + Math.PI / 2);

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(0, -radius * 0.6);
      ctx.lineTo(-radius * 0.4, radius * 0.3);
      ctx.lineTo(radius * 0.4, radius * 0.3);
      ctx.closePath();
      ctx.fill();

      ctx.restore();

      // V2V badge
      if (isV2VActive && !isOffline) {
        ctx.fillStyle = '#4f46e5';
        ctx.beginPath();
        ctx.arc(pos.x + radius * 0.7, pos.y - radius * 0.7, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#818cf8';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Vehicle label
      ctx.fillStyle = isSelected ? '#60a5fa' : '#e2e8f0';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(vehicle.name, pos.x, pos.y + radius + 15);
    });
  };

  const drawCoordinateInfo = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Draw zoom level and center coordinates
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(10, height - 60, 150, 50);

    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1;
    ctx.strokeRect(10, height - 60, 150, 50);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';

    const center = screenToWorld(width / 2, height / 2, width, height);
    ctx.fillText(`Zoom: ${zoomLevel.toFixed(2)}x`, 15, height - 45);
    ctx.fillText(`Center: (${center.x.toFixed(1)}, ${center.y.toFixed(1)})`, 15, height - 30);
    ctx.fillText(`Pan: (${panOffset.x.toFixed(0)}, ${panOffset.y.toFixed(0)})`, 15, height - 15);
  };

  return (
    <div ref={containerRef} className="relative w-full h-full bg-slate-950">
      <canvas
        ref={canvasRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        style={{ touchAction: 'none' }}
      />

      {/* Map Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <button
          onClick={zoomIn}
          className="bg-slate-800/90 hover:bg-slate-700 border border-slate-600 text-white p-2 rounded-lg shadow-lg transition-all"
          title="Zoom In"
        >
          <ZoomIn size={18} />
        </button>
        <button
          onClick={zoomOut}
          className="bg-slate-800/90 hover:bg-slate-700 border border-slate-600 text-white p-2 rounded-lg shadow-lg transition-all"
          title="Zoom Out"
        >
          <ZoomOut size={18} />
        </button>
        <button
          onClick={resetView}
          className="bg-slate-800/90 hover:bg-slate-700 border border-slate-600 text-white p-2 rounded-lg shadow-lg transition-all"
          title="Reset View"
        >
          <Maximize2 size={18} />
        </button>
      </div>

      {/* Cursor mode indicator */}
      {isDragging && (
        <div className="absolute top-4 left-4 bg-indigo-600/90 text-white px-3 py-1 rounded-full text-xs font-medium">
          Panning...
        </div>
      )}
    </div>
  );
};