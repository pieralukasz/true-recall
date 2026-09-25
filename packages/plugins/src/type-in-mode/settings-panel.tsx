import type { TypeInMode } from "@true-recall/core/types";

import { FormField, SelectInput } from "@true-recall/obsidian/components";
import { t } from "@true-recall/obsidian/i18n";

import type { PluginSettingsProps } from "../types";

export function TypeInModeSettingsPanel({
	settings,
	save,
}: PluginSettingsProps) {
	return (
		<FormField
			name={t("Default type-in mode")}
			description={t(
				"Type-in mode used when a new review session starts (T still cycles modes in-session)",
			)}
		>
			<SelectInput
				value={settings.defaultTypeInMode}
				onChange={(v) => void save({ defaultTypeInMode: v as TypeInMode })}
				options={[
					{
						value: "off",
						get label() {
							return t("Off");
						},
					},
					{
						value: "ai",
						get label() {
							return t("AI");
						},
					},
				]}
			/>
		</FormField>
	);
}
