/** 밝은 색 세트(기본). 설계 문서 §4의 표와 같은 값이다. */
const LIGHT_VARS = `
  --dnf-surface: #ffffff;
  --dnf-surface-alt: #fafbfc;
  --dnf-text: #1d2129;
  --dnf-text-soft: #3a4350;
  --dnf-muted: #5f6b7a;
  --dnf-border: #e3e6ea;
  --dnf-divider: #eef0f2;
  --dnf-accent: #1a73e8;
  --dnf-accent-soft: #f3f8ff;
  --dnf-accent-line: #d6e6fd;
  --dnf-tag-text: #1a5fc4;
  --dnf-badge: #f1f3f5;
  --dnf-scrollbar: #c4cad2;
  --dnf-button: #ffffff;
  --dnf-shadow: 0 8px 24px rgba(20, 30, 50, 0.12);
`;

/** 어두운 색 세트. 테마가 dark이거나, auto이면서 크롬이 어두운 모드일 때 쓴다. */
const DARK_VARS = `
  --dnf-surface: #1f242b;
  --dnf-surface-alt: #1b2026;
  --dnf-text: #e6eaef;
  --dnf-text-soft: #c3cad3;
  --dnf-muted: #9aa4b1;
  --dnf-border: #2f3640;
  --dnf-divider: #2a3038;
  --dnf-accent: #79aef5;
  --dnf-accent-soft: #1d2c42;
  --dnf-accent-line: #2d4a73;
  --dnf-tag-text: #9cc2f7;
  --dnf-badge: #2b323b;
  --dnf-scrollbar: #4a5360;
  --dnf-button: #262c34;
  --dnf-shadow: 0 8px 24px rgba(0, 0, 0, 0.55);
`;

/** Shadow DOM 안에서만 적용되는 카드·아이콘 스타일. 테마는 호스트의 data-theme으로 고른다. */
export const OVERLAY_CSS = `
:host {
  ${LIGHT_VARS}
  --dnf-brand: linear-gradient(135deg, #03c75a, #1a73e8);
  --dnf-brand-bar: linear-gradient(90deg, #03c75a, #1a73e8);
  font-family: -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
}
:host([data-theme='dark']) {
  ${DARK_VARS}
}
@media (prefers-color-scheme: dark) {
  :host([data-theme='auto']) {
    ${DARK_VARS}
  }
}
.icon {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: var(--dnf-brand);
  box-shadow: 0 3px 10px rgba(26, 115, 232, 0.35);
  cursor: pointer;
  transition: transform 120ms ease-out;
}
.icon:hover { transform: scale(1.08); }
.icon:focus-visible { outline: 2px solid var(--dnf-accent); outline-offset: 2px; }
.card {
  position: absolute;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: 320px;
  overflow: hidden;
  border: 1px solid var(--dnf-border);
  border-radius: 12px;
  background: var(--dnf-surface);
  box-shadow: var(--dnf-shadow);
  color: var(--dnf-text);
  font-size: 13px;
  line-height: 1.6;
}
.card-header {
  display: flex;
  flex: none;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  padding: 16px 15px 2px;
  background: var(--dnf-brand-bar) top / 100% 4px no-repeat;
}
.card-heading { display: flex; align-items: center; gap: 6px; min-width: 0; }
.card-title { font-size: 17px; font-weight: 800; letter-spacing: -0.2px; overflow-wrap: anywhere; }
.card-badge {
  flex: none;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--dnf-badge);
  color: var(--dnf-muted);
  font-size: 10px;
  font-weight: 600;
}
.card-close {
  flex: none;
  padding: 2px 4px;
  border: 0;
  border-radius: 4px;
  background: none;
  color: var(--dnf-muted);
  cursor: pointer;
  font-size: 13px;
}
.card-close:hover, .card-close:focus-visible { color: var(--dnf-text); background: var(--dnf-badge); }
.card-body { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 4px 15px 12px; }
.card-body::-webkit-scrollbar { width: 6px; }
.card-body::-webkit-scrollbar-thumb { background: var(--dnf-scrollbar); border-radius: 999px; }
.card-body::-webkit-scrollbar-track { background: transparent; }
.card-extract {
  margin: 4px 0 0;
  color: var(--dnf-text-soft);
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.card-message { margin: 4px 0 0; color: var(--dnf-muted); }
.card-link {
  display: block;
  margin-top: 9px;
  color: var(--dnf-accent);
  font-size: 12px;
  text-align: right;
  text-decoration: none;
}
.card-link:hover, .card-link:focus-visible { text-decoration: underline; }
.card-attribution { margin: 4px 0 0; color: var(--dnf-muted); font-size: 11px; text-align: right; }
.card-license { color: inherit; text-decoration: underline; }
.card button:focus-visible, .card a:focus-visible { outline: 2px solid var(--dnf-accent); outline-offset: 2px; }
.card-retry {
  margin-left: 6px;
  padding: 3px 10px;
  border: 1px solid var(--dnf-accent-line);
  border-radius: 6px;
  background: var(--dnf-accent-soft);
  color: var(--dnf-accent);
  cursor: pointer;
  font: inherit;
}
.card-suggestion {
  margin: 6px 0 4px;
  padding: 9px 11px;
  border: 1px solid var(--dnf-accent-line);
  border-radius: 10px;
  background: var(--dnf-accent-soft);
}
.card-chip { margin: 0; color: var(--dnf-tag-text); font-size: 10.5px; font-weight: 700; }
.card-suggestion .card-meaning {
  display: block;
  padding: 0;
  border: 0;
  background: none;
  color: var(--dnf-text);
  cursor: pointer;
  font: inherit;
  font-weight: 700;
  text-align: left;
}
.card-suggestion .card-meaning:hover, .card-suggestion .card-meaning:focus-visible { color: var(--dnf-accent); }
.card-suggestion-extract {
  margin: 0;
  color: var(--dnf-text-soft);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.card-section-title { margin: 11px 0 5px; color: var(--dnf-muted); font-size: 11px; font-weight: 700; }
.card-basic { margin: 0 0 2px; color: var(--dnf-text-soft); }
.card-meanings { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; }
.card-meanings .card-meaning {
  padding: 4px 10px;
  border: 1px solid var(--dnf-accent-line);
  border-radius: 999px;
  background: var(--dnf-accent-soft);
  color: var(--dnf-tag-text);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  text-align: left;
}
.card-meanings .card-meaning:hover, .card-meanings .card-meaning:focus-visible { border-color: var(--dnf-accent); }
.card-meaning-text {
  display: inline-block;
  padding: 4px 10px;
  border: 1px dashed var(--dnf-border);
  border-radius: 999px;
  color: var(--dnf-muted);
  font-size: 12px;
}
.card-more { margin: 6px 0 0; color: var(--dnf-muted); font-size: 11.5px; }
.card-actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: 6px;
  padding: 10px 15px 12px;
  border-top: 1px solid var(--dnf-divider);
  background: var(--dnf-surface-alt);
}
.card-action {
  flex: none;
  padding: 6px 11px;
  border: 1px solid var(--dnf-border);
  border-radius: 8px;
  background: var(--dnf-button);
  color: var(--dnf-text);
  font-size: 12px;
  text-align: center;
  text-decoration: none;
}
.card-action:hover, .card-action:focus-visible { border-color: var(--dnf-accent); }
.card-search-input {
  flex: 1;
  min-width: 0;
  box-sizing: border-box;
  padding: 6px 10px;
  border: 1px solid var(--dnf-border);
  border-radius: 8px;
  background: var(--dnf-surface);
  color: var(--dnf-text);
  font: inherit;
  font-size: 13px;
}
.card-search-input:focus-visible { outline: 2px solid var(--dnf-accent); outline-offset: -1px; }
a.card-action[aria-disabled='true'] { opacity: 0.5; cursor: default; }
`;
