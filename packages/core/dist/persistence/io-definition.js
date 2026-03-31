/**
 * Image Occlusion definition parser/serializer.
 * Extracted from @features/image-occlusion for use by packages/core.
 */
function isRecord(value) {
    return typeof value === "object" && value !== null;
}
function toFiniteNumber(value, fallback) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === "string" && value.trim().length > 0) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    return fallback;
}
function clamp01(value) {
    if (value < 0)
        return 0;
    if (value > 1)
        return 1;
    return value;
}
/**
 * Coordinates in old payloads were often in percentage scale (0-100).
 * Normalize to 0-1 while preserving already-normalized values.
 */
function normalizeCoord(value) {
    const normalized = value > 1 ? value / 100 : value;
    return clamp01(normalized);
}
function normalizeShape(shape) {
    return shape === "ellipse" ? "ellipse" : "rect";
}
function normalizeMaskMode(value) {
    return value === "all" ? "all" : "solo";
}
function parseRegion(raw, fallbackOrd) {
    if (!isRecord(raw))
        return null;
    const id = typeof raw.id === "string" && raw.id.trim().length > 0
        ? raw.id
        : `io-${fallbackOrd}`;
    const groupKeyRaw = raw.groupKey;
    const fallbackGroup = String(fallbackOrd);
    const groupKey = typeof groupKeyRaw === "string" && groupKeyRaw.trim().length > 0
        ? groupKeyRaw
        : fallbackGroup;
    const label = typeof raw.label === "string" && raw.label.trim().length > 0
        ? raw.label.trim()
        : undefined;
    return {
        id,
        x: normalizeCoord(toFiniteNumber(raw.x, 0)),
        y: normalizeCoord(toFiniteNumber(raw.y, 0)),
        w: normalizeCoord(toFiniteNumber(raw.w, 0.1)),
        h: normalizeCoord(toFiniteNumber(raw.h, 0.1)),
        groupKey,
        shape: normalizeShape(raw.shape),
        label,
    };
}
/**
 * Parse Regions payload from note field.
 * Supports both:
 * - v1 IODefinition object ({ regions, maskMode, version })
 * - legacy region array (converted to v1, maskMode="solo")
 */
export function parseIODefinition(raw) {
    if (!raw || raw.trim().length === 0)
        return null;
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch (_a) {
        return null;
    }
    // Legacy format: plain array of regions
    if (Array.isArray(parsed)) {
        const regions = parsed
            .map((region, index) => parseRegion(region, index))
            .filter((region) => Boolean(region));
        return {
            regions,
            maskMode: "solo",
            version: 1,
        };
    }
    if (!isRecord(parsed) || !Array.isArray(parsed.regions)) {
        return null;
    }
    const regions = parsed.regions
        .map((region, index) => parseRegion(region, index))
        .filter((region) => Boolean(region));
    return {
        regions,
        maskMode: normalizeMaskMode(parsed.maskMode),
        version: 1,
    };
}
/**
 * Editor stores plain vault-relative paths.
 * For backwards compatibility we also accept wiki image syntax.
 */
export function normalizeIOImagePath(value) {
    const trimmed = value.trim();
    if (!trimmed)
        return "";
    const wikiMatch = trimmed.match(/^!\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/);
    if (wikiMatch === null || wikiMatch === void 0 ? void 0 : wikiMatch[1]) {
        return wikiMatch[1].trim();
    }
    const mdMatch = trimmed.match(/^!\[[^\]]*\]\(([^)]+)\)$/);
    if (mdMatch === null || mdMatch === void 0 ? void 0 : mdMatch[1]) {
        return mdMatch[1].trim();
    }
    return trimmed;
}
