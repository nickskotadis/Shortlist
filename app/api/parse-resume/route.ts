import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST — parse a PDF or DOCX file and return its plain text
// Accepts multipart/form-data with a "file" field
export async function POST(req: NextRequest) {
  // BUG-02: require auth — pdf-parse + mammoth are memory-heavy parsers
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 5 MB)" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();

  // Validate magic bytes — prevent extension spoofing
  const isPdf  = buffer.length >= 4 && buffer.slice(0, 4).toString("ascii") === "%PDF";
  const isDocx = buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;

  try {
    if (name.endsWith(".pdf")) {
      if (!isPdf) {
        return NextResponse.json({ error: "File does not appear to be a valid PDF." }, { status: 400 });
      }
      // Dynamic import — pdf-parse is CommonJS; use default with ESM compat fallback
      const pdfModule = await import("pdf-parse");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfParse = (pdfModule as any).default ?? pdfModule;
      const result = await pdfParse(buffer);
      const text = result.text?.trim() ?? "";
      if (!text) {
        return NextResponse.json({ error: "Could not extract text from PDF — try pasting manually." }, { status: 422 });
      }
      return NextResponse.json({ text });
    }

    if (name.endsWith(".docx")) {
      if (!isDocx) {
        return NextResponse.json({ error: "File does not appear to be a valid DOCX." }, { status: 400 });
      }
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value?.trim() ?? "";
      if (!text) {
        return NextResponse.json({ error: "Could not extract text from DOCX — try pasting manually." }, { status: 422 });
      }
      return NextResponse.json({ text });
    }

    return NextResponse.json(
      { error: "Unsupported file type. Upload a .pdf or .docx file." },
      { status: 400 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Parse failed";
    console.error("[shortlist] parse-resume error:", message);
    return NextResponse.json({ error: "Failed to parse file — try pasting your resume manually." }, { status: 500 });
  }
}
