# Agent System Audit — Domiron Social Dashboard

> **Date:** 2026-04-01  
> **Auditor:** Claude Code (claude-sonnet-4-6)  
> **Branch:** `main` — commit `757814f`  
> **Method:** Every source file read and traced. No assumptions made.

---

# 1. Project Overview

## What the system is supposed to do

The Domiron Dashboard is a web-based control panel for managing social media content on behalf of the game **Domiron**. The intended full workflow is:

1. An admin creates a **content request** (specifying platform, content type, theme, and instructions).
2. An **external AI agent** (not in this repo) reads the open request and submits a drafted post via a REST API.
3. The admin reviews the draft in the dashboard, then approves, requests a revision, or rejects it.
4. An approved draft becomes a **publish job** in a queue.
5. The system publishes the post to **Facebook** and/or **Instagram** via the Meta Graph API.

## Main flows (user → post → social media)

```
Admin creates request
        ↓
External agent calls POST /api/agent/intake
        ↓
Draft appears in dashboard for review
        ↓
Admin approves → PublishJob created (status: QUEUED)
        ↓
[MISSING: actual publish call to Meta Graph API]
        ↓
Admin manually clicks "Mark Published" (just a DB update, no real post sent)
```

**The chain breaks at the publish step. Nothing is ever posted to social media.**

## What "Agent" means in this system (based on code, not assumptions)

Based purely on the code:

- "Agent" refers to an **external system** that is NOT part of this repository.
- The only agent-related code in this repo is a single API endpoint: `POST /api/agent/intake`.
- That endpoint accepts a draft payload from the external agent (authenticated via `X-Agent-Key` header) and stores it in the database.
- There is no AI logic, no scheduler, no automation loop, and no decision engine inside this codebase.
- The dashboard is a **receiver and review UI** for whatever the external agent produces.

---

# 2. Architecture

## Frontend

### Pages (all routes)

| Route | File | Purpose |
|---|---|---|
| `/` | `src/app/page.tsx` | Redirect: logged in → `/requests`, logged out → `/login` |
| `/login` | `src/app/(auth)/login/page.tsx` | Credentials login form (NextAuth) |
| `/requests` | `src/app/(dashboard)/requests/page.tsx` | List all content requests |
| `/requests/new` | `src/app/(dashboard)/requests/new/page.tsx` | Create new content request |
| `/drafts` | `src/app/(dashboard)/drafts/page.tsx` | Grid view of all drafts |
| `/drafts/[id]` | `src/app/(dashboard)/drafts/[id]/page.tsx` | Full draft review: approve / reject / revision |
| `/queue` | `src/app/(dashboard)/queue/page.tsx` | Publish queue table with "Mark Published" |
| `/settings` | `src/app/(dashboard)/settings/page.tsx` | Meta OAuth connect/disconnect |

### Main components

| Component | File | Role |
|---|---|---|
| `Sidebar` | `components/layout/sidebar.tsx` | Fixed RTL navigation bar, logout |
| `Topbar` | `components/layout/topbar.tsx` | Page header + optional "New Request" button |
| `RequestForm` | `components/requests/request-form.tsx` | Create content request (React Hook Form + Zod) |
| `RequestsTable` | `components/requests/requests-table.tsx` | Table with delete action |
| `DraftCard` | `components/drafts/draft-card.tsx` | Summary card in the drafts grid |
| `DraftContentPanel` | `components/drafts/draft-content-panel.tsx` | Read-only display of all draft fields |
| `DraftMetaPanel` | `components/drafts/draft-meta-panel.tsx` | Request metadata + Approve / Reject / Revision buttons |
| `RevisionNotesInput` | `components/drafts/revision-notes-input.tsx` | Textarea input for notes on reject/revision |
| `QueueTable` | `components/queue/queue-table.tsx` | Publish job rows + "Mark Published" button |
| `EmptyState` | `components/shared/empty-state.tsx` | Empty list placeholder |
| `LoadingSkeleton` | `components/shared/loading-skeleton.tsx` | Table and grid skeleton loaders |
| `ConfirmDialog` | `components/shared/confirm-dialog.tsx` | Modal confirmation dialog |
| `StatusBadge` | `components/shared/status-badge.tsx` | Colored chips for all status types |

### State management

**No global state store.** All state is either:

- **Server state:** Managed by TanStack React Query (`@tanstack/react-query`) through 4 custom hooks:
  - `use-requests.ts` — query key `["requests"]`
  - `use-drafts.ts` — query keys `["drafts"]` and `["drafts", id]`
  - `use-publish-jobs.ts` — query key `["publish-jobs"]`
  - `use-meta-connections.ts` — query key `["meta-connections"]`
- **Local UI state:** `useState` in individual components (confirmation dialog targets, action modes, approved banner flag)

Default stale time: **60 seconds** (set in `QueryProvider`).

### Data flow

```
Component mounts
     ↓
React Query hook fires fetch() to internal Next.js API route
     ↓
API route authenticates session → queries Prisma → returns JSON
     ↓
React Query caches response; component renders data
     ↓
User action (e.g. approve) → useMutation → POST to API route
     ↓
API route runs Prisma transaction → returns result
     ↓
onSuccess: queryClient.invalidateQueries → re-fetch → UI updates
```

---

## Backend

### API routes — FULL list

| Route | Method(s) | File | Used by UI? |
|---|---|---|---|
| `/api/auth/[...nextauth]` | GET, POST | `api/auth/[...nextauth]/route.ts` | Yes (login/logout) |
| `/api/requests` | GET | `api/requests/route.ts` | Yes (`useRequests`) |
| `/api/requests` | POST | `api/requests/route.ts` | Yes (`useCreateRequest`) |
| `/api/requests/[id]` | GET | `api/requests/[id]/route.ts` | Not directly — no hook calls this |
| `/api/requests/[id]` | PATCH | `api/requests/[id]/route.ts` | Not used by any hook or component |
| `/api/requests/[id]` | DELETE | `api/requests/[id]/route.ts` | Yes (`useDeleteRequest`) |
| `/api/drafts` | GET | `api/drafts/route.ts` | Yes (`useDrafts`) |
| `/api/drafts` | POST | `api/drafts/route.ts` | **No UI uses this** |
| `/api/drafts/[id]` | GET | `api/drafts/[id]/route.ts` | Yes (`useDraft(id)`) |
| `/api/drafts/[id]` | PATCH | `api/drafts/[id]/route.ts` | **No UI uses this** |
| `/api/drafts/[id]/approve` | POST | `api/drafts/[id]/approve/route.ts` | Yes (`useApproveDraft`) |
| `/api/drafts/[id]/reject` | POST | `api/drafts/[id]/reject/route.ts` | Yes (`useRejectDraft`) |
| `/api/drafts/[id]/request-revision` | POST | `api/drafts/[id]/request-revision/route.ts` | Yes (`useRequestRevision`) |
| `/api/publish-jobs` | GET | `api/publish-jobs/route.ts` | Yes (`usePublishJobs`) |
| `/api/publish-jobs/[id]/mark-published` | POST | `api/publish-jobs/[id]/mark-published/route.ts` | Yes (`useMarkPublished`) |
| `/api/agent/intake` | POST | `api/agent/intake/route.ts` | External agent only |
| `/api/meta/auth-url` | GET | `api/meta/auth-url/route.ts` | Yes (Settings page) |
| `/api/meta/callback` | GET | `api/meta/callback/route.ts` | Called by Facebook redirect |
| `/api/meta/connections` | GET | `api/meta/connections/route.ts` | Yes (`useMetaConnections`) |
| `/api/meta/connections/[id]` | DELETE | `api/meta/connections/[id]/route.ts` | Yes (`useDisconnectMeta`) |

### What each endpoint does

**`GET /api/requests`**  
Returns all `ContentRequest` records ordered by creation date, including each request's `draft.id` and `draft.status` (if a draft exists). Requires session.

**`POST /api/requests`**  
Validates body with `requestSchema` (Zod), creates a new `ContentRequest` with status `NEW`. Requires session.

**`GET /api/requests/[id]`**  
Returns a single request including its full draft object. Requires session. **Not called by any hook or UI component — dead route from UI perspective.**

**`PATCH /api/requests/[id]`**  
Validates body with `patchRequestSchema`, updates request fields. Requires session. **No UI calls this.**

**`DELETE /api/requests/[id]`**  
Deletes a request only if its `status === "NEW"`. Returns 400 if not NEW. Requires session.

**`GET /api/drafts`**  
Returns all drafts with nested request summary (id, title, platform, contentType, sequenceDay). Ordered by creation date desc. Requires session.

**`POST /api/drafts`**  
Creates a draft from a form payload (uses `draftSchema`). Runs a transaction: creates draft, updates request status to `DRAFT_READY`, creates `DraftRevision`. Requires session. **No UI form calls this — only the agent intake creates drafts in practice.**

**`GET /api/drafts/[id]`**  
Returns a single draft with its full request and publishJob. Requires session.

**`PATCH /api/drafts/[id]`**  
Updates draft fields. Increments version. Sets status to `EDITED`. Creates a `DraftRevision` with `changedBy: ADMIN`. Requires session. **No UI uses this — draft editing from the admin side is not implemented.**

**`POST /api/drafts/[id]/approve`**  
Allows approval only if draft is `PENDING_REVIEW` or `EDITED`. Runs a transaction: sets draft to `APPROVED`, sets request to `COMPLETED`, creates a `PublishJob` (status: `QUEUED`, method: `MANUAL`), creates a `DraftRevision`. Requires session.

**`POST /api/drafts/[id]/reject`**  
Sets draft to `REJECTED`, sets request to `CANCELLED`. Optional rejection note. Requires session.

**`POST /api/drafts/[id]/request-revision`**  
Required note (min 10 chars). Sets draft to `REVISION_NEEDED`, sets request to `REVISION_NEEDED`. Requires session.

**`GET /api/publish-jobs`**  
Returns all publish jobs with nested draft (id, hook, format) and nested request (title, platform, contentType). Ordered by creation date desc. Requires session.

**`POST /api/publish-jobs/[id]/mark-published`**  
Only works if job status is `QUEUED` or `SCHEDULED`. Sets status to `PUBLISHED`, sets `publishedAt = now()`, sets `publishMethod = MANUAL`. **Does NOT call any external API. Does not post anything to Facebook or Instagram.**

**`POST /api/agent/intake`**  
Authenticated by `X-Agent-Key` header only (no session required). Accepts draft payload in snake_case. Validates with `intakeSchema`. Runs transaction: creates Draft + updates ContentRequest + creates DraftRevision. Returns 201 with draft.

**`GET /api/meta/auth-url`**  
Returns a Facebook OAuth login URL with scopes: `pages_manage_posts`, `pages_read_engagement`, `pages_show_list`, `instagram_business_content_publish`. Requires session.

**`GET /api/meta/callback`**  
OAuth callback from Facebook. Exchanges code for short-lived token → long-lived token (60 days). Fetches managed pages. For each page: upserts `MetaConnection` (FACEBOOK). For each page: checks for linked Instagram business account, upserts `MetaConnection` (INSTAGRAM). Redirects to `/settings` with success or error query param.

**`GET /api/meta/connections`**  
Returns all active MetaConnections. Excludes `encryptedToken` from response. Requires session.

**`DELETE /api/meta/connections/[id]`**  
Sets `isActive = false` on the connection. Does NOT call Meta's token revocation API. Does NOT delete the record. Requires session.

---

# 3. API Integration Status

## All API calls in the system

### Internal API calls (frontend → backend)

| Endpoint | Method | Called From | Expected Response | Status |
|---|---|---|---|---|
| `/api/requests` | GET | `use-requests.ts → useRequests()` | `{ data: RequestWithDraft[] }` | ✅ Working |
| `/api/requests` | POST | `use-requests.ts → useCreateRequest()` | `{ data: ContentRequest }` | ✅ Working |
| `/api/requests/[id]` | DELETE | `use-requests.ts → useDeleteRequest()` | `{ data: ContentRequest }` | ✅ Working |
| `/api/requests/[id]` | GET | Not called by any hook | N/A | ⚠️ Not connected |
| `/api/requests/[id]` | PATCH | Not called by any hook | N/A | ⚠️ Not connected |
| `/api/drafts` | GET | `use-drafts.ts → useDrafts()` | `{ data: DraftForList[] }` | ✅ Working |
| `/api/drafts` | POST | Not called by any hook/component | N/A | ⚠️ Not connected (dead) |
| `/api/drafts/[id]` | GET | `use-drafts.ts → useDraft(id)` | `{ data: DraftFull }` | ✅ Working |
| `/api/drafts/[id]` | PATCH | Not called by any hook/component | N/A | ⚠️ Not connected (dead) |
| `/api/drafts/[id]/approve` | POST | `use-drafts.ts → useApproveDraft()` | `{ data: { draft, publishJob } }` | ✅ Working |
| `/api/drafts/[id]/reject` | POST | `use-drafts.ts → useRejectDraft()` | `{ data: Draft }` | ✅ Working |
| `/api/drafts/[id]/request-revision` | POST | `use-drafts.ts → useRequestRevision()` | `{ data: Draft }` | ✅ Working |
| `/api/publish-jobs` | GET | `use-publish-jobs.ts → usePublishJobs()` | `{ data: PublishJobWithDraft[] }` | ✅ Working |
| `/api/publish-jobs/[id]/mark-published` | POST | `use-publish-jobs.ts → useMarkPublished()` | `{ data: PublishJob }` | ❌ Broken — DB update only, no real post |
| `/api/meta/auth-url` | GET | `settings/page.tsx → ConnectButton` | `{ url: string }` | ✅ Working |
| `/api/meta/connections` | GET | `use-meta-connections.ts → useMetaConnections()` | `{ data: MetaConnectionSafe[] }` | ✅ Working |
| `/api/meta/connections/[id]` | DELETE | `use-meta-connections.ts → useDisconnectMeta()` | `204 No Content` | ⚠️ Partial — soft-delete only, no token revocation |

### External API calls (backend → Meta Graph API)

| Endpoint | Method | Called From | Purpose | Status |
|---|---|---|---|---|
| `graph.facebook.com/v19.0/oauth/access_token` | GET | `meta/callback/route.ts:31` | Exchange auth code for short-lived token | ✅ Working |
| `graph.facebook.com/v19.0/oauth/access_token` (fb_exchange_token) | GET | `meta/callback/route.ts:49` | Exchange short-lived for 60-day token | ✅ Working |
| `graph.facebook.com/v19.0/me/accounts` | GET | `meta/callback/route.ts:74` | Fetch all managed Facebook pages | ✅ Working |
| `graph.facebook.com/v19.0/{pageId}?fields=instagram_business_account` | GET | `meta/callback/route.ts:109` | Find linked Instagram account | ✅ Working |
| `graph.facebook.com/v19.0/{igId}?fields=id,username` | GET | `meta/callback/route.ts:122` | Fetch Instagram username | ✅ Working |
| `graph.facebook.com/v19.0/{pageId}/feed` | POST | **DOES NOT EXIST** | Post content to Facebook | ❌ NOT IMPLEMENTED |
| `graph.facebook.com/v19.0/{igUserId}/media` | POST | **DOES NOT EXIST** | Create Instagram media container | ❌ NOT IMPLEMENTED |
| `graph.facebook.com/v19.0/{igUserId}/media_publish` | POST | **DOES NOT EXIST** | Publish Instagram media container | ❌ NOT IMPLEMENTED |

---

# 4. Facebook Integration

## Status: **PARTIAL**

### What exists

| Feature | Status | File |
|---|---|---|
| OAuth URL generation | ✅ Working | `api/meta/auth-url/route.ts` |
| OAuth callback handler | ✅ Working | `api/meta/callback/route.ts` |
| Short → long-lived token exchange | ✅ Working | `meta/callback/route.ts:31-66` |
| Fetch managed Facebook pages | ✅ Working | `meta/callback/route.ts:72-84` |
| Store encrypted page token in DB | ✅ Working | `meta/callback/route.ts:88-106` |
| AES-256-GCM token encryption | ✅ Working | `lib/meta-token.ts` |
| Display connection in UI | ✅ Working | `settings/page.tsx` |
| List connections (API) | ✅ Working | `api/meta/connections/route.ts` |
| Soft-disconnect connection | ⚠️ Partial | `api/meta/connections/[id]/route.ts` |
| **Post content to Facebook page** | ❌ NOT IMPLEMENTED | — |
| Token refresh | ❌ NOT IMPLEMENTED | — |
| CSRF state parameter in OAuth | ❌ NOT IMPLEMENTED | — |
| Hard disconnect (token revocation with Meta) | ❌ NOT IMPLEMENTED | — |

### What is missing to make Facebook work end-to-end

1. The OAuth callback passes `access_token` as a URL query parameter in Graph API calls (lines 75 and 110 of `callback/route.ts`). Tokens should be in `Authorization: Bearer` headers to avoid accidental logging.
2. No CSRF `state` parameter in the OAuth URL — a forged callback is possible.
3. Tokens expire after ~60 days (`expires_in` is stored in `tokenExpiresAt`). There is no refresh mechanism anywhere in the codebase.
4. The token is stored encrypted and can be decrypted via `decrypt()` in `lib/meta-token.ts` — but nothing ever calls `decrypt()` to use the token for publishing.
5. There is no implementation of `POST /{page_id}/feed` or any content publishing call to the Graph API.

---

# 5. Instagram Integration

## Status: **PARTIAL**

### What exists

| Feature | Status | File |
|---|---|---|
| Detect linked Instagram business account during OAuth | ✅ Working | `meta/callback/route.ts:108-117` |
| Fetch Instagram username | ✅ Working | `meta/callback/route.ts:122-127` |
| Store Instagram connection with page token | ✅ Working | `meta/callback/route.ts:130-147` |
| Display Instagram connection in settings UI | ✅ Working | `settings/page.tsx` |
| Store `instagramCaption` and `hashtags` in draft | ✅ Working | `prisma/schema.prisma` + all draft routes |
| **Publish to Instagram** | ❌ NOT IMPLEMENTED | — |
| Create media container (step 1) | ❌ NOT IMPLEMENTED | — |
| Publish media container (step 2) | ❌ NOT IMPLEMENTED | — |
| Carousel publishing | ❌ NOT IMPLEMENTED | — |
| Reel publishing | ❌ NOT IMPLEMENTED | — |
| Story publishing | ❌ NOT IMPLEMENTED | — |
| Image hosting / CDN for media URLs | ❌ NOT IMPLEMENTED | — |
| Token refresh | ❌ NOT IMPLEMENTED | — |

### What is missing to make Instagram work end-to-end

Instagram publishing via Meta Graph API requires:

1. **Publicly accessible image URLs** — Instagram does not accept base64 or local file uploads. A CDN or media hosting service is required. There is no image upload or storage anywhere in the codebase.
2. **Step 1:** `POST /{ig-user-id}/media` with `image_url` (and caption/hashtags for feed posts).
3. **Step 2:** `POST /{ig-user-id}/media_publish` with the `creation_id` from step 1.
4. Reels require a different upload flow (video container API).
5. Stories have their own endpoint and a 24-hour TTL.
6. Instagram only works with Business accounts linked to a Facebook page — personal Instagram accounts are blocked by Meta's API.
7. None of these calls exist anywhere in the codebase.

---

# 6. Agent Logic (CORE PART)

## Status: **FAKE (UI + intake only)**

### Where is the "agent" implemented?

The only agent-related code in this entire repo is:

**File:** `src/app/api/agent/intake/route.ts`

This is a single REST endpoint that:
- Accepts a `POST` request from an external caller
- Authenticates via `X-Agent-Key` header compared against `process.env.AGENT_API_KEY`
- Validates the request body with Zod schema (`intakeSchema`)
- Stores the draft in the database via a Prisma transaction
- Returns a 201 with the created draft

**That is the entirety of the "agent" logic in this repository.**

### Is there automation?

**No.** There is no:
- Cron job
- Background worker
- Task queue (no BullMQ, no Agenda, no similar library)
- Polling loop
- Webhook listener (other than the OAuth callback)
- Automated trigger of any kind

### Is there scheduling?

**No.** The `scheduledDate` field exists in the `PublishJob` schema and `SCHEDULED` is a valid status, but:
- No code ever sets `scheduledDate` to a value
- No code ever reads `scheduledDate` to trigger a publish
- The scheduling infrastructure is entirely absent

### Is there decision logic?

**No.** There is no content selection, no platform targeting logic beyond what the admin manually selected in the request, and no dynamic decision making.

### Is it actually posting?

**No.** The "publish" action is `POST /api/publish-jobs/[id]/mark-published` which exclusively does:

```typescript
await prisma.publishJob.update({
  where: { id },
  data: {
    status: "PUBLISHED",
    publishedAt: new Date(),
    publishMethod: "MANUAL",
  },
});
```

This is a database update only. No post is sent to Facebook or Instagram.

---

# 7. UI / Dashboard Analysis

## Screens and what they do

### `/requests` — Content Requests

**What it shows:** Table of all content requests with title, platform, content type, status, and draft status.

**Actions that work:**
- ✅ Navigate to create new request
- ✅ Delete a request (only if status = NEW; confirmed via dialog)

**Actions that do nothing / not available:**
- ❌ No edit button for existing requests
- ❌ No filter or search
- ❌ No pagination

---

### `/requests/new` — Create Request

**What it shows:** Form with fields: title, platform (INSTAGRAM/FACEBOOK/BOTH), content type (POST/STORY/CAROUSEL/REEL), sequence day, content pillar, instructions, target publish date.

**Actions that work:**
- ✅ Submit form → creates ContentRequest → redirects to `/requests`

**Notes:**
- Form validates using Zod schema + React Hook Form
- Platform options are INSTAGRAM, FACEBOOK, BOTH — these match the DB schema
- ContentType options are POST, STORY, CAROUSEL, REEL — these match the DB schema
- ARTICLE, LINKEDIN, TWITTER, TIKTOK appear in `types/index.ts` but are NOT available in the form and NOT in the DB schema

---

### `/drafts` — Draft Grid

**What it shows:** 2-column grid of draft cards. Each card shows: request title, platform, content type, hook text, draft status, version, date.

**Actions that work:**
- ✅ Click card → navigates to `/drafts/[id]`

**Actions not available:**
- ❌ No status filter
- ❌ No search
- ❌ No sort control (always newest first)
- ❌ No pagination

---

### `/drafts/[id]` — Draft Review

**What it shows:** Two-panel layout. Left panel (35%): request metadata, admin notes, action buttons. Right panel (65%): all draft content fields rendered read-only.

**Actions that work:**
- ✅ Approve draft → creates PublishJob, updates statuses
- ✅ Request revision → sets REVISION_NEEDED with required note
- ✅ Reject draft → sets REJECTED with optional note
- ✅ Success banner appears after approval (transient — disappears on page refresh)

**Actions NOT available:**
- ❌ Edit draft content — the PATCH endpoint exists but there is no edit form in the UI
- ❌ Add/edit admin notes from this page (they are display-only)
- ❌ View revision history

---

### `/queue` — Publish Queue

**What it shows:** Table of all PublishJobs with: request title, hook, platform, content type, status badge, creation date, and "Mark Published" button (visible only for QUEUED or SCHEDULED jobs).

**Actions that work:**
- ✅ "Mark Published" → sets job status to PUBLISHED, publishedAt to now

**Actions that DO NOT work / are fake:**
- ❌ "Mark Published" does NOT post anything to Facebook or Instagram
- ❌ No way to view the actual content that will be published
- ❌ No link to view published post (externalPostId / publishedUrl are never populated)
- ❌ No way to schedule a post for a future date from this UI
- ❌ No cancel button for QUEUED jobs
- ❌ No retry button for FAILED jobs

---

### `/settings` — Meta Connections

**What it shows:** Two cards — Facebook and Instagram — showing connection status, page/account name, token expiry countdown.

**Actions that work:**
- ✅ "Connect" button → redirects to Facebook OAuth → callback stores tokens → redirects back with success toast
- ✅ "Disconnect" button → confirms → soft-deletes connection in DB

**Actions that are partial / broken:**
- ⚠️ Disconnect only sets `isActive = false` in the DB; the actual token is NOT revoked with Meta
- ❌ No "Refresh Token" button — when token expires, admin must reconnect from scratch
- ❌ No warning at 7 days before expiry (the countdown shows days, but no alert state)

---

# 8. Data Flow (CRITICAL)

## Flow 1: Create content request → agent submits draft → admin reviews (WORKING)

```
1. Admin fills RequestForm → POST /api/requests
   → ContentRequest created (status: NEW)

2. External agent calls POST /api/agent/intake (X-Agent-Key)
   → Draft created (status: PENDING_REVIEW)
   → ContentRequest status → DRAFT_READY
   → DraftRevision created (changedBy: AGENT)

3. Admin opens /drafts → GET /api/drafts
   → Draft appears in grid

4. Admin clicks draft → GET /api/drafts/[id]
   → Full draft rendered in DraftContentPanel

5a. Admin approves → POST /api/drafts/[id]/approve
   → TRANSACTION:
     Draft status → APPROVED
     ContentRequest status → COMPLETED
     PublishJob created (status: QUEUED, platform from request)
     DraftRevision created (changedBy: ADMIN)
   → ["drafts"] and ["drafts", id] caches invalidated
   ⚠️ NOTE: ["requests"] cache is NOT invalidated — stale status shown on /requests until 60s stale time

5b. Admin requests revision → POST /api/drafts/[id]/request-revision
   → Draft status → REVISION_NEEDED
   → ContentRequest status → REVISION_NEEDED
   ⚠️ External agent has no notification it must revise — no webhook, no email

5c. Admin rejects → POST /api/drafts/[id]/reject
   → Draft status → REJECTED
   → ContentRequest status → CANCELLED
```

**This entire flow works end-to-end for the review cycle.**

---

## Flow 2: Admin publishes approved draft (BROKEN — does not post to social media)

```
6. Admin opens /queue → GET /api/publish-jobs
   → PublishJob (status: QUEUED) appears in table

7. Admin clicks "Mark Published" → POST /api/publish-jobs/[id]/mark-published
   → PublishJob.status → PUBLISHED
   → PublishJob.publishedAt → now()
   → PublishJob.publishMethod → MANUAL

❌ BREAK: No call is made to Meta Graph API.
   Nothing is posted to Facebook or Instagram.
   externalPostId = null
   publishedUrl = null
   The post exists only as a database record.
```

**The publish flow is completely non-functional for its stated purpose.**

---

## Flow 3: Connect Facebook/Instagram (PARTIAL — connect works, use is broken)

```
1. Admin clicks "Connect" → GET /api/meta/auth-url
   → Returns Facebook OAuth URL
   → Browser redirects to facebook.com/dialog/oauth

2. User authorizes on Facebook
   → Facebook redirects to GET /api/meta/callback?code=...

3. Callback:
   a. Exchange code for short-lived token  ✅
   b. Exchange for long-lived token (60 days)  ✅
   c. Fetch managed Facebook pages  ✅
   d. Upsert MetaConnection (FACEBOOK) with encrypted token  ✅
   e. For each page: check for linked Instagram account  ✅
   f. Upsert MetaConnection (INSTAGRAM) with encrypted token  ✅
   → Redirect to /settings?meta_connected=true

4. Settings page shows connection cards with page/account names  ✅

❌ BREAK: Token is stored and displayed, but NOTHING ever reads the token
   back to make an actual API call to publish content.
   decrypt() in lib/meta-token.ts is never called outside of meta-token.ts itself.
```

---

# 9. Environment & Config

## All environment variables used

| Variable | File(s) That Use It | Purpose | Required | Notes |
|---|---|---|---|---|
| `DATABASE_URL` | `prisma/schema.prisma` | Prisma DB connection (pgbouncer) | Yes | Must be Supabase pgbouncer URL |
| `DIRECT_URL` | `prisma/schema.prisma` | Direct DB connection for migrations | Yes | Must bypass pgbouncer |
| `NEXTAUTH_SECRET` | NextAuth internals | JWT signing | Yes | — |
| `AUTH_SECRET` | NextAuth internals | Alternative/alias for NEXTAUTH_SECRET | Yes | Both appear in env files |
| `NEXTAUTH_URL` | NextAuth internals | Base URL for redirects | Yes | Set to `https://domiron-agent.vercel.app` |
| `ADMIN_EMAIL` | `src/lib/auth.ts:26` | Only valid login email | Yes | Compared with `===` — plaintext |
| `ADMIN_PASSWORD` | `src/lib/auth.ts:27` | Only valid login password | Yes | Compared with `===` — plaintext, no hashing |
| `AGENT_API_KEY` | `src/app/api/agent/intake/route.ts:41` | Header value for agent authentication | Yes | No rate limiting, no HMAC |
| `META_APP_ID` | `api/meta/auth-url/route.ts:20`, `callback/route.ts:33,34` | Facebook OAuth application ID | Yes | — |
| `META_APP_SECRET` | `callback/route.ts:34,53` | Facebook OAuth secret | Yes | Used in token exchange |
| `META_REDIRECT_URI` | `auth-url/route.ts:21`, `callback/route.ts:35` | OAuth redirect URL registered in Facebook app | Yes | Must match Facebook app settings exactly |
| `TOKEN_ENCRYPTION_KEY` | `src/lib/meta-token.ts:7` | 64-char hex key for AES-256-GCM | Yes | If missing, encrypt/decrypt throws at runtime |

## Hardcoded values that should not be hardcoded

| Value | Location | Issue |
|---|---|---|
| `"v19.0"` (Graph API version) | `api/meta/auth-url/route.ts:4` and `api/meta/callback/route.ts:6` | Should be an env var or constant; Meta deprecates versions |
| `"admin"` (user id) | `src/lib/auth.ts:38` | Hardcoded user ID for the single admin account |
| `224px` (sidebar width) | `src/app/(dashboard)/layout.tsx:21` | Layout dimension hardcoded inline |
| All Hebrew-language strings | Throughout all components and API routes | No i18n layer — switching language requires code changes |

## Critical security problems with env files

- `.env` and `.env.local` **contain real production credentials** — Supabase database password, Meta App Secret (`20da8e554c2c3eb3ca3bdbc4ad998eb1`), AES encryption key, and agent API key.
- `.env.example` also contains the real Meta App ID (`1962927204598028`) and Secret.
- These files are in the repository. If the repo has ever been pushed to a remote or shared, all credentials must be considered compromised and must be rotated.

---

# 10. Bugs & Issues

## Critical

### BUG-001: Publishing does nothing
- **File:** `src/app/api/publish-jobs/[id]/mark-published/route.ts`
- **Description:** The "Mark Published" action only sets `status = "PUBLISHED"` and `publishedAt = now()` in the database. No call to the Meta Graph API is made. No content is ever posted to Facebook or Instagram.
- **Why broken:** The implementation was never written. The endpoint is a database status update masquerading as a publish action.
- **Impact:** CRITICAL — the system's primary purpose (social media publishing) does not work at all.

---

### BUG-002: Real credentials committed to version control
- **Files:** `.env`, `.env.local`, `.env.example`
- **Description:** These files contain the live Supabase database password, Meta App Secret, AES-256 encryption key (`TOKEN_ENCRYPTION_KEY`), and agent API key.
- **Why broken:** Secret files were committed to the git repository.
- **Impact:** CRITICAL — all connected services can be compromised. Credentials must be rotated immediately.

---

### BUG-003: `decrypt()` is never called — stored tokens are useless
- **File:** `src/lib/meta-token.ts`
- **Description:** The `decrypt()` function exists and is correctly implemented. But it is never imported or called anywhere in the codebase except in `meta-token.ts` itself. All stored OAuth tokens are encrypted and permanently unreadable by any runtime code.
- **Why broken:** The publish flow that would read tokens was never written.
- **Impact:** CRITICAL — even if publishing code were added, it would need to call `decrypt()` to get the usable token.

---

### BUG-004: `types/index.ts` interfaces do not match the Prisma schema
- **File:** `src/types/index.ts`
- **Description:** Multiple mismatches between the TypeScript types and the actual database schema:
  - `Platform` enum includes `LINKEDIN`, `TWITTER`, `TIKTOK` — these do NOT exist in `schema.prisma`. If any code used these values to write to the DB, Prisma would throw.
  - `ContentType` enum includes `ARTICLE` — does NOT exist in `schema.prisma`.
  - `ContentRequest` interface has a `description` field — no such field exists in the DB. Field is actually called `instructions`.
  - `ContentRequest` interface has `dueDate` — DB field is `targetPublishDate`.
  - `Draft` interface has `content: string` — the actual Draft model has 12+ separate content fields.
  - `PublishJob` interface has `scheduledAt` — DB field is `scheduledDate`.
- **Why broken:** The interfaces were written as early stubs and never updated after the schema was finalized.
- **Impact:** CRITICAL for any new developer who imports these interfaces. Any code relying on them will have wrong types. Currently, the hooks define their own correct inline types, so the UI is unaffected — but the stub types are a trap.

---

## High

### BUG-005: No OAuth CSRF protection
- **File:** `src/app/api/meta/auth-url/route.ts`
- **Description:** The OAuth URL contains no `state` parameter. The callback (`meta/callback/route.ts`) does not verify a state value. A malicious page could forge a callback request.
- **Impact:** HIGH — OAuth CSRF attack is possible.

---

### BUG-006: Access tokens passed as URL query parameters
- **File:** `src/app/api/meta/callback/route.ts:75, 110`
- **Description:** Graph API calls at lines 75 and 110 pass `access_token=...` as a URL query string parameter. These tokens appear in server access logs and potentially in browser history.
- **Impact:** HIGH — token leakage risk.

---

### BUG-007: No token refresh mechanism
- **File:** `src/app/api/meta/callback/route.ts`
- **Description:** Long-lived tokens expire after ~60 days. `tokenExpiresAt` is stored in the DB, but nothing ever checks it or attempts a refresh. After expiry, publishing would silently fail (once publishing is implemented).
- **Impact:** HIGH — connection will break 60 days after OAuth, with no recovery path except manually reconnecting.

---

### BUG-008: React Query cache cross-invalidation missing
- **File:** `src/hooks/use-drafts.ts`
- **Description:** When `useApproveDraft`, `useRejectDraft`, or `useRequestRevision` succeed, they invalidate `["drafts"]` and `["drafts", id]` — but NOT `["requests"]`. The `/requests` page will show stale request statuses (e.g., still showing `DRAFT_READY` after approval changed it to `COMPLETED`) until the 60-second stale time expires.
- **Impact:** HIGH — UI shows incorrect data after every draft lifecycle action.

---

### BUG-009: No 401 redirect in frontend
- **File:** All hooks in `src/hooks/`
- **Description:** When any fetch returns a 401 (session expired), the hook throws a generic error and shows an error message with a retry button. It does NOT redirect to `/login`. The admin is stuck on a broken screen.
- **Impact:** HIGH — session expiry leaves the user unable to recover without manually navigating to `/login`.

---

### BUG-010: `PATCH /api/drafts/[id]` has no UI
- **File:** `src/app/api/drafts/[id]/route.ts`
- **Description:** The endpoint for admins to edit draft content exists and is fully implemented (increments version, creates DraftRevision, sets status to EDITED). But there is no edit form anywhere in the UI. Admins can only approve, reject, or request revision — they cannot modify the actual content.
- **Impact:** HIGH — forces a full revision cycle even for small content tweaks.

---

## Medium

### BUG-011: Disconnect does not revoke token with Meta
- **File:** `src/app/api/meta/connections/[id]/route.ts`
- **Description:** The DELETE handler only sets `isActive = false`. It does not call Meta's token revocation endpoint. The token remains valid at Meta even after being "disconnected."
- **Impact:** MEDIUM — revoked connections remain active on Meta's side.

---

### BUG-012: `approved` banner is transient local state
- **File:** `src/app/(dashboard)/drafts/[id]/page.tsx:61`
- **Description:** After approving, `setApproved(true)` shows a success banner. This state lives in `useState` and is lost on page refresh. After refresh, the banner is gone even though the draft is still approved.
- **Impact:** MEDIUM — minor UX confusion; not data-breaking.

---

### BUG-013: No startup validation of required env vars
- **File:** All API routes
- **Description:** The app starts successfully even if required env vars (e.g., `TOKEN_ENCRYPTION_KEY`, `META_APP_SECRET`) are missing. The first request that needs a missing var will throw a runtime error with a stack trace.
- **Impact:** MEDIUM — silent misconfiguration; hard to diagnose on first deployment.

---

### BUG-014: `PublishJob.platform` comes from `ContentRequest.platform` not from a user selection
- **File:** `src/app/api/drafts/[id]/approve/route.ts:43-49`
- **Description:** When approving a draft, the PublishJob is created with `platform: draft.request.platform`. If the request was made for `BOTH`, the PublishJob gets `platform: "BOTH"`. There is no logic to split a `BOTH` job into two separate jobs (one for Facebook, one for Instagram), or to handle the `BOTH` case in a publish operation.
- **Impact:** MEDIUM — when publishing is implemented, `BOTH` will need explicit handling.

---

## Low

### BUG-015: Graph API version hardcoded
- **Files:** `api/meta/auth-url/route.ts:4`, `api/meta/callback/route.ts:6`
- **Description:** `"v19.0"` hardcoded in two places. Should be a single constant or env var.
- **Impact:** LOW — requires code change when Meta deprecates the version.

---

### BUG-016: `POST /api/drafts` orphaned backend route
- **File:** `src/app/api/drafts/route.ts:30-109`
- **Description:** A fully implemented POST handler for manually creating drafts exists, but no UI form calls it. Drafts are only created via the agent intake endpoint in practice.
- **Impact:** LOW — dead code, no runtime harm.

---

### BUG-017: No pagination on any list endpoint
- **Files:** All GET routes in `api/requests/`, `api/drafts/`, `api/publish-jobs/`
- **Description:** All list endpoints return all records with no limit, offset, or cursor. As data grows, responses will become arbitrarily large.
- **Impact:** LOW now; HIGH at scale.

---

# 11. Missing Pieces

## Facebook integration — what must be built

1. **Publishing function** — Call `POST /{page_id}/feed` with `message` field for text posts. Add `link` for link posts, `object_attachment` for photos (requires photo upload first).
2. **Token decryption before use** — Call `decrypt(connection.encryptedToken)` to get the usable page access token before any Graph API call.
3. **Token expiry check** — Before publishing, check `tokenExpiresAt`. If expired or near expiry, block the publish and surface an error in the UI.
4. **Token refresh** — Implement a long-lived token refresh: GET `oauth/access_token?grant_type=fb_exchange_token&client_id=...&client_secret=...&fb_exchange_token={current_long_token}`.
5. **CSRF state in OAuth** — Generate a random `state` in auth-url, store it in session, validate it in callback.
6. **Move tokens off URL params** — Refactor all Graph API calls to use `Authorization: Bearer {token}` header.
7. **Error handling for OAuthException** — Detect expired/revoked tokens in Graph API error responses and re-prompt the user to reconnect.
8. **Hard disconnect** — On disconnect, call `DELETE /{token}` to revoke the token with Meta.

## Instagram integration — what must be built

1. **Media hosting / CDN** — Instagram requires publicly accessible `https://` image URLs. A file upload endpoint and CDN integration (e.g., S3 + CloudFront, Cloudinary, Vercel Blob) must be built.
2. **Two-step publish flow:**
   - Step 1: `POST /{ig-user-id}/media` with `image_url`, `caption`
   - Step 2: `POST /{ig-user-id}/media_publish` with `creation_id` from step 1
3. **Carousel support** — Multiple `POST /{ig-user-id}/media` calls for each image, then one `POST /{ig-user-id}/media` with `media_type=CAROUSEL` and `children=[id1,id2,...]`, then publish.
4. **Reel support** — Use the Instagram Reels API (video container → publish).
5. **Story support** — Separate story endpoint, different media requirements.

## Backend gaps

1. **Actual publish service** — A function `publishJob(job: PublishJob)` that decrypts the token, selects the right Graph API call based on platform + content format, sends the request, and stores `externalPostId` + `publishedUrl` in the DB.
2. **Background job processor** — On Vercel, this likely means an external queue (Upstash QStash, AWS SQS, etc.) rather than a long-running process. Alternatively, a scheduled Vercel Cron that processes QUEUED jobs.
3. **API request logging** — An `ApiLog` table and a logging wrapper around all outgoing Meta API calls. A `/api/logs` endpoint. A Logs page in the dashboard.
4. **Webhook receiver** — An endpoint to receive Meta webhooks (e.g., post status confirmations), if needed.
5. **Email / notification service** — Notify admin when a new draft arrives from the agent.

## Auth gaps

1. **No CSRF protection on OAuth** (see BUG-005)
2. **No 401 redirect in frontend** (see BUG-009)
3. **No password hashing** — `ADMIN_PASSWORD` compared as plaintext
4. **No session invalidation** — No endpoint to force logout all sessions

## Scheduling / automation gaps

1. No cron or scheduler exists in the codebase at all
2. `scheduledDate` field in `PublishJob` is entirely unused
3. No background worker of any kind
4. No retry logic for failed publish jobs

---

# 12. Reality Check

## Is this system currently:

### ✅ Prototype — with some working parts

**Working:**
- Admin login and session management
- Content request creation and management
- Draft review workflow (approve / reject / request-revision)
- Meta OAuth connection flow (connect, disconnect)
- Token storage with AES-256-GCM encryption
- All CRUD database operations

**Not working:**
- Publishing anything to Facebook or Instagram (the system's entire purpose)
- Displaying API request logs (not built at all)
- Token refresh (tokens expire after 60 days with no recovery)
- Admin editing of draft content (endpoint exists, no UI)
- Stale UI after draft actions (cache invalidation bug)
- Any form of automation, scheduling, or agent logic

**Verdict:**

This is a **well-structured prototype** of a content management dashboard. The data model is sound. The review workflow works. The UI is polished and usable. The Meta OAuth token acquisition works.

But the system **cannot fulfill its stated purpose** — it cannot post anything to social media. The publish infrastructure is entirely absent. The "agent" component doesn't exist in this repo. No API request history is visible.

A non-technical user interacting with this dashboard would believe content is being published (they can click "Mark Published" and see a "PUBLISHED" status), but nothing has actually been sent anywhere.

---

# 13. Next Steps (ACTIONABLE)

## Step 1 — Emergency: Rotate all credentials (TODAY)

- Remove `.env` and `.env.local` from git history (`git filter-repo` or BFG)
- Add both to `.gitignore` immediately
- Rotate Supabase database password
- Rotate Meta App Secret in the Facebook Developer Portal
- Generate a new `TOKEN_ENCRYPTION_KEY` (64-char hex), migrate existing encrypted tokens in DB
- Change `ADMIN_PASSWORD` to a strong unique password
- Generate a new `AGENT_API_KEY`
- Update `.env.example` with placeholder values only (e.g., `your-meta-app-secret-here`)

## Step 2 — Fix the type mismatches

- Open `src/types/index.ts`
- Remove `LINKEDIN`, `TWITTER`, `TIKTOK` from `Platform` enum (not in DB schema)
- Remove `ARTICLE` from `ContentType` enum (not in DB schema)
- Delete the `ContentRequest`, `Draft`, `PublishJob`, and `User` interfaces entirely — they are stale stubs that don't match the schema and are not used by any hook or component

## Step 3 — Fix the React Query cache invalidation bug

- In `use-drafts.ts`, inside `useApproveDraft.onSuccess`, `useRejectDraft.onSuccess`, and `useRequestRevision.onSuccess`, add:
  ```typescript
  queryClient.invalidateQueries({ queryKey: ["requests"] });
  ```
- This ensures the Requests page reflects the correct status immediately after draft actions.

## Step 4 — Add OAuth CSRF protection

- In `api/meta/auth-url/route.ts`: generate a random `state` value, store it in the session (or a signed cookie), and include it in the OAuth URL.
- In `api/meta/callback/route.ts`: read the `state` param from the callback, compare it to the stored value, return an error if they don't match.

## Step 5 — Move access tokens off URL query strings

- In `api/meta/callback/route.ts`, refactor all `fetch()` calls that include `access_token` as a query param:
  ```typescript
  fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  })
  ```
  Applies to lines 74-76, 109-111, 122-124.

## Step 6 — Implement token refresh

- Create `POST /api/meta/connections/[id]/refresh`
- Call `GET graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=...&client_secret=...&fb_exchange_token={current_token}`
- Update `encryptedToken` and `tokenExpiresAt` in the DB
- Add a "Refresh Token" button in the Settings UI when token expires in < 14 days

## Step 7 — Build the publish service (CORE WORK)

Create a publish service module (`src/lib/publish.ts`) with:

```typescript
// Skeleton only — must be implemented
async function publishToFacebook(job: PublishJob, connection: MetaConnection): Promise<void>
async function publishToInstagram(job: PublishJob, connection: MetaConnection): Promise<void>
```

For Facebook:
- `decrypt(connection.encryptedToken)` to get the page access token
- `POST graph.facebook.com/v19.0/{pageId}/feed` with `message: draft.facebookCaption`
- On success: update `PublishJob.externalPostId`, `PublishJob.publishedUrl`, `PublishJob.status = PUBLISHED`
- On failure: update `PublishJob.status = FAILED`, `PublishJob.failureReason`

For Instagram:
- Requires public image URL (see Step 8)
- `POST /{ig-user-id}/media` with `image_url` + `caption`
- `POST /{ig-user-id}/media_publish` with `creation_id`
- Store result in PublishJob

Replace the `mark-published` route body with a call to this service.

## Step 8 — Add media upload and hosting

- Choose a storage provider: Vercel Blob, Cloudinary, AWS S3, or similar
- Create `POST /api/media/upload` endpoint that accepts an image and returns a public URL
- Add a media upload field to the draft review page (or the agent intake schema)
- This is a prerequisite for Instagram publishing

## Step 9 — Add API request logging

- Add `ApiLog` model to Prisma schema:
  ```
  model ApiLog {
    id         String   @id @default(cuid())
    direction  String   // "OUTGOING"
    method     String
    url        String
    statusCode Int?
    durationMs Int?
    error      String?
    createdAt  DateTime @default(now())
  }
  ```
- Create a logging wrapper function `loggedFetch(url, options)` that wraps `fetch()` and writes to `ApiLog`
- Replace all bare `fetch()` calls in `meta/callback/route.ts` with `loggedFetch()`
- Create `GET /api/logs` endpoint
- Add a Logs page to the dashboard sidebar

## Step 10 — Add background job processing

For Vercel deployment, the recommended approach:
- Use [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs) to trigger `POST /api/cron/process-queue` every minute
- That endpoint fetches all `PublishJob` records with `status = QUEUED` and `scheduledDate <= now()` (or no scheduled date)
- Calls the publish service from Step 7 for each
- Protect the endpoint with a secret header (e.g., `Authorization: Bearer {CRON_SECRET}`)

Alternatively, use an external queue service (Upstash QStash, AWS SQS) for more reliable delivery.

## Step 11 — Add 401 redirect in frontend

- In `src/components/providers/query-provider.tsx`, configure a global `onError` handler:
  ```typescript
  queryCache: new QueryCache({
    onError: (error) => {
      if (error.message.includes("401") || error.message.includes("Unauthorized")) {
        window.location.href = "/login";
      }
    }
  })
  ```

## Step 12 — Add draft edit UI

- Build a `DraftEditForm` component using the existing fields (facebookCaption, instagramCaption, hook, hashtags, etc.)
- Add an "Edit" button to `DraftMetaPanel`
- Call `PATCH /api/drafts/[id]` on submit (this endpoint already works)
- After save, re-fetch the draft (invalidate `["drafts", id]`)

---

*End of audit. All findings are based on direct code inspection. Nothing is assumed or guessed.*
