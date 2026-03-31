import { __asyncDelegator, __asyncGenerator, __asyncValues, __await } from "tslib";
import { OpenRouterClient, } from "@true-recall/core/ai/clients/openrouter-client";
import { StreamingOpenRouterClient } from "@true-recall/core/ai/clients/streaming-openrouter-client";
import { LITELLM_URL } from "@true-recall/core/constants";
import { fileBasename, formatLocalDate } from "@true-recall/core/utils";
import { RAG_CHAT_TOOLS } from "@true-recall/core/rag/chat/rag-chat-tools";
function agenticPrompt() {
    const today = formatLocalDate(new Date());
    return `You are a friendly, knowledgeable study assistant with access to the user's notes, flashcards, and study data.
Today's date is ${today}.

Behavior:
- Be conversational and engaging — not a data terminal. Add brief insights, encouragement, or suggestions when relevant.
- Always call at least one tool for each new user question. Only skip tools for simple follow-up clarifications about data already visible in the conversation.
- You may call multiple tools if needed.
- Cite sources from search results using numbered references [1], [2] matching the result index numbers.
- When referencing a note by name, use Obsidian wiki-link syntax: [[Note Name]].
- If tools don't return enough info, say so clearly — do not make things up.
- Answer in the same language as the user's question.

Formatting rules (STRICT):
- When listing 2+ items, ALWAYS use markdown list syntax (- or 1.).
- Separate sections with blank lines.
- Use **bold** for key terms at the start of list items.
- Use headings (##, ###) to organize longer answers.
- Keep paragraphs short (2-4 sentences max).`;
}
const FALLBACK_PROMPT = `You are a knowledgeable assistant that answers based on the user's notes and flashcards.
Cite sources inline using numbered references like [1], [2] etc. matching the source numbers in the provided context.
When referencing a specific note by name, use Obsidian wiki-link syntax: [[Note Name]]. This creates a clickable backlink.
If context doesn't contain enough info, say so clearly — do not make things up.
Answer in the same language as the user's question.
Each source includes a modification date. When the user asks about recent or latest content, prioritize sources with newer dates.

Formatting rules (STRICT — always follow):
- When listing 2+ items, ALWAYS use markdown list syntax (- or 1.). NEVER write multiple items as plain paragraphs with just bold text.
  WRONG: "**Item:** description.\\n**Item2:** description."
  RIGHT: "- **Item:** description.\\n- **Item2:** description."
- Separate sections with blank lines.
- Use **bold** for key terms at the start of list items.
- Use headings (##, ###) to organize longer answers.
- Keep paragraphs short (2-4 sentences max).`;
const LENGTH_DIRECTIVES = {
    short: "Keep responses brief — 2-4 sentences, bullet points preferred.",
    medium: "",
    detailed: "Provide thorough, detailed explanations with examples when helpful.",
};
const CONTEXT_TOKEN_BUDGET = 4000;
export class RagQueryService {
    constructor(search, settings, httpClient, frontmatterIndex, toolExecutor, contextResolver) {
        this.search = search;
        this.settings = settings;
        this.httpClient = httpClient;
        this.frontmatterIndex = frontmatterIndex;
        this.toolExecutor = toolExecutor;
        this.contextResolver = contextResolver;
        this.lastSearchResults = [];
        this.lastToolCalls = [];
    }
    queryStream(question, history, attachedItems) {
        return __asyncGenerator(this, arguments, function* queryStream_1() {
            var _a;
            let attachedContext = "";
            if ((attachedItems === null || attachedItems === void 0 ? void 0 : attachedItems.length) && this.contextResolver) {
                attachedContext = yield __await(this.contextResolver(attachedItems));
            }
            const s = this.settings();
            const baseUrl = LITELLM_URL.replace("/chat/completions", "");
            const streamUrl = `${baseUrl}/chat/completions`;
            const apiKey = (_a = s.proKey) !== null && _a !== void 0 ? _a : "";
            if (this.toolExecutor) {
                yield __await(yield* __asyncDelegator(__asyncValues(this.agenticFlow(question, history, attachedContext, apiKey, streamUrl))));
            }
            else {
                yield __await(yield* __asyncDelegator(__asyncValues(this.fallbackFlow(question, history, attachedContext, apiKey, streamUrl))));
            }
        });
    }
    getLastSearchResults() {
        return this.lastSearchResults;
    }
    getLastToolCalls() {
        return this.lastToolCalls;
    }
    agenticFlow(question, history, attachedContext, apiKey, streamUrl) {
        return __asyncGenerator(this, arguments, function* agenticFlow_1() {
            var _a, e_1, _b, _c;
            var _d, _e;
            const messages = this.buildMessages(agenticPrompt(), question, history, attachedContext);
            this.lastSearchResults = [];
            this.lastToolCalls = [];
            try {
                const client = new OpenRouterClient(apiKey, "auto", this.httpClient, streamUrl);
                const response = yield __await(client.chat({
                    messages,
                    tools: RAG_CHAT_TOOLS,
                    tool_choice: "auto",
                }));
                const assistantMsg = (_d = response.choices[0]) === null || _d === void 0 ? void 0 : _d.message;
                const toolCalls = assistantMsg === null || assistantMsg === void 0 ? void 0 : assistantMsg.tool_calls;
                if ((toolCalls === null || toolCalls === void 0 ? void 0 : toolCalls.length) && assistantMsg) {
                    messages.push({
                        role: "assistant",
                        content: assistantMsg.content,
                        tool_calls: toolCalls,
                    });
                    const records = [];
                    for (const call of toolCalls) {
                        const result = yield __await(((_e = this.toolExecutor) === null || _e === void 0 ? void 0 : _e.execute(call)));
                        if (!result)
                            continue;
                        if (result.searchResults) {
                            this.lastSearchResults = result.searchResults;
                        }
                        records.push({
                            id: call.id,
                            name: call.function.name,
                            arguments: call.function.arguments,
                            result: result.content,
                        });
                        messages.push({
                            role: "tool",
                            content: result.content,
                            tool_call_id: call.id,
                        });
                    }
                    this.lastToolCalls = records;
                }
            }
            catch (_f) {
                // Tool calling failed — fall through to stream without tool results.
            }
            const streamClient = new StreamingOpenRouterClient(apiKey, "auto", this.httpClient, streamUrl);
            try {
                for (var _g = true, _h = __asyncValues(streamClient.chatStream({ messages })), _j; _j = yield __await(_h.next()), _a = _j.done, !_a; _g = true) {
                    _c = _j.value;
                    _g = false;
                    const chunk = _c;
                    yield yield __await(chunk.content);
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_g && !_a && (_b = _h.return)) yield __await(_b.call(_h));
                }
                finally { if (e_1) throw e_1.error; }
            }
        });
    }
    fallbackFlow(question, history, attachedContext, apiKey, streamUrl) {
        return __asyncGenerator(this, arguments, function* fallbackFlow_1() {
            var _a, e_2, _b, _c;
            const searchResults = yield __await(this.search.search(question));
            const packed = this.packContext(searchResults.results);
            this.lastSearchResults = packed.sourceMap;
            const ragContext = packed.context
                ? `Context from my notes and flashcards:\n\n${packed.context}`
                : "";
            const messages = this.buildMessages(FALLBACK_PROMPT, question, history, attachedContext, ragContext);
            const client = new StreamingOpenRouterClient(apiKey, "auto", this.httpClient, streamUrl);
            try {
                for (var _d = true, _e = __asyncValues(client.chatStream({ messages })), _f; _f = yield __await(_e.next()), _a = _f.done, !_a; _d = true) {
                    _c = _f.value;
                    _d = false;
                    const chunk = _c;
                    yield yield __await(chunk.content);
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (!_d && !_a && (_b = _e.return)) yield __await(_b.call(_e));
                }
                finally { if (e_2) throw e_2.error; }
            }
        });
    }
    packContext(results) {
        var _a;
        const groups = new Map();
        for (const r of results) {
            let key;
            let label;
            if (r.sourceType === "note") {
                key = r.sourceId;
                label = fileBasename(r.sourceId);
            }
            else if (r.sourceNoteUid && this.frontmatterIndex) {
                const notePath = this.frontmatterIndex.getFileByValue("flashcard_uid", r.sourceNoteUid);
                key = notePath !== null && notePath !== void 0 ? notePath : `fc:${r.sourceId}`;
                label = notePath ? fileBasename(notePath) : "Flashcards";
            }
            else {
                key = `fc:${r.sourceId}`;
                label = "Flashcard";
            }
            const existing = groups.get(key);
            if (existing) {
                existing.chunks.push(r);
                existing.totalTokens += r.tokenCount;
                if (r.modifiedAt) {
                    existing.modifiedAt = Math.max((_a = existing.modifiedAt) !== null && _a !== void 0 ? _a : 0, r.modifiedAt);
                }
            }
            else {
                groups.set(key, {
                    label,
                    chunks: [r],
                    totalTokens: r.tokenCount,
                    modifiedAt: r.modifiedAt,
                });
            }
        }
        const parts = [];
        const sourceMap = [];
        let tokens = 0;
        let idx = 1;
        for (const [, group] of groups) {
            if (tokens + group.totalTokens > CONTEXT_TOKEN_BUDGET)
                break;
            const chunkTexts = group.chunks
                .map((c) => {
                const heading = c.headingBreadcrumb
                    ? `(${c.headingBreadcrumb})\n`
                    : "";
                return `${heading}${c.content}`;
            })
                .join("\n\n");
            const dateSuffix = group.modifiedAt
                ? ` (modified: ${new Date(group.modifiedAt).toISOString().slice(0, 10)})`
                : "";
            parts.push(`[${idx}] ${group.label}${dateSuffix}\n${chunkTexts}`);
            tokens += group.totalTokens;
            const representative = group.chunks[0];
            if (representative)
                sourceMap.push(representative);
            idx++;
        }
        return { context: parts.join("\n\n---\n\n"), sourceMap };
    }
    buildMessages(systemPrompt, question, history, attachedContext, ragContext) {
        var _a, _b;
        const chatConfig = this.settings().ragChatConfig;
        const promptParts = [systemPrompt];
        if (chatConfig === null || chatConfig === void 0 ? void 0 : chatConfig.customInstruction) {
            promptParts.push(`\nAdditional instructions:\n${chatConfig.customInstruction}`);
        }
        const lengthDirective = LENGTH_DIRECTIVES[(_a = chatConfig === null || chatConfig === void 0 ? void 0 : chatConfig.responseLength) !== null && _a !== void 0 ? _a : "medium"];
        if (lengthDirective) {
            promptParts.push(`\n${lengthDirective}`);
        }
        const messages = [
            { role: "system", content: promptParts.join("\n") },
        ];
        for (const turn of history.slice(-6)) {
            if (turn.role === "assistant" && ((_b = turn.toolCalls) === null || _b === void 0 ? void 0 : _b.length)) {
                messages.push({
                    role: "assistant",
                    content: null,
                    tool_calls: turn.toolCalls.map((tc) => ({
                        id: tc.id,
                        type: "function",
                        function: { name: tc.name, arguments: tc.arguments },
                    })),
                });
                for (const tc of turn.toolCalls) {
                    messages.push({
                        role: "tool",
                        content: tc.result,
                        tool_call_id: tc.id,
                    });
                }
                messages.push({ role: "assistant", content: turn.content });
            }
            else {
                messages.push({ role: turn.role, content: turn.content });
            }
        }
        const parts = [];
        if (attachedContext) {
            parts.push(`Currently viewing:\n\n${attachedContext}`);
        }
        if (ragContext) {
            parts.push(ragContext);
        }
        const userMessage = parts.length > 0
            ? `${parts.join("\n\n---\n\n")}\n\n---\n\nQuestion: ${question}`
            : question;
        messages.push({ role: "user", content: userMessage });
        return messages;
    }
}
