/* =========================================================
   detail.js — 详情独立页
   ========================================================= */

(function (global) {
  'use strict';

  const KIND_LIST_PAGE = {
    announcement: 'announcements.html',
    activity:     'activities.html',
    video:        'videos.html',
    article:      'articles.html',
    tool:         'tools.html',
    game:         'games.html',
    violation:    'violations.html',
  };

  const KIND_DATA_FILE = {
    announcement: 'assets/data/announcements.json',
    activity:     'assets/data/activities.json',
    video:        'assets/data/videos.json',
    article:      'assets/data/articles.json',
    tool:         'assets/data/tools.json',
    game:         'assets/data/games.json',
    violation:    'assets/data/violations.json',
  };

  const KIND_TITLE = {
    announcement: '公告',
    activity:     '活动',
    video:        '视频',
    article:      '文章',
    tool:         '工具',
    game:         '游戏',
    violation:    '违规公示',
  };

  function getQuery() {
    const out = {};
    const search = window.location.search.replace(/^\?/, '');
    if (!search) return out;
    search.split('&').forEach(function (kv) {
      if (!kv) return;
      const idx = kv.indexOf('=');
      const k = decodeURIComponent(idx >= 0 ? kv.slice(0, idx) : kv);
      const v = decodeURIComponent(idx >= 0 ? kv.slice(idx + 1) : '');
      out[k] = v;
    });
    return out;
  }

  async function init() {
    const host = document.getElementById('detailContent');
    if (!host) return;

    const q = getQuery();
    const kind = q.kind;
    const id = q.id;

    ShadonCommon.bootstrap(null, {
      title: '详情',
      hint: '单条目的独立详情页面',
    });

    if (!kind || !id || !KIND_DATA_FILE[kind]) {
      renderError(host, '参数缺失或类别无效，请通过列表页进入详情。');
      return;
    }

    try {
      const data = await ShadonData.loadJSON(KIND_DATA_FILE[kind]);
      const item = (data || []).find(function (it) { return it.id === id; });
      if (!item) {
        renderError(host, '未找到 ID 为「' + id + '」的' + (KIND_TITLE[kind] || '') + '条目。');
        return;
      }
      host.classList.remove('loading');
      render(host, kind, item);
      bindFullscreen();
      bindExternalConfirm();
    } catch (err) {
      renderError(host, err.message);
    }}

  function render(host, kind, item) {
    const esc = ShadonData.escapeHTML;
    const listPage = KIND_LIST_PAGE[kind] || 'index.html';
    const kindTitle = KIND_TITLE[kind] || '详情';

    const rows = buildRows(kind, item);

    // 标题区徽章（公告 / 系列 + EP / 工具与游戏版本号）
    let badges = '';
    if ((kind === 'video' || kind === 'article') && item.series) {
      // 视频 / 文章：删除系列徽章
      badges = '';
    } else if (kind === 'announcement') {
      // 公告：删除分类栏目
      badges = '';
    } else if ((kind === 'tool' || kind === 'game') && item.version) {
      badges = '<span class="badge badge--version">版本 ' + esc(item.version) + '</span>';
    }

    // 封面：更小（4:3，最大 320×240，左侧）
    const coverHTML = item.cover
      ? '<div class="detail__cover"><img src="' + esc(item.cover) + '" alt="' + esc(item.title) + '" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src=\'assets/images/cover.svg\'"></div>'
      : '<div class="detail__cover detail__cover--empty">暂无封面</div>';

    // 简介框
    const descHTML = item.description
      ? '<div class="detail__desc">' + esc(item.description) + '</div>'
      : '';

    // 违规公示专属：来源 + 处罚（更淡）
    const extrasHTML = (kind === 'violation' && (item.source || item.punishment))
      ? '<div class="detail__extras">' +
          (item.source ? '<div class="detail__extra"><span class="extra-label">来源</span><div class="extra-text">' + esc(item.source) + '</div></div>' : '') +
          (item.punishment ? '<div class="detail__extra"><span class="extra-label">处罚</span><div class="extra-text">' + esc(item.punishment) + '</div></div>' : '') +
        '</div>'
      : '';

    // 具体内容框（多段落）
    const contentHTML = item.content
      ? '<section class="detail__content">' +
          '<div class="detail__content-label">具体内容</div>' +
          '<div class="detail__content-body">' + renderParagraphs(item.content) + '</div>' +
        '</section>'
      : '';

    // 视频播放模块（仅 video 类型）
    const playerHTML = (kind === 'video') ? renderPlayer(item, esc) : '';
    // 在线使用 / 游玩模块（tool / game）
    const embedHTML = (kind === 'tool' || kind === 'game') ? renderEmbed(kind, item, esc) : '';

    // 基础信息：移至标题下方
    const rowsHTML = rows.length
      ? '<div class="detail__rows detail__rows--inline">' + rows.map(function (r) {
          return (
            '<div class="detail__row">' +
              '<span class="key">' + esc(r.key) + '</span>' +
              '<span class="val">' + esc(r.val || '—') + '</span>' +
            '</div>'
          );
        }).join('') + '</div>'
      : '';

    // 跳转外部按钮 → 站内弹窗确认 或 多站选择器
    const fromName = KIND_TITLE[kind] || '外部网站';
    const sites = Array.isArray(item.externalSites) ? item.externalSites : null;
    const rawUrl = (item.externalUrl || '').trim();
    const hasExternal = rawUrl && rawUrl !== '#';
    let externalHTML = '';
    if (sites && sites.length > 1) {
      const sitesJSON = encodeURIComponent(JSON.stringify(sites));
      externalHTML = '<button type="button" class="btn btn--primary js-external-multi" data-sites="' + sitesJSON + '" data-from="' + esc(fromName) + '">跳转外部网站 (' + sites.length + '个)</button>';
    } else if (hasExternal) {
      externalHTML = '<a class="btn btn--primary js-external" data-url="' + esc(rawUrl) + '" data-from="' + esc(fromName) + '" href="external.html?url=' + encodeURIComponent(rawUrl) + '&from=' + encodeURIComponent(fromName) + '" rel="noopener noreferrer">跳转外部网站</a>';
    } else {
      // 无外部链接：显示禁用占位按钮，避免布局跳动
      externalHTML = '<button type="button" class="btn btn--disabled" disabled aria-disabled="true" title="暂无外部链接">暂无外部链接</button>';
    }

    host.innerHTML = (
      '<div class="detail-wrap">' +
        '<a class="detail__back" href="' + listPage + '">← 返回' + kindTitle + '列表</a>' +
        '<article class="detail">' +
          // 头部：封面 + 标题 / 徽章 / 基础信息
          '<div class="detail__head">' +
            coverHTML +
            '<div class="detail__head-info">' +
              (badges ? '<div class="detail__badges">' + badges + '</div>' : '') +
              '<h1 class="detail__title">' + esc(item.title || '未命名') + '</h1>' +
              rowsHTML +
            '</div>' +
          '</div>' +
          // 主体（不再含基础信息行）
          '<div class="detail__body">' +
            descHTML +
            extrasHTML +
            contentHTML +
            playerHTML +
            embedHTML +
            (externalHTML ? '<div class="detail__actions">' + externalHTML + '</div>' : '') +
          '</div>' +
        '</article>' +
      '</div>'
    );
  }

  // 多段落：按 \n\n 切分，每个段落用 <p> 包裹
  function renderParagraphs(text) {
    return String(text).split(/\n{2,}/).map(function (p) {
      const safe = ShadonData.escapeHTML(p).replace(/\n/g, '<br>');
      return '<p>' + safe + '</p>';
    }).join('');
  }

  function buildRows(kind, item) {
    const rows = [];
    if (kind === 'activity') {
      if (item.startTime) rows.push({ key: '开始', val: item.startTime });
      if (item.endTime) rows.push({ key: '结束', val: item.endTime });
    } else if (kind === 'video' || kind === 'article') {
      // 视频 / 文章：删除系列栏目（仅保留编号 / 发布 / 更新）
      if (item.ep) rows.push({ key: '编号', val: item.ep });
      if (item.publishTime) rows.push({ key: '发布', val: item.publishTime });
      if (item.updateTime) rows.push({ key: '更新', val: item.updateTime });
    } else if (kind === 'tool' || kind === 'game') {
      if (item.version) rows.push({ key: '版本', val: item.version });
      if (item.publishTime) rows.push({ key: '发布', val: item.publishTime });
      if (item.updateTime) rows.push({ key: '更新', val: item.updateTime });
    } else if (kind === 'violation') {
      if (item.punishStart) rows.push({ key: '生效', val: item.punishStart });
      if (item.punishEnd) rows.push({ key: '到期', val: item.punishEnd });
    } else if (kind === 'announcement') {
      // 公告：删除分类栏目（仅保留发布）
      if (item.publishTime) rows.push({ key: '发布', val: item.publishTime });
    }
    return rows;
  }

  // 视频播放模块：自动识别 MP4 / 嵌入 URL
  function renderPlayer(item, esc) {
    const url = (item.videoUrl || '').trim();
    let body = '';

    if (!url) {
      // 无视频源时显示占位播放器
      body = (
        '<div class="player__placeholder">' +
          '<div class="player__placeholder-icon">▶</div>' +
          '<div class="player__placeholder-text">该视频暂未提供在线播放源</div>' +
          '<div class="player__placeholder-hint">可通过下方「跳转外部网站」按钮前往原始平台观看</div>' +
        '</div>'
      );
    } else if (/^(https?:)?\/\/.*(youtube\.com|youtu\.be|bilibili\.com|b23\.tv)/i.test(url)) {
      // 嵌入类链接：使用 iframe
      const embed = toEmbedUrl(url);
      body = '<div class="player__embed"><iframe src="' + esc(embed) + '" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>';
    } else {
      // 直链：使用 HTML5 <video>
      body = '<video class="player__video" controls preload="metadata" src="' + esc(url) + '"></video>';
    }

    return (
      '<section class="detail__player">' +
        '<div class="detail__content-label">视频播放</div>' +
        '<div class="player" data-player>' + body + renderFullscreenBtn() + '</div>' +
      '</section>'
    );
  }

  // 在线使用 / 游玩容器：iframe + 全屏按钮
  function renderEmbed(kind, item, esc) {
    const url = (item.externalUrl || '').trim();
    const label = (kind === 'game') ? '在线游玩' : '在线使用';
    let body = '';

    if (!url || url === '#') {
      body = (
        '<div class="player__placeholder">' +
          '<div class="player__placeholder-icon">' + (kind === 'game' ? '◆' : '⊞') + '</div>' +
          '<div class="player__placeholder-text">该' + (kind === 'game' ? '游戏' : '工具') + '暂未提供在线' + (kind === 'game' ? '游玩' : '使用') + '入口</div>' +
          '<div class="player__placeholder-hint">可通过下方「跳转外部网站」按钮前往</div>' +
        '</div>'
      );
    } else {
      body = '<div class="player__embed"><iframe src="' + esc(url) + '" frameborder="0" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" referrerpolicy="no-referrer"></iframe></div>';
    }

    return (
      '<section class="detail__player">' +
        '<div class="detail__content-label">' + label + '</div>' +
        '<div class="player" data-player>' + body + renderFullscreenBtn() + '</div>' +
      '</section>'
    );
  }

  function renderFullscreenBtn() {
    return '<button type="button" class="player__fullscreen" data-fullscreen aria-label="全屏">⛶</button>';
  }

  function toEmbedUrl(url) {
    try {
      const u = new URL(url);
      if (u.hostname.includes('youtube.com')) {
        const id = u.searchParams.get('v');
        if (id) return 'https://www.youtube.com/embed/' + id;
      }
      if (u.hostname === 'youtu.be') {
        const id = u.pathname.replace(/^\//, '');
        if (id) return 'https://www.youtube.com/embed/' + id;
      }
      if (u.hostname.includes('bilibili.com')) {
        const m = u.pathname.match(/\/video\/(BV[\w]+)/i);
        if (m) return 'https://player.bilibili.com/player.html?bvid=' + m[1] + '&autoplay=0';
      }
    } catch (e) { /* fallthrough */ }
    return url;
  }

  function renderError(host, msg) {
    host.classList.remove('loading');
    host.innerHTML = (
      '<div class="detail-wrap">' +
        '<div class="detail__back-wrap"><a class="detail__back" href="index.html">← 返回主页</a></div>' +
        '<div class="error"><strong>无法加载详情</strong><small>' + ShadonData.escapeHTML(msg) + '</small></div>' +
      '</div>'
    );
  }

  global.ShadonDetail = { init: init };

  // 全屏切换：把整个 .player 容器进入/退出全屏
  function bindFullscreen() {
    const btns = document.querySelectorAll('[data-fullscreen]');
    if (!btns.length) return;
    btns.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        const container = btn.closest('[data-player]');
        if (!container) return;
        if (document.fullscreenElement) {
          const exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
          if (exit) exit.call(document).catch(function () {});
        } else {
          const req = container.requestFullscreen || container.webkitRequestFullscreen || container.mozRequestFullScreen || container.msRequestFullscreen;
          if (req) req.call(container).catch(function () {});
        }
      });
    });
  }

  // 站外跳转确认：单站 → 确认弹窗；多站 → 站点选择器
  function bindExternalConfirm() {
    const singleBtns = document.querySelectorAll('.js-external');
    singleBtns.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        ShadonCommon.externalConfirm(
          btn.getAttribute('data-url') || '',
          btn.getAttribute('data-from') || '外部网站'
        );
      });
    });
    const multiBtns = document.querySelectorAll('.js-external-multi');
    multiBtns.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        let sites = [];
        try { sites = JSON.parse(decodeURIComponent(btn.getAttribute('data-sites') || '[]')); } catch (_) {}
        ShadonCommon.siteSelector(sites, btn.getAttribute('data-from') || '外部网站');
      });
    });
  }
})(window);
