import { hasAIKey } from "@true-recall/core/ai/ai-client-config";
import { FlashcardGenerationService } from "@true-recall/core/ai/flashcard-generation.service";
import { fixBlockSourceTexts } from "@true-recall/core/ai/source-text-fixer";
import type { ApiContext, ApiRequest, ApiResponseWriter } from "../api.types";
import { parseJsonBody, readBody, sendError, sendOk } from "../api.types";

interface GenerateInput {
	text: string;
	note_type_slug?: string;
	source_uid?: string;
}

export async function handleGenerate(
	req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
): Promise<void> {
	if (!ctx.plugin.isStoreReady()) {
		sendError(res, 503, "Database not ready");
		return;
	}

	if (!hasAIKey(ctx.plugin.settings)) {
		sendError(
			res,
			400,
			"No AI key configured. Add your Pro key or OpenRouter API key in plugin settings.",
		);
		return;
	}

	const raw = await readBody(req);
	const body = parseJsonBody<GenerateInput>(raw);
	if (!body?.text) {
		sendError(res, 400, "Body must contain { text: string }");
		return;
	}

	const noteType = body.note_type_slug
		? ctx.plugin.flashcardManager.getNoteTypeBySlug(body.note_type_slug)
		: null;

	const { ObsidianHttpClient } = await import(
		"@true-recall/obsidian/adapters/ObsidianHttpClient"
	);
	const service = new FlashcardGenerationService(
		() => ctx.plugin.settings,
		(slug) => ctx.plugin.flashcardManager.getNoteTypeBySlug(slug),
		new ObsidianHttpClient(),
	);

	let result: Awaited<ReturnType<FlashcardGenerationService["generate"]>>;
	try {
		result = await service.generate(body.text, noteType);
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		sendError(res, 502, `AI generation failed: ${message}`);
		return;
	}

	if (result.blocks.length === 0) {
		sendOk(res, {
			created: 0,
			cards: [],
			message: "AI returned no parseable flashcards",
		});
		return;
	}

	// Resolve source UID: use provided, or derive from active note
	let sourceUid = body.source_uid;
	if (!sourceUid) {
		const file = ctx.plugin.app.workspace.getActiveFile();
		if (file && file.extension === "md") {
			const frontmatterService =
				ctx.plugin.flashcardManager.getFrontmatterService();
			sourceUid =
				(await frontmatterService.getSourceNoteUid(file.path)) ?? undefined;
			if (!sourceUid) {
				sourceUid = frontmatterService.generateUid();
				await frontmatterService.setSourceNoteUid(file.path, sourceUid);
			}
		}
	}

	fixBlockSourceTexts(result.blocks, body.text);

	const noteParams = result.blocks.map((block) => ({
		noteTypeId: block.noteTypeId,
		fields: block.fields,
		alwaysTypeIn: block.alwaysTypeIn,
		sourceUid,
		sourceText: block.sourceText,
		createdVia: "ai" as const,
	}));

	const batchResult = ctx.plugin.flashcardManager.createNoteBatch(noteParams);

	sendOk(res, {
		created: batchResult.cards.length,
		cards: batchResult.cards.map((c) => ({
			id: c.id,
			question: c.question ?? "",
			answer: c.answer ?? "",
			cardType: c.cardType ?? "basic",
			sourceText: c.sourceText,
		})),
	});
}

export function handleGetNoteTypes(
	_req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
): void {
	if (!ctx.plugin.isStoreReady()) {
		sendError(res, 503, "Database not ready");
		return;
	}

	const noteTypes = ctx.plugin.cardStore.noteTypes.getAll();
	sendOk(
		res,
		noteTypes.map((nt) => ({
			id: nt.id,
			name: nt.name,
			slug: nt.slug,
			type: nt.type === 0 ? "standard" : "cloze",
			fields: nt.fields,
			isBuiltin: nt.isBuiltin,
		})),
	);
}
