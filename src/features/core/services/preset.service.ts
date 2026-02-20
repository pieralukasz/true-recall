import type { FSRSFlashcardItem } from "@shared/types/fsrs";
import type {
	FSRSPreset,
	FSRSSettings,
	TrueRecallSettings,
} from "@shared/types/settings.types";
import { extractFSRSSettingsFromPreset } from "@shared/types/settings.types";
import { buildProjectGraph } from "@shared/utils/project-hierarchy";
import type { FrontmatterIndexService } from "@features/core/services/frontmatter-index.service";

export class PresetService {
	constructor(
		private getSettings: () => TrueRecallSettings,
		private persistSettings: () => Promise<void>,
		private frontmatterIndex: FrontmatterIndexService,
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
	 * Determines which preset to use for a card during review.
	 *
	 * Resolution order:
	 * 1. Explicit: note has `fsrs_preset: "name"` in frontmatter → use that preset
	 * 2. Session context: if reviewing from a project, walk up the project hierarchy
	 *    checking each project note's `fsrs_preset` field
	 * 3. Fallback: use default preset
	 */
	resolvePresetForCard(
		card: FSRSFlashcardItem,
		sessionProjectFilters?: string[],
	): FSRSPreset {
		// 1. Check note-level explicit preset
		if (card.sourceUid) {
			const file = this.frontmatterIndex.getFileByValue(
				"flashcard_uid",
				card.sourceUid,
			);
			if (file) {
				const presetValues = this.frontmatterIndex.getValues(
					"fsrs_preset",
					file.path,
				);
				if (presetValues.length > 0) {
					const presetName = presetValues[0];
					if (presetName) {
						const found = this.getPresetByName(presetName);
						if (found) return found;
					}
				}
			}
		}

		// 2. Session context: check project hierarchy
		if (sessionProjectFilters && sessionProjectFilters.length > 0) {
			const graph = buildProjectGraph(this.frontmatterIndex);

			for (const projectName of sessionProjectFilters) {
				const preset = this.resolvePresetFromProjectHierarchy(
					projectName,
					graph.parentMap,
				);
				if (preset) return preset;
			}
		}

		// 3. Fallback
		return this.getDefaultPreset();
	}

	/**
	 * Walk up the project hierarchy looking for a preset assignment.
	 * Checks the project note itself first, then its parents.
	 */
	private resolvePresetFromProjectHierarchy(
		projectName: string,
		parentMap: Map<string, string[]>,
		visited: Set<string> = new Set(),
	): FSRSPreset | null {
		if (visited.has(projectName)) return null;
		visited.add(projectName);

		// Check this project note's fsrs_preset
		const files = this.frontmatterIndex.getFilesByValue(
			"projects",
			projectName,
		);
		const projectFile = files.find((f) => f.basename === projectName);
		if (projectFile) {
			const presetValues = this.frontmatterIndex.getValues(
				"fsrs_preset",
				projectFile.path,
			);
			if (presetValues.length > 0) {
				const presetName = presetValues[0];
				if (presetName) {
					const found = this.getPresetByName(presetName);
					if (found) return found;
				}
			}
		}

		// Walk up to parents
		const parents = parentMap.get(projectName) ?? [];
		for (const parent of parents) {
			const found = this.resolvePresetFromProjectHierarchy(
				parent,
				parentMap,
				visited,
			);
			if (found) return found;
		}

		return null;
	}

	toFSRSSettings(preset: FSRSPreset): FSRSSettings {
		return extractFSRSSettingsFromPreset(preset);
	}
}
