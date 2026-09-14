import { requestUrl } from "obsidian";
import { beforeEach, describe, expect, it, type vi } from "vitest";

import { describeErrorForUser, HttpError } from "@true-recall/core/errors";

import { ObsidianHttpClient } from "@true-recall/obsidian/adapters/ObsidianHttpClient";

const requestUrlMock = requestUrl as unknown as ReturnType<typeof vi.fn>;

describe("True Recall Proxy → Obsidian error flow", () => {
	beforeEach(() => {
		requestUrlMock.mockReset();
	});

	it("preserves machine metadata while hiding the proxy detail from UI copy", async () => {
		requestUrlMock.mockResolvedValue({
			status: 503,
			json: {
				error: {
					code: "UPSTREAM_UNAVAILABLE",
					message: "litellm upstream connection refused at 10.0.0.12",
					correlation_id: "proxy-request-123",
					retryable: true,
				},
			},
			text: "",
		});

		const promise = new ObsidianHttpClient().post(
			"https://ai.truerecall.app/v1/chat/completions",
			{},
		);
		const error = await promise.catch((reason: unknown) => reason);

		expect(error).toBeInstanceOf(HttpError);
		expect(error).toMatchObject({
			statusCode: 503,
			backendCode: "UPSTREAM_UNAVAILABLE",
			requestId: "proxy-request-123",
			retryable: true,
		});
		expect(describeErrorForUser(error)).toBe(
			"The service is temporarily unavailable. Please try again.",
		);
		expect(describeErrorForUser(error)).not.toContain("10.0.0.12");
	});

	it("preserves field issues from a validation response", async () => {
		requestUrlMock.mockResolvedValue({
			status: 422,
			json: {
				error: {
					code: "VALIDATION_FAILED",
					message: "The internal model identifier was rejected",
					correlation_id: "proxy-validation-123",
					retryable: false,
					fields: { model: ["temporarily unavailable"] },
				},
			},
			text: "",
		});

		const error = await new ObsidianHttpClient()
			.post("https://ai.truerecall.app/v1/chat/completions", {})
			.catch((reason: unknown) => reason);

		expect(error).toMatchObject({
			statusCode: 422,
			backendCode: "VALIDATION_FAILED",
			requestId: "proxy-validation-123",
			retryable: false,
			validation: { model: ["temporarily unavailable"] },
		});
		expect(describeErrorForUser(error)).toBe(
			"Check the provided information and try again.",
		);
		expect(describeErrorForUser(error)).not.toContain("internal model");
	});
});
