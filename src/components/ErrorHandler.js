/**
 * ErrorHandler - Centralized error handling with user-friendly messages
 */
export class ErrorHandler {
    constructor() {
        this.errorLog = [];
    }

    // Handle different types of errors with appropriate user messages
    handleFileSelectionError(error) {
        console.error('File selection error:', error);
        
        const userMessage = this.getUserFriendlyMessage(error, 'file_selection');
        this.showUserError(userMessage);
        this.logError(error, 'file_selection');
    }

    handleProcessingError(error) {
        console.error('PDF processing error:', error);
        
        const userMessage = this.getUserFriendlyMessage(error, 'processing');
        this.showUserError(userMessage);
        this.logError(error, 'processing');
    }

    handleUIError(error) {
        console.error('UI error:', error);
        
        const userMessage = this.getUserFriendlyMessage(error, 'ui');
        this.showUserError(userMessage);
        this.logError(error, 'ui');
    }

    handleInitializationError(error) {
        console.error('Initialization error:', error);
        
        const userMessage = 'Failed to initialize the application. Please refresh the page and try again.';
        this.showCriticalError(userMessage);
        this.logError(error, 'initialization');
    }

    handleGenericError(error, context = 'unknown') {
        console.error(`Generic error in ${context}:`, error);
        
        const userMessage = this.getUserFriendlyMessage(error, context);
        this.showUserError(userMessage);
        this.logError(error, context);
    }

    // Convert technical errors to user-friendly messages
    getUserFriendlyMessage(error, context) {
        const message = error.message || error.toString();
        
        // PDF-specific errors
        if (message.includes('Invalid PDF') || message.includes('corrupted')) {
            return 'One or more PDF files appear to be corrupted or invalid. Please check your files and try again.';
        }
        
        if (message.includes('Failed to process') && message.includes('.pdf')) {
            return 'Unable to process one of the PDF files. The file may be password-protected or corrupted.';
        }
        
        if (message.includes('PDF merge failed')) {
            return 'Failed to merge the PDF files. This might be due to incompatible PDF versions or corrupted files.';
        }
        
        // Memory/size errors
        if (message.includes('memory') || message.includes('size')) {
            return 'The files are too large to process. Please try with smaller files or fewer files at once.';
        }
        
        // File system errors
        if (message.includes('Failed to read file')) {
            return 'Unable to read one of the selected files. Please make sure the file is not corrupted or in use by another application.';
        }
        
        // Browser compatibility errors
        if (message.includes('not supported') || message.includes('API')) {
            return 'Your browser doesn\'t support this feature. Please try using a modern browser like Chrome, Firefox, or Safari.';
        }
        
        // Network/loading errors
        if (message.includes('Failed to load') || message.includes('network')) {
            return 'Failed to load required components. Please check your internet connection and try again.';
        }
        
        // Context-specific fallbacks
        switch (context) {
            case 'file_selection':
                return 'There was a problem with the selected files. Please try selecting different files.';
            
            case 'processing':
                return 'Failed to process the PDF files. Please check that your files are valid PDFs and try again.';
            
            case 'ui':
                return 'A user interface error occurred. Please refresh the page and try again.';
            
            case 'initialization':
                return 'Failed to start the application. Please refresh the page.';
            
            default:
                return 'An unexpected error occurred. Please try again or refresh the page.';
        }
    }

    // Show error to user via UI
    showUserError(message) {
        // Try to use UIController if available
        if (window.app && window.app.uiController) {
            window.app.uiController.showNotification(message, 'error', 5000);
        } else {
            // Fallback to alert
            alert(message);
        }
    }

    // Show critical error that prevents app from working
    showCriticalError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            font-family: sans-serif;
        `;
        
        errorDiv.innerHTML = `
            <div style="
                background: white;
                padding: 2rem;
                border-radius: 8px;
                max-width: 400px;
                text-align: center;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            ">
                <h2 style="color: #dc2626; margin-bottom: 1rem;">Application Error</h2>
                <p style="margin-bottom: 1.5rem; color: #374151;">${message}</p>
                <button onclick="window.location.reload()" style="
                    background: #3b82f6;
                    color: white;
                    border: none;
                    padding: 0.75rem 1.5rem;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 1rem;
                ">Refresh Page</button>
            </div>
        `;
        
        document.body.appendChild(errorDiv);
    }

    // Check browser compatibility
    checkBrowserCompatibility() {
        const requiredFeatures = [
            { name: 'File API', test: () => window.File && window.FileReader },
            { name: 'Drag and Drop API', test: () => 'draggable' in document.createElement('div') },
            { name: 'Blob API', test: () => window.Blob },
            { name: 'URL.createObjectURL', test: () => window.URL && window.URL.createObjectURL },
            { name: 'ES6 Modules', test: () => 'noModule' in document.createElement('script') }
        ];

        const unsupportedFeatures = requiredFeatures.filter(feature => {
            try {
                return !feature.test();
            } catch (e) {
                return true;
            }
        });

        if (unsupportedFeatures.length > 0) {
            const featureNames = unsupportedFeatures.map(f => f.name).join(', ');
            const message = `Your browser doesn't support: ${featureNames}. Please use a modern browser like Chrome, Firefox, or Safari.`;
            
            this.showCompatibilityWarning(message);
            return false;
        }

        return true;
    }

    // Show browser compatibility warning
    showCompatibilityWarning(message) {
        const warningDiv = document.createElement('div');
        warningDiv.style.cssText = `
            background: #fef3c7;
            border: 1px solid #f59e0b;
            color: #92400e;
            padding: 1rem;
            margin: 1rem;
            border-radius: 8px;
            text-align: center;
            font-weight: 500;
        `;
        warningDiv.textContent = message;
        
        document.body.insertBefore(warningDiv, document.body.firstChild);
    }

    // Log error for debugging
    logError(error, context) {
        const errorEntry = {
            timestamp: new Date().toISOString(),
            context: context,
            message: error.message || error.toString(),
            stack: error.stack,
            userAgent: navigator.userAgent
        };
        
        this.errorLog.push(errorEntry);
        
        // Keep only last 10 errors to prevent memory issues
        if (this.errorLog.length > 10) {
            this.errorLog.shift();
        }
    }

    // Get error log for debugging
    getErrorLog() {
        return [...this.errorLog];
    }

    // Clear error log
    clearErrorLog() {
        this.errorLog = [];
    }

    // Handle specific PDF-lib errors
    handlePDFLibError(error) {
        console.error('PDF-lib error:', error);
        
        let userMessage = 'Failed to process PDF file.';
        
        if (error.message.includes('Invalid PDF')) {
            userMessage = 'The selected file is not a valid PDF or is corrupted.';
        } else if (error.message.includes('password')) {
            userMessage = 'Password-protected PDFs are not supported.';
        } else if (error.message.includes('encrypted')) {
            userMessage = 'Encrypted PDFs cannot be processed.';
        } else if (error.message.includes('version')) {
            userMessage = 'This PDF version is not supported.';
        }
        
        this.showUserError(userMessage);
        this.logError(error, 'pdf_lib');
    }

    // Handle quota exceeded errors (storage/memory)
    handleQuotaExceededError(error) {
        console.error('Quota exceeded error:', error);
        
        const userMessage = 'Not enough memory to process these files. Please try with smaller files or close other browser tabs.';
        this.showUserError(userMessage);
        this.logError(error, 'quota_exceeded');
    }

    // Recovery suggestions
    getRecoverySuggestions(context) {
        const suggestions = {
            file_selection: [
                'Try selecting different PDF files',
                'Make sure files are not corrupted',
                'Check that files are actually PDFs'
            ],
            processing: [
                'Try with smaller PDF files',
                'Process fewer files at once',
                'Close other browser tabs to free memory',
                'Refresh the page and try again'
            ],
            ui: [
                'Refresh the page',
                'Try using a different browser',
                'Clear your browser cache'
            ]
        };
        
        return suggestions[context] || ['Refresh the page and try again'];
    }
}