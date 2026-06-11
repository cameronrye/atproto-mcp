# get_starter_pack

Fetch a Bluesky starter pack (`app.bsky.graph.getStarterPack`) by AT-URI or
bsky.app link.

Returns the pack's name, description, creator, reference-list info, a sample of
member profiles, included feeds, and joined counts.

## Authentication

**Required:** No (Enhanced tool — works without authentication; uses your
session when authenticated)

## Parameters

### `starterPack` (required)

- **Type:** `string`
- **Description:** Starter pack reference. Accepted forms:
  - AT-URI: `at://did:plc:abc123/app.bsky.graph.starterpack/3k44dkpmqss2a`
  - Web link: `https://bsky.app/starter-pack/{handle-or-did}/{rkey}` (the
    legacy `https://bsky.app/start/...` form also works)

  Web links with a handle are resolved to a DID automatically. `go.bsky.app`
  short links are **not** supported — open one in a browser and use the
  resulting bsky.app URL.

## Response

Tool results are returned as stringified JSON text. The shape below is
illustrative.

```typescript
{
  success: boolean;
  starterPack: {
    uri: string;
    cid: string;
    name: string;
    description?: string;
    creator: {
      did: string;
      handle: string;
      displayName?: string;
      avatar?: string;
    };
    list?: {              // the reference list backing the pack
      uri: string;        // pass to get_list to page through all members
      cid: string;
      name: string;
      purpose: string;    // app.bsky.graph.defs#referencelist for starter packs
      avatar?: string;
      listItemCount?: number;
    };
    sampleProfiles: Array<{ // a sample of members, NOT the full membership
      did: string;
      handle: string;
      displayName?: string;
      description?: string;
      avatar?: string;
    }>;
    feeds: Array<{        // feed generators included in the pack (often empty)
      uri: string;
      cid: string;
      displayName: string;
      description?: string;
      avatar?: string;
      likeCount?: number;
      creator: {
        did: string;
        handle: string;
        displayName?: string;
        avatar?: string;
      };
    }>;
    joinedWeekCount?: number;
    joinedAllTimeCount?: number;
    indexedAt: string;
  };
}
```

`sampleProfiles` is only a server-chosen sample of the pack's members. To page
through the full membership, pass `list.uri` to
[`get_list`](./get-list.md).

## Examples

### Fetch by AT-URI

```json
{
  "starterPack": "at://did:plc:abc123/app.bsky.graph.starterpack/3k44dkpmqss2a"
}
```

### Fetch by bsky.app Link

```json
{
  "starterPack": "https://bsky.app/starter-pack/creator.bsky.social/3k44dkpmqss2a"
}
```

**Response:**

```json
{
  "success": true,
  "starterPack": {
    "uri": "at://did:plc:abc123/app.bsky.graph.starterpack/3k44dkpmqss2a",
    "cid": "bafyreigq3pack...",
    "name": "TypeScript Devs",
    "description": "Folks who write TypeScript",
    "creator": {
      "did": "did:plc:abc123",
      "handle": "creator.bsky.social",
      "displayName": "Creator"
    },
    "list": {
      "uri": "at://did:plc:abc123/app.bsky.graph.list/3klist",
      "cid": "bafyreilist...",
      "name": "TypeScript Devs list",
      "purpose": "app.bsky.graph.defs#referencelist",
      "listItemCount": 42
    },
    "sampleProfiles": [
      {
        "did": "did:plc:member1",
        "handle": "member1.bsky.social",
        "displayName": "Member One"
      }
    ],
    "feeds": [],
    "joinedWeekCount": 5,
    "joinedAllTimeCount": 50,
    "indexedAt": "2026-01-02T00:00:00.000Z"
  }
}
```

## Error Handling

### Common Errors

#### Wrong Collection

```json
{
  "error": "starterPack must reference a starter pack record (collection \"app.bsky.graph.list\" is not app.bsky.graph.starterpack)",
  "code": "VALIDATION_ERROR"
}
```

#### Unrecognized Link

```json
{
  "error": "Unrecognized starter pack link. Expected https://bsky.app/starter-pack/{handle-or-did}/{rkey} (go.bsky.app short links are not supported — open one in a browser and use the resulting bsky.app URL).",
  "code": "VALIDATION_ERROR"
}
```

## Related Tools

- **[search_starter_packs](./search-starter-packs.md)** - Discover packs by keyword
- **[get_list](./get-list.md)** - Page through the pack's full member list
- **[get_user_profile](./get-user-profile.md)** - Look up a member's profile
