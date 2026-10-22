/* Bigorna Rooms v2 — the Workshop's heroes: each sheet changes one of the six heroes of the game while this map (or
   campaign) is played: name, portrait and animated figure; or a hero of the roster plays one of the six profiles. Their weapons have their own tab (armas.js). Only what
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
/* the roster: heroes of the Workshop's own (made here, imported in a package or made from an NPC). Each may play one of the
   six profiles of the game (its class, weapons, skills and feats); a profile no hero of the roster plays is the game's hero,
   as the sheet of that hero leaves him */
const ehHeroiNovo = h => !!(h && h.novo);
const heroisNovos = () => (oficina().herois || []).filter(ehHeroiNovo);
const ocupanteDoPerfil = id => { const hid = equipeAtual()[id]; return hid ? heroisNovos().find(h => h.id === hid) || null : null; };
/* (one hero per profile: a second one, come in a package, goes back to the roster) */
function perfisUnicos() { const vistos = new Set(); heroisNovos().forEach(h => { if (!h.perfil) return; if (vistos.has(h.perfil) || !HEROIS_IDS.includes(h.perfil)) h.perfil = undefined; else vistos.add(h.perfil); }); }
/* the profile (the hero of the box) as itself, whoever of the roster plays it in this work: what the feats belong to */
const nomeDoPerfil = id => nomeDoHeroiJogo(id);
function retratoDoPerfil(id) { const h = heroiEditado(id); return (h && h.retrato) || (RETRATOS.herois || {})[id] || ''; }
function retratoDoHeroi(id) { const o = ocupanteDoPerfil(id); if (o) return o.retrato || ''; const h = heroiEditado(id); return (h && h.retrato) || (RETRATOS.herois || {})[id] || ''; }
function heroiMudou(h) { if (!h) return false; if (ehHeroiNovo(h)) return true; return !!(h.nome || h.retrato || h.voz || (h.arteModo === 'imagem' && h.arte)); }
const nomeDoHeroi = id => ocupanteDoPerfil(id)?.nome || (heroiEditado(id)?.nome) || nomeDoHeroiJogo(id);
const perfilNome = id => nomeDoHeroiJogo(id) + ' (' + maosDe(id).map(k => NOME_CLASSE[k]).join(' · ') + ')';
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
  perfisUnicos();
  const esq = $('#esqF'); const ids = new Set(HEROIS_IDS.concat(heroisNovos().map(h => h.id), [EQUIPE, PERICIAS], HEROIS_IDS.map(h => PROEZAS + h), HEROIS_IDS.map(h => PERICIAS + h))); if (!heroiSel || !ids.has(heroiSel)) heroiSel = HEROIS_JOGO[0].id;
  esq.innerHTML = `<div class="bloco"><h2>Heroes <span class="etq">${heroisNovos().length} in the roster</span></h2>
    <p class="ajuda">The six profiles of the game (class, weapons, skills and feats) go into the ${campanha ? 'campaign' : 'map'}. Each is played by the game’s hero (as in the game) or by a hero of your roster, put in it on the hero’s own sheet.</p>
    <button class="sm botaoEquipe ${heroiSel === EQUIPE || String(heroiSel).startsWith(PROEZAS) || String(heroiSel).startsWith(PERICIAS) ? 'ativo' : ''}" id="fh_equipe" title="${esc(tr('The six heroes side by side; change any of them for a hero of the roster'))}"><span aria-hidden="true">👥</span> ${campanha ? 'In the campaign' : 'In the map'}</button><div id="f_lista"></div>
    <div class="sub">Roster</div><div id="f_rol"></div>${heroisNovos().length ? `<p class="ajuda">${campanha ? tr('To put a hero of the roster in the campaign: on its sheet, pick its Profile (or, on the sheet of a game hero, pick who plays it).') : tr('To put a hero of the roster in the map: on its sheet, pick its Profile (or, on the sheet of a game hero, pick who plays it).')}</p>` : ''}
    <div class="botoes"><button class="sm primario" id="fh_novo">+ New hero</button><button class="sm" id="fh_doNpc">From an NPC…</button>${botaoLote()}</div></div>`;
  const l = $('#f_lista');
  HEROIS_JOGO.forEach(hj => {
    const o = ocupanteDoPerfil(hj.id); const h = heroiEditado(hj.id); const quem = o ? o.id : hj.id; const d = document.createElement('div'); d.className = 'no' + (heroiSel === quem ? ' ativo' : '');
    const r = retratoDoHeroi(hj.id);
    d.innerHTML = `${r ? `<img class="face" loading="lazy" decoding="async" ${imgTardia(r)} alt="">` : '<span class="face"></span>'}<div><div>${esc(nomeDoHeroi(hj.id))}</div><small>${o ? esc(tr('profile') + ' ' + nomeDoHeroiJogo(hj.id)) + ' · ' : ''}${maosDe(hj.id).map(k => NOME_CLASSE[k]).join(' · ')}${!o && heroiMudou(h) ? ' · changed' : ''}</small></div>`;
    d.onclick = () => { heroiSel = quem; renderHerois(); }; l.appendChild(d);
  });
  const rol = $('#f_rol'); const fora = heroisNovos().filter(h => !h.perfil).concat(HEROIS_JOGO.filter(hj => ocupanteDoPerfil(hj.id)).map(hj => ({ id: hj.id, jogo: true })));
  if (!fora.length) rol.innerHTML = `<p class="ajuda">${tr('No hero out of the profiles. New heroes, the heroes of an imported package and those made from an NPC wait here until they get a profile.')}</p>`;
  fora.forEach(x => { const d = document.createElement('div'); d.className = 'no' + (heroiSel === x.id ? ' ativo' : '');
    const r = x.jogo ? ((heroiEditado(x.id) || {}).retrato || (RETRATOS.herois || {})[x.id] || '') : (x.retrato || '');
    d.innerHTML = `${r ? `<img class="face" loading="lazy" decoding="async" ${imgTardia(r)} alt="">` : '<span class="face"></span>'}<div><div>${esc(x.jogo ? (heroiEditado(x.id)?.nome || nomeDoHeroiJogo(x.id)) : (x.nome || tr('New hero')))}</div><small>${x.jogo ? esc(tr('the game’s hero, out: another plays this profile')) : esc(tr('not in the profiles'))}</small></div>`;
    d.onclick = () => { heroiSel = x.id; renderHerois(); }; rol.appendChild(d); });
  $('#fh_novo').onclick = () => { const h = { id: 'HN_' + uid(), novo: true, nome: tr('New hero') }; const livre = HEROIS_IDS.find(id => !ocupanteDoPerfil(id)); oficina().herois.push(h); heroiSel = h.id; renderHerois(); if (livre) aviso(tr('Pick its profile on the sheet: the hero takes the class, weapons, skills and feats of the game hero it replaces.')); };
  $('#fh_doNpc').onclick = () => heroiDeNpc();
  $('#fh_equipe').onclick = () => { heroiSel = EQUIPE; renderHerois(); };
  if (heroiSel === EQUIPE) { equipeDeHerois($('#centroF')); return; }
  if (String(heroiSel).startsWith(PROEZAS)) { painelDeProezas($('#centroF'), heroiSel.slice(PROEZAS.length)); return; }
  if (String(heroiSel).startsWith(PERICIAS)) { painelDePericias($('#centroF'), heroiSel.slice(PERICIAS.length)); return; }
  const novo = heroisNovos().find(h => h.id === heroiSel);
  if (novo) { fichaHeroi($('#centroF'), novo.perfil ? HEROIS_JOGO.find(x => x.id === novo.perfil) : null, novo); setTimeout(() => primeiraVista(novo), 0); }
  else fichaHeroi($('#centroF'), HEROIS_JOGO.find(x => x.id === heroiSel), null);
}
/* the party: the six profiles side by side, each with the figure of who plays it (the game's hero or one of the roster);
   each can be changed for a hero of the roster, as on the hero's own sheet */
const EQUIPE = '@equipe';
function figuraDoHeroi(hjId) {
  const o = ocupanteDoPerfil(hjId); const x = o || heroiEditado(hjId);
  if (x && x.arteModo === 'imagem' && x.arte) return { src: x.arte, corpo: true };
  if (o) return { src: o.retrato || '', corpo: false };
  const j = heroiDoJogo(hjId); const d = j && (RETRATOS.personagens || {})[j._name + '_Dialogue'];
  return d ? { src: d, corpo: true } : { src: retratoDoHeroi(hjId), corpo: false };
}
function equipeDeHerois(c) {
  const rol = heroisNovos(); const trocados = HEROIS_JOGO.filter(hj => ocupanteDoPerfil(hj.id)).length;
  // (a group picture: the six standing together, the back row a step higher and smaller, each with its name below)
  const pos = [[9, 0], [25, 1], [41, 0], [59, 1], [75, 0], [91, 1]];
  c.innerHTML = `<div class="cabF"><h2>${esc(tr(campanha ? 'The party of the campaign' : 'The party of the map'))} <span class="etq ${trocados ? 'custom' : ''}">${trocados ? esc(trocados + ' ' + tr(trocados > 1 ? 'heroes of the roster' : 'hero of the roster')) : esc(tr('as in the game'))}</span></h2></div>
    <p class="ajuda">${esc(tr('The six heroes the players choose from. Click one to change it for a hero of the roster, who takes the class, the two weapons, the skills and the feats of that profile.'))}</p>
    <div class="equipeWrap"><div class="fotoEquipe"><div class="chaoEquipe"></div>${HEROIS_JOGO.map((hj, i) => { const o = ocupanteDoPerfil(hj.id); const f = figuraDoHeroi(hj.id); const [x, tras] = pos[i];
      const nome = nomeDoHeroi(hj.id);
      return `<button class="membro${tras ? ' tras' : ''}${o ? ' trocado' : ''}${f.corpo ? '' : ' camafeu'}" data-membro="${hj.id}" style="left:${x}%" title="${esc(nome)}">
        <span class="corpo">${f.src ? `<img loading="lazy" decoding="async" ${imgTardia(f.src)} alt="">` : `<i>${esc((nome || '?').slice(0, 1).toUpperCase())}</i>`}</span></button>
        <button class="placa${o ? ' trocado' : ''}" data-membro="${hj.id}" data-placa style="left:${x}%"><b>${esc(nome)}</b><small>${o ? esc(tr('profile') + ' ' + nomeDoHeroiJogo(hj.id)) : maosDe(hj.id).map(k => esc(tr(NOME_CLASSE[k]))).join(' · ')}</small></button>`; }).join('')}
      </div><div class="linhaProezas">${HEROIS_JOGO.map((hj, i) => { const n = facanhasDoHeroi(hj.id).length; const ruins = facanhasDoHeroi(hj.id).filter(id => avisoDeArmaDaFacanha(id, hj.id)).length;
        return `<button class="sm definirProezas ${ruins ? 'erro' : ''}" data-proezas="${hj.id}" style="left:${pos[i][0]}%" title="${esc(ruins ? tr('A feat of this hero asks for a weapon the hero does not use') : tr('The feats the game offers this hero'))}">✦ ${esc(tr('Define feats'))}${n ? ` <span class="etq">${n}</span>` : ''}</button>`; }).join('')}</div>
      <div class="linhaProezas">${HEROIS_JOGO.map((hj, i) => `<button class="sm definirProezas" data-pericias="${hj.id}" style="left:${pos[i][0]}%" title="${esc(tr('The skills of this hero, by XP'))}">❖ ${esc(tr('Define skills'))} <span class="etq">${periciasDoHeroi(hj.id).length}</span></button>`).join('')}</div>
      ${periciasDoHeroi('').length ? `<p class="ajuda"><a href="#" id="fh_semHeroi">${esc(tr('Skills with no hero (cards only)'))}: ${periciasDoHeroi('').length}</a></p>` : ''}<div class="escolhaHeroi" hidden></div></div>`;
  const foto = c.querySelector('.fotoEquipe'), pop = c.querySelector('.escolhaHeroi');
  const fechar = () => { pop.hidden = true; foto.classList.remove('escolhendo'); foto.querySelectorAll('.aberto').forEach(m => m.classList.remove('aberto')); };
  const trocar = (id, v) => { const antes = ocupanteDoPerfil(id); if (antes) antes.perfil = undefined;
    const x = v ? rol.find(h => h.id === v) : null; const deixou = x && x.perfil && x.perfil !== id ? x.perfil : null;
    if (x) x.perfil = id; renderHerois();
    aviso(x ? (x.nome || tr('New hero')) + ' ' + tr('now plays the profile of') + ' ' + nomeDoHeroiJogo(id) + '.' + (deixou ? ' ' + nomeDoHeroiJogo(deixou) + ' ' + tr('is back in the profile.') : '') : nomeDoHeroiJogo(id) + ' ' + tr('is back in the profile.')); };
  const figura = id => foto.querySelector('.membro[data-membro="' + id + '"]');
  foto.querySelectorAll('[data-placa]').forEach(p => { p.onmouseenter = () => figura(p.dataset.membro).classList.add('luz'); p.onmouseleave = () => figura(p.dataset.membro).classList.remove('luz'); });
  foto.querySelectorAll('[data-membro]').forEach(bb => bb.onclick = ev => { ev.stopPropagation(); const id = bb.dataset.membro; const b = figura(id);
    if (b.classList.contains('aberto')) return fechar();
    fechar(); b.classList.add('aberto'); foto.querySelector('[data-placa][data-membro="' + id + '"]').classList.add('aberto'); foto.classList.add('escolhendo');
    const atual = ocupanteDoPerfil(id); const rj = (heroiEditado(id) || {}).retrato || (RETRATOS.herois || {})[id] || '';
    const chip = (val, img, nome, nota, ativo) => `<button class="chipHeroi${ativo ? ' ativo' : ''}" data-quem="${esc(val)}" title="${esc(nome + (nota ? ' · ' + nota : ''))}">${img ? `<img loading="lazy" decoding="async" ${imgTardia(img)} alt="">` : `<i>${esc((nome || '?').slice(0, 1).toUpperCase())}</i>`}<span>${esc(nome)}</span>${nota ? `<small>${esc(nota)}</small>` : ''}</button>`;
    pop.innerHTML = `<div class="tit">${esc(tr('Who plays the profile of') + ' ' + nomeDoHeroiJogo(id))}</div>
      <div class="chips">${chip('', rj, nomeDoHeroiJogo(id), tr('the game’s hero'), !atual)}${rol.map(h => chip(h.id, h.retrato || '', h.nome || tr('New hero'), h.perfil && h.perfil !== id ? tr('now in') + ' ' + nomeDoHeroiJogo(h.perfil) : '', h.perfil === id)).join('')}</div>
      ${rol.length ? '' : `<p class="ajuda">${esc(tr('The roster is empty: make heroes with “+ New hero” or “From an NPC…” on the left.'))}</p>`}
      <div class="rodapeEscolha"><button class="sm" data-ficha="${esc(atual ? atual.id : id)}">${esc(tr('Open the sheet'))}</button></div>`;
    // (the window under the picture, its arrow pointing at the figure)
    const r = b.getBoundingClientRect(), rf = foto.getBoundingClientRect(); pop.hidden = false;
    const meio = r.left - rf.left + r.width / 2; const L = Math.max(0, Math.min(rf.width - pop.offsetWidth, meio - pop.offsetWidth / 2));
    pop.style.left = L + 'px'; pop.style.setProperty('--seta', (meio - L) + 'px');
    pop.querySelectorAll('[data-quem]').forEach(q => q.onclick = e => { e.stopPropagation(); const v = q.dataset.quem; if ((atual ? atual.id : '') === v) return fechar(); trocar(id, v); });
    pop.querySelector('[data-ficha]').onclick = e => { e.stopPropagation(); heroiSel = e.currentTarget.dataset.ficha; renderHerois(); };
  });
  pop.onclick = e => e.stopPropagation(); foto.onclick = fechar; c.querySelector('.cabF').onclick = fechar;
  c.querySelectorAll('[data-proezas]').forEach(b => b.onclick = e => { e.stopPropagation(); abrirProezas(b.dataset.proezas); });
  c.querySelectorAll('[data-pericias]').forEach(b => b.onclick = e => { e.stopPropagation(); abrirPericias(b.dataset.pericias); });
  const sh = c.querySelector('#fh_semHeroi'); if (sh) sh.onclick = e => { e.preventDefault(); e.stopPropagation(); abrirPericias(''); };
}
/* a hero of the roster made from an NPC of the Workshop (a package of heroes that came in as NPCs, for instance): its name,
   portrait and description; the NPC's picture, whole, becomes its animated figure */
function heroiDeNpc() {
  const npcs = bestiario().personagens || []; if (!npcs.length) return aviso(tr('The Workshop has no NPC yet.'));
  modal(tr('A hero from an NPC'), `<p class="ajuda">${tr('Tick the NPCs that become heroes of the roster (the NPCs stay as they are). Then give each one a profile on its sheet.')}</p>
    <div style="max-height:52vh;overflow:auto">${npcs.map((p, i) => { const r = retratoDoPersonagem(p); return `<label class="chk">${r ? `<img loading="lazy" decoding="async" ${imgTardia(r)} alt="" style="width:28px;height:28px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:6px">` : ''}<input type="checkbox" data-i="${i}"> ${esc(p.nome || '')}</label>`; }).join('')}</div>
    <div class="rodape"><button data-o="cancel">Cancel</button><button class="primario" data-o="ok">Make heroes</button></div>`, (el, fechar) => {
    el.querySelector('[data-o="cancel"]').onclick = fechar;
    el.querySelector('[data-o="ok"]').onclick = async () => { const marcadas = [...el.querySelectorAll('[data-i]:checked')].map(c => npcs[+c.dataset.i]); if (!marcadas.length) return aviso(tr('Tick at least one NPC.'));
      // (the NPC's picture is the hero's animated figure, whole; the portrait is its upper part, in the round frame)
      fechar(); let ult = null;
      for (const p of marcadas) { const h = { id: 'HN_' + uid(), novo: true, nome: p.nome || tr('New hero'), deNpc: p.id }; const r = retratoDoPersonagem(p);
        if (r) { h.arte = r; h.arteModo = 'imagem'; aplicarPadraoArte(h, true); try { h.retrato = await emMoldura(await parteDeCima(r)); } catch { h.retrato = r; } }
        if (p.desc) h.desc = p.desc; oficina().herois.push(h); ult = h; }
      heroiSel = ult.id; renderHerois(); aviso(marcadas.length + ' ' + tr(marcadas.length > 1 ? 'heroes in the roster.' : 'hero in the roster.')); };
  });
}

/* the sheet of a hero: one of the game's (hj, novo null) or one of the roster (novo; hj is the profile it plays, or null) */
function fichaHeroi(c, hj, novo) {
  const h = novo || heroiEditado(hj.id) || { id: hj.id }; const nomeJogo = novo ? tr('New hero') : nomeDoHeroiJogo(hj.id);
  const retrato = novo ? (novo.retrato || '') : ((heroiEditado(hj.id) || {}).retrato || (RETRATOS.herois || {})[hj.id] || '');
  const fora = !novo && ocupanteDoPerfil(hj.id);
  const etq = novo ? (novo.perfil ? tr('plays the profile of') + ' ' + nomeDoHeroiJogo(novo.perfil) : tr('in the roster')) : fora ? tr('out: played by') + ' ' + (fora.nome || '') : heroiMudou(h) ? 'changed' : 'as in the game';
  // (the sheet of a game hero chooses who plays its profile: the game hero, or a hero of the roster)
  const quemJoga = !novo ? `<div class="sub">Profile</div>
      <label class="campo">Who plays this profile <select id="fh_quem"><option value="">${esc(nomeDoHeroiJogo(hj.id))} (${esc(tr('the game’s hero'))})</option>${heroisNovos().map(x => `<option value="${x.id}" ${x.perfil === hj.id ? 'selected' : ''}>${esc(x.nome || tr('New hero'))}${x.perfil && x.perfil !== hj.id ? ' · ' + esc(tr('now in the profile of') + ' ' + nomeDoHeroiJogo(x.perfil)) : ''}</option>`).join('')}</select></label>
      <p class="ajuda">${heroisNovos().length ? tr('Pick a hero of the roster to play this profile in the place of the game’s hero.') : tr('Make heroes with “+ New hero” or “From an NPC…” on the left; they can then play this profile.')}</p>` : '';
  const perfil = novo ? `<div class="sub">Profile</div>
      <label class="campo">Profile in the ${campanha ? 'campaign' : 'map'} <select id="fh_perfil"><option value="">${tr('None: stays in the roster')}</option>${HEROIS_JOGO.map(x => { const o = ocupanteDoPerfil(x.id); return `<option value="${x.id}" ${novo.perfil === x.id ? 'selected' : ''}>${esc(perfilNome(x.id))}${o && o !== novo ? ' · ' + esc(tr('now') + ' ' + (o.nome || '')) : ''}</option>`; }).join('')}</select></label>
      <p class="ajuda">The hero takes the place of a game hero: the class, the two weapons, the skills and the feats of that profile, and its place in the hero choice. A hero already there goes back to the roster.</p>` : '';
  // (a hero of the game only reads: name, voice and weapons as in the game; the pictures and who plays its profile stay open)
  const oficialMudou = !novo && !!(h.nome || h.voz || (oficina().maos || []).some(x => x && x.id === hj.id));
  c.innerHTML = `<div class="cabF"><h2>${esc(h.nome || nomeJogo)} <span class="etq ${heroiMudou(h) ? 'custom' : ''}">${esc(etq)}</span></h2><div class="botoes">${novo ? '<button class="sm perigo" id="fh_apagar">Delete hero</button>' : `<button class="sm primario" id="fh_dup">⧉ ${esc(tr('Duplicate'))}</button>` + (heroiMudou(h) ? '<button class="sm" id="fh_volta">↺ Back to the game’s hero</button>' : '')}</div></div>
    ${novo ? '' : avisoOficial(oficialMudou ? 'This hero was changed by an older version of the editor: “↺ Back to the game’s hero” undoes it.' : '', 'The portrait, the picture and who plays its profile may change here; a duplicate is a hero of the roster, to put in a profile.')}
    <div class="folha"><div class="col">
      <label class="campo">Name <input id="fh_nome" value="${esc(novo ? (novo.nome || '') : (h.nome || ''))}" placeholder="${esc(nomeJogo)}"></label>
      ${perfil}${quemJoga}
      <div class="sub">Portrait</div>
      <div class="retrato"><div class="quadro">${retrato ? `<img loading="lazy" decoding="async" ${imgTardia(retrato)} alt="">` : '<span>no portrait</span>'}</div><div>
        <label class="sm botaoArquivo">Upload PNG/JPG<input type="file" accept="image/png,image/jpeg,image/webp" id="fh_retrato" hidden></label>
        ${retrato ? `<button class="sm" data-ajustar="retrato" title="${esc(tr('Size, position and mirror of the picture'))}">✎ ${esc(tr('Adjust'))}</button>` : ''}${h.retrato && !novo ? '<button class="sm" id="fh_retratoJogo">Use the game’s</button>' : ''}${fonteDoCampo(h, 'arte') && !h.retratoDaArte ? `<button class="sm" id="fh_retratoArte" title="${esc(tr('The portrait cut from the picture of the figure; ✎ Adjust fits it'))}">${esc(tr('Use the picture of the hero'))}</button>` : ''}
        <label class="chk"><input type="checkbox" id="fh_moldura" ${h.semMoldura ? '' : 'checked'}> Put it in the round frame, like the game’s</label>
        <p class="ajuda">Shown on the hero tabs, the hero choice and the hero screens. Square, 256 px or more. The strip shown in the shop and inventory is cut from the upper middle of it.</p>${h.retratoDaArte ? '<p class="ajuda">Made from the picture of the hero (below): ✎ Adjust fits it in the portrait.</p>' : ''}</div></div>
      <div class="sub">Animated figure (attack window and hero screen)</div>
      <div class="botoes"><button class="sm ${h.arteModo === 'imagem' ? '' : 'ativo'}" data-harte="jogo">Animation of the game</button><button class="sm ${h.arteModo === 'imagem' ? 'ativo' : ''}" data-harte="imagem">My picture</button></div>
      ${h.arteModo === 'imagem' ? `<div class="retrato" style="margin-top:8px"><div class="quadro alto">${h.arte ? `<img loading="lazy" decoding="async" ${imgTardia(h.arte)} alt="">` : '<span>no picture</span>'}</div><div>
        <label class="sm botaoArquivo">Upload the picture (PNG)<input type="file" accept="image/png,image/webp,image/jpeg" id="fh_arte" hidden></label>${h.arte ? `<button class="sm" data-ajustar="arte" title="${esc(tr('Size, position and mirror of the picture'))}">✎ ${esc(tr('Adjust'))}</button>` : ''}
        ${ajustesArte(h, true, k => 'id="fh_' + k + '"')}
        <p class="ajuda">Takes the place of the animated hero in the windows that show it. Transparent PNG, taller than wide.</p></div></div>` : `<p class="ajuda">${novo ? 'The animated drawing of the game hero of its profile.' : 'The animated drawing of the game.'}</p>`}
      <div class="sub">Voice</div>
      <label class="campo">Voice <select id="fh_voz">${HEROIS_JOGO.map(x => { const propria = hj ? hj.id : null; return `<option value="${x.id}" ${(h.voz || propria || HEROIS_JOGO[0].id) === x.id ? 'selected' : ''}>${esc(nomeDoHeroiJogo(x.id))}${x.id === propria ? ' ' + tr(novo ? '(the profile’s)' : '(own voice)') : ''}</option>`; }).join('')}</select></label>
      <p class="ajuda">The lines the hero says when attacking, wounded, receiving treasure, completing a feat, chosen for a quest, winning or losing. One of the six voices of the game (its Act II lines in Act II); the hero’s music theme goes with it.</p>
      ${novo && novo.desc ? `<div class="sub">Notes</div><p class="ajuda">${esc(novo.desc)}</p>` : ''}
    </div><div class="col">
      <div class="sub">Weapons</div>
      ${hj ? `<div class="duas">${[0, 1].map(i => `<label class="campo">Weapon ${i + 1} <select data-mao="${i}">${ARMAS_DOS_12().map(k => `<option value="${k}" ${maosDe(hj.id)[i] === k ? 'selected' : ''}>${esc(nomeDaArma(armaDaClasse(k)))} (${NOME_CLASSE[k]})${donoDaClasse(k) !== hj.id ? ' · now ' + esc(nomeDoHeroi(donoDaClasse(k))) : ''}</option>`).join('')}</select></label>`).join('')}</div>
      <p class="ajuda">Each weapon has one hero in the game (its parts, the shop, the inventory and the feats follow it). Picking the weapon of another hero hands him this one in exchange. The numbers come from the weapons: they are changed in the Weapons tab.${novo ? ' The weapons belong to the profile: they stay with it if the hero leaves.' : ''}</p>
      ${oficina().maos.length ? '<p><button class="sm" id="fh_maosJogo">Game’s weapons for every hero</button></p>' : ''}
      ${maosDe(hj.id).map((k, i) => resumoArmaDoHeroi(k, i)).join('')}
      ${rolDeProezas(hj.id)}${rolDePericias(hj.id)}` : `<p class="ajuda">${tr('A hero of the roster gets the weapons of the profile it plays. Pick a profile on the left.')}</p>`}
    </div></div>`;
  const editar = () => novo || heroiParaEditar(hj.id);
  const apos = () => renderHerois();
  $('#fh_nome').oninput = e => { const x = editar(); x.nome = e.target.value.trim(); if (!x.nome && !novo) delete x.nome; c.querySelector('h2').firstChild.textContent = (x.nome || nomeJogo) + ' '; renderListaHerois(); const noRol = document.querySelector('#f_rol .no.ativo > div > div'); if (novo && noRol) noRol.textContent = x.nome || nomeJogo; };
  const qj = $('#fh_quem'); if (qj) qj.onchange = e => { const v = e.target.value; const antes = ocupanteDoPerfil(hj.id); if (antes) antes.perfil = undefined;
    const x = v ? heroisNovos().find(h => h.id === v) : null; if (x) { x.perfil = hj.id; heroiSel = x.id; } else heroiSel = hj.id; renderHerois();
    aviso(x ? (x.nome || tr('New hero')) + ' ' + tr('now plays the profile of') + ' ' + nomeDoHeroiJogo(hj.id) + '.' : nomeDoHeroiJogo(hj.id) + ' ' + tr('is back in the profile.')); };
  const pf = $('#fh_perfil'); if (pf) pf.onchange = e => { const v = e.target.value; const antes = v ? ocupanteDoPerfil(v) : null; if (antes && antes !== novo) antes.perfil = undefined; if (v) novo.perfil = v; else novo.perfil = undefined; apos(); if (antes && antes !== novo) aviso((antes.nome || tr('New hero')) + ' ' + tr('went back to the roster.')); };
  $('#fh_retrato').onchange = async e => { const f = e.target.files[0]; if (!f) return; await retratoDeArquivo(editar(), f, 256, $('#fh_moldura').checked); apos(); };
  // (the frame: kept for the next portrait; the portrait now is made again in it, or without it)
  $('#fh_moldura').onchange = async e => { const x = editar(); if (e.target.checked) delete x.semMoldura; else x.semMoldura = true;
    const fonte = x.retratoDaArte ? fonteDoCampo(x, 'arte') : (x.fontes || {}).retrato; if (fonte && x.retrato) { const a = (x.ajustes || {}).retrato || await ajusteDeRetrato(fonte, 256, 256); x.retrato = await assarAjuste(fonte, 256, 256, a); if (!x.semMoldura) x.retrato = await emMoldura(x.retrato); apos(); } };
  const rj = $('#fh_retratoJogo'); if (rj) rj.onclick = () => { const x = editar(); delete x.retrato; delete x.retratoDaArte; esquecerAjuste(x, 'retrato'); apos(); };
  const ra = $('#fh_retratoArte'); if (ra) ra.onclick = async () => { const x = editar(); await retratoDaArte(x, 256, !x.semMoldura); apos(); };   // (v241)
  c.querySelectorAll('[data-harte]').forEach(b => b.onclick = () => { const x = editar(); x.arteModo = b.dataset.harte; if (x.arteModo === 'imagem' && !x.arte) aplicarPadraoArte(x, true); apos(); });
  // (the picture of the hero: its portrait is made from it, when it has none of its own)
  const ua = $('#fh_arte'); if (ua) ua.onchange = async e => { const f = e.target.files[0]; if (!f) return; const x = editar(); if (!x.arte) aplicarPadraoArte(x, true); x.arte = await lerImagem(f, 768); esquecerAjuste(x, 'arte');
    if (!x.retrato || x.retratoDaArte) await retratoDaArte(x, 256, !x.semMoldura); apos(); };
  [['fh_esc', 'arteEscala'], ['fh_alt', 'arteAltura'], ['fh_lado', 'arteLado']].forEach(([el, k]) => { const s = $('#' + el); if (s) s.onchange = e => { editar()[k] = +e.target.value; }; });
  c.querySelectorAll('[data-ajustar]').forEach(b => b.onclick = () => { const x = editar(); const campo = b.dataset.ajustar;
    // (a portrait of its own or made from the picture: adjusted in the round frame; the game's portrait as it is)
    const proprio = campo === 'retrato' && (x.retratoDaArte || (x.fontes || {}).retrato);
    abrirAjuste(x, campo, apos, campo === 'retrato' ? { lado: 256, fonte: retrato, redondo: proprio && !x.semMoldura, moldura: proprio && !x.semMoldura } : {}); });
  const volta = $('#fh_volta'); if (volta) volta.onclick = () => { if (!confirm('Undo every change to ' + nomeJogo + '?')) return; oficina().herois = oficina().herois.filter(x => x.id !== hj.id); renderHerois(); };
  const apaga = $('#fh_apagar'); if (apaga) apaga.onclick = () => { if (!confirm(tr('Delete') + ' ' + (novo.nome || tr('New hero')) + '?')) return; oficina().herois = oficina().herois.filter(x => x !== novo); heroiSel = null; renderHerois(); };
  c.querySelectorAll('[data-mao]').forEach(s => s.onchange = () => { const i = +s.dataset.mao; const velho = maosDe(hj.id)[i]; const outro = trocarMao(hj.id, i, +s.value); renderHerois(); if (outro) aviso(nomeDoHeroi(outro) + ' now holds the ' + nomeDaArma(armaDaClasse(velho)) + ' in exchange.'); });
  const mj = $('#fh_maosJogo'); if (mj) mj.onclick = () => { oficina().maos = []; renderHerois(); };
  $('#fh_voz').onchange = e => { const x = editar(); if (!novo && e.target.value === hj.id) delete x.voz; else x.voz = e.target.value; apos(); };
  c.querySelectorAll('[data-irarma]').forEach(b => b.onclick = () => { abaF = 'armas'; armaSel = b.dataset.irarma; pecaAberta = null; renderFichas(); });
  c.querySelectorAll('[data-rolp]').forEach(b => b.onclick = () => abrirProezas(hj.id, b.dataset.rolp || null));
  c.querySelectorAll('[data-rolk]').forEach(b => b.onclick = () => { const p = b.dataset.rolk ? periciaDaChave(hj.id, b.dataset.rolk) : null; abrirPericias(hj.id, p ? p.id : null); });
  if (novo) return;
  travarOficial(c, '.retrato, [data-harte], #fh_quem, [data-irarma], [data-ajustar], #fh_moldura, #fh_maosJogo, .rolProezas, .rolPericias');
  // (the duplicate: a hero of the roster with this one's name, pictures and voice; it gets a profile on its sheet)
  $('#fh_dup').onclick = () => { const nome = nomeDaCopia(h.nome || nomeJogo, HEROIS_JOGO.map(x => nomeDoHeroi(x.id)).concat(heroisNovos().map(x => x.nome)), 'Name of the new hero (different from the original’s):'); if (!nome) return;
    const d = { id: 'HN_' + uid(), novo: true, nome, voz: h.voz || hj.id };
    ['retrato', 'retratoDaArte', 'semMoldura', 'arte', 'arteModo', 'arteEscala', 'arteAltura', 'arteLado', 'fontes', 'ajustes'].forEach(k => { if (h[k] !== undefined) d[k] = clone(h[k]); });
    if (!d.retrato && retrato) d.retrato = retrato;
    oficina().herois.push(d); heroiSel = d.id; renderHerois(); aviso(tr('Duplicated: this one is yours to change. Pick its profile on its sheet.')); };
}
function renderListaHerois() { const l = $('#f_lista'); if (!l) return; l.querySelectorAll('.no').forEach((d, i) => { const hj = HEROIS_JOGO[i]; d.querySelector(':scope > div > div').textContent = nomeDoHeroi(hj.id); }); }

/* the portrait of a whole figure: a square of its upper part (where the face is), as wide as the picture; a picture about
   as wide as tall is kept whole */
function parteDeCima(src) {
  return new Promise((ok, erro) => { const i = new Image(); i.onload = () => { const w = i.naturalWidth, h = i.naturalHeight; if (h < w * 1.15) return ok(src);
    const L = Math.min(512, w), cv = document.createElement('canvas'); cv.width = cv.height = L; cv.getContext('2d').drawImage(i, 0, Math.round(h * 0.03), w, w, 0, 0, L, L); ok(cv.toDataURL('image/png')); };
    i.onerror = erro; i.src = original(src); });
}
/* the portrait inside a round frame with studs, close to the game's look */
function emMoldura(src) {
  return new Promise(ok => { const i = new Image(); i.onload = () => { const L = 256, cv = document.createElement('canvas'); cv.width = cv.height = L; const g = cv.getContext('2d');
    const R = L / 2 - 14; g.save(); g.beginPath(); g.arc(L / 2, L / 2, R, 0, Math.PI * 2); g.clip(); const k = Math.max(2 * R / i.naturalWidth, 2 * R / i.naturalHeight); g.drawImage(i, L / 2 - i.naturalWidth * k / 2, L / 2 - i.naturalHeight * k / 2, i.naturalWidth * k, i.naturalHeight * k); g.restore();
    g.lineWidth = 12; g.strokeStyle = '#1e1b18'; g.beginPath(); g.arc(L / 2, L / 2, R + 4, 0, Math.PI * 2); g.stroke(); g.lineWidth = 3; g.strokeStyle = '#e8dcc3'; g.beginPath(); g.arc(L / 2, L / 2, R + 4, 0, Math.PI * 2); g.stroke();
    for (let a = 0; a < 16; a++) { const t = a * Math.PI / 8, x = L / 2 + Math.cos(t) * (R + 4), y = L / 2 + Math.sin(t) * (R + 4); g.fillStyle = '#e8dcc3'; g.beginPath(); g.arc(x, y, a % 2 ? 3 : 5, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#1e1b18'; g.lineWidth = 1.5; g.stroke(); }
    ok(cv.toDataURL('image/png')); }; i.onerror = () => ok(src); i.src = original(src); });
}

// ------------------------------------------------------------ export
/* only what differs from the game goes into the file (the weapons go apart: armasExportadas) */
function heroisExportados() {
  perfisUnicos();
  const arte = (h, r) => { if (h.arteModo === 'imagem' && h.arte) Object.assign(r, { art: h.arte, artScale: h.arteEscala ?? 1, artRaise: h.arteAltura ?? 0, artShift: h.arteLado ?? 0 }); return r; };
  return HEROIS_JOGO.map(hj => {
    // (a profile played by a hero of the roster: that hero, under the id of the game hero it replaces)
    const o = ocupanteDoPerfil(hj.id);
    if (o) { const r = { id: hj.id, name: o.nome || tr('New hero') }; if (o.retrato) r.portrait = o.retrato; if (o.voz && o.voz !== hj.id) r.voice = o.voz; return arte(o, r); }
    const h = heroiEditado(hj.id); if (!heroiMudou(h)) return null;
    const r = { id: h.id };
    if (h.nome) r.name = h.nome;
    if (h.retrato) r.portrait = h.retrato;
    if (h.voz) r.voice = h.voz;
    return arte(h, r);
  }).filter(Boolean);
}
