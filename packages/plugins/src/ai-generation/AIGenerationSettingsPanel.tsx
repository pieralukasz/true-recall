import { useCallback, useState } from "preact/hooks";

import {
	BUILTIN_BASIC_REVERSED_ID,
	BUILTIN_CLOZE_ID,
	BUILTIN_IMAGE_OCCLUSION_ID,
	type GenerationPreset,
	type TrueRecallSettings,
} from "@true-recall/core";

import { ActionButton } from "@true-recall/obsidian/components";
import { usePlugin } from "@true-recall/obsidian/preact";

import { LMStudioScopedModelField } from "../shared/LMStudioScopedModelField";
import { usePersistentSettingsSlice } from "../shared/usePersistentSettingsSlice";
import type { PluginSettingsProps } from "../types";
import { GenerationPresetEditor } from "./GenerationPresetEditor";

function makeId(existing: readonly GenerationPreset[]): string {
	const taken = new Set(existing.map((preset) => preset.id));
	let id = "";
	do {
		id = `preset-${Math.random().toString(36).slice(2, 10)}`;
	} while (taken.has(id));
	return id;
}

// Note types whose cards are produced by dedicated flows (reversed templates,
// cloze syntax, image occlusion) rather than plain AI field-fill generation.
const AI_GEN_EXCLUDED_NOTE_TYPE_IDS = new Set<string>([
	BUILTIN_BASIC_REVERSED_ID,
	BUILTIN_CLOZE_ID,
	BUILTIN_IMAGE_OCCLUSION_ID,
]);

function normalizeGenerationPresets(
	presets: readonly GenerationPreset[],
): GenerationPreset[] {
	const preferredDefault =
		presets.find((preset) => preset.isDefault)?.id ?? presets[0]?.id ?? null;

	return presets.map((preset) => ({
		...preset,
		isDefault: preferredDefault
			? preset.id === preferredDefault
			: !!preset.isDefault,
	}));
}

function buildGenerationPresetPatch(
	presets: GenerationPreset[],
): Partial<TrueRecallSettings> {
	return {
		generationPresets: presets,
		defaultGenerationPresetId:
			presets.find((preset) => preset.isDefault)?.id ?? presets[0]?.id ?? "",
	};
}

export function AIGenerationSettingsPanel({
	settings,
	save,
}: PluginSettingsProps) {
	const plugin = usePlugin();
	const noteTypes = (plugin.cardStore?.noteTypes?.getAll() ?? []).filter(
		(nt) => !AI_GEN_EXCLUDED_NOTE_TYPE_IDS.has(nt.id),
	);
	const [presets, persistPresets] = usePersistentSettingsSlice(
		settings.generationPresets ?? [],
		save,
		{
			normalize: normalizeGenerationPresets,
			buildPatch: buildGenerationPresetPatch,
		},
	);
	const builtins = presets.filter((p) => p.builtin);
	const userPresets = presets.filter((p) => !p.builtin);

	const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
	const toggleExpanded = (id: string) => {
		setExpandedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const updateUserPreset = useCallback(
		(id: string, patch: Partial<GenerationPreset>) => {
			persistPresets((current) =>
				current.map((existing) =>
					existing.id === id && !existing.builtin
						? { ...existing, ...patch, updatedAt: Date.now() }
						: existing,
				),
			);
		},
		[persistPresets],
	);

	const forkBuiltin = (p: GenerationPreset) => {
		let forkedId: string | null = null;
		persistPresets(
			(current) => {
				const id = makeId(current);
				forkedId = id;
				const now = Date.now();
				const forked: GenerationPreset = {
					...p,
					id,
					name: `${p.name} (fork)`,
					builtin: false,
					requiresPro: false,
					isDefault: false,
					createdAt: now,
					updatedAt: now,
				};
				return [...current, forked];
			},
			{ flush: true },
		);
		if (forkedId) {
			const id = forkedId;
			setExpandedIds((prev) => new Set(prev).add(id));
		}
	};

	const removeUserPreset = (p: GenerationPreset) => {
		persistPresets(
			(current) =>
				current.filter((existing) => existing.id !== p.id || existing.builtin),
			{ flush: true },
		);
		setExpandedIds((prev) => {
			const next = new Set(prev);
			next.delete(p.id);
			return next;
		});
	};

	const addNew = () => {
		const defaultNoteTypeId = noteTypes[0]?.id ?? "builtin-basic";
		let freshId: string | null = null;
		persistPresets(
			(current) => {
				const id = makeId(current);
				freshId = id;
				const now = Date.now();
				const fresh: GenerationPreset = {
					id,
					name: "New preset",
					prompt: "",
					noteTypeId: defaultNoteTypeId,
					tts: null,
					image: null,
					requiresPro: false,
					builtin: false,
					isDefault: false,
					createdAt: now,
					updatedAt: now,
				};
				return [...current, fresh];
			},
			{ flush: true },
		);
		if (freshId) {
			const id = freshId;
			setExpandedIds((prev) => new Set(prev).add(id));
		}
	};

	return (
		<>
			<LMStudioScopedModelField
				settings={settings}
				save={save}
				modelKey="lmStudioGenerationModel"
				name="LM Studio model"
				description="Used only by AI Flashcard Generation when LM Studio is the selected provider."
			/>

			<div class="ep:flex ep:gap-2 ep:items-start ep:mt-2 ep:p-2.5 ep:border-l-2 ep:border-obs-accent ep:bg-obs-accent/8 ep:rounded-r-md">
				<span class="ep:text-ui-smaller ep:text-obs-normal ep:leading-relaxed">
					Presets don't show up in the UI automatically. To use a preset, open
					the <b>Selection Toolbar</b> plugin settings and add it as a button
					(Editor toolbar or Global toolbar). Only then will it appear in the
					action bar above selected text.
				</span>
			</div>

			{builtins.length > 0 && (
				<div class="ep:flex ep:flex-col ep:gap-3 ep:mt-4">
					<div class="ep:flex ep:flex-col ep:gap-0.5">
						<h3 class="ep:text-ui-small ep:font-semibold ep:text-obs-normal ep:m-0">
							Built-in presets
						</h3>
						<span class="ep:text-ui-smaller ep:text-obs-muted">
							Ship with the plugin — fork to customize
						</span>
					</div>
					{builtins.map((p) => (
						<GenerationPresetEditor
							key={p.id}
							preset={p}
							noteTypes={noteTypes}
							readOnly
							onFork={() => forkBuiltin(p)}
						/>
					))}
				</div>
			)}

			<div class="ep:flex ep:flex-col ep:gap-3 ep:mt-4">
				<div class="ep:flex ep:flex-col ep:gap-0.5">
					<h3 class="ep:text-ui-small ep:font-semibold ep:text-obs-normal ep:m-0">
						Your presets
					</h3>
					<span class="ep:text-ui-smaller ep:text-obs-muted">
						Pick a note type, write one prompt — the pipeline fills the fields.
						Enable audio/image widgets per preset.
					</span>
				</div>
				{userPresets.length === 0 && (
					<span class="ep:text-ui-smaller ep:text-obs-muted ep:italic">
						No custom presets yet. Add one to craft your own instruction.
					</span>
				)}
				{userPresets.map((p) => (
					<GenerationPresetEditor
						key={p.id}
						preset={p}
						noteTypes={noteTypes}
						onChange={updateUserPreset}
						onDelete={() => removeUserPreset(p)}
						expanded={expandedIds.has(p.id)}
						onToggleExpanded={() => toggleExpanded(p.id)}
					/>
				))}
				<div>
					<ActionButton
						label="+ New preset"
						variant="outline"
						size="sm"
						onClick={addNew}
					/>
				</div>
			</div>
		</>
	);
}
