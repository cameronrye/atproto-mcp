# add_to_list

Add a user to an existing list.

## Authentication

**Required:** Yes (Private tool)

## Parameters

### `listUri` (required)

- **Type:** `string`
- **Description:** AT Protocol URI of the list (`at://...`)

### `actor` (required)

- **Type:** `string`
- **Description:** User identifier (DID or handle) to add. Handles are resolved
  to a DID before the list-item record is created, because a list item's subject
  must be a DID.

## Response

Tool results are returned as stringified JSON text. The illustrative shape is:

```typescript
{
  success: boolean;
  message: string;
  listItem: {
    uri: string; // AT-URI of the created listitem record
    listUri: string;
    actor: string; // echoes the actor you passed in
  }
}
```

## Examples

### Add User to List

```json
{
  "listUri": "at://did:plc:myuser/app.bsky.graph.list/list123",
  "actor": "alice.bsky.social"
}
```

**Response (illustrative):**

```json
{
  "success": true,
  "message": "User alice.bsky.social added to list successfully",
  "listItem": {
    "uri": "at://did:plc:myuser/app.bsky.graph.listitem/item123",
    "listUri": "at://did:plc:myuser/app.bsky.graph.list/list123",
    "actor": "alice.bsky.social"
  }
}
```

## Error Handling

Validation runs before any network call:

- An invalid `listUri` (not starting with `at://`) raises a `VALIDATION_ERROR`.
- An `actor` that is neither a DID (`did:...`) nor a handle (`user.domain`)
  raises a `VALIDATION_ERROR`.

Other failures (list not found, unresolvable handle, network errors) are
surfaced as the underlying AT Protocol error. This tool does not deduplicate, so
adding the same user twice creates a second list-item record rather than
failing.

## Related Tools

- **[create_list](./create-list.md)** - Create a list
- **[remove_from_list](./remove-from-list.md)** - Remove from list
- **[get_list](./get-list.md)** - Get list contents

## See Also

- [Social Operations Examples](../../examples/social-operations.md)
- [List Management](../../guide/tools-resources.md#list-management)
