import crypto from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireMetaEnv } from "@/lib/env";

const GRAPH_VERSION = "v19.0";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requireMetaEnv();
  } catch (err) {
    console.error("[/api/meta/auth-url] Meta env not configured:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Meta API credentials are not configured" }, { status: 500 });
  }

  // Generate a random CSRF state token.
  // It is stored in an HttpOnly cookie and validated in the OAuth callback.
  const state = crypto.randomUUID();
  console.log("[meta/auth-url] generated state:", state);

  // Standard Facebook Login (scope-based).
  // Permissions proven to work with the "Domiron final" Meta app:
  //   pages_show_list         — let the user select which pages to connect
  //   pages_read_engagement   — required by /me/accounts and page data reads
  //   pages_manage_posts      — required to publish posts to a Facebook Page
  //   business_management     — required when the page is connected to Business Manager
  const OAUTH_SCOPE = [
    "pages_show_list",
    "pages_read_engagement",
    "pages_manage_posts",
    "business_management",
  ].join(",");

  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    redirect_uri: process.env.META_REDIRECT_URI!,
    response_type: "code",
    state,
    scope: OAUTH_SCOPE,
  });

  const oauthUrl = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`;

  console.log("[meta/auth-url] params: client_id=", process.env.META_APP_ID);
  console.log("[meta/auth-url] params: redirect_uri=", process.env.META_REDIRECT_URI);
  console.log("[meta/auth-url] params: response_type=code");
  console.log("[meta/auth-url] params: scope=", OAUTH_SCOPE);
  console.log("[meta/auth-url] full param keys:", [...params.keys()].join(", "));

  // Redirect directly to Facebook — cookie is set on THIS response before the
  // browser follows the redirect, guaranteeing it arrives at the callback.
  const response = NextResponse.redirect(oauthUrl);

  response.cookies.set("meta_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600, // 10 minutes — long enough for the OAuth round-trip
    path: "/",
  });
  console.log("[meta/auth-url] cookie meta_oauth_state set, maxAge=600");

  return response;
}
