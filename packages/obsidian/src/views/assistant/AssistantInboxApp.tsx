import type { ComponentChildren } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";

import type {
	AssistantTask,
	AssistantThread,
} from "@true-recall/core/ai/assistant";

import {
	ActionButton,
	Clickable,
	EmptyState,
	IconButton,
	StatusPill,
} from "@true-recall/obsidian/components";
import { Q, useQuery } from "@true-recall/obsidian/data";
import { applyPendingProposals } from "@true-recall/obsidian/features/assistant/ui/apply-pending-proposals";
import {
	TaskDetail,
	ThreadWorkspace,
} from "@true-recall/obsidian/features/assistant/ui/ThreadWorkspace";
import {
	formatTaskTime,
	isReviewedTask,
	selectedTextPreview,
	sortByInboxAdditionOrder,
	statusTone,
	taskStatusLabel,
	threadTask,
} from "@true-recall/obsidian/features/assistant/ui/thread-utils";
import { usePlugin } from "@true-recall/obsidian/preact/ObsidianContext";
import { AssistantApplyService } from "@true-recall/obsidian/services/assistant/assistant-apply.service";
import { notify } from "@true-recall/obsidian/services/notification.service";
import { cn } from "@true-recall/obsidian/utils/cn";

const rowCls =
	"tr-ai-inbox-item__header ep:grid ep:grid-cols-[minmax(0,1fr)_auto] ep:items-center ep:gap-2 ep:min-w-0";

function aiToolLabel(presetId: string | undefined): string {
	if (presetId?.startsWith("generation:")) return "Generator";
	if (presetId?.startsWith("card-polish:")) return "Card Polish";
	return "Assistant";
}

interface ThreadApprovalResult {
	appliedCount: number;
	conflictedCount: number;
	error?: string;
}

async function approveThreadProposals(
	plugin: ReturnType<typeof usePlugin>,
	thread: AssistantThread,
): Promise<ThreadApprovalResult | null> {
	const manifest = thread.manifest;
	if (!manifest || thread.activeTaskId) return null;
	const result = await applyPendingProposals(
		threadTask(thread),
		manifest,
		new AssistantApplyService(plugin),
	);
	plugin.assistantService?.updateThreadManifest(thread.id, manifest);
	if (!manifest.proposals.some((proposal) => proposal.status === "proposed")) {
		plugin.assistantService?.archiveThread(thread.id);
	}
	return result;
}

function TaskRowShell({
	statusClass,
	children,
}: {
	statusClass?: string;
	children: ComponentChildren;
}) {
	return (
		<article
			class={cn(
				"tr-ai-inbox-item ep:min-w-0 ep:overflow-hidden ep:transition-colors",
				statusClass,
			)}
		>
			{children}
		</article>
	);
}

function FailedTaskActions({ task }: { task: AssistantTask }) {
	const plugin = usePlugin();

	return (
		<div class="ep:flex ep:justify-end ep:gap-2 ep:p-2">
			<ActionButton
				label="Retry"
				variant="secondary"
				size="sm"
				icon="rotate-ccw"
				onClick={() => plugin.assistantService?.retryWithFeedback(task, "")}
			/>
		</div>
	);
}

function AssistantTaskItem({
	task,
	isOpen,
	onToggle,
}: {
	task: AssistantTask;
	isOpen: boolean;
	onToggle: () => void;
}) {
	const plugin = usePlugin();
	const progress = plugin.assistantService?.progress.value ?? null;
	const canExpand = task.status === "done" && !!task.manifest;
	const statusLabel = taskStatusLabel(task);
	const selectedText = selectedTextPreview(task.context.selectedText);

	const deleteTask = () => {
		if (task.status === "pending" || task.status === "running") {
			plugin.assistantService?.cancel(task.id);
		}
		plugin.assistantService?.delete(task.id);
	};

	return (
		<TaskRowShell
			statusClass={cn(
				(task.status === "running" || task.status === "pending") &&
					"ep:border-obs-interactive",
				task.status === "failed" && "ep:border-obs-red",
				task.status === "cancelled" && "ep:opacity-70",
			)}
		>
			<header class={rowCls}>
				<Clickable
					class="tr-ai-inbox-item__summary ep:block ep:min-w-0 ep:text-left"
					role={canExpand ? "button" : "group"}
					aria-expanded={canExpand ? isOpen : undefined}
					onClick={() => {
						if (canExpand) onToggle();
					}}
				>
					<span class="tr-ai-inbox-item__copy">
						<span class="tr-ai-inbox-item__tool">
							{aiToolLabel(task.presetId)}
						</span>
						<span class="tr-ai-inbox-item__title">{task.instruction}</span>
						{selectedText && (
							<span class="tr-ai-inbox-item__preview">{selectedText}</span>
						)}
						<span class="tr-ai-inbox-item__time">{formatTaskTime(task)}</span>
					</span>
				</Clickable>

				<div class="tr-ai-inbox-item__actions">
					<Clickable
						role={canExpand ? "button" : "group"}
						aria-expanded={canExpand ? isOpen : undefined}
						onClick={() => {
							if (canExpand) onToggle();
						}}
					>
						<StatusPill label={statusLabel} tone={statusTone(task.status)} />
					</Clickable>

					{(task.status === "pending" || task.status === "running") && (
						<IconButton
							icon="x"
							ariaLabel="Cancel AI task"
							size="small"
							onClick={() => plugin.assistantService?.cancel(task.id)}
						/>
					)}
					<IconButton
						icon="trash-2"
						ariaLabel="Delete AI task"
						size="small"
						danger
						onClick={deleteTask}
					/>
				</div>
			</header>

			{task.error && (
				<p class="ep:text-obs-red ep:text-ui-smaller ep:break-words ep:m-0 ep:px-3 ep:pb-2">
					{task.error}
				</p>
			)}

			{progress?.taskId === task.id && (
				<div class="ep:flex ep:flex-col ep:gap-1 ep:mx-3 ep:mb-2.5 ep:pt-2 ep:border-t ep:border-obs-border">
					{progress.lines.slice(-3).map((line, i) => (
						<div
							key={`${task.id}-line-${i}`}
							class="ep:text-ui-smaller ep:text-obs-muted ep:leading-snug"
						>
							{line}
						</div>
					))}
				</div>
			)}

			{task.status === "failed" && <FailedTaskActions task={task} />}
			{canExpand && isOpen && <TaskDetail task={task} />}
		</TaskRowShell>
	);
}

function AssistantThreadItem({
	thread,
	isOpen,
	onToggle,
}: {
	thread: AssistantThread;
	isOpen: boolean;
	onToggle: () => void;
}) {
	const plugin = usePlugin();
	const pending =
		thread.manifest?.proposals.filter(
			(proposal) => proposal.status === "proposed",
		).length ?? 0;
	const status = thread.activeTaskId
		? "working"
		: pending > 0
			? `${pending} to review`
			: "conversation";
	const statusClass = cn(thread.activeTaskId && "ep:border-obs-interactive");

	if (isOpen) {
		return (
			<TaskRowShell statusClass={statusClass}>
				<div class="tr-ai-inbox-item__workspace">
					<ThreadWorkspace thread={thread} onClose={onToggle} />
				</div>
			</TaskRowShell>
		);
	}

	return (
		<TaskRowShell statusClass={statusClass}>
			<header class={rowCls}>
				<Clickable
					class="tr-ai-inbox-item__summary ep:block ep:min-w-0 ep:text-left"
					role="button"
					aria-expanded={false}
					onClick={onToggle}
				>
					<span class="tr-ai-inbox-item__copy">
						<span class="tr-ai-inbox-item__tool">
							{aiToolLabel(threadTask(thread).presetId)}
						</span>
						<span class="tr-ai-inbox-item__title">{thread.title}</span>
						<span class="tr-ai-inbox-item__time">
							{new Date(thread.updatedAt).toLocaleString()}
						</span>
					</span>
				</Clickable>
				<div class="tr-ai-inbox-item__actions">
					<Clickable onClick={onToggle}>
						<StatusPill
							label={status}
							tone={statusTone(thread.activeTaskId ? "working" : status)}
						/>
					</Clickable>
					<IconButton
						icon="trash-2"
						ariaLabel="Delete AI conversation"
						size="small"
						danger
						onClick={() => plugin.assistantService?.deleteThread(thread.id)}
					/>
				</div>
			</header>
		</TaskRowShell>
	);
}

export function AssistantInboxApp() {
	const plugin = usePlugin();
	const tasksSignal = useQuery<AssistantTask[]>(Q.ASSISTANT_TASKS);
	const threadsSignal = useQuery<AssistantThread[]>(Q.ASSISTANT_INBOX);
	// Both feed the cleanup effect below. Rebuilding either array on every render
	// would re-run that effect on every render, and it deletes reviewed tasks.
	const tasks = useMemo(
		() => (tasksSignal.value ?? []).filter((task) => !task.threadId),
		[tasksSignal.value],
	);
	const threads = useMemo(
		() => threadsSignal.value ?? [],
		[threadsSignal.value],
	);
	const [openId, setOpenId] = useState<string | null>(null);
	const [isApprovingInbox, setIsApprovingInbox] = useState(false);
	const reviewableThreads = threads.filter(
		(thread) =>
			!thread.activeTaskId &&
			thread.manifest?.proposals.some(
				(proposal) => proposal.status === "proposed",
			),
	);
	const pendingProposalCount = reviewableThreads.reduce(
		(total, thread) =>
			total +
			(thread.manifest?.proposals.filter(
				(proposal) => proposal.status === "proposed",
			).length ?? 0),
		0,
	);

	const approveInbox = async () => {
		if (isApprovingInbox || reviewableThreads.length === 0) return;
		setIsApprovingInbox(true);
		let appliedCount = 0;
		let conflictedCount = 0;
		let failedThreadCount = 0;
		try {
			for (const thread of sortByInboxAdditionOrder(reviewableThreads)) {
				const result = await approveThreadProposals(plugin, thread);
				if (!result) continue;
				appliedCount += result.appliedCount;
				conflictedCount += result.conflictedCount;
				if (result.error) failedThreadCount++;
			}
		} finally {
			setIsApprovingInbox(false);
		}
		if (appliedCount > 0) {
			notify().success(`Applied ${appliedCount} AI drafts`);
		}
		if (conflictedCount > 0) {
			notify().info(
				`${conflictedCount} draft${conflictedCount === 1 ? "" : "s"} need individual review`,
			);
		}
		if (failedThreadCount > 0) {
			notify().error(
				`Could not finish ${failedThreadCount} conversation${failedThreadCount === 1 ? "" : "s"}`,
			);
		}
	};

	useEffect(() => {
		const onFocusThread = (e: Event) => {
			const threadId = (e as CustomEvent<{ threadId: string }>).detail
				?.threadId;
			if (threadId) setOpenId(threadId);
		};
		window.addEventListener(
			"true-recall:assistant-focus-thread",
			onFocusThread,
		);
		return () =>
			window.removeEventListener(
				"true-recall:assistant-focus-thread",
				onFocusThread,
			);
	}, []);

	useEffect(() => {
		for (const task of tasks) {
			if (isReviewedTask(task)) {
				plugin.assistantService?.delete(task.id);
			}
		}
		if (
			openId &&
			!tasks.some((task) => task.id === openId) &&
			!threads.some((thread) => thread.id === openId)
		) {
			setOpenId(null);
		}
	}, [tasks, threads, plugin, openId]);
	const count = threads.length + tasks.length;

	return (
		<div class="tr-ai-inbox ep:text-obs-normal">
			<section class="tr-ai-inbox__queue">
				<header class="tr-ai-inbox__queue-header">
					<div>
						<div class="tr-ai-inbox__eyebrow">AI inbox</div>
						<h1>Review queue</h1>
						<p>
							{count === 0
								? "Nothing needs your attention"
								: `${count} active ${count === 1 ? "item" : "items"}`}
						</p>
					</div>
					<div class="tr-ai-inbox__queue-actions">
						<div class="tr-ai-inbox__summary">
							<strong>{pendingProposalCount}</strong>
							<span>to review</span>
						</div>
						<ActionButton
							label={isApprovingInbox ? "Applying…" : "Apply all"}
							variant="primary"
							size="sm"
							disabled={pendingProposalCount === 0 || isApprovingInbox}
							onClick={() => void approveInbox()}
						/>
					</div>
				</header>

				<div class="tr-ai-inbox__items">
					{threads.map((thread) => (
						<AssistantThreadItem
							key={thread.id}
							thread={thread}
							isOpen={openId === thread.id}
							onToggle={() =>
								setOpenId(openId === thread.id ? null : thread.id)
							}
						/>
					))}

					{tasks.map((task) => (
						<AssistantTaskItem
							key={task.id}
							task={task}
							isOpen={openId === task.id}
							onToggle={() => setOpenId(openId === task.id ? null : task.id)}
						/>
					))}

					{count === 0 ? (
						<div class="tr-ai-inbox__empty">
							<EmptyState
								icon="✨"
								message="Nothing needs attention. New AI tasks will appear here when they are ready for review."
							/>
						</div>
					) : null}
				</div>
			</section>
		</div>
	);
}
