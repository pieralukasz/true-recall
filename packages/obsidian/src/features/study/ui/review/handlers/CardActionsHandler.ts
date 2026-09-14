import {
	CardActionContext,
	type CardActionsCallbacks,
	type CardActionsHandlerDeps,
} from "./CardActionContext";
import { CardCreationActions } from "./CardCreationActions";
import { CardEditingActions } from "./CardEditingActions";
import { CardLifecycleActions } from "./CardLifecycleActions";
export class CardActionsHandler {
	private lifecycle: CardLifecycleActions;
	private editing: CardEditingActions;
	private creation: CardCreationActions;
	constructor(deps: CardActionsHandlerDeps, callbacks: CardActionsCallbacks) {
		const context = new CardActionContext(deps, callbacks);
		this.lifecycle = new CardLifecycleActions(context);
		this.editing = new CardEditingActions(context);
		this.creation = new CardCreationActions(context);
	}

	canUndo(): boolean {
		return this.lifecycle.canUndo();
	}

	canForgetCurrentCard(): boolean {
		return this.lifecycle.canForgetCurrentCard();
	}

	handleDelete(): void {
		this.lifecycle.handleDelete();
	}

	handleSuspend(): void {
		this.lifecycle.handleSuspend();
	}

	handleBuryCard(): void {
		this.lifecycle.handleBuryCard();
	}

	handleForget(): void {
		this.lifecycle.handleForget();
	}

	handleBuryNote(): void {
		this.lifecycle.handleBuryNote();
	}

	async handleMoveCard(): Promise<void> {
		return this.lifecycle.handleMoveCard();
	}

	async handleUndo(): Promise<boolean> {
		return this.lifecycle.handleUndo();
	}

	async handleEditCardModal(): Promise<void> {
		return this.editing.handleEditCardModal();
	}

	async handleEditComment(): Promise<void> {
		return this.editing.handleEditComment();
	}

	handleRemoveComment(): void {
		this.editing.handleRemoveComment();
	}

	async handleChangeNoteType(): Promise<void> {
		return this.editing.handleChangeNoteType();
	}

	refreshCurrentCard(): void {
		this.editing.refreshCurrentCard();
	}

	async handleAddNewFlashcard(): Promise<void> {
		return this.creation.handleAddNewFlashcard();
	}

	async handleAddCopyOfCurrentFlashcard(): Promise<void> {
		return this.creation.handleAddCopyOfCurrentFlashcard();
	}

	async handleAddImageOcclusion(): Promise<void> {
		return this.creation.handleAddImageOcclusion();
	}
}
