import { useState } from "preact/hooks";

import type {
	AssistantProposal,
	AssistantTask,
	AssistantThread,
} from "@true-recall/core/ai/assistant";

import { ActionButton, StatusPill } from "@true-recall/obsidian/components";
import { Q, useQuery } from "@true-recall/obsidian/data";
import { usePlugin } from "@true-recall/obsidian/preact/ObsidianContext";
import { AssistantApplyService } from "@true-recall/obsidian/services/assistant/assistant-apply.service";
import { notify } from "@true-recall/obsidian/services/notification.service";
import { cn } from "@true-recall/obsidian/utils/cn";

import { AiComposer } from "./AiComposer";
import { applyPendingProposals } from "./apply-pending-proposals";
import { FactCheckBlock } from "./FactCheckBlock";
import {
	contentField,
	hasPendingProposals,
	isReviewedTask,
	normalizedSelectedText,
	proposalTitle,
	remainingCitations,
	statusTone,
	threadTask,
} from "./thread-utils";
import { CardAIField } from "@true-recall/plugins/shared/CardAIField";

const VISIBLE_MESSAGES = 6;

export function ProposalCard({
	task,
	proposal,
	apply,
	persist,
	persistDraft,
	index,
	applyAllConflictFields,
}: {
	task: AssistantTask;
	proposal: AssistantProposal;
	apply: AssistantApplyService;
	persist: () => void;
	persistDraft?: () => void;
	index?: number;
	/** Conflict reported for this proposal by the last "Apply all" run. */
	applyAllConflictFields?: string[];
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
	// undefined = no local result yet → fall back to the Apply-all conflict;
	// null = resolved or dismissed locally.
	const [conflictFields, setConflictFields] = useState<
		string[] | null | undefined
	>(undefined);
	const shownConflictFields =
		conflictFields === undefined
			? (applyAllConflictFields ?? null)
			: conflictFields;

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
			setConflictFields(null);
			persist();
			notify().success("Applied");
		} else if (result.conflictFields) {
			setConflictFields(result.conflictFields);
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
				<StatusPill
					label={proposal.status}
					tone={statusTone(proposal.status)}
				/>
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
						<div class="ep:grid ep:gap-2 ep:grid-cols-[repeat(auto-fill,minmax(120px,1fr))]">
							{proposal.candidates.map((c, i) => (
								<label
									key={c.url}
									class="ep:flex ep:flex-col ep:gap-1 ep:text-ui-smaller ep:cursor-pointer"
								>
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
										class="ep:w-full ep:max-h-30 ep:object-cover ep:rounded-md"
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

					{shownConflictFields && (
						<div class="ep:flex ep:flex-wrap ep:items-center ep:gap-2 ep:p-2 ep:rounded-md ep:border ep:border-obs-border ep:bg-surface-raised ep:text-ui-smaller ep:text-obs-muted">
							<span>
								Fields changed since the AI saw them:{" "}
								{shownConflictFields.join(", ")}.
							</span>
							<div class="ep:flex ep:gap-1.5 ep:ml-auto">
								<ActionButton
									label="Apply anyway"
									variant="danger"
									size="sm"
									onClick={() => void runApply(true)}
								/>
								<ActionButton
									label="Cancel"
									variant="ghost"
									size="sm"
									onClick={() => setConflictFields(null)}
								/>
							</div>
						</div>
					)}

					<div class="tr-card-ai-preview-actions">
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
	const [applyConflicts, setApplyConflicts] = useState<
		Record<string, string[]>
	>({});
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
	const pendingCount = manifest.proposals.filter(
		(proposal) => proposal.status === "proposed",
	).length;
	const applyAll = async () => {
		const result = await applyPendingProposals(task, manifest, apply);
		setApplyConflicts(result.conflicts);
		persist();
		if (result.conflictedCount > 0) {
			notify().info(
				`${result.conflictedCount} draft${result.conflictedCount === 1 ? "" : "s"} changed since the AI saw them — review the conflicts below`,
			);
		}
		if (result.error) notify().error(result.error);
		if (!result.error && result.appliedCount > 0) {
			notify().success("Applied AI drafts");
		}
	};
	const selectedText = normalizedSelectedText(task.context.selectedText);

	return (
		<div class="tr-card-ai-preview-root ep:flex ep:flex-col ep:gap-3 ep:p-3 ep:border-t ep:border-obs-border">
			{selectedText && <SelectedTextBlock text={selectedText} />}

			{manifest.factCheck && <FactCheckBlock result={manifest.factCheck} />}

			{remainingCitations(manifest).length > 0 && (
				<CitationsBlock citations={remainingCitations(manifest)} />
			)}

			{manifest.finalText && (
				<p class="ep:m-0 ep:italic ep:text-obs-muted ep:leading-normal">
					{manifest.finalText}
				</p>
			)}

			<div class="tr-card-ai-preview-new-list">
				{manifest.proposals.map((proposal) => (
					<ProposalCard
						key={proposal.id}
						task={task}
						proposal={proposal}
						apply={apply}
						persist={persist}
						applyAllConflictFields={applyConflicts[proposal.id]}
					/>
				))}
			</div>

			{pendingCount > 0 ? (
				<ActionButton
					label={pendingCount === 1 ? "Apply" : `Apply all (${pendingCount})`}
					variant="primary"
					onClick={() => void applyAll()}
				/>
			) : null}

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

export function ThreadWorkspace({
	thread,
	onClose,
}: {
	thread: AssistantThread;
	onClose?: () => void;
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
	const [showAllMessages, setShowAllMessages] = useState(false);
	const [applyConflicts, setApplyConflicts] = useState<
		Record<string, string[]>
	>({});
	const [, forceRender] = useState(0);
	const apply = new AssistantApplyService(plugin);
	const isBusy = !!thread.activeTaskId;
	const statusLabel =
		activeTask?.status ??
		(isBusy ? "pending" : thread.state === "archived" ? "applied" : "draft");
	const pendingCount =
		manifest?.proposals.filter((proposal) => proposal.status === "proposed")
			.length ?? 0;

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
		const result = await applyPendingProposals(task, manifest, apply);
		setApplyConflicts(result.conflicts);
		persist();
		if (result.conflictedCount > 0) {
			notify().info(
				`${result.conflictedCount} draft${result.conflictedCount === 1 ? "" : "s"} changed since the AI saw them — apply them individually`,
			);
		}
		if (result.error) notify().error(result.error);
		if (!result.error && result.appliedCount > 0) {
			notify().success("Applied AI drafts");
		}
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

	const messages = showAllMessages
		? thread.messages
		: thread.messages.slice(-VISIBLE_MESSAGES);

	return (
		<div class="ep:flex ep:flex-col ep:gap-3 ep:min-w-0">
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

			<div class="ep:flex ep:flex-col ep:gap-1.5">
				{thread.messages.length > VISIBLE_MESSAGES && !showAllMessages && (
					<ActionButton
						label={`Show earlier (${thread.messages.length - VISIBLE_MESSAGES})`}
						variant="ghost"
						size="sm"
						onClick={() => setShowAllMessages(true)}
					/>
				)}
				{messages.map((turn) => (
					<div
						key={turn.id}
						class="ep:grid ep:grid-cols-[28px_minmax(0,1fr)] ep:gap-2 ep:text-ui-smaller"
					>
						<span class="ep:text-obs-muted ep:font-semibold">
							{turn.role === "user" ? "You" : "AI"}
						</span>
						<p
							class={cn(
								"ep:m-0 ep:whitespace-pre-wrap",
								turn.role === "user"
									? "ep:text-obs-normal"
									: "ep:text-obs-muted",
							)}
						>
							{turn.content}
						</p>
					</div>
				))}
			</div>

			{isBusy ? (
				<div class="ep:flex ep:flex-col ep:gap-1 ep:pt-2 ep:border-t ep:border-obs-border">
					{progress &&
					progress.taskId === thread.activeTaskId &&
					progress.lines.length > 0 ? (
						progress.lines.slice(-3).map((line, index) => (
							<div
								key={`${thread.id}-${index}`}
								class="ep:text-ui-smaller ep:text-obs-muted ep:leading-snug"
							>
								{line}
							</div>
						))
					) : (
						<div class="ep:text-ui-smaller ep:text-obs-muted">
							Waiting for AI…
						</div>
					)}
				</div>
			) : null}

			{manifest ? (
				<>
					{manifest.factCheck ? (
						<FactCheckBlock result={manifest.factCheck} />
					) : null}
					{remainingCitations(manifest).length > 0 ? (
						<CitationsBlock citations={remainingCitations(manifest)} />
					) : null}
					<div
						class={cn(
							"tr-card-ai-preview-new-list",
							isBusy && "ep:opacity-65 ep:pointer-events-none",
						)}
					>
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
								applyAllConflictFields={applyConflicts[proposal.id]}
							/>
						))}
					</div>
					{pendingCount > 0 ? (
						<ActionButton
							label={
								pendingCount === 1 ? "Apply" : `Apply all (${pendingCount})`
							}
							variant="primary"
							onClick={() => void applyAll()}
							disabled={isBusy}
						/>
					) : null}
				</>
			) : null}

			<AiComposer
				variant="workspace"
				value={message}
				onChange={setMessage}
				placeholder="Tell AI what to change or add…"
				submitLabel="Send"
				hint={
					<span>
						<kbd>Enter</kbd> send <span aria-hidden="true">·</span>{" "}
						<kbd>Shift Enter</kbd> new line
					</span>
				}
				busy={isBusy}
				onStop={() => {
					if (thread.activeTaskId)
						plugin.assistantService?.cancel(thread.activeTaskId);
				}}
				onSubmit={send}
				onDismiss={onClose}
			/>
		</div>
	);
}
