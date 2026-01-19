/**
 * WebSocket Bridge Service for QCar Ground Station
 * Connects to Python WebSocket bridge for QCar TCP communication
 */

import { Vehicle, VehicleStatus, TelemetryData } from '../types';

// Bridge configuration
export const BRIDGE_CONFIG = {
    url: 'ws://localhost:8080',
    reconnectInterval: 3000,
    maxReconnectAttempts: 10,
    heartbeatInterval: 5000,
};

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface BridgeMessage {
    type: string;
    [key: string]: unknown;
}

export interface TelemetryMessage extends BridgeMessage {
    type: 'telemetry' | 'v2v_status';  // Both types carry telemetry data
    vehicle_id: string;

    // Core telemetry (10Hz from _build_telemetry_data)
    // Web naming convention
    x?: number;
    y?: number;
    theta?: number;
    velocity?: number;
    battery?: number;
    steering?: number;
    throttle?: number;
    state?: string;  // State machine state name
    gps_valid?: boolean;

    // Python naming convention (from vehicle_logic._build_telemetry_data)
    th?: number;      // theta
    v?: number;       // velocity
    u?: number;       // throttle
    delta?: number;   // steering

    // Periodic status updates (1Hz from _broadcast_periodic_status)
    v2v_active?: boolean;
    v2v_peers?: number;
    v2v_protocol?: string;
    v2v_local_rate?: number;
    v2v_fleet_rate?: number;

    platoon_enabled?: boolean;
    platoon_is_leader?: boolean;
    platoon_position?: number;
    platoon_leader_id?: number;
    platoon_setup_complete?: boolean;

    // Observer and Controller types
    local_observer_type?: string;
    fleet_observer_type?: string;
    longitudinal_ctrl_type?: string;
    lateral_ctrl_type?: string;

    // Perception status
    perception_active?: boolean;
    scopes_active?: boolean;

    // V2V status detail (in 'data' field for v2v_status messages)
    data?: {
        status?: string;
        connected_peers?: number;
        fleet_size?: number;
    };
}


export interface VehicleStatusMessage extends BridgeMessage {
    type: 'vehicle_status';
    vehicle_id: string;
    status: 'connected' | 'disconnected';
    ip?: string;
    port?: number;
}

export interface CommandMessage {
    type: 'command';
    target: string | 'all';
    action: string;
    params?: Record<string, unknown>;
}

export type BridgeEventHandler = (message: BridgeMessage) => void;

/**
 * WebSocket Bridge Service
 * Singleton class managing WebSocket connection to the Python bridge
 */
class WebSocketBridgeService {
    private socket: WebSocket | null = null;
    private connectionStatus: ConnectionStatus = 'disconnected';
    private reconnectAttempts = 0;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    private eventHandlers: Map<string, Set<BridgeEventHandler>> = new Map();
    private statusChangeCallbacks: Set<(status: ConnectionStatus) => void> = new Set();

    /**
     * Connect to the WebSocket bridge
     */
    connect(url: string = BRIDGE_CONFIG.url): void {
        if (this.socket?.readyState === WebSocket.OPEN) {
            console.log('[WS] Already connected');
            return;
        }

        if (this.socket?.readyState === WebSocket.CONNECTING) {
            console.log('[WS] Connection in progress');
            return;
        }

        this.setConnectionStatus('connecting');
        console.log(`[WS] Connecting to bridge at ${url}...`);

        try {
            this.socket = new WebSocket(url);

            this.socket.onopen = () => {
                console.log('[WS] ✓ Connected to bridge');
                this.reconnectAttempts = 0;
                this.setConnectionStatus('connected');
                this.startHeartbeat();
            };

            this.socket.onmessage = (event) => {
                this.handleMessage(event.data);
            };

            this.socket.onclose = (event) => {
                console.log(`[WS] Connection closed (code: ${event.code})`);
                this.cleanup();
                this.setConnectionStatus('disconnected');
                this.scheduleReconnect();
            };

            this.socket.onerror = (error) => {
                console.error('[WS] Connection error:', error);
                this.setConnectionStatus('error');
            };

        } catch (error) {
            console.error('[WS] Failed to create WebSocket:', error);
            this.setConnectionStatus('error');
            this.scheduleReconnect();
        }
    }

    /**
     * Disconnect from the bridge
     */
    disconnect(): void {
        console.log('[WS] Disconnecting from bridge...');
        this.cleanup();
        if (this.socket) {
            this.socket.close(1000, 'User disconnect');
            this.socket = null;
        }
        this.setConnectionStatus('disconnected');
    }

    /**
     * Send a raw command object to the bridge
     */
    private sendRawCommand(command: object): boolean {
        if (!this.isConnected()) {
            console.warn('[WS] Cannot send command - not connected');
            return false;
        }

        try {
            this.socket!.send(JSON.stringify(command));
            // console.log(`[WS] Sent:`, command); 
            return true;
        } catch (error) {
            console.error('[WS] Failed to send command:', error);
            return false;
        }
    }

    /**
     * Send velocity command
     */
    setVelocity(velocity: number, target: string | 'all' = 'all'): boolean {
        // Backend expects: { type: 'set_velocity', v_ref: 1.0 }
        // If target is specific, the bridge routing handles it if we send to specific socket, 
        // OR the bridge expects a wrapper. 
        // Based on analysis: The bridge forwards the JSON payload directly to the TCP stream for the target.
        // So we must format it EXACTLY as the QCar expects.

        const payload = {
            type: 'set_velocity',
            v_ref: velocity
        };

        return this.sendCommand('set_velocity', target, payload);
    }

    /**
     * Send generic command (Wrapper to handle bridge routing)
     * The Python Bridge expects: { type: ..., target: ... } to know where to route,
     * OR it parses the payload.
     * 
     * Ref checking `websocket_bridge.py`:
     * > msg_type = data.get('type', 'command')
     * > target = data.get('target', 'all')
     * > await self._send_to_vehicle(target, data)
     * 
     * And `remote_controller.py` validation:
     * > cmd_type = command['type']
     * 
     * So we need to strip the 'target' before sending to TCP? 
     * Actually `websocket_bridge.py` sends the WHOLE data dict to the vehicle.
     * The Vehicle's `remote_controller` ignores extra fields usually, but let's be clean.
     */
    sendCommand(action: string, target: string | 'all' = 'all', payload: Record<string, unknown> = {}): boolean {
        // We attach target for the Bridge to route, and the payload is merged in.
        // The 'action' typically maps to 'type' for the QCar.
        const fullCommand = {
            type: action,
            target: target,
            ...payload
        };
        return this.sendRawCommand(fullCommand);
    }

    /**
     * Manual Control Command
     * High frequency command
     */
    sendManualControl(throttle: number, steering: number, target: string): boolean {
        return this.sendCommand('manual_control', target, {
            throttle,
            steering
        });
    }

    /**
     * Enable Manual Mode
     */
    enableManualMode(target: string, type: 'keyboard' | 'joystick' = 'keyboard'): boolean {
        return this.sendCommand('enable_manual_mode', target, { control_type: type });
    }

    /**
     * Disable Manual Mode
     */
    disableManualMode(target: string): boolean {
        return this.sendCommand('disable_manual_mode', target);
    }

    /**
     * Start Mission / Vehicle
     */
    startMission(target: string | 'all' = 'all'): boolean {
        return this.sendCommand('start', target);
    }

    /**
     * Stop Mission / Vehicle
     */
    stopMission(target: string | 'all' = 'all'): boolean {
        return this.sendCommand('stop', target);
    }

    /**
     * Emergency Stop
     */
    emergencyStop(target: string | 'all' = 'all'): boolean {
        return this.sendCommand('emergency_stop', target);
    }

    /**
     * Perception Control
     */
    setPerception(enabled: boolean, target: string | 'all' = 'all'): boolean {
        const type = enabled ? 'activate_perception' : 'disable_perception';
        return this.sendCommand(type, target);
    }

    /**
     * Platoon: Setup Formation
     * formation: { [carId]: position } e.g. { "1": 1, "2": 2 }
     */
    setPlatoonFormation(formation: Record<string, number>): boolean {
        // The bridge needs to broadcast this or we send individually?
        // remote_controller.py has `setup_global_platoon_formation` but that is internal to GS.
        // We should send a specific command that the GS Bridge or Main Controller recognizes 
        // IF we were talking to the GS logic. 
        // BUT we are talking directly to vehicles via the bridge passthrough?
        // Wait, `websocket_bridge.py` is a dumb pipe.
        // So we must talk to the CARS directly.
        // 
        // Implementation:
        // We must calculate who is leader (pos 1) and who is follower.
        // And send 'enable_platoon_leader' / 'enable_platoon_follower' to them.

        // This logic is complex to do in frontend if we want atomic sync.
        // But for now, we will expose the primitives.
        return false;
    }

    /**
     * Platoon: Enable Leader
     */
    enablePlatoonLeader(target: string): boolean {
        return this.sendCommand('enable_platoon_leader', target, { role: 'leader' });
    }

    /**
     * Platoon: Enable Follower
     */
    enablePlatoonFollower(target: string, leaderId: number, gap: number = 1.0): boolean {
        return this.sendCommand('enable_platoon_follower', target, {
            role: 'follower',
            leader_id: leaderId,
            following_distance: gap
        });
    }

    /**
     * Platoon: Start
     * Used to trigger the platoon after setup
     */
    startPlatoon(target: string, leaderId: number): boolean {
        return this.sendCommand('start_platoon', target, { leader_id: leaderId });
    }

    /**
     * Request current vehicle status
     */
    requestStatus(): boolean {
        if (!this.isConnected()) return false;

        try {
            this.socket!.send(JSON.stringify({ type: 'get_status' }));
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Set controller type (longitudinal or lateral)
     */
    setController(category: 'longitudinal' | 'lateral', controllerType: string, target: string | 'all' = 'all'): boolean {
        return this.sendCommand('set_controller', target, {
            category,
            controller_type: controllerType
        });
    }

    /**
     * Set local observer type
     */
    setLocalObserver(observerType: string, target: string | 'all' = 'all'): boolean {
        return this.sendCommand('set_local_observer', target, {
            observer_type: observerType
        });
    }

    /**
     * Set fleet observer type
     */
    setFleetObserver(observerType: string, target: string | 'all' = 'all'): boolean {
        return this.sendCommand('set_fleet_observer', target, {
            observer_type: observerType
        });
    }

    /**
     * Check if connected to bridge
     */
    isConnected(): boolean {
        return this.socket?.readyState === WebSocket.OPEN;
    }

    /**
     * Get current connection status
     */
    getConnectionStatus(): ConnectionStatus {
        return this.connectionStatus;
    }

    /**
     * Subscribe to connection status changes
     */
    onStatusChange(callback: (status: ConnectionStatus) => void): () => void {
        this.statusChangeCallbacks.add(callback);
        return () => this.statusChangeCallbacks.delete(callback);
    }

    /**
     * Subscribe to specific message types
     */
    on(eventType: string, handler: BridgeEventHandler): () => void {
        if (!this.eventHandlers.has(eventType)) {
            this.eventHandlers.set(eventType, new Set());
        }
        this.eventHandlers.get(eventType)!.add(handler);

        // Return unsubscribe function
        return () => {
            this.eventHandlers.get(eventType)?.delete(handler);
        };
    }

    /**
     * Subscribe to all messages
     */
    onMessage(handler: BridgeEventHandler): () => void {
        return this.on('*', handler);
    }

    /**
     * Subscribe to telemetry updates (handles both 'telemetry' and 'v2v_status' types)
     */
    onTelemetry(handler: (msg: TelemetryMessage) => void): () => void {
        // Subscribe to both message types
        const unsub1 = this.on('telemetry', handler as BridgeEventHandler);
        const unsub2 = this.on('v2v_status', handler as BridgeEventHandler);

        // Return combined unsubscribe function
        return () => {
            unsub1();
            unsub2();
        };
    }

    /**
     * Subscribe to vehicle status updates
     */
    onVehicleStatus(handler: (msg: VehicleStatusMessage) => void): () => void {
        return this.on('vehicle_status', handler as BridgeEventHandler);
    }

    // --- Private methods ---

    private handleMessage(data: string): void {
        try {
            const message = JSON.parse(data) as BridgeMessage;

            // Notify type-specific handlers
            const handlers = this.eventHandlers.get(message.type);
            if (handlers) {
                handlers.forEach(handler => handler(message));
            }

            // Notify wildcard handlers
            const wildcardHandlers = this.eventHandlers.get('*');
            if (wildcardHandlers) {
                wildcardHandlers.forEach(handler => handler(message));
            }

        } catch (error) {
            console.error('[WS] Failed to parse message:', error);
        }
    }

    private setConnectionStatus(status: ConnectionStatus): void {
        if (this.connectionStatus !== status) {
            this.connectionStatus = status;
            this.statusChangeCallbacks.forEach(cb => cb(status));
        }
    }

    private startHeartbeat(): void {
        this.stopHeartbeat();
        this.heartbeatTimer = setInterval(() => {
            if (this.isConnected()) {
                try {
                    this.socket!.send(JSON.stringify({ type: 'ping' }));
                } catch {
                    // Ignore ping errors
                }
            }
        }, BRIDGE_CONFIG.heartbeatInterval);
    }

    private stopHeartbeat(): void {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    private scheduleReconnect(): void {
        if (this.reconnectAttempts >= BRIDGE_CONFIG.maxReconnectAttempts) {
            console.log('[WS] Max reconnect attempts reached');
            return;
        }

        if (this.reconnectTimer) return;

        this.reconnectAttempts++;
        console.log(`[WS] Reconnecting in ${BRIDGE_CONFIG.reconnectInterval}ms (attempt ${this.reconnectAttempts}/${BRIDGE_CONFIG.maxReconnectAttempts})`);

        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, BRIDGE_CONFIG.reconnectInterval);
    }

    private cleanup(): void {
        this.stopHeartbeat();
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }
}

// Export singleton instance
export const bridgeService = new WebSocketBridgeService();

// Export class for testing
export { WebSocketBridgeService };
