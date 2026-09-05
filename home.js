/* 朱林之家 - 页面：首页 / 概览（卡通童趣风 v4）
   顶部：实时时钟 + 可爱日期星期 + 实时天气
   下方：下次旅行 → 一周待办(含超期) → 最近下一餐 → 家庭留言板 */
const HomePage = (function() {
  let timer = null;
  let selectedDay = 0; // 0=今天, 1=明天, ... 6=6天后

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function weekCn(d) { return ['日','一','二','三','四','五','六'][d.getDay()]; }
  function seasonEmoji(m) {
    if (m >= 3 && m <= 5) return '🌸 春季';
    if (m >= 6 && m <= 8) return '🌞 夏季';
    if (m >= 9 && m <= 11) return '🍂 秋季';
    return '⛄ 冬季';
  }
  function greeting(h) {
    if (h < 5) return '夜深了';
    if (h < 8) return '早安';
    if (h < 12) return '上午好';
    if (h < 14) return '中午好';
    if (h < 18) return '下午好';
    return '晚上好';
  }
  function dateStr(offset) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  }
  function fmtCountdown(targetDate, targetTime) {
    if (!targetDate) return '';
    const now = new Date();
    let target;
    if (targetTime) {
      target = new Date(targetDate + 'T' + targetTime + ':00');
    } else {
      target = new Date(targetDate + 'T12:00:00');
    }
    const diff = target - now;
    if (diff <= 0) return '已到时间';
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (days > 0) return '还有 ' + days + ' 天 ' + hours + ' 小时';
    if (hours > 0) return '还有 ' + hours + ' 小时 ' + mins + ' 分钟';
    return '还有 ' + mins + ' 分钟';
  }

  async function body() {
    const tasks = await DB.getAll('tasks');
    const trips = await DB.getAll('trips');
    const meals = await DB.getAll('meal_plans');
    const members = await DB.getAll('members');
    const messages = await DB.getAll('messages');
    const memberMap = {};
    members.forEach(function(m) { memberMap[m.id] = m; });
    const today = UI.todayStr();
    const now = new Date();

    // 超期未办（due < today 且未完成）
    const overdueTasks = tasks.filter(function(t) {
      return !t.done && t.due && t.due < today;
    }).sort(function(a, b) { return a.due.localeCompare(b.due); });

    // 一周待办（今天到未来6天）
    const weekTasks = [];
    for (let i = 0; i < 7; i++) {
      const d = dateStr(i);
      weekTasks.push({
        date: d,
        offset: i,
        tasks: tasks.filter(function(t) { return !t.done && t.due === d; })
      });
    }

    // 下一次旅行
    const futureTrips = trips.filter(function(tp) {
      return tp.start && tp.start >= today;
    }).sort(function(a, b) { return a.start.localeCompare(b.start); });
    const nextTrip = futureTrips[0];

    // 最近下一餐（未来最近的点餐）
    const futureMeals = meals.filter(function(m) {
      return m.date && m.date >= today;
    }).sort(function(a, b) {
      const da = a.date + (a.time || '23:59');
      const db = b.date + (b.time || '23:59');
      return da.localeCompare(db);
    });
    const nextMeal = futureMeals[0];

    let html = '';

    // ===== 顶部：时间 + 天气 大卡 =====
    html += '<div class="hw-hero">' +
      '<div class="hw-left">' +
        '<div class="hw-time"><span id="hw-clock">' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds()) + '</span></div>' +
        '<div class="hw-date" id="hw-date">' + (now.getMonth()+1) + '月' + now.getDate() + '日 · 周' + weekCn(now) + ' ' + seasonEmoji(now.getMonth()+1) + '</div>' +
        '<div class="hw-greet" id="hw-greet">' + greeting(now.getHours()) + '，欢迎回到朱林之家 🏠</div>' +
      '</div>' +
      '<div class="hw-right" id="hw-weather">' +
        '<div class="hw-load"><span class="floaty">☁️</span> 天气加载中…</div>' +
      '</div>' +
    '</div>';

    // ===== 下次旅行 / 全家事务卡 =====
    if (nextTrip) {
      const d = UI.daysUntil(nextTrip.start);
      const destName = nextTrip.destinations && nextTrip.destinations.length
        ? nextTrip.destinations.map(function(x){return x.name;}).join('→')
        : (nextTrip.dest || '旅行');
      html += '<div class="card hw-tripcard">' +
        '<div class="row">' +
          '<div class="hw-ic floaty">✈️</div>' +
          '<div class="txt">' +
            '<div class="t1">下次旅行 · ' + UI.esc(destName) + '</div>' +
            '<div class="t2">' + UI.fmtCn(nextTrip.start) + (nextTrip.end ? ' - ' + UI.fmtDate(nextTrip.end) : '') + ' · ' + (nextTrip.people || '') + ' 人</div>' +
          '</div>' +
          '<div class="hw-big"><span class="hw-num">' + d + '</span><span class="hw-lbl">天后出发</span></div>' +
        '</div>' +
      '</div>';
    } else {
      const pending = tasks.filter(function(t) { return !t.done; }).length;
      html += '<div class="card hw-tripcard">' +
        '<div class="row">' +
          '<div class="hw-ic floaty">🏠</div>' +
          '<div class="txt">' +
            '<div class="t1">今天 · 全家共 ' + pending + ' 件待办</div>' +
            '<div class="t2">超期 ' + overdueTasks.length + ' · 本周 ' + weekTasks.reduce(function(s,d){return s+d.tasks.length;},0) + ' · 点击左侧菜单逛逛</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    }

    // ===== 超期未办（红色置顶） =====
    if (overdueTasks.length) {
      html += '<div class="overdue-section">' +
        '<div class="title">⚠️ 超期未办（' + overdueTasks.length + '）</div>';
      overdueTasks.forEach(function(t) {
        const who = t.assignee && memberMap[t.assignee] ? memberMap[t.assignee].name : '';
        html += '<div class="task-item">' +
          '<div class="t-check" data-task-check="' + t.id + '"></div>' +
          '<div class="t-body">' +
            '<div class="t-title">' + UI.esc(t.title) + '</div>' +
            '<div class="t-meta"><span>📅 ' + UI.fmtCn(t.due) + '</span>' + (who ? '<span>👤 ' + UI.esc(who) + '</span>' : '') + '</div>' +
          '</div>' +
          '<div class="t-actions"><button class="btn sm ghost" data-task-delay="' + t.id + '">延期到今天</button></div>' +
        '</div>';
      });
      html += '</div>';
    }

    // ===== 一周待办 =====
    const totalWeek = weekTasks.reduce(function(s,d){return s+d.tasks.length;},0);
    html += '<div class="section-title">📅 一周待办（' + totalWeek + '）</div>';
    html += '<div class="card">';
    // 日期选择条
    html += '<div class="week-tabs">';
    weekTasks.forEach(function(w, idx) {
      const d = new Date(w.date);
      const isToday = idx === 0;
      const active = idx === selectedDay;
      html += '<div class="week-tab' + (active ? ' active' : '') + '" data-week-day="' + idx + '">' +
        '<div class="wd">' + (isToday ? '今天' : '周' + weekCn(d)) + '</div>' +
        '<div class="dd">' + d.getDate() + '</div>' +
        '<div class="cnt">' + (w.tasks.length ? w.tasks.length + '件' : '') + '</div>' +
      '</div>';
    });
    html += '</div>';
    // 选中天的待办列表
    const sel = weekTasks[selectedDay];
    if (sel.tasks.length) {
      sel.tasks.forEach(function(t) {
        const who = t.assignee && memberMap[t.assignee] ? memberMap[t.assignee].name : '';
        const itemsHtml = (t.items && t.items.length)
          ? '<div style="font-size:11.5px;color:var(--sub);margin-top:2px;">🛒 ' + UI.esc(t.items.join('、')) + '</div>'
          : '';
        html += '<div class="task-item">' +
          '<div class="t-check' + (t.done ? ' checked' : '') + '" data-task-check="' + t.id + '">' + (t.done ? '✓' : '') + '</div>' +
          '<div class="t-body">' +
            '<div class="t-title">' + UI.esc(t.title) + '</div>' +
            '<div class="t-meta">' + (t.time ? '<span>⏰ ' + t.time + '</span>' : '') + (who ? '<span>👤 ' + UI.esc(who) + '</span>' : '') + (t.source ? '<span class="pill ' + (t.source==='meal'?'org':t.source==='trip'?'blue':'gray') + '">' + (t.source==='meal'?'点餐':t.source==='trip'?'旅行':'系统') + '</span>' : '') + '</div>' +
            itemsHtml +
          '</div>' +
        '</div>';
      });
    } else {
      html += '<div class="empty" style="padding:20px 0;"><span class="e">🎉</span>' + (selectedDay === 0 ? '今天没有待办，好好休息' : '这一天没有待办安排') + '</div>';
    }
    html += '</div>';

    // ===== 最近下一餐 =====
    html += '<div class="section-title">🍽️ 最近下一餐</div>';
    if (nextMeal) {
      const cook = nextMeal.cook && memberMap[nextMeal.cook] ? memberMap[nextMeal.cook].name : '';
      const mealLabel = nextMeal.meal_type === 'breakfast' ? '🥣 早餐' : nextMeal.meal_type === 'lunch' ? '🍱 午餐' : nextMeal.meal_type === 'dinner' ? '🍲 晚餐' : '🍽️ 用餐';
      const countdown = fmtCountdown(nextMeal.date, nextMeal.time);
      html += '<div class="next-meal-card">' +
        '<div class="nm-label">' + mealLabel + ' · ' + UI.fmtCn(nextMeal.date) + (nextMeal.time ? ' ' + nextMeal.time : '') + '</div>' +
        '<div class="nm-dishes">' + UI.esc(nextMeal.dishes || '') + '</div>' +
        '<div class="nm-meta">' + (cook ? '<span>👨‍🍳 ' + UI.esc(cook) + ' 做饭</span>' : '') + '</div>' +
        (countdown ? '<div class="nm-countdown">⏳ ' + countdown + '</div>' : '') +
      '</div>';
    } else {
      html += '<div class="card"><div class="empty"><span class="e">🍚</span>暂无点餐安排，去点餐页安排一餐吧</div></div>';
    }

    // ===== 家庭留言板 =====
    const sortedMsgs = messages.slice().sort(function(a, b) { return (b.created || 0) - (a.created || 0); }).slice(0, 10);
    html += '<div class="section-title">💬 家庭留言板</div>';
    html += '<div class="card">';
    if (sortedMsgs.length) {
      sortedMsgs.forEach(function(msg) {
        const sender = msg.memberName || (msg.member && memberMap[msg.member] ? memberMap[msg.member].name : '家人');
        const time = msg.created ? new Date(msg.created).toLocaleString('zh-CN', {month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '';
        html += '<div style="padding:8px 0;border-bottom:1.5px dashed var(--border);">' +
          '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px;">' +
            '<span style="font-weight:700;font-size:13px;">' + UI.esc(sender) + '</span>' +
            '<span style="font-size:11px;color:var(--sub);">' + time + ' <button class="btn sm ghost" data-del-msg="' + msg.id + '" style="padding:0 4px;font-size:11px;">删</button></span>' +
          '</div>' +
          '<div style="font-size:13.5px;color:var(--text);line-height:1.5;">' + UI.esc(msg.text || '') + '</div>' +
        '</div>';
      });
    } else {
      html += '<div class="empty" style="padding:16px 0;"><span class="e">💬</span>还没有留言，写一句给家人吧</div>';
    }
    html += '<div style="display:flex;gap:8px;margin-top:10px;">' +
      '<input id="msg-input" class="input" placeholder="写点什么…（如：晚上不回来吃饭）" style="flex:1;">' +
      '<select id="msg-sender" class="input" style="width:90px;">' +
        '<option value="">家人</option>' +
        members.map(function(m) { return '<option value="' + m.id + '">' + UI.esc(m.name) + '</option>'; }).join('') +
      '</select>' +
      '<button class="btn" data-send-msg="1">发送</button>' +
    '</div></div>';

    return html;
  }

  // 加载天气
  async function loadWeather() {
    const el = document.getElementById('hw-weather');
    if (!el) return;
    const w = await Weather.fetchNow();
    if (!w) {
      el.innerHTML = '<div class="hw-empty"><span class="e">📍</span>天气获取失败<br><span>检查网络后刷新</span></div>';
      return;
    }
    const grad = Weather.GRADS[w.grad] || Weather.GRADS.sun;
    el.innerHTML = '<div class="hw-weather-inner" style="background:' + grad + ';">' +
      '<div class="hw-emoji floaty">' + w.emoji + '</div>' +
      '<div class="hw-info">' +
        '<div class="hw-temp">' + w.temp + '<span class="hw-unit">°C</span></div>' +
        '<div class="hw-text">' + w.text + ' · 体感 ' + w.feels + '°</div>' +
        '<div class="hw-sub">' + UI.esc(w.city) + (w.tmax != null ? ' · 最高' + w.tmax + '° 最低' + w.tmin + '°' : '') + (w.hum != null ? ' · 湿度' + w.hum + '%' : '') + '</div>' +
      '</div>' +
    '</div>';
  }

  function bind(root) {
    root.addEventListener('click', async function(e) {
      const t = e.target.closest('[data-week-day],[data-task-check],[data-task-delay],[data-send-msg],[data-del-msg]');
      if (!t) return;
      if (t.getAttribute('data-week-day')) {
        selectedDay = +t.getAttribute('data-week-day');
        App.render();
      } else if (t.getAttribute('data-task-check')) {
        const id = +t.getAttribute('data-task-check');
        const task = await DB.get('tasks', id);
        if (task) {
          task.done = !task.done;
          await DB.put('tasks', task);
          App.render();
        }
      } else if (t.getAttribute('data-task-delay')) {
        const id = +t.getAttribute('data-task-delay');
        const task = await DB.get('tasks', id);
        if (task) {
          task.due = UI.todayStr();
          await DB.put('tasks', task);
          UI.toast('已延期到今天');
          App.render();
        }
      } else if (t.getAttribute('data-send-msg')) {
        const input = document.getElementById('msg-input');
        const text = input.value.trim();
        if (!text) { UI.toast('写点什么吧'); return; }
        const member = document.getElementById('msg-sender').value;
        const memberName = member ? (await DB.get('members', +member) || {}).name : '';
        await DB.add('messages', { text: text, member: member, memberName: memberName });
        input.value = '';
        UI.toast('已发送');
        App.render();
      } else if (t.getAttribute('data-del-msg')) {
        if (confirm('删除这条留言？')) {
          await DB.del('messages', +t.getAttribute('data-del-msg'));
          App.render();
        }
      }
    });
    // 回车发送
    root.addEventListener('keydown', function(e) {
      if (e.target.id === 'msg-input' && e.key === 'Enter') {
        document.querySelector('[data-send-msg]').click();
      }
    });
    // 时钟
    if (timer) { clearInterval(timer); timer = null; }
    function tick() {
      const c = document.getElementById('hw-clock');
      if (!c) return;
      const now = new Date();
      c.textContent = pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
      const d = document.getElementById('hw-date');
      if (d) d.textContent = (now.getMonth()+1) + '月' + now.getDate() + '日 · 周' + weekCn(now) + ' ' + seasonEmoji(now.getMonth()+1);
      const g = document.getElementById('hw-greet');
      if (g) g.textContent = greeting(now.getHours()) + '，欢迎回到朱林之家 🏠';
    }
    timer = setInterval(tick, 1000);
    loadWeather();
  }

  return { body: body, bind: bind };
})();
