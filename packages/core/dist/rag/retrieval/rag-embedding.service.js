import { __awaiter } from "tslib";
import { AIRequestError, buildOpenRouterHeaders, } from "@true-recall/core/ai/clients/openrouter-client";
import { LITELLM_EMBEDDINGS_URL, RAG_CONFIG, } from "@true-recall/core/constants";
export class RagEmbeddingServiceImpl {
    constructor(httpClient, apiKey, baseUrl = LITELLM_EMBEDDINGS_URL, model = "embedding") {
        this.httpClient = httpClient;
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
        this.model = model;
    }
    embed(texts) {
        return __awaiter(this, void 0, void 0, function* () {
            const results = [];
            for (let i = 0; i < texts.length; i += RAG_CONFIG.embeddingBatchSize) {
                const batch = texts.slice(i, i + RAG_CONFIG.embeddingBatchSize);
                const batchResults = yield this.embedBatch(batch);
                results.push(...batchResults);
            }
            return results;
        });
    }
    embedSingle(text) {
        return __awaiter(this, void 0, void 0, function* () {
            const [result] = yield this.embedBatch([text]);
            if (!result)
                throw new Error("Empty embedding result");
            return result;
        });
    }
    embedBatch(texts_1) {
        return __awaiter(this, arguments, void 0, function* (texts, retries = 3) {
            for (let attempt = 0; attempt < retries; attempt++) {
                try {
                    const response = yield this.httpClient.post(this.baseUrl, {
                        model: this.model,
                        input: texts,
                    }, buildOpenRouterHeaders(this.apiKey));
                    if (response.status !== 200) {
                        throw new AIRequestError(response.status, response.text);
                    }
                    const data = response.json;
                    const embeddings = data.data
                        .sort((a, b) => a.index - b.index)
                        .map((d) => new Float32Array(d.embedding));
                    const first = embeddings[0];
                    if (first && first.length !== RAG_CONFIG.embeddingDims) {
                        throw new Error(`Embedding dimension mismatch: expected ${RAG_CONFIG.embeddingDims}, got ${first.length}. Check the embedding model on the proxy.`);
                    }
                    return embeddings;
                }
                catch (e) {
                    if (e instanceof AIRequestError &&
                        e.isRateLimited &&
                        attempt < retries - 1) {
                        const delay = 1000 * Math.pow(2, attempt);
                        yield new Promise((r) => setTimeout(r, delay));
                        continue;
                    }
                    throw e;
                }
            }
            throw new Error("Embedding request failed after retries");
        });
    }
}
