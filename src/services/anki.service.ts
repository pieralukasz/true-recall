/**
 * AnkiConnect Service
 * Handles communication with Anki via AnkiConnect plugin
 */
import { requestUrl } from "obsidian";
import { z } from "zod";
import { ANKI_CONFIG } from "../constants";
import { APIError, NetworkError, TimeoutError } from "../errors";

// ===== Zod Schemas for AnkiConnect =====

const AnkiConnectResponseSchema = z.object({
    result: z.unknown(),
    error: z.string().nullable(),
});

type AnkiConnectResponse = z.infer<typeof AnkiConnectResponseSchema>;

// ===== Note Info Type =====

export interface AnkiNoteInfo {
    noteId: number;
    modelName: string;
    tags: string[];
    fields: Record<string, { value: string; order: number }>;
}

const AnkiNoteInfoSchema = z.object({
    noteId: z.number(),
    modelName: z.string(),
    tags: z.array(z.string()),
    fields: z.record(z.string(), z.object({
        value: z.string(),
        order: z.number(),
    })),
});

/**
 * Service for interacting with Anki via AnkiConnect
 */
export class AnkiService {
    private readonly endpoint: string;
    private readonly version: number;
    private readonly timeout: number;

    constructor() {
        this.endpoint = ANKI_CONFIG.endpoint;
        this.version = ANKI_CONFIG.version;
        this.timeout = ANKI_CONFIG.timeout;
    }

    /**
     * Check if Anki is running and AnkiConnect is available
     */
    async isAvailable(): Promise<boolean> {
        try {
            const response = await this.request("version");
            return response.error === null;
        } catch {
            return false;
        }
    }

    /**
     * Get AnkiConnect version
     */
    async getVersion(): Promise<number | null> {
        try {
            const response = await this.request("version");
            if (response.error === null && typeof response.result === "number") {
                return response.result;
            }
            return null;
        } catch {
            return null;
        }
    }

    /**
     * Delete notes from Anki by their IDs
     */
    async deleteNotes(noteIds: number[]): Promise<boolean> {
        if (noteIds.length === 0) {
            return true;
        }

        try {
            const response = await this.request("deleteNotes", { notes: noteIds });
            return response.error === null;
        } catch (error) {
            // Log but don't throw - deletion failure shouldn't break the flow
            console.error("Failed to delete notes from Anki:", this.getErrorMessage(error));
            return false;
        }
    }

    /**
     * Find notes by query
     */
    async findNotes(query: string): Promise<number[]> {
        try {
            const response = await this.request("findNotes", { query });
            if (response.error === null && Array.isArray(response.result)) {
                return response.result.filter((id): id is number => typeof id === "number");
            }
            return [];
        } catch {
            return [];
        }
    }

    /**
     * Get detailed information about notes
     */
    async notesInfo(noteIds: number[]): Promise<AnkiNoteInfo[]> {
        if (noteIds.length === 0) {
            return [];
        }

        try {
            const response = await this.request("notesInfo", { notes: noteIds });
            if (response.error === null && Array.isArray(response.result)) {
                // Validate each note info with Zod
                return response.result
                    .map((note) => {
                        const parsed = AnkiNoteInfoSchema.safeParse(note);
                        return parsed.success ? parsed.data : null;
                    })
                    .filter((note): note is AnkiNoteInfo => note !== null);
            }
            return [];
        } catch {
            return [];
        }
    }

    /**
     * Trigger Anki sync
     */
    async sync(): Promise<boolean> {
        try {
            const response = await this.request("sync");
            return response.error === null;
        } catch {
            return false;
        }
    }

    /**
     * Get deck names
     */
    async getDeckNames(): Promise<string[]> {
        try {
            const response = await this.request("deckNames");
            if (response.error === null && Array.isArray(response.result)) {
                return response.result.filter((name): name is string => typeof name === "string");
            }
            return [];
        } catch {
            return [];
        }
    }

    /**
     * Make a request to AnkiConnect with timeout
     */
    private async request(
        action: string,
        params?: Record<string, unknown>
    ): Promise<AnkiConnectResponse> {
        const body = {
            action,
            version: this.version,
            params,
        };

        try {
            // Create abort controller for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);

            try {
                const response = await requestUrl({
                    url: this.endpoint,
                    method: "POST",
                    body: JSON.stringify(body),
                    headers: {
                        "Content-Type": "application/json",
                    },
                });

                clearTimeout(timeoutId);

                // Validate response structure
                const parsed = AnkiConnectResponseSchema.safeParse(response.json);
                if (!parsed.success) {
                    throw new APIError("Invalid response from AnkiConnect", undefined, "AnkiConnect");
                }

                return parsed.data;
            } catch (error) {
                clearTimeout(timeoutId);

                if (error instanceof Error && error.name === "AbortError") {
                    throw new TimeoutError("AnkiConnect request timed out", this.timeout);
                }
                throw error;
            }
        } catch (error) {
            // Handle connection errors
            if (error instanceof Error) {
                if (
                    error.message.includes("net::") ||
                    error.message.includes("ECONNREFUSED") ||
                    error.message.includes("fetch")
                ) {
                    throw new NetworkError(
                        "Cannot connect to Anki. Make sure Anki is running with AnkiConnect plugin."
                    );
                }
            }

            // Re-throw custom errors
            if (error instanceof APIError || error instanceof TimeoutError || error instanceof NetworkError) {
                throw error;
            }

            throw new APIError(
                `AnkiConnect error: ${this.getErrorMessage(error)}`,
                undefined,
                "AnkiConnect"
            );
        }
    }

    /**
     * Extract error message from unknown error
     */
    private getErrorMessage(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        }
        return String(error);
    }
}
