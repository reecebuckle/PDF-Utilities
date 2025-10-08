/**
 * PDFProcessor - Handles PDF validation and merging operations
 */
import { createPDFDocument, loadPDFFromBytes } from '../utils/pdfLibLoader.js';

export class PDFProcessor {
    constructor(onProgress) {
        this.onProgress = onProgress || (() => {});
        this.isProcessing = false;
    }

    async validatePDF(file) {
        try {
            const arrayBuffer = await this.fileToArrayBuffer(file);
            const uint8Array = new Uint8Array(arrayBuffer);
            
            // Try to load the PDF to validate it
            await loadPDFFromBytes(uint8Array);
            return true;
        } catch (error) {
            console.warn(`PDF validation failed for ${file.name}:`, error);
            return false;
        }
    }

    async mergePDFs(files, selectedPages = null) {
        if (this.isProcessing) {
            throw new Error('PDF processing is already in progress');
        }

        if (!files || files.length === 0) {
            throw new Error('No files provided for merging');
        }

        if (files.length === 1 && (!selectedPages || !selectedPages.has(files[0]))) {
            // If only one file and no page selection, just return it as-is
            return await this.fileToUint8Array(files[0]);
        }

        this.isProcessing = true;
        
        try {
            this.updateProgress(0, 'Initializing PDF merger...');
            
            // Create a new PDF document
            const mergedPdf = await createPDFDocument();
            
            // Process each file
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const progress = ((i + 1) / files.length) * 90; // Reserve 10% for final processing
                
                this.updateProgress(progress, `Processing ${file.name}...`);
                
                try {
                    // Convert file to array buffer
                    const arrayBuffer = await this.fileToArrayBuffer(file);
                    const uint8Array = new Uint8Array(arrayBuffer);
                    
                    // Load the PDF
                    const pdf = await loadPDFFromBytes(uint8Array);
                    
                    // Determine which pages to include
                    let pageIndices;
                    if (selectedPages && selectedPages.has(file)) {
                        // Use selected pages (convert to 0-based indexing)
                        const pages = selectedPages.get(file);
                        if (pages.length === 0) {
                            console.warn(`No pages selected for ${file.name}, skipping`);
                            continue;
                        }
                        pageIndices = pages.map(pageNum => pageNum - 1);
                        console.log(`Including pages ${pages.join(', ')} from ${file.name}`);
                    } else {
                        // Use all pages
                        const pageCount = pdf.getPageCount();
                        pageIndices = Array.from({ length: pageCount }, (_, i) => i);
                        console.log(`Including all ${pageCount} pages from ${file.name}`);
                    }
                    
                    // Copy selected pages to the merged PDF
                    const copiedPages = await mergedPdf.copyPages(pdf, pageIndices);
                    
                    // Add each page to the merged document
                    copiedPages.forEach(page => {
                        mergedPdf.addPage(page);
                    });
                    
                } catch (error) {
                    throw new Error(`Failed to process ${file.name}: ${error.message}`);
                }
            }
            
            this.updateProgress(95, 'Finalizing merged PDF...');
            
            // Save the merged PDF
            const pdfBytes = await mergedPdf.save();
            
            this.updateProgress(100, 'PDF merge completed!');
            
            return pdfBytes;
            
        } catch (error) {
            throw new Error(`PDF merge failed: ${error.message}`);
        } finally {
            this.isProcessing = false;
        }
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

    async fileToUint8Array(file) {
        const arrayBuffer = await this.fileToArrayBuffer(file);
        return new Uint8Array(arrayBuffer);
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

    // Check if processor is currently working
    getIsProcessing() {
        return this.isProcessing;
    }

    // Cancel processing (if possible)
    cancel() {
        // Note: PDF-lib operations are not easily cancellable
        // This is more of a flag for the UI
        this.isProcessing = false;
    }

    // Validate multiple files at once
    async validateMultiplePDFs(files) {
        const results = [];
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const isValid = await this.validatePDF(file);
            
            results.push({
                file: file,
                isValid: isValid,
                error: isValid ? null : 'Invalid or corrupted PDF file'
            });
        }
        
        return results;
    }

    // Generate a suggested filename for the merged PDF
    generateMergedFilename(files) {
        if (files.length === 0) {
            return 'merged.pdf';
        }
        
        if (files.length === 1) {
            return files[0].name;
        }
        
        // Use the first file's name as base
        const firstName = files[0].name;
        const baseName = firstName.replace(/\.pdf$/i, '');
        
        return `${baseName}_merged_${files.length}_files.pdf`;
    }

    // Get memory usage estimate
    estimateMemoryUsage(files) {
        const totalSize = files.reduce((sum, file) => sum + file.size, 0);
        // PDF processing typically requires 2-3x the file size in memory
        return totalSize * 2.5;
    }

    // Check if files are too large for processing
    checkMemoryLimits(files) {
        const estimatedMemory = this.estimateMemoryUsage(files);
        const maxRecommended = 100 * 1024 * 1024; // 100MB
        
        return {
            estimatedMemory: estimatedMemory,
            isWithinLimits: estimatedMemory <= maxRecommended,
            warning: estimatedMemory > maxRecommended ? 
                'Large files may cause performance issues or browser crashes' : null
        };
    }
}