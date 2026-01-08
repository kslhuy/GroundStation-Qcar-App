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
    type: 'telemetry';
    vehicle_id: string;
    x?: number;
    y?: number;
    theta?: number;
    velocity?: number;
    battery?: number;
    steering?: number;
    throttle?: number;
    state?: string;
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
     * Send a command to vehicle(s)
     */
    sendCommand(action: string, target: string | 'all' = 'all', params: Record<string, unknown> = {}): boolean {
        if (!this.isConnected()) {
            console.warn('[WS] Cannot send command - not connected');
            return false;
        }

        const command: CommandMessage = {
            type: 'command',
            target,
            action,
            params,
        };

        try {
            this.socket!.send(JSON.stringify(command));
            console.log(`[WS] Sent command: ${action} -> ${target}`);
            return true;
        } catch (error) {
            console.error('[WS] Failed to send command:', error);
            return false;
        }
    }

    /**
     * Send velocity command to vehicle(s)
     */
    setVelocity(velocity: number, target: string | 'all' = 'all'): boolean {
        return this.sendCommand('set_velocity', target, { velocity });
    }

    /**
     * Send start command
     */
    startMission(target: string | 'all' = 'all', speed?: number): boolean {
        return this.sendCommand('start_mission', target, { speed });
    }

    /**
     * Send stop command
     */
    stopMission(target: string | 'all' = 'all'): boolean {
        return this.sendCommand('stop_mission', target, {});
    }

    /**
     * Send emergency stop
     */
    emergencyStop(target: string | 'all' = 'all'): boolean {
        return this.sendCommand('emergency_stop', target, { immediate: true });
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
     * Subscribe to telemetry updates
     */
    onTelemetry(handler: (msg: TelemetryMessage) => void): () => void {
        return this.on('telemetry', handler as BridgeEventHandler);
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
