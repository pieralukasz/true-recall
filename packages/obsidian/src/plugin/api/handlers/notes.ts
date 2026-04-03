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
	if (!body?.parent_name || !body.action) {
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
	ctx.plugin.dataLayer?.invalidateGroups(["cards", "dashboard", "review"]);

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

	ctx.plugin.dataLayer?.invalidateGroups(["cards", "dashboard", "review"]);

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
	ctx.plugin.dataLayer?.invalidateGroups(["cards", "dashboard", "review"]);

	sendOk(res, {
		path: body.path,
		targetParent: body.target_parent_name,
		moved: count,
	});
}
