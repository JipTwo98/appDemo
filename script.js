// Task Templates
const taskTemplates = {
    getElement: {
        english: "Select the element with the ID ____ and store it in a variable named ____",
        javascript: "let {variableName} = document.getElementById('{elementId}');",
        blanks: ['elementId', 'variableName']
    },
    querySelector: {
        english: "Attach the event listener to the ____ element to call the ____ function.",
        javascript: "{className}.addEventListener('click', {variableName});",
        blanks: ['className', 'variableName']
    },
    toggleMenu: {
        english: "Add a click event listener to toggle menu visibility for element ID ____.",
        javascript: "document.getElementById('{elementId}').addEventListener('click', () => {\n    document.querySelector('.menu').classList.toggle('active');\n});",
        blanks: ['elementId']
    },
    hamburgerToggle: {
        english: "Create a function named ____ that toggles the class ____ for the selected element ____.",
        javascript: "function {functionName}() {\n    {varName}.classList.toggle('{className}');\n}",
        blanks: ['functionName', 'className', 'varName']
    }
};

// Utility Functions
const utils = {
    debounce(fn, delay) {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => fn(...args), delay);
        };
    },

    validateInput(value, type) {
        const patterns = {
            elementId: /^[a-zA-Z][a-zA-Z0-9_-]*$/,
            variableName: /^[a-zA-Z_$][a-zA-Z0-9_$]*$/,
            className: /^[a-zA-Z][a-zA-Z0-9_-]*$/,
            varName: /^[a-zA-Z][a-zA-Z0-9_-]*$/,
            functionName: /^[a-zA-Z_$][a-zA-Z0-9_$]*$/
        };

        if (!value) return { valid: false, message: 'This field is required' };
        if (value.length > 30) return { valid: false, message: 'Maximum length is 30 characters' };
        if (!patterns[type]?.test(value)) {
            return { 
                valid: false, 
                message: 'Invalid format. Use letters, numbers, and underscores' 
            };
        }

        return { valid: true };
    },

    sanitizeHTML(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Task Manager Class
class TaskManager {
    constructor() {
        this.tasks = [];
        this.values = {};
        this.history = {
            english: { undo: [], redo: [] },
            javascript: { undo: [], redo: [] }
        };
        this.maxHistorySize = 50;
        this.loadState();
    }

    saveState() {
        return {
            tasks: [...this.tasks],
            values: JSON.parse(JSON.stringify(this.values))
        };
    }

    loadState() {
        try {
            const savedState = localStorage.getItem('domAssistantState');
            if (savedState) {
                const { tasks, values } = JSON.parse(savedState);
                this.tasks = tasks;
                this.values = values;
                this.updateAll();
            }
        } catch (error) {
            console.error('Error loading saved state:', error);
            uiManager.showFeedback('Error loading saved state', 'error');
        }
    }

    saveToLocalStorage() {
        try {
            localStorage.setItem('domAssistantState', JSON.stringify({
                tasks: this.tasks,
                values: this.values
            }));
        } catch (error) {
            console.error('Error saving state:', error);
            uiManager.showFeedback('Error saving state', 'error');
        }
    }

    addTask(taskName) {
        const taskId = `task-${Date.now()}`;
        this.pushToHistory('english');
        this.tasks.push({ id: taskId, type: taskName });
        this.updateAll();
        this.saveToLocalStorage();
        uiManager.scrollToBottom();
    }

    pushToHistory(side) {
        if (this.history[side].undo.length >= this.maxHistorySize) {
            this.history[side].undo.shift();
        }
        this.history[side].undo.push(this.saveState());
        this.history[side].redo = [];
    }

    undoLast(side) {
        if (this.history[side].undo.length > 0) {
            const currentState = this.saveState();
            this.history[side].redo.push(currentState);
            const previousState = this.history[side].undo.pop();
            this.restoreState(previousState);
            this.saveToLocalStorage();
        }
    }

    redoLast(side) {
        if (this.history[side].redo.length > 0) {
            const currentState = this.saveState();
            this.history[side].undo.push(currentState);
            const nextState = this.history[side].redo.pop();
            this.restoreState(nextState);
            this.saveToLocalStorage();
        }
    }

    restoreState(state) {
        this.tasks = [...state.tasks];
        this.values = JSON.parse(JSON.stringify(state.values));
        this.updateAll();
    }

    updateAll() {
        const englishContent = document.getElementById('englishContent');
        englishContent.innerHTML = '';
        this.tasks.forEach(task => {
            englishContent.appendChild(this.createInstructionGroup(task));
        });
        this.updateCode();
    }

    createInstructionGroup(task) {
        const group = document.createElement('div');
        group.className = 'instruction';
        
        let parts = taskTemplates[task.type].english.split('____');
        const blanks = taskTemplates[task.type].blanks;
        
        parts.forEach((part, i) => {
            group.appendChild(document.createTextNode(part));
            if (i < blanks.length) {
                const input = this.createBlankInput(task.id, blanks[i]);
                group.appendChild(input);
            }
        });
        
        return group;
    }

    createBlankInput(taskId, blank) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'blank-input';
        input.placeholder = blank;
        input.dataset.taskId = taskId;
        input.dataset.blank = blank;
        input.setAttribute('aria-label', `Enter ${blank}`);
        
        if (this.values[taskId]?.[blank]) {
            input.value = this.values[taskId][blank];
        }
        
        const debouncedUpdate = utils.debounce((value) => {
            const validation = utils.validateInput(value, blank);
            
            if (validation.valid) {
                if (!this.values[taskId]) {
                    this.values[taskId] = {};
                }
                this.values[taskId][blank] = value;
                this.updateCode();
                this.saveToLocalStorage();
                input.setAttribute('aria-invalid', 'false');
            } else {
                uiManager.showError(input, validation.message);
                input.setAttribute('aria-invalid', 'true');
            }
        }, 300);
        
        input.addEventListener('input', (e) => debouncedUpdate(e.target.value));
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.target.blur();
            }
        });
        
        return input;
    }

    updateCode() {
        const codeDisplay = document.querySelector('.code-display');
        const fragment = document.createDocumentFragment();
        
        this.tasks.forEach((task, index) => {
            const code = this.generateCode(task);
            const codeElement = document.createElement('div');
            codeElement.innerHTML = code;
            
            if (index > 0) {
                const spacing = document.createElement('div');
                spacing.innerHTML = '\n';
                fragment.appendChild(spacing);
            }
            
            fragment.appendChild(codeElement);
        });
        
        codeDisplay.innerHTML = '';
        codeDisplay.appendChild(fragment);
    }

    generateCode(task) {
        let template = taskTemplates[task.type].javascript;
        const blanks = taskTemplates[task.type].blanks;
        
        blanks.forEach(blank => {
            const value = this.values[task.id]?.[blank] || '____';
            const sanitizedValue = utils.sanitizeHTML(value);
            template = template.replace(
                `{${blank}}`,
                value === '____' ? value : `<span class="code-filled">${sanitizedValue}</span>`
            );
        });
        
        return template;
    }

    clearAll() {
        if (confirm('Are you sure you want to clear all tasks? This action cannot be undone.')) {
            this.tasks = [];
            this.values = {};
            this.history = {
                english: { undo: [], redo: [] },
                javascript: { undo: [], redo: [] }
            };
            this.updateAll();
            this.saveToLocalStorage();
            uiManager.showFeedback('All tasks cleared', 'success');
        }
    }
}

// UI Manager Class
class UIManager {
    constructor() {
        this.theme = localStorage.getItem('theme') || 'light';
        this.applyTheme();
        this.setupKeyboardNavigation();
    }

    setupKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'z') {
                    e.preventDefault();
                    if (e.shiftKey) {
                        taskManager.redoLast('english');
                    } else {
                        taskManager.undoLast('english');
                    }
                }
            }
        });
    }

    toggleTheme() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        this.applyTheme();
        localStorage.setItem('theme', this.theme);
    }

    applyTheme() {
        document.body.setAttribute('data-theme', this.theme);
    }

    async copyContent(type) {
        const content = type === 'english' 
            ? document.getElementById('englishContent').textContent
            : document.querySelector('.code-display').textContent;
        
        try {
            await navigator.clipboard.writeText(content);
            this.showFeedback('Copied to clipboard!', 'success');
        } catch (error) {
            console.error('Copy failed:', error);
            this.showFeedback('Failed to copy to clipboard', 'error');
        }
    }

    showFeedback(message, type = 'success') {
        const feedback = document.createElement('div');
        feedback.className = `feedback-message ${type}`;
        feedback.textContent = message;
        feedback.setAttribute('role', 'alert');
        
        document.body.appendChild(feedback);
        setTimeout(() => feedback.remove(), 3000);
    }

    showError(input, message) {
        let errorDiv = input.nextElementSibling;
        if (!errorDiv || !errorDiv.classList.contains('error-message')) {
            errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            input.parentNode.insertBefore(errorDiv, input.nextSibling);
        }
        errorDiv.textContent = message;
        setTimeout(() => errorDiv.remove(), 3000);
    }

    scrollToBottom() {
        const areas = document.querySelectorAll('.content-area');
        areas.forEach(area => {
            area.scrollTop = area.scrollHeight;
        });
    }
}

// Initialize managers
const taskManager = new TaskManager();
const uiManager = new UIManager();

// Error handling
window.onerror = function(message, source, lineno, colno, error) {
    console.error('Global error:', error);
    uiManager.showFeedback('An error occurred. Please try refreshing the page.', 'error');
    return false;
};