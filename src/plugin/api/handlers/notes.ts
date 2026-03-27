import type { IncomingMessage, ServerResponse } from "http";
import type { ApiContext } from "../api.types";
import { parseJsonBody, readBody, sendError, sendOk } from "../api.types";

export async function handleAddFlashcardUid(
	_req: IncomingMessage,
	res: ServerResponse,
	ctx: ApiContext,
): Promise<void> {
	const file = ctx.plugin.app.workspace.getActiveFile();
	if (!file || file.extension !== "md") {
		sendError(res, 404, "No active markdown note");
		return;
	}

	const frontmatterService =
		ctx.plugin.flashcardManager.getFrontmatterService();

	const existingUid = await frontmatterService.getSourceNoteUid(file);
	if (existingUid) {
		sendOk(res, { uid: existingUid, alreadyExisted: true, path: file.path });
		return;
	}

	const newUid = frontmatterService.generateUid();
	await frontmatterService.setSourceNoteUid(file, newUid);
	sendOk(res, { uid: newUid, alreadyExisted: false, path: file.path });
}

export async function handleSetPresetForNote(
	req: IncomingMessage,
	res: ServerResponse,
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
	await frontmatterService.setFsrsPreset(
		abstractFile as import("obsidian").TFile,
		body.preset_name,
	);

	sendOk(res, {
		path: filePath,
		presetName: body.preset_name,
		action: body.preset_name ? "set" : "removed",
	});
}

export async function handleSetParent(
	req: IncomingMessage,
	res: ServerResponse,
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
		await frontmatterService.addParent(tFile, body.parent_name);
	} else {
		await frontmatterService.removeParent(tFile, body.parent_name);
	}

	sendOk(res, {
		path: filePath,
		parentName: body.parent_name,
		action: body.action,
	});
}

export async function handleSetArchive(
	req: IncomingMessage,
	res: ServerResponse,
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
	await frontmatterService.setArchive(
		abstractFile as import("obsidian").TFile,
		body.archived,
	);

	sendOk(res, { path: filePath, archived: body.archived });
}
