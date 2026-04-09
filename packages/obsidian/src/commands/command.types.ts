import type { FlashcardManager } from "@true-recall/core/flashcard/flashcard.service";
import type { SessionPersistenceService } from "@true-recall/core/persistence/session/session-persistence.service";
import type { SqliteStoreService } from "@true-recall/core/persistence/sqlite";

import type { MutationType } from "@true-recall/obsidian/data/queries";

export interface CommandContext {
	flashcardManager: FlashcardManager;
	cardStore: SqliteStoreService;
	sessionPersistence: SessionPersistenceService;
}

export interface Command {
	readonly type: string;
	readonly description: string;
	readonly mutationType: MutationType;

	execute(ctx: CommandContext): void | Promise<void>;
	undo(ctx: CommandContext): void | Promise<void>;

	readonly deferred?: boolean;
	cancelPendingWrite?(): boolean;
}

export interface CommandHook {
	afterExecute?(command: Command): void;
	beforeUndo?(command: Command): void;
	afterUndo?(command: Command): void;
	beforeRedo?(command: Command): void;
	afterRedo?(command: Command): void;
}
