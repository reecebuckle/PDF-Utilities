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
                const page = await pdf.getPage(pageNum);
                const thumbnail = await this.renderPageThumbnail(page, pageNum);
                thumbnails.push(thumbnail);
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
        // For now, we'll create a simple fallback that shows page count
        // TODO: Integrate PDF.js for actual thumbnail rendering
        
        // Use PDF-lib to get page count
        const pdf = await loadPDFFromBytes(uint8Array);
        const pageCount = pdf.getPageCount();
        
        return {
            numPages: pageCount,
            getPage: async (pageNum) => {
                return {
                    pageNumber: pageNum,
                    // Mock page object - in real implementation this would be PDF.js page
                    getViewport: () => ({ width: 200, height: 280 })
                };
            }
        };
    }

    async renderPageThumbnail(page, pageNum) {
        // For now, create a placeholder thumbnail
        // TODO: Use PDF.js to render actual page content
        
        const viewport = page.getViewport();
        const thumbnailWidth = 120;
        const thumbnailHeight = Math.round((thumbnailWidth / viewport.width) * viewport.height);
        
        // Create placeholder canvas
        const canvas = document.createElement('canvas');
        canvas.width = thumbnailWidth;
        canvas.height = thumbnailHeight;
        const ctx = canvas.getContext('2d');
        
        // Draw placeholder
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, thumbnailWidth, thumbnailHeight);
        
        // Draw border
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, thumbnailWidth, thumbnailHeight);
        
        // Draw page number
        ctx.fillStyle = '#64748b';
        ctx.font = '14px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`Page ${pageNum}`, thumbnailWidth / 2, thumbnailHeight / 2);
        
        // Draw PDF icon
        ctx.fillStyle = '#ef4444';
        ctx.font = '12px Inter, sans-serif';
        ctx.fillText('PDF', thumbnailWidth / 2, thumbnailHeight / 2 + 20);
        
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