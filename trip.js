/* 朱林之家 - 旅行模块 v2
   多目的地分段行程 + 时间轴可视化 + 智能打包清单 + 沿途天气 + 预算 + 打卡 + AI */
const TripPage = (function() {
  const TRANSPORT_ICONS = { plane: '✈️', train: '🚄', car: '🚗', bus: '🚌', ship: '🚢', other: '🚶' };
  const TRANSPORT_NAMES = { plane: '飞机', train: '高铁/火车', car: '自驾', bus: '大巴', ship: '轮船', other: '其他' };
  const PACK_CATS = ['证件', '衣物', '洗漱', '药品', '电子', '其他'];

  function fmtDate(d) {
    if (!d) return '';
    return d.length > 10 ? d.slice(0, 16).replace('T', ' ') : d;
  }
  function fmtShort(d) {
    if (!d) return '';
    return d.length >= 10 ? d.slice(5, 10) : d;
  }

  // 确保有 segments（旧数据迁移）
  function ensureSegments(trip) {
    if (trip.segments && trip.segments.length) return trip;
    trip.segments = [];
    if (trip.destinations && trip.destinations.length) {
      trip.destinations.forEach(function(d, i) {
        if (i === 0) trip.segments.push({ kind: 'transport', from: trip.origin || '家', to: d.name, transport: 'car', depart: '', arrive: '', note: '' });
        else trip.segments.push({ kind: 'transport', from: trip.destinations[i-1].name, to: d.name, transport: 'car', depart: '', arrive: '', note: '' });
        trip.segments.push({ kind: 'stay', city: d.name, start: d.arrive || '', end: d.leave || '', note: d.note || '' });
      });
      const last = trip.destinations[trip.destinations.length - 1];
      trip.segments.push({ kind: 'transport', from: last.name, to: trip.origin || '家', transport: 'car', depart: '', arrive: '', note: '返程' });
    }
    return trip;
  }

  // 获取行程中所有城市
  function getCities(trip) {
    const cities = [];
    (trip.segments || []).forEach(function(s) {
      if (s.kind === 'transport') {
        if (s.from && cities.indexOf(s.from) < 0) cities.push(s.from);
        if (s.to && cities.indexOf(s.to) < 0) cities.push(s.to);
      } else if (s.kind === 'stay') {
        if (s.city && cities.indexOf(s.city) < 0) cities.push(s.city);
      }
    });
    return cities;
  }

  // 计算旅行天数
  function calcDays(trip) {
    if (trip.days) return trip.days;
    if (trip.startDate && trip.endDate) {
      const s = new Date(trip.startDate), e = new Date(trip.endDate);
      return Math.max(1, Math.round((e - s) / 86400000) + 1);
    }
    return 3;
  }

  // 智能打包清单
  function genPackingList(trip) {
    const days = calcDays(trip);
    const people = trip.people || 2;
    const cities = getCities(trip);
    const hasPlane = (trip.segments || []).some(function(s) { return s.transport === 'plane'; });
    const items = [];
    items.push({ cat: '证件', name: '身份证', qty: people, unit: '个', checked: false });
    if (hasPlane) items.push({ cat: '证件', name: '护照/签证', qty: people, unit: '本', checked: false });
    items.push({ cat: '证件', name: '手机+充电器', qty: people, unit: '套', checked: false });
    items.push({ cat: '证件', name: '充电宝', qty: Math.ceil(people / 2), unit: '个', checked: false });
    items.push({ cat: '衣物', name: '内衣袜子', qty: days * people, unit: '套', checked: false });
    items.push({ cat: '衣物', name: '外套', qty: people, unit: '件', checked: false });
    items.push({ cat: '衣物', name: '裤子/裙子', qty: Math.ceil(days / 2) * people, unit: '件', checked: false });
    items.push({ cat: '衣物', name: '睡衣', qty: people, unit: '套', checked: false });
    items.push({ cat: '衣物', name: '舒适鞋子', qty: people, unit: '双', checked: false });
    items.push({ cat: '洗漱', name: '牙刷牙膏', qty: people, unit: '套', checked: false });
    items.push({ cat: '洗漱', name: '洗面奶', qty: 1, unit: '瓶', checked: false });
    items.push({ cat: '洗漱', name: '护肤品', qty: 1, unit: '套', checked: false });
    items.push({ cat: '洗漱', name: '毛巾', qty: people, unit: '条', checked: false });
    items.push({ cat: '药品', name: '感冒药', qty: 1, unit: '盒', checked: false });
    items.push({ cat: '药品', name: '肠胃药', qty: 1, unit: '盒', checked: false });
    items.push({ cat: '药品', name: '创可贴', qty: 10, unit: '片', checked: false });
    items.push({ cat: '药品', name: '晕车药', qty: people, unit: '片', checked: false });
    items.push({ cat: '电子', name: '充电器', qty: people, unit: '个', checked: false });
    items.push({ cat: '电子', name: '耳机', qty: people, unit: '副', checked: false });
    items.push({ cat: '其他', name: '雨伞', qty: Math.ceil(people / 2), unit: '把', checked: false });
    items.push({ cat: '其他', name: '水杯', qty: people, unit: '个', checked: false });
    items.push({ cat: '其他', name: '零食', qty: 1, unit: '袋', checked: false });
    return items;
  }

  // 沿途天气 HTML（async）
  async function weatherHtml(trip) {
    const cities = getCities(trip);
    if (!cities.length) return '<div class="empty-hint">暂无城市天气</div>';
    let html = '<div class="weather-row">';
    for (const city of cities) {
      try {
        const w = (typeof Weather !== 'undefined' && Weather.fetchCity) ? await Weather.fetchCity(city) : null;
        if (w) {
          html += '<div class="weather-card"><div class="wc-city">' + city + '</div>' +
            '<div class="wc-icon">' + (w.emoji || w.icon || '🌈') + '</div>' +
            '<div class="wc-temp">' + w.temp + '°</div>' +
            '<div class="wc-text">' + (w.text || '') + '</div></div>';
        } else {
          html += '<div class="weather-card"><div class="wc-city">' + city + '</div><div class="wc-icon">🌈</div><div class="wc-temp">--</div><div class="wc-text">暂无数据</div></div>';
        }
      } catch(e) {
        html += '<div class="weather-card"><div class="wc-city">' + city + '</div><div class="wc-icon">🌈</div><div class="wc-temp">--</div><div class="wc-text">获取失败</div></div>';
      }
    }
    html += '</div>';
    return html;
  }

  // 打包清单 HTML
  function packingHtml(trip) {
    const items = trip.packing || [];
    if (!items.length) return '<div class="empty-hint">暂无物品，点击"生成打包清单"或手动添加</div>';
    let html = '';
    PACK_CATS.forEach(function(cat) {
      const catItems = items.filter(function(i) { return i.cat === cat; });
      if (!catItems.length) return;
      const checked = catItems.filter(function(i) { return i.checked; }).length;
      html += '<div class="pack-cat"><div class="pc-title">' + cat + ' <span class="pc-count">(' + checked + '/' + catItems.length + ')</span></div>';
      catItems.forEach(function(item, idx) {
        const realIdx = items.indexOf(item);
        html += '<div class="pack-item' + (item.checked ? ' done' : '') + '">' +
          '<label class="pi-check"><input type="checkbox" data-pack-check="' + realIdx + '" ' + (item.checked ? 'checked' : '') + '></label>' +
          '<span class="pi-name">' + item.name + '</span>' +
          '<span class="pi-qty">' + item.qty + (item.unit || '') + '</span>' +
          '<button class="btn sm ghost" data-pack-del="' + realIdx + '">删</button></div>';
      });
      html += '</div>';
    });
    // 未分类
    const otherItems = items.filter(function(i) { return PACK_CATS.indexOf(i.cat) < 0; });
    if (otherItems.length) {
      html += '<div class="pack-cat"><div class="pc-title">其他</div>';
      otherItems.forEach(function(item) {
        const realIdx = items.indexOf(item);
        html += '<div class="pack-item' + (item.checked ? ' done' : '') + '">' +
          '<label class="pi-check"><input type="checkbox" data-pack-check="' + realIdx + '" ' + (item.checked ? 'checked' : '') + '></label>' +
          '<span class="pi-name">' + item.name + '</span>' +
          '<span class="pi-qty">' + item.qty + (item.unit || '') + '</span>' +
          '<button class="btn sm ghost" data-pack-del="' + realIdx + '">删</button></div>';
      });
      html += '</div>';
    }
    return html;
  }

  // 行程时间轴 HTML
  function timelineHtml(trip) {
    const segs = trip.segments || [];
    if (!segs.length) return '<div class="empty-hint">暂无行程段，点击编辑添加</div>';
    let html = '<div class="trip-timeline">';
    segs.forEach(function(s, idx) {
      if (s.kind === 'transport') {
        html += '<div class="tl-item tl-transport">' +
          '<div class="tl-icon">' + (TRANSPORT_ICONS[s.transport] || '🚶') + '</div>' +
          '<div class="tl-content"><div class="tl-title">' + (TRANSPORT_NAMES[s.transport] || '交通') + '：' + s.from + ' → ' + s.to + '</div>' +
          '<div class="tl-time">' + fmtDate(s.depart) + (s.arrive ? ' → ' + fmtDate(s.arrive) : '') + '</div>' +
          (s.note ? '<div class="tl-note">' + s.note + '</div>' : '') + '</div></div>';
      } else {
        html += '<div class="tl-item tl-stay">' +
          '<div class="tl-icon">🏨</div>' +
          '<div class="tl-content"><div class="tl-title">停留：' + s.city + '</div>' +
          '<div class="tl-time">' + fmtShort(s.start) + (s.end ? ' ~ ' + fmtShort(s.end) : '') + '</div>' +
          (s.note ? '<div class="tl-note">' + s.note + '</div>' : '') + '</div></div>';
      }
    });
    html += '</div>';
    return html;
  }

  // 打卡清单 HTML
  function checklistHtml(trip) {
    const items = trip.checklist || [];
    if (!items.length) return '<div class="empty-hint">暂无打卡点</div>';
    let html = '<div class="check-list">';
    items.forEach(function(item, idx) {
      html += '<div class="check-item' + (item.done ? ' done' : '') + '">' +
        '<label><input type="checkbox" data-check-toggle="' + idx + '" ' + (item.done ? 'checked' : '') + '></label>' +
        '<span>' + item.name + '</span>' +
        '<button class="btn sm ghost" data-check-del="' + idx + '">删</button></div>';
    });
    html += '</div>';
    return html;
  }

  // 旅行详情 body（async，因为天气）
  async function detailBody(trip) {
    ensureSegments(trip);
    const days = calcDays(trip);
    const cities = getCities(trip);
    const weather = await weatherHtml(trip);

    let html = '<div class="trip-detail">' +
      '<div class="td-header"><h2>' + trip.name + '</h2>' +
      '<div class="td-meta">' + (trip.startDate || '') + (trip.endDate ? ' ~ ' + trip.endDate : '') + ' · ' + (trip.people || 2) + '人 · ' + days + '天' +
      (trip.budget ? ' · 预算¥' + trip.budget : '') + '</div></div>' +

      '<div class="td-actions">' +
      '<button class="btn sm" data-trip-edit="' + trip.id + '">✏️ 编辑</button>' +
      '<button class="btn sm" data-trip-gen-pack="' + trip.id + '">🎒 生成打包清单</button>' +
      '<button class="btn sm" data-trip-gen-tickets="' + trip.id + '">🎫 生成购票任务</button>' +
      '<button class="btn sm" data-trip-ai="' + trip.id + '">🤖 AI生成行程</button>' +
      '<button class="btn sm danger" data-trip-del="' + trip.id + '">🗑️ 删除</button>' +
      '</div>' +

      '<div class="td-section"><h3>📍 行程时间轴</h3>' + timelineHtml(trip) + '</div>' +

      '<div class="td-section"><h3>🌤️ 沿途天气</h3>' + weather + '</div>' +

      '<div class="td-section"><h3>🎒 打包清单 <button class="btn sm ghost" data-pack-add="' + trip.id + '">+ 添加物品</button></h3>' +
      packingHtml(trip) + '</div>' +

      '<div class="td-section"><h3>📸 打卡清单 <button class="btn sm ghost" data-check-add="' + trip.id + '">+ 添加打卡点</button></h3>' +
      checklistHtml(trip) + '</div>' +

      '<div class="td-section"><h3>💰 旅行预算</h3>' +
      '<div class="budget-info">总预算：¥' + (trip.budget || 0) +
      ' · 已花：¥' + (trip.spent || 0) +
      ' · 剩余：¥' + ((trip.budget || 0) - (trip.spent || 0)) + '</div></div>' +

      '</div>';
    return html;
  }

  // 编辑表单 HTML
  function editForm(trip) {
    ensureSegments(trip);
    const t = trip || { name: '', startDate: '', endDate: '', people: 2, budget: '', origin: '', segments: [], packing: [], checklist: [] };
    let segsHtml = '';
    (t.segments || []).forEach(function(s, idx) {
      if (s.kind === 'transport') {
        segsHtml += '<div class="seg-row" data-seg-idx="' + idx + '">' +
          '<div class="seg-kind">🚗 交通</div>' +
          '<select data-seg-transport="' + idx + '">' +
          Object.keys(TRANSPORT_NAMES).map(function(k) { return '<option value="' + k + '"' + (s.transport === k ? ' selected' : '') + '>' + TRANSPORT_ICONS[k] + ' ' + TRANSPORT_NAMES[k] + '</option>'; }).join('') +
          '</select>' +
          '<input type="text" data-seg-from="' + idx + '" placeholder="出发地" value="' + (s.from || '') + '">' +
          '<input type="text" data-seg-to="' + idx + '" placeholder="目的地" value="' + (s.to || '') + '">' +
          '<input type="datetime-local" data-seg-depart="' + idx + '" value="' + (s.depart || '') + '">' +
          '<input type="datetime-local" data-seg-arrive="' + idx + '" value="' + (s.arrive || '') + '">' +
          '<button class="btn sm danger" data-seg-del="' + idx + '">删</button></div>';
      } else {
        segsHtml += '<div class="seg-row" data-seg-idx="' + idx + '">' +
          '<div class="seg-kind">🏨 停留</div>' +
          '<input type="text" data-seg-city="' + idx + '" placeholder="城市" value="' + (s.city || '') + '">' +
          '<input type="date" data-seg-start="' + idx + '" value="' + (s.start || '') + '">' +
          '<input type="date" data-seg-end="' + idx + '" value="' + (s.end || '') + '">' +
          '<input type="text" data-seg-note="' + idx + '" placeholder="备注/酒店" value="' + (s.note || '') + '">' +
          '<button class="btn sm danger" data-seg-del="' + idx + '">删</button></div>';
      }
    });

    return '<div class="trip-edit-form">' +
      '<div class="form-row"><label>旅行名称</label><input type="text" id="te-name" value="' + (t.name || '') + '" placeholder="如：国庆回老家"></div>' +
      '<div class="form-row"><label>出发日期</label><input type="date" id="te-start" value="' + (t.startDate || '') + '"></div>' +
      '<div class="form-row"><label>返回日期</label><input type="date" id="te-end" value="' + (t.endDate || '') + '"></div>' +
      '<div class="form-row"><label>人数</label><input type="number" id="te-people" value="' + (t.people || 2) + '" min="1"></div>' +
      '<div class="form-row"><label>预算(元)</label><input type="number" id="te-budget" value="' + (t.budget || '') + '" placeholder="可选"></div>' +

      '<div class="form-row"><label>行程分段</label>' +
      '<div class="seg-list">' + segsHtml + '</div>' +
      '<div class="seg-add-btns">' +
      '<button class="btn sm" data-add-transport>+ 添加交通段</button>' +
      '<button class="btn sm" data-add-stay>+ 添加停留段</button>' +
      '</div></div>' +

      '<div class="form-actions">' +
      '<button class="btn primary" data-trip-save="' + (t.id || '') + '">💾 保存</button>' +
      '<button class="btn" data-trip-cancel>取消</button>' +
      '</div></div>';
  }

  // 主页面 body
  async function body() {
    if (window._tripEditing) {
      return '<div class="page-head"><h2>✏️ ' + (window._tripEditing.id ? '编辑旅行' : '新建旅行') + '</h2></div>' + editForm(window._tripEditing);
    }
    const trips = await DB.getAll('trips');
    const expanded = window._tripExpanded || null;

    if (!trips.length) {
      return '<div class="page-head"><h2>✈️ 旅行规划</h2><button class="btn primary" data-trip-new>+ 新建旅行</button></div>' +
        '<div class="empty-state"><div class="empty-icon">🧳</div><p>还没有旅行计划</p><button class="btn primary" data-trip-new>创建第一次旅行</button></div>';
    }

    let html = '<div class="page-head"><h2>✈️ 旅行规划</h2><button class="btn primary" data-trip-new>+ 新建旅行</button></div>';
    html += '<div class="trip-list">';

    for (const trip of trips) {
      ensureSegments(trip);
      const days = calcDays(trip);
      const cities = getCities(trip);
      const isOpen = expanded === trip.id;
      const transportCount = (trip.segments || []).filter(function(s) { return s.kind === 'transport'; }).length;
      const stayCount = (trip.segments || []).filter(function(s) { return s.kind === 'stay'; }).length;

      html += '<div class="trip-card' + (isOpen ? ' open' : '') + '">' +
        '<div class="tc-head" data-trip-toggle="' + trip.id + '">' +
        '<div class="tc-icon">🧳</div>' +
        '<div class="tc-info"><div class="tc-name">' + trip.name + '</div>' +
        '<div class="tc-meta">' + (trip.startDate || '') + (trip.endDate ? ' ~ ' + trip.endDate : '') + ' · ' + (trip.people || 2) + '人 · ' + days + '天 · ' + cities.join('→') + '</div>' +
        '<div class="tc-sub">' + transportCount + '段交通 · ' + stayCount + '段停留</div></div>' +
        '<div class="tc-arrow">' + (isOpen ? '▲' : '▼') + '</div></div>';

      if (isOpen) {
        html += '<div class="tc-body" id="trip-body-' + trip.id + '">' + await detailBody(trip) + '</div>';
      }
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  // 事件绑定
  async function bind(root) {
    // 新建
    root.querySelectorAll('[data-trip-new]').forEach(function(el) {
      el.addEventListener('click', function() {
        window._tripEditing = { id: '', name: '', startDate: '', endDate: '', people: 2, budget: '', segments: [], packing: [], checklist: [] };
        App.render();
      });
    });

    // 展开/折叠
    root.querySelectorAll('[data-trip-toggle]').forEach(function(el) {
      el.addEventListener('click', function() {
        const id = +el.getAttribute('data-trip-toggle');
        window._tripExpanded = (window._tripExpanded === id) ? null : id;
        App.render();
      });
    });

    // 编辑
    root.querySelectorAll('[data-trip-edit]').forEach(function(el) {
      el.addEventListener('click', async function() {
        const id = +el.getAttribute('data-trip-edit');
        const trip = await DB.get('trips', id);
        if (trip) {
          window._tripEditing = trip;
          App.render();
        }
      });
    });

    // 删除
    root.querySelectorAll('[data-trip-del]').forEach(function(el) {
      el.addEventListener('click', async function() {
        if (!confirm('确定删除这个旅行计划？')) return;
        const id = +el.getAttribute('data-trip-del');
        await DB.del('trips', id);
        window._tripExpanded = null;
        UI.toast('已删除');
        App.render();
      });
    });

    // 生成打包清单
    root.querySelectorAll('[data-trip-gen-pack]').forEach(function(el) {
      el.addEventListener('click', async function() {
        const id = +el.getAttribute('data-trip-gen-pack');
        const trip = await DB.get('trips', id);
        if (!trip) return;
        trip.packing = genPackingList(trip);
        await DB.put('trips', trip);
        UI.toast('已生成打包清单');
        App.render();
      });
    });

    // 生成购票任务
    root.querySelectorAll('[data-trip-gen-tickets]').forEach(function(el) {
      el.addEventListener('click', async function() {
        const id = +el.getAttribute('data-trip-gen-tickets');
        const trip = await DB.get('trips', id);
        if (!trip) return;
        ensureSegments(trip);
        let count = 0;
        (trip.segments || []).forEach(function(s) {
          if (s.kind === 'transport' && s.transport !== 'car' && s.transport !== 'other') {
            const due = s.depart ? s.depart.slice(0, 10) : (trip.startDate || '');
            DB.add('tasks', { title: '购票：' + (TRANSPORT_NAMES[s.transport] || '') + ' ' + s.from + '→' + s.to, due: due, time: s.depart ? s.depart.slice(11, 16) : '', member: '', note: '旅行「' + trip.name + '」' });
            count++;
          }
        });
        UI.toast(count ? '已生成' + count + '个购票任务' : '无需购票（自驾/其他）');
      });
    });

    // AI生成行程
    root.querySelectorAll('[data-trip-ai]').forEach(function(el) {
      el.addEventListener('click', async function() {
        const id = +el.getAttribute('data-trip-ai');
        const trip = await DB.get('trips', id);
        if (!trip) return;
        UI.toast('AI生成中...');
        try {
          if (typeof AI !== 'undefined' && AI.genTrip) {
            const result = await AI.genTrip(trip);
            if (result && result.segments) {
              trip.segments = result.segments;
              await DB.put('trips', trip);
              UI.toast('AI行程已生成');
              App.render();
            } else {
              UI.toast('AI暂不可用，使用本地推荐');
            }
          } else {
            UI.toast('AI功能暂未配置');
          }
        } catch(e) {
          UI.toast('AI生成失败');
        }
      });
    });

    // 打包清单勾选
    root.querySelectorAll('[data-pack-check]').forEach(function(el) {
      el.addEventListener('change', async function() {
        const idx = +el.getAttribute('data-pack-check');
        const tripId = window._tripExpanded;
        const trip = await DB.get('trips', tripId);
        if (trip && trip.packing && trip.packing[idx]) {
          trip.packing[idx].checked = el.checked;
          await DB.put('trips', trip);
        }
      });
    });

    // 打包清单删除
    root.querySelectorAll('[data-pack-del]').forEach(function(el) {
      el.addEventListener('click', async function() {
        const idx = +el.getAttribute('data-pack-del');
        const tripId = window._tripExpanded;
        const trip = await DB.get('trips', tripId);
        if (trip && trip.packing) {
          trip.packing.splice(idx, 1);
          await DB.put('trips', trip);
          App.render();
        }
      });
    });

    // 添加物品
    root.querySelectorAll('[data-pack-add]').forEach(function(el) {
      el.addEventListener('click', async function() {
        const name = prompt('物品名称：');
        if (!name) return;
        const qty = parseInt(prompt('数量：', '1')) || 1;
        const unit = prompt('单位（个/件/套等，可留空）：', '') || '';
        const cat = prompt('分类（证件/衣物/洗漱/药品/电子/其他）：', '其他') || '其他';
        const tripId = +el.getAttribute('data-pack-add');
        const trip = await DB.get('trips', tripId);
        if (trip) {
          trip.packing = trip.packing || [];
          trip.packing.push({ cat: cat, name: name, qty: qty, unit: unit, checked: false });
          await DB.put('trips', trip);
          App.render();
        }
      });
    });

    // 打卡点勾选
    root.querySelectorAll('[data-check-toggle]').forEach(function(el) {
      el.addEventListener('change', async function() {
        const idx = +el.getAttribute('data-check-toggle');
        const tripId = window._tripExpanded;
        const trip = await DB.get('trips', tripId);
        if (trip && trip.checklist && trip.checklist[idx]) {
          trip.checklist[idx].done = el.checked;
          await DB.put('trips', trip);
        }
      });
    });

    // 打卡点删除
    root.querySelectorAll('[data-check-del]').forEach(function(el) {
      el.addEventListener('click', async function() {
        const idx = +el.getAttribute('data-check-del');
        const tripId = window._tripExpanded;
        const trip = await DB.get('trips', tripId);
        if (trip && trip.checklist) {
          trip.checklist.splice(idx, 1);
          await DB.put('trips', trip);
          App.render();
        }
      });
    });

    // 添加打卡点
    root.querySelectorAll('[data-check-add]').forEach(function(el) {
      el.addEventListener('click', async function() {
        const name = prompt('打卡点名称：');
        if (!name) return;
        const tripId = +el.getAttribute('data-check-add');
        const trip = await DB.get('trips', tripId);
        if (trip) {
          trip.checklist = trip.checklist || [];
          trip.checklist.push({ name: name, done: false });
          await DB.put('trips', trip);
          App.render();
        }
      });
    });

    // === 编辑表单 ===
    if (window._tripEditing) {
      // 添加交通段
      root.querySelectorAll('[data-add-transport]').forEach(function(el) {
        el.addEventListener('click', function() {
          window._tripEditing.segments = window._tripEditing.segments || [];
          window._tripEditing.segments.push({ kind: 'transport', from: '', to: '', transport: 'car', depart: '', arrive: '', note: '' });
          App.render();
        });
      });
      // 添加停留段
      root.querySelectorAll('[data-add-stay]').forEach(function(el) {
        el.addEventListener('click', function() {
          window._tripEditing.segments = window._tripEditing.segments || [];
          window._tripEditing.segments.push({ kind: 'stay', city: '', start: '', end: '', note: '' });
          App.render();
        });
      });
      // 删除段
      root.querySelectorAll('[data-seg-del]').forEach(function(el) {
        el.addEventListener('click', function() {
          const idx = +el.getAttribute('data-seg-del');
          window._tripEditing.segments.splice(idx, 1);
          App.render();
        });
      });
      // 取消
      root.querySelectorAll('[data-trip-cancel]').forEach(function(el) {
        el.addEventListener('click', function() {
          window._tripEditing = null;
          App.render();
        });
      });
      // 保存
      root.querySelectorAll('[data-trip-save]').forEach(function(el) {
        el.addEventListener('click', async function() {
          const t = window._tripEditing;
          t.name = document.getElementById('te-name').value || '未命名旅行';
          t.startDate = document.getElementById('te-start').value;
          t.endDate = document.getElementById('te-end').value;
          t.people = parseInt(document.getElementById('te-people').value) || 2;
          t.budget = document.getElementById('te-budget').value;
          // 收集 segments
          const segs = [];
          root.querySelectorAll('.seg-row').forEach(function(row) {
            const idx = +row.getAttribute('data-seg-idx');
            const orig = t.segments[idx];
            if (orig.kind === 'transport') {
              segs.push({
                kind: 'transport',
                transport: row.querySelector('[data-seg-transport]').value,
                from: row.querySelector('[data-seg-from]').value,
                to: row.querySelector('[data-seg-to]').value,
                depart: row.querySelector('[data-seg-depart]').value,
                arrive: row.querySelector('[data-seg-arrive]').value,
                note: ''
              });
            } else {
              segs.push({
                kind: 'stay',
                city: row.querySelector('[data-seg-city]').value,
                start: row.querySelector('[data-seg-start]').value,
                end: row.querySelector('[data-seg-end]').value,
                note: row.querySelector('[data-seg-note]').value
              });
            }
          });
          t.segments = segs;
          if (t.id) {
            await DB.put('trips', t);
          } else {
            await DB.add('trips', t);
          }
          window._tripEditing = null;
          window._tripExpanded = t.id || null;
          UI.toast('已保存');
          App.render();
        });
      });
    }
  }

  return { body: body, bind: bind };
})();
