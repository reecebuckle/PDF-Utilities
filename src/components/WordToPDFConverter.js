/**
 * WordToPDFConverter - Handles Word to PDF conversion
 */
import { createPDFDocument } from '../utils/pdfLibLoader.js';

// Import rgb function for PDF-lib colors
let rgb;
async function loadRgb() {
    if (!rgb) {
        const pdfLib = await import('pdf-lib');
        rgb = pdfLib.rgb;
    }
    return rgb;
}

export class WordToPDFConverter {
    constructor(onProgress) {
        this.onProgress = onProgress || (() => {});
        this.isProcessing = false;
    }

    async convertWordToPDF(file) {
        if (this.isProcessing) {
            throw new Error('Word conversion is already in progress');
        }

        this.isProcessing = true;
        
        try {
            this.updateProgress(0, 'Loading Word document...');
            
            // Load mammoth.js dynamically
            const mammoth = await import('mammoth');
            
            // Read the Word file
            const arrayBuffer = await this.fileToArrayBuffer(file);
            
            this.updateProgress(20, 'Extracting content from Word document...');
            
            // Convert Word to HTML
            const result = await mammoth.convertToHtml({ arrayBuffer });
            const htmlContent = result.value;
            const messages = result.messages;
            
            // Log any conversion messages
            if (messages.length > 0) {
                console.log('Mammoth conversion messages:', messages);
            }
            
            this.updateProgress(50, 'Converting to PDF format...');
            
            // Create PDF from HTML content
            const pdfBytes = await this.createPDFFromHTML(htmlContent, file.name);
            
            this.updateProgress(100, 'Conversion completed!');
            
            return pdfBytes;
            
        } catch (error) {
            throw new Error(`Word to PDF conversion failed: ${error.message}`);
        } finally {
            this.isProcessing = false;
        }
    }

    async createPDFFromHTML(htmlContent, fileName) {
        try {
            // Create a new PDF document
            const pdfDoc = await createPDFDocument();
            
            // Parse HTML content and extract text
            const textContent = this.extractTextFromHTML(htmlContent);
            
            // Add pages with text content
            await this.addTextToPDF(pdfDoc, textContent, fileName);
            
            // Save and return PDF bytes
            return await pdfDoc.save();
            
        } catch (error) {
            throw new Error(`Failed to create PDF: ${error.message}`);
        }
    }

    extractTextFromHTML(html) {
        // Create a temporary DOM element to parse HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        // Extract text content while preserving some structure
        const textContent = [];
        const elements = tempDiv.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, div');
        
        elements.forEach(element => {
            const text = element.textContent.trim();
            if (text) {
                // Determine text style based on element type
                let style = 'normal';
                if (element.tagName.match(/^H[1-6]$/)) {
                    style = 'heading';
                } else if (element.tagName === 'LI') {
                    style = 'list';
                }
                
                textContent.push({
                    text: text,
                    style: style,
                    tag: element.tagName.toLowerCase()
                });
            }
        });
        
        // If no structured content found, fall back to plain text
        if (textContent.length === 0) {
            const plainText = tempDiv.textContent.trim();
            if (plainText) {
                textContent.push({
                    text: plainText,
                    style: 'normal',
                    tag: 'p'
                });
            }
        }
        
        return textContent;
    }

    async addTextToPDF(pdfDoc, textContent, fileName) {
        // Load rgb function
        const rgbColor = await loadRgb();
        
        if (textContent.length === 0) {
            // Add a page with a message if no content
            const page = pdfDoc.addPage([612, 792]); // Standard letter size
            page.drawText('No readable content found in the Word document.', {
                x: 50,
                y: 750,
                size: 12,
                color: rgbColor(0, 0, 0)
            });
            return;
        }

        // Page settings
        const pageWidth = 612;
        const pageHeight = 792;
        const margin = 50;
        const maxWidth = pageWidth - (margin * 2);
        
        let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
        let yPosition = pageHeight - margin;
        
        // Add title
        const title = fileName.replace(/\.(docx?)$/i, '');
        currentPage.drawText(title, {
            x: margin,
            y: yPosition,
            size: 16,
            color: rgbColor(0, 0, 0)
        });
        yPosition -= 40;
        
        // Add content
        for (const item of textContent) {
            const fontSize = this.getFontSize(item.style);
            const lineHeight = fontSize + 4;
            
            // Split text into lines that fit the page width
            const lines = this.wrapText(item.text, maxWidth, fontSize);
            
            for (const line of lines) {
                // Check if we need a new page
                if (yPosition < margin + lineHeight) {
                    currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
                    yPosition = pageHeight - margin;
                }
                
                // Draw the line
                currentPage.drawText(line, {
                    x: margin,
                    y: yPosition,
                    size: fontSize,
                    color: rgbColor(0, 0, 0)
                });
                
                yPosition -= lineHeight;
            }
            
            // Add extra spacing after paragraphs
            yPosition -= 5;
        }
    }

    getFontSize(style) {
        switch (style) {
            case 'heading':
                return 14;
            case 'list':
                return 11;
            default:
                return 12;
        }
    }

    wrapText(text, maxWidth, fontSize) {
        // Simple text wrapping - estimate character width
        const avgCharWidth = fontSize * 0.6; // Rough estimate
        const maxCharsPerLine = Math.floor(maxWidth / avgCharWidth);
        
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';
        
        for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            
            if (testLine.length <= maxCharsPerLine) {
                currentLine = testLine;
            } else {
                if (currentLine) {
                    lines.push(currentLine);
                    currentLine = word;
                } else {
                    // Word is too long, split it
                    lines.push(word.substring(0, maxCharsPerLine));
                    currentLine = word.substring(maxCharsPerLine);
                }
            }
        }
        
        if (currentLine) {
            lines.push(currentLine);
        }
        
        return lines;
    }

    async validateWordFile(file) {
        try {
            // Check file extension
            if (!file.name.toLowerCase().endsWith('.docx')) {
                return false;
            }
            
            // Try to read the file as a Word document
            const arrayBuffer = await this.fileToArrayBuffer(file);
            const mammoth = await import('mammoth');
            
            // Attempt to extract content (this will throw if not a valid Word file)
            await mammoth.extractRawText({ arrayBuffer });
            
            return true;
        } catch (error) {
            console.warn('Word file validation failed:', error);
            return false;
        }
    }

    async fileToArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = () => {
                resolve(reader.result);
            };
            
            reader.onerror = () => {
                reject(new Error(`Failed to read file: ${file.name}`));
            };
            
            reader.readAsArrayBuffer(file);
        });
    }

    updateProgress(percentage, message) {
        this.onProgress({
            percentage: Math.round(percentage),
            message: message
        });
    }

    setProgressCallback(callback) {
        this.onProgress = callback || (() => {});
    }

    getIsProcessing() {
        return this.isProcessing;
    }

    cancel() {
        this.isProcessing = false;
    }

    generatePDFFilename(wordFileName) {
        return wordFileName.replace(/\.(docx?)$/i, '.pdf');
    }
}