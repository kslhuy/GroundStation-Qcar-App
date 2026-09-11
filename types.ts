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

export interface ElectronicsStatus {
  enabled: boolean;
  healthy: boolean;
  target_id?: string;
  target_profile?: string;
  topology?: 'single_node' | 'dual_node';
  sensor_node_state?: string;
  compute_node_state?: string;
  node_states?: Record<string, string>;
  nav_mcu_state: string;
  com_mcu_state: string;
  nav_protocol: string;
  nav_com_interface: string;
  sensor_compute_protocol?: string;
  sensor_compute_interface?: string;
  vehicle_interface: string;
  execution_mode?: 'simulated' | 'sil_native' | 'hil_external' | 'physical';
  firmware_backend: string;
  hardware_target?: {
    schema_version: number;
    target_id: string;
    profile: string;
    topology: 'single_node' | 'dual_node';
    sensor_node: HardwareNodeManifest;
    compute_node: HardwareNodeManifest;
    metadata: Record<string, unknown>;
  };
  hil?: {
    handshake_ready: boolean;
    link_alive?: boolean;
    last_receive_age_ns?: number | null;
    capability_negotiation: {
      accepted?: boolean;
      blockers?: string[];
      remote_platform?: string;
      remote_execution?: string;
    };
    remote_target?: Record<string, unknown> | null;
    remote_status?: Record<string, unknown>;
    transport?: Record<string, unknown> | null;
  };
  rail_3v3_v: number;
  input_voltage_v: number;
  nav_frames_delivered: number;
  nav_frames_dropped: number;
  nav_decode_errors: number;
  vehicle_frames_delivered: number;
  embedded_core?: {
    enabled: boolean;
    available: boolean;
    mode: 'shadow' | 'native_authority';
    configured_mode: 'shadow' | 'native_authority';
    authority_active: boolean;
    backend: 'native_cpp';
    reason: string;
    library?: string | null;
    parity_pass: boolean;
    authority_ready: boolean;
    authority_blockers: string[];
    authority_min_comparisons_per_stage: number;
    failback_count: number;
    last_failback_stage?: string | null;
    last_failback_reason?: string | null;
    last_mode_change_reason: string;
    native_authority_uses: number;
    native_trust_uses: number;
    native_weight_uses: number;
    native_correction_uses: number;
    native_prediction_uses: number;
    comparisons: number;
    failures: number;
    trust_comparisons: number;
    weight_comparisons: number;
    observer_comparisons: number;
    prediction_comparisons: number;
    trust_failures: number;
    weight_failures: number;
    observer_failures: number;
    prediction_failures: number;
    max_trust_error: number;
    max_weight_error: number;
    max_state_error: number;
    max_prediction_error: number;
    last_trust_error: number;
    last_weight_error: number;
    last_state_error: number;
    last_prediction_error: number;
    score_tolerance: number;
    weight_tolerance: number;
    state_tolerance: number;
    prediction_tolerance: number;
  };
  v2v?: {
    enabled: boolean;
    mode: 'mirror' | 'firmware';
    peer_routes: number;
    host_tx_accepted: number;
    firmware_tx_emitted: number;
    radio_tx_delivered: number;
    radio_rx_accepted: number;
    host_rx_delivered: number;
    dropped_board_unavailable: number;
    dropped_no_route: number;
    radio: {
      delivered: number;
      dropped: number;
      corrupted: number;
      last_latency_ns: number;
    };
  };
}

export interface HardwareNodeManifest {
  node_id: string;
  role: string;
  platform: string;
  architecture: string;
  runtime: string;
  execution: string;
  clock_hz: number;
  word_size_bits: number;
  endianness: 'little' | 'big';
  float_width_bits: 32 | 64;
  max_payload_bytes: number;
  memory_bytes: number;
  dynamic_allocation: boolean;
  transports: string[];
  features: string[];
  active_current_a: number;
  idle_current_a: number;
}

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
  electronics?: ElectronicsStatus;

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
