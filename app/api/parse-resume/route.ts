import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { PARSE_RESUME_IP_LIMIT, PARSE_RESUME_IP_WINDOW_SEC } from "@/lib/constants";

// POST — parse a PDF or DOCX file and return its plain text
// Accepts multipart/form-data with a "file" field
export async function POST(req: NextRequest) {
  // Anonymous upload is allowed on purpose (upload→first generation is the
  // try-before-signup moment). It's cheap CPU, not an LLM call — but the
  // parsers are memory-heavy, so bound logged-out traffic per IP against abuse.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const ip = getClientIp(req);
    const { allowed, retryAfterSec } = await rateLimit(
      `parse:${ip}`,
      PARSE_RESUME_IP_LIMIT,
      PARSE_RESUME_IP_WINDOW_SEC
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many uploads — please wait a bit, or paste your resume instead." },
        { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
      );
    }
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
      // pdf-parse v2 — class API: new PDFParse({ data }).getText(); dynamic
      // import keeps the heavy pdfjs dependency out of module init.
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      let text: string;
      try {
        const result = await parser.getText();
        // Strip v2 page-delimiter lines ("-- 1 of 3 --") so the resume text
        // handed to the LLM consumers stays clean.
        text = (result.text ?? "").replace(/^-- \d+ of \d+ --$/gm, "").trim();
      } finally {
        await parser.destroy();
      }
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
