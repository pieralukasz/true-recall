import type { FSRSPreset } from "@shared/types/settings.types";

export function PresetSelector({
	presets,
	selected,
	onChange,
}: {
	presets: FSRSPreset[];
	selected: string | null;
	onChange: (presetName: string | null) => void;
}) {
	if (presets.length <= 1) return null;

	return (
		<div class="ep:flex ep:items-center ep:gap-2">
			<span class="ep:text-xs ep:text-obs-muted">Preset:</span>
			<select
				class="dropdown"
				value={selected ?? "__all__"}
				onChange={(e) => {
					const val = (e.target as HTMLSelectElement).value;
					onChange(val === "__all__" ? null : val);
				}}
			>
				<option value="__all__">All presets</option>
				{presets.map((p) => (
					<option key={p.id} value={p.name}>
						{p.name}
					</option>
				))}
			</select>
		</div>
	);
}
