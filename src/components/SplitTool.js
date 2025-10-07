/**
 * SplitTool - Handles PDF splitting tool UI and logic
 */
import { FileUploadHandler } from './FileUploadHandler.js';
import { PDFSplitter } from './PDFSplitter.js';

export class SplitTool {
    constructor(uiController, errorHandler) {
        this.uiController = uiController;
        this.errorHandler = errorHandler;
        this.currentFile = null;
        this.pageCount = 0;
        
        this.pdfSplitter = new PDFSplitter((progress) => {
            this.handleProgress(progress);
        });

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
        const splitAll = document.getElementById('split-all');
        const rangesInput = document.getElementById('split-ranges-input');

        if (splitRanges && splitAll && rangesInput) {
            splitRanges.addEventListener('change', () => {
                rangesInput.style.display = splitRanges.checked ? 'block' : 'none';
            });

            splitAll.addEventListener('change', () => {
                rangesInput.style.display = splitAll.checked ? 'none' : 'block';
            });
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

        // Browse button
        const splitBrowseBtn = document.querySelector('.split-browse-btn');
        if (splitBrowseBtn) {
            splitBrowseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                document.getElementById('split-file-input').click();
            });
        }
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
            
            // Update UI
            this.showSplitOptions(file.name, this.pageCount);
            
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

    handleClear() {
        this.currentFile = null;
        this.pageCount = 0;
        
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

    reset() {
        this.handleClear();
    }
}