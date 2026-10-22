/* Bigorna Rooms v2 — the Workshop's recipes: what an item costs in crafting materials when the heroes craft it (in the
   camp). A recipe crafts one item (of the workshop or of the game) and lists its materials; the game's recipes can be
   imported to change their costs. The party learns a recipe from a trigger ("Give an item") or knows it from the start. */
'use strict';

const materialDoJogo = id => CAT.itens.find(i => i._cls === 'CraftingMaterialModel' && i._id === id);
/* the materials a recipe may cost: the game's and the workshop's */
const MATERIAIS_RECEITA = () => [
  ...CAT.itens.filter(i => i._cls === 'CraftingMaterialModel').sort((a, b) => (a.MaterialType - b.MaterialType) || a.name_en.localeCompare(b.name_en)).map(m => ({ id: m._id, nome: m.name_en, essencia: m.MaterialType === 1 })),
  ...ITENS_B().filter(i => i.cls === 'CraftingMaterialModel').map(i => ({ id: i.id, nome: i.nome + L2(' (workshop)', ' (oficina)'), essencia: +i.tipoMaterial === 1 }))];
const nomeMaterial = id => ITENS_B().find(i => i.id === id)?.nome || materialDoJogo(id)?.name_en || id || '?';
const imagemMaterial = id => { const w = ITENS_B().find(i => i.id === id); if (w) return retratoDoItem(w); const m = materialDoJogo(id); return m ? RETRATOS.itens[chaveArte(m.TextureAssetPath)] || '' : ''; };
/* what a recipe crafts: a workshop item or a game item */
function itemAlvo(id) {
  const w = ITENS_B().find(i => i.id === id); if (w) return { nome: w.nome, img: retratoDoItem(w), oficina: true };
  const g = itemDoJogo(id); if (g) { const n = semGlifo(g.name_en); return { nome: n + ((/_(UPGRADED|PLUS)$/.test(id) || g.IsUpgrade) && !/[+✚]\s*$/.test(n) ? ' +' : ''), img: RETRATOS.itens[chaveArte(g.ArmoryAssetPath || g.TextureAssetPath)] || '', oficina: false }; }
  return null;
}
const nomeReceita = r => 'Recipe: ' + (itemAlvo(r.item)?.nome || '(no item yet)');
const custoResumo = r => (r.custos || []).filter(x => x.mat && x.qtd > 0).map(x => x.qtd + ' ' + nomeMaterial(x.mat)).join(', ') || 'no cost yet';

function novaReceita(itemId) {
  const r = { id: 'B_' + uid(), base: null, custom: true, item: itemId || '', custos: [{ mat: 'MAT_METAL', qtd: 3 }, { mat: 'MAT_LEATHER', qtd: 2 }], valor: 50, inicio: false };
  oficina().receitas.push(r); return r;
}
/* the recipes of an item (of the workshop: by its id; of the game: by its id in the game too) and the game's recipes of it
   not brought in yet */
const receitasDoAlvo = alvo => (oficina().receitas || []).filter(r => r.item && (r.item === alvo.id || (alvo.base && r.item === alvo.base) || (!alvo.soEste && (semMais(r.item) === alvo.id || (alvo.base && semMais(r.item) === alvo.base)))));
const receitasDoJogoDoAlvo = alvo => alvo.base ? (CAT.receitas || []).filter(c => (c.CraftedItemId === alvo.base || semMais(c.CraftedItemId) === alvo.base) && !(oficina().receitas || []).some(r => r.base === c._id)) : [];
/* v230: the recipes are edited in the sheet of the item they craft (and of the weapon part): the costs in materials, the
   price, whether the party knows it from the start. A recipe of the game stays as in the game (duplicate it to change it);
   the game's recipe of an item of the game can be brought in with a click */
function editorDeReceitas(el, alvo, refazer) {
  const lista = receitasDoAlvo(alvo), doJogo = receitasDoJogoDoAlvo(alvo); const mats = MATERIAIS_RECEITA();
  el.innerHTML = lista.map((r, n) => { const orig = !!r.base, rj = orig ? receitaDoJogo(r.base) : null;
      const mudado = orig && !!rj && JSON.stringify([r.valor || 0, (r.custos || []).map(x => [x.mat, x.qtd])]) !== JSON.stringify([rj.valor || 0, (rj.custos || []).map(x => [x.mat, x.qtd])]);
      return `<div class="ativ receitaInline" data-r="${n}"><div class="cabAtiv"><span class="numAtiv">${esc(tr('Recipe'))}${lista.length > 1 ? ' ' + (n + 1) : ''}</span><span class="etq ${orig ? '' : 'custom'}">${esc(tr(orig ? (mudado ? 'of the game, changed' : 'of the game') : 'custom'))}</span><span class="cresce"></span>
        ${orig ? `<button class="sm" data-rdup="${n}" title="${esc(tr('Duplicate: a recipe of your own, to change'))}">⧉</button>` : ''}${mudado ? `<button class="sm" data-rvolta="${n}" title="${esc(tr('Back to the game’s'))}">↺</button>` : ''}<button class="sm" data-rx="${n}" title="${esc(tr('Delete this recipe'))}">✕</button></div>
        <div class="custosR">${(r.custos || []).map((x, k) => { const img = imagemMaterial(x.mat); return `<div class="linha custo">${img ? `<img class="icoPeca" loading="lazy" decoding="async" ${imgTardia(img)} alt="">` : '<span class="icoPeca"></span>'}<input type="number" min="1" max="99" value="${x.qtd}" style="width:64px" data-rq="${n}:${k}" ${orig ? 'disabled' : ''}><select data-rm="${n}:${k}" ${orig ? 'disabled' : ''}>${mats.map(m => `<option value="${esc(m.id)}" ${x.mat === m.id ? 'selected' : ''}>${esc(m.nome)}${m.essencia ? L2(' (essence)', ' (essência)') : ''}</option>`).join('')}${x.mat && !mats.some(m => m.id === x.mat) ? `<option value="${esc(x.mat)}" selected>${esc(x.mat)}</option>` : ''}</select>${orig ? '' : `<button class="sm" data-rmx="${n}:${k}">✕</button>`}</div>`; }).join('') || `<p class="ajuda">${esc(tr('Free: no material needed.'))}</p>`}
        ${orig ? '' : `<button class="sm" data-rmais="${n}">+ ${esc(tr('Material'))}</button>`}</div>
        <div class="duas"><label class="campo">${esc(tr('Price of the recipe (gold)'))} <input type="number" min="0" data-rv="${n}" value="${r.valor || 0}" ${orig ? 'disabled' : ''}></label>
        <label class="chk"><input type="checkbox" data-ri="${n}" ${r.inicio ? 'checked' : ''}> ${esc(tr('The party knows it from the start'))}</label></div>
        <div class="previaTx"><div class="rotuloTx">${esc(tr('In the camp:'))}</div><b>${esc(itemAlvo(r.item)?.nome || alvo.nome || '?')}</b> ← ${esc(custoResumo(r))}</div></div>`; }).join('')
    + doJogo.map((c, n) => `<div class="linha receitaJogo"><span class="ajuda">${esc(tr('Recipe of the game'))}: ${esc((c.Ingredients || []).map(x => x.qty + ' ' + nomeMaterial(x.id)).join(', ') || '—')}</span><button class="sm" data-rjogo="${n}">${esc(tr('Bring it in'))}</button></div>`).join('')
    + `<div class="botoes"><button class="sm" data-rnova>+ ${esc(tr(lista.length ? 'Another recipe' : 'A recipe for it'))}</button></div>`
    + (lista.length || doJogo.length ? '' : `<p class="ajuda">${esc(tr('No recipe crafts it yet: with one, the heroes can craft it in the camp, paying its materials.'))}</p>`);
  const R = n => lista[+n]; const par = s => s.split(':').map(Number);
  const mudou = r => { r.custom = true; };
  el.querySelectorAll('[data-rq]').forEach(i => i.oninput = () => { const [n, k] = par(i.dataset.rq); R(n).custos[k].qtd = Math.max(0, +i.value || 0); mudou(R(n)); });
  el.querySelectorAll('[data-rm]').forEach(s => s.onchange = () => { const [n, k] = par(s.dataset.rm); R(n).custos[k].mat = s.value; mudou(R(n)); refazer(); });
  el.querySelectorAll('[data-rmx]').forEach(b => b.onclick = () => { const [n, k] = par(b.dataset.rmx); R(n).custos.splice(k, 1); mudou(R(n)); refazer(); });
  el.querySelectorAll('[data-rmais]').forEach(b => b.onclick = () => { const r = R(b.dataset.rmais); r.custos.push({ mat: mats.find(m => !r.custos.some(x => x.mat === m.id))?.id || 'MAT_METAL', qtd: 1 }); mudou(r); refazer(); });
  el.querySelectorAll('[data-rv]').forEach(i => i.oninput = () => { const r = R(i.dataset.rv); r.valor = Math.max(0, +i.value || 0); mudou(r); });
  el.querySelectorAll('[data-ri]').forEach(c => c.onchange = () => { R(c.dataset.ri).inicio = c.checked; refazer(); });
  el.querySelectorAll('[data-rx]').forEach(b => b.onclick = () => { const r = R(b.dataset.rx); if (!confirm(tr('Delete this recipe?'))) return; oficina().receitas = oficina().receitas.filter(x => x !== r); esquecerFicha('itens', 'RECEITA:' + r.id); refazer(); });
  el.querySelectorAll('[data-rdup]').forEach(b => b.onclick = () => { const d = clone(R(b.dataset.rdup)); d.id = 'B_' + uid(); d.base = null; d.custom = true; oficina().receitas.push(d); refazer(); aviso(tr('Duplicated: this one is yours to change.')); });
  el.querySelectorAll('[data-rvolta]').forEach(b => b.onclick = () => { const r = R(b.dataset.rvolta), rj = receitaDoJogo(r.base); if (rj) { r.valor = rj.valor; r.custos = clone(rj.custos); } refazer(); });
  el.querySelectorAll('[data-rjogo]').forEach(b => b.onclick = () => { oficina().receitas.push(receitaDoCatalogo(doJogo[+b.dataset.rjogo])); refazer(); });
  el.querySelector('[data-rnova]').onclick = () => { novaReceita(alvo.id); refazer(); };
}
/* the recipes whose item is in no sheet of the workshop (a game item never brought in, or one deleted) */
/* (v241: a recipe of a part of a weapon of the game is in the Weapons tab, in the sheet of that part; the recipe of the
   upgraded (+) version of an item goes with the item) */
const semMais = id => String(id || '').replace(/_(UPGRADED|PLUS)$/, '');
const receitaTemDono = r => { if (!r.item) return false; const ids = [r.item, semMais(r.item)];
  if (ids.some(id => ITENS_B().some(i => id === i.id || (i.base && id === i.base)))) return true;
  return ids.some(id => itemDoJogo(id)?._cls === 'WeaponPartsModel'); };
const receitasSoltas = () => (oficina().receitas || []).filter(r => !receitaTemDono(r));
const receitaDoCatalogo = c => ({ id: 'B_' + uid(), base: c._id, custom: false, item: c.CraftedItemId || '', custos: (c.Ingredients || []).map(x => ({ mat: x.id, qtd: x.qty })), valor: c.Value || 0, inicio: false });

function renderReceitas() {
  const lista = oficina().receitas; if (fichaSel && !lista.some(x => x.id === fichaSel)) fichaSel = null;
  const esq = $('#esqF');
  esq.innerHTML = `<div class="bloco"><h2>Recipes <span class="etq">${lista.length}</span></h2>
    <div class="botoes"><button class="sm" id="f_importarR">Import from the game…</button><button class="sm primario" id="f_novaR">+ New recipe</button></div>
    <p class="ajuda">A recipe says what an item costs in crafting materials when the heroes craft it in the camp. Import the game’s recipes to change their costs, or write one for an item of the workshop. The party learns a recipe from a “Give an item” trigger, or knows it from the start.</p>
    <div id="f_lista"></div></div>`;
  const l = $('#f_lista');
  lista.forEach(r => {
    const a = itemAlvo(r.item); const d = document.createElement('div'); d.className = 'no' + (fichaSel === r.id ? ' ativo' : '');
    d.innerHTML = `${a && a.img ? `<img class="face quadrada" loading="lazy" decoding="async" ${imgTardia(a.img)} alt="" style="object-fit:contain">` : '<span class="face"></span>'}<div><div>${esc(nomeReceita(r))}</div><small>${esc(custoResumo(r))}${r.base ? (r.custom ? ' · changed' : ' · from the game') : ' · custom'}${r.inicio ? ' · known from the start' : ''}</small></div>`;
    d.onclick = () => { fichaSel = r.id; renderReceitas(); }; l.appendChild(d);
  });
  if (!lista.length) l.innerHTML = '<p class="ajuda">Nothing yet.</p>';
  $('#f_importarR').onclick = importarReceita; $('#f_novaR').onclick = () => novaReceita('');
  const r = lista.find(x => x.id === fichaSel); const c = $('#centroF');
  if (!r) { c.innerHTML = '<div class="vazio"><h2>Recipes</h2><p>Pick a recipe on the left, import one from the game, or write a new one.</p></div>'; return; }
  fichaReceita(c, r);
}

function importarReceita() {
  const lista = (CAT.receitas || []).map(c => ({ c, a: itemAlvo(c.CraftedItemId) })).filter(x => x.a).sort((x, y) => x.a.nome.localeCompare(y.a.nome));
  const ja = new Set(oficina().receitas.map(r => r.base));
  modalImportacao('Import recipes of the game', lista.map(({ c, a }) => ({ c, nome: a.nome, img: a.img, sub: (c.Ingredients || []).map(x => x.qty + ' ' + nomeMaterial(x.id)).join(', '), ja: ja.has(c._id) })), escolhidas => {
    const novas = escolhidas.map(({ c }) => receitaDoCatalogo(c)); novas.forEach(r => oficina().receitas.push(r)); if (novas[0]) fichaSel = novas[0].id; renderReceitas();
    aviso(novas.length === 1 ? 'Recipe for ' + escolhidas[0].nome + ' imported. Change its costs if you like.' : novas.length + ' recipes imported.');
  });
}
function fichaReceita(c, r) {
  setTimeout(() => primeiraVista(r), 0);   // (v240: the sheet fills its defaults first)
  const a = itemAlvo(r.item);
  const itensOficina = ITENS_B().filter(i => i.cls !== 'CraftingMaterialModel');
  const grupos = [['Armor', 'ArmorModel'], ['Consumables', 'ConsumableModel'], ['Trinkets', 'TrinketModel'], ['Weapon parts', 'WeaponPartsModel']];
  const opcoes = grupos.map(([n, k]) => { const xs = itensOficina.filter(i => i.cls === k || (k === 'TrinketModel' && i.cls === 'TableItem')); return xs.length ? `<optgroup label="${n} of the workshop">${xs.map(i => `<option value="${esc(i.id)}" ${r.item === i.id ? 'selected' : ''}>${esc(i.nome)}</option>`).join('')}</optgroup>` : ''; }).join('')
    + (r.item && !itensOficina.some(i => i.id === r.item) ? `<option value="${esc(r.item)}" selected>${esc(a ? a.nome + ' (game item)' : r.item)}</option>` : '');
  const mats = MATERIAIS_RECEITA();
  const orig = !!r.base, rj = orig ? receitaDoJogo(r.base) : null;
  const mudado = orig && !!rj && JSON.stringify([r.item, r.valor || 0, (r.custos || []).map(x => [x.mat, x.qtd])]) !== JSON.stringify([rj.item, rj.valor || 0, (rj.custos || []).map(x => [x.mat, x.qtd])]);
  c.innerHTML = `<div class="cabF"><h2>${esc(nomeReceita(r))} ${etiquetaEstado(r)}</h2><div class="botoes">${orig ? `<button class="sm primario" id="fr_dup">⧉ ${esc(tr('Duplicate'))}</button>` : ''}${mudado ? `<button class="sm" id="fr_volta">↺ ${esc(tr('Back to the game’s'))}</button>` : ''}<button class="sm perigo" id="fr_apaga">Delete</button></div></div>
    ${orig ? avisoOficial(mudado ? 'This original was changed by an older version of the editor: “↺ Back to the game’s” undoes it.' : '', 'Whether the party knows it from the start may change here.') : ''}
    <div class="folha"><div class="col">
      <div class="retrato"><div class="quadro">${a && a.img ? `<img loading="lazy" decoding="async" ${imgTardia(a.img)} alt="">` : '<span>no item</span>'}</div><div>
        <label class="campo">Crafts <select id="fr_item"><option value="">— pick an item —</option>${opcoes}</select></label>
        <p class="ajuda">${itensOficina.length ? 'An item of the workshop (Items tab, or a weapon part of the Weapons tab).' : 'The workshop has no items yet: create or import them in the Items tab.'}${r.base ? ' This recipe of the game stays as in the game (duplicate it to change it).' : ''}</p></div></div>
      <div class="sub">Cost in materials</div>
      <div id="fr_custos"></div>
      <button class="sm" id="fr_mais">+ Material</button>
      <p class="ajuda">What crafting the item takes, unit by unit. Base materials (leather, metal…) are common; essences (Ignos, Lumos…) are uncommon.</p>
      <div class="duas"><label class="campo">Price of the recipe (gold) <input type="number" min="0" id="fr_valor" value="${r.valor || 0}"></label>
      <label class="chk"><input type="checkbox" id="fr_inicio" ${r.inicio ? 'checked' : ''}> The party knows it from the start</label></div>
      <div class="previaTx"><div class="rotuloTx">In the camp:</div><b>${esc(a ? a.nome : '?')}</b> ← ${esc(custoResumo(r))}</div>
    </div></div>`;
  const mudou = () => { r.custom = true; };
  const pintaCustos = () => {
    const el = $('#fr_custos'); el.innerHTML = '';
    r.custos.forEach((x, k) => {
      const d = document.createElement('div'); d.className = 'linha custo';
      const img = imagemMaterial(x.mat);
      d.innerHTML = `${img ? `<img class="icoPeca" loading="lazy" decoding="async" ${imgTardia(img)} alt="">` : '<span class="icoPeca"></span>'}<input type="number" min="1" max="99" value="${x.qtd}" style="width:64px"><select>${mats.map(m => `<option value="${esc(m.id)}" ${x.mat === m.id ? 'selected' : ''}>${esc(m.nome)}${m.essencia ? L2(' (essence)', ' (essência)') : ''}</option>`).join('')}${x.mat && !mats.some(m => m.id === x.mat) ? `<option value="${esc(x.mat)}" selected>${esc(x.mat)}</option>` : ''}</select><button class="sm">✕</button>`;
      d.querySelector('input').oninput = e => { x.qtd = Math.max(0, +e.target.value || 0); mudou(); };
      d.querySelector('select').onchange = e => { x.mat = e.target.value; mudou(); renderReceitas(); };
      d.querySelector('button').onclick = () => { r.custos.splice(k, 1); mudou(); renderReceitas(); };
      el.appendChild(d);
    });
    if (!r.custos.length) el.innerHTML = '<p class="ajuda">Free: no material needed.</p>';
  };
  pintaCustos();
  $('#fr_mais').onclick = () => { r.custos.push({ mat: mats.find(m => !r.custos.some(x => x.mat === m.id))?.id || 'MAT_METAL', qtd: 1 }); mudou(); renderReceitas(); };
  $('#fr_item').onchange = e => { r.item = e.target.value; mudou(); renderReceitas(); };
  $('#fr_valor').oninput = e => { r.valor = Math.max(0, +e.target.value || 0); mudou(); };
  $('#fr_inicio').onchange = e => { r.inicio = e.target.checked; renderReceitas(); };
  $('#fr_apaga').onclick = () => { if (!confirm('Delete ' + nomeReceita(r) + '?')) return; oficina().receitas = oficina().receitas.filter(x => x !== r); esquecerFicha('itens', 'RECEITA:' + r.id); fichaSel = null; renderReceitas(); };
  if (!orig) return;
  travarOficial(c, '#fr_inicio');
  // (a copy of a recipe: a new recipe of the workshop, same item and costs, to change)
  $('#fr_dup').onclick = () => { const d = clone(r); d.id = 'B_' + uid(); d.base = null; d.custom = true; oficina().receitas.push(d); fichaSel = d.id; renderReceitas(); aviso(tr('Duplicated: this one is yours to change.')); };
  const vj = $('#fr_volta'); if (vj) vj.onclick = () => { r.item = rj.item; r.valor = rj.valor; r.custos = clone(rj.custos); renderReceitas(); };
}
/* the recipe of the game as the workshop would import it (to compare and to undo) */
function receitaDoJogo(id) { const c = (CAT.receitas || []).find(x => x._id === id); return c ? receitaDoCatalogo(c) : null; }

// ------------------------------------------------------------ export
/* edited or new recipes, the ones known from the start, and every recipe a trigger gives */
function receitasExportadas() {
  const dadas = new Set(); projeto.salas.forEach(s => donosDaSala(s).forEach(({ o }) => todosGatilhos(o).forEach(g => { if (g.tipo === 'give_item' && typeof g.item === 'string' && g.item.startsWith('RECEITA:')) dadas.add(g.item.slice(8)); })));
  return oficina().receitas.filter(r => r.custom || !r.base || r.inicio || dadas.has(r.id)).map(r => ({ id: r.id, ...(r.base ? { game: r.base } : {}), item: idItemExportado(r.item),
    ingredients: (r.custos || []).filter(x => x.mat && x.qtd > 0).map(x => ({ material: idItemExportado(x.mat), qty: x.qtd })), value: r.valor || 0, start: !!r.inicio }));
}
const idReceitaExportada = id => { const r = (oficina().receitas || []).find(x => x.id === id); return r ? (r.base || r.id) : id; };
/* v245: a recipe is part of the item it crafts (no recipe stands on its own). Importing a game item brings its game recipes
   (and those of its upgraded + version); deleting an item takes its recipes, save those shared with another item of the
   Workshop of the same game item, and those of a weapon part of the game (the part stays in the game) */
/* a recipe that rides with an item of the Workshop (in packages: chosen with the item, not on its own) */
const receitaDeItemDaOficina = r => !!r && !!r.item && [r.item, semMais(r.item)].some(id => ITENS_B().some(i => id === i.id || (i.base && id === i.base)));
function trazerReceitasDoItem(x) {
  if (!x || !x.base) return 0; const b = oficina(); b.receitas = b.receitas || [];
  const novas = receitasDoJogoDoAlvo(x).map(receitaDoCatalogo); novas.forEach(r => b.receitas.push(r)); return novas.length;
}
function tirarReceitasDoItem(x) {
  const b = oficina(); if (!x || !(b.receitas || []).length) return 0;
  const doId = r => r.item === x.id || semMais(r.item) === x.id;
  const outro = x.base && ITENS_B().some(y => y !== x && y.base === x.base);
  const parteDoJogo = x.base && itemDoJogo(x.base)?._cls === 'WeaponPartsModel';
  const daBase = r => !!x.base && !outro && !parteDoJogo && (r.item === x.base || semMais(r.item) === x.base);
  const fora = b.receitas.filter(r => doId(r) || daBase(r)); if (!fora.length) return 0;
  b.receitas = b.receitas.filter(r => !fora.includes(r)); fora.forEach(r => esquecerFicha('itens', 'RECEITA:' + r.id)); return fora.length;
}
