import type { ParsedBlock } from "../../flashcard/parsing/block-parser.service";
export declare function fixSourceText(sourceText: string, inputText: string): string | undefined;
export declare function fixBlockSourceTexts(blocks: ParsedBlock[], inputText: string): void;
