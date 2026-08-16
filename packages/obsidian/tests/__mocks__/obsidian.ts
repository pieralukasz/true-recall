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
/**
 * Mirrors Obsidian 1.12.7 behavior: selectSuggestion() calls close()
 * (which fires onClose synchronously on desktop) BEFORE onChooseSuggestion().
 */
export class SuggestModal<T = unknown> {
	app: unknown;
	isOpen = false;

	constructor(app?: unknown) {
		this.app = app;
	}

	setPlaceholder(_text: string): void {}

	open(): void {
		this.isOpen = true;
	}

	close(): void {
		this.onClose();
	}

	onClose(): void {}

	onChooseSuggestion(_item: T, _evt?: MouseEvent | KeyboardEvent): void {}

	selectSuggestion(item: T, evt?: MouseEvent | KeyboardEvent): void {
		this.close();
		this.isOpen = false;
		this.onChooseSuggestion(item, evt);
	}
}
export class AbstractInputSuggest {}

export function normalizePath(path: string): string {
	return path;
}

export function debounce<T extends (...args: unknown[]) => unknown>(
	fn: T,
	_delay: number,
): T {
	return fn;
}

export const Platform = {
	isMobile: false,
	isDesktop: true,
	isPhone: false,
	isTablet: false,
};
