class FileEditor {
  constructor() {
    this.currentPath = '';
    this.currentFile = null;
    this.editor = document.getElementById('editor-container');
    this.fileBrowser = document.getElementById('file-browser');
    this.welcomeScreen = document.getElementById('welcome-screen');
    this.contentArea = document.getElementById('content');
    this.frontMatterArea = document.getElementById('frontmatter');
    this.preview = document.getElementById('preview');
    this.saveBtn = document.getElementById('save-btn');
    this.formatBtn = document.getElementById('format-btn');
    
    marked.setOptions({
      breaks: true,
      gfm: true,
      headerIds: true,
      mangle: false,
      pedantic: false,
      sanitize: false,
      smartLists: true,
      smartypants: true
    });

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadContents();
  }

  setupEventListeners() {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        this.saveFile();
      }
    });

    if (this.formatBtn) {
      this.formatBtn.addEventListener('click', () => this.formatContent());
    }

    if (this.saveBtn) {
      this.saveBtn.addEventListener('click', () => this.saveFile());
    }

    if (this.contentArea) {
      this.contentArea.addEventListener('input', () => this.updatePreview());
      this.contentArea.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
          e.preventDefault();
          const start = this.contentArea.selectionStart;
          const end = this.contentArea.selectionEnd;
          this.contentArea.value = this.contentArea.value.substring(0, start) + '  ' + 
                                 this.contentArea.value.substring(end);
          this.contentArea.selectionStart = this.contentArea.selectionEnd = start + 2;
        }
      });
    }

    if (this.frontMatterArea) {
      this.frontMatterArea.addEventListener('input', () => this.updatePreview());
    }
  }

  async loadContents(path = '') {
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
      <div class="flex items-center justify-center h-40">
        <div class="loading loading-spinner loading-lg"></div>
      </div>
    `;
  }

  renderFileTree(contents, path) {
    const items = contents
      .sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'dir' ? -1 : 1;
      })
      .map(item => this.renderFileItem(item))
      .join('');

    return `
      ${path ? this.renderBackButton(path) : ''}
      <div class="space-y-1">
        ${items}
      </div>
    `;
  }

  renderFileItem(item) {
    const relativePath = window.contentDirectory ? 
      item.path.replace(`${window.contentDirectory}/`, '') : 
      item.path;

    if (item.type === 'dir') {
      return `
        <div class="file-item" onclick="fileEditor.loadContents('${relativePath}')">
          <svg class="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <span class="flex-1">${item.name}</span>
        </div>
      `;
    }

    if (item.name.endsWith('.md') || item.name.endsWith('.mdx')) {
      const isMDX = item.name.endsWith('.mdx');
      return `
        <div class="file-item" onclick="fileEditor.loadFile('${relativePath}')">
          <svg class="w-4 h-4 ${isMDX ? 'text-primary' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span class="flex-1">${item.name}</span>
          <span class="badge badge-sm ${isMDX ? 'badge-primary' : 'badge-ghost'}">
            ${isMDX ? 'MDX' : 'MD'}
          </span>
        </div>
      `;
    }

    return '';
  }

  renderBackButton(path) {
    let parentPath = path.split('/').slice(0, -1).join('/');
    
    if (window.contentDirectory && path === window.contentDirectory) {
      parentPath = '';
    }
    
    return `
      <div class="file-item mb-2" onclick="fileEditor.loadContents('${parentPath}')">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
        </svg>
        Back
      </div>
      <div class="divider my-2"></div>
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
      
      this.welcomeScreen.classList.add('hidden');
      this.editor.classList.remove('hidden');

      this.contentArea.value = content || '';
      this.frontMatterArea.value = JSON.stringify(frontMatter || {}, null, 2);
      
      this.updatePreview();
    } catch (error) {
      console.error('Error loading file:', error);
      this.showToast(error.message, 'error');
      
      this.welcomeScreen.classList.remove('hidden');
      this.editor.classList.add('hidden');
    }
  }

  updatePreview() {
    if (this.preview && this.contentArea) {
      this.preview.innerHTML = marked.parse(this.contentArea.value || '');
    }
  }

  formatContent() {
    try {
      if (this.frontMatterArea) {
        const frontMatter = JSON.parse(this.frontMatterArea.value);
        this.frontMatterArea.value = JSON.stringify(frontMatter, null, 2);
        this.showToast('Front matter formatted', 'success');
      }
    } catch (error) {
      this.showToast('Invalid JSON in front matter', 'error');
    }
  }

  async saveFile() {
    if (!this.currentFile) return;

    const originalText = this.saveBtn.innerHTML;
    this.saveBtn.innerHTML = '<span class="loading loading-spinner loading-sm"></span> Saving...';
    this.saveBtn.disabled = true;

    try {
      let frontMatter = {};
      try {
        frontMatter = JSON.parse(this.frontMatterArea.value);
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
          content: this.contentArea.value,
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

window.fileEditor = new FileEditor();
