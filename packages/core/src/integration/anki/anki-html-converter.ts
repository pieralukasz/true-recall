/**
 * Anki HTML → Obsidian Markdown converter.
 *
 * 4-phase pipeline:
 *   1. Extract protected regions (math, code) → placeholders
 *   2. Convert HTML tags → Markdown
 *   3. Restore protected regions with Markdown equivalents
 *   4. Cleanup (entities, whitespace)
 */

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProtectedRegion {
	placeholder: string;
	markdown: string;
}

// ─── Named HTML entities ─────────────────────────────────────────────────────

const HTML_ENTITIES: Record<string, string> = {
	"&amp;": "&",
	"&lt;": "<",
	"&gt;": ">",
	"&nbsp;": " ",
	"&quot;": '"',
	"&#39;": "'",
	"&apos;": "'",
	"&mdash;": "\u2014",
	"&ndash;": "\u2013",
	"&hellip;": "\u2026",
	"&laquo;": "\u00AB",
	"&raquo;": "\u00BB",
	"&copy;": "\u00A9",
	"&reg;": "\u00AE",
	"&trade;": "\u2122",
	"&times;": "\u00D7",
	"&divide;": "\u00F7",
	"&deg;": "\u00B0",
	"&plusmn;": "\u00B1",
	"&micro;": "\u00B5",
	"&frac12;": "\u00BD",
	"&frac14;": "\u00BC",
	"&frac34;": "\u00BE",
};

const NAMED_ENTITY_REGEX = new RegExp(
	Object.keys(HTML_ENTITIES).join("|"),
	"gi",
);

// ─── Main entry point ────────────────────────────────────────────────────────

export function htmlToMarkdown(html: string): string {
	if (!html) return html;

	// Phase 1: Extract protected regions
	const { text: withPlaceholders, regions } = extractProtectedRegions(html);

	// Phase 2: Convert HTML → Markdown
	let result = convertHtmlTags(withPlaceholders);

	// Phase 3: Restore protected regions
	result = restoreProtectedRegions(result, regions);

	// Phase 4: Cleanup
	result = decodeHtmlEntities(result);
	result = result.replace(/\n{3,}/g, "\n\n");

	return result.trim();
}

// ─── Phase 1: Extract protected regions ──────────────────────────────────────

function extractProtectedRegions(text: string): {
	text: string;
	regions: ProtectedRegion[];
} {
	const regions: ProtectedRegion[] = [];
	let result = text;

	function extract(
		regex: RegExp,
		toMarkdown: (match: RegExpExecArray) => string,
	): void {
		result = result.replace(regex, (...args) => {
			// Reconstruct the match array for the callback
			const fullMatch = args[0];
			const groups = args.slice(1, -2); // capture groups (exclude offset and input)
			const matchArray = [fullMatch, ...groups] as unknown as RegExpExecArray;

			const idx = regions.length;
			const placeholder = `\x00P${idx}\x00`;
			regions.push({ placeholder, markdown: toMarkdown(matchArray) });
			return placeholder;
		});
	}

	// 1. <pre> blocks — strip inner tags, wrap in code fence
	extract(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (m) => {
		const inner = stripTags(m[1] ?? "");
		return `\n\`\`\`\n${inner}\n\`\`\`\n`;
	});

	// 2. <code> inline — strip inner tags, wrap in backticks
	extract(/<code[^>]*>([\s\S]*?)<\/code>/gi, (m) => {
		const inner = stripTags(m[1] ?? "");
		return `\`${inner}\``;
	});

	// 3. Anki legacy display math [$$]...[/$$]
	extract(/\[\$\$\]([\s\S]*?)\[\/\$\$\]/g, (m) => `$$${m[1]}$$`);

	// 4. Anki legacy inline math [$]...[/$]
	extract(/\[\$\]([\s\S]*?)\[\/\$\]/g, (m) => `$${m[1]}$`);

	// 5. Anki legacy general LaTeX [latex]...[/latex]
	extract(/\[latex\]([\s\S]*?)\[\/latex\]/g, (m) => `$${m[1]}$`);

	// 6. Existing $$...$$ (passthrough, protect from processing) — must come before single $
	extract(/\$\$([\s\S]+?)\$\$/g, (m) => `$$${m[1]}$$`);

	// 7. MathJax display \[...\]
	extract(/\\\[([\s\S]*?)\\\]/g, (m) => `$$${m[1]}$$`);

	// 8. MathJax inline \(...\)
	extract(/\\\(([\s\S]*?)\\\)/g, (m) => `$${m[1]}$`);

	// 9. Existing $...$ (passthrough) — careful not to match $$ (already extracted)
	extract(/(?<!\$)\$(?!\$)((?:[^$\\]|\\.)+)\$(?!\$)/g, (m) => `$${m[1]}$`);

	return { text: result, regions };
}

// ─── Phase 2: Convert HTML tags ──────────────────────────────────────────────

function convertHtmlTags(text: string): string {
	let result = text;

	// Line breaks
	result = result.replace(/<br\s*\/?>/gi, "\n");

	// Horizontal rules
	result = result.replace(/<hr[^>]*\/?>/gi, "\n---\n");

	// Tables (before general tag stripping)
	result = result.replace(
		/<table[^>]*>([\s\S]*?)<\/table>/gi,
		(_match, inner: string) => convertHtmlTable(inner),
	);

	// Lists (before general tag stripping)
	result = result.replace(
		/<(ol|ul)[^>]*>([\s\S]*?)<\/\1>/gi,
		(_match, tag: string, inner: string) => convertHtmlList(tag, inner),
	);

	// Bold
	result = result.replace(
		/<(?:b|strong)[^>]*>([\s\S]*?)<\/(?:b|strong)>/gi,
		"**$1**",
	);

	// Italic
	result = result.replace(/<(?:i|em)[^>]*>([\s\S]*?)<\/(?:i|em)>/gi, "*$1*");

	// Strikethrough
	result = result.replace(
		/<(?:s|del|strike)[^>]*>([\s\S]*?)<\/(?:s|del|strike)>/gi,
		"~~$1~~",
	);

	// Links
	result = result.replace(
		/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
		"[$2]($1)",
	);
	// Links without href — just keep text
	result = result.replace(/<a[^>]*>([\s\S]*?)<\/a>/gi, "$1");

	// Images → Obsidian embeds
	result = result.replace(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi, "![[$1]]");

	// Anki sound references → Obsidian embeds
	result = result.replace(/\[sound:([^\]]+)\]/g, "![[$1]]");

	// Strip closing block-level tags, add newline
	result = result.replace(/<\/(?:div|p)>/gi, "\n");
	// Strip opening block-level tags
	result = result.replace(/<(?:div|p|span)[^>]*>/gi, "");

	// Preserve <u>, <sup>, <sub> (Obsidian renders them natively)
	// Strip remaining unknown HTML tags
	result = result.replace(/<\/?(?!u\b|sup\b|sub\b)[a-z][a-z0-9]*[^>]*>/gi, "");

	return result;
}

// ─── Phase 3: Restore protected regions ──────────────────────────────────────

function restoreProtectedRegions(
	text: string,
	regions: ProtectedRegion[],
): string {
	let result = text;
	for (const region of regions) {
		// Use a function replacer to avoid $$ being interpreted as escape for $
		result = result.replace(region.placeholder, () => region.markdown);
	}
	return result;
}

// ─── Phase 4: Entity decoding ────────────────────────────────────────────────

export function decodeHtmlEntities(text: string): string {
	// Named entities
	let result = text.replace(NAMED_ENTITY_REGEX, (entity) => {
		return HTML_ENTITIES[entity.toLowerCase()] ?? entity;
	});

	// Numeric decimal entities: &#123;
	result = result.replace(/&#(\d+);/g, (_match, digits: string) => {
		const code = parseInt(digits, 10);
		return code > 0 ? String.fromCodePoint(code) : _match;
	});

	// Numeric hex entities: &#x1F600;
	result = result.replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) => {
		const code = parseInt(hex, 16);
		return code > 0 ? String.fromCodePoint(code) : _match;
	});

	return result;
}

// ─── Table conversion ────────────────────────────────────────────────────────

function convertHtmlTable(tableInner: string): string {
	const rows: string[][] = [];
	let hasHeader = false;

	const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
	for (
		let rowMatch = rowRegex.exec(tableInner);
		rowMatch !== null;
		rowMatch = rowRegex.exec(tableInner)
	) {
		const rowContent = rowMatch[1] ?? "";
		const cells: string[] = [];

		// Check for <th> first, fall back to <td>
		const isHeaderRow = /<th[\s>]/i.test(rowContent);
		if (isHeaderRow) hasHeader = true;

		const cellRegex = /<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;
		for (
			let cellMatch = cellRegex.exec(rowContent);
			cellMatch !== null;
			cellMatch = cellRegex.exec(rowContent)
		) {
			const cellText = stripTags(cellMatch[1] ?? "").trim();
			cells.push(cellText);
		}

		if (cells.length > 0) {
			rows.push(cells);
		}
	}

	if (rows.length === 0) return "";

	// Determine column count
	const colCount = Math.max(...rows.map((r) => r.length));

	const lines: string[] = [];

	if (hasHeader && rows.length > 0) {
		// First row is header
		const header = rows[0] ?? [];
		lines.push(`| ${padRow(header, colCount).join(" | ")} |`);
		lines.push(`| ${Array(colCount).fill("---").join(" | ")} |`);

		for (let i = 1; i < rows.length; i++) {
			const row = rows[i];
			if (row) lines.push(`| ${padRow(row, colCount).join(" | ")} |`);
		}
	} else {
		// No header — generate empty header + separator for valid GFM
		lines.push(`| ${Array(colCount).fill(" ").join(" | ")} |`);
		lines.push(`| ${Array(colCount).fill("---").join(" | ")} |`);

		for (const row of rows) {
			lines.push(`| ${padRow(row, colCount).join(" | ")} |`);
		}
	}

	return `\n${lines.join("\n")}\n`;
}

function padRow(cells: string[], colCount: number): string[] {
	const padded = [...cells];
	while (padded.length < colCount) {
		padded.push("");
	}
	return padded;
}

// ─── List conversion ─────────────────────────────────────────────────────────

function convertHtmlList(tag: string, inner: string): string {
	const items = parseListItems(inner);
	const lines = renderListItems(items, tag.toLowerCase() === "ol", 0);
	return `\n${lines.join("\n")}\n`;
}

interface ListItem {
	content: string;
	nestedList?: { tag: string; items: ListItem[] };
}

function parseListItems(html: string): ListItem[] {
	const items: ListItem[] = [];

	// Split on top-level <li> boundaries by tracking depth
	const liContents = extractTopLevelLiContents(html);

	for (const liContent of liContents) {
		let content = liContent;
		let nestedList: ListItem["nestedList"] | undefined;

		// Check for nested list
		const nestedMatch = /<(ol|ul)[^>]*>([\s\S]*?)<\/\1>/i.exec(content);
		if (nestedMatch) {
			content = content.replace(nestedMatch[0], "").trim();
			nestedList = {
				tag: nestedMatch[1] ?? "ul",
				items: parseListItems(nestedMatch[2] ?? ""),
			};
		}

		const text = stripTags(content).trim();
		items.push({ content: text, nestedList });
	}

	return items;
}

function extractTopLevelLiContents(html: string): string[] {
	const contents: string[] = [];
	let pos = 0;

	while (pos < html.length) {
		// Find next top-level <li>
		const openMatch = /<li[^>]*>/gi;
		openMatch.lastIndex = pos;
		const m = openMatch.exec(html);
		if (!m) break;

		const contentStart = m.index + m[0].length;
		let depth = 1;
		let i = contentStart;

		while (i < html.length && depth > 0) {
			const remaining = html.slice(i);
			const liOpen = /^<li[\s>]/i.exec(remaining);
			const liClose = /^<\/li>/i.exec(remaining);

			if (liClose && liClose.index === 0) {
				depth--;
				if (depth === 0) break;
				i += 5;
			} else if (liOpen && liOpen.index === 0) {
				depth++;
				const fullOpen = /<li[^>]*>/i.exec(remaining);
				i += fullOpen ? fullOpen[0].length : 3;
			} else {
				i++;
			}
		}

		contents.push(html.slice(contentStart, i));
		// Skip past the closing </li>
		pos = i + 5;
	}

	return contents;
}

function renderListItems(
	items: ListItem[],
	ordered: boolean,
	depth: number,
): string[] {
	const lines: string[] = [];
	const indent = "  ".repeat(depth);

	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		if (!item) continue;
		const bullet = ordered ? `${i + 1}.` : "-";
		lines.push(`${indent}${bullet} ${item.content}`);

		if (item.nestedList) {
			const nestedOrdered = item.nestedList.tag.toLowerCase() === "ol";
			lines.push(
				...renderListItems(item.nestedList.items, nestedOrdered, depth + 1),
			);
		}
	}

	return lines;
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function stripTags(html: string): string {
	return html.replace(/<[^>]+>/g, "");
}
