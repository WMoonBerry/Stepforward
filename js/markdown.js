// ============================================================
// 轻量级 Markdown 渲染器（只处理常用格式）
// ============================================================
// 支持：**加粗**、*斜体*、换行、列表、链接
// ============================================================

function renderMarkdown(text) {
  if (!text) return '';

  // 先转义 HTML 特殊字符
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // **加粗**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // *斜体*
  html = html.replace(/\*([^*]+?)\*/g, '<em>$1</em>');

  // 换行转 <br>
  html = html.replace(/\n/g, '<br>');

  // 有序列表 1. xxx
  html = html.replace(/^(\d+)\.\s+(.+?)(<br>|$)/gm, '<li>$2</li>');

  // 无序列表 - xxx 或 * xxx
  html = html.replace(/^[-*]\s+(.+?)(<br>|$)/gm, '<li>$1</li>');

  // 包裹连续的 <li>
  html = html.replace(/(<li>.*?<\/li>)(<br>)?(<li>.*?<\/li>)/g, '$1$3');
  html = html.replace(/((?:<li>.*?<\/li>){2,})/g, '<ul style="margin:8px 0;padding-left:20px;">$1</ul>');

  return html;
}

// 导出
window.SF_Markdown = { renderMarkdown };
