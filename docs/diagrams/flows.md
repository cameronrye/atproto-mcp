# Flow Charts

Process flow diagrams for common operations.

## OAuth Authentication Flow

```mermaid
flowchart TD
    Start[Start OAuth Flow] --> GetIdentifier[Get User Identifier]
    GetIdentifier --> StartFlow[Call start_oauth_flow]
    StartFlow --> GetURL[Receive Authorization URL]
    
    GetURL --> OpenBrowser[User Opens URL in Browser]
    OpenBrowser --> Login[User Logs In]
    Login --> Consent[User Grants Permissions]
    
    Consent --> Redirect[Redirect to Callback URL]
    Redirect --> ExtractCode[Extract Authorization Code]
    ExtractCode --> HandleCallback[Call handle_oauth_callback]
    
    HandleCallback --> Success{Success?}
    Success -->|Yes| StoreTokens[Store Access & Refresh Tokens]
    Success -->|No| Error[Display Error]
    
    StoreTokens --> Authenticated[User Authenticated]
    
    style Start fill:#e8f5e9
    style Authenticated fill:#e8f5e9
    style Error fill:#ffebee
```

## Post Creation Flow

```mermaid
flowchart TD
    Start[Create Post] --> HasMedia{Has Media?}
    
    HasMedia -->|Yes| UploadMedia[Upload Images/Videos]
    HasMedia -->|No| PreparePost[Prepare Post Data]
    
    UploadMedia --> GetBlobs[Get Blob References]
    GetBlobs --> PreparePost
    
    PreparePost --> HasLink{Has Link?}
    HasLink -->|Yes| GeneratePreview[Generate Link Preview]
    HasLink -->|No| CreatePost[Call create_post]
    
    GeneratePreview --> CreatePost
    
    CreatePost --> Success{Success?}
    Success -->|Yes| ReturnURI[Return Post URI]
    Success -->|No| HandleError{Error Type?}
    
    HandleError -->|Rate Limit| Wait[Wait & Retry]
    HandleError -->|Auth Error| Refresh[Refresh Tokens]
    HandleError -->|Other| Error[Return Error]
    
    Wait --> CreatePost
    Refresh --> CreatePost
    
    ReturnURI --> End[End]
    Error --> End
    
    style Start fill:#e8f5e9
    style End fill:#e8f5e9
    style Error fill:#ffebee
```

## Streaming Setup Flow

```mermaid
flowchart TD
    Start[Start Streaming] --> CreateSub[Create Subscription ID]
    CreateSub --> SelectCollections{Filter Collections?}
    
    SelectCollections -->|Yes| SetFilters[Set Collection Filters]
    SelectCollections -->|No| AllCollections[Stream All Collections]
    
    SetFilters --> StartStream[Call start_streaming]
    AllCollections --> StartStream
    
    StartStream --> Connect[Connect to Firehose]
    Connect --> Success{Connected?}
    
    Success -->|Yes| StartPolling[Start Polling for Events]
    Success -->|No| Retry{Retry?}
    
    Retry -->|Yes| Wait[Wait 5 Seconds]
    Retry -->|No| Error[Connection Error]
    
    Wait --> Connect
    
    StartPolling --> PollLoop[Poll get_recent_events]
    PollLoop --> ProcessEvents[Process Events]
    ProcessEvents --> Sleep[Sleep Interval]
    Sleep --> PollLoop
    
    Error --> End[End]
    
    style Start fill:#e8f5e9
    style Error fill:#ffebee
```

## Token Refresh Flow

```mermaid
flowchart TD
    Start[API Call] --> Execute[Execute Request]
    Execute --> Check{Success?}
    
    Check -->|Yes| Return[Return Result]
    Check -->|No| ErrorType{Error Type?}
    
    ErrorType -->|401 Unauthorized| HasRefresh{Has Refresh Token?}
    ErrorType -->|Other| OtherError[Handle Other Error]
    
    HasRefresh -->|Yes| RefreshToken[Call refresh_oauth_tokens]
    HasRefresh -->|No| AuthError[Authentication Error]
    
    RefreshToken --> RefreshSuccess{Success?}
    RefreshSuccess -->|Yes| UpdateTokens[Update Stored Tokens]
    RefreshSuccess -->|No| RefreshFailed[Refresh Failed]
    
    UpdateTokens --> Retry[Retry Original Request]
    Retry --> Execute
    
    RefreshFailed --> ReAuth[Re-authentication Required]
    
    Return --> End[End]
    OtherError --> End
    AuthError --> End
    ReAuth --> End
    
    style Start fill:#e8f5e9
    style Return fill:#e8f5e9
    style End fill:#e8f5e9
    style AuthError fill:#ffebee
    style RefreshFailed fill:#ffebee
```

## Content Moderation Flow

```mermaid
flowchart TD
    Start[Detect Violation] --> Classify{Violation Type?}
    
    Classify -->|Spam| MuteUser[Mute User]
    Classify -->|Harassment| BlockUser[Block User]
    Classify -->|Policy Violation| ReportContent[Report Content]
    Classify -->|Severe| ReportUser[Report User]
    
    MuteUser --> Log[Log Action]
    BlockUser --> Log
    ReportContent --> Log
    ReportUser --> Log
    
    Log --> Notify[Notify Moderators]
    Notify --> End[End]
    
    style Start fill:#fff3e0
    style End fill:#e8f5e9
```

## Profile Update Flow

```mermaid
flowchart TD
    Start[Update Profile] --> HasImages{Has Avatar/Banner?}
    
    HasImages -->|Yes| OptimizeImages[Optimize Images]
    HasImages -->|No| PrepareUpdate[Prepare Update Data]
    
    OptimizeImages --> UploadImages[Upload Images]
    UploadImages --> GetImageBlobs[Get Image Blobs]
    GetImageBlobs --> PrepareUpdate
    
    PrepareUpdate --> CallUpdate[Call update_profile]
    CallUpdate --> Success{Success?}
    
    Success -->|Yes| InvalidateCache[Invalidate Profile Cache]
    Success -->|No| Error[Handle Error]
    
    InvalidateCache --> Return[Return Updated Profile]
    
    Return --> End[End]
    Error --> End
    
    style Start fill:#e8f5e9
    style End fill:#e8f5e9
    style Error fill:#ffebee
```

## Search and Filter Flow

```mermaid
flowchart TD
    Start[Search Posts] --> BuildQuery[Build Search Query]
    BuildQuery --> AddFilters{Add Filters?}
    
    AddFilters -->|Author| AddAuthor[Add Author Filter]
    AddFilters -->|Date Range| AddDates[Add Date Range]
    AddFilters -->|Language| AddLang[Add Language Filter]
    AddFilters -->|Domain| AddDomain[Add Domain Filter]
    AddFilters -->|None| ExecuteSearch[Execute Search]
    
    AddAuthor --> ExecuteSearch
    AddDates --> ExecuteSearch
    AddLang --> ExecuteSearch
    AddDomain --> ExecuteSearch
    
    ExecuteSearch --> GetResults[Get Results]
    GetResults --> HasMore{Has More Results?}
    
    HasMore -->|Yes| StoreCursor[Store Cursor]
    HasMore -->|No| Return[Return Results]
    
    StoreCursor --> Return
    Return --> End[End]
    
    style Start fill:#e8f5e9
    style End fill:#e8f5e9
```

## Error Recovery Flow

```mermaid
flowchart TD
    Start[Operation Failed] --> Classify{Error Type?}
    
    Classify -->|Network| NetworkRetry{Attempt < Max?}
    Classify -->|Rate Limit| RateLimit[Wait for Retry-After]
    Classify -->|Auth| AuthRefresh{Can Refresh?}
    Classify -->|Validation| ValidationError[Return Validation Error]
    Classify -->|Fatal| FatalError[Return Fatal Error]
    
    NetworkRetry -->|Yes| Backoff[Exponential Backoff]
    NetworkRetry -->|No| NetworkFailed[Network Error]
    
    Backoff --> Retry[Retry Operation]
    RateLimit --> Retry
    
    AuthRefresh -->|Yes| RefreshTokens[Refresh Tokens]
    AuthRefresh -->|No| AuthFailed[Auth Error]
    
    RefreshTokens --> Retry
    Retry --> Start
    
    ValidationError --> End[End]
    FatalError --> End
    NetworkFailed --> End
    AuthFailed --> End
    
    style ValidationError fill:#ffebee
    style FatalError fill:#ffebee
    style NetworkFailed fill:#ffebee
    style AuthFailed fill:#ffebee
```

## Bot Lifecycle Flow

```mermaid
flowchart TD
    Start[Start Bot] --> LoadConfig[Load Configuration]
    LoadConfig --> Authenticate[Authenticate]
    
    Authenticate --> AuthSuccess{Success?}
    AuthSuccess -->|No| AuthError[Authentication Error]
    AuthSuccess -->|Yes| StartStreaming[Start Streaming]
    
    StartStreaming --> InitPolling[Initialize Polling]
    InitPolling --> Running[Bot Running]
    
    Running --> PollEvents[Poll for Events]
    PollEvents --> ProcessEvents[Process Events]
    ProcessEvents --> CheckShutdown{Shutdown Signal?}
    
    CheckShutdown -->|No| Sleep[Sleep Interval]
    CheckShutdown -->|Yes| Cleanup[Cleanup Resources]
    
    Sleep --> PollEvents
    
    Cleanup --> StopStreaming[Stop Streaming]
    StopStreaming --> SaveState[Save State]
    SaveState --> Shutdown[Shutdown Complete]
    
    AuthError --> End[End]
    Shutdown --> End
    
    style Start fill:#e8f5e9
    style Running fill:#e3f2fd
    style Shutdown fill:#e8f5e9
    style End fill:#e8f5e9
    style AuthError fill:#ffebee
```

## See Also

- [Architecture Diagrams](./architecture.md)
- [Sequence Diagrams](./sequences.md)
- [API Reference](../api/)

