import { type App, FuzzySuggestModal } from "obsidian";

import type { GenerationPreset } from "@true-recall/core/types/generation-preset.types";

export class PresetSuggestModal extends FuzzySuggestModal<GenerationPreset> {
	private resolve: ((preset: GenerationPreset | null) => void) | null = null;
	private selected: GenerationPreset | null = null;
	private excludeIds: Set<string>;

	constructor(
		app: App,
		private presets: GenerationPreset[],
		excludeIds: string[] = [],
	) {
		super(app);
		this.excludeIds = new Set(excludeIds);
		this.setPlaceholder(
			presets.length === 0
				? "No presets — create one in AI Generation settings first"
				: "Search presets...",
		);
	}

	openAndWait(): Promise<GenerationPreset | null> {
		return new Promise((resolve) => {
			this.resolve = resolve;
			this.open();
		});
	}

	onClose(): void {
		// Obsidian's selectSuggestion internally calls close() BEFORE
		// onChooseSuggestion/onChooseItem, so onClose fires first with
		// selected still null. Defer the resolve via queueMicrotask so the
		// synchronous onChooseItem that follows has a chance to set selected.
		const capturedResolve = this.resolve;
		this.resolve = null;
		queueMicrotask(() => {
			capturedResolve?.(this.selected);
		});
	}

	getItems(): GenerationPreset[] {
		return this.presets.filter((p) => !this.excludeIds.has(`preset:${p.id}`));
	}

	getItemText(item: GenerationPreset): string {
		return item.name;
	}

	onChooseItem(item: GenerationPreset): void {
		this.selected = item;
	}
}
