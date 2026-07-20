import { State } from "ts-fsrs";

import { G } from "@true-recall/obsidian/data";

import type { ApiContext, ApiRequest, ApiResponseWriter } from "../api.types";
import { parseJsonBody, readBody, sendError, sendOk } from "../api.types";

function nameFromPath(path: string): string {
	return path.split("/").pop()?.replace(/\.md$/, "") ?? path;
}

export async function handleAddFlashcardUid(
	_req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
): Promise<void> {
	const file = ctx.plugin.app.workspace.getActiveFile();
	if (!file || file.extension !== "md") {
		sendError(res, 404, "No active markdown note");
		return;
	}

	const frontmatterService =
		ctx.plugin.flashcardManager.getFrontmatterService();

	const existingUid = await frontmatterService.getSourceNoteUid(file.path);
	if (existingUid) {
		sendOk(res, { uid: existingUid, alreadyExisted: true, path: file.path });
		return;
	}

	const newUid = frontmatterService.generateUid();
	await frontmatterService.setSourceNoteUid(file.path, newUid);
	sendOk(res, { uid: newUid, alreadyExisted: false, path: file.path });
}

export async function handleSetPresetForNote(
	req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
): Promise<void> {
	const raw = await readBody(req);
	const body = parseJsonBody<{
		path?: string;
		preset_name: string | null;
	}>(raw);
	if (body === null || !("preset_name" in body)) {
		sendError(
			res,
			400,
			"Body must contain { preset_name: string | null, path?: string }",
		);
		return;
	}

	let filePath = body.path;
	if (!filePath) {
		const file = ctx.plugin.app.workspace.getActiveFile();
		if (!file || file.extension !== "md") {
			sendError(res, 404, "No active markdown note and no path provided");
			return;
		}
		filePath = file.path;
	}

	const abstractFile = ctx.plugin.app.vault.getAbstractFileByPath(filePath);
	if (!abstractFile || !("extension" in abstractFile)) {
		sendError(res, 404, `File not found: ${filePath}`);
		return;
	}

	if (body.preset_name !== null) {
		const preset = ctx.plugin.presetService.getPresetByName(body.preset_name);
		if (!preset) {
			sendError(res, 404, `Preset "${body.preset_name}" not found`);
			return;
		}
	}

	const frontmatterService =
		ctx.plugin.flashcardManager.getFrontmatterService();
	await frontmatterService.setFsrsPreset(abstractFile.path, body.preset_name);

	sendOk(res, {
		path: filePath,
		presetName: body.preset_name,
		action: body.preset_name ? "set" : "removed",
	});
}

export async function handleSetParent(
	req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
): Promise<void> {
	const raw = await readBody(req);
	const body = parseJsonBody<{
		path?: string;
		parent_name: string;
		action: "add" | "remove";
	}>(raw);
	if (
		!body?.parent_name ||
		(body.action !== "add" && body.action !== "remove")
	) {
		sendError(
			res,
			400,
			"Body must contain { parent_name: string, action: 'add' | 'remove', path?: string }",
		);
		return;
	}

	let filePath = body.path;
	if (!filePath) {
		const file = ctx.plugin.app.workspace.getActiveFile();
		if (!file || file.extension !== "md") {
			sendError(res, 404, "No active markdown note and no path provided");
			return;
		}
		filePath = file.path;
	}

	const abstractFile = ctx.plugin.app.vault.getAbstractFileByPath(filePath);
	if (!abstractFile || !("extension" in abstractFile)) {
		sendError(res, 404, `File not found: ${filePath}`);
		return;
	}

	const frontmatterService =
		ctx.plugin.flashcardManager.getFrontmatterService();
	const tFile = abstractFile as import("obsidian").TFile;

	if (body.action === "add") {
		await frontmatterService.addParent(tFile.path, body.parent_name);
	} else {
		await frontmatterService.removeParent(tFile.path, body.parent_name);
	}

	sendOk(res, {
		path: filePath,
		parentName: body.parent_name,
		action: body.action,
	});
}

export async function handleSetArchive(
	req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
): Promise<void> {
	const raw = await readBody(req);
	const body = parseJsonBody<{ path?: string; archived: boolean }>(raw);
	if (!body || typeof body.archived !== "boolean") {
		sendError(
			res,
			400,
			"Body must contain { archived: boolean, path?: string }",
		);
		return;
	}

	let filePath = body.path;
	if (!filePath) {
		const file = ctx.plugin.app.workspace.getActiveFile();
		if (!file || file.extension !== "md") {
			sendError(res, 404, "No active markdown note and no path provided");
			return;
		}
		filePath = file.path;
	}

	const abstractFile = ctx.plugin.app.vault.getAbstractFileByPath(filePath);
	if (!abstractFile || !("extension" in abstractFile)) {
		sendError(res, 404, `File not found: ${filePath}`);
		return;
	}

	const frontmatterService =
		ctx.plugin.flashcardManager.getFrontmatterService();
	await frontmatterService.setArchive(abstractFile.path, body.archived);

	sendOk(res, { path: filePath, archived: body.archived });
}

export async function handleDissolveProject(
	req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
): Promise<void> {
	const raw = await readBody(req);
	const body = parseJsonBody<{ path?: string }>(raw);
	if (!body?.path) {
		sendError(res, 400, "Body must contain { path: string }");
		return;
	}

	const childPaths = ctx.plugin.hierarchyService.getChildPaths(body.path);
	if (childPaths.length === 0) {
		sendError(res, 404, `No children found for project: ${body.path}`);
		return;
	}

	const parentName = nameFromPath(body.path);
	const frontmatterService =
		ctx.plugin.flashcardManager.getFrontmatterService();
	const count = await frontmatterService.dissolveProject(
		childPaths,
		parentName,
	);

	ctx.plugin.hierarchyService.invalidateGraph();
	ctx.plugin.dataLayer?.invalidateGroups([
		G.CARDS,
		G.BROWSER,
		G.DASHBOARD,
		G.PANEL,
		G.REVIEW,
	]);

	sendOk(res, { path: body.path, dissolved: count });
}

export async function handleToggleNoteReview(
	req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
): Promise<void> {
	const raw = await readBody(req);
	const body = parseJsonBody<{ path?: string }>(raw);

	const file = body?.path
		? ctx.plugin.app.vault.getFileByPath(body.path)
		: ctx.plugin.app.workspace.getActiveFile();

	if (!file || file.extension !== "md") {
		sendError(res, 404, "No markdown note found");
		return;
	}

	const frontmatterService =
		ctx.plugin.flashcardManager.getFrontmatterService();
	let sourceUid = await frontmatterService.getSourceNoteUid(file.path);

	if (!sourceUid) {
		sourceUid = frontmatterService.generateUid();
		await frontmatterService.setSourceNoteUid(file.path, sourceUid);
	}

	const wasEnabled = ctx.plugin.flashcardManager.hasNoteReview(sourceUid);
	if (wasEnabled) {
		ctx.plugin.flashcardManager.disableNoteReview(sourceUid);
	} else {
		ctx.plugin.flashcardManager.enableNoteReview(sourceUid);
	}

	ctx.plugin.dataLayer?.invalidateGroups([
		G.CARDS,
		G.BROWSER,
		G.DASHBOARD,
		G.PANEL,
		G.REVIEW,
	]);

	sendOk(res, {
		path: file.path,
		noteReview: !wasEnabled,
	});
}

export async function handleNoteReviewStatus(
	req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
): Promise<void> {
	const raw = await readBody(req);
	const body = parseJsonBody<{ path?: string }>(raw);

	const file = body?.path
		? ctx.plugin.app.vault.getFileByPath(body.path)
		: ctx.plugin.app.workspace.getActiveFile();

	if (!file || file.extension !== "md") {
		sendError(res, 404, "No markdown note found");
		return;
	}

	const frontmatterService =
		ctx.plugin.flashcardManager.getFrontmatterService();
	const sourceUid = await frontmatterService.getSourceNoteUid(file.path);

	if (!sourceUid) {
		sendOk(res, { path: file.path, noteReview: false });
		return;
	}

	const isEnabled = ctx.plugin.flashcardManager.hasNoteReview(sourceUid);
	sendOk(res, { path: file.path, noteReview: isEnabled, sourceUid });
}

export async function handleMoveChildren(
	req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
): Promise<void> {
	const raw = await readBody(req);
	const body = parseJsonBody<{
		path?: string;
		target_parent_name: string;
	}>(raw);
	if (!body?.path || !body.target_parent_name) {
		sendError(
			res,
			400,
			"Body must contain { path: string, target_parent_name: string }",
		);
		return;
	}

	const childPaths = ctx.plugin.hierarchyService.getChildPaths(body.path);
	if (childPaths.length === 0) {
		sendError(res, 404, `No children found for project: ${body.path}`);
		return;
	}

	const fromName = nameFromPath(body.path);
	const frontmatterService =
		ctx.plugin.flashcardManager.getFrontmatterService();
	const count = await frontmatterService.moveChildren(
		childPaths,
		fromName,
		body.target_parent_name,
	);

	ctx.plugin.hierarchyService.invalidateGraph();
	ctx.plugin.dataLayer?.invalidateGroups([
		G.CARDS,
		G.BROWSER,
		G.DASHBOARD,
		G.PANEL,
		G.REVIEW,
	]);

	sendOk(res, {
		path: body.path,
		targetParent: body.target_parent_name,
		moved: count,
	});
}

// ── Note stats & cards ──────────────────────────────────────────

interface ResolvedNote {
	sourceUid: string;
	noteName: string;
	notePath: string;
}

async function resolveSourceUid(
	req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
): Promise<ResolvedNote | null> {
	const url = new URL(req.url ?? "/", "http://localhost");
	const sourceUidParam = url.searchParams.get("source_uid");
	const pathParam = url.searchParams.get("path");

	const frontmatterService =
		ctx.plugin.flashcardManager.getFrontmatterService();

	let sourceUid: string | null = null;
	let notePath: string | null = null;

	if (sourceUidParam) {
		sourceUid = sourceUidParam;
		notePath =
			ctx.plugin.frontmatterIndex.getFileByValue(
				"flashcard_uid",
				sourceUidParam,
			) ?? null;
	} else if (pathParam) {
		const abstractFile = ctx.plugin.app.vault.getAbstractFileByPath(pathParam);
		if (!abstractFile || !("extension" in abstractFile)) {
			sendError(res, 404, `File not found: ${pathParam}`);
			return null;
		}
		notePath = pathParam;
		sourceUid = await frontmatterService.getSourceNoteUid(pathParam);
	} else {
		const file = ctx.plugin.app.workspace.getActiveFile();
		if (!file || file.extension !== "md") {
			sendError(
				res,
				404,
				"No active markdown note and no path or source_uid provided",
			);
			return null;
		}
		notePath = file.path;
		sourceUid = await frontmatterService.getSourceNoteUid(file.path);
	}

	if (!sourceUid) {
		sendError(res, 404, "Note has no flashcard_uid in frontmatter");
		return null;
	}

	return {
		sourceUid,
		noteName: notePath ? nameFromPath(notePath) : sourceUid,
		notePath: notePath ?? "",
	};
}

export async function handleNoteStats(
	req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
): Promise<void> {
	if (!ctx.plugin.isStoreReady()) {
		sendError(res, 503, "Database not ready");
		return;
	}

	const resolved = await resolveSourceUid(req, res, ctx);
	if (!resolved) return;

	const cards = ctx.plugin.cardStore.cards.getCardsBySourceUid(
		resolved.sourceUid,
	);

	const now = new Date();
	let newCount = 0;
	let learning = 0;
	let review = 0;
	let relearning = 0;
	let suspended = 0;
	let buried = 0;

	for (const card of cards) {
		if (card.suspended) {
			suspended++;
			continue;
		}
		if (card.buriedUntil && new Date(card.buriedUntil) > now) {
			buried++;
			continue;
		}
		switch (card.state) {
			case State.New:
				newCount++;
				break;
			case State.Learning:
				learning++;
				break;
			case State.Review:
				review++;
				break;
			case State.Relearning:
				relearning++;
				break;
		}
	}

	sendOk(res, {
		sourceUid: resolved.sourceUid,
		noteName: resolved.noteName,
		notePath: resolved.notePath,
		counts: {
			new: newCount,
			learning,
			review,
			relearning,
			suspended,
			buried,
			total: cards.length,
		},
	});
}

export async function handleNoteCards(
	req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
): Promise<void> {
	if (!ctx.plugin.isStoreReady()) {
		sendError(res, 503, "Database not ready");
		return;
	}

	const resolved = await resolveSourceUid(req, res, ctx);
	if (!resolved) return;

	const url = new URL(req.url ?? "/", "http://localhost");
	const stateParam = url.searchParams.get("state");
	const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 200);

	let allCards = ctx.plugin.cardStore.cards.getCardsBySourceUid(
		resolved.sourceUid,
	);

	if (stateParam !== null) {
		const stateMap: Record<string, State> = {
			new: State.New,
			learning: State.Learning,
			review: State.Review,
			relearning: State.Relearning,
		};
		const stateValue = stateMap[stateParam];
		if (stateValue !== undefined) {
			allCards = allCards.filter((c) => c.state === stateValue);
		}
	}

	const total = allCards.length;
	const cards = allCards.slice(0, limit).map((c) => ({
		id: c.id,
		question: c.question ?? "",
		answer: c.answer ?? "",
		state: c.state,
		due: c.due,
		stability: c.stability,
		difficulty: c.difficulty,
		reps: c.reps,
		lapses: c.lapses,
		suspended: c.suspended ?? false,
		cardType: c.cardType ?? "basic",
	}));

	sendOk(res, {
		sourceUid: resolved.sourceUid,
		noteName: resolved.noteName,
		notePath: resolved.notePath,
		total,
		count: cards.length,
		cards,
	});
}
