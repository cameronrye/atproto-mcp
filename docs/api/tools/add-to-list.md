# add_to_list

Add a user to an existing list.

## Authentication

**Required:** Yes (Private tool)

## Parameters

### `list` (required)
- **Type:** `string`
- **Description:** AT Protocol URI of the list

### `subject` (required)
- **Type:** `string`
- **Description:** User identifier (DID or handle) to add

## Response

```typescript
{
  success: boolean;
  message: string;
  listItem: {
    uri: string;
    cid: string;
    list: string;
    subject: string;
  }
}
```

## Examples

### Add User to List

```json
{
  "list": "at://did:plc:myuser/app.bsky.graph.list/list123",
  "subject": "alice.bsky.social"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User added to list successfully",
  "listItem": {
    "uri": "at://did:plc:myuser/app.bsky.graph.listitem/item123",
    "cid": "bafyreiabc123...",
    "list": "at://did:plc:myuser/app.bsky.graph.list/list123",
    "subject": "did:plc:abc123xyz789"
  }
}
```

## Error Handling

### Common Errors

#### List Not Found
```json
{
  "error": "List not found",
  "code": "NOT_FOUND"
}
```

#### User Already in List
```json
{
  "error": "User is already in this list",
  "code": "DUPLICATE"
}
```

#### User Not Found
```json
{
  "error": "User not found",
  "code": "NOT_FOUND"
}
```

## Best Practices

- Verify user exists before adding
- Check for duplicates
- Store list item URI for removal
- Batch add operations when possible

## Related Tools

- **[create_list](./create-list.md)** - Create a list
- **[remove_from_list](./remove-from-list.md)** - Remove from list
- **[get_list](./get-list.md)** - Get list details

## See Also

- [Social Operations Examples](../../examples/social-operations.md)

