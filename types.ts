export enum VehicleStatus {
  DISCONNECTED = 'DISCONNECTED',
  IDLE = 'IDLE',
  ACTIVE = 'ACTIVE',
  ERROR = 'ERROR',
  EMERGENCY_STOP = 'EMERGENCY_STOP'
}

export enum VehicleMode {
  MANUAL = 'MANUAL',
  AUTONOMOUS = 'AUTONOMOUS',
  LEADER = 'LEADER',
  FOLLOWER = 'FOLLOWER'
}

export enum ControllerType {
  PID = 'PID',
  ACC = 'ACC'
}

export enum EstimationType {
  LOCAL_KALMAN = 'LOCAL_KALMAN',
  DISTRIBUTED_OBSERVER = 'DISTRIBUTED_OBSERVER'
}

export interface TelemetryData {
  x: number; // meters
  y: number; // meters
  theta: number; // radians
  velocity: number; // m/s
  battery: number; // percentage
  steering: number; // -1 to 1
  throttle: number; // -1 to 1
  lastUpdate: number; // timestamp
}

export interface Vehicle {
  id: string;
  name: string;
  ip: string;
  port: number;
  status: VehicleStatus;
  mode: VehicleMode;
  telemetry: TelemetryData;
  targetSpeed: number;
  controllerType: ControllerType;
  estimationType: EstimationType;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  vehicleId?: string;
  level: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
  message: string;
}

export interface PlatoonConfig {
  leaderId: string;
  followers: string[];
  gap: number; // meters
}