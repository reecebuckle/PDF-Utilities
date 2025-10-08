/**
 * SplitTool - Handles PDF splitting tool UI and logic
 */
import { FileUploadHandler } from './FileUploadHandler.js';
import { PDFSplitter } from './PDFSplitter.js';
import { PDFPreview } from './PDFPreview.js';

export class SplitTool {
    constructor(uiController, errorHandler) {
        this.uiController = uiController;
        this.errorHandler = errorHandler;
        this.currentFile = null;
        this.pageCount = 0;
        this.currentThumbnails = null;
        this.splitDividers = new Set();
        
        this.pdfSplitter = new PDFSplitter((progress) => {
            this.handleProgress(progress);
        });
        
        this.pdfPreview = new PDFPreview();

        this.initializeComponents();
        this.setupEventListeners();
    }

    initializeComponents() {
        // Initialize file upload handler for split tool
        const splitDropZone = document.getElementById('split-drop-zone');
        const splitFileInput = document.getElementById('split-file-input');
        
        if (splitDropZone && splitFileInput) {
            this.fileUploadHandler = new FileUploadHandler(
                splitDropZone,
                splitFileInput,
                (files) => this.handleFileSelected(files)
            );
        }
    }

    setupEventListeners() {
        // Split method radio buttons
        const splitRanges = document.getElementById('split-ranges');
        const splitVisual = document.getElementById('split-visual');
        const splitAll = document.getElementById('split-all');
        const rangesInput = document.getElementById('split-ranges-input');
        const visualSelection = document.getElementById('visual-page-selection');
        const pageRangesInput = document.getElementById('page-ranges');

        if (splitRanges && splitVisual && splitAll && rangesInput && visualSelection) {
            splitRanges.addEventListener('change', () => {
                rangesInput.style.display = splitRanges.checked ? 'block' : 'none';
                visualSelection.style.display = 'none';
                this.updateSplitPreview();
            });

            splitVisual.addEventListener('change', async () => {
                rangesInput.style.display = 'none';
                visualSelection.style.display = splitVisual.checked ? 'block' : 'none';
                if (splitVisual.checked) {
                    await this.showCombinedVisualSelection();
                }
                this.updateSplitPreview();
            });

            splitAll.addEventListener('change', () => {
                rangesInput.style.display = 'none';
                visualSelection.style.display = 'none';
                this.updateSplitPreview();
            });
        }

        // Page ranges input
        if (pageRangesInput) {
            pageRangesInput.addEventListener('input', () => {
                this.updateSplitPreview();
            });
        }

        // Visual selection controls (checkboxes)
        const selectAllBtn = document.getElementById('select-all-pages');
        const selectNoneBtn = document.getElementById('select-none-pages');
        
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => this.selectAllPages());
        }
        
        if (selectNoneBtn) {
            selectNoneBtn.addEventListener('click', () => this.selectNoPages());
        }

        // Divider selection controls
        const clearDividersBtn = document.getElementById('clear-dividers');
        const addAllDividersBtn = document.getElementById('add-all-dividers');
        
        if (clearDividersBtn) {
            clearDividersBtn.addEventListener('click', () => this.clearAllDividers());
        }
        
        if (addAllDividersBtn) {
            addAllDividersBtn.addEventListener('click', () => this.addAllDividers());
        }

        // Split button
        const splitBtn = document.getElementById('split-btn');
        if (splitBtn) {
            splitBtn.addEventListener('click', () => this.handleSplitRequest());
        }

        // Clear button
        const splitClearBtn = document.getElementById('split-clear-btn');
        if (splitClearBtn) {
            splitClearBtn.addEventListener('click', () => this.handleClear());
        }

        // Browse button is handled by FileUploadHandler, no need for duplicate listener
    }

    async handleFileSelected(files) {
        if (files.length === 0) return;
        
        if (files.length > 1) {
            this.errorHandler.showUserError('Please select only one PDF file for splitting');
            return;
        }

        const file = files[0];
        
        try {
            // Get page count
            this.pageCount = await this.pdfSplitter.getPageCount(file);
            this.currentFile = file;
            
            // Generate initial thumbnails (more for better preview)
            const thumbnailCount = Math.min(this.pageCount, 20); // Generate up to 20 thumbnails initially
            this.currentThumbnails = await this.pdfPreview.generateThumbnails(file, thumbnailCount);
            
            // Update UI
            this.showSplitOptions(file.name, this.pageCount);
            
            // Show initial preview
            this.updateSplitPreview();
            
        } catch (error) {
            this.errorHandler.handleFileSelectionError(error);
        }
    }

    showSplitOptions(filename, pageCount) {
        // Update file info
        const splitFilename = document.getElementById('split-filename');
        const splitPages = document.getElementById('split-pages');
        
        if (splitFilename) splitFilename.textContent = filename;
        if (splitPages) splitPages.textContent = pageCount;
        
        // Show split options section
        const splitOptionsSection = document.getElementById('split-options-section');
        if (splitOptionsSection) {
            splitOptionsSection.style.display = 'block';
        }

        // Update page ranges placeholder
        const pageRangesInput = document.getElementById('page-ranges');
        if (pageRangesInput) {
            pageRangesInput.placeholder = `e.g., 1-5, 8-10, ${Math.min(15, pageCount)}`;
        }
    }

    async handleSplitRequest() {
        if (!this.currentFile) {
            this.uiController.showNotification('Please select a PDF file first', 'warning');
            return;
        }

        const splitMethod = document.querySelector('input[name="split-method"]:checked').value;
        
        try {
            this.uiController.updateUIState('processing');
            
            let results;
            
            if (splitMethod === 'all') {
                // Split into individual pages
                results = await this.pdfSplitter.splitIntoIndividualPages(this.currentFile);
            } else if (splitMethod === 'visual') {
                // Check if using dividers or checkboxes
                if (this.splitDividers && this.splitDividers.size > 0) {
                    // Split by divider positions - convert ranges to page ranges string
                    const ranges = this.getDividerRanges();
                    const rangeString = ranges.map(r => r.start === r.end ? r.start : `${r.start}-${r.end}`).join(', ');
                    results = await this.pdfSplitter.splitPDF(this.currentFile, rangeString);
                } else {
                    // Split by visually selected pages (checkboxes)
                    const selectedPages = this.getVisuallySelectedPages();
                    if (selectedPages.length === 0) {
                        throw new Error('Please select at least one page to split');
                    }
                    
                    results = await this.pdfSplitter.splitPDFByPageNumbers(this.currentFile, selectedPages);
                }
            } else {
                // Split by ranges
                const pageRanges = document.getElementById('page-ranges').value;
                if (!pageRanges.trim()) {
                    throw new Error('Please enter page ranges');
                }
                results = await this.pdfSplitter.splitPDF(this.currentFile, pageRanges);
            }
            
            // Show results
            this.showSplitResults(results);
            
        } catch (error) {
            this.errorHandler.handleProcessingError(error);
            this.uiController.showError(error.message, true);
        }
    }

    showSplitResults(results) {
        // Update result title
        const resultTitle = document.getElementById('result-title');
        if (resultTitle) {
            resultTitle.textContent = `PDF Split Successfully! (${results.length} files created)`;
        }

        // Create download items
        const resultDownloads = document.getElementById('result-downloads');
        if (resultDownloads) {
            resultDownloads.innerHTML = '';
            
            results.forEach((result, index) => {
                const downloadItem = this.createDownloadItem(result, index);
                resultDownloads.appendChild(downloadItem);
            });

            // Add download all button if multiple files
            if (results.length > 1) {
                const downloadAllBtn = document.createElement('button');
                downloadAllBtn.className = 'btn btn-primary';
                downloadAllBtn.textContent = 'Download All as ZIP';
                downloadAllBtn.style.marginTop = '1rem';
                downloadAllBtn.addEventListener('click', () => this.downloadAllAsZip(results));
                resultDownloads.appendChild(downloadAllBtn);
            }
        }

        this.uiController.sections.result.style.display = 'block';
        this.uiController.showNotification('PDF split successfully!', 'success');
    }

    createDownloadItem(result, index) {
        const item = document.createElement('div');
        item.className = 'download-item';
        
        item.innerHTML = `
            <div class="download-info">
                <div class="download-name">${result.filename}</div>
                <div class="download-size">Pages: ${result.pages} • ${this.formatFileSize(result.size)}</div>
            </div>
            <button class="download-btn-small" data-index="${index}">Download</button>
        `;
        
        const downloadBtn = item.querySelector('.download-btn-small');
        downloadBtn.addEventListener('click', () => {
            this.downloadFile(result);
        });
        
        return item;
    }

    downloadFile(result) {
        const blob = new Blob([result.data], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = result.filename;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    async downloadAllAsZip(results) {
        try {
            // For now, download files individually
            // TODO: Implement ZIP creation when we add a ZIP library
            this.uiController.showNotification('Downloading files individually...', 'info');
            
            results.forEach((result, index) => {
                setTimeout(() => {
                    this.downloadFile(result);
                }, index * 500); // Stagger downloads
            });
            
        } catch (error) {
            this.errorHandler.handleProcessingError(error);
        }
    }

    handleProgress(progress) {
        this.uiController.updateProgress(progress.percentage, progress.message);
    }

    updateSplitPreview() {
        if (!this.currentFile || !this.currentThumbnails) {
            return;
        }

        // Remove existing preview
        const existingPreview = document.getElementById('split-preview');
        if (existingPreview) {
            existingPreview.remove();
        }

        const splitMethod = document.querySelector('input[name="split-method"]:checked')?.value;
        
        if (splitMethod === 'all') {
            // Show preview for all individual pages
            const ranges = [];
            for (let i = 1; i <= this.pageCount; i++) {
                ranges.push({ start: i, end: i });
            }
            this.showSplitPreview(ranges);
        } else if (splitMethod === 'ranges') {
            // Show preview for specified ranges
            const pageRanges = document.getElementById('page-ranges')?.value;
            if (pageRanges && pageRanges.trim()) {
                try {
                    const ranges = this.pdfSplitter.validateAndParseRanges(pageRanges, this.pageCount);
                    this.showSplitPreview(ranges);
                } catch (error) {
                    // Don't show preview for invalid ranges
                }
            }
        } else if (splitMethod === 'visual') {
            // Show preview based on dividers or checkboxes
            if (this.splitDividers && this.splitDividers.size > 0) {
                // Show preview for divider-based splits
                const ranges = this.getDividerRanges();
                this.showSplitPreview(ranges);
            } else {
                // Show preview for checkbox-selected pages
                const selectedPages = this.getVisuallySelectedPages();
                if (selectedPages.length > 0) {
                    const ranges = this.convertPagesToRanges(selectedPages);
                    this.showSplitPreview(ranges);
                }
            }
        }
    }

    showSplitPreview(ranges) {
        if (!ranges || ranges.length === 0) {
            return;
        }

        const splitPreview = this.pdfPreview.createSplitPreview(this.currentThumbnails, ranges);
        splitPreview.id = 'split-preview';
        
        // Insert after split options section
        const splitOptionsSection = document.getElementById('split-options-section');
        if (splitOptionsSection) {
            splitOptionsSection.parentNode.insertBefore(splitPreview, splitOptionsSection.nextSibling);
        }
    }

    handleClear() {
        this.currentFile = null;
        this.pageCount = 0;
        this.currentThumbnails = null;
        this.splitDividers = new Set();
        
        // Remove preview
        const splitPreview = document.getElementById('split-preview');
        if (splitPreview) {
            splitPreview.remove();
        }
        
        // Hide split options
        const splitOptionsSection = document.getElementById('split-options-section');
        if (splitOptionsSection) {
            splitOptionsSection.style.display = 'none';
        }
        
        // Reset form
        const pageRangesInput = document.getElementById('page-ranges');
        if (pageRangesInput) {
            pageRangesInput.value = '';
        }
        
        const splitRanges = document.getElementById('split-ranges');
        if (splitRanges) {
            splitRanges.checked = true;
        }
        
        // Reset file upload handler
        if (this.fileUploadHandler) {
            this.fileUploadHandler.reset();
        }
        
        // Hide shared sections
        this.uiController.reset();
        
        this.uiController.showNotification('Cleared', 'info');
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async showVisualPageSelection() {
        if (!this.currentFile) {
            return;
        }

        const container = document.getElementById('split-page-thumbnails');
        if (!container) return;

        container.innerHTML = '<div class="loading-thumbnails">Generating thumbnails...</div>';

        try {
            // Generate thumbnails for all pages if we don't have them
            if (!this.currentThumbnails || this.currentThumbnails.thumbnails.length < this.pageCount) {
                this.currentThumbnails = await this.pdfPreview.generateThumbnails(this.currentFile, this.pageCount);
            }

            container.innerHTML = '';

            // Create thumbnails for all pages
            for (let pageNum = 1; pageNum <= this.pageCount; pageNum++) {
                const thumbnail = this.currentThumbnails.thumbnails.find(t => t.pageNumber === pageNum) ||
                                this.pdfPreview.createEnhancedPlaceholder(pageNum, this.currentFile.name);
                
                const thumbnailElement = this.createPageThumbnailElement(thumbnail, pageNum);
                container.appendChild(thumbnailElement);
            }
        } catch (error) {
            console.error('Error generating thumbnails:', error);
            container.innerHTML = '<div class="error-message">Failed to generate thumbnails</div>';
        }
    }

    createPageThumbnailElement(thumbnail, pageNum) {
        const element = document.createElement('div');
        element.className = 'page-thumbnail selected';
        element.dataset.pageNumber = pageNum;

        element.innerHTML = `
            <img src="${thumbnail.dataUrl}" alt="Page ${pageNum}" class="page-thumbnail-image">
            <div class="page-thumbnail-label">${pageNum}</div>
            <input type="checkbox" class="page-thumbnail-checkbox" checked data-page="${pageNum}">
        `;

        // Add click handler
        element.addEventListener('click', (e) => {
            if (e.target.type !== 'checkbox') {
                const checkbox = element.querySelector('.page-thumbnail-checkbox');
                checkbox.checked = !checkbox.checked;
            }
            this.updateThumbnailSelection(element);
            this.updateSplitPreview();
        });

        // Add checkbox handler
        const checkbox = element.querySelector('.page-thumbnail-checkbox');
        checkbox.addEventListener('change', () => {
            this.updateThumbnailSelection(element);
            this.updateSplitPreview();
        });

        return element;
    }

    updateThumbnailSelection(element) {
        const checkbox = element.querySelector('.page-thumbnail-checkbox');
        if (checkbox.checked) {
            element.classList.add('selected');
            element.classList.remove('unselected');
        } else {
            element.classList.remove('selected');
            element.classList.add('unselected');
        }
    }

    selectAllPages() {
        const checkboxes = document.querySelectorAll('#split-page-thumbnails .page-thumbnail-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = true;
            this.updateThumbnailSelection(checkbox.closest('.page-thumbnail'));
        });
        this.updateSplitPreview();
    }

    selectNoPages() {
        const checkboxes = document.querySelectorAll('#split-page-thumbnails .page-thumbnail-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
            this.updateThumbnailSelection(checkbox.closest('.page-thumbnail'));
        });
        this.updateSplitPreview();
    }

    getVisuallySelectedPages() {
        const checkboxes = document.querySelectorAll('#split-page-thumbnails .page-thumbnail-checkbox:checked');
        const pages = [];
        checkboxes.forEach(checkbox => {
            pages.push(parseInt(checkbox.dataset.page));
        });
        return pages.sort((a, b) => a - b);
    }

    convertPagesToRanges(pages) {
        if (pages.length === 0) return [];
        
        const ranges = [];
        let start = pages[0];
        let end = pages[0];
        
        for (let i = 1; i < pages.length; i++) {
            if (pages[i] === end + 1) {
                end = pages[i];
            } else {
                ranges.push({ start, end });
                start = end = pages[i];
            }
        }
        ranges.push({ start, end });
        
        return ranges;
    }

    // Combined visual selection with both checkboxes and dividers
    async showCombinedVisualSelection() {
        if (!this.currentFile) {
            return;
        }

        const container = document.getElementById('split-page-thumbnails');
        if (!container) return;

        container.innerHTML = '<div class="loading-thumbnails">Generating thumbnails...</div>';

        try {
            // Generate thumbnails for all pages if we don't have them
            if (!this.currentThumbnails || this.currentThumbnails.thumbnails.length < this.pageCount) {
                this.currentThumbnails = await this.pdfPreview.generateThumbnails(this.currentFile, this.pageCount);
            }

            container.innerHTML = '';
            this.splitDividers = new Set(); // Track where dividers are placed

            // Create the combined interface with both checkboxes and dividers
            this.createCombinedInterface(container);
        } catch (error) {
            console.error('Error generating thumbnails:', error);
            container.innerHTML = '<div class="error-message">Failed to generate thumbnails</div>';
        }
    }

    createCombinedInterface(container) {
        // Create thumbnails with both checkboxes and divider placeholders
        for (let pageNum = 1; pageNum <= this.pageCount; pageNum++) {
            const thumbnail = this.currentThumbnails.thumbnails.find(t => t.pageNumber === pageNum) ||
                            this.pdfPreview.createEnhancedPlaceholder(pageNum, this.currentFile.name);
            
            // Create thumbnail element with checkbox
            const thumbnailElement = this.createCombinedThumbnailElement(thumbnail, pageNum);
            container.appendChild(thumbnailElement);

            // Add divider placeholder after each page (except the last one)
            if (pageNum < this.pageCount) {
                const dividerPlaceholder = this.createDividerPlaceholder(pageNum);
                container.appendChild(dividerPlaceholder);
            }
        }
    }

    createCombinedThumbnailElement(thumbnail, pageNum) {
        const element = document.createElement('div');
        element.className = 'page-thumbnail selected in-split-mode';
        element.dataset.pageNumber = pageNum;

        const img = document.createElement('img');
        img.src = thumbnail.dataUrl;
        img.alt = `Page ${pageNum}`;
        img.className = 'page-thumbnail-image';

        const pageLabel = document.createElement('div');
        pageLabel.className = 'page-thumbnail-label';
        pageLabel.textContent = pageNum;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'page-thumbnail-checkbox';
        checkbox.checked = true; // All pages selected by default
        checkbox.dataset.page = pageNum;

        element.appendChild(img);
        element.appendChild(pageLabel);
        element.appendChild(checkbox);

        // Add click handler for the entire element (excluding checkbox)
        element.addEventListener('click', (e) => {
            if (e.target.type !== 'checkbox') {
                checkbox.checked = !checkbox.checked;
            }
            this.updateThumbnailSelection(element);
            this.updateSplitPreview();
        });

        // Add checkbox handler
        checkbox.addEventListener('change', () => {
            this.updateThumbnailSelection(element);
            this.updateSplitPreview();
        });

        return element;
    }

    createDividerPlaceholder(afterPage) {
        const placeholder = document.createElement('div');
        placeholder.className = 'split-divider-placeholder';
        placeholder.dataset.afterPage = afterPage;
        placeholder.title = `Click to split after page ${afterPage}`;

        placeholder.addEventListener('click', () => {
            this.toggleDivider(afterPage, placeholder);
        });

        return placeholder;
    }

    toggleDivider(afterPage, placeholderElement) {
        if (!this.splitDividers) {
            this.splitDividers = new Set();
        }
        
        if (this.splitDividers.has(afterPage)) {
            // Remove divider
            this.splitDividers.delete(afterPage);
            placeholderElement.className = 'split-divider-placeholder';
            placeholderElement.title = `Click to split after page ${afterPage}`;
        } else {
            // Add divider
            this.splitDividers.add(afterPage);
            placeholderElement.className = 'split-divider';
            placeholderElement.title = `Click to remove split after page ${afterPage}`;
        }
        
        this.updateSplitPreview();
    }

    clearAllDividers() {
        if (!this.splitDividers) {
            this.splitDividers = new Set();
        }
        this.splitDividers.clear();
        
        // Update all divider elements
        const dividerElements = document.querySelectorAll('#split-divider-thumbnails .split-divider, #split-divider-thumbnails .split-divider-placeholder');
        dividerElements.forEach(element => {
            const afterPage = parseInt(element.dataset.afterPage);
            element.className = 'split-divider-placeholder';
            element.title = `Click to split after page ${afterPage}`;
        });
        
        this.updateSplitPreview();
    }

    addAllDividers() {
        if (!this.splitDividers) {
            this.splitDividers = new Set();
        }
        
        // Add dividers after every page except the last
        for (let pageNum = 1; pageNum < this.pageCount; pageNum++) {
            this.splitDividers.add(pageNum);
        }
        
        // Update all divider elements
        const dividerElements = document.querySelectorAll('#split-divider-thumbnails .split-divider, #split-divider-thumbnails .split-divider-placeholder');
        dividerElements.forEach(element => {
            const afterPage = parseInt(element.dataset.afterPage);
            if (this.splitDividers.has(afterPage)) {
                element.className = 'split-divider';
                element.title = `Click to remove split after page ${afterPage}`;
            }
        });
        
        this.updateSplitPreview();
    }

    getDividerRanges() {
        if (!this.splitDividers) {
            return [];
        }
        
        const dividerPositions = Array.from(this.splitDividers).sort((a, b) => a - b);
        const ranges = [];
        let start = 1;
        
        for (const dividerPos of dividerPositions) {
            ranges.push({ start: start, end: dividerPos });
            start = dividerPos + 1;
        }
        
        // Add the final range if there are remaining pages
        if (start <= this.pageCount) {
            ranges.push({ start: start, end: this.pageCount });
        }
        
        return ranges;
    }

    reset() {
        this.handleClear();
    }
}