import { useCallback, useEffect, useState } from "preact/hooks";

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
	const [draftName, setDraftName] = useState(preset.name);

	useEffect(() => {
		setDraftName(preset.name);
	}, [preset.name]);

	// Renaming rewrites review-log rows and persists settings, so it is committed
	// on Enter/blur rather than on every keystroke.
	const commitName = useCallback(() => {
		const next = draftName.trim();
		if (!next || next === preset.name) {
			setDraftName(preset.name);
			return;
		}
		onRename(next);
	}, [draftName, preset.name, onRename]);

	return (
		<FormCard title="Preset">
			<FormField
				name="Active preset"
				description="Each preset has its own retention target, weights, steps, and daily limits"
				layout="stacked"
			>
				<SelectInput
					class="ep:flex-1 ep:min-w-0 ep:truncate"
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
				<FormField
					name="Preset name"
					description="Press Enter or click away to apply"
					layout="stacked"
				>
					<TextInput
						value={draftName}
						onChange={setDraftName}
						onBlur={commitName}
						onKeyDown={(event) => {
							if (event.key === "Enter") {
								event.preventDefault();
								commitName();
							}
						}}
						placeholder={preset.name}
						ariaLabel="Preset name"
					/>
				</FormField>
			)}
		</FormCard>
	);
}
