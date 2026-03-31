const SINGLE_THRESHOLD = 3000;
const TARGET_CHUNK_WORDS = 3000;
const HEADING_RE = /^(#{1,6})\s+(.+)$/;
export function filterContent(raw) {
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
function countWords(text) {
    const trimmed = text.trim();
    if (!trimmed)
        return 0;
    return trimmed.split(/\s+/).length;
}
function buildBreadcrumb(stack) {
    return stack.map((h) => h.text).join(" > ");
}
function splitByParagraphs(text, targetWords, baseBreadcrumb, startIndex) {
    const paragraphs = text.split(/\n\n+/);
    const chunks = [];
    let buffer = [];
    let bufferWords = 0;
    for (const para of paragraphs) {
        const paraWords = countWords(para);
        if (bufferWords > 0 && bufferWords + paraWords > targetWords) {
            const content = buffer.join("\n\n");
            const breadcrumb = baseBreadcrumb || `Part ${chunks.length + startIndex + 1}`;
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
        const breadcrumb = baseBreadcrumb || `Part ${chunks.length + startIndex + 1}`;
        chunks.push({
            content,
            headingBreadcrumb: breadcrumb,
            index: chunks.length + startIndex,
            wordCount: bufferWords,
        });
    }
    return chunks;
}
export function chunkMarkdown(rawContent) {
    var _a, _b;
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
    const sections = [];
    const headingStack = [];
    let currentLines = [];
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
            const [, hashes, headingText] = match;
            if (!hashes || !headingText)
                continue;
            const level = hashes.length;
            const text = headingText.trim();
            while (headingStack.length > 0 &&
                ((_b = (_a = headingStack.at(-1)) === null || _a === void 0 ? void 0 : _a.level) !== null && _b !== void 0 ? _b : 0) >= level) {
                headingStack.pop();
            }
            headingStack.push({ level, text });
            currentLines = [line];
            currentWordCount = countWords(line);
        }
        else {
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
    const chunks = [];
    let accLines = [];
    let accWords = 0;
    let accStack = [];
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
            const subChunks = splitByParagraphs(section.lines.join("\n"), TARGET_CHUNK_WORDS, breadcrumb, chunks.length);
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
function flushAccumulator(lines, wordCount, headingStack, chunks) {
    chunks.push({
        content: lines.join("\n"),
        headingBreadcrumb: buildBreadcrumb(headingStack),
        index: chunks.length,
        wordCount,
    });
}
