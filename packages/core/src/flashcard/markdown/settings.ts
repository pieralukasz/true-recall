import { z } from "zod";

const separator = z
	.string()
	.trim()
	.min(1)
	.max(80)
	.refine(
		(value) => !/[\r\n]/.test(value) && !/^(?:---|```|~~~|<!--|#)/.test(value),
		"Use a single separator line that is not Markdown frontmatter, a heading, code fence, or comment.",
	);
export const MarkdownFlashcardsSettingsSchema = z
	.object({
		enabled: z.boolean().default(false),
		tag: z
			.string()
			.trim()
			.regex(/^[\p{L}\p{N}_/-]+$/u)
			.default("flashcards"),
		basicSeparator: separator.default("??"),
		reversedSeparator: separator.default("???"),
		storeScheduling: z.boolean().default(false),
	})
	.refine(
		(value) => value.basicSeparator !== value.reversedSeparator,
		"The two separators must be different.",
	);
export type MarkdownFlashcardsSettings = z.infer<
	typeof MarkdownFlashcardsSettingsSchema
>;
export const DEFAULT_MARKDOWN_FLASHCARDS =
	MarkdownFlashcardsSettingsSchema.parse({});
