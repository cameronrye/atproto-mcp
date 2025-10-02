# Content Management Examples

Practical examples for managing content, media, and profiles on AT Protocol.

These examples show how an LLM interacts with the AT Protocol MCP Server tools using JSON-formatted parameters.

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

**Note:** Images are typically provided as blob references or base64-encoded data. The LLM receives image data from the user's client.

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

**Step 2: Create Rich Text Post**

**Tool Call:** `create_rich_text_post`

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
          "$type": "app.bsky.richtext.facet#mention",
          "did": "did:plc:alice123"
        }
      ]
    }
  ]
}
```

**Note:** Byte positions must be calculated based on UTF-8 encoding of the text.

### Post with Links

**User Request:**
```
"Create a post with a link: 'Check out this article: https://example.com'"
```

**Tool Call:** `create_rich_text_post`

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
          "$type": "app.bsky.richtext.facet#link",
          "uri": "https://example.com"
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

**Tool Call:** `create_rich_text_post`

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
          "$type": "app.bsky.richtext.facet#tag",
          "tag": "atproto"
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

**Step 2: Create Rich Text Post**

**Tool Call:** `create_rich_text_post`

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
          "$type": "app.bsky.richtext.facet#mention",
          "did": "did:plc:alice123"
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
          "$type": "app.bsky.richtext.facet#tag",
          "tag": "atproto"
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
          "$type": "app.bsky.richtext.facet#link",
          "uri": "https://atproto.com"
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

**Workflow:** Call `delete_post` for each URI sequentially with delays

**First Post:**
```json
{
  "uri": "at://did:plc:abc123/app.bsky.feed.post/post1"
}
```

**Wait 1 second**

**Second Post:**
```json
{
  "uri": "at://did:plc:abc123/app.bsky.feed.post/post2"
}
```

**Wait 1 second**

**Third Post:**
```json
{
  "uri": "at://did:plc:abc123/app.bsky.feed.post/post3"
}
```

**Best Practice:** Wait 1 second between deletions to avoid rate limits.

### Delete Old Posts Workflow

**User Request:**
```
"Delete all my posts older than 30 days"
```

**Step 1: Search for Old Posts**

**Tool Call:** `search_posts`

**Parameters (JSON):**
```json
{
  "q": "",
  "author": "myhandle.bsky.social",
  "until": "2024-01-01T00:00:00Z"
}
```

**Step 2: Delete Each Post**

For each post in the search results:

**Tool Call:** `delete_post`

**Parameters (JSON):**
```json
{
  "uri": "at://did:plc:abc123/app.bsky.feed.post/oldpost"
}
```

**Wait 1 second between each deletion**

## Content Scheduling

**Note:** LLMs cannot directly schedule posts for future execution. Scheduling requires an external system that triggers the LLM at the scheduled time.

### Scheduled Post Workflow

**Concept:** Create posts at specific times

**Implementation Approach:**

1. **External Scheduler** (cron job, task scheduler, etc.) triggers the LLM at the desired time
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

**Workflow:** Upload images in batches of 3 with delays between batches

**Batch 1 (Images 1-3):**

Upload these in parallel or sequentially:

```json
// Image 1
{
  "image": "<blob reference 1>",
  "alt": "Image 1"
}

// Image 2
{
  "image": "<blob reference 2>",
  "alt": "Image 2"
}

// Image 3
{
  "image": "<blob reference 3>",
  "alt": "Image 3"
}
```

**Wait 2 seconds**

**Batch 2 (Images 4-6):**

```json
// Image 4
{
  "image": "<blob reference 4>",
  "alt": "Image 4"
}

// Image 5
{
  "image": "<blob reference 5>",
  "alt": "Image 5"
}

// Image 6
{
  "image": "<blob reference 6>",
  "alt": "Image 6"
}
```

**Best Practice:** Process in batches to avoid overwhelming the server and respect rate limits.

### Batch Create Posts Workflow

**User Request:**
```
"Create these three posts: 'Post 1', 'Post 2', 'Post 3'"
```

**Workflow:** Create posts sequentially with delays

**First Post:**

**Tool Call:** `create_post`

**Parameters (JSON):**
```json
{
  "text": "Post 1"
}
```

**Wait 5 seconds**

**Second Post:**

**Tool Call:** `create_post`

**Parameters (JSON):**
```json
{
  "text": "Post 2"
}
```

**Wait 5 seconds**

**Third Post:**

**Tool Call:** `create_post`

**Parameters (JSON):**
```json
{
  "text": "Post 3"
}
```

**Best Practice:** Wait 5 seconds between posts to avoid rate limits.

## Best Practices

### Image Optimization

**Note:** LLMs cannot directly optimize images. Image optimization should be done by the client application before providing the image to the LLM.

**Recommended Image Specifications:**
- **Maximum dimensions:** 1000x1000 pixels
- **Format:** JPEG, PNG, or WebP
- **Quality:** 85% for JPEG
- **File size:** Under 1MB per image

**User Guidance:**

When a user provides a large image, the LLM can suggest:

```
"This image appears to be quite large. For best results, please:
1. Resize to a maximum of 1000x1000 pixels
2. Compress to under 1MB
3. Use JPEG format with 85% quality

Would you like to proceed with uploading the image as-is, or would you prefer to optimize it first?"
```

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
- [Real-time Data Examples](./real-time-data.md)
- [Custom Integration Examples](./custom-integration.md)
- [API Reference](../api/)

