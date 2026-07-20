import { useCallback } from "preact/hooks";
import { State } from "ts-fsrs";

import type { SchedulingResult } from "@true-recall/core/metrics/fsrs-tools/scheduler/scheduler.types";
import type { FSRSCardData } from "@true-recall/core/types";

import { FSRSHelperCommand } from "@true-recall/obsidian/commands/commands/fsrs-helper.cmd";
import { confirm } from "@true-recall/obsidian/modals/shared/ConfirmModal";
import { promptText } from "@true-recall/obsidian/modals/shared/TextInputModal";
import { ProjectForecastModal } from "@true-recall/obsidian/modals/study/ProjectForecastModal";
import { usePlugin } from "@true-recall/obsidian/preact";
import { notify } from "@true-recall/obsidian/services/notification.service";

type ShiftAction = "postpone" | "advance";

const PROJECT_FORECAST_DAYS = 30;

export function useProjectScheduling() {
	const plugin = usePlugin();

	const getProjectCards = useCallback(
		(projectPath: string) => {
			const sourceUids =
				plugin.hierarchyService.getSourceUidsForProject(projectPath);
			const cards: FSRSCardData[] = [];
			for (const uid of sourceUids) {
				cards.push(...plugin.cardStore.cards.getCardsBySourceUid(uid));
			}
			return cards;
		},
		[plugin],
	);

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

	const handleShift = useCallback(
		async (projectPath: string, projectName: string, action: ShiftAction) => {
			const now = new Date();
			// Mirror Anki Helper semantics: postpone targets due review cards,
			// advance targets not-yet-due review cards.
			const cardIds = getProjectCards(projectPath)
				.filter((c) => c.state === State.Review && !c.suspended)
				.filter((c) =>
					action === "postpone"
						? new Date(c.due) <= now
						: new Date(c.due) > now,
				)
				.map((c) => c.id);

			if (cardIds.length === 0) {
				notify().info(
					action === "postpone"
						? "No due review cards in this project."
						: "No undue review cards in this project.",
				);
				return;
			}

			const verb = action === "postpone" ? "Postpone" : "Advance";
			const value = await promptText(plugin.app, {
				title: `${verb} "${projectName}"`,
				label: `${verb} ${cardIds.length} card${cardIds.length === 1 ? "" : "s"} by how many days?`,
				defaultValue: "1",
				confirmLabel: verb,
			});
			if (value === null) return;

			const days = parseInt(value, 10);
			if (!Number.isFinite(days) || days < 1) {
				notify().error("Enter a positive number of days.");
				return;
			}

			try {
				const result = plugin.fsrsHelper?.shiftDueDates({
					action,
					days,
					scope: "selected",
					cardIds,
					dryRun: false,
				});
				if (result && result.affectedCount > 0) {
					applyChanges(
						result,
						`${verb} ${result.affectedCount} cards in "${projectName}" by ${days} days`,
					);
					notify().success(
						`${verb}d ${result.affectedCount} cards by ${days} days (Ctrl+Z to undo)`,
					);
				} else {
					notify().info(`No cards to ${action}.`);
				}
			} catch (err) {
				notify().error(`${verb} failed: ${String(err)}`);
			}
		},
		[plugin, getProjectCards, applyChanges],
	);

	const handlePostpone = useCallback(
		(projectPath: string, projectName: string) =>
			handleShift(projectPath, projectName, "postpone"),
		[handleShift],
	);

	const handleAdvance = useCallback(
		(projectPath: string, projectName: string) =>
			handleShift(projectPath, projectName, "advance"),
		[handleShift],
	);

	const rescheduleCards = useCallback(
		async (cardIds: string[], projectName: string) => {
			if (cardIds.length === 0) {
				notify().info("No reviewed cards in this project.");
				return;
			}

			try {
				const preview = plugin.fsrsHelper?.rescheduleCards({
					scope: "selected",
					cardIds,
					dryRun: true,
				});
				if (!preview || preview.affectedCount === 0) {
					notify().info("No cards to reschedule.");
					return;
				}

				const confirmed = await confirm(plugin.app, {
					title: "Reschedule project",
					message: `Recalculate intervals for ${preview.affectedCount} cards in "${projectName}" with current FSRS parameters?`,
					confirmLabel: "Reschedule",
				});
				if (!confirmed) return;

				const result = plugin.fsrsHelper?.rescheduleCards({
					scope: "selected",
					cardIds,
					dryRun: false,
				});
				if (result && result.affectedCount > 0) {
					applyChanges(
						result,
						`Reschedule ${result.affectedCount} cards in "${projectName}"`,
					);
					notify().success(
						`Rescheduled ${result.affectedCount} cards (Ctrl+Z to undo)`,
					);
				} else {
					notify().info("No cards needed rescheduling.");
				}
			} catch (err) {
				notify().error(`Reschedule failed: ${String(err)}`);
			}
		},
		[plugin, applyChanges],
	);

	const handleReschedule = useCallback(
		(projectPath: string, projectName: string) => {
			const cardIds = getProjectCards(projectPath)
				.filter((c) => c.state !== State.New && !c.suspended)
				.map((c) => c.id);
			return rescheduleCards(cardIds, projectName);
		},
		[getProjectCards, rescheduleCards],
	);

	const handleRescheduleRecent = useCallback(
		(projectPath: string, projectName: string) => {
			const cutoff = new Date();
			cutoff.setDate(cutoff.getDate() - 7);
			const cardIds = getProjectCards(projectPath)
				.filter(
					(c) =>
						c.state !== State.New &&
						!c.suspended &&
						c.lastReview !== null &&
						new Date(c.lastReview) >= cutoff,
				)
				.map((c) => c.id);
			return rescheduleCards(cardIds, projectName);
		},
		[getProjectCards, rescheduleCards],
	);

	const handleScheduleBreak = useCallback(
		async (projectPath: string, projectName: string) => {
			const cardIds = getProjectCards(projectPath)
				.filter((c) => c.state !== State.New && !c.suspended)
				.map((c) => c.id);
			if (cardIds.length === 0) {
				notify().info("No reviewed cards in this project.");
				return;
			}

			const startDate = await promptText(plugin.app, {
				title: `Schedule a break — "${projectName}"`,
				label: "Break start date (YYYY-MM-DD)",
				placeholder: "YYYY-MM-DD",
			});
			if (!startDate) return;
			const endDate = await promptText(plugin.app, {
				title: `Schedule a break — "${projectName}"`,
				label: "Break end date (YYYY-MM-DD)",
				placeholder: "YYYY-MM-DD",
			});
			if (!endDate) return;

			const datePattern = /^\d{4}-\d{2}-\d{2}$/;
			if (
				!datePattern.test(startDate) ||
				!datePattern.test(endDate) ||
				endDate < startDate
			) {
				notify().error("Enter valid YYYY-MM-DD dates (end not before start).");
				return;
			}

			try {
				const preview = plugin.fsrsHelper?.previewBreak(
					startDate,
					endDate,
					cardIds,
				);
				if (!preview || preview.cardsAffected === 0) {
					notify().info("No cards due during this break.");
					return;
				}

				const confirmed = await confirm(plugin.app, {
					title: "Schedule a break",
					message: `Redistribute ${preview.cardsAffected} cards in "${projectName}" due during ${startDate} – ${endDate} (${preview.breakDays} days)?`,
					confirmLabel: "Schedule break",
				});
				if (!confirmed) return;

				const result = plugin.fsrsHelper?.scheduleBreakPeriod({
					startDate,
					endDate,
					cardIds,
					dryRun: false,
				});
				if (result && result.affectedCount > 0) {
					applyChanges(
						result,
						`Schedule break in "${projectName}" (${result.affectedCount} cards)`,
					);
					notify().success(
						`Redistributed ${result.affectedCount} cards around the break (Ctrl+Z to undo)`,
					);
				} else {
					notify().info("No cards needed redistribution.");
				}
			} catch (err) {
				notify().error(`Schedule break failed: ${String(err)}`);
			}
		},
		[plugin, getProjectCards, applyChanges],
	);

	const handleBalance = useCallback(
		async (projectPath: string, projectName: string) => {
			const cardIds = getProjectCards(projectPath)
				.filter((c) => c.state !== State.New && !c.suspended)
				.map((c) => c.id);
			if (cardIds.length === 0) {
				notify().info("No reviewed cards in this project.");
				return;
			}

			try {
				const preview = plugin.fsrsHelper?.balanceWorkload({
					cardIds,
					dryRun: true,
				});
				if (!preview || preview.affectedCount === 0) {
					notify().info("This project is already balanced.");
					return;
				}

				const confirmed = await confirm(plugin.app, {
					title: "Balance project",
					message: `Move ${preview.affectedCount} cards in "${projectName}" to less loaded days? Cards from other projects stay untouched.`,
					confirmLabel: "Balance",
				});
				if (!confirmed) return;

				const result = plugin.fsrsHelper?.balanceWorkload({
					cardIds,
					dryRun: false,
				});
				if (result && result.affectedCount > 0) {
					applyChanges(
						result,
						`Balance "${projectName}" (${result.affectedCount} cards)`,
					);
					notify().success(
						`Balanced ${result.affectedCount} cards (Ctrl+Z to undo)`,
					);
				} else {
					notify().info("No cards needed balancing.");
				}
			} catch (err) {
				notify().error(`Balance failed: ${String(err)}`);
			}
		},
		[plugin, getProjectCards, applyChanges],
	);

	const handleForecast = useCallback(
		async (projectPath: string, projectName: string) => {
			const helper = plugin.fsrsHelper;
			if (!helper) return;

			const include: ReadonlySet<string> =
				plugin.hierarchyService.getSourceUidsForProject(projectPath);
			if (include.size === 0) {
				notify().info("No notes in this project.");
				return;
			}

			const forecast = helper.getWorkloadForecast(
				PROJECT_FORECAST_DAYS,
				undefined,
				include,
			);
			const total = forecast.reduce((sum, entry) => sum + entry.dueCount, 0);
			if (total === 0) {
				notify().info("No reviews scheduled in this project's next 30 days.");
				return;
			}

			// The reference target is the project's own average, so the summary
			// describes how even this project is — not its share of the global goal
			const projectTarget = Math.max(
				1,
				Math.round(total / Math.max(1, forecast.length)),
			);
			const summary = helper.getWorkloadForecastSummary(
				PROJECT_FORECAST_DAYS,
				undefined,
				include,
				projectTarget,
			);
			const dayOfWeek = helper.getWorkloadByDayOfWeek(
				PROJECT_FORECAST_DAYS,
				undefined,
				include,
			);

			const movableIds = getProjectCards(projectPath)
				.filter((c) => c.state !== State.New && !c.suspended)
				.map((c) => c.id);
			const dryRun =
				movableIds.length > 0
					? helper.balanceWorkload({ cardIds: movableIds, dryRun: true })
					: null;
			const canBalance = (dryRun?.affectedCount ?? 0) > 0;

			const modal = new ProjectForecastModal(plugin.app, projectName, {
				forecast,
				summary: { ...summary, needsBalancing: canBalance },
				dayOfWeek,
				canBalance,
			});
			const action = await modal.openAndWait();
			if (action === "balance") {
				await handleBalance(projectPath, projectName);
			}
		},
		[plugin, getProjectCards, handleBalance],
	);

	const handleFlatten = useCallback(
		async (projectPath: string, projectName: string) => {
			const cardIds = getProjectCards(projectPath)
				.filter((c) => c.state !== State.New && !c.suspended)
				.map((c) => c.id);
			if (cardIds.length === 0) {
				notify().info("No reviewed cards in this project.");
				return;
			}

			const value = await promptText(plugin.app, {
				title: `Flatten "${projectName}"`,
				label: "Maximum reviews per day",
				defaultValue: "50",
				confirmLabel: "Preview",
			});
			if (value === null) return;
			const maxCards = parseInt(value, 10);
			if (!Number.isFinite(maxCards) || maxCards < 1) {
				notify().error("Enter a positive number of cards per day.");
				return;
			}

			try {
				const preview = plugin.fsrsHelper?.flattenFutureDueCards({
					maxCards,
					cardIds,
					dryRun: true,
				});
				if (!preview || preview.affectedCount === 0) {
					notify().info(`No days exceed ${maxCards} reviews in this project.`);
					return;
				}

				const confirmed = await confirm(plugin.app, {
					title: "Flatten future due cards",
					message: `Postpone ${preview.affectedCount} cards in "${projectName}" so no future day exceeds ${maxCards} reviews?`,
					confirmLabel: "Flatten",
				});
				if (!confirmed) return;

				const result = plugin.fsrsHelper?.flattenFutureDueCards({
					maxCards,
					cardIds,
					dryRun: false,
				});
				if (result && result.affectedCount > 0) {
					applyChanges(
						result,
						`Flatten "${projectName}" to ${maxCards} reviews/day (${result.affectedCount} cards)`,
					);
					notify().success(
						`Flattened: moved ${result.affectedCount} cards (Ctrl+Z to undo)`,
					);
				} else {
					notify().info("No cards needed moving.");
				}
			} catch (err) {
				notify().error(`Flatten failed: ${String(err)}`);
			}
		},
		[plugin, getProjectCards, applyChanges],
	);

	return {
		handlePostpone,
		handleAdvance,
		handleReschedule,
		handleRescheduleRecent,
		handleScheduleBreak,
		handleFlatten,
		handleBalance,
		handleForecast,
	};
}
