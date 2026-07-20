import type { RagSearchService, SearchResult } from "./rag-search.service";

export type KnowledgeSourceType = "note" | "card";

export interface KnowledgeRetrievalRequest {
	query: string;
	sourceTypes?: KnowledgeSourceType[];
	sourceIds?: string[];
	maxResults: number;
	tokenBudget: number;
	diversifyBySource?: boolean;
}

export interface KnowledgeEvidence {
	id: string;
	sourceType: KnowledgeSourceType;
	sourceId: string;
	sourcePath?: string;
	heading?: string;
	excerpt: string;
	score: number;
	tokenCount: number;
	modifiedAt?: number;
}

/** Retrieval boundary shared by Draft Studio, Knowledge Chat and future agents. */
export interface KnowledgeRetriever {
	retrieve(request: KnowledgeRetrievalRequest): Promise<KnowledgeEvidence[]>;
}

/** Compatibility adapter around the current RAG index while RAG v2 is rebuilt. */
export class RagKnowledgeRetriever implements KnowledgeRetriever {
	constructor(private search: Pick<RagSearchService, "search">) {}

	async retrieve(
		request: KnowledgeRetrievalRequest,
	): Promise<KnowledgeEvidence[]> {
		const sourceType = this.resolveSourceType(request.sourceTypes);
		const response = await this.search.search(request.query, {
			topK: Math.max(request.maxResults * 2, request.maxResults),
			sourceType,
			sourceIds: request.sourceIds,
		});
		const ranked = request.diversifyBySource
			? diversify(response.results)
			: response.results;
		const evidence: KnowledgeEvidence[] = [];
		let tokens = 0;
		for (const result of ranked) {
			if (evidence.length >= request.maxResults) break;
			if (tokens + result.tokenCount > request.tokenBudget) continue;
			evidence.push(toEvidence(result));
			tokens += result.tokenCount;
		}
		return evidence;
	}

	private resolveSourceType(
		sourceTypes: KnowledgeSourceType[] | undefined,
	): "note" | "flashcard" | "all" {
		if (!sourceTypes || sourceTypes.length !== 1) return "all";
		return sourceTypes[0] === "card" ? "flashcard" : "note";
	}
}

function toEvidence(result: SearchResult): KnowledgeEvidence {
	const evidence: KnowledgeEvidence = {
		id: `rag:${result.sourceType}:${result.sourceId}:${result.chunkId}`,
		sourceType: result.sourceType === "flashcard" ? "card" : "note",
		sourceId: result.sourceId,
		excerpt: result.content,
		score: result.score,
		tokenCount: result.tokenCount,
	};
	if (result.sourceNotePath) evidence.sourcePath = result.sourceNotePath;
	if (result.headingBreadcrumb) evidence.heading = result.headingBreadcrumb;
	if (result.modifiedAt !== undefined) evidence.modifiedAt = result.modifiedAt;
	return evidence;
}

function diversify(results: SearchResult[]): SearchResult[] {
	const firstBySource = new Map<string, SearchResult>();
	const remaining: SearchResult[] = [];
	for (const result of results) {
		const key = `${result.sourceType}:${result.sourceId}`;
		if (!firstBySource.has(key)) firstBySource.set(key, result);
		else remaining.push(result);
	}
	return [...firstBySource.values(), ...remaining];
}
