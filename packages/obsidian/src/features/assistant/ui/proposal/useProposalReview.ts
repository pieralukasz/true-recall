import { useEffect, useMemo } from "preact/hooks";

import type {
	AssistantProposal,
	AssistantTask,
	AssistantThread,
} from "@true-recall/core/ai/assistant";

import { usePlugin } from "@true-recall/obsidian/preact/ObsidianContext";
import { AssistantApplyService } from "@true-recall/obsidian/services/assistant/assistant-apply.service";
import { notify } from "@true-recall/obsidian/services/notification.service";

import {
	hasPendingProposals,
	isReviewedTask,
	threadTask,
} from "../thread-utils";
import type { ProposalDraft } from "./proposal-draft";
import {
	ProposalReviewController,
	type ProposalReviewDeps,
	type ProposalReviewNotifier,
} from "./proposal-review-controller";

type Plugin = ReturnType<typeof usePlugin>;

const notifier: ProposalReviewNotifier = {
	success: (message) => notify().success(message),
	info: (message) => notify().info(message),
	error: (message) => notify().error(message),
};

function plural(count: number): string {
	return `${count} draft${count === 1 ? "" : "s"}`;
}

/** Review deps bound to one conversation thread at one AI revision. */
export function threadReviewDeps(
	plugin: Plugin,
	threadId: string,
	revision: number,
	notifications: ProposalReviewNotifier = notifier,
): ProposalReviewDeps {
	const current = () =>
		plugin.assistantService?.getThread(threadId) ?? undefined;
	return {
		apply: new AssistantApplyService(plugin),
		task: () => {
			const thread = current();
			return thread ? threadTask(thread) : undefined;
		},
		load: () => current()?.manifest,
		save: (manifest) =>
			plugin.assistantService?.updateThreadManifest(threadId, manifest),
		settle: (manifest) => {
			const thread = current();
			if (!thread || hasPendingProposals({ ...thread, manifest })) {
				return false;
			}
			plugin.assistantService?.archiveThread(threadId);
			return true;
		},
		isLocked: () => !!current()?.activeTaskId,
		isStale: () => {
			const thread = current();
			return !!thread && thread.revision !== revision;
		},
		notifier: notifications,
		conflictMessage: (count) =>
			`${plural(count)} changed since the AI saw them — apply them individually`,
	};
}

/** Review deps bound to one standalone task (no thread). */
export function taskReviewDeps(
	plugin: Plugin,
	taskId: string,
): ProposalReviewDeps {
	const current = () => plugin.assistantService?.getTask(taskId) ?? undefined;
	return {
		apply: new AssistantApplyService(plugin),
		task: current,
		load: () => current()?.manifest,
		save: (manifest) =>
			plugin.assistantService?.updateManifest(taskId, manifest),
		settle: (manifest) => {
			const task = current();
			if (!task || !isReviewedTask({ ...task, manifest })) return false;
			plugin.assistantService?.delete(taskId);
			return true;
		},
		notifier,
		conflictMessage: (count) =>
			`${plural(count)} changed since the AI saw them — review the conflicts below`,
	};
}

/**
 * One controller per owner and revision. A new AI revision replaces the
 * proposals, so local drafts start over from the persisted manifest.
 */
function useController(
	key: string,
	createDeps: () => ProposalReviewDeps,
	onClosed: (() => void) | undefined,
): ProposalReviewController {
	// `key` identifies the owner; `createDeps` is recreated every render.
	const controller = useMemo(
		() => new ProposalReviewController(createDeps()),
		[key],
	);
	controller.onClosed = onClosed;
	useEffect(() => () => controller.dispose(), [controller]);
	return controller;
}

export function useThreadProposalReview(
	thread: AssistantThread,
	onClose?: () => void,
): ProposalReviewController {
	const plugin = usePlugin();
	return useController(
		`thread:${thread.id}:${thread.revision}`,
		() => threadReviewDeps(plugin, thread.id, thread.revision),
		onClose,
	);
}

export function useTaskProposalReview(
	task: AssistantTask,
	onReviewed?: () => void,
): ProposalReviewController {
	const plugin = usePlugin();
	return useController(
		`task:${task.id}`,
		() => taskReviewDeps(plugin, task.id),
		onReviewed,
	);
}

/** Draft and non-mutating edit operations for one proposal. */
export function useProposalDraft(
	controller: ProposalReviewController,
	proposal: AssistantProposal,
) {
	const edit = (update: (draft: ProposalDraft) => ProposalDraft) =>
		controller.editDraft(proposal.id, update);
	return {
		draft: controller.draftFor(proposal),
		setField: (name: string, value: string) =>
			edit((draft) => ({
				...draft,
				fields: { ...draft.fields, [name]: value },
			})),
		setText: (text: string) => edit((draft) => ({ ...draft, text })),
		toggleImage: (index: number) =>
			edit((draft) => {
				const selected = new Set(draft.selectedImages);
				if (selected.has(index)) selected.delete(index);
				else selected.add(index);
				return {
					...draft,
					selectedImages: [...selected].sort((a, b) => a - b),
				};
			}),
	};
}
