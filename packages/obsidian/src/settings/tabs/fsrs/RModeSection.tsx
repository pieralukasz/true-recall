import type { TrueRecallSettings } from "@true-recall/core/types";

import {
	FormCard,
	FormField,
	SliderInput,
	TextInput,
	ToggleInput,
} from "@true-recall/obsidian/components";
import { t } from "@true-recall/obsidian/i18n";

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
		return `With ${sessionSize} review cards, all are cards you are losing. Fastest recovery, hardest session.`;
	}
	return `With ${sessionSize} review cards: ${hard} at the edge of forgetting, ${comfort} you still know.`;
}

export function RModeSection({ settings, save }: RModeSectionProps) {
	const rMode = settings.rMode;

	const patch = (changes: Partial<TrueRecallSettings["rMode"]>) =>
		void save({ rMode: { ...rMode, ...changes } });

	return (
		<FormCard title={t("R-Mode (experimental)")}>
			<FormField
				name={t("Enable R-Mode")}
				description={t(
					"Build sessions from current retrievability instead of due dates. Nothing is ever overdue; you choose how many review cards to include. New and learning cards remain separate.",
				)}
			>
				<ToggleInput
					value={rMode.enabled}
					onChange={(enabled) => patch({ enabled })}
					ariaLabel="Enable R-Mode"
				/>
			</FormField>

			<FormField
				name={t("Default review count")}
				description={t(
					"Review cards pre-filled on the dashboard and in the panel. You can always type a different number.",
				)}
			>
				<TextInput
					value={String(rMode.defaultSessionSize)}
					onChange={(value) =>
						patch({ defaultSessionSize: parsePositiveInt(value, 30) })
					}
					placeholder="30"
					class="tr-control--compact"
					disabled={!rMode.enabled}
				/>
			</FormField>

			<FormField
				name={t("Session composition")}
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
				name={t("Saturation margin")}
				description={t(
					"Cards above their preset's retention target plus this margin are not offered. A smaller margin wastes less effort but empties the pool sooner.",
				)}
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
				name={t("Urgent threshold")}
				description={t(
					"Cards below {0}% retrievability are never pushed out of a session by the composition slider.",
					[Math.round(rMode.urgentBelow * 100)],
				)}
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
