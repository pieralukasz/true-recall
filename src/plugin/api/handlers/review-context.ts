import { TFile } from "obsidian";
import { State } from "ts-fsrs";
import type { ApiContext, ApiRequest, ApiResponseWriter } from "../api.types";
import { sendError, sendOk } from "../api.types";

const STATE_LABELS: Record<number, string> = {
	[State.New]: "New",
	[State.Learning]: "Learning",
	[State.Review]: "Review",
	[State.Relearning]: "Relearning",
};

export async function handleGetReviewContext(
	req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
): Promise<void> {
	if (!ctx.plugin.store) {
		sendError(res, 503, "Store not ready");
		return;
	}

	const review = ctx.plugin.store.getState().review;
	const phase = review.getPhase();

	if (phase.type === "idle") {
		sendOk(res, { active: false, phase: "idle" });
		return;
	}

	if (phase.type === "complete") {
		sendOk(res, {
			active: false,
			phase: "complete",
			stats: review.getStats(),
		});
		return;
	}

	const progress = review.getProgress();
	const badgeCounts = review.getBadgeCounts();
	const stats = review.getStats();
	const isAnswerRevealed = review.isAnswerShown();

	if (phase.type === "waiting") {
		sendOk(res, {
			active: true,
			phase: "waiting",
			timeUntilDue: phase.timeUntilDue,
			progress,
			badgeCounts,
			stats,
			isAnswerRevealed,
		});
		return;
	}

	const card = phase.card;
	const url = new URL(req.url ?? "/", "http://localhost");
	const includeNoteContent =
		url.searchParams.get("include_note_content") === "true";

	const response: Record<string, unknown> = {
		active: true,
		phase: "active",
		card: {
			id: card.id,
			question: card.question,
			answer: card.answer,
			cardType: card.cardType ?? "basic",
			state: card.fsrs.state,
			stateLabel: STATE_LABELS[card.fsrs.state] ?? "Unknown",
			due: card.fsrs.due,
			reps: card.fsrs.reps,
			lapses: card.fsrs.lapses,
			stability: card.fsrs.stability,
			difficulty: card.fsrs.difficulty,
			sourceNoteName: card.sourceNoteName ?? "",
			sourceNotePath: card.sourceNotePath ?? "",
			sourceUid: card.sourceUid ?? "",
			...(card.sourceText && { sourceText: card.sourceText }),
			...(card.noteTypeName && { noteTypeName: card.noteTypeName }),
			...(card.cardType === "cloze" && {
				clozeTemplate: card.clozeTemplate,
				clozeIndex: card.clozeIndex,
			}),
		},
		isAnswerRevealed,
		progress,
		badgeCounts,
		stats: {
			total: stats.total,
			reviewed: stats.reviewed,
			again: stats.again,
			hard: stats.hard,
			good: stats.good,
			easy: stats.easy,
			duration: stats.duration,
		},
	};

	if (includeNoteContent && card.sourceNotePath) {
		const abstractFile = ctx.plugin.app.vault.getAbstractFileByPath(
			card.sourceNotePath,
		);
		if (abstractFile instanceof TFile) {
			try {
				const content = await ctx.plugin.app.vault.read(abstractFile);
				response.sourceNote = {
					path: abstractFile.path,
					basename: abstractFile.basename,
					content,
				};
			} catch {
				// File read failed — omit sourceNote silently
			}
		}
	}

	sendOk(res, response);
}
