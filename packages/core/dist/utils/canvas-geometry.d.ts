export interface RectLike {
    left: number;
    top: number;
    width: number;
    height: number;
}
export declare function clamp(value: number, min: number, max: number): number;
export declare function normalizePointFromRect(clientX: number, clientY: number, rect: RectLike): {
    x: number;
    y: number;
} | null;
