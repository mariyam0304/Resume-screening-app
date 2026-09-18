const Toast = {
  show(message, type = 'info', timeout = 3200) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(30px)';
      el.style.transition = 'all 0.25s ease';
      setTimeout(() => el.remove(), 250);
    }, timeout);
  },
  success(msg) { this.show(msg, 'success'); },
  error(msg) { this.show(msg, 'error'); },
  warn(msg) { this.show(msg, 'warning'); },
  info(msg) { this.show(msg, 'info'); },
};
