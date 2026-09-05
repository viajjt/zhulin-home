/* 朱林之家 - 页面：首页 / 今日概览（时尚可爱风 v2）
   顶部：实时时钟 + 可爱日期星期 + 实时天气（Open-Meteo 免费）
   下方：下次旅行 → 今日待办 → 今日菜单 → 临期物品（最底部） */
const HomePage = (function() {
  let timer = null;

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

  async function body() {
    const tasks = await DB.getAll('tasks');
    const stocks = await DB.getAll('inventory_items');
    const trips = await DB.getAll('trips');
    const meals = await DB.getAll('meal_plans');
    const members = await DB.getAll('members');
    const messages = await DB.getAll('messages');
    const memberMap = {};
    members.forEach(function(m) { memberMap[m.id] = m; });
    const today = UI.todayStr();
    const now = new Date();

    // 今日待办
    const todayTasks = tasks.filter(function(t) { return !t.done && t.due === today; });
    // 临期物品
    const expireItems = stocks.filter(function(it) {
      return it.expire && UI.daysUntil(it.expire) <= 3;
    }).sort(function(a, b) { return a.expire.localeCompare(b.expire); });
    // 下一次旅行
    const futureTrips = trips.filter(function(tp) {
      return tp.start && tp.start >= today;
    }).sort(function(a, b) { return a.start.localeCompare(b.start); });
    const nextTrip = futureTrips[0];
    // 今日菜单
    const todayMeals = meals.filter(function(m2) { return m2.date === today; });

    let html = '';

    // ===== 顶部：时间 + 天气 大卡（可爱） =====
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
      html += '<div class="card hw-tripcard">' +
        '<div class="row">' +
          '<div class="hw-ic floaty">✈️</div>' +
          '<div class="txt">' +
            '<div class="t1">下次旅行 · ' + UI.esc(nextTrip.dest) + '</div>' +
            '<div class="t2">' + UI.fmtCn(nextTrip.start) + (nextTrip.end ? ' - ' + UI.fmtDate(nextTrip.end) : '') + ' · ' + (nextTrip.people || '') + ' 人</div>' +
          '</div>' +
          '<div class="hw-big"><span class="hw-num">' + d + '</span><span class="hw-lbl">天后出发</span></div>' +
        '</div>' +
      '</div>';
    } else {
      const done = tasks.filter(function(t) { return t.done; }).length;
      html += '<div class="card hw-tripcard">' +
        '<div class="row">' +
          '<div class="hw-ic floaty">🏠</div>' +
          '<div class="txt">' +
            '<div class="t1">今天 · 全家共 ' + tasks.length + ' 件事</div>' +
            '<div class="t2">已完成 ' + done + ' · 待办 ' + (tasks.length - done) + ' · 点击左侧菜单逛逛</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    }

    // ===== 今日待办 =====
    html += '<div class="section-title">📅 今日待办（' + todayTasks.length + '）</div>';
    if (todayTasks.length) {
      html += '<div class="card">';
      todayTasks.forEach(function(t) {
        const who = t.assignee && memberMap[t.assignee] ? memberMap[t.assignee] : null;
        html += '<div class="kv"><span class="k">' + UI.esc(t.title) + '</span>' +
          '<span class="v">' + (who ? '<span style="color:var(--sub);font-size:12px;">' + UI.esc(who.name) + '</span>' : '') + '<span class="pill org">今天</span></span></div>';
      });
      html += '</div>';
    } else {
      html += '<div class="card"><div class="empty"><span class="e">🎉</span>今天没有待办，好好休息</div></div>';
    }

    // ===== 今日菜单 =====
    html += '<div class="section-title">🍽️ 今日菜单</div>';
    if (todayMeals.length) {
      html += '<div class="card">';
      todayMeals.forEach(function(m2) {
        const cook = m2.cook && memberMap[m2.cook] ? memberMap[m2.cook].name : '';
        html += '<div class="kv"><span class="k">' + (m2.meal_type === 'breakfast' ? '🥣 早餐' : m2.meal_type === 'lunch' ? '🍱 午餐' : '🍲 晚餐') + ' · ' + UI.esc(m2.dishes || '') + '</span>' +
          '<span class="v">' + (m2.time ? '<span style="color:var(--sub);font-size:12px;">' + m2.time + '</span>' : '') + (cook ? '<span class="pill pink">' + UI.esc(cook) + '做</span>' : '') + '</span></div>';
      });
      html += '</div>';
    } else {
      html += '<div class="card"><div class="empty"><span class="e">🍚</span>今天还没点餐，去点餐页安排吧</div></div>';
    }

    // ===== 临期物品（放最底部） =====
    html += '<div class="section-title">⏰ 临期物品（' + expireItems.length + '）</div>';
    if (expireItems.length) {
      html += '<div class="card">';
      expireItems.forEach(function(it) {
        const d = UI.daysUntil(it.expire);
        html += '<div class="kv"><span class="k">' + UI.esc(it.name) + '</span><span class="pill ' + (d <= 0 ? 'red' : 'org') + '">' + (d < 0 ? '已过期' : d === 0 ? '今天到期' : d + ' 天后到期') + '</span></div>';
      });
      html += '</div>';
    } else {
      html += '<div class="card"><div class="empty"><span class="e">🥛</span>没有临期物品</div></div>';
    }

    // ===== 家庭留言板 =====
    const sortedMsgs = messages.slice().sort(function(a, b) { return (b.created || 0) - (a.created || 0); }).slice(0, 10);
    html += '<div class="section-title">💬 家庭留言板</div>';
    html += '<div class="card">';
    if (sortedMsgs.length) {
      sortedMsgs.forEach(function(msg) {
        const sender = msg.memberName || (msg.member && memberMap[msg.member] ? memberMap[msg.member].name : '家人');
        const time = msg.created ? new Date(msg.created).toLocaleString('zh-CN', {month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '';
        html += '<div style="padding:8px 0;border-bottom:1px solid var(--border);">' +
          '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px;">' +
            '<span style="font-weight:600;font-size:13px;">' + UI.esc(sender) + '</span>' +
            '<span style="font-size:11px;color:var(--sub);">' + time + ' <button class="btn sm ghost" data-del-msg="' + msg.id + '" style="padding:0 4px;font-size:11px;">删</button></span>' +
          '</div>' +
          '<div style="font-size:13.5px;color:#333;line-height:1.5;">' + UI.esc(msg.text || '') + '</div>' +
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

  // 加载天气并渲染到顶部卡
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
    // 留言板事件
    root.addEventListener('click', async function(e) {
      const t = e.target;
      if (t.getAttribute('data-send-msg')) {
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
    // 清除旧时钟，避免重复
    if (timer) { clearInterval(timer); timer = null; }
    function tick() {
      const c = document.getElementById('hw-clock');
      if (!c) return; // 已切走页面
      const now = new Date();
      c.textContent = pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
      const d = document.getElementById('hw-date');
      if (d) d.textContent = (now.getMonth()+1) + '月' + now.getDate() + '日 · 周' + weekCn(now) + ' ' + seasonEmoji(now.getMonth()+1);
      const g = document.getElementById('hw-greet');
      if (g) g.textContent = greeting(now.getHours()) + '，欢迎回到朱林之家 🏠';
    }
    timer = setInterval(tick, 1000);
    // 加载天气
    loadWeather();
  }

  return { body: body, bind: bind };
})();
