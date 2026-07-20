import { describe, expect, it } from "vitest";

import { RagKnowledgeRetriever } from "../../../src/rag/retrieval/knowledge-retriever";
import type { SearchResult } from "../../../src/rag/retrieval/rag-search.service";

function result(
	chunkId: number,
	sourceId: string,
	tokenCount: number,
): SearchResult {
	return {
		chunkId,
		content: `Evidence ${chunkId}`,
		headingBreadcrumb: "Section",
		sourceType: "note",
		sourceId,
		score: 1 / chunkId,
		tokenCount,
	};
}

describe("RagKnowledgeRetriever", () => {
	it("adapts and packs current RAG results behind the neutral evidence contract", async () => {
		const retriever = new RagKnowledgeRetriever({
			search: async () => ({
				results: [
					result(1, "A.md", 60),
					result(2, "A.md", 30),
					result(3, "B.md", 40),
				],
				stats: {
					totalChunksSearched: 3,
					notesMatched: 2,
					flashcardsMatched: 0,
					flashcardsByState: { new: 0, learning: 0, review: 0, relearning: 0 },
				},
			}),
		});

		const evidence = await retriever.retrieve({
			query: "topic",
			maxResults: 3,
			tokenBudget: 100,
			diversifyBySource: true,
		});

		expect(evidence.map((item) => item.sourceId)).toEqual(["A.md", "B.md"]);
		expect(evidence[0]).toMatchObject({
			id: "rag:note:A.md:1",
			sourceType: "note",
			heading: "Section",
			excerpt: "Evidence 1",
		});
	});
});
