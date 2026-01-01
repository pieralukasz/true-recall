/**
 * API-related error classes
 */
import { AppError } from "./base.error";

/**
 * Error thrown when an API request fails
 */
export class APIError extends AppError {
    constructor(
        message: string,
        public readonly statusCode?: number,
        public readonly provider: string = "Unknown"
    ) {
        super(message, "API_ERROR", true);
    }

    toUserMessage(): string {
        if (this.statusCode === 401) {
            return `Authentication failed with ${this.provider}. Please check your API key.`;
        }
        if (this.statusCode === 429) {
            return `Rate limit exceeded for ${this.provider}. Please try again later.`;
        }
        if (this.statusCode && this.statusCode >= 500) {
            return `${this.provider} service is temporarily unavailable. Please try again later.`;
        }
        return `${this.provider} API error: ${this.message}`;
    }
}

/**
 * Error thrown when a network request fails
 */
export class NetworkError extends AppError {
    constructor(message: string = "Network request failed") {
        super(message, "NETWORK_ERROR", true);
    }

    toUserMessage(): string {
        return "Unable to connect. Please check your internet connection.";
    }
}

/**
 * Error thrown when a request times out
 */
export class TimeoutError extends AppError {
    constructor(
        message: string = "Request timed out",
        public readonly timeoutMs?: number
    ) {
        super(message, "TIMEOUT_ERROR", true);
    }

    toUserMessage(): string {
        return "The request took too long. Please try again.";
    }
}

/**
 * Error thrown when the API response format is invalid
 */
export class InvalidResponseError extends AppError {
    constructor(message: string = "Invalid response from API") {
        super(message, "INVALID_RESPONSE_ERROR", true);
    }

    toUserMessage(): string {
        return "Received an unexpected response. Please try again.";
    }
}
