/* ==========================================================================
   夜市 (Yoichi) - Data Store & State Management (Event Shift Supported)
   ========================================================================== */

const STORAGE_KEY = 'yoichi_org_portal_v10';

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

      // Sync staff with safe non-destructive merge
      if (resData.staff && Array.isArray(resData.staff)) {
        const gasMap = new Map();
        resData.staff.forEach(s => {
          if (s.id) gasMap.set(s.id, s);
          if (s.attendance_number !== undefined && s.attendance_number !== null && s.attendance_number !== '') {
            gasMap.set(String(s.attendance_number).trim(), s);
          }
        });

        // 1. ローカルのスタッフリストを更新（スプレッドシートにないメンバーも絶対に消さず保持！）
        const mergedList = this.data.staffList.map(localStaff => {
          const gasStaff = gasMap.get(localStaff.id) || gasMap.get(String(localStaff.attendance_number).trim());
          if (!gasStaff) return localStaff; // スプレッドシートに未登録のメンバーはそのまま維持！

          let rawProg = gasStaff.program;
          if (!rawProg || rawProg === 'なし') {
            if (localStaff.program && localStaff.program !== 'なし') {
              rawProg = localStaff.program;
            }
          }
          const progs = this.parseProgram(rawProg);
          const finalProgram = progs.length > 0 ? progs.join(', ') : (localStaff.program || 'なし');

          return {
            id: localStaff.id,
            name: gasStaff.name || localStaff.name,
            category: gasStaff.category || localStaff.category,
            role: gasStaff.role || localStaff.role,
            avatar: gasStaff.avatar || localStaff.avatar || (localStaff.name ? localStaff.name.charAt(0) : '?'),
            attendance_number: (gasStaff.attendance_number !== undefined && gasStaff.attendance_number !== null && gasStaff.attendance_number !== '')
              ? String(gasStaff.attendance_number).trim()
              : localStaff.attendance_number,
            program: finalProgram
          };
        });

        // 2. GAS側に存在してローカル側にまだないメンバーがいれば追加
        resData.staff.forEach(gasStaff => {
          const exists = mergedList.some(l => 
            l.id === gasStaff.id || (l.attendance_number && String(l.attendance_number).trim() === String(gasStaff.attendance_number).trim())
          );
          if (!exists) {
            const progs = this.parseProgram(gasStaff.program);
            mergedList.push({
              id: gasStaff.id,
              name: gasStaff.name,
              category: gasStaff.category || 'Member',
              role: gasStaff.role || 'staff',
              avatar: gasStaff.avatar || (gasStaff.name ? gasStaff.name.charAt(0) : '?'),
              attendance_number: (gasStaff.attendance_number !== undefined && gasStaff.attendance_number !== null) ? String(gasStaff.attendance_number).trim() : '',
              program: progs.length > 0 ? progs.join(', ') : 'なし'
            });
          }
        });

        this.data.staffList = mergedList;
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
                      "id": "u1",
                      "name": "管理者",
                      "role": "manager",
                      "category": "Core",
                      "avatar": "管",
                      "attendance_number": "0138",
                      "program": "夜市・朝市"
              },
              {
                      "id": "u_item_lgadwcfmu3wegw4",
                      "name": "武市 太陽",
                      "role": "manager",
                      "category": "Core",
                      "avatar": "武",
                      "attendance_number": "1626",
                      "program": "夜市・朝市"
              },
              {
                      "id": "u_2022",
                      "name": "池田 奈央",
                      "role": "manager",
                      "category": "Core",
                      "avatar": "池",
                      "attendance_number": "2022",
                      "program": "なし"
              },
              {
                      "id": "u_2711",
                      "name": "松村 瞳",
                      "role": "manager",
                      "category": "Core",
                      "avatar": "松",
                      "attendance_number": "2711",
                      "program": "なし"
              },
              {
                      "id": "u_2810",
                      "name": "馬頭 遼太朗",
                      "role": "staff",
                      "category": "Assistant",
                      "avatar": "馬",
                      "attendance_number": "2810",
                      "program": "TAKE ACTION"
              },
              {
                      "id": "u_item_jbntbwvmu9ji5as",
                      "name": "岡本 あづき",
                      "role": "staff",
                      "category": "Member",
                      "avatar": "岡",
                      "attendance_number": "3220",
                      "program": "FIZZ"
              },
              {
                      "id": "u_item_vn8a3ykmu9jiphx",
                      "name": "森本 香菜",
                      "role": "staff",
                      "category": "Assistant",
                      "avatar": "森",
                      "attendance_number": "3290",
                      "program": "FIZZ, 夜市・朝市"
              },
              {
                      "id": "u_3318",
                      "name": "野田 華妃",
                      "role": "staff",
                      "category": "Chief",
                      "avatar": "野",
                      "attendance_number": "3318",
                      "program": "FIZZ"
              },
              {
                      "id": "u_3451",
                      "name": "横井 亮哉",
                      "role": "manager",
                      "category": "Assistant",
                      "avatar": "横",
                      "attendance_number": "3451",
                      "program": "TAKE ACTION"
              },
              {
                      "id": "u_3486",
                      "name": "遠藤 愛佳",
                      "role": "staff",
                      "category": "Chief",
                      "avatar": "遠",
                      "attendance_number": "3486",
                      "program": "TAKE ACTION, FIZZ"
              },
              {
                      "id": "u_3515",
                      "name": "川邉 翔太",
                      "role": "staff",
                      "category": "Member",
                      "avatar": "川",
                      "attendance_number": "3515",
                      "program": "FIZZ"
              },
              {
                      "id": "u_3667",
                      "name": "桑島 野乃叶",
                      "role": "staff",
                      "category": "Chief",
                      "avatar": "桑",
                      "attendance_number": "3667",
                      "program": "TAKE ACTION"
              },
              {
                      "id": "u_3827",
                      "name": "井上 彩音",
                      "role": "staff",
                      "category": "Member",
                      "avatar": "井",
                      "attendance_number": "3827",
                      "program": "FIZZ"
              },
              {
                      "id": "u_3929",
                      "name": "池田 晃士",
                      "role": "staff",
                      "category": "Assistant",
                      "avatar": "池",
                      "attendance_number": "3929",
                      "program": "夜市・朝市"
              },
              {
                      "id": "u_4001",
                      "name": "笹江恋太朗",
                      "role": "staff",
                      "category": "Member",
                      "avatar": "笹",
                      "attendance_number": "4001",
                      "program": "夜市・朝市"
              },
              {
                      "id": "u_4002",
                      "name": "中村悠大",
                      "role": "staff",
                      "category": "Member",
                      "avatar": "中",
                      "attendance_number": "4002",
                      "program": "夜市・朝市"
              },
              {
                      "id": "u_4003",
                      "name": "中内悠貴",
                      "role": "staff",
                      "category": "Member",
                      "avatar": "中",
                      "attendance_number": "4003",
                      "program": "なし"
              },
              {
                      "id": "u_4004",
                      "name": "古田子昂",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "古",
                      "attendance_number": "4004",
                      "program": "なし"
              },
              {
                      "id": "u_4005",
                      "name": "中原瑛太",
                      "role": "staff",
                      "category": "Member",
                      "avatar": "中",
                      "attendance_number": "4005",
                      "program": "夜市・朝市"
              },
              {
                      "id": "u_4006",
                      "name": "山下葵衣",
                      "role": "staff",
                      "category": "Member",
                      "avatar": "山",
                      "attendance_number": "4006",
                      "program": "FIZZ"
              },
              {
                      "id": "u_4007",
                      "name": "宮嶋心愛",
                      "role": "staff",
                      "category": "Member",
                      "avatar": "宮",
                      "attendance_number": "4007",
                      "program": "夜市・朝市, マーケティング, 総務"
              },
              {
                      "id": "u_4008",
                      "name": "平田修大",
                      "role": "staff",
                      "category": "Member",
                      "avatar": "平",
                      "attendance_number": "4008",
                      "program": "なし"
              },
              {
                      "id": "u_4009",
                      "name": "濁池夢斗",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "濁",
                      "attendance_number": "4009",
                      "program": "なし"
              },
              {
                      "id": "u_4010",
                      "name": "松田篤樹",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "松",
                      "attendance_number": "4010",
                      "program": "なし"
              },
              {
                      "id": "u_4011",
                      "name": "大上航正",
                      "role": "staff",
                      "category": "Member",
                      "avatar": "大",
                      "attendance_number": "4011",
                      "program": "なし"
              },
              {
                      "id": "u_4012",
                      "name": "岡嶋尚志",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "岡",
                      "attendance_number": "4012",
                      "program": "なし"
              },
              {
                      "id": "u_4013",
                      "name": "田中美帆",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "田",
                      "attendance_number": "4013",
                      "program": "なし"
              },
              {
                      "id": "u_4014",
                      "name": "足助祐美",
                      "role": "staff",
                      "category": "Member",
                      "avatar": "足",
                      "attendance_number": "4014",
                      "program": "なし"
              },
              {
                      "id": "u_4015",
                      "name": "西城裕陽",
                      "role": "staff",
                      "category": "Member",
                      "avatar": "西",
                      "attendance_number": "4015",
                      "program": "夜市・朝市"
              },
              {
                      "id": "u_4016",
                      "name": "二又佑妃",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "二",
                      "attendance_number": "4016",
                      "program": "なし"
              },
              {
                      "id": "u_4017",
                      "name": "長井咲奈",
                      "role": "staff",
                      "category": "Member",
                      "avatar": "長",
                      "attendance_number": "4017",
                      "program": "FIZZ"
              },
              {
                      "id": "u_4018",
                      "name": "林美緒",
                      "role": "staff",
                      "category": "Member",
                      "avatar": "林",
                      "attendance_number": "4018",
                      "program": "FIZZ"
              },
              {
                      "id": "u_4019",
                      "name": "太田陵月",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "太",
                      "attendance_number": "4019",
                      "program": "なし"
              },
              {
                      "id": "u_4020",
                      "name": "前岩丈琉",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "前",
                      "attendance_number": "4020",
                      "program": "なし"
              },
              {
                      "id": "u_4021",
                      "name": "北角優空",
                      "role": "staff",
                      "category": "Member",
                      "avatar": "北",
                      "attendance_number": "4021",
                      "program": "夜市・朝市"
              },
              {
                      "id": "u_4022",
                      "name": "原田実怜",
                      "role": "staff",
                      "category": "Member",
                      "avatar": "原",
                      "attendance_number": "4022",
                      "program": "FIZZ, マーケティング, 総務"
              },
              {
                      "id": "u_4023",
                      "name": "西山桃代",
                      "role": "staff",
                      "category": "Member",
                      "avatar": "西",
                      "attendance_number": "4023",
                      "program": "TAKE ACTION"
              },
              {
                      "id": "u_4024",
                      "name": "松井能",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "松",
                      "attendance_number": "4024",
                      "program": "なし"
              },
              {
                      "id": "u_4025",
                      "name": "山﨑 菜結",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "山",
                      "attendance_number": "4025",
                      "program": "なし"
              },
              {
                      "id": "u_4026",
                      "name": "井上那月",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "井",
                      "attendance_number": "4026",
                      "program": "なし"
              },
              {
                      "id": "u_4027",
                      "name": "北井千景",
                      "role": "staff",
                      "category": "Member",
                      "avatar": "北",
                      "attendance_number": "4027",
                      "program": "マーケティング, 総務"
              },
              {
                      "id": "u_4028",
                      "name": "加藤誠一朗",
                      "role": "staff",
                      "category": "Member",
                      "avatar": "加",
                      "attendance_number": "4028",
                      "program": "FIZZ"
              },
              {
                      "id": "u_4029",
                      "name": "市川秦",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "市",
                      "attendance_number": "4029",
                      "program": "なし"
              },
              {
                      "id": "u_4030",
                      "name": "杉山慶浩",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "杉",
                      "attendance_number": "4030",
                      "program": "なし"
              },
              {
                      "id": "u_4031",
                      "name": "梅谷芙実",
                      "role": "staff",
                      "category": "Member",
                      "avatar": "梅",
                      "attendance_number": "4031",
                      "program": "TAKE ACTION"
              },
              {
                      "id": "u_4032",
                      "name": "田内芽希",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "田",
                      "attendance_number": "4032",
                      "program": "なし"
              },
              {
                      "id": "u_4033",
                      "name": "藤井優",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "藤",
                      "attendance_number": "4033",
                      "program": "なし"
              },
              {
                      "id": "u_4036",
                      "name": "赤松凛々子",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "赤",
                      "attendance_number": "4036",
                      "program": "なし"
              },
              {
                      "id": "u_4037",
                      "name": "中西希花",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "中",
                      "attendance_number": "4037",
                      "program": "なし"
              },
              {
                      "id": "u_4038",
                      "name": "真鍋瑞葉",
                      "role": "staff",
                      "category": "Member",
                      "avatar": "真",
                      "attendance_number": "4038",
                      "program": "夜市・朝市"
              },
              {
                      "id": "u_4039",
                      "name": "矢木陽太",
                      "role": "staff",
                      "category": "Member",
                      "avatar": "矢",
                      "attendance_number": "4039",
                      "program": "TAKE ACTION"
              },
              {
                      "id": "u_4040",
                      "name": "中井捷馬",
                      "role": "staff",
                      "category": "Member",
                      "avatar": "中",
                      "attendance_number": "4040",
                      "program": "夜市・朝市"
              },
              {
                      "id": "u_4041",
                      "name": "長知純",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "長",
                      "attendance_number": "4041",
                      "program": "なし"
              },
              {
                      "id": "u_4042",
                      "name": "高木桜",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "高",
                      "attendance_number": "4042",
                      "program": "なし"
              },
              {
                      "id": "u_4043",
                      "name": "村田遥風",
                      "role": "staff",
                      "category": "Member",
                      "avatar": "村",
                      "attendance_number": "4043",
                      "program": "夜市・朝市"
              },
              {
                      "id": "u_4044",
                      "name": "平野里帆",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "平",
                      "attendance_number": "4044",
                      "program": "なし"
              },
              {
                      "id": "u_4045",
                      "name": "九鬼杏奈",
                      "role": "staff",
                      "category": "Member",
                      "avatar": "九",
                      "attendance_number": "4045",
                      "program": "夜市・朝市"
              },
              {
                      "id": "u_4046",
                      "name": "坂田翔",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "坂",
                      "attendance_number": "4046",
                      "program": "なし"
              },
              {
                      "id": "u_4047",
                      "name": "上治亮太",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "上",
                      "attendance_number": "4047",
                      "program": "なし"
              },
              {
                      "id": "u_4048",
                      "name": "金子巧",
                      "role": "staff",
                      "category": "Member",
                      "avatar": "金",
                      "attendance_number": "4048",
                      "program": "夜市・朝市"
              },
              {
                      "id": "u_4049",
                      "name": "小西乃慈",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "小",
                      "attendance_number": "4049",
                      "program": "なし"
              },
              {
                      "id": "u_4050",
                      "name": "島田悠杜",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "島",
                      "attendance_number": "4050",
                      "program": "なし"
              },
              {
                      "id": "u_4051",
                      "name": "小川直寛",
                      "role": "staff",
                      "category": "Member",
                      "avatar": "小",
                      "attendance_number": "4051",
                      "program": "TAKE ACTION, マーケティング, 総務"
              },
              {
                      "id": "u_4052",
                      "name": "島田梨帆",
                      "role": "staff",
                      "category": "Member",
                      "avatar": "島",
                      "attendance_number": "4052",
                      "program": "夜市・朝市"
              },
              {
                      "id": "u_4054",
                      "name": "樋浦佳乃子",
                      "role": "staff",
                      "category": "Member",
                      "avatar": "樋",
                      "attendance_number": "4054",
                      "program": "夜市・朝市, マーケティング, 総務"
              },
              {
                      "id": "u_4055",
                      "name": "井上晴菜",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "井",
                      "attendance_number": "4055",
                      "program": "なし"
              },
              {
                      "id": "u_4056",
                      "name": "北川陽道",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "北",
                      "attendance_number": "4056",
                      "program": "なし"
              },
              {
                      "id": "u_4057",
                      "name": "仙田あかり",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "仙",
                      "attendance_number": "4057",
                      "program": "なし"
              },
              {
                      "id": "u_4059",
                      "name": "市川璃博",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "市",
                      "attendance_number": "4059",
                      "program": "なし"
              },
              {
                      "id": "u_4060",
                      "name": "岩本智佳",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "岩",
                      "attendance_number": "4060",
                      "program": "なし"
              },
              {
                      "id": "u_4061",
                      "name": "伊藤大智",
                      "role": "staff",
                      "category": "Member",
                      "avatar": "伊",
                      "attendance_number": "4061",
                      "program": "FIZZ"
              },
              {
                      "id": "u_4062",
                      "name": "杉山直太郎",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "杉",
                      "attendance_number": "4062",
                      "program": "なし"
              },
              {
                      "id": "u_4063",
                      "name": "西本光伶",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "西",
                      "attendance_number": "4063",
                      "program": "なし"
              },
              {
                      "id": "u_4064",
                      "name": "西村羽叶",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "西",
                      "attendance_number": "4064",
                      "program": "なし"
              },
              {
                      "id": "u_4065",
                      "name": "福本莉央",
                      "role": "staff",
                      "category": "Member",
                      "avatar": "福",
                      "attendance_number": "4065",
                      "program": "FIZZ"
              },
              {
                      "id": "u_4066",
                      "name": "石田彩乃",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "石",
                      "attendance_number": "4066",
                      "program": "なし"
              },
              {
                      "id": "u_4067",
                      "name": "山川結衣",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "山",
                      "attendance_number": "4067",
                      "program": "なし"
              },
              {
                      "id": "u_4068",
                      "name": "濱田かんな",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "濱",
                      "attendance_number": "4068",
                      "program": "なし"
              },
              {
                      "id": "u_4069",
                      "name": "熊谷心花",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "熊",
                      "attendance_number": "4069",
                      "program": "なし"
              },
              {
                      "id": "u_4070",
                      "name": "梶浦朔",
                      "role": "staff",
                      "category": "Member",
                      "avatar": "梶",
                      "attendance_number": "4070",
                      "program": "夜市・朝市"
              },
              {
                      "id": "u_4071",
                      "name": "木上眞",
                      "role": "staff",
                      "category": "Member",
                      "avatar": "木",
                      "attendance_number": "4071",
                      "program": "なし"
              },
              {
                      "id": "u_4072",
                      "name": "木下蓮人",
                      "role": "staff",
                      "category": "Member",
                      "avatar": "木",
                      "attendance_number": "4072",
                      "program": "マーケティング, 総務"
              },
              {
                      "id": "u_4073",
                      "name": "久保山愛子",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "久",
                      "attendance_number": "4073",
                      "program": "なし"
              },
              {
                      "id": "u_4074",
                      "name": "由利優芽",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "由",
                      "attendance_number": "4074",
                      "program": "なし"
              },
              {
                      "id": "u_4075",
                      "name": "佐藤昴",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "佐",
                      "attendance_number": "4075",
                      "program": "なし"
              },
              {
                      "id": "u_4076",
                      "name": "堀内桃花",
                      "role": "staff",
                      "category": "Member",
                      "avatar": "堀",
                      "attendance_number": "4076",
                      "program": "夜市・朝市"
              },
              {
                      "id": "u_4078",
                      "name": "河野莉々",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "河",
                      "attendance_number": "4078",
                      "program": "なし"
              },
              {
                      "id": "u_4079",
                      "name": "車谷美琴",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "車",
                      "attendance_number": "4079",
                      "program": "なし"
              },
              {
                      "id": "u_4080",
                      "name": "火浦生真",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "火",
                      "attendance_number": "4080",
                      "program": "なし"
              },
              {
                      "id": "u_4081",
                      "name": "山川夢加",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "山",
                      "attendance_number": "4081",
                      "program": "なし"
              },
              {
                      "id": "u_4082",
                      "name": "川田稜眞",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "川",
                      "attendance_number": "4082",
                      "program": "なし"
              },
              {
                      "id": "u_4083",
                      "name": "岡さくら",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "岡",
                      "attendance_number": "4083",
                      "program": "なし"
              },
              {
                      "id": "u_4084",
                      "name": "柏木里奈",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "柏",
                      "attendance_number": "4084",
                      "program": "なし"
              },
              {
                      "id": "u_4085",
                      "name": "岡本奈々",
                      "role": "staff",
                      "category": "Member",
                      "avatar": "岡",
                      "attendance_number": "4085",
                      "program": "夜市・朝市, TAKE ACTION, マーケティング, 総務"
              },
              {
                      "id": "u_4086",
                      "name": "浅野詞音",
                      "role": "staff",
                      "category": "Member",
                      "avatar": "浅",
                      "attendance_number": "4086",
                      "program": "夜市・朝市"
              },
              {
                      "id": "u_4087",
                      "name": "松岡利通",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "松",
                      "attendance_number": "4087",
                      "program": "なし"
              },
              {
                      "id": "u_4088",
                      "name": "神谷美緒",
                      "role": "staff",
                      "category": "Member",
                      "avatar": "神",
                      "attendance_number": "4088",
                      "program": "夜市・朝市"
              },
              {
                      "id": "u_4089",
                      "name": "井町晴歩",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "井",
                      "attendance_number": "4089",
                      "program": "なし"
              },
              {
                      "id": "u_4090",
                      "name": "市村伊純",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "市",
                      "attendance_number": "4090",
                      "program": "なし"
              },
              {
                      "id": "u_4091",
                      "name": "帯谷遥弥",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "帯",
                      "attendance_number": "4091",
                      "program": "なし"
              },
              {
                      "id": "u_4092",
                      "name": "竹嶋晴",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "竹",
                      "attendance_number": "4092",
                      "program": "なし"
              },
              {
                      "id": "u_4093",
                      "name": "木村温音",
                      "role": "staff",
                      "category": "Member",
                      "avatar": "木",
                      "attendance_number": "4093",
                      "program": "夜市・朝市"
              },
              {
                      "id": "u_4094",
                      "name": "藤本吏穂",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "藤",
                      "attendance_number": "4094",
                      "program": "なし"
              },
              {
                      "id": "u_4095",
                      "name": "室峰万由奈",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "室",
                      "attendance_number": "4095",
                      "program": "なし"
              },
              {
                      "id": "u_4096",
                      "name": "岩佐篤志",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "岩",
                      "attendance_number": "4096",
                      "program": "なし"
              },
              {
                      "id": "u_4097",
                      "name": "川崎晄希",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "川",
                      "attendance_number": "4097",
                      "program": "なし"
              },
              {
                      "id": "u_4098",
                      "name": "児島有祐",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "児",
                      "attendance_number": "4098",
                      "program": "なし"
              },
              {
                      "id": "u_4099",
                      "name": "寺坂匠平",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "寺",
                      "attendance_number": "4099",
                      "program": "なし"
              },
              {
                      "id": "u_4100",
                      "name": "三河とわ",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "三",
                      "attendance_number": "4100",
                      "program": "なし"
              },
              {
                      "id": "u_4101",
                      "name": "川上真翔",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "川",
                      "attendance_number": "4101",
                      "program": "なし"
              },
              {
                      "id": "u_4102",
                      "name": "森陽菜",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "森",
                      "attendance_number": "4102",
                      "program": "なし"
              },
              {
                      "id": "u_4103",
                      "name": "中山真夢",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "中",
                      "attendance_number": "4103",
                      "program": "なし"
              },
              {
                      "id": "u_4104",
                      "name": "石崎そう",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "石",
                      "attendance_number": "4104",
                      "program": "なし"
              },
              {
                      "id": "u_4105",
                      "name": "古本絢乃",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "古",
                      "attendance_number": "4105",
                      "program": "なし"
              },
              {
                      "id": "u_4106",
                      "name": "齋藤たまき",
                      "role": "staff",
                      "category": "Beginner",
                      "avatar": "齋",
                      "attendance_number": "4106",
                      "program": "なし"
              },
              {
                      "id": "u_4999",
                      "name": "武市 力",
                      "role": "staff",
                      "category": "Member",
                      "avatar": "武",
                      "attendance_number": "4999",
                      "program": "TAKE ACTION"
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
