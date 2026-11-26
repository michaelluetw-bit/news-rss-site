(function () {
  'use strict';

  function safeUrl(value) {
    try {
      var url = new URL(String(value || ''), window.location.href);
      return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '#';
    } catch (e) {
      return '#';
    }
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function link(href, className, text, external) {
    var a = el('a', className, text);
    a.href = safeUrl(href);
    if (external) {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }
    return a;
  }

  function renderPoint(point, index) {
    var li = el('li', 'brief-point');
    var head = el('div', 'brief-point-head');
    head.appendChild(el('span', 'brief-point-num', String(index + 1)));
    head.appendChild(el('h2', 'brief-point-title', point.title));
    li.appendChild(head);
    li.appendChild(el('p', 'brief-point-text', point.text));
    var sources = el('ul', 'brief-sources');
    (point.sources || []).forEach(function (source) {
      var item = el('li');
      var a = link(source.url, 'brief-source', '', true);
      a.appendChild(el('span', 'brief-source-pub', source.publication));
      a.appendChild(document.createTextNode(source.title));
      item.appendChild(a);
      sources.appendChild(item);
    });
    li.appendChild(sources);
    return li;
  }

  function render(brief) {
    document.getElementById('brief-date').textContent = brief.date;
    document.getElementById('brief-lead').textContent = brief.lead;
    document.title = '早晨總結 ' + brief.date + '｜科技日報、科技晚報與台股雷達';

    var notes = document.getElementById('brief-notes');
    if (brief.notes && brief.notes.length) {
      notes.textContent = brief.notes.join(' ');
      notes.hidden = false;
    }

    var list = document.getElementById('brief-points');
    (brief.points || []).forEach(function (point, i) { list.appendChild(renderPoint(point, i)); });

    var editions = document.getElementById('brief-editions');
    (brief.editions || []).forEach(function (edition) {
      var li = el('li');
      var a = link(edition.url, 'brief-edition', '', /^https?:/.test(edition.url));
      a.appendChild(el('span', 'brief-edition-pub', edition.publication));
      a.appendChild(el('span', 'brief-edition-label', edition.label));
      li.appendChild(a);
      editions.appendChild(li);
    });

    var generated = new Date(brief.generated_at);
    var when = isNaN(generated) ? '' : generated.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false });
    document.getElementById('brief-meta').textContent = '產生時間 ' + when + '｜分析模型 ' + (brief.model || '-');
  }

  function showError() {
    document.getElementById('brief-lead').textContent = '今天的總結還沒產生，請先閱讀科技日報或台股雷達。';
  }

  document.getElementById('theme-toggle').addEventListener('click', function () {
    var root = document.documentElement;
    var next = root.classList.contains('dark') ? 'light' : 'dark';
    root.classList.remove('dark', 'light');
    root.classList.add(next);
    try { localStorage.setItem('tech_digest_theme', next); } catch (e) {}
  });

  fetch('./briefs/latest.json', { cache: 'no-cache' })
    .then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    })
    .then(render)
    .catch(showError);
})();
