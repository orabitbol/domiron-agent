import crypto from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireMetaEnv } from "@/lib/env";

const GRAPH_VERSION = "v19.0";

// These are standard Facebook Login permissions required for this app's flow:
//   pages_show_list          — list pages the user manages
//   pages_read_engagement    — read page metadata (needed to fetch the page token)
//   pages_manage_posts       — create posts on managed pages
//   instagram_content_publish — publish media to an Instagram Business account
//
// NOTE: instagram_basic is intentionally ABSENT. It belongs to the deprecated
// Instagram Login API and is NOT a valid scope for Facebook Login. Including it
// causes Facebook to reject the entire OAuth request with "Invalid Scopes".
//
// instagram_content_publish requires the app to be in Live mode + App Review for
// production use. In Development mode it works only for app admins/developers.
const SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "instagram_content_publish",
].join(",");

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

  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    redirect_uri: process.env.META_REDIRECT_URI!,
    scope: SCOPES,
    response_type: "code",
    state,
  });

  const oauthUrl = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
  console.log("[meta/auth-url] OAuth URL (first 120 chars):", oauthUrl.slice(0, 120));

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
