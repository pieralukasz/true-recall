import { describe, expect, it, vi } from "vitest";

import type { CardAIPreset } from "../../../src/ai/card-ai/card-ai.types";
import { SourceNoteContextCollector } from "../../../src/ai/card-ai/card-ai-context";
import type { CardAITarget } from "../../../src/ai/card-ai/card-ai-target";

const target = (
	over: Partial<{ sourceUid?: string; currentCardId: string | null }> = {},
): CardAITarget => ({
	getFields: () => ({ Front: "q", Back: "" }),
	getNoteType: () => ({ id: "b", name: "Basic", fields: ["Front", "Back"] }),
	getSourceUid: () => ("sourceUid" in over ? over.sourceUid : "uid-1"),
	getCurrentCardId: () => over.currentCardId ?? null,
	apply: vi.fn(),
});

const preset = (o: Partial<CardAIPreset>): CardAIPreset => ({
	id: "p",
	name: "p",
	prompt: "",
	autoApply: false,
	builtin: false,
	...o,
});

describe("SourceNoteContextCollector", () => {
	it("returns undefined when neither toggle is enabled", async () => {
		const c = new SourceNoteContextCollector({
			readSourceNote: vi.fn(),
			listRelatedCards: vi.fn(),
		});
		expect(await c.collect(preset({}), target())).toBeUndefined();
	});

	it("reads source note when includeSourceNote is true", async () => {
		const read = vi.fn().mockResolvedValue({ path: "n.md", content: "body" });
		const c = new SourceNoteContextCollector({
			readSourceNote: read,
			listRelatedCards: vi.fn().mockReturnValue([]),
		});
		const ctx = await c.collect(preset({ includeSourceNote: true }), target());
		expect(read).toHaveBeenCalledWith("uid-1");
		expect(ctx?.sourceNoteContent).toBe("body");
		expect(ctx?.sourceNotePath).toBe("n.md");
	});

	it("leaves sourceNoteContent undefined when read returns null", async () => {
		const c = new SourceNoteContextCollector({
			readSourceNote: vi.fn().mockResolvedValue(null),
			listRelatedCards: vi.fn().mockReturnValue([]),
		});
		const ctx = await c.collect(preset({ includeSourceNote: true }), target());
		expect(ctx?.sourceNoteContent).toBeUndefined();
	});

	it("caps related cards at 10 and excludes current card id", async () => {
		const related = Array.from({ length: 15 }, (_, i) => ({
			id: `id-${i}`,
			fields: { Front: `Q${i}`, Back: `A${i}` },
			noteType: "Basic",
		}));
		const c = new SourceNoteContextCollector({
			readSourceNote: vi.fn(),
			listRelatedCards: vi.fn().mockReturnValue(related),
		});
		const ctx = await c.collect(
			preset({ includeRelatedCards: true }),
			target({ currentCardId: "id-3" }),
		);
		expect(ctx?.relatedCards).toHaveLength(10);
		expect(ctx?.relatedCards?.some((c) => c.fields.Front === "Q3")).toBe(false);
	});

	it("returns an empty context object when no sourceUid even with toggles on", async () => {
		const c = new SourceNoteContextCollector({
			readSourceNote: vi.fn(),
			listRelatedCards: vi.fn(),
		});
		const ctx = await c.collect(
			preset({ includeSourceNote: true, includeRelatedCards: true }),
			target({ sourceUid: undefined }),
		);
		expect(ctx).toEqual({});
	});
});
