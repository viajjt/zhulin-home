/* 家庭管理系统 - 应用入口 */
const App = (function() {
  const PAGES = [
    { id: 'home',  label: '首页',   ic: '🏠', page: HomePage },
    { id: 'trip',  label: '旅行',   ic: '✈️', page: TripPage },
    { id: 'cal',   label: '日程',   ic: '📅', page: CalPage },
    { id: 'stock', label: '库存',   ic: '📦', page: StockPage },
    { id: 'memo',  label: '纪念日', ic: '🎉', page: MemoPage },
    { id: 'meal',  label: '点餐',   ic: '🍽️', page: MealPage },
    { id: 'mine',  label: '设置',   ic: '⚙️', page: MinePage }
  ];
  let current = 'home';
  let rootEl = null;

  function navHtml() {
    return PAGES.map(function(p) {
      return '<a href="#/' + p.id + '" class="' + (p.id === current ? 'active' : '') + '" data-nav="' + p.id + '">' +
        '<span class="ic">' + p.ic + '</span>' + p.label + '</a>';
    }).join('');
  }

  function pageTitle() {
    const p = PAGES.find(function(x) { return x.id === current; });
    return p ? p.label : '';
  }

  function dateLine() {
    const now = new Date();
    const wk = ['周日','周一','周二','周三','周四','周五','周六'];
    return (now.getMonth()+1) + '月' + now.getDate() + '日 ' + wk[now.getDay()];
  }

  function todayGreeting() {
    const h = new Date().getHours();
    if (h < 6) return '夜深了';
    if (h < 12) return '早上好';
    if (h < 14) return '中午好';
    if (h < 18) return '下午好';
    return '晚上好';
  }

  async function render() {
    UI.closeModal(); // 切换页面时关闭可能残留的模态框
    const p = PAGES.find(function(x) { return x.id === current; });
    if (!p) { current = 'home'; return render(); }
    const content = await p.page.body();
    rootEl.innerHTML = content;
    p.page.bind(rootEl);
  }

  function buildShell() {
    document.body.innerHTML =
      '<div class="layout">' +
        '<aside class="sidebar">' +
          '<div class="brand"><div class="logo">朱</div><div><div class="nm">朱林之家</div><div class="sn">全家共享 · 免费</div></div></div>' +
          '<nav class="nav">' + navHtml() + '</nav>' +
          '<div class="side-foot"><div class="who">👨‍👩‍👧‍👦 家庭空间</div><div>本地优先 · 可选云同步</div></div>' +
        '</aside>' +
        '<div class="main">' +
          '<div class="topbar">' +
            '<h1 id="page-title">' + pageTitle() + '</h1>' +
            '<div class="date" id="page-date">' + dateLine() + ' · ' + todayGreeting() + '</div>' +
            '<div class="right"><span class="pill grn">本地模式</span></div>' +
          '</div>' +
          '<div class="content" id="content"></div>' +
        '</div>' +
      '</div>' +
      '<nav class="mobile-nav">' + navHtml() + '</nav>';

    rootEl = document.getElementById('content');

    // 绑定导航
    document.querySelectorAll('[data-nav]').forEach(function(a) {
      a.addEventListener('click', function(e) {
        e.preventDefault();
        current = this.getAttribute('data-nav');
        document.querySelectorAll('[data-nav]').forEach(function(x) {
          x.classList.toggle('active', x.getAttribute('data-nav') === current);
        });
        document.getElementById('page-title').textContent = pageTitle();
        render();
        window.scrollTo(0, 0);
      });
    });
  }

  function route() {
    const hash = location.hash.replace(/^#\//, '');
    if (hash && PAGES.some(function(p) { return p.id === hash; })) current = hash;
  }

  function init() {
    route();
    buildShell();
    render();
    // 注册 Service Worker（PWA 离线）
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(function() { /* 忽略：非 http 环境或已失败 */ });
    }
    window.addEventListener('hashchange', function() {
      const old = current;
      route();
      if (old !== current) {
        document.querySelectorAll('[data-nav]').forEach(function(x) {
          x.classList.toggle('active', x.getAttribute('data-nav') === current);
        });
        document.getElementById('page-title').textContent = pageTitle();
        render();
        window.scrollTo(0, 0);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  return { render: render };
})();
