import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
export async function readSyllabusFile(file) {
  if (!/\.pdf$/i.test(file.name))
    return { name: file.name, text: await file.text() };
  const document = await pdfjsLib.getDocument({
    data: await file.arrayBuffer(),
  }).promise;
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
  return { name: file.name, text };
}
