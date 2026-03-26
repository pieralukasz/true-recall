import type { IncomingMessage, ServerResponse } from "http";
import type { ApiContext } from "../api.types";
import { sendError, sendOk } from "../api.types";

export async function handleCreateBackup(
	_req: IncomingMessage,
	res: ServerResponse,
	ctx: ApiContext,
): Promise<void> {
	if (!ctx.plugin.backupService) {
		sendError(res, 503, "Backup service not initialized");
		return;
	}

	const path = await ctx.plugin.backupService.createBackup();
	sendOk(res, { created: true, path });
}

export async function handleListBackups(
	_req: IncomingMessage,
	res: ServerResponse,
	ctx: ApiContext,
): Promise<void> {
	if (!ctx.plugin.backupService) {
		sendError(res, 503, "Backup service not initialized");
		return;
	}

	const backups = await ctx.plugin.backupService.listBackups();
	sendOk(
		res,
		backups.map((b) => ({
			filename: b.filename,
			date: b.formattedDate,
			size: b.formattedSize,
		})),
	);
}

export async function handleGetIntegrity(
	_req: IncomingMessage,
	res: ServerResponse,
	ctx: ApiContext,
): Promise<void> {
	if (!ctx.plugin.isStoreReady()) {
		sendError(res, 503, "Database not ready");
		return;
	}

	const report = ctx.plugin.cardStore.integrity.check();
	sendOk(res, report);
}
