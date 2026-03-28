import { filterContent } from "@features/ai/services/markdown-chunker";

export interface RagChunk {
	content: string;
	headingBreadcrumb: string;
	index: number;
	tokenCount: number;
}

const TARGET_TOKENS = 400;
const OVERLAP_TOKENS = 50;
const HEADING_RE = /^(#{1,6})\s+(.+)$/;

function estimateTokens(text: string): number {
	const trimmed = text.trim();
	if (!trimmed) return 0;
	return Math.ceil(trimmed.split(/\s+/).length * 1.3);
}

interface HeadingEntry {
	level: number;
	text: string;
}

function buildBreadcrumb(stack: HeadingEntry[]): string {
	return stack.map((h) => h.text).join(" > ");
}

interface Section {
	headingStack: HeadingEntry[];
	lines: string[];
	tokenCount: number;
}

function splitParagraphsWithOverlap(
	text: string,
	targetTokens: number,
	baseBreadcrumb: string,
	startIndex: number,
): RagChunk[] {
	const paragraphs = text.split(/\n\n+/);
	const chunks: RagChunk[] = [];
	let buffer: string[] = [];
	let bufferTokens = 0;
	let overlapBuffer: string[] = [];

	for (const para of paragraphs) {
		const paraTokens = estimateTokens(para);

		if (bufferTokens > 0 && bufferTokens + paraTokens > targetTokens) {
			const content = buffer.join("\n\n");
			chunks.push({
				content,
				headingBreadcrumb:
					baseBreadcrumb || `Part ${chunks.length + startIndex + 1}`,
				index: chunks.length + startIndex,
				tokenCount: bufferTokens,
			});

			// Build overlap from the tail of the current buffer
			overlapBuffer = [];
			let overlapTokenCount = 0;
			for (let i = buffer.length - 1; i >= 0; i--) {
				const item = buffer[i] ?? "";
				const t = estimateTokens(item);
				if (overlapTokenCount + t > OVERLAP_TOKENS) break;
				overlapBuffer.unshift(item);
				overlapTokenCount += t;
			}

			buffer = [...overlapBuffer];
			bufferTokens = overlapTokenCount;
		}

		buffer.push(para);
		bufferTokens += paraTokens;
	}

	if (buffer.length > 0) {
		const content = buffer.join("\n\n");
		chunks.push({
			content,
			headingBreadcrumb:
				baseBreadcrumb || `Part ${chunks.length + startIndex + 1}`,
			index: chunks.length + startIndex,
			tokenCount: bufferTokens,
		});
	}

	return chunks;
}

export function chunkNote(rawContent: string): RagChunk[] {
	const filtered = filterContent(rawContent);
	const totalTokens = estimateTokens(filtered);

	if (totalTokens <= TARGET_TOKENS) {
		return [
			{
				content: filtered,
				headingBreadcrumb: "",
				index: 0,
				tokenCount: totalTokens,
			},
		];
	}

	const lines = filtered.split("\n");
	const sections: Section[] = [];
	const headingStack: HeadingEntry[] = [];
	let currentLines: string[] = [];
	let currentTokens = 0;
	let hasHeadings = false;

	for (const line of lines) {
		const match = HEADING_RE.exec(line);
		if (match) {
			hasHeadings = true;
			if (currentLines.length > 0 && currentTokens > 0) {
				sections.push({
					headingStack: [...headingStack],
					lines: currentLines,
					tokenCount: currentTokens,
				});
			}

			const [, hashes, headingText] = match;
			if (!hashes || !headingText) continue;
			const level = hashes.length;
			while (
				headingStack.length > 0 &&
				(headingStack.at(-1)?.level ?? 0) >= level
			) {
				headingStack.pop();
			}
			headingStack.push({ level, text: headingText.trim() });

			currentLines = [line];
			currentTokens = estimateTokens(line);
		} else {
			currentLines.push(line);
			currentTokens += estimateTokens(line);
		}
	}

	if (currentLines.length > 0 && currentTokens > 0) {
		sections.push({
			headingStack: [...headingStack],
			lines: currentLines,
			tokenCount: currentTokens,
		});
	}

	if (!hasHeadings) {
		return splitParagraphsWithOverlap(filtered, TARGET_TOKENS, "", 0);
	}

	const chunks: RagChunk[] = [];
	let accLines: string[] = [];
	let accTokens = 0;
	let accStack: HeadingEntry[] = [];

	for (const section of sections) {
		if (accTokens > 0 && accTokens + section.tokenCount > TARGET_TOKENS) {
			chunks.push({
				content: accLines.join("\n"),
				headingBreadcrumb: buildBreadcrumb(accStack),
				index: chunks.length,
				tokenCount: accTokens,
			});
			accLines = [];
			accTokens = 0;
		}

		if (accTokens === 0 && section.tokenCount > TARGET_TOKENS * 1.5) {
			const breadcrumb = buildBreadcrumb(section.headingStack);
			const subChunks = splitParagraphsWithOverlap(
				section.lines.join("\n"),
				TARGET_TOKENS,
				breadcrumb,
				chunks.length,
			);
			chunks.push(...subChunks);
			continue;
		}

		accLines.push(...section.lines);
		accTokens += section.tokenCount;
		accStack = section.headingStack;
	}

	if (accTokens > 0) {
		chunks.push({
			content: accLines.join("\n"),
			headingBreadcrumb: buildBreadcrumb(accStack),
			index: chunks.length,
			tokenCount: accTokens,
		});
	}

	return chunks;
}

export function chunkFlashcard(
	fieldsJson: string,
	sourceText?: string,
	tags?: string,
): RagChunk[] {
	let content = "";
	try {
		const fields = JSON.parse(fieldsJson) as Record<string, string>;
		const parts: string[] = [];
		if (fields.front) parts.push(`Q: ${fields.front}`);
		if (fields.back) parts.push(`A: ${fields.back}`);
		if (fields.text) parts.push(`Text: ${fields.text}`);
		if (sourceText) parts.push(`Source: ${sourceText}`);
		if (tags) parts.push(`Tags: ${tags}`);
		content = parts.join("\n");
	} catch {
		content = fieldsJson;
	}

	return [
		{
			content,
			headingBreadcrumb: "",
			index: 0,
			tokenCount: estimateTokens(content),
		},
	];
}
