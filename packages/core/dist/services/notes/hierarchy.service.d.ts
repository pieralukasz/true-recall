import type { FrontmatterIndexService } from "./frontmatter-index.service";
import type { IFileSystem } from "../../interfaces/file-system";
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
    private fileSystem;
    private resolveLinkPath?;
    private graph;
    constructor(frontmatterIndex: FrontmatterIndexService, fileSystem: IFileSystem, resolveLinkPath?: LinkResolver | undefined);
    invalidateGraph(): void;
    buildHierarchy(): HierarchyTreeNode[];
    getSourceUidsForProject(nodePath: string, includeChildren?: boolean): Set<string>;
    getUnassignedPaths(): string[];
    getParentsForNote(notePath: string): string[];
    getChildPaths(nodePath: string): string[];
    getArchivedSourceUids(): Set<string>;
    isNoteArchived(notePath: string): boolean;
    isProjectArchived(projectPath: string): boolean;
    private ensureGraph;
    private buildGraph;
    private resolveNameToPath;
    private breakCycles;
    private buildTreeNode;
}
