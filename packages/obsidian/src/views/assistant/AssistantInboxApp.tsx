import type {
	AssistantProposal,
	AssistantTask,
	ImageCandidate,
} from "@true-recall/core/ai/assistant";
import { Clickable } from "@true-recall/obsidian/components";
import { Q, useQuery } from "@true-recall/obsidian/data";
import { usePlugin } from "@true-recall/obsidian/preact/ObsidianContext";
import { notify } from "@true-recall/obsidian/services/notification.service";
import { useState } from "preact/hooks";
import { AssistantApplyService } from "../../services/assistant/assistant-apply.service";

function proposalSummary(p: AssistantProposal): string {
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
			return `Images (${p.candidates.length} candidates)`;
	}
}

function ProposalEditor({
	proposal,
	onChangeFields,
	onToggleImage,
}: {
	proposal: AssistantProposal;
	onChangeFields: (fields: Record<string, string>) => void;
	onToggleImage: (index: number) => void;
}) {
	if (proposal.type === "create_card" || proposal.type === "update_card") {
		return (
			<div class="tr-inbox-fields">
				{Object.entries(proposal.fields).map(([name, value]) => (
					<label key={name} class="tr-inbox-field">
						<span class="tr-inbox-field-name">{name}</span>
						<textarea
							rows={3}
							value={value}
							onInput={(e) =>
								onChangeFields({
									...proposal.fields,
									[name]: (e.target as HTMLTextAreaElement).value,
								})
							}
						/>
					</label>
				))}
			</div>
		);
	}
	if (proposal.type === "attach_images") {
		return (
			<div class="tr-inbox-images">
				{proposal.candidates.map((c: ImageCandidate, i: number) => (
					<label key={c.url} class="tr-inbox-image">
						<input
							type="checkbox"
							checked={c.selected === true}
							onChange={() => onToggleImage(i)}
						/>
						{/* biome-ignore lint/a11y/useAltText: candidate title may be absent */}
						<img src={c.thumbnailUrl ?? c.url} alt={c.title ?? ""} loading="lazy" />
						<span>
							{c.title ?? c.url} {c.license ? `(${c.license})` : ""}
						</span>
					</label>
				))}
			</div>
		);
	}
	const text =
		proposal.type === "insert_diagram"
			? proposal.code
			: proposal.type === "append_to_note" || proposal.type === "create_note"
				? proposal.markdown
				: "";
	return <pre class="tr-inbox-raw">{text}</pre>;
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

	const applyOne = async (proposal: AssistantProposal, force = false) => {
		const result = await apply.apply(task, proposal, { force });
		if (result.ok) {
			proposal.status = "applied";
			persist();
			notify().success("Applied");
		} else if (result.conflictFields) {
			const confirmed = activeWindow.confirm(
				`Fields changed since the AI saw them: ${result.conflictFields.join(", ")}. Apply anyway?`,
			);
			if (confirmed) await applyOne(proposal, true);
		} else if (result.error) {
			notify().error(result.error);
		}
	};

	const pending = manifest.proposals.filter((p) => p.status === "proposed");

	return (
		<div class="tr-inbox-detail">
			{manifest.citations.length > 0 && (
				<div class="tr-inbox-citations">
					<strong>Sources:</strong>
					{manifest.citations.map((c) => (
						<a key={c.url} href={c.url} rel="noopener">
							{c.title ?? c.url}
						</a>
					))}
				</div>
			)}
			{manifest.finalText && <p class="tr-inbox-final">{manifest.finalText}</p>}
			{manifest.proposals.map((proposal) => (
				<div key={proposal.id} class={`tr-inbox-proposal is-${proposal.status}`}>
					<div class="tr-inbox-proposal-head">
						<span>{proposalSummary(proposal)}</span>
						<span class="tr-inbox-status">{proposal.status}</span>
					</div>
					{proposal.status === "proposed" && (
						<>
							<ProposalEditor
								proposal={proposal}
								onChangeFields={(fields) => {
									if (
										proposal.type === "create_card" ||
										proposal.type === "update_card"
									) {
										proposal.fields = fields;
										persist();
									}
								}}
								onToggleImage={(i) => {
									if (proposal.type === "attach_images") {
										const c = proposal.candidates[i];
										if (c) c.selected = !c.selected;
										persist();
									}
								}}
							/>
							<div class="tr-inbox-proposal-actions">
								<Clickable
									class="mod-cta"
									onClick={() => void applyOne(proposal)}
								>
									Apply
								</Clickable>
								<Clickable
									onClick={() => {
										proposal.status = "rejected";
										persist();
									}}
								>
									Reject
								</Clickable>
							</div>
						</>
					)}
				</div>
			))}
			{pending.length > 1 && (
				<div class="tr-inbox-bulk">
					<Clickable
						class="mod-cta"
						onClick={async () => {
							for (const p of [...pending]) await applyOne(p);
						}}
					>
						Apply all
					</Clickable>
					<Clickable
						onClick={() => {
							for (const p of pending) p.status = "rejected";
							persist();
						}}
					>
						Reject all
					</Clickable>
				</div>
			)}
			<div class="tr-inbox-retry">
				<input
					type="text"
					placeholder="Feedback for retry (optional)…"
					value={feedback}
					onInput={(e) => setFeedback((e.target as HTMLInputElement).value)}
				/>
				<Clickable
					onClick={() => {
						plugin.assistantService?.retryWithFeedback(task, feedback);
						setFeedback("");
					}}
				>
					Retry
				</Clickable>
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
						progress.lines
							.slice(-3)
							.map((line, i) => (
								<div key={`${task.id}-line-${i}`} class="tr-inbox-progress">
									{line}
								</div>
							))}
					<Clickable onClick={() => plugin.assistantService?.cancel(task.id)}>
						Cancel
					</Clickable>
				</div>
			))}
			{ready.map((task) => (
				<div key={task.id} class="tr-inbox-task is-ready">
					<Clickable
						class="tr-inbox-task-head"
						onClick={() => setOpenId(openId === task.id ? null : task.id)}
					>
						<span>{task.instruction}</span>
						<span class="tr-inbox-status">
							{task.manifest?.proposals.filter((p) => p.status === "proposed")
								.length ?? 0}{" "}
							pending
						</span>
					</Clickable>
					{openId === task.id && <TaskDetail task={task} />}
				</div>
			))}
			{failed.map((task) => (
				<div key={task.id} class="tr-inbox-task is-failed">
					<div class="tr-inbox-task-head">
						<span>{task.instruction}</span>
						<span class="tr-inbox-error">{task.error}</span>
					</div>
					<Clickable
						onClick={() => plugin.assistantService?.retryWithFeedback(task, "")}
					>
						Retry
					</Clickable>
					<Clickable onClick={() => plugin.assistantService?.delete(task.id)}>
						Delete
					</Clickable>
				</div>
			))}
			{tasks.length === 0 && (
				<p>No AI tasks yet. Select text during review and hit “Ask AI”.</p>
			)}
		</div>
	);
}
