import crypto from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireMetaEnv } from "@/lib/env";

const GRAPH_VERSION = "v19.0";

const SCOPES = [
  "pages_manage_posts",
  "pages_read_engagement",
  "pages_show_list",
  "instagram_business_content_publish",
].join(",");

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  requireMetaEnv();

  // Generate a random CSRF state token.
  // It is stored in an HttpOnly cookie and validated in the OAuth callback.
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    redirect_uri: process.env.META_REDIRECT_URI!,
    scope: SCOPES,
    response_type: "code",
    state,
  });

  const url = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`;

  const response = NextResponse.json({ url });

  // Store state in a short-lived HttpOnly cookie.
  // The browser will send it back when Facebook redirects to the callback.
  response.cookies.set("meta_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes — long enough for the OAuth round-trip
    path: "/",
  });

  return response;
}
