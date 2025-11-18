# create_thread

Create a multi-post thread on AT Protocol. Posts are automatically chained together with proper reply structure. Useful for longer-form content that exceeds the 300-character limit.

## Authentication

**Required** - This tool requires authentication to create posts.

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `posts` | `Array<{text: string, langs?: string[]}>` | Yes | - | Array of posts to create in the thread. Each post can have text and optional language tags. |
| `langs` | `string[]` | No | - | Default language tags for all posts (e.g., `["en"]`). Can be overridden per post. |

## Response

```typescript
{
  success: boolean;
  message: string;
  thread: Array<{
    uri: string;
    cid: string;
    text: string;
    position: number;
    isRoot: boolean;
  }>;
  rootPost: {
    uri: string;
    cid: string;
  };
  totalPosts: number;
}
```

## Examples

### Create Simple Thread

```json
{
  "posts": [
    { "text": "This is the first post in my thread. It introduces the topic." },
    { "text": "This is the second post, continuing the thought from the first." },
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
    { "text": "1/ Traditional social networks are controlled by single companies. This creates several problems..." },
    { "text": "2/ First, your data is owned by the platform, not by you. They can change the rules at any time..." },
    { "text": "3/ Second, algorithms decide what you see, often optimizing for engagement over quality..." },
    { "text": "4/ Decentralized networks like AT Protocol solve these issues by giving users control..." },
    { "text": "5/ With AT Protocol, you own your data, choose your algorithm, and can move between apps freely." }
  ],
  "langs": ["en"]
}
```

## Error Handling

Common errors:

- **`AuthenticationRequired`**: Must be authenticated to use this tool
- **`InvalidRequest`**: Invalid posts array (empty or invalid format)
- **`TextTooLong`**: One or more posts exceed 300 characters
- **`TextRequired`**: One or more posts have empty text
- **`RateLimitExceeded`**: Too many post requests in a short period
- **`ThreadCreationFailed`**: Failed to create one or more posts in the thread

## Best Practices

1. **Plan Your Thread**: Outline the full thread before creating it
2. **Keep Posts Focused**: Each post should contain one complete thought
3. **Use Numbering**: Number posts (1/, 2/, 3/) to show thread structure
4. **Start Strong**: Make the first post engaging to hook readers
5. **End with CTA**: Consider ending with a call-to-action or summary
6. **Check Character Limits**: Ensure each post is under 300 characters
7. **Use Thread Indicators**: Start with "Thread:" or use 🧵 emoji
8. **Set Languages**: Specify language tags for better discoverability

## Thread Structure

- **Root Post**: The first post in the thread (position 1)
- **Reply Chain**: Each subsequent post replies to the previous one
- **Root Reference**: All posts maintain a reference to the root post
- **Automatic Linking**: The tool handles all reply structure automatically

## Character Limits

- Each post must be 300 characters or less
- No limit on number of posts in a thread
- Recommended: 3-10 posts for optimal engagement

## Language Tags

Common language codes:
- `en` - English
- `es` - Spanish
- `fr` - French
- `de` - German
- `ja` - Japanese
- `pt` - Portuguese
- `zh` - Chinese

## Rate Limiting

This tool is subject to AT Protocol API rate limits:

- 3,000 requests per hour for authenticated users
- Each post in the thread counts as a separate operation
- Large threads may hit rate limits

## Related Tools

- **[create_post](./create-post.md)** - Create a single post
- **[reply_to_post](./reply-to-post.md)** - Reply to an existing post
- **[get_thread](./get-thread.md)** - View an existing thread
- **[delete_post](./delete-post.md)** - Delete posts from a thread

## See Also

- [Composite Operations Guide](../../guide/tools-resources.md#composite-operations)
- [Content Management Guide](../../guide/tools-resources.md#content-management)
- [AT Protocol Post Limits](https://docs.bsky.app/docs/advanced-guides/posts)

