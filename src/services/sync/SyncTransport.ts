/**
 * Sync Transport
 * Handles HTTP communication with sync server using Obsidian's requestUrl
 * Uses Server-Side Merge protocol: operations in, rows out
 */
import { requestUrl, type RequestUrlParam } from "obsidian";
import { SYNC_CONFIG } from "../../constants";
import type {
    SyncError,
    SyncErrorType,
    SyncOperation,
    SyncPullResponse,
    SyncPushResponse,
    SyncSettings,
} from "./sync.types";

/**
 * Handles HTTP transport for sync operations
 */
export class SyncTransport {
    private serverUrl: string;
    private apiKey: string;

    constructor(settings: SyncSettings) {
        this.serverUrl = settings.syncServerUrl.replace(/\/$/, ""); // Remove trailing slash
        this.apiKey = settings.syncApiKey;
    }

    /**
     * Update settings (when user changes them)
     */
    updateSettings(settings: SyncSettings): void {
        this.serverUrl = settings.syncServerUrl.replace(/\/$/, "");
        this.apiKey = settings.syncApiKey;
    }

    /**
     * Check if server is reachable
     */
    async healthCheck(): Promise<boolean> {
        try {
            const response = await requestUrl({
                url: `${this.serverUrl}/health`,
                method: "GET",
                throw: false,
            });
            return response.status === 200;
        } catch {
            return false;
        }
    }

    /**
     * Pull changes from server
     * Returns full rows modified since `sinceVersion`
     */
    async pullChanges(clientId: string, sinceVersion: number): Promise<SyncPullResponse> {
        const url = `${this.serverUrl}/sync?since=${sinceVersion}&clientId=${encodeURIComponent(clientId)}`;

        const options: RequestUrlParam = {
            url,
            method: "GET",
            headers: {
                Authorization: `Bearer ${this.apiKey}`,
            },
            throw: false,
        };

        const response = await requestUrl(options);
        this.checkResponseError(response.status, response.text);

        const serverResponse = response.json as SyncPullResponse;

        return {
            rows: serverResponse.rows || {},
            deletedIds: serverResponse.deletedIds || {},
            serverVersion: serverResponse.serverVersion,
        };
    }

    /**
     * Push changes to server
     * Sends operations (INSERT/UPDATE/DELETE) to be applied
     */
    async pushChanges(clientId: string, operations: SyncOperation[]): Promise<SyncPushResponse> {
        const requestBody = {
            clientId,
            operations,
        };

        const options: RequestUrlParam = {
            url: `${this.serverUrl}/sync`,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify(requestBody),
            throw: false,
        };

        const response = await requestUrl(options);
        this.checkResponseError(response.status, response.text);

        const serverResponse = response.json as SyncPushResponse;

        return {
            applied: serverResponse.applied,
            errors: serverResponse.errors,
            serverVersion: serverResponse.serverVersion,
        };
    }

    /**
     * Check response for errors and throw SyncError if needed
     */
    private checkResponseError(status: number, body: string): void {
        if (status >= 200 && status < 300) {
            return; // Success
        }

        const error = this.parseError(status, body);
        throw error;
    }

    /**
     * Parse HTTP error into SyncError
     */
    private parseError(status: number, body: string): SyncError {
        let type: SyncErrorType = "unknown";
        let retryable = false;
        let message = body || `HTTP ${status}`;

        // Try to parse JSON error message
        try {
            const json = JSON.parse(body);
            if (json.message) {
                message = json.message;
            }
            if (json.error) {
                message = json.error;
            }
        } catch {
            // Body is not JSON, use raw text
        }

        switch (status) {
            case 401:
            case 403:
                type = "auth";
                message = "Invalid API key or unauthorized access";
                retryable = false;
                break;
            case 408:
            case 504:
                type = "timeout";
                message = "Request timed out";
                retryable = true;
                break;
            case 409:
                type = "conflict";
                message = "Sync conflict detected (will be auto-resolved)";
                retryable = true;
                break;
            case 500:
            case 502:
            case 503:
                type = "server";
                retryable = true;
                break;
            default:
                if (status === 0) {
                    type = "network";
                    message = "Network error - check your connection";
                    retryable = true;
                }
                break;
        }

        return {
            type,
            message,
            statusCode: status,
            retryable,
        };
    }

    /**
     * Calculate delay for exponential backoff with jitter
     */
    static calculateRetryDelay(attempt: number): number {
        const { baseDelayMs, maxDelayMs, backoffMultiplier, jitterFactor } = SYNC_CONFIG;

        // Exponential backoff: baseDelay * multiplier^attempt
        const exponentialDelay = baseDelayMs * Math.pow(backoffMultiplier, attempt);

        // Cap at maxDelay
        const cappedDelay = Math.min(exponentialDelay, maxDelayMs);

        // Add jitter: randomize between (1 - jitter) and (1 + jitter)
        const jitter = 1 + (Math.random() * 2 - 1) * jitterFactor;

        return Math.floor(cappedDelay * jitter);
    }

    /**
     * Check if an error is retryable
     */
    static isRetryable(error: unknown): boolean {
        if (error && typeof error === "object" && "retryable" in error) {
            return (error as SyncError).retryable;
        }
        // Network errors are typically retryable
        return true;
    }
}
