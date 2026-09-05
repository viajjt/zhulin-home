/* 旅行规划模块 V2
   多目的地 + Leaflet 地图 + 打卡清单 + 旅行预算 + 目的地天气 + 购票任务 + 智能携带清单
*/
const TripPage = (function() {
  // 内置目的地规则库
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
    '重庆': { region:'国内', days:3, tips:'山城爬坡多，穿舒适鞋子', lines: [
        ['洪崖洞 + 解放碑','长江索道'],
        ['磁器口古镇','李子坝轻轨穿楼'],
        ['武隆天坑（一日游）','返程'] ] },
    '厦门': { region:'国内', days:3, tips:'鼓浪屿需提前预约船票', lines: [
        ['鼓浪屿（全天）','中山路步行街'],
        ['厦门大学 + 南普陀寺','曾厝垵'],
        ['环岛路骑行','返程'] ] },
    '丽江': { region:'国内', days:4, tips:'高原注意防晒和高反', lines: [
        ['丽江古城','束河古镇'],
        ['玉龙雪山（全天）','蓝月谷'],
        ['拉市海骑马',''],
        ['泸沽湖（可选）','返程'] ] },
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
        ['购物中心采购','返程'] ] },
    '新加坡': { region:'出境', days:4, tips:'需护照，花园城市治安好', lines: [
        ['鱼尾狮公园 + 滨海湾花园','克拉码头'],
        ['圣淘沙岛（全天）',''],
        ['新加坡动物园','乌节路购物'],
        ['牛车水 + 小印度','返程'] ] }
  };

  // 内置目的地坐标（用于地图标记）
  const DEST_COORDS = {
    '北京': [39.9042, 116.4074], '上海': [31.2304, 121.4737],
    '广州': [23.1291, 113.2644], '深圳': [22.5431, 114.0579],
    '成都': [30.5728, 104.0668], '西安': [34.3416, 108.9398],
    '杭州': [30.2741, 120.1551], '南京': [32.0603, 118.7969],
    '武汉': [30.5928, 114.3055], '重庆': [29.5630, 106.5516],
    '三亚': [18.2528, 109.5119], '厦门': [24.4798, 118.0894],
    '丽江': [26.8721, 100.2296], '大理': [25.6065, 100.2679],
    '青岛': [36.0671, 120.3826], '大连': [38.9140, 121.6147],
    '苏州': [31.2989, 120.5853], '长沙': [28.2282, 112.9388],
    '香港': [22.3193, 114.1694], '澳门': [22.1987, 113.5439],
    '台北': [25.0330, 121.5654],
    '东京': [35.6762, 139.6503], '大阪': [34.6937, 135.5023],
    '首尔': [37.5665, 126.9780], '曼谷': [13.7563, 100.5018],
    '新加坡': [1.3521, 103.8198], '吉隆坡': [3.1390, 101.6869],
    '巴黎': [48.8566, 2.3522], '伦敦': [51.5074, -0.1278],
    '纽约': [40.7128, -74.0060], '洛杉矶': [34.0522, -118.2437]
  };

  // 兼容旧数据：单目的地 → 多目的地数组
  function ensureDestinations(tp) {
    if (tp.destinations && tp.destinations.length) return tp;
    const coords = DEST_COORDS[tp.dest] || [null, null];
    tp.destinations = [{
      name: tp.dest || '未知',
      lat: coords[0], lng: coords[1],
      start: tp.start, end: tp.end,
      checklist: [], notes: ''
    }];
    return tp;
  }

  // 智能携带清单：根据天数/人数/成员/气候/交通方式生成
  function buildPacking(days, people, hasKid, hasElder, climate, transport) {
    const list = [];
    const p = Math.max(1, people);
    function add(cat, name, qty) {
      list.push({ cat: cat, name: name, qty: qty, done: false, auto: true });
    }
    add('📄 证件票据', '身份证', p);
    if (hasKid) add('📄 证件票据', '户口本', 1);
    add('📄 证件票据', '车票/机票/酒店订单', 1);
    if (transport === '飞机') add('📄 证件票据', '护照（如出境）', 1);
    add('👕 衣物鞋帽', '内衣裤', Math.max(1, days));
    add('👕 衣物鞋帽', '外穿衣物', Math.max(1, days));
    add('👕 衣物鞋帽', '外套/防晒衣', 1);
    add('👕 衣物鞋帽', '睡衣', 1);
    add('👕 衣物鞋帽', '运动鞋', 1);
    if (climate === 'rain') add('👕 衣物鞋帽', '雨具', 1);
    if (transport === '自驾') add('👕 衣物鞋帽', '靠枕/毯子', 1);
    add('💊 药品防护', '常用药（创可贴/感冒/肠胃）', 1);
    add('💊 药品防护', '晕车药', transport === '自驾' || transport === '高铁' ? 1 : 0);
    if (climate === 'hot') add('💊 药品防护', '防晒霜', 1);
    if (climate === 'hot' || climate === 'rain') add('💊 药品防护', '驱蚊液', 1);
    add('💊 药品防护', '口罩', Math.max(2, p));
    if (hasElder) add('💊 药品防护', '老人常用药', 1);
    add('🔌 电子设备', '手机', p);
    add('🔌 电子设备', '充电宝', Math.min(2, p));
    add('🔌 电子设备', '充电器', Math.min(2, p));
    add('🔌 电子设备', '相机（可选）', 1);
    if (transport === '飞机') add('🔌 电子设备', '转换插头（出境）', 1);
    add('🧴 洗漱个护', '牙刷', p);
    add('🧴 洗漱个护', '毛巾', 2);
    add('🧴 洗漱个护', '洗护旅行装', 1);
    if (hasKid) {
      add('👶 儿童用品', '奶粉', 1);
      add('👶 儿童用品', '尿不湿', Math.ceil(days * 4));
      add('👶 儿童用品', '儿童餐具', 1);
      add('👶 儿童用品', '保温杯', 1);
      add('👶 儿童用品', '儿童推车', 1);
    }
    if (transport === '自驾') {
      add('🚗 自驾装备', '车载充电器', 1);
      add('🚗 自驾装备', '矿泉水', Math.ceil(days * 2));
      add('🚗 自驾装备', '零食', 1);
    }
    add('🎒 其他', '行李箱/背包', Math.ceil(p / 2));
    add('🎒 其他', '雨伞', 1);
    add('🎒 其他', '垃圾袋', 5);
    return list.filter(function(i) { return i.qty > 0; });
  }

  function isRainy(dest) { return ['广州','三亚','曼谷','杭州','厦门','丽江','新加坡'].indexOf(dest) >= 0; }
  function isHot(dest) { return ['三亚','曼谷','广州','新加坡','厦门','重庆'].indexOf(dest) >= 0; }

  // ===== 旅行列表页 =====
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

    const today = UI.todayStr();
    trips.slice().sort(function(a,b){ return a.start.localeCompare(b.start); }).forEach(function(tp) {
      ensureDestinations(tp);
      const d = UI.daysUntil(tp.start);
      const isPast = tp.start < today;
      const pItems = tripMap[tp.id] || [];
      const doneCount = pItems.filter(function(pi) { return pi.done; }).length;
      const lineCount = (tp.lines && tp.lines.length) || 0;
      const destNames = tp.destinations.map(function(d2){ return d2.name; }).join(' → ');
      const budgetTotal = tp.budget || 0;
      const spent = (tp.expenses || []).reduce(function(s,e){ return s + (+e.amount||0); }, 0);
      html += '<div class="card">' +
        '<div class="row">' +
          '<div style="width:46px;height:46px;border-radius:12px;background:var(--green-bg);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">✈️</div>' +
          '<div class="txt">' +
            '<div class="t1">' + UI.esc(destNames) + ' · ' + (tp.days || '') + '天</div>' +
            '<div class="t2">' + UI.fmtCn(tp.start) + (tp.end ? ' - ' + UI.fmtDate(tp.end) : '') + ' · ' + (tp.people || '') + ' 人' +
              (tp.transport ? ' · ' + tp.transport : '') +
              (budgetTotal ? ' · 预算¥' + budgetTotal + (spent ? '（已花¥' + spent + '）' : '') : '') + '</div>' +
          '</div>' +
          (isPast ? '<span class="pill gray">已结束</span>' : d === 0 ? '<span class="pill org">今天出发</span>' : d < 0 ? '<span class="pill red">已开始</span>' : '<span class="pill blue">还有 ' + d + ' 天</span>') +
        '</div>' +
        '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">' +
          '<button class="btn sm" data-view="' + tp.id + '">📋 行程（' + lineCount + ' 天）</button>' +
          '<button class="btn sm ghost" data-pack="' + tp.id + '">🧳 清单（' + doneCount + '/' + pItems.length + '）</button>' +
          '<button class="btn sm ghost" data-map="' + tp.id + '">🗺️ 地图</button>' +
          '<button class="btn sm ghost" data-budget="' + tp.id + '">💰 预算</button>' +
          '<button class="btn sm ghost" data-edit="' + tp.id + '">基本信息</button>' +
          '<button class="btn sm ghost" data-del="' + tp.id + '">删除</button>' +
        '</div>' +
      '</div>';
    });

    html += '<div style="margin-top:16px;"><button class="btn block" data-new="1">+ 新建旅行规划</button></div>';
    return html;
  }

  // ===== 新建/编辑基本信息（多目的地） =====
  async function openForm(trip) {
    if (trip) ensureDestinations(trip);
    const keys = Object.keys(DEST_DB);
    const destOpts = keys.map(function(k) {
      return '<option value="' + k + '">' + k + '</option>';
    }).join('') + '<option value="__custom__">其他（自定义）</option>';

    const destRows = (trip ? trip.destinations : [{name:'', start:'', end:''}]).map(function(d, i) {
      return '<div class="dest-row" data-idx="' + i + '" style="display:flex;gap:6px;align-items:center;margin-bottom:6px;">' +
        '<select class="dest-sel" style="flex:1;min-width:0;">' +
          keys.map(function(k){ return '<option value="'+k+'"'+(d.name===k?' selected':'')+'>'+k+'</option>'; }).join('') +
          '<option value="__custom__"'+(!DEST_DB[d.name]?' selected':'')+'>其他</option>' +
        '</select>' +
        '<input class="dest-custom" type="text" placeholder="城市名" value="' + UI.esc(!DEST_DB[d.name] ? d.name : '') + '" style="width:80px;' + (DEST_DB[d.name]?'display:none;':'') + '">' +
        '<input class="dest-start" type="date" value="' + (d.start||'') + '" style="width:130px;">' +
        '<input class="dest-end" type="date" value="' + (d.end||'') + '" style="width:130px;">' +
        '<button class="btn sm ghost dest-del" style="color:var(--red);flex-shrink:0;">×</button>' +
      '</div>';
    }).join('');

    UI.openModal(
      '<h3>' + (trip ? '编辑旅行基本信息' : '新建旅行规划') + '</h3>' +
      '<div class="field"><label>目的地（可多个，按顺序排列）</label>' +
        '<div id="dest-list">' + destRows + '</div>' +
        '<button class="btn sm ghost" id="add-dest" style="margin-top:4px;">+ 添加目的地</button>' +
      '</div>' +
      '<div class="two">' +
        '<div class="field"><label>出行人数</label><input id="t-people" type="number" value="' + (trip ? trip.people : 4) + '"></div>' +
        '<div class="field"><label>交通方式</label><select id="t-transport">' +
          ['飞机','高铁','自驾','火车','其他'].map(function(t){ return '<option value="'+t+'"'+(trip&&trip.transport===t?' selected':'')+'>'+t+'</option>'; }).join('') +
        '</select></div>' +
      '</div>' +
      '<div class="field"><label>成员构成</label><select id="t-members">' +
        ['仅大人','含孩子','含老人','含老人和孩子'].map(function(m){ return '<option value="'+m+'"'+(trip&&trip.members===m?' selected':'')+'>'+m+'</option>'; }).join('') +
      '</select></div>' +
      '<div class="two">' +
        '<div class="field"><label>预算总额（元）</label><input id="t-budget" type="number" value="' + (trip ? (trip.budget||'') : '') + '" placeholder="如：5000"></div>' +
        '<div class="field"><label>温馨提示</label><input id="t-tips" value="' + UI.esc(trip ? (trip.tips||'') : '') + '" placeholder="如：注意防晒"></div>' +
      '</div>' +
      '<div class="foot">' +
        '<button class="btn ghost" data-x="1">取消</button>' +
        '<button class="btn" data-save="1">保存</button>' +
      '</div>'
    );
    const modal = document.querySelector('.modal');
    modal.querySelector('[data-x]').addEventListener('click', function() { UI.closeModal(); });

    // 目的地 select 切换显示自定义输入
    function bindDestRow(row) {
      const sel = row.querySelector('.dest-sel');
      const custom = row.querySelector('.dest-custom');
      sel.addEventListener('change', function() {
        custom.style.display = sel.value === '__custom__' ? '' : 'none';
      });
      row.querySelector('.dest-del').addEventListener('click', function() {
        if (modal.querySelectorAll('.dest-row').length > 1) row.remove();
        else UI.toast('至少保留一个目的地');
      });
    }
    modal.querySelectorAll('.dest-row').forEach(bindDestRow);
    modal.querySelector('#add-dest').addEventListener('click', function() {
      const list = modal.querySelector('#dest-list');
      const div = document.createElement('div');
      div.className = 'dest-row';
      div.setAttribute('data-idx', list.children.length);
      div.innerHTML = '<select class="dest-sel" style="flex:1;min-width:0;">' + destOpts + '</select>' +
        '<input class="dest-custom" type="text" placeholder="城市名" style="width:80px;display:none;">' +
        '<input class="dest-start" type="date" style="width:130px;">' +
        '<input class="dest-end" type="date" style="width:130px;">' +
        '<button class="btn sm ghost dest-del" style="color:var(--red);flex-shrink:0;">×</button>';
      list.appendChild(div);
      bindDestRow(div);
    });

    modal.querySelector('[data-save]').addEventListener('click', async function() {
      // 收集目的地
      const destinations = [];
      let firstStart = '', lastEnd = '';
      const rows = modal.querySelectorAll('.dest-row');
      for (const row of rows) {
        const sel = row.querySelector('.dest-sel');
        const custom = row.querySelector('.dest-custom');
        let name = sel.value === '__custom__' ? custom.value.trim() : sel.value;
        if (!name) { UI.toast('请填写目的地名称'); return; }
        const start = row.querySelector('.dest-start').value;
        const end = row.querySelector('.dest-end').value;
        const coords = DEST_COORDS[name] || [null, null];
        // 保留已有 checklist
        const existing = trip && trip.destinations ? trip.destinations.find(function(d){ return d.name === name; }) : null;
        destinations.push({
          name: name, lat: coords[0], lng: coords[1],
          start: start, end: end,
          checklist: existing ? existing.checklist : [],
          notes: existing ? existing.notes : ''
        });
        if (!firstStart || (start && start < firstStart)) firstStart = start;
        if (!lastEnd || (end && end > lastEnd)) lastEnd = end;
      }
      if (!firstStart || !lastEnd) { UI.toast('请填写目的地日期'); return; }
      const start = firstStart, end = lastEnd;
      if (end < start) { UI.toast('返程日期不能早于出发日期'); return; }
      const people = Math.max(1, +document.getElementById('t-people').value || 1);
      const transport = document.getElementById('t-transport').value;
      const members = document.getElementById('t-members').value;
      const budget = +document.getElementById('t-budget').value || 0;
      const tips = document.getElementById('t-tips').value.trim();
      const days = Math.max(1, Math.round((new Date(end) - new Date(start)) / 86400000) + 1);
      const mainDest = destinations[0].name;
      const destInfo = DEST_DB[mainDest];

      const obj = {
        dest: mainDest,
        destinations: destinations,
        start: start, end: end,
        people: people, transport: transport, members: members, days: days,
        budget: budget,
        region: destInfo ? destInfo.region : (destinations.some(function(d){ return DEST_DB[d.name]&&DEST_DB[d.name].region==='出境'; }) ? '出境' : '其他'),
        tips: tips || (destInfo ? destInfo.tips : '多目的地旅行，可在行程详情中编辑')
      };

      if (trip) {
        obj.id = trip.id;
        obj.lines = trip.lines || [];
        obj.expenses = trip.expenses || [];
      } else if (destInfo) {
        obj.lines = destInfo.lines.map(function(d) { return d.slice(); });
      } else {
        obj.lines = [];
        for (let i = 0; i < days; i++) obj.lines.push(['', '']);
      }
      const tripId = await DB.put('trips', obj);

      // 生成/更新携带清单
      await DB.getAll('packing_items').then(async function(all) {
        const old = all.filter(function(pi) { return pi.tripId == tripId && pi.auto !== false; });
        for (const o of old) await DB.del('packing_items', o.id);
      });
      const hasKid = members.indexOf('孩子') >= 0;
      const hasElder = members.indexOf('老人') >= 0;
      const climate = isRainy(mainDest) ? 'rain' : (isHot(mainDest) ? 'hot' : 'mild');
      const packing = buildPacking(days, people, hasKid, hasElder, climate, transport);
      for (const pi of packing) {
        pi.tripId = tripId;
        await DB.add('packing_items', pi);
      }

      // 自动生成购票/预订任务
      if (!trip) {
        await DB.add('tasks', {
          title: '🎫 预订：' + mainDest + ' ' + transport + '票 + 酒店',
          desc: '旅行 ' + start + ' - ' + end + '，' + people + '人，' + destinations.map(function(d){return d.name;}).join('→'),
          date: start, time: '09:00',
          done: false, source: 'trip'
        });
      }

      UI.closeModal();
      UI.toast('已保存，购票任务已自动生成');
      App.render();
    });
  }

  // ===== 行程详情：逐天行程 + 目的地打卡 + 天气 =====
  async function viewTrip(id) {
    const tp = await DB.get('trips', id);
    if (!tp) return;
    ensureDestinations(tp);

    let html = '<h3>✈️ ' + UI.esc(tp.destinations.map(function(d){return d.name;}).join(' → ')) + ' · 行程安排</h3>';
    html += '<p style="font-size:13px;color:var(--sub);margin-bottom:12px;">' + UI.fmtCn(tp.start) + ' - ' + UI.fmtDate(tp.end) + ' · ' + tp.people + ' 人 · ' + UI.esc(tp.members) + ' · ' + (tp.transport||'') + '</p>';

    // 目的地打卡清单
    html += '<div style="margin-bottom:14px;">';
    tp.destinations.forEach(function(dest, di) {
      html += '<div style="margin-bottom:8px;">' +
        '<div style="font-weight:700;font-size:13.5px;margin-bottom:4px;">📍 ' + UI.esc(dest.name) +
          (dest.start ? '（' + UI.fmtDate(dest.start) + (dest.end?' - '+UI.fmtDate(dest.end):'') + '）' : '') +
          '<button class="btn sm ghost" data-add-check="' + di + '" style="float:right;font-size:11px;">+ 打卡点</button>' +
        '</div>';
      (dest.checklist || []).forEach(function(item, ci) {
        html += '<label style="display:flex;align-items:center;gap:6px;font-size:13px;padding:3px 0;cursor:pointer;">' +
          '<input type="checkbox" data-check="' + di + '-' + ci + '"' + (item.done ? ' checked' : '') + ' style="width:16px;height:16px;">' +
          '<span style="' + (item.done ? 'text-decoration:line-through;color:var(--sub);' : '') + '">' + UI.esc(item.name) + '</span>' +
          '<button class="btn sm ghost" data-del-check="' + di + '-' + ci + '" style="margin-left:auto;color:var(--red);font-size:11px;">删</button>' +
        '</label>';
      });
      if (!(dest.checklist && dest.checklist.length)) {
        html += '<div style="font-size:12px;color:var(--sub);padding-left:4px;">暂无打卡点，点右上角添加</div>';
      }
      html += '</div>';
    });
    html += '</div>';

    // 每日行程
    const lines = tp.lines || [];
    html += '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:8px;font-weight:700;">📅 每日行程</div>';
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
        '<button class="btn sm ghost" data-ai-trip="' + tp.id + '" style="background:var(--pur-bg);color:var(--pur);">✨ AI 生成行程</button>' +
      '</div>';
    } else {
      html += '<div class="empty"><span class="e">✨</span>还没有行程内容</div>';
      html += '<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">' +
        '<button class="btn sm" data-line-add="1">+ 添加第一天</button>' +
        '<button class="btn sm ghost" data-ai-trip="' + tp.id + '" style="background:var(--pur-bg);color:var(--pur);">✨ AI 生成行程</button>' +
      '</div>';
    }
    if (tp.tips) html += '<div style="font-size:12.5px;color:var(--sub);background:var(--green-bg);border-radius:10px;padding:10px 12px;margin-top:10px;">💡 ' + UI.esc(tp.tips) + '</div>';
    html += '<div class="foot"><button class="btn" data-x="1">关闭</button></div>';
    UI.openModal(html);
    const modal = document.querySelector('.modal');
    modal.querySelector('[data-x]').addEventListener('click', function() { UI.closeModal(); });

    // 打卡勾选
    modal.querySelectorAll('[data-check]').forEach(function(cb) {
      cb.addEventListener('change', async function() {
        const parts = cb.getAttribute('data-check').split('-');
        const di = +parts[0], ci = +parts[1];
        const cur = await DB.get('trips', id);
        ensureDestinations(cur);
        cur.destinations[di].checklist[ci].done = cb.checked;
        await DB.put('trips', cur);
      });
    });
    // 添加打卡点
    modal.querySelectorAll('[data-add-check]').forEach(function(b) {
      b.addEventListener('click', async function() {
        const di = +b.getAttribute('data-add-check');
        const name = prompt('输入打卡点名称（如：故宫博物院）');
        if (!name) return;
        const cur = await DB.get('trips', id);
        ensureDestinations(cur);
        cur.destinations[di].checklist = cur.destinations[di].checklist || [];
        cur.destinations[di].checklist.push({ name: name.trim(), done: false });
        await DB.put('trips', cur);
        viewTrip(id);
      });
    });
    // 删除打卡点
    modal.querySelectorAll('[data-del-check]').forEach(function(b) {
      b.addEventListener('click', async function() {
        const parts = b.getAttribute('data-del-check').split('-');
        const di = +parts[0], ci = +parts[1];
        const cur = await DB.get('trips', id);
        ensureDestinations(cur);
        cur.destinations[di].checklist.splice(ci, 1);
        await DB.put('trips', cur);
        viewTrip(id);
      });
    });
    // 编辑/删除/添加天
    modal.querySelectorAll('[data-line-edit]').forEach(function(b) {
      b.addEventListener('click', function() { editLine(id, +b.getAttribute('data-line-edit')); });
    });
    modal.querySelectorAll('[data-line-del]').forEach(function(b) {
      b.addEventListener('click', async function() {
        const idx = +b.getAttribute('data-line-del');
        const cur = await DB.get('trips', id);
        (cur.lines || []).splice(idx, 1);
        cur.days = cur.lines.length || 1;
        await DB.put('trips', cur);
        viewTrip(id);
      });
    });
    modal.querySelector('[data-line-add]').addEventListener('click', async function() {
      const cur = await DB.get('trips', id);
      cur.lines = cur.lines || [];
      cur.lines.push(['', '']);
      cur.days = cur.lines.length;
      await DB.put('trips', cur);
      viewTrip(id);
    });
    // AI 生成行程
    const aiBtn = modal.querySelector('[data-ai-trip]');
    if (aiBtn) {
      aiBtn.addEventListener('click', async function() {
        const conf = await AI.getConf();
        if (!conf.enabled) { UI.toast('请先在设置页配置 AI 接口'); return; }
        aiBtn.textContent = '生成中…';
        aiBtn.disabled = true;
        const cur = await DB.get('trips', id);
        ensureDestinations(cur);
        const dest = cur.destinations.map(function(d){return d.name;}).join('→');
        const r = await AI.genTrip(dest, cur.days || 1, cur.people || 2, cur.members, cur.transport);
        if (r.ok && r.lines && r.lines.length) {
          cur.lines = r.lines;
          cur.days = r.lines.length;
          await DB.put('trips', cur);
          UI.toast('AI 行程已生成，可手动调整');
          viewTrip(id);
        } else {
          UI.toast('生成失败：' + (r.error || '未知错误'));
          aiBtn.textContent = '✨ AI 生成行程';
          aiBtn.disabled = false;
        }
      });
    }
  }

  // 编辑某天行程
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
      viewTrip(id);
    });
  }

  // ===== Leaflet 地图 =====
  async function viewMap(id) {
    const tp = await DB.get('trips', id);
    if (!tp) return;
    ensureDestinations(tp);
    const hasCoords = tp.destinations.some(function(d) { return d.lat && d.lng; });

    let html = '<h3>🗺️ 旅行地图</h3>';
    if (hasCoords && navigator.onLine) {
      html += '<div id="trip-map" style="height:320px;border-radius:10px;overflow:hidden;margin-bottom:10px;"></div>';
      html += '<div style="font-size:12px;color:var(--sub);">绿色标记为目的地，按旅行顺序排列</div>';
    } else {
      html += '<div style="background:var(--bg);border-radius:10px;padding:20px;text-align:center;">' +
        '<div style="font-size:32px;">📍</div>' +
        '<div style="font-size:13px;color:var(--sub);margin-top:6px;">' + (navigator.onLine ? '部分目的地暂无坐标' : '离线模式，显示目的地列表') + '</div>' +
        '</div>';
    }
    // 目的地列表
    html += '<div style="margin-top:10px;">';
    tp.destinations.forEach(function(d, i) {
      html += '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);">' +
        '<span style="width:24px;height:24px;border-radius:50%;background:var(--green);color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0;">' + (i+1) + '</span>' +
        '<span style="font-size:13.5px;font-weight:600;">' + UI.esc(d.name) + '</span>' +
        (d.start ? '<span style="font-size:12px;color:var(--sub);margin-left:auto;">' + UI.fmtDate(d.start) + (d.end?' - '+UI.fmtDate(d.end):'') + '</span>' : '') +
        '</div>';
    });
    html += '</div>';
    html += '<div class="foot"><button class="btn" data-x="1">关闭</button></div>';
    UI.openModal(html);
    const modal = document.querySelector('.modal');
    modal.querySelector('[data-x]').addEventListener('click', function() { UI.closeModal(); });

    // 加载 Leaflet 并渲染地图
    if (hasCoords && navigator.onLine) {
      if (typeof L === 'undefined') {
        // 动态加载 Leaflet CSS + JS
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = function() { renderLeafletMap(tp); };
        script.onerror = function() {
          document.getElementById('trip-map').innerHTML = '<div style="padding:20px;text-align:center;color:var(--sub);font-size:13px;">地图加载失败，请检查网络</div>';
        };
        document.head.appendChild(script);
      } else {
        renderLeafletMap(tp);
      }
    }
  }

  function renderLeafletMap(tp) {
    const el = document.getElementById('trip-map');
    if (!el || typeof L === 'undefined') return;
    const map = L.map(el).setView([tp.destinations[0].lat || 35, tp.destinations[0].lng || 105], 4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 18
    }).addTo(map);
    const coords = [];
    tp.destinations.forEach(function(d, i) {
      if (d.lat && d.lng) {
        L.marker([d.lat, d.lng]).addTo(map)
          .bindPopup('<b>' + (i+1) + '. ' + d.name + '</b>' + (d.start ? '<br>' + d.start + (d.end?' - '+d.end:'') : ''));
        coords.push([d.lat, d.lng]);
      }
    });
    if (coords.length > 1) {
      L.polyline(coords, { color: '#2d8659', weight: 3, dashArray: '8,6' }).addTo(map);
    }
    if (coords.length) {
      setTimeout(function() { map.fitBounds(coords, { padding: [40, 40] }); }, 100);
    }
  }

  // ===== 旅行预算 =====
  async function viewBudget(id) {
    const tp = await DB.get('trips', id);
    if (!tp) return;
    const budget = tp.budget || 0;
    const expenses = tp.expenses || [];
    const spent = expenses.reduce(function(s,e){ return s + (+e.amount||0); }, 0);
    const remain = budget - spent;
    const pct = budget > 0 ? Math.min(100, Math.round(spent / budget * 100)) : 0;

    let html = '<h3>💰 旅行预算</h3>';
    html += '<div style="display:flex;gap:10px;margin-bottom:14px;">' +
      '<div style="flex:1;background:var(--green-bg);border-radius:10px;padding:10px;text-align:center;">' +
        '<div style="font-size:11px;color:var(--sub);">预算</div><div style="font-size:18px;font-weight:700;">¥' + budget + '</div></div>' +
      '<div style="flex:1;background:#fff3e0;border-radius:10px;padding:10px;text-align:center;">' +
        '<div style="font-size:11px;color:var(--sub);">已花</div><div style="font-size:18px;font-weight:700;color:#e67e22;">¥' + spent + '</div></div>' +
      '<div style="flex:1;background:#e8f5e9;border-radius:10px;padding:10px;text-align:center;">' +
        '<div style="font-size:11px;color:var(--sub);">剩余</div><div style="font-size:18px;font-weight:700;color:' + (remain<0?'var(--red)':'#2d8659') + ';">¥' + remain + '</div></div>' +
    '</div>';
    // 进度条
    html += '<div style="height:8px;background:var(--border);border-radius:4px;overflow:hidden;margin-bottom:14px;">' +
      '<div style="height:100%;width:' + pct + '%;background:' + (pct>100?'var(--red)':pct>80?'#faad14':'var(--green)') + ';border-radius:4px;"></div></div>';

    // 支出记录
    html += '<div style="font-weight:700;margin-bottom:6px;">支出明细（' + expenses.length + '笔）</div>';
    if (expenses.length) {
      expenses.forEach(function(e, i) {
        html += '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px;">' +
          '<span style="background:var(--green-bg);padding:2px 8px;border-radius:6px;font-size:11px;">' + UI.esc(e.cat||'其他') + '</span>' +
          '<span style="flex:1;">' + UI.esc(e.note||'') + '</span>' +
          '<span style="font-weight:600;">¥' + e.amount + '</span>' +
          '<button class="btn sm ghost" data-exp-del="' + i + '" style="color:var(--red);font-size:11px;">删</button>' +
        '</div>';
      });
    } else {
      html += '<div style="font-size:12px;color:var(--sub);padding:8px 0;">暂无支出记录</div>';
    }

    // 添加支出
    html += '<div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;">' +
      '<select id="exp-cat" style="width:90px;">' +
        ['交通','住宿','餐饮','门票','购物','其他'].map(function(c){return '<option>'+c+'</option>';}).join('') +
      '</select>' +
      '<input id="exp-amount" type="number" placeholder="金额" style="width:80px;">' +
      '<input id="exp-note" placeholder="备注" style="flex:1;min-width:80px;">' +
      '<button class="btn sm" id="exp-add">+ 记一笔</button>' +
    '</div>';
    html += '<div class="foot"><button class="btn" data-x="1">关闭</button></div>';
    UI.openModal(html);
    const modal = document.querySelector('.modal');
    modal.querySelector('[data-x]').addEventListener('click', function() { UI.closeModal(); });

    modal.querySelector('#exp-add').addEventListener('click', async function() {
      const amount = +document.getElementById('exp-amount').value;
      if (!amount) { UI.toast('请输入金额'); return; }
      const cat = document.getElementById('exp-cat').value;
      const note = document.getElementById('exp-note').value.trim();
      const cur = await DB.get('trips', id);
      cur.expenses = cur.expenses || [];
      cur.expenses.push({ cat: cat, amount: amount, note: note, date: UI.todayStr() });
      await DB.put('trips', cur);
      viewBudget(id);
    });
    modal.querySelectorAll('[data-exp-del]').forEach(function(b) {
      b.addEventListener('click', async function() {
        const idx = +b.getAttribute('data-exp-del');
        const cur = await DB.get('trips', id);
        cur.expenses.splice(idx, 1);
        await DB.put('trips', cur);
        viewBudget(id);
      });
    });
  }

  // ===== 携带清单 =====
  async function viewPacking(id) {
    const tp = await DB.get('trips', id);
    if (!tp) return;
    ensureDestinations(tp);
    const all = await DB.getAll('packing_items');
    const items = all.filter(function(pi) { return pi.tripId == id; });
    const cats = {};
    items.forEach(function(pi) { (cats[pi.cat] = cats[pi.cat] || []).push(pi); });

    let html = '<h3>🧳 携带物品清单</h3>';
    html += '<p style="font-size:12.5px;color:var(--sub);margin-bottom:10px;">' + UI.esc(tp.destinations.map(function(d){return d.name;}).join('→')) + ' · ' + tp.days + '天 · ' + tp.people + '人 · ' + (tp.transport||'') + ' · 勾选表示已打包</p>';

    const doneCount = items.filter(function(i){return i.done;}).length;
    html += '<div style="margin-bottom:10px;font-size:13px;">已打包 <b>' + doneCount + '</b> / ' + items.length + ' 件</div>';

    Object.keys(cats).forEach(function(cat) {
      html += '<div style="margin-bottom:10px;">';
      html += '<div style="font-weight:700;font-size:13px;margin-bottom:4px;">' + cat + '</div>';
      cats[cat].forEach(function(pi) {
        html += '<label style="display:flex;align-items:center;gap:8px;font-size:13px;padding:3px 0;cursor:pointer;">' +
          '<input type="checkbox" data-pack-id="' + pi.id + '"' + (pi.done ? ' checked' : '') + ' style="width:16px;height:16px;">' +
          '<span style="' + (pi.done ? 'text-decoration:line-through;color:var(--sub);' : '') + '">' + UI.esc(pi.name) + '</span>' +
          '<span style="color:var(--sub);font-size:12px;">× ' + pi.qty + '</span>' +
          (!pi.auto ? '<span style="font-size:10px;background:#fff3e0;color:#e67e22;padding:1px 5px;border-radius:4px;">手动</span>' : '') +
          '<button class="btn sm ghost" data-pack-del="' + pi.id + '" style="margin-left:auto;color:var(--red);font-size:11px;">删</button>' +
        '</label>';
      });
      html += '</div>';
    });

    html += '<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);">' +
      '<div style="font-weight:700;font-size:13px;margin-bottom:6px;">➕ 手动添加物品</div>' +
      '<div style="display:flex;gap:6px;">' +
        '<input id="new-pack-name" placeholder="物品名" style="flex:1;">' +
        '<input id="new-pack-qty" type="number" value="1" style="width:60px;">' +
        '<button class="btn sm" id="new-pack-add">添加</button>' +
      '</div>' +
    '</div>';
    html += '<div class="foot"><button class="btn" data-x="1">关闭</button></div>';
    UI.openModal(html);
    const modal = document.querySelector('.modal');
    modal.querySelector('[data-x]').addEventListener('click', function() { UI.closeModal(); });

    modal.querySelectorAll('[data-pack-id]').forEach(function(cb) {
      cb.addEventListener('change', async function() {
        const pid = +cb.getAttribute('data-pack-id');
        const item = await DB.get('packing_items', pid);
        if (item) { item.done = cb.checked; await DB.put('packing_items', item); }
      });
    });
    modal.querySelectorAll('[data-pack-del]').forEach(function(b) {
      b.addEventListener('click', async function() {
        await DB.del('packing_items', +b.getAttribute('data-pack-del'));
        viewPacking(id);
      });
    });
    modal.querySelector('#new-pack-add').addEventListener('click', async function() {
      const name = document.getElementById('new-pack-name').value.trim();
      const qty = +document.getElementById('new-pack-qty').value || 1;
      if (!name) { UI.toast('请输入物品名'); return; }
      await DB.add('packing_items', { tripId: id, cat: '🎒 手动添加', name: name, qty: qty, done: false, auto: false });
      viewPacking(id);
    });
  }

  // ===== 事件绑定 =====
  async function onAction(e) {
    const t = e.target;
    if (t.getAttribute('data-new')) { openForm(null); return; }
    if (t.getAttribute('data-view')) { viewTrip(+t.getAttribute('data-view')); return; }
    if (t.getAttribute('data-pack')) { viewPacking(+t.getAttribute('data-pack')); return; }
    if (t.getAttribute('data-map')) { viewMap(+t.getAttribute('data-map')); return; }
    if (t.getAttribute('data-budget')) { viewBudget(+t.getAttribute('data-budget')); return; }
    if (t.getAttribute('data-edit')) {
      const tp = await DB.get('trips', +t.getAttribute('data-edit'));
      if (tp) openForm(tp);
      return;
    }
    if (t.getAttribute('data-del')) {
      if (!confirm('确定删除这个旅行规划？相关清单也会删除。')) return;
      const id = +t.getAttribute('data-del');
      await DB.del('trips', id);
      const all = await DB.getAll('packing_items');
      for (const pi of all) { if (pi.tripId == id) await DB.del('packing_items', pi.id); }
      UI.toast('已删除');
      App.render();
      return;
    }
  }

  function bind(root) {
    root.removeEventListener('click', onAction);
    root.addEventListener('click', onAction);
  }

  return { body: body, bind: bind };
})();
