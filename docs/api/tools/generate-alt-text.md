# generate_alt_text

Provide best-practice guidance and a template for writing accessible alt text.

::: warning Placeholder — no image analysis

`generate_alt_text` does **not** analyze image content. There is no vision model
wired into this server, so the tool never inspects the pixels at `imageUrl` or
`imageData`. It returns alt-text writing guidance, suggestions, and a template
that you use to write the alt text yourself. See
[Experimental & Roadmap](../../guide/experimental.md).

:::

## What this tool actually does

- It ignores the image bytes and returns a fixed set of writing guidelines
  (dos/donts), suggestions, and a placeholder `altText` string instructing you
  to write the description yourself.
- If you pass `context`, that string is echoed back into the suggestions and
  placeholder text so you can incorporate it — but the image itself is still not
  examined.
- For real image metadata (declared blob size and MIME type), see
  [analyze_image](./analyze-image.md); note it does not decode pixels either, so
  it cannot provide dimensions.

## Authentication

**Optional** — this tool works without authentication.

## Parameters

| Parameter   | Type     | Required | Default | Description                                                                   |
| ----------- | -------- | -------- | ------- | ----------------------------------------------------------------------------- |
| `imageUrl`  | `string` | No\*     | -       | URL of an image. Validated as a URL but **not fetched or analyzed**.          |
| `imageData` | `string` | No\*     | -       | Base64 encoded image data. Accepted but **not decoded or analyzed**.          |
| `context`   | `string` | No       | -       | Optional context echoed into the returned suggestions and template.           |
| `maxLength` | `number` | No       | `200`   | Maximum length of the returned placeholder text. Must be between 10 and 1000. |

\*Either `imageUrl` or `imageData` must be provided (validation requirement
only).

## Response

Returned as stringified JSON (shape is illustrative):

```typescript
{
  success: boolean;
  altText: string;        // placeholder text telling you to write the alt text yourself
  suggestions: string[];  // writing tips (incorporates `context` if provided)
  guidelines: {
    dos: string[];
    donts: string[];
  };
}
```

The `altText` field is not an image description — it is a notice that no
automated analysis was performed, optionally including any `context` you
supplied.

## Examples

### Request guidance for an image URL

```json
{
  "imageUrl": "https://example.com/image.jpg",
  "maxLength": 200
}
```

### Request guidance with context

```json
{
  "imageUrl": "https://example.com/chart.png",
  "context": "Bar chart of quarterly sales for 2026",
  "maxLength": 250
}
```

## Alt Text Guidelines

These are the guidelines this tool returns and that you should apply when
writing your own alt text.

### Do

- Describe the content and function of the image
- Be accurate and specific
- Keep it concise (under 125 characters when possible)
- Include important text that appears in the image
- Describe the mood or emotion if relevant
- Use proper punctuation and grammar

### Don't

- Don't start with "image of" or "picture of"
- Don't include redundant information
- Don't use overly technical jargon unless necessary
- Don't describe purely decorative images (use empty alt text instead)
- Don't make assumptions about what is not visible

## Error Handling

- **`InvalidRequest`**: Neither `imageUrl` nor `imageData` provided, or invalid
  parameters
- **`InvalidUrl`**: `imageUrl` is not a valid URL

## Related Tools

- **[upload_image](./upload-image.md)** — Upload images with alt text
- **[analyze_image](./analyze-image.md)** — Report a blob's declared size and
  MIME type (no pixel decoding)
- **[create_post](./create-post.md)** — Create posts with images

## See Also

- [Experimental & Roadmap](../../guide/experimental.md)
- [WebAIM Alt Text Guide](https://webaim.org/techniques/alttext/)
- [W3C Images Tutorial](https://www.w3.org/WAI/tutorials/images/)
