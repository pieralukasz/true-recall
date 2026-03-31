import type { ApkgData } from "@true-recall/core/types";
export declare function readProtobufVarint(blob: Uint8Array, offset: number): {
    value: number;
    next: number;
} | null;
export declare function readProtobufString(blob: Uint8Array, fieldNumber: number): string;
export declare function parseMediaProtobuf(data: Uint8Array): Record<string, string>;
export declare class ApkgParserService {
    parseApkg(fileData: ArrayBuffer): Promise<ApkgData>;
    private findDatabaseFile;
    private isSchemaV18;
    private readNotes;
    private readCards;
    private readRevlog;
    private readCollectionLegacy;
    private readCollectionV18;
    private detectNotetypeKind;
    private parseModelsJson;
    private parseDecksJson;
    private readMedia;
    private isZstdCompressed;
    private parseMediaProtobuf;
    private patchWalMode;
    private mapRows;
}
