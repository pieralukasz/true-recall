import { jsonSchema, tool } from "ai";
import { TFile } from "obsidian";

import { StatsCalculatorService } from "@true-recall/core/metrics/stats/stats-calculator.service";
import { formatLocalDate } from "@true-recall/core/utils";

import { computeActionableSessionSnapshot } from "@true-recall/obsidian/features/study/services/actionable-session-snapshot.service";

import type TrueRecallPlugin from "../../../main";
import type { ChatContext } from "./chat-context";
import { type GenerateCardsInput, runGenerateCards } from "./generate-cards";
import type {
	ProposeCardEditInput,
	ProposeCardEditOutput,
	ProposeCardsInput,
	ReportFactCheckInput,
} from "./proposals";
import { loadSearchableNotes, resolveNoteFile } from "./vault-index";
import { searchNotes, snippetsFor } from "./vault-search";

const MAX_NOTE_CHARS = 12_000;
const MAX_SEARCH_RESULTS = 20;
const MAX_NOTE_RESULTS = 10;
const MAX_LISTED_NOTES = 200;

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
	const file = resolveNoteFile(plugin.app, path);
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

		search_notes: tool({
			description:
				"Search the user's Obsidian vault: note titles, aliases, tags, headings and text. Returns the best matching notes with paths and short excerpts. Use it whenever the user asks what they have written or noted about something, or before reading a note whose path you do not know. Words match without diacritics; use the vault's language.",
			inputSchema: jsonSchema<{ query: string; folder?: string }>({
				type: "object",
				properties: {
					query: { type: "string", minLength: 2 },
					folder: {
						type: "string",
						description: "Only notes inside this folder path (optional).",
					},
				},
				required: ["query"],
			}),
			execute: async ({ query, folder }) => {
				const notes = await loadSearchableNotes(plugin.app, folder);
				const { total, terms, hits } = searchNotes(
					notes,
					query,
					MAX_NOTE_RESULTS,
				);
				return {
					total,
					notes: await Promise.all(
						hits.map(async ({ path, title, tags }) => {
							const file = plugin.app.vault.getAbstractFileByPath(path);
							const text =
								file instanceof TFile
									? await plugin.app.vault.cachedRead(file)
									: "";
							return {
								path,
								title,
								tags,
								excerpts: snippetsFor(text, terms),
							};
						}),
					),
				};
			},
		}),

		list_notes: tool({
			description:
				"List notes in a vault folder (or the most recently edited notes when no folder is given), newest first, with their paths.",
			inputSchema: jsonSchema<{ folder?: string }>({
				type: "object",
				properties: {
					folder: { type: "string", description: "Folder path, optional." },
				},
			}),
			execute: ({ folder }) => {
				const prefix = folder ? `${folder.replace(/\/+$/, "")}/` : "";
				const files = plugin.app.vault
					.getMarkdownFiles()
					.filter((file) => !prefix || file.path.startsWith(prefix))
					.sort((a, b) => b.stat.mtime - a.stat.mtime);
				return {
					total: files.length,
					notes: files.slice(0, MAX_LISTED_NOTES).map((file) => ({
						path: file.path,
						edited: formatLocalDate(new Date(file.stat.mtime)),
					})),
				};
			},
		}),

		read_note: tool({
			description:
				"Read a note from the vault by its path or its name (as in a [[wikilink]]).",
			inputSchema: jsonSchema<{ path: string }>({
				type: "object",
				properties: { path: { type: "string" } },
				required: ["path"],
			}),
			execute: async ({ path }) =>
				(await readNoteText(plugin, path)) ?? {
					error: "Note not found. Find its path with search_notes.",
				},
		}),

		get_study_stats: tool({
			description:
				"The user's study numbers. `queueToday` is what the review queue holds right now after daily limits (the same numbers as the status bar: new, learning, due). `overdueTotal` counts every review card past its due date, without limits. Also today's reviews, the day streak, card maturity and the cards they forget most.",
			inputSchema: jsonSchema<Record<string, never>>({
				type: "object",
				properties: {},
			}),
			execute: () => readStudyStats(plugin),
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

/** Study numbers that match what the user sees in the status bar and the stats view. */
export function readStudyStats(plugin: TrueRecallPlugin) {
	const store = plugin.cardStore;
	if (!store) return { error: "Database not ready." };
	const settings = plugin.settings;
	const cards = plugin.flashcardManager.getAllFSRSCards();
	const archived = plugin.hierarchyService.getArchivedSourceUids();
	const queue = computeActionableSessionSnapshot(
		{
			allCards: cards,
			archivedSourceUids: archived,
			settings,
			sessionPersistence: plugin.sessionPersistence,
			presetService: plugin.presetService,
		},
		{},
	).counts;
	const statsCalc = new StatsCalculatorService(
		plugin.fsrsService,
		plugin.flashcardManager,
		plugin.sessionPersistence,
		settings.dayStartHour,
	);
	statsCalc.setSqliteStore(store);
	const today = statsCalc.getTodaySummary();
	const streak = statsCalc.getStreakInfo();
	return {
		date: formatLocalDate(new Date()),
		queueToday: {
			new: queue.new,
			learning: queue.learning,
			due: queue.due,
			learningLaterToday: queue.learningPending,
		},
		overdueTotal: plugin.dayBoundaryService.getDueCards(cards).length,
		studiedToday: {
			cards: today.studied,
			minutes: today.minutes,
			newCards: today.newCards,
			again: today.again,
			correctRate: today.correctRate,
		},
		dayStreak: { current: streak.current, longest: streak.longest },
		totalCards: cards.length,
		maturity: store.stats.getCardMaturityBreakdown(),
		mostForgotten: store.stats.getProblemCards(10),
	};
}
