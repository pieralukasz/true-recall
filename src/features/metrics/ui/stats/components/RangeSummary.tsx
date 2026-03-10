interface RangeSummaryProps {
	data: {
		daysStudied: number;
		totalDays: number;
		totalReviews: number;
		avgPerDay: number;
		avgForStudiedDays: number;
		dueTomorrow: number;
		dailyLoad: number;
	};
}

export function RangeSummary({ data }: RangeSummaryProps) {
	return (
		<div class="ep:rounded-lg ep:border ep:border-obs-modifier-border ep:bg-obs-primary ep:p-4">
			<h3 class="ep:text-sm ep:font-semibold ep:text-obs-normal ep:mb-3">Period Summary</h3>
			<div class="ep:grid ep:grid-cols-2 sm:ep:grid-cols-4 ep:gap-3 ep:text-xs">
				<SummaryStat label="Days studied" value={`${data.daysStudied}/${data.totalDays}`} />
				<SummaryStat label="Total reviews" value={data.totalReviews.toLocaleString()} />
				<SummaryStat label="Avg/day" value={String(data.avgPerDay)} />
				<SummaryStat label="Avg (studied days)" value={String(data.avgForStudiedDays)} />
				<SummaryStat label="Daily load" value={String(data.dailyLoad)} />
				<SummaryStat label="Due tomorrow" value={String(data.dueTomorrow)} />
			</div>
		</div>
	);
}

function SummaryStat({ label, value }: { label: string; value: string }) {
	return (
		<div>
			<div class="ep:text-obs-muted">{label}</div>
			<div class="ep:text-sm ep:font-semibold ep:text-obs-normal">{value}</div>
		</div>
	);
}
