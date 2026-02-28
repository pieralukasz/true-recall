import { Clickable } from "@shared/ui/components";
import { cn } from "@shared/ui/utils";

interface ChartToggle<K extends string> {
	key: K;
	label: string;
	color: string;
}

interface ChartToggleBarProps<K extends string> {
	toggles: ChartToggle<K>[];
	visibility: Record<K, boolean>;
	onToggle: (key: K) => void;
}

export function ChartToggleBar<K extends string>({
	toggles,
	visibility,
	onToggle,
}: ChartToggleBarProps<K>) {
	return (
		<div class="ep:flex ep:flex-wrap ep:gap-1.5 ep:justify-center ep:mb-3 ep:pb-3 ep:border-b ep:border-obs-border">
			{toggles.map(({ key, label, color }) => {
				const active = visibility[key];
				return (
					<Clickable
						key={key}
						class={cn(
							"ep:px-2.5 ep:py-0.5 ep:rounded-full ep:text-[11px] ep:font-medium ep:select-none ep:transition-opacity",
							active
								? "ep-dynamic-color"
								: "ep:bg-obs-modifier-hover ep:text-obs-muted ep:opacity-60 hover:ep:opacity-100",
						)}
						style={
							active
								? ({
										"--ep-dynamic-color": color,
										backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
									} as Record<string, string>)
								: undefined
						}
						onClick={() => onToggle(key)}
					>
						{label}
					</Clickable>
				);
			})}
		</div>
	);
}
