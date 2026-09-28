import type { RefObject } from "preact";
import { useCallback, useEffect, useState } from "preact/hooks";

import type TrueRecallPlugin from "@true-recall/obsidian/main";

import { shouldShowUserCommentField } from "../domain/user-comment-visibility";

export function useUserCommentVisibility(
	plugin: TrueRecallPlugin,
	userComment: string,
	inputRef: RefObject<HTMLTextAreaElement>,
) {
	const [settingEnabled, setSettingEnabled] = useState(
		() => plugin.settings.showEditorUserNote,
	);
	const [revealed, setRevealed] = useState(false);
	const [focusRequest, setFocusRequest] = useState(0);

	useEffect(
		() =>
			plugin.coreApp.events.on("settings:changed", () => {
				setSettingEnabled(plugin.settings.showEditorUserNote);
			}),
		[plugin],
	);

	// The field may not be mounted yet when Cmd/Ctrl+K reveals it, so focus
	// after the render that adds it.
	useEffect(() => {
		if (focusRequest > 0) inputRef.current?.focus();
	}, [focusRequest, inputRef]);

	// Once a note has text the field stays for the rest of this editor, so
	// clearing the text does not pull the textarea out from under the cursor.
	const hasComment = userComment.trim().length > 0;
	useEffect(() => {
		if (hasComment) setRevealed(true);
	}, [hasComment]);

	const focusUserComment = useCallback(() => {
		setRevealed(true);
		setFocusRequest((value) => value + 1);
	}, []);

	return {
		showUserComment: shouldShowUserCommentField(
			settingEnabled,
			userComment,
			revealed,
		),
		focusUserComment,
	};
}
