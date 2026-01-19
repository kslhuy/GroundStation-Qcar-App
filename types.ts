/**
 * Type definitions for Ground Station
 * Aligned with Python GS telemetry data structures
 */

// Vehicle Status - Just display what Python sends, no translation
export enum VehicleStatus {
  DISCONNECTED = 'DISCONNECTED',
  INITIALIZING = 'INITIALIZING',
  IDLE = 'IDLE',
  ACTIVE = 'ACTIVE',
  EMERGENCY_STOP = 'EMERGENCY_STOP',
  STOPPED = 'STOPPED',
  MANUAL = 'MANUAL',
}

// Runtime Configuration - matching Python car_panel.py RuntimeSwitchingControl
export const LOCAL_OBSERVERS = ['ekf', 'luenberger', 'neural_luenberger'] as const;
export const FLEET_OBSERVERS = ['consensus', 'distributed_luenberger', 'trust_consensus', 'trust_kalman'] as const;
export const LONGITUDINAL_CONTROLLERS = ['cacc', 'pid', 'hybrid'] as const;
export const LATERAL_CONTROLLERS = ['pure_pursuit', 'stanley', 'lookahead', 'hybrid', 'fusion', 'path'] as const;

export type LocalObserverType = typeof LOCAL_OBSERVERS[number];
export type FleetObserverType = typeof FLEET_OBSERVERS[number];
export type LongitudinalControllerType = typeof LONGITUDINAL_CONTROLLERS[number];
export type LateralControllerType = typeof LATERAL_CONTROLLERS[number];

// Telemetry Data - matches Python vehicle_logic telemetry
export interface TelemetryData {
  x: number;
  y: number;
  theta: number;
  velocity: number;
  battery: number;
  steering: number;
  throttle: number;
  lastUpdate: number;

  // Additional telemetry fields from Python
  gps_valid?: boolean;
  state?: string;  // State machine state name - displayed directly from Python

  // V2V Status (from periodic broadcast)
  v2v_active?: boolean;
  v2v_peers?: number;
  v2v_protocol?: string;

  // Platoon Status (from periodic broadcast)
  platoon_enabled?: boolean;
  platoon_is_leader?: boolean;
  platoon_position?: number;
  platoon_leader_id?: number;

  // Observer and Controller types (from periodic broadcast)
  local_observer_type?: string;
  fleet_observer_type?: string;
  longitudinal_ctrl_type?: string;
  lateral_ctrl_type?: string;

  // Perception (from periodic broadcast)
  perception_active?: boolean;
  scopes_active?: boolean;
}

// Vehicle Configuration
export interface VehicleConfig {
  controllerId: string;
  estimatorId: string;
  pathId: string;
}

// Vehicle Data Structure
export interface Vehicle {
  id: string;            // e.g., "qcar-0", "qcar-1"
  name: string;          // Display name
  status: VehicleStatus; // Current state
  config: VehicleConfig; // Configuration settings
  telemetry: TelemetryData;
  targetSpeed: number;   // Reference speed (m/s)
}

// Log Entry
export interface LogEntry {
  id: string;
  timestamp: Date;
  message: string;
  level: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  vehicleId?: string;
}