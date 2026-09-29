import type { UIMessage } from "ai";

/** Tools whose result waits for the user's decision in the chat. */
export const PROPOSAL_TOOLS = ["propose_cards", "propose_card_edit"] as const;
export type ProposalToolName = (typeof PROPOSAL_TOOLS)[number];

export interface ProposedCard {
	question: string;
	answer: string;
}

export interface ProposeCardsInput {
	/** Note the cards come from; the chat's note when omitted. */
	notePath?: string | null;
	cards: ProposedCard[];
}

export interface FieldChange {
	field: string;
	value: string;
}

export interface ProposeCardEditInput {
	cardId: string;
	/**
	 * Only the note fields that change. A list, because models (Gemini) send
	 * an empty object for a free-form `additionalProperties` map. Chats saved
	 * before the list shape hold a `{ name: value }` map.
	 */
	fields: FieldChange[] | Record<string, string>;
	reason?: string;
}

/** The proposed changes as `{ field: value }`; tolerates half-streamed input. */
export function editFields(
	fields: ProposeCardEditInput["fields"] | undefined,
): Record<string, string> {
	if (!fields || typeof fields !== "object") return {};
	if (!Array.isArray(fields)) {
		return Object.fromEntries(
			Object.entries(fields).filter(([, v]) => typeof v === "string"),
		);
	}
	const out: Record<string, string> = {};
	for (const change of fields) {
		if (
			change &&
			typeof change.field === "string" &&
			change.field &&
			typeof change.value === "string"
		) {
			out[change.field] = change.value;
		}
	}
	return out;
}

/** What the edit tool returns: the fields as they were when proposed. */
export type ProposeCardEditOutput =
	| { before: Record<string, string>; error?: undefined }
	| { error: string; before?: undefined };

export type FactCheckVerdict =
	| "confirmed"
	| "incorrect"
	| "outdated"
	| "unverifiable";

export interface ReportFactCheckInput {
	cardId: string;
	verdict: FactCheckVerdict;
	confidence: "high" | "medium" | "low";
	summary: string;
	evidence?: { url: string; title?: string; quote?: string }[];
}

/** What the user did with one proposal, keyed by the tool call id. */
export type ProposalDecision =
	| {
			kind: "cards-added";
			cardIds: string[];
			added: number;
			proposed: number;
			at: number;
	  }
	| {
			kind: "edit-applied";
			noteId: string;
			cardId: string;
			before: Record<string, string>;
			after: Record<string, string>;
			at: number;
	  }
	| { kind: "skipped"; at: number };

export type ProposalDecisions = Record<string, ProposalDecision>;

/** User work on a proposal, shared by the review panel and the chat. */
export interface ProposalDraft {
	picked?: boolean[];
	cardEdits?: Record<number, ProposedCard>;
	fieldEdits?: Record<string, string>;
	cardEditor?: { index: number; value: ProposedCard };
	editingFields?: boolean;
}

export type ProposalDrafts = Record<string, ProposalDraft>;

interface ToolPartLike {
	type: string;
	toolCallId?: string;
	state?: string;
	output?: unknown;
}

function isOpenProposal(part: ToolPartLike): boolean {
	const name = part.type.startsWith("tool-") ? part.type.slice(5) : "";
	if (!(PROPOSAL_TOOLS as readonly string[]).includes(name)) return false;
	if (part.state !== "output-available" || !part.toolCallId) return false;
	// An edit of a card that no longer exists has nothing to decide.
	const output = part.output as { error?: string } | undefined;
	return !output?.error;
}

/** Tool call ids of the proposals that finished streaming, oldest first. */
export function proposalCallIds(messages: readonly UIMessage[]): string[] {
	const ids: string[] = [];
	for (const message of messages) {
		for (const part of message.parts as ToolPartLike[]) {
			if (isOpenProposal(part) && part.toolCallId) ids.push(part.toolCallId);
		}
	}
	return ids;
}

/** Proposals the user has not added, applied or skipped yet. */
export function countPending(
	messages: readonly UIMessage[],
	decisions: ProposalDecisions,
): number {
	return proposalCallIds(messages).filter((id) => !decisions[id]).length;
}

/** Tells the model what happened to its earlier proposals. */
export function describeDecisions(decisions: ProposalDecisions): string {
	return Object.entries(decisions)
		.map(([callId, d]) => {
			switch (d.kind) {
				case "cards-added":
					return `- ${callId}: the user added ${d.added} of ${d.proposed} proposed cards (card ids: ${d.cardIds.join(", ")}).`;
				case "edit-applied":
					return `- ${callId}: the user applied the edit to card ${d.cardId}.`;
				default:
					return `- ${callId}: the user skipped this proposal.`;
			}
		})
		.join("\n");
}

/** The picked subset, with the user's edits applied. Empty questions are dropped. */
export function pickCards(
	cards: readonly ProposedCard[],
	picked: readonly (boolean | undefined)[],
	edits: Readonly<Record<number, ProposedCard>>,
): ProposedCard[] {
	return cards
		.map((card, i) => edits[i] ?? normalizeCard(card))
		.filter((card, i) => (picked[i] ?? true) && card.question.trim() !== "");
}

/**
 * Models sometimes name the sides after the note type's fields (Front/Back)
 * instead of question/answer. Accepts both; tolerates half-streamed cards.
 */
export function normalizeCard(raw: unknown): ProposedCard {
	const card = (raw ?? {}) as Record<string, unknown>;
	const pick = (...keys: string[]) => {
		for (const key of keys) {
			if (typeof card[key] === "string") return card[key] as string;
		}
		return "";
	};
	return {
		question: pick("question", "Front", "front", "Question", "Text", "text"),
		answer: pick("answer", "Back", "back", "Answer", "Back Extra"),
	};
}

/** Fields after the edit: the proposal overrides only fields the note has. */
export function mergeFields(
	current: Readonly<Record<string, string>>,
	changes: Readonly<Record<string, string>>,
): Record<string, string> {
	const next = { ...current };
	for (const [name, value] of Object.entries(changes)) {
		if (name in current) next[name] = value;
	}
	return next;
}

/** Field names whose text the edit really changes, in note-type order. */
export function changedFields(
	before: Readonly<Record<string, string>>,
	changes: Readonly<Record<string, string>>,
): string[] {
	return Object.keys(before).filter(
		(name) => name in changes && changes[name] !== before[name],
	);
}
