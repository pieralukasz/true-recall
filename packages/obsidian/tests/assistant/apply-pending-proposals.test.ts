import { describe, expect, it, vi } from "vitest";

import type {
	AssistantManifest,
	AssistantTask,
} from "@true-recall/core/ai/assistant";

import { applyPendingProposals } from "@true-recall/obsidian/features/assistant/ui/apply-pending-proposals";

const task: AssistantTask = {
	id: "task-1",
	instruction: "Create cards",
	context: {},
	status: "done",
	createdAt: 1000,
};

function createManifest(): AssistantManifest {
	return {
		proposals: [
			{
				id: "proposal-1",
				status: "proposed",
				type: "create_card",
				noteTypeId: "basic",
				fields: { Front: "Q1", Back: "A1" },
			},
			{
				id: "proposal-2",
				status: "proposed",
				type: "create_card",
				noteTypeId: "basic",
				fields: { Front: "Q2", Back: "A2" },
			},
		],
		citations: [],
	};
}

describe("applyPendingProposals", () => {
	it("applies every pending proposal", async () => {
		const manifest = createManifest();
		const apply = vi.fn().mockResolvedValue({ ok: true });

		const result = await applyPendingProposals(task, manifest, { apply });

		expect(result).toEqual({
			appliedCount: 2,
			conflictedCount: 0,
			conflicts: {},
		});
		expect(manifest.proposals.map((proposal) => proposal.status)).toEqual([
			"applied",
			"applied",
		]);
		expect(apply).toHaveBeenCalledTimes(2);
	});

	it("leaves conflicted proposals pending for individual review", async () => {
		const manifest = createManifest();
		const apply = vi
			.fn()
			.mockResolvedValueOnce({ ok: false, conflictFields: ["Front"] })
			.mockResolvedValueOnce({ ok: true });

		const result = await applyPendingProposals(task, manifest, { apply });

		expect(result).toEqual({
			appliedCount: 1,
			conflictedCount: 1,
			conflicts: { "proposal-1": ["Front"] },
		});
		expect(manifest.proposals.map((proposal) => proposal.status)).toEqual([
			"proposed",
			"applied",
		]);
	});
});
