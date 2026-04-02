# SOCIAL_AGENT_STATUS.md
# Domiron Social Agent Dashboard — Full Status Report
_Generated: 2026-04-02. Based on reading actual source code, not assumptions._

---

## 1. Product Goal

A dashboard where the Domiron team can:
- Create content requests
- Receive AI-generated drafts from an external agent
- Review, approve, or revise those drafts
- Upload media for Instagram posts
- Publish approved content to Instagram and/or Facebook in one click
- See publish history and results

---

## 2. Current Architecture and Flow

```
[External AI Agent]
        │
        │ POST /api/agent/intake  (authenticated with AGENT_API_KEY)
        ▼
[ContentRequest] ──── status: NEW → DRAFT_READY
        │
        │ creates Draft (status: PENDING_REVIEW)
        ▼
[Draft Review Page]  /drafts/[id]
        │
        ├── Admin reviews content (hook, captions, hashtags, format)
        ├── Admin uploads image → POST /api/media/upload → Cloudinary → Draft.mediaUrl
        ├── Admin can: Approve / Reject / Request Revision
        │
        │ Approve → Draft.status = APPROVED
        │           ContentRequest.status = COMPLETED
        │           PublishJob created (status: QUEUED)
        ▼
[Queue Page]  /queue
        │
        │ Shows all PublishJobs (QUEUED, SCHEDULED, PUBLISHED, FAILED)
        │ "Publish Now" button → confirms → POST /api/publish-jobs/[id]/mark-published
        ▼
[executePublishJob()]  src/lib/meta-publish.ts
        │
        ├── INSTAGRAM: reads INSTAGRAM_USER_ID + INSTAGRAM_ACCESS_TOKEN from env
        │             → POST /{igUserId}/media (create container)
        │             → POST /{igUserId}/media_publish
        │             → GET /{mediaId}?fields=permalink
        │
        └── FACEBOOK: looks up active MetaConnection in DB
                     → decrypts stored page token
                     → POST /{pageId}/feed or /{pageId}/photos
        │
        ▼
[PublishJob updated]
        status: PUBLISHED or FAILED
        externalPostId, publishedUrl, failureReason stored
        "View post" link appears in queue
```

**DB models:** `ContentRequest` → `Draft` → `PublishJob`, `MetaConnection`, `DraftRevision`

**No campaign model exists.** The pipeline is: Request → Draft → PublishJob.

---

## 3. What Is Working

### API Routes (all have auth + try/catch)
| Route | Status |
|---|---|
| `GET/POST /api/requests` | ✅ Working |
| `GET/PATCH/DELETE /api/requests/[id]` | ✅ Working |
| `GET/POST /api/drafts` | ✅ Working (requires `mediaUrl` column in production DB — see blockers) |
| `GET/PATCH /api/drafts/[id]` | ✅ Working |
| `POST /api/drafts/[id]/approve` | ✅ Working — creates PublishJob atomically |
| `POST /api/drafts/[id]/reject` | ✅ Working |
| `POST /api/drafts/[id]/request-revision` | ✅ Working |
| `GET /api/publish-jobs` | ✅ Working (requires `mediaUrl` column — see blockers) |
| `POST /api/publish-jobs/[id]/mark-published` | ✅ Implemented and wired |
| `POST /api/agent/intake` | ✅ Working — validated, creates Draft + DraftRevision atomically |
| `POST /api/media/upload` | ✅ Implemented (requires Cloudinary env vars) |
| `GET /api/meta/auth-url` | ✅ Generates config_id-based OAuth URL and sets CSRF cookie |
| `GET /api/meta/callback` | ✅ Implemented — exchanges tokens, stores MetaConnection |
| `GET /api/meta/connections` | ✅ Working |
| `DELETE /api/meta/connections/[id]` | ✅ Working |

### UI Pages
| Page | Status |
|---|---|
| `/requests` | ✅ Lists all content requests |
| `/requests/new` | ✅ Create new request form |
| `/drafts` | ✅ Grid of draft cards |
| `/drafts/[id]` | ✅ Full review page: content + media upload + approve/reject/revision |
| `/queue` | ✅ Table with all jobs, "Publish Now" button, failure reason, "View post" link |
| `/settings` | ✅ Meta connection cards, connect/disconnect flow |

### Core Logic
- Draft revision history tracked on every state change (AGENT and ADMIN changedBy)
- Pre-publish guard: blocks Instagram publish if `draft.mediaUrl` is null
- Failure reason displayed inline in queue table
- Token decryption only at publish time (never logged, never sent to client)
- Instagram publishing: **fully bypasses MetaConnection DB** — uses `INSTAGRAM_USER_ID` + `INSTAGRAM_ACCESS_TOKEN` env vars directly

---

## 4. What Is Broken

### B1 — `mediaUrl` column missing from production database (HIGH)
`prisma/schema.prisma` has `mediaUrl String?` on the `Draft` model but `prisma db push` has never been run against production. Prisma generates a `SELECT` that includes `mediaUrl`; PostgreSQL returns a column-not-found error.

**Effect:** `GET /api/drafts` and `GET /api/publish-jobs` return 500 in production.

**Fix:** Run from a machine with `DIRECT_URL` pointing to Supabase port 5432:
```bash
npx prisma db push
```

### B2 — Meta OAuth / Facebook Login for Business (MEDIUM for Instagram, HIGH for Facebook)
The code is correct — `config_id` only, no `scope`. But the Business Login Config `1717249529647921` has `email` and `instagram_basic` in its permissions in Meta Developer Console. Facebook reads those from the config and returns "Invalid Scopes."

**Effect:** Cannot connect a Facebook page or Instagram via OAuth. Facebook publishing is completely blocked.

**Fix:** Meta Developer Portal → App `4274013296205313` → Facebook Login for Business → Config `1717249529647921` → Permissions. Remove `email` and `instagram_basic`. Set only: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_content_publish`.

**Instagram is NOT blocked** — it uses direct env vars, not OAuth.

### B3 — Two different META_APP_IDs in local env files (MEDIUM)
- `.env.local` (local dev): `META_APP_ID=1962927204598028` — no `META_CONFIG_ID`
- `.env` (shared config): `META_APP_ID=4274013296205313` — has `META_CONFIG_ID=1717249529647921`

Vercel does not receive either file (both are gitignored). If Vercel was configured from `.env.local`, it has the old app ID with no config ID. The new `requireMetaEnv()` would catch a missing `META_CONFIG_ID` and return a 500 — preventing any OAuth URL from being generated.

**Fix:** Verify Vercel dashboard has: `META_APP_ID=4274013296205313`, `META_APP_SECRET=1e3adef07c8707a3b0299737c955b2f7`, `META_CONFIG_ID=1717249529647921`.

---

## 5. What Is Missing

### M1 — No publish history page
The Queue page shows ALL jobs (QUEUED + PUBLISHED + FAILED). There is no dedicated history view filtered to completed publishes. Published jobs stay in the same table with a "View post" link.

**Impact:** Minor UX gap. Not a blocker.

### M2 — No "retry failed" button
When a publish job fails, there is no way to re-queue and retry from the UI. The admin must manually reset the job status in the DB.

**Impact:** Operational gap — a failed job is terminal from the UI.

### M3 — No scheduled publishing UI
`PublishJob.scheduledDate` and `status=SCHEDULED` exist in the schema. Nothing in the UI allows setting a schedule. No cron or background worker exists to auto-publish scheduled jobs.

**Impact:** Scheduling is dead schema — not functional.

### M4 — Facebook publishing has no env-var bypass
Instagram uses `INSTAGRAM_USER_ID` + `INSTAGRAM_ACCESS_TOKEN` from env. Facebook has no equivalent. It requires an active `MetaConnection` row in the DB (populated by OAuth). Until OAuth is fixed (B2 + B3), Facebook publishing is completely blocked.

**Impact:** Facebook one-click publish is not possible until OAuth is working.

### M5 — No video/reel publishing
`publishToInstagram()` only supports `image_url`. The `contentType` and `format` enums include `REEL`, `STORY`, `CAROUSEL`. The Instagram container API needs `video_url` for Reels and a `media_type=VIDEO` param. None of this is implemented.

**Impact:** Only static image posts can be published to Instagram.

### M6 — Campaigns do not exist
The word "campaign" does not appear in any source file, schema, API route, page, or hook. The system has: `ContentRequest` → `Draft` → `PublishJob`. That is the complete data model. If campaign grouping is needed, it requires a new `Campaign` model and significant UI work.

### M7 — Cloudinary upload may not be configured in Vercel
`POST /api/media/upload` requires `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`. If these are missing in Vercel, the upload endpoint returns 500 and admins cannot add images to drafts — which blocks Instagram publishing.

---

## 6. Instagram Publishing Path

**Status: FULLY IMPLEMENTED — pending B1 (mediaUrl DB column) and env vars in Vercel**

```
UI: Queue page → "Publish Now" button
    ↓ (pre-check: platform is INSTAGRAM/BOTH AND draft.mediaUrl is null → toast error + stop)
    ↓ Confirm dialog
    ↓ useMarkPublished() → POST /api/publish-jobs/[id]/mark-published

API route: src/app/api/publish-jobs/[id]/mark-published/route.ts
    ↓ Validates job exists, status is QUEUED or SCHEDULED
    ↓ Calls executePublishJob(jobId)

Service: src/lib/meta-publish.ts → executePublishJob()
    ↓ For INSTAGRAM platform:
    ↓ Reads process.env.INSTAGRAM_USER_ID + process.env.INSTAGRAM_ACCESS_TOKEN
    ↓ If missing → fails with clear error message, does not attempt DB lookup
    ↓ Calls publishToInstagram(igUserId, igUserId, token, draftContent)

publishToInstagram():
    Step 1: POST https://graph.facebook.com/v19.0/{INSTAGRAM_USER_ID}/media
            Body: { image_url: draft.mediaUrl, caption: instagramCaption + hashtags }
            Returns: { id: creationId }

    Step 2: POST https://graph.facebook.com/v19.0/{INSTAGRAM_USER_ID}/media_publish
            Body: { creation_id: creationId }
            Returns: { id: mediaId }

    Step 3: GET https://graph.facebook.com/v19.0/{mediaId}?fields=permalink
            Returns: permalink URL (best-effort — post is published even if this fails)

    ↓ Returns { platform, success, externalPostId, publishedUrl }

Back in executePublishJob():
    ↓ Updates PublishJob in DB:
       status = PUBLISHED | FAILED
       publishedAt = now() (if success)
       externalPostId = mediaId
       publishedUrl = permalink
       failureReason = error message (if failed)

Back in mark-published route:
    ↓ Returns { data: updatedJob, publishStatus, results[] }

UI:
    ↓ Success toast: "הפוסט פורסם בהצלחה"
    ↓ OR error toast with failureReason
    ↓ Queue table row updates to PUBLISHED with "View post" link
```

**Required for success:**
- `INSTAGRAM_USER_ID` set in Vercel env
- `INSTAGRAM_ACCESS_TOKEN` set in Vercel env (long-lived, valid)
- `draft.mediaUrl` is a publicly accessible HTTPS URL (hosted on Cloudinary)
- `mediaUrl` column exists in production DB (requires `prisma db push`)
- The Instagram account is a Business or Creator account

---

## 7. Facebook Publishing Path

**Status: IMPLEMENTED IN CODE — blocked by OAuth (B2 + B3)**

```
executePublishJob() for FACEBOOK platform:
    ↓ Does NOT check env vars (no Facebook env-var bypass)
    ↓ Queries DB: prisma.metaConnection.findFirst({ platform: FACEBOOK, isActive: true })
    ↓ If not found → fails: "No active FACEBOOK connection found"
    ↓ Checks token expiry → attempts refresh if needed
    ↓ Decrypts token → calls publishToFacebook(pageId, pageName, token, draftContent)

publishToFacebook():
    With mediaUrl:  POST /{pageId}/photos  (photo post)
    Without mediaUrl: POST /{pageId}/feed   (text post)
```

**Why it is blocked today:** No `MetaConnection` rows exist in the DB because the OAuth flow is broken (B2 — wrong permissions in Business Login Config). No MetaConnection = no token = publish always fails.

**What is needed:**
1. Fix Business Login Config permissions in Meta Developer Console
2. Verify correct `META_APP_ID` + `META_CONFIG_ID` in Vercel
3. Admin connects Facebook account via Settings → OAuth completes → MetaConnection created
4. Facebook publishing will then work

---

## 8. Queue / Publish Execution Path

```
1. Admin approves draft → POST /api/drafts/[id]/approve
   └── DB transaction: Draft.status=APPROVED, Request.status=COMPLETED,
       PublishJob created { platform: from Request, status: QUEUED }

2. Admin goes to /queue
   └── GET /api/publish-jobs → QueueTable renders all jobs

3. Admin clicks "Publish Now" on a QUEUED job
   └── Pre-check (client-side): if INSTAGRAM/BOTH and no mediaUrl → block with toast
   └── ConfirmDialog opens
   └── Admin confirms

4. POST /api/publish-jobs/[id]/mark-published
   └── Validates status is QUEUED or SCHEDULED
   └── executePublishJob(id) runs synchronously in the request
       (no background queue — if it takes >30s on Vercel, request will timeout)
   └── Returns { publishStatus, results[] }

5. DB updated — job moves to PUBLISHED or FAILED
6. React Query invalidates and refetches queue
7. Toast shown with result
```

**Weakness:** `executePublishJob` runs synchronously in the API request handler. On Vercel (10s default / 60s max on Pro), a slow Graph API call could timeout. No background job queue, no retry queue, no webhook.

---

## 9. Risks and Weak Points

| Risk | Severity | Details |
|---|---|---|
| `mediaUrl` column missing in production | HIGH | All draft/job routes 500 until `prisma db push` is run |
| Synchronous publish in API request | MEDIUM | If Meta API is slow, Vercel may timeout before publish completes |
| `INSTAGRAM_ACCESS_TOKEN` expiry | MEDIUM | Token not in DB — no automatic refresh path. When it expires, all Instagram publishes silently fail. Manual token rotation required. |
| Facebook completely blocked | HIGH | No MetaConnection in DB = Facebook publish always fails |
| No retry UI for failed jobs | MEDIUM | Failed jobs are terminal from the UI |
| Cloudinary may not be configured in Vercel | HIGH | If missing, image upload returns 500 → no mediaUrl → Instagram blocked |
| Two META_APP_IDs in local env | MEDIUM | Ambiguous which app Vercel is configured for |
| No video/reel support | LOW (now) | Any REEL content type in queue will fail with "Container creation failed" |
| Queue shows all jobs including published | LOW | No separate history view — queue gets cluttered over time |
| No campaign grouping | LOW | Not needed for MVP but will be needed for multi-post workflows |

---

## 10. Exact Next Steps in Priority Order

### P0 — Must do before any publishing works in production

**Step 1: Run `prisma db push` in production**
```bash
# From local machine, with production DIRECT_URL
DIRECT_URL="postgresql://postgres.nbwvqmiicgqquypahqyh:...@aws-1-eu-central-1.pooler.supabase.com:5432/postgres" \
npx prisma db push
```
Adds `mediaUrl` column. Unblocks `GET /api/drafts` and `GET /api/publish-jobs`.

**Step 2: Set all required Vercel environment variables**
In Vercel Dashboard → Settings → Environment Variables:
```
META_APP_ID=4274013296205313
META_APP_SECRET=1e3adef07c8707a3b0299737c955b2f7
META_REDIRECT_URI=https://domiron-agent.vercel.app/api/meta/callback
META_CONFIG_ID=1717249529647921
TOKEN_ENCRYPTION_KEY=4f8c2d9a7b61e3f05c9d1a2b8e7f4c309d6e1b5a8c3f7d2e4b9a1c6f8e0d3b7a
INSTAGRAM_USER_ID=17841439051811330
INSTAGRAM_ACCESS_TOKEN=<current long-lived token>
CLOUDINARY_CLOUD_NAME=<your cloud name>
CLOUDINARY_API_KEY=<your key>
CLOUDINARY_API_SECRET=<your secret>
```

**Step 3: Redeploy on Vercel** after env vars are set.

---

### P1 — Required to test Instagram end-to-end

**Step 4: Verify Instagram credentials are valid**
Test the token directly:
```bash
curl "https://graph.facebook.com/v19.0/me?access_token=<INSTAGRAM_ACCESS_TOKEN>"
```
If returns a user object, token is valid. If returns OAuthException, token is expired and must be refreshed.

**Step 5: Create a test draft with an image and publish it**
1. Go to `/requests` → create a request with platform=INSTAGRAM
2. Use agent intake or create draft manually: `POST /api/agent/intake`
3. Go to draft page → upload an image (requires Cloudinary)
4. Approve the draft → PublishJob created
5. Go to `/queue` → click "Publish Now"
6. Check Vercel logs for `[meta-publish] INSTAGRAM: ✅ SUCCESS`
7. Verify post appears on Instagram

---

### P2 — Required for Facebook publishing

**Step 6: Fix Business Login Config permissions**
In Meta Developer Portal → App `4274013296205313` → Facebook Login for Business → Configuration `1717249529647921`:
- Remove: `email`, `instagram_basic`
- Keep: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_content_publish`

**Step 7: Complete Facebook OAuth from Settings**
1. Go to `/settings`
2. Click "Connect with Facebook/Instagram"
3. Complete the OAuth flow
4. Verify MetaConnection rows appear in DB
5. Test Facebook publish

---

### P3 — Quality of life (after core works)

**Step 8: Add "Retry" button for failed jobs**
Add a PATCH to reset `status=QUEUED` on a FAILED job, with a "Retry" button in queue table.

**Step 9: Add token expiry monitoring for direct Instagram credentials**
`INSTAGRAM_ACCESS_TOKEN` has no automatic refresh. Add a GET endpoint or admin panel note showing token validity. Alert before it expires (~60 days).

**Step 10: Separate publish history from active queue**
Add a `/history` page filtered to `status=PUBLISHED` or filter tabs on the queue page.

---

## Chat Summary

```
COMPLETE
────────
✅ Full content request → draft → approve → queue pipeline
✅ Agent intake API (POST /api/agent/intake) with Zod validation
✅ Draft review UI: content display, media upload, approve/reject/revision
✅ Cloudinary image upload endpoint (POST /api/media/upload)
✅ Queue table with "Publish Now", failure reason, "View post" link
✅ Instagram publishing via direct env vars (bypasses OAuth entirely)
✅ Facebook publishing code (requires active MetaConnection from OAuth)
✅ Two-step Instagram container publish (create + publish + permalink fetch)
✅ Auth (NextAuth, single admin, JWT)
✅ All routes: try/catch, consistent error format, auth guards
✅ Draft revision history (every action tracked)
✅ Pre-publish guard (blocks Instagram if no mediaUrl)
✅ Meta OAuth code (config_id-based, CSRF cookie, server-side redirect)

PARTIAL
───────
⚠️  Instagram publishing: code complete, env vars set locally,
    but requires prisma db push + Vercel env vars to work in production
⚠️  Cloudinary upload: code complete, requires Cloudinary env vars in Vercel
⚠️  Meta OAuth: code correct, but Business Login Config has wrong permissions
⚠️  Queue/history: combined view, no separate history or retry UI
⚠️  Facebook publishing: fully coded, blocked only by missing MetaConnection

MISSING
───────
❌  Campaigns — not in schema, not in DB, not in UI (not needed for MVP)
❌  Scheduled publishing (schema supports it, UI and cron do not exist)
❌  Retry failed jobs from UI
❌  Video/Reel/Story publishing (image only right now)
❌  Token refresh for direct INSTAGRAM_ACCESS_TOKEN env var
❌  Publish history page (separate from active queue)
❌  Background job queue (publish runs synchronously — Vercel timeout risk)

BLOCKERS (must resolve before production publishing works)
──────────────────────────────────────────────────────────
🔴  B1: `prisma db push` not run → mediaUrl column missing → 500 on drafts + jobs routes
🔴  B2: Cloudinary env vars may not be in Vercel → image upload fails → no mediaUrl → Instagram blocked
🔴  B3: INSTAGRAM_USER_ID + INSTAGRAM_ACCESS_TOKEN must be set in Vercel
🔴  B4: META_APP_ID mismatch — Vercel may have wrong app ID (old one without config_id)
🔴  B5: Business Login Config has invalid permissions → Facebook OAuth broken

RECOMMENDED NEXT STEP
─────────────────────
1. Run `prisma db push` with production DIRECT_URL
2. Set all env vars in Vercel dashboard (see Step 2 above)
3. Redeploy
4. Test Instagram end-to-end with a real draft + image
   → POST to /api/agent/intake → upload image → approve → Publish Now
   → Check Vercel logs + Instagram account
```
