# Glama Quality & Maintenance Improvement Plan

> **Status update (2026-06-11):** this plan was executed (shipped as v0.4.0).
> One statement below is now superseded: the plan said the `FirehoseClient` and
> `oauth-client` modules (and the firehose tests) were **kept/retained for
> future work** — the `FirehoseClient`, its tests, and the `ws` dependency have
> since been **removed**. Streaming is no longer planned as tools; any future
> event consumption would be built fresh on Jetstream. File links below that
> point at `src/utils/firehose-client.ts` no longer resolve. The rest of the
> document is preserved as the historical plan.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise the atproto-mcp Glama score from Quality C → A and Maintenance B → A by removing non-functional tools, consolidating redundant tools, completing tool-definition quality (parameter descriptions, output schemas, behavioral docs), and claiming the Glama listing.

**Architecture:** AT Protocol MCP server. Tools are classes extending `BaseTool` ([src/tools/implementations/base-tool.ts](../../../src/tools/implementations/base-tool.ts)) exposing a `schema = { method, description, params? (zod), annotations? }` and an `execute()`. `createTools()` ([src/tools/index.ts](../../../src/tools/index.ts)) registers them; the MCP server advertises them in a custom `tools/list` handler ([src/index.ts:199](../../../src/index.ts#L199)) that converts the zod `params` to JSON Schema via `zodToJsonSchema`. Only a literal `.describe()` on a zod field produces a JSON Schema property `description`.

**Tech Stack:** TypeScript (ESM), zod, zod-to-json-schema, @atproto/api, @modelcontextprotocol/sdk, vitest, pnpm.

---

## Background: what drives the score (verified by audit 2026-06-09)

Glama Quality = **30% Server Coherence + 70% Tool Definition Quality**.

- **Tool Definition Quality (70%, currently C / 3.3-5):** only **8 of 195 params (4.1%)** have `.describe()` → "0% schema description coverage." **0/62** tools mention rate limits, 24/62 mention auth, 26/62 disclose side-effects, 20/62 give usage guidance. No output schemas.
- **Server Coherence (30%, currently C):** tool count 1/5 (62 vs ideal 3–15); 11 verified non-functional tools; redundancy groups; completeness gaps (no actor search, no author feed, no feed creation).
- **Maintenance (B):** no `glama.json` ownership claim (highest-leverage fix); the "0 of 1 issue" metric is stale (repo has zero issues).

### Verified non-functional tools (remove)
- **Streaming (6):** `start_streaming`, `stop_streaming`, `get_streaming_status`, `get_recent_events`, `monitor_keywords`, `track_users` — gated by `FIREHOSE_DECODING_IMPLEMENTED = false` (`src/utils/firehose-client.ts:40`; file since removed entirely); event buffer is always empty (no CAR/DAG-CBOR decoder).
- **OAuth (4):** `start_oauth_flow` (returns unusable URL), `handle_oauth_callback`, `refresh_oauth_tokens`, `revoke_oauth_tokens` (always throw `OAUTH_NOT_IMPLEMENTED`). App-password auth is the working path.
- **`generate_alt_text` (1):** no vision model; returns guidelines, not a description.

The underlying `FirehoseClient` and `oauth-client` modules are **kept** for future implementation; only the tool surface is removed.

---

## Target tool roster (62 → ~40)

| Cluster | Before | After | Action |
|---|---|---|---|
| Streaming | 6 | 0 | **Remove all** (dead) |
| OAuth | 4 | 0 | **Remove all** (dead) |
| Alt text | `generate_alt_text` | 0 | **Remove** (dead) |
| Post creation | `create_post`, `create_rich_text_post`, `create_thread`, `reply_to_post` | `create_post`, `create_thread`, `reply_to_post` | Fold rich-text (`facets` + `quote` embed) into `create_post`; remove `create_rich_text_post` |
| Graph listing | `get_followers`, `get_follows` | `get_user_connections` | Merge via `direction` enum |
| Notifications | `get_notifications`, `get_unread_count`, `mark_notifications_seen` | `get_notifications`, `mark_notifications_seen` | Fold count into `get_notifications` (`countOnly` flag + `unreadCount` in response); remove `get_unread_count` |
| Thread/context | `get_thread`, `get_post_context`, `extract_media_from_post` | `get_post_context` | Merge via `includeThread`/`includeMedia`/`includeAuthor`/`includeEngagement` flags |
| Analytics | `analyze_engagement`, `analyze_network`, `suggest_content_strategy`, `find_influential_users` | `analyze_account`, `find_influential_users` | Merge first 3 via `dimension` enum; keep `find_influential_users` |
| Discovery | `discover_trending`, `recommend_content`, `find_similar_users`, `discover_communities` | `discover` , `find_similar_users`, `discover_communities` | Merge the two timeline-ranking tools into `discover` (`mode: 'trending'\|'recommended'`); keep topic/actor-driven ones distinct (different required inputs) |
| Batch | `batch_follow`, `batch_like`, `batch_repost` | `batch_action` | Merge via `action` enum + `targets[]` (uniform shape) |
| Completeness | — | `search_actors`, `get_author_feed` | **Add** (closes worst gaps) |
| Everything else | unchanged | unchanged | Moderation (7), lists (4), write-pairs (like/unlike/follow/unfollow/repost/unrepost), `get_user_profile`, `get_user_summary`, `get_timeline`, `search_posts`, `delete_post`, `update_profile`, `upload_image`, `upload_video`, `generate_link_preview`, `get_list`, `create_list`, `add_to_list`, `remove_from_list`, `get_custom_feed`, `analyze_image`, `analyze_moderation_status` |

**Net:** 62 − 11 (dead) − 1 (rich-text) − 1 (follows) − 1 (unread) − 2 (thread/media) − 2 (analytics) − 1 (recommend) − 2 (batch) + 2 (new) = **~41 tools**, all functional, single-purpose, well-named.

> **Why not 28?** Reaching 28 requires faceting moderation/lists/write-pairs into action-enum mega-tools. That hides a destructive `block`/`delete` behind the same tool as a benign `mute` (breaks auto-approval gating and the disambiguation rubric) and forces conditional schemas zod can't cleanly validate — lowering the 70%-weighted definition quality. ~40 clean tools models to Quality ≈ 89% (A); over-merging would score worse.

**This is an API-breaking change → major-version bump (0.3.0 → 0.4.0) and CHANGELOG entry.**

---

## Output-schema mechanism (used in Phase 4)

Glama scores the absence of output schemas. The current code deliberately omits them ([src/index.ts:302](../../../src/index.ts#L302)) because the high-level SDK `registerTool` API would force `structuredContent` validation. **But this server advertises tools via a custom low-level `tools/list` handler and builds the `tools/call` response manually** — so adding `outputSchema` to the advertised tool is pure metadata and does **not** trigger SDK validation. This is verified by a test in Phase 4.

Mechanism:
1. Extend the tool schema type to allow `outputSchema?: Record<string, unknown>` (JSON Schema object) in both `IMcpTool` ([src/tools/index.ts](../../../src/tools/index.ts)) and the abstract `schema` in `BaseTool`.
2. In the `tools/list` map ([src/index.ts:205](../../../src/index.ts#L205)), conditionally spread it:
   ```ts
   tools: tools.map(tool => ({
     name: tool.schema.method,
     description: tool.schema.description || '',
     inputSchema: tool.schema.params
       ? this.zodToJsonSchema(tool.schema.params)
       : { type: 'object', properties: {} },
     ...(tool.schema.outputSchema ? { outputSchema: tool.schema.outputSchema } : {}),
     annotations: computeToolAnnotations(tool.schema.method, tool.schema.annotations),
   })),
   ```
3. Each tool declares an `outputSchema` matching its documented `returnShape` (the audit recorded every tool's exact return shape).

---

## Phase 0 — Maintenance quick wins (non-breaking, independent)

### Task 0.1: Add `glama.json` ownership-claim file

**Files:** Create `glama.json` (repo root)

> Verified against the live schema [glama.ai/mcp/schemas/server.json](https://glama.ai/mcp/schemas/server.json): the ONLY supported fields are `$schema` and `maintainers` (array of GitHub usernames). Categories / related servers / description are **not** file fields — they are set on the Glama web dashboard *after* the claim. This file is what unlocks the claim.

- [ ] **Step 1: Create the file**
  ```json
  {
    "$schema": "https://glama.ai/mcp/schemas/server.json",
    "maintainers": ["cameronrye"]
  }
  ```
- [ ] **Step 2: Validate it is well-formed JSON**
  Run: `node -e "JSON.parse(require('fs').readFileSync('glama.json','utf8'))"`
  Expected: no output, exit 0.
- [ ] **Step 3: Commit**
  ```bash
  git add glama.json
  git commit -m "chore: add glama.json to claim the Glama server listing"
  ```

**MANUAL FOLLOW-UP (owner, not automatable):** after this lands on the default branch, go to the Glama profile → claim the listing (verifies `maintainers` against your GitHub identity) → set category **Social Media**, the description, and the related servers: `@brianellin/bsky-mcp-server`, `berlinbra/bluesky-mcp`, `keturiosakys/bluesky-context-server`, `morinokami/mcp-server-bluesky`, `semioz/bluesky-mcp`, `gwbischof/bluesky-social-mcp`. Then seed usage via "Try in Browser" (the server supports unauthenticated public-data mode, so it runs with no creds).

### Task 0.2: Add PR template

**Files:** Create `.github/PULL_REQUEST_TEMPLATE.md`

- [ ] **Step 1: Create a concise template** (match the existing `.github/ISSUE_TEMPLATE` tone — check it first) with sections: Summary, Related issue, Type of change, Checklist (tests pass, docs updated, no breaking changes / documented).
- [ ] **Step 2: Commit**
  ```bash
  git add .github/PULL_REQUEST_TEMPLATE.md
  git commit -m "chore: add pull request template"
  ```

---

## Phase 1 — Remove the 11 non-functional tools (breaking)

**Files:**
- Modify: `src/tools/index.ts` (remove imports + factory entries)
- Modify: `src/tools/implementations/index.ts` (remove exports)
- Delete: `src/tools/implementations/oauth-tools.ts`, `streaming-tools.ts`, `generate-alt-text-tool.ts`
- Delete corresponding tests: `src/__tests__/streaming-intelligence.test.ts` and any oauth/alt-text tool tests (keep `src/utils/__tests__/firehose-*.test.ts` and `oauth-client` tests — the underlying clients stay)
- Modify: tests asserting tool counts / availability (`src/__tests__/read-only-tool-availability.test.ts`, `tool-dispatch.test.ts`, `mcp-integration.test.ts`, `index.test.ts`)

- [ ] **Step 1: Identify every reference**
  Run: `grep -rln "OAuthTool\|StreamingTool\|GenerateAltText\|start_oauth\|start_streaming\|monitor_keywords\|track_users\|get_recent_events\|generate_alt_text\|get_streaming_status\|stop_streaming\|handle_oauth\|refresh_oauth\|revoke_oauth" src/`
- [ ] **Step 2: Remove the tool classes** — delete the 3 implementation files and their exports in `implementations/index.ts`; remove the 11 imports + 11 factory entries in `src/tools/index.ts` (the `// OAuth authentication`, `// Real-time streaming`, and the `generate_alt_text` line under `// Enhanced media support`).
- [ ] **Step 3: Update/remove tests** — delete tool-level streaming/oauth/alt-text tests; update any test asserting a specific total tool count to the new count. Keep `firehose-client`/`oauth-client` unit tests (clients remain).
- [ ] **Step 4: Verify the gate is documented** — confirm README/docs no longer advertise these as working (handled in Phase 5).
- [ ] **Step 5: Build + test**
  Run: `pnpm run type-check && pnpm test`
  Expected: PASS (no dangling imports, counts updated).
- [ ] **Step 6: Commit**
  ```bash
  git add -A
  git commit -m "feat!: remove non-functional OAuth, streaming, and alt-text tools

  These tools always failed when invoked (firehose decoding and OAuth token
  exchange are unimplemented; alt-text has no vision model). The underlying
  FirehoseClient and oauth-client modules are retained for future work. App-password
  auth remains the supported authentication path."
  ```

---

## Phase 2 — Consolidate redundancy clusters (breaking)

Each task: read the current implementations named in the table, design the merged tool to be a **superset** preserving all real behavior, write tests for the new surface (including the old behaviors now reachable via flags/enums), implement, verify, commit. Every new/merged tool gets full `.describe()` on every param and a complete `outputSchema` and a description covering auth + side-effects + rate-limit note + usage guidance **as it is written** (so Phase 4 has nothing to backfill for these).

> **Shared description conventions** (apply to every tool touched):
> - Auth: prefix or suffix with `Requires authentication (app password).` for PRIVATE tools; `Works without auth; richer with auth.` for ENHANCED.
> - Rate limits: end every description with `Subject to per-tool rate limiting.`
> - Side-effects: destructive/write tools state the effect and irreversibility, e.g. `This permanently deletes the record and cannot be undone.`
> - Usage guidance: one sentence on when to use this vs the nearest sibling.

### Task 2.1: `create_post` absorbs rich-text; remove `create_rich_text_post`

**Files:** Modify `src/tools/implementations/create-post-tool.ts`; remove `CreateRichTextPostTool` (in `media-tools.ts` or its own file — locate via grep); update `implementations/index.ts`, `src/tools/index.ts`, tests (`write-tools.test.ts`, `rich-text-facets.test.ts`, `quote-post-facets.test.ts`).

- [ ] **Step 1:** Read `create-post-tool.ts` and the current `CreateRichTextPostTool`. Identify the deltas rich-text adds: caller-supplied byte-range `facets` and a `record` (quote) embed.
- [ ] **Step 2: Extend `CreatePostSchema`** with two optional, fully-described fields:
  ```ts
  facets: z
    .array(/* existing facet shape from CreateRichTextPostTool */)
    .optional()
    .describe('Optional explicit richtext facets (byte-range annotations for mentions, links, and tags). Omit to let the server auto-detect facets from the text.'),
  quote: z
    .object({
      uri: z.string().min(1).describe('AT-URI of the post to quote.'),
      cid: z.string().min(1).describe('CID of the quoted post (content hash).'),
    })
    .optional()
    .describe('Quote-post another post by embedding it. Mutually exclusive with the images/external embed.'),
  ```
  Reconcile the embed union: a post is images OR external OR record(quote) — extend the existing both-images-and-external guard to also reject quote+images/external.
- [ ] **Step 3:** Add `.describe()` to every existing `CreatePostSchema` field (`text`, `reply.root`, `reply.parent`, `embed.images.alt`, `embed.images.image`, `embed.external.uri/title/description`, `langs`).
- [ ] **Step 4:** When `facets` provided, pass through instead of `buildRichText` auto-detection; when `quote` provided, build `app.bsky.embed.record`.
- [ ] **Step 5:** Add `outputSchema` for `{uri, cid, success, message}`.
- [ ] **Step 6:** Remove `CreateRichTextPostTool` + export + factory entry. Migrate its tests onto `create_post`.
- [ ] **Step 7:** `pnpm run type-check && pnpm test` → PASS. Commit `feat!: fold rich-text/quote support into create_post; remove create_rich_text_post`.

### Task 2.2: `get_user_connections` replaces `get_followers` + `get_follows`

**Files:** Modify `src/tools/implementations/social-graph-tools.ts`; update `implementations/index.ts`, `src/tools/index.ts`, `social-graph.test.ts`.

- [ ] **Step 1:** Read both tools (identical shape: `actor`, `limit`, `cursor`; differ only in `getFollowers` vs `getFollows`).
- [ ] **Step 2:** Create `GetUserConnectionsTool` (`get_user_connections`) with schema:
  ```ts
  z.object({
    actor: z.string().min(1).describe('Handle (e.g. alice.bsky.social) or DID of the account whose connections to list.'),
    direction: z.enum(['followers', 'follows']).describe("Which side of the follow graph to return: 'followers' = accounts following the actor; 'follows' = accounts the actor follows."),
    limit: z.number().int().min(1).max(100).optional().describe('Max accounts to return per page (1–100, default 50).'),
    cursor: z.string().optional().describe('Pagination cursor from a previous response; omit for the first page.'),
  })
  ```
  Dispatch on `direction`. ENHANCED auth mode.
- [ ] **Step 3:** `outputSchema` for `{success, subjectActor, direction, connections[], cursor?}`.
- [ ] **Step 4:** Remove the two old tools; map old tests onto the new one with both `direction` values.
- [ ] **Step 5:** Verify + commit `feat!: merge get_followers/get_follows into get_user_connections`.

### Task 2.3: Fold unread count into `get_notifications`; remove `get_unread_count`

**Files:** Modify the notifications tools (locate via grep `GetNotificationsTool`); update registration + `notification-tools.test.ts`.

- [ ] **Step 1:** Add to `get_notifications` schema: `countOnly: z.boolean().optional().describe('When true, return only the unread count and skip fetching the notification list (cheap badge-number path).')`. Add `.describe()` to existing `limit`, `cursor`, and any `priority` field.
- [ ] **Step 2:** Always include `unreadCount` in the response (via `getUnreadCount` or `seenAt` logic already present). When `countOnly`, short-circuit and return `{success, unreadCount}`.
- [ ] **Step 3:** `outputSchema` covering both shapes (`unreadCount` always; `notifications[]` + `cursor?` when not countOnly).
- [ ] **Step 4:** Remove `GetUnreadCountTool` + registration; migrate its test.
- [ ] **Step 5:** Verify + commit `feat!: fold get_unread_count into get_notifications (countOnly)`.

### Task 2.4: `get_post_context` absorbs `get_thread` + `extract_media_from_post`

**Files:** Modify `composite-tools.ts` (`GetPostContextTool`); remove `GetThreadTool` (`advanced-social-tools.ts`) and `ExtractMediaFromPostTool` (`rich-media-tools.ts`); update registration + `post-context-thread.test.ts`, `media-tools.test.ts`.

- [ ] **Step 1:** Read all three (all call `agent.getPostThread`). `get_post_context` is already the superset (author + engagement + parent chain).
- [ ] **Step 2:** Add include-flags to `get_post_context` schema, all described and defaulting sensibly:
  ```ts
  uri: z.string().min(1).describe('AT-URI of the post to fetch context for.'),
  depth: z.number().int().min(0).max(10).optional().describe('How many levels of replies to include (0–10, default 6).'),
  includeThread: z.boolean().optional().describe('Include the reply tree (default true).'),
  includeParents: z.boolean().optional().describe('Walk and include the full parent chain up to the root (default true).'),
  includeMedia: z.boolean().optional().describe('Extract and include media embeds (images/video/external) from the post (default false).'),
  includeAuthor: z.boolean().optional().describe('Include the author profile (default true).'),
  includeEngagement: z.boolean().optional().describe('Include like/repost/reply counts (default true).'),
  ```
- [ ] **Step 3:** Implement `includeMedia` by reusing the extract logic; gate the existing author/engagement sections behind their flags.
- [ ] **Step 4:** `outputSchema` with the conditional sections documented.
- [ ] **Step 5:** Remove `get_thread` + `extract_media_from_post`; migrate tests.
- [ ] **Step 6:** Verify + commit `feat!: merge get_thread and extract_media_from_post into get_post_context`.

### Task 2.5: `analyze_account` replaces `analyze_engagement` + `analyze_network` + `suggest_content_strategy`

**Files:** Modify `analytics-tools.ts` + `analyze-engagement-tool.ts`; update registration + analytics tests.

- [ ] **Step 1:** Read the three tools; note they all sample `getAuthorFeed`/`getProfile`/`getFollowers` and emit a scored list + `insights[]`.
- [ ] **Step 2:** Create `AnalyzeAccountTool` (`analyze_account`):
  ```ts
  z.object({
    actor: z.string().min(1).describe('Handle or DID of the account to analyze.'),
    dimension: z.enum(['engagement', 'network', 'strategy']).describe("Which analysis to run: 'engagement' = post performance over recent posts; 'network' = follower/following graph health; 'strategy' = posting recommendations."),
    limit: z.number().int().min(1).max(100).optional().describe('How many recent posts to sample (1–100, default 50).'),
  })
  ```
  Route to the appropriate existing logic by `dimension`.
- [ ] **Step 3:** `outputSchema` documenting the `{success, dimension, metrics, insights[]}` envelope.
- [ ] **Step 4:** Keep `find_influential_users` (topic/search-driven — distinct). Remove the three merged tools; migrate tests.
- [ ] **Step 5:** Verify + commit `feat!: merge engagement/network/strategy analytics into analyze_account`.

### Task 2.6: `discover` merges the two timeline-ranking discovery tools

**Files:** Modify `content-discovery-tools.ts` + `discover-trending-tool.ts`; update registration + discovery tests.

- [ ] **Step 1:** Read `discover_trending` and `recommend_content` (both rank the caller's timeline). Keep `find_similar_users` (actor-driven) and `discover_communities` (topic-driven) **as separate tools** — their required inputs differ, so a mode-enum would weaken validation.
- [ ] **Step 2:** Create `DiscoverTool` (`discover`):
  ```ts
  z.object({
    mode: z.enum(['trending', 'recommended']).describe("What to surface from your timeline: 'trending' = trending topics/hashtags; 'recommended' = posts you're likely to engage with."),
    limit: z.number().int().min(1).max(100).optional().describe('How many items to return (1–100, default 25).'),
  })
  ```
- [ ] **Step 3:** `outputSchema`; remove the two merged tools; sharpen `find_similar_users`/`discover_communities` descriptions to state their distinct input axis (actor vs topic). Migrate tests.
- [ ] **Step 4:** Verify + commit `feat!: merge discover_trending/recommend_content into discover`.

### Task 2.7: `batch_action` replaces `batch_follow` + `batch_like` + `batch_repost`

**Files:** Modify `batch-operations-tools.ts`; update registration + `batch-operations.test.ts`, `batch-roundtrip.test.ts`.

- [ ] **Step 1:** Read the three (uniform shape: an array of targets, partial-failure reporting).
- [ ] **Step 2:** Create `BatchActionTool` (`batch_action`):
  ```ts
  z.object({
    action: z.enum(['follow', 'like', 'repost']).describe('The action to apply to every target.'),
    targets: z.array(z.string().min(1)).min(1).max(100).describe('For action=follow: handles or DIDs. For action=like/repost: post AT-URIs. 1–100 items.'),
  })
  ```
  Route by `action`. Preserve per-item success/failure reporting and idempotency handling.
- [ ] **Step 3:** `outputSchema` for `{success, action, results[]:{target, success, error?}, summary:{succeeded, failed}}`.
- [ ] **Step 4:** Remove the three old tools; migrate tests (cover each action + partial failure).
- [ ] **Step 5:** Verify + commit `feat!: merge batch_follow/like/repost into batch_action`.

---

## Phase 3 — Add completeness tools (non-breaking additions)

### Task 3.1: `search_actors` (find accounts by handle/name)

**Files:** Create `src/tools/implementations/search-actors-tool.ts`; export + register; create `src/__tests__/search-actors.test.ts`.

- [ ] **Step 1: Write the failing test** — mock `agent.app.bsky.actor.searchActors`, assert the tool maps results to `{did, handle, displayName?, description?, avatar?}[]` and passes `q`, `limit`, `cursor`.
- [ ] **Step 2:** Run it → FAIL (tool not defined).
- [ ] **Step 3: Implement** `SearchActorsTool` (`search_actors`), ENHANCED auth:
  ```ts
  z.object({
    query: z.string().min(1).describe('Search term matched against handle and display name (e.g. "alice" or "Alice Smith").'),
    limit: z.number().int().min(1).max(100).optional().describe('Max accounts to return (1–100, default 25).'),
    cursor: z.string().optional().describe('Pagination cursor from a previous response.'),
  })
  ```
  Description: `Search for accounts by handle or display name. Use this when you know a name but not the exact handle/DID; use get_user_profile when you already have the handle/DID. Works without auth; richer with auth. Subject to per-tool rate limiting.` Add `outputSchema`.
- [ ] **Step 4:** Run test → PASS.
- [ ] **Step 5:** Commit `feat: add search_actors tool (find accounts by handle/name)`.

### Task 3.2: `get_author_feed` (list a specific user's posts)

**Files:** Create `src/tools/implementations/get-author-feed-tool.ts`; export + register; create `src/__tests__/get-author-feed.test.ts`.

- [ ] **Step 1: Write the failing test** — mock `agent.app.bsky.feed.getAuthorFeed`, assert mapping of posts (`uri, cid, author, text, createdAt, counts, isLiked, isReposted`) and pass-through of `actor`, `limit`, `cursor`, `filter`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement** `GetAuthorFeedTool` (`get_author_feed`), ENHANCED auth:
  ```ts
  z.object({
    actor: z.string().min(1).describe('Handle or DID of the account whose posts to list.'),
    limit: z.number().int().min(1).max(100).optional().describe('Max posts to return per page (1–100, default 50).'),
    cursor: z.string().optional().describe('Pagination cursor from a previous response.'),
    filter: z.enum(['posts_with_replies', 'posts_no_replies', 'posts_with_media', 'posts_and_author_threads']).optional().describe('Which of the author’s posts to include (default posts_with_replies).'),
  })
  ```
  Description distinguishes it from `get_timeline` (home feed) and `search_posts` (query-based). Add `outputSchema`.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: add get_author_feed tool (list a user's posts)`.

---

## Phase 4 — Tool-definition quality pass across the final roster

Apply to **every remaining tool not already completed in Phases 2–3**. The audit recorded, per tool: the exact `missingDescribeFields` list, the `returnShape`, and which `descMentions*` are false. Use it as the worklist.

### Task 4.0: Wire `outputSchema` through the server

**Files:** Modify `src/tools/index.ts` (`IMcpTool` interface), `src/tools/implementations/base-tool.ts` (abstract `schema` type), `src/index.ts` (tools/list map), `src/__tests__/mcp-integration.test.ts`.

- [ ] **Step 1: Write a failing test** in `mcp-integration.test.ts`: call the `tools/list` handler and assert that a tool declaring `outputSchema` advertises it, AND that a `tools/call` on that tool still succeeds (proving no SDK structuredContent validation is triggered).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Add `outputSchema?: Record<string, unknown>` to `IMcpTool['schema']` and the `BaseTool` abstract `schema`; add the conditional spread to the tools/list map (see "Output-schema mechanism" above).
- [ ] **Step 4:** Run → PASS. Commit `feat: advertise per-tool outputSchema in tools/list`.

### Task 4.1 … 4.N: Per-file definition pass (one task per remaining implementation file)

For **each** file in `src/tools/implementations/` not already finished:

- [ ] **Step 1:** For every tool in the file, add `.describe()` to **every** zod param field (use the audit's `missingDescribeFields` for that tool as the checklist; descriptions state syntax/constraints/defaults — e.g. for `actor`: `'Handle (alice.bsky.social) or DID of the target account.'`).
- [ ] **Step 2:** Add an `outputSchema` to `tool.schema` matching the audit's recorded `returnShape`.
- [ ] **Step 3:** Rewrite the `description` to cover, per the shared conventions: auth requirement, side-effects/destructiveness, the rate-limit note, and one usage-guidance sentence vs the nearest sibling tool.
- [ ] **Step 4:** Run `pnpm run type-check && pnpm test` → PASS.
- [ ] **Step 5:** Commit `docs(tools): complete <file> parameter/output schemas and behavioral descriptions`.

**Worked example — `create-post-tool.ts` (`text` field):**
```ts
text: z
  .string()
  .min(1, 'Post text cannot be empty')
  .max(3000, 'Post text is too long (limit is 300 graphemes / 3000 bytes)')
  .describe('The post body. Max 300 graphemes / 3000 bytes (emoji count as one grapheme). Mentions (@handle), links, and #hashtags are auto-detected into richtext facets unless you supply `facets` explicitly.'),
```

**Coverage gate (final step of Phase 4):**
- [ ] **Step:** Run a coverage check and assert 100% described params:
  ```bash
  pnpm run type-check && pnpm test
  ```
  Then a quick audit: `grep -rcE "\\.describe\\(" src/tools/implementations | sort` and manually confirm each tool's param count matches its describe count (or add a unit test in `schema-conversion.test.ts` that walks every tool's `inputSchema.properties` and asserts every property has a non-empty `description`). Prefer the automated test:
  ```ts
  // schema-conversion.test.ts
  it('every tool param has a description', () => {
    for (const tool of createTools(mockClient)) {
      const schema = toJsonSchema(tool); // via the server's zodToJsonSchema
      for (const [name, prop] of Object.entries(schema.properties ?? {})) {
        expect(prop.description, `${tool.schema.method}.${name}`).toBeTruthy();
      }
    }
  });
  ```
- [ ] **Commit** the coverage test.

---

## Phase 5 — Docs, README, version

### Task 5.1: README + docs alignment

**Files:** `README.md`, `docs/**` (VitePress), `CHANGELOG.md`.

- [ ] **Step 1:** Replace the "60 MCP tools" headline with the accurate new count (~41) and regenerate any tool list/table in README and docs. Remove streaming/OAuth from "features" or clearly mark them as planned/experimental (not shipped).
- [ ] **Step 2:** Add a prominent zero-config launch line near the top: `npx atproto-mcp` (unauthenticated public-data mode), plus a Claude Desktop `mcpServers` config snippet — improves Glama profile completeness and "Try in Browser".
- [ ] **Step 3:** Update `CHANGELOG.md` with the breaking changes (removed tools, merged tools with old→new mapping, new tools).
- [ ] **Step 4:** When editing VitePress `:::` containers, blank-pad them so the commit hook's prettier doesn't corrupt them (project convention).
- [ ] **Step 5:** Commit `docs: align README/docs with the consolidated tool roster`.

### Task 5.2: Version bump

**Files:** `package.json`.

- [ ] **Step 1:** Bump `version` `0.3.0` → `0.4.0` (breaking API change).
- [ ] **Step 2:** Commit `chore: bump version to 0.4.0`.

> **Publish note (per repo memory):** npm publish is the **Manual Publish** workflow_dispatch (OIDC trusted publishing), NOT tag-push. Do not rely on a tag to trigger a release.

---

## Verification gates (run at every phase boundary)

```bash
pnpm run lint && pnpm run format:check && pnpm run type-check && pnpm test && pnpm run build
```
(equivalent to `pnpm run check && pnpm run build`). All must pass before moving to the next phase.

---

## Self-Review

- **Spec coverage:** Quality levers — param descriptions (Phase 4), output schemas (4.0 + per-file), behavioral/usage descriptions (Phase 2 conventions + Phase 4), tool-count/redundancy (Phases 1–2), completeness gaps (Phase 3). Maintenance — glama.json + claim (0.1), PR template (0.2), README count alignment (5.1). ✓ All audit findings mapped.
- **Type consistency:** new tool methods used consistently — `get_user_connections`, `analyze_account`, `discover`, `batch_action`, `search_actors`, `get_author_feed`; `outputSchema?: Record<string, unknown>` added in both `IMcpTool` and `BaseTool`. ✓
- **Known soft spots (acceptable):** `discover` mode-enum keeps params uniform (both modes take only `limit`) so validation isn't weakened; `find_similar_users`/`discover_communities` deliberately NOT merged to preserve clean required-input validation. The `~41` count (not 28) is intentional and justified above.
- **Out of scope (documented, not done):** implementing real firehose decoding / OAuth token exchange (feature builds, not score fixes); the Glama web-dashboard claim steps (manual owner action).
```
