# report_content

Report content (a post) that violates community guidelines or terms of service.

## Authentication

**Required:** Yes (Private tool)

## Parameters

### `subject` (required)

- **Type:** `object`
- **Description:** Strong reference to the content to report
- **Properties:**
  - `uri` (string, required): AT Protocol URI of the content (`at://...`)
  - `cid` (string, required): Content identifier (CID) of the content

### `reasonType` (required)

- **Type:** `string`
- **Values:** `spam` | `violation` | `misleading` | `sexual` | `rude` | `other`
- **Description:** Category of the report. Mapped to the corresponding
  `com.atproto.moderation.defs#reason*` value.

### `reason` (optional)

- **Type:** `string`
- **Constraints:** Up to 2000 characters
- **Description:** Additional details about the report

## Response

Tool results are returned as stringified JSON text. The illustrative shape is:

```typescript
{
  success: boolean;
  message: string;
  reportId: string;          // server-assigned report id, as a string
  reportDetails: {
    subject: string;         // the reported content's AT-URI
    reasonType: string;
    reason?: string;
  };
}
```

## Examples

### Report Spam Post

```json
{
  "subject": {
    "uri": "at://did:plc:abc123/app.bsky.feed.post/spam123",
    "cid": "bafyreiabc123..."
  },
  "reasonType": "spam",
  "reason": "Repeated promotional content"
}
```

**Response (illustrative):**

```json
{
  "success": true,
  "message": "Content has been reported successfully. Moderators will review your report.",
  "reportId": "12345",
  "reportDetails": {
    "subject": "at://did:plc:abc123/app.bsky.feed.post/spam123",
    "reasonType": "spam",
    "reason": "Repeated promotional content"
  }
}
```

### Report Misleading Information

```json
{
  "subject": {
    "uri": "at://did:plc:abc123/app.bsky.feed.post/post789",
    "cid": "bafyreiabc123..."
  },
  "reasonType": "misleading",
  "reason": "Contains false medical information"
}
```

## Reason Types

- **`spam`** - unwanted promotional content, repetitive posts, scams or
  phishing.
- **`violation`** - terms-of-service violations, illegal content, impersonation.
- **`misleading`** - false information, manipulated media, deceptive practices.
- **`sexual`** - inappropriate or unsolicited sexual content.
- **`rude`** - harassment, bullying, hate speech, personal attacks.
- **`other`** - anything not covered above; describe it in `reason`.

## Error Handling

Validation runs before any network call:

- A `subject.uri` that does not start with `at://` raises a `VALIDATION_ERROR`.
- A malformed `subject.cid` raises a `VALIDATION_ERROR`.
- A `reasonType` outside the allowed values, or a `reason` over 2000 characters,
  raises a `VALIDATION_ERROR`.

Other failures (content not found, network errors) surface as the underlying AT
Protocol error.

## Related Tools

- **[report_user](./report-user.md)** - Report a user account
- **[block_user](./block-user.md)** - Block a user
- **[mute_user](./mute-user.md)** - Mute a user

## See Also

- [Moderation Tools](../../guide/tools-resources.md#moderation)
- [AT Protocol Moderation](https://docs.bsky.app/docs/advanced-guides/moderation)
