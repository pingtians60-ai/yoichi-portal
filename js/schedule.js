/* ==========================================================================
   夜市 (Yoichi) - Schedule & Calendar Module
   ========================================================================== */

const ScheduleModule = {
  currentDate: new Date(),
  currentView: 'month', // 'month', 'week', 'day', 'agenda'
  filterCategory: 'all',
  filterMember: 'all',

  init() {
    this.bindEvents();
    this.render();
  },

  bindEvents() {
    // 前月・次月・今日ボタン
    document.getElementById('cal-prev-btn')?.addEventListener('click', () => {
      this.navigatePeriod(-1);
    });

    document.getElementById('cal-next-btn')?.addEventListener('click', () => {
      this.navigatePeriod(1);
    });

    document.getElementById('cal-today-btn')?.addEventListener('click', () => {
      this.currentDate = new Date();
      this.render();
    });

    // ビュー切り替えボタン
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.currentView = e.currentTarget.dataset.view;
        this.render();
      });
    });

    // カテゴリフィルタ切り替え
    document.getElementById('cal-filter-category')?.addEventListener('change', (e) => {
      this.filterCategory = e.target.value;
      this.render();
    });

    // メンバーフィルタ切り替え
    document.getElementById('cal-filter-member')?.addEventListener('change', (e) => {
      this.filterMember = e.target.value;
      this.render();
    });

    // 予定作成ボタン
    document.getElementById('btn-add-event')?.addEventListener('click', () => {
      this.openEventModal();
    });

    // 予定保存フォーム送信
    document.getElementById('form-event')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveEventFromModal();
    });

    // 予定削除ボタン
    document.getElementById('btn-delete-event')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const eventId = document.getElementById('event-id').value;
      if (eventId && confirm('この予定を削除してもよろしいですか？')) {
        // フォームが意図せずsubmitされて予定が再登録されるのを防ぐため、IDをクリア
        document.getElementById('event-id').value = '';
        window.appStore.deleteEvent(eventId);
        Utils.closeModal('modal-event');
        Utils.showToast('予定を削除しました', 'success');
      }
    });

    // 終日チェックボックス切り替え
    document.getElementById('event-allday')?.addEventListener('change', (e) => {
      const timeContainer = document.getElementById('event-time-group');
      if (timeContainer) {
        timeContainer.style.display = e.target.checked ? 'none' : 'grid';
      }
    });

    // 予定モーダル内の参加メンバー選択ボタン
    document.getElementById('btn-open-member-picker')?.addEventListener('click', () => {
      const isAdmin = window.appStore.isAdmin();
      this.openMemberPickerModal(!isAdmin);
    });

    // 大画面メンバー選択モーダル内のイベント
    document.getElementById('btn-close-member-picker')?.addEventListener('click', () => {
      Utils.closeModal('modal-member-picker');
    });
    document.getElementById('picker-btn-cancel')?.addEventListener('click', () => {
      Utils.closeModal('modal-member-picker');
    });
    document.getElementById('picker-btn-confirm')?.addEventListener('click', () => {
      this.confirmMemberPicker();
    });
    document.getElementById('picker-btn-select-all')?.addEventListener('click', () => {
      this.selectAllPickerMembers();
    });
    document.getElementById('picker-btn-clear-all')?.addEventListener('click', () => {
      this.clearAllPickerMembers();
    });
    document.getElementById('picker-search-input')?.addEventListener('input', (e) => {
      this.pickerSearchQuery = e.target.value.trim().toLowerCase();
      const isAdmin = window.appStore.isAdmin();
      this.renderPickerGrid(!isAdmin);
    });
  },

  navigatePeriod(direction) {
    const d = new Date(this.currentDate);
    if (this.currentView === 'month' || this.currentView === 'agenda') {
      d.setMonth(d.getMonth() + direction);
    } else if (this.currentView === 'week') {
      d.setDate(d.getDate() + (direction * 7));
    } else if (this.currentView === 'day') {
      d.setDate(d.getDate() + direction);
    }
    this.currentDate = d;
    this.render();
  },

  render() {
    this.updateTitle();
    this.populateFilterOptions();

    const isAdmin = window.appStore.isAdmin();
    const btnAddEvent = document.getElementById('btn-add-event');
    if (btnAddEvent) {
      btnAddEvent.style.display = isAdmin ? 'inline-flex' : 'none';
    }

    const container = document.getElementById('calendar-view-container');
    if (!container) return;
    container.innerHTML = '';

    if (this.currentView === 'month') {
      this.renderMonthView(container);
    } else if (this.currentView === 'week') {
      this.renderWeekView(container);
    } else if (this.currentView === 'day') {
      this.renderDayView(container);
    } else if (this.currentView === 'agenda') {
      this.renderAgendaView(container);
    }
  },

  updateTitle() {
    const titleEl = document.getElementById('cal-period-title');
    if (!titleEl) return;

    const y = this.currentDate.getFullYear();
    const m = this.currentDate.getMonth() + 1;

    if (this.currentView === 'month' || this.currentView === 'agenda') {
      titleEl.textContent = `${y}年 ${m}月`;
    } else if (this.currentView === 'week') {
      const weekStart = this.getWeekStartDate(this.currentDate);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      titleEl.textContent = `${weekStart.getMonth() + 1}月${weekStart.getDate()}日 〜 ${weekEnd.getMonth() + 1}月${weekEnd.getDate()}日`;
    } else if (this.currentView === 'day') {
      titleEl.textContent = Utils.formatDateJP(this.currentDate);
    }
  },

  populateFilterOptions() {
    const catSelect = document.getElementById('cal-filter-category');
    if (catSelect) {
      const currentVal = catSelect.value;
      catSelect.innerHTML = '<option value="all">すべての種別</option>';
      
      const events = window.appStore.data.events;
      const categories = [...new Set(events.map(e => e.category).filter(Boolean))].sort();
      
      categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        if (cat === currentVal) opt.selected = true;
        catSelect.appendChild(opt);
      });
    }

    const memberSelect = document.getElementById('cal-filter-member');
    if (memberSelect) {
      const currentVal = memberSelect.value;
      memberSelect.innerHTML = '<option value="all">すべてのメンバー</option>';
      const sortedStaff = Utils.sortStaffList(window.appStore.data.staffList);
      sortedStaff.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = `${s.name} (${s.category})`;
        if (s.id === currentVal) opt.selected = true;
        memberSelect.appendChild(opt);
      });
    }
  },

  getFilteredEvents() {
    const allEvents = window.appStore.data.events;
    return allEvents.filter(ev => {
      if (this.filterCategory !== 'all' && ev.category !== this.filterCategory) {
        return false;
      }
      if (this.filterMember !== 'all' && (!ev.members || !ev.members.includes(this.filterMember))) {
        return false;
      }
      return true;
    });
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

  /* --- Month View --- */
  renderMonthView(container) {
    const grid = document.createElement('div');
    grid.className = 'month-calendar-grid';

    // 曜日ヘッダー
    const dayHeaders = ['日', '月', '火', '水', '木', '金', '土'];
    dayHeaders.forEach((name, idx) => {
      const th = document.createElement('div');
      th.className = `month-day-header ${idx === 0 ? 'sunday' : ''} ${idx === 6 ? 'saturday' : ''}`;
      th.textContent = name;
      grid.appendChild(th);
    });

    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth(); // 0-11
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInCurrentMonth = Utils.getDaysInMonth(year, month);
    const prevMonthDays = Utils.getDaysInMonth(year, month - 1);

    const todayStr = Utils.formatDateKey(new Date());
    const filteredEvents = this.getFilteredEvents();

    for (let i = 0; i < 42; i++) {
      const cell = document.createElement('div');
      cell.className = 'month-day-cell';

      let cellDate;
      let isCurrentMonth = true;

      if (i < firstDayIndex) {
        const dayNum = prevMonthDays - firstDayIndex + i + 1;
        cellDate = new Date(year, month - 1, dayNum);
        cell.classList.add('other-month');
        isCurrentMonth = false;
      } else if (i >= firstDayIndex + daysInCurrentMonth) {
        const dayNum = i - (firstDayIndex + daysInCurrentMonth) + 1;
        cellDate = new Date(year, month + 1, dayNum);
        cell.classList.add('other-month');
        isCurrentMonth = false;
      } else {
        const dayNum = i - firstDayIndex + 1;
        cellDate = new Date(year, month, dayNum);
      }

      const dateKey = Utils.formatDateKey(cellDate);
      if (dateKey === todayStr) {
        cell.classList.add('today');
      }

      const holidayName = Utils.getJapaneseHoliday(cellDate.getFullYear(), cellDate.getMonth() + 1, cellDate.getDate());

      const cellHeader = document.createElement('div');
      cellHeader.className = 'day-cell-header';

      const numSpan = document.createElement('span');
      numSpan.className = 'day-number';
      numSpan.textContent = cellDate.getDate();
      cellHeader.appendChild(numSpan);

      if (holidayName) {
        const holSpan = document.createElement('span');
        holSpan.className = 'holiday-name';
        holSpan.textContent = holidayName;
        cellHeader.appendChild(holSpan);
      }

      cell.appendChild(cellHeader);

      const eventsContainer = document.createElement('div');
      eventsContainer.className = 'day-events-container';

      const dayEvents = filteredEvents.filter(e => e.date === dateKey);
      dayEvents.forEach(ev => {
        const pill = document.createElement('div');
        const catColor = Utils.stringToColor(ev.category);
        pill.className = 'event-pill';
        pill.style.borderLeft = `3px solid ${catColor}`;
        pill.style.backgroundColor = `${catColor}18`;
        pill.style.color = catColor;
        
        const timeStr = ev.allDay ? '終日' : (ev.startTime || '');
        
        // ツールチップで時間等も確認可能に設定
        pill.title = `${ev.title}${timeStr ? ` (${timeStr})` : ''}`;
        
        pill.innerHTML = `
          <span class="event-pill-title" style="font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; width:100%; display:block;">${ev.title}</span>
        `;
        
        pill.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openEventModal(ev);
        });

        eventsContainer.appendChild(pill);
      });

      cell.appendChild(eventsContainer);

      cell.addEventListener('click', () => {
        this.openEventModal(null, dateKey);
      });

      grid.appendChild(cell);
    }

    container.appendChild(grid);
  },

  /* --- Week View --- */
  renderWeekView(container) {
    const wrapper = document.createElement('div');
    wrapper.className = 'timegrid-wrapper';
    wrapper.style.setProperty('--grid-cols', '7');

    const weekStart = this.getWeekStartDate(this.currentDate);
    const todayStr = Utils.formatDateKey(new Date());

    const header = document.createElement('div');
    header.className = 'timegrid-header';

    const axisHead = document.createElement('div');
    axisHead.className = 'timegrid-header-cell';
    axisHead.textContent = '時間';
    header.appendChild(axisHead);

    const weekDates = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + d);
      weekDates.push(date);

      const dateKey = Utils.formatDateKey(date);
      const isToday = dateKey === todayStr;

      const th = document.createElement('div');
      th.className = `timegrid-header-cell ${isToday ? 'today' : ''}`;
      th.innerHTML = `
        <div style="font-size:0.75rem; color:var(--text-muted);">${['日','月','火','水','木','金','土'][date.getDay()]}</div>
        <div style="font-size:1.1rem; font-weight:800; ${isToday ? 'color:var(--primary-600);' : ''}">${date.getDate()}</div>
      `;
      header.appendChild(th);
    }
    wrapper.appendChild(header);

    const body = document.createElement('div');
    body.className = 'timegrid-body';

    const timeAxis = document.createElement('div');
    timeAxis.className = 'time-axis';
    for (let h = 8; h <= 21; h++) {
      const slotLabel = document.createElement('div');
      slotLabel.className = 'time-slot-label';
      slotLabel.textContent = `${String(h).padStart(2, '0')}:00`;
      timeAxis.appendChild(slotLabel);
    }
    body.appendChild(timeAxis);

    const columns = document.createElement('div');
    columns.className = 'timegrid-columns';

    const filteredEvents = this.getFilteredEvents();

    weekDates.forEach((date) => {
      const dateKey = Utils.formatDateKey(date);
      const col = document.createElement('div');
      col.className = 'timegrid-col';
      col.style.height = `${(21 - 8 + 1) * 50}px`;

      for (let h = 8; h <= 21; h++) {
        const slot = document.createElement('div');
        slot.className = 'timegrid-slot';
        slot.addEventListener('click', () => {
          this.openEventModal(null, dateKey, `${String(h).padStart(2, '0')}:00`);
        });
        col.appendChild(slot);
      }

      const dayEvents = filteredEvents.filter(e => e.date === dateKey);
      dayEvents.forEach(ev => {
        const catColor = Utils.stringToColor(ev.category);
        const evEl = document.createElement('div');
        evEl.className = 'timegrid-event';
        evEl.style.borderLeft = `3px solid ${catColor}`;
        evEl.style.backgroundColor = `${catColor}18`;
        evEl.style.color = catColor;

        let top = 0;
        let height = 45;

        if (ev.allDay) {
          top = 5;
          height = 35;
        } else if (ev.startTime) {
          const [sh, sm] = ev.startTime.split(':').map(Number);
          const [eh, em] = (ev.endTime || `${sh + 1}:${sm}`).split(':').map(Number);

          const startMinutes = (sh - 8) * 60 + (sm || 0);
          const endMinutes = (eh - 8) * 60 + (em || 0);
          const durMinutes = Math.max(30, endMinutes - startMinutes);

          top = (startMinutes / 60) * 50;
          height = Math.max(26, (durMinutes / 60) * 50 - 4);
        }

        const memberCount = (ev.members || []).length;

        evEl.style.top = `${top}px`;
        evEl.style.height = `${height}px`;
        evEl.innerHTML = `
          <div style="font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${ev.title}</div>
          <div style="font-size:0.7rem; opacity:0.85;">${ev.startTime || '終日'}${ev.endTime ? ' - ' + ev.endTime : ''} ${memberCount > 0 ? `· 👤${memberCount}` : ''}</div>
        `;

        evEl.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openEventModal(ev);
        });

        col.appendChild(evEl);
      });

      columns.appendChild(col);
    });

    body.appendChild(columns);
    wrapper.appendChild(body);
    container.appendChild(wrapper);
  },

  /* --- Day View --- */
  renderDayView(container) {
    const wrapper = document.createElement('div');
    wrapper.className = 'timegrid-wrapper';
    wrapper.style.setProperty('--grid-cols', '1');

    const header = document.createElement('div');
    header.className = 'timegrid-header';

    const axisHead = document.createElement('div');
    axisHead.className = 'timegrid-header-cell';
    axisHead.textContent = '時間';
    header.appendChild(axisHead);

    const th = document.createElement('div');
    th.className = 'timegrid-header-cell';
    th.textContent = Utils.formatDateJP(this.currentDate);
    header.appendChild(th);

    wrapper.appendChild(header);

    const body = document.createElement('div');
    body.className = 'timegrid-body';

    const timeAxis = document.createElement('div');
    timeAxis.className = 'time-axis';
    for (let h = 8; h <= 21; h++) {
      const slotLabel = document.createElement('div');
      slotLabel.className = 'time-slot-label';
      slotLabel.textContent = `${String(h).padStart(2, '0')}:00`;
      timeAxis.appendChild(slotLabel);
    }
    body.appendChild(timeAxis);

    const columns = document.createElement('div');
    columns.className = 'timegrid-columns';

    const dateKey = Utils.formatDateKey(this.currentDate);
    const col = document.createElement('div');
    col.className = 'timegrid-col';
    col.style.height = `${(21 - 8 + 1) * 50}px`;

    for (let h = 8; h <= 21; h++) {
      const slot = document.createElement('div');
      slot.className = 'timegrid-slot';
      slot.addEventListener('click', () => {
        this.openEventModal(null, dateKey, `${String(h).padStart(2, '0')}:00`);
      });
      col.appendChild(slot);
    }

    const filteredEvents = this.getFilteredEvents().filter(e => e.date === dateKey);
    filteredEvents.forEach(ev => {
      const catColor = Utils.stringToColor(ev.category);
      const evEl = document.createElement('div');
      evEl.className = 'timegrid-event';
      evEl.style.borderLeft = `3px solid ${catColor}`;
      evEl.style.backgroundColor = `${catColor}18`;
      evEl.style.color = catColor;

      let top = 0;
      let height = 55;

      if (!ev.allDay && ev.startTime) {
        const [sh, sm] = ev.startTime.split(':').map(Number);
        const [eh, em] = (ev.endTime || `${sh + 1}:${sm}`).split(':').map(Number);
        const startMinutes = (sh - 8) * 60 + (sm || 0);
        const endMinutes = (eh - 8) * 60 + (em || 0);
        const durMinutes = Math.max(30, endMinutes - startMinutes);

        top = (startMinutes / 60) * 50;
        height = Math.max(40, (durMinutes / 60) * 50 - 4);
      }

      // 参加者バッジ
      const memberChips = (ev.members || []).map(mid => {
        const staff = window.appStore.data.staffList.find(s => s.id === mid);
        if (!staff) return '';
        const badgeClass = this.getCategoryBadgeClass(staff.category);
        return `<span class="badge ${badgeClass}" style="font-size:0.65rem; padding:0.1rem 0.35rem;">${staff.name} (${staff.category})</span>`;
      }).join(' ');

      evEl.style.top = `${top}px`;
      evEl.style.height = `${height}px`;
      evEl.innerHTML = `
        <div style="font-weight:700; font-size:0.85rem;">${ev.title}</div>
        <div style="font-size:0.75rem;">${ev.startTime || '終日'}${ev.endTime ? ' - ' + ev.endTime : ''}</div>
        ${memberChips ? `<div style="display:flex; flex-wrap:wrap; gap:3px; margin-top:3px;">${memberChips}</div>` : ''}
        ${ev.notes ? `<div style="font-size:0.7rem; opacity:0.8; margin-top:2px;">${ev.notes}</div>` : ''}
      `;

      evEl.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openEventModal(ev);
      });

      col.appendChild(evEl);
    });

    columns.appendChild(col);
    body.appendChild(columns);
    wrapper.appendChild(body);
    container.appendChild(wrapper);
  },

  /* --- Agenda View --- */
  renderAgendaView(container) {
    const wrapper = document.createElement('div');
    wrapper.className = 'agenda-view-container';

    const filteredEvents = this.getFilteredEvents();
    const sorted = [...filteredEvents].sort((a, b) => a.date.localeCompare(b.date));

    const grouped = {};
    sorted.forEach(ev => {
      if (!grouped[ev.date]) grouped[ev.date] = [];
      grouped[ev.date].push(ev);
    });

    const dates = Object.keys(grouped);
    if (dates.length === 0) {
      wrapper.innerHTML = `
        <div style="text-align:center; padding:3rem; color:var(--text-muted);">
          表示条件に一致する予定はありません。
        </div>
      `;
      container.appendChild(wrapper);
      return;
    }

    dates.forEach(dateKey => {
      const group = document.createElement('div');
      group.className = 'agenda-day-group';

      const header = document.createElement('div');
      header.className = 'agenda-day-header';
      header.textContent = Utils.formatDateJP(dateKey);
      group.appendChild(header);

      const list = document.createElement('div');
      list.className = 'agenda-list';

      grouped[dateKey].forEach(ev => {
        const item = document.createElement('div');
        item.className = 'agenda-item';

        const catColor = Utils.stringToColor(ev.category);
        item.style.borderLeftColor = catColor;

        const timeStr = ev.allDay ? '終日' : `${ev.startTime || ''}${ev.endTime ? ' ~ ' + ev.endTime : ''}`;

        // 参加者バッジ（カテゴリー付き）
        const memberBadges = (ev.members || []).map(mid => {
          const staff = window.appStore.data.staffList.find(s => s.id === mid);
          if (!staff) return '';
          const badgeClass = this.getCategoryBadgeClass(staff.category);
          return `<span class="participant-chip"><span class="badge ${badgeClass}">${staff.category}</span> ${staff.name}</span>`;
        }).join('');

        item.innerHTML = `
          <div class="agenda-time">${timeStr}</div>
          <div class="agenda-content">
            <div class="agenda-title">${ev.title}</div>
            <div class="agenda-meta" style="flex-wrap:wrap; gap:0.5rem;">
              <span class="badge" style="background-color:${catColor}20; color:${catColor}; font-weight:700;">${ev.category || '会議'}</span>
              ${ev.notes ? `<span>メモ: ${ev.notes}</span>` : ''}
              <div style="display:flex; flex-wrap:wrap; gap:0.35rem; margin-left:auto;">
                ${memberBadges || '<span style="color:var(--text-muted);">参加者なし</span>'}
              </div>
            </div>
          </div>
        `;

        item.addEventListener('click', () => {
          this.openEventModal(ev);
        });

        list.appendChild(item);
      });

      group.appendChild(list);
      wrapper.appendChild(group);
    });

    container.appendChild(wrapper);
  },

  getWeekStartDate(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day; // Sunday as start
    return new Date(d.setDate(diff));
  },

  /* --- Event Modal Handling --- */
  openEventModal(event = null, defaultDate = null, defaultStartTime = '10:00') {
    const isAdmin = window.appStore.isAdmin();
    if (!event && !isAdmin) {
      Utils.showToast('管理者権限がないため、新規予定を登録できません', 'danger');
      return;
    }

    const modal = document.getElementById('modal-event');
    if (!modal) return;

    const titleEl = document.getElementById('modal-event-title');
    const deleteBtn = document.getElementById('btn-delete-event');

    const form = document.getElementById('form-event');
    if (form) {
      const inputs = form.querySelectorAll('input, select, textarea');
      inputs.forEach(input => {
        input.disabled = !isAdmin;
      });
    }

    const submitBtn = modal.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.style.display = isAdmin ? 'inline-flex' : 'none';
    }

    if (event) {
      titleEl.textContent = isAdmin ? '予定の編集' : '予定の詳細';
      deleteBtn.style.display = isAdmin ? 'inline-flex' : 'none';
      
      const shiftJumpBtn = document.getElementById('btn-jump-event-shift');
      if (shiftJumpBtn) {
        shiftJumpBtn.style.display = 'inline-flex';
        shiftJumpBtn.onclick = () => {
          Utils.closeModal('modal-event');
          window.App.switchTab('event-shift');
          window.EventShiftModule.currentEventId = event.id;
          window.EventShiftModule.render();
        };
      }

      document.getElementById('event-id').value = event.id;
      document.getElementById('event-title').value = event.title;
      document.getElementById('event-category').value = event.category;
      document.getElementById('event-date').value = event.date;
      document.getElementById('event-allday').checked = !!event.allDay;
      document.getElementById('event-start-time').value = event.startTime || '09:00';
      document.getElementById('event-end-time').value = event.endTime || '10:00';
      document.getElementById('event-notes').value = event.notes || '';

      this.currentEventSelectedMembers = (event.members && Array.isArray(event.members)) ? [...event.members] : [];
    } else {
      titleEl.textContent = '新規予定の登録';
      deleteBtn.style.display = 'none';

      const shiftJumpBtn = document.getElementById('btn-jump-event-shift');
      if (shiftJumpBtn) shiftJumpBtn.style.display = 'none';

      document.getElementById('event-id').value = '';
      document.getElementById('event-title').value = '';
      document.getElementById('event-category').value = 'MTG';
      document.getElementById('event-date').value = defaultDate || Utils.formatDateKey(this.currentDate);
      document.getElementById('event-allday').checked = false;
      document.getElementById('event-start-time').value = defaultStartTime;
      
      const startH = parseInt(defaultStartTime.split(':')[0], 10);
      document.getElementById('event-end-time').value = `${String(Math.min(23, startH + 1)).padStart(2, '0')}:00`;
      document.getElementById('event-notes').value = '';

      const currentUserId = window.appStore.data.currentUser?.id;
      this.currentEventSelectedMembers = currentUserId ? [currentUserId] : [];
    }

    this.renderSelectedMembersPreview(!isAdmin);

    const isAllDay = document.getElementById('event-allday').checked;
    document.getElementById('event-time-group').style.display = isAllDay ? 'none' : 'grid';

    Utils.openModal('modal-event');
  },

  saveEventFromModal() {
    const id = document.getElementById('event-id').value;
    const title = document.getElementById('event-title').value.trim();
    const category = document.getElementById('event-category').value;
    const date = document.getElementById('event-date').value;
    const allDay = document.getElementById('event-allday').checked;
    const startTime = allDay ? '' : document.getElementById('event-start-time').value;
    const endTime = allDay ? '' : document.getElementById('event-end-time').value;
    const notes = document.getElementById('event-notes').value.trim();

    const members = this.currentEventSelectedMembers || [];

    if (!title || !date) {
      Utils.showToast('タイトルと日付を入力してください', 'danger');
      return;
    }

    const eventData = {
      id: id || Utils.generateId(),
      title,
      category,
      date,
      allDay,
      startTime,
      endTime,
      members,
      notes
    };

    if (id) {
      window.appStore.updateEvent(eventData);
      Utils.showToast('予定を更新しました', 'success');
    } else {
      window.appStore.addEvent(eventData);
      Utils.showToast('新規予定を登録しました', 'success');
    }

    Utils.closeModal('modal-event');
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

  renderSelectedMembersPreview(disabled = false) {
    const countEl = document.getElementById('event-members-count');
    const previewEl = document.getElementById('event-selected-members-preview');
    const openBtn = document.getElementById('btn-open-member-picker');
    if (!previewEl) return;
    previewEl.innerHTML = '';

    const selectedIds = this.currentEventSelectedMembers || [];
    if (countEl) countEl.textContent = `${selectedIds.length}名選択中`;

    if (openBtn) {
      openBtn.innerHTML = `<span>👥</span><span>${disabled ? '参加メンバー一覧を確認する' : '参加メンバーを選択・変更する'}</span>`;
    }

    if (selectedIds.length === 0) {
      previewEl.innerHTML = '<span style="color:var(--text-muted); font-size:0.78rem; padding:0.2rem 0.4rem;">参加メンバーが選択されていません</span>';
      return;
    }

    const staffMap = new Map();
    (window.appStore.data.staffList || []).forEach(s => staffMap.set(s.id, s));

    selectedIds.forEach(id => {
      const staff = staffMap.get(id);
      if (!staff) return;

      const chip = document.createElement('span');
      chip.className = 'event-member-chip';

      const isMaster = staff.name === '管理者' || staff.id === 'u1';
      const numText = (!isMaster && staff.attendance_number) ? ` #${staff.attendance_number}` : '';

      let removeBtnHtml = '';
      if (!disabled) {
        removeBtnHtml = `<span class="event-member-chip-remove" title="解除" data-id="${staff.id}">✕</span>`;
      }

      chip.innerHTML = `
        <span class="avatar-sm" style="width:20px; height:20px; font-size:0.65rem; background-color:var(--primary-600);">${staff.avatar || staff.name.charAt(0)}</span>
        <span>${staff.name}${numText}</span>
        ${removeBtnHtml}
      `;

      if (!disabled) {
        const removeBtn = chip.querySelector('.event-member-chip-remove');
        removeBtn?.addEventListener('click', (e) => {
          e.stopPropagation();
          this.currentEventSelectedMembers = this.currentEventSelectedMembers.filter(mId => mId !== staff.id);
          this.renderSelectedMembersPreview(disabled);
        });
      }

      previewEl.appendChild(chip);
    });
  },

  openMemberPickerModal(options = false) {
    let disabled = false;
    let initialSelected = null;
    let onConfirm = null;
    let title = '👥 参加メンバーの選択';

    if (typeof options === 'boolean') {
      disabled = options;
      initialSelected = this.currentEventSelectedMembers || [];
    } else if (options && typeof options === 'object') {
      disabled = Boolean(options.disabled);
      initialSelected = options.initialSelected || this.currentEventSelectedMembers || [];
      onConfirm = options.onConfirm || null;
      if (options.title) title = options.title;
    } else {
      disabled = !window.appStore.isAdmin();
      initialSelected = this.currentEventSelectedMembers || [];
    }

    this.pickerOnConfirmCallback = onConfirm;
    this.pickerDraftMembers = new Set(initialSelected);
    this.pickerActiveCategory = 'all';
    this.pickerSearchQuery = '';

    const titleEl = document.getElementById('modal-member-picker-title');
    if (titleEl) titleEl.textContent = title;

    const searchInput = document.getElementById('picker-search-input');
    if (searchInput) searchInput.value = '';

    const bulkActions = document.getElementById('picker-bulk-actions');
    if (bulkActions) bulkActions.style.display = disabled ? 'none' : 'flex';

    const confirmBtn = document.getElementById('picker-btn-confirm');
    if (confirmBtn) confirmBtn.style.display = disabled ? 'none' : 'inline-flex';

    this.renderPickerCategories(disabled);
    this.renderPickerGrid(disabled);
    this.updatePickerHeaderCount();

    Utils.openModal('modal-member-picker');
  },

  renderPickerCategories(disabled = false) {
    const container = document.getElementById('picker-category-filters');
    if (!container) return;
    container.innerHTML = '';

    const categories = ['all', 'Core', 'Chief', 'Assistant', 'Member', 'Beginner'];
    const labels = {
      all: 'すべて',
      Core: 'Core',
      Chief: 'Chief',
      Assistant: 'Assistant',
      Member: 'Member',
      Beginner: 'Beginner'
    };

    categories.forEach(cat => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `picker-category-chip ${this.pickerActiveCategory === cat ? 'active' : ''}`;
      btn.textContent = labels[cat];
      btn.addEventListener('click', () => {
        this.pickerActiveCategory = cat;
        container.querySelectorAll('.picker-category-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.renderPickerGrid(disabled);
      });
      container.appendChild(btn);
    });
  },

  renderPickerGrid(disabled = false) {
    const grid = document.getElementById('picker-members-grid');
    if (!grid) return;
    grid.innerHTML = '';

    let staffList = Utils.sortStaffList(window.appStore.data.staffList);

    // カテゴリー絞り込み
    if (this.pickerActiveCategory && this.pickerActiveCategory !== 'all') {
      staffList = staffList.filter(s => s.category === this.pickerActiveCategory);
    }

    // 検索ワード絞り込み
    if (this.pickerSearchQuery) {
      const q = this.pickerSearchQuery;
      staffList = staffList.filter(s => {
        const nameMatch = s.name.toLowerCase().includes(q);
        const numMatch = String(s.attendance_number || '').includes(q);
        const catMatch = (s.category || '').toLowerCase().includes(q);
        return nameMatch || numMatch || catMatch;
      });
    }

    if (staffList.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1 / -1; padding: 2.5rem 1rem; text-align: center; color: var(--text-muted); font-size: 0.88rem;">条件に一致するメンバーが見つかりません</div>';
      return;
    }

    staffList.forEach(staff => {
      const isSelected = this.pickerDraftMembers.has(staff.id);
      const card = document.createElement('div');
      card.className = `picker-member-card ${isSelected ? 'selected' : ''}`;
      if (disabled) card.style.cursor = 'default';

      const badgeClass = this.getCategoryBadgeClass(staff.category);
      const isMaster = staff.name === '管理者' || staff.id === 'u1';
      const numText = (!isMaster && staff.attendance_number) ? `背番号: ${staff.attendance_number}` : '';

      card.innerHTML = `
        <div class="picker-member-card-left">
          <div class="picker-member-avatar" style="background-color: var(--primary-600);">
            ${staff.avatar || staff.name.charAt(0)}
          </div>
          <div style="min-width: 0;">
            <div class="picker-member-name">${staff.name}</div>
            <div class="picker-member-sub">
              <span class="badge ${badgeClass}" style="font-size: 0.65rem; padding: 0.08rem 0.4rem;">${staff.category}</span>
              ${numText ? `<span style="font-size: 0.72rem; color: var(--text-muted);">${numText}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="picker-member-checkbox">
          ${isSelected ? '✓' : ''}
        </div>
      `;

      if (!disabled) {
        card.addEventListener('click', () => {
          if (this.pickerDraftMembers.has(staff.id)) {
            this.pickerDraftMembers.delete(staff.id);
            card.classList.remove('selected');
            card.querySelector('.picker-member-checkbox').textContent = '';
          } else {
            this.pickerDraftMembers.add(staff.id);
            card.classList.add('selected');
            card.querySelector('.picker-member-checkbox').textContent = '✓';
          }
          this.updatePickerHeaderCount();
        });
      }

      grid.appendChild(card);
    });
  },

  selectAllPickerMembers() {
    (window.appStore.data.staffList || []).forEach(s => {
      this.pickerDraftMembers.add(s.id);
    });
    const currentGridCards = document.querySelectorAll('#picker-members-grid .picker-member-card');
    currentGridCards.forEach(c => {
      c.classList.add('selected');
      const cb = c.querySelector('.picker-member-checkbox');
      if (cb) cb.textContent = '✓';
    });
    this.updatePickerHeaderCount();
  },

  clearAllPickerMembers() {
    this.pickerDraftMembers.clear();
    const currentGridCards = document.querySelectorAll('#picker-members-grid .picker-member-card');
    currentGridCards.forEach(c => {
      c.classList.remove('selected');
      const cb = c.querySelector('.picker-member-checkbox');
      if (cb) cb.textContent = '';
    });
    this.updatePickerHeaderCount();
  },

  updatePickerHeaderCount() {
    const countBadge = document.getElementById('picker-selected-count-badge');
    if (countBadge) {
      countBadge.textContent = `${this.pickerDraftMembers ? this.pickerDraftMembers.size : 0}名選択中`;
    }
  },

  confirmMemberPicker() {
    const selectedIds = Array.from(this.pickerDraftMembers || []);
    
    if (typeof this.pickerOnConfirmCallback === 'function') {
      this.pickerOnConfirmCallback(selectedIds);
      this.pickerOnConfirmCallback = null;
    } else {
      this.currentEventSelectedMembers = selectedIds;
      const isAdmin = window.appStore.isAdmin();
      this.renderSelectedMembersPreview(!isAdmin);
      Utils.showToast(`参加メンバー（${this.currentEventSelectedMembers.length}名）を反映しました`, 'info');
    }

    Utils.closeModal('modal-member-picker');
  }
};

window.ScheduleModule = ScheduleModule;
