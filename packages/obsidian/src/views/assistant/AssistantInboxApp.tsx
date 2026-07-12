import { useState } from "preact/hooks";

import type {
	AssistantProposal,
	AssistantTask,
} from "@true-recall/core/ai/assistant";

import { ActionButton, TextInput } from "@true-recall/obsidian/components";
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

	return (
		<article class={`tr-card-ai-preview-new-card is-${proposal.status}`}>
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
									{/* biome-ignore lint/a11y/useAltText: candidate title may be absent */}
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
		forceRender((n) => n + 1);
	};

	return (
		<div class="tr-card-ai-preview-root tr-inbox-detail">
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

export function AssistantInboxApp() {
	const plugin = usePlugin();
	const tasksSignal = useQuery<AssistantTask[]>(Q.ASSISTANT_TASKS);
	const tasks = tasksSignal.value ?? [];
	const progress = plugin.assistantService?.progress.value ?? null;
	const [openId, setOpenId] = useState<string | null>(null);

	const running = tasks.filter(
		(t) => t.status === "running" || t.status === "pending",
	);
	const ready = tasks.filter((t) => t.status === "done");
	const failed = tasks.filter((t) => t.status === "failed");

	return (
		<div class="tr-inbox">
			<h3>AI Inbox</h3>

			{running.map((task) => (
				<div key={task.id} class="tr-inbox-task is-running">
					<div class="tr-inbox-task-head">
						<span>{task.instruction}</span>
						<span class="tr-inbox-status">{task.status}</span>
					</div>
					{progress?.taskId === task.id &&
						progress.lines.slice(-3).map((line, i) => (
							<div key={`${task.id}-line-${i}`} class="tr-inbox-progress">
								{line}
							</div>
						))}
					<ActionButton
						label="Cancel"
						variant="ghost"
						onClick={() => plugin.assistantService?.cancel(task.id)}
					/>
				</div>
			))}

			{ready.map((task) => {
				const pending =
					task.manifest?.proposals.filter((p) => p.status === "proposed")
						.length ?? 0;
				return (
					<div key={task.id} class="tr-inbox-task is-ready">
						<button
							type="button"
							class="tr-inbox-task-head tr-inbox-task-head--clickable"
							onClick={() => setOpenId(openId === task.id ? null : task.id)}
						>
							<span>{task.instruction}</span>
							<span class="tr-inbox-status">{pending} pending</span>
						</button>
						{openId === task.id && <TaskDetail task={task} />}
					</div>
				);
			})}

			{failed.map((task) => (
				<div key={task.id} class="tr-inbox-task is-failed">
					<div class="tr-inbox-task-head">
						<span>{task.instruction}</span>
						<span class="tr-inbox-error">{task.error}</span>
					</div>
					<div class="tr-inbox-retry">
						<ActionButton
							label="Retry"
							variant="secondary"
							onClick={() =>
								plugin.assistantService?.retryWithFeedback(task, "")
							}
						/>
						<ActionButton
							label="Delete"
							variant="ghost"
							onClick={() => plugin.assistantService?.delete(task.id)}
						/>
					</div>
				</div>
			))}

			{tasks.length === 0 && (
				<p class="tr-inbox-empty">
					No AI tasks yet. Select text during review and hit “Ask AI”.
				</p>
			)}
		</div>
	);
}
