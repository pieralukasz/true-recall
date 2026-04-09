import type { FSRSPreset } from "@true-recall/core/types";

import {
	ActionButton,
	FormCard,
	FormField,
	SelectInput,
	TextInput,
} from "@true-recall/obsidian/components";

interface PresetSectionProps {
	presets: FSRSPreset[];
	preset: FSRSPreset;
	isDefault: boolean;
	selectedPresetId: string;
	onPresetChange: (id: string) => void;
	onCreate: () => void;
	onDelete: () => void;
	onRename: (name: string) => void;
}

export function PresetSection({
	presets,
	preset,
	isDefault,
	selectedPresetId,
	onPresetChange,
	onCreate,
	onDelete,
	onRename,
}: PresetSectionProps) {
	return (
		<FormCard title="FSRS presets">
			<FormField
				name="Active preset"
				description="Each preset has its own retention target, weights, steps, and daily limits"
			>
				<SelectInput
					value={selectedPresetId}
					onChange={onPresetChange}
					options={presets.map((p) => ({ value: p.id, label: p.name }))}
				/>
				<ActionButton label="New" variant="secondary" onClick={onCreate} />
				{!isDefault && (
					<ActionButton label="Delete" variant="danger" onClick={onDelete} />
				)}
			</FormField>

			{!isDefault && (
				<FormField name="Preset name">
					<TextInput
						value={preset.name}
						onChange={(v) => {
							if (v.trim()) onRename(v.trim());
						}}
					/>
				</FormField>
			)}
		</FormCard>
	);
}
