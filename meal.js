/* 家庭管理系统 - 页面：家庭点餐
   指定开饭时间 → 自动生成食材/调料采购清单 → 做饭排期（简单版：倒推开饭时间）
   菜谱库 / 餐单模板均支持自定义增删改（DB 化） · AI 菜品图占位（预留接口）
*/
const MealPage = (function() {
  const mealTypeName = { breakfast:'早餐', lunch:'午餐', dinner:'晚餐' };
  // 常备调料（默认不进采购清单）
  const STAPLE_SEASONINGS = ['盐','糖','生抽','老抽','酱油','料酒','醋','香醋','陈醋','蚝油','香油','食用油','花生油','橄榄油','鸡精','味精','淀粉','胡椒粉','五香粉','花椒','八角','桂皮','干辣椒','冰糖','姜','蒜','葱','白芝麻'];
  // 内置示例菜谱（首次运行时植入 DB）
  const SEED_DISHES = [
    { name:'红烧排骨', cat:'meat', catn:'🍖 荤菜', time:45, ai:true, ing:[['排骨','500g'],['姜','3片'],['葱','1根']], sea:[['生抽','2勺'],['料酒','1勺'],['冰糖','适量'],['盐','少许']] },
    { name:'番茄蛋汤', cat:'soup', catn:'🍲 汤', time:15, ai:true, ing:[['番茄','2个'],['鸡蛋','3个'],['葱花','少许']], sea:[['盐','少许'],['香油','几滴']] },
    { name:'清蒸鲈鱼', cat:'meat', catn:'🍖 荤菜', time:25, ai:false, ing:[['鲈鱼','1条'],['姜','5片'],['葱','1根']], sea:[['蒸鱼豉油','2勺'],['料酒','1勺']] },
    { name:'凉拌黄瓜', cat:'veg', catn:'🥬 素菜', time:5, ai:true, ing:[['黄瓜','2根'],['蒜','3瓣']], sea:[['生抽','1勺'],['香醋','1勺'],['盐','少许'],['香油','几滴']] },
    { name:'土豆丝', cat:'veg', catn:'🥬 素菜', time:12, ai:false, ing:[['土豆','2个'],['青椒','1个']], sea:[['醋','1勺'],['盐','少许']] },
    { name:'番茄牛腩', cat:'meat', catn:'🍖 荤菜', time:60, ai:true, ing:[['牛腩','500g'],['番茄','3个'],['洋葱','半个']], sea:[['生抽','2勺'],['番茄酱','1勺'],['盐','适量']] }
  ];
  const SEED_TEMPLATES = [
    { name:'工作日快手餐', desc:'周一~五晚餐 · 快手省事', plans:[['晚餐','红烧排骨','18:30'],['晚餐','凉拌黄瓜','18:30']] },
    { name:'周末大餐', desc:'六日 · 丰盛一点', plans:[['晚餐','番茄牛腩','19:00'],['晚餐','清蒸鲈鱼','19:00']] }
  ];

  // 确保菜谱 / 模板有数据（首次植入示例）
  async function ensureSeeds() {
    const dishes = await DB.getAll('dishes');
    if (!dishes.length) {
      for (const d of SEED_DISHES) await DB.add('dishes', d);
    }
    const tpls = await DB.getAll('meal_templates');
    if (!tpls.length) {
      for (const t of SEED_TEMPLATES) await DB.add('meal_templates', t);
    }
  }

  // 合并采购清单（去重、合并数量文本）
  function mergeIngredients(planDishes) {
    const map = {};
    planDishes.forEach(function(d) {
      (d.ing||[]).forEach(function(pair) {
        const k = pair[0];
        if (!map[k]) map[k] = { name:k, qty:[], sea:false };
        map[k].qty.push(pair[1]);
      });
    });
    const ing = Object.values(map);
    const seas = {};
    planDishes.forEach(function(d) {
      (d.sea||[]).forEach(function(pair) {
        const k = pair[0];
        if (!seas[k]) seas[k] = pair[1];
      });
    });
    return { ing: ing, sea: Object.entries(seas).map(function(x){ return x; }) };
  }

  async function body() {
    await ensureSeeds();
    const plans = await DB.getAll('meal_plans');
    const dishes = await DB.getAll('dishes');
    const templates = await DB.getAll('meal_templates');
    const members = await DB.getAll('members');
    const memberMap = {};
    members.forEach(function(m) { memberMap[m.id] = m; });
    const today = UI.todayStr();

    let html = '';

    // 本周餐单概览
    html += '<div class="section-title">📋 今日餐单（' + UI.fmtCn(today) + '）</div>';
    const todayPlans = plans.filter(function(p) { return p.date === today; });
    if (todayPlans.length) {
      html += '<div class="card">';
      todayPlans.forEach(function(p) {
        const cook = p.cook && memberMap[p.cook] ? memberMap[p.cook].name : '未排';
        html += '<div class="kv"><span class="k">' + (mealTypeName[p.meal_type]||'') + ' · ' + UI.esc(p.dishes) + '</span>' +
          '<span class="v">' + (p.time ? '<span style="color:var(--sub);font-size:12px;">' + p.time + ' 开饭</span>' : '') + '<span class="pill pink">' + UI.esc(cook) + '</span></span></div>';
      });
      html += '</div>';
    } else {
      html += '<div class="card"><div class="empty"><span class="e">🍚</span>今天还没安排，点下面按钮点餐</div></div>';
    }

    // 本周餐单（从今天起7天）
    html += '<div class="section-title">📅 本周餐单</div>';
    const weekPlans = plans.filter(function(p) { return p.date >= today; });
    if (weekPlans.length) {
      html += '<div class="card">';
      weekPlans.sort(function(a,b){ return (a.date||'').localeCompare(b.date||''); }).slice(0,10).forEach(function(p) {
        const cook = p.cook && memberMap[p.cook] ? memberMap[p.cook].name : '';
        html += '<div class="kv"><span class="k">' + UI.fmtCn(p.date) + ' · ' + (mealTypeName[p.meal_type]||'') + ' · ' + UI.esc(p.dishes) + '</span>' +
          '<span class="v">' + (p.time ? '<span style="color:var(--sub);font-size:12px;">' + p.time + '</span>' : '') + (cook ? '<span class="pill pink">' + UI.esc(cook) + '</span>' : '') + '<button class="btn sm ghost" data-del-plan="' + p.id + '">删</button></span></div>';
      });
      html += '</div>';
    }

    html += '<div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">' +
      '<button class="btn block" data-new-plan="1" style="flex:1 1 150px;">+ 点餐</button>' +
      '<button class="btn block ghost" data-template="1" style="flex:1 1 170px;">📋 餐单模板</button>' +
    '</div>';

    // 自动采购清单（示例：展示今日已点菜品的合并清单 + 做饭排期）
    if (todayPlans.length) {
      const planDishes = [];
      todayPlans.forEach(function(p) {
        p.dishIds = p.dishIds || [];
        p.dishIds.forEach(function(did) {
          const d = dishes.find(function(x) { return x.id == did; });
          if (d) planDishes.push(d);
        });
      });
      if (planDishes.length) {
        const merged = mergeIngredients(planDishes);
        // 做饭排期：倒推开饭时间
        html += '<div class="section-title">⏱️ 做饭排期（简单版 · 倒推开饭时间）</div>';
        html += '<div class="card">';
        const timeStrs = todayPlans.map(function(p){ return p.time; }).filter(Boolean);
        if (timeStrs.length) {
          const dinnerTime = timeStrs[0];
          const sortedDishes = planDishes.slice().sort(function(a,b){ return b.time - a.time; });
          let cursor = dinnerTime;
          sortedDishes.forEach(function(d) {
            const start = subMinutes(cursor, d.time);
            html += '<div class="kv"><span class="k">' + start + ' - ' + cursor + ' · ' + UI.esc(d.name) + '（' + d.time + 'min）</span><span class="pill blue">做饭</span></div>';
            cursor = start;
          });
        } else {
          html += '<div class="empty">请先设置开饭时间以生成排期</div>';
        }
        html += '</div>';

        html += '<div class="section-title">🧺 自动采购清单</div>';
        html += '<div class="card">';
        html += '<div style="font-size:13px;font-weight:600;margin-bottom:6px;">食材</div>';
        merged.ing.forEach(function(it) {
          html += '<div class="kv"><span class="k">' + UI.esc(it.name) + '</span><span class="v" style="color:var(--text);font-weight:600;">' + it.qty.join(' / ') + '</span></div>';
        });
        html += '<div style="font-size:13px;font-weight:600;margin:10px 0 6px;">调料（常备默认不进采购清单）</div>';
        merged.sea.forEach(function(pair) {
          html += '<div class="kv"><span class="k">' + UI.esc(pair[0]) + '</span><span class="v"><span class="pill grn">' + (STAPLE_SEASONINGS.indexOf(pair[0]) >= 0 ? '常备' : '需购买') + '</span></span></div>';
        });
        html += '<div style="margin-top:12px;"><button class="btn block blue" data-to-shop="1">🧾 并入购物清单（库存页可见）</button></div>';
        html += '</div>';
      }
    }

    // 菜谱库（可自定义增删改）
    html += '<div class="section-title">📖 菜谱库（' + dishes.length + '）</div>';
    if (dishes.length) {
      html += '<div class="grid2">';
      dishes.forEach(function(d) {
        html += '<div class="card" style="flex:1 1 200px;">' +
          '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">' +
            '<div style="width:40px;height:40px;border-radius:10px;background:var(--pink-bg);display:flex;align-items:center;justify-content:center;font-size:20px;">🍽️</div>' +
            '<div class="txt"><div class="t1">' + UI.esc(d.name) + '</div><div class="t2">' + (d.catn||'') + ' · ' + d.time + 'min' + (d.ai ? ' · ✨AI图' : ' · 📷实拍') + '</div></div>' +
          '</div>' +
          '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
            '<button class="btn sm" data-pick="' + d.id + '">选这道菜</button>' +
            '<button class="btn sm ghost" data-see="' + d.id + '">详情</button>' +
            '<button class="btn sm ghost" data-edit-dish="' + d.id + '">改</button>' +
            '<button class="btn sm ghost" data-del-dish="' + d.id + '" style="color:var(--red);">删</button>' +
          '</div>' +
        '</div>';
      });
      html += '</div>';
    } else {
      html += '<div class="card"><div class="empty"><span class="e">📖</span>还没有菜谱，点下面按钮添加</div></div>';
    }
    html += '<div style="margin-top:12px;"><button class="btn block ghost" data-new-dish="1">+ 添加菜谱</button></div>';

    return html;
  }

  function subMinutes(time, mins) {
    if (!time) return '';
    const parts = time.split(':');
    let h = +parts[0], m = +parts[1];
    let total = h*60 + m - mins;
    if (total < 0) total += 24*60;
    h = Math.floor(total/60); m = total%60;
    return (h<10?'0':'') + h + ':' + (m<10?'0':'') + m;
  }

  function openPlanForm() {
    DB.getAll('dishes').then(function(dishes) {
      const dishOpts = dishes.map(function(d) {
        return '<option value="' + d.id + '">' + UI.esc(d.name) + '（' + d.time + 'min）</option>';
      }).join('');
      return DB.getAll('members').then(function(ms) {
        const cookOpts = ms.map(function(m) { return '<option value="' + m.id + '">' + UI.esc(m.name) + '</option>'; }).join('');
        UI.openModal(
          '<h3>点餐</h3>' +
          '<div class="field"><label>日期</label><input id="p-date" type="date" value="' + UI.todayStr() + '"></div>' +
          '<div class="two">' +
            '<div class="field"><label>餐次</label><select id="p-type">' +
              '<option value="breakfast">早餐</option><option value="lunch">午餐</option><option value="dinner" selected>晚餐</option>' +
            '</select></div>' +
            '<div class="field"><label>菜品</label><select id="p-dish">' + dishOpts + '</select></div>' +
          '</div>' +
          '<div class="two">' +
            '<div class="field"><label>开饭时间</label><input id="p-time" type="time" value="18:30"></div>' +
            '<div class="field"><label>做饭人</label><select id="p-cook">' + (cookOpts || '<option value="">未排</option>') + '</select></div>' +
          '</div>' +
          '<div class="foot"><button class="btn ghost" data-x="1">取消</button><button class="btn" data-save="1">加入餐单</button></div>'
        );
        const modal = document.querySelector('.modal');
        modal.querySelector('[data-x]').addEventListener('click', function() { UI.closeModal(); });
        modal.querySelector('[data-save]').addEventListener('click', async function() {
          const date = document.getElementById('p-date').value;
          const meal_type = document.getElementById('p-type').value;
          const dishId = +document.getElementById('p-dish').value;
          const dish = dishes.find(function(d) { return d.id === dishId; });
          const time = document.getElementById('p-time').value;
          const cook = document.getElementById('p-cook').value || null;
          if (!date || !dish) { UI.toast('请选择日期和菜品'); return; }
          await DB.add('meal_plans', {
            date: date, meal_type: meal_type,
            dishes: dish.name, dishIds: [dishId],
            time: time, cook: cook
          });
          UI.closeModal();
          UI.toast('已加入餐单，采购清单已更新');
          App.render();
        });
      });
    });
  }

  function openDishForm(dish) {
    UI.openModal(
      '<h3>' + (dish ? '编辑菜谱' : '添加菜谱') + '</h3>' +
      '<div class="field"><label>菜名</label><input id="d-name" value="' + UI.esc(dish ? dish.name : '') + '" placeholder="如：可乐鸡翅"></div>' +
      '<div class="two">' +
        '<div class="field"><label>分类</label><select id="d-cat">' +
          ['meat','veg','soup','other'].map(function(c) {
            const cn = { meat:'🍖 荤菜', veg:'🥬 素菜', soup:'🍲 汤', other:'🍽️ 其他' };
            return '<option value="' + c + '"' + (dish && dish.cat===c ? ' selected' : '') + '>' + cn[c] + '</option>';
          }).join('') +
        '</select></div>' +
        '<div class="field"><label>耗时（分钟）</label><input id="d-time" type="number" min="1" value="' + (dish ? dish.time : 20) + '"></div>' +
      '</div>' +
      '<div class="field"><label>食材（每行一项，格式：名称 用量）</label><textarea id="d-ing" rows="4" placeholder="排骨 500g&#10;姜 3片">' + UI.esc(dish && dish.ing ? dish.ing.map(function(p){return p.join(' ');}).join('\n') : '') + '</textarea></div>' +
      '<div class="field"><label>调料（每行一项，格式：名称 用量）</label><textarea id="d-sea" rows="3" placeholder="生抽 2勺">' + UI.esc(dish && dish.sea ? dish.sea.map(function(p){return p.join(' ');}).join('\n') : '') + '</textarea></div>' +
      '<div class="field"><label>菜品图</label><select id="d-ai">' +
        '<option value="1"' + (!dish || dish.ai ? ' selected' : '') + '>✨ AI 图占位（预留）</option>' +
        '<option value="0"' + (dish && !dish.ai ? ' selected' : '') + '>📷 实拍上传（预留）</option>' +
      '</select></div>' +
      '<div class="foot"><button class="btn ghost" data-x="1">取消</button><button class="btn" data-save="1">保存</button></div>'
    );
    const modal = document.querySelector('.modal');
    modal.querySelector('[data-x]').addEventListener('click', function() { UI.closeModal(); });
    modal.querySelector('[data-save]').addEventListener('click', async function() {
      const name = document.getElementById('d-name').value.trim();
      if (!name) { UI.toast('请填写菜名'); return; }
      const cat = document.getElementById('d-cat').value;
      const cn = { meat:'🍖 荤菜', veg:'🥬 素菜', soup:'🍲 汤', other:'🍽️ 其他' };
      const time = Math.max(1, +document.getElementById('d-time').value || 20);
      const ing = (document.getElementById('d-ing').value || '').split('\n').map(function(l) { return l.trim(); }).filter(Boolean).map(function(l) {
        const i = l.indexOf(' ');
        return i > 0 ? [l.slice(0,i).trim(), l.slice(i+1).trim()] : [l, '适量'];
      });
      const sea = (document.getElementById('d-sea').value || '').split('\n').map(function(l) { return l.trim(); }).filter(Boolean).map(function(l) {
        const i = l.indexOf(' ');
        return i > 0 ? [l.slice(0,i).trim(), l.slice(i+1).trim()] : [l, '适量'];
      });
      const ai = document.getElementById('d-ai').value === '1';
      const obj = { name: name, cat: cat, catn: cn[cat], time: time, ai: ai, ing: ing, sea: sea };
      if (dish) obj.id = dish.id;
      await DB.put('dishes', obj);
      UI.closeModal();
      UI.toast('已保存菜谱');
      App.render();
    });
  }

  function showTemplates() {
    DB.getAll('meal_templates').then(function(templates) {
      let html = '<h3>📋 餐单模板</h3>';
      if (!templates.length) html += '<div class="card"><div class="empty">还没有模板，点下面按钮添加</div></div>';
      templates.forEach(function(tp) {
        html += '<div style="border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:10px;">' +
          '<div style="font-weight:700;font-size:14px;">' + UI.esc(tp.name) + '</div>' +
          '<div style="font-size:12.5px;color:var(--sub);margin:4px 0 8px;">' + UI.esc(tp.desc) + '</div>' +
          '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
            '<button class="btn sm" data-apply="' + tp.id + '">套用到今天</button>' +
            '<button class="btn sm ghost" data-edit-tpl="' + tp.id + '">编辑</button>' +
            '<button class="btn sm ghost" data-del-tpl="' + tp.id + '" style="color:var(--red);">删除</button>' +
          '</div>' +
        '</div>';
      });
      html += '<div style="margin-top:8px;"><button class="btn block" data-new-tpl="1">+ 新建模板</button></div>';
      html += '<div class="foot"><button class="btn ghost" data-x="1">关闭</button></div>';
      UI.openModal(html);
      const modal = document.querySelector('.modal');
      modal.querySelector('[data-x]').addEventListener('click', function() { UI.closeModal(); });
      modal.querySelector('[data-new-tpl]').addEventListener('click', function() { openTemplateForm(null); });
      modal.querySelectorAll('[data-apply]').forEach(function(b) {
        b.addEventListener('click', async function() {
          const tp = templates.find(function(t) { return t.id === +b.getAttribute('data-apply'); });
          const dishes = await DB.getAll('dishes');
          const today = UI.todayStr();
          for (const pl of tp.plans || []) {
            const dish = dishes.find(function(d) { return d.name === pl[1]; });
            if (!dish) continue;
            await DB.add('meal_plans', {
              date: today, meal_type: pl[0] === '早餐' ? 'breakfast' : pl[0] === '午餐' ? 'lunch' : 'dinner',
              dishes: dish.name, dishIds: [dish.id],
              time: pl[2] || null, cook: null
            });
          }
          UI.closeModal();
          UI.toast('已套用模板');
          App.render();
        });
      });
      modal.querySelectorAll('[data-edit-tpl]').forEach(function(b) {
        b.addEventListener('click', function() {
          openTemplateForm(templates.find(function(t) { return t.id === +b.getAttribute('data-edit-tpl'); }));
        });
      });
      modal.querySelectorAll('[data-del-tpl]').forEach(function(b) {
        b.addEventListener('click', async function() {
          await DB.del('meal_templates', +b.getAttribute('data-del-tpl'));
          UI.closeModal();
          UI.toast('已删除模板');
          App.render();
        });
      });
    });
  }

  // 模板表单：模板名 + 描述 + 多行"餐次 菜名 时间"
  function openTemplateForm(tpl) {
    DB.getAll('dishes').then(function(dishes) {
      const lines = (tpl && tpl.plans || []).map(function(pl) { return pl.join(' '); }).join('\n');
      UI.openModal(
        '<h3>' + (tpl ? '编辑模板' : '新建模板') + '</h3>' +
        '<div class="field"><label>模板名称</label><input id="t-name" value="' + UI.esc(tpl ? tpl.name : '') + '" placeholder="如：周末大餐"></div>' +
        '<div class="field"><label>描述</label><input id="t-desc" value="' + UI.esc(tpl ? tpl.desc : '') + '" placeholder="如：六日 · 丰盛一点"></div>' +
        '<div class="field"><label>餐单（每行一项，格式：餐次 菜名 时间）</label><textarea id="t-plans" rows="5" placeholder="晚餐 红烧排骨 18:30">' + UI.esc(lines) + '</textarea></div>' +
        '<p style="font-size:12px;color:var(--sub);">餐次：早餐 / 午餐 / 晚餐；时间如 18:30，可留空。菜名需与菜谱库一致。</p>' +
        '<div class="foot"><button class="btn ghost" data-x="1">取消</button><button class="btn" data-save="1">保存</button></div>'
      );
      const modal = document.querySelector('.modal');
      modal.querySelector('[data-x]').addEventListener('click', function() { UI.closeModal(); });
      modal.querySelector('[data-save]').addEventListener('click', async function() {
        const name = document.getElementById('t-name').value.trim();
        if (!name) { UI.toast('请填写模板名称'); return; }
        const desc = document.getElementById('t-desc').value.trim();
        const plans = (document.getElementById('t-plans').value || '').split('\n').map(function(l) { return l.trim(); }).filter(Boolean).map(function(l) {
          const parts = l.split(/\s+/);
          return [parts[0] || '晚餐', parts[1] || '', parts[2] || ''];
        });
        if (!plans.length) { UI.toast('请至少填写一行餐单'); return; }
        const obj = { name: name, desc: desc, plans: plans };
        if (tpl) obj.id = tpl.id;
        await DB.put('meal_templates', obj);
        UI.closeModal();
        UI.toast('已保存模板');
        App.render();
      });
    });
  }

  function showDishDetail(id) {
    DB.get('dishes', id).then(function(d) {
      if (!d) return;
      let html = '<h3>' + UI.esc(d.name) + '（' + d.time + 'min）</h3>';
      if (d.ai) {
        html += '<div style="background:var(--green-bg);border-radius:10px;padding:10px 12px;font-size:12.5px;margin-bottom:12px;">✨ AI 菜品图接口预留 · 正式版可一键生成</div>';
      }
      html += '<div style="font-size:13px;font-weight:600;margin-bottom:6px;">食材</div>';
      (d.ing||[]).forEach(function(p){ html += '<div class="kv"><span class="k">' + UI.esc(p[0]) + '</span><span class="v">' + UI.esc(p[1]) + '</span></div>'; });
      html += '<div style="font-size:13px;font-weight:600;margin:10px 0 6px;">调料</div>';
      (d.sea||[]).forEach(function(p){ html += '<div class="kv"><span class="k">' + UI.esc(p[0]) + '</span><span class="v">' + UI.esc(p[1]) + '</span></div>'; });
      html += '<div class="foot"><button class="btn" data-x="1">关闭</button></div>';
      UI.openModal(html);
      document.querySelector('.modal [data-x]').addEventListener('click', function() { UI.closeModal(); });
    });
  }

  // 将今日点餐的食材清单并入库存购物清单（写入 shopping_items，库存页可查看/勾选）
  async function toShoppingList() {
    const today = UI.todayStr();
    const plans = await DB.getAll('meal_plans');
    const dishes = await DB.getAll('dishes');
    const todayPlans = plans.filter(function(p) { return p.date === today; });
    const planDishes = [];
    todayPlans.forEach(function(p) {
      p.dishIds = p.dishIds || [];
      p.dishIds.forEach(function(did) {
        const d = dishes.find(function(x) { return x.id == did; });
        if (d) planDishes.push(d);
      });
    });
    if (!planDishes.length) { UI.toast('今天还没点餐，先点餐再并入'); return; }
    const merged = mergeIngredients(planDishes);
    // 写入购物清单（同名去重，合并数量）；常备调料不并入
    const existing = await DB.getAll('shopping_items');
    const nameMap = {};
    existing.forEach(function(s) { nameMap[s.name] = s; });
    let count = 0;
    for (const it of merged.ing) {
      if (STAPLE_SEASONINGS.indexOf(it.name) >= 0) continue;
      if (nameMap[it.name]) {
        nameMap[it.name].qty = Array.from(new Set(nameMap[it.name].qty.concat(it.qty)));
        await DB.put('shopping_items', nameMap[it.name]);
      } else {
        await DB.add('shopping_items', { name: it.name, qty: it.qty, src: '点餐', date: today, done: false });
      }
      count++;
    }
    UI.toast('已并入购物清单（' + count + ' 项食材），可在库存页查看');
    App.render();
  }

  async function onAction(e) {
    const t = e.target;
    const np = t.getAttribute('data-new-plan');
    const tm = t.getAttribute('data-template');
    const pk = t.getAttribute('data-pick');
    const see = t.getAttribute('data-see');
    const dp = t.getAttribute('data-del-plan');
    const ts = t.getAttribute('data-to-shop');
    const nd = t.getAttribute('data-new-dish');
    const ed = t.getAttribute('data-edit-dish');
    const dd = t.getAttribute('data-del-dish');
    if (np) openPlanForm();
    else if (tm) showTemplates();
    else if (pk) showDishDetail(+pk);
    else if (see) showDishDetail(+see);
    else if (nd) openDishForm(null);
    else if (ed) openDishForm(await DB.get('dishes', +ed));
    else if (dd) {
      const id = +dd;
      UI.openModal('<h3>删除菜谱</h3><p style="color:var(--sub);font-size:14px;margin-bottom:8px;">确定删除这道菜谱吗？历史餐单记录不受影响。</p><div class="foot"><button class="btn ghost" data-x="1">取消</button><button class="btn" data-ok="1" style="background:var(--red);">删除</button></div>');
      const modal = document.querySelector('.modal');
      modal.querySelector('[data-x]').addEventListener('click', function() { UI.closeModal(); });
      modal.querySelector('[data-ok]').addEventListener('click', async function() {
        await DB.del('dishes', id);
        UI.closeModal();
        UI.toast('已删除菜谱');
        App.render();
      });
    }
    else if (dp) {
      await DB.del('meal_plans', +dp);
      UI.toast('已删除');
      App.render();
    } else if (ts) toShoppingList();
  }

  function bind(root) {
    root.addEventListener('click', onAction);
  }

  return { body: body, bind: bind };
})();
