import type {
	CardAIFieldScope,
	CardAIPreset,
	CardAIPresetMode,
	CardAIUserSettings,
} from "@true-recall/core/types/card-ai-preset.types";

import type { ApiContext, ApiRequest, ApiResponseWriter } from "../api.types";
import { parseJsonBody, readBody, sendError, sendOk } from "../api.types";

const MODES: CardAIPresetMode[] = ["edit", "split", "spawn"];
const FIELD_SCOPES: CardAIFieldScope[] = [
	"all",
	"question",
	"answer",
	"empty-answer",
];

/** Keys the API may write. `builtin`, `requiresPro`, and `executor`
 * (mechanical transforms) stay plugin-managed. */
const WRITABLE_KEYS = [
	"name",
	"prompt",
	"autoApply",
	"autoApplyNewCards",
	"includeSourceNote",
	"includeRelatedCards",
	"mode",
	"fieldScope",
] as const;

type WritableKey = (typeof WRITABLE_KEYS)[number];
type CardPolishPresetInput = Partial<Pick<CardAIPreset, WritableKey>>;

const BOOLEAN_KEYS: WritableKey[] = [
	"autoApply",
	"autoApplyNewCards",
	"includeSourceNote",
	"includeRelatedCards",
];

function validateInput(
	input: Record<string, unknown>,
	{ requireCore }: { requireCore: boolean },
): string[] {
	const errors: string[] = [];
	for (const key of Object.keys(input)) {
		if (!(WRITABLE_KEYS as readonly string[]).includes(key)) {
			errors.push(`Unknown key '${key}' (valid: ${WRITABLE_KEYS.join(", ")})`);
		}
	}
	const { name, prompt, mode, fieldScope } = input;
	if (requireCore || name !== undefined) {
		if (typeof name !== "string" || name.trim() === "") {
			errors.push("'name' must be a non-empty string");
		}
	}
	if (requireCore || prompt !== undefined) {
		if (typeof prompt !== "string" || prompt.trim() === "") {
			errors.push("'prompt' must be a non-empty string");
		}
	}
	if (mode !== undefined && !MODES.includes(mode as CardAIPresetMode)) {
		errors.push(`'mode' must be one of: ${MODES.join(", ")}`);
	}
	if (
		fieldScope !== undefined &&
		!FIELD_SCOPES.includes(fieldScope as CardAIFieldScope)
	) {
		errors.push(`'fieldScope' must be one of: ${FIELD_SCOPES.join(", ")}`);
	}
	for (const key of BOOLEAN_KEYS) {
		if (input[key] !== undefined && typeof input[key] !== "boolean") {
			errors.push(`'${key}' must be a boolean`);
		}
	}
	return errors;
}

function getBucket(ctx: ApiContext): CardAIUserSettings {
	if (!ctx.plugin.settings.cardPolish) {
		ctx.plugin.settings.cardPolish = {
			userPresets: [],
			customPromptAutoApply: false,
		};
	}
	return ctx.plugin.settings.cardPolish;
}

function makeId(existing: readonly CardAIPreset[]): string {
	const taken = new Set(existing.map((preset) => preset.id));
	let id = "";
	do {
		id = `preset-${Math.random().toString(36).slice(2, 10)}`;
	} while (taken.has(id));
	return id;
}

export function handleListCardPolishPresets(
	_req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
): void {
	sendOk(res, ctx.plugin.settings.cardPolish?.userPresets ?? []);
}

export async function handleCreateCardPolishPreset(
	req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
): Promise<void> {
	const raw = await readBody(req);
	const body = parseJsonBody<Record<string, unknown>>(raw);
	if (!body) {
		sendError(res, 400, "Invalid JSON body");
		return;
	}
	const errors = validateInput(body, { requireCore: true });
	if (errors.length > 0) {
		sendError(res, 400, `Preset validation failed: ${errors.join("; ")}`);
		return;
	}

	const bucket = getBucket(ctx);
	const input = body as CardPolishPresetInput;
	const created: CardAIPreset = {
		id: makeId(bucket.userPresets),
		name: (input.name ?? "").trim(),
		prompt: input.prompt ?? "",
		autoApply: input.autoApply ?? false,
		builtin: false,
		...(input.autoApplyNewCards !== undefined && {
			autoApplyNewCards: input.autoApplyNewCards,
		}),
		...(input.includeSourceNote !== undefined && {
			includeSourceNote: input.includeSourceNote,
		}),
		...(input.includeRelatedCards !== undefined && {
			includeRelatedCards: input.includeRelatedCards,
		}),
		...(input.mode !== undefined && { mode: input.mode }),
		...(input.fieldScope !== undefined && { fieldScope: input.fieldScope }),
	};
	bucket.userPresets.push(created);
	await ctx.plugin.saveSettings();
	sendOk(res, created);
}

export async function handleUpdateCardPolishPreset(
	req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
	params: Record<string, string>,
): Promise<void> {
	const raw = await readBody(req);
	const patch = parseJsonBody<Record<string, unknown>>(raw);
	if (!patch) {
		sendError(res, 400, "Invalid JSON body");
		return;
	}
	const errors = validateInput(patch, { requireCore: false });
	if (errors.length > 0) {
		sendError(res, 400, `Preset validation failed: ${errors.join("; ")}`);
		return;
	}

	const bucket = getBucket(ctx);
	const preset = bucket.userPresets.find((p) => p.id === params.id);
	if (!preset) {
		sendError(res, 404, `Preset '${params.id}' not found`);
		return;
	}
	if (preset.builtin) {
		sendError(res, 403, "Cannot edit builtin preset");
		return;
	}

	Object.assign(preset, patch as CardPolishPresetInput);
	await ctx.plugin.saveSettings();
	sendOk(res, preset);
}

export async function handleDeleteCardPolishPreset(
	_req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
	params: Record<string, string>,
): Promise<void> {
	const bucket = getBucket(ctx);
	const index = bucket.userPresets.findIndex((p) => p.id === params.id);
	if (index === -1) {
		sendError(res, 404, `Preset '${params.id}' not found`);
		return;
	}
	if (bucket.userPresets[index]?.builtin) {
		sendError(res, 403, "Cannot delete builtin preset");
		return;
	}

	bucket.userPresets.splice(index, 1);
	await ctx.plugin.saveSettings();
	sendOk(res, { id: params.id });
}
