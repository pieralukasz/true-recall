import type { IODefinition, IOMaskMode, IORegion, IOShape } from "./types";

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
export function parseIODefinition(raw: string | null | undefined): IODefinition | null {
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

export function serializeIODefinition(definition: IODefinition): string {
	return JSON.stringify({
		version: 1,
		maskMode: normalizeMaskMode(definition.maskMode),
		regions: definition.regions.map((region, index) => ({
			id: region.id || `io-${index}`,
			x: normalizeCoord(region.x),
			y: normalizeCoord(region.y),
			w: normalizeCoord(region.w),
			h: normalizeCoord(region.h),
			groupKey:
				typeof region.groupKey === "string" &&
				region.groupKey.trim().length > 0
					? region.groupKey
					: String(index),
			shape: normalizeShape(region.shape),
			label: region.label,
		})),
	});
}

function parseGroupOrd(region: IORegion, fallbackOrd: number): number {
	const parsed = Number.parseInt(region.groupKey, 10);
	if (Number.isFinite(parsed) && parsed >= 0) {
		return parsed;
	}
	return fallbackOrd;
}

export function getIOGroupOrds(definition: IODefinition): number[] {
	const ords = definition.regions.map((region, index) =>
		parseGroupOrd(region, index),
	);
	return [...new Set(ords)].sort((a, b) => a - b);
}

export function getRegionsForOrd(
	definition: IODefinition,
	templateOrd: number,
): IORegion[] {
	const matched = definition.regions.filter((region, index) => {
		return parseGroupOrd(region, index) === templateOrd;
	});
	return matched;
}

export function getNextIOGroupKey(definition: IODefinition): string {
	const ords = getIOGroupOrds(definition);
	const next = ords.length > 0 ? Math.max(...ords) + 1 : 0;
	return String(next);
}

export function createEmptyIODefinition(maskMode: IOMaskMode = "solo"): IODefinition {
	return {
		version: 1,
		maskMode,
		regions: [],
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

