import { __rest } from "tslib";
import { computeActionableSessionSnapshot as coreCompute, } from "@true-recall/core/services/review/actionable-session-snapshot.service";
/** Wrapper that adapts MetadataCache → INoteResolver for callers */
export function computeActionableSessionSnapshot(deps, filters, options = {}) {
    const { metadataCache } = deps, rest = __rest(deps, ["metadataCache"]);
    const noteResolver = metadataCache
        ? {
            resolveNotePath(noteName) {
                var _a;
                const file = metadataCache.getFirstLinkpathDest(noteName, "");
                return (_a = file === null || file === void 0 ? void 0 : file.path) !== null && _a !== void 0 ? _a : null;
            },
        }
        : undefined;
    return coreCompute(Object.assign(Object.assign({}, rest), { noteResolver }), filters, options);
}
