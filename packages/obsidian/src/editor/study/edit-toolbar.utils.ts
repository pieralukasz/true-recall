/**
 * Edit Toolbar Utilities
 * Pure functions for text formatting operations on textareas,
 * toolbar button definitions, and related types.
 */

// ─── Toolbar Button Types & Data ───────────────────────────────────

export type ToolbarButtonAction =
	| { type: "toggle"; before: string; after: string }
	| { type: "insert"; text: string }
	| { type: "custom"; handler: (textarea: HTMLTextAreaElement) => void };

export interface ToolbarButton {
	id: string;
	label: string;
	title: string;
	action: ToolbarButtonAction;
	shortcut?: string;
}
