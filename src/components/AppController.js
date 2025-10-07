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
        
        // Create new preview
        const mergePreview = pdfPreview.createMergePreview(this.state.files, thumbnailsData);
        mergePreview.id = 'merge-preview';
        
        // Insert after file list section
        const fileListSection = document.getElementById('file-list-section');
        if (fileListSection) {
            fileListSection.parentNode.insertBefore(mergePreview, fileListSection.nextSibling);
        }
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

            // Merge PDFs
            const mergedPdfBytes = await this.pdfProcessor.mergePDFs(this.state.files);
            
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

            // Show success
            this.uiController.showSuccess(downloadUrl, filename);
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