/**
 * Plugin Event Handlers
 * Event registrations for file and workspace events
 */
import { Notice, TFile } from "obsidian";
import type EpistemePlugin from "../main";
import { FlashcardPanelView } from "../ui/panel/FlashcardPanelView";
import { VIEW_TYPE_FLASHCARD_PANEL } from "../constants";
import { isImageExtension } from "../types";
import { ImageService } from "../services/image";

// Debounce timers for file modify events
const modifyDebounceMap = new Map<string, ReturnType<typeof setTimeout>>();
const MODIFY_DEBOUNCE_MS = 500;

/**
 * Register workspace and vault event handlers
 */
export function registerEventHandlers(plugin: EpistemePlugin): void {
    // File context menu for custom review
    plugin.registerEvent(
        plugin.app.workspace.on("file-menu", (menu, file) => {
            if (file instanceof TFile && file.extension === "md") {
                // Don't show on flashcard files themselves
                if (plugin.flashcardManager.isFlashcardFile(file)) return;

                menu.addItem((item) => {
                    item.setTitle("Review flashcards from this note")
                        .setIcon("brain")
                        .onClick(() => void plugin.reviewNoteFlashcards(file));
                });

                menu.addItem((item) => {
                    item.setTitle("Create project from this note")
                        .setIcon("folder-plus")
                        .onClick(() => void plugin.createProjectFromNote(file));
                });
            }
        })
    );

    // Listen for active file changes
    plugin.registerEvent(
        plugin.app.workspace.on("file-open", (file) => {
            updatePanelView(plugin, file);
        })
    );

    // Also listen for active leaf changes
    plugin.registerEvent(
        plugin.app.workspace.on("active-leaf-change", () => {
            const file = plugin.app.workspace.getActiveFile();
            updatePanelView(plugin, file);
        })
    );

    // Listen for file renames to update source_link and image paths
    plugin.registerEvent(
        plugin.app.vault.on("rename", async (file, oldPath) => {
            if (!(file instanceof TFile)) return;

            // Handle markdown file renames (source notes)
            if (file.extension === "md") {
                const frontmatterService = plugin.flashcardManager.getFrontmatterService();
                const uid = await frontmatterService.getSourceNoteUid(file);
                if (!uid) return;

                // Update source_notes table in SQLite with new path and name
                plugin.cardStore.projects.updateSourceNotePath(uid, file.path, file.basename);
                return;
            }

            // Handle image file renames
            if (isImageExtension(file.extension)) {
                await handleImageRename(plugin, file, oldPath);
            }
        })
    );

    // Listen for file modifications to sync projects from frontmatter
    plugin.registerEvent(
        plugin.app.vault.on("modify", (file) => {
            if (!(file instanceof TFile) || file.extension !== "md") return;

            // Skip flashcard files
            if (plugin.flashcardManager.isFlashcardFile(file)) return;

            // Debounce: clear existing timer for this file
            const existing = modifyDebounceMap.get(file.path);
            if (existing) {
                clearTimeout(existing);
            }

            // Set new timer
            const timer = setTimeout(() => {
                modifyDebounceMap.delete(file.path);
                void syncProjectsFromFrontmatter(plugin, file);
            }, MODIFY_DEBOUNCE_MS);

            modifyDebounceMap.set(file.path, timer);
        })
    );

    // Listen for file deletions to clean up orphaned source notes
    plugin.registerEvent(
        plugin.app.vault.on("delete", (file) => {
            if (!(file instanceof TFile) || file.extension !== "md") return;

            // We can't read frontmatter from deleted file, so look up by path
            const sourceNote = plugin.cardStore.projects.getSourceNoteByPath(file.path);
            if (sourceNote) {
                const cards = plugin.cardStore.getCardsBySourceUid(sourceNote.uid);
                // Delete source note but keep flashcards (detachCards = false sets source_uid = NULL)
                plugin.cardStore.projects.deleteSourceNote(sourceNote.uid, false);
                if (cards.length > 0) {
                    new Notice(`Source note deleted. ${cards.length} flashcard(s) are now orphaned.`);
                }
            }
        })
    );
}

/**
 * Update the panel view with current file
 */
function updatePanelView(plugin: EpistemePlugin, file: TFile | null): void {
    const leaves = plugin.app.workspace.getLeavesOfType(VIEW_TYPE_FLASHCARD_PANEL);
    leaves.forEach((leaf) => {
        const view = leaf.view;
        if (view instanceof FlashcardPanelView) {
            void view.handleFileChange(file);
        }
    });
}

/**
 * Handle image file renames - update flashcard content and image refs
 */
async function handleImageRename(plugin: EpistemePlugin, file: TFile, oldPath: string): Promise<void> {
    const store = plugin.cardStore;
    const imageService = new ImageService(plugin.app);

    // Find all cards that reference the old image path
    const cardRefs = store.projects.getCardsByImagePath(oldPath);
    if (cardRefs.length === 0) {
        return;
    }

    // Update each card's content
    const updatedCardIds = new Set<string>();
    for (const ref of cardRefs) {
        if (updatedCardIds.has(ref.cardId)) continue;

        const card = store.get(ref.cardId);
        if (!card || !card.question || !card.answer) continue;

        // Replace image path in content
        const newQuestion = imageService.replaceImagePath(card.question, oldPath, file.path);
        const newAnswer = imageService.replaceImagePath(card.answer, oldPath, file.path);

        // Update card if content changed
        if (newQuestion !== card.question || newAnswer !== card.answer) {
            store.cards.updateCardContent(ref.cardId, newQuestion, newAnswer);
            updatedCardIds.add(ref.cardId);
        }
    }

    // Update the image_refs table
    store.projects.updateImagePath(oldPath, file.path);

    if (updatedCardIds.size > 0) {
        console.debug(`[Episteme] Updated ${updatedCardIds.size} card(s) after image rename: ${oldPath} -> ${file.path}`);
    }
}

/**
 * Sync projects from frontmatter to database
 * Called on file modify (debounced)
 */
async function syncProjectsFromFrontmatter(plugin: EpistemePlugin, file: TFile): Promise<void> {
    const frontmatterService = plugin.flashcardManager.getFrontmatterService();

    // Get source note UID - only sync if note has a UID
    const sourceUid = await frontmatterService.getSourceNoteUid(file);
    if (!sourceUid) return;

    const store = plugin.cardStore;

    // Read current projects from frontmatter
    const content = await plugin.app.vault.read(file);
    const frontmatterProjects = frontmatterService.extractProjectsFromFrontmatter(content);

    // Get current projects from database
    const dbProjects = store.projects.getProjectNamesForNote(sourceUid);

    // Compare arrays (sorted for comparison)
    const fmSorted = [...frontmatterProjects].sort();
    const dbSorted = [...dbProjects].sort();
    const arraysEqual = fmSorted.length === dbSorted.length &&
        fmSorted.every((val, idx) => val === dbSorted[idx]);

    if (!arraysEqual) {
        // Sync projects to database
        store.projects.syncNoteProjects(sourceUid, frontmatterProjects);

        // Clean up empty projects
        store.projects.deleteEmptyProjects();
    }
}
