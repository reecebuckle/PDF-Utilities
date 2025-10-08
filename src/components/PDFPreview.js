/**
 * PDFPreview - Handles PDF page preview and thumbnail generation
 */
import { loadPDFFromBytes } from '../utils/pdfLibLoader.js';

export class PDFPreview {
    constructor() {
        this.thumbnailCache = new Map();
    }

    async generateThumbnails(file, maxPages = 10) {
        try {
            const cacheKey = `${file.name}_${file.size}_${file.lastModified}`;

            if (this.thumbnailCache.has(cacheKey)) {
                return this.thumbnailCache.get(cacheKey);
            }

            console.log(`Generating thumbnails for ${file.name}...`);

            // Get page count using PDF-lib (reliable)
            const arrayBuffer = await this.fileToArrayBuffer(file);
            const uint8Array = new Uint8Array(arrayBuffer);
            
            let pageCount = 0;
            try {
                const pdf = await loadPDFFromBytes(uint8Array);
                pageCount = pdf.getPageCount();
                console.log(`PDF has ${pageCount} pages`);
            } catch (error) {
                console.error('Failed to get page count:', error);
                throw new Error('Invalid PDF file');
            }
            
            const thumbnails = [];
            const pagesToRender = Math.min(pageCount, maxPages);
            
            // For now, create enhanced placeholders for all pages
            // TODO: Add real PDF.js rendering later
            for (let pageNum = 1; pageNum <= pagesToRender; pageNum++) {
                const thumbnail = this.createEnhancedPlaceholder(pageNum, file.name);
                thumbnails.push(thumbnail);
            }
            
            const result = {
                thumbnails,
                totalPages: pageCount,
                hasMore: pageCount > maxPages
            };
            
            this.thumbnailCache.set(cacheKey, result);
            console.log(`Generated ${thumbnails.length} thumbnails for ${file.name}`);
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

    createEnhancedPlaceholder(pageNum, fileName = 'Document') {
        const thumbnailWidth = 120;
        const thumbnailHeight = 160;
        
        const canvas = document.createElement('canvas');
        canvas.width = thumbnailWidth;
        canvas.height = thumbnailHeight;
        const ctx = canvas.getContext('2d');
        
        // Draw white background (like a real PDF page)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, thumbnailWidth, thumbnailHeight);
        
        // Draw border
        ctx.strokeStyle = '#d1d5db';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, thumbnailWidth, thumbnailHeight);
        
        // Draw header area
        ctx.fillStyle = '#f3f4f6';
        ctx.fillRect(8, 8, thumbnailWidth - 16, 20);
        
        // Draw document title
        ctx.fillStyle = '#374151';
        ctx.font = 'bold 8px Arial, sans-serif';
        ctx.textAlign = 'left';
        const shortName = fileName.length > 15 ? fileName.substring(0, 12) + '...' : fileName;
        ctx.fillText(shortName, 10, 20);
        
        // Draw simulated text lines
        ctx.fillStyle = '#e5e7eb';
        const lineHeight = 8;
        const startY = 35;
        const leftMargin = 12;
        const rightMargin = thumbnailWidth - 12;
        
        for (let i = 0; i < 12; i++) {
            const y = startY + (i * lineHeight);
            if (y > thumbnailHeight - 25) break;
            
            // Vary line lengths to simulate text
            const lineLength = Math.random() * 0.4 + 0.4; // 40-80% width
            const endX = leftMargin + (rightMargin - leftMargin) * lineLength;
            
            ctx.fillRect(leftMargin, y, endX - leftMargin, 3);
        }
        
        // Draw page number in bottom right
        ctx.fillStyle = '#6b7280';
        ctx.font = '10px Arial, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`${pageNum}`, thumbnailWidth - 8, thumbnailHeight - 8);
        
        // Draw PDF icon in bottom left
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 8px Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('PDF', 8, thumbnailHeight - 8);
        
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
            if (thumbnails && thumbnails.thumbnails.length > 0) {
                // Create a compact document preview similar to split tool
                const docPreview = this.createCompactDocumentPreview(file, thumbnails, index + 1);
                documentsContainer.appendChild(docPreview);
            }
        });
        
        previewContainer.appendChild(header);
        previewContainer.appendChild(documentsContainer);
        
        return previewContainer;
    }

    createCompactDocumentPreview(file, thumbnails, orderNumber) {
        const docPreview = document.createElement('div');
        docPreview.className = 'merge-document-preview compact';
        
        const header = document.createElement('div');
        header.className = 'document-header';
        header.innerHTML = `
            <div class="document-order">${orderNumber}</div>
            <div class="document-info">
                <div class="document-name">${file.name}</div>
                <div class="document-pages">${thumbnails.totalPages} pages</div>
            </div>
        `;
        
        const thumbnailGrid = document.createElement('div');
        thumbnailGrid.className = 'thumbnail-grid compact-merge';
        
        // Show first few thumbnails
        const maxThumbnails = Math.min(6, thumbnails.thumbnails.length);
        for (let i = 0; i < maxThumbnails; i++) {
            const thumbnail = thumbnails.thumbnails[i];
            const thumbnailItem = document.createElement('div');
            thumbnailItem.className = 'thumbnail-item small';
            
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
        }
        
        if (thumbnails.totalPages > maxThumbnails) {
            const moreIndicator = document.createElement('div');
            moreIndicator.className = 'more-pages-indicator small';
            moreIndicator.textContent = `+${thumbnails.totalPages - maxThumbnails}`;
            thumbnailGrid.appendChild(moreIndicator);
        }
        
        docPreview.appendChild(header);
        docPreview.appendChild(thumbnailGrid);
        
        return docPreview;
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