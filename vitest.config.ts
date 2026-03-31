import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

const root = __dirname;
const coreDir = resolve(root, "packages/core/src");
const obsidianDir = resolve(root, "packages/obsidian/src");
const mocks = resolve(root, "tests/__mocks__");

export default defineConfig({
	resolve: {
		alias: [
			// @true-recall package aliases (used internally by packages)
			{ find: /^@true-recall\/core\/(.+)$/, replacement: `${coreDir}/$1` },
			{ find: "@true-recall/core", replacement: coreDir },
			{
				find: /^@true-recall\/obsidian\/(.+)$/,
				replacement: `${obsidianDir}/$1`,
			},
			{ find: "@true-recall/obsidian", replacement: obsidianDir },

			// Test mocks
			{ find: "obsidian", replacement: `${mocks}/obsidian.ts` },
			{
				find: "@sqlite.org/sqlite-wasm/sqlite3.wasm",
				replacement: `${mocks}/sqlite3.wasm.ts`,
			},
			{
				find: "@sqlite.org/sqlite-wasm",
				replacement: `${mocks}/sqlite-wasm.ts`,
			},
			{ find: "types", replacement: `${coreDir}/types/index.ts` },

			// ── Old @features / @shared aliases (mapped to new monorepo) ────────
			// Specific overrides before the general fallback
			{
				find: "@features/metrics/ui/stats/helpers/forecast-filter",
				replacement: `${coreDir}/metrics/forecast-filter`,
			},
			// @shared — specific overrides
			{ find: "@shared/store", replacement: `${obsidianDir}/store` },
			{
				find: /^@shared\/services\/(.+)$/,
				replacement: `${obsidianDir}/services/$1`,
			},
			{
				find: /^@shared\/types\/(.+)$/,
				replacement: `${coreDir}/types/$1`,
			},
			{ find: "@shared/types", replacement: `${coreDir}/types` },
			{
				find: /^@shared\/(.+)$/,
				replacement: `${coreDir}/$1`,
			},
			// @features fallback — most features live in obsidian
			{
				find: /^@features\/(.+)$/,
				replacement: `${obsidianDir}/features/$1`,
			},

			// ── UI helpers that moved to core/helpers/ ────────────────────────
			{
				find: /^.*\/src\/features\/study\/ui\/dashboard\/helpers\/note-priority$/,
				replacement: `${coreDir}/helpers/note-priority`,
			},
			{
				find: /^.*\/src\/features\/study\/ui\/dashboard\/helpers\/time-estimate$/,
				replacement: `${coreDir}/helpers/time-estimate`,
			},
			{
				find: /^.*\/src\/features\/study\/ui\/review\/helpers\/answer-assessment$/,
				replacement: `${coreDir}/helpers/answer-assessment`,
			},
			{
				find: /^.*\/src\/features\/study\/ui\/review\/helpers\/leech-helpers$/,
				replacement: `${coreDir}/helpers/leech-helpers`,
			},
			// signals moved from src/shared/services/ to obsidian/services/
			{
				find: /^.*\/src\/shared\/services\/signals$/,
				replacement: `${obsidianDir}/services/signals`,
			},

			// ── Already partially migrated but with wrong internal paths ──────
			{
				find: /^.*packages\/core\/src\/integration\/anki-scheduling\.service$/,
				replacement: `${coreDir}/integration/anki/anki-scheduling.service`,
			},
			{
				find: /^.*packages\/core\/src\/integration\/anki-converter\.service$/,
				replacement: `${coreDir}/integration/anki/anki-converter.service`,
			},
			{
				find: /^.*packages\/core\/src\/integration\/anki-note-type-mapper$/,
				replacement: `${coreDir}/integration/anki/anki-note-type-mapper`,
			},
			{
				find: /^.*packages\/core\/src\/rag\/rag-search\.service$/,
				replacement: `${coreDir}/rag/retrieval/rag-search.service`,
			},
			{
				find: /^.*packages\/core\/src\/rag\/rag-chunker\.service$/,
				replacement: `${coreDir}/rag/ingestion/rag-chunker.service`,
			},

			// ── src/features/core ─────────────────────────────────────────────
			// Persistence — individual service moved into session/ subdirectory
			{
				find: /^.*\/src\/features\/core\/persistence\/session-persistence\.service$/,
				replacement: `${coreDir}/persistence/session/session-persistence.service`,
			},
			// Persistence — sqlite subtree (structure preserved)
			{
				find: /^.*\/src\/features\/core\/persistence\/sqlite\/(.+)$/,
				replacement: `${coreDir}/persistence/sqlite/$1`,
			},
			{
				find: /^.*\/src\/features\/core\/persistence\/sqlite$/,
				replacement: `${coreDir}/persistence/sqlite`,
			},
			// Core services — each moved to a typed subdirectory
			{
				find: /^.*\/src\/features\/core\/services\/fsrs\.service$/,
				replacement: `${coreDir}/services/fsrs/fsrs.service`,
			},
			{
				find: /^.*\/src\/features\/core\/services\/hierarchy\.service$/,
				replacement: `${coreDir}/services/notes/hierarchy.service`,
			},
			{
				find: /^.*\/src\/features\/core\/services\/day-boundary\.service$/,
				replacement: `${coreDir}/services/review/day-boundary.service`,
			},
			{
				find: /^.*\/src\/features\/core\/services\/frontmatter-index\.service$/,
				replacement: `${coreDir}/services/notes/frontmatter-index.service`,
			},
			{
				find: /^.*\/src\/features\/core\/services\/card-generation\.service$/,
				replacement: `${coreDir}/services/cards/card-generation.service`,
			},
			{
				find: /^.*\/src\/features\/core\/services\/note-type\.service$/,
				replacement: `${coreDir}/services/notes/note-type.service`,
			},
			{
				find: /^.*\/src\/features\/core\/services\/preset\.service$/,
				replacement: `${coreDir}/services/notes/preset.service`,
			},
			{
				find: /^.*\/src\/features\/core\/services\/template-engine$/,
				replacement: `${coreDir}/services/cards/template-engine`,
			},

			// ── src/features/study ────────────────────────────────────────────
			// Flashcard services moved to core
			{
				find: /^.*\/src\/features\/study\/services\/flashcard\/block-parser\.service$/,
				replacement: `${coreDir}/flashcard/parsing/block-parser.service`,
			},
			{
				find: /^.*\/src\/features\/study\/services\/flashcard\/cloze-parser\.service$/,
				replacement: `${coreDir}/flashcard/parsing/cloze-parser.service`,
			},
			{
				find: /^.*\/src\/features\/study\/services\/flashcard\/bulk-card-parser$/,
				replacement: `${coreDir}/flashcard/parsing/bulk-card-parser`,
			},
			{
				find: /^.*\/src\/features\/study\/services\/flashcard\/collect\.service$/,
				replacement: `${coreDir}/flashcard/lifecycle/collect.service`,
			},
			{
				find: /^.*\/src\/features\/study\/services\/flashcard\/flashcard\.service$/,
				replacement: `${coreDir}/flashcard/flashcard.service`,
			},
			{
				find: /^.*\/src\/features\/study\/services\/flashcard\/migration\.service$/,
				replacement: `${coreDir}/flashcard/lifecycle/migration.service`,
			},
			{
				find: /^.*\/src\/features\/study\/services\/flashcard\/card-repository\.service$/,
				replacement: `${coreDir}/flashcard/data/card-repository.service`,
			},
			{
				find: /^.*\/src\/features\/study\/services\/review\.service$/,
				replacement: `${coreDir}/services/review/review.service`,
			},
			{
				find: /^.*\/src\/features\/study\/services\/actionable-session-snapshot\.service$/,
				replacement: `${coreDir}/services/review/actionable-session-snapshot.service`,
			},
			// Study UI editor widgets moved under editor/study/
			{
				find: /^.*\/src\/features\/study\/ui\/editor\/widgets\/project-stats$/,
				replacement: `${obsidianDir}/editor/study/widgets/project-stats`,
			},
			{
				find: /^.*\/src\/features\/study\/ui\/editor\/widgets\/StatusBarWidget$/,
				replacement: `${obsidianDir}/editor/study/widgets/StatusBarWidget`,
			},
			// Study UI subtrees (structure preserved in obsidian)
			{
				find: /^.*\/src\/features\/study\/ui\/dashboard\/(.+)$/,
				replacement: `${obsidianDir}/features/study/ui/dashboard/$1`,
			},
			{
				find: /^.*\/src\/features\/study\/ui\/review\/(.+)$/,
				replacement: `${obsidianDir}/features/study/ui/review/$1`,
			},

			// ── src/features/library ──────────────────────────────────────────
			// query-builder and search-parser moved to core
			{
				find: /^.*\/src\/features\/library\/ui\/browser\/helpers\/query-builder$/,
				replacement: `${coreDir}/services/browser/browser-query-builder`,
			},
			{
				find: /^.*\/src\/features\/library\/ui\/browser\/helpers\/search-parser$/,
				replacement: `${coreDir}/helpers/search-parser`,
			},
			// Library UI subtrees (structure preserved in obsidian)
			{
				find: /^.*\/src\/features\/library\/ui\/browser\/(.+)$/,
				replacement: `${obsidianDir}/features/library/ui/browser/$1`,
			},
			{
				find: /^.*\/src\/features\/library\/ui\/panel\/(.+)$/,
				replacement: `${obsidianDir}/features/library/ui/panel/$1`,
			},
			{
				find: /^.*\/src\/features\/library\/services\/card-browser-query\.service$/,
				replacement: `${coreDir}/services/browser/card-browser-query.service`,
			},

			// ── src/features/metrics ──────────────────────────────────────────
			{
				find: /^.*\/src\/features\/metrics\/services\/fsrs-tools\/(.+)$/,
				replacement: `${coreDir}/metrics/fsrs-tools/$1`,
			},
			{
				find: /^.*\/src\/features\/metrics\/services\/stats\/(.+)$/,
				replacement: `${coreDir}/metrics/stats/$1`,
			},

			// ── src/features/ai ───────────────────────────────────────────────
			{
				find: /^.*\/src\/features\/ai\/services\/incremental-flashcard-parser$/,
				replacement: `${coreDir}/ai/parsing/incremental-flashcard-parser`,
			},
			{
				find: /^.*\/src\/features\/ai\/services\/markdown-chunker$/,
				replacement: `${coreDir}/ai/parsing/markdown-chunker`,
			},
			{
				find: /^.*\/src\/features\/ai\/services\/openrouter-client$/,
				replacement: `${coreDir}/ai/clients/openrouter-client`,
			},
			{
				find: /^.*\/src\/features\/ai\/services\/semantic-answer-grading\.service$/,
				replacement: `${coreDir}/ai/grading/semantic-answer-grading.service`,
			},
			{
				find: /^.*\/src\/features\/ai\/services\/source-text-fixer$/,
				replacement: `${coreDir}/ai/utils/source-text-fixer`,
			},

			// ── src/features/integration ──────────────────────────────────────
			// apkg is nested one level deeper
			{
				find: /^.*\/src\/features\/integration\/services\/anki\/apkg-parser\.service$/,
				replacement: `${coreDir}/integration/anki/apkg/apkg-parser.service`,
			},
			{
				find: /^.*\/src\/features\/integration\/services\/anki\/(.+)$/,
				replacement: `${coreDir}/integration/anki/$1`,
			},

			// ── src/features/image-occlusion ──────────────────────────────────
			{
				find: /^.*\/src\/features\/image-occlusion\/canvas-geometry$/,
				replacement: `${coreDir}/utils/canvas-geometry`,
			},
			{
				find: /^.*\/src\/features\/image-occlusion\/io-definition$/,
				replacement: `${coreDir}/utils/io-definition`,
			},
			{
				find: /^.*\/src\/features\/image-occlusion\/canvas-interactions$/,
				replacement: `${obsidianDir}/features/image-occlusion/canvas-interactions`,
			},
			{
				find: /^.*\/src\/features\/image-occlusion\/types$/,
				replacement: `${obsidianDir}/features/image-occlusion/types`,
			},
			{
				find: /^.*\/src\/features\/image-occlusion\/ui-helpers$/,
				replacement: `${obsidianDir}/features/image-occlusion/ui-helpers`,
			},

			// ── src/features/rag ──────────────────────────────────────────────
			{
				find: /^.*\/src\/features\/rag\/ui\/helpers\/group-sources$/,
				replacement: `${coreDir}/rag/retrieval/rag-source-grouper`,
			},

			// ── src/shared ────────────────────────────────────────────────────
			// store goes to obsidian
			{ find: /^.*\/src\/shared\/store$/, replacement: `${obsidianDir}/store` },
			// shared/ui — card-state goes to core, rest to obsidian
			{
				find: /^.*\/src\/shared\/ui\/helpers\/card-state$/,
				replacement: `${coreDir}/helpers/card-state`,
			},
			{
				find: /^.*\/src\/shared\/ui\/helpers\/search-suggestions(\.types)?$/,
				replacement: `${obsidianDir}/helpers/search-suggestions$1`,
			},
			{
				find: /^.*\/src\/shared\/ui\/components\/(.+)$/,
				replacement: `${obsidianDir}/components/$1`,
			},
			{
				find: /^.*\/src\/shared\/ui\/editor\/formatting\/(.+)$/,
				replacement: `${obsidianDir}/editor/shared/formatting/$1`,
			},
			// shared/types — fsrs.types was split, map to index
			{
				find: /^.*\/src\/shared\/types\/fsrs\.types$/,
				replacement: `${coreDir}/types/fsrs/index`,
			},
			{
				find: /^.*\/src\/shared\/types\/(.+)$/,
				replacement: `${coreDir}/types/$1`,
			},
			{ find: /^.*\/src\/shared\/types$/, replacement: `${coreDir}/types` },
			{
				find: /^.*\/src\/shared\/constants$/,
				replacement: `${coreDir}/constants`,
			},
			{ find: /^.*\/src\/shared\/errors$/, replacement: `${coreDir}/errors` },
			{
				find: /^.*\/src\/shared\/utils\/(.+)$/,
				replacement: `${coreDir}/utils/$1`,
			},
		],
	},
	test: {
		globals: true,
		environment: "node",
		include: ["tests/**/*.test.ts"],
		exclude: ["node_modules", "dist"],
		coverage: {
			provider: "v8",
			reporter: ["text", "html", "json"],
			include: ["packages/core/src/**/*.ts", "packages/obsidian/src/**/*.ts"],
			exclude: ["packages/obsidian/src/main.ts", "**/*.d.ts"],
		},
	},
});
