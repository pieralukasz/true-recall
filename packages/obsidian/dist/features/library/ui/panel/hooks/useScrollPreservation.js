import { useCallback, useRef } from "preact/hooks";
export function useScrollPreservation() {
    const contentRef = useRef(null);
    const preserveScroll = useCallback((action) => {
        var _a, _b;
        const pos = (_b = (_a = contentRef.current) === null || _a === void 0 ? void 0 : _a.scrollTop) !== null && _b !== void 0 ? _b : 0;
        action();
        requestAnimationFrame(() => {
            if (contentRef.current)
                contentRef.current.scrollTop = pos;
        });
    }, []);
    const captureScroll = useCallback(() => {
        var _a, _b;
        const pos = (_b = (_a = contentRef.current) === null || _a === void 0 ? void 0 : _a.scrollTop) !== null && _b !== void 0 ? _b : 0;
        return () => {
            requestAnimationFrame(() => {
                if (contentRef.current)
                    contentRef.current.scrollTop = pos;
            });
        };
    }, []);
    return { contentRef, preserveScroll, captureScroll };
}
