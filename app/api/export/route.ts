import { generateDocx, generatePdf } from "@/lib/export";
import type { DocumentType } from "@/lib/types";

const VALID_DOC_TYPES = new Set<DocumentType>(["bullets", "summary", "cover_letter"]);
const VALID_FORMATS = new Set(["docx", "pdf"]);

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { output_text, document_type, format } = body as Record<string, unknown>;

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

  if (typeof format !== "string" || !VALID_FORMATS.has(format)) {
    return Response.json({ error: "Invalid format" }, { status: 400 });
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
