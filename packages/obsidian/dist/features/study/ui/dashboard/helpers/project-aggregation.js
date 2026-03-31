import { UNASSIGNED_PATH } from "@true-recall/core/constants";
import { computeProjectStats, } from "@true-recall/obsidian/editor/study/widgets/project-stats";
import { computeActionableSessionSnapshot, } from "@true-recall/obsidian/features/study/services/actionable-session-snapshot.service";
import { State } from "ts-fsrs";
export { UNASSIGNED_PATH };
const MAX_RECENTLY_STUDIED = 5;
function buildCardsBySourceUid(cards) {
    var _a;
    const map = new Map();
    for (const card of cards) {
        const uid = (_a = card.sourceUid) !== null && _a !== void 0 ? _a : card.fsrs.sourceUid;
        if (!uid)
            continue;
        const bucket = map.get(uid);
        const fsrs = card.fsrs.sourceUid
            ? card.fsrs
            : Object.assign(Object.assign({}, card.fsrs), { sourceUid: uid });
        if (bucket) {
            bucket.push(fsrs);
        }
        else {
            map.set(uid, [fsrs]);
        }
    }
    return map;
}
function buildActiveCardsBySourceUid(cards) {
    var _a, _b;
    const map = new Map();
    for (const card of cards) {
        const uid = (_b = (_a = card.sourceUid) !== null && _a !== void 0 ? _a : card.fsrs.sourceUid) !== null && _b !== void 0 ? _b : "";
        if (!uid)
            continue;
        const bucket = map.get(uid);
        if (bucket) {
            bucket.push(card);
        }
        else {
            map.set(uid, [card]);
        }
    }
    return map;
}
function collectActiveCardsForSources(sourceUids, activeCardsBySourceUid) {
    const collected = [];
    for (const uid of sourceUids) {
        const cards = activeCardsBySourceUid.get(uid);
        if (!cards || cards.length === 0)
            continue;
        collected.push(...cards);
    }
    return collected;
}
function buildRetrievabilityCache(cardsBySourceUid, fsrsService, now) {
    const cache = new Map();
    for (const cards of cardsBySourceUid.values()) {
        for (const card of cards) {
            if (card.state === State.New)
                continue;
            cache.set(card.id, fsrsService.getRetrievability(card, now));
        }
    }
    return cache;
}
export function aggregateProjectData(deps) {
    const { notes, showArchived, plugin } = deps;
    // O(1) lookups for notes by path and by name
    const noteByPath = new Map();
    for (const note of notes) {
        if (note.path)
            noteByPath.set(note.path, note);
    }
    const hierarchy = plugin.hierarchyService.buildHierarchy();
    const snapshotCache = new Map();
    const now = new Date();
    const allCardsBySourceUid = buildCardsBySourceUid(plugin.allCards);
    const activeCardsBySourceUid = buildActiveCardsBySourceUid(plugin.activeCards);
    const retrievabilityByCardId = buildRetrievabilityCache(allCardsBySourceUid, plugin.fsrsService, now);
    const indexes = {
        allCardsBySourceUid,
        activeCardsBySourceUid,
        retrievabilityByCardId,
        now,
    };
    const allProjects = hierarchy.map((node) => buildProjectFromNode(node, noteByPath, plugin, snapshotCache, indexes));
    let projects;
    if (showArchived) {
        // Keep all projects, tag archived ones
        projects = allProjects.map((p) => (Object.assign(Object.assign({}, p), { archived: plugin.hierarchyService.isProjectArchived(p.path) })));
    }
    else {
        projects = allProjects.filter((p) => !plugin.hierarchyService.isProjectArchived(p.path));
    }
    // Sort: most active (due + new + learning) first
    projects.sort((a, b) => {
        const aActive = a.due + a.newCount + a.learning;
        const bActive = b.due + b.newCount + b.learning;
        return bActive - aActive;
    });
    // Build reverse map: note name → project names
    const noteProjectMap = buildNoteProjectMap(projects);
    // Collect all project file paths so project notes with flashcards don't appear in Unassigned
    const projectPaths = new Set();
    function collectProjectPaths(projs) {
        for (const p of projs) {
            if (p.path)
                projectPaths.add(p.path);
            collectProjectPaths(p.children);
        }
    }
    collectProjectPaths(allProjects);
    // Virtual "Unassigned" project for orphan notes
    const assignedNoteNames = new Set(noteProjectMap.keys());
    const unassignedNotes = notes.filter((n) => !assignedNoteNames.has(n.name) && !(n.path && projectPaths.has(n.path)));
    if (unassignedNotes.length > 0) {
        projects.push({
            name: "Unassigned",
            path: UNASSIGNED_PATH,
            healthPct: 0,
            newCount: unassignedNotes.reduce((s, n) => s + n.newCount, 0),
            learning: unassignedNotes.reduce((s, n) => s + n.learning, 0),
            due: unassignedNotes.reduce((s, n) => s + n.due, 0),
            totalCards: unassignedNotes.reduce((s, n) => s + n.total, 0),
            childCount: 0,
            lastReviewed: null,
            totalMembers: unassignedNotes.length,
            memberNotes: unassignedNotes,
            children: [],
        });
    }
    // Recently studied: top N notes sorted by lastReview desc
    const recentlyStudied = [...notes]
        .filter((n) => n.lastReview)
        .sort((a, b) => { var _a, _b; return ((_a = b.lastReview) !== null && _a !== void 0 ? _a : "").localeCompare((_b = a.lastReview) !== null && _b !== void 0 ? _b : ""); })
        .slice(0, MAX_RECENTLY_STUDIED);
    return { projects, noteProjectMap, recentlyStudied };
}
function buildProjectFromNode(node, noteByPath, plugin, snapshotCache, indexes) {
    var _a, _b;
    const sourceUids = plugin.hierarchyService.getSourceUidsForProject(node.path);
    const stats = computeProjectStats(node.path, node.name, node.children.length, plugin.hierarchyService, plugin.cardStore, plugin.fsrsService, {
        sourceUids,
        cardsBySourceUid: indexes.allCardsBySourceUid,
        retrievabilityByCardId: indexes.retrievabilityByCardId,
        now: indexes.now,
    });
    // Resolve member notes from paths (include 0-card notes that belong to this project)
    const memberNotes = [];
    for (const memberPath of node.memberPaths) {
        const note = noteByPath.get(memberPath);
        if (note) {
            memberNotes.push(note);
        }
        else {
            const name = (_b = (_a = memberPath.split("/").pop()) === null || _a === void 0 ? void 0 : _a.replace(/\.md$/, "")) !== null && _b !== void 0 ? _b : memberPath;
            memberNotes.push({
                name,
                path: memberPath,
                due: 0,
                newCount: 0,
                learning: 0,
                total: 0,
                lastReview: null,
                overdueDays: 0,
                overdueCount: 0,
                estimatedMinutes: 0,
                priority: "done",
                projects: [],
            });
        }
    }
    const children = node.children.map((child) => buildProjectFromNode(child, noteByPath, plugin, snapshotCache, indexes));
    const scopedActiveCards = collectActiveCardsForSources(sourceUids, indexes.activeCardsBySourceUid);
    const snapshot = computeActionableSessionSnapshot({
        allCards: plugin.allCards,
        archivedSourceUids: plugin.archivedSourceUids,
        settings: plugin.settings,
        sessionPersistence: plugin.sessionPersistence,
        presetService: plugin.presetService,
        metadataCache: plugin.metadataCache,
        hierarchyService: plugin.hierarchyService,
        fsrsService: plugin.fsrsService,
    }, { projectPath: node.path }, { cache: snapshotCache, activeCards: scopedActiveCards });
    const preset = plugin.presetService.resolvePresetChain(node.path).effective
        .preset;
    const presetName = preset.name;
    return {
        name: stats.name,
        path: stats.path,
        healthPct: stats.healthPct,
        newCount: snapshot.counts.new,
        learning: snapshot.counts.learning,
        due: snapshot.counts.due,
        totalCards: stats.totalCards,
        childCount: stats.childCount,
        lastReviewed: stats.lastReviewed,
        totalMembers: memberNotes.length + children.reduce((sum, c) => sum + c.totalMembers, 0),
        memberNotes,
        children,
        presetName,
    };
}
function buildNoteProjectMap(projects) {
    const map = new Map();
    function walk(project) {
        for (const note of project.memberNotes) {
            const existing = map.get(note.name);
            if (existing) {
                existing.push(project.name);
            }
            else {
                map.set(note.name, [project.name]);
            }
        }
        for (const child of project.children) {
            walk(child);
        }
    }
    for (const p of projects)
        walk(p);
    return map;
}
