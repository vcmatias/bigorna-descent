"""O acervo do Bigorna: conferir um envio e gravá-lo, e refazer o índice. Só a biblioteca padrão do Python.

  python3 ferramentas/acervo.py gravar     (no GitHub Actions: lê o envio do formulário em $CORPO_DO_PEDIDO e $AUTOR_DO_PEDIDO,
                                         confere e, se passar, grava em itens/<id>/ e refaz o indice.json: sem curadoria)
  python3 ferramentas/acervo.py conferir   (só confere, sem gravar)
  python3 ferramentas/acervo.py indexar    (refaz o indice.json a partir de itens/*/ficha.json)
  python3 ferramentas/acervo.py zip ARQUIVO.zip [AUTOR]   (confere um zip daqui, sem formulário)

O resultado vai em $GITHUB_OUTPUT (ok=true/false) e o texto para a resposta no pedido em resposta.md. O formato está em
FORMATO.md. Tudo que vem do pedido é tratado como dado: nada dele vira comando.
"""
import datetime, hashlib, io, json, os, re, sys, urllib.request, zipfile

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ITENS = os.path.join(RAIZ, 'itens')
INDICE = os.path.join(RAIZ, 'indice.json')
ID = re.compile(r'^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$')
TIPOS = ('mapa', 'campanha', 'pacote')
EXTENSOES = ('.dmap', '.dcamp', '.bigorna', '.json', '.ogg', '.mp3', '.wav', '.mp4', '.webm', '.png', '.jpg', '.jpeg', '.webp', '.glb', '.gltf', '.obj', '.bin', '.mtl')
NOME = re.compile(r'^[^/\\:*?"<>|\x00-\x1f]{1,120}$')
MAX_ZIP = 60 * 1024 * 1024          # o arquivo enviado
MAX_DENTRO = 250 * 1024 * 1024      # tudo descompactado
# sem curadoria: um limite de envios por pessoa por dia (contra enxurrada); ACERVO_LIMITE_POR_DIA muda (0: sem limite)
LIMITE_POR_DIA = int(os.environ.get('ACERVO_LIMITE_POR_DIA', '10'))
ANEXO = re.compile(r'https://github\.com/(?:user-attachments/files/\d+|[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/files/\d+)/[^\s)\]"<>]+\.zip')


class Recusa(Exception):
    pass


def secoes(corpo):
    """As seções de um pedido feito pelo formulário ("### Rótulo" e o texto até a próxima)."""
    r, atual = {}, None
    for linha in (corpo or '').replace('\r\n', '\n').split('\n'):
        m = re.match(r'^###\s+(.+?)\s*$', linha)
        if m: atual = m.group(1).strip().lower(); r[atual] = []; continue
        if atual is not None: r[atual].append(linha)
    return {k: '\n'.join(v).strip() for k, v in r.items()}


def ficha_do_pedido(corpo):
    s = secoes(corpo)
    texto = next((v for k, v in s.items() if k.startswith('ficha') or k.startswith('card')), '')
    texto = re.sub(r'^```[a-z]*\s*|\s*```$', '', texto.strip())
    try: f = json.loads(texto)
    except ValueError: raise Recusa('a ficha do pedido não é JSON (ela vem do editor: use o botão Publicar no acervo)')
    if not isinstance(f, dict): raise Recusa('a ficha do pedido não é um objeto')
    return f


def anexo_do_pedido(corpo):
    s = secoes(corpo)
    texto = next((v for k, v in s.items() if k.startswith('arquivo') or k.startswith('file')), corpo or '')
    urls = ANEXO.findall(texto)
    if not urls: raise Recusa('não achei o arquivo .zip anexado (arraste o arquivo que o editor salvou para o campo Arquivo)')
    if len(set(urls)) > 1: raise Recusa('há mais de um .zip anexado; mande um só')
    return urls[0]


def baixar(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'bigorna-acervo'})
    with urllib.request.urlopen(req, timeout=120) as r:
        dados = r.read(MAX_ZIP + 1)
    if len(dados) > MAX_ZIP: raise Recusa('o arquivo passa de %d MB' % (MAX_ZIP // 1024 // 1024))
    return dados


def ler_json(b, nome):
    try: return json.loads(b.decode('utf-8-sig'))
    except (ValueError, UnicodeDecodeError): raise Recusa('%s não é um JSON válido' % nome)


def fichas_publicadas():
    r = {}
    if not os.path.isdir(ITENS): return r
    for id_ in sorted(os.listdir(ITENS)):
        c = os.path.join(ITENS, id_, 'ficha.json')
        if os.path.isfile(c):
            try: r[id_] = json.load(open(c, encoding='utf-8'))
            except ValueError: pass
    return r


def conferir(zip_bytes, ficha_pedido, autor, publicadas=None):
    """Confere um envio. Devolve a ficha que vai para o acervo; Recusa com a razão, se algo não serve."""
    publicadas = fichas_publicadas() if publicadas is None else publicadas
    if len(zip_bytes) > MAX_ZIP: raise Recusa('o arquivo passa de %d MB' % (MAX_ZIP // 1024 // 1024))
    try: z = zipfile.ZipFile(io.BytesIO(zip_bytes))
    except zipfile.BadZipFile: raise Recusa('o arquivo não é um .zip')
    infos = [i for i in z.infolist() if not i.is_dir()]
    if sum(i.file_size for i in infos) > MAX_DENTRO: raise Recusa('o conteúdo descompactado é grande demais')
    nomes = [i.filename for i in infos]
    if len(set(n.lower() for n in nomes)) != len(nomes): raise Recusa('há arquivos repetidos no zip')
    for n in nomes:
        if '/' in n or '\\' in n or n.startswith('.') or not NOME.match(n): raise Recusa('nome de arquivo não aceito: %s (o zip é plano, sem pastas)' % n)
        if os.path.splitext(n)[1].lower() not in EXTENSOES: raise Recusa('tipo de arquivo não aceito: %s' % n)
    if 'bigorna-acervo.json' not in nomes: raise Recusa('o zip não traz a ficha (bigorna-acervo.json): use o arquivo que o editor salvou')
    f = ler_json(z.read('bigorna-acervo.json'), 'bigorna-acervo.json')
    if f.get('formato') != 'bigorna-acervo': raise Recusa('a ficha do zip não é do acervo do Bigorna')
    for k in ('id', 'tipo', 'edicao'):
        if f.get(k) != ficha_pedido.get(k): raise Recusa('a ficha do pedido e a do zip não batem (%s)' % k)
    id_, tipo, ed = f.get('id'), f.get('tipo'), f.get('edicao')
    if not isinstance(id_, str) or not ID.match(id_): raise Recusa('id não aceito: %r' % id_)
    if tipo not in TIPOS: raise Recusa('tipo não aceito: %r' % tipo)
    if not isinstance(ed, int) or ed < 1: raise Recusa('edição não aceita: %r' % ed)
    if not str(f.get('nome') or '').strip(): raise Recusa('falta o nome')
    for k, n in (('nome', 120), ('autor', 80), ('resumo', 400)):
        if not isinstance(f.get(k, ''), str) or len(f.get(k) or '') > n: raise Recusa('%s longo demais (até %d letras)' % (k, n))
    if f.get('ato', 1) not in (1, 2): raise Recusa('ato não aceito')
    # o que cada tipo traz
    docs = [n for n in nomes if n.endswith(('.dmap', '.dcamp'))]
    for n in docs:
        d = ler_json(z.read(n), n)
        fmt = 'dmap' if n.endswith('.dmap') else 'dcamp'
        if d.get('format') != fmt: raise Recusa('%s não é um .%s' % (n, fmt))
        if 'bigornaSalas' not in d: raise Recusa('%s não foi feito no editor Bigorna' % n)
    if tipo == 'mapa' and not any(n.endswith('.dmap') for n in nomes): raise Recusa('o mapa não traz o .dmap')
    if tipo == 'mapa' and any(n.endswith('.dcamp') for n in nomes): raise Recusa('um mapa avulso não leva .dcamp (publique como campanha)')
    if tipo == 'campanha' and sum(n.endswith('.dcamp') for n in nomes) != 1: raise Recusa('a campanha traz um .dcamp (e só um)')
    if tipo == 'pacote':
        if 'pacote.json' not in nomes or 'pacote.bigorna' not in nomes: raise Recusa('o pacote traz pacote.json e pacote.bigorna')
        pj = ler_json(z.read('pacote.json'), 'pacote.json'); pb = ler_json(z.read('pacote.bigorna'), 'pacote.bigorna')
        if pj.get('format') != 'bigorna-pacote' or pj.get('id') != id_ or pj.get('edition') != ed: raise Recusa('pacote.json não é deste pacote')
        if pb.get('formato') != 'bigorna-pacote' or pb.get('id') != id_ or (pb.get('edicao') or 1) != ed: raise Recusa('pacote.bigorna não é deste pacote')
        if docs: raise Recusa('um pacote não leva mapas')
    # edições: a primeira de um id é de quem a manda; as seguintes, só dela, e com número maior
    antes = publicadas.get(id_)
    hoje = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d')
    if LIMITE_POR_DIA and sum(1 for p in publicadas.values() if p.get('publicado') == hoje and (p.get('github') or '').lower() == (autor or '').lower()) >= LIMITE_POR_DIA:
        raise Recusa('limite de %d publicações por dia por pessoa; tente amanhã' % LIMITE_POR_DIA)
    if antes:
        if antes.get('tipo') != tipo: raise Recusa('o acervo tem outra coisa com este id')
        if (antes.get('github') or '').lower() != (autor or '').lower(): raise Recusa('só quem publicou %s (%s) manda edições novas dele' % (id_, antes.get('github')))
        if ed <= antes.get('edicao', 0): raise Recusa('o acervo já tem a edição %d; esta precisa ser maior' % antes.get('edicao', 0))
    # os pacotes exigidos estão no acervo, na edição pedida ou mais nova
    requer = f.get('requer') or []
    if not isinstance(requer, list): raise Recusa('requer não é uma lista')
    for q in requer:
        if not isinstance(q, dict) or not ID.match(str(q.get('id', ''))): raise Recusa('requisito não aceito: %r' % (q,))
        p = publicadas.get(q['id'])
        if not p or p.get('tipo') != 'pacote': raise Recusa('o pacote exigido %s não está no acervo (publique o pacote antes)' % q['id'])
        if p.get('edicao', 0) < int(q.get('edicao') or 1): raise Recusa('o pacote exigido %s está na edição %d no acervo; o mapa pede a %s' % (q['id'], p.get('edicao', 0), q.get('edicao')))
    for n in docs:
        d = json.loads(z.read(n).decode('utf-8-sig'))
        ids = sorted(x.get('id') for x in (d.get('requires') or []) if isinstance(x, dict))
        if ids != sorted(q['id'] for q in requer): raise Recusa('os pacotes exigidos em %s não batem com os da ficha' % n)
    final = {k: f[k] for k in ('formato', 'versao', 'id', 'tipo', 'nome', 'autor', 'resumo', 'lingua', 'ato', 'edicao', 'requer', 'conteudo', 'editor', 'data') if k in f}
    final.update({'arquivo': id_ + '.zip', 'tamanho': len(zip_bytes), 'sha256': hashlib.sha256(zip_bytes).hexdigest(), 'github': autor or '',
                  'publicado': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d')})
    return final


def gravar(zip_bytes, final):
    pasta = os.path.join(ITENS, final['id']); os.makedirs(pasta, exist_ok=True)
    with open(os.path.join(pasta, final['arquivo']), 'wb') as a: a.write(zip_bytes)
    with open(os.path.join(pasta, 'ficha.json'), 'w', encoding='utf-8') as a: json.dump(final, a, ensure_ascii=False, indent=1); a.write('\n')
    indexar()


def indexar():
    itens = []
    for id_, f in fichas_publicadas().items():
        arq = os.path.join(ITENS, id_, f.get('arquivo') or (id_ + '.zip'))
        if f.get('id') != id_ or not os.path.isfile(arq):
            print('fora do índice (ficha ou arquivo faltando):', id_); continue
        if hashlib.sha256(open(arq, 'rb').read()).hexdigest() != f.get('sha256'):
            print('fora do índice (soma não confere):', id_); continue
        itens.append(dict(f, url='itens/%s/%s' % (id_, f.get('arquivo') or (id_ + '.zip'))))
    itens.sort(key=lambda f: (f.get('publicado') or '', f.get('id')), reverse=True)
    novo = {'formato': 'bigorna-acervo-indice', 'versao': 1, 'atualizado': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%MZ'), 'itens': itens}
    velho = None
    try: velho = json.load(open(INDICE, encoding='utf-8'))
    except (OSError, ValueError): pass
    if velho and velho.get('itens') == itens: print('índice sem mudanças (%d entradas)' % len(itens)); return False
    with open(INDICE, 'w', encoding='utf-8') as a: json.dump(novo, a, ensure_ascii=False, indent=1); a.write('\n')
    print('índice: %d entradas' % len(itens)); return True


def saida(ok, texto):
    with open(os.path.join(RAIZ, 'resposta.md'), 'w', encoding='utf-8') as a: a.write(texto + '\n')
    if os.environ.get('GITHUB_OUTPUT'):
        with open(os.environ['GITHUB_OUTPUT'], 'a') as a: a.write('ok=%s\n' % ('true' if ok else 'false'))
    print(texto)


def main(args):
    acao = args[0] if args else ''
    if acao == 'indexar': indexar(); return 0
    if acao == 'zip':
        try: print(json.dumps(conferir(open(args[1], 'rb').read(), json.loads(zipfile.ZipFile(args[1]).read('bigorna-acervo.json')), args[2] if len(args) > 2 else ''), ensure_ascii=False, indent=1)); return 0
        except Recusa as e: print('RECUSADO:', e); return 1
    if acao not in ('conferir', 'gravar'): print(__doc__); return 2
    corpo = os.environ.get('CORPO_DO_PEDIDO', ''); autor = os.environ.get('AUTOR_DO_PEDIDO', '')
    try:
        ficha = ficha_do_pedido(corpo); url = anexo_do_pedido(corpo)
        dados = baixar(url)
        final = conferir(dados, ficha, autor)
    except Recusa as e:
        saida(False, '❌ **Não deu para aceitar / Not accepted:** %s.\n\nCorrija e edite o pedido (a conferência roda de novo). / Fix it and edit the request (the check runs again).' % e); return 0
    except Exception as e:   # (falha de rede etc.)
        saida(False, '⚠️ A conferência falhou / The check failed: %s' % e); return 0
    resumo = '**%s** (%s, edição %d) por %s · %d KB%s' % (final['nome'], final['tipo'], final['edicao'], final.get('autor') or autor, final['tamanho'] // 1024,
                                                     (' · exige / needs: ' + ', '.join('%s (%s)' % (q.get('nome') or q['id'], q.get('edicao')) for q in final.get('requer') or [])) if final.get('requer') else '')
    if acao == 'conferir':
        saida(True, '✅ Conferido / Checked: %s.' % resumo)
    else:
        gravar(dados, final)
        saida(True, '🎉 No acervo / In the community library: %s. Aparece no jogo e no editor em alguns minutos. / It shows in the game and in the editor in a few minutes.' % resumo)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
