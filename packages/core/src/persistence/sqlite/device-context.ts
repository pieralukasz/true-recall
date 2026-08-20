/**
 * Device Context
 *
 * Process-wide holder for the current device id so low-level persistence
 * writes (review provenance) can stamp rows without threading the id through
 * every call site. Set once during plugin initialization, before any review
 * is recorded.
 */

let currentDeviceId: string | null = null;

export function setCurrentDeviceId(deviceId: string): void {
	currentDeviceId = deviceId;
}

export function getCurrentDeviceId(): string | null {
	return currentDeviceId;
}
