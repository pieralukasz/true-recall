import {
    OpenRouterResponseSchema,
    type OpenRouterResponse,
} from "./schemas/api.schema";
import { APIError, ValidationError } from "../errors";

export type ValidationResult<T> =
    | { success: true; data: T }
    | { success: false; error: ValidationError };

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

export function extractContent(response: OpenRouterResponse): string {
    const content = response.choices[0]?.message?.content;
    if (!content) {
        throw new ValidationError("No content in response");
    }
    return content;
}

export function validateAndExtractContent(data: unknown): string {
    const response = validateOpenRouterResponse(data);
    return extractContent(response);
}
