/* 家庭管理系统 - 页面：财务（预算 + 记账 + 可视化 + 密码锁）
   数据：budgets（年度预算）、transactions（收支流水），均云端同步。
   可视化：纯 CSS/SVG，离线可用，不依赖外部图表库。
*/
const FinancePage = (function() {
  const DEFAULT_INCOME = [
    { name: '工资', monthly: 10000 },
    { name: '奖金', monthly: 0 },
    { name: '其他收入', monthly: 0 }
  ];
  const DEFAULT_EXPENSE = [
    { name: '餐饮', monthly: 2000 },
    { name: '日用品', monthly: 500 },
    { name: '交通', monthly: 500 },
    { name: '水电燃气', monthly: 300 },
    { name: '教育', monthly: 500 },
    { name: '医疗', monthly: 300 },
    { name: '娱乐', monthly: 500 },
    { name: '其他支出', monthly: 500 }
  ];
  const CAT_COLORS = ['#3FA98C','#E8A33D','#8A93D8','#E87B7B','#6BC5D2','#B89B6E','#D88AC4','#9BC96E','#D8B08A','#7A8AD8'];

  let curMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  let curTab = 'list'; // list | budget | chart

  // ===== 预算 =====
  async function ensureBudget(year) {
    const all = await DB.getAll('budgets');
    let b = all.find(function(x) { return x.year == year; });
    if (!b) {
      const id = await DB.add('budgets', {
        year: year,
        income_cats: JSON.parse(JSON.stringify(DEFAULT_INCOME)),
        expense_cats: JSON.parse(JSON.stringify(DEFAULT_EXPENSE))
      });
      b = await DB.get('budgets', id);
    }
    return b;
  }

  // 获取某分类某月的预算金额（兼容旧数据：数字→12个月数组）
  function getMonthAmt(cat, monthIdx) {
    if (!cat) return 0;
    if (Array.isArray(cat.monthly)) {
      return +cat.monthly[monthIdx] || 0;
    }
    // 旧数据：monthly 是数字，所有月份相同
    return +cat.monthly || 0;
  }

  // 设置某分类某月的预算金额（自动转换为数组）
  function setMonthAmt(cat, monthIdx, val) {
    if (!Array.isArray(cat.monthly)) {
      const old = +cat.monthly || 0;
      cat.monthly = [];
      for (let i = 0; i < 12; i++) cat.monthly.push(old);
    }
    cat.monthly[monthIdx] = +val || 0;
  }

  function catMonthly(budget, type, name, monthIdx) {
    const arr = type === 'income' ? budget.income_cats : budget.expense_cats;
    const c = arr.find(function(x) { return x.name === name; });
    return c ? getMonthAmt(c, monthIdx != null ? monthIdx : new Date().getMonth()) : 0;
  }

  // ===== 统计 =====
  async function monthStats(month) {
    const txs = await DB.getAll('transactions');
    const list = txs.filter(function(t) { return (t.date || '').slice(0, 7) === month; });
    let income = 0, expense = 0;
    const byCat = {};
    list.forEach(function(t) {
      const amt = +t.amount || 0;
      if (t.type === 'income') income += amt;
      else { expense += amt; byCat[t.cat] = (byCat[t.cat] || 0) + amt; }
    });
    return { list: list, income: income, expense: expense, byCat: byCat, balance: income - expense };
  }

  function fmt(n) {
    return '¥' + Number(n || 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
  }

  // ===== 页面主体 =====
  async function body() {
    // 密码锁检查
    const enabled = await DB.getSetting('finance_enabled');
    if (!enabled) {
      return '<div class="card" style="text-align:center;padding:40px 20px;">' +
        '<div style="font-size:40px;margin-bottom:12px;">🔒</div>' +
        '<div style="font-size:16px;font-weight:600;margin-bottom:8px;">财务功能未启用</div>' +
        '<div style="color:var(--sub);font-size:13px;margin-bottom:16px;">请在「设置 → 财务功能」中开启并设置密码</div>' +
        '<a href="#/mine" class="btn">去设置</a></div>';
    }
    // 会话级解锁
    if (!sessionStorage.getItem('finance_unlocked')) {
      return unlockHtml();
    }

    const year = curMonth.slice(0, 4);
    const budget = await ensureBudget(year);
    const st = await monthStats(curMonth);

    // 月度预算总额（按当前月份）
    const monthIdx = +curMonth.slice(5, 7) - 1;
    const budgetIncome = budget.income_cats.reduce(function(s, c) { return s + getMonthAmt(c, monthIdx); }, 0);
    const budgetExpense = budget.expense_cats.reduce(function(s, c) { return s + getMonthAmt(c, monthIdx); }, 0);

    let html = '';
    // 月份选择 + 概览
    html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap;">' +
      '<button class="btn sm ghost" data-month-prev="1">‹</button>' +
      '<span style="font-size:16px;font-weight:600;min-width:90px;text-align:center;">' + curMonth + '</span>' +
      '<button class="btn sm ghost" data-month-next="1">›</button>' +
      '<button class="btn sm" data-add-tx="1" style="margin-left:auto;">+ 记一笔</button>' +
      '<button class="btn sm ghost" data-report="1" style="margin-left:6px;">📄 月报</button>' +
      '</div>';

    // 概览卡片
    html += '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;">' +
      ovCard('收入', st.income, budgetIncome, '#3FA98C') +
      ovCard('支出', st.expense, budgetExpense, '#E87B7B') +
      ovCard('结余', st.balance, budgetIncome - budgetExpense, st.balance >= 0 ? '#3FA98C' : '#E87B7B') +
      '</div>';

    // Tab
    html += '<div style="display:flex;gap:6px;margin-bottom:14px;border-bottom:1px solid var(--border);padding-bottom:0;">' +
      tabBtn('list', '📋 流水') + tabBtn('budget', '💰 预算') + tabBtn('chart', '📊 图表') +
      '</div>';

    if (curTab === 'list') html += await listHtml(st, budget);
    else if (curTab === 'budget') html += budgetHtml(budget);
    else html += chartHtml(st, budget, budgetExpense);

    return html;
  }

  function ovCard(label, val, budget, color) {
    const pct = budget > 0 ? Math.min(100, Math.round(val / budget * 100)) : 0;
    return '<div style="flex:1 1 100px;min-width:0;background:#fff;border-radius:12px;padding:12px;border:1px solid var(--border);">' +
      '<div style="font-size:12px;color:var(--sub);">' + label + '</div>' +
      '<div style="font-size:18px;font-weight:700;color:' + color + ';margin-top:2px;">' + fmt(val) + '</div>' +
      '<div style="font-size:11px;color:var(--sub);margin-top:2px;">预算 ' + fmt(budget) + ' · ' + pct + '%</div>' +
      '</div>';
  }

  function tabBtn(id, label) {
    return '<button class="btn sm ' + (curTab === id ? '' : 'ghost') + '" data-tab="' + id + '" style="border-radius:8px 8px 0 0;border-bottom:none;">' + label + '</button>';
  }

  // ===== 流水列表 =====
  async function listHtml(st, budget) {
    if (!st.list.length) {
      return '<div class="card"><div class="empty"><span class="e">💸</span>本月还没有记录，点右上角「记一笔」开始</div></div>';
    }
    const sorted = st.list.slice().sort(function(a, b) { return (b.date || '').localeCompare(a.date || '') || (b.created || 0) - (a.created || 0); });
    let html = '<div class="card" style="padding:0;">';
    sorted.forEach(function(t, i) {
      const isIn = t.type === 'income';
      html += '<div class="kv" style="padding:10px 14px;' + (i < sorted.length - 1 ? 'border-bottom:1px solid var(--border);' : '') + '">' +
        '<span class="k">' +
          '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + (isIn ? '#3FA98C' : '#E87B7B') + ';margin-right:8px;"></span>' +
          '<span style="font-weight:500;">' + UI.esc(t.cat || '未分类') + '</span>' +
          (t.note ? '<span style="color:var(--sub);font-size:12px;margin-left:8px;">' + UI.esc(t.note) + '</span>' : '') +
          '<span style="color:var(--sub);font-size:11px;margin-left:8px;">' + (t.date || '') + '</span>' +
        '</span>' +
        '<span class="v" style="font-weight:600;color:' + (isIn ? '#3FA98C' : '#E87B7B') + ';">' +
          (isIn ? '+' : '-') + fmt(t.amount) +
          '<button class="btn sm ghost" data-del-tx="' + t.id + '" style="margin-left:8px;">删</button>' +
        '</span></div>';
    });
    html += '</div>';
    return html;
  }

  // ===== 预算设置 =====
  function budgetHtml(budget) {
    const monthIdx = +curMonth.slice(5, 7) - 1;
    let html = '';
    html += '<div class="section-title">收入分类（月度预测）</div>';
    html += catListHtml(budget.income_cats, 'income', monthIdx);
    html += '<div style="margin-top:12px;"><button class="btn sm ghost" data-add-cat="income">+ 添加收入分类</button></div>';

    html += '<div class="section-title" style="margin-top:18px;">支出分类（月度预算）</div>';
    html += catListHtml(budget.expense_cats, 'expense', monthIdx);
    html += '<div style="margin-top:12px;"><button class="btn sm ghost" data-add-cat="expense">+ 添加支出分类</button></div>';
    html += '<div style="margin-top:14px;font-size:12px;color:var(--sub);">点「📅月度」可设置每个月不同金额（如春节月餐饮预算更高）。修改后自动保存。</div>';
    return html;
  }

  function catListHtml(cats, type, monthIdx) {
    let html = '<div class="card" style="padding:0;">';
    cats.forEach(function(c, i) {
      const curAmt = getMonthAmt(c, monthIdx);
      html += '<div class="kv" style="padding:10px 14px;' + (i < cats.length - 1 ? 'border-bottom:1px solid var(--border);' : '') + '">' +
        '<span class="k" style="font-weight:600;">' + UI.esc(c.name) + '</span>' +
        '<span class="v">' +
          '<input type="number" class="input" data-cat-amt="' + type + '|' + i + '" value="' + curAmt + '" style="width:80px;text-align:right;margin-right:6px;" title="当月金额">' +
          '<button class="btn sm ghost" data-cat-monthly="' + type + '|' + i + '" title="设置各月不同金额">📅月度</button>' +
          '<button class="btn sm ghost" data-cat-edit="' + type + '|' + i + '">改名</button>' +
          '<button class="btn sm ghost" data-cat-del="' + type + '|' + i + '" style="color:var(--red);">删</button>' +
        '</span></div>';
    });
    html += '</div>';
    return html;
  }

  // 月度预算设置弹窗
  function openMonthlyBudget(type, idx) {
    const year = curMonth.slice(0, 4);
    DB.getAll('budgets').then(function(all) {
      const budget = all.find(function(x) { return x.year == year; });
      if (!budget) return;
      const arr = type === 'income' ? budget.income_cats : budget.expense_cats;
      const cat = arr[idx];
      if (!cat) return;
      const monthNames = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
      let inputs = '';
      for (let m = 0; m < 12; m++) {
        inputs += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">' +
          '<span style="width:36px;font-size:12px;font-weight:600;color:var(--sub);">' + monthNames[m] + '</span>' +
          '<input type="number" class="input monthly-input" data-m="' + m + '" value="' + getMonthAmt(cat, m) + '" style="flex:1;text-align:right;">' +
        '</div>';
      }
      UI.openModal(
        '<h3>📅 ' + cat.name + ' - 各月预算</h3>' +
        '<div style="display:flex;gap:8px;margin-bottom:10px;">' +
          '<input type="number" id="batch-amt" class="input" placeholder="批量设置金额" style="flex:1;">' +
          '<button class="btn sm" id="batch-apply">应用到全年</button>' +
        '</div>' +
        '<div style="max-height:320px;overflow-y:auto;">' + inputs + '</div>' +
        '<div class="foot"><button class="btn ghost" data-x="1">取消</button><button class="btn" data-save-monthly="1">保存</button></div>'
      );
      const modal = document.querySelector('.modal');
      modal.querySelector('[data-x]').addEventListener('click', function() { UI.closeModal(); });
      modal.querySelector('#batch-apply').addEventListener('click', function() {
        const val = document.getElementById('batch-amt').value;
        if (val) {
          modal.querySelectorAll('.monthly-input').forEach(function(inp) { inp.value = val; });
        }
      });
      modal.querySelector('[data-save-monthly]').addEventListener('click', async function() {
        modal.querySelectorAll('.monthly-input').forEach(function(inp) {
          const m = +inp.getAttribute('data-m');
          setMonthAmt(cat, m, inp.value);
        });
        await DB.put('budgets', budget);
        UI.closeModal();
        UI.toast('月度预算已保存');
        App.render();
      });
    });
  }

  // ===== 图表 =====
  function chartHtml(st, budget, budgetExpense) {
    const monthIdx = +curMonth.slice(5, 7) - 1;
    let html = '';
    // 支出分类进度条
    html += '<div class="section-title">本月支出预算进度</div>';
    html += '<div class="card">';
    budget.expense_cats.forEach(function(c, i) {
      const used = st.byCat[c.name] || 0;
      const limit = getMonthAmt(c, monthIdx);
      const pct = limit > 0 ? Math.min(100, Math.round(used / limit * 100)) : 0;
      const color = pct >= 100 ? '#E87B7B' : (pct >= 80 ? '#E8A33D' : CAT_COLORS[i % CAT_COLORS.length]);
      html += '<div style="margin-bottom:10px;">' +
        '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">' +
          '<span>' + UI.esc(c.name) + '</span>' +
          '<span style="color:var(--sub);">' + fmt(used) + ' / ' + fmt(limit) + ' (' + pct + '%)</span>' +
        '</div>' +
        '<div style="height:8px;background:#f0f0f0;border-radius:4px;overflow:hidden;">' +
          '<div style="height:100%;width:' + pct + '%;background:' + color + ';border-radius:4px;transition:width .3s;"></div>' +
        '</div></div>';
    });
    html += '</div>';

    // 支出分类占比环形图
    if (st.expense > 0) {
      html += '<div class="section-title" style="margin-top:18px;">支出分类占比</div>';
      html += '<div class="card" style="display:flex;gap:20px;align-items:center;flex-wrap:wrap;">';
      // conic-gradient 环形
      let grad = 'conic-gradient(';
      let acc = 0;
      const entries = Object.entries(st.byCat).sort(function(a, b) { return b[1] - a[1]; });
      entries.forEach(function(e, i) {
        const pct = e[1] / st.expense;
        const start = acc * 100;
        acc += pct;
        const end = acc * 100;
        grad += CAT_COLORS[i % CAT_COLORS.length] + ' ' + start + '% ' + end + '%';
        if (i < entries.length - 1) grad += ', ';
      });
      grad += ')';
      html += '<div style="width:140px;height:140px;border-radius:50%;background:' + grad + ';position:relative;flex-shrink:0;">' +
        '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:90px;height:90px;background:#fff;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;">' +
        '<div style="font-size:11px;color:var(--sub);">总支出</div>' +
        '<div style="font-size:14px;font-weight:700;color:#E87B7B;">' + fmt(st.expense) + '</div>' +
        '</div></div>';
      // 图例
      html += '<div style="flex:1;min-width:120px;">';
      entries.forEach(function(e, i) {
        const pct = Math.round(e[1] / st.expense * 100);
        html += '<div style="display:flex;align-items:center;font-size:12px;margin-bottom:6px;">' +
          '<span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:' + CAT_COLORS[i % CAT_COLORS.length] + ';margin-right:6px;"></span>' +
          '<span style="flex:1;">' + UI.esc(e[0]) + '</span>' +
          '<span style="color:var(--sub);">' + fmt(e[1]) + ' · ' + pct + '%</span></div>';
      });
      html += '</div></div>';
    }

    // 近 6 个月收支趋势（SVG 柱状，异步填充）
    html += '<div class="section-title" style="margin-top:18px;">近 6 个月收支趋势</div>';
    html += '<div id="trend-chart" class="card" style="min-height:160px;">加载中…</div>';
    return html;
  }

  // ===== 密码锁 =====
  function unlockHtml() {
    return '<div class="card" style="text-align:center;padding:40px 20px;max-width:360px;margin:0 auto;">' +
      '<div style="font-size:40px;margin-bottom:12px;">🔐</div>' +
      '<div style="font-size:16px;font-weight:600;margin-bottom:14px;">请输入财务密码</div>' +
      '<input type="password" id="fin-pwd" class="input" placeholder="密码" style="width:100%;margin-bottom:12px;text-align:center;">' +
      '<button class="btn block" data-unlock="1">解锁</button>' +
      '<div style="font-size:11px;color:var(--sub);margin-top:10px;">忘记密码可在设置页重置</div></div>';
  }

  function simpleHash(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; }
    return 'h' + h;
  }

  // ===== 记账模态框 =====
  async function openTxForm(editTx) {
    const year = curMonth.slice(0, 4);
    const budget = await ensureBudget(year);
    const members = await DB.getAll('members');
    const expCats = budget.expense_cats.map(function(c) { return c.name; });
    const incCats = budget.income_cats.map(function(c) { return c.name; });

    const type = editTx ? editTx.type : 'expense';
    const cats = type === 'income' ? incCats : expCats;

    let html = '<h3>' + (editTx ? '编辑记录' : '记一笔') + '</h3>';
    html += '<div style="display:flex;gap:8px;margin-bottom:12px;">' +
      '<button class="btn sm ' + (type === 'expense' ? '' : 'ghost') + '" data-tx-type="expense" style="flex:1;">支出</button>' +
      '<button class="btn sm ' + (type === 'income' ? '' : 'ghost') + '" data-tx-type="income" style="flex:1;">收入</button>' +
      '</div>';
    html += '<div style="margin-bottom:10px;"><label style="font-size:12px;color:var(--sub);">金额</label>' +
      '<input type="number" id="tx-amount" class="input" value="' + (editTx ? editTx.amount : '') + '" placeholder="0.00" style="width:100%;font-size:18px;font-weight:600;"></div>';
    html += '<div style="margin-bottom:10px;"><label style="font-size:12px;color:var(--sub);">分类</label>' +
      '<select id="tx-cat" class="input" style="width:100%;">' +
      cats.map(function(c) { return '<option' + (editTx && editTx.cat === c ? ' selected' : '') + '>' + c + '</option>'; }).join('') +
      '</select></div>';
    html += '<div style="margin-bottom:10px;"><label style="font-size:12px;color:var(--sub);">日期</label>' +
      '<input type="date" id="tx-date" class="input" value="' + (editTx ? editTx.date : UI.todayStr()) + '" style="width:100%;"></div>';
    html += '<div style="margin-bottom:10px;"><label style="font-size:12px;color:var(--sub);">用途/备注（可选）</label>' +
      '<input type="text" id="tx-note" class="input" value="' + (editTx ? UI.esc(editTx.note || '') : '') + '" placeholder="如：超市买菜" style="width:100%;"></div>';
    if (members.length) {
      html += '<div style="margin-bottom:12px;"><label style="font-size:12px;color:var(--sub);">记账人</label>' +
        '<select id="tx-member" class="input" style="width:100%;">' +
        '<option value="">不指定</option>' +
        members.map(function(m) { return '<option value="' + m.id + '"' + (editTx && editTx.member == m.id ? ' selected' : '') + '>' + UI.esc(m.name) + '</option>'; }).join('') +
        '</select></div>';
    }
    html += '<div class="foot"><button class="btn ghost" data-x="1">取消</button><button class="btn" data-tx-save="1">保存</button></div>';

    UI.openModal(html);
    const modal = document.querySelector('.modal');
    modal.querySelector('[data-x]').addEventListener('click', function() { UI.closeModal(); });
    // 类型切换
    modal.querySelectorAll('[data-tx-type]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        const newType = this.getAttribute('data-tx-type');
        const newCats = newType === 'income' ? incCats : expCats;
        const sel = document.getElementById('tx-cat');
        sel.innerHTML = newCats.map(function(c) { return '<option>' + c + '</option>'; }).join('');
        modal.querySelectorAll('[data-tx-type]').forEach(function(b) {
          b.classList.toggle('ghost', b.getAttribute('data-tx-type') !== newType);
        });
        modal.setAttribute('data-cur-type', newType);
      });
    });
    modal.setAttribute('data-cur-type', type);
    if (editTx) modal.setAttribute('data-edit-id', editTx.id);

    modal.querySelector('[data-tx-save]').addEventListener('click', async function() {
      const amt = parseFloat(document.getElementById('tx-amount').value);
      if (!amt || amt <= 0) { UI.toast('请输入有效金额'); return; }
      const curType = modal.getAttribute('data-cur-type') || 'expense';
      const obj = {
        type: curType,
        amount: amt,
        cat: document.getElementById('tx-cat').value,
        date: document.getElementById('tx-date').value || UI.todayStr(),
        note: document.getElementById('tx-note').value.trim(),
        member: document.getElementById('tx-member') ? document.getElementById('tx-member').value : ''
      };
      const editId = modal.getAttribute('data-edit-id');
      if (editId) {
        const old = await DB.get('transactions', +editId);
        Object.assign(old, obj);
        await DB.put('transactions', old);
        UI.toast('已更新');
      } else {
        await DB.add('transactions', obj);
        UI.toast('已记账');
      }
      UI.closeModal();
      App.render();
    });
  }

  // ===== 绑定 =====
  function bind(root) {
    root.addEventListener('click', async function(e) {
      const t = e.target;
      if (t.getAttribute('data-month-prev')) {
        const d = new Date(curMonth + '-01'); d.setMonth(d.getMonth() - 1);
        curMonth = d.toISOString().slice(0, 7); App.render();
      } else if (t.getAttribute('data-month-next')) {
        const d = new Date(curMonth + '-01'); d.setMonth(d.getMonth() + 1);
        curMonth = d.toISOString().slice(0, 7); App.render();
      } else if (t.getAttribute('data-tab')) {
        curTab = t.getAttribute('data-tab'); App.render();
      } else if (t.getAttribute('data-add-tx')) {
        openTxForm(null);
      } else if (t.getAttribute('data-del-tx')) {
        const id = +t.getAttribute('data-del-tx');
        if (confirm('确定删除这条记录吗？')) {
          await DB.del('transactions', id);
          UI.toast('已删除'); App.render();
        }
      } else if (t.getAttribute('data-unlock')) {
        const pwd = document.getElementById('fin-pwd').value;
        const saved = await DB.getSetting('finance_pwd');
        if (saved && simpleHash(pwd) === saved) {
          sessionStorage.setItem('finance_unlocked', '1');
          App.render();
        } else {
          UI.toast('密码错误');
        }
      } else if (t.getAttribute('data-report')) {
        const st = await monthStats(curMonth);
        const year = curMonth.slice(0, 4);
        const budget = await ensureBudget(year);
        let report = '===== 家庭财务月报 ' + curMonth + ' =====\n\n';
        report += '收入：' + fmt(st.income) + '\n';
        report += '支出：' + fmt(st.expense) + '\n';
        report += '结余：' + fmt(st.balance) + '\n\n';
        report += '--- 支出分类明细 ---\n';
        budget.expense_cats.forEach(function(c) {
          const used = st.byCat[c.name] || 0;
          report += c.name + '：' + fmt(used) + ' / 预算 ' + fmt(c.monthly) + ' (' + (c.monthly > 0 ? Math.round(used/c.monthly*100) : 0) + '%)\n';
        });
        report += '\n--- 收入分类 ---\n';
        const incByCat = {};
        st.list.forEach(function(t) { if (t.type==='income') incByCat[t.cat]=(incByCat[t.cat]||0)+(+t.amount||0); });
        Object.keys(incByCat).forEach(function(k) { report += k + '：' + fmt(incByCat[k]) + '\n'; });
        report += '\n--- 逐笔记录 ---\n';
        st.list.slice().sort(function(a,b){return (a.date||'').localeCompare(b.date||'');}).forEach(function(t) {
          report += t.date + ' ' + (t.type==='income'?'+':'-') + fmt(t.amount) + ' ' + t.cat + (t.note?' ('+t.note+')':'') + '\n';
        });
        const blob = new Blob([report], {type:'text/plain;charset=utf-8'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = '财务月报-' + curMonth + '.txt';
        a.click();
        URL.revokeObjectURL(a.href);
        UI.toast('月报已导出');
      } else if (t.getAttribute('data-add-cat')) {
        const type = t.getAttribute('data-add-cat');
        const name = prompt('分类名称：');
        if (!name) return;
        const year = curMonth.slice(0, 4);
        const budget = await ensureBudget(year);
        const arr = type === 'income' ? budget.income_cats : budget.expense_cats;
        if (arr.find(function(c) { return c.name === name; })) { UI.toast('分类已存在'); return; }
        arr.push({ name: name, monthly: 0 });
        await DB.put('budgets', budget);
        UI.toast('已添加'); App.render();
      } else if (t.getAttribute('data-cat-edit')) {
        const parts = t.getAttribute('data-cat-edit').split('|');
        const type = parts[0], idx = +parts[1];
        const year = curMonth.slice(0, 4);
        const budget = await ensureBudget(year);
        const arr = type === 'income' ? budget.income_cats : budget.expense_cats;
        const name = prompt('新名称：', arr[idx].name);
        if (!name) return;
        arr[idx].name = name;
        await DB.put('budgets', budget);
        UI.toast('已改名'); App.render();
      } else if (t.getAttribute('data-cat-del')) {
        const parts = t.getAttribute('data-cat-del').split('|');
        const type = parts[0], idx = +parts[1];
        if (!confirm('确定删除该分类？已有记录不受影响。')) return;
        const year = curMonth.slice(0, 4);
        const budget = await ensureBudget(year);
        const arr = type === 'income' ? budget.income_cats : budget.expense_cats;
        arr.splice(idx, 1);
        await DB.put('budgets', budget);
        UI.toast('已删除'); App.render();
      } else if (t.getAttribute('data-cat-monthly')) {
        const parts = t.getAttribute('data-cat-monthly').split('|');
        openMonthlyBudget(parts[0], +parts[1]);
      }
    });

    // 分类金额输入自动保存（设置当前月金额）
    root.addEventListener('change', async function(e) {
      const t = e.target;
      const attr = t.getAttribute('data-cat-amt');
      if (attr) {
        const parts = attr.split('|');
        const type = parts[0], idx = +parts[1];
        const year = curMonth.slice(0, 4);
        const monthIdx = +curMonth.slice(5, 7) - 1;
        const budget = await ensureBudget(year);
        const arr = type === 'income' ? budget.income_cats : budget.expense_cats;
        setMonthAmt(arr[idx], monthIdx, t.value);
        await DB.put('budgets', budget);
        UI.toast('当月预算已保存');
      }
    });

    // 图表 Tab 渲染后加载趋势图
    if (curTab === 'chart') {
      setTimeout(renderTrendChart, 50);
    }
  }

  // 近 6 个月趋势（SVG 柱状图）
  async function renderTrendChart() {
    const el = document.getElementById('trend-chart');
    if (!el) return;
    const txs = await DB.getAll('transactions');
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(d.toISOString().slice(0, 7));
    }
    const data = months.map(function(m) {
      let inc = 0, exp = 0;
      txs.forEach(function(t) {
        if ((t.date || '').slice(0, 7) === m) {
          if (t.type === 'income') inc += +t.amount || 0;
          else exp += +t.amount || 0;
        }
      });
      return { m: m, inc: inc, exp: exp };
    });
    const maxVal = Math.max(1, ...data.map(function(d) { return Math.max(d.inc, d.exp); }));
    const W = 320, H = 140, pad = 24, bw = 14, gap = (W - pad * 2 - bw * 2 * 6) / 6;
    let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;">';
    data.forEach(function(d, i) {
      const x = pad + i * (bw * 2 + gap);
      const hInc = (d.inc / maxVal) * (H - pad * 2);
      const hExp = (d.exp / maxVal) * (H - pad * 2);
      svg += '<rect x="' + x + '" y="' + (H - pad - hInc) + '" width="' + bw + '" height="' + hInc + '" fill="#3FA98C" rx="2"/>';
      svg += '<rect x="' + (x + bw + 2) + '" y="' + (H - pad - hExp) + '" width="' + bw + '" height="' + hExp + '" fill="#E87B7B" rx="2"/>';
      svg += '<text x="' + (x + bw) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="9" fill="#999">' + d.m.slice(5) + '月</text>';
    });
    svg += '</svg>';
    svg += '<div style="display:flex;gap:16px;justify-content:center;font-size:11px;color:var(--sub);margin-top:6px;">' +
      '<span><span style="display:inline-block;width:10px;height:10px;background:#3FA98C;border-radius:2px;margin-right:4px;"></span>收入</span>' +
      '<span><span style="display:inline-block;width:10px;height:10px;background:#E87B7B;border-radius:2px;margin-right:4px;"></span>支出</span></div>';
    el.innerHTML = svg;
  }

  return { body: body, bind: bind, simpleHash: simpleHash, ensureBudget: ensureBudget };
})();
