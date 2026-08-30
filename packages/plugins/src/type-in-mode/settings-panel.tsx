import type { TypeInMode } from "@true-recall/core/types";

import { FormField, SelectInput } from "@true-recall/obsidian/components";

import type { PluginSettingsProps } from "../types";

export function TypeInModeSettingsPanel({
	settings,
	save,
}: PluginSettingsProps) {
	return (
		<FormField
			name="Default type-in mode"
			description="Type-in mode used when a new review session starts (T still cycles modes in-session)"
		>
			<SelectInput
				value={settings.defaultTypeInMode}
				onChange={(v) => void save({ defaultTypeInMode: v as TypeInMode })}
				options={[
					{ value: "off", label: "Off" },
					{ value: "ai", label: "AI" },
				]}
			/>
		</FormField>
	);
}
