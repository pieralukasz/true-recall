import { __awaiter } from "tslib";
import { parseJsonBody, readBody, sendError, sendOk } from "../api.types";
export function handleAddFlashcardUid(_req, res, ctx) {
    return __awaiter(this, void 0, void 0, function* () {
        const file = ctx.plugin.app.workspace.getActiveFile();
        if (!file || file.extension !== "md") {
            sendError(res, 404, "No active markdown note");
            return;
        }
        const frontmatterService = ctx.plugin.flashcardManager.getFrontmatterService();
        const existingUid = yield frontmatterService.getSourceNoteUid(file.path);
        if (existingUid) {
            sendOk(res, { uid: existingUid, alreadyExisted: true, path: file.path });
            return;
        }
        const newUid = frontmatterService.generateUid();
        yield frontmatterService.setSourceNoteUid(file.path, newUid);
        sendOk(res, { uid: newUid, alreadyExisted: false, path: file.path });
    });
}
export function handleSetPresetForNote(req, res, ctx) {
    return __awaiter(this, void 0, void 0, function* () {
        const raw = yield readBody(req);
        const body = parseJsonBody(raw);
        if (body === null || !("preset_name" in body)) {
            sendError(res, 400, "Body must contain { preset_name: string | null, path?: string }");
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
        const frontmatterService = ctx.plugin.flashcardManager.getFrontmatterService();
        yield frontmatterService.setFsrsPreset(abstractFile.path, body.preset_name);
        sendOk(res, {
            path: filePath,
            presetName: body.preset_name,
            action: body.preset_name ? "set" : "removed",
        });
    });
}
export function handleSetParent(req, res, ctx) {
    return __awaiter(this, void 0, void 0, function* () {
        const raw = yield readBody(req);
        const body = parseJsonBody(raw);
        if (!(body === null || body === void 0 ? void 0 : body.parent_name) || !body.action) {
            sendError(res, 400, "Body must contain { parent_name: string, action: 'add' | 'remove', path?: string }");
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
        const frontmatterService = ctx.plugin.flashcardManager.getFrontmatterService();
        const tFile = abstractFile;
        if (body.action === "add") {
            yield frontmatterService.addParent(tFile.path, body.parent_name);
        }
        else {
            yield frontmatterService.removeParent(tFile.path, body.parent_name);
        }
        sendOk(res, {
            path: filePath,
            parentName: body.parent_name,
            action: body.action,
        });
    });
}
export function handleSetArchive(req, res, ctx) {
    return __awaiter(this, void 0, void 0, function* () {
        const raw = yield readBody(req);
        const body = parseJsonBody(raw);
        if (!body || typeof body.archived !== "boolean") {
            sendError(res, 400, "Body must contain { archived: boolean, path?: string }");
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
        const frontmatterService = ctx.plugin.flashcardManager.getFrontmatterService();
        yield frontmatterService.setArchive(abstractFile.path, body.archived);
        sendOk(res, { path: filePath, archived: body.archived });
    });
}
