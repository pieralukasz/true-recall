import { useCallback } from "preact/hooks";

import type { SchedulingResult } from "@true-recall/core/metrics/fsrs-tools/scheduler/scheduler.types";
import type { TrueRecallSettings } from "@true-recall/core/types";

import { FSRSHelperCommand } from "@true-recall/obsidian/commands/commands/fsrs-helper.cmd";
import {
	ActionButton,
	Clickable,
	FormCard,
	FormField,
	InfoBlock,
} from "@true-recall/obsidian/components";
import {
	createScheduledBreak,
	runScheduleBreak,
	shouldSaveBreak,
} from "@true-recall/obsidian/features/study/services/schedule-break-flow";
import { t } from "@true-recall/obsidian/i18n";
import { useApp } from "@true-recall/obsidian/preact";
import { notify } from "@true-recall/obsidian/services/notification.service";

import type { FsrsPluginHost } from "../../../types/plugin-host.types";

interface ScheduledBreaksSectionProps {
	settings: TrueRecallSettings;
	save: (patch: Partial<TrueRecallSettings>) => Promise<void>;
	onRefresh: () => void;
	plugin: FsrsPluginHost;
}

export function ScheduledBreaksSection({
	settings,
	save,
	onRefresh,
	plugin,
}: ScheduledBreaksSectionProps) {
	const app = useApp();
	const breaks = settings.scheduledBreaks;

	const applyChanges = useCallback(
		(result: SchedulingResult, description: string) => {
			const cmd = new FSRSHelperCommand(
				description,
				result.changes.map((c) => ({
					cardId: c.cardId,
					originalDue: c.originalDue,
					newDue: c.newDue,
				})),
			);
			void plugin.commandService?.execute(cmd);
		},
		[plugin],
	);

	// Removing a break only forgets it: cards already moved stay where they are
	const handleDeleteBreak = useCallback(
		async (index: number) => {
			await save({
				scheduledBreaks: breaks.filter((_, i) => i !== index),
			});
			onRefresh();
		},
		[breaks, save, onRefresh],
	);

	const handleAddBreak = useCallback(async () => {
		const { promptText } = await import(
			"@true-recall/obsidian/modals/shared/TextInputModal"
		);
		const startDate = await promptText(app, {
			get title() {
				return t("Add scheduled break");
			},
			get label() {
				return t("Start date (YYYY-MM-DD)");
			},
			placeholder: "YYYY-MM-DD",
		});
		if (!startDate) return;

		const endDate = await promptText(app, {
			get title() {
				return t("Add scheduled break");
			},
			get label() {
				return t("End date (YYYY-MM-DD)");
			},
			placeholder: "YYYY-MM-DD",
		});
		if (!endDate) return;

		const start = startDate.trim();
		const end = endDate.trim();
		const outcome = await runScheduleBreak(
			{
				helper: plugin.fsrsHelper,
				confirm: async (options) => {
					const { confirm } = await import(
						"@true-recall/obsidian/modals/shared/ConfirmModal"
					);
					return confirm(app, options);
				},
				applyChanges,
				notify: notify(),
			},
			{
				startDate: start,
				endDate: end,
				emptyMessage:
					"No cards are due during this break, so it was not saved.",
			},
		);
		if (!shouldSaveBreak(outcome.status)) return;

		await save({
			scheduledBreaks: [
				...breaks,
				createScheduledBreak(start, end, crypto.randomUUID()),
			],
		});
		onRefresh();
	}, [app, plugin, applyChanges, breaks, save, onRefresh]);

	return (
		<FormCard title={t("Scheduled breaks")}>
			<InfoBlock>
				<p>
					{t(
						"Schedule breaks (vacations) to redistribute reviews and prevent backlog accumulation.",
					)}
				</p>
			</InfoBlock>

			{breaks.length > 0 && (
				<div class="ep:space-y-2 ep:mb-4">
					{breaks.map((brk, index) => (
						<div
							key={brk.id}
							class="ep:flex ep:items-center ep:justify-between ep:p-2 ep:bg-obs-background-modifier-form ep:rounded-lg"
						>
							<span>
								{brk.startDate} {t("to")}
								{brk.endDate}
							</span>
							<Clickable
								class="ep:text-ui-small"
								stopPropagation={false}
								onClick={() => void handleDeleteBreak(index)}
							>
								{t("Delete")}
							</Clickable>
						</div>
					))}
				</div>
			)}

			<FormField
				name={t("Add scheduled break")}
				description={t("Schedule a break period")}
			>
				<ActionButton
					label={t("Add break...")}
					variant="secondary"
					onClick={() => void handleAddBreak()}
				/>
			</FormField>
		</FormCard>
	);
}
