import { __awaiter } from "tslib";
import { BUILTIN_IMAGE_OCCLUSION_ID, } from "@true-recall/core/types/note.types";
export function openPanelCardEditor(_a) {
    return __awaiter(this, arguments, void 0, function* ({ note, noteType, openImageOcclusionEditor, openQuickEditor, }) {
        if (noteType.id === BUILTIN_IMAGE_OCCLUSION_ID) {
            yield openImageOcclusionEditor({
                mode: "edit",
                noteId: note.id,
                note,
            });
            return;
        }
        yield openQuickEditor();
    });
}
