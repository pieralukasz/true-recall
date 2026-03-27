import type { IncomingMessage, ServerResponse } from "http";
import type { ApiContext } from "../api.types";
import { parseJsonBody, readBody, sendError, sendOk } from "../api.types";

interface OpenViewInput {
	view: string;
	source_uid?: string;
}

interface OpenNoteInput {
	path: string;
}

export async function handleOpenView(
	req: IncomingMessage,
	res: ServerResponse,
	ctx: ApiContext,
): Promise<void> {
	const raw = await readBody(req);
	const body = parseJsonBody<OpenViewInput>(raw);
	if (!body?.view) {
		sendError(res, 400, "Body must contain { view: string }");
		return;
	}

	switch (body.view) {
		case "dashboard":
			await ctx.plugin.openDashboard();
			sendOk(res, { opened: "dashboard" });
			return;

		case "stats":
			await ctx.plugin.openStats();
			sendOk(res, { opened: "stats" });
			return;

		case "card-browser":
			await ctx.plugin.openCardBrowser(
				body.source_uid ? { sourceUid: body.source_uid } : undefined,
			);
			sendOk(res, { opened: "card-browser", sourceUid: body.source_uid });
			return;

		case "card-browser-orphaned":
			await ctx.plugin.openCardBrowser({ orphaned: true });
			sendOk(res, { opened: "card-browser", orphaned: true });
			return;

		case "flashcard-panel":
			await ctx.plugin.activateView();
			sendOk(res, { opened: "flashcard-panel" });
			return;

		case "simulator":
			await ctx.plugin.openSimulator();
			sendOk(res, { opened: "simulator" });
			return;

		default:
			sendError(
				res,
				400,
				`Unknown view: ${body.view}. Available: dashboard, stats, card-browser, card-browser-orphaned, flashcard-panel, simulator`,
			);
	}
}

export async function handleOpenNote(
	req: IncomingMessage,
	res: ServerResponse,
	ctx: ApiContext,
): Promise<void> {
	const raw = await readBody(req);
	const body = parseJsonBody<OpenNoteInput>(raw);
	if (!body?.path) {
		sendError(res, 400, "Body must contain { path: string }");
		return;
	}

	const file = ctx.plugin.app.vault.getAbstractFileByPath(body.path);
	if (!file) {
		sendError(res, 404, `File not found: ${body.path}`);
		return;
	}

	await ctx.plugin.app.workspace.openLinkText(body.path, "", false);
	sendOk(res, { opened: body.path });
}
