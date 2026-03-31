import { __asyncGenerator, __asyncValues, __await } from "tslib";
export class RagChatService {
    constructor(queryService) {
        this.queryService = queryService;
        this.history = [];
    }
    sendMessage(message, context) {
        return __asyncGenerator(this, arguments, function* sendMessage_1() {
            var _a, e_1, _b, _c;
            const userTurn = {
                role: "user",
                content: message,
                timestamp: Date.now(),
            };
            this.history.push(userTurn);
            let fullResponse = "";
            try {
                try {
                    for (var _d = true, _e = __asyncValues(this.queryService.queryStream(message, this.history, context)), _f; _f = yield __await(_e.next()), _a = _f.done, !_a; _d = true) {
                        _c = _f.value;
                        _d = false;
                        const chunk = _c;
                        fullResponse += chunk;
                        yield yield __await(chunk);
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (!_d && !_a && (_b = _e.return)) yield __await(_b.call(_e));
                    }
                    finally { if (e_1) throw e_1.error; }
                }
                const sources = this.queryService.getLastSearchResults();
                const toolCalls = this.queryService.getLastToolCalls();
                this.history.push({
                    role: "assistant",
                    content: fullResponse,
                    sources,
                    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
                    timestamp: Date.now(),
                });
            }
            catch (e) {
                // Roll back the orphaned user turn so history stays consistent
                this.history.pop();
                throw e;
            }
        });
    }
    clearHistory() {
        this.history = [];
    }
    getHistory() {
        return [...this.history];
    }
}
