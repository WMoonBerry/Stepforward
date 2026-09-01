/**
 * StepForward 吉祥物模块
 * 提供5个虚线轮廓吉祥物（猫猫/狗狗/兔兔/小机器人/小考拉）
 * 用于加载等待场景，替代冰冷的 spinner
 */

const MASCOT_TYPES = ['cat', 'dog', 'rabbit', 'robot', 'koala'];

const MASCOT_LABELS = {
  cat: '猫猫',
  dog: '狗狗',
  rabbit: '兔兔',
  robot: '小机器人',
  koala: '小考拉'
};

const MASCOT_EMOJI = {
  cat: '🐱',
  dog: '🐶',
  rabbit: '🐰',
  robot: '🤖',
  koala: '🐨'
};

/**
 * 获取当前吉祥物类型（从 settings 读取，默认 cat）
 */
function getCurrentMascot() {
  const settings = getSettings();
  return settings.mascot || 'cat';
}

/**
 * 保存吉祥物类型到 settings
 */
function setMascot(type) {
  if (!MASCOT_TYPES.includes(type)) return;
  const settings = getSettings();
  settings.mascot = type;
  saveSettings(settings);
}

/**
 * 返回指定吉祥物的 SVG 虚线轮廓 HTML
 * 每个吉祥物用 path 描边，stroke-dasharray 做虚线手绘风
 */
function getMascotSVG(type) {
  const svgs = {
    cat: `<svg class="mascot-svg mascot-cat" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path class="mascot-body" d="M20 28 C20 22, 24 18, 32 18 C40 18, 44 22, 44 28 L44 40 C44 46, 40 50, 32 50 C24 50, 20 46, 20 40 Z" stroke-dasharray="4 3"/>
      <path class="mascot-ear-l" d="M22 22 L18 14 L26 18" stroke-dasharray="3 2"/>
      <path class="mascot-ear-r" d="M42 22 L46 14 L38 18" stroke-dasharray="3 2"/>
      <path class="mascot-tail" d="M44 36 C50 34, 52 30, 50 26" stroke-dasharray="3 2"/>
      <circle cx="27" cy="32" r="1.5" fill="currentColor" stroke="none"/>
      <circle cx="37" cy="32" r="1.5" fill="currentColor" stroke="none"/>
      <path d="M30 37 Q32 39 34 37" stroke-dasharray="2 1"/>
    </svg>`,
    dog: `<svg class="mascot-svg mascot-dog" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path class="mascot-body" d="M20 28 C20 22, 24 18, 32 18 C40 18, 44 22, 44 28 L44 42 C44 48, 40 52, 32 52 C24 52, 20 48, 20 42 Z" stroke-dasharray="4 3"/>
      <path class="mascot-ear-l" d="M20 24 C16 24, 14 30, 16 34 C18 36, 20 34, 22 30" stroke-dasharray="3 2"/>
      <path class="mascot-ear-r" d="M44 24 C48 24, 50 30, 48 34 C46 36, 44 34, 42 30" stroke-dasharray="3 2"/>
      <path class="mascot-tail" d="M44 40 C50 40, 52 36, 48 32" stroke-dasharray="3 2"/>
      <circle cx="27" cy="32" r="1.5" fill="currentColor" stroke="none"/>
      <circle cx="37" cy="32" r="1.5" fill="currentColor" stroke="none"/>
      <path d="M29 40 Q32 42 35 40" stroke-dasharray="2 1"/>
    </svg>`,
    rabbit: `<svg class="mascot-svg mascot-rabbit" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path class="mascot-ear-l" d="M26 20 C24 12, 22 6, 24 4 C26 6, 28 14, 28 20" stroke-dasharray="3 2"/>
      <path class="mascot-ear-r" d="M38 20 C40 12, 42 6, 40 4 C38 6, 36 14, 36 20" stroke-dasharray="3 2"/>
      <path class="mascot-body" d="M22 28 C22 24, 26 22, 32 22 C38 22, 42 24, 42 28 L42 40 C42 46, 38 50, 32 50 C26 50, 22 46, 22 40 Z" stroke-dasharray="4 3"/>
      <circle cx="27" cy="32" r="1.5" fill="currentColor" stroke="none"/>
      <circle cx="37" cy="32" r="1.5" fill="currentColor" stroke="none"/>
      <path d="M30 38 Q32 40 34 38" stroke-dasharray="2 1"/>
    </svg>`,
    robot: `<svg class="mascot-svg mascot-robot" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path class="mascot-antenna" d="M32 8 L32 14" stroke-dasharray="2 1"/>
      <circle cx="32" cy="6" r="2" fill="currentColor" stroke="none"/>
      <rect class="mascot-head" x="20" y="14" width="24" height="20" rx="4" stroke-dasharray="4 3"/>
      <circle cx="27" cy="22" r="2" fill="currentColor" stroke="none"/>
      <circle cx="37" cy="22" r="2" fill="currentColor" stroke="none"/>
      <path d="M27 28 L37 28" stroke-dasharray="2 1"/>
      <rect class="mascot-body" x="18" y="36" width="28" height="14" rx="2" stroke-dasharray="4 3"/>
      <circle class="mascot-wheel" cx="26" cy="52" r="4" stroke-dasharray="2 2"/>
      <circle class="mascot-wheel" cx="38" cy="52" r="4" stroke-dasharray="2 2"/>
    </svg>`,
    koala: `<svg class="mascot-svg mascot-koala" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <circle class="mascot-ear-l" cx="20" cy="20" r="5" stroke-dasharray="3 2"/>
      <circle class="mascot-ear-r" cx="44" cy="20" r="5" stroke-dasharray="3 2"/>
      <path class="mascot-body" d="M18 26 C18 22, 24 18, 32 18 C40 18, 46 22, 46 26 L46 40 C46 46, 42 50, 32 50 C22 50, 18 46, 18 40 Z" stroke-dasharray="4 3"/>
      <circle cx="27" cy="30" r="2" fill="currentColor" stroke="none"/>
      <circle cx="37" cy="30" r="2" fill="currentColor" stroke="none"/>
      <path d="M29 36 Q32 38 35 36" stroke-dasharray="2 1"/>
      <path class="mascot-arm-l" d="M18 34 C14 34, 12 38, 14 42" stroke-dasharray="2 2"/>
      <path class="mascot-arm-r" d="M46 34 C50 34, 52 38, 50 42" stroke-dasharray="2 2"/>
    </svg>`
  };
  return svgs[type] || svgs.cat;
}

/**
 * 返回完整加载UI HTML（吉祥物 + 文字）
 * @param {string} text - 加载提示文字
 * @param {string} [type] - 吉祥物类型，默认读取当前设置
 * @param {string} [size] - 尺寸：'normal'(48px) | 'small'(32px)
 */
function getMascotLoadingHTML(text, type, size) {
  type = type || getCurrentMascot();
  const sizeClass = size === 'small' ? 'mascot-container-sm' : '';
  return `<div class="mascot-container ${sizeClass}">
    ${getMascotSVG(type)}
    ${text ? `<span class="mascot-loading-text">${text}</span>` : ''}
  </div>`;
}

/**
 * 返回小尺寸吉祥物 HTML（用于聊天气泡内）
 */
function getMascotSmallHTML(text) {
  return getMascotLoadingHTML(text, null, 'small');
}

/**
 * 渲染设置页吉祥物选择器
 */
function renderMascotPicker() {
  const picker = $('#mascotPicker');
  if (!picker) return;
  const current = getCurrentMascot();
  picker.innerHTML = MASCOT_TYPES.map(type => `
    <div class="mascot-option ${type === current ? 'mascot-option-active' : ''}" data-mascot="${type}" onclick="selectMascot('${type}')">
      ${getMascotSVG(type)}
      <span class="mascot-option-label">${MASCOT_LABELS[type]}</span>
    </div>
  `).join('');
}

/**
 * 用户点击选择吉祥物
 */
function selectMascot(type) {
  setMascot(type);
  renderMascotPicker();
  showToast(`伙伴已切换为 ${MASCOT_LABELS[type]} ${MASCOT_EMOJI[type]}`, 'success');
}

window.MASCOT = {
  getCurrentMascot,
  setMascot,
  getMascotSVG,
  getMascotLoadingHTML,
  getMascotSmallHTML,
  renderMascotPicker,
  selectMascot,
  MASCOT_TYPES,
  MASCOT_LABELS
};
