import { afterEach, describe, expect, it, vi } from "vitest";

import { HttpError } from "@true-recall/core/errors";

import { reportError } from "@true-recall/obsidian/services/errors";

describe("reportError", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("reports the same error object only once across multiple boundaries", () => {
		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		const error = new Error("database path is private");

		reportError(error, { origin: "first-boundary" });
		reportError(error, { origin: "second-boundary" });

		expect(consoleError).toHaveBeenCalledOnce();
		expect(consoleError.mock.calls[0]?.[1]).toBe(error);
		expect(consoleError.mock.calls[0]?.[2]).toMatchObject({
			origin: "first-boundary",
			code: "unexpected",
			category: "unexpected",
		});
	});

	it("includes transport metadata and caller context in the structured report", () => {
		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		const error = new HttpError(503, {
			backendCode: "UPSTREAM_UNAVAILABLE",
			requestId: "request-123",
			provider: "true-recall-proxy",
		});

		reportError(error, {
			origin: "generation",
			context: { operation: "create-cards" },
		});

		expect(consoleError.mock.calls[0]?.[2]).toMatchObject({
			origin: "generation",
			operation: "create-cards",
			status: 503,
			backendCode: "UPSTREAM_UNAVAILABLE",
			requestId: "request-123",
			provider: "true-recall-proxy",
		});
	});

	it("does not log expected validation or access errors", () => {
		const logs = ["info", "warn", "error"].map((method) =>
			vi
				.spyOn(console, method as "info" | "warn" | "error")
				.mockImplementation(() => undefined),
		);

		for (const status of [400, 401, 403, 422]) {
			reportError(new HttpError(status), { origin: "generation" });
		}

		for (const log of logs) expect(log).not.toHaveBeenCalled();
	});

	it("does not report user cancellation", () => {
		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);

		reportError(new DOMException("cancelled", "AbortError"), {
			origin: "generation",
		});

		expect(consoleError).not.toHaveBeenCalled();
	});
});
