import type { AssistantPreset } from "@true-recall/core/types/settings.types";

import {
	ActionButton,
	FormField,
	SliderInput,
	TextAreaInput,
	TextInput,
	ToggleInput,
} from "@true-recall/obsidian/components";
import { t } from "@true-recall/obsidian/i18n";

import type { PluginSettingsProps } from "../types";

let chipCounter = 0;

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

	const removePreset = (id: string) => {
		void save({ assistantPresets: presets.filter((p) => p.id !== id) });
	};

	const addPreset = () => {
		chipCounter += 1;
		void save({
			assistantPresets: [
				...presets,
				{
					id: `assistant-chip-${Date.now()}-${chipCounter}`,
					get name() {
						return t("New action");
					},
					instruction: "",
				},
			],
		});
	};

	return (
		<>
			<FormField
				name={t("Assistant model")}
				description={t(
					"Model used for research tasks. Leave empty to use your default AI model.",
				)}
			>
				<TextInput
					value={settings.assistantModel}
					onChange={(v) => void save({ assistantModel: v })}
					placeholder="e.g. anthropic/claude-sonnet-4"
				/>
			</FormField>

			<FormField
				name={t("Web search")}
				description={t(
					"Let the model search the web via OpenRouter (extra cost per search).",
				)}
			>
				<ToggleInput
					value={settings.assistantWebSearch}
					onChange={(v) => void save({ assistantWebSearch: v })}
				/>
			</FormField>

			<FormField
				name={t("Max sources")}
				description={t(
					"Maximum web sources/citations the assistant may collect per task. Set to 0 to disable source fetching.",
				)}
			>
				<SliderInput
					value={settings.assistantMaxSources}
					onChange={(v) => void save({ assistantMaxSources: v })}
					min={0}
					max={20}
					step={1}
					formatTooltip={(v) => `${v}`}
				/>
			</FormField>

			<FormField
				name={t("Global instructions")}
				description={t(
					"Appended to every task's prompt — your style, language and tone.",
				)}
			>
				<TextAreaInput
					value={settings.assistantInstructions}
					onChange={(v) => void save({ assistantInstructions: v })}
					rows={4}
					placeholder="e.g. Always answer in Polish. Keep answers to 1-3 words."
				/>
			</FormField>

			<FormField
				name={t("Max agent iterations")}
				description={t("Upper bound on tool-calling rounds per task.")}
			>
				<SliderInput
					value={settings.assistantMaxIterations}
					onChange={(v) => void save({ assistantMaxIterations: v })}
					min={1}
					max={25}
					step={1}
					formatTooltip={(v) => `${v}`}
				/>
			</FormField>

			<div class="ep:flex ep:flex-col ep:gap-3 ep:mt-6">
				<div class="ep:flex ep:flex-col ep:gap-0.5">
					<h3 class="ep:text-ui-small ep:font-semibold ep:text-obs-normal ep:m-0">
						{t("Quick actions")}
					</h3>
					<span class="ep:text-ui-smaller ep:text-obs-muted">
						{t(
							"One-tap actions shown in the Assistant workspace. Each also becomes a hotkey-bindable command in review.",
						)}
					</span>
				</div>

				{presets.length === 0 && (
					<span class="ep:text-ui-smaller ep:text-obs-muted ep:italic">
						{t("No quick actions yet.")}
					</span>
				)}

				{presets.map((preset) => (
					<div
						key={preset.id}
						class="ep:flex ep:flex-col ep:gap-2 ep:p-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-secondary"
					>
						<div class="ep:flex ep:items-center ep:gap-2">
							<div class="ep:flex-1">
								<TextInput
									value={preset.name}
									onChange={(v) => updatePreset(preset.id, { name: v })}
									placeholder={t("Action name")}
								/>
							</div>
							<ActionButton
								label={t("Delete")}
								variant="danger"
								onClick={() => removePreset(preset.id)}
							/>
						</div>
						<TextAreaInput
							value={preset.instruction}
							onChange={(v) => updatePreset(preset.id, { instruction: v })}
							rows={2}
							placeholder={t(
								"What should the Assistant do when this action is selected?",
							)}
						/>
					</div>
				))}

				<div>
					<ActionButton
						label={t("Add quick action")}
						variant="secondary"
						onClick={addPreset}
					/>
				</div>
			</div>
		</>
	);
}
