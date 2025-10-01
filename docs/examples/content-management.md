# Content Management Examples

Practical examples for managing content, media, and profiles on AT Protocol.

## Profile Management

### Update Profile Information

```typescript
import { updateProfile } from './tools/update-profile';

const result = await updateProfile({
  displayName: "Alice Smith",
  description: "Software engineer and coffee enthusiast ☕\nBuilding cool things with AT Protocol"
});

console.log('Profile updated successfully');
```

### Update Profile Avatar

```typescript
import { readFileSync } from 'fs';

const avatarData = readFileSync('./avatar.jpg');
const avatarBlob = new Blob([avatarData], { type: 'image/jpeg' });

await updateProfile({
  avatar: avatarBlob
});
```

### Update Profile Banner

```typescript
const bannerData = readFileSync('./banner.jpg');
const bannerBlob = new Blob([bannerData], { type: 'image/jpeg' });

await updateProfile({
  banner: bannerBlob
});
```

### Complete Profile Update

```typescript
const avatarData = readFileSync('./avatar.jpg');
const bannerData = readFileSync('./banner.jpg');

await updateProfile({
  displayName: "Alice Smith",
  description: "Full-stack developer | Open source contributor | Coffee addict",
  avatar: new Blob([avatarData], { type: 'image/jpeg' }),
  banner: new Blob([bannerData], { type: 'image/jpeg' })
});
```

## Media Upload

### Upload Single Image

```typescript
import { uploadImage } from './tools/upload-image';
import { readFileSync } from 'fs';

const imageData = readFileSync('./photo.jpg');
const imageBlob = new Blob([imageData], { type: 'image/jpeg' });

const result = await uploadImage({
  image: imageBlob,
  alt: "A beautiful sunset over the ocean"
});

console.log(`Image uploaded: ${result.blob.ref.$link}`);
```

### Upload Multiple Images

```typescript
async function uploadImages(imagePaths: string[]) {
  const uploads = await Promise.all(
    imagePaths.map(async (path, index) => {
      const data = readFileSync(path);
      const blob = new Blob([data], { type: 'image/jpeg' });
      
      return await uploadImage({
        image: blob,
        alt: `Image ${index + 1}`
      });
    })
  );
  
  return uploads.map(u => ({
    alt: u.alt!,
    image: u.blob
  }));
}

const images = await uploadImages([
  './photo1.jpg',
  './photo2.jpg',
  './photo3.jpg'
]);
```

### Upload Video

```typescript
import { uploadVideo } from './tools/upload-video';

const videoData = readFileSync('./video.mp4');
const videoBlob = new Blob([videoData], { type: 'video/mp4' });

const result = await uploadVideo({
  video: videoBlob,
  alt: "Tutorial on using AT Protocol"
});
```

### Upload Video with Captions

```typescript
const videoData = readFileSync('./video.mp4');
const captionsData = readFileSync('./captions.vtt');

const result = await uploadVideo({
  video: new Blob([videoData], { type: 'video/mp4' }),
  alt: "Conference talk with captions",
  captions: [
    {
      lang: "en",
      file: new Blob([captionsData], { type: 'text/vtt' })
    }
  ]
});
```

## Rich Text Posts

### Post with Mentions

```typescript
import { createRichTextPost } from './tools/create-rich-text-post';

// First, resolve the handle to a DID
const profile = await getUserProfile({ actor: "alice.bsky.social" });

const result = await createRichTextPost({
  text: "Great work @alice.bsky.social!",
  facets: [
    {
      index: {
        byteStart: 11,
        byteEnd: 30
      },
      features: [
        {
          $type: "app.bsky.richtext.facet#mention",
          did: profile.profile.did
        }
      ]
    }
  ]
});
```

### Post with Links

```typescript
const result = await createRichTextPost({
  text: "Check out this article: https://example.com",
  facets: [
    {
      index: {
        byteStart: 24,
        byteEnd: 43
      },
      features: [
        {
          $type: "app.bsky.richtext.facet#link",
          uri: "https://example.com"
        }
      ]
    }
  ]
});
```

### Post with Hashtags

```typescript
const result = await createRichTextPost({
  text: "Loving the #atproto community!",
  facets: [
    {
      index: {
        byteStart: 11,
        byteEnd: 19
      },
      features: [
        {
          $type: "app.bsky.richtext.facet#tag",
          tag: "atproto"
        }
      ]
    }
  ]
});
```

### Post with Multiple Facets

```typescript
// Resolve mention
const aliceProfile = await getUserProfile({ actor: "alice.bsky.social" });

const result = await createRichTextPost({
  text: "Hey @alice check out #atproto at https://atproto.com",
  facets: [
    {
      index: { byteStart: 4, byteEnd: 10 },
      features: [{
        $type: "app.bsky.richtext.facet#mention",
        did: aliceProfile.profile.did
      }]
    },
    {
      index: { byteStart: 21, byteEnd: 29 },
      features: [{
        $type: "app.bsky.richtext.facet#tag",
        tag: "atproto"
      }]
    },
    {
      index: { byteStart: 33, byteEnd: 53 },
      features: [{
        $type: "app.bsky.richtext.facet#link",
        uri: "https://atproto.com"
      }]
    }
  ]
});
```

## Link Previews

### Generate Link Preview

```typescript
import { generateLinkPreview } from './tools/generate-link-preview';

const preview = await generateLinkPreview({
  url: "https://example.com/article"
});

console.log(`Title: ${preview.preview.title}`);
console.log(`Description: ${preview.preview.description}`);
```

### Post with Link Preview

```typescript
const preview = await generateLinkPreview({
  url: "https://atproto.com/guides/overview"
});

const result = await createPost({
  text: "Great introduction to AT Protocol",
  embed: {
    external: {
      uri: preview.preview.uri,
      title: preview.preview.title,
      description: preview.preview.description,
      thumb: preview.preview.thumb
    }
  }
});
```

## Post Management

### Delete a Post

```typescript
import { deletePost } from './tools/delete-post';

await deletePost({
  uri: postUri
});

console.log('Post deleted successfully');
```

### Delete Multiple Posts

```typescript
async function deletePosts(postUris: string[]) {
  for (const uri of postUris) {
    try {
      await deletePost({ uri });
      console.log(`Deleted: ${uri}`);
      await sleep(1000); // Rate limiting
    } catch (error) {
      console.error(`Failed to delete ${uri}:`, error);
    }
  }
}
```

### Delete Old Posts

```typescript
import { searchPosts } from './tools/search-posts';

async function deleteOldPosts(authorHandle: string, daysOld: number) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  const posts = await searchPosts({
    q: "",
    author: authorHandle,
    until: cutoffDate.toISOString()
  });
  
  for (const post of posts.posts) {
    await deletePost({ uri: post.uri });
    console.log(`Deleted old post: ${post.record.text.substring(0, 50)}...`);
    await sleep(1000);
  }
}
```

## Content Scheduling

### Schedule Posts

```typescript
interface ScheduledPost {
  text: string;
  scheduledFor: Date;
  embed?: any;
}

class PostScheduler {
  private scheduled: ScheduledPost[] = [];
  private timer?: NodeJS.Timeout;
  
  schedule(post: ScheduledPost) {
    this.scheduled.push(post);
    this.scheduled.sort((a, b) => 
      a.scheduledFor.getTime() - b.scheduledFor.getTime()
    );
    this.startTimer();
  }
  
  private startTimer() {
    if (this.timer) clearTimeout(this.timer);
    
    const next = this.scheduled[0];
    if (!next) return;
    
    const delay = next.scheduledFor.getTime() - Date.now();
    
    if (delay <= 0) {
      this.publishNext();
    } else {
      this.timer = setTimeout(() => this.publishNext(), delay);
    }
  }
  
  private async publishNext() {
    const post = this.scheduled.shift();
    if (!post) return;
    
    try {
      await createPost({
        text: post.text,
        embed: post.embed
      });
      console.log(`Published scheduled post: ${post.text}`);
    } catch (error) {
      console.error('Failed to publish scheduled post:', error);
    }
    
    this.startTimer();
  }
}

// Usage
const scheduler = new PostScheduler();

scheduler.schedule({
  text: "Good morning! ☀️",
  scheduledFor: new Date('2024-01-15T09:00:00Z')
});

scheduler.schedule({
  text: "Good night! 🌙",
  scheduledFor: new Date('2024-01-15T21:00:00Z')
});
```

## Content Moderation

### Mute Users

```typescript
import { muteUser } from './tools/mute-user';

await muteUser({
  actor: "spammer.bsky.social"
});

console.log('User muted');
```

### Block Users

```typescript
import { blockUser } from './tools/block-user';

const result = await blockUser({
  actor: "harasser.bsky.social"
});

console.log(`User blocked: ${result.blockUri}`);
// Store blockUri to unblock later
```

### Report Content

```typescript
import { reportContent } from './tools/report-content';

await reportContent({
  subject: {
    uri: postUri,
    cid: postCid
  },
  reasonType: "spam",
  reason: "Repeated promotional content"
});
```

### Report User

```typescript
import { reportUser } from './tools/report-user';

await reportUser({
  actor: "spambot.bsky.social",
  reasonType: "spam",
  reason: "Automated spam account"
});
```

## Batch Operations

### Batch Upload Images

```typescript
async function batchUploadImages(
  imagePaths: string[],
  batchSize: number = 3
) {
  const results = [];
  
  for (let i = 0; i < imagePaths.length; i += batchSize) {
    const batch = imagePaths.slice(i, i + batchSize);
    
    const batchResults = await Promise.all(
      batch.map(async (path) => {
        const data = readFileSync(path);
        const blob = new Blob([data], { type: 'image/jpeg' });
        return await uploadImage({
          image: blob,
          alt: `Image from ${path}`
        });
      })
    );
    
    results.push(...batchResults);
    
    // Wait between batches
    if (i + batchSize < imagePaths.length) {
      await sleep(2000);
    }
  }
  
  return results;
}
```

### Batch Create Posts

```typescript
async function batchCreatePosts(texts: string[]) {
  for (const text of texts) {
    try {
      await createPost({ text });
      console.log(`Posted: ${text}`);
      await sleep(5000); // 5 seconds between posts
    } catch (error) {
      console.error(`Failed to post "${text}":`, error);
    }
  }
}
```

## Best Practices

### Image Optimization

```typescript
import sharp from 'sharp';

async function optimizeImage(inputPath: string): Promise<Buffer> {
  return await sharp(inputPath)
    .resize(1000, 1000, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
}

// Use optimized image
const optimized = await optimizeImage('./large-photo.jpg');
const blob = new Blob([optimized], { type: 'image/jpeg' });
await uploadImage({ image: blob, alt: "Optimized photo" });
```

### Error Recovery

```typescript
async function uploadWithRetry(
  imageBlob: Blob,
  alt: string,
  maxRetries: number = 3
) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await uploadImage({ image: imageBlob, alt });
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      console.log(`Upload failed, retrying (${attempt}/${maxRetries})...`);
      await sleep(1000 * attempt); // Exponential backoff
    }
  }
}
```

## See Also

- [Social Operations Examples](./social-operations.md)
- [Real-time Data Examples](./real-time-data.md)
- [Custom Integration Examples](./custom-integration.md)
- [API Reference](../api/)

