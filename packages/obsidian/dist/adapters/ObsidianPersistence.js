import { __awaiter } from "tslib";
import { normalizePath } from "obsidian";
export class ObsidianPersistence {
    constructor(app) {
        this.app = app;
    }
    readBinary(path) {
        return __awaiter(this, void 0, void 0, function* () {
            const normalized = normalizePath(path);
            if (!(yield this.app.vault.adapter.exists(normalized)))
                return null;
            const buffer = yield this.app.vault.adapter.readBinary(normalized);
            return new Uint8Array(buffer);
        });
    }
    read(path) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.app.vault.adapter.read(normalizePath(path));
        });
    }
    writeBinary(path, data) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.app.vault.adapter.writeBinary(normalizePath(path), data);
        });
    }
    exists(path) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.app.vault.adapter.exists(normalizePath(path));
        });
    }
    mkdir(path) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.app.vault.adapter.mkdir(normalizePath(path));
        });
    }
    list(path) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.app.vault.adapter.list(normalizePath(path));
        });
    }
    remove(path) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.app.vault.adapter.remove(normalizePath(path));
        });
    }
    stat(path) {
        return __awaiter(this, void 0, void 0, function* () {
            const s = yield this.app.vault.adapter.stat(normalizePath(path));
            return s ? { size: s.size, mtime: s.mtime } : null;
        });
    }
}
