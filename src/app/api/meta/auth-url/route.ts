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

  // Uses Facebook Login for Business configuration — permissions are defined
  // in the Meta Developer Console under the Business Login Config, not here.
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    redirect_uri: process.env.META_REDIRECT_URI!,
    response_type: "code",
    state,
    config_id: process.env.META_CONFIG_ID!,
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
