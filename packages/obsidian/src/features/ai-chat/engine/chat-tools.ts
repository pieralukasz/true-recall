import { jsonSchema, tool } from "ai";
import { TFile } from "obsidian";

import { formatLocalDate } from "@true-recall/core/utils";

import type TrueRecallPlugin from "../../../main";
import type { ChatContext } from "./chat-context";
import { type GenerateCardsInput, runGenerateCards } from "./generate-cards";
import type {
	ProposeCardEditInput,
	ProposeCardEditOutput,
	ProposeCardsInput,
	ReportFactCheckInput,
} from "./proposals";

const MAX_NOTE_CHARS = 12_000;
const MAX_SEARCH_RESULTS = 20;

/** Snapshots are scoped to one request, and only populated by reads shown to the model. */
export type CardSnapshots = Map<
	string,
	NonNullable<ReturnType<typeof readCardFields>>
>;

export function readCardSnapshot(
	plugin: TrueRecallPlugin,
	cardId: string,
	snapshots: CardSnapshots,
) {
	const card = readCardFields(plugin, cardId);
	if (card) snapshots.set(cardId, card);
	else snapshots.delete(cardId);
	return card;
}

/** A card's note fields in note-type order, or null when it cannot be edited. */
export function readCardFields(
	plugin: TrueRecallPlugin,
	cardId: string,
): {
	noteId: string;
	noteType: string;
	fields: Record<string, string>;
} | null {
	const store = plugin.cardStore;
	const card = store?.cards.get(cardId);
	if (!store || !card?.noteId || !card.noteTypeId) return null;
	const note = store.notes.getById(card.noteId);
	const noteType = store.noteTypes.getById(card.noteTypeId);
	if (!note || !noteType) return null;
	const fields: Record<string, string> = {};
	for (const name of noteType.fields) fields[name] = note.fields?.[name] ?? "";
	return { noteId: card.noteId, noteType: noteType.name, fields };
}

export async function readNoteText(
	plugin: TrueRecallPlugin,
	path: string,
	maxChars = MAX_NOTE_CHARS,
): Promise<string | null> {
	const file = plugin.app.vault.getAbstractFileByPath(path);
	if (!(file instanceof TFile)) return null;
	const text = await plugin.app.vault.cachedRead(file);
	return text.length > maxChars
		? `${text.slice(0, maxChars)}\n[… note truncated]`
		: text;
}

function cardSummary(card: {
	id: string;
	question?: string;
	answer?: string;
	lapses?: number;
	reps?: number;
}) {
	return {
		id: card.id,
		question: card.question ?? "",
		answer: card.answer ?? "",
		reviews: card.reps ?? 0,
		lapses: card.lapses ?? 0,
	};
}

/**
 * The chat's tools. Reading tools run right away. propose_cards and
 * propose_card_edit only show a proposal: the user's click writes to the
 * collection (see ui/proposals.tsx), never the model.
 */
export function createChatTools(
	plugin: TrueRecallPlugin,
	snapshots: CardSnapshots = new Map(),
	getContext: () => ChatContext = () => ({}),
) {
	return {
		search_cards: tool({
			description:
				"Find the user's flashcards whose question or answer contains the text. Returns up to 20 cards with ids.",
			inputSchema: jsonSchema<{ query: string }>({
				type: "object",
				properties: { query: { type: "string", minLength: 1 } },
				required: ["query"],
			}),
			execute: ({ query }) => {
				const q = query.toLowerCase();
				const matches = (plugin.cardStore?.cards.getAll() ?? []).filter(
					(c) =>
						(c.question ?? "").toLowerCase().includes(q) ||
						(c.answer ?? "").toLowerCase().includes(q),
				);
				return {
					total: matches.length,
					cards: matches.slice(0, MAX_SEARCH_RESULTS).map(cardSummary),
				};
			},
		}),

		get_card: tool({
			description:
				"Read one card: its note fields (use these names in propose_card_edit) and review history.",
			inputSchema: jsonSchema<{ cardId: string }>({
				type: "object",
				properties: { cardId: { type: "string" } },
				required: ["cardId"],
			}),
			execute: ({ cardId }) => {
				const card = plugin.cardStore?.cards.get(cardId);
				const fields = readCardSnapshot(plugin, cardId, snapshots);
				if (!card || !fields) return { error: "Card not found." };
				return {
					...cardSummary(card),
					noteType: fields.noteType,
					fields: fields.fields,
					due: card.due,
					suspended: !!card.suspended,
				};
			},
		}),

		list_note_cards: tool({
			description:
				"List the cards already made from a note, so new cards do not repeat them.",
			inputSchema: jsonSchema<{ notePath: string }>({
				type: "object",
				properties: { notePath: { type: "string" } },
				required: ["notePath"],
			}),
			execute: async ({ notePath }) => {
				const uid = await plugin.flashcardManager
					.getFrontmatterService()
					.getSourceNoteUid(notePath);
				if (!uid) return { cards: [] };
				return {
					cards: (plugin.cardStore?.cards.getCardsBySourceUid(uid) ?? []).map(
						cardSummary,
					),
				};
			},
		}),

		read_note: tool({
			description: "Read a note from the vault by its path.",
			inputSchema: jsonSchema<{ path: string }>({
				type: "object",
				properties: { path: { type: "string" } },
				required: ["path"],
			}),
			execute: async ({ path }) =>
				(await readNoteText(plugin, path)) ?? { error: "Note not found." },
		}),

		get_study_stats: tool({
			description:
				"The user's study numbers: cards due today, today's reviews, streak, card maturity, and the cards they forget most.",
			inputSchema: jsonSchema<Record<string, never>>({
				type: "object",
				properties: {},
			}),
			execute: () => {
				const store = plugin.cardStore;
				if (!store) return { error: "Database not ready." };
				const cards = plugin.flashcardManager.getAllFSRSCards();
				return {
					date: formatLocalDate(new Date()),
					totalCards: cards.length,
					dueToday: plugin.dayBoundaryService.getDueCards(cards).length,
					today: store.stats.getDailyStats(formatLocalDate(new Date())),
					streak: store.stats.getAnswerStreakInfo(),
					maturity: store.stats.getCardMaturityBreakdown(),
					mostForgotten: store.stats.getProblemCards(10),
				};
			},
		}),

		propose_cards: tool({
			description:
				'Show new flashcards to the user. Each card is { "question", "answer" } (not Front/Back). Nothing is saved until the user adds them in the chat; the next message tells you what they added.',
			inputSchema: jsonSchema<ProposeCardsInput>({
				type: "object",
				properties: {
					notePath: {
						type: "string",
						description: "Note the cards come from. Omit to use the open note.",
					},
					cards: {
						type: "array",
						minItems: 1,
						items: {
							type: "object",
							properties: {
								question: { type: "string" },
								answer: { type: "string" },
							},
							required: ["question", "answer"],
						},
					},
				},
				required: ["cards"],
			}),
			execute: ({ cards }) => ({ shown: cards.length }),
		}),

		generate_cards: tool({
			description:
				"Make flashcards from the note (or the selected text) with the user's generation preset, the same generator as the cards panel. Use it whenever the user asks for cards from a note or selection; use propose_cards only for a few cards you write yourself from the conversation. The cards are shown to the user, who adds or skips them; the next message tells you what they added.",
			inputSchema: jsonSchema<GenerateCardsInput>({
				type: "object",
				properties: {
					notePath: {
						type: "string",
						description:
							"Note to make cards from. Omit to use the chat's note.",
					},
					wholeNote: {
						type: "boolean",
						description:
							"Use the whole note even though the user selected text. Omit otherwise.",
					},
				},
			}),
			execute: (input, { abortSignal }) =>
				runGenerateCards(plugin, getContext(), input, abortSignal),
			// The model only needs the outcome, not every card again.
			toModelOutput: ({ output }) => {
				const o = output;
				return {
					type: "text",
					value: o.error
						? `Error: ${o.error}`
						: `Showed ${o.cards.length} generated cards to the user:\n${o.cards
								.map((c, i) => `${i + 1}. ${c.question} | ${c.answer}`)
								.join("\n")}`,
				};
			},
		}),

		propose_card_edit: tool({
			description:
				"Show the user a change to an existing card: pass only the fields that change, by field name. Nothing changes until the user applies it.",
			inputSchema: jsonSchema<ProposeCardEditInput>({
				type: "object",
				properties: {
					cardId: { type: "string" },
					fields: {
						type: "array",
						minItems: 1,
						description:
							'One entry per changed field, e.g. [{ "field": "Back", "value": "new answer" }].',
						items: {
							type: "object",
							properties: {
								field: {
									type: "string",
									description: "Note field name, e.g. Front or Back.",
								},
								value: {
									type: "string",
									description: "The field's full new text.",
								},
							},
							required: ["field", "value"],
						},
					},
					reason: { type: "string", description: "One short sentence." },
				},
				required: ["cardId", "fields"],
			}),
			execute: ({ cardId }): ProposeCardEditOutput => {
				const snapshot = snapshots.get(cardId);
				return snapshot
					? { before: { ...snapshot.fields } }
					: { error: "Read this card with get_card before proposing an edit." };
			},
		}),

		report_fact_check: tool({
			description:
				"Record the verdict of a fact check of one card. Call exactly once per check.",
			inputSchema: jsonSchema<ReportFactCheckInput>({
				type: "object",
				properties: {
					cardId: { type: "string" },
					verdict: {
						type: "string",
						enum: ["confirmed", "incorrect", "outdated", "unverifiable"],
					},
					confidence: { type: "string", enum: ["high", "medium", "low"] },
					summary: { type: "string" },
					evidence: {
						type: "array",
						items: {
							type: "object",
							properties: {
								url: { type: "string" },
								title: { type: "string" },
								quote: { type: "string" },
							},
							required: ["url"],
						},
					},
				},
				required: ["cardId", "verdict", "confidence", "summary"],
			}),
			execute: () => ({ recorded: true }),
		}),
	};
}

export type ChatTools = ReturnType<typeof createChatTools>;
