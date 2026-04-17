import { useState } from "preact/hooks";

import { BUILTIN_BASIC_PRESET } from "@true-recall/core/constants";
import type { GenerationPreset } from "@true-recall/core/types/generation-preset.types";
import type { NoteType } from "@true-recall/core/types/note.types";

import { usePlugin } from "@true-recall/obsidian/preact";

import type { PluginSettingsProps } from "../types";
import { PresetEditor } from "./preset-editor";

function resolveNoteTypeName(noteTypes: NoteType[], id: string): string {
	return noteTypes.find((nt) => nt.id === id)?.name ?? id;
}

function createNewPreset(noteTypes: NoteType[]): GenerationPreset {
	const basePreset = { ...BUILTIN_BASIC_PRESET };
	const basicNoteType = noteTypes.find((nt) => nt.id === basePreset.noteTypeId);
	const fields = basicNoteType
		? Object.fromEntries(
				basicNoteType.fields.map((f) => [
					f,
					{ role: "ai-text" as const, instruction: "" },
				]),
			)
		: basePreset.fields;

	return {
		...basePreset,
		id: crypto.randomUUID(),
		name: "New Preset",
		fields,
		isPinned: false,
		isDefault: false,
		createdAt: Date.now(),
		updatedAt: Date.now(),
	};
}

export function AIGenerationSettingsPanel({
	settings,
	save,
}: PluginSettingsProps) {
	const plugin = usePlugin();
	const [editingId, setEditingId] = useState<string | null>(null);

	const noteTypes: NoteType[] = plugin.cardStore?.noteTypes.getAll() ?? [];
	const presets = settings.generationPresets ?? [BUILTIN_BASIC_PRESET];

	const editingPreset =
		editingId != null ? presets.find((p) => p.id === editingId) : null;

	const handleSave = async (updated: GenerationPreset) => {
		const next = presets.map((p) => (p.id === updated.id ? updated : p));
		await save({ generationPresets: next });
		setEditingId(null);
	};

	const handleAdd = () => {
		const newPreset = createNewPreset(noteTypes);
		void save({ generationPresets: [...presets, newPreset] }).then(() => {
			setEditingId(newPreset.id);
		});
	};

	const handleDuplicate = (preset: GenerationPreset) => {
		const copy: GenerationPreset = {
			...preset,
			id: crypto.randomUUID(),
			name: `${preset.name} (copy)`,
			isPinned: false,
			isDefault: false,
			isBuiltin: false,
			isPro: false,
			createdAt: Date.now(),
			updatedAt: Date.now(),
		};
		void save({ generationPresets: [...presets, copy] });
	};

	const handleDelete = async (id: string) => {
		const target = presets.find((p) => p.id === id);
		if (target?.isBuiltin) return;
		await save({ generationPresets: presets.filter((p) => p.id !== id) });
	};

	if (editingPreset) {
		return (
			<PresetEditor
				preset={editingPreset}
				noteTypes={noteTypes}
				onSave={handleSave}
				onCancel={() => setEditingId(null)}
			/>
		);
	}

	return (
		<div class="ep:flex ep:flex-col ep:gap-3">
			<h3 class="ep:text-ui-small ep:font-semibold ep:text-obs-normal ep:m-0">
				Generation Presets
			</h3>

			<div class="ep:flex ep:flex-col ep:gap-1">
				{presets.map((preset) => {
					const noteTypeName = resolveNoteTypeName(
						noteTypes,
						preset.noteTypeId,
					);
					const isOnly = presets.length === 1;
					const isBuiltin = !!preset.isBuiltin;
					const editTitle = isBuiltin
						? "Built-in preset — duplicate to customize"
						: undefined;
					const deleteTitle = isBuiltin
						? "Built-in preset cannot be deleted"
						: undefined;
					return (
						<div
							key={preset.id}
							class="ep:flex ep:items-center ep:gap-2 ep:px-2 ep:py-1.5 ep:rounded ep:border ep:border-obs-border ep:bg-obs-primary"
						>
							<div class="ep:flex ep:flex-col ep:flex-1 ep:min-w-0">
								<span class="ep:text-ui-small ep:font-medium ep:truncate ep:flex ep:items-center ep:gap-1.5">
									{preset.name}
									{preset.isPro && (
										<span
											title="Requires True Recall Pro"
											class="ep:text-ui-smallest ep:font-semibold ep:px-1.5 ep:py-0.5 ep:rounded ep:bg-obs-interactive ep:text-obs-on-accent"
										>
											PRO
										</span>
									)}
								</span>
								<span class="ep:text-ui-smaller ep:text-obs-muted ep:truncate">
									{noteTypeName}
								</span>
							</div>
							<div class="ep:flex ep:items-center ep:gap-1">
								{preset.isPinned && (
									<span
										title="Pinned"
										class="ep:text-obs-muted ep:text-ui-smaller"
									>
										📌
									</span>
								)}
								{preset.isDefault && (
									<span
										title="Default"
										class="ep:text-obs-muted ep:text-ui-smaller"
									>
										⭐
									</span>
								)}
								<button
									type="button"
									title={editTitle}
									disabled={isBuiltin}
									class="ep:px-2 ep:py-0.5 ep:text-ui-smaller ep:border ep:border-obs-border ep:rounded ep:bg-obs-primary ep:hover:bg-obs-secondary ep:cursor-pointer ep:disabled:opacity-40 ep:disabled:cursor-not-allowed"
									onClick={() => setEditingId(preset.id)}
								>
									Edit
								</button>
								<button
									type="button"
									class="ep:px-2 ep:py-0.5 ep:text-ui-smaller ep:border ep:border-obs-border ep:rounded ep:bg-obs-primary ep:hover:bg-obs-secondary ep:cursor-pointer"
									onClick={() => handleDuplicate(preset)}
								>
									Duplicate
								</button>
								<button
									type="button"
									title={deleteTitle}
									disabled={isOnly || isBuiltin}
									class="ep:px-2 ep:py-0.5 ep:text-ui-smaller ep:border ep:border-obs-border ep:rounded ep:bg-obs-primary ep:hover:bg-obs-secondary ep:cursor-pointer ep:disabled:opacity-40 ep:disabled:cursor-not-allowed"
									onClick={() => void handleDelete(preset.id)}
								>
									Delete
								</button>
							</div>
						</div>
					);
				})}
			</div>

			<button
				type="button"
				class="ep:px-3 ep:py-1.5 ep:text-ui-small ep:border ep:border-obs-border ep:rounded ep:bg-obs-primary ep:hover:bg-obs-secondary ep:cursor-pointer ep:self-start"
				onClick={handleAdd}
			>
				Add Preset
			</button>
		</div>
	);
}
