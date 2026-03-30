/**
 * Image Occlusion definition utilities.
 * Platform-agnostic helpers for IO region parsing and serialization.
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
export function serializeIODefinition(definition) {
    return JSON.stringify({
        version: 1,
        maskMode: normalizeMaskMode(definition.maskMode),
        regions: definition.regions.map((region, index) => ({
            id: region.id || `io-${index}`,
            x: normalizeCoord(region.x),
            y: normalizeCoord(region.y),
            w: normalizeCoord(region.w),
            h: normalizeCoord(region.h),
            groupKey: typeof region.groupKey === "string" && region.groupKey.trim().length > 0
                ? region.groupKey
                : String(index),
            shape: normalizeShape(region.shape),
            label: region.label,
        })),
    });
}
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
function parseGroupOrd(region, fallbackOrd) {
    const parsed = Number.parseInt(region.groupKey, 10);
    if (Number.isFinite(parsed) && parsed >= 0) {
        return parsed;
    }
    return fallbackOrd;
}
export function getIOGroupOrds(definition) {
    const ords = definition.regions.map((region, index) => parseGroupOrd(region, index));
    return [...new Set(ords)].sort((a, b) => a - b);
}
export function getRegionsForOrd(definition, templateOrd) {
    const matched = definition.regions.filter((region, index) => {
        return parseGroupOrd(region, index) === templateOrd;
    });
    return matched;
}
export function getNextIOGroupKey(definition) {
    const ords = getIOGroupOrds(definition);
    const next = ords.length > 0 ? Math.max(...ords) + 1 : 0;
    return String(next);
}
export function createEmptyIODefinition(maskMode = "solo") {
    return {
        version: 1,
        maskMode,
        regions: [],
    };
}
