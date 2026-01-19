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

const SYSTEM_PREFIX = `You are a helpful assistant for analyzing FSRS flashcard statistics.
You help users understand their learning patterns, identify problem cards, and get insights from their review data.

IMPORTANT RULES:
1. ONLY use SELECT queries - never modify data
2. Always use LIMIT to avoid returning too many results (max 100 rows)
3. When asked about "today", use date('now') in SQLite
4. Format dates as YYYY-MM-DD for queries
5. The 'state' column uses these values: 0=New, 1=Learning, 2=Review, 3=Relearning
6. Ratings: 1=Again, 2=Hard, 3=Good, 4=Easy
7. 'scheduled_days' >= 21 indicates a "mature" card
8. Cards with high 'lapses' (>3) or low 'stability' (<2.0) are "problem cards"
9. Always respond in the same language as the user's question

When you don't know the answer, say so clearly. Don't make up data.`;

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
                    "X-Title": "Episteme",
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
