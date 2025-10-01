# Social Operations Examples

Practical examples for common social networking operations on AT Protocol.

## Creating Posts

### Simple Text Post

```typescript
import { createPost } from './tools/create-post';

const result = await createPost({
  text: "Hello from AT Protocol! 🚀"
});

console.log(`Post created: ${result.uri}`);
```

### Post with Multiple Languages

```typescript
const result = await createPost({
  text: "Hello world! Bonjour le monde!",
  langs: ["en", "fr"]
});
```

### Post with Images

```typescript
import { readFileSync } from 'fs';

const imageData = readFileSync('./photo.jpg');
const imageBlob = new Blob([imageData], { type: 'image/jpeg' });

const result = await createPost({
  text: "Check out this amazing photo!",
  embed: {
    images: [
      {
        alt: "A beautiful sunset over the ocean",
        image: imageBlob
      }
    ]
  }
});
```

### Post with Link Preview

```typescript
const result = await createPost({
  text: "Interesting article about AT Protocol",
  embed: {
    external: {
      uri: "https://atproto.com/guides/overview",
      title: "AT Protocol Overview",
      description: "Learn about the AT Protocol architecture and features"
    }
  }
});
```

## Threading and Replies

### Reply to a Post

```typescript
import { replyToPost } from './tools/reply-to-post';

// Get the post you want to reply to
const originalPost = await getPost(postUri);

// Reply to it
const reply = await replyToPost({
  text: "Great point! I totally agree.",
  root: originalPost.uri,
  parent: originalPost.uri
});
```

### Reply to a Reply (Nested Thread)

```typescript
// Reply to a reply in a thread
const nestedReply = await replyToPost({
  text: "Thanks for the clarification!",
  root: threadRootUri,      // First post in thread
  parent: previousReplyUri  // Immediate parent
});
```

### View Full Thread

```typescript
import { getThread } from './tools/get-thread';

const thread = await getThread({
  uri: postUri,
  depth: 6  // Get up to 6 levels of replies
});

// Navigate the thread
console.log('Root post:', thread.thread.post.record.text);
console.log('Replies:', thread.thread.replies?.length);
```

## Engagement

### Like a Post

```typescript
import { likePost } from './tools/like-post';

const result = await likePost({
  uri: post.uri,
  cid: post.cid
});

console.log(`Like URI: ${result.uri}`);
// Store this URI to unlike later
```

### Unlike a Post

```typescript
import { unlikePost } from './tools/unlike-post';

await unlikePost({
  likeUri: storedLikeUri
});
```

### Repost Content

```typescript
import { repost } from './tools/repost';

// Simple repost
const result = await repost({
  uri: post.uri,
  cid: post.cid
});

// Quote post (repost with commentary)
const quotePost = await repost({
  uri: post.uri,
  cid: post.cid,
  text: "This is exactly what I was thinking! Great insights."
});
```

### Remove a Repost

```typescript
import { unrepost } from './tools/unrepost';

await unrepost({
  repostUri: storedRepostUri
});
```

## Following Users

### Follow a User

```typescript
import { followUser } from './tools/follow-user';

// Follow by handle
const result = await followUser({
  actor: "alice.bsky.social"
});

console.log(`Follow URI: ${result.uri}`);
// Store this URI to unfollow later
```

### Unfollow a User

```typescript
import { unfollowUser } from './tools/unfollow-user';

await unfollowUser({
  followUri: storedFollowUri
});
```

### Get User Profile

```typescript
import { getUserProfile } from './tools/get-user-profile';

const profile = await getUserProfile({
  actor: "alice.bsky.social"
});

console.log(`Display Name: ${profile.profile.displayName}`);
console.log(`Followers: ${profile.profile.followersCount}`);
console.log(`Following: ${profile.profile.followsCount}`);
console.log(`Posts: ${profile.profile.postsCount}`);

// Check relationship (when authenticated)
if (profile.profile.viewer) {
  console.log(`Following: ${!!profile.profile.viewer.following}`);
  console.log(`Followed by: ${!!profile.profile.viewer.followedBy}`);
}
```

## Building a Social Bot

### Auto-Reply Bot

```typescript
import { getNotifications } from './tools/get-notifications';
import { replyToPost } from './tools/reply-to-post';

async function autoReplyBot() {
  // Get recent notifications
  const notifications = await getNotifications({ limit: 20 });
  
  // Find mentions
  const mentions = notifications.notifications.filter(
    n => n.reason === 'mention' && !n.isRead
  );
  
  for (const mention of mentions) {
    // Reply to mentions
    await replyToPost({
      text: "Thanks for mentioning me! 🤖",
      root: mention.reasonSubject!,
      parent: mention.reasonSubject!
    });
  }
}

// Run every minute
setInterval(autoReplyBot, 60000);
```

### Engagement Bot

```typescript
import { searchPosts } from './tools/search-posts';
import { likePost } from './tools/like-post';

async function engagementBot() {
  // Search for posts about a topic
  const results = await searchPosts({
    q: "atproto",
    sort: "latest",
    limit: 10
  });
  
  for (const post of results.posts) {
    // Like relevant posts
    if (!post.viewer?.like) {
      await likePost({
        uri: post.uri,
        cid: post.cid
      });
      
      console.log(`Liked post: ${post.record.text}`);
      
      // Wait to avoid rate limits
      await sleep(5000);
    }
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

## Content Discovery

### Search for Posts

```typescript
import { searchPosts } from './tools/search-posts';

// Search by keyword
const results = await searchPosts({
  q: "machine learning",
  sort: "top",
  lang: "en",
  limit: 50
});

console.log(`Found ${results.posts.length} posts`);

// Search by author
const authorPosts = await searchPosts({
  q: "typescript",
  author: "alice.bsky.social"
});

// Search with date range
const recentPosts = await searchPosts({
  q: "atproto",
  since: "2024-01-01T00:00:00Z",
  until: "2024-01-31T23:59:59Z"
});
```

### Get Timeline

```typescript
import { getTimeline } from './tools/get-timeline';

const timeline = await getTimeline({
  limit: 50
});

for (const item of timeline.feed) {
  const post = item.post;
  console.log(`${post.author.displayName}: ${post.record.text}`);
  console.log(`Likes: ${post.likeCount}, Reposts: ${post.repostCount}`);
}

// Paginate through timeline
if (timeline.cursor) {
  const nextPage = await getTimeline({
    limit: 50,
    cursor: timeline.cursor
  });
}
```

### Explore Custom Feeds

```typescript
import { getCustomFeed } from './tools/get-custom-feed';

const feed = await getCustomFeed({
  feed: "at://did:plc:abc123/app.bsky.feed.generator/tech-feed",
  limit: 30
});

console.log(`Feed has ${feed.feed.length} posts`);
```

## Social Graph Analysis

### Get Followers

```typescript
import { getFollowers } from './tools/get-followers';

const followers = await getFollowers({
  actor: "alice.bsky.social",
  limit: 100
});

console.log(`${followers.subject.displayName} has ${followers.followers.length} followers`);

// Analyze followers
const verifiedFollowers = followers.followers.filter(
  f => f.displayName && f.avatar
);
console.log(`Verified profiles: ${verifiedFollowers.length}`);
```

### Get Following

```typescript
import { getFollows } from './tools/get-follows';

const follows = await getFollows({
  actor: "alice.bsky.social",
  limit: 100
});

console.log(`Following ${follows.follows.length} users`);
```

### Find Mutual Follows

```typescript
async function findMutualFollows(userHandle: string) {
  const [followers, following] = await Promise.all([
    getFollowers({ actor: userHandle, limit: 100 }),
    getFollows({ actor: userHandle, limit: 100 })
  ]);
  
  const followerDids = new Set(followers.followers.map(f => f.did));
  const mutuals = following.follows.filter(f => followerDids.has(f.did));
  
  console.log(`Found ${mutuals.length} mutual follows`);
  return mutuals;
}
```

## Best Practices

### Rate Limiting

```typescript
class RateLimiter {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  
  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      this.process();
    });
  }
  
  private async process() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      const fn = this.queue.shift()!;
      await fn();
      await sleep(1000); // 1 second between requests
    }
    
    this.processing = false;
  }
}

const limiter = new RateLimiter();

// Use rate limiter
await limiter.add(() => createPost({ text: "Post 1" }));
await limiter.add(() => createPost({ text: "Post 2" }));
```

### Error Handling

```typescript
async function safeCreatePost(text: string) {
  try {
    return await createPost({ text });
  } catch (error) {
    if (error.code === 'RATE_LIMIT_EXCEEDED') {
      console.log(`Rate limited, waiting ${error.retryAfter}s`);
      await sleep(error.retryAfter * 1000);
      return await createPost({ text });
    }
    throw error;
  }
}
```

## See Also

- [Content Management Examples](./content-management.md)
- [Real-time Data Examples](./real-time-data.md)
- [Custom Integration Examples](./custom-integration.md)
- [API Reference](../api/)

