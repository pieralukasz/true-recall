/**
 * Device ID Service
 * Manages device identification for per-device database architecture.
 *
 * Uses localStorage (NOT synced with vault) to ensure each device
 * maintains its own unique identifier.
 */
/**
 * Service for managing device identification.
 * Device ID is stored in localStorage to persist across sessions
 * but NOT sync across devices (unlike plugin data.json).
 */
export declare class DeviceIdService {
    private deviceId;
    private deviceLabel;
    constructor();
    /**
     * Get the device ID for this device.
     * Creates a new ID if one doesn't exist.
     */
    getDeviceId(): string;
    /**
     * Get the optional device label (human-readable name).
     */
    getDeviceLabel(): string | null;
    /**
     * Set a human-readable label for this device.
     */
    setDeviceLabel(label: string): void;
    /**
     * Check if localStorage is available.
     * On some platforms or in certain contexts, localStorage may be unavailable.
     */
    isLocalStorageAvailable(): boolean;
    /**
     * Get display name for the device (label or ID).
     */
    getDisplayName(): string;
    /**
     * Load existing device ID or create a new one.
     */
    private loadOrCreateDeviceId;
    /**
     * Load device label from localStorage.
     */
    private loadDeviceLabel;
    /**
     * Generate a new 8-character alphanumeric device ID.
     */
    private generateDeviceId;
    /**
     * Validate that a device ID matches expected format.
     */
    private isValidDeviceId;
}
