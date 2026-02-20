import { useCallback } from "preact/hooks";
import { notify } from "../../../../shared/services/notification.service";
import type { TrueRecallSettings } from "../../../../shared/types";
import { EasyDaysModal } from "../../../../features/metrics/modals/EasyDaysModal";
import { ActionButton, InfoBlock, SettingRow } from "../../../../shared/ui/components";
import type { App } from "obsidian";

interface EasyDaysSectionProps {
	plugin: any;
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
		(affectedCount: number, changes: any[]) => {
			plugin.undoService?.push({
				id: crypto.randomUUID(),
				actionType: "fsrs-helper-operation",
				description: `Apply easy days (${affectedCount} cards)`,
				timestamp: Date.now(),
				payload: {
					type: "fsrs-helper-operation",
					operation: "apply-easy-days",
					changes: changes.map((c: any) => ({
						cardId: c.cardId,
						originalDue: c.originalDue,
						newDue: c.newDue,
					})),
				},
			});
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
		<>
			<SettingRow heading name="Easy days" />

			<InfoBlock>
				<p>
					Reduce your review workload on specific days (recurring weekdays or
					specific dates). Cards due on easy days will be moved to adjacent
					days.
				</p>
			</InfoBlock>

			<SettingRow
				name="Easy days"
				description={`Recurring: ${recurringDaysText} | Specific dates: ${specificDatesCount} | Workload: ${Math.round(settings.easyDaysMultiplier * 100)}%`}
			>
				<ActionButton
					label="Configure..."
					variant="secondary"
					onClick={handleConfigure}
				/>
				<ActionButton
					label="Apply now"
					variant="secondary"
					onClick={handleApplyNow}
				/>
			</SettingRow>
		</>
	);
}
