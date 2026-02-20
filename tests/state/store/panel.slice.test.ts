import { describe, it, expect, beforeEach } from "vitest";
import type { TFile } from "obsidian";
import { createTestStore } from "./test-helpers";
import type { AppStore } from "../../../src/shared/store";
import type { FlashcardInfo } from "../../../src/shared/types";
import type { AppError } from "../../../src/shared/errors";

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
				status: "exists",
			});

			const panel = store.getState().panel;
			expect(panel.status).toBe("exists");
		});
	});

	describe("reset", () => {
		it("should reset to initial state", () => {
			store.getState().panel.setState({
				status: "exists",
				searchQuery: "search",
			});

			store.getState().panel.reset();

			const panel = store.getState().panel;
			expect(panel.status).toBe("none");
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
				flashcardInfo: { exists: true, flashcards: [] } as FlashcardInfo,
			});

			// eslint-disable-next-line obsidianmd/no-tfile-tfolder-cast -- test mock
			const mockFile = { path: "/test/file.md" } as unknown as TFile;
			store.getState().panel.setCurrentFile(mockFile);

			const panel = store.getState().panel;
			expect(panel.currentFile).toBe(mockFile);
			expect(panel.status).toBe("none");
			expect(panel.flashcardInfo).toBeNull();
		});

		it("should check if file is current file", () => {
			// eslint-disable-next-line obsidianmd/no-tfile-tfolder-cast -- test mock
			const mockFile = { path: "/test/file.md" } as unknown as TFile;
			store.getState().panel.setCurrentFile(mockFile);

			expect(store.getState().panel.isCurrentFile(mockFile)).toBe(true);
			// eslint-disable-next-line obsidianmd/no-tfile-tfolder-cast -- test mock
			expect(store.getState().panel.isCurrentFile({ path: "/other.md" } as unknown as TFile)).toBe(false);
			expect(store.getState().panel.isCurrentFile(null)).toBe(false);
		});
	});

	describe("Status Management", () => {
		it("should set status", () => {
			store.getState().panel.setStatus("exists");
			expect(store.getState().panel.status).toBe("exists");
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
			const info = { exists: true, flashcards: [] } as FlashcardInfo;

			store.getState().panel.setFlashcardInfo(info);

			const panel = store.getState().panel;
			expect(panel.flashcardInfo).toBe(info);
			expect(panel.status).toBe("exists");
		});

		it("should set status to none when no flashcards", () => {
			const info = { exists: false, flashcards: [] } as FlashcardInfo;

			store.getState().panel.setFlashcardInfo(info);

			expect(store.getState().panel.status).toBe("none");
		});
	});

	describe("Error Handling", () => {
		it("should set error", () => {
			const error = { message: "Test error" } as AppError;

			store.getState().panel.setError(error);

			expect(store.getState().panel.error).toBe(error);
		});

		it("should reset status when error is cleared", () => {
			store.getState().panel.setState({ status: "exists" });
			store.getState().panel.setError(null);

			expect(store.getState().panel.status).toBe("exists");
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

});
