# report_user

Report a user account for policy violations.

## Authentication

**Required:** Yes (Private tool)

## Parameters

### `actor` (required)
- **Type:** `string`
- **Description:** User identifier (DID or handle) to report

### `reasonType` (required)
- **Type:** `string`
- **Description:** Reason for report
- **Values:**
  - `spam` - Spam account
  - `violation` - Terms of service violation
  - `misleading` - Impersonation or misleading account
  - `other` - Other reason

### `reason` (optional)
- **Type:** `string`
- **Description:** Additional details about the report

## Response

```typescript
{
  success: boolean;
  message: string;
  reportId: string;
  reportedUser: {
    did: string;
    handle?: string;
  }
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

**Response:**
```json
{
  "success": true,
  "message": "User reported successfully",
  "reportId": "report_user_abc123",
  "reportedUser": {
    "did": "did:plc:abc123xyz789",
    "handle": "spambot.bsky.social"
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

## Report Types

### `spam`
- Bot accounts
- Mass promotional accounts
- Scam accounts
- Fake engagement farms

### `violation`
- Terms of service violations
- Harassment campaigns
- Hate speech accounts
- Illegal activity

### `misleading`
- Impersonation
- Fake accounts
- Deceptive practices
- Identity fraud

### `other`
- Issues not covered by other categories
- Provide detailed reason

## Error Handling

### Common Errors

#### Invalid Actor
```json
{
  "error": "Actor (DID or handle) is required",
  "code": "VALIDATION_ERROR"
}
```

#### User Not Found
```json
{
  "error": "User not found",
  "code": "NOT_FOUND"
}
```

#### Cannot Report Self
```json
{
  "error": "Cannot report yourself",
  "code": "INVALID_OPERATION"
}
```

## Best Practices

### When to Report Users
- Persistent policy violations
- Coordinated abuse
- Impersonation
- Automated spam
- Safety threats

### vs. Reporting Content
- **Report User**: Pattern of violations, account-level issues
- **Report Content**: Specific post or content violations

### Reporting Guidelines
- Document specific violations
- Include relevant context
- Report patterns, not single incidents
- Provide evidence when possible

### User Experience
- Make reporting accessible
- Explain reporting process
- Confirm submission
- Provide status updates

### Follow-up Actions
- Block the user
- Mute to avoid content
- Report individual posts if needed
- Contact platform support for urgent issues

## What Happens After Reporting

### Review Process
1. Report submitted to moderation team
2. Account reviewed for violations
3. Pattern analysis conducted
4. Action taken if violations confirmed

### Possible Outcomes
- Account warned
- Account suspended
- Account banned
- Content removed
- No action (no violation found)

## Privacy and Safety

- Reports are confidential
- Reporter identity protected
- Report details not shared with reported user
- Multiple reports may trigger faster review

## Related Tools

- **[report_content](./report-content.md)** - Report specific content
- **[block_user](./block-user.md)** - Block a user
- **[mute_user](./mute-user.md)** - Mute a user

## See Also

- [Moderation Guide](../../guide/tools-resources.md#moderation)
- [Community Guidelines](../../guide/tools-resources.md#guidelines)
- [Safety Best Practices](../../guide/tools-resources.md#safety)

