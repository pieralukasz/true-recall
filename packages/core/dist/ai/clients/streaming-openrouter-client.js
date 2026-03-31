import { __asyncGenerator, __asyncValues, __await } from "tslib";
import { buildOpenRouterHeaders, OPENROUTER_URL, } from "./openrouter-client";
export class StreamingOpenRouterClient {
    constructor(apiKey, model, httpClient, baseUrl = OPENROUTER_URL, userId) {
        this.apiKey = apiKey;
        this.model = model;
        this.httpClient = httpClient;
        this.baseUrl = baseUrl;
        this.userId = userId;
    }
    chatStream(request, signal) {
        return __asyncGenerator(this, arguments, function* chatStream_1() {
            var _a, e_1, _b, _c;
            var _d, _e, _f;
            const headers = buildOpenRouterHeaders(this.apiKey, this.userId);
            const stream = this.httpClient.stream(this.baseUrl, Object.assign({ model: this.model, stream: true }, request), headers);
            // If signal is already aborted, throw immediately
            if (signal === null || signal === void 0 ? void 0 : signal.aborted) {
                throw new DOMException("The operation was aborted.", "AbortError");
            }
            // Set up abort listener
            let abortHandler;
            const abortPromise = signal
                ? new Promise((_, reject) => {
                    abortHandler = () => reject(new DOMException("The operation was aborted.", "AbortError"));
                    signal.addEventListener("abort", abortHandler, { once: true });
                })
                : null;
            try {
                try {
                    for (var _g = true, stream_1 = __asyncValues(stream), stream_1_1; stream_1_1 = yield __await(stream_1.next()), _a = stream_1_1.done, !_a; _g = true) {
                        _c = stream_1_1.value;
                        _g = false;
                        const sseData = _c;
                        if (signal === null || signal === void 0 ? void 0 : signal.aborted) {
                            throw new DOMException("The operation was aborted.", "AbortError");
                        }
                        // Parse SSE lines from the chunk
                        const lines = sseData.split("\n");
                        for (const line of lines) {
                            const trimmed = line.trim();
                            if (!trimmed || trimmed === "data: [DONE]")
                                continue;
                            if (!trimmed.startsWith("data: "))
                                continue;
                            try {
                                const json = JSON.parse(trimmed.slice(6));
                                const choice = (_d = json.choices) === null || _d === void 0 ? void 0 : _d[0];
                                const content = (_e = choice === null || choice === void 0 ? void 0 : choice.delta) === null || _e === void 0 ? void 0 : _e.content;
                                if (content) {
                                    yield yield __await({
                                        content,
                                        finishReason: (_f = choice.finish_reason) !== null && _f !== void 0 ? _f : null,
                                    });
                                }
                            }
                            catch (_h) {
                                // Skip malformed SSE chunks
                            }
                        }
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (!_g && !_a && (_b = stream_1.return)) yield __await(_b.call(stream_1));
                    }
                    finally { if (e_1) throw e_1.error; }
                }
            }
            finally {
                if (abortHandler && signal) {
                    signal.removeEventListener("abort", abortHandler);
                }
            }
        });
    }
}
