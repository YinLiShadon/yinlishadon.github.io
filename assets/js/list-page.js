/* =========================================================
   list-page.js — 公告 / 活动 / 视频 / 文章 / 工具 / 违规公示通用列表渲染
   ========================================================= */

(function (global) {
  'use strict';

  const SERIES_STORAGE_PREFIX = 'shadon:series:';
  const SERIES_DEFAULT_OPEN = true; // 默认展开

  /**
   * 渲染通用卡片列表
   * @param {Object} cfg
   * @param {string|Element} cfg.container 容器选择器或元素
   * @param {Array}  cfg.data 数据数组
   * @param {string} cfg.kind 'announcement' | 'activity' | 'video' | 'article' | 'tool' | 'violation'
   * @param {Object} [cfg.seriesDescriptions] 系列名 → 描述文本（仅 video / article 生效）
   */
  function render(cfg) {
    const host = typeof cfg.container === 'string'
      ? document.querySelector(cfg.container)
      : cfg.container;
    if (!host) return;
    const esc = ShadonData.escapeHTML;
    const data = cfg.data || [];

    // 渲染完成后清除 loading 类，避免 ::before 残留黑点
    host.classList.remove('loading');

    if (!data.length) {
      host.innerHTML = renderEmpty();
      return;
    }

    if (cfg.kind === 'video' || cfg.kind === 'article') {
      host.innerHTML = renderGrouped(data, cfg.kind, esc, cfg.seriesDescriptions || {});
    } else {
      host.innerHTML = renderFlat(data, cfg.kind, esc);
    }

    bindCardActions(host, cfg.kind);
    if (cfg.kind === 'video' || cfg.kind === 'article') {
      bindSeriesToggles(host, cfg.kind);
    }
  }

  function renderEmpty() {
    return (
      '<div class="empty">' +
        '<div class="empty__title">暂无内容</div>' +
        '<div class="empty__hint">该分类下还没有任何条目</div>' +
      '</div>'
    );
  }

  function renderFlat(data, kind, esc) {
    const cards = data.map(function (it) { return renderCard(it, kind, esc); }).join('');
    return '<section class="grid">' + cards + '</section>';
  }

  function renderGrouped(data, kind, esc, descMap) {
    // 按 series 分组，缺失归入「未分组」
    const groups = {};
    data.forEach(function (it) {
      const key = it.series || '未分组';
      if (!groups[key]) groups[key] = [];
      groups[key].push(it);
    });
    // 按 EP 升序排序
    Object.keys(groups).forEach(function (k) {
      groups[k].sort(function (a, b) {
        return (a.ep || '').localeCompare(b.ep || '', 'zh', { numeric: true });
      });
    });
    // 系列名排序
    const keys = Object.keys(groups).sort(function (a, b) {
      if (a === '未分组') return 1;
      if (b === '未分组') return -1;
      return a.localeCompare(b, 'zh');
    });

    return keys.map(function (k) {
      const items = groups[k];
      const cards = items.map(function (it) { return renderCard(it, kind, esc); }).join('');
      const desc = descMap[k] || '';
      const open = readSeriesState(kind, k);

      return (
        '<section class="series-block' + (open ? ' is-open' : '') + '" data-series="' + esc(k) + '">' +
          '<header class="series-block__head" role="button" tabindex="0" aria-expanded="' + (open ? 'true' : 'false') + '">' +
            '<div class="series-block__title">' +
              '<h2>' + esc(k) + '</h2>' +
              '<span class="series-block__count">共 ' + items.length + ' 条</span>' +
            '</div>' +
            '<span class="series-block__toggle" aria-hidden="true">' +
              '<svg viewBox="0 0 16 16" width="14" height="14"><path d="M3 6 L8 11 L13 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
            '</span>' +
          '</header>' +
          (desc ? '<div class="series-block__desc">' + esc(desc) + '</div>' : '') +
          '<div class="series-block__body">' +
            '<div class="grid">' + cards + '</div>' +
          '</div>' +
        '</section>'
      );
    }).join('');
  }

  function renderCard(it, kind, esc) {
    const cover = esc(it.cover || 'assets/images/cover.svg');
    const title = esc(it.title || '未命名');
    const description = esc(it.description || '');
    const externalUrl = (it.externalUrl || '').trim();
    const hasExternal = externalUrl && externalUrl !== '#';
    const externalSites = Array.isArray(it.externalSites) ? it.externalSites : null;
    const hasMultipleSites = externalSites && externalSites.length > 1;
    // 文案：有多个站点时显示「跳转外部 (X个)」，单个站点显示「跳转外部」
    const extLabel = hasMultipleSites ? '跳转外部 (' + externalSites.length + '个)' : '跳转外部';
    const KIND_NAME = { announcement: '公告', activity: '活动', video: '视频', article: '文章', tool: '工具', game: '游戏', violation: '违规公示' };
    const kindLabel = KIND_NAME[kind] || '外部网站';

    let epTag = '';
    if (it.ep) {
      epTag = '<span class="card__ep">' + esc(it.ep) + '</span>';
    }

    let seriesTag = '';
    if (it.series && kind !== 'video' && kind !== 'article') {
      seriesTag = '<span class="card__series">' + esc(it.series) + '</span>';
    }

    let metaHTML = '';
    if (kind === 'activity') {
      metaHTML = (
        '<div class="card__meta">' +
          '<div class="row"><span class="key">开始</span><span class="val">' + esc(it.startTime || '—') + '</span></div>' +
          '<div class="row"><span class="key">结束</span><span class="val">' + esc(it.endTime || '—') + '</span></div>' +
        '</div>'
      );
    } else if (kind === 'video' || kind === 'article') {
      metaHTML = (
        '<div class="card__meta">' +
          // 视频 / 文章：删除系列栏目（系列信息保留在详情页元数据中）
          (it.ep ? '<div class="row"><span class="key">编号</span><span class="val">' + esc(it.ep) + '</span></div>' : '') +
          '<div class="row"><span class="key">发布</span><span class="val">' + esc(it.publishTime || '—') + '</span></div>' +
          '<div class="row"><span class="key">更新</span><span class="val">' + esc(it.updateTime || '—') + '</span></div>' +
        '</div>'
      );
    } else if (kind === 'tool' || kind === 'game') {
      metaHTML = (
        '<div class="card__meta">' +
          (it.version ? '<div class="row"><span class="key">版本</span><span class="val">' + esc(it.version) + '</span></div>' : '') +
          '<div class="row"><span class="key">发布</span><span class="val">' + esc(it.publishTime || '—') + '</span></div>' +
          '<div class="row"><span class="key">更新</span><span class="val">' + esc(it.updateTime || '—') + '</span></div>' +
        '</div>'
      );
    } else if (kind === 'violation') {
      metaHTML = (
        '<div class="card__meta">' +
          '<div class="row"><span class="key">生效</span><span class="val">' + esc(it.punishStart || '—') + '</span></div>' +
          '<div class="row"><span class="key">到期</span><span class="val">' + esc(it.punishEnd || '—') + '</span></div>' +
        '</div>'
      );
    } else if (kind === 'announcement') {
      metaHTML = (
        '<div class="card__meta">' +
          '<div class="row"><span class="key">发布</span><span class="val">' + esc(it.publishTime || '—') + '</span></div>' +
        '</div>'
      );
    }

    // 违规公示额外展示「来源 / 处罚」字段
    let violationExtras = '';
    if (kind === 'violation') {
      violationExtras = (
        '<div class="card__extras">' +
          (it.source ? '<div class="card__extra"><span class="extra-label">来源</span><span class="extra-val">' + esc(it.source) + '</span></div>' : '') +
          (it.punishment ? '<div class="card__extra"><span class="extra-label">处罚</span><span class="extra-val">' + esc(it.punishment) + '</span></div>' : '') +
        '</div>'
      );
    }

    return (
      '<article class="card" data-id="' + esc(it.id || '') + '">' +
        '<div class="card__cover">' + epTag + '<img src="' + cover + '" alt="' + title + '" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src=\'assets/images/cover.svg\'"></div>' +
        '<div class="card__body">' +
          seriesTag +
          '<div class="card__title">' + title + '</div>' +
          // 基础信息（发布 / 更新 / 版本 / 系列）紧贴标题下方
          metaHTML +
          (description ? '<div class="card__desc">' + description + '</div>' : '') +
          // 违规公示：来源 / 处罚
          violationExtras +
          '<div class="card__actions">' +
            '<button type="button" class="btn js-detail">查看详情</button>' +
            (hasExternal || hasMultipleSites
              ? '<button type="button" class="btn btn--primary js-card-external" data-url="' + esc(externalUrl) + '" data-from="' + esc(kindLabel) + '">' + extLabel + '</button>'
              : '<button type="button" class="btn btn--primary" disabled aria-disabled="true" title="暂无链接">暂无链接</button>') +
          '</div>' +
        '</div>' +
      '</article>'
    );
  }

  function bindCardActions(host, kind) {
    const cards = host.querySelectorAll('.card');
    cards.forEach(function (card) {
      const id = card.getAttribute('data-id');
      const detailBtn = card.querySelector('.js-detail');
      if (detailBtn) {
        detailBtn.addEventListener('click', function () {
          openDetail(id, kind);
        });
      }
      const extBtn = card.querySelector('.js-card-external');
      if (extBtn) {
        extBtn.addEventListener('click', function () {
          const id = card.getAttribute('data-id');
          const data = getDataByKind(kind);
          const it = data.find(function (x) { return x.id === id; });
          const from = extBtn.getAttribute('data-from') || '外部网站';
          if (it && Array.isArray(it.externalSites) && it.externalSites.length > 1) {
            ShadonCommon.siteSelector(it.externalSites, from);
          } else {
            const url = extBtn.getAttribute('data-url') || '#';
            ShadonCommon.externalConfirm(url, from);
          }
        });
      }
    });
  }

  // 折叠 / 展开系列块，并记忆状态
  function bindSeriesToggles(host, kind) {
    const blocks = host.querySelectorAll('.series-block');
    blocks.forEach(function (block) {
      const head = block.querySelector('.series-block__head');
      const name = block.getAttribute('data-series') || '';
      const toggle = function () {
        const willOpen = !block.classList.contains('is-open');
        block.classList.toggle('is-open', willOpen);
        const btn = block.querySelector('.series-block__head');
        if (btn) btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        writeSeriesState(kind, name, willOpen);
      };
      if (head) {
        head.addEventListener('click', toggle);
        head.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
          }
        });
      }
    });
  }

  function seriesStorageKey(kind, name) {
    return SERIES_STORAGE_PREFIX + kind + ':' + name;
  }

  function readSeriesState(kind, name) {
    try {
      const v = localStorage.getItem(seriesStorageKey(kind, name));
      if (v === '0') return false;
      if (v === '1') return true;
    } catch (e) { /* 忽略 localStorage 错误 */ }
    return SERIES_DEFAULT_OPEN;
  }

  function writeSeriesState(kind, name, open) {
    try {
      localStorage.setItem(seriesStorageKey(kind, name), open ? '1' : '0');
    } catch (e) { /* 忽略 localStorage 错误 */ }
  }

  // 数据源（来自 window 全局缓存，避免重复 fetch）
  const KIND_DATA_MAP = {
    activity:     { source: function () { return window.__activities; },     name: '活动' },
    video:        { source: function () { return window.__videos; },         name: '视频' },
    article:      { source: function () { return window.__articles; },       name: '文章' },
    tool:         { source: function () { return window.__tools; },          name: '工具' },
    game:         { source: function () { return window.__games; },          name: '游戏' },
    violation:    { source: function () { return window.__violations; },     name: '违规公示' },
    announcement: { source: function () { return window.__announcements; },  name: '公告' },
  };

  function getDataByKind(kind) {
    const meta = KIND_DATA_MAP[kind];
    if (!meta) return [];
    return meta.source() || [];
  }

  function openDetail(id, kind) {
    const meta = KIND_DATA_MAP[kind];
    if (!meta || !meta.source()) return;
    const item = meta.source().find(function (it) { return it.id === id; });
    if (!item) return;

    const rows = [];
    if (kind === 'activity') {
      rows.push({ key: '开始', val: item.startTime });
      rows.push({ key: '结束', val: item.endTime });
    } else if (kind === 'video' || kind === 'article') {
      if (item.series) rows.push({ key: '系列', val: item.series });
      if (item.ep) rows.push({ key: '编号', val: item.ep });
      rows.push({ key: '发布', val: item.publishTime });
      rows.push({ key: '更新', val: item.updateTime });
    } else if (kind === 'tool' || kind === 'game') {
      if (item.version) rows.push({ key: '版本', val: item.version });
      rows.push({ key: '发布', val: item.publishTime });
      rows.push({ key: '更新', val: item.updateTime });
    } else if (kind === 'violation') {
      rows.push({ key: '生效', val: item.punishStart });
      rows.push({ key: '到期', val: item.punishEnd });
    } else if (kind === 'announcement') {
      // 公告：删除分类栏目（仅保留发布）
      if (item.publishTime) rows.push({ key: '发布', val: item.publishTime });
    }

    ShadonModal.open({
      title: item.title,
      cover: item.cover,
      description: item.description,
      rows: rows,
      // 违规公示专属：来源 / 处罚
      source: kind === 'violation' ? item.source : null,
      punishment: kind === 'violation' ? item.punishment : null,
      externalUrl: item.externalUrl,
      // 多站点选择器（游戏 / 工具等支持多链接的条目）
      externalSites: Array.isArray(item.externalSites) ? item.externalSites : null,
      // 工具 / 游戏专属：版本号
      version: (kind === 'tool' || kind === 'game') ? item.version : null,
      // 详情页跳转
      kind: kind,
      id: item.id,
    });
  }

  global.ShadonList = { render: render };
})(window);
