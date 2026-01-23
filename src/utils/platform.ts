import { Platform } from 'obsidian';

/**
 * Check if the plugin is running on a mobile device
 */
export function isMobile(): boolean {
  return Platform.isMobile;
}

/**
 * Check if the plugin is running on desktop
 */
export function isDesktop(): boolean {
  return !Platform.isMobile;
}

/**
 * Check if the plugin can modify data (add/edit/delete cards, do reviews)
 *
 * Rules:
 * - Desktop: Always can modify data (works standalone)
 * - Mobile: Can only modify data if sync is enabled
 *
 * This prevents data loss from file sync conflicts when mobile modifies
 * data without proper server-side sync.
 *
 * @param syncEnabled - Whether the sync server is configured and enabled
 */
export function canModifyData(syncEnabled: boolean): boolean {
  // Desktop: always can modify
  // Mobile: only if sync is enabled
  return isDesktop() || syncEnabled;
}
