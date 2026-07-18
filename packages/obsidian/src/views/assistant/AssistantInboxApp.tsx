import { useEffect, useState } from "preact/hooks";

import type {
	AssistantProposal,
	AssistantTask,
	AssistantThread,
} from "@true-recall/core/ai/assistant";

import {
	ActionButton,
	Clickable,
	IconButton,
	TextInput,
} from "@true-recall/obsidian/components";
import { Q, useQuery } from "@true-recall/obsidian/data";
import { usePlugin } from "@true-recall/obsidian/preact/ObsidianContext";
import { notify } from "@true-recall/obsidian/services/notification.service";

import { AssistantApplyService } from "../../services/assistant/assistant-apply.service";
import { CardAIField } from "@true-recall/plugins/shared/CardAIField";

function proposalTitle(p: AssistantProposal): string {
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

function formatTaskTime(task: AssistantTask): string {
	const timestamp = task.finishedAt ?? task.createdAt;
	return new Date(timestamp).toLocaleString(undefined, {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function taskStatusLabel(task: AssistantTask): string {
	if (task.status !== "done") return task.status;
	const proposals = task.manifest?.proposals ?? [];
	if (proposals.length === 0) return "no proposals";
	const pending = proposals.filter((p) => p.status === "proposed").length;
	if (pending === 0) return "reviewed";
	return `${pending} to review`;
}

function isReviewedTask(task: AssistantTask): boolean {
	const proposals = task.manifest?.proposals ?? [];
	return (
		task.status === "done" &&
		proposals.length > 0 &&
		proposals.every((p) => p.status !== "proposed")
	);
}

function normalizedSelectedText(text: string | undefined): string | null {
	const trimmed = text?.replace(/\s+/g, " ").trim();
	if (!trimmed) return null;
	return trimmed;
}

function selectedTextPreview(text: string | undefined): string | null {
	const normalized = normalizedSelectedText(text);
	if (!normalized) return null;
	return normalized.length > 140
		? `${normalized.slice(0, 137)}...`
		: normalized;
}

/** Editable text content for the non-card proposal types (null = not applicable). */
function contentField(
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

function ProposalCard({
	task,
	proposal,
	apply,
	persist,
	persistDraft,
	index,
}: {
	task: AssistantTask;
	proposal: AssistantProposal;
	apply: AssistantApplyService;
	persist: () => void;
	persistDraft?: () => void;
	index?: number;
}) {
	const isCard =
		proposal.type === "create_card" ||
		proposal.type === "update_card" ||
		proposal.type === "update_draft";
	const content = contentField(proposal);

	const [fields, setFields] = useState<Record<string, string>>(() =>
		isCard ? { ...proposal.fields } : {},
	);
	const [text, setText] = useState(() => content?.value ?? "");
	const [imageSel, setImageSel] = useState<Set<number>>(() => new Set());

	const runApply = async (force = false) => {
		// Sync local edits onto the proposal before applying.
		if (isCard) proposal.fields = fields;
		if (proposal.type === "append_to_note" || proposal.type === "create_note") {
			proposal.markdown = text;
		}
		if (proposal.type === "insert_diagram") proposal.code = text;
		if (proposal.type === "attach_images") {
			proposal.candidates.forEach((c, i) => {
				c.selected = imageSel.has(i);
			});
		}

		const result = await apply.apply(task, proposal, {
			fields: isCard ? fields : undefined,
			force,
		});
		if (result.ok) {
			proposal.status = "applied";
			persist();
			notify().success("Applied");
		} else if (result.conflictFields) {
			const confirmed = activeWindow.confirm(
				`Fields changed since the AI saw them: ${result.conflictFields.join(", ")}. Apply anyway?`,
			);
			if (confirmed) await runApply(true);
		} else if (result.error) {
			notify().error(result.error);
		}
	};

	const reject = () => {
		proposal.status = "rejected";
		persist();
	};
	const stateClass =
		proposal.status === "proposed"
			? "is-proposed is-selected"
			: `is-${proposal.status}`;

	return (
		<article class={`tr-card-ai-preview-new-card ${stateClass}`}>
			<header class="tr-card-ai-preview-new-card-header">
				<span class="tr-card-ai-preview-new-card-index">
					{proposalTitle(proposal)}
					{index ? ` #${index}` : ""}
				</span>
				<span class="tr-inbox-status">{proposal.status}</span>
			</header>

			{proposal.status === "proposed" && (
				<div class="tr-card-ai-preview-new-card-body">
					{isCard &&
						Object.keys(proposal.fields).map((name) => (
							<CardAIField
								key={name}
								label={name}
								value={fields[name] ?? ""}
								onChange={(v) => {
									const next = { ...fields, [name]: v };
									setFields(next);
									proposal.fields = next;
									persistDraft?.();
								}}
							/>
						))}

					{content && (
						<CardAIField
							label={content.label}
							value={text}
							onChange={setText}
						/>
					)}

					{proposal.type === "attach_images" && (
						<div class="tr-inbox-images">
							{proposal.candidates.map((c, i) => (
								<label key={c.url} class="tr-inbox-image">
									<input
										type="checkbox"
										checked={imageSel.has(i)}
										onChange={() =>
											setImageSel((prev) => {
												const next = new Set(prev);
												if (next.has(i)) next.delete(i);
												else next.add(i);
												return next;
											})
										}
									/>
									<img
										src={c.thumbnailUrl ?? c.url}
										alt={c.title ?? ""}
										loading="lazy"
									/>
									<span>
										{c.title ?? c.url} {c.license ? `(${c.license})` : ""}
									</span>
								</label>
							))}
						</div>
					)}

					<div class="tr-card-ai-preview-actions">
						<ActionButton
							label="Apply"
							variant="primary"
							onClick={() => void runApply()}
						/>
						<ActionButton label="Reject" variant="ghost" onClick={reject} />
					</div>
				</div>
			)}
		</article>
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
	const [, forceRender] = useState(0);
	const manifest = task.manifest;
	if (!manifest) return null;
	const apply = new AssistantApplyService(plugin);

	const persist = () => {
		plugin.assistantService?.updateManifest(task.id, manifest);
		if (isReviewedTask(task)) {
			plugin.assistantService?.delete(task.id);
			onReviewed?.();
			return;
		}
		forceRender((n) => n + 1);
	};
	const selectedText = normalizedSelectedText(task.context.selectedText);

	return (
		<div class="tr-card-ai-preview-root tr-inbox-detail">
			{selectedText && (
				<section class="tr-inbox-selected">
					<div class="tr-inbox-selected-label">Selected text</div>
					<div class="tr-inbox-selected-text">{selectedText}</div>
				</section>
			)}

			{manifest.citations.length > 0 && (
				<section class="tr-card-ai-preview-section">
					<h5 class="tr-card-ai-preview-column-title">Sources</h5>
					<div class="tr-inbox-citations">
						{manifest.citations.map((c) => (
							<a key={c.url} href={c.url} rel="noopener">
								{c.title ?? c.url}
							</a>
						))}
					</div>
				</section>
			)}

			{manifest.finalText && <p class="tr-inbox-final">{manifest.finalText}</p>}

			<div class="tr-card-ai-preview-new-list">
				{manifest.proposals.map((proposal) => (
					<ProposalCard
						key={proposal.id}
						task={task}
						proposal={proposal}
						apply={apply}
						persist={persist}
					/>
				))}
			</div>

			<div class="tr-inbox-retry">
				<span class="tr-inbox-retry-label">Retry with feedback</span>
				<TextInput
					value={feedback}
					onChange={setFeedback}
					placeholder="Feedback for retry (optional)…"
				/>
				<ActionButton
					label="Retry"
					variant="secondary"
					onClick={() => {
						plugin.assistantService?.retryWithFeedback(task, feedback);
						setFeedback("");
					}}
				/>
			</div>
		</div>
	);
}

function threadTask(
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

function hasPendingProposals(thread: AssistantThread): boolean {
	return (
		thread.manifest?.proposals.some(
			(proposal) => proposal.status === "proposed",
		) ?? false
	);
}

export function ThreadWorkspace({
	thread,
	onClose,
	inline = false,
}: {
	thread: AssistantThread;
	onClose?: () => void;
	inline?: boolean;
}) {
	const plugin = usePlugin();
	const tasks = useQuery<AssistantTask[]>(Q.ASSISTANT_TASKS).value ?? [];
	const activeTask = thread.activeTaskId
		? tasks.find((task) => task.id === thread.activeTaskId)
		: undefined;
	const task = threadTask(thread, activeTask);
	const progress = plugin.assistantService?.progress.value;
	const manifest = thread.manifest;
	const [message, setMessage] = useState("");
	const [, forceRender] = useState(0);
	const apply = new AssistantApplyService(plugin);
	const isBusy = !!thread.activeTaskId;

	const persist = () => {
		if (!manifest) return;
		plugin.assistantService?.updateThreadManifest(thread.id, manifest);
		if (!hasPendingProposals({ ...thread, manifest })) {
			plugin.assistantService?.archiveThread(thread.id);
			onClose?.();
			return;
		}
		forceRender((value) => value + 1);
	};

	const applyAll = async () => {
		if (!manifest || isBusy) return;
		let appliedCount = 0;
		let failed = false;
		for (const proposal of manifest.proposals) {
			if (proposal.status !== "proposed") continue;
			let result = await apply.apply(task, proposal, {
				fields:
					proposal.type === "create_card" ||
					proposal.type === "update_card" ||
					proposal.type === "update_draft"
						? proposal.fields
						: undefined,
			});
			if (result.conflictFields) {
				const confirmed = activeWindow.confirm(
					`Fields changed since AI saw them: ${result.conflictFields.join(", ")}. Apply anyway?`,
				);
				if (confirmed)
					result = await apply.apply(task, proposal, { force: true });
			}
			if (!result.ok) {
				notify().error(result.error ?? "Could not apply all drafts");
				failed = true;
				break;
			}
			proposal.status = "applied";
			appliedCount++;
		}
		persist();
		if (!failed && appliedCount > 0) notify().success("Applied AI drafts");
	};

	const send = () => {
		if (!message.trim() || isBusy) return;
		const taskId = plugin.assistantService?.continueThread(thread.id, message);
		if (taskId) setMessage("");
	};

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
		<div
			class={`tr-ask-ai-box tr-assistant-thread-workspace${inline ? " tr-assistant-inline-task" : ""}`}
		>
			<header class="tr-assistant-inline-header">
				<div>
					<div class="tr-assistant-thread-title">{thread.title}</div>
					<span
						class={`tr-inbox-status is-${activeTask?.status ?? thread.state}`}
					>
						{activeTask?.status ?? (isBusy ? "pending" : "draft")}
					</span>
				</div>
				<div class="tr-inbox-inline-actions">
					{thread.revisions.length > 0 && !isBusy ? (
						<ActionButton
							label="Undo AI"
							variant="ghost"
							size="sm"
							onClick={() => plugin.assistantService?.undoThread(thread.id)}
						/>
					) : null}
					{thread.state !== "inbox" ? (
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

			<div class="tr-assistant-thread-messages">
				{thread.messages.slice(-6).map((turn) => (
					<div
						key={turn.id}
						class={`tr-assistant-thread-message is-${turn.role}`}
					>
						<span>{turn.role === "user" ? "You" : "AI"}</span>
						<p>{turn.content}</p>
					</div>
				))}
			</div>

			{isBusy ? (
				<div class="tr-inbox-progress-list">
					{progress &&
					progress.taskId === thread.activeTaskId &&
					progress.lines.length > 0 ? (
						progress.lines.slice(-3).map((line, index) => (
							<div key={`${thread.id}-${index}`} class="tr-inbox-progress">
								{line}
							</div>
						))
					) : (
						<div class="tr-inbox-progress">Waiting for AI…</div>
					)}
				</div>
			) : null}

			{manifest ? (
				<>
					{manifest.evidence && manifest.evidence.length > 0 ? (
						<section class="tr-card-ai-preview-section">
							<h5 class="tr-card-ai-preview-column-title">Vault evidence</h5>
							<div class="tr-assistant-thread-evidence">
								{manifest.evidence.map((item) => (
									<div key={item.id} class="tr-assistant-thread-evidence-item">
										<strong>
											{item.sourcePath ?? item.sourceId}
											{item.heading ? ` · ${item.heading}` : ""}
										</strong>
										<p>{item.excerpt}</p>
									</div>
								))}
							</div>
						</section>
					) : null}
					{manifest.citations.length > 0 ? (
						<section class="tr-card-ai-preview-section">
							<h5 class="tr-card-ai-preview-column-title">Sources</h5>
							<div class="tr-inbox-citations">
								{manifest.citations.map((citation) => (
									<a key={citation.url} href={citation.url} rel="noopener">
										{citation.title ?? citation.url}
									</a>
								))}
							</div>
						</section>
					) : null}
					<div class={`tr-card-ai-preview-new-list${isBusy ? " is-busy" : ""}`}>
						{manifest.proposals.map((proposal, index) => (
							<ProposalCard
								key={`${proposal.id}:${thread.revision}`}
								index={index + 1}
								task={task}
								proposal={proposal}
								apply={apply}
								persist={persist}
								persistDraft={() =>
									plugin.assistantService?.updateThreadManifest(
										thread.id,
										manifest,
									)
								}
							/>
						))}
					</div>
					{hasPendingProposals(thread) ? (
						<ActionButton
							label="Apply all"
							variant="primary"
							onClick={() => void applyAll()}
							disabled={isBusy}
						/>
					) : null}
				</>
			) : null}

			<div class="tr-assistant-thread-compose">
				<TextInput
					value={message}
					onChange={setMessage}
					placeholder="Tell AI what to change or add…"
				/>
				<ActionButton
					label="Send"
					variant="secondary"
					onClick={send}
					disabled={!message.trim() || isBusy}
				/>
			</div>
		</div>
	);
}

function FailedTaskActions({ task }: { task: AssistantTask }) {
	const plugin = usePlugin();

	return (
		<div class="tr-inbox-inline-actions">
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
		<article class={`tr-inbox-task is-${task.status}`}>
			<header class="tr-inbox-task-row">
				<Clickable
					class={`tr-inbox-task-main${canExpand ? "" : " is-static"}`}
					role={canExpand ? "button" : "group"}
					aria-expanded={canExpand ? isOpen : undefined}
					onClick={() => {
						if (canExpand) onToggle();
					}}
				>
					<span class="tr-inbox-task-copy">
						<span class="tr-inbox-task-title">{task.instruction}</span>
						{selectedText && (
							<span class="tr-inbox-task-selection">{selectedText}</span>
						)}
						<span class="tr-inbox-task-meta">{formatTaskTime(task)}</span>
					</span>
				</Clickable>

				<div class="tr-inbox-task-rail">
					<Clickable
						class={`tr-inbox-task-state${canExpand ? "" : " is-static"}`}
						role={canExpand ? "button" : "group"}
						aria-expanded={canExpand ? isOpen : undefined}
						onClick={() => {
							if (canExpand) onToggle();
						}}
					>
						<span class={`tr-inbox-status is-${task.status}`}>
							{statusLabel}
						</span>
					</Clickable>

					<div class="tr-inbox-task-actions">
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

			{task.error && <p class="tr-inbox-error">{task.error}</p>}

			{progress?.taskId === task.id && (
				<div class="tr-inbox-progress-list">
					{progress.lines.slice(-3).map((line, i) => (
						<div key={`${task.id}-line-${i}`} class="tr-inbox-progress">
							{line}
						</div>
					))}
				</div>
			)}

			{task.status === "failed" && <FailedTaskActions task={task} />}
			{canExpand && isOpen && <TaskDetail task={task} />}
		</article>
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
		<article class="tr-inbox-task is-thread">
			<header class="tr-inbox-task-row">
				<Clickable
					class="tr-inbox-task-main"
					role="button"
					aria-expanded={isOpen}
					onClick={onToggle}
				>
					<span class="tr-inbox-task-copy">
						<span class="tr-inbox-task-title">{thread.title}</span>
						<span class="tr-inbox-task-meta">
							{new Date(thread.updatedAt).toLocaleString()}
						</span>
					</span>
				</Clickable>
				<div class="tr-inbox-task-rail">
					<Clickable class="tr-inbox-task-state" onClick={onToggle}>
						<span class="tr-inbox-status">{status}</span>
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
			{isOpen ? <ThreadWorkspace thread={thread} /> : null}
		</article>
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
		<div class="tr-inbox">
			<div class="tr-inbox-header">
				<div class="tr-inbox-title-group">
					<div class="tr-inbox-title">AI Inbox</div>
					<div class="tr-inbox-count">{count}</div>
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
				<p class="tr-inbox-empty">
					Nothing needs attention. Active AI drafts stay where you started them
					until you choose Later.
				</p>
			)}
		</div>
	);
}
