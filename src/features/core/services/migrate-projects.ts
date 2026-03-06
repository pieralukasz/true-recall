import type { App } from "obsidian";
import { Notice, TFile } from "obsidian";

interface MigrationPlan {
	/** project note path → array of member note paths */
	projectMembers: Map<string, string[]>;
	totalProjects: number;
	totalMembers: number;
}

interface MigrationResult {
	notesUpdated: number;
	projectsCleaned: number;
	errors: string[];
}

function buildMigrationPlan(app: App): MigrationPlan {
	const projectMembers = new Map<string, string[]>();
	const resolvedLinks = app.metadataCache.resolvedLinks;

	for (const file of app.vault.getMarkdownFiles()) {
		const cache = app.metadataCache.getFileCache(file);
		const fm = cache?.frontmatter;
		if (fm?.project !== true && fm?.project !== "true") continue;

		const links = resolvedLinks[file.path];
		if (!links) {
			projectMembers.set(file.path, []);
			continue;
		}

		const members: string[] = [];
		for (const targetPath of Object.keys(links)) {
			if (targetPath === file.path) continue;
			if (!targetPath.endsWith(".md")) continue;
			if (!app.vault.getAbstractFileByPath(targetPath)) continue;
			members.push(targetPath);
		}
		projectMembers.set(file.path, members);
	}

	let totalMembers = 0;
	for (const members of projectMembers.values()) {
		totalMembers += members.length;
	}

	return {
		projectMembers,
		totalProjects: projectMembers.size,
		totalMembers,
	};
}

async function executeMigration(
	app: App,
	plan: MigrationPlan,
): Promise<MigrationResult> {
	const result: MigrationResult = {
		notesUpdated: 0,
		projectsCleaned: 0,
		errors: [],
	};

	// Collect all parent additions: notePath → Set<projectBasename>
	const additions = new Map<string, Set<string>>();
	for (const [projectPath, memberPaths] of plan.projectMembers) {
		const projectFile = app.vault.getAbstractFileByPath(projectPath);
		if (!projectFile || !(projectFile instanceof TFile)) continue;
		const projectName = projectFile.basename;

		for (const memberPath of memberPaths) {
			if (!additions.has(memberPath)) additions.set(memberPath, new Set());
			additions.get(memberPath)?.add(projectName);
		}
	}

	// Add parents to member notes
	for (const [notePath, parentNames] of additions) {
		const file = app.vault.getAbstractFileByPath(notePath);
		if (!file || !(file instanceof TFile)) continue;

		try {
			await app.fileManager.processFrontMatter(
				file,
				(fm: Record<string, unknown>) => {
					const existing: string[] = Array.isArray(fm.parents)
						? (fm.parents as string[])
						: [];

					// Strip [[]] for deduplication check
					const existingNames = new Set(
						existing.map((p) => p.replace(/^\[\[/, "").replace(/\]\]$/, "")),
					);

					for (const name of parentNames) {
						if (!existingNames.has(name)) {
							existing.push(`[[${name}]]`);
						}
					}

					fm.parents = existing;
				},
			);
			result.notesUpdated++;
		} catch (e) {
			result.errors.push(`Update ${notePath}: ${e}`);
		}
	}

	// Remove project: true from project notes
	for (const projectPath of plan.projectMembers.keys()) {
		const file = app.vault.getAbstractFileByPath(projectPath);
		if (!file || !(file instanceof TFile)) continue;

		try {
			await app.fileManager.processFrontMatter(
				file,
				(fm: Record<string, unknown>) => {
					delete fm.project;
				},
			);
			result.projectsCleaned++;
		} catch (e) {
			result.errors.push(`Clean ${projectPath}: ${e}`);
		}
	}

	return result;
}

export async function migrateLegacyProjects(app: App): Promise<void> {
	const plan = buildMigrationPlan(app);

	if (plan.totalProjects === 0) {
		new Notice("No legacy projects found (no notes with project: true).");
		return;
	}

	new Notice(
		`Migrating ${plan.totalProjects} project(s), ${plan.totalMembers} member note(s)...`,
	);

	const result = await executeMigration(app, plan);

	const parts = [
		`Migration complete: ${result.notesUpdated} notes updated`,
		`${result.projectsCleaned} project notes cleaned`,
	];
	if (result.errors.length > 0) {
		parts.push(`${result.errors.length} error(s)`);
		console.error("[MigrateProjects] Errors:", result.errors);
	}
	new Notice(`${parts.join(", ")}.`);
}
