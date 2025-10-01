# AT Protocol

Understanding the Authenticated Transfer Protocol and how it powers decentralized social networking.

## What is AT Protocol?

The **Authenticated Transfer Protocol (AT Protocol or atproto)** is an open, decentralized protocol for large-scale distributed social applications. It was created by Bluesky to enable a new generation of social networks where users own their data and identity.

## Core Principles

### 1. Decentralization

No single company controls the network. Anyone can:
- Run their own Personal Data Server (PDS)
- Create their own applications
- Build custom algorithms and feeds
- Host their own data

### 2. Portability

Users can move between services without losing:
- Their social graph (followers/following)
- Their content and posts
- Their identity and reputation
- Their application data

### 3. Interoperability

Different applications can work with the same data:
- Multiple clients can access the same account
- Third-party apps can build on the protocol
- Custom feeds and algorithms can be shared
- Data is accessible across services

## Architecture

```
┌─────────────────────────────────────────────┐
│           Applications Layer                │
│  (Bluesky, Custom Clients, Bots, etc.)     │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│         AT Protocol Layer                   │
│  - Identity (DIDs)                          │
│  - Data Repositories (Repos)                │
│  - Lexicons (Schemas)                       │
│  - Federation (XRPC)                        │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│        Infrastructure Layer                 │
│  - Personal Data Servers (PDS)              │
│  - Relays (BGS)                             │
│  - App Views                                │
│  - Feed Generators                          │
└─────────────────────────────────────────────┘
```

## Key Components

### Personal Data Server (PDS)

Your personal data server hosts your:
- Account and identity
- Posts and content
- Social graph
- Application data

**Default PDS**: `bsky.social` (run by Bluesky)
**Custom PDS**: You can run your own!

### Decentralized Identifiers (DIDs)

Every account has a unique DID:
- Format: `did:plc:abc123...`
- Cryptographically secure
- Portable across services
- Resolves to your current PDS

### Handles

Human-readable identifiers:
- Format: `username.bsky.social`
- Can use custom domains: `username.com`
- Maps to your DID
- Can be changed without losing identity

### Repositories (Repos)

Your data is stored in a repository:
- Merkle tree structure (like Git)
- Cryptographically signed
- Versioned and auditable
- Portable and exportable

### Lexicons

Schemas that define data structures:
- `app.bsky.feed.post` - Post records
- `app.bsky.actor.profile` - Profile data
- `app.bsky.graph.follow` - Follow relationships
- Custom lexicons for new features

### XRPC (Cross-system RPC)

HTTP-based RPC protocol:
- RESTful API design
- JSON request/response
- Authentication via JWT
- Rate limiting and quotas

## Data Model

### Records

Everything is a record with:

```typescript
{
  $type: string;        // Lexicon type
  createdAt: string;    // ISO 8601 timestamp
  // ... type-specific fields
}
```

### Example: Post Record

```typescript
{
  $type: "app.bsky.feed.post",
  text: "Hello AT Protocol!",
  createdAt: "2024-01-01T12:00:00Z",
  langs: ["en"],
  reply: {
    root: { uri: "...", cid: "..." },
    parent: { uri: "...", cid: "..." }
  },
  embed: {
    $type: "app.bsky.embed.images",
    images: [...]
  }
}
```

### AT-URIs

Unique identifiers for records:

```
at://did:plc:abc123.../app.bsky.feed.post/xyz789
│   │                  │                    │
│   └─ DID             └─ Collection        └─ Record Key
└─ Protocol
```

### CIDs (Content Identifiers)

Content-addressed identifiers:
- Based on IPFS CIDs
- Cryptographic hash of content
- Ensures data integrity
- Enables verification

## Federation

### How It Works

```
1. User creates post on their PDS
   ↓
2. PDS signs and stores the record
   ↓
3. PDS sends event to Relay (BGS)
   ↓
4. Relay broadcasts to subscribers
   ↓
5. App Views index the data
   ↓
6. Other users see the post
```

### Components

**Relay (BGS - Big Graph Service)**
- Aggregates data from all PDSs
- Provides firehose of all events
- Enables global search and discovery

**App View**
- Indexes data for specific use cases
- Provides query APIs
- Implements business logic
- Can be specialized (e.g., video, music)

**Feed Generator**
- Custom algorithm services
- Generate personalized feeds
- Can be created by anyone
- Discoverable and shareable

## Authentication

### Session Management

```
1. Login with identifier + password
   ↓
2. Receive access token + refresh token
   ↓
3. Use access token for API calls
   ↓
4. Refresh when access token expires
```

### App Passwords

Special passwords for third-party apps:
- Limited scope
- Can be revoked individually
- Don't expose main password
- Recommended for integrations

### OAuth (Coming Soon)

Standard OAuth 2.0 flow:
- User consent required
- Scoped permissions
- Token-based access
- Secure for public apps

## Common Operations

### Creating a Post

```typescript
await agent.post({
  text: "Hello world!",
  createdAt: new Date().toISOString()
});
```

### Following a User

```typescript
await agent.follow("did:plc:abc123...");
```

### Searching Posts

```typescript
await agent.app.bsky.feed.searchPosts({
  q: "artificial intelligence",
  limit: 25
});
```

### Getting Timeline

```typescript
await agent.getTimeline({
  limit: 50,
  cursor: "..."
});
```

## Rate Limits

AT Protocol implements rate limiting:

| Operation | Limit | Window |
|-----------|-------|--------|
| Reads | 3000 | 5 minutes |
| Writes | 300 | 5 minutes |
| Auth | 30 | 5 minutes |

**Best Practices**:
- Implement exponential backoff
- Cache responses when possible
- Batch operations when available
- Monitor rate limit headers

## Moderation

### Labeling System

Content can be labeled:
- By the author
- By moderators
- By labeling services
- By users (personal labels)

### Moderation Actions

- **Hide**: Remove from feeds
- **Warn**: Show warning before viewing
- **Blur**: Blur images/content
- **Report**: Flag for review

### Labeling Services

Third-party moderation:
- Subscribe to labeling services
- Custom moderation rules
- Community-driven moderation
- Transparent and auditable

## Advanced Features

### Rich Text

Posts support rich formatting:
- **Mentions**: `@username.bsky.social`
- **Links**: Automatic link detection
- **Hashtags**: `#topic`
- **Facets**: Structured text annotations

### Embeds

Posts can embed:
- **Images**: Up to 4 images
- **External Links**: With preview cards
- **Quotes**: Quote other posts
- **Records**: Embed any record type

### Threads

Threaded conversations:
- Reply chains
- Root post tracking
- Thread context
- Conversation trees

### Custom Feeds

Algorithmic feeds:
- Created by anyone
- Published as feed generators
- Discoverable in-app
- Can be subscribed to

## Development Resources

### Official SDK

```bash
npm install @atproto/api
```

### Documentation

- [AT Protocol Docs](https://atproto.com)
- [Lexicon Browser](https://atproto.com/lexicons)
- [API Reference](https://docs.bsky.app)

### Tools

- **ATP CLI**: Command-line tool
- **Lexicon Validator**: Schema validation
- **PDS Admin**: Server management
- **Feed Generator Kit**: Build custom feeds

## Comparison with Other Protocols

| Feature | AT Protocol | ActivityPub | Nostr |
|---------|-------------|-------------|-------|
| **Identity** | DIDs | URLs | Public keys |
| **Data Model** | Repos | Objects | Events |
| **Federation** | Relays | Server-to-server | Relays |
| **Portability** | High | Medium | High |
| **Scalability** | High | Medium | High |

## Future Developments

### Roadmap

- **OAuth Support**: Standard authentication
- **Video Support**: Native video hosting
- **Direct Messages**: Private messaging
- **Groups**: Community features
- **Payments**: Micropayments and tipping

### Ecosystem Growth

- More PDS implementations
- Custom app views
- Specialized clients
- Third-party services
- Developer tools

## Best Practices

### For Developers

- ✅ Use official SDKs
- ✅ Respect rate limits
- ✅ Implement proper error handling
- ✅ Cache responses appropriately
- ✅ Follow lexicon specifications

### For Users

- ✅ Use app passwords for third-party apps
- ✅ Verify app permissions
- ✅ Back up your data
- ✅ Consider running your own PDS
- ✅ Participate in moderation

## Next Steps

- **[Tools & Resources](./tools-resources.md)** - Explore MCP tools
- **[Examples](../examples/basic-usage.md)** - See AT Protocol in action
- **[API Reference](../api/tools.md)** - Detailed API documentation

---

**Previous**: [MCP Protocol](./mcp-protocol.md) ← | **Next**: [Tools & Resources](./tools-resources.md) →

