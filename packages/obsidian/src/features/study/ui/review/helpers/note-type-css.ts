/**
 * Note type Styling (Anki-compatible card CSS) scoped to one card container.
 *
 * The CSS is user-authored or imported from Anki decks, so it must not
 * restyle Obsidian: every selector is rewritten under a per-note-type scope
 * class, and anything that cannot be scoped or loads external resources is
 * dropped.
 *
 * Anki puts `card cardN nightMode` classes on `<body>`; the scope element plays
 * that role here. Selector compounds made only of `html`, `body`, `:root`,
 * `.card`, `.cardN`, `.nightMode` or `.night_mode` describe that root and are
 * merged into the scope element: `.card` is the scope itself, `.cardN` becomes
 * a prefixed `tr-nt-cardN` class (generic class names on the container could
 * pick up theme CSS), and night-mode classes become an Obsidian `.theme-dark`
 * ancestor so the styles follow the app theme.
 */

const NIGHT_CLASSES = new Set(["nightMode", "night_mode"]);
const CARD_N_CLASS_RE = /^card(\d+)$/;
/** Nested blocks whose rules get scoped; every other at-rule is dropped. */
const CONDITIONAL_AT_RULES = new Set(["media", "supports"]);

export interface ScopedNoteTypeCss {
	/** Class list for the card container (scope + Anki's `cardN`, prefixed). */
	className: string;
	/** Sanitised, scoped CSS; empty when nothing usable remains. */
	css: string;
}

/** Stable CSS class for a note type id. */
export function noteTypeScopeClass(noteTypeId: string): string {
	return `tr-nt-${noteTypeId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

/**
 * Anki's `.cardN` number: template ordinal + 1 for standard types, the cloze
 * number for cloze types (True Recall stores the cloze number as the ord).
 */
export function ankiCardNumber(
	templateOrd: number | undefined,
	isCloze: boolean,
): number {
	const ord = Math.max(0, templateOrd ?? 0);
	return isCloze ? Math.max(1, ord) : ord + 1;
}

/** Scope a note type's CSS to its card container. */
export function scopeNoteTypeCss(
	css: string,
	noteTypeId: string,
	cardNumber = 1,
): ScopedNoteTypeCss {
	const scope = noteTypeScopeClass(noteTypeId);
	const className = `${scope} tr-nt-card${cardNumber}`;
	const cleaned = sanitizeCss(css);
	if (!cleaned.trim()) return { className, css: "" };

	const body = scopeBlock(cleaned, `.${scope}`).trim();
	if (!body) return { className, css: "" };

	// Anki's reviewer neutralises the stock `.card { color: black;
	// background-color: white }` in night mode (body.nightMode outranks
	// .card). The higher specificity mirrors that; emitted first so an
	// explicit `.card.nightMode` rule (same specificity) still wins.
	const nightBase = `.theme-dark .${scope} { color: var(--text-normal); background-color: transparent; }`;
	return { className, css: `${nightBase}\n${body}` };
}

function sanitizeCss(css: string): string {
	return (
		stripEscapesOutsideStrings(css.replace(/\/\*[\s\S]*?\*\//g, ""))
			// @import / @charset / @namespace are statements, not blocks
			.replace(/@(?:import|charset|namespace)\b[^;{}]*;?/gi, "")
			// url() may point anywhere; only inline data: URIs are kept
			.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, (match, _q, target: string) =>
				target.trim().toLowerCase().startsWith("data:") ? match : "none",
			)
			// Other functions that take a URL string, plus legacy IE expression()
			.replace(/(?:-webkit-)?(?:image-set|src|expression)\s*\(/gi, "none(")
	);
}

/**
 * Drop backslashes outside quoted strings: CSS escapes in identifiers
 * (`u\72 l(`) would otherwise smuggle a url() past the filters above.
 * Escapes inside strings (`content: "\2022"`) are kept.
 */
function stripEscapesOutsideStrings(css: string): string {
	let out = "";
	let quote: string | null = null;
	for (let j = 0; j < css.length; j++) {
		const ch = css[j] ?? "";
		if (quote) {
			out += ch;
			if (ch === "\\") {
				out += css[j + 1] ?? "";
				j++;
			} else if (ch === quote) quote = null;
			continue;
		}
		if (ch === '"' || ch === "'") quote = ch;
		if (ch !== "\\") out += ch;
	}
	return out;
}

/**
 * Index of the next `{` or `}` outside quoted strings, or -1.
 * Strings end at an unescaped newline like CSS bad-strings, so this scanner
 * and the browser agree on where every block starts and ends.
 */
function nextBrace(css: string, from: number): number {
	let quote: string | null = null;
	for (let j = from; j < css.length; j++) {
		const ch = css[j];
		if (quote) {
			if (ch === "\\") j++;
			else if (ch === quote || ch === "\n") quote = null;
			continue;
		}
		if (ch === '"' || ch === "'") quote = ch;
		else if (ch === "{" || ch === "}") return j;
	}
	return -1;
}

function findMatchingBrace(css: string, open: number): number {
	let depth = 0;
	let j = open;
	while (j !== -1) {
		if (css[j] === "{") depth++;
		else {
			depth--;
			if (depth === 0) return j;
		}
		j = nextBrace(css, j + 1);
	}
	return -1;
}

/**
 * Keep only a rule's own declarations. Nested rules (CSS nesting) are
 * dropped: `.card { & ~ * {} }` would resolve against the scope element's
 * siblings, outside the card.
 */
function declarationsOnly(inner: string): string {
	let out = inner;
	let open = nextBrace(out, 0);
	while (open !== -1) {
		const close = out[open] === "{" ? findMatchingBrace(out, open) : open;
		const cut = Math.max(out.lastIndexOf(";", open), -1) + 1;
		out =
			close === -1
				? out.slice(0, cut)
				: out.slice(0, cut) + out.slice(close + 1);
		open = nextBrace(out, cut);
	}
	return out;
}

/** Walk a CSS block, scoping style rules and recursing into @media/@supports. */
function scopeBlock(css: string, scope: string): string {
	const out: string[] = [];
	let i = 0;
	while (i < css.length) {
		const open = nextBrace(css, i);
		if (open === -1) break;
		if (css[open] === "}") {
			// Stray closing brace: skip it, nothing before it forms a rule
			i = open + 1;
			continue;
		}
		// A prelude never spans a `;` (leftover statements are not selectors)
		const rawPrelude = css.slice(i, open);
		const prelude = rawPrelude.slice(rawPrelude.lastIndexOf(";") + 1).trim();
		const close = findMatchingBrace(css, open);
		if (close === -1) break;
		const inner = css.slice(open + 1, close);
		i = close + 1;

		if (prelude.startsWith("@")) {
			const name = /^@([a-z-]+)/i.exec(prelude)?.[1]?.toLowerCase() ?? "";
			if (CONDITIONAL_AT_RULES.has(name)) {
				const nested = scopeBlock(inner, scope).trim();
				if (nested) out.push(`${prelude} {\n${nested}\n}`);
			}
			continue;
		}

		if (!prelude) continue;
		const selectors = splitTopLevel(prelude, ",")
			.map((s) => scopeSelector(s.trim(), scope))
			.filter((s): s is string => !!s);
		if (selectors.length === 0) continue;
		out.push(`${selectors.join(", ")} {${declarationsOnly(inner)}}`);
	}
	return out.join("\n");
}

/** Split on a separator outside (), [] and quotes. */
function splitTopLevel(input: string, sep: string): string[] {
	const parts: string[] = [];
	let depth = 0;
	let quote: string | null = null;
	let start = 0;
	for (let j = 0; j < input.length; j++) {
		const ch = input[j];
		if (quote) {
			if (ch === quote) quote = null;
			continue;
		}
		if (ch === '"' || ch === "'") quote = ch;
		else if (ch === "(" || ch === "[") depth++;
		else if (ch === ")" || ch === "]") depth--;
		else if (ch === sep && depth === 0) {
			parts.push(input.slice(start, j));
			start = j + 1;
		}
	}
	parts.push(input.slice(start));
	return parts;
}

interface Compound {
	text: string;
	/** Combinator that precedes the NEXT compound (" ", ">", "+", "~"). */
	combinator: string;
}

function tokenizeSelector(selector: string): Compound[] {
	const compounds: Compound[] = [];
	let current = "";
	let depth = 0;
	let pendingCombinator = "";
	const flush = () => {
		if (current) {
			compounds.push({ text: current, combinator: "" });
			current = "";
		}
	};
	for (let j = 0; j < selector.length; j++) {
		const ch = selector[j] ?? "";
		if (ch === "(" || ch === "[") depth++;
		if (ch === ")" || ch === "]") depth--;
		if (depth === 0 && /[\s>+~]/.test(ch)) {
			if (current) {
				flush();
				pendingCombinator = " ";
			}
			if (ch !== " " && ch !== "\t" && ch !== "\n" && ch !== "\r") {
				pendingCombinator = ch;
			}
			continue;
		}
		if (!current && pendingCombinator && compounds.length > 0) {
			const last = compounds[compounds.length - 1];
			if (last) last.combinator = pendingCombinator;
			pendingCombinator = "";
		}
		current += ch;
	}
	flush();
	return compounds;
}

/**
 * Split a root compound (`body`, `.card.card2:hover`, ...) into the classes it
 * adds to the scope element and its trailing pseudo-classes/elements.
 * Returns null for anything else (other classes, ids, attributes, other tags),
 * which then stays a regular descendant compound.
 */
function parseRootCompound(
	text: string,
): { classes: string[]; night: boolean; pseudo: string } | null {
	const match =
		/^(html|body|:root)?((?:\.[a-zA-Z_][\w-]*)*)((?::{1,2}[a-zA-Z-]+(?:\([^)]*\))?)*)$/.exec(
			text,
		);
	if (!match) return null;
	const tag = match[1];
	const classes = (match[2] ?? "").split(".").filter(Boolean);
	if (!tag && classes.length === 0) return null;
	let night = false;
	const kept: string[] = [];
	for (const cls of classes) {
		const cardN = CARD_N_CLASS_RE.exec(cls);
		if (NIGHT_CLASSES.has(cls)) night = true;
		else if (cardN) kept.push(`tr-nt-card${cardN[1]}`);
		else if (cls !== "card") return null;
	}
	return { classes: kept, night, pseudo: match[3] ?? "" };
}

function scopeSelector(selector: string, scope: string): string | null {
	if (!selector) return null;
	const compounds = tokenizeSelector(selector);
	if (compounds.length === 0) return null;

	const rootClasses: string[] = [];
	let night = false;
	let pseudo = "";
	let consumed = 0;
	for (const compound of compounds) {
		// A pseudo on an outer root compound (`body:hover .card`) cannot be
		// merged with the next one, so the chain ends there
		if (pseudo) break;
		const root = parseRootCompound(compound.text);
		if (!root) break;
		rootClasses.push(...root.classes);
		night ||= root.night;
		pseudo = root.pseudo;
		consumed++;
		// Only descendant/child chains stay on the root; siblings of <body> do not exist
		if (compound.combinator !== " " && compound.combinator !== ">") break;
	}

	const rest = compounds.slice(consumed);
	if (consumed > 0 && rest.length > 0) {
		// A root compound followed by a sibling combinator cannot match anything
		const joiner = compounds[consumed - 1]?.combinator ?? " ";
		if (joiner !== " " && joiner !== ">") return null;
	}

	const unique = [...new Set(rootClasses)];
	const rootSelector = `${night ? ".theme-dark " : ""}${scope}${unique.map((c) => `.${c}`).join("")}${pseudo}`;
	if (rest.length === 0) return rootSelector;

	const joiner =
		consumed > 0 ? (compounds[consumed - 1]?.combinator ?? " ") : " ";
	return `${rootSelector}${joiner === ">" ? " > " : " "}${joinCompounds(rest)}`;
}

function joinCompounds(compounds: Compound[]): string {
	return compounds
		.map((c, idx) => {
			if (idx === compounds.length - 1) return c.text;
			const comb = c.combinator || " ";
			return comb === " " ? `${c.text} ` : `${c.text} ${comb} `;
		})
		.join("");
}
