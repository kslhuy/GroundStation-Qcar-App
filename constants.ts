import { Vehicle, VehicleStatus, VehicleMode, ControllerType, EstimationType } from './types';

export const MAX_VELOCITY = 2.0; // m/s
export const MAP_WIDTH_METERS = 10;
export const MAP_HEIGHT_METERS = 10;
export const REFRESH_RATE_MS = 100; // 10Hz Telemetry

export const INITIAL_FLEET: Vehicle[] = [
  {
    id: 'qcar-01',
    name: 'QCar Alpha',
    ip: '192.168.1.101',
    port: 5000,
    status: VehicleStatus.DISCONNECTED,
    mode: VehicleMode.MANUAL,
    targetSpeed: 0,
    controllerType: ControllerType.PID,
    estimationType: EstimationType.LOCAL_KALMAN,
    telemetry: {
      x: 2,
      y: 2,
      theta: 0,
      velocity: 0,
      battery: 85,
      steering: 0,
      throttle: 0,
      lastUpdate: Date.now()
    }
  },
  {
    id: 'qcar-02',
    name: 'QCar Beta',
    ip: '192.168.1.102',
    port: 5001,
    status: VehicleStatus.DISCONNECTED,
    mode: VehicleMode.MANUAL,
    targetSpeed: 0,
    controllerType: ControllerType.PID,
    estimationType: EstimationType.LOCAL_KALMAN,
    telemetry: {
      x: 4,
      y: 3,
      theta: Math.PI / 2,
      velocity: 0,
      battery: 92,
      steering: 0,
      throttle: 0,
      lastUpdate: Date.now()
    }
  },
  {
    id: 'qcar-03',
    name: 'QCar Gamma',
    ip: '192.168.1.103',
    port: 5002,
    status: VehicleStatus.DISCONNECTED,
    mode: VehicleMode.MANUAL,
    targetSpeed: 0,
    controllerType: ControllerType.PID,
    estimationType: EstimationType.LOCAL_KALMAN,
    telemetry: {
      x: 6,
      y: 6,
      theta: Math.PI,
      velocity: 0,
      battery: 45,
      steering: 0,
      throttle: 0,
      lastUpdate: Date.now()
    }
  }
];