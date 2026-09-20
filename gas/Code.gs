/**
 * 夜市 (Yoichi) Portal - Google Sheets Integration Backend Script
 * 
 * このスクリプトは、「夜市ポータル」アプリとGoogleスプレッドシート間で
 * スケジュール、シフト、出店者、メンバーのデータを同期するためのバックエンドAPIです。
 * 
 * 【導入手順】
 * 1. 新しいGoogleスプレッドシートを作成します。
 * 2. 上部メニューから「拡張機能」 -> 「Apps Script」を開きます。
 * 3. エディタにこのスクリプトの内容をすべて貼り付け、保存（Ctrl+S / Cmd+S）します。
 * 4. 右上の「デプロイ」 -> 「新しいデプロイ」をクリックします。
 * 5. 種類の選択で「ウェブアプリ」を選び、以下を設定します：
 *    - 次のユーザーとして実行: 「自分」
 *    - アクセスできるユーザー: 「全員」 (Anyone)
 * 6. 「デプロイ」ボタンを押し、表示された「ウェブアプリのURL」をコピーします。
 * 7. ポータルアプリの「js/config.js」内の「GAS_API_URL」に、コピーしたURLを記述してください。
 */

// 各シートのヘッダー定義
const HEADERS = {
  events: ['id', 'title', 'category', 'date', 'startTime', 'endTime', 'allDay', 'members', 'notes'],
  shifts: ['event_id', 'roles', 'timeSlots', 'assignments'],
  shops: ['id', 'name', 'category', 'eventName', 'eventDate', 'contact', 'desc', 'email', 'phone'],
  performers: ['id', 'name', 'genre', 'eventName', 'eventDate', 'email', 'phone', 'contact', 'notes'],
  staff: ['id', 'name', 'category', 'role', 'avatar', 'attendance_number', 'program']
};

/**
 * Web AppへGETリクエストがあった際の処理
 * - 通常のブラウザアクセス時: ポータル画面 (index.html) を表示
 * - ?action=getAll パラメータ付き: JSONデータを出力 (API通信)
 */
function doGet(e) {
  var action = e && e.parameter && e.parameter.action;
  
  if (action === 'getAll') {
    try {
      initSheets(); // 必要なシートがなければ自動作成
      
      var payload = {
        events: readSheetData('events', HEADERS.events),
        shifts: readSheetData('shifts', HEADERS.shifts),
        shops: readSheetData('shops', HEADERS.shops),
        performers: readSheetData('performers', HEADERS.performers),
        staff: readSheetData('staff', HEADERS.staff)
      };
      
      return createJsonResponse(payload);
    } catch (err) {
      return createJsonResponse({ error: 'データ取得に失敗しました: ' + err.toString() });
    }
  }
  
  if (action) {
    return createJsonResponse({ error: '無効なアクションです。 action=getAll を指定してください。' });
  }

  // アクション指定がない場合（ブラウザアクセス時）はWebポータル画面を表示
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('夜市 | PORTAL')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * GASのHTML画面 (google.script.run) から直接呼び出せる全データ取得関数
 */
function apiGetAll() {
  try {
    initSheets();
    return {
      events: readSheetData('events', HEADERS.events),
      shifts: readSheetData('shifts', HEADERS.shifts),
      shops: readSheetData('shops', HEADERS.shops),
      performers: readSheetData('performers', HEADERS.performers),
      staff: readSheetData('staff', HEADERS.staff)
    };
  } catch (err) {
    return { error: 'データ取得に失敗しました: ' + err.toString() };
  }
}

/**
 * GASのHTML画面 (google.script.run) から直接呼び出せるデータ更新関数
 */
function apiPostAction(action, data) {
  initSheets();
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    switch (action) {
      case 'saveEvent':
        return saveEvent(data);
      case 'deleteEvent':
        return deleteEvent(data.id);
      case 'saveShift':
        return saveShift(data);
      case 'saveShop':
        return saveShop(data);
      case 'deleteShop':
        return deleteShop(data.id);
      case 'savePerformer':
        return savePerformer(data);
      case 'deletePerformer':
        return deletePerformer(data.id);
      case 'saveStaff':
        return saveStaff(data);
      case 'deleteStaff':
        return deleteStaff(data.id);
      case 'resetAll':
        return resetAll();
      default:
        return { error: '未定義のアクションです: ' + action };
    }
  } catch (err) {
    return { error: '処理に失敗しました: ' + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Web AppへPOSTリクエストがあった際の処理 (データ更新・追加・削除・リセット)
 */
function doPost(e) {
  try {
    // text/plain形式で送られてくるJSONをパース
    var requestBody = JSON.parse(e.postData.contents);
    var action = requestBody.action;
    var data = requestBody.data;
    
    var result;
    var lock = LockService.getScriptLock();
    
    // 同時書き込みを防ぐため、最大30秒のロックを設定
    try {
      lock.waitLock(30000);
      
      initSheets(); // 必要なシートがなければ自動作成
      
      switch (action) {
        case 'saveEvent':
          result = saveEvent(data);
          break;
        case 'deleteEvent':
          result = deleteEvent(data.id);
          break;
        case 'saveShift':
          result = saveShift(data);
          break;
        case 'saveShop':
          result = saveShop(data);
          break;
        case 'deleteShop':
          result = deleteShop(data.id);
          break;
        case 'savePerformer':
          result = savePerformer(data);
          break;
        case 'deletePerformer':
          result = deletePerformer(data.id);
          break;
        case 'saveStaff':
          result = saveStaff(data);
          break;
        case 'deleteStaff':
          result = deleteStaff(data.id);
          break;
        case 'resetAll':
          result = resetAll();
          break;
        default:
          result = { error: '未定義のアクションです: ' + action };
      }
    } finally {
      lock.releaseLock();
    }
    
    return createJsonResponse(result);
  } catch (error) {
    return createJsonResponse({ error: 'リクエスト処理に失敗しました: ' + error.toString() });
  }
}

/**
 * スプレッドシートに必要なシート（タブ）がなければ自動作成し、初期設定する関数
 */
function initSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  for (var sheetName in HEADERS) {
    var sheet = ss.getSheetByName(sheetName);
    // シートが存在しない場合は新規作成
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    
    // シートが完全に空（行数が0）またはヘッダーがない場合は、ヘッダーを作成
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS[sheetName]);
      
      // ヘッダー行の書式設定 (太字、背景色薄グレー、中央揃え)
      sheet.getRange(1, 1, 1, HEADERS[sheetName].length)
        .setFontWeight('bold')
        .setBackground('#f3f4f6')
        .setHorizontalAlignment('center');
      
      // 1行目を固定
      sheet.setFrozenRows(1);
      
      // 自動列幅調整
      for (var col = 1; col <= HEADERS[sheetName].length; col++) {
        sheet.autoResizeColumn(col);
      }
    } else {
      // 既存シートの場合、ヘッダー行に必要なカラムが不足していれば末尾に追加
      var lastCol = sheet.getLastColumn();
      if (lastCol > 0) {
        var curHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
        for (var h = 0; h < HEADERS[sheetName].length; h++) {
          var expectedHeader = HEADERS[sheetName][h];
          if (curHeaders.indexOf(expectedHeader) === -1) {
            lastCol++;
            sheet.getRange(1, lastCol).setValue(expectedHeader)
              .setFontWeight('bold')
              .setBackground('#f3f4f6')
              .setHorizontalAlignment('center');
          }
        }
      }
    }
  }
  
  // スプレッドシート新規作成時にデフォルトで作られる空の「シート1」があれば削除
  var defaultSheet = ss.getSheetByName('シート1') || ss.getSheetByName('Sheet1');
  if (defaultSheet && defaultSheet.getLastRow() === 0 && ss.getSheets().length > 1) {
    try {
      ss.deleteSheet(defaultSheet);
    } catch(e) {
      // 削除に失敗しても実行は継続
    }
  }
  
  // もしメンバー（staff）シートが空（ヘッダー行のみ）なら、初期管理者を追加する
  var staffSheet = ss.getSheetByName('staff');
  if (staffSheet && staffSheet.getLastRow() === 1) {
    var defaultAdminRow = ['u1', '管理者', 'Core', 'manager', '管', '0138', '夜市・朝市'];
    staffSheet.appendRow(defaultAdminRow);
  }
}

/**
 * 【管理者テスト用】
 * Apps Script エディタ上部の実行ボタンからこの関数を実行することで、
 * スプレッドシートに必要なシートを作成し、初期管理者を強制的に書き込みます。
 */
function testInitialize() {
  initSheets();
  return 'スプレッドシートの初期設定が完了しました。';
}

/**
 * 指定したシートの全データをJSONオブジェクトの配列として読み込む
 * スプレッドシート側で手入力された場合を考慮し、IDやデフォルト値を自動設定します。
 */
function readSheetData(sheetName, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return []; // ヘッダーのみ、または空の場合
  
  var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  var data = [];
  
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var obj = {};
    var hasValue = false;
    var rowIndex = i + 2; // スプレッドシートの実際の行番号
    
    // スプレッドシート側で手動追加された場合の自動補正
    var idIndex = headers.indexOf('id');
    var nameIndex = headers.indexOf('name');
    var idVal = idIndex !== -1 ? row[idIndex] : '';
    var nameVal = nameIndex !== -1 ? row[nameIndex] : '';
    
    // メンバーシートでの補正
    if (sheetName === 'staff' && nameVal) {
      // 1. IDがなければ自動生成
      if (!idVal) {
        idVal = 'u_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36).substring(6);
        row[idIndex] = idVal;
        sheet.getRange(rowIndex, idIndex + 1).setValue(idVal);
      }
      // 2. カテゴリーがなければデフォルト 'Member'
      var catIndex = headers.indexOf('category');
      if (catIndex !== -1 && !row[catIndex]) {
        row[catIndex] = 'Member';
        sheet.getRange(rowIndex, catIndex + 1).setValue('Member');
      }
      // 3. 権限がなければデフォルト 'staff'
      var roleIndex = headers.indexOf('role');
      if (roleIndex !== -1 && !row[roleIndex]) {
        row[roleIndex] = 'staff';
        sheet.getRange(rowIndex, roleIndex + 1).setValue('staff');
      }
      // 4. アバターがなければ名前の頭文字
      var avatarIndex = headers.indexOf('avatar');
      if (avatarIndex !== -1 && !row[avatarIndex]) {
        var initial = nameVal.charAt(0);
        row[avatarIndex] = initial;
        sheet.getRange(rowIndex, avatarIndex + 1).setValue(initial);
      }
      // 5. プログラムがなければデフォルト 'なし'、'夜市'なら'夜市・朝市'に補正
      var progIndex = headers.indexOf('program');
      if (progIndex !== -1) {
        if (!row[progIndex]) {
          row[progIndex] = 'なし';
        } else if (row[progIndex] === '夜市') {
          row[progIndex] = '夜市・朝市';
          sheet.getRange(rowIndex, progIndex + 1).setValue('夜市・朝市');
        }
      }
    }
    
    // 出店者シートでのID自動補正
    if (sheetName === 'shops' && nameVal && !idVal) {
      idVal = 'shop_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36).substring(6);
      row[idIndex] = idVal;
      sheet.getRange(rowIndex, idIndex + 1).setValue(idVal);
    }
    
    // イベントシートでのID自動補正
    var titleIndex = headers.indexOf('title');
    var titleVal = titleIndex !== -1 ? row[titleIndex] : '';
    if (sheetName === 'events' && titleVal && !idVal) {
      idVal = 'ev_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36).substring(6);
      row[idIndex] = idVal;
      sheet.getRange(rowIndex, idIndex + 1).setValue(idVal);
    }
    
    for (var j = 0; j < headers.length; j++) {
      var val = row[j];
      var key = headers[j];
      
      // 値の型を正規化してオブジェクトに代入
      if (val instanceof Date) {
        // 日付・イベント日カラムは "YYYY-MM-DD" 形式に変換
        if (key === 'date' || key === 'eventDate' || key === 'event_date') {
          obj[key] = Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        } else {
          obj[key] = val.toString();
        }
      } else {
        obj[key] = val;
      }
      
      if (val !== '') {
        hasValue = true;
      }
    }
    
    if (hasValue) {
      data.push(obj);
    }
  }
  return data;
}

/**
 * データを更新または新規追加する共通ヘルパー
 */
function upsertRow(sheetName, idColumnName, idValue, data, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { error: 'シートが見つかりません: ' + sheetName };
  
  var lastRow = sheet.getLastRow();
  var idColIndex = headers.indexOf(idColumnName) + 1;
  
  var foundRowIndex = -1;
  if (lastRow > 1) {
    var idValues = sheet.getRange(2, idColIndex, lastRow - 1, 1).getValues();
    for (var i = 0; i < idValues.length; i++) {
      if (idValues[i][0] == idValue) {
        foundRowIndex = i + 2; // 2行目以降のため +2
        break;
      }
    }
  }
  
  // 送信データを行配列に変換
  var rowValues = [];
  for (var j = 0; j < headers.length; j++) {
    var key = headers[j];
    var val = data[key];
    
    if (val !== undefined && val !== null) {
      if (typeof val === 'object') {
        // 配列やオブジェクトはJSON文字列化して保存
        rowValues.push(JSON.stringify(val));
      } else {
        rowValues.push(val);
      }
    } else {
      rowValues.push('');
    }
  }
  
  if (foundRowIndex !== -1) {
    // 既存行を上書き更新
    sheet.getRange(foundRowIndex, 1, 1, headers.length).setValues([rowValues]);
  } else {
    // 新規行として追加
    sheet.appendRow(rowValues);
  }
  
  return { success: true };
}

/**
 * データを削除する共通ヘルパー
 */
function deleteRow(sheetName, idColumnName, idValue, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { error: 'シートが見つかりません: ' + sheetName };
  
  var lastRow = sheet.getLastRow();
  var idColIndex = headers.indexOf(idColumnName) + 1;
  
  if (lastRow > 1) {
    var idValues = sheet.getRange(2, idColIndex, lastRow - 1, 1).getValues();
    // 削除時の行のずれを防ぐため、下から順に走査
    for (var i = idValues.length - 1; i >= 0; i--) {
      if (idValues[i][0] == idValue) {
        sheet.deleteRow(i + 2);
      }
    }
  }
  return { success: true };
}

// --- 個別データ操作関数 ---

function saveEvent(event) {
  return upsertRow('events', 'id', event.id, event, HEADERS.events);
}

function deleteEvent(id) {
  // イベント本体を削除
  deleteRow('events', 'id', id, HEADERS.events);
  // 連動するシフトデータも削除
  deleteRow('shifts', 'event_id', id, HEADERS.shifts);
  return { success: true };
}

function saveShift(shift) {
  return upsertRow('shifts', 'event_id', shift.event_id, shift, HEADERS.shifts);
}

function saveShop(shop) {
  return upsertRow('shops', 'id', shop.id, shop, HEADERS.shops);
}

function deleteShop(id) {
  return deleteRow('shops', 'id', id, HEADERS.shops);
}

function savePerformer(performer) {
  return upsertRow('performers', 'id', performer.id, performer, HEADERS.performers);
}

function deletePerformer(id) {
  return deleteRow('performers', 'id', id, HEADERS.performers);
}

function saveStaff(staff) {
  return upsertRow('staff', 'id', staff.id, staff, HEADERS.staff);
}

function deleteStaff(id) {
  if (id === 'u1') return { error: '管理者アカウントは削除できません' };
  return deleteRow('staff', 'id', id, HEADERS.staff);
}

/**
 * 全シートのデータを一括リセット（ヘッダーのみ残す）
 */
function resetAll() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  for (var sheetName in HEADERS) {
    var sheet = ss.getSheetByName(sheetName);
    if (sheet) {
      var lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        sheet.deleteRows(2, lastRow - 1);
      }
    }
  }
  initSheets(); // 初期管理者を再セットアップ
  return { success: true };
}

/**
 * JSON形式のHTTPレスポンスを作成するヘルパー
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
