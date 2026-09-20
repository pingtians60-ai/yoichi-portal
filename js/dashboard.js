/* ==========================================================================
   夜市 (Yoichi) - Dashboard Module
   ========================================================================== */

const DashboardModule = {
  init() {
    this.render();
  },

  render() {
    const today = new Date();
    const todayStr = Utils.formatDateKey(today);

    // 日付ヘッダー
    const dateTitleEl = document.getElementById('dash-today-title');
    if (dateTitleEl) {
      dateTitleEl.textContent = Utils.formatDateJP(today);
    }

    // 予定追加ボタンの表示制御
    const isAdmin = window.appStore.isAdmin();
    const btnQuickEvent = document.getElementById('dash-btn-quick-event');
    if (btnQuickEvent) {
      btnQuickEvent.style.display = isAdmin ? 'inline-flex' : 'none';
    }

    // 1. 主要統計カード
    this.renderStats(todayStr);

    // 2. 本日のスケジュール一覧
    this.renderTodayEvents(todayStr);

    // 3. 直近・今後のスケジュール
    this.renderUpcomingEvents(todayStr);

    // 4. メンバー別の参加イベント統計
    this.renderMemberParticipationStats();
  },

  renderStats(todayStr) {
    const events = window.appStore.data.events;
    const todayEvents = events.filter(e => e.date === todayStr);
    const staffList = window.appStore.data.staffList;

    const curMonthKey = todayStr.substring(0, 7);
    const monthEvents = events.filter(e => e.date.startsWith(curMonthKey));

    const statTodayEl = document.getElementById('dash-stat-today');
    if (statTodayEl) statTodayEl.textContent = `${todayEvents.length} 件`;

    const statMonthEl = document.getElementById('dash-stat-month');
    if (statMonthEl) statMonthEl.textContent = `${monthEvents.length} 件`;

    const statStaffEl = document.getElementById('dash-stat-staff');
    if (statStaffEl) statStaffEl.textContent = `${staffList.length} 名`;
  },

  getCategoryBadgeClass(category) {
    switch (category) {
      case 'Core': return 'badge-cat-core';
      case 'Chief': return 'badge-cat-chief';
      case 'Assistant': return 'badge-cat-assistant';
      case 'Beginner': return 'badge-cat-beginner';
      default: return 'badge-cat-member';
    }
  },

  renderTodayEvents(todayStr) {
    const container = document.getElementById('dash-today-events-container');
    if (!container) return;
    container.innerHTML = '';

    const events = window.appStore.data.events
      .filter(e => e.date === todayStr)
      .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

    if (events.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding: 2.5rem; color:var(--text-muted);">
          本日の予定はありません。
        </div>
      `;
      return;
    }

    events.forEach(ev => {
      const item = document.createElement('div');
      item.className = 'agenda-item';

      const catColor = Utils.stringToColor(ev.category);
      item.style.borderLeftColor = catColor;

      const timeStr = ev.allDay ? '終日' : `${ev.startTime || ''} ~ ${ev.endTime || ''}`;

      // 参加者バッジ（出席番号順、カテゴリー付き）
      const eventStaffList = (ev.members || [])
        .map(mid => window.appStore.data.staffList.find(s => s.id === mid))
        .filter(Boolean);
      const sortedEventStaff = Utils.sortStaffList(eventStaffList);

      const memberBadges = sortedEventStaff.map(staff => {
        const badgeClass = this.getCategoryBadgeClass(staff.category);
        return `<span class="participant-chip"><span class="badge ${badgeClass}">${staff.category}</span> ${staff.name}</span>`;
      }).join('');

      item.innerHTML = `
        <div class="agenda-time">${timeStr}</div>
        <div class="agenda-content">
          <div class="agenda-title" style="font-size:0.95rem;">${ev.title}</div>
          <div class="agenda-meta" style="flex-wrap:wrap; gap:0.5rem; margin-top:0.4rem;">
            <span class="badge" style="background-color:${catColor}20; color:${catColor}; font-weight:700;">${ev.category || '会議'}</span>
            ${ev.notes ? `<span style="color:var(--text-secondary);">メモ: ${ev.notes}</span>` : ''}
            <div style="display:flex; flex-wrap:wrap; gap:0.35rem; margin-left:auto;">
              ${memberBadges || '<span style="color:var(--text-muted); font-size:0.75rem;">参加者なし</span>'}
            </div>
          </div>
        </div>
      `;

      item.addEventListener('click', () => {
        window.ScheduleModule.openEventModal(ev);
      });

      container.appendChild(item);
    });
  },

  renderUpcomingEvents(todayStr) {
    const container = document.getElementById('dash-upcoming-events-container');
    if (!container) return;
    container.innerHTML = '';

    const upcoming = window.appStore.data.events
      .filter(e => e.date > todayStr)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5);

    if (upcoming.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding: 2rem; color:var(--text-muted);">
          直近の今後の予定はありません。
        </div>
      `;
      return;
    }

    upcoming.forEach(ev => {
      const item = document.createElement('div');
      item.className = 'agenda-item';
      const catColor = Utils.stringToColor(ev.category);
      item.style.borderLeftColor = catColor;

      // 参加者バッジ（出席番号順）
      const eventStaffList = (ev.members || [])
        .map(mid => window.appStore.data.staffList.find(s => s.id === mid))
        .filter(Boolean);
      const sortedEventStaff = Utils.sortStaffList(eventStaffList);

      const memberBadges = sortedEventStaff.map(staff => {
        const badgeClass = this.getCategoryBadgeClass(staff.category);
        return `<span class="participant-chip" style="font-size:0.7rem;"><span class="badge ${badgeClass}">${staff.category}</span> ${staff.name}</span>`;
      }).join('');

      item.innerHTML = `
        <div class="agenda-time" style="width:110px;">
          <div>${Utils.formatDateJP(ev.date, false)}</div>
          <div style="font-size:0.7rem; color:var(--text-muted);">${ev.allDay ? '終日' : ev.startTime || ''}</div>
        </div>
        <div class="agenda-content">
          <div class="agenda-title">${ev.title}</div>
          <div class="agenda-meta" style="flex-wrap:wrap; gap:0.4rem;">
            <span class="badge" style="background-color:${catColor}20; color:${catColor};">${ev.category || '会議'}</span>
            <div style="display:flex; flex-wrap:wrap; gap:0.3rem; margin-left:auto;">${memberBadges}</div>
          </div>
        </div>
      `;

      item.addEventListener('click', () => {
        window.ScheduleModule.openEventModal(ev);
      });

      container.appendChild(item);
    });
  },

  renderMemberParticipationStats() {
    const container = document.getElementById('dash-member-stats-container');
    if (!container) return;
    container.innerHTML = '';

    // 出席番号順（昇順、管理者は先頭）に並べ替え
    const staffList = Utils.sortStaffList(window.appStore.data.staffList);
    const events = window.appStore.data.events;

    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(180px, 1fr))';
    grid.style.gap = '0.75rem';

    staffList.forEach(staff => {
      const count = events.filter(e => e.members && e.members.includes(staff.id)).length;
      const badgeClass = this.getCategoryBadgeClass(staff.category);

      const isMasterAdmin = staff.name === '管理者' || staff.id === 'u1';
      let attendanceHtml = '';
      if (!isMasterAdmin && staff.attendance_number) {
        attendanceHtml = `<span style="font-size:0.72rem; color:var(--text-muted); font-weight:normal; margin-left:0.35rem;">出席番号: ${staff.attendance_number}</span>`;
      }

      const card = document.createElement('div');
      card.style.padding = '0.85rem';
      card.style.borderRadius = 'var(--radius-md)';
      card.style.backgroundColor = 'var(--bg-tertiary)';
      card.style.border = '1px solid var(--border-subtle)';
      card.style.display = 'flex';
      card.style.alignItems = 'center';
      card.style.justifyContent = 'space-between';

      card.innerHTML = `
        <div style="display:flex; align-items:center; gap:0.6rem;">
          <span class="avatar-sm" style="background-color: var(--primary-600);">${staff.avatar}</span>
          <div>
            <div style="font-weight:700; font-size:0.85rem; display:flex; align-items:center;">
              <span>${staff.name}</span>
              ${attendanceHtml}
            </div>
            <span class="badge ${badgeClass}" style="font-size:0.65rem;">${staff.category}</span>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:1.15rem; font-weight:800; color:var(--primary-600);">${count}</div>
          <div style="font-size:0.65rem; color:var(--text-muted);">予定参加</div>
        </div>
      `;

      grid.appendChild(card);
    });

    container.appendChild(grid);
  }
};

window.DashboardModule = DashboardModule;
