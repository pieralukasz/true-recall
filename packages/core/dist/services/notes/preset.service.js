import { __awaiter } from "tslib";
import { extractFSRSSettingsFromPreset } from "../../types/settings.types";
export class PresetService {
    constructor(getSettings, persistSettings, frontmatterIndex, hierarchyService, getCardStore) {
        this.getSettings = getSettings;
        this.persistSettings = persistSettings;
        this.frontmatterIndex = frontmatterIndex;
        this.hierarchyService = hierarchyService;
        this.getCardStore = getCardStore;
    }
    getPresets() {
        return this.getSettings().fsrsPresets;
    }
    getDefaultPreset() {
        const settings = this.getSettings();
        const preset = settings.fsrsPresets.find((p) => p.id === settings.defaultPresetId);
        const fallback = settings.fsrsPresets[0];
        if (preset)
            return preset;
        if (fallback)
            return fallback;
        throw new Error("No FSRS presets configured");
    }
    getPresetById(id) {
        return this.getSettings().fsrsPresets.find((p) => p.id === id);
    }
    getPresetByName(name) {
        return this.getSettings().fsrsPresets.find((p) => p.name === name);
    }
    createPreset(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const settings = this.getSettings();
            const preset = Object.assign(Object.assign({}, data), { id: crypto.randomUUID(), createdAt: Date.now() });
            settings.fsrsPresets.push(preset);
            yield this.persistSettings();
            return preset;
        });
    }
    updatePreset(id, changes) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const settings = this.getSettings();
            const idx = settings.fsrsPresets.findIndex((p) => p.id === id);
            if (idx === -1)
                return;
            const existing = settings.fsrsPresets[idx];
            if (!existing)
                return;
            if (changes.name && changes.name !== existing.name) {
                (_c = (_b = (_a = this.getCardStore) === null || _a === void 0 ? void 0 : _a.call(this)) === null || _b === void 0 ? void 0 : _b.stats) === null || _c === void 0 ? void 0 : _c.updateReviewLogPresetName(existing.name, changes.name);
            }
            settings.fsrsPresets[idx] = Object.assign(Object.assign({}, existing), changes);
            yield this.persistSettings();
        });
    }
    deletePreset(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const settings = this.getSettings();
            if (id === settings.defaultPresetId)
                return;
            settings.fsrsPresets = settings.fsrsPresets.filter((p) => p.id !== id);
            yield this.persistSettings();
        });
    }
    /**
     * Resolution order (most specific wins):
     * 1. Note's own `fsrs_preset` frontmatter
     * 2. Nearest ancestor with `fsrs_preset` (walks parents chain)
     * 3. Global default preset
     */
    resolvePresetForCard(card, context) {
        const notePath = this.resolveNotePath(card);
        if (notePath) {
            const result = this.resolveForNotePath(notePath, context);
            if (result)
                return result;
        }
        return this.getDefaultPreset();
    }
    resolvePresetChain(notePath, context) {
        var _a;
        const chain = [];
        let effective = null;
        // Tier 1: Note's own preset
        const notePresetName = this.lookupPresetName(notePath);
        const notePreset = notePresetName
            ? this.getPresetByName(notePresetName)
            : undefined;
        if (notePreset && !effective) {
            effective = {
                preset: notePreset,
                source: "note",
                sourcePath: notePath,
            };
        }
        chain.push({
            source: "note",
            sourcePath: notePath,
            presetName: notePresetName,
            active: (effective === null || effective === void 0 ? void 0 : effective.source) === "note",
        });
        // Tier 2: Parent chain
        const parentResult = this.resolveParentPreset(notePath, context);
        if (parentResult && !effective) {
            effective = parentResult;
        }
        chain.push({
            source: "parent",
            sourcePath: (_a = parentResult === null || parentResult === void 0 ? void 0 : parentResult.sourcePath) !== null && _a !== void 0 ? _a : context === null || context === void 0 ? void 0 : context.projectPath,
            presetName: parentResult
                ? parentResult.preset.name
                : this.lookupPresetName(context === null || context === void 0 ? void 0 : context.projectPath),
            active: (effective === null || effective === void 0 ? void 0 : effective.source) === "parent",
        });
        // Tier 3: Default
        const defaultPreset = this.getDefaultPreset();
        if (!effective) {
            effective = { preset: defaultPreset, source: "default" };
        }
        chain.push({
            source: "default",
            presetName: defaultPreset.name,
            active: effective.source === "default",
        });
        return { chain, effective };
    }
    resolveNotePath(card) {
        if (!card.sourceUid)
            return null;
        return this.frontmatterIndex.getFileByValue("flashcard_uid", card.sourceUid);
    }
    resolveForNotePath(notePath, context) {
        // Tier 1: Note's own preset
        const notePreset = this.lookupPreset(notePath);
        if (notePreset)
            return notePreset;
        // Tier 2: Parent chain
        const parentResult = this.resolveParentPreset(notePath, context);
        if (parentResult)
            return parentResult.preset;
        return null;
    }
    /**
     * Walks the parent chain (BFS) to find the nearest ancestor with fsrs_preset.
     */
    resolveParentPreset(notePath, context) {
        if (context === null || context === void 0 ? void 0 : context.projectPath) {
            const preset = this.lookupPreset(context.projectPath);
            if (preset) {
                return {
                    preset,
                    source: "parent",
                    sourcePath: context.projectPath,
                };
            }
        }
        // BFS through parents chain
        const visited = new Set();
        const queue = [...this.hierarchyService.getParentsForNote(notePath)];
        while (queue.length > 0) {
            const current = queue.shift();
            if (current === undefined)
                break;
            if (visited.has(current))
                continue;
            visited.add(current);
            const preset = this.lookupPreset(current);
            if (preset) {
                return { preset, source: "parent", sourcePath: current };
            }
            // Walk further up
            for (const grandparent of this.hierarchyService.getParentsForNote(current)) {
                if (!visited.has(grandparent))
                    queue.push(grandparent);
            }
        }
        return null;
    }
    lookupPresetName(path) {
        if (!path)
            return null;
        const values = this.frontmatterIndex.getValues("fsrs_preset", path);
        return values.length > 0 && values[0] ? values[0] : null;
    }
    lookupPreset(path) {
        const name = this.lookupPresetName(path);
        return name ? this.getPresetByName(name) : undefined;
    }
    toFSRSSettings(preset) {
        return extractFSRSSettingsFromPreset(preset);
    }
}
