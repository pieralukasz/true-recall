import type { GenerationPreset, TrueRecallSettings } from "@true-recall/core";

import { ActionButton } from "@true-recall/obsidian/components";
import { usePlugin } from "@true-recall/obsidian/preact";

import type { PluginSettingsProps } from "../types";
import { GenerationPresetEditor } from "./GenerationPresetEditor";

function makeId(): string {
	return `preset-${Math.random().toString(36).slice(2, 10)}`;
}

export function AIGenerationSettingsPanel({
	settings,
	save,
}: PluginSettingsProps) {
	const plugin = usePlugin();
	const noteTypes = plugin.cardStore?.noteTypes?.getAll() ?? [];
	const presets = settings.generationPresets ?? [];
	const builtins = presets.filter((p) => p.builtin);
	const userPresets = presets.filter((p) => !p.builtin);

	const persist = (next: GenerationPreset[]) => {
		const patch: Partial<TrueRecallSettings> = { generationPresets: next };
		const newDefault = next.find((p) => p.isDefault);
		if (newDefault) {
			for (const p of next) p.isDefault = p.id === newDefault.id;
			patch.defaultGenerationPresetId = newDefault.id;
		} else if (next[0]) {
			next[0].isDefault = true;
			patch.defaultGenerationPresetId = next[0].id;
		}
		void save(patch);
	};

	const updateUserPreset = (p: GenerationPreset) => {
		persist(presets.map((existing) => (existing.id === p.id ? p : existing)));
	};

	const forkBuiltin = (p: GenerationPreset) => {
		const forked: GenerationPreset = {
			...p,
			id: makeId(),
			name: `${p.name} (fork)`,
			builtin: false,
			requiresPro: false,
			isDefault: false,
			createdAt: Date.now(),
			updatedAt: Date.now(),
		};
		persist([...presets, forked]);
	};

	const removeUserPreset = (p: GenerationPreset) => {
		persist(presets.filter((existing) => existing.id !== p.id));
	};

	const addNew = () => {
		const defaultNoteTypeId = noteTypes[0]?.id ?? "builtin-basic";
		const fresh: GenerationPreset = {
			id: makeId(),
			name: "New preset",
			prompt: "",
			noteTypeId: defaultNoteTypeId,
			tts: null,
			image: null,
			requiresPro: false,
			builtin: false,
			isDefault: false,
			createdAt: Date.now(),
			updatedAt: Date.now(),
		};
		persist([...presets, fresh]);
	};

	return (
		<>
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
