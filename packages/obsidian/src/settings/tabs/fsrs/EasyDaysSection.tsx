import type { TrueRecallSettings } from "@true-recall/core/types";
import {
	ActionButton,
	FormCard,
	FormField,
	InfoBlock,
} from "@true-recall/obsidian/components";
import { EasyDaysModal } from "@true-recall/obsidian/features/metrics/modals/EasyDaysModal";
import { notify } from "@true-recall/obsidian/services/notification.service";
import type { App } from "obsidian";
import { useCallback } from "preact/hooks";
import type { FsrsPluginHost } from "../../../types/plugin-host.types";

interface EasyDaysSectionProps {
	plugin: FsrsPluginHost;
	settings: TrueRecallSettings;
	save: (patch: Partial<TrueRecallSettings>) => Promise<void>;
	app: App;
	onRefresh: () => void;
}

export function EasyDaysSection({
	plugin,
	settings,
	save,
	app,
	onRefresh,
}: EasyDaysSectionProps) {
	const easyDays = settings.easyDays;
	const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
	const recurringDaysText =
		easyDays.recurringDays.length > 0
			? easyDays.recurringDays.map((d: number) => dayNames[d]).join(", ")
			: "None";
	const specificDatesCount = easyDays.specificDates.length;

	const pushUndo = useCallback(
		async (
			affectedCount: number,
			changes: Array<{ cardId: string; originalDue: string; newDue: string }>,
		) => {
			const { FSRSHelperCommand } = await import(
				"@true-recall/obsidian/commands/commands/fsrs-helper.cmd"
			);
			const cmd = new FSRSHelperCommand(
				`Apply easy days (${affectedCount} cards)`,
				changes.map((c) => ({
					cardId: c.cardId,
					originalDue: c.originalDue,
					newDue: c.newDue,
				})),
			);
			void plugin.commandService?.execute(cmd);
		},
		[plugin],
	);

	const handleConfigure = useCallback(async () => {
		const modal = new EasyDaysModal(app, {
			easyDays: settings.easyDays,
			multiplier: settings.easyDaysMultiplier,
		});
		const result = await modal.openAndWait();
		if (!result.cancelled && result.easyDays) {
			await save({
				easyDays: result.easyDays,
				...(result.multiplier !== undefined && {
					easyDaysMultiplier: result.multiplier,
				}),
			});

			if (result.applyNow) {
				const applyResult = plugin.fsrsHelper?.applyEasyDays({
					dryRun: false,
				});
				if (applyResult && applyResult.affectedCount > 0) {
					pushUndo(applyResult.affectedCount, applyResult.changes);
					notify().success(
						`Applied easy days: ${applyResult.affectedCount} cards moved (Ctrl+Z to undo)`,
					);
				} else if (applyResult) {
					notify().info("No cards needed to be moved");
				}
			}
			onRefresh();
		}
	}, [app, settings, save, plugin, pushUndo, onRefresh]);

	const handleApplyNow = useCallback(async () => {
		const applyResult = await plugin.fsrsHelper?.applyEasyDays({
			dryRun: false,
		});
		if (applyResult && applyResult.affectedCount > 0) {
			pushUndo(applyResult.affectedCount, applyResult.changes);
			notify().success(
				`Applied easy days: ${applyResult.affectedCount} cards moved (Ctrl+Z to undo)`,
			);
		} else if (applyResult) {
			notify().info("No cards needed to be moved");
		}
	}, [plugin, pushUndo]);

	return (
		<FormCard title="Easy days">
			<InfoBlock>
				<p>
					Reduce your review workload on specific days (recurring weekdays or
					specific dates). Cards due on easy days will be moved to adjacent
					days.
				</p>
			</InfoBlock>

			<FormField
				name="Easy days"
				description={`Recurring: ${recurringDaysText} | Specific dates: ${specificDatesCount} | Workload: ${Math.round(settings.easyDaysMultiplier * 100)}%`}
			>
				<ActionButton
					label="Configure..."
					variant="secondary"
					onClick={() => void handleConfigure()}
				/>
				<ActionButton
					label="Apply now"
					variant="secondary"
					onClick={() => void handleApplyNow()}
				/>
			</FormField>
		</FormCard>
	);
}
