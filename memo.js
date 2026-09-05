/* 朱林之家 - 页面：纪念日 / 大事记（支持农历生日） */
const MemoPage = (function() {
  const RECUR = { none:'一次性', yearly:'每年', monthly:'每月' };

  // 农历生日标签
  function lunarTag(a) {
    if (!a.isLunar) return '';
    const leap = a.lunarLeap ? '闰' : '';
    const m = Lunar ? (Lunar.cnMonth(a.lunarMonth) || (a.lunarMonth + '月')) : (a.lunarMonth + '月');
    const d = Lunar ? (Lunar.cnDay(a.lunarDay) || String(a.lunarDay)) : String(a.lunarDay);
    return '<span class="pill pur">农历生日·' + leap + m + d + '</span>';
  }

  async function body() {
    const anns = await DB.getAll('anniversaries');
    const miles = await DB.getAll('milestones');
    const trips = await DB.getAll('trips');
    const today = UI.todayStr();

    let html = '';

    // 即将到来的纪念日（倒计时）
    const future = anns.filter(function(a) {
      if (a.recur === 'yearly') return true;
      return !a.date || a.date >= today;
    });
    html += '<div class="section-title">🎉 纪念日倒计时</div>';
    if (future.length) {
      html += '<div class="grid2">';
      future.slice().sort(function(a,b){ return (a.date||'').localeCompare(b.date||''); }).slice(0,4).forEach(function(a) {
        let d;
        if (a.recur === 'yearly') {
          // 计算今年或明年的日期
          const y = new Date().getFullYear();
          let cand = y + '-' + (a.date ? a.date.slice(5) : '01-01');
          if (cand < today) cand = (y+1) + '-' + a.date.slice(5);
          d = UI.daysUntil(cand);
        } else {
          d = UI.daysUntil(a.date);
        }
        const cls = d <= 3 ? (d < 0 ? 'red' : 'org') : 'blue';
        html += '<div class="card" style="text-align:center;">' +
          '<div style="font-size:12px;color:var(--sub);">' + UI.esc(a.name) + '</div>' +
          '<div style="font-size:26px;font-weight:700;color:' + (cls==='red'?'var(--red)':cls==='org'?'var(--org)':'var(--green)') + ';margin:6px 0;">' + (d < 0 ? '已过 ' + (-d) + ' 天' : d + ' 天') + '</div>' +
          '<div style="font-size:12px;color:var(--sub);">' + (a.date ? UI.fmtDate(a.date) : '') + ' · ' + (RECUR[a.recur]||'') + '</div>' +
          '<div style="margin-top:4px;">' + lunarTag(a) + '</div>' +
          '<div style="margin-top:8px;display:flex;gap:6px;justify-content:center;">' +
            '<button class="btn sm ghost" data-edit-ann="' + a.id + '">编辑</button>' +
            '<button class="btn sm ghost" data-del-ann="' + a.id + '" style="color:var(--red);">删除</button>' +
          '</div>' +
        '</div>';
      });
      html += '</div>';
    } else {
      html += '<div class="card"><div class="empty"><span class="e">🎂</span>还没有纪念日，先添加一个吧</div></div>';
    }

    // 全部纪念日列表（含编辑/删除）
    html += '<div class="section-title">📌 全部纪念日（' + anns.length + '）</div>';
    if (anns.length) {
      html += '<div class="card">';
      anns.slice().sort(function(a,b){ return (a.date||'').localeCompare(b.date||''); }).forEach(function(a) {
        html += '<div class="kv"><span class="k">' + UI.esc(a.name) + ' <span style="color:var(--sub);font-size:12px;">' + UI.fmtDate(a.date) + ' · ' + (RECUR[a.recur]||'') + '</span>' + lunarTag(a) + '</span>' +
          '<span class="v">' +
            '<button class="btn sm ghost" data-edit-ann="' + a.id + '">改</button>' +
            '<button class="btn sm ghost" data-del-ann="' + a.id + '">删</button>' +
          '</span></div>';
      });
      html += '</div>';
    }

    // 添加纪念日按钮
    html += '<div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">' +
      '<button class="btn block" data-new-ann="1" style="flex:1 1 150px;">+ 添加纪念日</button>' +
      '<button class="btn block ghost" data-new-lunar="1" style="flex:1 1 170px;">🎂 添加农历生日</button>' +
    '</div>';

    // 大事记时间轴（含旅行照片归档）
    html += '<div class="section-title">📖 家庭大事记 / 照片</div>';
    const events = [];
    miles.forEach(function(m) {
      events.push({ time: m.time, type: 'milestone', title: m.title, photo: m.photo });
    });
    trips.forEach(function(tp) {
      if (tp.start && tp.start <= today) {
        events.push({ time: tp.start, type: 'trip', title: '✈️ 旅行 · ' + tp.dest, photo: null });
      }
    });
    events.sort(function(a, b) { return b.time.localeCompare(a.time); });

    if (events.length) {
      html += '<div class="card">';
      events.slice(0, 12).forEach(function(ev) {
        html += '<div class="kv"><span class="k">' + UI.fmtCn(ev.time) + ' · ' + UI.esc(ev.title) + '</span>' +
          '<span class="v"><span class="pill ' + (ev.type==='trip'?'blue':'pur') + '">' + (ev.type==='trip'?'旅行':'里程碑') + '</span></span></div>';
      });
      html += '</div>';
    } else {
      html += '<div class="card"><div class="empty"><span class="e">📖</span>还没有大事记记录</div></div>';
    }
    html += '<div style="margin-top:12px;"><button class="btn block ghost" data-new-mil="1">+ 记录大事记</button></div>';

    return html;
  }

  function openAnn(ann) {
    UI.openModal(
      '<h3>' + (ann ? '编辑纪念日' : '添加纪念日') + '</h3>' +
      '<div class="field"><label>名称</label><input id="a-name" value="' + UI.esc(ann ? ann.name : '') + '" placeholder="如：结婚纪念日"></div>' +
      '<div class="two">' +
        '<div class="field"><label>日期</label><input id="a-date" type="date" value="' + (ann && ann.date ? ann.date : UI.todayStr()) + '"></div>' +
        '<div class="field"><label>重复</label><select id="a-recur">' +
          '<option value="yearly"' + (!ann || ann.recur==='yearly' ? ' selected' : '') + '>每年</option>' +
          '<option value="none"' + (ann && ann.recur==='none' ? ' selected' : '') + '>一次性</option>' +
          '<option value="monthly"' + (ann && ann.recur==='monthly' ? ' selected' : '') + '>每月</option>' +
        '</select></div>' +
      '</div>' +
      '<div class="foot"><button class="btn ghost" data-x="1">取消</button><button class="btn" data-save="1">保存</button></div>'
    );
    const modal = document.querySelector('.modal');
    modal.querySelector('[data-x]').addEventListener('click', function() { UI.closeModal(); });
    modal.querySelector('[data-save]').addEventListener('click', async function() {
      const name = document.getElementById('a-name').value.trim();
      if (!name) { UI.toast('请填写名称'); return; }
      const obj = {
        name: name,
        date: document.getElementById('a-date').value,
        recur: document.getElementById('a-recur').value
      };
      if (ann) obj.id = ann.id;
      await DB.put('anniversaries', obj);
      UI.closeModal();
      UI.toast('已保存');
      App.render();
    });
  }

  function openMilestone() {
    UI.openModal(
      '<h3>记录大事记</h3>' +
      '<div class="field"><label>标题</label><input id="m-title" placeholder="如：宝宝第一次走路"></div>' +
      '<div class="field"><label>日期</label><input id="m-time" type="date" value="' + UI.todayStr() + '"></div>' +
      '<div class="field"><label>照片说明（当前演示版暂存文字，正式版接入云存储）</label><input id="m-photo" placeholder="可留空"></div>' +
      '<div class="foot"><button class="btn ghost" data-x="1">取消</button><button class="btn" data-save="1">保存</button></div>'
    );
    const modal = document.querySelector('.modal');
    modal.querySelector('[data-x]').addEventListener('click', function() { UI.closeModal(); });
    modal.querySelector('[data-save]').addEventListener('click', async function() {
      const title = document.getElementById('m-title').value.trim();
      if (!title) { UI.toast('请填写标题'); return; }
      await DB.add('milestones', {
        title: title,
        time: document.getElementById('m-time').value,
        photo: document.getElementById('m-photo').value.trim() || null
      });
      UI.closeModal();
      UI.toast('已记录');
      App.render();
    });
  }

  // 农历生日表单：选择成员称呼 + 农历月/日（可闰），换算为每年公历日期
  function openLunarAnnForm(ann) {
    if (typeof Lunar === 'undefined') { UI.toast('农历库加载失败'); return; }
    const mOpts = [];
    for (let m = 1; m <= 12; m++) {
      mOpts.push('<option value="' + m + '"' + (ann && ann.lunarMonth === m ? ' selected' : '') + '>' + m + '月</option>');
    }
    const dOpts = [];
    for (let d = 1; d <= 30; d++) {
      dOpts.push('<option value="' + d + '"' + (ann && ann.lunarDay === d ? ' selected' : '') + '>' + d + '日</option>');
    }
    UI.openModal(
      '<h3>🎂 ' + (ann ? '编辑农历生日' : '添加农历生日') + '</h3>' +
      '<div class="field"><label>姓名 / 称呼</label><input id="b-name" value="' + UI.esc(ann ? ann.name : '') + '" placeholder="如：奶奶"></div>' +
      '<div class="two">' +
        '<div class="field"><label>农历月份</label><select id="b-month">' + mOpts.join('') + '</select></div>' +
        '<div class="field"><label>农历日期</label><select id="b-day">' + dOpts.join('') + '</select></div>' +
      '</div>' +
      '<div class="field"><label>类型</label><select id="b-leap">' +
        '<option value="0"' + (!ann || !ann.lunarLeap ? ' selected' : '') + '>普通农历（常见）</option>' +
        '<option value="1"' + (ann && ann.lunarLeap ? ' selected' : '') + '>闰月生日（较罕见）</option>' +
      '</select></div>' +
      '<p style="font-size:12.5px;color:var(--sub);margin-top:8px;" id="b-preview">📅 自动换算为公历日期，每年提醒</p>' +
      '<div class="foot"><button class="btn ghost" data-x="1">取消</button><button class="btn" data-save="1">保存</button></div>'
    );
    const modal = document.querySelector('.modal');
    modal.querySelector('[data-x]').addEventListener('click', function() { UI.closeModal(); });

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
      if (!name) { UI.toast('请填写姓名/称呼'); return; }
      const m = +document.getElementById('b-month').value;
      const d = +document.getElementById('b-day').value;
      const leap = document.getElementById('b-leap').value === '1';
      const r = Lunar.nextSolarDate(m, d, leap);
      if (!r) { UI.toast('该农历日期无法换算，请检查'); return; }
      const obj = {
        name: name,
        date: r.solarDate,
        recur: 'yearly',
        isLunar: true,
        lunarMonth: m,
        lunarDay: d,
        lunarLeap: leap,
        lunarName: name
      };
      if (ann) obj.id = ann.id;
      await DB.put('anniversaries', obj);
      UI.closeModal();
      UI.toast('已保存，每年 ' + r.solarDate.slice(5) + ' 提醒');
      App.render();
    });
  }

  async function onAction(e) {
    const t = e.target;
    const ea = t.getAttribute('data-edit-ann');
    const da = t.getAttribute('data-del-ann');
    if (t.getAttribute('data-new-ann')) openAnn(null);
    else if (t.getAttribute('data-new-lunar')) openLunarAnnForm(null);
    else if (t.getAttribute('data-new-mil')) openMilestone();
    else if (ea) {
      const ann = await DB.get('anniversaries', +ea);
      if (ann && ann.isLunar) openLunarAnnForm(ann);
      else openAnn(ann);
    }
    else if (da) {
      const id = +da;
      UI.openModal('<h3>删除纪念日</h3><p style="color:var(--sub);font-size:14px;margin-bottom:8px;">确定删除这个纪念日吗？此操作不可撤销。</p><div class="foot"><button class="btn ghost" data-x="1">取消</button><button class="btn" data-ok="1" style="background:var(--red);">删除</button></div>');
      const modal = document.querySelector('.modal');
      modal.querySelector('[data-x]').addEventListener('click', function() { UI.closeModal(); });
      modal.querySelector('[data-ok]').addEventListener('click', async function() {
        await DB.del('anniversaries', id);
        UI.closeModal();
        UI.toast('已删除');
        App.render();
      });
    }
  }

  function bind(root) {
    root.addEventListener('click', onAction);
  }

  return { body: body, bind: bind };
})();
