# Utility Types

Helper types and interfaces used throughout the server.

## Response Types

### SuccessResponse

```typescript
interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
}
```

**Description:** Standard success response wrapper.

**Example:**
```typescript
const response: SuccessResponse<IAtpPost> = {
  success: true,
  data: post,
  message: 'Post created successfully'
};
```

### ErrorResponse

```typescript
interface ErrorResponse {
  success: false;
  error: string;
  code: string;
  details?: unknown;
}
```

**Description:** Standard error response wrapper.

**Example:**
```typescript
const response: ErrorResponse = {
  success: false,
  error: 'Post text cannot be empty',
  code: 'VALIDATION_ERROR',
  details: { field: 'text' }
};
```

### PaginatedResponse

```typescript
interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  cursor?: string;
  hasMore: boolean;
}
```

**Description:** Paginated data response.

**Example:**
```typescript
const response: PaginatedResponse<IAtpPost> = {
  success: true,
  data: posts,
  cursor: 'next_page_cursor',
  hasMore: true
};
```

## Pagination Types

### CursorPagination

```typescript
interface CursorPagination {
  cursor?: string;
  limit?: number;
}
```

**Description:** Cursor-based pagination parameters.

**Example:**
```typescript
const pagination: CursorPagination = {
  cursor: 'abc123',
  limit: 50
};
```

### PageInfo

```typescript
interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string;
  endCursor?: string;
}
```

**Description:** Pagination metadata.

## Filter Types

### DateRange

```typescript
interface DateRange {
  since?: string;  // ISO 8601
  until?: string;  // ISO 8601
}
```

**Description:** Date range filter.

**Example:**
```typescript
const range: DateRange = {
  since: '2024-01-01T00:00:00Z',
  until: '2024-01-31T23:59:59Z'
};
```

### SortOptions

```typescript
interface SortOptions {
  sort?: 'asc' | 'desc' | 'top' | 'latest';
  sortBy?: string;
}
```

**Description:** Sorting options.

## Blob Types

### BlobRef

```typescript
interface BlobRef {
  $type: 'blob';
  ref: {
    $link: CID;
  };
  mimeType: string;
  size: number;
}
```

**Description:** Reference to uploaded blob.

**Example:**
```typescript
const imageBlob: BlobRef = {
  $type: 'blob',
  ref: {
    $link: 'bafyreiabc123...' as CID
  },
  mimeType: 'image/jpeg',
  size: 245678
};
```

## Embed Types

### ImageEmbed

```typescript
interface ImageEmbed {
  $type: 'app.bsky.embed.images';
  images: Array<{
    alt: string;
    image: BlobRef;
  }>;
}
```

### ExternalEmbed

```typescript
interface ExternalEmbed {
  $type: 'app.bsky.embed.external';
  external: {
    uri: string;
    title: string;
    description: string;
    thumb?: BlobRef;
  };
}
```

### RecordEmbed

```typescript
interface RecordEmbed {
  $type: 'app.bsky.embed.record';
  record: {
    uri: ATURI;
    cid: CID;
  };
}
```

## Facet Types

### RichTextFacet

```typescript
interface RichTextFacet {
  index: {
    byteStart: number;
    byteEnd: number;
  };
  features: Array<MentionFeature | LinkFeature | TagFeature>;
}
```

### MentionFeature

```typescript
interface MentionFeature {
  $type: 'app.bsky.richtext.facet#mention';
  did: DID;
}
```

### LinkFeature

```typescript
interface LinkFeature {
  $type: 'app.bsky.richtext.facet#link';
  uri: string;
}
```

### TagFeature

```typescript
interface TagFeature {
  $type: 'app.bsky.richtext.facet#tag';
  tag: string;
}
```

## Utility Functions

### Type Guards

```typescript
function isSuccessResponse<T>(
  response: SuccessResponse<T> | ErrorResponse
): response is SuccessResponse<T> {
  return response.success === true;
}

function isErrorResponse(
  response: SuccessResponse | ErrorResponse
): response is ErrorResponse {
  return response.success === false;
}
```

### Type Assertions

```typescript
function assertDefined<T>(
  value: T | undefined | null,
  message: string
): asserts value is T {
  if (value === undefined || value === null) {
    throw new Error(message);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${value}`);
}
```

## Generic Types

### Nullable

```typescript
type Nullable<T> = T | null;
```

### Optional

```typescript
type Optional<T> = T | undefined;
```

### Maybe

```typescript
type Maybe<T> = T | null | undefined;
```

### DeepPartial

```typescript
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
```

### DeepReadonly

```typescript
type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};
```

## Promise Types

### AsyncResult

```typescript
type AsyncResult<T, E = Error> = Promise<
  | { success: true; data: T }
  | { success: false; error: E }
>;
```

**Example:**
```typescript
async function fetchPost(uri: ATURI): AsyncResult<IAtpPost> {
  try {
    const post = await getPost(uri);
    return { success: true, data: post };
  } catch (error) {
    return { success: false, error: error as Error };
  }
}
```

## Best Practices

### Type Usage
- Use utility types for consistency
- Prefer interfaces over types for objects
- Use type aliases for unions
- Document complex types

### Type Safety
- Avoid `any` type
- Use type guards
- Implement type assertions
- Validate at runtime

### Generic Types
- Use generics for reusable types
- Constrain generics appropriately
- Provide default type parameters
- Document generic parameters

## See Also

- [Core Types](./core.md)
- [Parameter Types](./parameters.md)
- [Error Types](./errors.md)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)

