# create_list

Create a user list for organizing accounts (curate list) or for moderation (mod
list).

## Authentication

**Required:** Yes (Private tool)

## Parameters

### `name` (required)

- **Type:** `string`
- **Constraints:** 1-64 characters
- **Description:** Name of the list

### `purpose` (optional)

- **Type:** `string`
- **Values:** `"curatelist"` | `"modlist"`
- **Default:** `"curatelist"`
- **Description:** Purpose of the list. A `curatelist` organizes accounts; a
  `modlist` is used for muting or blocking in bulk.

### `description` (optional)

- **Type:** `string`
- **Constraints:** Up to 300 characters
- **Description:** Description of the list

## Response

Tool results are returned as stringified JSON text. The illustrative shape is:

```typescript
{
  success: boolean;
  message: string;
  list: {
    uri: string;
    cid: string;
    name: string;
    description?: string;
    purpose: string;     // "curatelist" or "modlist"
    createdAt: string;   // ISO 8601
  };
}
```

## Examples

### Create Curate List

```json
{
  "name": "Favorite Developers",
  "purpose": "curatelist",
  "description": "Developers I follow for tech insights"
}
```

**Response (illustrative):**

```json
{
  "success": true,
  "message": "List \"Favorite Developers\" created successfully",
  "list": {
    "uri": "at://did:plc:myuser/app.bsky.graph.list/list123",
    "cid": "bafyreiabc123...",
    "name": "Favorite Developers",
    "description": "Developers I follow for tech insights",
    "purpose": "curatelist",
    "createdAt": "2026-06-06T10:30:00.000Z"
  }
}
```

### Create Moderation List

```json
{
  "name": "Spam Accounts",
  "purpose": "modlist",
  "description": "Known spam accounts to block in bulk"
}
```

## Error Handling

Parameter validation runs before any network call: a `name` longer than 64
characters, a `description` longer than 300 characters, or a `purpose` outside
the allowed values raises a `VALIDATION_ERROR`. Other failures surface as the
underlying AT Protocol error.

## Related Tools

- **[add_to_list](./add-to-list.md)** - Add users to a list
- **[remove_from_list](./remove-from-list.md)** - Remove users from a list
- **[get_list](./get-list.md)** - Get list contents

## See Also

- [Social Operations Examples](../../examples/social-operations.md)
- [List Management](../../guide/tools-resources.md#list-management)
