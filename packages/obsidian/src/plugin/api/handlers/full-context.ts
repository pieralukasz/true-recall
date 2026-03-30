import {
	VIEW_TYPE_CARD_BROWSER,
	VIEW_TYPE_DASHBOARD,
	VIEW_TYPE_FLASHCARD_PANEL,
	VIEW_TYPE_REVIEW,
	VIEW_TYPE_SIMULATOR,
	VIEW_TYPE_STATS,
} from "@shared/constants";
import { State } from "ts-fsrs";
import type { ApiContext, ApiRequest, ApiResponseWriter } from "../api.types";
import { sendOk } from "../api.types";

const STATE_LABELS: Record<number, string> = {
	[State.New]: "New",
	[State.Learning]: "Learning",
	[State.Review]: "Review",
	[State.Relearning]: "Relearning",
};

const VIEW_LABELS: Record<string, string> = {
	[VIEW_TYPE_REVIEW]: "review",
	[VIEW_TYPE_FLASHCARD_PANEL]: "flashcard-panel",
	[VIEW_TYPE_CARD_BROWSER]: "card-browser",
	[VIEW_TYPE_DASHBOARD]: "dashboard",
	[VIEW_TYPE_STATS]: "statistics",
	[VIEW_TYPE_SIMULATOR]: "simulator",
	markdown: "note-editor",
	empty: "empty",
};

export async function handleGetFullContext(
	_req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
): Promise<void> {
	const result: Record<string, unknown> = {
		vault: ctx.plugin.app.vault.getName(),
		dbReady: ctx.plugin.isStoreReady(),
	};

	// Active view
	const activeFile = ctx.plugin.app.workspace.getActiveFile();
	const activeLf = ctx.plugin.app.workspace.getMostRecentLeaf();
	const viewType = activeLf?.view?.getViewType() ?? "unknown";
	result.activeView = VIEW_LABELS[viewType] ?? viewType;

	// Active note
	const file = ctx.plugin.app.workspace.getActiveFile();
	if (file && file.extension === "md") {
		const noteInfo: Record<string, unknown> = {
			path: file.path,
			basename: file.basename,
		};

		if (ctx.plugin.isStoreReady()) {
			const frontmatterService =
				ctx.plugin.flashcardManager.getFrontmatterService();
			const sourceUid =
				(await frontmatterService.getSourceNoteUid(file.path)) ?? undefined;

			if (sourceUid) {
				const cards = ctx.plugin.cardStore.cards.getCardsBySourceUid(sourceUid);
				noteInfo.sourceUid = sourceUid;
				noteInfo.cardCount = cards.length;
				noteInfo.cardStates = {
					new: cards.filter((c) => c.state === State.New).length,
					learning: cards.filter(
						(c) => c.state === State.Learning || c.state === State.Relearning,
					).length,
					review: cards.filter((c) => c.state === State.Review).length,
				};
			} else {
				noteInfo.cardCount = 0;
			}
		}

		result.activeNote = noteInfo;
	} else {
		result.activeNote = null;
	}

	// Review session
	if (ctx.plugin.store) {
		const review = ctx.plugin.store.getState().review;
		const phase = review.getPhase();

		if (phase.type === "idle") {
			result.reviewSession = { active: false, phase: "idle" };
		} else if (phase.type === "complete") {
			result.reviewSession = {
				active: false,
				phase: "complete",
				stats: review.getStats(),
			};
		} else if (phase.type === "waiting") {
			result.reviewSession = {
				active: true,
				phase: "waiting",
				timeUntilDue: phase.timeUntilDue,
				progress: review.getProgress(),
				badgeCounts: review.getBadgeCounts(),
			};
		} else {
			const card = phase.card;
			result.reviewSession = {
				active: true,
				phase: "active",
				currentCard: {
					id: card.id,
					question: card.question,
					answer: card.answer,
					cardType: card.cardType ?? "basic",
					state: card.fsrs.state,
					stateLabel: STATE_LABELS[card.fsrs.state] ?? "Unknown",
					sourceNoteName: card.sourceNoteName ?? "",
					sourceUid: card.sourceUid ?? "",
				},
				isAnswerRevealed: review.isAnswerShown(),
				progress: review.getProgress(),
				badgeCounts: review.getBadgeCounts(),
			};
		}
	} else {
		result.reviewSession = { active: false, phase: "idle" };
	}

	// Today's study summary (lightweight)
	if (ctx.plugin.isStoreReady()) {
		const { formatLocalDate } = await import("@shared/utils");
		const today = formatLocalDate(new Date());
		const dailyStats = ctx.plugin.cardStore.stats.getDailyStats(today);

		if (dailyStats && dailyStats.reviewsCompleted > 0) {
			result.todayStudy = {
				reviewsCompleted: dailyStats.reviewsCompleted,
				newCardsStudied: dailyStats.newCardsStudied,
				totalTimeMs: dailyStats.totalTimeMs,
				ratings: {
					again: dailyStats.again,
					hard: dailyStats.hard,
					good: dailyStats.good,
					easy: dailyStats.easy,
				},
			};
		} else {
			result.todayStudy = null;
		}

		// Due cards count
		const archivedUids = ctx.plugin.hierarchyService.getArchivedSourceUids();
		let allCards = ctx.plugin.flashcardManager.getAllFSRSCards();
		if (archivedUids.size > 0) {
			allCards = allCards.filter(
				(c) => !c.sourceUid || !archivedUids.has(c.sourceUid),
			);
		}
		const dueCards = ctx.plugin.dayBoundaryService.getDueCards(allCards);
		result.dueCount = dueCards.length;
	}

	sendOk(res, result);
}
