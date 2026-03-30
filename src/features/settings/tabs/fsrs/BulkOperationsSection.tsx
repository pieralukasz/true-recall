import { useFsrsHelperOp } from "@features/settings/tabs/fsrs/useFsrsHelperOp";
import { notify } from "@shared/services/notification.service";
import type { FsrsPluginHost } from "../../../../shared/types/plugin-host.types";
import {
	ActionButton,
	FormCard,
	FormField,
	TextInput,
} from "@shared/ui/components";
import { confirm } from "@shared/ui/modals";
import { useCallback, useMemo, useState } from "preact/hooks";

interface BulkOperationsSectionProps {
	plugin: FsrsPluginHost;
}

export function BulkOperationsSection({ plugin }: BulkOperationsSectionProps) {
	const [rescheduling, setRescheduling] = useState(false);
	const [postponeDays, setPostponeDays] = useState("7");

	const postponeConfig = useMemo(
		() => ({
			plugin,
			operationName: "shift-due-dates" as const,
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
				const confirmed = await confirm(plugin.app, {
					title: "Reschedule cards",
					message: `This will reschedule ${previewResult.affectedCount} cards. Proceed?`,
					confirmLabel: "Reschedule",
				});
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
								changes: result.changes.map((c) => ({
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
		<FormCard title="Bulk operations">
			<FormField
				name="Reschedule all cards"
				description="Recalculate all intervals with current FSRS weights (preview first)"
			>
				<ActionButton
					label={rescheduling ? "Calculating..." : "Preview reschedule"}
					variant="secondary"
					disabled={rescheduling}
					onClick={() => void handleReschedule()}
				/>
			</FormField>

			<FormField
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
						void executePostpone(() =>
							plugin.fsrsHelper?.shiftDueDates({
								action: "postpone",
								days,
								scope: "due_today",
								dryRun: false,
							}),
						);
					}}
				/>
			</FormField>
		</FormCard>
	);
}
