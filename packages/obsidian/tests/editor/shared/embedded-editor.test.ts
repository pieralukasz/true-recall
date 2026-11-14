import { afterEach, describe, expect, it, vi } from "vitest";

import { createEmbeddableEditorClass } from "../../../src/editor/shared/embedded-editor";

class ObsidianMarkdownEditor {}
class ObsidianWidgetEditMode extends ObsidianMarkdownEditor {}

type EmbedFile = { extension: string } | null;

function obsidianMarkdownEmbed() {
	return {
		editable: false,
		editMode: null as unknown,
		showEditor() {
			this.editMode = new ObsidianWidgetEditMode();
		},
		unload: vi.fn(),
	};
}

// The shape of FineNotes 2.9.1's embed hook (src/view/page-embed.ts):
// `isInkFile(file)` reads `file.extension` before handing the embed back.
function fineNotesHook(original: typeof obsidianMarkdownEmbed) {
	return (_ctx: unknown, file: EmbedFile, _subpath: string) => {
		const isInk = (file as { extension: string }).extension !== "md";
		return isInk ? null : original();
	};
}

function appWithMarkdownEmbed(md: (...args: never[]) => unknown) {
	return { embedRegistry: { embedByExtension: { md } } } as never;
}

describe("createEmbeddableEditorClass", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("resolves the editor when another plugin's md embed hook rejects a null file (#142)", () => {
		vi.stubGlobal("createDiv", () => ({}));
		const app = appWithMarkdownEmbed(fineNotesHook(obsidianMarkdownEmbed));

		const Editor = createEmbeddableEditorClass(app);

		expect(Editor.prototype).toBeInstanceOf(ObsidianMarkdownEditor);
	});
});
