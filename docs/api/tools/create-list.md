# create_list

Create a user list for organizing and curating accounts.

## Authentication

**Required:** Yes (Private tool)

## Parameters

### `name` (required)
- **Type:** `string`
- **Description:** Name of the list

### `purpose` (required)
- **Type:** `string`
- **Values:** `"curatelist"` | `"modlist"`
- **Description:** Purpose of the list

### `description` (optional)
- **Type:** `string`
- **Description:** Description of the list

## Response

```typescript
{
  success: boolean;
  message: string;
  list: {
    uri: string;
    cid: string;
    name: string;
    purpose: string;
    description?: string;
  }
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

**Response:**
```json
{
  "success": true,
  "message": "List created successfully",
  "list": {
    "uri": "at://did:plc:myuser/app.bsky.graph.list/list123",
    "cid": "bafyreiabc123...",
    "name": "Favorite Developers",
    "purpose": "curatelist",
    "description": "Developers I follow for tech insights"
  }
}
```

### Create Moderation List

```json
{
  "name": "Spam Accounts",
  "purpose": "modlist",
  "description": "Known spam accounts to block"
}
```

## List Purposes

### `curatelist`
- Organize users by topic or interest
- Create reading lists
- Group friends or colleagues
- Public or private collections

### `modlist`
- Moderation and blocking
- Shared block lists
- Community safety
- Spam prevention

## Use Cases

### Content Curation
- Topic experts
- Content creators
- Community members
- Industry professionals

### Moderation
- Block lists
- Spam accounts
- Policy violators
- Safety concerns

## Best Practices

- Use descriptive names
- Provide clear descriptions
- Choose appropriate purpose
- Maintain list regularly

## Related Tools

- **[add_to_list](./add-to-list.md)** - Add users to list
- **[remove_from_list](./remove-from-list.md)** - Remove users from list
- **[get_list](./get-list.md)** - Get list details

## See Also

- [Social Operations Examples](../../examples/social-operations.md)

