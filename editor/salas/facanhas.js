/* Bigorna Rooms v2 — the Workshop's feats: the goals each hero pursues during the quests (attack with a spear 5 times,
   open 3 chests…), counted by the game itself, with rewards when completed (skill cards, recipes). The game's feats can be
   imported and changed, new ones written for any hero. The feat pool limits what the game offers: for each hero with a feat
   in the pool, only the pool's feats are offered (the ones already in progress keep going). */
'use strict';

const MOMENTOS_FACANHA = [[1, 'After the hero attacks'], [10, 'After the hero’s attack is resolved'], [2, 'After a monster attacks'], [3, 'When the hero is hurt'], [4, 'When a monster is defeated'],
  [5, 'When the hero interacts (tokens, doors, chests…)'], [9, 'After an attack or an interaction'], [6, 'When the party gains items'], [7, 'At the end of each round'], [8, 'At the end of the quest']];
const TIPOS_ITEM_FACANHA = ['Materials', 'Consumables', 'Armor', 'Trinkets', 'Weapon parts', 'Recipes'];
const OBJETOS_FACANHA = ['Any', 'Chest', 'Shelf', 'Lectern', 'Well', 'Cauldron', 'Door', 'Sight token', 'Bell', 'Blood shrine', 'Fire', 'Ladder', 'Statue', 'Wagon', 'Vault', 'Platform'];
const CONDICOES_FACANHA = [[1, 'Dazed'], [2, 'Enfeebled'], [4, 'Afflicted'], [8, 'Slowed'], [16, 'Exposed'], [32, 'Doomed'], [64, 'Confused']];
const SAUDE_FACANHA = [[1, 'a minor injury'], [2, 'a major injury'], [3, 'defeated']];
const facanhaDoJogo = id => (CAT.facanhas || []).find(f => f._id === id);
/* the game's text of a feat: "<b>Name</b>: what to do" */
function partesDoTexto(t) { const m = (t || '').match(/^\s*<b>([\s\S]*?)<\/b>\s*:?\s*([\s\S]*)$/); return m ? { nome: m[1].trim(), corpo: m[2].trim() } : { nome: '', corpo: (t || '').trim() }; }
const nomeFacanha = f => f.nome || '(no name)';
function nomeDoPremio(id) {
  if (typeof id === 'string' && id.startsWith('RECEITA:')) { const r = (oficina().receitas || []).find(x => x.id === id.slice(8)); return r ? nomeReceita(r) : 'a recipe (gone)'; }
  const n = nomeDePericiaPorId(id); return n ? tr('Skill card') + ': ' + n : id;
}

function filtrosDoJogo(c) {
  const on = k => c[k] && c[k].Enable;
  return { armas: on('WeaponClasses') ? [...c.WeaponClasses.Value] : null, inimigos: on('EnemyTypes') ? [...c.EnemyTypes.Value] : null, itens: on('ItemType') ? [...c.ItemType.Value] : null,
    objeto: on('InteractableType') ? c.InteractableType.Value : null, condicao: on('EnemyConditions') ? c.EnemyConditions.Value : null,
    lesao: on('HeroInjured') ? { valor: c.HeroInjured.Value, inverso: !!c.HeroInjured.InvertCondition } : null,
    danoTotal: !!on('GoalIsTotalDamage'), fraqueza: !!on('WeaknessDamage'), vitoria: on('IsVictory') ? !!c.IsVictory.Value : null,
    danoMinimo: on('MinimumDamage') ? c.MinimumDamage.Value : 0, mesmoInimigo: on('SameEnemy') ? !!c.SameEnemy.Value : null };
}
function facanhaDoCatalogo(c) {
  const { nome, corpo } = partesDoTexto(c.desc_en);
  return { id: 'B_' + uid(), base: c._id, custom: false, nome: nome || c._id, texto: corpo, heroi: c.HeroSource?.id || HEROIS_IDS[0], meta: c.Goal || 1, momento: c.Timing || 1,
    filtros: filtrosDoJogo(c), precisa: c.AmountCompletedRequired || 0, ato: c._act || 0, premios: null, premiosJogo: (c.Rewards || []).map(r => r && r.id).filter(Boolean), outrosPremios: (c.Rewards || []).filter(r => !r || !r.id).length };
}
function novaFacanha() {
  const f = { id: 'B_' + uid(), base: null, custom: true, nome: tr('New feat'), texto: tr('Attack with your spear.'), heroi: HEROIS_IDS[0], meta: 3, momento: 1,
    filtros: { armas: null, inimigos: null, itens: null, objeto: null, condicao: null, lesao: null, danoTotal: false, fraqueza: false, vitoria: null, danoMinimo: 0, mesmoInimigo: null }, precisa: 0, ato: 0, premios: [] };
  oficina().facanhas.push(f); abaF = 'facanhas'; fichaSel = f.id; renderFichas();
}

function renderFacanhas() {
  const lista = oficina().facanhas; if (fichaSel && !lista.some(x => x.id === fichaSel)) fichaSel = null;
  const esq = $('#esqF');
  esq.innerHTML = `<div class="bloco"><h2>Feats <span class="etq">${lista.length}</span></h2>
    <div class="botoes"><button class="sm" id="f_importarF">Import…</button><button class="sm primario" id="f_novaF">+ New feat</button></div>
    <p class="ajuda">A feat is a goal a hero pursues during the quests (attack with a spear 5 times, open 3 chests…). The game counts it by itself and gives the reward when it is done. Import the game’s feats to change them, or write new ones for any hero.</p>
    <div id="f_lista"></div></div>
    <div class="bloco"><h2>Feat pool</h2><p class="ajuda">For each hero with a feat here, the game offers only these (the feats already in progress keep going). Heroes with none here keep the game’s feats.</p><div id="f_poolF"></div></div>`;
  const l = $('#f_lista');
  HEROIS_IDS.forEach(h => {
    const doH = lista.filter(f => f.heroi === h); if (!doH.length) return;
    const t = document.createElement('div'); t.className = 'sub pequena'; t.textContent = nomeDoHeroi(h); l.appendChild(t);
    doH.forEach(f => {
      const d = document.createElement('div'); d.className = 'no' + (fichaSel === f.id ? ' ativo' : ''); const r = retratoDoHeroi(f.heroi);
      d.innerHTML = `${r ? `<img class="face" src="${r}" alt="">` : '<span class="face"></span>'}<div><div>${esc(nomeFacanha(f))}</div><small>${esc(resumoFacanha(f))}${f.base ? (f.custom ? ' · changed' : ' · from the game') : ' · custom'}${(oficina().poolFacanhas || []).includes(f.id) ? ' · in the pool' : ''}</small></div>`;
      d.onclick = () => { fichaSel = f.id; renderFacanhas(); }; l.appendChild(d);
    });
  });
  if (!lista.length) l.innerHTML = '<p class="ajuda">Nothing yet.</p>';
  widgetPoolFacanhas($('#f_poolF'));
  $('#f_importarF').onclick = importarFacanha; $('#f_novaF').onclick = novaFacanha;
  const f = lista.find(x => x.id === fichaSel); const c = $('#centroF');
  if (!f) { c.innerHTML = '<div class="vazio"><h2>Feats</h2><p>Pick a feat on the left, import one from the game, or write a new one.</p></div>'; return; }
  fichaFacanha(c, f);
}
function resumoFacanha(f) { const m = MOMENTOS_FACANHA.find(x => x[0] === f.momento); return (f.filtros?.danoTotal ? f.meta + ' damage' : f.meta + '×') + ' · ' + (m ? m[1].toLowerCase() : '?'); }

/* the pool: workshop feats and feats of the game not imported */
function widgetPoolFacanhas(el) {
  const pool = oficina().poolFacanhas = oficina().poolFacanhas || [];
  const oficinaF = oficina().facanhas;
  const nomeNoPool = id => { const f = oficinaF.find(x => x.id === id); if (f) return nomeDoHeroi(f.heroi) + ': ' + nomeFacanha(f); const c = facanhaDoJogo(id); return c ? nomeDoHeroi(c.HeroSource?.id) + ': ' + (partesDoTexto(c.desc_en).nome || id) + ' (game)' : id; };
  const importadas = new Set(oficinaF.map(f => f.base).filter(Boolean));
  const opcoes = HEROIS_IDS.map(h => { const ws = oficinaF.filter(f => f.heroi === h && !pool.includes(f.id)); const gs = (CAT.facanhas || []).filter(c => c.HeroSource?.id === h && !importadas.has(c._id) && !pool.includes(c._id));
    return ws.length + gs.length ? `<optgroup label="${esc(nomeDoHeroi(h))}">${ws.map(f => `<option value="${esc(f.id)}">${esc(nomeFacanha(f))} (workshop)</option>`).join('')}${gs.map(c => `<option value="${esc(c._id)}">${esc(partesDoTexto(c.desc_en).nome || c._id)} (game)</option>`).join('')}</optgroup>` : ''; }).join('');
  el.innerHTML = `<div class="linha"><select class="poolAdd"><option value="">+ add a feat…</option>${opcoes}</select>${oficinaF.some(f => !pool.includes(f.id)) ? '<button class="sm" data-todas>All workshop feats</button>' : ''}</div>
    <div>${pool.map((id, i) => `<span class="tag">${esc(nomeNoPool(id))} <a href="#" data-pooldel="${i}">✕</a></span>`).join('') || '<span class="ajuda">empty: the game offers its own feats</span>'}</div>`;
  el.querySelector('.poolAdd').onchange = e => { if (e.target.value && !pool.includes(e.target.value)) pool.push(e.target.value); renderFacanhas(); };
  const t = el.querySelector('[data-todas]'); if (t) t.onclick = () => { oficinaF.forEach(f => { if (!pool.includes(f.id)) pool.push(f.id); }); renderFacanhas(); };
  el.querySelectorAll('[data-pooldel]').forEach(a => a.onclick = ev => { ev.preventDefault(); pool.splice(+a.dataset.pooldel, 1); renderFacanhas(); });
}

function importarFacanha() {
  const ja = new Set(oficina().facanhas.map(f => f.base));
  const lista = (CAT.facanhas || []).slice().sort((a, b) => HEROIS_IDS.indexOf(a.HeroSource?.id) - HEROIS_IDS.indexOf(b.HeroSource?.id) || (a._act - b._act) || (partesDoTexto(a.desc_en).nome || '').localeCompare(partesDoTexto(b.desc_en).nome || ''));
  modalImportacao('Import feats of the game', lista.map(c => ({ c, nome: nomeDoHeroi(c.HeroSource?.id) + ': ' + (partesDoTexto(c.desc_en).nome || c._id), img: retratoDoHeroi(c.HeroSource?.id), sub: (ACT_NOME[c._act || 0] || '') + ' · ' + semTagsFacanha(partesDoTexto(c.desc_en).corpo).slice(0, 90), ja: ja.has(c._id) })), escolhidas => {
    const novas = escolhidas.map(({ c }) => facanhaDoCatalogo(c)); novas.forEach(f => oficina().facanhas.push(f)); if (novas[0]) fichaSel = novas[0].id; renderFacanhas();
    aviso(novas.length === 1 ? 'Feat imported. Change it if you like.' : novas.length + ' feats imported.');
  }, [{ nome: 'Act', opcoes: [[0, ACT_NOME[0]], [1, ACT_NOME[1]]], de: e => e.c._act || 0 },
      { nome: 'Hero', opcoes: HEROIS_IDS.map(h => [h, nomeDoHeroi(h)]), de: e => e.c.HeroSource?.id || '' },
      { nome: 'When', opcoes: MOMENTOS_FACANHA.map(([v, n]) => [v, n]), de: e => e.c.Timing || 1 }]);
}
const semTagsFacanha = t => (t || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

function fichaFacanha(c, f) {
  const x = f.filtros; const mudou = () => { f.custom = true; };
  const marcas = (lista, sel, chave) => `<div class="marcas">${lista.map((n, i) => `<label class="chk"><input type="checkbox" data-mf="${chave}" value="${i}" ${(sel || []).includes(i) ? 'checked' : ''}> ${esc(String(n).replace(/([a-z])([A-Z])/g, '$1 $2'))}</label>`).join('')}</div>`;
  const premios = f.premios || f.premiosJogo || [];
  const skillsDoHeroi = periciasParaPremio(f.heroi);
  c.innerHTML = `<div class="cabF"><h2>${esc(nomeFacanha(f))} ${etiquetaEstado(f)}</h2><div class="botoes"><button class="sm perigo" id="ff_apaga">Delete</button></div></div>
    <div class="folha"><div class="col">
      <div class="duas"><label class="campo">Name <input id="ff_nome" value="${esc(f.nome || '')}"></label>
      <label class="campo">Hero <select id="ff_heroi">${HEROIS_IDS.map(h => `<option value="${h}" ${f.heroi === h ? 'selected' : ''}>${esc(nomeDoHeroi(h))}</option>`).join('')}</select></label></div>
      <div id="ff_texto"></div>
      <div class="previaTx" id="ff_previa"></div>
      <div class="sub">How it counts</div>
      <div class="duas"><label class="campo">When <select id="ff_momento">${MOMENTOS_FACANHA.map(([v, n]) => `<option value="${v}" ${f.momento === v ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
      <label class="campo">${x.danoTotal ? 'Damage in total' : 'Times'} <input type="number" min="1" id="ff_meta" value="${f.meta || 1}" style="width:80px"></label></div>
      <label class="chk"><input type="checkbox" id="ff_dano" ${x.danoTotal ? 'checked' : ''}> Count the damage dealt instead of the times</label>
      <label class="chk"><input type="checkbox" id="ff_fraq" ${x.fraqueza ? 'checked' : ''}> Only damage from weaknesses</label>
      <label class="campo">Minimum damage of the attack <input type="number" min="0" id="ff_min" value="${x.danoMinimo || 0}" style="width:80px"> <small class="ajuda">0: any</small></label>
      <div class="sub">Only if</div>
      <p class="ajuda">Leave everything empty to count every time. Ticked boxes limit what counts.</p>
      <div class="campo">With these weapons ${marcas(CLASSES_ARMA, x.armas, 'armas')}</div>
      <div class="campo">Against these monsters ${marcas(TIPOS_MONSTRO, x.inimigos, 'inimigos')}</div>
      <div class="campo">Gaining these items ${marcas(TIPOS_ITEM_FACANHA, x.itens, 'itens')}</div>
      <div class="duas"><label class="campo">Interacting with <select id="ff_obj">${OBJETOS_FACANHA.map((n, i) => `<option value="${i === 0 ? '' : i}" ${(x.objeto ?? '') === (i === 0 ? '' : i) ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
      <label class="campo">The monster has <select id="ff_cond"><option value="">Any condition</option>${CONDICOES_FACANHA.map(([v, n]) => `<option value="${v}" ${x.condicao === v ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label></div>
      <div class="duas"><label class="campo">The hero has <select id="ff_lesao"><option value="">Any health</option>${SAUDE_FACANHA.map(([v, n]) => `<option value="${v}" ${x.lesao && !x.lesao.inverso && x.lesao.valor === v ? 'selected' : ''}>${esc(n)}</option><option value="!${v}" ${x.lesao && x.lesao.inverso && x.lesao.valor === v ? 'selected' : ''}>not ${esc(n)}</option>`).join('')}</select></label>
      <label class="campo">The quest ends in <select id="ff_vit"><option value="">Anything</option><option value="1" ${x.vitoria === true ? 'selected' : ''}>Victory</option><option value="0" ${x.vitoria === false ? 'selected' : ''}>Defeat</option></select></label></div>
      <label class="campo">Monsters <select id="ff_mesmo"><option value="">Any</option><option value="1" ${x.mesmoInimigo === true ? 'selected' : ''}>The same monster every time</option><option value="0" ${x.mesmoInimigo === false ? 'selected' : ''}>A different monster each time</option></select></label>
      ${f.base ? '<p class="ajuda">Other finer conditions of this feat in the game (first attack of the round, other heroes…) are kept as they are.</p>' : ''}
      <div class="sub">Offered</div>
      <div class="duas"><label class="campo">After how many completed feats of this hero <input type="number" min="0" id="ff_precisa" value="${f.precisa || 0}" style="width:80px"></label>
      <label class="campo">From <select id="ff_ato"><option value="0" ${!f.ato ? 'selected' : ''}>Act I</option><option value="1" ${f.ato === 1 ? 'selected' : ''}>Act II</option></select></label></div>
      <div class="sub">Reward</div>
      <div id="ff_premios">${premios.map((id, i) => `<span class="tag">${esc(nomeDoPremio(id))} <a href="#" data-premiodel="${i}">✕</a></span>`).join('') || '<span class="ajuda">No reward.</span>'}${!f.premios && f.outrosPremios ? ` <span class="ajuda">+ ${f.outrosPremios} reward(s) of the game kept as they are (recipes, legends…).</span>` : ''}</div>
      <select id="ff_premio"><option value="">+ add a reward…</option>${skillsDoHeroi.length ? `<optgroup label="Skill cards of ${esc(nomeDoHeroi(f.heroi))}">${skillsDoHeroi.map(s => `<option value="${esc(s.id)}">${esc(s.nome)}</option>`).join('')}</optgroup>` : ''}${(oficina().receitas || []).length ? `<optgroup label="Recipes of the workshop">${oficina().receitas.map(r => `<option value="RECEITA:${esc(r.id)}">${esc(nomeReceita(r))}</option>`).join('')}</optgroup>` : ''}</select>
      <p class="ajuda">A skill card is unlocked for the hero (the physical card at the table); a recipe is learned by the party.</p>
    </div></div>`;
  /* how the feat reads in the game: the Name (in bold) and "What the hero must do", both edited above; follows the typing */
  const previa = () => { const el = $('#ff_previa'); if (el) el.innerHTML = '<div class="rotuloTx">In the feats window (the Name and “What the hero must do” above):</div>' + previaDoJogo('<b>' + esc(f.nome || '') + '</b>: ' + (f.texto || ''), []); };
  editorDeDescricao($('#ff_texto'), f, 'texto', 'What the hero must do', () => { mudou(); previa(); });
  previa();
  const re = () => { mudou(); renderFacanhas(); };
  $('#ff_nome').oninput = e => { f.nome = e.target.value; mudou(); previa(); };
  // the new name goes to the title and the list without redrawing the sheet (a redraw here ate the next click)
  $('#ff_nome').onchange = () => { const a = document.querySelector('#f_lista .no.ativo > div > div'); if (a) a.textContent = nomeFacanha(f); const h = c.querySelector('h2'); if (h && h.firstChild) h.firstChild.textContent = nomeFacanha(f) + ' '; };
  $('#ff_heroi').onchange = e => { f.heroi = e.target.value; if (f.premios) f.premios = f.premios.filter(id => { const h = heroiDaPericiaPorId(id); return !h || h === f.heroi; }); re(); };
  $('#ff_momento').onchange = e => { f.momento = +e.target.value; re(); };
  $('#ff_meta').oninput = e => { f.meta = Math.max(1, +e.target.value || 1); mudou(); };
  $('#ff_dano').onchange = e => { x.danoTotal = e.target.checked; re(); };
  $('#ff_fraq').onchange = e => { x.fraqueza = e.target.checked; mudou(); };
  $('#ff_min').oninput = e => { x.danoMinimo = Math.max(0, +e.target.value || 0); mudou(); };
  c.querySelectorAll('[data-mf]').forEach(cb => cb.onchange = () => { const k = cb.dataset.mf; const v = [...c.querySelectorAll(`[data-mf="${k}"]:checked`)].map(z => +z.value); x[k] = v.length ? v : null; mudou(); });
  $('#ff_obj').onchange = e => { x.objeto = e.target.value === '' ? null : +e.target.value; mudou(); };
  $('#ff_cond').onchange = e => { x.condicao = e.target.value === '' ? null : +e.target.value; mudou(); };
  $('#ff_lesao').onchange = e => { const v = e.target.value; x.lesao = v === '' ? null : { valor: +v.replace('!', ''), inverso: v.startsWith('!') }; mudou(); };
  $('#ff_vit').onchange = e => { x.vitoria = e.target.value === '' ? null : e.target.value === '1'; mudou(); };
  $('#ff_mesmo').onchange = e => { x.mesmoInimigo = e.target.value === '' ? null : e.target.value === '1'; mudou(); };
  $('#ff_precisa').oninput = e => { f.precisa = Math.max(0, +e.target.value || 0); mudou(); };
  $('#ff_ato').onchange = e => { f.ato = +e.target.value; mudou(); };
  $('#ff_premio').onchange = e => { const v = e.target.value; if (!v) return; f.premios = f.premios || [...(f.premiosJogo || [])]; if (!f.premios.includes(v)) f.premios.push(v); re(); };
  c.querySelectorAll('[data-premiodel]').forEach(a => a.onclick = ev => { ev.preventDefault(); f.premios = f.premios || [...(f.premiosJogo || [])]; f.premios.splice(+a.dataset.premiodel, 1); re(); });
  $('#ff_apaga').onclick = () => { if (!confirm('Delete the feat “' + nomeFacanha(f) + '”?')) return; oficina().facanhas = oficina().facanhas.filter(z => z !== f); oficina().poolFacanhas = (oficina().poolFacanhas || []).filter(id => id !== f.id); fichaSel = null; renderFacanhas(); };
}

// ------------------------------------------------------------ export
const idFacanhaExportada = id => { const f = (oficina().facanhas || []).find(x => x.id === id); return f ? (f.base || f.id) : id; };
function facanhasExportadas() {
  return (oficina().facanhas || []).map(f => { const x = f.filtros || {};
    return { id: f.base || f.id, ...(f.base ? { game: f.base } : {}), hero: f.heroi, text: '<b>' + (f.nome || 'Feat') + '</b>: ' + (f.texto || ''), goal: f.meta || 1, timing: f.momento || 1, required: f.precisa || 0, act: f.ato || 0,
      ...(f.premios ? { rewards: f.premios.map(id => id.startsWith('RECEITA:') ? idReceitaExportada(id.slice(8)) : id) } : {}),
      params: { weapons: x.armas || [], enemies: x.inimigos || [], items: x.itens || [], interactable: x.objeto ?? null, condition: x.condicao ?? null, injury: x.lesao ? { value: x.lesao.valor, invert: !!x.lesao.inverso } : null,
        totalDamage: !!x.danoTotal, weakness: !!x.fraqueza, victory: x.vitoria ?? null, minDamage: x.danoMinimo || null, sameEnemy: x.mesmoInimigo ?? null } };
  });
}
const poolFacanhasExportado = () => [...new Set((oficina().poolFacanhas || []).map(idFacanhaExportada))];
