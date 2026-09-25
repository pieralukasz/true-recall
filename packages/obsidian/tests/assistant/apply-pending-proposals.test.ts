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

	it("applies only proposal kinds allowed by the caller", async () => {
		const manifest = createManifest();
		manifest.proposals.unshift({
			id: "proposal-edit",
			status: "proposed",
			type: "update_card",
			cardId: "card-1",
			noteId: "note-1",
			fields: { Front: "Edited", Back: "A" },
			previousFields: { Front: "Original", Back: "A" },
		});
		const apply = vi.fn().mockResolvedValue({ ok: true });

		const result = await applyPendingProposals(
			task,
			manifest,
			{ apply },
			{
				shouldApply: (proposal) => proposal.type !== "create_card",
			},
		);

		expect(result.appliedCount).toBe(1);
		expect(manifest.proposals.map((proposal) => proposal.status)).toEqual([
			"applied",
			"proposed",
			"proposed",
		]);
		expect(apply).toHaveBeenCalledOnce();
	});

	describe("characterization", () => {
		it("stops at the first error and leaves the rest pending", async () => {
			const manifest = createManifest();
			const apply = vi
				.fn()
				.mockResolvedValueOnce({
					ok: false,
					error: "Note type no longer exists",
				})
				.mockResolvedValueOnce({ ok: true });

			const result = await applyPendingProposals(task, manifest, { apply });

			expect(result).toEqual({
				appliedCount: 0,
				conflictedCount: 0,
				conflicts: {},
				error: "Note type no longer exists",
			});
			expect(apply).toHaveBeenCalledOnce();
			expect(manifest.proposals.map((proposal) => proposal.status)).toEqual([
				"proposed",
				"proposed",
			]);
		});

		it("falls back to a generic message when a failure has no error", async () => {
			const manifest = createManifest();
			const apply = vi.fn().mockResolvedValue({ ok: false });

			const result = await applyPendingProposals(task, manifest, { apply });

			expect(result.error).toBe("Could not apply all drafts");
		});

		it("skips proposals that are already applied or rejected", async () => {
			const manifest = createManifest();
			manifest.proposals[0].status = "applied";
			manifest.proposals[1].status = "rejected";
			const apply = vi.fn().mockResolvedValue({ ok: true });

			const result = await applyPendingProposals(task, manifest, { apply });

			expect(result.appliedCount).toBe(0);
			expect(apply).not.toHaveBeenCalled();
		});

		it("passes card fields as overrides and none for other proposal kinds", async () => {
			const manifest: AssistantManifest = {
				proposals: [
					{
						id: "card",
						status: "proposed",
						type: "create_card",
						noteTypeId: "basic",
						fields: { Front: "Q", Back: "A" },
					},
					{
						id: "note",
						status: "proposed",
						type: "append_to_note",
						path: "Note.md",
						markdown: "text",
					},
				],
				citations: [],
			};
			const apply = vi.fn().mockResolvedValue({ ok: true });

			await applyPendingProposals(task, manifest, { apply });

			expect(apply.mock.calls[0][2]).toEqual({
				fields: { Front: "Q", Back: "A" },
			});
			expect(apply.mock.calls[1][2]).toEqual({ fields: undefined });
		});
	});
});
