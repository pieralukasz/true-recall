import type {
	AssistantProposal,
	AssistantTask,
	AssistantThread,
} from "@true-recall/core/ai/assistant";

import type { StatusPillTone } from "@true-recall/obsidian/components/StatusPill";

export function proposalTitle(p: AssistantProposal): string {
	switch (p.type) {
		case "create_card":
			return "New card";
		case "update_card":
			return "Card edit";
		case "update_draft":
			return "Draft card edit";
		case "append_to_note":
			return `Append to ${p.path}`;
		case "create_note":
			return `New note: ${p.title}`;
		case "insert_diagram":
			return `Diagram (${p.format})`;
		case "attach_images":
			return `Images (${p.candidates.length} found)`;
	}
}

export function formatTaskTime(task: AssistantTask): string {
	const timestamp = task.finishedAt ?? task.createdAt;
	return new Date(timestamp).toLocaleString(undefined, {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

export function taskStatusLabel(task: AssistantTask): string {
	if (task.status !== "done") return task.status;
	const proposals = task.manifest?.proposals ?? [];
	if (proposals.length === 0) return "no proposals";
	const pending = proposals.filter((p) => p.status === "proposed").length;
	if (pending === 0) return "reviewed";
	return `${pending} to review`;
}

export function isReviewedTask(task: AssistantTask): boolean {
	const proposals = task.manifest?.proposals ?? [];
	return (
		task.status === "done" &&
		proposals.length > 0 &&
		proposals.every((p) => p.status !== "proposed")
	);
}

export function normalizedSelectedText(
	text: string | undefined,
): string | null {
	const trimmed = text?.replace(/\s+/g, " ").trim();
	if (!trimmed) return null;
	return trimmed;
}

export function selectedTextPreview(text: string | undefined): string | null {
	const normalized = normalizedSelectedText(text);
	if (!normalized) return null;
	return normalized.length > 140
		? `${normalized.slice(0, 137)}...`
		: normalized;
}

/** Editable text content for the non-card proposal types (null = not applicable). */
export function contentField(
	p: AssistantProposal,
): { label: string; value: string } | null {
	switch (p.type) {
		case "append_to_note":
		case "create_note":
			return { label: "Content", value: p.markdown };
		case "insert_diagram":
			return { label: `Diagram (${p.format})`, value: p.code };
		default:
			return null;
	}
}

export function threadTask(
	thread: AssistantThread,
	activeTask?: AssistantTask,
): AssistantTask {
	return (
		activeTask ?? {
			id: thread.id,
			threadId: thread.id,
			instruction: thread.title,
			context: thread.context,
			status: "done",
			manifest: thread.manifest,
			createdAt: thread.createdAt,
			finishedAt: thread.updatedAt,
		}
	);
}

export function hasPendingProposals(thread: AssistantThread): boolean {
	return (
		thread.manifest?.proposals.some(
			(proposal) => proposal.status === "proposed",
		) ?? false
	);
}

export function sortByInboxAdditionOrder<
	T extends Pick<AssistantThread, "createdAt" | "updatedAt">,
>(threads: readonly T[]): T[] {
	// updatedAt is set when a conversation enters the inbox; manifest reviews
	// preserve it, so ascending order matches the user's inbox addition order.
	return [...threads].sort(
		(a, b) => a.updatedAt - b.updatedAt || a.createdAt - b.createdAt,
	);
}

export function statusTone(status: string): StatusPillTone {
	switch (status) {
		case "pending":
		case "running":
		case "working":
			return "accent";
		case "failed":
			return "danger";
		default:
			return "neutral";
	}
}
