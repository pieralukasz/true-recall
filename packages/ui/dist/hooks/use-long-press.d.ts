export interface UseLongPressOptions {
    onLongPress: () => void;
    delay?: number;
}
export interface UseLongPressResult {
    handlers: {
        onPointerDown: (e: PointerEvent) => void;
        onPointerUp: () => void;
        onPointerCancel: () => void;
    };
    wasLongPress: () => boolean;
}
export declare function useLongPress({ onLongPress, delay, }: UseLongPressOptions): UseLongPressResult;
