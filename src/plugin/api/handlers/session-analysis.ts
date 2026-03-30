import { formatLocalDate } from "@shared/utils";
import { State } from "ts-fsrs";
import type { ApiContext, ApiRequest, ApiResponseWriter } from "../api.types";
import { sendError, sendOk } from "../api.types";

const STATE_LABELS: Record<number, string> = {
	[State.New]: "New",
	[State.Learning]: "Learning",
	[State.Review]: "Review",
	[State.Relearning]: "Relearning",
};

export function handleGetSessionAnalysis(
	_req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
): void {
	if (!ctx.plugin.isStoreReady()) {
		sendError(res, 503, "Database not ready");
		return;
	}

	const today = formatLocalDate(new Date());
	const dailyStats = ctx.plugin.cardStore.stats.getDailyStats(today);

	if (!dailyStats || dailyStats.reviewsCompleted === 0) {
		sendOk(res, {
			date: today,
			hasData: false,
			message: "No reviews completed today yet.",
		});
		return;
	}

	const reviewedCardIds = dailyStats.reviewedCardIds ?? [];

	const cards = reviewedCardIds
		.map((id) => {
			const card = ctx.plugin.cardStore.cards.get(id);
			if (!card) return null;
			const history = ctx.plugin.cardStore.stats.getCardReviewHistory(id, 5);
			const todayReviews = history.filter((h) => {
				const reviewDate = formatLocalDate(new Date(h.t));
				return reviewDate === today;
			});

			return {
				id: card.id,
				question: card.question ?? "",
				answer: card.answer ?? "",
				cardType: card.cardType ?? "basic",
				state: card.state,
				stateLabel: STATE_LABELS[card.state] ?? "Unknown",
				stability: card.stability,
				difficulty: card.difficulty,
				reps: card.reps,
				lapses: card.lapses,
				sourceUid: card.sourceUid,
				sourceNoteName: card.sourceNoteName ?? "",
				noteTypeName: card.noteTypeName,
				todayRatings: todayReviews.map((r) => r.r),
			};
		})
		.filter(Boolean);

	// Group by source note
	const byNote = new Map<string, { count: number; sourceUid?: string }>();
	for (const card of cards) {
		if (!card) continue;
		const name = card.sourceNoteName || "(orphaned)";
		const existing = byNote.get(name);
		if (existing) {
			existing.count++;
		} else {
			byNote.set(name, { count: 1, sourceUid: card.sourceUid });
		}
	}
	const noteBreakdown = [...byNote.entries()]
		.sort((a, b) => b[1].count - a[1].count)
		.map(([name, info]) => ({
			note: name,
			count: info.count,
			sourceUid: info.sourceUid,
		}));

	// Cards that got "Again" today (struggled)
	const struggled = cards.filter((c) => c?.todayRatings.includes(1));

	sendOk(res, {
		date: today,
		hasData: true,
		summary: {
			reviewsCompleted: dailyStats.reviewsCompleted,
			newCardsStudied: dailyStats.newCardsStudied,
			totalTimeMs: dailyStats.totalTimeMs,
			ratings: {
				again: dailyStats.again,
				hard: dailyStats.hard,
				good: dailyStats.good,
				easy: dailyStats.easy,
			},
			retentionRate:
				dailyStats.reviewsCompleted > 0
					? Math.round(
							((dailyStats.reviewsCompleted - dailyStats.again) /
								dailyStats.reviewsCompleted) *
								100,
						)
					: 0,
		},
		noteBreakdown,
		struggled: struggled.map((c) => ({
			id: c?.id,
			question: c?.question,
			answer: c?.answer,
			sourceNoteName: c?.sourceNoteName,
			lapses: c?.lapses,
			stability: c?.stability,
		})),
		reviewedCards: cards,
	});
}
