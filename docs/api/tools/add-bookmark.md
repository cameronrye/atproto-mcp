# add_bookmark

Privately bookmark a post.

Bookmarks are **private to your account** and stored server-side
(`app.bsky.bookmark.createBookmark`): they are not public records, other users
cannot see them, and no bookmark-record URI exists — bookmarks are keyed by the
bookmarked post's URI. Only `app.bsky.feed.post` records can be bookmarked.

## Authentication

**Required:** Yes (Private tool)

## Parameters

### `uri` (required)

- **Type:** `string`
- **Description:** AT-URI of the post to bookmark
  (`at://did/app.bsky.feed.post/rkey`). URIs for any other collection are
  rejected, since only posts can be bookmarked.

### `cid` (optional)

- **Type:** `string`
- **Description:** CID of the post record. When omitted, the CID is resolved
  automatically from the post view. Pass it explicitly only if you already have
  it (e.g. from a search or timeline result) or if the post view cannot be
  fetched.

## Idempotency

The tool checks the post's `viewer.bookmarked` state first. If the post is
already bookmarked, no create call is issued and `alreadyBookmarked` is `true`.
The endpoint is also idempotent server-side, so a duplicate create would be a
no-op anyway.

## Response

Tool results are returned as stringified JSON text. The shape below is
illustrative.

```typescript
{
  success: boolean;
  message: string;
  alreadyBookmarked: boolean; // true when the post was already bookmarked
  bookmarkedPost: {
    uri: string; // AT-URI of the bookmarked post
    cid: string; // CID of the post (resolved automatically when not supplied)
  };
}
```

There is no bookmark-record URI in the response: bookmarks are private
server-side state keyed by the post URI. To remove the bookmark later, pass the
same post URI to `remove_bookmark`.

## Examples

### Bookmark a Post

```json
{
  "uri": "at://did:plc:abc123/app.bsky.feed.post/3k44dkpmqss2a"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Post bookmarked successfully",
  "alreadyBookmarked": false,
  "bookmarkedPost": {
    "uri": "at://did:plc:abc123/app.bsky.feed.post/3k44dkpmqss2a",
    "cid": "bafyreib2rxk3rh6kzwq6r4yhdj37yiwzfvxnwxet3rvjxn4xltlvmzqfa4"
  }
}
```

### Bookmark with an Explicit CID

```json
{
  "uri": "at://did:plc:abc123/app.bsky.feed.post/3k44dkpmqss2a",
  "cid": "bafyreib2rxk3rh6kzwq6r4yhdj37yiwzfvxnwxet3rvjxn4xltlvmzqfa4"
}
```

## Error Handling

### Common Errors

#### Not a Post URI

```json
{
  "error": "uri must reference a post record (collection \"app.bsky.feed.like\" is not app.bsky.feed.post); only posts can be bookmarked",
  "code": "VALIDATION_ERROR"
}
```

#### CID Could Not Be Resolved

Returned when `cid` is omitted and the post view cannot be fetched (e.g. the
post does not exist):

```json
{
  "error": "Could not resolve the CID for at://...: the post view could not be fetched. Verify the post exists, or pass cid explicitly.",
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

- **[remove_bookmark](./remove-bookmark.md)** - Remove a bookmark
- **[get_bookmarks](./get-bookmarks.md)** - List your bookmarks
- **[like_post](./like-post.md)** - Publicly like a post instead
