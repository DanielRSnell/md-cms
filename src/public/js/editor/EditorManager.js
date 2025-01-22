import { MonacoEditor } from './components/MonacoEditor.js';
import { Preview } from './components/Preview.js';
import { FileBrowser } from './components/FileBrowser.js';
import { Toast } from './components/Toast.js';

export class EditorManager {
  constructor() {
    this.currentFile = null;
    this.setupDOMElements();
    this.setupEditors();
    this.setupComponents();
    this.setupEventListeners();
  }

  setupDOMElements() {
    this.editorContainer = document.getElementById('editor-container');
    this.welcomeScreen = document.getElementById('welcome-screen');
    this.saveBtn = document.getElementById('save-btn');
    this.previewElement = document.getElementById('preview');
    this.currentTab = 'markdown';
  }

  async setupEditors() {
    // Markdown Editor
    this.markdownEditor = new MonacoEditor('markdown-editor', {
      language: 'markdown',
      rulers: [80],
      quickSuggestions: {
        other: true,
        comments: true,
        strings: true
      }
    });

    // Front Matter Editor
    this.frontMatterEditor = new MonacoEditor('frontmatter-editor', {
      language: 'json',
      formatOnPaste: true,
      formatOnType: true,
      quickSuggestions: {
        other: true,
        comments: true,
        strings: true
      }
    });

    await Promise.all([
      this.markdownEditor.init(),
      this.frontMatterEditor.init()
    ]);

    this.setupEditorCommands();
  }

  setupComponents() {
    this.preview = new Preview(this.previewElement);
    this.fileBrowser = new FileBrowser(
      document.getElementById('file-browser'),
      (path) => this.loadFile(path)
    );
  }

  setupEventListeners() {
    this.saveBtn?.addEventListener('click', () => this.saveFile());

    window.addEventListener('resize', () => {
      this.markdownEditor.layout();
      this.frontMatterEditor.layout();
    });

    document.addEventListener('theme-change', () => {
      this.updateEditorTheme();
    });

    document.querySelectorAll('[data-tab]').forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        this.switchTab(tab.dataset.tab);
      });
    });

    this.markdownEditor.onDidChangeModelContent(() => {
      this.updatePreview();
    });

    this.frontMatterEditor.onDidChangeModelContent(() => {
      this.validateFrontMatter();
    });
  }

  setupEditorCommands() {
    const saveCommand = monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS;
    this.markdownEditor.addCommand(saveCommand, () => this.saveFile());
    this.frontMatterEditor.addCommand(saveCommand, () => this.saveFile());
    this.frontMatterEditor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.KeyF, () => {
      this.formatFrontMatter();
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

    document.getElementById('frontmatter-editor').style.display = 
      tab === 'frontmatter' ? 'block' : 'none';
    document.getElementById('markdown-editor').style.display = 
      tab === 'markdown' ? 'block' : 'none';

    if (tab === 'frontmatter') {
      this.frontMatterEditor.focus();
      this.frontMatterEditor.layout();
    } else {
      this.markdownEditor.focus();
      this.markdownEditor.layout();
    }
  }

  updateEditorTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const theme = isDark ? 'custom-dark' : 'vs';
    
    this.markdownEditor.updateOptions({ theme });
    this.frontMatterEditor.updateOptions({ theme });
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
      
      this.welcomeScreen.style.display = 'none';
      this.editorContainer.style.display = 'flex';

      this.markdownEditor.setValue(content || '');
      this.frontMatterEditor.setValue(JSON.stringify(frontMatter || {}, null, 2));
      
      monaco.editor.getModels().forEach(model => {
        monaco.editor.setModelMarkers(model, 'owner', []);
      });
      
      this.switchTab('markdown');
      this.updatePreview();
      
      await this.fileBrowser.loadContents(this.fileBrowser.currentPath);
    } catch (error) {
      console.error('Error loading file:', error);
      Toast.show(error.message, 'error');
    }
  }

  updatePreview() {
    if (this.currentFile) {
      const content = this.markdownEditor.getValue();
      const basePath = this.currentFile.path.split('/').slice(0, -1).join('/');
      this.preview.update(content, basePath);
    }
  }

  validateFrontMatter() {
    try {
      const model = this.frontMatterEditor.editor.getModel();
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
      Toast.show('Front matter formatted', 'success');
    } catch (e) {
      Toast.show('Invalid JSON in front matter', 'error');
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
        Toast.show('File saved successfully', 'success');
        
        monaco.editor.getModels().forEach(model => {
          monaco.editor.setModelMarkers(model, 'owner', []);
        });
      }
    } catch (error) {
      console.error('Error saving file:', error);
      Toast.show(error.message, 'error');
    } finally {
      this.saveBtn.disabled = false;
      this.saveBtn.innerHTML = originalText;
    }
  }

  resetEditor() {
    this.currentFile = null;
    this.welcomeScreen.style.display = 'flex';
    this.editorContainer.style.display = 'none';
    this.markdownEditor.setValue('');
    this.frontMatterEditor.setValue('{\n  \n}');
    this.preview.clear();
  }
}
