# Custom Integration Examples

Practical examples for building custom integrations, bots, and applications with AT Protocol.

## Building a Social Media Bot

### Complete Bot Framework

```typescript
import { EventEmitter } from 'events';

class AtProtoBot extends EventEmitter {
  private running = false;
  private intervals: NodeJS.Timeout[] = [];
  
  constructor(
    private config: {
      name: string;
      pollInterval?: number;
      keywords?: string[];
    }
  ) {
    super();
  }
  
  async start() {
    this.running = true;
    console.log(`${this.config.name} started`);
    
    // Start streaming
    await startStreaming({
      subscriptionId: this.config.name,
      collections: ['app.bsky.feed.post']
    });
    
    // Poll for events
    const interval = setInterval(
      () => this.poll(),
      this.config.pollInterval || 10000
    );
    this.intervals.push(interval);
  }
  
  async stop() {
    this.running = false;
    this.intervals.forEach(i => clearInterval(i));
    this.intervals = [];
    
    await stopStreaming({
      subscriptionId: this.config.name
    });
    
    console.log(`${this.config.name} stopped`);
  }
  
  private async poll() {
    if (!this.running) return;
    
    try {
      const events = await getRecentEvents({
        limit: 50,
        collection: 'app.bsky.feed.post'
      });
      
      for (const event of events.events) {
        if (event.operation === 'create' && event.record) {
          this.emit('post', event);
          
          // Check for keywords
          if (this.config.keywords) {
            const text = event.record.text.toLowerCase();
            for (const keyword of this.config.keywords) {
              if (text.includes(keyword.toLowerCase())) {
                this.emit('keyword', keyword, event);
              }
            }
          }
        }
      }
    } catch (error) {
      this.emit('error', error);
    }
  }
}

// Usage
const bot = new AtProtoBot({
  name: 'my-bot',
  pollInterval: 10000,
  keywords: ['atproto', 'bluesky']
});

bot.on('post', (event) => {
  console.log('New post:', event.record.text);
});

bot.on('keyword', async (keyword, event) => {
  console.log(`Keyword "${keyword}" found!`);
  // Auto-like posts with keywords
  const postUri = `at://${event.repo}/${event.collection}/${event.rkey}`;
  await likePost({ uri: postUri, cid: event.cid });
});

bot.on('error', (error) => {
  console.error('Bot error:', error);
});

await bot.start();
```

## Analytics Dashboard

### Real-time Analytics Engine

```typescript
interface AnalyticsData {
  totalPosts: number;
  totalLikes: number;
  totalReposts: number;
  topAuthors: Map<string, number>;
  topHashtags: Map<string, number>;
  postsPerMinute: number;
}

class AnalyticsEngine {
  private data: AnalyticsData = {
    totalPosts: 0,
    totalLikes: 0,
    totalReposts: 0,
    topAuthors: new Map(),
    topHashtags: new Map(),
    postsPerMinute: 0
  };
  
  private recentPosts: Array<{ timestamp: Date }> = [];
  
  async update() {
    const events = await getRecentEvents({ limit: 100 });
    
    for (const event of events.events) {
      if (event.operation !== 'create') continue;
      
      switch (event.collection) {
        case 'app.bsky.feed.post':
          this.data.totalPosts++;
          this.recentPosts.push({ timestamp: new Date(event.time) });
          
          // Track author
          const count = this.data.topAuthors.get(event.repo) || 0;
          this.data.topAuthors.set(event.repo, count + 1);
          
          // Extract hashtags
          if (event.record?.text) {
            const hashtags = event.record.text.match(/#\w+/g) || [];
            for (const tag of hashtags) {
              const tagCount = this.data.topHashtags.get(tag) || 0;
              this.data.topHashtags.set(tag, tagCount + 1);
            }
          }
          break;
          
        case 'app.bsky.feed.like':
          this.data.totalLikes++;
          break;
          
        case 'app.bsky.feed.repost':
          this.data.totalReposts++;
          break;
      }
    }
    
    // Calculate posts per minute
    const oneMinuteAgo = new Date(Date.now() - 60000);
    this.recentPosts = this.recentPosts.filter(p => p.timestamp > oneMinuteAgo);
    this.data.postsPerMinute = this.recentPosts.length;
  }
  
  getData(): AnalyticsData {
    return this.data;
  }
  
  getTopAuthors(limit: number = 10) {
    return Array.from(this.data.topAuthors.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);
  }
  
  getTopHashtags(limit: number = 10) {
    return Array.from(this.data.topHashtags.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);
  }
}

// Usage
const analytics = new AnalyticsEngine();

setInterval(async () => {
  await analytics.update();
  
  const data = analytics.getData();
  console.log('\n=== Analytics Dashboard ===');
  console.log(`Total Posts: ${data.totalPosts}`);
  console.log(`Total Likes: ${data.totalLikes}`);
  console.log(`Total Reposts: ${data.totalReposts}`);
  console.log(`Posts/min: ${data.postsPerMinute}`);
  
  console.log('\nTop Hashtags:');
  analytics.getTopHashtags(5).forEach(([tag, count]) => {
    console.log(`  ${tag}: ${count}`);
  });
}, 30000);
```

## Content Moderation System

### Automated Moderation

```typescript
interface ModerationRule {
  name: string;
  check: (post: any) => boolean;
  action: (post: any, repo: string) => Promise<void>;
}

class ModerationSystem {
  private rules: ModerationRule[] = [];
  private flaggedPosts: Set<string> = new Set();
  
  addRule(rule: ModerationRule) {
    this.rules.push(rule);
  }
  
  async moderate() {
    const events = await getRecentEvents({
      limit: 50,
      collection: 'app.bsky.feed.post'
    });
    
    for (const event of events.events) {
      if (event.operation !== 'create' || !event.record) continue;
      
      const postUri = `at://${event.repo}/${event.collection}/${event.rkey}`;
      
      if (this.flaggedPosts.has(postUri)) continue;
      
      for (const rule of this.rules) {
        if (rule.check(event.record)) {
          console.log(`Rule "${rule.name}" triggered for post: ${postUri}`);
          await rule.action(event.record, event.repo);
          this.flaggedPosts.add(postUri);
          break;
        }
      }
    }
  }
}

// Usage
const moderator = new ModerationSystem();

// Rule: Detect spam
moderator.addRule({
  name: 'spam-detection',
  check: (post) => {
    const spamKeywords = ['buy now', 'click here', 'limited offer'];
    const text = post.text.toLowerCase();
    return spamKeywords.some(kw => text.includes(kw));
  },
  action: async (post, repo) => {
    console.log('Spam detected, muting user');
    await muteUser({ actor: repo });
  }
});

// Rule: Detect excessive caps
moderator.addRule({
  name: 'excessive-caps',
  check: (post) => {
    const text = post.text;
    const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
    return capsRatio > 0.7 && text.length > 20;
  },
  action: async (post, repo) => {
    console.log('Excessive caps detected');
    // Could report or flag for review
  }
});

setInterval(() => moderator.moderate(), 10000);
```

## Multi-Account Manager

### Account Manager

```typescript
interface Account {
  identifier: string;
  password: string;
  session?: any;
}

class MultiAccountManager {
  private accounts: Map<string, Account> = new Map();
  private currentAccount?: string;
  
  addAccount(identifier: string, password: string) {
    this.accounts.set(identifier, { identifier, password });
  }
  
  async switchAccount(identifier: string) {
    const account = this.accounts.get(identifier);
    if (!account) throw new Error('Account not found');
    
    // Authenticate with this account
    // (Implementation depends on your auth setup)
    this.currentAccount = identifier;
    console.log(`Switched to account: ${identifier}`);
  }
  
  async postToAll(text: string) {
    const results = [];
    
    for (const [identifier, account] of this.accounts) {
      await this.switchAccount(identifier);
      
      try {
        const result = await createPost({ text });
        results.push({ identifier, success: true, uri: result.uri });
      } catch (error) {
        results.push({ identifier, success: false, error });
      }
      
      await sleep(2000); // Rate limiting
    }
    
    return results;
  }
  
  getCurrentAccount(): string | undefined {
    return this.currentAccount;
  }
}

// Usage
const manager = new MultiAccountManager();
manager.addAccount('account1.bsky.social', 'password1');
manager.addAccount('account2.bsky.social', 'password2');

// Post to all accounts
const results = await manager.postToAll('Hello from all accounts!');
console.log(results);
```

## RSS Feed Integration

### RSS to AT Protocol Bridge

```typescript
import Parser from 'rss-parser';

class RssBridge {
  private parser = new Parser();
  private seenItems = new Set<string>();
  
  constructor(private feedUrl: string) {}
  
  async poll() {
    const feed = await this.parser.parseURL(this.feedUrl);
    
    for (const item of feed.items) {
      if (this.seenItems.has(item.guid || item.link!)) continue;
      
      await this.postItem(item);
      this.seenItems.add(item.guid || item.link!);
      
      await sleep(5000); // Rate limiting
    }
  }
  
  private async postItem(item: any) {
    const text = this.formatPost(item);
    
    try {
      const result = await createPost({
        text,
        embed: item.link ? {
          external: {
            uri: item.link,
            title: item.title || 'Article',
            description: this.stripHtml(item.contentSnippet || item.description || '')
          }
        } : undefined
      });
      
      console.log(`Posted RSS item: ${item.title}`);
    } catch (error) {
      console.error('Failed to post RSS item:', error);
    }
  }
  
  private formatPost(item: any): string {
    const title = item.title || 'New Article';
    const maxLength = 250;
    
    if (title.length > maxLength) {
      return title.substring(0, maxLength - 3) + '...';
    }
    
    return title;
  }
  
  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').substring(0, 300);
  }
}

// Usage
const bridge = new RssBridge('https://example.com/feed.xml');

// Poll every 15 minutes
setInterval(() => bridge.poll(), 15 * 60 * 1000);
```

## Webhook Integration

### Webhook Server

```typescript
import express from 'express';

class WebhookServer {
  private app = express();
  
  constructor(private port: number = 3000) {
    this.app.use(express.json());
    this.setupRoutes();
  }
  
  private setupRoutes() {
    // Receive webhook and post to AT Protocol
    this.app.post('/webhook/post', async (req, res) => {
      try {
        const { text, embed } = req.body;
        
        const result = await createPost({ text, embed });
        
        res.json({
          success: true,
          uri: result.uri
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
    
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok' });
    });
  }
  
  start() {
    this.app.listen(this.port, () => {
      console.log(`Webhook server listening on port ${this.port}`);
    });
  }
}

// Usage
const server = new WebhookServer(3000);
server.start();
```

## Backup and Archive System

### Account Backup

```typescript
import { writeFileSync } from 'fs';

class AccountBackup {
  async backupPosts(authorHandle: string) {
    const allPosts = [];
    let cursor: string | undefined;
    
    do {
      const results = await searchPosts({
        q: '',
        author: authorHandle,
        limit: 100,
        cursor
      });
      
      allPosts.push(...results.posts);
      cursor = results.cursor;
      
      console.log(`Backed up ${allPosts.length} posts...`);
    } while (cursor);
    
    // Save to file
    const backup = {
      author: authorHandle,
      timestamp: new Date().toISOString(),
      postCount: allPosts.length,
      posts: allPosts
    };
    
    writeFileSync(
      `backup-${authorHandle}-${Date.now()}.json`,
      JSON.stringify(backup, null, 2)
    );
    
    console.log(`Backup complete: ${allPosts.length} posts`);
  }
  
  async backupProfile(authorHandle: string) {
    const profile = await getUserProfile({ actor: authorHandle });
    
    writeFileSync(
      `profile-${authorHandle}-${Date.now()}.json`,
      JSON.stringify(profile, null, 2)
    );
    
    console.log('Profile backup complete');
  }
}

// Usage
const backup = new AccountBackup();
await backup.backupPosts('alice.bsky.social');
await backup.backupProfile('alice.bsky.social');
```

## Cross-Platform Posting

### Multi-Platform Publisher

```typescript
interface Platform {
  name: string;
  post: (text: string) => Promise<void>;
}

class MultiPlatformPublisher {
  private platforms: Platform[] = [];
  
  addPlatform(platform: Platform) {
    this.platforms.push(platform);
  }
  
  async publish(text: string) {
    const results = await Promise.allSettled(
      this.platforms.map(p => p.post(text))
    );
    
    results.forEach((result, i) => {
      const platform = this.platforms[i];
      if (result.status === 'fulfilled') {
        console.log(`✓ Posted to ${platform.name}`);
      } else {
        console.error(`✗ Failed to post to ${platform.name}:`, result.reason);
      }
    });
  }
}

// Usage
const publisher = new MultiPlatformPublisher();

// Add AT Protocol
publisher.addPlatform({
  name: 'AT Protocol',
  post: async (text) => {
    await createPost({ text });
  }
});

// Add other platforms...
// publisher.addPlatform({ name: 'Twitter', post: ... });
// publisher.addPlatform({ name: 'Mastodon', post: ... });

await publisher.publish('Hello from all platforms!');
```

## Best Practices

### Configuration Management

```typescript
interface BotConfig {
  name: string;
  pollInterval: number;
  keywords: string[];
  rateLimits: {
    postsPerHour: number;
    likesPerHour: number;
  };
}

function loadConfig(): BotConfig {
  return {
    name: process.env.BOT_NAME || 'my-bot',
    pollInterval: parseInt(process.env.POLL_INTERVAL || '10000'),
    keywords: (process.env.KEYWORDS || '').split(','),
    rateLimits: {
      postsPerHour: parseInt(process.env.POSTS_PER_HOUR || '10'),
      likesPerHour: parseInt(process.env.LIKES_PER_HOUR || '100')
    }
  };
}
```

### Graceful Shutdown

```typescript
class GracefulBot {
  private running = false;
  
  async start() {
    this.running = true;
    
    // Handle shutdown signals
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
    
    await this.run();
  }
  
  private async shutdown() {
    console.log('Shutting down gracefully...');
    this.running = false;
    
    // Cleanup
    await stopStreaming({ subscriptionId: 'my-bot' });
    
    process.exit(0);
  }
  
  private async run() {
    while (this.running) {
      // Bot logic
      await sleep(10000);
    }
  }
}
```

## See Also

- [Social Operations Examples](./social-operations.md)
- [Content Management Examples](./content-management.md)
- [Real-time Data Examples](./real-time-data.md)
- [API Reference](../api/)

