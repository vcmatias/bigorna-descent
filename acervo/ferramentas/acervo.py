"""O acervo do Bigorna: conferir um envio e gravá-lo, e refazer o índice. Só a biblioteca padrão do Python.

  python3 ferramentas/acervo.py gravar     (no GitHub Actions: lê o envio do formulário em $CORPO_DO_PEDIDO e $AUTOR_DO_PEDIDO,
                                         confere e, se passar, grava em itens/<id>/ e refaz o indice.json: sem curadoria)
  python3 ferramentas/acervo.py conferir   (só confere, sem gravar)
  python3 ferramentas/acervo.py indexar    (refaz o indice.json e o CATALOGO.md a partir de itens/*/ficha.json)
  python3 ferramentas/acervo.py zip ARQUIVO.zip [AUTOR]   (confere um zip daqui, sem formulário)

O resultado vai em $GITHUB_OUTPUT (ok=true/false) e o texto para a resposta no pedido em resposta.md. O formato está em
FORMATO.md. Tudo que vem do pedido é tratado como dado: nada dele vira comando.
"""
import datetime, hashlib, io, json, os, re, sys, urllib.request, zipfile

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ITENS = os.path.join(RAIZ, 'itens')
INDICE = os.path.join(RAIZ, 'indice.json')
CATALOGO = os.path.join(RAIZ, 'CATALOGO.md')
# as línguas do jogo (a em que cada mapa foi feito); a bandeira de cada uma está em bandeiras/<código>.png (tools/bandeiras.py)
LINGUAS = {'en': '🇺🇸', 'pt': '🇧🇷', 'es': '🇪🇸', 'fr': '🇫🇷', 'de': '🇩🇪', 'it': '🇮🇹', 'pl': '🇵🇱', 'hu': '🇭🇺', 'cs': '🇨🇿', 'ru': '🇷🇺', 'ko': '🇰🇷', 'zh-cn': '🇨🇳', 'zh-tw': '🇹🇼'}
ID = re.compile(r'^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$')
TIPOS = ('mapa', 'campanha', 'pacote')
EXTENSOES = ('.dmap', '.dcamp', '.bigorna', '.json', '.ogg', '.mp3', '.wav', '.mp4', '.webm', '.png', '.jpg', '.jpeg', '.webp', '.glb', '.gltf', '.obj', '.bin', '.mtl')
NOME = re.compile(r'^[^/\\:*?"<>|\x00-\x1f]{1,120}$')
IMAGEM_DA_OBRA = re.compile(r'^imagens/[0-9a-f]{32}\.(png|jpg|webp|gif)$')
MAX_ZIP = 60 * 1024 * 1024          # o arquivo enviado
MAX_DENTRO = 250 * 1024 * 1024      # tudo descompactado
# sem curadoria: um limite de envios por pessoa por dia (contra enxurrada); ACERVO_LIMITE_POR_DIA muda (0: sem limite)
LIMITE_POR_DIA = int(os.environ.get('ACERVO_LIMITE_POR_DIA', '10'))
FICHA = 'bigorna-acervo.json'   # a ficha dentro do zip (o editor a põe)
REFERENCIA = re.compile(r'"(imagens/[0-9a-f]{32}\.(?:png|jpg|webp|gif))"')
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


SEM_DONO = ('featPool',)


def chave(o):
    """A chave de uma entrada do "custom" (como o mod junta: id, _id ou hero)."""
    if not isinstance(o, dict): return None
    for k in ('id', '_id', 'hero'):
        if o.get(k) is not None: return str(o[k])
    return None


def custom_do_pacote(id_, ficha):
    """O "custom" do pacote.json de um pacote publicado (o arquivo dele em itens/)."""
    c = os.path.join(ITENS, id_, ficha.get('arquivo') or (id_ + '.zip'))
    try: return (json.loads(zipfile.ZipFile(c).read('pacote.json').decode('utf-8-sig')).get('custom') or {})
    except (OSError, KeyError, ValueError, zipfile.BadZipFile): raise Recusa('o pacote exigido %s está sem arquivo legível no acervo' % id_)


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
        if IMAGEM_DA_OBRA.match(n): continue   # (v240: as imagens da obra, na pasta "imagens", com o nome do conteúdo)
        if '/' in n or '\\' in n or n.startswith('.') or not NOME.match(n): raise Recusa('nome de arquivo não aceito: %s (o zip é plano, sem pastas)' % n)
        if os.path.splitext(n)[1].lower() not in EXTENSOES: raise Recusa('tipo de arquivo não aceito: %s' % n)
    if FICHA not in nomes: raise Recusa('o zip não traz a ficha (%s): use o arquivo que o editor salvou' % FICHA)
    f = ler_json(z.read(FICHA), FICHA)
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
    ls = [x.strip() for x in str(f.get('lingua') or '').split(',') if x.strip()]
    if not ls or any(x not in LINGUAS for x in ls): raise Recusa('língua não aceita: %r (uma das do jogo: %s)' % (f.get('lingua'), ', '.join(LINGUAS)))
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
    # os pacotes exigidos estão no acervo, na edição pedida ou mais nova (quem baixa a obra baixa antes esses pacotes)
    requer = f.get('requer') or []
    if not isinstance(requer, list): raise Recusa('requer não é uma lista')
    for q in requer:
        if not isinstance(q, dict) or not ID.match(str(q.get('id', ''))): raise Recusa('requisito não aceito: %r' % (q,))
        p = publicadas.get(q['id'])
        if not p or p.get('tipo') != 'pacote': raise Recusa('o pacote exigido %s não está no acervo (publique o pacote antes)' % q['id'])
        if p.get('edicao', 0) < int(q.get('edicao') or 1): raise Recusa('o pacote exigido %s está na edição %d no acervo; o mapa pede a %s' % (q['id'], p.get('edicao', 0), q.get('edicao')))
    pedidos = sorted((q['id'], int(q.get('edicao') or 1)) for q in requer)
    for n in docs:
        d = json.loads(z.read(n).decode('utf-8-sig'))
        reqs = [x for x in (d.get('requires') or []) if isinstance(x, dict)]
        if sorted(x.get('id') for x in reqs) != [i for i, _ in pedidos]: raise Recusa('os pacotes exigidos em %s não batem com os da ficha' % n)
        if sorted((x.get('id'), int(x.get('edition') or 1)) for x in reqs) != pedidos: raise Recusa('as edições dos pacotes exigidos em %s não batem com as da ficha' % n)
    # o conteúdo próprio da Oficina (v243) vai em pacotes, publicados à parte: o "custom" de um mapa ou campanha só leva entradas
    # dos pacotes exigidos (iguais saem; mudadas ficam, por cima da do pacote). O featPool é uma lista de ids do jogo.
    if docs:
        dos_pacotes = set()
        for q in requer:
            for k, l in custom_do_pacote(q['id'], publicadas[q['id']]).items():
                if isinstance(l, list): dos_pacotes.update((k, chave(o)) for o in l if chave(o) is not None)
        proprios = []
        for n in docs:
            for k, l in (json.loads(z.read(n).decode('utf-8-sig')).get('custom') or {}).items():
                if k in SEM_DONO or not isinstance(l, list): continue
                proprios += ['%s (%s)' % (o.get('name') or chave(o), k) for o in l if isinstance(o, dict) and chave(o) is not None and (k, chave(o)) not in dos_pacotes]
        if proprios:
            vistos = sorted(set(proprios))
            raise Recusa('a obra leva conteúdo próprio da Oficina fora dos pacotes que exige: %s%s. Esse conteúdo vai num pacote do acervo, publicado à parte; vincule a obra a ele no editor e publique de novo'
                         % (', '.join(vistos[:8]), ' e mais %d' % (len(vistos) - 8) if len(vistos) > 8 else ''))
    # as imagens (v240): os arquivos levam referências "imagens/<nome>"; cada uma vem no zip, na pasta imagens
    imagens = {n for n in nomes if IMAGEM_DA_OBRA.match(n)}
    for n in nomes:
        if not n.endswith(('.dmap', '.dcamp', '.bigorna')) and n != 'pacote.json': continue
        for r in sorted(set(REFERENCIA.findall(z.read(n).decode('utf-8-sig', 'replace')))):
            if r not in imagens: raise Recusa('%s usa a imagem %s, que não veio no zip (salve o arquivo de novo pelo editor)' % (n, r))
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
    catalogo(itens)
    velho = None
    try: velho = json.load(open(INDICE, encoding='utf-8'))
    except (OSError, ValueError): pass
    if velho and velho.get('itens') == itens: print('índice sem mudanças (%d entradas)' % len(itens)); return False
    with open(INDICE, 'w', encoding='utf-8') as a: json.dump(novo, a, ensure_ascii=False, indent=1); a.write('\n')
    print('índice: %d entradas' % len(itens)); return True


def bandeiras(lingua):
    return ' '.join(LINGUAS.get(x.strip(), x.strip().upper()) for x in str(lingua or '').split(',') if x.strip())


def imagens(lingua):
    """As bandeiras como imagem (no Windows o emoji de bandeira vira duas letras)."""
    return ' '.join('<img src="bandeiras/%s.png" height="16" alt="%s" title="%s">' % (x, x, x) if x in LINGUAS else x.upper() for x in (y.strip() for y in str(lingua or '').split(',')) if x)


def catalogo(itens):
    """O CATALOGO.md: a lista do acervo para ler no GitHub, com a bandeira da língua de cada entrada."""
    cel = lambda t: str(t or '').replace('|', '\\|').replace('\n', ' ')
    linhas = ['# Acervo do Bigorna: catálogo / catalogue', '',
              'Gerado sozinho a cada publicação (não edite). No jogo: **Mapas da comunidade → Baixar mapas** e **Pacotes**. / Made by itself at each publication (do not edit). In the game: **Community maps → Download maps** and **Packages**.', '']
    for tipo, titulo in (('campanha', 'Campanhas / Campaigns'), ('mapa', 'Mapas / Maps'), ('pacote', 'Pacotes / Packages')):
        dele = [f for f in itens if f.get('tipo') == tipo]
        linhas += ['## %s (%d)' % (titulo, len(dele)), '']
        if not dele: linhas += ['_Nada ainda. / Nothing yet._', '']; continue
        linhas += ['| Língua | Nome | Autor | Edição | Caixa | Exige | Publicado | Resumo |', '|---|---|---|---|---|---|---|---|']
        for f in dele:
            exige = ', '.join(cel(q.get('nome') or q.get('id')) for q in f.get('requer') or [])
            linhas.append('| %s | [%s](%s) | %s | %s | %s | %s | %s | %s |' % (imagens(f.get('lingua')), cel(f.get('nome')), f.get('url', ''), cel(f.get('autor')), f.get('edicao', 1),
                                                                    'Ato II' if f.get('ato') == 2 else 'Ato I', exige, f.get('publicado', ''), cel(f.get('resumo'))))
        linhas.append('')
    texto = '\n'.join(linhas) + '\n'
    velho = None
    try: velho = open(CATALOGO, encoding='utf-8').read()
    except OSError: pass
    if velho != texto:
        with open(CATALOGO, 'w', encoding='utf-8') as a: a.write(texto)


def saida(ok, texto):
    with open(os.path.join(RAIZ, 'resposta.md'), 'w', encoding='utf-8') as a: a.write(texto + '\n')
    if os.environ.get('GITHUB_OUTPUT'):
        with open(os.environ['GITHUB_OUTPUT'], 'a') as a: a.write('ok=%s\n' % ('true' if ok else 'false'))
    print(texto)


def main(args):
    acao = args[0] if args else ''
    if acao == 'indexar': indexar(); return 0
    if acao == 'zip':
        try: print(json.dumps(conferir(open(args[1], 'rb').read(), json.loads(zipfile.ZipFile(args[1]).read(FICHA)), args[2] if len(args) > 2 else ''), ensure_ascii=False, indent=1)); return 0
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
    resumo = '%s **%s** (%s, edição %d) por %s · %d KB%s' % (bandeiras(final.get('lingua')), final['nome'], final['tipo'], final['edicao'], final.get('autor') or autor, final['tamanho'] // 1024,
                                                     (' · exige / needs: ' + ', '.join('%s (%s)' % (q.get('nome') or q['id'], q.get('edicao')) for q in final.get('requer') or [])) if final.get('requer') else '')
    if acao == 'conferir':
        saida(True, '✅ Conferido / Checked: %s.' % resumo)
    else:
        gravar(dados, final)
        saida(True, '🎉 No acervo / In the community library: %s. Aparece no jogo e no editor em alguns minutos. / It shows in the game and in the editor in a few minutes.' % resumo)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
