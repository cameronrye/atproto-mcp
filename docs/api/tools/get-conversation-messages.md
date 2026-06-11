# get_conversation_messages

Read the messages of a Bluesky direct-message conversation
(`chat.bsky.convo.getMessages`), newest first. Every call is proxied to the
Bluesky chat service (`did:web:api.bsky.chat`) — DMs are not served by the PDS.

This tool is read-only by default: fetching messages does **not** change the
conversation's read state. Set `markRead: true` to also clear the unread count
via `chat.bsky.convo.updateRead`.

## Authentication

**Required:** Yes (Private tool)

Direct messages additionally require that the app password used for the
session was created with **"Allow access to your direct messages"** enabled
(bsky.app → Settings → Privacy and Security → App Passwords). Without it, the
chat service rejects every call with `401 "Bad token scope"`.

## Parameters

### `convoId` (required)

- **Type:** `string`
- **Description:** Id of the conversation to read, from `list_conversations`
  or a `send_direct_message` response

### `limit` (optional)

- **Type:** `number`
- **Default:** `50`
- **Constraints:** 1-100
- **Description:** Maximum number of messages to return per page

### `cursor` (optional)

- **Type:** `string`
- **Description:** Pagination cursor from the previous response; omit for the
  newest page

### `markRead` (optional)

- **Type:** `boolean`
- **Default:** `false`
- **Description:** When `true`, mark the whole conversation read after
  fetching (clears its `unreadCount` in `list_conversations`). When `false`
  (the default), reading is side-effect free.

## Response

Tool results are returned as stringified JSON text. The shape below is
illustrative.

```typescript
{
  success: boolean;
  convoId: string;
  messages: Array<{
    id?: string;
    senderDid?: string;   // DID of the sender; match against the conversation members
    text?: string;        // Absent when the message was deleted
    sentAt?: string;      // ISO 8601 timestamp
    deleted: boolean;     // True for deleted messages (id/sender/sentAt are kept)
    hasEmbed: boolean;    // True when the message embeds a shared post (not expanded)
  }>;
  cursor?: string;        // Absent when there are no older messages
  hasMore: boolean;
  markedRead: boolean;    // Whether this call marked the conversation read
}
```

Messages are returned newest first; paginate with `cursor` to walk back in
time.

## Examples

### Read the Latest Messages

```json
{
  "convoId": "3kx...abc",
  "limit": 30
}
```

### Read and Mark the Conversation Read

```json
{
  "convoId": "3kx...abc",
  "markRead": true
}
```

### Get Older Messages

```json
{
  "convoId": "3kx...abc",
  "cursor": "cursor_from_previous_response"
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

#### Invalid Conversation Id

```json
{
  "error": "Invalid parameters: convoId: convoId is required",
  "code": "VALIDATION_ERROR"
}
```

## Pagination

Pass the `cursor` from the previous response to fetch older messages, and
check `hasMore` before requesting another page. `limit` accepts 1-100 (default
50).

## Related Tools

- **[list_conversations](./list-conversations.md)** - List conversations and
  find conversation ids
- **[send_direct_message](./send-direct-message.md)** - Send a direct message

## See Also

- [Social Operations Examples](../../examples/social-operations.md)
