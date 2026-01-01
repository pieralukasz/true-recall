import { describe, it, expect } from "vitest";
import {
    validateOpenRouterResponse,
    safeValidateOpenRouterResponse,
    extractContent,
    validateAndExtractContent,
} from "../../src/validation/api-response.validator";
import { ValidationError, APIError } from "../../src/errors";

describe("API Response Validator", () => {
    describe("validateOpenRouterResponse", () => {
        it("should validate a valid response", () => {
            const validResponse = {
                id: "test-id",
                choices: [
                    {
                        message: {
                            content: "Test content",
                            role: "assistant",
                        },
                        finish_reason: "stop",
                    },
                ],
            };

            const result = validateOpenRouterResponse(validResponse);

            expect(result.choices[0].message.content).toBe("Test content");
        });

        it("should validate response without optional fields", () => {
            const minimalResponse = {
                choices: [
                    {
                        message: {
                            content: "Minimal content",
                        },
                    },
                ],
            };

            const result = validateOpenRouterResponse(minimalResponse);

            expect(result.choices[0].message.content).toBe("Minimal content");
        });

        it("should throw ValidationError for missing choices", () => {
            const invalidResponse = {
                id: "test-id",
            };

            expect(() => validateOpenRouterResponse(invalidResponse)).toThrow(
                ValidationError
            );
        });

        it("should throw ValidationError for empty choices array", () => {
            const invalidResponse = {
                choices: [],
            };

            expect(() => validateOpenRouterResponse(invalidResponse)).toThrow(
                ValidationError
            );
        });

        it("should throw ValidationError for missing message content", () => {
            const invalidResponse = {
                choices: [
                    {
                        message: {},
                    },
                ],
            };

            expect(() => validateOpenRouterResponse(invalidResponse)).toThrow(
                ValidationError
            );
        });

        it("should throw APIError when response contains error", () => {
            const errorResponse = {
                choices: [
                    {
                        message: {
                            content: "test",
                        },
                    },
                ],
                error: {
                    message: "Rate limit exceeded",
                    code: "rate_limit",
                },
            };

            expect(() => validateOpenRouterResponse(errorResponse)).toThrow(
                APIError
            );
        });

        it("should throw ValidationError for null input", () => {
            expect(() => validateOpenRouterResponse(null)).toThrow(
                ValidationError
            );
        });

        it("should throw ValidationError for non-object input", () => {
            expect(() => validateOpenRouterResponse("string")).toThrow(
                ValidationError
            );
        });
    });

    describe("safeValidateOpenRouterResponse", () => {
        it("should return success for valid response", () => {
            const validResponse = {
                choices: [
                    {
                        message: {
                            content: "Test content",
                        },
                    },
                ],
            };

            const result = safeValidateOpenRouterResponse(validResponse);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.choices[0].message.content).toBe("Test content");
            }
        });

        it("should return failure for invalid response", () => {
            const invalidResponse = { choices: [] };

            const result = safeValidateOpenRouterResponse(invalidResponse);

            expect(result.success).toBe(false);
        });
    });

    describe("extractContent", () => {
        it("should extract content from valid response", () => {
            const response = {
                choices: [
                    {
                        message: {
                            content: "Extracted content",
                        },
                    },
                ],
            };

            const content = extractContent(response);

            expect(content).toBe("Extracted content");
        });
    });

    describe("validateAndExtractContent", () => {
        it("should validate and extract content in one call", () => {
            const validResponse = {
                choices: [
                    {
                        message: {
                            content: "Combined test",
                        },
                    },
                ],
            };

            const content = validateAndExtractContent(validResponse);

            expect(content).toBe("Combined test");
        });

        it("should throw for invalid response", () => {
            expect(() => validateAndExtractContent({})).toThrow(ValidationError);
        });
    });
});
