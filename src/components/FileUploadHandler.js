/**
 * FileUploadHandler - Manages file upload, drag-drop, and validation
 */
export class FileUploadHandler {
    constructor(dropZone, fileInput, onFilesSelected) {
        this.dropZone = dropZone;
        this.fileInput = fileInput;
        this.onFilesSelected = onFilesSelected;
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        // File input change event
        this.fileInput.addEventListener('change', (e) => {
            this.handleFileSelect(e);
        });

        // Drag and drop events
        this.dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dropZone.classList.add('drag-over');
        });

        this.dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            // Only remove drag-over if we're leaving the drop zone entirely
            if (!this.dropZone.contains(e.relatedTarget)) {
                this.dropZone.classList.remove('drag-over');
            }
        });

        this.dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropZone.classList.remove('drag-over');
            this.handleDrop(e);
        });

        // Click to browse
        this.dropZone.addEventListener('click', () => {
            this.fileInput.click();
        });

        // Browse button click
        const browseBtn = this.dropZone.querySelector('.browse-btn');
        if (browseBtn) {
            browseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.fileInput.click();
            });
        }
    }

    handleFileSelect(event) {
        const files = Array.from(event.target.files);
        this.processFiles(files);
    }

    handleDrop(event) {
        const files = Array.from(event.dataTransfer.files);
        this.processFiles(files);
    }

    processFiles(files) {
        const validation = this.validateFiles(files);
        
        if (validation.invalid.length > 0) {
            this.showValidationErrors(validation.invalid);
        }
        
        if (validation.valid.length > 0) {
            this.onFilesSelected(validation.valid);
        }
        
        // Clear the file input
        this.fileInput.value = '';
    }

    validateFiles(files) {
        const valid = [];
        const invalid = [];
        const maxFileSize = 50 * 1024 * 1024; // 50MB

        files.forEach(file => {
            const validation = this.validateSingleFile(file, maxFileSize);
            if (validation.isValid) {
                valid.push(file);
            } else {
                invalid.push({
                    file: file,
                    reason: validation.reason
                });
            }
        });

        return { valid, invalid };
    }

    validateSingleFile(file, maxFileSize) {
        // Check file type
        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
            return {
                isValid: false,
                reason: 'Only PDF files are supported'
            };
        }

        // Check file size
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
    }

    showValidationErrors(invalidFiles) {
        const errorMessages = invalidFiles.map(item => 
            `${item.file.name}: ${item.reason}`
        ).join('\n');

        // Create a temporary error display
        this.showTemporaryError(`Some files were rejected:\n${errorMessages}`);
    }

    showTemporaryError(message) {
        // Create error element
        const errorDiv = document.createElement('div');
        errorDiv.className = 'upload-error';
        errorDiv.style.cssText = `
            background: #fef2f2;
            border: 1px solid #fecaca;
            color: #dc2626;
            padding: 1rem;
            border-radius: 8px;
            margin-top: 1rem;
            font-size: 0.875rem;
            white-space: pre-line;
        `;
        errorDiv.textContent = message;

        // Add to drop zone
        this.dropZone.appendChild(errorDiv);

        // Remove after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 5000);
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Reset the upload handler
    reset() {
        this.fileInput.value = '';
        this.dropZone.classList.remove('drag-over');
        
        // Remove any error messages
        const errors = this.dropZone.querySelectorAll('.upload-error');
        errors.forEach(error => error.remove());
    }
}