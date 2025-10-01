# Architecture Diagrams

Visual representations of the AT Protocol MCP Server architecture.

## System Architecture

```mermaid
graph TB
    subgraph "MCP Client"
        Client[MCP Client Application]
    end
    
    subgraph "MCP Server"
        Server[MCP Server Core]
        Tools[Tool Handlers]
        Resources[Resource Providers]
        Auth[Authentication Manager]
    end
    
    subgraph "AT Protocol"
        PDS[Personal Data Server]
        Firehose[Firehose Stream]
        AppView[App View API]
    end
    
    Client -->|MCP Protocol| Server
    Server --> Tools
    Server --> Resources
    Server --> Auth
    
    Tools -->|API Calls| PDS
    Tools -->|API Calls| AppView
    Resources -->|API Calls| PDS
    Resources -->|API Calls| AppView
    Auth -->|Authentication| PDS
    
    Server -->|Subscribe| Firehose
    Firehose -->|Events| Server
    
    style Client fill:#e1f5ff
    style Server fill:#fff3e0
    style PDS fill:#f3e5f5
    style Firehose fill:#e8f5e9
```

## Component Architecture

```mermaid
graph LR
    subgraph "Core Components"
        MCP[MCP Protocol Handler]
        Router[Request Router]
        Validator[Input Validator]
    end
    
    subgraph "Tool Layer"
        Social[Social Tools]
        Content[Content Tools]
        OAuth[OAuth Tools]
        Streaming[Streaming Tools]
    end
    
    subgraph "Resource Layer"
        Timeline[Timeline Resource]
        Profile[Profile Resource]
        Notifications[Notifications Resource]
    end
    
    subgraph "Infrastructure"
        Auth[Auth Manager]
        Cache[Cache Layer]
        Logger[Logger]
        ErrorHandler[Error Handler]
    end
    
    MCP --> Router
    Router --> Validator
    Validator --> Social
    Validator --> Content
    Validator --> OAuth
    Validator --> Streaming
    
    Router --> Timeline
    Router --> Profile
    Router --> Notifications
    
    Social --> Auth
    Content --> Auth
    OAuth --> Auth
    
    Social --> Cache
    Content --> Cache
    
    Social --> ErrorHandler
    Content --> ErrorHandler
    OAuth --> ErrorHandler
    Streaming --> ErrorHandler
    
    style MCP fill:#e3f2fd
    style Auth fill:#fff3e0
    style Cache fill:#f3e5f5
```

## Data Flow Architecture

```mermaid
flowchart TD
    Start[Client Request] --> Validate{Valid Request?}
    Validate -->|No| Error[Return Error]
    Validate -->|Yes| Auth{Requires Auth?}
    
    Auth -->|No| Execute[Execute Tool/Resource]
    Auth -->|Yes| CheckAuth{Authenticated?}
    
    CheckAuth -->|No| AuthError[Authentication Error]
    CheckAuth -->|Yes| Execute
    
    Execute --> Cache{Cacheable?}
    Cache -->|Yes| CheckCache{In Cache?}
    Cache -->|No| API[Call AT Protocol API]
    
    CheckCache -->|Yes| Return[Return Cached Data]
    CheckCache -->|No| API
    
    API --> Success{Success?}
    Success -->|Yes| StoreCache[Store in Cache]
    Success -->|No| HandleError[Handle Error]
    
    StoreCache --> Return
    HandleError --> Error
    
    Return --> End[Return to Client]
    Error --> End
    AuthError --> End
    
    style Start fill:#e8f5e9
    style End fill:#e8f5e9
    style Error fill:#ffebee
    style AuthError fill:#ffebee
```

## Authentication Architecture

```mermaid
graph TB
    subgraph "Authentication Methods"
        AppPass[App Password]
        OAuth[OAuth 2.0]
        Unauth[Unauthenticated]
    end
    
    subgraph "Auth Manager"
        Manager[Authentication Manager]
        SessionStore[Session Store]
        TokenRefresh[Token Refresh]
    end
    
    subgraph "AT Protocol"
        PDS[Personal Data Server]
        OAuthServer[OAuth Server]
    end
    
    AppPass -->|Credentials| Manager
    OAuth -->|OAuth Flow| Manager
    Unauth -->|No Auth| Manager
    
    Manager -->|Create Session| PDS
    Manager -->|OAuth Flow| OAuthServer
    Manager --> SessionStore
    Manager --> TokenRefresh
    
    SessionStore -->|Store Tokens| Manager
    TokenRefresh -->|Refresh| PDS
    
    style AppPass fill:#e3f2fd
    style OAuth fill:#f3e5f5
    style Unauth fill:#fff3e0
    style Manager fill:#e8f5e9
```

## Streaming Architecture

```mermaid
graph TB
    subgraph "Firehose Client"
        Client[Firehose Client]
        Buffer[Event Buffer]
        Subscriptions[Subscription Manager]
    end
    
    subgraph "AT Protocol"
        Firehose[Firehose Stream]
    end
    
    subgraph "Event Processing"
        Filter[Event Filter]
        Handler[Event Handler]
        Store[Event Store]
    end
    
    subgraph "Consumers"
        Tools[MCP Tools]
        Analytics[Analytics]
        Bots[Bots]
    end
    
    Firehose -->|WebSocket| Client
    Client --> Buffer
    Client --> Subscriptions
    
    Buffer --> Filter
    Filter --> Handler
    Handler --> Store
    
    Store --> Tools
    Store --> Analytics
    Store --> Bots
    
    style Firehose fill:#e8f5e9
    style Client fill:#e3f2fd
    style Buffer fill:#fff3e0
```

## Deployment Architecture

```mermaid
graph TB
    subgraph "Client Applications"
        Desktop[Desktop App]
        Web[Web App]
        CLI[CLI Tool]
    end
    
    subgraph "MCP Server Deployment"
        Server[MCP Server]
        Config[Configuration]
        Logs[Logs]
    end
    
    subgraph "External Services"
        Bluesky[Bluesky PDS]
        CustomPDS[Custom PDS]
        Firehose[Firehose]
    end
    
    Desktop -->|MCP Protocol| Server
    Web -->|MCP Protocol| Server
    CLI -->|MCP Protocol| Server
    
    Config --> Server
    Server --> Logs
    
    Server -->|HTTPS| Bluesky
    Server -->|HTTPS| CustomPDS
    Server -->|WebSocket| Firehose
    
    style Server fill:#e3f2fd
    style Bluesky fill:#e8f5e9
    style CustomPDS fill:#e8f5e9
```

## Tool Organization

```mermaid
graph LR
    subgraph "Social Tools"
        Post[create_post]
        Reply[reply_to_post]
        Like[like_post]
        Repost[repost]
    end
    
    subgraph "User Tools"
        Follow[follow_user]
        Profile[get_user_profile]
        Update[update_profile]
    end
    
    subgraph "Data Tools"
        Search[search_posts]
        Timeline[get_timeline]
        Notifications[get_notifications]
    end
    
    subgraph "OAuth Tools"
        Start[start_oauth_flow]
        Callback[handle_oauth_callback]
        Refresh[refresh_oauth_tokens]
    end
    
    subgraph "Streaming Tools"
        StartStream[start_streaming]
        GetEvents[get_recent_events]
        Status[get_streaming_status]
    end
    
    style Post fill:#e3f2fd
    style Follow fill:#f3e5f5
    style Search fill:#fff3e0
    style Start fill:#e8f5e9
    style StartStream fill:#ffebee
```

## Resource Architecture

```mermaid
graph TB
    subgraph "MCP Resources"
        Timeline[Timeline Resource<br/>atproto://timeline]
        Profile[Profile Resource<br/>atproto://profile]
        Notifs[Notifications Resource<br/>atproto://notifications]
    end
    
    subgraph "Data Sources"
        TimelineAPI[Timeline API]
        ProfileAPI[Profile API]
        NotifsAPI[Notifications API]
    end
    
    subgraph "Caching"
        Cache[Resource Cache]
    end
    
    Timeline -->|Fetch| TimelineAPI
    Profile -->|Fetch| ProfileAPI
    Notifs -->|Fetch| NotifsAPI
    
    Timeline --> Cache
    Profile --> Cache
    Notifs --> Cache
    
    Cache -->|TTL: 30s| Timeline
    Cache -->|TTL: 5m| Profile
    Cache -->|TTL: 30s| Notifs
    
    style Timeline fill:#e3f2fd
    style Profile fill:#f3e5f5
    style Notifs fill:#fff3e0
```

## Error Handling Architecture

```mermaid
graph TB
    Operation[Tool/Resource Operation] --> Try{Try Execute}
    
    Try -->|Success| Return[Return Result]
    Try -->|Error| Classify{Classify Error}
    
    Classify -->|Auth Error| RefreshToken{Can Refresh?}
    Classify -->|Rate Limit| WaitRetry[Wait & Retry]
    Classify -->|Network Error| NetworkRetry{Retry?}
    Classify -->|Validation Error| ValidationError[Return Validation Error]
    Classify -->|Other| GenericError[Return Error]
    
    RefreshToken -->|Yes| Refresh[Refresh Token]
    RefreshToken -->|No| AuthError[Return Auth Error]
    
    Refresh --> Retry[Retry Operation]
    WaitRetry --> Retry
    NetworkRetry -->|Yes| Retry
    NetworkRetry -->|No| NetworkError[Return Network Error]
    
    Retry --> Try
    
    Return --> End[End]
    ValidationError --> End
    GenericError --> End
    AuthError --> End
    NetworkError --> End
    
    style Return fill:#e8f5e9
    style ValidationError fill:#ffebee
    style GenericError fill:#ffebee
    style AuthError fill:#ffebee
    style NetworkError fill:#ffebee
```

## See Also

- [Flow Charts](./flows.md)
- [Sequence Diagrams](./sequences.md)
- [API Reference](../api/)

