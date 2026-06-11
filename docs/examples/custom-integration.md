# Custom Integration Examples

Practical patterns for building custom integrations on top of the AT Protocol
MCP Server.

## How these examples work

This server speaks the **Model Context Protocol over stdio**. It does **not**
expose a TypeScript API you import, and it does **not** bind an HTTP port. Your
application (or its MCP client library) launches the server as a child process
and talks to it with JSON-RPC `tools/call` requests:

```jsonc
// Request your MCP client sends over stdio
{
  "method": "tools/call",
  "params": {
    "name": "create_post",
    "arguments": { "text": "Hello world!" },
  },
}
```

Every tool result comes back as **stringified JSON inside a text content block**
— there is no guaranteed structured schema, so parse the `text` field yourself
when you need the data programmatically:

```jsonc
// Response the server returns
{
  "content": [
    {
      "type": "text",
      "text": "{\n  \"uri\": \"at://did:plc:.../app.bsky.feed.post/...\",\n  \"cid\": \"...\"\n}",
    },
  ],
}
```

In the examples below, `callTool(name, args)` is a stand-in for whatever your
MCP client library exposes for sending a `tools/call` request. A minimal helper
that parses the text payload looks like this:

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({
  command: 'atproto-mcp',
  // Pass credentials via the environment of the spawned process.
  env: {
    ...process.env,
    ATPROTO_IDENTIFIER: process.env.ATPROTO_IDENTIFIER!,
    ATPROTO_PASSWORD: process.env.ATPROTO_PASSWORD!,
  },
});

const client = new Client({ name: 'my-integration', version: '1.0.0' });
await client.connect(transport);

/** Call a tool and parse its stringified-JSON text result. */
async function callTool<T = unknown>(
  name: string,
  args: Record<string, unknown> = {}
): Promise<T> {
  const result = await client.callTool({ name, arguments: args });
  const block = result.content?.find(
    (c: { type: string }) => c.type === 'text'
  );
  if (!block || block.type !== 'text') {
    throw new Error(`Tool ${name} returned no text content`);
  }
  return JSON.parse(block.text) as T;
}
```

::: tip Authentication

Most tools require authentication. Set `ATPROTO_IDENTIFIER` and
`ATPROTO_PASSWORD` (an app password from Bluesky **Settings → App Passwords**)
in the environment of the spawned server process. Without credentials only the
public/enhanced tools — notably `get_user_profile`, `get_user_connections`,
`search_actors`, and `get_author_feed` — are available. `search_posts` requires
authentication: the AT Protocol search API changed in 2025 to require auth.

:::

::: tip Rate limiting

The server rate-limits each tool to **100 requests per minute per tool**.
Long-running loops (RSS polling, backups) should pace their calls so they stay
well under that limit and respect Bluesky's own platform limits.

:::

## RSS Feed Integration

### RSS to AT Protocol Bridge

Polls an RSS feed and turns new items into posts by calling the `create_post`
tool. The external-link embed is passed through to `create_post`'s `arguments`.

```typescript
import Parser from 'rss-parser';

const parser = new Parser();
const seenItems = new Set<string>();

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function formatPost(item: Parser.Item): string {
  const title = item.title || 'New Article';
  const maxLength = 250;
  return title.length > maxLength
    ? `${title.slice(0, maxLength - 3)}...`
    : title;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').slice(0, 300);
}

async function pollFeed(feedUrl: string) {
  const feed = await parser.parseURL(feedUrl);

  for (const item of feed.items) {
    const id = item.guid || item.link;
    if (!id || seenItems.has(id)) continue;

    try {
      const result = await callTool<{ uri: string }>('create_post', {
        text: formatPost(item),
        embed: item.link
          ? {
              external: {
                uri: item.link,
                title: item.title || 'Article',
                description: stripHtml(
                  item.contentSnippet || item.content || ''
                ),
              },
            }
          : undefined,
      });
      console.log(`Posted RSS item: ${item.title} -> ${result.uri}`);
    } catch (error) {
      console.error('Failed to post RSS item:', error);
    }

    seenItems.add(id);
    await delay(5000); // Pace calls to stay under the per-tool rate limit.
  }
}

// Poll every 15 minutes.
setInterval(() => pollFeed('https://example.com/feed.xml'), 15 * 60 * 1000);
```

## Webhook Integration

### Webhook Server

Your own HTTP server receives webhooks and forwards them to the MCP server via
`create_post`. Note that the HTTP listener belongs to **your** application — in
this example the AT Protocol MCP Server is reached over its default stdio
transport and binds no port of its own.

```typescript
import express from 'express';

const app = express();
app.use(express.json());

app.post('/webhook/post', async (req, res) => {
  try {
    const { text, embed } = req.body;
    const result = await callTool<{ uri: string }>('create_post', {
      text,
      embed,
    });
    res.json({ success: true, uri: result.uri });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.listen(3000, () => {
  console.log('Webhook server listening on port 3000');
});
```

## Backup and Archive System

### Account Backup

Pages through a user's posts with `search_posts` and saves a profile snapshot
with `get_user_profile`. `get_user_profile` is an enhanced tool that works
without authentication, but `search_posts` requires authentication (the AT
Protocol search API changed in 2025 to require auth), so credentials must be set
in the spawned server's environment for the backup loop below.

::: warning

`search_posts` requires authentication **and** a non-empty `q`. An empty query
does **not** return all of an author's posts — combine a query term with the
`author` filter, and page with `cursor`.

:::

```typescript
import { writeFileSync } from 'fs';

interface SearchResult {
  posts: unknown[];
  cursor?: string;
}

async function backupPosts(query: string, authorHandle: string) {
  const allPosts: unknown[] = [];
  let cursor: string | undefined;

  do {
    const results = await callTool<SearchResult>('search_posts', {
      q: query,
      author: authorHandle,
      limit: 100,
      cursor,
    });

    allPosts.push(...results.posts);
    cursor = results.cursor;
    console.log(`Backed up ${allPosts.length} posts...`);
  } while (cursor);

  writeFileSync(
    `backup-${authorHandle}-${Date.now()}.json`,
    JSON.stringify(
      {
        author: authorHandle,
        query,
        timestamp: new Date().toISOString(),
        postCount: allPosts.length,
        posts: allPosts,
      },
      null,
      2
    )
  );
  console.log(`Backup complete: ${allPosts.length} posts`);
}

async function backupProfile(authorHandle: string) {
  const profile = await callTool('get_user_profile', { actor: authorHandle });
  writeFileSync(
    `profile-${authorHandle}-${Date.now()}.json`,
    JSON.stringify(profile, null, 2)
  );
  console.log('Profile backup complete');
}

// Usage
await backupPosts('atproto', 'alice.bsky.social');
await backupProfile('alice.bsky.social');
```

## Cross-Platform Posting

### Multi-Platform Publisher

Fans a single message out to several destinations. The AT Protocol destination
is just a `create_post` call; add your own functions for other platforms.

```typescript
interface Platform {
  name: string;
  post: (text: string) => Promise<void>;
}

async function publish(platforms: Platform[], text: string) {
  const results = await Promise.allSettled(platforms.map(p => p.post(text)));

  results.forEach((result, i) => {
    const platform = platforms[i];
    if (result.status === 'fulfilled') {
      console.log(`Posted to ${platform.name}`);
    } else {
      console.error(`Failed to post to ${platform.name}:`, result.reason);
    }
  });
}

// Usage
const platforms: Platform[] = [
  {
    name: 'AT Protocol',
    post: async text => {
      await callTool('create_post', { text });
    },
  },
  // Add other platforms, e.g. Mastodon, by implementing their own `post`.
];

await publish(platforms, 'Hello from all platforms!');
```

## Graceful Shutdown

When your integration runs as a long-lived process, close the MCP client cleanly
on exit so the spawned server process is torn down with it.

```typescript
async function shutdown() {
  console.log('Shutting down gracefully...');
  try {
    await client.close(); // Closes the stdio transport and the child process.
  } finally {
    process.exit(0);
  }
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
```

## Streaming-based integrations

Real-time patterns such as live analytics, firehose-driven moderation, and
event-driven bots are **not supported** by this server, and streaming tools are
not planned: MCP tools are request/response, so a tool could only return a
buffered snapshot of past events, not a live stream. The leftover firehose
client code has been removed; if event consumption is ever added it would be
built fresh on Jetstream. See
[Experimental & Roadmap](../guide/experimental.md) for the current status.

If you need a polling-based approximation, `discover` with `mode: "trending"`
samples your own home timeline (roughly the latest 100 posts, not the network
firehose) and can be called on an interval the same way as the tools above.

## See Also

- [Basic Usage Examples](./basic-usage.md)
- [Social Operations Examples](./social-operations.md)
- [Content Management Examples](./content-management.md)
- [Experimental & Roadmap](../guide/experimental.md)
- [API Reference](../api/index.md)
