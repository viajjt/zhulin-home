/* 家庭管理系统 - 应用入口 */
const App = (function() {
  const PAGES = [
    { id: 'home',  label: '首页',   ic: '🏠', page: HomePage },
    { id: 'trip',  label: '旅行',   ic: '✈️', page: TripPage },
    { id: 'calendar', label: '日程', ic: '📅', page: CalendarPage },
    { id: 'stock', label: '库存',   ic: '📦', page: StockPage },
    { id: 'meal',  label: '点餐',   ic: '🍽️', page: MealPage },
    { id: 'finance', label: '财务', ic: '💰', page: FinancePage },
    { id: 'mine',  label: '设置',   ic: '⚙️', page: MinePage }
  ];
  let current = 'home';
  let rootEl = null;

  function navHtml() {
    return PAGES.map(function(p) {
      const extra = p.id === 'finance' ? '<div class="fin-progress" id="fin-nav-progress"><div class="fin-progress-bar" style="width:0%"></div></div>' : '';
      return '<a href="#/' + p.id + '" class="' + (p.id === current ? 'active' : '') + '" data-nav="' + p.id + '">' +
        '<span class="ic">' + p.ic + '</span>' + p.label + extra + '</a>';
    }).join('');
  }

  // 异步更新财务导航年度进度条
  async function updateFinNavProgress() {
    const el = document.getElementById('fin-nav-progress');
    if (!el) return;
    try {
      const enabled = await DB.getSetting('finance_enabled');
      if (!enabled) { el.style.display = 'none'; return; }
      const year = new Date().getFullYear();
      const budgets = await DB.getAll('budgets');
      const budget = budgets.find(function(b) { return b.year == year; });
      const txs = await DB.getAll('transactions');
      let totalBudget = 0, totalExpense = 0;
      const monthIdx = new Date().getMonth();
      if (budget) {
        budget.expense_cats.forEach(function(c) {
          if (Array.isArray(c.monthly)) totalBudget += c.monthly.reduce(function(s, v) { return s + (+v || 0); }, 0);
          else totalBudget += (+c.monthly || 0) * 12;
        });
      }
      txs.forEach(function(t) {
        if (t.type !== 'income' && (t.date || '').slice(0, 4) == year) {
          totalExpense += +t.amount || 0;
        }
      });
      const pct = totalBudget > 0 ? Math.min(100, Math.round(totalExpense / totalBudget * 100)) : 0;
      const bar = el.querySelector('.fin-progress-bar');
      if (bar) {
        bar.style.width = pct + '%';
        bar.style.background = pct >= 100 ? '#FF6B6B' : pct >= 80 ? '#FF9F68' : '#FFD93D';
      }
      el.title = '年度支出 ' + pct + '%（已花 ¥' + totalExpense.toLocaleString() + ' / 预算 ¥' + totalBudget.toLocaleString() + '）';
    } catch(e) {}
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
    // 克隆 rootEl 清除所有旧事件监听器（防止页面间事件冲突）
    const newEl = rootEl.cloneNode(false);
    rootEl.parentNode.replaceChild(newEl, rootEl);
    rootEl = newEl;
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
      const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      try {
        // 读取通知偏好（默认全部开启）
        const notif = {
          task: (await DB.getSetting('notif_task')) !== false,
          stock: (await DB.getSetting('notif_stock')) !== false,
          trip: (await DB.getSetting('notif_trip')) !== false,
          meal: (await DB.getSetting('notif_meal')) !== false,
          anniv: (await DB.getSetting('notif_anniv')) !== false
        };

        // 任务到期提醒（今天 + 明天提前提醒）
        if (notif.task) {
          const tasks = await DB.getAll('tasks');
          tasks.forEach(function(t) {
            if (!t.done && t.due) {
              if (t.due === today && !notified.has('task-today-' + t.id)) {
                notified.add('task-today-' + t.id);
                new Notification('📋 今日待办', { body: t.title || '有任务待完成', icon: '' });
              } else if (t.due === tomorrow && !notified.has('task-tomorrow-' + t.id)) {
                notified.add('task-tomorrow-' + t.id);
                new Notification('⏰ 明天待办', { body: '明天：' + (t.title || '有任务待完成'), icon: '' });
              }
            }
          });
        }

        // 纪念日提醒（今天 + 明天提前提醒，支持每年重复）
        if (notif.anniv) {
          const anns = await DB.getAll('anniversaries');
          const todayMd = today.slice(5);
          const tomorrowMd = tomorrow.slice(5);
          anns.forEach(function(a) {
            const md = (a.date || '').slice(5);
            if (md === todayMd && !notified.has('ann-today-' + a.id)) {
              notified.add('ann-today-' + a.id);
              new Notification('🎉 纪念日', { body: (a.title || a.name || '今天是个重要日子') + (a.repeat !== false ? '（每年）' : ''), icon: '' });
            } else if (md === tomorrowMd && !notified.has('ann-tomorrow-' + a.id)) {
              notified.add('ann-tomorrow-' + a.id);
              new Notification('🎂 明天纪念日', { body: '明天：' + (a.title || a.name || '重要日子'), icon: '' });
            }
          });
        }

        // 库存临期提醒（3天内到期）
        if (notif.stock) {
          const stocks = await DB.getAll('inventory_items');
          stocks.forEach(function(it) {
            if (it.expire) {
              const d = Math.ceil((new Date(it.expire) - new Date(today)) / 86400000);
              if (d >= 0 && d <= 3 && !notified.has('stock-' + it.id)) {
                notified.add('stock-' + it.id);
                new Notification('🥛 库存临期', { body: it.name + (d === 0 ? '今天到期' : d + '天后到期'), icon: '' });
              }
            }
          });
        }

        // 旅行出行提醒（明天出发）
        if (notif.trip) {
          const trips = await DB.getAll('trips');
          trips.forEach(function(tp) {
            if (tp.start === tomorrow && !notified.has('trip-' + tp.id)) {
              notified.add('trip-' + tp.id);
              const dest = tp.destinations && tp.destinations.length ? tp.destinations.map(function(x){return x.name;}).join('→') : (tp.dest || '旅行');
              new Notification('✈️ 明天出发', { body: dest + ' · ' + (tp.people || '') + '人', icon: '' });
            }
          });
        }

        // 点餐/做饭提醒（开饭前4小时）
        if (notif.meal) {
          const meals = await DB.getAll('meal_plans');
          meals.forEach(function(m) {
            if (m.date === today && m.time) {
              const mealTime = new Date(today + 'T' + m.time + ':00');
              const diffHours = (mealTime - new Date()) / 3600000;
              if (diffHours > 3.5 && diffHours <= 4.5 && !notified.has('meal-' + m.id)) {
                notified.add('meal-' + m.id);
                new Notification('🍳 该做饭了', { body: (m.dishes || '点餐') + ' · ' + m.time, icon: '' });
              }
            }
          });
        }
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
    // 清理已软删除超过7天的记录（防止数据膨胀）
    if (typeof DB !== 'undefined' && DB.purgeDeleted && DB.SYNC_TABLES) {
      DB.SYNC_TABLES.forEach(function(t) { DB.purgeDeleted(t).catch(function() {}); });
    }
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
        if (on) updateFinNavProgress();
      }).catch(function() {});
    }
    // 本地提醒：请求通知权限 + 定时检查任务/纪念日
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(function() {});
    }
    startNotifier();
    // 语音助手（卡通小狗）
    if (typeof VoiceAssistant !== 'undefined') {
      VoiceAssistant.init();
    }
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
