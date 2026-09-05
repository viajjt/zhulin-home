/* 家庭管理系统 - 应用入口 */
const App = (function() {
  const PAGES = [
    { id: 'home',  label: '首页',   ic: '🏠', page: HomePage },
    { id: 'trip',  label: '旅行',   ic: '✈️', page: TripPage },
    { id: 'cal',   label: '日程',   ic: '📅', page: CalPage },
    { id: 'stock', label: '库存',   ic: '📦', page: StockPage },
    { id: 'memo',  label: '纪念日', ic: '🎉', page: MemoPage },
    { id: 'meal',  label: '点餐',   ic: '🍽️', page: MealPage },
    { id: 'finance', label: '财务', ic: '💰', page: FinancePage },
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

  // ===== 本地提醒（页面打开时有效） =====
  const notified = new Set();
  function startNotifier() {
    async function check() {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      if (document.visibilityState !== 'visible') return;
      const today = new Date().toISOString().slice(0, 10);
      try {
        const tasks = await DB.getAll('tasks');
        tasks.forEach(function(t) {
          if (!t.done && t.date === today && !notified.has('task-' + t.id)) {
            notified.add('task-' + t.id);
            new Notification('📋 今日待办', { body: t.title || '有任务待完成', icon: '' });
          }
        });
        const anns = await DB.getAll('anniversaries');
        anns.forEach(function(a) {
          const md = (a.date || '').slice(5);
          const todayMd = today.slice(5);
          if (md === todayMd && !notified.has('ann-' + a.id)) {
            notified.add('ann-' + a.id);
            new Notification('🎉 纪念日', { body: (a.title || a.name || '今天是个重要日子') + '（每年）', icon: '' });
          }
        });
      } catch(e) {}
    }
    check();
    setInterval(check, 60000);
  }

  function init() {
    route();
    buildShell();
    render();
    // 启动自动云同步：打开即同步 + 每 30 秒轮询 + 切回页面立即同步
    if (typeof DB !== 'undefined' && DB.startAutoSync) DB.startAutoSync();
    // 动态加载家庭名称（云端同步，全家一致）
    if (typeof DB !== 'undefined' && DB.getFamilyName) {
      DB.getFamilyName().then(function(nm) {
        var el = document.querySelector('.brand .nm');
        if (el) el.textContent = nm;
        document.title = nm;
      }).catch(function() {});
    }
    // 财务功能开关：控制导航入口显示
    if (typeof DB !== 'undefined' && DB.getSetting) {
      DB.getSetting('finance_enabled').then(function(on) {
        document.body.classList.toggle('finance-on', !!on);
      }).catch(function() {});
    }
    // 本地提醒：请求通知权限 + 定时检查任务/纪念日
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(function() {});
    }
    startNotifier();
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
