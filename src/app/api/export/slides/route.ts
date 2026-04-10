import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { auth } from "@/lib/auth";
import { isCloudinaryConfigured } from "@/lib/env";

/**
 * POST /api/export/slides
 *
 * Accepts an array of base64-encoded PNG images (from client-side
 * html-to-image rendering of carousel slides), uploads each to
 * Cloudinary, and returns an array of public HTTPS URLs.
 *
 * Request body: { images: string[] }
 *   Each string is a base64 data URI: "data:image/png;base64,..."
 *
 * Response: { urls: string[] }
 *   Ordered array of Cloudinary secure_url values, one per input image.
 */

const MAX_IMAGES = 10;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB per image

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isCloudinaryConfigured()) {
    return NextResponse.json(
      { error: "Cloudinary is not configured. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET." },
      { status: 500 }
    );
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME!;
  const apiKey = process.env.CLOUDINARY_API_KEY!;
  const apiSecret = process.env.CLOUDINARY_API_SECRET!;

  let body: { images?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.images) || body.images.length === 0) {
    return NextResponse.json({ error: "Missing or empty 'images' array" }, { status: 400 });
  }

  if (body.images.length > MAX_IMAGES) {
    return NextResponse.json(
      { error: `Too many images: ${body.images.length}. Maximum: ${MAX_IMAGES}` },
      { status: 400 }
    );
  }

  const images = body.images as string[];
  console.log(`[export/slides] Uploading ${images.length} slide images to Cloudinary...`);

  const urls: string[] = [];

  for (let i = 0; i < images.length; i++) {
    const dataUri = images[i];

    if (typeof dataUri !== "string" || !dataUri.startsWith("data:image/")) {
      return NextResponse.json(
        { error: `Image ${i + 1} is not a valid data URI` },
        { status: 400 }
      );
    }

    // Extract base64 portion and check size
    const base64Data = dataUri.split(",")[1];
    if (!base64Data) {
      return NextResponse.json(
        { error: `Image ${i + 1} has no base64 data` },
        { status: 400 }
      );
    }

    const sizeBytes = Math.ceil(base64Data.length * 0.75);
    if (sizeBytes > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: `Image ${i + 1} too large: ${(sizeBytes / 1024 / 1024).toFixed(1)} MB. Max: 5 MB` },
        { status: 400 }
      );
    }

    // Upload to Cloudinary using the data URI directly (Cloudinary accepts base64)
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

    console.log(`[export/slides]   Uploading slide ${i + 1}/${images.length} (${(sizeBytes / 1024).toFixed(0)} KB)...`);

    let res: Response;
    try {
      res = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        { method: "POST", body: uploadForm }
      );
    } catch (err) {
      console.error(`[export/slides]   Slide ${i + 1}: network error:`, err);
      return NextResponse.json(
        { error: `Failed to upload slide ${i + 1} to Cloudinary` },
        { status: 502 }
      );
    }

    const data = (await res.json()) as Record<string, unknown>;

    if (!res.ok) {
      const errMsg =
        data.error && typeof data.error === "object"
          ? String((data.error as Record<string, unknown>).message ?? JSON.stringify(data.error))
          : JSON.stringify(data);
      console.error(`[export/slides]   Slide ${i + 1}: Cloudinary error:`, errMsg);
      return NextResponse.json(
        { error: `Cloudinary upload failed for slide ${i + 1}: ${errMsg}` },
        { status: 502 }
      );
    }

    const url = data.secure_url as string | undefined;
    if (!url) {
      return NextResponse.json(
        { error: `Cloudinary response missing URL for slide ${i + 1}` },
        { status: 502 }
      );
    }

    console.log(`[export/slides]   Slide ${i + 1}: ✅ ${url}`);
    urls.push(url);
  }

  console.log(`[export/slides] All ${urls.length} slides uploaded successfully.`);
  return NextResponse.json({ urls });
}
