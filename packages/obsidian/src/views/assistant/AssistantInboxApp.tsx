import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";

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
	"ep:grid ep:grid-cols-[minmax(0,1fr)_auto] ep:items-start ep:gap-2 ep:min-w-0";

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

function notifyThreadApproval(result: ThreadApprovalResult): void {
	if (result.conflictedCount > 0) {
		notify().info(
			`${result.conflictedCount} draft${result.conflictedCount === 1 ? "" : "s"} changed since the AI saw them — apply them individually`,
		);
	}
	if (result.error) notify().error(result.error);
	if (!result.error && result.appliedCount > 0) {
		notify().success("Applied AI drafts");
	}
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
				"ep:min-w-0 ep:overflow-hidden ep:rounded-lg ep:border ep:border-obs-border ep:bg-surface-raised ep:transition-colors",
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
					class="ep:block ep:min-w-0 ep:py-2.5 ep:pl-3 ep:text-left"
					role={canExpand ? "button" : "group"}
					aria-expanded={canExpand ? isOpen : undefined}
					onClick={() => {
						if (canExpand) onToggle();
					}}
				>
					<span class="ep:flex ep:flex-col ep:gap-0.5 ep:min-w-0">
						<span class="ep:truncate ep:text-ui-small ep:font-semibold ep:text-obs-normal">
							{task.instruction}
						</span>
						{selectedText && (
							<span class="ep:truncate ep:text-ui-smaller ep:text-obs-muted">
								{selectedText}
							</span>
						)}
						<span class="ep:text-ui-smaller ep:text-obs-muted">
							{formatTaskTime(task)}
						</span>
					</span>
				</Clickable>

				<div class="ep:flex ep:flex-col ep:items-end ep:gap-2 ep:py-2 ep:pr-2">
					<Clickable
						role={canExpand ? "button" : "group"}
						aria-expanded={canExpand ? isOpen : undefined}
						onClick={() => {
							if (canExpand) onToggle();
						}}
					>
						<StatusPill label={statusLabel} tone={statusTone(task.status)} />
					</Clickable>

					<div class="ep:flex ep:items-center ep:gap-0.5">
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
	isApproving,
	onToggle,
	onApprove,
}: {
	thread: AssistantThread;
	isOpen: boolean;
	isApproving: boolean;
	onToggle: () => void;
	onApprove: () => void;
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

	return (
		<TaskRowShell
			statusClass={cn(thread.activeTaskId && "ep:border-obs-interactive")}
		>
			<header class={rowCls}>
				<Clickable
					class="ep:block ep:min-w-0 ep:py-2.5 ep:pl-3 ep:text-left"
					role="button"
					aria-expanded={isOpen}
					onClick={onToggle}
				>
					<span class="ep:flex ep:flex-col ep:gap-0.5 ep:min-w-0">
						<span class="ep:truncate ep:text-ui-small ep:font-semibold ep:text-obs-normal">
							{thread.title}
						</span>
						<span class="ep:text-ui-smaller ep:text-obs-muted">
							{new Date(thread.updatedAt).toLocaleString()}
						</span>
					</span>
				</Clickable>
				<div class="ep:flex ep:flex-col ep:items-end ep:gap-2 ep:py-2 ep:pr-2">
					<Clickable onClick={onToggle}>
						<StatusPill
							label={status}
							tone={statusTone(thread.activeTaskId ? "working" : status)}
						/>
					</Clickable>
					<div class="ep:flex ep:items-center ep:gap-1">
						{pending > 0 && !thread.activeTaskId ? (
							<ActionButton
								label={isApproving ? "Approving…" : "Approve all"}
								variant="primary"
								size="sm"
								disabled={isApproving}
								onClick={onApprove}
							/>
						) : null}
						<IconButton
							icon="trash-2"
							ariaLabel="Delete AI conversation"
							size="small"
							danger
							onClick={() => plugin.assistantService?.deleteThread(thread.id)}
						/>
					</div>
				</div>
			</header>
			{isOpen ? (
				<div class="ep:border-t ep:border-obs-border ep:p-3">
					<ThreadWorkspace thread={thread} />
				</div>
			) : null}
		</TaskRowShell>
	);
}

export function AssistantInboxApp() {
	const plugin = usePlugin();
	const tasksSignal = useQuery<AssistantTask[]>(Q.ASSISTANT_TASKS);
	const tasks = (tasksSignal.value ?? []).filter((task) => !task.threadId);
	const threadsSignal = useQuery<AssistantThread[]>(Q.ASSISTANT_INBOX);
	const threads = threadsSignal.value ?? [];
	const [openId, setOpenId] = useState<string | null>(null);
	const [approvingIds, setApprovingIds] = useState<Set<string>>(
		() => new Set(),
	);
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

	const markApproving = (threadId: string, isApproving: boolean) => {
		setApprovingIds((current) => {
			const next = new Set(current);
			if (isApproving) next.add(threadId);
			else next.delete(threadId);
			return next;
		});
	};

	const approveOneThread = async (thread: AssistantThread) => {
		if (approvingIds.has(thread.id) || isApprovingInbox) return;
		markApproving(thread.id, true);
		try {
			const result = await approveThreadProposals(plugin, thread);
			if (result) notifyThreadApproval(result);
		} finally {
			markApproving(thread.id, false);
		}
	};

	const approveInbox = async () => {
		if (isApprovingInbox || reviewableThreads.length === 0) return;
		setIsApprovingInbox(true);
		let appliedCount = 0;
		let conflictedCount = 0;
		let failedThreadCount = 0;
		try {
			for (const thread of sortByInboxAdditionOrder(reviewableThreads)) {
				markApproving(thread.id, true);
				try {
					const result = await approveThreadProposals(plugin, thread);
					if (!result) continue;
					appliedCount += result.appliedCount;
					conflictedCount += result.conflictedCount;
					if (result.error) failedThreadCount++;
				} finally {
					markApproving(thread.id, false);
				}
			}
		} finally {
			setIsApprovingInbox(false);
		}
		if (appliedCount > 0) {
			notify().success(`Approved ${appliedCount} AI drafts`);
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
		<div class="ep:flex ep:flex-col ep:gap-2 ep:px-1 ep:pb-2 ep:min-w-0 ep:text-obs-normal">
			<div class="ep:flex ep:items-center ep:justify-between ep:gap-3">
				<div class="ep:flex ep:items-center ep:gap-2.5">
					<div class="ep:text-ui-small ep:font-bold">AI Inbox</div>
					<StatusPill label={String(count)} />
				</div>
				<ActionButton
					label={isApprovingInbox ? "Approving…" : "Approve all"}
					variant="primary"
					size="sm"
					disabled={pendingProposalCount === 0 || isApprovingInbox}
					onClick={() => void approveInbox()}
				/>
			</div>

			{threads.map((thread) => (
				<AssistantThreadItem
					key={thread.id}
					thread={thread}
					isOpen={openId === thread.id}
					isApproving={approvingIds.has(thread.id) || isApprovingInbox}
					onToggle={() => setOpenId(openId === thread.id ? null : thread.id)}
					onApprove={() => void approveOneThread(thread)}
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

			{count === 0 && (
				<EmptyState
					icon="✨"
					message="Nothing needs attention. Active AI drafts stay where you started them until you choose Later."
				/>
			)}
		</div>
	);
}
