import { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import chalk from 'chalk';
import axios from 'axios';

/**
 * GIP Semantic Bridge v0.1.0-alpha
 * Integrates Ollama LLMs with GIP Federation network
 * 
 * Architecture:
 * ┌─────────────────┐    ┌──────────────────┐    ┌──────────────┐
 * │ GIP Federation  │───▶│ Semantic Bridge  │───▶│ Ollama (LLM) │
 * │   (Port 8810)   │    │  (Port 8811)     │    │ (Port 11434) │
 * └─────────────────┘    └──────────────────┘    └──────────────┘
 *         ▲                       │
 *         │                       ▼
 *    Message Relay        Semantic Processing
 *         │                       │
 *         └───────────────────────┘
 *         Enriched Response Flow
 */

// ============================================================================
// Configuration
// ============================================================================

const FEDERATION_HOST = process.env.FEDERATION_HOST || 'localhost';
const FEDERATION_PORT = process.env.FEDERATION_PORT || 8810;
const BRIDGE_PORT = process.env.BRIDGE_PORT || 8811;
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const SEMANTIC_MODEL = process.env.SEMANTIC_MODEL || 'mistral';

// ============================================================================
// Types
// ============================================================================

interface SemanticRequest {
    id: string;
    prompt: string;
    model?: string;
    temperature?: number;
    topK?: number;
    topP?: number;
    timestamp: number;
}

interface SemanticResponse {
    id: string;
    prompt: string;
    model: string;
    response: string;
    tokens: {
        prompt: number;
        completion: number;
        total: number;
    };
    processingTime: number;
    timestamp: number;
}

interface OllamaMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

// ============================================================================
// Ollama Integration
// ============================================================================

class OllamaClient {
    private baseUrl: string;
    private model: string;
    private requestTimeout: number;

    constructor(baseUrl: string, model: string, timeout = 60000) {
        this.baseUrl = baseUrl;
        this.model = model;
        this.requestTimeout = timeout;
    }

    /**
     * Check if Ollama service is available
     */
    async isAvailable(): Promise<boolean> {
        try {
            const response = await axios.get(`${this.baseUrl}/api/tags`, {
                timeout: 5000,
            });
            return response.status === 200;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get list of available models from Ollama
     */
    async listModels(): Promise<string[]> {
        try {
            const response = await axios.get(`${this.baseUrl}/api/tags`, {
                timeout: 5000,
            });
            return response.data.models?.map((m: any) => m.name) || [];
        } catch (error) {
            console.error(chalk.red(`❌ Failed to list Ollama models: ${error}`));
            return [];
        }
    }

    /**
     * Generate text using Ollama
     */
    async generate(request: SemanticRequest): Promise<SemanticResponse> {
        const startTime = Date.now();

        try {
            console.log(
                chalk.blueBright(
                    `🧠 Ollama: Processing "${request.prompt.substring(0, 50)}..."`
                )
            );

            const response = await axios.post(
                `${this.baseUrl}/api/generate`,
                {
                    model: request.model || this.model,
                    prompt: request.prompt,
                    temperature: request.temperature || 0.7,
                    top_k: request.topK || 40,
                    top_p: request.topP || 0.9,
                    stream: false,
                },
                { timeout: this.requestTimeout }
            );

            const processingTime = Date.now() - startTime;

            return {
                id: request.id,
                prompt: request.prompt,
                model: request.model || this.model,
                response: response.data.response,
                tokens: {
                    prompt: response.data.prompt_eval_count || 0,
                    completion: response.data.eval_count || 0,
                    total:
                        (response.data.prompt_eval_count || 0) +
                        (response.data.eval_count || 0),
                },
                processingTime,
                timestamp: Date.now(),
            };
        } catch (error: any) {
            console.error(
                chalk.red(
                    `❌ Ollama generation failed: ${error.message || error}`
                )
            );
            throw error;
        }
    }

    /**
     * Chat mode (stateful conversation)
     */
    async chat(
        messages: OllamaMessage[],
        request: SemanticRequest
    ): Promise<SemanticResponse> {
        const startTime = Date.now();

        try {
            const response = await axios.post(
                `${this.baseUrl}/api/chat`,
                {
                    model: request.model || this.model,
                    messages,
                    temperature: request.temperature || 0.7,
                    stream: false,
                },
                { timeout: this.requestTimeout }
            );

            const processingTime = Date.now() - startTime;

            return {
                id: request.id,
                prompt: request.prompt,
                model: request.model || this.model,
                response: response.data.message.content,
                tokens: {
                    prompt: response.data.prompt_eval_count || 0,
                    completion: response.data.eval_count || 0,
                    total:
                        (response.data.prompt_eval_count || 0) +
                        (response.data.eval_count || 0),
                },
                processingTime,
                timestamp: Date.now(),
            };
        } catch (error: any) {
            console.error(
                chalk.red(
                    `❌ Ollama chat failed: ${error.message || error}`
                )
            );
            throw error;
        }
    }
}

// ============================================================================
// Semantic Bridge Server
// ============================================================================

class SemanticBridge {
    private ollama: OllamaClient;
    private federationConnection: WebSocket | null = null;
    private messageCache: Map<string, SemanticResponse> = new Map();
    private processingQueue: SemanticRequest[] = [];

    constructor() {
        this.ollama = new OllamaClient(OLLAMA_URL, SEMANTIC_MODEL);
    }

    /**
     * Initialize bridge: connect to federation and verify Ollama
     */
    async initialize(): Promise<void> {
        console.log(chalk.cyanBright('🌉 Initializing Semantic Bridge...'));

        // Check Ollama availability
        const ollamaAvailable = await this.ollama.isAvailable();
        if (!ollamaAvailable) {
            console.warn(
                chalk.yellow(
                    `⚠️  Ollama not available at ${OLLAMA_URL}. Starting in offline mode.`
                )
            );
        } else {
            console.log(
                chalk.green(
                    `✅ Ollama connected at ${OLLAMA_URL}`
                )
            );

            // List available models
            const models = await this.ollama.listModels();
            console.log(
                chalk.gray(
                    `📦 Available models: ${models.join(', ') || 'none'}`
                )
            );
        }

        // Connect to federation node
        await this.connectToFederation();
    }

    /**
     * Connect to GIP Federation relay
     */
    private connectToFederation(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                const url = `ws://${FEDERATION_HOST}:${FEDERATION_PORT}`;
                console.log(chalk.gray(`🔗 Connecting to federation: ${url}`));

                this.federationConnection = new WebSocket(url);

                this.federationConnection.on('open', () => {
                    console.log(
                        chalk.green(
                            `✅ Connected to GIP Federation relay`
                        )
                    );
                    resolve();
                });

                this.federationConnection.on('message', (data: Buffer) => {
                    this.handleFederationMessage(data.toString());
                });

                this.federationConnection.on('error', (error) => {
                    console.error(
                        chalk.red(
                            `❌ Federation connection error: ${error.message}`
                        )
                    );
                    reject(error);
                });

                this.federationConnection.on('close', () => {
                    console.warn(
                        chalk.yellow(
                            `⚠️  Disconnected from federation (will reconnect...)`
                        )
                    );
                    setTimeout(() => this.connectToFederation(), 5000);
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Handle incoming messages from federation
     */
    private async handleFederationMessage(message: string): Promise<void> {
        try {
            const data = JSON.parse(message);

            if (!data.type) {
                console.warn(chalk.yellow(`⚠️  Invalid message: missing type`));
                return;
            }

            if (data.type === 'semantic_request') {
                const request: SemanticRequest = {
                    id: data.id || uuidv4(),
                    prompt: data.prompt,
                    model: data.model,
                    temperature: data.temperature,
                    topK: data.topK,
                    topP: data.topP,
                    timestamp: Date.now(),
                };

                this.processingQueue.push(request);
                await this.processRequest(request);
            }
        } catch (error) {
            console.error(
                chalk.red(
                    `❌ Failed to handle federation message: ${error}`
                )
            );
        }
    }

    /**
     * Process semantic request through Ollama
     */
    private async processRequest(request: SemanticRequest): Promise<void> {
        try {
            const response = await this.ollama.generate(request);

            // Cache result
            this.messageCache.set(request.id, response);

            // Log result
            console.log(
                chalk.green(
                    `✅ [${request.id}] Generated ${response.tokens.completion} tokens in ${response.processingTime}ms`
                )
            );

            // Send response back through federation
            if (this.federationConnection?.readyState === 1) {
                this.federationConnection.send(
                    JSON.stringify({
                        type: 'semantic_response',
                        ...response,
                    })
                );
            }
        } catch (error) {
            console.error(chalk.red(`❌ Request processing failed: ${error}`));

            // Send error response
            if (this.federationConnection?.readyState === 1) {
                this.federationConnection.send(
                    JSON.stringify({
                        type: 'semantic_error',
                        id: request.id,
                        error: String(error),
                        timestamp: Date.now(),
                    })
                );
            }
        }
    }

    /**
     * Get semantic response from cache
     */
    getResponse(id: string): SemanticResponse | undefined {
        return this.messageCache.get(id);
    }

    /**
     * Get processing statistics
     */
    getStats(): {
        queueLength: number;
        cacheSize: number;
        cachedResponses: string[];
    } {
        return {
            queueLength: this.processingQueue.length,
            cacheSize: this.messageCache.size,
            cachedResponses: Array.from(this.messageCache.keys()),
        };
    }
}

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
    try {
        const bridge = new SemanticBridge();
        await bridge.initialize();

        console.log(
            chalk.cyanBright(
                `\n🌉 GIP Semantic Bridge started on port ${BRIDGE_PORT}`
            )
        );
        console.log(
            chalk.gray(
                `   Federation: ws://${FEDERATION_HOST}:${FEDERATION_PORT}`
            )
        );
        console.log(
            chalk.gray(
                `   Ollama: ${OLLAMA_URL}`
            )
        );
        console.log(chalk.gray(`   Model: ${SEMANTIC_MODEL}\n`));

        // Keep process alive
        setInterval(() => {
            const stats = bridge.getStats();
            if (stats.queueLength > 0 || stats.cacheSize > 0) {
                console.log(
                    chalk.gray(
                        `📊 Queue: ${stats.queueLength}, Cache: ${stats.cacheSize}`
                    )
                );
            }
        }, 30000);
    } catch (error) {
        console.error(
            chalk.red(
                `❌ Fatal error: ${error}`
            )
        );
        process.exit(1);
    }
}

main();
