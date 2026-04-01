import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/meta-token";
import { requireMetaEnv } from "@/lib/env";

const GRAPH_VERSION = "v19.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

function settingsRedirect(
  request: NextRequest,
  params: Record<string, string>
): NextResponse {
  const url = new URL("/settings", request.url);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  requireMetaEnv();

  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error");
  const returnedState = searchParams.get("state");

  // ── CSRF state validation ──────────────────────────────────────────────────
  const storedState = request.cookies.get("meta_oauth_state")?.value;
  if (!storedState || !returnedState || storedState !== returnedState) {
    console.error(
      "[meta/callback] state mismatch — possible CSRF. stored=%s returned=%s",
      storedState ? "(present)" : "(missing)",
      returnedState ? "(present)" : "(missing)"
    );
    const resp = settingsRedirect(request, { meta_error: "state_mismatch" });
    resp.cookies.delete("meta_oauth_state");
    return resp;
  }

  if (oauthError || !code) {
    const resp = settingsRedirect(request, { meta_error: "access_denied" });
    resp.cookies.delete("meta_oauth_state");
    return resp;
  }

  const appId = process.env.META_APP_ID!;
  const appSecret = process.env.META_APP_SECRET!;
  const redirectUri = process.env.META_REDIRECT_URI!;

  try {
    // 1. Exchange code for short-lived user access token.
    //    The token-exchange endpoint requires client_secret in the query string
    //    (it does not support the Authorization header for this grant type).
    const shortTokenRes = await fetch(
      `${GRAPH_BASE}/oauth/access_token?${new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: redirectUri,
        code,
      })}`
    );
    if (!shortTokenRes.ok) {
      const body = await shortTokenRes.text();
      console.error("[meta/callback] short token exchange failed:", body);
      const resp = settingsRedirect(request, { meta_error: "token_exchange_failed" });
      resp.cookies.delete("meta_oauth_state");
      return resp;
    }
    const { access_token: shortToken } = (await shortTokenRes.json()) as {
      access_token: string;
    };

    // 2. Exchange short-lived for long-lived user access token (~60 days).
    //    Same restriction: client_secret must be in the query string.
    const longTokenRes = await fetch(
      `${GRAPH_BASE}/oauth/access_token?${new URLSearchParams({
        grant_type: "fb_exchange_token",
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: shortToken,
      })}`
    );
    if (!longTokenRes.ok) {
      const body = await longTokenRes.text();
      console.error("[meta/callback] long token exchange failed:", body);
      const resp = settingsRedirect(request, { meta_error: "token_exchange_failed" });
      resp.cookies.delete("meta_oauth_state");
      return resp;
    }
    const { access_token: longToken, expires_in } =
      (await longTokenRes.json()) as {
        access_token: string;
        expires_in?: number;
      };

    const userTokenExpiresAt = expires_in
      ? new Date(Date.now() + expires_in * 1000)
      : null;

    // 3. Fetch managed pages using Authorization header (not query param).
    //    Page access tokens derived from a long-lived user token are also long-lived.
    const pagesRes = await fetch(
      `${GRAPH_BASE}/me/accounts?fields=id,name,access_token`,
      { headers: { Authorization: `Bearer ${longToken}` } }
    );
    if (!pagesRes.ok) {
      const body = await pagesRes.text();
      console.error("[meta/callback] pages fetch failed:", body);
      const resp = settingsRedirect(request, { meta_error: "pages_fetch_failed" });
      resp.cookies.delete("meta_oauth_state");
      return resp;
    }
    const { data: pages } = (await pagesRes.json()) as {
      data: Array<{ id: string; name: string; access_token: string }>;
    };

    // 4. Upsert one MetaConnection per Facebook page,
    //    and one per linked Instagram business account.
    for (const page of pages) {
      const encryptedPageToken = encrypt(page.access_token);

      await prisma.metaConnection.upsert({
        where: { platform_pageId: { platform: "FACEBOOK", pageId: page.id } },
        update: {
          pageName: page.name,
          encryptedToken: encryptedPageToken,
          tokenExpiresAt: userTokenExpiresAt,
          isActive: true,
        },
        create: {
          platform: "FACEBOOK",
          pageId: page.id,
          pageName: page.name,
          encryptedToken: encryptedPageToken,
          tokenExpiresAt: userTokenExpiresAt,
        },
      });

      // Check for a linked Instagram business account on this Facebook page.
      // Uses the page access token via Authorization header.
      const igRes = await fetch(
        `${GRAPH_BASE}/${page.id}?fields=instagram_business_account`,
        { headers: { Authorization: `Bearer ${page.access_token}` } }
      );
      if (!igRes.ok) continue;

      const igData = (await igRes.json()) as {
        instagram_business_account?: { id: string };
      };
      if (!igData.instagram_business_account?.id) continue;

      const igAccountId = igData.instagram_business_account.id;

      // Fetch the Instagram account username for a human-readable pageName.
      const igInfoRes = await fetch(
        `${GRAPH_BASE}/${igAccountId}?fields=id,username`,
        { headers: { Authorization: `Bearer ${page.access_token}` } }
      );
      const igInfo = igInfoRes.ok
        ? ((await igInfoRes.json()) as { id: string; username?: string })
        : { id: igAccountId, username: undefined };

      // Instagram is published via the linked Facebook page's access token.
      await prisma.metaConnection.upsert({
        where: {
          platform_pageId: { platform: "INSTAGRAM", pageId: igAccountId },
        },
        update: {
          pageName: igInfo.username ?? igAccountId,
          encryptedToken: encryptedPageToken,
          tokenExpiresAt: userTokenExpiresAt,
          isActive: true,
        },
        create: {
          platform: "INSTAGRAM",
          pageId: igAccountId,
          pageName: igInfo.username ?? igAccountId,
          encryptedToken: encryptedPageToken,
          tokenExpiresAt: userTokenExpiresAt,
        },
      });
    }

    const resp = settingsRedirect(request, { meta_connected: "true" });
    // Clear the CSRF state cookie now that the flow is complete.
    resp.cookies.delete("meta_oauth_state");
    return resp;
  } catch (err) {
    console.error(
      "[meta/callback] unexpected error:",
      err instanceof Error ? err.message : err
    );
    const resp = settingsRedirect(request, { meta_error: "server_error" });
    resp.cookies.delete("meta_oauth_state");
    return resp;
  }
}
