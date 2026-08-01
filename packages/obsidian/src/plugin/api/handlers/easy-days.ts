import type { EasyDaysConfig, TrueRecallSettings } from "@true-recall/core/types";
import { formatLocalDate } from "@true-recall/core/utils/date.utils";

import type { ApiContext, ApiRequest, ApiResponseWriter } from "../api.types";
import { parseJsonBody, readBody, sendError, sendOk } from "../api.types";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

interface EasyDaysInput {
	recurring_days?: number[];
	specific_dates?: string[];
	/** Dates to append to the existing list, deduplicated. */
	add_dates?: string[];
	remove_dates?: string[];
	multiplier?: number;
	/** Redistribute cards immediately after saving. */
	apply?: boolean;
}

interface ApplyEasyDaysInput {
	dry_run?: boolean;
	days?: number;
}

function readEasyDays(settings: TrueRecallSettings): EasyDaysConfig {
	return {
		recurringDays: settings.easyDays?.recurringDays ?? [],
		specificDates: settings.easyDays?.specificDates ?? [],
	};
}

function respond(
	res: ApiResponseWriter,
	settings: TrueRecallSettings,
	extra: Record<string, unknown> = {},
): void {
	const easyDays = readEasyDays(settings);
	sendOk(res, {
		easyDays,
		multiplier: settings.easyDaysMultiplier,
		...extra,
	});
}

export function handleGetEasyDays(
	_req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
): void {
	respond(res, ctx.plugin.settings);
}

/** Reject anything that is not a YYYY-MM-DD string. */
function invalidDates(dates: string[]): string[] {
	return dates.filter((d) => typeof d !== "string" || !ISO_DATE.test(d));
}

export async function handleUpdateEasyDays(
	req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
): Promise<void> {
	const raw = await readBody(req);
	const body = parseJsonBody<EasyDaysInput>(raw);
	if (!body) {
		sendError(res, 400, "Invalid JSON body");
		return;
	}

	const settings: TrueRecallSettings = ctx.plugin.settings;
	const current = readEasyDays(settings);
	let recurringDays = current.recurringDays;
	let specificDates = current.specificDates;
	const updated: string[] = [];

	if (body.recurring_days !== undefined) {
		if (
			!Array.isArray(body.recurring_days) ||
			body.recurring_days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)
		) {
			sendError(res, 400, "recurring_days must be integers 0-6 (0 = Sunday)");
			return;
		}
		recurringDays = [...new Set(body.recurring_days)].sort();
		updated.push("recurring_days");
	}

	for (const key of ["specific_dates", "add_dates", "remove_dates"] as const) {
		const value = body[key];
		if (value === undefined) continue;
		if (!Array.isArray(value) || invalidDates(value).length > 0) {
			sendError(res, 400, `${key} must be an array of YYYY-MM-DD strings`);
			return;
		}
	}

	if (body.specific_dates !== undefined) {
		specificDates = [...new Set(body.specific_dates)].sort();
		updated.push("specific_dates");
	}
	if (body.add_dates?.length) {
		specificDates = [...new Set([...specificDates, ...body.add_dates])].sort();
		updated.push("add_dates");
	}
	if (body.remove_dates?.length) {
		const drop = new Set(body.remove_dates);
		specificDates = specificDates.filter((d) => !drop.has(d));
		updated.push("remove_dates");
	}

	if (body.multiplier !== undefined) {
		if (body.multiplier < 0 || body.multiplier > 1) {
			sendError(res, 400, "multiplier must be between 0 and 1");
			return;
		}
		settings.easyDaysMultiplier = body.multiplier;
		updated.push("multiplier");
	}

	if (updated.length === 0) {
		sendError(res, 400, "No recognized fields to update");
		return;
	}

	settings.easyDays = { recurringDays, specificDates };
	await ctx.plugin.saveSettings();

	if (!body.apply) {
		respond(res, settings, { updated });
		return;
	}

	const result = ctx.plugin.fsrsHelper?.applyEasyDays({ dryRun: false });
	respond(res, settings, {
		updated,
		applied: true,
		movedCards: result?.affectedCount ?? 0,
	});
}

export async function handleApplyEasyDays(
	req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
): Promise<void> {
	const raw = await readBody(req);
	const body = parseJsonBody<ApplyEasyDaysInput>(raw) ?? {};

	const settings: TrueRecallSettings = ctx.plugin.settings;
	const easyDays = readEasyDays(settings);
	if (
		easyDays.recurringDays.length === 0 &&
		easyDays.specificDates.length === 0
	) {
		sendError(res, 400, "No easy days configured");
		return;
	}

	// Default to a real run: the caller asked to apply, not to preview.
	const dryRun = body.dry_run === true;
	const result = ctx.plugin.fsrsHelper?.applyEasyDays({
		dryRun,
		...(body.days !== undefined && { days: body.days }),
	});

	sendOk(res, {
		dryRun,
		movedCards: result?.affectedCount ?? 0,
		easyDays,
		multiplier: settings.easyDaysMultiplier,
	});
}

/**
 * One-shot "today is an easy day": append a date (defaulting to the plugin
 * host's local today) and redistribute immediately.
 */
export async function handleAddEasyDay(
	req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
): Promise<void> {
	const raw = await readBody(req);
	const body = parseJsonBody<{ date?: string; apply?: boolean }>(raw) ?? {};

	const date = body.date ?? formatLocalDate(new Date());
	if (!ISO_DATE.test(date)) {
		sendError(res, 400, "date must be YYYY-MM-DD");
		return;
	}

	const settings: TrueRecallSettings = ctx.plugin.settings;
	const current = readEasyDays(settings);
	const specificDates = [...new Set([...current.specificDates, date])].sort();

	settings.easyDays = { recurringDays: current.recurringDays, specificDates };
	await ctx.plugin.saveSettings();

	const shouldApply = body.apply !== false;
	const result = shouldApply
		? ctx.plugin.fsrsHelper?.applyEasyDays({ dryRun: false })
		: undefined;

	respond(res, settings, {
		date,
		applied: shouldApply,
		movedCards: result?.affectedCount ?? 0,
	});
}
