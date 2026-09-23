/** Physical WASD keys work with Russian/Kazakh layouts as well as Latin. */
export function movementKey(event) {
  const physical = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd' }[event.code];
  const key = physical || (event.key?.length === 1 ? event.key.toLowerCase() : event.key);
  return ['w', 'a', 's', 'd', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'].includes(key) ? key : null;
}

/** Touch/keyboard buttons share the scene's movement loop, with no extra timer. */
export function createWalkControls({ host, stage, onInput, onCenter = () => {} }) {
  const documentRef = host.ownerDocument || document;
  const panel = documentRef.createElement('div');
  panel.className = 'atlas-walk-controls';
  panel.setAttribute('role', 'group');
  panel.setAttribute('aria-label', 'Перемещение акима');
  panel.hidden = true;
  const directions = [
    ['ArrowUp', 'Идти вперёд', 'M12 19V5M5 12l7-7 7 7'],
    ['ArrowLeft', 'Идти влево', 'M19 12H5M12 5l-7 7 7 7'],
    ['center', 'Найти акима', 'M12 8v8M8 12h8M12 3v2M12 19v2M3 12h2M19 12h2'],
    ['ArrowRight', 'Идти вправо', 'M5 12h14M12 5l7 7-7 7'],
    ['ArrowDown', 'Идти назад', 'M12 5v14M5 12l7 7 7-7'],
  ];
  const listeners = [], held = new Map();
  let enabled = false, destroyed = false;
  const listen = (node, type, handler) => {
    node.addEventListener(type, handler);
    listeners.push(() => node.removeEventListener(type, handler));
  };
  function release(id) {
    const value = held.get(id);
    if (!value) return;
    held.delete(id);
    if (![...held.values()].some(item => item.key === value.key)) onInput(value.key, false);
    value.button.setAttribute('aria-pressed', 'false');
    if (typeof id === 'number' && value.button.hasPointerCapture?.(id)) value.button.releasePointerCapture(id);
  }
  function releaseAll() { [...held.keys()].forEach(release); }
  for (const [key, label, path] of directions) {
    const button = documentRef.createElement('button');
    button.type = 'button'; button.dataset.walkKey = key;
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
    button.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>`;
    panel.appendChild(button);
    if (key === 'center') {
      listen(button, 'click', () => { if (enabled) { onCenter(); stage.focus({ preventScroll: true }); } });
      continue;
    }
    button.setAttribute('aria-pressed', 'false');
    const press = (id) => {
      if (!enabled || destroyed || held.has(id)) return;
      held.set(id, { key, button }); button.setAttribute('aria-pressed', 'true'); onInput(key, true);
    };
    listen(button, 'pointerdown', event => {
      if (event.button !== 0 || !enabled) return;
      event.preventDefault(); button.setPointerCapture?.(event.pointerId); press(event.pointerId);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(button, type, event => release(event.pointerId));
    listen(button, 'keydown', event => {
      if (!['Enter', ' '].includes(event.key)) return;
      event.preventDefault(); press(`keyboard:${key}`);
    });
    listen(button, 'keyup', event => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); release(`keyboard:${key}`); } });
    listen(button, 'blur', releaseAll);
  }
  listen(documentRef, 'visibilitychange', () => { if (documentRef.hidden) releaseAll(); });
  const windowRef = documentRef.defaultView;
  if (windowRef) listen(windowRef, 'blur', releaseAll);
  host.appendChild(panel);
  return {
    setEnabled(value) { enabled = Boolean(value) && !destroyed; panel.hidden = !enabled; if (!enabled) releaseAll(); },
    destroy() { if (destroyed) return; destroyed = true; enabled = false; releaseAll(); listeners.forEach(remove => remove()); panel.remove(); },
  };
}
