class FileEditor {
  constructor() {
    this.currentPath = '';
    this.currentFile = null;
    this.editor = document.getElementById('editor-container');
    this.fileBrowser = document.getElementById('file-browser');
    this.welcomeScreen = document.getElementById('welcome-screen');
    this.preview = document.getElementById('preview');
    this.saveBtn = document.getElementById('save-btn');
    this.currentTab = 'markdown';
    this.markdownEditor = null;
    this.frontMatterEditor = null;
    this.editorTheme = 'vs-dark';
    this.isInitialized = false;
    this.marked = window.marked;
  }

  async init() {
    try {
      if (!this.marked) {
        throw new Error('Marked.js not loaded');
      }
      
      await this.waitForMonaco();
      await this.initializeMonaco();
      this.setupEventListeners();
      this.setupTabSystem();
      this.isInitialized = true;
      await this.loadContents();
    } catch (error) {
      console.error('Failed to initialize editor:', error);
      this.showToast('Failed to initialize editor', 'error');
    }
  }

  waitForMonaco() {
    return new Promise((resolve) => {
      if (window.monaco) {
        resolve();
      } else {
        const checkMonaco = setInterval(() => {
          if (window.monaco) {
            clearInterval(checkMonaco);
            resolve();
          }
        }, 100);
      }
    });
  }

  async initializeMonaco() {
    monaco.editor.defineTheme('custom-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#1a1b1e',
        'editor.foreground': '#d4d4d4',
        'editor.lineHighlightBackground': '#2f3033',
        'editor.selectionBackground': '#264f78',
        'editor.inactiveSelectionBackground': '#3a3d41'
      }
    });

    this.markdownEditor = monaco.editor.create(document.getElementById('markdown-editor'), {
      value: '',
      language: 'markdown',
      theme: this.editorTheme,
      minimap: { enabled: false },
      fontSize: 14,
      wordWrap: 'on',
      lineNumbers: 'on',
      renderWhitespace: 'boundary',
      scrollBeyondLastLine: false,
      automaticLayout: true,
      tabSize: 2,
      rulers: [80],
      quickSuggestions: {
        other: true,
        comments: true,
        strings: true
      },
      suggestOnTriggerCharacters: true,
      wordBasedSuggestions: true,
      lineDecorationsWidth: 5,
      lineNumbersMinChars: 3,
      bracketPairColorization: {
        enabled: true
      },
      padding: {
        top: 10
      }
    });

    this.frontMatterEditor = monaco.editor.create(document.getElementById('frontmatter-editor'), {
      value: '{\n  \n}',
      language: 'json',
      theme: this.editorTheme,
      minimap: { enabled: false },
      fontSize: 14,
      wordWrap: 'on',
      lineNumbers: 'on',
      renderWhitespace: 'boundary',
      scrollBeyondLastLine: false,
      automaticLayout: true,
      tabSize: 2,
      formatOnPaste: true,
      formatOnType: true,
      padding: {
        top: 10
      },
      quickSuggestions: {
        other: true,
        comments: true,
        strings: true
      },
      bracketPairColorization: {
        enabled: true
      }
    });

    this.markdownEditor.onDidChangeModelContent(() => {
      this.updatePreview();
    });

    this.frontMatterEditor.onDidChangeModelContent(() => {
      this.validateFrontMatter();
    });

    this.markdownEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      this.saveFile();
    });

    this.frontMatterEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      this.saveFile();
    });

    this.frontMatterEditor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.KeyF, () => {
      this.formatFrontMatter();
    });
  }

  setupEventListeners() {
    if (this.saveBtn) {
      this.saveBtn.addEventListener('click', () => this.saveFile());
    }

    window.addEventListener('resize', () => {
      if (this.markdownEditor) {
        this.markdownEditor.layout();
      }
      if (this.frontMatterEditor) {
        this.frontMatterEditor.layout();
      }
    });

    document.addEventListener('theme-change', () => {
      this.updateEditorTheme();
    });
  }

  setupTabSystem() {
    document.querySelectorAll('[data-tab]').forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        this.switchTab(tab.dataset.tab);
      });
    });
  }

  switchTab(tab) {
    this.currentTab = tab;
    
    document.querySelectorAll('.editor-tab').forEach(t => {
      t.classList.remove('active');
      if (t.dataset.tab === tab) {
        t.classList.add('active');
      }
    });

    document.getElementById('frontmatter-editor').style.display = tab === 'frontmatter' ? 'block' : 'none';
    document.getElementById('markdown-editor').style.display = tab === 'markdown' ? 'block' : 'none';

    if (tab === 'frontmatter' && this.frontMatterEditor) {
      this.frontMatterEditor.focus();
      this.frontMatterEditor.layout();
    } else if (this.markdownEditor) {
      this.markdownEditor.focus();
      this.markdownEditor.layout();
    }
  }

  validateFrontMatter() {
    try {
      const model = this.frontMatterEditor.getModel();
      const markers = [];
      
      try {
        JSON.parse(this.frontMatterEditor.getValue());
      } catch (e) {
        markers.push({
          severity: monaco.MarkerSeverity.Error,
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: model.getLineCount(),
          endColumn: model.getLineMaxColumn(model.getLineCount()),
          message: 'Invalid JSON: ' + e.message
        });
      }
      
      monaco.editor.setModelMarkers(model, 'owner', markers);
    } catch (e) {
      console.error('Error validating front matter:', e);
    }
  }

  formatFrontMatter() {
    try {
      const value = this.frontMatterEditor.getValue();
      const parsed = JSON.parse(value);
      const formatted = JSON.stringify(parsed, null, 2);
      this.frontMatterEditor.setValue(formatted);
      this.showToast('Front matter formatted', 'success');
    } catch (e) {
      this.showToast('Invalid JSON in front matter', 'error');
    }
  }

  updateEditorTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const theme = isDark ? 'custom-dark' : 'vs';
    
    if (this.markdownEditor && this.frontMatterEditor) {
      this.markdownEditor.updateOptions({ theme });
      this.frontMatterEditor.updateOptions({ theme });
    }
  }

  async loadContents(path = '') {
    if (!this.isInitialized) {
      await this.init();
    }

    this.fileBrowser.innerHTML = this.renderLoading();

    try {
      const [owner, repo] = window.selectedRepo.split('/');
      let fullPath = path;

      if (window.contentDirectory && !path.startsWith(window.contentDirectory)) {
        fullPath = path ? `${window.contentDirectory}/${path}` : window.contentDirectory;
      }

      const response = await fetch(`/github/files/contents/${owner}/${repo}/${fullPath}`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || error.error || 'Failed to load contents');
      }
      
      const contents = await response.json();
      
      if (Array.isArray(contents)) {
        this.currentPath = path;
        this.fileBrowser.innerHTML = this.renderFileTree(contents, path);
      }
    } catch (error) {
      console.error('Error loading contents:', error);
      this.fileBrowser.innerHTML = this.renderError('Failed to load repository contents', error.message);
    }
  }

  renderLoading() {
    return `
      <div class="loading-container">
        <div class="loading loading-spinner loading-sm"></div>
      </div>
    `;
  }

  renderFileTree(contents, path) {
    const items = contents
      .sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'dir' ? -1 : 1;
      })
      .reduce((acc, item) => {
        if (item.type === 'dir' || item.name.endsWith('.md') || item.name.endsWith('.mdx')) {
          acc.push(this.renderFileItem(item));
        }
        return acc;
      }, []);

    const parentPath = path.split('/').slice(0, -1).join('/');
    const showBack = path && (!window.contentDirectory || path !== window.contentDirectory);

    return `
      ${showBack ? this.renderBackButton(parentPath) : ''}
      ${path ? `<div class="directory-label">${path.split('/').pop()}</div>` : ''}
      <div class="space-y-0">
        ${items.join('')}
      </div>
    `;
  }

  renderBackButton(path) {
    return `
      <button class="back-button" onclick="fileEditor.loadContents('${path}')">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10l-4-4m0 0L7 10m4-4v9" />
        </svg>
        Back
      </button>
    `;
  }

  renderFileItem(item) {
    const relativePath = window.contentDirectory ? 
      item.path.replace(`${window.contentDirectory}/`, '') : 
      item.path;

    if (item.type === 'dir') {
      return `
        <div class="file-item" onclick="fileEditor.loadContents('${relativePath}')">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
          </svg>
          <span class="file-name">${item.name}</span>
        </div>
      `;
    }

    const isMDX = item.name.endsWith('.mdx');
    return `
      <div class="file-item ${this.currentFile?.path === item.path ? 'active' : ''}" 
           onclick="fileEditor.loadFile('${relativePath}')">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span class="file-name">${item.name}</span>
        ${isMDX ? '<span class="file-badge primary">MDX</span>' : ''}
      </div>
    `;
  }

  renderError(title, message, retryFn = null) {
    return `
      <div class="alert alert-error">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <h3 class="font-bold">${title}</h3>
          <div class="text-sm">${message}</div>
        </div>
        ${retryFn ? `<button onclick="${retryFn}" class="btn btn-sm">Retry</button>` : ''}
      </div>
    `;
  }

  async loadFile(path) {
    if (!this.isInitialized) {
      await this.init();
    }

    try {
      const [owner, repo] = window.selectedRepo.split('/');
      let fullPath = path;

      if (window.contentDirectory && !path.startsWith(window.contentDirectory)) {
        fullPath = `${window.contentDirectory}/${path}`;
      }

      const response = await fetch(`/github/files/file/${owner}/${repo}/${fullPath}`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || error.error || 'Failed to load file');
      }
      
      const { content, frontMatter, sha, type } = await response.json();
      this.currentFile = { path: fullPath, sha, type };
      
      this.welcomeScreen.style.display = 'none';
      this.editor.style.display = 'flex';

      this.markdownEditor.setValue(content || '');
      this.frontMatterEditor.setValue(JSON.stringify(frontMatter || {}, null, 2));
      
      monaco.editor.getModels().forEach(model => {
        monaco.editor.setModelMarkers(model, 'owner', []);
      });
      
      this.switchTab('markdown');
      this.updatePreview();
      
      await this.loadContents(this.currentPath);
    } catch (error) {
      console.error('Error loading file:', error);
      this.showToast(error.message, 'error');
    }
  }

  resetEditor() {
    this.currentFile = null;
    this.welcomeScreen.style.display = 'flex';
    this.editor.style.display = 'none';
    if (this.markdownEditor) {
      this.markdownEditor.setValue('');
    }
    if (this.frontMatterEditor) {
      this.frontMatterEditor.setValue('{\n  \n}');
    }
    if (this.preview) {
      this.preview.innerHTML = '';
    }
  }

  updatePreview() {
    if (this.preview && this.markdownEditor) {
      const content = this.markdownEditor.getValue() || '';
      const html = this.marked.parse(content);
      this.preview.innerHTML = html;
      
      this.preview.querySelectorAll('img').forEach(img => {
        if (img.src.startsWith('./') || img.src.startsWith('../')) {
          const basePath = this.currentFile.path.split('/').slice(0, -1).join('/');
          const absolutePath = new URL(img.src, `${window.location.origin}/${basePath}/`).href;
          img.src = absolutePath;
        }
      });
    }
  }

  async saveFile() {
    if (!this.currentFile || !this.isInitialized) return;

    const originalText = this.saveBtn.innerHTML;
    this.saveBtn.innerHTML = '<span class="loading loading-spinner loading-sm"></span> Saving...';
    this.saveBtn.disabled = true;

    try {
      let frontMatter = {};
      try {
        frontMatter = JSON.parse(this.frontMatterEditor.getValue());
      } catch (e) {
        throw new Error('Invalid JSON in front matter');
      }

      const response = await fetch('/github/files/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: this.currentFile.path,
          content: this.markdownEditor.getValue(),
          frontMatter,
          sha: this.currentFile.sha
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || error.error || 'Failed to save file');
      }

      const result = await response.json();
      if (result.success) {
        this.currentFile.sha = result.sha;
        this.showToast('File saved successfully', 'success');
        
        monaco.editor.getModels().forEach(model => {
          monaco.editor.setModelMarkers(model, 'owner', []);
        });
      }
    } catch (error) {
      console.error('Error saving file:', error);
      this.showToast(error.message, 'error');
    } finally {
      this.saveBtn.disabled = false;
      this.saveBtn.innerHTML = originalText;
    }
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `alert alert-${type} fixed bottom-4 right-4 w-auto max-w-sm z-50 shadow-lg`;
    toast.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>${message}</span>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.5s ease-out';
      setTimeout(() => toast.remove(), 500);
    }, 3000);
  }
}

function initializeEditor() {
  if (window.marked && window.monaco) {
    window.fileEditor = new FileEditor();
    window.fileEditor.init();
  } else {
    setTimeout(initializeEditor, 100);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeEditor);
} else {
  initializeEditor();
}
