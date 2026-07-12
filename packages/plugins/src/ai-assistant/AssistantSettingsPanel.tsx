import type { AssistantPreset } from "@true-recall/core/types/settings.types";

import type { PluginSettingsProps } from "../types";

export function AssistantSettingsPanel({
	settings,
	save,
}: PluginSettingsProps) {
	const presets = settings.assistantPresets ?? [];

	const updatePreset = (id: string, patch: Partial<AssistantPreset>) => {
		void save({
			assistantPresets: presets.map((p) =>
				p.id === id ? { ...p, ...patch } : p,
			),
		});
	};

	return (
		<div class="tr-assistant-settings">
			<label>
				Assistant model (empty = default model)
				<input
					type="text"
					value={settings.assistantModel}
					placeholder="e.g. anthropic/claude-sonnet-4"
					onChange={(e) =>
						void save({ assistantModel: (e.target as HTMLInputElement).value })
					}
				/>
			</label>
			<label>
				<input
					type="checkbox"
					checked={settings.assistantWebSearch}
					onChange={(e) =>
						void save({
							assistantWebSearch: (e.target as HTMLInputElement).checked,
						})
					}
				/>
				Enable web search (OpenRouter, extra cost per search)
			</label>
			<label>
				Global instructions
				<textarea
					rows={4}
					value={settings.assistantInstructions}
					onChange={(e) =>
						void save({
							assistantInstructions: (e.target as HTMLTextAreaElement).value,
						})
					}
				/>
			</label>
			<label>
				Max agent iterations
				<input
					type="number"
					min={1}
					max={25}
					value={settings.assistantMaxIterations}
					onChange={(e) =>
						void save({
							assistantMaxIterations: Math.max(
								1,
								Number.parseInt((e.target as HTMLInputElement).value, 10) || 10,
							),
						})
					}
				/>
			</label>
			<h4>Quick actions (chips)</h4>
			{presets.map((preset) => (
				<div key={preset.id} class="tr-assistant-preset">
					<input
						type="text"
						value={preset.name}
						onChange={(e) =>
							updatePreset(preset.id, {
								name: (e.target as HTMLInputElement).value,
							})
						}
					/>
					<textarea
						rows={2}
						value={preset.instruction}
						onChange={(e) =>
							updatePreset(preset.id, {
								instruction: (e.target as HTMLTextAreaElement).value,
							})
						}
					/>
					<button
						type="button"
						onClick={() =>
							void save({
								assistantPresets: presets.filter((p) => p.id !== preset.id),
							})
						}
					>
						Delete
					</button>
				</div>
			))}
			<button
				type="button"
				onClick={() =>
					void save({
						assistantPresets: [
							...presets,
							{
								id: `assistant-${Date.now()}`,
								name: "New action",
								instruction: "",
							},
						],
					})
				}
			>
				Add quick action
			</button>
		</div>
	);
}
