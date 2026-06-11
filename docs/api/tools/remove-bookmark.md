# remove_bookmark

Remove a private bookmark from a post.

Bookmarks are keyed by the bookmarked post's URI
(`app.bsky.bookmark.deleteBookmark`) — pass the **post URI itself**, not a
bookmark-record URI (none exists; bookmarks are private server-side state, not
public records).

## Authentication

**Required:** Yes (Private tool)

## Parameters

### `uri` (required)

- **Type:** `string`
- **Description:** AT-URI of the bookmarked post
  (`at://did/app.bsky.feed.post/rkey`). URIs for any other collection are
  rejected.

## Idempotency

The tool checks the post's `viewer.bookmarked` state first:

- If the post is confirmed **not bookmarked**, the delete call is skipped and
  `wasBookmarked` is `false`.
- If the post is confirmed bookmarked, the bookmark is deleted and
  `wasBookmarked` is `true`.
- If the prior state cannot be determined (e.g. the pre-check request fails),
  the delete is still issued — the server treats removing a missing bookmark as
  a no-op — and `wasBookmarked` is `false` (unconfirmed).

## Response

Tool results are returned as stringified JSON text. The shape below is
illustrative.

```typescript
{
  success: boolean;
  message: string;
  wasBookmarked: boolean; // true only when the bookmark was confirmed to exist before removal
  removedBookmark: {
    uri: string; // AT-URI of the post whose bookmark was removed (or confirmed absent)
  };
}
```

## Examples

### Remove a Bookmark

```json
{
  "uri": "at://did:plc:abc123/app.bsky.feed.post/3k44dkpmqss2a"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Bookmark removed successfully",
  "wasBookmarked": true,
  "removedBookmark": {
    "uri": "at://did:plc:abc123/app.bsky.feed.post/3k44dkpmqss2a"
  }
}
```

### Remove a Bookmark That Does Not Exist

```json
{
  "uri": "at://did:plc:abc123/app.bsky.feed.post/3k44dkpmqss2a"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Post was not bookmarked; nothing to remove",
  "wasBookmarked": false,
  "removedBookmark": {
    "uri": "at://did:plc:abc123/app.bsky.feed.post/3k44dkpmqss2a"
  }
}
```

## Error Handling

### Common Errors

#### Not a Post URI

```json
{
  "error": "uri must reference a post record (collection \"app.bsky.graph.list\" is not app.bsky.feed.post); only posts can be bookmarked",
  "code": "VALIDATION_ERROR"
}
```

#### Authentication Required

```json
{
  "error": "Authentication required",
  "code": "AUTHENTICATION_FAILED"
}
```

## Related Tools

- **[add_bookmark](./add-bookmark.md)** - Bookmark a post
- **[get_bookmarks](./get-bookmarks.md)** - List your bookmarks
- **[unlike_post](./unlike-post.md)** - Remove a public like instead
