/* Bigorna Rooms v2 — the Workshop's heroes: each sheet changes one of the six heroes of the game while this map (or
   campaign) is played: name, portrait and animated figure. Their weapons have their own tab (armas.js). Only what
   differs from the game is stored and exported. */
'use strict';

/* the six heroes and the classes of their two weapons (WeaponClasses of the game) */
const HEROIS_JOGO = [
  { id: 'HERO_BRYNN', classes: [2, 3] }, { id: 'HERO_CHANCE', classes: [8, 9] }, { id: 'HERO_GALADEN', classes: [10, 11] },
  { id: 'HERO_KEHLI', classes: [0, 1] }, { id: 'HERO_SYRUS', classes: [6, 7] }, { id: 'HERO_VAERIX', classes: [4, 5] }];
const HEROIS_IDS = HEROIS_JOGO.map(h => h.id);   // (the order of the game's HeroEnum)
const NOME_CLASSE = ['Hammer', 'Crossbow', 'Sword', 'War hammer', 'Warbell', 'Spear', 'Wand', 'Staff', 'Gauntlet', 'Throwing knives', 'Blades', 'Bow', 'Rune'];
const SLOTS_ARMA = [['A', 'Heads: damage, damage types and the hero’s power'], ['B', 'Hafts: a chance ability on hits'], ['C', 'Grips: a chance ability on hits']];
let heroiSel = null;

const itemDoJogo = (() => { let m = null; return id => { if (!m) { m = {}; CAT.itens.forEach(i => { m[i._id] = i; }); } return m[id]; }; })();
const heroiDoJogo = id => CAT.herois.find(h => h._id === id);
const armaDaClasse = (() => { const m = new Map(); return k => { if (m.has(k)) return m.get(k); const w = CAT.itens.find(i => i._cls === 'WeaponModel' && i.Class === k && !i.IsGlobal); if (w) m.set(k, w); return w; }; })();   // asked many times per render (sorts, selects)
const pecasDaClasse = k => CAT.itens.filter(i => i._cls === 'WeaponPartsModel' && i.Class === k)
  .sort((a, b) => a.Slot - b.Slot || a._id.replace('_UPGRADED', '~').localeCompare(b._id.replace('_UPGRADED', '~'), undefined, { numeric: true }));
const habilidadeDe = p => p && p.Ability && p.Ability.id ? itemDoJogo(p.Ability.id) : null;
const automatica = p => { const a = habilidadeDe(p); return !!(p && (p.HasLogic || (a && a.EffectTiming))); };
const imagemDaPeca = p => p ? (RETRATOS.itens[chaveArte(p.ArmoryAssetPath || p.TextureAssetPath)] || '') : '';
const semGlifo = t => (t || '').replace(/[\uE000-\uF8FF]/g, '').replace(/\s+/g, ' ').trim();
/* a text of the game shown as plain text: no markup, no icon glyphs */
const textoDoJogo = t => semGlifo((t || '').replace(/<[^>]+>/g, ''));
const nomeDoHeroiJogo = id => heroiDoJogo(id)?.name_en || id.replace('HERO_', '');
const heroiEditado = id => (oficina().herois || []).find(h => h.id === id);
function heroiParaEditar(id) { let h = heroiEditado(id); if (!h) { h = { id }; oficina().herois.push(h); } return h; }
function retratoDoHeroi(id) { const h = heroiEditado(id); return (h && h.retrato) || (RETRATOS.herois || {})[id] || ''; }
function heroiMudou(h) { if (!h) return false; return !!(h.nome || h.retrato || h.voz || (h.arteModo === 'imagem' && h.arte)); }
const nomeDoHeroi = id => (heroiEditado(id)?.nome) || nomeDoHeroiJogo(id);
/* the two weapons each hero holds. Each of the twelve weapons has one holder (the game ties the parts of a weapon kind to
   one hero), so picking another hero's weapon hands him this one in exchange. Stored: only the heroes that differ. */
function maosAtuais() { const m = {}; HEROIS_JOGO.forEach(hj => { m[hj.id] = hj.classes.slice(); }); (oficina().maos || []).forEach(x => { if (m[x.id] && (x.classes || []).length === 2) m[x.id] = x.classes.slice(); }); return m; }
const maosDe = id => maosAtuais()[id] || [];
const donoDaClasse = k => { const m = maosAtuais(); return Object.keys(m).find(x => m[x].includes(k)); };
function trocarMao(hid, i, k) {
  const m = maosAtuais(); const velho = m[hid][i]; if (velho === k) return null; let outro = null;
  const j = m[hid].indexOf(k); if (j >= 0) m[hid][j] = velho; else { outro = Object.keys(m).find(x => m[x].includes(k)) || null; if (outro) m[outro][m[outro].indexOf(k)] = velho; }
  m[hid][i] = k; oficina().maos = HEROIS_JOGO.filter(hj => m[hj.id].join() !== hj.classes.join()).map(hj => ({ id: hj.id, classes: m[hj.id] }));
  return outro;
}

function renderHerois() {
  const esq = $('#esqF'); if (!heroiSel) heroiSel = HEROIS_JOGO[0].id;
  esq.innerHTML = `<div class="bloco"><h2>Heroes <span class="etq">${oficina().herois.filter(heroiMudou).length} changed</span></h2>
    <p class="ajuda">Each sheet changes one of the six heroes of the game while this ${campanha ? 'campaign' : 'map'} is played: name, portrait and animated figure. Their weapons are in the Weapons tab. What you leave as it is stays as in the game.</p><div id="f_lista"></div></div>`;
  const l = $('#f_lista');
  HEROIS_JOGO.forEach(hj => {
    const h = heroiEditado(hj.id); const d = document.createElement('div'); d.className = 'no' + (heroiSel === hj.id ? ' ativo' : '');
    const r = retratoDoHeroi(hj.id);
    d.innerHTML = `${r ? `<img class="face" src="${r}" alt="">` : '<span class="face"></span>'}<div><div>${esc((h && h.nome) || nomeDoHeroiJogo(hj.id))}</div><small>${maosDe(hj.id).map(k => NOME_CLASSE[k]).join(' · ')}${heroiMudou(h) ? ' · changed' : ''}</small></div>`;
    d.onclick = () => { heroiSel = hj.id; renderHerois(); }; l.appendChild(d);
  });
  fichaHeroi($('#centroF'), HEROIS_JOGO.find(x => x.id === heroiSel));
}

function fichaHeroi(c, hj) {
  const h = heroiEditado(hj.id) || { id: hj.id }; const nomeJogo = nomeDoHeroiJogo(hj.id);
  const retrato = retratoDoHeroi(hj.id);
  c.innerHTML = `<div class="cabF"><h2>${esc(h.nome || nomeJogo)} <span class="etq ${heroiMudou(h) ? 'custom' : ''}">${heroiMudou(h) ? 'changed' : 'as in the game'}</span></h2><div class="botoes">${heroiMudou(h) ? '<button class="sm perigo" id="fh_volta">Back to the game’s hero</button>' : ''}</div></div>
    <div class="folha"><div class="col">
      <label class="campo">Name <input id="fh_nome" value="${esc(h.nome || '')}" placeholder="${esc(nomeJogo)}"></label>
      <div class="sub">Portrait</div>
      <div class="retrato"><div class="quadro">${retrato ? `<img src="${retrato}" alt="">` : '<span>no portrait</span>'}</div><div>
        <label class="sm botaoArquivo">Upload PNG/JPG<input type="file" accept="image/png,image/jpeg,image/webp" id="fh_retrato" hidden></label>
        ${h.retrato ? '<button class="sm" data-espelhar="retrato">⇋ Mirror</button><button class="sm" id="fh_retratoJogo">Use the game’s</button>' : ''}
        <label class="chk"><input type="checkbox" id="fh_moldura" checked> Put it in the round frame, like the game’s</label>
        <p class="ajuda">Shown on the hero tabs, the hero choice and the hero screens. Square, 256 px or more. The strip shown in the shop and inventory is cut from the upper middle of it.</p></div></div>
      <div class="sub">Animated figure (attack window and hero screen)</div>
      <div class="botoes"><button class="sm ${h.arteModo === 'imagem' ? '' : 'ativo'}" data-harte="jogo">Animation of the game</button><button class="sm ${h.arteModo === 'imagem' ? 'ativo' : ''}" data-harte="imagem">My picture</button></div>
      ${h.arteModo === 'imagem' ? `<div class="retrato" style="margin-top:8px"><div class="quadro alto">${h.arte ? `<img src="${h.arte}" alt="">` : '<span>no picture</span>'}</div><div>
        <label class="sm botaoArquivo">Upload the picture (PNG)<input type="file" accept="image/png,image/webp,image/jpeg" id="fh_arte" hidden></label>${h.arte ? '<button class="sm" data-espelhar="arte">⇋ Mirror</button>' : ''}
        ${ajustesArte(h, true, k => 'id="fh_' + k + '"')}
        <p class="ajuda">Takes the place of the animated hero in the windows that show it. Transparent PNG, taller than wide.</p></div></div>` : '<p class="ajuda">The animated drawing of the game.</p>'}
      <div class="sub">Voice</div>
      <label class="campo">Voice <select id="fh_voz">${HEROIS_JOGO.map(x => `<option value="${x.id}" ${(h.voz || hj.id) === x.id ? 'selected' : ''}>${esc(nomeDoHeroiJogo(x.id))}${x.id === hj.id ? ' (own voice)' : ''}</option>`).join('')}</select></label>
      <p class="ajuda">The lines the hero says when attacking, wounded, receiving treasure, completing a feat, chosen for a quest, winning or losing. One of the six voices of the game (its Act II lines in Act II); the hero’s music theme goes with it.</p>
    </div><div class="col">
      <div class="sub">Weapons</div>
      <div class="duas">${[0, 1].map(i => `<label class="campo">Weapon ${i + 1} <select data-mao="${i}">${ARMAS_DOS_12().map(k => `<option value="${k}" ${maosDe(hj.id)[i] === k ? 'selected' : ''}>${esc(nomeDaArma(armaDaClasse(k)))} (${NOME_CLASSE[k]})${donoDaClasse(k) !== hj.id ? ' · now ' + esc(nomeDoHeroi(donoDaClasse(k))) + '’s' : ''}</option>`).join('')}</select></label>`).join('')}</div>
      <p class="ajuda">Each weapon has one hero in the game (its parts, the shop, the inventory and the feats follow it). Picking the weapon of another hero hands him this one in exchange. The numbers come from the weapons: they are changed in the Weapons tab.</p>
      ${oficina().maos.length ? '<p><button class="sm" id="fh_maosJogo">Game’s weapons for every hero</button></p>' : ''}
      ${maosDe(hj.id).map((k, i) => resumoArmaDoHeroi(k, i)).join('')}
    </div></div>`;
  const editar = () => heroiParaEditar(hj.id);
  const apos = () => renderHerois();
  $('#fh_nome').oninput = e => { const x = editar(); x.nome = e.target.value.trim(); if (!x.nome) delete x.nome; c.querySelector('h2').firstChild.textContent = (x.nome || nomeJogo) + ' '; renderListaHerois(); };
  $('#fh_retrato').onchange = async e => { const f = e.target.files[0]; if (!f) return; let img = await lerImagem(f, 256); if ($('#fh_moldura').checked) img = await emMoldura(img); editar().retrato = img; apos(); };
  const rj = $('#fh_retratoJogo'); if (rj) rj.onclick = () => { delete editar().retrato; apos(); };
  c.querySelectorAll('[data-harte]').forEach(b => b.onclick = () => { const x = editar(); x.arteModo = b.dataset.harte; if (x.arteModo === 'imagem' && !x.arte) aplicarPadraoArte(x, true); apos(); });
  const ua = $('#fh_arte'); if (ua) ua.onchange = async e => { const f = e.target.files[0]; if (!f) return; const x = editar(); if (!x.arte) aplicarPadraoArte(x, true); x.arte = await lerImagem(f, 768); apos(); };
  [['fh_esc', 'arteEscala'], ['fh_alt', 'arteAltura'], ['fh_lado', 'arteLado']].forEach(([el, k]) => { const s = $('#' + el); if (s) s.onchange = e => { editar()[k] = +e.target.value; }; });
  c.querySelectorAll('[data-espelhar]').forEach(b => b.onclick = async () => { const x = editar(); const campo = b.dataset.espelhar; if (!x[campo]) return; try { x[campo] = await espelharImagem(x[campo]); } catch { return aviso('Could not flip this picture.'); } apos(); });
  const volta = $('#fh_volta'); if (volta) volta.onclick = () => { if (!confirm('Undo every change to ' + nomeJogo + '?')) return; oficina().herois = oficina().herois.filter(x => x.id !== hj.id); renderHerois(); };
  c.querySelectorAll('[data-mao]').forEach(s => s.onchange = () => { const i = +s.dataset.mao; const velho = maosDe(hj.id)[i]; const outro = trocarMao(hj.id, i, +s.value); renderHerois(); if (outro) aviso(nomeDoHeroi(outro) + ' now holds the ' + nomeDaArma(armaDaClasse(velho)) + ' in exchange.'); });
  const mj = $('#fh_maosJogo'); if (mj) mj.onclick = () => { oficina().maos = []; renderHerois(); };
  $('#fh_voz').onchange = e => { const x = editar(); if (e.target.value === hj.id) delete x.voz; else x.voz = e.target.value; apos(); };
  c.querySelectorAll('[data-irarma]').forEach(b => b.onclick = () => { abaF = 'armas'; armaSel = b.dataset.irarma; pecaAberta = null; renderFichas(); });
}
function renderListaHerois() { const l = $('#f_lista'); if (!l) return; l.querySelectorAll('.no').forEach((d, i) => { const hj = HEROIS_JOGO[i]; const h = heroiEditado(hj.id); d.querySelector('div > div').textContent = (h && h.nome) || nomeDoHeroiJogo(hj.id); }); }

/* the portrait inside a round frame with studs, close to the game's look */
function emMoldura(src) {
  return new Promise(ok => { const i = new Image(); i.onload = () => { const L = 256, cv = document.createElement('canvas'); cv.width = cv.height = L; const g = cv.getContext('2d');
    const R = L / 2 - 14; g.save(); g.beginPath(); g.arc(L / 2, L / 2, R, 0, Math.PI * 2); g.clip(); const k = Math.max(2 * R / i.naturalWidth, 2 * R / i.naturalHeight); g.drawImage(i, L / 2 - i.naturalWidth * k / 2, L / 2 - i.naturalHeight * k / 2, i.naturalWidth * k, i.naturalHeight * k); g.restore();
    g.lineWidth = 12; g.strokeStyle = '#1e1b18'; g.beginPath(); g.arc(L / 2, L / 2, R + 4, 0, Math.PI * 2); g.stroke(); g.lineWidth = 3; g.strokeStyle = '#e8dcc3'; g.beginPath(); g.arc(L / 2, L / 2, R + 4, 0, Math.PI * 2); g.stroke();
    for (let a = 0; a < 16; a++) { const t = a * Math.PI / 8, x = L / 2 + Math.cos(t) * (R + 4), y = L / 2 + Math.sin(t) * (R + 4); g.fillStyle = '#e8dcc3'; g.beginPath(); g.arc(x, y, a % 2 ? 3 : 5, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#1e1b18'; g.lineWidth = 1.5; g.stroke(); }
    ok(cv.toDataURL('image/png')); }; i.onerror = () => ok(src); i.src = src; });
}

// ------------------------------------------------------------ export
/* only what differs from the game goes into the file (the weapons go apart: armasExportadas) */
function heroisExportados() {
  return oficina().herois.filter(heroiMudou).map(h => {
    const r = { id: h.id };
    if (h.nome) r.name = h.nome;
    if (h.retrato) r.portrait = h.retrato;
    if (h.voz) r.voice = h.voz;
    if (h.arteModo === 'imagem' && h.arte) Object.assign(r, { art: h.arte, artScale: h.arteEscala ?? 1, artRaise: h.arteAltura ?? 0, artShift: h.arteLado ?? 0 });
    return r;
  });
}
