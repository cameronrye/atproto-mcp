# get_bookmarks

List the authenticated account's private bookmarks
(`app.bsky.bookmark.getBookmarks`) with cursor pagination.

Bookmarks are private to your account; no one else can list them. Each entry
carries the full bookmarked post view when the post is still viewable, or an
`unavailableReason` when it is not (the bookmark itself still exists either
way — the underlying post may have been deleted or its author blocked).

## Authentication

**Required:** Yes (Private tool)

## Parameters

### `limit` (optional)

- **Type:** `number`
- **Default:** `50`
- **Constraints:** 1-100
- **Description:** Maximum number of bookmarks to return per page

### `cursor` (optional)

- **Type:** `string`
- **Description:** Pagination cursor from previous response

## Response

Tool results are returned as stringified JSON text. The shape below is
illustrative.

```typescript
{
  success: boolean;
  bookmarks: Array<{
    uri: string;            // AT-URI of the bookmarked post
    cid: string;            // CID of the bookmarked post
    bookmarkedAt?: string;  // ISO 8601 timestamp when the bookmark was created
    post?: {                // present only when the post is still viewable
      uri: string;
      cid: string;
      author: {
        did: string;
        handle: string;
        displayName?: string;
        avatar?: string;
      };
      record: {
        text: string;
        createdAt: string;
      };
      replyCount?: number;
      repostCount?: number;
      likeCount?: number;
      indexedAt: string;
    };
    unavailableReason?: 'blocked' | 'not_found' | 'unknown'; // present only when post is absent
  }>;
  cursor?: string; // absent when there are no more results
  hasMore: boolean;
}
```

Exactly one of `post` / `unavailableReason` is present per entry:

- `blocked` — the post is from a blocked/blocking account
- `not_found` — the post has been deleted
- `unknown` — the server returned an unrecognized item type

## Examples

### Get Recent Bookmarks

```json
{
  "limit": 50
}
```

### Get Bookmarks with Pagination

```json
{
  "limit": 50,
  "cursor": "cursor_from_previous_response"
}
```

## Error Handling

### Common Errors

#### Authentication Required

```json
{
  "error": "Authentication required",
  "code": "AUTHENTICATION_FAILED"
}
```

#### Invalid Limit

```json
{
  "error": "Limit must be between 1 and 100",
  "code": "VALIDATION_ERROR"
}
```

## Pagination

Pass the `cursor` from the previous response to fetch the next page, and check
`hasMore` before requesting another page. `limit` accepts 1-100 (default 50).

## Related Tools

- **[add_bookmark](./add-bookmark.md)** - Bookmark a post
- **[remove_bookmark](./remove-bookmark.md)** - Remove a bookmark
- **[get_timeline](./get-timeline.md)** - Get your home timeline
