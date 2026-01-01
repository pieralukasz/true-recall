/**
 * Validators for OpenRouter API responses
 */
import {
    OpenRouterResponseSchema,
    type OpenRouterResponse,
} from "./schemas/api.schema";
import { APIError, ValidationError } from "../errors";

/**
 * Result of validation - either success with data or failure with error
 */
export type ValidationResult<T> =
    | { success: true; data: T }
    | { success: false; error: ValidationError };

/**
 * Validates an OpenRouter API response
 *
 * @param data - Raw response data from the API
 * @returns Validated OpenRouterResponse
 * @throws ValidationError if the response is invalid
 * @throws APIError if the response contains an API error
 */
export function validateOpenRouterResponse(data: unknown): OpenRouterResponse {
    const result = OpenRouterResponseSchema.safeParse(data);

    if (!result.success) {
        // Zod v4 uses 'issues' with PropertyKey[] paths
        const zodErrors = result.error.issues ?? [];
        const errors = zodErrors.map((e) =>
            `${e.path.map(String).join(".")}: ${e.message}`
        );
        throw new ValidationError(
            `Invalid API response: ${errors.join(", ")}`,
            "apiResponse",
            errors
        );
    }

    // Check for API-level errors in the response
    if (result.data.error) {
        throw new APIError(
            result.data.error.message,
            undefined,
            "OpenRouter"
        );
    }

    return result.data;
}

/**
 * Safely validates an OpenRouter API response without throwing
 *
 * @param data - Raw response data from the API
 * @returns ValidationResult with either the parsed data or an error
 */
export function safeValidateOpenRouterResponse(
    data: unknown
): ValidationResult<OpenRouterResponse> {
    try {
        const validated = validateOpenRouterResponse(data);
        return { success: true, data: validated };
    } catch (error) {
        if (error instanceof ValidationError) {
            return { success: false, error };
        }
        return {
            success: false,
            error: new ValidationError(
                error instanceof Error ? error.message : String(error)
            ),
        };
    }
}

/**
 * Extracts the content from a validated OpenRouter response
 *
 * @param response - Validated OpenRouter response
 * @returns The content string from the first choice
 */
export function extractContent(response: OpenRouterResponse): string {
    const content = response.choices[0]?.message?.content;
    if (!content) {
        throw new ValidationError("No content in response");
    }
    return content;
}

/**
 * Validates and extracts content from raw API response data
 *
 * @param data - Raw response data from the API
 * @returns The content string from the response
 * @throws ValidationError if the response is invalid
 */
export function validateAndExtractContent(data: unknown): string {
    const response = validateOpenRouterResponse(data);
    return extractContent(response);
}
