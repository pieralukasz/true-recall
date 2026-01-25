/**
 * Tests for PanelStateManager
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { PanelStateManager, createPanelStateManager } from "../../src/state/panel.state";
import type { TFile } from "obsidian";
import type { FlashcardInfo, DiffResult } from "../../src/types";
import type { AppError } from "../../src/errors";

// Mock TFile
function createMockFile(name: string, path?: string): TFile {
    return {
        basename: name,
        path: path ?? `notes/${name}.md`,
        extension: "md",
        stat: { mtime: Date.now(), ctime: Date.now(), size: 100 },
        vault: {} as TFile["vault"],
        name: `${name}.md`,
        parent: null,
    } as TFile;
}

// Mock FlashcardInfo
function createMockFlashcardInfo(exists: boolean = true): FlashcardInfo {
    return {
        exists,
        filePath: "flashcards/flashcards_test.md",
        cardCount: exists ? 3 : 0,
        questions: exists ? ["Q1", "Q2", "Q3"] : [],
        flashcards: exists ? [
            { question: "Q1", answer: "A1", lineNumber: 1 },
            { question: "Q2", answer: "A2", lineNumber: 5 },
            { question: "Q3", answer: "A3", lineNumber: 9 },
        ] : [],
        lastModified: exists ? Date.now() : null,
    };
}

// Mock DiffResult
function createMockDiffResult(): DiffResult {
    return {
        changes: [
            { type: "NEW", question: "New Q", answer: "New A", accepted: true },
            { type: "MODIFIED", question: "Modified Q", answer: "Modified A", originalQuestion: "Old Q", accepted: false },
        ],
        existingFlashcards: [],
    };
}

describe("PanelStateManager", () => {
    let stateManager: PanelStateManager;

    beforeEach(() => {
        stateManager = createPanelStateManager();
    });

    describe("initialization", () => {
        it("should create with initial state", () => {
            const state = stateManager.getState();

            expect(state.status).toBe("none");
            expect(state.viewMode).toBe("list");
            expect(state.currentFile).toBeNull();
            expect(state.flashcardInfo).toBeNull();
            expect(state.diffResult).toBeNull();
            expect(state.userInstructions).toBe("");
            expect(state.isFlashcardFile).toBe(false);
            expect(state.error).toBeNull();
            expect(state.renderVersion).toBe(0);
        });

        it("should return immutable state copy", () => {
            const state1 = stateManager.getState();
            const state2 = stateManager.getState();

            expect(state1).not.toBe(state2);
            expect(state1).toEqual(state2);
        });
    });

    describe("setState", () => {
        it("should update partial state", () => {
            stateManager.setState({ status: "processing" });

            expect(stateManager.getState().status).toBe("processing");
            expect(stateManager.getState().viewMode).toBe("list"); // unchanged
        });

        it("should notify listeners on state change", () => {
            const listener = vi.fn();
            stateManager.subscribe(listener);

            stateManager.setState({ status: "exists" });

            expect(listener).toHaveBeenCalledTimes(1);
            expect(listener).toHaveBeenCalledWith(
                expect.objectContaining({ status: "exists" }),
                expect.objectContaining({ status: "none" })
            );
        });

        it("should support multiple partial updates", () => {
            stateManager.setState({ status: "processing" });
            stateManager.setState({ userInstructions: "Test instructions" });

            const state = stateManager.getState();
            expect(state.status).toBe("processing");
            expect(state.userInstructions).toBe("Test instructions");
        });
    });

    describe("subscribe", () => {
        it("should subscribe and unsubscribe listeners", () => {
            const listener = vi.fn();
            const unsubscribe = stateManager.subscribe(listener);

            stateManager.setState({ status: "processing" });
            expect(listener).toHaveBeenCalledTimes(1);

            unsubscribe();
            stateManager.setState({ status: "exists" });
            expect(listener).toHaveBeenCalledTimes(1); // not called again
        });

        it("should support multiple listeners", () => {
            const listener1 = vi.fn();
            const listener2 = vi.fn();

            stateManager.subscribe(listener1);
            stateManager.subscribe(listener2);

            stateManager.setState({ status: "processing" });

            expect(listener1).toHaveBeenCalledTimes(1);
            expect(listener2).toHaveBeenCalledTimes(1);
        });

        it("should handle listener errors gracefully", () => {
            const errorListener = vi.fn(() => {
                throw new Error("Listener error");
            });
            const normalListener = vi.fn();
            const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

            stateManager.subscribe(errorListener);
            stateManager.subscribe(normalListener);

            stateManager.setState({ status: "processing" });

            // Both listeners were called despite error
            expect(errorListener).toHaveBeenCalledTimes(1);
            expect(normalListener).toHaveBeenCalledTimes(1);
            expect(consoleSpy).toHaveBeenCalled();

            consoleSpy.mockRestore();
        });
    });

    describe("subscribeToSelector", () => {
        it("should only notify when selected value changes", () => {
            const listener = vi.fn();
            stateManager.subscribeToSelector(
                (state) => state.status,
                listener
            );

            // Change status
            stateManager.setState({ status: "processing" });
            expect(listener).toHaveBeenCalledTimes(1);
            expect(listener).toHaveBeenCalledWith("processing", "none");

            // Change something else
            stateManager.setState({ userInstructions: "test" });
            expect(listener).toHaveBeenCalledTimes(1); // not called

            // Change status again
            stateManager.setState({ status: "exists" });
            expect(listener).toHaveBeenCalledTimes(2);
            expect(listener).toHaveBeenLastCalledWith("exists", "processing");
        });
    });

    describe("reset", () => {
        it("should reset to initial state", () => {
            stateManager.setState({
                status: "processing",
                userInstructions: "test",
                viewMode: "diff",
            });

            stateManager.reset();

            const state = stateManager.getState();
            expect(state.status).toBe("none");
            expect(state.userInstructions).toBe("");
            expect(state.viewMode).toBe("list");
        });

        it("should notify listeners on reset", () => {
            const listener = vi.fn();
            stateManager.subscribe(listener);

            stateManager.setState({ status: "processing" });
            listener.mockClear();

            stateManager.reset();
            expect(listener).toHaveBeenCalledTimes(1);
        });
    });

    describe("renderVersion", () => {
        it("should increment render version", () => {
            expect(stateManager.getState().renderVersion).toBe(0);

            const v1 = stateManager.incrementRenderVersion();
            expect(v1).toBe(1);
            expect(stateManager.getState().renderVersion).toBe(1);

            const v2 = stateManager.incrementRenderVersion();
            expect(v2).toBe(2);
        });

        it("should check current render version", () => {
            stateManager.incrementRenderVersion();
            stateManager.incrementRenderVersion();

            expect(stateManager.isCurrentRender(2)).toBe(true);
            expect(stateManager.isCurrentRender(1)).toBe(false);
            expect(stateManager.isCurrentRender(0)).toBe(false);
        });
    });

    describe("convenience methods", () => {
        describe("setCurrentFile", () => {
            it("should set file and reset related state", () => {
                const file = createMockFile("test-note");

                // Set some state first
                stateManager.setState({
                    status: "exists",
                    viewMode: "diff",
                    diffResult: createMockDiffResult(),
                });

                stateManager.setCurrentFile(file);

                const state = stateManager.getState();
                expect(state.currentFile).toBe(file);
                expect(state.status).toBe("none");
                expect(state.viewMode).toBe("list");
                expect(state.diffResult).toBeNull();
                expect(state.isFlashcardFile).toBe(false);
            });

            it("should not detect flashcard files (legacy - SQL-only storage)", () => {
                // Note: isFlashcardFile is always false since migration to SQL-only storage
                // Flashcard MD files no longer exist - all content is in SQLite
                const flashcardFile = createMockFile("flashcards_test");
                stateManager.setCurrentFile(flashcardFile);

                expect(stateManager.getState().isFlashcardFile).toBe(false);
            });

            it("should handle null file", () => {
                stateManager.setCurrentFile(createMockFile("test"));
                stateManager.setCurrentFile(null);

                const state = stateManager.getState();
                expect(state.currentFile).toBeNull();
                expect(state.isFlashcardFile).toBe(false);
            });
        });

        describe("setFlashcardInfo", () => {
            it("should set flashcard info and update status", () => {
                const info = createMockFlashcardInfo(true);
                stateManager.setFlashcardInfo(info);

                const state = stateManager.getState();
                expect(state.flashcardInfo).toBe(info);
                expect(state.status).toBe("exists");
            });

            it("should set status to none when no flashcards exist", () => {
                const info = createMockFlashcardInfo(false);
                stateManager.setFlashcardInfo(info);

                expect(stateManager.getState().status).toBe("none");
            });
        });

        describe("setDiffResult", () => {
            it("should set diff result and switch to diff mode", () => {
                const diff = createMockDiffResult();
                stateManager.setDiffResult(diff);

                const state = stateManager.getState();
                expect(state.diffResult).toBe(diff);
                expect(state.viewMode).toBe("diff");
                expect(state.status).toBe("exists");
            });

            it("should clear diff and return to list mode", () => {
                stateManager.setDiffResult(createMockDiffResult());
                stateManager.setDiffResult(null);

                const state = stateManager.getState();
                expect(state.diffResult).toBeNull();
                expect(state.viewMode).toBe("list");
            });
        });

        describe("processing methods", () => {
            it("should start processing", () => {
                stateManager.startProcessing();

                const state = stateManager.getState();
                expect(state.status).toBe("processing");
                expect(state.error).toBeNull();
            });

            it("should finish processing with flashcards", () => {
                stateManager.startProcessing();
                stateManager.finishProcessing(true);

                expect(stateManager.getState().status).toBe("exists");
            });

            it("should finish processing without flashcards", () => {
                stateManager.startProcessing();
                stateManager.finishProcessing(false);

                expect(stateManager.getState().status).toBe("none");
            });
        });

        describe("setError", () => {
            it("should set error and reset status", () => {
                stateManager.setState({ status: "processing" });

                const error = { message: "Test error", code: "TEST" } as AppError;
                stateManager.setError(error);

                const state = stateManager.getState();
                expect(state.error).toBe(error);
                expect(state.status).toBe("none");
            });

            it("should clear error", () => {
                stateManager.setState({ status: "exists" });
                stateManager.setError({ message: "Error" } as AppError);
                stateManager.setError(null);

                const state = stateManager.getState();
                expect(state.error).toBeNull();
            });
        });

        describe("helper checks", () => {
            it("should check current file match", () => {
                const file1 = createMockFile("test1", "path/test1.md");
                const file2 = createMockFile("test2", "path/test2.md");

                stateManager.setCurrentFile(file1);

                expect(stateManager.isCurrentFile(file1)).toBe(true);
                expect(stateManager.isCurrentFile(file2)).toBe(false);
                expect(stateManager.isCurrentFile(null)).toBe(false);
            });

            it("should check if processing", () => {
                expect(stateManager.isProcessing()).toBe(false);

                stateManager.startProcessing();
                expect(stateManager.isProcessing()).toBe(true);

                stateManager.finishProcessing();
                expect(stateManager.isProcessing()).toBe(false);
            });

            it("should check if in diff mode", () => {
                expect(stateManager.isInDiffMode()).toBe(false);

                stateManager.setDiffResult(createMockDiffResult());
                expect(stateManager.isInDiffMode()).toBe(true);

                stateManager.clearDiff();
                expect(stateManager.isInDiffMode()).toBe(false);
            });
        });

        describe("clearDiff", () => {
            it("should clear diff and return to list mode", () => {
                stateManager.setDiffResult(createMockDiffResult());
                stateManager.clearDiff();

                const state = stateManager.getState();
                expect(state.diffResult).toBeNull();
                expect(state.viewMode).toBe("list");
            });
        });
    });
});

describe("createPanelStateManager", () => {
    it("should create a new PanelStateManager instance", () => {
        const manager = createPanelStateManager();
        expect(manager).toBeInstanceOf(PanelStateManager);
    });
});
