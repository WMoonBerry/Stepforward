// ============================================================
// StepForward · Netlify Function 代理（演示环境专用）
// ============================================================
// 作用：前端不再直连 DeepSeek，而是把请求发给本函数，
//       由函数注入服务端环境变量 DEEPSEEK_API_KEY 后转发。
//       API Key 只存在于 Netlify 环境变量中，永不暴露在前端。
//
// 部署要求：
//   1. 在 Netlify 后台设置环境变量 DEEPSEEK_API_KEY
//   2. 本文件位于 netlify/functions/ 目录，函数名为 llm-proxy
//   3. 前端调用路径：/.netlify/functions/llm-proxy
// ============================================================

const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/v1/chat/completions';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (data, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', ...extraHeaders },
  });

export default async (req) => {
  // CORS 预检
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method Not Allowed' }, 405);
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return json({ error: '服务端未配置 DEEPSEEK_API_KEY 环境变量' }, 500);
  }

  let payload;
  try {
    payload = await req.json();
  } catch (e) {
    return json({ error: '请求体格式错误' }, 400);
  }

  const { provider, model, messages, systemPrompt, options, stream } = payload;
  if (provider !== 'deepseek') {
    return json({ error: '演示环境仅支持 DeepSeek' }, 400);
  }

  // 构建 DeepSeek 请求体（镜像前端 buildBody，关闭思考模式防 token 浪费）
  const body = {
    model: model || 'deepseek-v4-flash',
    messages: [
      { role: 'system', content: systemPrompt || '' },
      ...(Array.isArray(messages) ? messages : []),
    ],
    temperature: 0.7,
    max_tokens: 4096,
    thinking: { type: 'disabled' },
  };
  if (options?.json) body.response_format = { type: 'json_object' };
  if (stream) body.stream = true;

  let upstream;
  try {
    upstream = await fetch(DEEPSEEK_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return json({ error: '无法连接 DeepSeek 服务，请稍后再试' }, 502);
  }

  // 上游错误：状态码与错误信息原样透传
  if (!upstream.ok) {
    const errText = await upstream.text();
    return new Response(errText, {
      status: upstream.status,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // 流式：SSE 透传
  if (stream) {
    return new Response(upstream.body, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }

  // 非流式：完整 JSON 透传
  const text = await upstream.text();
  return new Response(text, {
    status: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
};
