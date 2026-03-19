import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/meta-token";

const GRAPH_VERSION = "v19.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

function settingsRedirect(request: NextRequest, params: Record<string, string>) {
  const url = new URL("/settings", request.url);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error");

  if (oauthError || !code) {
    return settingsRedirect(request, { meta_error: "access_denied" });
  }

  try {
    // 1. Exchange code for short-lived user access token
    const shortTokenRes = await fetch(
      `${GRAPH_BASE}/oauth/access_token?${new URLSearchParams({
        client_id: process.env.META_APP_ID ?? "",
        client_secret: process.env.META_APP_SECRET ?? "",
        redirect_uri: process.env.META_REDIRECT_URI ?? "",
        code,
      })}`
    );
    if (!shortTokenRes.ok) {
      const body = await shortTokenRes.text();
      console.error("[meta/callback] short token exchange failed:", body);
      return settingsRedirect(request, { meta_error: "token_exchange_failed" });
    }
    const { access_token: shortToken } = (await shortTokenRes.json()) as {
      access_token: string;
    };

    // 2. Exchange short-lived for long-lived user access token (60 days)
    const longTokenRes = await fetch(
      `${GRAPH_BASE}/oauth/access_token?${new URLSearchParams({
        grant_type: "fb_exchange_token",
        client_id: process.env.META_APP_ID ?? "",
        client_secret: process.env.META_APP_SECRET ?? "",
        fb_exchange_token: shortToken,
      })}`
    );
    if (!longTokenRes.ok) {
      const body = await longTokenRes.text();
      console.error("[meta/callback] long token exchange failed:", body);
      return settingsRedirect(request, { meta_error: "token_exchange_failed" });
    }
    const { access_token: longToken, expires_in } =
      (await longTokenRes.json()) as {
        access_token: string;
        expires_in?: number;
      };

    const userTokenExpiresAt = expires_in
      ? new Date(Date.now() + expires_in * 1000)
      : null;

    // 3. Fetch managed pages — page access tokens are long-lived when derived
    //    from a long-lived user token
    const pagesRes = await fetch(
      `${GRAPH_BASE}/me/accounts?fields=id,name,access_token&access_token=${longToken}`
    );
    if (!pagesRes.ok) {
      const body = await pagesRes.text();
      console.error("[meta/callback] pages fetch failed:", body);
      return settingsRedirect(request, { meta_error: "pages_fetch_failed" });
    }
    const { data: pages } = (await pagesRes.json()) as {
      data: Array<{ id: string; name: string; access_token: string }>;
    };

    // 4. Upsert one MetaConnection per Facebook page,
    //    and one per linked Instagram business account
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

      // Check for a linked Instagram business account on this page
      const igRes = await fetch(
        `${GRAPH_BASE}/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`
      );
      if (!igRes.ok) continue;

      const igData = (await igRes.json()) as {
        instagram_business_account?: { id: string };
      };
      if (!igData.instagram_business_account?.id) continue;

      const igAccountId = igData.instagram_business_account.id;

      // Fetch the IG account username for a human-readable pageName
      const igInfoRes = await fetch(
        `${GRAPH_BASE}/${igAccountId}?fields=id,username&access_token=${page.access_token}`
      );
      const igInfo = igInfoRes.ok
        ? ((await igInfoRes.json()) as { id: string; username?: string })
        : { id: igAccountId, username: undefined };

      // Instagram is published via the page access token
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

    return settingsRedirect(request, { meta_connected: "true" });
  } catch (err) {
    console.error(
      "[meta/callback] unexpected error:",
      err instanceof Error ? err.message : err
    );
    return settingsRedirect(request, { meta_error: "server_error" });
  }
}
