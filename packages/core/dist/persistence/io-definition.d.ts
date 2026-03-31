/**
 * Image Occlusion definition parser/serializer.
 * Extracted from @features/image-occlusion for use by packages/core.
 */
export type IOShape = "rect" | "ellipse";
export type IOMaskMode = "solo" | "all";
/** Normalized coordinates (0-1 range) for resolution independence */
export interface IORegion {
    id: string;
    /** Left edge, normalized 0-1 */
    x: number;
    /** Top edge, normalized 0-1 */
    y: number;
    /** Width, normalized 0-1 */
    w: number;
    /** Height, normalized 0-1 */
    h: number;
    groupKey: string;
    shape: IOShape;
    label?: string;
}
export interface IODefinition {
    regions: IORegion[];
    maskMode: IOMaskMode;
    version: 1;
}
/**
 * Parse Regions payload from note field.
 * Supports both:
 * - v1 IODefinition object ({ regions, maskMode, version })
 * - legacy region array (converted to v1, maskMode="solo")
 */
export declare function parseIODefinition(raw: string | null | undefined): IODefinition | null;
/**
 * Editor stores plain vault-relative paths.
 * For backwards compatibility we also accept wiki image syntax.
 */
export declare function normalizeIOImagePath(value: string): string;
