/**
 * Device ID Service
 * Manages device identification for per-device database architecture.
 *
 * Uses localStorage (NOT synced with vault) to ensure each device
 * maintains its own unique identifier.
 */

const DEVICE_ID_KEY = "episteme-device-id";
const DEVICE_LABEL_KEY = "episteme-device-label";
const DEVICE_ID_LENGTH = 8;

/**
 * Service for managing device identification.
 * Device ID is stored in localStorage to persist across sessions
 * but NOT sync across devices (unlike plugin data.json).
 */
export class DeviceIdService {
    private deviceId: string | null = null;
    private deviceLabel: string | null = null;

    constructor() {
        this.deviceId = this.loadOrCreateDeviceId();
        this.deviceLabel = this.loadDeviceLabel();
    }

    /**
     * Get the device ID for this device.
     * Creates a new ID if one doesn't exist.
     */
    getDeviceId(): string {
        if (!this.deviceId) {
            this.deviceId = this.loadOrCreateDeviceId();
        }
        return this.deviceId;
    }

    /**
     * Get the optional device label (human-readable name).
     */
    getDeviceLabel(): string | null {
        return this.deviceLabel;
    }

    /**
     * Set a human-readable label for this device.
     */
    setDeviceLabel(label: string): void {
        this.deviceLabel = label.trim() || null;

        if (this.isLocalStorageAvailable()) {
            if (this.deviceLabel) {
                window.localStorage.setItem(DEVICE_LABEL_KEY, this.deviceLabel);
            } else {
                window.localStorage.removeItem(DEVICE_LABEL_KEY);
            }
        }
    }

    /**
     * Check if localStorage is available.
     * On some platforms or in certain contexts, localStorage may be unavailable.
     */
    isLocalStorageAvailable(): boolean {
        try {
            const testKey = "__episteme_test__";
            window.localStorage.setItem(testKey, "test");
            window.localStorage.removeItem(testKey);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get display name for the device (label or ID).
     */
    getDisplayName(): string {
        return this.deviceLabel || this.deviceId || "Unknown Device";
    }

    /**
     * Load existing device ID or create a new one.
     */
    private loadOrCreateDeviceId(): string {
        if (!this.isLocalStorageAvailable()) {
            console.warn(
                "[Episteme] localStorage unavailable - using ephemeral device ID"
            );
            return this.generateDeviceId();
        }

        const existingId = window.localStorage.getItem(DEVICE_ID_KEY);
        if (existingId && this.isValidDeviceId(existingId)) {
            return existingId;
        }

        const newId = this.generateDeviceId();
        window.localStorage.setItem(DEVICE_ID_KEY, newId);
        console.log(`[Episteme] Created new device ID: ${newId}`);
        return newId;
    }

    /**
     * Load device label from localStorage.
     */
    private loadDeviceLabel(): string | null {
        if (!this.isLocalStorageAvailable()) {
            return null;
        }
        return window.localStorage.getItem(DEVICE_LABEL_KEY);
    }

    /**
     * Generate a new 8-character alphanumeric device ID.
     */
    private generateDeviceId(): string {
        const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
        let result = "";
        const randomValues = new Uint8Array(DEVICE_ID_LENGTH);
        crypto.getRandomValues(randomValues);

        for (let i = 0; i < DEVICE_ID_LENGTH; i++) {
            const randomValue = randomValues[i] ?? 0;
            result += chars[randomValue % chars.length];
        }
        return result;
    }

    /**
     * Validate that a device ID matches expected format.
     */
    private isValidDeviceId(id: string): boolean {
        return /^[a-z0-9]{8}$/.test(id);
    }
}
