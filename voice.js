/* 语音助手模块 - 精细卡通小狗 v4
   精细SVG + 状态表情动画 + 可拖动 + 长按快捷菜单 + 对话面板 */
const VoiceAssistant = (function() {
  let panelOpen = false;
  let voiceOutput = true;
  let recognizing = false;
  let recognition = null;
  let dogState = 'idle'; // idle | listening | thinking | speaking | success | error
  let idleTimer = null;
  let dragState = null;
  let longPressTimer = null;

  // ===== 精细卡通小狗 SVG（柯基风格） =====
  function dogSVG(state) {
    const eye = state === 'thinking'
      ? '<g><circle cx="26" cy="34" r="1" fill="#2a2a2a"/><circle cx="38" cy="34" r="1" fill="#2a2a2a"/></g>'
      : state === 'success'
      ? '<g><path d="M22 34 Q26 30 30 34" stroke="#2a2a2a" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M34 34 Q38 30 42 34" stroke="#2a2a2a" stroke-width="2" fill="none" stroke-linecap="round"/></g>'
      : state === 'error'
      ? '<g><line x1="22" y1="31" x2="30" y2="37" stroke="#2a2a2a" stroke-width="2" stroke-linecap="round"/><line x1="30" y1="31" x2="22" y2="37" stroke="#2a2a2a" stroke-width="2" stroke-linecap="round"/><line x1="34" y1="31" x2="42" y2="37" stroke="#2a2a2a" stroke-width="2" stroke-linecap="round"/><line x1="42" y1="31" x2="34" y2="37" stroke="#2a2a2a" stroke-width="2" stroke-linecap="round"/></g>'
      : '<g class="dog-eyes"><circle cx="26" cy="34" r="3" fill="#2a2a2a"/><circle cx="38" cy="34" r="3" fill="#2a2a2a"/><circle cx="27" cy="33" r="1" fill="#fff"/><circle cx="39" cy="33" r="1" fill="#fff"/></g>';

    const mouth = state === 'speaking'
      ? '<ellipse cx="32" cy="46" rx="4" ry="3.5" fill="#8B4513" class="dog-mouth-talk"/>'
      : state === 'success'
      ? '<path d="M26 45 Q32 52 38 45" stroke="#2a2a2a" stroke-width="2" fill="none" stroke-linecap="round"/>'
      : state === 'error'
      ? '<path d="M26 48 Q32 44 38 48" stroke="#2a2a2a" stroke-width="2" fill="none" stroke-linecap="round"/>'
      : '<path d="M32 47 Q29 50 26 48" stroke="#2a2a2a" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M32 47 Q35 50 38 48" stroke="#2a2a2a" stroke-width="1.5" fill="none" stroke-linecap="round"/>';

    const earAnim = state === 'listening' ? 'class="dog-ear-listen"' : '';
    const thinking = state === 'thinking' ? '<circle cx="48" cy="18" r="2" fill="#9B7FD4" class="dog-think-dot"/><circle cx="52" cy="14" r="1.5" fill="#9B7FD4" class="dog-think-dot2"/>' : '';

    return '<svg viewBox="0 0 64 64" width="100%" height="100%">' +
      // 身体（柯基短腿）
      '<ellipse cx="32" cy="56" rx="16" ry="6" fill="#D4A017"/>' +
      '<rect x="18" y="52" width="5" height="8" rx="2" fill="#C49010"/>' +
      '<rect x="41" y="52" width="5" height="8" rx="2" fill="#C49010"/>' +
      // 尾巴
      '<ellipse cx="50" cy="50" rx="4" ry="3" fill="#E8B830" transform="rotate(-30 50 50)" class="dog-tail"/>' +
      // 脸
      '<ellipse cx="32" cy="36" rx="19" ry="17" fill="#F5C842"/>' +
      // 白色脸部斑纹
      '<ellipse cx="32" cy="42" rx="10" ry="8" fill="#FFF5E0"/>' +
      // 耳朵（大耳朵柯基）
      '<ellipse cx="16" cy="22" rx="8" ry="12" fill="#D4A017" transform="rotate(-25 16 22)" ' + earAnim + '/>' +
      '<ellipse cx="48" cy="22" rx="8" ry="12" fill="#D4A017" transform="rotate(25 48 22)" ' + earAnim + '/>' +
      '<ellipse cx="16" cy="24" rx="4.5" ry="7" fill="#F5C842" transform="rotate(-25 16 24)"/>' +
      '<ellipse cx="48" cy="24" rx="4.5" ry="7" fill="#F5C842" transform="rotate(25 48 24)"/>' +
      // 眼睛
      eye +
      // 鼻子
      '<ellipse cx="32" cy="42" rx="3.5" ry="2.5" fill="#2a2a2a"/>' +
      '<ellipse cx="31" cy="41" rx="1" ry="0.5" fill="#555"/>' +
      // 嘴巴
      mouth +
      // 腮红
      '<ellipse cx="19" cy="40" rx="3.5" ry="2" fill="#FF9999" opacity="0.4"/>' +
      '<ellipse cx="45" cy="40" rx="3.5" ry="2" fill="#FF9999" opacity="0.4"/>' +
      // 思考气泡
      thinking +
      '<style>' +
        '@keyframes dogBlink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(0.1)}}' +
        '.dog-eyes{transform-origin:center;animation:dogBlink 4s ease-in-out infinite}' +
        '@keyframes dogEar{0%,100%{transform:rotate(-25deg)}50%{transform:rotate(-15deg)}}' +
        '.dog-ear-listen{animation:dogEar 0.5s ease-in-out infinite}' +
        '@keyframes dogTail{0%,100%{transform:rotate(-30deg)}25%{transform:rotate(-10deg)}75%{transform:rotate(-50deg)}}' +
        '.dog-tail{transform-origin:46px 48px;animation:dogTail 0.8s ease-in-out infinite}' +
        '@keyframes dogMouth{0%,100%{ry:3.5}50%{ry:1}}' +
        '.dog-mouth-talk{animation:dogMouth 0.3s ease-in-out infinite}' +
        '@keyframes dogThink{0%,100%{opacity:1;transform:translateY(0)}50%{opacity:0.4;transform:translateY(-3px)}}' +
        '.dog-think-dot{animation:dogThink 0.8s ease-in-out infinite}' +
        '.dog-think-dot2{animation:dogThink 0.8s ease-in-out 0.2s infinite}' +
        '@keyframes dogYawn{0%,90%,100%{transform:scaleY(1)}95%{transform:scaleY(1.8)}}' +
      '</style>' +
    '</svg>';
  }

  function setState(s) {
    dogState = s;
    const fab = document.getElementById('voice-fab');
    if (fab) {
      fab.innerHTML = dogSVG(s);
      if (s === 'speaking') {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(function() { setState('idle'); }, 3000);
      } else if (s === 'success' || s === 'error') {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(function() { setState('idle'); }, 1500);
      }
    }
  }

  async function getName() {
    try { return (await DB.getSetting('voice_name')) || '小汪'; } catch(e) { return '小汪'; }
  }
  async function setName(name) { await DB.setSetting('voice_name', name); }

  // ===== 初始化：创建浮动按钮 + 拖动 + 长按 =====
  function init() {
    if (document.getElementById('voice-fab')) return;
    const fab = document.createElement('div');
    fab.id = 'voice-fab';
    fab.innerHTML = dogSVG('idle');
    fab.title = '语音助手（点击对话，长按快捷菜单，可拖动）';
    document.body.appendChild(fab);

    // 拖动 + 长按 + 点击 区分
    let startX, startY, startTime, moved = false;
    fab.addEventListener('pointerdown', function(e) {
      e.preventDefault();
      startX = e.clientX; startY = e.clientY; startTime = Date.now(); moved = false;
      dragState = { startX, startY, origLeft: fab.offsetLeft, origTop: fab.offsetTop };
      fab.classList.add('dragging');
      // 长按检测
      longPressTimer = setTimeout(function() {
        if (!moved) { showQuickMenu(fab); }
      }, 500);
    });
    fab.addEventListener('pointermove', function(e) {
      if (!dragState) return;
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        moved = true;
        clearTimeout(longPressTimer);
      }
      if (moved) {
        const rect = fab.getBoundingClientRect();
        fab.style.left = (e.clientX - rect.width / 2) + 'px';
        fab.style.top = (e.clientY - rect.height / 2) + 'px';
        fab.style.right = 'auto';
        fab.style.bottom = 'auto';
      }
    });
    fab.addEventListener('pointerup', function(e) {
      fab.classList.remove('dragging');
      clearTimeout(longPressTimer);
      const wasMoved = moved;
      dragState = null;
      if (!wasMoved && Date.now() - startTime < 500) {
        togglePanel();
      }
      // 不记住位置，松手后不重置（用户要求不记住位置=下次打开回默认，但本次会话保持拖动位置）
    });
    fab.addEventListener('pointercancel', function() {
      dragState = null; clearTimeout(longPressTimer);
    });
  }

  // 快捷菜单
  function showQuickMenu(fab) {
    setState('listening');
    const existing = document.getElementById('voice-quick-menu');
    if (existing) existing.remove();
    const menu = document.createElement('div');
    menu.id = 'voice-quick-menu';
    menu.className = 'voice-quick-menu show';
    const rect = fab.getBoundingClientRect();
    menu.style.left = Math.max(10, rect.left - 80) + 'px';
    menu.style.top = (rect.top - 60) + 'px';
    menu.innerHTML =
      '<button data-quick-action="expense" title="记一笔">💰</button>' +
      '<button data-quick-action="task" title="加日程">📅</button>' +
      '<button data-quick-action="weather" title="天气">🌤️</button>';
    document.body.appendChild(menu);
    menu.querySelectorAll('button').forEach(function(btn) {
      btn.addEventListener('click', function() {
        const action = btn.getAttribute('data-quick-action');
        menu.remove();
        if (action === 'expense') quickExpense();
        else if (action === 'task') quickTask();
        else if (action === 'weather') quickWeather();
      });
    });
    setTimeout(function() {
      document.addEventListener('click', function closeMenu(e) {
        if (!menu.contains(e.target) && e.target !== fab) {
          menu.remove(); setState('idle');
          document.removeEventListener('click', closeMenu);
        }
      });
    }, 10);
  }

  function quickExpense() {
    if (typeof FinancePage !== 'undefined') {
      location.hash = '#/finance';
      setTimeout(function() {
        const btn = document.querySelector('[data-add-tx]');
        if (btn) btn.click();
      }, 300);
    }
  }
  function quickTask() {
    location.hash = '#/calendar';
    setTimeout(function() {
      const btn = document.querySelector('[data-add-task]');
      if (btn) btn.click();
    }, 300);
  }
  async function quickWeather() {
    setState('thinking');
    const w = await Weather.fetchNow();
    setState('success');
    if (w) UI.toast(w.city + '：' + w.temp + '°C ' + w.text);
    else UI.toast('天气获取失败');
  }

  function togglePanel() { panelOpen ? closePanel() : openPanel(); }

  async function openPanel() {
    panelOpen = true;
    setState('listening');
    const name = await getName();
    const panel = document.createElement('div');
    panel.id = 'voice-panel';
    panel.style.cssText = 'position:fixed;right:16px;bottom:100px;width:320px;max-width:calc(100vw - 32px);height:440px;max-height:calc(100vh - 160px);background:#fff;border-radius:20px;box-shadow:0 12px 40px rgba(0,0,0,0.2);z-index:9999;display:flex;flex-direction:column;overflow:hidden;animation:voiceSlide .25s cubic-bezier(.34,1.56,.64,1);border:2px solid #F5E6C8;';
    panel.innerHTML =
      '<style>@keyframes voiceSlide{from{opacity:0;transform:translateY(12px) scale(.95)}to{opacity:1;transform:none}}</style>' +
      '<div style="background:linear-gradient(135deg,#F5C842,#E8B830);padding:12px 14px;display:flex;align-items:center;gap:10px;">' +
        '<div style="width:40px;height:40px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.1);">' + dogSVG('idle') + '</div>' +
        '<div style="flex:1;">' +
          '<div style="font-weight:800;font-size:15px;color:#5a4000;" id="voice-title">' + name + '</div>' +
          '<div style="font-size:11px;color:#7a5a10;" id="voice-status">在线 · 点击输入</div>' +
        '</div>' +
        '<button id="voice-close" style="background:none;border:none;font-size:22px;cursor:pointer;color:#5a4000;padding:4px 8px;">×</button>' +
      '</div>' +
      '<div id="voice-messages" style="flex:1;overflow-y:auto;padding:12px;background:#FFFCF5;"></div>' +
      '<div style="padding:10px;border-top:2px solid #F5E6C8;background:#fff;">' +
        '<div style="display:flex;gap:6px;align-items:center;">' +
          '<button id="voice-mic" style="width:40px;height:40px;border-radius:50%;border:none;background:#FFF0D0;cursor:pointer;font-size:18px;flex-shrink:0;" title="语音输入">🎤</button>' +
          '<input id="voice-input" type="text" placeholder="和' + name + '说点什么…" style="flex:1;border:2px solid #F0E0C0;border-radius:20px;padding:9px 14px;font-size:13px;outline:none;background:#FFFCF5;">' +
          '<button id="voice-send" style="width:40px;height:40px;border-radius:50%;border:none;background:linear-gradient(135deg,#5DD9D0,#38B2AC);color:#fff;cursor:pointer;font-size:16px;flex-shrink:0;box-shadow:0 2px 8px rgba(56,178,172,0.3);">➤</button>' +
        '</div>' +
        '<div style="display:flex;gap:10px;margin-top:8px;font-size:11px;color:#A89890;align-items:center;">' +
          '<span style="cursor:pointer;color:#38B2AC;font-weight:600;" data-quick="记一笔50元餐饮">💰 记一笔</span>' +
          '<span style="cursor:pointer;color:#38B2AC;font-weight:600;" data-quick="明天接孩子">📅 加日程</span>' +
          '<span style="cursor:pointer;color:#38B2AC;font-weight:600;" data-quick="今天天气">☀️ 天气</span>' +
          '<label style="margin-left:auto;cursor:pointer;"><input type="checkbox" id="voice-tts" checked> 语音</label>' +
        '</div>' +
      '</div>';
    document.body.appendChild(panel);

    panel.querySelector('#voice-close').addEventListener('click', closePanel);
    panel.querySelector('#voice-send').addEventListener('click', sendMessage);
    panel.querySelector('#voice-input').addEventListener('keydown', function(e) { if (e.key === 'Enter') sendMessage(); });
    panel.querySelector('#voice-mic').addEventListener('click', toggleVoiceInput);
    panel.querySelectorAll('[data-quick]').forEach(function(el) {
      el.addEventListener('click', function() {
        document.getElementById('voice-input').value = el.getAttribute('data-quick');
        sendMessage();
      });
    });
    panel.querySelector('#voice-tts').addEventListener('change', function(e) { voiceOutput = e.target.checked; });

    addMsg('assistant', '汪汪！我是' + name + '，有什么可以帮你的？可以说"记一笔50元餐饮"、"明天接孩子"、"今天天气"。');
  }

  function closePanel() {
    panelOpen = false;
    setState('idle');
    const p = document.getElementById('voice-panel');
    if (p) p.remove();
  }

  function addMsg(role, text) {
    const container = document.getElementById('voice-messages');
    if (!container) return;
    const div = document.createElement('div');
    div.style.cssText = 'margin-bottom:10px;display:flex;' + (role === 'user' ? 'justify-content:flex-end;' : 'justify-content:flex-start;');
    div.innerHTML = '<div style="max-width:80%;padding:8px 12px;border-radius:14px;font-size:13px;line-height:1.5;' +
      (role === 'user' ? 'background:linear-gradient(135deg,#5DD9D0,#38B2AC);color:#fff;border-bottom-right-radius:4px;' : 'background:#FFF0D0;color:#4A3F45;border-bottom-left-radius:4px;') +
      '">' + UI.esc(text) + '</div>';
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  async function sendMessage() {
    const input = document.getElementById('voice-input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    addMsg('user', text);
    setState('thinking');
    let reply = '';
    try {
      if (typeof AI !== 'undefined' && AI.parseIntent) {
        const intent = await AI.parseIntent(text);
        reply = await handleIntent(intent, text);
      } else {
        reply = fallbackReply(text);
      }
    } catch(e) { reply = fallbackReply(text); }
    setState('speaking');
    setTimeout(function() { addMsg('assistant', reply); }, 300);
    if (voiceOutput && 'speechSynthesis' in window) {
      try {
        const u = new SpeechSynthesisUtterance(reply);
        u.lang = 'zh-CN'; u.rate = 1.1;
        speechSynthesis.speak(u);
      } catch(e) {}
    }
  }

  async function handleIntent(intent, rawText) {
    const name = await getName();
    if (!intent || !intent.type || intent.type === 'unknown') {
      if (typeof AI !== 'undefined' && AI.getConf) {
        const conf = await AI.getConf();
        if (conf.enabled) {
          const r = await AI.chat(rawText, '你是一个叫' + name + '的可爱卡通小狗家庭助手，性格活泼，用中文回答，简洁亲切，偶尔用汪星人语气。');
          if (r.ok && r.text) return r.text;
        }
      }
      return fallbackReply(rawText);
    }
    if (intent.type === 'expense') {
      const amount = intent.amount || extractNumber(rawText);
      const category = intent.category || '其他';
      const year = new Date().getFullYear();
      if (typeof FinancePage !== 'undefined' && FinancePage.ensureBudget) await FinancePage.ensureBudget(year);
      const today = new Date().toISOString().slice(0, 10);
      await DB.add('transactions', { type: 'expense', amount: +amount, cat: category, note: rawText, date: today, created: Date.now() });
      return '汪汪！已记一笔支出：' + amount + '元，分类「' + category + '」。';
    }
    if (intent.type === 'income') {
      const amount = intent.amount || extractNumber(rawText);
      const today = new Date().toISOString().slice(0, 10);
      await DB.add('transactions', { type: 'income', amount: +amount, cat: intent.category || '其他', note: rawText, date: today, created: Date.now() });
      return '汪汪！已记一笔收入：' + amount + '元。';
    }
    if (intent.type === 'task') {
      const today = new Date().toISOString().slice(0, 10);
      await DB.add('tasks', { title: intent.content || rawText, due: intent.date || today, time: intent.time || '', done: false, created: Date.now() });
      return '汪汪！已添加日程：' + (intent.content || rawText);
    }
    if (intent.type === 'weather') {
      setState('thinking');
      const w = await Weather.fetchNow();
      if (w) return '汪汪！今天' + w.city + '：' + w.temp + '°C，' + w.text + '，体感' + w.feels + '°。';
      return '呜呜，天气获取失败了…';
    }
    if (intent.type === 'trip') return '汪汪！旅行规划可以去旅行页详细安排哦～';
    return fallbackReply(rawText);
  }

  function extractNumber(text) {
    const m = text.match(/(\d+(?:\.\d+)?)/);
    return m ? parseFloat(m[1]) : 0;
  }

  function fallbackReply(text) {
    if (/你好|hi|hello|在吗/i.test(text)) return '汪汪汪！我在呢～有什么事？';
    if (/谢谢|感谢|多谢/.test(text)) return '不客气汪！随时为你服务～';
    if (/名字|你叫什么/.test(text)) return '我是你的小狗助手呀，你可以在设置里给我改名字汪！';
    if (/叫你|以后叫/.test(text)) {
      const m = text.match(/叫你(.+?)(?:啊|吧|呢|。|$)/);
      if (m && m[1]) { setName(m[1].trim()); return '汪汪！好的，以后就叫我' + m[1].trim() + '啦！'; }
    }
    if (/天气/.test(text)) return '汪汪！你可以说"今天天气"我来查。';
    if (/记|花|支出/.test(text)) return '汪汪！你可以说"记一笔50元餐饮"我来帮你记。';
    return '汪汪！我听到了，不过我还在学习中～你可以试试"记一笔"、"加日程"、"查天气"。';
  }

  function toggleVoiceInput() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      UI.toast('当前浏览器不支持语音输入'); return;
    }
    if (recognizing) { recognition.stop(); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SR();
    recognition.lang = 'zh-CN';
    recognition.onstart = function() { recognizing = true; setState('listening'); UI.toast('正在听…'); };
    recognition.onresult = function(e) {
      const text = e.results[0][0].transcript;
      document.getElementById('voice-input').value = text;
      sendMessage();
    };
    recognition.onerror = function() { UI.toast('没听清，再试一次'); };
    recognition.onend = function() { recognizing = false; setState('idle'); };
    recognition.start();
  }

  return { init: init, setState: setState };
})();
