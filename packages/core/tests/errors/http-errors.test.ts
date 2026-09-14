import { describe, expect, it } from "vitest";

import {
	AppError,
	describeErrorForUser,
	fromHttpResponse,
	isTransient,
	toAppError,
} from "../../src/errors";

describe("HTTP error normalization", () => {
	it("preserves machine-readable proxy metadata without exposing it as UI copy", () => {
		const error = fromHttpResponse(
			422,
			{
				error: {
					code: "INVALID_PAYLOAD",
					message: "Internal validation detail",
					correlation_id: "request-123",
					retryable: false,
					fields: { email: ["Invalid email"] },
				},
			},
			{ provider: "true-recall-proxy", method: "POST", route: "/sync" },
		);

		expect(error.code).toBe("INVALID_PAYLOAD");
		expect(error.requestId).toBe("request-123");
		expect(error.validation).toEqual({ email: ["Invalid email"] });
		expect(error.context).toEqual({
			provider: "true-recall-proxy",
			method: "POST",
			route: "/sync",
		});
		expect(isTransient(error)).toBe(false);
		expect(describeErrorForUser(error)).toBe(
			"Check the provided information and try again.",
		);
	});

	it("supports the legacy plain error shape during migration", () => {
		const error = fromHttpResponse(503, { error: "Upstream failed" });

		expect(error.detail).toBe("Upstream failed");
		expect(error.category).toBe("server-error");
		expect(isTransient(error)).toBe(true);
	});

	it("wraps unknown failures once and retains the original cause", () => {
		const cause = new Error("database path should stay technical");
		const error = toAppError(cause);

		expect(error).toBeInstanceOf(AppError);
		expect(error.cause).toBe(cause);
		expect(describeErrorForUser(error)).not.toContain("database path");
	});

	it("preserves a typed HTTP error wrapped by a provider service", () => {
		const cause = fromHttpResponse(429, {
			error: { code: "budget_exceeded", message: "internal budget detail" },
		});
		const wrapped = new Error("Provider request failed", { cause });

		expect(toAppError(wrapped)).toBe(cause);
		expect(describeErrorForUser(wrapped)).toBe(
			"The provider rate limit or usage limit was reached. Try again later.",
		);
		expect(isTransient(wrapped)).toBe(true);
	});

	it("does not loop on a self-referencing error cause", () => {
		const cause = new Error("cyclic failure");
		Object.defineProperty(cause, "cause", { value: cause });

		const error = toAppError(cause);

		expect(error).toBeInstanceOf(AppError);
		expect(error.cause).toBe(cause);
	});
});
