export class HierarchyService {
    constructor(frontmatterIndex, fileSystem, resolveLinkPath) {
        this.frontmatterIndex = frontmatterIndex;
        this.fileSystem = fileSystem;
        this.resolveLinkPath = resolveLinkPath;
        this.graph = null;
    }
    invalidateGraph() {
        this.graph = null;
    }
    buildHierarchy() {
        const graph = this.ensureGraph();
        const roots = [...graph.roots].sort();
        return roots
            .map((rootPath) => this.buildTreeNode(rootPath, rootPath, graph, new Set()))
            .filter((n) => n !== null);
    }
    getSourceUidsForProject(nodePath, includeChildren = true) {
        const graph = this.ensureGraph();
        const uids = new Set();
        const visited = new Set();
        const collect = (path) => {
            if (visited.has(path))
                return;
            visited.add(path);
            // Collect this node's own UIDs
            const nodeUids = this.frontmatterIndex.getValues("flashcard_uid", path);
            for (const uid of nodeUids)
                uids.add(uid);
            // Collect children's UIDs
            const children = graph.childMap.get(path);
            if (!children)
                return;
            for (const childPath of children) {
                // Always collect the child's own UIDs
                const childUids = this.frontmatterIndex.getValues("flashcard_uid", childPath);
                for (const uid of childUids)
                    uids.add(uid);
                if (includeChildren) {
                    collect(childPath);
                }
            }
        };
        collect(nodePath);
        return uids;
    }
    getUnassignedPaths() {
        const graph = this.ensureGraph();
        // All notes with flashcard_uid
        const allUids = this.frontmatterIndex.getAllValues("flashcard_uid");
        const flashcardPaths = new Set();
        for (const uid of allUids) {
            const path = this.frontmatterIndex.getFileByValue("flashcard_uid", uid);
            if (path)
                flashcardPaths.add(path);
        }
        // A note is "assigned" if it has parents or is itself a parent (root project)
        const assigned = new Set();
        for (const path of graph.parentMap.keys())
            assigned.add(path);
        for (const path of graph.childMap.keys())
            assigned.add(path);
        return Array.from(flashcardPaths).filter((p) => !assigned.has(p));
    }
    getParentsForNote(notePath) {
        const graph = this.ensureGraph();
        const parents = graph.parentMap.get(notePath);
        return parents ? [...parents] : [];
    }
    getChildPaths(nodePath) {
        const graph = this.ensureGraph();
        const children = graph.childMap.get(nodePath);
        return children ? [...children] : [];
    }
    getArchivedSourceUids() {
        const archivedPaths = this.frontmatterIndex.getFilesByValue("archive", "true");
        const uids = new Set();
        for (const filePath of archivedPaths) {
            // Check if this archived note is a "project" (has children)
            const graph = this.ensureGraph();
            if (graph.childMap.has(filePath)) {
                // Archived project -> collect all descendant UIDs
                const projectUids = this.getSourceUidsForProject(filePath, true);
                for (const uid of projectUids)
                    uids.add(uid);
            }
            else {
                // Archived regular note -> just its own UID
                const [uid] = this.frontmatterIndex.getValues("flashcard_uid", filePath);
                if (uid)
                    uids.add(uid);
            }
        }
        return uids;
    }
    isNoteArchived(notePath) {
        const [val] = this.frontmatterIndex.getValues("archive", notePath);
        return val === "true";
    }
    isProjectArchived(projectPath) {
        return this.isNoteArchived(projectPath);
    }
    // ---- Internal ----
    ensureGraph() {
        if (this.graph)
            return this.graph;
        this.graph = this.buildGraph();
        return this.graph;
    }
    buildGraph() {
        var _a, _b;
        const parentMap = new Map();
        const childMap = new Map();
        // Scan all notes that have parents[] declared
        const allParentNames = this.frontmatterIndex.getAllValues("parents");
        // For each unique parent name, find all children that declare it
        for (const parentName of allParentNames) {
            const trimmed = parentName.trim();
            if (!trimmed)
                continue;
            const parentPath = (_a = this.resolveNameToPath(trimmed)) !== null && _a !== void 0 ? _a : `${trimmed}.md`;
            const childPaths = this.frontmatterIndex.getFilesByValue("parents", parentName);
            for (const childPath of childPaths) {
                // Add edge: child -> parent
                let parents = parentMap.get(childPath);
                if (!parents) {
                    parents = new Set();
                    parentMap.set(childPath, parents);
                }
                parents.add(parentPath);
                // Add edge: parent -> child
                let children = childMap.get(parentPath);
                if (!children) {
                    children = new Set();
                    childMap.set(parentPath, children);
                }
                children.add(childPath);
            }
        }
        // Detect and break cycles
        this.breakCycles(parentMap, childMap);
        // Identify roots: nodes that have children but no parents themselves
        const roots = new Set();
        for (const path of childMap.keys()) {
            if (!parentMap.has(path) || ((_b = parentMap.get(path)) === null || _b === void 0 ? void 0 : _b.size) === 0) {
                roots.add(path);
            }
        }
        return { parentMap, childMap, roots };
    }
    resolveNameToPath(name) {
        if (this.resolveLinkPath) {
            return this.resolveLinkPath(name);
        }
        return null;
    }
    breakCycles(parentMap, childMap) {
        const white = new Set();
        const gray = new Set();
        const black = new Set();
        for (const path of parentMap.keys())
            white.add(path);
        for (const path of childMap.keys())
            white.add(path);
        const dfs = (node) => {
            white.delete(node);
            gray.add(node);
            const children = childMap.get(node);
            if (children) {
                for (const child of [...children]) {
                    if (gray.has(child)) {
                        console.warn(`[HierarchyService] Cycle detected: ${node} -> ${child}. Breaking edge.`);
                        children.delete(child);
                        const childParents = parentMap.get(child);
                        if (childParents)
                            childParents.delete(node);
                    }
                    else if (white.has(child)) {
                        dfs(child);
                    }
                }
            }
            gray.delete(node);
            black.add(node);
        };
        while (white.size > 0) {
            const node = white.values().next().value;
            dfs(node);
        }
    }
    buildTreeNode(path, treePath, graph, ancestors) {
        var _a, _b;
        // Prevent infinite recursion from any remaining cycles
        if (ancestors.has(path))
            return null;
        const name = (_b = (_a = path.split("/").pop()) === null || _a === void 0 ? void 0 : _a.replace(/\.md$/, "")) !== null && _b !== void 0 ? _b : path;
        const childPaths = graph.childMap.get(path);
        const nextAncestors = new Set(ancestors);
        nextAncestors.add(path);
        const children = [];
        const memberPaths = [];
        if (childPaths) {
            for (const childPath of [...childPaths].sort()) {
                const childHasChildren = graph.childMap.has(childPath);
                if (childHasChildren) {
                    const childNode = this.buildTreeNode(childPath, `${treePath}/${childPath}`, graph, nextAncestors);
                    if (childNode)
                        children.push(childNode);
                }
                else {
                    memberPaths.push(childPath);
                }
            }
        }
        return { path, name, treePath, children, memberPaths };
    }
}
