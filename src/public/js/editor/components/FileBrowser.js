export class FileBrowser {
  constructor(container, onFileSelect) {
    this.container = container;
    this.currentPath = '';
    this.onFileSelect = onFileSelect;
  }

  async loadContents(path = '') {
    this.container.innerHTML = this.renderLoading();

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
        this.container.innerHTML = this.renderFileTree(contents, path);
      }
    } catch (error) {
      console.error('Error loading contents:', error);
      this.container.innerHTML = this.renderError('Failed to load repository contents', error.message);
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
      <button class="back-button" onclick="fileBrowser.loadContents('${path}')">
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
        <div class="file-item" onclick="fileBrowser.loadContents('${relativePath}')">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
          </svg>
          <span class="file-name">${item.name}</span>
        </div>
      `;
    }

    const isMDX = item.name.endsWith('.mdx');
    return `
      <div class="file-item ${window.fileEditor?.currentFile?.path === item.path ? 'active' : ''}" 
           onclick="fileBrowser.onFileSelect('${relativePath}')">
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
}
