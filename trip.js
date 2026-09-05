/* 朱林之家 - 页面：旅行规划 v4（分段交通时间轴）
   多目的地分段行程 + 时间轴 + 地图 + 预算 + 打卡 + 智能清单 + AI生成 */
const TripPage = (function() {
  const TRANSPORT_ICONS = { plane: '✈️', train: '🚄', car: '🚗', bus: '🚌', ship: '🚢', other: '🚶' };
  const TRANSPORT_NAMES = { plane: '飞机', train: '高铁/火车', car: '自驾', bus: '大巴', ship: '轮船', other: '其他' };

  // 确保 trip 有 segments 字段（兼容旧数据）
  function ensureSegments(trip) {
    if (trip.segments && trip.segments.length) return trip;
    // 旧数据：从 destinations 转换
    trip.segments = [];
    if (trip.destinations && trip.destinations.length) {
      trip.destinations.forEach(function(d, i) {
        if (i === 0) {
          trip.segments.push({ kind: 'transport', from: trip.origin || '家', to: d.name, transport: 'car', depart: trip.start_date || '', arrive: '', note: '' });
        } else {
          trip.segments.push({ kind: 'transport', from: trip.destinations[i-1].name, to: d.name, transport: 'car', depart: '', arrive: '', note: '' });
        }
        trip.segments.push({ kind: 'stay', city: d.name, start: d.arrive || trip.start_date || '', end: d.leave || '', note: d.note || '' });
      });
      // 返程
      const last = trip.destinations[trip.destinations.length - 1];
      trip.segments.push({ kind: 'transport', from: last.name, to: trip.origin || '家', transport: 'car', depart: trip.end_date || '', arrive: '', note: '返程' });
    }
    return trip;
  }

  function fmtDate(d) {
    if (!d) return '';
    return d.length > 10 ? d.slice(0, 16) : d;
  }

  // ===== 行程时间轴渲染 =====
  function timelineHtml(trip) {
    if (!trip.segments || !trip.segments.length) {
      return '<div class="card"><div class="empty"><span class="e">🗺️</span>还没有行程，点下面按钮添加第一段</div></div>';
    }
    let html = '<div class="trip-timeline">';
    trip.segments.forEach(function(seg, i) {
      if (seg.kind === 'transport') {
        const icon = TRANSPORT_ICONS[seg.transport] || '🚶';
        const name = TRANSPORT_NAMES[seg.transport] || '交通';
        html += '<div class="tl-item transport">' +
          '<div class="tl-icon">' + icon + '</div>' +
          '<div class="tl-content">' +
            '<div class="tl-title">' + UI.esc(seg.from || '?') + ' → ' + UI.esc(seg.to || '?') + '</div>' +
            '<div class="tl-meta">' + name + (seg.depart ? ' · 出发 ' + fmtDate(seg.depart) : '') + (seg.arrive ? ' · 到达 ' + fmtDate(seg.arrive) : '') + '</div>' +
            (seg.note ? '<div class="tl-note">' + UI.esc(seg.note) + '</div>' : '') +
          '</div>' +
          '<div class="tl-actions">' +
            '<button class="btn sm ghost" data-edit-seg="' + i + '">编辑</button>' +
            '<button class="btn sm ghost" data-del-seg="' + i + '" style="color:var(--red);">删</button>' +
          '</div>' +
        '</div>';
      } else {
        html += '<div class="tl-item stay">' +
          '<div class="tl-icon">🏨</div>' +
          '<div class="tl-content">' +
            '<div class="tl-title">停留：' + UI.esc(seg.city || '?') + '</div>' +
            '<div class="tl-meta">' + (seg.start ? fmtDate(seg.start) : '?') + ' ~ ' + (seg.end ? fmtDate(seg.end) : '?') + '</div>' +
            (seg.note ? '<div class="tl-note">' + UI.esc(seg.note) + '</div>' : '') +
          '</div>' +
          '<div class="tl-actions">' +
            '<button class="btn sm ghost" data-edit-seg="' + i + '">编辑</button>' +
            '<button class="btn sm ghost" data-del-seg="' + i + '" style="color:var(--red);">删</button>' +
          '</div>' +
        '</div>';
      }
    });
    html += '</div>';
    return html;
  }

  // ===== 添加/编辑分段表单 =====
  function openSegForm(trip, idx) {
    const seg = idx != null ? trip.segments[idx] : null;
    const isEdit = !!seg;
    const kind = seg ? seg.kind : 'transport';
    UI.openModal(
      '<h3>' + (isEdit ? '编辑行程段' : '添加行程段') + '</h3>' +
      '<div class="field"><label>类型</label><select id="seg-kind">' +
        '<option value="transport" ' + (kind === 'transport' ? 'selected' : '') + '>🚄 交通段</option>' +
        '<option value="stay" ' + (kind === 'stay' ? 'selected' : '') + '>🏨 停留段</option>' +
      '</select></div>' +
      (kind === 'transport'
        ? '<div class="two"><div class="field"><label>出发地</label><input id="seg-from" value="' + UI.esc(seg ? seg.from || '' : '') + '" placeholder="如：阳江"></div>' +
          '<div class="field"><label>目的地</label><input id="seg-to" value="' + UI.esc(seg ? seg.to || '' : '') + '" placeholder="如：广州"></div></div>' +
          '<div class="field"><label>交通方式</label><select id="seg-transport">' +
            Object.keys(TRANSPORT_NAMES).map(function(k) { return '<option value="' + k + '"' + (seg && seg.transport === k ? ' selected' : '') + '>' + TRANSPORT_ICONS[k] + ' ' + TRANSPORT_NAMES[k] + '</option>'; }).join('') +
          '</select></div>' +
          '<div class="two"><div class="field"><label>出发时间</label><input id="seg-depart" type="datetime-local" value="' + (seg && seg.depart ? seg.depart.slice(0, 16) : '') + '"></div>' +
          '<div class="field"><label>到达时间</label><input id="seg-arrive" type="datetime-local" value="' + (seg && seg.arrive ? seg.arrive.slice(0, 16) : '') + '"></div></div>'
        : '<div class="field"><label>停留城市</label><input id="seg-city" value="' + UI.esc(seg ? seg.city || '' : '') + '" placeholder="如：阜阳"></div>' +
          '<div class="two"><div class="field"><label>开始</label><input id="seg-start" type="date" value="' + (seg ? seg.start || '' : '') + '"></div>' +
          '<div class="field"><label>结束</label><input id="seg-end" type="date" value="' + (seg ? seg.end || '' : '') + '"></div></div>') +
      '<div class="field"><label>备注（可选）</label><input id="seg-note" value="' + UI.esc(seg ? seg.note || '' : '') + '" placeholder="如：航班号、酒店名"></div>' +
      '<div class="foot"><button class="btn ghost" data-x="1">取消</button><button class="btn" data-save-seg="1">保存</button></div>'
    );
    const modal = document.querySelector('.modal');
    modal.querySelector('[data-x]').addEventListener('click', function() { UI.closeModal(); });
    // 类型切换时重新渲染表单
    modal.querySelector('#seg-kind').addEventListener('change', function() {
      UI.closeModal();
      const newKind = this.value;
      const tempSeg = seg ? Object.assign({}, seg, { kind: newKind }) : { kind: newKind };
      // 临时保存到一个变量，重新打开表单
      window._tempSeg = tempSeg;
      openSegFormWithSeg(trip, idx, tempSeg);
    });
    modal.querySelector('[data-save-seg]').addEventListener('click', async function() {
      const k = document.getElementById('seg-kind').value;
      let obj;
      if (k === 'transport') {
        obj = { kind: 'transport', from: document.getElementById('seg-from').value.trim(), to: document.getElementById('seg-to').value.trim(), transport: document.getElementById('seg-transport').value, depart: document.getElementById('seg-depart').value, arrive: document.getElementById('seg-arrive').value, note: document.getElementById('seg-note').value.trim() };
      } else {
        obj = { kind: 'stay', city: document.getElementById('seg-city').value.trim(), start: document.getElementById('seg-start').value, end: document.getElementById('seg-end').value, note: document.getElementById('seg-note').value.trim() };
      }
      if (!trip.segments) trip.segments = [];
      if (isEdit) trip.segments[idx] = obj; else trip.segments.push(obj);
      await DB.put('trips', trip);
      UI.closeModal();
      UI.toast('已保存');
      App.render();
    });
  }

  function openSegFormWithSeg(trip, idx, seg) {
    // 用指定 seg 打开表单（用于类型切换）
    const isEdit = idx != null;
    const kind = seg.kind;
    UI.openModal(
      '<h3>' + (isEdit ? '编辑行程段' : '添加行程段') + '</h3>' +
      '<div class="field"><label>类型</label><select id="seg-kind">' +
        '<option value="transport" ' + (kind === 'transport' ? 'selected' : '') + '>🚄 交通段</option>' +
        '<option value="stay" ' + (kind === 'stay' ? 'selected' : '') + '>🏨 停留段</option>' +
      '</select></div>' +
      (kind === 'transport'
        ? '<div class="two"><div class="field"><label>出发地</label><input id="seg-from" value="' + UI.esc(seg.from || '') + '"></div>' +
          '<div class="field"><label>目的地</label><input id="seg-to" value="' + UI.esc(seg.to || '') + '"></div></div>' +
          '<div class="field"><label>交通方式</label><select id="seg-transport">' +
            Object.keys(TRANSPORT_NAMES).map(function(k) { return '<option value="' + k + '"' + (seg.transport === k ? ' selected' : '') + '>' + TRANSPORT_ICONS[k] + ' ' + TRANSPORT_NAMES[k] + '</option>'; }).join('') +
          '</select></div>' +
          '<div class="two"><div class="field"><label>出发时间</label><input id="seg-depart" type="datetime-local" value="' + (seg.depart ? seg.depart.slice(0, 16) : '') + '"></div>' +
          '<div class="field"><label>到达时间</label><input id="seg-arrive" type="datetime-local" value="' + (seg.arrive ? seg.arrive.slice(0, 16) : '') + '"></div></div>'
        : '<div class="field"><label>停留城市</label><input id="seg-city" value="' + UI.esc(seg.city || '') + '"></div>' +
          '<div class="two"><div class="field"><label>开始</label><input id="seg-start" type="date" value="' + seg.start || '' + '"></div>' +
          '<div class="field"><label>结束</label><input id="seg-end" type="date" value="' + seg.end || '' + '"></div></div>') +
      '<div class="field"><label>备注</label><input id="seg-note" value="' + UI.esc(seg.note || '') + '"></div>' +
      '<div class="foot"><button class="btn ghost" data-x="1">取消</button><button class="btn" data-save-seg="1">保存</button></div>'
    );
    const modal = document.querySelector('.modal');
    modal.querySelector('[data-x]').addEventListener('click', function() { UI.closeModal(); });
    modal.querySelector('#seg-kind').addEventListener('change', function() {
      UI.closeModal();
      const newKind = this.value;
      const tempSeg = Object.assign({}, seg, { kind: newKind });
      openSegFormWithSeg(trip, idx, tempSeg);
    });
    modal.querySelector('[data-save-seg]').addEventListener('click', async function() {
      const k = document.getElementById('seg-kind').value;
      let obj;
      if (k === 'transport') {
        obj = { kind: 'transport', from: document.getElementById('seg-from').value.trim(), to: document.getElementById('seg-to').value.trim(), transport: document.getElementById('seg-transport').value, depart: document.getElementById('seg-depart').value, arrive: document.getElementById('seg-arrive').value, note: document.getElementById('seg-note').value.trim() };
      } else {
        obj = { kind: 'stay', city: document.getElementById('seg-city').value.trim(), start: document.getElementById('seg-start').value, end: document.getElementById('seg-end').value, note: document.getElementById('seg-note').value.trim() };
      }
      if (!trip.segments) trip.segments = [];
      if (isEdit) trip.segments[idx] = obj; else trip.segments.push(obj);
      await DB.put('trips', trip);
      UI.closeModal();
      UI.toast('已保存');
      App.render();
    });
  }

  // ===== 智能打包清单（根据行程天数、人数、天气、交通方式） =====
  function genPackingList(trip) {
    const days = trip.days || 3;
    const people = trip.people || 2;
    const items = [];
    // 基础
    items.push({ cat: '证件', name: '身份证', qty: people, unit: '个' });
    items.push({ cat: '证件', name: '手机+充电器', qty: people, unit: '套' });
    items.push({ cat: '衣物', name: '内衣袜子', qty: days * people, unit: '套' });
    items.push({ cat: '衣物', name: '外套', qty: people, unit: '件' });
    items.push({ cat: '洗漱', name: '牙刷牙膏', qty: people, unit: '套' });
    items.push({ cat: '洗漱', name: '毛巾', qty: people, unit: '条' });
    items.push({ cat: '药品', name: '常用药（感冒/肠胃）', qty: 1, unit: '盒' });
    // 交通方式相关
    if (trip.segments) {
      const hasPlane = trip.segments.some(function(s) { return s.kind === 'transport' && s.transport === 'plane'; });
      const hasTrain = trip.segments.some(function(s) { return s.kind === 'transport' && s.transport === 'train'; });
      if (hasPlane) items.push({ cat: '证件', name: '机票/登机牌', qty: people, unit: '张' });
      if (hasTrain) items.push({ cat: '证件', name: '车票', qty: people, unit: '张' });
    }
    return items;
  }

  // ===== 页面主体 =====
  async function body() {
    const trips = await DB.getAll('trips');
    const members = await DB.getAll('members');

    let html = '';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">' +
      '<h3 style="margin:0;font-size:18px;font-weight:800;">✈️ 旅行规划</h3>' +
      '<button class="btn sm" data-new-trip="1">+ 新建旅行</button>' +
    '</div>';

    if (!trips.length) {
      html += '<div class="card" style="text-align:center;padding:40px 20px;">' +
        '<div style="font-size:48px;margin-bottom:12px;">🧳</div>' +
        '<div style="font-size:15px;font-weight:600;margin-bottom:6px;">还没有旅行计划</div>' +
        '<div style="color:var(--sub);font-size:13px;margin-bottom:16px;">点右上角新建，开始规划下一次出行</div>' +
        '<button class="btn" data-new-trip="1">+ 创建旅行</button></div>';
      return html;
    }

    trips.forEach(function(trip) {
      ensureSegments(trip);
      const isOpen = trip._open;
      const transportCount = trip.segments.filter(function(s) { return s.kind === 'transport'; }).length;
      const stayCount = trip.segments.filter(function(s) { return s.kind === 'stay'; }).length;
      html += '<div class="card" style="margin-bottom:14px;">' +
        '<div style="display:flex;align-items:center;gap:10px;cursor:pointer;" data-toggle-trip="' + trip.id + '">' +
          '<div style="font-size:28px;">' + (trip.emoji || '🧳') + '</div>' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-weight:700;font-size:15px;">' + UI.esc(trip.name || '未命名旅行') + '</div>' +
            '<div style="font-size:12px;color:var(--sub);">' + (trip.start_date || '') + ' ~ ' + (trip.end_date || '') + ' · ' + transportCount + '段交通 · ' + stayCount + '段停留</div>' +
          '</div>' +
          '<span style="font-size:18px;color:var(--sub);">' + (isOpen ? '▲' : '▼') + '</span>' +
        '</div>';

      if (isOpen) {
        html += '<div style="margin-top:14px;border-top:2px solid var(--border);padding-top:14px;">';
        // 行程时间轴
        html += '<div class="section-title">🗺️ 行程时间轴</div>';
        html += timelineHtml(trip);
        html += '<button class="btn sm ghost" data-add-seg="' + trip.id + '" style="margin-top:8px;">+ 添加行程段</button>';

        // 操作按钮
        html += '<div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;">' +
          '<button class="btn sm" data-gen-packing="' + trip.id + '">📦 生成打包清单</button>' +
          '<button class="btn sm ghost" data-gen-tasks="' + trip.id + '">🎫 生成购票任务</button>' +
          '<button class="btn sm ghost" data-ai-trip="' + trip.id + '">✨ AI 生成行程</button>' +
          '<button class="btn sm ghost" data-edit-trip="' + trip.id + '">编辑</button>' +
          '<button class="btn sm ghost" data-del-trip="' + trip.id + '" style="color:var(--red);">删除</button>' +
        '</div>';

        // 打包清单
        if (trip.packing && trip.packing.length) {
          html += '<div class="section-title" style="margin-top:14px;">📦 打包清单（' + trip.packing.filter(function(p){return p.done;}).length + '/' + trip.packing.length + '）</div>';
          html += '<div class="card" style="padding:8px 12px;">';
          trip.packing.forEach(function(p, pi) {
            html += '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;' + (pi < trip.packing.length - 1 ? 'border-bottom:1px solid var(--border);' : '') + '">' +
              '<div class="t-check' + (p.done ? ' checked' : '') + '" data-pack-toggle="' + trip.id + '|' + pi + '">' + (p.done ? '✓' : '') + '</div>' +
              '<span style="flex:1;' + (p.done ? 'text-decoration:line-through;color:var(--sub);' : '') + '">' + UI.esc(p.name) + '</span>' +
              '<span style="font-size:12px;color:var(--sub);">' + p.qty + (p.unit || '') + '</span>' +
            '</div>';
          });
          html += '</div>';
        }
        html += '</div>';
      }
      html += '</div>';
    });

    return html;
  }

  // ===== 新建/编辑旅行表单 =====
  function openTripForm(trip) {
    UI.openModal(
      '<h3>' + (trip ? '编辑旅行' : '新建旅行') + '</h3>' +
      '<div class="field"><label>旅行名称</label><input id="tp-name" value="' + UI.esc(trip ? trip.name || '' : '') + '" placeholder="如：国庆回老家"></div>' +
      '<div class="two">' +
        '<div class="field"><label>开始日期</label><input id="tp-start" type="date" value="' + (trip ? trip.start_date || '' : '') + '"></div>' +
        '<div class="field"><label>结束日期</label><input id="tp-end" type="date" value="' + (trip ? trip.end_date || '' : '') + '"></div>' +
      '</div>' +
      '<div class="two">' +
        '<div class="field"><label>出行人数</label><input id="tp-people" type="number" min="1" value="' + (trip ? trip.people || 2 : 2) + '"></div>' +
        '<div class="field"><label>预算（元）</label><input id="tp-budget" type="number" min="0" value="' + (trip ? trip.budget || 0 : 0) + '"></div>' +
      '</div>' +
      '<div class="field"><label>出发地</label><input id="tp-origin" value="' + UI.esc(trip ? trip.origin || '阳江' : '阳江') + '"></div>' +
      '<div class="foot"><button class="btn ghost" data-x="1">取消</button><button class="btn" data-save-trip="1">保存</button></div>'
    );
    const modal = document.querySelector('.modal');
    modal.querySelector('[data-x]').addEventListener('click', function() { UI.closeModal(); });
    modal.querySelector('[data-save-trip]').addEventListener('click', async function() {
      const name = document.getElementById('tp-name').value.trim();
      if (!name) { UI.toast('请填写旅行名称'); return; }
      const start = document.getElementById('tp-start').value;
      const end = document.getElementById('tp-end').value;
      const people = +document.getElementById('tp-people').value || 2;
      const budget = +document.getElementById('tp-budget').value || 0;
      const origin = document.getElementById('tp-origin').value.trim();
      let days = 1;
      if (start && end) {
        days = Math.max(1, Math.round((new Date(end) - new Date(start)) / 86400000) + 1);
      }
      const obj = { name: name, start_date: start, end_date: end, people: people, budget: budget, origin: origin, days: days, emoji: '🧳' };
      if (trip) { obj.id = trip.id; obj.segments = trip.segments; obj.packing = trip.packing; }
      if (trip) await DB.put('trips', obj); else await DB.add('trips', obj);
      UI.closeModal();
      UI.toast('已保存');
      App.render();
    });
  }

  // ===== 生成购票任务 =====
  async function genTripTasks(trip) {
    if (!trip.segments || !trip.segments.length) { UI.toast('请先添加行程段'); return; }
    let count = 0;
    trip.segments.forEach(function(seg) {
      if (seg.kind === 'transport' && seg.transport !== 'car' && seg.transport !== 'other' && seg.depart) {
        const icon = TRANSPORT_ICONS[seg.transport] || '';
        const name = TRANSPORT_NAMES[seg.transport] || '交通';
        DB.add('tasks', {
          title: icon + ' 购票：' + seg.from + '→' + seg.to + '（' + name + '）',
          due: seg.depart.slice(0, 10),
          time: seg.depart.slice(11, 16) || '',
          done: false,
          source: 'trip',
          note: '出发时间：' + seg.depart + (seg.note ? '，备注：' + seg.note : '')
        });
        count++;
      }
    });
    UI.toast(count > 0 ? '已生成' + count + '个购票任务' : '没有需要购票的交通段（自驾无需购票）');
  }

  // ===== 事件绑定 =====
  function bind(root) {
    root.addEventListener('click', async function(e) {
      const t = e.target.closest('[data-new-trip],[data-toggle-trip],[data-edit-trip],[data-del-trip],[data-add-seg],[data-edit-seg],[data-del-seg],[data-gen-packing],[data-gen-tasks],[data-ai-trip],[data-pack-toggle]');
      if (!t) return;

      if (t.getAttribute('data-new-trip')) {
        openTripForm(null);
      } else if (t.getAttribute('data-toggle-trip')) {
        const id = +t.getAttribute('data-toggle-trip');
        const trips = await DB.getAll('trips');
        const trip = trips.find(function(x) { return x.id === id; });
        if (trip) { trip._open = !trip._open; App.render(); }
      } else if (t.getAttribute('data-edit-trip')) {
        const id = +t.getAttribute('data-edit-trip');
        const trip = await DB.get('trips', id);
        if (trip) openTripForm(trip);
      } else if (t.getAttribute('data-del-trip')) {
        if (confirm('确定删除这个旅行计划？')) {
          await DB.del('trips', +t.getAttribute('data-del-trip'));
          UI.toast('已删除');
          App.render();
        }
      } else if (t.getAttribute('data-add-seg')) {
        const id = +t.getAttribute('data-add-seg');
        const trip = await DB.get('trips', id);
        if (trip) { ensureSegments(trip); openSegForm(trip, null); }
      } else if (t.getAttribute('data-edit-seg')) {
        const idx = +t.getAttribute('data-edit-seg');
        const card = t.closest('.card');
        const toggleBtn = card.querySelector('[data-toggle-trip]');
        const id = +toggleBtn.getAttribute('data-toggle-trip');
        const trip = await DB.get('trips', id);
        if (trip) { ensureSegments(trip); openSegForm(trip, idx); }
      } else if (t.getAttribute('data-del-seg')) {
        const idx = +t.getAttribute('data-del-seg');
        const card = t.closest('.card');
        const toggleBtn = card.querySelector('[data-toggle-trip]');
        const id = +toggleBtn.getAttribute('data-toggle-trip');
        const trip = await DB.get('trips', id);
        if (trip && trip.segments) {
          trip.segments.splice(idx, 1);
          await DB.put('trips', trip);
          UI.toast('已删除');
          App.render();
        }
      } else if (t.getAttribute('data-gen-packing')) {
        const id = +t.getAttribute('data-gen-packing');
        const trip = await DB.get('trips', id);
        if (trip) {
          trip.packing = genPackingList(trip).map(function(p) { return Object.assign({ done: false }, p); });
          await DB.put('trips', trip);
          UI.toast('已生成打包清单（' + trip.packing.length + '项）');
          App.render();
        }
      } else if (t.getAttribute('data-gen-tasks')) {
        const id = +t.getAttribute('data-gen-tasks');
        const trip = await DB.get('trips', id);
        if (trip) { ensureSegments(trip); genTripTasks(trip); }
      } else if (t.getAttribute('data-ai-trip')) {
        const id = +t.getAttribute('data-ai-trip');
        const trip = await DB.get('trips', id);
        if (trip && typeof AI !== 'undefined' && AI.genTrip) {
          UI.toast('AI 正在生成行程…');
          const r = await AI.genTrip(trip);
          if (r.ok && r.segments) {
            trip.segments = r.segments;
            await DB.put('trips', trip);
            UI.toast('AI 行程已生成');
            App.render();
          } else {
            UI.toast('AI 生成失败，请检查接口配置');
          }
        } else {
          UI.toast('请先在设置页配置 AI 接口');
        }
      } else if (t.getAttribute('data-pack-toggle')) {
        const parts = t.getAttribute('data-pack-toggle').split('|');
        const id = +parts[0], pi = +parts[1];
        const trip = await DB.get('trips', id);
        if (trip && trip.packing && trip.packing[pi]) {
          trip.packing[pi].done = !trip.packing[pi].done;
          await DB.put('trips', trip);
          App.render();
        }
      }
    });
  }

  return { body: body, bind: bind };
})();
