import type { ApiContext, ApiRequest, ApiResponseWriter } from "../api.types";
import { sendError, sendOk } from "../api.types";

export async function handleCreateBackup(
	_req: ApiRequest,
	res: ApiResponseWriter,
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
	_req: ApiRequest,
	res: ApiResponseWriter,
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

export function handleGetIntegrity(
	_req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
): void {
	if (!ctx.plugin.isStoreReady()) {
		sendError(res, 503, "Database not ready");
		return;
	}

	const report = ctx.plugin.cardStore.integrity.check();
	sendOk(res, report);
}
