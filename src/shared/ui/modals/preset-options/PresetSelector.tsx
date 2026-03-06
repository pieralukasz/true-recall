import type { FSRSPreset } from "@shared/types";
import {
	ActionButton,
	FormCard,
	FormField,
	SelectInput,
	TextInput,
} from "@shared/ui/components";

interface PresetSelectorProps {
	presets: FSRSPreset[];
	preset: FSRSPreset;
	isDefault: boolean;
	onPresetChange: (id: string) => void;
	onCreate: () => void;
	onDelete: () => void;
	onRename: (name: string) => void;
}

export function PresetSelector({
	presets,
	preset,
	isDefault,
	onPresetChange,
	onCreate,
	onDelete,
	onRename,
}: PresetSelectorProps) {
	return (
		<FormCard>
			<FormField
				name="Preset"
				description="Each preset has its own retention target, weights, steps, and daily limits"
			>
				<SelectInput
					value={preset.id}
					onChange={onPresetChange}
					options={presets.map((p) => ({
						value: p.id,
						label: p.name,
					}))}
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
