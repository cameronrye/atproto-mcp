# report_user

Report a user account that violates community guidelines or terms of service.

## Authentication

**Required:** Yes (Private tool)

## Parameters

### `actor` (required)

- **Type:** `string`
- **Description:** User identifier (DID or handle) to report. Handles are
  resolved to a DID, because a moderation `repoRef` subject must be a DID.

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
    actor: string;           // echoes the actor you passed in
    reasonType: string;
    reason?: string;
  };
}
```

## Examples

### Report Spam Account

```json
{
  "actor": "spambot.bsky.social",
  "reasonType": "spam",
  "reason": "Automated spam account posting promotional content"
}
```

**Response (illustrative):**

```json
{
  "success": true,
  "message": "User has been reported successfully. Moderators will review your report.",
  "reportId": "12345",
  "reportDetails": {
    "actor": "spambot.bsky.social",
    "reasonType": "spam",
    "reason": "Automated spam account posting promotional content"
  }
}
```

### Report Impersonation

```json
{
  "actor": "fake-celebrity.bsky.social",
  "reasonType": "misleading",
  "reason": "Impersonating a public figure"
}
```

### Report Harassment

```json
{
  "actor": "harasser.bsky.social",
  "reasonType": "violation",
  "reason": "Persistent harassment across multiple posts"
}
```

## Reason Types

- **`spam`** - bot accounts, mass promotional accounts, scam or engagement-farm
  accounts.
- **`violation`** - terms-of-service violations, harassment campaigns, illegal
  activity.
- **`misleading`** - impersonation, fake accounts, deceptive practices.
- **`sexual`** - accounts primarily posting prohibited sexual content.
- **`rude`** - accounts engaged in harassment or hateful conduct.
- **`other`** - anything not covered above; describe it in `reason`.

## report_user vs report_content

- **report_user** targets the account (a `repoRef` subject) for account-level
  issues or a pattern of violations.
- **report_content** targets a specific post (a `strongRef` subject) for a
  single piece of violating content.

## Error Handling

An `actor` that is neither a DID nor a handle, a `reasonType` outside the
allowed values, or a `reason` over 2000 characters raises a `VALIDATION_ERROR`
before any network call. Unresolvable handles and other failures surface as the
underlying AT Protocol error.

## Related Tools

- **[report_content](./report-content.md)** - Report specific content
- **[block_user](./block-user.md)** - Block a user
- **[mute_user](./mute-user.md)** - Mute a user

## See Also

- [Moderation Tools](../../guide/tools-resources.md#moderation)
- [AT Protocol Moderation](https://docs.bsky.app/docs/advanced-guides/moderation)
