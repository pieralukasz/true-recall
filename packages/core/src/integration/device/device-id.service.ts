/**
 * Device ID Service
 * Manages device identification for per-device database architecture.
 *
 * The ID must live in device-local storage that is NEVER synced between
 * devices (unlike plugin data.json). If a synced copy of the ID leaks to a
 * second device, both devices open the same database file and their
 * full-file exports overwrite each other, silently losing reviews.
 */

const DEVICE_ID_KEY = "true-recall-device-id";
const DEVICE_LABEL_KEY = "true-recall-device-label";
const DEVICE_ID_LENGTH = 8;

/**
 * Device-local key-value storage. Implementations must be scoped to the
 * physical device: never synced, never restored onto another device.
 */
export interface DeviceIdStorage {
	get(key: string): string | null;
	set(key: string, value: string | null): void;
}

/**
 * Service for managing device identification.
 *
 * Resolution is strictly local: an existing valid ID in device-local
 * storage wins, otherwise a fresh ID is minted and persisted. There is
 * deliberately no fallback to synced settings; after a reinstall the device
 * gets a new identity and its old database is merged via device sync.
 */
export class DeviceIdService {
	private deviceId: string;
	private deviceLabel: string | null;

	constructor(private readonly storage: DeviceIdStorage) {
		this.deviceId = this.loadOrCreateDeviceId();
		this.deviceLabel = storage.get(DEVICE_LABEL_KEY);
	}

	getDeviceId(): string {
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
		try {
			this.storage.set(DEVICE_LABEL_KEY, this.deviceLabel);
		} catch {
			// Label is cosmetic; losing it must not break initialization.
		}
	}

	/**
	 * Get display name for the device (label or ID).
	 */
	getDisplayName(): string {
		return this.deviceLabel || this.deviceId;
	}

	private loadOrCreateDeviceId(): string {
		const existingId = this.storage.get(DEVICE_ID_KEY);
		if (existingId && isValidDeviceId(existingId)) {
			return existingId;
		}

		const newId = generateDeviceId();
		try {
			this.storage.set(DEVICE_ID_KEY, newId);
		} catch {
			console.error(
				"[True Recall] device-local storage unavailable - using ephemeral device ID",
			);
		}
		return newId;
	}
}

/**
 * Generate a new 8-character alphanumeric device ID.
 */
function generateDeviceId(): string {
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

export function isValidDeviceId(id: string): boolean {
	return /^[a-z0-9]{8}$/.test(id);
}
