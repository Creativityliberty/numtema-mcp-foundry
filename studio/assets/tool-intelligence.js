const qualityState = { catalog: null, quality: null, loading: false };

const style = document.createElement('style');
style.textContent = `
.tool-intelligence-shell{margin:0 0 18px;padding:18px;border:1px solid rgba(22,48,39,.12);border-radius:20px;background:linear-gradient(145deg,rgba(241,247,243,.96),rgba(255,255,255,.98));box-shadow:0 12px 34px rgba(19,39,32,.06)}
.tool-intelligence-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:16px}.tool-intelligence-head h3{margin:0 0 4px;font-size:16px}.tool-intelligence-head p{margin:0;color:var(--muted,#6d7974);font-size:12px}.quality-badge{display:inline-flex;align-items:center;gap:7px;padding:7px 10px;border-radius:999px;background:#e6f3eb;color:#205c3d;font-size:11px;font-weight:700;white-space:nowrap}.quality-badge.failed{background:#fff0e8;color:#9b3c14}.tool-quality-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:14px}.tool-quality-metric{padding:12px;border-radius:14px;background:#fff;border:1px solid rgba(22,48,39,.08)}.tool-quality-metric span{display:block;color:var(--muted,#6d7974);font-size:10px;text-transform:uppercase;letter-spacing:.07em}.tool-quality-metric strong{display:block;margin-top:4px;font-size:19px}.tool-intelligence-list{display:grid;gap:10px}.tool-intelligence{padding:14px;border-radius:16px;background:rgba(255,255,255,.86);border:1px solid rgba(22,48,39,.08)}.tool-intelligence-top{display:flex;justify-content:space-between;gap:12px;align-items:center}.tool-intelligence-top strong{font-size:13px}.tool-intelligence-meta{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}.tool-intelligence-chip{padding:5px 8px;border-radius:999px;background:#edf2ef;color:#44544d;font-size:10px}.tool-intelligence-details{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px}.tool-intelligence-details div{padding:9px;border-radius:11px;background:#f7f9f8}.tool-intelligence-details span{display:block;font-size:9px;color:var(--muted,#6d7974);text-transform:uppercase;letter-spacing:.05em}.tool-intelligence-details strong{display:block;margin-top:3px;font-size:12px}.tool-intelligence-empty{padding:14px;border-radius:14px;background:#fff;color:var(--muted,#6d7974);font-size:12px}.tool-intelligence-refresh{border:0;background:transparent;color:#315d49;font:inherit;font-size:11px;font-weight:700;cursor:pointer}
@media(max-width:820px){.tool-quality-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.tool-intelligence-details{grid-template-columns:1fr}.tool-intelligence-head{flex-direction:column}}
`;
document.head.append(style);

function apiPayload(response) {
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json().then((value) => value?.data ?? value);
}

async function loadToolIntelligence(force = false) {
  if (qualityState.loading || (!force && qualityState.catalog && qualityState.quality)) return;
  qualityState.loading = true;
  try {
    const [catalog, quality] = await Promise.all([
      fetch('/api/artifact/tool_catalog', { cache: 'no-store' }).then(apiPayload),
      fetch('/api/artifact/tool_quality_report', { cache: 'no-store' }).then(apiPayload)
    ]);
    qualityState.catalog = catalog;
    qualityState.quality = quality;
  } catch {
    qualityState.catalog = null;
    qualityState.quality = null;
  } finally {
    qualityState.loading = false;
    renderToolIntelligence();
  }
}

function ensureShell() {
  const editor = document.getElementById('toolEditor');
  if (!editor) return null;
  let shell = document.getElementById('toolIntelligenceShell');
  if (!shell) {
    shell = document.createElement('section');
    shell.id = 'toolIntelligenceShell';
    shell.className = 'tool-intelligence-shell';
    editor.parentElement?.insertBefore(shell, editor);
  }
  return shell;
}

function renderToolIntelligence() {
  const shell = ensureShell();
  if (!shell) return;
  const report = qualityState.quality;
  const catalog = qualityState.catalog;
  if (!report || !catalog) {
    shell.innerHTML = `<div class="tool-intelligence-head"><div><h3>Intelligence des tools</h3><p>Compile le projet pour produire le catalogue et le score qualité.</p></div><button class="tool-intelligence-refresh" id="qualityRefresh">Actualiser</button></div><div class="tool-intelligence-empty">ToolCatalog indisponible. Lance « Compiler le MCP » puis actualise.</div>`;
    document.getElementById('qualityRefresh')?.addEventListener('click', () => loadToolIntelligence(true));
    return;
  }
  const tools = (catalog.domains || []).flatMap((domain) => (domain.tools || []).map((tool) => ({ ...tool, domain: domain.name })));
  const entries = new Map((report.entries || []).map((entry) => [entry.tool_name, entry]));
  const premium = (report.entries || []).filter((entry) => entry.status === 'premium').length;
  shell.innerHTML = `
    <div class="tool-intelligence-head"><div><h3>Intelligence des tools</h3><p>Descriptions, scopes, arguments gérés, exemples et erreurs normalisées.</p></div><span class="quality-badge ${report.gate?.passed ? '' : 'failed'}">${report.gate?.passed ? '✓ Qualité production' : '⚠ Build incomplet'}</span></div>
    <div class="tool-quality-metrics">
      <div class="tool-quality-metric"><span>Score qualité</span><strong>${escapeHtml(report.average_score)}</strong></div>
      <div class="tool-quality-metric"><span>Tools Premium</span><strong>${premium}/${escapeHtml(report.tool_count)}</strong></div>
      <div class="tool-quality-metric"><span>Seuil production</span><strong>${escapeHtml(report.gate?.threshold ?? 85)}</strong></div>
      <div class="tool-quality-metric"><span>Tools bloquants</span><strong>${escapeHtml(report.gate?.failing_tools?.length ?? 0)}</strong></div>
    </div>
    <div class="tool-intelligence-list">${tools.map((tool) => toolCard(tool, entries.get(tool.name))).join('')}</div>`;
}

function toolCard(tool, entry) {
  const intelligence = findIntelligence(tool.name);
  const managed = (intelligence?.arguments || []).filter((argument) => argument.classification !== 'model_argument');
  const examples = intelligence?.examples?.valid?.length ?? 0;
  const errors = intelligence?.errors?.length ?? 0;
  return `<article class="tool-intelligence">
    <div class="tool-intelligence-top"><strong>${escapeHtml(tool.title || tool.name)}</strong><span class="quality-badge ${entry?.score >= 85 ? '' : 'failed'}">${escapeHtml(entry?.score ?? tool.score ?? 0)}/100 · ${escapeHtml(entry?.status ?? tool.status ?? 'incomplete')}</span></div>
    <div class="tool-intelligence-meta"><span class="tool-intelligence-chip">${escapeHtml(tool.domain)}</span><span class="tool-intelligence-chip">${escapeHtml(tool.risk_class)}</span>${(tool.scopes || []).map((scope) => `<span class="tool-intelligence-chip">${escapeHtml(scope)}</span>`).join('')}</div>
    <div class="tool-intelligence-details"><div><span>Arguments gérés</span><strong>${managed.length}</strong></div><div><span>Exemples valides</span><strong>${examples}</strong></div><div><span>Erreurs normalisées</span><strong>${errors}</strong></div></div>
  </article>`;
}

function findIntelligence(toolName) {
  const bundle = window.__foundryToolBundle;
  const tool = bundle?.tools?.find((candidate) => candidate.name === toolName);
  return tool?.extensions?.foundry?.tool_intelligence ?? null;
}

async function loadBundle() {
  try { window.__foundryToolBundle = await fetch('/api/artifact/contract_bundle', { cache: 'no-store' }).then(apiPayload); } catch { window.__foundryToolBundle = null; }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character]);
}

async function refreshIntelligence(force = false) {
  await Promise.all([loadBundle(), loadToolIntelligence(force)]);
  renderToolIntelligence();
}

document.querySelector('[data-view="tools"]')?.addEventListener('click', () => refreshIntelligence());
document.getElementById('buildButton')?.addEventListener('click', () => setTimeout(() => refreshIntelligence(true), 700));
document.getElementById('refreshButton')?.addEventListener('click', () => setTimeout(() => refreshIntelligence(true), 250));
new MutationObserver(() => { if (document.getElementById('view-tools')?.classList.contains('active')) renderToolIntelligence(); }).observe(document.getElementById('view-tools') ?? document.body, { attributes: true, subtree: true, childList: true });
refreshIntelligence();
