import { describe, expect, it } from "vitest";

import {
	ankiCardNumber,
	noteTypeScopeClass,
	scopeNoteTypeCss,
} from "../../../../../src/features/study/ui/review/helpers/note-type-css";

const ID = "nt-1";
const S = `.${noteTypeScopeClass(ID)}`;

function scoped(css: string, cardNumber = 1): string {
	return scopeNoteTypeCss(css, ID, cardNumber).css;
}

/** Rules without the always-added night-mode base line. */
function rules(css: string, cardNumber = 1): string[] {
	return scoped(css, cardNumber)
		.split("\n")
		.filter(
			(line) => line && !line.startsWith(`.theme-dark ${S} { color: var(`),
		);
}

describe("scopeNoteTypeCss", () => {
	it("returns the Anki card classes on the container", () => {
		expect(scopeNoteTypeCss("", ID, 2).className).toBe(
			`${noteTypeScopeClass(ID)} tr-nt-card2`,
		);
	});

	it("emits nothing for empty or whitespace CSS", () => {
		expect(scoped("")).toBe("");
		expect(scoped("  /* only a comment */ ")).toBe("");
	});

	it.each([
		[".card { color: red; }", `${S} { color: red; }`],
		["body { font-size: 20px; }", `${S} { font-size: 20px; }`],
		[
			".card2 .front { color: red; }",
			`${S}.tr-nt-card2 .front { color: red; }`,
		],
		[".cloze { font-weight: bold; }", `${S} .cloze { font-weight: bold; }`],
		["b, i { color: red; }", `${S} b, ${S} i { color: red; }`],
		[".card > .x { top: 0; }", `${S} > .x { top: 0; }`],
		[".card:hover { x: 1; }", `${S}:hover { x: 1; }`],
		[".card::before { x: 1; }", `${S}::before { x: 1; }`],
		[".cloze:hover { x: 1; }", `${S} .cloze:hover { x: 1; }`],
		["#qa img { x: 1; }", `${S} #qa img { x: 1; }`],
		["div.a + p { margin: 0; }", `${S} div.a + p { margin: 0; }`],
	])("scopes %s", (input, expected) => {
		expect(rules(input)).toEqual([expected]);
	});

	it("maps Anki night mode onto Obsidian's dark theme", () => {
		expect(rules(".card.nightMode { background: #333; }")).toEqual([
			`.theme-dark ${S} { background: #333; }`,
		]);
		expect(rules(".nightMode .cloze { color: cyan; }")).toEqual([
			`.theme-dark ${S} .cloze { color: cyan; }`,
		]);
	});

	it("never produces a selector that escapes the scope", () => {
		const css = [
			".workspace { display: none; }",
			"* { color: red; }",
			"html body .card #id { x: 1; }",
			":root { --text-normal: red; }",
			"@media (max-width: 600px) { .card { font-size: 14px; } p { margin: 0 } }",
		].join("\n");
		expect(scoped(css)).toContain(`${S} * { color: red; }`);
		expect(scoped(css)).toContain(`${S} { --text-normal: red; }`);
		const selectors = scoped(css)
			.split("\n")
			.filter((l) => l.includes("{") && !l.startsWith("@") && l !== "}")
			.flatMap((l) => (l.split("{")[0] ?? "").split(","));

		expect(selectors.length).toBeGreaterThan(0);
		for (const sel of selectors) {
			expect(
				sel.trim().startsWith(S) || sel.trim().startsWith(`.theme-dark ${S}`),
			).toBe(true);
		}
		expect(scoped(css)).toContain(`@media (max-width: 600px) {`);
	});

	it("drops @import, @font-face, @keyframes and external url()", () => {
		const out = scoped(
			[
				'@import url("https://evil.test/x.css");',
				'@import "local.css";',
				"@font-face { font-family: X; src: url(https://evil.test/f.woff); }",
				"@keyframes spin { from { opacity: 0 } to { opacity: 1 } }",
				".card { background: url('https://evil.test/p.png') no-repeat; }",
				".a { background-image: u\\72 l(https://evil.test/q.png); }",
				'.b { background: image-set("https://evil.test/r.png" 1x); }',
			].join("\n"),
		);

		expect(out).not.toContain("evil.test/x.css");
		expect(out).not.toContain("@import");
		expect(out).not.toContain("@font-face");
		expect(out).not.toContain("@keyframes");
		expect(out).not.toMatch(/url\(\s*['"]?https/);
		expect(out).not.toMatch(/image-set\(/);
		expect(out).toContain(`${S} { background: none no-repeat; }`);
	});

	it("keeps inline data: URIs and string escapes", () => {
		const out = scoped(
			'.card { background: url(data:image/png;base64,AAAA); } .x::before { content: "\\2022"; }',
		);

		expect(out).toContain("url(data:image/png;base64,AAAA)");
		expect(out).toContain('content: "\\2022"');
	});

	it("emits the dark-theme base before user rules so .card.nightMode still wins", () => {
		const out = scoped(
			".card { color: black; } .card.nightMode { color: white; }",
		);
		const lines = out.split("\n");

		expect(lines[0]).toBe(
			`.theme-dark ${S} { color: var(--text-normal); background-color: transparent; }`,
		);
		expect(lines.at(-1)).toBe(`.theme-dark ${S} { color: white; }`);
	});
});

describe("scopeNoteTypeCss hardening", () => {
	/** Every top-level rule the browser would see must start inside the scope. */
	function expectAllScoped(css: string) {
		const out = scoped(css);
		let depth = 0;
		let prelude = "";
		let quote: string | null = null;
		for (let j = 0; j < out.length; j++) {
			const ch = out[j] ?? "";
			if (quote) {
				if (ch === "\\") j++;
				else if (ch === quote || ch === "\n") quote = null;
				continue;
			}
			if (ch === '"' || ch === "'") quote = ch;
			if (ch === "{") {
				const sel = prelude.trim();
				if (depth === 0 && !sel.startsWith("@")) {
					for (const part of sel.split(",")) {
						expect(
							part.trim().startsWith(S) ||
								part.trim().startsWith(`.theme-dark ${S}`),
						).toBe(true);
					}
				}
				if (!sel.startsWith("@"))
					expect(depth === 0 || out.slice(0, j).includes("@media")).toBe(true);
				depth++;
				prelude = "";
			} else if (ch === "}") {
				depth--;
				prelude = "";
			} else if (ch === ";" && depth === 0) {
				prelude = "";
			} else prelude += ch;
		}
		return out;
	}

	it.each([
		['.a { content: "}"; } .workspace { display: none; }'],
		['.a { content: "{"; x: "}"; } .workspace { display: none; }'],
		["} .workspace { display: none; }"],
		[".card { & ~ * { display: none; } color: red; }"],
		[".a { .workspace & { display: none } }"],
		["@import 'x'; .workspace { display: none }"],
		['.a { content: "unterminated\n} .workspace { display: none }'],
	])("keeps %s inside the scope", (css) => {
		const out = expectAllScoped(css);
		expect(out).not.toMatch(/(^|\n)\s*\.workspace/);
	});

	it("drops nested rules but keeps the parent's declarations", () => {
		expect(rules(".card { & ~ * { display: none; } color: red; }")).toEqual([
			`${S} { color: red; }`,
		]);
	});
});

describe("noteTypeScopeClass", () => {
	it("makes ids safe as a class name", () => {
		expect(noteTypeScopeClass("a b.c/d")).toBe("tr-nt-a_b_c_d");
	});
});

describe("ankiCardNumber", () => {
	it.each([
		["standard ord 0", 0, false, 1],
		["standard ord 1", 1, false, 2],
		["cloze c2", 2, true, 2],
		["cloze placeholder ord 0", 0, true, 1],
	])("%s", (_label, ord, isCloze, expected) => {
		expect(ankiCardNumber(ord, isCloze)).toBe(expected);
	});
});
