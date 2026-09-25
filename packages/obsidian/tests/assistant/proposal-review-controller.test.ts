import { describe, expect, it, vi } from "vitest";

import type {
	AssistantManifest,
	AssistantProposal,
	AssistantTask,
} from "@true-recall/core/ai/assistant";

import {
	draftFromProposal,
	withDraft,
} from "@true-recall/obsidian/features/assistant/ui/proposal/proposal-draft";
import {
	ProposalReviewController,
	type ProposalReviewDeps,
} from "@true-recall/obsidian/features/assistant/ui/proposal/proposal-review-controller";
import type { ApplyResult } from "@true-recall/obsidian/services/assistant/assistant-apply.service";

const task: AssistantTask = {
	id: "task-1",
	instruction: "Create cards",
	context: {},
	status: "done",
	createdAt: 1000,
};

function card(id: string, front = `Q-${id}`): AssistantProposal {
	return {
		id,
		status: "proposed",
		type: "create_card",
		noteTypeId: "basic",
		fields: { Front: front, Back: `A-${id}` },
	};
}

function createManifest(...proposals: AssistantProposal[]): AssistantManifest {
	return { proposals, citations: [] };
}

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((r) => {
		resolve = r;
	});
	return { promise, resolve };
}

/** An in-memory owner whose saves replace the stored manifest. */
function createHarness(
	initial: AssistantManifest,
	overrides: Partial<ProposalReviewDeps> = {},
) {
	let stored: AssistantManifest | undefined = structuredClone(initial);
	const apply = vi.fn<
		(
			task: AssistantTask,
			proposal: AssistantProposal,
			overrides?: { fields?: Record<string, string>; force?: boolean },
		) => Promise<ApplyResult>
	>(async () => ({ ok: true }));
	const notifier = { success: vi.fn(), info: vi.fn(), error: vi.fn() };
	const settle = vi.fn(
		(manifest: AssistantManifest) =>
			!manifest.proposals.some((proposal) => proposal.status === "proposed"),
	);
	const save = vi.fn((manifest: AssistantManifest) => {
		stored = manifest;
	});
	const deps: ProposalReviewDeps = {
		apply: { apply },
		task: () => task,
		load: () => stored,
		save,
		settle,
		notifier,
		conflictMessage: (count) => `${count} conflicts`,
		...overrides,
	};
	const controller = new ProposalReviewController(deps);
	const onClosed = vi.fn();
	controller.onClosed = onClosed;
	return {
		controller,
		apply,
		notifier,
		settle,
		save,
		onClosed,
		stored: () => stored,
		replace: (manifest: AssistantManifest | undefined) => {
			stored = manifest;
		},
	};
}

describe("proposal drafts", () => {
	it.each<[string, AssistantProposal, Record<string, unknown>]>([
		[
			"markdown",
			{
				id: "n",
				status: "proposed",
				type: "append_to_note",
				path: "N.md",
				markdown: "old",
			},
			{ markdown: "new" },
		],
		[
			"diagram code",
			{
				id: "d",
				status: "proposed",
				type: "insert_diagram",
				target: { kind: "note", path: "N.md" },
				format: "mermaid",
				code: "old",
			},
			{ code: "new" },
		],
	])("writes edited %s into a copy", (_label, proposal, expected) => {
		const before = structuredClone(proposal);

		const next = withDraft(proposal, { text: "new" });

		expect(next).toMatchObject(expected);
		expect(proposal).toEqual(before);
	});

	it("maps image selection onto candidates without mutating them", () => {
		const proposal: AssistantProposal = {
			id: "i",
			status: "proposed",
			type: "attach_images",
			target: { kind: "note", path: "N.md" },
			candidates: [{ url: "a" }, { url: "b", selected: true }],
		};

		expect(draftFromProposal(proposal)).toEqual({ selectedImages: [1] });
		const next = withDraft(proposal, { selectedImages: [0] });

		expect(
			next.type === "attach_images" &&
				next.candidates.map((candidate) => candidate.selected),
		).toEqual([true, false]);
		expect(proposal.candidates[1].selected).toBe(true);
		expect(proposal.candidates[0].selected).toBeUndefined();
	});
});

describe("ProposalReviewController", () => {
	describe("editing", () => {
		it("saves field edits to the edited proposal only", () => {
			const initial = createManifest(card("p1"), card("p2"));
			const h = createHarness(initial);

			h.controller.editDraft("p2", (draft) => ({
				...draft,
				fields: { ...draft.fields, Front: "edited" },
			}));

			const saved = h.stored()?.proposals;
			expect(saved?.[0]).toEqual(initial.proposals[0]);
			expect(saved?.[1]).toMatchObject({ fields: { Front: "edited" } });
			expect(h.controller.draftFor(card("p1")).fields?.Front).toBe("Q-p1");
		});

		it("composes edits that arrive before a re-render", () => {
			const h = createHarness(createManifest(card("p1")));

			h.controller.editDraft("p1", (d) => ({
				...d,
				fields: { ...d.fields, Front: "F" },
			}));
			h.controller.editDraft("p1", (d) => ({
				...d,
				fields: { ...d.fields, Back: "B" },
			}));

			expect(h.stored()?.proposals[0]).toMatchObject({
				fields: { Front: "F", Back: "B" },
			});
		});

		it("does not mutate the manifest it loaded", () => {
			const h = createHarness(createManifest(card("p1")));
			const loaded = h.stored();

			h.controller.editDraft("p1", () => ({ fields: { Front: "x" } }));

			expect(loaded?.proposals[0]).toMatchObject({ fields: { Front: "Q-p1" } });
			expect(h.stored()).not.toBe(loaded);
		});

		it("ignores edits while an AI turn owns the manifest", () => {
			const h = createHarness(createManifest(card("p1")), {
				isLocked: () => true,
			});

			h.controller.editDraft("p1", () => ({ fields: { Front: "x" } }));

			expect(h.save).not.toHaveBeenCalled();
		});

		it("ignores edits from a view of an older revision", () => {
			const h = createHarness(createManifest(card("p1")), {
				isStale: () => true,
			});

			h.controller.editDraft("p1", () => ({ fields: { Front: "x" } }));

			expect(h.save).not.toHaveBeenCalled();
		});
	});

	describe("applyOne", () => {
		it("applies the draft, marks the proposal applied and settles", async () => {
			const h = createHarness(createManifest(card("p1")));
			h.controller.editDraft("p1", () => ({
				fields: { Front: "edited", Back: "A" },
			}));

			await h.controller.applyOne("p1");

			expect(h.apply).toHaveBeenCalledOnce();
			expect(h.apply.mock.calls[0][1]).toMatchObject({
				fields: { Front: "edited" },
			});
			expect(h.apply.mock.calls[0][2]).toEqual({
				fields: { Front: "edited", Back: "A" },
				force: false,
			});
			expect(h.stored()?.proposals[0]).toMatchObject({
				status: "applied",
				fields: { Front: "edited" },
			});
			expect(h.notifier.success).toHaveBeenCalledWith("Applied");
			expect(h.onClosed).toHaveBeenCalledOnce();
		});

		it("keeps the draft and shows the conflict when fields changed", async () => {
			const h = createHarness(createManifest(card("p1"), card("p2")));
			h.apply.mockResolvedValueOnce({ ok: false, conflictFields: ["Front"] });
			h.controller.editDraft("p1", () => ({ fields: { Front: "mine" } }));

			await h.controller.applyOne("p1");

			expect(h.controller.conflictFor("p1")).toEqual(["Front"]);
			expect(h.controller.draftFor(card("p1")).fields?.Front).toBe("mine");
			expect(h.stored()?.proposals[0].status).toBe("proposed");
			expect(h.onClosed).not.toHaveBeenCalled();
		});

		it("forces past a conflict and clears it", async () => {
			const h = createHarness(createManifest(card("p1"), card("p2")));
			h.apply.mockResolvedValueOnce({ ok: false, conflictFields: ["Front"] });
			await h.controller.applyOne("p1");

			await h.controller.applyOne("p1", true);

			expect(h.apply.mock.calls[1][2]).toMatchObject({ force: true });
			expect(h.controller.conflictFor("p1")).toBeNull();
			expect(h.stored()?.proposals[0].status).toBe("applied");
		});

		it("reports errors without changing status", async () => {
			const h = createHarness(createManifest(card("p1")));
			h.apply.mockResolvedValueOnce({ ok: false, error: "Card gone" });

			await h.controller.applyOne("p1");

			expect(h.notifier.error).toHaveBeenCalledWith("Card gone");
			expect(h.stored()?.proposals[0].status).toBe("proposed");
			expect(h.controller.state.value.busy).toBe(false);
		});

		it("ignores a second click while the first apply is running", async () => {
			const h = createHarness(createManifest(card("p1")));
			const pending = deferred<ApplyResult>();
			h.apply.mockReturnValueOnce(pending.promise);

			const first = h.controller.applyOne("p1");
			await h.controller.applyOne("p1");
			await h.controller.applyAll();
			h.controller.reject("p1");
			pending.resolve({ ok: true });
			await first;

			expect(h.apply).toHaveBeenCalledOnce();
			expect(h.stored()?.proposals[0].status).toBe("applied");
		});

		it("preserves edits to other proposals made while applying", async () => {
			const h = createHarness(createManifest(card("p1"), card("p2")));
			const pending = deferred<ApplyResult>();
			h.apply.mockReturnValueOnce(pending.promise);

			const running = h.controller.applyOne("p1");
			h.controller.editDraft("p2", () => ({ fields: { Front: "typed" } }));
			pending.resolve({ ok: true });
			await running;

			expect(h.stored()?.proposals.map((p) => p.status)).toEqual([
				"applied",
				"proposed",
			]);
			expect(h.stored()?.proposals[1]).toMatchObject({
				fields: { Front: "typed" },
			});
		});

		it("writes a late result only to its own owner", async () => {
			const h = createHarness(createManifest(card("p1")));
			const pending = deferred<ApplyResult>();
			h.apply.mockReturnValueOnce(pending.promise);

			const running = h.controller.applyOne("p1");
			// The owner was deleted meanwhile (e.g. Discard).
			h.replace(undefined);
			pending.resolve({ ok: true });
			await running;

			expect(h.save).not.toHaveBeenCalled();
			expect(h.onClosed).not.toHaveBeenCalled();
		});

		it("does not mark a newer AI revision when a late result lands", async () => {
			let stale = false;
			const h = createHarness(createManifest(card("p1")), {
				isStale: () => stale,
			});
			const pending = deferred<ApplyResult>();
			h.apply.mockReturnValueOnce(pending.promise);

			const running = h.controller.applyOne("p1");
			// Undo AI / a follow-up swapped in a manifest with the same ids.
			stale = true;
			h.replace(createManifest(card("p1", "newer")));
			pending.resolve({ ok: true });
			await running;

			expect(h.save).not.toHaveBeenCalled();
			expect(h.stored()?.proposals[0]).toMatchObject({
				status: "proposed",
				fields: { Front: "newer" },
			});
		});

		it("refuses while locked, stale or disposed", async () => {
			let locked = true;
			let stale = false;
			const h = createHarness(createManifest(card("p1")), {
				isLocked: () => locked,
				isStale: () => stale,
			});

			await h.controller.applyOne("p1");
			locked = false;
			stale = true;
			await h.controller.applyOne("p1");
			stale = false;
			h.controller.dispose();
			await h.controller.applyOne("p1");

			expect(h.apply).not.toHaveBeenCalled();
		});
	});

	describe("reject", () => {
		it("rejects, drops the draft and settles", () => {
			const h = createHarness(createManifest(card("p1")));
			h.controller.editDraft("p1", () => ({ fields: { Front: "x" } }));

			h.controller.reject("p1");

			expect(h.stored()?.proposals[0].status).toBe("rejected");
			expect(h.controller.drafts.value).toEqual({});
			expect(h.onClosed).toHaveBeenCalledOnce();
		});

		it("keeps the owner open while other proposals are pending", () => {
			const h = createHarness(createManifest(card("p1"), card("p2")));

			h.controller.reject("p1");

			expect(h.onClosed).not.toHaveBeenCalled();
		});
	});

	describe("applyAll", () => {
		it("applies only pending proposals using their drafts", async () => {
			const done = { ...card("done"), status: "applied" as const };
			const h = createHarness(createManifest(done, card("p1"), card("p2")));
			h.controller.editDraft("p2", () => ({ fields: { Front: "edited" } }));

			await h.controller.applyAll();

			expect(h.apply.mock.calls.map((call) => call[1].id)).toEqual([
				"p1",
				"p2",
			]);
			expect(h.apply.mock.calls[1][2]).toEqual({
				fields: { Front: "edited" },
			});
			expect(h.stored()?.proposals.map((p) => p.status)).toEqual([
				"applied",
				"applied",
				"applied",
			]);
			expect(h.notifier.success).toHaveBeenCalledWith("Applied AI drafts");
			expect(h.onClosed).toHaveBeenCalledOnce();
		});

		it("keeps conflicted proposals, their drafts and the owner open", async () => {
			const h = createHarness(createManifest(card("p1"), card("p2")));
			h.apply
				.mockResolvedValueOnce({ ok: false, conflictFields: ["Front"] })
				.mockResolvedValueOnce({ ok: true });
			h.controller.editDraft("p1", () => ({ fields: { Front: "mine" } }));

			await h.controller.applyAll();

			expect(h.stored()?.proposals.map((p) => p.status)).toEqual([
				"proposed",
				"applied",
			]);
			expect(h.controller.conflictFor("p1")).toEqual(["Front"]);
			expect(h.controller.draftFor(card("p1")).fields?.Front).toBe("mine");
			expect(h.notifier.info).toHaveBeenCalledWith("1 conflicts");
			expect(h.onClosed).not.toHaveBeenCalled();
		});

		it("keeps the applied part and the rest pending after an error", async () => {
			const h = createHarness(
				createManifest(card("p1"), card("p2"), card("p3")),
			);
			h.apply
				.mockResolvedValueOnce({ ok: true })
				.mockResolvedValueOnce({ ok: false, error: "boom" });
			h.controller.editDraft("p3", () => ({ fields: { Front: "kept" } }));

			await h.controller.applyAll();

			expect(h.stored()?.proposals.map((p) => p.status)).toEqual([
				"applied",
				"proposed",
				"proposed",
			]);
			expect(h.controller.draftFor(card("p3")).fields?.Front).toBe("kept");
			expect(h.notifier.error).toHaveBeenCalledWith("boom");
			expect(h.notifier.success).not.toHaveBeenCalled();
			expect(h.onClosed).not.toHaveBeenCalled();
		});

		it("keeps an earlier conflict for a proposal the batch did not reach", async () => {
			const h = createHarness(createManifest(card("p1"), card("p2")));
			h.apply.mockResolvedValueOnce({ ok: false, conflictFields: ["Back"] });
			await h.controller.applyOne("p2");
			h.apply.mockResolvedValueOnce({ ok: false, error: "boom" });

			await h.controller.applyAll();

			expect(h.controller.conflictFor("p2")).toEqual(["Back"]);
		});

		it("does not mutate the loaded manifest", async () => {
			const h = createHarness(createManifest(card("p1")));
			const loaded = h.stored();

			await h.controller.applyAll();

			expect(loaded?.proposals[0].status).toBe("proposed");
		});

		it("runs once when clicked twice", async () => {
			const h = createHarness(createManifest(card("p1"), card("p2")));
			const pending = deferred<ApplyResult>();
			h.apply.mockReturnValueOnce(pending.promise);

			const first = h.controller.applyAll();
			await h.controller.applyAll();
			pending.resolve({ ok: true });
			await first;

			expect(h.apply).toHaveBeenCalledTimes(2);
			expect(h.controller.state.value.busy).toBe(false);
		});
	});
});
