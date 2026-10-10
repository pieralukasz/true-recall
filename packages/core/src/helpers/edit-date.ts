/** Date-only bounds are local midnight; timestamps require an explicit timezone. */
export function editDateTimestamp(value: string): number | undefined {
	const match =
		/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2}))?$/.exec(
			value,
		);
	if (!match) return undefined;
	const [, y, m, d, hour, minute, second, zone] = match;
	const year = Number(y),
		month = Number(m),
		day = Number(d);
	const calendar = new Date(0);
	calendar.setUTCFullYear(year, month, 0);
	if (month < 1 || month > 12 || day < 1 || day > calendar.getUTCDate())
		return undefined;
	if (hour === undefined) {
		const local = new Date(0);
		local.setFullYear(year, month - 1, day);
		local.setHours(0, 0, 0, 0);
		return local.getTime();
	}
	if (Number(hour) > 23 || Number(minute) > 59 || Number(second ?? 0) > 59)
		return undefined;
	if (
		zone !== undefined &&
		zone !== "Z" &&
		(Number(zone.slice(1, 3)) > 23 || Number(zone.slice(4)) > 59)
	)
		return undefined;
	const timestamp = Date.parse(value);
	return Number.isFinite(timestamp) ? timestamp : undefined;
}
