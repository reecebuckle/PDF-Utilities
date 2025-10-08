/**
 * PDFPreview - Handles PDF page preview and thumbnail generation
 */
import { loadPDFFromBytes } from '../utils/pdfLibLoader.js';

export class PDFPreview {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.context = this.canvas.getContext('2d');
        this.thumbnailCache = new Map();
    }

    async generateThumbnails(file, maxPages = 10) {
        try {
            const cacheKey = `${file.name}_${file.size}_${file.lastModified}`;
            
            if (this.thumbnailCache.has(cacheKey)) {
                return this.thumbnailCache.get(cacheKey);
            }

            // Load PDF
            const arrayBuffer = await this.fileToArrayBuffer(file);
            const uint8Array = new Uint8Array(arrayBuffer);
            
            // Use PDF.js for rendering (we'll need to add this library)
            const pdf = await this.loadPDFWithPDFJS(uint8Array);
            const pageCount = pdf.numPages;
            
            const thumbnails = [];
            const pagesToRender = Math.min(pageCount, maxPages);
            
            for (let pageNum = 1; pageNum <= pagesToRender; pageNum++) {
                try {
                    const page = await pdf.getPage(pageNum);
                    const thumbnail = await this.renderPageThumbnail(page, pageNum);
                    thumbnails.push(thumbnail);
                } catch (error) {
                    console.warn(`Failed to generate thumbnail for page ${pageNum}:`, error);
                    // Add placeholder thumbnail for failed pages
                    const placeholder = this.createPlaceholderThumbnail(pageNum);
                    thumbnails.push(placeholder);
                }
            }
            
            const result = {
                thumbnails,
                totalPages: pageCount,
                hasMore: pageCount > maxPages
            };
            
            this.thumbnailCache.set(cacheKey, result);
            return result;
            
        } catch (error) {
            console.warn('Failed to generate thumbnails:', error);
            return {
                thumbnails: [],
                totalPages: 0,
                hasMore: false,
                error: error.message
            };
        }
    }

    async loadPDFWithPDFJS(uint8Array) {
        try {
            console.log('Attempting to load PDF.js...');
            
            // Dynamically import PDF.js
            const pdfjsLib = await import('pdfjs-dist');
            console.log('PDF.js loaded successfully');
            
            // Set worker source - try multiple options
            if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
                try {
                    // Try to use the bundled worker first
                    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.js', import.meta.url).href;
                } catch (e) {
                    // Fallback to CDN
                    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.js`;
                }
            }
            
            // Load PDF with PDF.js
            console.log('Loading PDF document...');
            const loadingTask = pdfjsLib.getDocument({ 
                data: uint8Array,
                verbosity: 0 // Reduce PDF.js console output
            });
            
            const pdf = await loadingTask.promise;
            console.log(`PDF loaded successfully with ${pdf.numPages} pages`);
            
            return pdf;
            
        } catch (error) {
            console.warn('PDF.js failed, using fallback:', error);
            
            // Enhanced fallback: Use PDF-lib to get page count and create better mock
            try {
                const pdf = await loadPDFFromBytes(uint8Array);
                const pageCount = pdf.getPageCount();
                console.log(`Fallback: PDF has ${pageCount} pages`);
                
                return {
                    numPages: pageCount,
                    getPage: async (pageNum) => {
                        return {
                            pageNumber: pageNum,
                            getViewport: (options = {}) => ({ 
                                width: options.scale ? 200 * options.scale : 200, 
                                height: options.scale ? 280 * options.scale : 280 
                            }),
                            render: () => {
                                console.log(`Mock rendering page ${pageNum}`);
                                return { promise: Promise.resolve() };
                            }
                        };
                    }
                };
            } catch (fallbackError) {
                console.error('Both PDF.js and PDF-lib failed:', fallbackError);
                throw new Error('Unable to load PDF with any available library');
            }
        }
    }

    async renderPageThumbnail(page, pageNum) {
        try {
            console.log(`Rendering thumbnail for page ${pageNum}`);
            
            // Check if this is a real PDF.js page or our fallback
            if (page.render && typeof page.render === 'function') {
                // Real PDF.js page
                const scale = 0.5; // Scale down for thumbnail
                const viewport = page.getViewport({ scale });
                
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                
                // Render the page
                const renderContext = {
                    canvasContext: context,
                    viewport: viewport
                };
                
                const renderTask = page.render(renderContext);
                await renderTask.promise;
                
                console.log(`Successfully rendered page ${pageNum}`);
                
                return {
                    pageNumber: pageNum,
                    canvas: canvas,
                    dataUrl: canvas.toDataURL('image/png'),
                    width: canvas.width,
                    height: canvas.height
                };
            } else {
                // Fallback page - create enhanced placeholder
                console.log(`Using enhanced placeholder for page ${pageNum}`);
                return this.createEnhancedPlaceholder(pageNum);
            }
            
        } catch (error) {
            console.warn(`Failed to render page ${pageNum}, using placeholder:`, error);
            
            // Fallback to placeholder
            return this.createPlaceholderThumbnail(pageNum);
        }
    }

    createPlaceholderThumbnail(pageNum) {
        return this.createEnhancedPlaceholder(pageNum, '#ef4444', 'Error');
    }

    createEnhancedPlaceholder(pageNum, iconColor = '#3b82f6', iconText = 'PDF') {
        const thumbnailWidth = 120;
        const thumbnailHeight = 160;
        
        const canvas = document.createElement('canvas');
        canvas.width = thumbnailWidth;
        canvas.height = thumbnailHeight;
        const ctx = canvas.getContext('2d');
        
        // Draw white background (like a real PDF page)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, thumbnailWidth, thumbnailHeight);
        
        // Draw subtle shadow/border
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, thumbnailWidth - 2, thumbnailHeight - 2);
        
        // Draw document lines (simulate text)
        ctx.strokeStyle = '#f1f5f9';
        ctx.lineWidth = 1;
        const lineSpacing = 12;
        const startY = 25;
        const endX = thumbnailWidth - 20;
        
        for (let i = 0; i < 8; i++) {
            const y = startY + (i * lineSpacing);
            const lineWidth = Math.random() * 40 + 40; // Random line lengths
            ctx.beginPath();
            ctx.moveTo(15, y);
            ctx.lineTo(Math.min(15 + lineWidth, endX), y);
            ctx.stroke();
        }
        
        // Draw PDF icon in corner
        ctx.fillStyle = iconColor;
        ctx.font = 'bold 10px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(iconText, 8, thumbnailHeight - 8);
        
        // Draw page number
        ctx.fillStyle = '#64748b';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`${pageNum}`, thumbnailWidth - 8, thumbnailHeight - 8);
        
        return {
            pageNumber: pageNum,
            canvas: canvas,
            dataUrl: canvas.toDataURL('image/png'),
            width: thumbnailWidth,
            height: thumbnailHeight
        };
    }

    createPreviewContainer(file, thumbnails, options = {}) {
        const container = document.createElement('div');
        container.className = 'pdf-preview-container';
        
        const header = document.createElement('div');
        header.className = 'preview-header';
        header.innerHTML = `
            <h4>${file.name}</h4>
            <span class="page-count">${thumbnails.totalPages} pages</span>
        `;
        
        const thumbnailGrid = document.createElement('div');
        thumbnailGrid.className = 'thumbnail-grid';
        
        thumbnails.thumbnails.forEach(thumbnail => {
            const thumbnailItem = document.createElement('div');
            thumbnailItem.className = 'thumbnail-item';
            thumbnailItem.dataset.pageNumber = thumbnail.pageNumber;
            
            const img = document.createElement('img');
            img.src = thumbnail.dataUrl;
            img.alt = `Page ${thumbnail.pageNumber}`;
            img.className = 'thumbnail-image';
            
            const pageLabel = document.createElement('div');
            pageLabel.className = 'page-label';
            pageLabel.textContent = thumbnail.pageNumber;
            
            thumbnailItem.appendChild(img);
            thumbnailItem.appendChild(pageLabel);
            thumbnailGrid.appendChild(thumbnailItem);
        });
        
        if (thumbnails.hasMore) {
            const moreIndicator = document.createElement('div');
            moreIndicator.className = 'more-pages-indicator';
            moreIndicator.textContent = `+${thumbnails.totalPages - thumbnails.thumbnails.length} more pages`;
            thumbnailGrid.appendChild(moreIndicator);
        }
        
        container.appendChild(header);
        container.appendChild(thumbnailGrid);
        
        return container;
    }

    createMergePreview(files, thumbnailsData) {
        const previewContainer = document.createElement('div');
        previewContainer.className = 'merge-preview-container';
        
        const header = document.createElement('div');
        header.className = 'merge-preview-header';
        header.innerHTML = `
            <h3>Merge Preview</h3>
            <p>Documents will be combined in this order:</p>
        `;
        
        const documentsContainer = document.createElement('div');
        documentsContainer.className = 'merge-documents-container';
        
        files.forEach((file, index) => {
            const thumbnails = thumbnailsData.get(file);
            if (thumbnails) {
                const docPreview = this.createPreviewContainer(file, thumbnails);
                docPreview.classList.add('merge-document-preview');
                
                // Add order indicator
                const orderIndicator = document.createElement('div');
                orderIndicator.className = 'merge-order-indicator';
                orderIndicator.textContent = index + 1;
                docPreview.appendChild(orderIndicator);
                
                documentsContainer.appendChild(docPreview);
            }
        });
        
        previewContainer.appendChild(header);
        previewContainer.appendChild(documentsContainer);
        
        return previewContainer;
    }

    createSplitPreview(file, thumbnails, ranges) {
        const previewContainer = document.createElement('div');
        previewContainer.className = 'split-preview-container';
        
        const header = document.createElement('div');
        header.className = 'split-preview-header';
        header.innerHTML = `
            <h3>Split Preview</h3>
            <p>Selected pages will be extracted:</p>
        `;
        
        const rangesContainer = document.createElement('div');
        rangesContainer.className = 'split-ranges-container';
        
        ranges.forEach((range, index) => {
            const rangePreview = document.createElement('div');
            rangePreview.className = 'split-range-preview';
            
            const rangeHeader = document.createElement('div');
            rangeHeader.className = 'range-header';
            rangeHeader.innerHTML = `
                <span class="range-label">Split ${index + 1}</span>
                <span class="range-pages">Pages ${range.start}-${range.end}</span>
            `;
            
            const rangeThumbnails = document.createElement('div');
            rangeThumbnails.className = 'range-thumbnails';
            
            // Show thumbnails for this range
            for (let pageNum = range.start; pageNum <= Math.min(range.end, range.start + 3); pageNum++) {
                const thumbnail = thumbnails.thumbnails.find(t => t.pageNumber === pageNum);
                if (thumbnail) {
                    const thumbnailItem = document.createElement('div');
                    thumbnailItem.className = 'thumbnail-item small';
                    
                    const img = document.createElement('img');
                    img.src = thumbnail.dataUrl;
                    img.alt = `Page ${pageNum}`;
                    img.className = 'thumbnail-image';
                    
                    thumbnailItem.appendChild(img);
                    rangeThumbnails.appendChild(thumbnailItem);
                }
            }
            
            if (range.end - range.start > 3) {
                const moreIndicator = document.createElement('div');
                moreIndicator.className = 'more-pages-indicator small';
                moreIndicator.textContent = `+${range.end - range.start - 3} more`;
                rangeThumbnails.appendChild(moreIndicator);
            }
            
            rangePreview.appendChild(rangeHeader);
            rangePreview.appendChild(rangeThumbnails);
            rangesContainer.appendChild(rangePreview);
        });
        
        previewContainer.appendChild(header);
        previewContainer.appendChild(rangesContainer);
        
        return previewContainer;
    }

    async fileToArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
            reader.readAsArrayBuffer(file);
        });
    }

    clearCache() {
        this.thumbnailCache.clear();
    }

    getCacheSize() {
        return this.thumbnailCache.size;
    }
}