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
export declare function RangeSummary({ data }: RangeSummaryProps): import("preact").JSX.Element;
export {};
