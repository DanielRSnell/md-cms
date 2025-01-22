import { EditorManager } from './EditorManager.js';

function initializeEditor() {
  if (window.marked && window.monaco) {
    window.fileEditor = new EditorManager();
  } else {
    setTimeout(initializeEditor, 100);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeEditor);
} else {
  initializeEditor();
}
