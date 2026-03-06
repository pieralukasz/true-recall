/**
 * Embeddable Markdown Editor for review cards.
 *
 * Based on Fevol's MIT-licensed gist (originally from mgmeyers/obsidian-kanban):
 * https://gist.github.com/Fevol/caa478ce303e69eabede7b12b2323838
 *
 * Uses app.embedRegistry to grab Obsidian's internal live-preview editor prototype,
 * giving us the SAME CodeMirror 6 extensions that power Obsidian's main editor.
 */

import { type Extension, Prec } from "@codemirror/state";
import { EditorView, keymap, type ViewUpdate } from "@codemirror/view";
import { around } from "monkey-around";
import { type App, Scope, type TFile } from "obsidian";

// ─── Types for Obsidian internals (not in public typings) ────────────────────

interface WidgetEditorView {
	editable: boolean;
	showEditor(): void;
	editMode: unknown;
	unload(): void;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export interface EmbeddableEditorOptions {
	value?: string;
	cls?: string;
	onEscape?: (editor: EmbeddableEditorInstance) => void;
	onBlur?: (editor: EmbeddableEditorInstance) => void;
	onPaste?: (e: ClipboardEvent, editor: EmbeddableEditorInstance) => void;
	onChange?: (update: ViewUpdate) => void;
	onModEnter?: (editor: EmbeddableEditorInstance) => void;
	extraExtensions?: Extension[];
}

export interface EmbeddableEditorInstance {
	/** Current markdown content */
	readonly value: string;
	/** Replace all content */
	set(content: string): void;
	/** Properly destroy the editor and clean up resources */
	destroy(): void;
	/** The container element holding the editor */
	readonly containerEl: HTMLElement;
	/** The underlying CM6 EditorView (for advanced use) */
	readonly cm: EditorView;
}

/**
 * Resolve Obsidian's internal editor prototype by creating a temporary
 * Canvas-style embed widget and extracting its edit mode constructor.
 * Must be called AFTER app is fully loaded (onLayoutReady or later).
 */
function resolveEditorPrototype(app: App): new (...args: unknown[]) => any {
	// app.embedRegistry is internal API — used by Kanban, Task Genius, etc.
	const embedRegistry = (app as any).embedRegistry;
	if (!embedRegistry?.embedByExtension?.md) {
		throw new Error(
			"[EmbeddableEditor] app.embedRegistry.embedByExtension.md not available",
		);
	}

	const widgetEditorView = embedRegistry.embedByExtension.md(
		{ app, containerEl: document.createElement("div") },
		null as unknown as TFile,
		"",
	) as WidgetEditorView;

	widgetEditorView.editable = true;
	widgetEditorView.showEditor();

	const MarkdownEditor = Object.getPrototypeOf(
		Object.getPrototypeOf(widgetEditorView.editMode),
	);

	widgetEditorView.unload();

	return MarkdownEditor.constructor;
}

const defaultOptions: Required<EmbeddableEditorOptions> = {
	value: "",
	cls: "",
	onEscape: () => {},
	onBlur: () => {},
	onPaste: () => {},
	onChange: () => {},
	onModEnter: () => {},
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
export function createEmbeddableEditorClass(app: App) {
	const Base = resolveEditorPrototype(app);

	// Members inherited from the runtime prototype (not visible to TS):
	// - set(content: string): void
	// - containerEl: HTMLElement
	// - editor: { cm: EditorView }
	// - editorEl: HTMLElement
	// - activeCM: EditorView
	// - owner: any
	// - app: App
	// - register(cb: () => void): void
	// - unload(): void
	class EmbeddableMarkdownEditor extends Base {
		declare set: (content: string) => void;
		declare containerEl: HTMLElement;
		declare editor: { cm: EditorView };
		declare editorEl: HTMLElement;
		declare activeCM: EditorView;
		declare cm: EditorView;
		declare owner: any;
		declare app: App;

		options: Required<EmbeddableEditorOptions>;
		scope: Scope;
		private _loaded = true;

		constructor(
			editorApp: App,
			container: HTMLElement,
			options: EmbeddableEditorOptions,
		) {
			super(editorApp, container, {
				app: editorApp,
				// Mock MarkdownView functions required for scrolling
				onMarkdownScroll: () => {},
				getMode: () => "source",
			});

			this.options = { ...defaultOptions, ...options };
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
			this.register(
				around(editorApp.workspace, {
					setActiveLeaf:
						(oldMethod: (...args: any[]) => void) =>
						(...args: any[]) => {
							if (!this.activeCM?.hasFocus)
								oldMethod.apply(editorApp.workspace, args);
						},
				} as any),
			);

			// Blur handler — auto-save trigger
			if (this.options.onBlur !== defaultOptions.onBlur) {
				this.editor.cm.contentDOM.addEventListener("blur", () => {
					editorApp.keymap.popScope(this.scope);
					if (this._loaded) this.options.onBlur(this);
				});
			}

			// Focus handler — make commands work on this editor
			this.editor.cm.contentDOM.addEventListener("focusin", () => {
				editorApp.keymap.pushScope(this.scope);
				editorApp.workspace.activeEditor = this.owner;
			});

			if (this.options.cls) this.editorEl.classList.add(this.options.cls);
		}

		get value(): string {
			return this.editor.cm.state.doc.toString();
		}

		onUpdate(update: ViewUpdate, changed: boolean) {
			super.onUpdate(update, changed);
		}

		buildLocalExtensions(): Extension[] {
			const extensions: Extension[] = super.buildLocalExtensions();

			// Direct CM6 updateListener — fires reliably on every document change,
			// without depending on Obsidian's internal 'changed' parameter.
			if (this.options.onChange !== defaultOptions.onChange) {
				extensions.push(
					EditorView.updateListener.of((update: ViewUpdate) => {
						if (update.docChanged) this.options.onChange(update);
					}),
				);
			}

			// Paste handler
			extensions.push(
				EditorView.domEventHandlers({
					paste: (event) => {
						this.options.onPaste(event, this);
					},
				}),
			);

			// Keyboard shortcuts — highest precedence
			extensions.push(
				Prec.highest(
					keymap.of([
						{
							key: "Escape",
							run: () => {
								this.options.onEscape(this);
								return true;
							},
							preventDefault: true,
						},
					]),
				),
			);

			// Consumer-provided extensions (e.g. custom keymaps)
			if (this.options.extraExtensions.length) {
				extensions.push(...this.options.extraExtensions);
			}

			return extensions;
		}

		destroy(): void {
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

	return EmbeddableMarkdownEditor as unknown as new (
		app: App,
		container: HTMLElement,
		options: EmbeddableEditorOptions,
	) => EmbeddableEditorInstance & { destroy(): void };
}

export type EmbeddableEditorClass = ReturnType<
	typeof createEmbeddableEditorClass
>;
