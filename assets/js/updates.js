/* =========================================================
   updates.js — 更新计划页
   ========================================================= */

(function (global) {
  'use strict';

  const TYPE_LABEL = {
    video: '视频',
    article: '文章',
    activity: '活动',
    tool: '工具',
  };

  async function init() {
    ShadonCommon.bootstrap('updates', {
      title: '更新计划',
      hint: '仅供参考，以实际情况为准',
    });

    const host = document.getElementById('updatesContent');
    if (!host) return;

    try {
      const list = await ShadonData.loadJSON('assets/data/updates.json');
      host.classList.remove('loading');
      render(host, list || []);
    } catch (err) {
      // 加载/解析失败时按空数据处理，友好提示暂无内容
      host.classList.remove('loading');
      render(host, []);
    }
  }

  function render(host, list) {
    if (!list.length) {
      host.innerHTML = (
        '<div class="empty">' +
          '<div class="empty__title">暂无更新计划</div>' +
          '<div class="empty__hint">当前没有公开的更新条目。</div>' +
        '</div>'
      );
      return;
    }

    // 按 plannedAt 倒序
    const sorted = list.slice().sort(function (a, b) {
      return (b.plannedAt || '').localeCompare(a.plannedAt || '');
    });

    const esc = ShadonData.escapeHTML;
    const html = sorted.map(function (it) {
      const type = it.type || 'video';
      const label = TYPE_LABEL[type] || type;
      return (
        '<div class="update-item">' +
          '<span class="update-item__type" data-type="' + esc(type) + '">' + esc(label) + '</span>' +
          '<div>' +
            '<div class="update-item__title">' + esc(it.title || '未命名') + '</div>' +
            '<div class="update-item__content">' + esc(it.description || it.content || '') + '</div>' +
          '</div>' +
          '<div class="update-item__time">' +
            '<div class="update-item__time-label">预计更新时间</div>' +
            '<div class="update-item__time-value">' + esc(it.plannedAt || '—') + '</div>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    host.innerHTML = '<div class="update-list">' + html + '</div>';
  }

  function renderError(msg) {
    return (
      '<div class="empty">' +
        '<div class="empty__title">暂无更新计划</div>' +
        '<div class="empty__hint">当前没有公开的更新条目。</div>' +
      '</div>'
    );
  }

  global.ShadonUpdates = { init: init };
})(window);
