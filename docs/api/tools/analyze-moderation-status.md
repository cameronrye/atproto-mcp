# analyze_moderation_status

Analyze moderation status of a post or user. Returns content labels, moderation
decisions, and personal moderation state (blocks, mutes). Subject can be a DID
(for users) or AT-URI (for posts).

## Authentication

**Required:** Yes (Private tool). Personal moderation state (your blocks and
mutes of the subject) is only meaningful when authenticated.

## Parameters

| Parameter       | Type      | Required | Default | Description                                                                                                                                                                                                              |
| --------------- | --------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `subject`       | `string`  | Yes      | -       | The thing to analyze. For a **user**, pass a handle (`alice.bsky.social`) or DID (`did:plc:...`). For a **post**, pass its AT-URI (`at://...`). The subject type is inferred from whether the value starts with `at://`. |
| `includeLabels` | `boolean` | No       | `true`  | Whether to include content labels in the response.                                                                                                                                                                       |

## Response

Tool results are returned as stringified JSON text. The illustrative shape is:

```typescript
{
  success: boolean;
  subject: string;        // echoes the subject you passed in
  subjectType: 'user' | 'post';
  moderation: {
    labels?: Array<{
      src: string;
      uri: string;
      val: string;
      cts: string;
    }>;
    blocked?: boolean;        // you block this user (derived from `blocking`)
    muted?: boolean;          // you mute this user
    blockedBy?: boolean;      // this user blocks you
    blocking?: string;        // AT-URI of your block record, if any
    mutedByList?: boolean;    // muted via a list (users only)
    blockingByList?: boolean; // blocked via one of your lists (users only)
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

For a **post** subject, only `blocked`, `muted`, and `blockedBy` (reflecting the
post author's relationship to you) are populated; the list-based fields apply to
user subjects only.

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

A missing or unresolvable subject (handle/DID/post not found, or a post that is
itself blocked) surfaces as the underlying AT Protocol error. Per-tool rate
limiting also applies (see below).

## Subject Types

- **User** - pass a handle (`alice.bsky.social`) or DID (`did:plc:abc123`).
  Returns profile-level labels and your blocks/mutes of that user.
- **Post** - pass an AT-URI (`at://did:plc:abc123/app.bsky.feed.post/xyz1`).
  Returns post-level labels and the author's moderation state relative to you.

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

### Personal Moderation

- **`blocked`**: You have blocked this user
- **`muted`**: You have muted this user
- **`blockedBy`**: This user has blocked you
- **`blocking`**: AT-URI of your block record for this user, if any
- **`mutedByList`**: Muted via a list
- **`blockingByList`**: Blocked via one of your lists

### Public Moderation

- **`labels`**: Content labels applied by moderators or automated systems
- **`hasContentWarnings`**: Whether content has any warnings
- **`isNSFW`**: Whether content is marked as NSFW
- **`isSpam`**: Whether content is marked as spam

## Rate Limiting

Calls are rate limited per tool to 100 requests per minute (see the
[error handling guide](../../guide/error-handling.md)).

## Related Tools

- **[block_user](./block-user.md)** - Block a user
- **[mute_user](./mute-user.md)** - Mute a user
- **[report_content](./report-content.md)** - Report inappropriate content
- **[report_user](./report-user.md)** - Report a user
- **[get_user_profile](./get-user-profile.md)** - Get user profile
- **[get_post_context](./get-post-context.md)** - Get post context

## See Also

- [Moderation Tools](../../guide/tools-resources.md#moderation)
- [AT Protocol Moderation](https://docs.bsky.app/docs/advanced-guides/moderation)
