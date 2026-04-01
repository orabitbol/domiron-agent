# Domiron Social Agent / Dashboard Audit

> **Audit Date:** 2026-04-01  
> **Auditor:** Claude Code (claude-sonnet-4-6)  
> **Repo path:** `/Users/orabitbol/Desktop/agent-domiron/domiron-dashboard`  
> **Branch audited:** `main` (commit `757814f`)

---

## 1. Executive Summary

The Domiron Dashboard is a Next.js content-management and social-publishing tool intended to manage a workflow from content request → agent-generated draft → admin review → publishing to Facebook/Instagram. The project has a solid structural foundation — the database schema, API routes, UI screens, and OAuth connection flow are all present — but **the system is significantly incomplete** and **not functional end-to-end**.

The two biggest structural gaps are:

1. **Publishing is entirely fake.** No actual Meta Graph API call is ever made to post content. The "publish" action does nothing but update a database status field manually.
2. **There is no API request visibility anywhere.** There is no log, no history panel, no debug view. The user sees no information about what API calls are being made, whether they succeeded, or why they failed.

Additionally, the Facebook/Instagram integration stops halfway: OAuth connect works and tokens are stored, but nothing reads the tokens back to actually publish anything. There is also no token refresh mechanism.

**Maturity level:** Early prototype / pre-alpha.  
**Production readiness:** Not production-ready. Multiple critical gaps must be resolved before the system can serve its stated purpose.

---

## 2. Project Purpose

### What the product is supposed to do

The Domiron Dashboard is supposed to act as a **social media publishing agent** for the game Domiron. It manages an end-to-end workflow:

1. An **admin** creates content requests (brief + platform + type).
2. An **external AI agent** reads requests and submits drafted content (captions, hooks, hashtags, story frames) via a REST intake API.
3. An **admin** reviews the draft, approves, requests revisions, or rejects.
4. Upon approval, the draft is placed in a **publish queue**.
5. The system (or admin manually) **publishes the post** to connected Facebook pages and Instagram accounts.
6. Published state is tracked per job.

### Who the user is

A single admin user (single-account system) who oversees all content operations — reviewing AI-generated drafts and managing what gets published to Domiron's social channels.

### Workflows attempted

- Content request lifecycle management
- AI agent draft intake
- Draft review and approval
- Meta OAuth connection management
- Publishing queue management

---

## 3. Tech Stack

| Layer | Technology | Where Used | Centrality |
|---|---|---|---|
| Frontend framework | Next.js 16.1.7 (App Router) | Entire frontend + API routes | Core |
| Language | TypeScript 5 | All source files | Core |
| React | 19.2.3 | All UI components | Core |
| Styling | Tailwind CSS 4 + inline styles | All components | Core |
| UI primitives | Radix UI + shadcn/ui | Button, Dialog, Label, Badge, etc. | High |
| Server state | TanStack React Query 5.90 | All data hooks (`/src/hooks/`) | High |
| Auth | NextAuth 5.0.0-beta.30 (Credentials) | `/src/lib/auth.ts`, `/src/proxy.ts` | Core |
| Database | PostgreSQL (Supabase-hosted) | All backend routes via Prisma | Core |
| ORM | Prisma 5.22.0 | All `/src/app/api/` routes | Core |
| Form handling | React Hook Form 7.71 | `request-form.tsx` | Moderate |
| Validation | Zod 4.3.6 | All API routes + form schemas | High |
| Token encryption | Node.js `crypto` (AES-256-GCM) | `/src/lib/meta-token.ts` | Critical |
| Toasts | Sonner 2.0 | All user-facing feedback | Moderate |
| Date formatting | date-fns 4.1 | `queue-table.tsx` | Low |
| Icons | Lucide React 0.577 | Throughout UI | Low |
| Social media SDK | None — raw `fetch` to Meta Graph API | `/src/app/api/meta/` | Critical |
| Background jobs | **None** | N/A | Missing |
| Scheduling | **None** | N/A | Missing |
| Testing | **None** | N/A | Missing |
| Logging | `console.error` only | Scattered | Minimal |
| Deployment | Vercel (inferred from NEXTAUTH_URL) | Production | Moderate |

**Notable absences:** No image/media upload library, no job queue (Bull/BullMQ/Agenda), no email library, no monitoring/APM, no test runner, no OpenAPI spec.

---

## 4. Repository Structure

```
domiron-dashboard/
├── prisma/
│   └── schema.prisma           ← Database schema (single source of truth for models)
├── src/
│   ├── app/
│   │   ├── layout.tsx           ← Root layout with QueryProvider + Toaster
│   │   ├── page.tsx             ← Root redirect (/ → /requests or /login)
│   │   ├── globals.css          ← Global styles
│   │   ├── (auth)/
│   │   │   └── login/page.tsx   ← Credentials login form
│   │   ├── (dashboard)/         ← Protected route group
│   │   │   ├── layout.tsx       ← Dashboard shell with Sidebar
│   │   │   ├── requests/        ← Content request management pages
│   │   │   ├── drafts/          ← Draft review pages
│   │   │   ├── queue/           ← Publish queue page
│   │   │   └── settings/        ← Meta OAuth settings page
│   │   └── api/
│   │       ├── auth/[...nextauth]/ ← NextAuth handler
│   │       ├── requests/           ← CRUD for ContentRequest
│   │       ├── drafts/             ← CRUD + approve/reject/revision for Draft
│   │       ├── publish-jobs/       ← List + mark-published for PublishJob
│   │       ├── agent/intake/       ← External agent draft submission endpoint
│   │       └── meta/               ← Meta OAuth auth-url, callback, connections
│   ├── components/
│   │   ├── ui/                  ← shadcn/ui primitives (button, input, dialog, etc.)
│   │   ├── layout/              ← Sidebar, Topbar
│   │   ├── shared/              ← EmptyState, LoadingSkeleton, ConfirmDialog, StatusBadge
│   │   ├── requests/            ← RequestForm, RequestsTable
│   │   ├── drafts/              ← DraftCard, DraftContentPanel, DraftMetaPanel, RevisionNotesInput
│   │   └── queue/               ← QueueTable
│   ├── hooks/                   ← React Query hooks (use-requests, use-drafts, use-publish-jobs, use-meta-connections)
│   ├── lib/
│   │   ├── auth.ts              ← NextAuth Credentials provider
│   │   ├── auth.config.ts       ← Callbacks, authorized logic
│   │   ├── prisma.ts            ← Prisma singleton
│   │   ├── meta-token.ts        ← AES-256-GCM encrypt/decrypt
│   │   ├── utils.ts             ← Tailwind class merging (cn)
│   │   └── validations/         ← Zod schemas (request.ts, draft.ts)
│   ├── types/
│   │   └── index.ts             ← Enums, label maps, interfaces (IMPORTANT: partially out of sync with Prisma)
│   └── proxy.ts                 ← Middleware (NextAuth route protection)
├── .env.example                 ← Contains REAL secrets (critical security issue)
├── .env                         ← Contains REAL production credentials (critical security issue)
├── .env.local                   ← Contains REAL production credentials (critical security issue)
├── package.json
├── next.config.ts               ← Empty configuration
└── tsconfig.json
```

**Suspicious/noteworthy:**
- `.env` and `.env.local` exist alongside `.env.example` and likely should not be committed. These contain real database passwords, Meta secrets, and encryption keys.
- `next.config.ts` is essentially empty (no security headers, no rewrites, no image domains).
- No `__tests__`, `test`, or `spec` folders anywhere.
- No `workers/`, `jobs/`, or `queue/` folder — there is no background processing infrastructure.

---

## 5. Application Flows

### 5.1 Login Flow

**Intended:** Admin enters email/password, gets a session.

**Actual:**
1. User visits `/login` → `(auth)/login/page.tsx`
2. React Hook Form submits to NextAuth `signIn("credentials")`
3. NextAuth validates against `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars (`auth.ts:26-27`)
4. On success, JWT session created; user redirected to `/`
5. Root page redirects to `/requests`
6. Middleware (`proxy.ts`) protects all routes except `_next/*` and `/api/agent/*`

**Missing:** No `/api/auth/*` exemption explicitly in matcher (though NextAuth handles internally). No CSRF state for OAuth login form. No account lockout or rate limiting.

**Status:** Working for the single admin account.

---

### 5.2 Dashboard Load Flow

**Intended:** Admin sees requests, drafts, queue on load.

**Actual:**
1. Protected layout renders `Sidebar` + `{children}`
2. Each page fetches its own data independently via React Query hooks
3. No shared loading state or pre-fetching at layout level
4. 60-second stale time before re-fetch

**Status:** Working.

---

### 5.3 Create Content Request Flow

**Intended:** Admin creates a request brief that an agent will later draft against.

**Actual:**
1. Admin navigates to `/requests/new`
2. `RequestForm` collects: title, platform, contentType, sequenceDay, contentPillar, instructions, targetPublishDate
3. Validated by `requestSchema` (Zod)
4. `POST /api/requests` → Prisma creates `ContentRequest` with status `NEW`
5. React Query invalidates `["requests"]`
6. Redirect to `/requests`

**Status:** Working.

---

### 5.4 Agent Draft Intake Flow

**Intended:** An external AI agent reads open requests and submits generated draft content.

**Actual:**
1. External agent calls `POST /api/agent/intake` with `X-Agent-Key` header
2. Key validated against `AGENT_API_KEY` env var
3. `intakeSchema` validates body (snake_case JSON)
4. Prisma transaction:
   - Creates `Draft` with status `PENDING_REVIEW`
   - Updates `ContentRequest` status to `DRAFT_READY`
   - Creates `DraftRevision` (snapshot, changedBy: AGENT)
5. Returns 201 with draft object

**Missing:**
- No external agent code exists in this repository. The "agent" is an external system that would call this API. The dashboard is just the **receiver**.
- No retry or deduplication logic (though 409 conflict guard exists for duplicate drafts).
- No notification to admin that a new draft is ready.
- The endpoint is unauthenticated from a user-session perspective — only the `X-Agent-Key` header protects it.

**Status:** API endpoint implemented. No actual agent logic lives here.

---

### 5.5 Draft Review Flow

**Intended:** Admin reviews AI-generated draft and approves, rejects, or requests revision.

**Actual:**
1. Admin visits `/drafts` — sees grid of draft cards
2. Clicks a draft → `/drafts/[id]`
3. `DraftMetaPanel` shows request meta + action buttons; `DraftContentPanel` shows all draft content fields
4. **Approve:** `POST /api/drafts/[id]/approve` → sets draft to APPROVED, request to COMPLETED, creates `PublishJob` with status QUEUED
5. **Reject:** `POST /api/drafts/[id]/reject` → sets draft to REJECTED, request to CANCELLED
6. **Request Revision:** `POST /api/drafts/[id]/request-revision` → sets both to REVISION_NEEDED

**Missing:**
- No ability for the admin to **edit** the draft content before approving. The PATCH endpoint exists (`/api/drafts/[id]`) but no UI form exposes it.
- No notification to external agent on revision/rejection.

**Status:** Partially implemented. Review and lifecycle transitions work, but edit-before-approve is missing.

---

### 5.6 Publish Flow

**Intended:** Approved drafts are published to Facebook/Instagram via Meta Graph API.

**Actual:**
1. On draft approval, a `PublishJob` is created with status `QUEUED`
2. Admin visits `/queue` — sees table of publish jobs
3. Admin clicks "סמן כפורסם" (Mark Published) → `POST /api/publish-jobs/[id]/mark-published`
4. This sets `status = PUBLISHED`, `publishedAt = now()`, `publishMethod = MANUAL`

**CRITICAL GAP:** No actual Meta Graph API call is ever made. The system does not post anything to Facebook or Instagram. The "publish" action is entirely manual and fake — it just marks the database record as published without sending any content anywhere.

Fields like `externalPostId`, `publishedUrl`, `metaRequestId`, and `failureReason` in `PublishJob` are never populated. The `scheduledDate` field exists but is never used for scheduling.

**Status:** Broken / Not Implemented. The publish flow is a placeholder.

---

### 5.7 Connect Social Account Flow (Meta OAuth)

**Intended:** Admin connects Facebook pages and linked Instagram accounts via OAuth.

**Actual:**
1. Admin visits `/settings`
2. Clicks "Connect" button → `GET /api/meta/auth-url` returns a Facebook OAuth URL
3. Browser redirects to Facebook dialog with scopes: `pages_manage_posts`, `pages_read_engagement`, `pages_show_list`, `instagram_business_content_publish`
4. Facebook redirects back to `GET /api/meta/callback?code=...`
5. Callback:
   a. Exchanges code for short-lived user token
   b. Exchanges for long-lived user token (60 days)
   c. Fetches all managed pages via `/me/accounts`
   d. For each page: upserts `MetaConnection` (FACEBOOK platform)
   e. For each page: fetches `instagram_business_account`, upserts `MetaConnection` (INSTAGRAM platform) with same page token
6. Redirects to `/settings?meta_connected=true`
7. Toast success shown; query invalidated

**Missing/Broken:**
- No CSRF state parameter in the OAuth URL. The callback cannot verify the request originated from this app.
- Tokens are passed in URLs (query parameters) to the Graph API calls (lines 75, 110 in `callback/route.ts`) — they should be in `Authorization: Bearer` headers.
- No token refresh. 60-day expiry is stored but never checked. When tokens expire, publishing will silently fail (or more likely, there's nothing to fail since publishing isn't implemented).
- The `disconnect` operation (`DELETE /api/meta/connections/[id]`) only sets `isActive = false`, it does not revoke the token with Meta.

**Status:** Partially implemented. OAuth connect flow works end-to-end and tokens are stored. But it is not connected to any publishing logic.

---

### 5.8 API Request History / Logs Flow

**Intended (based on user statement):** The system should show API request history and track all API calls.

**Actual:** **Does not exist.** There is no logging system, no request history table, no debug panel, no API call log in the UI. The only "logging" is `console.error(...)` scattered in a few API route catch blocks. These appear only in server logs and are invisible to the admin in the UI.

There is no:
- API request log model in the database
- Log display component
- Interceptor or middleware that records outgoing/incoming requests
- Admin debug view

This is the core reason "the system does not show all API requests properly" — the feature simply does not exist.

**Status:** Not implemented.

---

### 5.9 Scheduled Publishing Flow

**Intended:** Content can be scheduled for future publishing.

**Actual:** The `PublishJob.scheduledDate` field exists in the schema. The `PublishJobStatus.SCHEDULED` enum value exists. The UI can show "SCHEDULED" badge. But there is no mechanism to:
- Set a scheduled date from the UI
- Trigger publishing at the scheduled time
- Run any background worker or cron job

**Status:** Not implemented. Schema is prepared but nothing drives it.

---

### 5.10 Analytics / Reporting Flow

**Intended:** Track what was published, engagement, etc.

**Actual:** Not present anywhere. No analytics model, no analytics page, no Meta Insights API calls.

**Status:** Not implemented.

---

## 6. UI / Screens / Pages Audit

| Page | Route | File | Purpose | Status | Known Problems |
|---|---|---|---|---|---|
| Root redirect | `/` | `src/app/page.tsx` | Redirect to /requests or /login based on session | Working | None |
| Login | `/login` | `src/app/(auth)/login/page.tsx` | Admin credentials login | Working | No rate limiting, no lockout |
| Requests list | `/requests` | `src/app/(dashboard)/requests/page.tsx` | List all content requests | Working | No pagination, no filtering |
| Create request | `/requests/new` | `src/app/(dashboard)/requests/new/page.tsx` | Form to create content request | Working | No draft-directly-from-form option |
| Drafts grid | `/drafts` | `src/app/(dashboard)/drafts/page.tsx` | Grid of all draft cards | Working | No pagination, no status filter |
| Draft review | `/drafts/[id]` | `src/app/(dashboard)/drafts/[id]/page.tsx` | Full draft review with approve/reject | Partial | No edit functionality, admin notes editable? |
| Publish queue | `/queue` | `src/app/(dashboard)/queue/page.tsx` | Table of publish jobs, manual mark-published | Partial | Marking published does not actually publish |
| Settings | `/settings` | `src/app/(dashboard)/settings/page.tsx` | Meta OAuth connection management | Partial | No token status, no refresh, connect works |

---

## 7. Components Audit

| Component | File | Purpose | Status | Issues |
|---|---|---|---|---|
| `Sidebar` | `components/layout/sidebar.tsx` | Fixed navigation | Working | Hard-coded nav items |
| `Topbar` | `components/layout/topbar.tsx` | Page header + optional action | Working | None |
| `RequestForm` | `components/requests/request-form.tsx` | Create content request form | Working | None |
| `RequestsTable` | `components/requests/requests-table.tsx` | Table of requests | Working | No sorting, no pagination |
| `DraftCard` | `components/drafts/draft-card.tsx` | Grid card for draft list | Working | Status may be stale without real-time updates |
| `DraftContentPanel` | `components/drafts/draft-content-panel.tsx` | Read-only display of draft content | Working | No edit mode |
| `DraftMetaPanel` | `components/drafts/draft-meta-panel.tsx` | Request meta + action buttons | Working | No confirmation on approve |
| `RevisionNotesInput` | `components/drafts/revision-notes-input.tsx` | Textarea for revision/rejection notes | Working | None |
| `QueueTable` | `components/queue/queue-table.tsx` | Publish jobs table | Partial | "Mark Published" doesn't actually publish |
| `EmptyState` | `components/shared/empty-state.tsx` | Empty placeholder UI | Working | None |
| `LoadingSkeleton` | `components/shared/loading-skeleton.tsx` | Table/grid skeleton loaders | Working | None |
| `ConfirmDialog` | `components/shared/confirm-dialog.tsx` | Modal confirmation | Working | None |
| `StatusBadge` | `components/shared/status-badge.tsx` | Colored status chips | Working | Labels duplicated between here and `types/index.ts` |
| shadcn/ui primitives | `components/ui/` | Base UI atoms | Working | Standard shadcn, no issues |

**No dead components found.** All components are imported and used.

---

## 8. State Management Audit

### Pattern: React Query for all server state

All server data is managed exclusively through TanStack React Query hooks:
- `useRequests`, `useCreateRequest`, `useDeleteRequest` — `["requests"]`
- `useDrafts`, `useDraft(id)`, `useApproveDraft`, `useRejectDraft`, `useRequestRevision` — `["drafts"]` / `["drafts", id]`
- `usePublishJobs`, `useMarkPublished` — `["publish-jobs"]`
- `useMetaConnections`, `useDisconnectMeta` — `["meta-connections"]`

### Pattern: Local state for UI-only state

- Confirmation dialogs use `useState<string | null>` for the target ID
- `approved` banner state in draft review (`useState(false)`) — **Risk:** this state is lost on page refresh; the banner disappears but the underlying draft is still approved

### Issues

1. **`approved` state in `drafts/[id]/page.tsx`:** After approving, `setApproved(true)` shows a banner. But this is purely local. On page refresh, the banner is gone and the draft just shows "APPROVED" status. This is cosmetically fine but slightly misleading during the session if the user navigates away and back.

2. **No optimistic updates:** All mutations wait for server confirmation before updating the UI. This is safe but feels slow.

3. **No global error boundary:** Unhandled React Query errors could crash individual components silently.

4. **Query stale time:** Default 60s via `QueryProvider`. Drafts or jobs modified by the external agent will not appear in real-time — admin must wait up to 60s or manually refresh.

5. **No cross-key invalidation between requests and drafts:** When a draft is approved (which also changes the request's status to COMPLETED), the `["requests"]` cache is NOT invalidated. The Requests page will show stale status until the stale time expires.

   - `useApproveDraft` invalidates: `["drafts"]`, `["drafts", id]`
   - Does NOT invalidate: `["requests"]`
   - Same issue for `useRejectDraft` and `useRequestRevision`

---

## 9. API Layer Audit

### Internal API Routes

| Route | Method | File | Purpose | Auth | Status |
|---|---|---|---|---|---|
| `/api/requests` | GET | `api/requests/route.ts` | List all requests with draft status | Session | Working |
| `/api/requests` | POST | `api/requests/route.ts` | Create content request | Session | Working |
| `/api/requests/[id]` | GET | `api/requests/[id]/route.ts` | Get single request with full draft | Session | Working |
| `/api/requests/[id]` | PATCH | `api/requests/[id]/route.ts` | Update request fields | Session | Working |
| `/api/requests/[id]` | DELETE | `api/requests/[id]/route.ts` | Delete request (only if NEW) | Session | Working |
| `/api/drafts` | GET | `api/drafts/route.ts` | List all drafts | Session | Working |
| `/api/drafts` | POST | `api/drafts/route.ts` | Create draft manually (no UI uses this) | Session | Working but unused by UI |
| `/api/drafts/[id]` | GET | `api/drafts/[id]/route.ts` | Get single draft with request + job | Session | Working |
| `/api/drafts/[id]` | PATCH | `api/drafts/[id]/route.ts` | Update draft fields | Session | Working but no UI |
| `/api/drafts/[id]/approve` | POST | `api/drafts/[id]/approve/route.ts` | Approve draft → creates PublishJob | Session | Working |
| `/api/drafts/[id]/reject` | POST | `api/drafts/[id]/reject/route.ts` | Reject draft | Session | Working |
| `/api/drafts/[id]/request-revision` | POST | `api/drafts/[id]/request-revision/route.ts` | Request revision | Session | Working |
| `/api/publish-jobs` | GET | `api/publish-jobs/route.ts` | List all publish jobs | Session | Working |
| `/api/publish-jobs/[id]/mark-published` | POST | `api/publish-jobs/[id]/mark-published/route.ts` | Manually mark job published (no actual API call) | Session | Broken — fake |
| `/api/agent/intake` | POST | `api/agent/intake/route.ts` | External agent submits draft | X-Agent-Key | Working |
| `/api/meta/auth-url` | GET | `api/meta/auth-url/route.ts` | Generate Meta OAuth URL | Session | Working |
| `/api/meta/callback` | GET | `api/meta/callback/route.ts` | OAuth callback — exchange code, store tokens | Session | Partially working |
| `/api/meta/connections` | GET | `api/meta/connections/route.ts` | List active Meta connections | Session | Working |
| `/api/meta/connections/[id]` | DELETE | `api/meta/connections/[id]/route.ts` | Disconnect (soft delete) Meta connection | Session | Working (soft delete only) |
| `/api/auth/[...nextauth]` | GET/POST | `api/auth/[...nextauth]/route.ts` | NextAuth handlers | Public | Working |

### External API Calls

| External API | Called From | Purpose | Method | Status |
|---|---|---|---|---|
| `graph.facebook.com/v19.0/oauth/access_token` | `meta/callback/route.ts:31-38` | Short-lived token exchange | GET | Working |
| `graph.facebook.com/v19.0/oauth/access_token` | `meta/callback/route.ts:49-56` | Long-lived token exchange | GET | Working |
| `graph.facebook.com/v19.0/me/accounts` | `meta/callback/route.ts:74-76` | Fetch managed pages | GET | Working |
| `graph.facebook.com/v19.0/{pageId}?fields=instagram_business_account` | `meta/callback/route.ts:109-112` | Fetch linked Instagram account | GET | Working |
| `graph.facebook.com/v19.0/{igAccountId}?fields=id,username` | `meta/callback/route.ts:122-127` | Fetch Instagram username | GET | Working |
| Meta Graph API (publish to page) | **Does not exist** | Post content to Facebook | — | **NOT IMPLEMENTED** |
| Meta Graph API (publish to Instagram) | **Does not exist** | Post content to Instagram | — | **NOT IMPLEMENTED** |

### API Request Visibility Issue — Root Cause Analysis

The user reported "the system does not show all API requests properly." After inspecting every file in the codebase:

**Root cause: The feature does not exist at all.**

There is:
- No request logging table in Prisma schema
- No request interceptor or middleware that captures outgoing/incoming API calls
- No admin UI panel to view request logs
- No history component in the dashboard
- Only `console.error(...)` in a few API routes on error paths — these are invisible to the admin

This is not a bug in a partially implemented feature. It is a missing feature entirely. To fix this, you would need to:
1. Add an `ApiLog` table to the schema
2. Instrument outgoing Meta API calls to write log entries
3. Build a UI component to display log history

---

## 10. Facebook Integration Audit

### What is implemented

| Component | File | Status |
|---|---|---|
| OAuth URL generation | `api/meta/auth-url/route.ts` | Working |
| OAuth callback handler | `api/meta/callback/route.ts` | Working |
| Short → long-lived token exchange | `callback/route.ts:31-66` | Working |
| Fetch managed pages | `callback/route.ts:72-84` | Working |
| Upsert MetaConnection per page | `callback/route.ts:91-106` | Working |
| Token encryption at rest | `lib/meta-token.ts` | Working |
| List active connections | `api/meta/connections/route.ts` | Working |
| Soft-disconnect connection | `api/meta/connections/[id]/route.ts` | Working (soft-delete only) |
| Display connection state in UI | `settings/page.tsx` | Working |
| Token expiry display | `settings/page.tsx:18-25` | Working (display only) |

### What is missing / broken

| Gap | Severity | Notes |
|---|---|---|
| **No actual post publishing** | Critical | No code calls `/{pageId}/feed` or any publishing endpoint |
| No CSRF state in OAuth | High | OAuth URL has no `state` param; callback cannot verify origin |
| Tokens passed in URL params | High | Should use `Authorization: Bearer` header instead |
| No token refresh | High | 60-day tokens expire silently; no refresh_token flow |
| Soft-delete only disconnect | Medium | Token is not revoked with Meta on disconnect |
| No error state for expired tokens | Medium | UI shows expiry countdown but publishing would fail silently |
| Hardcoded Graph API version | Low | `v19.0` hardcoded; not future-proofed |

### To make Facebook publishing work end-to-end

1. Implement `POST /{page_id}/feed` call with `message` and optional `link` fields for text/link posts
2. Implement `POST /{page_id}/photos` for image posts with `url` field
3. For video/reels, implement the video upload flow (resumable upload API)
4. Decrypt stored token with `decrypt()` from `lib/meta-token.ts` before use
5. Handle `OAuthException` errors and trigger re-auth when token is expired
6. Add CSRF `state` parameter to OAuth URL and validate it in callback
7. Move access tokens from URL query params to `Authorization` headers

---

## 11. Instagram Integration Audit

### What is implemented

| Component | File | Status |
|---|---|---|
| Detect linked Instagram business account | `callback/route.ts:108-117` | Working |
| Fetch Instagram username | `callback/route.ts:122-127` | Working |
| Upsert MetaConnection for Instagram | `callback/route.ts:130-147` | Working — uses page access token |
| Display Instagram connection in settings UI | `settings/page.tsx:290-294` | Working |

### What is missing / broken

| Gap | Severity | Notes |
|---|---|---|
| **No publishing implementation** | Critical | No calls to Instagram Content Publishing API |
| No media container creation step | Critical | Instagram requires: (1) create container, (2) publish container |
| No image/video hosting | Critical | Instagram requires publicly accessible media URLs |
| Personal accounts not supported | High | Only Instagram Business accounts linked to FB Pages work |
| No reels/stories/carousel publishing logic | High | Each content type needs different API calls |
| No token refresh | High | Same issue as Facebook |

### Instagram-specific technical requirements (not implemented)

Publishing to Instagram via the Meta API requires a two-step process:
1. `POST /{ig-user-id}/media` — Create a media container with `image_url` (must be publicly accessible)
2. `POST /{ig-user-id}/media_publish` — Publish the container

None of this logic exists anywhere in the codebase. The `instagramCaption` and `hashtags` fields are stored in the draft but never sent to any API.

### To make Instagram publishing work end-to-end

1. Ensure content has a publicly accessible media URL (requires image/CDN hosting, which doesn't exist)
2. Implement media container creation step
3. Implement media publish step
4. Handle carousel (multiple containers → single publish)
5. Handle reels (video upload endpoint)
6. Handle stories (different endpoint, 24h TTL)
7. Account for Instagram's stricter rate limits

---

## 12. Agent / Automation Logic Audit

### What exists

The repository contains **one endpoint** related to agent functionality:

- `POST /api/agent/intake` — accepts a draft payload from an external agent and stores it

This endpoint:
- Validates authentication via `X-Agent-Key` header
- Validates the payload with Zod schema
- Creates a Draft record in the database
- Updates the ContentRequest status
- Creates a DraftRevision audit record

### What does NOT exist

| Missing Feature | Description |
|---|---|
| Agent process itself | No agent code lives in this repo |
| Scheduling logic | No cron, no task queue, no scheduler |
| Retry flows | No retry on failed publishes |
| Background job queue | No BullMQ, Agenda, or similar |
| Content generation | No LLM integration, no prompt templating |
| Orchestration | No multi-step flow controller |
| Agent state machine | No state tracking for what the agent is doing |
| Webhook receivers | No endpoint to receive webhooks from Meta or elsewhere |

### Verdict

This system is **not an agent** — it is a **dashboard that receives output from an external agent**. The "agent" label refers to an external system (not built here) that calls `/api/agent/intake`. The dashboard is a review UI and publish queue manager, not an autonomous agent.

The `AGENT_API_KEY` protects an intake endpoint. That is the entirety of the "agent" integration.

---

## 13. Environment Variables / Configuration Audit

| Variable | Used In | Purpose | Required | Risk If Missing |
|---|---|---|---|---|
| `DATABASE_URL` | `prisma/schema.prisma` | Prisma connection (pgbouncer pooled) | Yes | App cannot start |
| `DIRECT_URL` | `prisma/schema.prisma` | Direct connection for migrations | Yes | Migrations fail |
| `NEXTAUTH_SECRET` | NextAuth internals | JWT signing | Yes | Auth broken |
| `AUTH_SECRET` | NextAuth internals | Alternative to NEXTAUTH_SECRET | Yes | Auth broken |
| `NEXTAUTH_URL` | NextAuth internals | Redirect base URL | Yes | OAuth redirects break |
| `ADMIN_EMAIL` | `lib/auth.ts:26` | Admin login email | Yes | Login impossible |
| `ADMIN_PASSWORD` | `lib/auth.ts:27` | Admin login password | Yes | Login impossible |
| `AGENT_API_KEY` | `api/agent/intake/route.ts:41` | Agent API authentication | Yes | Agent intake unauthorized |
| `META_APP_ID` | `api/meta/auth-url/route.ts:20`, `callback/route.ts:33,34` | Facebook OAuth app ID | Yes | OAuth flow broken |
| `META_APP_SECRET` | `callback/route.ts:34,53` | Facebook OAuth app secret | Yes | Token exchange fails |
| `META_REDIRECT_URI` | `api/meta/auth-url/route.ts:21`, `callback/route.ts:35` | OAuth callback URL | Yes | OAuth redirect broken |
| `TOKEN_ENCRYPTION_KEY` | `lib/meta-token.ts:7` | AES-256-GCM encryption key (64-char hex) | Yes | Token storage/retrieval fails |

### Security Issues with Current Configuration

1. **`.env` and `.env.local` in repository** — Both files contain the real Supabase database password, real Meta App Secret, real encryption key, and real agent API key. If this repository is or has ever been public or shared, all credentials must be rotated immediately.

2. **`.env.example` contains real Meta App ID and Secret** — Example files should use placeholder values like `your_meta_app_secret_here`, not real credentials.

3. **Hardcoded Graph API version** — `v19.0` is hardcoded in two files (`auth-url/route.ts:4` and `callback/route.ts:6`). Meta periodically deprecates API versions.

4. **No validation on startup** — The app will start even if required env vars are missing. The first request that needs them will throw a runtime error.

5. **`ADMIN_PASSWORD` stored in plaintext** — Compared directly to user input with `===`. No hashing. If the env file is exposed, the password is exposed.

---

## 14. Data Models / Types / Schemas Audit

### Prisma Schema Models (ground truth)

| Model | Key Fields | Relationships |
|---|---|---|
| `ContentRequest` | id, title, platform(INSTAGRAM/FACEBOOK/BOTH), contentType(POST/STORY/CAROUSEL/REEL), status | → Draft (optional, cascade) |
| `Draft` | id, requestId(unique), format, hook, facebookCaption, instagramCaption, storyFrames(JSON), hashtags(array), status, version | → ContentRequest, → PublishJob, → DraftRevision[] |
| `PublishJob` | id, draftId(unique), platform, scheduledDate, publishedAt, status, publishMethod, externalPostId, publishedUrl, failureReason, metaRequestId | → Draft (cascade) |
| `MetaConnection` | id, platform(INSTAGRAM/FACEBOOK), pageId, pageName, encryptedToken, tokenExpiresAt, isActive | Unique on (platform, pageId) |
| `DraftRevision` | id, draftId, version, snapshot(JSON), changedBy(AGENT/ADMIN), changeNote | → Draft (cascade) |

### Type Mismatches (Critical)

**`src/types/index.ts` is INCONSISTENT with `prisma/schema.prisma`:**

| Discrepancy | `types/index.ts` | `schema.prisma` | Impact |
|---|---|---|---|
| `ContentType.ARTICLE` | Exists | Does NOT exist | If used in a form, will fail Prisma validation |
| `Platform.LINKEDIN` | Exists | Does NOT exist | Would break DB write if selected |
| `Platform.TWITTER` | Exists | Does NOT exist | Would break DB write if selected |
| `Platform.TIKTOK` | Exists | Does NOT exist | Would break DB write if selected |
| `ContentRequest.description` | Defined in interface | Does NOT exist in schema | Interface doesn't match DB |
| `ContentRequest.dueDate` | Defined as `dueDate` | Schema uses `targetPublishDate` | Field name mismatch |
| `Draft.content` | Defined as `content: string` | Schema has many separate fields | Interface is completely wrong |
| `PublishJob.scheduledAt` | Defined as `scheduledAt` | Schema uses `scheduledDate` | Field name mismatch |

**The interfaces in `types/index.ts` appear to be an early stub that was never updated after the schema was refined.** In practice, the hooks in `/hooks/` define their own inline types (`DraftForList`, `DraftFull`, etc.) which are correct. The interfaces in `types/index.ts` are not used by the hooks or components — only the enums and label maps are referenced.

This means the interfaces are dead code but the mismatches are still dangerous if anyone adds new code that imports them.

---

## 15. Error Handling / Observability Audit

### Error Handling Patterns

| Location | Pattern | Quality |
|---|---|---|
| API routes | `try/catch` with `NextResponse.json({error})` | Adequate |
| React Query hooks | `throw new Error(body.error)` on non-ok responses | Adequate |
| UI components | `toast.error(...)` on mutation failure | Adequate for user feedback |
| OAuth callback | Specific error codes redirected to `/settings?meta_error=...` | Good |
| Meta token | Throws on missing/malformed key | Good |
| Agent intake | `console.error` + 500 response | Minimal |

### Logging

- **All logging is `console.error()` to server stdout** — visible only in Vercel logs or local terminal
- No structured logging (no JSON format, no correlation IDs)
- No log levels (debug, info, warn)
- No request tracing
- Admin has **zero visibility** into what's happening on the server

### Missing Observability

- No APM (Sentry, Datadog, etc.)
- No server-side error capture
- No request ID propagation
- No Meta API response logging
- No token expiry monitoring
- No failed publish job alerting

### Empty/Error/Loading States

All pages implement loading skeletons and error states with retry buttons. This is a strength of the UI layer. However:

- The `isError` state in hooks does not distinguish between a network error, a 401 (session expired), and a 500. The user just sees "שגיאה בטעינת..." (error loading...).
- A 401 response should redirect to `/login`, but it doesn't — the user sees an error and a retry button instead.

---

## 16. Bug / Risk Inventory

### Critical

| # | Title | Area | Description | Likely Cause | Impact | Fix Direction |
|---|---|---|---|---|---|---|
| C1 | Publishing does nothing | Publish flow | `mark-published` only updates DB; no Meta API call is made | Feature not built | Users think content is published when it isn't | Implement Graph API publishing calls |
| C2 | Real credentials in repo | Security | `.env`, `.env.local`, `.env.example` contain real DB password, Meta secret, encryption key | Committed by mistake | Credential exposure; potential unauthorized access | Remove from git history, rotate all secrets |
| C3 | No API request visibility | Observability | No logging, no request history UI | Feature never built | Admin cannot diagnose failures | Add ApiLog model + instrumentation + UI |
| C4 | Types completely wrong | Data integrity | `types/index.ts` interfaces don't match Prisma schema | Stale stub file | Any code using these interfaces will produce bugs | Fix or delete the interfaces |

### High

| # | Title | Area | Description | Likely Cause | Impact | Fix Direction |
|---|---|---|---|---|---|---|
| H1 | No token refresh | Meta OAuth | Tokens expire after ~60 days with no renewal mechanism | Not implemented | Publishing fails silently after 60 days | Implement token refresh using long-lived token exchange |
| H2 | No OAuth CSRF protection | Security | No `state` parameter in OAuth URL | Not implemented | CSRF attack possible via forged callback | Add and validate `state` parameter |
| H3 | Tokens in URL params | Security | Graph API calls pass `access_token` in URL query string | Convenience shortcut | Token visible in server logs | Move to `Authorization: Bearer` headers |
| H4 | No cross-entity cache invalidation | State | Approving/rejecting drafts doesn't invalidate `["requests"]` cache | Missing `queryClient.invalidateQueries` | Stale request status in UI after draft actions | Add request cache invalidation in draft mutations |
| H5 | No admin edit UI for drafts | UX | PATCH endpoint exists but no UI exposes it | Not built | Admin must approve drafts as-is, even if content needs tweaks | Build draft edit form component |
| H6 | No session expiry handling | Auth | 401 responses don't redirect to login | Not handled in hooks | User stuck on broken UI with no path to re-auth | Add global 401 interceptor in QueryProvider |

### Medium

| # | Title | Area | Description | Likely Cause | Impact | Fix Direction |
|---|---|---|---|---|---|---|
| M1 | Soft-delete only for disconnect | Meta | Disconnect only sets `isActive=false`, doesn't revoke with Meta | Not implemented | Token remains valid at Meta even after "disconnection" | Call Meta's token revocation endpoint |
| M2 | No notification system | Workflow | Admin not notified when new draft arrives | Not implemented | Admin must manually poll the dashboard | Add email/webhook notification on new draft |
| M3 | No pagination | Performance | All requests/drafts/jobs loaded at once | Not implemented | Will slow down as data grows | Add pagination to all list endpoints |
| M4 | RequestStatus `IN_PROGRESS` never set | Workflow | Status exists but nothing transitions to it | No implementation | Status enum is misleading | Either remove or implement a trigger |
| M5 | `approved` banner is transient | UX | Banner disappears on page refresh | Uses `useState` instead of derived state from draft | Slightly confusing UX | Derive from `draft.status === "APPROVED"` and `publishJob` presence |
| M6 | No image/media support | Core feature | No way to attach media to posts | Not built | Text-only posts; cannot use full social format capabilities | Add media upload + CDN hosting |

### Low

| # | Title | Area | Description | Likely Cause | Impact | Fix Direction |
|---|---|---|---|---|---|---|
| L1 | Hardcoded Graph API version | Config | `v19.0` hardcoded in two files | Not configurable | Breaking change if Meta deprecates version | Move to env var |
| L2 | Hebrew-only UI | i18n | All labels and errors hardcoded in Hebrew | Design decision | Non-Hebrew speakers cannot use the tool | No action needed if single team, document for future |
| L3 | No tests | Quality | Zero test coverage | Not written | Regressions go undetected | Add unit tests for API routes + integration tests |
| L4 | `next.config.ts` is empty | Security | No security headers, no Content-Security-Policy | Not configured | Minor security exposure | Add HTTP security headers |
| L5 | `POST /api/drafts` unused by UI | Dead route | Manual draft creation endpoint exists but no UI form uses it | Leftover from early development | Dead code | Remove or document intent |

---

## 17. Dead Code / Partial Implementations / TODOs

### Dead Code

1. **`types/index.ts` — Interfaces block (lines 89-126):** The `ContentRequest`, `Draft`, `PublishJob`, and `User` interfaces are never imported by any hook or component. They are stale stubs. Only the enums and label maps from this file are actually used.

2. **`POST /api/drafts`:** An API route to create drafts manually from a form exists, but no UI component calls it. The only draft creation path is via the agent intake endpoint.

3. **`PATCH /api/drafts/[id]`:** The draft update endpoint is fully implemented (increments version, creates revision, sets status to EDITED) but no UI component uses it.

4. **`ContentType.ARTICLE` in types:** Defined in `types/index.ts` but not in Prisma schema. Cannot be created, stored, or queried.

5. **`Platform.LINKEDIN`, `.TWITTER`, `.TIKTOK` in types:** Same — in types but not in schema or any real integration.

### Partial Implementations

1. **`PublishJob.scheduledDate`:** Field exists in schema, status `SCHEDULED` exists in enum, but no code ever sets or reads scheduled dates. Scheduling is entirely unimplemented.

2. **`PublishJob.externalPostId` / `publishedUrl` / `metaRequestId` / `failureReason`:** All defined in schema, none ever populated.

3. **`RequestStatus.IN_PROGRESS`:** Status exists but nothing transitions a request to this status.

4. **`PublishMethod.AUTO`:** Enum value exists, but all jobs are set to `MANUAL`. Auto-publishing doesn't exist.

### TODO/FIXME Comments

**None found in any file.** The codebase has no TODO or FIXME markers. This is not necessarily a sign of clean code — it may mean partially implemented features were written without marking them as such.

### Mock / Placeholder Logic

1. **`mark-published` endpoint:** This is the most significant placeholder. It is presented as "publishing" but does no publishing. It is a database status flip, not a real publish action.

---

## 18. Production Readiness Assessment

**Can this system be used today?**

For **content request management and draft review**: Yes, partially. The CRUD flows work. An admin can create requests, review drafts, approve/reject, and see the queue.

For **actual social media publishing**: No. Nothing is ever posted to Facebook or Instagram. The system is a content management tool that produces a queue of approved posts, but stops there.

**What prevents production readiness?**

| Blocker | Severity |
|---|---|
| No actual publishing to Meta platforms | Critical |
| Credentials committed to version control | Critical |
| No API request visibility / logging | High |
| No token refresh mechanism | High |
| No image/media hosting | High |
| No background job processing | High |
| No error alerting | High |
| Single admin, no multi-user | Medium |
| No tests | Medium |

**Top blockers before adding new features:**

1. Rotate all credentials and remove from git history
2. Implement actual Meta Graph API publishing calls
3. Add token refresh before tokens expire
4. Add OAuth CSRF protection
5. Fix type mismatches in `types/index.ts`

---

## 19. Recommended Repair Plan

### Phase 1: Stop the Bleeding (Security & Foundation)

**Goal:** Ensure the codebase is safe and trustworthy.

**Areas:**
- Remove `.env` and `.env.local` from git tracking (add to `.gitignore` if not already)
- Rotate Supabase database password
- Rotate Meta App Secret
- Rotate `TOKEN_ENCRYPTION_KEY` (and re-encrypt stored tokens)
- Change default admin credentials
- Add `.env.example` with **placeholder** values only
- Fix `types/index.ts` — either delete the stale interfaces or update them to match Prisma schema
- Add `state` parameter to Meta OAuth URL and validate in callback
- Add security headers in `next.config.ts`

**Expected outcome:** Safe, deployable codebase with no credential exposure.

---

### Phase 2: Fix Core API Visibility

**Goal:** Admin can see what API calls are being made and debug failures.

**Areas:**
- Add `ApiLog` model to Prisma schema: `id, timestamp, direction (OUTGOING/INCOMING), method, url, statusCode, responseBody, durationMs, error`
- Wrap all outgoing Meta Graph API calls in a logging utility
- Add `GET /api/logs` endpoint
- Build a Logs panel in the dashboard sidebar
- Display log entries with status, URL, timestamp, response summary
- Add filtering by status (success/failure) and date range

**Expected outcome:** Admin can see all Meta API interactions and debug them.

---

### Phase 3: Fix Auth + Facebook/Instagram Connectivity

**Goal:** Tokens work correctly and don't expire silently.

**Areas:**
- Move access tokens from URL query parameters to `Authorization: Bearer` headers in all Graph API calls
- Implement token refresh endpoint (`POST /api/meta/connections/[id]/refresh`) that exchanges current long-lived token for a new one
- Add a background check (or on-demand check) for token expiry — show warning in Settings when token expires in < 7 days
- Implement actual token revocation on disconnect (`DELETE /{token}` with Meta)
- Add `state` CSRF parameter (Phase 1 prerequisite)
- Test OAuth flow end-to-end in a Meta Test App environment

**Expected outcome:** Tokens are stable, refreshable, and securely used.

---

### Phase 4: Stabilize Publishing Flows

**Goal:** Drafts actually get published to social platforms.

**Areas:**
- Choose publishing architecture: synchronous (in the request handler) or asynchronous (background worker). Given Vercel's execution limits, a background worker or external queue is recommended.
- Implement `publishToFacebook(job, token)` function: `POST /{page_id}/feed` with caption + optional media
- Implement `publishToInstagram(job, token)` function: two-step container create + publish
- Handle media uploads: integrate a CDN or image hosting solution; Instagram requires public image URLs
- Populate `externalPostId`, `publishedUrl`, `publishedAt` from Meta API responses
- Implement error handling: on failure, set `failureReason`, set status to `FAILED`
- Add retry logic for transient failures (rate limits, temporary errors)
- Handle `BOTH` platform — publish to both Facebook and Instagram in sequence or parallel
- Add `scheduledDate` to publish queue UI so scheduled posts are supported

**Expected outcome:** Approved drafts are actually published to Meta platforms.

---

### Phase 5: Harden UX / Observability / Cleanup

**Goal:** Production-quality UX, observability, and code health.

**Areas:**
- Add draft edit form (expose the PATCH endpoint in the UI)
- Fix cross-entity React Query cache invalidation (approve draft → invalidate requests)
- Add global 401 interceptor to redirect to login on session expiry
- Add pagination to requests/drafts/queue (offset or cursor)
- Add admin notification when new draft arrives (email or webhook)
- Remove dead code (`types/index.ts` interfaces, unused POST /api/drafts UI path)
- Add unit tests for all API route handlers
- Add integration tests for OAuth flow and publish flow
- Add Sentry or similar error monitoring
- Move hardcoded Graph API version to env var
- Add proper TypeScript types for all API responses (replace `unknown` patterns)

**Expected outcome:** Stable, observable, maintainable system ready for regular use.

---

## 20. Most Important Files

| Priority | File | Why It Matters |
|---|---|---|
| 1 | `prisma/schema.prisma` | Ground truth for all data models; every feature depends on this |
| 2 | `src/app/api/meta/callback/route.ts` | Most complex backend logic; OAuth token exchange + storage; broken security patterns here |
| 3 | `src/lib/meta-token.ts` | Token encryption; if this breaks, all Meta connections break |
| 4 | `src/app/api/publish-jobs/[id]/mark-published/route.ts` | The core of the publish flow — currently a no-op that must be replaced |
| 5 | `src/app/api/agent/intake/route.ts` | The only integration point with the external agent system |
| 6 | `src/types/index.ts` | Contains critical type mismatches; dangerous if used naively |
| 7 | `src/lib/auth.ts` | All auth logic; understand this before touching sessions |
| 8 | `src/lib/auth.config.ts` | Route protection rules; agent API exemption lives here |
| 9 | `src/hooks/use-drafts.ts` | Most complex hook; all draft lifecycle mutations |
| 10 | `.env` / `.env.local` | **Must be removed from version control immediately** |

---

## 21. Final Verdict

### What this project currently is

A **functional content management dashboard** with a working review workflow. The CRUD operations for requests and drafts are solid. The UI is clean, well-structured, and the React Query + Prisma stack is appropriate for the problem. The Meta OAuth connect flow works and stores tokens correctly.

### What it is not yet

- It is **not a publishing system** — nothing is ever posted to social media.
- It is **not an agent** — there is no autonomous logic, just an intake API endpoint.
- It is **not observable** — there is no way to see what's happening at the API layer.
- It is **not production-safe** — credentials are committed to the repository.

### What is salvageable

Essentially all of it. The foundation is correct. The schema is well-designed. The API architecture is clean. The UI is polished. The OAuth flow gets you most of the way to Facebook/Instagram publishing — it just stops at "store the token" and never uses it.

The biggest single piece of work is implementing the actual publish call to the Meta Graph API and building the supporting infrastructure (media hosting, background worker, token refresh). Everything else is hardening and observability.

### What should be tackled immediately

1. **Credential rotation and git cleanup** — This is a fire that is burning right now.
2. **Implement actual Meta publishing** — Until this exists, the system has no core value.
3. **Build API request visibility** — Without this, debugging any Meta issue is impossible.
4. **Fix the type mismatches** — They are a time bomb for anyone extending the codebase.

---

## Appendix A — Route Inventory

| Route | Type | File | Auth Required |
|---|---|---|---|
| `/` | Page | `src/app/page.tsx` | Session (redirects) |
| `/login` | Page | `src/app/(auth)/login/page.tsx` | No |
| `/requests` | Page | `src/app/(dashboard)/requests/page.tsx` | Session |
| `/requests/new` | Page | `src/app/(dashboard)/requests/new/page.tsx` | Session |
| `/drafts` | Page | `src/app/(dashboard)/drafts/page.tsx` | Session |
| `/drafts/[id]` | Page | `src/app/(dashboard)/drafts/[id]/page.tsx` | Session |
| `/queue` | Page | `src/app/(dashboard)/queue/page.tsx` | Session |
| `/settings` | Page | `src/app/(dashboard)/settings/page.tsx` | Session |
| `/api/auth/[...nextauth]` | API | `src/app/api/auth/[...nextauth]/route.ts` | No |
| `/api/requests` | API GET/POST | `src/app/api/requests/route.ts` | Session |
| `/api/requests/[id]` | API GET/PATCH/DELETE | `src/app/api/requests/[id]/route.ts` | Session |
| `/api/drafts` | API GET/POST | `src/app/api/drafts/route.ts` | Session |
| `/api/drafts/[id]` | API GET/PATCH | `src/app/api/drafts/[id]/route.ts` | Session |
| `/api/drafts/[id]/approve` | API POST | `src/app/api/drafts/[id]/approve/route.ts` | Session |
| `/api/drafts/[id]/reject` | API POST | `src/app/api/drafts/[id]/reject/route.ts` | Session |
| `/api/drafts/[id]/request-revision` | API POST | `src/app/api/drafts/[id]/request-revision/route.ts` | Session |
| `/api/publish-jobs` | API GET | `src/app/api/publish-jobs/route.ts` | Session |
| `/api/publish-jobs/[id]/mark-published` | API POST | `src/app/api/publish-jobs/[id]/mark-published/route.ts` | Session |
| `/api/agent/intake` | API POST | `src/app/api/agent/intake/route.ts` | X-Agent-Key header |
| `/api/meta/auth-url` | API GET | `src/app/api/meta/auth-url/route.ts` | Session |
| `/api/meta/callback` | API GET | `src/app/api/meta/callback/route.ts` | Session |
| `/api/meta/connections` | API GET | `src/app/api/meta/connections/route.ts` | Session |
| `/api/meta/connections/[id]` | API DELETE | `src/app/api/meta/connections/[id]/route.ts` | Session |

---

## Appendix B — API Inventory

### Internal APIs (already in Section 9 — summarized here)

| Endpoint | Method | Status |
|---|---|---|
| `/api/requests` | GET, POST | Working |
| `/api/requests/[id]` | GET, PATCH, DELETE | Working |
| `/api/drafts` | GET, POST | Working (POST has no UI) |
| `/api/drafts/[id]` | GET, PATCH | Working (PATCH has no UI) |
| `/api/drafts/[id]/approve` | POST | Working |
| `/api/drafts/[id]/reject` | POST | Working |
| `/api/drafts/[id]/request-revision` | POST | Working |
| `/api/publish-jobs` | GET | Working |
| `/api/publish-jobs/[id]/mark-published` | POST | Broken (placeholder) |
| `/api/agent/intake` | POST | Working |
| `/api/meta/auth-url` | GET | Working |
| `/api/meta/callback` | GET | Partial |
| `/api/meta/connections` | GET | Working |
| `/api/meta/connections/[id]` | DELETE | Working (soft-delete only) |

### External APIs Called

| API | Endpoint | Called From | Status |
|---|---|---|---|
| Meta Graph API | `GET /v19.0/oauth/access_token` (short token) | `meta/callback` | Working |
| Meta Graph API | `GET /v19.0/oauth/access_token` (long token) | `meta/callback` | Working |
| Meta Graph API | `GET /v19.0/me/accounts` | `meta/callback` | Working |
| Meta Graph API | `GET /v19.0/{pageId}?fields=instagram_business_account` | `meta/callback` | Working |
| Meta Graph API | `GET /v19.0/{igId}?fields=id,username` | `meta/callback` | Working |
| Meta Graph API | `POST /v19.0/{pageId}/feed` | **Not called** | Missing |
| Meta Graph API | `POST /v19.0/{igUserId}/media` | **Not called** | Missing |
| Meta Graph API | `POST /v19.0/{igUserId}/media_publish` | **Not called** | Missing |

---

## Appendix C — Env Variable Inventory

| Variable | Files That Reference It | Required | Notes |
|---|---|---|---|
| `DATABASE_URL` | `prisma/schema.prisma` | Yes | Supabase pgbouncer URL |
| `DIRECT_URL` | `prisma/schema.prisma` | Yes | Direct Supabase URL for migrations |
| `NEXTAUTH_SECRET` | NextAuth internals | Yes | JWT signing secret |
| `AUTH_SECRET` | NextAuth internals | Yes | Appears alongside NEXTAUTH_SECRET |
| `NEXTAUTH_URL` | NextAuth internals | Yes | App base URL |
| `ADMIN_EMAIL` | `src/lib/auth.ts:26` | Yes | Admin login email |
| `ADMIN_PASSWORD` | `src/lib/auth.ts:27` | Yes | Admin login password (plaintext) |
| `AGENT_API_KEY` | `src/app/api/agent/intake/route.ts:41` | Yes | X-Agent-Key value |
| `META_APP_ID` | `api/meta/auth-url/route.ts:20`, `callback/route.ts:33,34` | Yes | Facebook OAuth app ID |
| `META_APP_SECRET` | `callback/route.ts:34,53` | Yes | Facebook OAuth app secret |
| `META_REDIRECT_URI` | `auth-url/route.ts:21`, `callback/route.ts:35` | Yes | OAuth callback URL (must match Facebook app config) |
| `TOKEN_ENCRYPTION_KEY` | `src/lib/meta-token.ts:7` | Yes | 64-char hex = 32 bytes for AES-256 |

---

## Appendix D — Social Integration Files

### Facebook / Instagram / Meta related files

| File | Role |
|---|---|
| `src/app/api/meta/auth-url/route.ts` | Generates Facebook OAuth login URL with scopes |
| `src/app/api/meta/callback/route.ts` | Handles OAuth callback, token exchange, page + Instagram account discovery, token storage |
| `src/app/api/meta/connections/route.ts` | Lists active Meta connections (token excluded from response) |
| `src/app/api/meta/connections/[id]/route.ts` | Soft-deletes (disconnects) a Meta connection |
| `src/lib/meta-token.ts` | AES-256-GCM encrypt/decrypt for token storage |
| `src/hooks/use-meta-connections.ts` | React Query hooks for connection list and disconnect mutation |
| `src/app/(dashboard)/settings/page.tsx` | Settings UI with Facebook/Instagram connection cards and OAuth feedback |
| `prisma/schema.prisma` (MetaConnection model) | Database schema for storing platform connections |
| `.env` / `.env.local` / `.env.example` | Contains `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI`, `TOKEN_ENCRYPTION_KEY` |

---

## Appendix E — Open Questions

The following items could not be verified from the code alone and require external investigation:

1. **Is the Meta App configured in the Facebook Developer Portal?**
   - Are the scopes (`pages_manage_posts`, `instagram_business_content_publish`) approved for production use?
   - Is the redirect URI `META_REDIRECT_URI` correctly registered in the app settings?
   - Is the app in Development or Live mode? (Development mode limits who can OAuth)

2. **What external agent is calling `/api/agent/intake`?**
   - Where does the agent code live?
   - Is the agent currently running and submitting drafts?
   - What triggers the agent to pick up a new content request?

3. **Is the Supabase database currently populated with real data?**
   - Are there existing `ContentRequest`, `Draft`, `PublishJob`, or `MetaConnection` records in production?

4. **Is there a deployed version at `domiron-agent.vercel.app`?**
   - Is it using the same codebase as this repo?
   - Is it connected to the same Supabase instance?

5. **Was there ever a previous version of this code that had publishing implemented?**
   - The git history shows recent commits around authentication and settings. It's unclear if publishing was attempted before.

6. **What is the content strategy for media (images/videos)?**
   - Instagram requires publicly accessible image URLs. Is there a CDN or media storage plan?

7. **Are there Instagram Business accounts linked to the Facebook pages being used?**
   - Instagram publishing only works with Business accounts linked to Facebook pages. Personal accounts are not supported.

8. **What does the `META_REDIRECT_URI` currently point to?**
   - If it's `https://domiron-agent.vercel.app/api/meta/callback`, does that URL match what's registered in the Facebook Developer Portal?

9. **Is `TOKEN_ENCRYPTION_KEY` backed up securely outside the repo?**
   - If rotated, existing tokens in the database cannot be decrypted. A migration plan is needed.

10. **What is the intended behavior when `platform = BOTH`?**
    - The schema supports `BOTH` as a platform value. Should publishing jobs be split into two separate jobs (one Facebook, one Instagram), or should one job handle both?
