import { FSRS_CONTEXT_FOR_AI } from "@features/ai/services/fsrs-context";
import type { SqlQueryAdapter } from "@features/ai/services/sql-query.adapter";
import type {
	NLQueryConfig,
	NLQueryResult,
	NLQueryStep,
} from "@shared/types/nl-query.types";
import {
	AIRequestError,
	type ChatMessage,
	getTextContent,
	OpenRouterClient,
	type ToolDefinition,
} from "./openrouter-client";

const SQL_TOOLS: ToolDefinition[] = [
	{
		type: "function",
		function: {
			name: "sql_db_query",
			description:
				"Execute a SELECT SQL query against the database. Input should be a valid SQLite SELECT query. Always include LIMIT clause.",
			parameters: {
				type: "object",
				properties: {
					query: {
						type: "string",
						description: "The SQL SELECT query to execute",
					},
				},
				required: ["query"],
			},
		},
	},
	{
		type: "function",
		function: {
			name: "sql_db_schema",
			description:
				"Get the schema and sample data for all tables in the database. Use this to understand the database structure before writing queries.",
			parameters: { type: "object", properties: {} },
		},
	},
	{
		type: "function",
		function: {
			name: "sql_db_list_tables",
			description: "List all tables available in the database.",
			parameters: { type: "object", properties: {} },
		},
	},
];

const MAX_ITERATIONS = 5;

const SYSTEM_PREFIX = `You are a helpful assistant for analyzing FSRS flashcard statistics.
You help users understand their learning patterns, identify problem cards, and get insights from their review data.

${FSRS_CONTEXT_FOR_AI}

## Response Guidelines

1. Always respond in the same language as the user's question
2. When you don't know the answer, say so clearly - don't make up data
3. Explain your findings in clear, non-technical language
4. When showing numbers, provide context (e.g., "181 new cards available today, limited by your 20/day setting")
5. If the user seems confused about "due" vs "new" cards, explain the distinction
6. Always use LIMIT in queries (max 100 rows recommended)
7. Test uncertain queries with LIMIT 1 first

## SQL Query Rules (Critical)

1. ONLY use SELECT queries - never INSERT, UPDATE, DELETE, or other modifying operations
2. Always filter active cards: \`suspended = 0 AND (buried_until IS NULL OR buried_until <= datetime('now'))\`
3. For "due today" queries, MUST exclude state 0: \`WHERE state != 0 AND date(due) <= date('now')\`
4. Use date('now') for "today", datetime('now') for exact timestamps
5. For local time conversions, use 'localtime' modifier: \`date(reviewed_at, 'localtime')\`
6. Always include error handling - if a query fails, explain why and try a simpler approach`;

export class NLQueryService {
	private config: NLQueryConfig;
	private sqlAdapter: SqlQueryAdapter;
	private initialized = false;

	private fallbackConfig: NLQueryConfig | null = null;

	constructor(config: NLQueryConfig, sqlAdapter: SqlQueryAdapter) {
		this.config = config;
		this.sqlAdapter = sqlAdapter;
	}

	setFallbackConfig(config: NLQueryConfig | null): void {
		this.fallbackConfig = config;
	}

	async initialize(): Promise<void> {
		if (!this.config.apiKey) {
			throw new Error("API key is required for NL Query Service");
		}
		this.initialized = true;
	}

	async query(question: string): Promise<NLQueryResult> {
		if (!this.initialized) {
			return {
				question,
				answer: "Service not initialized. Please try again later.",
				intermediateSteps: [],
				error: "Service not initialized",
			};
		}

		try {
			return await this.queryWithConfig(this.config, question);
		} catch (error) {
			if (
				error instanceof AIRequestError &&
				error.isBudgetExceeded &&
				this.fallbackConfig
			) {
				return this.queryWithConfig(this.fallbackConfig, question);
			}

			const errorMessage =
				error instanceof Error ? error.message : String(error);
			return {
				question,
				answer: `Error processing query: ${errorMessage}`,
				intermediateSteps: [],
				error: errorMessage,
			};
		}
	}

	private async queryWithConfig(
		config: NLQueryConfig,
		question: string,
	): Promise<NLQueryResult> {
		const client = new OpenRouterClient(
			config.apiKey,
			config.model,
			config.proxyUrl,
		);
		const schema = this.sqlAdapter.getTableInfo();
		const steps: NLQueryStep[] = [];

		const messages: ChatMessage[] = [
			{
				role: "system",
				content: `${SYSTEM_PREFIX}\n\nDatabase schema:\n${schema}`,
			},
			{ role: "user", content: question },
		];

		for (let i = 0; i < MAX_ITERATIONS; i++) {
			const response = await client.chat({
				messages,
				temperature: 0,
				tools: SQL_TOOLS,
				tool_choice: "auto",
			});

			const choice = response.choices[0];
			if (!choice) break;

			const assistantMsg = choice.message;
			messages.push(assistantMsg);

			if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
				return {
					question,
					answer: getTextContent(assistantMsg) || "No response generated",
					intermediateSteps: steps,
				};
			}

			for (const toolCall of assistantMsg.tool_calls) {
				const { name, arguments: argsJson } = toolCall.function;
				const toolResult = this.executeTool(name, argsJson);

				steps.push({
					action: name,
					input: argsJson,
					output: toolResult,
				});

				messages.push({
					role: "tool",
					content: toolResult,
					tool_call_id: toolCall.id,
				});
			}
		}

		const lastAssistant = [...messages]
			.reverse()
			.find((m) => m.role === "assistant");
		return {
			question,
			answer:
				getTextContent(lastAssistant) ||
				"Max iterations reached without a final answer.",
			intermediateSteps: steps,
		};
	}

	private executeTool(name: string, argsJson: string): string {
		try {
			const args = JSON.parse(argsJson) as Record<string, string>;
			switch (name) {
				case "sql_db_query":
					return this.sqlAdapter.run(args.query ?? argsJson);
				case "sql_db_schema":
					return this.sqlAdapter.getTableInfo();
				case "sql_db_list_tables":
					return this.sqlAdapter.getTableNames().join(", ");
				default:
					return `Unknown tool: ${name}`;
			}
		} catch (e) {
			return `Tool execution error: ${e instanceof Error ? e.message : String(e)}`;
		}
	}

	isReady(): boolean {
		return this.initialized && this.sqlAdapter.isReady();
	}

	async updateConfig(config: Partial<NLQueryConfig>): Promise<void> {
		this.config = { ...this.config, ...config };
		await this.initialize();
	}
}
