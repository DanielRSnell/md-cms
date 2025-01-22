export class MonacoEditor {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.editor = null;
    this.options = {
      language: 'markdown',
      theme: 'vs-dark',
      minimap: { enabled: false },
      fontSize: 14,
      wordWrap: 'on',
      lineNumbers: 'on',
      renderWhitespace: 'boundary',
      scrollBeyondLastLine: false,
      automaticLayout: true,
      tabSize: 2,
      ...options
    };
  }

  async init() {
    await this.waitForMonaco();
    this.editor = monaco.editor.create(this.container, this.options);
    return this.editor;
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

  getValue() {
    return this.editor?.getValue() || '';
  }

  setValue(value) {
    this.editor?.setValue(value || '');
  }

  updateOptions(options) {
    this.editor?.updateOptions(options);
  }

  layout() {
    this.editor?.layout();
  }

  focus() {
    this.editor?.focus();
  }

  addCommand(keybinding, handler) {
    this.editor?.addCommand(keybinding, handler);
  }

  onDidChangeModelContent(handler) {
    return this.editor?.onDidChangeModelContent(handler);
  }

  dispose() {
    this.editor?.dispose();
  }
}
