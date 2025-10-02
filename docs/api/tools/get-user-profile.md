# get_user_profile

Retrieve detailed user profile information from AT Protocol.

## Authentication

**Optional:** Enhanced mode (Public tool with enhanced features when authenticated)

This tool works without authentication for public profiles, but provides additional viewer-specific information when authenticated.

### Authentication Behavior Details

**Unauthenticated Mode:**
- Returns basic profile information: handle, display name, description, avatar, banner
- Returns public statistics: followers count, following count, posts count
- Returns labels and indexed timestamps
- Does NOT include viewer-specific data

**Authenticated Mode:**
- Returns all basic information from unauthenticated mode
- PLUS viewer-specific data in the `viewer` object:
  - `viewer.following`: URI if you follow this user
  - `viewer.followedBy`: URI if this user follows you
  - `viewer.muted`: Boolean indicating if you've muted this user
  - `viewer.blocking`: URI if you've blocked this user
  - `viewer.blockedBy`: Boolean indicating if this user has blocked you

**Note:** The difference in returned data comes from the AT Protocol API itself. This tool calls the same `agent.getProfile()` method in both modes, but the AT Protocol API provides viewer-specific information only when the request includes authentication credentials.

## Parameters

### `actor` (required)
- **Type:** `string`
- **Description:** User identifier - can be either a DID or handle
- **Examples:**
  - DID: `did:plc:abc123xyz789`
  - Handle: `user.bsky.social`

## Response

```typescript
{
  success: boolean;
  profile: {
    // Basic profile information
    did: string;              // User's DID
    handle: string;           // User's handle
    displayName?: string;     // Display name
    description?: string;     // Bio/description
    avatar?: string;          // Avatar image URL
    banner?: string;          // Banner image URL
    
    // Statistics
    followersCount?: number;  // Number of followers
    followsCount?: number;    // Number of users followed
    postsCount?: number;      // Number of posts
    
    // Metadata
    indexedAt?: string;       // When profile was indexed
    createdAt?: string;       // Account creation date
    
    // Viewer-specific (only when authenticated)
    viewer?: {
      muted?: boolean;        // Whether you've muted this user
      blockedBy?: boolean;    // Whether this user blocked you
      blocking?: string;      // URI of your block record
      following?: string;     // URI of your follow record
      followedBy?: string;    // URI of their follow record
    };
    
    // Moderation labels
    labels?: Array<{
      src: string;            // Label source
      uri: string;            // Label URI
      cid: string;            // Label CID
      val: string;            // Label value
      cts: string;            // Created timestamp
    }>;
  }
}
```

## Examples

### Get Profile by Handle

```json
{
  "actor": "alice.bsky.social"
}
```

**Response (Unauthenticated):**
```json
{
  "success": true,
  "profile": {
    "did": "did:plc:abc123xyz789",
    "handle": "alice.bsky.social",
    "displayName": "Alice Smith",
    "description": "Software engineer and coffee enthusiast ☕",
    "avatar": "https://cdn.bsky.app/img/avatar/...",
    "banner": "https://cdn.bsky.app/img/banner/...",
    "followersCount": 1234,
    "followsCount": 567,
    "postsCount": 890,
    "indexedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Response (Authenticated):**
```json
{
  "success": true,
  "profile": {
    "did": "did:plc:abc123xyz789",
    "handle": "alice.bsky.social",
    "displayName": "Alice Smith",
    "description": "Software engineer and coffee enthusiast ☕",
    "avatar": "https://cdn.bsky.app/img/avatar/...",
    "banner": "https://cdn.bsky.app/img/banner/...",
    "followersCount": 1234,
    "followsCount": 567,
    "postsCount": 890,
    "indexedAt": "2024-01-15T10:30:00.000Z",
    "viewer": {
      "muted": false,
      "blockedBy": false,
      "following": "at://did:plc:myuser/app.bsky.graph.follow/follow123",
      "followedBy": "at://did:plc:abc123xyz789/app.bsky.graph.follow/follow456"
    }
  }
}
```

### Get Profile by DID

```json
{
  "actor": "did:plc:abc123xyz789"
}
```

## Error Handling

### Common Errors

#### Invalid Actor
```json
{
  "error": "Actor (DID or handle) is required",
  "code": "VALIDATION_ERROR"
}
```

#### User Not Found
```json
{
  "error": "User not found",
  "code": "NOT_FOUND"
}
```

#### Profile Unavailable
```json
{
  "error": "Profile is not available",
  "code": "UNAVAILABLE"
}
```

## Best Practices

### Actor Identifiers
- **Handles** are user-friendly but can change
- **DIDs** are permanent identifiers
- Cache DIDs for reliable lookups
- Handle resolution may fail if handle changes

### Caching
- Profile data can be cached for short periods (5-15 minutes)
- Statistics (followers, posts) change frequently
- Avatar and banner URLs are relatively stable
- Viewer data should not be cached across users

### Privacy Considerations
- Respect user privacy settings
- Check `blockedBy` before attempting interactions
- Handle blocked/muted users appropriately
- Don't expose viewer data to other users

### Performance
- Batch profile requests when possible
- Use DIDs for faster lookups
- Cache profile data appropriately
- Monitor rate limits for bulk operations

## Use Cases

### User Discovery
- Display user information in search results
- Show profile previews on hover
- Build user directories

### Relationship Management
- Check if you follow a user
- Verify mutual follows
- Detect blocks or mutes

### Analytics
- Track follower growth
- Monitor engagement metrics
- Analyze user activity

## Related Tools

- **[follow_user](./follow-user.md)** - Follow a user
- **[unfollow_user](./unfollow-user.md)** - Unfollow a user
- **[get_followers](./get-followers.md)** - Get a user's followers
- **[get_follows](./get-follows.md)** - Get users a user follows
- **[mute_user](./mute-user.md)** - Mute a user
- **[block_user](./block-user.md)** - Block a user

## See Also

- [Social Operations Examples](../../examples/social-operations.md)
- [Authentication Guide](../../guide/authentication.md)

