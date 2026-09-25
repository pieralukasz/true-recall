import { useState } from "preact/hooks";

import type {
	AssistantManifest,
	AssistantTask,
	AssistantThread,
} from "@true-recall/core/ai/assistant";

import {
	ActionButton,
	MarkdownContent,
	StatusPill,
} from "@true-recall/obsidian/components";
import { Q, useQuery } from "@true-recall/obsidian/data";
import { usePlugin } from "@true-recall/obsidian/preact/ObsidianContext";
import { cn } from "@true-recall/obsidian/utils/cn";

import { AiComposer } from "./AiComposer";
import { FactCheckBlock } from "./FactCheckBlock";
import { ProposalActions, ProposalCard } from "./proposal/ProposalCard";
import type { ProposalReviewController } from "./proposal/proposal-review-controller";
import {
	useTaskProposalReview,
	useThreadProposalReview,
} from "./proposal/useProposalReview";
import { ThreadComposer, ThreadMessages, ThreadProgress } from "./ThreadParts";
import {
	hasPendingProposals,
	normalizedSelectedText,
	remainingCitations,
	statusTone,
} from "./thread-utils";

export { ProposalCard } from "./proposal/ProposalCard";

function ProposalList({
	controller,
	manifest,
	revision,
	numbered = false,
	disabled = false,
}: {
	controller: ProposalReviewController;
	manifest: AssistantManifest;
	/** Remounts the editors when an AI turn replaces the drafts. */
	revision?: number;
	numbered?: boolean;
	disabled?: boolean;
}) {
	return (
		<>
			<div
				class={cn(
					"tr-card-ai-preview-new-list",
					disabled && "ep:opacity-65 ep:pointer-events-none",
				)}
			>
				{manifest.proposals.map((proposal, index) => (
					<ProposalCard
						key={
							revision === undefined
								? proposal.id
								: `${proposal.id}:${revision}`
						}
						index={numbered ? index + 1 : undefined}
						controller={controller}
						proposal={proposal}
					/>
				))}
			</div>
			<ProposalActions
				controller={controller}
				manifest={manifest}
				disabled={disabled}
			/>
		</>
	);
}

function ManifestSummary({ manifest }: { manifest: AssistantManifest }) {
	const citations = remainingCitations(manifest);
	return (
		<>
			{manifest.factCheck ? (
				<FactCheckBlock result={manifest.factCheck} />
			) : null}
			{citations.length > 0 ? <CitationsBlock citations={citations} /> : null}
		</>
	);
}

export function TaskDetail({
	task,
	onReviewed,
}: {
	task: AssistantTask;
	onReviewed?: () => void;
}) {
	const plugin = usePlugin();
	const [feedback, setFeedback] = useState("");
	const review = useTaskProposalReview(task, onReviewed);
	const manifest = task.manifest;
	if (!manifest) return null;
	const selectedText = normalizedSelectedText(task.context.selectedText);

	return (
		<div class="tr-card-ai-preview-root ep:flex ep:flex-col ep:gap-3 ep:p-3 ep:border-t ep:border-obs-border">
			{selectedText ? <SelectedTextBlock text={selectedText} /> : null}

			<ManifestSummary manifest={manifest} />

			{manifest.finalText ? (
				<MarkdownContent
					markdown={manifest.finalText}
					filePath={task.context.activeNotePath}
					class="tr-assistant-thread-markdown ep:text-obs-muted"
				/>
			) : null}

			<ProposalList controller={review} manifest={manifest} />

			<div class="ep:flex ep:items-center ep:gap-2 ep:pt-3 ep:border-t ep:border-obs-border">
				<span class="ep:text-ui-smaller ep:text-obs-muted ep:whitespace-nowrap">
					Retry with feedback
				</span>
				<AiComposer
					value={feedback}
					onChange={setFeedback}
					placeholder="Feedback for retry (optional)…"
					onSubmit={() => {
						plugin.assistantService?.retryWithFeedback(task, feedback);
						setFeedback("");
					}}
				/>
			</div>
		</div>
	);
}

function SelectedTextBlock({ text }: { text: string }) {
	return (
		<section class="ep:flex ep:flex-col ep:gap-1 ep:p-2 ep:border ep:border-obs-border ep:rounded-md ep:bg-surface-raised">
			<div class="ep:text-ui-smaller ep:font-semibold ep:uppercase ep:tracking-wide ep:text-obs-muted">
				Selected text
			</div>
			<div class="ep:text-ui-small ep:whitespace-pre-wrap ep:break-words ep:text-obs-normal">
				{text}
			</div>
		</section>
	);
}

function CitationsBlock({
	citations,
}: {
	citations: Array<{ url: string; title?: string }>;
}) {
	return (
		<section class="tr-card-ai-preview-section">
			<h5 class="tr-card-ai-preview-column-title">Sources</h5>
			<div class="ep:grid ep:gap-1.5 ep:grid-cols-[repeat(auto-fit,minmax(180px,1fr))] ep:text-ui-smaller">
				{citations.map((citation) => (
					<a
						key={citation.url}
						class="ep:block ep:truncate ep:py-1 ep:px-2 ep:border ep:border-obs-border ep:rounded-md ep:bg-surface-raised"
						href={citation.url}
						rel="noopener"
					>
						{citation.title ?? citation.url}
					</a>
				))}
			</div>
		</section>
	);
}

function ThreadHeader({
	thread,
	statusLabel,
	isBusy,
	onClose,
}: {
	thread: AssistantThread;
	statusLabel: string;
	isBusy: boolean;
	onClose?: () => void;
}) {
	const plugin = usePlugin();
	const discard = () => {
		if (
			hasPendingProposals(thread) &&
			!activeWindow.confirm("Discard this AI draft conversation?")
		) {
			return;
		}
		plugin.assistantService?.deleteThread(thread.id);
		onClose?.();
	};

	return (
		<header class="ep:flex ep:items-center ep:gap-2 ep:min-w-0">
			<div class="ep:flex ep:items-center ep:gap-2 ep:min-w-0 ep:flex-1">
				<div class="ep:truncate ep:text-ui-small ep:font-semibold ep:text-obs-normal">
					{thread.title}
				</div>
				<StatusPill label={statusLabel} tone={statusTone(statusLabel)} />
			</div>
			<div class="ep:flex ep:items-center ep:gap-1 ep:shrink-0">
				{thread.revisions.length > 0 && !isBusy ? (
					<ActionButton
						label="Undo AI"
						variant="ghost"
						size="sm"
						onClick={() => plugin.assistantService?.undoThread(thread.id)}
					/>
				) : null}
				{thread.state === "active" ? (
					<ActionButton
						label="Later"
						variant="ghost"
						size="sm"
						onClick={() => {
							plugin.assistantService?.deferThread(thread.id);
							onClose?.();
						}}
					/>
				) : null}
				<ActionButton
					label="Discard"
					variant="ghost"
					size="sm"
					onClick={discard}
				/>
				{onClose ? (
					<ActionButton
						label="Close"
						variant="ghost"
						size="sm"
						onClick={onClose}
					/>
				) : null}
			</div>
		</header>
	);
}

export function ThreadWorkspace({
	thread,
	onClose,
}: {
	thread: AssistantThread;
	onClose?: () => void;
}) {
	const plugin = usePlugin();
	const tasks = useQuery<AssistantTask[]>(Q.ASSISTANT_TASKS).value ?? [];
	const review = useThreadProposalReview(thread, onClose);
	const activeTask = thread.activeTaskId
		? tasks.find((task) => task.id === thread.activeTaskId)
		: undefined;
	const progress = plugin.assistantService?.progress.value;
	const manifest = thread.manifest;
	const isBusy = !!thread.activeTaskId;
	const statusLabel =
		activeTask?.status ??
		(isBusy ? "pending" : thread.state === "archived" ? "applied" : "draft");
	const progressLines =
		progress && progress.taskId === thread.activeTaskId ? progress.lines : null;

	return (
		<div class="ep:flex ep:flex-col ep:gap-3 ep:min-w-0">
			<ThreadHeader
				thread={thread}
				statusLabel={statusLabel}
				isBusy={isBusy}
				onClose={onClose}
			/>

			<ThreadMessages
				messages={thread.messages}
				notePath={thread.context.activeNotePath}
			/>

			{isBusy ? <ThreadProgress thread={thread} lines={progressLines} /> : null}

			{manifest ? (
				<>
					<ManifestSummary manifest={manifest} />
					<ProposalList
						controller={review}
						manifest={manifest}
						revision={thread.revision}
						numbered
						disabled={isBusy}
					/>
				</>
			) : null}

			<ThreadComposer
				busy={isBusy}
				onSend={(message) => {
					// A follow-up snapshots the drafts; wait for an apply to land.
					if (review.state.value.busy) return false;
					return !!plugin.assistantService?.continueThread(thread.id, message);
				}}
				onStop={() => {
					if (thread.activeTaskId)
						plugin.assistantService?.cancel(thread.activeTaskId);
				}}
				onDismiss={onClose}
			/>
		</div>
	);
}
