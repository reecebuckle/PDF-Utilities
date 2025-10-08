/**
 * FileListManager - Manages the display and reordering of selected files
 */
import { PDFPreview } from './PDFPreview.js';

export class FileListManager {
    constructor(container, onOrderChange) {
        this.container = container;
        this.onOrderChange = onOrderChange;
        this.files = [];
        this.draggedElement = null;
        this.draggedIndex = null;
        this.pdfPreview = new PDFPreview();
        this.thumbnailsData = new Map();
        this.showPreviews = true;
    }

    async addFiles(newFiles) {
        // Add new files to the list
        for (const file of newFiles) {
            const fileItem = {
                id: this.generateId(),
                file: file,
                name: file.name,
                size: file.size,
                isValid: true,
                order: this.files.length
            };
            this.files.push(fileItem);
            
            // Generate thumbnails for preview
            if (this.showPreviews) {
                try {
                    console.log(`Generating thumbnails for ${file.name}...`);
                    const thumbnails = await this.pdfPreview.generateThumbnails(file, 5);
                    console.log(`Generated ${thumbnails.thumbnails.length} thumbnails for ${file.name}`);
                    this.thumbnailsData.set(file, thumbnails);
                } catch (error) {
                    console.warn('Failed to generate thumbnails for', file.name, error);
                    // Set empty thumbnails data so we don't keep trying
                    this.thumbnailsData.set(file, { thumbnails: [], totalPages: 0, hasMore: false });
                }
            }
        }

        this.render();
        this.notifyOrderChange();
    }

    removeFile(fileId) {
        const index = this.files.findIndex(f => f.id === fileId);
        if (index !== -1) {
            this.files.splice(index, 1);
            this.updateOrder();
            this.render();
            this.notifyOrderChange();
        }
    }

    reorderFiles(oldIndex, newIndex) {
        if (oldIndex === newIndex) return;

        const [movedFile] = this.files.splice(oldIndex, 1);
        this.files.splice(newIndex, 0, movedFile);
        
        this.updateOrder();
        this.render();
        this.notifyOrderChange();
    }

    getOrderedFiles() {
        return this.files.map(item => item.file);
    }

    clear() {
        this.files = [];
        this.thumbnailsData.clear();
        this.render();
        this.notifyOrderChange();
    }

    // Get thumbnails data for merge preview
    getThumbnailsData() {
        return this.thumbnailsData;
    }

    // Toggle preview display
    setShowPreviews(show) {
        this.showPreviews = show;
        this.render();
    }

    updateOrder() {
        this.files.forEach((file, index) => {
            file.order = index;
        });
    }

    render() {
        this.container.innerHTML = '';

        if (this.files.length === 0) {
            return;
        }

        this.files.forEach((fileItem, index) => {
            const element = this.createFileElement(fileItem, index);
            this.container.appendChild(element);
        });
    }

    createFileElement(fileItem, index) {
        const div = document.createElement('div');
        div.className = 'file-item';
        div.draggable = true;
        div.dataset.fileId = fileItem.id;
        div.dataset.index = index;

        const thumbnails = this.thumbnailsData.get(fileItem.file);
        const pageCount = thumbnails ? thumbnails.totalPages : 0;

        div.innerHTML = `
            <div class="drag-handle" title="Drag to reorder">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="3" y1="6" x2="21" y2="6"></line>
                    <line x1="3" y1="12" x2="21" y2="12"></line>
                    <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
            </div>
            <div class="file-order">${index + 1}</div>
            <div class="file-info">
                <div class="file-name" title="${fileItem.name}">${this.truncateFileName(fileItem.name)}</div>
                <div class="file-size">${this.formatFileSize(fileItem.size)}${pageCount > 0 ? ` • ${pageCount} pages` : ''}</div>
            </div>
            <button type="button" class="remove-btn" title="Remove file" data-file-id="${fileItem.id}">
                Remove
            </button>
        `;

        // Add preview if available
        if (this.showPreviews && thumbnails && thumbnails.thumbnails.length > 0) {
            const previewDiv = document.createElement('div');
            previewDiv.className = 'file-item-preview';
            
            const thumbnailGrid = document.createElement('div');
            thumbnailGrid.className = 'thumbnail-grid';
            
            thumbnails.thumbnails.forEach(thumbnail => {
                const thumbnailItem = document.createElement('div');
                thumbnailItem.className = 'thumbnail-item';
                
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
                moreIndicator.textContent = `+${thumbnails.totalPages - thumbnails.thumbnails.length}`;
                thumbnailGrid.appendChild(moreIndicator);
            }
            
            previewDiv.appendChild(thumbnailGrid);
            div.appendChild(previewDiv);
        }

        this.setupDragAndDrop(div);
        this.setupRemoveButton(div);

        return div;
    }

    setupDragAndDrop(element) {
        element.addEventListener('dragstart', (e) => {
            this.draggedElement = element;
            this.draggedIndex = parseInt(element.dataset.index);
            element.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', element.outerHTML);
        });

        element.addEventListener('dragend', (e) => {
            element.classList.remove('dragging');
            this.draggedElement = null;
            this.draggedIndex = null;
        });

        element.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            if (this.draggedElement && this.draggedElement !== element) {
                const rect = element.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                
                if (e.clientY < midY) {
                    element.style.borderTop = '2px solid #3b82f6';
                    element.style.borderBottom = '';
                } else {
                    element.style.borderBottom = '2px solid #3b82f6';
                    element.style.borderTop = '';
                }
            }
        });

        element.addEventListener('dragleave', (e) => {
            element.style.borderTop = '';
            element.style.borderBottom = '';
        });

        element.addEventListener('drop', (e) => {
            e.preventDefault();
            element.style.borderTop = '';
            element.style.borderBottom = '';
            
            if (this.draggedElement && this.draggedElement !== element) {
                const targetIndex = parseInt(element.dataset.index);
                const rect = element.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                
                let newIndex = targetIndex;
                if (e.clientY > midY) {
                    newIndex = targetIndex + 1;
                }
                
                // Adjust for the fact that we're removing the dragged element first
                if (this.draggedIndex < newIndex) {
                    newIndex--;
                }
                
                this.reorderFiles(this.draggedIndex, newIndex);
            }
        });
    }

    setupRemoveButton(element) {
        const removeBtn = element.querySelector('.remove-btn');
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const fileId = e.target.dataset.fileId;
            this.removeFile(fileId);
        });
    }

    truncateFileName(fileName, maxLength = 30) {
        if (fileName.length <= maxLength) {
            return fileName;
        }
        
        const extension = fileName.split('.').pop();
        const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
        const truncatedName = nameWithoutExt.substring(0, maxLength - extension.length - 4) + '...';
        
        return truncatedName + '.' + extension;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    notifyOrderChange() {
        if (this.onOrderChange) {
            this.onOrderChange(this.getOrderedFiles());
        }
    }

    // Get file count
    getFileCount() {
        return this.files.length;
    }

    // Check if list is empty
    isEmpty() {
        return this.files.length === 0;
    }
}