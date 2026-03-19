import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

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

  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID ?? "",
    redirect_uri: process.env.META_REDIRECT_URI ?? "",
    scope: SCOPES,
    response_type: "code",
  });

  const url = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
  return NextResponse.json({ url });
}
