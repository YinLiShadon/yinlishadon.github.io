/* =========================================================
   filter-sort.js — 列表页搜索 / 排序 / 「查看全部」弹窗
   依赖：ShadonData (escapeHTML / loadJSON)、ShadonList (render / openDetail)
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

  // 排序键与各 kind 的可用性
  // publishTime: 发布时间；updateTime: 更新时间；title: 名称；ep: 集数编号（EP>EX）
  const SORTABLE = {
    announcement: { publishTime: true, title: true },
    activity:     { publishTime: true, title: true }, // 取 startTime
    video:        { publishTime: true, updateTime: true, title: true, ep: true },
    article:      { publishTime: true, updateTime: true, title: true, ep: true },
    tool:         { publishTime: true, updateTime: true, title: true },
    game:         { publishTime: true, updateTime: true, title: true },
  };

  const SORT_LABEL = {
    publishTime: '发布时间',
    updateTime:  '更新时间',
    title:       '名称',
    ep:          '集数编号',
  };

  // 各 kind 取「发布时间」字段的取值函数
  function getPublishValue(it, kind) {
    if (kind === 'activity') return it.startTime || '';
    return it.publishTime || '';
  }
  function getUpdateValue(it) {
    return it.updateTime || '';
  }

  /**
   * EP 字符串排序键：[prefixRank, tailNum, tailStr]
   * 形如 EP01 / EX03 / EPπ 等；EP 永远在 EX 前面；同前缀按数字 asc
   */
  function epRank(ep) {
    const s = String(ep || '').trim().toUpperCase();
    const m = /^(EP|EX)(\d+)?/.exec(s);
    if (!m) return [9, 0, s];
    const prefixRank = m[1] === 'EP' ? 0 : 1;
    const tailNum = m[2] ? parseInt(m[2], 10) : -1;
    return [prefixRank, tailNum, m[2] || ''];
  }

  function compareEp(a, b) {
    const ra = epRank(a);
    const rb = epRank(b);
    if (ra[0] !== rb[0]) return ra[0] - rb[0];
    if (ra[1] !== rb[1]) return ra[1] - rb[1];
    return String(ra[2]).localeCompare(String(rb[2]), 'zh');
  }

  // 名称排序（中文）
  function compareTitle(a, b) {
    return String(a || '').localeCompare(String(b || ''), 'zh-Hans-CN');
  }

  // 时间字符串比较（YYYY.MM.DD HH:MM），含 ??:?? 排末尾
  function timeRank(t) {
    if (!t) return [9, t || ''];
    return [0, t];
  }
  function compareTime(a, b) {
    const ra = timeRank(a);
    const rb = timeRank(b);
    if (ra[0] !== rb[0]) return ra[0] - rb[0];
    return String(ra[1]).localeCompare(String(rb[1]));
  }

  // 关键词高亮：先 escape 原文本，再把 query 子串包成 <mark class="hl">
  function highlight(text, query) {
    const safe = ShadonData.escapeHTML(String(text == null ? '' : text));
    if (!query) return safe;
    const escQ = ShadonData.escapeHTML(String(query)).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return safe.replace(new RegExp('(' + escQ + ')', 'gi'), '<mark class="hl">$1</mark>');
  }

  function sortData(data, kind, sortKey, dir) {
    const list = data.slice();
    const mul = dir === 'asc' ? 1 : -1;
    list.sort(function (a, b) {
      let r = 0;
      if (sortKey === 'title') r = compareTitle(a.title, b.title);
      else if (sortKey === 'ep') r = compareEp(a.ep, b.ep);
      else if (sortKey === 'updateTime') r = compareTime(getUpdateValue(a), getUpdateValue(b));
      else r = compareTime(getPublishValue(a, kind), getPublishValue(b, kind));
      return r * mul;
    });
    return list;
  }

  // 搜索匹配：标题 / 描述 / 系列 / 版本（tool, game）/ 编号（video, article）
  function matchesQuery(it, kind, q) {
    if (!q) return true;
    const needle = q.toLowerCase();
    const fields = [it.title, it.description, it.series, it.version, it.ep];
    for (let i = 0; i < fields.length; i++) {
      if (fields[i] && String(fields[i]).toLowerCase().indexOf(needle) !== -1) return true;
    }
    return false;
  }

  function applySearch(data, kind, q) {
    if (!q) return data;
    return data.filter(function (it) { return matchesQuery(it, kind, q); });
  }

  // localStorage 读写
  function loadSortPref(kind) {
    try {
      const raw = localStorage.getItem('shadon:sort:' + kind);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== 'object') return null;
      return { key: obj.key || 'publishTime', dir: obj.dir === 'asc' ? 'asc' : 'desc' };
    } catch (_) { return null; }
  }
  function saveSortPref(kind, pref) {
    try { localStorage.setItem('shadon:sort:' + kind, JSON.stringify(pref)); } catch (_) {}
  }

  // 状态
  let state = {
    kind: null,
    container: null,
    data: [],
    seriesDescriptions: {},
    sort: { key: 'publishTime', dir: 'desc' },
    query: '',
  };

  function getContainer() {
    return typeof state.container === 'string'
      ? document.querySelector(state.container)
      : state.container;
  }

  /**
   * 入口：被 6 个列表页调用
   * @param {Object} opts
   * @param {string} opts.kind
   * @param {string|Element} opts.container
   * @param {Array} opts.data
   * @param {Object} [opts.seriesDescriptions]
   */
  function init(opts) {
    state.kind = opts.kind;
    state.container = opts.container;
    state.data = Array.isArray(opts.data) ? opts.data : [];
    state.seriesDescriptions = opts.seriesDescriptions || {};

    // 读取排序偏好；若不在当前 kind 的可用列表内，回退到默认
    const pref = loadSortPref(state.kind);
    if (pref && SORTABLE[state.kind] && SORTABLE[state.kind][pref.key]) {
      state.sort = pref;
    } else {
      state.sort = { key: 'publishTime', dir: 'desc' };
    }
    state.query = '';

    renderToolbar();
    renderCurrent();
  }

  function renderToolbar() {
    const host = getContainer();
    if (!host) return;

    // 工具栏容器（若已存在则替换）
    const oldBar = document.getElementById('listToolbar');
    if (oldBar) oldBar.remove();

    const bar = document.createElement('div');
    bar.className = 'list-toolbar';
    bar.id = 'listToolbar';

    // 搜索框
    const searchWrap = document.createElement('div');
    searchWrap.className = 'list-toolbar__search';
    searchWrap.innerHTML =
      '<span class="list-toolbar__search-icon" aria-hidden="true">' +
        '<svg viewBox="0 0 16 16" width="14" height="14"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M11 11 L14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>' +
      '</span>' +
      '<input type="search" class="list-toolbar__search-input js-search" placeholder="搜索 标题 / 简介 / 系列" autocomplete="off">' +
      '<button type="button" class="list-toolbar__search-clear js-search-clear" aria-label="清空搜索" hidden>×</button>';
    bar.appendChild(searchWrap);

    // 排序
    const sortWrap = document.createElement('div');
    sortWrap.className = 'list-toolbar__sort';
    const availableKeys = Object.keys(SORTABLE[state.kind] || {});
    const sortOptionsHTML = availableKeys.map(function (k) {
      const sel = (state.sort.key === k) ? ' selected' : '';
      return '<option value="' + k + '"' + sel + '>' + SORT_LABEL[k] + (state.sort.dir === 'desc' ? ' ↓' : ' ↑') + '</option>';
    }).join('');
    sortWrap.innerHTML =
      '<select class="list-toolbar__sort-select js-sort" aria-label="排序方式">' + sortOptionsHTML + '</select>' +
      '<button type="button" class="list-toolbar__sort-dir js-sort-dir" data-dir="' + state.sort.dir + '" aria-label="切换升降序"></button>';
    bar.appendChild(sortWrap);

    // 「查看全部」按钮（仅 video / article）
    if (state.kind === 'video' || state.kind === 'article') {
      const viewAll = document.createElement('button');
      viewAll.type = 'button';
      viewAll.className = 'list-toolbar__viewall js-viewall';
      viewAll.textContent = '查看全部' + KIND_LABEL[state.kind] + ' (共 ' + state.data.length + ' 条)';
      bar.appendChild(viewAll);
    }

    // 计数
    const count = document.createElement('span');
    count.className = 'list-toolbar__count js-count';
    count.textContent = '共 ' + state.data.length + ' 条';
    bar.appendChild(count);

    // 插入到 #listContent 之前
    host.parentNode.insertBefore(bar, host);

    bindToolbarEvents(bar);
  }

  function bindToolbarEvents(bar) {
    const searchInput = bar.querySelector('.js-search');
    const clearBtn = bar.querySelector('.js-search-clear');
    const sortSelect = bar.querySelector('.js-sort');
    const sortDir = bar.querySelector('.js-sort-dir');
    const viewAll = bar.querySelector('.js-viewall');

    if (searchInput) {
      let timer = null;
      const syncClearBtn = function () {
        if (clearBtn) clearBtn.hidden = !searchInput.value;
      };
      syncClearBtn();
      searchInput.addEventListener('input', function () {
        syncClearBtn();
        clearTimeout(timer);
        timer = setTimeout(function () {
          state.query = searchInput.value || '';
          renderCurrent();
        }, 80);
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        searchInput.value = '';
        state.query = '';
        clearBtn.hidden = true;
        renderCurrent();
        searchInput.focus();
      });
    }

    if (sortSelect) {
      sortSelect.addEventListener('change', function () {
        const newKey = sortSelect.value;
        const prevKey = state.sort.key;
        state.sort.key = newKey;
        // 首次切换到「集数编号」时，默认改为升序（EP01 → EP21 → EX 更自然）
        if (newKey === 'ep' && prevKey !== 'ep') {
          state.sort.dir = 'asc';
        }
        // 当切换时，把 desc 合并进 option 文本，重新生成
        saveSortPref(state.kind, state.sort);
        // 同步更新方向按钮的 data-dir（影响 ::before 箭头显示）
        if (sortDir) sortDir.setAttribute('data-dir', state.sort.dir);
        renderCurrent();
        // 更新 option 文本中的箭头
        const opts = sortSelect.querySelectorAll('option');
        opts.forEach(function (o) {
          const arrow = state.sort.dir === 'desc' ? ' ↓' : ' ↑';
          o.textContent = SORT_LABEL[o.value] + arrow;
        });
      });
    }

    if (sortDir) {
      sortDir.addEventListener('click', function () {
        state.sort.dir = state.sort.dir === 'desc' ? 'asc' : 'desc';
        sortDir.setAttribute('data-dir', state.sort.dir);
        saveSortPref(state.kind, state.sort);
        // 更新 select 各 option 的箭头
        if (sortSelect) {
          const opts = sortSelect.querySelectorAll('option');
          opts.forEach(function (o) {
            const arrow = state.sort.dir === 'desc' ? ' ↓' : ' ↑';
            o.textContent = SORT_LABEL[o.value] + arrow;
          });
        }
        renderCurrent();
      });
    }

    if (viewAll) {
      viewAll.addEventListener('click', function () {
        openViewAll(state.kind);
      });
    }
  }

  // 重新计算 data → 过滤 → 排序 → 渲染
  function renderCurrent() {
    const filtered = applySearch(state.data, state.kind, state.query.trim());
    const sorted = sortData(filtered, state.kind, state.sort.key, state.sort.dir);

    ShadonList.render({
      container: state.container,
      data: sorted,
      kind: state.kind,
      seriesDescriptions: state.seriesDescriptions,
      sort: state.sort,
      query: state.query.trim(),
    });

    // 计数更新
    const countEl = document.querySelector('#listToolbar .js-count');
    if (countEl) {
      const total = state.data.length;
      const shown = filtered.length;
      if (state.query) {
        countEl.textContent = '显示 ' + shown + ' / ' + total + ' 条';
      } else {
        countEl.textContent = '共 ' + total + ' 条';
      }
    }
  }

  // ============== 「查看全部」弹窗 ==============

  function openViewAll(kind) {
    if (!state.data || !state.data.length) return;

    // 移除已有
    const old = document.getElementById('allItemsModal');
    if (old) old.remove();

    const label = KIND_LABEL[kind] || '内容';
    const all = state.data;

    // 弹窗内独立的 sort 状态（沿用主工具栏的当前排序）
    const viewState = {
      sort: { key: state.sort.key, dir: state.sort.dir },
      query: '',
    };

    // 排序选项 HTML
    const availableKeys = Object.keys(SORTABLE[kind] || {});
    const sortOptionsHTML = availableKeys.map(function (k) {
      const sel = (viewState.sort.key === k) ? ' selected' : '';
      const arrow = viewState.sort.dir === 'desc' ? ' ↓' : ' ↑';
      return '<option value="' + k + '"' + sel + '>' + SORT_LABEL[k] + arrow + '</option>';
    }).join('');

    const wrap = document.createElement('div');
    wrap.id = 'allItemsModal';
    wrap.className = 'all-items-modal';
    wrap.innerHTML =
      '<div class="all-items-modal__mask" data-mask></div>' +
      '<div class="all-items-modal__panel" role="dialog" aria-modal="true">' +
        '<header class="all-items-modal__head">' +
          '<div class="all-items-modal__title">查看全部' + ShadonData.escapeHTML(label) + '（共 ' + all.length + ' 条）</div>' +
          '<div class="all-items-modal__sort">' +
            '<select class="all-items-modal__sort-select js-all-sort" aria-label="排序方式">' + sortOptionsHTML + '</select>' +
            '<button type="button" class="all-items-modal__sort-dir js-all-sort-dir" data-dir="' + viewState.sort.dir + '" aria-label="切换升降序"></button>' +
          '</div>' +
          '<button type="button" class="all-items-modal__close" data-close aria-label="关闭">×</button>' +
        '</header>' +
        '<div class="all-items-modal__search">' +
          '<input type="search" class="all-items-modal__input js-all-search" placeholder="在全部' + ShadonData.escapeHTML(label) + '中搜索…" autocomplete="off">' +
        '</div>' +
        '<div class="all-items-modal__body">' +
          '<ul class="all-items-modal__list js-all-list"></ul>' +
        '</div>' +
      '</div>';
    document.body.appendChild(wrap);

    // 首次渲染
    const listEl = wrap.querySelector('.js-all-list');
    renderAllRows(listEl, all, kind, '', viewState.sort);

    // 搜索
    const searchInput = wrap.querySelector('.js-all-search');
    let timer = null;
    searchInput.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        viewState.query = searchInput.value || '';
        renderAllRows(listEl, all, kind, viewState.query, viewState.sort);
      }, 80);
    });
    // 阻止弹窗内 input 触发外层（万一）搜索
    searchInput.addEventListener('keydown', function (e) { e.stopPropagation(); });
    searchInput.addEventListener('keypress', function (e) { e.stopPropagation(); });

    // 排序：字段切换
    const sortSelect = wrap.querySelector('.js-all-sort');
    const sortDir = wrap.querySelector('.js-all-sort-dir');
    if (sortSelect) {
      sortSelect.addEventListener('change', function () {
        viewState.sort.key = sortSelect.value;
        renderAllRows(listEl, all, kind, viewState.query, viewState.sort);
        // 更新 option 箭头
        const opts = sortSelect.querySelectorAll('option');
        opts.forEach(function (o) {
          const arrow = viewState.sort.dir === 'desc' ? ' ↓' : ' ↑';
          o.textContent = SORT_LABEL[o.value] + arrow;
        });
      });
    }
    if (sortDir) {
      sortDir.addEventListener('click', function () {
        viewState.sort.dir = viewState.sort.dir === 'desc' ? 'asc' : 'desc';
        sortDir.setAttribute('data-dir', viewState.sort.dir);
        renderAllRows(listEl, all, kind, viewState.query, viewState.sort);
        if (sortSelect) {
          const opts = sortSelect.querySelectorAll('option');
          opts.forEach(function (o) {
            const arrow = viewState.sort.dir === 'desc' ? ' ↓' : ' ↑';
            o.textContent = SORT_LABEL[o.value] + arrow;
          });
        }
      });
    }

    // 关闭
    function close() {
      wrap.remove();
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    wrap.querySelector('[data-mask]').addEventListener('click', close);
    wrap.querySelector('[data-close]').addEventListener('click', close);

    // 延迟聚焦搜索框（避免动画卡顿）
    setTimeout(function () { try { searchInput.focus(); } catch (_) {} }, 50);
  }

  function renderAllRows(listEl, all, kind, query, sort) {
    const esc = ShadonData.escapeHTML;
    const q = (query || '').trim().toLowerCase();
    const filtered = q
      ? all.filter(function (it) { return matchesQuery(it, kind, query); })
      : all;
    const sortKey = (sort && sort.key) || 'publishTime';
    const sortDir = (sort && sort.dir) || 'desc';
    const items = sortData(filtered, kind, sortKey, sortDir);

    if (!items.length) {
      listEl.innerHTML = '<li class="all-items-modal__empty">无匹配「' + esc(query) + '」的结果</li>';
      return;
    }

    const rowsHTML = items.map(function (it) {
      const cover = esc(it.cover || 'assets/images/cover.svg');
      const title = highlight(it.title || '未命名', query);
      const desc = it.description ? highlight(it.description, query) : '';
      const series = it.series ? '<span class="all-row__series">' + highlight(it.series, query) + '</span>' : '';
      const ep = it.ep ? '<span class="all-row__ep">' + highlight(it.ep, query) + '</span>' : '';

      let timeLine = '';
      if (kind === 'activity') {
        timeLine =
          '<span class="all-row__time">开始 ' + esc(it.startTime || '—') + '</span>' +
          '<span class="all-row__time">结束 ' + esc(it.endTime || '—') + '</span>';
      } else if (kind === 'video' || kind === 'article') {
        timeLine =
          '<span class="all-row__time">发布 ' + esc(it.publishTime || '—') + '</span>' +
          '<span class="all-row__time">更新 ' + esc(it.updateTime || '—') + '</span>';
      } else if (kind === 'tool' || kind === 'game') {
        timeLine =
          (it.version ? '<span class="all-row__time">版本 ' + esc(it.version) + '</span>' : '') +
          '<span class="all-row__time">发布 ' + esc(it.publishTime || '—') + '</span>' +
          '<span class="all-row__time">更新 ' + esc(it.updateTime || '—') + '</span>';
      } else if (kind === 'announcement') {
        timeLine = '<span class="all-row__time">发布 ' + esc(it.publishTime || '—') + '</span>';
      } else if (kind === 'violation') {
        timeLine =
          '<span class="all-row__time">生效 ' + esc(it.punishStart || '—') + '</span>' +
          '<span class="all-row__time">到期 ' + esc(it.punishEnd || '—') + '</span>';
      }

      return (
        '<li class="all-row" data-id="' + esc(it.id || '') + '">' +
          '<div class="all-row__cover"><img src="' + cover + '" alt="' + esc(it.title || '未命名') + '" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src=\'assets/images/cover.svg\'"></div>' +
          '<div class="all-row__main">' +
            '<div class="all-row__title">' + title + ep + '</div>' +
            (desc ? '<div class="all-row__desc">' + desc + '</div>' : '') +
            '<div class="all-row__meta">' + series + timeLine + '</div>' +
          '</div>' +
        '</li>'
      );
    }).join('');

    listEl.innerHTML = rowsHTML;

    // 绑定点击：关闭弹窗 → 打开详情
    const rows = listEl.querySelectorAll('.all-row');
    rows.forEach(function (row) {
      row.addEventListener('click', function () {
        const id = row.getAttribute('data-id');
        const wrap = document.getElementById('allItemsModal');
        if (wrap) wrap.remove();
        if (typeof ShadonList !== 'undefined' && ShadonList.openDetail) {
          ShadonList.openDetail(id, kind);
        }
      });
    });
  }

  global.ShadonFilter = {
    init: init,
    openViewAll: openViewAll,
    highlight: highlight,
    compareEp: compareEp,
    compareTitle: compareTitle,
    compareTime: compareTime,
    getPublishValue: getPublishValue,
    getUpdateValue: getUpdateValue,
  };
})(window);
