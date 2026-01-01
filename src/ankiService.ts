import { requestUrl } from "obsidian";

const ANKI_CONNECT_URL = "http://127.0.0.1:8765";

interface AnkiConnectRequest {
    action: string;
    version: number;
    params?: Record<string, unknown>;
}

interface AnkiConnectResponse {
    result: unknown;
    error: string | null;
}

export class AnkiService {
    // Make a request to AnkiConnect
    private async request(action: string, params?: Record<string, unknown>): Promise<AnkiConnectResponse> {
        const body: AnkiConnectRequest = {
            action,
            version: 6,
            params
        };

        const response = await requestUrl({
            url: ANKI_CONNECT_URL,
            method: "POST",
            body: JSON.stringify(body),
            headers: {
                "Content-Type": "application/json"
            }
        });

        return response.json as AnkiConnectResponse;
    }

    // Check if Anki is running and AnkiConnect is available
    async isAvailable(): Promise<boolean> {
        try {
            const response = await this.request("version");
            return response.error === null;
        } catch {
            return false;
        }
    }

    // Delete notes from Anki by their IDs
    async deleteNotes(noteIds: number[]): Promise<boolean> {
        try {
            const response = await this.request("deleteNotes", { notes: noteIds });
            return response.error === null;
        } catch (error) {
            console.error("Failed to delete notes from Anki:", error);
            return false;
        }
    }

    // Find notes by query
    async findNotes(query: string): Promise<number[]> {
        try {
            const response = await this.request("findNotes", { query });
            if (response.error === null && Array.isArray(response.result)) {
                return response.result as number[];
            }
            return [];
        } catch {
            return [];
        }
    }

    // Get notes info
    async notesInfo(noteIds: number[]): Promise<unknown[]> {
        try {
            const response = await this.request("notesInfo", { notes: noteIds });
            if (response.error === null && Array.isArray(response.result)) {
                return response.result;
            }
            return [];
        } catch {
            return [];
        }
    }

    // Sync (trigger sync if AnkiConnect supports it)
    async sync(): Promise<boolean> {
        try {
            const response = await this.request("sync");
            return response.error === null;
        } catch {
            return false;
        }
    }
}
