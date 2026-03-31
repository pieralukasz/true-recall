import { __awaiter } from "tslib";
import { TFile } from "obsidian";
export class ObsidianFileSystem {
    constructor(app) {
        this.app = app;
    }
    read(path) {
        return __awaiter(this, void 0, void 0, function* () {
            const file = this.app.vault.getAbstractFileByPath(path);
            if (!file || !(file instanceof TFile)) {
                throw new Error(`File not found: ${path}`);
            }
            return this.app.vault.read(file);
        });
    }
    write(path, content) {
        return __awaiter(this, void 0, void 0, function* () {
            const file = this.app.vault.getAbstractFileByPath(path);
            if (file && file instanceof TFile) {
                yield this.app.vault.modify(file, content);
            }
            else {
                yield this.app.vault.create(path, content);
            }
        });
    }
    delete(path) {
        return __awaiter(this, void 0, void 0, function* () {
            const file = this.app.vault.getAbstractFileByPath(path);
            if (file)
                yield this.app.vault.delete(file);
        });
    }
    listMarkdownFiles() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.app.vault.getMarkdownFiles().map((f) => f.path);
        });
    }
    watch(callback) {
        const onCreate = this.app.vault.on("create", (file) => callback("create", file.path));
        const onModify = this.app.vault.on("modify", (file) => callback("modify", file.path));
        const onDelete = this.app.vault.on("delete", (file) => callback("delete", file.path));
        return () => {
            this.app.vault.offref(onCreate);
            this.app.vault.offref(onModify);
            this.app.vault.offref(onDelete);
        };
    }
}
