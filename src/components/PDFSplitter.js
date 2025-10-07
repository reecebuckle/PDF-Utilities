/**
 * PDFSplitter - Handles PDF splitting operations
 */
import { createPDFDocument, loadPDFFromBytes } from '../utils/pdfLibLoader.js';

export class PDFSplitter {
    constructor(onProgress) {
        this.onProgress = onProgress || (() => {});
        this.isProcessing = false;
    }

    async splitPDF(file, ranges) {
        if (this.isProcessing) {
            throw new Error('PDF splitting is already in progress');
        }

        this.isProcessing = true;
        
        try {
            this.updateProgress(0, 'Loading PDF...');
            
            // Load the source PDF
            const arrayBuffer = await this.fileToArrayBuffer(file);
            const uint8Array = new Uint8Array(arrayBuffer);
            const sourcePdf = await loadPDFFromBytes(uint8Array);
            const totalPages = sourcePdf.getPageCount();
            
            // Validate and parse ranges
            const validatedRanges = this.validateAndParseRanges(ranges, totalPages);
            
            this.updateProgress(10, 'Preparing to split...');
            
            const results = [];
            
            for (let i = 0; i < validatedRanges.length; i++) {
                const range = validatedRanges[i];
                const progress = 10 + ((i + 1) / validatedRanges.length) * 80;
                
                this.updateProgress(progress, `Creating split ${i + 1} of ${validatedRanges.length}...`);
                
                // Create new PDF for this range
                const newPdf = await createPDFDocument();
                
                // Copy pages for this range
                const pageIndices = [];
                for (let pageNum = range.start; pageNum <= range.end; pageNum++) {
                    pageIndices.push(pageNum - 1); // PDF-lib uses 0-based indexing
                }
                
                const copiedPages = await newPdf.copyPages(sourcePdf, pageIndices);
                copiedPages.forEach(page => newPdf.addPage(page));
                
                // Generate the PDF bytes
                const pdfBytes = await newPdf.save();
                
                // Create result object
                const filename = this.generateSplitFilename(file.name, range, i + 1);
                results.push({
                    filename: filename,
                    data: pdfBytes,
                    pages: `${range.start}-${range.end}`,
                    size: pdfBytes.length
                });
            }
            
            this.updateProgress(100, 'Split completed!');
            
            return results;
            
        } catch (error) {
            throw new Error(`PDF split failed: ${error.message}`);
        } finally {
            this.isProcessing = false;
        }
    }

    async splitIntoIndividualPages(file) {
        if (this.isProcessing) {
            throw new Error('PDF splitting is already in progress');
        }

        this.isProcessing = true;
        
        try {
            this.updateProgress(0, 'Loading PDF...');
            
            // Load the source PDF
            const arrayBuffer = await this.fileToArrayBuffer(file);
            const uint8Array = new Uint8Array(arrayBuffer);
            const sourcePdf = await loadPDFFromBytes(uint8Array);
            const totalPages = sourcePdf.getPageCount();
            
            this.updateProgress(10, 'Preparing to split into individual pages...');
            
            const results = [];
            
            for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
                const progress = 10 + (pageNum / totalPages) * 80;
                this.updateProgress(progress, `Creating page ${pageNum} of ${totalPages}...`);
                
                // Create new PDF for this page
                const newPdf = await createPDFDocument();
                
                // Copy single page
                const [copiedPage] = await newPdf.copyPages(sourcePdf, [pageNum - 1]);
                newPdf.addPage(copiedPage);
                
                // Generate the PDF bytes
                const pdfBytes = await newPdf.save();
                
                // Create result object
                const filename = this.generatePageFilename(file.name, pageNum);
                results.push({
                    filename: filename,
                    data: pdfBytes,
                    pages: `${pageNum}`,
                    size: pdfBytes.length
                });
            }
            
            this.updateProgress(100, 'Split completed!');
            
            return results;
            
        } catch (error) {
            throw new Error(`PDF split failed: ${error.message}`);
        } finally {
            this.isProcessing = false;
        }
    }

    validateAndParseRanges(rangesString, totalPages) {
        if (!rangesString || rangesString.trim() === '') {
            throw new Error('Please enter page ranges');
        }

        const ranges = [];
        const parts = rangesString.split(',').map(part => part.trim());
        
        for (const part of parts) {
            if (part === '') continue;
            
            if (part.includes('-')) {
                // Range like "1-5"
                const [startStr, endStr] = part.split('-').map(s => s.trim());
                const start = parseInt(startStr);
                const end = parseInt(endStr);
                
                if (isNaN(start) || isNaN(end)) {
                    throw new Error(`Invalid range: ${part}`);
                }
                
                if (start < 1 || end < 1 || start > totalPages || end > totalPages) {
                    throw new Error(`Range ${part} is outside document bounds (1-${totalPages})`);
                }
                
                if (start > end) {
                    throw new Error(`Invalid range ${part}: start page must be less than or equal to end page`);
                }
                
                ranges.push({ start, end });
            } else {
                // Single page like "5"
                const pageNum = parseInt(part);
                
                if (isNaN(pageNum)) {
                    throw new Error(`Invalid page number: ${part}`);
                }
                
                if (pageNum < 1 || pageNum > totalPages) {
                    throw new Error(`Page ${pageNum} is outside document bounds (1-${totalPages})`);
                }
                
                ranges.push({ start: pageNum, end: pageNum });
            }
        }
        
        if (ranges.length === 0) {
            throw new Error('No valid page ranges found');
        }
        
        // Sort ranges by start page
        ranges.sort((a, b) => a.start - b.start);
        
        return ranges;
    }

    generateSplitFilename(originalName, range, index) {
        const baseName = originalName.replace(/\.pdf$/i, '');
        if (range.start === range.end) {
            return `${baseName}_page_${range.start}.pdf`;
        } else {
            return `${baseName}_pages_${range.start}-${range.end}.pdf`;
        }
    }

    generatePageFilename(originalName, pageNum) {
        const baseName = originalName.replace(/\.pdf$/i, '');
        return `${baseName}_page_${pageNum}.pdf`;
    }

    async fileToArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = () => {
                resolve(reader.result);
            };
            
            reader.onerror = () => {
                reject(new Error(`Failed to read file: ${file.name}`));
            };
            
            reader.readAsArrayBuffer(file);
        });
    }

    updateProgress(percentage, message) {
        this.onProgress({
            percentage: Math.round(percentage),
            message: message
        });
    }

    setProgressCallback(callback) {
        this.onProgress = callback || (() => {});
    }

    getIsProcessing() {
        return this.isProcessing;
    }

    cancel() {
        this.isProcessing = false;
    }

    async getPageCount(file) {
        try {
            const arrayBuffer = await this.fileToArrayBuffer(file);
            const uint8Array = new Uint8Array(arrayBuffer);
            const pdf = await loadPDFFromBytes(uint8Array);
            return pdf.getPageCount();
        } catch (error) {
            throw new Error(`Failed to read PDF: ${error.message}`);
        }
    }
}