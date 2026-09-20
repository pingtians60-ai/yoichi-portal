/* ==========================================================================
   SyncWork Enterprise - Utilities & Helpers
   ========================================================================== */

const Utils = {
  /**
   * Format date to YYYY-MM-DD
   */
  formatDateKey(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  /**
   * Format date for Japanese display (e.g. 2026年8月18日(火))
   */
  formatDateJP(date, includeDayName = true) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    const dayName = dayNames[d.getDay()];

    if (includeDayName) {
      return `${year}年${month}月${day}日 (${dayName})`;
    }
    return `${year}年${month}月${day}日`;
  },

  /**
   * Format time (e.g. 09:00)
   */
  formatTime(dateOrStr) {
    if (!dateOrStr) return '';
    if (typeof dateOrStr === 'string' && dateOrStr.includes(':')) {
      return dateOrStr.substring(0, 5);
    }
    const d = new Date(dateOrStr);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  },

  /**
   * Get days in month
   */
  getDaysInMonth(year, monthIndex) {
    return new Date(year, monthIndex + 1, 0).getDate();
  },

  /**
   * Generate UUID v4
   */
  generateId() {
    return 'item_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
  },

  /**
   * Simple Japanese Holidays Check (Calculates standard Japanese holidays)
   */
  getJapaneseHoliday(year, month, day) {
    // month is 1-indexed (1 to 12)
    const m = month;
    const d = day;
    const date = new Date(year, m - 1, d);
    const dayOfWeek = date.getDay(); // 0 is Sun, 1 is Mon...

    // 固定祝日
    if (m === 1 && d === 1) return '元日';
    if (m === 2 && d === 11) return '建国記念の日';
    if (m === 2 && d === 23) return '天皇誕生日';
    if (m === 4 && d === 29) return '昭和の日';
    if (m === 5 && d === 3) return '憲法記念日';
    if (m === 5 && d === 4) return 'みどりの日';
    if (m === 5 && d === 5) return 'こどもの日';
    if (m === 8 && d === 11) return '山の日';
    if (m === 11 && d === 3) return '文化の日';
    if (m === 11 && d === 23) return '勤労感謝の日';

    // ハッピーマンデー制度
    // 成人の日 (1月第2月曜日)
    if (m === 1 && dayOfWeek === 1 && d >= 8 && d <= 14) return '成人の日';
    // 海の日 (7月第3月曜日)
    if (m === 7 && dayOfWeek === 1 && d >= 15 && d <= 21) return '海の日';
    // 敬老の日 (9月第3月曜日)
    if (m === 9 && dayOfWeek === 1 && d >= 15 && d <= 21) return '敬老の日';
    // スポーツの日 (10月第2月曜日)
    if (m === 10 && dayOfWeek === 1 && d >= 8 && d <= 14) return 'スポーツの日';

    // 簡易春分・秋分（2000〜2030年近似式）
    if (m === 3 && d === Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4))) return '春分の日';
    if (m === 9 && d === Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4))) return '秋分の日';

    return null;
  },

  /**
   * Show interactive toast notification
   */
  showToast(message, type = 'info', duration = 3200) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'danger') icon = '⚠️';
    if (type === 'warning') icon = '🔔';

    toast.innerHTML = `
      <span style="font-size: 1.1rem;">${icon}</span>
      <div style="flex: 1; font-weight: 500; font-size: 0.85rem;">${message}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  /**
   * Modal open/close helpers
   */
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('active');
      const hasOtherActiveModal = Boolean(document.querySelector('.modal-backdrop.active'));
      if (!hasOtherActiveModal) {
        document.body.style.overflow = '';
      }
    }
  },

  /**
   * Export CSV helper
   */
  exportToCsv(filename, rows) {
    const processRow = function (row) {
      let finalVal = '';
      for (let j = 0; j < row.length; j++) {
        let innerValue = row[j] === null || row[j] === undefined ? '' : row[j].toString();
        if (row[j] instanceof Date) {
          innerValue = row[j].toLocaleString();
        }
        let result = innerValue.replace(/"/g, '""');
        if (result.search(/("|,|\n)/g) >= 0)
          result = '"' + result + '"';
        if (j > 0)
          finalVal += ',';
        finalVal += result;
      }
      return finalVal + '\r\n';
    };

    let csvFile = '\uFEFF'; // UTF-8 BOM for Japanese Excel
    for (let i = 0; i < rows.length; i++) {
      csvFile += processRow(rows[i]);
    }

    const blob = new Blob([csvFile], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  },

  /**
   * Convert any string to a beautiful HSL color code
   */
  stringToColor(str) {
    if (!str) return '#4f46e5';
    // 代表的なキーワードに対する固定マッピング（馴染み深い色にするため）
    const fixedColors = {
      '定例': '#4f46e5',
      'mtg': '#4f46e5',
      '全体会議': '#4f46e5',
      '会議': '#4f46e5',
      '企画': '#10b981',
      '打ち合わせ': '#10b981',
      '打合せ': '#10b981',
      '本番': '#f59e0b',
      'イベント': '#f59e0b',
      '締切': '#ef4444',
      '期限': '#ef4444',
      '提出': '#ef4444',
      '勉強会': '#a855f7',
      '合宿': '#a855f7',
      '交流': '#a855f7'
    };
    
    // キーワード部分一致チェック
    const lowerStr = str.toLowerCase();
    for (const key of Object.keys(fixedColors)) {
      if (lowerStr.includes(key)) {
        return fixedColors[key];
      }
    }

    // マッチしない場合はハッシュでカラー生成
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360;
    return `hsl(${h}, 70%, 45%)`;
  },

  /**
   * Escape HTML to prevent XSS and formatting breaks
   */
  escapeHtml(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/[&<>'"]/g, 
      tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || tag)
    );
  },

  /**
   * Parse program values into array of clean program names
   */
  parseProgram(raw) {
    if (!raw) return [];
    const validPrograms = ['夜市・朝市', 'FIZZ', 'TAKE ACTION', '総務', 'マーケティング'];
    const normalize = (val) => {
      if (!val) return '';
      let s = String(val).trim();
      if (s === '夜市') s = '夜市・朝市';
      return s;
    };

    let list = [];
    if (Array.isArray(raw)) {
      list = raw;
    } else if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (!trimmed || trimmed === 'なし') return [];
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) list = parsed;
        } catch (e) {
          list = trimmed.split(',');
        }
      } else {
        list = trimmed.split(',');
      }
    }

    const cleaned = list
      .map(normalize)
      .filter(p => p && p !== 'なし' && validPrograms.includes(p));
    
    // 重複を排除して返す
    return Array.from(new Set(cleaned));
  },

  /**
   * Sort staff list by attendance number (asc), keeping Master Admin at top
   */
  sortStaffList(list) {
    if (!Array.isArray(list)) return [];
    return [...list].sort((a, b) => {
      const aIsMaster = a.name === '管理者' || a.id === 'u1';
      const bIsMaster = b.name === '管理者' || b.id === 'u1';
      if (aIsMaster && !bIsMaster) return -1;
      if (!aIsMaster && bIsMaster) return 1;

      const numA = parseInt(a.attendance_number, 10);
      const numB = parseInt(b.attendance_number, 10);
      const hasNumA = !isNaN(numA);
      const hasNumB = !isNaN(numB);

      if (hasNumA && hasNumB) {
        if (numA !== numB) return numA - numB;
        return (a.name || '').localeCompare(b.name || '', 'ja');
      }
      if (hasNumA) return -1;
      if (hasNumB) return 1;

      return String(a.attendance_number || '').localeCompare(String(b.attendance_number || '')) || (a.name || '').localeCompare(b.name || '', 'ja');
    });
  }
};

