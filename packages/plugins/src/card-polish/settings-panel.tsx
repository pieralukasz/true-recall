import type { CardPolishPreset, CardPolishSettings } from "@true-recall/core";

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
		<div className="tr-card-polish-settings">
			<label className="tr-card-polish-setting-row">
				<span>Custom prompt: auto-apply</span>
				<input
					type="checkbox"
					checked={slice.customPromptAutoApply}
					onChange={(e) =>
						persist({
							...slice,
							customPromptAutoApply: (e.target as HTMLInputElement).checked,
						})
					}
				/>
			</label>
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
	);
}
