import { useCallback, useRef } from "preact/hooks";

import type { BatchCreateCommand } from "@true-recall/obsidian/commands/commands/card-create.cmd";
import { notify } from "@true-recall/obsidian/services/notification.service";

import type { QuickNoteEditor } from "./useQuickNoteEditor";

export function useQuickNoteUndo(
	editor: QuickNoteEditor,
	savingRef: { current: boolean },
) {
	const { plugin, isEdit, revisionRef, dispatch } = editor;
	const pendingRef = useRef<{
		command: BatchCreateCommand;
		fields: Record<string, string>;
		userComment: string;
		revision: number;
	} | null>(null);
	const rememberCreate = useCallback(
		(
			command: BatchCreateCommand,
			fields: Record<string, string>,
			userComment: string,
			revision: number,
		) => {
			pendingRef.current = {
				command,
				fields: { ...fields },
				userComment,
				revision,
			};
		},
		[],
	);
	const handleUndoLastCreate = useCallback((): boolean => {
		const pending = pendingRef.current;
		if (
			isEdit ||
			savingRef.current ||
			!pending ||
			pending.revision !== revisionRef.current ||
			!plugin.commandService?.isNextUndo(pending.command)
		)
			return false;
		pendingRef.current = null;
		const revision = revisionRef.current;
		void plugin.commandService
			.undo()
			.then((undone) => {
				if (!undone || revision !== revisionRef.current) return;
				dispatch({ type: "fields", fields: { ...pending.fields } });
				dispatch({ type: "comment", value: pending.userComment });
			})
			.catch((error) => notify().operationFailed("undo card creation", error));
		return true;
	}, [isEdit, plugin, savingRef, revisionRef, dispatch]);
	return { rememberCreate, handleUndoLastCreate };
}
