const SUPABASE_URL         = 'https://sbqasynhthoqtkiepzzv.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNicWFzeW5odGhvcXRraWVwenp2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTU3MTA5OCwiZXhwIjoyMDkxMTQ3MDk4fQ.G_A4QIlr0xR8Yt5zw_ImPCYQiKAbKF7rYuY-Kes6GKY';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNicWFzeW5odGhvcXRraWVwenp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NzEwOTgsImV4cCI6MjA5MTE0NzA5OH0.eQVyzkef44tQdLbXmLovgrEcDE7ZNmSaDWCvPtlsyPQ';

const USER_META = {
  'garita@vca.com':      { color: 'linear-gradient(135deg,#1549a0,#2d7ef0)' },
  'restaurante@vca.com': { color: 'linear-gradient(135deg,#0f6e56,#1d9e75)' },
  'root@vca.com':        { color: 'linear-gradient(135deg,#7a3a00,#e8a000)' }
};

let data = [], searchHist = [];
let currentUser  = null;
let currentEmail = null;
let currentRol   = null;
let authToken    = null;
let authUserId   = null;
const DATA_KEY   = 'cartera_vca_data_v3';
let deferredPrompt = null;

const searchCache = new Map();
const SEARCH_CACHE_MAX = 60;

const supabaseReady = SUPABASE_URL !== 'PEGA_TU_URL_AQUI';

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
}

async function fetchCurrentRole(email, userId) {
  try {
    let url = `${SUPABASE_URL}/rest/v1/profiles?select=user_id,display_name,is_admin`;
    if (userId) {
      url += `&user_id=eq.${encodeURIComponent(userId)}`;
    } else {
      return null;
    }
    const res = await fetch(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${authToken || SUPABASE_KEY}`,
        'Accept': 'application/json'
      }
    });
    if (!res.ok) return null;
    const rows = await res.json();
    if (!rows || !rows.length) return null;
    const row = rows[0];
    return {
      nombre: row.display_name || email,
      rol: row.is_admin ? 'admin' : 'usuario',
      is_admin: !!row.is_admin,
      user_id: row.user_id
    };
  } catch (e) {
    return null;
  }
}

function authHeaders() {
  return {
    'apikey': SUPABASE_KEY,
    'Authorization': authToken ? `Bearer ${authToken}` : `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
}

async function doLogin() {
  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
  const pass  = document.getElementById('loginPassword').value;
  const btn   = document.getElementById('loginBtn');
  const err   = document.getElementById('loginErr');

  if (!email || !pass) { err.classList.add('on'); return; }
  err.classList.remove('on');
  btn.textContent = 'Verificando…'; btn.disabled = true;

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass })
    });
    const json = await res.json();

    if (!res.ok || !json.access_token) {
      err.classList.add('on');
      btn.textContent = 'Iniciar sesión'; btn.disabled = false;
      document.getElementById('loginPassword').value = '';
      return;
    }

    authToken    = json.access_token;
    currentEmail = email;
    authUserId   = json.user?.id || null;

    const roleRow = await fetchCurrentRole(email, json.user?.id);
    currentUser = roleRow?.nombre || email;
    currentRol  = roleRow?.rol || 'usuario';

    try { sessionStorage.setItem('vca_token', authToken); sessionStorage.setItem('vca_email', email); } catch(e) {}

    activateUser();
  } catch(e) {
    err.classList.add('on');
    btn.textContent = 'Iniciar sesión'; btn.disabled = false;
  }
}

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && ['loginEmail','loginPassword'].includes(document.activeElement?.id)) doLogin();
});

async function tryRestoreSession() {
  try {
    const tok   = sessionStorage.getItem('vca_token');
    const email = sessionStorage.getItem('vca_email');
    if (!tok || !email) return false;
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${tok}` }
    });
    if (!res.ok) { sessionStorage.clear(); return false; }
    authToken    = tok;
    currentEmail = email;
    const userJson = await res.json();
    authUserId = userJson?.id || null;
    const roleRow  = await fetchCurrentRole(email, userJson?.id);
    currentUser = roleRow?.nombre || email;
    currentRol  = roleRow?.rol || 'usuario';
    return true;
  } catch(e) { return false; }
}

function activateUser() {
  const meta = USER_META[currentEmail?.toLowerCase()] || { color: 'linear-gradient(135deg,#555,#888)' };
  const chip     = document.getElementById('userChip');
  const avatar   = document.getElementById('userAvatar');
  const chipName = document.getElementById('userChipName');
  if (chip) {
    chip.style.display = 'flex';
    avatar.style.background = meta.color;
    avatar.textContent = (currentUser || '?')[0]?.toUpperCase() || '?';
    chipName.textContent = currentUser;
  }

  const dangerBtn = document.querySelector('.danger-btn');
  if (dangerBtn) dangerBtn.style.display = currentRol === 'admin' ? 'block' : 'none';

  const mainConfigBtn = document.getElementById('mainConfigBtn');
  if (mainConfigBtn) mainConfigBtn.style.display = currentRol === 'admin' ? 'flex' : 'none';

  const menuConfigBtn = document.getElementById('menuConfigBtn');
  if (menuConfigBtn) menuConfigBtn.style.display = currentRol === 'admin' ? 'flex' : 'none';

  document.getElementById('loginBtn').textContent = 'Iniciar sesión';
  document.getElementById('loginBtn').disabled = false;
  document.getElementById('loginPassword').value = '';
  showScreen('screenMain');
  loadData();
  if (!pollingInterval) startPolling();
}

async function loadData() {
  try {
    const s = localStorage.getItem(DATA_KEY);
    if (s) {
      data = JSON.parse(s);
      showStatus('ok', `${data.length} registros listos (verificando nube…)`);
      document.getElementById('searchBtn').disabled = false;
      setChip(data.length);
    }
  } catch(e) { localStorage.removeItem(DATA_KEY); }
  tryAutoLoadExcel();
}

async function logout() {
  try {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${authToken}` }
    });
  } catch(e) {}
  authToken = null; currentUser = null; currentEmail = null; currentRol = null;
  try { sessionStorage.clear(); } catch(e) {}
  if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null; }
  showScreen('screenLogin');
}

(async () => {
  const restored = await tryRestoreSession();
  if (restored) activateUser();
})();

function goToReport() {
  if (!currentUser) { showScreen('screenLogin'); return; }
  showScreen('screenReport');
  switchTab('consultas');
  loadReport();
}

function goToConfig() {
  if (!currentUser) { showScreen('screenLogin'); return; }
  if (currentRol !== 'admin') {
    alert('Acceso denegado: Solo administradores pueden entrar a configuración.');
    return;
  }
  showScreen('screenConfig');
  ['ctab-usuarios','ctab-nuevo','ctab-socios'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = '';
  });
  switchConfigTab('socios');
}

function goToReservations() {
  if (!currentUser) { showScreen('screenLogin'); return; }
  showScreen('screenReservations');
  switchResTab('nueva');
}

function selectTipo(btn) {
  document.querySelectorAll('.tipo-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const isDay = btn.dataset.tipo === 'Day Pass';
  const salGroup = document.getElementById('resFechaSalidaGroup');
  if (salGroup) salGroup.style.display = isDay ? 'none' : '';
}

function selectHotel(btn, name) {
  document.querySelectorAll('.hotel-card').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('resHotel').value = name;
}

function switchResTab(tab) {
  ['nueva','lista'].forEach(t => {
    const pane = document.getElementById('pane-res-'+t);
    const hbtn = document.getElementById('htab-'+t);
    if (pane) { pane.style.display = t === tab ? 'flex' : 'none'; }
    if (hbtn) hbtn.classList.toggle('active', t === tab);
  });
  if (tab === 'lista') loadReservations();
}

let selectedSocioForRes = null;

async function searchSocioForRes() {
  const raw = document.getElementById('resSearchSocio').value.trim();
  if (!raw) return;

  const info = document.getElementById('resSocioInfo');
  const form = document.getElementById('resFormContainer');
  info.style.display = 'block';
  form.style.display = 'none';
  selectedSocioForRes = null;
  info.innerHTML = '<div class="res-loading"><div class="res-spinner"></div><span>Buscando en base de datos…</span></div>';

  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${authToken || SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  let matches = [];
  try {
    const r1 = await fetch(`${SUPABASE_URL}/rest/v1/socios?codigo=eq.${encodeURIComponent(raw)}&select=*&limit=20`, { headers });
    if (r1.ok) matches = await r1.json();

    if (!matches.length && /^\d+$/.test(raw)) {
      const r2 = await fetch(`${SUPABASE_URL}/rest/v1/socios?codigo=like.*-${encodeURIComponent(raw)}&select=*&limit=20`, { headers });
      if (r2.ok) matches = await r2.json();
    }
    if (!matches.length) {
      const r3 = await fetch(`${SUPABASE_URL}/rest/v1/socios?codigo=ilike.*${encodeURIComponent(raw)}*&select=*&limit=20`, { headers });
      if (r3.ok) matches = await r3.json();
    }
    if (!matches.length) {
      const r4 = await fetch(`${SUPABASE_URL}/rest/v1/socios?nombre_completo=ilike.*${encodeURIComponent(raw)}*&select=*&limit=20`, { headers });
      if (r4.ok) matches = await r4.json();
    }
  } catch(e) {
    info.innerHTML = '<div class="res-error-box">❌ Error de conexión. Verifica tu internet e intenta de nuevo.</div>';
    return;
  }

  if (!matches.length) {
    info.innerHTML = `<div class="res-error-box">Sin resultados para <strong>"${esc(raw)}"</strong>.<br><span style="font-weight:400;">Verifica la referencia o nombre del socio.</span></div>`;
    return;
  }

  if (matches.length === 1) { showSocioCard(matches[0]); return; }

  window._resMatches = matches;
  info.innerHTML = `
    <div class="res-picker">
      <div class="res-picker-title">${matches.length} resultados — selecciona el socio</div>
      <div class="res-picker-list">
        ${matches.map((r,i) => `
          <button class="res-picker-item" onclick="selectSocioForRes(${i})">
            <div class="res-picker-avatar">${(r.nombre_completo||'?')[0].toUpperCase()}</div>
            <div class="res-picker-info">
              <div class="res-picker-name">${esc(r.nombre_completo||'—')}</div>
              <div class="res-picker-code">${esc(r.codigo||'—')}</div>
            </div>
            <div class="res-picker-arrow">›</div>
          </button>`).join('')}
      </div>
    </div>`;
}

function selectSocioForRes(idx) {
  showSocioCard(window._resMatches[idx]);
}

function showSocioCard(socio) {
  selectedSocioForRes = socio;
  const info = document.getElementById('resSocioInfo');
  const form = document.getElementById('resFormContainer');

  const nombre  = socio.nombre_completo || socio.socio || '—';
  const codigo  = socio.codigo || socio.referencia || '—';
  const depto   = socio.departamento || '—';
  const inicio  = socio.fecha_inicio  || socio.inicio || '';
  const vence   = socio.fecha_vencimiento || socio.vencimiento || '';
  const ultPago = socio.ultimo_pago   || '';
  const ultAnio = String(socio.ultimo_año_de_pago || socio.ultimo_anio_pago || socio['ultimo año de pago'] || '');
  const notas   = socio.notas || '';
  const estOp   = socio.estado_operativo  || '';
  const estFin  = socio.estado_financiero || '';
  const dpi     = socio.dpi || '';
  const tel     = socio.telefono || '';

  const notaTag = notas ? `<div class="socio-found-field wide"><div class="socio-found-label">Notas</div><div class="socio-found-value"><span class="note-tag">🏷 ${esc(notas)}</span></div></div>` : '';
  const statusRow = (estOp || estFin) ? `<div class="socio-status-row">${estOp?`<span class="socio-badge">${estOp.replace(/_/g,' ').toUpperCase()}</span>`:''} ${estFin?`<span class="socio-badge">${estFin.replace(/_/g,' ').toUpperCase()}</span>`:''}</div>` : '';

  info.style.display = 'block';
  info.innerHTML = `
    <div class="socio-found-card">
      <div class="socio-found-head">
        <div class="socio-found-avatar">${(nombre[0]||'?').toUpperCase()}</div>
        <div class="socio-found-text">
          <div class="socio-found-name">${esc(nombre)}</div>
          <div class="socio-found-code">${esc(codigo)}</div>
        </div>
        <div class="socio-found-check">✓</div>
      </div>
      <div class="socio-found-grid">
        <div class="socio-found-field wide">
          <div class="socio-found-label">Departamento</div>
          <div class="socio-found-value ${!depto||depto==='—'?'empty':''}">${esc(depto)}</div>
        </div>
        <div class="socio-found-field">
          <div class="socio-found-label">Inicio</div>
          <div class="socio-found-value ${!inicio?'empty':''}">${esc(inicio)||'—'}</div>
        </div>
        <div class="socio-found-field">
          <div class="socio-found-label">Vencimiento</div>
          <div class="socio-found-value ${!vence?'empty':''}">${esc(vence)||'—'}</div>
        </div>
        <div class="socio-found-field">
          <div class="socio-found-label">Último Pago</div>
          <div class="socio-found-value ${!ultPago?'empty':''}">${esc(ultPago)||'—'}</div>
        </div>
        <div class="socio-found-field">
          <div class="socio-found-label">Último Año</div>
          <div class="socio-found-value ${!ultAnio?'empty':''}">${esc(ultAnio)||'—'}</div>
        </div>
        ${tel ? `<div class="socio-found-field"><div class="socio-found-label">Teléfono</div><div class="socio-found-value">${esc(tel)}</div></div>` : ''}
        ${dpi ? `<div class="socio-found-field"><div class="socio-found-label">DPI</div><div class="socio-found-value">${esc(dpi)}</div></div>` : ''}
        ${notaTag}
      </div>
      ${statusRow}
    </div>
    <div class="res-found-banner">✅ Socio verificado — completa los datos del hospedaje</div>`;

  form.style.display = 'flex';
  document.getElementById('resFecha').valueAsDate = new Date();
  document.getElementById('resQuien').value = currentUser || '';
}

async function saveReservation() {
  if (!selectedSocioForRes) return;
  const hotel = document.getElementById('resHotel').value;
  const fecha = document.getElementById('resFecha').value;
  const quien = document.getElementById('resQuien').value.trim();
  const notas = document.getElementById('resNotas').value.trim();
  const msg = document.getElementById('resMsg');

  if (!fecha || !quien) {
    msg.className = 'form-msg err';
    msg.textContent = 'Por favor completa la fecha y quién reserva.';
    return;
  }

  const btn = document.getElementById('btnSaveRes');
  btn.disabled = true; btn.textContent = 'Guardando...';

  const tipoRes  = document.querySelector('.tipo-btn.active')?.dataset.tipo || 'Hospedaje';
  const fechaSal = document.getElementById('resFechaSalida')?.value || null;
  const personas = parseInt(document.getElementById('resPersonas')?.value) || 1;

  const resData = {
    socio_nombre:  selectedSocioForRes.nombre_completo || selectedSocioForRes.socio || '—',
    socio_codigo:  selectedSocioForRes.codigo || selectedSocioForRes.referencia || '—',
    hotel,
    tipo:          tipoRes,
    fecha_entrada: fecha,
    fecha_salida:  fechaSal,
    personas,
    quien_reserva: quien,
    notas:         notas || null,
    created_by:    currentUser || 'Sistema'
  };

  const minPayload = {
    socio_nombre:  resData.socio_nombre,
    socio_codigo:  resData.socio_codigo,
    hotel:         resData.hotel,
    fecha_entrada: resData.fecha_entrada,
    quien_reserva: resData.quien_reserva,
    notas:         resData.notas
  };

  const tryPayload = async (payload) => {
    return await fetch(`${SUPABASE_URL}/rest/v1/reservaciones`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Prefer': 'return=representation' },
      body: JSON.stringify(payload)
    });
  };

  let response = await tryPayload(resData);
  if (!response.ok) {
    const errText = await response.text();
    if (errText.includes('column') || errText.includes('does not exist') || response.status === 400) {
      response = await tryPayload(minPayload);
    }
    if (!response.ok) {
      const finalErr = await response.text();
      msg.className = 'form-msg err';
      msg.textContent = `Error ${response.status}: ${finalErr || 'No se pudo guardar.'}`;
      btn.disabled = false; btn.innerHTML = '✅ Confirmar Reserva';
      return;
    }
  }

  const saved = await response.json();
  msg.className = 'form-msg ok';
  msg.textContent = '✅ Reservación guardada con éxito.';
  setTimeout(() => {
    printRes(saved[0] || resData);
    switchResTab('lista');
    document.getElementById('resSearchSocio').value = '';
    document.getElementById('resSocioInfo').style.display = 'none';
    document.getElementById('resFormContainer').style.display = 'none';
    selectedSocioForRes = null;
  }, 1000);
  btn.disabled = false; btn.innerHTML = '✅ Confirmar Reserva';
}

async function deleteReservation(id, btn) {
  if (!confirm('¿Eliminar esta reservación? Esta acción no se puede deshacer.')) return;
  const card = btn.closest('.res-hist-card');
  if (card) { card.style.opacity = '.4'; card.style.pointerEvents = 'none'; }

  const headers = {
    'apikey':        SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type':  'application/json'
  };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/reservaciones?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE', headers
  });

  if (res.ok || res.status === 204) {
    if (card) card.remove();
    try {
      const deleted = JSON.parse(sessionStorage.getItem('vca_deleted_res') || '[]');
      deleted.push(id);
      sessionStorage.setItem('vca_deleted_res', JSON.stringify(deleted));
    } catch(e) {}
  } else {
    const errText = await res.text();
    if (card) { card.style.opacity = '1'; card.style.pointerEvents = ''; }
    alert(`Error al eliminar (${res.status}): ${errText || 'Verifica permisos RLS en Supabase.'}`);
  }
}

async function loadReservations() {
  const list = document.getElementById('reservationsList');
  list.innerHTML = '<div class="empty-log">⏳ Cargando historial...</div>';

  const res = await fetch(`${SUPABASE_URL}/rest/v1/reservaciones?order=created_at.desc&limit=200`, {
    headers: {
      'apikey':        SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type':  'application/json',
      'Accept':        'application/json'
    }
  });
  if (!res.ok) {
    list.innerHTML = '<div class="empty-log">❌ Error al cargar. Asegúrate de crear la tabla en Supabase.</div>';
    return;
  }
  let rows = await res.json();
  try {
    const deleted = JSON.parse(sessionStorage.getItem('vca_deleted_res') || '[]');
    if (deleted.length) rows = rows.filter(r => !deleted.includes(r.id));
  } catch(e) {}
  if (!rows.length) {
    list.innerHTML = '<div class="empty-log">No hay reservaciones registradas.</div>';
    return;
  }

  list.innerHTML = rows.map((r,i) => {
    const d = new Date(r.created_at);
    const hotelIcon = r.hotel?.includes('Amatique') ? '🏖️' : r.hotel?.includes('Clarion') ? '🏙️' : '🌊';
    const tipoBadge = r.tipo === 'Day Pass'
      ? '<span style="background:#fff8e6;color:#7a5800;border:1px solid #f0d080;border-radius:6px;padding:2px 8px;font-size:.68rem;font-weight:700;margin-left:6px;">☀️ Day Pass</span>'
      : '<span style="background:#e8f0fe;color:#1a4a8a;border:1px solid #c8dbf8;border-radius:6px;padding:2px 8px;font-size:.68rem;font-weight:700;margin-left:6px;">🏨 Hospedaje</span>';
    return `
    <div class="res-hist-card" style="animation-delay:${Math.min(i,20)*.04}s;">
      <div class="res-hist-head">
        <div>
          <div class="res-hist-hotel">${hotelIcon} ${esc(r.hotel||'—')}${tipoBadge}</div>
          <div class="res-hist-date">📅 Entrada: ${r.fecha_entrada||'—'}${r.fecha_salida?' · Salida: '+r.fecha_salida:''}</div>
        </div>
        <div style="display:flex;gap:6px;">
          <button class="res-hist-print" onclick='printRes(${JSON.stringify(r).replace(/'/g,"&#39;")})'>🖨 Imprimir</button>
          <button class="res-hist-del" onclick="deleteReservation('${r.id}', this)">🗑</button>
        </div>
      </div>
      <div class="res-hist-body">
        <div class="f"><div class="fl">Socio</div><div class="fv">${esc(r.socio_nombre||'—')}</div></div>
        <div class="f"><div class="fl">Referencia</div><div class="fv">${esc(r.socio_codigo||'—')}</div></div>
        <div class="f"><div class="fl">Reservado por</div><div class="fv">${esc(r.quien_reserva||'—')}</div></div>
        <div class="f"><div class="fl">Personas</div><div class="fv">${r.personas||'—'}</div></div>
        ${r.notas ? `<div class="f wide"><div class="fl">Notas</div><div class="fv">${esc(r.notas)}</div></div>` : ''}
        <div class="f wide"><div class="fl">Fecha de registro</div><div class="fv" style="font-size:.75rem;">${d.toLocaleDateString('es')} · ${d.toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'})} · 👤 ${esc(r.created_by||r.quien_reserva||'—')}</div></div>
      </div>
    </div>`;
  }).join('');
}

function printRes(r) {
  const tipo = r.tipo || 'Hospedaje';
  const tipoIcon = tipo === 'Day Pass' ? '☀️' : '🏨';
  const now = new Date();
  const emision = now.toLocaleDateString('es') + ' ' + now.toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'});
  const created = r.created_at ? new Date(r.created_at).toLocaleString('es') : emision;

  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/>
  <title>Comprobante Reservación VCA</title>
  <style>
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family: 'Georgia', serif; color: #0d1f3a; background: white; padding: 0; }
    .page { max-width: 680px; margin: 0 auto; padding: 32px 36px; }
    .header { display:flex; align-items:center; justify-content:space-between; padding-bottom:18px; border-bottom:3px solid #0a1628; margin-bottom:22px; }
    .header-logo img { height:60px; }
    .header-right { text-align:right; }
    .header-title { font-size:20px; font-weight:700; color:#0a1628; letter-spacing:-.3px; }
    .header-sub   { font-size:11px; color:#526282; margin-top:3px; }
    .folio { font-size:10px; color:#526282; margin-top:8px; }
    .folio span { background:#f0f4fb; border:1px solid #dce6f5; border-radius:4px; padding:3px 8px; font-family:monospace; }
    .tipo-badge { display:inline-block; padding:5px 14px; border-radius:20px; font-size:12px; font-weight:700; margin-bottom:18px; letter-spacing:.3px; }
    .tipo-hospedaje { background:#e8f0fe; color:#1a4a8a; border:1px solid #c8dbf8; }
    .tipo-daypass   { background:#fff8e6; color:#7a5800; border:1px solid #f0d080; }
    .socio-block { background:#f4f7ff; border-radius:10px; padding:16px 18px; margin-bottom:18px; border-left:4px solid #1549a0; }
    .socio-name  { font-size:18px; font-weight:700; color:#0a1628; }
    .socio-code  { font-size:12px; color:#526282; margin-top:3px; font-family:monospace; }
    .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:18px; }
    .info-card { background:#f8f9fc; border:1px solid #e0e8f5; border-radius:8px; padding:12px 14px; }
    .info-label { font-size:9px; font-weight:700; color:#526282; text-transform:uppercase; letter-spacing:.8px; margin-bottom:4px; }
    .info-value { font-size:14px; font-weight:600; color:#0a1628; }
    .info-card.accent { background:#0a1628; border-color:#0a1628; }
    .info-card.accent .info-label { color:rgba(255,255,255,.55); }
    .info-card.accent .info-value { color:white; }
    .notas-block { border:1.5px dashed #c8d8ee; border-radius:8px; padding:12px 14px; margin-bottom:20px; }
    .notas-label { font-size:9px; font-weight:700; color:#526282; text-transform:uppercase; letter-spacing:.8px; margin-bottom:5px; }
    .notas-text  { font-size:13px; color:#0d1f3a; line-height:1.5; }
    .sigs { display:grid; grid-template-columns:1fr 1fr; gap:40px; margin-top:36px; }
    .sig-line { border-top:1.5px solid #0a1628; padding-top:6px; text-align:center; font-size:10px; color:#526282; }
    .footer { margin-top:24px; font-size:9px; color:#aaa; text-align:center; border-top:1px solid #e0e8f5; padding-top:10px; line-height:1.6; }
    @media print { body { padding:0; } .page { padding:20px 24px; } }
  </style></head><body>
  <div class="page">
    <div class="header">
      <div class="header-logo">
        <img src="https://vcaofamerica.com/wp-content/uploads/2016/07/logo-png.png" onerror="this.parentElement.innerHTML='<div style=\'font-family:Georgia,serif;font-size:1.2rem;font-weight:700;color:#0a1628;\'>Vacation Club<br>of America</div>'"/>
      </div>
      <div class="header-right">
        <div class="header-title">Comprobante de Reservación</div>
        <div class="header-sub">Vacation Club of America</div>
        <div class="folio">Emisión: <span>${emision}</span></div>
      </div>
    </div>
    <div><span class="tipo-badge ${tipo === 'Day Pass' ? 'tipo-daypass' : 'tipo-hospedaje'}">${tipoIcon} ${tipo}</span></div>
    <div class="socio-block">
      <div class="socio-name">${esc(r.socio_nombre||'—')}</div>
      <div class="socio-code">Referencia: ${esc(r.socio_codigo||'—')}</div>
    </div>
    <div class="info-grid">
      <div class="info-card accent"><div class="info-label">Hotel / Propiedad</div><div class="info-value">${esc(r.hotel||'—')}</div></div>
      <div class="info-card accent"><div class="info-label">Fecha de Entrada</div><div class="info-value">${r.fecha_entrada||'—'}</div></div>
      ${r.fecha_salida ? `<div class="info-card"><div class="info-label">Fecha de Salida</div><div class="info-value">${r.fecha_salida}</div></div>` : ''}
      <div class="info-card"><div class="info-label">N° de Personas</div><div class="info-value">${r.personas||'—'}</div></div>
      <div class="info-card"><div class="info-label">Reservado por</div><div class="info-value">${esc(r.quien_reserva||'—')}</div></div>
      <div class="info-card"><div class="info-label">Registrado en sistema</div><div class="info-value" style="font-size:11px;">${created}</div></div>
    </div>
    ${r.notas ? `<div class="notas-block"><div class="notas-label">Notas y peticiones especiales</div><div class="notas-text">${esc(r.notas)}</div></div>` : ''}
    <div class="sigs">
      <div class="sig-line">Firma del Socio</div>
      <div class="sig-line">DPI / Identificación</div>
    </div>
    <div class="footer">
      Este documento es válido únicamente con la firma del socio y presentación de identificación original.<br>
      Vacation Club of America · Sistema de Reservaciones · ${emision}
    </div>
  </div>
  <script>window.onload = () => window.print();<\/script>
  </body></html>`);
  w.document.close();
}

function showRootAccessDenied() {
  const toast = document.getElementById('accessToast');
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2800);
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); deferredPrompt = e;
  document.getElementById('installBanner').style.display = 'flex';
});
document.getElementById('installBtn').addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt(); await deferredPrompt.userChoice;
  deferredPrompt = null; document.getElementById('installBanner').style.display = 'none';
});
document.getElementById('closeBanner').addEventListener('click', () => {
  document.getElementById('installBanner').style.display = 'none';
});

function showStatus(type, msg) {
  const p = document.getElementById('statusPill');
  p.className = 'status-pill ' + type;
  document.getElementById('statusIcon').textContent = type === 'ok' ? '✅' : '❌';
  document.getElementById('statusText').textContent = msg;
}

function setChip(n) {
  const c = document.getElementById('recordsChip');
  c.textContent = `${n.toLocaleString('es')} registros cargados`;
  c.classList.toggle('show', n > 0);
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function parseExcelDate(val) {
  if (!val && val !== 0) return null;
  if (val instanceof Date) {
    if (!isNaN(val.getTime())) return val.toISOString().slice(0, 10);
    return null;
  }
  const s = String(val).trim();
  if (!s || s === '—' || s === 'null' || s === 'undefined') return null;
  if (/^\d{4,5}$/.test(s)) {
    const d = new Date((Number(s) - 25569) * 86400 * 1000);
    const tzOffset = d.getTimezoneOffset() * 60000;
    const localDate = new Date(d.getTime() + tzOffset);
    if (!isNaN(localDate.getTime())) return localDate.toISOString().slice(0, 10);
  }
  const isoMatch = s.match(/^(\d{4})[\-\/](\d{1,2})[\-\/](\d{1,2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    const year = Number(y), month = Number(m), day = Number(d);
    if (year >= 1900 && month >= 1 && month <= 12 && day >= 1 && day <= 31)
      return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }
  const dmyMatch = s.match(/^(\d{1,2})[\-\/](\d{1,2})[\-\/](\d{4})/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    const day = Number(d), month = Number(m), year = Number(y);
    if (year >= 1900 && month >= 1 && month <= 12 && day >= 1 && day <= 31)
      return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime()) && d.getFullYear() > 1900) return d.toISOString().slice(0, 10);
  } catch(e) {}
  return null;
}

function nowStr() {
  const d = new Date();
  return d.toLocaleDateString('es') + ' · ' + d.toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'});
}

function fmtDate(val) {
  if (!val) return '—';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleDateString('es', { day:'2-digit', month:'2-digit', year:'numeric' });
  } catch(e) { return String(val); }
}

async function sbSaveExcel(jsonData) {
  if (!supabaseReady) return;
  await fetch(`${SUPABASE_URL}/rest/v1/excel_data`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Prefer': 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ id: 1, data: JSON.stringify(jsonData), updated_at: new Date().toISOString(), uploaded_by: currentUser || 'Desconocido' })
  });
}

async function sbLoadExcel() {
  if (!supabaseReady) return null;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/excel_data?id=eq.1`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
  });
  if (!res.ok) return null;
  const rows = await res.json();
  return rows.length ? rows[0] : null;
}

async function tryAutoLoadExcel() {
  const row = await sbLoadExcel();
  if (!row) return;
  lastExcelTimestamp = row.updated_at;
  try {
    const parsed = JSON.parse(row.data);
    if (!parsed.length) return;
    data = parsed;
    try { localStorage.setItem(DATA_KEY, JSON.stringify(data)); } catch(e) {}
    const d = new Date(row.updated_at);
    const when = d.toLocaleDateString('es') + ' ' + d.toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'});
    showStatus('ok', `☁️ ${data.length} registros sincronizados — subido por ${row.uploaded_by} el ${when}`);
    document.getElementById('searchBtn').disabled = false;
    setChip(data.length);
  } catch(e) {}
}

async function sbInsert(row) {
  if (!supabaseReady) return;
  await fetch(`${SUPABASE_URL}/rest/v1/consultas`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Prefer': 'return=minimal' },
    body: JSON.stringify(row)
  });
}

async function sbFetch() {
  if (!supabaseReady) return null;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/consultas?order=created_at.desc&limit=500`, { headers: authHeaders() });
  return res.ok ? await res.json() : null;
}

async function sbDelete() {
  if (!supabaseReady) return;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/consultas?id=gte.0`, {
    method: 'DELETE',
    headers: { ...authHeaders(), 'Prefer': 'return=minimal' }
  });
  return res.ok;
}

let lastExcelTimestamp = null;
let pollingInterval    = null;

function startPolling() {
  if (!supabaseReady) return;
  pollingInterval = setInterval(async () => {
    if (document.getElementById('screenMain')?.classList.contains('active') === false) return;
    const row = await sbLoadExcel();
    if (!row) return;
    const ts = row.updated_at;
    if (lastExcelTimestamp && ts !== lastExcelTimestamp) {
      const d = new Date(ts);
      const when = d.toLocaleDateString('es') + ' ' + d.toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'});
      document.getElementById('excelUpdateMsg').textContent =
        `☁️ ${row.uploaded_by} subió un Excel nuevo el ${when}. ¿Actualizar datos?`;
      document.getElementById('excelUpdateBanner').classList.add('show');
      pendingExcelRow = row;
    }
    lastExcelTimestamp = ts;
  }, 30000);
}

let pendingExcelRow = null;

async function reloadFromCloud() {
  const row = pendingExcelRow || await sbLoadExcel();
  if (!row) return;
  try {
    const parsed = JSON.parse(row.data);
    if (!parsed.length) return;
    data = parsed;
    try { localStorage.setItem(DATA_KEY, JSON.stringify(data)); } catch(e) {}
    const d = new Date(row.updated_at);
    const when = d.toLocaleDateString('es') + ' ' + d.toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'});
    showStatus('ok', `✅ Datos actualizados — ${data.length} registros (${row.uploaded_by} · ${when})`);
    document.getElementById('searchBtn').disabled = false;
    setChip(data.length);
    lastExcelTimestamp = row.updated_at;
  } catch(e) {}
  dismissUpdate();
}

function dismissUpdate() {
  document.getElementById('excelUpdateBanner').classList.remove('show');
  pendingExcelRow = null;
}

const notesCache = {};

async function sbGetNote(ref) {
  if (!supabaseReady) return null;
  if (notesCache[ref] !== undefined) return notesCache[ref];
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/notas_internas?referencia=eq.${encodeURIComponent(ref)}&limit=1`,
    { headers: authHeaders() }
  );
  if (!res.ok) return null;
  const rows = await res.json();
  const note = rows.length ? rows[0] : null;
  notesCache[ref] = note;
  return note;
}

async function sbSaveNote(ref, text) {
  if (!supabaseReady) return;
  const body = {
    referencia: ref,
    nota: text,
    autor: currentUser || 'Root',
    updated_at: new Date().toISOString()
  };
  await fetch(`${SUPABASE_URL}/rest/v1/notas_internas`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Prefer': 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(body)
  });
  notesCache[ref] = body;
}

async function saveNote(ref) {
  const ta  = document.getElementById('note-ta-' + ref);
  const btn = document.getElementById('note-save-' + ref);
  if (!ta) return;
  btn.textContent = 'Guardando…'; btn.disabled = true;
  await sbSaveNote(ref, ta.value.trim());
  notesCache[ref] = { nota: ta.value.trim(), autor: currentUser, updated_at: new Date().toISOString() };
  const disp = document.getElementById('note-disp-' + ref);
  if (disp) {
    if (ta.value.trim()) {
      disp.innerHTML = `<div class="note-existing">${esc(ta.value.trim())}<div class="note-meta">✏️ ${currentUser} · ahora</div></div>`;
      disp.style.display = 'block';
    } else {
      disp.style.display = 'none';
    }
  }
  btn.textContent = '✅ Guardado'; btn.disabled = false;
  setTimeout(() => { btn.textContent = 'Guardar nota'; }, 2000);
}

function toggleNoteEdit(ref) {
  const area = document.getElementById('note-area-' + ref);
  if (!area) return;
  area.classList.toggle('show');
  if (area.classList.contains('show')) document.getElementById('note-ta-' + ref)?.focus();
}

function buildNotePanel(r) {
  const isRoot = currentRol === 'admin';
  const cached = notesCache[r.referencia];
  const hasNote = cached && cached.nota && cached.nota.trim();

  const existingHtml = hasNote
    ? `<div class="note-existing" id="note-disp-${esc(r.referencia)}">${esc(cached.nota)}<div class="note-meta">✏️ ${esc(cached.autor||'Root')} · ${cached.updated_at ? new Date(cached.updated_at).toLocaleDateString('es') : ''}</div></div>`
    : `<div id="note-disp-${esc(r.referencia)}" style="display:none;"></div>`;

  const rootControls = isRoot ? `
    <button class="note-toggle-btn" onclick="toggleNoteEdit('${esc(r.referencia)}')">
      ✏️ ${hasNote ? 'Editar nota' : 'Añadir nota interna'}
    </button>
    <div class="note-root-area" id="note-area-${esc(r.referencia)}">
      <textarea class="note-textarea" id="note-ta-${esc(r.referencia)}"
        placeholder="Escribe una nota interna visible para todos los usuarios…">${hasNote ? esc(cached.nota) : ''}</textarea>
      <button class="note-save-btn" id="note-save-${esc(r.referencia)}"
        onclick="saveNote('${esc(r.referencia)}')">Guardar nota</button>
    </div>` : '';

  if (!isRoot && !hasNote) return '';

  return `<div class="note-panel">
    <span class="note-panel-lbl">📝 Nota interna</span>
    ${existingHtml}
    ${rootControls}
  </div>`;
}

async function prefetchNotes(refs) {
  if (!supabaseReady || !refs.length) return;
  const q = refs.map(r => `referencia=eq.${encodeURIComponent(r)}`).join(',');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/notas_internas?or=(${q})`, { headers: authHeaders() });
  if (!res.ok) return;
  const rows = await res.json();
  rows.forEach(row => { notesCache[row.referencia] = row; });
}

document.getElementById('fileInput').addEventListener('change', e => {
  const file = e.target.files[0]; if (!file) return;
  showStatus('ok', 'Leyendo archivo…');
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const wb = XLSX.read(ev.target.result, { type: 'array', cellDates: true });
      let sh = wb.SheetNames.find(n => n.toLowerCase().includes('cartera activa')) || wb.SheetNames[0];
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sh], { defval: '', raw: false, dateNF: 'dd/mm/yyyy' });
      if (!rows.length) { showStatus('err', 'El archivo está vacío.'); return; }
      data = rows.map(row => {
        const n = {};
        Object.keys(row).forEach(k => { n[k.toLowerCase().trim()] = row[k]; });
        return {
          referencia:         String(n['referencia']||'').trim(),
          socio:              String(n['socio']||'').trim(),
          departamento:       String(n['departamento']||'').trim(),
          inicio:             String(n['inicio']||'').trim(),
          vencimiento:        String(n['vencimiento']||'').trim(),
          ultimo_pago:        String(n['ultimo pago']||'').trim(),
          ultimo_año_de_pago: String(n['ultimo año de pago']||n['ultimo ano de pago']||'').trim(),
          notas:              String(n['notas']||n['status']||'').trim(),
        };
      }).filter(r => r.referencia);
      try { localStorage.setItem(DATA_KEY, JSON.stringify(data)); } catch(e) {}
      sbSaveExcel(data);
      showStatus('ok', `✅ ${data.length} registros cargados y sincronizados ☁️ — "${sh}"`);
      document.getElementById('searchBtn').disabled = false;
      setChip(data.length);
      document.getElementById('resultsWrap').style.display = 'none';
      document.getElementById('emptyState').style.display = '';
    } catch(err) { showStatus('err', 'Error al leer el archivo.'); }
  };
  reader.readAsArrayBuffer(file);
});

function formatMatches(raw) {
  return raw.map(m => ({
    referencia:        m.codigo,
    socio:             m.nombre_completo,
    departamento:      m.tipo_membresia,
    inicio:            m.fecha_inicio,
    vencimiento:       m.fecha_vencimiento,
    ultimo_pago:       m.ultimo_pago        || '—',
    ultimo_año_de_pago:m.ultimo_año_de_pago || '—',
    notas:             m.comentarios || m.notas || ''
  }));
}

function logSearch(formattedMatches, q) {
  if (formattedMatches.length > 0) {
    formattedMatches.forEach(r => sbInsert({
      socio: r.socio, referencia: r.referencia,
      departamento: r.departamento, notas: r.notas,
      usuario: currentUser || 'Desconocido', encontrado: true
    }));
  } else {
    sbInsert({
      socio: '— NO ENCONTRADO —', referencia: q, departamento: '',
      notas: 'Sin resultados en la base de datos',
      usuario: currentUser || 'Desconocido', encontrado: false
    });
  }
}

function applyNotes(formattedMatches) {
  prefetchNotes(formattedMatches.map(r => r.referencia)).then(() => {
    formattedMatches.forEach(r => {
      const panel = document.querySelector(`[data-ref-note="${r.referencia}"]`);
      if (panel) panel.innerHTML = buildNotePanel(r).replace('<div class="note-panel">','').replace('</div>','');
    });
  });
}

async function searchCartera(q) {
  const qEnc    = encodeURIComponent(q);
  const base    = `${SUPABASE_URL}/rest/v1/socios`;
  const headers = authHeaders();
  const looksLikeCode = /^[A-Z0-9\-\/]+$/i.test(q);

  let step1Url;
  if (looksLikeCode) {
    step1Url = `${base}?select=*&or=(codigo.eq.${qEnc},codigo.ilike.${qEnc}*)&limit=50`;
  } else {
    step1Url = `${base}?select=*&or=(nombre_completo.ilike.${qEnc}*,codigo.eq.${qEnc})&limit=50`;
  }
  const r1 = await fetch(step1Url, { headers });
  const d1 = await r1.json();
  if (Array.isArray(d1) && d1.length > 0) return d1;

  const step2Url = `${base}?select=*&or=(codigo.ilike.*${qEnc}*,nombre_completo.ilike.*${qEnc}*,dpi.ilike.*${qEnc}*)&limit=50`;
  const r2 = await fetch(step2Url, { headers });
  return r2.json();
}

function doSearch(q2) {
  const q = (q2 || document.getElementById('searchInput').value).trim();
  if (!q) return;

  document.getElementById('searchInput').value = q;
  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('searchInput').blur();

  if (!searchHist.includes(q)) {
    searchHist.unshift(q); if (searchHist.length > 8) searchHist.pop();
    renderHist();
  }

  const resultsWrap = document.getElementById('resultsWrap');
  const cards       = document.getElementById('resultCards');
  const bar         = document.getElementById('resultBar');
  resultsWrap.style.display = 'flex';

  const cacheKey = q.toLowerCase();
  if (searchCache.has(cacheKey)) {
    const cached = searchCache.get(cacheKey);
    renderResults(cached, q);
    setTimeout(() => resultsWrap.scrollIntoView({ behavior:'smooth', block:'start' }), 80);
    return;
  }

  cards.innerHTML = '<div class="socios-empty">⏳ Buscando...</div>';
  bar.textContent = 'Buscando...';

  searchCartera(q)
    .then(raw => {
      const formattedMatches = formatMatches(Array.isArray(raw) ? raw : []);
      if (searchCache.size >= SEARCH_CACHE_MAX) searchCache.delete(searchCache.keys().next().value);
      searchCache.set(cacheKey, formattedMatches);
      logSearch(formattedMatches, q);
      renderResults(formattedMatches, q);
      applyNotes(formattedMatches);
    })
    .catch(err => {
      console.error('Search error:', err);
      cards.innerHTML = `<div class="no-result">Error al buscar en la base de datos. Verifica tu conexión.</div>`;
    });

  setTimeout(() => resultsWrap.scrollIntoView({ behavior:'smooth', block:'start' }), 80);
}

function waLink(r) {
  const lines = [
    '🏖️ *Vacation Club of America*',
    '━━━━━━━━━━━━━━━━━━━',
    `📋 *Referencia:* ${r.referencia}`,
    `👤 *Socio:* ${r.socio || '—'}`,
    `🏢 *Departamento:* ${r.departamento || '—'}`,
    `📅 *Inicio:* ${r.inicio || '—'}`,
    `⏳ *Vencimiento:* ${r.vencimiento || '—'}`,
    `💳 *Último pago:* ${r.ultimo_pago || '—'}`,
    `📆 *Último año pago:* ${r.ultimo_año_de_pago || '—'}`,
    r.notas ? `📝 *Notas:* ${r.notas}` : null,
    '━━━━━━━━━━━━━━━━━━━',
    `_Consultado por ${currentUser || 'VCA'}_`
  ].filter(Boolean).join('\n');
  return 'https://wa.me/?text=' + encodeURIComponent(lines);
}

function renderResults(matches, q) {
  const wrap = document.getElementById('resultsWrap');
  const bar  = document.getElementById('resultBar');
  const cards = document.getElementById('resultCards');
  wrap.style.display = 'flex';

  if (!matches.length) {
    bar.textContent = '';
    cards.innerHTML = `<div class="no-result">No se encontraron resultados para <strong>"${esc(q)}"</strong>.</div>`;
    return;
  }

  bar.textContent = `${matches.length} resultado${matches.length!==1?'s':''} para "${q}"`;
  cards.innerHTML = matches.map((r,i) => {
    const nota = r.notas ? `<span class="note-tag">🏷 ${esc(r.notas)}</span>` : `<span class="fv mt">Sin notas</span>`;
    return `
    <div class="rcard" style="animation-delay:${i*.07}s">
      <div class="rcard-head">
        <div class="rcard-ref">${esc(r.referencia)}</div>
        <div class="rcard-name">${esc(r.socio)||'—'}</div>
      </div>
      <div class="rcard-body">
        <div class="f wide"><div class="fl">Departamento</div><div class="fv ${!r.departamento?'mt':''}">${esc(r.departamento)||'—'}</div></div>
        <div class="f"><div class="fl">Inicio</div><div class="fv ${!r.inicio?'mt':''}">${esc(r.inicio)||'—'}</div></div>
        <div class="f"><div class="fl">Vencimiento</div><div class="fv ${!r.vencimiento?'mt':''}">${esc(r.vencimiento)||'—'}</div></div>
        <div class="f"><div class="fl">Último Pago</div><div class="fv ${!r.ultimo_pago?'mt':''}">${esc(r.ultimo_pago)||'—'}</div></div>
        <div class="f"><div class="fl">Último Año</div><div class="fv ${!r.ultimo_año_de_pago?'mt':''}">${esc(r.ultimo_año_de_pago)||'—'}</div></div>
        <div class="f wide"><div class="fl">Notas</div><div class="fv">${nota}</div></div>
      </div>
      <div data-ref-note="${esc(r.referencia)}"></div>
      <div style="padding:0 20px 16px;display:flex;gap:8px;">
        <a href="${waLink(r)}" target="_blank" rel="noopener"
          style="flex:1;display:flex;align-items:center;justify-content:center;gap:7px;padding:11px;background:#25d366;border:none;border-radius:12px;color:white;font-family:'Outfit',sans-serif;font-size:.82rem;font-weight:700;text-decoration:none;">
          📲 WhatsApp
        </a>
      </div>
    </div>`;
  }).join('');
}

function renderHist() {
  if (!searchHist.length) { document.getElementById('histSection').style.display='none'; return; }
  document.getElementById('histSection').style.display = 'block';
  document.getElementById('histWrap').innerHTML = searchHist
    .map(h => `<button class="hist-chip" onclick="doSearch('${esc(h)}')">${esc(h)}</button>`).join('');
}

let allRows = [];

async function loadReport() {
  const now = new Date();
  document.getElementById('reportDate').textContent =
    `Actualizado: ${now.toLocaleDateString('es')} · ${now.toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'})}`;

  const badge  = document.getElementById('syncBadge');
  const notice = document.getElementById('configNotice');

  if (!supabaseReady) {
    badge.className = 'sync-badge warn';
    badge.innerHTML = '<span class="sync-dot"></span> Pendiente de configurar';
    notice.style.display = 'block';
    document.getElementById('statTotal').textContent = '—';
    document.getElementById('statUnique').textContent = '—';
    document.getElementById('statNotFound').textContent = '—';
    document.getElementById('logList').innerHTML = `<div class="empty-log"><div class="ei">⚙️</div><p>Configura Supabase primero.</p></div>`;
    return;
  }

  notice.style.display = 'none';
  badge.className = 'sync-badge';
  badge.innerHTML = '<span class="sync-dot"></span> Sincronizado';

  const rows = await sbFetch();
  if (!rows) {
    document.getElementById('logList').innerHTML = `<div class="empty-log"><div class="ei">⚠️</div><p>Error al conectar con Supabase.</p></div>`;
    return;
  }

  allRows = rows;
  const found    = rows.filter(r => r.encontrado !== false);
  const notFound = rows.filter(r => r.encontrado === false);
  document.getElementById('statTotal').textContent    = rows.length;
  document.getElementById('statUnique').textContent   = new Set(found.map(r=>r.referencia)).size;
  document.getElementById('statNotFound').textContent = notFound.length;

  const excelRow = await sbLoadExcel();
  if (excelRow) {
    const d2 = new Date(excelRow.updated_at);
    document.getElementById('statCloud').textContent    = '✅';
    document.getElementById('statCloudSub').textContent = `${excelRow.uploaded_by} · ${d2.toLocaleDateString('es')}`;
  } else {
    document.getElementById('statCloud').textContent    = '—';
    document.getElementById('statCloudSub').textContent = 'sin archivo';
  }

  applyFilters();
}

function applyFilters() {
  if (!allRows.length) return;
  const fUser   = document.getElementById('filterUser')?.value   || '';
  const fResult = document.getElementById('filterResult')?.value || '';
  const fFrom   = document.getElementById('filterFrom')?.value   || '';
  const fTo     = document.getElementById('filterTo')?.value     || '';
  const fSearch = (document.getElementById('filterSearch')?.value || '').trim().toLowerCase();

  let filtered = allRows.filter(r => {
    if (fUser && r.usuario !== fUser) return false;
    if (fResult === 'found'    && r.encontrado === false) return false;
    if (fResult === 'notfound' && r.encontrado !== false) return false;
    if (fFrom) { const d=new Date(r.created_at),from=new Date(fFrom); from.setHours(0,0,0,0); if(d<from) return false; }
    if (fTo)   { const d=new Date(r.created_at),to=new Date(fTo); to.setHours(23,59,59,999); if(d>to) return false; }
    if (fSearch) {
      const ref=(r.referencia||'').toLowerCase(), s=(r.socio||'').toLowerCase();
      if (!ref.includes(fSearch) && !s.includes(fSearch)) return false;
    }
    return true;
  });

  const count = document.getElementById('filterCount');
  const hasFilter = fUser||fResult||fFrom||fTo||fSearch;
  count.textContent = hasFilter ? `${filtered.length} de ${allRows.length} registros` : '';
  renderLog(filtered);
}

function clearFilters() {
  ['filterUser','filterResult','filterFrom','filterTo','filterSearch'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('filterCount').textContent = '';
  renderLog(allRows);
}

function renderLog(rows) {
  const list = document.getElementById('logList');
  if (!rows.length) {
    list.innerHTML = `<div class="empty-log"><div class="ei">📋</div><p>No hay registros que coincidan.</p></div>`;
    return;
  }
  list.innerHTML = rows.map((r,i) => {
    const d  = new Date(r.created_at);
    const nf = r.encontrado === false;
    return `
    <div class="log-item ${nf?'log-nf':''}" style="animation-delay:${Math.min(i,20)*.025}s">
      <div class="log-num ${nf?'log-num-nf':''}">${nf?'✗':(i+1)}</div>
      <div class="log-info">
        <div class="log-name">${esc(r.socio||'—')}</div>
        <div class="log-ref">${esc(r.referencia||'—')} ${nf?'<span class="nf-tag">No encontrado</span>':''}</div>
      </div>
      <div class="log-meta">
        <div>${d.toLocaleDateString('es')}</div>
        <div>${d.toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'})}</div>
        <div class="log-who">👤 ${esc(r.usuario||'—')}</div>
      </div>
    </div>`;
  }).join('');
}

function getFilteredOrAll() {
  const fUser   = document.getElementById('filterUser')?.value   || '';
  const fResult = document.getElementById('filterResult')?.value || '';
  const fFrom   = document.getElementById('filterFrom')?.value   || '';
  const fTo     = document.getElementById('filterTo')?.value     || '';
  const fSearch = (document.getElementById('filterSearch')?.value || '').trim().toLowerCase();
  const hasFilter = fUser || fResult || fFrom || fTo || fSearch;
  if (!hasFilter) return allRows;
  return allRows.filter(r => {
    if (fUser   && r.usuario !== fUser) return false;
    if (fResult === 'found'    && r.encontrado === false) return false;
    if (fResult === 'notfound' && r.encontrado !== false) return false;
    if (fFrom) { const d=new Date(r.created_at),from=new Date(fFrom); from.setHours(0,0,0,0); if(d<from) return false; }
    if (fTo)   { const d=new Date(r.created_at),to=new Date(fTo); to.setHours(23,59,59,999); if(d>to) return false; }
    if (fSearch) { const ref=(r.referencia||'').toLowerCase(),s=(r.socio||'').toLowerCase(); if(!ref.includes(fSearch)&&!s.includes(fSearch)) return false; }
    return true;
  });
}

async function exportPDF() {
  const rows = getFilteredOrAll();
  if (!rows.length) { alert('No hay datos para exportar.'); return; }
  const now = new Date();
  const dateStr = now.toLocaleDateString('es') + ' ' + now.toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'});
  const found    = rows.filter(r => r.encontrado !== false);
  const notFound = rows.filter(r => r.encontrado === false);

  const rowsHTML = rows.map((r,i) => {
    const d = new Date(r.created_at);
    const nf = r.encontrado === false;
    return `<tr style="${nf?'background:#fff8f7;':''}">
      <td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:11px;">${i+1}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:11px;${nf?'color:#b53326;':''}">
        ${esc(r.socio||'—')} ${nf?'<span style="background:#fdf1f0;color:#b53326;border-radius:3px;padding:1px 5px;font-size:9px;font-weight:700;">No encontrado</span>':''}
      </td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:11px;">${esc(r.referencia||'—')}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:11px;">${esc(r.usuario||'—')}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:11px;">${d.toLocaleDateString('es')} ${d.toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'})}</td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Reporte Cartera VCA</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 30px; color: #0d1f3a; }
    .header { display:flex; align-items:center; gap:20px; margin-bottom:24px; border-bottom:3px solid #0a1628; padding-bottom:16px; }
    .header img { height:60px; }
    .header-text h1 { font-size:20px; margin:0; color:#0a1628; }
    .header-text p  { font-size:12px; color:#526282; margin:3px 0 0; }
    .stats { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:24px; }
    .stat { background:#f4f7ff; border-radius:8px; padding:12px 14px; border:1px solid #e0e8f5; }
    .stat .lbl { font-size:9px; font-weight:700; color:#526282; text-transform:uppercase; letter-spacing:.8px; }
    .stat .val { font-size:22px; font-weight:700; color:#0a1628; margin-top:2px; }
    table { width:100%; border-collapse:collapse; }
    th { background:#0a1628; color:white; padding:8px 10px; font-size:10px; text-align:left; font-weight:700; text-transform:uppercase; letter-spacing:.5px; }
    tr:nth-child(even) { background:#f8f9fc; }
    .footer { margin-top:20px; font-size:10px; color:#526282; text-align:center; border-top:1px solid #e0e8f5; padding-top:10px; }
  </style></head><body>
  <div class="header">
    <img src="https://vcaofamerica.com/wp-content/uploads/2016/07/logo-png.png" onerror="this.style.display='none'"/>
    <div class="header-text">
      <h1>Reporte de Consultas — Cartera Activa</h1>
      <p>Vacation Club of America · Generado: ${dateStr} · Usuario: ${currentUser||'—'}</p>
    </div>
  </div>
  <div class="stats">
    <div class="stat"><div class="lbl">Total consultas</div><div class="val">${rows.length}</div></div>
    <div class="stat"><div class="lbl">Encontrados</div><div class="val">${found.length}</div></div>
    <div class="stat"><div class="lbl">No encontrados</div><div class="val" style="color:#b53326">${notFound.length}</div></div>
    <div class="stat"><div class="lbl">Socios únicos</div><div class="val">${new Set(found.map(r=>r.referencia)).size}</div></div>
  </div>
  <table>
    <thead><tr><th>#</th><th>Socio</th><th>Referencia</th><th>Usuario</th><th>Fecha y hora</th></tr></thead>
    <tbody>${rowsHTML}</tbody>
  </table>
  <div class="footer">Vacation Club of America · Sistema Cartera Activa · ${dateStr}</div>
  </body></html>`;

  const blob = new Blob([html], {type:'text/html'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `Reporte_VCA_${now.toISOString().slice(0,10)}.html`;
  a.click(); URL.revokeObjectURL(url);
}

async function printReport() {
  const rows = getFilteredOrAll();
  if (!rows.length) { alert('No hay datos para imprimir.'); return; }
  const now = new Date();
  const dateStr = now.toLocaleDateString('es') + ' ' + now.toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'});
  const found    = rows.filter(r => r.encontrado !== false);
  const notFound = rows.filter(r => r.encontrado === false);

  const rowsHTML = rows.map((r,i) => {
    const d = new Date(r.created_at);
    const nf = r.encontrado === false;
    return `<tr>
      <td>${i+1}</td>
      <td style="${nf?'color:#b53326;font-weight:600;':''}">${esc(r.socio||'—')}${nf?' ⚠':''}</td>
      <td>${esc(r.referencia||'—')}</td>
      <td>${esc(r.usuario||'—')}</td>
      <td>${d.toLocaleDateString('es')} ${d.toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'})}</td>
    </tr>`;
  }).join('');

  const w = window.open('','_blank');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Reporte VCA</title>
  <style>
    body { font-family:Arial,sans-serif; margin:20px; font-size:11px; color:#0d1f3a; }
    h1 { font-size:16px; margin:0 0 4px; }
    .sub { font-size:10px; color:#526282; margin-bottom:16px; }
    .stats { display:flex; gap:20px; margin-bottom:14px; }
    .stat { background:#f4f7ff; border-radius:6px; padding:8px 12px; border:1px solid #e0e8f5; }
    .stat .lbl { font-size:8px; font-weight:700; color:#526282; text-transform:uppercase; }
    .stat .val { font-size:18px; font-weight:700; color:#0a1628; }
    table { width:100%; border-collapse:collapse; }
    th { background:#0a1628; color:white; padding:6px 8px; font-size:9px; text-align:left; }
    td { padding:5px 8px; border-bottom:1px solid #eee; font-size:10px; }
    tr:nth-child(even) td { background:#f8f9fc; }
    .footer { margin-top:14px; font-size:9px; color:#888; text-align:center; border-top:1px solid #eee; padding-top:8px; }
  </style></head><body>
  <h1>Reporte de Consultas — Cartera Activa VCA</h1>
  <div class="sub">Generado: ${dateStr} · Usuario: ${currentUser||'—'}</div>
  <div class="stats">
    <div class="stat"><div class="lbl">Total</div><div class="val">${rows.length}</div></div>
    <div class="stat"><div class="lbl">Encontrados</div><div class="val">${found.length}</div></div>
    <div class="stat"><div class="lbl">No encontrados</div><div class="val" style="color:#b53326">${notFound.length}</div></div>
    <div class="stat"><div class="lbl">Socios únicos</div><div class="val">${new Set(found.map(r=>r.referencia)).size}</div></div>
  </div>
  <table>
    <thead><tr><th>#</th><th>Socio</th><th>Referencia</th><th>Usuario</th><th>Fecha y hora</th></tr></thead>
    <tbody>${rowsHTML}</tbody>
  </table>
  <div class="footer">Vacation Club of America · Sistema Cartera Activa · ${dateStr}</div>
  <script>window.onload=()=>window.print()<\/script>
  </body></html>`);
  w.document.close();
}

function switchTab(tab) {
  document.querySelectorAll('#screenReport .tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('#screenReport .tab-pane').forEach(p => p.classList.remove('active'));
  const btn = document.getElementById('tab-' + tab);
  const pane = document.getElementById('pane-' + tab);
  if (btn)  btn.classList.add('active');
  if (pane) pane.classList.add('active');
}

function switchConfigTab(tab) {
  if (tab === 'usuarios' && currentRol !== 'admin') { showRootAccessDenied(); return; }
  document.querySelectorAll('#configTabNav .tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('#configBody .tab-pane').forEach(p => p.classList.remove('active'));
  document.getElementById('ctab-' + tab).classList.add('active');
  document.getElementById('cpane-' + tab).classList.add('active');
  if (tab === 'usuarios') { renderConfigUsers(); loadUsers(); }
  if (tab === 'socios')   { renderConfigSocios(); }
  if (tab === 'nuevo') {
    if (!socioCanEdit()) { showRootAccessDenied(); return; }
    resetSocioForm();
  }
}

function renderConfigSocios() {
  clearSociosFilters();
  loadSocios();
}

function renderConfigUsers() {}

async function listUsers() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=50`, {
    headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json.users || json;
}

async function listProfiles() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=*`, {
    headers: { ...authHeaders(), 'Accept': 'application/json' }
  });
  if (!res.ok) return {};
  const rows = await res.json();
  const map = {};
  rows.forEach(r => { map[r.user_id] = r; });
  return map;
}

async function loadUsers() {
  if (currentRol !== 'admin') return;
  const list = document.getElementById('userList');
  list.innerHTML = '<div class="empty-log"><div class="ei" style="font-size:24px;">⏳</div><p>Cargando…</p></div>';
  const [users, profiles] = await Promise.all([listUsers(), listProfiles()]);
  if (!users) {
    list.innerHTML = '<div class="empty-log"><div class="ei">⚠️</div><p>Error al cargar usuarios.<br>Verifica permisos de Supabase.</p></div>';
    return;
  }
  if (!users.length) {
    list.innerHTML = '<div class="empty-log"><div class="ei">👤</div><p>No hay usuarios registrados.</p></div>';
    return;
  }

  const USER_COLORS = [
    'linear-gradient(135deg,#1549a0,#2d7ef0)',
    'linear-gradient(135deg,#0f6e56,#1d9e75)',
    'linear-gradient(135deg,#7a3a00,#e8a000)',
    'linear-gradient(135deg,#6b21a8,#9333ea)',
    'linear-gradient(135deg,#b53326,#ef4444)',
  ];

  list.innerHTML = users.map((u, i) => {
    const profile = profiles[u.id] || {};
    const rol    = profile.is_admin ? 'admin' : 'usuario';
    const nombre = profile.display_name || u.email?.split('@')[0] || '—';
    const color  = USER_COLORS[i % USER_COLORS.length];
    return `
    <div class="user-card" id="uc-${u.id}">
      <div class="uc-avatar" style="background:${color}">${(nombre[0] || '?').toUpperCase()}</div>
      <div class="uc-info">
        <div class="uc-name">${esc(nombre)}</div>
        <div class="uc-email">${esc(u.email)}</div>
        <span class="uc-role ${rol}">${rol === 'admin' ? '⚿ Admin' : '👤 Usuario'}</span>
      </div>
      <div class="uc-actions">
        <button class="uc-btn" onclick="editUser('${u.id}','${esc(nombre)}','${esc(u.email)}','${rol}')">✏️</button>
        <button class="uc-btn del" onclick="deleteUser('${u.id}','${esc(nombre)}')">🗑</button>
      </div>
    </div>`;
  }).join('');
}

let editingUserId = null;

async function saveUser() {
  if (currentRol !== 'admin') { showFormMsg('err', 'Solo un administrador puede gestionar usuarios.'); return; }
  const nombre = document.getElementById('fNombre').value.trim();
  const email  = document.getElementById('fEmail').value.trim().toLowerCase();
  const pass   = document.getElementById('fPass').value;
  const rol    = document.getElementById('fRol').value;
  const btn    = document.getElementById('formSaveBtn');

  if (!nombre || !email) { showFormMsg('err', 'Nombre y correo son obligatorios.'); return; }
  if (!editingUserId && pass.length < 6) { showFormMsg('err', 'La contraseña debe tener al menos 6 caracteres.'); return; }

  btn.textContent = 'Guardando…'; btn.disabled = true;

  try {
    let userId = editingUserId;

    if (!editingUserId) {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass, email_confirm: true })
      });
      const json = await res.json();
      if (!res.ok) { showFormMsg('err', json.msg || json.error_description || 'Error al crear usuario.'); btn.textContent = 'Crear usuario'; btn.disabled = false; return; }
      userId = json.id;
    } else {
      if (pass.length >= 6) {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${editingUserId}`, {
          method: 'PUT',
          headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: pass })
        });
        if (!res.ok) { showFormMsg('err', 'Error al actualizar contraseña.'); btn.textContent = 'Guardar cambios'; btn.disabled = false; return; }
      }
    }

    await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ user_id: userId, display_name: nombre, is_admin: rol === 'admin' })
    });

    showFormMsg('ok', editingUserId ? `✅ ${nombre} actualizado correctamente.` : `✅ Usuario ${nombre} creado correctamente.`);
    resetForm();
    loadUsers();
  } catch(e) {
    showFormMsg('err', 'Error inesperado. Intenta de nuevo.');
  }
  btn.textContent = editingUserId ? 'Guardar cambios' : 'Crear usuario';
  btn.disabled = false;
}

function editUser(id, nombre, email, rol) {
  editingUserId = id;
  document.getElementById('fNombre').value = nombre;
  document.getElementById('fEmail').value  = email;
  document.getElementById('fPass').value   = '';
  document.getElementById('fRol').value    = rol;
  document.getElementById('fEmail').disabled = true;
  document.getElementById('formTitle').textContent = `✏️ Editando: ${nombre}`;
  document.getElementById('formSaveBtn').textContent = 'Guardar cambios';
  document.getElementById('formMsg').className = 'form-msg';
  document.getElementById('fNombre').focus();
  document.getElementById('userForm').scrollIntoView({ behavior:'smooth', block:'start' });
}

function resetForm() {
  editingUserId = null;
  document.getElementById('fNombre').value = '';
  document.getElementById('fEmail').value  = '';
  document.getElementById('fPass').value   = '';
  document.getElementById('fRol').value    = 'usuario';
  document.getElementById('fEmail').disabled = false;
  document.getElementById('formTitle').textContent = '➕ Nuevo usuario';
  document.getElementById('formSaveBtn').textContent = 'Crear usuario';
}

async function deleteUser(id, nombre) {
  if (currentRol !== 'admin') { alert('Solo un administrador puede eliminar usuarios.'); return; }
  if (!confirm(`¿Eliminar al usuario "${nombre}"? Esta acción no se puede deshacer.`)) return;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, {
    method: 'DELETE',
    headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
  });
  await fetch(`${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${id}`, {
    method: 'DELETE', headers: authHeaders()
  });
  if (res.ok) {
    document.getElementById('uc-' + id)?.remove();
    if (editingUserId === id) resetForm();
  } else {
    alert('Error al eliminar usuario. Verifica permisos en Supabase.');
  }
}

function showFormMsg(type, msg) {
  const el = document.getElementById('formMsg');
  el.className = 'form-msg ' + type;
  el.textContent = msg;
}

async function clearReport() {
  if (currentRol !== 'admin') { alert('Solo un administrador puede eliminar todo el historial.'); return; }
  if (!confirm('¿Eliminar TODO el historial de consultas? Esta acción no se puede deshacer.')) return;
  if (!supabaseReady) { alert('Configura Supabase primero.'); return; }
  const btn = document.querySelector('.danger-btn');
  if (btn) { btn.textContent = 'Eliminando…'; btn.disabled = true; }
  await sbDelete();
  allRows = [];
  document.getElementById('statTotal').textContent    = '0';
  document.getElementById('statUnique').textContent   = '0';
  document.getElementById('statNotFound').textContent = '0';
  document.getElementById('filterCount').textContent  = '';
  document.getElementById('logList').innerHTML =
    `<div class="empty-log"><div class="ei">📋</div><p>Historial eliminado correctamente.</p></div>`;
  if (btn) { btn.textContent = '🗑 Eliminar todo el historial'; btn.disabled = false; }
  setTimeout(() => loadReport(), 800);
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

document.getElementById('searchBtn').addEventListener('click', () => doSearch());
document.getElementById('resSearchSocio').addEventListener('keydown', e => { if (e.key === 'Enter') searchSocioForRes(); });
document.getElementById('searchInput').addEventListener('keydown', e => { if (e.key==='Enter') doSearch(); });

function toggleMenu(event) {
  if (event) event.stopPropagation();
  const dropdown = document.getElementById('menuDropdown');
  dropdown.classList.toggle('active');
}

function goTo(section) {
  const dropdown = document.getElementById('menuDropdown');
  dropdown.classList.remove('active');
  if (section === 'report') goToReport();
  else if (section === 'reservations') goToReservations();
  else if (section === 'config') goToConfig();
}

document.addEventListener('click', (e) => {
  const dropdown = document.getElementById('menuDropdown');
  const btn = document.querySelector('.menu-btn');
  if (dropdown && dropdown.classList.contains('active')) {
    if (!dropdown.contains(e.target) && e.target !== btn) {
      dropdown.classList.remove('active');
    }
  }
});

let sociosRows = [];
let sociosFiltered = [];
let selectedSocioId = null;
let editingSocioId = null;
let pagosRows = [];

function socioCanEdit() { return currentRol === 'admin'; }

async function fetchSocios() {
  const tryFetch = async (hdrs) => {
    let all = [];
    let from = 0;
    const size = 1000;
    while (true) {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/socios?select=*&order=nombre_completo.asc`,
        { headers: { ...hdrs, 'Range-Unit':'items', 'Range':`${from}-${from+size-1}`, 'Prefer':'count=none' } }
      );
      const txt = await res.text();
      if (!res.ok) throw Object.assign(new Error(txt), { status: res.status, body: txt });
      const page = JSON.parse(txt);
      all = all.concat(page);
      if (page.length < size) break;
      from += size;
    }
    return all;
  };

  try {
    return await tryFetch(authHeaders());
  } catch (e1) {
    try {
      const svcHdrs = {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      return await tryFetch(svcHdrs);
    } catch (e2) {
      throw new Error(`HTTP ${e2.status}: ${e2.body}`);
    }
  }
}

async function fetchPagos(socioId) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/pagos?select=*&socio_id=eq.${encodeURIComponent(socioId)}&order=created_at.desc`, { headers: authHeaders() });
  const txt = await res.text();
  if (!res.ok) throw new Error(txt || `fetchPagos failed: ${res.status}`);
  return JSON.parse(txt);
}

function updateSociosStats(rows) {
  const activos = rows.filter(r => (r.estado_operativo || '') === 'activo').length;
  const mora    = rows.filter(r => (r.estado_financiero || '') === 'mora').length;
  const vencer  = rows.filter(r => (r.estado_financiero || '') === 'proximo_vencer').length;
  const enBD    = rows.filter(r => !r._source).length;
  const enExcel = rows.filter(r =>  r._source === 'excel').length;
  document.getElementById('socStatTotal').textContent    = rows.length;
  document.getElementById('socStatActivos').textContent  = activos;
  document.getElementById('socStatMora').textContent     = mora;
  document.getElementById('socStatVencer').textContent   = vencer;
  const breakdown = document.getElementById('socStatBreakdown');
  if (breakdown) breakdown.textContent = `${enBD} en BD · ${enExcel} del Excel`;
}

function socioBadgeClass(type, val) {
  const v = (val || '').toLowerCase();
  if (['activo','al_dia'].includes(v)) return 'ok';
  if (['proximo_vencer','mantenimiento'].includes(v)) return 'warn';
  if (['mora','vencido','suspendido','inactivo'].includes(v)) return 'err';
  return 'info';
}

function renderSocios(rows) {
  const list = document.getElementById('sociosList');
  document.getElementById('socCount').textContent = `${rows.length} socio(s) visibles`;
  if (!rows.length) {
    list.innerHTML = '<div class="socios-empty">No hay socios que coincidan con los filtros.</div>';
    updateSociosStats(sociosRows);
    return;
  }
  list.innerHTML = rows.map((r, i) => {
    const isExcel  = r._source === 'excel';
    const srcBadge = isExcel
      ? '<span class="source-badge excel">📊 Excel</span>'
      : '<span class="source-badge db">🗄 BD</span>';
    const extraMeta = isExcel && r.notas_excel
      ? `<br>Notas: ${esc(r.notas_excel)}`
      : (r.telefono || r.email ? `<br>Tel: ${esc(r.telefono||'—')} · Email: ${esc(r.email||'—')}` : '');
    const actions = `<button class="uc-btn" onclick="selectSocio('${r.id}')">👁</button>
         ${socioCanEdit() ? `<button class="uc-btn" title="${isExcel?'Editar / guardar en BD':'Editar'}" onclick="editSocio('${r.id}')">✏️</button><button class="uc-btn del" onclick="deleteSocio('${r.id}','${esc(r.nombre_completo||'')}')">🗑</button>` : ''}`;
    return `
    <div class="socio-card ${selectedSocioId===r.id?'selected':''}" id="socio-${r.id}">
      <div class="socio-avatar" style="${isExcel?'background:linear-gradient(135deg,#0f6e56,#1d9e75)':''}">${esc((r.nombre_completo||'?')[0].toUpperCase())}</div>
      <div class="socio-main" onclick="selectSocio('${r.id}')" style="cursor:pointer;">
        <div class="socio-name">${esc(r.nombre_completo||'—')} ${srcBadge}</div>
        <div class="socio-meta">
          Ref/Código: <strong>${esc(r.codigo||'—')}</strong> · ${esc(r.tipo_membresia||'—')}<br>
          Vence: ${fmtDate(r.fecha_vencimiento)}${extraMeta}
        </div>
        <div class="badge-row">
          <span class="mini-badge ${socioBadgeClass('op', r.estado_operativo)}">${esc(r.estado_operativo||'—')}</span>
          <span class="mini-badge ${socioBadgeClass('fin', r.estado_financiero)}">${esc(r.estado_financiero||'—')}</span>
          ${r.activo ? '<span class="mini-badge ok">activo</span>' : '<span class="mini-badge err">inactivo</span>'}
        </div>
      </div>
      <div class="socio-actions">${actions}</div>
    </div>`;
  }).join('');
  updateSociosStats(sociosRows);
}

async function loadSocios() {
  const list = document.getElementById('sociosList');
  if (list && !list.dataset.searched) {
    list.innerHTML = '<div class="socios-prompt"><div class="socios-prompt-icon">🔍</div><div class="socios-prompt-text">Escribe en el buscador para encontrar socios</div><div class="socios-prompt-sub">La lista se muestra solo al buscar para proteger la privacidad</div></div>';
  }
  try {
    const dbRows = await fetchSocios();
    const excelRows = (data || []).map(r => ({
      id:               '__excel__' + r.referencia,
      _source:          'excel',
      nombre_completo:  r.socio || '—',
      codigo:           r.referencia || '',
      tipo_membresia:   r.departamento || '',
      fecha_inicio:     parseExcelDate(r.inicio),
      fecha_vencimiento:parseExcelDate(r.vencimiento),
      ultimo_pago:      r.ultimo_pago || null,
      estado_operativo: 'activo',
      estado_financiero:r.notas?.toLowerCase().includes('mora') ? 'mora' : 'al_dia',
      activo:           true,
      notas_excel:      r.notas || '',
      telefono:         null,
      email:            null,
    }));

    const dbCodigos = new Set((dbRows || []).map(r => (r.codigo || '').trim().toLowerCase()));
    const excelNuevos = excelRows.filter(r => r.codigo && !dbCodigos.has(r.codigo.trim().toLowerCase()));

    sociosRows = [...(dbRows || []), ...excelNuevos];
    sociosFiltered = [...sociosRows];
    updateSociosStats(sociosRows);
    document.getElementById('socCount').textContent = `${sociosRows.length} socios en total`;
    setSociosEditability();
  } catch (e) {
    const msg = e.message || '';
    const hint = msg.includes('406') ? 'Token inválido o expirado. Cierra sesión y vuelve a entrar.' :
                 msg.includes('403') ? 'Sin permisos. Verifica las políticas RLS en Supabase.' :
                 msg.includes('401') ? 'No autenticado. Por favor inicia sesión.' :
                 'Error al cargar socios. Revisa la consola del navegador para más detalles.';
    if (list) list.innerHTML = `<div class="socios-empty">⚠️ ${hint}</div>`;
  }
}

function setSociosEditability() {
  const disabled = !socioCanEdit();
  ['sCodigo','sTipo','sNombre','sDpi','sTelefono','sEmail','sInicio','sVencimiento','sDireccion','sEstadoOp','sEstadoFin','sComentarios'].forEach(id => {
    const el = document.getElementById(id); if (el) el.disabled = disabled;
  });
  const btn = document.getElementById('socioSaveBtn');
  if (btn) btn.style.display = socioCanEdit() ? 'block' : 'none';
  const pagoBtn = document.getElementById('pagoSaveBtn');
  if (pagoBtn) pagoBtn.style.display = socioCanEdit() ? 'block' : 'none';
}

function getSocioPayload() {
  return {
    codigo: document.getElementById('sCodigo').value.trim(),
    tipo_membresia: document.getElementById('sTipo').value.trim(),
    nombre_completo: document.getElementById('sNombre').value.trim(),
    dpi: document.getElementById('sDpi').value.trim() || null,
    telefono: document.getElementById('sTelefono').value.trim() || null,
    email: document.getElementById('sEmail').value.trim() || null,
    fecha_inicio: document.getElementById('sInicio').value || null,
    fecha_vencimiento: document.getElementById('sVencimiento').value || null,
    estado_operativo: document.getElementById('sEstadoOp').value,
    estado_financiero: document.getElementById('sEstadoFin').value,
    direccion: document.getElementById('sDireccion').value.trim() || null,
    comentarios: document.getElementById('sComentarios').value.trim() || null,
    activo: ['activo','mantenimiento'].includes(document.getElementById('sEstadoOp').value),
    updated_by: authUserId || null,
    ...(editingSocioId ? {} : { created_by: authUserId || null })
  };
}

async function saveSocio() {
  const btn = document.getElementById('socioSaveBtn');
  if (!socioCanEdit()) { showSocioMsg('err', 'Solo un administrador puede modificar socios.'); return; }
  const payload = getSocioPayload();
  if (!payload.codigo || !payload.nombre_completo || !payload.tipo_membresia) {
    showSocioMsg('err', 'Código, nombre y tipo de membresía son obligatorios.'); return;
  }
  const wasEditing = !!editingSocioId;
  btn.disabled = true; btn.textContent = 'Guardando…';

  try {
    if (!wasEditing) {
      const dupes = [];
      const checks = [
        payload.codigo    ? `codigo=eq.${encodeURIComponent(payload.codigo)}`       : null,
        payload.dpi       ? `dpi=eq.${encodeURIComponent(payload.dpi)}`             : null,
        payload.telefono  ? `telefono=eq.${encodeURIComponent(payload.telefono)}`   : null,
        payload.email     ? `email=eq.${encodeURIComponent(payload.email)}`         : null,
      ].filter(Boolean);

      for (const check of checks) {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/socios?select=id,nombre_completo,codigo&${check}&limit=1`, { headers: authHeaders() });
        if (r.ok) {
          const found = await r.json();
          if (found.length) {
            const field = check.split('=')[0];
            dupes.push(`${field}: "${found[0].nombre_completo || found[0].codigo}"`);
          }
        }
      }
      if (dupes.length) {
        showSocioMsg('err', `⚠️ Ya existe un socio con: ${dupes.join(', ')}. Verifica los datos.`);
        btn.disabled = false; btn.textContent = 'Guardar socio';
        return;
      }
    }

    const url = wasEditing
      ? `${SUPABASE_URL}/rest/v1/socios?id=eq.${encodeURIComponent(editingSocioId)}`
      : `${SUPABASE_URL}/rest/v1/socios`;
    const res = await fetch(url, {
      method: wasEditing ? 'PATCH' : 'POST',
      headers: { ...authHeaders(), 'Prefer': wasEditing ? 'return=minimal' : 'return=representation' },
      body: JSON.stringify(payload)
    });
    const txt = await res.text();
    if (!res.ok) { showSocioMsg('err', `Error ${res.status}: ${txt || 'No se pudo guardar.'}`); return; }

    const _wasNew = !wasEditing;
    showSocioMsg('ok', wasEditing ? '✅ Socio actualizado.' : '✅ Socio creado en la base de datos.');
    editingSocioId = null;
    resetSocioForm();
    await loadSocios();
    if (_wasNew) setTimeout(() => switchConfigTab('socios'), 1400);
  } catch(e) {
    showSocioMsg('err', 'Error inesperado al guardar socio.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Guardar socio';
  }
}

function showSocioMsg(type, text) {
  const el = document.getElementById('socioMsg');
  el.className = 'form-msg ' + type;
  el.textContent = text;
  if (type === 'ok') setTimeout(() => { el.className = 'form-msg'; el.textContent = ''; }, 4000);
}

async function editSocio(id) {
  if (!socioCanEdit()) return;
  const r = sociosRows.find(x => x.id === id);
  if (!r) return;
  if (r._source === 'excel') { await saveExcelSocioToDB(r); return; }
  editingSocioId = id;
  fillSocioForm(r);
  document.getElementById('socioFormTitle').textContent = `✏️ Editando: ${r.nombre_completo || ''}`;
  document.getElementById('socioSaveBtn').textContent   = 'Guardar cambios';
  switchConfigTab('nuevo');
  setTimeout(() => document.getElementById('sociosFormCard').scrollIntoView({ behavior:'smooth', block:'start' }), 150);
}

function fillSocioForm(r) {
  document.getElementById('sCodigo').value      = r.codigo           || '';
  document.getElementById('sTipo').value        = r.tipo_membresia   || '';
  document.getElementById('sNombre').value      = r.nombre_completo  || '';
  document.getElementById('sDpi').value         = r.dpi              || '';
  document.getElementById('sTelefono').value    = r.telefono         || '';
  document.getElementById('sEmail').value       = r.email            || '';
  document.getElementById('sInicio').value      = parseExcelDate(r.fecha_inicio) || r.fecha_inicio || '';
  document.getElementById('sVencimiento').value = parseExcelDate(r.fecha_vencimiento) || r.fecha_vencimiento || '';
  document.getElementById('sEstadoOp').value    = r.estado_operativo  || 'activo';
  document.getElementById('sEstadoFin').value   = r.estado_financiero || 'al_dia';
  document.getElementById('sDireccion').value   = r.direccion        || '';
  document.getElementById('sComentarios').value = r.comentarios || r.notas_excel || r.notas || '';
}

async function saveExcelSocioToDB(r) {
  const checkRes = await fetch(
    `${SUPABASE_URL}/rest/v1/socios?select=id,nombre_completo&codigo=eq.${encodeURIComponent(r.codigo)}&limit=1`,
    { headers: authHeaders() }
  );
  if (checkRes.ok) {
    const existing = await checkRes.json();
    if (existing.length) {
      const dbId = existing[0].id;
      const fullRes = await fetch(
        `${SUPABASE_URL}/rest/v1/socios?select=*&id=eq.${encodeURIComponent(dbId)}&limit=1`,
        { headers: authHeaders() }
      );
      if (fullRes.ok) {
        const rows = await fullRes.json();
        if (rows.length) {
          editingSocioId = dbId;
          fillSocioForm(rows[0]);
          document.getElementById('socioFormTitle').textContent = `✏️ Editando: ${rows[0].nombre_completo || ''}`;
          document.getElementById('socioSaveBtn').textContent   = 'Guardar cambios';
          showSocioMsg('info', 'ℹ️ Este socio ya estaba en la BD. Edita y guarda los cambios.');
          switchConfigTab('nuevo');
          setTimeout(() => document.getElementById('sociosFormCard').scrollIntoView({ behavior:'smooth', block:'start' }), 150);
          return;
        }
      }
    }
  }

  const payload = {
    codigo:            r.codigo            || '',
    nombre_completo:   r.nombre_completo   || '',
    tipo_membresia:    r.tipo_membresia    || '',
    fecha_inicio:      parseExcelDate(r.fecha_inicio),
    fecha_vencimiento: parseExcelDate(r.fecha_vencimiento),
    estado_operativo:  'activo',
    estado_financiero: (r.notas_excel||'').toLowerCase().includes('mora') ? 'mora' : 'al_dia',
    activo:            true,
    comentarios:       r.notas_excel       || null,
    created_by:        authUserId          || null,
    updated_by:        authUserId          || null,
  };

  const insRes = await fetch(`${SUPABASE_URL}/rest/v1/socios`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Prefer': 'return=representation' },
    body: JSON.stringify(payload)
  });

  if (!insRes.ok) {
    const err = await insRes.text();
    alert(`No se pudo guardar el socio en la BD: ${err}`);
    return;
  }

  const inserted = await insRes.json();
  const newId = Array.isArray(inserted) ? inserted[0]?.id : inserted?.id;

  await loadSocios();
  if (newId) {
    editingSocioId = newId;
    fillSocioForm(payload);
    document.getElementById('socioFormTitle').textContent = `✏️ Editando: ${payload.nombre_completo}`;
    document.getElementById('socioSaveBtn').textContent   = 'Guardar cambios';
    showSocioMsg('ok', '✅ Socio guardado en BD. Ahora puedes completar sus datos.');
    switchConfigTab('nuevo');
    setTimeout(() => document.getElementById('sociosFormCard').scrollIntoView({ behavior:'smooth', block:'start' }), 150);
  }
}

async function deleteSocio(id, nombre) {
  if (!socioCanEdit()) { alert('Solo un administrador puede eliminar socios.'); return; }
  const isExcel = String(id).startsWith('__excel__');

  if (isExcel) {
    const r = sociosRows.find(x => x.id === id);
    const codigo = r?.codigo || '';
    const checkRes = await fetch(
      `${SUPABASE_URL}/rest/v1/socios?select=id&codigo=eq.${encodeURIComponent(codigo)}&limit=1`,
      { headers: authHeaders() }
    );
    let dbId = null;
    if (checkRes.ok) {
      const found = await checkRes.json();
      if (found.length) dbId = found[0].id;
    }

    if (dbId) {
      if (!confirm(`¿Eliminar al socio "${nombre}" de la base de datos?\nEsta acción no se puede deshacer.`)) return;
      const delRes = await fetch(`${SUPABASE_URL}/rest/v1/socios?id=eq.${encodeURIComponent(dbId)}`, {
        method:'DELETE', headers: authHeaders()
      });
      if (!delRes.ok) { alert('No se pudo eliminar el socio de la BD.'); return; }
      showSocioMsg('ok', `✅ Socio "${nombre}" eliminado de la base de datos.`);
    } else {
      if (!confirm(`"${nombre}" solo existe en el Excel cargado, no en la BD.\n¿Ocultar de la lista en esta sesión?`)) return;
      sociosRows = sociosRows.filter(x => x.id !== id);
      sociosFiltered = sociosFiltered.filter(x => x.id !== id);
      renderSocios(sociosFiltered);
      return;
    }
  } else {
    if (!confirm(`¿Eliminar al socio "${nombre}"?\nEsta acción también quitará sus pagos registrados.`)) return;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/socios?id=eq.${encodeURIComponent(id)}`, {
      method:'DELETE', headers: authHeaders()
    });
    if (!res.ok) { alert('No se pudo eliminar el socio.'); return; }
  }

  if (selectedSocioId === id) { selectedSocioId = null; clearSocioDetail(); }
  await loadSocios();
}

async function selectSocio(id) {
  selectedSocioId = id;
  if (String(id).startsWith('__excel__')) {
    const r = sociosRows.find(x => x.id === id);
    if (!r) return;
    const det = document.getElementById('socioDetail');
    if (det) det.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px;">
        <div class="f wide"><div class="fl">Nombre</div><div class="fv">${esc(r.nombre_completo||'—')}</div></div>
        <div class="f wide"><div class="fl">Referencia</div><div class="fv">${esc(r.codigo||'—')}</div></div>
        <div class="f wide"><div class="fl">Departamento</div><div class="fv">${esc(r.tipo_membresia||'—')}</div></div>
        <div class="f"><div class="fl">Inicio</div><div class="fv">${fmtDate(r.fecha_inicio)}</div></div>
        <div class="f"><div class="fl">Vencimiento</div><div class="fv">${fmtDate(r.fecha_vencimiento)}</div></div>
        <div class="f"><div class="fl">Último pago</div><div class="fv">${esc(r.ultimo_pago||'—')}</div></div>
        <div class="f wide"><div class="fl">Notas</div><div class="fv">${esc(r.notas_excel||'—')}</div></div>
        <div style="margin-top:6px;padding:10px;background:#e8f5ee;border-radius:8px;font-size:.78rem;color:#166842;">
          📊 Este socio proviene del Excel. Para editarlo, primero cárgalo como socio en la base de datos.
        </div>
      </div>`;
    document.getElementById('payHint').textContent = 'Los socios del Excel no tienen pagos registrados en la base de datos.';
    const payList = document.getElementById('payList');
    if (payList) payList.innerHTML = '<div class="socios-empty">Socio de Excel — sin pagos en BD.</div>';
    return;
  }
  const r = sociosRows.find(x => x.id === id);
  if (!r) return;
  renderSocios(sociosFiltered.length ? sociosFiltered : sociosRows);
  const detail = document.getElementById('socioDetail');
  detail.innerHTML = `
    <div class="section-stack">
      <div>
        <div class="socio-name">${esc(r.nombre_completo || '—')}</div>
        <div class="socio-meta">Código: ${esc(r.codigo || '—')} · ${esc(r.tipo_membresia || '—')}</div>
        <div class="badge-row" style="margin-top:8px;">
          <span class="mini-badge ${socioBadgeClass('op', r.estado_operativo)}">${esc(r.estado_operativo || '—')}</span>
          <span class="mini-badge ${socioBadgeClass('fin', r.estado_financiero)}">${esc(r.estado_financiero || '—')}</span>
        </div>
      </div>
      <div class="muted-line">
        DPI: ${esc(r.dpi || '—')}<br>
        Teléfono: ${esc(r.telefono || '—')}<br>
        Email: ${esc(r.email || '—')}<br>
        Dirección: ${esc(r.direccion || '—')}<br>
        Inicio: ${fmtDate(r.fecha_inicio)} · Vencimiento: ${fmtDate(r.fecha_vencimiento)}
      </div>
      <div class="note-existing">${esc(r.comentarios || 'Sin comentarios.')}</div>
      <div class="sec-title">Historial de pagos</div>
      <div id="payList"><div class="socios-empty">Cargando pagos…</div></div>
    </div>`;
  document.getElementById('payHint').textContent = `Registrando pago para: ${r.nombre_completo || '—'}`;
  await loadPagosOfSelected();
}

function clearSocioDetail() {
  document.getElementById('socioDetail').innerHTML = 'Selecciona un socio para ver su ficha y sus pagos.';
  document.getElementById('payHint').textContent = 'Selecciona un socio para registrar pagos.';
}

async function loadPagosOfSelected() {
  if (!selectedSocioId) return;
  const wrap = document.getElementById('payList');
  if (!wrap) return;
  try {
    const rows = await fetchPagos(selectedSocioId);
    pagosRows = rows;
    if (!rows.length) {
      wrap.innerHTML = '<div class="socios-empty">Este socio no tiene pagos registrados.</div>';
      return;
    }
    wrap.innerHTML = rows.map(r => `
    <div class="pay-item">
      <div class="p1">Q ${Number(r.monto || 0).toFixed(2)} · ${esc(r.concepto || 'Pago')}</div>
      <div class="p2">${fmtDate(r.fecha_pago)} · ${esc(r.metodo_pago || 'Sin método')} · ${esc(r.estado_pago || '—')}<br>
      Período: ${fmtDate(r.periodo_desde)} a ${fmtDate(r.periodo_hasta)}<br>
      ${esc(r.comentario || '')}</div>
    </div>
  `).join('');
  } catch (e) {
    wrap.innerHTML = '<div class="socios-empty">No se pudieron cargar los pagos. Revisa la policy SELECT de public.pagos.</div>';
  }
}

async function savePago() {
  if (!socioCanEdit()) { showPagoMsg('err','Solo un administrador puede registrar pagos.'); return; }
  if (!selectedSocioId) { showPagoMsg('err','Selecciona un socio primero.'); return; }
  const fecha_pago = document.getElementById('pFecha').value;
  const monto = document.getElementById('pMonto').value;
  if (!fecha_pago || !monto) { showPagoMsg('err','Fecha y monto son obligatorios.'); return; }
  const btn = document.getElementById('pagoSaveBtn');
  btn.disabled = true; btn.textContent = 'Guardando…';
  const payload = {
    socio_id: selectedSocioId,
    fecha_pago,
    monto: Number(monto),
    metodo_pago: document.getElementById('pMetodo').value.trim() || null,
    concepto: document.getElementById('pConcepto').value.trim() || null,
    periodo_desde: document.getElementById('pDesde').value || null,
    periodo_hasta: document.getElementById('pHasta').value || null,
    comentario: document.getElementById('pComentario').value.trim() || null,
    estado_pago: 'aplicado',
    registrado_por: authUserId || null
  };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/pagos`, {
    method:'POST', headers:{ ...authHeaders(), 'Prefer':'return=representation' }, body: JSON.stringify(payload)
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    showPagoMsg('err', json?.message || 'No se pudo registrar el pago.');
    btn.disabled = false; btn.textContent = 'Registrar pago';
    return;
  }
  showPagoMsg('ok','✅ Pago registrado correctamente.');
  ['pFecha','pMonto','pMetodo','pConcepto','pDesde','pHasta','pComentario'].forEach(id => document.getElementById(id).value = '');
  await loadPagosOfSelected();
  btn.disabled = false; btn.textContent = 'Registrar pago';
}

function showPagoMsg(type, text) {
  const el = document.getElementById('pagoMsg');
  el.className = 'form-msg ' + type;
  el.textContent = text;
}

async function importExcelToDb() {
  if (!socioCanEdit()) { alert('Solo administradores pueden importar socios.'); return; }
  if (!data || !data.length) { alert('Primero carga un archivo Excel desde la pantalla principal.'); return; }
  if (!confirm(`¿Importar ${data.length} socios del Excel a la base de datos?\n\nSe crearán socios nuevos y se actualizarán los existentes por código de referencia.`)) return;

  const list = document.getElementById('sociosList');
  if (list) list.innerHTML = '<div class="socios-empty">⏳ Importando socios del Excel…</div>';

  const toUpsert = [];
  const skipped  = [];
  const seenCodes = new Set();

  data.forEach(r => {
    const codigo = (r.referencia || '').trim();
    if (!codigo) { skipped.push(`Sin código: ${r.socio}`); return; }
    if (seenCodes.has(codigo.toLowerCase())) { return; }
    seenCodes.add(codigo.toLowerCase());
    toUpsert.push({
      codigo,
      nombre_completo:   r.socio         || '',
      tipo_membresia:    r.departamento  || '',
      fecha_inicio:      parseExcelDate(r.inicio),
      fecha_vencimiento: parseExcelDate(r.vencimiento),
      estado_operativo:  'activo',
      estado_financiero: (r.notas||'').toLowerCase().includes('mora') ? 'mora' : 'al_dia',
      activo:            true,
      comentarios:       r.notas         || null,
      updated_by:        authUserId      || null,
      created_by:        authUserId      || null,
    });
  });

  if (!toUpsert.length) {
    showSocioMsg('ok', `✅ No hay socios válidos para importar. (${skipped.length} omitidos)`);
    await loadSocios(); return;
  }

  let processed = 0;
  const batchSize = 100;
  for (let i = 0; i < toUpsert.length; i += batchSize) {
    const batch = toUpsert.slice(i, i + batchSize);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/socios?on_conflict=codigo`, {
      method: 'POST',
      headers: {
        ...authHeaders(),
        'Prefer': 'return=minimal, resolution=merge-duplicates',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(batch)
    });
    if (res.ok) {
      processed += batch.length;
    } else {
      const errorText = await res.text();
      try {
        const errorJson = JSON.parse(errorText);
        showSocioMsg('err', `❌ Error en lote: ${errorJson.message || errorText}`);
      } catch(e) {
        showSocioMsg('err', `❌ Error en lote: ${res.status}`);
      }
    }
  }

  showSocioMsg('ok', `✅ ${processed} socios procesados (creados o actualizados). ${skipped.length} omitidos sin código.`);
  await loadSocios();
}

function exportSociosExcel() {
  const allRows = sociosRows.map(r => ({
    'referencia':          r.codigo                || r.referencia || '',
    'socio':               r.nombre_completo       || r.socio      || '',
    'departamento':        r.tipo_membresia        || r.departamento || '',
    'inicio':              fmtDateExport(r.fecha_inicio),
    'vencimiento':         fmtDateExport(r.fecha_vencimiento),
    'ultimo pago':         r.ultimo_pago           || '',
    'Ultimo año de pago':  r.ultimo_pago ? new Date(r.ultimo_pago).getFullYear() || '' : '',
    'Notas':               r.comentarios || r.notas_excel || r.notas || '',
  }));

  if (!allRows.length) { alert('No hay socios para exportar.'); return; }

  const headers = ['referencia','socio','departamento','inicio','vencimiento','ultimo pago','Ultimo año de pago','Notas'];
  const csvRows = [
    headers.join(','),
    ...allRows.map(r => headers.map(h => {
      const val = String(r[h] || '').replace(/"/g, '""');
      return val.includes(',') || val.includes('"') || val.includes('\n') ? `"${val}"` : val;
    }).join(','))
  ];
  const csv  = '\uFEFF' + csvRows.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `Cartera_Activa_VCA_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function fmtDateExport(val) {
  if (!val) return '';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  } catch(e) { return String(val); }
}

function applySociosFilters() {
  const list = document.getElementById('sociosList');
  if (list) list.dataset.searched = '1';
  const search   = (document.getElementById('socSearch')?.value || '').trim().toLowerCase();
  const tipo     = (document.getElementById('socTipo')?.value || '').trim().toLowerCase();
  const estadoOp = document.getElementById('socEstadoOp')?.value || '';
  const estadoFin= document.getElementById('socEstadoFin')?.value || '';

  sociosFiltered = sociosRows.filter(r => {
    if (search) {
      const hay = [r.nombre_completo, r.codigo, r.dpi, r.telefono, r.email, r.notas_excel, r.tipo_membresia]
        .map(v => (v || '').toLowerCase()).join(' ');
      if (!hay.includes(search)) return false;
    }
    if (tipo && !(r.tipo_membresia || '').toLowerCase().includes(tipo)) return false;
    if (estadoOp  && r.estado_operativo  !== estadoOp)  return false;
    if (estadoFin && r.estado_financiero !== estadoFin) return false;
    return true;
  });
  renderSocios(sociosFiltered);
}

function clearSociosFilters() {
  ['socSearch','socTipo'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  ['socEstadoOp','socEstadoFin'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  sociosFiltered = [...sociosRows];
  const list = document.getElementById('sociosList');
  if (list) {
    delete list.dataset.searched;
    list.innerHTML = '<div class="socios-prompt"><div class="socios-prompt-icon">🔍</div><div class="socios-prompt-text">Escribe en el buscador para encontrar socios</div><div class="socios-prompt-sub">La lista se muestra solo al buscar para proteger la privacidad</div></div>';
  }
  document.getElementById('socCount').textContent = `${sociosRows.length} socios en total`;
}

function resetSocioForm() {
  editingSocioId = null;
  ['sCodigo','sTipo','sNombre','sDpi','sTelefono','sEmail','sInicio','sVencimiento','sDireccion','sComentarios'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const op = document.getElementById('sEstadoOp'); if (op) op.value = 'activo';
  const fin = document.getElementById('sEstadoFin'); if (fin) fin.value = 'al_dia';
  const title = document.getElementById('socioFormTitle'); if (title) title.textContent = '➕ Nuevo socio';
  const btn = document.getElementById('socioSaveBtn'); if (btn) btn.textContent = 'Guardar socio';
  const msg = document.getElementById('socioMsg'); if (msg) { msg.textContent = ''; msg.className = 'form-msg'; }
}
