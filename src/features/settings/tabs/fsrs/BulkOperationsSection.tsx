import { useFsrsHelperOp } from "@features/settings/tabs/fsrs/useFsrsHelperOp";
import { notify } from "@shared/services/notification.service";
import { ActionButton, SettingRow, TextInput } from "@shared/ui/components";
import { useCallback, useMemo, useState } from "preact/hooks";

interface BulkOperationsSectionProps {
	plugin: any;
}

export function BulkOperationsSection({ plugin }: BulkOperationsSectionProps) {
	const [rescheduling, setRescheduling] = useState(false);
	const [postponeDays, setPostponeDays] = useState("7");

	const postponeConfig = useMemo(
		() => ({
			plugin,
			operationName: "shift-due-dates",
			undoDescription: (n: number) =>
				`Postpone ${n} cards by ${parseInt(postponeDays, 10) || 7} days`,
			successMessage: (n: number) =>
				`Postponed ${n} cards by ${parseInt(postponeDays, 10) || 7} days (Ctrl+Z to undo)`,
			emptyMessage: "No cards to postpone",
			errorPrefix: "Postpone failed",
		}),
		[plugin, postponeDays],
	);

	const { running: postponing, execute: executePostpone } =
		useFsrsHelperOp(postponeConfig);

	const handleReschedule = useCallback(async () => {
		setRescheduling(true);
		try {
			const previewResult = await plugin.fsrsHelper?.rescheduleCards({
				scope: "all",
				dryRun: true,
			});
			if (previewResult && previewResult.affectedCount > 0) {
				// eslint-disable-next-line no-alert
				const confirmed = window.confirm(
					`This will reschedule ${previewResult.affectedCount} cards. Proceed?`,
				);
				if (confirmed) {
					const result = await plugin.fsrsHelper?.rescheduleCards({
						scope: "all",
						dryRun: false,
					});
					if (result && result.affectedCount > 0) {
						plugin.undoService?.push({
							id: crypto.randomUUID(),
							actionType: "fsrs-helper-operation",
							description: `Reschedule cards (${result.affectedCount} cards)`,
							timestamp: Date.now(),
							payload: {
								type: "fsrs-helper-operation",
								operation: "reschedule-cards",
								changes: result.changes.map((c: any) => ({
									cardId: c.cardId,
									originalDue: c.originalDue,
									newDue: c.newDue,
								})),
							},
						});
						notify().success(
							`Rescheduled ${result.affectedCount} cards (Ctrl+Z to undo)`,
						);
					}
				}
			} else if (previewResult) {
				notify().info("No cards to reschedule");
			}
		} catch (err) {
			notify().error(`Reschedule failed: ${String(err)}`);
		} finally {
			setRescheduling(false);
		}
	}, [plugin]);

	return (
		<>
			<SettingRow heading name="Bulk operations" />

			<SettingRow
				name="Reschedule all cards"
				description="Recalculate all intervals with current FSRS weights (preview first)"
			>
				<ActionButton
					label={rescheduling ? "Calculating..." : "Preview reschedule"}
					variant="secondary"
					disabled={rescheduling}
					onClick={handleReschedule}
				/>
			</SettingRow>

			<SettingRow
				name="Postpone all due cards"
				description="Push all due cards forward by N days"
			>
				<TextInput
					value={postponeDays}
					onChange={setPostponeDays}
					placeholder="7"
				/>
				<ActionButton
					label={postponing ? "Postponing..." : "Postpone"}
					variant="secondary"
					disabled={postponing}
					onClick={() => {
						const days = parseInt(postponeDays, 10) || 7;
						return executePostpone(() =>
							plugin.fsrsHelper?.shiftDueDates({
								action: "postpone",
								days,
								scope: "due_today",
								dryRun: false,
							}),
						);
					}}
				/>
			</SettingRow>
		</>
	);
}
