import { type App, FuzzySuggestModal } from "obsidian";

import type { GenerationPreset } from "@true-recall/core/types/generation-preset.types";

export class PresetSuggestModal extends FuzzySuggestModal<GenerationPreset> {
	private resolve: ((preset: GenerationPreset | null) => void) | null = null;
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
		this.resolve?.(null);
		this.resolve = null;
	}

	getItems(): GenerationPreset[] {
		return this.presets.filter((p) => !this.excludeIds.has(`preset:${p.id}`));
	}

	getItemText(item: GenerationPreset): string {
		return item.name;
	}

	onChooseItem(item: GenerationPreset): void {
		this.resolve?.(item);
		this.resolve = null;
	}
}
