# create_thread

Create a multi-post thread on AT Protocol. Posts are automatically chained
together with proper reply structure. Useful for longer-form content that
exceeds the 300-character limit.

## Authentication

**Required** - This tool requires authentication to create posts.

## Parameters

| Parameter | Type                                      | Required | Default | Description                                                                                                                          |
| --------- | ----------------------------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `posts`   | `Array<{text: string, langs?: string[]}>` | Yes      | -       | Posts to create in the thread. **2 to 25** posts; each `text` is 1-300 characters. Each post can have optional BCP-47 language tags. |
| `langs`   | `string[]`                                | No       | -       | Default BCP-47 language tags for all posts (e.g., `["en"]`, `["pt-BR"]`). Can be overridden per post.                                |

## Response

Tool results are returned as stringified JSON text. The shape below is
illustrative.

```typescript
{
  success: boolean;
  message: string;
  thread: Array<{
    uri: string;
    cid: string;
    text: string;
    position: number; // 1-based order in the thread
    isRoot: boolean; // true only for the first post
  }>;
  rootPost: {
    uri: string;
    cid: string;
  }
  totalPosts: number;
}
```

Posts are created sequentially. Each non-root post replies to the previous one
and references the root post, so `thread[0]` has `position: 1` and
`isRoot: true`, and every later entry has `isRoot: false`.

## Examples

### Create Simple Thread

```json
{
  "posts": [
    { "text": "This is the first post in my thread. It introduces the topic." },
    {
      "text": "This is the second post, continuing the thought from the first."
    },
    { "text": "And this is the conclusion of my thread." }
  ],
  "langs": ["en"]
}
```

### Create Thread with Per-Post Languages

```json
{
  "posts": [
    { "text": "Hello everyone! This is in English.", "langs": ["en"] },
    { "text": "Bonjour! Ceci est en français.", "langs": ["fr"] },
    { "text": "¡Hola! Esto es en español.", "langs": ["es"] }
  ]
}
```

### Create Long-Form Content Thread

```json
{
  "posts": [
    { "text": "Thread: Why decentralized social networks matter 🧵" },
    {
      "text": "1/ Traditional social networks are controlled by single companies. This creates several problems..."
    },
    {
      "text": "2/ First, your data is owned by the platform, not by you. They can change the rules at any time..."
    },
    {
      "text": "3/ Second, algorithms decide what you see, often optimizing for engagement over quality..."
    },
    {
      "text": "4/ Decentralized networks like AT Protocol solve these issues by giving users control..."
    },
    {
      "text": "5/ With AT Protocol, you own your data, choose your algorithm, and can move between apps freely."
    }
  ],
  "langs": ["en"]
}
```

## Error Handling

Common errors (most are surfaced as schema validation failures before any post
is created):

- **Authentication required**: Must be authenticated to create posts
- **Too few / too many posts**: The thread must contain 2-25 posts
- **Empty text**: A post has empty text (minimum 1 character)
- **Text too long**: A post exceeds 300 characters
- **Invalid language tag**: A `langs` entry is not a valid BCP-47 tag

Because posts are created one at a time, a failure partway through can leave the
earlier posts already published.

## Thread Structure

- **Root Post**: The first post in the thread (position 1)
- **Reply Chain**: Each subsequent post replies to the previous one
- **Root Reference**: All posts maintain a reference to the root post
- **Automatic Linking**: The tool handles all reply structure automatically

## Limits

- Each post must be 1-300 characters
- A thread must contain between 2 and 25 posts

## Language Tags

Language tags use BCP-47 (e.g. `en`, `en-US`, `pt-BR`, `ja`, `zh-Hant`). Provide
a thread-wide default via `langs`, or override per post.

## Rate Limiting

Subject to the server's per-tool limit of 100 requests per minute. Each post in
the thread is created with a separate `agent.post` call, so a long thread
consumes several requests against that limit.

## Related Tools

- **[create_post](./create-post.md)** - Create a single post
- **[reply_to_post](./reply-to-post.md)** - Reply to an existing post
- **[get_thread](./get-thread.md)** - View an existing thread
- **[delete_post](./delete-post.md)** - Delete posts from a thread

## See Also

- [Composite Operations Guide](../../guide/tools-resources.md#composite-operations)
- [Content Management Guide](../../guide/tools-resources.md#content-management)
- [AT Protocol Post Limits](https://docs.bsky.app/docs/advanced-guides/posts)
