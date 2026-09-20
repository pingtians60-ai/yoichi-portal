/* ==========================================================================
   夜市 (Yoichi) - Main Application Coordinator (Event Shift Supported)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

const App = {
  currentTab: 'dashboard',

  init() {
    this.startOpeningAnimation();
    this.setupTheme();
    this.bindNavigation();
    this.bindGlobalEvents();
    this.bindLoginEvents();

    // モジュールの初期化
    DashboardModule.init();
    ScheduleModule.init();
    EventShiftModule.init();
    MembersModule.init();
    ShopsModule.init();

    this.checkLoginState();

    // ストアの変更を購読してリアクティブに各画面を再描画
    window.appStore.subscribe(() => {
      this.checkLoginState();
      this.refreshAll();
    });

    console.log('夜市 (Yoichi) Schedule & Event Shift Portal initialized successfully.');
  },

  startOpeningAnimation() {
    const openingScreen = document.getElementById('opening-screen');
    if (!openingScreen) return;

    const hasPlayed = sessionStorage.getItem('yoichi_intro_played');

    if (hasPlayed === 'true') {
      // Bypass opening intro on repeat loads
      document.body.classList.add('app-no-intro');
      openingScreen.remove();
      return;
    }

    // First load in session: play full animation
    setTimeout(() => {
      // Fade out opening logo and subtitle
      const logo = openingScreen.querySelector('.opening-logo');
      const subtitle = openingScreen.querySelector('.opening-subtitle');
      const loader = openingScreen.querySelector('.opening-loader');
      
      if (logo) logo.style.transition = 'opacity 0.5s cubic-bezier(0.25, 1, 0.5, 1), transform 0.5s cubic-bezier(0.25, 1, 0.5, 1), filter 0.5s ease';
      if (subtitle) subtitle.style.transition = 'opacity 0.5s cubic-bezier(0.25, 1, 0.5, 1), transform 0.5s cubic-bezier(0.25, 1, 0.5, 1), filter 0.5s ease';
      if (loader) loader.style.transition = 'opacity 0.4s ease, transform 0.4s ease';

      if (logo) {
        logo.style.opacity = '0';
        logo.style.transform = 'scale(1.2) translateY(-20px)';
        logo.style.filter = 'blur(15px)';
      }
      if (subtitle) {
        subtitle.style.opacity = '0';
        subtitle.style.transform = 'translateY(20px)';
        subtitle.style.filter = 'blur(10px)';
      }
      if (loader) {
        loader.style.opacity = '0';
        loader.style.transform = 'scaleX(0.8)';
      }
    }, 1800);

    setTimeout(() => {
      // Transition app ready: start fading out the background overlay and showing the dashboard
      document.body.classList.add('app-ready');
      openingScreen.style.opacity = '0';
      openingScreen.style.transform = 'scale(1.15)';
      openingScreen.style.filter = 'blur(20px)';
      openingScreen.style.pointerEvents = 'none';
    }, 2000);

    setTimeout(() => {
      // Clean up opening screen and mark as played
      openingScreen.remove();
      sessionStorage.setItem('yoichi_intro_played', 'true');
    }, 2800);
  },

  refreshAll() {
    DashboardModule.render();
    ScheduleModule.render();
    EventShiftModule.render();
    MembersModule.render();
    ShopsModule.render();
  },

  bindNavigation() {
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        const tab = e.currentTarget.dataset.tab;
        if (tab) {
          this.switchTab(tab);
        }
      });
    });

    // モバイルボトムナビゲーションのバインド
    const bottomNavItems = document.querySelectorAll('.mobile-bottom-nav .bottom-nav-item');
    bottomNavItems.forEach(item => {
      item.addEventListener('click', (e) => {
        const tab = e.currentTarget.dataset.tab;
        if (tab) {
          this.switchTab(tab);
        }
      });
    });

    // ブランドロゴ（アイコンとタイトルテキスト）をクリックしたときにホームに戻る
    document.querySelector('.brand-logo')?.addEventListener('click', () => {
      this.switchTab('dashboard');
    });

    // モバイル用サイドバートグル
    const sidebar = document.querySelector('.app-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');

    const toggleSidebar = (open) => {
      const shouldOpen = open !== undefined ? open : !sidebar?.classList.contains('open');
      sidebar?.classList.toggle('open', shouldOpen);
      backdrop?.classList.toggle('show', shouldOpen);
      if (window.innerWidth <= 768) {
        document.body.style.overflow = shouldOpen ? 'hidden' : '';
      }
    };

    this.toggleSidebar = toggleSidebar;

    document.getElementById('btn-toggle-sidebar')?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSidebar();
    });

    document.getElementById('btn-close-sidebar')?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSidebar(false);
    });

    backdrop?.addEventListener('click', () => {
      toggleSidebar(false);
    });

    // ESCキーでサイドバーを閉じる
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && sidebar?.classList.contains('open')) {
        toggleSidebar(false);
      }
    });

    // モーダル閉じるボタンの共通ハンドラ
    document.querySelectorAll('.btn-close-modal').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modalBackdrop = e.currentTarget.closest('.modal-backdrop');
        if (modalBackdrop) {
          Utils.closeModal(modalBackdrop.id);
        }
      });
    });

    // モーダル背景クリックで閉じる
    document.querySelectorAll('.modal-backdrop').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          Utils.closeModal(modal.id);
        }
      });
    });
  },

  switchTab(tabName) {
    this.currentTab = tabName;

    // ナビゲーションのactive更新 (サイドバー & ボトムナビ)
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.tab === tabName);
    });

    document.querySelectorAll('.mobile-bottom-nav .bottom-nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.tab === tabName);
    });

    // ビューセクションの切り替え
    document.querySelectorAll('.view-section').forEach(section => {
      section.classList.remove('active');
    });

    const targetSection = document.getElementById(`view-${tabName}`);
    if (targetSection) {
      targetSection.classList.add('active');
    }

    // ヘッダータイトルの更新
    const titleMap = {
      dashboard: 'ホーム',
      schedule: 'スケジュール管理',
      'event-shift': 'イベントシフト管理',
      settings: 'メンバー・設定',
      shops: '出店・出演者一覧'
    };

    const headerTitle = document.getElementById('header-page-title');
    if (headerTitle) {
      headerTitle.textContent = titleMap[tabName] || 'PORTAL';
    }

    // タブ切り替え時の再描画
    if (tabName === 'dashboard') DashboardModule.render();
    if (tabName === 'schedule') ScheduleModule.render();
    if (tabName === 'event-shift') EventShiftModule.render();
    if (tabName === 'settings') MembersModule.render();
    if (tabName === 'shops') {
      ShopsModule.render();
      MembersModule.renderPerformerList();
    }

    // モバイルサイドバーを閉じる
    if (this.toggleSidebar) {
      this.toggleSidebar(false);
    } else {
      document.querySelector('.app-sidebar')?.classList.remove('open');
      document.getElementById('sidebar-backdrop')?.classList.remove('show');
    }
  },

  setupTheme() {
    const savedTheme = localStorage.getItem('yoichi_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    this.updateThemeButton(savedTheme);

    document.getElementById('btn-toggle-theme')?.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('yoichi_theme', next);
      this.updateThemeButton(next);
    });
  },

  updateThemeButton(theme) {
    const btn = document.getElementById('btn-toggle-theme');
    if (btn) {
      btn.innerHTML = theme === 'dark' ? '☀️' : '🌙';
      btn.title = theme === 'dark' ? 'ライトモードに切替' : 'ダークモードに切替';
    }
  },

  bindGlobalEvents() {
    // グローバル検索
    const searchInput = document.getElementById('global-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (!query) {
          ScheduleModule.filterCategory = 'all';
          ScheduleModule.render();
          return;
        }

        // スケジュールタブに切り替えてフィルタ適用
        this.switchTab('schedule');
        const container = document.getElementById('calendar-view-container');
        if (container) {
          ScheduleModule.currentView = 'agenda';
          document.querySelectorAll('.view-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.view === 'agenda');
          });
          ScheduleModule.render();
        }
      });
    }

    // クイックアクション
    document.getElementById('dash-btn-quick-event')?.addEventListener('click', () => {
      ScheduleModule.openEventModal();
    });

    document.getElementById('dash-btn-view-calendar')?.addEventListener('click', () => {
      this.switchTab('schedule');
    });

    document.getElementById('dash-btn-quick-event-shift')?.addEventListener('click', () => {
      this.switchTab('event-shift');
    });
  },

  checkLoginState() {
    const loginScreen = document.getElementById('login-screen');
    if (!loginScreen) return;

    const u = window.appStore.data.currentUser;
    if (u) {
      loginScreen.style.display = 'none';
    } else {
      loginScreen.style.display = 'flex';
      const input = document.getElementById('login-attendance-number');
      if (input) input.value = '';
      const errorMsg = document.getElementById('login-error-msg');
      if (errorMsg) {
        errorMsg.textContent = '';
        errorMsg.style.display = 'none';
      }
    }
  },

  bindLoginEvents() {
    // ログインフォーム送信
    document.getElementById('form-login')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const attendanceNumber = document.getElementById('login-attendance-number').value.trim();
      const errorMsg = document.getElementById('login-error-msg');

      if (!attendanceNumber) {
        if (errorMsg) {
          errorMsg.textContent = '背番号を入力してください。';
          errorMsg.style.display = 'block';
        }
        return;
      }

      const user = window.appStore.login(attendanceNumber);
      if (user) {
        Utils.showToast(`操作ユーザー「${user.name}」としてログインしました`, 'success');
        this.checkLoginState();
        this.refreshAll();
      } else {
        if (errorMsg) {
          errorMsg.textContent = '登録されていない背番号です。';
          errorMsg.style.display = 'block';
          // アニメーションのリセット（シェイク効果）
          errorMsg.style.animation = 'none';
          errorMsg.offsetHeight; /* trigger reflow */
          errorMsg.style.animation = null;
        }
      }
    });

    // ログアウトボタン
    document.getElementById('btn-logout')?.addEventListener('click', (e) => {
      e.stopPropagation(); // 親要素のクリックイベントを防ぐ
      if (confirm('ログアウトしますか？')) {
        window.appStore.logout();
        Utils.showToast('ログアウトしました', 'info');
        this.checkLoginState();
      }
    });
  }
};

window.App = App;
