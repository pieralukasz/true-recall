import { FormField, ToggleInput } from "@true-recall/obsidian/components";
import { t } from "@true-recall/obsidian/i18n";

import type { PluginSettingsProps } from "../types";

export function LinkStatusSettingsPanel({
	settings,
	save,
}: PluginSettingsProps) {
	return (
		<>
			<FormField
				name={t("Show in flashcard panel")}
				description={t(
					"Display progress indicators next to links inside flashcard panel cards.",
				)}
			>
				<ToggleInput
					value={settings.showDonutsInPanel}
					onChange={(value) => void save({ showDonutsInPanel: value })}
				/>
			</FormField>
			<FormField
				name={t("Show during review")}
				description={t(
					"Display progress indicators next to links during review sessions.",
				)}
			>
				<ToggleInput
					value={settings.showDonutsInReview}
					onChange={(value) => void save({ showDonutsInReview: value })}
				/>
			</FormField>
		</>
	);
}
