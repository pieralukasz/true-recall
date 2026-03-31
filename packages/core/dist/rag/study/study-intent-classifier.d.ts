export type StudyIntent = "knowledge" | "stats" | "mixed";
export declare function classifyIntent(question: string): StudyIntent;
