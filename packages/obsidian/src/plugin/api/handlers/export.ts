import { CsvExportService } from "@true-recall/core/integration/csv/csv-export.service";
import type { ApiContext, ApiRequest, ApiResponseWriter } from "../api.types";
import { parseJsonBody, readBody, sendError, sendOk } from "../api.types";

interface ExportCsvInput {
	source_uids?: string[];
	include_scheduling?: boolean;
	separator?: "," | "\t" | ";";
}

export async function handleExportCsv(
	req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
): Promise<void> {
	if (!ctx.plugin.isStoreReady()) {
		sendError(res, 503, "Database not ready");
		return;
	}

	const raw = await readBody(req);
	const body = parseJsonBody<ExportCsvInput>(raw) ?? {};

	const resolver = {
		resolveSourceUids() {
			const map = new Map<string, { name: string }>();
			const allCards = ctx.plugin.cardStore.cards.getAll();
			for (const card of allCards) {
				if (card.sourceUid && card.sourceNoteName) {
					map.set(card.sourceUid, { name: card.sourceNoteName });
				}
			}
			return map;
		},
	};

	const service = new CsvExportService(ctx.plugin.cardStore, resolver);

	try {
		const result = service.export({
			sourceUids: body.source_uids,
			includeScheduling: body.include_scheduling ?? true,
			separator: body.separator ?? ",",
		});

		sendOk(res, result);
	} catch (error) {
		sendError(
			res,
			400,
			error instanceof Error ? error.message : "Export failed",
		);
	}
}
