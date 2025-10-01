# get_list

Get details and members of a list.

## Authentication

**Optional:** Public tool (works without authentication)

## Parameters

### `list` (required)
- **Type:** `string`
- **Description:** AT Protocol URI of the list

### `limit` (optional)
- **Type:** `number`
- **Default:** `50`
- **Constraints:** 1-100
- **Description:** Maximum number of members to return

### `cursor` (optional)
- **Type:** `string`
- **Description:** Pagination cursor

## Response

```typescript
{
  success: boolean;
  list: {
    uri: string;
    cid: string;
    name: string;
    purpose: string;
    description?: string;
    creator: {
      did: string;
      handle: string;
      displayName?: string;
    };
    indexedAt: string;
  };
  items: Array<{
    uri: string;
    subject: {
      did: string;
      handle: string;
      displayName?: string;
      avatar?: string;
    };
  }>;
  cursor?: string;
  hasMore: boolean;
}
```

## Examples

### Get List

```json
{
  "list": "at://did:plc:abc123/app.bsky.graph.list/list123"
}
```

**Response:**
```json
{
  "success": true,
  "list": {
    "uri": "at://did:plc:abc123/app.bsky.graph.list/list123",
    "cid": "bafyreiabc123...",
    "name": "Favorite Developers",
    "purpose": "curatelist",
    "description": "Developers I follow for tech insights",
    "creator": {
      "did": "did:plc:abc123",
      "handle": "alice.bsky.social",
      "displayName": "Alice"
    },
    "indexedAt": "2024-01-15T10:30:00.000Z"
  },
  "items": [
    {
      "uri": "at://did:plc:abc123/app.bsky.graph.listitem/item1",
      "subject": {
        "did": "did:plc:user1",
        "handle": "dev1.bsky.social",
        "displayName": "Developer One",
        "avatar": "https://..."
      }
    }
  ],
  "cursor": "next_page_cursor",
  "hasMore": true
}
```

### Get List with Pagination

```json
{
  "list": "at://did:plc:abc123/app.bsky.graph.list/list123",
  "limit": 25,
  "cursor": "cursor_from_previous_response"
}
```

## Use Cases

### List Management
- View list members
- Audit list contents
- Export list data
- Sync lists

### Discovery
- Find curated accounts
- Explore topic lists
- Follow list members
- Share lists

## Best Practices

- Cache list data
- Paginate large lists
- Handle deleted lists
- Show list metadata

## Related Tools

- **[create_list](./create-list.md)** - Create a list
- **[add_to_list](./add-to-list.md)** - Add to list
- **[remove_from_list](./remove-from-list.md)** - Remove from list

## See Also

- [Social Operations Examples](../../examples/social-operations.md)

