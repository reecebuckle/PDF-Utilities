/**
 * UIController - Manages UI state transitions and feedback
 */
export class UIController {
    constructor() {
        this.sections = {
            upload: document.getElementById('drop-zone').parentElement,
            fileList: document.getElementById('file-list-section'),
            progress: document.getElementById('progress-section'),
            result: document.getElementById('result-section'),
            error: document.getElementById('error-section')
        };

        this.elements = {
            progressFill: document.getElementById('progress-fill'),
            progressText: document.getElementById('progress-text'),
            errorMessage: document.getElementById('error-message'),
            downloadBtn: document.getElementById('download-btn'),
            mergeBtn: document.getElementById('merge-btn'),
            clearBtn: document.getElementById('clear-btn'),
            startOverBtn: document.getElementById('start-over-btn'),
            retryBtn: document.getElementById('retry-btn')
        };

        this.currentDownloadUrl = null;
    }

    // Show file list section when files are selected
    showFileList() {
        this.sections.fileList.style.display = 'block';
        this.hideSection('progress');
        this.hideSection('result');
        this.hideSection('error');
    }

    // Hide file list section
    hideFileList() {
        this.sections.fileList.style.display = 'none';
    }

    // Show progress section during processing
    showProgress(percentage = 0, message = 'Processing...') {
        this.hideSection('fileList');
        this.hideSection('result');
        this.hideSection('error');
        
        this.sections.progress.style.display = 'block';
        this.updateProgress(percentage, message);
    }

    // Update progress bar and message
    updateProgress(percentage, message) {
        if (this.elements.progressFill) {
            this.elements.progressFill.style.width = `${Math.max(0, Math.min(100, percentage))}%`;
        }
        
        if (this.elements.progressText) {
            this.elements.progressText.textContent = message;
        }
    }

    // Show success result with download
    showSuccess(downloadUrl, filename) {
        this.hideSection('progress');
        this.hideSection('error');
        
        this.sections.result.style.display = 'block';
        
        // Clean up previous download URL
        this.cleanupDownloadUrl();
        
        // Set up new download
        this.currentDownloadUrl = downloadUrl;
        if (this.elements.downloadBtn) {
            this.elements.downloadBtn.onclick = () => {
                this.downloadFile(downloadUrl, filename);
            };
        }
    }

    // Show error message
    showError(message, canRetry = true) {
        this.hideSection('progress');
        this.hideSection('result');
        
        this.sections.error.style.display = 'block';
        
        if (this.elements.errorMessage) {
            this.elements.errorMessage.textContent = message;
        }
        
        if (this.elements.retryBtn) {
            this.elements.retryBtn.style.display = canRetry ? 'inline-flex' : 'none';
        }
    }

    // Hide a specific section
    hideSection(sectionName) {
        const section = this.sections[sectionName];
        if (section) {
            section.style.display = 'none';
        }
    }

    // Reset to initial state
    reset() {
        this.hideSection('fileList');
        this.hideSection('progress');
        this.hideSection('result');
        this.hideSection('error');
        
        this.cleanupDownloadUrl();
        
        // Reset button states
        this.setMergeButtonEnabled(false);
    }

    // Enable/disable merge button
    setMergeButtonEnabled(enabled) {
        if (this.elements.mergeBtn) {
            this.elements.mergeBtn.disabled = !enabled;
        }
    }

    // Download file helper
    downloadFile(url, filename) {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Clean up blob URLs to prevent memory leaks
    cleanupDownloadUrl() {
        if (this.currentDownloadUrl) {
            URL.revokeObjectURL(this.currentDownloadUrl);
            this.currentDownloadUrl = null;
        }
    }

    // Set up event listeners for UI buttons
    setupEventListeners(callbacks) {
        if (this.elements.mergeBtn && callbacks.onMerge) {
            this.elements.mergeBtn.addEventListener('click', callbacks.onMerge);
        }
        
        if (this.elements.clearBtn && callbacks.onClear) {
            this.elements.clearBtn.addEventListener('click', callbacks.onClear);
        }
        
        if (this.elements.startOverBtn && callbacks.onStartOver) {
            this.elements.startOverBtn.addEventListener('click', callbacks.onStartOver);
        }
        
        if (this.elements.retryBtn && callbacks.onRetry) {
            this.elements.retryBtn.addEventListener('click', callbacks.onRetry);
        }
    }

    // Show temporary notification
    showNotification(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 1000;
            max-width: 300px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            animation: slideIn 0.3s ease-out;
        `;
        
        // Set background color based on type
        const colors = {
            info: '#3b82f6',
            success: '#10b981',
            warning: '#f59e0b',
            error: '#ef4444'
        };
        notification.style.backgroundColor = colors[type] || colors.info;
        
        notification.textContent = message;
        
        // Add CSS animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            @keyframes slideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(notification);
        
        // Auto remove
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
                if (style.parentNode) {
                    style.parentNode.removeChild(style);
                }
            }, 300);
        }, duration);
    }

    // Update file count display
    updateFileCount(count) {
        const fileListSection = this.sections.fileList;
        if (fileListSection) {
            const heading = fileListSection.querySelector('h3');
            if (heading) {
                heading.textContent = `Selected Files (${count})`;
            }
        }
    }

    // Show/hide sections based on app state
    updateUIState(state) {
        switch (state) {
            case 'initial':
                this.reset();
                break;
                
            case 'files-selected':
                this.showFileList();
                break;
                
            case 'processing':
                this.showProgress(0, 'Starting PDF merge...');
                break;
                
            case 'completed':
                // Will be handled by showSuccess
                break;
                
            case 'error':
                // Will be handled by showError
                break;
        }
    }
}