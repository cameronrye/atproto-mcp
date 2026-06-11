# MCP Protocol

Understanding the Model Context Protocol and how it works with the AT Protocol
MCP Server.

## What is MCP?

The **Model Context Protocol (MCP)** is an open protocol that standardizes how
applications provide context to Large Language Models (LLMs). It enables LLMs to
securely access data and tools from external systems.

### Key Concepts

MCP defines three main primitives:

1. **Tools** - Functions that LLMs can execute
2. **Resources** - Data sources that LLMs can read
3. **Prompts** - Templates for common tasks

## Architecture

```
┌─────────────────────────────────────┐
│         LLM Client                  │
│  (Claude, GPT, etc.)                │
└──────────────┬──────────────────────┘
               │
               │ JSON-RPC 2.0
               │ over stdio
               │
┌──────────────▼──────────────────────┐
│      MCP Server                     │
│  ┌──────────────────────────────┐  │
│  │  Tools                       │  │
│  │  - create_post               │  │
│  │  - search_posts              │  │
│  │  - follow_user               │  │
│  └──────────────────────────────┘  │
│  ┌──────────────────────────────┐  │
│  │  Resources                   │  │
│  │  - atproto://timeline        │  │
│  │  - atproto://profile         │  │
│  │  - atproto://notifications   │  │
│  └──────────────────────────────┘  │
│  ┌──────────────────────────────┐  │
│  │  Prompts                     │  │
│  │  - content_composition       │  │
│  │  - reply_template            │  │
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘
```

## MCP Tools

Tools are executable functions that LLMs can call to perform actions.

### Tool Structure

Each tool has:

```typescript
{
  name: string;           // Unique identifier
  description: string;    // What the tool does
  inputSchema: {          // Zod schema for parameters
    type: "object",
    properties: { ... },
    required: [ ... ]
  }
}
```

### Example Tool

```typescript
{
  name: "create_post",
  description: "Create a new post on AT Protocol",
  inputSchema: {
    type: "object",
    properties: {
      text: {
        type: "string",
        description: "Post content (max 300 characters)"
      },
      langs: {
        type: "array",
        items: { type: "string" },
        description: "Language codes (e.g., ['en', 'es'])"
      }
    },
    required: ["text"]
  }
}
```

### Tool Execution Flow

```
1. LLM decides to use a tool
   ↓
2. LLM sends tool call request
   {
     "method": "tools/call",
     "params": {
       "name": "create_post",
       "arguments": { "text": "Hello world!" }
     }
   }
   ↓
3. Server validates parameters
   ↓
4. Server executes tool
   ↓
5. Server returns result
   {
     "content": [{
       "type": "text",
       "text": "Post created successfully"
     }]
   }
```

### Available Tools

The AT Protocol MCP Server provides 51 tools across categories:

- **Social Operations**: create_post, like_post, repost, follow_user
- **Data Retrieval**: search_posts, get_user_profile, get_timeline,
  get_author_feed, get_user_connections
- **Direct Messages**: list_conversations, get_conversation_messages,
  send_direct_message
- **Bookmarks**: add_bookmark, remove_bookmark, get_bookmarks
- **Content Management**: delete_post, update_profile, upload_image
- **Moderation**: mute_user, block_user, report_content
- **Batch & Analytics**: batch_action, analyze_account, discover
- **Starter Packs**: search_starter_packs, get_starter_pack

OAuth login is planned but not yet functional, so it is not exposed as a tool;
real-time streaming is not planned as tools. See the
[Experimental & Roadmap](./experimental.md) page.

See the [API Reference](../api/index.md) for the complete list.

## MCP Resources

Resources are data sources that LLMs can read to get context.

### Resource Structure

```typescript
{
  uri: string; // Unique resource identifier
  name: string; // Human-readable name
  description: string; // What data it provides
  mimeType: string; // Content type
}
```

### Example Resource

```typescript
{
  uri: "atproto://timeline",
  name: "User Timeline",
  description: "Current user's timeline feed with recent posts",
  mimeType: "application/json"
}
```

### Resource Access Flow

```
1. LLM requests resource list
   {
     "method": "resources/list"
   }
   ↓
2. Server returns available resources
   {
     "resources": [
       { "uri": "atproto://timeline", ... },
       { "uri": "atproto://profile", ... }
     ]
   }
   ↓
3. LLM reads specific resource
   {
     "method": "resources/read",
     "params": { "uri": "atproto://timeline" }
   }
   ↓
4. Server returns resource content
   {
     "contents": [{
       "uri": "atproto://timeline",
       "mimeType": "application/json",
       "text": "{ ... timeline data ... }"
     }]
   }
```

### Available Resources

- **atproto://timeline** - User's personalized timeline
- **atproto://profile** - User's profile information
- **atproto://notifications** - Recent notifications

All three static resources require authentication. The placeholder
`atproto://conversation-context` resource from earlier releases has been
removed.

### Resource Templates

The server also answers `resources/templates/list` with two parameterized
templates that expose any actor's **public** data and work **without
authentication**:

- **atproto://profile/{actor}** - Public profile for a handle or DID
- **atproto://feed/{actor}** - Recent public posts by a handle or DID

`resources/read` resolves a concrete URI against the static resources first,
then the templates. A URI that matches neither returns JSON-RPC error `-32002`
(Resource not found).

See the [API Reference](../api/index.md) for details.

## MCP Prompts

Prompts are templates that help LLMs perform common tasks.

### Prompt Structure

```typescript
{
  name: string;          // Unique identifier
  description: string;   // What the prompt helps with
  arguments: [{          // Optional parameters
    name: string;
    description: string;
    required: boolean;
  }]
}
```

### Example Prompt

```typescript
{
  name: "content_composition",
  description: "Help compose engaging social media posts",
  arguments: [
    {
      name: "topic",
      description: "The main topic or subject for the post",
      required: true
    },
    {
      name: "tone",
      description: "Desired tone (casual, professional, humorous)",
      required: false
    }
  ]
}
```

### Prompt Usage Flow

```
1. LLM requests prompt list
   {
     "method": "prompts/list"
   }
   ↓
2. Server returns available prompts
   {
     "prompts": [
       { "name": "content_composition", ... }
     ]
   }
   ↓
3. LLM gets prompt with arguments
   {
     "method": "prompts/get",
     "params": {
       "name": "content_composition",
       "arguments": {
         "topic": "AI",
         "tone": "casual"
       }
     }
   }
   ↓
4. Server returns prompt messages
   {
     "messages": [{
       "role": "user",
       "content": {
         "type": "text",
         "text": "Create a casual post about AI..."
       }
     }]
   }
```

### Available Prompts

- **content_composition** - Help write engaging posts
- **reply_template** - Generate thoughtful replies

Both prompts are pure text templates and work without authentication.

See the [API Reference](../api/index.md) for details.

## Transport Protocols

By default the AT Protocol MCP Server uses the **stdio (Standard Input/Output)**
transport for local integrations:

```bash
atproto-mcp
```

Communication occurs via stdin/stdout using JSON-RPC 2.0, which is the standard
transport for MCP servers integrated with LLM clients like Claude Desktop. The
stdio transport is recommended for MCP clients that spawn the server
themselves, as it provides secure, local communication.

The server can alternatively serve the MCP **Streamable HTTP** transport:

```bash
atproto-mcp --transport http --port 8080
```

In HTTP mode the single route `/mcp` accepts `POST` (JSON-RPC messages, with an
`initialize` request opening a session identified by the server-minted
`Mcp-Session-Id` header), `GET` (the standalone SSE stream), and `DELETE`
(session termination). The binding defaults to the loopback interface
(`127.0.0.1:3000`); see the [Configuration guide](./configuration.md) and
[Deployment guide](./deployment.md).

## Message Format

All MCP messages use JSON-RPC 2.0:

### Request

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "create_post",
    "arguments": {
      "text": "Hello from MCP!"
    }
  }
}
```

### Response (Success)

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Post created successfully"
      }
    ]
  }
}
```

### Response (Error)

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32603,
    "message": "Internal error",
    "data": {
      "details": "Authentication required"
    }
  }
}
```

## Error Codes

Standard JSON-RPC 2.0 error codes, plus the MCP-reserved resource code:

| Code   | Meaning            | Description                              |
| ------ | ------------------ | ---------------------------------------- |
| -32700 | Parse error        | Invalid JSON                             |
| -32600 | Invalid request    | Invalid JSON-RPC                         |
| -32601 | Method not found   | Unknown method                           |
| -32602 | Invalid params     | Invalid parameters                       |
| -32603 | Internal error     | Server error                             |
| -32002 | Resource not found | `resources/read` with an unknown URI     |

## Capabilities

The server advertises its capabilities:

```json
{
  "capabilities": {
    "tools": {},
    "resources": {},
    "prompts": {},
    "completions": {}
  }
}
```

The server advertises empty capability objects — it does not declare
`listChanged` or `subscribe` flags. The `completions` capability means
`completion/complete` is served: enumerable prompt arguments return candidate
values, and the `{actor}` variable of the resource templates completes to the
authenticated user's handle (free-text arguments and unauthenticated servers
complete to an empty list, never an error).

## Best Practices

### For Tool Design

- Use clear, descriptive names
- Provide detailed descriptions
- Validate all inputs with Zod schemas
- Return structured, consistent results
- Handle errors gracefully

### For Resource Design

- Use meaningful URI schemes
- Return well-structured data
- Include timestamps
- Implement proper caching
- Handle large datasets efficiently

### For Prompt Design

- Make prompts reusable
- Support customization via arguments
- Provide clear guidance
- Include examples
- Consider context length

## Next Steps

- **[AT Protocol](./at-protocol.md)** - Learn about AT Protocol
- **[Tools & Resources](./tools-resources.md)** - Explore available tools
- **[API Reference](../api/index.md)** - Detailed API documentation

---

**Previous**: [Authentication](./authentication.md) ← | **Next**:
[AT Protocol](./at-protocol.md) →
