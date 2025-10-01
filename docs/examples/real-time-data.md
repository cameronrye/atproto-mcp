# Real-time Data Examples

Practical examples for working with real-time data streams and the AT Protocol firehose.

## Basic Streaming

### Start Streaming All Events

```typescript
import { startStreaming, getRecentEvents } from './tools/streaming';

// Start the firehose
await startStreaming({
  subscriptionId: 'my-stream'
});

console.log('Streaming started');

// Poll for events
setInterval(async () => {
  const events = await getRecentEvents({ limit: 20 });
  console.log(`Received ${events.events.length} events`);
}, 5000);
```

### Stream Specific Collections

```typescript
// Only stream posts
await startStreaming({
  subscriptionId: 'posts-only',
  collections: ['app.bsky.feed.post']
});

// Stream social interactions
await startStreaming({
  subscriptionId: 'social',
  collections: [
    'app.bsky.feed.like',
    'app.bsky.feed.repost',
    'app.bsky.graph.follow'
  ]
});
```

### Stop Streaming

```typescript
import { stopStreaming } from './tools/streaming';

await stopStreaming({
  subscriptionId: 'my-stream'
});

console.log('Streaming stopped');
```

## Event Processing

### Process New Posts

```typescript
async function processNewPosts() {
  const events = await getRecentEvents({
    limit: 50,
    collection: 'app.bsky.feed.post'
  });
  
  for (const event of events.events) {
    if (event.operation === 'create' && event.record) {
      const post = event.record;
      console.log(`New post from ${event.repo}:`);
      console.log(`  ${post.text}`);
      
      // Process the post
      await handleNewPost(post, event.repo);
    }
  }
}

async function handleNewPost(post: any, authorDid: string) {
  // Check for keywords
  if (post.text.toLowerCase().includes('atproto')) {
    console.log('Found post about AT Protocol!');
  }
  
  // Check for mentions
  if (post.text.includes('@mybot')) {
    console.log('Bot was mentioned!');
    // Could auto-reply here
  }
}

// Run every 5 seconds
setInterval(processNewPosts, 5000);
```

### Monitor Specific User

```typescript
const TARGET_DID = 'did:plc:abc123xyz789';

async function monitorUser() {
  const events = await getRecentEvents({ limit: 100 });
  
  const userEvents = events.events.filter(e => e.repo === TARGET_DID);
  
  for (const event of userEvents) {
    console.log(`${TARGET_DID} performed ${event.operation} on ${event.collection}`);
    
    if (event.operation === 'create' && event.collection === 'app.bsky.feed.post') {
      console.log(`New post: ${event.record?.text}`);
    }
  }
}
```

### Track Hashtags

```typescript
async function trackHashtag(hashtag: string) {
  const events = await getRecentEvents({
    limit: 100,
    collection: 'app.bsky.feed.post'
  });
  
  for (const event of events.events) {
    if (event.operation === 'create' && event.record) {
      const text = event.record.text.toLowerCase();
      if (text.includes(`#${hashtag.toLowerCase()}`)) {
        console.log(`Found #${hashtag}:`);
        console.log(`  ${event.record.text}`);
        console.log(`  By: ${event.repo}`);
      }
    }
  }
}

// Track multiple hashtags
setInterval(async () => {
  await trackHashtag('atproto');
  await trackHashtag('bluesky');
}, 10000);
```

## Real-time Analytics

### Count Events by Type

```typescript
async function analyzeEventTypes() {
  const events = await getRecentEvents({ limit: 100 });
  
  const counts: Record<string, number> = {};
  
  for (const event of events.events) {
    const key = `${event.collection}:${event.operation}`;
    counts[key] = (counts[key] || 0) + 1;
  }
  
  console.log('Event distribution:');
  Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
}

// Run every minute
setInterval(analyzeEventTypes, 60000);
```

### Track Engagement Rates

```typescript
interface EngagementStats {
  posts: number;
  likes: number;
  reposts: number;
  replies: number;
}

async function trackEngagement(): Promise<EngagementStats> {
  const events = await getRecentEvents({ limit: 100 });
  
  const stats: EngagementStats = {
    posts: 0,
    likes: 0,
    reposts: 0,
    replies: 0
  };
  
  for (const event of events.events) {
    if (event.operation !== 'create') continue;
    
    switch (event.collection) {
      case 'app.bsky.feed.post':
        if (event.record?.reply) {
          stats.replies++;
        } else {
          stats.posts++;
        }
        break;
      case 'app.bsky.feed.like':
        stats.likes++;
        break;
      case 'app.bsky.feed.repost':
        stats.reposts++;
        break;
    }
  }
  
  return stats;
}

// Display stats every 30 seconds
setInterval(async () => {
  const stats = await trackEngagement();
  console.log('Engagement (last 100 events):');
  console.log(`  Posts: ${stats.posts}`);
  console.log(`  Likes: ${stats.likes}`);
  console.log(`  Reposts: ${stats.reposts}`);
  console.log(`  Replies: ${stats.replies}`);
}, 30000);
```

## Real-time Bots

### Auto-Like Bot

```typescript
import { likePost } from './tools/like-post';

const KEYWORDS = ['atproto', 'bluesky', 'decentralized'];

async function autoLikeBot() {
  const events = await getRecentEvents({
    limit: 50,
    collection: 'app.bsky.feed.post'
  });
  
  for (const event of events.events) {
    if (event.operation !== 'create' || !event.record) continue;
    
    const text = event.record.text.toLowerCase();
    const hasKeyword = KEYWORDS.some(kw => text.includes(kw));
    
    if (hasKeyword) {
      try {
        // Construct post URI
        const postUri = `at://${event.repo}/${event.collection}/${event.rkey}`;
        
        await likePost({
          uri: postUri as any,
          cid: event.cid as any
        });
        
        console.log(`Liked post: ${event.record.text.substring(0, 50)}...`);
        
        // Rate limiting
        await sleep(5000);
      } catch (error) {
        console.error('Failed to like post:', error);
      }
    }
  }
}

// Run every 10 seconds
setInterval(autoLikeBot, 10000);
```

### Mention Response Bot

```typescript
import { replyToPost } from './tools/reply-to-post';

const BOT_DID = 'did:plc:mybot123';

async function mentionResponseBot() {
  const events = await getRecentEvents({
    limit: 50,
    collection: 'app.bsky.feed.post'
  });
  
  for (const event of events.events) {
    if (event.operation !== 'create' || !event.record) continue;
    
    // Check if bot is mentioned
    const facets = event.record.facets || [];
    const mentioned = facets.some((facet: any) =>
      facet.features?.some((f: any) =>
        f.$type === 'app.bsky.richtext.facet#mention' && f.did === BOT_DID
      )
    );
    
    if (mentioned) {
      const postUri = `at://${event.repo}/${event.collection}/${event.rkey}`;
      
      try {
        await replyToPost({
          text: "Thanks for mentioning me! 🤖",
          root: postUri as any,
          parent: postUri as any
        });
        
        console.log('Replied to mention');
        await sleep(5000);
      } catch (error) {
        console.error('Failed to reply:', error);
      }
    }
  }
}

setInterval(mentionResponseBot, 10000);
```

## Monitoring and Alerts

### Stream Health Monitor

```typescript
import { getStreamingStatus } from './tools/streaming';

async function monitorStreamHealth() {
  const status = await getStreamingStatus();
  
  if (!status.firehoseStatus.connected) {
    console.error('⚠️  Firehose disconnected!');
    // Send alert
    await sendAlert('Firehose connection lost');
    
    // Attempt reconnection
    await startStreaming({ subscriptionId: 'my-stream' });
  } else {
    console.log('✓ Firehose connected');
    console.log(`  Last seq: ${status.firehoseStatus.lastSeq}`);
    console.log(`  Subscriptions: ${status.firehoseStatus.subscriptionCount}`);
    console.log(`  Buffer size: ${status.eventBufferSize}`);
  }
}

// Check every 30 seconds
setInterval(monitorStreamHealth, 30000);
```

### Keyword Alert System

```typescript
interface Alert {
  keyword: string;
  post: any;
  author: string;
  timestamp: string;
}

class KeywordAlertSystem {
  private keywords: Set<string>;
  private alerts: Alert[] = [];
  
  constructor(keywords: string[]) {
    this.keywords = new Set(keywords.map(k => k.toLowerCase()));
  }
  
  async check() {
    const events = await getRecentEvents({
      limit: 50,
      collection: 'app.bsky.feed.post'
    });
    
    for (const event of events.events) {
      if (event.operation !== 'create' || !event.record) continue;
      
      const text = event.record.text.toLowerCase();
      
      for (const keyword of this.keywords) {
        if (text.includes(keyword)) {
          this.alerts.push({
            keyword,
            post: event.record,
            author: event.repo,
            timestamp: event.time
          });
          
          console.log(`🔔 Alert: "${keyword}" mentioned`);
          console.log(`   ${event.record.text}`);
        }
      }
    }
  }
  
  getAlerts(): Alert[] {
    return this.alerts;
  }
  
  clearAlerts() {
    this.alerts = [];
  }
}

// Usage
const alertSystem = new KeywordAlertSystem([
  'urgent',
  'breaking',
  'announcement'
]);

setInterval(() => alertSystem.check(), 10000);
```

## Data Collection

### Event Logger

```typescript
import { writeFileSync, appendFileSync } from 'fs';

class EventLogger {
  private logFile: string;
  
  constructor(logFile: string) {
    this.logFile = logFile;
    // Initialize log file
    writeFileSync(logFile, 'timestamp,type,collection,operation,repo\n');
  }
  
  async log() {
    const events = await getRecentEvents({ limit: 100 });
    
    for (const event of events.events) {
      const line = [
        event.time,
        event.type,
        event.collection || '',
        event.operation || '',
        event.repo
      ].join(',') + '\n';
      
      appendFileSync(this.logFile, line);
    }
  }
}

// Usage
const logger = new EventLogger('./events.csv');
setInterval(() => logger.log(), 60000); // Log every minute
```

### Time Series Data

```typescript
interface TimeSeriesPoint {
  timestamp: Date;
  posts: number;
  likes: number;
  reposts: number;
}

class TimeSeriesCollector {
  private data: TimeSeriesPoint[] = [];
  
  async collect() {
    const events = await getRecentEvents({ limit: 100 });
    
    const point: TimeSeriesPoint = {
      timestamp: new Date(),
      posts: 0,
      likes: 0,
      reposts: 0
    };
    
    for (const event of events.events) {
      if (event.operation !== 'create') continue;
      
      switch (event.collection) {
        case 'app.bsky.feed.post':
          point.posts++;
          break;
        case 'app.bsky.feed.like':
          point.likes++;
          break;
        case 'app.bsky.feed.repost':
          point.reposts++;
          break;
      }
    }
    
    this.data.push(point);
    
    // Keep last 24 hours
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    this.data = this.data.filter(p => p.timestamp > cutoff);
  }
  
  getData(): TimeSeriesPoint[] {
    return this.data;
  }
  
  getAverage(): Omit<TimeSeriesPoint, 'timestamp'> {
    const sum = this.data.reduce(
      (acc, p) => ({
        posts: acc.posts + p.posts,
        likes: acc.likes + p.likes,
        reposts: acc.reposts + p.reposts
      }),
      { posts: 0, likes: 0, reposts: 0 }
    );
    
    const count = this.data.length;
    return {
      posts: sum.posts / count,
      likes: sum.likes / count,
      reposts: sum.reposts / count
    };
  }
}

// Usage
const collector = new TimeSeriesCollector();
setInterval(() => collector.collect(), 60000); // Collect every minute
```

## Best Practices

### Error Handling

```typescript
async function robustEventProcessing() {
  try {
    const events = await getRecentEvents({ limit: 50 });
    
    for (const event of events.events) {
      try {
        await processEvent(event);
      } catch (error) {
        console.error(`Failed to process event ${event.seq}:`, error);
        // Continue processing other events
      }
    }
  } catch (error) {
    console.error('Failed to fetch events:', error);
    // Retry logic here
  }
}
```

### Rate Limiting

```typescript
class RateLimitedProcessor {
  private lastProcessTime = 0;
  private minInterval = 1000; // 1 second
  
  async process() {
    const now = Date.now();
    const elapsed = now - this.lastProcessTime;
    
    if (elapsed < this.minInterval) {
      await sleep(this.minInterval - elapsed);
    }
    
    await this.doProcess();
    this.lastProcessTime = Date.now();
  }
  
  private async doProcess() {
    // Your processing logic
  }
}
```

## See Also

- [Social Operations Examples](./social-operations.md)
- [Content Management Examples](./content-management.md)
- [Custom Integration Examples](./custom-integration.md)
- [Streaming Tools API](../api/tools/start-streaming.md)

