import type { ToolDefinition } from "../clients/openrouter-client";
import type { ImageCandidate } from "./assistant.types";

export interface AssistantNoteTypeInfo {
	id: string;
	name: string;
	fields: string[];
}

export interface AssistantRelatedCard {
	noteType: string;
	fields: Record<string, string>;
}

/**
 * Read-side port implemented by the host platform (obsidian package).
 * Write tools never touch the host — they only record proposals.
 */
export interface AssistantToolHost {
	listNoteTypes(): AssistantNoteTypeInfo[];
	getCardFields(cardId: string): {
		noteId: string;
		noteTypeId: string;
		fields: Record<string, string>;
	} | null;
	getRelatedCards(sourceUid: string): AssistantRelatedCard[];
	readNote(path: string): Promise<string | null>;
	searchImages(query: string, count: number): Promise<ImageCandidate[]>;
}

const FIELDS_SCHEMA = {
	type: "object",
	description: "Field name to markdown content map",
	additionalProperties: { type: "string" },
} as const;

const TARGET_SCHEMA = {
	type: "object",
	description:
		'Where to attach: {"kind":"card-field","cardId":"...","noteId":"...","field":"..."} or {"kind":"note","path":"..."}',
	properties: {
		kind: { type: "string", enum: ["card-field", "note"] },
		cardId: { type: "string" },
		noteId: { type: "string" },
		field: { type: "string" },
		path: { type: "string" },
	},
	required: ["kind"],
} as const;

export const ASSISTANT_TOOLS: ToolDefinition[] = [
	{
		type: "function",
		function: {
			name: "create_cards",
			description:
				"Propose new flashcards. Each card must follow the user's methodology (ultra-atomic, concise). Cards are drafts until the user approves them.",
			parameters: {
				type: "object",
				properties: {
					noteTypeId: {
						type: "string",
						description: "Note type id from the available note types list",
					},
					cards: {
						type: "array",
						items: FIELDS_SCHEMA,
						description: "One object per card, keys = note type field names",
					},
				},
				required: ["noteTypeId", "cards"],
			},
		},
	},
	{
		type: "function",
		function: {
			name: "update_proposal",
			description:
				"Update fields of an existing card draft from CURRENT DRAFT WORKSPACE. Pass only changed fields and preserve its proposal id.",
			parameters: {
				type: "object",
				properties: {
					proposalId: { type: "string" },
					fields: {
						type: "object",
						additionalProperties: { type: "string" },
					},
				},
				required: ["proposalId", "fields"],
			},
		},
	},
	{
		type: "function",
		function: {
			name: "remove_proposal",
			description:
				"Remove an unaccepted draft from CURRENT DRAFT WORKSPACE by proposal id.",
			parameters: {
				type: "object",
				properties: { proposalId: { type: "string" } },
				required: ["proposalId"],
			},
		},
	},
	{
		type: "function",
		function: {
			name: "update_card",
			description:
				"Propose changes to an existing card's fields (e.g. fill an empty answer). Pass only the fields you change.",
			parameters: {
				type: "object",
				properties: {
					cardId: { type: "string" },
					fields: FIELDS_SCHEMA,
				},
				required: ["cardId", "fields"],
			},
		},
	},
	{
		type: "function",
		function: {
			name: "update_draft",
			description:
				"Propose changes to the draft card currently open in the flashcard editor. Pass only fields you change. Use this instead of update_card when CURRENT DRAFT is present.",
			parameters: {
				type: "object",
				properties: { fields: FIELDS_SCHEMA },
				required: ["fields"],
			},
		},
	},
	{
		type: "function",
		function: {
			name: "append_to_note",
			description:
				"Propose appending a markdown section to an existing note (vault path).",
			parameters: {
				type: "object",
				properties: {
					path: {
						type: "string",
						description: "Vault path, e.g. Folder/Note.md",
					},
					markdown: { type: "string" },
				},
				required: ["path", "markdown"],
			},
		},
	},
	{
		type: "function",
		function: {
			name: "create_note",
			description: "Propose creating a new source note with markdown content.",
			parameters: {
				type: "object",
				properties: {
					title: { type: "string" },
					markdown: { type: "string" },
				},
				required: ["title", "markdown"],
			},
		},
	},
	{
		type: "function",
		function: {
			name: "insert_diagram",
			description:
				"Propose a Mermaid (preferred) or inline SVG diagram attached to a card field or a note.",
			parameters: {
				type: "object",
				properties: {
					target: TARGET_SCHEMA,
					format: { type: "string", enum: ["mermaid", "svg"] },
					code: {
						type: "string",
						description: "Diagram source code, no fences",
					},
				},
				required: ["target", "format", "code"],
			},
		},
	},
	{
		type: "function",
		function: {
			name: "search_images",
			description:
				"Search the web (Openverse, CC-licensed) for images about a topic. Returns candidates; the user picks which to attach. Also records an attach-images proposal for the given target.",
			parameters: {
				type: "object",
				properties: {
					query: { type: "string" },
					count: { type: "number", description: "Max candidates, default 6" },
					target: TARGET_SCHEMA,
				},
				required: ["query", "target"],
			},
		},
	},
	{
		type: "function",
		function: {
			name: "read_note",
			description: "Read a note's markdown content by vault path (read-only).",
			parameters: {
				type: "object",
				properties: { path: { type: "string" } },
				required: ["path"],
			},
		},
	},
	{
		type: "function",
		function: {
			name: "get_related_cards",
			description:
				"List existing cards that share the current card's source note, to avoid duplicates and match style (read-only).",
			parameters: { type: "object", properties: {} },
		},
	},
];
