import type { ContractBundle, ToolContract } from '../../contracts/types.js';
import { generateToolExamples } from '../../tools/example-generator.js';
import { normalizeToolErrors } from '../../tools/error-normalizer.js';
import { buildApprovalPresentation } from '../../tools/approval-presentation.js';
import { scoreToolQuality } from '../../tools/quality-scorer.js';
import { buildQualityReport, buildToolCatalog } from '../../tools/catalog-builder.js';
import type { EnrichedToolBundle, ToolArgumentClassification, ToolIntelligence, ToolQualityEntry } from '../../tools/types.js';

export const WHATSAPP_TOOL_NAMES = [
  'whatsapp_message_send_text','whatsapp_message_send_template','whatsapp_message_send_media','whatsapp_message_send_interactive',
  'whatsapp_message_mark_read','whatsapp_media_upload','whatsapp_media_get','whatsapp_media_delete','whatsapp_template_list','whatsapp_business_profile_get'
] as const;
export type WhatsAppToolName = (typeof WHATSAPP_TOOL_NAMES)[number];

type Schema = Record<string, unknown>;
type RuntimeEnvironment = Record<string, string | undefined>;
type AdapterLike = { tool_name: string; request: { method: string; path_template: string; parameters: Array<Record<string, unknown>>; body: Record<string, unknown> | null } };
type AdapterBundleLike = { adapters: AdapterLike[]; [key: string]: unknown };
type Risk = 'R1'|'R2'|'R3';
interface Profile { title:string; description:string; scope:string; risk:Risk; schema:Schema; runtime:string[] }

const phone = { type:'string', pattern:'^[1-9][0-9]{6,14}$', description:'Recipient phone number in international digits-only format.' };
const profiles: Record<WhatsAppToolName, Profile> = {
  whatsapp_message_send_text: { title:'Send WhatsApp text', description:'Send one exact text message to an individual WhatsApp recipient. Use this tool when the user explicitly wants the message sent, not when they only want a draft. This communicates externally and requires approval of the exact recipient and text.', scope:'whatsapp:messages.send', risk:'R3', runtime:['graph_api_version','phone_number_id'], schema:obj({to:phone,message:{type:'string',minLength:1,maxLength:4096,description:'Exact text to send.'},preview_url:{type:'boolean',default:false}},['to','message']) },
  whatsapp_message_send_template: { title:'Send WhatsApp template', description:'Send an approved WhatsApp template in a selected language. Use this tool when an approved template is required. This communicates externally and requires approval of recipient, template, language, and parameters.', scope:'whatsapp:messages.send', risk:'R3', runtime:['graph_api_version','phone_number_id'], schema:obj({to:phone,template_name:{type:'string',minLength:1},language_code:{type:'string',minLength:2},components:{type:'array',items:{type:'object',additionalProperties:true}}},['to','template_name','language_code']) },
  whatsapp_message_send_media: { title:'Send WhatsApp media', description:'Send an image, video, audio, document, or sticker using a Meta media ID or public HTTPS URL. Use this tool only for explicit delivery. This communicates externally and requires approval.', scope:'whatsapp:messages.send', risk:'R3', runtime:['graph_api_version','phone_number_id'], schema:{...obj({to:phone,media_type:{type:'string',enum:['image','video','audio','document','sticker']},media_id:{type:'string'},link:{type:'string',format:'uri'},caption:{type:'string',maxLength:1024},filename:{type:'string',maxLength:240}},['to','media_type']),anyOf:[{required:['media_id']},{required:['link']}]} },
  whatsapp_message_send_interactive: { title:'Send interactive WhatsApp message', description:'Send buttons, lists, products, or a supported Flow entry point. Use this tool when the recipient and complete interactive payload are known. This communicates externally and requires approval.', scope:'whatsapp:messages.send', risk:'R3', runtime:['graph_api_version','phone_number_id'], schema:obj({to:phone,interactive:{type:'object',additionalProperties:true}},['to','interactive']) },
  whatsapp_message_mark_read: { title:'Mark WhatsApp message read', description:'Mark one incoming WhatsApp message as read. Use this tool when the message ID came from a verified webhook and the read state must be updated.', scope:'whatsapp:messages.write', risk:'R2', runtime:['graph_api_version','phone_number_id'], schema:obj({message_id:{type:'string',minLength:1}},['message_id']) },
  whatsapp_media_upload: { title:'Upload WhatsApp media', description:'Upload one authorized Foundry artifact to Meta for later delivery. Use this tool when a send operation needs a reusable Meta media ID. Raw bytes and local paths are never model arguments.', scope:'whatsapp:media.write', risk:'R2', runtime:['graph_api_version','phone_number_id'], schema:obj({artifact_id:{type:'string',minLength:1},mime_type:{type:'string',minLength:3},filename:{type:'string',maxLength:240}},['artifact_id','mime_type']) },
  whatsapp_media_get: { title:'Get WhatsApp media', description:'Retrieve metadata and a temporary URL for one WhatsApp media ID. Use this tool to inspect media referenced by a verified webhook or prior upload. It does not modify provider data.', scope:'whatsapp:media.read', risk:'R1', runtime:['graph_api_version'], schema:obj({media_id:{type:'string',minLength:1}},['media_id']) },
  whatsapp_media_delete: { title:'Delete WhatsApp media', description:'Delete one uploaded WhatsApp media object by Meta media ID. Use this tool only for an explicit permanent-removal request. This is destructive and requires approval.', scope:'whatsapp:media.delete', risk:'R3', runtime:['graph_api_version'], schema:obj({media_id:{type:'string',minLength:1}},['media_id']) },
  whatsapp_template_list: { title:'List WhatsApp templates', description:'List templates owned by the configured WhatsApp Business Account. Use this tool to discover approved templates before sending. It does not modify provider data.', scope:'whatsapp:templates.read', risk:'R1', runtime:['graph_api_version','waba_id'], schema:obj({status:{type:'string',enum:['APPROVED','PENDING','REJECTED','PAUSED','DISABLED']},name:{type:'string'},limit:{type:'integer',minimum:1,maximum:100,default:20}}) },
  whatsapp_business_profile_get: { title:'Get WhatsApp business profile', description:'Retrieve the public WhatsApp business profile for the configured phone number. Use this tool to inspect profile details without modifying the provider.', scope:'whatsapp:profile.read', risk:'R1', runtime:['graph_api_version','phone_number_id'], schema:obj({fields:{type:'array',items:{type:'string'},default:['about','address','description','email','profile_picture_url','websites','vertical']}}) }
};

export function applyWhatsAppProviderPack(input: EnrichedToolBundle): EnrichedToolBundle {
  const bundle = structuredClone(input.bundle);
  const entries: ToolQualityEntry[] = [];
  bundle.tools = bundle.tools.map((tool) => {
    if (!isName(tool.name)) return tool;
    const p = profiles[tool.name];
    const next = structuredClone(tool);
    next.title=p.title; next.description=p.description; next.required_scopes=[p.scope]; applyRisk(next,p.risk);
    const foundry=asObj(asObj(next.extensions).foundry); const existing=asObj(foundry.tool_intelligence);
    const classifications = classify(next,p.schema,p.runtime);
    const base: Omit<ToolIntelligence,'quality'> = { model_input_schema:p.schema, arguments:classifications, examples:generateToolExamples({...next,input_schema:p.schema}), errors:normalizeToolErrors(next), approval:buildApprovalPresentation(next), effective_scopes:[p.scope] };
    const quality=scoreToolQuality(next,base); entries.push(quality);
    next.extensions={...asObj(next.extensions),foundry:{...foundry,provider_pack:'whatsapp-cloud-api',risk_class:p.risk,runtime_argument_bindings:Object.fromEntries(p.runtime.map(n=>[n,envName(n)])),provider_argument_transform:next.name,tool_intelligence:{...existing,...base,quality}}};
    ensureApproval(next,bundle); return next;
  });
  const scopes=[...new Set(bundle.tools.flatMap(t=>t.required_scopes))].sort(); for(const auth of bundle.auth) auth.required_scopes=[...new Set([...auth.required_scopes,...scopes])].sort();
  return { bundle, quality_report:buildQualityReport(entries), catalog:buildToolCatalog(bundle) };
}

export function applyWhatsAppAdapterPack<T extends AdapterBundleLike>(input:T):T {
  const out=structuredClone(input);
  for(const a of out.adapters){ if(!isName(a.tool_name)) continue;
    if(a.tool_name.startsWith('whatsapp_message_')) a.request.path_template='/{graph_api_version}/{phone_number_id}/messages';
    else if(a.tool_name==='whatsapp_media_upload') a.request.path_template='/{graph_api_version}/{phone_number_id}/media';
    bind(a,'graph_api_version'); if(needsPhone(a.tool_name)) bind(a,'phone_number_id'); if(a.tool_name==='whatsapp_template_list') bind(a,'waba_id');
  } return out;
}

export function resolveWhatsAppRuntimeArguments(tool:ToolContract,args:Record<string,unknown>,environment:RuntimeEnvironment):Record<string,unknown>{
  if(!isName(tool.name)) return structuredClone(args); const r=runtime(tool,environment); const u=structuredClone(args);
  switch(tool.name){
    case 'whatsapp_message_send_text': return {...r,body:{messaging_product:'whatsapp',recipient_type:'individual',to:req(u,'to'),type:'text',text:{body:req(u,'message'),preview_url:u.preview_url===true}}};
    case 'whatsapp_message_send_template': return {...r,body:{messaging_product:'whatsapp',recipient_type:'individual',to:req(u,'to'),type:'template',template:{name:req(u,'template_name'),language:{code:req(u,'language_code')},...(Array.isArray(u.components)?{components:u.components}:{})}}};
    case 'whatsapp_message_send_media': { const t=req(u,'media_type'); const m:Record<string,unknown>={}; if(typeof u.media_id==='string'&&u.media_id)m.id=u.media_id; else if(typeof u.link==='string'&&u.link)m.link=u.link; else throw new Error('WHATSAPP_MEDIA_REFERENCE_REQUIRED: provide media_id or link.'); if(typeof u.caption==='string')m.caption=u.caption;if(typeof u.filename==='string')m.filename=u.filename;return {...r,body:{messaging_product:'whatsapp',recipient_type:'individual',to:req(u,'to'),type:t,[t]:m}}; }
    case 'whatsapp_message_send_interactive': return {...r,body:{messaging_product:'whatsapp',recipient_type:'individual',to:req(u,'to'),type:'interactive',interactive:rec(u,'interactive')}};
    case 'whatsapp_message_mark_read': return {...r,body:{messaging_product:'whatsapp',status:'read',message_id:req(u,'message_id')}};
    case 'whatsapp_media_upload': return {...r,body:{messaging_product:'whatsapp',file:{artifact_id:req(u,'artifact_id'),filename:typeof u.filename==='string'?u.filename:undefined},type:req(u,'mime_type')}};
    case 'whatsapp_media_get': case 'whatsapp_media_delete': return {...r,media_id:req(u,'media_id')};
    case 'whatsapp_template_list': return compact({...r,status:u.status,name:u.name,limit:u.limit});
    case 'whatsapp_business_profile_get': return compact({...r,fields:u.fields});
  }
}

function applyRisk(t:ToolContract,r:Risk){t.effects.writes=r!=='R1';t.effects.external_communication=r==='R3'&&t.name.startsWith('whatsapp_message_send_');t.annotations.read_only=r==='R1';t.annotations.destructive=t.name==='whatsapp_media_delete';t.annotations.open_world=true;}
function ensureApproval(t:ToolContract,b:ContractBundle){const r=asObj(asObj(t.extensions).foundry).risk_class;if(r!=='R3')return;const id=t.approval_ref??`approval:${t.name}`;t.approval_ref=id;if(!b.approvals.some(a=>a.id===id))b.approvals.push({id,version:'1.5.0',mode:'chat_explicit',binding:['subject','client','workspace','tool_id','tool_revision','arguments_hash','risk_summary','nonce'],ttl_seconds:300,single_use:true,display_fields:['target','content','media','destructive_effect']});}
function classify(t:ToolContract,s:Schema,r:string[]):ToolArgumentClassification[]{const required=new Set(Array.isArray(s.required)?s.required.filter((x):x is string=>typeof x==='string'):[]);const model=Object.keys(asObj(s.properties)).sort().map(name=>({name,classification:'model_argument' as const,reason:'Business input selected from the user request.',required:required.has(name)}));const runtime=r.map(name=>({name,classification:'runtime_managed' as const,reason:`Resolved from ${envName(name)} at the execution boundary.`,location:'path',required:true}));if('body'in asObj(t.input_schema.properties))model.push({name:'body',classification:'hidden_internal',reason:'Provider request body assembled by the WhatsApp runtime transformer.',required:true} as ToolArgumentClassification);return [...model,...runtime].sort((a,b)=>a.name.localeCompare(b.name));}
function runtime(t:ToolContract,e:RuntimeEnvironment){const b=asObj(asObj(t.extensions?.foundry).runtime_argument_bindings);const o:Record<string,string>={};for(const [a,v]of Object.entries(b)){if(typeof v!=='string')continue;const x=e[v];if(!x?.trim())throw new Error(`WHATSAPP_RUNTIME_CONFIGURATION_MISSING: ${v}.`);o[a]=x.trim();}return o;}
function bind(a:AdapterLike,n:string){if(!a.request.parameters.some(p=>p.argument_name===n))a.request.parameters.push({argument_name:n,source_name:n,location:'path',required:true,deprecated:false,style:'simple',explode:false});}
function envName(n:string){if(n==='graph_api_version')return'WHATSAPP_GRAPH_API_VERSION';if(n==='phone_number_id')return'WHATSAPP_PHONE_NUMBER_ID';if(n==='waba_id')return'WHATSAPP_BUSINESS_ACCOUNT_ID';throw new Error(`WHATSAPP_RUNTIME_BINDING_UNKNOWN: ${n}`);}
function needsPhone(n:string){return n.startsWith('whatsapp_message_')||n==='whatsapp_media_upload'||n==='whatsapp_business_profile_get';}
function isName(n:string):n is WhatsAppToolName{return(WHATSAPP_TOOL_NAMES as readonly string[]).includes(n);}
function req(v:Record<string,unknown>,k:string){const x=v[k];if(typeof x!=='string'||!x.trim())throw new Error(`WHATSAPP_ARGUMENT_REQUIRED: ${k}.`);return x;}
function rec(v:Record<string,unknown>,k:string){const x=v[k];if(!x||typeof x!=='object'||Array.isArray(x))throw new Error(`WHATSAPP_ARGUMENT_REQUIRED: ${k}.`);return x as Record<string,unknown>;}
function compact(v:Record<string,unknown>){return Object.fromEntries(Object.entries(v).filter(([,x])=>x!==undefined&&x!==null));}
function asObj(v:unknown):Record<string,unknown>{return v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};}
function obj(properties:Schema,required:string[]=[]):Schema{return{type:'object',properties,required,additionalProperties:false};}
