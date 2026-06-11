# list_conversations

List the authenticated user's Bluesky direct-message conversations
(`chat.bsky.convo.listConvos`). Every call is proxied to the Bluesky chat
service (`did:web:api.bsky.chat`) — DMs are not served by the PDS.

## Authentication

**Required:** Yes (Private tool)

Direct messages additionally require that the app password used for the
session was created with **"Allow access to your direct messages"** enabled
(bsky.app → Settings → Privacy and Security → App Passwords). Without it, the
chat service rejects every call with `401 "Bad token scope"`.

## Parameters

### `limit` (optional)

- **Type:** `number`
- **Default:** `50`
- **Constraints:** 1-100
- **Description:** Maximum number of conversations to return per page

### `cursor` (optional)

- **Type:** `string`
- **Description:** Pagination cursor from the previous response; omit for the
  first page

### `status` (optional)

- **Type:** `string` (`"request"` or `"accepted"`)
- **Description:** Filter by conversation status. `request` returns incoming
  chat requests that have not been accepted yet; `accepted` returns active
  conversations. Omit to list both.

## Response

Tool results are returned as stringified JSON text. The shape below is
illustrative.

```typescript
{
  success: boolean;
  conversations: Array<{
    id: string;             // Pass to get_conversation_messages / send_direct_message
    members: Array<{
      did: string;
      handle: string;
      displayName?: string;
      chatDisabled?: boolean; // True when the member cannot participate in chats
    }>;
    unreadCount: number;
    muted: boolean;
    status?: string;        // "request" | "accepted" (open union; may be absent)
    lastMessage?: {         // Absent when the conversation has no messages
      id?: string;
      senderDid?: string;
      text?: string;        // Absent when the message was deleted
      sentAt?: string;
      deleted: boolean;
      hasEmbed: boolean;    // True when the message embeds a shared post
    };
  }>;
  cursor?: string;          // Absent when there are no more results
  hasMore: boolean;
}
```

The `members` array includes the authenticated user as well as the other
participant(s).

## Examples

### List Recent Conversations

```json
{
  "limit": 25
}
```

### List Only Pending Chat Requests

```json
{
  "status": "request"
}
```

### Get the Next Page

```json
{
  "limit": 25,
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

```json
{
  "error": "InvalidToken: Bad token scope — Bluesky direct messages require an authenticated session whose app password was created with \"Allow access to your direct messages\" enabled (...)",
  "code": "AUTHENTICATION_FAILED"
}
```

## Pagination

Pass the `cursor` from the previous response to fetch older conversations, and
check `hasMore` before requesting another page. `limit` accepts 1-100 (default
50).

## Related Tools

- **[get_conversation_messages](./get-conversation-messages.md)** - Read the
  messages of a conversation
- **[send_direct_message](./send-direct-message.md)** - Send a direct message

## See Also

- [Social Operations Examples](../../examples/social-operations.md)
