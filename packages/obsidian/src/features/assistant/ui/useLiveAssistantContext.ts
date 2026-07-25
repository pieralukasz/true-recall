import { useEffect, useRef, useState } from "preact/hooks";

import type { AssistantContext } from "@true-recall/core/ai/assistant";

import type TrueRecallPlugin from "@true-recall/obsidian/main";
import { usePlugin } from "@true-recall/obsidian/preact/ObsidianContext";

import {
	type AssistantContextCard,
	isSameAssistantSubject,
	resolveAssistantContext,
} from "./ai-context-source";

/** Reads what the user is looking at right now: the card under review if a
 * session is running, otherwise the open note. */
export function readLiveAssistantContext(
	plugin: TrueRecallPlugin,
): AssistantContext {
	const review = plugin.store?.getState().review;
	const reviewCard: AssistantContextCard | null =
		review?.isActive === true
			? (review.queue[review.currentIndex] ?? null)
			: null;

	return resolveAssistantContext({
		reviewCard,
		activeNotePath: plugin.app.workspace.getActiveFile()?.path ?? null,
		selectedText:
			plugin.app.workspace.activeEditor?.editor?.getSelection() ?? null,
	});
}

/**
 * Live context for long-lived surfaces such as the docked workspace.
 *
 * While `isFrozen` is set the subject stops following the review queue, so
 * grading a card mid-sentence cannot swap the subject under the user's hands.
 * The frozen value is captured at the moment freezing starts and released as
 * soon as the caller unfreezes.
 */
export function useLiveAssistantContext(isFrozen: boolean): AssistantContext {
	const plugin = usePlugin();
	const [live, setLive] = useState<AssistantContext>(() =>
		readLiveAssistantContext(plugin),
	);
	const frozenRef = useRef<AssistantContext | null>(null);

	useEffect(() => {
		const refresh = () => {
			const next = readLiveAssistantContext(plugin);
			setLive((current) =>
				isSameAssistantSubject(current, next) ? current : next,
			);
		};

		const store = plugin.store;
		const unsubscribeStore = store?.subscribe((s) => s.review, refresh);
		const workspace = plugin.app.workspace;
		const onLeafChange = workspace.on("active-leaf-change", refresh);
		const onFileOpen = workspace.on("file-open", refresh);

		refresh();

		return () => {
			unsubscribeStore?.();
			workspace.offref(onLeafChange);
			workspace.offref(onFileOpen);
		};
	}, [plugin]);

	if (!isFrozen) {
		frozenRef.current = null;
		return live;
	}
	frozenRef.current ??= live;
	return frozenRef.current;
}
