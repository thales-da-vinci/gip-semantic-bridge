# GIP Semantic Bridge

Semantic intelligence bridge for GIP Federation network. Integrates Ollama LLMs (Mistral, Phi, Gemma) with the GIP Federation relay to enable semantic reasoning across distributed nodes.

## Features

- 🧠 **Ollama Integration**: Direct API bridge to local LLM models
- 🌐 **Federation Connected**: WebSocket relay with GIP Federation node
- 📨 **Message Routing**: Semantic requests/responses with request ID tracking
- ⚡ **Caching**: Response caching to reduce redundant LLM calls
- 📊 **Statistics**: Real-time processing queue and cache metrics
- 🐳 **Containerized**: Docker + docker-compose for orchestration
- 🧪 **Tested**: Jest test suite (10 tests covering integration points)

## Installation

### Local Development

```bash
npm install
npm run build
npm run dev
```

### Docker

```bash
docker-compose up -d
```

## Configuration

Environment variables:

```env
FEDERATION_HOST=localhost      # GIP Federation relay host
FEDERATION_PORT=8810           # GIP Federation relay port
BRIDGE_PORT=8811               # Semantic Bridge port
OLLAMA_URL=http://localhost:11434  # Ollama service URL
SEMANTIC_MODEL=mistral         # Default LLM model (mistral, phi, gemma)
```

## Usage

### Message Format

**Semantic Request** (from federation):
```json
{
  "type": "semantic_request",
  "id": "msg-123",
  "prompt": "What is quantum computing?",
  "model": "mistral",
  "temperature": 0.7,
  "topK": 40,
  "topP": 0.9
}
```

**Semantic Response** (back to federation):
```json
{
  "type": "semantic_response",
  "id": "msg-123",
  "prompt": "What is quantum computing?",
  "model": "mistral",
  "response": "Quantum computing is...",
  "tokens": {
    "prompt": 5,
    "completion": 142,
    "total": 147
  },
  "processingTime": 2340,
  "timestamp": 1705337700000
}
```

## Architecture

```
┌─────────────────┐
│  GIP Federation │
│  Relay Node     │
│  (Port 8810)    │
└────────┬────────┘
         │
         │ WebSocket
         │ Semantic Request
         │
┌────────▼──────────────┐
│ Semantic Bridge       │
│ (Port 8811)           │
│                       │
│ ┌──────────────────┐ │
│ │ Message Handler  │ │
│ └────────┬─────────┘ │
│          │           │
│ ┌────────▼─────────┐ │
│ │ Ollama Client    │ │
│ └────────┬─────────┘ │
│          │           │
│ ┌────────▼─────────┐ │
│ │ Response Cache   │ │
│ └──────────────────┘ │
└────────┬─────────────┘
         │
         │ HTTP
         │
┌────────▼────────┐
│ Ollama Engine   │
│ (Port 11434)    │
│                 │
│ Models:         │
│ - Mistral 7B    │
│ - Phi-2         │
│ - Gemma 7B      │
└─────────────────┘
```

## Testing

```bash
npm test
npm test -- --coverage  # With coverage report
npm run test:watch      # Watch mode
```

### Test Suite (10 tests)

1. ✅ Bridge initialization
2. ✅ Ollama model availability detection
3. ✅ Semantic request parsing
4. ✅ Response caching
5. ✅ Federation message validation
6. ✅ Invalid request handling
7. ✅ Statistics aggregation
8. ✅ Token counting
9. ✅ Processing time measurement
10. ✅ Temperature parameter validation

## API

### SemanticBridge Class

#### `initialize(): Promise<void>`
Initialize bridge, verify Ollama, and connect to federation.

#### `getResponse(id: string): SemanticResponse | undefined`
Retrieve cached semantic response by request ID.

#### `getStats(): Statistics`
Get real-time processing statistics.

### OllamaClient Class

#### `isAvailable(): Promise<boolean>`
Check if Ollama service is running.

#### `listModels(): Promise<string[]>`
Get list of available models in Ollama.

#### `generate(request: SemanticRequest): Promise<SemanticResponse>`
Generate text using specified model.

#### `chat(messages: OllamaMessage[], request: SemanticRequest): Promise<SemanticResponse>`
Chat mode with conversation history.

## Supported Models

Default: **Mistral 7B**

Other models (via `model` parameter):
- **Phi-2** (Microsoft)
- **Gemma 7B** (Google)
- **Llama 2** (Meta)
- **Neural Chat**
- **Zephyr**

## Logs

Streaming JSON logs to stdout:
```
[INFO] 🌉 Initializing Semantic Bridge...
[INFO] ✅ Ollama connected at http://localhost:11434
[INFO] 📦 Available models: mistral, phi, gemma
[INFO] 🔗 Connecting to federation: ws://localhost:8810
[INFO] ✅ Connected to GIP Federation relay
[INFO] 🌉 GIP Semantic Bridge started on port 8811
[DEBUG] 🧠 Ollama: Processing "What is quantum computing..."
[INFO] ✅ [msg-123] Generated 142 tokens in 2340ms
```

## Performance

- **Latency**: 2-5s (depends on model size and hardware)
- **Throughput**: ~1-2 requests/sec per bridge instance
- **Memory**: ~2-4GB (depends on loaded model)
- **Cache Hit Rate**: 70%+ for repeated queries

## Troubleshooting

### "Ollama not available"
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Start Ollama if not running
ollama serve
```

### "Cannot connect to federation"
```bash
# Check if federation node is running
curl http://localhost:8810

# Start federation in separate terminal
cd gip-federation
npm run dev
```

### "Module not found" errors
```bash
npm install
npm run build
```

## Related Modules

- [gip-federation](https://github.com/Tehkne-Solutions/gip-federation) - WebSocket relay
- [gip-core](https://github.com/Tehkne-Solutions/gip-core) - Core architecture
- [gip-symphonia](https://github.com/Tehkne-Solutions/gip-symphonia) - Cognitive engine

## Version History

- **0.1.0-alpha** (2025-01-15)
  - Initial release
  - Ollama integration
  - Federation connectivity
  - Jest test suite (10/10 passing)
  - Docker containerization

## License

MIT © Tehkné Solutions

---

Built with ❤️ for distributed cognitive systems.
