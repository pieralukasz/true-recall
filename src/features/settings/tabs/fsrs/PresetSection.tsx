import type { FSRSPreset } from "../../../../shared/types";
import {
	ActionButton,
	SelectInput,
	SettingRow,
	TextInput,
} from "../../../../shared/ui/components";

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
		<>
			<SettingRow heading name="FSRS presets" />

			<SettingRow
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
			</SettingRow>

			{!isDefault && (
				<SettingRow name="Preset name">
					<TextInput
						value={preset.name}
						onChange={(v) => {
							if (v.trim()) onRename(v.trim());
						}}
					/>
				</SettingRow>
			)}
		</>
	);
}
