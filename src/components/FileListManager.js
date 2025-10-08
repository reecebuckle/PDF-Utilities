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
        this.showAdvancedSelection = false;
        
        this.setupAdvancedToggle();
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
                    // Generate more thumbnails for better horizontal scrolling experience
                    const thumbnailCount = Math.min(15, Math.max(5, Math.ceil(file.size / (1024 * 1024)))); // 5-15 based on file size
                    const thumbnails = await this.pdfPreview.generateThumbnails(file, thumbnailCount);
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

    setupPageSelectionListeners(previewDiv, fileId, totalPages) {
        const radioButtons = previewDiv.querySelectorAll(`input[name="pages-${fileId}"]`);
        const rangeInput = previewDiv.querySelector('.page-range-input');
        const checkboxes = previewDiv.querySelectorAll('.page-checkbox');
        
        // Handle radio button changes
        radioButtons.forEach(radio => {
            radio.addEventListener('change', () => {
                if (radio.value === 'all') {
                    rangeInput.disabled = true;
                    rangeInput.value = '';
                    // Check all checkboxes
                    checkboxes.forEach(cb => cb.checked = true);
                } else if (radio.value === 'range') {
                    rangeInput.disabled = false;
                    rangeInput.focus();
                }
            });
        });
        
        // Handle range input changes
        rangeInput.addEventListener('input', () => {
            this.updateCheckboxesFromRange(rangeInput.value, checkboxes, totalPages);
        });
        
        // Handle individual checkbox changes
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.updateRangeFromCheckboxes(checkboxes, rangeInput);
            });
        });
    }

    updateCheckboxesFromRange(rangeText, checkboxes, totalPages) {
        // Parse range text and update checkboxes
        try {
            const selectedPages = this.parsePageRanges(rangeText, totalPages);
            checkboxes.forEach(checkbox => {
                const pageNum = parseInt(checkbox.dataset.pageNumber);
                checkbox.checked = selectedPages.includes(pageNum);
            });
        } catch (error) {
            // Invalid range, don't update checkboxes
        }
    }

    updateRangeFromCheckboxes(checkboxes, rangeInput) {
        const selectedPages = [];
        checkboxes.forEach(checkbox => {
            if (checkbox.checked) {
                selectedPages.push(parseInt(checkbox.dataset.pageNumber));
            }
        });
        
        // Convert selected pages to range text
        rangeInput.value = this.pagesToRangeText(selectedPages);
    }

    parsePageRanges(rangeText, totalPages) {
        const pages = [];
        const parts = rangeText.split(',').map(part => part.trim());
        
        for (const part of parts) {
            if (part === '') continue;
            
            if (part.includes('-')) {
                const [start, end] = part.split('-').map(s => parseInt(s.trim()));
                if (!isNaN(start) && !isNaN(end) && start >= 1 && end <= totalPages && start <= end) {
                    for (let i = start; i <= end; i++) {
                        if (!pages.includes(i)) pages.push(i);
                    }
                }
            } else {
                const pageNum = parseInt(part);
                if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
                    if (!pages.includes(pageNum)) pages.push(pageNum);
                }
            }
        }
        
        return pages.sort((a, b) => a - b);
    }

    pagesToRangeText(pages) {
        if (pages.length === 0) return '';
        
        pages.sort((a, b) => a - b);
        const ranges = [];
        let start = pages[0];
        let end = pages[0];
        
        for (let i = 1; i < pages.length; i++) {
            if (pages[i] === end + 1) {
                end = pages[i];
            } else {
                if (start === end) {
                    ranges.push(start.toString());
                } else {
                    ranges.push(`${start}-${end}`);
                }
                start = end = pages[i];
            }
        }
        
        if (start === end) {
            ranges.push(start.toString());
        } else {
            ranges.push(`${start}-${end}`);
        }
        
        return ranges.join(', ');
    }

    // Get selected pages for each file
    getSelectedPages() {
        // If advanced mode is not enabled, return null (merge all pages)
        if (!this.showAdvancedSelection) {
            console.log('Advanced selection disabled, merging all pages');
            return null;
        }
        
        const selectedPages = new Map();
        
        this.files.forEach(fileItem => {
            const fileId = fileItem.id;
            
            // Get all checkboxes for this file
            const checkboxes = document.querySelectorAll(`.page-checkbox[data-file-id="${fileId}"]`);
            
            if (checkboxes.length === 0) {
                console.log(`No checkboxes found for ${fileItem.file.name} - this shouldn't happen in advanced mode`);
                return;
            }
            
            // Get selected pages from checkboxes
            const pages = [];
            checkboxes.forEach(checkbox => {
                if (checkbox.checked) {
                    pages.push(parseInt(checkbox.dataset.pageNumber));
                }
            });
            
            // Get total pages for this document
            const thumbnails = this.thumbnailsData.get(fileItem.file);
            const totalPages = thumbnails ? thumbnails.totalPages : 0;
            
            console.log(`${fileItem.file.name}: ${pages.length} of ${totalPages} pages selected (${pages.join(', ')})`);
            
            // Always add to selectedPages map in advanced mode
            if (pages.length > 0) {
                selectedPages.set(fileItem.file, pages.sort((a, b) => a - b));
            } else {
                // If no pages selected, this is an error state - select none
                console.warn(`No pages selected for ${fileItem.file.name} - will skip this document`);
                selectedPages.set(fileItem.file, []);
            }
        });
        
        console.log(`Advanced mode: returning selectedPages map with ${selectedPages.size} files`);
        
        // In advanced mode, always return the selectedPages map (even if empty)
        return selectedPages;
    }

    setupAdvancedToggle() {
        // Set up the advanced toggle button
        setTimeout(() => {
            const toggleBtn = document.getElementById('advanced-toggle-btn');
            if (toggleBtn) {
                toggleBtn.addEventListener('click', () => {
                    this.showAdvancedSelection = !this.showAdvancedSelection;
                    toggleBtn.classList.toggle('active', this.showAdvancedSelection);
                    
                    if (this.showAdvancedSelection) {
                        toggleBtn.textContent = '📄 Simple: Merge All Pages';
                    } else {
                        toggleBtn.textContent = '📄 Advanced: Select Specific Pages';
                    }
                    
                    this.render();
                });
            }
        }, 100);
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
            
            // Add page selection controls (only if advanced mode is enabled)
            let pageSelectionDiv = null;
            if (this.showAdvancedSelection) {
                pageSelectionDiv = document.createElement('div');
                pageSelectionDiv.className = 'page-selection-controls';
                pageSelectionDiv.innerHTML = `
                    <div class="page-selection-header">
                        <label class="page-selection-label">
                            <input type="radio" name="pages-${fileItem.id}" value="all" checked>
                            All pages (1-${thumbnails.totalPages})
                        </label>
                        <label class="page-selection-label">
                            <input type="radio" name="pages-${fileItem.id}" value="range">
                            Page range:
                        </label>
                        <input type="text" class="page-range-input" placeholder="e.g., 1-5, 8, 10-12" 
                               data-file-id="${fileItem.id}" disabled>
                    </div>
                `;
            }
            
            const thumbnailGrid = document.createElement('div');
            thumbnailGrid.className = 'thumbnail-grid';
            
            thumbnails.thumbnails.forEach(thumbnail => {
                const thumbnailItem = document.createElement('div');
                thumbnailItem.className = this.showAdvancedSelection ? 'thumbnail-item selectable' : 'thumbnail-item';
                thumbnailItem.dataset.pageNumber = thumbnail.pageNumber;
                thumbnailItem.dataset.fileId = fileItem.id;
                
                const img = document.createElement('img');
                img.src = thumbnail.dataUrl;
                img.alt = `Page ${thumbnail.pageNumber}`;
                img.className = 'thumbnail-image';
                
                const pageLabel = document.createElement('div');
                pageLabel.className = 'page-label';
                pageLabel.textContent = thumbnail.pageNumber;
                
                // Add selection checkbox only in advanced mode
                if (this.showAdvancedSelection) {
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.className = 'page-checkbox';
                    checkbox.checked = true; // All pages selected by default
                    checkbox.dataset.pageNumber = thumbnail.pageNumber;
                    checkbox.dataset.fileId = fileItem.id;
                    thumbnailItem.appendChild(checkbox);
                }
                
                thumbnailItem.appendChild(img);
                thumbnailItem.appendChild(pageLabel);
                thumbnailGrid.appendChild(thumbnailItem);
            });
            
            if (thumbnails.hasMore) {
                const moreIndicator = document.createElement('div');
                moreIndicator.className = 'more-pages-indicator';
                moreIndicator.textContent = `+${thumbnails.totalPages - thumbnails.thumbnails.length} more`;
                moreIndicator.title = `Total pages: ${thumbnails.totalPages}`;
                thumbnailGrid.appendChild(moreIndicator);
            }
            
            // Add scroll hint if there are many thumbnails
            if (thumbnails.thumbnails.length > 3) {
                thumbnailGrid.title = 'Scroll horizontally to see more pages';
            }
            
            if (pageSelectionDiv) {
                previewDiv.appendChild(pageSelectionDiv);
            }
            previewDiv.appendChild(thumbnailGrid);
            div.appendChild(previewDiv);
            
            // Set up page selection event listeners (only in advanced mode)
            if (this.showAdvancedSelection) {
                this.setupPageSelectionListeners(previewDiv, fileItem.id, thumbnails.totalPages);
            }
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