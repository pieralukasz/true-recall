import type { ApiContext, ApiRequest, ApiResponseWriter } from "../api.types";
import { sendError, sendOk } from "../api.types";

export function handleGetStatus(
	_req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
): void {
	sendOk(res, {
		running: true,
		dbReady: ctx.plugin.isStoreReady(),
		vault: ctx.plugin.app.vault.getName(),
	});
}

export async function handleGetActiveNote(
	_req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
): Promise<void> {
	const file = ctx.plugin.app.workspace.getActiveFile();
	if (!file || file.extension !== "md") {
		sendError(res, 404, "No active markdown note");
		return;
	}

	const content = await ctx.plugin.app.vault.read(file);

	let sourceUid: string | undefined;
	let cards: Array<{
		id: string;
		question: string;
		answer: string;
		state: number;
		due: string;
		reps: number;
		lapses: number;
	}> = [];

	if (ctx.plugin.isStoreReady()) {
		const frontmatterService =
			ctx.plugin.flashcardManager.getFrontmatterService();
		sourceUid = (await frontmatterService.getSourceNoteUid(file.path)) ?? undefined;

		if (sourceUid) {
			const rawCards =
				ctx.plugin.cardStore.cards.getCardsBySourceUid(sourceUid);
			cards = rawCards.map((c) => ({
				id: c.id,
				question: c.question ?? "",
				answer: c.answer ?? "",
				state: c.state,
				due: c.due,
				reps: c.reps,
				lapses: c.lapses,
			}));
		}
	}

	sendOk(res, {
		path: file.path,
		basename: file.basename,
		content,
		sourceUid,
		cardCount: cards.length,
		cards,
	});
}
