import type { ParsedBlock } from "../../flashcard/parsing/block-parser.service";
import type { IHttpClient } from "../../interfaces/http-client";
import type { NoteType } from "../../types/note.types";
import type { TrueRecallSettings } from "../../types/settings.types";
export interface GenerationResult {
    blocks: ParsedBlock[];
}
export declare class FlashcardGenerationService {
    private getSettings;
    private getNoteType;
    private httpClient;
    constructor(getSettings: () => TrueRecallSettings, getNoteType: (slug: string) => NoteType | null, httpClient: IHttpClient);
    generate(selectedText: string, noteType?: NoteType | null): Promise<GenerationResult>;
    private parseResponse;
}
