import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { auth } from "@/lib/auth";
import { isCloudinaryConfigured } from "@/lib/env";

/**
 * POST /api/export/slides
 *
 * Uploads a SINGLE base64-encoded PNG image to Cloudinary.
 * Called once per carousel slide to keep each request under 2MB.
 *
 * Request body: { image: string }
 *   A base64 data URI: "data:image/png;base64,..."
 *
 * Response: { url: string }
 *   The Cloudinary secure_url for the uploaded image.
 */

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isCloudinaryConfigured()) {
    return NextResponse.json(
      { error: "Cloudinary is not configured." },
      { status: 500 }
    );
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME!;
  const apiKey = process.env.CLOUDINARY_API_KEY!;
  const apiSecret = process.env.CLOUDINARY_API_SECRET!;

  let body: { image?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const dataUri = body.image;
  if (typeof dataUri !== "string" || !dataUri.startsWith("data:image/")) {
    return NextResponse.json({ error: "Missing or invalid 'image' data URI" }, { status: 400 });
  }

  const base64Data = dataUri.split(",")[1];
  if (!base64Data) {
    return NextResponse.json({ error: "Image has no base64 data" }, { status: 400 });
  }

  const sizeBytes = Math.ceil(base64Data.length * 0.75);
  if (sizeBytes > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: `Image too large: ${(sizeBytes / 1024 / 1024).toFixed(1)} MB. Max: 5 MB` },
      { status: 400 }
    );
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const folder = "domiron-carousel-slides";
  const toSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
  const signature = createHash("sha1").update(toSign).digest("hex");

  const uploadForm = new FormData();
  uploadForm.set("file", dataUri);
  uploadForm.set("api_key", apiKey);
  uploadForm.set("timestamp", timestamp);
  uploadForm.set("folder", folder);
  uploadForm.set("signature", signature);

  console.log(`[export/slides] Uploading slide (${(sizeBytes / 1024).toFixed(0)} KB)...`);

  let res: Response;
  try {
    res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      { method: "POST", body: uploadForm }
    );
  } catch (err) {
    console.error(`[export/slides] Network error:`, err);
    return NextResponse.json({ error: "Failed to upload to Cloudinary" }, { status: 502 });
  }

  const data = (await res.json()) as Record<string, unknown>;

  if (!res.ok) {
    const errMsg =
      data.error && typeof data.error === "object"
        ? String((data.error as Record<string, unknown>).message ?? JSON.stringify(data.error))
        : JSON.stringify(data);
    console.error(`[export/slides] Cloudinary error:`, errMsg);
    return NextResponse.json({ error: `Cloudinary upload failed: ${errMsg}` }, { status: 502 });
  }

  const url = data.secure_url as string | undefined;
  if (!url) {
    return NextResponse.json({ error: "Cloudinary response missing URL" }, { status: 502 });
  }

  console.log(`[export/slides] ✅ ${url}`);
  return NextResponse.json({ url });
}
