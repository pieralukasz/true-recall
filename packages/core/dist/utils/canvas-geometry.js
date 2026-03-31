export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
export function normalizePointFromRect(clientX, clientY, rect) {
    if (rect.width === 0 || rect.height === 0)
        return null;
    const x = clamp((clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((clientY - rect.top) / rect.height, 0, 1);
    return { x, y };
}
