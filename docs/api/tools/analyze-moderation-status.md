# analyze_moderation_status

Analyze moderation status of a post or user. Returns content labels, moderation decisions, and personal moderation state (blocks, mutes). Subject can be a DID (for users) or AT-URI (for posts).

## Authentication

**Enhanced** - This tool works without authentication but provides additional personal moderation state when authenticated.

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `subject` | `string` | Yes | - | DID (for users) or AT-URI (for posts) to analyze. |
| `includeLabels` | `boolean` | No | `true` | Whether to include content labels in the response. |

## Response

```typescript
{
  success: boolean;
  subject: string;
  subjectType: 'user' | 'post';
  moderation: {
    labels?: Array<{
      src: string;
      uri: string;
      val: string;
      cts: string;
    }>;
    blocked?: boolean;
    muted?: boolean;
    blockedBy?: boolean;
    blocking?: boolean;
    mutedByList?: boolean;
    blockedByList?: boolean;
  };
  analysis: {
    hasContentWarnings: boolean;
    isNSFW: boolean;
    isSpam: boolean;
    requiresWarning: boolean;
    safetyLevel: 'safe' | 'warning' | 'restricted' | 'blocked';
  };
}
```

## Examples

### Analyze User Moderation Status

```json
{
  "subject": "did:plc:abc123",
  "includeLabels": true
}
```

### Analyze Post Moderation Status

```json
{
  "subject": "at://did:plc:abc123/app.bsky.feed.post/xyz1",
  "includeLabels": true
}
```

### Quick Moderation Check (No Labels)

```json
{
  "subject": "alice.bsky.social",
  "includeLabels": false
}
```

## Error Handling

Common errors:

- **`InvalidRequest`**: Invalid subject or parameters
- **`SubjectNotFound`**: User or post does not exist
- **`RateLimitExceeded`**: Too many requests in a short period

## Best Practices

1. **Check Before Engaging**: Analyze moderation status before interacting with content
2. **Include Labels**: Set `includeLabels: true` for complete moderation picture
3. **Respect Safety Levels**: Honor safety level indicators in your application
4. **Monitor Changes**: Re-check moderation status periodically for active content
5. **Handle Blocked Content**: Gracefully handle blocked or restricted content
6. **User Privacy**: Don't expose detailed moderation state publicly
7. **Combine with Context**: Use alongside other tools for complete content analysis

## Subject Types

### User (DID or Handle)
- Analyzes user account moderation status
- Returns profile-level labels and blocks/mutes
- Example: `did:plc:abc123` or `alice.bsky.social`

### Post (AT-URI)
- Analyzes individual post moderation status
- Returns post-level labels and author moderation state
- Example: `at://did:plc:abc123/app.bsky.feed.post/xyz1`

## Content Labels

Common label values:
- **`porn`**: Adult sexual content
- **`sexual`**: Sexually suggestive content
- **`nudity`**: Nudity (artistic or otherwise)
- **`graphic-media`**: Graphic violence or disturbing imagery
- **`spam`**: Spam or misleading content
- **`impersonation`**: Impersonation of another user

## Safety Levels

- **`safe`**: No content warnings, safe for all audiences
- **`warning`**: Has content warnings, user discretion advised
- **`restricted`**: Restricted content, may be hidden by default
- **`blocked`**: Blocked content, should not be displayed

## Moderation State

### Personal Moderation (requires authentication)
- **`blocked`**: You have blocked this user
- **`muted`**: You have muted this user
- **`blockedBy`**: This user has blocked you
- **`blocking`**: You are blocking this user
- **`mutedByList`**: Muted via a moderation list
- **`blockedByList`**: Blocked via a moderation list

### Public Moderation
- **`labels`**: Content labels applied by moderators or automated systems
- **`hasContentWarnings`**: Whether content has any warnings
- **`isNSFW`**: Whether content is marked as NSFW
- **`isSpam`**: Whether content is marked as spam

## Use Cases

- **Content Filtering**: Filter content based on moderation status
- **Safety Checks**: Verify content safety before displaying
- **User Verification**: Check if users are blocked or muted
- **Compliance**: Ensure content meets community guidelines
- **Moderation Tools**: Build moderation interfaces
- **Reporting**: Identify content that may need reporting

## Rate Limiting

This tool is subject to AT Protocol API rate limits:

- 3,000 requests per hour for authenticated users
- 300 requests per hour for unauthenticated users

## Related Tools

- **[block_user](./block-user.md)** - Block a user
- **[mute_user](./mute-user.md)** - Mute a user
- **[report_content](./report-content.md)** - Report inappropriate content
- **[report_user](./report-user.md)** - Report a user
- **[get_user_profile](./get-user-profile.md)** - Get user profile
- **[get_post_context](#get-post-context)** - Get post context

## See Also

- [Enhanced Moderation Guide](../../guide/tools-resources.md#enhanced-moderation)
- [AT Protocol Moderation](https://docs.bsky.app/docs/advanced-guides/moderation)

