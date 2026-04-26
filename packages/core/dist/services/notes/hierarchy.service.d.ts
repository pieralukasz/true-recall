import type { IFileSystem } from "../../interfaces/file-system";
import type { FrontmatterIndexService } from "./frontmatter-index.service";
export interface HierarchyTreeNode {
    path: string;
    name: string;
    treePath: string;
    children: HierarchyTreeNode[];
    memberPaths: string[];
}
export type ProjectNode = HierarchyTreeNode;
/**
 * Resolve a link name to a file path.
 * Platform adapters can provide a custom implementation.
 */
export type LinkResolver = (name: string) => string | null;
export declare class HierarchyService {
    private frontmatterIndex;
    private resolveLinkPath?;
    private graph;
    constructor(frontmatterIndex: FrontmatterIndexService, _fileSystem: IFileSystem, resolveLinkPath?: LinkResolver | undefined);
    invalidateGraph(): void;
    buildHierarchy(): HierarchyTreeNode[];
    getSourceUidsForProject(nodePath: string, includeChildren?: boolean): Set<string>;
    getUnassignedPaths(): string[];
    getParentsForNote(notePath: string): string[];
    getChildPaths(nodePath: string): string[];
    getDescendantPaths(nodePath: string): string[];
    getPathsForCascade(projectPath: string, archive: boolean): string[];
    getArchivedSourceUids(): Set<string>;
    isNoteArchived(notePath: string): boolean;
    isProjectArchived(projectPath: string): boolean;
    isExplicitProject(notePath: string): boolean;
    private ensureGraph;
    private buildGraph;
    private resolveNameToPath;
    private breakCycles;
    private buildTreeNode;
}
