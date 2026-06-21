# Tenet JavaScript/TypeScript SDK

Route OpenAI-compatible LLM calls through [Tenet](https://trytenet.ai) for production voice agent observability.

## Install

```bash
npm install tenet-ai
# or
yarn add tenet-ai
# or
pnpm add tenet-ai
```

## Quick Start

```typescript
import OpenAI from "openai";
import { wrapOpenAI } from "tenet-ai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const wrapped = wrapOpenAI(client, {
  tenetKey: process.env.TENET_API_KEY,
});

const response = await wrapped.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Say hello in one word." }],
});

console.log(response.choices[0].message.content);
```

## LiveKit

```typescript
import { TenetLLM } from "tenet-ai/livekit";
import { OpenAILLM } from "@livekit/agents";

const llm = new TenetLLM({
  tenetKey: process.env.TENET_API_KEY,
  llm: new OpenAILLM({
    model: "gpt-4o",
    apiKey: process.env.OPENAI_API_KEY,
  }),
});
```

## Configuration

| Option | Default | Description |
|---|---|---|
| `tenetKey` | required | Tenet API key |
| `failover` | `true` | Fall back to direct provider on proxy failure |
| `proxyUrl` | `https://inference.trytenet.ai` | Custom proxy URL (self-hosted) |
| `timeout` | `5000` | Connection timeout in milliseconds |

## How It Works

`wrapOpenAI()` swaps the HTTP transport layer of your OpenAI client. Requests are routed through Tenet's inference proxy, which captures them for scoring and analysis. If the proxy is unreachable, the SDK falls back to calling your provider directly — your agent never goes silent.

## License

MIT
