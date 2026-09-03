// 仿真测试 applyScheduleFallback 新增的校验4/校验5（不修改任何产品代码）
import fs from 'fs';
const src = fs.readFileSync('js/app.js', 'utf8');
const start = src.indexOf('function applyScheduleFallback');
const end = src.indexOf('/**\n * 调用 AI');
if (start < 0 || end < 0 || end <= start) { console.error('EXTRACT_FAIL'); process.exit(1); }
// 间接 eval：在全局作用域注入函数声明（模块内直接 eval 受严格模式限制）
(0, eval)(src.slice(start, end));

// formatTime 桩：固定"当前时间"为 08:00（早于默认开始安排 09:00，便于测试）
global.formatTime = () => '08:00';

const settings = { workStart: '09:00', workEnd: '22:30', lunchStart: '12:00', lunchDuration: 90, dinnerStart: '18:00', dinnerDuration: 90 };

const mk = (name, time, date) => ({ parentTask: name, steps: [{ text: name, duration: 60, time, date: date || '2026-09-04' }] });
const run = (tasks, input) => { const p = { tasks: JSON.parse(JSON.stringify(tasks)) }; applyScheduleFallback(p, input, settings); return p.tasks; };

let pass = 0, fail = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + label + ' | got=' + JSON.stringify(got) + (ok ? '' : ' want=' + JSON.stringify(want)));
};

// 1. 普通任务 08:00（早于开始安排、无时间意图）→ 修正到 09:00
let t = run([mk('写报告', '08:00')], '写报告');
check('校验4-普通任务早于开始安排', [t[0].steps[0].time], ['09:00']);

// 2. 普通任务 23:00（晚于准备休息 22:30、无时间意图）→ 顺延次日 09:00
t = run([mk('写报告', '23:00')], '写报告');
check('校验5-晚于准备休息顺延次日', [t[0].steps[0].time, t[0].steps[0].date], ['09:00', '2026-09-05']);

// 3. 早餐任务 07:30 → 不修正（例外）
t = run([mk('吃早餐', '07:30')], '吃早餐');
check('例外-早餐不受开始安排限制', [t[0].steps[0].time], ['07:30']);

// 4. 个人护理任务 07:00 → 不修正（例外）
t = run([mk('刷牙洗脸', '07:00')], '刷牙洗脸');
check('例外-个人护理不受限制', [t[0].steps[0].time], ['07:00']);

// 5. 用户明确表达时间意图（"8点"）→ 不修正
t = run([mk('写报告', '08:00')], '8点写报告');
check('时间意图-用户指定8点保持', [t[0].steps[0].time], ['08:00']);

// 6. 用户说"现在"（校验3先生效为当前时间08:00，且校验4因时间意图跳过）
t = run([mk('写报告', '15:00')], '现在写报告');
check('时间意图-现在立即开始', [t[0].steps[0].time], ['08:00']);

// 7. 兼容旧版整数小时设置（workEnd: 18 → 视为 18:00）
t = run([mk('写报告', '23:00')], '写报告') && null;
const p2 = { tasks: JSON.parse(JSON.stringify([mk('写报告', '19:00')])) };
applyScheduleFallback(p2, '写报告', { workStart: 9, workEnd: 18, lunchStart: '12:00', lunchDuration: 90, dinnerStart: '18:00', dinnerDuration: 90 });
check('兼容-旧整数设置19:00>=18:00顺延', [p2.tasks[0].steps[0].time, p2.tasks[0].steps[0].date], ['09:00', '2026-09-05']);

// 8. 回归：吃饭任务仍在（校验1不受影响），且不被校验5误伤
t = run([mk('吃晚饭', '21:00')], '吃晚饭');
check('回归-晚饭任务归位不被截止', [t[0].steps[0].time], ['18:00']);

// 9. 回归：午休任务仍被推到午餐后（校验2不受影响）
const p3 = { tasks: [{ parentTask: '午睡', steps: [{ text: '午睡', duration: 30, time: '11:00', date: '2026-09-04' }] }] };
applyScheduleFallback(p3, '午睡', settings);
check('回归-午休推到午餐后', [p3.tasks[0].steps[0].time], ['13:30']);

// 10. 边界：恰好 09:00 开始 → 不修正；恰好 22:30 → 顺延
t = run([mk('写报告', '09:00')], '写报告');
check('边界-09:00不修正', [t[0].steps[0].time], ['09:00']);
t = run([mk('写报告', '22:30')], '写报告');
check('边界-22:30即截止顺延', [t[0].steps[0].time, t[0].steps[0].date], ['09:00', '2026-09-05']);

// 11. 守卫：准备休息早于开始安排（跨零点作息）→ 校验5跳过，不误顺延
t = run([mk('写报告', '23:00')], '写报告') && null;
const p4 = { tasks: JSON.parse(JSON.stringify([mk('写报告', '23:00')])) };
applyScheduleFallback(p4, '写报告', { workStart: '09:00', workEnd: '06:00', lunchStart: '12:00', lunchDuration: 90, dinnerStart: '18:00', dinnerDuration: 90 });
check('守卫-准备休息早于开始安排时校验5跳过', [p4.tasks[0].steps[0].time, p4.tasks[0].steps[0].date], ['23:00', '2026-09-04']);

console.log('\nRESULT: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail > 0 ? 1 : 0);
