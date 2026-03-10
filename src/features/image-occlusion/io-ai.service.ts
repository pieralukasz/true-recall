import {
	getBYOKFallbackConfig,
	resolveAIClientConfig,
} from "@features/ai/services/ai-client-config";
import {
	AIRequestError,
	type ChatMessage,
	type ContentPart,
	getTextContent,
	OpenRouterClient,
} from "@features/ai/services/openrouter-client";
import type { TrueRecallSettings } from "@shared/types/settings.types";
import { type App, TFile } from "obsidian";
import type { IORegion } from "./types";

// Gemini is the only model family trained for spatial coordinate output
const IO_DETECTION_FALLBACK_MODEL = "google/gemini-2.5-flash";

function resolveVisionModel(userModel: string): string {
	if (userModel === "auto") return "auto";
	if (userModel.startsWith("google/")) return userModel;
	return IO_DETECTION_FALLBACK_MODEL;
}

// Google's recommended system instruction for bounding box detection
const SYSTEM_PROMPT =
	"Return bounding boxes as a JSON array with labels. Never return masks. Limit to 25 objects.";

const USER_PROMPT = `Detect the 2D bounding boxes of all key elements in this educational image that a student should memorize. This includes: labels, terms, annotations, named parts, definitions, formulas, important text, and distinct visual components.

For each detected element, return a JSON object with:
- "box_2d": bounding box as [y_min, x_min, y_max, x_max] in 0-1000 scale
- "label": brief description of the element

Return ONLY the JSON array.`;

const MIME_MAP: Record<string, string> = {
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	gif: "image/gif",
	webp: "image/webp",
	svg: "image/svg+xml",
};

function getMimeType(extension: string): string {
	return MIME_MAP[extension.toLowerCase()] ?? "image/png";
}

export async function imageToBase64(
	app: App,
	imagePath: string,
): Promise<{ base64: string; mimeType: string }> {
	const file = app.vault.getAbstractFileByPath(imagePath);
	if (!(file instanceof TFile)) throw new Error("Image file not found");

	const arrayBuffer = await app.vault.readBinary(file);
	const bytes = new Uint8Array(arrayBuffer);

	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	const base64 = btoa(binary);
	const mimeType = getMimeType(file.extension);

	return { base64, mimeType };
}

interface RawBox {
	x?: unknown;
	y?: unknown;
	w?: unknown;
	h?: unknown;
	label?: unknown;
	box_2d?: unknown;
}

function toNum(value: unknown): number | null {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string") {
		const n = Number(value);
		if (Number.isFinite(n)) return n;
	}
	return null;
}

function clamp01(v: number): number {
	return Math.min(1, Math.max(0, v));
}

function parseBox(raw: RawBox): IORegion | null {
	// Handle Gemini's box_2d: [y0, x0, y1, x1] format
	if (Array.isArray(raw.box_2d) && raw.box_2d.length === 4) {
		const nums = (raw.box_2d as unknown[]).map((v) => toNum(v));
		const [y0, x0, y1, x1] = nums;
		if (y0 == null || x0 == null || y1 == null || x1 == null) return null;
		const x = clamp01(Math.min(x0, x1) / 1000);
		const y = clamp01(Math.min(y0, y1) / 1000);
		const w = clamp01(Math.abs(x1 - x0) / 1000);
		const h = clamp01(Math.abs(y1 - y0) / 1000);
		if (w < 0.01 || h < 0.01) return null;
		if (w > 0.95 && h > 0.95) return null;
		const label = typeof raw.label === "string" ? raw.label.trim() : undefined;
		return {
			id: crypto.randomUUID(),
			x,
			y,
			w,
			h,
			groupKey: "0",
			shape: "rect",
			label: label || undefined,
		};
	}

	const rx = toNum(raw.x);
	const ry = toNum(raw.y);
	const rw = toNum(raw.w);
	const rh = toNum(raw.h);
	if (rx == null || ry == null || rw == null || rh == null) return null;

	const x = clamp01(rx / 1000);
	const y = clamp01(ry / 1000);
	const w = clamp01(rw / 1000);
	const h = clamp01(rh / 1000);

	if (w < 0.01 || h < 0.01) return null;
	if (w > 0.95 && h > 0.95) return null;

	const label = typeof raw.label === "string" ? raw.label.trim() : undefined;
	return {
		id: crypto.randomUUID(),
		x,
		y,
		w,
		h,
		groupKey: "0",
		shape: "rect",
		label: label || undefined,
	};
}

export function parseAIRegions(responseText: string): IORegion[] {
	let text = responseText.trim();

	// Strip markdown code fences
	text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");

	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		// Fallback: extract first JSON array substring
		const start = text.indexOf("[");
		const end = text.lastIndexOf("]");
		if (start === -1 || end === -1 || end <= start) return [];
		try {
			parsed = JSON.parse(text.slice(start, end + 1));
		} catch {
			return [];
		}
	}

	if (!Array.isArray(parsed)) return [];

	return parsed
		.map((item: unknown) => {
			if (typeof item !== "object" || item === null) return null;
			return parseBox(item as RawBox);
		})
		.filter((r): r is IORegion => r !== null);
}

function buildUserPrompt(customHint?: string, settingsPrompt?: string): string {
	const base = settingsPrompt?.trim() || USER_PROMPT;
	const hint = customHint?.trim();
	return hint ? `${base}\n\nAdditional context: ${hint}` : base;
}

export async function detectRegions(
	app: App,
	imagePath: string,
	settings: TrueRecallSettings,
	customHint?: string,
	settingsPrompt?: string,
): Promise<IORegion[]> {
	const { base64, mimeType } = await imageToBase64(app, imagePath);

	const userContent: ContentPart[] = [
		{
			type: "image_url",
			image_url: { url: `data:${mimeType};base64,${base64}` },
		},
		{ type: "text", text: buildUserPrompt(customHint, settingsPrompt) },
	];

	const messages: ChatMessage[] = [
		{ role: "system", content: SYSTEM_PROMPT },
		{ role: "user", content: userContent },
	];

	const request = { messages, temperature: 0.5 };

	const config = resolveAIClientConfig(settings);
	const visionModel = resolveVisionModel(config.model);
	const client = new OpenRouterClient(
		config.apiKey,
		visionModel,
		config.proxyUrl,
		config.userId,
	);

	let responseText: string;
	try {
		const response = await client.chat(request);
		responseText = getTextContent(response.choices[0]?.message);
	} catch (error) {
		if (error instanceof AIRequestError && error.isBudgetExceeded) {
			const fallback = getBYOKFallbackConfig(settings);
			if (fallback) {
				const fallbackClient = new OpenRouterClient(
					fallback.apiKey,
					resolveVisionModel(fallback.model),
					fallback.proxyUrl,
				);
				const response = await fallbackClient.chat(request);
				responseText = getTextContent(response.choices[0]?.message);
			} else {
				throw error;
			}
		} else {
			throw error;
		}
	}

	return parseAIRegions(responseText);
}
