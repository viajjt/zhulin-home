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
  // 返回格式：{ type, amount, category, content, date, time }
  async function parseIntent(text) {
    const t = (text || '').trim();
    // 记账："记一笔 50 买菜" / "花了 30 打车" / "收入 5000 工资"
    const moneyMatch = t.match(/(\d+(?:\.\d+)?)/);
    if (/记|花|支出|收入|工资|赚了|报销/.test(t) && moneyMatch) {
      const isIncome = /收入|工资|赚|报销/.test(t);
      // 简单分类识别
      let category = '其他';
      if (/餐|饭|吃|菜|水果|零食/.test(t)) category = '餐饮';
      else if (/打车|地铁|公交|油|停车|交通|高铁|机票|火车/.test(t)) category = '交通';
      else if (/购物|衣服|鞋|包|淘宝|京东/.test(t)) category = '购物';
      else if (/房|租|水电|物业|燃气/.test(t)) category = '居家';
      else if (/药|医院|体检|保险/.test(t)) category = '医疗';
      else if (/孩子|学费|玩具|奶粉/.test(t)) category = '育儿';
      else if (/娱乐|电影|游戏|旅游|门票/.test(t)) category = '娱乐';
      return { type: isIncome ? 'income' : 'expense', amount: parseFloat(moneyMatch[1]), category: category, content: t };
    }
    // 日程："周五晚8点 家庭会议" / "明天 接孩子" / "提醒我后天交电费"
    if (/点|号|周|明天|今天|后天|提醒|安排|约会|接|交|会议/.test(t)) {
      let content = t;
      // 提取时间
      let time = '';
      const timeMatch = t.match(/(\d{1,2})[:：点](\d{2})?/);
      if (timeMatch) time = timeMatch[1] + ':' + (timeMatch[2] || '00');
      // 提取日期（简单）
      let date = '';
      if (/明天/.test(t)) date = new Date(Date.now() + 86400000).toISOString().slice(0,10);
      else if (/后天/.test(t)) date = new Date(Date.now() + 172800000).toISOString().slice(0,10);
      else if (/今天/.test(t)) date = new Date().toISOString().slice(0,10);
      return { type: 'task', content: content, date: date, time: time };
    }
    // 天气
    if (/天气|气温|下雨|温度/.test(t)) {
      return { type: 'weather' };
    }
    // 旅行："去北京玩5天" / "下个月去三亚"
    if (/去|玩|旅行|旅游|出游/.test(t)) {
      return { type: 'trip', content: t };
    }
    return { type: 'unknown', content: t };
  }

  return {
    chat: chat,
    genTrip: genTrip,
    genDishImage: genDishImage,
    parseIntent: parseIntent,
    getConf: getConf
  };
})();
