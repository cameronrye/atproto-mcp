# Parameter Types

Tool parameter schemas and interfaces.

::: tip Partial reference

These 16 interfaces are the TypeScript parameter shapes exported from
`src/types/index.ts`. They cover roughly 16 of the server's 51 tools — the
analytics, discovery, media, composite, DM, bookmark, and starter-pack tools
define their input schemas elsewhere and are not listed here.

:::

## Post Operations

### ICreatePostParams

```typescript
interface ICreatePostParams {
  text: string;
  reply?: {
    root: ATURI;
    parent: ATURI;
  };
  embed?: {
    images?: Array<{
      alt: string;
      image: Blob;
    }>;
    external?: {
      uri: string;
      title: string;
      description: string;
    };
  };
  langs?: string[];
}
```

### IReplyToPostParams

```typescript
interface IReplyToPostParams {
  text: string;
  root: ATURI;
  parent: ATURI;
  langs?: string[];
}
```

### ILikePostParams

```typescript
interface ILikePostParams {
  uri: ATURI;
  cid: CID;
}
```

### IUnlikePostParams

```typescript
interface IUnlikePostParams {
  likeUri: ATURI;
}
```

### IRepostParams

```typescript
interface IRepostParams {
  uri: ATURI;
  cid: CID;
  text?: string; // Quote text
}
```

### IUnrepostParams

```typescript
interface IUnrepostParams {
  repostUri: ATURI;
}
```

### IDeletePostParams

```typescript
interface IDeletePostParams {
  uri: ATURI;
}
```

## User Operations

### IFollowUserParams

```typescript
interface IFollowUserParams {
  actor: string; // DID or handle
}
```

### IUnfollowUserParams

```typescript
interface IUnfollowUserParams {
  followUri: ATURI;
}
```

### IGetUserProfileParams

```typescript
interface IGetUserProfileParams {
  actor: string; // DID or handle
}
```

### IUpdateProfileParams

```typescript
interface IUpdateProfileParams {
  displayName?: string;
  description?: string;
  avatar?: Blob;
  banner?: Blob;
}
```

## Data Retrieval

### ISearchPostsParams

```typescript
interface ISearchPostsParams {
  q: string;
  limit?: number;
  cursor?: string;
  sort?: 'top' | 'latest';
  since?: string;
  until?: string;
  mentions?: string;
  author?: string;
  lang?: string;
  domain?: string;
  url?: string;
}
```

### IGetTimelineParams

```typescript
interface IGetTimelineParams {
  algorithm?: string;
  limit?: number;
  cursor?: string;
}
```

### IGetFollowersParams

```typescript
interface IGetFollowersParams {
  actor: string;
  limit?: number;
  cursor?: string;
}
```

### IGetFollowsParams

```typescript
interface IGetFollowsParams {
  actor: string;
  limit?: number;
  cursor?: string;
}
```

### IGetNotificationsParams

```typescript
interface IGetNotificationsParams {
  limit?: number;
  cursor?: string;
  seenAt?: string;
}
```

## Parameter Validation

### Constraints

#### Text Fields

- Post text: 1-300 characters
- Alt text: max 1000 characters
- Display name: max 64 characters
- Description: max 256 characters

#### Numeric Fields

- Limit: 1-100 (default varies by tool)
- Pagination cursor: string

#### Arrays

- Images: max 4 per post (Bluesky platform limit)
- Language codes (`langs`): BCP-47 tags such as `en`, `en-US`, or `pt-BR` — not
  restricted to two-letter codes

### Validation Examples

The snippets below are illustrative. Identifier validation is performed at
runtime by the exported
[`validateATURI` / `validateDID`](./core.md#validators-and-type-guards) helpers,
which throw on invalid input.

```typescript
// Illustrative: post text length check
function validatePostText(text: string): void {
  if (text.length < 1) {
    throw new Error('Post text cannot be empty');
  }
  if (text.length > 300) {
    throw new Error('Post text cannot exceed 300 characters');
  }
}

// Illustrative: actor must be a DID or a handle (contains a dot)
function validateActor(actor: string): void {
  if (!actor) {
    throw new Error('Actor is required');
  }
  if (!actor.startsWith('did:') && !actor.includes('.')) {
    throw new Error('Actor must be a DID or handle');
  }
}

// Prefer the exported validator for AT URIs
import { validateATURI } from './types';
const uri = validateATURI(input); // throws if invalid
```

## Optional vs Required

### Required Parameters

- Always must be provided
- Validation fails if missing
- No default value

### Optional Parameters

- Can be omitted
- May have default values
- Validation only if provided

### Example

```typescript
// Required: text
// Optional: reply, embed, langs
const params: ICreatePostParams = {
  text: 'Hello world!', // Required
  langs: ['en'], // Optional
};
```

## Best Practices

### Parameter Construction

- Validate before passing to tools
- Use TypeScript for type safety
- Provide sensible defaults
- Document constraints

### Error Handling

- Validate early
- Provide clear error messages
- Include field names in errors
- Log validation failures

### Type Safety

- Use interfaces for all parameters
- Don't use `any` types
- Implement type guards
- Use branded types for identifiers

## See Also

- [Core Types](./core.md)
- [Error Types](./errors.md)
- [Tool Documentation](../index)
