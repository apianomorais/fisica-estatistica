# -*- coding: utf-8 -*-
"""Confere as invariantes estruturais de todas as paginas do site."""
import glob, os, re, sys

erros = []
paginas = sorted(glob.glob('*.html'))

for p in paginas:
    t = open(p, encoding='utf-8').read()

    # 1. links internos resolvem
    for href in re.findall(r'href="([^"#:]+\.html)(#[^"]*)?"', t):
        if not os.path.exists(href[0]):
            erros.append('%s: link quebrado para %s' % (p, href[0]))
    for anc in re.findall(r'href="#([^"]+)"', t):
        if 'id="%s"' % anc not in t:
            erros.append('%s: âncora #%s não existe' % (p, anc))

    # 2. recursos locais existem
    for src in re.findall(r'(?:src|href)="(assets/[^"?]+)', t):
        if not os.path.exists(src):
            erros.append('%s: recurso ausente %s' % (p, src))

    # 3. chapéu combina com o nome do arquivo
    m = re.match(r'aula(\d{2})\.html$', p)
    if m:
        ch = re.search(r'<p class="chapeu">Módulo (\d+)', t)
        if not ch:
            erros.append('%s: sem chapéu' % p)
        elif int(ch.group(1)) != int(m.group(1)):
            erros.append('%s: chapéu diz Módulo %s' % (p, ch.group(1)))

        # 4. seções sequenciais e índice lateral igual aos h2
        h2 = re.findall(r'<h2 id="s(\d+)">(\d+)\. ([^<]+)</h2>', t)
        nums = [int(a) for a, _, _ in h2]
        if nums != list(range(1, len(nums) + 1)):
            erros.append('%s: seções fora de ordem: %s' % (p, nums))
        for ident, rot, _ in h2:
            if ident != rot:
                erros.append('%s: seção #s%s rotulada %s' % (p, ident, rot))
        lat = re.findall(r'<li><a href="#s(\d+)">(\d+)\.', t)
        if [a for a, _ in lat] != [a for a, _, _ in h2]:
            erros.append('%s: índice lateral não bate com os h2' % p)

        # 5. exercícios numerados pelo módulo
        for ex in re.findall(r'Exercício resolvido (\d+)\.\d+', t):
            if int(ex) != int(m.group(1)):
                erros.append('%s: exercício numerado %s.x' % (p, ex))

    # 6. todo widget citado tem implementação
    reg = open('assets/js/widgets.js', encoding='utf-8').read()
    for w in re.findall(r'data-widget="([^"]+)"', t):
        if 'REGISTRO.%s =' % w not in reg:
            erros.append('%s: widget "%s" sem implementação' % (p, w))

    # 7. sem travessões no texto corrido
    for linha in t.split('\n'):
        if '—' in linha and not re.search(r'<t[dh][^>]*>\s*—\s*</t[dh]>', linha):
            erros.append('%s: travessão em "%s"' % (p, linha.strip()[:60]))

    # 8. nenhum caractere de controle: eles aparecem quando \f ou \b do LaTeX
    #    passam por uma string Python não crua e viram formfeed e backspace
    for ch in set(c for c in t if ord(c) < 32 and c not in '\t\n'):
        erros.append('%s: caractere de controle 0x%02x no arquivo '
                     '(provável \\f ou \\b do LaTeX corrompido)' % (p, ord(ch)))

    # 9. nenhum "<" seguido de letra dentro de matemática: o navegador o lê
    #    como abertura de tag e come a equação até o próximo ">"
    for mat in re.finditer(r'\\\((.*?)\\\)|\\\[(.*?)\\\]', t, re.S):
        trecho = mat.group(1) or mat.group(2) or ''
        if re.search(r'<(?=[A-Za-z/])', trecho):
            erros.append('%s: "<" cru antes de letra em "%s" '
                         '(escreva &lt;)' % (p, trecho.replace('\n', ' ')[:60]))

    # 10. tags equilibradas nos contêineres principais
    for tag in ('div', 'main', 'section', 'details', 'table'):
        a = len(re.findall(r'<%s[\s>]' % tag, t))
        b = len(re.findall(r'</%s>' % tag, t))
        if a != b:
            erros.append('%s: <%s> %d aberturas, %d fechamentos' % (p, tag, a, b))

print('páginas: %d' % len(paginas))
if erros:
    print('\n'.join(erros))
    sys.exit(1)
print('✓ todas as invariantes passam')
