import { useMemo } from "preact/hooks";

import type { TrueRecallSettings } from "@true-recall/core/types";

import {
	ActionButton,
	FormCard,
	FormField,
	InfoBlock,
	TextInput,
	ToggleInput,
} from "@true-recall/obsidian/components";

import type { FsrsPluginHost } from "../../../types/plugin-host.types";
import { useFsrsHelperOp } from "./useFsrsHelperOp";

interface SiblingDisperseSectionProps {
	settings: TrueRecallSettings;
	save: (patch: Partial<TrueRecallSettings>) => Promise<void>;
	plugin: FsrsPluginHost;
}

export function SiblingDisperseSection({
	settings,
	save,
	plugin,
}: SiblingDisperseSectionProps) {
	const opConfig = useMemo(
		() => ({
			plugin,
			operationName: "disperse-siblings" as const,
			undoDescription: (n: number) => `Disperse siblings (${n} cards)`,
			successMessage: (n: number) => `Dispersed ${n} cards (Ctrl+Z to undo)`,
			emptyMessage: "No siblings needed dispersing",
			errorPrefix: "Disperse failed",
		}),
		[plugin],
	);

	const { running: dispersing, execute } = useFsrsHelperOp(opConfig);

	return (
		<FormCard title="Sibling dispersal">
			<InfoBlock>
				<p>
					Cards from the same source note are "siblings". Spreading them apart
					helps avoid interference during review.
				</p>
			</InfoBlock>

			<FormField
				name="Enable sibling dispersal"
				description="Automatically space out cards from the same note"
			>
				<ToggleInput
					value={settings.siblingDisperseEnabled}
					onChange={(v) => void save({ siblingDisperseEnabled: v })}
				/>
			</FormField>

			<FormField
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
			</FormField>

			<FormField
				name="Disperse siblings now"
				description="Spread out siblings that are currently too close"
			>
				<ActionButton
					label={dispersing ? "Dispersing..." : "Disperse now"}
					variant="secondary"
					disabled={dispersing}
					onClick={() =>
						void execute(() =>
							plugin.fsrsHelper?.disperseSiblings({ dryRun: false }),
						)
					}
				/>
			</FormField>
		</FormCard>
	);
}
