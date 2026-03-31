/**
 * Embeddable Markdown Editor for review cards.
 *
 * Based on Fevol's MIT-licensed gist (originally from mgmeyers/obsidian-kanban):
 * https://gist.github.com/Fevol/caa478ce303e69eabede7b12b2323838
 *
 * Uses app.embedRegistry to grab Obsidian's internal live-preview editor prototype,
 * giving us the SAME CodeMirror 6 extensions that power Obsidian's main editor.
 */
import { Prec } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { around } from "monkey-around";
import { Scope } from "obsidian";
/**
 * Resolve Obsidian's internal editor prototype by creating a temporary
 * Canvas-style embed widget and extracting its edit mode constructor.
 * Must be called AFTER app is fully loaded (onLayoutReady or later).
 */
function resolveEditorPrototype(app) {
    var _a;
    // app.embedRegistry is internal API — used by Kanban, Task Genius, etc.
    const embedRegistry = app.embedRegistry;
    if (!((_a = embedRegistry === null || embedRegistry === void 0 ? void 0 : embedRegistry.embedByExtension) === null || _a === void 0 ? void 0 : _a.md)) {
        throw new Error("[EmbeddableEditor] app.embedRegistry.embedByExtension.md not available");
    }
    // Intentionally passing null — we only need the editor prototype, not an actual file
    const nullFile = null;
    const widgetEditorView = embedRegistry.embedByExtension.md({ app, containerEl: document.createElement("div") }, nullFile, "");
    widgetEditorView.editable = true;
    widgetEditorView.showEditor();
    const MarkdownEditor = Object.getPrototypeOf(Object.getPrototypeOf(widgetEditorView.editMode));
    widgetEditorView.unload();
    return MarkdownEditor.constructor;
}
const defaultOptions = {
    value: "",
    cls: "",
    onEscape: () => { },
    onBlur: () => { },
    onPaste: () => { },
    onChange: () => { },
    onModEnter: () => { },
    onTab: () => { },
    onShiftTab: () => { },
    extraExtensions: [],
};
/**
 * Create the EmbeddableMarkdownEditor class bound to the current app.
 * Call once during plugin startup; cache the returned constructor.
 *
 * @example
 * // In plugin onload():
 * this.app.workspace.onLayoutReady(() => {
 *   this.EmbeddableEditor = createEmbeddableEditorClass(this.app);
 * });
 *
 * // Later, to create an instance:
 * const editor = new this.EmbeddableEditor(this.app, container, { value: "**hello**" });
 */
export function createEmbeddableEditorClass(app) {
    const Base = resolveEditorPrototype(app);
    class EmbeddableMarkdownEditor extends Base {
        constructor(editorApp, container, options) {
            super(editorApp, container, {
                app: editorApp,
                // Mock MarkdownView functions required for scrolling
                onMarkdownScroll: () => { },
                getMode: () => "source",
            });
            this._loaded = true;
            this.options = Object.assign(Object.assign({}, defaultOptions), options);
            this.scope = new Scope(editorApp.scope);
            // Override Mod+Enter — fires onModEnter callback, prevents "Open link in new leaf"
            this.scope.register(["Mod"], "Enter", () => {
                this.options.onModEnter(this);
                return true;
            });
            // Mock editMode/editor so Obsidian commands work on this editor
            this.owner.editMode = this;
            this.owner.editor = this.editor;
            this.set(this.options.value);
            // Prevent workspace from stealing focus when the editor is active
            this.register(around(editorApp.workspace, {
                setActiveLeaf: (oldMethod) => (...args) => {
                    var _a;
                    if (!((_a = this.activeCM) === null || _a === void 0 ? void 0 : _a.hasFocus))
                        oldMethod.apply(editorApp.workspace, args);
                },
            }));
            // Blur handler — auto-save trigger
            if (this.options.onBlur !== defaultOptions.onBlur) {
                this.editor.cm.contentDOM.addEventListener("blur", () => {
                    editorApp.keymap.popScope(this.scope);
                    if (this._loaded)
                        this.options.onBlur(this);
                });
            }
            // Focus handler — make commands work on this editor
            this.editor.cm.contentDOM.addEventListener("focusin", () => {
                editorApp.keymap.pushScope(this.scope);
                const owner = this.owner;
                editorApp.workspace.activeEditor = owner;
            });
            if (this.options.cls)
                this.editorEl.classList.add(this.options.cls);
        }
        get value() {
            return this.editor.cm.state.doc.toString();
        }
        onUpdate(update, changed) {
            super.onUpdate(update, changed);
        }
        buildLocalExtensions() {
            const extensions = super.buildLocalExtensions();
            // Direct CM6 updateListener — fires reliably on every document change,
            // without depending on Obsidian's internal 'changed' parameter.
            if (this.options.onChange !== defaultOptions.onChange) {
                extensions.push(EditorView.updateListener.of((update) => {
                    if (update.docChanged)
                        this.options.onChange(update);
                }));
            }
            // Paste handler
            extensions.push(EditorView.domEventHandlers({
                paste: (event) => {
                    this.options.onPaste(event, this);
                },
            }));
            // Keyboard shortcuts — highest precedence
            extensions.push(Prec.highest(keymap.of([
                {
                    key: "Escape",
                    run: () => {
                        this.options.onEscape(this);
                        return true;
                    },
                    preventDefault: true,
                },
                ...(this.options.onTab
                    ? [
                        {
                            key: "Tab",
                            run: () => {
                                var _a, _b;
                                (_b = (_a = this.options).onTab) === null || _b === void 0 ? void 0 : _b.call(_a, this);
                                return true;
                            },
                            preventDefault: true,
                        },
                    ]
                    : []),
                ...(this.options.onShiftTab
                    ? [
                        {
                            key: "Shift-Tab",
                            run: () => {
                                var _a, _b;
                                (_b = (_a = this.options).onShiftTab) === null || _b === void 0 ? void 0 : _b.call(_a, this);
                                return true;
                            },
                            preventDefault: true,
                        },
                    ]
                    : []),
            ])));
            // Consumer-provided extensions (e.g. custom keymaps)
            if (this.options.extraExtensions.length) {
                extensions.push(...this.options.extraExtensions);
            }
            return extensions;
        }
        destroy() {
            if (this._loaded) {
                this._loaded = false;
                this.unload();
            }
            this.app.keymap.popScope(this.scope);
            this.app.workspace.activeEditor = null;
            this.containerEl.empty();
            super.destroy();
        }
        onunload() {
            super.onunload();
            this._loaded = false;
        }
    }
    return EmbeddableMarkdownEditor;
}
