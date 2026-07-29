// ============================================================
// StepForward · API 调用封装 v1.0
// ============================================================
// 支持的 AI 服务商：
//   - deepseek   : DeepSeek (国内推荐，性价比高)
//   - minimax    : MiniMax (国内推荐)
//   - openai     : OpenAI (GPT-4o / GPT-4o-mini)
//   - zhipu      : 智谱 AI (GLM-4)
//   - qwen       : 通义千问
//   - anthropic  : Anthropic (Claude)
// ============================================================

const PROVIDERS = {
  deepseek: {
    name: 'DeepSeek',
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    models:[
      { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro (推荐，能力更强)' },
      { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash (速度快，性价比高)' },
    ],
    defaultModel: 'deepseek-v4-flash',

    buildBody: (messages, model, systemPrompt) => ({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 2048,
    }),
    extractContent: (data) => data.choices?.[0]?.message?.content || '',
  },

  minimax: {
    name: 'MiniMax',
    endpoint: 'https://api.minimax.chat/v1/text/chatcompletion_v2',
    models: [
      { id: 'abab6.5s-chat', name: 'abab6.5s (推荐，速度快)' },
      { id: 'abab6.5t-chat', name: 'abab6.5t (能力更强)' },
    ],
    defaultModel: 'abab6.5s-chat',
    // MiniMax 的请求体格式稍有不同
    buildBody: (messages, model, systemPrompt) => ({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 1024,
    }),
    extractContent: (data) => data.choices?.[0]?.message?.content || '',
  },

  openai: {
    name: 'OpenAI',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    models: [
      { id: 'gpt-4o-mini', name: 'GPT-4o mini (性价比高)' },
      { id: 'gpt-4o', name: 'GPT-4o (能力最强)' },
    ],
    defaultModel: 'gpt-4o-mini',
    buildBody: (messages, model, systemPrompt) => ({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 1024,
    }),
    extractContent: (data) => data.choices?.[0]?.message?.content || '',
  },

  zhipu: {
    name: '智谱 AI',
    endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    models: [
      { id: 'glm-4-flash', name: 'GLM-4 Flash (免费/速度快)' },
      { id: 'glm-4', name: 'GLM-4 (能力强)' },
    ],
    defaultModel: 'glm-4-flash',
    buildBody: (messages, model, systemPrompt) => ({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 1024,
    }),
    extractContent: (data) => data.choices?.[0]?.message?.content || '',
  },

  qwen: {
    name: '通义千问',
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    models: [
      { id: 'qwen-plus', name: 'Qwen Plus (推荐)' },
      { id: 'qwen-turbo', name: 'Qwen Turbo (速度快)' },
      { id: 'qwen-max', name: 'Qwen Max (能力最强)' },
    ],
    defaultModel: 'qwen-plus',
    buildBody: (messages, model, systemPrompt) => ({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 1024,
    }),
    extractContent: (data) => data.choices?.[0]?.message?.content || '',
  },

  anthropic: {
    name: 'Anthropic',
    endpoint: 'https://api.anthropic.com/v1/messages',
    models: [
      { id: 'claude-3-5-sonnet-20240620', name: 'Claude 3.5 Sonnet (推荐)' },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku (速度快)' },
    ],
    defaultModel: 'claude-3-5-sonnet-20240620',
    // Anthropic 的格式不同
    buildBody: (messages, model, systemPrompt) => ({
      model,
      system: systemPrompt,
      messages,
      temperature: 0.7,
      max_tokens: 1024,
    }),
    extractContent: (data) => data.content?.[0]?.text || '',
    getHeaders: (apiKey) => ({
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    }),
  },
};

// ============================================================
// 配置管理（localStorage）
// ============================================================

const CONFIG_KEY = 'stepforward_config';

function getConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function saveConfig(config) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

function clearConfig() {
  localStorage.removeItem(CONFIG_KEY);
}

function hasConfig() {
  return !!getConfig();
}

// ============================================================
// 核心：调用 AI API
// ============================================================

/**
 * 调用 AI 聊天接口
 * @param {Array} messages - 对话历史，格式: [{role: 'user'|'assistant', content: '...'}]
 * @param {string} systemPrompt - System Prompt
 * @param {Object} config - 用户配置 { provider, apiKey, model }
 * @returns {Promise<string>} - AI 的回应内容
 */
async function callAI(messages, systemPrompt, config) {
  if (!config) config = getConfig();
  if (!config) throw new Error('请先配置 API Key');

  const provider = PROVIDERS[config.provider];
  if (!provider) throw new Error(`不支持的服务商: ${config.provider}`);

  const model = config.model || provider.defaultModel;
  const apiKey = config.apiKey;
  if (!apiKey) throw new Error('API Key 为空');

  const headers = provider.getHeaders
    ? provider.getHeaders(apiKey)
    : {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      };

  const body = provider.buildBody(messages, model, systemPrompt);

  try {
    const res = await fetch(provider.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text();
      let errorMsg = `请求失败 (${res.status})`;

      // 尝试解析更友好的错误信息
      try {
        const errData = JSON.parse(errorText);
        if (errData.error?.message) errorMsg = errData.error.message;
        else if (errData.message) errorMsg = errData.message;
      } catch (e) {}

      // 常见错误的友好提示
      if (res.status === 401) errorMsg = 'API Key 无效，请检查是否正确';
      if (res.status === 429) errorMsg = '请求太频繁或额度不足，请稍后再试或检查余额';
      if (res.status === 404) errorMsg = '模型不存在或接口地址错误';

      throw new Error(errorMsg);
    }

    const data = await res.json();
    return provider.extractContent(data);

  } catch (err) {
    if (err.message.includes('Failed to fetch') || err.message.includes('CORS')) {
      throw new Error(
        '网络连接失败或存在 CORS 限制。\n' +
        '如果使用 OpenAI，可能需要配置代理。\n' +
        '推荐使用国内服务商（MiniMax / 智谱 / 通义千问）。'
      );
    }
    throw err;
  }
}

/**
 * 测试 API Key 是否有效
 */
async function testAPI(config) {
  try {
    const result = await callAI(
      [{ role: 'user', content: '你好，请回复"OK"' }],
      '你是一个简洁的助手。',
      config
    );
    return { ok: true, message: '配置成功！' };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

// ============================================================
// 导出（浏览器全局变量）
// ============================================================
window.SF_API = {
  PROVIDERS,
  getConfig,
  saveConfig,
  clearConfig,
  hasConfig,
  callAI,
  testAPI,
};
