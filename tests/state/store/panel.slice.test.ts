import { describe, it, expect, beforeEach } from "vitest";
import { createTestStore } from "./test-helpers";
import type { AppStore } from "../../../src/state/store";

describe("Panel Slice", () => {
	let store: AppStore;

	beforeEach(() => {
		store = createTestStore();
	});

	describe("Initial State", () => {
		it("should have correct initial state", () => {
			const panel = store.getState().panel;
			expect(panel.status).toBe("none");
			expect(panel.viewMode).toBe("list");
			expect(panel.currentFile).toBeNull();
			expect(panel.flashcardInfo).toBeNull();
			expect(panel.error).toBeNull();
			expect(panel.selectionMode).toBe("normal");
			expect(panel.selectedCardIds.size).toBe(0);
		});
	});

	describe("setState", () => {
		it("should update partial state", () => {
			store.getState().panel.setState({
				status: "processing",
				userInstructions: "Test instructions",
			});

			const panel = store.getState().panel;
			expect(panel.status).toBe("processing");
			expect(panel.userInstructions).toBe("Test instructions");
		});
	});

	describe("reset", () => {
		it("should reset to initial state", () => {
			store.getState().panel.setState({
				status: "processing",
				userInstructions: "Test",
				searchQuery: "search",
			});

			store.getState().panel.reset();

			const panel = store.getState().panel;
			expect(panel.status).toBe("none");
			expect(panel.userInstructions).toBe("");
			expect(panel.searchQuery).toBe("");
		});
	});

	describe("Render Version", () => {
		it("should increment render version", () => {
			const initial = store.getState().panel.renderVersion;

			const newVersion = store.getState().panel.incrementRenderVersion();

			expect(newVersion).toBe(initial + 1);
			expect(store.getState().panel.renderVersion).toBe(initial + 1);
		});

		it("should check if current render", () => {
			const version = store.getState().panel.incrementRenderVersion();

			expect(store.getState().panel.isCurrentRender(version)).toBe(true);
			expect(store.getState().panel.isCurrentRender(version - 1)).toBe(false);
		});
	});

	describe("File Management", () => {
		it("should set current file and reset related state", () => {
			store.getState().panel.setState({
				status: "exists",
				flashcardInfo: { exists: true, cards: [] } as any,
			});

			const mockFile = { path: "/test/file.md" } as any;
			store.getState().panel.setCurrentFile(mockFile);

			const panel = store.getState().panel;
			expect(panel.currentFile).toBe(mockFile);
			expect(panel.status).toBe("none");
			expect(panel.flashcardInfo).toBeNull();
		});

		it("should check if file is current file", () => {
			const mockFile = { path: "/test/file.md" } as any;
			store.getState().panel.setCurrentFile(mockFile);

			expect(store.getState().panel.isCurrentFile(mockFile)).toBe(true);
			expect(store.getState().panel.isCurrentFile({ path: "/other.md" } as any)).toBe(false);
			expect(store.getState().panel.isCurrentFile(null)).toBe(false);
		});
	});

	describe("Status Management", () => {
		it("should set status", () => {
			store.getState().panel.setStatus("processing");
			expect(store.getState().panel.status).toBe("processing");
		});

		it("should start processing", () => {
			store.getState().panel.setState({ error: { message: "Error" } as any });

			store.getState().panel.startProcessing();

			const panel = store.getState().panel;
			expect(panel.status).toBe("processing");
			expect(panel.error).toBeNull();
		});

		it("should finish processing with flashcards", () => {
			store.getState().panel.startProcessing();

			store.getState().panel.finishProcessing(true);

			expect(store.getState().panel.status).toBe("exists");
		});

		it("should finish processing without flashcards", () => {
			store.getState().panel.startProcessing();

			store.getState().panel.finishProcessing(false);

			expect(store.getState().panel.status).toBe("none");
		});

		it("should check if processing", () => {
			expect(store.getState().panel.isProcessing()).toBe(false);

			store.getState().panel.startProcessing();

			expect(store.getState().panel.isProcessing()).toBe(true);
		});
	});

	describe("View Mode", () => {
		it("should set view mode", () => {
			store.getState().panel.setViewMode("list");
			expect(store.getState().panel.viewMode).toBe("list");
		});
	});

	describe("Flashcard Info", () => {
		it("should set flashcard info and update status", () => {
			const info = { exists: true, cards: [] } as any;

			store.getState().panel.setFlashcardInfo(info);

			const panel = store.getState().panel;
			expect(panel.flashcardInfo).toBe(info);
			expect(panel.status).toBe("exists");
		});

		it("should set status to none when no flashcards", () => {
			const info = { exists: false, cards: [] } as any;

			store.getState().panel.setFlashcardInfo(info);

			expect(store.getState().panel.status).toBe("none");
		});
	});

	describe("Error Handling", () => {
		it("should set error", () => {
			const error = { message: "Test error" } as any;

			store.getState().panel.setError(error);

			expect(store.getState().panel.error).toBe(error);
		});

		it("should reset status when error is cleared", () => {
			store.getState().panel.setState({ status: "processing" });
			store.getState().panel.setError(null);

			expect(store.getState().panel.status).toBe("processing");
		});
	});

	describe("Text Selection", () => {
		it("should set selected text", () => {
			store.getState().panel.setSelectedText("Selected content");

			const panel = store.getState().panel;
			expect(panel.selectedText).toBe("Selected content");
			expect(panel.hasSelection).toBe(true);
		});

		it("should clear selection", () => {
			store.getState().panel.setSelectedText("Some text");

			store.getState().panel.clearSelection();

			const panel = store.getState().panel;
			expect(panel.selectedText).toBe("");
			expect(panel.hasSelection).toBe(false);
		});

		it("should set hasSelection to false for empty text", () => {
			store.getState().panel.setSelectedText("");

			expect(store.getState().panel.hasSelection).toBe(false);
		});
	});

	describe("Uncollected Flashcards", () => {
		it("should set uncollected count", () => {
			store.getState().panel.setUncollectedInfo(5);

			expect(store.getState().panel.uncollectedCount).toBe(5);
		});

		it("should check if has uncollected flashcards", () => {
			expect(store.getState().panel.hasUncollectedFlashcards()).toBe(false);

			store.getState().panel.setUncollectedInfo(3);

			expect(store.getState().panel.hasUncollectedFlashcards()).toBe(true);
		});
	});

	describe("Selection Mode", () => {
		it("should enter selection mode", () => {
			store.getState().panel.enterSelectionMode();

			const panel = store.getState().panel;
			expect(panel.selectionMode).toBe("selecting");
			expect(panel.selectedCardIds.size).toBe(0);
		});

		it("should enter selection mode with initial card", () => {
			store.getState().panel.enterSelectionMode("card-1");

			const panel = store.getState().panel;
			expect(panel.selectionMode).toBe("selecting");
			expect(panel.selectedCardIds.has("card-1")).toBe(true);
		});

		it("should exit selection mode", () => {
			store.getState().panel.enterSelectionMode("card-1");

			store.getState().panel.exitSelectionMode();

			const panel = store.getState().panel;
			expect(panel.selectionMode).toBe("normal");
			expect(panel.selectedCardIds.size).toBe(0);
		});

		it("should check if in selection mode", () => {
			expect(store.getState().panel.isInSelectionMode()).toBe(false);

			store.getState().panel.enterSelectionMode();

			expect(store.getState().panel.isInSelectionMode()).toBe(true);
		});

		it("should toggle card selection", () => {
			store.getState().panel.enterSelectionMode();

			store.getState().panel.toggleCardSelection("card-1");
			expect(store.getState().panel.selectedCardIds.has("card-1")).toBe(true);

			store.getState().panel.toggleCardSelection("card-1");
			expect(store.getState().panel.selectedCardIds.has("card-1")).toBe(false);
		});
	});

	describe("Card Expansion", () => {
		it("should toggle card expanded state", () => {
			store.getState().panel.toggleCardExpanded("card-1");
			expect(store.getState().panel.expandedCardIds.has("card-1")).toBe(true);

			store.getState().panel.toggleCardExpanded("card-1");
			expect(store.getState().panel.expandedCardIds.has("card-1")).toBe(false);
		});
	});

	describe("Search", () => {
		it("should set search query", () => {
			store.getState().panel.setSearchQuery("test query");

			expect(store.getState().panel.searchQuery).toBe("test query");
		});
	});

	describe("Add Card Expansion", () => {
		it("should set add card expanded state", () => {
			store.getState().panel.setAddCardExpanded(true);
			expect(store.getState().panel.isAddCardExpanded).toBe(true);

			store.getState().panel.setAddCardExpanded(false);
			expect(store.getState().panel.isAddCardExpanded).toBe(false);
		});
	});

	describe("Review Follow State", () => {
		it("should set review follow state when active", () => {
			store.getState().panel.setReviewFollowState("/path/to/note.md", true);

			const panel = store.getState().panel;
			expect(panel.isFollowingReview).toBe(true);
			expect(panel.reviewSourceNotePath).toBe("/path/to/note.md");
		});

		it("should clear review follow state when inactive", () => {
			store.getState().panel.setReviewFollowState("/path/to/note.md", true);

			store.getState().panel.setReviewFollowState(null, false);

			const panel = store.getState().panel;
			expect(panel.isFollowingReview).toBe(false);
			expect(panel.reviewSourceNotePath).toBeNull();
		});

		it("should not follow when path is null even if active is true", () => {
			store.getState().panel.setReviewFollowState(null, true);

			const panel = store.getState().panel;
			expect(panel.isFollowingReview).toBe(false);
		});
	});

	describe("User Instructions", () => {
		it("should set user instructions", () => {
			store.getState().panel.setUserInstructions("Custom instructions");

			expect(store.getState().panel.userInstructions).toBe("Custom instructions");
		});
	});
});
