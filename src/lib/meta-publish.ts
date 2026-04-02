/**
 * meta-publish.ts
 *
 * Real Meta Graph API publishing service.
 *
 * Responsibilities:
 *  1. Resolve the active MetaConnection for the job's platform(s)
 *  2. Check / proactively refresh token when near expiry
 *  3. Decrypt the stored access token (the ONLY place decrypt() is called)
 *  4. POST to the correct Graph API endpoint
 *  5. Persist real publish metadata into the PublishJob record
 *     (externalPostId, publishedUrl, failureReason, status)
 *
 * Platforms:
 *  FACEBOOK → POST /{page_id}/feed  (text)
 *             POST /{page_id}/photos (photo with caption)
 *
 *  INSTAGRAM → POST /{ig_user_id}/media         (step 1: create container)
 *              POST /{ig_user_id}/media_publish   (step 2: publish container)
 *
 * BOTH → runs Facebook then Instagram; overall status = PUBLISHED only if both succeed.
 */

import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/meta-token";
import { requireFacebookPublishEnv } from "@/lib/env";

const GRAPH_VERSION = "v19.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

// Hours before tokenExpiresAt at which we proactively attempt a refresh.
const REFRESH_WITHIN_HOURS = 24;

// ─── Internal types ───────────────────────────────────────────────────────────

interface PlatformResult {
  platform: "FACEBOOK" | "INSTAGRAM";
  success: boolean;
  externalPostId?: string;
  publishedUrl?: string;
  failureReason?: string;
}

interface DraftContent {
  hook: string | null;
  facebookCaption: string | null;
  instagramCaption: string | null;
  hashtags: string[];
  mediaUrl: string | null;
}

// ─── Caption builders ─────────────────────────────────────────────────────────

function buildFacebookMessage(draft: DraftContent): string {
  const parts: string[] = [];
  if (draft.facebookCaption) parts.push(draft.facebookCaption);
  else if (draft.hook) parts.push(draft.hook);
  if (draft.hashtags.length > 0) {
    parts.push(draft.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" "));
  }
  return parts.join("\n\n");
}

function buildInstagramCaption(draft: DraftContent): string {
  const parts: string[] = [];
  if (draft.instagramCaption) parts.push(draft.instagramCaption);
  else if (draft.hook) parts.push(draft.hook);
  if (draft.hashtags.length > 0) {
    parts.push(draft.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" "));
  }
  return parts.join("\n\n");
}

// ─── Meta error helpers ───────────────────────────────────────────────────────

function extractMetaError(data: Record<string, unknown>): string {
  if (data.error && typeof data.error === "object") {
    const err = data.error as Record<string, unknown>;
    return `${err.message ?? "Unknown Meta error"} (code: ${err.code ?? "?"}, type: ${err.type ?? "?"})`;
  }
  return JSON.stringify(data);
}

/** Returns true when Meta responds with OAuthException code 190 (invalid/expired token). */
function isExpiredTokenError(data: Record<string, unknown>): boolean {
  if (!data.error || typeof data.error !== "object") return false;
  const err = data.error as Record<string, unknown>;
  return err.type === "OAuthException" && (err.code === 190 || err.code === "190");
}

// ─── Token refresh (exported for use in the refresh API route) ─────────────────

/**
 * Exchanges a long-lived token for a fresh one via the fb_exchange_token grant.
 *
 * NOTE: Meta's token exchange endpoint requires the current token to be valid.
 * If the token is fully expired (past 60 days), this will also fail — in that
 * case the user must re-run the OAuth flow from Settings.
 *
 * @returns new plaintext token + expiry, or null if the exchange fails.
 */
export async function refreshLongLivedToken(
  encryptedToken: string
): Promise<{ token: string; expiresAt: Date } | null> {
  requireFacebookPublishEnv();

  let currentToken: string;
  try {
    currentToken = decrypt(encryptedToken);
  } catch (err) {
    console.error("[meta-publish] refreshLongLivedToken: failed to decrypt token:", err);
    return null;
  }

  const url = new URL(`${GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", process.env.META_APP_ID!);
  url.searchParams.set("client_secret", process.env.META_APP_SECRET!);
  url.searchParams.set("fb_exchange_token", currentToken);

  console.log("[meta-publish] Requesting token refresh from Meta...");
  const res = await fetch(url.toString());

  if (!res.ok) {
    const body = await res.text();
    console.error("[meta-publish] Token refresh failed:", res.status, body);
    return null;
  }

  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) {
    console.error("[meta-publish] Token refresh response missing access_token:", JSON.stringify(data));
    return null;
  }

  const expiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000)
    : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // fallback: 60 days

  console.log(`[meta-publish] Token refreshed successfully. New expiry: ${expiresAt.toISOString()}`);
  return { token: data.access_token, expiresAt };
}

// ─── Facebook publishing ──────────────────────────────────────────────────────

async function publishToFacebook(
  pageId: string,
  pageName: string,
  token: string,
  draft: DraftContent
): Promise<PlatformResult & { isTokenExpired?: boolean }> {
  const message = buildFacebookMessage(draft);

  if (!draft.mediaUrl && !message) {
    return {
      platform: "FACEBOOK",
      success: false,
      failureReason:
        "Cannot publish to Facebook: draft has no facebookCaption, hook, or hashtags. " +
        "At minimum one of these fields must be set.",
    };
  }

  if (draft.mediaUrl) {
    // ── Photo post ────────────────────────────────────────────────────────────
    console.log(`[Facebook] Publishing photo post to page "${pageName}" (${pageId})`);
    console.log(`[Facebook] image_url: ${draft.mediaUrl}`);
    if (message) console.log(`[Facebook] caption: ${message.slice(0, 80)}${message.length > 80 ? "…" : ""}`);

    const body: Record<string, string> = { url: draft.mediaUrl };
    if (message) body.caption = message;

    const res = await fetch(`${GRAPH_BASE}/${pageId}/photos`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = (await res.json()) as Record<string, unknown>;
    console.log(`[Facebook] POST /${pageId}/photos → ${res.status}:`, JSON.stringify(data));

    if (!res.ok) {
      if (isExpiredTokenError(data)) {
        return { platform: "FACEBOOK", success: false, failureReason: extractMetaError(data), isTokenExpired: true };
      }
      return { platform: "FACEBOOK", success: false, failureReason: extractMetaError(data) };
    }

    // /photos returns: { id: "photo_id" } or { id: "photo_id", post_id: "page_id_post_num" }
    // Use post_id for the permalink if available; fall back to id.
    const postId = ((data.post_id ?? data.id) as string) || "";
    const parts = postId.split("_");
    const publishedUrl =
      parts.length === 2
        ? `https://www.facebook.com/${parts[0]}/posts/${parts[1]}`
        : postId
        ? `https://www.facebook.com/${postId}`
        : undefined;

    console.log(`[Facebook] ✅ Photo published. post_id=${postId}${publishedUrl ? ` | url=${publishedUrl}` : ""}`);
    return { platform: "FACEBOOK", success: true, externalPostId: postId || undefined, publishedUrl };
  } else {
    // ── Text / feed post ──────────────────────────────────────────────────────
    console.log(`[Facebook] Publishing text/feed post to page "${pageName}" (${pageId})`);
    console.log(`[Facebook] message: ${message.slice(0, 80)}${message.length > 80 ? "…" : ""}`);

    const res = await fetch(`${GRAPH_BASE}/${pageId}/feed`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
    });

    const data = (await res.json()) as Record<string, unknown>;
    console.log(`[Facebook] POST /${pageId}/feed → ${res.status}:`, JSON.stringify(data));

    if (!res.ok) {
      if (isExpiredTokenError(data)) {
        return { platform: "FACEBOOK", success: false, failureReason: extractMetaError(data), isTokenExpired: true };
      }
      return { platform: "FACEBOOK", success: false, failureReason: extractMetaError(data) };
    }

    // /feed returns: { id: "{page_id}_{post_id}" }
    const rawId = (data.id as string) || "";
    const parts = rawId.split("_");
    const publishedUrl =
      parts.length === 2
        ? `https://www.facebook.com/${parts[0]}/posts/${parts[1]}`
        : rawId
        ? `https://www.facebook.com/${rawId}`
        : undefined;

    console.log(`[Facebook] ✅ Feed post published. id=${rawId}${publishedUrl ? ` | url=${publishedUrl}` : ""}`);
    return { platform: "FACEBOOK", success: true, externalPostId: rawId || undefined, publishedUrl };
  }
}

// ─── Instagram publishing ─────────────────────────────────────────────────────

async function publishToInstagram(
  igUserId: string,
  igUsername: string,
  token: string,
  draft: DraftContent
): Promise<PlatformResult & { isTokenExpired?: boolean }> {
  /**
   * Instagram Content Publishing API (Graph API) requires:
   *   1. A publicly accessible HTTPS image URL (draft.mediaUrl)
   *   2. An Instagram Business or Creator account linked to a Facebook Page
   *
   * If draft.mediaUrl is null, publishing cannot proceed.
   *
   * To supply a mediaUrl:
   *   - Host the image on Cloudinary, AWS S3, Vercel Blob, or any public CDN
   *   - Set Draft.mediaUrl to the public https:// URL
   *   - The agent can provide it via the media_url field in POST /api/agent/intake
   *   - Or an admin upload endpoint can be added later
   */
  if (!draft.mediaUrl) {
    console.error(
      `[Instagram] ❌ Cannot publish: draft.mediaUrl is null. ` +
      `Instagram requires a public image URL. ` +
      `Set it via the agent intake 'media_url' field or an admin upload.`
    );
    return {
      platform: "INSTAGRAM",
      success: false,
      failureReason:
        "Instagram requires a public image URL (Draft.mediaUrl is empty). " +
        "Host the image on a CDN and set Draft.mediaUrl before publishing to Instagram. " +
        "The external agent can provide this via the 'media_url' field in the intake payload.",
    };
  }

  const caption = buildInstagramCaption(draft);
  console.log(`[Instagram] Publishing to @${igUsername} (IG user ID: ${igUserId})`);
  console.log(`[Instagram] image_url: ${draft.mediaUrl}`);
  if (caption) console.log(`[Instagram] caption: ${caption.slice(0, 80)}${caption.length > 80 ? "…" : ""}`);

  // ── Step 1: Create media container ───────────────────────────────────────
  console.log(`[Instagram] Step 1/2: Creating media container...`);

  const containerBody: Record<string, string> = { image_url: draft.mediaUrl };
  if (caption) containerBody.caption = caption;

  const containerRes = await fetch(`${GRAPH_BASE}/${igUserId}/media`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(containerBody),
  });

  const containerData = (await containerRes.json()) as Record<string, unknown>;
  console.log(
    `[Instagram] POST /${igUserId}/media → ${containerRes.status}:`,
    JSON.stringify(containerData)
  );

  if (!containerRes.ok) {
    if (isExpiredTokenError(containerData)) {
      return { platform: "INSTAGRAM", success: false, failureReason: extractMetaError(containerData), isTokenExpired: true };
    }
    return {
      platform: "INSTAGRAM",
      success: false,
      failureReason: `Container creation failed: ${extractMetaError(containerData)}`,
    };
  }

  const creationId = (containerData.id as string) || "";
  if (!creationId) {
    return {
      platform: "INSTAGRAM",
      success: false,
      failureReason: "Container creation returned no id — cannot proceed to publish step.",
    };
  }
  console.log(`[Instagram] Container created. creation_id=${creationId}`);

  // ── Step 2: Publish media container ──────────────────────────────────────
  console.log(`[Instagram] Step 2/2: Publishing media container...`);

  const publishRes = await fetch(`${GRAPH_BASE}/${igUserId}/media_publish`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ creation_id: creationId }),
  });

  const publishData = (await publishRes.json()) as Record<string, unknown>;
  console.log(
    `[Instagram] POST /${igUserId}/media_publish → ${publishRes.status}:`,
    JSON.stringify(publishData)
  );

  if (!publishRes.ok) {
    if (isExpiredTokenError(publishData)) {
      return { platform: "INSTAGRAM", success: false, failureReason: extractMetaError(publishData), isTokenExpired: true };
    }
    return {
      platform: "INSTAGRAM",
      success: false,
      failureReason: `Media publish failed: ${extractMetaError(publishData)}`,
    };
  }

  const mediaId = (publishData.id as string) || "";
  if (!mediaId) {
    return {
      platform: "INSTAGRAM",
      success: false,
      failureReason: "Media publish returned no id — cannot verify post was created.",
    };
  }

  // ── Step 3: Fetch permalink ────────────────────────────────────────────────
  // The media_publish endpoint does not return the permalink directly.
  // Fetch it separately so we can store a clickable URL.
  let publishedUrl: string | undefined;
  try {
    console.log(`[Instagram] Fetching permalink for media_id=${mediaId}...`);
    const permalinkRes = await fetch(
      `${GRAPH_BASE}/${mediaId}?fields=permalink`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (permalinkRes.ok) {
      const permalinkData = (await permalinkRes.json()) as Record<string, unknown>;
      publishedUrl = (permalinkData.permalink as string) || undefined;
      console.log(`[Instagram] ✅ Published. media_id=${mediaId} | permalink=${publishedUrl ?? "(none)"}`);
    } else {
      // Permalink fetch is best-effort — the post was published even if this fails.
      console.warn(`[Instagram] ⚠️ Published (media_id=${mediaId}) but permalink fetch returned ${permalinkRes.status}`);
    }
  } catch (err) {
    console.warn(`[Instagram] ⚠️ Published (media_id=${mediaId}) but permalink fetch threw:`, err);
  }

  return {
    platform: "INSTAGRAM",
    success: true,
    externalPostId: mediaId,
    publishedUrl,
  };
}

// ─── Token refresh with DB persistence ───────────────────────────────────────

/**
 * Attempts to refresh the token for a MetaConnection and persists the result.
 * Returns the new plaintext token on success, or null on failure.
 */
async function tryRefreshAndPersist(connectionId: string, encryptedToken: string): Promise<string | null> {
  const refreshed = await refreshLongLivedToken(encryptedToken);
  if (!refreshed) return null;

  await prisma.metaConnection.update({
    where: { id: connectionId },
    data: {
      encryptedToken: encrypt(refreshed.token),
      tokenExpiresAt: refreshed.expiresAt,
    },
  });
  console.log(`[meta-publish] Token for connection ${connectionId} refreshed and saved.`);
  return refreshed.token;
}

// ─── Main publish entry point ─────────────────────────────────────────────────

export interface ExecutePublishResult {
  overallStatus: "PUBLISHED" | "FAILED";
  results: PlatformResult[];
}

/**
 * Executes a PublishJob end-to-end:
 *   1. Loads the job, draft, and platform connections from DB
 *   2. Checks / refreshes token if near expiry
 *   3. Decrypts the page access token
 *   4. Calls the Meta Graph API (Facebook and/or Instagram)
 *   5. Saves real publish metadata to the PublishJob record
 *
 * Meta API failures are captured internally and written to PublishJob.failureReason.
 * Only DB/system errors are thrown.
 */
export async function executePublishJob(jobId: string): Promise<ExecutePublishResult> {
  // Do NOT call requireMetaEnv() here — it would block Instagram publishing
  // (which uses direct env vars) if Meta OAuth vars are missing.
  // Facebook-specific env validation happens inside the Facebook path below.

  console.log(`\n[meta-publish] ═══ Starting publish for job ${jobId} ═══`);

  // ── Load job + relations ──────────────────────────────────────────────────
  const job = await prisma.publishJob.findUnique({
    where: { id: jobId },
    include: { draft: { include: { request: true } } },
  });

  if (!job) throw new Error(`PublishJob not found: ${jobId}`);
  if (!["QUEUED", "SCHEDULED"].includes(job.status)) {
    throw new Error(
      `PublishJob ${jobId} is in status "${job.status}" — only QUEUED or SCHEDULED can be published.`
    );
  }

  const { draft } = job;
  console.log(
    `[meta-publish] Job platform: ${job.platform} | ` +
    `Draft: "${draft.hook?.slice(0, 40) ?? "(no hook)"}" | ` +
    `FB caption: ${draft.facebookCaption ? "yes" : "no"} | ` +
    `IG caption: ${draft.instagramCaption ? "yes" : "no"} | ` +
    `mediaUrl: ${draft.mediaUrl ?? "none"}`
  );

  const draftContent: DraftContent = {
    hook: draft.hook,
    facebookCaption: draft.facebookCaption,
    instagramCaption: draft.instagramCaption,
    hashtags: draft.hashtags,
    mediaUrl: draft.mediaUrl,
  };

  const platforms: Array<"FACEBOOK" | "INSTAGRAM"> =
    job.platform === "BOTH" ? ["FACEBOOK", "INSTAGRAM"] : [job.platform as "FACEBOOK" | "INSTAGRAM"];

  const results: PlatformResult[] = [];

  for (const plat of platforms) {
    console.log(`\n[meta-publish] ── Processing platform: ${plat} ──`);

    // ── Instagram: use direct env credentials if set ───────────────────────
    // INSTAGRAM_USER_ID + INSTAGRAM_ACCESS_TOKEN bypass the MetaConnection
    // DB lookup entirely. These env vars take priority over any stored OAuth
    // connection. The token never leaves the server.
    if (plat === "INSTAGRAM") {
      const igUserId = process.env.INSTAGRAM_USER_ID;
      const igTokenRaw = process.env.INSTAGRAM_ACCESS_TOKEN;

      if (!igUserId || !igTokenRaw) {
        const reason =
          "INSTAGRAM_USER_ID and INSTAGRAM_ACCESS_TOKEN env vars are not set. " +
          "Add them to your environment to enable direct Instagram publishing.";
        console.error(`[meta-publish] INSTAGRAM: ❌ ${reason}`);
        results.push({ platform: "INSTAGRAM", success: false, failureReason: reason });
        continue;
      }

      // ── Token diagnostic logs (no full token printed) ────────────────────
      const igToken = igTokenRaw.trim();
      console.log(`[meta-publish] INSTAGRAM: INSTAGRAM_USER_ID=${igUserId}`);
      console.log(`[meta-publish] INSTAGRAM: token present=true, length=${igTokenRaw.length} (trimmed=${igToken.length})`);
      console.log(`[meta-publish] INSTAGRAM: token prefix=${igToken.slice(0, 6)} suffix=${igToken.slice(-4)}`);
      console.log(`[meta-publish] INSTAGRAM: token has spaces=${/\s/.test(igToken)}, raw had leading/trailing whitespace=${igTokenRaw !== igToken}`);
      console.log(`[meta-publish] INSTAGRAM: endpoint=POST ${GRAPH_BASE}/${igUserId}/media`);

      console.log(`[meta-publish] INSTAGRAM: using direct env credentials (user ID: ${igUserId})`);
      const result = await publishToInstagram(igUserId.trim(), igUserId.trim(), igToken, draftContent);

      if (!result.success) {
        console.error(`[meta-publish] INSTAGRAM: ❌ FAILED — ${result.failureReason}`);
      } else {
        console.log(
          `[meta-publish] INSTAGRAM: ✅ SUCCESS — ` +
          `externalPostId=${result.externalPostId ?? "none"} | ` +
          `publishedUrl=${result.publishedUrl ?? "none"}`
        );
      }

      results.push(result);
      continue;
    }

    // ── Facebook path: validate env vars, then find active connection ────────
    // This block is only reached when plat === "FACEBOOK".
    // Instagram takes the early-return env-var path above and never gets here.
    try {
      requireFacebookPublishEnv();
    } catch (err) {
      const reason = `Facebook publishing requires META_APP_ID, META_APP_SECRET, and TOKEN_ENCRYPTION_KEY to be set. ${err instanceof Error ? err.message : String(err)}`;
      console.error(`[meta-publish] FACEBOOK: ❌ ${reason}`);
      results.push({ platform: "FACEBOOK", success: false, failureReason: reason });
      continue;
    }

    const connection = await prisma.metaConnection.findFirst({
      where: { platform: plat, isActive: true },
      orderBy: { updatedAt: "desc" },
    });

    if (!connection) {
      const reason = `No active FACEBOOK connection found. Connect your account in Settings before publishing.`;
      console.error(`[meta-publish] ${plat}: ❌ ${reason}`);
      results.push({ platform: plat, success: false, failureReason: reason });
      continue;
    }

    console.log(`[meta-publish] ${plat}: using connection "${connection.pageName}" (id: ${connection.pageId})`);

    // ── Check / refresh token ──────────────────────────────────────────────
    let token: string;
    const now = new Date();
    const isExpired = connection.tokenExpiresAt && connection.tokenExpiresAt < now;
    const isNearExpiry =
      !isExpired &&
      connection.tokenExpiresAt &&
      connection.tokenExpiresAt < new Date(now.getTime() + REFRESH_WITHIN_HOURS * 3600 * 1000);

    if (isExpired) {
      console.log(
        `[meta-publish] ${plat}: token expired at ${connection.tokenExpiresAt!.toISOString()}, ` +
        `attempting refresh before giving up...`
      );
      const newToken = await tryRefreshAndPersist(connection.id, connection.encryptedToken);
      if (!newToken) {
        const reason =
          `${plat} access token has expired (${connection.tokenExpiresAt!.toISOString()}) and could not be refreshed. ` +
          `Please reconnect your account in Settings.`;
        console.error(`[meta-publish] ${plat}: ❌ ${reason}`);
        results.push({ platform: plat, success: false, failureReason: reason });
        continue;
      }
      token = newToken;
    } else {
      if (isNearExpiry) {
        console.log(
          `[meta-publish] ${plat}: token expires ${connection.tokenExpiresAt!.toISOString()} ` +
          `(within ${REFRESH_WITHIN_HOURS}h), attempting proactive refresh...`
        );
        const newToken = await tryRefreshAndPersist(connection.id, connection.encryptedToken);
        if (newToken) {
          token = newToken;
        } else {
          // Refresh failed but token hasn't expired yet — use the existing one
          console.warn(`[meta-publish] ${plat}: proactive refresh failed, continuing with existing token.`);
          try {
            token = decrypt(connection.encryptedToken);
          } catch (err) {
            const reason = `Failed to decrypt ${plat} token: ${err instanceof Error ? err.message : String(err)}.`;
            console.error(`[meta-publish] ${plat}: ❌ ${reason}`);
            results.push({ platform: plat, success: false, failureReason: reason });
            continue;
          }
        }
      } else {
        // Token is fine — just decrypt it
        try {
          token = decrypt(connection.encryptedToken);
        } catch (err) {
          const reason =
            `Failed to decrypt ${plat} token: ${err instanceof Error ? err.message : String(err)}. ` +
            `TOKEN_ENCRYPTION_KEY may have changed. Reconnect the account in Settings.`;
          console.error(`[meta-publish] ${plat}: ❌ ${reason}`);
          results.push({ platform: plat, success: false, failureReason: reason });
          continue;
        }
      }
    }

    // ── Call Meta Graph API ────────────────────────────────────────────────
    let result: PlatformResult & { isTokenExpired?: boolean };

    if (plat === "FACEBOOK") {
      result = await publishToFacebook(connection.pageId, connection.pageName, token, draftContent);
    } else {
      result = await publishToInstagram(connection.pageId, connection.pageName, token, draftContent);
    }

    // ── If Meta says token is expired, attempt one refresh + retry ─────────
    if (!result.success && result.isTokenExpired) {
      console.log(`[meta-publish] ${plat}: Meta returned OAuthException/190. Attempting token refresh + retry...`);
      const newToken = await tryRefreshAndPersist(connection.id, connection.encryptedToken);
      if (newToken) {
        console.log(`[meta-publish] ${plat}: Retrying publish with refreshed token...`);
        if (plat === "FACEBOOK") {
          result = await publishToFacebook(connection.pageId, connection.pageName, newToken, draftContent);
        } else {
          result = await publishToInstagram(connection.pageId, connection.pageName, newToken, draftContent);
        }
      } else {
        result = {
          ...result,
          failureReason:
            `${plat} token is invalid or expired and could not be refreshed. ` +
            `Please reconnect your account in Settings.`,
        };
      }
    }

    if (!result.success) {
      console.error(`[meta-publish] ${plat}: ❌ FAILED — ${result.failureReason}`);
    } else {
      console.log(
        `[meta-publish] ${plat}: ✅ SUCCESS — ` +
        `externalPostId=${result.externalPostId ?? "none"} | ` +
        `publishedUrl=${result.publishedUrl ?? "none"}`
      );
    }

    results.push(result);
  }

  // ── Determine aggregate outcome ───────────────────────────────────────────
  const allSucceeded = results.every((r) => r.success);
  const anySucceeded = results.some((r) => r.success);
  const overallStatus: "PUBLISHED" | "FAILED" = allSucceeded ? "PUBLISHED" : "FAILED";

  const successResults = results.filter((r) => r.success);
  const failResults = results.filter((r) => !r.success);

  const externalPostId = successResults.map((r) => r.externalPostId).filter(Boolean).join(", ") || null;
  const publishedUrl = successResults.map((r) => r.publishedUrl).filter(Boolean).join(", ") || null;
  const failureReason =
    failResults.length > 0
      ? failResults.map((r) => `[${r.platform}] ${r.failureReason}`).join("; ")
      : null;

  // ── Persist to DB ─────────────────────────────────────────────────────────
  await prisma.publishJob.update({
    where: { id: jobId },
    data: {
      status: overallStatus,
      publishedAt: anySucceeded ? new Date() : null,
      publishMethod: "MANUAL",
      externalPostId,
      publishedUrl,
      failureReason,
    },
  });

  console.log(
    `\n[meta-publish] ═══ Job ${jobId} complete: ${overallStatus} ` +
    `(${results.filter((r) => r.success).length}/${results.length} platforms succeeded) ═══\n`
  );

  return { overallStatus, results };
}
