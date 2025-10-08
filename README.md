# PDF Utility Tool

> **[Try the tool live here!](https://reecebuckle.github.io/pdf-utilities/)**

A privacy-focused, client-side PDF utility tool for merging and splitting PDF files directly in your browser.

## Features

- **Merge PDFs**: Combine multiple PDF files into a single document
- **Split PDFs**: Extract specific page ranges or split into individual pages
- **Privacy First**: All processing happens in your browser - no files are uploaded to any server
- **Free & Open Source**: No costs, no accounts, no tracking
- **Mobile Friendly**: Works on desktop and mobile devices
- **Drag & Drop**: Easy file management with reordering support

## How It Works

### Merge PDFs
1. Select the "Merge PDFs" tool
2. Upload or drag-and-drop your PDF files
3. Reorder them as needed
4. Click "Merge PDFs" and download your combined PDF

### Split PDFs
1. Select the "Split PDF" tool
2. Upload a single PDF file
3. Choose to split by page ranges (e.g., 1-5, 8-10) or into individual pages
4. Download your split PDF files

All processing happens entirely in your browser using client-side JavaScript. Your documents never leave your device.

## Development

This project uses Vite for development and building.

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Deployment

The app automatically deploys to GitHub Pages when changes are pushed to the main branch.

## Privacy & Security

- **No server-side processing**: Everything runs in your browser
- **No data storage**: Files are processed in memory and immediately discarded
- **No tracking**: No analytics or user data collection
- **Open source**: Full transparency of how your data is handled

## Browser Support

Works on modern browsers that support:
- File API
- Drag and Drop API
- ES6+ JavaScript features

## License

MIT License - see LICENSE file for details
