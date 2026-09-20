/* ==========================================================================
   夜市 (Yoichi) - Shops / Vendors Management Module (with Date Filters)
   ========================================================================== */

const ShopsModule = {
  currentFilter: 'all',

  init() {
    this.bindEvents();
    this.render();
  },

  bindEvents() {
    // 新規出店者追加ボタン
    document.getElementById('btn-add-shop')?.addEventListener('click', () => {
      this.openShopModal();
    });

    // 出店者保存フォーム
    document.getElementById('form-shop')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveShop();
    });

    // 削除ボタン
    document.getElementById('btn-delete-shop')?.addEventListener('click', (e) => {
      this.deleteShop(e);
    });

    // 期間別フィルタータブのイベントハンドラ
    document.querySelectorAll('[data-shop-filter]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('[data-shop-filter]').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.currentFilter = e.currentTarget.dataset.shop-filter || e.currentTarget.getAttribute('data-shop-filter');
        this.renderShopList();
      });
    });
  },

  render() {
    this.renderShopList();
    if (typeof MembersModule !== 'undefined' && MembersModule.renderPerformerList) {
      MembersModule.renderPerformerList();
    }
  },

  // eventNameテキストから日付を解析する
  parseDateFromEventName(eventName) {
    if (!eventName) return null;

    // 1. YYYY-MM-DD または YYYY/MM/DD
    let match = eventName.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (match) {
      return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
    }

    // 2. YYYY年MM月DD日
    match = eventName.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    if (match) {
      return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
    }

    // 3. MM月DD日 または MM/DD (年数は2026年と仮定)
    match = eventName.match(/(\d{1,2})月(\d{1,2})日/);
    if (match) {
      return new Date(2026, parseInt(match[1]) - 1, parseInt(match[2]));
    }

    match = eventName.match(/(\d{1,2})[-/](\d{1,2})/);
    if (match) {
      // 4桁西暦の一部でないことを確認
      const isPartofYear = eventName.match(/\d{4}[-/]\d{1,2}/);
      if (!isPartofYear) {
        return new Date(2026, parseInt(match[1]) - 1, parseInt(match[2]));
      }
    }

    // 4. YYYY年 (年初とする)
    match = eventName.match(/(\d{4})年?/);
    if (match) {
      return new Date(parseInt(match[1]), 0, 1);
    }

    return null;
  },

  // 出店時期を分類する (今日: 2026-08-21)
  getShopPeriod(shop) {
    const today = new Date('2026-08-21'); // ポータルの基準日時
    let shopDate = null;

    // 1. 正式な出店日フィールド(eventDate)がある場合
    if (shop.eventDate) {
      const parsed = new Date(shop.eventDate);
      if (!isNaN(parsed.getTime())) {
        shopDate = parsed;
      }
    }

    // 2. なければeventNameテキストから解析
    if (!shopDate && shop.eventName) {
      shopDate = this.parseDateFromEventName(shop.eventName);
    }

    if (!shopDate) {
      return 'older'; // 日付不明は「それ以前/他」に分類
    }

    // 日数の差分を計算
    const diffTime = today.getTime() - shopDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays >= 0 && diffDays <= 30) {
      return '1month'; // 過去1ヶ月以内
    } else if (diffDays >= 0 && diffDays <= 365) {
      return '1year'; // 過去1年以内
    } else {
      return 'older'; // それ以前 (未来の日付も便宜上こちらか、他へ)
    }
  },

  renderShopList() {
    const container = document.getElementById('shops-grid-container');
    if (!container) return;
    container.innerHTML = '';

    const shops = window.appStore.data.shopList || [];

    // 各フィルターの件数を計算
    let countAll = 0;
    let count1month = 0;
    let count1year = 0;
    let countOlder = 0;

    const shopsWithPeriod = shops.map(shop => {
      const period = this.getShopPeriod(shop);
      countAll++;
      if (period === '1month') {
        count1month++;
        count1year++; // 1ヶ月以内は1年以内にも含まれる
      } else if (period === '1year') {
        count1year++;
      } else {
        countOlder++;
      }
      return { shop, period };
    });

    // フィルターのバッジ件数を更新
    const countAllEl = document.getElementById('shop-count-all');
    const count1monthEl = document.getElementById('shop-count-1month');
    const count1yearEl = document.getElementById('shop-count-1year');
    const countOlderEl = document.getElementById('shop-count-older');

    if (countAllEl) countAllEl.textContent = countAll;
    if (count1monthEl) count1monthEl.textContent = count1month;
    if (count1yearEl) count1yearEl.textContent = count1year;
    if (countOlderEl) countOlderEl.textContent = countOlder;

    // フィルター適用
    const filteredShops = shopsWithPeriod.filter(item => {
      if (this.currentFilter === 'all') return true;
      if (this.currentFilter === '1month') return item.period === '1month';
      if (this.currentFilter === '1year') return item.period === '1month' || item.period === '1year';
      if (this.currentFilter === 'older') return item.period === 'older';
      return true;
    });

    if (filteredShops.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-muted);">
          該当する出店者が登録されていません。
        </div>
      `;
      return;
    }

    filteredShops.forEach(item => {
      const shop = item.shop;
      const period = item.period;
      const card = document.createElement('div');
      card.className = 'shop-card';
      
      const catColor = Utils.stringToColor(shop.category);
      card.style.borderTop = `4px solid ${catColor}`;

      // 期間バッジの生成
      let periodBadgeHtml = '';
      if (period === '1month') {
        periodBadgeHtml = '<span class="shop-period-badge badge-recent">直近 (1ヶ月以内)</span>';
      } else if (period === '1year') {
        periodBadgeHtml = '<span class="shop-period-badge badge-year">過去1年以内</span>';
      } else {
        periodBadgeHtml = '<span class="shop-period-badge badge-older">それ以前 / 他</span>';
      }

      card.innerHTML = `
        <div class="shop-card-header">
          <div>
            <h4 class="shop-name-title">${Utils.escapeHtml(shop.name)}</h4>
            <div style="margin-top: 0.35rem; display: flex; gap: 0.35rem; flex-wrap: wrap;">
              <span class="badge" style="background-color: ${catColor}15; color: ${catColor}; font-weight: 700; border: 1px solid ${catColor}20;">
                ${Utils.escapeHtml(shop.category)}
              </span>
              ${periodBadgeHtml}
            </div>
          </div>
        </div>
        <div class="shop-card-body">
          <div class="shop-info-row">
            <span class="info-label">出店イベント:</span>
            <span class="info-value"><strong>${Utils.escapeHtml(shop.eventName || '記録なし')}</strong></span>
          </div>
          ${shop.eventDate ? `
          <div class="shop-info-row">
            <span class="info-label">出店日:</span>
            <span class="info-value">${Utils.escapeHtml(shop.eventDate)}</span>
          </div>` : ''}
          ${shop.email ? `
          <div class="shop-info-row">
            <span class="info-label">メール:</span>
            <span class="info-value"><a href="mailto:${Utils.escapeHtml(shop.email)}" style="color:var(--primary-400); text-decoration:underline; font-weight:600;">✉️ ${Utils.escapeHtml(shop.email)}</a></span>
          </div>` : ''}
          ${shop.phone ? `
          <div class="shop-info-row">
            <span class="info-label">電話番号:</span>
            <span class="info-value"><a href="tel:${Utils.escapeHtml(shop.phone)}" style="color:var(--primary-400); text-decoration:underline; font-weight:600;">📞 ${Utils.escapeHtml(shop.phone)}</a></span>
          </div>` : ''}
          ${shop.contact ? `
          <div class="shop-info-row">
            <span class="info-label">その他連絡/SNS:</span>
            <span class="info-value" style="word-break: break-all;">${Utils.escapeHtml(shop.contact)}</span>
          </div>` : ''}
          ${shop.desc ? `
          <p class="shop-description-text">${Utils.escapeHtml(shop.desc)}</p>` : ''}
        </div>
        <div class="shop-card-footer">
          <button class="btn btn-outline btn-sm" style="width: 100%;" onclick="ShopsModule.openShopModal('${shop.id}')">
            編集する
          </button>
        </div>
      `;
      container.appendChild(card);
    });
  },

  openShopModal(shopId = null) {
    const modal = document.getElementById('modal-shop');
    if (!modal) return;

    const titleEl = document.getElementById('modal-shop-title');
    const deleteBtn = document.getElementById('btn-delete-shop');

    if (shopId) {
      titleEl.textContent = '出店者の編集';
      deleteBtn.style.display = 'inline-flex';

      const shop = window.appStore.data.shopList.find(s => s.id === shopId);
      if (shop) {
        document.getElementById('shop-id').value = shop.id;
        document.getElementById('shop-name').value = shop.name;
        document.getElementById('shop-category').value = shop.category;
        document.getElementById('shop-event').value = shop.eventName || '';
        document.getElementById('shop-event-date').value = shop.eventDate || '';
        document.getElementById('shop-email').value = shop.email || '';
        document.getElementById('shop-phone').value = shop.phone || '';
        document.getElementById('shop-contact').value = shop.contact || '';
        document.getElementById('shop-desc').value = shop.desc || '';
      }
    } else {
      titleEl.textContent = '新規出店者の追加';
      deleteBtn.style.display = 'none';

      document.getElementById('shop-id').value = '';
      document.getElementById('shop-name').value = '';
      document.getElementById('shop-category').value = '';
      document.getElementById('shop-event').value = '';
      document.getElementById('shop-event-date').value = '';
      document.getElementById('shop-email').value = '';
      document.getElementById('shop-phone').value = '';
      document.getElementById('shop-contact').value = '';
      document.getElementById('shop-desc').value = '';
    }

    Utils.openModal('modal-shop');
  },

  saveShop() {
    const id = document.getElementById('shop-id').value;
    const name = document.getElementById('shop-name').value.trim();
    const category = document.getElementById('shop-category').value.trim();
    const eventName = document.getElementById('shop-event').value.trim();
    const eventDate = document.getElementById('shop-event-date').value;
    const email = document.getElementById('shop-email').value.trim();
    const phone = document.getElementById('shop-phone').value.trim();
    const contact = document.getElementById('shop-contact').value.trim();
    const desc = document.getElementById('shop-desc').value.trim();

    if (!name || !category) {
      Utils.showToast('店舗名とカテゴリを入力してください', 'danger');
      return;
    }

    const shopData = { name, category, eventName, eventDate, email, phone, contact, desc };

    if (id) {
      shopData.id = id;
      window.appStore.updateShop(shopData);
      Utils.showToast('出店者情報を更新しました', 'success');
    } else {
      window.appStore.addShop(shopData);
      Utils.showToast('新規出店者を追加しました', 'success');
    }

    Utils.closeModal('modal-shop');
  },

  deleteShop(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const idEl = document.getElementById('shop-id');
    const id = idEl.value;
    if (!id) return;

    const shop = window.appStore.data.shopList.find(s => s.id === id);
    if (!shop) return;

    idEl.value = '';

    if (confirm(`出店者「${shop.name}」のデータを削除しますか？`)) {
      window.appStore.deleteShop(id);
      Utils.closeModal('modal-shop');
      Utils.showToast('出店者データを削除しました', 'warning');
    } else {
      idEl.value = id;
    }
  }
};

window.ShopsModule = ShopsModule;
