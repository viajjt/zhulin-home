/* 朱林之家 - 页面：日历（日程 + 纪念日整合 v4）
   顶部月历视图 + 选中日详情列表 + 统一添加（日程/纪念日） */
const CalendarPage = (function() {
  let viewYear, viewMonth, selectedDate;

  function init() {
    const now = new Date();
    viewYear = now.getFullYear();
    viewMonth = now.getMonth();
    selectedDate = now.toISOString().slice(0, 10);
  }

  // 农历转公历（简化版，用 lunar.js 如果可用）
  function lunarToSolar(lunarStr) {
    if (typeof Lunar !== 'undefined' && Lunar.lunarToSolar) {
      return Lunar.lunarToSolar(lunarStr);
    }
    return lunarStr; // 降级：直接返回
  }

  // 获取某一天的所有事项（日程 + 纪念日）
  async function getItemsForDate(dateStr) {
    const tasks = await DB.getAll('tasks');
    const anns = await DB.getAll('anniversaries');
    const items = [];

    // 日程
    tasks.forEach(function(t) {
      if (t.due === dateStr) {
        items.push({
          type: 'task',
          id: t.id,
          title: t.title,
          time: t.time || '',
          assignee: t.assignee,
          done: t.done,
          source: t.source,
          items: t.items,
          raw: t
        });
      }
    });

    // 纪念日（公历直接匹配，农历换算后匹配）
    const md = dateStr.slice(5);
    anns.forEach(function(a) {
      if (a.lunar) {
        // 农历纪念日：换算成当年公历
        const solar = lunarToSolar(dateStr.slice(0, 4) + '-' + (a.date || '').slice(5));
        if (solar === dateStr) {
          items.push({ type: 'anniv', id: a.id, title: a.title || a.name, date: a.date, lunar: true, repeat: a.repeat, note: a.note, photo: a.photo, raw: a });
        }
      } else {
        // 公历纪念日：匹配月日（每年重复）
        if ((a.date || '').slice(5) === md) {
          items.push({ type: 'anniv', id: a.id, title: a.title || a.name, date: a.date, lunar: false, repeat: a.repeat !== false, note: a.note, photo: a.photo, raw: a });
        }
      }
    });

    // 按时间排序：纪念日在前，然后有时间的日程，最后无时间的
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
    const prefix = year + '-' + String(month + 1).padStart(2, '0');

    tasks.forEach(function(t) {
      if (t.due && t.due.startsWith(prefix)) {
        const d = t.due.slice(8, 10);
        if (!marks[d]) marks[d] = { task: false, anniv: false };
        marks[d].task = true;
      }
    });

    anns.forEach(function(a) {
      if (!a.date) return;
      const md = a.date.slice(5);
      // 简化：公历纪念日标记在对应日期
      if (!a.lunar) {
        const d = md.slice(3, 5);
        if (!marks[d]) marks[d] = { task: false, anniv: false };
        marks[d].anniv = true;
      }
    });

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

    // 日历网格
    html += '<div class="cal-grid">';
    ['日','一','二','三','四','五','六'].forEach(function(w, i) {
      html += '<div class="cal-head' + (i === 0 || i === 6 ? ' we' : '') + '">' + w + '</div>';
    });
    // 上月填充
    for (let i = startWeekday - 1; i >= 0; i--) {
      html += '<div class="cal-cell other-month"><span class="cd-num">' + (prevMonthDays - i) + '</span></div>';
    }
    // 当月
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
    // 下月填充
    const totalCells = startWeekday + daysInMonth;
    const remaining = (7 - (totalCells % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      html += '<div class="cal-cell other-month"><span class="cd-num">' + d + '</span></div>';
    }
    html += '</div>';

    // 选中日详情
    const items = await getItemsForDate(selectedDate);
    const selDate = new Date(selectedDate);
    const weekCn = ['日','一','二','三','四','五','六'][selDate.getDay()];
    html += '<div class="section-title">📋 ' + (selectedDate === today ? '今天' : '') + selDate.getMonth() + 1 + '月' + selDate.getDate() + '日 周' + weekCn + '（' + items.length + '项）</div>';

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
          const itemsHtml = (item.items && item.items.length) ? '<div class="t-meta">🛒 ' + UI.esc(item.items.join('、')) + '</div>' : '';
          html += '<div class="task-item' + (item.done ? ' done' : '') + '">' +
            '<div class="t-check' + (item.done ? ' checked' : '') + '" data-task-toggle="' + item.id + '">' + (item.done ? '✓' : '') + '</div>' +
            '<div class="t-body">' +
              '<div class="t-title">' + UI.esc(item.title) + '</div>' +
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

  // 日程表单
  function openTaskForm(task, defaultDate) {
    const date = task ? task.due : (defaultDate || selectedDate);
    UI.openModal(
      '<h3>' + (task ? '编辑日程' : '添加日程') + '</h3>' +
      '<div class="field"><label>标题</label><input id="tk-title" value="' + UI.esc(task ? task.title : '') + '" placeholder="如：接孩子放学"></div>' +
      '<div class="two">' +
        '<div class="field"><label>日期</label><input id="tk-date" type="date" value="' + date + '"></div>' +
        '<div class="field"><label>时间（可选）</label><input id="tk-time" type="time" value="' + (task ? task.time || '' : '') + '"></div>' +
      '</div>' +
      '<div class="field"><label>负责人（可选）</label><select id="tk-assignee"><option value="">全家</option>' +
        membersOptions(task ? task.assignee : '') +
      '</select></div>' +
      '<div class="field"><label><input type="checkbox" id="tk-lunar" ' + (task && task.lunar ? 'checked' : '') + ' style="width:16px;height:16px;"> 农历日期</label></div>' +
      '<div class="foot"><button class="btn ghost" data-x="1">取消</button><button class="btn" data-save-task="1">保存</button></div>'
    );
    const modal = document.querySelector('.modal');
    modal.querySelector('[data-x]').addEventListener('click', function() { UI.closeModal(); });
    modal.querySelector('[data-save-task]').addEventListener('click', async function() {
      const title = document.getElementById('tk-title').value.trim();
      if (!title) { UI.toast('请填写标题'); return; }
      const obj = {
        title: title,
        due: document.getElementById('tk-date').value,
        time: document.getElementById('tk-time').value,
        assignee: document.getElementById('tk-assignee').value || null,
        lunar: document.getElementById('tk-lunar').checked,
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

  function membersOptions(selected) {
    // 这个函数需要异步获取成员，简化处理
    return ''; // 会在 bind 里动态填充
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

    // 动态填充日程表单的负责人下拉
    const observer = new MutationObserver(function() {
      const sel = document.getElementById('tk-assignee');
      if (sel && sel.options.length <= 1) {
        DB.getAll('members').then(function(members) {
          members.forEach(function(m) {
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = m.name;
            sel.appendChild(opt);
          });
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  return { body: body, bind: bind };
})();
