# unrepost

Remove a repost from AT Protocol.

## Authentication

**Required:** Yes (Private tool)

## Parameters

### `repostUri` (required)
- **Type:** `string`
- **Description:** AT Protocol URI of the repost record to delete (returned from `repost`)

## Response

```typescript
{
  success: boolean;   // Operation success status
  message: string;    // Success message
  deletedRepost: {
    uri: string;      // URI of the deleted repost record
  }
}
```

## Examples

### Remove a Repost

```json
{
  "repostUri": "at://did:plc:myuser/app.bsky.feed.repost/repost123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Repost removed successfully",
  "deletedRepost": {
    "uri": "at://did:plc:myuser/app.bsky.feed.repost/repost123"
  }
}
```

## Error Handling

### Common Errors

#### Invalid Repost URI
```json
{
  "error": "Invalid AT Protocol URI format",
  "code": "VALIDATION_ERROR"
}
```

#### Repost Not Found
```json
{
  "error": "Repost record not found",
  "code": "NOT_FOUND"
}
```

## Best Practices

- Store the repost URI when you repost so you can unrepost later
- The repost URI is different from the post URI - it's returned by `repost`

## Related Tools

- **[repost](./repost.md)** - Repost content

## See Also

- [Social Operations Examples](../../examples/social-operations.md)

