export type AssistantTaskStatus =
	| "pending"
	| "running"
	| "done"
	| "failed"
	| "cancelled";

export type ProposalStatus = "proposed" | "applied" | "rejected";

/** Snapshot of the card the user asked about, taken at trigger time. */
export interface AssistantCardContext {
	cardId: string;
	noteId?: string;
	noteTypeId?: string;
	question: string;
	answer: string;
	sourceUid?: string;
	sourceNotePath?: string;
}

/** Serializable snapshot of a card form that has not necessarily been saved. */
export interface AssistantDraftCardContext {
	sessionId: string;
	fields: Record<string, string>;
	noteType: { id: string; name: string; fields: string[] };
	sourceUid?: string;
	sourceNotePath?: string;
	operation: "create" | "edit";
}

/** Provenance captured at invocation time for newly created content. */
export interface AssistantSourceContext {
	path?: string;
	uid?: string;
	text?: string;
}

/** Current materialized drafts supplied to a follow-up conversation turn. */
export interface AssistantDraftWorkspaceContext {
	revision: number;
	manifest: AssistantManifest;
}

/** Recent turns supplied to the model so follow-ups can refer to prior requests. */
export interface AssistantConversationTurn {
	role: "user" | "assistant";
	content: string;
}

/** Context snapshot captured when the task is enqueued. */
export interface AssistantContext {
	selectedText?: string;
	card?: AssistantCardContext;
	draftCard?: AssistantDraftCardContext;
	draftWorkspace?: AssistantDraftWorkspaceContext;
	conversation?: AssistantConversationTurn[];
	source?: AssistantSourceContext;
	activeNotePath?: string;
	/** Apply generated cards directly when invoked from a source-note action. */
	applyGeneratedCardsImmediately?: boolean;
}

export interface Citation {
	url: string;
	title?: string;
}

export interface ImageCandidate {
	url: string;
	thumbnailUrl?: string;
	title?: string;
	license?: string;
	/** Set by the user in the inbox before apply. */
	selected?: boolean;
}

export type ProposalTarget =
	| { kind: "card-field"; cardId: string; noteId: string; field: string }
	| { kind: "note"; path: string };

interface ProposalBase {
	id: string;
	status: ProposalStatus;
}

export type AssistantProposal =
	| (ProposalBase & {
			type: "create_card";
			noteTypeId: string;
			fields: Record<string, string>;
			sourceUid?: string;
			sourcePath?: string;
			sourceText?: string;
			generationPresetId?: string;
	  })
	| (ProposalBase & {
			type: "update_card";
			cardId: string;
			noteId: string;
			/** Only the changed fields. */
			fields: Record<string, string>;
			/** Full field snapshot at proposal time, for conflict detection + undo. */
			previousFields: Record<string, string>;
	  })
	| (ProposalBase & {
			type: "update_draft";
			sessionId: string;
			fields: Record<string, string>;
			previousFields: Record<string, string>;
	  })
	| (ProposalBase & { type: "append_to_note"; path: string; markdown: string })
	| (ProposalBase & {
			type: "create_note";
			title: string;
			markdown: string;
			parentProject?: string;
	  })
	| (ProposalBase & {
			type: "insert_diagram";
			target: ProposalTarget;
			format: "mermaid" | "svg";
			code: string;
	  })
	| (ProposalBase & {
			type: "attach_images";
			target: ProposalTarget;
			candidates: ImageCandidate[];
	  });

/** Cumulative token counts reported by the provider across a task's requests. */
export interface TokenUsage {
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
}

export interface AssistantManifest {
	proposals: AssistantProposal[];
	citations: Citation[];
	/** The model's final plain-text answer (shown when no proposals were made). */
	finalText?: string;
	/** Token usage summed over all agent iterations, when the provider reports it. */
	usage?: TokenUsage;
}

export interface AssistantTask {
	id: string;
	threadId?: string;
	instruction: string;
	presetId?: string;
	context: AssistantContext;
	status: AssistantTaskStatus;
	manifest?: AssistantManifest;
	error?: string;
	createdAt: number;
	finishedAt?: number;
}

export type AssistantThreadState = "active" | "inbox" | "archived";

export interface AssistantThreadMessage {
	id: string;
	role: "user" | "assistant";
	content: string;
	createdAt: number;
}

export interface AssistantThreadRevision {
	revision: number;
	manifest: AssistantManifest;
	messagesLength: number;
}

/** Persistent conversation whose materialized result is a working draft set. */
export interface AssistantThread {
	id: string;
	title: string;
	context: AssistantContext;
	state: AssistantThreadState;
	messages: AssistantThreadMessage[];
	manifest?: AssistantManifest;
	revisions: AssistantThreadRevision[];
	revision: number;
	activeTaskId?: string;
	createdAt: number;
	updatedAt: number;
}

export type AssistantProgressEvent =
	| { kind: "iteration"; index: number }
	| { kind: "tool"; name: string }
	| { kind: "usage"; usage: TokenUsage }
	| { kind: "done" };
