// ── Export generators (server-side only) ──────────────────────────────────────

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  convertInchesToTwip,
} from "docx";
import React from "react";
import { renderToBuffer, Document as PdfDocument, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { DocumentType } from "@/lib/types";

const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  bullets: "Resume Bullets",
  summary: "Professional Summary",
  cover_letter: "Cover Letter",
  linkedin_about: "LinkedIn About",
  linkedin_headline: "LinkedIn Headline",
};

// ── DOCX ──────────────────────────────────────────────────────────────────────

export async function generateDocx(outputText: string, documentType: DocumentType): Promise<Buffer> {
  const label = DOC_TYPE_LABELS[documentType];
  const margin = convertInchesToTwip(1);

  let bodyParagraphs: Paragraph[];

  if (documentType === "bullets") {
    const lines = outputText.split("\n").filter((l) => l.trim().length > 0);
    bodyParagraphs = lines.map((line) => {
      const text = line.replace(/^[\-•\*]\s*/, "").trim();
      return new Paragraph({
        text,
        bullet: { level: 0 },
      });
    });
  } else if (documentType === "summary") {
    bodyParagraphs = [
      new Paragraph({
        children: [new TextRun({ text: outputText })],
        alignment: AlignmentType.JUSTIFIED,
        spacing: { line: 360 },
      }),
    ];
  } else {
    // cover_letter, linkedin_about, linkedin_headline
    const chunks = outputText.split(/\n\n+/);
    bodyParagraphs = chunks.map(
      (chunk) =>
        new Paragraph({
          children: [new TextRun({ text: chunk.trim() })],
          spacing: { after: 200 },
        })
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: margin,
              bottom: margin,
              left: margin,
              right: margin,
            },
          },
        },
        children: [
          new Paragraph({
            text: label,
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 200 },
          }),
          ...bodyParagraphs,
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}

// ── PDF ───────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    paddingTop: 54,
    paddingBottom: 60,
    paddingLeft: 54,
    paddingRight: 54,
    fontFamily: "Helvetica",
  },
  heading: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#1e293b",
    marginBottom: 12,
  },
  body: {
    fontSize: 11,
    color: "#334155",
    lineHeight: 1.6,
  },
  bulletRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  bulletDot: {
    fontSize: 11,
    color: "#334155",
    marginRight: 6,
    marginTop: 1,
  },
  bulletText: {
    fontSize: 11,
    color: "#334155",
    lineHeight: 1.6,
    flex: 1,
  },
  paragraph: {
    fontSize: 11,
    color: "#334155",
    lineHeight: 1.6,
    marginBottom: 12,
  },
});

export async function generatePdf(outputText: string, documentType: DocumentType): Promise<Buffer> {
  const label = DOC_TYPE_LABELS[documentType];

  let bodyContent: React.ReactElement;

  if (documentType === "bullets") {
    const lines = outputText.split("\n").filter((l) => l.trim().length > 0);
    bodyContent = React.createElement(
      View,
      null,
      ...lines.map((line, i) => {
        const text = line.replace(/^[\-•\*]\s*/, "").trim();
        return React.createElement(
          View,
          { key: i, style: styles.bulletRow },
          React.createElement(Text, { style: styles.bulletDot }, "•"),
          React.createElement(Text, { style: styles.bulletText }, text)
        );
      })
    );
  } else if (documentType === "summary") {
    bodyContent = React.createElement(Text, { style: styles.body }, outputText);
  } else {
    // cover_letter, linkedin_about, linkedin_headline
    const chunks = outputText.split(/\n\n+/).filter((c) => c.trim().length > 0);
    bodyContent = React.createElement(
      View,
      null,
      ...chunks.map((chunk, i) =>
        React.createElement(Text, { key: i, style: styles.paragraph }, chunk.trim())
      )
    );
  }

  const doc = React.createElement(
    PdfDocument,
    null,
    React.createElement(
      Page,
      { size: "A4", style: styles.page },
      React.createElement(Text, { style: styles.heading }, label),
      bodyContent
    )
  );

  return Buffer.from(await renderToBuffer(doc));
}
