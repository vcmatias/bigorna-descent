/* Bigorna Rooms: the map generator. A map is an experience, not a heap of rooms: why the heroes go in (the premise),
   how the tension grows and breathes (the beats, each a room of an archetype), a gimmick that changes how the map is
   played (three keys, captives to lead out, seals of a ritual, waves to hold, a collapse to outrun…), the objectives
   along the way and the end. The rooms come from the room generator (gerador.js), one after the other, each born at an
   edge of the one before it. Everything is plain data below and can be edited. */
'use strict';

/* Portuguese joins a preposition and the article of the place: "em a fortaleza" → "na fortaleza" */
const CONTRACOES = { 'a a': 'à', 'a as': 'às', 'a o': 'ao', 'a os': 'aos', 'em a': 'na', 'em as': 'nas', 'em o': 'no', 'em os': 'nos', 'de a': 'da', 'de as': 'das', 'de o': 'do', 'de os': 'dos', 'por a': 'pela', 'por as': 'pelas', 'por o': 'pelo', 'por os': 'pelos' };
// (a whole word only: "começa a brilhar" once became "começà brilhar", \b taking the ç for a break)
const contrair = t => LP() !== 'pt' ? t : t.replace(/(?<![\p{L}\p{N}])(a|em|de|por) (a|as|o|os) (?=\S)/giu, (m, p1, p2) => { const r = CONTRACOES[p1.toLowerCase() + ' ' + p2.toLowerCase()]; return r ? (p1[0] === p1[0].toUpperCase() ? r.charAt(0).toUpperCase() + r.slice(1) : r) + ' ' : m; });
const preencher = (t, v) => contrair(TXT(t).replace(/\{(\w+)\}/g, (_, k) => v[k] !== undefined ? v[k] : '{' + k + '}')).replace(/(^|[.!?]\s+)(["“]?)([a-zà-ú])/g, (m, a, q, c) => a + q + c.toUpperCase());   // (also after an opening quote: "{vilao} waits…")

// ------------------------------------------------------------ premises: why the heroes go in
/* fields: id, nome, resumo; truques (the gimmicks that fit, first is the favourite); faccao (monsters); final (how the
   map ends: boss = defeat the last room, relic = use the relic, exit = use the way out, counter = the gimmick's count, destroy = tear down
   a great thing in the last room);
   textos: titulo, intro, climax, fim (with {vilao}, {lugar}, {alvo}, {n}) */
const PREMISSAS_MAPA = [
  { id: 'resgate', nome: { en: 'Rescue', pt: 'Resgate' }, resumo: { en: 'Captives are held inside: find them all and lead them out.', pt: 'Há prisioneiros lá dentro: achem todos e levem-nos para fora.' },
    truques: ['resgate'], faccao: 'bandidos', final: 'exit', alvo: { en: 'the captives', pt: 'os prisioneiros' },
    titulo: { en: ['The Cells of {vilao}', 'No One Left Behind', 'Chains in {lugar}'], pt: ['As Celas de {vilao}', 'Ninguém Fica para Trás', 'Correntes em {lugar}'] },
    intro: { en: ['Villagers were taken in the night. The tracks lead to {lugar}, where {vilao} keeps them for a price or for worse. Get in, find every one of them and bring them home.'], pt: ['Aldeões foram levados durante a noite. Os rastros levam a {lugar}, onde {vilao} os guarda por um resgate, ou por coisa pior. Entrem, encontrem cada um e tragam-nos para casa.'] },
    climax: { en: ['{vilao} stands between you and the way out.'], pt: ['{vilao} está entre vocês e a saída.'] },
    fim: { en: ['The captives blink in the daylight. Every one of them is going home.'], pt: ['Os prisioneiros piscam sob a luz do dia. Todos vão voltar para casa.'] } },
  { id: 'reliquia', nome: { en: 'Relic', pt: 'Relíquia' }, resumo: { en: 'Something of power lies at the heart of the place: take it before the enemy does.', pt: 'Algo de poder jaz no coração do lugar: tomem-no antes do inimigo.' },
    truques: [null, 'desabamento'], faccao: 'mortos', final: 'relic', alvo: { en: 'the relic', pt: 'a relíquia' },
    titulo: { en: ['The Vault of {lugar}', 'What {vilao} Guards', 'The Last Reliquary'], pt: ['A Cripta de {lugar}', 'O Que {vilao} Guarda', 'O Último Relicário'] },
    intro: { en: ['An old map, a burned page and a rumour: {alvo} lies in {lugar}. {vilao} wants it too. Whoever reaches it first decides what comes next.'], pt: ['Um mapa antigo, uma página queimada e um boato: {alvo} está em {lugar}. {vilao} também a quer. Quem chegar primeiro decide o que vem depois.'] },
    climax: { en: ['There it is, on its pedestal. And {vilao} is already here.'], pt: ['Lá está ela, no pedestal. E {vilao} já chegou.'] },
    fim: { en: ['{alvo} is yours. Whatever it wakes, it will not wake for {vilao}.'], pt: ['{alvo} é de vocês. O que quer que ela desperte, não despertará para {vilao}.'] } },
  { id: 'ritual', nome: { en: 'Stop the ritual', pt: 'Impedir o ritual' }, resumo: { en: 'A rite is under way: break what feeds it and face whoever leads it.', pt: 'Um rito está em curso: quebrem o que o alimenta e enfrentem quem o conduz.' },
    truques: ['selos', null], faccao: 'culto', final: 'boss', alvo: { en: 'the rite', pt: 'o rito' },
    titulo: { en: ['The Rite of {vilao}', 'Blood on {lugar}', 'Before the Last Chant'], pt: ['O Rito de {vilao}', 'Sangue em {lugar}', 'Antes do Último Cântico'] },
    intro: { en: ['The sky over {lugar} has turned the colour of a bruise. {vilao} is calling something across, and the chant grows louder every hour. Break what feeds it, then end it.'], pt: ['O céu sobre {lugar} ganhou a cor de um hematoma. {vilao} está chamando algo para este lado, e o cântico cresce a cada hora. Quebrem o que o alimenta, depois acabem com isso.'] },
    climax: { en: ['At the centre of the circle, {vilao} turns to face you, eyes alight.'], pt: ['No centro do círculo, {vilao} se vira para vocês, os olhos em brasa.'] },
    fim: { en: ['The chant breaks off. Whatever was coming will have to find another door.'], pt: ['O cântico se interrompe. O que quer que viesse terá de achar outra porta.'] } },
  { id: 'cacada', nome: { en: 'The hunt', pt: 'A caçada' }, resumo: { en: 'A beast preys on the region: follow its tracks to its lair.', pt: 'Uma fera ataca a região: sigam os rastros até o covil.' },
    truques: ['fera', 'ninhos'], faccao: 'feras', final: 'boss', alvo: { en: 'the beast', pt: 'a fera' },
    titulo: { en: ['The Lair of {vilao}', 'Tracks in {lugar}', 'The Hunter\'s Price'], pt: ['O Covil de {vilao}', 'Rastros em {lugar}', 'O Preço do Caçador'] },
    intro: { en: ['Three farms, three nights, no survivors. The locals whisper a name: {vilao}. Its tracks lead into {lugar}. Read them well, and end the hunt before it ends you.'], pt: ['Três fazendas, três noites, nenhum sobrevivente. Os moradores sussurram um nome: {vilao}. Os rastros levam a {lugar}. Leiam-nos bem e terminem a caçada antes que ela termine com vocês.'] },
    climax: { en: ['Bones everywhere. A low growl. {vilao} was waiting.'], pt: ['Ossos por toda parte. Um rosnado grave. {vilao} estava esperando.'] },
    fim: { en: ['{vilao} will hunt no more. The farms can sleep again.'], pt: ['{vilao} não caçará mais. As fazendas podem voltar a dormir.'] } },
  { id: 'investigacao', nome: { en: 'Investigation', pt: 'Investigação' }, resumo: { en: 'People have vanished: gather the clues and find the truth at the end.', pt: 'Pessoas sumiram: juntem as pistas e achem a verdade no fim.' },
    truques: [null], faccao: 'bandidos', final: 'relic', alvo: { en: 'the truth', pt: 'a verdade' },
    titulo: { en: ['The Silence of {lugar}', 'Where the Missing Went', 'A Name in the Ledger'], pt: ['O Silêncio de {lugar}', 'Para Onde Foram os Desaparecidos', 'Um Nome no Livro'] },
    intro: { en: ['Travellers who pass through {lugar} do not arrive anywhere else. The garrison shrugs. Someone is paid to shrug. Find what they hide, and who: {vilao}, the rumours say.'], pt: ['Viajantes que passam por {lugar} não chegam a lugar nenhum. A guarnição dá de ombros. Alguém é pago para dar de ombros. Descubram o que escondem, e quem: {vilao}, dizem os boatos.'] },
    climax: { en: ['The last door. Behind it, the answer, and {vilao}.'], pt: ['A última porta. Atrás dela, a resposta, e {vilao}.'] },
    fim: { en: ['The ledger names everyone who was paid. The missing will be remembered.'], pt: ['O livro nomeia todos os que receberam. Os desaparecidos serão lembrados.'] } },
  { id: 'fuga', nome: { en: 'Escape', pt: 'Fuga' }, resumo: { en: 'The place is coming down: reach the way out before it buries you.', pt: 'O lugar está desabando: alcancem a saída antes que ele os enterre.' },
    truques: ['desabamento'], faccao: 'mortos', final: 'exit', alvo: { en: 'the way out', pt: 'a saída' },
    titulo: { en: ['Out of {lugar}', 'The Falling Halls', 'Before the Dust Settles'], pt: ['Fora de {lugar}', 'Os Salões que Caem', 'Antes que a Poeira Assente'] },
    intro: { en: ['The ground shakes. Whatever {vilao} woke below, {lugar} will not stand much longer. There is one way out, at the far end. Move.'], pt: ['O chão treme. O que quer que {vilao} tenha despertado lá embaixo, não restará muito de {lugar}. Há uma só saída, no extremo. Andem.'] },
    climax: { en: ['Daylight ahead. And {vilao}, blocking it.'], pt: ['Luz do dia adiante. E {vilao}, bloqueando o caminho.'] },
    fim: { en: ['Behind you, {lugar} folds in on itself. You made it, barely.'], pt: ['Atrás de vocês, {lugar} desaba. Vocês conseguiram, por pouco.'] } },
  { id: 'defesa', nome: { en: 'Hold the line', pt: 'Segurar a linha' }, resumo: { en: 'Reach the stand and hold it against the waves.', pt: 'Alcancem o ponto de defesa e segurem-no contra as ondas.' },
    truques: [null], faccao: 'legiao', final: 'counter', alvo: { en: 'the stand', pt: 'o ponto de defesa' },
    titulo: { en: ['The Stand at {lugar}', 'Until the Horn Sounds', 'Hold {lugar}'], pt: ['A Resistência em {lugar}', 'Até a Trombeta Soar', 'Segurem {lugar}'] },
    intro: { en: ['{vilao}\'s host is coming. The only ground worth holding is at the heart of {lugar}. Get there, raise the defence and do not break.'], pt: ['A horda de {vilao} está chegando. O único terreno que vale a pena segurar fica no coração de {lugar}. Cheguem lá, levantem a defesa e não cedam.'] },
    climax: { en: ['This is the place. Here, they will not pass.'], pt: ['Este é o lugar. Daqui, eles não passam.'] },
    fim: { en: ['The last wave breaks. {vilao}\'s host falls back, leaving its dead.'], pt: ['A última onda se quebra. A horda de {vilao} recua, deixando seus mortos.'] } },
  { id: 'selos', nome: { en: 'Seal the rifts', pt: 'Selar as fendas' }, resumo: { en: 'Rifts bleed into the world: close every one of them.', pt: 'Fendas sangram para dentro do mundo: fechem todas.' },
    truques: ['selos'], faccao: 'culto', final: 'counter', alvo: { en: 'the rifts', pt: 'as fendas' },
    titulo: { en: ['The Wounds of {lugar}', 'Close the Veil', 'Where the World Is Thin'], pt: ['As Feridas de {lugar}', 'Fechem o Véu', 'Onde o Mundo É Fino'] },
    intro: { en: ['Something tore the world open in {lugar}, and things crawl through. The wards can still be closed, one by one. {vilao} would rather they stayed open.'], pt: ['Algo rasgou o mundo em {lugar}, e coisas rastejam através dele. As proteções ainda podem ser fechadas, uma a uma. {vilao} prefere que fiquem abertas.'] },
    climax: { en: ['The last rift pulses like a heart. {vilao} guards it.'], pt: ['A última fenda pulsa como um coração. {vilao} a guarda.'] },
    fim: { en: ['The last rift seals with a sound like a sigh. The air is still again.'], pt: ['A última fenda se fecha com um som de suspiro. O ar volta a ficar parado.'] } },
  { id: 'escolta', nome: { en: 'Escort', pt: 'Escolta' }, resumo: { en: 'Someone who knows the way must cross the place alive.', pt: 'Alguém que conhece o caminho precisa atravessar o lugar com vida.' },
    truques: ['escolta'], faccao: 'bandidos', final: 'exit', alvo: { en: 'the guide', pt: 'o guia' },
    titulo: { en: ['Safe Passage', 'Through {lugar}', 'The Last Guide'], pt: ['Passagem Segura', 'Através de {lugar}', 'O Último Guia'] },
    intro: { en: ['Only I can wake the old way through {lugar}, and {vilao} wants me gone before I reach the other side. Protect me, and I will lead you out.'], pt: ['Só eu sei despertar o velho caminho através de {lugar}, e {vilao} quer me tirar do caminho antes que eu chegue ao outro lado. Protejam-me, e eu levo vocês até a saída.'] },
    climax: { en: ['The way out is right there. So is {vilao}.'], pt: ['A saída está logo ali. {vilao} também.'] },
    fim: { en: ['On the far side, the guide keeps the promise: the old way closes behind you, and {vilao} is left on the wrong side of it.'], pt: ['Do outro lado, o guia cumpre a promessa: o velho caminho se fecha atrás de vocês, e {vilao} fica do lado errado.'] } },
  { id: 'maquina', nome: { en: 'War machine', pt: 'Máquina de guerra' }, resumo: { en: 'The Legion is raising a siege engine deep inside: reach it and tear it down.', pt: 'A Legião monta uma arma de cerco no fundo do lugar: cheguem lá e destruam-na.' },
    truques: [null], faccao: 'legiao', final: 'destroy', alvo: { en: 'the engine', pt: 'a máquina' },
    titulo: { en: ['The Engine of {vilao}', 'Iron in {lugar}', 'Before the Walls Fall'], pt: ['A Máquina de {vilao}', 'Ferro em {lugar}', 'Antes que as Muralhas Caiam'] },
    intro: { en: ['The Legion hauled timber and iron into {lugar} for a week. Now we know why: {vilao} is building an engine that will bring down the walls of the city. Break it before it is finished.'], pt: ['A Legião levou madeira e ferro para {lugar} durante uma semana. Agora sabemos por quê: {vilao} está montando uma máquina que vai derrubar as muralhas da cidade. Quebrem-na antes que fique pronta.'] },
    climax: { en: ['There it stands, taller than the walls it was made to break. {vilao} guards it.'], pt: ['Lá está ela, mais alta que as muralhas que foi feita para derrubar. {vilao} a guarda.'] },
    fim: { en: ['The engine groans, leans and comes apart. The city will stand another day.'], pt: ['A máquina geme, se inclina e se desfaz. A cidade vai resistir mais um dia.'] } },
  { id: 'carga', nome: { en: 'Stolen cargo', pt: 'Carga roubada' }, resumo: { en: 'A caravan was raided: recover its cargo, crate by crate.', pt: 'Uma caravana foi saqueada: recuperem a carga, caixote por caixote.' },
    truques: [null], faccao: 'bandidos', final: 'counter', alvo: { en: 'the cargo', pt: 'a carga' },
    titulo: { en: ['The Raided Caravan', 'Crates of {lugar}', 'What {vilao} Took'], pt: ['A Caravana Saqueada', 'Os Caixotes de {lugar}', 'O Que {vilao} Levou'] },
    intro: { en: ['Three wagons of medicine and grain never reached the village. The raiders of {vilao} dragged the crates into {lugar}. Bring them back, all of them.'], pt: ['Três carroças de remédios e grãos nunca chegaram à aldeia. Os saqueadores de {vilao} arrastaram os caixotes para {lugar}. Tragam todos de volta.'] },
    climax: { en: ['{vilao} sits on the last crates like a dragon on its hoard.'], pt: ['{vilao} está sentado sobre os últimos caixotes como um dragão sobre o tesouro.'] },
    fim: { en: ['The crates are loaded again. The village will eat this winter.'], pt: ['Os caixotes estão carregados de novo. A aldeia vai comer neste inverno.'] } },
  { id: 'tenente', nome: { en: 'The lieutenant', pt: 'O tenente' }, resumo: { en: 'An enemy officer carries the orders: catch him before he flees.', pt: 'Um oficial inimigo carrega as ordens: peguem-no antes que fuja.' },
    truques: [null], faccao: 'legiao', final: 'boss', alvo: { en: 'the orders', pt: 'as ordens' },
    titulo: { en: ['The Lieutenant’s Orders', 'Catch {vilao}', 'Sealed Orders'], pt: ['As Ordens do Tenente', 'Peguem {vilao}', 'Ordens Lacradas'] },
    intro: { en: ['{vilao} carries sealed orders for the whole Legion and hides in {lugar} until nightfall. Catch the lieutenant there: once you are seen, there will be little time before the escape.'], pt: ['{vilao} carrega ordens lacradas para toda a Legião e se esconde em {lugar} até o anoitecer. Peguem o tenente lá: depois que vocês forem vistos, sobrará pouco tempo antes da fuga.'] },
    climax: { en: ['{vilao} sees you and shouts for the guard. There is little time.'], pt: ['{vilao} vê vocês e grita pela guarda. Há pouco tempo.'] },
    fim: { en: ['The seal breaks. The Legion’s plans are in your hands now.'], pt: ['O lacre se rompe. Os planos da Legião estão nas mãos de vocês.'] } },
  { id: 'pocos', nome: { en: 'Poisoned wells', pt: 'Poços envenenados' }, resumo: { en: 'A plague of the dead fouls the water: purify the springs.', pt: 'Uma praga dos mortos contamina a água: purifiquem as fontes.' },
    truques: [null], faccao: 'mortos', final: 'counter', alvo: { en: 'the springs', pt: 'as fontes' },
    titulo: { en: ['Black Water', 'The Springs of {lugar}', 'What Poisons {lugar}'], pt: ['Água Negra', 'As Fontes de {lugar}', 'O Que Envenena {lugar}'] },
    intro: { en: ['The water of {lugar} runs black, and those who drink it do not stay dead. {vilao} fouled the springs. Purify them before the plague reaches the villages.'], pt: ['A água de {lugar} corre negra, e quem a bebe não fica morto. {vilao} contaminou as fontes. Purifiquem-nas antes que a praga chegue às aldeias.'] },
    climax: { en: ['The source itself bubbles black here. {vilao} tends it.'], pt: ['A própria nascente borbulha negra aqui. {vilao} cuida dela.'] },
    fim: { en: ['The water clears. What rose from it lies still again.'], pt: ['A água clareia. O que se ergueu dela volta a ficar imóvel.'] } },
  { id: 'rei', nome: { en: 'The sleeping king', pt: 'O rei que dorme' }, resumo: { en: 'A necromancer is waking an ancient king: stop the rite before he rises for good.', pt: 'Um necromante está despertando um rei antigo: parem o rito antes que ele se levante de vez.' },
    truques: [null, 'selos'], faccao: 'mortos', final: 'boss', alvo: { en: 'the king', pt: 'o rei' },
    titulo: { en: ['The King Beneath {lugar}', 'Let Him Sleep', 'The Waking Crown'], pt: ['O Rei Sob {lugar}', 'Deixem-no Dormir', 'A Coroa que Desperta'] },
    intro: { en: ['{vilao} has found the tomb of a king who ruled these lands in blood, and is calling him back. The deeper you go into {lugar}, the closer he is to waking.'], pt: ['{vilao} achou a tumba de um rei que governou estas terras com sangue e o está chamando de volta. Quanto mais fundo vocês forem em {lugar}, mais perto ele estará de despertar.'] },
    climax: { en: ['The sarcophagus is open. The king sits up, and {vilao} laughs.'], pt: ['O sarcófago está aberto. O rei se senta, e {vilao} ri.'] },
    fim: { en: ['The king lies down again, this time for good.'], pt: ['O rei volta a se deitar, desta vez para sempre.'] } },
  { id: 'refugio', nome: { en: 'Refuge', pt: 'Refúgio' }, resumo: { en: 'Survivors hide in the ruins: carry them to the sanctuary.', pt: 'Sobreviventes se escondem nas ruínas: carreguem-nos até o santuário.' },
    truques: [null, 'ninhos'], faccao: 'feras', final: 'counter', alvo: { en: 'the survivors', pt: 'os sobreviventes' },
    titulo: { en: ['The Last Refuge', 'Sanctuary', 'Out of the Ruins'], pt: ['O Último Refúgio', 'Santuário', 'Fora das Ruínas'] },
    intro: { en: ['The beasts of {vilao} overran {lugar} in one night. A few survived, hidden and too hurt to walk. The old sanctuary at the far end still stands: carry them there.'], pt: ['As feras de {vilao} tomaram {lugar} em uma noite. Alguns sobreviveram, escondidos e feridos demais para andar. O velho santuário no extremo ainda está de pé: levem-nos até lá.'] },
    climax: { en: ['The sanctuary doors are right there. So is {vilao}.'], pt: ['As portas do santuário estão logo ali. {vilao} também.'] },
    fim: { en: ['Inside the sanctuary, the survivors sleep for the first time in days.'], pt: ['Dentro do santuário, os sobreviventes dormem pela primeira vez em dias.'] } }
];
/* names and places, by theme (the villain gets one of them when the pool has no named monster) */
const VOCAB_MAPA = {
  vilao: { en: ['the Ashen Prophet', 'the Rot-King', 'the Widow of Thorns', 'the Grey Captain', 'the Hollow Saint', 'the Red Hand'], pt: ['o Profeta Cinzento', 'o Rei da Podridão', 'a Viúva dos Espinhos', 'o Capitão Cinzento', 'o Santo Oco', 'a Mão Vermelha'] },
  masmorra: { en: ['the drowned crypt', 'the old keep', 'the undercity', 'the monastery ruins', 'the salt mines'], pt: ['a cripta afogada', 'a velha fortaleza', 'a cidade subterrânea', 'as ruínas do mosteiro', 'as minas de sal'] },
  ermo: { en: ['the Blackwood', 'the moors', 'the old quarry', 'the frozen pass', 'the burned village'], pt: ['a Mata Negra', 'os charcos', 'a velha pedreira', 'o passo congelado', 'a aldeia queimada'] },
  cripta: { en: ['the barrow of kings', 'the sunken ossuary', 'the chapel crypts', 'the catacombs'], pt: ['o túmulo dos reis', 'o ossuário afundado', 'as criptas da capela', 'as catacumbas'] },
  fortaleza: { en: ['the border fort', 'the old citadel', 'the watchtower', 'the baron\'s hall'], pt: ['o forte da fronteira', 'a velha cidadela', 'a torre de vigia', 'o salão do barão'] },
  aldeia: { en: ['Millbrook', 'the river hamlet', 'the market town', 'the orchard farms'], pt: ['Vila do Moinho', 'o povoado do rio', 'a vila do mercado', 'as fazendas do pomar'] },
  caverna: { en: ['the deep caves', 'the glowworm grotto', 'the flooded tunnels', 'the dragon\'s hollow'], pt: ['as cavernas profundas', 'a gruta dos vaga-lumes', 'os túneis alagados', 'a toca do dragão'] }
};
/* the monsters of each faction (types of the game) */
const FACCOES_MAPA = { bandidos: ['Bandit', 'Berserker', 'Mercenary', 'Harbinger'], mortos: ['Reanimate', 'Wight', 'Specter', 'Vampire'], culto: ['Zealot', 'Bloodsister', 'Doomcaller', 'Reanimate'], feras: ['Wolf', 'Fae', 'Golem', 'Salamander'], legiao: ['Centurion', 'Legionnaire', 'Harbinger', 'Berserker'] };

// ------------------------------------------------------------ gimmicks: a different way to play the map
const TRUQUES_MAPA = [
  { id: 'resgate', nome: { en: 'Rescue and escort', pt: 'Resgate e escolta' }, resumo: { en: 'Captives in several rooms: free them all, then the way out opens at the start.', pt: 'Prisioneiros em várias salas: libertem todos, e a saída se abre no início.' }, lados: 1 },
  // (the pieces that unlock: once three objectives apart, keys, levers and seals; the id stays 'selos' for the maps and premises
  // made before. Its story is a skin of HISTORIAS.pecas: with no test, or with a test that calls monsters)
  { id: 'selos', nome: { en: 'Pieces that unlock', pt: 'Peças que destravam' }, resumo: { en: 'Pieces spread over different rooms (keys, levers, seals, idols…, drawn with the story); the heart of the place stays shut until all are found or broken. With no test, or with a test that calls monsters.', pt: 'Peças espalhadas por salas diferentes (chaves, alavancas, selos, ídolos…, sorteadas com a história); o coração do lugar fica fechado até todas serem achadas ou quebradas. Sem teste, ou com um teste que chama monstros.' }, lados: 1 },
  { id: 'desabamento', nome: { en: 'Collapse', pt: 'Desabamento' }, resumo: { en: 'The place falls apart: a limit of rounds to reach the way out.', pt: 'O lugar desmorona: um limite de rodadas para alcançar a saída.' }, lados: 0 },
  { id: 'escolta', nome: { en: 'Escort', pt: 'Escolta' }, resumo: { en: 'A guide must cross alive: monsters may go for them, and the waystones answer only with the guide beside them.', pt: 'Um guia precisa atravessar com vida: os monstros podem ir atrás dele, e os marcos só respondem com o guia ao lado.' }, lados: 1 },
  { id: 'fera', nome: { en: 'The beast at large', pt: 'A fera à solta' }, resumo: { en: 'Follow three tracks to find the lair; the beast strikes on the way.', pt: 'Sigam três rastros para achar o covil; a fera ataca no caminho.' }, lados: 1 },
  { id: 'ninhos', nome: { en: 'Nests', pt: 'Ninhos' }, resumo: { en: 'Nests in several rooms breed monsters every two rounds while they stand; tearing one down takes a long test of might. The heart of the place stays shut until they all fall.', pt: 'Ninhos em várias salas geram monstros a cada duas rodadas enquanto estiverem de pé; derrubar um exige um longo teste de força. O coração do lugar fica fechado até que todos caiam.' }, lados: 1 }
];
/* complications: they do not carry a map on their own, but go into every map, one or two, somewhere along the way: a door
   locked until its pieces are found (1 to 3, no test: keys, levers, valves… a skin of HISTORIAS.pecas), a place where waves
   come until the way opens (a skin of HISTORIAS.ondas). The plan still draws among three (two of them pieces), as when keys
   and levers were apart */
const COMPLICACOES_MAPA = [
  { id: 'pecas', nome: { en: 'Pieces that unlock', pt: 'Peças que destravam' } },
  { id: 'ondas', nome: { en: 'Waves', pt: 'Ondas' } }
];
const COMPLICACAO = id => COMPLICACOES_MAPA.find(c => c.id === (id === 'chaves' || id === 'alavancas' ? 'pecas' : id)) || null;
const TRUQUE = id => TRUQUES_MAPA.find(t => t.id === id) || null;

// ------------------------------------------------------------ skins (historias.js)
/* the skins the maps of the campaign on screen already wear ('familia:id') */
function roupasDaCampanha() {
  const u = new Set(); if (typeof campanha === 'undefined' || !campanha) return u;
  (campanha.missoes || []).forEach(m => { const r = m && m.meta && m.meta.gerado && m.meta.gerado.roupas; if (r) Object.entries(r).forEach(([f, ids]) => [].concat(ids).forEach(id => u.add(f + ':' + id))); });
  return u;
}
/* does skin s fit the tags of the plan (f faction, t theme, a acts, p premise)? An empty list fits all; a null tag of the plan
   is not asked (a looser try) */
function cabeRoupa(s, tg) {
  const ok = (lista, v) => !lista || !lista.length || v == null || lista.includes(v);
  return ok(s.f, tg.f) && ok(s.t, tg.t) && ok(s.p, tg.p) && !((s.a || []).length && tg.a != null && !s.a.some(a => a <= tg.a));
}
/* a skin of family `fam` for the plan: one that fits its tags, not yet worn in this map or campaign (while there are others),
   the ones made for this very place, faction or premise a little likelier. filtro: what the mechanic needs (a mode, carriers
   still in the box); lista: the candidates, when not the whole family. Drawn with the plan's own rng of skins, so the rooms of
   a seed stay the same */
function roupaDe(plano, fam, filtro = () => true, lista = null, pesoExtra = null) {
  const todas = (lista || HIST(fam)).filter(filtro); if (!todas.length) return null;
  const tg = plano.tags || {}; const rng = plano.rngRoupas || rngDe((plano.semente || '') + '#roupas');
  for (const t of [tg, { ...tg, p: null }, { ...tg, p: null, t: null }, { a: tg.a }]) {
    const cabem = todas.filter(s => cabeRoupa(s, t)); if (!cabem.length) continue;
    const novas = cabem.filter(s => !plano.usadas?.has(fam + ':' + s.id)); const pool = novas.length ? novas : cabem;
    const pesos = {}; pool.forEach((s, i) => { pesos[i] = (1 + ['f', 't', 'p'].filter(k => (s[k] || []).length && t[k] != null && s[k].includes(t[k])).length * 0.5) * (pesoExtra ? pesoExtra(s) : 1); });
    const s = pool[+rng.pesado(pesos)];
    if (plano.usadas) plano.usadas.add(fam + ':' + s.id); plano.roupas = plano.roupas || {}; (plano.roupas[fam] = plano.roupas[fam] || []).push(s.id);
    return s;
  }
  return null;
}
/* can the box give the skin a carrier (a token always stands in) */
const temPortador = (s, atos) => !s.portadores || s.portadores.some(t => t === 'InteractToken' || (typeof daCaixa === 'function' ? daCaixa(t, atos) : true));
/* a text of a skin, filled: {n}, {w}… and the plan's words ({vilao}, {lugar}, {alvo}) */
const RT = (x, v, extra) => x ? preencher(x, { ...(v || {}), ...(extra || {}) }) : '';
/* the skins of a plan, drawn before the map is built: the villain, the story of the objective, of each complication, of the
   extra rule, of the clock, and who tells the story in the first room */
function escolherRoupas(plano, o) {
  const atos = plano.atos; const carrega = s => temPortador(s, atos);
  const t = plano.truque?.id;
  if (t === 'selos') { const modo = o.modoPecas === 'simples' || o.modoPecas === 'teste' ? o.modoPecas : null;
    plano.roupaTruque = roupaDe(plano, 'pecas', s => carrega(s) && (!modo || s.modo === modo)) || roupaDe(plano, 'pecas', s => !modo || s.modo === modo); }
  if (t === 'escolta') plano.roupaGuia = roupaDe(plano, 'escolta');
  if (t === 'resgate' || (!t && plano.premissa.id === 'resgate')) plano.roupaResgate = roupaDe(plano, 'resgate', carrega);
  // (the escape's collapse: a clock that fits running out of a place, a flood, a fire, a cave-in…)
  plano.roupaRelogio = t === 'desabamento' && plano.premissa.id === 'fuga' ? roupaDe(plano, 'relogio', s => (s.p || []).includes('fuga') || s.id === 'desabamento') : roupaDe(plano, 'relogio');
  plano.roupasComp = (plano.complicacoes || []).map(c => c === 'ondas' ? roupaDe(plano, 'ondas', carrega) || roupaDe(plano, 'ondas')
    : roupaDe(plano, 'pecas', s => s.modo === 'simples' && carrega(s)) || roupaDe(plano, 'pecas', s => s.modo === 'simples'));
  const m = plano.modalidade?.id; const R = k => roupaDe(plano, 'regras.' + k);
  if (m === 'mercador') plano.roupaRegra = R('mercador');
  if (m === 'aliado' || m === 'traidor') plano.roupaRegra = R('aliado');
  if (m === 'rivais') plano.roupaRegra = R('rivais');
  if (m === 'perseguidor') plano.roupaRegra = R('perseguidor');
  // who tells the story: a person or a clue of the first room (the premise's first ones are among them)
  const a = typeof ABERTURAS !== 'undefined' ? ABERTURAS[plano.premissa.id] : null;
  plano.roupaNpc = roupaDe(plano, 'aberturas.' + plano.premissa.id + '.npcs', () => true, (a ? [{ id: 'base', ...a.npc }] : []).concat(HIST('aberturas.' + plano.premissa.id + '.npcs')));
  plano.roupaPista = roupaDe(plano, 'aberturas.' + plano.premissa.id + '.pistas', () => true, (a ? [{ id: 'base', ...a.marca }] : []).concat(HIST('aberturas.' + plano.premissa.id + '.pistas')));
  // the chain of the map starts at the opening (the grammar's cadeia_inicial): who tells the story is drawn now, and the
  // villain after it, weighed by its links to the opening and to what the plan drew (step 3 of the narrative layer)
  plano.querNpc = rngDe(plano.semente + '#narrador')() < 0.5;
  const vil = escolherVilao(plano, t);
  if (vil) { plano.vilao = vil; plano.vocab.vilao = TXT(vil.nome); }
  plano.roteiro = roteiroDe(plano);
}
/* the anchor of the map's story: the opening that tells it (the person or the clue of the first room; with an escort, the
   guide), with what it plants and the question it opens. null when the opening has no narrative block */
function ancoraDe(plano) {
  const npc = plano.narrador ? plano.narrador === 'npcs' : plano.querNpc;
  if (plano.truque?.id === 'escolta' && plano.roupaGuia) return { familia: 'escolta', el: plano.roupaGuia, npc: true };
  const el = npc ? plano.roupaNpc : plano.roupaPista; if (!el) return null;
  return { familia: 'aberturas.' + plano.premissa.id + '.' + (npc ? 'npcs' : 'pistas'), el, npc };
}
/* what the plan drew that a villain may be linked to (family, element) */
const elementosDoPlano = plano => [['pecas', plano.roupaTruque], ['escolta', plano.roupaGuia], ['resgate', plano.roupaResgate], ['relogio', plano.roupaRelogio]]
  .concat((plano.roupasComp || []).map((r, k) => [(plano.complicacoes || [])[k] === 'ondas' ? 'ondas' : 'pecas', r])).filter(([, e]) => e && e.id);
/* how a villain ties to the chain: the premise it serves (its purposes, what its entrance must take up), the opening's
   faction, the places of the plan, and the links of the stories file to the elements drawn */
function ligacoesDoVilao(plano, v, trq) {
  const n = v.narrativa || {}; const an = ancoraDe(plano); const pr = plano.premissa.id;
  const premissa = (v.p || []).includes(pr) || (n.entrada_deve_retomar || []).includes(pr) || (trq && (n.entrada_deve_retomar || []).includes(trq)) ? 1 : 0;
  const faccao = an && (an.el.f || []).length && (v.f || []).some(f => an.el.f.includes(f)) ? 1 : 0;
  const amb = [plano.tema, plano.tema2].filter(Boolean).filter(x => (n.ambientes_compativeis || v.t || []).includes(x)).length;
  const pontes = elementosDoPlano(plano).reduce((m, [fam, e]) => m + forcaEntre('viloes', v.id, fam, e.id), 0);
  return { premissa, faccao, amb, pontes, total: premissa + faccao + amb + (pontes > 0 ? 1 : 0) };
}
/* the villain: of the premise's faction, linked to the chain (the grammar's fallback: a villain with no link to what came
   before is left out, when another has one), the stronger links weighing more */
function escolherVilao(plano, trq) {
  const daFaccao = s => !(s.f || []).length || s.f.includes(plano.premissa.faccao);
  const ligados = HIST('viloes').filter(s => daFaccao(s) && ligacoesDoVilao(plano, s, trq).total > 0);
  const filtro = ligados.length ? s => ligados.includes(s) : daFaccao;
  return roupaDe(plano, 'viloes', filtro, null, s => { const l = ligacoesDoVilao(plano, s, trq); return 1 + l.premissa * 1.5 + l.faccao * 1.5 + Math.min(2, l.amb) * 0.5 + Math.min(4, l.pontes / 8); });
}
/* the story's chain, as the generator follows it: the anchor (what it plants, the question, what the climax must take up),
   the villain and its links */
function roteiroDe(plano) {
  const an = ancoraDe(plano); const n = (an && an.el.narrativa) || {};
  return { abertura: an ? { familia: an.familia, id: an.el.id || null, nome: TXT(an.el.nome || ''), npc: an.npc, pergunta: n.pergunta_que_abre || null, planta: n.planta || [], retorno: n.retorno_no_climax || null, proximas: n.proximas_categorias_preferidas || [] } : null,
    vilao: plano.vilao ? { id: plano.vilao.id, ligacoes: ligacoesDoVilao(plano, plano.vilao, plano.truque?.id) } : null };
}
/* the skins a map wears (drawn with the plan and used by the building): recorded in meta.gerado, so the next maps of the
   campaign draw others. A skin drawn and left unused (a clock with no pressure) does not count */
function roupasVestidas(plano) {
  const r = {}; const por = (fam, s) => { if (s && s.id) (r[fam] = r[fam] || []).includes(s.id) || r[fam].push(s.id); };
  por('viloes', plano.vilao); if (plano.truque?.id === 'selos') por('pecas', plano.roupaTruque); if (plano.escolta) por('escolta', plano.roupaGuia);
  if (plano.resgateContador) por('resgate', plano.roupaResgate); if (plano.relogioUsado) por('relogio', plano.roupaRelogio);
  (plano.feitas || []).forEach(f => { if (f.roupa) (r[f.id === 'ondas' ? 'ondas' : 'pecas'] = r[f.id === 'ondas' ? 'ondas' : 'pecas'] || []).push(f.roupa); });
  const m = plano.modalidade?.id; if (plano.roupaRegra && ['mercador', 'aliado', 'traidor', 'rivais', 'perseguidor'].includes(m)) por('regras.' + (m === 'traidor' ? 'aliado' : m), plano.roupaRegra);
  if (plano.narrador) por('aberturas.' + plano.premissa.id + '.' + plano.narrador, plano.narrador === 'npcs' ? plano.roupaNpc : plano.roupaPista);
  return r;
}

// ------------------------------------------------------------ the beats
/* the story moments of a map by length, and the archetypes that tell each one */
/* (the map opens with a quiet room that sets the scene; an exploration room comes after a fight, as a breath: a map that
   began with a room of searches was a slow start) */
const CURVAS_MAPA = { curta: ['gancho', 'tensao', 'climax'], media: ['gancho', 'tensao', 'exploracao', 'confronto', 'respiro', 'climax'], longa: ['gancho', 'tensao', 'exploracao', 'confronto', 'recompensa', 'tensao', 'respiro', 'climax'] };
const ARQUETIPOS_DA_FUNCAO = { gancho: { abertura: 1 }, exploracao: { exploracao: 3, obstaculo: 1, corredor: 1 }, tensao: { emboscada: 3, corredor: 2, obstaculo: 1 }, confronto: { arena: 2, emboscada: 1, obstaculo: 1 }, respiro: { respiro: 1 }, recompensa: { tesouro: 1 }, climax: { chefe: 1 }, fuga: { corredor: 2, obstaculo: 1 } };
/* the archetypes of a beat, by weight (the climb of Act II is chanceDeAlto's) */
const pesosDaFuncao = f => ARQUETIPOS_DA_FUNCAO[f] || { exploracao: 1 };
/* a room of the way with raised parts (any kind of room: the height is for the eyes of the table, and a passage, never a
   dead end): Act II climbs more, as its maps do */
const chanceDeAlto = (f, atos) => ['respiro', 'recompensa', 'gancho'].includes(f) ? 0 : atos === 1 ? 0.25 : f === 'confronto' ? 0.6 : f === 'climax' ? 0.35 : 0.5;
const INTENSIDADE_DA_FUNCAO = { gancho: 0, exploracao: -2, tensao: 0, confronto: 1, respiro: 0, recompensa: -1, climax: 3, fuga: 0 };

function planejarMapa(o) {
  const rng = rngDe(o.semente + '#plano');
  const prem = PREMISSAS_MAPA.find(x => x.id === o.premissa) || rng.pick(PREMISSAS_MAPA);
  const truque = o.truque === 'nenhum' ? null : TRUQUE(o.truque === 'auto' || !o.truque || !TRUQUE(o.truque) ? (rng() < 0.75 ? prem.truques[0] : rng.pick(prem.truques)) : o.truque);
  const curva = CURVAS_MAPA[o.duracao || 'media'].slice();
  // a breath before the last fight (as Hades' fountain before the boss): the respite, when there is one, goes right before the climax
  const ir = curva.indexOf('respiro'); if (ir >= 0 && ir !== curva.length - 2 && curva.length > 3) { curva.splice(ir, 1); curva.splice(curva.length - 1, 0, 'respiro'); }
  const modalidade = MODALIDADE(o.modalidade === 'auto' ? rng.pesado({ classica: 3, cronica: 2, altares: 2, campeao: 2, perseguidor: 1.5, encruzilhada: 2, corredor: 1.5, cofre: 1.5, barulho: 1.5, rivais: 1.5, mare: 1.5, mercador: 1.5, traidor: truque && ['escolta', 'resgate'].includes(truque.id) ? 2 : 0.75, ...(truque?.id === 'escolta' ? {} : { aliado: 1.5 }) }) : (o.modalidade || 'classica')) || MODALIDADE('classica');   // (no mode asked: the classic map)
  // (Easy: the simulation of the level, a party of two with 8 health each, fell in the first big fight with the base at 3
  // and the climax at +3: Easy starts at 2 and its fights climb gentler, at most 5)
  const facil = o.dificuldade === 'facil'; const base = { facil: 2, normal: 5, dificil: 7 }[o.dificuldade || 'normal'] || 5;
  const intensidadeDe = (f, i) => facil ? Math.max(1, Math.min(f === 'climax' ? 4 : 5, base + Math.min(2, INTENSIDADE_DA_FUNCAO[f] || 0) + Math.floor(i / 4))) : Math.max(1, Math.min(10, base + (INTENSIDADE_DA_FUNCAO[f] || 0) + Math.floor(i / 3)));
  const batidas = curva.map((f, i) => ({ funcao: f, arquetipo: f === 'gancho' ? rng.pesado(ARQUETIPOS_DA_FUNCAO.gancho) : rng.pesado(pesosDaFuncao(f)), intensidade: f === 'gancho' || f === 'respiro' ? 0 : intensidadeDe(f, i), papel: 'eixo' }));
  // the defence is fought where the map ends: the last room is the stand
  if (prem.id === 'defesa') batidas[batidas.length - 1].arquetipo = 'arena';
  if (prem.id === 'selos' || prem.final === 'counter') batidas[batidas.length - 1].arquetipo = rng.pesado({ chefe: 1, arena: 1 });
  // complications (the waves are the end itself of the defence) and the side rooms that hold their keys and levers
  // at most two locks in a map (Dormans: two cycles are enough to feel made by hand); a gimmick that locks counts as one
  const nComp = Math.max(0, Math.min({ curta: 1, media: rng.int(1, 2), longa: 2 }[o.duracao || 'media'] || 1, 2 - (truque && ['selos', 'fera', 'ninhos'].includes(truque.id) ? 1 : truque?.id === 'escolta' ? 2 : 0) - (modalidade.id === 'cofre' ? 1 : 0))) * (modalidade.semComplicacoes ? 0 : 1);
  // (drawn among three, two of them pieces, as when keys and levers were apart: a map may have two locks of pieces)
  const complicacoes = rng.embaralhar(['chaves', 'alavancas', 'ondas'].filter(c => !(prem.id === 'defesa' && c === 'ondas'))).slice(0, nComp).map(c => c === 'ondas' ? c : 'pecas');
  const lados = Math.min(Math.max(0, batidas.length - 2) + 2, (truque ? truque.lados : 0) + complicacoes.filter(c => c !== 'ondas').length + (o.duracao === 'longa' ? 1 : 0) + (modalidade.lados || 0));
  // a detour promises and pays: a guarded treasure (a challenge, then the reward). It hangs from a calm room of the way,
  // never from the big fight (a hard fight right after a hard fight wore the party out); an ambush only off a calm room
  const calmos = curva.map((f, i) => i).filter(i => i > 0 && i < curva.length - 1 && !['confronto', 'tensao'].includes(curva[i]));
  const pais = calmos.length ? calmos : curva.map((f, i) => i).filter(i => i > 0 && i < curva.length - 1 && curva[i] !== 'confronto');
  for (let k = 0; k < lados; k++) { const pai = pais.length ? pais[k % pais.length] : 1 + (k % Math.max(1, curva.length - 2));
    batidas.push({ funcao: 'recompensa', arquetipo: ['exploracao', 'respiro'].includes(curva[pai]) ? rng.pesado({ tesouro: 3, emboscada: 1 }) : 'tesouro', intensidade: Math.max(1, base - 2), papel: 'lado', pai }); }
  batidas.forEach(b => { if (b.arquetipo === 'respiro' || b.funcao === 'gancho') b.inimigos = 'nenhum'; });
  { const ra = rngDe(o.semente + '#alto'); batidas.forEach(b => { if (b.papel === 'eixo' && ra() < chanceDeAlto(b.funcao, o.atos === 1 ? 1 : 2)) b.alto = true; }); }
  // Act II: half the maps raise the platform (the box with its top at level 3) in a room on levels of the way
  if (o.atos !== 1 && rng() < 0.5) { const cands = batidas.filter(b => b.papel === 'eixo' && b.alto); if (cands.length) rng.pick(cands).plataforma = true; }
  // a point of no return along the way (medium and long maps): once through, the rooms behind leave the table (their
  // tiles and pieces go back to the box for the rooms ahead). The room before it is sometimes raised: the heroes jump down
  if ((o.duracao === 'media' || o.duracao === 'longa') && prem.id !== 'resgate' && truque?.id !== 'resgate' && truque?.id !== 'escolta' && rng() < (o.duracao === 'longa' ? 0.8 : 0.65)) {   // (a long map leaves its first rooms behind more often: the table stays small)
    // (a gimmick, or a premise of pieces to gather, hides its things in the rooms past that point: then it comes early, to
    // leave them rooms enough)
    const k = rng.int(2, truque || ['carga', 'pocos', 'refugio'].includes(prem.id) ? Math.max(2, Math.floor((curva.length - 1) / 2)) : curva.length - 2); batidas[k].semRetorno = true;
    // how: a jump from a ledge, a gate that slams shut, the ceiling giving way, a trapdoor or runes that carry them away
    const estilo = rng.pesado({ salto: 3, portao: 2, desabamento: 1.5, alcapao: 2, teleporte: o.atos === 1 ? 2 : 3 });
    if (estilo === 'alcapao' || estilo === 'teleporte') batidas[k].solta = estilo; else batidas[k].estilo = estilo;
    if (rng() < 0.5 && ['exploracao', 'tensao', 'confronto'].includes(batidas[k - 1].funcao)) batidas[k - 1].alto = true;
    // a long map may have a second one further on
    if (o.duracao === 'longa' && !truque && k + 2 <= curva.length - 2 && rng() < 0.6) { const k2 = rng.int(k + 2, curva.length - 2); batidas[k2].semRetorno = true;
      const e2 = rng.pesado({ salto: 3, portao: 2, desabamento: 1.5, alcapao: 2, teleporte: 2 }); if (e2 === 'alcapao' || e2 === 'teleporte') batidas[k2].solta = e2; else batidas[k2].estilo = e2; } }
  // the rooms before the first point of no return leave the table with it: when no fight happens there (or the point comes
  // early), they are simple (one tile, few things): the table is not set up only to be taken down
  { const eixoI = batidas.map((b, i) => i).filter(i => batidas[i].papel === 'eixo'); const kp = eixoI.find(i => i > 0 && (batidas[i].semRetorno || batidas[i].solta));
    if (kp != null) { const antes = eixoI.filter(i => i < kp); const luta = antes.some(i => ['tensao', 'confronto', 'climax'].includes(batidas[i].funcao) && batidas[i].inimigos !== 'nenhum');
      antes.forEach(i => { if (!luta || kp <= 2 || batidas[i].funcao === 'gancho') { batidas[i].simples = true; delete batidas[i].alto; delete batidas[i].plataforma; } }); } }
  // a bridge (Act II, a map in three or so): one room of the way gets it, its kind by the room (between raised tiles in a room
  // on levels; over the underlay elsewhere, now and then fragile). Its own draws: the plan of a seed stays the same
  { const rp = rngDe(o.semente + '#pontes'); if (o.atos !== 1 && (o.ponte || rp() < 0.35)) { const cs = batidas.filter(b => b.papel === 'eixo' && !['climax', 'gancho'].includes(b.funcao) && !b.solta && !b.simples);
    if (cs.length) { const b = rp.pick(cs); b.ponte = o.ponte && o.ponte !== true ? o.ponte : b.alto ? 'alta' : rp() < 0.12 ? 'fragil' : 'baixa';   /* (the fragile one is a rare event) */ } } }
  // (asked for: the vault; a room apart, reached by a trapdoor, where it goes)
  if (o.cripta && !batidas.some(b => b.solta) && batidas.length > 3) { const k = Math.max(2, batidas.filter(b => b.papel === 'eixo').length - 2); if (batidas[k]) { batidas[k].semRetorno = true; batidas[k].solta = 'alcapao'; } }
  // the viaduct (half the medium and long maps): the way goes through a room, on through another, then comes back over the
  // first on a walkway on pillars, leaving from the raised part of a room on levels. A beat of its own, before a room of the
  // way; its own draws
  { const rv = rngDe(o.semente + '#viaduto'); if (o.duracao !== 'curta' && o.atos !== 1 && (o.viaduto || rv() < 0.7)) { const eixoIdx = batidas.map((b, i) => i).filter(i => batidas[i].papel === 'eixo');
    const ks = eixoIdx.filter(i => i >= 3 && i <= eixoIdx.length - 2 && !batidas[i].semRetorno && !batidas[i].solta && !batidas[i - 1].semRetorno && !batidas[i - 1].solta && !batidas[i - 1].simples && batidas[i].funcao !== 'climax');
    if (ks.length) { const k = rv.pick(ks); batidas[k - 1].alto = true; batidas[k - 1].altoParaViaduto = true; if (!['exploracao', 'arena', 'obstaculo', 'emboscada'].includes(batidas[k - 1].arquetipo)) batidas[k - 1].arquetipo = 'exploracao'; batidas[k - 1].tamanhoMin = 'M'; [k - 2, k - 3].forEach(j => { if (batidas[j] && !batidas[j].semRetorno) { delete batidas[j].alto; delete batidas[j].plataforma; delete batidas[j].ponte; } });   /* (the rooms it crosses over stay low) */
      batidas.forEach(b => { if (b.papel === 'lado' && typeof b.pai === 'number' && b.pai >= k) b.pai++; });
      /* (the medium pillars wait for it: three for the raised floor it leaves from, three or four for the walkway) */
      batidas.forEach((b, j) => { if (j < k - 1 || (b.papel === 'lado' && typeof b.pai === 'number' && b.pai < k)) b.reservaPilar = 6; }); batidas[k - 1].reservaPilar = 3;
      batidas.splice(k, 0, { funcao: 'exploracao', arquetipo: 'corredor', intensidade: 0, papel: 'eixo', viaduto: true, inimigos: 'nenhum' }); } } }
  const tema = o.tema && o.tema !== 'qualquer' ? o.tema : rng.pick(Object.keys(TEMAS_SALA).filter(t => t !== 'qualquer'));
  // two places in one map, now and then (medium and long maps): the way leaves the first and goes into another (the wilds
  // into a cave, a cave into a crypt…); the room where it changes tells it, as a scene would. Best at a point of no return
  // (a trapdoor, a jump, a gate); its own draws
  let tema2 = null, kTema = null;
  { const rt = rngDe(o.semente + '#temas'); if (o.duracao !== 'curta' && o.combinarTemas !== false && (o.tema2 || rt() < 0.45)) {
    const eixoI = batidas.map((b, i) => i).filter(i => batidas[i].papel === 'eixo'); const meio = eixoI.filter(i => i >= 2 && i <= eixoI.length - 2 && batidas[i].funcao !== 'climax' && !batidas[i].viaduto && !batidas[i - 1]?.viaduto);
    if (meio.length) { const pontos = meio.filter(i => batidas[i].semRetorno || batidas[i].solta); kTema = pontos.length ? rt.pick(pontos) : rt.pick(meio);
      tema2 = o.tema2 && TEMAS_SALA[o.tema2] && o.tema2 !== tema ? o.tema2 : rt.pick(Object.keys(TEMAS_SALA).filter(t => t !== 'qualquer' && t !== tema));
      batidas.forEach((b, i) => { if ((b.papel === 'eixo' && i >= kTema) || (b.papel === 'lado' && typeof b.pai === 'number' && b.pai >= kTema)) b.tema = tema2; });
      batidas[kTema].transicao = { de: tema, para: tema2 }; } } }
  // the wilds stand on the ground: no raised floors, platforms, walkways or high bridges there
  batidas.forEach((b, i) => { if ((b.tema || tema) !== 'ermo') return; delete b.alto; delete b.plataforma; delete b.altoParaViaduto; delete b.tamanhoMin; if (b.ponte === 'alta') b.ponte = 'baixa';
    if (b.viaduto) delete b.viaduto; });
  const vilaoPadrao = rng.pick(VOCAB_MAPA.vilao[LP()]); const lugar = rng.pick((VOCAB_MAPA[tema] || VOCAB_MAPA.masmorra)[LP()]);
  const plano = { premissa: prem, truque, complicacoes, batidas, tema, tema2, base, vocab: { vilao: vilaoPadrao, lugar, alvo: TXT(prem.alvo), n: 3 }, semente: o.semente, atos: o.atos === 1 ? 1 : 2, modalidade, dificuldade: o.dificuldade || 'normal' };
  // the stories, before anything is built (each brings its own rules of placement); their own rng keeps the plan of a seed
  plano.tags = { f: prem.faccao, t: tema, a: plano.atos, p: prem.id }; plano.rngRoupas = rngDe(o.semente + '#roupas'); plano.usadas = roupasDaCampanha(); plano.roupas = {};
  escolherRoupas(plano, o);
  return plano;
}

// ------------------------------------------------------------ building the map
/* the monsters of the premise's faction, from the Workshop into the pool (when the pool is empty), and the villain: a
   boss of the Workshop (named or villain), of the faction when there is one */
function prepararPool(pm, faccao, rng, atos = 2, dificuldade = 'normal') {
  const tipos = FACCOES_MAPA[faccao] || FACCOES_MAPA.bandidos;
  prepararReserva(pm, atos, rng, tipos, 3, dificuldade === 'facil' ? 1 : 0);
  const chefes = daOficina(atos).chefes; const daFaccao = chefes.filter(m => tipos.includes(m.tipo));
  return (daFaccao.length ? rng.pick(daFaccao) : chefes.length ? rng.pick(chefes) : null) || null;
}
/* one room of the plan, born at an edge of its parent (the best of a dozen candidates) */
function salaDoPlano(pm, b, plano, rng, notas, lado = {}) {
  const agua = plano.modalidade?.id === 'mare' && b.papel === 'eixo' ? { alfombraForcada: ['underlay-water', 'underlay-fetidwater'] } : {};
  const opts = { ...agua, moverInimigos: true, ...(b.reservaPilar ? { reservaPilares: { Pillar: b.reservaPilar } } : {}), ...(b.alto ? { alto: b.altoParaViaduto ? 2 : 1 } : {}), ...(b.plataforma ? { plataforma: true } : {}), ponte: b.ponte || 'nao', tagsRoupas: plano.tags, arquetipo: b.arquetipo, tamanho: b.funcao === 'climax' ? 'G' : b.simples ? 'P' : (b.tamanhoMin || b.semRetorno) ? rng.pick(['M', 'G']) : rng.pick(['P', 'M', 'M', 'G']), ...(b.simples ? { pecasMax: 1 } : {}), intensidade: b.intensidade || 5, tema: b.tema || plano.tema, ...((b.tema || plano.tema) === 'ermo' ? { semAlto: true } : {}), objetos: b.simples ? 'poucos' : 'normal', inimigos: b.inimigos || 'balanceado', funcao: b.funcao, projeto: pm, atos: plano.atos, ...(lado.convivem ? { convivem: lado.convivem } : {}), ...(lado.permitidos ? { mesaDoAbridor: lado.permitidos } : {}) };
  const permitido = i => !lado.permitidos || lado.permitidos.includes(i);
  const abre = b.funcao === 'climax' ? 'porta' : b.semRetorno && b.estilo === 'portao' && daCaixa('Gate', plano.atos) ? 'Gate' : b.semRetorno && b.estilo === 'desabamento' ? 'Door' : 'random';
  if (!pm.salas.length) { const r = gerarCandidatos({ ...opts, semente: plano.semente + '/' + b.funcao + '0' }, 16); return r.candidatos[0] || null; }
  const pai = b.pai ?? pm.salas.length - 1;
  // a point of no return far from the map: a trapdoor into the depths, or runes that carry the heroes away. The room is
  // laid apart (it touches nothing); the object that takes them there is set in the parent afterwards
  if (b.semRetorno && b.solta && (lado.ponto || b.deCripta)) { const cs = pm.salas.flatMap(x => x.pecas.flatMap(q => casasDaPeca(q)));
    const x0 = Math.max(...cs.map(c => c[0])) + 8, y0 = Math.min(...cs.map(c => c[1]));
    // (in Act II the room apart is now and then the vault, the inside of the box: reached only this way)
    const cripta = plano.atos === 2 && PECA.vault && !pm.salas.some(s => s.pecas.some(q => q.tile === 'vault')) && (plano.tema === 'cripta' || rng() < 0.5) ? { pecaEspecial: 'vault' } : {};
    const r = gerarCandidatos({ ...opts, ...cripta, origem: [x0, y0], semente: plano.semente + '/' + pm.salas.length + '/solta' }, 10);
    if (r.candidatos[0]) return { ...r.candidatos[0], _solta: true }; }
  // a compact map (it must fit on a real table): the room goes where the rooms on the table grow least, the outline of the
  // set kept near a square. Of the first two edges that give a room, the candidate that grows the table least wins
  const mesa = mesaCompacta(pm, plano.solto ? [] : lado.permitidos, plano.solto ? pai : null);
  opts.atrator = mesa.centro;
  // (a room squeezed under the size of its kind pays for it: the table is not won by cramped rooms)
  const arqB = ARQUETIPO_SALA(b.arquetipo); const a0 = arqB?.area?.[0] || 0;
  // (a room that leaves no free edge for the rooms after it closes the map: it pays, unless it is the last one)
  // (…and a room of the way must not shut the last free edge of a room that still waits for its detour)
  const eixoFeito = plano.eixoFeito || [];
  const esperam = [...new Set(plano.batidas.filter(x => x !== b && x.papel === 'lado' && x.sala == null && x.pai != null && typeof x.pai === 'number' && !x._feito).map(x => eixoFeito[Math.min(eixoFeito.length - 2, x.pai)]).filter(i => i != null && pm.salas[i]))];
  const ocupMapa = mesa.solto ? null : casasOcupadas(pm, -1);
  const pecasDe = l => l.filter(q => !ehAlfombra(q.tile)).flatMap(q => casasDaPeca(q));
  const bordaLivre = (cs, ocupado) => { for (const [x, y] of cs) for (const [dx, dy] of VIZ4) { const ex = x + dx, ey = y + dy; if (ocupado(ex, ey)) continue; let livre = 0;
      for (let k = 1; k <= 5; k++) for (let l = -3; l <= 3; l++) { const ax = ex + dx * k + (dy ? l : 0), ay = ey + dy * k + (dx ? l : 0); if (!ocupado(ax, ay)) livre++; }   /* (room for a tile and its margin) */
      if (livre >= 33) return true; }
    return false; };
  const esperaAntes = new Map(esperam.map(i => [i, ocupMapa ? bordaLivre(pecasDe(pm.salas[i].pecas), (x, y) => ocupMapa.has(x + ',' + y)) : false]));
  const temSaida = c => { if (!ocupMapa) return true; const cs = pecasDe(c.sala.pecas); const minha = new Set(cs.map(([x, y]) => x + ',' + y)); const ocupado = (x, y) => ocupMapa.has(x + ',' + y) || minha.has(x + ',' + y);
    if (b.funcao !== 'climax' && !bordaLivre(cs, ocupado)) return false;
    return esperam.every(i => !esperaAntes.get(i) || bordaLivre(pecasDe(pm.salas[i].pecas), ocupado)); };
  const escolher = (lista, n = mesa.solto ? 1 : 3) => { let melhor = null, nm = Infinity, achados = 0;
    for (const [pt, f] of lista) { const r = f(pt); if (!r.candidatos.length) continue; achados++;
      r.candidatos.filter(c => (c.nota || 0) >= (r.candidatos[0].nota || 0) - 12).forEach(c => { const v = mesa.custo(c.sala.pecas.flatMap(q => casasDaPeca(q))) * mesa.giro(pt) - (c.nota || 0) * 1.5
        - (b.plataforma && c.sala.pecas.some(q => q.tile === 'platform') ? 1e5 : 0) - (b.ponte && b.ponte !== 'nao' && c.sala.objetos.some(o => ehTipo(o, 'Bridge')) ? 1e5 : 0) + (b.inimigos !== 'nenhum' && ['climax', 'confronto', 'tensao'].includes(b.funcao) && !(c.sala.inimigos || []).length ? 5e4 : 0) + Math.max(0, a0 - (c.medidas?.area || 0)) * 4 + (temSaida(c) ? 0 : 1e4);   /* (what the plan asked for wins over a smaller table) */ if (v < nm) { nm = v; melhor = c; } });
      if (achados >= n) break; }
    return melhor; };
  // the point of no return: first a ledge of the parent (the heroes jump down), when it has one
  if ((b.semRetorno && (b.estilo === 'salto' || b.solta)) || b.desceDoViaduto != null) { const c = escolher(mesa.ordenar(pontosDeLigacao(pm, true).filter(pt => pt.sala === pai && pt.nivel > 0 && (b.desceDoViaduto == null || pt.nivel === 2) && (!b.pontosMuro || b.pontosMuro.has(pt.casa.join(',')))), rng).slice(0, 6).map(pt => [pt, pt => gerarCandidatos({ ...opts, ligacao: pt, abridor: 'SightToken', semente: plano.semente + '/' + pm.salas.length + '/s' + pt.casa.join('_') }, 10)]));
    if (c) return c; }
  // edges of the parent, those that grow the table least first
  const pts = mesa.ordenar(pontosDeLigacao(pm).filter(pt => pt.sala === pai), rng);
  // (a gate that fits nowhere: a plain door, and the ceiling gives way behind instead)
  for (const ab of abre === 'Gate' ? ['Gate', 'random'] : [abre]) {
    const c = escolher(pts.slice(0, 5).map(pt => [pt, pt => gerarCandidatos({ ...opts, ligacao: pt, abridor: ab, semente: plano.semente + '/' + pm.salas.length + '/' + pt.casa.join('_') + (ab === abre ? '' : '/p') }, 8)]));
    if (c) return c;
  }
  // no room fits after its parent: the climax (and a room of the way) tries from the rooms before it, a smaller one last
  // (a side room tries from the other rooms of the way, the last one excepted: nothing hangs after the end)
  const outros = b.papel === 'eixo' ? pm.salas.map((x, i) => i).filter(i => i !== pai).reverse().slice(0, 4)
    : (plano.eixoFeito || []).filter(i => i !== pai && i !== plano.eixoFeito[plano.eixoFeito.length - 1] && !['confronto', 'climax'].includes(pm.salas[i].funcao)).reverse().concat(pm.salas.map((x, i) => i).filter(i => !(plano.eixoFeito || []).includes(i))).sort((a, b) => (a === 0) - (b === 0));   // (the opening room last)   // (a detour never hangs from the big fight)
  for (const outro of outros.filter(permitido)) {
    for (const pt of mesa.ordenar(pontosDeLigacao(pm).filter(q => q.sala === outro), rng).slice(0, b.papel === 'eixo' ? 4 : 8)) {
      const r = gerarCandidatos({ ...opts, tamanho: b.funcao === 'climax' ? 'M' : 'P', ligacao: pt, abridor: abre, semente: plano.semente + '/' + pm.salas.length + '/o' + pt.casa.join('_') }, 10);
      if (r.candidatos[0]) return r.candidatos[0]; } }
  // (a room of the way asked for height or size that fits nowhere: a plain one then, rather than none)
  if (b.papel === 'eixo' && (b.alto || b.tamanhoMin || b.plataforma) && !b._simples) { const b2 = { ...b, _simples: true }; ['alto', 'altoParaViaduto', 'tamanhoMin', 'plataforma'].forEach(k => delete b2[k]);
    const c = salaDoPlano(pm, b2, plano, rng, [], lado); if (c) return c; }
  if (!estoquePecas(pm, b.tema || plano.tema, -1, plano.atos, lado.convivem).length) notas.push(L2('The box ran out of tiles for this theme: the map has one room less (' + b.arquetipo + ').', 'A caixa ficou sem peças para este tema: o mapa tem uma sala a menos (' + b.arquetipo + ').'));
  else notas.push(L2('No room fitted after room ' + (pai + 1) + ' (' + b.arquetipo + ').', 'Nenhuma sala coube depois da sala ' + (pai + 1) + ' (' + b.arquetipo + ').'));
  return null;
}
/* the table of a map (the rooms of one set, between points of no return): its outline, the cost of a room laid there (the
   area of the outline, more when it stretches), the edges in order (those that grow it least first) and, on a map in a
   spiral, the turn: the way keeps turning the same side */
function mesaCompacta(pm, permitidos, solto = null) {
  // (loose, as before the compact table: the edges that lead away from the rest of the map first)
  if (solto != null) { const cx = pm.salas.flatMap(s => s.pecas.flatMap(q => casasDaPeca(q))); const doPai = (pm.salas[solto]?.pecas || []).flatMap(q => casasDaPeca(q));
    const media = (l, k) => l.length ? l.reduce((a, c) => a + c[k], 0) / l.length : 0; const mx = media(cx, 0), my = media(cx, 1), px = media(doPai, 0), py = media(doPai, 1);
    return { custo: () => 0, giro: () => 1, centro: null, solto: true, ordenar: (pts, rng) => pts.map(pt => ({ pt, n: pt.dir[0] * (px - mx + pt.dir[0] * 2) + pt.dir[1] * (py - my + pt.dir[1] * 2) + pt.livre * 0.05 + rng() })).sort((a, b) => b.n - a.n).map(x => x.pt) }; }
  const idx = permitidos && permitidos.length ? permitidos : pm.salas.map((x, i) => i);
  const cs = idx.flatMap(i => (pm.salas[i]?.pecas || []).filter(q => !ehAlfombra(q.tile)).flatMap(q => casasDaPeca(q)));
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; cs.forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); });
  const vazia = !cs.length;
  const custo = novas => { let a0 = x0, a1 = x1, b0 = y0, b1 = y1; novas.forEach(([x, y]) => { a0 = Math.min(a0, x); a1 = Math.max(a1, x); b0 = Math.min(b0, y); b1 = Math.max(b1, y); });
    const w = a1 - a0 + 1, h = b1 - b0 + 1; return w * h * (1 + 0.3 * Math.max(0, Math.max(w, h) / Math.min(w, h) - 1.3)); };
  const plano = pm._plano || {}; const ult = plano.ultimaDir; const giroS = plano.espiral || 0;
  const giro = pt => { if (!ult || !giroS || !pt) return 1; const vira = [-ult[1] * giroS, ult[0] * giroS]; if (pt.dir[0] === vira[0] && pt.dir[1] === vira[1]) return 0.8; if (pt.dir[0] === ult[0] && pt.dir[1] === ult[1]) return 0.95; if (pt.dir[0] === -ult[0] && pt.dir[1] === -ult[1]) return 1.25; return 1.1; };
  // (a room of about 6 by 6 beyond the edge: what the table would become)
  const estimar = pt => { const s = 6, h = 3; const [fx, fy] = pt.fora, [dx, dy] = pt.dir; const px = -dy, py = dx; return [[fx + px * h, fy + py * h], [fx - px * h, fy - py * h], [fx + dx * s + px * h, fy + dy * s + py * h], [fx + dx * s - px * h, fy + dy * s - py * h]]; };
  const ordenar = (pts, rng) => vazia ? pts : pts.map(pt => ({ pt, n: custo(estimar(pt)) * giro(pt) * (1 + rng() * 0.08) - pt.livre * 0.5 })).sort((a, b) => a.n - b.n).map(x => x.pt);
  return { custo: vazia ? () => 0 : custo, ordenar, giro, centro: vazia ? null : [(x0 + x1) / 2, (y0 + y1) / 2] };
}
function juntarSala(pm, c) {
  const s = clone(c.sala); const nova = pm.salas.length; pm.salas.push(s);
  if (c.abridor) { (c.abridor.mover || []).forEach(m => { const e = (pm.salas[c.abridor.sala].inimigos || [])[m.i]; if (e) e.pos = [...m.pos]; });   // (a monster steps aside for the opener)
    if (c.abridor.moldura) pm.salas[c.abridor.sala].objetos.push(clone(c.abridor.moldura));
    const ob = clone(c.abridor.objeto); anexarAbertura(ob, c, nova, true); pm.salas[c.abridor.sala].objetos.push(ob); porGemeo(pm, c); }
  return nova;
}
/* the rooms on the table with room si: those of its set, between points of no return (pm._grupo) */
const salasNaMesa = (pm, si) => { const grupo = pm._grupo || {}; return pm.salas.map((x, i) => i).filter(i => (grupo[i] || 0) === (grupo[si] || 0)); };
/* a room behind a lock, or behind a room behind a lock (its things would wait for the lock) */
const atrasDeTrava = (pm, i) => { for (let r = i, k = 0; r > 0 && k < pm.salas.length; k++) { const ab = abridorDe(pm, r); if (!ab) return false; if (travasDe(ab.o, ab.g).length) return true; r = ab.ri; } return false; };
/* an object added to a room already built, where it fits (null if nowhere) */
function colocarNaSala(pm, si, tipo, rng, extra, modoArco, longe) {
  const s = pm.salas[si]; const ent = entradaDaSala(si, pm); if (!ent.length) return null;
  // only what is still in the box, beside the rooms on the table with this one (its set, between points of no return)
  const naMesa = salasNaMesa(pm, si);
  // no archway left in the box: the frame of the bell (Act II) stands in for it
  if (tipo === 'Archway' && objetoLivre(pm, naMesa, 'Archway', pm._atos || 2) <= 0 && daCaixa('BellFrame', pm._atos || 2)) tipo = 'BellFrame';
  if (objetoLivre(pm, naMesa, tipo, pm._atos || 2) <= 0) return null;
  const o = porObjeto(tipo, s, si, ent, rng, () => pm, modoArco, longe); if (!o) return null;
  Object.assign(o, extra || {}); s.objetos.push(o); return s.objetos.length - 1;
}
/* the way out of a map: an archway with a point of interest in its passage (reaching it ends the map); with no room for
   the archway, the point of interest alone, or a door */
function saidaNaSala(pm, si, rng, extra) {
  let ai = colocarNaSala(pm, si, 'Archway', rng, { name: '', textClick: '', ...(extra.hidden ? { hidden: true } : {}) }, 'saida');
  const s = pm.salas[si]; const perto = ([x, y]) => (s.herois || []).some(h => Math.max(Math.abs(h[0] - x), Math.abs(h[1] - y)) <= 1);
  if (ai != null && meioDoArco(s.objetos[ai]).meio.every(perto)) { s.objetos.splice(ai, 1); ai = null; }   // never where the heroes start
  if (ai != null) { const a = pm.salas[si].objetos[ai]; const ms = meioDoArco(a).meio.filter(c => !perto(c));
    s.objetos.push({ type: 'SightToken', pos: [ms[0][0], ms[0][1]], rot: 0, level: a.level || 0, ...extra }); const oi = s.objetos.length - 1;
    if (ms[1]) s.objetos.push({ type: 'SightToken', pos: [ms[1][0], ms[1][1]], rot: 0, level: a.level || 0, ...extra, gemeo: oi });   // the pair, in symmetry
    return { oi, arco: ai }; }
  const oi = portaNaBorda(pm, si, rng, extra, 'SightToken') ?? portaNaBorda(pm, si, rng, extra, 'Door') ?? colocarNaSala(pm, si, 'SightToken', rng, extra); return oi == null ? null : { oi, arco: null };
}
/* a medium ladder inside the vault of room si, from its floor up to the top of its wall (level 2 over the floor): on a free
   square beside the wall, off the squares where the heroes arrive. Returns its index, or null */
function escadaNaCripta(pm, si, chegada, alvos = []) {
  const s = pm.salas[si]; const q = s.pecas.find(x => x.tile === 'vault'); if (!q || !daCaixa('LadderMedium', pm._atos || 2)) return null;
  const naMesa = salasNaMesa(pm, si); if (objetoLivre(pm, naMesa, 'LadderMedium', pm._atos || 2) <= 0) return null;
  const mu = murosDaPeca(q); const tomadas = new Set(); s.objetos.forEach(o => casasDoObjeto(o).forEach(c => tomadas.add(c.join(',')))); (s.inimigos || []).forEach(e => tomadas.add(e.pos.join(','))); (chegada || []).concat(s.herois || []).forEach(h => tomadas.add(h[0] + ',' + h[1]));
  // (near the ledges the way out may leave from: the heroes walk little on the wall)
  const perto = (x, y) => alvos.length ? Math.min(...alvos.map(([ax, ay]) => Math.abs(ax - x) + Math.abs(ay - y))) : 0;
  const dentro = casasDaPeca(q).filter(c => !mu.chaves.has(c.join(',')) && !tomadas.has(c.join(','))).sort((a, b) => perto(...a) - perto(...b));
  for (const [x, y] of dentro) for (let r = 0; r < 4; r++) { const [ux, uy] = SOBE[r]; if (!mu.chaves.has((x + ux) + ',' + (y + uy))) continue;
    const o = { type: 'LadderMedium', pos: [x, y], rot: r * 90, level: q.level || 0, name: '', textClick: '', textUse: '', gatilhos: [], requisitos: [], senao: [] };
    if (!casasDoObjeto(o).every(c => !tomadas.has(c.join(',')) && !mu.chaves.has(c.join(',')))) continue;
    s.objetos.push(o); return s.objetos.length - 1; }
  return null;
}
/* the top of a ladder of the vault and how many squares of its wall (murosDaPeca) each square of the wall is from there */
function muroDaEscada(lad, mu) {
  const [ux, uy] = SOBE[((lad.rot || 0) / 90) % 4]; const topo = [lad.pos[0] + ux, lad.pos[1] + uy]; const dist = new Map([[topo.join(','), 0]]); const fila = [topo];
  for (let i = 0; i < fila.length; i++) { const [x, y] = fila[i]; VIZ4.forEach(([dx, dy]) => { const k = (x + dx) + ',' + (y + dy); if (mu.chaves.has(k) && !dist.has(k)) { dist.set(k, dist.get(x + ',' + y) + 1); fila.push([x + dx, y + dy]); } }); }
  return { topo, dist };
}
/* a door (or a point of interest) at the edge of room si, as if it opened a room beyond (the way out): on free floor at the
   rim, open ground in front of it, away from the entry; null when none fits */
function portaNaBorda(pm, si, rng, extra, tipo = 'Door') {
  const s = pm.salas[si]; const ch = chaoDaSala(si, pm); const ent = entradaDaSala(si, pm); if (!ent.length) return null;
  const naMesa = salasNaMesa(pm, si); if (objetoLivre(pm, naMesa, tipo, pm._atos || 2) <= 0) return null;
  const d = distancias(ch, ent); const ocupMapa = casasOcupadas(pm, -1);
  const tomadas = new Set(); s.objetos.forEach(o => casasDoObjeto(o).forEach(([x, y]) => tomadas.add(x + ',' + y))); (s.inimigos || []).forEach(e => tomadas.add(e.pos[0] + ',' + e.pos[1])); (s.herois || []).forEach(h => tomadas.add(h[0] + ',' + h[1]));
  const livre = (x, y) => { const c = ch.get(x + ',' + y); return c && c.nivel === 0 && !c.bloqueia && !c.escada && !c.ponte && !c.muro && !c.degrau && !c.alfombra && !tomadas.has(x + ',' + y) && d.has(x + ',' + y); };
  let melhor = null, nm = -Infinity;
  ch.forEach(c => { for (const rot of [0, 90, 180, 270]) {
    const o = { type: tipo, pos: [c.x, c.y], rot, level: 0 }; const cs = casasDoObjeto(o); if (!cs.every(([x, y]) => livre(x, y))) continue;
    const [w, h] = tamanhoDoObjeto(o); for (const n of w > h ? [[0, 1]] : h > w ? [[1, 0]] : [[0, 1], [1, 0]]) for (const sg of [1, -1]) {   // (in front: off every room of the map; behind: this room's floor)
      if (!cs.every(([x, y]) => !ocupMapa.has((x + n[0] * sg) + ',' + (y + n[1] * sg)) && ch.has((x - n[0] * sg) + ',' + (y - n[1] * sg)))) continue;
      const nota = Math.min(...cs.map(([x, y]) => d.get(x + ',' + y))) + rng() * 2; if (nota > nm) { nm = nota; melhor = o; } } } });
  if (!melhor) return null;
  s.objetos.push({ ...melhor, name: '', textClick: '', textUse: '', gatilhos: [], requisitos: [], senao: [], ...(extra || {}) }); return s.objetos.length - 1;
}
const abridorDe = (pm, si) => { for (let ri = 0; ri < pm.salas.length; ri++) { const oi = pm.salas[ri].objetos.findIndex(o => todosGatilhos(o).some(g => g.tipo === 'open_room' && g.sala === si)); if (oi >= 0) return { ri, oi, o: pm.salas[ri].objetos[oi], g: todosGatilhos(pm.salas[ri].objetos[oi]).find(g => g.tipo === 'open_room' && g.sala === si) }; } return null; };
function novoContadorMapa(pm, nome, total, texto) { const c = { id: uid(), nome, inicio: 0, total, ehContador: true, gatilhos: [], missao: { uid: 'cm' + uid(), texto, quando: 'start' } }; pm.contadores = (pm.contadores || []).concat([c]); return c; }
/* the last door stays shut until the count is full */
function trancarPorContador(pm, si, nome, n, textoTrancado) { const ab = abridorDe(pm, si); if (!ab) return false;
  // the locked text shows how far the count is (a try at the door says what is missing)
  if (!/\{#/.test(textoTrancado)) textoTrancado = textoTrancado.replace(/\.\s*$/, '') + ' (' + nome + ': {#' + varDoContador(nome) + '} ' + L2('of', 'de') + ' ' + n + ').'; ab.g.requisitos = [{ tipo: 'counter', contador: nome, meta: n }]; ab.o['senao:' + ab.g.uid] = [gatilhoTexto(textoTrancado)];
  ab.o.acaoExtra = { ...(ab.o.acaoExtra || {}), ['senao:' + ab.g.uid]: true };   // as in the game: a door that will not open does not cost the action
  return true; }

/* a thing of the map made the thing of a gimmick: what a player reads tapping it, and the sentence that presents it after
   its room is set up (in place of the sentence of what it was before) */
function apresentar(pm, si, o, olhar, revela) {
  const s = pm.salas[si]; let t = s.textoDepois || '';
  const velho = FICHAS_INTERACAO.concat([FICHA_ISCA], FICHAS_TESTE, HISTORIAS.fichas || []).find(f => T2(f.olhar) === o.textClick);
  if (velho) t = t.replace(T2(velho.revela), '').replace(/\s+/g, ' ').trim();
  if (olhar) o.textClick = olhar; if (revela) t = (t ? t + ' ' : '') + revela; s.textoDepois = t;
}
/* the collector of a gimmick or complication: n things spread over the host rooms, each counting 1; when the count is
   full, the opener of room `alvo` works (until then it shows its locked text) */
function coletor(pm, rng, notas, hospedeiras, alvo, regra) {
  // regra (a skin's rules of placement): reaproveita false: the piece is a thing of its own, never an object already in the
  // room (a lever is not hidden in the room's shelf); a token, being anything, may always be taken
  return (nome, nomePt, n, tipos, textoAchar, textoTrancado, objetivo, montar, visto) => {
    const missaoDe = k => typeof objetivo === 'function' ? objetivo(k) : objetivo;
    const cont = novoContadorMapa(pm, L2(nome, nomePt), n, missaoDe(n));
    let feitos = 0; const reusa = t => !regra || regra.reaproveita !== false || t === 'InteractToken';
    for (const si of hospedeiras(n + 8)) { if (feitos >= n) break;   // (a long list: with the box short of tokens, the rooms that still hold one free)
      const s = pm.salas[si]; const livre = t => s.objetos.findIndex(o => baseObj(o.type) === t && !o._narrador && !todosGatilhos(o).some(g => ['counter', 'spawn', 'rounds', 'open_room'].includes(g.tipo)));   // never the thing of another gimmick (the alarm's horn, an opener)
      const novo = t => { const k = colocarNaSala(pm, si, t, rng); return k == null ? -1 : k; };
      let oi = -1;
      if (regra && regra.reaproveita === false) {
        // a thing of its own: a new one of the kinds it may be, else a token of the room, else a new token
        for (const t of tipos.filter(t => t !== 'Wagon' && t !== 'InteractToken')) { oi = novo(t); if (oi >= 0) break; }
        if (oi < 0 && tipos.includes('InteractToken')) { oi = livre('InteractToken'); if (oi < 0) oi = novo('InteractToken'); }
      } else {
        for (const t of tipos) { if (!reusa(t)) continue; oi = livre(t); if (oi >= 0) break; }
        // (none to reuse: a new one, of the first kind the box still has)
        if (oi < 0) for (const t of tipos.filter(t => t !== 'Wagon').concat(tipos.every(t => t === 'Wagon') ? tipos : [])) { oi = novo(t); if (oi >= 0) break; }
      }
      if (oi == null || oi < 0) continue;
      const o = semBusca(s.objetos[oi]); const ficha = ehTipo(o, 'InteractToken');
      // a token that asked a test becomes the thing of the gimmick: its test goes
      if (ficha) { todosGatilhos(o).forEach(x => Object.keys(o).forEach(k => { if (/^(ok|fail):/.test(k) && k.endsWith(':' + x.uid)) delete o[k]; })); o.gatilhos = (o.gatilhos || []).filter(g => g.tipo !== 'skill_test'); }
      // an interaction token becomes the thing of the gimmick: its old texts go, the new ones present it
      // (a chest keeps its loot: the piece is found with it)
      o.gatilhos = (o.gatilhos || []).filter(g => !(ficha && (g.tipo === 'give_item' || g.tipo === 'text')));
      if (visto && (ficha || visto.todos)) apresentar(pm, si, o, visto.olhar, visto.revela);
      if (montar) montar(o, cont, si); else o.gatilhos.unshift(gatilhoTexto(textoAchar), { uid: uid(), tipo: 'counter', contador: cont.nome, acao: 'add', n: 1, texto: TEXTO_CONTADOR.add, requisitos: [] });
      feitos++; }
    // nothing found a room: no counter and no lock (a lock with no pieces would never open)
    if (!feitos) { pm.contadores = (pm.contadores || []).filter(c => c !== cont); notas.push(L2('No room for the ' + nome + ': that lock was left out.', 'Nenhuma sala para: ' + nomePt + '; essa trava ficou de fora.')); return cont; }
    if (feitos < n) { cont.total = Math.max(1, feitos); cont.missao.texto = typeof objetivo === 'function' ? missaoDe(cont.total) : cont.missao.texto.replace(/\b(three|três|two|duas|dois|3|2)\b/i, String(cont.total)); if (feitos < 2) notas.push(L2('Only ' + feitos + ' of ' + n + ' found a room.', 'Só ' + feitos + ' de ' + n + ' acharam sala.')); }
    const tranca = typeof textoTrancado === 'function' ? textoTrancado(cont.total) : textoTrancado;
    if (tranca && !trancarPorContador(pm, alvo, cont.nome, cont.total, tranca)) notas.push(L2('The room to lock has no opener.', 'A sala a trancar não tem abridor.'));
    return cont;
  };
}
/* pieces that unlock, dressed by skin R (HISTORIAS.pecas): n pieces over the host rooms, each counting 1; the opener of room
   alvo waits for all of them (trancar false: no lock, the count is the mission). "simples": used, the piece is found (a key,
   a lever pulled); "teste": a test breaks it, and something comes to the room when it gives (a seal, an idol) */
function pecasQueDestravam(pm, plano, rng, notas, hosts, alvo, R, n, trancar = true) {
  const v = plano.vocab; let k = 1, nome = TXT(R.contador); while ((pm.contadores || []).some(c => c.nome === nome)) nome = TXT(R.contador) + ' ' + (++k);
  const objetivo = q => RT(q === 1 ? R.objetivo1 : R.objetivoN, v, { n: q });
  const trancado = trancar ? q => RT(q === 1 ? R.trancado1 : R.trancadoN, v, { n: q }) : null;
  const conta = RT(R.conta, v);
  const montar = R.modo === 'teste' ? (o, cont, si) => {
    const T = R.teste || {}; const cumul = !!T.cumulativo;
    const prompt = RT(T.texto, v); const g = { uid: uid(), tipo: 'skill_test', text: textoDoTeste({ stat: T.stat, text: { en: prompt, pt: prompt }, cumulativo: cumul }), successes: sucessosDoTeste(cumul ? 3 : 2, cumul), ...(cumul ? { cumulativo: true } : {}), requisitos: [] };
    // the first piece anyone tries, whichever: two heroes of the party talk it over (when the story has a scene; it plays once)
    o.gatilhos = (R.cena ? [cenaDaRoupa(R, v)] : []).concat([g]);
    // the enemy feels every piece that gives and sends its servants; a failed try hurts
    const casas = casasDeInimigos(pm.salas[si], si, entradaDaSala(si, pm), 2, { distancia: [2, 7], padrao: 'fundo' }, rng, () => pm);
    o['ok:' + g.uid] = [gatilhoTexto(RT(T.ok, v)), { uid: uid(), tipo: 'counter', contador: cont.nome, acao: 'add', n: 1, texto: conta, requisitos: [] }]
      .concat(casas.length ? [{ uid: uid(), tipo: 'spawn', fonte: 'pool', cells: casas.map(c => [c.x, c.y, c.nivel]), inimigos: [], intensidade: Math.max(1, Math.min(10, plano.base - 2)), requisitos: [] }] : []);
    o['fail:' + g.uid] = [gatilhoTexto(RT(T.falha, v))];
    o.usos = cumul ? 'always' : 0;
  } : (o, cont) => { o.gatilhos.unshift(gatilhoTexto(RT(R.achar, v)), { uid: uid(), tipo: 'counter', contador: cont.nome, acao: 'add', n: 1, texto: conta, requisitos: [] }); };
  // the look and the reveal: on a token always; on another object only when the piece IS the object (a seal carved in the
  // lectern), not when it lies inside it (a key in a chest keeps the chest's look, and is found by opening it)
  const visto = { todos: !!R.veste, olhar: RT(R.olhar, v), revela: RT(R.revela, v) };
  return coletor(pm, rng, notas, hosts, alvo, R)(nome, nome, n, R.portadores || ['InteractToken'], '', trancado, objetivo, montar, visto);
}
/* the scene of a skin (3 lines, the first time any of its pieces is tried): two heroes drawn from the party */
function cenaDaRoupa(R, v) {
  const [a, b, c] = R.cena; const cx = (id, quem, outro, t, next) => ({ id, type: 'normal', speaker: quem, title: '', text: RT(t, v), cast: [outro], background: FUNDO_PADRAO, next, options: [] });
  return { uid: uid(), tipo: 'scene', primeiraVez: 'pecas-' + R.id, inicio: 's1', requisitos: [], caixas: [cx('s1', '@hero1', '@hero2', a, 's2'), cx('s2', '@hero2', '@hero1', b, 's3'), cx('s3', '@hero1', '@hero2', c, '')] };
}
/* the rooms opened, directly or not, from room si (their openers stand in si or in one of them) */
function descendentes(pm, si) {
  const out = new Set(); const pilha = [si];
  while (pilha.length) { const r = pilha.pop(); pm.salas.forEach((x, i) => { if (i !== r && !out.has(i) && abridorDe(pm, i)?.ri === r) { out.add(i); pilha.push(i); } }); }
  return out;
}
/* the complications: a door locked by keys or levers found elsewhere (in rooms reached before it), a place where waves
   come until the way opens. Each locks a different room, never the first two */
function aplicarComplicacoes(pm, plano, rng, notas, salasDe) {
  const eixo = salasDe.eixo; const trancadas = new Set(pm.salas.map((x, i) => i).filter(i => { const ab = abridorDe(pm, i); return ab && (ab.g.requisitos || []).length; }));
  // a door along the way (not the first two rooms), or the door of a side room (a reward behind a lock)
  // (a room that holds, or leads to, the pieces of another lock is never locked: that lock would wait behind this one)
  const temPecas = j => pm.salas[j].objetos.some(x => Object.keys(x).some(l => Array.isArray(x[l]) && (l === 'gatilhos' || l.includes(':')) && x[l].some(g => g.tipo === 'counter' && (g.acao || 'add') === 'add')));
  const guardaPecas = i => [i, ...descendentes(pm, i)].some(temPecas);
  // (a room behind a lock, or behind a room behind a lock, never holds pieces of a new lock: atrasDeTrava)
  const alvoLivre = () => { const cands = eixo.slice(2).concat(salasDe.lado).filter(i => !trancadas.has(i) && abridorDe(pm, i) && !guardaPecas(i)); return cands.length ? rng.pick(cands) : null; };
  const mesmoGrupo = (a, b) => !plano.grupo || (plano.grupo[a] || 0) === (plano.grupo[b] || 0);
  const hostsFora = alvo => { const fora = descendentes(pm, alvo); fora.add(alvo); const livres = pm.salas.map((x, i) => i).filter(i => !fora.has(i) && mesmoGrupo(i, alvo) && !atrasDeTrava(pm, i));
    const lados = livres.filter(i => salasDe.lado.includes(i)), resto = livres.filter(i => !salasDe.lado.includes(i));
    return n => rng.embaralhar(lados).concat(rng.embaralhar(resto.filter(i => i > 0))).concat(mesmoGrupo(0, alvo) ? [0] : []).filter((x, i, a) => a.indexOf(x) === i).slice(0, n); };
  const nomeLivre = (en, pt) => { let k = 1, n = L2(en, pt); while ((pm.contadores || []).some(c => c.nome === n)) n = L2(en, pt) + ' ' + (++k); return n; };
  plano.feitas = [];
  for (const [ic, c0] of (plano.complicacoes || []).entries()) {
    let c = c0, alvoP = null;
    // (no door left to lock for the pieces: the waves instead, when the plan has none; a skin of their own)
    if (c === 'pecas' || c === 'chaves' || c === 'alavancas') { alvoP = alvoLivre();
      if (alvoP === null) { const R = !(plano.complicacoes || []).includes('ondas') && roupaDe(plano, 'ondas', x => x.modo !== 'possuido' && temPortador(x, plano.atos));
        if (!R) { notas.push(L2('No door left to lock for the pieces.', 'Nenhuma porta sobrou para trancar: peças.')); continue; }
        c = 'ondas'; plano.roupasComp = plano.roupasComp || []; plano.roupasComp[ic] = R; } }
    if (c === 'pecas' || c === 'chaves' || c === 'alavancas') {
      const alvo = alvoP;
      const n = rng.int(1, 3); trancadas.add(alvo); const hosts = hostsFora(alvo);
      // the skin drawn with the plan (a key, a lever, a valve…: no test)
      const R = plano.roupasComp?.[ic] || HIST('pecas').find(x => x.modo === 'simples'); if (!R) continue;
      const cont = pecasQueDestravam(pm, plano, rng, notas, hosts, alvo, R, n);
      plano.feitas.push({ id: 'pecas', n: cont.total, sala: alvo, roupa: R.id });
    } else if (c === 'ondas') {
      // a room along the way where something calls the waves (a skin of HISTORIAS.ondas: a bell, a horn, a beacon…, or a
      // possessed one who calls them until freed); the room after it opens only once the waves are over
      // (never the respite: the breath before the last fight)
      const cands = eixo.slice(1, -1).filter(i => pm.salas[i]?.funcao !== 'respiro' && pm.salas.some((x, j) => abridorDe(pm, j)?.ri === i && !trancadas.has(j)));
      if (!cands.length) { notas.push(L2('No room for the waves.', 'Nenhuma sala para as ondas.')); continue; }
      // (a room with floor for the monsters to come in: a small simple room may have none)
      const comEspaco = cands.filter(i => casasDeInimigos(pm.salas[i], i, entradaDaSala(i, pm), 2, { distancia: [1, 16], padrao: 'fundo' }, rngDe('ondas' + i), () => pm).length);
      const si = rng.pick(comEspaco.length ? comEspaco : cands); const s = pm.salas[si]; const ent = entradaDaSala(si, pm); const w = rng.int(2, 3);
      // the room it locks: one opened from here, better one that hides nothing another lock needs (a seal, a key)
      const conta = j => pm.salas[j].objetos.some(x => todosGatilhos(x).some(g2 => g2.tipo === 'counter' && g2.acao === 'add') || Object.keys(x).some(k => /^(ok|op\d+|rodada):/.test(k) && (x[k] || []).some(g2 => g2.tipo === 'counter' && g2.acao === 'add')));
      const depois = pm.salas.map((x, j) => j).filter(j => abridorDe(pm, j)?.ri === si && !trancadas.has(j));
      const livres = depois.filter(j => !conta(j) && !guardaPecas(j)); const alvo = livres.length ? rng.pick(livres) : null;   // never a room that holds (or leads to) another lock's pieces
      // (a possessed one with no way to lock would call monsters for ever, and freeing it would open nothing: then a call)
      let R = plano.roupasComp?.[ic] || HIST('ondas')[0]; if (R && R.modo === 'possuido' && alvo === null) { R = roupaDe(plano, 'ondas', x => x.modo !== 'possuido' && temPortador(x, plano.atos)) || R; plano.roupasComp[ic] = R; }
      if (!R) continue; const possuido = R.modo === 'possuido';
      let oi = null; for (const t of (R.portadores || ['InteractToken']).filter(t => t !== 'Wagon')) { oi = colocarNaSala(pm, si, t, rng); if (oi != null) break; }
      if (oi == null) oi = colocarNaSala(pm, si, 'InteractToken', rng); if (oi == null) { notas.push(L2('No place for the waves.', 'Sem lugar para as ondas.')); continue; }
      const o = s.objetos[oi];
      const abAlvo = alvo !== null ? abridorDe(pm, alvo) : null; const tipoAlvo = abAlvo ? baseObj(abAlvo.o.type) : '';
      const oQue = tipoAlvo === 'Gate' ? L2('the gate beyond', 'o portão adiante') : tipoAlvo === 'Door' ? L2('the door beyond', 'a porta adiante') : L2('the way ahead', 'a passagem adiante');
      const vv = { ...plano.vocab, oque: oQue, Oque: oQue.charAt(0).toUpperCase() + oQue.slice(1), w };
      apresentar(pm, si, o, RT(R.olhar, vv), RT(R.revela, vv));
      const nome = nomeLivre(TXT(R.contador), TXT(R.contador));
      let casas = casasDeInimigos(s, si, ent, 2, { distancia: [3, 8], padrao: 'fundo' }, rng, () => pm);
      if (!casas.length) casas = casasDeInimigos(s, si, ent, 2, { distancia: [1, 16], padrao: 'fundo' }, rng, () => pm);   // (a small room: wherever there is floor)
      const sp = () => casas.length ? [{ uid: uid(), tipo: 'spawn', fonte: 'pool', cells: casas.map(c2 => [c2.x, c2.y, c2.nivel]), inimigos: [], intensidade: Math.max(1, Math.min(10, plano.base - (possuido ? 2 : 1))), requisitos: [] }] : [];
      if (possuido) {
        // possessed: from the moment its room is open it calls monsters (every two rounds; every round on Hard), until a hero
        // frees it (a long test); the way on opens once it is free and its room is clear
        const ativo = novoContadorMapa(pm, nome + ' ' + L2('(active)', '(ativo)'), 1, ''); delete ativo.missao; ativo.inicio = 1;
        const solto = novoContadorMapa(pm, nome, 1, RT(R.objetivo, vv));
        const T = R.teste || {}; const dup = x => { const t2 = RT(x, vv); return { en: t2, pt: t2 }; };
        const t = testeNoObjeto(o, { stat: T.stat || 'will', sucessos: 3, cumulativo: true, text: dup(T.texto), ok: dup(T.ok), fail: dup(T.falha) });
        o.gatilhos = [t]; o.usos = 'always';
        o['ok:' + t.uid].push({ uid: uid(), tipo: 'counter', contador: ativo.nome, acao: 'set', n: 0, texto: '', requisitos: [] }, { uid: uid(), tipo: 'counter', contador: solto.nome, acao: 'add', n: 1, texto: '', requisitos: [] });
        const req = () => [{ tipo: 'counter', contador: ativo.nome, meta: 1 }].concat(si > 0 ? [{ tipo: 'room_open', sala: si }] : []);
        if (casas.length) pm.eventos = (pm.eventos || []).concat([{ uid: 'po' + uid(), sala: si, rodada: 2, cada: plano.dificuldade === 'dificil' ? 1 : 2, gatilhos: [gatilhoTexto(RT(R.chama, vv), req()), ...sp().map(x => ({ ...x, requisitos: req() }))] }]);
        if (alvo !== null && trancarPorContador(pm, alvo, solto.nome, 1, RT(R.trancado, vv))) { trancadas.add(alvo); abridorDe(pm, alvo).g.requisitos.push({ tipo: 'enemies_defeated', sala: si }); }
        plano.feitas.push({ id: c, n: 0, sala: si, roupa: R.id });
        continue;
      }
      // what the call is, said the same way everywhere: the call, one wave a round, and what opens after the last one. The
      // count of waves shows in the locked text ({#…}), so a try at the door says how far it is
      const vN = '{#' + varDoContador(nome) + '}';
      const cont = novoContadorMapa(pm, nome, w, RT(R.objetivo, vv));
      cont.gatilhos = [gatilhoTexto(RT(R.ultima, vv))];
      // one wave each round (every two rounds left the heroes waiting with nothing to do)
      const g = { uid: uid(), tipo: 'rounds', modo: 'cada', n: 1, vezes: w, requisitos: [] };
      // (the warning says when and where: monsters at the lit spaces from the start of the next round, one wave a round)
      o.gatilhos = [gatilhoTexto(RT(R.soa, vv) + L2(' Get ready: monsters come at the start of the next round' + (casas.length ? ', on the lit spaces' : '') + ', and another wave every round after, ' + w + ' in all. Once the last wave is defeated, ' + oQue + ' opens. Take your positions and end the round!', ' Preparem-se: monstros chegam no começo da próxima rodada' + (casas.length ? ', nas casas destacadas' : '') + ', e mais uma onda a cada rodada, ' + w + ' ao todo. Quando a última onda for derrotada, ' + oQue + ' se abre. Tomem posição e terminem a rodada!'))]
        .concat(casas.slice(0, 3).map(c2 => ({ uid: uid(), tipo: 'highlight', cell: [c2.x, c2.y], ateRodada: true, requisitos: [] })), [g]);
      o['rodada:' + g.uid] = [{ uid: uid(), tipo: 'counter', contador: cont.nome, acao: 'add', n: 1, texto: RT(R.onda, vv) || L2('Wave [n] of [total].', 'Onda [n] de [total].'), requisitos: [] }].concat(sp());
      // the locked text says what to do, before and after the call, and how far the waves are; the way opens when the last
      // wave is DEFEATED (before, it opened as the last wave came in)
      if (alvo !== null && trancarPorContador(pm, alvo, cont.nome, w, RT(R.trancado, { ...vv, vN }))) { trancadas.add(alvo); abridorDe(pm, alvo).g.requisitos.push({ tipo: 'enemies_defeated', sala: si }); }
      plano.feitas.push({ id: c, n: w, sala: si, roupa: R.id });
    }
  }
}
/* the requirements that keep the trigger g of object o shut: its own, and those of the object's choices */
function travasDe(o, g) { return (g.requisitos || []).concat((o.gatilhos || []).filter(x => x !== g && (x.requisitos || []).length && x.tipo === 'choice').flatMap(x => x.requisitos)); }
/* can the heroes open every room? From the first room, rooms open when their opener stands in an open room and its
   counters are full; the counters fill with what open rooms hold (a key, a seal, each wave of an alarm). A lock whose
   pieces sit behind itself (or behind another lock that waits for it) never opens: the heroes are stuck */
function salasAbertas(pm) {
  const abertas = new Set([0]); const cont = {}; const vistos = new Set(); let mudou = true;
  while (mudou) { mudou = false;
    pm.salas.forEach((s, si) => { if (!abertas.has(si)) return; s.objetos.forEach((o, oi) => { const k = si + ':' + oi; if (vistos.has(k)) return;
      let soma = 0; Object.keys(o).forEach(l => { if (!Array.isArray(o[l]) || !(l === 'gatilhos' || l.includes(':'))) return;
        const rd = /^rodada:(.+)$/.exec(l); const rep = rd ? ((o.gatilhos || []).find(g => g.uid === rd[1])?.vezes || 99) : 1;
        o[l].forEach(g => { if (g.tipo === 'counter' && (g.acao || 'add') === 'add') { cont[g.contador] = (cont[g.contador] || 0) + (g.n || 1) * rep; soma++; } }); });
      if (soma) { vistos.add(k); mudou = true; } }); });
    pm.salas.forEach((s, si) => { if (abertas.has(si)) return; const ab = abridorDe(pm, si); if (!ab || !abertas.has(ab.ri)) return;
      if (travasDe(ab.o, ab.g).every(r => r.tipo !== 'counter' || (cont[r.contador] || 0) >= (r.meta || 1))) { abertas.add(si); mudou = true; } }); }
  return abertas;
}
/* the last guard: a lock that can never open loses its requirement (with a note), so no map leaves the heroes stuck */
function destravarImpossiveis(pm, notas) {
  for (let volta = 0; volta < pm.salas.length; volta++) {
    const abertas = salasAbertas(pm); const presa = pm.salas.map((x, i) => i).find(i => !abertas.has(i) && abridorDe(pm, i) && abertas.has(abridorDe(pm, i).ri)); if (presa === undefined) return;
    const ab = abridorDe(pm, presa); [ab.g].concat((ab.o.gatilhos || []).filter(x => x.tipo === 'choice' && (x.requisitos || []).length)).forEach(g => { g.requisitos = (g.requisitos || []).filter(r => r.tipo !== 'counter'); });
    notas.push(L2('Room ' + (presa + 1) + ' could never open (its lock waited for pieces behind it): the lock was taken off.', 'A sala ' + (presa + 1) + ' nunca abriria (a trava esperava peças atrás dela): a trava saiu.'));
  }
}
/* an opener that stays shut until its requirement is met does nothing else before that: its other calls (the leader's
   reinforcements every two rounds, a group coming in) wait for the same requirement. Before, a first try at a locked gate
   started the reinforcements of a room still off the table */
function travarJunto(pm) {
  pm.salas.forEach(s => s.objetos.forEach(o => {
    const trava = (o.gatilhos || []).find(g => g.tipo === 'open_room' && (g.requisitos || []).length); if (!trava) return;
    (o.gatilhos || []).forEach(g => { if (g !== trava && (g.tipo === 'rounds' || g.tipo === 'spawn') && !(g.requisitos || []).length) g.requisitos = clone(trava.requisitos); });
  }));
}
/* the point of no return: the object that opens room k also takes every room behind off the table (their tiles and pieces
   go back to the box: the rooms ahead reuse them) and moves every hero into room k. How depends on the opener: a ledge
   (jump down), a gate (it slams shut) or anything else (the ceiling gives way behind) */
function semRetorno(pm, plano, rng, notas) {
  plano.semRetornoFeito = [];
  (plano.pontos || []).forEach(k => pontoSemVolta(pm, plano, rng, notas, k));
}
function pontoSemVolta(pm, plano, rng, notas, k) {
  const ab = abridorDe(pm, k); if (!ab) return;
  const g = plano.grupo[k] || 0; const atras = pm.salas.map((x, i) => i).filter(i => (plano.grupo[i] || 0) === g - 1);
  const tipo = ab.o._variante || (ehTipo(ab.o, 'SightToken') && (ab.o.level || 0) > 0 ? 'salto' : ehTipo(ab.o, 'Gate') ? 'portao' : 'desabamento'); delete ab.o._variante;
  const T = {
    salto: { olhar: { en: 'The edge of the platform. Far below, another room: a jump with no way back.', pt: 'A borda da plataforma. Lá embaixo, outra sala: um salto sem volta.' },
      pergunta: { en: 'Far below lies another room. Once you jump, there is no climbing back. Everyone must be here, in this room, before anyone jumps.', pt: 'Lá embaixo há outra sala. Depois do salto, não há como subir de volta. Todos precisam estar aqui, nesta sala, antes de alguém pular.' },
      sim: { en: 'We all jump.', pt: 'Todos pulamos.' }, depois: { en: 'You drop from the ledge into the room below.', pt: 'Vocês saltam da borda para a sala lá embaixo.' } },
    portao: { olhar: { en: 'A heavy gate on a counterweight. Once through, there will be no coming back.', pt: 'Um portão pesado com contrapeso. Depois de passar, não haverá volta.' },
      pergunta: { en: 'The counterweight will slam the gate shut behind you, for good. Everyone must be here, in this room, before you open it.', pt: 'O contrapeso vai fechar o portão atrás de vocês, para sempre. Todos precisam estar aqui, nesta sala, antes de abrir.' },
      sim: { en: 'We all go through.', pt: 'Todos passamos.' }, depois: { en: 'The moment you are through, the gate crashes shut behind you.', pt: 'Assim que vocês passam, o portão se fecha com estrondo.' } },
    desabamento: { olhar: null,
      pergunta: { en: 'The ceiling groans; dust trickles down. Whatever lies beyond, the way back will not last. Everyone must be here, in this room, before you go on.', pt: 'O teto range; poeira escorre. O que houver adiante, o caminho de volta não vai durar. Todos precisam estar aqui, nesta sala, antes de seguir.' },
      sim: { en: 'We all go on.', pt: 'Todos seguimos.' }, depois: { en: 'Behind you the ceiling gives way with a roar. The way back is buried.', pt: 'Atrás de vocês o teto desaba com um estrondo. O caminho de volta está soterrado.' } },
    alcapao: { olhar: null,
      pergunta: { en: 'The trapdoor opens onto darkness, with no stairs and no rope: whoever goes down will not climb back. Everyone must be here, in this room.', pt: 'O alçapão se abre para a escuridão, sem escada nem corda: quem descer não sobe de volta. Todos precisam estar aqui, nesta sala.' },
      sim: { en: 'We all go down.', pt: 'Todos descemos.' }, depois: { en: 'You drop into the dark below and land hard.', pt: 'Vocês caem na escuridão lá embaixo e aterrissam com força.' } },
    teleporte: { olhar: null,
      pergunta: { en: 'The runes flare as you come close. Whoever stands in the circle will be taken elsewhere, with no way back. Everyone must be here, in this room.', pt: 'As runas se acendem quando vocês se aproximam. Quem estiver no círculo será levado para outro lugar, sem volta. Todos precisam estar aqui, nesta sala.' },
      sim: { en: 'We all step in.', pt: 'Todos entramos.' }, depois: { en: 'A flash of light: you are somewhere else, and the way back is gone.', pt: 'Um clarão: vocês estão em outro lugar, e o caminho de volta sumiu.' } } }[tipo];
  const casas = (plano.chegada && plano.chegada[k]) || casasParaHerois(pm, k, 4);
  // as in the game: the players confirm that nobody is left behind. "Not yet" leaves the object as it was
  const og = ab.g; const req = clone(og.requisitos || []); const senao = ab.o['senao:' + og.uid];
  const resto = (ab.o.gatilhos || []).filter(x => x !== og);
  const ch = { uid: uid(), tipo: 'choice', text: T2(T.pergunta), options: [{ text: T2(T.sim), response: '' }, { text: L2('Not yet.', 'Ainda não.'), response: L2('Gather everyone here first.', 'Reúnam todos aqui antes.') }], requisitos: req };
  // first the rooms behind leave the table (their pieces may make the new room), then the room opens, then the heroes go in
  ab.o['op0:' + ch.uid] = atras.map(i => ({ uid: uid(), tipo: 'remove_room', sala: i, requisitos: [] })).concat([{ ...og, requisitos: [] }], resto,
    [{ uid: uid(), tipo: 'move_heroes', cells: casas, _sala: k, text: T2(T.depois) + L2(' Every hero goes to the lit spaces.', ' Cada herói vai para os espaços iluminados.'), requisitos: [] }]);
  ab.o['op1:' + ch.uid] = [];
  if (senao) { ab.o['senao:' + ch.uid] = senao; delete ab.o['senao:' + og.uid]; if (ab.o.acaoExtra?.['senao:' + og.uid]) { delete ab.o.acaoExtra['senao:' + og.uid]; ab.o.acaoExtra['senao:' + ch.uid] = true; } }
  // "Not yet" costs nothing: the hero may perform an additional action
  ab.o.acaoExtra = { ...(ab.o.acaoExtra || {}), ['op1:' + ch.uid]: true };
  ab.o.gatilhos = [ch]; ab.o.usos = 'always';
  if (T.olhar) ab.o.textClick = T2(T.olhar);
  plano.semRetornoFeito.push({ sala: k, tipo, remove: atras.length });
  const nomes = { salto: 'salto', portao: 'portão', desabamento: 'desabamento', alcapao: 'alçapão', teleporte: 'teleporte' };
  notas.push(L2('Point of no return at room ' + (k + 1) + ' (' + tipo + '): rooms ' + atras.map(i => i + 1).join(', ') + ' leave the table.', 'Ponto sem volta na sala ' + (k + 1) + ' (' + nomes[tipo] + '): as salas ' + atras.map(i => i + 1).join(', ') + ' saem da mesa.'));
}
/* free squares of room si near its entry (or near the squares given), for the heroes moved there */
function casasParaHerois(pm, si, n, perto) {
  const s = pm.salas[si]; const ch = chaoDaSala(si, pm); const d = distancias(ch, perto && perto.length ? perto.flatMap(([x, y]) => [[x, y]].concat(VIZ8.map(([dx, dy]) => [x + dx, y + dy]))) : entradaDaSala(si, pm));   // (an object blocks its own squares: from those around it)
  const tomadas = new Set((s.inimigos || []).map(e => e.pos.join(','))); s.objetos.concat(s.grupoPool ? [s.grupoPool] : []).forEach(o => { if (o.pos) casasDoObjeto(o).forEach(c => tomadas.add(c.join(','))); todosGatilhos(o).forEach(g => { if (g.tipo === 'spawn') (g.cells || []).forEach(c => tomadas.add(c[0] + ',' + c[1])); }); });
  return [...ch.values()].filter(c => c.nivel === 0 && !c.alfombra && !c.bloqueia && !c.escada && !c.ponte && !c.muro && !c.degrau && d.has(c.x + ',' + c.y) && !tomadas.has(c.x + ',' + c.y)).sort((a, b) => d.get(a.x + ',' + a.y) - d.get(b.x + ',' + b.y)).slice(0, n).map(c => [c.x, c.y]);
}
/* the leader of the last room: in most maps a monster of the pool with a twist (more lives, reinforcements, it heals);
   now and then (1 in 20) a boss of the Workshop */
function chefeDaSala(pm, si, plano, rng, chefeReal) {
  const s = pm.salas[si]; const v = plano.rival ? { ...plano.vocab, vilao: plano.rival } : plano.vocab;
  // the villain's own lines (a skin of HISTORIAS.viloes), unless the leader is a rival band's
  const F = !plano.rival && plano.vilao && plano.vilao.falas ? plano.vilao.falas : {};
  let e = plano.chefeFixo || (s.inimigos || []).find(x => !ehPool(x.enemy)) || null;
  if (chefeReal && !plano.chefeFixo) { if (!e) e = s.inimigos[s.inimigos.length - 1]; if (!e) return null; e.enemy = chefeReal.id; e.tier = Math.max(2, e.tier || 3); return { id: 'chefe', nome: chefeReal.nome, alvo: e }; }
  if (!e) { const vaga = (s.inimigos || []).filter(x => ehPool(x.enemy)).pop(); const pool = (pm.reserva || []).map(monstro).filter(Boolean); if (!vaga || !pool.length) return null; vaga.enemy = rng.pick(pool).id; e = vaga; }
  const m = monstro(e.enemy); if (!m) return null; const maxT = tierDoLider(m, plano); e.tier = maxT; e.uid = e.uid || uid();
  const tipo = plano.chefeTipo || rng.pesado({ vidas: 3, reforcos: 3, regenera: 2 }); const ab = abridorDe(pm, si);
  if (tipo === 'vidas') {
    const vidas = plano.dificuldade === 'facil' ? 2 : rng.int(2, 3); let atual = e;
    for (let k = 1; k < vidas; k++) { const copia = { enemy: e.enemy, pos: e.pos.slice(), tier: maxT, level: e.level || 0, uid: uid(), gatilhos: [], senao: [] };
      atual.gatilhos = (atual.gatilhos || []).concat([gatilhoTexto(preencher(F.levanta || { en: '{vilao} falls… and rises again!', pt: '{vilao} cai… e se ergue de novo!' }, v)), { uid: uid(), tipo: 'spawn', fonte: 'list', inimigos: [copia], cells: [], requisitos: [] }]);
      atual = copia; }
    return { id: 'vidas', n: vidas, alvo: atual };
  }
  if (!ab) return { id: 'forte', alvo: e };
  if (tipo === 'reforcos') {
    const casas = casasDeInimigos(s, si, entradaDaSala(si, pm), 2, { distancia: [4, 9], padrao: 'fundo' }, rng, () => pm);
    const facil = plano.dificuldade === 'facil'; const g = { uid: uid(), tipo: 'rounds', modo: 'cada', n: 2, vezes: facil ? 2 : 3, requisitos: [] }; ab.o.gatilhos.push(g);
    ab.o['rodada:' + g.uid] = [gatilhoTexto(preencher(F.reforcos || { en: '{vilao} roars, and more of them pour in!', pt: '{vilao} ruge, e mais deles chegam!' }, v))].concat(casas.length ? [{ uid: uid(), tipo: 'spawn', fonte: 'pool', cells: casas.map(c => [c.x, c.y, c.nivel]).slice(0, facil ? 1 : 2), inimigos: [], intensidade: Math.max(1, Math.min(10, plano.base - (facil ? 1 : 0))), requisitos: [] }] : []);
    return { id: 'reforcos', alvo: e };
  }
  const g = { uid: uid(), tipo: 'rounds', modo: 'cada', n: 1, vezes: 0, requisitos: [] }; ab.o.gatilhos.push(g);
  const cura = plano.dificuldade === 'facil' ? 1 : 2;
  ab.o['rodada:' + g.uid] = [{ uid: uid(), tipo: 'enemy_condition', acao: 'heal', amount: cura, alvo: 'group', grupo: 'room-' + (si + 1), requisitos: [] }];
  s.textoDepois = ((s.textoDepois || '') + ' ' + preencher(F.regenera || { en: 'Dark power flows into {vilao}: its wounds close by themselves (it heals 2 each round).', pt: 'Um poder sombrio flui para {vilao}: as feridas se fecham sozinhas (cura 2 por rodada).' }, v).replace(/\b2\b(?=[^()]*\)\.?$)/, String(cura))).trim();
  return { id: 'regenera', alvo: e };
}
function aplicarTruque(pm, plano, rng, notas, salasDe) {
  const t = plano.truque; if (!t) return;
  const v = plano.vocab; const fim = salasDe.eixo[salasDe.eixo.length - 1]; const meio = salasDe.eixo.slice(1, -1); const lados = salasDe.lado;
  // (past a point of no return, only the rooms ahead of it)
  const doFim = i => !plano.grupo || (plano.grupo[i] || 0) === (plano.grupo[fim] || 0);
  // (never the respite: a seal that calls monsters there, or a nest, spoiled the breath before the last fight)
  // (…unless the respite is the only room left before the end: a seal there, rather than no seals at all)
  const hospedeiras = (n) => { const l = rng.embaralhar(lados).concat(rng.embaralhar(meio.filter(i => pm.salas[i]?.funcao !== 'respiro'))).concat([0]).filter((x, i, a) => a.indexOf(x) === i).filter(doFim);
    return (l.length ? l : meio.filter(doFim)).slice(0, n); };
  const coletar = coletor(pm, rng, notas, hospedeiras, fim);
  switch (t.id) {
    case 'fera': coletar('Tracks', 'Rastros', 3, ['InteractToken'], L2('Claw marks and blood: it passed here, and not long ago.', 'Marcas de garras e sangue: passou por aqui, e não faz muito.'), L2('The tracks are not enough yet. Where is the lair?', 'Os rastros ainda não bastam. Onde fica o covil?'), L2('Follow the tracks to the lair', 'Sigam os rastros até o covil'), null,
      { olhar: L2('Deep claw marks in the ground.', 'Marcas fundas de garras no chão.'), revela: L2('Deep claw marks score the ground here.', 'Marcas fundas de garras riscam o chão aqui.') }); break;
    case 'selos': {
      // the pieces that unlock, dressed by the skin drawn with the plan (a test with monsters, or none); the heart of the
      // place (the last room) waits for them, unless the count is itself the end of the map
      const R = plano.roupaTruque || HIST('pecas').find(x => x.modo === 'teste'); if (!R) break;
      plano.contadorFinal = pecasQueDestravam(pm, plano, rng, notas, hospedeiras, fim, R, 3, plano.premissa.final !== 'counter');
      break; }
    case 'resgate': {
      // the captives of the story (villagers, miners, pilgrims…: a skin of HISTORIAS.resgate, with where they may be held: tied
      // up, under the wagon, lowered into a well)
      const R = plano.roupaResgate || HIST('resgate')[0]; if (!R) break;
      const objetivo = q => RT(q === 1 ? R.objetivo1 : R.objetivoN, v, { n: q });
      const cont = coletor(pm, rng, notas, hospedeiras, fim, R)(TXT(R.contador), TXT(R.contador), 3, R.portadores || ['InteractToken'], RT(R.achar, v), null, objetivo, null, { olhar: RT(R.olhar, v), revela: RT(R.revela, v) });
      plano.resgateContador = cont;
      // (the counter says how many are free)
      pm.salas.forEach(s => s.objetos.forEach(o => (o.gatilhos || []).forEach(g => { if (g.tipo === 'counter' && g.contador === cont.nome) g.texto = RT(R.conta, v) || g.texto; })));
      // the captives are taken away when freed; one held at another thing (under the wagon, in the well) is pulled out, and
      // the thing stays where it is, with the look of the story
      pm.salas.forEach((s, si) => s.objetos.forEach(o => { if (!(o.gatilhos || []).some(g => g.tipo === 'counter' && g.contador === cont.nome)) return;
        const lugar = !ehTipo(o, 'InteractToken') && R.lugares ? R.lugares[baseObj(o.type)] : null;
        if (!ehTipo(o, 'InteractToken')) { const t = o.gatilhos.find(g => g.tipo === 'text'); if (t && lugar) t.text = RT(lugar.achar, v);
          apresentar(pm, si, o, lugar ? RT(lugar.olhar, v) : null, null); return; }
        if (!o.gatilhos.some(g => g.tipo === 'remove_object')) o.gatilhos.push({ uid: uid(), tipo: 'remove_object', proprio: true, requisitos: [] }); }));
      // the way out, at the start, shows up when all are free
      if (!(pm.contadores || []).includes(cont)) break;   // no captive found a room: the premise's own ending stands
      const sd = saidaNaSala(pm, 0, rng, { hidden: true, name: L2('The way out', 'A saída'), textClick: L2('The way out, at last.', 'A saída, enfim.') }); const oi = sd ? sd.oi : null;
      if (oi != null) { cont.gatilhos = [...(sd.arco != null ? [{ uid: uid(), tipo: 'add_object', objSala: 0, objIndex: sd.arco, requisitos: [] }] : []), { uid: uid(), tipo: 'add_object', objSala: 0, objIndex: oi, requisitos: [] }, gatilhoTexto(RT(R.todos, v))];
        pm.meta.finalMission = { tipo: 'use_object', sala: 0, objeto: oi, texto: RT(R.missao, v), rodadas: 8 }; plano.finalFeito = true; plano.saidaGuardada = { sala: 0, oi }; }
      break; }
    case 'escolta': escoltaDoMapa(pm, plano, rng, notas, salasDe, coletar, fim); break;
    case 'ninhos': {
      // each nest breeds while it stands (a count of its own, 1 from the start): every two rounds, once its room is open,
      // something crawls out; torn down (a long test of might), it stops for good
      let k = 0;
      plano.contadorFinal = coletar('Nests', 'Ninhos', 3, ['InteractToken'], '', plano.premissa.final === 'counter' ? null : L2('Resin and bone seal the way ahead. It will not give while a nest still breeds.', 'Resina e ossos selam o caminho adiante. Não vão ceder enquanto algum ninho ainda gerar crias.'), L2('Destroy the nests', 'Destruam os ninhos'), (o, cont, si) => {
        k++; const vivo = novoContadorMapa(pm, L2('Nest ' + k + ' alive', 'Ninho ' + k + ' vivo'), 1, ''); delete vivo.missao; vivo.inicio = 1;
        const t = testeNoObjeto(o, { stat: 'might', sucessos: 3, cumulativo: true, text: { en: 'A nest of resin, bone and something that breathes. Tear it down: it will take more than one blow.', pt: 'Um ninho de resina, ossos e algo que respira. Derrubem-no: vai precisar de mais de um golpe.' }, ok: { en: 'The nest splits open and goes still. Nothing more will crawl out of it.', pt: 'O ninho se abre e fica imóvel. Nada mais vai rastejar para fora dele.' }, fail: { en: 'The nest shrieks; ichor splashes the hero, who suffers 1 damage.', pt: 'O ninho guincha; o icor respinga no herói, que sofre 1 de dano.' } });
        o.gatilhos = [t]; o.usos = 'always';
        o['ok:' + t.uid].push({ uid: uid(), tipo: 'counter', contador: cont.nome, acao: 'add', n: 1, texto: L2('Nests destroyed: [n] of [total].', 'Ninhos destruídos: [n] de [total].'), requisitos: [] }, { uid: uid(), tipo: 'counter', contador: vivo.nome, acao: 'set', n: 0, texto: '', requisitos: [] });
        const casas = casasDeInimigos(pm.salas[si], si, entradaDaSala(si, pm), 2, { distancia: [2, 6], padrao: 'fundo' }, rng, () => pm);
        if (!casas.length) return; const req = () => [{ tipo: 'counter', contador: vivo.nome, meta: 1 }].concat(si > 0 ? [{ tipo: 'room_open', sala: si }] : []);
        pm.eventos = (pm.eventos || []).concat([{ uid: 'ni' + uid(), sala: si, rodada: 2, cada: 2, gatilhos: [gatilhoTexto(L2('A nest pulses, and something crawls out of it!', 'Um ninho pulsa, e algo rasteja para fora dele!'), req()),
          { uid: uid(), tipo: 'spawn', fonte: 'pool', cells: casas.map(c => [c.x, c.y, c.nivel]), inimigos: [], intensidade: Math.max(1, Math.min(10, plano.base - 3)), requisitos: req() }] }]);
      }, { todos: true, olhar: L2('A nest of resin and bone, breathing slowly.', 'Um ninho de resina e ossos, respirando devagar.'), revela: L2('A nest of resin and bone breathes slowly here.', 'Um ninho de resina e ossos respira devagar aqui.') });
      break; }
    case 'desabamento': {
      // the clock of the story (a collapse, a flood, a fire, the rite nearly done…: a skin of HISTORIAS.relogio)
      const R = plano.roupaRelogio; pm.meta.limite = Math.max(8, pm.salas.length * 3 + 2) + (plano.dificuldade === 'facil' ? 4 : 0); const vl = { ...v, limite: pm.meta.limite };
      const sd = saidaNaSala(pm, fim, rng, { name: L2('The way out', 'A saída') }); const oi = sd ? sd.oi : null;
      if (oi != null) apresentar(pm, fim, pm.salas[fim].objetos[oi], R ? RT(R.saidaOlhar, vl) : L2('The way out, still open. For now.', 'A saída, ainda aberta. Por enquanto.'), R ? RT(R.saidaRevela, vl) : L2('Beyond the rubble, the way out is still open.', 'Depois dos escombros, a saída ainda está aberta.'));
      if (oi != null) { pm.meta.finalMission = { tipo: 'use_object', sala: fim, objeto: oi, texto: R ? RT(R.missao, vl) : L2('Reach the way out before round ' + pm.meta.limite, 'Alcancem a saída antes da rodada ' + pm.meta.limite), rodadas: 8 }; plano.finalFeito = true; plano.saidaGuardada = { sala: fim, oi }; }
      if (R) plano.introExtra = (plano.introExtra || []).concat([RT(R.intro, vl)]);
      // the tremors: every three rounds a map event, its line changing each time (three lines, over and over)
      const abalos = R && (R.abalo || []).length ? R.abalo.map(x => RT(x, vl)) : [L2('The ground heaves; dust and stones rain down. Hurry!', 'O chão se ergue; poeira e pedras chovem. Depressa!')];
      pm.eventos = (pm.eventos || []).concat(abalos.map((t, k) => ({ uid: 'tr' + uid(), sala: 0, rodada: 3 * (k + 1), cada: 3 * abalos.length, gatilhos: [txtT(t, t)] })));
      plano.relogioUsado = true;
      break; }
  }
}
/* the escort: a guide (a token in the first room) who must cross the place, played much like a companion of the game.
   Talking to the guide tells the story and the rules and starts the escort (the mod lets the monsters pick the guide as
   their target: the hunters always, the others now and then); the way on stays shut until then. The table keeps the
   guide's 5 health with any tokens; attacked, the guide defends with one die of its own (black, blue or orange); when a
   hero performs a maneuver, the guide may move up to 4 spaces. Three waystones (interaction tokens) answer only with the
   guide beside them: each tells a piece of the story, draws hunters and takes the guide's token there. When the guide
   falls, the table taps the guide's token: a hero carries the guide from then on (2 fatigue every round), the monsters
   stop going for the guide, the waystones answer to the carrier, and the prize at the end is smaller */
const GUIAS = [{ nome: { en: 'Sister Maren', pt: 'Irmã Maren' }, ela: true }, { nome: { en: 'Tobin', pt: 'Tobin' }, ela: false }, { nome: { en: 'Ilsa', pt: 'Ilsa' }, ela: true }, { nome: { en: 'Brother Aldo', pt: 'Irmão Aldo' }, ela: false }];
const DADOS_DEFESA = [{ en: 'black', pt: 'preto' }, { en: 'blue', pt: 'azul' }, { en: 'orange', pt: 'laranja' }];
/* a free square beside object o of room si (for the guide's token) */
function casaAoLado(pm, si, o) {
  const s = pm.salas[si]; const ch = chaoDaSala(si, pm); const tomadas = new Set(); s.objetos.forEach(x => { if (x.pos) casasDoObjeto(x).forEach(c => tomadas.add(c[0] + ',' + c[1])); });
  for (const [x, y] of casasDoObjeto(o)) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
    const c = ch.get((x + dx) + ',' + (y + dy)); if (c && !c.alfombra && !c.bloqueia && !c.escada && !c.ponte && !c.muro && !tomadas.has(c.x + ',' + c.y)) return [c.x, c.y, c.nivel || 0]; }
  return null;
}
function escoltaDoMapa(pm, plano, rng, notas, salasDe, coletar, fim) {
  // the guide of the story (a skin of HISTORIAS.escolta: who, why, what the waystones are, the beats told at them)
  const G = plano.roupaGuia || HIST('escolta')[0] || { nome: GUIAS[0].nome, ela: GUIAS[0].ela };
  const v = plano.vocab; const X = TXT(G.nome); const dado = T2(rng.pick(DADOS_DEFESA)); const vx = { ...v, X };
  const ele = G.ela ? L2('she', 'ela') : L2('he', 'ele'), dele = G.ela ? L2('her', 'dela') : L2('his', 'dele'), o_a = G.ela ? L2('her', 'a') : L2('him', 'o'), lo_la = G.ela ? L2('her', 'la') : L2('him', 'lo');
  const Ele = ele.charAt(0).toUpperCase() + ele.slice(1);
  const res = pm.salas[0].objetos.findIndex(o => o._reservado); if (res >= 0) pm.salas[0].objetos[res].name = X;
  const oi0 = res >= 0 ? res : colocarNaSala(pm, 0, 'InteractToken', rng, { name: X }); if (oi0 == null) { notas.push(L2('No place for the guide.', 'Sem lugar para o guia.')); return; }
  const npc = pm.salas[0].objetos[oi0]; Object.defineProperty(npc, '_narrador', { value: true, enumerable: false, configurable: true });
  // the guide standing (1 while standing) and fallen (1 once carried): the prize at the end reads them
  const vivo = novoContadorMapa(pm, L2('Guide', 'Guia'), 1, ''); delete vivo.missao;
  const caido = novoContadorMapa(pm, L2('Guide carried', 'Guia carregado'), 1, ''); delete caido.missao;
  // (talked to once, for good: the way on stays open after the guide falls and is carried)
  const achado = novoContadorMapa(pm, L2('Guide met', 'Guia encontrado'), 1, ''); delete achado.missao;
  const inicio = { uid: uid(), tipo: 'escort', acao: 'inicio', nome: X, chance: 25, cacadores: [], requisitos: [] };
  // the story (the premise's own, in the guide's mouth when it is the escort) and why this guide must cross
  const intro = preencher(rng.pick(plano.premissa.intro[LP()] || plano.premissa.intro.en), v); const motivo = RT(G.motivo, vx);
  const historia = plano.premissa.id === 'escolta' ? '"' + intro + (motivo ? ' ' + motivo : '') + '"'
    : intro + ' ' + (G.quem ? L2(X + ', ' + TXT(G.quem) + ', knows the way: ', X + ', ' + TXT(G.quem) + ', conhece o caminho: ') + (motivo ? '"' + motivo + '"' : '') : L2(X + ' knows the way, and asks you to take ' + o_a + ' through.', X + ' conhece o caminho e pede que vocês ' + o_a + ' levem até o outro lado.'));
  const M = G.marco || {}; const marcoNome = M.nome ? TXT(M.nome) : L2('waystone', 'marco');
  const regras = L2(X + ' goes with you. ' + Ele + ' has 5 health: keep it beside ' + dele + ' token with any tokens you like. The monsters may choose ' + o_a + ' as their target (the activation window shows it); attacked, ' + ele + ' rolls the ' + dado + ' defense die, and each success prevents 1 damage. When a hero performs a maneuver, ' + X + ' may also move up to 4 spaces. Each ' + marcoNome + ' answers only with ' + X + ' beside it. If ' + ele + ' falls, tap ' + dele + ' token.',
    X + ' segue com vocês. ' + Ele + ' tem 5 de vida: marquem ao lado da ficha ' + dele + ', com as fichas que quiserem. Os monstros podem escolhê-' + lo_la + ' como alvo (a janela de ativação mostra); quando atacad' + (G.ela ? 'a' : 'o') + ', ' + ele + ' rola o dado de defesa ' + dado + ', e cada sucesso evita 1 de dano. Quando um herói fizer uma manobra, ' + X + ' também pode se mover até 4 casas. Cada ' + marcoNome + ' só responde com ' + X + ' ao lado. Se ' + ele + ' cair, toquem na ficha ' + dele + '.');
  const ch = { uid: uid(), tipo: 'choice', text: L2(X + ' is with you.', X + ' está com vocês.'), options: [{ text: L2(Ele + ' fell (5 damage).', Ele + ' caiu (5 de dano).'), response: '' }, { text: L2(Ele + ' is still standing.', Ele + ' continua de pé.'), response: '' }], requisitos: [{ tipo: 'counter', contador: vivo.nome, meta: 1 }] };
  npc.textClick = G.olhar ? RT(G.olhar, vx) : L2(X + ' waits, watching the dark ahead.', X + ' espera, olhando a escuridão adiante.');
  npc.gatilhos = [ch]; npc.usos = 'always';
  npc['senao:' + ch.uid] = [gatilhoTexto(historia + '\n\n' + regras), { uid: uid(), tipo: 'counter', contador: achado.nome, acao: 'add', n: 1, texto: '', requisitos: [] }, { uid: uid(), tipo: 'counter', contador: vivo.nome, acao: 'add', n: 1, texto: '', requisitos: [] }, inicio];   // (add: the solver counts what adds)
  // fallen: carried by a hero from now on (2 fatigue every round, said at the start of each round), no longer a target
  const peso = { uid: uid(), tipo: 'rounds', modo: 'cada', n: 1, vezes: 0, requisitos: [] };
  npc['rodada:' + peso.uid] = [txtT('The hero carrying ' + X + ' suffers 2 fatigue.', 'O herói que carrega ' + X + ' sofre 2 de fadiga.')];
  npc['op0:' + ch.uid] = [txtT(X + ' falls, barely breathing. One of you must carry ' + o_a + ' from now on: take ' + dele + ' token off the table; the hero who carries ' + o_a + ' suffers 2 fatigue at the start of every round. The monsters no longer go for ' + o_a + ', and each ' + marcoNome + ' answers to whoever carries ' + o_a + '.', X + ' cai, respirando com dificuldade. Um de vocês precisa carregá-' + lo_la + ' daqui em diante: tirem a ficha ' + dele + ' da mesa; o herói que ' + o_a + ' carrega sofre 2 de fadiga no começo de cada rodada. Os monstros não vão mais atrás ' + dele + ', e cada ' + marcoNome + ' responde a quem ' + o_a + ' carrega.'),
    { uid: uid(), tipo: 'counter', contador: vivo.nome, acao: 'set', n: 0, texto: '', requisitos: [] }, { uid: uid(), tipo: 'counter', contador: caido.nome, acao: 'add', n: 1, texto: '', requisitos: [] },
    { uid: uid(), tipo: 'escort', acao: 'fim', requisitos: [] }, peso, { uid: uid(), tipo: 'remove_object', proprio: true, requisitos: [] }];
  npc['op1:' + ch.uid] = []; npc.acaoExtra = { ...(npc.acaoExtra || {}), ['op1:' + ch.uid]: true };
  apresentar(pm, 0, npc, null, L2(X + ' waits here, ready to go.', X + ' espera aqui, pront' + (G.ela ? 'a' : 'o') + ' para seguir.'));
  // the way on waits for the guide
  const eixo1 = salasDe.eixo[1]; const ab1 = eixo1 != null ? abridorDe(pm, eixo1) : null;
  travaDoGuia(ab1, achado, X);
  // the waystones (of the story: a smuggler's chalk marks, a priest's shrines…), each telling a beat
  const BEATS = (G.batidas || []).length ? G.batidas.map(b => RT(b, vx)) : [L2('The runes wake under ' + X + '’s hand. The glow draws creatures out of the dark: these hunt ' + X + '.', 'As runas despertam sob a mão de ' + X + '. O brilho atrai criaturas da escuridão: estas caçam ' + X + '.')];
  let k = 0; const olharM = M.olhar ? RT(M.olhar, vx) : L2('An old waystone, carved with runes.', 'Um marco antigo, com runas gravadas.');
  const contM = M.contador ? TXT(M.contador) : L2('Waystones', 'Marcos');
  const marcos = coletar(contM, contM, 3, ['InteractToken'], '', M.trancado ? RT(M.trancado, vx) : L2('The way ahead answers only to the three waystones, woken with ' + X + ' beside them.', 'O caminho adiante só responde aos três marcos, despertados com ' + X + ' ao lado.'), M.objetivo ? RT(M.objetivo, vx) : L2('Wake the three waystones with ' + X + ' beside them', 'Despertem os três marcos com ' + X + ' ao lado'), (o, cont, si) => {
    const beat = BEATS[Math.min(k, BEATS.length - 1)]; k++;
    const casas = casasDeInimigos(pm.salas[si], si, entradaDaSala(si, pm), 2, { distancia: [3, 7], padrao: 'fundo' }, rng, () => pm);
    const sp = casas.length ? { uid: uid(), tipo: 'spawn', fonte: 'pool', cells: casas.map(c => [c.x, c.y, c.nivel]), inimigos: [], intensidade: Math.max(1, Math.min(10, plano.base - 1)), requisitos: [] } : null;
    const sp2 = sp ? { ...clone(sp), uid: uid() } : null; if (sp) inicio.cacadores.push(sp.uid, sp2.uid);   // (each answer its own group: the same uid twice would spawn twice)
    const ao = casaAoLado(pm, si, o); const mover = ao ? [{ uid: uid(), tipo: 'move_object', objSala: 0, objIndex: oi0, cell: ao, requisitos: [] }] : [];
    const q = { uid: uid(), tipo: 'choice', text: M.pergunta ? RT(M.pergunta, vx) : L2('An old waystone, carved with runes only ' + X + ' can read. Is ' + ele + ' beside it?', 'Um marco antigo, com runas que só ' + X + ' sabe ler. ' + Ele + ' está ao lado dele?'), options: [{ text: L2('Yes, ' + X + ' is beside it.', 'Sim, ' + X + ' está ao lado.'), response: '' }, { text: L2('The hero carrying ' + X + ' is beside it.', 'O herói que carrega ' + X + ' está ao lado.'), response: '' }, { text: L2('Not yet.', 'Ainda não.'), response: L2('Nothing happens. Bring ' + X + ' here.', 'Nada acontece. Tragam ' + X + ' até aqui.') }], requisitos: [] };
    o.textClick = olharM; o.gatilhos = [q]; o.usos = 'always';
    const conta = { uid: uid(), tipo: 'counter', contador: cont.nome, acao: 'add', n: 1, texto: contM + ': [n] ' + L2('of', 'de') + ' [total].', requisitos: [] };
    o['op0:' + q.uid] = [gatilhoTexto(beat), conta].concat(mover, sp ? [sp] : [], [{ uid: uid(), tipo: 'remove_object', proprio: true, requisitos: [] }]);
    o['op1:' + q.uid] = [gatilhoTexto(L2(X + ' stirs on the carrier’s back and whispers what to do. ', X + ' se mexe nas costas de quem ' + o_a + ' carrega e sussurra o que fazer. ') + beat), clone(conta)].concat(sp2 ? [sp2] : [], [{ uid: uid(), tipo: 'remove_object', proprio: true, requisitos: [] }]);
    o['op2:' + q.uid] = []; o.acaoExtra = { ...(o.acaoExtra || {}), ['op2:' + q.uid]: true };
  }, { todos: true, olhar: olharM, revela: M.revela ? RT(M.revela, vx) : L2('An old waystone stands here, carved with runes.', 'Um marco antigo, com runas gravadas, está aqui.') });
  plano.escolta = { X, ela: G.ela, oi0, vivo, caido, achado, marcos, traicao: G.traicao ? RT(G.traicao, vx) : null };
  // the way out (an escort ends there) and the prize: the whole of it with the guide standing, a smaller one if carried
  const premio = { uid: uid(), tipo: 'counter', acao: 'use', contador: vivo.nome, n: 1, desde: 'uso', requisitos: [] };
  const menor = { uid: uid(), tipo: 'counter', acao: 'use', contador: caido.nome, n: 1, desde: 'uso', requisitos: [] };
  const dar = [txtT(G.premio ? RT(G.premio, vx) : X + ' keeps the promise and hands you what was hidden for this day.', G.premio ? RT(G.premio, vx) : X + ' cumpre a promessa e entrega o que guardava para este dia.'), itemNovo(), itemNovo(), ouroDe(40)];
  const darMenor = [txtT(G.premioMenor ? RT(G.premioMenor, vx) : 'Carried to the end, ' + X + ' can only press a small purse into your hands.', G.premioMenor ? RT(G.premioMenor, vx) : 'Carregad' + (G.ela ? 'a' : 'o') + ' até o fim, ' + X + ' só consegue pôr uma bolsinha nas mãos de vocês.'), ouroDe(20)];
  if (plano.premissa.final === 'exit') {
    const sd = saidaNaSala(pm, fim, rng, { name: L2('The way out', 'A saída'), textClick: L2('The way out, at last.', 'A saída, enfim.') });
    if (sd) { const o = pm.salas[fim].objetos[sd.oi]; o.gatilhos = [premio, menor]; o['conta:' + premio.uid] = dar; o['conta:' + menor.uid] = darMenor;
      pm.meta.finalMission = { tipo: 'use_object', sala: fim, objeto: sd.oi, texto: L2('Reach the way out', 'Alcancem a saída'), rodadas: 8 }; plano.finalFeito = true; plano.saidaGuardada = { sala: fim, oi: sd.oi }; return; }
  }
  const gp = grupoPoolDe(pm.salas[fim]); gp.gatilhos = (gp.gatilhos || []).concat([premio, menor]); gp['conta:' + premio.uid] = dar; gp['conta:' + menor.uid] = darMenor;
}
/* the end of the defence: at the stand of the last room, waves every two rounds; the count of waves is the mission */
function ondasNoFim(pm, plano, rng, notas, fim) {
      const s = pm.salas[fim]; const ent = entradaDaSala(fim, pm);
      const oi = colocarNaSala(pm, fim, 'InteractToken', rng, { name: L2('The stand', 'O ponto de defesa') }); if (oi == null) { notas.push(L2('No place for the stand.', 'Sem lugar para o ponto de defesa.')); return; }
      apresentar(pm, fim, s.objetos[oi], L2('A spot that can be held against many.', 'Um ponto que dá para defender contra muitos.'), L2('One spot here could be held against many: the stand.', 'Um ponto aqui dá para defender contra muitos: o ponto de defesa.'));
      // (Easy: three waves)
      const nw = plano.dificuldade === 'facil' ? 3 : 4; const cont = novoContadorMapa(pm, L2('Waves', 'Ondas'), nw, nw === 3 ? L2('Hold out against three waves', 'Resistam a três ondas') : L2('Hold out against four waves', 'Resistam a quatro ondas'));
      const casas = casasDeInimigos(s, fim, ent, 3, { distancia: [4, 9], padrao: 'fundo' }, rng, () => pm);
      const o = s.objetos[oi]; const g = { uid: uid(), tipo: 'rounds', modo: 'cada', n: 2, vezes: nw, requisitos: [] };
      o.gatilhos = [txtT('You take the stand. They are coming: hold!', 'Vocês assumem a posição. Eles estão vindo: segurem!'), g];
      o['rodada:' + g.uid] = [{ uid: uid(), tipo: 'counter', contador: cont.nome, acao: 'add', n: 1, texto: L2('Wave [n] of [total].', 'Onda [n] de [total].'), requisitos: [] }].concat(casas.length ? [{ uid: uid(), tipo: 'spawn', fonte: 'pool', cells: casas.map(c => [c.x, c.y, c.nivel]), inimigos: [], intensidade: Math.min(10, plano.base + 1), requisitos: [] }] : []);
      pm.meta.finalMission = { tipo: 'trigger', uid: cont.missao.uid, texto: cont.missao.texto, rodadas: 8 }; plano.finalFeito = true;
}
/* the opening of a map: the text read at the start only sets the scene (where, a first unease); the story itself is told
   in the first room, by someone met there (an NPC: an interaction token) or by something found there (a point of interest),
   so the heroes learn why they came by playing */
const ABERTURAS = {
  resgate: { chegada: { en: ['The road ends at {lugar}. The village behind you was far too quiet.'], pt: ['A estrada termina em {lugar}. A aldeia que ficou para trás estava quieta demais.'] },
    npc: { nome: { en: 'A frightened villager', pt: 'Um aldeão assustado' }, olhar: { en: 'A villager crouches behind a crate, shaking.', pt: 'Um aldeão se encolhe atrás de um caixote, tremendo.' }, antes: { en: 'He grabs your sleeve:', pt: 'Ele agarra a manga de vocês:' }, revela: { en: 'Someone is hiding here, shaking.', pt: 'Alguém está escondido aqui, tremendo.' } },
    marca: { nome: { en: 'A torn shawl', pt: 'Um xale rasgado' }, olhar: { en: 'A torn shawl caught on a nail, and drag marks in the dirt.', pt: 'Um xale rasgado preso num prego, e marcas de arrasto na terra.' }, antes: { en: 'The marks lead deeper inside. The pieces fall into place.', pt: 'As marcas seguem para dentro. As peças se encaixam.' }, revela: { en: 'Something is caught on a nail near the way in.', pt: 'Algo está preso num prego perto da entrada.' } } },
  reliquia: { chegada: { en: ['After days on the road, you reach {lugar}. Fresh footprints in the dust: someone got here first.'], pt: ['Depois de dias de estrada, vocês chegam a {lugar}. Pegadas frescas na poeira: alguém chegou antes.'] },
    npc: { nome: { en: 'A wounded scout', pt: 'Um batedor ferido' }, olhar: { en: 'A scout slumps against the wall, a hand pressed to his side.', pt: 'Um batedor está caído contra a parede, a mão apertando o flanco.' }, antes: { en: 'He coughs, and points inside:', pt: 'Ele tosse e aponta para dentro:' }, revela: { en: 'A wounded man slumps against a wall.', pt: 'Um homem ferido está caído contra uma parede.' } },
    marca: { nome: { en: 'A burned page', pt: 'Uma página queimada' }, olhar: { en: 'A half-burned page, pinned under a stone.', pt: 'Uma página meio queimada, presa sob uma pedra.' }, antes: { en: 'The ink can still be read.', pt: 'A tinta ainda se lê.' }, revela: { en: 'A scrap of paper flutters under a stone.', pt: 'Um pedaço de papel se agita sob uma pedra.' } } },
  ritual: { chegada: { en: ['A low hum rises from the ground of {lugar}. The birds left days ago.'], pt: ['Um zumbido grave sobe do chão de {lugar}. Os pássaros foram embora há dias.'] },
    npc: { nome: { en: 'A runaway acolyte', pt: 'Um acólito fugido' }, olhar: { en: 'A young acolyte in a torn robe, eyes wide.', pt: 'Um jovem acólito de túnica rasgada, olhos arregalados.' }, antes: { en: 'He whispers, as if the walls could hear:', pt: 'Ele sussurra, como se as paredes ouvissem:' }, revela: { en: 'A figure in a torn robe hides in a corner.', pt: 'Uma figura de túnica rasgada se esconde num canto.' } },
    marca: { nome: { en: 'A circle of ash', pt: 'Um círculo de cinzas' }, olhar: { en: 'A circle of ash on the floor, still warm.', pt: 'Um círculo de cinzas no chão, ainda morno.' }, antes: { en: 'Symbols are drawn around it, and their meaning is plain enough.', pt: 'Há símbolos desenhados em volta, e o sentido deles é bem claro.' }, revela: { en: 'Something is drawn in ash on the floor.', pt: 'Há algo desenhado em cinzas no chão.' } } },
  cacada: { chegada: { en: ['You reach {lugar} at dusk. Nothing sings, nothing moves.'], pt: ['Vocês chegam a {lugar} ao entardecer. Nada canta, nada se mexe.'] },
    npc: { nome: { en: 'A shaken hunter', pt: 'Um caçador abalado' }, olhar: { en: 'A hunter sits on the ground, his bow snapped in two.', pt: 'Um caçador está sentado no chão, o arco partido ao meio.' }, antes: { en: 'He does not look up:', pt: 'Ele não levanta os olhos:' }, revela: { en: 'A man sits alone on the ground.', pt: 'Um homem está sentado sozinho no chão.' } },
    marca: { nome: { en: 'A mauled carcass', pt: 'Uma carcaça dilacerada' }, olhar: { en: 'What is left of an ox. The bites are huge.', pt: 'O que sobrou de um boi. As mordidas são enormes.' }, antes: { en: 'The tracks around it tell the rest.', pt: 'Os rastros em volta contam o resto.' }, revela: { en: 'Something lies torn apart near the way in.', pt: 'Algo jaz despedaçado perto da entrada.' } } },
  investigacao: { chegada: { en: ['{lugar}. The garrison barely looks up as you pass.'], pt: ['{lugar}. A guarnição mal levanta os olhos quando vocês passam.'] },
    npc: { nome: { en: 'A nervous clerk', pt: 'Um escrivão nervoso' }, olhar: { en: 'A clerk clutches a ledger to his chest.', pt: 'Um escrivão aperta um livro contra o peito.' }, antes: { en: 'He checks that nobody is listening:', pt: 'Ele confere se ninguém está ouvindo:' }, revela: { en: 'A man with a ledger waits in the shadows.', pt: 'Um homem com um livro espera nas sombras.' } },
    marca: { nome: { en: 'An abandoned pack', pt: 'Uma mochila abandonada' }, olhar: { en: 'A traveller\'s pack, dropped and never picked up.', pt: 'A mochila de um viajante, largada e nunca recolhida.' }, antes: { en: 'Inside, a letter that was never sent.', pt: 'Dentro, uma carta que nunca foi enviada.' }, revela: { en: 'A traveller\'s pack lies forgotten here.', pt: 'Uma mochila de viajante está esquecida aqui.' } } },
  fuga: { chegada: { en: ['You are deep inside {lugar} when the ground shivers for the first time.'], pt: ['Vocês estão bem dentro de {lugar} quando o chão estremece pela primeira vez.'] },
    npc: { nome: { en: 'A trapped miner', pt: 'Um mineiro encurralado' }, olhar: { en: 'A miner covered in dust, staring at the ceiling.', pt: 'Um mineiro coberto de poeira, olhando para o teto.' }, antes: { en: 'He grabs you:', pt: 'Ele agarra vocês:' }, revela: { en: 'A dusty man stares at the ceiling.', pt: 'Um homem empoeirado encara o teto.' } },
    marca: { nome: { en: 'A fresh crack', pt: 'Uma rachadura recente' }, olhar: { en: 'A crack runs up the wall, wider by the minute.', pt: 'Uma rachadura sobe pela parede, mais larga a cada minuto.' }, antes: { en: 'Dust trickles from it. There is no mistaking it.', pt: 'Poeira escorre dela. Não há como se enganar.' }, revela: { en: 'A crack runs up one wall.', pt: 'Uma rachadura sobe por uma das paredes.' } } },
  defesa: { chegada: { en: ['You reach {lugar} with a few hours to spare. Or so you hope.'], pt: ['Vocês chegam a {lugar} com algumas horas de folga. Ou assim esperam.'] },
    npc: { nome: { en: 'A wounded runner', pt: 'Um mensageiro ferido' }, olhar: { en: 'A runner in torn colours, still catching his breath.', pt: 'Um mensageiro de insígnias rasgadas, ainda sem fôlego.' }, antes: { en: 'Between gasps:', pt: 'Entre um fôlego e outro:' }, revela: { en: 'A man in torn colours leans on the wall.', pt: 'Um homem de insígnias rasgadas se apoia na parede.' } },
    marca: { nome: { en: 'A war horn', pt: 'Uma trompa de guerra' }, olhar: { en: 'A cracked war horn, with fresh blood on it.', pt: 'Uma trompa de guerra rachada, com sangue fresco.' }, antes: { en: 'Far off, drums answer the silence. It is clear now.', pt: 'Ao longe, tambores respondem ao silêncio. Agora está claro.' }, revela: { en: 'A war horn lies dropped in the dust.', pt: 'Uma trompa de guerra está largada na poeira.' } } },
  escolta: { chegada: { en: ['Behind you, the road you came by is already watched. Ahead, {lugar}.'], pt: ['Atrás de vocês, a estrada por onde vieram já está vigiada. Adiante, {lugar}.'] },
    npc: { nome: { en: 'A traveller', pt: 'Um viajante' }, olhar: { en: 'A traveller waits by the wall.', pt: 'Um viajante espera junto à parede.' }, antes: { en: 'He says:', pt: 'Ele diz:' }, revela: { en: 'Someone waits here.', pt: 'Alguém espera aqui.' } },
    marca: { nome: { en: 'Old runes', pt: 'Runas antigas' }, olhar: { en: 'Old runes on the wall.', pt: 'Runas antigas na parede.' }, antes: { en: 'They read:', pt: 'Elas dizem:' }, revela: { en: 'Old runes mark one wall.', pt: 'Runas antigas marcam uma parede.' } } },
  selos: { chegada: { en: ['The air in {lugar} tastes of iron, and the light falls wrong.'], pt: ['O ar em {lugar} tem gosto de ferro, e a luz cai de um jeito errado.'] },
    npc: { nome: { en: 'A frightened warden', pt: 'Uma guardiã assustada' }, olhar: { en: 'A warden of the old wards, her lantern shaking.', pt: 'Uma guardiã das velhas proteções, a lanterna tremendo.' }, antes: { en: 'She speaks fast:', pt: 'Ela fala depressa:' }, revela: { en: 'A woman with a lantern waits here.', pt: 'Uma mulher com uma lanterna espera aqui.' } },
    marca: { nome: { en: 'A bleeding rift', pt: 'Uma fenda que sangra' }, olhar: { en: 'A crack in the air itself, dripping red light.', pt: 'Uma fenda no próprio ar, pingando luz vermelha.' }, antes: { en: 'Looking at it, you understand.', pt: 'Ao olhar para ela, vocês entendem.' }, revela: { en: 'The air itself is cracked here.', pt: 'O próprio ar está rachado aqui.' } } },
  maquina: { chegada: { en: ['You hear it before you see it: hammers, somewhere deep inside {lugar}.'], pt: ['Vocês ouvem antes de ver: martelos, em algum lugar no fundo de {lugar}.'] },
    npc: { nome: { en: 'A deserter', pt: 'Um desertor' }, olhar: { en: 'A legionary without his shield, hands raised.', pt: 'Um legionário sem o escudo, de mãos erguidas.' }, antes: { en: 'He talks fast, glancing back:', pt: 'Ele fala depressa, olhando para trás:' }, revela: { en: 'A legionary without a shield waits here, hands raised.', pt: 'Um legionário sem escudo espera aqui, de mãos erguidas.' } },
    marca: { nome: { en: 'Siege plans', pt: 'Planos de cerco' }, olhar: { en: 'Rolled plans, stained with grease.', pt: 'Planos enrolados, manchados de graxa.' }, antes: { en: 'The drawings leave no doubt.', pt: 'Os desenhos não deixam dúvida.' }, revela: { en: 'Rolled plans lie dropped near the way in.', pt: 'Planos enrolados estão caídos perto da entrada.' } } },
  carga: { chegada: { en: ['Wheel ruts leave the road and run into {lugar}.'], pt: ['Marcas de rodas saem da estrada e entram em {lugar}.'] },
    npc: { nome: { en: 'A beaten driver', pt: 'Um carroceiro espancado' }, olhar: { en: 'A wagon driver sits against the wall, one eye swollen shut.', pt: 'Um carroceiro está sentado contra a parede, com um olho inchado.' }, antes: { en: 'He spits and points inside:', pt: 'Ele cospe e aponta para dentro:' }, revela: { en: 'A beaten man sits against a wall.', pt: 'Um homem espancado está sentado contra uma parede.' } },
    marca: { nome: { en: 'A broken wheel', pt: 'Uma roda quebrada' }, olhar: { en: 'A wagon wheel, split, painted in the caravan’s colours.', pt: 'Uma roda de carroça, rachada, pintada com as cores da caravana.' }, antes: { en: 'The ruts beyond it tell the rest.', pt: 'Os sulcos adiante contam o resto.' }, revela: { en: 'A broken wagon wheel lies here.', pt: 'Uma roda de carroça quebrada está aqui.' } } },
  tenente: { chegada: { en: ['A patrol passes by, heading for {lugar}. You follow at a distance.'], pt: ['Uma patrulha passa, rumo a {lugar}. Vocês seguem de longe.'] },
    npc: { nome: { en: 'A spy of the city', pt: 'Uma espiã da cidade' }, olhar: { en: 'A spy in a stolen Legion cloak.', pt: 'Uma espiã num manto roubado da Legião.' }, antes: { en: 'She whispers:', pt: 'Ela sussurra:' }, revela: { en: 'Someone in a Legion cloak waits in the shadows.', pt: 'Alguém num manto da Legião espera nas sombras.' } },
    marca: { nome: { en: 'A dropped dispatch', pt: 'Um despacho caído' }, olhar: { en: 'A dispatch case, dropped in a hurry.', pt: 'Um estojo de despachos, largado às pressas.' }, antes: { en: 'The dispatch inside is half burned.', pt: 'O despacho dentro está meio queimado.' }, revela: { en: 'A dispatch case lies on the floor.', pt: 'Um estojo de despachos está no chão.' } } },
  pocos: { chegada: { en: ['The streams around {lugar} run dark, and nothing drinks from them.'], pt: ['Os riachos em volta de {lugar} correm escuros, e nada bebe deles.'] },
    npc: { nome: { en: 'A sick shepherd', pt: 'Um pastor doente' }, olhar: { en: 'A shepherd, grey-faced, clutching a water skin.', pt: 'Um pastor de rosto cinzento, agarrado a um cantil.' }, antes: { en: 'He coughs:', pt: 'Ele tosse:' }, revela: { en: 'A sick man sits by the wall.', pt: 'Um homem doente está sentado junto à parede.' } },
    marca: { nome: { en: 'A dead goat', pt: 'Uma cabra morta' }, olhar: { en: 'A goat, dead by the water. Its eyes open as you look.', pt: 'Uma cabra morta junto à água. Os olhos dela se abrem quando vocês olham.' }, antes: { en: 'It does not move again. But you understand.', pt: 'Ela não se mexe mais. Mas vocês entendem.' }, revela: { en: 'A dead goat lies by a trickle of black water.', pt: 'Uma cabra morta jaz junto a um fio de água negra.' } } },
  rei: { chegada: { en: ['Cold air breathes out of {lugar}, as if something below were breathing.'], pt: ['Um ar frio sai de {lugar}, como se algo lá embaixo respirasse.'] },
    npc: { nome: { en: 'An old gravekeeper', pt: 'Um velho coveiro' }, olhar: { en: 'An old gravekeeper with a shovel and a lantern.', pt: 'Um velho coveiro com uma pá e uma lanterna.' }, antes: { en: 'His voice shakes:', pt: 'A voz dele treme:' }, revela: { en: 'An old man with a lantern waits here.', pt: 'Um velho com uma lanterna espera aqui.' } },
    marca: { nome: { en: 'A broken seal', pt: 'Um lacre quebrado' }, olhar: { en: 'A tomb seal, cracked from the inside.', pt: 'Um lacre de tumba, rachado por dentro.' }, antes: { en: 'The inscription around it is a warning.', pt: 'A inscrição em volta é um aviso.' }, revela: { en: 'A cracked tomb seal lies here.', pt: 'Um lacre de tumba rachado está aqui.' } } },
  refugio: { chegada: { en: ['Smoke still rises over {lugar}. Somewhere, someone is calling for help.'], pt: ['Ainda sobe fumaça sobre {lugar}. Em algum lugar, alguém pede ajuda.'] },
    npc: { nome: { en: 'A wounded militiaman', pt: 'Um miliciano ferido' }, olhar: { en: 'A militiaman with a broken spear, bleeding.', pt: 'Um miliciano com uma lança partida, sangrando.' }, antes: { en: 'He grips your arm:', pt: 'Ele agarra o braço de vocês:' }, revela: { en: 'A wounded militiaman leans on the wall.', pt: 'Um miliciano ferido se apoia na parede.' } },
    marca: { nome: { en: 'A child’s cry', pt: 'Um choro de criança' }, olhar: { en: 'A faint cry, somewhere in the rubble.', pt: 'Um choro fraco, em algum lugar nos escombros.' }, antes: { en: 'You follow the sound, and the ruins tell the rest.', pt: 'Vocês seguem o som, e as ruínas contam o resto.' }, revela: { en: 'A faint cry comes from the rubble.', pt: 'Um choro fraco vem dos escombros.' } } },
};
/* the storyteller of the first room (an NPC or a point of interest) and the text read at the start; null: no place for it
   (the premise's own opening then stays as the start text) */
/* takes object oi out of room si, keeping right what points into that room by index: a twin token, the triggers, the
   final mission (a token taken out of the start once shifted the twin of the exit's pair onto itself) */
function tirarObjeto(pm, si, oi) {
  pm.salas[si].objetos.splice(oi, 1);
  pm.salas[si].objetos.forEach(o => { if (o.gemeo == null) return; if (o.gemeo === oi) delete o.gemeo; else if (o.gemeo > oi) o.gemeo--; });
  const ajusta = g => { if (g.objSala === si && typeof g.objIndex === 'number' && g.objIndex > oi) g.objIndex--; };
  pm.salas.forEach(s => s.objetos.concat(s.grupoPool ? [s.grupoPool] : [], s.inimigos || []).forEach(o => todosGatilhos(o).forEach(ajusta)));
  (pm.contadores || []).forEach(c => todosGatilhos(c).forEach(ajusta)); (pm.eventos || []).forEach(e => (e.gatilhos || []).forEach(ajusta));
  const fm = pm.meta?.finalMission; if (fm && fm.sala === si && typeof fm.objeto === 'number' && fm.objeto > oi) fm.objeto--;
}
/* what the heroes must do, said after the story: the objective's summary, or, for the pieces that unlock, what the pieces of
   this story are ("Break the 3 black mirrors.") */
function conceitoDoTruque(plano) {
  if (!plano.truque) return ''; const R = plano.roupaTruque;
  if (plano.truque.id === 'selos' && R) { const n = plano.contadorFinal && (plano.contadorFinal.total || 0) || 3; return RT(n === 1 ? R.objetivo1 : R.objetivoN, plano.vocab, { n }) + '.'; }
  // (the captives of the story; the clock of the story is told in the start text)
  if (plano.truque.id === 'resgate' && plano.roupaResgate) { const C = plano.roupaResgate; const n = plano.resgateContador ? plano.resgateContador.total : 3; return RT(n === 1 ? C.objetivo1 : C.objetivoN, plano.vocab, { n }) + '. ' + L2('Then the way out opens at the start.', 'Depois, a saída se abre no início.'); }
  if (plano.truque.id === 'desabamento' && plano.roupaRelogio) return L2('Reach the way out in time.', 'Alcancem a saída a tempo.');
  return TXT(plano.truque.resumo);
}
function aberturaDoMapa(pm, plano, rng) {
  const a = ABERTURAS[plano.premissa.id]; const s = pm.salas[0]; if (!a || !s) return null;
  if (plano.truque?.id === 'escolta') return preencher(rng.pick(a.chegada[LP()] || a.chegada.en), plano.vocab);   // (the guide tells it: escoltaDoMapa)
  const v = plano.vocab; const historia = preencher(rng.pick(plano.premissa.intro[LP()] || plano.premissa.intro.en), v); plano.historiaInicial = historia;
  let querNpc = rng() < 0.5; if (plano.querNpc != null) querNpc = plano.querNpc;   // (drawn with the plan: the villain was weighed by it)
  let res = s.objetos.findIndex(o => o._reservado); let oi = null;
  // a point of interest fires as soon as a hero stands next to it: never next to where the heroes start
  const junto = o => casasDoObjeto(o).some(([x, y]) => (s.herois || []).some(h => Math.max(Math.abs(h[0] - x), Math.abs(h[1] - y)) <= 1));
  if (!querNpc) { for (let t = 0; t < 8 && oi == null; t++) { const k = colocarNaSala(pm, 0, 'SightToken', rng); if (k == null) break; if (junto(s.objetos[k])) s.objetos.splice(k, 1); else oi = k; }
    if (oi == null) querNpc = true;
    else if (res >= 0) { tirarObjeto(pm, 0, res); if (res < oi) oi--; res = -1; } }   // (the token set aside goes back to the box)
  if (querNpc) oi = res >= 0 ? res : colocarNaSala(pm, 0, 'InteractToken', rng);
  if (oi == null) return null;
  // who or what tells it: the person or the clue drawn with the plan (a skin of HISTORIAS.aberturas)
  const o = s.objetos[oi]; const npc = ehTipo(o, 'InteractToken'); const d = (npc ? plano.roupaNpc : plano.roupaPista) || (npc ? a.npc : a.marca);
  const conceito = conceitoDoTruque(plano) ? '\n\n' + conceitoDoTruque(plano) : '';
  o.name = T2(d.nome); o.textClick = T2(d.olhar); Object.defineProperty(o, '_narrador', { value: true, enumerable: false, configurable: true }); plano.narrador = npc ? 'npcs' : 'pistas';
  plano.roteiro = roteiroDe(plano);   // (the anchor is the opening actually told: with no room for the clue, the person)
  o.gatilhos = [gatilhoTexto(T2(d.antes) + (npc ? ' "' + historia + '"' : ' ' + historia) + conceito)].concat(npc ? [] : [autoRemocao()]);
  plano.conceitoDito = { texto: conceito, g: o.gatilhos[0] };
  apresentar(pm, 0, o, null, T2(d.revela));
  return preencher(rng.pick(a.chegada[LP()] || a.chegada.en), v);
}
/* a way out guarded by the last room: it works only once that room is open and its monsters are defeated (before, a way
   out at the start or in the last room ended the map without the fight) */
function guardarPeloFim(pm, plano, fim) {
  const sg = plano.saidaGuardada; if (!sg) return; const o = pm.salas[sg.sala]?.objetos[sg.oi]; const F = pm.salas[fim]; if (!o || !F) return;
  const temIni = (F.inimigos || []).length || F.grupoPool || F.objetos.some(x => todosGatilhos(x).some(y => y.tipo === 'spawn')); if (!temIni) return;
  const v = plano.vocab; const req = (sg.sala === fim ? [] : [{ tipo: 'room_open', sala: fim }]).concat([{ tipo: 'enemies_defeated', sala: fim }]);
  const g = gatilhoTexto(L2('The way is clear. Go!', 'O caminho está livre. Vão!'), req);
  (o.gatilhos || []).forEach(x => { x.requisitos = clone(req); });
  o.gatilhos = [g].concat(o.gatilhos || []);
  o['senao:' + g.uid] = [txtT('Not yet: ' + v.vilao + ' still stands in the way. Face the last room first.', 'Ainda não: ' + v.vilao + ' continua no caminho. Enfrentem antes a última sala.')];
  o.acaoExtra = { ...(o.acaoExtra || {}), ['senao:' + g.uid]: true };
  // the twin (the other point of the pair) stands for the same way out: the same guard (what it pays stays with the first)
  pm.salas[sg.sala].objetos.forEach(x => { if (x !== o && x.gemeo === sg.oi) { x.gatilhos = clone(o.gatilhos.filter(t => !(t.tipo === 'counter' && t.acao === 'use'))); } });
}
/* a detour promises and pays: its door says something waits behind it, and the room holds a reward (a chest) besides its
   guards (before, a side room could hold nothing at all) */
function desviosComPremio(pm, plano, rng, salasDe) {
  const PROMESSAS = [L2('Beyond this door, a glint of gold. And something breathing.', 'Atrás desta porta, um brilho de ouro. E algo respirando.'), L2('Scratched on the frame: "the stash is inside, mind the guards".', 'Riscado no batente: "o esconderijo está aí dentro, cuidado com os guardas".'), L2('The smell of oil and old coins seeps from beyond.', 'Um cheiro de óleo e moedas velhas vaza lá de dentro.')];
  salasDe.lado.forEach(si => { const s = pm.salas[si]; if (!s) return;
    const paga = o => todosGatilhos(o).some(g => g.tipo === 'give_item' && (g.modo === 'newitem' || (g.points || 0) >= 15));
    if (!s.objetos.some(paga)) {
      // a chest; with none left in the box, a stash (an interaction token)
      let oi = colocarNaSala(pm, si, 'Chest', rng); const bau = oi != null;
      if (!bau) oi = colocarNaSala(pm, si, 'InteractToken', rng);
      if (oi != null) { const o = s.objetos[oi]; o.gatilhos = [...(bau ? [] : [txtT('A loose stone hides a stash: someone meant to come back for it.', 'Uma pedra solta esconde um esconderijo: alguém pretendia voltar para buscá-lo.')]), itemNovo(), itemAoAcaso(20), ouroDe(20)];
        if (!bau) apresentar(pm, si, o, L2('One stone in the wall sits a little loose.', 'Uma pedra da parede está um pouco solta.'), L2('One stone in the wall sits a little loose.', 'Uma pedra da parede está um pouco solta.')); }
      // no piece left in the box: its guards carry the prize
      else if ((s.inimigos || []).length) { const gp = grupoPoolDe(s); gp.gatilhos = (gp.gatilhos || []).concat([txtT('The guards fall. What they guarded is yours.', 'Os guardas caem. O que eles guardavam é de vocês.'), itemNovo(), itemAoAcaso(20)]); }
      // no guards either: a thing of the room already there carries it (a key box, a crate…)
      else { const o = s.objetos.find(x => !x._narrador && !x.hidden && x.usos !== 'always' && !['Archway', 'BellFrame', 'Door', 'Gate'].includes(baseObj(x.type)) && !todosGatilhos(x).some(g => g.tipo === 'open_room'));
        if (o) o.gatilhos = (o.gatilhos || []).concat([itemNovo(), ouroDe(20)]);
        // (nothing at all in the room, the box spent: the ambush that fills it pays when it is over, or its opener does)
        else { const ab = abridorDe(pm, si); if (ab) { const rod = (ab.o.gatilhos || []).find(g => g.tipo === 'rounds'); const lista = rod && Array.isArray(ab.o['rodada:' + rod.uid]) ? ab.o['rodada:' + rod.uid] : (ab.o.gatilhos = ab.o.gatilhos || []);
          lista.push(txtT('In the far corner of that room, someone left a stash behind.', 'No canto daquela sala, alguém deixou um esconderijo para trás.'), itemNovo(), ouroDe(20)); } } } }
    const ab = abridorDe(pm, si); if (!ab) return; const t = baseObj(ab.o.type); const padrao = TEXTOS_OLHAR[t] ? TEXTOS_OLHAR[t].en.concat(TEXTOS_OLHAR[t].pt) : [];
    if (!ab.o.textClick || padrao.includes(ab.o.textClick)) ab.o.textClick = rng.pick(PROMESSAS); });
}
/* Easy: the respite before the last fight heals (a quiet corner to bind wounds, once): the simulation of the level found the
   party reaching the climax with half its health and nothing to mend it */
function descansoNoRespiro(pm, plano, rng, salasDe) {
  if (plano.dificuldade !== 'facil') return;
  salasDe.eixo.filter(si => pm.salas[si]?.funcao === 'respiro').forEach(si => { const s = pm.salas[si];
    if (s.objetos.some(o => /(cura|heals?) \d/i.test(JSON.stringify(o.gatilhos || [])))) return;
    const oi = colocarNaSala(pm, si, 'InteractToken', rng); if (oi == null) return; const o = s.objetos[oi];
    o.gatilhos = [txtT('You bind your wounds and catch your breath. Every hero heals 3.', 'Vocês cuidam dos ferimentos e recuperam o fôlego. Cada herói cura 3.')];
    apresentar(pm, si, o, L2('A dry, sheltered corner: a good place to bind wounds.', 'Um canto seco e abrigado: um bom lugar para cuidar dos ferimentos.'), L2('A sheltered corner here is good for binding wounds.', 'Um canto abrigado aqui é bom para cuidar dos ferimentos.')); });
}
/* spoils of a won fight: a room of the way whose monsters fall leaves something behind (materials, now and then an item) */
function espoliosDasLutas(pm, plano, rng, salasDe) {
  salasDe.eixo.forEach(si => { const s = pm.salas[si]; if (!s || !['tensao', 'confronto'].includes(s.funcao) || !(s.inimigos || []).some(e => ehPool(e.enemy))) return;
    const gp = grupoPoolDe(s); if ((gp.gatilhos || []).some(g => g.tipo === 'give_item')) return;
    gp.gatilhos = (gp.gatilhos || []).concat([txtT('Among the fallen: gear and materials worth keeping.', 'Entre os caídos: equipamento e materiais que valem a pena guardar.'), itemAoAcaso(s.funcao === 'confronto' ? 20 : 15)], s.funcao === 'confronto' && rng() < 0.5 ? [itemNovo()] : []); });
}
/* the rooms some monster reaches: its own, or spawned there by any trigger */
function salasComMonstros(pm) {
  const salaDaCasa = new Map(); pm.salas.forEach((s, si) => chaoDaSala(si, pm).forEach((c, k) => { if (!salaDaCasa.has(k)) salaDaCasa.set(k, si); }));
  const comMonstros = new Set(); pm.salas.forEach((s, si) => { if ((s.inimigos || []).length) comMonstros.add(si); });
  const donos = pm.salas.flatMap((s, si) => s.objetos.concat(s.grupoPool ? [s.grupoPool] : [], s.inimigos || []).map(o => [o, si])).concat((pm.contadores || []).map(c => [c, 0]), (pm.eventos || []).map(e => [e, e.sala || 0]));
  donos.forEach(([o, si]) => todosGatilhos(o).forEach(g => { if (g.tipo !== 'spawn') return; if (g.fonte === 'pool') (g.cells || []).forEach(c => comMonstros.add(salaDaCasa.get(c[0] + ',' + c[1]) ?? si)); else comMonstros.add(si); }));
  return comMonstros;
}
/* Easy: the monsters placed by hand (the leader, a champion, a pursuer, a rival, a traitor, the lives of a boss) grow with
   the party, as the balanced groups do: their tier for 1-2 heroes, one step up for 3, two for 4 (the game's "tier by the
   number of heroes"). Before, a party of four met the same leader as a party of two, and walked through the easy maps */
function lideresPorHerois(pm) {
  const escalar = e => { if (!e || ehPool(e.enemy) || e.tierPorHerois) return; const m = monstro(e.enemy); const ts = [...new Set((m?.tiers || []).map(t => t.tier))].sort((a, b) => a - b); if (!ts.length) return;
    const t = e.tier || ts[0]; const acima = k => ts.find(x => x >= t + k) ?? ts[ts.length - 1]; e.tierPorHerois = [t, t, acima(1), acima(2)]; };
  const todos = o => todosGatilhos(o).forEach(g => { if (g.tipo === 'spawn' && g.fonte === 'list') (g.inimigos || []).forEach(e => { escalar(e); todos(e); }); });
  pm.salas.forEach(s => { (s.inimigos || []).forEach(e => { escalar(e); todos(e); }); s.objetos.concat(s.grupoPool ? [s.grupoPool] : []).forEach(todos); });
  (pm.contadores || []).forEach(todos); (pm.eventos || []).forEach(ev => (ev.gatilhos || []).forEach(g => { if (g.tipo === 'spawn' && g.fonte === 'list') (g.inimigos || []).forEach(e => { escalar(e); todos(e); }); }));
}
/* Easy: at most n new items a map, free (what the merchant sells is bought); the rest becomes loot of the room (materials).
   The simulation of the level found up to eight items in a long map. The prizes of the last room built are kept first */
function poucosItens(pm, n) {
  const achados = []; const fim = pm.salas.length - 1;
  pm.salas.forEach((s, si) => s.objetos.concat(s.grupoPool ? [s.grupoPool] : [], s.inimigos || []).forEach(o => Object.keys(o).forEach(l => { if (!Array.isArray(o[l])) return;
    o[l].forEach((g, gi) => { if (g.tipo === 'give_item' && g.modo === 'newitem' && !(g.requisitos || []).some(r => r.tipo === 'gold')) achados.push({ lista: o[l], g, si }); }); })));
  (pm.contadores || []).forEach(c => todosGatilhos(c).forEach(g => { if (g.tipo === 'give_item' && g.modo === 'newitem') achados.push({ g, si: -1 }); }));
  const ordem = achados.slice().sort((a, b) => (b.si === fim) - (a.si === fim)); let ficam = 0;
  ordem.forEach(x => { if (ficam < n) { ficam++; return; } Object.assign(x.g, { modo: 'random', points: 15 }); delete x.g.amount; });
}
/* the background of every scene of the map: the place of the room it plays in (a crypt, a cave, the wilds…; after a change of
   place, the new one), in place of the default road. A background chosen by hand stays */
function fundosDasCenas(pm, plano) {
  const temaDe = {}; plano.batidas.forEach(b => { if (b.sala != null) temaDe[b.sala] = b.tema || plano.tema; });
  const fundo = si => FUNDO_DO_TEMA[temaDe[si] || plano.tema] ?? FUNDO_PADRAO;
  const ver = (lista, si) => (Array.isArray(lista) ? lista : []).forEach(g => { if (g && g.tipo === 'scene') (g.caixas || []).forEach(c => { if (c.background == null || c.background === FUNDO_PADRAO) c.background = fundo(si); }); });
  pm.salas.forEach((s, si) => { s.objetos.concat(s.inimigos || [], s.grupoPool ? [s.grupoPool] : []).forEach(o => Object.keys(o).forEach(k => ver(o[k], si))); });
}
/* what stays on the table once used: a thing of the room (a chest, a shelf, a body, a person) stays, and its tap tells what
   it is now (an open chest, a body already searched); an interaction token that was only a token (a test, a piece of a
   gimmick) leaves the table when spent (the mod takes it away: it has no text for afterwards) */
const GASTO_DO_TIPO = {
  Chest: ['An open chest, already emptied.', 'Um baú aberto, já vazio.'], Shelf: ['Shelves already ransacked.', 'Prateleiras já reviradas.'],
  Lectern: ['A lectern; its book has already been read.', 'Um púlpito; o livro já foi lido.'], StoneTable: ['A heavy stone table, already searched.', 'Uma pesada mesa de pedra, já examinada.'],
  RoundTable: ['A table, already searched.', 'Uma mesa, já examinada.'], Fire: ['A fire. You have already seen what it had to show.', 'Uma fogueira. Vocês já viram o que ela tinha a mostrar.'],
  Cauldron: ['A cauldron, already searched.', 'Um caldeirão, já examinado.'], Well: ['An old well. Nothing more comes up from it.', 'Um velho poço. Nada mais sobe dele.'],
  BloodShrine: ['A blood shrine, its power already spent.', 'Um santuário de sangue, com o poder já gasto.'], Barricade: ['A barricade of sharpened stakes, already dealt with.', 'Uma barricada de estacas afiadas, já resolvida.'],
  Statue: ['A statue, already examined.', 'Uma estátua, já examinada.'], Wagon: ['A wagon, already searched.', 'Uma carroça, já revistada.'],
  Tree: ['A tree, already searched.', 'Uma árvore, já examinada.'], DragonHead: ['A carved dragon head, already examined.', 'Uma cabeça de dragão entalhada, já examinada.'],
  Bell: ['A bell, already rung.', 'Um sino, já tocado.']
};
function restosDosObjetos(pm) {
  const fichas = new Map(FICHAS_INTERACAO.map(f => [T2(f.olhar), T2(f.gasto)]));
  const historias = new Set((HISTORIAS.fichas || []).filter(f => f.olhar).map(f => T2(f.olhar)));
  pm.salas.forEach(s => s.objetos.forEach(o => {
    if (o.textGasto || ehTerreno(o) || /^(Door|Gate|SightToken|Ladder|LadderMedium|Archway|BellFrame|Pillar.*)$/.test(baseObj(o.type))) return;
    if (ehTipo(o, 'InteractToken')) {
      // (a person or a thing of the story: it stays, and says what it is now; a test or a gimmick's piece goes)
      if (fichas.has(o.textClick)) o.textGasto = fichas.get(o.textClick);
      else if (historias.has(o.textClick)) o.textGasto = L2('Already searched. ', 'Já examinado. ') + o.textClick;
      else if (o.name && o.textClick) o.textGasto = o.textClick;
      return; }
    const g = GASTO_DO_TIPO[baseObj(o.type)]; o.textGasto = g ? L2(g[0], g[1]) : (o.textClick || '');
    if (!o.textGasto) delete o.textGasto;
  }));
}
/* a benefit against monsters where no monster ever is (a search that dazes "every monster in play" in a quiet room) was a
   benefit for nobody (the simulation of the easy level found them in most maps): in a room no monster ever reaches, such an
   outcome becomes a benefit for the heroes */
function efeitosSoComMonstros(pm) {
  const comMonstros = salasComMonstros(pm);
  const troca = L2(' Each hero may prepare 1 card.', ' Cada herói pode preparar 1 carta.');
  // (the respite counts as a room with none: what comes there, a noise or an alarm, may well never come)
  pm.salas.forEach((s, si) => { if (comMonstros.has(si) && s.funcao !== 'respiro') return;
    s.objetos.forEach(o => Object.keys(o).forEach(l => { const lista = o[l]; if (!Array.isArray(lista) || !lista.some(g => g.tipo === 'enemy_condition' && g.acao !== 'heal')) return;
      o[l] = lista.filter(g => !(g.tipo === 'enemy_condition' && g.acao !== 'heal'));
      const t = o[l].find(g => g.tipo === 'text'); if (t) t.text = t.text.replace(/\s*(Every monster|Each monster|Cada monstro)[^.]*\.(\s*\([^)]*\)\.?)?/g, '').trim() + troca; })); });
}
/* Act II: now and then a bell hangs over an archway of the floor (as in the maps of the game), at level 3: a bell of the
   box that takes no bell frame */
function sinosNosArcos(pm, plano, rng) {
  if (plano.atos !== 2 || !OBJETO.Bell || !daCaixa('Bell', 2)) return;
  // (a rare sight: in about one map in four, over one archway at most; its own draws)
  const rs = rngDe(plano.semente + '#sinos'); if (rs() > 0.25) return;
  const caixa = Math.min(naCaixaAte('Bell', 2), 1 + pm.salas.reduce((n, s) => n + s.objetos.filter(o => ehTipo(o, 'Bell')).length, 0)); let usados = pm.salas.reduce((n, s) => n + s.objetos.filter(o => ehTipo(o, 'Bell')).length, 0);
  pm.salas.forEach(s => s.objetos.slice().forEach(a => {
    if (usados >= caixa || !ehTipo(a, 'Archway') || (a.level || 0) !== 0 || rs() > 0.6) return;
    if (s.objetos.some(o => ehTipo(o, 'Bell') && o.pos[0] === a.pos[0] && o.pos[1] === a.pos[1])) return;
    s.objetos.push({ type: 'Bell', pos: a.pos.slice(), rot: a.rot || 0, level: 3, name: '', textClick: L2('A bronze bell hangs high over the archway.', 'Um sino de bronze pende no alto do arco.'), textUse: '', gatilhos: [], requisitos: [], senao: [] }); usados++; }));
}
/* where the heroes land after a point of no return: free spaces of the room at the very end (doors and objects set after
   the room was laid could stand on its first hero spaces) */
function chegadasLivres(pm, plano) {
  pm.salas.forEach((s, si) => s.objetos.forEach(o => Object.keys(o).forEach(l => { if (!Array.isArray(o[l])) return;
    o[l].forEach(g => { if (g.tipo !== 'move_heroes' || g._sala == null) return; const k = g._sala; delete g._sala;
      const livres = casasParaHerois(pm, k, 12); const boa = c => livres.some(x => x[0] === c[0] && x[1] === c[1]);
      const cs = (g.cells || []).filter(boa).concat(livres.filter(c => !(g.cells || []).some(x => x[0] === c[0] && x[1] === c[1]))).slice(0, 4);
      if (cs.length) g.cells = cs; }); })));
}
/* what a premise brings of its own (after the gimmick): the crates of the stolen cargo, the springs to purify, the survivors
   to carry to the sanctuary, the lieutenant's lead, the king who rises more than once */
function aplicarPremissa(pm, plano, rng, notas, salasDe, fim) {
  const p = plano.premissa; const meio = salasDe.eixo.slice(1, -1); const lados = salasDe.lado;
  const doFim = i => !plano.grupo || (plano.grupo[i] || 0) === (plano.grupo[fim] || 0);
  // (comFim: the last room holds one of the pieces, under the eyes of its monsters)
  const hosp = comFim => n => (comFim ? [fim] : []).concat(rng.embaralhar(lados), rng.embaralhar(meio), [0]).filter((x, i, a) => a.indexOf(x) === i && (comFim || x !== fim)).filter(doFim).slice(0, n);
  const vigiado = cont => { const s = pm.salas[fim]; if (!s) return; const guardas = s.inimigos?.length || s.grupoPool || s.objetos.some(x => todosGatilhos(x).some(y => y.tipo === 'spawn')); if (!guardas) return;
    s.objetos.forEach(o => { if (!todosGatilhos(o).some(g => g.tipo === 'counter' && g.contador === cont.nome)) return;
      const req = [{ tipo: 'enemies_defeated', sala: fim }]; const gs = (o.gatilhos || []).filter(g => !(g.requisitos || []).length); if (!gs.length) return;
      gs.forEach(g => { g.requisitos = clone(req); });
      o['senao:' + gs[0].uid] = [txtT('Not while they stand guard. Defeat the monsters of this room first.', 'Não enquanto eles montam guarda. Derrotem antes os monstros desta sala.')]; o.acaoExtra = { ...(o.acaoExtra || {}), ['senao:' + gs[0].uid]: true }; }); };
  // (fewer pieces than planned: the mission says how many, in the singular for one)
  const missao = (c, um, varios) => { if (c && c.missao) c.missao.texto = c.total === 1 ? um : varios(c.total); };
  switch (p.id) {
    case 'carga': {
      const c = coletor(pm, rng, notas, hosp(true), fim)('Crates', 'Caixotes', 3, ['InteractToken', 'Chest'], L2('A crate from the caravan, still sealed. You haul it out of the way of the raiders.', 'Um caixote da caravana, ainda lacrado. Vocês o tiram do alcance dos saqueadores.'), null, L2('Recover the 3 crates', 'Recuperem os 3 caixotes'), null,
        { todos: true, olhar: L2('A crate marked with the caravan’s colours.', 'Um caixote marcado com as cores da caravana.'), revela: L2('A crate of the stolen cargo lies here.', 'Um caixote da carga roubada está aqui.') });
      if ((pm.contadores || []).includes(c)) { plano.contadorFinal = c; vigiado(c); missao(c, L2('Recover the crate', 'Recuperem o caixote'), n => L2('Recover the ' + n + ' crates', 'Recuperem os ' + n + ' caixotes')); }
      break; }
    case 'pocos': {
      const c = coletor(pm, rng, notas, hosp(true), fim)('Springs', 'Fontes', 3, ['Well', 'Cauldron', 'InteractToken'], '', null, L2('Purify the 3 springs', 'Purifiquem as 3 fontes'), (o, cont) => {
        const t = testeNoObjeto(o, { stat: 'will', sucessos: 3, cumulativo: true, text: { en: 'Black water wells up here, cold and foul. Purify it.', pt: 'Água negra brota aqui, fria e podre. Purifiquem-na.' }, ok: { en: 'The water runs clear again.', pt: 'A água volta a correr limpa.' }, fail: { en: 'The black water fights back: the hero suffers 1 damage.', pt: 'A água negra resiste: o herói sofre 1 de dano.' } });
        o.gatilhos = [t]; o['ok:' + t.uid].push({ uid: uid(), tipo: 'counter', contador: cont.nome, acao: 'add', n: 1, texto: L2('Springs purified: [n] of [total].', 'Fontes purificadas: [n] de [total].'), requisitos: [] }); o.usos = 'always'; },
        { todos: true, olhar: L2('A spring of black water, bubbling.', 'Uma fonte de água negra, borbulhando.'), revela: L2('Black water bubbles up here.', 'Água negra borbulha aqui.') });
      if ((pm.contadores || []).includes(c)) { plano.contadorFinal = c; vigiado(c); missao(c, L2('Purify the spring', 'Purifiquem a fonte'), n => L2('Purify the ' + n + ' springs', 'Purifiquem as ' + n + ' fontes')); }
      break; }
    case 'refugio': {
      // the survivors (tokens in the rooms on the way): whoever finds one carries it; the sanctuary, in the last room, takes them in
      const nas = novoContadorMapa(pm, L2('Carried', 'Nas costas'), 3, ''); delete nas.missao; const peso = plano.dificuldade === 'facil' ? 1 : 2;   // (Easy: 1 fatigue a round)
      const c = coletor(pm, rng, notas, hosp(false), fim)('Saved', 'Salvos', 3, ['InteractToken'], '', null, L2('Carry the 3 survivors to the sanctuary', 'Levem os 3 sobreviventes ao santuário'), o => {
        o.textClick = L2('Someone lies in the rubble, too hurt to walk.', 'Alguém está caído nos escombros, ferido demais para andar.');
        o.gatilhos = [txtT('A survivor, alive but unable to walk. One hero carries the survivor from now on: that hero suffers ' + peso + ' fatigue at the start of every round, until the survivor is left at the sanctuary.', 'Um sobrevivente, vivo mas sem conseguir andar. Um herói passa a carregá-lo: esse herói sofre ' + peso + ' de fadiga no começo de cada rodada, até deixar o sobrevivente no santuário.'),
          { uid: uid(), tipo: 'counter', contador: nas.nome, acao: 'add', n: 1, texto: '', requisitos: [] }, { uid: uid(), tipo: 'remove_object', proprio: true, requisitos: [] }]; },
        { todos: true, olhar: L2('Someone lies in the rubble, too hurt to walk.', 'Alguém está caído nos escombros, ferido demais para andar.'), revela: L2('A survivor lies in the rubble here.', 'Um sobrevivente está caído nos escombros aqui.') });
      if (!(pm.contadores || []).includes(c)) { pm.contadores = pm.contadores.filter(x => x !== nas); break; }
      nas.total = c.total; missao(c, L2('Carry the survivor to the sanctuary', 'Levem o sobrevivente ao santuário'), n => L2('Carry the ' + n + ' survivors to the sanctuary', 'Levem os ' + n + ' sobreviventes ao santuário'));
      const oi = colocarNaSala(pm, fim, 'Lectern', rng, { name: L2('The sanctuary', 'O santuário') }) ?? colocarNaSala(pm, fim, 'InteractToken', rng, { name: L2('The sanctuary', 'O santuário') });
      if (oi == null) { notas.push(L2('No place for the sanctuary.', 'Sem lugar para o santuário.')); break; }
      const o = pm.salas[fim].objetos[oi]; const tem = [{ tipo: 'counter', contador: nas.nome, meta: 1 }];
      const q = { uid: uid(), tipo: 'choice', text: L2('The door of the old sanctuary. Is a hero carrying a survivor beside it?', 'A porta do velho santuário. Há um herói carregando um sobrevivente ao lado dela?'), options: [{ text: L2('Yes, leave the survivor here.', 'Sim, deixar o sobrevivente aqui.'), response: '' }, { text: L2('Not yet.', 'Ainda não.'), response: '' }], requisitos: [] };
      const deixa = gatilhoTexto(L2('Hands reach out from inside and pull the survivor to safety. The hero no longer carries anyone.', 'Mãos saem lá de dentro e puxam o sobrevivente para um lugar seguro. O herói não carrega mais ninguém.'), clone(tem));
      o.gatilhos = [q]; o.usos = 'always'; o.textClick = L2('The door of the old sanctuary.', 'A porta do velho santuário.');
      o['op0:' + q.uid] = [deixa, { uid: uid(), tipo: 'counter', contador: c.nome, acao: 'add', n: 1, texto: L2('Survivors saved: [n] of [total].', 'Sobreviventes salvos: [n] de [total].'), requisitos: clone(tem) }, { uid: uid(), tipo: 'counter', contador: nas.nome, acao: 'sub', n: 1, texto: '', requisitos: clone(tem) }];
      o['senao:' + deixa.uid] = [txtT('Nobody here is carrying a survivor.', 'Ninguém aqui carrega um sobrevivente.')];
      o['op1:' + q.uid] = []; o.acaoExtra = { ...(o.acaoExtra || {}), ['op1:' + q.uid]: true, ['senao:' + deixa.uid]: true };
      apresentar(pm, fim, o, null, L2('The door of the old sanctuary stands at the back.', 'A porta do velho santuário está no fundo.'));
      // the weight: said at the start of each round while someone carries a survivor
      pm.eventos = (pm.eventos || []).concat([{ uid: 'rf' + uid(), sala: 0, rodada: 2, cada: 1, gatilhos: [gatilhoTexto(L2('Each hero carrying a survivor suffers ' + peso + ' fatigue (for each survivor carried).', 'Cada herói que carrega um sobrevivente sofre ' + peso + ' de fadiga (por sobrevivente carregado).'), clone(tem))] }]);
      plano.contadorFinal = c;
      break; }
    case 'rei': plano.chefeTipo = 'vidas'; break;
  }
}
/* the lieutenant flees: once the last room opens, a few rounds (5 easy, 4 normal, 3 hard) before the escape; defeated, the
   count stops */
function tenenteFoge(pm, plano, fim) {
  const ab = abridorDe(pm, fim); if (!ab || !plano.chefe?.alvo) return false;
  const lista = Object.keys(ab.o).find(k => Array.isArray(ab.o[k]) && ab.o[k].includes(ab.g)); if (!lista) return false;
  const v = plano.vocab; const R = { facil: 5, normal: 4, dificil: 3 }[DIFICULDADE_TESTES.dif] || 4;
  const cont = novoContadorMapa(pm, L2('Lieutenant', 'Tenente'), 1, ''); delete cont.missao; const tem = () => [{ tipo: 'counter', contador: cont.nome, meta: 1 }];
  const req = () => clone(ab.g.requisitos || []);
  const aviso = { uid: uid(), tipo: 'rounds', modo: 'uma', n: Math.max(1, R - 1), vezes: 0, requisitos: req() };
  const fuga = { uid: uid(), tipo: 'rounds', modo: 'uma', n: R, vezes: 0, requisitos: req() };
  ab.o[lista].splice(ab.o[lista].indexOf(ab.g) + 1, 0, { uid: uid(), tipo: 'counter', contador: cont.nome, acao: 'add', n: 1, texto: '', requisitos: req() },
    gatilhoTexto(preencher({ en: '{vilao} runs for the far exit: in ' + R + ' rounds the lieutenant is gone, and the orders with it!', pt: '{vilao} corre para a saída do fundo: em ' + R + ' rodadas o tenente some, e as ordens com ele!' }, v), req()), aviso, fuga);
  ab.o['rodada:' + aviso.uid] = [gatilhoTexto(preencher({ en: '{vilao} is almost at the exit. Last round!', pt: '{vilao} está quase na saída. Última rodada!' }, v), tem())];
  ab.o['rodada:' + fuga.uid] = [gatilhoTexto(L2('Too late: the lieutenant escaped with the orders.', 'Tarde demais: o tenente escapou com as ordens.'), tem()), { uid: uid(), tipo: 'end_map', resultado: 'derrota', requisitos: tem() }];
  const e = plano.chefe.alvo; e.gatilhos = (e.gatilhos || []).concat([{ uid: uid(), tipo: 'counter', contador: cont.nome, acao: 'set', n: 0, texto: '', requisitos: [] }]);
  return true;
}
/* the war machine: a great thing in the last room, torn down by a cumulative test of might; every two rounds, once the room
   is open, it fires */
function maquinaNoFim(pm, plano, rng, notas, fim) {
  const nome = TXT(plano.premissa.alvo); const nomeC = nome.charAt(0).toUpperCase() + nome.slice(1);
  const oi = (daCaixa('Statue', plano.atos) ? colocarNaSala(pm, fim, 'Statue', rng, { name: nomeC }) : null) ?? colocarNaSala(pm, fim, 'StoneTable', rng, { name: nomeC }) ?? colocarNaSala(pm, fim, 'InteractToken', rng, { name: nomeC });
  if (oi == null) { notas.push(L2('No place for the engine.', 'Sem lugar para a máquina.')); return false; }
  const o = pm.salas[fim].objetos[oi]; const cont = novoContadorMapa(pm, L2('Engine', 'Máquina'), 1, L2('Destroy the engine', 'Destruam a máquina'));
  const t = testeNoObjeto(o, { stat: 'might', sucessos: 4, cumulativo: true, text: { en: 'Beams, ropes and iron: it will take more than one blow.', pt: 'Vigas, cordas e ferro: vai precisar de mais de um golpe.' }, ok: { en: 'The main beam splits with a crack like thunder.', pt: 'A viga mestra se parte com um estalo de trovão.' }, fail: { en: 'The engine shudders, but holds.', pt: 'A máquina estremece, mas aguenta.' } });
  o.gatilhos = [t]; o['ok:' + t.uid].push({ uid: uid(), tipo: 'counter', contador: cont.nome, acao: 'add', n: 1, texto: '', requisitos: [] }); o.usos = 'always';
  apresentar(pm, fim, o, L2('The siege engine, taller than a house.', 'A máquina de cerco, mais alta que uma casa.'), L2('The siege engine towers at the back of the room.', 'A máquina de cerco se ergue no fundo da sala.'));
  pm.eventos = (pm.eventos || []).concat([{ uid: 'mq' + uid(), sala: fim, rodada: 2, cada: 2, gatilhos: [gatilhoTexto(L2('The engine fires! Every hero in its room tests Agility; whoever fails suffers 2 damage.', 'A máquina dispara! Cada herói na sala dela faz um teste de agilidade; quem falhar sofre 2 de dano.'), [{ tipo: 'room_open', sala: fim }])] }]);
  pm.meta.finalMission = { tipo: 'trigger', uid: cont.missao.uid, texto: cont.missao.texto, rodadas: 8 };
  return true;
}
function finalDoMapa(pm, plano, rng, notas, fim, chefe) {
  const prem = plano.premissa; const v = plano.vocab;
  if (plano.finalFeito) return;
  if (prem.final === 'boss' || prem.final === 'exit' && !plano.finalFeito) { pm.meta.finalMission = { tipo: 'defeat_room', sala: fim, texto: L2('Defeat ' + (plano.rival || v.vilao), 'Derrotem ' + (plano.rival || v.vilao)), rodadas: 8 }; return; }
  if (prem.final === 'destroy' && maquinaNoFim(pm, plano, rng, notas, fim)) return;
  if (prem.final === 'relic') {
    const oi = colocarNaSala(pm, fim, rng() < 0.5 ? 'Lectern' : 'Chest', rng, { name: TXT(prem.alvo) });
    if (oi != null) { const o = pm.salas[fim].objetos[oi]; const g = gatilhoTexto(preencher(prem.fim, v), pm.salas[fim].inimigos?.length || (pm.salas[fim].objetos || []).some(x => todosGatilhos(x).some(y => y.tipo === 'spawn')) || pm.salas[fim].grupoPool ? [{ tipo: 'enemies_defeated', sala: fim }] : []); o.gatilhos = [g];
      // guarded: the prize is taken only once the room is clear (before, a hero could walk past the monsters and take it)
      if (g.requisitos.length) { o['senao:' + g.uid] = [txtT('Not while they stand guard. Defeat the monsters of this room first.', 'Não enquanto eles montam guarda. Derrotem antes os monstros desta sala.')]; o.acaoExtra = { ...(o.acaoExtra || {}), ['senao:' + g.uid]: true }; } apresentar(pm, fim, o, L2('Here rests ' + v.alvo + '.', 'Aqui repousa ' + v.alvo + '.'), L2('At the back of the room rests ' + v.alvo + '.', 'No fundo da sala repousa ' + v.alvo + '.')); pm.meta.finalMission = { tipo: 'use_object', sala: fim, objeto: oi, texto: L2('Take ' + v.alvo, 'Peguem ' + v.alvo), rodadas: 8 }; return; }
  }
  if (prem.final === 'counter') { const c = [plano.contadorFinal, ...(pm.contadores || [])].find(x => x && (pm.contadores || []).includes(x)); if (c && c.missao) { pm.meta.finalMission = { tipo: 'trigger', uid: c.missao.uid, texto: c.missao.texto, rodadas: 8 }; return; } }
  pm.meta.finalMission = { tipo: 'defeat_room', sala: fim, texto: L2('Defeat ' + v.vilao, 'Derrotem ' + v.vilao), rodadas: 8 };
}

/* the pressure of a map: something that pushes the heroes on instead of searching every corner at ease. Fatigue: from a
   round on, each round starts with 1 fatigue for every hero. Round limit: the map is lost past a round, with a warning two
   rounds before. Auto picks one for maps with no clock of their own (a collapse, a defence) */
function aplicarPressao(pm, plano, rng, o, notas) {
  const qual = o.pressao || 'auto'; if (qual === 'nenhuma') return;
  if (pm.meta.limite > 0 || plano.premissa.id === 'defesa' || plano.semPressa) return;   // already a clock (a collapse, a defence, a pursuer)
  const tipo = qual === 'auto' ? (rng() < 0.5 ? 'fadiga' : 'limite') : qual; const n = pm.salas.length;
  // why time is short: the clock of the story (a skin of HISTORIAS.relogio: smoke, the tide, the rite nearly done…)
  const R = plano.roupaRelogio; if (R) plano.relogioUsado = true;
  if (tipo === 'fadiga') {
    // (Easy: from where a normal round limit would end; the simulation of the level lost long easy maps to fatigue alone)
    const facil = plano.dificuldade === 'facil'; const desde = facil ? n * 2 + 4 : Math.max(4, n + 2); const vd = { ...plano.vocab, desde };
    pm.meta.pressao = { tipo, desde, texto: R ? RT(R.fadiga, vd) : L2('Time weighs on you: every hero suffers 1 fatigue.', 'O tempo pesa: cada herói sofre 1 de fadiga.') };
    pm.meta.intro += '\n\n' + (R ? RT(R.fadigaIntro, vd) : L2('Do not linger: from round ' + desde + ' on, every hero suffers 1 fatigue at the start of each round.', 'Não se demorem: a partir da rodada ' + desde + ', cada herói sofre 1 de fadiga no começo de cada rodada.'));
  } else {
    // (Easy: a limit with room to breathe: the simulation lost easy maps to the clock more than to the monsters)
    pm.meta.limite = plano.dificuldade === 'facil' ? n * 3 + 6 : n * 2 + 4; const vl = { ...plano.vocab, limite: pm.meta.limite };
    pm.meta.pressao = { tipo: 'limite', desde: pm.meta.limite - 2, texto: R ? RT(R.limiteAviso, vl) : L2('Only two rounds left!', 'Restam só duas rodadas!') };
    pm.meta.intro += '\n\n' + (R ? RT(R.limiteIntro, vl) : L2('Hurry: after round ' + pm.meta.limite + ' the map is lost.', 'Depressa: depois da rodada ' + pm.meta.limite + ', o mapa está perdido.'));
    if (pm.meta.finalMission && !/rodada|round/i.test(pm.meta.finalMission.texto || '')) pm.meta.finalMission.texto += /\b(antes|before)\b/i.test(pm.meta.finalMission.texto) ? L2(' (by round ' + pm.meta.limite + ')', ' (até a rodada ' + pm.meta.limite + ')') : L2(' before round ' + pm.meta.limite, ' antes da rodada ' + pm.meta.limite);
  }
  notas.push(L2('Pressure: ' + (tipo === 'fadiga' ? 'fatigue each round from round ' + pm.meta.pressao.desde : 'round limit ' + pm.meta.limite) + '.', 'Pressa: ' + (tipo === 'fadiga' ? 'fadiga a cada rodada a partir da rodada ' + pm.meta.pressao.desde : 'limite de ' + pm.meta.limite + ' rodadas') + '.'));
}
/* a map with a round limit counts down aloud: every round a line says how many are left, more urgent as the end comes
   (before, the limit was said once at the start and once two rounds before it) */
function contagemRegressiva(pm) { if (pm.meta.limite > 0) pm.meta.contagem = true; else delete pm.meta.contagem; }
/* the lines of the countdown for a limit of L rounds (made at export: the limit may have changed on Map setup) */
function linhasDaContagem(L) {
  if (!(L > 0)) return [];
  const calmas = [L2('Time is running: [n] rounds left.', 'O tempo corre: restam [n] rodadas.'), L2('Every round counts: [n] left.', 'Cada rodada conta: restam [n].'), L2('Keep moving: [n] rounds left.', 'Não parem: restam [n] rodadas.')];
  const linhas = [];
  for (let r = 2; r <= L; r++) { const n = L - r + 1;
    const t = n === 1 ? L2('Last round! Now or never.', 'Última rodada! Agora ou nunca.') : n === 2 ? L2('Only two rounds left!', 'Restam só duas rodadas!') : n <= 4 ? L2('Hurry! Only [n] rounds left.', 'Depressa! Restam só [n] rodadas.') : calmas[r % calmas.length];
    linhas.push({ rodada: r, texto: t.replace('[n]', n) }); }
  return linhas;
}
// ------------------------------------------------------------ modes: other ways to build a map
/* Studied from randomised dungeon crawlers (see LEIAME): Diablo's pool of side quests drawn per game and its shrines of
   mixed luck, the champion and its pack (Diablo II), a pursuer that pushes the heroes on, Hades' doors that announce what
   lies behind them (and a skull for the harder, richer room), a gauntlet with reinforcements from behind and Brogue's
   vaults (take one treasure of three). A mode goes on top of the premise; the classic mode is the map as before */
const MODALIDADES_MAPA = [
  { id: 'nenhuma', nome: { en: 'None', pt: 'Nenhuma' }, resumo: { en: 'No extra rule and no complications: only the premise and its objective.', pt: 'Sem regra extra e sem complicações: só a premissa e o objetivo.' }, lados: 0, semComplicacoes: true },
  { id: 'classica', nome: { en: 'Classic', pt: 'Clássica' }, resumo: { en: 'No extra rule, but one or two complications (keys, levers, waves). Drawn by Automatic only.', pt: 'Sem regra extra, mas com uma ou duas complicações (chaves, alavancas, ondas). Só sai no Automático.' }, lados: 0, soAuto: true },
  { id: 'cronica', nome: { en: 'Chronicle (side quests)', pt: 'Crônica (missões secundárias)' }, resumo: { en: 'As in Diablo, side quests drawn from a pool, a different set every map: a wounded wanderer, a cursed chest, a lost banner…', pt: 'Como em Diablo, missões secundárias sorteadas de um conjunto, diferentes a cada mapa: um andarilho ferido, um baú amaldiçoado, um estandarte perdido…' }, lados: 2 },
  { id: 'altares', nome: { en: 'Profane altars', pt: 'Altares profanos' }, resumo: { en: 'Altars with strange names, spread over the map: touching one may bless or curse, and nobody knows which before trying.', pt: 'Altares de nomes estranhos, espalhados pelo mapa: tocar um pode abençoar ou amaldiçoar, e ninguém sabe antes de tentar.' }, lados: 0 },
  { id: 'campeao', nome: { en: 'The champion and its pack', pt: 'O campeão e sua matilha' }, resumo: { en: 'A named champion with special traits leads a pack; without the pack it weakens, and it carries a prize.', pt: 'Um campeão com nome e traços especiais lidera uma matilha; sem a matilha ele enfraquece, e carrega um prêmio.' }, lados: 0 },
  { id: 'perseguidor', nome: { en: 'The pursuer', pt: 'O perseguidor' }, resumo: { en: 'After a few rounds, something relentless comes in behind the heroes and follows them; it heals every round.', pt: 'Depois de algumas rodadas, algo implacável entra atrás dos heróis e os segue; ele se cura a cada rodada.' }, lados: 0 },
  { id: 'encruzilhada', nome: { en: 'Crossroads (announced rewards)', pt: 'Encruzilhada (recompensas anunciadas)' }, resumo: { en: 'As in Hades, side doors announce what lies behind them; a skull marks a harder room with a double reward.', pt: 'Como em Hades, portas laterais anunciam o que há atrás delas; uma caveira marca uma sala mais dura com recompensa dobrada.' }, lados: 2 },
  { id: 'corredor', nome: { en: 'Gauntlet', pt: 'Corredor da morte' }, resumo: { en: 'Every door opened calls reinforcements from behind for two rounds: keep moving.', pt: 'Cada porta aberta chama reforços pela retaguarda por duas rodadas: não parem.' }, lados: 0 },
  { id: 'barulho', nome: { en: 'Noise', pt: 'Barulho' }, resumo: { en: 'Some rooms are noisy (gravel, bones, broken glass): every object used there adds to the noise, and at 3 something comes to see.', pt: 'Algumas salas são barulhentas (cascalho, ossos, cacos): cada objeto usado nelas soma barulho, e no 3 algo vem ver.' }, lados: 0 },
  { id: 'rivais', nome: { en: 'Rival raiders', pt: 'Saqueadores rivais' }, resumo: { en: 'Another band is after the same prize: they cross your way, and their leader waits in the last room as its boss.', pt: 'Outro bando quer o mesmo prêmio: eles cruzam o caminho de vocês, e o líder deles espera na última sala como chefe.' }, lados: 0 },
  { id: 'traidor', nome: { en: 'The traitor', pt: 'O traidor' }, resumo: { en: 'Someone on your side works for the enemy, and shows it at the worst moment: the guide of an escort, a freed captive, or else a sellsword hired on the way.', pt: 'Alguém do lado de vocês trabalha para o inimigo, e mostra isso na pior hora: o guia de uma escolta, um prisioneiro libertado, ou então uma espada de aluguel contratada no caminho.' }, lados: 0 },
  { id: 'mare', nome: { en: 'Rising tide', pt: 'Maré subindo' }, resumo: { en: 'Water on the floor of the rooms of the way; every few rounds the tide rises (whoever stands on water suffers), and the rooms behind go under.', pt: 'Água no chão das salas do caminho; a cada poucas rodadas a maré sobe (quem estiver na água sofre), e as salas de trás afundam.' }, lados: 0 },
  { id: 'aliado', nome: { en: 'Sellsword for hire', pt: 'Aliado de aluguel' }, resumo: { en: 'A sellsword met on the way fights beside the party, for gold.', pt: 'Uma espada de aluguel encontrada no caminho luta ao lado do grupo, por ouro.' }, lados: 0 },
  { id: 'mercador', nome: { en: 'Travelling merchant', pt: 'Mercador' }, resumo: { en: 'A merchant on the way sells an item or a healing draught, for gold.', pt: 'Um mercador no caminho vende um item ou um trago de cura, por ouro.' }, lados: 0 },
  { id: 'cofre', nome: { en: 'The sealed vault', pt: 'A câmara selada' }, resumo: { en: 'As in Brogue, a vault with three treasures: take one, and the others sink away. Its key is somewhere else.', pt: 'Como em Brogue, uma câmara com três tesouros: peguem um, e os outros afundam. A chave está em outro lugar.' }, lados: 1 }
];
const MODALIDADE = id => MODALIDADES_MAPA.find(m => m.id === id) || null;
const itemNovo = () => ({ uid: uid(), tipo: 'give_item', modo: 'newitem', amount: 1, requisitos: [] });
const itemAoAcaso = n => ({ uid: uid(), tipo: 'give_item', modo: 'random', points: n, requisitos: [] });
/* a group from the pool on free squares of room si, near where the heroes come in */
function servosNaSala(pm, si, rng, n, plano, delta = -1) {
  const s = pm.salas[si]; const casas = casasDeInimigos(s, si, entradaDaSala(si, pm), n, { distancia: [2, 7], padrao: 'fundo' }, rng, () => pm);
  return casas.length ? { uid: uid(), tipo: 'spawn', fonte: 'pool', cells: casas.map(c => [c.x, c.y, c.nivel]), inimigos: [], intensidade: Math.max(1, Math.min(10, plano.base + delta)), requisitos: [] } : null;
}
/* rooms for a mode's things: side rooms first, then the middle of the way (never the start or the last room), all on the
   table with the last room (past a point of no return, only the rooms ahead of it) and never behind a lock */
function salasDoModo(pm, plano, salasDe, fim, qualquerGrupo = false) {
  const g = i => (plano.grupo || pm._grupo || {})[i] || 0;
  const ok = i => i > 0 && i !== fim && (qualquerGrupo || g(i) === g(fim)) && !atrasDeTrava(pm, i);
  return salasDe.lado.filter(ok).concat(salasDe.eixo.filter(ok));
}
/* free squares of room si for new figures (never where a monster of the room already stands) */
function casasParaFiguras(pm, si, n, rng, regra = { distancia: [3, 8], padrao: 'fundo' }) {
  const s = pm.salas[si]; const tomadas = new Set((s.inimigos || []).map(e => e.pos[0] + ',' + e.pos[1]));
  return casasDeInimigos(s, si, entradaDaSala(si, pm), n + 8, regra, rng, () => pm).filter(c => !tomadas.has(c.x + ',' + c.y)).slice(0, n);
}
/* the monsters of a human band (for rivals and traitors): of the Workshop, the kinds of the bandits when there are some */
function humanosDaOficina(plano) { const of = daOficina(plano.atos).monstros; const h = of.filter(m => FACCOES_MAPA.bandidos.includes(m.tipo)); return h.length ? h : of; }
const tierMaxDe = m => Math.max(1, ...((m && m.tiers) || []).map(t => t.tier));
/* the tier of a leader (the boss of the last room, a champion, a pursuer, a rival or a traitor): its top tier, except on
   Easy, where it stands one step above the map's balanced groups (the simulation of the easy level: a tier-8 leader, 90 health
   and 8 of attack, ended a party of two in a round) */
function tierDoLider(m, plano) {
  const ts = [...new Set(((m && m.tiers) || []).map(t => t.tier))].sort((a, b) => a - b); if (!ts.length) return 1;
  if ((plano && plano.dificuldade) !== 'facil') return ts[ts.length - 1];
  const alvo = Math.min(4, 1 + Math.floor((plano.base || 3) / 3)) + 1; const cabem = ts.filter(t => t <= alvo);
  return cabem.length ? cabem[cabem.length - 1] : ts[0];
}
/* the noise: a few rooms full of gravel, bones and broken glass; every object used there adds 1 to the room's noise, and at
   3 something comes to see (once per room) */
function barulho(pm, plano, rng, salasDe, fim, dif) {
  const n = { facil: 1, normal: 2, dificil: 3 }[dif] || 2;
  const usaveis = si => pm.salas[si].objetos.filter(o => !o._narrador && !o.hidden && o.gemeo == null && o.usos !== 'always' && !['Archway', 'BellFrame'].includes(baseObj(o.type)));
  const cands = rng.embaralhar(salasDe.eixo.slice(1).concat(salasDe.lado).filter(si => si > 0 && usaveis(si).length >= 2)); const feitas = [];
  for (const si of cands.slice(0, n)) { const s = pm.salas[si];
    const cont = novoContadorMapa(pm, L2('Noise', 'Barulho') + ' ' + (si + 1), 3, ''); delete cont.missao;
    const objs = usaveis(si); objs.forEach(o => { o.gatilhos = (o.gatilhos || []).concat([{ uid: uid(), tipo: 'counter', contador: cont.nome, acao: 'add', n: 1, texto: L2('Noise: [n] of [total].', 'Barulho: [n] de [total].'), requisitos: [] }]); });
    // (the watch: a count on the first of them, armed from the start of the map, in the room's own context)
    const sp = servosNaSala(pm, si, rng, 2, plano, -2); const vigia = { uid: uid(), tipo: 'counter', acao: 'use', contador: cont.nome, n: 3, desde: 'inicio', requisitos: [] };
    objs[0].gatilhos.push(vigia); objs[0]['conta:' + vigia.uid] = [txtT('Too much noise! Something heard you, and comes to see.', 'Barulho demais! Algo ouviu vocês, e vem ver.')].concat(sp ? [sp] : []);
    s.textoDepois = ((s.textoDepois || '') + ' ' + L2('The floor here is covered in gravel, bones and broken glass: every object used in this room makes noise (at 3, something comes to see).', 'O chão aqui está coberto de cascalho, ossos e cacos: cada objeto usado nesta sala faz barulho (no 3, algo vem ver).')).trim();
    feitas.push(si); }
  return feitas;
}
/* the rival raiders: another band after the same prize crosses the way once or twice; its leader waits in the last room and
   is its boss there */
function rivais(pm, plano, rng, salasDe, fim, dif) {
  // (Easy: the humans that come in at a low tier; one whose first tier is 3 stood at 3 in the middle of an easy map)
  const todos = humanosDaOficina(plano); const baixos = todos.filter(m => Math.min(99, ...(m.tiers || []).map(t => t.tier)) <= 1);
  const pool = dif === 'facil' && baixos.length ? baixos : todos; if (!pool.length) return null;
  // the band of the story (a skin of HISTORIAS.regras.rivais)
  const B = plano.roupaRegra && plano.roupaRegra.bando ? plano.roupaRegra : null;
  const [bando, lider, ela] = B ? [TXT(B.bando), TXT(B.lider), !!B.ela] : rng.pick([[L2('the Crows', 'os Corvos'), L2('Varga the Grin', 'Varga Sorriso'), false], [L2('the Salt Dogs', 'os Cães de Sal'), L2('Mera One-Eye', 'Mera Caolha'), true], [L2('the Lantern Company', 'a Companhia da Lanterna'), L2('Doran Ironhand', 'Doran Mão de Ferro'), false]]);
  const Bando = B ? TXT(B.Bando) : bando.charAt(0).toUpperCase() + bando.slice(1); const v = plano.vocab; plano.rivalCai = B ? RT(B.cai, v) : null;
  const tier = m => Math.min(tierMaxDe(m), { facil: 1, normal: 2, dificil: 2 }[dif] || 2);
  const pondo = (si, figs) => { const s = pm.salas[si]; const cs = casasParaFiguras(pm, si, figs.length, rng); if (cs.length < figs.length) return null;
    const es = figs.map(([m, t, extra], i) => ({ enemy: m.id, pos: [cs[i].x, cs[i].y], tier: t, level: cs[i].nivel || 0, uid: uid(), gatilhos: [], senao: [], ...(extra || {}) })); s.inimigos = (s.inimigos || []).concat(es); return es; };
  // on the way: a room or two in the middle (never the first rooms nor the last)
  const n = dif === 'facil' ? 1 : 2; const meio = rng.embaralhar(salasDe.eixo.slice(2, -1).filter(si => si !== fim)); let vezes = 0;
  for (const si of meio) { if (vezes >= n) break; const a = rng.pick(pool), b = rng.pick(pool); if (!pondo(si, [[a, tier(a)], [b, tier(b)]])) continue;
    if (!vezes) { const ab = abridorDe(pm, si); const lista = ab && Object.keys(ab.o).find(x => Array.isArray(ab.o[x]) && ab.o[x].includes(ab.g));
      if (lista) ab.o[lista].splice(ab.o[lista].indexOf(ab.g) + 1, 0, gatilhoTexto(B ? RT(B.bolsa, v) : L2('In the scuffle, one of ' + bando + ' cuts your purse.', 'Na confusão, um d' + (/^a /.test(bando) ? 'a ' + bando.slice(2) : 'os ' + bando.replace(/^os /, '')) + ' corta a bolsa de vocês.'), clone(ab.g.requisitos || [])), { uid: uid(), tipo: 'give_item', acao: 'remove', modo: 'gold', amount: 15, requisitos: clone(ab.g.requisitos || []) }); }
    const s = pm.salas[si]; s.textoDepois = ((s.textoDepois || '') + ' ' + (vezes ? (B ? RT(B.denovo, v) : L2(Bando + ' again, angrier this time.', Bando + ' de novo, mais bravos desta vez.')) : (B ? RT(B.chegada, v) : L2('Rival raiders! ' + Bando + ' want ' + v.alvo + ' too, and do not mean to share.', 'Saqueadores rivais! ' + Bando + ' também querem ' + v.alvo + ', e não pretendem dividir.')))).trim(); vezes++; }
  // the leader, the boss of the last room (stronger, with a purse)
  const m = pool.slice().sort((x, y) => tierMaxDe(y) - tierMaxDe(x))[0];
  // (Easy: the leader alone in the last room)
  const es = pondo(fim, [[m, tierDoLider(m, plano), { bonusAtaque: 1, bonusDefesa: 1 }]].concat(dif === 'facil' ? [] : [[rng.pick(pool), tier(m)]]));
  if (!es) return vezes ? 'rivais' : null;
  plano.chefeFixo = es[0]; plano.rival = lider;
  const s = pm.salas[fim]; s.texto = B ? RT(B.fim, v) : L2(lider + ' and ' + bando + ' got here first, and ' + (ela ? 'she' : 'he') + ' does not mean to leave with empty hands.', lider + ' e ' + bando + ' chegaram antes, e ' + (ela ? 'ela' : 'ele') + ' não pretende sair de mãos vazias.');
  plano.introExtra = (plano.introExtra || []).concat([B ? RT(B.boato, v) : L2('Word is that ' + bando + ', a band of raiders led by ' + lider + ', are after ' + v.alvo + ' too.', 'Dizem que ' + bando + ', um bando de saqueadores liderado por ' + lider + ', também estão atrás de ' + v.alvo + '.')]);
  return 'rivais';
}
/* the traitor: with an escort, the guide works for the enemy and shows it at the last waystone (the prize is lost, and the
   guide waits in the last room beside the enemy); with a rescue, the last captive freed is a spy who runs for the way out
   and calls the guards; else, a sellsword hired on the way turns on the party when the last room opens */
function traidor(pm, plano, rng, salasDe, fim, dif) {
  const v = plano.vocab; const t = plano.truque?.id;
  if (t === 'escolta' && plano.escolta && (pm.contadores || []).includes(plano.escolta.marcos)) {
    const { X, ela, oi0, vivo, caido, marcos } = plano.escolta; const Ele = ela ? L2('She', 'Ela') : L2('He', 'Ele');
    const m = rng.pick(humanosDaOficina(plano)); const s = pm.salas[fim];
    const cs = m ? casasParaFiguras(pm, fim, 1, rng) : [];
    // a guide the enemy possesses (a child of the story, the most defenceless of them): a scene at the last waystone, then
    // what wears the guide waits in the last room; defeating it frees the guide
    const Pz = plano.roupaGuia && plano.roupaGuia.possessao;
    if (Pz) {
      const sombrios = daOficina(plano.atos).monstros.filter(x => ['Specter', 'Wight', 'Fae', 'Bloodsister', 'Doomcaller', 'Zealot'].includes(x.tipo) && (x.tiers || []).length);
      const mf = sombrios.length ? rng.pick(sombrios) : m; const cf = mf ? casasParaFiguras(pm, fim, 1, rng) : []; const vx = { ...v, X };
      const cx = (id, c, next) => ({ id, type: 'normal', speaker: c.quem || '', title: c.quem ? '' : X, text: RT(c, vx), cast: c.quem ? [] : ['@hero1', '@hero2'], background: FUNDO_PADRAO, next, options: [] });
      const caixas = Pz.cena.map((c, i) => cx('p' + (i + 1), c, i < Pz.cena.length - 1 ? 'p' + (i + 2) : ''));
      marcos.gatilhos = (marcos.gatilhos || []).concat([{ uid: uid(), tipo: 'scene', inicio: 'p1', requisitos: [], caixas }, txtT('Take ' + (ela ? 'her' : 'his') + ' token off the table.', 'Tirem a ficha ' + (ela ? 'dela' : 'dele') + ' da mesa.'),
        { uid: uid(), tipo: 'escort', acao: 'fim', requisitos: [] }, { uid: uid(), tipo: 'counter', contador: vivo.nome, acao: 'set', n: 0, texto: '', requisitos: [] }, { uid: uid(), tipo: 'counter', contador: caido.nome, acao: 'set', n: 0, texto: '', requisitos: [] },
        { uid: uid(), tipo: 'remove_object', objSala: 0, objIndex: oi0, requisitos: [] }]);
      if (cf.length) { const livre = RT(Pz.libertada, vx);
        s.inimigos = (s.inimigos || []).concat([{ enemy: mf.id, pos: [cf[0].x, cf[0].y], tier: tierDoLider(mf, plano), level: cf[0].nivel || 0, uid: uid(), bonusAtaque: 1, gatilhos: [txtT(livre, livre), ouroDe(20)], senao: [] }]);
        s.textoDepois = ((s.textoDepois || '') + ' ' + RT(Pz.sala, { ...vx, monstro: mf.nome || L2('this monster', 'este monstro') })).trim(); }
      return 'escolta-possessao';
    }
    const trai = plano.escolta.traicao;
    marcos.gatilhos = (marcos.gatilhos || []).concat([trai ? txtT(trai + ' Take ' + (ela ? 'her' : 'his') + ' token off the table.', trai + ' Tirem a ficha ' + (ela ? 'dela' : 'dele') + ' da mesa.') : txtT(X + ' steps away from you, without a scratch, and laughs quietly: "Thank you for bringing me this far. ' + v.vilao + ' will be pleased." ' + Ele + ' was working for the enemy all along, and runs into the dark ahead. Take ' + (ela ? 'her' : 'his') + ' token off the table.',
        X + ' se afasta de vocês, sem nenhum arranhão, e ri baixo: "Obrigad' + (ela ? 'a' : 'o') + ' por me trazerem até aqui. ' + v.vilao.charAt(0).toUpperCase() + v.vilao.slice(1) + ' vai ficar contente." ' + Ele + ' trabalhava para o inimigo desde o começo, e corre para a escuridão adiante. Tirem a ficha ' + (ela ? 'dela' : 'dele') + ' da mesa.'),
      { uid: uid(), tipo: 'escort', acao: 'fim', requisitos: [] }, { uid: uid(), tipo: 'counter', contador: vivo.nome, acao: 'set', n: 0, texto: '', requisitos: [] }, { uid: uid(), tipo: 'counter', contador: caido.nome, acao: 'set', n: 0, texto: '', requisitos: [] },
      { uid: uid(), tipo: 'remove_object', objSala: 0, objIndex: oi0, requisitos: [] }]);
    if (cs.length) { const e = { enemy: m.id, pos: [cs[0].x, cs[0].y], tier: tierDoLider(m, plano), level: cs[0].nivel || 0, uid: uid(), bonusAtaque: 1, gatilhos: [txtT(X + ' falls, and the betrayal with ' + (ela ? 'her' : 'him') + '.', X + ' cai, e a traição com ' + (ela ? 'ela' : 'ele') + '.'), ouroDe(30)], senao: [] }; s.inimigos = (s.inimigos || []).concat([e]);
      s.textoDepois = ((s.textoDepois || '') + ' ' + L2(X + ' is here, beside the enemy: the figure of ' + (m.nome || 'this monster') + ' is ' + X + '.', X + ' está aqui, ao lado do inimigo: a figura de ' + (m.nome || 'este monstro') + ' é ' + X + '.')).trim(); }
    return 'escolta';
  }
  const cont = plano.resgateContador;
  if ((t === 'resgate' || plano.premissa.id === 'resgate') && cont && (pm.contadores || []).includes(cont)) {
    const sp = servosNaSala(pm, 0, rng, 2, plano, 0);
    const R = plano.roupaResgate; const t = R && R.traidor ? RT(R.traidor, v) : null;
    cont.gatilhos = (cont.gatilhos || []).concat([t ? txtT(t, t) : txtT('The quietest of the captives you freed slips away and runs for the entrance, shouting: a spy of ' + v.vilao + '! Guards answer the call at the way out.', contrair('O mais quieto dos prisioneiros libertados escapa e corre para a entrada, gritando: um espião de ' + v.vilao + '! Guardas atendem o chamado na saída.'))].concat(sp ? [sp] : []));
    return 'resgate';
  }
  // (neither: a sellsword hired on the way, who turns when the last room opens)
  return aliadoDeAluguel(pm, plano, rng, salasDe, fim, dif, true);
}
/* the room of a character met on the way (a merchant, a sellsword): a calm room of the way (a respite, an exploration),
   never the start nor the last room; else any room of the way */
function salaCalma(pm, plano, rng, salasDe, fim) {
  const eixo = salasDe.eixo.filter(si => si > 0 && si !== fim); const funcao = si => pm.salas[si]?.funcao;
  const calmas = eixo.filter(si => ['respiro', 'exploracao'].includes(funcao(si)));
  return calmas.length ? rng.pick(calmas) : eixo.length ? eixo[0] : 0;
}
/* a character token (a merchant, a sellsword) in a calm room of the way, kept out of the other features (noise, gimmick
   pieces). With no token left in the box, a search token of those rooms becomes the character */
function personagemNoCaminho(pm, plano, rng, salasDe, fim, nome) {
  const primeira = salaCalma(pm, plano, rng, salasDe, fim);
  const salas = [primeira].concat(rng.embaralhar(salasDe.eixo.filter(si => si > 0 && si !== fim && si !== primeira)), [0]).filter((x, i, a) => a.indexOf(x) === i);
  const marcar = (si, oi) => { const o = pm.salas[si].objetos[oi]; Object.defineProperty(o, '_narrador', { value: true, enumerable: false, configurable: true }); return { si, oi, o }; };
  for (const si of salas) { const oi = colocarNaSala(pm, si, 'InteractToken', rng, { name: nome }); if (oi != null) return marcar(si, oi); }
  for (const si of salas) { const s = pm.salas[si];
    const oi = s.objetos.findIndex(o => ehTipo(o, 'InteractToken') && !o._narrador && !o.hidden && !todosGatilhos(o).some(g => ['counter', 'spawn', 'rounds', 'open_room', 'escort'].includes(g.tipo)));
    if (oi < 0) continue; const o = s.objetos[oi];
    Object.keys(o).forEach(k => { if (k.includes(':') && Array.isArray(o[k])) delete o[k]; }); o.gatilhos = []; delete o.acaoExtra; o.name = nome;
    return marcar(si, oi); }
  return null;
}
/* the travelling merchant: an item, or a healing draught for everyone, for gold; the party may come back as often as it likes */
function mercador(pm, plano, rng, salasDe, fim, dif) {
  // the merchant of the story (a skin of HISTORIAS.regras.mercador)
  const M = plano.roupaRegra && plano.roupaRegra.trago ? plano.roupaRegra : null; const nome = M ? TXT(M.nome) : rng.pick([L2('Pell the pedlar', 'Pell, o mascate'), L2('Mother Oda, trader', 'Mãe Oda, mercadora'), L2('A travelling merchant', 'Um mercador ambulante')]);
  const vx = { ...plano.vocab, X: nome };
  const p = personagemNoCaminho(pm, plano, rng, salasDe, fim, nome); if (!p) return null; const o = p.o, si = p.si;
  const caro = { facil: 25, normal: 30, dificil: 40 }[dif] || 30, barato = { facil: 15, normal: 20, dificil: 25 }[dif] || 20;
  const q = { uid: uid(), tipo: 'choice', text: M ? L2(nome + ' opens a pack full of odds and ends: ', nome + ' abre uma trouxa cheia de miudezas: ') + RT(M.abre, vx) : L2(nome + ' opens a pack full of odds and ends: "Everything has a price down here."', nome + ' abre uma trouxa cheia de miudezas: "Tudo tem preço aqui embaixo."'), options: [
    { text: L2('Buy an item (' + caro + ' gold)', 'Comprar um item (' + caro + ' de ouro)'), response: '' }, { text: L2('Buy a draught for everyone: each hero heals 3 (' + barato + ' gold)', 'Comprar um trago para todos: cada herói cura 3 (' + barato + ' de ouro)'), response: '' }, { text: L2('Nothing, thanks.', 'Nada, obrigado.'), response: '' }], requisitos: [] };
  const tem = n => [{ tipo: 'gold', amount: n }]; const semOuro = M ? RT(M.semOuro, vx) : L2('"No gold, no deal," ' + nome + ' says, closing the pack.', '"Sem ouro, sem negócio", diz ' + nome + ', fechando a trouxa.');
  // (the price goes last: each step asks for the gold again, and it is still there until the price is paid)
  const a0 = gatilhoTexto(L2('A deal.', 'Negócio fechado.'), tem(caro));
  o['op0:' + q.uid] = [a0, { ...itemNovo(), requisitos: tem(caro) }, { uid: uid(), tipo: 'give_item', acao: 'remove', modo: 'gold', amount: caro, requisitos: tem(caro) }];
  const a1 = gatilhoTexto(M ? RT(M.trago, vx) : L2('Bitter, but it works. Every hero heals 3.', 'Amargo, mas funciona. Cada herói cura 3.'), tem(barato));
  o['op1:' + q.uid] = [a1, { uid: uid(), tipo: 'give_item', acao: 'remove', modo: 'gold', amount: barato, requisitos: tem(barato) }];
  o['senao:' + a0.uid] = [txtT(semOuro, semOuro)]; o['senao:' + a1.uid] = [txtT(semOuro, semOuro)];
  o['op2:' + q.uid] = []; o.acaoExtra = { ...(o.acaoExtra || {}), ['op2:' + q.uid]: true, ['senao:' + a0.uid]: true, ['senao:' + a1.uid]: true };
  o.gatilhos = [q]; o.usos = 'always'; o.textClick = M ? RT(M.olhar, vx) : L2(nome + ', with a pack of wares.', nome + ', com uma trouxa de mercadorias.');
  apresentar(pm, si, o, null, M ? RT(M.revela, vx) : L2(nome + ' has set out a few wares here.', nome + ' espalhou algumas mercadorias aqui.'));
  return 'mercador';
}
/* the sellsword: hired for gold in a calm room, fights beside the party (played as the escort's guide: 6 health kept by
   the table, a defence die, moves or strikes when a hero performs a maneuver; the monsters may go for it). As the traitor,
   it turns on the party when the last room opens */
const ALIADOS = [{ nome: { en: 'Brann the Sellsword', pt: 'Brann, o Mercenário' }, ela: false }, { nome: { en: 'Kessa of the Nine Blades', pt: 'Kessa das Nove Lâminas' }, ela: true }, { nome: { en: 'Old Horik', pt: 'Velho Horik' }, ela: false }];
function aliadoDeAluguel(pm, plano, rng, salasDe, fim, dif, trai) {
  if (plano.truque?.id === 'escolta') return null;   // (one figure followed by the monsters at a time)
  // the sellsword of the story (a skin of HISTORIAS.regras.aliado)
  const A = plano.roupaRegra && plano.roupaRegra.contrato ? plano.roupaRegra : null; const a = A || rng.pick(ALIADOS); const X = TXT(a.nome); const ela = !!a.ela;
  const ele = ela ? L2('she', 'ela') : L2('he', 'ele'), dele = ela ? L2('her', 'dela') : L2('his', 'dele'), o_a = ela ? L2('her', 'a') : L2('him', 'o'); const Ele = ele.charAt(0).toUpperCase() + ele.slice(1);
  const p = personagemNoCaminho(pm, plano, rng, salasDe, fim, X); if (!p) return null; const npc = p.o, si = p.si;
  const preco = { facil: 20, normal: 25, dificil: 35 }[dif] || 25; const dado = T2(rng.pick(DADOS_DEFESA));
  const cont = novoContadorMapa(pm, L2('Ally', 'Aliado'), 1, ''); delete cont.missao; const tem = () => [{ tipo: 'counter', contador: cont.nome, meta: 1 }];
  const regras = L2(X + ' fights beside you. ' + Ele + ' has 6 health: keep it beside ' + dele + ' token with any tokens you like. Attacked, ' + ele + ' rolls the ' + dado + ' defense die; each success prevents 1 damage. When a hero performs a maneuver, ' + X + ' may move up to 3 spaces or strike an adjacent monster for 2 damage. The monsters may choose ' + o_a + ' as their target (the activation window shows it). If ' + ele + ' falls, tap ' + dele + ' token.',
    X + ' luta ao lado de vocês. ' + Ele + ' tem 6 de vida: marquem ao lado da ficha ' + dele + ', com as fichas que quiserem. Quando atacad' + (ela ? 'a' : 'o') + ', ' + ele + ' rola o dado de defesa ' + dado + ', e cada sucesso evita 1 de dano. Quando um herói fizer uma manobra, ' + X + ' pode se mover até 3 casas ou golpear um monstro adjacente, causando 2 de dano. Os monstros podem escolhê-l' + (ela ? 'a' : 'o') + ' como alvo (a janela de ativação mostra). Se ' + ele + ' cair, toquem na ficha ' + dele + '.');
  const status = { uid: uid(), tipo: 'choice', text: L2(X + ' is with you.', X + ' está com vocês.'), options: [{ text: L2(Ele + ' fell (6 damage).', Ele + ' caiu (6 de dano).'), response: '' }, { text: L2(Ele + ' is still standing.', Ele + ' continua de pé.'), response: '' }], requisitos: tem() };
  const vx = { ...plano.vocab, X, preco };
  const contrato = { uid: uid(), tipo: 'choice', text: A ? X + ', ' + TXT(A.quem) + ': ' + RT(A.contrato, vx) : L2(X + ', a sellsword, leans on a notched blade: "' + preco + ' gold, and my blade is yours until we are out of this place."', X + ', uma espada de aluguel, apoia-se numa lâmina lascada: "' + preco + ' de ouro, e minha espada é de vocês até sairmos deste lugar."'), options: [{ text: L2('Hire ' + o_a + ' (' + preco + ' gold)', 'Contratar (' + preco + ' de ouro)'), response: '' }, { text: L2('Go on without help.', 'Seguir sem ajuda.'), response: '' }], requisitos: [] };
  const aceita = gatilhoTexto(regras, [{ tipo: 'gold', amount: preco }]);
  npc.gatilhos = [status]; npc.usos = 'always'; npc.textClick = A ? X + ', ' + TXT(A.quem) + L2(', waiting for work.', ', à espera de trabalho.') : L2('A sellsword, waiting for work.', 'Uma espada de aluguel, à espera de trabalho.');
  npc['senao:' + status.uid] = [contrato];
  npc['op0:' + contrato.uid] = [aceita, { uid: uid(), tipo: 'counter', contador: cont.nome, acao: 'add', n: 1, texto: '', requisitos: [{ tipo: 'gold', amount: preco }] }, { uid: uid(), tipo: 'escort', acao: 'inicio', nome: X, chance: 20, cacadores: [], requisitos: [{ tipo: 'gold', amount: preco }] }, { uid: uid(), tipo: 'give_item', acao: 'remove', modo: 'gold', amount: preco, requisitos: [{ tipo: 'gold', amount: preco }] }];
  npc['senao:' + aceita.uid] = [A ? txtT(RT(A.recusa, vx), RT(A.recusa, vx)) : txtT('"Come back when your purse is heavier."', '"Voltem quando a bolsa estiver mais pesada."')];
  npc['op1:' + contrato.uid] = []; npc['op0:' + status.uid] = [txtT(X + ' falls. Take ' + dele + ' token off the table.', X + ' cai. Tirem a ficha ' + dele + ' da mesa.'), { uid: uid(), tipo: 'escort', acao: 'fim', requisitos: [] }, { uid: uid(), tipo: 'counter', contador: cont.nome, acao: 'set', n: 0, texto: '', requisitos: [] }, { uid: uid(), tipo: 'remove_object', proprio: true, requisitos: [] }];
  npc['op1:' + status.uid] = [];
  npc.acaoExtra = { ...(npc.acaoExtra || {}), ['op1:' + contrato.uid]: true, ['op1:' + status.uid]: true, ['senao:' + aceita.uid]: true };
  apresentar(pm, si, npc, null, A ? X + ', ' + TXT(A.quem) + L2(', waits here for work.', ', espera trabalho aqui.') : L2('A sellsword waits here for work.', 'Uma espada de aluguel espera trabalho aqui.'));
  if (!trai) return 'aliado';
  // the betrayal: when the last room opens, with the sellsword still in the party
  const ab = abridorDe(pm, fim); const lista = ab && Object.keys(ab.o).find(k => Array.isArray(ab.o[k]) && ab.o[k].includes(ab.g)); if (!lista) return 'aliado';
  const req = () => clone(ab.g.requisitos || []).concat(tem()); const m = rng.pick(humanosDaOficina(plano)); const cs = m ? casasParaFiguras(pm, fim, 1, rng, { distancia: [2, 4], padrao: 'aleatorio' }) : [];
  const e = cs.length ? { enemy: m.id, pos: [cs[0].x, cs[0].y], tier: tierDoLider(m, plano), level: cs[0].nivel || 0, uid: uid(), bonusAtaque: 1, gatilhos: [txtT(X + ' falls, and the betrayal with ' + o_a + '.', X + ' cai, e a traição com ' + (ela ? 'ela' : 'ele') + '.')], senao: [] } : null;
  ab.o[lista].splice(ab.o[lista].indexOf(ab.g) + 1, 0, ...[gatilhoTexto(L2(X + ' steps back and draws on you: ' + (A ? RT(A.traicao, vx) : '"' + preencher('{vilao} paid better.', plano.vocab) + '"') + ' Take ' + dele + ' token off the table' + (e ? ': the figure of ' + (m.nome || 'this monster') + ' in this room is ' + X + '.' : '.'), X + ' recua e se volta contra vocês: ' + (A ? RT(A.traicao, vx) : '"' + preencher('{vilao} pagou melhor.', plano.vocab) + '"') + ' Tirem a ficha ' + dele + ' da mesa' + (e ? ': a figura de ' + (m.nome || 'este monstro') + ' nesta sala é ' + X + '.' : '.')), req()),
    { uid: uid(), tipo: 'escort', acao: 'fim', requisitos: req() }, { uid: uid(), tipo: 'remove_object', objSala: si, objIndex: p.oi, requisitos: req() }].concat(e ? [{ uid: uid(), tipo: 'spawn', fonte: 'list', inimigos: [e], cells: [], requisitos: req() }] : []));
  return 'aliado-traidor';
}
/* the rising tide: water (underlays) on the floor of the rooms of the way (laid by the rooms themselves); every two rounds
   the tide rises (whoever stands on water suffers fatigue), and behind the party the rooms go under */
function mare(pm, plano, rng, salasDe, fim, dif) {
  const agua = si => (pm.salas[si]?.pecas || []).some(q => /underlay-(water|fetidwater)/.test(q.tile));
  const molhadas = pm.salas.map((s, i) => i).filter(agua);
  molhadas.forEach(si => { const s = pm.salas[si]; s.textoDepois = ((s.textoDepois || '') + ' ' + L2('The tide already covers part of the floor here.', 'A água da maré já cobre parte do chão aqui.')).trim(); });
  const cada = dif === 'facil' ? 3 : 2; const pena = dif === 'dificil' ? L2('1 damage', '1 de dano') : L2('1 fatigue', '1 de fadiga');
  pm.eventos = (pm.eventos || []).concat([{ uid: 'mr' + uid(), sala: 0, rodada: 3, cada, gatilhos: [txtT('The tide rises. Every hero standing on water suffers ' + pena + '.', 'A maré sobe. Cada herói numa casa de água sofre ' + pena + '.')] }]);
  let n = 0;
  salasDe.eixo.slice(2).forEach((si, k) => { if (k % 2) return; const ab = abridorDe(pm, si); const lista = ab && Object.keys(ab.o).find(x => Array.isArray(ab.o[x]) && ab.o[x].includes(ab.g)); if (!lista) return;
    ab.o[lista].splice(ab.o[lista].indexOf(ab.g) + 1, 0, gatilhoTexto(L2('Behind you, the water swallows the rooms you came through. Whoever stays back there suffers 1 damage at the start of each round.', 'Atrás de vocês, a água engole as salas por onde passaram. Quem ficar lá atrás sofre 1 de dano no começo de cada rodada.'), clone(ab.g.requisitos || []))); n++; });
  plano.introExtra = (plano.introExtra || []).concat([L2('The tide is coming into ' + plano.vocab.lugar + ', and it will not wait for you: from round 3, every ' + cada + ' rounds, it rises. Do not stand on water, and do not look back.', 'A maré está entrando em ' + plano.vocab.lugar + ', e não vai esperar por vocês: a partir da rodada 3, a cada ' + cada + ' rodadas, ela sobe. Não fiquem sobre a água, e não olhem para trás.')]);
  plano.semPressa = true;
  return ['mare', molhadas.length, n];
}
function aplicarModalidade(pm, plano, rng, notas, salasDe, fim, fase = 'depois') {
  const m = plano.modalidade; if (!m || m.id === 'classica' || m.id === 'nenhuma') return;
  // the vault goes in before the complications (they then leave its key and its door alone); the rest after them
  if ((m.id === 'cofre') !== (fase === 'antes')) return;
  const v = plano.vocab; const dif = plano.dificuldade || 'normal'; const salas = salasDoModo(pm, plano, salasDe, fim, m.id === 'cronica' || m.id === 'altares');
  const livres = rng.embaralhar(salas.slice()); const proxima = () => livres.shift();
  const feito = [];
  if (m.id === 'cronica') {
    // the pool: one quest of each group is drawn, as Diablo draws one quest of each group per game
    const grupos = rng.embaralhar([['andarilho', 'prisioneiro'], ['bau', 'altar'], ['estandarte', 'fonte']]);
    const n = { facil: 1, normal: 2, dificil: 3 }[dif] || 2;
    const usadas = new Set();
    for (const gr of grupos) { if (feito.length >= n) break;
      // one quest of the group (the other, when the first finds no room); each in a room of its own when there are rooms enough
      for (const q of rng.embaralhar(gr.slice())) { const ordem = salas.filter(i => !usadas.has(i)).concat(salas.filter(i => usadas.has(i)));
        const si = ordem.find(i => missaoSecundaria(pm, plano, rng, i, q, ordem.filter(j => j !== i), v)); if (si !== undefined) { usadas.add(si); feito.push(q); break; } } }
  } else if (m.id === 'altares') {
    // (the goat's altar draws from all; the others' names come from the stories too)
    const nomes = [[L2('The Goat Altar', 'O Altar da Cabra'), 1]].concat(rng.embaralhar([[L2('The Whispering Altar', 'O Altar Sussurrante'), 0], [L2('The Cracked Altar', 'O Altar Rachado'), 0]].concat(HIST('regras.altares').map(x => [TXT(x), 0]))).slice(0, 5)); const cabraAntes = rng() < 0.5; if (!cabraAntes) nomes.push(nomes.shift());
    const n = Math.min(3 + (dif === 'dificil' ? 1 : 0), salas.length);
    for (let k = 0; k < n; k++) { const si = salas[k % salas.length] ?? proxima(); if (si === undefined) break;
      const tipo = OBJETO.BloodShrine && daCaixa('BloodShrine', plano.atos) ? 'BloodShrine' : 'Lectern';
      const oi = colocarNaSala(pm, si, tipo, rng) ?? colocarNaSala(pm, si, 'InteractToken', rng); if (oi == null) continue;
      const o = pm.salas[si].objetos[oi]; const [nome, cabra] = nomes[k % nomes.length];
      altar(o, nome, cabra, dif, rng, pm, si, plano); apresentar(pm, si, o, L2('An old altar. Nobody knows what it gives, or what it takes.', 'Um altar antigo. Ninguém sabe o que ele dá, nem o que cobra.'), L2('Here stands ' + nome + '.', 'Aqui está ' + nome + '.')); feito.push(nome); }
  } else if (m.id === 'campeao') {
    const cand = salasDe.eixo.filter(i => i > 0 && i !== fim && (pm.salas[i].inimigos || []).some(e => ehPool(e.enemy)));
    const si = cand.length ? cand[cand.length - 1] : null;
    if (si != null) { const r = campeao(pm, plano, rng, si, dif); if (r) feito.push(r); }
  } else if (m.id === 'barulho') {
    feito.push(...barulho(pm, plano, rng, salasDe, fim, dif));
  } else if (m.id === 'rivais') {
    const r = rivais(pm, plano, rng, salasDe, fim, dif); if (r) feito.push(r);
  } else if (m.id === 'traidor') {
    const r = traidor(pm, plano, rng, salasDe, fim, dif); if (r) feito.push(r); else notas.push(L2('No place for the traitor.', 'Sem lugar para o traidor.'));
  } else if (m.id === 'mare') {
    feito.push(...mare(pm, plano, rng, salasDe, fim, dif));
  } else if (m.id === 'aliado') {
    const r = aliadoDeAluguel(pm, plano, rng, salasDe, fim, dif, false); if (r) feito.push(r); else notas.push(plano.truque?.id === 'escolta' ? L2('No sellsword: the escort already has a figure the monsters follow.', 'Sem aliado de aluguel: a escolta já tem uma figura que os monstros seguem.') : L2('No place for the sellsword.', 'Sem lugar para o aliado de aluguel.'));
  } else if (m.id === 'mercador') {
    const r = mercador(pm, plano, rng, salasDe, fim, dif); if (r) feito.push(r); else notas.push(L2('No place for the merchant.', 'Sem lugar para o mercador.'));
  } else if (m.id === 'perseguidor') {
    const r = perseguidor(pm, plano, rng, dif); if (r) feito.push(r);
  } else if (m.id === 'encruzilhada') {
    salasDe.lado.forEach((si, k) => { const ab = abridorDe(pm, si); if (!ab || (travasDe(ab.o, ab.g) || []).length) return;
      const caveira = rng() < ({ facil: 0.25, normal: 0.4, dificil: 0.55 }[dif] || 0.4);
      const premio = rng.pick(['ouro', 'item', 'cura', 'pista']); anunciarSala(pm, plano, rng, si, ab, premio, caveira, v); feito.push(premio + (caveira ? '+caveira' : '')); });
  } else if (m.id === 'corredor') {
    salasDe.eixo.slice(1).forEach(si => { const ab = abridorDe(pm, si); if (!ab || (plano.pontos || []).includes(si)) return; const spawn = servosNaSala(pm, ab.ri, rng, 2, plano, -2); if (!spawn) return;
      const g = { uid: uid(), tipo: 'rounds', modo: 'cada', n: 1, vezes: dif === 'facil' ? 1 : 2, requisitos: clone((ab.g.requisitos || [])) };
      ab.o.gatilhos = (ab.o.gatilhos || []).concat([g]); ab.o['rodada:' + g.uid] = [txtT('Reinforcements from behind! Keep moving.', 'Reforços pela retaguarda! Avancem.'), spawn]; feito.push(si); });
    if (feito.length) plano.introExtra = (plano.introExtra || []).concat([L2('Every door you open wakes the halls behind you: reinforcements come from behind for a round or two. Do not linger.', 'Cada porta aberta acorda os salões atrás de vocês: reforços chegam pela retaguarda por uma ou duas rodadas. Não se demorem.')]);
  } else if (m.id === 'cofre') {
    const cands = salasDe.lado.filter(i => (plano.grupo?.[i] || 0) === (plano.grupo?.[fim] || 0)).concat(salasDe.lado);
    const si = cands.find(i => cofre(pm, plano, rng, i, salasDe, notas)); if (si !== undefined) feito.push(si);
  }
  plano.modalidadeFeita = { id: m.id, feito };
  notas.push(L2('Mode: ' + TXT(m.nome) + (feito.length ? ' (' + feito.join(', ') + ')' : ' (nothing fitted)') + '.', 'Modalidade: ' + TXT(m.nome) + (feito.length ? ' (' + feito.join(', ') + ')' : ' (nada coube)') + '.'));
}
/* a side quest of the Chronicle in room si */
function missaoSecundaria(pm, plano, rng, si, q, livres, v) {
  const s = pm.salas[si]; const por = (tipo, alt) => { const oi = colocarNaSala(pm, si, tipo, rng) ?? (alt ? colocarNaSala(pm, si, alt, rng) : null); return oi == null ? null : s.objetos[oi]; };
  if (q === 'andarilho') {
    const outra = livres.find(i => i !== si) ?? si; const t = pm.salas[outra];
    const ai = colocarNaSala(pm, outra, 'InteractToken', rng); if (ai == null) return false; const amuleto = t.objetos[ai];
    const o = por('InteractToken'); if (!o) { t.objetos.splice(ai, 1); return false; }
    amuleto.textClick = L2('A silver amulet in the dust, its chain broken.', 'Um amuleto de prata na poeira, a corrente partida.'); amuleto.gatilhos = [txtT('The wanderer\'s amulet. It is warm to the touch.', 'O amuleto do andarilho. Está morno ao toque.'), itemNovo()];
    const ch = { uid: uid(), tipo: 'choice', text: L2('"Please… my amulet. I dropped it when they came. It is all I have left."', '"Por favor… meu amuleto. Deixei cair quando eles vieram. É tudo o que me resta."'), options: [{ text: L2('We will find it.', 'Vamos achá-lo.'), response: '' }, { text: L2('We cannot stop now.', 'Não podemos parar agora.'), response: L2('He nods and says nothing more.', 'Ele assente e não diz mais nada.') }], umaVez: true, requisitos: [] };
    o.textClick = L2('A wounded wanderer, leaning against the wall.', 'Um andarilho ferido, encostado na parede.'); o.gatilhos = [ch];
    o['op0:' + ch.uid] = [{ uid: uid(), tipo: 'mission', text: L2('Side quest: find the wanderer\'s amulet', 'Missão secundária: achem o amuleto do andarilho'), como: 'use_object', objSala: outra, objIndex: ai, requisitos: [] }];
    apresentar(pm, si, o, null, L2('A wounded wanderer rests against the wall.', 'Um andarilho ferido descansa encostado na parede.')); return true;
  }
  if (q === 'prisioneiro') {
    const o = por('InteractToken'); if (!o) return false; o.textClick = L2('A prisoner in heavy chains, watching you in silence.', 'Um prisioneiro em correntes pesadas, observando vocês em silêncio.');
    o.gatilhos = [testeNoObjeto(o, { stat: 'might', sucessos: 3, cumulativo: true, text: { en: 'You strain at the chains.', pt: 'Vocês forçam as correntes.' }, ok: { en: 'The chains snap. Free, he whispers where ' + v.vilao + ' hides the gold.', pt: 'As correntes cedem. Livre, ele sussurra onde ' + v.vilao + ' esconde o ouro.' }, fail: { en: 'The chains hold, for now.', pt: 'As correntes aguentam, por enquanto.' }, ouro: 30 })]; o.usos = 'always';
    apresentar(pm, si, o, null, L2('A prisoner hangs in chains here.', 'Um prisioneiro está acorrentado aqui.')); return true;
  }
  if (q === 'bau') {
    const o = por('Chest', 'InteractToken'); if (!o) return false; const sv = servosNaSala(pm, si, rng, 2, plano, 0);
    o.textClick = L2('A chest covered in runes that glow faintly. It hums.', 'Um baú coberto de runas que brilham fraco. Ele zumbe.');
    o.gatilhos = [txtT('The runes flare as the lid opens: its guardians wake!', 'As runas se acendem quando a tampa abre: os guardiões despertam!')].concat(sv ? [sv] : [], [itemNovo(), ouroDe(30)]);
    apresentar(pm, si, o, null, L2('A rune-covered chest hums in a corner.', 'Um baú coberto de runas zumbe num canto.')); return true;
  }
  if (q === 'altar') {
    const o = por(OBJETO.BloodShrine && daCaixa('BloodShrine', plano.atos) ? 'BloodShrine' : 'Lectern', 'InteractToken'); if (!o) return false; const sv = servosNaSala(pm, si, rng, 2, plano, -1);
    o.textClick = L2('A desecrated altar, still wet with offerings.', 'Um altar profanado, ainda úmido de oferendas.');
    const t = testeNoObjeto(o, { stat: 'will', text: { en: 'You speak the old words over it.', pt: 'Vocês dizem as palavras antigas sobre ele.' }, ok: { en: 'The stain fades. Something grateful leaves a gift.', pt: 'A mancha some. Algo agradecido deixa um presente.' }, fail: { en: 'The altar answers with a scream, and something answers the scream.', pt: 'O altar responde com um grito, e algo responde ao grito.' } });
    o.gatilhos = [t]; o['ok:' + t.uid].push(itemNovo()); if (sv) o['fail:' + t.uid].push(sv);
    apresentar(pm, si, o, null, L2('A desecrated altar stands here.', 'Um altar profanado está aqui.')); return true;
  }
  if (q === 'estandarte') {
    const o = por('InteractToken'); if (!o) return false; o.textClick = L2('The banner of a fallen order, trampled into the mud.', 'O estandarte de uma ordem caída, pisoteado na lama.');
    o.gatilhos = [txtT('You raise the banner. Courage runs through the party: every hero may focus 1 card.', 'Vocês erguem o estandarte. A coragem percorre o grupo: cada herói pode focar 1 carta.'), ouroDe(10)];
    apresentar(pm, si, o, null, L2('A fallen banner lies here.', 'Um estandarte caído está aqui.')); return true;
  }
  if (q === 'fonte') {
    const o = por('Well', 'InteractToken'); if (!o) return false; const bom = rng() < 0.6;
    const ch = { uid: uid(), tipo: 'choice', text: L2('The water is dark and very still.', 'A água é escura e muito parada.'), options: [{ text: L2('Drink.', 'Beber.'), response: bom ? L2('Cold and clean. Every hero heals 3.', 'Fria e limpa. Cada herói cura 3.') : L2('Bitter. Every hero suffers 1 fatigue, but may prepare 1 card.', 'Amarga. Cada herói sofre 1 de fadiga, mas pode preparar 1 carta.') }, { text: L2('Leave it.', 'Deixar.'), response: '' }], umaVez: true, requisitos: [] };
    o.textClick = L2('An old spring in a stone basin.', 'Uma velha fonte numa bacia de pedra.'); o.gatilhos = [ch];
    apresentar(pm, si, o, null, L2('An old spring bubbles in a stone basin.', 'Uma velha fonte borbulha numa bacia de pedra.')); return true;
  }
  return false;
}
/* an altar of mixed luck (drawn now: the players only learn by touching it). Easy 60/25/15, Hard 45/35/20; the goat's altar
   draws from all */
function altar(o, nome, cabra, dif, rng, pm, si, plano) {
  const pesos = dif === 'dificil' ? { bom: 45, misto: 35, ruim: 20 } : dif === 'facil' ? { bom: 70, misto: 20, ruim: 10 } : { bom: 60, misto: 25, ruim: 15 };
  const sorte = cabra ? rng.pick(['bom', 'misto', 'ruim']) : rng.pesado(pesos); const sv = () => servosNaSala(pm, si, rng, 2, plano, -1);
  const E = {
    bom: [() => [txtT('Warmth runs through you. Every hero heals 3.', 'Um calor percorre vocês. Cada herói cura 3.')], () => [txtT('A gift lies on the stone where there was none.', 'Um presente aparece na pedra onde não havia nada.'), itemNovo()], () => [txtT('Coins spill from a crack in the altar.', 'Moedas escorrem de uma rachadura no altar.'), ouroDe(30)], () => [txtT('Your minds sharpen. Every hero may prepare 2 cards.', 'As mentes se aguçam. Cada herói pode preparar 2 cartas.')]],
    misto: [() => [txtT('A gift, and a price: something heard it.', 'Um presente, e um preço: algo ouviu.'), itemNovo()].concat(sv() ? [sv()] : []), () => [txtT('Gold, cold as ice. Every hero suffers 1 fatigue.', 'Ouro, frio como gelo. Cada herói sofre 1 de fadiga.'), ouroDe(40)]],
    ruim: [() => [txtT('The altar laughs. Every hero suffers 1 fatigue.', 'O altar ri. Cada herói sofre 1 de fadiga.')], () => [txtT('Blood boils on the stone, and servants crawl out of it!', 'Sangue ferve na pedra, e servos rastejam dele!')].concat(sv() ? [sv()] : [])]
  };
  const efeito = rng.pick(E[sorte])();
  const ch = { uid: uid(), tipo: 'choice', text: L2(nome + '. The stone is warm, as if alive.', nome + '. A pedra é morna, como se estivesse viva.'), options: [{ text: L2('Touch the altar.', 'Tocar o altar.'), response: '' }, { text: L2('Leave it be.', 'Deixar como está.'), response: '' }], umaVez: true, vazio: L2('The altar is silent now.', 'O altar agora está em silêncio.'), requisitos: [] };
  o.name = nome; o.gatilhos = [ch]; o['op0:' + ch.uid] = efeito; o['op1:' + ch.uid] = []; o.acaoExtra = { ...(o.acaoExtra || {}), ['op1:' + ch.uid]: true }; o.usos = 'always';
}
/* the champion: the strongest monster of the pool, at its top tier, with traits the table applies; its pack is the room's
   balanced group. The pack defeated, it loses a trait; the champion defeated, a prize */
function campeao(pm, plano, rng, si, dif) {
  const s = pm.salas[si]; const vaga = (s.inimigos || []).filter(e => ehPool(e.enemy)).pop(); if (!vaga) return null;
  const pool = (pm.reserva || []).map(monstro).filter(Boolean); if (!pool.length) return null;
  const m = pool.slice().sort((a, b) => (b.tiers || []).length - (a.tiers || []).length)[0]; const maxT = tierDoLider(m, plano);
  const TRACOS = [{ en: 'Fiery: its attacks deal +1 damage', pt: 'Incandescente: seus ataques causam +1 de dano', n: { en: 'the Fiery', pt: 'Incandescente' }, at: 1 }, { en: 'Stoneskin: +1 defence', pt: 'Pele de Pedra: +1 de defesa', n: { en: 'Stoneskin', pt: 'Pele de Pedra' }, df: 1 }, { en: 'Swift: it moves 2 more spaces', pt: 'Veloz: move 2 espaços a mais', n: { en: 'the Swift', pt: 'Veloz' } }, { en: 'Bloodthirst: it heals 1 whenever it deals damage', pt: 'Sede de Sangue: cura 1 sempre que causa dano', n: { en: 'Bloodthirst', pt: 'Sede de Sangue' } }];
  const tr = rng.embaralhar(TRACOS).slice(0, dif === 'dificil' ? 2 : 1);
  const nome = rng.pick(['Gorthak', 'Vessa', 'Ulmar', 'Kragg', 'Ysolde', 'Morrow'].concat(HIST('regras.campeao').filter(x => typeof x === 'string'))) + ' ' + L2(tr[0].n.en, tr[0].n.pt);
  vaga.enemy = m.id; vaga.tier = maxT; vaga.uid = vaga.uid || uid();
  // what the app can do, it does (attack and defence of the champion alone); the rest the table applies. The text says it
  // is the champion only (before, "its attacks deal +1" read as if every monster had it)
  const at = tr.reduce((a, t) => a + (t.at || 0), 0), df = tr.reduce((a, t) => a + (t.df || 0), 0); if (at) vaga.bonusAtaque = at; if (df) vaga.bonusDefesa = df;
  const quem = nomeIni(m.id); const noApp = t => t.at || t.df;
  vaga.gatilhos = (vaga.gatilhos || []).concat([txtT(nome + ' falls. The pack scatters.', nome + ' cai. A matilha se dispersa.'), itemNovo(), ouroDe(25)]);
  const perde = tr[0]; const gp = grupoPoolDe(s); gp.gatilhos = (gp.gatilhos || []).concat([txtT('Without its pack, ' + nome + ' falters: it loses "' + perde.en.split(':')[0] + '".', 'Sem a matilha, ' + nome + ' vacila: perde "' + perde.pt.split(':')[0] + '".')],
    noApp(perde) ? [{ uid: uid(), tipo: 'enemy_condition', acao: 'bonus', alvo: 'group', grupo: 'room-' + (si + 1), enemy: m.id, ataque: -(perde.at || 0), defesa: -(perde.df || 0), requisitos: [] }] : []);
  const linha = t => L2(t.en + (noApp(t) ? ' (already in the app)' : ' (apply it at the table)'), t.pt + (noApp(t) ? ' (o app já aplica)' : ' (apliquem à mesa)'));
  s.textoDepois = ((s.textoDepois || '') + ' ' + L2('The champion ' + nome + ' (the ' + quem + ') leads the pack here. Only the champion has: ', 'O campeão ' + nome + ' (o ' + quem + ') lidera a matilha aqui. Só o campeão tem: ') + tr.map(linha).join('; ') + '.').trim();
  return nome;
}
/* the pursuer: from a round on, a strong monster comes in at the start and follows the heroes (the game's monsters walk
   to them); it heals every round. Its room left behind (a point of no return), it is left behind too */
function perseguidor(pm, plano, rng, dif) {
  const pool = (pm.reserva || []).map(monstro).filter(Boolean); if (!pool.length) return null;
  const m = pool.slice().sort((a, b) => (b.tiers || []).length - (a.tiers || []).length)[0]; const maxT = tierDoLider(m, plano);
  const s0 = pm.salas[0]; const casa = (s0.herois || [])[0]; if (!casa) return null;
  // the pursuer of the story (a skin of HISTORIAS.regras.perseguidor)
  const P = plano.roupaRegra && plano.roupaRegra.entrada ? plano.roupaRegra : null;
  const desde = { facil: 5, normal: 4, dificil: 3 }[dif] || 4; const nome = P ? TXT(P.nome) : rng.pick([L2('the Jailer', 'o Carcereiro'), L2('the Hound of ' + plano.vocab.vilao, contrair('o Cão de ' + plano.vocab.vilao)), L2('the Grey Hunter', 'o Caçador Cinzento')]); const vd = { ...plano.vocab, desde };
  const u = uid(); const inimigo = { enemy: m.id, pos: [casa[0], casa[1]], tier: maxT, level: casa[2] || 0, uid: uid(), gatilhos: [P ? txtT(RT(P.cai, vd), RT(P.cai, vd)) : txtT(nome.charAt(0).toUpperCase() + nome.slice(1) + ' falls, at last. The halls go quiet.', nome.charAt(0).toUpperCase() + nome.slice(1) + ' cai, enfim. Os salões silenciam.'), itemNovo()], senao: [] };
  pm.eventos = (pm.eventos || []).concat([
    { uid: 'ev' + u, sala: 0, rodada: desde, gatilhos: [P ? txtT(RT(P.entrada, vd), RT(P.entrada, vd)) : txtT('Heavy steps at the entrance. ' + nome + ' has found your trail, and will not stop.', 'Passos pesados na entrada. ' + nome.charAt(0).toUpperCase() + nome.slice(1) + ' achou o rastro de vocês, e não vai parar.'), { uid: 'gp' + u, tipo: 'spawn', fonte: 'list', inimigos: [inimigo], cells: [], requisitos: [] }] },
    { uid: 'eh' + u, sala: 0, rodada: desde + 1, cada: 1, gatilhos: [{ uid: uid(), tipo: 'enemy_condition', acao: 'heal', amount: dif === 'dificil' ? 3 : 2, alvo: 'group', grupo: 'gp' + u, requisitos: [] }] }]);
  plano.introExtra = (plano.introExtra || []).concat([P ? RT(P.intro, vd) : L2('Something follows you in. From round ' + desde + ', ' + nome + ' comes in at the entrance and hunts you; its wounds close every round.', 'Algo segue vocês. A partir da rodada ' + desde + ', ' + nome + ' entra pela entrada e caça vocês; as feridas dele se fecham a cada rodada.')]);
  plano.semPressa = true; return nome;
}
/* a side door that announces what lies behind it; the skull, a harder room with a double prize */
function anunciarSala(pm, plano, rng, si, ab, premio, caveira, v) {
  const s = pm.salas[si]; const P = {
    ouro: [L2('a glint of gold', 'um brilho de ouro'), () => [ouroDe(caveira ? 60 : 30)]],
    item: [L2('something worth carrying', 'algo que vale a pena levar'), () => caveira ? [itemNovo(), itemNovo()] : [itemNovo()]],
    cura: [L2('a quiet place to rest', 'um lugar calmo para descansar'), () => [txtT(caveira ? 'Every hero heals 5 and discards all fatigue.' : 'Every hero heals 3.', caveira ? 'Cada herói cura 5 e descarta toda a fadiga.' : 'Cada herói cura 3.')]],
    pista: [L2('a clue about ' + v.vilao, 'uma pista sobre ' + v.vilao), () => [txtT('A torn letter: ' + v.vilao + '\'s plans, and a weakness. Every hero may focus ' + (caveira ? 2 : 1) + ' card(s) in the last fight.', 'Uma carta rasgada: os planos de ' + v.vilao + ', e uma fraqueza. Cada herói poderá focar ' + (caveira ? 2 : 1) + ' carta(s) na luta final.')]]
  }[premio];
  ab.o.textClick = L2('Beyond this door: ' + P[0] + '.' + (caveira ? ' A skull is scratched on it: danger, and a double reward.' : ''), 'Atrás desta porta: ' + P[0] + '.' + (caveira ? ' Uma caveira riscada nela: perigo, e recompensa dobrada.' : ''));
  // the prize: when the room's monsters are defeated (or at once, when it has none)
  const temIni = (s.inimigos || []).length > 0;
  if (caveira) { s.intensidade = Math.min(10, (s.intensidade || plano.base) + 2); (s.inimigos || []).forEach(e => { if (!ehPool(e.enemy)) e.tier = Math.min(4, (e.tier || 2) + 1); }); }
  if (temIni) { const gp = grupoPoolDe(s); gp.gatilhos = (gp.gatilhos || []).concat([txtT('The room is yours. What was promised lies here.', 'A sala é de vocês. O que foi prometido está aqui.')], P[1]()); }
  else { const oi = colocarNaSala(pm, si, 'Chest', rng) ?? colocarNaSala(pm, si, 'InteractToken', rng); if (oi != null) { const o = s.objetos[oi]; o.gatilhos = [txtT('What was promised lies here.', 'O que foi prometido está aqui.')].concat(P[1]()); } }
}
// ------------------------------------------------------------ less walking back (backtracking)
// As in Dormans' cyclic dungeons and the level design of shortcuts: a dead end gives a way back, a late room opens a way to an
// early one, a room climbs instead of spreading. A way back takes one hero at a time, whenever they like (levarUmHeroi)
/* a way back that removes nothing from the table (return runes, waystones): each hero goes alone, whenever they like; the
   others may follow the same way */
function levarUmHeroi(o, casas, sala, qen, qpt, en, pt) {
  const ch = { uid: uid(), tipo: 'choice', text: L2(qen + ' Whoever touches it goes alone; the others may follow the same way.', qpt + ' Quem tocar vai sozinho; os outros podem seguir pelo mesmo caminho.'), options: [{ text: L2('I go.', 'Eu vou.'), response: '' }, { text: L2('Not now.', 'Agora não.'), response: '' }], requisitos: [] };
  o.gatilhos = (o.gatilhos || []).concat([ch]); o['op0:' + ch.uid] = [{ uid: uid(), tipo: 'move_heroes', cells: casas, _sala: sala, text: L2(en + ' The hero who touched it goes to a free lit space.', pt + ' O herói que tocou vai para um espaço iluminado livre.'), requisitos: [] }];
  o['op1:' + ch.uid] = []; o.acaoExtra = { ...(o.acaoExtra || {}), ['op1:' + ch.uid]: true }; o.usos = 'always';
}
/* something to carry a trigger in room si: a new one of the kinds given (the box allowing), else a thing of the room that does
   nothing yet (a shelf, a statue, the cover of a fight: the runes carved on it). Returns its index, or null */
function portadorNaSala(pm, si, rng, tipos, extra, reusar = true) {
  // (never a thing to search, whose own choice the heroes know: a tree, a well, a shelf, a cauldron, a wagon)
  for (const t of tipos.filter(t => !BUSCAS[t])) { const oi = colocarNaSala(pm, si, t, rng, extra); if (oi != null) { limparPortador(pm.salas[si].objetos[oi]); return oi; } }
  if (!reusar) return null;
  const s = pm.salas[si]; const oi = s.objetos.findIndex(portadorReusavel);
  if (oi < 0) return null; Object.assign(s.objetos[oi], extra || {}); limparPortador(s.objetos[oi]); return oi;
}
/* a thing of the room that may carry a gimmick: not terrain, not hidden, not the narrator, not a thing to search, with no
   trigger yet, and not a passage (doors, arches, ladders, points of interest) */
const portadorReusavel = o => !ehTerreno(o) && !o.hidden && !o._narrador && !BUSCAS[baseObj(o.type)] && !(o.gatilhos || []).length && !Object.keys(o).some(k => k.includes(':')) && !/^(Door|Gate|Archway|BellFrame|DragonArch|Ladder|LadderMedium|SightToken)$/.test(baseObj(o.type));
/* a carrier made ready for its gimmick: no triggers, no lists, no uses, no free action */
const limparPortador = o => { Object.keys(o).forEach(k => { if (k.includes(':')) delete o[k]; }); o.gatilhos = []; delete o.usos; delete o.acaoExtra; return o; };
/* the ways back from the end of a detour, each with its reason to exist (the room's places pick them): runes, the bell frame
   turned portal (a token in its passage), the iron hatch of a gallery, a dry well with a tunnel, a turning bookcase, a hollow
   tree over a root tunnel, a crack in the rock with a draught, the empty niche of an ossuary, a bronze mirror. tipo: what
   carries it (BellFrame: the frame, with a token in its middle); temas: the places where it fits (null: any); reusar: it may
   be a thing already in the room. Texts: [en, pt]; the question and the look may name the room ({n}) */
const PASSAGENS_DE_VOLTA = [
  { id: 'runas', peso: 1, temas: null, tipos: ['InteractToken', 'SightToken', 'Statue', 'Lectern', 'StoneTable'], reusar: true, nome: ['Return runes', 'Runas de retorno'],
    olhar: ['Runes carved in a circle, still faintly glowing.', 'Runas entalhadas num círculo, ainda brilhando de leve.'], revela: ['A circle of runes glows faintly on the floor.', 'Um círculo de runas brilha de leve no chão.'],
    pergunta: ['The runes hum: they lead back to room {n}, {onde}.', 'As runas zumbem: levam de volta à sala {n}, {onde}.'],
    viagem: ['A flash, and the hero stands {chegada}.', 'Um clarão, e o herói aparece {chegada}.'] },
  { id: 'sino', peso: 2, temas: ['masmorra', 'cripta', 'fortaleza', 'caverna', 'aldeia'], tipos: ['BellFrame'], nome: ['Bell portal', 'Portal do sino'],
    olhar: ['A stone frame whose bell is long gone. Between its feet the air ripples like water, and room {n} shows through it.', 'Uma moldura de pedra cujo sino se foi há muito. Entre os pés dela, o ar ondula como água, e através dele aparece a sala {n}.'],
    revela: ['Under an empty bell frame, the air ripples like water.', 'Sob uma moldura de sino vazia, o ar ondula como água.'],
    pergunta: ['Through the rippling air shows room {n}, {onde}.', 'Pelo ar que ondula aparece a sala {n}, {onde}.'],
    viagem: ['The hero steps through the frame and comes out {chegada}.', 'O herói atravessa a moldura e sai {chegada}.'] },
  { id: 'tampa', peso: 3, temas: ['masmorra', 'fortaleza', 'aldeia', 'cripta'], tipos: ['InteractToken'], reusar: ['InteractToken'], nome: ['Gallery hatch', 'Tampa da galeria'],
    olhar: ['A round iron hatch in the floor, with a ring to lift it. Below, a narrow gallery runs back the way you came.', 'Uma tampa redonda de ferro no chão, com uma argola para erguê-la. Embaixo, uma galeria estreita volta pelo caminho que vocês fizeram.'],
    revela: ['An iron hatch with a ring is set in the floor.', 'Uma tampa de ferro com argola está encaixada no chão.'],
    pergunta: ['The gallery under the hatch comes up in room {n}, {onde}.', 'A galeria sob a tampa sai na sala {n}, {onde}.'],
    viagem: ['The hero drops through the hatch, crawls along the gallery and climbs out {chegada}.', 'O herói desce pela tampa, rasteja pela galeria e sobe {chegada}.'] },
  { id: 'poco', peso: 2, temas: ['aldeia', 'ermo', 'masmorra', 'caverna'], tipos: ['Well'], nome: ['Dry well', 'Poço seco'],
    olhar: ['A dry well. A knotted rope goes down to the bottom, where a tunnel opens.', 'Um poço seco. Uma corda cheia de nós desce até o fundo, onde se abre um túnel.'],
    revela: ['A dry well stands here, a knotted rope hanging into it.', 'Há um poço seco aqui, com uma corda cheia de nós pendurada dentro.'],
    pergunta: ['The tunnel at the bottom of the well leads to room {n}, {onde}.', 'O túnel no fundo do poço leva à sala {n}, {onde}.'],
    viagem: ['The hero climbs down the rope, follows the tunnel and comes out {chegada}.', 'O herói desce pela corda, segue o túnel e sai {chegada}.'] },
  { id: 'estante', peso: 2, temas: ['masmorra', 'fortaleza'], tipos: ['Shelf'], nome: ['Turning bookcase', 'Estante giratória'],
    olhar: ['A heavy bookcase. One book will not come off the shelf: it is a lever.', 'Uma estante pesada. Um dos livros não sai da prateleira: é uma alavanca.'],
    revela: ['One of the bookcases stands a finger away from the wall.', 'Uma das estantes está a um dedo de distância da parede.'],
    pergunta: ['Behind the bookcase, a secret passage runs back to room {n}, {onde}.', 'Atrás da estante, uma passagem secreta volta até a sala {n}, {onde}.'],
    viagem: ['The bookcase turns on itself; the hero follows a narrow passage and comes out {chegada}.', 'A estante gira sobre si mesma; o herói segue por uma passagem estreita e sai {chegada}.'] },
  { id: 'arvore', peso: 3, temas: ['ermo', 'aldeia'], tipos: ['Tree'], nome: ['Hollow tree', 'Árvore oca'],
    olhar: ['An old tree, hollow inside. Thick roots make steps down into a tunnel.', 'Uma árvore velha, oca por dentro. Raízes grossas formam degraus que descem até um túnel.'],
    revela: ['An old hollow tree opens a dark mouth between its roots.', 'Uma árvore velha e oca abre uma boca escura entre as raízes.'],
    pergunta: ['The root tunnel comes out in room {n}, {onde}.', 'O túnel das raízes sai na sala {n}, {onde}.'],
    viagem: ['The hero squeezes into the trunk, follows the roots and comes out {chegada}.', 'O herói se espreme dentro do tronco, segue as raízes e sai {chegada}.'] },
  { id: 'fenda', peso: 3, temas: ['caverna', 'ermo'], tipos: ['InteractToken'], reusar: ['InteractToken'], nome: ['Draughty crack', 'Fenda do vento'],
    olhar: ['A narrow crack in the rock, with a cold draught blowing out of it. One person at a time can slip through sideways.', 'Uma fenda estreita na rocha, por onde sopra um vento frio. Passa uma pessoa por vez, de lado.'],
    revela: ['A cold draught blows from a crack in the rock.', 'Um vento frio sopra de uma fenda na rocha.'],
    pergunta: ['The draught comes from room {n}, {onde}.', 'O vento vem da sala {n}, {onde}.'],
    viagem: ['The hero slips sideways through the crack and comes out {chegada}.', 'O herói passa de lado pela fenda e sai {chegada}.'] },
  { id: 'ossuario', peso: 3, temas: ['cripta'], tipos: ['InteractToken'], reusar: ['InteractToken'], nome: ['Empty ossuary niche', 'Nicho vazio do ossuário'],
    olhar: ['A niche of the ossuary with no bones in it. At the back, a low tunnel where one can only crawl.', 'Um nicho do ossuário, sem ossos. No fundo, um túnel baixo onde só se passa rastejando.'],
    revela: ['One niche of the ossuary is empty, and a draught comes out of it.', 'Um dos nichos do ossuário está vazio, e dele sai uma corrente de ar.'],
    pergunta: ['The tunnel behind the niche comes out in room {n}, {onde}.', 'O túnel atrás do nicho sai na sala {n}, {onde}.'],
    viagem: ['The hero crawls through the niche and comes out {chegada}.', 'O herói rasteja pelo nicho e sai {chegada}.'] },
  { id: 'espelho', peso: 1, temas: ['masmorra', 'cripta', 'fortaleza'], tipos: ['InteractToken'], reusar: ['InteractToken'], nome: ['Bronze mirror', 'Espelho de bronze'],
    olhar: ['A tall bronze mirror. It does not show you: it shows room {n}, {onde}.', 'Um espelho alto de bronze. Ele não mostra vocês: mostra a sala {n}, {onde}.'],
    revela: ['A tall bronze mirror leans on the wall, reflecting another room.', 'Um espelho alto de bronze, apoiado na parede, reflete outra sala.'],
    pergunta: ['The mirror shows room {n}, {onde}.', 'O espelho mostra a sala {n}, {onde}.'],
    viagem: ['The hero steps into the bronze and comes out {chegada}, a little cold.', 'O herói entra no bronze e sai {chegada}, com um pouco de frio.'] }
];
/* where a way back comes out: [the question's words, the arrival's], [en, pt] */
const ONDE_DA_VOLTA = { porta: [['by the door you came through', 'junto à porta por onde vocês vieram'], ['by the door of the detour', 'junto à porta do desvio']],
  adiante: [['by the way on', 'junto à saída que leva adiante'], ['by the way on', 'junto à saída que leva adiante']],
  entrada: [['by its entrance', 'junto à entrada dela'], ['at the entrance of room {n}', 'na entrada da sala {n}']] };
const VOLTA_MIN = 12;   // (squares, as the heroes count, between the way back and where it leads: closer, the heroes walk)
const temaDaSala = (plano, si) => { const b = plano.batidas.find(x => x.sala === si); return (b && b.tema) || plano.tema; };
/* the end of a detour (a side room with nothing after it): a way back (one of PASSAGENS_DE_VOLTA, as the room's place
   allows) that takes each hero, alone, to the room of the way it left, by the door of the detour. Always on a detour two
   rooms deep or more; on a short one now and then; never closer than VOLTA_MIN squares to where it leads */
function runasDeRetorno(pm, plano, rng, salasDe) {
  const eixo = new Set(salasDe.eixo); const fim = salasDe.eixo[salasDe.eixo.length - 1]; const feitas = []; plano.voltas = [];
  salasDe.lado.forEach(si => { const pai = k => abridorDe(pm, k)?.ri;
    if (!pm.salas[si] || pm.salas.some((x, j) => j !== si && pai(j) === si)) return;   // (only at the end of a detour)
    let r = si, prof = 0, raiz = null, primeira = si; while (r != null && prof < 12) { const p = pai(r); if (p == null) break; prof++; if (eixo.has(p)) { raiz = p; primeira = r; break; } r = p; }
    if (raiz == null || raiz === fim || (plano.grupo?.[raiz] || 0) !== (plano.grupo?.[si] || 0)) return;
    if (prof < 2 && rng() >= 0.5) return;
    // where it leads, in room raiz: by the door of the detour; else (too near) by the way on, or by the room's entrance
    const ab = abridorDe(pm, primeira); const k = salasDe.eixo.indexOf(raiz); const adiante = salasDe.eixo[k + 1] != null ? abridorDe(pm, salasDe.eixo[k + 1]) : null;
    const destinos = [['porta', casasParaHerois(pm, raiz, 4, casasDoObjeto(ab.o))]].concat(adiante && adiante.ri === raiz ? [['adiante', casasParaHerois(pm, raiz, 4, casasDoObjeto(adiante.o))]] : [], [['entrada', casasParaHerois(pm, raiz, 4)]]).filter(d => d[1].length >= 2);
    let v = null, onde = null, casas = null; for (const [q, cs] of destinos) { v = passagemDeVolta(pm, plano, si, rng, cs); if (v) { onde = q; casas = cs; break; } }
    if (!v) return;
    const { o, P } = v; const n = String(raiz + 1); const W = ONDE_DA_VOLTA[onde];
    const F = (t, l) => t.replace('{n}', n).replace('{onde}', W[0][l]).replace('{chegada}', W[1][l].replace('{n}', n)); const T = par => L2(F(par[0], 0), F(par[1], 1));
    o.name = L2(P.nome[0], P.nome[1]); o.gatilhos = [];
    levarUmHeroi(o, casas, raiz, F(P.pergunta[0], 0), F(P.pergunta[1], 1), F(P.viagem[0], 0), F(P.viagem[1], 1));
    apresentar(pm, si, o, T(P.olhar), T(P.revela));
    (v.gemeos || []).forEach(g => { g.name = o.name; g.textClick = o.textClick; });
    feitas.push(si); plano.voltas.push({ sala: si, para: raiz, variante: P.id, onde }); });
  return feitas;
}
const longeDe = (o, casas, min) => casasDoObjeto(o).every(([x, y]) => casas.every(([a, b]) => Math.max(Math.abs(a - x), Math.abs(b - y)) >= min));
/* the thing that carries a way back in room si, at least VOLTA_MIN squares from the squares it leads to: the kinds that fit the
   room's place, drawn by weight, each tried in turn. Returns { o, P, gemeos } or null */
function passagemDeVolta(pm, plano, si, rng, casas) {
  const tema = temaDaSala(plano, si); const s = pm.salas[si]; const longe = { casas, min: VOLTA_MIN };
  let cands = PASSAGENS_DE_VOLTA.filter(P => !P.temas || !TEMAS_SALA[tema] || tema === 'qualquer' || P.temas.includes(tema)); const ordem = [];
  while (cands.length) { const tot = cands.reduce((a, P) => a + P.peso, 0); let x = rng() * tot; const k = cands.findIndex(P => (x -= P.peso) < 0); const P = cands[k < 0 ? cands.length - 1 : k]; ordem.push(P); cands = cands.filter(q => q !== P); }
  ordem.sort((a, b) => (a.id === 'runas') - (b.id === 'runas'));   // (the runes, which fit anywhere, only when no other way does)
  for (const P of ordem) {
    if (P.tipos[0] === 'BellFrame') {
      const n0 = s.objetos.length; const ai = colocarNaSala(pm, si, 'BellFrame', rng, { name: '', textClick: '' }, 'passagem', longe); if (ai == null || ai < n0 || baseObj(s.objetos[ai].type) !== 'BellFrame') { if (ai != null && ai >= n0) s.objetos.splice(ai, 1); continue; }
      const a = s.objetos[ai]; const ms = meioDoArco(a).meio;
      const base = { type: 'InteractToken', rot: 0, level: a.level || 0, name: '', textClick: '', textUse: '', gatilhos: [], requisitos: [], senao: [] };
      s.objetos.push({ ...base, pos: [ms[0][0], ms[0][1]] }); const oi = s.objetos.length - 1; const gemeos = [];
      if (ms[1]) { s.objetos.push({ ...base, pos: [ms[1][0], ms[1][1]], gemeo: oi }); gemeos.push(s.objetos[s.objetos.length - 1]); }   // (either square of the passage)
      a.textClick = L2('A stone frame whose bell is long gone; the air between its feet ripples.', 'Uma moldura de pedra cujo sino se foi há muito; o ar entre os pés dela ondula.'); return { o: s.objetos[oi], P, gemeos };
    }
    for (const t of P.tipos) { const oi = colocarNaSala(pm, si, t, rng, null, undefined, longe); if (oi != null) return { o: limparPortador(s.objetos[oi]), P }; }
  }
  // (none fits as a thing of its own: a thing already in the room, far enough, carries it: a token is anything)
  for (const P of ordem.filter(P => P.reusar)) {
    const oi = s.objetos.findIndex(o => (P.reusar === true || P.reusar.includes(baseObj(o.type))) && portadorReusavel(o) && longeDe(o, casas, VOLTA_MIN));
    if (oi >= 0) return { o: limparPortador(s.objetos[oi]), P };
  }
  return null;
}
/* a shortcut opened from the far side (Dormans' "hidden shortcut"): a waystone in a late room of the way wakes its twin in an
   early room (one with detours or pieces to fetch); from then on, each stone takes everyone to the other */
function pedrasDePassagem(pm, plano, rng, salasDe, o) {
  if (o.duracao === 'curta' || rng() >= 0.85) return null;
  const fim = salasDe.eixo[salasDe.eixo.length - 1]; const g = plano.grupo?.[fim] || 0; const mesmo = i => (plano.grupo?.[i] || 0) === g;
  const eixo = salasDe.eixo.filter(mesmo); if (eixo.length < 4) return null;
  const L = eixo[eixo.length - 2]; const iL = eixo.indexOf(L);
  const temCoisas = i => pm.salas.some((x, j) => abridorDe(pm, j)?.ri === i && !salasDe.eixo.includes(j)) || pm.salas[i].objetos.some(x => Object.keys(x).some(k => Array.isArray(x[k]) && x[k].some(gg => gg.tipo === 'counter' && (gg.acao || 'add') === 'add')));
  const cands = eixo.slice(0, Math.max(0, iL - 1)).filter(i => i > 0 && temCoisas(i)); const E = cands.length ? cands[0] : eixo.slice(1, Math.max(1, iL - 1))[0]; if (E == null) return null;
  const nome = L2('Waystone', 'Pedra de passagem');
  const nL = pm.salas[L].objetos.length; const oL = portadorNaSala(pm, L, rng, ['Statue', 'InteractToken', 'SightToken', 'Lectern', 'StoneTable'], { name: nome }); if (oL == null) return null;
  const desfazL = () => { if (oL >= nL) pm.salas[L].objetos.splice(oL, 1); else { delete pm.salas[L].objetos[oL].name; pm.salas[L].objetos[oL].gatilhos = []; } };
  const oE = portadorNaSala(pm, E, rng, ['Statue', 'InteractToken', 'SightToken', 'Lectern', 'StoneTable'], { name: nome, hidden: true }, false); if (oE == null) { desfazL(); return null; }
  const pL = pm.salas[L].objetos[oL], pE = pm.salas[E].objetos[oE];
  const cL = casasParaHerois(pm, L, 4, casasDoObjeto(pL)), cE = casasParaHerois(pm, E, 4, casasDoObjeto(pE)); if (cL.length < 2 || cE.length < 2 || !longeDe(pL, cE, VOLTA_MIN) || !longeDe(pE, cL, VOLTA_MIN)) { pm.salas[E].objetos.splice(oE, 1); desfazL(); return null; }
  pL.gatilhos = [txtT('The waystone warms under your hand. Far behind, in room ' + (E + 1) + ', its twin wakes.', 'A pedra de passagem esquenta sob a mão. Lá atrás, na sala ' + (E + 1) + ', a gêmea dela desperta.'), { uid: uid(), tipo: 'add_object', objSala: E, objIndex: oE, requisitos: [] }];
  levarUmHeroi(pL, cE, E, 'The stone can carry you to its twin in room ' + (E + 1) + '.', 'A pedra pode levar até a gêmea na sala ' + (E + 1) + '.', 'The stone flares: the hero is back in room ' + (E + 1) + '.', 'A pedra se acende: o herói está de volta na sala ' + (E + 1) + '.');
  pE.gatilhos = []; levarUmHeroi(pE, cL, L, 'The stone can carry you to its twin in room ' + (L + 1) + '.', 'A pedra pode levar até a gêmea na sala ' + (L + 1) + '.', 'The stone flares: the hero is in room ' + (L + 1) + ' again.', 'A pedra se acende: o herói está na sala ' + (L + 1) + ' de novo.');
  apresentar(pm, L, pL, L2('A standing stone carved with a spiral, humming low.', 'Uma pedra em pé, entalhada com uma espiral, zumbindo baixo.'), L2('A standing stone carved with a spiral hums in a corner.', 'Uma pedra em pé, entalhada com uma espiral, zumbe num canto.'));
  pE.textClick = L2('A standing stone carved with a spiral, the twin of the other.', 'Uma pedra em pé, entalhada com uma espiral, gêmea da outra.');
  return { de: L, para: E };
}
/* the lever and the attic: in a room whose way on goes over its raised part (a jump from the ledge), the climb is hidden; a
   lever on the floor opens a trapdoor above and lets a ladder down. The room climbs instead of spreading */
function alavancaDoSotao(pm, plano, rng, salasDe) {
  const feitas = [];
  salasDe.eixo.forEach((si, k) => { if (!si || rng() >= 0.5) return; const s = pm.salas[si];
    // (something that matters stands up there: the way on, a door to a detour, a chest, a piece)
    if (!s.objetos.some(o => (o.level || 0) > 0 && !/^(Ladder|LadderMedium|Staircase|Bridge)$/.test(baseObj(o.type)) && (todosGatilhos(o).length || Object.keys(o).some(x => x.includes(':'))))) return;
    const subidas = s.objetos.map((o, oi) => ({ o, oi })).filter(({ o }) => /^(Ladder|LadderMedium|Staircase)$/.test(baseObj(o.type)) && !o.hidden && !todosGatilhos(o).length);
    if (!subidas.length) return;
    const ch = chaoDaSala(si, pm); if (entradaDaSala(si, pm).some(([x, y]) => (ch.get(x + ',' + y)?.nivel || 0) > 0) || (plano.chegada?.[si] || []).some(([x, y]) => (ch.get(x + ',' + y)?.nivel || 0) > 0)) return;
    const n0 = s.objetos.length; const oi = portadorNaSala(pm, si, rng, ['InteractToken', 'Lectern', 'StoneTable'], { name: L2('A lever', 'Uma alavanca') }); if (oi == null) return;
    const o = s.objetos[oi]; if ((o.level || 0) > 0) { if (oi >= n0) s.objetos.splice(oi, 1); else delete o.name; return; }
    subidas.forEach(({ o: x }) => { x.hidden = true; });
    o.gatilhos = [txtT('You pull the lever. Above, a trapdoor swings open and a ladder slides down to the attic.', 'Vocês puxam a alavanca. No alto, um alçapão se abre e uma escada desce até o sótão.')].concat(subidas.map(({ oi: j }) => ({ uid: uid(), tipo: 'add_object', objSala: si, objIndex: j, requisitos: [] })));
    o.usos = 1;
    apresentar(pm, si, o, L2('An iron lever in the wall. A rope runs from it up into the dark ceiling.', 'Uma alavanca de ferro na parede. Uma corda sobe dela até o teto escuro.'), L2('An iron lever juts from the wall; a rope runs from it into the ceiling.', 'Uma alavanca de ferro sai da parede; uma corda sobe dela até o teto.'));
    feitas.push(si); });
  return feitas;
}
/* the viaduct: from the raised part of room C (level 2 or 3), a walkway on pillars crosses over a room already walked (the
   heroes went through it, through another, and now come back over it), out to the open table, where the next room lies
   below its far end (a jump down: a point of no return). Laid by hand: tiles at the level of the ledge, on pillars of that
   height, over floor two levels below or more, touching nothing else at its level. Returns the room, or null */
function viadutoSobre(pm, plano, rng, C, convivem, soNivel = null, exigencias = [3, 0], tema = plano.tema) {
  const atos = plano.atos; const TIPO = { 2: 'Pillar', 3: 'PillarTall' };
  // (the edges of its raised part at level 2 or 3, whatever lies beyond: the walkway may start over another room)
  const chC = chaoDaSala(C, pm); const pts = [];
  chC.forEach(c => { if ((c.nivel !== 2 && c.nivel !== 3) || c.bloqueia || c.escada || c.ponte || c.muro || c.degrau || c.objeto != null) return;
    VIZ4.forEach(([dx, dy]) => { if (chC.has((c.x + dx) + ',' + (c.y + dy))) return; pts.push({ sala: C, casa: [c.x, c.y], fora: [c.x + dx, c.y + dy], dir: [dx, dy], nivel: c.nivel }); }); });
  if (!pts.length) return null;
  // the floor of every room by square: the levels there (tiles, walls, terrain)
  const pisos = new Map(); const marca = (k, lv, si) => { const a = pisos.get(k) || []; a.push({ lv, si }); pisos.set(k, a); };
  pm.salas.forEach((s, si) => { s.pecas.forEach(q => { if (!ehAlfombra(q.tile)) casasDaPeca(q).forEach(([x, y]) => marca(x + ',' + y, nivelNaPeca(q, x, y), si)); });
    s.objetos.forEach(o => { if (ehTerreno(o) || /^(Ladder|LadderMedium)$/.test(baseObj(o.type))) casasDoObjeto(o).forEach(([x, y]) => marca(x + ',' + y, (o.level || 0) + 2, si)); }); });
  // (what stands tall in a room below: arches, trees, statues, bells; and where the figures and things are)
  const alto = new Set(), coisas = new Set(); pm.salas.forEach(s => { s.objetos.forEach(o => { const cs = casasDoObjeto(o); if (/^(Archway|BellFrame|DragonArch|Tree|Statue|Bell)$/.test(baseObj(o.type))) cs.forEach(([x, y]) => alto.add(x + ',' + y)); cs.forEach(([x, y]) => coisas.add(x + ',' + y)); });
    (s.inimigos || []).forEach(e => coisas.add(e.pos.join(','))); (s.herois || []).forEach(h => coisas.add(h[0] + ',' + h[1])); });
  const antes = new Set(convivem.filter(i => i !== C));   // (the rooms it may pass over: walked before, on the table now)
  // (the ledges facing a room walked before first: the walkway is for crossing over it)
  const celulasAntes = [...antes].flatMap(i => pm.salas[i].pecas.filter(q => !ehAlfombra(q.tile)).flatMap(q => casasDaPeca(q)));
  const longe = pt => celulasAntes.reduce((m, [x, y]) => Math.min(m, Math.abs(x - pt.fora[0] - pt.dir[0] * 2) + Math.abs(y - pt.fora[1] - pt.dir[1] * 2)), 99);
  pts.forEach(pt => { pt._d = longe(pt) + rng() * 1.5; }); pts.sort((a, b) => a._d - b._d);
  const pil = pilaresLivres(pm, convivem, atos);
  const estoque = estoquePecas(pm, tema, -1, atos, convivem).flat();
  // (first a walkway over a room walked before; with none, a walkway out over the open table)
  // (each ledge's walkways are found once, then asked for each demand in turn; the squares checked once)
  const porPonto = new Map(), okMemo = new Map(); const exigeMin = Math.min(...exigencias.filter(e => e > 0).concat([99]));
  for (const exige of exigencias) for (const pt of pts.slice(0, 16)) {
    const LV = pt.nivel; const tp = TIPO[LV]; if (!tp || (pil[tp] || 0) < 3 || (soNivel && LV !== soNivel)) continue;
    // (over floor two levels below or more, of a room walked before or of C itself; it may lean on C, the room it leaves; next
    // to any other room only far above or below its level)
    // (rooms of a set left behind are off the table: nothing there to mind)
    const fora = si => (plano.grupo?.[si] || 0) < (plano.grupo?.[C] || 0);
    const ok0 = (x, y) => { const k = x + ',' + y; if (alto.has(k)) return false;
      for (const { lv, si } of pisos.get(k) || []) { if ((si !== C && !antes.has(si) && !fora(si)) || lv > LV - 2) return false; }
      for (const [dx, dy] of VIZ8) { const n = (x + dx) + ',' + (y + dy); for (const { lv, si } of pisos.get(n) || []) { if (si === C || lv !== LV) continue; return false; } }
      return true; };
    const ok = (x, y) => { const k = LV + ':' + x + ',' + y; let r = okMemo.get(k); if (r === undefined) { r = ok0(x, y); okMemo.set(k, r); } return r; };
    const sobre = cs => cs.filter(([x, y]) => (pisos.get(x + ',' + y) || []).some(p2 => p2.si !== C && !fora(p2.si))).length;
    // the tiles: one, or (to reach over a room walked before) two in a row, each on its own pillars
    const avancoDe = cs => cs.reduce((s2, [x, y]) => s2 + (x - pt.fora[0]) * pt.dir[0] + (y - pt.fora[1]) * pt.dir[1], 0) / cs.length;
    let M = porPonto.get(pt); if (!M) { M = { umas: [], pares: null }; porPonto.set(pt, M);
    const umas = M.umas; const vistos = new Set();
    for (const tile of rng.embaralhar(estoque.slice())) for (const rot of [0, 90, 180, 270]) for (const c of tile.cells.map(c0 => girar(c0, rot))) {
      const q = { tile: tile.id, pos: [pt.fora[0] - c[0], pt.fora[1] - c[1]], rot, level: LV, pilares: [] }; const cs = casasDaPeca(q);
      const chave = cs.map(c2 => c2.join(',')).sort().join(';'); if (vistos.has(chave)) continue; vistos.add(chave);
      const avanco = avancoDe(cs); if (avanco < 1.5) continue;
      if (!cs.every(([x, y]) => ok(x, y))) continue;
      umas.push({ pecas: [q], cs, n: sobre(cs), v: avanco + rng() }); } }
    const umas = M.umas; let escolha = null;
    const melhorDe = l => l.sort((a, b) => (b.n * 2 + b.v) - (a.n * 2 + a.v))[0] || null;
    escolha = melhorDe(umas.filter(u => u.n >= exige));
    if (!escolha && exige && (pil[tp] || 0) >= 6 && pts.indexOf(pt) < 8) {
      if (!M.pares) { const pares = M.pares = [];
      for (const u of umas.slice().sort((a, b) => b.v - a.v).slice(0, 8)) { const S = new Set(u.cs.map(c2 => c2.join(','))); const num = numeroDaPeca(u.pecas[0].tile);
        const fim = Math.max(...u.cs.map(([x, y]) => (x - pt.fora[0]) * pt.dir[0] + (y - pt.fora[1]) * pt.dir[1]));
        const ancoras = u.cs.filter(([x, y]) => (x - pt.fora[0]) * pt.dir[0] + (y - pt.fora[1]) * pt.dir[1] === fim).map(([x, y]) => [x + pt.dir[0], y + pt.dir[1]]).concat(u.cs.flatMap(([x, y]) => [[x - pt.dir[1], y + pt.dir[0]], [x + pt.dir[1], y - pt.dir[0]]])).filter(([x, y]) => !S.has(x + ',' + y) && ok(x, y));
        const vistos2 = new Set();
        for (const tile of estoque) { if (numeroDaPeca(tile.id) === num) continue;
          for (const rot of [0, 90, 180, 270]) for (const c of tile.cells.map(c0 => girar(c0, rot))) for (const a of ancoras.slice(0, 6)) {
            const q = { tile: tile.id, pos: [a[0] - c[0], a[1] - c[1]], rot, level: LV, pilares: [] }; const cs = casasDaPeca(q);
            if (cs.some(([x, y]) => S.has(x + ',' + y)) || !cs.every(([x, y]) => ok(x, y))) continue;   // (the cheap checks first)
            const chave = cs.map(c2 => c2.join(',')).sort().join(';'); if (vistos2.has(chave)) continue; vistos2.add(chave);
            let contato = 0; cs.forEach(([x, y]) => VIZ4.forEach(([dx, dy]) => { if (S.has((x + dx) + ',' + (y + dy))) contato++; })); if (contato < 2) continue;
            const todas = u.cs.concat(cs); const n = sobre(todas); if (n < exigeMin) continue;
            pares.push({ pecas: [u.pecas[0], q], cs: todas, n, v: avancoDe(todas) + rng() }); } } } }
      escolha = melhorDe(M.pares.filter(u => u.n >= exige)); }
    if (!escolha) continue;
    // the pillars: at the corners of each tile, never where something stands below
    let semPilar = false; const usados = [];
    for (const q of escolha.pecas) {
      const soq = [...encaixesDaPeca(q)].map(v => v.split(',').map(Number)).filter(([vx, vy]) => ![[0, 0], [-1, 0], [0, -1], [-1, -1]].some(([dx, dy]) => coisas.has((vx + dx) + ',' + (vy + dy))) && !pilarEmMapa(pm, vx, vy) && !usados.some(u => u[0] === vx && u[1] === vy));
      const quer = Math.min(4, (pil[tp] || 0) - usados.length - (escolha.pecas.length - 1 - escolha.pecas.indexOf(q)) * 3); if (soq.length < 3 || quer < 3) { semPilar = true; break; }
      const escolhidos = []; while (escolhidos.length < Math.min(quer, soq.length)) { let m = null, dm = -1; soq.forEach(v => { if (escolhidos.includes(v)) return; const d = escolhidos.length ? Math.min(...escolhidos.map(q2 => Math.abs(q2[0] - v[0]) + Math.abs(q2[1] - v[1]))) : rng(); if (d > dm) { dm = d; m = v; } }); if (!m) break; escolhidos.push(m); }
      q.pilares = escolhidos.map(v => ({ pos: v, type: tp })); usados.push(...escolhidos); }
    if (semPilar) continue;
    // a ledge at its far end over the open table, for the room below
    const cs = escolha.cs; const ocup = casasOcupadas(pm, -1); cs.forEach(c => ocup.add(c.join(',')));
    const borda = cs.some(([x, y]) => VIZ4.some(([dx, dy]) => { const ex = x + dx, ey = y + dy; if (ocup.has(ex + ',' + ey)) return false; let livre = 0; for (let k = 1; k <= 4; k++) for (let l = -2; l <= 2; l++) { const ax = ex + dx * (k - 1) + (dy ? l : 0), ay = ey + dy * (k - 1) + (dx ? l : 0); if (!ocup.has(ax + ',' + ay)) livre++; } return livre >= 18; }));
    if (!borda) continue;
    // the opener: a point of interest on the ledge of C, where the walkway starts
    if (objetoLivre(pm, convivem, 'SightToken', atos) <= 0 || coisas.has(pt.casa.join(',')) || pm.salas[C].objetos.some(o => todosGatilhos(o).some(g => g.tipo === 'spawn' && (g.cells || []).some(c => c[0] === pt.casa[0] && c[1] === pt.casa[1])))) continue;   // (nothing there: no thing, no monster, no one coming)
    const melhor = escolha.pecas;
    const sobreQuais = [...new Set(cs.flatMap(([x, y]) => (pisos.get(x + ',' + y) || []).map(p2 => p2.si).filter(si => si !== C && !fora(si))))];
    const sala = { nome: '', texto: sobreQuais.length ? L2('A narrow walkway on pillars crosses high over room ' + sobreQuais.map(i => i + 1).join(', ') + ', the way you came.', 'Uma passarela estreita sobre pilares cruza bem alto por cima da sala ' + sobreQuais.map(i => i + 1).join(', ') + ', por onde vocês passaram.') : L2('A walkway on pillars runs out from the high floor, over the dark.', 'Uma passarela sobre pilares sai do piso alto, por cima do escuro.'),
      pecas: melhor, objetos: [], inimigos: [], herois: [], objetivos: [], reserva: { add: [], remove: [] }, abertaPor: [], funcao: 'exploracao', arquetipo: 'corredor', elevada: true, viaduto: sobreQuais };
    return { sala, abridor: { sala: C, objeto: { type: 'SightToken', pos: [...pt.casa], rot: 0, level: LV, name: '', textClick: '', textUse: '', gatilhos: [], requisitos: [], senao: [] } }, aoAbrir: { gatilhos: [sobreQuais.length ? txtT('From the ledge, a walkway on pillars runs out over the hall you crossed before.', 'Da borda, uma passarela sobre pilares se estende por cima do salão que vocês atravessaram antes.') : txtT('From the ledge, a walkway on pillars runs out into the dark.', 'Da borda, uma passarela sobre pilares se estende pelo escuro.')], listas: {} }, ligacao: pt, sobre: sobreQuais };
  }
  return null;
}
const pilarEmMapa = (pm, vx, vy) => pm.salas.some(s => s.pecas.some(q => (q.pilares || []).some(x => x.pos[0] === vx && x.pos[1] === vy)));
/* the change of place, as a scene: leaving the first (what the heroes see ending), finding the second (what they see now) and
   why the way goes on there (the villain's trail, the target). Every pair of places works */
const SAIDA_TEMA = {
  masmorra: [['The worked stone of the halls ends in a rough breach.', 'O corredor de pedra lavrada termina numa brecha rústica.'], ['Behind a toppled shelf, a hidden passage slopes away.', 'Atrás de uma estante tombada, uma passagem escondida desce.']],
  cripta: [['Past the last niche of bones, the crypt wall has fallen in.', 'Depois do último nicho de ossos, a parede da cripta desabou.'], ['A tomb lid lies cracked, and a draught rises from below it.', 'A tampa de um túmulo está rachada, e uma corrente de ar sobe de baixo dela.']],
  fortaleza: [['Behind the cellars of the keep, an old postern stands ajar.', 'Atrás dos porões da fortaleza, uma velha poterna está entreaberta.'], ['The last rampart gives onto a forgotten stair.', 'O último baluarte dá para uma escada esquecida.']],
  aldeia: [['Beyond the last houses, the road turns into a beaten track.', 'Depois das últimas casas, a estrada vira uma trilha batida.'], ['Under the old well, a passage runs off into the dark.', 'Sob o velho poço, uma passagem corre para o escuro.']],
  caverna: [['The cave narrows, and a cold draught blows from ahead.', 'A caverna se estreita, e uma corrente de ar frio sopra adiante.'], ['The rock gives way to something built by hands.', 'A rocha dá lugar a algo construído por mãos.']],
  ermo: [['The wind drops among the rocks, and the path goes down.', 'O vento cessa entre as rochas, e a trilha desce.'], ['A gap shows in the hillside, half hidden by brambles.', 'Uma fenda surge na encosta, meio escondida pelos espinheiros.']]
};
const CHEGADA_TEMA = {
  masmorra: [['Torchlight on carved walls: you have found a dungeon, built by hands long dead.', 'Luz de tocha em paredes entalhadas: vocês encontraram uma masmorra, erguida por mãos mortas há muito.']],
  cripta: [['Rows of sealed tombs stretch into the dark. A crypt, and something in it is awake.', 'Fileiras de túmulos selados somem no escuro. Uma cripta, e algo nela está acordado.']],
  fortaleza: [['Rotting banners hang on high walls: a forgotten keep rises before you.', 'Estandartes podres pendem de muralhas altas: uma fortaleza esquecida se ergue diante de vocês.']],
  aldeia: [['Smoke, shutters, empty lanes: a village, far too quiet.', 'Fumaça, janelas fechadas, ruas vazias: uma aldeia, quieta demais.']],
  caverna: [['The rock opens into a vast cave; water drips somewhere far below.', 'A rocha se abre numa caverna imensa; água pinga em algum lugar lá embaixo.']],
  ermo: [['Daylight at last: the open wilds, and fresh tracks in the mud.', 'Luz do dia, enfim: o ermo aberto, e rastros frescos na lama.']]
};
const GANCHO_TEMA = [['The trail of {vilao} leads on, in there.', 'O rastro de {vilao} segue por ali.'], ['If {vilao} hides anywhere, it is here.', 'Se {vilao} se esconde em algum lugar, é aqui.'], ['There is no other way: {alvo} lies ahead.', 'Não há outro caminho: {alvo} fica adiante.']];
function textoDaTransicao(t, plano, rng) {
  const um = l => { const x = rng.pick(l || [['', '']]); return L2(x[0], x[1]); };
  return preencher(um(SAIDA_TEMA[t.de]) + ' ' + um(CHEGADA_TEMA[t.para]) + ' ' + um(GANCHO_TEMA), plano.vocab);
}
// ------------------------------------------------------------ the rhythm of the fights, and the villain on stage
/* never more than two rooms of the way in a row without a monster, and always one in the second room (the one after the
   opening): a room that has none gets one (or two) from the pool. Such a monster tells something of the story when it falls:
   a note, a last word, a token of the villain */
const PISTAS_DO_MONSTRO = [
  ['In its pouch, a crumpled note: "{vilao} wants it all done before nightfall. Nobody leaves."', 'Na bolsa da criatura, um bilhete amassado: «{vilao} quer tudo pronto antes do anoitecer. Ninguém sai.»'],
  ['With its last breath it hisses: "{vilao}... is waiting for you... deeper in..."', 'No último suspiro, a criatura sibila: «{vilao}... espera vocês... mais para dentro...»'],
  ['Around its neck hangs a medallion with the mark of {vilao}. It is still warm.', 'No pescoço dela pende um medalhão com a marca de {vilao}. Ainda está morno.'],
  ['Among its things, a scrap of map: an arrow points deeper, toward {alvo}.', 'Entre as coisas dela, um pedaço de mapa: uma seta aponta mais fundo, rumo a {alvo}.'],
  ['Its claws are stained with fresh ash. Whatever {vilao} is doing, it is happening now.', 'As garras dela estão sujas de cinza fresca. O que quer que {vilao} esteja fazendo, está acontecendo agora.'],
  ['Before it falls it laughs: "You are too late. {vilao} already has {alvo}."', 'Antes de cair, ela ri: «Vocês chegaram tarde. {vilao} já tem {alvo}.»']];
function temMonstro(pm, si) { const s = pm.salas[si]; if (!s) return false; if ((s.inimigos || []).length) return true;
  if (s.objetos.some(o => todosGatilhos(o).some(g => g.tipo === 'spawn'))) return true;
  const ab = abridorDe(pm, si); return !!(ab && Object.keys(ab.o).some(k => Array.isArray(ab.o[k]) && ab.o[k].some(g => g.tipo === 'spawn' && (g.cells || []).some(c => chaoDaSala(si, pm).has(c[0] + ',' + c[1]))))); }
function ritmoDasLutas(pm, plano, rng, salasDe) {
  const eixo = salasDe.eixo; const feitas = []; const pistas = rng.embaralhar(PISTAS_DO_MONSTRO.slice());
  const pista = () => { const x = pistas.shift() || rng.pick(PISTAS_DO_MONSTRO); return gatilhoTexto(preencher(L2(x[0], x[1]), plano.vocab)); };
  const darMonstro = si => { const s = pm.salas[si]; const n = (s.funcao === 'respiro' ? 1 : rng.int(1, 2)); const casas = casasParaFiguras(pm, si, n, rng, { distancia: [2, 9], padrao: 'fundo' }); if (!casas.length) return false;
    s.inimigos = (s.inimigos || []).concat(casas.map(c => ({ enemy: POOL_ID, pos: [c.x, c.y], level: c.nivel || 0 }))); s.intensidade = Math.max(1, s.intensidade || Math.max(1, plano.base - 2));
    const gp = grupoPoolDe(s); gp.gatilhos = (gp.gatilhos || []).concat([pista()]); feitas.push(si); return true; };
  // the second room: a monster, always (one that tells something when it falls)
  if (eixo[1] != null) { if (!temMonstro(pm, eixo[1])) darMonstro(eixo[1]);
    else { const s = pm.salas[eixo[1]]; const pool = (s.inimigos || []).some(e => ehPool(e.enemy)); if (pool) { const gp = grupoPoolDe(s); gp.gatilhos = (gp.gatilhos || []).concat([pista()]); }
      else { const e = (s.inimigos || []).slice(-1)[0]; if (e) e.gatilhos = (e.gatilhos || []).concat([pista()]); } } }
  // never three in a row without one (the opening counts as one without)
  let seguidas = 0;
  eixo.forEach((si, k) => { if (temMonstro(pm, si)) { seguidas = 0; return; } seguidas++; if (seguidas >= 3 && pm.salas[si].funcao !== 'climax') { if (darMonstro(si)) seguidas = 0; } });
  return feitas;
}
/* the villain on stage: when the last room opens, a scene that calls back what the heroes heard at the start (the warning of
   the opening, in its own words), the villain in its own voice (by its kind: a cult, the dead, a band, beasts, a legion) and
   a hero who answers; when it falls, its last words */
const VOZ_DO_VILAO = {
  culto: { fala: [['You came all this way to watch? Then watch: I have taken {alvo}, and what I woke will not sleep again.', 'Vieram até aqui para assistir? Então assistam: tomei {alvo}, e o que eu despertei não volta a dormir.'], ['Kneel, and you may yet be spared. No? Then you will be the last offering.', 'Ajoelhem-se, e talvez sejam poupados. Não? Então serão a última oferenda.']],
    queda: [['"The rite... was almost..." {vilao} collapses, and the chanting in the dark falls silent.', '«O rito... estava quase...» {vilao} desaba, e os cânticos no escuro se calam.']] },
  mortos: { fala: [['The living always run. And they always end here, with me.', 'Os vivos sempre correm. E sempre acabam aqui, comigo.'], ['I have waited longer than your kingdoms have stood. I can wait for your corpses too.', 'Esperei mais do que os seus reinos existem. Posso esperar pelos seus cadáveres também.']],
    queda: [['{vilao} crumbles to dust, and the cold that filled the place begins to lift.', '{vilao} se desfaz em pó, e o frio que enchia o lugar começa a ceder.']] },
  bandidos: { fala: [['Stubborn lot. I like that: it will be worth more to bury you.', 'Gente teimosa. Gosto disso: vai valer mais enterrar vocês.'], ['You want {alvo}? Come and take it. Nobody leaves my den alive.', 'Querem {alvo}? Venham pegar. Ninguém sai vivo do meu covil.']],
    queda: [['{vilao} drops to the floor with a curse, and the rest of the band scatters into the dark.', '{vilao} cai ao chão com um palavrão, e o resto do bando se espalha no escuro.']] },
  feras: { fala: [['(A growl so deep the walls tremble. {vilao} lowers its head, eyes fixed on you.)', '(Um rosnado tão fundo que as paredes tremem. {vilao} baixa a cabeça, os olhos cravados em vocês.)']],
    queda: [['{vilao} lets out one last howl and falls still. Silence, at last.', '{vilao} solta um último uivo e fica imóvel. Silêncio, enfim.']] },
  legiao: { fala: [['Shields up! No one passes {vilao}. No one.', 'Escudos ao alto! Ninguém passa por {vilao}. Ninguém.'], ['You fought well to get here. It changes nothing.', 'Vocês lutaram bem para chegar até aqui. Isso não muda nada.']],
    queda: [['{vilao} sinks to one knee, banner in hand, and falls without a word.', '{vilao} cai de joelhos, com o estandarte na mão, e tomba sem uma palavra.']] }
};
/* a name met before, told again: its indefinite article made definite (a runaway novice → the runaway novice; uma corda → a corda) */
const comoJaVisto = nome => { const m = /^(A|An|Some|Um|Uma|Uns|Umas)\s+(.*)$/.exec(nome || ''); if (!m) return nome || '';
  return ({ A: 'the', An: 'the', Some: 'the', Um: 'o', Uma: 'a', Uns: 'os', Umas: 'as' })[m[1]] + ' ' + m[2]; };
/* the villain's answer to the anchor: to the person who talked, or to the trace it left */
const REACAO_DO_VILAO = { npc: [['So {quem} talked. I should have finished that job.', 'Então {quem} falou. Eu devia ter terminado aquele serviço.'], ['{quem} sent you? Then {quem} sent you to die.', '{quem} mandou vocês? Então mandou vocês para morrer.']],
  guia: [['So you brought {quem} all the way to me. The journey ends here.', 'Então vocês trouxeram {quem} até mim. A viagem termina aqui.']],
  pista: [['You followed {marca} all the way here. Clever. It ends now.', 'Vocês seguiram {marca} até aqui. Espertos. Isso acaba agora.'], ['I left {marca} behind, and you read it. A pity for you.', 'Deixei {marca} para trás, e vocês souberam ler. Pena para vocês.']] };
const RESPOSTAS_DOS_HEROIS = [['Then this ends here.', 'Então isso acaba aqui.'], ['We did not come this far to turn back now.', 'Não chegamos até aqui para voltar agora.'], ['Enough talk. Get ready.', 'Chega de conversa. Preparem-se.']];
function frasesDe(t) { return (t || '').replace(/\s+/g, ' ').match(/[^.!?…]+[.!?…]+["»”]?/g) || []; }
/* the way on waits for the guide: the opener of the second room asks the party to talk to the guide first */
function travaDoGuia(ab1, vivo, X) {
  if (!ab1 || ab1.o['senao:' + ab1.g.uid] || (ab1.g.requisitos || []).some(r => r.tipo === 'counter' && r.contador === vivo.nome)) return;
  ab1.g.requisitos = (ab1.g.requisitos || []).concat([{ tipo: 'counter', contador: vivo.nome, meta: 1 }]);
  ab1.o['senao:' + ab1.g.uid] = [txtT('Talk to ' + X + ' before going on.', 'Falem com ' + X + ' antes de seguir.')]; ab1.o.acaoExtra = { ...(ab1.o.acaoExtra || {}), ['senao:' + ab1.g.uid]: true };
}
function cenaDoChefe(pm, plano, rng, si) {
  const ab = abridorDe(pm, si); if (!ab) return false; const v = plano.rival ? { ...plano.vocab, vilao: plano.rival } : plano.vocab; const vil = v.vilao || '';
  // (the warning of the start, in its own words: the sentence that names the villain, else the one of the target, else the first)
  const frases = frasesDe(plano.historiaInicial || (pm.meta.intro || '').split('\n\n')[0] || '');   /* (with no story in the first room, the intro of the map) */ const eco = (frases.find(f => vil && f.includes(vil)) || frases.find(f => v.alvo && f.includes(v.alvo)) || frases[0] || '').trim();
  const fac = VOZ_DO_VILAO[plano.premissa.faccao] || VOZ_DO_VILAO.culto; const um = l => { const x = rng.pick(l); return preencher(L2(x[0], x[1]), v); };
  const nome = vil ? vil.charAt(0).toUpperCase() + vil.slice(1) : L2('The enemy', 'O inimigo');
  // (the climax answers the anchor: who or what told the story at the start, in its words, and the answer standing here)
  const an = plano.roteiro?.abertura; const quem = an && an.nome ? comoJaVisto(an.nome) : '';
  const resposta = vil ? L2(' Now the answer stands before you: ' + vil + '.', ' Agora a resposta está diante de vocês: ' + vil + '.') : L2(' Now you see it with your own eyes.', ' Agora vocês veem com os próprios olhos.');
  const lembra = eco && quem ? contrair(an.npc ? L2('At the start, ' + quem + ' warned you: "' + eco + '"', 'Lá no começo, ' + quem + ' avisou: «' + eco + '»') : L2('At the start, by ' + quem + ', the warning was clear: "' + eco + '"', 'Lá no começo, diante de ' + quem + ', o aviso foi claro: «' + eco + '»')) + resposta
    : eco ? L2('At the start, the warning was clear: "' + eco + '" Now you see it with your own eyes.', 'Lá no começo, o aviso foi claro: «' + eco + '» Agora vocês veem com os próprios olhos.') : L2('At last, the one behind it all.', 'Enfim, quem está por trás de tudo.');
  // (the villain answers it too: it knows who talked, or what it left behind)
  const R = quem && plano.premissa.faccao !== 'feras' ? REACAO_DO_VILAO[an.familia === 'escolta' ? 'guia' : an.npc ? 'npc' : 'pista'] : null; const reacao = R ? preencher(L2(...rng.pick(R)), { quem, marca: quem }) + ' ' : '';
  const cx = (id, speaker, title, text, next) => ({ id, type: 'normal', speaker, title, text, cast: speaker === '@hero1' ? [] : ['@hero1'], background: FUNDO_PADRAO, next, options: [] });
  const cena = { uid: uid(), tipo: 'scene', primeiraVez: 'chefe', inicio: 'c1', requisitos: clone(ab.g.requisitos || []), caixas: [cx('c1', '', '', lembra, 'c2'), cx('c2', '', nome, reacao + um(fac.fala), 'c3'), cx('c3', '@hero1', '', um(RESPOSTAS_DOS_HEROIS), '')] };
  ab.o.gatilhos = (ab.o.gatilhos || []).concat([cena]);
  // its last words, when it falls
  const alvo = plano.chefe?.alvo; if (alvo) alvo.gatilhos = (alvo.gatilhos || []).concat([gatilhoTexto(um(fac.queda))]);
  return true;
}
const MURO_MAX = 2;   // (squares of the vault's wall from the ladder to the jump; farther only in the rare long walk, with its risk of falling)
/* the long walk on the wall of the vault (rare, on purpose): a point of interest where the ladder reaches the top tells the
   danger as a scene (two heroes look down) and the rule: each move on the wall is a maneuver; with fewer than 2 successes, the
   hero falls back to the floor of the vault */
function muroArriscado(pm, plano, rng, si, topo) {
  const s = pm.salas[si]; if (objetoLivre(pm, [si], 'SightToken', plano.atos) <= 0) return false;
  const ch = chaoDaSala(si, pm); const ocupadas = new Set(s.objetos.flatMap(o => casasDoObjeto(o)).map(c => c.join(',')));
  const casa = [topo].concat(VIZ4.map(([dx, dy]) => [topo[0] + dx, topo[1] + dy])).find(([x, y]) => ch.get(x + ',' + y)?.muro && !ocupadas.has(x + ',' + y)); if (!casa) return false;
  const lv = ch.get(casa.join(',')).nivel;
  const cx = (id, quem, outro, t, next) => ({ id, type: 'normal', speaker: quem, title: '', text: t, cast: [outro], background: FUNDO_PADRAO, next, options: [] });
  const cena = { uid: uid(), tipo: 'scene', inicio: 'm1', requisitos: [], caixas: [
    cx('m1', '@hero1', '@hero2', L2('The top of the wall is barely a hand wide, and the stones shift under my boots.', 'O alto do muro tem um palmo de largura, e as pedras se mexem sob as minhas botas.'), 'm2'),
    cx('m2', '@hero2', '@hero1', L2('Don\'t look down. One step at a time, and keep your balance.', 'Não olhem para baixo. Um passo de cada vez, e mantenham o equilíbrio.'), 'm3'),
    cx('m3', '@hero1', '@hero2', L2('If one of us slips, it is a long way back to the floor.', 'Se um de nós escorregar, é uma longa queda de volta para o chão.'), '')] };
  s.objetos.push({ type: 'SightToken', pos: casa, rot: 0, level: lv, name: L2('The narrow wall', 'O muro estreito'), textClick: '', textUse: '', requisitos: [], senao: [],
    gatilhos: [cena, txtT('Walking on the wall: every move a hero makes up here is a maneuver. Test Agility for each one: with fewer than 2 successes, the hero falls and goes back to the floor of the vault (at the foot of the ladder).', 'Andar sobre o muro: cada movimento de um herói aqui em cima é uma manobra. Façam um teste de Agilidade a cada uma: com menos de 2 sucessos, o herói cai e volta para o chão da cripta (ao pé da escada).'), autoRemocao()] });
  return true;
}
/* the sealed vault: three treasures, one to take (the others sink away); the door opens with a key found elsewhere */
function cofre(pm, plano, rng, si, salasDe, notas) {
  const s = pm.salas[si]; const ab = abridorDe(pm, si); if (!ab || (travasDe(ab.o, ab.g) || []).length) return false;
  // the pedestals: what the room already has (a chest, a lectern, a token, a table), then new ones where they fit
  const podeSer = o => !ehTerreno(o) && !o._narrador && ['Chest', 'Lectern', 'InteractToken', 'StoneTable', 'RoundTable', 'Statue', 'Shelf', 'Well', 'Cauldron'].includes(baseObj(o.type)) && !todosGatilhos(o).some(g => ['open_room', 'counter', 'spawn', 'rounds'].includes(g.tipo));
  const postos = s.objetos.map((o, oi) => oi).filter(oi => podeSer(s.objetos[oi])).slice(0, 3); const novos = [];
  for (const t of ['Lectern', 'Chest', 'InteractToken', 'InteractToken', 'StoneTable', 'Statue', 'RoundTable', 'Cauldron']) { if (postos.length >= 3) break; const oi = daCaixa(t, plano.atos) ? colocarNaSala(pm, si, t, rng) : null;   /* (the box spent of chests and tokens: a table, a statue, a cauldron serve as pedestals) */ if (oi != null) { postos.push(oi); novos.push(oi); } }
  if (postos.length < 2) { novos.sort((a, b) => b - a).forEach(oi => s.objetos.splice(oi, 1)); return false; }
  postos.forEach(oi => { const o = s.objetos[oi]; todosGatilhos(o).forEach(x => Object.keys(o).forEach(k => { if (k.endsWith(':' + x.uid)) delete o[k]; })); delete o.usos; delete o.acaoExtra; });
  const premios = [[L2('a rune-etched blade on a pedestal', 'uma lâmina gravada com runas num pedestal'), [itemNovo(), itemNovo()]], [L2('a heavy chest of coins', 'um baú pesado de moedas'), [ouroDe(80)]], [L2('a flask of shining water', 'um frasco de água brilhante'), [txtT('Every hero heals fully and discards all fatigue.', 'Cada herói cura tudo e descarta toda a fadiga.')]]];
  postos.forEach((oi, k) => { const o = s.objetos[oi]; const [olhar, dar] = premios[k % premios.length]; o.textClick = L2('On a pedestal: ' + olhar + '. Take one, and the others sink away.', 'Num pedestal: ' + olhar + '. Peguem um, e os outros afundam.');
    o.gatilhos = [txtT('As you lift it, the other pedestals sink into the floor.', 'Ao erguê-lo, os outros pedestais afundam no chão.')].concat(clone(dar), postos.filter(x => x !== oi).map(x => ({ uid: uid(), tipo: 'remove_object', objSala: si, objIndex: x, requisitos: [] }))); });
  s.textoDepois = ((s.textoDepois || '') + ' ' + L2('Three pedestals stand in a circle; the floor around them is cut with deep grooves.', 'Três pedestais formam um círculo; o chão em volta tem sulcos fundos.')).trim();
  // the key: somewhere else on the table, never behind this door nor behind another lock
  const fora = descendentes(pm, si); fora.add(si); const gr = i => (plano.grupo || {})[i] || 0; const hosts = salasDoModo(pm, plano, salasDe, salasDe.eixo[salasDe.eixo.length - 1], true).filter(i => !fora.has(i) && gr(i) === gr(si)).concat((plano.grupo?.[0] || 0) === (plano.grupo?.[si] || 0) ? [0] : []);
  const col = coletor(pm, rng, notas, n => rng.embaralhar(hosts.slice()).slice(0, n), si);
  const chave = col(L2('Vault key', 'Chave da câmara'), L2('Vault key', 'Chave da câmara'), 1, ['InteractToken', 'Chest', 'Lectern', 'StoneTable', 'Shelf'], L2('A key of black iron, cold as a grave.', 'Uma chave de ferro negro, fria como um túmulo.'), L2('A vault door without a handle. A black iron key fits here.', 'Uma porta de câmara sem maçaneta. Uma chave de ferro negro serve aqui.'), L2('Find the vault key (optional)', 'Achem a chave da câmara (opcional)'), null,
    { olhar: L2('A small niche in the wall, with something inside.', 'Um nicho pequeno na parede, com algo dentro.'), revela: L2('A small niche opens in one wall.', 'Um nicho pequeno se abre numa das paredes.') });
  if (!(pm.contadores || []).includes(chave)) { novos.sort((a, b) => b - a).forEach(oi => s.objetos.splice(oi, 1)); postos.filter(oi => !novos.includes(oi)).forEach(oi => { s.objetos[oi].gatilhos = []; }); return false; }   // no room for the key: no vault
  ab.o.textClick = L2('A vault door without a handle.', 'Uma porta de câmara sem maçaneta.');
  return true;
}

/* the map of a seed: the plan is fixed by the seed; the building is tried again (other rooms) when rooms did not fit */
function gerarMapa(o) {
  let melhor = null;
  // (five tries: four on a compact table, the last one loose; of those that miss rooms, the one that misses fewest, then the
  // smallest table)
  for (let k = 0; k < 5; k++) {
    const r = montarMapa(o, k); if (r.erro) { melhor = melhor || r; continue; }
    const falta = r.plano.batidas.length - r.projeto.salas.length; const area = areaDaMesa(r.projeto, r.plano);
    if (!melhor || melhor.erro || falta < melhor._falta || (falta === melhor._falta && area < melhor._area)) { melhor = r; r._falta = falta; r._area = area; }
    if (falta <= 0) break;
  }
  if (melhor) { delete melhor._falta; delete melhor._area; }
  return melhor;
}
/* the largest table a map asks for: the outline of the biggest set of rooms on the table at once */
function areaDaMesa(pm, plano) {
  const g = plano.grupo || {}; let A = 0;
  [...new Set(pm.salas.map((s, k) => g[k] || 0))].forEach(gg => { let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    pm.salas.forEach((s, k) => { if ((g[k] || 0) !== gg) return; s.pecas.forEach(q => casasDaPeca(q).forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); })); });
    if (x1 >= x0) A = Math.max(A, (x1 - x0 + 1) * (y1 - y0 + 1)); });
  return A;
}
function montarMapa(o, tentativa) {
  const plano = planejarMapa(o); if (tentativa) plano.semente = o.semente + '~' + tentativa;
  // (the later tries leave out the extras that eat room: the bridge nobody asked for, the jumps from a ledge)
  if (tentativa >= 2) { if (!o.ponte) plano.batidas.forEach(b => { delete b.ponte; }); plano.semSaltos = true; }
  // (the last try lays the rooms loose, as before the compact table: more free edges for the rooms ahead)
  if (tentativa >= 4) plano.solto = true;
  const rng = rngDe(o.semente + '#mapa' + (tentativa ? '~' + tentativa : '')); const notas = [];
  const pm = projetoNovo(); pm.meta.author = projeto.meta.author || ''; pm.reserva = (o.manterPool && projeto.reserva) ? projeto.reserva.slice() : []; pm.itensPool = ((o.manterItens ?? o.manterPool) && projeto.itensPool) ? projeto.itensPool.slice() : [];
  if (!campanha) pm.bestiario = clone(projeto.bestiario || oficinaVazia());   // the workshop of the map on screen comes along
  const antes = projeto; projeto = pm; const testesAntes = DIFICULDADE_TESTES; DIFICULDADE_TESTES = { dif: o.dificuldade || 'normal', atos: plano.atos };
  try {
    const chefe = prepararPool(pm, plano.premissa.faccao, rng, plano.atos, plano.dificuldade);
    prepararItens(pm, plano.atos);
    const chefeReal = chefe && rng() < 0.05 ? chefe : null; if (chefeReal) plano.vocab.vilao = chefeReal.nome;
    const salasDe = { eixo: [], lado: [] }; plano.eixoFeito = salasDe.eixo;
    // the sets of rooms between points of no return: 0 (from the start), 1 (after the first point), 2… Passing a point takes
    // the set before it off the table. A room shares its tiles and pieces only with the rooms of its own set
    const grupo = {}; plano.grupo = grupo; plano.pontos = []; let atual = 0;
    Object.defineProperty(pm, '_grupo', { value: grupo, configurable: true }); Object.defineProperty(pm, '_plano', { value: plano, configurable: true });
    // half the medium and long maps wind in a spiral: the way keeps turning the same side, and the end comes back near the start
    { const re = rngDe(o.semente + '#espiral'); plano.espiral = o.duracao !== 'curta' && re() < 0.5 ? (re() < 0.5 ? 1 : -1) : 0; } Object.defineProperty(pm, '_atos', { value: plano.atos, configurable: true });
    // the room tokens the other maps of the campaign already show come last (the same wounded traveller in every map)
    const evitar = new Set(); if (typeof campanha !== 'undefined' && campanha) (campanha.missoes || []).forEach(m => (m?.salas || []).forEach(s => (s.objetos || []).forEach(x => { if (x.textClick) evitar.add(x.textClick); })));
    Object.defineProperty(pm, '_evitarFichas', { value: evitar, configurable: true });
    const doGrupo = g => pm.salas.map((x, i) => i).filter(i => (grupo[i] || 0) === g);
    const podePonto = () => plano.premissa.id !== 'resgate' && plano.truque?.id !== 'resgate' && plano.truque?.id !== 'escolta' && plano.pontos.length < 3 && doGrupo(atual).length >= 2;
    const ehCripta = i => i != null && !!pm.salas[i]?.pecas.some(q => q.tile === 'vault');
    const rngSalto = rngDe(o.semente + '#saltos');
    // (the detours of the rooms before a point of no return are laid before it: once past it, the rooms ahead take the space
    // around those left behind)
    const eixoB = plano.batidas.filter(x => x.papel === 'eixo'), ladoB = plano.batidas.filter(x => x.papel === 'lado'); const ordem = [];
    eixoB.forEach((x, j) => { if (x.semRetorno && j > 0) ladoB.filter(l => !ordem.includes(l) && typeof l.pai === 'number' && l.pai < j).forEach(l => ordem.push(l)); ordem.push(x); });
    ladoB.filter(l => !ordem.includes(l)).forEach(l => ordem.push(l));
    for (const b of ordem) {
      if (b.papel === 'lado') b.pai = (b.pai <= salasDe.eixo.length - 1 && b.pai <= eixoB.length - 2 ? salasDe.eixo[b.pai] : null) ?? salasDe.eixo[Math.min(salasDe.eixo.length - 2, b.pai)] ?? salasDe.eixo[0];   // (never from the last room of the way)
      // after the vault (walls at level 2 all round, no door): nothing hangs at its side at ground level. The way goes on over
      // its wall: a medium ladder inside climbs to the top of the wall, and from there the heroes jump down into the next room,
      // laid against the vault (a point of no return: nobody climbs back without a ladder). With no room for that, runes in
      // the vault carry the heroes to the next room, laid apart
      if (b.papel === 'lado' && ehCripta(b.pai)) continue;
      // the viaduct: a walkway over a room walked before, from the raised part of the last room; the next room lies below its
      // far end (a jump down). With no room for it, a plain corridor stands in
      if ((b.viaduto || b.viadutoTarde) && b.papel === 'eixo') { const C = salasDe.eixo[salasDe.eixo.length - 1];
        // (the way down from its far end: a medium ladder in the next room, up to the walkway, so the heroes may come back)
        const pode = C != null && !plano.solto && daCaixa('LadderMedium', plano.atos) && objetoLivre(pm, doGrupo(atual), 'LadderMedium', plano.atos) > 0;
        // (first over a room walked before; with none in reach, the next room of the way tries again, from a room raised for it;
        // the last try may go out over the open table)
        const prox = plano.batidas.slice(plano.batidas.indexOf(b) + 1).find(x => x.papel === 'eixo');
        const adiar = b.viaduto && prox && !['climax'].includes(prox.funcao) && !prox.semRetorno && !prox.solta && !prox.transicao && !prox.simples && (prox.tema || plano.tema) !== 'ermo';
        let cv = pode ? viadutoSobre(pm, plano, rng, C, doGrupo(atual), 2, [3, 2], b.tema || plano.tema) : null;
        if (!cv && pode && !adiar) cv = viadutoSobre(pm, plano, rng, C, doGrupo(atual), 2, [0], b.tema || plano.tema);
        if (!cv && adiar) { prox.viadutoTarde = true; delete b.viaduto; b.alto = true; b.altoParaViaduto = true; b.arquetipo = 'exploracao'; b.tamanhoMin = 'M'; b.reservaPilar = 3; }
        if (cv) { b.pai = C; const si = juntarSala(pm, cv); b.sala = si; salasDe.eixo.push(si); grupo[si] = atual; pm.salas[si].funcao = b.funcao; plano.ultimaDir = cv.ligacao.dir; plano.viadutos = (plano.viadutos || []).concat([si]);
          const prox = plano.batidas.slice(plano.batidas.indexOf(b) + 1).find(x => x.papel === 'eixo');
          if (prox && !prox.semRetorno && !prox.solta) prox.desceDoViaduto = si;
          continue; } }
      let escadaCripta = null;
      if (b.papel === 'eixo' && ehCripta(b.pai ?? salasDe.eixo[salasDe.eixo.length - 1])) { b.pai = b.pai ?? salasDe.eixo[salasDe.eixo.length - 1]; b.semRetorno = true; b.deCripta = true;
        // (the way out leaves from the wall near the ladder: two squares of wall at most. Now and then, a long walk on the
        // wall, on purpose: a scene, and a test of agility for each move there)
        const bordas = pontosDeLigacao(pm, true).filter(pt => pt.sala === b.pai && pt.nivel > 0);
        const longo = rngDe(plano.semente + '#muro')() < 0.12;
        const sv = pm.salas[b.pai]; const mu = sv.pecas.some(q => q.tile === 'vault') ? murosDaPeca(sv.pecas.find(q => q.tile === 'vault')) : null;
        const medir = li => { const m = muroDaEscada(sv.objetos[li], mu); return { ...m, perto: bordas.filter(pt => (m.dist.get(pt.casa.join(',')) ?? 99) <= MURO_MAX) }; };
        escadaCripta = escadaNaCripta(pm, b.pai, (plano.chegada || {})[b.pai] || [], longo ? [] : bordas.map(pt => pt.casa));
        // (the jump at most MURO_MAX squares of wall from the ladder: the ladder tried beside each ledge, the one with the most
        // ledges near it kept)
        if (escadaCripta != null && !longo && mu) { let m = medir(escadaCripta);
          for (const pt of bordas.slice(0, 12)) { if (m.perto.length >= 3) break; const lad = sv.objetos.splice(escadaCripta, 1)[0];
            const k = escadaNaCripta(pm, b.pai, (plano.chegada || {})[b.pai] || [], [pt.casa]); if (k == null) { sv.objetos.splice(escadaCripta, 0, lad); continue; }
            const m2 = medir(k); if (m2.perto.length > m.perto.length) { escadaCripta = k; m = m2; } else { sv.objetos.splice(k, 1); sv.objetos.splice(escadaCripta, 0, lad); } } }
        if (escadaCripta != null) { b.estilo = 'salto'; delete b.solta;
          const { topo, dist, perto } = medir(escadaCripta);
          const longe = bordas.filter(pt => (dist.get(pt.casa.join(',')) ?? 0) >= 6 && dist.has(pt.casa.join(',')));
          const escolha = longo && longe.length ? longe : perto.length ? perto : null;
          b.pontosMuro = new Set((escolha || []).map(pt => pt.casa.join(','))); b.muroLongo = escolha && escolha === longe ? { topo, dist } : null; }
        else b.solta = 'teleporte'; }
      // a raised part is a passage, not a dead end: after a room of the way with a ledge, now and then the next room lies
      // beyond the ledge (up by the ladder on one side, a jump down on the other: a point of no return, since nobody climbs
      // back without a ladder). Its own draws
      // (a gimmick or a premise of pieces hides its things past the last point: then only one point, early, as the plan does)
      const juntaPecas = !!plano.truque || ['carga', 'pocos', 'refugio'].includes(plano.premissa.id);
      const eixos = plano.batidas.filter(x => x.papel === 'eixo'); const ie = eixos.indexOf(b);
      const cedo = juntaPecas ? !eixos.some(x => x !== b && x.semRetorno) && ie <= Math.max(2, Math.floor((eixos.length - 1) / 2)) : ie <= eixos.length - 2;
      if (b.papel === 'eixo' && !plano.semSaltos && !b.semRetorno && !b.deCripta && b.funcao !== 'climax' && cedo && salasDe.eixo.length && plano.pontos.length < 2 && podePonto() && plano.batidas.slice(plano.batidas.indexOf(b) + 1).filter(x => x.papel === 'eixo').length >= 2 && doGrupo(atual).some(i => (pm.salas[i].inimigos || []).length || pm.salas[i].grupoPool) && rngSalto() < (plano.atos === 2 ? 0.5 : 0.35)) {   // (at most two points of no return of this kind in a map)
        const pai = b.pai ?? salasDe.eixo[salasDe.eixo.length - 1];
        if (pm.salas[pai]?.pecas.some(q => (q.level || 0) > 0 && !ehAlfombra(q.tile)) && pontosDeLigacao(pm, true).some(pt => pt.sala === pai && pt.nivel > 0)) { b.semRetorno = true; b.estilo = 'salto'; b.saltoDaBorda = true; }
      }
      const alvo = b.papel === 'eixo' ? atual : (grupo[b.pai] || 0);
      // a point of no return: the rooms behind leave the table before its tiles are laid (as in the game), so it may use them
      const ponto = () => b.semRetorno && b.papel === 'eixo' && (podePonto() || (b.forcaPonto && plano.pontos.length < 3));
      let c = salaDoPlano(pm, b, plano, rng, notas, { convivem: ponto() ? [] : doGrupo(alvo), permitidos: doGrupo(alvo), ponto: ponto() });
      // (over the wall of the vault found no room: the ladder goes back to the box, and runes instead)
      if (b.deCripta && escadaCripta != null && (!c || c.abridor?.sala !== b.pai)) { if (!c) notas.pop(); pm.salas[b.pai].objetos.splice(escadaCripta, 1); escadaCripta = null;
        delete b.estilo; b.solta = 'teleporte'; c = salaDoPlano(pm, b, plano, rng, notas, { convivem: ponto() ? [] : doGrupo(alvo), permitidos: doGrupo(alvo), ponto: ponto() }); }
      if (!c && b.saltoDaBorda) { notas.pop(); b.semRetorno = false; delete b.estilo; delete b.saltoDaBorda; c = salaDoPlano(pm, b, plano, rng, notas, { convivem: doGrupo(alvo), permitidos: doGrupo(alvo), ponto: false }); }
      // the parent has edges only up on its raised part: the next room lies beyond the ledge (a jump down, a point of no return,
      // even when the parent is the only room of its set)
      if (!c && b.papel === 'eixo' && !b.semRetorno && !plano.semSaltos && plano.pontos.length < 3 && salasDe.eixo.length && pontosDeLigacao(pm, true).some(pt => pt.sala === (b.pai ?? salasDe.eixo[salasDe.eixo.length - 1]) && pt.nivel > 0)) {
        notas.pop(); b.semRetorno = true; b.estilo = 'salto'; b.saltoDaBorda = true; b.forcaPonto = true;
        c = salaDoPlano(pm, b, plano, rng, notas, { convivem: [], permitidos: doGrupo(alvo), ponto: true });
        if (!c) { b.semRetorno = false; delete b.estilo; delete b.saltoDaBorda; delete b.forcaPonto; } }
      // the box ran out of pieces along the way: a point of no return here gives back those of the rooms behind
      if (!c && b.papel === 'eixo' && !b.semRetorno && podePonto() && !estoquePecas(pm, plano.tema, -1, plano.atos, doGrupo(alvo)).length) {
        b.semRetorno = true; notas.pop(); c = salaDoPlano(pm, b, plano, rng, notas, { convivem: [], permitidos: doGrupo(alvo) }); if (!c) b.semRetorno = false; }
      if (!c) { if (b.papel === 'eixo' && b.funcao === 'climax' && salasDe.eixo.length) notas.push(L2('The climax did not fit: the last room built ends the map.', 'O clímax não coube: a última sala construída encerra o mapa.')); continue; }
      if (c.abridor) b.pai = c.abridor.sala;
      if (b.papel === 'eixo' && c.ligacao?.dir) plano.ultimaDir = c.ligacao.dir;
      const si = juntarSala(pm, c); b.sala = si;
      // (where the heroes land after a point of no return: the openers set in it later leave them squares to stand on)
      if (b.semRetorno) Object.defineProperty(pm.salas[si], '_pouso', { value: true, enumerable: false, configurable: true });
      // (below the far end of the walkway: a medium ladder up to it, from the square in front)
      if (b.desceDoViaduto != null && c.ligacao && (c.ligacao.nivel || 0) === 2 && c.abridor?.sala === b.desceDoViaduto) { const lg = c.ligacao; const s = pm.salas[si];
        const rot = [[1, 0], [0, 1], [-1, 0], [0, -1]].findIndex(([ux, uy]) => ux === -lg.dir[0] && uy === -lg.dir[1]) * 90;
        const livre = !s.objetos.some(o => casasDoObjeto(o).some(([x, y]) => x === lg.fora[0] && y === lg.fora[1])) && !(s.inimigos || []).some(e => e.pos[0] === lg.fora[0] && e.pos[1] === lg.fora[1]);
        if (livre) { s.objetos.push({ type: 'LadderMedium', pos: [...lg.fora], rot, level: 0, name: '', textClick: '', textUse: '', gatilhos: [], requisitos: [], senao: [] }); s.herois = (s.herois || []).filter(h => !(h[0] === lg.fora[0] && h[1] === lg.fora[1])); } }
      // the token of whoever tells the story (or of the guide) is set aside now, while the box still has tokens (a long map
      // used them all before the story was told)
      if (si === 0) { const oi = colocarNaSala(pm, 0, 'InteractToken', rng); if (oi != null) Object.defineProperty(pm.salas[0].objetos[oi], '_reservado', { value: true, enumerable: false, configurable: true }); }
      // a room laid apart: its hero spaces become where the heroes arrive; the trapdoor (or the runes) stands in the parent
      if (c._solta) { const s0 = pm.salas[si]; plano.chegada = plano.chegada || {}; plano.chegada[si] = (s0.herois || []).map(h => [h[0], h[1]]); s0.herois = [];
        const pai = b.pai ?? salasDe.eixo[salasDe.eixo.length - 1]; b.pai = pai;
        const oi = colocarNaSala(pm, pai, 'InteractToken', rng, { name: b.solta === 'alcapao' ? L2('The trapdoor', 'O alçapão') : L2('The circle of runes', 'O círculo de runas'), gatilhos: [{ uid: uid(), tipo: 'open_room', sala: si, requisitos: [] }] });
        if (oi == null) { pm.salas.pop(); b.sala = undefined; notas.push(L2('No place for the ' + b.solta + '.', 'Sem lugar para o ' + b.solta + '.')); continue; }
        const o = pm.salas[pai].objetos[oi]; o._variante = b.solta;
        apresentar(pm, pai, o, b.solta === 'alcapao' ? L2('Faint grooves in the floor outline a trapdoor. Below, only darkness, with no stairs and no rope.', 'Ranhuras discretas no chão desenham um alçapão. Embaixo, só escuridão, sem escada nem corda.') : L2('A circle of runes glows on the floor, humming like a hive.', 'Um círculo de runas brilha no chão, zumbindo como uma colmeia.'),
          b.solta === 'alcapao' ? L2('The faint outline of a trapdoor shows in the floor.', 'O contorno discreto de um alçapão aparece no chão.') : L2('A circle of glowing runes hums on the floor.', 'Um círculo de runas brilhantes zumbe no chão.')); } (b.papel === 'lado' ? salasDe.lado : salasDe.eixo).push(si);
      // a point of no return starts the next set (the rooms of its own set are on the table when it opens)
      if (ponto()) { atual++; plano.pontos.push(si); grupo[si] = atual; } else grupo[si] = alvo;
      const s = pm.salas[si]; s.funcao = b.funcao;
      if (b.muroLongo && c.abridor?.sala === b.pai) muroArriscado(pm, plano, rng, b.pai, b.muroLongo.topo);
      if (b.transicao) { s.texto = (textoDaTransicao(b.transicao, plano, rng) + (s.texto ? '\n\n' + s.texto : '')).trim(); plano.transicaoFeita = si; }
      if (b.funcao === 'climax') { s.texto = preencher(rng.pick(plano.premissa.climax[LP()] || plano.premissa.climax.en), plano.vocab);
        b.climax = true; }
    }
    if (!salasDe.eixo.length) return { erro: L2('No room could be built. Try another seed or theme.', 'Nenhuma sala pôde ser construída. Tentem outra semente ou tema.') };
    const fim = salasDe.eixo[salasDe.eixo.length - 1];
    plano.ritmo = ritmoDasLutas(pm, plano, rng, salasDe);   // (before the gimmicks: they see the monsters)
    const chegada = aberturaDoMapa(pm, plano, rng);   // (first: the gimmicks and locks take tokens from the box too)
    aplicarTruque(pm, plano, rng, notas, salasDe);
    // (fewer pieces found a room than the story told: the storyteller says how many there are)
    if (plano.conceitoDito && plano.conceitoDito.texto && conceitoDoTruque(plano) && plano.conceitoDito.texto !== '\n\n' + conceitoDoTruque(plano)) plano.conceitoDito.g.text = plano.conceitoDito.g.text.replace(plano.conceitoDito.texto, '\n\n' + conceitoDoTruque(plano));
    aplicarPremissa(pm, plano, rng, notas, salasDe, fim);
    aplicarModalidade(pm, plano, rng, notas, salasDe, fim, 'antes');
    aplicarComplicacoes(pm, plano, rng, notas, salasDe);
    aplicarModalidade(pm, plano, rng, notas, salasDe, fim);
    if (plano.premissa.id === 'defesa') ondasNoFim(pm, plano, rng, notas, fim);
    // the leader of the last room (after the openers are all in place)
    const clx = plano.batidas.find(b => b.climax && b.sala != null); plano.chefe = clx ? chefeDaSala(pm, clx.sala, plano, rng, chefeReal) : null;
    if (plano.rival) { const alvo = plano.chefe?.alvo || plano.chefeFixo; alvo.gatilhos = (alvo.gatilhos || []).concat([plano.rivalCai ? txtT(plano.rivalCai, plano.rivalCai) : txtT(plano.rival + ' falls. The purse of the band is yours.', plano.rival + ' cai. A bolsa do bando fica com vocês.'), ouroDe(40)]); }
    if (plano.premissa.id === 'tenente' && !tenenteFoge(pm, plano, fim)) notas.push(L2('The lieutenant found no door to watch: no escape count.', 'O tenente não achou porta para vigiar: sem contagem de fuga.'));
    semRetorno(pm, plano, rng, notas);
    // (a point of no return may have changed the opener of the second room: the guide's lock goes on the one that opens it now)
    if (plano.escolta && salasDe.eixo[1] != null) travaDoGuia(abridorDe(pm, salasDe.eixo[1]), plano.escolta.achado, plano.escolta.X);
    pm.salas.forEach(x => x.objetos.forEach(o => { delete o._variante; }));
    travarJunto(pm);
    destravarImpossiveis(pm, notas);
    finalDoMapa(pm, plano, rng, notas, fim, chefeReal);
    guardarPeloFim(pm, plano, fim);
    desviosComPremio(pm, plano, rng, salasDe);
    espoliosDasLutas(pm, plano, rng, salasDe);
    descansoNoRespiro(pm, plano, rng, salasDe);
    chegadasLivres(pm, plano);
    sinosNosArcos(pm, plano, rng);
    efeitosSoComMonstros(pm);
    restosDosObjetos(pm);
    // less walking back: the way back from the detours, a shortcut from the far side, the climb to the attic
    plano.retorno = { runas: runasDeRetorno(pm, plano, rng, salasDe), passagem: pedrasDePassagem(pm, plano, rng, salasDe, o), sotao: alavancaDoSotao(pm, plano, rng, salasDe) };
    if (plano.dificuldade === 'facil') { poucosItens(pm, 3); lideresPorHerois(pm); }
    // texts of the map
    const v = plano.vocab; const pequenas = new Set(['the', 'of', 'a', 'o', 'a', 'os', 'as', 'de', 'do', 'da', 'dos', 'das', 'e', 'and']); const titulo = t => t.split(' ').map(w => pequenas.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const lugarT = titulo(v.lugar); const vilaoT = titulo(v.vilao);
    pm.meta.name = preencher(rng.pick(plano.premissa.titulo[LP()] || plano.premissa.titulo.en), { ...v, lugar: lugarT, vilao: vilaoT }); pm.meta.name = pm.meta.name.charAt(0).toUpperCase() + pm.meta.name.slice(1);
    // the start text only sets the scene: the story is told in the first room (aberturaDoMapa)
    pm.meta.intro = chegada || (preencher(rng.pick(plano.premissa.intro[LP()] || plano.premissa.intro.en), { ...v, lugar: v.lugar }) + (conceitoDoTruque(plano) ? '\n\n' + conceitoDoTruque(plano) : ''));
    if (plano.introExtra) pm.meta.intro += '\n\n' + plano.introExtra.join('\n\n');
    // (the boss's scene recalls the warning of the start: the story of the first room, else the intro of the map)
    if (clx) plano.cenaChefe = cenaDoChefe(pm, plano, rng, clx.sala);
    fundosDasCenas(pm, plano);
    aplicarPressao(pm, plano, rng, o, notas);
    contagemRegressiva(pm);
    pm.meta.description = TXT(plano.premissa.resumo);
    pm.campanha = { chegada: '', conclusao: preencher(rng.pick(plano.premissa.fim[LP()] || plano.premissa.fim.en), v) };
    pm.meta.gerado = { temas: plano.tema2 && plano.transicaoFeita != null ? [plano.tema, plano.tema2, plano.transicaoFeita] : null, retorno: { viaduto: plano.viadutos || [], runas: (plano.retorno?.runas || []).length, voltas: plano.voltas || [], passagem: plano.retorno?.passagem || null, sotao: (plano.retorno?.sotao || []).length, espiral: !!plano.espiral }, modalidade: plano.modalidade?.id || 'classica', premissa: plano.premissa.id, truque: plano.truque?.id || null, complicacoes: plano.feitas || [], chefe: plano.chefe?.id || null, semRetorno: (plano.semRetornoFeito || []).length ? plano.semRetornoFeito : null, semente: o.semente, atos: plano.atos, batidas: plano.batidas.map(b => ({ funcao: b.funcao, arquetipo: b.arquetipo, sala: b.sala ?? null, papel: b.papel })), roupas: roupasVestidas(plano), roteiro: plano.roteiro || null };
    // the campaign progression: a map starts where the game's first quest does (20; 15 easy, 25 hard). In a campaign it grows
    // with every map before it (usarMapaGerado)
    pm.balanceio = { min: 1, max: Math.min(4, 1 + Math.floor(plano.base / 3)), progresso: PROGRESSO_INICIAL[plano.dificuldade] || 20 };
    limparAbridores(); normalizar(pm);
    const probs = pm.salas.flatMap((s, i) => problemasDaSala(i).filter(x => !/warning/.test(x)).map(x => (i + 1) + ': ' + x));
    return { projeto: pm, plano, notas: notas.concat(probs), nota: Math.round(pm.salas.reduce((a, s, i) => a + (notaDaSala(medirSala(i, pm) || {}, ARQUETIPO_SALA(s.arquetipo) || ARQUETIPOS_SALA[0]) || 0), 0) / pm.salas.length) };
  } finally { projeto = antes; DIFICULDADE_TESTES = testesAntes; }
}

// ------------------------------------------------------------ the window
const GMAPA = { opcoes: null, resultado: null, sementeUsada: null };
/* the gold a generated map pays on completion when it joins a campaign (changed on the campaign screen) */
const OURO_DO_MAPA = 25;
/* the campaign progression of a generated map: the first map of a campaign at the game's first quest (by difficulty), each
   map after it 5 more (up to 60) */
const PROGRESSO_INICIAL = { facil: 15, normal: 20, dificil: 25 };
const PASSO_DO_PROGRESSO = 5;
function progressoNaCampanha(pm, antes) { const r = pm.balanceio || (pm.balanceio = { min: 1, max: 3, progresso: 20 }); r.progresso = Math.min(60, (r.progresso || 20) + PASSO_DO_PROGRESSO * Math.max(0, antes)); }
function desenharMapaGerado(cv, pm) {
  const g = cv.getContext('2d'); const W = cv.width, H = cv.height; g.fillStyle = '#16181c'; g.fillRect(0, 0, W, H);
  const cells = pm.salas.flatMap((s, si) => s.pecas.filter(q => !ehAlfombra(q.tile)).flatMap(q => casasDaPeca(q).map(c => [c[0], c[1], si, q.level || 0])));
  if (!cells.length) return;
  const x0 = Math.min(...cells.map(c => c[0])) - 1, y0 = Math.min(...cells.map(c => c[1])) - 1, x1 = Math.max(...cells.map(c => c[0])) + 1, y1 = Math.max(...cells.map(c => c[1])) + 1;
  const t = Math.max(2, Math.floor(Math.min(W / (x1 - x0 + 1), H / (y1 - y0 + 1)))); const ox = (W - t * (x1 - x0 + 1)) / 2, oy = (H - t * (y1 - y0 + 1)) / 2;
  const px = x => ox + (x - x0) * t, py = y => oy + (y - y0) * t;
  // (higher floors over lower ones; a walkway over another room shows its shadow edge)
  cells.sort((a, b) => a[3] - b[3]).forEach(([x, y, si, lv]) => { g.fillStyle = `hsl(${(si * 67) % 360} 35% ${lv ? 40 + Math.min(3, lv) * 7 : 40}%)`; g.fillRect(px(x), py(y), t - 1, t - 1); });
  pm.salas.forEach(s => { if (!s.elevada) return; g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = Math.max(1, t / 6); s.pecas.forEach(q => casasDaPeca(q).forEach(([x, y]) => g.strokeRect(px(x) + 0.5, py(y) + 0.5, t - 2, t - 2))); });
  pm.salas.forEach((s, si) => { const cs = s.pecas.filter(q => !ehAlfombra(q.tile)).flatMap(q => casasDaPeca(q)); if (!cs.length) return; const cx = cs.reduce((a, c) => a + c[0], 0) / cs.length, cy = cs.reduce((a, c) => a + c[1], 0) / cs.length;
    g.fillStyle = '#fff'; g.font = 'bold ' + Math.max(10, t * 1.1) + 'px system-ui'; g.textAlign = 'center'; g.fillText(String(si + 1), px(cx) + t / 2, py(cy) + t * 0.8); });
  pm.salas.forEach(s => s.objetos.forEach(o => { if (!todosGatilhos(o).some(gg => gg.tipo === 'open_room')) return; casasDoObjeto(o).forEach(([x, y]) => { g.strokeStyle = COR.abre; g.lineWidth = 2; g.strokeRect(px(x) + 1, py(y) + 1, t - 3, t - 3); }); }));
  (pm.salas[0]?.herois || []).forEach(h => { g.fillStyle = COR.heroi; g.fillRect(px(h[0]) + t * 0.2, py(h[1]) + t * 0.2, t * 0.6, t * 0.6); });
}
function abrirGeradorMapa() {
  const d = painelFlutuante('janelaGeradorMapa', tr('Generate a map (experimental)'), () => { d.hidden = true; });
  d.hidden = false; const corpo = d.querySelector('.corpo');
  const o = GMAPA.opcoes = GMAPA.opcoes || { atos: ATOS.get(), premissa: 'random', truque: 'auto', duracao: 'media', dificuldade: 'normal', tema: 'qualquer', semente: novaSemente(), manterPool: true, manterItens: true };
  const sel = (id, lista, v) => `<select id="${id}">${lista.map(([k, t]) => `<option value="${esc(k)}" ${String(v) === String(k) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
  corpo.innerHTML = `<p class="ajuda">A whole map: why the heroes go in (premise), what they must do to win (objective), what changes along the way (extra rule), how the tension grows and the end. It replaces the map on screen (or comes as a new map of the campaign), fully editable.</p>
    <div class="geradorOpcoes">
      <label class="campo" title="${esc(tr('The story: why the heroes go in.'))}">Premise ${sel('gm_pre', [['random', 'Random']].concat(PREMISSAS_MAPA.map(p => [p.id, TXT(p.nome)])), o.premissa)}</label>
      <label class="campo" title="${esc(tr('What the heroes must do to win.') + '\n' + TRUQUES_MAPA.map(t => TXT(t.nome) + ': ' + TXT(t.resumo)).join('\n'))}">Objective ${sel('gm_tru', [['auto', 'The premise\'s own'], ['nenhum', 'Simple']].concat(TRUQUES_MAPA.map(t => [t.id, TXT(t.nome)])), o.truque)}</label>
      <label class="campo" title="${esc(tr('The pieces of \u201cPieces that unlock\u201d (the objective, or a lock along the way): found with no test (keys, levers, valves…), or broken with a test that calls monsters (seals, idols, wards…). Automatic: the story drawn decides.'))}">${tr('Pieces')} ${sel('gm_pec', [['auto', tr('Automatic')], ['simples', tr('No test')], ['teste', tr('Test and monsters')]], o.modoPecas || 'auto')}</label>
      <label class="campo" title="${esc(tr('What changes along the way.') + '\n' + [tr('Automatic') + ': ' + tr('the generator weighs the options (the classic, with no extra rule and one or two complications, is the likeliest)')].concat(MODALIDADES_MAPA.filter(m => !m.soAuto).map(m => TXT(m.nome) + ': ' + TXT(m.resumo))).join('\n'))}">Extra rule ${sel('gm_mod', [['auto', 'Auto']].concat(MODALIDADES_MAPA.filter(m => !m.soAuto).map(m => [m.id, TXT(m.nome)])), o.modalidade || 'auto')}</label>
      <label class="campo">Length ${sel('gm_dur', [['curta', 'Short (3 rooms)'], ['media', 'Medium (6 rooms)'], ['longa', 'Long (8 rooms)']], o.duracao)}</label>
      <label class="campo">Difficulty ${sel('gm_dif', [['facil', 'Easy'], ['normal', 'Normal'], ['dificil', 'Hard']], o.dificuldade)}</label>
      <label class="campo" title="Something that pushes the heroes forward: fatigue every round after a while, or a round limit">Pressure ${sel('gm_pressa', [['auto', 'Auto'], ['nenhuma', 'None'], ['fadiga', 'Fatigue each round'], ['limite', 'Round limit']], o.pressao || 'auto')}</label>
      <label class="campo">Terrain and theme ${sel('gm_tema', Object.entries(TEMAS_SALA).map(([k, t]) => [k, t.nome]), o.tema)}</label>
      <label class="campo" title="Tiles, objects, monsters and items the generator may use: those of the boxes you own">Boxes ${sel('gm_atos', OPCOES_ATOS, o.atos)}</label>
      <label class="campo" title="Each Generate uses a new seed. To see a map again, type its seed here before generating.">Seed <input id="gm_sem" value="${esc(o.semente)}" style="width:90px"></label>
      <label class="chk" style="grid-column:1/-1" title="Unticked, the premise picks monsters of its faction from the Workshop"><input type="checkbox" id="gm_pool" ${o.manterPool ? 'checked' : ''}> Use the monster pool of this map</label>
      <label class="chk" style="grid-column:1/-1" title="Unticked, the item pool comes from the Workshop (the items of the chosen boxes)"><input type="checkbox" id="gm_itens" ${o.manterItens ?? o.manterPool ? 'checked' : ''}> Use the item pool of this map</label>
    </div>
    <div class="linha"><button class="primario" id="gm_gerar">✦ Generate map</button><span style="flex:1"></span>${oficinaHistoriasAtiva() ? '' : '<!--'}<button id="gm_hist" title="${esc(tr('The stories the generator dresses its maps with: export them to edit or share, import stories made elsewhere'))}">${tr('Stories…')}</button>${oficinaHistoriasAtiva() ? '' : '-->'}</div>
    <div id="gm_res"></div>`;
  const ler = () => { o.modalidade = $('#gm_mod')?.value || 'auto'; o.modoPecas = $('#gm_pec')?.value || 'auto'; o.premissa = $('#gm_pre').value; o.truque = $('#gm_tru').value; o.duracao = $('#gm_dur').value; o.dificuldade = $('#gm_dif').value; o.pressao = $('#gm_pressa')?.value || 'auto'; o.tema = $('#gm_tema').value; o.semente = $('#gm_sem').value.trim() || novaSemente(); o.manterPool = $('#gm_pool').checked; o.manterItens = $('#gm_itens').checked; o.atos = +$('#gm_atos').value === 1 ? 1 : 2; ATOS.set(o.atos); };
  const mostrar = () => {
    const r = GMAPA.resultado; const el = $('#gm_res'); if (!r) { el.innerHTML = ''; return; }
    if (r.erro) { el.innerHTML = `<p class="ajuda aviso">${esc(r.erro)}</p>`; return; }
    const pm = r.projeto, pl = r.plano;
    const fmTxt = { defeat_room: L2('defeat the last room', 'derrotar a última sala'), use_object: L2('use an object', 'usar um objeto'), trigger: L2('complete the count', 'completar a contagem'), table: L2('declared at the table', 'declarada à mesa') }[pm.meta.finalMission.tipo] || pm.meta.finalMission.tipo;
    el.innerHTML = `<div class="mapaGerado"><canvas width="300" height="260"></canvas><div style="flex:1;min-width:0">
      <h3 data-sem-traducao>${esc(pm.meta.name)}</h3><p class="ajuda" data-sem-traducao>${esc(pm.meta.intro)}</p>
      <p><b>${tr('Premise')}:</b> ${esc(TXT(pl.premissa.nome))}${pm.meta.gerado.temas ? ` · <b>${tr('Places')}:</b> ${esc(tr(TEMAS_SALA[pm.meta.gerado.temas[0]].nome))} → ${esc(tr(TEMAS_SALA[pm.meta.gerado.temas[1]].nome))} (${tr('room')} ${pm.meta.gerado.temas[2] + 1})` : ''} · <b>${tr('Objective')}:</b> ${esc(pl.truque ? TXT(pl.truque.nome) : tr('simple'))} · <b>${tr('Extra rule')}:</b> ${esc(TXT((pl.modalidade || MODALIDADE('classica')).nome))} · <b>${tr('Complications')}:</b> ${esc((pm.meta.gerado.complicacoes || []).map(c => TXT(COMPLICACAO(c.id)?.nome) + ' (' + (c.roupa ? nomeDaRoupa(c.id === 'ondas' ? 'ondas' : 'pecas', c.roupa) + ', ' : '') + c.n + ')').join(', ') || tr('none'))} · <b>${tr('Leader')}:</b> ${esc(tr(({ chefe: 'a boss of the Workshop', vidas: 'several lives', reforcos: 'reinforcements', regenera: 'heals every round', forte: 'at full strength' })[pm.meta.gerado.chefe] || 'none'))}${pm.meta.gerado.semRetorno ? ` · <b>${tr('Point of no return')}:</b> ${[].concat(pm.meta.gerado.semRetorno).map(x => tr('room') + ' ' + (x.sala + 1) + ' (' + esc(tr(({ salto: 'a jump down', portao: 'a gate that slams shut', desabamento: 'the ceiling gives way', alcapao: 'a trapdoor', teleporte: 'runes that carry you away' })[x.tipo])) + ')').join(', ')}` : ''} ${(() => { const r = pm.meta.gerado.retorno; if (!r) return ''; const p = [(r.viaduto || []).length ? tr('viaduct') + ' (' + tr('room') + ' ' + r.viaduto.map(i => i + 1).join(', ') + ')' : '', r.espiral ? tr('a spiral') : '', r.runas ? r.runas + ' ' + tr('return runes') : '', r.passagem ? tr('waystones') + ' ' + (r.passagem.de + 1) + '↔' + (r.passagem.para + 1) : '', r.sotao ? tr('lever to the attic') + ' (' + r.sotao + ')' : ''].filter(Boolean); return p.length ? ` · <b>${tr('Less walking back')}:</b> ${esc(p.join(', '))}` : ''; })()} · <b>${tr('Final mission')}:</b> <span data-sem-traducao>${esc(pm.meta.finalMission.texto || '')}</span> (${esc(fmTxt)})${pm.meta.limite ? ' · ' + tr('round limit') + ' ' + pm.meta.limite : ''}</p>
      ${resumoDasRoupas(pm)}
      <ol class="batidas">${pm.salas.map((s, i) => `<li><b>${esc(tr(ARQUETIPO_SALA(s.arquetipo)?.nome || s.arquetipo || ''))}</b> <small>${esc(tr((FUNCOES_SALA.find(f => f[0] === s.funcao) || ['', ''])[1]))}${s.intensidade ? ' · ' + tr('intensity') + ' ' + s.intensidade : ''}</small></li>`).join('')}</ol>
      ${r.notas.length ? `<p class="ajuda aviso" data-sem-traducao>${esc(r.notas.join(' · '))}</p>` : ''}
      <div class="linha"><button class="primario" id="gm_usar">${tr('Use this map')}</button><span class="etq">${r.nota}</span><span style="flex:1"></span><button id="gm_sim" title="${esc(tr('Debug: a small party plays this map by the easy rules (2 successes on every test, 2 actions a hero, no special weapons nor abilities, 8 health each, the monsters\u2019 damage applied), with 2, 3 and 4 heroes'))}">${tr('Simulate')}</button><select id="gm_simModo" title="${esc(tr('Standard: the easy rules above. Custom: your own party (health, damage per attack, attacks a round, successes…).'))}"><option value="padrao">${tr('Standard simulation')}</option><option value="custom">${tr('Custom simulation')}</option></select></div><div id="gm_simCfg" hidden>${formularioSimulacao()}</div><div id="gm_simres"></div></div></div>`;
    desenharMapaGerado(el.querySelector('canvas'), pm);
    $('#gm_usar').onclick = () => { usarMapaGerado(pm); d.hidden = true; };
    // the simulation: standard (the easy rules) or custom (the party the user describes; kept in this browser)
    const modo = $('#gm_simModo'); try { modo.value = localStorage.getItem('bigorna-sim-modo') === 'custom' ? 'custom' : 'padrao'; } catch { }
    const mostrarCfg = () => { $('#gm_simCfg').hidden = modo.value !== 'custom'; try { localStorage.setItem('bigorna-sim-modo', modo.value); } catch { } };
    modo.onchange = mostrarCfg; mostrarCfg();
    $('#gm_sim').onclick = () => { $('#gm_simres').innerHTML = modo.value === 'custom' ? tabelaDaSimulacao(pm, lerSimulacaoCustom()) : tabelaDaSimulacao(pm); };
  };
  // every Generate is a new map: a new seed, unless one was typed in
  $('#gm_gerar').onclick = () => { ler(); if (o.semente === GMAPA.sementeUsada) { o.semente = novaSemente(); $('#gm_sem').value = o.semente; } GMAPA.sementeUsada = o.semente;
    // the Workshop is the source: with too little in it, the window says so first
    const precisa = { monstros: !(o.manterPool && reservaComMonstros(projeto)), itens: !(o.manterItens && reservaDeItensCompleta(projeto)) };
    const gerar = () => comEspera($('#gm_gerar'), () => { GMAPA.resultado = gerarMapa(o); mostrar(); });
    const faltas = faltasDaOficina(o.atos, precisa); if (faltas.length) { GMAPA.resultado = null; mostrarFaltas($('#gm_res'), faltas, o.atos, precisa, gerar); } else gerar(); };
  if ($('#gm_hist')) $('#gm_hist').onclick = abrirHistorias;
  mostrar();
}
/* the name of a skin, for the summary of a generated map */
function nomeDaRoupa(fam, id) {
  const s = HIST(fam).find(x => x.id === id); if (!s) return id;
  return TXT(s.contador || s.plural || s.nome || s.bando || { en: id }) + (fam === 'pecas' && s.modo === 'teste' ? ' · ' + tr('with a test') : '');
}
/* the stories a generated map wears, in one line */
function resumoDasRoupas(pm) {
  const r = pm.meta.gerado?.roupas; if (!r) return '';
  const rot = { viloes: 'Villain', pecas: 'Pieces', ondas: 'Waves', escolta: 'Guide', resgate: 'Captives', relogio: 'Clock', 'regras.mercador': 'Merchant', 'regras.aliado': 'Sellsword', 'regras.rivais': 'Rivals', 'regras.perseguidor': 'Pursuer' };
  const partes = Object.entries(r).filter(([f]) => rot[f]).map(([f, ids]) => '<b>' + tr(rot[f]) + ':</b> ' + esc(ids.map(id => { const s = HIST(f).find(x => x.id === id); return s ? TXT(f === 'viloes' || f === 'escolta' || f.startsWith('regras.') ? (s.nome || s.bando) : f === 'relogio' ? s.nome : f === 'resgate' ? s.plural : s.contador) : id; }).join(', ')));
  return partes.length ? '<p class="ajuda">' + tr('Stories') + ' · ' + partes.join(' · ') + '</p>' : '';
}
/* the stories of the generator (historias.js), and those imported: export a file (JSON) to edit or share, import one. An
   imported skin with the id of one of the file replaces nothing: it is skipped (a new id makes it a new skin) */
function usarMapaGerado(pm) {
  const novo = clone(pm);
  if (campanha) { const antes = (campanha.missoes || []).filter(m => m && Array.isArray(m.salas) && m.salas.length).length; progressoNaCampanha(novo, antes);
    const idx = novaMissao('map', missaoAtual); novo.bestiario = oficinaVazia(); campanha.missoes[idx] = novo;
    const no = campanha.nos.find(x => x.missao === idx); if (no) { no.recompensas = no.recompensas || { items: [], materials: 0 }; if (!no.recompensas.gold) no.recompensas.gold = OURO_DO_MAPA; }   // gold on completion, as a quest pays
    trocarMissao(idx); }
  else {
    if (projeto.salas.length && !confirm(tr('Replace the map on screen with the generated map? Export it first if you want to keep it.'))) return;
    aplicarEstado({ projeto: novo, salaAtual: 0 }); camposDaMissao();
  }
  salaAtual = 0; sel = null; limparAbridores(); tudo(); enquadrar(); renderConferencia();
  avisoLongo(tr('Map generated') + ': ' + (novo.meta.name || ''), 6000);
}
