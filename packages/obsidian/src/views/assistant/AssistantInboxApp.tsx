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
import {
	TaskDetail,
	ThreadWorkspace,
} from "@true-recall/obsidian/features/assistant/ui/ThreadWorkspace";
import {
	formatTaskTime,
	isReviewedTask,
	selectedTextPreview,
	statusTone,
	taskStatusLabel,
} from "@true-recall/obsidian/features/assistant/ui/thread-utils";
import { usePlugin } from "@true-recall/obsidian/preact/ObsidianContext";
import { cn } from "@true-recall/obsidian/utils/cn";

const rowCls =
	"ep:grid ep:grid-cols-[minmax(0,1fr)_auto] ep:items-start ep:gap-2 ep:min-w-0";

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
					<IconButton
						icon="trash-2"
						ariaLabel="Delete AI conversation"
						size="small"
						danger
						onClick={() => plugin.assistantService?.deleteThread(thread.id)}
					/>
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
			</div>

			{threads.map((thread) => (
				<AssistantThreadItem
					key={thread.id}
					thread={thread}
					isOpen={openId === thread.id}
					onToggle={() => setOpenId(openId === thread.id ? null : thread.id)}
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
