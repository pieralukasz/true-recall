import type { CardPolishPreset, CardPolishSettings } from "@true-recall/core";

import { FormField, ToggleInput } from "@true-recall/obsidian/components";

import type { PluginSettingsProps } from "../types";
import { DEFAULT_CARD_POLISH_SETTINGS } from "./default-presets";
import { PresetEditor } from "./preset-editor";

function makeId(): string {
	return `preset-${Math.random().toString(36).slice(2, 10)}`;
}

export function CardPolishSettingsPanel({
	settings,
	save,
}: PluginSettingsProps) {
	const slice: CardPolishSettings =
		settings.cardPolish ?? DEFAULT_CARD_POLISH_SETTINGS;

	const persist = (next: CardPolishSettings) => save({ cardPolish: next });

	const updatePreset = (p: CardPolishPreset) => {
		persist({
			...slice,
			presets: slice.presets.map((existing) =>
				existing.id === p.id ? p : existing,
			),
		});
	};

	const fork = (p: CardPolishPreset) => {
		const forked: CardPolishPreset = {
			...p,
			id: makeId(),
			name: `${p.name} (fork)`,
			builtin: false,
		};
		persist({ ...slice, presets: [...slice.presets, forked] });
	};

	const remove = (p: CardPolishPreset) => {
		persist({
			...slice,
			presets: slice.presets.filter((existing) => existing.id !== p.id),
		});
	};

	return (
		<>
			<FormField
				name="Auto-apply custom prompts"
				description="Run freeform polish prompts instantly without a preview step"
			>
				<ToggleInput
					value={slice.customPromptAutoApply}
					onChange={(v) => persist({ ...slice, customPromptAutoApply: v })}
				/>
			</FormField>

			<div class="ep:flex ep:flex-col ep:gap-3 ep:mt-4">
				<div class="ep:flex ep:flex-col ep:gap-0.5">
					<h3 class="ep:text-ui-small ep:font-semibold ep:text-obs-normal ep:m-0">
						Presets
					</h3>
					<span class="ep:text-ui-smaller ep:text-obs-muted">
						Reusable polish recipes available from the card menu and hotkeys
					</span>
				</div>
				{slice.presets.map((p) => (
					<PresetEditor
						key={p.id}
						preset={p}
						onChange={updatePreset}
						onFork={() => fork(p)}
						onDelete={p.builtin ? undefined : () => remove(p)}
					/>
				))}
			</div>
		</>
	);
}
