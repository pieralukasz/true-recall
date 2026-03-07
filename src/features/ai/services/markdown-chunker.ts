export interface MarkdownChunk {
	content: string;
	headingBreadcrumb: string;
	index: number;
	wordCount: number;
}

export interface ChunkingResult {
	chunks: MarkdownChunk[];
	strategy: "single" | "chunked";
	totalWords: number;
	estimatedTokens: number;
}

const SINGLE_THRESHOLD = 3000;
const TARGET_CHUNK_WORDS = 3000;
const HEADING_RE = /^(#{1,6})\s+(.+)$/;

export function filterContent(raw: string): string {
	let text = raw;

	// Remove YAML frontmatter
	text = text.replace(/^---\n[\s\S]*?\n---\n?/, "");

	// Remove fenced code blocks (``` or ~~~)
	text = text.replace(/^(?:`{3,}|~{3,}).*\n[\s\S]*?^(?:`{3,}|~{3,})\s*$/gm, "");

	// Remove Obsidian comments (%%...%%)
	text = text.replace(/%%[\s\S]*?%%/g, "");

	// Remove HTML comments
	text = text.replace(/<!--[\s\S]*?-->/g, "");

	// Remove image embeds: ![[...]] and ![...](...)
	text = text.replace(/^!\[\[.*?\]\]\s*$/gm, "");
	text = text.replace(/^!\[.*?\]\(.*?\)\s*$/gm, "");

	// Collapse multiple blank lines to one
	text = text.replace(/\n{3,}/g, "\n\n");

	return text.trim();
}

function countWords(text: string): number {
	const trimmed = text.trim();
	if (!trimmed) return 0;
	return trimmed.split(/\s+/).length;
}

interface HeadingEntry {
	level: number;
	text: string;
}

function buildBreadcrumb(stack: HeadingEntry[]): string {
	return stack.map((h) => h.text).join(" > ");
}

function splitByParagraphs(
	text: string,
	targetWords: number,
	baseBreadcrumb: string,
	startIndex: number,
): MarkdownChunk[] {
	const paragraphs = text.split(/\n\n+/);
	const chunks: MarkdownChunk[] = [];
	let buffer: string[] = [];
	let bufferWords = 0;

	for (const para of paragraphs) {
		const paraWords = countWords(para);
		if (bufferWords > 0 && bufferWords + paraWords > targetWords) {
			const content = buffer.join("\n\n");
			const breadcrumb =
				baseBreadcrumb || `Part ${chunks.length + startIndex + 1}`;
			chunks.push({
				content,
				headingBreadcrumb: breadcrumb,
				index: chunks.length + startIndex,
				wordCount: bufferWords,
			});
			buffer = [];
			bufferWords = 0;
		}
		buffer.push(para);
		bufferWords += paraWords;
	}

	if (buffer.length > 0) {
		const content = buffer.join("\n\n");
		const breadcrumb =
			baseBreadcrumb || `Part ${chunks.length + startIndex + 1}`;
		chunks.push({
			content,
			headingBreadcrumb: breadcrumb,
			index: chunks.length + startIndex,
			wordCount: bufferWords,
		});
	}

	return chunks;
}

interface Section {
	headingStack: HeadingEntry[];
	lines: string[];
	wordCount: number;
}

export function chunkMarkdown(rawContent: string): ChunkingResult {
	const filtered = filterContent(rawContent);
	const totalWords = countWords(filtered);
	const estimatedTokens = Math.ceil(totalWords * 1.3);

	if (totalWords < SINGLE_THRESHOLD) {
		return {
			chunks: [
				{
					content: filtered,
					headingBreadcrumb: "",
					index: 0,
					wordCount: totalWords,
				},
			],
			strategy: "single",
			totalWords,
			estimatedTokens,
		};
	}

	const lines = filtered.split("\n");
	const sections: Section[] = [];
	const headingStack: HeadingEntry[] = [];
	let currentLines: string[] = [];
	let currentWordCount = 0;
	let hasHeadings = false;

	for (const line of lines) {
		const match = HEADING_RE.exec(line);
		if (match) {
			hasHeadings = true;
			// Finalize current section if it has content
			if (currentLines.length > 0 && currentWordCount > 0) {
				sections.push({
					headingStack: [...headingStack],
					lines: currentLines,
					wordCount: currentWordCount,
				});
			}

			// Update heading stack
			const level = match[1]?.length;
			const text = match[2]?.trim();
			while (
				headingStack.length > 0 &&
				headingStack[headingStack.length - 1]?.level >= level
			) {
				headingStack.pop();
			}
			headingStack.push({ level, text });

			currentLines = [line];
			currentWordCount = countWords(line);
		} else {
			currentLines.push(line);
			currentWordCount += countWords(line);
		}
	}

	// Finalize last section
	if (currentLines.length > 0 && currentWordCount > 0) {
		sections.push({
			headingStack: [...headingStack],
			lines: currentLines,
			wordCount: currentWordCount,
		});
	}

	// No headings: split by paragraphs
	if (!hasHeadings) {
		const chunks = splitByParagraphs(filtered, TARGET_CHUNK_WORDS, "", 0);
		return { chunks, strategy: "chunked", totalWords, estimatedTokens };
	}

	// Greedy accumulation: headings are soft break hints, not hard splits.
	// Accumulate sections until adding the next would exceed TARGET_CHUNK_WORDS.
	const chunks: MarkdownChunk[] = [];
	let accLines: string[] = [];
	let accWords = 0;
	let accStack: HeadingEntry[] = [];

	for (const section of sections) {
		// Would adding this section exceed target?
		if (accWords > 0 && accWords + section.wordCount > TARGET_CHUNK_WORDS) {
			flushAccumulator(accLines, accWords, accStack, chunks);
			accLines = [];
			accWords = 0;
		}

		// Single oversized section: split by paragraphs
		if (accWords === 0 && section.wordCount > TARGET_CHUNK_WORDS * 1.5) {
			const breadcrumb = buildBreadcrumb(section.headingStack);
			const subChunks = splitByParagraphs(
				section.lines.join("\n"),
				TARGET_CHUNK_WORDS,
				breadcrumb,
				chunks.length,
			);
			chunks.push(...subChunks);
			continue;
		}

		accLines.push(...section.lines);
		accWords += section.wordCount;
		accStack = section.headingStack;
	}

	if (accWords > 0) {
		flushAccumulator(accLines, accWords, accStack, chunks);
	}

	return { chunks, strategy: "chunked", totalWords, estimatedTokens };
}

function flushAccumulator(
	lines: string[],
	wordCount: number,
	headingStack: HeadingEntry[],
	chunks: MarkdownChunk[],
): void {
	chunks.push({
		content: lines.join("\n"),
		headingBreadcrumb: buildBreadcrumb(headingStack),
		index: chunks.length,
		wordCount,
	});
}
