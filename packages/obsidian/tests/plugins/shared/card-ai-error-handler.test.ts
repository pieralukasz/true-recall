import { Notice } from "obsidian";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AIRequestError } from "@true-recall/core";

import {
	CardAIAbortedError,
	CardAIParseError,
	CardAIProviderError,
} from "@true-recall/plugins/shared/card-ai";
import { handleCardAIError } from "@true-recall/plugins/shared/card-ai-error-handler";

vi.mock("obsidian", () => ({
	Notice: vi.fn(),
}));

const onRawFallback = vi.fn();

function latestNoticeMessage(): string | undefined {
	const calls = (Notice as unknown as ReturnType<typeof vi.fn>).mock.calls;
	return calls.at(-1)?.[0] as string | undefined;
}

describe("handleCardAIError", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("silently returns on abort (no Notice, no fallback)", () => {
		handleCardAIError(new CardAIAbortedError(), { onRawFallback });
		expect(Notice).not.toHaveBeenCalled();
		expect(onRawFallback).not.toHaveBeenCalled();
	});

	it("routes a parse error to onRawFallback with the raw response", () => {
		handleCardAIError(new CardAIParseError("garbage"), { onRawFallback });
		expect(onRawFallback).toHaveBeenCalledWith("garbage");
		expect(Notice).not.toHaveBeenCalled();
	});

	it("shows a rate-limit Notice for provider error with 429 cause", () => {
		const cause = new AIRequestError(429, "rate limited");
		handleCardAIError(new CardAIProviderError("failed", cause), {
			onRawFallback,
		});
		expect(latestNoticeMessage()).toContain("rate limit");
		expect(onRawFallback).not.toHaveBeenCalled();
	});

	it("shows an unauthorized Notice for provider error with 401 cause", () => {
		const cause = new AIRequestError(401, "unauthorized");
		handleCardAIError(new CardAIProviderError("failed", cause), {
			onRawFallback,
		});
		expect(latestNoticeMessage()).toContain("unauthorized");
	});

	it("shows a generic Notice for provider error with other cause", () => {
		const cause = new AIRequestError(500, "boom");
		handleCardAIError(new CardAIProviderError("boom", cause), {
			onRawFallback,
		});
		expect(latestNoticeMessage()).toBe("AI failed: boom");
	});

	it("shows a generic Notice for a plain Error", () => {
		handleCardAIError(new Error("unexpected"), { onRawFallback });
		expect(latestNoticeMessage()).toBe("AI failed: unexpected");
	});

	it("shows a stringified Notice for a non-Error value", () => {
		handleCardAIError("surprise", { onRawFallback });
		expect(latestNoticeMessage()).toBe("AI failed: surprise");
	});
});
