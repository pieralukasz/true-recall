import { useFsrsHelperOp } from "@features/settings/tabs/fsrs/useFsrsHelperOp";
import type { TrueRecallSettings } from "@shared/types";
import {
	ActionButton,
	InfoBlock,
	SettingRow,
	TextInput,
	ToggleInput,
} from "@shared/ui/components";
import { useMemo } from "preact/hooks";

interface SiblingDisperseSectionProps {
	settings: TrueRecallSettings;
	save: (patch: Partial<TrueRecallSettings>) => Promise<void>;
	plugin: any;
}

export function SiblingDisperseSection({
	settings,
	save,
	plugin,
}: SiblingDisperseSectionProps) {
	const opConfig = useMemo(
		() => ({
			plugin,
			operationName: "disperse-siblings",
			undoDescription: (n: number) => `Disperse siblings (${n} cards)`,
			successMessage: (n: number) => `Dispersed ${n} cards (Ctrl+Z to undo)`,
			emptyMessage: "No siblings needed dispersing",
			errorPrefix: "Disperse failed",
		}),
		[plugin],
	);

	const { running: dispersing, execute } = useFsrsHelperOp(opConfig);

	return (
		<>
			<SettingRow heading name="Sibling dispersal" />

			<InfoBlock>
				<p>
					Cards from the same source note are "siblings". Spreading them apart
					helps avoid interference during review.
				</p>
			</InfoBlock>

			<SettingRow
				name="Enable sibling dispersal"
				description="Automatically space out cards from the same note"
			>
				<ToggleInput
					value={settings.siblingDisperseEnabled}
					onChange={(v) => save({ siblingDisperseEnabled: v })}
				/>
			</SettingRow>

			<SettingRow
				name="Minimum sibling interval"
				description="Minimum days between siblings from the same source"
			>
				<TextInput
					value={String(settings.siblingMinInterval)}
					onChange={(v) => {
						const num = parseInt(v, 10) || 3;
						void save({ siblingMinInterval: Math.max(1, num) });
					}}
					placeholder="3"
				/>
			</SettingRow>

			<SettingRow
				name="Disperse siblings now"
				description="Spread out siblings that are currently too close"
			>
				<ActionButton
					label={dispersing ? "Dispersing..." : "Disperse now"}
					variant="secondary"
					disabled={dispersing}
					onClick={() =>
						execute(() =>
							plugin.fsrsHelper?.disperseSiblings({ dryRun: false }),
						)
					}
				/>
			</SettingRow>
		</>
	);
}
