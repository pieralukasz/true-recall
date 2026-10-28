import type { FSRSFlashcardItem } from "@true-recall/core/types";
import {
	BUILTIN_BASIC_ID,
	BUILTIN_CLOZE_ID,
} from "@true-recall/core/types/note.types";
import type { Menu as MenuType } from "obsidian";
import { Menu } from "obsidian";

import { G } from "@true-recall/obsidian/data/queries";
import { t } from "@true-recall/obsidian/i18n";
import type TrueRecallPlugin from "@true-recall/obsidian/main";
import { notify } from "@true-recall/obsidian/services/notification.service";
import { openQuickNoteEditor } from "@true-recall/obsidian/views/modal-window/open-quick-note-editor";

/**
 * Child cards: a card the user keeps failing is suspended and studied through
 * one or more easier stand-ins. This service builds those stand-ins from the
 * parent's own text, so the user trims instead of retyping.
 */
export class ChildCardService {
	constructor(private readonly plugin: TrueRecallPlugin) {}

	/** Offer the three card types a child can be built as. */
	openChooser(parent: FSRSFlashcardItem, event: MouseEvent): void {
		const menu: MenuType = new Menu();
		menu.addItem((item) =>
			item
				.setTitle(t("Basic child card"))
				.setIcon("file-text")
				.onClick(() => void this.createBasicChild(parent)),
		);
		menu.addItem((item) =>
			item
				.setTitle(t("Cloze child card"))
				.setIcon("text-cursor-input")
				.onClick(() => void this.createClozeChild(parent)),
		);
		menu.addItem((item) =>
			item
				.setTitle(t("Image occlusion child card"))
				.setIcon("image")
				.onClick(() => void this.createImageChild(parent)),
		);
		menu.showAtMouseEvent(event);
	}

	private async createBasicChild(parent: FSRSFlashcardItem): Promise<void> {
		await this.withCapturedCards(parent, () =>
			openQuickNoteEditor(this.plugin, {
				mode: "add",
				sourceUid: parent.sourceUid,
				defaultNoteTypeId: BUILTIN_BASIC_ID,
				initialFields: this.seedFields(parent, BUILTIN_BASIC_ID),
			}).then(() => undefined),
		);
	}

	private async createClozeChild(parent: FSRSFlashcardItem): Promise<void> {
		await this.withCapturedCards(parent, () =>
			openQuickNoteEditor(this.plugin, {
				mode: "add",
				sourceUid: parent.sourceUid,
				defaultNoteTypeId: BUILTIN_CLOZE_ID,
				initialFields: this.seedFields(parent, BUILTIN_CLOZE_ID),
			}).then(() => undefined),
		);
	}

	private async createImageChild(parent: FSRSFlashcardItem): Promise<void> {
		await this.withCapturedCards(parent, () =>
			this.plugin
				.openImageOcclusionEditor({
					mode: "add",
					sourceUid: parent.sourceUid,
				})
				.then(() => undefined),
		);
	}

	/**
	 * The editors report `{ cancelled: true }` when they are dismissed, even
	 * after the card was saved, and the quick note editor's result does not
	 * carry the created ids at all. Collect them from `card:added` instead, so
	 * the link is written whatever way the editor was closed.
	 */
	private async withCapturedCards(
		parent: FSRSFlashcardItem,
		run: () => Promise<void>,
	): Promise<void> {
		const store = this.plugin.cardStore;
		const before = new Set(store.cards.getAll().map((card) => card.id));
		try {
			await run();
		} catch (error) {
			notify().operationFailed("create the child card", error);
			return;
		}
		const created = store.cards
			.getAll()
			.filter((card) => !before.has(card.id))
			.map((card) => card.id);
		this.attach(created, parent);
	}

	/**
	 * The parent is suspended, so a review view still showing it has nothing to
	 * ask any more. Move that view to the next card.
	 */
	private advanceReviewPast(cardId: string): void {
		for (const leaf of this.plugin.app.workspace.getLeavesOfType(
			"true-recall-review",
		)) {
			const view = leaf.view as unknown as {
				getCurrentReviewedCard?: () => { id?: string } | null;
				review?: { nextCard?: () => boolean };
			};
			if (view.getCurrentReviewedCard?.()?.id !== cardId) continue;
			view.review?.nextCard?.();
		}
	}

	/**
	 * Seed the child from the parent's note fields — the same values the edit
	 * dialog shows. Same note type: copied verbatim, so the form looks exactly
	 * like editing the parent. Different type: the question-ish and answer-ish
	 * fields are mapped onto the target's first two fields.
	 */
	private seedFields(
		parent: FSRSFlashcardItem,
		targetTypeId: string,
	): Record<string, string> {
		const store = this.plugin.cardStore;
		const note = parent.noteId ? store.notes.getById(parent.noteId) : null;
		const source = note?.fields ?? {};
		const sourceType = note?.noteTypeId
			? store.noteTypes.getById(note.noteTypeId)
			: null;

		if (note?.noteTypeId === targetTypeId) return { ...source };

		const names = sourceType?.fields ?? [];
		const isClozeSource = sourceType?.type === 1;
		const rawQuestion = pickField(source, names, QUESTION_FIELDS, 0);
		const rawAnswer = pickField(
			source,
			names,
			ANSWER_FIELDS,
			Math.max(0, names.length - 1),
		);
		const question = isClozeSource ? unwrapCloze(rawQuestion) : rawQuestion;
		const answer = isClozeSource ? unwrapCloze(rawAnswer) : rawAnswer;

		const targetFields = store.noteTypes.getById(targetTypeId)?.fields ?? [];
		const fields: Record<string, string> = {};
		if (isClozeTarget(targetTypeId)) {
			// The parent's answer becomes the text to hide parts of.
			if (targetFields[0]) fields[targetFields[0]] = answer;
			if (targetFields[1]) fields[targetFields[1]] = question;
			return fields;
		}

		if (isClozeSource) {
			// Cloze parent → basic child: the prompt would give the gap away, so
			// the question stays empty and the whole text becomes the answer.
			const extra = extraOf(source, names);
			setField(fields, targetFields, FRONT_FIELDS, "");
			setField(fields, targetFields, BACK_FIELDS, unwrapCloze(question));
			if (targetFields.some((field) => field.toLowerCase() === "extra")) {
				setField(fields, targetFields, ["extra"], extra);
			} else {
				// Basic has no Extra field, so keep the parent's Extra with the
				// text instead of dropping it.
				appendToField(fields, targetFields, BACK_FIELDS, extra);
			}
			return fields;
		}

		if (targetFields[0]) fields[targetFields[0]] = question;
		if (targetFields[1]) fields[targetFields[1]] = answer;
		return fields;
	}

	/** Record the relation, then suspend the parent it stands in for. */
	private attach(
		children: readonly string[],
		parent: FSRSFlashcardItem,
	): void {
		const store = this.plugin.cardStore;
		const now = Date.now();
		for (const childId of children) {
			store.childCards.link(childId, parent.id, now);
		}
		if (children.length > 0) {
			store.cards.bulkSuspend([parent.id]);
			this.advanceReviewPast(parent.id);
		}
		this.plugin.dataLayer?.invalidateGroups([
			G.CARDS,
			G.BROWSER,
			G.REVIEW,
			G.PANEL,
		]);
		notify().success(
			children.length === 1
				? t("Child card created, parent suspended")
				: t("Child cards created, parent suspended"),
		);
	}
}

const QUESTION_FIELDS = ["front", "question", "title", "prompt", "text"];
const ANSWER_FIELDS = ["back", "answer", "definition", "extra"];
const FRONT_FIELDS = ["front", "question", "title", "prompt"];
const BACK_FIELDS = ["back", "answer", "definition"];

/** Set the target field whose name matches one of `candidates`. */
function setField(
	fields: Record<string, string>,
	targetFields: readonly string[],
	candidates: readonly string[],
	value: string,
): void {
	const name = targetFields.find((field) =>
		candidates.includes(field.toLowerCase()),
	);
	if (name) fields[name] = value;
}

/** Append `value` to the field, separated by a blank line. */
function appendToField(
	fields: Record<string, string>,
	targetFields: readonly string[],
	candidates: readonly string[],
	value: string,
): void {
	if (!value.trim()) return;
	const name = targetFields.find((field) =>
		candidates.includes(field.toLowerCase()),
	);
	if (!name) return;
	fields[name] = fields[name] ? `${fields[name]}\n\n${value}` : value;
}

/** The parent note's Extra value, when its note type has such a field. */
function extraOf(source: Record<string, string>, names: readonly string[]): string {
	const name = names.find((field) => field.toLowerCase() === "extra");
	return name ? (source[name] ?? "") : "";
}

function isClozeTarget(noteTypeId: string): boolean {
	return noteTypeId === BUILTIN_CLOZE_ID;
}

function pickField(
	source: Record<string, string>,
	names: readonly string[],
	candidates: readonly string[],
	fallbackIndex: number,
): string {
	const name =
		names.find((field) => candidates.includes(field.toLowerCase())) ??
		names[fallbackIndex];
	return name ? (source[name] ?? "") : "";
}

/** Unwrap `{{c1::text::hint}}` so the text reads normally outside a cloze. */
function unwrapCloze(value: string): string {
	let out = value;
	for (let pass = 0; pass < 3; pass++) {
		const next = out.replace(/\{\{c\d+::([\s\S]*?)(?:::[\s\S]*?)?\}\}/g, "$1");
		if (next === out) break;
		out = next;
	}
	return out;
}
