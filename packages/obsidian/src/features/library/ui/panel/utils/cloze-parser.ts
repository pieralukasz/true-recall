export interface ClozePart {
	text: string;
	isCloze: boolean;
	clozeIndex: number | null;
	isIncomplete: boolean;
}

const CLOZE_PATTERN = /\{\{c(\d+)::/g;

export function hasClozeSyntax(text: string | null): boolean {
	if (!text) return false;
	return CLOZE_PATTERN.test(text);
}

export function parseClozeText(text: string): ClozePart[] {
	const parts: ClozePart[] = [];
	let lastIndex = 0;

	const matches = Array.from(text.matchAll(CLOZE_PATTERN));

	for (const match of matches) {
		const clozeStart = match.index;
		const clozeIndex = parseInt(match[1] ?? "0", 10);
		const contentStart = clozeStart + match[0].length;

		let depth = 1;
		let contentEnd = contentStart;
		while (contentEnd < text.length && depth > 0) {
			if (text.slice(contentEnd, contentEnd + 2) === "{{") {
				depth++;
				contentEnd += 2;
			} else if (text.slice(contentEnd, contentEnd + 2) === "}}") {
				depth--;
				if (depth === 0) break;
				contentEnd += 2;
			} else {
				contentEnd++;
			}
		}

		if (clozeStart > lastIndex) {
			parts.push({
				text: text.slice(lastIndex, clozeStart),
				isCloze: false,
				clozeIndex: null,
				isIncomplete: false,
			});
		}

		const content =
			depth === 0
				? text.slice(contentStart, contentEnd)
				: text.slice(contentStart);
		const isIncomplete = depth > 0;

		parts.push({
			text: content,
			isCloze: true,
			clozeIndex,
			isIncomplete,
		});

		lastIndex = depth === 0 ? contentEnd + 2 : text.length;
	}

	if (lastIndex < text.length) {
		parts.push({
			text: text.slice(lastIndex),
			isCloze: false,
			clozeIndex: null,
			isIncomplete: false,
		});
	}

	return parts.length > 0
		? parts
		: [{ text, isCloze: false, clozeIndex: null, isIncomplete: false }];
}
