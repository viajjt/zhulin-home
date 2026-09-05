/* 朱林之家 - 页面：日程 / 待办（支持农历日程，如农历初一上香、农历三月初三等） */
const CalPage = (function() {
  let memberMap = {};
  let filter = 'all';

  async function refresh() {
    const members = await DB.getAll('members');
    memberMap = {};
    members.forEach(function(x) { memberMap[x.id] = x; });
  }

  function memberName(id) {
    const m = memberMap[id];
    return m ? m.name : '未指派';
  }
  function memberRole(id) {
    const m = memberMap[id];
    return m ? m.role : '';
  }

  function statusPill(task) {
    if (task.done) return '<span class="pill grn">已完成</span>';
    if (task.due) {
      const d = UI.daysUntil(task.due);
      if (d < 0) return '<span class="pill red">已逾期 ' + (-d) + ' 天</span>';
      if (d === 0) return '<span class="pill org">今天到期</span>';
      if (d === 1) return '<span class="pill org">明天到期</span>';
      return '<span class="pill blue">还有 ' + d + ' 天</span>';
    }
    return '<span class="pill gray">待办</span>';
  }

  function repeatText(t) {
    const map = { none:'', daily:'每天', weekly:'每周', monthly:'每月', yearly:'每年' };
    return t.repeat && t.repeat !== 'none' ? ' · ' + map[t.repeat] : '';
  }

  // 农历日程标签（兼容旧版农历生日数据）
  function lunarTag(t) {
    if (!t.isLunar && !t.isLunarBirthday) return '';
    const leap = t.lunarLeap ? '闰' : '';
    const m = Lunar ? (Lunar.cnMonth(t.lunarMonth) || (t.lunarMonth + '月')) : (t.lunarMonth + '月');
    const d = Lunar ? (Lunar.cnDay(t.lunarDay) || String(t.lunarDay)) : String(t.lunarDay);
    return '<span class="pill pur">' + (t.isLunarBirthday ? '农历生日·' : '农历·') + leap + m + d + '</span>';
  }

  async function renderTasks(list, doneMode) {
    const sorted = list.slice().sort(function(a, b) {
      if (!!a.done !== !!b.done) return a.done ? 1 : -1;
      return (a.due || '9999').localeCompare(b.due || '9999');
    });
    let html = '';
    const title = doneMode ? '已完成任务' : '待办任务';
    html += '<div class="section-title">' + title + '（' + list.length + '）</div>';
    if (!list.length) {
      html += '<div class="card"><div class="empty"><span class="e">✅</span>暂无任务，点下面按钮新建</div></div>';
      return html;
    }
    sorted.forEach(function(t) {
      const who = t.assignee ? memberName(t.assignee) : '';
      const avHtml = t.assignee ? UI.av(memberRole(t.assignee), memberName(t.assignee)) : '<span class="av de">?</span>';
      html += '<div class="card">' +
        '<div class="row">' +
          '<button class="btn sm ghost" data-done="' + t.id + '" style="min-width:52px;">' + (t.done ? '↩ 重开' : '✓ 完成') + '</button>' +
          '<div class="txt">' +
            '<div class="t1" style="' + (t.done ? 'text-decoration:line-through;color:var(--sub);' : '') + '">' + (t.isLunarBirthday ? '🎂 ' : t.isLunar ? '🌙 ' : '') + UI.esc(t.title) + '</div>' +
            '<div class="t2">' + (t.due ? UI.fmtCn(t.due) : '无日期') + repeatText(t) + lunarTag(t) + '</div>' +
          '</div>' +
          (who ? avHtml : '') +
          statusPill(t) +
          '<button class="btn sm ghost" data-edit="' + t.id + '">改</button>' +
          '<button class="btn sm ghost" data-del="' + t.id + '">删除</button>' +
        '</div>' +
        (t.note ? '<div style="font-size:12.5px;color:var(--sub);margin-top:8px;">' + UI.esc(t.note) + '</div>' : '') +
      '</div>';
    });
    return html;
  }

  async function body() {
    await refresh();
    const all = await DB.getAll('tasks');
    let list = all;
    if (filter === 'mine') {
      const me = await DB.getSetting('me');
      if (me) list = all.filter(function(t) { return t.assignee == me; });
    } else if (filter === 'today') {
      const today = UI.todayStr();
      list = all.filter(function(t) { return !t.done && (t.due === today); });
    } else if (filter === 'overdue') {
      const today = UI.todayStr();
      list = all.filter(function(t) { return !t.done && t.due && t.due < today; });
    }

    let html = '';
    html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:4px;">' +
      '<button class="btn sm ' + (filter==='all'?'':'ghost') + '" data-flt="all">全部</button>' +
      '<button class="btn sm ' + (filter==='today'?'':'ghost') + '" data-flt="today">今天</button>' +
      '<button class="btn sm ' + (filter==='overdue'?'':'ghost') + '" data-flt="overdue">已逾期</button>' +
      '<button class="btn sm ' + (filter==='mine'?'':'ghost') + '" data-flt="mine">我负责的</button>' +
    '</div>';

    const pending = list.filter(function(t) { return !t.done; });
    const done = list.filter(function(t) { return t.done; });
    html += await renderTasks(pending, false);
    html += '<div style="margin-top:16px;">' + await renderTasks(done, true) + '</div>';

    html += '<div style="margin-top:20px;display:flex;gap:10px;flex-wrap:wrap;">' +
      '<button class="btn block" data-new="1" style="flex:1 1 150px;">+ 新建任务</button>' +
      '<button class="btn block ghost" data-new-lunar="1" style="flex:1 1 170px;">🌙 添加农历日程</button>' +
    '</div>';
    return html;
  }

  // 普通任务表单
  async function openForm(task) {
    const members = await DB.getAll('members');
    const opts = members.map(function(m) {
      return '<option value="' + m.id + '">' + UI.esc(m.name) + '</option>';
    }).join('');
    const whoOpts = '<option value="">（不指派）</option>' + opts;
    UI.openModal(
      '<h3>' + (task ? '编辑任务' : '新建任务') + '</h3>' +
      '<div class="field"><label>任务内容</label><input id="f-title" value="' + UI.esc(task ? task.title : '') + '" placeholder="如：接孩子放学"></div>' +
      '<div class="two">' +
        '<div class="field"><label>日期</label><input id="f-due" type="date" value="' + (task && task.due ? task.due : UI.todayStr()) + '"></div>' +
        '<div class="field"><label>重复</label><select id="f-repeat">' +
          '<option value="none"' + (task && task.repeat==='none'?' selected':'') + '>不重复</option>' +
          '<option value="daily"' + (task && task.repeat==='daily'?' selected':'') + '>每天</option>' +
          '<option value="weekly"' + (task && task.repeat==='weekly'?' selected':'') + '>每周</option>' +
          '<option value="monthly"' + (task && task.repeat==='monthly'?' selected':'') + '>每月</option>' +
          '<option value="yearly"' + (task && task.repeat==='yearly'?' selected':'') + '>每年</option>' +
        '</select></div>' +
      '</div>' +
      '<div class="field"><label>指派给</label><select id="f-who">' +
        whoOpts.replace('value="' + (task ? task.assignee : '') + '"', 'value="' + (task ? task.assignee : '') + '" selected') +
      '</select></div>' +
      '<div class="field"><label>备注（可选）</label><textarea id="f-note" rows="2" placeholder="补充说明">' + UI.esc(task ? task.note : '') + '</textarea></div>' +
      '<div class="foot">' +
        '<button class="btn ghost" data-x="1">取消</button>' +
        '<button class="btn" data-save="1">保存</button>' +
      '</div>'
    );
    const modal = document.querySelector('.modal');
    modal.querySelector('[data-x]').addEventListener('click', function() { UI.closeModal(); });
    modal.querySelector('[data-save]').addEventListener('click', async function() {
      const title = document.getElementById('f-title').value.trim();
      if (!title) { UI.toast('请填写任务内容'); return; }
      const obj = {
        title: title,
        due: document.getElementById('f-due').value,
        repeat: document.getElementById('f-repeat').value,
        assignee: document.getElementById('f-who').value || null,
        note: document.getElementById('f-note').value.trim(),
        done: task ? task.done : false
      };
      if (task) obj.id = task.id;
      await DB.put('tasks', obj);
      UI.closeModal();
      UI.toast('已保存');
      App.render();
    });
  }

  // 农历日程表单：选择农历月/日（可闰），自动换算为今年或明年的公历日期
  function openLunarForm(task) {
    if (typeof Lunar === 'undefined') {
      UI.toast('农历库加载失败');
      return;
    }
    const mOpts = [];
    for (let m = 1; m <= 12; m++) {
      mOpts.push('<option value="' + m + '"' + (task && task.lunarMonth === m ? ' selected' : '') + '>' + m + '月</option>');
    }
    const dOpts = [];
    for (let d = 1; d <= 30; d++) {
      dOpts.push('<option value="' + d + '"' + (task && task.lunarDay === d ? ' selected' : '') + '>' + d + '日</option>');
    }
    UI.openModal(
      '<h3>🌙 ' + (task ? '编辑农历日程' : '添加农历日程') + '</h3>' +
      '<div class="field"><label>事项名称</label><input id="b-name" value="' + UI.esc(task ? task.title : '') + '" placeholder="如：农历初一上香"></div>' +
      '<div class="two">' +
        '<div class="field"><label>农历月份</label><select id="b-month">' + mOpts.join('') + '</select></div>' +
        '<div class="field"><label>农历日期</label><select id="b-day">' + dOpts.join('') + '</select></div>' +
      '</div>' +
      '<div class="field"><label>类型</label><select id="b-leap">' +
        '<option value="0"' + (!task || !task.lunarLeap ? ' selected' : '') + '>普通农历（常见）</option>' +
        '<option value="1"' + (task && task.lunarLeap ? ' selected' : '') + '>闰月日期（较罕见）</option>' +
      '</select></div>' +
      '<div class="field"><label>指派给</label><select id="b-who">' +
        '<option value="">（不指派）</option>' +
      '</select></div>' +
      '<p style="font-size:12.5px;color:var(--sub);margin-top:8px;" id="b-preview">📅 自动换算为公历日期，每年提醒</p>' +
      '<div class="foot">' +
        '<button class="btn ghost" data-x="1">取消</button>' +
        '<button class="btn" data-save="1">保存</button>' +
      '</div>'
    );
    const modal = document.querySelector('.modal');
    modal.querySelector('[data-x]').addEventListener('click', function() { UI.closeModal(); });

    // 填充成员下拉
    DB.getAll('members').then(function(ms) {
      const sel = document.getElementById('b-who');
      ms.forEach(function(m) {
        const o = document.createElement('option');
        o.value = m.id;
        o.textContent = m.name;
        if (task && task.assignee == m.id) o.selected = true;
        sel.appendChild(o);
      });
    });

    function preview() {
      const m = +document.getElementById('b-month').value;
      const d = +document.getElementById('b-day').value;
      const leap = document.getElementById('b-leap').value === '1';
      const r = Lunar.nextSolarDate(m, d, leap);
      document.getElementById('b-preview').textContent = r
        ? '📅 ' + (leap ? '闰' : '') + m + '月' + d + '日 → 公历 ' + r.solarDate + '，每年提醒'
        : '⚠️ 该农历日期近期无法换算';
    }
    modal.querySelector('#b-month').addEventListener('change', preview);
    modal.querySelector('#b-day').addEventListener('change', preview);
    modal.querySelector('#b-leap').addEventListener('change', preview);
    preview();

    modal.querySelector('[data-save]').addEventListener('click', async function() {
      const name = document.getElementById('b-name').value.trim();
      if (!name) { UI.toast('请填写事项名称'); return; }
      const m = +document.getElementById('b-month').value;
      const d = +document.getElementById('b-day').value;
      const leap = document.getElementById('b-leap').value === '1';
      const who = document.getElementById('b-who').value || null;
      const r = Lunar.nextSolarDate(m, d, leap);
      if (!r) { UI.toast('该农历日期无法换算，请检查'); return; }
      const obj = {
        title: name,
        due: r.solarDate,
        repeat: 'yearly',
        assignee: who,
        note: '',
        done: false,
        isLunar: true,
        lunarMonth: m,
        lunarDay: d,
        lunarLeap: leap,
        lunarName: name
      };
      if (task) obj.id = task.id;
      await DB.put('tasks', obj);
      UI.closeModal();
      UI.toast('已保存，' + r.solarDate + ' 提醒');
      App.render();
    });
  }

  async function onAction(e) {
    const t = e.target;
    const done = t.getAttribute('data-done');
    const del = t.getAttribute('data-del');
    const edit = t.getAttribute('data-edit');
    const flt = t.getAttribute('data-flt');
    const isNew = t.getAttribute('data-new');
    const isLunar = t.getAttribute('data-new-lunar');
    if (done) {
      const task = await DB.get('tasks', +done);
      task.done = !task.done;
      await DB.put('tasks', task);
      UI.toast(task.done ? '已完成 👍' : '已重新打开');
      App.render();
    } else if (del) {
      const id = +del;
      UI.openModal('<h3>删除任务</h3><p style="color:var(--sub);font-size:14px;margin-bottom:8px;">确定删除这条任务吗？此操作不可撤销。</p><div class="foot"><button class="btn ghost" data-x="1">取消</button><button class="btn" data-ok="1" style="background:var(--red);">删除</button></div>');
      const modal = document.querySelector('.modal');
      modal.querySelector('[data-x]').addEventListener('click', function() { UI.closeModal(); });
      modal.querySelector('[data-ok]').addEventListener('click', async function() {
        await DB.del('tasks', id);
        UI.closeModal();
        UI.toast('已删除');
        App.render();
      });
    } else if (edit) {
      const task = await DB.get('tasks', +edit);
      if (task && (task.isLunar || task.isLunarBirthday)) openLunarForm(task);
      else openForm(task);
    } else if (flt) {
      filter = flt;
      App.render();
    } else if (isNew) {
      openForm(null);
    } else if (isLunar) {
      openLunarForm(null);
    }
  }

  function bind(root) {
    root.addEventListener('click', onAction);
  }

  return { body: body, bind: bind, openForm: openForm, openLunarForm: openLunarForm };
})();
