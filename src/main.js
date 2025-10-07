// Main application entry point
import { AppController } from './components/AppController.js';

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new AppController();
    app.init();
});

// Handle browser compatibility
if (!window.File || !window.FileReader || !window.FileList || !window.Blob) {
    document.body.innerHTML = `
        <div style="text-align: center; padding: 2rem; font-family: sans-serif;">
            <h1>Browser Not Supported</h1>
            <p>This application requires a modern browser with File API support.</p>
            <p>Please update your browser or try a different one.</p>
        </div>
    `;
}