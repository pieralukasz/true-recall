import { hasAIKey } from "@true-recall/core/ai/config/ai-client-config";
import type { StreamingFlashcardManager } from "@true-recall/core/ai/generation/streaming-generation.service";
import type {
	CreateGenerationPresetInput,
	UpdateGenerationPresetPatch,
} from "@true-recall/core/types/generation-preset.types";

import type { ApiContext, ApiRequest, ApiResponseWriter } from "../api.types";
import { parseJsonBody, readBody, sendError, sendOk } from "../api.types";

function mapErrorToStatus(message: string): number {
	if (message.includes("not found")) return 404;
	if (message.includes("Cannot edit")) return 403;
	if (message.includes("Cannot delete")) return 403;
	if (message.includes("last preset")) return 403;
	if (message.includes("validation failed")) return 400;
	if (message.includes("Unknown field")) return 400;
	return 500;
}

function mapGenerateErrorToStatus(message: string): number {
	if (message.includes("requires True Recall Pro")) return 403;
	if (message.includes("already in progress")) return 409;
	if (message.includes("not found")) return 404;
	return 502;
}

export function handleListGenerationPresets(
	_req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
): void {
	const presets = ctx.plugin.generationPresetService.list();
	sendOk(res, presets);
}

export function handleGetGenerationPreset(
	_req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
	params: Record<string, string>,
): void {
	const preset = ctx.plugin.generationPresetService.get(params.id ?? "");
	if (!preset) {
		sendError(res, 404, `Preset '${params.id}' not found`);
		return;
	}
	sendOk(res, preset);
}

export async function handleCreateGenerationPreset(
	req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
): Promise<void> {
	const raw = await readBody(req);
	const body = parseJsonBody<CreateGenerationPresetInput>(raw);
	if (!body) {
		sendError(res, 400, "Invalid JSON body");
		return;
	}

	try {
		const created = await ctx.plugin.generationPresetService.create(body);
		sendOk(res, created);
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		sendError(res, mapErrorToStatus(message), message);
	}
}

export async function handleUpdateGenerationPreset(
	req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
	params: Record<string, string>,
): Promise<void> {
	const raw = await readBody(req);
	const patch = parseJsonBody<UpdateGenerationPresetPatch>(raw);
	if (!patch) {
		sendError(res, 400, "Invalid JSON body");
		return;
	}

	try {
		const updated = await ctx.plugin.generationPresetService.update(
			params.id ?? "",
			patch,
		);
		sendOk(res, updated);
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		sendError(res, mapErrorToStatus(message), message);
	}
}

export async function handleDeleteGenerationPreset(
	_req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
	params: Record<string, string>,
): Promise<void> {
	try {
		await ctx.plugin.generationPresetService.delete(params.id ?? "");
		sendOk(res, { id: params.id });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		sendError(res, mapErrorToStatus(message), message);
	}
}

interface GenerateWithPresetInput {
	text: string;
	preset_id: string;
	source_uid?: string;
}

export async function handleGenerateWithPreset(
	req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
): Promise<void> {
	if (!ctx.plugin.isStoreReady()) {
		sendError(res, 503, "Database not ready");
		return;
	}

	if (!hasAIKey(ctx.plugin.settings, "generation")) {
		sendError(
			res,
			400,
			"AI generation is not configured. Pick a provider and model in plugin settings.",
		);
		return;
	}

	const raw = await readBody(req);
	const body = parseJsonBody<GenerateWithPresetInput>(raw);
	if (!body?.text || !body?.preset_id) {
		sendError(
			res,
			400,
			"Body must contain { text: string, preset_id: string }",
		);
		return;
	}

	const preset = ctx.plugin.generationPresetService.get(body.preset_id);
	if (!preset) {
		sendError(res, 404, `Preset '${body.preset_id}' not found`);
		return;
	}

	const { ChunkedGenerationService } = await import(
		"@true-recall/core/ai/generation/chunked-generation.service"
	);
	const { ObsidianHttpClient } = await import(
		"@true-recall/obsidian/adapters/ObsidianHttpClient"
	);

	const service = new ChunkedGenerationService(
		() => ctx.plugin.settings,
		ctx.plugin.flashcardManager as unknown as StreamingFlashcardManager,
		new ObsidianHttpClient(),
	);

	const file = ctx.plugin.app.workspace.getActiveFile();
	if (!file || file.extension !== "md") {
		sendError(
			res,
			400,
			"No active markdown note. Open the target note in Obsidian before running this command.",
		);
		return;
	}

	// If caller provided source_uid, write it to the active note's frontmatter so
	// the streaming service links generated cards to that UID.
	if (body.source_uid) {
		const frontmatterService =
			ctx.plugin.flashcardManager.getFrontmatterService();
		const existing = await frontmatterService.getSourceNoteUid(file.path);
		if (existing !== body.source_uid) {
			await frontmatterService.setSourceNoteUid(file.path, body.source_uid);
		}
	}

	try {
		const [{ collectGenerationContext }, { fetchExistingCardsForFile }] =
			await Promise.all([
				import("@true-recall/obsidian/plugin/collect-generation-context"),
				import("@true-recall/obsidian/plugin/existing-cards-fetcher"),
			]);
		const result = await service.generateFromNote(
			body.text,
			{ basename: file.basename, path: file.path },
			body.preset_id,
			{
				existingCards: await fetchExistingCardsForFile(ctx.plugin, file),
				contextText: await collectGenerationContext(ctx.plugin, preset, file),
			},
		);
		sendOk(res, {
			created: result.created,
			duplicates: result.duplicates,
			createdCardIds: result.createdCardIds,
			preset: { id: result.preset.id, name: result.preset.name },
		});
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		sendError(res, mapGenerateErrorToStatus(message), message);
	}
}
