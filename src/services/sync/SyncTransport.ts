/**
 * Sync Transport
 * Handles HTTP communication with sync server using Obsidian's requestUrl
 */
import { requestUrl, type RequestUrlParam } from "obsidian";
import { SYNC_CONFIG } from "../../constants";
import type { CrsqlChange } from "../persistence/crsqlite";
import type {
    CrsqlChangeWire,
    SyncError,
    SyncErrorType,
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
     * Uses GET /changes?since=X&siteId=Y to fetch changes from other devices
     */
    async pullChanges(siteId: string, sinceVersion: number): Promise<SyncPullResponse> {
        const url = `${this.serverUrl}/changes?since=${sinceVersion}&siteId=${siteId}`;

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

        // Map server response format to client format
        const serverResponse = response.json as {
            changes: CrsqlChangeWire[];
            serverDbVersion: number;
            serverSiteId: string;
        };

        return {
            changes: serverResponse.changes,
            serverVersion: serverResponse.serverDbVersion,
            hasMore: false, // Server doesn't support pagination yet
        };
    }

    /**
     * Push changes to server
     * Uses POST /changes with { changes, clientSiteId } format
     */
    async pushChanges(
        siteId: string,
        changes: CrsqlChange[],
        _clientVersion: number
    ): Promise<SyncPushResponse> {
        const requestBody = {
            changes: changes.map((c) => this.serializeChange(c)),
            clientSiteId: siteId,
        };

        const options: RequestUrlParam = {
            url: `${this.serverUrl}/changes`,
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

        // Map server response format to client format
        const serverResponse = response.json as {
            applied: number;
            serverDbVersion: number;
            serverSiteId: string;
        };

        return {
            serverVersion: serverResponse.serverDbVersion,
            accepted: serverResponse.applied,
            rejected: 0,
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
     * Serialize CrsqlChange to wire format (Hex for binary fields)
     */
    serializeChange(change: CrsqlChange): CrsqlChangeWire {
        return {
            table: change.table,
            pk: this.uint8ArrayToHex(change.pk),
            cid: change.cid,
            val: change.val,
            colVersion: change.colVersion,
            dbVersion: change.dbVersion,
            siteId: this.uint8ArrayToHex(change.siteId),
            cl: change.cl,
            seq: change.seq,
        };
    }

    /**
     * Deserialize wire format to CrsqlChange
     */
    deserializeChange(wire: CrsqlChangeWire): CrsqlChange {
        return {
            table: wire.table,
            pk: this.hexToUint8Array(wire.pk),
            cid: wire.cid,
            val: wire.val,
            colVersion: wire.colVersion,
            dbVersion: wire.dbVersion,
            siteId: this.hexToUint8Array(wire.siteId),
            cl: wire.cl,
            seq: wire.seq,
        };
    }

    /**
     * Convert Uint8Array to hex string
     */
    private uint8ArrayToHex(bytes: Uint8Array): string {
        return Array.from(bytes)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
    }

    /**
     * Convert hex string to Uint8Array
     */
    private hexToUint8Array(hex: string): Uint8Array {
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
        }
        return bytes;
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
