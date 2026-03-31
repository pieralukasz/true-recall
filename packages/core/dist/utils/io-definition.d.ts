/**
 * Image Occlusion definition utilities.
 * Platform-agnostic helpers for IO region parsing and serialization.
 */
import type { IODefinition, IOMaskMode, IORegion } from "../types/image-occlusion.types";
export declare function parseIODefinition(raw: string | null | undefined): IODefinition | null;
export declare function serializeIODefinition(definition: IODefinition): string;
export declare function normalizeIOImagePath(value: string): string;
export declare function getIOGroupOrds(definition: IODefinition): number[];
export declare function getRegionsForOrd(definition: IODefinition, templateOrd: number): IORegion[];
export declare function getNextIOGroupKey(definition: IODefinition): string;
export declare function createEmptyIODefinition(maskMode?: IOMaskMode): IODefinition;
