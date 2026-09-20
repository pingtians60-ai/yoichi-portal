# 🏮 夜市 (Yoichi) Portal

学生団体・地域イベント「夜市」の活動スケジュール、イベント別シフト、出店者・出演者情報、運営スタッフ名簿を一元管理するポータルWebアプリケーションです。

---

## 🌟 主な機能

1. **📅 カレンダー・スケジュール管理**
   - 月表示・週表示・日表示の切り替え
   - カテゴリ別（定例MTG、企画打ち合わせ、イベント本番、締切など）の色分け
   - 予定ごとの参加メンバーアサイン

2. **👥 イベント別シフト表（タイムテーブル＆担当配置）**
   - イベントごとのタイムスロット別役割・人員配置
   - 直感的なアサイン操作と空き枠・重複チェック
   - 印刷・PDF出力用最適化レイアウト

3. **🎪 出店者・出演者管理**
   - 飲食・物販ブースおよびステージ出演者の情報一覧
   - 連絡先、出店内容、機材・控室メモの管理

4. **📋 メンバー名簿・権限設定**
   - コア・チーフ・アシスタント等の役職および背番号・プログラム管理
   - クイック検索・フィルタ機能

5. **🔄 Googleスプレッドシート / GAS リアルタイム同期**
   - Google Apps Script (GAS) をバックエンドAPIとして連携
   - スプレッドシート上でのデータ編集・蓄積がポータルにリアルタイム反映

6. **🎨 洗練されたデザイン・操作性**
   - 和モダンテイストを取り入れたダークモードUI
   - スマートフォン・タブレット・PCに完全対応（レスポンシブデザイン）

---

## 🚀 GitHub Pages での公開手順

このリポジトリは静的Webサイト（HTML/CSS/JavaScript）で構成されているため、**GitHub Pages** を使うことで完全無料でWeb上に公開できます。

1. **GitHubリポジトリの設定画面を開く**
   - リポジトリ上部の **「Settings」**（設定）タブをクリックします。
2. **Pagesメニューに移動**
   - 左側メニューの **「Code and automation」** ➔ **「Pages」** を選択します。
3. **公開ブランチを設定**
   - **「Build and deployment」** の **「Source」** で **「Deploy from a branch」** を選択します。
   - **「Branch」** で **`main`**、フォルダは **`/ (root)`** を選択し、**「Save」** をクリックします。
4. **サイトのURLを確認**
   - 数分待ってページを再読み込みすると、画面上部に公開URLが表示されます：
     `https://<ユーザー名>.github.io/<リポジトリ名>/`
   - このURLをメンバーに共有すれば、誰でもスマホやPCからアクセスして利用できます。

---

## ⚙️ Google Apps Script (GAS) との連携設定

スプレッドシート連携を有効化するには：
1. `gas/Code.gs` をご自身のGoogleスプレッドシートのApps Scriptに配置し、ウェブアプリとしてデプロイします。
2. 詳しい手順は [gas/README.md](gas/README.md) をご覧ください。
3. デプロイ後に発行されたウェブアプリURLを `js/config.js` の `GAS_API_URL` に設定します。

```javascript
// js/config.js
const GAS_API_URL = 'https://script.google.com/macros/s/AKfycb.../exec';
```

---

## 📁 ディレクトリ構成

```text
├── index.html           # ポータルメインHTML（GitHub Pagesのエントリポイント）
├── css/                 # スタイルシート（main.css, calendar.css, event_shift.css）
├── js/                  # アプリケーションロジック
│   ├── config.js        # GAS / Supabase 接続設定
│   ├── store.js         # データ管理・ローカルストレージ・同期処理
│   ├── schedule.js      # カレンダー・スケジュール描画
│   ├── event_shift.js   # シフト表・タイムテーブル処理
│   ├── members.js       # メンバー名簿・設定
│   └── ...
├── gas/                 # Google Apps Script 関連コード・ドキュメント
│   ├── Code.gs          # スプレッドシート同期用GASバックエンド
│   ├── index.html       # GAS単体運用用のインラインバンドルHTML
│   └── README.md        # GAS単体デプロイ手順ガイド
├── images/              # アイコン・ロゴ画像アセット
└── build-gas.ps1        # GAS用単一HTML生成スクリプト（PowerShell）
```

---

## 💻 ローカル環境での実行

ローカルで動作確認する場合は、以下のいずれかの方法で実行できます：

- **VS Code Live Server**: `index.html` を右クリックして「Open with Live Server」
- **Python**: `python -m http.server 8000`
- **Node.js (npx)**: `npx serve .`
- またはブラウザで直接 `index.html` を開く
