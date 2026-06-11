# update_profile

Update the authenticated user's profile information.

## Authentication

**Required:** Yes (Private tool)

## Parameters

### `displayName` (optional)

- **Type:** `string`
- **Constraints:** Maximum 64 graphemes (emoji count as one)
- **Description:** Display name to show on profile

### `description` (optional)

- **Type:** `string`
- **Constraints:** Maximum 256 graphemes (emoji count as one)
- **Description:** Bio/description text

### `avatar` (optional)

- **Type:** `object`
- **Description:** New avatar image as a pre-uploaded blob descriptor: pass the
  `image.blob` object returned by [upload_image](./upload-image.md) verbatim
  (`{ type: 'blob', ref, mimeType, size }`). Omit to keep the existing avatar.

### `banner` (optional)

- **Type:** `object`
- **Description:** New banner/header image as a pre-uploaded blob descriptor:
  pass the `image.blob` object returned by [upload_image](./upload-image.md)
  verbatim. Omit to keep the existing banner.

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

Upload the image first with `upload_image`, then pass its `image.blob`
descriptor:

```json
{
  "avatar": {
    "type": "blob",
    "ref": "bafkreiabc123...",
    "mimeType": "image/jpeg",
    "size": 245678
  }
}
```

### Update Multiple Fields

```json
{
  "displayName": "Alice Smith",
  "description": "Software engineer | Open source contributor",
  "avatar": {
    "type": "blob",
    "ref": "bafkreiabc123...",
    "mimeType": "image/jpeg",
    "size": 245678
  },
  "banner": {
    "type": "blob",
    "ref": "bafkreidef456...",
    "mimeType": "image/png",
    "size": 512344
  }
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
  "error": "Display name cannot exceed 64 graphemes",
  "code": "VALIDATION_ERROR"
}
```

#### Description Too Long

```json
{
  "error": "Description cannot exceed 256 graphemes",
  "code": "VALIDATION_ERROR"
}
```

## Best Practices

### Text Fields

- `displayName` is capped at 64 graphemes; `description` at 256 graphemes
- Use the marker in `updatedFields` to confirm which fields changed

### Images

- Upload images first with `upload_image`, then pass the returned `image.blob`
  descriptors as `avatar`/`banner`
- Avatars render best as square images; banners as wide images
- Image format and size limits are enforced by the Bluesky platform, not by this
  server

## Related Tools

- **[get_user_profile](./get-user-profile.md)** - Get profile information
- **[upload_image](./upload-image.md)** - Upload images separately

## See Also

- [Content Management Examples](../../examples/content-management.md)
