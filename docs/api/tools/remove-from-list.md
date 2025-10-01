# remove_from_list

Remove a user from a list.

## Authentication

**Required:** Yes (Private tool)

## Parameters

### `listItemUri` (required)
- **Type:** `string`
- **Description:** AT Protocol URI of the list item (from `add_to_list`)

## Response

```typescript
{
  success: boolean;
  message: string;
  deletedItem: {
    uri: string;
  }
}
```

## Examples

### Remove User from List

```json
{
  "listItemUri": "at://did:plc:myuser/app.bsky.graph.listitem/item123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User removed from list successfully",
  "deletedItem": {
    "uri": "at://did:plc:myuser/app.bsky.graph.listitem/item123"
  }
}
```

## Error Handling

### Common Errors

#### List Item Not Found
```json
{
  "error": "List item not found",
  "code": "NOT_FOUND"
}
```

#### Invalid URI
```json
{
  "error": "Invalid AT Protocol URI format",
  "code": "VALIDATION_ERROR"
}
```

## Best Practices

- Store list item URI when adding users
- Handle "not found" gracefully
- Verify removal success
- Update UI immediately

## Related Tools

- **[add_to_list](./add-to-list.md)** - Add to list
- **[get_list](./get-list.md)** - Get list details

## See Also

- [Social Operations Examples](../../examples/social-operations.md)

