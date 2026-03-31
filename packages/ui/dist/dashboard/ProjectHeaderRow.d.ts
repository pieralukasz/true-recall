import type { DashboardProject } from "./types";
interface ProjectHeaderRowProps {
    project: DashboardProject;
    depth: number;
    isExpanded: boolean;
    isVirtual?: boolean;
    onToggle: () => void;
    onStudyProject: () => void;
    onContextMenu?: (e: MouseEvent) => void;
}
export declare function ProjectHeaderRow({ project, depth, isExpanded: _isExpanded, isVirtual, onToggle, onStudyProject, onContextMenu, }: ProjectHeaderRowProps): import("preact").JSX.Element;
export declare function EmptyProjectRow({ depth }: {
    depth: number;
}): import("preact").JSX.Element;
export {};
