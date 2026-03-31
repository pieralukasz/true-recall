import { StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, } from "@codemirror/view";
import { effect } from "@preact/signals";
import { highlightRequest, } from "@true-recall/obsidian/services/signals";
const addHighlight = StateEffect.define();
const clearHighlight = StateEffect.define();
const highlightField = StateField.define({
    create() {
        return Decoration.none;
    },
    update(decorations, tr) {
        for (const e of tr.effects) {
            if (e.is(addHighlight)) {
                return Decoration.set([
                    Decoration.mark({
                        class: e.value.className,
                    }).range(e.value.from, e.value.to),
                ]);
            }
            if (e.is(clearHighlight)) {
                return Decoration.none;
            }
        }
        return decorations.map(tr.changes);
    },
    provide: (f) => EditorView.decorations.from(f),
});
export function createSourceHighlightExtension(getFilePath) {
    const plugin = ViewPlugin.fromClass(class {
        constructor(view) {
            this.view = view;
            this.lastRequestId = -1;
            this.clearTimer = null;
            this.dispose = null;
            this.dispose = effect(() => {
                const req = highlightRequest.value;
                if (!req) {
                    queueMicrotask(() => this.clearHighlightNow());
                    return;
                }
                queueMicrotask(() => this.handleRequest(req));
            });
        }
        clearHighlightNow() {
            if (this.clearTimer) {
                clearTimeout(this.clearTimer);
                this.clearTimer = null;
            }
            this.view.dispatch({
                effects: clearHighlight.of(undefined),
            });
        }
        handleRequest(req) {
            if (req.requestId === this.lastRequestId)
                return;
            this.lastRequestId = req.requestId;
            const currentPath = getFilePath();
            if (!currentPath || currentPath !== req.sourceNotePath)
                return;
            const doc = this.view.state.doc.toString();
            const idx = doc.indexOf(req.sourceText);
            if (idx === -1)
                return;
            if (this.clearTimer) {
                clearTimeout(this.clearTimer);
                this.clearTimer = null;
            }
            const colorSuffix = req.colorHint && req.colorHint !== "default"
                ? `-${req.colorHint}`
                : "";
            const className = req.mode === "hover"
                ? `true-recall-source-highlight-hover${colorSuffix}`
                : `true-recall-source-highlight${colorSuffix}`;
            const effects = [
                addHighlight.of({
                    from: idx,
                    to: idx + req.sourceText.length,
                    className,
                }),
            ];
            if (req.mode === "jump") {
                effects.push(EditorView.scrollIntoView(idx, { y: "center" }));
            }
            this.view.dispatch({ effects });
            // Auto-clear only for jump mode
            if (req.mode === "jump") {
                this.clearTimer = setTimeout(() => {
                    this.view.dispatch({
                        effects: clearHighlight.of(undefined),
                    });
                    this.clearTimer = null;
                }, 2000);
            }
        }
        update(_update) { }
        destroy() {
            var _a;
            (_a = this.dispose) === null || _a === void 0 ? void 0 : _a.call(this);
            if (this.clearTimer)
                clearTimeout(this.clearTimer);
        }
    });
    return [highlightField, plugin];
}
