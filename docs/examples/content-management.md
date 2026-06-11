# Content Management Examples

Practical examples for managing content, media, and profiles on AT Protocol.

These examples show how an LLM interacts with the AT Protocol MCP Server tools
using JSON-formatted parameters.

::: tip Response shapes are illustrative

Tool results are returned as **stringified JSON text content**, not a guaranteed
structured schema. The `Response (JSON)` blocks below illustrate the kind of
data a tool returns; exact field names and structure may differ.

:::

::: tip Rate limiting and batching

Each tool is rate limited to roughly **100 requests per minute per tool**. When
a workflow performs many calls in sequence (uploads, deletions, posts), pace
them out with a short delay between calls so you stay under the limit. The
per-step "wait N seconds" notes below are conservative spacing suggestions, not
hard requirements.

:::

## Profile Management

### Update Profile Information

**User Request:**

```
"Update my profile display name to 'Alice Smith' and bio to 'Software engineer and coffee enthusiast ☕ Building cool things with AT Protocol'"
```

**Tool Call:** `update_profile`

**Parameters (JSON):**

```json
{
  "displayName": "Alice Smith",
  "description": "Software engineer and coffee enthusiast ☕\nBuilding cool things with AT Protocol"
}
```

**Response (JSON):**

```json
{
  "success": true,
  "message": "Profile updated successfully"
}
```

### Update Profile Avatar

**User Request:**

```
"Update my profile avatar with this image"
```

**Workflow:**

**Step 1: Upload the Image**

**Tool Call:** `upload_image`

**Parameters (JSON):**

```json
{
  "filePath": "./images/avatar.jpg",
  "altText": "Profile avatar"
}
```

**Step 2: Update the Profile**

**Tool Call:** `update_profile` — pass the `image.blob` object returned by
`upload_image` verbatim:

**Parameters (JSON):**

```json
{
  "avatar": {
    "type": "blob",
    "ref": "bafkreiavatar123...",
    "mimeType": "image/jpeg",
    "size": 145678
  }
}
```

**Note:** `avatar` and `banner` take a pre-uploaded blob descriptor (the
`image.blob` from a prior `upload_image` call), not raw image data.

### Update Profile Banner

**User Request:**

```
"Update my profile banner"
```

**Workflow:** Upload the banner image with `upload_image` (as above), then:

**Tool Call:** `update_profile`

**Parameters (JSON):**

```json
{
  "banner": {
    "type": "blob",
    "ref": "bafkreibanner456...",
    "mimeType": "image/jpeg",
    "size": 398765
  }
}
```

### Complete Profile Update

**User Request:**

```
"Update my entire profile with new name, bio, avatar, and banner"
```

**Workflow:** Upload the avatar and banner images with `upload_image` first,
then:

**Tool Call:** `update_profile`

**Parameters (JSON):**

```json
{
  "displayName": "Alice Smith",
  "description": "Full-stack developer | Open source contributor | Coffee addict",
  "avatar": {
    "type": "blob",
    "ref": "bafkreiavatar123...",
    "mimeType": "image/jpeg",
    "size": 145678
  },
  "banner": {
    "type": "blob",
    "ref": "bafkreibanner456...",
    "mimeType": "image/jpeg",
    "size": 398765
  }
}
```

## Media Upload

### Upload Single Image

**User Request:**

```
"Upload this sunset photo with alt text 'A beautiful sunset over the ocean'"
```

**Tool Call:** `upload_image`

**Parameters (JSON):**

```json
{
  "filePath": "./photos/sunset.jpg",
  "altText": "A beautiful sunset over the ocean"
}
```

**Response (JSON):**

```json
{
  "success": true,
  "message": "Image uploaded successfully from ./photos/sunset.jpg",
  "image": {
    "blob": {
      "type": "blob",
      "ref": "bafkreiabc123...",
      "mimeType": "image/jpeg",
      "size": 245678
    },
    "alt": "A beautiful sunset over the ocean"
  }
}
```

**Note:** `upload_image` reads a local file (JPEG, PNG, GIF, WebP, or AVIF; max
1 MB) whose path must resolve within the allowed media directory
(`ATPROTO_MEDIA_DIR`, defaults to the working directory). Pass the returned
`image.blob` object verbatim as `embed.images[].image` in `create_post`, or as
`avatar`/`banner` in `update_profile`.

### Upload Multiple Images Workflow

**User Request:**

```
"Upload these three photos"
```

**Workflow:** Call `upload_image` for each image sequentially

**First Image:**

```json
{
  "filePath": "./photos/photo1.jpg",
  "altText": "Image 1"
}
```

**Second Image:**

```json
{
  "filePath": "./photos/photo2.jpg",
  "altText": "Image 2"
}
```

**Third Image:**

```json
{
  "filePath": "./photos/photo3.jpg",
  "altText": "Image 3"
}
```

**Result:** Collect the returned `image.blob` descriptors to use in a post (up
to 4 per post).

### Upload Video

**User Request:**

```
"Upload this tutorial video"
```

**Tool Call:** `upload_video`

**Parameters (JSON):**

```json
{
  "filePath": "./videos/tutorial.mp4",
  "altText": "Tutorial on using AT Protocol"
}
```

**Response (JSON):**

```json
{
  "success": true,
  "message": "Video uploaded and processed successfully from ./videos/tutorial.mp4",
  "video": {
    "blob": {
      "type": "blob",
      "ref": "bafkreivideo123...",
      "mimeType": "video/mp4",
      "size": 5242880
    },
    "alt": "Tutorial on using AT Protocol",
    "jobId": "rmpdzv4uoctlginpv3oddi6w"
  }
}
```

**Note:** `upload_video` reads a local file (MP4, MOV, or WebM; max 100 MB),
checks your daily video-upload quota, uploads to the `app.bsky.video` service
(`video.bsky.app`), and waits — up to 5 minutes — for transcoding to finish.
The returned `video.blob` describes the **processed** video; pass it verbatim
as `embed.video.video` in `create_post`.

### Upload Video with Captions

**User Request:**

```
"Upload this conference talk video with English captions"
```

**Tool Call:** `upload_video`

**Parameters (JSON):**

```json
{
  "filePath": "./videos/talk.mp4",
  "altText": "Conference talk with captions",
  "captions": [
    {
      "lang": "en",
      "file": "./captions/en.vtt"
    }
  ]
}
```

**Response (JSON):**

```json
{
  "success": true,
  "message": "Video uploaded and processed successfully from ./videos/talk.mp4",
  "video": {
    "blob": {
      "type": "blob",
      "ref": "bafkreivideo456...",
      "mimeType": "video/mp4",
      "size": 9120004
    },
    "alt": "Conference talk with captions",
    "jobId": "kwx5ej3tqxxv2hcyvbq7worf",
    "captions": [
      {
        "lang": "en",
        "file": {
          "type": "blob",
          "ref": "bafkreicaption789...",
          "mimeType": "text/vtt",
          "size": 1843
        }
      }
    ]
  }
}
```

**Note:** Caption files are local WebVTT (`.vtt`) paths; each must be under
20 kB (the embed lexicon limit) or it is skipped. The captions come back as
`text/vtt` blob descriptors ready for `create_post`.

### Post the Uploaded Video

**Tool Call:** `create_post` — pass `video.blob` verbatim as
`embed.video.video` and each `video.captions[]` entry verbatim under
`embed.video.captions`:

**Parameters (JSON):**

```json
{
  "text": "My conference talk is online! 🎬",
  "embed": {
    "video": {
      "video": {
        "type": "blob",
        "ref": "bafkreivideo456...",
        "mimeType": "video/mp4",
        "size": 9120004
      },
      "alt": "Conference talk with captions",
      "aspectRatio": { "width": 16, "height": 9 },
      "captions": [
        {
          "lang": "en",
          "file": {
            "type": "blob",
            "ref": "bafkreicaption789...",
            "mimeType": "text/vtt",
            "size": 1843
          }
        }
      ]
    }
  }
}
```

**Note:** A post can carry only one embed — a video cannot be combined with
images, an external link, or a quote.

## Rich Text Posts

Rich text is handled by `create_post`. Mentions, links, and `#hashtags` in the
text are **auto-detected** into richtext facets, so for most posts you can just
pass `text`. Supply explicit `facets` only when you need precise control — each
feature is `{ "type": "mention" | "link" | "hashtag", "value": "..." }`, where
`value` is a handle/DID for a mention, the URL for a link, or the tag (without
`#`) for a hashtag.

### Post with Mentions

**User Request:**

```
"Create a post saying 'Great work @alice.bsky.social!'"
```

**Workflow:**

**Step 1: Get User Profile** (to resolve handle to DID)

**Tool Call:** `get_user_profile`

**Parameters (JSON):**

```json
{
  "actor": "alice.bsky.social"
}
```

**Step 2: Create the Post**

**Tool Call:** `create_post`

**Parameters (JSON):**

```json
{
  "text": "Great work @alice.bsky.social!",
  "facets": [
    {
      "index": {
        "byteStart": 11,
        "byteEnd": 30
      },
      "features": [
        {
          "type": "mention",
          "value": "alice.bsky.social"
        }
      ]
    }
  ]
}
```

**Note:** Byte positions must be calculated based on UTF-8 encoding of the text.
Mention handles supplied in `value` are resolved to DIDs automatically. In
practice you can also just pass the text and let `create_post` auto-detect the
mention.

### Post with Links

**User Request:**

```
"Create a post with a link: 'Check out this article: https://example.com'"
```

**Tool Call:** `create_post`

**Parameters (JSON):**

```json
{
  "text": "Check out this article: https://example.com",
  "facets": [
    {
      "index": {
        "byteStart": 24,
        "byteEnd": 43
      },
      "features": [
        {
          "type": "link",
          "value": "https://example.com"
        }
      ]
    }
  ]
}
```

### Post with Hashtags

**User Request:**

```
"Create a post saying 'Loving the #atproto community!'"
```

**Tool Call:** `create_post`

**Parameters (JSON):**

```json
{
  "text": "Loving the #atproto community!",
  "facets": [
    {
      "index": {
        "byteStart": 11,
        "byteEnd": 19
      },
      "features": [
        {
          "type": "hashtag",
          "value": "atproto"
        }
      ]
    }
  ]
}
```

### Post with Multiple Facets

**User Request:**

```
"Create a post: 'Hey @alice check out #atproto at https://atproto.com'"
```

**Workflow:**

**Step 1: Resolve Mention**

**Tool Call:** `get_user_profile`

**Parameters (JSON):**

```json
{
  "actor": "alice.bsky.social"
}
```

**Step 2: Create the Post**

**Tool Call:** `create_post`

**Parameters (JSON):**

```json
{
  "text": "Hey @alice check out #atproto at https://atproto.com",
  "facets": [
    {
      "index": {
        "byteStart": 4,
        "byteEnd": 10
      },
      "features": [
        {
          "type": "mention",
          "value": "alice.bsky.social"
        }
      ]
    },
    {
      "index": {
        "byteStart": 21,
        "byteEnd": 29
      },
      "features": [
        {
          "type": "hashtag",
          "value": "atproto"
        }
      ]
    },
    {
      "index": {
        "byteStart": 33,
        "byteEnd": 53
      },
      "features": [
        {
          "type": "link",
          "value": "https://atproto.com"
        }
      ]
    }
  ]
}
```

## Link Previews

### Generate Link Preview

**User Request:**

```
"Generate a preview for https://example.com/article"
```

**Tool Call:** `generate_link_preview`

**Parameters (JSON):**

```json
{
  "url": "https://example.com/article"
}
```

**Response (JSON):**

```json
{
  "success": true,
  "message": "Link preview generated for https://example.com/article",
  "preview": {
    "uri": "https://example.com/article",
    "title": "Article Title",
    "description": "Article description text",
    "thumb": {
      "blob": {
        "type": "blob",
        "ref": "bafkreithumb...",
        "mimeType": "image/jpeg",
        "size": 45678
      }
    }
  }
}
```

**Note:** `preview.thumb` is only present when the page had a usable `og:image`.
Pass the `preview.thumb.blob` object verbatim as `embed.external.thumb` in
`create_post`.

### Post with Link Preview Workflow

**User Request:**

```
"Create a post about the AT Protocol overview with a link preview"
```

**Step 1: Generate Link Preview**

**Tool Call:** `generate_link_preview`

**Parameters (JSON):**

```json
{
  "url": "https://atproto.com/guides/overview"
}
```

**Step 2: Create Post with Preview**

**Tool Call:** `create_post`

**Parameters (JSON):**

```json
{
  "text": "Great introduction to AT Protocol",
  "embed": {
    "external": {
      "uri": "https://atproto.com/guides/overview",
      "title": "AT Protocol Overview",
      "description": "Learn about the AT Protocol architecture and features",
      "thumb": {
        "type": "blob",
        "ref": "bafkreithumb...",
        "mimeType": "image/jpeg",
        "size": 45678
      }
    }
  }
}
```

**Note:** `thumb` is the full blob descriptor (`type`, `ref`, `mimeType`,
`size`) returned as `preview.thumb.blob` in Step 1 — a bare `ref` is not
enough.

## Post Management

### Delete a Post

**User Request:**

```
"Delete this post"
```

**Tool Call:** `delete_post`

**Parameters (JSON):**

```json
{
  "uri": "at://did:plc:abc123/app.bsky.feed.post/xyz789"
}
```

**Response (JSON):**

```json
{
  "success": true,
  "message": "Post deleted successfully"
}
```

### Delete Multiple Posts Workflow

**User Request:**

```
"Delete these three posts"
```

**Workflow:** Call `delete_post` for each URI sequentially, pacing the calls per
the rate-limiting note at the top of this page.

```json
// Post 1
{ "uri": "at://did:plc:abc123/app.bsky.feed.post/post1" }

// Post 2
{ "uri": "at://did:plc:abc123/app.bsky.feed.post/post2" }

// Post 3
{ "uri": "at://did:plc:abc123/app.bsky.feed.post/post3" }
```

### Delete Old Posts Workflow

**User Request:**

```
"Delete all my posts older than 30 days"
```

::: warning No match-all search

AT Protocol search has **no match-all wildcard**, and `search_posts` requires a
non-empty `q` term — an empty query (`"q": ""`) is rejected and will **not**
return all of an author's posts. To enumerate your own posts you must read them
from a feed (e.g. `get_timeline`) rather than search, then filter by date
client-side before deleting.

:::

**Step 1: List Your Recent Posts**

**Tool Call:** `get_timeline`

**Parameters (JSON):**

```json
{
  "limit": 50
}
```

The LLM reads the returned feed, paginating with the `cursor`, and filters for
your own posts whose `createdAt` is older than 30 days. (If you want posts
matching a keyword instead, `search_posts` with a real `q` term plus `author`
and `until` works.)

**Step 2: Delete Each Post**

For each old post identified above:

**Tool Call:** `delete_post`

**Parameters (JSON):**

```json
{
  "uri": "at://did:plc:abc123/app.bsky.feed.post/oldpost"
}
```

Pace the deletions per the rate-limiting note at the top of this page.

## Content Scheduling

**Note:** LLMs cannot directly schedule posts for future execution. Scheduling
requires an external system that triggers the LLM at the scheduled time.

### Scheduled Post Workflow

**Concept:** Create posts at specific times

**Implementation Approach:**

1. **External Scheduler** (cron job, task scheduler, etc.) triggers the LLM at
   the desired time
2. **LLM receives trigger** with the post content
3. **LLM creates the post** using the `create_post` tool

**Example Scheduled Posts:**

**Morning Post (triggered at 9:00 AM):**

**Tool Call:** `create_post`

**Parameters (JSON):**

```json
{
  "text": "Good morning! ☀️"
}
```

**Evening Post (triggered at 9:00 PM):**

**Tool Call:** `create_post`

**Parameters (JSON):**

```json
{
  "text": "Good night! 🌙"
}
```

**Alternative Approach - Queue System:**

If you want the LLM to help manage a schedule:

**User Request:**

```
"I want to schedule two posts: 'Good morning! ☀️' at 9 AM and 'Good night! 🌙' at 9 PM"
```

**LLM Response:**

```
"I've noted your scheduled posts:

1. 'Good morning! ☀️' - scheduled for 9:00 AM
2. 'Good night! 🌙' - scheduled for 9:00 PM

Note: I cannot execute these automatically. You'll need to:
- Set up a cron job or task scheduler to trigger me at these times
- Or manually ask me to create these posts at the scheduled times
- Or use a third-party scheduling service that integrates with this MCP server

Would you like me to create either of these posts now instead?"
```

## Content Moderation

### Mute Users

**User Request:**

```
"Mute spammer.bsky.social"
```

**Tool Call:** `mute_user`

**Parameters (JSON):**

```json
{
  "actor": "spammer.bsky.social"
}
```

**Response (JSON):**

```json
{
  "success": true,
  "message": "User muted successfully"
}
```

### Block Users

**User Request:**

```
"Block harasser.bsky.social"
```

**Tool Call:** `block_user`

**Parameters (JSON):**

```json
{
  "actor": "harasser.bsky.social"
}
```

**Response (JSON):**

```json
{
  "success": true,
  "blockUri": "at://did:plc:abc123/app.bsky.graph.block/block456",
  "message": "User blocked successfully"
}
```

**Note:** Store the `blockUri` to unblock the user later.

### Report Content

**User Request:**

```
"Report this post for spam"
```

**Tool Call:** `report_content`

**Parameters (JSON):**

```json
{
  "subject": {
    "uri": "at://did:plc:abc123/app.bsky.feed.post/xyz789",
    "cid": "bafyreiabc123..."
  },
  "reasonType": "spam",
  "reason": "Repeated promotional content"
}
```

**Response (JSON):**

```json
{
  "success": true,
  "message": "Content reported successfully"
}
```

**Reason Types:**

- `"spam"` - Spam or unwanted content
- `"violation"` - Terms of service violation
- `"misleading"` - Misleading or false information
- `"sexual"` - Sexual content
- `"rude"` - Rude or harassing content
- `"other"` - Other reasons

### Report User

**User Request:**

```
"Report spambot.bsky.social for being a spam account"
```

**Tool Call:** `report_user`

**Parameters (JSON):**

```json
{
  "actor": "spambot.bsky.social",
  "reasonType": "spam",
  "reason": "Automated spam account"
}
```

**Response (JSON):**

```json
{
  "success": true,
  "message": "User reported successfully"
}
```

## Batch Operations

### Batch Upload Images Workflow

**User Request:**

```
"Upload these 6 images"
```

**Workflow:** Upload images in batches, calling `upload_image` once per image
and pacing the calls per the rate-limiting note at the top of this page.

```json
// Batch 1
{ "filePath": "./photos/img1.jpg", "altText": "Image 1" }
{ "filePath": "./photos/img2.jpg", "altText": "Image 2" }
{ "filePath": "./photos/img3.jpg", "altText": "Image 3" }

// Batch 2
{ "filePath": "./photos/img4.jpg", "altText": "Image 4" }
{ "filePath": "./photos/img5.jpg", "altText": "Image 5" }
{ "filePath": "./photos/img6.jpg", "altText": "Image 6" }
```

Collect the returned `image.blob` descriptors to attach to posts (a single post
carries at most 4 images).

### Batch Create Posts Workflow

**User Request:**

```
"Create these three posts: 'Post 1', 'Post 2', 'Post 3'"
```

**Workflow:** Call `create_post` once per post, sequentially, pacing the calls
per the rate-limiting note at the top of this page.

```json
{ "text": "Post 1" }
{ "text": "Post 2" }
{ "text": "Post 3" }
```

## Best Practices

### Image Optimization

**Note:** LLMs cannot directly optimize media files. `upload_image` enforces a
**1 MB** cap and accepts only `.jpg`/`.jpeg`/`.png`/`.gif`/`.webp`/`.avif`
files; `upload_video` enforces the video service's **100 MB** cap and accepts
only `.mp4`/`.mov`/`.webm`. Both read local file paths that must resolve within
the allowed media directory (`ATPROTO_MEDIA_DIR`, defaults to the working
directory). Optimization should be done before the file is handed to these
tools.

When a user provides an oversized file, the LLM can suggest resizing or
compressing it (e.g. JPEG/WebP for images, H.264 MP4 for video) to fit within
these limits before uploading.

### Error Recovery Workflow

**Concept:** Retry failed uploads with exponential backoff

**First Attempt:**

**Tool Call:** `upload_image`

**Parameters (JSON):**

```json
{
  "filePath": "./photos/photo.jpg",
  "altText": "Photo description"
}
```

**If Error Occurs:**

**Wait 1 second, then retry**

**Second Attempt:**

Same parameters as first attempt

**If Error Occurs Again:**

**Wait 2 seconds, then retry**

**Third Attempt:**

Same parameters as first attempt

**If Error Occurs Third Time:**

Inform the user:

```
"I've tried uploading the image 3 times but encountered errors. This might be due to:
- Network connectivity issues
- Image file corruption
- Server-side problems

Please try again later or with a different image."
```

**Best Practice:** Use exponential backoff (1s, 2s, 4s) between retries.

## See Also

- [Social Operations Examples](./social-operations.md)
- [Custom Integration Examples](./custom-integration.md)
- [API Reference](../api/)
