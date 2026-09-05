/* 朱林之家 - 页面：日程（日程 + 纪念日整合 v4.1）
   顶部月历视图 + 选中日详情 + 循环事件 + 农历日程 */
const CalendarPage = (function() {
  let viewYear, viewMonth, selectedDate;

  function init() {
    const now = new Date();
    viewYear = now.getFullYear();
    viewMonth = now.getMonth();
    selectedDate = now.toISOString().slice(0, 10);
  }

  // 农历转公历（lunar.js 导出的是 lunar2solar，返回 {year,month,day}）
  function lunarToSolar(lunarYear, lunarMonth, lunarDay) {
    if (typeof Lunar !== 'undefined' && Lunar.lunar2solar) {
      try {
        const s = Lunar.lunar2solar(lunarYear, lunarMonth, lunarDay, false);
        return s.year + '-' + String(s.month).padStart(2, '0') + '-' + String(s.day).padStart(2, '0');
      } catch(e) {
        return null;
      }
    }
    return null; // 没有农历库时返回 null，不显示
  }

  // 公历转农历
  function solarToLunar(dateStr) {
    if (typeof Lunar !== 'undefined' && Lunar.solarToLunar) {
      return Lunar.solarToLunar(dateStr);
    }
    return null;
  }

  // 判断某一天是否匹配循环事件
  function matchesRepeat(item, dateStr) {
    if (!item.repeat || item.repeat === 'none') return item.due === dateStr;
    if (!item.due) return false;
    const itemDate = new Date(item.due);
    const checkDate = new Date(dateStr);
    if (checkDate < itemDate) return false; // 循环事件只在开始日期之后

    if (item.repeat === 'daily') return true;
    if (item.repeat === 'weekly') return itemDate.getDay() === checkDate.getDay();
    if (item.repeat === 'monthly') return itemDate.getDate() === checkDate.getDate();
    if (item.repeat === 'yearly') return itemDate.getMonth() === checkDate.getMonth() && itemDate.getDate() === checkDate.getDate();
    return item.due === dateStr;
  }

  // 获取某一天的所有事项
  async function getItemsForDate(dateStr) {
    const tasks = await DB.getAll('tasks');
    const anns = await DB.getAll('anniversaries');
    const items = [];

    // 日程（含循环事件）
    tasks.forEach(function(t) {
      if (t.lunar) {
        // 农历日程：换算成当年公历
        if (t.due) {
          const y = parseInt(dateStr.slice(0, 4));
          const lm = parseInt(t.due.slice(5, 7));
          const ld = parseInt(t.due.slice(8, 10));
          const solar = lunarToSolar(y, lm, ld);
          if (solar === dateStr) {
            items.push({ type: 'task', id: t.id, title: t.title, time: t.time || '', assignee: t.assignee, done: t.done, lunar: true, repeat: t.repeat, source: t.source, items: t.items, raw: t });
          }
        }
      } else if (matchesRepeat(t, dateStr)) {
        items.push({ type: 'task', id: t.id, title: t.title, time: t.time || '', assignee: t.assignee, done: t.done, lunar: false, repeat: t.repeat, source: t.source, items: t.items, raw: t });
      }
    });

    // 纪念日
    const md = dateStr.slice(5);
    anns.forEach(function(a) {
      if (a.lunar) {
        const y = parseInt(dateStr.slice(0, 4));
        if (a.date) {
          const lm = parseInt(a.date.slice(5, 7));
          const ld = parseInt(a.date.slice(8, 10));
          const solar = lunarToSolar(y, lm, ld);
          if (solar === dateStr) {
            items.push({ type: 'anniv', id: a.id, title: a.title || a.name, date: a.date, lunar: true, repeat: a.repeat, note: a.note, photo: a.photo, raw: a });
          }
        }
      } else {
        if (a.repeat !== false && (a.date || '').slice(5) === md) {
          items.push({ type: 'anniv', id: a.id, title: a.title || a.name, date: a.date, lunar: false, repeat: true, note: a.note, photo: a.photo, raw: a });
        } else if (a.date === dateStr) {
          items.push({ type: 'anniv', id: a.id, title: a.title || a.name, date: a.date, lunar: false, repeat: false, note: a.note, photo: a.photo, raw: a });
        }
      }
    });

    items.sort(function(a, b) {
      if (a.type === 'anniv' && b.type !== 'anniv') return -1;
      if (a.type !== 'anniv' && b.type === 'anniv') return 1;
      return (a.time || '99:99').localeCompare(b.time || '99:99');
    });
    return items;
  }

  // 获取某月有事项的日期标记
  async function getMonthMarks(year, month) {
    const tasks = await DB.getAll('tasks');
    const anns = await DB.getAll('anniversaries');
    const marks = {};
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // 遍历当月每一天，检查是否有匹配的事项
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      let hasTask = false, hasAnniv = false;

      tasks.forEach(function(t) {
        if (t.lunar && t.due) {
          const lm = parseInt(t.due.slice(5, 7));
          const ld = parseInt(t.due.slice(8, 10));
          if (lunarToSolar(year, lm, ld) === ds) hasTask = true;
        } else if (matchesRepeat(t, ds)) {
          hasTask = true;
        }
      });

      anns.forEach(function(a) {
        if (!a.date) return;
        if (a.lunar) {
          const lm = parseInt(a.date.slice(5, 7));
          const ld = parseInt(a.date.slice(8, 10));
          if (lunarToSolar(year, lm, ld) === ds) hasAnniv = true;
        } else if (a.repeat !== false && a.date.slice(5) === ds.slice(5)) {
          hasAnniv = true;
        } else if (a.date === ds) {
          hasAnniv = true;
        }
      });

      if (hasTask || hasAnniv) {
        marks[String(d).padStart(2, '0')] = { task: hasTask, anniv: hasAnniv };
      }
    }
    return marks;
  }

  async function body() {
    if (!viewYear) init();
    const marks = await getMonthMarks(viewYear, viewMonth);
    const members = await DB.getAll('members');
    const memberMap = {};
    members.forEach(function(m) { memberMap[m.id] = m; });

    const today = new Date().toISOString().slice(0, 10);
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    const startWeekday = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

    let html = '';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">' +
      '<button class="btn sm ghost" data-cal-prev="1">◀ 上月</button>' +
      '<h3 style="margin:0;font-size:18px;font-weight:800;">' + viewYear + '年' + (viewMonth + 1) + '月</h3>' +
      '<button class="btn sm ghost" data-cal-next="1">下月 ▶</button>' +
    '</div>';

    html += '<div class="cal-grid">';
    ['日','一','二','三','四','五','六'].forEach(function(w, i) {
      html += '<div class="cal-head' + (i === 0 || i === 6 ? ' we' : '') + '">' + w + '</div>';
    });
    for (let i = startWeekday - 1; i >= 0; i--) {
      html += '<div class="cal-cell other-month"><span class="cd-num">' + (prevMonthDays - i) + '</span></div>';
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = viewYear + '-' + String(viewMonth + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      const isToday = ds === today;
      const isSelected = ds === selectedDate;
      const m = marks[String(d).padStart(2, '0')];
      html += '<div class="cal-cell' + (isToday ? ' today' : '') + (isSelected ? ' selected' : '') + '" data-cal-date="' + ds + '">' +
        '<span class="cd-num">' + d + '</span>';
      if (m) {
        html += '<div class="cd-dots">';
        if (m.task) html += '<span class="cd-dot"></span>';
        if (m.anniv) html += '<span class="cd-dot anniv"></span>';
        html += '</div>';
      }
      html += '</div>';
    }
    const totalCells = startWeekday + daysInMonth;
    const remaining = (7 - (totalCells % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      html += '<div class="cal-cell other-month"><span class="cd-num">' + d + '</span></div>';
    }
    html += '</div>';

    const items = await getItemsForDate(selectedDate);
    const selDate = new Date(selectedDate);
    const weekCn = ['日','一','二','三','四','五','六'][selDate.getDay()];
    html += '<div class="section-title">📋 ' + (selectedDate === today ? '今天 · ' : '') + (selDate.getMonth() + 1) + '月' + selDate.getDate() + '日 周' + weekCn + '（' + items.length + '项）</div>';

    html += '<div style="display:flex;gap:8px;margin-bottom:12px;">' +
      '<button class="btn sm" data-add-task="1" style="flex:1;">+ 日程</button>' +
      '<button class="btn sm orange" data-add-anniv="1" style="flex:1;">+ 纪念日</button>' +
    '</div>';

    if (items.length) {
      items.forEach(function(item) {
        if (item.type === 'anniv') {
          html += '<div class="task-item" style="border-color:#FFD0DC;background:#FFF5F8;">' +
            '<div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#FFB8CC,#FF8FAB);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">🎂</div>' +
            '<div class="t-body">' +
              '<div class="t-title" style="color:#D45D82;">' + UI.esc(item.title) + (item.lunar ? ' <span class="pill pink" style="font-size:10px;">农历</span>' : '') + (item.repeat ? ' <span class="pill pink" style="font-size:10px;">每年</span>' : '') + '</div>' +
              (item.note ? '<div class="t-meta">💬 ' + UI.esc(item.note) + '</div>' : '') +
            '</div>' +
            '<div class="t-actions">' +
              '<button class="btn sm ghost" data-edit-anniv="' + item.id + '">编辑</button>' +
              '<button class="btn sm ghost" data-del-anniv="' + item.id + '" style="color:var(--red);">删</button>' +
            '</div>' +
          '</div>';
        } else {
          const who = item.assignee && memberMap[item.assignee] ? memberMap[item.assignee].name : '';
          const repeatLabel = { daily: '每天', weekly: '每周', monthly: '每月', yearly: '每年' };
          const itemsHtml = (item.items && item.items.length) ? '<div class="t-meta">🛒 ' + UI.esc(item.items.join('、')) + '</div>' : '';
          html += '<div class="task-item' + (item.done ? ' done' : '') + '">' +
            '<div class="t-check' + (item.done ? ' checked' : '') + '" data-task-toggle="' + item.id + '">' + (item.done ? '✓' : '') + '</div>' +
            '<div class="t-body">' +
              '<div class="t-title">' + UI.esc(item.title) + (item.lunar ? ' <span class="pill" style="font-size:10px;background:#E8D8FF;color:#7B5EA7;">农历</span>' : '') + (item.repeat && item.repeat !== 'none' ? ' <span class="pill blue" style="font-size:10px;">' + (repeatLabel[item.repeat] || item.repeat) + '</span>' : '') + '</div>' +
              '<div class="t-meta">' + (item.time ? '<span>⏰ ' + item.time + '</span>' : '') + (who ? '<span>👤 ' + UI.esc(who) + '</span>' : '') + (item.source ? '<span class="pill ' + (item.source === 'meal' ? 'org' : item.source === 'trip' ? 'blue' : 'gray') + '">' + (item.source === 'meal' ? '点餐' : item.source === 'trip' ? '旅行' : '系统') + '</span>' : '') + '</div>' +
              itemsHtml +
            '</div>' +
            '<div class="t-actions">' +
              '<button class="btn sm ghost" data-edit-task="' + item.id + '">编辑</button>' +
              '<button class="btn sm ghost" data-del-task="' + item.id + '" style="color:var(--red);">删</button>' +
            '</div>' +
          '</div>';
        }
      });
    } else {
      html += '<div class="card"><div class="empty"><span class="e">🌟</span>这一天没有安排，享受悠闲时光</div></div>';
    }

    return html;
  }

  // 日程表单（含农历和循环）
  function openTaskForm(task, defaultDate) {
    const date = task ? task.due : (defaultDate || selectedDate);
    const repeat = task ? (task.repeat || 'none') : 'none';
    const isLunar = task ? !!task.lunar : false;
    UI.openModal(
      '<h3>' + (task ? '编辑日程' : '添加日程') + '</h3>' +
      '<div class="field"><label>标题</label><input id="tk-title" value="' + UI.esc(task ? task.title : '') + '" placeholder="如：接孩子放学"></div>' +
      '<div class="two">' +
        '<div class="field"><label>日期</label><input id="tk-date" type="date" value="' + date + '"></div>' +
        '<div class="field"><label>时间（可选）</label><input id="tk-time" type="time" value="' + (task ? task.time || '' : '') + '"></div>' +
      '</div>' +
      '<div class="two">' +
        '<div class="field"><label>历法</label><select id="tk-lunar"><option value="false" ' + (!isLunar ? 'selected' : '') + '>公历</option><option value="true" ' + (isLunar ? 'selected' : '') + '>农历</option></select></div>' +
        '<div class="field"><label>重复</label><select id="tk-repeat">' +
          '<option value="none" ' + (repeat === 'none' ? 'selected' : '') + '>不重复</option>' +
          '<option value="daily" ' + (repeat === 'daily' ? 'selected' : '') + '>每天</option>' +
          '<option value="weekly" ' + (repeat === 'weekly' ? 'selected' : '') + '>每周</option>' +
          '<option value="monthly" ' + (repeat === 'monthly' ? 'selected' : '') + '>每月</option>' +
          '<option value="yearly" ' + (repeat === 'yearly' ? 'selected' : '') + '>每年</option>' +
        '</select></div>' +
      '</div>' +
      '<div class="field"><label>负责人（可选）</label><select id="tk-assignee"><option value="">全家</option></select></div>' +
      '<div class="foot"><button class="btn ghost" data-x="1">取消</button><button class="btn" data-save-task="1">保存</button></div>'
    );
    const modal = document.querySelector('.modal');
    // 填充成员
    DB.getAll('members').then(function(members) {
      const sel = document.getElementById('tk-assignee');
      if (sel) {
        members.forEach(function(m) {
          const opt = document.createElement('option');
          opt.value = m.id;
          opt.textContent = m.name;
          if (task && task.assignee == m.id) opt.selected = true;
          sel.appendChild(opt);
        });
      }
    });
    modal.querySelector('[data-x]').addEventListener('click', function() { UI.closeModal(); });
    modal.querySelector('[data-save-task]').addEventListener('click', async function() {
      const title = document.getElementById('tk-title').value.trim();
      if (!title) { UI.toast('请填写标题'); return; }
      const obj = {
        title: title,
        due: document.getElementById('tk-date').value,
        time: document.getElementById('tk-time').value,
        assignee: document.getElementById('tk-assignee').value || null,
        lunar: document.getElementById('tk-lunar').value === 'true',
        repeat: document.getElementById('tk-repeat').value,
        done: task ? task.done : false
      };
      if (task) obj.id = task.id;
      if (task) await DB.put('tasks', obj); else await DB.add('tasks', obj);
      UI.closeModal();
      UI.toast('已保存');
      App.render();
    });
  }

  // 纪念日表单
  function openAnnivForm(anniv) {
    UI.openModal(
      '<h3>' + (anniv ? '编辑纪念日' : '添加纪念日/生日') + '</h3>' +
      '<div class="field"><label>名称</label><input id="an-title" value="' + UI.esc(anniv ? (anniv.title || anniv.name) : '') + '" placeholder="如：妈妈生日、结婚纪念日"></div>' +
      '<div class="two">' +
        '<div class="field"><label>日期</label><input id="an-date" type="date" value="' + (anniv ? anniv.date : '') + '"></div>' +
        '<div class="field"><label>历法</label><select id="an-lunar"><option value="false" ' + (anniv && !anniv.lunar ? 'selected' : '') + '>公历</option><option value="true" ' + (anniv && anniv.lunar ? 'selected' : '') + '>农历</option></select></div>' +
      '</div>' +
      '<div class="field"><label><input type="checkbox" id="an-repeat" ' + (anniv ? (anniv.repeat !== false ? 'checked' : '') : 'checked') + ' style="width:16px;height:16px;"> 每年重复提醒</label></div>' +
      '<div class="field"><label>备注（可选）</label><textarea id="an-note" rows="2" placeholder="如：喜欢康乃馨、爱吃甜食">' + UI.esc(anniv ? anniv.note || '' : '') + '</textarea></div>' +
      '<div class="foot"><button class="btn ghost" data-x="1">取消</button><button class="btn orange" data-save-anniv="1">保存</button></div>'
    );
    const modal = document.querySelector('.modal');
    modal.querySelector('[data-x]').addEventListener('click', function() { UI.closeModal(); });
    modal.querySelector('[data-save-anniv]').addEventListener('click', async function() {
      const title = document.getElementById('an-title').value.trim();
      if (!title) { UI.toast('请填写名称'); return; }
      const obj = {
        title: title,
        date: document.getElementById('an-date').value,
        lunar: document.getElementById('an-lunar').value === 'true',
        repeat: document.getElementById('an-repeat').checked,
        note: document.getElementById('an-note').value.trim()
      };
      if (anniv) obj.id = anniv.id;
      if (anniv) await DB.put('anniversaries', obj); else await DB.add('anniversaries', obj);
      UI.closeModal();
      UI.toast('已保存');
      App.render();
    });
  }

  function bind(root) {
    root.addEventListener('click', async function(e) {
      const t = e.target.closest('[data-cal-prev],[data-cal-next],[data-cal-date],[data-add-task],[data-add-anniv],[data-task-toggle],[data-edit-task],[data-del-task],[data-edit-anniv],[data-del-anniv]');
      if (!t) return;

      if (t.getAttribute('data-cal-prev')) {
        viewMonth--;
        if (viewMonth < 0) { viewMonth = 11; viewYear--; }
        App.render();
      } else if (t.getAttribute('data-cal-next')) {
        viewMonth++;
        if (viewMonth > 11) { viewMonth = 0; viewYear++; }
        App.render();
      } else if (t.getAttribute('data-cal-date')) {
        selectedDate = t.getAttribute('data-cal-date');
        App.render();
      } else if (t.getAttribute('data-add-task')) {
        openTaskForm(null, selectedDate);
      } else if (t.getAttribute('data-add-anniv')) {
        openAnnivForm(null);
      } else if (t.getAttribute('data-task-toggle')) {
        const id = +t.getAttribute('data-task-toggle');
        const task = await DB.get('tasks', id);
        if (task) { task.done = !task.done; await DB.put('tasks', task); App.render(); }
      } else if (t.getAttribute('data-edit-task')) {
        const id = +t.getAttribute('data-edit-task');
        const task = await DB.get('tasks', id);
        if (task) openTaskForm(task);
      } else if (t.getAttribute('data-del-task')) {
        if (confirm('删除这个日程？')) {
          await DB.del('tasks', +t.getAttribute('data-del-task'));
          UI.toast('已删除');
          App.render();
        }
      } else if (t.getAttribute('data-edit-anniv')) {
        const id = +t.getAttribute('data-edit-anniv');
        const anniv = await DB.get('anniversaries', id);
        if (anniv) openAnnivForm(anniv);
      } else if (t.getAttribute('data-del-anniv')) {
        if (confirm('删除这个纪念日？')) {
          await DB.del('anniversaries', +t.getAttribute('data-del-anniv'));
          UI.toast('已删除');
          App.render();
        }
      }
    });
  }

  return { body: body, bind: bind };
})();
