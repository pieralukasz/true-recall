import { __awaiter } from "tslib";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "preact/jsx-runtime";
import { Clickable } from "@true-recall/obsidian/components";
import { NotePicker } from "@true-recall/obsidian/components/NotePicker";
import { BasePromiseModal } from "@true-recall/obsidian/modals/shared/BasePromiseModal";
import { confirm } from "@true-recall/obsidian/modals/shared/ConfirmModal";
import { render } from "preact";
import { useCallback, useState } from "preact/hooks";
export class UidRemovedModal extends BasePromiseModal {
    constructor(app, options) {
        super(app, {
            title: `UID removed \u2014 ${options.cardCount} flashcard${options.cardCount === 1 ? "" : "s"} affected`,
            width: "500px",
        });
        this.allNotes = [];
        this.options = options;
    }
    getDefaultResult() {
        return { cancelled: true, action: "restore" };
    }
    onOpen() {
        super.onOpen();
        this.allNotes = this.app.vault.getMarkdownFiles();
    }
    renderBody(container) {
        render(_jsx(UidRemovedBody, { app: this.app, fileName: this.options.fileName, removedUid: this.options.removedUid, cardCount: this.options.cardCount, allNotes: this.allNotes, onResolve: (result) => this.resolve(result) }), container);
    }
}
// --- Preact body component ---
const ICON_MAP = {
    undo: "\u21A9\uFE0F",
    "trash-2": "\uD83D\uDDD1\uFE0F",
    folder: "\uD83D\uDCC1",
};
function ActionButton({ icon, label, description, type, onClick, }) {
    var _a;
    const btnCls = type === "primary"
        ? "ep:bg-obs-interactive-accent ep:text-obs-on-accent ep:hover:opacity-90"
        : type === "danger"
            ? "ep:bg-obs-red ep:text-obs-on-accent ep:hover:opacity-90"
            : "ep:bg-obs-secondary ep:text-obs-normal ep:hover:bg-obs-modifier-hover";
    return (_jsx(Clickable, { class: `ep:w-full ep:py-3 ep:px-4 ep:rounded-md ep:border ep:border-obs-border ep:transition-colors ep:text-left ${btnCls}`, onClick: onClick, children: _jsxs("div", { class: "ep:flex ep:items-center ep:gap-3", children: [_jsx("span", { class: "ep:text-lg", children: (_a = ICON_MAP[icon]) !== null && _a !== void 0 ? _a : "\u2022" }), _jsxs("div", { children: [_jsx("div", { class: "ep:font-medium ep:text-ui-small", children: label }), _jsx("div", { class: "ep:text-ui-smaller ep:opacity-70", children: description })] })] }) }));
}
function UidRemovedBody({ app, fileName, removedUid, cardCount, allNotes, onResolve, }) {
    const [showMoveSection, setShowMoveSection] = useState(false);
    const handleDelete = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        const confirmed = yield confirm(app, {
            message: `Are you sure you want to delete ${cardCount} flashcard${cardCount === 1 ? "" : "s"}? This cannot be undone.`,
        });
        if (confirmed) {
            onResolve({ cancelled: false, action: "delete" });
        }
    }), [app, cardCount, onResolve]);
    return (_jsxs(_Fragment, { children: [_jsxs("p", { class: "ep:text-obs-normal ep:text-ui-small ep:mb-4", children: ["The ", _jsx("code", { children: "flashcard_uid" }), " was removed from \"", fileName, "\".", " ", cardCount, " flashcard", cardCount === 1 ? "" : "s", " linked via UID", " ", _jsx("code", { children: removedUid }), " ", cardCount === 1 ? "is" : "are", " now disconnected."] }), _jsxs("div", { class: "ep:flex ep:flex-col ep:gap-2", children: [_jsx(ActionButton, { icon: "undo", label: "Restore UID", description: `Put flashcard_uid: ${removedUid} back into frontmatter`, type: "primary", onClick: () => onResolve({ cancelled: false, action: "restore" }) }), _jsx(ActionButton, { icon: "folder", label: "Move to another note", description: "Transfer cards to an existing note", type: "secondary", onClick: () => setShowMoveSection(true) }), _jsx(ActionButton, { icon: "trash-2", label: "Delete cards", description: "Permanently remove these flashcards", type: "danger", onClick: () => void handleDelete() })] }), showMoveSection && (_jsx("div", { class: "ep:mt-4 ep:pt-4 ep:border-t ep:border-obs-border", children: _jsx(NotePicker, { notes: allNotes, onSelect: (note) => onResolve({
                        cancelled: false,
                        action: "move",
                        targetNotePath: note.path,
                    }), onCancel: () => setShowMoveSection(false), maxResults: 30, title: "Select target note" }) }))] }));
}
