(function initWidgetStyles(globalScope) {
  "use strict";

  const namespace = globalScope.TranslatorExt || {};

  namespace.WIDGET_STYLES = `
:host {
  all: initial;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  line-height: 1.5;
  font-size: 14px;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

.hidden {
  display: none !important;
}

.widget-theme-root {
  --modal-alpha: 0.88;
  --glass-bg: rgba(255, 255, 255, var(--modal-alpha));
  --glass-header-bg: rgba(248, 250, 252, 0.72);
  --surface-bg: rgba(255, 255, 255, 0.78);
  --result-bg: rgba(241, 245, 249, 0.82);
  --border-color: rgba(148, 163, 184, 0.38);
  --text-primary: #0F172A;
  --text-secondary: #475569;
  --text-muted: #64748B;
  --accent: #2563EB;
  --accent-soft: rgba(37, 99, 235, 0.12);
  --shadow-modal: 0 24px 60px rgba(15, 23, 42, 0.28), 0 4px 16px rgba(15, 23, 42, 0.12);
  color: var(--text-primary);
}

.widget-theme-root[data-theme="dark"] {
  --glass-bg: rgba(15, 23, 42, var(--modal-alpha));
  --glass-header-bg: rgba(30, 41, 59, 0.72);
  --surface-bg: rgba(30, 41, 59, 0.82);
  --result-bg: rgba(15, 23, 42, 0.78);
  --border-color: rgba(148, 163, 184, 0.25);
  --text-primary: #F8FAFC;
  --text-secondary: #CBD5E1;
  --text-muted: #94A3B8;
  --accent: #3B82F6;
  --accent-soft: rgba(59, 130, 246, 0.2);
  --shadow-modal: 0 24px 60px rgba(0, 0, 0, 0.55), 0 4px 16px rgba(0, 0, 0, 0.35);
}

.floating-trigger {
  position: fixed;
  z-index: 2147483646;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  border: 1.5px solid #3B82F6;
  background: #1E293B;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.28), 0 2px 6px rgba(15, 23, 42, 0.16);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  transition: transform 120ms ease, box-shadow 120ms ease;
  user-select: none;
}

.floating-trigger:hover {
  transform: translateY(-2px) scale(1.06);
  box-shadow: 0 10px 24px rgba(59, 130, 246, 0.38);
}

.floating-trigger svg {
  width: 22px;
  height: 22px;
  pointer-events: none;
}

.translator-modal {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 2147483647;
  width: 440px;
  max-width: calc(100vw - 32px);
  background: var(--glass-bg);
  backdrop-filter: blur(18px) saturate(180%);
  -webkit-backdrop-filter: blur(18px) saturate(180%);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  box-shadow: var(--shadow-modal);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: modalZoomIn 140ms cubic-bezier(0.16, 1, 0.3, 1);
}

.translator-modal.custom-position {
  transform: none;
  animation: none;
}

.translator-modal.dragging {
  transition: none !important;
  user-select: none;
}

@keyframes modalZoomIn {
  from {
    opacity: 0;
    transform: translate(-50%, -48%) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

.modal-top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: var(--glass-header-bg);
  border-bottom: 1px solid var(--border-color);
  cursor: grab;
  user-select: none;
  gap: 8px;
}

.translator-modal.dragging .modal-top-bar {
  cursor: grabbing;
}

.brand-group {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  flex: 1;
  pointer-events: none;
}

.brand-group svg {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.brand-title {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.top-actions {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
}

.quick-provider-select {
  height: 28px;
  max-width: 122px;
  padding: 0 7px;
  font-family: inherit;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text-primary);
  background: var(--surface-bg);
  border: 1px solid var(--border-color);
  border-radius: 7px;
  cursor: pointer;
  outline: none;
  flex-shrink: 0;
}

.quick-provider-select:hover,
.quick-provider-select:focus {
  border-color: var(--accent);
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 7px;
  border: 1px solid var(--border-color);
  background: var(--surface-bg);
  color: var(--text-primary);
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  transition: border-color 120ms ease, background-color 120ms ease, color 120ms ease;
}

.icon-btn:hover,
.icon-btn.active {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-soft);
}

.glass-control-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 14px;
  background: var(--glass-header-bg);
  border-bottom: 1px solid var(--border-color);
  font-size: 12px;
  color: var(--text-secondary);
}

.opacity-slider {
  flex: 1;
  accent-color: var(--accent);
  cursor: pointer;
}

.lang-controls-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-color);
}

.source-lang-badge {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  background: var(--surface-bg);
  border: 1px solid var(--border-color);
  padding: 5px 10px;
  border-radius: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 150px;
}

.switch-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--surface-bg);
  color: var(--accent);
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
}

.switch-btn:hover {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.target-lang-select {
  flex: 1;
  min-width: 0;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-primary);
  background: var(--surface-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 5px 8px;
  cursor: pointer;
  outline: none;
}

.modal-body {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 75vh;
  overflow-y: auto;
}

.section-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
}

.input-section {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.source-input {
  width: 100%;
  min-height: 84px;
  max-height: 170px;
  resize: vertical;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 10px 12px;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-primary);
  background: var(--surface-bg);
  outline: none;
}

.source-input:focus {
  border-color: var(--accent);
}

.input-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 11.5px;
  color: var(--text-muted);
  margin-top: 2px;
}

.input-meta-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.char-counter.limit-exceeded {
  color: #EF4444;
  font-weight: 700;
}

.translate-submit-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 11px;
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  color: #FFFFFF;
  background: var(--accent);
  border: 1px solid var(--accent);
  border-radius: 7px;
  cursor: pointer;
  transition: background-color 140ms ease, opacity 140ms ease;
}

.translate-submit-btn:hover {
  background: var(--accent-hover);
}

.translate-submit-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.offline-progress-container {
  background: var(--surface-bg);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 9px 11px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.offline-progress-header {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

.offline-progress-track {
  width: 100%;
  height: 7px;
  background: var(--result-bg);
  border-radius: 999px;
  overflow: hidden;
}

.offline-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #F59E0B, #3B82F6);
  border-radius: 999px;
  transition: width 180ms ease;
}

.result-section {
  background: var(--result-bg);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 10px 12px;
  min-height: 96px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.copy-header-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 9px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--surface-bg);
  color: var(--text-primary);
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 120ms ease;
}

.copy-header-btn:hover {
  border-color: var(--accent);
}

.copy-header-btn.copied {
  background: #16A34A;
  border-color: #16A34A;
  color: #FFFFFF;
}

.translated-output {
  font-size: 14.5px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 170px;
  overflow-y: auto;
}

.translated-output.placeholder {
  color: var(--text-muted);
  font-weight: 400;
  font-style: italic;
}

.detected-hint {
  font-size: 11.5px;
  color: var(--text-secondary);
}

.status-banner {
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 12.5px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--surface-bg);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
}

.status-actions-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.action-btn {
  padding: 6px 12px;
  border-radius: 7px;
  border: none;
  background: var(--accent);
  color: #FFFFFF;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.secondary-action-btn {
  padding: 6px 10px;
  border-radius: 7px;
  border: 1px solid var(--border-color);
  background: var(--result-bg);
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

/* Aba de Histórico no Modal */
.history-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-color);
}

.history-count-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-secondary);
}

.clear-history-btn {
  padding: 4px 9px;
  font-size: 11.5px;
  font-weight: 600;
  color: #EF4444;
  background: transparent;
  border: 1px solid rgba(239, 68, 68, 0.35);
  border-radius: 6px;
  cursor: pointer;
}

.clear-history-btn:hover {
  background: rgba(239, 68, 68, 0.12);
}

.clear-confirm-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.clear-confirm-label {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text-secondary);
}

.confirm-danger-btn {
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 700;
  color: #FFFFFF;
  background: #DC2626;
  border: 1px solid #DC2626;
  border-radius: 6px;
  cursor: pointer;
}

.confirm-cancel-btn {
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-primary);
  background: var(--surface-bg);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  cursor: pointer;
}

.history-list {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 9px;
  max-height: 360px;
  overflow-y: auto;
}

.history-empty {
  padding: 32px 14px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}

.history-card {
  background: var(--surface-bg);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.history-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.history-lang-pair {
  font-size: 11px;
  font-weight: 700;
  color: var(--accent);
}

.history-card-actions {
  display: flex;
  align-items: center;
  gap: 5px;
}

.history-item-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-primary);
  background: var(--result-bg);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  cursor: pointer;
}

.history-item-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.history-item-btn.copied {
  background: #16A34A;
  border-color: #16A34A;
  color: #FFFFFF;
}

.history-source-text {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
}

.history-translated-text {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-word;
}
`;

  globalScope.TranslatorExt = namespace;
})(typeof globalThis !== "undefined" ? globalThis : window);
