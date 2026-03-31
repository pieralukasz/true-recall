import type { DashboardTab } from "./types";
interface DashboardTabsProps {
    activeTab: DashboardTab;
    onTabChange: (tab: DashboardTab) => void;
    projectCount: number;
    notesCount: number;
    orphanedCount: number;
    showArchived: boolean;
    onToggleArchived: () => void;
}
export declare function DashboardTabs({ activeTab, onTabChange, projectCount, notesCount, orphanedCount, showArchived, onToggleArchived, }: DashboardTabsProps): import("preact").JSX.Element;
export {};
