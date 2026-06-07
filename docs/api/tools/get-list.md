# get_list

Get the contents of a list, including its members.

## Authentication

**Required:** Yes (Private tool)

## Parameters

### `listUri` (required)

- **Type:** `string`
- **Description:** AT Protocol URI of the list (`at://...`)

### `limit` (optional)

- **Type:** `number`
- **Default:** `50`
- **Constraints:** 1-100
- **Description:** Maximum number of members to return

### `cursor` (optional)

- **Type:** `string`
- **Description:** Pagination cursor from a previous response

## Response

Tool results are returned as stringified JSON text. The illustrative shape is:

```typescript
{
  success: boolean;
  list: {
    uri: string;
    name: string;
    description?: string;
    purpose: string;
    creator: {
      did: string;
      handle: string;
      displayName?: string;
    };
    itemCount: number;   // members returned in this page
  };
  items: Array<{
    uri: string;         // AT-URI of the listitem record
    subject: {
      did: string;
      handle: string;
      displayName?: string;
      avatar?: string;
    };
  }>;
  cursor?: string;       // present when more pages are available
}
```

`itemCount` reflects the number of items in the current page, not the total list
size. Continue paging with `cursor` to retrieve the whole list.

## Examples

### Get List

```json
{
  "listUri": "at://did:plc:abc123/app.bsky.graph.list/list123"
}
```

**Response (illustrative):**

```json
{
  "success": true,
  "list": {
    "uri": "at://did:plc:abc123/app.bsky.graph.list/list123",
    "name": "Favorite Developers",
    "description": "Developers I follow for tech insights",
    "purpose": "app.bsky.graph.defs#curatelist",
    "creator": {
      "did": "did:plc:abc123",
      "handle": "alice.bsky.social",
      "displayName": "Alice"
    },
    "itemCount": 1
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
  "cursor": "next_page_cursor"
}
```

### Get List with Pagination

```json
{
  "listUri": "at://did:plc:abc123/app.bsky.graph.list/list123",
  "limit": 25,
  "cursor": "cursor_from_previous_response"
}
```

## Error Handling

An invalid `listUri` (not starting with `at://`) raises a `VALIDATION_ERROR`
before any network call. A missing or deleted list surfaces as the underlying AT
Protocol error.

## Related Tools

- **[create_list](./create-list.md)** - Create a list
- **[add_to_list](./add-to-list.md)** - Add to list
- **[remove_from_list](./remove-from-list.md)** - Remove from list

## See Also

- [Social Operations Examples](../../examples/social-operations.md)
- [List Management](../../guide/tools-resources.md#list-management)
