import { Vehicle, VehicleStatus } from './types';

export const MAX_VELOCITY = 2.0; // m/s
export const MAP_WIDTH_METERS = 10;
export const MAP_HEIGHT_METERS = 10;
export const REFRESH_RATE_MS = 100; // 10Hz Telemetry

// Initial fleet is now empty - vehicles are added dynamically from Python GS
export const INITIAL_FLEET: Vehicle[] = [];