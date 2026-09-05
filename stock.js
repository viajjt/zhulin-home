/* 家庭管理系统 - 页面：物品 / 库存 */
const StockPage = (function() {
  let filter = 'all';

  const CATS = [
    { k:'rice', n:'🍚 主食' }, { k:'meat', n:'🥩 肉蛋' },
    { k:'veg', n:'🥬 果蔬' }, { k:'season', n:'🧂 调味' },
    { k:'daily', n:'🧻 日用' }, { k:'drink', n:'🥛 饮品' },
    { k:'other', n:'📦 其他' }
  ];

  function catName(k) {
    const c = CATS.find(function(x) { return x.k === k; });
    return c ? c.n : '📦 其他';
  }

  function statusOf(item) {
    if (item.expire) {
      const d = UI.daysUntil(item.expire);
      if (d < 0) return { t:'已过期 ' + (-d) + ' 天', cls:'red' };
      if (d === 0) return { t:'今天过期', cls:'red' };
      if (d <= 3) return { t:'还有 ' + d + ' 天过期', cls:'org' };
    }
    if (item.min && item.qty <= item.min) return { t:'低于安全库存', cls:'org' };
    if (item.qty <= 0) return { t:'已用完', cls:'red' };
    return { t:'正常', cls:'grn' };
  }

  async function body() {
    const all = await DB.getAll('inventory_items');
    let list = all;
    if (filter === 'low') {
      list = all.filter(function(it) {
        const s = statusOf(it);
        return s.cls === 'red' || s.cls === 'org';
      });
    } else if (filter === 'expire') {
      list = all.filter(function(it) { return it.expire && UI.daysUntil(it.expire) <= 3; });
    }

    const lowCount = all.filter(function(it) { return statusOf(it).cls !== 'grn'; }).length;
    const expireCount = all.filter(function(it) { return it.expire && UI.daysUntil(it.expire) <= 3; }).length;

    let html = '';
    // 概览卡
    html += '<div class="grid2">' +
      '<div class="card" style="text-align:center;"><div style="font-size:12px;color:var(--sub);">库存物品</div><div style="font-size:24px;font-weight:700;">' + all.length + '</div></div>' +
      '<div class="card" style="text-align:center;"><div style="font-size:12px;color:var(--sub);">需补货/临期</div><div style="font-size:24px;font-weight:700;color:' + (lowCount ? 'var(--org)' : 'var(--green)') + ';">' + lowCount + '</div></div>' +
    '</div>';

    // 预警
    if (expireCount > 0) {
      html += '<div class="section-title">⏰ 临期提醒（' + expireCount + '）</div>';
      html += '<div class="card">';
      all.filter(function(it) { return it.expire && UI.daysUntil(it.expire) <= 3; })
        .sort(function(a, b) { return a.expire.localeCompare(b.expire); })
        .forEach(function(it) {
          const s = statusOf(it);
          html += '<div class="kv"><span class="k">' + UI.esc(it.name) + '</span><span class="pill ' + s.cls + '">' + s.t + '</span></div>';
        });
      html += '</div>';
    }

    // 筛选
    html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:4px 0;">' +
      '<button class="btn sm ' + (filter==='all'?'':'ghost') + '" data-flt="all">全部</button>' +
      '<button class="btn sm ' + (filter==='low'?'':'ghost') + '" data-flt="low">需补货</button>' +
      '<button class="btn sm ' + (filter==='expire'?'':'ghost') + '" data-flt="expire">临期</button>' +
    '</div>';

    // 按分类分组
    const groups = {};
    CATS.forEach(function(c) { groups[c.k] = []; });
    list.forEach(function(it) { (groups[it.cat] = groups[it.cat] || []).push(it); });

    CATS.forEach(function(c) {
      const items = groups[c.k] || [];
      if (!items.length) return;
      html += '<div class="section-title">' + c.n + '（' + items.length + '）</div>';
      html += '<div class="card">';
      items.forEach(function(it) {
        const s = statusOf(it);
        html += '<div class="kv">' +
          '<span class="k">' + UI.esc(it.name) +
            (it.unit ? ' <span style="color:var(--sub);font-size:12px;">' + UI.esc(it.unit) + '</span>' : '') +
          '</span>' +
          '<span class="v">' +
            '<span style="font-weight:600;color:var(--text);">' + it.qty + '</span>' +
            '<span class="pill ' + s.cls + '">' + s.t + '</span>' +
            '<button class="btn sm ghost" data-inc="' + it.id + '">+</button>' +
            '<button class="btn sm ghost" data-dec="' + it.id + '">−</button>' +
            '<button class="btn sm ghost" data-edit="' + it.id + '">改</button>' +
            '<button class="btn sm ghost" data-del="' + it.id + '">删</button>' +
          '</span></div>';
      });
      html += '</div>';
    });

    if (!list.length) {
      html += '<div class="card"><div class="empty"><span class="e">📦</span>暂无物品，点下面按钮添加</div></div>';
    }

    html += '<div style="margin-top:20px;display:flex;gap:10px;flex-wrap:wrap;">' +
      '<button class="btn block" data-new="1" style="flex:1 1 160px;">+ 添加物品</button>' +
      '<button class="btn block blue" data-list="1" style="flex:1 1 200px;">🧾 生成购物清单</button>' +
    '</div>';
    return html;
  }

  function openForm(item) {
    const catOpts = CATS.map(function(c) {
      return '<option value="' + c.k + '"' + (item && item.cat === c.k ? ' selected' : '') + '>' + c.n + '</option>';
    }).join('');
    UI.openModal(
      '<h3>' + (item ? '编辑物品' : '添加物品') + '</h3>' +
      '<div class="field"><label>名称</label><input id="s-name" value="' + UI.esc(item ? item.name : '') + '" placeholder="如：抽纸"></div>' +
      '<div class="two">' +
        '<div class="field"><label>分类</label><select id="s-cat">' + catOpts + '</select></div>' +
        '<div class="field"><label>单位</label><input id="s-unit" value="' + UI.esc(item ? item.unit : '') + '" placeholder="包/箱/个"></div>' +
      '</div>' +
      '<div class="two">' +
        '<div class="field"><label>当前数量</label><input id="s-qty" type="number" value="' + (item ? item.qty : 1) + '"></div>' +
        '<div class="field"><label>安全库存（低于则提醒）</label><input id="s-min" type="number" value="' + (item ? (item.min||0) : 0) + '"></div>' +
      '</div>' +
      '<div class="field"><label>保质期（可选，到期提醒）</label><input id="s-expire" type="date" value="' + (item && item.expire ? item.expire : '') + '"></div>' +
      '<div class="foot">' +
        '<button class="btn ghost" data-x="1">取消</button>' +
        '<button class="btn" data-save="1">保存</button>' +
      '</div>'
    );
    const modal = document.querySelector('.modal');
    modal.querySelector('[data-x]').addEventListener('click', function() { UI.closeModal(); });
    modal.querySelector('[data-save]').addEventListener('click', async function() {
      const name = document.getElementById('s-name').value.trim();
      if (!name) { UI.toast('请填写物品名称'); return; }
      const obj = {
        name: name,
        cat: document.getElementById('s-cat').value,
        unit: document.getElementById('s-unit').value.trim(),
        qty: Math.max(0, +document.getElementById('s-qty').value || 0),
        min: Math.max(0, +document.getElementById('s-min').value || 0),
        expire: document.getElementById('s-expire').value || null
      };
      if (item) obj.id = item.id;
      await DB.put('inventory_items', obj);
      UI.closeModal();
      UI.toast('已保存');
      App.render();
    });
  }

  async function showShoppingList() {
    const all = await DB.getAll('inventory_items');
    const need = all.filter(function(it) {
      const s = statusOf(it);
      return s.cls === 'red' || s.cls === 'org';
    });
    const shopItems = await DB.getAll('shopping_items');
    const pending = shopItems.filter(function(s) { return !s.done; });
    const total = need.length + pending.length;
    if (!total) {
      UI.toast('没有需要采购的物品 🎉');
      return;
    }
    let html = '<h3>🧾 购物清单（' + total + ' 项）</h3>';
    if (need.length) {
      html += '<div style="font-size:13px;font-weight:600;margin-bottom:6px;">低库存 / 临期</div>';
      need.forEach(function(it) {
        const s = statusOf(it);
        html += '<div class="kv"><span class="k">' + UI.esc(it.name) + '</span><span class="pill ' + s.cls + '">' + s.t + '</span></div>';
      });
    }
    if (pending.length) {
      html += '<div style="font-size:13px;font-weight:600;margin:10px 0 6px;">点餐食材待购</div>';
      pending.forEach(function(s) {
        html += '<div class="kv"><span class="k">' + UI.esc(s.name) + '<span style="color:var(--sub);font-size:12px;font-weight:400;"> ×' + UI.esc(s.qty.join(' / ')) + '</span></span>' +
          '<button class="btn sm" data-shop-done="' + s.id + '" style="padding:3px 10px;">买好了</button></div>';
      });
    }
    html += '<div class="foot"><button class="btn" data-x="1">知道了</button></div>';
    UI.openModal(html);
    const modal = document.querySelector('.modal');
    modal.querySelector('[data-x]').addEventListener('click', function() { UI.closeModal(); });
    modal.querySelectorAll('[data-shop-done]').forEach(function(b) {
      b.addEventListener('click', async function() {
        const it = await DB.get('shopping_items', +b.getAttribute('data-shop-done'));
        it.done = true;
        await DB.put('shopping_items', it);
        UI.closeModal();
        UI.toast('已标记买好 🎉');
        App.render();
      });
    });
  }

  async function onAction(e) {
    const t = e.target;
    const inc = t.getAttribute('data-inc');
    const dec = t.getAttribute('data-dec');
    const edit = t.getAttribute('data-edit');
    const del = t.getAttribute('data-del');
    const flt = t.getAttribute('data-flt');
    const isNew = t.getAttribute('data-new');
    const isList = t.getAttribute('data-list');

    if (inc) {
      const it = await DB.get('inventory_items', +inc);
      it.qty = (it.qty || 0) + 1;
      await DB.put('inventory_items', it);
      App.render();
    } else if (dec) {
      const it = await DB.get('inventory_items', +dec);
      it.qty = Math.max(0, (it.qty || 0) - 1);
      await DB.put('inventory_items', it);
      App.render();
    } else if (edit) {
      openForm(await DB.get('inventory_items', +edit));
    } else if (del) {
      const id = +del;
      UI.openModal('<h3>删除物品</h3><p style="color:var(--sub);font-size:14px;margin-bottom:8px;">确定删除这件物品吗？</p><div class="foot"><button class="btn ghost" data-x="1">取消</button><button class="btn" data-ok="1" style="background:var(--red);">删除</button></div>');
      const modal = document.querySelector('.modal');
      modal.querySelector('[data-x]').addEventListener('click', function() { UI.closeModal(); });
      modal.querySelector('[data-ok]').addEventListener('click', async function() {
        await DB.del('inventory_items', id);
        UI.closeModal();
        UI.toast('已删除');
        App.render();
      });
    } else if (flt) {
      filter = flt;
      App.render();
    } else if (isNew) {
      openForm(null);
    } else if (isList) {
      showShoppingList();
    }
  }

  function bind(root) {
    root.addEventListener('click', onAction);
  }

  return { body: body, bind: bind };
})();
