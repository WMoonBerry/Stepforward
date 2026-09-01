// ============================================================
// StepForward · 主题管理模块
// 负责：主题切换、持久化、动态加载主题 CSS、meta theme-color 同步
// ============================================================

const THEME_KEY = 'stepforward_theme';
const THEME_MODE_KEY = 'stepforward_theme_mode';

// 夜间模式三态：跟随系统 / 浅色 / 深色
const SF_THEME_MODES = ['system', 'light', 'dark'];

// 系统深色偏好监听（跟随系统模式用）
const _systemDarkMQ = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
let _themeModeListener = null;

// 可用主题列表（default 使用 tokens-base.css 的 :root 默认值，无需额外 CSS）
const SF_THEMES = [
  { id: 'default',       name: '暖沙默认',  accent: '#C98B6B' },
  { id: 'lavender',      name: '薰衣草星夜', accent: '#9B7EBD' },
  { id: 'spring',        name: '春意盎然',  accent: '#6A9C72' },
  { id: 'mediterranean', name: '蔚蓝海洋',  accent: '#2E86AB' },
  { id: 'polar',         name: '极地冰川',  accent: '#29B6C8' },
  { id: 'rococo',        name: '洛可可宫廷', accent: '#C78D8B' },
];

// 已加载的主题 CSS link 映射（避免重复注入）
const _loadedThemeLinks = {};

/**
 * 获取当前保存的主题 ID
 * @returns {string} 主题 ID，默认 'default'
 */
function getTheme() {
  try {
    return localStorage.getItem(THEME_KEY) || 'default';
  } catch (e) {
    return 'default';
  }
}

/**
 * 动态加载主题 CSS 文件（仅非 default 主题需要）
 * @param {string} themeId - 主题 ID
 */
function _loadThemeCSS(themeId) {
  if (themeId === 'default') return;
  if (_loadedThemeLinks[themeId]) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `themes/theme-${themeId}.css`;
  document.head.appendChild(link);
  _loadedThemeLinks[themeId] = link;
}

/**
 * 应用指定主题
 * @param {string} name - 主题 ID（如 'default'、'lavender' 等）
 */
function setTheme(name) {
  // 确保 CSS 已加载
  _loadThemeCSS(name);

  // 设置 data-theme 属性（default 不设属性，使用 :root 默认值）
  if (name === 'default') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', name);
  }

  // 持久化
  try {
    localStorage.setItem(THEME_KEY, name);
  } catch (e) {
    console.warn('[setTheme] 保存主题失败:', e);
  }

  // 同步 meta theme-color
  const theme = SF_THEMES.find(t => t.id === name);
  if (theme) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', theme.accent);
    }
  }

  console.log('[setTheme] 主题已切换:', name);
}

/**
 * 渲染主题选择器色卡到指定容器
 * @param {HTMLElement} container - 目标容器（#themePicker）
 * @param {string} currentTheme - 当前选中的主题 ID
 */
function renderThemePicker(container, currentTheme) {
  if (!container) return;
  container.innerHTML = '';
  SF_THEMES.forEach(function(theme) {
    const card = document.createElement('div');
    card.className = 'theme-card' + (theme.id === currentTheme ? ' selected' : '');
    card.dataset.theme = theme.id;
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.title = theme.name;

    const swatch = document.createElement('div');
    swatch.className = 'theme-swatch';
    swatch.style.background = theme.accent;

    const label = document.createElement('div');
    label.className = 'theme-card-label';
    label.textContent = theme.name;

    card.appendChild(swatch);
    card.appendChild(label);

    // 点击切换（实时预览）
    card.addEventListener('click', function() {
      container.querySelectorAll('.theme-card').forEach(function(c) { c.classList.remove('selected'); });
      card.classList.add('selected');
      try { setTheme(theme.id); } catch (e) { console.warn('[themePicker] 切换失败:', e); }
    });
    card.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); }
    });

    container.appendChild(card);
  });
}

/**
 * 获取主题选择器中当前选中的主题 ID
 * @param {HTMLElement} container - 目标容器（#themePicker）
 * @returns {string} 选中的主题 ID，默认 'default'
 */
function getSelectedThemeFromPicker(container) {
  if (!container) return 'default';
  const selected = container.querySelector('.theme-card.selected');
  return selected ? selected.dataset.theme : 'default';
}

// ============================================================
// 夜间模式（三态）
// ============================================================

/**
 * 获取当前保存的夜间模式
 * @returns {string} 'system' | 'light' | 'dark'，默认 'system'
 */
function getThemeMode() {
  try {
    return localStorage.getItem(THEME_MODE_KEY) || 'system';
  } catch (e) {
    return 'system';
  }
}

/**
 * 移除系统深色偏好监听
 */
function _clearThemeModeListener() {
  if (_themeModeListener) {
    _systemDarkMQ.removeEventListener('change', _themeModeListener);
    _themeModeListener = null;
  }
}

/**
 * 根据模式计算应采用的 data-theme-mode 值
 * @param {string} mode - 'system' | 'light' | 'dark'
 * @returns {string} 'dark' | 'light'
 */
function _resolveThemeMode(mode) {
  if (mode === 'dark') return 'dark';
  if (mode === 'light') return 'light';
  // system：跟随系统偏好
  return _systemDarkMQ && _systemDarkMQ.matches ? 'dark' : 'light';
}

/**
 * 应用夜间模式到 <html data-theme-mode>，并同步 meta theme-color
 * @param {string} mode - 'system' | 'light' | 'dark'
 */
function applyThemeMode(mode) {
  const resolved = _resolveThemeMode(mode);
  if (resolved === 'dark') {
    document.documentElement.setAttribute('data-theme-mode', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme-mode');
  }

  // 同步 meta theme-color（深色用更深的底色，减少浏览器栏亮度过高）
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', resolved === 'dark' ? '#1E1A17' : '#FAF7F2');
  }

  // 跟随系统模式下监听系统变化
  _clearThemeModeListener();
  if (mode === 'system' && _systemDarkMQ) {
    _themeModeListener = function() { applyThemeMode('system'); };
    _systemDarkMQ.addEventListener('change', _themeModeListener);
  }
}

/**
 * 保存夜间模式并立即应用
 * @param {string} mode - 'system' | 'light' | 'dark'
 */
function setThemeMode(mode) {
  if (SF_THEME_MODES.indexOf(mode) < 0) mode = 'system';
  try {
    localStorage.setItem(THEME_MODE_KEY, mode);
  } catch (e) {
    console.warn('[setThemeMode] 保存夜间模式失败:', e);
  }
  applyThemeMode(mode);
  console.log('[setThemeMode] 夜间模式已切换:', mode);
}

/**
 * 渲染夜间模式三态选择按钮
 * @param {HTMLElement} container - 目标容器（#themeModePicker）
 * @param {string} currentMode - 当前选中的模式
 */
function renderThemeModePicker(container, currentMode) {
  if (!container) return;
  container.querySelectorAll('.theme-mode-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.themeMode === currentMode);
  });
}

/**
 * 获取夜间模式选择器中当前选中的模式
 * @param {HTMLElement} container - 目标容器（#themeModePicker）
 * @returns {string} 'system' | 'light' | 'dark'
 */
function getSelectedThemeMode(container) {
  if (!container) return 'system';
  const active = container.querySelector('.theme-mode-btn.active');
  return active ? active.dataset.themeMode : 'system';
}

/**
 * 模块初始化：应用已保存的主题与夜间模式
 */
function initTheme() {
  try { setTheme(getTheme()); } catch (e) { console.warn('[initTheme] 主题加载失败:', e); }
  applyThemeMode(getThemeMode());
}
