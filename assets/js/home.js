/* =========================================================
   home.js — 主页（站点介绍 + 个人介绍 + 联系方式）
   ========================================================= */

(function (global) {
  'use strict';

  async function init() {
    ShadonCommon.bootstrap('home', {
      title: '影顿驿站',
    });

    const host = document.getElementById('homeContent');
    if (!host) return;

    try {
      const profile = await ShadonData.loadJSON('assets/data/profile.json');
      // 渲染前清除 loading 类，避免 .loading::before 残留黑点
      host.classList.remove('loading');
      // profile.json 为空或解析失败时，data.js 已统一返回空数组/对象，按兜底渲染
      render(host, profile || {});
    } catch (err) {
      // 加载失败时按空数据兜底渲染
      host.classList.remove('loading');
      render(host, {});
    }
  }

  function render(host, p) {
    const esc = ShadonData.escapeHTML;
    const site = p.site || {};
    const person = p.person || {};

    const introHTML = (site.intro || []).map(function (line) {
      return '<p>' + esc(line) + '</p>';
    }).join('');

    const bioHTML = (person.bio || []).map(function (line) {
      return '<p>' + esc(line) + '</p>';
    }).join('');

    // 联系方式：仅对 http(s) 链接显示确认提示框；mailto 链接直接打开
    const contactsHTML = (person.contacts || []).map(function (c) {
      const value = esc(c.value || '');
      const link = esc(c.link || '#');
      const label = esc(c.label || '');
      const isExternal = /^https?:\/\//i.test(c.link || '');
      const dataAttr = isExternal
        ? ' data-js-contact data-url="' + link + '" data-from="' + label + '"'
        : '';
      const targetAttr = isExternal ? '' : ' target="_blank" rel="noopener noreferrer"';
      return (
        '<li>' +
          '<span class="label">' + label + '</span>' +
          '<a href="' + link + '"' + targetAttr + dataAttr + '>' + value + '</a>' +
        '</li>'
      );
    }).join('');

    host.innerHTML = (
      '<section class="home-section home-section--center">' +
        '<div class="home-section__label">站点介绍</div>' +
        '<h1 class="home-section__title">' + esc(site.tagline || site.nameZh || '影顿驿站') + '</h1>' +
        '<div class="home-section__body">' + introHTML + '</div>' +
      '</section>' +
      '<div class="home-section__divider"></div>' +
      '<section class="home-section home-section--center">' +
        '<div class="home-section__label">个人介绍</div>' +
        '<div class="person-card">' +
          '<div class="person-card__avatar">' +
            '<img src="' + esc(person.avatar || 'assets/images/avatar.svg') + '" alt="' + esc(person.nickname || '') + '">' +
          '</div>' +
          '<div>' +
            '<div class="person-card__name">' + esc(person.nickname || '') + '</div>' +
            (person.alias ? '<div class="person-card__alias">' + esc(person.alias) + '</div>' : '') +
            '<div class="person-card__bio">' + bioHTML + '</div>' +
            '<div class="person-card__contacts-title">联系方式</div>' +
            '<ul class="person-card__contacts">' + contactsHTML + '</ul>' +
          '</div>' +
        '</div>' +
      '</section>'
    );

    bindContactLinks(host);
  }

  // 联系方式外链：拦截点击，弹出确认提示框
  function bindContactLinks(host) {
    const links = host.querySelectorAll('a[data-js-contact]');
    links.forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        const url = a.getAttribute('data-url') || '#';
        const from = a.getAttribute('data-from') || '联系方式';
        if (typeof ShadonCommon !== 'undefined' && ShadonCommon.externalConfirm) {
          ShadonCommon.externalConfirm(url, from);
        } else {
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      });
    });
  }

  function renderError(msg) {
    return (
      '<div class="error">' +
        '<strong>数据加载失败</strong>' +
        '<small>' + ShadonData.escapeHTML(msg) + '</small>' +
      '</div>'
    );
  }

  global.ShadonHome = { init: init };
})(window);
