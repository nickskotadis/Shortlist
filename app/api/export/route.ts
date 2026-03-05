import JSZip from "jszip";
import { generateDocx, generatePdf } from "@/lib/export";
import { createClient } from "@/lib/supabase/server";
import type { DocumentType } from "@/lib/types";

const VALID_DOC_TYPES = new Set<DocumentType>([
  "bullets",
  "summary",
  "cover_letter",
  "linkedin_about",
  "linkedin_headline",
]);
const VALID_FORMATS = new Set(["docx", "pdf", "zip"]);

interface BatchDoc {
  output_text: string;
  document_type: DocumentType;
}

export async function POST(req: Request) {
  // BUG-01: require auth — export is CPU-intensive and must be gated
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { output_text, document_type, format, batch } = body as Record<string, unknown>;

  if (typeof format !== "string" || !VALID_FORMATS.has(format)) {
    return Response.json({ error: "Invalid format" }, { status: 400 });
  }

  // ── ZIP batch export ────────────────────────────────────────────────────────
  if (format === "zip") {
    if (!Array.isArray(batch) || batch.length === 0) {
      return Response.json({ error: "batch array is required for zip format" }, { status: 400 });
    }
    // BUG-06: cap batch size to prevent DoS
    if (batch.length > 10) {
      return Response.json({ error: "Batch export is limited to 10 documents" }, { status: 400 });
    }

    const zip = new JSZip();

    for (const item of batch as BatchDoc[]) {
      if (
        typeof item.output_text !== "string" ||
        item.output_text.length < 10 ||
        !VALID_DOC_TYPES.has(item.document_type)
      ) {
        continue;
      }
      try {
        const buf = await generateDocx(item.output_text, item.document_type);
        zip.file(`shortlist-${item.document_type}.docx`, buf);
      } catch {
        // Skip failed exports — don't fail the whole ZIP
      }
    }

    const zipData = await zip.generateAsync({ type: "arraybuffer" });
    const zipBytes = new Uint8Array(zipData);

    return new Response(zipBytes, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="shortlist-application-package.zip"`,
        "Content-Length": String(zipBytes.byteLength),
        "Cache-Control": "no-store",
      },
    });
  }

  // ── Single doc export ───────────────────────────────────────────────────────
  if (
    typeof output_text !== "string" ||
    output_text.length < 10 ||
    output_text.length > 50_000
  ) {
    return Response.json({ error: "Invalid output_text" }, { status: 400 });
  }

  if (typeof document_type !== "string" || !VALID_DOC_TYPES.has(document_type as DocumentType)) {
    return Response.json({ error: "Invalid document_type" }, { status: 400 });
  }

  const docType = document_type as DocumentType;
  const ext = format as "docx" | "pdf";

  let buffer: Buffer;
  let contentType: string;

  if (ext === "docx") {
    buffer = await generateDocx(output_text, docType);
    contentType =
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  } else {
    buffer = await generatePdf(output_text, docType);
    contentType = "application/pdf";
  }

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="shortlist-${docType}.${ext}"`,
      "Content-Length": String(buffer.length),
      "Cache-Control": "no-store",
    },
  });
}
