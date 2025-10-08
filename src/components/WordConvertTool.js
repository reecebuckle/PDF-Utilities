/**
 * WordConvertTool - Handles Word to PDF conversion tool UI and logic
 */
import { FileUploadHandler } from './FileUploadHandler.js';
import { WordToPDFConverter } from './WordToPDFConverter.js';

export class WordConvertTool {
    constructor(uiController, errorHandler) {
        this.uiController = uiController;
        this.errorHandler = errorHandler;
        this.selectedFiles = [];
        
        this.wordConverter = new WordToPDFConverter((progress) => {
            this.handleProgress(progress);
        });

        this.initializeComponents();
        this.setupEventListeners();
    }

    initializeComponents() {
        // Initialize file upload handler for Word files
        const wordDropZone = document.getElementById('word-drop-zone');
        const wordFileInput = document.getElementById('word-file-input');
        
        if (wordDropZone && wordFileInput) {
            this.fileUploadHandler = new FileUploadHandler(
                wordDropZone,
                wordFileInput,
                (files) => this.handleFilesSelected(files)
            );
            
            // Override validation for Word files
            this.fileUploadHandler.validateSingleFile = (file, maxFileSize) => {
                // Check file type
                if (!file.name.toLowerCase().endsWith('.docx')) {
                    return {
                        isValid: false,
                        reason: 'Only .docx files are supported'
                    };
                }

                // Check file size (50MB limit)
                if (file.size > maxFileSize) {
                    return {
                        isValid: false,
                        reason: `File size exceeds 50MB limit (${this.formatFileSize(file.size)})`
                    };
                }

                // Check if file is empty
                if (file.size === 0) {
                    return {
                        isValid: false,
                        reason: 'File appears to be empty'
                    };
                }

                return { isValid: true };
            };
        }
    }

    setupEventListeners() {
        // Convert button
        const convertBtn = document.getElementById('convert-btn');
        if (convertBtn) {
            convertBtn.addEventListener('click', () => this.handleConvertRequest());
        }

        // Clear button
        const wordClearBtn = document.getElementById('word-clear-btn');
        if (wordClearBtn) {
            wordClearBtn.addEventListener('click', () => this.handleClear());
        }

        // Browse button
        const wordBrowseBtn = document.querySelector('.word-browse-btn');
        if (wordBrowseBtn) {
            wordBrowseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                document.getElementById('word-file-input').click();
            });
        }
    }

    async handleFilesSelected(files) {
        if (files.length === 0) return;
        
        try {
            // Add files to the list
            this.selectedFiles = [...this.selectedFiles, ...files];
            
            // Update UI
            this.showWordFileList();
            this.renderFileList();
            
            // Show success notification
            const fileCount = files.length;
            const message = fileCount === 1 ? 
                `Added ${files[0].name}` : 
                `Added ${fileCount} Word documents`;
            this.uiController.showNotification(message, 'success');
            
        } catch (error) {
            this.errorHandler.handleFileSelectionError(error);
        }
    }

    showWordFileList() {
        const wordFileListSection = document.getElementById('word-file-list-section');
        if (wordFileListSection) {
            wordFileListSection.style.display = 'block';
        }
        
        // Update convert button state
        const convertBtn = document.getElementById('convert-btn');
        if (convertBtn) {
            convertBtn.disabled = this.selectedFiles.length === 0;
        }
    }

    renderFileList() {
        const wordFileList = document.getElementById('word-file-list');
        if (!wordFileList) return;
        
        wordFileList.innerHTML = '';
        
        this.selectedFiles.forEach((file, index) => {
            const fileItem = this.createFileElement(file, index);
            wordFileList.appendChild(fileItem);
        });
    }

    createFileElement(file, index) {
        const div = document.createElement('div');
        div.className = 'file-item';
        div.dataset.index = index;

        div.innerHTML = `
            <div class="file-order">${index + 1}</div>
            <div class="file-info">
                <div class="file-name" title="${file.name}">${this.truncateFileName(file.name)}</div>
                <div class="file-size">${this.formatFileSize(file.size)} • Word Document</div>
            </div>
            <button type="button" class="remove-btn" title="Remove file" data-index="${index}">
                Remove
            </button>
        `;

        // Set up remove button
        const removeBtn = div.querySelector('.remove-btn');
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeFile(index);
        });

        return div;
    }

    removeFile(index) {
        this.selectedFiles.splice(index, 1);
        this.renderFileList();
        
        if (this.selectedFiles.length === 0) {
            const wordFileListSection = document.getElementById('word-file-list-section');
            if (wordFileListSection) {
                wordFileListSection.style.display = 'none';
            }
        }
        
        // Update convert button state
        const convertBtn = document.getElementById('convert-btn');
        if (convertBtn) {
            convertBtn.disabled = this.selectedFiles.length === 0;
        }
    }

    async handleConvertRequest() {
        if (this.selectedFiles.length === 0) {
            this.uiController.showNotification('No Word documents selected', 'warning');
            return;
        }

        try {
            this.uiController.updateUIState('processing');
            
            const results = [];
            
            for (let i = 0; i < this.selectedFiles.length; i++) {
                const file = this.selectedFiles[i];
                
                // Update progress for current file
                const fileProgress = (i / this.selectedFiles.length) * 100;
                this.uiController.updateProgress(fileProgress, `Converting ${file.name}...`);
                
                try {
                    const pdfBytes = await this.wordConverter.convertWordToPDF(file);
                    const filename = this.wordConverter.generatePDFFilename(file.name);
                    
                    results.push({
                        filename: filename,
                        data: pdfBytes,
                        originalName: file.name,
                        size: pdfBytes.length
                    });
                } catch (error) {
                    console.error(`Failed to convert ${file.name}:`, error);
                    // Continue with other files, but log the error
                    this.uiController.showNotification(`Failed to convert ${file.name}: ${error.message}`, 'error');
                }
            }
            
            if (results.length > 0) {
                this.showConversionResults(results);
            } else {
                throw new Error('No files were successfully converted');
            }
            
        } catch (error) {
            this.errorHandler.handleProcessingError(error);
            this.uiController.showError(error.message, true);
        }
    }

    showConversionResults(results) {
        // Update result title
        const resultTitle = document.getElementById('result-title');
        if (resultTitle) {
            resultTitle.textContent = `Word to PDF Conversion Complete! (${results.length} files converted)`;
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
                downloadAllBtn.textContent = 'Download All PDFs';
                downloadAllBtn.style.marginTop = '1rem';
                downloadAllBtn.addEventListener('click', () => this.downloadAllFiles(results));
                resultDownloads.appendChild(downloadAllBtn);
            }
        }

        this.uiController.sections.result.style.display = 'block';
        this.uiController.showNotification('Word documents converted successfully!', 'success');
    }

    createDownloadItem(result, index) {
        const item = document.createElement('div');
        item.className = 'download-item';
        
        item.innerHTML = `
            <div class="download-info">
                <div class="download-name">${result.filename}</div>
                <div class="download-size">Converted from: ${result.originalName} • ${this.formatFileSize(result.size)}</div>
            </div>
            <button class="download-btn-small" data-index="${index}">Download PDF</button>
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

    downloadAllFiles(results) {
        results.forEach((result, index) => {
            setTimeout(() => {
                this.downloadFile(result);
            }, index * 500); // Stagger downloads
        });
    }

    handleProgress(progress) {
        this.uiController.updateProgress(progress.percentage, progress.message);
    }

    handleClear() {
        this.selectedFiles = [];
        
        // Hide file list
        const wordFileListSection = document.getElementById('word-file-list-section');
        if (wordFileListSection) {
            wordFileListSection.style.display = 'none';
        }
        
        // Reset file upload handler
        if (this.fileUploadHandler) {
            this.fileUploadHandler.reset();
        }
        
        // Hide shared sections
        this.uiController.reset();
        
        this.uiController.showNotification('Cleared', 'info');
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

    reset() {
        this.handleClear();
    }
}