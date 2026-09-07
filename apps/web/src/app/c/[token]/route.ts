import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { getVerification } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEAL = rgb(0.06, 0.48, 0.48);
const ORANGE = rgb(0.91, 0.38, 0.16);
const INK = rgb(0.06, 0.16, 0.16);
const GREY = rgb(0.45, 0.5, 0.5);

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

export async function GET(
  _req: Request,
  { params }: { params: { token: string } },
) {
  const v = await getVerification(params.token);
  if (!v || v.status !== "passed") {
    return new Response("Certificate not found", { status: 404 });
  }

  const base = process.env.PUBLIC_URL ?? "http://localhost:3000";
  const verifyUrl = `${base}/verify/${v.verifyToken}`;

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]); // A4 portrait
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const { width } = page.getSize();

  // Header band
  page.drawRectangle({ x: 0, y: 782, width, height: 60, color: TEAL });
  page.drawText("T", { x: 40, y: 800, size: 26, font: bold, color: ORANGE });
  page.drawText("&M", { x: 56, y: 800, size: 26, font: bold, color: rgb(1, 1, 1) });
  page.drawText("MANAGEMENT SERVICES", { x: 110, y: 807, size: 11, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Shared Facilities Compliance", { x: 110, y: 792, size: 8, font, color: rgb(0.85, 0.95, 0.95) });

  // Title
  page.drawText("Certificate of Induction", { x: 40, y: 720, size: 26, font: bold, color: INK });
  page.drawRectangle({ x: 40, y: 712, width: 90, height: 3, color: ORANGE });

  page.drawText("This certifies that the person below has completed the induction for:", {
    x: 40, y: 686, size: 11, font, color: GREY,
  });

  // Contractor name
  page.drawText(v.contractorName, { x: 40, y: 652, size: 22, font: bold, color: TEAL });
  if (v.company) page.drawText(v.company, { x: 40, y: 634, size: 12, font, color: GREY });

  // Details grid
  const rows: [string, string][] = [
    ["Property", v.propertyName],
    ["Induction", `${v.inductionTitle} (v${v.versionNumber})`],
    ["Result", v.score != null ? `PASSED — ${v.score}%` : "PASSED"],
    ["Completed", fmt(v.completedAt)],
    ["Valid until", fmt(v.validUntil)],
    ["Certificate #", v.certificateNumber ?? "—"],
  ];
  let y = 580;
  for (const [label, value] of rows) {
    page.drawText(label.toUpperCase(), { x: 40, y, size: 8, font: bold, color: GREY });
    page.drawText(value, { x: 40, y: y - 15, size: 13, font, color: INK });
    page.drawLine({ start: { x: 40, y: y - 24 }, end: { x: 400, y: y - 24 }, thickness: 0.5, color: rgb(0.9, 0.92, 0.92) });
    y -= 42;
  }

  // QR
  const qrPng = await QRCode.toBuffer(verifyUrl, { margin: 1, width: 260 });
  const qrImg = await pdf.embedPng(qrPng);
  page.drawImage(qrImg, { x: 420, y: 470, width: 130, height: 130 });
  page.drawText("Scan to verify", { x: 448, y: 456, size: 9, font, color: GREY });

  // Declaration note
  page.drawText(
    "A signed declaration and immutable completion record are held by T&M Management Services.",
    { x: 40, y: 300, size: 9, font, color: GREY, maxWidth: 515 },
  );

  // Footer
  page.drawRectangle({ x: 0, y: 0, width, height: 40, color: rgb(0.95, 0.97, 0.97) });
  page.drawText(verifyUrl, { x: 40, y: 16, size: 8, font, color: GREY });
  page.drawText("Verified compliance record", { x: 420, y: 16, size: 8, font: bold, color: TEAL });

  const bytes = await pdf.save();
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="induction-${v.certificateNumber ?? "certificate"}.pdf"`,
    },
  });
}
