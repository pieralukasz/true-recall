/** @jsxImportSource react */
import { Notice } from "obsidian";
import { type CSSProperties, type ReactNode, useEffect, useState } from "react";

import {
	addProposedCards,
	applyCardEdit,
	removeAddedCards,
	revertCardEdit,
} from "../engine/chat-apply";
import { shorten } from "../engine/chat-context";
import type {
	GenerateCardsInput,
	GenerateCardsOutput,
	GenerateCardsStage,
} from "../engine/generate-cards";
import {
	changedFields,
	editFields,
	normalizeCard,
	type ProposalDraft,
	type ProposeCardEditInput,
	type ProposeCardEditOutput,
	type ProposeCardsInput,
	type ProposedCard,
	pickCards,
	type ReportFactCheckInput,
} from "../engine/proposals";
import {
	Icon,
	ObsidianMarkdown,
	useController,
	usePlugin,
	useSession,
} from "./obsidian";

/** The part of assistant-ui's tool-call props the proposals use (also built by hand under a review card). */
export interface ToolPartProps<TArgs, TResult> {
	toolCallId: string;
	args: TArgs;
	result?: TResult | undefined;
	status: { type: string };
}

function IconButton({
	icon,
	label,
	onClick,
	disabled,
}: {
	icon: string;
	label: string;
	onClick: () => void;
	disabled?: boolean;
}) {
	return (
		<button
			type="button"
			className="clickable-icon tr-ai-chat__icon-btn"
			aria-label={label}
			data-tooltip-position="top"
			disabled={disabled}
			onClick={onClick}
		>
			<Icon name={icon} />
		</button>
	);
}

function AutoTextarea({
	value,
	onChange,
	label,
}: {
	value: string;
	onChange: (value: string) => void;
	label: string;
}) {
	return (
		<textarea
			className="tr-ai-chat__field-input"
			aria-label={label}
			value={value}
			rows={Math.min(8, Math.max(2, value.split("\n").length))}
			onChange={(e) => onChange(e.target.value)}
		/>
	);
}

// ─── new cards ─────────────────────────────────────────────────────────

function CardEditor({
	card,
	onChange,
	onSave,
	onCancel,
}: {
	card: ProposedCard;
	onChange: (card: ProposedCard) => void;
	onSave: (card: ProposedCard) => void;
	onCancel: () => void;
}) {
	return (
		<div className="tr-ai-chat__card-editor">
			<AutoTextarea
				label="Question"
				value={card.question}
				onChange={(question) => onChange({ ...card, question })}
			/>
			<AutoTextarea
				label="Answer"
				value={card.answer}
				onChange={(answer) => onChange({ ...card, answer })}
			/>
			<div className="tr-ai-chat__row">
				<button type="button" className="mod-cta" onClick={() => onSave(card)}>
					Save
				</button>
				<button type="button" onClick={onCancel}>
					Cancel
				</button>
			</div>
		</div>
	);
}

/** New cards the model proposed: pick, edit, add or skip. Nothing is saved before the click. */
export function ProposeCardsUI({
	toolCallId,
	args,
	result,
}: ToolPartProps<ProposeCardsInput, { shown: number }>) {
	return (
		<CardsProposal
			toolCallId={toolCallId}
			cards={args?.cards ?? []}
			notePath={args?.notePath ?? undefined}
			streaming={result === undefined}
		/>
	);
}

const STAGES: {
	id: GenerateCardsStage;
	label: string;
	reviewedOnly?: boolean;
}[] = [
	{ id: "reading", label: "Reading the note" },
	{ id: "writing", label: "Writing cards" },
	{ id: "reviewing", label: "Reviewing each card", reviewedOnly: true },
];

/** Seconds since `startedAt`, ticking while `running`. */
function useElapsed(startedAt: number | undefined, running: boolean): number {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		if (!running) return;
		const id = window.setInterval(() => setNow(Date.now()), 1000);
		return () => window.clearInterval(id);
	}, [running]);
	return startedAt ? Math.max(0, Math.round((now - startedAt) / 1000)) : 0;
}

/** Live progress of generate_cards: the steps, a timer and placeholder rows. */
function GenerationProgress({
	output,
}: {
	output: GenerateCardsOutput | undefined;
}) {
	const stage = output?.stage ?? "reading";
	const elapsed = useElapsed(output?.startedAt, true);
	const steps = STAGES.filter((s) => !s.reviewedOnly || output?.reviewed);
	const current = steps.findIndex((s) => s.id === stage);
	const count = output?.cards.length ?? 0;
	return (
		<div className="tr-ai-chat__gen" aria-live="polite">
			<ol className="tr-ai-chat__gen-steps">
				{steps.map((step, i) => {
					const state =
						i < current ? "done" : i === current ? "active" : "todo";
					return (
						<li
							key={step.id}
							className="tr-ai-chat__gen-step"
							data-state={state}
						>
							<span className="tr-ai-chat__gen-dot">
								{state === "done" ? <Icon name="check" /> : null}
							</span>
							<span>
								{step.label}
								{step.id === "writing" && count > 0 ? ` · ${count}` : ""}
							</span>
						</li>
					);
				})}
			</ol>
			<div className="tr-ai-chat__gen-rows" aria-hidden="true">
				<span className="tr-ai-chat__gen-row" />
				<span className="tr-ai-chat__gen-row" />
				<span className="tr-ai-chat__gen-row" />
			</div>
			<div className="tr-ai-chat__gen-time">{elapsed} s</div>
		</div>
	);
}

/**
 * Cards from the user's generation preset (generate_cards). While it runs, the
 * steps and any cards written so far; when done, the usual pick/add list with
 * the cards sliding in one after another.
 */
export function GenerateCardsUI({
	toolCallId,
	result,
	isPreliminary,
}: ToolPartProps<GenerateCardsInput, GenerateCardsOutput> & {
	isPreliminary?: boolean;
}) {
	const running = result === undefined || isPreliminary === true;
	if (!running && result?.error) {
		return (
			<div className="tr-ai-chat__proposal" data-state="skipped">
				<div className="tr-ai-chat__muted">{result.error}</div>
			</div>
		);
	}
	if (!running && result && result.cards.length === 0) {
		return (
			<div className="tr-ai-chat__proposal" data-state="skipped">
				<div className="tr-ai-chat__muted">
					No new cards: everything worth learning here already has a card.
				</div>
			</div>
		);
	}
	// Animate only a fresh result, not chats reopened later.
	const fresh =
		!!result?.startedAt && Date.now() - result.startedAt < 10 * 60_000;
	return (
		<CardsProposal
			toolCallId={toolCallId}
			cards={result?.cards ?? []}
			notePath={result?.notePath}
			streaming={running}
			progress={running ? <GenerationProgress output={result} /> : null}
			subtitle={result?.presetName}
			animate={fresh}
		/>
	);
}

function CardsProposal({
	toolCallId,
	cards,
	notePath: givenNotePath,
	streaming,
	progress,
	subtitle,
	animate,
}: {
	toolCallId: string;
	cards: ProposedCard[];
	notePath?: string;
	streaming: boolean;
	progress?: ReactNode;
	subtitle?: string;
	animate?: boolean;
}) {
	const plugin = usePlugin();
	const controller = useController();
	const session = useSession();
	const decision = session.decisions[toolCallId];
	const draft = session.drafts[toolCallId] ?? {};
	const picked = draft.picked ?? [];
	const edits = draft.cardEdits ?? {};
	const editor = draft.cardEditor;
	const editing = editor?.index ?? null;
	const updateDraft = (patch: Partial<ProposalDraft>) =>
		controller.updateDraft(session.id, toolCallId, patch);
	const [busy, setBusy] = useState(false);

	const open = !decision;
	const chosen = pickCards(cards, picked, edits);
	const isPicked = (i: number) => picked[i] ?? true;
	const notePath =
		givenNotePath ??
		session.context.note?.path ??
		session.context.selection?.notePath;

	const toggle = (i: number) => {
		const next = cards.map((_, j) => picked[j] ?? true);
		next[i] = !next[i];
		updateDraft({ picked: next });
	};

	const add = async () => {
		setBusy(true);
		try {
			const ids = await addProposedCards(plugin, chosen, {
				notePath,
				sourceText: session.context.selection?.text,
			});
			controller.decide(session.id, toolCallId, {
				kind: "cards-added",
				cardIds: ids,
				added: ids.length,
				proposed: cards.length,
				at: Date.now(),
			});
			if (ids.length < chosen.length) {
				new Notice(
					`${chosen.length - ids.length} card(s) already existed and were skipped.`,
				);
			}
		} catch (error) {
			new Notice(`Could not add the cards: ${String(error)}`);
		} finally {
			setBusy(false);
		}
	};

	const undo = () => {
		if (decision?.kind === "cards-added") {
			removeAddedCards(plugin, decision.cardIds);
		}
		controller.undecide(session.id, toolCallId);
	};

	const state = !decision
		? "open"
		: decision.kind === "skipped"
			? "skipped"
			: "added";

	return (
		<div className="tr-ai-chat__proposal" data-state={state}>
			<div className="tr-ai-chat__proposal-head">
				<Icon name="layers" />
				<span className="tr-ai-chat__proposal-title">
					{streaming
						? progress
							? "Making cards…"
							: "Writing cards…"
						: cards.length === 1
							? "1 new card"
							: `${cards.length} new cards`}
					{subtitle && !streaming ? (
						<span className="tr-ai-chat__proposal-sub"> · {subtitle}</span>
					) : null}
				</span>
				{notePath ? (
					<span className="tr-ai-chat__chip">
						{notePath.replace(/\.md$/, "").split("/").pop()}
					</span>
				) : null}
			</div>
			{progress}
			<ul
				className={`tr-ai-chat__cards${animate && !streaming ? " is-entering" : ""}`}
			>
				{cards.map((raw, i) => {
					const card = edits[i] ?? normalizeCard(raw);
					const off = !isPicked(i) || decision?.kind === "skipped";
					return (
						<li
							// Index keys: the question streams in, so it cannot be the key.
							// biome-ignore lint/suspicious/noArrayIndexKey: stable order
							key={i}
							className={`tr-ai-chat__card ${off ? "is-off" : ""}`}
							style={{ "--tr-i": Math.min(i, 24) } as CSSProperties}
						>
							{open && !streaming ? (
								<input
									type="checkbox"
									aria-label={`Include card ${i + 1}`}
									checked={isPicked(i)}
									onChange={() => toggle(i)}
								/>
							) : null}
							{editor?.index === i ? (
								<CardEditor
									card={editor.value}
									onChange={(value) =>
										updateDraft({ cardEditor: { index: i, value } })
									}
									onSave={(next) => {
										updateDraft({
											cardEdits: { ...edits, [i]: next },
											cardEditor: undefined,
										});
									}}
									onCancel={() => updateDraft({ cardEditor: undefined })}
								/>
							) : (
								<div className="tr-ai-chat__card-body">
									<ObsidianMarkdown
										markdown={card.question}
										className="tr-ai-chat__q"
									/>
									<ObsidianMarkdown
										markdown={card.answer}
										className="tr-ai-chat__a"
									/>
								</div>
							)}
							{open && !streaming && editing !== i ? (
								<IconButton
									icon="pencil"
									label="Edit card"
									onClick={() =>
										updateDraft({ cardEditor: { index: i, value: card } })
									}
								/>
							) : null}
						</li>
					);
				})}
			</ul>
			{!streaming ? (
				<div className="tr-ai-chat__proposal-foot">
					{open ? (
						<>
							<button
								type="button"
								className="mod-cta"
								disabled={busy || chosen.length === 0 || editing !== null}
								onClick={() => void add()}
							>
								{chosen.length === cards.length
									? `Add all (${chosen.length})`
									: `Add selected (${chosen.length})`}
							</button>
							<button
								type="button"
								disabled={busy}
								onClick={() =>
									controller.decide(session.id, toolCallId, {
										kind: "skipped",
										at: Date.now(),
									})
								}
							>
								Skip
							</button>
						</>
					) : (
						<>
							<span className="tr-ai-chat__done">
								{decision.kind === "cards-added" ? (
									<>
										<Icon name="check" />
										{decision.added === 1
											? "Added 1 card"
											: `Added ${decision.added} cards`}
									</>
								) : (
									"Skipped"
								)}
							</span>
							<button
								type="button"
								className="tr-ai-chat__link-btn"
								onClick={undo}
							>
								Undo
							</button>
						</>
					)}
				</div>
			) : null}
		</div>
	);
}

// ─── edit of an existing card ──────────────────────────────────────────

/** A rewrite of an existing card: old text struck through, new text below, editable before applying. */
export function ProposeCardEditUI({
	toolCallId,
	args,
	result,
	compact,
	onApplied,
}: ToolPartProps<ProposeCardEditInput, ProposeCardEditOutput> & {
	/** Under a review card: no card title (the card is right above). */
	compact?: boolean;
	/** Called after Apply wrote the edit; the review panel closes itself. */
	onApplied?: () => void;
}) {
	const plugin = usePlugin();
	const controller = useController();
	const session = useSession();
	const decision = session.decisions[toolCallId];
	const draft = session.drafts[toolCallId] ?? {};
	const edits = draft.fieldEdits ?? {};
	const editing = !decision && (draft.editingFields ?? false);
	const updateDraft = (patch: Partial<ProposalDraft>) =>
		controller.updateDraft(session.id, toolCallId, patch);

	const streaming = result === undefined;
	if (result?.error) {
		return (
			<div className="tr-ai-chat__proposal" data-state="skipped">
				<div className="tr-ai-chat__muted">{result.error}</div>
			</div>
		);
	}
	const before = result?.before ?? {};
	const suggested = editFields(args?.fields);
	const proposed = { ...suggested, ...edits };
	const fields =
		streaming || editing
			? Object.keys(suggested)
			: changedFields(before, proposed);
	const firstField = Object.values(before)[0] ?? "";

	const apply = () => {
		const changes = Object.fromEntries(
			fields.map((f) => [f, proposed[f] ?? ""]),
		);
		const outcome = applyCardEdit(plugin, args.cardId, changes, before);
		if (!outcome.ok) {
			new Notice(
				outcome.error === "changed"
					? "The card changed since this proposal. Ask again to get a fresh one."
					: "This card no longer exists.",
			);
			return;
		}
		controller.decide(session.id, toolCallId, {
			kind: "edit-applied",
			noteId: outcome.noteId,
			cardId: args.cardId,
			before: outcome.before,
			after: outcome.after,
			at: Date.now(),
		});
		onApplied?.();
	};

	const undo = () => {
		if (decision?.kind === "edit-applied") {
			const outcome = revertCardEdit(
				plugin,
				decision.cardId,
				decision.noteId,
				decision.before,
				decision.after,
			);
			if (!outcome.ok) {
				new Notice(
					outcome.error === "changed"
						? "The card changed after this edit. Undo would overwrite those changes."
						: "This card no longer exists.",
				);
				return;
			}
		}
		controller.undecide(session.id, toolCallId);
	};

	const state = !decision
		? "open"
		: decision.kind === "skipped"
			? "skipped"
			: "added";

	return (
		<div className="tr-ai-chat__proposal" data-state={state}>
			{compact ? null : (
				<div className="tr-ai-chat__proposal-head">
					<Icon name="pencil-line" />
					<span className="tr-ai-chat__proposal-title">
						{streaming ? "Preparing a change…" : "Change to card"}
					</span>
					{firstField ? (
						<span className="tr-ai-chat__chip">{shorten(firstField, 40)}</span>
					) : null}
				</div>
			)}
			{args?.reason ? (
				<div className="tr-ai-chat__reason">{args.reason}</div>
			) : null}
			{fields.length === 0 && !streaming ? (
				<div className="tr-ai-chat__muted">No change to this card.</div>
			) : null}
			{fields.map((name) => (
				<div key={name} className="tr-ai-chat__diff">
					<div className="tr-ai-chat__diff-label">{name}</div>
					{before[name] ? (
						<ObsidianMarkdown
							markdown={before[name]}
							className="tr-ai-chat__old"
						/>
					) : null}
					{editing ? (
						<AutoTextarea
							label={name}
							value={proposed[name] ?? ""}
							onChange={(value) =>
								updateDraft({ fieldEdits: { ...edits, [name]: value } })
							}
						/>
					) : (
						<ObsidianMarkdown
							markdown={proposed[name] ?? ""}
							className="tr-ai-chat__new"
						/>
					)}
				</div>
			))}
			{!streaming && fields.length > 0 ? (
				<div className="tr-ai-chat__proposal-foot">
					{!decision ? (
						<>
							<button type="button" className="mod-cta" onClick={apply}>
								Apply
							</button>
							<button
								type="button"
								onClick={() =>
									controller.decide(session.id, toolCallId, {
										kind: "skipped",
										at: Date.now(),
									})
								}
							>
								Skip
							</button>
							<IconButton
								icon={editing ? "eye" : "pencil"}
								label={editing ? "Preview" : "Edit before applying"}
								onClick={() => updateDraft({ editingFields: !editing })}
							/>
						</>
					) : (
						<>
							<span className="tr-ai-chat__done">
								{decision.kind === "edit-applied" ? (
									<>
										<Icon name="check" />
										Applied
									</>
								) : (
									"Skipped"
								)}
							</span>
							<button
								type="button"
								className="tr-ai-chat__link-btn"
								onClick={undo}
							>
								Undo
							</button>
						</>
					)}
				</div>
			) : null}
		</div>
	);
}

// ─── fact check ────────────────────────────────────────────────────────

const VERDICT: Record<
	ReportFactCheckInput["verdict"],
	{ label: string; icon: string }
> = {
	confirmed: { label: "Correct", icon: "check-circle" },
	incorrect: { label: "Incorrect", icon: "x-circle" },
	outdated: { label: "Outdated", icon: "clock" },
	unverifiable: { label: "Could not verify", icon: "help-circle" },
};

function hostOf(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return url;
	}
}

/** The verdict of a fact check, with its sources. */
export function FactCheckUI({
	args,
	result,
}: ToolPartProps<ReportFactCheckInput, { recorded: boolean }>) {
	if (result === undefined || !args?.verdict) {
		return (
			<div className="tr-ai-chat__tool-line">
				<Icon name="search-check" />
				Checking the facts…
			</div>
		);
	}
	const verdict = VERDICT[args.verdict] ?? VERDICT.unverifiable;
	return (
		<div className="tr-ai-chat__verdict" data-verdict={args.verdict}>
			<div className="tr-ai-chat__verdict-head">
				<Icon name={verdict.icon} />
				<span>{verdict.label}</span>
				<span className="tr-ai-chat__verdict-conf">
					{args.confidence} confidence
				</span>
			</div>
			<ObsidianMarkdown markdown={args.summary ?? ""} />
			{args.evidence?.length ? (
				<ul className="tr-ai-chat__sources">
					{args.evidence.map((e) => (
						<li key={e.url}>
							<a href={e.url} target="_blank" rel="noopener">
								{e.title || hostOf(e.url)}
							</a>
							{e.quote ? (
								<span className="tr-ai-chat__quote">“{e.quote}”</span>
							) : null}
						</li>
					))}
				</ul>
			) : null}
		</div>
	);
}

// ─── reading tools ─────────────────────────────────────────────────────

const TOOL_LINES: Record<
	string,
	{ icon: string; running: string; done: string }
> = {
	search_cards: {
		icon: "search",
		running: "Searching your cards…",
		done: "Searched your cards",
	},
	get_card: {
		icon: "file-text",
		running: "Reading the card…",
		done: "Read the card",
	},
	list_note_cards: {
		icon: "layers",
		running: "Checking existing cards…",
		done: "Checked existing cards",
	},
	read_note: {
		icon: "file-text",
		running: "Reading the note…",
		done: "Read the note",
	},
	get_study_stats: {
		icon: "bar-chart-2",
		running: "Looking at your stats…",
		done: "Looked at your stats",
	},
};

/** One quiet line for tools that only read. */
export function ToolLine({
	toolName,
	args,
	result,
}: {
	toolName: string;
	args?: unknown;
	result?: unknown;
}) {
	const line = TOOL_LINES[toolName] ?? {
		icon: "wrench",
		running: `${toolName}…`,
		done: toolName,
	};
	const query =
		toolName === "search_cards"
			? (args as { query?: string })?.query
			: undefined;
	return (
		<div className="tr-ai-chat__tool-line">
			<Icon name={line.icon} />
			{result === undefined ? line.running : line.done}
			{query ? <span className="tr-ai-chat__tool-arg">“{query}”</span> : null}
		</div>
	);
}
