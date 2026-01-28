/**
 * Natural Language Query Service
 * Uses LangChain SQL Agent for natural language database queries
 *
 * Enables users to ask questions about their flashcard statistics
 * in natural language, which are then translated to SQL queries.
 */
import { ChatOpenAI } from "@langchain/openai";
import { AgentExecutor, createOpenAIToolsAgent } from "@langchain/classic/agents";
import { DynamicTool } from "@langchain/core/tools";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import type { SqlJsAdapter } from "./langchain-sqlite.adapter";
import type { NLQueryResult, NLQueryStep, NLQueryConfig } from "../../types/nl-query.types";
import { FSRS_CONTEXT_FOR_AI } from "./fsrs-context";

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

/**
 * Service for natural language queries against the flashcard database
 */
export class NLQueryService {
    private agent: AgentExecutor | null = null;
    private config: NLQueryConfig;
    private sqlAdapter: SqlJsAdapter;

    constructor(config: NLQueryConfig, sqlAdapter: SqlJsAdapter) {
        this.config = config;
        this.sqlAdapter = sqlAdapter;
    }

    /**
     * Initialize the LangChain agent
     * Must be called before querying
     */
    async initialize(): Promise<void> {
        if (!this.config.apiKey) {
            throw new Error("API key is required for NL Query Service");
        }

        // Create LLM with OpenRouter (OpenAI-compatible API)
        const llm = new ChatOpenAI({
            modelName: this.config.model,
            configuration: {
                baseURL: "https://openrouter.ai/api/v1",
                apiKey: this.config.apiKey,
                defaultHeaders: {
                    "HTTP-Referer": "obsidian://episteme",
                    "X-Title": "True Recall",
                },
            },
            temperature: 0, // Lower temperature for more consistent SQL generation
        });

        // Create SQL tools that work with our SqlJsAdapter
        const tools = this.createSqlTools();

        // Create the agent prompt
        const prompt = ChatPromptTemplate.fromMessages([
            ["system", SYSTEM_PREFIX + "\n\nDatabase schema:\n{schema}"],
            ["human", "{input}"],
            ["placeholder", "{agent_scratchpad}"],
        ]);

        // Create the agent
        const agent = await createOpenAIToolsAgent({
            llm,
            tools,
            prompt,
        });

        this.agent = new AgentExecutor({
            agent,
            tools,
            verbose: false,
            maxIterations: 5,
            returnIntermediateSteps: true,
        });
    }

    /**
     * Create SQL tools for the agent
     */
    private createSqlTools(): DynamicTool[] {
        return [
            new DynamicTool({
                name: "sql_db_query",
                description:
                    "Execute a SELECT SQL query against the database. Input should be a valid SQLite SELECT query. Always include LIMIT clause.",
                func: async (query: string) => {
                    return this.sqlAdapter.run(query);
                },
            }),
            new DynamicTool({
                name: "sql_db_schema",
                description:
                    "Get the schema and sample data for all tables in the database. Use this to understand the database structure before writing queries.",
                func: async () => {
                    return this.sqlAdapter.getTableInfo();
                },
            }),
            new DynamicTool({
                name: "sql_db_list_tables",
                description: "List all tables available in the database.",
                func: async () => {
                    const tables = this.sqlAdapter.getTableNames();
                    return tables.join(", ");
                },
            }),
        ];
    }

    /**
     * Query the database using natural language
     */
    async query(question: string): Promise<NLQueryResult> {
        if (!this.agent) {
            return {
                question,
                answer: "Service not initialized. Please try again later.",
                intermediateSteps: [],
                error: "Service not initialized",
            };
        }

        try {
            // Get schema for context
            const schema = this.sqlAdapter.getTableInfo();

            // Run the agent
            const result = await this.agent.invoke({
                input: question,
                schema,
            });

            // Extract intermediate steps
            const steps: NLQueryStep[] = [];
            if (result.intermediateSteps) {
                for (const step of result.intermediateSteps) {
                    if (step.action && step.observation) {
                        steps.push({
                            action: step.action.tool || "unknown",
                            input: typeof step.action.toolInput === "string"
                                ? step.action.toolInput
                                : JSON.stringify(step.action.toolInput, null, 2),
                            output:
                                typeof step.observation === "string"
                                    ? step.observation
                                    : JSON.stringify(step.observation),
                        });
                    }
                }
            }

            return {
                question,
                answer: result.output || "No response generated",
                intermediateSteps: steps,
            };
        } catch (error) {
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

    /**
     * Check if the service is ready
     */
    isReady(): boolean {
        return this.agent !== null && this.sqlAdapter.isReady();
    }

    /**
     * Update configuration (e.g., when settings change)
     */
    async updateConfig(config: Partial<NLQueryConfig>): Promise<void> {
        this.config = { ...this.config, ...config };
        // Re-initialize with new config
        await this.initialize();
    }
}
