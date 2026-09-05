/* 家庭管理系统 - 页面：旅行规划
   输入目的地 + 时间 → 自动推荐每日行程 + 携带物品清单（细化到件数）
   行程支持逐天编辑、增删天；内置国内 + 常见出境目的地规则库
*/
const TripPage = (function() {
  // 内置目的地规则库（示例数据：线路合理即可，正式版可扩充）
  const DEST_DB = {
    '北京': { region:'国内', days:4, tips:'带老人孩子建议节奏放缓，避开周一闭馆场馆', lines: [
        ['天安门广场 + 故宫博物院（约3h，需预约）','王府井/南锣鼓巷'],
        ['八达岭长城（全天，建议早出发）','鸟巢水立方夜景'],
        ['颐和园（约4h）','圆明园遗址公园'],
        ['国家博物馆（需预约）','返程'] ] },
    '上海': { region:'国内', days:3, tips:'地铁便利，亲子推荐自然博物馆需预约', lines: [
        ['外滩 + 南京东路步行街','豫园城隍庙'],
        ['上海迪士尼乐园（全天，需提前购票）',''],
        ['上海自然博物馆（预约）','武康路漫步 · 返程'] ] },
    '广州': { region:'国内', days:3, tips:'美食之都，注意夏季湿热防暑', lines: [
        ['广州塔 + 花城广场','珠江夜游'],
        ['长隆野生动物世界（全天）',''],
        ['陈家祠 + 沙面岛','北京路步行街 · 返程'] ] },
    '成都': { region:'国内', days:4, tips:'麻辣为主，孩子可选清汤', lines: [
        ['宽窄巷子 + 人民公园','锦里古街夜景'],
        ['成都大熊猫繁育研究基地（早去）','武侯祠'],
        ['都江堰（约半天）','青城山'],
        ['春熙路购物','返程'] ] },
    '西安': { region:'国内', days:4, tips:'历史人文厚重，暑假热门需早订', lines: [
        ['西安城墙（骑行/漫步）','回民街'],
        ['兵马俑 + 华清宫（全天）',''],
        ['陕西历史博物馆（预约）','大雁塔 + 大唐不夜城'],
        ['钟鼓楼','返程'] ] },
    '杭州': { region:'国内', days:3, tips:'西湖周边步行+骑行最舒服', lines: [
        ['西湖（断桥-苏堤，可骑行）','河坊街'],
        ['灵隐寺 + 飞来峰','西溪湿地'],
        ['龙井村茶园','返程'] ] },
    '三亚': { region:'国内', days:4, tips:'海岛亲子，注意防晒防蚊', lines: [
        ['亚龙湾沙滩（玩水）',''],
        ['蜈支洲岛（全天，需乘船）',''],
        ['热带天堂森林公园','免税城'],
        ['大东海休闲','返程'] ] },
    '香港': { region:'出境', days:4, tips:'需通行证/签注，地铁发达', lines: [
        ['维多利亚港 + 天星小轮','太平山顶夜景'],
        ['香港迪士尼乐园（全天）',''],
        ['海洋公园（全天）',''],
        ['铜锣湾/旺角购物','返程'] ] },
    '澳门': { region:'出境', days:2, tips:'需通行证/签注，步行可达', lines: [
        ['大三巴牌坊 + 议事亭前地','官也街美食'],
        ['路氹城度假区','返程'] ] },
    '东京': { region:'出境', days:5, tips:'需护照签证，地铁复杂建议提前规划', lines: [
        ['浅草寺 + 晴空塔','银座'],
        ['东京迪士尼乐园（全天）',''],
        ['秋叶原 + 新宿','涩谷十字路口'],
        ['明治神宫 + 原宿','台场'],
        ['上野公园 + 博物馆','返程'] ] },
    '首尔': { region:'出境', days:4, tips:'需护照签证，购物美食多', lines: [
        ['景福宫 + 北村韩屋村','明洞'],
        ['乐天世界/爱宝乐园',''],
        ['南山塔 + 梨花壁画村','东大门'],
        ['广藏市场美食','返程'] ] },
    '曼谷': { region:'出境', days:5, tips:'需护照签证，注意当地天气炎热', lines: [
        ['大皇宫 + 玉佛寺','湄南河夜游'],
        ['四面佛 + 暹罗广场',''],
        ['水上市场（建议一日游团）',''],
        ['考山路 + 夜市',''],
        ['购物中心采购','返程'] ] }
  };

  // 物品清单模板：每项 {cat, name, perPerson/day逻辑}
  // qty 规则：证件按人数；衣物按天数；其余按默认
  function buildPacking(days, people, hasKid, hasElder, climate) {
    const list = [];
    const p = Math.max(1, people);
    function add(cat, name, qty) {
      list.push({ cat: cat, name: name, qty: qty, done: false, auto: true });
    }
    add('📄 证件票据', '身份证', p);
    if (hasKid) add('📄 证件票据', '户口本', 1);
    add('📄 证件票据', '车票/机票/酒店订单', 1);
    add('👕 衣物鞋帽', '内衣裤', Math.max(1, days));
    add('👕 衣物鞋帽', '外穿衣物', Math.max(1, days));
    add('👕 衣物鞋帽', '外套/防晒衣', 1);
    add('👕 衣物鞋帽', '睡衣', 1);
    add('👕 衣物鞋帽', '运动鞋', 1);
    if (climate === 'rain') add('👕 衣物鞋帽', '雨具', 1);
    add('💊 药品防护', '常用药（创可贴/感冒/肠胃）', 1);
    add('💊 药品防护', '晕车药', 1);
    if (climate === 'hot') add('💊 药品防护', '防晒霜', 1);
    if (climate === 'hot' || climate === 'rain') add('💊 药品防护', '驱蚊液', 1);
    add('💊 药品防护', '口罩', Math.max(2, p));
    add('🔌 电子设备', '手机', p);
    add('🔌 电子设备', '充电宝', Math.min(2, p));
    add('🔌 电子设备', '充电器', Math.min(2, p));
    add('🔌 电子设备', '相机（可选）', 1);
    add('🧴 洗漱个护', '牙刷', p);
    add('🧴 洗漱个护', '毛巾', 2);
    add('🧴 洗漱个护', '洗护旅行装', 1);
    if (hasKid) {
      add('👶 儿童用品', '奶粉', 1);
      add('👶 儿童用品', '尿不湿', Math.ceil(days * 4 / 1));
      add('👶 儿童用品', '儿童餐具', 1);
      add('👶 儿童用品', '保温杯', 1);
    }
    if (hasElder) {
      add('👴 老人用品', '老人常备药', 1);
      add('👴 老人用品', '保温杯', 1);
    }
    return list;
  }

  function isRainy(dest) { return ['广州','三亚','曼谷'].indexOf(dest) >= 0; }
  function isHot(dest) { return ['三亚','曼谷','广州'].indexOf(dest) >= 0; }

  async function body() {
    const trips = await DB.getAll('trips');
    const packing = await DB.getAll('packing_items');
    const tripMap = {};
    packing.forEach(function(pi) {
      (tripMap[pi.tripId] = tripMap[pi.tripId] || []).push(pi);
    });

    let html = '';

    if (!trips.length) {
      html += '<div class="card"><div class="empty">' +
        '<span class="e">✈️</span>还没有旅行规划<br><span style="font-size:12.5px;">输入目的地和时间，自动生成推荐行程 + 携带物品清单</span>' +
        '<div style="margin-top:16px;"><button class="btn" data-new="1">+ 新建旅行规划</button></div>' +
      '</div></div>';
      return html;
    }

    // 出行倒计时卡
    const today = UI.todayStr();
    trips.slice().sort(function(a,b){ return a.start.localeCompare(b.start); }).forEach(function(tp) {
      const d = UI.daysUntil(tp.start);
      const isPast = tp.start < today;
      const pItems = tripMap[tp.id] || [];
      const doneCount = pItems.filter(function(pi) { return pi.done; }).length;
      const lineCount = (tp.lines && tp.lines.length) || 0;
      html += '<div class="card">' +
        '<div class="row">' +
          '<div style="width:46px;height:46px;border-radius:12px;background:var(--green-bg);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">✈️</div>' +
          '<div class="txt">' +
            '<div class="t1">' + UI.esc(tp.dest) + ' ' + (tp.days || '') + '天</div>' +
            '<div class="t2">' + UI.fmtCn(tp.start) + (tp.end ? ' - ' + UI.fmtDate(tp.end) : '') + ' · ' + (tp.people || '') + ' 人' + (tp.members ? ' · ' + UI.esc(tp.members) : '') + ' · 行程 ' + lineCount + ' 天</div>' +
          '</div>' +
          (isPast ? '<span class="pill gray">已结束</span>' : d === 0 ? '<span class="pill org">今天出发</span>' : d < 0 ? '<span class="pill red">已开始</span>' : '<span class="pill blue">还有 ' + d + ' 天</span>') +
        '</div>' +
        '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">' +
          '<button class="btn sm" data-view="' + tp.id + '">📋 行程（' + lineCount + ' 天）</button>' +
          '<button class="btn sm ghost" data-pack="' + tp.id + '">🧳 清单（' + doneCount + '/' + pItems.length + '）</button>' +
          '<button class="btn sm ghost" data-edit="' + tp.id + '">基本信息</button>' +
          '<button class="btn sm ghost" data-del="' + tp.id + '">删除</button>' +
        '</div>' +
      '</div>';
    });

    html += '<div style="margin-top:16px;"><button class="btn block" data-new="1">+ 新建旅行规划</button></div>';
    return html;
  }

  // 新建/编辑基本信息表单（不改行程内容）
  async function openForm(trip) {
    const keys = Object.keys(DEST_DB);
    const opts = keys.map(function(k) {
      return '<option value="' + k + '"' + (trip && trip.dest === k ? ' selected' : '') + '>' + k + '</option>';
    }).join('') + '<option value="__custom__"' + (trip && !DEST_DB[trip.dest] ? ' selected' : '') + '>其他目的地（自定义行程）</option>';
    UI.openModal(
      '<h3>' + (trip ? '编辑旅行基本信息' : '新建旅行规划') + '</h3>' +
      '<div class="field"><label>目的地</label><select id="t-dest">' + opts + '</select></div>' +
      '<div class="field" id="t-custom-field" style="display:none;"><label>自定义目的地</label><input id="t-custom" placeholder="如：丽江"></div>' +
      '<div class="two">' +
        '<div class="field"><label>出发日期</label><input id="t-start" type="date" value="' + (trip ? trip.start : UI.addDays(UI.todayStr(), 7)) + '"></div>' +
        '<div class="field"><label>返程日期</label><input id="t-end" type="date" value="' + (trip ? trip.end : UI.addDays(UI.todayStr(), 10)) + '"></div>' +
      '</div>' +
      '<div class="two">' +
        '<div class="field"><label>出行人数</label><input id="t-people" type="number" value="' + (trip ? trip.people : 4) + '"></div>' +
        '<div class="field"><label>成员构成</label><select id="t-members">' +
          '<option value="仅大人"' + (trip && trip.members==='仅大人'?' selected':'') + '>仅大人</option>' +
          '<option value="含孩子"' + (trip && trip.members==='含孩子'?' selected':'') + '>含孩子</option>' +
          '<option value="含老人"' + (trip && trip.members==='含老人'?' selected':'') + '>含老人</option>' +
          '<option value="含老人和孩子"' + (trip && trip.members==='含老人和孩子'?' selected':'') + '>含老人和孩子</option>' +
        '</select></div>' +
      '</div>' +
      '<div class="field"><label>温馨提示</label><input id="t-tips" value="' + UI.esc(trip ? (trip.tips||'') : '') + '" placeholder="如：注意防晒"></div>' +
      '<div class="foot">' +
        '<button class="btn ghost" data-x="1">取消</button>' +
        '<button class="btn" data-save="1">保存</button>' +
      '</div>'
    );
    const modal = document.querySelector('.modal');
    modal.querySelector('[data-x]').addEventListener('click', function() { UI.closeModal(); });
    const destSel = document.getElementById('t-dest');
    destSel.addEventListener('change', function() {
      document.getElementById('t-custom-field').style.display = destSel.value === '__custom__' ? '' : 'none';
    });
    modal.querySelector('[data-save]').addEventListener('click', async function() {
      let dest = destSel.value;
      if (dest === '__custom__') {
        dest = document.getElementById('t-custom').value.trim();
        if (!dest) { UI.toast('请填写自定义目的地'); return; }
      }
      const start = document.getElementById('t-start').value;
      const end = document.getElementById('t-end').value;
      if (!start || !end || end < start) { UI.toast('请填写正确的日期'); return; }
      const people = Math.max(1, +document.getElementById('t-people').value || 1);
      const members = document.getElementById('t-members').value;
      const tips = document.getElementById('t-tips').value.trim();
      const days = Math.max(1, Math.round((new Date(end) - new Date(start)) / 86400000) + 1);

      const destInfo = DEST_DB[dest];
      const obj = {
        dest: dest,
        start: start, end: end,
        people: people, members: members, days: days,
        region: destInfo ? destInfo.region : '其他',
        tips: tips || (destInfo ? destInfo.tips : '自定义目的地，可在行程详情中逐天编辑'),
        custom: !destInfo
      };
      // 保留已有行程内容；新建时从内置库生成
      if (trip) {
        obj.id = trip.id;
        obj.lines = trip.lines || [];
      } else if (destInfo) {
        obj.lines = destInfo.lines.map(function(d) { return d.slice(); });
      } else {
        // 自定义目的地：按天数生成空行程模板（由用户填写）
        obj.lines = [];
        for (let i = 0; i < days; i++) obj.lines.push(['', '']);
      }
      const tripId = await DB.put('trips', obj);

      // 生成/更新携带清单：只重建自动生成的物品，保留用户手动添加的（auto=false）
      await DB.getAll('packing_items').then(async function(all) {
        const old = all.filter(function(pi) { return pi.tripId == tripId && pi.auto !== false; });
        for (const o of old) await DB.del('packing_items', o.id);
      });
      const hasKid = members.indexOf('孩子') >= 0;
      const hasElder = members.indexOf('老人') >= 0;
      const climate = isRainy(dest) ? 'rain' : (isHot(dest) ? 'hot' : 'mild');
      const packing = buildPacking(days, people, hasKid, hasElder, climate);
      for (const pi of packing) {
        pi.tripId = tripId;
        await DB.add('packing_items', pi);
      }

      UI.closeModal();
      UI.toast('已保存，可在行程详情中编辑每天安排');
      App.render();
    });
  }

  // 行程详情：逐天查看 + 编辑 + 增删天
  async function viewTrip(id) {
    const tp = await DB.get('trips', id);
    if (!tp) return;

    let html = '<h3>✈️ ' + UI.esc(tp.dest) + ' · 行程安排</h3>';
    html += '<p style="font-size:13px;color:var(--sub);margin-bottom:12px;">' + UI.fmtCn(tp.start) + ' - ' + UI.fmtDate(tp.end) + ' · ' + tp.people + ' 人 · ' + UI.esc(tp.members) + ' · 点击可编辑每天内容</p>';

    const lines = tp.lines || [];
    if (lines.length) {
      lines.forEach(function(day, i) {
        const morning = day[0] || '';
        const evening = day[1] || '';
        html += '<div style="border-left:3px solid var(--green);padding:2px 0 8px 14px;margin-bottom:10px;">' +
          '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">' +
            '<span style="font-weight:700;font-size:13.5px;">第 ' + (i+1) + ' 天</span>' +
            '<span style="font-size:12.5px;color:var(--sub);">' + UI.fmtDate(UI.addDays(tp.start, i)) + '</span>' +
            '<span style="flex:1;"></span>' +
            '<button class="btn sm ghost" data-line-edit="' + i + '">编辑</button>' +
            '<button class="btn sm ghost" data-line-del="' + i + '" style="color:var(--red);">删</button>' +
          '</div>';
        if (morning) html += '<div style="font-size:13px;color:var(--text);margin-top:2px;">☀️ ' + UI.esc(morning) + '</div>';
        else html += '<div style="font-size:13px;color:var(--sub);margin-top:2px;">☀️ 待安排</div>';
        if (evening) html += '<div style="font-size:13px;color:var(--text);margin-top:2px;">🌙 ' + UI.esc(evening) + '</div>';
        else html += '<div style="font-size:13px;color:var(--sub);margin-top:2px;">🌙 待安排</div>';
        html += '</div>';
      });
      html += '<div style="margin-top:4px;display:flex;gap:8px;flex-wrap:wrap;">' +
        '<button class="btn sm" data-line-add="1">+ 添加一天</button>' +
      '</div>';
    } else {
      html += '<div class="empty"><span class="e">✨</span>还没有行程内容，点下面按钮添加第一天</div>';
      html += '<div style="margin-top:8px;"><button class="btn sm" data-line-add="1">+ 添加第一天</button></div>';
    }
    if (tp.tips) html += '<div style="font-size:12.5px;color:var(--sub);background:var(--green-bg);border-radius:10px;padding:10px 12px;margin-top:10px;">💡 ' + UI.esc(tp.tips) + '</div>';
    html += '<div class="foot"><button class="btn" data-x="1">关闭</button></div>';
    UI.openModal(html);
    const modal = document.querySelector('.modal');
    modal.querySelector('[data-x]').addEventListener('click', function() { UI.closeModal(); });

    // 编辑某天
    modal.querySelectorAll('[data-line-edit]').forEach(function(b) {
      b.addEventListener('click', function() { editLine(id, +b.getAttribute('data-line-edit')); });
    });
    // 删除某天
    modal.querySelectorAll('[data-line-del]').forEach(function(b) {
      b.addEventListener('click', async function() {
        const idx = +b.getAttribute('data-line-del');
        const cur = await DB.get('trips', id);
        (cur.lines || []).splice(idx, 1);
        cur.days = cur.lines.length || 1;
        await DB.put('trips', cur);
        UI.toast('已删除该天');
        viewTrip(id);
      });
    });
    // 添加一天
    modal.querySelector('[data-line-add]').addEventListener('click', async function() {
      const cur = await DB.get('trips', id);
      cur.lines = cur.lines || [];
      cur.lines.push(['', '']);
      cur.days = cur.lines.length;
      await DB.put('trips', cur);
      viewTrip(id);
    });
  }

  // 编辑某天的行程内容
  async function editLine(id, idx) {
    const tp = await DB.get('trips', id);
    const day = (tp.lines || [])[idx] || ['', ''];
    UI.openModal(
      '<h3>编辑第 ' + (idx+1) + ' 天行程</h3>' +
      '<div class="field"><label>上午 / 全天安排</label><textarea id="l-morning" rows="2" placeholder="如：故宫博物院（预约）">' + UI.esc(day[0]||'') + '</textarea></div>' +
      '<div class="field"><label>下午 / 晚上安排（可留空）</label><textarea id="l-evening" rows="2" placeholder="如：南锣鼓巷">' + UI.esc(day[1]||'') + '</textarea></div>' +
      '<div class="foot"><button class="btn ghost" data-x="1">取消</button><button class="btn" data-save="1">保存</button></div>'
    );
    const modal = document.querySelector('.modal');
    modal.querySelector('[data-x]').addEventListener('click', function() { UI.closeModal(); });
    modal.querySelector('[data-save]').addEventListener('click', async function() {
      const morning = document.getElementById('l-morning').value.trim();
      const evening = document.getElementById('l-evening').value.trim();
      const cur = await DB.get('trips', id);
      cur.lines = cur.lines || [];
      cur.lines[idx] = [morning, evening];
      await DB.put('trips', cur);
      UI.closeModal();
      UI.toast('已保存当天行程');
      viewTrip(id);
    });
  }

  // 查看/编辑携带清单
  async function viewPacking(id) {
    const tp = await DB.get('trips', id);
    const items = (await DB.getAll('packing_items')).filter(function(pi) { return pi.tripId == id; });
    if (!tp) return;

    const cats = {};
    items.forEach(function(it) { (cats[it.cat] = cats[it.cat] || []).push(it); });
    const catKeys = Object.keys(cats);

    let html = '<h3>🧳 ' + UI.esc(tp.dest) + ' · 携带清单</h3>';
    html += '<p style="font-size:13px;color:var(--sub);margin-bottom:6px;">按 ' + tp.days + ' 天 × ' + tp.people + ' 人自动预填数量，可勾选打包、增减数量、添加/删除物品</p>';
    catKeys.forEach(function(cat) {
      html += '<div class="section-title">' + cat + '</div>';
      html += '<div style="margin-bottom:10px;">';
      cats[cat].forEach(function(it) {
        html += '<div class="kv"><span class="k" style="' + (it.done ? 'text-decoration:line-through;color:var(--sub);' : '') + '">' + UI.esc(it.name) + (it.auto ? '' : '<span class="pill pink" style="margin-left:6px;">自加</span>') + '</span>' +
          '<span class="v">' +
            '<span style="font-weight:600;">×' + it.qty + '</span>' +
            '<button class="btn sm ghost" data-pack-tog="' + it.id + '">' + (it.done ? '↩' : '✓') + '</button>' +
            '<button class="btn sm ghost" data-pack-inc="' + it.id + '">+</button>' +
            '<button class="btn sm ghost" data-pack-dec="' + it.id + '">−</button>' +
            '<button class="btn sm ghost" data-pack-del="' + it.id + '" style="color:var(--red);">删</button>' +
          '</span></div>';
      });
      html += '</div>';
    });
    html += '<div style="margin-top:4px;"><button class="btn sm block" data-pack-add="1" style="background:var(--green-bg);color:var(--green-2);">➕ 添加物品</button></div>';
    html += '<div class="foot"><button class="btn" data-x="1">关闭</button></div>';
    UI.openModal(html);
    const modal = document.querySelector('.modal');
    modal.querySelector('[data-x]').addEventListener('click', function() { UI.closeModal(); });
    modal.querySelector('[data-pack-add]').addEventListener('click', function() { openPackItemForm(id); });
    modal.querySelectorAll('[data-pack-tog]').forEach(function(b) {
      b.addEventListener('click', async function() {
        const it = await DB.get('packing_items', +b.getAttribute('data-pack-tog'));
        it.done = !it.done;
        await DB.put('packing_items', it);
        viewPacking(id);
      });
    });
    modal.querySelectorAll('[data-pack-inc],[data-pack-dec]').forEach(function(b) {
      b.addEventListener('click', async function() {
        const it = await DB.get('packing_items', +b.getAttribute(b.hasAttribute('data-pack-inc') ? 'data-pack-inc' : 'data-pack-dec'));
        it.qty = Math.max(0, it.qty + (b.hasAttribute('data-pack-inc') ? 1 : -1));
        await DB.put('packing_items', it);
        viewPacking(id);
      });
    });
    modal.querySelectorAll('[data-pack-del]').forEach(function(b) {
      b.addEventListener('click', async function() {
        await DB.del('packing_items', +b.getAttribute('data-pack-del'));
        UI.toast('已移除该物品');
        viewPacking(id);
      });
    });
  }

  // 手动添加携带物品
  const PACK_CATS = ['📄 证件票据','👕 衣物鞋帽','💊 药品防护','🔌 电子设备','🧴 洗漱个护','👶 儿童用品','👴 老人用品','🎒 其他'];
  function openPackItemForm(tripId) {
    const catOpts = PACK_CATS.map(function(c) { return '<option>' + c + '</option>'; }).join('');
    UI.openModal(
      '<h3>➕ 添加携带物品</h3>' +
      '<div class="two">' +
        '<div class="field"><label>分类</label><select id="p-cat">' + catOpts + '</select></div>' +
        '<div class="field"><label>数量</label><input id="p-qty" type="number" min="1" value="1"></div>' +
      '</div>' +
      '<div class="field"><label>物品名称</label><input id="p-name" placeholder="如：儿童防晒帽"></div>' +
      '<div class="foot"><button class="btn ghost" data-x="1">取消</button><button class="btn" data-save="1">添加</button></div>'
    );
    const modal = document.querySelector('.modal');
    modal.querySelector('[data-x]').addEventListener('click', function() { UI.closeModal(); });
    modal.querySelector('[data-save]').addEventListener('click', async function() {
      const name = document.getElementById('p-name').value.trim();
      if (!name) { UI.toast('请填写物品名称'); return; }
      const qty = Math.max(1, +document.getElementById('p-qty').value || 1);
      await DB.add('packing_items', {
        tripId: tripId,
        cat: document.getElementById('p-cat').value,
        name: name,
        qty: qty,
        done: false,
        auto: false
      });
      UI.closeModal();
      UI.toast('已添加到清单');
      viewPacking(tripId);
    });
  }

  async function onAction(e) {
    const t = e.target;
    const nw = t.getAttribute('data-new');
    const view = t.getAttribute('data-view');
    const pack = t.getAttribute('data-pack');
    const edit = t.getAttribute('data-edit');
    const del = t.getAttribute('data-del');
    if (nw) { openForm(null); }
    else if (view) { viewTrip(+view); }
    else if (pack) { viewPacking(+pack); }
    else if (edit) { openForm(await DB.get('trips', +edit)); }
    else if (del) {
      const id = +del;
      UI.openModal('<h3>删除旅行规划</h3><p style="color:var(--sub);font-size:14px;margin-bottom:8px;">确定删除该次旅行及携带清单吗？</p><div class="foot"><button class="btn ghost" data-x="1">取消</button><button class="btn" data-ok="1" style="background:var(--red);">删除</button></div>');
      const modal = document.querySelector('.modal');
      modal.querySelector('[data-x]').addEventListener('click', function() { UI.closeModal(); });
      modal.querySelector('[data-ok]').addEventListener('click', async function() {
        const packing = (await DB.getAll('packing_items')).filter(function(pi) { return pi.tripId == id; });
        for (const pi of packing) await DB.del('packing_items', pi.id);
        await DB.del('trips', id);
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
