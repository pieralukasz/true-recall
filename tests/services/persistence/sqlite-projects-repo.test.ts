/**
 * Tests for SqliteProjectsRepo
 * Uses in-memory sql.js database for testing
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import initSqlJs, { type Database } from "sql.js";
import { SqliteProjectsRepo } from "../../../src/services/persistence/sqlite/SqliteProjectsRepo";

describe("SqliteProjectsRepo", () => {
	let db: Database;
	let repo: SqliteProjectsRepo;
	let onDataChange: ReturnType<typeof vi.fn>;

	beforeEach(async () => {
		// Initialize in-memory database
		const SQL = await initSqlJs();
		db = new SQL.Database();
		onDataChange = vi.fn();

		// Create required tables
		db.run(`
			CREATE TABLE source_notes (
				uid TEXT PRIMARY KEY,
				note_name TEXT NOT NULL,
				note_path TEXT,
				created_at INTEGER,
				updated_at INTEGER
			);

			CREATE TABLE projects (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				name TEXT UNIQUE NOT NULL,
				created_at INTEGER,
				updated_at INTEGER
			);

			CREATE TABLE note_projects (
				source_uid TEXT NOT NULL,
				project_id INTEGER NOT NULL,
				created_at INTEGER,
				PRIMARY KEY (source_uid, project_id),
				FOREIGN KEY (source_uid) REFERENCES source_notes(uid) ON DELETE CASCADE,
				FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
			);

			CREATE TABLE cards (
				id TEXT PRIMARY KEY,
				due TEXT NOT NULL,
				stability REAL DEFAULT 0,
				difficulty REAL DEFAULT 0,
				reps INTEGER DEFAULT 0,
				lapses INTEGER DEFAULT 0,
				state INTEGER DEFAULT 0,
				last_review TEXT,
				scheduled_days INTEGER DEFAULT 0,
				learning_step INTEGER DEFAULT 0,
				suspended INTEGER DEFAULT 0,
				buried_until TEXT,
				created_at INTEGER,
				updated_at INTEGER,
				question TEXT,
				answer TEXT,
				source_uid TEXT,
				tags TEXT
			);

			CREATE INDEX idx_note_projects_source ON note_projects(source_uid);
			CREATE INDEX idx_note_projects_project ON note_projects(project_id);
		`);

		repo = new SqliteProjectsRepo(db, onDataChange);
	});

	// Helper to insert a source note
	function insertSourceNote(uid: string, name: string = "Test Note") {
		db.run(
			`INSERT INTO source_notes (uid, note_name, note_path, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?)`,
			[uid, name, `notes/${name}.md`, Date.now(), Date.now()]
		);
	}

	describe("createProject", () => {
		it("creates new project and returns its ID", () => {
			const id = repo.createProject("My Project");

			expect(id).toBe(1);
			expect(onDataChange).toHaveBeenCalled();

			const project = repo.getProjectByName("My Project");
			expect(project).not.toBeNull();
			expect(project!.name).toBe("My Project");
		});

		it("returns existing ID if project already exists", () => {
			const id1 = repo.createProject("Existing Project");
			const id2 = repo.createProject("Existing Project");

			expect(id1).toBe(id2);
		});

		it("creates multiple projects with different IDs", () => {
			const id1 = repo.createProject("Project A");
			const id2 = repo.createProject("Project B");
			const id3 = repo.createProject("Project C");

			expect(id1).toBe(1);
			expect(id2).toBe(2);
			expect(id3).toBe(3);
		});
	});

	describe("syncNoteProjects", () => {
		beforeEach(() => {
			insertSourceNote("note-1", "Note One");
			insertSourceNote("note-2", "Note Two");
		});

		it("creates projects that don't exist", () => {
			repo.syncNoteProjects("note-1", ["New Project A", "New Project B"]);

			const allProjects = repo.getAllProjects();
			expect(allProjects).toHaveLength(2);
			expect(allProjects.map(p => p.name).sort()).toEqual(["New Project A", "New Project B"]);
		});

		it("replaces all existing associations", () => {
			// First sync
			repo.syncNoteProjects("note-1", ["Project A", "Project B"]);
			let projects = repo.getProjectNamesForNote("note-1");
			expect(projects.sort()).toEqual(["Project A", "Project B"]);

			// Second sync - should replace
			repo.syncNoteProjects("note-1", ["Project C"]);
			projects = repo.getProjectNamesForNote("note-1");
			expect(projects).toEqual(["Project C"]);
		});

		it("handles empty array - removes all associations", () => {
			repo.syncNoteProjects("note-1", ["Project A", "Project B"]);
			expect(repo.getProjectNamesForNote("note-1")).toHaveLength(2);

			repo.syncNoteProjects("note-1", []);
			expect(repo.getProjectNamesForNote("note-1")).toHaveLength(0);
		});

		it("does not affect other notes", () => {
			repo.syncNoteProjects("note-1", ["Project A"]);
			repo.syncNoteProjects("note-2", ["Project B"]);

			// Update note-1
			repo.syncNoteProjects("note-1", ["Project C"]);

			// note-2 should be unchanged
			expect(repo.getProjectNamesForNote("note-2")).toEqual(["Project B"]);
		});

		it("reuses existing projects when syncing", () => {
			repo.syncNoteProjects("note-1", ["Shared Project"]);
			repo.syncNoteProjects("note-2", ["Shared Project"]);

			// Should only have one project
			const allProjects = repo.getAllProjects();
			expect(allProjects).toHaveLength(1);

			// Both notes should be associated with it
			const project = allProjects[0]!;
			const notesInProject = repo.getNotesInProject(project.id);
			expect(notesInProject.sort()).toEqual(["note-1", "note-2"]);
		});

		it("trims whitespace from project names", () => {
			repo.syncNoteProjects("note-1", ["  Project A  ", "  Project B  "]);

			const projects = repo.getProjectNamesForNote("note-1");
			expect(projects.sort()).toEqual(["Project A", "Project B"]);
		});

		it("ignores empty project names", () => {
			repo.syncNoteProjects("note-1", ["Project A", "", "  ", "Project B"]);

			const projects = repo.getProjectNamesForNote("note-1");
			expect(projects.sort()).toEqual(["Project A", "Project B"]);
		});
	});

	describe("deleteEmptyProjects", () => {
		beforeEach(() => {
			insertSourceNote("note-1", "Note One");
			insertSourceNote("note-2", "Note Two");
		});

		it("deletes projects with no notes", () => {
			// Create project with note, then unlink
			repo.syncNoteProjects("note-1", ["Project A"]);
			repo.syncNoteProjects("note-1", []); // Unlink - project becomes orphan

			const deletedCount = repo.deleteEmptyProjects();

			expect(deletedCount).toBe(1);
			expect(repo.getProjectByName("Project A")).toBeNull();
			expect(onDataChange).toHaveBeenCalled();
		});

		it("keeps projects that have notes", () => {
			repo.syncNoteProjects("note-1", ["Project A"]);

			const deletedCount = repo.deleteEmptyProjects();

			expect(deletedCount).toBe(0);
			expect(repo.getProjectByName("Project A")).not.toBeNull();
		});

		it("returns count of deleted projects", () => {
			// Create 3 projects, unlink all
			repo.syncNoteProjects("note-1", ["Project A", "Project B", "Project C"]);
			repo.syncNoteProjects("note-1", []);

			const deletedCount = repo.deleteEmptyProjects();

			expect(deletedCount).toBe(3);
		});

		it("handles mixed scenario - some empty, some not", () => {
			// note-1 has Project A
			repo.syncNoteProjects("note-1", ["Project A", "Project B"]);
			// Remove only Project B from note-1
			repo.syncNoteProjects("note-1", ["Project A"]);

			const deletedCount = repo.deleteEmptyProjects();

			expect(deletedCount).toBe(1);
			expect(repo.getProjectByName("Project A")).not.toBeNull();
			expect(repo.getProjectByName("Project B")).toBeNull();
		});

		it("does not call onDataChange if no projects deleted", () => {
			repo.syncNoteProjects("note-1", ["Project A"]);
			onDataChange.mockClear();

			const deletedCount = repo.deleteEmptyProjects();

			expect(deletedCount).toBe(0);
			expect(onDataChange).not.toHaveBeenCalled();
		});
	});

	describe("getProjectNamesForNote", () => {
		beforeEach(() => {
			insertSourceNote("note-1", "Note One");
		});

		it("returns empty array for note with no projects", () => {
			const names = repo.getProjectNamesForNote("note-1");
			expect(names).toEqual([]);
		});

		it("returns project names in alphabetical order", () => {
			repo.syncNoteProjects("note-1", ["Zebra", "Apple", "Mango"]);

			const names = repo.getProjectNamesForNote("note-1");

			expect(names).toEqual(["Apple", "Mango", "Zebra"]);
		});

		it("returns empty array for non-existent note", () => {
			const names = repo.getProjectNamesForNote("does-not-exist");
			expect(names).toEqual([]);
		});
	});

	describe("getProjectsForNote", () => {
		beforeEach(() => {
			insertSourceNote("note-1", "Note One");
		});

		it("returns full project info objects", () => {
			repo.syncNoteProjects("note-1", ["Project A"]);

			const projects = repo.getProjectsForNote("note-1");

			expect(projects).toHaveLength(1);
			expect(projects[0]).toMatchObject({
				name: "Project A",
			});
			expect(projects[0]!.id).toBeDefined();
		});
	});

	describe("addProjectToNote and removeProjectFromNote", () => {
		beforeEach(() => {
			insertSourceNote("note-1", "Note One");
		});

		it("adds project to note", () => {
			repo.addProjectToNote("note-1", "New Project");

			const names = repo.getProjectNamesForNote("note-1");
			expect(names).toContain("New Project");
		});

		it("removes project from note", () => {
			repo.syncNoteProjects("note-1", ["Project A", "Project B"]);
			const projectA = repo.getProjectByName("Project A")!;

			repo.removeProjectFromNote("note-1", projectA.id);

			const names = repo.getProjectNamesForNote("note-1");
			expect(names).toEqual(["Project B"]);
		});
	});

	describe("getAllProjects", () => {
		it("returns empty array when no projects", () => {
			expect(repo.getAllProjects()).toEqual([]);
		});

		it("returns all projects sorted by name", () => {
			repo.createProject("Zebra");
			repo.createProject("Apple");
			repo.createProject("Mango");

			const projects = repo.getAllProjects();

			expect(projects.map(p => p.name)).toEqual(["Apple", "Mango", "Zebra"]);
		});
	});

	describe("deleteProject", () => {
		beforeEach(() => {
			insertSourceNote("note-1", "Note One");
		});

		it("deletes project", () => {
			const id = repo.createProject("To Delete");

			repo.deleteProject(id);

			expect(repo.getProjectById(id)).toBeNull();
		});

		it("cascade deletes note associations", () => {
			repo.syncNoteProjects("note-1", ["Project A"]);
			const project = repo.getProjectByName("Project A")!;

			repo.deleteProject(project.id);

			// Note should have no projects now
			expect(repo.getProjectNamesForNote("note-1")).toEqual([]);
		});
	});

	describe("renameProject", () => {
		it("renames project", () => {
			const id = repo.createProject("Old Name");

			repo.renameProject(id, "New Name");

			expect(repo.getProjectByName("Old Name")).toBeNull();
			expect(repo.getProjectByName("New Name")).not.toBeNull();
			expect(repo.getProjectById(id)!.name).toBe("New Name");
		});
	});
});
