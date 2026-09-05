/* 家庭管理系统 - 页面：我的 / 设置（支持自定义角色） */
const MinePage = (function() {
  // 内置角色
  const BUILTIN_ROLES = ['爸爸','妈妈','孩子','老人','其他'];

  // 读取全部角色（内置 + 自定义），返回 [{name, builtin}]
  async function loadRoles() {
    const custom = (await DB.getSetting('custom_roles')) || [];
    const builtins = BUILTIN_ROLES.map(function(r) { return { name: r, builtin: true }; });
    const customs = custom.map(function(r) { return { name: r, builtin: false }; });
    return builtins.concat(customs);
  }

  // 角色管理弹窗：新增 / 删除自定义角色
  async function openRoleManager() {
    const roles = await loadRoles();
    const customs = roles.filter(function(r) { return !r.builtin; });
    let html = '<h3>🏷️ 自定义角色</h3>';
    html += '<p style="font-size:12.5px;color:var(--sub);margin-bottom:10px;">除内置角色外，可为家人添加自定义角色（如：儿媳、女婿、闺蜜）。删除自定义角色不影响已使用该角色的成员显示。</p>';
    if (customs.length) {
      html += '<div style="margin-bottom:10px;">';
      customs.forEach(function(r) {
        html += '<div class="kv"><span class="k">' + UI.esc(r.name) + '</span>' +
          '<span class="v"><button class="btn sm ghost" data-del-role="' + UI.esc(r.name) + '">删除</button></span></div>';
      });
      html += '</div>';
    } else {
      html += '<div class="card" style="margin-bottom:10px;"><div class="empty">暂无自定义角色</div></div>';
    }
    html += '<div class="field"><label>新增角色</label><input id="r-name" placeholder="如：儿媳"></div>' +
      '<div class="foot"><button class="btn ghost" data-x="1">关闭</button><button class="btn" data-add-role="1">添加</button></div>';
    UI.openModal(html);
    const modal = document.querySelector('.modal');
    modal.querySelector('[data-x]').addEventListener('click', function() { UI.closeModal(); });
    modal.querySelector('[data-add-role]').addEventListener('click', async function() {
      const name = document.getElementById('r-name').value.trim();
      if (!name) { UI.toast('请输入角色名称'); return; }
      let custom = (await DB.getSetting('custom_roles')) || [];
      if (custom.indexOf(name) >= 0 || BUILTIN_ROLES.indexOf(name) >= 0) {
        UI.toast('该角色已存在');
        return;
      }
      custom.push(name);
      await DB.setSetting('custom_roles', custom);
      UI.closeModal();
      UI.toast('已添加角色');
      App.render();
    });
    modal.querySelectorAll('[data-del-role]').forEach(function(b) {
      b.addEventListener('click', async function() {
        const name = b.getAttribute('data-del-role');
        let custom = (await DB.getSetting('custom_roles')) || [];
        custom = custom.filter(function(r) { return r !== name; });
        await DB.setSetting('custom_roles', custom);
        UI.closeModal();
        UI.toast('已删除角色');
        App.render();
      });
    });
  }

  // 格式化上次同步时间
  function fmtSyncTime(last) {
    if (!last || !last.at) return '—';
    const diff = Date.now() - last.at;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
    const d = new Date(last.at);
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  async function body() {
    const members = await DB.getAll('members');
    const me = await DB.getSetting('me');
    const syncStatus = await DB.getSyncStatus();
    const city = (await DB.getSetting('city')) || Weather.DEFAULT_CITY;
    const familyName = await DB.getFamilyName();

    let html = '';

    // 家庭信息（名称可改，云端同步全家一致）
    html += '<div class="section-title">🏡 家庭信息</div>';
    html += '<div class="card"><div class="kv">' +
      '<span class="k">家庭名称</span>' +
      '<span class="v"><span style="font-weight:600;">' + UI.esc(familyName) + '</span> ' +
      '<button class="btn sm ghost" data-edit-family="1">改名</button></span></div></div>';

    // 家庭成员
    html += '<div class="section-title">👨‍👩‍👧‍👦 家庭成员（人人平等）</div>';
    if (members.length) {
      html += '<div class="card">';
      members.forEach(function(m) {
        html += '<div class="kv">' +
          '<span class="k">' + UI.av(m.role, m.name) + ' ' + UI.esc(m.name) + ' <span style="color:var(--sub);font-size:12px;">' + UI.roleName(m.role) + '</span></span>' +
          '<span class="v">' +
            (me == m.id ? '<span class="pill grn">我</span>' : '') +
            '<button class="btn sm ghost" data-edit-m="' + m.id + '">改</button>' +
            '<button class="btn sm ghost" data-del-m="' + m.id + '">删</button>' +
          '</span></div>';
      });
      html += '</div>';
    } else {
      html += '<div class="card"><div class="empty"><span class="e">👪</span>还没有家庭成员，先添加吧</div></div>';
    }
    html += '<div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">' +
      '<button class="btn block" data-new-m="1" style="flex:1 1 140px;">+ 添加家庭成员</button>' +
      '<button class="btn block ghost" data-roles="1" style="flex:1 1 160px;">🏷️ 自定义角色</button>' +
    '</div>';

    // 自定义角色列表
    const roles = await loadRoles();
    html += '<div class="section-title">🏷️ 家庭成员角色</div>';
    html += '<div class="card"><div style="display:flex;gap:6px;flex-wrap:wrap;">';
    if (roles.length) {
      roles.forEach(function(r) {
        html += '<span class="pill ' + (r.builtin ? 'gray' : 'pur') + '">' + UI.esc(r.name) + (r.builtin ? '' : ' <span style="opacity:.7;">·自定义</span>') + '</span>';
      });
    }
    html += '</div></div>';

    // 天气城市（首页实时天气）
    const cityOpts = Object.keys(Weather.CITIES).map(function(c) {
      return '<option value="' + c + '"' + (city === c ? ' selected' : '') + '>' + c + '</option>';
    }).join('');
    html += '<div class="section-title">🌤️ 天气城市</div>';
    html += '<div class="card">' +
      '<div class="kv"><span class="k">首页实时天气</span><span class="v"><select id="m-city" style="width:auto;min-width:120px;">' + cityOpts + '</select></span></div>' +
    '</div>';

    // 通知偏好（演示开关）
    html += '<div class="section-title">🔔 通知偏好</div>';
    html += '<div class="card">';
    ['任务到期','库存不足/临期','旅行出行','点餐/做饭','纪念日'].forEach(function(n) {
      html += '<div class="kv"><span class="k">' + n + '</span><span class="pill grn">开</span></div>';
    });
    html += '</div>';

    // 财务功能（密码锁）
    const finEnabled = await DB.getSetting('finance_enabled');
    const finPwd = await DB.getSetting('finance_pwd');
    html += '<div class="section-title">💰 财务功能</div>';
    html += '<div class="card">' +
      '<div class="kv"><span class="k">启用财务功能</span><span class="v">' +
      '<label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;">' +
      '<input type="checkbox" id="fin-enable" ' + (finEnabled ? 'checked' : '') + ' style="width:18px;height:18px;"> 开启</label></span></div>' +
      (finEnabled ? '<div class="kv"><span class="k">访问密码</span><span class="v">' +
        (finPwd ? '<span class="pill grn">已设置</span> ' : '<span class="pill" style="background:#f0d0d0;color:#a33;">未设置</span> ') +
        '<button class="btn sm ghost" data-fin-pwd="1">' + (finPwd ? '修改' : '设置') + '</button></span></div>' +
        '<div class="kv"><span class="k">进入财务页</span><span class="v"><a href="#/finance" class="btn sm">打开 💰</a></span></div>' : '') +
      '<div style="font-size:11px;color:var(--sub);margin-top:6px;">开启后导航显示财务入口，访问需输密码。财务数据云端同步。</div>' +
    '</div>';

    // 数据与同步
    html += '<div class="section-title">💾 数据与同步</div>';
    html += '<div class="card">' +
      '<div class="kv"><span class="k">多设备同步</span><span class="v"><span class="pill ' + (syncStatus.configured ? 'grn' : 'gray') + '">' + (syncStatus.configured ? '已连接 Supabase' : '本地模式') + '</span></span></div>' +
      (syncStatus.configured ? '<div class="kv"><span class="k">上次同步</span><span class="v" style="font-size:12px;">' + fmtSyncTime(syncStatus.last) + '</span></div>' : '') +
      '<div class="kv"><span class="k">导出数据（JSON）</span><span class="v"><button class="btn sm ghost" data-export="1">导出</button> <button class="btn sm ghost" data-import="1">导入</button> <button class="btn sm ghost" data-dedupe="1" style="color:var(--org);">清理重复</button></span></div>' +
      (syncStatus.configured ? '<div class="kv"><span class="k">立即同步</span><button class="btn sm" data-dosync="1">同步</button></div>' : '') +
      '<div class="kv"><span class="k">同步设置</span><button class="btn sm ghost" data-sync="1">配置</button></div>' +
    '</div>';

    // AI 助手配置
    const aiConf = await (typeof AI !== 'undefined' && AI.getConf ? AI.getConf() : Promise.resolve({}));
    html += '<div class="section-title">🤖 AI 助手（三期）</div>';
    html += '<div class="card">' +
      '<div class="kv"><span class="k">AI 服务</span><span class="v"><span class="pill ' + (aiConf.enabled ? 'grn' : 'gray') + '">' + (aiConf.enabled ? '已配置' : '未配置（本地规则版）') + '</span></span></div>' +
      (aiConf.endpoint ? '<div class="kv"><span class="k">接口地址</span><span class="v" style="font-size:12px;">' + UI.esc(aiConf.endpoint.substring(0,40)) + '…</span></div>' : '') +
      (aiConf.model ? '<div class="kv"><span class="k">模型</span><span class="v" style="font-size:12px;">' + UI.esc(aiConf.model) + '</span></div>' : '') +
      '<div class="kv"><span class="k">AI 设置</span><button class="btn sm ghost" data-ai-conf="1">配置</button></div>' +
      '<div style="font-size:11px;color:var(--sub);margin-top:6px;">配置后语音助手、旅行行程生成、菜品图生成将使用 AI 能力。支持 OpenAI 兼容接口。</div>' +
    '</div>';

    html += '<div style="margin-top:16px;font-size:12px;color:var(--sub);text-align:center;">朱林之家 v2.1 · 本地优先 + Supabase 云同步 + AI 增强</div>';
    return html;
  }

  function openMemberForm(member) {
    // 角色选项：内置 + 自定义
    loadRoles().then(function(roles) {
      const roleOpts = roles.map(function(r) {
        return '<option value="' + r.name + '"' + (member && member.role === r.name ? ' selected' : '') + '>' + r.name + (r.builtin ? '' : '（自定义）') + '</option>';
      }).join('');
      UI.openModal(
        '<h3>' + (member ? '编辑成员' : '添加成员') + '</h3>' +
        '<div class="field"><label>姓名</label><input id="mm-name" value="' + UI.esc(member ? member.name : '') + '" placeholder="如：爸爸"></div>' +
        '<div class="field"><label>角色</label><select id="mm-role">' + roleOpts + '</select></div>' +
        '<div class="foot"><button class="btn ghost" data-x="1">取消</button><button class="btn" data-save="1">保存</button></div>'
      );
      const modal = document.querySelector('.modal');
      modal.querySelector('[data-x]').addEventListener('click', function() { UI.closeModal(); });
      const roleSel = document.getElementById('mm-role');
      // 根据姓名自动推断角色（新建时友好默认）
      if (!member) {
        const nameInput = document.getElementById('mm-name');
        nameInput.addEventListener('input', function() {
          const n = nameInput.value.trim();
          if (n.indexOf('爸爸') >= 0 || n.indexOf('爸') >= 0) roleSel.value = '爸爸';
          else if (n.indexOf('妈妈') >= 0 || n.indexOf('妈') >= 0) roleSel.value = '妈妈';
          else if (n.indexOf('爷爷') >= 0 || n.indexOf('奶奶') >= 0 || n.indexOf('姥姥') >= 0 || n.indexOf('姥爷') >= 0 || n.indexOf('外公') >= 0 || n.indexOf('外婆') >= 0) roleSel.value = '老人';
          else if (n.indexOf('宝宝') >= 0 || n.indexOf('孩子') >= 0 || n.indexOf('宝贝') >= 0) roleSel.value = '孩子';
        });
      }
      modal.querySelector('[data-save]').addEventListener('click', async function() {
        const name = document.getElementById('mm-name').value.trim();
        if (!name) { UI.toast('请填写姓名'); return; }
        const obj = { name: name, role: document.getElementById('mm-role').value };
        if (member) obj.id = member.id;
        await DB.put('members', obj);
        // 首个成员自动设为"我"
        const me = await DB.getSetting('me');
        if (!me) await DB.setSetting('me', obj.id);
        UI.closeModal();
        UI.toast('已保存');
        App.render();
      });
    });
  }

  async function exportData() {
    const stores = ['families','members','tasks','inventory_items','trips','packing_items','anniversaries','milestones','dishes','meal_plans','meal_templates','shopping_items','budgets','transactions','messages'];
    const data = {};
    for (const s of stores) {
      data[s] = await DB.getAll(s);
    }
    data._exported = new Date().toISOString();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '家庭管理系统-备份-' + UI.todayStr() + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    UI.toast('已导出备份');
  }

  async function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async function(e) {
      const file = e.target.files[0];
      if (!file) return;
      if (!confirm('导入将合并到当前数据（同 id 覆盖），确定继续？')) return;
      const text = await file.text();
      try {
        const data = JSON.parse(text);
        let count = 0;
        for (const store of Object.keys(data)) {
          if (store.startsWith('_')) continue;
          if (!DB.STORES.indexOf(store) >= 0 && !DB.SYNC_TABLES.indexOf(store) >= 0) continue;
          const list = data[store];
          if (!Array.isArray(list)) continue;
          for (const item of list) {
            if (item.id) {
              await DB.put(store, item);
            } else {
              await DB.add(store, item);
            }
            count++;
          }
        }
        UI.toast('已导入 ' + count + ' 条数据');
        App.render();
      } catch (err) {
        UI.toast('导入失败：文件格式错误');
      }
    };
    input.click();
  }

  function openSyncForm() {
    DB.getSyncConf().then(function(conf) {
      UI.openModal(
        '<h3>🔗 Supabase 云同步设置</h3>' +
        '<p style="font-size:13px;color:var(--sub);margin-bottom:12px;">填写你在 Supabase 创建的项目地址和 anon/publishable key 即可开启多设备云同步（免费档）。留空保存则切回纯本地模式。</p>' +
        '<div class="field"><label>Supabase URL</label><input id="sy-url" value="' + UI.esc(conf ? conf.url : '') + '" placeholder="https://xxxx.supabase.co"></div>' +
        '<div class="field"><label>Anon / Publishable Key</label><input id="sy-key" placeholder="eyJhbGci... 或 sb_publishable_..."></div>' +
        '<div class="foot"><button class="btn ghost" data-x="1">取消</button><button class="btn" data-save="1">保存并同步</button></div>'
      );
      const modal = document.querySelector('.modal');
      modal.querySelector('[data-x]').addEventListener('click', function() { UI.closeModal(); });
      modal.querySelector('[data-save]').addEventListener('click', async function() {
        const url = document.getElementById('sy-url').value.trim();
        const key = document.getElementById('sy-key').value.trim();
        await DB.setSetting('sync_conf', { url: url, key: key });
        UI.closeModal();
        if (url && key) {
          UI.toast('已保存，正在同步…');
          const r = await DB.syncNow();
          if (r.ok) {
            UI.toast('同步完成：上传 ' + r.pushed + '，下载 ' + r.pulled + ' 条');
          } else {
            UI.toast('配置已保存，但同步失败，请检查 URL / Key 或网络');
          }
        } else {
          UI.toast('已切换为本地模式');
        }
        App.render();
      });
    });
  }

  // 立即同步
  async function doSync() {
    UI.toast('正在同步…');
    const r = await DB.syncNow();
    if (r.ok) {
      UI.toast('同步完成：上传 ' + r.pushed + '，下载 ' + r.pulled + ' 条');
    } else {
      UI.toast('同步失败：' + (r.errors || []).join('；'));
    }
    App.render();
  }

  // AI 配置
  async function openAiConf() {
    const conf = await (typeof AI !== 'undefined' && AI.getConf ? AI.getConf() : Promise.resolve({}));
    UI.openModal(
      '<h3>🤖 AI 助手配置</h3>' +
      '<p style="font-size:13px;color:var(--sub);margin-bottom:12px;">填写 OpenAI 兼容接口的地址和 Key，即可启用 AI 智能对话、行程生成、菜品图生成。留空则使用本地规则版。</p>' +
      '<div class="field"><label>API Endpoint（接口地址）</label><input id="ai-endpoint" value="' + UI.esc(conf.endpoint || '') + '" placeholder="https://api.openai.com/v1"></div>' +
      '<div class="field"><label>API Key</label><input id="ai-key" type="password" value="' + UI.esc(conf.key || '') + '" placeholder="sk-..."></div>' +
      '<div class="field"><label>模型名称</label><input id="ai-model" value="' + UI.esc(conf.model || 'gpt-4o-mini') + '" placeholder="gpt-4o-mini / doubao-1-5 等"></div>' +
      '<div class="foot"><button class="btn ghost" data-x="1">取消</button><button class="btn" data-ai-save="1">保存</button></div>'
    );
    const modal = document.querySelector('.modal');
    modal.querySelector('[data-x]').addEventListener('click', function() { UI.closeModal(); });
    modal.querySelector('[data-ai-save]').addEventListener('click', async function() {
      const endpoint = document.getElementById('ai-endpoint').value.trim();
      const key = document.getElementById('ai-key').value.trim();
      const model = document.getElementById('ai-model').value.trim() || 'gpt-4o-mini';
      await DB.setSetting('ai_conf', { endpoint: endpoint, key: key, model: model });
      UI.closeModal();
      UI.toast(endpoint && key ? 'AI 配置已保存' : '已切换为本地规则版');
      App.render();
    });
  }

  async function onAction(e) {
    const t = e.target;
    const nm = t.getAttribute('data-new-m');
    const em = t.getAttribute('data-edit-m');
    const dm = t.getAttribute('data-del-m');
    const ex = t.getAttribute('data-export');
    const sy = t.getAttribute('data-sync');
    const ds = t.getAttribute('data-dosync');
    const rl = t.getAttribute('data-roles');
    const ef = t.getAttribute('data-edit-family');
    if (nm) openMemberForm(null);
    else if (em) openMemberForm(await DB.get('members', +em));
    else if (ef) {
      const cur = await DB.getFamilyName();
      UI.openModal('<h3>修改家庭名称</h3>' +
        '<p style="color:var(--sub);font-size:13px;margin-bottom:10px;">全家共享，修改后所有设备同步更新。</p>' +
        '<input id="fam-name" class="input" value="' + UI.esc(cur) + '" placeholder="家庭名称" style="width:100%;margin-bottom:12px;">' +
        '<div class="foot"><button class="btn ghost" data-x="1">取消</button><button class="btn" data-ok="1">保存</button></div>');
      const modal = document.querySelector('.modal');
      modal.querySelector('[data-x]').addEventListener('click', function() { UI.closeModal(); });
      modal.querySelector('[data-ok]').addEventListener('click', async function() {
        const v = document.getElementById('fam-name').value.trim();
        if (!v) { UI.toast('名称不能为空'); return; }
        await DB.setFamilyName(v);
        const el = document.querySelector('.brand .nm');
        if (el) el.textContent = v;
        document.title = v;
        UI.closeModal();
        UI.toast('家庭名称已更新');
        App.render();
      });
    }
    else if (dm) {
      const id = +dm;
      UI.openModal('<h3>删除成员</h3><p style="color:var(--sub);font-size:14px;margin-bottom:8px;">确定删除这位成员吗？其历史记录仍保留。</p><div class="foot"><button class="btn ghost" data-x="1">取消</button><button class="btn" data-ok="1" style="background:var(--red);">删除</button></div>');
      const modal = document.querySelector('.modal');
      modal.querySelector('[data-x]').addEventListener('click', function() { UI.closeModal(); });
      modal.querySelector('[data-ok]').addEventListener('click', async function() {
        await DB.del('members', id);
        const me = await DB.getSetting('me');
        if (me == id) await DB.setSetting('me', null);
        UI.closeModal();
        UI.toast('已删除');
        App.render();
      });
    }
    else if (ex) exportData();
    else if (t.getAttribute('data-import')) importData();
    else if (t.getAttribute('data-dedupe')) {
      if (!confirm('将清理所有表中 uid 重复的数据（保留最新版本），确定继续？')) return;
      DB.dedupe().then(function(n) {
        UI.toast('已清理 ' + n + ' 条重复数据');
        App.render();
      });
    }
    else if (t.getAttribute('data-ai-conf')) openAiConf();
    else if (sy) openSyncForm();
    else if (ds) doSync();
    else if (rl) openRoleManager();
    else if (t.getAttribute('data-fin-pwd')) {
      UI.openModal('<h3>设置财务密码</h3>' +
        '<p style="color:var(--sub);font-size:13px;margin-bottom:10px;">访问财务页时需要输入。忘记密码可在此重置。</p>' +
        '<input type="password" id="fin-new-pwd" class="input" placeholder="新密码" style="width:100%;margin-bottom:8px;">' +
        '<input type="password" id="fin-new-pwd2" class="input" placeholder="确认密码" style="width:100%;margin-bottom:12px;">' +
        '<div class="foot"><button class="btn ghost" data-x="1">取消</button><button class="btn" data-fin-pwd-ok="1">保存</button></div>');
      const modal = document.querySelector('.modal');
      modal.querySelector('[data-x]').addEventListener('click', function() { UI.closeModal(); });
      modal.querySelector('[data-fin-pwd-ok]').addEventListener('click', async function() {
        const p1 = document.getElementById('fin-new-pwd').value;
        const p2 = document.getElementById('fin-new-pwd2').value;
        if (!p1 || p1.length < 4) { UI.toast('密码至少 4 位'); return; }
        if (p1 !== p2) { UI.toast('两次密码不一致'); return; }
        await DB.setSetting('finance_pwd', FinancePage.simpleHash(p1));
        UI.closeModal();
        UI.toast('密码已设置');
        App.render();
      });
    }
  }

  function bind(root) {
    root.addEventListener('click', onAction);
    root.addEventListener('change', async function(e) {
      const t = e.target;
      if (t.id === 'm-city') {
        await DB.setSetting('city', t.value);
        UI.toast('天气城市已切换为 ' + t.value);
      } else if (t.id === 'fin-enable') {
        await DB.setSetting('finance_enabled', t.checked ? true : false);
        document.body.classList.toggle('finance-on', t.checked);
        UI.toast(t.checked ? '财务功能已开启' : '财务功能已关闭');
        App.render();
      }
    });
  }

  return { body: body, bind: bind };
})();
