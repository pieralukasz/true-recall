import type { CommandDef } from "../registry.js";
import { postParams } from "../registry.js";

const C = "Export";

export const exportCommands: CommandDef[] = [
	postParams(
		"export_csv",
		"Export flashcards to CSV/TSV. Returns content string and suggested filename.",
		C,
		"/export/csv",
		{
			source_uids: {
				type: "json",
				description:
					"JSON array of source UIDs to filter by (flashcard_uid values from note frontmatter)",
			},
			include_scheduling: {
				type: "boolean",
				description: "Include FSRS scheduling data (default: true)",
				default: true,
			},
			separator: {
				type: "string",
				description: "CSV separator character",
				enum: [",", "\\t", ";"],
				default: ",",
			},
		},
	),
];
