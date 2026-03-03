import { Clickable } from "@shared/ui/components/Clickable";
import { useState } from "preact/hooks";

const PROMPT_TEXT = `Generate flashcards about [TOPIC]. Output each flashcard on a single line using this exact format:
Question :: Answer

Do not add numbering, bullets, or any other formatting.
One flashcard per line.`;

export function CopyPromptButton() {
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		await navigator.clipboard.writeText(PROMPT_TEXT);
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
