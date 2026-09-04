import { FormField, ToggleInput } from "@true-recall/obsidian/components";

import type { PluginSettingsProps } from "../types";

export function LinkStatusSettingsPanel({
	settings,
	save,
}: PluginSettingsProps) {
	return (
		<>
			<FormField
				name="Show in flashcard panel"
				description="Display progress indicators next to links inside flashcard panel cards."
			>
				<ToggleInput
					value={settings.showDonutsInPanel}
					onChange={(value) => void save({ showDonutsInPanel: value })}
				/>
			</FormField>
			<FormField
				name="Show during review"
				description="Display progress indicators next to links during review sessions."
			>
				<ToggleInput
					value={settings.showDonutsInReview}
					onChange={(value) => void save({ showDonutsInReview: value })}
				/>
			</FormField>
		</>
	);
}
