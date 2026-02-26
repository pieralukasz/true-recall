import type { FolderProjectService } from "@features/core/services/folder-project.service";
import type { FrontmatterIndexService } from "@features/core/services/frontmatter-index.service";
import type { ProjectLinkService } from "@features/core/services/project-link.service";
import type { FSRSFlashcardItem } from "@shared/types/fsrs";
import type {
	FSRSPreset,
	FSRSSettings,
	TrueRecallSettings,
} from "@shared/types/settings.types";
import { extractFSRSSettingsFromPreset } from "@shared/types/settings.types";

export interface PresetResolutionContext {
	projectPath?: string;
}

export type PresetSource = "note" | "link-project" | "folder" | "default";

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
		private projectLinkService: ProjectLinkService | null,
		private folderProjectService: FolderProjectService | null,
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
	 * Resolution order (most specific wins):
	 * 1. Note's own `fsrs_preset` frontmatter
	 * 2. Link-based project's `fsrs_preset` (context-sensitive)
	 * 3. Folder project's `fsrs_preset` (walks up hierarchy)
	 * 4. Global default preset
	 *
	 * With project context: step 2 checks that specific project.
	 * Without context: step 2 iterates all projects linking to this note.
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

	/**
	 * Returns the full inheritance chain for a note — used by PresetInspectorModal.
	 */
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

		// Tier 2: Link-based project preset
		const projectResult = this.resolveProjectPreset(notePath, context);
		if (projectResult && !effective) {
			effective = projectResult;
		}
		chain.push({
			source: "link-project",
			sourcePath: projectResult?.sourcePath ?? context?.projectPath,
			presetName: projectResult
				? projectResult.preset.name
				: this.lookupPresetName(context?.projectPath),
			active: effective?.source === "link-project",
		});

		// Tier 3: Folder preset
		const folderResult = this.resolveFolderPreset(notePath);
		if (folderResult && !effective) {
			effective = folderResult;
		}
		chain.push({
			source: "folder",
			sourcePath: folderResult?.sourcePath,
			presetName: folderResult ? folderResult.preset.name : null,
			active: effective?.source === "folder",
		});

		// Tier 4: Default
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
		const file = this.frontmatterIndex.getFileByValue(
			"flashcard_uid",
			card.sourceUid,
		);
		return file?.path ?? null;
	}

	private resolveForNotePath(
		notePath: string,
		context?: PresetResolutionContext,
	): FSRSPreset | null {
		// Tier 1: Note's own preset
		const notePreset = this.lookupPreset(notePath);
		if (notePreset) return notePreset;

		// Tier 2: Link-based project preset
		const projectResult = this.resolveProjectPreset(notePath, context);
		if (projectResult) return projectResult.preset;

		// Tier 3: Folder preset
		const folderResult = this.resolveFolderPreset(notePath);
		if (folderResult) return folderResult.preset;

		return null;
	}

	private resolveProjectPreset(
		notePath: string,
		context?: PresetResolutionContext,
	): PresetResolutionResult | null {
		if (!this.projectLinkService) return null;

		if (context?.projectPath) {
			// With context: check the specific project
			const preset = this.lookupPreset(context.projectPath);
			if (preset) {
				return {
					preset,
					source: "link-project",
					sourcePath: context.projectPath,
				};
			}
		} else {
			// Without context: iterate all projects for this note
			const projectPaths =
				this.projectLinkService.getProjectsForNote(notePath);
			for (const pp of projectPaths) {
				const preset = this.lookupPreset(pp);
				if (preset) {
					return { preset, source: "link-project", sourcePath: pp };
				}
			}
		}

		return null;
	}

	private resolveFolderPreset(
		notePath: string,
	): PresetResolutionResult | null {
		if (!this.folderProjectService) return null;

		const parts = notePath.split("/");
		parts.pop(); // remove filename

		while (parts.length > 0) {
			const folderPath = parts.join("/");
			const folderNotePath =
				this.folderProjectService.getFolderNotePath(folderPath);
			if (folderNotePath) {
				const preset = this.lookupPreset(folderNotePath);
				if (preset) {
					return {
						preset,
						source: "folder",
						sourcePath: folderNotePath,
					};
				}
			}
			parts.pop();
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
