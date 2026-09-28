/**
 * Whether the editor renders the "My Note" field.
 *
 * With the setting off the field stays hidden until the user asks for it
 * (Cmd/Ctrl+K), but a note that already carries a comment always shows it,
 * so hiding the field never hides saved text.
 */
export function shouldShowUserCommentField(
	settingEnabled: boolean,
	comment: string,
	revealed: boolean,
): boolean {
	return settingEnabled || revealed || comment.trim().length > 0;
}
