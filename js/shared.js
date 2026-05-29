window.escapeHtml = function(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
};

window.showToast = function(msg) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._hide);
  el._hide = setTimeout(() => el.classList.remove('show'), 2000);
};
