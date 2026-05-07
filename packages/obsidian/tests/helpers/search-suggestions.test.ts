import { describe, expect, it } from "vitest";

import {
	buildStaticSuggestions,
	getTokenAtCursor,
	getTokenContext,
	replaceTokenAtCursor,
} from "../../src/helpers/search-suggestions";

describe("getTokenAtCursor", () => {
	it("returns empty token for empty input", () => {
		expect(getTokenAtCursor("", 0)).toEqual({
			token: "",
			start: 0,
			end: 0,
		});
	});

	it("extracts single token when cursor is at end", () => {
		expect(getTokenAtCursor("is:new", 6)).toEqual({
			token: "is:new",
			start: 0,
			end: 6,
		});
	});

	it("extracts token at cursor in the middle of multi-token input", () => {
		expect(getTokenAtCursor("is:new prop:la", 14)).toEqual({
			token: "prop:la",
			start: 7,
			end: 14,
		});
	});

	it("extracts first token when cursor is in first word", () => {
		expect(getTokenAtCursor("is:new prop:reps>5", 4)).toEqual({
			token: "is:new",
			start: 0,
			end: 6,
		});
	});

	it("extracts token when cursor is at token start", () => {
		expect(getTokenAtCursor("is:new prop:la", 7)).toEqual({
			token: "prop:la",
			start: 7,
			end: 14,
		});
	});

	it("returns empty token when cursor is at a space between tokens", () => {
		const result = getTokenAtCursor("is:new  prop:la", 7);
		expect(result.token).toBe("");
	});

	it("handles quoted strings", () => {
		const input = 'note:"Biology 101" is:new';
		const result = getTokenAtCursor(input, 10);
		expect(result.token).toBe('note:"Biology 101"');
		expect(result.start).toBe(0);
		expect(result.end).toBe(18);
	});

	it("handles cursor inside a quoted string", () => {
		const input = 'note:"Bio" is:new';
		const result = getTokenAtCursor(input, 8);
		expect(result.token).toBe('note:"Bio"');
		expect(result.start).toBe(0);
	});

	it("handles negative cursor position gracefully", () => {
		const result = getTokenAtCursor("is:new", -1);
		expect(result.token).toBe("");
	});

	it("handles cursor past end of input", () => {
		const result = getTokenAtCursor("is:new", 100);
		expect(result.token).toBe("is:new");
	});
});

describe("getTokenContext", () => {
	it("returns prefix context for empty token", () => {
		const ctx = getTokenContext({ token: "", start: 0, end: 0 });
		expect(ctx.type).toBe("prefix");
		expect(ctx.partial).toBe("");
		expect(ctx.negated).toBe(false);
	});

	it("detects is: prefix", () => {
		const ctx = getTokenContext({ token: "is:ne", start: 0, end: 5 });
		expect(ctx.type).toBe("is");
		expect(ctx.partial).toBe("ne");
		expect(ctx.negated).toBe(false);
	});

	it("detects negated is: prefix", () => {
		const ctx = getTokenContext({ token: "-is:sus", start: 0, end: 7 });
		expect(ctx.type).toBe("is");
		expect(ctx.partial).toBe("sus");
		expect(ctx.negated).toBe(true);
	});

	it("detects prop: prefix", () => {
		const ctx = getTokenContext({ token: "prop:la", start: 0, end: 7 });
		expect(ctx.type).toBe("prop");
		expect(ctx.partial).toBe("la");
	});

	it("detects note: prefix", () => {
		const ctx = getTokenContext({ token: "note:", start: 0, end: 5 });
		expect(ctx.type).toBe("note");
		expect(ctx.partial).toBe("");
	});

	it("detects project: prefix", () => {
		const ctx = getTokenContext({
			token: 'project:"Med',
			start: 0,
			end: 12,
		});
		expect(ctx.type).toBe("project");
		expect(ctx.partial).toBe("med");
	});

	it("detects preset: prefix", () => {
		const ctx = getTokenContext({ token: "preset:Hard", start: 0, end: 11 });
		expect(ctx.type).toBe("preset");
		expect(ctx.partial).toBe("hard");
	});

	it("detects type: prefix", () => {
		const ctx = getTokenContext({ token: "type:cl", start: 0, end: 7 });
		expect(ctx.type).toBe("type");
		expect(ctx.partial).toBe("cl");
	});

	it("detects via: prefix", () => {
		const ctx = getTokenContext({ token: "via:ai", start: 0, end: 6 });
		expect(ctx.type).toBe("via");
		expect(ctx.partial).toBe("ai");
	});

	it("detects added: date prefix", () => {
		const ctx = getTokenContext({ token: "added:7", start: 0, end: 7 });
		expect(ctx.type).toBe("date");
		expect(ctx.partial).toBe("7");
	});

	it("detects reviewed: date prefix", () => {
		const ctx = getTokenContext({
			token: "reviewed:",
			start: 0,
			end: 9,
		});
		expect(ctx.type).toBe("date");
		expect(ctx.partial).toBe("");
	});

	it("returns prefix context for partial prefix without colon", () => {
		const ctx = getTokenContext({ token: "pr", start: 0, end: 2 });
		expect(ctx.type).toBe("prefix");
		expect(ctx.partial).toBe("pr");
	});

	it("returns text context for unknown prefix", () => {
		const ctx = getTokenContext({ token: "foo:bar", start: 0, end: 7 });
		expect(ctx.type).toBe("text");
	});
});

describe("buildStaticSuggestions", () => {
	it("returns all top-level prefixes for empty prefix", () => {
		const ctx = getTokenContext({ token: "", start: 0, end: 0 });
		const suggestions = buildStaticSuggestions(ctx);
		expect(suggestions.length).toBe(9);
		expect(suggestions.map((s) => s.label)).toContain("is:");
		expect(suggestions.map((s) => s.label)).toContain("prop:");
		expect(suggestions.map((s) => s.label)).toContain("note:");
	});

	it("filters prefixes by partial", () => {
		const ctx = getTokenContext({ token: "pr", start: 0, end: 2 });
		const suggestions = buildStaticSuggestions(ctx);
		expect(suggestions.map((s) => s.label)).toContain("prop:");
		expect(suggestions.map((s) => s.label)).toContain("project:");
		expect(suggestions.map((s) => s.label)).toContain("preset:");
		expect(suggestions.map((s) => s.label)).not.toContain("is:");
	});

	it("returns state suggestions for is: prefix", () => {
		const ctx = getTokenContext({ token: "is:", start: 0, end: 3 });
		const suggestions = buildStaticSuggestions(ctx);
		expect(suggestions.length).toBe(8);
		expect(suggestions.map((s) => s.label)).toContain("is:new");
		expect(suggestions.map((s) => s.label)).toContain("is:due");
	});

	it("filters state suggestions by partial", () => {
		const ctx = getTokenContext({ token: "is:ne", start: 0, end: 5 });
		const suggestions = buildStaticSuggestions(ctx);
		expect(suggestions.length).toBe(1);
		expect(suggestions[0]?.label).toBe("is:new");
	});

	it("returns negated state suggestions", () => {
		const ctx = getTokenContext({ token: "-is:sus", start: 0, end: 7 });
		const suggestions = buildStaticSuggestions(ctx);
		expect(suggestions.length).toBe(1);
		expect(suggestions[0]?.label).toBe("-is:suspended");
	});

	it("returns property suggestions for prop: prefix", () => {
		const ctx = getTokenContext({ token: "prop:", start: 0, end: 5 });
		const suggestions = buildStaticSuggestions(ctx);
		expect(suggestions.length).toBe(6);
		expect(suggestions.map((s) => s.label)).toContain("prop:s>");
	});

	it("filters property suggestions by partial", () => {
		const ctx = getTokenContext({ token: "prop:la", start: 0, end: 7 });
		const suggestions = buildStaticSuggestions(ctx);
		expect(suggestions.length).toBe(1);
		expect(suggestions[0]?.label).toBe("prop:lapses>");
	});

	it("returns type suggestions for type: prefix", () => {
		const ctx = getTokenContext({ token: "type:", start: 0, end: 5 });
		const suggestions = buildStaticSuggestions(ctx);
		expect(suggestions.length).toBe(4);
		expect(suggestions.map((s) => s.label)).toContain("type:cloze");
	});

	it("returns via suggestions for via: prefix", () => {
		const ctx = getTokenContext({ token: "via:", start: 0, end: 4 });
		const suggestions = buildStaticSuggestions(ctx);
		expect(suggestions.length).toBe(3);
	});

	it("returns date suggestions for added: prefix", () => {
		const ctx = getTokenContext({ token: "added:", start: 0, end: 6 });
		const suggestions = buildStaticSuggestions(ctx);
		expect(suggestions.length).toBe(6);
		expect(suggestions.map((s) => s.label)).toContain("added:7");
		expect(suggestions.map((s) => s.label)).toContain("added:30");
	});

	it("returns empty array for note: context (dynamic)", () => {
		const ctx = getTokenContext({ token: "note:Bio", start: 0, end: 8 });
		const suggestions = buildStaticSuggestions(ctx);
		expect(suggestions).toEqual([]);
	});

	it("returns empty array for project: context (dynamic)", () => {
		const ctx = getTokenContext({
			token: "project:",
			start: 0,
			end: 8,
		});
		const suggestions = buildStaticSuggestions(ctx);
		expect(suggestions).toEqual([]);
	});

	it("returns empty array for unknown text context", () => {
		const ctx = getTokenContext({ token: "foo:bar", start: 0, end: 7 });
		const suggestions = buildStaticSuggestions(ctx);
		expect(suggestions).toEqual([]);
	});
});

describe("replaceTokenAtCursor", () => {
	it("replaces token at the end of input", () => {
		const result = replaceTokenAtCursor("is:ne", 5, "is:new");
		expect(result.text).toBe("is:new ");
		expect(result.cursor).toBe(7);
	});

	it("replaces token in the middle of input", () => {
		const result = replaceTokenAtCursor(
			"is:new prop:la type:cloze",
			14,
			"prop:lapses>",
		);
		expect(result.text).toBe("is:new prop:lapses> type:cloze");
	});

	it("replaces first token in multi-token input", () => {
		const result = replaceTokenAtCursor("is:ne prop:s>5", 5, "is:new");
		expect(result.text).toBe("is:new prop:s>5");
	});

	it("handles empty input", () => {
		const result = replaceTokenAtCursor("", 0, "is:new");
		expect(result.text).toBe("is:new ");
	});

	it("preserves text before and after the token", () => {
		const result = replaceTokenAtCursor("hello wo world", 8, "wonderful");
		expect(result.text).toBe("hello wonderful world");
	});

	it("adds trailing space when replacing at end", () => {
		const result = replaceTokenAtCursor("is:", 3, "is:new");
		expect(result.text).toBe("is:new ");
	});

	it("returns correct cursor position after replacement", () => {
		const result = replaceTokenAtCursor("is:ne", 5, "is:new");
		// "is:new " — cursor should be at position 7 (after the space)
		expect(result.cursor).toBe(7);
	});
});
