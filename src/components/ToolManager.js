/**
 * ToolManager - Manages tool selection and switching
 */
export class ToolManager {
    constructor() {
        this.currentTool = 'merge';
        this.tools = {
            merge: document.getElementById('merge-tool'),
            split: document.getElementById('split-tool'),
            'word-convert': document.getElementById('word-convert-tool')
        };
        this.toolCards = document.querySelectorAll('.tool-card');
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.toolCards.forEach(card => {
            card.addEventListener('click', (e) => {
                const toolName = card.dataset.tool;
                
                // Don't switch to disabled tools
                if (card.classList.contains('disabled')) {
                    return;
                }
                
                this.switchTool(toolName);
            });
        });
    }

    switchTool(toolName) {
        if (toolName === this.currentTool) {
            return;
        }

        // Update active card
        this.toolCards.forEach(card => {
            card.classList.remove('active');
            if (card.dataset.tool === toolName) {
                card.classList.add('active');
            }
        });

        // Hide all tools
        Object.values(this.tools).forEach(tool => {
            if (tool) {
                tool.style.display = 'none';
            }
        });

        // Show selected tool
        if (this.tools[toolName]) {
            this.tools[toolName].style.display = 'block';
        }

        // Clear any existing state/results
        this.clearSharedSections();

        this.currentTool = toolName;

        // Trigger tool change event
        this.onToolChange(toolName);
    }

    clearSharedSections() {
        // Hide shared sections
        const sections = [
            'progress-section',
            'result-section', 
            'error-section'
        ];

        sections.forEach(sectionId => {
            const section = document.getElementById(sectionId);
            if (section) {
                section.style.display = 'none';
            }
        });

        // Clear result downloads
        const resultDownloads = document.getElementById('result-downloads');
        if (resultDownloads) {
            resultDownloads.innerHTML = '';
        }
    }

    getCurrentTool() {
        return this.currentTool;
    }

    onToolChange(toolName) {
        // Override this method to handle tool changes
        console.log(`Switched to tool: ${toolName}`);
    }

    enableTool(toolName) {
        const card = document.querySelector(`[data-tool="${toolName}"]`);
        if (card) {
            card.classList.remove('disabled');
        }
    }

    disableTool(toolName) {
        const card = document.querySelector(`[data-tool="${toolName}"]`);
        if (card) {
            card.classList.add('disabled');
        }
    }

    showToolSelection() {
        const toolSelection = document.getElementById('tool-selection');
        if (toolSelection) {
            toolSelection.style.display = 'block';
        }
    }

    hideToolSelection() {
        const toolSelection = document.getElementById('tool-selection');
        if (toolSelection) {
            toolSelection.style.display = 'none';
        }
    }
}