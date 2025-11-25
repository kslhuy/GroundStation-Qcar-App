import { Vehicle, VehicleStatus, TelemetryData } from "../types";
import { MAX_VELOCITY, MAP_WIDTH_METERS, MAP_HEIGHT_METERS } from "../constants";

// Simple physics step simulation
export const updateVehiclePhysics = (vehicle: Vehicle, dtSeconds: number): Vehicle => {
  if (vehicle.status !== VehicleStatus.ACTIVE && vehicle.status !== VehicleStatus.EMERGENCY_STOP) {
    return vehicle;
  }

  const t = { ...vehicle.telemetry };
  
  // Target velocity smoothing
  let targetV = vehicle.targetSpeed;
  if (vehicle.status === VehicleStatus.EMERGENCY_STOP) targetV = 0;

  // Simple acceleration model
  const accel = 1.0; // m/s^2
  if (t.velocity < targetV) {
    t.velocity = Math.min(t.velocity + accel * dtSeconds, targetV);
  } else {
    t.velocity = Math.max(t.velocity - accel * dtSeconds, targetV);
  }

  // Update position based on heading (theta)
  // In a real app, steering would change theta. Here we simulate a random drift or circular path if steering is active
  // For demo purposes, let's make them drive in slow circles if moving
  if (t.velocity > 0.1) {
    t.theta += (0.2 * dtSeconds); // Turn rate
  }

  t.x += t.velocity * Math.cos(t.theta) * dtSeconds;
  t.y += t.velocity * Math.sin(t.theta) * dtSeconds;

  // Boundary checks (bounce)
  if (t.x < 0 || t.x > MAP_WIDTH_METERS) {
    t.theta = Math.PI - t.theta;
    t.x = Math.max(0, Math.min(t.x, MAP_WIDTH_METERS));
  }
  if (t.y < 0 || t.y > MAP_HEIGHT_METERS) {
    t.theta = -t.theta;
    t.y = Math.max(0, Math.min(t.y, MAP_HEIGHT_METERS));
  }

  // Battery drain
  if (vehicle.status === VehicleStatus.ACTIVE) {
    t.battery = Math.max(0, t.battery - (0.05 * dtSeconds));
  }

  return {
    ...vehicle,
    telemetry: {
      ...t,
      lastUpdate: Date.now()
    }
  };
};