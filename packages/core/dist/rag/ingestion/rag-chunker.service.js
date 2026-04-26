import { filterContent } from "@true-recall/core/ai/parsing/markdown-chunker";
import { preprocessDailyNote, } from "./daily-note-preprocessor";
const TARGET_TOKENS = 400;
const OVERLAP_TOKENS = 50;
const HEADING_RE = /^(#{1,6})\s+(.+)$/;
// English text averages ~1.3 tokens per whitespace-delimited word for GPT-style tokenizers
function estimateTokens(text) {
    const trimmed = text.trim();
    if (!trimmed)
        return 0;
    return Math.ceil(trimmed.split(/\s+/).length * 1.3);
}
function buildBreadcrumb(stack) {
    return stack.map((h) => h.text).join(" > ");
}
function splitParagraphsWithOverlap(text, targetTokens, baseBreadcrumb, startIndex) {
    var _a;
    const paragraphs = text.split(/\n\n+/);
    const chunks = [];
    let buffer = [];
    let bufferTokens = 0;
    let overlapBuffer = [];
    for (const para of paragraphs) {
        const paraTokens = estimateTokens(para);
        if (bufferTokens > 0 && bufferTokens + paraTokens > targetTokens) {
            const content = buffer.join("\n\n");
            chunks.push({
                content,
                headingBreadcrumb: baseBreadcrumb || `Part ${chunks.length + startIndex + 1}`,
                index: chunks.length + startIndex,
                tokenCount: bufferTokens,
            });
            // Build overlap from the tail of the current buffer
            overlapBuffer = [];
            let overlapTokenCount = 0;
            for (let i = buffer.length - 1; i >= 0; i--) {
                const item = (_a = buffer[i]) !== null && _a !== void 0 ? _a : "";
                const t = estimateTokens(item);
                if (overlapTokenCount + t > OVERLAP_TOKENS)
                    break;
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
            headingBreadcrumb: baseBreadcrumb || `Part ${chunks.length + startIndex + 1}`,
            index: chunks.length + startIndex,
            tokenCount: bufferTokens,
        });
    }
    return chunks;
}
function chunkFiltered(text) {
    var _a, _b;
    const totalTokens = estimateTokens(text);
    if (totalTokens <= TARGET_TOKENS) {
        return [
            {
                content: text,
                headingBreadcrumb: "",
                index: 0,
                tokenCount: totalTokens,
            },
        ];
    }
    const lines = text.split("\n");
    const sections = [];
    const headingStack = [];
    let currentLines = [];
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
            if (!hashes || !headingText)
                continue;
            const level = hashes.length;
            while (headingStack.length > 0 &&
                ((_b = (_a = headingStack.at(-1)) === null || _a === void 0 ? void 0 : _a.level) !== null && _b !== void 0 ? _b : 0) >= level) {
                headingStack.pop();
            }
            headingStack.push({ level, text: headingText.trim() });
            currentLines = [line];
            currentTokens = estimateTokens(line);
        }
        else {
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
        return splitParagraphsWithOverlap(text, TARGET_TOKENS, "", 0);
    }
    const chunks = [];
    let accLines = [];
    let accTokens = 0;
    let accStack = [];
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
            const subChunks = splitParagraphsWithOverlap(section.lines.join("\n"), TARGET_TOKENS, breadcrumb, chunks.length);
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
export function chunkNote(rawContent) {
    const filtered = filterContent(rawContent);
    if (!filtered)
        return [];
    return chunkFiltered(filtered);
}
export function chunkDailyNote(rawContent, dailyInfo, excludeHeadings) {
    const filtered = filterContent(rawContent);
    const preprocessed = preprocessDailyNote(filtered, dailyInfo, excludeHeadings);
    if (!preprocessed)
        return [];
    return chunkFiltered(preprocessed);
}
export function chunkFlashcard(fieldsJson, sourceText, tags) {
    let content = "";
    try {
        const fields = JSON.parse(fieldsJson);
        const parts = [];
        if (fields.front)
            parts.push(`Q: ${fields.front}`);
        if (fields.back)
            parts.push(`A: ${fields.back}`);
        if (fields.text)
            parts.push(`Text: ${fields.text}`);
        if (sourceText)
            parts.push(`Source: ${sourceText}`);
        if (tags)
            parts.push(`Tags: ${tags}`);
        content = parts.join("\n");
    }
    catch (e) {
        console.warn("[True Recall RAG] Failed to parse flashcard fields, using raw JSON:", e);
        content = fieldsJson;
    }
    if (!content)
        return [];
    return [
        {
            content,
            headingBreadcrumb: "",
            index: 0,
            tokenCount: estimateTokens(content),
        },
    ];
}
