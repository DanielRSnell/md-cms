class FileEditor {
  constructor() {
    this.currentPath = '';
    this.currentFile = null;
    this.editor = document.getElementById('editor');
    this.fileBrowser = document.getElementById('file-browser');
    
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
  }

  async loadContents(path = '') {
    this.fileBrowser.innerHTML = this.renderLoading();

    try {
      const [owner, repo] = window.selectedRepo.split('/');
      const response = await fetch(`/github/files/contents/${owner}/${repo}/${path}`);
      
      if (!response.ok) {
        throw new Error(await response.text());
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
    if (item.type === 'dir') {
      return `
        <div class="cursor-pointer hover:bg-base-200 p-2 rounded flex items-center group" 
             onclick="fileEditor.loadContents('${item.path}')">
          <svg class="w-4 h-4 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <span class="flex-1">${item.name}</span>
          <span class="badge badge-sm badge-ghost opacity-0 group-hover:opacity-100">directory</span>
        </div>
      `;
    } else {
      const isMDX = item.fileType === 'mdx';
      return `
        <div class="cursor-pointer hover:bg-base-200 p-2 rounded flex items-center justify-between group" 
             onclick="fileEditor.loadFile('${item.path}')">
          <div class="flex items-center flex-1">
            <svg class="w-4 h-4 mr-2 ${isMDX ? 'text-primary' : 'text-base-content'}" 
                 fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            ${item.name}
          </div>
          <span class="badge badge-sm ${isMDX ? 'badge-primary' : 'badge-ghost'} opacity-0 group-hover:opacity-100">
            ${isMDX ? 'MDX' : 'MD'}
          </span>
        </div>
      `;
    }
  }

  renderBackButton(path) {
    const parentPath = path.split('/').slice(0, -1).join('/');
    return `
      <div class="cursor-pointer hover:bg-base-200 p-2 rounded flex items-center mb-2" 
           onclick="fileEditor.loadContents('${parentPath}')">
        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      <div class="alert alert-error shadow-lg">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" 
             fill="none" viewBox="0 0 24 24">
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
    this.editor.innerHTML = this.renderLoading();

    try {
      const response = await fetch(`/github/files/file?path=${path}&repo=${window.selectedRepo}`);
      
      if (!response.ok) {
        throw new Error(await response.text());
      }
      
      const { frontMatter, content, sha, type } = await response.json();
      this.currentFile = { path, sha, type };
      
      this.editor.innerHTML = this.renderEditor(path, frontMatter, content, type);
      this.updatePreview();
      this.setupEditorEventListeners();
    } catch (error) {
      console.error('Error loading file:', error);
      this.editor.innerHTML = this.renderError('Failed to load file', error.message);
    }
  }

  renderEditor(path, frontMatter, content, type) {
    return `
      <div class="space-y-4">
        <div class="flex justify-between items-center">
          <div class="flex items-center gap-2">
            <h3 class="font-bold">${path}</h3>
            <div class="badge badge-sm ${type === 'mdx' ? 'badge-primary' : 'badge-ghost'}">
              ${type === 'mdx' ? 'MDX' : 'MD'}
            </div>
          </div>
          <div class="flex gap-2">
            <button onclick="fileEditor.formatContent()" class="btn btn-ghost btn-sm">
              Format
            </button>
            <button onclick="fileEditor.saveFile()" class="btn btn-primary btn-sm gap-2" id="save-button">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                      d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              Save
            </button>
          </div>
        </div>
        
        <div class="divider">Front Matter</div>
        <div class="relative">
          <textarea 
            id="frontmatter" 
            class="textarea textarea-bordered w-full h-32 font-mono text-sm"
            spellcheck="false"
          >${JSON.stringify(frontMatter, null, 2)}</textarea>
          <div class="absolute top-2 right-2 text-xs opacity-50">JSON</div>
        </div>
        
        <div class="divider">Content</div>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div class="space-y-2">
            <div class="flex justify-between items-center">
              <label class="text-sm font-medium">Editor</label>
              <div class="text-xs opacity-50">Markdown</div>
            </div>
            <textarea 
              id="content" 
              class="textarea textarea-bordered w-full h-[500px] font-mono text-sm"
              spellcheck="false"
            >${content}</textarea>
          </div>
          <div class="space-y-2">
            <div class="flex justify-between items-center">
              <label class="text-sm font-medium">Preview</label>
              <div class="text-xs opacity-50">Rendered HTML</div>
            </div>
            <div id="preview" class="prose bg-base-200 p-4 rounded-lg overflow-auto h-[500px]"></div>
          </div>
        </div>
      </div>
    `;
  }

  setupEditorEventListeners() {
    const contentArea = document.getElementById('content');
    if (contentArea) {
      contentArea.addEventListener('input', () => this.updatePreview());
      contentArea.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
          e.preventDefault();
          const start = contentArea.selectionStart;
          const end = contentArea.selectionEnd;
          contentArea.value = contentArea.value.substring(0, start) + '  ' + contentArea.value.substring(end);
          contentArea.selectionStart = contentArea.selectionEnd = start + 2;
        }
      });
    }
  }

  updatePreview() {
    const content = document.getElementById('content').value;
    const preview = document.getElementById('preview');
    if (preview) {
      preview.innerHTML = marked.parse(content);
    }
  }

  formatContent() {
    try {
      const frontmatterArea = document.getElementById('frontmatter');
      const frontMatter = JSON.parse(frontmatterArea.value);
      frontmatterArea.value = JSON.stringify(frontMatter, null, 2);
    } catch (error) {
      console.error('Error formatting front matter:', error);
    }
  }

  async saveFile() {
    if (!this.currentFile) return;

    const saveButton = document.getElementById('save-button');
    const originalText = saveButton.innerHTML;
    saveButton.innerHTML = '<span class="loading loading-spinner loading-sm"></span> Saving...';
    saveButton.disabled = true;

    try {
      let frontMatter;
      try {
        frontMatter = JSON.parse(document.getElementById('frontmatter').value);
      } catch (e) {
        throw new Error('Invalid front matter JSON format');
      }

      const content = document.getElementById('content').value;

      const response = await fetch('/github/files/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: this.currentFile.path,
          frontMatter,
          content,
          sha: this.currentFile.sha
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || 'Failed to save file');
      }

      const result = await response.json();
      if (result.success) {
        this.currentFile.sha = result.sha;
        this.showSaveSuccess(saveButton);
      }
    } catch (error) {
      console.error('Error saving file:', error);
      this.showSaveError(saveButton, error.message);
    } finally {
      setTimeout(() => {
        saveButton.disabled = false;
        saveButton.innerHTML = originalText;
      }, 2000);
    }
  }

  showSaveSuccess(button) {
    button.innerHTML = `
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
      </svg>
      Saved!
    `;
    button.classList.remove('btn-error');
    button.classList.add('btn-success');
  }

  showSaveError(button, message) {
    button.innerHTML = `
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
      </svg>
      Error
    `;
    button.classList.remove('btn-success');
    button.classList.add('btn-error');
    alert(message || 'Error saving changes');
  }
}

// Initialize the editor
const fileEditor = new FileEditor();

// Export for use in other modules if needed
export default fileEditor;
