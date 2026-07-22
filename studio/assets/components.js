export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
}

export function metric(label, value, detail, tone = 'sage') {
  return `<article class="metric"><div class="metric-top"><span>${escapeHtml(label)}</span><i class="tone ${tone}"></i></div><strong>${escapeHtml(value)}</strong><small>${escapeHtml(detail)}</small></article>`;
}

export function riskBadge(risk) {
  return `<span class="risk-badge risk-${escapeHtml(risk)}">${escapeHtml(risk)}</span>`;
}

export function methodBadge(method) {
  return `<span class="method method-${String(method).toLowerCase()}">${escapeHtml(String(method).toUpperCase())}</span>`;
}

export function artifact(name, description, ready) {
  return `<div class="artifact-item ${ready ? 'ready' : ''}"><span>${ready ? '✓' : '○'}</span><div><strong>${escapeHtml(name)}</strong><small>${escapeHtml(description)}</small></div></div>`;
}
