import { describe, expect, it, vi } from "vitest";

import type { CardAIService } from "../../../src/ai/card-ai/card-ai.service";
import {
	CardAIAbortedError,
	CardAIParseError,
	type CardAIPreset,
	CardAIProviderError,
} from "../../../src/ai/card-ai/card-ai.types";
import type { CardAIContextCollector } from "../../../src/ai/card-ai/card-ai-context";
import type { CardAIPresenter } from "../../../src/ai/card-ai/card-ai-presenter";
import { CardAIRunner } from "../../../src/ai/card-ai/card-ai-runner";
import type { CardAITarget } from "../../../src/ai/card-ai/card-ai-target";

const preset: CardAIPreset = {
	id: "p",
	name: "p",
	prompt: "Polish",
	autoApply: false,
	builtin: false,
};

const target = (): CardAITarget => ({
	getFields: () => ({ Front: "q", Back: "" }),
	getNoteType: () => ({ id: "b", name: "Basic", fields: ["Front", "Back"] }),
	getSourceUid: () => "uid-1",
	getCurrentCardId: () => null,
	getOperation: () => "edit",
	apply: vi.fn(),
});

const service = (fields: Record<string, string>): CardAIService =>
	({
		transform: vi.fn().mockResolvedValue({
			fields,
			rawResponse: JSON.stringify(fields),
			usage: { promptTokens: 1, completionTokens: 1 },
		}),
	}) as unknown as CardAIService;

const collector = (): CardAIContextCollector => ({
	collect: vi.fn().mockResolvedValue(undefined),
});

describe("CardAIRunner", () => {
	it("calls service with target fields + preset prompt", async () => {
		const svc = service({ Front: "Q", Back: "A" });
		const p: CardAIPresenter = {
			present: vi.fn().mockResolvedValue(undefined),
		};
		await new CardAIRunner(target(), svc, collector(), p).run(preset);
		expect(svc.transform).toHaveBeenCalledWith(
			expect.objectContaining({
				fields: { Front: "q", Back: "" },
				prompt: "Polish",
				operation: "edit",
			}),
		);
	});

	it("passes original/proposed/autoApply/target to the presenter", async () => {
		const t = target();
		const svc = service({ Front: "Q", Back: "A" });
		const p: CardAIPresenter = {
			present: vi.fn().mockResolvedValue(undefined),
		};
		await new CardAIRunner(t, svc, collector(), p).run({
			...preset,
			autoApply: true,
		});
		expect(p.present).toHaveBeenCalledWith(
			expect.objectContaining({
				target: t,
				original: { Front: "q", Back: "" },
				proposed: { Front: "Q", Back: "A" },
				autoApply: true,
			}),
		);
	});

	it("presents raw fallback when parsing fails", async () => {
		const svc = {
			transform: vi
				.fn()
				.mockRejectedValue(new CardAIParseError("garbage", "bad")),
		} as unknown as CardAIService;
		const p: CardAIPresenter = {
			present: vi.fn().mockResolvedValue(undefined),
		};
		await new CardAIRunner(target(), svc, collector(), p).run(preset);
		expect(p.present).toHaveBeenCalledWith(
			expect.objectContaining({
				proposed: null,
				rawResponse: "garbage",
			}),
		);
	});

	it("retry closure re-invokes service with augmented prompt", async () => {
		const svc = service({ Front: "Q", Back: "A" });
		let captured: ((extra: string) => Promise<Record<string, string>>) | null =
			null;
		const p: CardAIPresenter = {
			present: vi.fn().mockImplementation(async (args) => {
				captured = args.retry;
			}),
		};
		await new CardAIRunner(target(), svc, collector(), p).run(preset);
		await captured?.("be terser");
		const transform = svc.transform as ReturnType<typeof vi.fn>;
		expect(transform.mock.calls[1][0].prompt).toContain("Polish");
		expect(transform.mock.calls[1][0].prompt).toContain(
			"Additional instruction: be terser",
		);
	});

	it("propagates CardAIProviderError to the caller (not to the presenter)", async () => {
		const err = new CardAIProviderError("boom", null);
		const svc = {
			transform: vi.fn().mockRejectedValue(err),
		} as unknown as CardAIService;
		const p: CardAIPresenter = {
			present: vi.fn().mockResolvedValue(undefined),
		};
		await expect(
			new CardAIRunner(target(), svc, collector(), p).run(preset),
		).rejects.toBe(err);
		expect(p.present).not.toHaveBeenCalled();
	});

	it("propagates CardAIAbortedError to the caller (not to the presenter)", async () => {
		const err = new CardAIAbortedError();
		const svc = {
			transform: vi.fn().mockRejectedValue(err),
		} as unknown as CardAIService;
		const p: CardAIPresenter = {
			present: vi.fn().mockResolvedValue(undefined),
		};
		await expect(
			new CardAIRunner(target(), svc, collector(), p).run(preset),
		).rejects.toBe(err);
		expect(p.present).not.toHaveBeenCalled();
	});

	it("collects context exactly once across initial call plus retries", async () => {
		const svc = service({ Front: "Q", Back: "A" });
		const col = collector();
		let captured: ((extra: string) => Promise<Record<string, string>>) | null =
			null;
		const p: CardAIPresenter = {
			present: vi.fn().mockImplementation(async (args) => {
				captured = args.retry;
			}),
		};
		await new CardAIRunner(target(), svc, col, p).run(preset);
		await captured?.("more");
		expect(col.collect).toHaveBeenCalledTimes(1);
	});
});
