# remove_from_list

Remove a user from a list.

## Authentication

**Required:** Yes (Private tool)

## Parameters

### `listUri` (required)

- **Type:** `string`
- **Description:** AT Protocol URI of the list (`at://...`)

### `actor` (required)

- **Type:** `string`
- **Description:** User identifier (DID or handle) to remove

## How It Works

You identify the member to remove by `actor` (DID or handle), not by a list-item
URI. The tool resolves the actor to a DID and pages through the list (100
members per page, up to 50 pages) to find the matching list-item record, then
deletes it from the authenticated user's repo. This means handle/DID mismatches
and members beyond the first page are handled correctly.

If the actor is not found in the list, the tool returns `success: false` with an
explanatory message rather than throwing.

## Response

Tool results are returned as stringified JSON text. The illustrative shape is:

```typescript
{
  success: boolean;
  message: string;
  removedFrom: {
    listUri: string;
    actor: string;
  }
}
```

## Examples

### Remove User from List

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
  "message": "User alice.bsky.social removed from list successfully",
  "removedFrom": {
    "listUri": "at://did:plc:myuser/app.bsky.graph.list/list123",
    "actor": "alice.bsky.social"
  }
}
```

### User Not in List

```json
{
  "success": false,
  "message": "User alice.bsky.social is not in the specified list",
  "removedFrom": {
    "listUri": "at://did:plc:myuser/app.bsky.graph.list/list123",
    "actor": "alice.bsky.social"
  }
}
```

## Error Handling

Validation runs before any network call:

- An invalid `listUri` (not starting with `at://`) raises a `VALIDATION_ERROR`.
- An `actor` that is neither a DID nor a handle raises a `VALIDATION_ERROR`.

A member that cannot be found is reported via `success: false` (see above), not
as a thrown error. Other failures (unresolvable handle, network errors) surface
as the underlying AT Protocol error.

## Related Tools

- **[add_to_list](./add-to-list.md)** - Add to list
- **[get_list](./get-list.md)** - Get list contents

## See Also

- [Social Operations Examples](../../examples/social-operations.md)
- [List Management](../../guide/tools-resources.md#list-management)
