import Papa from "papaparse";
import Encoding from "encoding-japanese";
import type { ImportedCsv } from "../types";

export type DetectedEncoding = "UTF8" | "UTF8-BOM" | "SJIS" | "EUCJP" | "JIS";

export function detectEncoding(bytes: Uint8Array): DetectedEncoding {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf
  ) {
    return "UTF8-BOM";
  }
  const detected = Encoding.detect(bytes);
  if (detected === "UTF8") return "UTF8";
  if (detected === "SJIS") return "SJIS";
  if (detected === "EUCJP") return "EUCJP";
  if (detected === "JIS") return "JIS";
  return "UTF8";
}

export function decodeBytes(
  bytes: Uint8Array,
  encoding: DetectedEncoding,
): string {
  if (encoding === "UTF8-BOM") {
    return new TextDecoder("utf-8").decode(bytes.slice(3));
  }
  if (encoding === "UTF8") {
    return new TextDecoder("utf-8").decode(bytes);
  }
  const from = encoding === "SJIS" ? "SJIS" : encoding;
  const unicodeArray = Encoding.convert(bytes, {
    to: "UNICODE",
    from,
  });
  return Encoding.codeToString(unicodeArray);
}

export async function importCsvFromFile(file: File): Promise<ImportedCsv> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const encoding = detectEncoding(bytes);
  const text = decodeBytes(bytes, encoding);
  const parsed = Papa.parse<string[]>(text, {
    skipEmptyLines: true,
  });

  const rows = parsed.data.filter((r) => Array.isArray(r) && r.length > 0);
  if (rows.length === 0) {
    return {
      fileName: file.name,
      encoding,
      headers: [],
      rawRows: [],
    };
  }

  const headers = rows[0].map((h) => (h ?? "").toString().trim());
  const rawRows = rows.slice(1).map((row) =>
    headers.map((_, idx) => (row[idx] ?? "").toString()),
  );

  return {
    fileName: file.name,
    encoding,
    headers,
    rawRows,
  };
}
