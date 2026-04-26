/**
 * Device ID Service
 * Manages device identification for per-device database architecture.
 *
 * Uses localStorage (NOT synced with vault) to ensure each device
 * maintains its own unique identifier.
 */
const DEVICE_ID_KEY = "true-recall-device-id";
const DEVICE_LABEL_KEY = "true-recall-device-label";
const DEVICE_ID_LENGTH = 8;
/**
 * Service for managing device identification.
 * Device ID is stored in localStorage to persist across sessions
 * but NOT sync across devices (unlike plugin data.json).
 */
export class DeviceIdService {
    /**
     * @param fallbackId - Device ID from settings (survives reinstall via iCloud sync)
     * @param onDeviceIdCreated - Called when a new device ID is generated (save to settings)
     */
    constructor(fallbackId, onDeviceIdCreated) {
        this.deviceId = null;
        this.deviceLabel = null;
        this.deviceId = this.loadOrCreateDeviceId(fallbackId, onDeviceIdCreated);
        this.deviceLabel = this.loadDeviceLabel();
    }
    /**
     * Get the device ID for this device.
     * Creates a new ID if one doesn't exist.
     */
    getDeviceId() {
        if (!this.deviceId) {
            this.deviceId = this.loadOrCreateDeviceId();
        }
        return this.deviceId;
    }
    /**
     * Get the optional device label (human-readable name).
     */
    getDeviceLabel() {
        return this.deviceLabel;
    }
    /**
     * Set a human-readable label for this device.
     */
    setDeviceLabel(label) {
        this.deviceLabel = label.trim() || null;
        if (this.isLocalStorageAvailable()) {
            if (this.deviceLabel) {
                window.localStorage.setItem(DEVICE_LABEL_KEY, this.deviceLabel);
            }
            else {
                window.localStorage.removeItem(DEVICE_LABEL_KEY);
            }
        }
    }
    /**
     * Check if localStorage is available.
     * On some platforms or in certain contexts, localStorage may be unavailable.
     */
    isLocalStorageAvailable() {
        try {
            const testKey = "__true_recall_test__";
            window.localStorage.setItem(testKey, "test");
            window.localStorage.removeItem(testKey);
            return true;
        }
        catch (_a) {
            return false;
        }
    }
    /**
     * Get display name for the device (label or ID).
     */
    getDisplayName() {
        return this.deviceLabel || this.deviceId || "Unknown Device";
    }
    /**
     * Load existing device ID or create a new one.
     */
    loadOrCreateDeviceId(fallbackId, onCreated) {
        if (!this.isLocalStorageAvailable()) {
            // Try settings fallback before generating ephemeral ID
            if (fallbackId && this.isValidDeviceId(fallbackId)) {
                return fallbackId;
            }
            console.error("[True Recall] localStorage unavailable - using ephemeral device ID");
            return this.generateDeviceId();
        }
        const existingId = window.localStorage.getItem(DEVICE_ID_KEY);
        if (existingId && this.isValidDeviceId(existingId)) {
            return existingId;
        }
        // Restore from settings (survives reinstall via iCloud sync)
        if (fallbackId && this.isValidDeviceId(fallbackId)) {
            window.localStorage.setItem(DEVICE_ID_KEY, fallbackId);
            return fallbackId;
        }
        const newId = this.generateDeviceId();
        window.localStorage.setItem(DEVICE_ID_KEY, newId);
        onCreated === null || onCreated === void 0 ? void 0 : onCreated(newId);
        return newId;
    }
    /**
     * Load device label from localStorage.
     */
    loadDeviceLabel() {
        if (!this.isLocalStorageAvailable()) {
            return null;
        }
        return window.localStorage.getItem(DEVICE_LABEL_KEY);
    }
    /**
     * Generate a new 8-character alphanumeric device ID.
     */
    generateDeviceId() {
        var _a;
        const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
        let result = "";
        const randomValues = new Uint8Array(DEVICE_ID_LENGTH);
        crypto.getRandomValues(randomValues);
        for (let i = 0; i < DEVICE_ID_LENGTH; i++) {
            const randomValue = (_a = randomValues[i]) !== null && _a !== void 0 ? _a : 0;
            result += chars[randomValue % chars.length];
        }
        return result;
    }
    /**
     * Validate that a device ID matches expected format.
     */
    isValidDeviceId(id) {
        return /^[a-z0-9]{8}$/.test(id);
    }
}
