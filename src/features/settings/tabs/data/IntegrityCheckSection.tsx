import { useSettings } from "@features/settings/hooks/useSettings";
import { notify } from "@shared/services/notification.service";
import { ActionButton, FormCard, FormField } from "@shared/ui/components";
import { useCallback, useState } from "preact/hooks";

export function IntegrityCheckSection() {
	const { plugin } = useSettings();
	const [running, setRunning] = useState(false);

	const handleCheck = useCallback(async () => {
		if (!plugin.cardStore) {
			notify().error("Database not initialized");
			return;
		}

		setRunning(true);
		try {
			const report = plugin.cardStore.integrity.check();

			if (report.totalIssues === 0) {
				notify().success("Database integrity OK — no orphaned records found");
				return;
			}

			const confirmed = confirm(
				`Found ${report.totalIssues} orphaned records:\n` +
					`• ${report.orphanedCards.length} cards with missing notes\n` +
					`• ${report.orphanedNotes.length} notes with missing note types\n` +
					`• ${report.orphanedReviewLogs.length} review logs with missing cards\n\n` +
					`Soft-delete these records?`,
			);

			if (!confirmed) return;

			// Safety backup before repair
			try {
				await plugin.backupService?.createBackup();
			} catch {
				console.warn(
					"[True Recall] Pre-repair backup failed, proceeding anyway",
				);
			}

			const fixed = plugin.cardStore.integrity.repair(report);
			notify().success(`Fixed ${fixed} orphaned records`);
		} catch (error) {
			console.error("[True Recall] Integrity check failed:", error);
			notify().error("Integrity check failed");
		} finally {
			setRunning(false);
		}
	}, [plugin]);

	return (
		<FormCard title="Database integrity">
			<FormField
				name="Check integrity"
				description="Detect and repair orphaned cards, notes, and review logs"
			>
				<ActionButton
					label={running ? "Checking..." : "Check now"}
					variant="primary"
					onClick={handleCheck}
					disabled={running}
				/>
			</FormField>
		</FormCard>
	);
}
