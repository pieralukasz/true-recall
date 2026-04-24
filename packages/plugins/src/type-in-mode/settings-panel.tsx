import type { TypeInMode } from "@true-recall/core/types";

import {
	FormField,
	SelectInput,
	TextAreaInput,
} from "@true-recall/obsidian/components";

import type { PluginSettingsProps } from "../types";

export function TypeInModeSettingsPanel({
	settings,
	save,
}: PluginSettingsProps) {
	return (
		<>
			<FormField
				name="Default type-in mode"
				description="Type-in mode used when a new review session starts (T still cycles modes in-session)"
			>
				<SelectInput
					value={settings.defaultTypeInMode}
					onChange={(v) => void save({ defaultTypeInMode: v as TypeInMode })}
					options={[
						{ value: "off", label: "Off" },
						{ value: "diff", label: "Diff" },
						{ value: "ai", label: "AI" },
					]}
				/>
			</FormField>

			<FormField
				name="Type-in grading prompt"
				description="Optional custom system prompt for AI answer grading during review type-in mode. Leave empty to use built-in prompt."
			>
				<TextAreaInput
					value={settings.aiTypeInGradingPrompt ?? ""}
					onChange={(v) =>
						void save({
							aiTypeInGradingPrompt: v.trim().length > 0 ? v : undefined,
						})
					}
					rows={6}
					class="ep:w-full ep:font-mono ep:text-ui-smaller"
				/>
			</FormField>
		</>
	);
}
