import { __awaiter } from "tslib";
import { sendError, sendOk } from "../api.types";
export function handleCreateBackup(_req, res, ctx) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!ctx.plugin.backupService) {
            sendError(res, 503, "Backup service not initialized");
            return;
        }
        const path = yield ctx.plugin.backupService.createBackup();
        sendOk(res, { created: true, path });
    });
}
export function handleListBackups(_req, res, ctx) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!ctx.plugin.backupService) {
            sendError(res, 503, "Backup service not initialized");
            return;
        }
        const backups = yield ctx.plugin.backupService.listBackups();
        sendOk(res, backups.map((b) => ({
            filename: b.filename,
            date: b.formattedDate,
            size: b.formattedSize,
        })));
    });
}
export function handleGetIntegrity(_req, res, ctx) {
    if (!ctx.plugin.isStoreReady()) {
        sendError(res, 503, "Database not ready");
        return;
    }
    const report = ctx.plugin.cardStore.integrity.check();
    sendOk(res, report);
}
