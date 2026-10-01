/**
 * MCP tool annotations for every True Recall tool, in one reviewable place.
 * The MCP server attaches them at registration and fails at startup if a
 * tool has none; the CLI shows the same labels in `--help`.
 *
 * Harnesses act on these: Hermes asks for approval before any tool without
 * readOnlyHint on an untrusted server, and Claude Code shows destructive
 * tools differently. `destructiveHint` marks calls that overwrite or remove
 * user data with no API call to restore it (deletes, text rewrites, grades,
 * FSRS weight changes). Reversible changes (suspend, flag, archive, move)
 * are plain writes. `openWorldHint` marks calls that reach the external AI
 * provider configured in the plugin.
 */
export type ToolHints = {
	readOnlyHint: boolean;
	destructiveHint?: boolean;
	idempotentHint?: boolean;
	openWorldHint: boolean;
};

const READ: ToolHints = { readOnlyHint: true, openWorldHint: false };
const WRITE: ToolHints = {
	readOnlyHint: false,
	destructiveHint: false,
	idempotentHint: false,
	openWorldHint: false,
};
const WRITE_IDEMPOTENT: ToolHints = { ...WRITE, idempotentHint: true };
const DESTRUCTIVE: ToolHints = {
	readOnlyHint: false,
	destructiveHint: true,
	idempotentHint: false,
	openWorldHint: false,
};
const DESTRUCTIVE_IDEMPOTENT: ToolHints = {
	...DESTRUCTIVE,
	idempotentHint: true,
};
const AI_WRITE: ToolHints = { ...WRITE, openWorldHint: true };

export const TOOL_HINTS: Record<string, ToolHints> = {
	// Context
	get_status: READ,
	get_full_context: READ,
	get_active_note: READ,
	// Cards: read
	list_cards: READ,
	get_actual_learning_cards: READ,
	get_card: READ,
	get_card_context: READ,
	get_card_relations: READ,
	get_due_cards: READ,
	get_problem_cards: READ,
	// Cards: write
	create_flashcard: WRITE,
	create_flashcards_batch: WRITE,
	suspend_card: WRITE_IDEMPOTENT,
	bulk_suspend_cards: WRITE_IDEMPOTENT,
	set_card_flag: WRITE_IDEMPOTENT,
	bury_cards: WRITE_IDEMPOTENT,
	move_card: WRITE_IDEMPOTENT,
	update_card: DESTRUCTIVE_IDEMPOTENT,
	delete_card: DESTRUCTIVE_IDEMPOTENT,
	bulk_delete_cards: DESTRUCTIVE_IDEMPOTENT,
	remove_cards_from_note: DESTRUCTIVE_IDEMPOTENT,
	// Review
	get_review_context: READ,
	reveal_answer: WRITE_IDEMPOTENT,
	grade_review_card: DESTRUCTIVE,
	grade_card: DESTRUCTIVE,
	start_review_session: WRITE,
	// AI generation (calls the plugin's configured AI provider)
	generate_flashcards: AI_WRITE,
	generate_flashcards_with_preset: AI_WRITE,
	get_note_types: READ,
	// Generation presets
	list_generation_presets: READ,
	get_generation_preset: READ,
	create_generation_preset: WRITE,
	update_generation_preset: DESTRUCTIVE_IDEMPOTENT,
	delete_generation_preset: DESTRUCTIVE_IDEMPOTENT,
	// Card Polish presets
	list_card_polish_presets: READ,
	create_card_polish_preset: WRITE,
	update_card_polish_preset: DESTRUCTIVE_IDEMPOTENT,
	delete_card_polish_preset: DESTRUCTIVE_IDEMPOTENT,
	// Dashboard
	get_dashboard: READ,
	get_projects: READ,
	get_project: READ,
	// FSRS
	get_fsrs_presets: READ,
	create_fsrs_preset: WRITE,
	update_fsrs_preset: DESTRUCTIVE_IDEMPOTENT,
	set_load_balance: WRITE_IDEMPOTENT,
	get_fsrs_analytics: READ,
	optimize_parameters: READ,
	simulate_reviews: READ,
	reschedule_from_history: DESTRUCTIVE,
	get_workload_forecast: READ,
	get_retrievability: READ,
	get_scheduling_preview: READ,
	// Navigation (changes what Obsidian shows, not data)
	open_view: WRITE_IDEMPOTENT,
	open_note: WRITE_IDEMPOTENT,
	// Notes and projects
	add_flashcard_uid: WRITE_IDEMPOTENT,
	set_note_preset: WRITE_IDEMPOTENT,
	set_note_parent: WRITE_IDEMPOTENT,
	set_note_archive: WRITE_IDEMPOTENT,
	dissolve_project: DESTRUCTIVE,
	move_project_children: WRITE,
	toggle_note_review: DESTRUCTIVE,
	note_review_status: READ,
	note_stats: READ,
	note_cards: READ,
	// Backup
	create_backup: WRITE,
	list_backups: READ,
	check_integrity: READ,
	// Stats
	get_study_summary: READ,
	get_daily_stats: READ,
	get_study_patterns: READ,
	get_session_analysis: READ,
	get_study_recommendations: READ,
	// Export and query
	export_csv: READ,
	query_sql: READ,
	get_schema: READ,
};

export function hintsFor(name: string): ToolHints {
	const hints = TOOL_HINTS[name];
	if (!hints) {
		throw new Error(
			`Tool "${name}" has no entry in TOOL_HINTS (tools/_hints.ts)`,
		);
	}
	return hints;
}

/** Short label for CLI help: "read-only", "destructive", or "write". */
export function hintLabel(name: string): string {
	const hints = TOOL_HINTS[name];
	if (!hints) return "";
	if (hints.readOnlyHint) return "read-only";
	return hints.destructiveHint ? "destructive" : "write";
}
