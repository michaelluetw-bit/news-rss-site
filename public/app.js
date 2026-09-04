/**
 * 科技情報閱讀室 (Tech Intelligence Reading Room) - Site V1 Client App
 */

class TechDigestApp {
  constructor() {
    this.manifest = null;
    this.currentDigest = null;
    this.activeCategory = 'all';
    this.searchQuery = '';
    this.expandedTopics = new Set();
    this.allExpanded = false;
    this.dataBaseUrl = ''; // Determined dynamically during init

    this.init();
  }

  async init() {
    this.initTheme();
    this.bindEvents();
    await this.loadManifest();
  }

  // =========================================================================
  // Theme Management (Dark / Light)
  // =========================================================================
  initTheme() {
    const savedTheme = localStorage.getItem('tech_digest_theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = savedTheme || (prefersDark ? 'dark' : 'light');
    
    this.setTheme(theme);
  }

  setTheme(theme) {
    if (theme === 'light') {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    }
    localStorage.setItem('tech_digest_theme', theme);
  }

  toggleTheme() {
    const isDark = document.documentElement.classList.contains('dark');
    this.setTheme(isDark ? 'light' : 'dark');
  }

  // =========================================================================
  // Event Binding
  // =========================================================================
  bindEvents() {
    // 主題切換
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => this.toggleTheme());
    }

    // 搜尋輸入
    const searchInput = document.getElementById('search-input');
    const searchClear = document.getElementById('search-clear');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim().toLowerCase();
        if (searchClear) {
          searchClear.style.display = this.searchQuery ? 'flex' : 'none';
        }
        this.renderEventsStream();
      });
    }

    if (searchClear && searchInput) {
      searchClear.addEventListener('click', () => {
        searchInput.value = '';
        this.searchQuery = '';
        searchClear.style.display = 'none';
        searchInput.focus();
        this.renderEventsStream();
      });
    }

    // 展開/收合全部
    const toggleAllBtn = document.getElementById('toggle-all-btn');
    if (toggleAllBtn) {
      toggleAllBtn.addEventListener('click', () => {
        this.allExpanded = !this.allExpanded;
        toggleAllBtn.textContent = this.allExpanded ? '收合全部' : '展開全部';
        
        const allVisibleIds = this.getVisibleTopicIds();
        if (this.allExpanded) {
          allVisibleIds.forEach(id => this.expandedTopics.add(id));
        } else {
          this.expandedTopics.clear();
        }
        this.renderEventsStream();
      });
    }

    // 分類標籤切換
    const navButtons = document.querySelectorAll('.cat-tab');
    navButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const cat = btn.getAttribute('data-category');
        if (cat) {
          this.setCategory(cat);
        }
      });
    });

    // 歷史日期下拉切換
    const dateSelect = document.getElementById('date-select');
    if (dateSelect) {
      dateSelect.addEventListener('change', (e) => {
        const selectedDate = e.target.value;
        if (selectedDate) {
          this.loadDigestByDate(selectedDate);
        }
      });
    }

    // 鍵盤快捷鍵 (/ 聚焦搜尋, Esc 收合/清除)
    window.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== searchInput) {
        e.preventDefault();
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      } else if (e.key === 'Escape') {
        if (searchInput && document.activeElement === searchInput) {
          searchInput.blur();
        } else if (this.searchQuery) {
          this.searchQuery = '';
          if (searchInput) searchInput.value = '';
          if (searchClear) searchClear.style.display = 'none';
          this.renderEventsStream();
        } else if (this.expandedTopics.size > 0) {
          this.expandedTopics.clear();
          this.allExpanded = false;
          if (toggleAllBtn) toggleAllBtn.textContent = '展開全部';
          this.renderEventsStream();
        }
      }
    });
  }

  // =========================================================================
  // Data Fetching & Path Resolution
  // =========================================================================
  async loadManifest() {
    const candidatePaths = [
      './manifest.json',
      '../output/site/manifest.json',
      '/output/site/manifest.json'
    ];

    let manifestData = null;
    let successfulBase = '';

    for (const p of candidatePaths) {
      try {
        const res = await fetch(p);
        if (res.ok) {
          manifestData = await res.json();
          successfulBase = p.substring(0, p.lastIndexOf('/') + 1);
          break;
        }
      } catch (err) {
        // Continue trying next path
      }
    }

    if (!manifestData) {
      console.error('無法載入 manifest.json');
      this.renderError('無法載入日報清單，請確認靜態資源已成功匯出。');
      return;
    }

    this.manifest = manifestData;
    this.dataBaseUrl = successfulBase;

    this.populateDateSelect();
    const targetDate = this.manifest.latest_date;
    await this.loadDigestByDate(targetDate);
  }

  populateDateSelect() {
    const select = document.getElementById('date-select');
    if (!select || !this.manifest.available_dates) return;

    select.innerHTML = '';
    this.manifest.available_dates.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = `${d}${d === this.manifest.latest_date ? ' (最新)' : ''}`;
      select.appendChild(opt);
    });
  }

  async loadDigestByDate(dateStr) {
    const digestUrl = `${this.dataBaseUrl}digests/${dateStr}.json`;
    try {
      const res = await fetch(digestUrl);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      this.currentDigest = await res.json();
      this.expandedTopics.clear();
      this.allExpanded = false;
      
      const toggleAllBtn = document.getElementById('toggle-all-btn');
      if (toggleAllBtn) toggleAllBtn.textContent = '展開全部';

      this.renderAll();
    } catch (err) {
      console.error(`載入 ${dateStr} 日報失敗:`, err);
      this.renderError(`載入 ${dateStr} 日報失敗，請確認檔案是否存在。`);
    }
  }

  // =========================================================================
  // Rendering Flow
  // =========================================================================
  renderAll() {
    if (!this.currentDigest) return;

    this.renderHeaderMeta();
    this.renderHighlights();
    this.renderCategoryCounts();
    this.renderEventsStream();
    this.renderDeepReads();
    this.renderQualityReport();
  }

  renderHeaderMeta() {
    const dateEl = document.getElementById('header-date');
    const metaEl = document.getElementById('header-meta');
    const select = document.getElementById('date-select');

    if (dateEl) dateEl.textContent = this.currentDigest.meta.date;
    if (select) select.value = this.currentDigest.meta.date;

    if (metaEl) {
      const meta = this.currentDigest.meta;
      const quality = this.currentDigest.quality;
      
      let updateTimeStr = '';
      if (meta.generated_at) {
        try {
          const dt = new Date(meta.generated_at);
          updateTimeStr = dt.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
        } catch (e) {
          updateTimeStr = meta.generated_at.substring(11, 16);
        }
      }

      metaEl.innerHTML = `
        <span><strong>${meta.scanned_articles}</strong> 篇掃描</span>
        <span class="sep">·</span>
        <span><strong>${quality.source_count}</strong> 個來源</span>
        <span class="sep">·</span>
        <span><strong>${updateTimeStr}</strong> 更新</span>
        <span class="sep">·</span>
        <span><code>${meta.model}</code></span>
      `;
    }
  }

  renderHighlights() {
    const grid = document.getElementById('highlights-grid');
    if (!grid) return;

    const highlights = this.currentDigest.highlights || [];
    if (highlights.length === 0) {
      grid.innerHTML = '<div class="loading-card">今日尚無焦點事件</div>';
      return;
    }

    grid.innerHTML = highlights.map((item, idx) => {
      const rankStr = String(idx + 1).padStart(2, '0');
      const categoryLabel = this.getCategoryLabel(item.category);
      const firstSource = item.sources && item.sources.length > 0 ? item.sources[0].name : '';
      const freshnessBadge = item.freshness_status === 'background' 
        ? '<span class="badge-freshness background">背景資料</span>' 
        : '<span class="badge-freshness fresh">本日新知</span>';

      const firstBullet = item.summary_bullets && item.summary_bullets.length > 0 
        ? item.summary_bullets[0] 
        : (item.why_it_matters || '');

      return `
        <article class="highlight-card" data-cluster-id="${item.cluster_id}">
          <div class="highlight-rank">${rankStr}</div>
          <div class="highlight-body">
            <div class="highlight-meta-row">
              <span class="card-category-tag">${categoryLabel}</span>
              ${firstSource ? `<span class="card-source-tag">${this.escapeHtml(firstSource)}</span>` : ''}
              ${freshnessBadge}
            </div>
            <h3 class="highlight-title">
              <a href="${item.primary_url}" target="_blank" rel="noopener noreferrer">${this.escapeHtml(item.title)} ↗</a>
            </h3>
            <p class="highlight-summary">${this.escapeHtml(firstBullet)}</p>
            ${item.why_it_matters ? `
              <div class="highlight-why">
                <span class="why-badge">重要性</span>
                <span class="why-text">${this.escapeHtml(item.why_it_matters)}</span>
              </div>
            ` : ''}
          </div>
        </article>
      `;
    }).join('');
  }

  renderCategoryCounts() {
    let allCount = 0;
    const catCounts = {
      ai_research: 0,
      semiconductor_hardware: 0,
      software_cloud: 0,
      business_market: 0,
      deep_reads: (this.currentDigest.deep_reads || []).length
    };

    (this.currentDigest.sections || []).forEach(sec => {
      const cnt = (sec.items || []).length;
      catCounts[sec.id] = cnt;
      allCount += cnt;
    });

    const setBadge = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setBadge('count-all', allCount);
    setBadge('count-ai_research', catCounts.ai_research);
    setBadge('count-semiconductor_hardware', catCounts.semiconductor_hardware);
    setBadge('count-software_cloud', catCounts.software_cloud);
    setBadge('count-business_market', catCounts.business_market);
    setBadge('count-deep_reads', catCounts.deep_reads);
  }

  setCategory(category) {
    this.activeCategory = category;

    // Update tab classes
    document.querySelectorAll('.cat-tab').forEach(btn => {
      if (btn.getAttribute('data-category') === category) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    if (category === 'deep_reads') {
      const deepSec = document.getElementById('deep-reads-section');
      if (deepSec) {
        deepSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

    this.renderEventsStream();
  }

  getFilteredTopics() {
    if (!this.currentDigest || !this.currentDigest.sections) return [];

    let topics = [];
    if (this.activeCategory === 'all') {
      this.currentDigest.sections.forEach(sec => {
        topics.push(...(sec.items || []));
      });
    } else if (this.activeCategory === 'deep_reads') {
      return []; // Handled separately in Deep Reads section
    } else {
      const matchedSec = this.currentDigest.sections.find(s => s.id === this.activeCategory);
      if (matchedSec) {
        topics = [...(matchedSec.items || [])];
      }
    }

    if (this.searchQuery) {
      const q = this.searchQuery;
      topics = topics.filter(t => {
        const inTitle = (t.title || '').toLowerCase().includes(q);
        const inOrigTitle = (t.original_title || '').toLowerCase().includes(q);
        const inWhy = (t.why_it_matters || '').toLowerCase().includes(q);
        const inBullets = (t.summary_bullets || []).some(b => b.toLowerCase().includes(q));
        const inSources = (t.sources || []).some(s => s.name.toLowerCase().includes(q));
        return inTitle || inOrigTitle || inWhy || inBullets || inSources;
      });
    }

    return topics;
  }

  getVisibleTopicIds() {
    return this.getFilteredTopics().map(t => t.cluster_id);
  }

  renderEventsStream() {
    const container = document.getElementById('events-container');
    const emptyEl = document.getElementById('empty-results');
    if (!container) return;

    if (this.activeCategory === 'deep_reads') {
      container.innerHTML = '';
      if (emptyEl) emptyEl.style.display = 'none';
      return;
    }

    const topics = this.getFilteredTopics();

    if (topics.length === 0) {
      container.innerHTML = '';
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }

    if (emptyEl) emptyEl.style.display = 'none';

    container.innerHTML = topics.map(t => {
      const isExpanded = this.expandedTopics.has(t.cluster_id);
      const categoryLabel = this.getCategoryLabel(t.category);
      const firstSource = t.sources && t.sources.length > 0 ? t.sources[0].name : '';
      const sourceCount = t.sources ? t.sources.length : 1;
      const freshnessBadge = t.freshness_status === 'background'
        ? '<span class="badge-freshness background">背景資料</span>'
        : (t.freshness_status === 'fresh' ? '<span class="badge-freshness fresh">最新</span>' : '');

      const coreSummary = t.summary_bullets && t.summary_bullets.length > 0 
        ? t.summary_bullets[0] 
        : (t.why_it_matters || '無摘要說明');

      return `
        <article class="event-card" id="card-${t.cluster_id}">
          <div class="event-header-row">
            <div class="event-tags-wrap">
              <span class="card-category-tag">${categoryLabel}</span>
              ${firstSource ? `<span class="card-source-tag">${this.escapeHtml(firstSource)}${sourceCount > 1 ? ` 等 ${sourceCount} 來源` : ''}</span>` : ''}
              ${freshnessBadge}
              <span class="badge-quality">${t.primary_content_quality || 'extracted'}</span>
            </div>
            <span class="event-importance">${t.importance_score.toFixed(1)} / 10</span>
          </div>

          <h3 class="event-title">${this.escapeHtml(t.title)}</h3>

          <p class="event-core-summary">${this.escapeHtml(coreSummary)}</p>

          ${t.why_it_matters ? `
            <div class="event-why-box">
              <span class="why-badge">重要性</span>
              <span class="why-text">${this.escapeHtml(t.why_it_matters)}</span>
            </div>
          ` : ''}

          <div class="event-actions-bar">
            <button 
              class="toggle-details-btn" 
              onclick="app.toggleCard('${t.cluster_id}')"
              aria-expanded="${isExpanded}"
              aria-controls="drawer-${t.cluster_id}"
            >
              <span>${isExpanded ? '▲ 收起詳情' : '▼ 展開詳情'}</span>
            </button>
            <a href="${t.primary_url}" target="_blank" rel="noopener noreferrer" class="source-link-btn" aria-label="閱讀「${this.escapeHtml(t.title)}」原文">
              閱讀原文 ↗
            </a>
          </div>

          ${isExpanded ? this.renderExpandedDrawer(t) : ''}
        </article>
      `;
    }).join('');
  }

  renderExpandedDrawer(t) {
    const bulletsHtml = (t.summary_bullets || []).map(b => `<li>${this.escapeHtml(b)}</li>`).join('');
    const sourcesHtml = (t.sources || []).map(s => {
      let pubTime = '';
      if (s.published_at) {
        pubTime = s.published_at.substring(0, 10);
      }
      return `
        <a href="${s.url}" target="_blank" rel="noopener noreferrer" class="source-badge-link" aria-label="前往來源：${this.escapeHtml(s.name)}">
          ${this.escapeHtml(s.name)} ${pubTime ? `(${pubTime})` : ''} · ${s.content_quality} ↗
        </a>
      `;
    }).join('');

    return `
      <div id="drawer-${t.cluster_id}" class="event-details-drawer" role="region" aria-label="事件詳細內容">
        ${t.original_title ? `
          <div class="orig-title-wrap">
            <span class="details-subtitle">原始英文標題</span>
            <p class="orig-title-text">${this.escapeHtml(t.original_title)}</p>
          </div>
        ` : ''}

        <div class="bullets-wrap">
          <span class="details-subtitle">完整重點摘要</span>
          <ul class="bullets-list">
            ${bulletsHtml}
          </ul>
        </div>

        ${t.divergent_views ? `
          <div class="divergent-box">
            <span class="divergent-badge">觀點差異</span>
            <span>${this.escapeHtml(t.divergent_views)}</span>
          </div>
        ` : ''}

        <div class="sources-wrap">
          <span class="details-subtitle">報導與參照來源 (${(t.sources || []).length})</span>
          <div class="sources-list-wrap">
            ${sourcesHtml}
          </div>
        </div>
      </div>
    `;
  }

  toggleCard(clusterId) {
    if (this.expandedTopics.has(clusterId)) {
      this.expandedTopics.delete(clusterId);
    } else {
      this.expandedTopics.add(clusterId);
    }
    this.renderEventsStream();
  }

  renderDeepReads() {
    const grid = document.getElementById('deep-reads-grid');
    if (!grid) return;

    const deepReads = this.currentDigest.deep_reads || [];
    if (deepReads.length === 0) {
      grid.innerHTML = '<div class="loading-card">今日無精選深度長文</div>';
      return;
    }

    grid.innerHTML = deepReads.map(item => {
      const charCountStr = item.char_count ? `約 ${item.char_count.toLocaleString()} 字` : '';
      return `
        <article class="deep-read-card">
          <div class="deep-read-header">
            <span class="deep-read-source">${this.escapeHtml(item.source_name)}</span>
            <span class="deep-read-words">${charCountStr} ｜ <code>${item.content_quality}</code></span>
          </div>

          <h3 class="deep-read-title">${this.escapeHtml(item.title)}</h3>

          <div class="deep-read-why">
            <span class="why-badge deep-read-tag">推薦理由</span>
            <span class="why-text">${this.escapeHtml(item.why_read)}</span>
          </div>

          <div class="deep-read-footer">
            <a href="${item.url}" target="_blank" rel="noopener noreferrer" class="deep-read-btn">
              閱讀原文 ↗
            </a>
          </div>
        </article>
      `;
    }).join('');
  }

  renderQualityReport() {
    const q = this.currentDigest.quality || {};
    const meta = this.currentDigest.meta || {};

    const setText = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    let genTime = '-';
    if (meta.generated_at) {
      try {
        const dt = new Date(meta.generated_at);
        genTime = dt.toLocaleString('zh-TW', { hour12: false });
      } catch (e) {
        genTime = meta.generated_at;
      }
    }

    setText('stat-generated-at', genTime);
    setText('stat-model', meta.model || 'gemma3:12b');
    setText('stat-scanned', `${q.total_articles || meta.scanned_articles} 篇`);
    setText('stat-sources', `${q.source_count} 個`);
    setText('stat-topics', `${q.total_topics} 個`);
    setText('stat-stale', `${q.stale_candidates || 0} 篇`);
  }

  renderError(msg) {
    const grid = document.getElementById('highlights-grid');
    const events = document.getElementById('events-container');
    if (grid) grid.innerHTML = `<div class="loading-card" style="color: var(--accent-rose);">${this.escapeHtml(msg)}</div>`;
    if (events) events.innerHTML = '';
  }

  // =========================================================================
  // Helpers
  // =========================================================================
  getCategoryLabel(catId) {
    const map = {
      ai_research: 'AI / 模型',
      semiconductor_hardware: '半導體 / 硬體',
      software_cloud: '軟體 / Cloud',
      business_market: '市場與產業'
    };
    return map[catId] || catId;
  }

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

// 實例化全域 App
const app = new TechDigestApp();
