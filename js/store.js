/* ==========================================================================
   夜市 (Yoichi) - Data Store & State Management (Event Shift Supported)
   ========================================================================== */

const STORAGE_KEY = 'yoichi_org_portal_v8';

// GAS Web App URL 初期化
let gasApiUrl = null;
if (typeof GAS_API_URL !== 'undefined' && GAS_API_URL && GAS_API_URL !== 'YOUR_GAS_WEBAPP_URL') {
  gasApiUrl = GAS_API_URL;
  console.log('GAS client configured.');
}

// Supabase クライアント初期化
let supabaseClient = null;
if (typeof SUPABASE_URL !== 'undefined' && SUPABASE_KEY !== 'YOUR_SUPABASE_ANON_KEY') {
  try {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('Supabase client initialized.');
  } catch (e) {
    console.error('Failed to initialize Supabase client:', e);
  }
}

class Store {
  constructor() {
    this.listeners = [];
    this.data = this.loadData();
    this.initDatabase();
  }

  parseMembers(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (!trimmed) return [];
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) return parsed;
        } catch (e) {}
      }
      return trimmed.split(',').map(s => s.trim()).filter(Boolean);
    }
    return [];
  }

  parseProgram(raw) {
    if (typeof Utils !== 'undefined' && Utils.parseProgram) {
      return Utils.parseProgram(raw);
    }
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.filter(p => p && p !== 'なし');
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (!trimmed || trimmed === 'なし') return [];
      return trimmed.split(',').map(s => s.trim()).filter(p => p && p !== 'なし');
    }
    return [];
  }

  isGasEnvironment() {
    return typeof google !== 'undefined' && google && google.script && Boolean(google.script.run);
  }

  async initDatabase() {
    if (this.isGasEnvironment() || gasApiUrl) {
      await this.initGAS();
    } else if (supabaseClient) {
      await this.initSupabase();
    } else {
      console.log('Running in LocalStorage-only mode.');
    }
  }

  async initGAS() {
    console.log('Initializing Google Apps Script sync...');
    await this.fetchFromGAS();
    this.subscribeToGAS();
  }

  async fetchFromGAS() {
    try {
      let resData;
      if (this.isGasEnvironment()) {
        resData = await new Promise((resolve, reject) => {
          google.script.run
            .withSuccessHandler(resolve)
            .withFailureHandler(reject)
            .apiGetAll();
        });
      } else if (gasApiUrl) {
        const response = await fetch(`${gasApiUrl}?action=getAll`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        resData = await response.json();
      } else {
        return;
      }

      if (!resData) return;
      if (resData.error) {
        console.warn('GAS fetch warning:', resData.error);
        return;
      }

      // Sync events
      if (resData.events) {
        this.data.events = resData.events.map(e => ({
          id: e.id,
          title: e.title,
          category: e.category,
          date: e.date,
          startTime: e.startTime,
          endTime: e.endTime,
          allDay: String(e.allDay) === 'true',
          members: this.parseMembers(e.members),
          notes: e.notes || ''
        }));
      }

      // Sync shifts
      if (resData.shifts) {
        const shiftsMap = {};
        resData.shifts.forEach(s => {
          shiftsMap[s.event_id] = {
            roles: typeof s.roles === 'string' ? JSON.parse(s.roles || '[]') : (s.roles || []),
            timeSlots: typeof s.timeSlots === 'string' ? JSON.parse(s.timeSlots || '[]') : (s.timeSlots || []),
            assignments: typeof s.assignments === 'string' ? JSON.parse(s.assignments || '{}') : (s.assignments || {})
          };
        });
        this.data.eventShifts = shiftsMap;
      }

      // Sync shops
      if (resData.shops) {
        this.data.shopList = resData.shops.map(s => ({
          id: s.id,
          name: s.name,
          category: s.category,
          eventName: s.eventName,
          eventDate: s.eventDate || '',
          contact: s.contact || '',
          desc: s.desc || '',
          email: s.email || '',
          phone: s.phone || ''
        }));
      }

      // Sync performers
      if (resData.performers) {
        this.data.performerList = resData.performers.map(p => ({
          id: p.id,
          name: p.name,
          genre: p.genre || p.category || '',
          eventName: p.eventName || '',
          eventDate: p.eventDate || '',
          email: p.email || '',
          phone: p.phone || '',
          contact: p.contact || '',
          notes: p.notes || p.desc || ''
        }));
      }

      // Sync staff
      if (resData.staff) {
        this.data.staffList = resData.staff.map(s => {
          const existing = this.data.staffList.find(e => e.id === s.id);
          
          // プログラムの安全なマージ:
          // 1. GASから有効なプログラムが返ってきた場合はそれを採用
          // 2. GASからの値が未定義/空/「なし」で、ローカルに有効なプログラム値がある場合はローカル値を保護
          let rawProg = s.program;
          if (!rawProg || rawProg === 'なし') {
            if (existing && existing.program && existing.program !== 'なし') {
              rawProg = existing.program;
            }
          }
          const progs = this.parseProgram(rawProg);
          const finalProgram = progs.length > 0 ? progs.join(', ') : (existing && existing.program ? existing.program : 'なし');

          return {
            id: s.id,
            name: s.name,
            category: s.category,
            role: s.role,
            avatar: s.avatar || s.name.charAt(0),
            attendance_number: (s.attendance_number !== undefined && s.attendance_number !== null) 
              ? String(s.attendance_number).trim() 
              : (existing ? existing.attendance_number : ''),
            program: finalProgram
          };
        });
      }

      this.saveData();
      console.log('Successfully fetched and synchronized data from Google Sheets (GAS).');
    } catch (e) {
      console.error('Failed to fetch data from GAS:', e);
    }
  }

  subscribeToGAS() {
    if (!this.isGasEnvironment() && !gasApiUrl) return;
    if (this.gasInterval) clearInterval(this.gasInterval);
    this.gasInterval = setInterval(async () => {
      await this.fetchFromGAS();
    }, 15000);
  }

  async postToGAS(action, data) {
    try {
      if (this.isGasEnvironment()) {
        const res = await new Promise((resolve, reject) => {
          google.script.run
            .withSuccessHandler(resolve)
            .withFailureHandler(reject)
            .apiPostAction(action, data);
        });
        return res;
      } else if (gasApiUrl) {
        const response = await fetch(gasApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8'
          },
          body: JSON.stringify({ action, data })
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
      }
    } catch (e) {
      console.error(`Failed to post action [${action}] to GAS:`, e);
      return { error: e.toString() };
    }
  }

  async initSupabase() {
    console.log('Initializing Supabase sync...');
    await this.fetchFromSupabase();
    this.subscribeToSupabase();
  }

  async fetchFromSupabase() {
    if (!supabaseClient) return;
    try {
      const [eventsRes, shiftsRes, shopsRes, staffRes] = await Promise.all([
        supabaseClient.from('yoichi_events').select('*'),
        supabaseClient.from('yoichi_shifts').select('*'),
        supabaseClient.from('yoichi_shops').select('*'),
        supabaseClient.from('yoichi_staff').select('*')
      ]);

      if (eventsRes.data) {
        this.data.events = eventsRes.data.map(e => ({
          id: e.id,
          title: e.title,
          category: e.category,
          date: e.date,
          startTime: e.startTime,
          endTime: e.endTime,
          allDay: Boolean(e.allDay),
          members: this.parseMembers(e.members),
          notes: e.notes || ''
        }));
      }

      if (shiftsRes.data) {
        const shiftsMap = {};
        shiftsRes.data.forEach(s => {
          shiftsMap[s.event_id] = {
            roles: typeof s.roles === 'string' ? JSON.parse(s.roles) : s.roles,
            timeSlots: typeof s.timeSlots === 'string' ? JSON.parse(s.timeSlots) : s.timeSlots,
            assignments: typeof s.assignments === 'string' ? JSON.parse(s.assignments) : s.assignments
          };
        });
        this.data.eventShifts = shiftsMap;
      }

      if (shopsRes.data) {
        this.data.shopList = shopsRes.data.map(s => ({
          id: s.id,
          name: s.name,
          category: s.category,
          eventName: s.eventName,
          eventDate: s.eventDate || '',
          contact: s.contact || '',
          desc: s.desc || '',
          email: s.email || '',
          phone: s.phone || ''
        }));
      }

      if (staffRes.data) {
        this.data.staffList = staffRes.data.map(s => {
          const existing = this.data.staffList.find(e => e.id === s.id);
          let rawProg = s.program;
          if (!rawProg || rawProg === 'なし') {
            if (existing && existing.program && existing.program !== 'なし') {
              rawProg = existing.program;
            }
          }
          const progs = this.parseProgram(rawProg);
          const finalProgram = progs.length > 0 ? progs.join(', ') : (existing && existing.program ? existing.program : 'なし');

          return {
            id: s.id,
            name: s.name,
            category: s.category,
            role: s.role,
            avatar: s.avatar || s.name.charAt(0),
            attendance_number: (s.attendance_number !== undefined && s.attendance_number !== null) ? String(s.attendance_number).trim() : (existing ? existing.attendance_number : ''),
            program: finalProgram
          };
        });
      }

      this.saveData();
      console.log('Successfully fetched and synchronized data from Supabase.');
    } catch (e) {
      console.error('Failed to fetch data from Supabase:', e);
    }
  }

  subscribeToSupabase() {
    if (!supabaseClient) return;

    // スケジュールの同期
    supabaseClient
      .channel('public:yoichi_events')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'yoichi_events' }, payload => {
        const { eventType, new: newRow, old: oldRow } = payload;
        if (eventType === 'INSERT') {
          if (!this.data.events.some(e => e.id === newRow.id)) {
            newRow.members = this.parseMembers(newRow.members);
            this.data.events.push(newRow);
          }
        } else if (eventType === 'UPDATE') {
          const idx = this.data.events.findIndex(e => e.id === newRow.id);
          if (idx !== -1) {
            newRow.members = this.parseMembers(newRow.members);
            this.data.events[idx] = newRow;
          }
        } else if (eventType === 'DELETE') {
          this.data.events = this.data.events.filter(e => e.id !== oldRow.id);
        }
        this.saveData();
      })
      .subscribe();

    // シフトの同期
    supabaseClient
      .channel('public:yoichi_shifts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'yoichi_shifts' }, payload => {
        const { eventType, new: newRow, old: oldRow } = payload;
        if (eventType === 'INSERT' || eventType === 'UPDATE') {
          this.data.eventShifts[newRow.event_id] = {
            roles: typeof newRow.roles === 'string' ? JSON.parse(newRow.roles) : newRow.roles,
            timeSlots: typeof newRow.timeSlots === 'string' ? JSON.parse(newRow.timeSlots) : newRow.timeSlots,
            assignments: typeof newRow.assignments === 'string' ? JSON.parse(newRow.assignments) : newRow.assignments
          };
        } else if (eventType === 'DELETE') {
          delete this.data.eventShifts[oldRow.event_id];
        }
        this.saveData();
      })
      .subscribe();

    // 出店者の同期
    supabaseClient
      .channel('public:yoichi_shops')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'yoichi_shops' }, payload => {
        const { eventType, new: newRow, old: oldRow } = payload;
        if (eventType === 'INSERT') {
          if (!this.data.shopList.some(s => s.id === newRow.id)) {
            this.data.shopList.push(newRow);
          }
        } else if (eventType === 'UPDATE') {
          const idx = this.data.shopList.findIndex(s => s.id === newRow.id);
          if (idx !== -1) this.data.shopList[idx] = newRow;
        } else if (eventType === 'DELETE') {
          this.data.shopList = this.data.shopList.filter(s => s.id !== oldRow.id);
        }
        this.saveData();
      })
      .subscribe();

    // スタッフの同期
    supabaseClient
      .channel('public:yoichi_staff')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'yoichi_staff' }, payload => {
        const { eventType, new: newRow, old: oldRow } = payload;
        if (eventType === 'INSERT') {
          if (!this.data.staffList.some(s => s.id === newRow.id)) {
            this.data.staffList.push(newRow);
          }
        } else if (eventType === 'UPDATE') {
          const idx = this.data.staffList.findIndex(s => s.id === newRow.id);
          if (idx !== -1) this.data.staffList[idx] = newRow;
        } else if (eventType === 'DELETE') {
          this.data.staffList = this.data.staffList.filter(s => s.id !== oldRow.id);
        }
        this.saveData();
      })
      .subscribe();
  }

  getDefaultData() {
    const today = new Date();
    const curYear = today.getFullYear();
    const curMonth = today.getMonth() + 1;
    const curMonthStr = String(curMonth).padStart(2, '0');

    return {
      currentUser: null,
      staffCategories: ['Core', 'Chief', 'Assistant', 'Member', 'Beginner'],
      eventCategories: [
        { id: 'meeting', name: '定例・全体MTG', class: 'event-category-meeting', color: '#4f46e5' },
        { id: 'planning', name: '企画・打ち合わせ', class: 'event-category-sales', color: '#10b981' },
        { id: 'event', name: 'イベント・本番', class: 'event-category-company', color: '#f59e0b' },
        { id: 'deadline', name: '提出締切・期限', class: 'event-category-deadline', color: '#ef4444' },
        { id: 'workshop', name: '勉強会・合宿・交流', class: 'event-category-training', color: '#a855f7' }
      ],
      staffList: [
        {
          id: 'u1',
          name: '管理者',
          role: 'manager',
          category: 'Core',
          avatar: '管',
          attendance_number: '0138',
          program: '夜市・朝市'
        },
        {
          id: 'u_item_lgadwcfmu3wegw4',
          name: '武市太陽',
          role: 'manager',
          category: 'Core',
          avatar: '武',
          attendance_number: '1626',
          program: 'なし'
        },
        {
          id: 'u_item_jbntbwvmu9ji5as',
          name: '岡本あづき',
          role: 'staff',
          category: 'Member',
          avatar: '岡',
          attendance_number: '3220',
          program: 'なし'
        },
        {
          id: 'u_item_vn8a3ykmu9jiphx',
          name: '森本香菜',
          role: 'staff',
          category: 'Assistant',
          avatar: '森',
          attendance_number: '3290',
          program: 'なし'
        }
      ],
      events: [
        {
          id: 'ev_main_yoichi',
          title: '夜市 本番イベント',
          category: 'event',
          date: `${curYear}-${curMonthStr}-25`,
          startTime: '16:00',
          endTime: '21:00',
          allDay: false,
          members: ['u1'],
          notes: 'メインステージ企画・夜市飲食エリア運営'
        }
      ],
      eventShifts: {},
      shopList: [],
      performerList: []
    };
  }

  loadData() {
    let data = null;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        data = JSON.parse(saved);
        // ローカルストレージに「佐藤 健一」が残っている場合は「管理者」に置換
        if (data.currentUser && data.currentUser.name === '佐藤 健一') {
          data.currentUser.name = '管理者';
          data.currentUser.avatar = '管';
        }
        if (data.staffList) {
          data.staffList.forEach(s => {
            if (s.name === '佐藤 健一') {
              s.name = '管理者';
              s.avatar = '管';
            }
            // 背番号が未設定、または以前の初期値「1」の場合は「0138」に更新
            if (s.id === 'u1' || s.name === '管理者') {
              if (!s.attendance_number || s.attendance_number === '1') {
                s.attendance_number = '0138';
              }
            } else if (s.attendance_number === undefined) {
              s.attendance_number = '';
            }
            if (!s.program) {
              s.program = 'なし';
            } else {
              const progs = this.parseProgram(s.program);
              s.program = progs.length > 0 ? progs.join(', ') : 'なし';
            }
          });
        }
        if (!data.performerList) {
          data.performerList = [];
        }
        if (data.events) {
          data.events.forEach(e => {
            e.members = this.parseMembers(e.members);
          });
        }
      }
    } catch (e) {
      console.warn('Failed to load from LocalStorage:', e);
    }
    if (!data) {
      data = this.getDefaultData();
      this.saveData(data);
    }
    // 毎回ログアウト：起動時は常に未ログイン状態（currentUser = null）から開始
    data.currentUser = null;
    return data;
  }

  isAdmin() {
    return Boolean(this.data.currentUser && this.data.currentUser.role === 'manager');
  }

  saveData(data = this.data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      Promise.resolve().then(() => this.notifyListeners());
    } catch (e) {
      console.error('Failed to save to LocalStorage:', e);
    }
  }

  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  notifyListeners() {
    this.listeners.forEach(cb => cb(this.data));
  }

  // --- スケジュール操作 ---
  addEvent(event) {
    if (!event.id) event.id = Utils.generateId();
    this.data.events.push(event);
    this.saveData();

    if (this.isGasEnvironment() || gasApiUrl) {
      this.postToGAS('saveEvent', event);
    } else if (supabaseClient) {
      supabaseClient.from('yoichi_events').insert([{
        id: event.id,
        title: event.title,
        category: event.category,
        date: event.date,
        startTime: event.startTime,
        endTime: event.endTime,
        allDay: event.allDay,
        members: event.members,
        notes: event.notes
      }]).then(({ error }) => {
        if (error) console.error('Supabase addEvent error:', error);
      });
    }
    return event;
  }

  updateEvent(updated) {
    const index = this.data.events.findIndex(e => e.id === updated.id);
    if (index !== -1) {
      this.data.events[index] = updated;
      this.saveData();

      if (this.isGasEnvironment() || gasApiUrl) {
        this.postToGAS('saveEvent', updated);
      } else if (supabaseClient) {
        supabaseClient.from('yoichi_events').update({
          title: updated.title,
          category: updated.category,
          date: updated.date,
          startTime: updated.startTime,
          endTime: updated.endTime,
          allDay: updated.allDay,
          members: updated.members,
          notes: updated.notes
        }).eq('id', updated.id).then(({ error }) => {
          if (error) console.error('Supabase updateEvent error:', error);
        });
      }
      return true;
    }
    return false;
  }

  deleteEvent(id) {
    this.data.events = this.data.events.filter(e => e.id !== id);
    if (this.data.eventShifts) {
      delete this.data.eventShifts[id];
    }
    this.saveData();

    if (this.isGasEnvironment() || gasApiUrl) {
      this.postToGAS('deleteEvent', { id });
    } else if (supabaseClient) {
      supabaseClient.from('yoichi_events').delete().eq('id', id).then(({ error }) => {
        if (error) console.error('Supabase deleteEvent error:', error);
      });
      supabaseClient.from('yoichi_shifts').delete().eq('event_id', id).then(({ error }) => {
        if (error) console.error('Supabase deleteShifts error:', error);
      });
    }
  }

  // --- イベントシフト操作 ---
  getEventShift(eventId) {
    if (!this.data.eventShifts) this.data.eventShifts = {};
    if (!this.data.eventShifts[eventId]) {
      this.data.eventShifts[eventId] = {
        roles: [
          { id: 'r_lead', name: '統括・進行', target: 1 },
          { id: 'r_staff_a', name: '担当A (受付/販売等)', target: 2 },
          { id: 'r_staff_b', name: '担当B (誘導/準備等)', target: 2 },
          { id: 'r_break', name: '休憩・フリー', target: 1 }
        ],
        timeSlots: [
          { id: 't_0', time: '前半 (09:00 - 12:00)' },
          { id: 't_1', time: '中盤 (12:00 - 15:00)' },
          { id: 't_2', time: '後半 (15:00 - 18:00)' }
        ],
        assignments: {}
      };
      this.saveData();
      this.saveEventShift(eventId);
    }
    return this.data.eventShifts[eventId];
  }

  saveEventShift(eventId) {
    if (this.isGasEnvironment() || gasApiUrl) {
      this.saveEventShiftToGAS(eventId);
    } else if (supabaseClient) {
      this.saveEventShiftToSupabase(eventId);
    }
  }

  saveEventShiftToGAS(eventId) {
    if (!this.isGasEnvironment() && !gasApiUrl) return;
    const shift = this.data.eventShifts[eventId];
    if (shift) {
      this.postToGAS('saveShift', {
        event_id: eventId,
        roles: JSON.stringify(shift.roles),
        timeSlots: JSON.stringify(shift.timeSlots),
        assignments: JSON.stringify(shift.assignments || {})
      });
    }
  }

  saveEventShiftToSupabase(eventId) {
    if (!supabaseClient) return;
    const shift = this.data.eventShifts[eventId];
    if (shift) {
      supabaseClient.from('yoichi_shifts').upsert({
        event_id: eventId,
        roles: shift.roles,
        timeSlots: shift.timeSlots,
        assignments: shift.assignments || {}
      }).then(({ error }) => {
        if (error) console.error('Supabase saveEventShift error:', error);
      });
    }
  }

  setSlotAssignment(eventId, slotId, roleId, memberIds) {
    const shift = this.getEventShift(eventId);
    const key = `${slotId}_${roleId}`;
    if (!shift.assignments) shift.assignments = {};
    if (memberIds && memberIds.length > 0) {
      shift.assignments[key] = memberIds;
    } else {
      delete shift.assignments[key];
    }
    this.saveData();
    this.saveEventShift(eventId);
  }

  assignMemberToSlot(eventId, slotId, roleId, memberId) {
    return this.addMemberToSlot(eventId, slotId, roleId, memberId);
  }

  addMemberToSlot(eventId, slotId, roleId, memberId) {
    const shift = this.getEventShift(eventId);
    const key = `${slotId}_${roleId}`;
    if (!shift.assignments) shift.assignments = {};
    if (!shift.assignments[key]) shift.assignments[key] = [];
    const targetStr = String(memberId).trim();
    if (!shift.assignments[key].some(id => String(id).trim() === targetStr)) {
      shift.assignments[key].push(memberId);
      this.saveData();
      this.saveEventShift(eventId);
    }
  }

  removeMemberFromSlot(eventId, slotId, roleId, memberId) {
    const shift = this.getEventShift(eventId);
    const key = `${slotId}_${roleId}`;
    if (shift && shift.assignments && shift.assignments[key]) {
      const targetStr = String(memberId).trim();
      shift.assignments[key] = shift.assignments[key].filter(id => String(id).trim() !== targetStr);
      if (shift.assignments[key].length === 0) {
        delete shift.assignments[key];
      }
      this.saveData();
      this.saveEventShift(eventId);
    }
  }

  updateEventShiftStructure(eventId, roles, timeSlots) {
    const shift = this.getEventShift(eventId);
    shift.roles = roles;
    shift.timeSlots = timeSlots;
    this.saveData();
    this.saveEventShift(eventId);
  }

  // --- 過去の出店者操作 ---
  addShop(shop) {
    if (!shop.id) shop.id = 'shop_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    this.data.shopList.push(shop);
    this.saveData();

    if (this.isGasEnvironment() || gasApiUrl) {
      this.postToGAS('saveShop', shop);
    } else if (supabaseClient) {
      supabaseClient.from('yoichi_shops').insert([{
        id: shop.id,
        name: shop.name,
        category: shop.category,
        eventName: shop.eventName,
        event_date: shop.eventDate,
        contact: shop.contact,
        desc: shop.desc
      }]).then(({ error }) => {
        if (error) console.error('Supabase addShop error:', error);
      });
    }
    return shop;
  }

  updateShop(updated) {
    const index = this.data.shopList.findIndex(s => s.id === updated.id);
    if (index !== -1) {
      this.data.shopList[index] = updated;
      this.saveData();

      if (this.isGasEnvironment() || gasApiUrl) {
        this.postToGAS('saveShop', updated);
      } else if (supabaseClient) {
        supabaseClient.from('yoichi_shops').update({
          name: updated.name,
          category: updated.category,
          eventName: updated.eventName,
          event_date: updated.eventDate,
          contact: updated.contact,
          desc: updated.desc
        }).eq('id', updated.id).then(({ error }) => {
          if (error) console.error('Supabase updateShop error:', error);
        });
      }
      return true;
    }
    return false;
  }

  deleteShop(id) {
    this.data.shopList = this.data.shopList.filter(s => s.id !== id);
    this.saveData();

    if (this.isGasEnvironment() || gasApiUrl) {
      this.postToGAS('deleteShop', { id });
    } else if (supabaseClient) {
      supabaseClient.from('yoichi_shops').delete().eq('id', id).then(({ error }) => {
        if (error) console.error('Supabase deleteShop error:', error);
      });
    }
  }

  // --- 出演者 (Performer) 操作 ---
  addPerformer(performer) {
    if (!performer.id) performer.id = 'perf_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    if (!this.data.performerList) this.data.performerList = [];
    this.data.performerList.push(performer);
    this.saveData();

    if (this.isGasEnvironment() || gasApiUrl) {
      this.postToGAS('savePerformer', performer);
    }
    return performer;
  }

  updatePerformer(updated) {
    if (!this.data.performerList) this.data.performerList = [];
    const index = this.data.performerList.findIndex(p => p.id === updated.id);
    if (index !== -1) {
      this.data.performerList[index] = updated;
      this.saveData();

      if (this.isGasEnvironment() || gasApiUrl) {
        this.postToGAS('savePerformer', updated);
      }
      return true;
    }
    return false;
  }

  deletePerformer(id) {
    if (!this.data.performerList) this.data.performerList = [];
    this.data.performerList = this.data.performerList.filter(p => p.id !== id);
    this.saveData();

    if (this.isGasEnvironment() || gasApiUrl) {
      this.postToGAS('deletePerformer', { id });
    }
  }

  // --- メンバー操作 ---
  saveStaff(staff) {
    const isNew = !staff.id;
    const progs = this.parseProgram(staff.program);
    staff.program = progs.length > 0 ? progs.join(', ') : 'なし';
    if (isNew) {
      staff.id = 'u_' + Utils.generateId();
      staff.avatar = staff.name.charAt(0);
      this.data.staffList.push(staff);
    } else {
      const idx = this.data.staffList.findIndex(s => s.id === staff.id);
      if (idx !== -1) {
        this.data.staffList[idx] = staff;
      }
    }
    this.saveData();

    if (this.isGasEnvironment() || gasApiUrl) {
      this.postToGAS('saveStaff', staff);
    } else if (supabaseClient) {
      supabaseClient.from('yoichi_staff').upsert({
        id: staff.id,
        name: staff.name,
        category: staff.category,
        role: staff.role,
        avatar: staff.avatar,
        attendance_number: staff.attendance_number,
        program: staff.program
      }).then(({ error }) => {
        if (error) console.error('Supabase saveStaff error:', error);
      });
    }
    return staff;
  }

  deleteStaff(id) {
    if (!id) return false;
    const target = this.data.staffList.find(s => s.id === id);
    if (!target) return false;

    // マスター管理者は削除不可
    if (target.id === 'u1' || target.name === '管理者') {
      console.warn('Cannot delete master admin');
      return false;
    }

    // 1. スタッフリストから削除
    this.data.staffList = this.data.staffList.filter(s => s.id !== id);

    // 2. イベントの参加メンバーから除外
    if (this.data.events && Array.isArray(this.data.events)) {
      this.data.events.forEach(ev => {
        if (ev.members && Array.isArray(ev.members)) {
          ev.members = ev.members.filter(mId => String(mId).trim() !== String(id).trim());
        }
      });
    }

    // 3. イベントシフトの割り当てから除外
    if (this.data.eventShifts && typeof this.data.eventShifts === 'object') {
      Object.keys(this.data.eventShifts).forEach(eventId => {
        const shift = this.data.eventShifts[eventId];
        if (shift && shift.assignments) {
          let updated = false;
          Object.keys(shift.assignments).forEach(slotKey => {
            const arr = shift.assignments[slotKey];
            if (Array.isArray(arr)) {
              const filtered = arr.filter(mId => String(mId).trim() !== String(id).trim());
              if (filtered.length !== arr.length) {
                shift.assignments[slotKey] = filtered;
                updated = true;
              }
            }
          });
          if (updated) {
            this.saveEventShift(eventId);
          }
        }
      });
    }

    // 4. 削除されたスタッフが現在ログイン中の場合はログアウト
    if (this.data.currentUser && this.data.currentUser.id === id) {
      this.data.currentUser = null;
    }

    this.saveData();

    if (this.isGasEnvironment() || gasApiUrl) {
      this.postToGAS('deleteStaff', { id });
    } else if (supabaseClient) {
      supabaseClient.from('yoichi_staff').delete().eq('id', id).then(({ error }) => {
        if (error) console.error('Supabase deleteStaff error:', error);
      });
    }
    return true;
  }

  // --- ユーザー & ロール操作 ---
  setCurrentUser(userId) {
    const staff = this.data.staffList.find(s => s.id === userId);
    if (staff) {
      this.data.currentUser = {
        id: staff.id,
        name: staff.name,
        role: staff.role,
        category: staff.category,
        avatar: staff.avatar
      };
      this.saveData();
    }
  }

  login(attendanceNumber) {
    const inputClean = String(attendanceNumber || '').trim();
    if (!inputClean) return null;

    // 管理者アカウントが存在しない場合は自動作成
    if (!this.data.staffList.some(s => s.id === 'u1' || s.role === 'manager' || s.name === '管理者')) {
      this.data.staffList.unshift({
        id: 'u1',
        name: '管理者',
        role: 'manager',
        category: 'Core',
        avatar: '管',
        attendance_number: '0138'
      });
      this.saveData();
    }

    const staff = this.data.staffList.find(s => {
      const staffNum = String(s.attendance_number || '').trim();
      // 完全一致
      if (staffNum === inputClean) return true;
      // 数値一致 (例: '0138' と '138'、'0012' と '12')
      if (staffNum !== '' && !isNaN(staffNum) && !isNaN(inputClean) && parseInt(staffNum, 10) === parseInt(inputClean, 10)) {
        return true;
      }
      // 管理者初期パスワード 0138 / 138 フォールバック
      if ((s.id === 'u1' || s.name === '管理者' || s.role === 'manager') && (inputClean === '0138' || inputClean === '138')) {
        return true;
      }
      return false;
    });

    if (staff) {
      this.data.currentUser = {
        id: staff.id,
        name: staff.name,
        role: staff.role,
        category: staff.category,
        avatar: staff.avatar
      };
      this.saveData();
      return staff;
    }
    return null;
  }

  logout() {
    this.data.currentUser = null;
    this.saveData();
  }

  // --- データリセット & エクスポート ---
  resetData() {
    this.data = this.getDefaultData();
    this.saveData();

    if (this.isGasEnvironment() || gasApiUrl) {
      this.postToGAS('resetAll', {});
    } else if (supabaseClient) {
      Promise.all([
        supabaseClient.from('yoichi_events').delete().neq('id', ''),
        supabaseClient.from('yoichi_shifts').delete().neq('event_id', ''),
        supabaseClient.from('yoichi_shops').delete().neq('id', ''),
        supabaseClient.from('yoichi_staff').delete().neq('id', '')
      ]).then(() => {
        console.log('Cleared all data in Supabase.');
      }).catch(e => console.error('Failed to clear Supabase data on reset:', e));
    }
  }

  exportJson() {
    const jsonStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.data, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", jsonStr);
    dlAnchorElem.setAttribute("download", `夜市_イベントシフトバックアップ_${Utils.formatDateKey(new Date())}.json`);
    dlAnchorElem.click();
  }

  importJson(jsonData) {
    try {
      if (jsonData && jsonData.staffList && jsonData.events) {
        this.data = jsonData;
        this.saveData();
        return true;
      }
    } catch (e) {
      console.error(e);
    }
    return false;
  }
}

// Global store instance
window.appStore = new Store();
