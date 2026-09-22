import { useCallback, useMemo, useState } from "preact/hooks";

import {
	ActionButton,
	FormCard,
	FormField,
	TextInput,
} from "@true-recall/obsidian/components";
import { t } from "@true-recall/obsidian/i18n";
import { confirm } from "@true-recall/obsidian/modals/shared";
import { notify } from "@true-recall/obsidian/services/notification.service";

import type { FsrsPluginHost } from "../../../types/plugin-host.types";
import { useFsrsHelperOp } from "./useFsrsHelperOp";

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
			const previewResult = plugin.fsrsHelper?.rescheduleCards({
				scope: "all",
				dryRun: true,
			});
			if (previewResult && previewResult.affectedCount > 0) {
				const confirmed = await confirm(plugin.app, {
					get title() {
						return t("Reschedule cards");
					},
					message: `This will reschedule ${previewResult.affectedCount} cards. Proceed?`,
					confirmLabel: "Reschedule",
				});
				if (confirmed) {
					const result = plugin.fsrsHelper?.rescheduleCards({
						scope: "all",
						dryRun: false,
					});
					if (result && result.affectedCount > 0) {
						const { FSRSHelperCommand } = await import(
							"@true-recall/obsidian/commands/commands/fsrs-helper.cmd"
						);
						const cmd = new FSRSHelperCommand(
							`Reschedule cards (${result.affectedCount} cards)`,
							result.changes.map((c) => ({
								cardId: c.cardId,
								originalDue: c.originalDue,
								newDue: c.newDue,
							})),
						);
						void plugin.commandService?.execute(cmd);
						notify().success(
							`Rescheduled ${result.affectedCount} cards (Ctrl+Z to undo)`,
						);
					}
				}
			} else if (previewResult) {
				notify().info("No cards to reschedule");
			}
		} catch (err) {
			notify().operationFailed("reschedule cards", err);
		} finally {
			setRescheduling(false);
		}
	}, [plugin]);

	return (
		<FormCard title={t("Bulk operations")}>
			<FormField
				name={t("Reschedule all cards")}
				description={t(
					"Recalculate all intervals with current FSRS weights (preview first)",
				)}
			>
				<ActionButton
					label={rescheduling ? t("Calculating...") : t("Preview reschedule")}
					variant="secondary"
					disabled={rescheduling}
					onClick={() => void handleReschedule()}
				/>
			</FormField>

			<FormField
				name={t("Postpone all due cards")}
				description={t("Push all due cards forward by N days")}
			>
				<TextInput
					value={postponeDays}
					onChange={setPostponeDays}
					placeholder="7"
					class="tr-control--compact"
				/>
				<ActionButton
					label={postponing ? t("Postponing...") : t("Postpone")}
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
