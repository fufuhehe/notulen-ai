// node setup/build-workflows.js  -> menghasilkan 2 file JSON workflow n8n
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const uid = () => crypto.randomUUID();
const src = (f) => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');

const CRED = {
  kunci: { httpHeaderAuth: { id: '', name: 'Kunci Notulen' } },
  supa: { supabaseApi: { id: '', name: 'Supabase Notulen' } },
  aai: { assemblyAiApi: { id: '', name: 'AssemblyAI account' } },
  openai: { openAiApi: { id: '', name: 'OpenAI account' } },
};
const WH = "$('Webhook').first().json.body";
const rapatUrl = `={{ ${WH}.supa_url }}/rest/v1/rapat?id=eq.{{ ${WH}.rapat_id }}`;

const webhook = (p) => ({
  parameters: { httpMethod: 'POST', path: p, authentication: 'headerAuth', responseMode: 'onReceived', options: {} },
  id: uid(), name: 'Webhook', type: 'n8n-nodes-base.webhook', typeVersion: 2,
  position: [0, 0], webhookId: uid(), credentials: CRED.kunci,
});
const supa = (name, pos, { method = 'PATCH', url = rapatUrl, body, representation = false, onError }) => {
  const n = {
    parameters: {
      method, url,
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'supabaseApi',
      sendHeaders: true,
      headerParameters: { parameters: [{ name: 'Prefer', value: representation ? 'return=representation' : 'return=minimal' }] },
      sendBody: true, specifyBody: 'json', jsonBody: body,
      options: {},
    },
    id: uid(), name, type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: pos,
    credentials: CRED.supa,
  };
  if (onError) n.onError = onError;
  return n;
};
const code = (name, file, pos) => ({
  parameters: { jsCode: src(file) }, id: uid(), name, type: 'n8n-nodes-base.code', typeVersion: 2, position: pos,
});
const ifNode = (name, pos, conds, combinator = 'and') => ({
  parameters: {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
      conditions: conds.map(c => Object.assign({ id: uid() }, c)),
      combinator,
    },
    options: {},
  },
  id: uid(), name, type: 'n8n-nodes-base.if', typeVersion: 2, position: pos,
});
const strEq = (left, right) => ({ leftValue: left, rightValue: right, operator: { type: 'string', operation: 'equals' } });
const L = (node, index = 0) => ({ node, type: 'main', index });
const errExpr = `{{ JSON.stringify({ status: 'gagal', error: String(typeof $json.error === 'object' && $json.error ? ($json.error.message || JSON.stringify($json.error)) : ($json.error || 'Waktu tunggu habis (lebih dari 2 jam)')).slice(0, 500) }) }}`;
const wf = (name, nodes, connections) => ({
  name, nodes, connections, active: false, pinData: {},
  settings: { executionOrder: 'v1', saveDataSuccessExecution: 'none' },
});

// ================= WORKFLOW 1: TRANSKRIP =================
const w1 = wf('Notulen - 1 Transkrip', [
  webhook('notulen-transkrip'),
  supa('Tandai ditranskrip', [220, 0], {
    url: rapatUrl + '&select=id,audio_path,stt_detik',
    body: `={{ JSON.stringify({ status: 'ditranskrip', error: null }) }}`,
    representation: true,
  }),
  supa('Bikin link audio', [440, 0], {
    method: 'POST',
    url: `={{ ${WH}.supa_url }}/storage/v1/object/sign/audio/{{ $json.audio_path }}`,
    body: '={{ JSON.stringify({ expiresIn: 86400 }) }}',
    onError: 'continueErrorOutput',
  }),
  {
    parameters: {
      resource: 'transcript', operation: 'create',
      audioUrl: `={{ ${WH}.supa_url }}/storage/v1{{ $json.signedURL }}`,
      additionalFields: {
        speaker_labels: true,
        language_code: "={{ 'id' }}",
        speech_models: 'universal-3-5-pro,universal-2',
      },
    },
    id: uid(), name: 'Kirim ke AssemblyAI', type: 'n8n-nodes-assemblyai.assemblyAi', typeVersion: 1,
    position: [660, 0], credentials: CRED.aai, onError: 'continueErrorOutput',
  },
  {
    parameters: { amount: 30, unit: 'seconds' },
    id: uid(), name: 'Tunggu 30 detik', type: 'n8n-nodes-base.wait', typeVersion: 1.1,
    position: [880, 0], webhookId: uid(),
  },
  {
    parameters: {
      resource: 'transcript', operation: 'get',
      transcriptId: "={{ $('Kirim ke AssemblyAI').first().json.id }}",
    },
    id: uid(), name: 'Cek hasil', type: 'n8n-nodes-assemblyai.assemblyAi', typeVersion: 1,
    position: [1100, 0], credentials: CRED.aai, retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
  },
  ifNode('Sudah jadi?', [1320, 0], [strEq('={{ $json.status }}', 'completed')]),
  ifNode('Error / kelamaan?', [1540, 160], [
    strEq('={{ $json.status }}', 'error'),
    { leftValue: '={{ $runIndex }}', rightValue: 240, operator: { type: 'number', operation: 'gt' } },
  ], 'or'),
  code('Ringkas transkrip', 'ringkas-transkrip.js', [1540, -120]),
  supa('Simpan transkrip', [1760, -120], { body: '={{ JSON.stringify($json) }}' }),
  supa('Tandai gagal', [1760, 300], { body: '=' + errExpr }),
], {
  Webhook: { main: [[L('Tandai ditranskrip')]] },
  'Tandai ditranskrip': { main: [[L('Bikin link audio')]] },
  'Bikin link audio': { main: [[L('Kirim ke AssemblyAI')], [L('Tandai gagal')]] },
  'Kirim ke AssemblyAI': { main: [[L('Tunggu 30 detik')], [L('Tandai gagal')]] },
  'Tunggu 30 detik': { main: [[L('Cek hasil')]] },
  'Cek hasil': { main: [[L('Sudah jadi?')]] },
  'Sudah jadi?': { main: [[L('Ringkas transkrip')], [L('Error / kelamaan?')]] },
  'Error / kelamaan?': { main: [[L('Tandai gagal')], [L('Tunggu 30 detik')]] },
  'Ringkas transkrip': { main: [[L('Simpan transkrip')]] },
});


// ---- node AI generik (OpenAI-compatible: Sumopod / OpenAI) ----
const AI_URL = 'https://ai.sumopod.com/v1/chat/completions';   // ganti ke https://api.openai.com/v1/chat/completions kalau pakai OpenAI langsung
const pilihModel = (key) => `(() => { const m = $('Webhook').first().json.body.${key} || 'otomatis'; return m === 'otomatis' ? (String($json.prompt || '').length > 60000 ? 'gpt-4.1-mini' : 'gpt-4.1') : m; })()`;
const promptSistem = (teks, pos) => ({
  parameters: {
    mode: 'manual',
    assignments: { assignments: [{ id: uid(), name: 'sistem', value: teks, type: 'string' }] },
    includeOtherFields: true, options: {},
  },
  id: uid(), name: 'Prompt sistem', type: 'n8n-nodes-base.set', typeVersion: 3.4, position: pos,
});
const nodeAI = (key, maxTokens, pos) => ({
  parameters: {
    method: 'POST', url: AI_URL,
    authentication: 'predefinedCredentialType', nodeCredentialType: 'openAiApi',
    sendBody: true, specifyBody: 'json',
    jsonBody: `={{ JSON.stringify({ model: ${pilihModel(key)}, temperature: 0.2, max_tokens: ${maxTokens}, messages: [ { role: 'system', content: $json.sistem }, { role: 'user', content: $json.prompt || '(kosong)' } ] }) }}`,
    options: { timeout: 600000, response: { response: { neverError: true } } },
  },
  id: uid(), name: 'Minta AI', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: pos,
  credentials: CRED.openai, retryOnFail: true, maxTries: 2, waitBetweenTries: 5000,
});

// ================= WORKFLOW 2: RESUME =================
const SISTEM = fs.readFileSync(path.join(__dirname, 'prompt-resume.txt'), 'utf8').trim();

const w2 = wf('Notulen - 2 Resume', [
  webhook('notulen-resume'),
  supa('Tandai meresume', [220, 0], {
    url: rapatUrl + '&select=judul,created_at,durasi_detik,transkrip,nama_speaker,ai_token_in,ai_token_out',
    body: `={{ JSON.stringify({ status: 'meresume', error: null }) }}`,
    representation: true,
  }),
  code('Susun prompt', 'susun-prompt.js', [440, 0]),
  promptSistem(SISTEM, [660, 0]),
  nodeAI('model_notulen', 8000, [880, 0]),
  ifNode('Ada jawaban?', [1100, 0], [{ leftValue: '={{ Array.isArray($json.choices) && $json.choices.length > 0 }}', rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } }]),
  supa('Simpan resume', [1320, -80], {
    body: `={{ (() => { const c = $json.choices[0], u = $json.usage || {}, lama = $('Tandai meresume').first().json; return JSON.stringify({ status: 'selesai', resume: String(c.message.content || '').trim(), error: c.finish_reason === 'length' ? 'Resume terpotong karena terlalu panjang' : null, ai_model: $json.model, ai_token_in: (lama.ai_token_in || 0) + (u.prompt_tokens || 0), ai_token_out: (lama.ai_token_out || 0) + (u.completion_tokens || 0) }); })() }}`,
  }),
  supa('Tandai gagal', [1320, 120], { body: `={{ JSON.stringify({ status: 'gagal', error: 'AI: ' + String(($json.error && ($json.error.message || (typeof $json.error === 'string' ? $json.error : JSON.stringify($json.error)))) || $json.message || $json.detail || JSON.stringify($json)).slice(0, 500) }) }}` }),
], {
  Webhook: { main: [[L('Tandai meresume')]] },
  'Tandai meresume': { main: [[L('Susun prompt')]] },
  'Susun prompt': { main: [[L('Prompt sistem')]] },
  'Prompt sistem': { main: [[L('Minta AI')]] },
  'Minta AI': { main: [[L('Ada jawaban?')]] },
  'Ada jawaban?': { main: [[L('Simpan resume')], [L('Tandai gagal')]] },
});

// ================= WORKFLOW 4: PAPARAN (deck + infografis) =================
const PROMPT_DECK = fs.readFileSync(path.join(__dirname, 'prompt-deck.txt'), 'utf8').trim();
const w4 = wf('Notulen - 4 Paparan', [
  webhook('notulen-deck'),
  supa('Tandai deck diproses', [220, 0], {
    url: rapatUrl + '&select=judul,created_at,durasi_detik,resume,transkrip,nama_speaker,deck,deck_sumber,ai_token_in,ai_token_out',
    body: `={{ JSON.stringify({ deck_status: 'proses', deck_error: null }) }}`,
    representation: true,
  }),
  code('Susun bahan', 'susun-bahan-deck.js', [440, 0]),
  promptSistem(PROMPT_DECK, [660, 0]),
  nodeAI('model_paparan', 4000, [880, 0]),
  code('Rakit deck', 'rakit-deck.js', [1100, 0]),
  supa('Simpan deck', [1320, 0], { body: '={{ JSON.stringify($json) }}' }),
], {
  Webhook: { main: [[L('Tandai deck diproses')]] },
  'Tandai deck diproses': { main: [[L('Susun bahan')]] },
  'Susun bahan': { main: [[L('Prompt sistem')]] },
  'Prompt sistem': { main: [[L('Minta AI')]] },
  'Minta AI': { main: [[L('Rakit deck')]] },
  'Rakit deck': { main: [[L('Simpan deck')]] },
});

const out = path.join(__dirname);
fs.writeFileSync(path.join(out, '2-n8n-transkrip.json'), JSON.stringify(w1, null, 2));
fs.writeFileSync(path.join(out, '3-n8n-resume.json'), JSON.stringify(w2, null, 2));
fs.writeFileSync(path.join(out, '7-n8n-paparan.json'), JSON.stringify(w4, null, 2));
console.log('ok');
