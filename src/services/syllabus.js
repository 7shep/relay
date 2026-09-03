import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { contentHash } from './studyMemoryRuntime.js'
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export function bytesToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  return btoa(binary)
}

export function base64ToBytes(value) {
  const binary = atob(String(value || ''))
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

export async function readSyllabusFile(file) {
  const bytes = await file.arrayBuffer()
  // PDF.js transfers the parser buffer to its worker, which detaches it.
  // Capture the immutable archive metadata before handing bytes to PDF.js.
  const originalBytesBase64 = bytesToBase64(bytes)
  const byteLength = bytes.byteLength
  const sourceHash = await contentHash(bytes)
  if (!/\.pdf$/i.test(file.name)) {
    const text = await file.text()
    return { name: file.name, text, originalContent: text, originalBytesBase64, byteLength, sourceHash, parseStatus: 'parsed' }
  }
  const document = await pdfjsLib.getDocument({ data: bytes }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str).join(" "));
  }
  const text = pages.join("\n\n").trim();
  if (!text)
    throw new Error(
      `${file.name} has no selectable text. Scanned PDFs need OCR before import.`,
    );
  return { name: file.name, text, originalContent: '', originalBytesBase64, byteLength, sourceHash, parseStatus: 'parsed' };
}
