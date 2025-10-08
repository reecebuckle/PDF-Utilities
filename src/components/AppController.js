/**
 * AppController - Main application controller that coordinates all components
 */
import { FileUploadHandler } from './FileUploadHandler.js';
import { FileListManager } from './FileListManager.js';
import { PDFProcessor } from './PDFProcessor.js';
import { UIController } from './UIController.js';
import { ErrorHandler } from './ErrorHandler.js';
import { ToolManager } from './ToolManager.js';
import { SplitTool } from './SplitTool.js';
import { WordConvertTool } from './WordConvertTool.js';

export class AppController {
    constructor() {
        this.state = {
            files: [],
            isProcessing: false,
            currentOperation: null,
            lastResult: null
        };

        // Initialize components
        this.uiController = new UIController();
        this.errorHandler = new ErrorHandler();
        this.pdfProcessor = new PDFProcessor((progress) => {
            this.handleProgress(progress);
        });

        // Initialize tool management
        this.toolManager = new ToolManager();
        this.splitTool = new SplitTool(this.uiController, this.errorHandler);
        this.wordConvertTool = new WordConvertTool(this.uiController, this.errorHandler);

        // Will be initialized in init()
        this.fileUploadHandler = null;
        this.fileListManager = null;
    }

    init() {
        try {
            this.initializeComponents();
            this.setupEventListeners();
            this.setupCleanupHandlers();
            
            console.log('PDF Utility Tool initialized successfully');
        } catch (error) {
            this.errorHandler.handleInitializationError(error);
        }
    }

    initializeComponents() {
        // Initialize file upload handler
        const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('file-input');
        
        if (!dropZone || !fileInput) {
            throw new Error('Required DOM elements not found');
        }

        this.fileUploadHandler = new FileUploadHandler(
            dropZone,
            fileInput,
            (files) => this.handleFilesSelected(files)
        );

        // Initialize file list manager
        const fileListContainer = document.getElementById('file-list');
        if (!fileListContainer) {
            throw new Error('File list container not found');
        }

        this.fileListManager = new FileListManager(
            fileListContainer,
            (files) => this.handleOrderChange(files)
        );
    }

    setupEventListeners() {
        // Set up UI button event listeners
        this.uiController.setupEventListeners({
            onMerge: () => this.handleMergeRequest(),
            onClear: () => this.handleClearRequest(),
            onStartOver: () => this.handleStartOver(),
            onRetry: () => this.handleRetry()
        });

        // Set up tool manager
        this.toolManager.onToolChange = (toolName) => this.handleToolChange(toolName);

        // Handle browser compatibility warnings
        this.errorHandler.checkBrowserCompatibility();
    }

    setupCleanupHandlers() {
        // Clean up on page unload
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });

        // Clean up on page visibility change (mobile browsers)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.cleanup();
            }
        });
    }

    async handleFilesSelected(files) {
        try {
            // Add files to the list
            await this.fileListManager.addFiles(files);
            
            // Update state
            this.state.files = this.fileListManager.getOrderedFiles();
            
            // Update UI
            this.uiController.showFileList();
            this.uiController.setMergeButtonEnabled(this.state.files.length > 0);
            this.uiController.updateFileCount(this.state.files.length);
            
            // Show merge preview if multiple files
            if (this.state.files.length > 1) {
                this.showMergePreview();
            }
            
            // Show success notification
            const fileCount = files.length;
            const message = fileCount === 1 ? 
                `Added ${files[0].name}` : 
                `Added ${fileCount} files`;
            this.uiController.showNotification(message, 'success');
            
        } catch (error) {
            this.errorHandler.handleFileSelectionError(error);
        }
    }

    handleOrderChange(files) {
        this.state.files = files;
        this.uiController.setMergeButtonEnabled(files.length > 0);
        this.uiController.updateFileCount(files.length);
        
        // Update merge preview when order changes
        if (files.length > 1) {
            this.showMergePreview();
        }
    }

    showMergePreview() {
        const thumbnailsData = this.fileListManager.getThumbnailsData();
        const pdfPreview = this.fileListManager.pdfPreview;
        
        // Find or create preview container
        let previewContainer = document.getElementById('merge-preview');
        if (previewContainer) {
            previewContainer.remove();
        }
        
        // Create new preview using compact style like split preview
        const mergePreview = this.createCompactMergePreview(this.state.files, thumbnailsData);
        mergePreview.id = 'merge-preview';
        
        // Insert after file list section
        const fileListSection = document.getElementById('file-list-section');
        if (fileListSection) {
            fileListSection.parentNode.insertBefore(mergePreview, fileListSection.nextSibling);
        }
    }

    createCompactMergePreview(files, thumbnailsData) {
        const previewContainer = document.createElement('div');
        previewContainer.className = 'split-preview-container'; // Use same styling as split preview
        
        const header = document.createElement('div');
        header.className = 'split-preview-header';
        header.innerHTML = `
            <h3>Merge Preview</h3>
            <p>Documents will be combined in this order:</p>
        `;
        
        const rangesContainer = document.createElement('div');
        rangesContainer.className = 'split-ranges-container';
        
        files.forEach((file, index) => {
            const thumbnails = thumbnailsData.get(file);
            if (thumbnails && thumbnails.thumbnails.length > 0) {
                const filePreview = document.createElement('div');
                filePreview.className = 'split-range-preview';
                
                const fileHeader = document.createElement('div');
                fileHeader.className = 'range-header';
                fileHeader.innerHTML = `
                    <span class="range-label">Document ${index + 1}</span>
                    <span class="range-pages">${file.name.length > 20 ? file.name.substring(0, 17) + '...' : file.name}</span>
                `;
                
                const fileThumbnails = document.createElement('div');
                fileThumbnails.className = 'range-thumbnails';
                
                // Show first few thumbnails
                const maxThumbnails = 4;
                for (let i = 0; i < Math.min(thumbnails.thumbnails.length, maxThumbnails); i++) {
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
                    fileThumbnails.appendChild(thumbnailItem);
                }
                
                if (thumbnails.totalPages > maxThumbnails) {
                    const moreIndicator = document.createElement('div');
                    moreIndicator.className = 'more-pages-indicator small';
                    moreIndicator.textContent = `+${thumbnails.totalPages - maxThumbnails} more`;
                    fileThumbnails.appendChild(moreIndicator);
                }
                
                filePreview.appendChild(fileHeader);
                filePreview.appendChild(fileThumbnails);
                rangesContainer.appendChild(filePreview);
            }
        });
        
        previewContainer.appendChild(header);
        previewContainer.appendChild(rangesContainer);
        
        return previewContainer;
    }

    showMergeSuccess(downloadUrl, filename) {
        // Update result title
        const resultTitle = document.getElementById('result-title');
        if (resultTitle) {
            resultTitle.textContent = 'PDF Merged Successfully!';
        }

        // Create download button for merge
        const resultDownloads = document.getElementById('result-downloads');
        if (resultDownloads) {
            resultDownloads.innerHTML = `
                <button type="button" id="download-btn" class="btn btn-primary">
                    Download Merged PDF
                </button>
            `;
            
            const downloadBtn = document.getElementById('download-btn');
            if (downloadBtn) {
                downloadBtn.addEventListener('click', () => {
                    this.downloadFile(downloadUrl, filename);
                });
            }
        }

        // Show result section
        this.uiController.sections.result.style.display = 'block';
    }

    downloadFile(url, filename) {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    async handleMergeRequest() {
        if (this.state.isProcessing) {
            return;
        }

        if (this.state.files.length === 0) {
            this.uiController.showNotification('No files selected', 'warning');
            return;
        }

        try {
            this.state.isProcessing = true;
            this.state.currentOperation = 'merge';
            
            // Check memory limits
            const memoryCheck = this.pdfProcessor.checkMemoryLimits(this.state.files);
            if (!memoryCheck.isWithinLimits) {
                const proceed = confirm(
                    `${memoryCheck.warning}\n\nDo you want to continue anyway?`
                );
                if (!proceed) {
                    this.state.isProcessing = false;
                    return;
                }
            }

            // Show progress UI
            this.uiController.updateUIState('processing');

            // Validate PDFs first
            this.uiController.updateProgress(5, 'Validating PDF files...');
            const validationResults = await this.pdfProcessor.validateMultiplePDFs(this.state.files);
            
            const invalidFiles = validationResults.filter(result => !result.isValid);
            if (invalidFiles.length > 0) {
                const errorMessage = `Invalid PDF files detected:\n${invalidFiles.map(r => r.file.name).join('\n')}`;
                throw new Error(errorMessage);
            }

            // Get selected pages from file list manager
            const selectedPages = this.fileListManager.getSelectedPages();
            console.log('Selected pages for merge:', selectedPages);
            
            // Merge PDFs with selected pages
            const mergedPdfBytes = await this.pdfProcessor.mergePDFs(this.state.files, selectedPages);
            
            // Create download
            const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
            const downloadUrl = URL.createObjectURL(blob);
            const filename = this.pdfProcessor.generateMergedFilename(this.state.files);
            
            // Store result
            this.state.lastResult = {
                blob: blob,
                downloadUrl: downloadUrl,
                filename: filename
            };

            // Show success with download
            this.showMergeSuccess(downloadUrl, filename);
            this.uiController.showNotification('PDF merged successfully!', 'success');

        } catch (error) {
            this.errorHandler.handleProcessingError(error);
            this.uiController.showError(error.message, true);
        } finally {
            this.state.isProcessing = false;
            this.state.currentOperation = null;
        }
    }

    handleProgress(progress) {
        this.uiController.updateProgress(progress.percentage, progress.message);
    }

    handleClearRequest() {
        try {
            this.fileListManager.clear();
            this.state.files = [];
            
            this.uiController.hideFileList();
            this.uiController.setMergeButtonEnabled(false);
            
            // Reset file upload handler
            this.fileUploadHandler.reset();
            
            this.uiController.showNotification('Files cleared', 'info');
            
        } catch (error) {
            this.errorHandler.handleUIError(error);
        }
    }

    handleStartOver() {
        const currentTool = this.toolManager.getCurrentTool();
        
        if (currentTool === 'merge') {
            this.handleClearRequest();
        } else if (currentTool === 'split') {
            this.splitTool.reset();
        } else if (currentTool === 'word-convert') {
            this.wordConvertTool.reset();
        }
        
        this.uiController.reset();
        this.cleanup();
    }

    handleToolChange(toolName) {
        // Clean up current tool state
        this.cleanup();
        this.uiController.reset();
        
        // Tool-specific initialization if needed
        if (toolName === 'merge') {
            // Merge tool is already initialized
        } else if (toolName === 'split') {
            // Split tool is already initialized
        } else if (toolName === 'word-convert') {
            // Word convert tool is already initialized
        }
        
        console.log(`Switched to ${toolName} tool`);
    }

    handleRetry() {
        if (this.state.files.length > 0) {
            this.handleMergeRequest();
        } else {
            this.uiController.reset();
        }
    }

    cleanup() {
        // Clean up blob URLs to prevent memory leaks
        if (this.state.lastResult && this.state.lastResult.downloadUrl) {
            URL.revokeObjectURL(this.state.lastResult.downloadUrl);
            this.state.lastResult = null;
        }

        // Clean up UI controller
        if (this.uiController) {
            this.uiController.cleanupDownloadUrl();
        }

        // Cancel any ongoing processing
        if (this.pdfProcessor && this.state.isProcessing) {
            this.pdfProcessor.cancel();
        }
    }

    // Public API methods for external use
    getState() {
        return { ...this.state };
    }

    getFileCount() {
        return this.state.files.length;
    }

    isProcessing() {
        return this.state.isProcessing;
    }

    // Error recovery
    handleError(error, context = 'unknown') {
        console.error(`Error in ${context}:`, error);
        
        this.state.isProcessing = false;
        this.state.currentOperation = null;
        
        this.errorHandler.handleGenericError(error, context);
    }
}