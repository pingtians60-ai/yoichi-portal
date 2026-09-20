/* ==========================================================================
   夜市 (Yoichi) - Event Shift Management Module
   ========================================================================== */

const EventShiftModule = {
  currentEventId: null,
  activeSlotInfo: null,
  currentViewMode: 'matrix', // 'matrix' または 'personal'
  personalFilterMemberId: 'my', // 'my' (自分), 'all' (全員), または メンバーID

  init() {
    this.bindEvents();
    this.ensureEventSelected();
    this.render();
  },

  ensureEventSelected() {
    const events = window.appStore.data.events || [];
    if (!this.currentEventId || !events.some(e => e.id === this.currentEventId)) {
      if (events.length > 0) {
        this.currentEventId = events[0].id;
      } else {
        this.currentEventId = null;
      }
    }
  },

  bindEvents() {
    // 表示モード切り替えタブ (全体マトリクス / 個人別シフト)
    document.getElementById('tab-btn-matrix-shift')?.addEventListener('click', () => {
      this.switchViewMode('matrix');
    });

    document.getElementById('tab-btn-personal-shift')?.addEventListener('click', () => {
      this.switchViewMode('personal');
    });

    // 個人シフト表のメンバーフィルター切り替え
    document.getElementById('personal-shift-member-select')?.addEventListener('change', (e) => {
      this.personalFilterMemberId = e.target.value;
      this.renderPersonalShift();
    });

    // イベント切り替え
    document.getElementById('event-shift-select')?.addEventListener('change', (e) => {
      this.currentEventId = e.target.value;
      this.render();
    });

    // 参加スタッフ選択・変更ボタン
    document.getElementById('btn-edit-event-members')?.addEventListener('click', () => {
      this.openEventMembersPicker();
    });

    // 役割・時間枠設定モーダルを開く
    document.getElementById('btn-edit-shift-struct')?.addEventListener('click', () => {
      this.openStructureModal();
    });

    // 自動割り当てボタン
    document.getElementById('btn-auto-assign-event-shift')?.addEventListener('click', () => {
      this.autoAssignMembers();
    });

    // シフト表クリアボタン
    document.getElementById('btn-clear-event-shift')?.addEventListener('click', () => {
      if (!this.currentEventId) return;
      if (confirm('現在のシフト割り当てをすべてクリアしますか？')) {
        const shift = window.appStore.getEventShift(this.currentEventId);
        shift.assignments = {};
        window.appStore.saveData();
        window.appStore.saveEventShift(this.currentEventId);
        Utils.showToast('シフト割り当てをクリアしました', 'info');
        this.render();
      }
    });

    // CSVエクスポート
    document.getElementById('btn-export-event-shift-csv')?.addEventListener('click', () => {
      this.exportCsv();
    });

    // 印刷
    document.getElementById('btn-print-event-shift')?.addEventListener('click', () => {
      window.print();
    });

    // 役割・時間枠設定フォーム保存
    document.getElementById('form-event-shift-struct')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveStructure();
    });

    // 役割追加ボタン
    document.getElementById('btn-add-role-row')?.addEventListener('click', () => {
      this.addRoleInputRow();
    });

    // 時間枠追加ボタン
    document.getElementById('btn-add-slot-row')?.addEventListener('click', () => {
      this.addSlotInputRow();
    });

    // 外側クリックでポップオーバーを閉じる
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.member-assign-popover') && !e.target.closest('.event-shift-slot')) {
        this.closePopover();
      }
    });
  },

  switchViewMode(mode) {
    this.currentViewMode = mode;

    const btnMatrix = document.getElementById('tab-btn-matrix-shift');
    const btnPersonal = document.getElementById('tab-btn-personal-shift');
    const matrixContainer = document.getElementById('event-shift-grid-container');
    const personalContainer = document.getElementById('event-shift-personal-container');
    const filterWrapper = document.getElementById('personal-shift-member-filter-wrapper');

    if (btnMatrix) btnMatrix.classList.toggle('active', mode === 'matrix');
    if (btnPersonal) btnPersonal.classList.toggle('active', mode === 'personal');

    if (matrixContainer) matrixContainer.style.display = mode === 'matrix' ? 'block' : 'none';
    if (personalContainer) personalContainer.style.display = mode === 'personal' ? 'block' : 'none';
    if (filterWrapper) filterWrapper.style.display = mode === 'personal' ? 'flex' : 'none';

    if (mode === 'matrix') {
      this.renderShiftGrid();
    } else {
      this.updatePersonalMemberSelector();
      this.renderPersonalShift();
    }
  },

  render() {
    this.ensureEventSelected();
    this.updateEventSelector();
    this.renderEventBanner();

    if (this.currentViewMode === 'matrix') {
      this.renderShiftGrid();
    } else {
      this.updatePersonalMemberSelector();
      this.renderPersonalShift();
    }

    const isAdmin = window.appStore.isAdmin();
    const btnEditMembers = document.getElementById('btn-edit-event-members');
    const btnEditStruct = document.getElementById('btn-edit-shift-struct');
    const btnAutoAssign = document.getElementById('btn-auto-assign-event-shift');
    const btnClearShift = document.getElementById('btn-clear-event-shift');

    if (btnEditMembers) btnEditMembers.style.display = isAdmin ? 'inline-flex' : 'none';
    if (btnEditStruct) btnEditStruct.style.display = isAdmin ? 'inline-flex' : 'none';
    if (btnAutoAssign) btnAutoAssign.style.display = isAdmin ? 'inline-flex' : 'none';
    if (btnClearShift) btnClearShift.style.display = isAdmin ? 'inline-flex' : 'none';
  },

  updateEventSelector() {
    const select = document.getElementById('event-shift-select');
    if (!select) return;

    select.innerHTML = '';
    const events = window.appStore.data.events || [];

    if (events.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '予定が登録されていません';
      select.appendChild(opt);
      return;
    }

    events.forEach(ev => {
      const opt = document.createElement('option');
      opt.value = ev.id;
      opt.textContent = `【${Utils.formatDateJP(ev.date, false)}】${ev.title}`;
      if (ev.id === this.currentEventId) opt.selected = true;
      select.appendChild(opt);
    });
  },

  renderEventBanner() {
    const banner = document.getElementById('event-shift-banner');
    if (!banner) return;

    const ev = window.appStore.data.events.find(e => e.id === this.currentEventId);
    if (!ev) {
      banner.innerHTML = '<div style="color:var(--text-muted);">イベントを選択してください</div>';
      return;
    }

    const memberCount = (ev.members || []).length;
    const catColor = Utils.stringToColor(ev.category);
    const isAdmin = window.appStore.isAdmin();

    banner.innerHTML = `
      <div class="event-meta-info">
        <div class="event-meta-title">
          <span>${ev.title}</span>
          <span class="badge" style="background-color:${catColor}20; color:${catColor}; font-size:0.75rem;">${ev.category || 'イベント'}</span>
        </div>
        <div class="event-meta-details">
          <span>開催日: <strong>${Utils.formatDateJP(ev.date)}</strong></span>
          <span>時間: <strong>${ev.allDay ? '終日' : (ev.startTime + ' 〜 ' + ev.endTime)}</strong></span>
          <span style="display:inline-flex; align-items:center; gap:0.4rem;">
            <span>参加メンバー: <strong>${memberCount}名</strong></span>
            ${isAdmin ? `<button type="button" class="btn btn-outline btn-xs" id="btn-banner-edit-members" style="padding:0.1rem 0.5rem; font-size:0.72rem; line-height:1.2; border-radius:var(--radius-sm);">👥 変更</button>` : ''}
          </span>
          ${ev.notes ? `<span>メモ: ${ev.notes}</span>` : ''}
        </div>
      </div>
    `;

    if (isAdmin) {
      document.getElementById('btn-banner-edit-members')?.addEventListener('click', () => {
        this.openEventMembersPicker();
      });
    }
  },

  openEventMembersPicker() {
    if (!this.currentEventId) {
      Utils.showToast('対象イベントを選択してください', 'warning');
      return;
    }
    const ev = window.appStore.data.events.find(e => e.id === this.currentEventId);
    if (!ev) {
      Utils.showToast('対象イベントが見つかりません', 'danger');
      return;
    }

    const isAdmin = window.appStore.isAdmin();
    const currentMembers = (ev.members && Array.isArray(ev.members)) ? [...ev.members] : [];

    window.ScheduleModule.openMemberPickerModal({
      title: `👥「${ev.title}」の参加スタッフ選択`,
      initialSelected: currentMembers,
      disabled: !isAdmin,
      onConfirm: (selectedMemberIds) => {
        ev.members = selectedMemberIds;
        window.appStore.updateEvent(ev);
        Utils.showToast(`参加スタッフ（${selectedMemberIds.length}名）を更新・反映しました`, 'success');
        this.render();
      }
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

  renderShiftGrid() {
    const container = document.getElementById('event-shift-grid-container');
    if (!container) return;
    container.innerHTML = '';

    const ev = window.appStore.data.events.find(e => e.id === this.currentEventId);
    if (!ev) {
      container.innerHTML = `
        <div style="text-align:center; padding:3.5rem 1rem; color:var(--text-muted);">
          <div style="font-size:1.1rem; font-weight:700; margin-bottom:0.75rem;">イベントが登録されていないか選択されていません</div>
          <p style="font-size:0.85rem; margin-bottom:1.2rem;">シフト表を表示するには、イベントを登録するか上部のプルダウンから選択してください。</p>
          <button class="btn btn-primary btn-sm" onclick="ScheduleModule.openEventModal()">
            ＋ 新規イベントを登録する
          </button>
        </div>
      `;
      return;
    }

    const shiftData = window.appStore.getEventShift(this.currentEventId);
    const { roles, timeSlots, assignments } = shiftData;

    if (!roles || roles.length === 0 || !timeSlots || timeSlots.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:3rem; color:var(--text-muted);">
          シフトの役割または時間枠が設定されていません。<br>
          <button class="btn btn-primary btn-sm" style="margin-top:1rem;" onclick="EventShiftModule.openStructureModal()">
            役割と時間枠を設定する
          </button>
        </div>
      `;
      return;
    }

    const table = document.createElement('table');
    table.className = 'event-shift-table';

    // ----------------------------------------------------
    // 1. ヘッダー行（時間帯 ＋ 役割列）
    // ----------------------------------------------------
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    const thTime = document.createElement('th');
    thTime.className = 'col-time';
    thTime.textContent = '時間帯 / 役割';
    headerRow.appendChild(thTime);

    roles.forEach(role => {
      const th = document.createElement('th');
      th.innerHTML = `
        <div class="role-header-title">${role.name}</div>
        <div class="role-header-req">目標: ${role.target || 1}名</div>
      `;
      headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // ----------------------------------------------------
    // 2. ボディ行（各時間帯スロット）
    // ----------------------------------------------------
    const tbody = document.createElement('tbody');
    const isAdmin = window.appStore.isAdmin();

    timeSlots.forEach(slot => {
      const tr = document.createElement('tr');

      // 時間帯セル
      const tdTime = document.createElement('td');
      tdTime.className = 'col-time';
      tdTime.innerHTML = `<strong>${slot.time}</strong>`;
      tr.appendChild(tdTime);

      // 各役割セル
      roles.forEach(role => {
        const td = document.createElement('td');
        const slotKey = `${slot.id}_${role.id}`;
        const assignedMemberIds = assignments[slotKey] || [];

        td.className = `event-shift-slot ${assignedMemberIds.length === 0 ? 'empty-slot' : ''}`;
        td.dataset.slotId = slot.id;
        td.dataset.roleId = role.id;
        td.dataset.roleName = role.name;
        td.dataset.slotTime = slot.time;

        // 割り当てられたメンバーバッジを描画
        assignedMemberIds.forEach(mid => {
          const staff = window.appStore.data.staffList.find(s => String(s.id).trim() === String(mid).trim()) || {
            id: mid,
            name: `メンバー(${mid})`,
            category: 'Member'
          };
          const badgeClass = this.getCategoryBadgeClass(staff.category);
          const badge = document.createElement('div');
          badge.className = 'slot-member-badge';
          badge.innerHTML = `
            <span style="display:flex; align-items:center; gap:0.3rem;">
              <span class="badge ${badgeClass}" style="font-size:0.65rem; padding:0.1rem 0.3rem;">${staff.category}</span>
              <span>${staff.name}</span>
            </span>
            <span class="btn-remove-slot-member" title="割当解除" style="display: ${isAdmin ? 'inline-flex' : 'none'};">✕</span>
          `;

          // メンバー解除ボタン
          if (isAdmin) {
            const btnRemove = badge.querySelector('.btn-remove-slot-member');
            if (btnRemove) {
              btnRemove.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                window.appStore.removeMemberFromSlot(this.currentEventId, slot.id, role.id, mid);
                if (staff.id && String(staff.id).trim() !== String(mid).trim()) {
                  window.appStore.removeMemberFromSlot(this.currentEventId, slot.id, role.id, staff.id);
                }
                this.render();
              });
            }
          }

          td.appendChild(badge);
        });

        // セルクリックでメンバー割り当てポップオーバー
        td.addEventListener('click', (e) => {
          e.stopPropagation();
          if (!isAdmin) return;
          this.openAssignPopover(td, slot.id, role.id, role.name, slot.time);
        });

        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    container.appendChild(table);
  },

  /* --- Personal Shift View (個人別シフト表 / マイシフト) --- */
  updatePersonalMemberSelector() {
    const select = document.getElementById('personal-shift-member-select');
    if (!select) return;

    select.innerHTML = '';
    const staffList = Utils.sortStaffList(window.appStore.data.staffList || []);
    const currentUser = window.appStore.data.currentUser;

    if (currentUser) {
      const optMy = document.createElement('option');
      optMy.value = 'my';
      optMy.textContent = `★ 自分のシフト (${currentUser.name})`;
      if (this.personalFilterMemberId === 'my') optMy.selected = true;
      select.appendChild(optMy);
    }

    const optAll = document.createElement('option');
    optAll.value = 'all';
    optAll.textContent = '👥 全員のシフト一覧';
    if (this.personalFilterMemberId === 'all') optAll.selected = true;
    select.appendChild(optAll);

    staffList.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = `${s.name} (${s.category})`;
      if (this.personalFilterMemberId === s.id) opt.selected = true;
      select.appendChild(opt);
    });
  },

  renderPersonalShift() {
    const container = document.getElementById('event-shift-personal-container');
    if (!container) return;
    container.innerHTML = '';

    const ev = window.appStore.data.events.find(e => e.id === this.currentEventId);
    if (!ev) {
      container.innerHTML = `
        <div style="text-align:center; padding:3.5rem 1rem; color:var(--text-muted);">
          <div style="font-size:1.1rem; font-weight:700; margin-bottom:0.75rem;">イベントが登録されていないか選択されていません</div>
          <p style="font-size:0.85rem; margin-bottom:1.2rem;">シフト表を表示するには、イベントを登録するか上部のプルダウンから選択してください。</p>
          <button class="btn btn-primary btn-sm" onclick="ScheduleModule.openEventModal()">
            ＋ 新規イベントを登録する
          </button>
        </div>
      `;
      return;
    }

    const shiftData = window.appStore.getEventShift(this.currentEventId);
    const { roles, timeSlots, assignments } = shiftData;

    if (!roles || roles.length === 0 || !timeSlots || timeSlots.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:3rem; color:var(--text-muted);">
          シフトの役割または時間枠が設定されていません。<br>
          <button class="btn btn-primary btn-sm" style="margin-top:1rem;" onclick="EventShiftModule.openStructureModal()">
            役割と時間枠を設定する
          </button>
        </div>
      `;
      return;
    }

    const staffList = window.appStore.data.staffList || [];
    const currentUser = window.appStore.data.currentUser;

    // 表示対象メンバーの決定
    let targetStaffList = [];
    if (this.personalFilterMemberId === 'my') {
      if (currentUser) {
        const found = staffList.find(s => s.id === currentUser.id);
        if (found) targetStaffList = [found];
      }
      if (targetStaffList.length === 0) {
        targetStaffList = staffList;
      }
    } else if (this.personalFilterMemberId === 'all') {
      targetStaffList = Utils.sortStaffList(staffList);
    } else {
      const found = staffList.find(s => s.id === this.personalFilterMemberId);
      targetStaffList = found ? [found] : staffList;
    }

    if (targetStaffList.length === 0) {
      container.innerHTML = '<div style="text-align:center; padding:2.5rem; color:var(--text-muted);">対象メンバーが登録されていません。</div>';
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'personal-shift-container';

    const cardsGrid = document.createElement('div');
    cardsGrid.className = 'personal-shift-cards-grid';

    targetStaffList.forEach(staff => {
      const isMyCard = currentUser && staff.id === currentUser.id;
      const card = document.createElement('div');
      card.className = `personal-shift-card ${isMyCard ? 'my-shift-card' : ''}`;

      const badgeClass = this.getCategoryBadgeClass(staff.category);

      let assignedCount = 0;
      const timelineItemsHtml = timeSlots.map(slot => {
        let myRole = null;
        let partners = [];

        roles.forEach(role => {
          const key = `${slot.id}_${role.id}`;
          const assignedIds = assignments[key] || [];
          if (assignedIds.includes(staff.id)) {
            myRole = role;
            const partnerIds = assignedIds.filter(id => id !== staff.id);
            partners = partnerIds.map(pid => {
              const pStaff = staffList.find(s => s.id === pid);
              return pStaff ? pStaff.name : '';
            }).filter(Boolean);
          }
        });

        if (myRole) {
          assignedCount++;
          const partnersText = partners.length > 0
            ? `ペア・同枠: ${partners.join('、')}`
            : '（単独担当）';

          return `
            <div class="personal-timeline-item assigned">
              <div class="timeline-time-col">
                <div>${slot.time}</div>
              </div>
              <div class="timeline-role-col">
                <div class="timeline-role-title">
                  <span class="badge badge-primary" style="font-size:0.75rem;">${myRole.name}</span>
                </div>
                <div class="timeline-partners-text">${partnersText}</div>
              </div>
            </div>
          `;
        } else {
          return `
            <div class="personal-timeline-item idle">
              <div class="timeline-time-col">
                <div>${slot.time}</div>
              </div>
              <div class="timeline-role-col">
                <div style="color:var(--text-muted); font-size:0.75rem; font-weight:600;">
                  フリー / 待機・休憩
                </div>
              </div>
            </div>
          `;
        }
      }).join('');

      card.innerHTML = `
        <div class="personal-card-header">
          <div class="personal-user-info">
            <span class="avatar-sm" style="background-color: var(--primary-600);">${staff.avatar || staff.name.charAt(0)}</span>
            <div>
              <div class="personal-user-name">${staff.name}</div>
              <span class="badge ${badgeClass}" style="font-size:0.68rem;">${staff.category}</span>
            </div>
          </div>
          <div class="personal-stats-badge">
            担当: <strong>${assignedCount}</strong> / ${timeSlots.length} 枠
          </div>
        </div>

        <div class="personal-timeline-list">
          ${timelineItemsHtml}
        </div>
      `;

      cardsGrid.appendChild(card);
    });

    wrapper.appendChild(cardsGrid);
    container.appendChild(wrapper);
  },

  /* --- Member Assign Popover (Multi-Select Enabled) --- */
  openAssignPopover(cellEl, slotId, roleId, roleName, slotTime) {
    this.closePopover();

    const ev = window.appStore.data.events.find(e => e.id === this.currentEventId);
    if (!ev) return;

    const eventMemberIds = ev.members && ev.members.length > 0 ? ev.members : window.appStore.data.staffList.map(s => s.id);
    const candidateStaff = window.appStore.data.staffList.filter(s => eventMemberIds.includes(s.id));

    const shiftData = window.appStore.getEventShift(this.currentEventId);
    const currentAssigned = [...(shiftData.assignments[`${slotId}_${roleId}`] || [])];

    const targetRole = (shiftData.roles || []).find(r => r.id === roleId);
    const targetCount = targetRole ? (targetRole.target || 1) : 1;

    const rect = cellEl.getBoundingClientRect();
    const popover = document.createElement('div');
    popover.id = 'active-member-assign-popover';
    popover.className = 'member-assign-popover';
    popover.style.top = `${rect.bottom + window.scrollY + 4}px`;
    popover.style.left = `${Math.min(window.innerWidth - 290, Math.max(10, rect.left + window.scrollX))}px`;
    popover.style.width = '280px';

    popover.innerHTML = `
      <div class="popover-header">
        <div>
          <div class="popover-title" style="display:flex; align-items:center; justify-content:space-between; gap:0.5rem;">
            <span>メンバー割当</span>
            <span id="popover-assigned-count-badge" class="badge badge-primary" style="font-size:0.72rem;">${currentAssigned.length} / ${targetCount}名</span>
          </div>
          <div class="popover-subtitle">${slotTime} - ${roleName}</div>
        </div>
        <button class="btn-close-popover" onclick="EventShiftModule.closePopover()">✕</button>
      </div>
      <div class="popover-body">
        <div class="popover-search">
          <input type="text" id="popover-member-search" placeholder="名前で検索..." autocomplete="off">
        </div>
        <div class="popover-member-list" id="popover-member-list">
          <!-- JSで動的生成 -->
        </div>
      </div>
      <div class="popover-footer" style="display:flex; justify-content:space-between; align-items:center; padding:0.45rem 0.75rem; border-top:1px solid var(--border-subtle); background:var(--bg-tertiary); border-radius:0 0 var(--radius-md) var(--radius-md);">
        <span style="font-size:0.72rem; color:var(--text-muted);">複数選択可能</span>
        <button type="button" class="btn btn-primary btn-sm" onclick="EventShiftModule.closePopover()" style="padding:0.22rem 0.75rem; font-size:0.75rem; font-weight:600;">
          完了
        </button>
      </div>
    `;

    document.body.appendChild(popover);
    this.activePopoverCell = cellEl;
    this.renderPopoverMemberList(candidateStaff, currentAssigned, slotId, roleId, targetCount, cellEl);

    // 検索フィルタ
    document.getElementById('popover-member-search')?.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      const filtered = candidateStaff.filter(s => s.name.toLowerCase().includes(q));
      this.renderPopoverMemberList(filtered, currentAssigned, slotId, roleId, targetCount, cellEl);
    });
  },

  renderPopoverMemberList(staffList, currentAssigned, slotId, roleId, targetCount, cellEl) {
    const listEl = document.getElementById('popover-member-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (staffList.length === 0) {
      listEl.innerHTML = '<div style="padding:0.75rem 0.5rem; color:var(--text-muted); font-size:0.75rem; text-align:center;">該当メンバーがいません</div>';
      return;
    }

    staffList.forEach(staff => {
      const isAssigned = currentAssigned.includes(staff.id);
      const item = document.createElement('div');
      item.className = `popover-member-item ${isAssigned ? 'assigned' : ''}`;
      
      const badgeClass = this.getCategoryBadgeClass(staff.category);
      const isMaster = staff.name === '管理者' || staff.id === 'u1';
      const numText = (!isMaster && staff.attendance_number) ? ` #${staff.attendance_number}` : '';

      item.innerHTML = `
        <div class="popover-member-info">
          <span class="avatar-sm" style="width:24px; height:24px; font-size:0.7rem; background-color: var(--primary-600);">${staff.avatar || staff.name.charAt(0)}</span>
          <span style="font-weight:600;">${staff.name}${numText}</span>
          <span class="badge ${badgeClass}" style="font-size:0.6rem; padding:0.05rem 0.3rem;">${staff.category}</span>
        </div>
        <span class="popover-check-mark">${isAssigned ? '✓ 割当済' : '＋'}</span>
      `;

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const currentlyHas = currentAssigned.includes(staff.id);
        if (currentlyHas) {
          window.appStore.removeMemberFromSlot(this.currentEventId, slotId, roleId, staff.id);
          const idx = currentAssigned.indexOf(staff.id);
          if (idx !== -1) currentAssigned.splice(idx, 1);
          item.classList.remove('assigned');
          const mark = item.querySelector('.popover-check-mark');
          if (mark) mark.textContent = '＋';
        } else {
          window.appStore.assignMemberToSlot(this.currentEventId, slotId, roleId, staff.id);
          currentAssigned.push(staff.id);
          item.classList.add('assigned');
          const mark = item.querySelector('.popover-check-mark');
          if (mark) mark.textContent = '✓ 割当済';
        }

        // カウントバッジ更新
        const countBadge = document.getElementById('popover-assigned-count-badge');
        if (countBadge) {
          countBadge.textContent = `${currentAssigned.length} / ${targetCount}名`;
        }

        // セル側（テーブルの枠）のバッジを即時再描画
        this.updateCellMemberBadges(cellEl, slotId, roleId, currentAssigned);
      });

      listEl.appendChild(item);
    });
  },

  updateCellMemberBadges(cellEl, slotId, roleId, assignedMemberIds) {
    if (!cellEl) return;
    cellEl.innerHTML = '';
    const isAdmin = window.appStore.isAdmin();

    if (assignedMemberIds.length === 0) {
      cellEl.classList.add('empty-slot');
    } else {
      cellEl.classList.remove('empty-slot');
    }

    assignedMemberIds.forEach(mid => {
      const staff = window.appStore.data.staffList.find(s => String(s.id).trim() === String(mid).trim()) || {
        id: mid,
        name: `メンバー(${mid})`,
        category: 'Member'
      };
      const badgeClass = this.getCategoryBadgeClass(staff.category);
      const badge = document.createElement('div');
      badge.className = 'slot-member-badge';
      badge.innerHTML = `
        <span style="display:flex; align-items:center; gap:0.3rem;">
          <span class="badge ${badgeClass}" style="font-size:0.65rem; padding:0.1rem 0.3rem;">${staff.category}</span>
          <span>${staff.name}</span>
        </span>
        <span class="btn-remove-slot-member" title="割当解除" style="display: ${isAdmin ? 'inline-flex' : 'none'};">✕</span>
      `;

      if (isAdmin) {
        const btnRemove = badge.querySelector('.btn-remove-slot-member');
        if (btnRemove) {
          btnRemove.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            window.appStore.removeMemberFromSlot(this.currentEventId, slotId, roleId, mid);
            this.closePopover();
            this.render();
          });
        }
      }

      cellEl.appendChild(badge);
    });
  },

  closePopover() {
    const pop = document.getElementById('active-member-assign-popover');
    if (pop) {
      pop.remove();
      this.render();
    }
  },

  /* --- Structure Modal (役割 & 時間帯の編集) --- */
  openStructureModal() {
    const modal = document.getElementById('modal-event-shift-struct');
    if (!modal) return;

    const shiftData = window.appStore.getEventShift(this.currentEventId);
    const { roles, timeSlots } = shiftData;

    // 役割リストの描画
    const roleContainer = document.getElementById('struct-roles-container');
    if (roleContainer) {
      roleContainer.innerHTML = '';
      roles.forEach(r => this.addRoleInputRow(r.name, r.target));
    }

    // 時間帯スロットリストの描画
    const slotContainer = document.getElementById('struct-slots-container');
    if (slotContainer) {
      slotContainer.innerHTML = '';
      timeSlots.forEach(s => this.addSlotInputRow(s.time));
    }

    Utils.openModal('modal-event-shift-struct');
  },

  addRoleInputRow(name = '', target = 1) {
    const container = document.getElementById('struct-roles-container');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'struct-input-row';
    row.innerHTML = `
      <input type="text" class="form-control struct-role-name" placeholder="役割名 (例: 受付/誘導)" value="${name}" required style="flex:2;">
      <div style="display:flex; align-items:center; gap:0.3rem; flex:1;">
        <span style="font-size:0.75rem; color:var(--text-muted);">必要:</span>
        <input type="number" class="form-control struct-role-target" min="1" max="20" value="${target}" style="width:60px; text-align:center;">
        <span style="font-size:0.75rem; color:var(--text-muted);">名</span>
      </div>
      <button type="button" class="btn-icon-only btn-remove-row" title="削除">✕</button>
    `;

    row.querySelector('.btn-remove-row').addEventListener('click', () => {
      row.remove();
    });

    container.appendChild(row);
  },

  addSlotInputRow(time = '') {
    const container = document.getElementById('struct-slots-container');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'struct-input-row';
    row.innerHTML = `
      <input type="text" class="form-control struct-slot-time" placeholder="時間帯 (例: 前半 09:00 - 12:00)" value="${time}" required style="flex:1;">
      <button type="button" class="btn-icon-only btn-remove-row" title="削除">✕</button>
    `;

    row.querySelector('.btn-remove-row').addEventListener('click', () => {
      row.remove();
    });

    container.appendChild(row);
  },

  saveStructure() {
    const roleRows = document.querySelectorAll('#struct-roles-container .struct-input-row');
    const slotRows = document.querySelectorAll('#struct-slots-container .struct-input-row');

    const roles = [];
    roleRows.forEach((row, i) => {
      const name = row.querySelector('.struct-role-name')?.value.trim();
      const target = parseInt(row.querySelector('.struct-role-target')?.value, 10) || 1;
      if (name) {
        roles.push({ id: `r_${i}`, name, target });
      }
    });

    const timeSlots = [];
    slotRows.forEach((row, i) => {
      const time = row.querySelector('.struct-slot-time')?.value.trim();
      if (time) {
        timeSlots.push({ id: `t_${i}`, time });
      }
    });

    if (roles.length === 0 || timeSlots.length === 0) {
      Utils.showToast('少なくとも1つずつの役割と時間枠を設定してください', 'danger');
      return;
    }

    window.appStore.updateEventShiftStructure(this.currentEventId, roles, timeSlots);
    Utils.showToast('シフトの構成設定を保存しました', 'success');
    Utils.closeModal('modal-event-shift-struct');
    this.render();
  },

  /* --- Member Auto Assignment --- */
  autoAssignMembers() {
    const ev = window.appStore.data.events.find(e => e.id === this.currentEventId);
    if (!ev) return;

    const shiftData = window.appStore.getEventShift(this.currentEventId);
    const { roles, timeSlots } = shiftData;

    if (!roles.length || !timeSlots.length) {
      Utils.showToast('役割または時間枠が設定されていません', 'danger');
      return;
    }

    // イベント参加メンバー（指定がなければ全メンバー）
    const eventMemberIds = ev.members && ev.members.length > 0
      ? [...ev.members]
      : window.appStore.data.staffList.map(s => s.id);

    if (eventMemberIds.length === 0) {
      Utils.showToast('割り当て可能なメンバーがいません', 'warning');
      return;
    }

    // シャッフルして公平に割り当て
    eventMemberIds.sort(() => Math.random() - 0.5);

    const assignments = {};
    let memberIndex = 0;

    timeSlots.forEach(slot => {
      roles.forEach(role => {
        const slotKey = `${slot.id}_${role.id}`;
        assignments[slotKey] = [];
        const needed = role.target || 1;

        for (let n = 0; n < needed; n++) {
          const assignedId = eventMemberIds[memberIndex % eventMemberIds.length];
          if (!assignments[slotKey].includes(assignedId)) {
            assignments[slotKey].push(assignedId);
          }
          memberIndex++;
        }
      });
    });

    shiftData.assignments = assignments;
    window.appStore.saveData();
    window.appStore.saveEventShift(this.currentEventId);
    Utils.showToast('メンバーの自動割り当てが完了しました！', 'success');
    this.render();
  },

  /* --- Export to CSV --- */
  exportCsv() {
    const ev = window.appStore.data.events.find(e => e.id === this.currentEventId);
    if (!ev) return;

    const shiftData = window.appStore.getEventShift(this.currentEventId);
    const { roles, timeSlots, assignments } = shiftData;

    if (this.currentViewMode === 'personal') {
      // 個人別シフトCSV
      const staffList = window.appStore.data.staffList || [];
      const rows = [];
      rows.push([`【夜市】個人別シフト表: ${ev.title}`, `開催日: ${ev.date}`]);
      rows.push([]);

      const header = ['メンバー名', 'カテゴリー', '時間帯', '担当役割', '同枠メンバー'];
      rows.push(header);

      staffList.forEach(staff => {
        timeSlots.forEach(slot => {
          let roleName = 'フリー / 待機・休憩';
          let partners = [];

          roles.forEach(role => {
            const key = `${slot.id}_${role.id}`;
            const ids = assignments[key] || [];
            if (ids.includes(staff.id)) {
              roleName = role.name;
              partners = ids.filter(id => id !== staff.id).map(pid => {
                const ps = staffList.find(s => s.id === pid);
                return ps ? ps.name : '';
              }).filter(Boolean);
            }
          });

          rows.push([
            staff.name,
            staff.category,
            slot.time,
            roleName,
            partners.join('、') || '-'
          ]);
        });
      });

      Utils.exportToCsv(`夜市_個人別シフト_${ev.title}_${ev.date}.csv`, rows);
      Utils.showToast('個人別シフトのCSVをダウンロードしました', 'success');
      return;
    }

    // 全体マトリクスCSV
    const rows = [];
    rows.push([`【夜市】イベントシフト表: ${ev.title}`, `開催日: ${ev.date}`]);
    rows.push([]);

    // ヘッダー
    const headerRow = ['時間帯'];
    roles.forEach(r => headerRow.push(r.name));
    rows.push(headerRow);

    // データ行
    timeSlots.forEach(slot => {
      const row = [slot.time];
      roles.forEach(role => {
        const slotKey = `${slot.id}_${role.id}`;
        const memberIds = assignments[slotKey] || [];
        const names = memberIds.map(mid => {
          const staff = window.appStore.data.staffList.find(s => s.id === mid);
          return staff ? `${staff.name}(${staff.category})` : '';
        }).filter(Boolean).join('、');

        row.push(names || '-');
      });
      rows.push(row);
    });

    Utils.exportToCsv(`夜市_イベントシフト_${ev.title}_${ev.date}.csv`, rows);
    Utils.showToast('シフト表のCSVをダウンロードしました', 'success');
  }
};

window.EventShiftModule = EventShiftModule;
