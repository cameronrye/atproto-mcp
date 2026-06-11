# search_starter_packs

Search for Bluesky starter packs by keyword
(`app.bsky.graph.searchStarterPacks`).

Returns a paginated list of matching packs with name, description, creator,
member count, and joined counts. Use
[`get_starter_pack`](./get-starter-pack.md) to fetch full details (member
sample, feeds, list info) for a specific result.

## Authentication

**Required:** No (Enhanced tool — works without authentication; uses your
session when authenticated)

## Parameters

### `q` (required)

- **Type:** `string`
- **Description:** Search query string (e.g. `"typescript developers"`). Plain
  keywords work; the API recommends Lucene query syntax for advanced queries.

### `limit` (optional)

- **Type:** `number`
- **Default:** `25`
- **Constraints:** 1-100
- **Description:** Maximum number of starter packs to return per page

### `cursor` (optional)

- **Type:** `string`
- **Description:** Pagination cursor from previous response

## Response

Tool results are returned as stringified JSON text. The shape below is
illustrative.

```typescript
{
  success: boolean;
  query: string; // the search query that was executed
  starterPacks: Array<{
    uri: string;  // AT-URI of the pack; pass to get_starter_pack for details
    cid: string;
    name: string;
    description?: string;
    creator: {
      did: string;
      handle: string;
      displayName?: string;
      avatar?: string;
    };
    listItemCount?: number;     // accounts in the pack's reference list
    joinedWeekCount?: number;   // accounts that joined via this pack, past week
    joinedAllTimeCount?: number; // accounts that joined via this pack, all-time
    indexedAt: string;
  }>;
  cursor?: string; // absent when there are no more results
  hasMore: boolean;
}
```

## Examples

### Search for Starter Packs

```json
{
  "q": "typescript developers"
}
```

**Response:**

```json
{
  "success": true,
  "query": "typescript developers",
  "starterPacks": [
    {
      "uri": "at://did:plc:abc123/app.bsky.graph.starterpack/3k44dkpmqss2a",
      "cid": "bafyreigq3pack...",
      "name": "TypeScript Devs",
      "description": "Folks who write TypeScript",
      "creator": {
        "did": "did:plc:abc123",
        "handle": "creator.bsky.social",
        "displayName": "Creator"
      },
      "listItemCount": 42,
      "joinedWeekCount": 5,
      "joinedAllTimeCount": 50,
      "indexedAt": "2026-01-02T00:00:00.000Z"
    }
  ],
  "cursor": "page-2",
  "hasMore": true
}
```

### Search with Pagination

```json
{
  "q": "art",
  "limit": 10,
  "cursor": "cursor_from_previous_response"
}
```

## Error Handling

### Common Errors

#### Missing Query

```json
{
  "error": "Search query is required",
  "code": "VALIDATION_ERROR"
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
`hasMore` before requesting another page. `limit` accepts 1-100 (default 25).

## Related Tools

- **[get_starter_pack](./get-starter-pack.md)** - Fetch full details for a pack
- **[search_actors](./search-actors.md)** - Search for users instead
- **[search_posts](./search-posts.md)** - Search for posts instead
