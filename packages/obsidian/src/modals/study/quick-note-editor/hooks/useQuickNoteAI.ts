import { Notice } from "obsidian";
import { useCallback, useEffect, useRef } from "preact/hooks";

import type { AssistantContext } from "@true-recall/core/ai/assistant";

import { isPluginEnabled } from "@true-recall/obsidian/plugin/plugin-utils";
import { registerAssistantDraftTarget } from "@true-recall/obsidian/services/assistant/assistant-draft-target-registry";
import { openAssistantEditorWindow } from "@true-recall/obsidian/views/modal-window/open-assistant-editor-window";

import { deriveAIWandState } from "../ai-wand-state";
import type { QuickNoteEditor } from "./useQuickNoteEditor";
export function useQuickNoteAI(editor: QuickNoteEditor) {
	const {
		app,
		plugin,
		sourceNoteFile,
		noteType,
		isEdit,
		resolveSourceUid,
		rootRef,
		stateRef,
		edit,
	} = editor;
	const assistantDraftSessionIdRef = useRef("");
	if (!assistantDraftSessionIdRef.current)
		assistantDraftSessionIdRef.current = `qne-${crypto.randomUUID()}`;
	const closeAssistantWindowRef = useRef<(() => void) | null>(null);
	const mountedRef = useRef(true);
	useEffect(() => {
		mountedRef.current = true;
		const unregister = registerAssistantDraftTarget(
			assistantDraftSessionIdRef.current,
			{
				getFields: () => stateRef.current.fields,
				applyFields: (next) =>
					edit({
						type: "fields",
						fields: { ...stateRef.current.fields, ...next },
					}),
			},
		);
		return () => {
			mountedRef.current = false;
			unregister();
			const close = closeAssistantWindowRef.current;
			closeAssistantWindowRef.current = null;
			close?.();
		};
	}, [stateRef, edit]);
	// The editor registers itself as a temporary Assistant target. The task only
	// stores a serializable session id, while applying the accepted proposal
	// updates this still-open draft through the registry above.
	const assistantActive = isPluginEnabled(plugin.settings, "ai-assistant");
	const { disabled: aiDisabled, title: aiTitle } = deriveAIWandState({
		hasSourceNote: !!sourceNoteFile,
		assistantActive,
	});

	const openAI = useCallback(() => {
		if (aiDisabled) return;
		if (closeAssistantWindowRef.current) {
			const close = closeAssistantWindowRef.current;
			closeAssistantWindowRef.current = null;
			close();
			return;
		}
		if (!sourceNoteFile || !noteType) return;
		void Promise.all([resolveSourceUid(), app.vault.cachedRead(sourceNoteFile)])
			.then(([uid, sourceText]) => {
				if (!mountedRef.current) return;
				if (!uid) {
					new Notice("AI: could not resolve source note UID.");
					return;
				}
				const context: AssistantContext = {
					activeNotePath: sourceNoteFile.path,
					source: { path: sourceNoteFile.path, uid, text: sourceText },
					draftCard: {
						sessionId: assistantDraftSessionIdRef.current,
						fields: stateRef.current.fields,
						noteType: {
							id: noteType.id,
							name: noteType.name,
							fields: noteType.fields,
						},
						sourceUid: uid,
						sourceNotePath: sourceNoteFile.path,
						operation: isEdit ? "edit" : "create",
					},
				};
				const sourceWindow =
					rootRef.current?.ownerDocument.defaultView ?? window;
				let closeWindow: (() => void) | null = null;
				closeWindow = openAssistantEditorWindow(plugin, context, {
					sourceWindow,
					onClose: () => {
						if (closeAssistantWindowRef.current === closeWindow) {
							closeAssistantWindowRef.current = null;
						}
					},
				});
				closeAssistantWindowRef.current = closeWindow;
			})
			.catch((err) => {
				console.error("[Assistant] AI window open failed", err);
				new Notice("AI: could not resolve source note.");
			});
	}, [
		aiDisabled,
		sourceNoteFile,
		noteType,
		stateRef,
		isEdit,
		resolveSourceUid,
		plugin,
		app.vault,
		rootRef,
	]);

	return { aiDisabled, aiTitle, openAI };
}
