function parseDateKey(dateKey: string): Date {
	const [year, month, day] = dateKey.split("-").map(Number);
	if (
		year === undefined ||
		month === undefined ||
		day === undefined ||
		Number.isNaN(year) ||
		Number.isNaN(month) ||
		Number.isNaN(day)
	) {
		throw new Error(`Invalid date key: ${dateKey}`);
	}
	return new Date(Date.UTC(year, month - 1, day));
}

export function toUtcIsoDayRange(
	startDate: string,
	endDate: string,
): { startIso: string; endExclusiveIso: string } {
	const start = parseDateKey(startDate);
	const end = parseDateKey(endDate);
	end.setUTCDate(end.getUTCDate() + 1);
	return {
		startIso: start.toISOString(),
		endExclusiveIso: end.toISOString(),
	};
}
