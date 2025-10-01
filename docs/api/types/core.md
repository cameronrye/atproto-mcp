# Core Types

Branded types and AT Protocol identifiers used throughout the server.

## Branded Types

Branded types provide type safety for AT Protocol identifiers, preventing accidental misuse of strings.

### DID (Decentralized Identifier)

```typescript
type DID = string & { readonly __brand: 'DID' };
```

**Description:** Permanent, unique identifier for users and repositories.

**Format:** `did:plc:` followed by base32-encoded identifier

**Examples:**
```typescript
const userDid: DID = "did:plc:abc123xyz789" as DID;
const repoDid: DID = "did:plc:def456uvw012" as DID;
```

**Characteristics:**
- Permanent (never changes)
- Globally unique
- Cryptographically verifiable
- Use for internal references

### ATURI (AT Protocol URI)

```typescript
type ATURI = string & { readonly __brand: 'ATURI' };
```

**Description:** URI for AT Protocol resources (posts, likes, follows, etc.).

**Format:** `at://[DID]/[collection]/[rkey]`

**Examples:**
```typescript
const postUri: ATURI = "at://did:plc:abc123/app.bsky.feed.post/xyz789" as ATURI;
const likeUri: ATURI = "at://did:plc:abc123/app.bsky.feed.like/like123" as ATURI;
const followUri: ATURI = "at://did:plc:abc123/app.bsky.graph.follow/follow456" as ATURI;
```

**Components:**
- **DID**: Repository identifier
- **Collection**: Record type (e.g., `app.bsky.feed.post`)
- **Record Key (rkey)**: Unique record identifier

### NSID (Namespaced Identifier)

```typescript
type NSID = string & { readonly __brand: 'NSID' };
```

**Description:** Namespaced identifier for Lexicon schemas and collections.

**Format:** Reverse domain notation with segments

**Examples:**
```typescript
const postType: NSID = "app.bsky.feed.post" as NSID;
const likeType: NSID = "app.bsky.feed.like" as NSID;
const profileType: NSID = "app.bsky.actor.profile" as NSID;
```

**Common NSIDs:**
- `app.bsky.feed.post` - Posts
- `app.bsky.feed.like` - Likes
- `app.bsky.feed.repost` - Reposts
- `app.bsky.graph.follow` - Follows
- `app.bsky.graph.block` - Blocks
- `app.bsky.actor.profile` - Profiles

### CID (Content Identifier)

```typescript
type CID = string & { readonly __brand: 'CID' };
```

**Description:** Content-addressed identifier using IPFS CID format.

**Format:** Base32-encoded multihash

**Examples:**
```typescript
const postCid: CID = "bafyreiabc123xyz789..." as CID;
const imageCid: CID = "bafkreidef456uvw012..." as CID;
```

**Characteristics:**
- Content-addressed (hash of content)
- Immutable
- Verifiable
- Used for data integrity

## AT Protocol Types

### IAtpSession

```typescript
interface IAtpSession {
  did: DID;
  handle: string;
  accessJwt: string;
  refreshJwt: string;
  active: boolean;
}
```

**Description:** Authenticated session information.

**Fields:**
- `did` - User's DID
- `handle` - User's handle
- `accessJwt` - Access token (2 hour lifetime)
- `refreshJwt` - Refresh token (90 day lifetime)
- `active` - Whether session is active

### IAtpProfile

```typescript
interface IAtpProfile {
  did: DID;
  handle: string;
  displayName?: string;
  description?: string;
  avatar?: string;
  banner?: string;
  followersCount?: number;
  followsCount?: number;
  postsCount?: number;
}
```

**Description:** User profile information.

**Fields:**
- `did` - User's DID (required)
- `handle` - User's handle (required)
- `displayName` - Display name
- `description` - Bio text
- `avatar` - Avatar image URL
- `banner` - Banner image URL
- `followersCount` - Number of followers
- `followsCount` - Number of follows
- `postsCount` - Number of posts

### IAtpPost

```typescript
interface IAtpPost {
  uri: ATURI;
  cid: CID;
  author: IAtpProfile;
  record: {
    text: string;
    createdAt: string;
    reply?: {
      root: { uri: ATURI; cid: CID };
      parent: { uri: ATURI; cid: CID };
    };
    embed?: unknown;
    langs?: string[];
    labels?: unknown;
    tags?: string[];
  };
  replyCount?: number;
  repostCount?: number;
  likeCount?: number;
  indexedAt: string;
  viewer?: {
    repost?: ATURI;
    like?: ATURI;
  };
}
```

**Description:** Post data structure.

**Fields:**
- `uri` - Post URI
- `cid` - Post CID
- `author` - Post author profile
- `record` - Post record data
  - `text` - Post text content
  - `createdAt` - Creation timestamp
  - `reply` - Reply information (if reply)
  - `embed` - Embedded content
  - `langs` - Language codes
  - `tags` - Hashtags
- `replyCount` - Number of replies
- `repostCount` - Number of reposts
- `likeCount` - Number of likes
- `indexedAt` - Index timestamp
- `viewer` - Viewer-specific data (when authenticated)

## Type Guards

### Validating Branded Types

```typescript
function isDID(value: string): value is DID {
  return value.startsWith('did:');
}

function isATURI(value: string): value is ATURI {
  return value.startsWith('at://');
}

function isCID(value: string): value is CID {
  return value.startsWith('bafy') || value.startsWith('bafk');
}
```

## Usage Examples

### Working with DIDs

```typescript
// Store user DID
const userDid: DID = profile.did;

// Use in API calls
const followers = await getFollowers({ actor: userDid });
```

### Working with AT URIs

```typescript
// Store post URI
const postUri: ATURI = post.uri;

// Use for operations
await likePost({ uri: postUri, cid: post.cid });
await replyToPost({ 
  text: "Great post!",
  root: postUri,
  parent: postUri
});
```

### Working with CIDs

```typescript
// Verify content integrity
const expectedCid: CID = post.cid;
const actualCid: CID = calculateCID(post.record);

if (expectedCid === actualCid) {
  console.log('Content verified');
}
```

## Best Practices

### Type Safety
- Use branded types for all AT Protocol identifiers
- Don't cast strings to branded types without validation
- Implement type guards for runtime validation
- Use TypeScript strict mode

### Identifier Storage
- Store DIDs for permanent references
- Store AT URIs for resource references
- Store CIDs for content verification
- Don't rely on handles (they can change)

### Validation
- Validate format before casting to branded types
- Check for null/undefined values
- Handle invalid identifiers gracefully
- Log validation errors

## See Also

- [Configuration Types](./configuration.md)
- [Parameter Types](./parameters.md)
- [Error Types](./errors.md)
- [AT Protocol Specification](https://atproto.com/specs/at-uri-scheme)

