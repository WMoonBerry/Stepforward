// ============================================================
// StepForward · API 调用封装 v1.1
// ============================================================
// 支持的 AI 服务商（2026-08 更新）：
//   - deepseek   : DeepSeek (国内推荐，性价比高)
//   - minimax    : MiniMax (国内推荐，M2/M2.5)
//   - openai     : OpenAI (GPT-5.5 / GPT-5.5-mini)
//   - zhipu      : 智谱 AI (GLM-4.7-flash / GLM-4.6)
//   - qwen       : 通义千问 (qwen-plus / qwen-turbo / qwen3-max)
//   - anthropic  : Anthropic (Claude Sonnet 5)
//
// 全服务商关闭思考/推理模式（防止 token 消耗过多）：
//   - DeepSeek  : thinking: { type: 'disabled' }
//   - 通义千问  : enable_thinking: false（仅 Qwen3/QwQ 思考模型需要）
//   - OpenAI    : reasoning_effort: 'minimal'
//   - MiniMax / 智谱 / Anthropic : 所选模型本身无思考模式或默认不开启
// ============================================================

const PROVIDERS = {
  deepseek: {
    name: 'DeepSeek',
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    models: [
      { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro (推荐，能力更强)' },
      { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash (速度快，性价比高)' },
    ],
    defaultModel: 'deepseek-v4-flash',

    buildBody: (messages, model, systemPrompt, options) => {
      const body = {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        temperature: 0.7,
        max_tokens: 4096,
        // 显式关闭思考模式：思考链会占用 max_tokens 预算，
        // 过长时正式回复 content 会变成空字符串，导致拆解失败
        thinking: { type: 'disabled' },
      };
      if (options?.json) body.response_format = { type: 'json_object' };
      return body;
    },
    extractContent: (data) => data.choices?.[0]?.message?.content || '',
  },

  minimax: {
    name: 'MiniMax',
    // 2026 年起使用 api.minimaxi.com 的 OpenAI 兼容端点，abab 系列已淘汰
    endpoint: 'https://api.minimaxi.com/v1/chat/completions',
    models: [
      { id: 'MiniMax-M2.5', name: 'MiniMax M2.5 (推荐，能力更强)' },
      { id: 'MiniMax-M2', name: 'MiniMax M2 (性价比高)' },
    ],
    defaultModel: 'MiniMax-M2.5',
    buildBody: (messages, model, systemPrompt, options) => {
      const body = {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        temperature: 0.7,
        max_tokens: 4096,
      };
      if (options?.json) body.response_format = { type: 'json_object' };
      return body;
    },
    extractContent: (data) => data.choices?.[0]?.message?.content || '',
  },

  openai: {
    name: 'OpenAI',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    models: [
      { id: 'gpt-5.5-mini', name: 'GPT-5.5 mini (推荐，性价比高)' },
      { id: 'gpt-5.5', name: 'GPT-5.5 (能力更强)' },
    ],
    defaultModel: 'gpt-5.5-mini',
    buildBody: (messages, model, systemPrompt, options) => {
      const body = {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        // 注意：GPT-5.x 系列不支持 temperature 参数，故不传
        // 推理强度调到最低，等效关闭深度思考，省 token
        reasoning_effort: 'minimal',
        max_tokens: 4096,
      };
      if (options?.json) body.response_format = { type: 'json_object' };
      return body;
    },
    extractContent: (data) => data.choices?.[0]?.message?.content || '',
  },

  zhipu: {
    name: '智谱 AI',
    endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    models: [
      { id: 'glm-4.7-flash', name: 'GLM-4.7 Flash (免费档/速度快)' },
      { id: 'glm-4.6', name: 'GLM-4.6 (能力更强)' },
    ],
    defaultModel: 'glm-4.7-flash',
    buildBody: (messages, model, systemPrompt, options) => {
      const body = {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        temperature: 0.7,
        max_tokens: 4096,
      };
      if (options?.json) body.response_format = { type: 'json_object' };
      return body;
    },
    extractContent: (data) => data.choices?.[0]?.message?.content || '',
  },

  qwen: {
    name: '通义千问',
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    models: [
      { id: 'qwen-plus', name: 'Qwen Plus (推荐)' },
      { id: 'qwen-turbo', name: 'Qwen Turbo (速度快)' },
      { id: 'qwen3-max', name: 'Qwen3 Max (能力最强)' },
    ],
    defaultModel: 'qwen-plus',
    buildBody: (messages, model, systemPrompt, options) => {
      const body = {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        temperature: 0.7,
        max_tokens: 4096,
      };
      // 仅 Qwen3/QwQ 思考模型需要显式关闭思考模式；
      // 非思考模型传该参数可能报参数错误，故按模型名判断
      if (/^(qwen3|qwq)/i.test(model)) body.enable_thinking = false;
      if (options?.json) body.response_format = { type: 'json_object' };
      return body;
    },
    extractContent: (data) => data.choices?.[0]?.message?.content || '',
  },

  anthropic: {
    name: 'Anthropic',
    endpoint: 'https://api.anthropic.com/v1/messages',
    models: [
      { id: 'claude-sonnet-5-0630', name: 'Claude Sonnet 5 (推荐)' },
    ],
    defaultModel: 'claude-sonnet-5-0630',
    // Anthropic 的格式不同
    buildBody: (messages, model, systemPrompt) => ({
      model,
      system: systemPrompt,
      messages,
      temperature: 0.7,
      max_tokens: 4096,
    }),
    extractContent: (data) => data.content?.[0]?.text || '',
    getHeaders: (apiKey) => ({
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      // 浏览器直连必须携带此请求头，否则跨域请求会被拒绝
      'anthropic-dangerous-direct-browser-access': 'true',
    }),
  },
};

// ============================================================
// 配置管理（localStorage）
// ============================================================

const CONFIG_KEY = 'stepforward_config';

// 演示模式判定：本地开发（localhost/127.0.0.1/file://）走直连，
// 部署到 Netlify 等线上环境时走服务端代理，API Key 不暴露在前端
function isDemoMode() {
  try {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '') return false;
    if (window.location.protocol === 'file:') return false;
    return true;
  } catch (e) {
    return false;
  }
}

// 演示环境固定使用 DeepSeek Flash（Key 由服务端代理注入，此处仅为占位）
const DEMO_CONFIG = { provider: 'deepseek', model: 'deepseek-v4-flash', apiKey: 'demo' };

function getConfig() {
  if (isDemoMode()) return { ...DEMO_CONFIG };
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
  if (isDemoMode()) return true;
  return !!getConfig();
}

/**
 * 过期模型兜底：用户本地保存的旧模型名若已不在当前模型列表里，
 * 自动回退到该服务商的默认模型，避免 404
 * @param {Object} provider - 服务商配置
 * @param {string} model - 本地保存的模型名
 * @returns {string} 可用的模型名
 */
function resolveModel(provider, model) {
  if (model && provider.models.some(m => m.id === model)) return model;
  return provider.defaultModel;
}

// ============================================================
// 演示模式：通过 Netlify Function 代理调用（API Key 在服务端）
// ============================================================

const DEMO_PROXY_URL = '/.netlify/functions/llm-proxy';

/**
 * 演示模式非流式调用
 */
async function callDemoAI(messages, systemPrompt, config, options) {
  const provider = PROVIDERS[config.provider];
  if (!provider) throw new Error(`不支持的服务商: ${config.provider}`);
  const model = resolveModel(provider, config.model);

  let res;
  try {
    res = await fetch(DEMO_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: config.provider,
        model,
        messages,
        systemPrompt,
        options: options || {},
        stream: false,
      }),
    });
  } catch (e) {
    throw new Error('演示服务暂时不可用，请稍后再试');
  }

  if (!res.ok) {
    let errorMsg = `请求失败 (${res.status})`;
    try {
      const errData = await res.json();
      if (errData.error?.message) errorMsg = errData.error.message;
      else if (errData.error) errorMsg = errData.error;
    } catch (e) {}
    throw new Error(errorMsg);
  }

  const data = await res.json();
  return provider.extractContent(data);
}

/**
 * 演示模式流式调用（SSE 解析，代理返回 JSON 时自动兜底）
 */
async function callDemoAIStream(messages, systemPrompt, config, onChunk) {
  const provider = PROVIDERS[config.provider];
  if (!provider) throw new Error(`不支持的服务商: ${config.provider}`);
  const model = resolveModel(provider, config.model);

  let res;
  try {
    res = await fetch(DEMO_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: config.provider,
        model,
        messages,
        systemPrompt,
        options: {},
        stream: true,
      }),
    });
  } catch (e) {
    throw new Error('演示服务暂时不可用，请稍后再试');
  }

  if (!res.ok) {
    let errorMsg = `请求失败 (${res.status})`;
    try {
      const errData = await res.json();
      if (errData.error?.message) errorMsg = errData.error.message;
      else if (errData.error) errorMsg = errData.error;
    } catch (e) {}
    throw new Error(errorMsg);
  }

  // 代理返回 JSON（非流式兜底）时直接提取全文
  const contentType = res.headers.get('Content-Type') || '';
  if (contentType.includes('application/json')) {
    const data = await res.json();
    const text = provider.extractContent(data);
    if (text) onChunk(text);
    return text;
  }

  // 正常 SSE 解析（DeepSeek 为 OpenAI 兼容格式）
  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop();
    for (const part of parts) {
      for (const line of part.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') return fullText;
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta;
          if (delta?.content) {
            fullText += delta.content;
            onChunk(fullText);
          }
        } catch (e) {}
      }
    }
  }

  if (!fullText) throw new Error('演示服务返回为空，请稍后再试');
  return fullText;
}

// ============================================================
// 核心：调用 AI API
// ============================================================

/**
 * 调用 AI 聊天接口
 * @param {Array} messages - 对话历史，格式: [{role: 'user'|'assistant', content: '...'}]
 * @param {string} systemPrompt - System Prompt
 * @param {Object} config - 用户配置 { provider, apiKey, model }
 * @param {Object} options - 可选参数 { json: true 表示要求返回 JSON }
 * @returns {Promise<string>} - AI 的回应内容
 */
async function callAI(messages, systemPrompt, config, options) {
  if (!config) config = getConfig();
  if (!config) throw new Error('请先配置 API Key');
  if (isDemoMode()) return callDemoAI(messages, systemPrompt, config, options);

  const provider = PROVIDERS[config.provider];
  if (!provider) throw new Error(`不支持的服务商: ${config.provider}`);

  const model = resolveModel(provider, config.model);
  const apiKey = config.apiKey;
  if (!apiKey) throw new Error('API Key 为空');

  const headers = provider.getHeaders
    ? provider.getHeaders(apiKey)
    : {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      };

  const body = provider.buildBody(messages, model, systemPrompt, options);

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
 * 流式调用 AI（SSE，逐字输出）
 * 支持 OpenAI 兼容格式（DeepSeek/OpenAI/Qwen/MiniMax/Zhipu）和 Anthropic Claude
 * @param {Array} messages - 对话历史
 * @param {string} systemPrompt - System Prompt
 * @param {Object} config - 用户配置（可选，默认读取 localStorage）
 * @param {Function} onChunk - 每收到一段文本的回调 (fullText: string) => void
 * @returns {Promise<string>} 完整的 AI 回应内容
 */
async function callAIStream(messages, systemPrompt, config, onChunk) {
  if (!config) config = getConfig();
  if (!config) throw new Error('请先配置 API Key');
  if (!onChunk || typeof onChunk !== 'function') onChunk = () => {};
  if (isDemoMode()) return callDemoAIStream(messages, systemPrompt, config, onChunk);

  const provider = PROVIDERS[config.provider];
  if (!provider) throw new Error(`不支持的服务商: ${config.provider}`);

  const model = resolveModel(provider, config.model);
  const apiKey = config.apiKey;
  if (!apiKey) throw new Error('API Key 为空');

  const isAnthropic = config.provider === 'anthropic';
  const headers = provider.getHeaders
    ? provider.getHeaders(apiKey)
    : { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };

  // 构建请求体，增加 stream: true
  const body = provider.buildBody(messages, model, systemPrompt);
  body.stream = true;

  try {
    const res = await fetch(provider.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text();
      let errorMsg = `请求失败 (${res.status})`;
      try {
        const errData = JSON.parse(errorText);
        if (errData.error?.message) errorMsg = errData.error.message;
        else if (errData.message) errorMsg = errData.message;
      } catch (e) {}
      if (res.status === 401) errorMsg = 'API Key 无效，请检查是否正确';
      if (res.status === 429) errorMsg = '请求太频繁或额度不足，请稍后再试或检查余额';
      if (res.status === 404) errorMsg = '模型不存在或接口地址错误';
      throw new Error(errorMsg);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop();

      for (const part of parts) {
        if (isAnthropic) {
          // Anthropic Claude SSE 格式
          let eventType = '';
          let eventData = '';
          for (const line of part.split('\n')) {
            if (line.startsWith('event: ')) eventType = line.slice(7).trim();
            else if (line.startsWith('data: ')) eventData = line.slice(6);
          }
          if (!eventData) continue;
          try {
            const parsed = JSON.parse(eventData);
            if (eventType === 'content_block_delta' && parsed.delta?.type === 'text_delta' && parsed.delta?.text) {
              fullText += parsed.delta.text;
              onChunk(fullText);
            }
            if (eventType === 'message_stop') {
              return fullText;
            }
            if (eventType === 'error') {
              throw new Error(parsed.error?.message || 'Claude API error');
            }
          } catch (e) {
            if (e.message && !e.message.includes('JSON')) throw e;
          }
        } else {
          // OpenAI 兼容 SSE 格式
          for (const line of part.split('\n')) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') return fullText;
            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta;
              if (delta?.content) {
                fullText += delta.content;
                onChunk(fullText);
              }
            } catch (e) {}
          }
        }
      }
    }

    return fullText;
  } catch (err) {
    if (err.name === 'AbortError') return '';
    if (err.message.includes('Failed to fetch') || err.message.includes('CORS')) {
      throw new Error('网络连接失败或存在 CORS 限制。\n推荐使用国内服务商（MiniMax / 智谱 / 通义千问）。');
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
  isDemoMode,
  getConfig,
  saveConfig,
  clearConfig,
  hasConfig,
  resolveModel,
  callAI,
  callAIStream,
  testAPI,
};
