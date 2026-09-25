import { signal } from "@preact/signals";

import type {
	AssistantManifest,
	AssistantProposal,
	AssistantTask,
} from "@true-recall/core/ai/assistant";

import {
	type ApplyPendingProposalsResult,
	applyPendingProposals,
} from "@true-recall/obsidian/services/assistant/apply-pending-proposals";
import type { AssistantApplyService } from "@true-recall/obsidian/services/assistant/assistant-apply.service";

import {
	applyFieldOverrides,
	draftFromProposal,
	findProposal,
	type ProposalDraft,
	setProposalStatus,
	updateProposal,
	withDraft,
} from "./proposal-draft";

export interface ProposalReviewNotifier {
	success(message: string): void;
	info(message: string): void;
	error(message: string): void;
}

/**
 * Everything the controller needs from the owner of one manifest (a thread or
 * a standalone task). Each function is bound to that owner when the controller
 * is created, so a result that arrives after the UI switched to another owner
 * still reads and writes the owner it started with.
 */
export interface ProposalReviewDeps {
	apply: Pick<AssistantApplyService, "apply">;
	/** Task context used by `apply`. Undefined when the owner is gone. */
	task: () => AssistantTask | undefined;
	/** Latest persisted manifest. */
	load: () => AssistantManifest | undefined;
	save: (manifest: AssistantManifest) => void;
	/**
	 * Runs after a status change was saved. Archives or deletes the owner
	 * when nothing is left to review; returns true when it did.
	 */
	settle: (manifest: AssistantManifest) => boolean;
	/** True while an AI turn owns the manifest; review actions wait. */
	isLocked?: () => boolean;
	/** True once the manifest moved to a newer AI revision than this view's. */
	isStale?: () => boolean;
	notifier: ProposalReviewNotifier;
	conflictMessage: (count: number) => string;
}

export interface ProposalReviewState {
	/** An apply is in flight; every review action is refused until it ends. */
	busy: boolean;
	/** Changed field names per proposal id from the last apply attempt. */
	conflicts: Readonly<Record<string, readonly string[]>>;
}

const IDLE: ProposalReviewState = { busy: false, conflicts: {} };

/**
 * Owns the review flow for one manifest: local drafts, draft persistence,
 * Apply, Apply all, conflicts, rejection and closing the owner. Components
 * render from `state` and `drafts` and never mutate proposals themselves.
 */
export class ProposalReviewController {
	readonly state = signal<ProposalReviewState>(IDLE);
	readonly drafts = signal<Readonly<Record<string, ProposalDraft>>>({});
	/** Called once the owner was archived or deleted. Cleared on unmount. */
	onClosed: (() => void) | undefined;
	private disposed = false;

	constructor(private readonly deps: ProposalReviewDeps) {}

	dispose(): void {
		this.disposed = true;
		this.onClosed = undefined;
	}

	draftFor(proposal: AssistantProposal): ProposalDraft {
		return this.drafts.value[proposal.id] ?? draftFromProposal(proposal);
	}

	conflictFor(proposalId: string): readonly string[] | null {
		return this.state.value.conflicts[proposalId] ?? null;
	}

	/**
	 * Records an edit and saves it into the persisted manifest. `update`
	 * receives the latest draft, so edits arriving before a re-render compose.
	 */
	editDraft(
		proposalId: string,
		update: (draft: ProposalDraft) => ProposalDraft,
	): void {
		const manifest = this.deps.load();
		const proposal = findProposal(manifest, proposalId);
		if (!manifest || !proposal || proposal.status !== "proposed") return;
		// An AI turn replaces the manifest when it completes, so an edit saved
		// now would be dropped; an edit from an older revision would overwrite
		// the AI's newer draft. Disposal is not checked: editors flush their
		// last keystrokes while unmounting, after the owning view cleaned up.
		if (this.deps.isLocked?.() || this.deps.isStale?.()) return;
		const draft = update(this.draftFor(proposal));
		this.drafts.value = { ...this.drafts.value, [proposalId]: draft };
		this.deps.save(
			updateProposal(manifest, proposalId, (current) =>
				withDraft(current, draft),
			),
		);
	}

	dismissConflict(proposalId: string): void {
		this.setConflicts(omit(this.state.value.conflicts, proposalId));
	}

	reject(proposalId: string): void {
		if (!this.canAct()) return;
		const manifest = this.deps.load();
		if (findProposal(manifest, proposalId)?.status !== "proposed") return;
		if (!manifest) return;
		const next = setProposalStatus(manifest, proposalId, "rejected");
		this.forgetDraft(proposalId);
		this.setConflicts(omit(this.state.value.conflicts, proposalId));
		this.deps.save(next);
		this.finish(next);
	}

	/** Applies one proposal with its draft. `force` skips the conflict check. */
	async applyOne(proposalId: string, force = false): Promise<void> {
		if (!this.canAct()) return;
		const task = this.deps.task();
		const stored = findProposal(this.deps.load(), proposalId);
		if (!task || stored?.status !== "proposed") return;
		const proposal = withDraft(stored, this.draftFor(stored));

		this.setBusy(true);
		try {
			const result = await this.deps.apply.apply(task, proposal, {
				fields: applyFieldOverrides(proposal),
				force,
			});
			if (result.ok) {
				this.deps.notifier.success("Applied");
				const latest = this.writableManifest();
				if (!latest) return;
				const next = updateProposal(latest, proposalId, () => ({
					...proposal,
					status: "applied",
				}));
				this.forgetDraft(proposalId);
				this.setConflicts(omit(this.state.value.conflicts, proposalId));
				this.deps.save(next);
				this.finish(next);
			} else if (result.conflictFields) {
				this.setConflicts({
					...this.state.value.conflicts,
					[proposalId]: result.conflictFields,
				});
			} else if (result.error) {
				this.deps.notifier.error(result.error);
			}
		} finally {
			this.setBusy(false);
		}
	}

	/**
	 * Applies every pending proposal with its draft; conflicts stay pending.
	 * Returns null when the controller refused to start.
	 */
	async applyAll(): Promise<ApplyPendingProposalsResult | null> {
		if (!this.canAct()) return null;
		const task = this.deps.task();
		const manifest = this.deps.load();
		if (!task || !manifest) return null;
		// The batch runner marks statuses on the object it receives, so it
		// works on a private copy that already carries the user's drafts.
		const working: AssistantManifest = structuredClone({
			...manifest,
			proposals: manifest.proposals.map((proposal) =>
				proposal.status === "proposed"
					? withDraft(proposal, this.draftFor(proposal))
					: proposal,
			),
		});

		this.setBusy(true);
		try {
			const result = await applyPendingProposals(
				task,
				working,
				this.deps.apply,
			);
			const applied = working.proposals.filter(
				(proposal) =>
					proposal.status === "applied" &&
					findProposal(manifest, proposal.id)?.status === "proposed",
			);
			const latest = this.writableManifest();
			let next = latest ?? manifest;
			let conflicts: Record<string, readonly string[]> = {
				...this.state.value.conflicts,
			};
			for (const proposal of applied) {
				next = updateProposal(next, proposal.id, () => proposal);
				this.forgetDraft(proposal.id);
				conflicts = omit(conflicts, proposal.id);
			}
			// Proposals after a failure were not attempted; keep what they showed.
			this.setConflicts({ ...conflicts, ...result.conflicts });
			if (latest) {
				this.deps.save(next);
				this.finish(next);
			}
			if (result.conflictedCount > 0) {
				this.deps.notifier.info(
					this.deps.conflictMessage(result.conflictedCount),
				);
			}
			if (result.error) this.deps.notifier.error(result.error);
			if (!result.error && result.appliedCount > 0) {
				this.deps.notifier.success("Applied AI drafts");
			}
			return result;
		} finally {
			this.setBusy(false);
		}
	}

	private canAct(): boolean {
		return (
			!this.disposed &&
			!this.state.value.busy &&
			!this.deps.isLocked?.() &&
			!this.deps.isStale?.()
		);
	}

	/**
	 * The manifest a finished apply may write to. Undefined when the owner
	 * was deleted or replaced by a newer AI revision while the apply ran:
	 * writing there would mark or overwrite the wrong proposals.
	 */
	private writableManifest(): AssistantManifest | undefined {
		if (this.deps.isStale?.()) return undefined;
		return this.deps.load();
	}

	private finish(manifest: AssistantManifest): void {
		if (this.deps.settle(manifest)) this.onClosed?.();
	}

	private forgetDraft(proposalId: string): void {
		if (!(proposalId in this.drafts.value)) return;
		this.drafts.value = omit(this.drafts.value, proposalId);
	}

	private setBusy(busy: boolean): void {
		this.state.value = { ...this.state.value, busy };
	}

	private setConflicts(
		conflicts: Readonly<Record<string, readonly string[]>>,
	): void {
		this.state.value = { ...this.state.value, conflicts };
	}
}

function omit<T>(
	record: Readonly<Record<string, T>>,
	key: string,
): Record<string, T> {
	const { [key]: _removed, ...rest } = record;
	return rest;
}
