import type { IHttpClient } from "@true-recall/core/interfaces/http-client";
export declare class RagEmbeddingServiceImpl {
    private httpClient;
    private apiKey;
    private baseUrl;
    private model;
    constructor(httpClient: IHttpClient, apiKey: string, baseUrl?: string, model?: string);
    embed(texts: string[]): Promise<Float32Array[]>;
    embedSingle(text: string): Promise<Float32Array>;
    private embedBatch;
}
