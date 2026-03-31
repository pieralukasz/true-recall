export interface MarkdownChunk {
    content: string;
    headingBreadcrumb: string;
    index: number;
    wordCount: number;
}
export interface ChunkingResult {
    chunks: MarkdownChunk[];
    strategy: "single" | "chunked";
    totalWords: number;
    estimatedTokens: number;
}
export declare function filterContent(raw: string): string;
export declare function chunkMarkdown(rawContent: string): ChunkingResult;
