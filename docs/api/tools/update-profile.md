# update_profile

Update the authenticated user's profile information.

## Authentication

**Required:** Yes (Private tool)

## Parameters

### `displayName` (optional)
- **Type:** `string`
- **Description:** Display name to show on profile

### `description` (optional)
- **Type:** `string`
- **Description:** Bio/description text

### `avatar` (optional)
- **Type:** `Blob`
- **Description:** Avatar image file

### `banner` (optional)
- **Type:** `Blob`
- **Description:** Banner image file

## Response

```typescript
{
  success: boolean;
  message: string;
  profile: {
    did: string;
    handle: string;
    displayName?: string;
    description?: string;
    avatar?: string;
    banner?: string;
  }
}
```

## Examples

### Update Display Name and Description

```json
{
  "displayName": "Alice Smith",
  "description": "Software engineer and coffee enthusiast ☕"
}
```

### Update Avatar

```json
{
  "avatar": "<Blob data>"
}
```

### Update Multiple Fields

```json
{
  "displayName": "Alice Smith",
  "description": "Software engineer | Open source contributor",
  "avatar": "<Blob data>",
  "banner": "<Blob data>"
}
```

## Error Handling

### Common Errors

#### Authentication Required
```json
{
  "error": "Authentication required",
  "code": "AUTHENTICATION_FAILED"
}
```

#### Invalid Image Format
```json
{
  "error": "Invalid image format. Supported: JPEG, PNG, WebP",
  "code": "VALIDATION_ERROR"
}
```

#### Image Too Large
```json
{
  "error": "Image size exceeds maximum allowed (1MB)",
  "code": "VALIDATION_ERROR"
}
```

## Best Practices

### Display Name
- Keep it concise and recognizable
- Use proper capitalization
- Avoid special characters that may not render well

### Description
- Keep under 256 characters for best display
- Use emojis sparingly
- Include relevant links or hashtags

### Images
- **Avatar**: Square images work best (recommended: 400x400px)
- **Banner**: Wide images (recommended: 1500x500px)
- **Format**: JPEG, PNG, or WebP
- **Size**: Keep under 1MB for best performance
- **Optimization**: Compress images before uploading

### Update Strategy
- Update fields individually or in batches
- Validate images before uploading
- Provide preview before saving
- Cache profile data after updates

## Related Tools

- **[get_user_profile](./get-user-profile.md)** - Get profile information
- **[upload_image](./upload-image.md)** - Upload images separately

## See Also

- [Content Management Examples](../../examples/content-management.md)

