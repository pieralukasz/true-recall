import type { ChatMessage } from "../clients/openrouter-client";

interface BuildInput {
	prompt: string;
	cardFront: string;
	cardBack: string;
}

const JSON_CONTRACT = `You must respond with a single JSON object matching this shape, and nothing else:
{
  "front": "<new card front, markdown>",
  "back": "<new card back, markdown>"
}
No prose, no code fence labels, no commentary. Preserve the meaning of the card unless the instruction explicitly asks to change it.`;

export function buildPolishMessages(input: BuildInput): ChatMessage[] {
	const system = `${input.prompt.trim()}\n\n${JSON_CONTRACT}`;
	const user = `Current card:\nFRONT:\n${input.cardFront}\n\nBACK:\n${input.cardBack}`;
	return [
		{ role: "system", content: system },
		{ role: "user", content: user },
	];
}
