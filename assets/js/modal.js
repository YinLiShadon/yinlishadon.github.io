/* =========================================================
   modal.js — 详情弹窗
   ========================================================= */

(function (global) {
  'use strict';

  const KIND_LABEL = {
    announcement: '公告',
    activity: '活动',
    video: '视频',
    article: '文章',
    tool: '工具',
    game: '游戏',
    violation: '违规公示',
  };

  let currentDialog = null;

  function ensureRoot() {
    let root = document.getElementById('modalRoot');
    if (root) return root;
    root = document.createElement('div');
    root.id = 'modalRoot';
    document.body.appendChild(root);
    return root;
  }

  /**
   * 打开详情弹窗
   * @param {Object} cfg
   * @param {string} cfg.title 弹窗标题（条目名）
   * @param {string} [cfg.cover] 封面图 URL
   * @param {string} [cfg.description] 条目简介
   * @param {Array<{key:string,val:string}>} cfg.rows 元数据行
   * @param {string} [cfg.source] 违规公示：来源
   * @param {string} [cfg.punishment] 违规公示：处罚
   * @param {string} cfg.externalUrl 外部链接
   * @param {string} [cfg.kind] 类别 key（announcement/activity/video/...）
   * @param {string} [cfg.id] 条目 id
   */
  function open(cfg) {
    const root = ensureRoot();
    const esc = ShadonData.escapeHTML;
    const rowsHTML = (cfg.rows || []).map(function (r) {
      return (
        '<div class="modal__row">' +
          '<span class="key">' + esc(r.key) + '</span>' +
          '<span class="val">' + esc(r.val || '—') + '</span>' +
        '</div>'
      );
    }).join('');

    // 工具：版本号徽章
    const versionBadge = cfg.version
      ? '<span class="badge badge--version">版本 ' + esc(cfg.version) + '</span>'
      : '';

    const descHTML = cfg.description
      ? '<div class="modal__desc">' + esc(cfg.description) + '</div>'
      : '';

    // 违规公示专属：来源 + 处罚
    let extrasHTML = '';
    if (cfg.source || cfg.punishment) {
      extrasHTML = (
        '<div class="modal__extras">' +
          (cfg.source ? '<div class="modal__extra"><span class="extra-label">来源</span><div class="extra-text">' + esc(cfg.source) + '</div></div>' : '') +
          (cfg.punishment ? '<div class="modal__extra"><span class="extra-label">处罚</span><div class="extra-text">' + esc(cfg.punishment) + '</div></div>' : '') +
        '</div>'
      );
    }

    const coverHTML = cfg.cover
      ? '<div class="modal__cover"><img src="' + esc(cfg.cover) + '" alt="' + esc(cfg.title || '') + '" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src=\'assets/images/cover.svg\'"></div>'
      : '';

    // 详情页跳转按钮
    const kindLabel = KIND_LABEL[cfg.kind] || '详情';
    const detailHTML = (cfg.kind && cfg.id)
      ? '<a class="btn btn--block js-detail-page" href="detail.html?kind=' + encodeURIComponent(cfg.kind) + '&id=' + encodeURIComponent(cfg.id) + '">查看' + kindLabel + '详情</a>'
      : '';

    root.innerHTML = (
      '<div class="modal" id="modalEl">' +
        '<div class="modal__dialog" role="dialog" aria-modal="true">' +
          '<div class="modal__header">' +
            '<div class="modal__title-wrap">' +
              '<span class="modal__title">' + esc(cfg.title || '详情') + '</span>' +
              versionBadge +
            '</div>' +
            '<button class="modal__close" id="modalClose" aria-label="关闭">×</button>' +
          '</div>' +
          (coverHTML ? '<div class="modal__cover-wrap">' + coverHTML + '</div>' : '') +
          '<div class="modal__body">' +
            // 基础信息（发布 / 更新 / 版本 等）紧贴标题下方
            (rowsHTML ? '<div class="modal__rows">' + rowsHTML + '</div>' : '') +
            descHTML +
            extrasHTML +
          '</div>' +
          '<div class="modal__footer">' +
            detailHTML +
            '<button type="button" class="btn btn--primary" id="modalExternal">跳转外部网站</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );

    // 跳转外部按钮 → 单站确认 或 多站选择器
    const extBtn = document.getElementById('modalExternal');
    if (extBtn) {
      const rawUrl = (cfg.externalUrl || '').trim();
      const hasExternal = rawUrl && rawUrl !== '#';
      const name = KIND_LABEL[cfg.kind] || '外部网站';
      const sites = Array.isArray(cfg.externalSites) ? cfg.externalSites : null;
      const hasMultipleSites = sites && sites.length > 1;
      if (hasMultipleSites) {
        extBtn.textContent = '跳转外部 (' + sites.length + '个)';
      }
      // 无外部链接时禁用按钮，避免点击跳到 # 导致页面回到顶部
      if (!hasExternal && !hasMultipleSites) {
        extBtn.textContent = '暂无外部链接';
        extBtn.disabled = true;
        extBtn.setAttribute('aria-disabled', 'true');
        extBtn.classList.remove('btn--primary');
        extBtn.classList.add('btn--disabled');
      } else {
        extBtn.addEventListener('click', function () {
          if (hasMultipleSites) {
            ShadonCommon.siteSelector(sites, name);
          } else {
            ShadonCommon.externalConfirm(rawUrl, name);
          }
        });
      }
    }

    const el = document.getElementById('modalEl');
    const closeBtn = document.getElementById('modalClose');

    requestAnimationFrame(function () { el.classList.add('is-open'); });

    const close = function () {
      el.classList.remove('is-open');
      setTimeout(function () {
        if (root.firstChild) root.removeChild(root.firstChild);
        currentDialog = null;
      }, 200);
    };

    closeBtn.addEventListener('click', close);
    el.addEventListener('click', function (e) {
      if (e.target === el) close();
    });

    document.addEventListener('keydown', function escListener(e) {
      if (e.key === 'Escape') {
        close();
        document.removeEventListener('keydown', escListener);
      }
    });

    currentDialog = { close: close };
  }

  function close() {
    if (currentDialog) currentDialog.close();
  }

  global.ShadonModal = { open: open, close: close };
})(window);
