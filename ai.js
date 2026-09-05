/* 家庭管理系统 - AI 接口层（预留）
   统一封装 AI 能力，三期接入具体 API（如豆包等）。
   当前为本地规则/占位实现，接口已定义好，后续只需替换实现。
*/
const AI = (function() {
  // AI 配置（从 settings 读取，三期填入 API key/endpoint）
  async function getConf() {
    const key = await DB.getSetting('ai_key');
    const endpoint = await DB.getSetting('ai_endpoint');
    return { key: key || '', endpoint: endpoint || '', enabled: !!(key && endpoint) };
  }

  // 通用对话接口（三期实现：调用 AI API 返回文本）
  async function chat(prompt, system) {
    const conf = await getConf();
    if (!conf.enabled) {
      return { ok: false, error: 'AI 未配置', text: '' };
    }
    // 三期：fetch(conf.endpoint, {method:'POST', headers:{Authorization:'Bearer '+conf.key}, body:JSON.stringify({messages:[...]})})
    return { ok: false, error: 'AI 接口待接入', text: '' };
  }

  // 智能行程生成（输入目的地+天数+人数，返回行程建议）
  async function genTrip(dest, days, people, notes) {
    return chat('请为家庭旅行生成行程：目的地=' + dest + '，天数=' + days + '，人数=' + people + '，备注=' + (notes||''), '你是家庭旅行规划助手');
  }

  // 智能菜品图生成（输入菜名，返回图片 URL 或 base64）
  async function genDishImage(dishName) {
    return { ok: false, error: '菜品图 AI 生成待接入', url: '' };
  }

  // 语音意图解析（输入文本，返回结构化意图：{action, params}）
  // 当前本地规则实现，三期可替换为 AI 理解
  async function parseIntent(text) {
    const t = (text || '').trim();
    // 记账："记一笔 50 买菜" / "花了 30 打车"
    const moneyMatch = t.match(/(\d+(?:\.\d+)?)/);
    if (/记|花|支出|收入|工资/.test(t) && moneyMatch) {
      const isIncome = /收入|工资|赚/.test(t);
      return { action: 'add_transaction', params: { type: isIncome ? 'income' : 'expense', amount: parseFloat(moneyMatch[1]), note: t } };
    }
    // 日程："周五晚8点 家庭会议" / "明天 接孩子"
    if (/点|号|周|明天|今天|后天/.test(t) && /会议|接|提醒|安排|约会/.test(t)) {
      return { action: 'add_task', params: { title: t } };
    }
    // 旅行："去北京玩5天" / "下个月去三亚"
    if (/去|玩|旅行|旅游/.test(t)) {
      return { action: 'create_trip', params: { raw: t } };
    }
    return { action: 'unknown', params: { raw: t } };
  }

  return {
    chat: chat,
    genTrip: genTrip,
    genDishImage: genDishImage,
    parseIntent: parseIntent,
    getConf: getConf
  };
})();
