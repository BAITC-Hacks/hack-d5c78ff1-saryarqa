import { createCloudSession } from './cloud.js';

const format = value => Number(value).toLocaleString('ru-RU', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
const messages = { INVALID_DISPLAY_NAME: 'Имя должно содержать от 3 до 32 символов.', PLAYER_AUTH_INVALID: 'Код входа не найден. Проверьте, что скопировали его полностью.', SAVE_IN_PROGRESS: 'Подождите окончания сохранения и повторите.', RATE_LIMITED: 'Слишком много запросов. Повторите через минуту.' };

/** Returns { destroy, open, cloud }. Reuse the app cloud instance to avoid duplicate saves. */
export function initAccountUI(session, { cloud: provided } = {}) {
  let storage; try { storage = localStorage; } catch { storage = null; }
  const cloud = provided || createCloudSession({ session, storage });
  const stylesheet = document.createElement('link'); stylesheet.rel = 'stylesheet'; stylesheet.href = '/game/account-ui.css'; document.head.append(stylesheet);
  const actions = document.createElement('div'); actions.className = 'account-actions';
  actions.innerHTML = '<button type="button" class="account-top-button">Топ акимов</button><button type="button" class="account-login-button">Войти / создать</button>';
  document.querySelector('.topbar')?.append(actions);
  const dialog = document.createElement('dialog'); dialog.className = 'account-dialog'; dialog.setAttribute('aria-labelledby', 'account-title');
  dialog.innerHTML = `<button type="button" class="account-close" aria-label="Закрыть профиль">×</button><p class="eyebrow">АКИМ НА 5 ЧАСОВ</p><h2 id="account-title">Кабинет акима</h2><p class="account-connection" role="status"></p>
    <nav class="account-tabs" aria-label="Раздел кабинета"><button type="button" data-page="profile">Профиль</button><button type="button" data-page="history">Мои планы</button><button type="button" data-page="ranking">Топ акимов</button></nav>
    <div class="account-feedback" role="status" aria-live="polite"></div>
    <section data-section="profile"><div class="account-guest"><h3>Ваш город. Ваш результат.</h3><p>Создайте профиль, чтобы сохранять результаты и участвовать в рейтинге. Имя увидят другие игроки.</p><form class="account-create"><label>Имя акима<input name="displayName" required minlength="3" maxlength="32" autocomplete="nickname" placeholder="Например, Аким Сарыарки"></label><button class="button button-primary" type="submit">Создать профиль</button></form><details class="account-signin"><summary>У меня уже есть код входа</summary><form class="account-enter"><label>Секретный код входа<input name="credential" type="password" required minlength="43" maxlength="43" autocomplete="current-password" spellcheck="false"></label><button class="button" type="submit">Войти</button></form></details></div>
    <div class="account-member" hidden><div class="account-profile"><span class="account-avatar" aria-hidden="true">А</span><div><h3 class="account-name"></h3><p class="account-rank"></p></div></div><form class="account-rename"><label>Имя в рейтинге<input name="displayName" required minlength="3" maxlength="32" autocomplete="nickname"></label><button type="submit" class="button">Изменить имя</button></form><div class="account-key"><strong>Вход на другом устройстве</strong><p>Скопируйте секретный код и сохраните его как пароль. Он даёт доступ к вашему профилю. Без него восстановить профиль нельзя.</p><button type="button" class="button account-copy">Скопировать код входа</button></div><button type="button" class="button account-logout">Выйти из профиля</button></div></section>
    <section data-section="history" hidden><div class="account-section-head"><h3>Сохранённые планы</h3><button type="button" class="button account-save">Сохранить результат</button></div><p class="account-history-note">После расчёта действительный план сохраняется автоматически. Черновик остаётся в этом браузере.</p><div class="account-history"></div></section>
    <section data-section="ranking" hidden><h3>Топ акимов</h3><p>Лучший проверенный результат каждого игрока. При равном балле выше план с меньшим бюджетом, затем более ранний.</p><ol class="account-ranking"></ol><p class="account-empty"></p></section>`;
  document.body.append(dialog);
  const $ = selector => dialog.querySelector(selector);
  const feedback = text => { $('.account-feedback').textContent = text; };
  const choose = page => { dialog.querySelectorAll('[data-section]').forEach(item => { item.hidden = item.dataset.section !== page; }); dialog.querySelectorAll('[data-page]').forEach(item => item.setAttribute('aria-pressed', String(item.dataset.page === page))); };
  function open(page = 'profile') { choose(page); if (!dialog.open) dialog.showModal(); void cloud.refresh(); }
  actions.children[0].addEventListener('click', () => open('ranking'));
  actions.children[1].addEventListener('click', () => open());
  $('.account-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); const page = event.target.closest('[data-page]')?.dataset.page; if (page) choose(page); });
  async function perform(work, success) {
    feedback('Подождите…');
    const buttons = [...dialog.querySelectorAll('button')]; buttons.forEach(button => { button.disabled = true; });
    try { await work(); feedback(success); } catch (error) { feedback(messages[error.message] || 'Сервер сейчас недоступен. Попробуйте ещё раз; ваш черновик сохранён в браузере.'); }
    finally { buttons.forEach(button => { button.disabled = false; }); }
  }
  $('.account-create').addEventListener('submit', event => { event.preventDefault(); void perform(() => cloud.createAccount(new FormData(event.target).get('displayName')), 'Профиль создан. Сохраните код входа для другого устройства.'); });
  $('.account-enter').addEventListener('submit', event => { event.preventDefault(); const code = new FormData(event.target).get('credential'); event.target.reset(); void perform(() => cloud.login(code), 'Вы вошли в профиль.'); });
  $('.account-rename').addEventListener('submit', event => { event.preventDefault(); void perform(() => cloud.rename(new FormData(event.target).get('displayName')), 'Имя обновлено.'); });
  $('.account-logout').addEventListener('click', () => { void perform(() => cloud.logout(), 'Вы вышли. Для повторного входа нужен сохранённый код.'); });
  $('.account-copy').addEventListener('click', () => { void perform(async () => { if (!navigator.clipboard?.writeText) throw new Error('CLIPBOARD_UNAVAILABLE'); await navigator.clipboard.writeText(cloud.getLoginCode()); }, 'Код скопирован. Сохраните его в надёжном месте.'); });
  $('.account-save').addEventListener('click', () => { if (!session.getSnapshot().result?.valid) { feedback('Сначала составьте пять решений и рассчитайте прогноз.'); return; } if (!cloud.getSnapshot().player) { choose('profile'); feedback('Сначала создайте профиль или войдите по коду.'); return; } void perform(async () => { await cloud.saveResult(); if (cloud.getSnapshot().saveStatus !== 'saved') throw new Error('SAVE_FAILED'); }, 'Результат сохранён.'); });
  const unsubscribe = cloud.subscribe(state => {
    const player = state.player;
    actions.children[1].textContent = player?.displayName || 'Войти / создать';
    $('.account-connection').textContent = state.connection === 'connected' ? (state.services?.storage?.mode === 'local' ? 'Сохранения и рейтинг на этом сервере' : 'Облачные сохранения подключены') : state.error || 'Подключаем сохранения…';
    $('.account-guest').hidden = Boolean(player); $('.account-member').hidden = !player;
    $('.account-name').textContent = player?.displayName || '';
    $('.account-rank').textContent = state.rank ? `Место в рейтинге: ${state.rank}` : 'Рассчитайте первый план, чтобы попасть в рейтинг';
    const nameInput = $('.account-rename input'); if (document.activeElement !== nameInput) nameInput.value = player?.displayName || '';
    const history = $('.account-history'); history.replaceChildren();
    if (!state.history.length) { const empty = document.createElement('p'); empty.textContent = player ? 'Пока нет сохранённых результатов. Соберите план и покажите прогноз.' : 'Войдите в профиль, чтобы открыть сохранённые планы.'; history.append(empty); }
    for (const run of state.history) {
      const row = document.createElement('article'); row.className = 'account-run';
      const summary = document.createElement('div'), title = document.createElement('strong'), details = document.createElement('span');
      title.textContent = `${format(run.score)} балла`; details.textContent = `Бюджет ${run.cost} / 100 · ${new Date(run.createdAt).toLocaleDateString('ru-RU')}`; summary.append(title, details);
      const restore = document.createElement('button'); restore.type = 'button'; restore.className = 'button'; restore.textContent = 'Открыть план'; restore.addEventListener('click', () => { const result = cloud.restoreRun(run); if (result?.ok === false) feedback(result.message || 'Не удалось открыть план.'); else dialog.close(); }); row.append(summary, restore); history.append(row);
    }
    const ranking = $('.account-ranking'); ranking.replaceChildren();
    for (const entry of state.entries) { const row = document.createElement('li'); row.className = entry.playerId === player?.id ? 'is-you' : ''; const name = document.createElement('span'), score = document.createElement('strong'); name.textContent = `${entry.rank}. ${entry.displayName || 'Аким'}${entry.playerId === player?.id ? ' · вы' : ''}`; score.textContent = format(entry.score); row.append(name, score); ranking.append(row); }
    $('.account-empty').textContent = state.entries.length ? 'Обновление каждые 10 секунд.' : 'Пока нет результатов. Первый проверенный план начнёт рейтинг.';
  });
  if (!provided) void cloud.connect();
  return { cloud, open, destroy() { unsubscribe(); if (!provided) cloud.destroy(); actions.remove(); dialog.remove(); stylesheet.remove(); } };
}
