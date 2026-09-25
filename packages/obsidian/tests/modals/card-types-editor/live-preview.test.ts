import { describe, expect, it } from "vitest";

import {
	liveEditKey,
	resolveLivePreview,
} from "@true-recall/obsidian/modals/core/card-types-editor/live-preview";

const noteType = {
	id: "nt-1",
	css: ".card { color: red; }",
	templates: [
		{ name: "Card 1", ordinal: 0, qfmt: "{{Front}}", afmt: "{{Back}}" },
		{ name: "Card 2", ordinal: 1, qfmt: "{{Back}}", afmt: "{{Front}}" },
	],
};

describe("resolveLivePreview", () => {
	it("shows the saved note type without a live edit", () => {
		expect(resolveLivePreview(noteType, 1, "front", null)).toEqual({
			template: noteType.templates[1],
			css: ".card { color: red; }",
		});
	});

	it("previews the CSS being typed on the Styling tab", () => {
		const edit = {
			key: liveEditKey("nt-1", 0, "styling"),
			value: ".card { color: blue; }",
		};
		expect(resolveLivePreview(noteType, 0, "styling", edit)).toEqual({
			template: noteType.templates[0],
			css: ".card { color: blue; }",
		});
	});

	it("previews the front or back template being typed", () => {
		const front = {
			key: liveEditKey("nt-1", 0, "front"),
			value: "Q: {{Front}}",
		};
		expect(resolveLivePreview(noteType, 0, "front", front).template?.qfmt).toBe(
			"Q: {{Front}}",
		);
		const back = { key: liveEditKey("nt-1", 0, "back"), value: "A: {{Back}}" };
		const resolved = resolveLivePreview(noteType, 0, "back", back);
		expect(resolved.template?.afmt).toBe("A: {{Back}}");
		expect(resolved.template?.qfmt).toBe("{{Front}}");
		expect(resolved.css).toBe(noteType.css);
	});

	it("ignores a stale edit from another tab or template", () => {
		const styling = {
			key: liveEditKey("nt-1", 0, "styling"),
			value: ".card { color: blue; }",
		};
		expect(resolveLivePreview(noteType, 0, "front", styling).css).toBe(
			noteType.css,
		);
		const otherTemplate = {
			key: liveEditKey("nt-1", 1, "front"),
			value: "other",
		};
		expect(
			resolveLivePreview(noteType, 0, "front", otherTemplate).template?.qfmt,
		).toBe("{{Front}}");
	});

	it("ignores an edit made for another note type", () => {
		const edit = { key: liveEditKey("nt-2", 0, "styling"), value: "x" };
		expect(resolveLivePreview(noteType, 0, "styling", edit).css).toBe(
			noteType.css,
		);
	});

	it("has no template when the index is out of range", () => {
		expect(resolveLivePreview(noteType, 5, "front", null).template).toBeNull();
	});
});
