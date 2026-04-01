import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { auth } from "@/lib/auth";
import { isCloudinaryConfigured } from "@/lib/env";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isCloudinaryConfigured()) {
    console.error("[media/upload] Missing Cloudinary env vars (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)");
    return NextResponse.json(
      { error: "Media upload is not configured. Add Cloudinary credentials to environment variables." },
      { status: 500 }
    );
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME!;
  const apiKey = process.env.CLOUDINARY_API_KEY!;
  const apiSecret = process.env.CLOUDINARY_API_SECRET!;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "Missing 'file' field in form data" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      {
        error: `Invalid file type: "${file.type}". Allowed types: ${ALLOWED_TYPES.join(", ")}`,
      },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      {
        error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)} MB. Maximum allowed: 10 MB`,
      },
      { status: 400 }
    );
  }

  // ── Build Cloudinary signed upload ──────────────────────────────────────────
  // Signature algorithm (V1): SHA1("param1=val1&param2=val2&...CLOUDINARY_API_SECRET")
  // Params must be sorted alphabetically; exclude api_key, file, resource_type.
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const folder = "domiron-drafts";

  // Params sorted alphabetically: folder, timestamp
  const toSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
  const signature = createHash("sha1").update(toSign).digest("hex");

  const uploadForm = new FormData();
  uploadForm.set("file", file);
  uploadForm.set("api_key", apiKey);
  uploadForm.set("timestamp", timestamp);
  uploadForm.set("folder", folder);
  uploadForm.set("signature", signature);

  console.log(
    `[media/upload] Uploading to Cloudinary (cloud: ${cloudName}, folder: ${folder}, size: ${(file.size / 1024).toFixed(1)} KB, type: ${file.type})...`
  );

  let res: Response;
  try {
    res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      { method: "POST", body: uploadForm }
    );
  } catch (err) {
    console.error("[media/upload] Network error reaching Cloudinary:", err);
    return NextResponse.json(
      { error: "Failed to reach Cloudinary. Check network connectivity." },
      { status: 502 }
    );
  }

  const data = (await res.json()) as Record<string, unknown>;

  if (!res.ok) {
    const errMsg =
      data.error && typeof data.error === "object"
        ? String((data.error as Record<string, unknown>).message ?? JSON.stringify(data.error))
        : JSON.stringify(data);
    console.error(`[media/upload] Cloudinary upload failed (HTTP ${res.status}):`, errMsg);
    return NextResponse.json(
      { error: `Cloudinary upload failed: ${errMsg}` },
      { status: 502 }
    );
  }

  const url = data.secure_url as string | undefined;
  if (!url) {
    console.error("[media/upload] Cloudinary response missing secure_url:", JSON.stringify(data));
    return NextResponse.json(
      { error: "Cloudinary response did not include a URL" },
      { status: 502 }
    );
  }

  console.log(`[media/upload] ✅ Upload successful. url=${url}`);
  return NextResponse.json({ url });
}
