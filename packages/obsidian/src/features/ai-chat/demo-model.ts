import type { LanguageModelV4StreamPart } from "@ai-sdk/provider";
import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";

/**
 * PROTOTYPE ONLY: a scripted model so the chat UI can be shown and tested
 * without an API key. It answers the demo prompts with the same tool calls a
 * real model would make. Replace with the user's provider before shipping.
 */

export interface DemoContext {
	notePath: string | null;
	noteTitle: string | null;
	/** First card of the active note, for the "fix a card" demo. */
	firstCard: { id: string; question: string; answer: string } | null;
}

const usage = {
	inputTokens: {
		total: 0,
		noCache: 0,
		cacheRead: undefined,
		cacheWrite: undefined,
	},
	outputTokens: { total: 0, text: 0, reasoning: undefined },
};

function textChunks(id: string, text: string): LanguageModelV4StreamPart[] {
	const words = text.split(/(?<= )/);
	return [
		{ type: "text-start", id },
		...words.map((delta) => ({ type: "text-delta" as const, id, delta })),
		{ type: "text-end", id },
	];
}

function lastUserText(prompt: unknown): string {
	const messages = prompt as { role: string; content: unknown }[];
	for (let i = messages.length - 1; i >= 0; i--) {
		const m = messages[i];
		if (m?.role !== "user") continue;
		const parts = Array.isArray(m.content) ? m.content : [];
		return parts
			.map((p: { type?: string; text?: string }) =>
				p.type === "text" ? (p.text ?? "") : "",
			)
			.join(" ");
	}
	return "";
}

function lastToolResult(
	prompt: unknown,
): { toolName: string; output: unknown } | null {
	const messages = prompt as { role: string; content: unknown }[];
	const last = messages[messages.length - 1];
	if (last?.role !== "tool" || !Array.isArray(last.content)) return null;
	const part = last.content.find(
		(p: { type?: string }) => p.type === "tool-result",
	) as
		| { toolName: string; output: { type: string; value: unknown } }
		| undefined;
	return part ? { toolName: part.toolName, output: part.output?.value } : null;
}

export function createDemoModel(
	getContext: () => DemoContext,
): MockLanguageModelV4 {
	let callId = 0;
	return new MockLanguageModelV4({
		doStream: async ({ prompt }) => {
			const ctx = getContext();
			const tool = lastToolResult(prompt);
			const parts: LanguageModelV4StreamPart[] = [
				{ type: "stream-start", warnings: [] },
			];

			if (tool) {
				const out = (tool.output ?? {}) as {
					added?: number;
					applied?: boolean;
					rejected?: boolean;
				};
				const reply = out.rejected
					? "Jasne, nic nie zmieniam."
					: tool.toolName === "propose_cards"
						? `Gotowe: dodałem ${out.added ?? 0} ${out.added === 1 ? "fiszkę" : "fiszki"} do notatki ${ctx.noteTitle ?? ""}.`
						: "Zmieniłem kartę.";
				parts.push(...textChunks(`t${++callId}`, reply));
				parts.push({
					type: "finish",
					finishReason: { unified: "stop", raw: "stop" },
					usage,
				});
			} else {
				const text = lastUserText(prompt).toLowerCase();
				if (text.includes("popraw") && ctx.firstCard) {
					parts.push(
						...textChunks(
							`t${++callId}`,
							"Pytanie nie mówi, o co chodzi. Proponuję dopisać kontekst i pogrubić słowo kluczowe:",
						),
					);
					parts.push({
						type: "tool-call",
						toolCallId: `call_${callId}`,
						toolName: "propose_card_edit",
						input: JSON.stringify({
							cardId: ctx.firstCard.id,
							question: "Jak brzmi **prawo Ohma**?",
							answer: "U = R · I",
						}),
					});
				} else if (!ctx.notePath) {
					parts.push(
						...textChunks(
							`t${++callId}`,
							"Otwórz notatkę, z której mam zrobić fiszki, i napisz jeszcze raz.",
						),
					);
					parts.push({
						type: "finish",
						finishReason: { unified: "stop", raw: "stop" },
						usage,
					});
					return {
						stream: simulateReadableStream({
							chunks: parts,
							initialDelayInMs: 250,
							chunkDelayInMs: 25,
						}),
					};
				} else {
					parts.push(
						...textChunks(
							`t${++callId}`,
							`Z notatki ${ctx.noteTitle} wychodzą 3 fiszki. Sprawdź je i dodaj te, które chcesz:`,
						),
					);
					parts.push({
						type: "tool-call",
						toolCallId: `call_${callId}`,
						toolName: "propose_cards",
						input: JSON.stringify({
							notePath: ctx.notePath,
							cards: [
								{ question: "Jak brzmi **prawo Ohma**?", answer: "U = R · I" },
								{
									question: "Jak obliczyć **natężenie prądu** z prawa Ohma?",
									answer: "I = U / R",
								},
								{
									question: "Jak obliczyć **opór** z prawa Ohma?",
									answer: "R = U / I",
								},
							],
						}),
					});
				}
				parts.push({
					type: "finish",
					finishReason: { unified: "tool-calls", raw: "tool_calls" },
					usage,
				});
			}
			return {
				stream: simulateReadableStream({
					chunks: parts,
					initialDelayInMs: 250,
					chunkDelayInMs: 25,
				}),
			};
		},
	});
}
