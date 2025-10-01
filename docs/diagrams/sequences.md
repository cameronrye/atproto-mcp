# Sequence Diagrams

Interaction sequences for common operations.

## OAuth Authentication Sequence

```mermaid
sequenceDiagram
    participant User
    participant Client as MCP Client
    participant Server as MCP Server
    participant OAuth as OAuth Server
    participant PDS as AT Protocol PDS
    
    User->>Client: Initiate Login
    Client->>Server: start_oauth_flow(identifier)
    Server->>OAuth: Request Authorization URL
    OAuth-->>Server: Authorization URL + State
    Server-->>Client: Return Auth URL
    
    Client->>User: Display Auth URL
    User->>OAuth: Open URL in Browser
    OAuth->>User: Show Login Page
    User->>OAuth: Enter Credentials
    OAuth->>User: Request Consent
    User->>OAuth: Grant Permissions
    
    OAuth->>Client: Redirect with Code
    Client->>Server: handle_oauth_callback(code, state)
    Server->>OAuth: Exchange Code for Tokens
    OAuth->>PDS: Validate & Create Session
    PDS-->>OAuth: Session Created
    OAuth-->>Server: Access & Refresh Tokens
    Server-->>Client: Session Info
    Client-->>User: Login Successful
```

## Post Creation Sequence

```mermaid
sequenceDiagram
    participant Client as MCP Client
    participant Server as MCP Server
    participant Auth as Auth Manager
    participant PDS as AT Protocol PDS
    
    Client->>Server: create_post(text, embed)
    Server->>Auth: Verify Authentication
    Auth-->>Server: Session Valid
    
    alt Has Images
        Server->>PDS: Upload Image Blobs
        PDS-->>Server: Blob References
    end
    
    Server->>PDS: Create Post Record
    PDS-->>Server: Post URI & CID
    Server-->>Client: Success Response
```

## Real-time Streaming Sequence

```mermaid
sequenceDiagram
    participant Client as MCP Client
    participant Server as MCP Server
    participant Firehose as AT Protocol Firehose
    participant Buffer as Event Buffer
    
    Client->>Server: start_streaming(subscriptionId)
    Server->>Firehose: Connect WebSocket
    Firehose-->>Server: Connection Established
    Server-->>Client: Streaming Started
    
    loop Event Stream
        Firehose->>Server: Stream Event
        Server->>Buffer: Store Event
    end
    
    loop Polling
        Client->>Server: get_recent_events(limit)
        Server->>Buffer: Fetch Events
        Buffer-->>Server: Recent Events
        Server-->>Client: Events Response
    end
    
    Client->>Server: stop_streaming(subscriptionId)
    Server->>Firehose: Close Connection
    Server-->>Client: Streaming Stopped
```

## Token Refresh Sequence

```mermaid
sequenceDiagram
    participant Client as MCP Client
    participant Server as MCP Server
    participant Auth as Auth Manager
    participant PDS as AT Protocol PDS
    
    Client->>Server: create_post(text)
    Server->>Auth: Get Access Token
    Auth-->>Server: Expired Token
    
    Server->>Auth: Check Refresh Token
    Auth-->>Server: Refresh Token Valid
    
    Server->>PDS: refresh_oauth_tokens(refreshToken)
    PDS-->>Server: New Access & Refresh Tokens
    
    Server->>Auth: Store New Tokens
    Auth-->>Server: Tokens Updated
    
    Server->>PDS: create_post (with new token)
    PDS-->>Server: Post Created
    Server-->>Client: Success Response
```

## Resource Access Sequence

```mermaid
sequenceDiagram
    participant Client as MCP Client
    participant Server as MCP Server
    participant Cache as Cache Layer
    participant PDS as AT Protocol PDS
    
    Client->>Server: Read Resource (atproto://timeline)
    Server->>Cache: Check Cache
    
    alt Cache Hit
        Cache-->>Server: Cached Data
        Server-->>Client: Return Data
    else Cache Miss
        Server->>PDS: Fetch Timeline
        PDS-->>Server: Timeline Data
        Server->>Cache: Store in Cache
        Server-->>Client: Return Data
    end
```

## Error Handling Sequence

```mermaid
sequenceDiagram
    participant Client as MCP Client
    participant Server as MCP Server
    participant PDS as AT Protocol PDS
    
    Client->>Server: create_post(text)
    Server->>PDS: Create Post
    PDS-->>Server: 429 Rate Limit Error
    
    Server->>Server: Parse Retry-After Header
    Server-->>Client: Rate Limit Error (retryAfter: 60)
    
    Client->>Client: Wait 60 seconds
    Client->>Server: create_post(text) [Retry]
    Server->>PDS: Create Post
    PDS-->>Server: Success
    Server-->>Client: Post Created
```

## Multi-Step Operation Sequence

```mermaid
sequenceDiagram
    participant Client as MCP Client
    participant Server as MCP Server
    participant PDS as AT Protocol PDS
    
    Note over Client,PDS: Create Post with Image
    
    Client->>Server: upload_image(imageBlob, alt)
    Server->>PDS: Upload Blob
    PDS-->>Server: Blob Reference
    Server-->>Client: Upload Success
    
    Client->>Server: create_post(text, embed: {images})
    Server->>PDS: Create Post with Blob Ref
    PDS-->>Server: Post URI & CID
    Server-->>Client: Post Created
```

## Follow/Unfollow Sequence

```mermaid
sequenceDiagram
    participant Client as MCP Client
    participant Server as MCP Server
    participant PDS as AT Protocol PDS
    
    Client->>Server: follow_user(actor)
    Server->>PDS: Resolve Actor to DID
    PDS-->>Server: DID
    
    Server->>PDS: Create Follow Record
    PDS-->>Server: Follow URI
    Server-->>Client: Follow Success (store URI)
    
    Note over Client: Later...
    
    Client->>Server: unfollow_user(followUri)
    Server->>PDS: Delete Follow Record
    PDS-->>Server: Deleted
    Server-->>Client: Unfollow Success
```

## Search and Pagination Sequence

```mermaid
sequenceDiagram
    participant Client as MCP Client
    participant Server as MCP Server
    participant PDS as AT Protocol PDS
    
    Client->>Server: search_posts(q, limit: 50)
    Server->>PDS: Search Request
    PDS-->>Server: Results + Cursor
    Server-->>Client: Page 1 Results
    
    Client->>Server: search_posts(q, cursor, limit: 50)
    Server->>PDS: Search Request with Cursor
    PDS-->>Server: Results + Cursor
    Server-->>Client: Page 2 Results
    
    Client->>Server: search_posts(q, cursor, limit: 50)
    Server->>PDS: Search Request with Cursor
    PDS-->>Server: Results (no cursor)
    Server-->>Client: Final Page Results
```

## Bot Mention Response Sequence

```mermaid
sequenceDiagram
    participant Bot as Bot Client
    participant Server as MCP Server
    participant Firehose as Firehose
    participant PDS as AT Protocol PDS
    
    Bot->>Server: start_streaming(subscriptionId)
    Server->>Firehose: Connect
    
    loop Monitor Events
        Firehose->>Server: New Post Event
        Bot->>Server: get_recent_events()
        Server-->>Bot: Events (including mention)
        
        Bot->>Bot: Detect Mention
        Bot->>Server: reply_to_post(text, root, parent)
        Server->>PDS: Create Reply
        PDS-->>Server: Reply Created
        Server-->>Bot: Success
    end
```

## Profile Update Sequence

```mermaid
sequenceDiagram
    participant Client as MCP Client
    participant Server as MCP Server
    participant PDS as AT Protocol PDS
    
    Client->>Server: upload_image(avatarBlob)
    Server->>PDS: Upload Avatar Blob
    PDS-->>Server: Avatar Blob Ref
    Server-->>Client: Upload Success
    
    Client->>Server: upload_image(bannerBlob)
    Server->>PDS: Upload Banner Blob
    PDS-->>Server: Banner Blob Ref
    Server-->>Client: Upload Success
    
    Client->>Server: update_profile(displayName, description, avatar, banner)
    Server->>PDS: Update Profile Record
    PDS-->>Server: Profile Updated
    Server-->>Client: Update Success
```

## Moderation Action Sequence

```mermaid
sequenceDiagram
    participant Client as MCP Client
    participant Server as MCP Server
    participant PDS as AT Protocol PDS
    participant ModService as Moderation Service
    
    Client->>Server: report_content(subject, reasonType, reason)
    Server->>PDS: Verify Content Exists
    PDS-->>Server: Content Found
    
    Server->>ModService: Submit Report
    ModService-->>Server: Report ID
    Server-->>Client: Report Submitted
    
    Note over Client: Optionally block user
    
    Client->>Server: block_user(actor)
    Server->>PDS: Create Block Record
    PDS-->>Server: Block URI
    Server-->>Client: User Blocked
```

## See Also

- [Architecture Diagrams](./architecture.md)
- [Flow Charts](./flows.md)
- [API Reference](../api/)

