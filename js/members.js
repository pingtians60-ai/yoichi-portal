/* ==========================================================================
   夜市 (Yoichi) - Members & Settings Module
   ========================================================================== */

const MembersModule = {
  init() {
    this.bindEvents();
    this.render();
  },

  bindEvents() {
    // 新規スタッフ追加ボタン
    document.getElementById('btn-add-staff')?.addEventListener('click', () => {
      this.openStaffModal();
    });

    // スタッフ保存フォーム
    document.getElementById('form-staff')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveStaff();
    });

    // スタッフ削除ボタン
    document.getElementById('btn-delete-staff')?.addEventListener('click', (e) => {
      this.deleteStaff(e);
    });

    // データリセットボタン
    document.getElementById('btn-reset-data')?.addEventListener('click', () => {
      if (confirm('すべての予定・メンバーデータを初期状態にリセットしますか？')) {
        window.appStore.resetData();
        Utils.showToast('データを初期化しました', 'warning');
      }
    });

    // JSONエクスポート
    document.getElementById('btn-export-json')?.addEventListener('click', () => {
      window.appStore.exportJson();
    });

    // JSONインポート
    document.getElementById('btn-import-json-trigger')?.addEventListener('click', () => {
      document.getElementById('input-import-json')?.click();
    });

    document.getElementById('input-import-json')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const data = JSON.parse(event.target.result);
            if (window.appStore.importJson(data)) {
              Utils.showToast('データをインポートしました', 'success');
            } else {
              Utils.showToast('無効なデータ形式です', 'danger');
            }
          } catch (err) {
            Utils.showToast('JSONファイルの読み込みに失敗しました', 'danger');
          }
        };
        reader.readAsText(file);
      }
    });
    // 新規出演者追加ボタン
    document.getElementById('btn-add-performer')?.addEventListener('click', () => {
      this.openPerformerModal();
    });

    // 出演者保存フォーム
    document.getElementById('form-performer')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.savePerformer();
    });

    // 出演者削除ボタン
    document.getElementById('btn-delete-performer')?.addEventListener('click', (e) => {
      this.deletePerformer(e);
    });
  },

  render() {
    this.renderStaffList();
    this.renderPerformerList();
    this.updateUserSwitcher();

    const isAdmin = window.appStore.isAdmin();
    const btnAddStaff = document.getElementById('btn-add-staff');
    if (btnAddStaff) {
      btnAddStaff.style.display = isAdmin ? 'block' : 'none';
    }
    const btnAddPerformer = document.getElementById('btn-add-performer');
    if (btnAddPerformer) {
      btnAddPerformer.style.display = isAdmin ? 'block' : 'none';
    }
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

  getProgramBadgeClass(program) {
    switch (program) {
      case '夜市・朝市':
      case '夜市':
        return 'badge-prog-yoichi';
      case 'FIZZ':
        return 'badge-prog-fizz';
      case 'TAKE ACTION':
        return 'badge-prog-takeaction';
      case '総務':
        return 'badge-prog-soumu';
      case 'マーケティング':
        return 'badge-prog-marketing';
      case 'なし':
      default:
        return 'badge-prog-none';
    }
  },

  updateUserSwitcher() {
    const select = document.getElementById('user-switch-select');
    if (select) {
      const switcherWrapper = select.closest('div');
      if (switcherWrapper) switcherWrapper.remove();
      else select.remove();
    }

    const u = window.appStore.data.currentUser;

    // サイドバーのプロファイル更新
    const avatarEl = document.getElementById('sidebar-user-avatar');
    const nameEl = document.getElementById('sidebar-user-name');
    const roleEl = document.getElementById('sidebar-user-role');

    if (u) {
      if (avatarEl) {
        avatarEl.textContent = u.avatar || u.name.charAt(0);
        avatarEl.style.backgroundColor = 'var(--primary-600)';
      }
      if (nameEl) nameEl.textContent = u.name;
      // 権限（管理者/スタッフ）は表示せずカテゴリーのみ表示
      if (roleEl) roleEl.textContent = u.category;
    } else {
      if (avatarEl) avatarEl.textContent = '';
      if (nameEl) nameEl.textContent = '未ログイン';
      if (roleEl) roleEl.textContent = '';
    }
  },

  renderStaffList() {
    const container = document.getElementById('staff-table-body');
    if (!container) return;
    container.innerHTML = '';

    const isAdmin = window.appStore.isAdmin();
    const currentUserId = window.appStore.data.currentUser?.id;

    // テーブルヘッダーの権限/操作列の表示/非表示
    const roleHeader = document.getElementById('staff-th-role');
    if (roleHeader) {
      roleHeader.style.display = isAdmin ? '' : 'none';
    }
    const actionHeader = document.getElementById('staff-th-action');
    if (actionHeader) {
      actionHeader.style.display = isAdmin ? '' : 'none';
    }

    // 名簿を背番号順（昇順）に並べ替え（名前が「管理者」のアカウントは先頭）
    const staffList = Utils.sortStaffList(window.appStore.data.staffList);

    staffList.forEach(staff => {
      const tr = document.createElement('tr');
      const badgeClass = this.getCategoryBadgeClass(staff.category);

      let roleColHtml = '';
      if (isAdmin) {
        roleColHtml = `
          <td style="padding:0.75rem 1rem;">
            <span class="badge ${staff.role === 'manager' ? 'badge-primary' : 'badge-info'}">
              ${staff.role === 'manager' ? '管理者' : 'メンバー'}
            </span>
          </td>
        `;
      }

      let actionColHtml = '';
      if (isAdmin) {
        actionColHtml = `
          <td style="padding:0.75rem 1rem; text-align:right;">
            <button class="btn btn-secondary btn-sm" onclick="MembersModule.openStaffModal('${staff.id}')">編集</button>
          </td>
        `;
      }

      // 名前が「管理者」の人だけ背番号を表示しない（権限が管理者の通常メンバーは背番号を表示する）
      const isMasterAdmin = staff.name === '管理者' || staff.id === 'u1';
      let attendanceHtml = '';
      if (!isMasterAdmin && staff.attendance_number) {
        attendanceHtml = `<span style="font-size:0.72rem; color:var(--text-muted); font-weight:normal;">背番号: ${staff.attendance_number}</span>`;
      }

      const programs = Utils.parseProgram(staff.program);
      let progHtml = '';
      if (programs.length === 0) {
        progHtml = `<span class="badge badge-prog-none" style="font-weight:700;">なし</span>`;
      } else {
        progHtml = `<div style="display:flex; flex-wrap:wrap; gap:0.25rem;">` +
          programs.map(p => {
            const progBadgeClass = this.getProgramBadgeClass(p);
            return `<span class="badge ${progBadgeClass}" style="font-weight:700;">${p}</span>`;
          }).join('') +
        `</div>`;
      }

      tr.innerHTML = `
        <td style="padding:0.75rem 1rem;">
          <div style="display:flex; align-items:center; gap:0.6rem;">
            <span class="avatar-sm" style="background-color: var(--primary-600);">${staff.avatar}</span>
            <div style="display:flex; flex-direction:column;">
              <strong>${staff.name}</strong>
              ${attendanceHtml}
            </div>
          </div>
        </td>
        <td style="padding:0.75rem 1rem;">
          <span class="badge ${badgeClass}" style="font-weight:700;">${staff.category}</span>
        </td>
        <td style="padding:0.75rem 1rem;">
          ${progHtml}
        </td>
        ${roleColHtml}
        ${actionColHtml}
      `;
      container.appendChild(tr);
    });
  },

  openStaffModal(staffId = null) {
    const modal = document.getElementById('modal-staff');
    if (!modal) return;

    const isAdmin = window.appStore.isAdmin();
    const roleGroup = document.getElementById('staff-role-group');
    if (roleGroup) {
      // 管理者のみ権限の操作・表示が可能
      roleGroup.style.display = isAdmin ? 'block' : 'none';
    }

    const deleteBtn = document.getElementById('btn-delete-staff');
    const programCheckboxes = document.querySelectorAll('input[name="staff_program"]');

    if (staffId) {
      const staff = window.appStore.data.staffList.find(s => s.id === staffId);
      if (!staff) return;
      const isMasterAdmin = staff.name === '管理者' || staff.id === 'u1';

      if (deleteBtn) {
        deleteBtn.style.display = (isAdmin && !isMasterAdmin) ? 'inline-flex' : 'none';
      }

      document.getElementById('modal-staff-title').textContent = 'メンバー情報の編集';
      document.getElementById('staff-id').value = staff.id;
      document.getElementById('staff-name').value = staff.name;
      
      // 名前が「管理者」のアカウントのみパスワードとしてマスク
      const attendanceInput = document.getElementById('staff-attendance-number');
      if (isMasterAdmin) {
        attendanceInput.value = '';
        attendanceInput.placeholder = '●●●● (変更する場合のみ入力)';
        attendanceInput.required = false;
      } else {
        attendanceInput.value = staff.attendance_number || '';
        attendanceInput.placeholder = '背番号を入力';
        attendanceInput.required = true;
      }

      document.getElementById('staff-category').value = staff.category || 'Member';

      const staffPrograms = Utils.parseProgram(staff.program);
      programCheckboxes.forEach(cb => {
        cb.checked = staffPrograms.includes(cb.value);
      });

      document.getElementById('staff-role').value = staff.role || 'staff';
    } else {
      if (deleteBtn) {
        deleteBtn.style.display = 'none';
      }

      document.getElementById('modal-staff-title').textContent = '新規メンバーの追加';
      document.getElementById('staff-id').value = '';
      document.getElementById('staff-name').value = '';
      const attendanceInput = document.getElementById('staff-attendance-number');
      attendanceInput.value = '';
      attendanceInput.placeholder = '背番号を入力';
      attendanceInput.required = true;

      document.getElementById('staff-category').value = 'Member';
      programCheckboxes.forEach(cb => {
        cb.checked = false;
      });
      document.getElementById('staff-role').value = 'staff';
    }

    Utils.openModal('modal-staff');
  },

  saveStaff() {
    const id = document.getElementById('staff-id').value;
    const name = document.getElementById('staff-name').value.trim();
    let attendance_number = document.getElementById('staff-attendance-number').value.trim();
    const category = document.getElementById('staff-category').value;
    const checkedProgs = Array.from(document.querySelectorAll('input[name="staff_program"]:checked')).map(cb => cb.value);
    const program = checkedProgs.length > 0 ? checkedProgs.join(', ') : 'なし';
    
    // 管理者のみ権限の指定が可能。一般スタッフの場合は既存のroleまたは'staff'を維持
    const isAdmin = window.appStore.isAdmin();
    let role = 'staff';
    let existingStaff = null;
    if (id) {
      existingStaff = window.appStore.data.staffList.find(s => s.id === id);
      if (existingStaff) role = existingStaff.role || 'staff';
    }
    if (isAdmin) {
      role = document.getElementById('staff-role').value;
    }

    if (!name) {
      Utils.showToast('名前を入力してください', 'danger');
      return;
    }

    // 名前が「管理者」のアカウントの場合、背番号が空欄なら既存のものを保持
    const isMasterAdmin = existingStaff && (existingStaff.name === '管理者' || existingStaff.id === 'u1');
    if (isMasterAdmin && !attendance_number) {
      attendance_number = existingStaff.attendance_number || '0138';
    }

    if (!attendance_number) {
      Utils.showToast('背番号を入力してください', 'danger');
      return;
    }

    // 重複チェック
    const existing = window.appStore.data.staffList.find(s => 
      s.id !== id && String(s.attendance_number).trim() === String(attendance_number)
    );
    if (existing) {
      Utils.showToast(`背番号「${attendance_number}」はすでに「${existing.name}」として登録されています`, 'danger');
      return;
    }

    const staffData = {
      name,
      attendance_number,
      category,
      program,
      role,
      avatar: name.charAt(0)
    };
    if (id) staffData.id = id;

    window.appStore.saveStaff(staffData);
    Utils.showToast(id ? 'メンバー情報を更新しました' : '新規メンバーを追加しました', 'success');

    Utils.closeModal('modal-staff');
  },

  deleteStaff(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const idEl = document.getElementById('staff-id');
    const id = idEl.value;
    if (!id) return;

    this.executeDeleteStaff(id, () => {
      idEl.value = '';
      Utils.closeModal('modal-staff');
    });
  },

  deleteStaffDirect(id) {
    if (!id) return;
    this.executeDeleteStaff(id);
  },

  executeDeleteStaff(id, callback) {
    const staff = window.appStore.data.staffList.find(s => s.id === id);
    if (!staff) return;

    const isMasterAdmin = staff.name === '管理者' || staff.id === 'u1';
    if (isMasterAdmin) {
      Utils.showToast('管理者アカウントは削除できません', 'danger');
      return;
    }

    const isCurrent = window.appStore.data.currentUser && window.appStore.data.currentUser.id === id;
    let confirmMsg = `メンバー「${staff.name}」（背番号: ${staff.attendance_number || '-'}）を削除しますか？\n※関連するシフトやイベント参加者の登録も自動的に解除されます。`;
    if (isCurrent) {
      confirmMsg += '\n\n【注意】現在ログイン中のアカウントです。削除するとログアウトされます。';
    }

    if (confirm(confirmMsg)) {
      const staffName = staff.name;
      window.appStore.deleteStaff(id);
      if (callback) callback();
      Utils.showToast(`メンバー「${staffName}」を削除しました`, 'warning');
      this.renderStaffList();
      this.updateUserSwitcher();
    }
  },

  // =========================================================================
  // 出演者 (Performers) 一覧管理
  // =========================================================================
  renderPerformerList() {
    const container = document.getElementById('performer-table-body');
    if (!container) return;
    container.innerHTML = '';

    const performerList = window.appStore.data.performerList || [];
    const isAdmin = window.appStore.isAdmin();

    const actionHeader = document.getElementById('performer-th-action');
    if (actionHeader) {
      actionHeader.style.display = isAdmin ? '' : 'none';
    }

    if (performerList.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td colspan="${isAdmin ? 7 : 6}" style="text-align:center; padding:2rem; color:var(--text-muted);">
          登録されている出演者はいません。
        </td>
      `;
      container.appendChild(tr);
      return;
    }

    performerList.forEach(perf => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid var(--border-subtle)';

      const genreColor = Utils.stringToColor(perf.genre || 'ステージ');

      let actionHtml = '';
      if (isAdmin) {
        actionHtml = `
          <td style="padding:0.75rem 1rem; text-align:right;">
            <button class="btn btn-secondary btn-sm" onclick="MembersModule.openPerformerModal('${perf.id}')">編集</button>
          </td>
        `;
      }

      const emailHtml = perf.email
        ? `<a href="mailto:${Utils.escapeHtml(perf.email)}" style="color:var(--primary-400); text-decoration:underline; font-weight:600;">✉️ ${Utils.escapeHtml(perf.email)}</a>`
        : '<span style="color:var(--text-muted);">-</span>';

      const phoneHtml = perf.phone
        ? `<a href="tel:${Utils.escapeHtml(perf.phone)}" style="color:var(--primary-400); text-decoration:underline; font-weight:600;">📞 ${Utils.escapeHtml(perf.phone)}</a>`
        : '<span style="color:var(--text-muted);">-</span>';

      const eventInfo = perf.eventName || perf.eventDate
        ? `<strong>${Utils.escapeHtml(perf.eventName || '')}</strong>${perf.eventDate ? `<br><span style="font-size:0.75rem; color:var(--text-muted);">${Utils.escapeHtml(perf.eventDate)}</span>` : ''}`
        : '<span style="color:var(--text-muted);">-</span>';

      const contactNotes = perf.contact || perf.notes
        ? `<span style="font-size:0.78rem;">${Utils.escapeHtml(perf.contact || '')}${perf.contact && perf.notes ? ' / ' : ''}${Utils.escapeHtml(perf.notes || '')}</span>`
        : '<span style="color:var(--text-muted);">-</span>';

      tr.innerHTML = `
        <td style="padding:0.75rem 1rem;">
          <strong>${Utils.escapeHtml(perf.name)}</strong>
        </td>
        <td style="padding:0.75rem 1rem;">
          <span class="badge" style="background-color:${genreColor}20; color:${genreColor}; font-weight:700;">
            ${Utils.escapeHtml(perf.genre || 'ステージ')}
          </span>
        </td>
        <td style="padding:0.75rem 1rem;">
          ${eventInfo}
        </td>
        <td style="padding:0.75rem 1rem;">
          ${emailHtml}
        </td>
        <td style="padding:0.75rem 1rem;">
          ${phoneHtml}
        </td>
        <td style="padding:0.75rem 1rem;">
          ${contactNotes}
        </td>
        ${actionHtml}
      `;
      container.appendChild(tr);
    });
  },

  openPerformerModal(performerId = null) {
    const modal = document.getElementById('modal-performer');
    if (!modal) return;

    const titleEl = document.getElementById('modal-performer-title');
    const deleteBtn = document.getElementById('btn-delete-performer');

    if (performerId) {
      titleEl.textContent = '出演者情報の編集';
      deleteBtn.style.display = 'inline-flex';

      const perf = (window.appStore.data.performerList || []).find(p => p.id === performerId);
      if (perf) {
        document.getElementById('performer-id').value = perf.id;
        document.getElementById('performer-name').value = perf.name || '';
        document.getElementById('performer-genre').value = perf.genre || '';
        document.getElementById('performer-event').value = perf.eventName || '';
        document.getElementById('performer-date').value = perf.eventDate || '';
        document.getElementById('performer-email').value = perf.email || '';
        document.getElementById('performer-phone').value = perf.phone || '';
        document.getElementById('performer-contact').value = perf.contact || '';
        document.getElementById('performer-notes').value = perf.notes || '';
      }
    } else {
      titleEl.textContent = '新規出演者の追加';
      deleteBtn.style.display = 'none';

      document.getElementById('performer-id').value = '';
      document.getElementById('performer-name').value = '';
      document.getElementById('performer-genre').value = '';
      document.getElementById('performer-event').value = '';
      document.getElementById('performer-date').value = '';
      document.getElementById('performer-email').value = '';
      document.getElementById('performer-phone').value = '';
      document.getElementById('performer-contact').value = '';
      document.getElementById('performer-notes').value = '';
    }

    Utils.openModal('modal-performer');
  },

  savePerformer() {
    const id = document.getElementById('performer-id').value;
    const name = document.getElementById('performer-name').value.trim();
    const genre = document.getElementById('performer-genre').value.trim();
    const eventName = document.getElementById('performer-event').value.trim();
    const eventDate = document.getElementById('performer-date').value.trim();
    const email = document.getElementById('performer-email').value.trim();
    const phone = document.getElementById('performer-phone').value.trim();
    const contact = document.getElementById('performer-contact').value.trim();
    const notes = document.getElementById('performer-notes').value.trim();

    if (!name || !genre) {
      Utils.showToast('出演者名とジャンルを入力してください', 'danger');
      return;
    }

    const perfData = {
      name,
      genre,
      eventName,
      eventDate,
      email,
      phone,
      contact,
      notes
    };

    if (id) {
      perfData.id = id;
      window.appStore.updatePerformer(perfData);
      Utils.showToast('出演者情報を更新しました', 'success');
    } else {
      window.appStore.addPerformer(perfData);
      Utils.showToast('新規出演者を追加しました', 'success');
    }

    Utils.closeModal('modal-performer');
    this.renderPerformerList();
  },

  deletePerformer(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const idEl = document.getElementById('performer-id');
    const id = idEl.value;
    if (!id) return;

    const perf = (window.appStore.data.performerList || []).find(p => p.id === id);
    if (!perf) return;

    idEl.value = '';

    if (confirm(`出演者「${perf.name}」のデータを削除しますか？`)) {
      window.appStore.deletePerformer(id);
      Utils.closeModal('modal-performer');
      Utils.showToast('出演者データを削除しました', 'warning');
      this.renderPerformerList();
    } else {
      idEl.value = id;
    }
  }
};

window.MembersModule = MembersModule;
