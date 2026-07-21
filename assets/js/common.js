/* =========================================================
   common.js — 侧边栏渲染、当前时间、导航激活态
   ========================================================= */

(function (global) {
  'use strict';

  const NAV_ITEMS = [
    { key: 'home',         label: '主页',     href: 'index.html' },
    { key: 'announcements', label: '公告',     href: 'announcements.html' },
    { key: 'activities',   label: '活动',     href: 'activities.html' },
    { key: 'videos',       label: '视频',     href: 'videos.html' },
    { key: 'articles',     label: '文章',     href: 'articles.html' },
    { key: 'tools',        label: '工具',     href: 'tools.html' },
    { key: 'game',         label: '游戏',     href: 'games.html' },
    { key: 'updates',      label: '更新计划', href: 'updates.html' },
    { key: 'violations',   label: '违规公示', href: 'violations.html' },
  ];

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  function formatDateTime(d) {
    return d.getFullYear() + '.' +
      pad2(d.getMonth() + 1) + '.' +
      pad2(d.getDate()) +
      '<span class="weekday">(' + formatWeekday(d) + ')</span> ' +
      pad2(d.getHours()) + ':' +
      pad2(d.getMinutes()) + ':' +
      pad2(d.getSeconds());
  }

  const WEEKDAY_ZH = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  function formatWeekday(d) {
    return WEEKDAY_ZH[d.getDay()];
  }

  /**
   * 渲染侧边栏到容器中
   * @param {string} activeKey 当前页面 key
   */
  function renderSidebar(activeKey) {
    const host = document.getElementById('sidebar');
    if (!host) return;

    const navHTML = NAV_ITEMS.map(function (it) {
      const cls = it.key === activeKey ? 'sidebar__nav-item is-active' : 'sidebar__nav-item';
      return (
        '<a class="' + cls + '" href="' + it.href + '">' +
          '<span class="sidebar__nav-label">' + it.label + '</span>' +
        '</a>'
      );
    }).join('');

    host.innerHTML = (
      '<button class="sidebar__close" id="sidebarClose" aria-label="关闭侧边栏">×</button>' +
      '<div class="sidebar__brand">' +
        '<div class="sidebar__brand-zh">' +
          '<span>影顿</span>' +
          '<span>驿站</span>' +
        '</div>' +
      '</div>' +
      '<nav class="sidebar__nav">' + navHTML + '</nav>' +
      '<div class="sidebar__footer">' +
        '<span class="sidebar__time" id="sidebarTime">--.--.--(—) --:--:--</span>' +
        '<span class="sidebar__copy">© 2026 殷离影顿</span>' +
        '<span class="sidebar__copy">使用Trae AI中的MiniMax-M3模型搭建</span>' +
      '</div>'
    );

    startClock();
  }

  let clockTimer = null;
  function startClock() {
    const el = document.getElementById('sidebarTime');
    if (!el) return;
    const tick = function () {
      el.innerHTML = formatDateTime(new Date());
    };
    tick();
    if (clockTimer) clearInterval(clockTimer);
    clockTimer = setInterval(tick, 1000);
  }

  /**
   * 渲染主内容区头部（含侧边栏开关按钮）
   * @param {{title:string, hint?:string}} opts
   */
  function renderHeader(opts) {
    const host = document.getElementById('mainHeader');
    if (!host) return;
    host.innerHTML = (
      '<div class="main__header-left">' +
        '<button class="sidebar-toggle" id="sidebarToggle" aria-label="切换侧边栏">' +
          '<span></span><span></span><span></span>' +
        '</button>' +
        '<h1 class="main__title">' + ShadonData.escapeHTML(opts.title) + '</h1>' +
      '</div>' +
      (opts.hint ? '<div class="main__hint">' + ShadonData.escapeHTML(opts.hint) + '</div>' : '')
    );
  }

  // 站外跳转默认倒计时（秒）
  const EXTERNAL_COUNTDOWN_SECONDS = 3;

  /**
   * 侧边栏展开/收起（移动端 + 桌面均可用）
   * 状态持久化到 localStorage：shadon:sidebar:open
   *
   * 桌面端：默认显示，点击汉堡按钮可收起（滑出左侧），再点展开
   * 移动端：默认隐藏，点击汉堡按钮以遮罩形式展开
   */
  function initSidebarToggle() {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('sidebarToggle');
    const closeBtn = document.getElementById('sidebarClose');
    if (!sidebar || !toggleBtn) return;

    // 创建遮罩（移动端用）
    let mask = document.querySelector('.sidebar-mask');
    if (!mask) {
      mask = document.createElement('div');
      mask.className = 'sidebar-mask';
      document.body.appendChild(mask);
    }

    function isDesktop() {
      return window.matchMedia('(min-width: 768px)').matches;
    }

    function open() {
      sidebar.classList.add('is-open');
      if (!isDesktop()) {
        mask.classList.add('is-visible');
        document.body.classList.add('sidebar-open');
        document.body.classList.remove('sidebar-pinned');
      } else {
        mask.classList.remove('is-visible');
        document.body.classList.remove('sidebar-open');
        document.body.classList.add('sidebar-pinned');
      }
      toggleBtn.classList.add('is-open');
      try { localStorage.setItem('shadon:sidebar:open', '1'); } catch (_) {}
    }
    function close() {
      sidebar.classList.remove('is-open');
      mask.classList.remove('is-visible');
      document.body.classList.remove('sidebar-open');
      document.body.classList.remove('sidebar-pinned');
      toggleBtn.classList.remove('is-open');
      try { localStorage.setItem('shadon:sidebar:open', '0'); } catch (_) {}
    }
    function toggle() {
      if (sidebar.classList.contains('is-open')) close();
      else open();
    }

    toggleBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      toggle();
    });
    if (closeBtn) closeBtn.addEventListener('click', close);
    mask.addEventListener('click', close);

    // 移动端：点击侧边栏内任意导航项后自动隐藏（让出屏幕给主内容）
    const navItems = sidebar.querySelectorAll('.sidebar__nav-item');
    navItems.forEach(function (item) {
      item.addEventListener('click', function () {
        if (!isDesktop()) close();
      });
    });

    // 初始状态：
    // - 桌面端：默认展开（用户从未关闭过时）；仅在用户曾主动关闭时保持关闭
    // - 移动端：默认隐藏；仅在用户曾主动打开时显示
    let savedOpen = '';
    try { savedOpen = localStorage.getItem('shadon:sidebar:open') || ''; } catch (_) {}
    if (isDesktop()) {
      if (savedOpen !== '0') open(); // 首次访问或 saved='1'
    } else {
      if (savedOpen === '1') open();
    }

    // 视口变化时自适应
    const mq = window.matchMedia('(min-width: 768px)');
    function handleMQ() {
      // 切到桌面端：清掉移动端遮罩
      if (mq.matches) {
        mask.classList.remove('is-visible');
        document.body.classList.remove('sidebar-open');
      } else {
        // 切到移动端：未打开状态下隐藏
        const cur = (() => { try { return localStorage.getItem('shadon:sidebar:open') || '0'; } catch (_) { return '0'; } })();
        if (cur !== '1') {
          sidebar.classList.remove('is-open');
          mask.classList.remove('is-visible');
          document.body.classList.remove('sidebar-open');
          document.body.classList.remove('sidebar-pinned');
          toggleBtn.classList.remove('is-open');
        }
      }
    }
    if (mq.addEventListener) mq.addEventListener('change', handleMQ);
    else if (mq.addListener) mq.addListener(handleMQ);
  }

  /**
   * 渲染页面公共骨架
   * @param {string} activeKey
   * @param {{title:string, hint?:string}} header
   */
  function bootstrap(activeKey, header) {
    renderSidebar(activeKey);
    renderHeader(header);
    // 必须放在 renderHeader 之后：toggle 按钮在 mainHeader 里
    initSidebarToggle();
  }

  /**
   * 站外跳转确认弹窗（3 秒倒计时）
   * @param {string} url 目标 URL
   * @param {string} fromName 来自哪个栏目（用于提示语）
   */
  function externalConfirm(url, fromName) {
    // 已有则先移除
    const old = document.getElementById('externalConfirm');
    if (old) old.remove();

    // 直接打开确认弹窗
    openConfirm(url, fromName);
  }

  /**
   * 站点选择器：每个 item 支持多个站点时使用
   * @param {Array<{name:string, url:string}>} sites
   * @param {string} fromName 来源栏目名
   */
  function siteSelector(sites, fromName) {
    if (!sites || !sites.length) return;
    const old = document.getElementById('siteSelector');
    if (old) old.remove();

    const itemsHTML = sites.map(function (s) {
      const fullUrl = s.url || '';
      // 尝试从 URL 提取 host 作为名称兜底
      let hostText = fullUrl;
      try { hostText = new URL(fullUrl).host; } catch (_) {}
      return (
        '<button type="button" class="site-item" data-url="' + ShadonData.escapeHTML(fullUrl) + '">' +
          '<div class="site-item__name">' + ShadonData.escapeHTML(s.name || hostText) + '</div>' +
          '<div class="site-item__host">' + ShadonData.escapeHTML(fullUrl) + '</div>' +
        '</button>'
      );
    }).join('');

    const wrap = document.createElement('div');
    wrap.id = 'siteSelector';
    wrap.className = 'site-selector';
    wrap.innerHTML =
      '<div class="site-selector__mask" data-mask></div>' +
      '<div class="site-selector__panel" role="dialog" aria-modal="true">' +
        '<div class="site-selector__title">选择 ' + ShadonData.escapeHTML(fromName || '外部') + ' 站点</div>' +
        '<div class="site-selector__list">' + itemsHTML + '</div>' +
        '<div class="site-selector__actions">' +
          '<button type="button" class="btn" data-cancel>取消</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(wrap);

    function close() {
      wrap.remove();
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);

    wrap.querySelector('[data-mask]').addEventListener('click', close);
    wrap.querySelector('[data-cancel]').addEventListener('click', close);
    wrap.querySelectorAll('.site-item').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const url = btn.getAttribute('data-url');
        close();
        openConfirm(url, fromName);
      });
    });
  }

  /**
   * 实际打开确认弹窗（被 externalConfirm / siteSelector 复用）
   * @param {string} url
   * @param {string} fromName
   * @param {number} [seconds] 倒计时秒数（默认 EXTERNAL_COUNTDOWN_SECONDS）
   */
  function openConfirm(url, fromName, seconds) {
    let hostText = '';
    try {
      const u = new URL(url);
      hostText = u.host + (u.pathname === '/' ? '' : u.pathname) + (u.search || '') + (u.hash || '');
    } catch (_) {
      hostText = url;
    }

    const total = (typeof seconds === 'number' && seconds > 0) ? seconds : EXTERNAL_COUNTDOWN_SECONDS;
    let countdown = total;

    const wrap = document.createElement('div');
    wrap.id = 'externalConfirm';
    wrap.className = 'external-confirm';
    wrap.innerHTML =
      '<div class="external-confirm__mask" data-mask></div>' +
      '<div class="external-confirm__panel" role="dialog" aria-modal="true">' +
        '<div class="external-confirm__icon">↗</div>' +
        '<div class="external-confirm__title">即将离开影顿驿站</div>' +
        '<div class="external-confirm__desc">你即将前往外部页面\n无法确认该网页的安全性，请谨慎访问</div>' +
        '<div class="external-confirm__url">' + ShadonData.escapeHTML(hostText) + '</div>' +
        '<div class="external-confirm__actions">' +
          '<button type="button" class="btn" data-cancel>取消</button>' +
          '<button type="button" class="btn btn--primary" data-go disabled aria-disabled="true">继续访问 (' + total + '秒)</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(wrap);

    const goBtn = wrap.querySelector('[data-go]');
    const cancelBtn = wrap.querySelector('[data-cancel]');
    const mask = wrap.querySelector('[data-mask]');
    const tick = function () {
      countdown--;
      if (countdown <= 0) {
        clearInterval(timer);
        goBtn.disabled = false;
        goBtn.removeAttribute('aria-disabled');
        goBtn.textContent = '继续访问';
      } else {
        goBtn.textContent = '继续访问 (' + countdown + '秒)';
      }
    };
    const timer = setInterval(tick, 1000);

    function close() {
      clearInterval(timer);
      wrap.remove();
      document.removeEventListener('keydown', onKey);
    }

    function onKey(e) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('keydown', onKey);

    cancelBtn.addEventListener('click', close);
    mask.addEventListener('click', close);
    goBtn.addEventListener('click', function () {
      if (goBtn.disabled) return;
      close();
      window.open(url, '_blank', 'noopener,noreferrer');
    });
  }

  global.ShadonCommon = {
    bootstrap: bootstrap,
    renderSidebar: renderSidebar,
    renderHeader: renderHeader,
    externalConfirm: externalConfirm,
    siteSelector: siteSelector,
    NAV_ITEMS: NAV_ITEMS,
  };
})(window);
