export class Preview {
  constructor(container) {
    this.container = container;
    this.marked = window.marked;
    this.setupMarked();
  }

  setupMarked() {
    this.marked.setOptions({
      breaks: true,
      gfm: true,
      headerIds: true,
      mangle: false,
      pedantic: false,
      sanitize: false,
      smartLists: true,
      smartypants: true
    });
  }

  update(content, basePath = '') {
    if (!content) {
      this.container.innerHTML = '';
      return;
    }

    const html = this.marked.parse(content);
    this.container.innerHTML = html;
    
    this.fixImagePaths(basePath);
  }

  fixImagePaths(basePath) {
    this.container.querySelectorAll('img').forEach(img => {
      if (img.src.startsWith('./') || img.src.startsWith('../')) {
        const absolutePath = new URL(img.src, `${window.location.origin}/${basePath}/`).href;
        img.src = absolutePath;
      }
    });
  }

  clear() {
    this.container.innerHTML = '';
  }
}
