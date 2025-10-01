# Profile Resource

MCP resource that exposes the authenticated user's profile information and statistics.

## Resource URI

```
atproto://profile
```

## Authentication

**Required:** Yes

This resource requires authentication to access the user's profile data.

## Resource Information

- **Name:** User Profile
- **Description:** Current user's profile information and statistics
- **MIME Type:** `application/json`

## Data Structure

```typescript
{
  uri: string;              // Resource URI
  timestamp: string;        // ISO 8601 timestamp when data was fetched
  profile: {
    did: string;            // User's DID
    handle: string;         // User's handle
    displayName?: string;   // Display name
    description?: string;   // Bio/description
    avatar?: string;        // Avatar image URL
    banner?: string;        // Banner image URL
    followersCount: number; // Number of followers
    followsCount: number;   // Number of users followed
    postsCount: number;     // Number of posts
    indexedAt?: string;     // When profile was indexed
    createdAt?: string;     // Account creation date
    labels?: Array<{        // Moderation labels
      src: string;
      uri: string;
      cid: string;
      val: string;
      cts: string;
    }>;
  };
  session: {
    did: string;            // Session DID
    handle: string;         // Session handle
    active: boolean;        // Session active status
  };
}
```

## Example Response

```json
{
  "uri": "atproto://profile",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "profile": {
    "did": "did:plc:abc123xyz789",
    "handle": "alice.bsky.social",
    "displayName": "Alice Smith",
    "description": "Software engineer and coffee enthusiast ☕\nBuilding cool things with AT Protocol",
    "avatar": "https://cdn.bsky.app/img/avatar/plain/did:plc:abc123xyz789/...",
    "banner": "https://cdn.bsky.app/img/banner/plain/did:plc:abc123xyz789/...",
    "followersCount": 1234,
    "followsCount": 567,
    "postsCount": 890,
    "indexedAt": "2024-01-15T10:29:00.000Z",
    "createdAt": "2023-06-15T08:00:00.000Z",
    "labels": []
  },
  "session": {
    "did": "did:plc:abc123xyz789",
    "handle": "alice.bsky.social",
    "active": true
  }
}
```

## Usage in MCP

### Accessing the Resource

```javascript
// Request the profile resource
const resource = await mcpClient.readResource('atproto://profile');
const profileData = JSON.parse(resource.text);

console.log(`User: ${profileData.profile.displayName}`);
console.log(`Followers: ${profileData.profile.followersCount}`);
console.log(`Posts: ${profileData.profile.postsCount}`);
```

### Monitoring Profile Changes

```javascript
// Check for profile updates
let lastProfileUpdate = null;

setInterval(async () => {
  const resource = await mcpClient.readResource('atproto://profile');
  const profile = JSON.parse(resource.text);
  
  if (profile.timestamp !== lastProfileUpdate) {
    console.log('Profile updated!');
    await handleProfileUpdate(profile);
    lastProfileUpdate = profile.timestamp;
  }
}, 60000); // Check every minute
```

## Use Cases

### Profile Display
- Show user's own profile
- Display profile statistics
- Render avatar and banner
- Show bio and description

### Account Management
- Monitor account status
- Track follower growth
- Display posting activity
- Show account age

### Analytics
- Track follower count changes
- Monitor posting frequency
- Analyze profile engagement
- Measure account growth

### Session Management
- Verify active session
- Display current user info
- Confirm authentication
- Show logged-in user

## Best Practices

### Caching
- Cache profile data for 5-15 minutes
- Invalidate on profile updates
- Store for offline access
- Implement cache versioning

### Performance
- Fetch on app startup
- Refresh periodically
- Update after profile edits
- Prefetch for quick access

### User Experience
- Show profile in navigation
- Display avatar prominently
- Update UI on changes
- Handle missing fields gracefully

### Data Handling
- Parse JSON safely
- Validate data structure
- Handle missing optional fields
- Log parsing errors

## Profile Fields

### Required Fields
- `did` - Permanent user identifier
- `handle` - User's handle (can change)
- `followersCount` - Number of followers
- `followsCount` - Number of follows
- `postsCount` - Number of posts

### Optional Fields
- `displayName` - User's display name
- `description` - Bio text (supports line breaks)
- `avatar` - Avatar image URL
- `banner` - Banner image URL
- `indexedAt` - Last index timestamp
- `createdAt` - Account creation date
- `labels` - Moderation labels

## Session Information

### Session Fields
- `did` - Session DID (matches profile DID)
- `handle` - Session handle (matches profile handle)
- `active` - Whether session is active

### Session Status
- **active: true** - Valid authenticated session
- **active: false** - Session expired or invalid

## Limitations

### Data Freshness
- Data is a snapshot at fetch time
- Statistics may be slightly stale
- Profile changes may take time to reflect
- Not real-time

### Update Frequency
- Don't poll more than once per minute
- Statistics update periodically
- Profile changes may have delay
- Respect rate limits

### Content
- Only shows authenticated user's profile
- Cannot access other users' profiles via this resource
- Use `get_user_profile` tool for other users

## Related Resources

- **[Timeline Resource](./timeline.md)** - User's timeline feed
- **[Notifications Resource](./notifications.md)** - User notifications

## Related Tools

- **[get_user_profile](../tools/get-user-profile.md)** - Get any user's profile
- **[update_profile](../tools/update-profile.md)** - Update profile information

## See Also

- [MCP Protocol Guide](../../guide/mcp-protocol.md)
- [Resource Access Patterns](../../guide/tools-resources.md#resources)
- [Profile Management](../../guide/tools-resources.md#profile-management)

