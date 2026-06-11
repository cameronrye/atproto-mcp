# send_direct_message

Send a plain-text Bluesky direct message (`chat.bsky.convo.sendMessage`).
Target either an existing conversation by `convoId`, or a recipient by handle
or DID via `member` — in that case the conversation is resolved (or created)
automatically with `chat.bsky.convo.getConvoForMembers`, so you can DM someone
without listing conversations first. Every call is proxied to the Bluesky chat
service (`did:web:api.bsky.chat`) — DMs are not served by the PDS.

Messages are sent as plain text: mentions, links, and hashtags appear as
literal text (no facets are attached).

## Authentication

**Required:** Yes (Private tool)

Direct messages additionally require that the app password used for the
session was created with **"Allow access to your direct messages"** enabled
(bsky.app → Settings → Privacy and Security → App Passwords). Without it, the
chat service rejects every call with `401 "Bad token scope"`. The recipient's
chat settings must also allow messages from your account.

## Parameters

Exactly one of `convoId` or `member` must be provided.

### `convoId` (optional)

- **Type:** `string`
- **Description:** Id of an existing conversation to send into, from
  `list_conversations` or a previous `send_direct_message` response

### `member` (optional)

- **Type:** `string`
- **Description:** Handle (e.g. `bob.bsky.social`) or DID of the account to
  message. Handles are resolved to DIDs, then the conversation is looked up
  (or created) via `chat.bsky.convo.getConvoForMembers`

### `text` (required)

- **Type:** `string`
- **Constraints:** 1-1000 graphemes and at most 10000 UTF-8 bytes (the
  `chat.bsky.convo.defs#messageInput` lexicon limits)
- **Description:** Plain-text message body

## Response

Tool results are returned as stringified JSON text. The shape below is
illustrative.

```typescript
{
  success: boolean;
  message: string;        // Human-readable status message
  convoId: string;        // Reuse for follow-up messages to skip resolution
  recipientDid?: string;  // Present only when member was used
  sentMessage: {
    id?: string;
    senderDid?: string;
    text?: string;
    sentAt?: string;      // ISO 8601 timestamp
    deleted: boolean;
    hasEmbed: boolean;
  };
}
```

## Examples

### Send Into a Known Conversation

```json
{
  "convoId": "3kx...abc",
  "text": "On my way!"
}
```

### Message Someone by Handle

```json
{
  "member": "bob.bsky.social",
  "text": "Hi Bob — loved your latest post."
}
```

**Response:**

```json
{
  "success": true,
  "message": "Direct message sent successfully",
  "convoId": "3kx...abc",
  "recipientDid": "did:plc:abc123",
  "sentMessage": {
    "id": "3ky...def",
    "senderDid": "did:plc:self",
    "text": "Hi Bob — loved your latest post.",
    "sentAt": "2026-06-10T12:00:00.000Z",
    "deleted": false,
    "hasEmbed": false
  }
}
```

### Message Someone by DID

```json
{
  "member": "did:plc:abc123",
  "text": "Hello!"
}
```

## Error Handling

### Common Errors

#### Authentication Required

```json
{
  "error": "Authentication required",
  "code": "AUTHENTICATION_FAILED"
}
```

#### App Password Without DM Access

A `401 "Bad token scope"` from the chat service means the current app password
was created without direct-message access. The error message includes guidance
to create a new app password with **"Allow access to your direct messages"**
enabled.

#### Both or Neither Target Provided

```json
{
  "error": "Invalid parameters: : Provide exactly one of convoId or member",
  "code": "VALIDATION_ERROR"
}
```

#### Message Too Long

```json
{
  "error": "Message text is 1024 graphemes; the direct-message maximum is 1000.",
  "code": "VALIDATION_ERROR"
}
```

#### Recipient Cannot Be Messaged

The chat service rejects the call when the recipient's settings do not allow
DMs from your account, or when the recipient has chat disabled (their member
entry carries `chatDisabled: true`).

## Related Tools

- **[list_conversations](./list-conversations.md)** - List conversations and
  find conversation ids
- **[get_conversation_messages](./get-conversation-messages.md)** - Read the
  messages of a conversation

## See Also

- [Social Operations Examples](../../examples/social-operations.md)
