import type { TrueRecallSettings } from "@true-recall/core/types";

import {
	FormCard,
	FormField,
	SliderInput,
	TextInput,
	ToggleInput,
} from "@true-recall/obsidian/components";

interface RModeSectionProps {
	settings: TrueRecallSettings;
	save: (patch: Partial<TrueRecallSettings>) => Promise<void>;
}

function parsePositiveInt(value: string, fallback: number): number {
	const parsed = Number.parseInt(value, 10);
	return Number.isNaN(parsed) ? fallback : Math.max(1, parsed);
}

/**
 * Describe the slider in cards rather than percentages — nobody can calibrate
 * "30% comfort mix", but everyone can read "21 at the edge + 9 you know".
 */
function describeMix(mix: number, sessionSize: number): string {
	const comfort = Math.round(sessionSize * mix);
	const hard = sessionSize - comfort;
	if (comfort === 0) {
		return `A ${sessionSize}-card session is all cards you are losing. Fastest recovery, hardest session.`;
	}
	return `A ${sessionSize}-card session: ${hard} at the edge of forgetting, ${comfort} you still know.`;
}

export function RModeSection({ settings, save }: RModeSectionProps) {
	const rMode = settings.rMode;

	const patch = (changes: Partial<TrueRecallSettings["rMode"]>) =>
		void save({ rMode: { ...rMode, ...changes } });

	return (
		<FormCard title="R-Mode (experimental)">
			<FormField
				name="Enable R-Mode"
				description="Build sessions from current retrievability instead of due dates. Nothing is ever overdue; you choose the session size. Due dates and load balancing keep running underneath, so you can switch back at any time without changing any card."
			>
				<ToggleInput
					value={rMode.enabled}
					onChange={(enabled) => patch({ enabled })}
					ariaLabel="Enable R-Mode"
				/>
			</FormField>

			<FormField
				name="Default session size"
				description="Pre-filled in the panel. You can always type a different number."
			>
				<TextInput
					value={String(rMode.defaultSessionSize)}
					onChange={(value) =>
						patch({ defaultSessionSize: parsePositiveInt(value, 30) })
					}
					placeholder="30"
					disabled={!rMode.enabled}
				/>
			</FormField>

			<FormField
				name="Session composition"
				description={describeMix(rMode.comfortMix, rMode.defaultSessionSize)}
			>
				<SliderInput
					value={rMode.comfortMix}
					onChange={(comfortMix) => patch({ comfortMix })}
					min={0}
					max={0.5}
					step={0.05}
					disabled={!rMode.enabled}
					formatTooltip={(value) => `${Math.round(value * 100)}% known`}
				/>
			</FormField>

			<FormField
				name="Saturation margin"
				description={`Cards above ${Math.round((settings.fsrsRequestRetention + rMode.ceilingOffset) * 100)}% retrievability are not offered — a review there buys almost no stability. A smaller margin wastes less effort but empties the pool sooner.`}
			>
				<SliderInput
					value={rMode.ceilingOffset}
					onChange={(ceilingOffset) => patch({ ceilingOffset })}
					min={0}
					max={0.09}
					step={0.01}
					disabled={!rMode.enabled}
					formatTooltip={(value) => `+${Math.round(value * 100)} pp`}
				/>
			</FormField>

			<FormField
				name="Urgent threshold"
				description={`Cards below ${Math.round(rMode.urgentBelow * 100)}% retrievability are never pushed out of a session by the composition slider.`}
			>
				<SliderInput
					value={rMode.urgentBelow}
					onChange={(urgentBelow) => patch({ urgentBelow })}
					min={0.2}
					max={0.8}
					step={0.05}
					disabled={!rMode.enabled}
					formatTooltip={(value) => `${Math.round(value * 100)}%`}
				/>
			</FormField>
		</FormCard>
	);
}
