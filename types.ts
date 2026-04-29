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
export const LOCAL_OBSERVERS = ['ekf', 'luenberger', 'neural_luenberger', 'robust_kalman_net'] as const;
export const FLEET_OBSERVERS = ['consensus', 'distributed_luenberger', 'trust_consensus', 'trust_kalman'] as const;
export const PATH_LONGITUDINAL_CONTROLLERS = ['pid', 'cacc', 'sa_acc'] as const;
export const PATH_LATERAL_CONTROLLERS = ['pp_map', 'path', 'stanley', 'mpc'] as const;
export const LEADER_LONGITUDINAL_CONTROLLERS = ['cacc', 'pid', 'sa_acc'] as const;
export const LEADER_LATERAL_CONTROLLERS = ['pure_pursuit', 'stanley', 'lookahead', 'hybrid', 'fusion', 'mpc'] as const;

export type LocalObserverType = typeof LOCAL_OBSERVERS[number];
export type FleetObserverType = typeof FLEET_OBSERVERS[number];
export type LongitudinalControllerType = string;
export type LateralControllerType = string;

// Telemetry Data - matches Python vehicle_logic telemetry
export interface TelemetryData {
  x: number;
  y: number;
  theta: number;
  velocity: number;
  acceleration?: number;
  battery: number;
  steering: number;
  throttle: number;
  lastUpdate: number;

  // Additional telemetry fields from Python
  gps_valid?: boolean;
  state?: string;  // State machine state name - displayed directly from Python
  fleet_estimation?: Record<string, number>; // True fleet state outputs

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
  path_long_ctrl?: string;
  path_lat_ctrl?: string;
  leader_long_ctrl?: string;
  leader_lat_ctrl?: string;
  gear?: string;

  // Perception (from periodic broadcast)
  perception_active?: boolean;
  scopes_active?: boolean;

  // Local RKNet sensor attack status (received via periodic status, stored in telemetry state)
  local_sensor_attack_supported?: boolean;
  local_sensor_attack_enabled?: boolean;
  local_sensor_attack_active?: boolean;
  local_sensor_attack_branch_types?: string;
  local_sensor_attack_gps_type?: string;
  local_sensor_attack_remaining_steps?: number;
  local_sensor_attack_intensity?: number;

  // Reference Path (from node_sequence generation)
  path_x?: number[];
  path_y?: number[];

  // Dynamic config received from vehicle
  config_data?: {
    local_observers?: string[];
    fleet_observers?: string[];
    path_longitudinal_controllers?: string[];
    path_lateral_controllers?: string[];
    leader_longitudinal_controllers?: string[];
    leader_lateral_controllers?: string[];
    controller_params?: Record<string, Record<string, any>>;
    observer_params?: Record<string, Record<string, any>>;
  };
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
