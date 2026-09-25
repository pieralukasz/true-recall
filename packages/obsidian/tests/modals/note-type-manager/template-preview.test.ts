import { describe, expect, it } from "vitest";

import { noteTypeScopeClass } from "@true-recall/obsidian/features/study/ui/review/helpers/note-type-css";
import {
	buildSampleFields,
	previewNoteTypeCss,
	previewScopeId,
} from "@true-recall/obsidian/modals/core/note-type-manager/template-preview";

describe("buildSampleFields", () => {
	it("uses placeholders for standard types", () => {
		expect(buildSampleFields(["Front", "Back"], 0)).toEqual({
			Front: "(Front)",
			Back: "(Back)",
		});
	});

	it("uses a c1 cloze for cloze types", () => {
		expect(buildSampleFields(["Text"], 1)).toEqual({
			Text: "{{c1::sample Text text}}",
		});
	});
});

describe("previewNoteTypeCss", () => {
	it("returns null without CSS", () => {
		expect(previewNoteTypeCss(undefined, "nt-1", 0, 0)).toBeNull();
		expect(previewNoteTypeCss("   ", "nt-1", 0, 0)).toBeNull();
	});

	it("returns null when nothing survives sanitising", () => {
		expect(
			previewNoteTypeCss("@import url(https://x.test/a.css);", "nt-1", 0, 0),
		).toBeNull();
	});

	it("scopes to a preview-only class, never the review scope", () => {
		const scoped = previewNoteTypeCss(".card { color: red; }", "nt-1", 0, 0);
		const previewScope = noteTypeScopeClass(previewScopeId("nt-1"));
		expect(scoped?.className.split(" ")).toContain(previewScope);
		expect(scoped?.css).toContain(`.${previewScope} { color: red; }`);
		expect(scoped?.className.split(" ")).not.toContain(
			noteTypeScopeClass("nt-1"),
		);
	});

	it("maps the template ordinal to Anki's cardN", () => {
		expect(previewNoteTypeCss(".card {}", "nt-1", 1, 0)?.className).toContain(
			"tr-nt-card2",
		);
	});

	it("maps cloze types to card1 (the preview renders c1)", () => {
		expect(previewNoteTypeCss(".card {}", "nt-1", 0, 1)?.className).toContain(
			"tr-nt-card1",
		);
	});

	it("scopes a note type still being created", () => {
		const scoped = previewNoteTypeCss(".card { color: red; }", undefined, 0, 0);
		expect(scoped?.className).toContain(noteTypeScopeClass("preview-draft"));
	});
});
