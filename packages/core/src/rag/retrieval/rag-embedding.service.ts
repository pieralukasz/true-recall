import {
	AIRequestError,
	buildOpenRouterHeaders,
} from "@true-recall/core/ai/clients/openrouter-client";
import {
	LITELLM_EMBEDDINGS_URL,
	RAG_CONFIG,
} from "@true-recall/core/constants";
import type { IHttpClient } from "@true-recall/core/interfaces/http-client";

export class RagEmbeddingServiceImpl {
	constructor(
		private httpClient: IHttpClient,
		private apiKey: string,
		private baseUrl: string = LITELLM_EMBEDDINGS_URL,
		private model: string = "embedding",
	) {}

	async embed(texts: string[]): Promise<Float32Array[]> {
		const results: Float32Array[] = [];

		for (let i = 0; i < texts.length; i += RAG_CONFIG.embeddingBatchSize) {
			const batch = texts.slice(i, i + RAG_CONFIG.embeddingBatchSize);
			const batchResults = await this.embedBatch(batch);
			results.push(...batchResults);
		}

		return results;
	}

	async embedSingle(text: string): Promise<Float32Array> {
		const [result] = await this.embedBatch([text]);
		if (!result) throw new Error("Empty embedding result");
		return result;
	}

	private async embedBatch(
		texts: string[],
		retries = 3,
	): Promise<Float32Array[]> {
		for (let attempt = 0; attempt < retries; attempt++) {
			try {
				const response = await this.httpClient.post(
					this.baseUrl,
					{
						model: this.model,
						input: texts,
					},
					buildOpenRouterHeaders(this.apiKey),
				);

				if (response.status !== 200) {
					throw new AIRequestError(response.status, response.text);
				}

				const data = response.json as {
					data: { embedding: number[]; index: number }[];
				};

				const embeddings = data.data
					.sort((a, b) => a.index - b.index)
					.map((d) => new Float32Array(d.embedding));

				const first = embeddings[0];
				if (first && first.length !== RAG_CONFIG.embeddingDims) {
					throw new Error(
						`Embedding dimension mismatch: expected ${RAG_CONFIG.embeddingDims}, got ${first.length}. Check the embedding model on the proxy.`,
					);
				}

				return embeddings;
			} catch (e) {
				if (
					e instanceof AIRequestError &&
					e.isRateLimited &&
					attempt < retries - 1
				) {
					const delay = 1000 * 2 ** attempt;
					await new Promise((r) => window.setTimeout(r, delay));
					continue;
				}
				throw e;
			}
		}

		throw new Error("Embedding request failed after retries");
	}
}
