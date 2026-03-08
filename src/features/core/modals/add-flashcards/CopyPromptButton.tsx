import { DEFAULT_PROMPTS } from "@features/ai/prompts/default-prompts";
import { Clickable } from "@shared/ui/components/Clickable";
import { useState } from "preact/hooks";

export function CopyPromptButton() {
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		await navigator.clipboard.writeText(DEFAULT_PROMPTS.basic);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<Clickable
			class="ep:text-ui-smaller ep:text-obs-muted ep:hover:text-obs-accent ep:transition-colors"
			onClick={handleCopy}
		>
			{copied ? "Copied!" : "Copy Prompt"}
		</Clickable>
	);
}
