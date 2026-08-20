import type { FSRSPreset } from "@true-recall/core/types";

import {
	ActionButton,
	FormCard,
	FormField,
	SelectInput,
	TextInput,
} from "@true-recall/obsidian/components";

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
		<FormCard title="Preset">
			<FormField
				name="Active preset"
				description="Each preset has its own retention target, weights, steps, and daily limits"
				layout="stacked"
			>
				<SelectInput
					class="ep:flex-1 ep:min-w-0"
					value={preset.id}
					onChange={onPresetChange}
					ariaLabel="Active preset"
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
				<FormField name="Preset name" layout="stacked">
					<TextInput
						value={preset.name}
						onChange={onRename}
						placeholder="Preset name"
						ariaLabel="Preset name"
					/>
				</FormField>
			)}
		</FormCard>
	);
}
