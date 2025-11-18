# generate_alt_text

Generate descriptive alt text for images to improve accessibility. Provide either an image URL or base64 encoded image data. Optionally include context about the image.

## Authentication

**Optional** - This tool works without authentication.

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `imageUrl` | `string` | No* | - | URL of the image to analyze. Must be a valid URL. |
| `imageData` | `string` | No* | - | Base64 encoded image data. |
| `context` | `string` | No | - | Optional context about the image to improve description quality. |
| `maxLength` | `number` | No | `200` | Maximum length of generated alt text. Must be between 10 and 1000. |

*Either `imageUrl` or `imageData` must be provided.

## Response

```typescript
{
  success: boolean;
  altText: string;
  suggestions: string[];
  guidelines: {
    dos: string[];
    donts: string[];
  };
}
```

## Examples

### Generate Alt Text from URL

```json
{
  "imageUrl": "https://example.com/image.jpg",
  "maxLength": 200
}
```

### Generate Alt Text with Context

```json
{
  "imageUrl": "https://example.com/chart.png",
  "context": "This is a bar chart showing quarterly sales data for 2024",
  "maxLength": 250
}
```

### Generate Alt Text from Base64 Data

```json
{
  "imageData": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
  "maxLength": 150
}
```

## Error Handling

Common errors:

- **`InvalidRequest`**: Neither imageUrl nor imageData provided, or invalid parameters
- **`InvalidUrl`**: imageUrl is not a valid URL
- **`InvalidImageData`**: imageData is not valid base64 encoded data
- **`ImageTooLarge`**: Image exceeds maximum size limit

## Best Practices

1. **Provide Context**: Include context parameter for more accurate descriptions
2. **Appropriate Length**: Use 100-200 characters for most images
3. **Be Specific**: Generated text should be specific and descriptive
4. **Review Output**: Always review and edit generated alt text
5. **Include Text**: If image contains text, ensure it's in the alt text
6. **Avoid Redundancy**: Don't start with "image of" or "picture of"
7. **Test with Screen Readers**: Verify alt text works well with assistive technology

## Alt Text Guidelines

### Do:
- Describe the content and function of the image
- Be accurate and specific
- Keep it concise (under 125 characters when possible)
- Include important text that appears in the image
- Describe the mood or emotion if relevant
- Use proper punctuation and grammar

### Don't:
- Don't start with "image of" or "picture of"
- Don't include redundant information
- Don't use overly technical jargon unless necessary
- Don't describe decorative images (use empty alt instead)
- Don't make assumptions about what's not visible
- Don't exceed the character limit unnecessarily

## Alt Text Examples

### Good Alt Text:
- "Golden retriever puppy playing with a red ball in a grassy park"
- "Bar chart showing 25% increase in sales from Q1 to Q4 2024"
- "Woman in blue dress speaking at podium with microphone"

### Poor Alt Text:
- "Image of a dog" (too vague)
- "Picture of a chart" (not descriptive)
- "IMG_1234.jpg" (filename, not description)

## Special Cases

### Decorative Images
For purely decorative images, use empty alt text:
```json
{ "altText": "" }
```

### Complex Images
For charts, diagrams, or infographics:
- Provide a concise summary in alt text
- Consider adding a longer description in the post text
- Include key data points and trends

### Text in Images
If the image contains text:
- Include all important text in the alt text
- Maintain the order and structure of the text
- Consider using OCR for accuracy

## Implementation Note

This is a placeholder implementation that provides guidance on writing good alt text. In a production environment, this would integrate with a vision AI service (like GPT-4 Vision, Claude Vision, or Google Cloud Vision API) to automatically analyze images and generate descriptions.

## Rate Limiting

This tool is not subject to AT Protocol API rate limits as it performs local analysis.

## Related Tools

- **[upload_image](./upload-image.md)** - Upload images with alt text
- **[analyze_image](#analyze-image)** - Analyze image metadata
- **[create_post](./create-post.md)** - Create posts with images
- **[extract_media_from_post](#extract-media-from-post)** - Extract media from posts

## See Also

- [Rich Media Guide](../../guide/tools-resources.md#rich-media)
- [Accessibility Best Practices](https://www.w3.org/WAI/tutorials/images/)
- [WebAIM Alt Text Guide](https://webaim.org/techniques/alttext/)

