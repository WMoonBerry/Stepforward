#!/usr/bin/env node
// ============================================================
// StepForward · 部署验证脚本
// ============================================================
// 用法：node scripts/verify-deployment.mjs <部署URL>
// 示例：node scripts/verify-deployment.mjs https://stepforward-demo.netlify.app
// ============================================================

const baseUrl = process.argv[2];
if (!baseUrl) {
  console.error('用法：node scripts/verify-deployment.mjs <部署URL>');
  console.error('示例：node scripts/verify-deployment.mjs https://stepforward-demo.netlify.app');
  process.exit(1);
}

const PROXY_PATH = '/.netlify/functions/llm-proxy';
const results = [];

function check(name, pass, detail) {
  results.push({ name, pass: !!pass, detail: detail || '' });
  const icon = pass ? '✅' : '❌';
  console.log(`${icon} ${name}${detail ? '  [' + detail + ']' : ''}`);
}

async function run() {
  const url = baseUrl.replace(/\/$/, '');
  console.log(`\n验证目标：${url}`);
  console.log('='.repeat(50) + '\n');

  // ---- A1: 页面可访问 ----
  try {
    const res = await fetch(url);
    const html = await res.text();
    const hasStepForward = html.includes('StepForward');
    check('A1 页面可访问', res.ok && hasStepForward,
      `status=${res.status}, hasStepForward=${hasStepForward}`);
  } catch (e) {
    check('A1 页面可访问', false, e.message);
  }

  // ---- A5: 错误鉴权保护（非 deepseek 应返回 400）----
  try {
    const res = await fetch(url + PROXY_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'openai',
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'hi' }],
        systemPrompt: '',
        stream: false,
      }),
    });
    check('A5 非 DeepSeek 拒绝', res.status === 400, `status=${res.status}`);
  } catch (e) {
    check('A5 非 DeepSeek 拒绝', false, e.message);
  }

  // ---- A6: CORS 头存在 ----
  try {
    const res = await fetch(url + PROXY_PATH, { method: 'OPTIONS' });
    const cors = res.headers.get('Access-Control-Allow-Origin');
    check('A6 CORS 头存在', !!cors, `ACAO=${cors || '(missing)'}`);
  } catch (e) {
    check('A6 CORS 头存在', false, e.message);
  }

  // ---- A2: 非流式代理调用 ----
  let nonStreamOk = false;
  try {
    const res = await fetch(url + PROXY_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
        messages: [{ role: 'user', content: '请回复"OK"，两个字即可' }],
        systemPrompt: '你是一个简洁的测试助手。',
        options: {},
        stream: false,
      }),
    });
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    nonStreamOk = res.ok && content.length > 0;
    check('A2 非流式代理调用', nonStreamOk,
      `status=${res.status}, contentLen=${content.length}, preview="${content.slice(0, 30)}"`);

    // ---- A4: 思考模式已禁用（内容中无思考标签） ----
    const hasThinkingTag = content.includes('<think>') || content.includes('思考过程') || content.includes('reasoning');
    check('A4 思考模式已禁用', !hasThinkingTag,
      hasThinkingTag ? '检测到思考相关内容' : '内容干净，无思考输出');
  } catch (e) {
    check('A2 非流式代理调用', false, e.message);
    check('A4 思考模式已禁用', false, '无法验证（A2 失败）');
  }

  // ---- A3: 流式代理调用 ----
  try {
    const res = await fetch(url + PROXY_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
        messages: [{ role: 'user', content: '请回复"流式OK"' }],
        systemPrompt: '你是一个简洁的测试助手。',
        options: {},
        stream: true,
      }),
    });
    const contentType = res.headers.get('Content-Type') || '';
    const isSSE = contentType.includes('text/event-stream');
    let hasData = false;
    let hasDone = false;
    if (isSSE && res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let done = false;
      while (!done) {
        const chunk = await reader.read();
        done = chunk.done;
        buffer += decoder.decode(chunk.value || new Uint8Array(), { stream: true });
        if (buffer.includes('data: ')) hasData = true;
        if (buffer.includes('[DONE]')) hasDone = true;
        if (hasData && hasDone) break;
      }
    }
    check('A3 流式代理调用', res.ok && isSSE && hasData && hasDone,
      `status=${res.status}, contentType=${contentType}, hasData=${hasData}, hasDone=${hasDone}`);
  } catch (e) {
    check('A3 流式代理调用', false, e.message);
  }

  // ---- 汇总 ----
  console.log('\n' + '='.repeat(50));
  const passCount = results.filter(r => r.pass).length;
  const total = results.length;
  console.log(`\n结果：${passCount}/${total} 通过`);
  if (passCount === total) {
    console.log('🎉 部署验证全部通过！');
  } else {
    console.log('⚠️  部分项未通过，请检查上方详情。');
  }
  process.exit(passCount === total ? 0 : 1);
}

run().catch(e => {
  console.error('验证脚本运行出错:', e);
  process.exit(2);
});
