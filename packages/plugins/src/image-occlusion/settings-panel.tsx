import { FormField, TextAreaInput } from "@true-recall/obsidian/components";
import { t } from "@true-recall/obsidian/i18n";

import type { PluginSettingsProps } from "../types";

export function ImageOcclusionSettingsPanel({
	settings,
	save,
}: PluginSettingsProps) {
	return (
		<FormField
			name={t("AI detection prompt")}
			description={t(
				"Custom prompt for AI region detection in image occlusion. Leave empty to use built-in prompt.",
			)}
		>
			<TextAreaInput
				value={settings.aiIODetectionPrompt ?? ""}
				onChange={(v) =>
					void save({
						aiIODetectionPrompt: v.trim().length > 0 ? v : undefined,
					})
				}
				rows={4}
				class="ep:w-full ep:font-mono ep:text-ui-smaller"
			/>
		</FormField>
	);
}
