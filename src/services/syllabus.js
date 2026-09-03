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
  if (!/\.pdf$/i.test(file.name)) {
    const text = await file.text()
    const originalBytesBase64 = bytesToBase64(bytes)
    return { name: file.name, text, originalContent: text, originalBytesBase64, byteLength: bytes.byteLength, sourceHash: await contentHash(bytes), parseStatus: 'parsed' }
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
  const originalBytesBase64 = bytesToBase64(bytes)
  return { name: file.name, text, originalContent: '', originalBytesBase64, byteLength: bytes.byteLength, sourceHash: await contentHash(bytes), parseStatus: 'parsed' };
}
