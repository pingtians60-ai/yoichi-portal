/* ==========================================================================
   夜市 (Yoichi) - Template & Communications Manager Module
   ========================================================================== */

const TemplatesModule = {
  variables: {
    month: '',
    date: '',
    organizer: '',
    atmosphere: '',
    feedbackFormUrl: '',
    eventName: '',
    highlightPerformer: '',
    childActivity: '',
    lawnActivity: '',
    eventSchedule: ''
  },

  // Fallbacks to show in preview when variables are empty
  fallbacks: {
    month: '◯',
    date: '◯月◯日',
    organizer: '〇〇',
    atmosphere: '【その月のイベントの雰囲気を記述してください】',
    feedbackFormUrl: '（振り返りフォームのリンク）',
    eventName: '◯月たなべ夜市・朝市',
    highlightPerformer: '◯◯（出演アーティストなど）',
    childActivity: '◯◯（スーパーボールすくいなど）',
    lawnActivity: '◯◯（ミニゲームなど）',
    eventSchedule: '17:00 開場・物販開始\n18:00 ステージパフォーマンス\n20:00 キャンプファイヤー\n21:00 終了'
  },

  init() {
    this.loadVariablesFromStorage();
    this.bindEvents();
    this.render();
  },

  loadVariablesFromStorage() {
    const saved = localStorage.getItem('yoichi_template_vars');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.variables = { ...this.variables, ...parsed };
      } catch (e) {
        console.warn('Failed to parse saved template variables', e);
      }
    } else {
      // Default initial values
      this.variables.month = '10';
      this.variables.date = '10月20日';
      this.variables.organizer = '運営担当';
      this.variables.atmosphere = '秋の涼しげな風が吹く中で、温かい食べ物と音楽を楽しめる特別な夜市です。';
      this.variables.feedbackFormUrl = 'https://forms.gle/example';
      this.variables.eventName = '10月たなべ朝市・夜市';
      this.variables.highlightPerformer = '地元のジャズバンド';
      this.variables.childActivity = '手作りちょうちん体験';
      this.variables.lawnActivity = '巨大オセロ・モルック体験';
      this.variables.eventSchedule = '09:00 - 12:00 たなべ朝市\n16:00 - 21:00 たなべ夜市\n18:30 キャンプファイヤー点火';
    }
  },

  saveVariablesToStorage() {
    localStorage.setItem('yoichi_template_vars', JSON.stringify(this.variables));
  },

  bindEvents() {
    // Listen to changes in variable inputs
    document.getElementById('templates-customizer-form')?.addEventListener('input', (e) => {
      const target = e.target;
      const varName = target.dataset.var;
      if (varName && varName in this.variables) {
        this.variables[varName] = target.value;
        this.saveVariablesToStorage();
        this.updatePreviews();
      }
    });

    // Category button toggles
    document.querySelectorAll('.template-cat-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.template-cat-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.renderTemplatesList(e.currentTarget.dataset.category);
      });
    });
  },

  render() {
    this.renderCustomizer();
    this.renderTemplatesList('all');
  },

  renderCustomizer() {
    const form = document.getElementById('templates-customizer-form');
    if (!form) return;

    form.innerHTML = `
      <div class="customizer-section-title">基本・連絡情報</div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">開催月 (例: 10)</label>
          <input type="text" class="form-control form-control-sm" data-var="month" value="${Utils.escapeHtml(this.variables.month)}" placeholder="10">
        </div>
        <div class="form-group">
          <label class="form-label">担当者名</label>
          <input type="text" class="form-control form-control-sm" data-var="organizer" value="${Utils.escapeHtml(this.variables.organizer)}" placeholder="山田">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">開催日・日時詳細</label>
        <input type="text" class="form-control form-control-sm" data-var="date" value="${Utils.escapeHtml(this.variables.date)}" placeholder="10月20日">
      </div>
      <div class="form-group">
        <label class="form-label">振り返りフォームURL</label>
        <input type="url" class="form-control form-control-sm" data-var="feedbackFormUrl" value="${Utils.escapeHtml(this.variables.feedbackFormUrl)}" placeholder="https://forms.gle/...">
      </div>
      <div class="form-group">
        <label class="form-label">今月のイベントの雰囲気・魅力説明</label>
        <textarea class="form-control form-control-sm" data-var="atmosphere" rows="3" placeholder="秋 of 夜長を彩るキャンドルナイトを実施します...">${Utils.escapeHtml(this.variables.atmosphere)}</textarea>
      </div>

      <div class="customizer-section-title" style="margin-top: 1.5rem;">広報（PR）情報</div>
      <div class="form-group">
        <label class="form-label">イベント正式名称</label>
        <input type="text" class="form-control form-control-sm" data-var="eventName" value="${Utils.escapeHtml(this.variables.eventName)}" placeholder="10月たなべ夜市">
      </div>
      <div class="form-group">
        <label class="form-label">目玉ステージ出演者</label>
        <input type="text" class="form-control form-control-sm" data-var="highlightPerformer" value="${Utils.escapeHtml(this.variables.highlightPerformer)}" placeholder="吹奏楽団">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">子ども向け企画</label>
          <input type="text" class="form-control form-control-sm" data-var="childActivity" value="${Utils.escapeHtml(this.variables.childActivity)}" placeholder="謎解きラリー">
        </div>
        <div class="form-group">
          <label class="form-label">芝生広場での催し</label>
          <input type="text" class="form-control form-control-sm" data-var="lawnActivity" value="${Utils.escapeHtml(this.variables.lawnActivity)}" placeholder="シャボン玉飛ばし">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">広報用スケジュール詳細</label>
        <textarea class="form-control form-control-sm" data-var="eventSchedule" rows="4" placeholder="17:00 開演...">${Utils.escapeHtml(this.variables.eventSchedule)}</textarea>
      </div>
    `;
  },

  getCustomizedText(templateStr) {
    let text = templateStr;
    Object.keys(this.variables).forEach(key => {
      const placeholder = `{${key}}`;
      const value = this.variables[key] || this.fallbacks[key];
      text = text.split(placeholder).join(value);
    });
    return text;
  },

  renderTemplatesList(category = 'all') {
    const container = document.getElementById('templates-grid-container');
    if (!container) return;

    container.innerHTML = '';

    const filtered = TemplatesData.filter(t => category === 'all' || t.category === category);

    if (filtered.length === 0) {
      container.innerHTML = '<div class="no-templates">該当する定型文はありません。</div>';
      return;
    }

    filtered.forEach(item => {
      const customizedText = this.getCustomizedText(item.template);
      const card = document.createElement('div');
      card.className = 'card template-card';
      card.dataset.id = item.id;
      
      card.innerHTML = `
        <div class="template-card-header">
          <div>
            <span class="template-badge ${item.category === 'member_comm' ? 'badge-comm' : 'badge-pr'}">
              ${item.category === 'member_comm' ? '出演者連絡' : '広報用スクリプト'}
            </span>
            <h4 class="template-card-title">${Utils.escapeHtml(item.title)}</h4>
          </div>
          <button class="btn btn-secondary btn-sm btn-copy-template" data-id="${item.id}">
            コピー
          </button>
        </div>
        <p class="template-card-desc">${Utils.escapeHtml(item.description)}</p>
        <div class="template-preview-box">
          <pre class="template-preview-text" id="preview-${item.id}">${Utils.escapeHtml(customizedText)}</pre>
        </div>
      `;

      card.querySelector('.btn-copy-template')?.addEventListener('click', (e) => {
        this.copyToClipboard(item.id, e.currentTarget);
      });

      container.appendChild(card);
    });
  },

  updatePreviews() {
    TemplatesData.forEach(item => {
      const previewEl = document.getElementById(`preview-${item.id}`);
      if (previewEl) {
        previewEl.textContent = this.getCustomizedText(item.template);
      }
    });
  },

  async copyToClipboard(id, buttonEl) {
    const item = TemplatesData.find(t => t.id === id);
    if (!item) return;

    const customizedText = this.getCustomizedText(item.template);

    try {
      await navigator.clipboard.writeText(customizedText);
      
      const oldText = buttonEl.textContent;
      buttonEl.textContent = 'コピー完了 ✓';
      buttonEl.classList.add('btn-success');
      buttonEl.style.backgroundColor = 'var(--success-bg)';
      buttonEl.style.color = 'var(--success-text)';
      buttonEl.style.borderColor = 'var(--success-text)';

      if (typeof Utils !== 'undefined' && Utils.showToast) {
        Utils.showToast(`${item.title} をコピーしました！`, 'success');
      }

      setTimeout(() => {
        buttonEl.textContent = oldText;
        buttonEl.classList.remove('btn-success');
        buttonEl.style.backgroundColor = '';
        buttonEl.style.color = '';
        buttonEl.style.borderColor = '';
      }, 2000);

    } catch (err) {
      console.error('Failed to copy text', err);
      if (typeof Utils !== 'undefined' && Utils.showToast) {
        Utils.showToast('コピーに失敗しました。', 'error');
      }
    }
  }
};

const TemplatesData = [
  {
    id: 'rejection_email',
    title: '選考結果（お断りメール）',
    category: 'member_comm',
    description: '出演選考結果を見送る際に送信するメール文面です。',
    template: `件名：【重要】{month}月たなべ朝市・夜市出演選考結果のお知らせ

出演者様各位

いつもお世話になっております。
たなべ朝市・夜市の{organizer}と申します。

この度は、{month}月たなべ朝市・夜市へ出演のお申し込みをいただき、誠にありがとうございました。
お送りいただいた内容を拝見し、本イベントに関心をお寄せいただいたことに心より感謝申し上げます。

慎重に検討を重ねてまいりましたが、誠に残念ながら、今回はご出演を見送らせていただくこととなりました。
ご期待に沿えない結果となりましたこと、深くお詫び申し上げます。

今後も、京田辺に賑わいとつながりを創る活動を続けてまいります。またの機会がございましたら、ぜひ改めてご応募いただけましたら幸いに存じます。
末筆ではございますが、皆様の今後ますますのご発展を心よりお祈り申し上げます。

―――――――――――――――――――――――――― 
たなべ朝市・夜市運営委員
担当：{organizer}
TEL ：0774-79-0208
MAIL：staff@tend-inc.com
――――――――――――――――――――――――――`
  },
  {
    id: 'line_greeting',
    title: '出演者グループLINE挨拶文',
    category: 'member_comm',
    description: '出演者決定後、連絡用のグループLINEを作成した際の最初の挨拶文面です。',
    template: `{month}月たなべ朝市・夜市、出演者のみなさま【おはようございます・こんにちは・こんばんは】
たなべ朝市・夜市運営の{organizer}と申します。

当日のやりとりや連絡事項、告知などをスムーズに行えるようこちらのグループLINEを作成しております！グループLINEの利用方法はノート機能にまとめておりますのでお時間のある時にご確認いただけたらと思います。

{month}月たなべ夜市は{atmosphere}
また、キッチンカーや飲食露店など、たくさんの方に楽しんでいただけるようなイベントをご用意しております！
出演者のみなさまも是非お楽しみください。

当日プログラムや楽屋の利用時間など、出演に関わるご連絡は調整できしだい、このグループにてご連絡いたします！
今月はどうぞよろしくお願いいたします！`
  },
  {
    id: 'program_guide',
    title: '当日プログラム案内文',
    category: 'member_comm',
    description: '出演時間やリハーサル時間、楽屋利用の案内を送る際の文面です。',
    template: `いつもお世話になっております。
このたびは、{date}開催のたなべ朝市・夜市にご出演いただき、誠にありがとうございます。
運営一同、皆さまとご一緒できることを大変うれしく思っております。

本日は、当日のスケジュールについてのご連絡です。

【出演時間のご案内】
当日のリハーサル時間および出演時間につきまして、下記の通りご案内いたします。
⸻
■ [出演者名]
・リハーサル：[時間]
・出演：[時間]
・控室利用時間：[時間]

⸻

当日は、本部テントにてご来場を確認させていただいた後、楽屋としてご利用いただける「多目的C棟」へご案内いたします。

※ 本部テントの位置につきましては、後日お送りする会場マップをご確認ください。
※ 多目的C棟は、準備・荷物置き・休憩スペースとしてご利用いただけます。
※ 今回はスケジュールの都合上、タイトな部分もあり、十分な配慮が行き届かない点があるかと思いますが、運営一同、できる限り円滑に進行できるよう努めてまいりますので、ご理解・ご協力のほどよろしくお願いいたします。
なお、出演時間の30分前までに本部テントへお越しくださいますようお願いいたします。

ご不明な点がございましたら、お気軽にご連絡ください。
当日はどうぞよろしくお願いいたします。`
  },
  {
    id: 'line_day_before',
    title: '前日ライン連絡',
    category: 'member_comm',
    description: 'イベント前日に出演者グループへ送信する最終リマインド文面です。',
    template: `出演者の皆さまへ

このたびは「たなべ朝市・夜市」にご出演いただき、誠にありがとうございます！
いよいよ明日となりましたね！

明日、皆さまと夜市でお会いできるのを心より楽しみにしております。
どうぞよろしくお願いいたします！`
  },
  {
    id: 'line_thank_you',
    title: '後日謝礼文（次の日厳守）',
    category: 'member_comm',
    description: 'イベント終了の翌日に感謝を伝え、フィードバックを求めるための文面です。',
    template: `出演者の皆様

先日は「{month}月たなべ夜市」にご出店いただき、誠にありがとうございました。
皆様のご協力のおかげで、無事に終えることができました！

運営面では行き届かない点も多々あったかと存じますが、さらにより良い場をつくっていくため、差し支えなければ下記フォームよりご感想やお気づき点をお寄せいただけますと幸いです。

【振り返りフォーム】
{feedbackFormUrl}

いただいたご意見は、今後の運営に大切に活かしてまいります。

またご一緒できる機会がございましたら、その際はどうぞよろしくお願いいたします！

たなべ夜市・朝市運営委員
{organizer}`
  },
  {
    id: 'pr_gogai',
    title: '号外ネット広報文',
    category: 'pr_script',
    description: '号外ネットへ送る広報用のイベント情報文面です。',
    template: `【イベント名】
{eventName}

【日時】
{date}

【場所】
京田辺クロスパーク

【内容】
キッチンカーや、飲食露店による出店、雑貨などの物販があります。
また、地元のパフォーマンス団体によるステージイベントがあります。
今月は{highlightPerformer}が来てくれます！

子ども向け企画として、{childActivity}があります。
芝生広場では、{lawnActivity}があります。

イベントの最後には、キャンプファイヤーを囲むレクリエーション企画を予定しており、一日の締めくくりとして特別な時間を過ごしていただけます。

イベントスケジュールは以下です。
{eventSchedule}`
  },
  {
    id: 'pr_alco',
    title: 'ALCO広報文',
    category: 'pr_script',
    description: 'ALCO（地域情報サイト）へ送る広報用のイベント情報文面です。',
    template: `【イベント名】
{eventName}

【日時】
{date}

【場所】
京田辺クロスパーク

【内容】
キッチンカーや、飲食露店による出店、雑貨などの物販があります。
また、地元のパフォーマンス団体によるステージイベントがあります。
今月は{highlightPerformer}が来てくれます！

子ども向け企画として、{childActivity}があります。
芝生広場では、{lawnActivity}があります。

イベントの最後には、キャンプファイヤーを囲むレクリエーション企画を予定しており、一日の締めくくりとして特別な時間を過ごしていただけます。

イベントスケジュールは以下です。
{eventSchedule}`
  },
  {
    id: 'pr_kbs',
    title: 'KBS京都広報文',
    category: 'pr_script',
    description: 'KBS京都（テレビ・ラジオ等）へ送る広報用のイベント情報文面です。',
    template: `【イベント名】
{eventName}

【日時】
{date}

【場所】
京田辺クロスパーク

【内容}
キッチンカーや、飲食露店による出店、雑貨などの物販があります。
また、地元のパフォーマンス団体によるステージイベントがあります。
今月は{highlightPerformer}が来てくれます！

子ども向け企画として、{childActivity}があります。
芝生広場では、{lawnActivity}があります。

イベントの最後には、キャンプファイヤーを囲むレクリエーション企画を予定しており、一日の締めくくりとして特別な時間を過ごしていただけます。

イベントスケジュールは以下です。
{eventSchedule}`
  }
];
