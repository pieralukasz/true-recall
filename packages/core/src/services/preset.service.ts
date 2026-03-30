import type { SqliteStoreService } from "../persistence/sqlite/SqliteStoreService";
import type { FrontmatterIndexService } from "./frontmatter-index.service";
import type { HierarchyService } from "./hierarchy.service";
import type { FSRSFlashcardItem } from "../types/fsrs";
import type {
	FSRSPreset,
	FSRSSettings,
	TrueRecallSettings,
} from "../types/settings.types";
import { extractFSRSSettingsFromPreset } from "../types/settings.types";

export interface PresetResolutionContext {
	projectPath?: string;
}

export type PresetSource = "note" | "parent" | "default";

export interface PresetResolutionResult {
	preset: FSRSPreset;
	source: PresetSource;
	sourcePath?: string;
}

export interface PresetChainEntry {
	source: PresetSource;
	sourcePath?: string;
	presetName: string | null;
	active: boolean;
}

export class PresetService {
	constructor(
		private getSettings: () => TrueRecallSettings,
		private persistSettings: () => Promise<void>,
		private frontmatterIndex: FrontmatterIndexService,
		private hierarchyService: HierarchyService,
		private getCardStore?: () => SqliteStoreService | null,
	) {}

	getPresets(): FSRSPreset[] {
		return this.getSettings().fsrsPresets;
	}

	getDefaultPreset(): FSRSPreset {
		const settings = this.getSettings();
		const preset = settings.fsrsPresets.find(
			(p) => p.id === settings.defaultPresetId,
		);
		const fallback = settings.fsrsPresets[0];
		if (preset) return preset;
		if (fallback) return fallback;
		throw new Error("No FSRS presets configured");
	}

	getPresetById(id: string): FSRSPreset | undefined {
		return this.getSettings().fsrsPresets.find((p) => p.id === id);
	}

	getPresetByName(name: string): FSRSPreset | undefined {
		return this.getSettings().fsrsPresets.find((p) => p.name === name);
	}

	async createPreset(
		data: Omit<FSRSPreset, "id" | "createdAt">,
	): Promise<FSRSPreset> {
		const settings = this.getSettings();
		const preset: FSRSPreset = {
			...data,
			id: crypto.randomUUID(),
			createdAt: Date.now(),
		};
		settings.fsrsPresets.push(preset);
		await this.persistSettings();
		return preset;
	}

	async updatePreset(
		id: string,
		changes: Partial<Omit<FSRSPreset, "id">>,
	): Promise<void> {
		const settings = this.getSettings();
		const idx = settings.fsrsPresets.findIndex((p) => p.id === id);
		if (idx === -1) return;
		const existing = settings.fsrsPresets[idx];
		if (!existing) return;

		if (changes.name && changes.name !== existing.name) {
			this.getCardStore?.()?.stats?.updateReviewLogPresetName(
				existing.name,
				changes.name,
			);
		}

		settings.fsrsPresets[idx] = { ...existing, ...changes };
		await this.persistSettings();
	}

	async deletePreset(id: string): Promise<void> {
		const settings = this.getSettings();
		if (id === settings.defaultPresetId) return;
		settings.fsrsPresets = settings.fsrsPresets.filter((p) => p.id !== id);
		await this.persistSettings();
	}

	/**
	 * Resolution order (most specific wins):
	 * 1. Note's own `fsrs_preset` frontmatter
	 * 2. Nearest ancestor with `fsrs_preset` (walks parents chain)
	 * 3. Global default preset
	 */
	resolvePresetForCard(
		card: FSRSFlashcardItem,
		context?: PresetResolutionContext,
	): FSRSPreset {
		const notePath = this.resolveNotePath(card);
		if (notePath) {
			const result = this.resolveForNotePath(notePath, context);
			if (result) return result;
		}
		return this.getDefaultPreset();
	}

	resolvePresetChain(
		notePath: string,
		context?: PresetResolutionContext,
	): { chain: PresetChainEntry[]; effective: PresetResolutionResult } {
		const chain: PresetChainEntry[] = [];
		let effective: PresetResolutionResult | null = null;

		// Tier 1: Note's own preset
		const notePresetName = this.lookupPresetName(notePath);
		const notePreset = notePresetName
			? this.getPresetByName(notePresetName)
			: undefined;
		if (notePreset && !effective) {
			effective = {
				preset: notePreset,
				source: "note",
				sourcePath: notePath,
			};
		}
		chain.push({
			source: "note",
			sourcePath: notePath,
			presetName: notePresetName,
			active: effective?.source === "note",
		});

		// Tier 2: Parent chain
		const parentResult = this.resolveParentPreset(notePath, context);
		if (parentResult && !effective) {
			effective = parentResult;
		}
		chain.push({
			source: "parent",
			sourcePath: parentResult?.sourcePath ?? context?.projectPath,
			presetName: parentResult
				? parentResult.preset.name
				: this.lookupPresetName(context?.projectPath),
			active: effective?.source === "parent",
		});

		// Tier 3: Default
		const defaultPreset = this.getDefaultPreset();
		if (!effective) {
			effective = { preset: defaultPreset, source: "default" };
		}
		chain.push({
			source: "default",
			presetName: defaultPreset.name,
			active: effective.source === "default",
		});

		return { chain, effective };
	}

	private resolveNotePath(card: FSRSFlashcardItem): string | null {
		if (!card.sourceUid) return null;
		return this.frontmatterIndex.getFileByValue(
			"flashcard_uid",
			card.sourceUid,
		);
	}

	private resolveForNotePath(
		notePath: string,
		context?: PresetResolutionContext,
	): FSRSPreset | null {
		// Tier 1: Note's own preset
		const notePreset = this.lookupPreset(notePath);
		if (notePreset) return notePreset;

		// Tier 2: Parent chain
		const parentResult = this.resolveParentPreset(notePath, context);
		if (parentResult) return parentResult.preset;

		return null;
	}

	/**
	 * Walks the parent chain (BFS) to find the nearest ancestor with fsrs_preset.
	 */
	private resolveParentPreset(
		notePath: string,
		context?: PresetResolutionContext,
	): PresetResolutionResult | null {
		if (context?.projectPath) {
			const preset = this.lookupPreset(context.projectPath);
			if (preset) {
				return {
					preset,
					source: "parent",
					sourcePath: context.projectPath,
				};
			}
		}

		// BFS through parents chain
		const visited = new Set<string>();
		const queue = [...this.hierarchyService.getParentsForNote(notePath)];

		while (queue.length > 0) {
			const current = queue.shift();
			if (current === undefined) break;
			if (visited.has(current)) continue;
			visited.add(current);

			const preset = this.lookupPreset(current);
			if (preset) {
				return { preset, source: "parent", sourcePath: current };
			}

			// Walk further up
			for (const grandparent of this.hierarchyService.getParentsForNote(
				current,
			)) {
				if (!visited.has(grandparent)) queue.push(grandparent);
			}
		}

		return null;
	}

	private lookupPresetName(path?: string | null): string | null {
		if (!path) return null;
		const values = this.frontmatterIndex.getValues("fsrs_preset", path);
		return values.length > 0 && values[0] ? values[0] : null;
	}

	private lookupPreset(path: string): FSRSPreset | undefined {
		const name = this.lookupPresetName(path);
		return name ? this.getPresetByName(name) : undefined;
	}

	toFSRSSettings(preset: FSRSPreset): FSRSSettings {
		return extractFSRSSettingsFromPreset(preset);
	}
}
