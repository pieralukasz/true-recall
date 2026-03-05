import { Clickable } from "@shared/ui/components/Clickable";
import type { NoteType } from "@shared/types/note.types";
import { useState } from "preact/hooks";

// Legacy static prompt used when no NoteType is provided (old Quick tab).
const LEGACY_PROMPT = `Generate flashcards about [TOPIC] using this exact block format:

#type/basic
Front: [question]
Back: [answer]
---

Rules:
- Each card starts with #type/basic
- Separate cards with --- on its own line
- One atomic fact per card
- Bold key terms with **bold**
- No numbering or bullets`;

interface CopyPromptButtonProps {
	/** When provided, generates a NoteType-specific prompt instead of the legacy one. */
	noteType?: NoteType;
	getPrompt?: () => string;
}

export function CopyPromptButton({ noteType, getPrompt }: CopyPromptButtonProps) {
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		let prompt: string;
		if (getPrompt) {
			prompt = getPrompt();
		} else if (noteType) {
			// Lazy import to avoid bundling prompt-generator in old Quick tab
			const { generateImportPrompt } = await import(
				"../import-studio/prompt-generator"
			);
			prompt = generateImportPrompt(noteType);
		} else {
			prompt = LEGACY_PROMPT;
		}
		await navigator.clipboard.writeText(prompt);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<Clickable
			class="ep:text-ui-smaller ep:text-obs-muted ep:hover:text-obs-accent ep:transition-colors"
			onClick={handleCopy}
		>
			{copied ? "Copied!" : "Copy prompt for ChatGPT"}
		</Clickable>
	);
}
