/**
 * PDF-lib lazy loader utility
 * Loads PDF-lib only when needed to reduce initial bundle size
 */

let pdfLibPromise = null;

export async function loadPDFLib() {
    if (!pdfLibPromise) {
        pdfLibPromise = import('pdf-lib').then(module => {
            return {
                PDFDocument: module.PDFDocument,
                degrees: module.degrees,
                rgb: module.rgb
            };
        });
    }
    
    return pdfLibPromise;
}

export async function createPDFDocument() {
    const { PDFDocument } = await loadPDFLib();
    return PDFDocument.create();
}

export async function loadPDFFromBytes(bytes) {
    const { PDFDocument } = await loadPDFLib();
    return PDFDocument.load(bytes);
}