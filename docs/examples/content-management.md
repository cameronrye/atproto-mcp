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

**Tool Call:** `update_profile`

**Parameters (JSON):**

```json
{
  "avatar": "<blob reference or base64 encoded image data>"
}
```

**Note:** Images are typically provided as blob references or base64-encoded
data. The LLM receives image data from the user's client.

### Update Profile Banner

**User Request:**

```
"Update my profile banner"
```

**Tool Call:** `update_profile`

**Parameters (JSON):**

```json
{
  "banner": "<blob reference or base64 encoded image data>"
}
```

### Complete Profile Update

**User Request:**

```
"Update my entire profile with new name, bio, avatar, and banner"
```

**Tool Call:** `update_profile`

**Parameters (JSON):**

```json
{
  "displayName": "Alice Smith",
  "description": "Full-stack developer | Open source contributor | Coffee addict",
  "avatar": "<blob reference>",
  "banner": "<blob reference>"
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
  "image": "<blob reference or base64 encoded image data>",
  "alt": "A beautiful sunset over the ocean"
}
```

**Response (JSON):**

```json
{
  "success": true,
  "blob": {
    "ref": {
      "$link": "bafkreiabc123..."
    },
    "mimeType": "image/jpeg",
    "size": 245678
  },
  "alt": "A beautiful sunset over the ocean"
}
```

**Note:** The returned blob reference can be used in posts with images.

### Upload Multiple Images Workflow

**User Request:**

```
"Upload these three photos"
```

**Workflow:** Call `upload_image` for each image sequentially

**First Image:**

```json
{
  "image": "<blob reference 1>",
  "alt": "Image 1"
}
```

**Second Image:**

```json
{
  "image": "<blob reference 2>",
  "alt": "Image 2"
}
```

**Third Image:**

```json
{
  "image": "<blob reference 3>",
  "alt": "Image 3"
}
```

**Result:** Collect all blob references to use in a post.

### Upload Video

**User Request:**

```
"Upload this tutorial video"
```

**Tool Call:** `upload_video`

**Parameters (JSON):**

```json
{
  "video": "<blob reference or base64 encoded video data>",
  "alt": "Tutorial on using AT Protocol"
}
```

**Response (JSON):**

```json
{
  "success": true,
  "blob": {
    "ref": {
      "$link": "bafkreivideo123..."
    },
    "mimeType": "video/mp4",
    "size": 5242880
  }
}
```

### Upload Video with Captions

**User Request:**

```
"Upload this conference talk video with English captions"
```

**Tool Call:** `upload_video`

**Parameters (JSON):**

```json
{
  "video": "<blob reference>",
  "alt": "Conference talk with captions",
  "captions": [
    {
      "lang": "en",
      "file": "<blob reference to VTT file>"
    }
  ]
}
```

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
  "preview": {
    "uri": "https://example.com/article",
    "title": "Article Title",
    "description": "Article description text",
    "thumb": {
      "ref": {
        "$link": "bafkreithumb..."
      },
      "mimeType": "image/jpeg"
    }
  }
}
```

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
        "ref": {
          "$link": "bafkreithumb..."
        }
      }
    }
  }
}
```

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
{ "image": "<blob reference 1>", "alt": "Image 1" }
{ "image": "<blob reference 2>", "alt": "Image 2" }
{ "image": "<blob reference 3>", "alt": "Image 3" }

// Batch 2
{ "image": "<blob reference 4>", "alt": "Image 4" }
{ "image": "<blob reference 5>", "alt": "Image 5" }
{ "image": "<blob reference 6>", "alt": "Image 6" }
```

Collect the returned blob references to attach to a post.

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

**Note:** LLMs cannot directly optimize images, and this server does not enforce
its own image size or format caps. Any size/format limits come from the
**Bluesky platform**, not from this tool. Image optimization should be done by
the client application before providing the image to the LLM.

When a user provides a very large image, the LLM can suggest resizing or
compressing it (using a common web format such as JPEG, PNG, or WebP) to stay
within the platform's upload limits before uploading.

### Error Recovery Workflow

**Concept:** Retry failed uploads with exponential backoff

**First Attempt:**

**Tool Call:** `upload_image`

**Parameters (JSON):**

```json
{
  "image": "<blob reference>",
  "alt": "Photo description"
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
