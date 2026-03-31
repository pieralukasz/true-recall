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

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
	return typeof value === "object" && value !== null;
}

function toFiniteNumber(value: unknown, fallback: number): number {
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

function clamp01(value: number): number {
	if (value < 0) return 0;
	if (value > 1) return 1;
	return value;
}

/**
 * Coordinates in old payloads were often in percentage scale (0-100).
 * Normalize to 0-1 while preserving already-normalized values.
 */
function normalizeCoord(value: number): number {
	const normalized = value > 1 ? value / 100 : value;
	return clamp01(normalized);
}

function normalizeShape(shape: unknown): IOShape {
	return shape === "ellipse" ? "ellipse" : "rect";
}

function normalizeMaskMode(value: unknown): IOMaskMode {
	return value === "all" ? "all" : "solo";
}

function parseRegion(raw: unknown, fallbackOrd: number): IORegion | null {
	if (!isRecord(raw)) return null;

	const id =
		typeof raw.id === "string" && raw.id.trim().length > 0
			? raw.id
			: `io-${fallbackOrd}`;

	const groupKeyRaw = raw.groupKey;
	const fallbackGroup = String(fallbackOrd);
	const groupKey =
		typeof groupKeyRaw === "string" && groupKeyRaw.trim().length > 0
			? groupKeyRaw
			: fallbackGroup;

	const label =
		typeof raw.label === "string" && raw.label.trim().length > 0
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
export function parseIODefinition(
	raw: string | null | undefined,
): IODefinition | null {
	if (!raw || raw.trim().length === 0) return null;

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return null;
	}

	// Legacy format: plain array of regions
	if (Array.isArray(parsed)) {
		const regions = parsed
			.map((region, index) => parseRegion(region, index))
			.filter((region): region is IORegion => Boolean(region));

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
		.filter((region): region is IORegion => Boolean(region));

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
export function normalizeIOImagePath(value: string): string {
	const trimmed = value.trim();
	if (!trimmed) return "";

	const wikiMatch = trimmed.match(/^!\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/);
	if (wikiMatch?.[1]) {
		return wikiMatch[1].trim();
	}

	const mdMatch = trimmed.match(/^!\[[^\]]*\]\(([^)]+)\)$/);
	if (mdMatch?.[1]) {
		return mdMatch[1].trim();
	}

	return trimmed;
}
