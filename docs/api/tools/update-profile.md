# update_profile

Update the authenticated user's profile information.

## Authentication

**Required:** Yes (Private tool)

## Parameters

### `displayName` (optional)

- **Type:** `string`
- **Constraints:** Maximum 64 characters
- **Description:** Display name to show on profile

### `description` (optional)

- **Type:** `string`
- **Constraints:** Maximum 256 characters
- **Description:** Bio/description text

### `avatar` (optional)

- **Type:** `Blob`
- **Description:** Avatar image file

### `banner` (optional)

- **Type:** `Blob`
- **Description:** Banner image file

## Response

Only the fields you pass are changed; other profile fields (pinned post, labels,
etc.) are preserved. The response lists which fields were updated.
`avatar`/`banner` appear as the marker string `"updated"` when a new image was
uploaded, not as a URL.

```typescript
{
  success: boolean;
  message: string;
  updatedFields: string[];   // e.g. ["displayName", "avatar"]
  profile: {
    displayName?: string;
    description?: string;
    avatar?: string;         // "updated" when a new avatar was set
    banner?: string;         // "updated" when a new banner was set
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

#### Display Name Too Long

```json
{
  "error": "Display name cannot exceed 64 characters",
  "code": "VALIDATION_ERROR"
}
```

#### Description Too Long

```json
{
  "error": "Description cannot exceed 256 characters",
  "code": "VALIDATION_ERROR"
}
```

## Best Practices

### Text Fields

- `displayName` is capped at 64 characters; `description` at 256 characters
- Use the marker in `updatedFields` to confirm which fields changed

### Images

- Avatars render best as square images; banners as wide images
- Image format and size limits are enforced by the Bluesky platform, not by this
  server

## Related Tools

- **[get_user_profile](./get-user-profile.md)** - Get profile information
- **[upload_image](./upload-image.md)** - Upload images separately

## See Also

- [Content Management Examples](../../examples/content-management.md)
