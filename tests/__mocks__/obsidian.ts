/**
 * Mock for Obsidian module
 * Used in tests that import from services that depend on Obsidian
 */

export class App {}
export class Plugin {}
export class PluginSettingTab {}
export class Modal {}
export class Notice {}
export class TFile {}
export class TFolder {}
export class Vault {}
export class Workspace {}
export class MarkdownView {}
export class ItemView {}
export class WorkspaceLeaf {}
export class Setting {}
export class TextComponent {}
export class DropdownComponent {}
export class ToggleComponent {}
export class SliderComponent {}
export class ButtonComponent {}

export function normalizePath(path: string): string {
	return path;
}

export function debounce<T extends (...args: unknown[]) => unknown>(
	fn: T,
	delay: number
): T {
	return fn;
}

export const Platform = {
	isMobile: false,
	isDesktop: true,
};
