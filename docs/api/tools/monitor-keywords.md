# monitor_keywords

Monitor the firehose for posts containing specific keywords. Returns matching posts from the event buffer.

## Authentication

**Optional** - This tool works without authentication but requires the firehose to be started first using `start_streaming`.

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `keywords` | `string[]` | Yes | - | Array of keywords to monitor. At least one keyword is required. |
| `limit` | `number` | No | `20` | Maximum number of matching posts to return. Must be between 1 and 100. |
| `caseSensitive` | `boolean` | No | `false` | Whether keyword matching should be case-sensitive. |

## Response

```typescript
{
  success: boolean;
  keywords: string[];
  matches: Array<{
    keyword: string;
    post: {
      uri: string;
      text: string;
      author: string;
      createdAt: string;
    };
    seq: number;
    receivedAt: string;
  }>;
  totalMatches: number;
  totalScanned: number;
}
```

## Examples

### Monitor Single Keyword

```json
{
  "keywords": ["bluesky"],
  "limit": 10
}
```

### Monitor Multiple Keywords (Case-Sensitive)

```json
{
  "keywords": ["AI", "ML", "LLM"],
  "limit": 50,
  "caseSensitive": true
}
```

### Monitor Hashtags

```json
{
  "keywords": ["#technology", "#programming", "#webdev"],
  "limit": 25
}
```

## Error Handling

Common errors:

- **`InvalidRequest`**: No keywords provided or invalid parameters
- **`StreamingNotStarted`**: Firehose streaming must be started first using `start_streaming`
- **`RateLimitExceeded`**: Too many requests in a short period

## Best Practices

1. **Start Streaming First**: Always call `start_streaming` before using this tool
2. **Use Specific Keywords**: More specific keywords reduce noise and improve relevance
3. **Adjust Limit**: Start with a smaller limit and increase as needed
4. **Case Sensitivity**: Use case-sensitive matching for acronyms and proper nouns
5. **Buffer Size**: The tool scans the event buffer, which has a maximum size - older events may be dropped
6. **Combine Keywords**: Use multiple related keywords to capture variations
7. **Monitor Hashtags**: Include hashtags to track specific topics or trends

## Rate Limiting

This tool reads from the local event buffer and is not subject to AT Protocol API rate limits. However, the firehose connection itself has limits:

- Maximum 1 concurrent firehose connection per client
- Event buffer size is limited (typically 1000 events)
- Older events are dropped as new ones arrive

## Related Tools

- **[start_streaming](./start-streaming.md)** - Start the firehose stream (required before using this tool)
- **[stop_streaming](./stop-streaming.md)** - Stop the firehose stream
- **[get_streaming_status](./get-streaming-status.md)** - Check firehose connection status
- **[get_recent_events](./get-recent-events.md)** - Get recent events from the buffer
- **[track_users](#track-users)** - Track activity from specific users
- **[search_posts](./search-posts.md)** - Search historical posts (alternative to real-time monitoring)

## See Also

- [Streaming Tools Guide](../../guide/tools-resources.md#streaming--real-time)
- [AT Protocol Firehose Documentation](https://docs.bsky.app/docs/advanced-guides/firehose)

