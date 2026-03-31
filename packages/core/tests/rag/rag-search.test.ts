import { describe, expect, it } from "vitest";

// Re-export the private functions for testing by importing the module
// We test the pure functions: cosineSimilarity and rrfMerge are private,
// so we test them indirectly via the exported search behavior,
// or we can test the standalone cosineSimilarity function directly.

// Since cosineSimilarity is module-private, we replicate it here for unit testing.
// The actual implementation is in rag-search.service.ts.
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
	let dot = 0;
	let normA = 0;
	let normB = 0;
	for (let i = 0; i < a.length; i++) {
		const ai = a[i] ?? 0;
		const bi = b[i] ?? 0;
		dot += ai * bi;
		normA += ai * ai;
		normB += bi * bi;
	}
	const denom = Math.sqrt(normA) * Math.sqrt(normB);
	return denom === 0 ? 0 : dot / denom;
}

describe("cosineSimilarity", () => {
	it("returns 1.0 for identical vectors", () => {
		const v = new Float32Array([1, 2, 3]);
		expect(cosineSimilarity(v, v)).toBeCloseTo(1.0);
	});

	it("returns 0.0 for orthogonal vectors", () => {
		const a = new Float32Array([1, 0]);
		const b = new Float32Array([0, 1]);
		expect(cosineSimilarity(a, b)).toBeCloseTo(0.0);
	});

	it("returns -1.0 for opposite vectors", () => {
		const a = new Float32Array([1, 0]);
		const b = new Float32Array([-1, 0]);
		expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0);
	});

	it("returns 0.0 for zero vector", () => {
		const a = new Float32Array([1, 2, 3]);
		const b = new Float32Array([0, 0, 0]);
		expect(cosineSimilarity(a, b)).toBe(0);
	});

	it("returns 0.0 for empty vectors", () => {
		const a = new Float32Array(0);
		const b = new Float32Array(0);
		expect(cosineSimilarity(a, b)).toBe(0);
	});

	it("handles non-unit vectors correctly", () => {
		const a = new Float32Array([3, 4]);
		const b = new Float32Array([6, 8]);
		// Same direction, different magnitude → cosine = 1.0
		expect(cosineSimilarity(a, b)).toBeCloseTo(1.0);
	});
});

// Replicate rrfMerge for unit testing (private method in service)
function rrfMerge(
	ftsResults: { id: number; rank: number }[],
	vectorResults: { id: number; score: number }[],
	topK: number,
	k = 60,
): { id: number; score: number }[] {
	const scores = new Map<number, number>();

	for (let i = 0; i < ftsResults.length; i++) {
		const r = ftsResults[i];
		if (!r) continue;
		const current = scores.get(r.id) ?? 0;
		scores.set(r.id, current + 1 / (k + i + 1));
	}

	for (let i = 0; i < vectorResults.length; i++) {
		const r = vectorResults[i];
		if (!r) continue;
		const current = scores.get(r.id) ?? 0;
		scores.set(r.id, current + 1 / (k + i + 1));
	}

	return Array.from(scores.entries())
		.map(([id, score]) => ({ id, score }))
		.sort((a, b) => b.score - a.score)
		.slice(0, topK);
}

describe("rrfMerge", () => {
	it("merges overlapping results with boosted scores", () => {
		const fts = [
			{ id: 1, rank: -5 },
			{ id: 2, rank: -3 },
		];
		const vec = [
			{ id: 1, score: 0.9 },
			{ id: 3, score: 0.8 },
		];
		const merged = rrfMerge(fts, vec, 10);

		// ID 1 appears in both lists → should have highest score
		expect(merged[0]?.id).toBe(1);
		expect(merged[0]?.score).toBeGreaterThan(merged[1]?.score ?? 0);
	});

	it("returns union of disjoint results", () => {
		const fts = [{ id: 1, rank: -5 }];
		const vec = [{ id: 2, score: 0.9 }];
		const merged = rrfMerge(fts, vec, 10);

		expect(merged).toHaveLength(2);
		const ids = merged.map((m) => m.id).sort();
		expect(ids).toEqual([1, 2]);
	});

	it("respects topK limit", () => {
		const fts = Array.from({ length: 10 }, (_, i) => ({
			id: i,
			rank: -(10 - i),
		}));
		const merged = rrfMerge(fts, [], 3);
		expect(merged).toHaveLength(3);
	});

	it("handles empty FTS results", () => {
		const vec = [{ id: 1, score: 0.9 }];
		const merged = rrfMerge([], vec, 10);
		expect(merged).toHaveLength(1);
		expect(merged[0]?.id).toBe(1);
	});

	it("handles empty vector results", () => {
		const fts = [{ id: 1, rank: -5 }];
		const merged = rrfMerge(fts, [], 10);
		expect(merged).toHaveLength(1);
		expect(merged[0]?.id).toBe(1);
	});

	it("handles both empty", () => {
		const merged = rrfMerge([], [], 10);
		expect(merged).toHaveLength(0);
	});
});
