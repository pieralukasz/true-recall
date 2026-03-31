import { __asyncGenerator, __await, __awaiter } from "tslib";
import { requestUrl } from "obsidian";
export class ObsidianHttpClient {
    post(url, body, headers) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield requestUrl({
                url,
                method: "POST",
                headers: Object.assign({ "Content-Type": "application/json" }, headers),
                body: JSON.stringify(body),
            });
            return {
                status: response.status,
                json: response.json,
                text: response.text,
            };
        });
    }
    stream(url, body, headers) {
        return __asyncGenerator(this, arguments, function* stream_1() {
            // requestUrl does not support streaming; fall back to native fetch
            const response = yield __await(fetch(url, {
                method: "POST",
                headers: Object.assign({ "Content-Type": "application/json" }, headers),
                body: JSON.stringify(body),
            }));
            if (!response.body) {
                throw new Error(`No response body from ${url}`);
            }
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            try {
                while (true) {
                    const { done, value } = yield __await(reader.read());
                    if (done)
                        break;
                    yield yield __await(decoder.decode(value, { stream: true }));
                }
            }
            finally {
                reader.releaseLock();
            }
        });
    }
}
