import { artifact, escapeHtml, methodBadge, metric, riskBadge } from './components.js';

const csrf = document.querySelector('meta[name="foundry-csrf"]').content;
const state = { project: null, overrides: [], capabilityMap: null, inspection: null, deployment: null };
const titles = { dashboard: 'Vue d’ensemble', source: 'Source OpenAPI', inspection: 'Inspection', tools: 'Tools & risques', auth: 'OAuth & provider', widget: 'Widget approval', simulator: 'Simulateur', deployment: 'Build & déploiement' };

for (const button of document.querySelectorAll('[data-view]')) button.addEventListener('click', () => showView(button.dataset.view));
for (const button of document.querySelectorAll('[data-go]')) button.addEventListener('click', () => showView(button.dataset.go));
document.getElementById('refreshButton').addEventListener('click', loadProject);
document.getElementById('buildButton').addEventListener('click', buildPipeline);
document.getElementById('rebuildInspection').addEventListener('click', buildPipeline);
document.getElementById('importSourceButton').addEventListener('click', importSource);
document.getElementById('saveToolsButton').addEventListener('click', saveToolOverrides);
document.getElementById('saveConfigButton').addEventListener('click', saveConfiguration);
document.getElementById('simulateButton').addEventListener('click', simulate);
document.getElementById('deploymentBuildButton').addEventListener('click', buildDeployment);
document.getElementById('toolSearch').addEventListener('input', renderTools);
document.getElementById('riskFilter').addEventListener('change', renderTools);
document.getElementById('widgetToolSelect').addEventListener('change', renderWidgetPreview);
document.getElementById('sourceFile').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  document.getElementById('sourceFilename').value = file.name;
  document.getElementById('sourceText').value = await file.text();
});

loadProject().catch(showError);

async function api(path, options = {}) {
  const headers = { 'content-type': 'application/json', ...(options.method && options.method !== 'GET' ? { 'x-foundry-csrf': csrf } : {}) };
  const response = await fetch(path, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  const payload = await response.json();
  if (!payload.ok) throw new Error(payload.issues?.[0]?.message || 'Studio request failed.');
  return payload.data;
}

async function loadProject() {
  setSaveState('Synchronisation…');
  const data = await api('/api/project');
  state.project = data.project;
  state.overrides = data.overrides || [];
  state.capabilityMap = data.capability_map;
  document.getElementById('projectName').textContent = state.project.name;
  fillConfiguration();
  await loadArtifacts();
  renderAll();
  setSaveState('Projet synchronisé');
}

async function loadArtifacts() {
  if (!state.project.last_build) return;
  try { state.inspection = await api('/api/artifact/inspection'); } catch { state.inspection = null; }
  if (!state.capabilityMap) try { state.capabilityMap = await api('/api/artifact/capability_map'); } catch { state.capabilityMap = null; }
}

async function importSource() {
  const content = document.getElementById('sourceText').value;
  const filename = document.getElementById('sourceFilename').value || 'openapi.json';
  if (!content.trim()) return toast('Ajoute un fichier ou colle le contenu OpenAPI.', true);
  setSaveState('Import en cours…');
  await api('/api/source/import', { method: 'POST', body: JSON.stringify({ filename, content }) });
  await buildPipeline();
  showView('inspection');
  toast('Source importée et inspectée.');
}

async function buildPipeline() {
  setSaveState('Compilation…');
  const report = await api('/api/pipeline/build', { method: 'POST', body: '{}' });
  state.project = report.project;
  state.inspection = await api('/api/artifact/inspection');
  state.capabilityMap = await api('/api/artifact/capability_map');
  renderAll();
  setSaveState(`${report.tool_count} tools compilés`);
  toast(`Build terminé : ${report.tool_count} tools, ${report.adapter_count} adapters.`);
}

async function saveToolOverrides() {
  const rows = [...document.querySelectorAll('.tool-row')];
  const overrides = rows.map((row) => {
    const source = row.dataset.operation;
    const original = state.capabilityMap.capabilities.find((item) => item.source_operation_id === source);
    return {
      source_operation_id: source,
      enabled: row.querySelector('[data-field="enabled"]').checked,
      name: row.querySelector('[data-field="name"]').value,
      description: row.querySelector('[data-field="description"]').value,
      risk_class: row.querySelector('[data-field="risk"]').value,
      approval_mode: row.querySelector('[data-field="approval"]').value,
      required_scopes: row.querySelector('[data-field="scopes"]').value.split(',').map((value) => value.trim()).filter(Boolean),
      _original: original?.name
    };
  }).map(({ _original, ...override }) => override);
  await api('/api/overrides', { method: 'POST', body: JSON.stringify({ overrides }) });
  state.overrides = overrides;
  await buildPipeline();
  toast('Overrides enregistrés et recompilés.');
}

async function saveConfiguration() {
  const provider = {
    base_url: document.getElementById('providerBaseUrl').value,
    provider_ref: document.getElementById('providerRef').value,
    provider_account_ref: document.getElementById('providerAccountRef').value,
    auth_mode: document.getElementById('providerAuthMode').value,
    credential_environment: document.getElementById('credentialEnvironment').value
  };
  const chatgpt_app = {
    public_base_url: document.getElementById('publicBaseUrl').value,
    allowed_origins: document.getElementById('allowedOrigins').value.split('\n').map((value) => value.trim()).filter(Boolean)
  };
  const data = await api('/api/project/configure', { method: 'POST', body: JSON.stringify({ provider, chatgpt_app }) });
  state.project = data.project;
  toast('Configuration enregistrée.');
}

async function simulate() {
  const tool_name = document.getElementById('simulateTool').value;
  let args;
  try { args = JSON.parse(document.getElementById('simulateArgs').value || '{}'); } catch { return toast('Arguments JSON invalides.', true); }
  const chat = document.getElementById('chatLog');
  chat.insertAdjacentHTML('beforeend', `<div class="message user">Appeler <strong>${escapeHtml(tool_name)}</strong><pre>${escapeHtml(JSON.stringify(args, null, 2))}</pre></div>`);
  try {
    const result = await api('/api/simulate', { method: 'POST', body: JSON.stringify({ tool_name, arguments: args }) });
    chat.insertAdjacentHTML('beforeend', `<div class="message assistant">Plan créé. Aucun réseau n’a été exécuté et aucun secret n’est inclus.</div>`);
    document.getElementById('simulationTrace').innerHTML = result.stages.map((stage, index) => `<div class="trace-step"><span>${index + 1}</span><div><strong>${escapeHtml(stage.replaceAll('_', ' '))}</strong><small>${index < 2 ? 'validé' : 'gardé par le runtime'}</small></div></div>`).join('');
    document.getElementById('simulationPlan').textContent = JSON.stringify(result.plan, null, 2);
  } catch (error) { chat.insertAdjacentHTML('beforeend', `<div class="message error">${escapeHtml(error.message)}</div>`); }
  chat.scrollTop = chat.scrollHeight;
}

async function buildDeployment() {
  setSaveState('Packaging…');
  const data = await api('/api/deployment/build', { method: 'POST', body: '{}' });
  state.deployment = data;
  const manifest = data.manifest;
  document.getElementById('deploymentStatus').textContent = `${manifest.files.length} fichiers · aucune clé privée`;
  document.getElementById('deploymentEndpoints').innerHTML = Object.entries(manifest.endpoints).map(([name, value]) => `<div><span>${escapeHtml(name)}</span><code>${escapeHtml(value)}</code></div>`).join('');
  document.getElementById('deploymentOutput').textContent = `$ package: ${data.directory}\n$ files: ${manifest.files.length}\n$ source sha256: ${manifest.source_digest}\n$ private keys included: false\n$ status: READY_FOR_COOLIFY`;
  setSaveState('Package prêt');
  toast('Package Coolify/VPS généré.');
}

function renderAll() {
  renderDashboard(); renderSource(); renderInspection(); renderTools(); renderSelectors(); renderWidgetPreview();
}

function renderDashboard() {
  const last = state.project.last_build;
  const risk = last?.risk_counts || {};
  document.getElementById('metrics').innerHTML = [
    metric('Endpoints', state.inspection?.summary?.operation_count ?? '—', 'détectés dans la source'),
    metric('Tools actifs', last?.enabled_tool_count ?? '—', last ? `${last.tool_count} proposés` : 'build requis', 'navy'),
    metric('Approbations', state.capabilityMap?.summary?.approval_required_count ?? '—', 'actions gouvernées', 'amber'),
    metric('Déploiement', state.deployment ? 'Prêt' : 'Local', state.deployment ? 'package généré' : 'non publié', 'sage')
  ].join('');
  const steps = [
    ['Source', Boolean(state.project.source.imported_at)], ['Inspection', Boolean(state.inspection)], ['Capabilities', Boolean(state.capabilityMap)],
    ['Contrats', Boolean(last)], ['OAuth', true], ['Package', Boolean(state.deployment)]
  ];
  document.getElementById('pipelineSteps').innerHTML = steps.map(([label, ready], index) => `<div class="pipeline-step ${ready ? 'ready' : ''}"><span>${ready ? '✓' : index + 1}</span><strong>${label}</strong><small>${ready ? 'validé' : 'en attente'}</small></div>`).join('');
  document.getElementById('riskBars').innerHTML = ['R0','R1','R2','R3','R4','R5'].map((name) => { const value = risk[name] || 0; const max = Math.max(1, ...Object.values(risk)); return `<div class="risk-line"><span>${name}</span><div><i style="width:${Math.max(5, value / max * 100)}%"></i></div><strong>${value}</strong></div>`; }).join('');
  document.getElementById('artifactStrip').innerHTML = [
    artifact('SourceInspection', 'routes & risques', Boolean(state.inspection)), artifact('CapabilityMap', 'tools métier', Boolean(state.capabilityMap)),
    artifact('ContractBundle', 'policies & approvals', Boolean(last)), artifact('ProviderAdapters', 'plans HTTP', Boolean(last)), artifact('DeployPackage', 'Coolify / VPS', Boolean(state.deployment))
  ].join('');
}

function renderSource() {
  document.getElementById('sourcePath').textContent = state.project.source.original_name || state.project.source.file;
  document.getElementById('sourceDetails').innerHTML = detailRows([
    ['Chemin', state.project.source.file], ['Importé', state.project.source.imported_at ? new Date(state.project.source.imported_at).toLocaleString() : 'Non'],
    ['Provider', state.project.provider.provider_ref], ['Base URL', state.project.provider.base_url]
  ]);
}

function renderInspection() {
  const inspection = state.inspection;
  document.getElementById('inspectionMetrics').innerHTML = inspection ? [
    metric('Opérations', inspection.summary.operation_count, 'routes inspectées'), metric('Domaines', inspection.summary.domains.length, inspection.summary.domains.join(', '), 'navy'),
    metric('Authentifiées', inspection.summary.authenticated_operation_count, 'avec scopes ou auth', 'amber'), metric('Asynchrones', inspection.summary.asynchronous_operation_count, 'jobs potentiels')
  ].join('') : metric('Inspection', '—', 'Lance un build');
  document.getElementById('operationsTable').innerHTML = (inspection?.operations || []).map((operation) => `<tr><td><strong>${escapeHtml(operation.summary)}</strong><small>${escapeHtml(operation.operation_id)}</small></td><td>${methodBadge(operation.method)}</td><td><code>${escapeHtml(operation.path)}</code></td><td>${escapeHtml(operation.domain)}</td><td>${operation.evidence.slice(0,2).map((item) => `<span class="signal">${escapeHtml(item.code)}</span>`).join('')}</td></tr>`).join('');
}

function renderTools() {
  const map = state.capabilityMap;
  if (!map) { document.getElementById('toolEditor').innerHTML = '<div class="empty-state">Compile le projet pour éditer les tools.</div>'; return; }
  const search = document.getElementById('toolSearch').value.toLowerCase();
  const risk = document.getElementById('riskFilter').value;
  const overrideByOp = new Map(state.overrides.map((item) => [item.source_operation_id, item]));
  document.getElementById('toolEditor').innerHTML = map.capabilities.filter((tool) => (!search || `${tool.name} ${tool.description}`.toLowerCase().includes(search)) && (!risk || tool.risk_class === risk)).map((tool) => {
    const override = overrideByOp.get(tool.source_operation_id) || {};
    return `<article class="tool-row" data-operation="${escapeHtml(tool.source_operation_id)}"><div class="tool-main"><label class="toggle"><input type="checkbox" data-field="enabled" ${override.enabled === false ? '' : 'checked'}><span></span></label><div><div class="tool-title">${methodBadge(tool.method)}<input data-field="name" value="${escapeHtml(override.name || tool.name)}"></div><textarea data-field="description">${escapeHtml(override.description || tool.description)}</textarea><div class="tool-meta"><code>${escapeHtml(tool.path)}</code><span>${escapeHtml(tool.domain)}</span></div></div></div><div class="tool-controls"><label>Risque<select data-field="risk">${['R0','R1','R2','R3','R4','R5'].map((value) => `<option ${value === (override.risk_class || tool.risk_class) ? 'selected' : ''}>${value}</option>`).join('')}</select></label><label>Approbation<select data-field="approval">${['none','chat_explicit','secure_widget','approver','dual_control'].map((value) => `<option ${value === (override.approval_mode || tool.governance.approval_mode) ? 'selected' : ''}>${value}</option>`).join('')}</select></label><label>Scopes<input data-field="scopes" value="${escapeHtml((override.required_scopes || tool.required_scopes).join(', '))}"></label></div></article>`;
  }).join('');
}

function renderSelectors() {
  const tools = state.capabilityMap?.capabilities || [];
  for (const id of ['simulateTool','widgetToolSelect']) {
    const element = document.getElementById(id);
    const selected = element.value;
    element.innerHTML = tools.map((tool) => `<option value="${escapeHtml(tool.name)}">${escapeHtml(tool.name)} · ${tool.risk_class}</option>`).join('');
    if ([...element.options].some((option) => option.value === selected)) element.value = selected;
  }
}

function renderWidgetPreview() {
  const name = document.getElementById('widgetToolSelect').value;
  const tool = state.capabilityMap?.capabilities.find((item) => item.name === name) || state.capabilityMap?.capabilities[0];
  if (!tool) return;
  document.getElementById('widgetDetails').innerHTML = detailRows([['Tool', tool.name], ['Risque', tool.risk_class], ['Approbation', tool.governance.approval_mode], ['Scopes', tool.required_scopes.join(', ') || 'Aucun']]);
  const frame = document.getElementById('widgetFrame');
  frame.srcdoc = `<!doctype html><html><style>body{font-family:system-ui;margin:0;background:#f7f9f8;color:#10231f}.card{margin:28px;padding:24px;border-radius:24px;background:white;border:1px solid #dfe8e4;box-shadow:0 18px 50px #10231f12}.icon{width:44px;height:44px;border-radius:14px;background:#dceae4;display:grid;place-items:center;font-size:22px}h2{font-size:20px;margin:18px 0 6px}p{color:#61726d;line-height:1.5}.summary{background:#f2f6f4;padding:14px;border-radius:14px;margin:18px 0}.summary b{display:block;margin-bottom:5px}.actions{display:flex;gap:10px}button{border:0;padding:11px 16px;border-radius:12px;font-weight:700}.approve{background:#1e725c;color:white}.deny{background:#edf2f0;color:#334a43}</style><body><div class="card"><div class="icon">✓</div><h2>Confirmer ${escapeHtml(tool.title)}</h2><p>Cette action nécessite une approbation explicite avant toute exécution fournisseur.</p><div class="summary"><b>${escapeHtml(tool.name)}</b><span>Risque ${escapeHtml(tool.risk_class)} · arguments liés par hash</span></div><div class="actions"><button class="deny">Refuser</button><button class="approve">Approuver</button></div></div></body></html>`;
}

function fillConfiguration() {
  const p = state.project;
  document.getElementById('providerBaseUrl').value = p.provider.base_url;
  document.getElementById('providerRef').value = p.provider.provider_ref;
  document.getElementById('providerAccountRef').value = p.provider.provider_account_ref;
  document.getElementById('providerAuthMode').value = p.provider.auth_mode;
  document.getElementById('credentialEnvironment').value = p.provider.credential_environment;
  document.getElementById('publicBaseUrl').value = p.chatgpt_app.public_base_url;
  document.getElementById('allowedOrigins').value = p.chatgpt_app.allowed_origins.join('\n');
}

function showView(name) {
  document.querySelectorAll('.view').forEach((view) => view.classList.toggle('active', view.id === `view-${name}`));
  document.querySelectorAll('.nav-item').forEach((button) => button.classList.toggle('active', button.dataset.view === name));
  document.getElementById('viewTitle').textContent = titles[name] || name;
}

function detailRows(rows) { return rows.map(([name, value]) => `<div><dt>${escapeHtml(name)}</dt><dd>${escapeHtml(value)}</dd></div>`).join(''); }
function setSaveState(value) { document.getElementById('saveState').textContent = value; }
function toast(message, error = false) { const element = document.getElementById('toast'); element.textContent = message; element.className = `toast show ${error ? 'error' : ''}`; clearTimeout(window.__toast); window.__toast = setTimeout(() => element.className = 'toast', 2800); }
function showError(error) { console.error(error); toast(error.message || String(error), true); setSaveState('Erreur'); }
