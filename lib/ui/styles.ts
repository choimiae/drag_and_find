/** Shadow DOM 안에서만 적용되는 임시 스타일. 시각 디자인은 공개 전 시안 단계에서 교체한다. */
export const OVERLAY_CSS = `
:host {
  --dnf-surface: #ffffff;
  --dnf-text: #1f2328;
  --dnf-muted: #59636e;
  --dnf-border: #d0d7de;
  --dnf-accent: #0969da;
  --dnf-shadow: 0 8px 24px rgba(31, 35, 40, 0.18);
  --dnf-radius: 10px;
  font-family: system-ui, -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
}
@media (prefers-color-scheme: dark) {
  :host {
    --dnf-surface: #1f2328;
    --dnf-text: #e6edf3;
    --dnf-muted: #9198a1;
    --dnf-border: #3d444d;
    --dnf-accent: #4493f8;
  }
}
.icon {
  position: absolute;
  width: 28px;
  height: 28px;
  border: 1px solid var(--dnf-border);
  border-radius: 50%;
  background: var(--dnf-surface);
  box-shadow: var(--dnf-shadow);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
}
.card {
  position: absolute;
  box-sizing: border-box;
  width: 320px;
  overflow: auto;
  border: 1px solid var(--dnf-border);
  border-radius: var(--dnf-radius);
  background: var(--dnf-surface);
  box-shadow: var(--dnf-shadow);
  color: var(--dnf-text);
  font-size: 14px;
  line-height: 1.5;
}
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px 4px;
}
.card-title { font-weight: 700; font-size: 15px; }
.card-close { border: 0; background: none; color: var(--dnf-muted); cursor: pointer; font-size: 14px; }
.card-body { padding: 0 12px 10px; }
.card-extract {
  margin: 0 0 6px;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.card-message { margin: 0 0 6px; color: var(--dnf-muted); }
.card-link { color: var(--dnf-accent); text-decoration: none; font-size: 13px; }
.card-retry { margin-left: 6px; cursor: pointer; }
.card-actions { display: flex; gap: 8px; padding: 10px 12px; border-top: 1px solid var(--dnf-border); }
.card-action {
  flex: 1;
  padding: 6px 0;
  border: 1px solid var(--dnf-border);
  border-radius: 6px;
  color: var(--dnf-text);
  text-align: center;
  text-decoration: none;
  font-size: 13px;
}
.card-action:hover, .card-action:focus-visible { border-color: var(--dnf-accent); color: var(--dnf-accent); }
`;
