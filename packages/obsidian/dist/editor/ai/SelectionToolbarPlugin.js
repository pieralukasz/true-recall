import { __awaiter } from "tslib";
import { ViewPlugin } from "@codemirror/view";
import { SelectionToolbar } from "./SelectionToolbar";
import { computePosition, flip, offset, shift } from "@floating-ui/dom";
import { h, render } from "preact";
function extractFirstImagePath(text) {
    const wiki = text.match(/!\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);
    if (wiki === null || wiki === void 0 ? void 0 : wiki[1])
        return wiki[1].trim();
    const md = text.match(/!\[[^\]]*\]\(([^)]+)\)/);
    if (md === null || md === void 0 ? void 0 : md[1])
        return md[1].trim();
    return null;
}
const MIN_SELECTION_LENGTH = 3;
export function createSelectionToolbarExtension(callbacks) {
    return ViewPlugin.fromClass(class {
        constructor(view) {
            this.view = view;
            this.container = null;
            this.currentText = "";
            this.rafId = 0;
            this.scheduleCheck();
        }
        update(update) {
            if (update.selectionSet || update.docChanged || update.focusChanged) {
                this.scheduleCheck();
            }
        }
        scheduleCheck() {
            cancelAnimationFrame(this.rafId);
            this.rafId = requestAnimationFrame(() => this.checkSelection());
        }
        destroy() {
            cancelAnimationFrame(this.rafId);
            this.removeToolbar();
        }
        checkSelection() {
            var _a;
            if (!callbacks.isEnabled()) {
                this.removeToolbar();
                return;
            }
            if (!this.view.hasFocus && !((_a = this.container) === null || _a === void 0 ? void 0 : _a.matches(":hover"))) {
                this.removeToolbar();
                return;
            }
            if (this.view.dom.closest(".true-recall-review-card-container, .ep-card-browser")) {
                this.removeToolbar();
                return;
            }
            const { state } = this.view;
            const selection = state.selection.main;
            if (selection.empty) {
                this.removeToolbar();
                return;
            }
            const selectedText = state.doc.sliceString(selection.from, selection.to);
            if (selectedText.trim().length < MIN_SELECTION_LENGTH) {
                this.removeToolbar();
                return;
            }
            // Reuse existing container if text unchanged
            if (this.container && this.currentText === selectedText) {
                this.positionToolbar(selection.from);
                return;
            }
            this.currentText = selectedText;
            this.showToolbar(selectedText, selection.from);
        }
        showToolbar(text, pos) {
            if (!this.container) {
                this.container = document.createElement("div");
                this.container.className = "true-recall-selection-toolbar-container";
                document.body.appendChild(this.container);
            }
            const detectedImagePath = extractFirstImagePath(text);
            render(h(SelectionToolbar, {
                selectedText: text,
                onGenerate: () => __awaiter(this, void 0, void 0, function* () {
                    yield callbacks.onGenerate(text);
                }),
                onEdit: () => callbacks.onEdit(text),
                onQuickAdd: () => __awaiter(this, void 0, void 0, function* () {
                    yield callbacks.onQuickAdd(text);
                }),
                onDismiss: () => this.removeToolbar(),
                onHighlight: () => {
                    const { state } = this.view;
                    const sel = state.selection.main;
                    if (sel.empty)
                        return;
                    this.view.dispatch({
                        changes: [
                            { from: sel.from, insert: "==" },
                            { from: sel.to, insert: "==" },
                        ],
                    });
                },
                onImageOcclusion: (path) => callbacks.onImageOcclusion(path),
                detectedImagePath,
                hasApiKey: callbacks.hasApiKey(),
            }), this.container);
            this.positionToolbar(pos);
        }
        positionToolbar(pos) {
            if (!this.container)
                return;
            const coords = this.view.coordsAtPos(pos);
            if (!coords) {
                this.removeToolbar();
                return;
            }
            const virtualEl = {
                getBoundingClientRect: () => ({
                    width: coords.right - coords.left,
                    height: coords.bottom - coords.top,
                    x: coords.left,
                    y: coords.top,
                    top: coords.top,
                    left: coords.left,
                    right: coords.right,
                    bottom: coords.bottom,
                }),
            };
            void computePosition(virtualEl, this.container, {
                placement: "top-start",
                middleware: [offset(6), flip(), shift({ padding: 8 })],
            }).then(({ x, y }) => {
                if (!this.container)
                    return;
                this.container.style.left = `${x}px`;
                this.container.style.top = `${y}px`;
            });
        }
        removeToolbar() {
            if (this.container) {
                render(null, this.container);
                this.container.remove();
                this.container = null;
                this.currentText = "";
            }
        }
    });
}
