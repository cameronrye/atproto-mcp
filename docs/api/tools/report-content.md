# report_content

Report content (post, image, etc.) for policy violations.

## Authentication

**Required:** Yes (Private tool)

## Parameters

### `subject` (required)
- **Type:** `object`
- **Description:** Content to report
- **Properties:**
  - `uri`: AT Protocol URI of the content
  - `cid`: Content identifier

### `reasonType` (required)
- **Type:** `string`
- **Description:** Reason for report
- **Values:**
  - `spam` - Spam or unwanted content
  - `violation` - Terms of service violation
  - `misleading` - Misleading or false information
  - `sexual` - Sexual content
  - `rude` - Rude or harassing content
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
  reportedContent: {
    uri: string;
    cid: string;
  }
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

**Response:**
```json
{
  "success": true,
  "message": "Content reported successfully",
  "reportId": "report_abc123",
  "reportedContent": {
    "uri": "at://did:plc:abc123/app.bsky.feed.post/spam123",
    "cid": "bafyreiabc123..."
  }
}
```

### Report Harassment

```json
{
  "subject": {
    "uri": "at://did:plc:abc123/app.bsky.feed.post/post456",
    "cid": "bafyreiabc123..."
  },
  "reasonType": "rude",
  "reason": "Targeted harassment and personal attacks"
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

## Report Types

### `spam`
- Unwanted promotional content
- Repetitive posts
- Bot-generated content
- Scams or phishing

### `violation`
- Terms of service violations
- Illegal content
- Copyright infringement
- Impersonation

### `misleading`
- False information
- Manipulated media
- Deceptive practices
- Misinformation

### `sexual`
- Inappropriate sexual content
- Unsolicited sexual content
- Sexual exploitation

### `rude`
- Harassment
- Bullying
- Hate speech
- Personal attacks

### `other`
- Issues not covered by other categories
- Provide detailed reason in description

## Error Handling

### Common Errors

#### Invalid Subject
```json
{
  "error": "Subject URI and CID are required",
  "code": "VALIDATION_ERROR"
}
```

#### Invalid Reason Type
```json
{
  "error": "Invalid reason type",
  "code": "VALIDATION_ERROR"
}
```

#### Content Not Found
```json
{
  "error": "Content not found",
  "code": "NOT_FOUND"
}
```

## Best Practices

### When to Report
- Clear policy violations
- Harmful content
- Illegal activity
- Safety concerns

### Reporting Guidelines
- Be specific in reason description
- Provide context when helpful
- Don't abuse reporting system
- Report genuine violations only

### User Experience
- Make reporting easily accessible
- Explain reporting process
- Confirm report submission
- Provide report status updates

### Follow-up Actions
- Block user if needed
- Mute to avoid seeing content
- Document patterns of abuse
- Contact platform support for urgent issues

## What Happens After Reporting

### Review Process
1. Report submitted to moderation team
2. Content reviewed against policies
3. Action taken if violation confirmed
4. Reporter may receive outcome notification

### Possible Outcomes
- Content removed
- User warned
- User suspended
- No action (no violation found)

## Privacy

- Reports are confidential
- Reporter identity protected
- Report details not shared with reported user
- Moderation decisions may be appealed

## Related Tools

- **[report_user](./report-user.md)** - Report a user account
- **[block_user](./block-user.md)** - Block a user
- **[mute_user](./mute-user.md)** - Mute a user

## See Also

- [Moderation Guide](../../guide/tools-resources.md#moderation)
- [Community Guidelines](../../guide/tools-resources.md#guidelines)
- [Safety Best Practices](../../guide/tools-resources.md#safety)

