/* 家庭管理系统 - UI 辅助 */
const UI = (function() {
  let toastEl = null;
  let modalEl = null;

  function ensureShell() {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      document.body.appendChild(toastEl);
    }
    if (!modalEl) {
      modalEl = document.createElement('div');
      modalEl.className = 'modal-mask';
      modalEl.addEventListener('click', function(e) {
        if (e.target === modalEl) closeModal();
      });
      document.body.appendChild(modalEl);
    }
  }

  function toast(msg, ms) {
    ensureShell();
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(function() { toastEl.classList.remove('show'); }, ms || 2200);
  }

  function openModal(html) {
    ensureShell();
    modalEl.innerHTML = '<div class="modal">' + html + '</div>';
    modalEl.classList.add('show');
  }

  function closeModal() {
    if (modalEl) modalEl.classList.remove('show');
  }

  /* 日期工具 */
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function addDays(str, n) {
    const d = new Date(str + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function fmtDate(str) {
    if (!str) return '';
    const p = str.split('-');
    return p[1] + '月' + p[2] + '日';
  }
  function fmtCn(str) {
    if (!str) return '';
    const d = new Date(str + 'T00:00:00');
    const wk = ['周日','周一','周二','周三','周四','周五','周六'];
    return fmtDate(str) + ' ' + wk[d.getDay()];
  }
  function daysUntil(str) {
    const a = new Date(str + 'T00:00:00');
    const b = new Date(todayStr() + 'T00:00:00');
    return Math.round((a - b) / 86400000);
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  /* 成员辅助 */
  async function membersMap() {
    const list = await DB.getAll('members');
    const m = {};
    list.forEach(function(x) { m[x.id] = x; });
    return m;
  }
  function av(role, name) {
    const map = { '爸爸':'pa','妈妈':'ma','孩子':'ki','老人':'gr','其他':'de' };
    const cls = map[role] || 'de';
    const label = (name || '?').slice(0, 1);
    return '<span class="av ' + cls + '">' + esc(label) + '</span>';
  }
  function roleName(role) { return role || '其他'; }

  return {
    toast: toast, openModal: openModal, closeModal: closeModal,
    todayStr: todayStr, addDays: addDays, fmtDate: fmtDate, fmtCn: fmtCn,
    daysUntil: daysUntil, esc: esc, membersMap: membersMap, av: av, roleName: roleName
  };
})();
