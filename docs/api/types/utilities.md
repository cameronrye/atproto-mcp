# Utility Types

Shared helper types exported from `src/types/index.ts`.

This page documents only the utility types the server actually exports. (Branded
identifier types like `DID`/`ATURI` and their validators live on the
[Core Types](./core.md) page; error classes live on the
[Error Types](./errors.md) page.)

## Result

```typescript
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };
```

**Description:** Discriminated union for representing a success or failure
without throwing. Narrow on the `success` field to access `data` or `error`.

**Example:**

```typescript
function parse(value: string): Result<number> {
  const n = Number(value);
  return Number.isNaN(n)
    ? { success: false, error: new Error('not a number') }
    : { success: true, data: n };
}

const result = parse('42');
if (result.success) {
  console.log(result.data); // number
} else {
  console.error(result.error);
}
```

## IPaginatedResponse

```typescript
interface IPaginatedResponse<T> {
  data: T[];
  cursor?: string;
  hasMore: boolean;
}
```

**Description:** Wrapper for cursor-paginated collections.

**Fields:**

- `data` - The page of items.
- `cursor` - Opaque cursor for the next page (absent when there is no next
  page).
- `hasMore` - Whether more items are available.

**Example:**

```typescript
const page: IPaginatedResponse<IAtpPost> = {
  data: posts,
  cursor: 'next_page_cursor',
  hasMore: true,
};
```

::: tip Tool results are JSON text

MCP tools return their results as stringified JSON text content rather than a
guaranteed structured schema. The types on this page describe the server's
internal TypeScript shapes; treat any response JSON in the tool docs as
illustrative.

:::

## IResourceInfo

```typescript
interface IResourceInfo {
  uri: string;
  name: string;
  description: string;
  mimeType?: string;
}
```

**Description:** Metadata describing an MCP resource exposed by the server.

## IPromptTemplate

```typescript
interface IPromptTemplate {
  name: string;
  description: string;
  arguments: Array<{
    name: string;
    description: string;
    required: boolean;
  }>;
}
```

**Description:** Metadata describing an MCP prompt and its arguments.

## See Also

- [Core Types](./core.md)
- [Parameter Types](./parameters.md)
- [Error Types](./errors.md)
