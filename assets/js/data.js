/* =========================================================
   data.js — JSON 数据加载与缓存
   ========================================================= */

(function (global) {
  'use strict';

  const cache = new Map();

  /**
   * 加载 JSON 数据（同源 fetch，自动缓存）
   * @param {string} url 相对路径，如 'assets/data/activities.json'
   * @returns {Promise<any>} 加载或解析失败时统一返回空数组，避免上层报错
   */
  async function loadJSON(url) {
    if (cache.has(url)) return cache.get(url);
    let res;
    try {
      res = await fetch(url, { cache: 'no-cache' });
    } catch (e) {
      // 网络异常：缓存空数组，按空数据处理
      const fallback = [];
      cache.set(url, fallback);
      return fallback;
    }
    if (!res.ok) {
      // HTTP 错误（如 404）：缓存空数组，按空数据处理
      const fallback = [];
      cache.set(url, fallback);
      return fallback;
    }
    // 读取文本后再解析，兼容空文件与解析失败
    const text = await res.text();
    const trimmed = (text || '').trim();
    if (!trimmed) {
      const fallback = [];
      cache.set(url, fallback);
      return fallback;
    }
    let data;
    try {
      data = JSON.parse(trimmed);
    } catch (e) {
      // JSON 解析失败：缓存空数组，按空数据处理
      const fallback = [];
      cache.set(url, fallback);
      return fallback;
    }
    // 顶层为 null/undefined 时按空数组处理
    if (data == null) data = [];
    cache.set(url, data);
    return data;
  }

  /**
   * 简单转义，防止 HTML 注入
   */
  function escapeHTML(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  global.ShadonData = {
    loadJSON: loadJSON,
    escapeHTML: escapeHTML,
  };
})(window);
