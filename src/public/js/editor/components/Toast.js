export class Toast {
  static show(message, type = 'info') {
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
