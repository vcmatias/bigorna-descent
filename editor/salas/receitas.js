/* Bigorna Rooms v2 — the Workshop's recipes: what an item costs in crafting materials when the heroes craft it (in the
   camp). A recipe crafts one item (of the workshop or of the game) and lists its materials; the game's recipes can be
   imported to change their costs. The party learns a recipe from a trigger ("Give an item") or knows it from the start. */
'use strict';

const materialDoJogo = id => CAT.itens.find(i => i._cls === 'CraftingMaterialModel' && i._id === id);
/* the materials a recipe may cost: the game's and the workshop's */
const MATERIAIS_RECEITA = () => [
  ...CAT.itens.filter(i => i._cls === 'CraftingMaterialModel').sort((a, b) => (a.MaterialType - b.MaterialType) || a.name_en.localeCompare(b.name_en)).map(m => ({ id: m._id, nome: m.name_en, essencia: m.MaterialType === 1 })),
  ...ITENS_B().filter(i => i.cls === 'CraftingMaterialModel').map(i => ({ id: i.id, nome: i.nome + ' (workshop)', essencia: +i.tipoMaterial === 1 }))];
const nomeMaterial = id => ITENS_B().find(i => i.id === id)?.nome || materialDoJogo(id)?.name_en || id || '?';
const imagemMaterial = id => { const w = ITENS_B().find(i => i.id === id); if (w) return retratoDoItem(w); const m = materialDoJogo(id); return m ? RETRATOS.itens[chaveArte(m.TextureAssetPath)] || '' : ''; };
/* what a recipe crafts: a workshop item or a game item */
function itemAlvo(id) {
  const w = ITENS_B().find(i => i.id === id); if (w) return { nome: w.nome, img: retratoDoItem(w), oficina: true };
  const g = itemDoJogo(id); if (g) return { nome: semGlifo(g.name_en) + (/_(UPGRADED|PLUS)$/.test(id) || g.IsUpgrade ? ' +' : ''), img: RETRATOS.itens[chaveArte(g.ArmoryAssetPath || g.TextureAssetPath)] || '', oficina: false };
  return null;
}
const nomeReceita = r => 'Recipe: ' + (itemAlvo(r.item)?.nome || '(no item yet)');
const custoResumo = r => (r.custos || []).filter(x => x.mat && x.qtd > 0).map(x => x.qtd + ' ' + nomeMaterial(x.mat)).join(', ') || 'no cost yet';

function novaReceita(itemId) {
  const r = { id: 'B_' + uid(), base: null, custom: true, item: itemId || '', custos: [{ mat: 'MAT_METAL', qtd: 3 }, { mat: 'MAT_LEATHER', qtd: 2 }], valor: 50, inicio: false };
  oficina().receitas.push(r); abaF = 'receitas'; fichaSel = r.id; renderFichas();
}
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
    d.innerHTML = `${a && a.img ? `<img class="face quadrada" src="${a.img}" alt="" style="object-fit:contain">` : '<span class="face"></span>'}<div><div>${esc(nomeReceita(r))}</div><small>${esc(custoResumo(r))}${r.base ? (r.custom ? ' · changed' : ' · from the game') : ' · custom'}${r.inicio ? ' · known from the start' : ''}</small></div>`;
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
  const a = itemAlvo(r.item);
  const itensOficina = ITENS_B().filter(i => i.cls !== 'CraftingMaterialModel');
  const grupos = [['Armor', 'ArmorModel'], ['Consumables', 'ConsumableModel'], ['Trinkets', 'TrinketModel'], ['Weapon parts', 'WeaponPartsModel']];
  const opcoes = grupos.map(([n, k]) => { const xs = itensOficina.filter(i => i.cls === k || (k === 'TrinketModel' && i.cls === 'TableItem')); return xs.length ? `<optgroup label="${n} of the workshop">${xs.map(i => `<option value="${esc(i.id)}" ${r.item === i.id ? 'selected' : ''}>${esc(i.nome)}</option>`).join('')}</optgroup>` : ''; }).join('')
    + (r.item && !itensOficina.some(i => i.id === r.item) ? `<option value="${esc(r.item)}" selected>${esc(a ? a.nome + ' (game item)' : r.item)}</option>` : '');
  const mats = MATERIAIS_RECEITA();
  c.innerHTML = `<div class="cabF"><h2>${esc(nomeReceita(r))} ${etiquetaEstado(r)}</h2><div class="botoes"><button class="sm perigo" id="fr_apaga">Delete</button></div></div>
    <div class="folha"><div class="col">
      <div class="retrato"><div class="quadro">${a && a.img ? `<img src="${a.img}" alt="">` : '<span>no item</span>'}</div><div>
        <label class="campo">Crafts <select id="fr_item"><option value="">— pick an item —</option>${opcoes}</select></label>
        <p class="ajuda">${itensOficina.length ? 'An item of the workshop (Items tab, or a weapon part of the Weapons tab).' : 'The workshop has no items yet: create or import them in the Items tab.'}${r.base ? ' This recipe of the game keeps its item; only the costs and the price change.' : ''}</p></div></div>
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
      d.innerHTML = `${img ? `<img class="icoPeca" src="${img}" alt="">` : '<span class="icoPeca"></span>'}<input type="number" min="1" max="99" value="${x.qtd}" style="width:64px"><select>${mats.map(m => `<option value="${esc(m.id)}" ${x.mat === m.id ? 'selected' : ''}>${esc(m.nome)}${m.essencia ? ' (essence)' : ''}</option>`).join('')}${x.mat && !mats.some(m => m.id === x.mat) ? `<option value="${esc(x.mat)}" selected>${esc(x.mat)}</option>` : ''}</select><button class="sm">✕</button>`;
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
}

// ------------------------------------------------------------ export
/* edited or new recipes, the ones known from the start, and every recipe a trigger gives */
function receitasExportadas() {
  const dadas = new Set(); projeto.salas.forEach(s => donosDaSala(s).forEach(({ o }) => todosGatilhos(o).forEach(g => { if (g.tipo === 'give_item' && typeof g.item === 'string' && g.item.startsWith('RECEITA:')) dadas.add(g.item.slice(8)); })));
  return oficina().receitas.filter(r => r.custom || !r.base || r.inicio || dadas.has(r.id)).map(r => ({ id: r.id, ...(r.base ? { game: r.base } : {}), item: idItemExportado(r.item),
    ingredients: (r.custos || []).filter(x => x.mat && x.qtd > 0).map(x => ({ material: idItemExportado(x.mat), qty: x.qtd })), value: r.valor || 0, start: !!r.inicio }));
}
const idReceitaExportada = id => { const r = (oficina().receitas || []).find(x => x.id === id); return r ? (r.base || r.id) : id; };
