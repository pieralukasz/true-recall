import type { Signal } from "@preact/signals";

import { Clickable } from "@true-recall/obsidian/components";
import { cn } from "@true-recall/obsidian/utils/cn";

interface PresetFilterProps {
	presets: string[];
	selected: Signal<Set<string>>;
}

const PILL_BASE =
	"ep:px-2.5 ep:py-1 ep:text-xs ep:rounded-md ep:transition-colors";
const PILL_ACTIVE =
	"ep:bg-obs-interactive/15 ep:text-obs-interactive ep:font-medium";
const PILL_INACTIVE =
	"ep:text-obs-muted ep:hover:text-obs-normal ep:bg-obs-modifier-hover";

export function PresetFilter({ presets, selected }: PresetFilterProps) {
	if (presets.length < 2) return null;

	const allSelected = presets.every((p) => selected.value.has(p));

	const togglePreset = (preset: string) => {
		const next = new Set(selected.value);
		if (next.has(preset)) {
			// Prevent deselecting the last preset
			if (next.size <= 1) return;
			next.delete(preset);
		} else {
			next.add(preset);
		}
		selected.value = next;
	};

	const handleAllClick = () => {
		const firstPreset = presets[0];
		if (!firstPreset) return;
		if (allSelected) {
			// Deselect all except the first preset
			selected.value = new Set([firstPreset]);
		} else {
			selected.value = new Set(presets);
		}
	};

	return (
		<div class="ep:flex ep:flex-wrap ep:gap-1.5 ep:items-center">
			{presets.map((preset) => {
				const isActive = selected.value.has(preset);
				return (
					<Clickable
						key={preset}
						role="tab"
						aria-selected={isActive}
						class={cn(PILL_BASE, isActive ? PILL_ACTIVE : PILL_INACTIVE)}
						onClick={() => togglePreset(preset)}
					>
						{preset}
						{isActive && (
							<span class="ep:ml-1 ep:text-[10px] ep:opacity-70">&#10003;</span>
						)}
					</Clickable>
				);
			})}
			<Clickable
				role="tab"
				aria-selected={allSelected}
				class={cn(PILL_BASE, allSelected ? PILL_ACTIVE : PILL_INACTIVE)}
				onClick={handleAllClick}
			>
				All
			</Clickable>
		</div>
	);
}
