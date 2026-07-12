import { useEffect, useState } from "preact/hooks";

import type {
	AssistantProposal,
	AssistantTask,
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
}: {
	task: AssistantTask;
	proposal: AssistantProposal;
	apply: AssistantApplyService;
	persist: () => void;
}) {
	const isCard =
		proposal.type === "create_card" || proposal.type === "update_card";
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
								onChange={(v) => setFields((prev) => ({ ...prev, [name]: v }))}
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

function TaskDetail({ task }: { task: AssistantTask }) {
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

export function AssistantInboxApp() {
	const plugin = usePlugin();
	const tasksSignal = useQuery<AssistantTask[]>(Q.ASSISTANT_TASKS);
	const tasks = tasksSignal.value ?? [];
	const [openId, setOpenId] = useState<string | null>(null);

	useEffect(() => {
		for (const task of tasks) {
			if (isReviewedTask(task)) {
				plugin.assistantService?.delete(task.id);
			}
		}
		if (openId && !tasks.some((task) => task.id === openId)) {
			setOpenId(null);
		}
	}, [tasks, plugin, openId]);

	return (
		<div class="tr-inbox">
			<div class="tr-inbox-header">
				<div class="tr-inbox-title-group">
					<div class="tr-inbox-title">AI Inbox</div>
					<div class="tr-inbox-count">{tasks.length}</div>
				</div>
			</div>

			{tasks.map((task) => (
				<AssistantTaskItem
					key={task.id}
					task={task}
					isOpen={openId === task.id}
					onToggle={() => setOpenId(openId === task.id ? null : task.id)}
				/>
			))}

			{tasks.length === 0 && (
				<p class="tr-inbox-empty">
					No AI tasks yet. Select text during review to ask AI.
				</p>
			)}
		</div>
	);
}
