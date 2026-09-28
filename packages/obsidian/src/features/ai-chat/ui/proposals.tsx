/** @jsxImportSource react */
import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import { useState } from "react";

import type TrueRecallPlugin from "../../../main";
import type { ProposeCardEditInput, ProposeCardsInput } from "../chat-agent";
import { ObsidianMarkdown, usePlugin } from "./obsidian";

async function sourceUidFor(
	plugin: TrueRecallPlugin,
	notePath: string | null,
): Promise<string | undefined> {
	if (!notePath) return undefined;
	const fm = plugin.flashcardManager.getFrontmatterService();
	const existing = await fm.getSourceNoteUid(notePath);
	if (existing) return existing;
	const uid = fm.generateUid();
	await fm.setSourceNoteUid(notePath, uid);
	return uid;
}

interface CardsResult {
	added: number;
	cardIds: string[];
	rejected?: boolean;
}

/** New cards the model proposed: pick, add, or skip. Nothing is saved before the click. */
export const ProposeCardsUI: ToolCallMessagePartComponent<
	ProposeCardsInput,
	CardsResult
> = ({ args, result, status, addResult }) => {
	const plugin = usePlugin();
	const cards = args?.cards ?? [];
	const [picked, setPicked] = useState<boolean[]>([]);
	const [busy, setBusy] = useState(false);
	const isPicked = (i: number) => picked[i] ?? true;
	const count = cards.filter((_, i) => isPicked(i)).length;
	const streaming = status.type === "running" && !result;
	const done = !!result;

	const add = async () => {
		setBusy(true);
		try {
			const sourceUid = await sourceUidFor(plugin, args.notePath);
			const chosen = cards.filter((_, i) => isPicked(i));
			const { cards: created } = plugin.flashcardManager.createNoteBatch(
				chosen.map((c) => ({
					noteTypeId: "builtin-basic",
					fields: { Front: c.question, Back: c.answer },
					sourceUid,
					createdVia: "ai",
				})),
			);
			addResult({ added: created.length, cardIds: created.map((c) => c.id) });
		} finally {
			setBusy(false);
		}
	};

	return (
		<div
			className="tr-ai-chat__proposal"
			data-state={done ? (result.rejected ? "skipped" : "added") : "open"}
		>
			<div className="tr-ai-chat__proposal-head">
				<span>
					{streaming ? "Piszę fiszki…" : `Propozycje · ${cards.length}`}
				</span>
				{args?.notePath ? (
					<span className="tr-ai-chat__chip">
						{args.notePath.replace(/\.md$/, "")}
					</span>
				) : null}
			</div>
			<ul className="tr-ai-chat__cards">
				{cards.map((c, i) => (
					<li
						key={`${i}-${c.question}`}
						className={`tr-ai-chat__card ${isPicked(i) && !result?.rejected ? "" : "is-off"}`}
					>
						{!done ? (
							<input
								type="checkbox"
								aria-label={`Zaznacz fiszkę ${i + 1}`}
								checked={isPicked(i)}
								onChange={() =>
									setPicked((p) => {
										const next = cards.map((_, j) => p[j] ?? true);
										next[i] = !next[i];
										return next;
									})
								}
							/>
						) : null}
						<div className="tr-ai-chat__card-body">
							<ObsidianMarkdown
								markdown={c.question ?? ""}
								className="tr-ai-chat__q"
							/>
							<ObsidianMarkdown
								markdown={c.answer ?? ""}
								className="tr-ai-chat__a"
							/>
						</div>
					</li>
				))}
			</ul>
			{done ? (
				<div className="tr-ai-chat__proposal-foot tr-ai-chat__done">
					{result.rejected
						? "Pominięto"
						: `✓ Dodano ${result.added} do True Recall`}
				</div>
			) : (
				<div className="tr-ai-chat__proposal-foot">
					<button
						type="button"
						className="mod-cta"
						disabled={streaming || busy || count === 0}
						onClick={() => void add()}
					>
						{count === cards.length
							? `Dodaj wszystkie (${count})`
							: `Dodaj zaznaczone (${count})`}
					</button>
					<button
						type="button"
						disabled={streaming || busy}
						onClick={() => addResult({ added: 0, cardIds: [], rejected: true })}
					>
						Pomiń
					</button>
				</div>
			)}
		</div>
	);
};

interface EditResult {
	applied: boolean;
	rejected?: boolean;
}

/** A rewrite of an existing card: old text struck through, new text below. */
export const ProposeCardEditUI: ToolCallMessagePartComponent<
	ProposeCardEditInput,
	EditResult
> = ({ args, result, status, addResult }) => {
	const plugin = usePlugin();
	const card = args?.cardId
		? plugin.cardStore.cards.get(args.cardId)
		: undefined;
	const streaming = status.type === "running" && !result;
	// Freeze the text as it was when proposed, so the diff stays readable after "Zastosuj".
	const [before] = useState(() => ({
		question: card?.question,
		answer: card?.answer,
	}));

	const apply = () => {
		if (!card?.noteId) return;
		const note = plugin.cardStore.notes.getById(card.noteId);
		if (!note) return;
		const fields = { ...note.fields };
		if (args.question) fields.Front = args.question;
		if (args.answer) fields.Back = args.answer;
		plugin.flashcardManager.updateNoteFields(card.noteId, fields, "ai");
		addResult({ applied: true });
	};

	const row = (
		label: string,
		before: string | undefined,
		after: string | undefined,
	) =>
		after && after !== before ? (
			<div className="tr-ai-chat__diff">
				<div className="tr-ai-chat__diff-label">{label}</div>
				<ObsidianMarkdown markdown={before ?? ""} className="tr-ai-chat__old" />
				<ObsidianMarkdown markdown={after} className="tr-ai-chat__new" />
			</div>
		) : null;

	return (
		<div
			className="tr-ai-chat__proposal"
			data-state={result ? "added" : "open"}
		>
			<div className="tr-ai-chat__proposal-head">
				<span>{streaming ? "Przygotowuję zmianę…" : "Zmiana karty"}</span>
			</div>
			{card ? (
				<>
					{row("Pytanie", before.question ?? card.question, args.question)}
					{row("Odpowiedź", before.answer ?? card.answer, args.answer)}
				</>
			) : (
				<div className="tr-ai-chat__muted">Nie znalazłem tej karty.</div>
			)}
			{result ? (
				<div className="tr-ai-chat__proposal-foot tr-ai-chat__done">
					{result.rejected ? "Pominięto" : "✓ Zmieniono"}
				</div>
			) : (
				<div className="tr-ai-chat__proposal-foot">
					<button
						type="button"
						className="mod-cta"
						disabled={streaming || !card}
						onClick={apply}
					>
						Zastosuj
					</button>
					<button
						type="button"
						disabled={streaming}
						onClick={() => addResult({ applied: false, rejected: true })}
					>
						Pomiń
					</button>
				</div>
			)}
		</div>
	);
};
