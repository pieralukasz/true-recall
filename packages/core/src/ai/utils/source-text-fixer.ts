import type { ParsedBlock } from "../../flashcard/parsing/block-parser.service";

const MD_INLINE_RE =
	/\*{1,3}|_{1,3}|~~|==|`{1,3}|\[([^\]]*)\]\([^)]*\)|!\[([^\]]*)\]\([^)]*\)/g;

const MD_LINE_PREFIX_RE = /^(?:#{1,6}\s+|[-*+]\s+|\d+[.)]\s+|>\s+)/gm;

function stripMarkdown(text: string): string {
	return text
		.replace(MD_INLINE_RE, (_match, linkText, altText) => {
			if (linkText !== undefined) return linkText as string;
			if (altText !== undefined) return altText as string;
			return "";
		})
		.replace(MD_LINE_PREFIX_RE, "");
}

interface PositionMap {
	stripped: string;
	toOriginal: number[];
}

function charAt(text: string, i: number): string {
	return text.charAt(i);
}

function buildPositionMap(text: string): PositionMap {
	const chars: string[] = [];
	const toOriginal: number[] = [];

	let i = 0;
	const len = text.length;

	while (i < len) {
		const ch = charAt(text, i);

		// Line-start prefixes: headings, list markers, blockquotes
		if (i === 0 || charAt(text, i - 1) === "\n") {
			const rest = text.slice(i);
			const prefixMatch = rest.match(/^(?:#{1,6}\s+|[-*+]\s+|\d+[.)]\s+|>\s+)/);
			if (prefixMatch) {
				i += prefixMatch[0].length;
				continue;
			}
		}

		// Images: ![alt](url) → keep alt text
		if (ch === "!" && charAt(text, i + 1) === "[") {
			const closeBracket = text.indexOf("]", i + 2);
			if (closeBracket !== -1 && charAt(text, closeBracket + 1) === "(") {
				const closeParen = text.indexOf(")", closeBracket + 2);
				if (closeParen !== -1) {
					for (let j = i + 2; j < closeBracket; j++) {
						chars.push(charAt(text, j));
						toOriginal.push(j);
					}
					i = closeParen + 1;
					continue;
				}
			}
		}

		// Links: [text](url) → keep text
		if (ch === "[") {
			const closeBracket = text.indexOf("]", i + 1);
			if (closeBracket !== -1 && charAt(text, closeBracket + 1) === "(") {
				const closeParen = text.indexOf(")", closeBracket + 2);
				if (closeParen !== -1) {
					for (let j = i + 1; j < closeBracket; j++) {
						chars.push(charAt(text, j));
						toOriginal.push(j);
					}
					i = closeParen + 1;
					continue;
				}
			}
		}

		// Inline markers: **, *, ***, __, _, ___, ~~, ==
		if (ch === "*" || ch === "_" || ch === "~" || ch === "=") {
			let end = i + 1;
			while (end < len && charAt(text, end) === ch && end - i < 3) end++;
			if (
				(ch === "~" && end - i === 2) ||
				(ch === "=" && end - i === 2) ||
				ch === "*" ||
				ch === "_"
			) {
				i = end;
				continue;
			}
		}

		// Backtick code spans
		if (ch === "`") {
			let end = i + 1;
			while (end < len && charAt(text, end) === "`") end++;
			i = end;
			continue;
		}

		chars.push(ch);
		toOriginal.push(i);
		i++;
	}

	return { stripped: chars.join(""), toOriginal };
}

export function fixSourceText(
	sourceText: string,
	inputText: string,
): string | undefined {
	if (!sourceText) return undefined;

	// 1. Exact match — ideal case
	if (inputText.includes(sourceText)) return sourceText;

	// 2. Try with trimmed whitespace variants
	const trimmed = sourceText.trim();
	if (trimmed !== sourceText && inputText.includes(trimmed)) return trimmed;

	// 3. Markdown-aware fuzzy match
	const strippedSource = stripMarkdown(trimmed);
	if (!strippedSource) return undefined;

	const inputMap = buildPositionMap(inputText);
	const idx = inputMap.stripped.indexOf(strippedSource);
	if (idx === -1) return undefined;

	// Map back to original positions
	const origStart = inputMap.toOriginal[idx];
	const lastIdx = idx + strippedSource.length - 1;
	const origEnd = inputMap.toOriginal[lastIdx];
	if (origStart === undefined || origEnd === undefined) return undefined;

	const isMarkdownChar = (ch: string) =>
		ch === "*" || ch === "_" || ch === "~" || ch === "=" || ch === "`";

	// Extend backward to include any leading markdown markers
	let start = origStart;
	while (start > 0 && isMarkdownChar(charAt(inputText, start - 1))) {
		start--;
	}

	// Extend forward to include any trailing markdown markers
	let end = origEnd + 1;
	while (end < inputText.length && isMarkdownChar(charAt(inputText, end))) {
		end++;
	}

	return inputText.slice(start, end);
}

export function fixBlockSourceTexts(
	blocks: ParsedBlock[],
	inputText: string,
): void {
	for (const block of blocks) {
		if (block.sourceText) {
			block.sourceText = fixSourceText(block.sourceText, inputText);
		}
	}
}
