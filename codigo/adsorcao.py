# -*- coding: utf-8 -*-
"""Adsorção: Langmuir conferido por enumeração, calor isostérico, ajuste e BET.

O QUE RESOLVE
    1. Enumera todos os estados de uma superfície com poucos sítios e
       confronta a ocupação média com a isoterma de Langmuir, que foi
       obtida supondo sítios independentes.
    2. Extrai o calor isostérico de um conjunto de isotermas e mostra que
       ele NÃO é a energia de ligação: sobra a entalpia do gás.
    3. Ajusta dados ruidosos pelos dois caminhos, o gráfico linearizado e o
       ajuste não linear, e mede o viés que a linearização introduz.
    4. Confere a fórmula fechada do BET contra a soma explícita da série.
    5. Recupera o volume de monocamada de uma isoterma sintética e calcula
       a área superficial, mostrando o que acontece fora da faixa usual.

A FISICA
    A isoterma de Langmuir sai em tres linhas do gra-canonico, como o
    modulo 5 mostrou, e e justamente por sair tao facil que convem
    desconfiar do que ela supoe: sitios identicos, independentes, e uma so
    molecula por sitio. Este programa testa a independencia por enumeracao
    direta e depois trata do que vem DEPOIS da isoterma, que e o uso dela.

    Medir adsorcao e, na pratica, medir duas coisas: quanta energia a
    molecula ganha ao grudar, que sai da dependencia com a temperatura, e
    quanta area a superficie tem, que sai do volume de monocamada. As duas
    medidas sao feitas o tempo todo em catalise, e as duas tem armadilhas
    que nenhuma formula avisa.

COMO CONFERIR SE ESTA CERTO
    1. A enumeracao exata tem de dar a formula de Langmuir ate o erro de
       maquina, e vai dar, porque os sitios sao mesmo independentes.
    2. O calor isostérico recuperado tem de ser epsilon + (5/2) kT, e nao
       epsilon: se der epsilon, a conta esqueceu o gas.
    3. O ajuste nao linear tem de ser menos enviesado que o linearizado, e
       a diferenca tem de crescer com o ruido.
    4. A formula fechada do BET tem de coincidir com a soma da serie em
       todas as casas, para x abaixo de 1.

Prof. Apiano Morais - LFCA/URCA - Fisica Estatistica
"""

import itertools

import numpy as np
from scipy.optimize import curve_fit

KB = 1.380649e-23        # J/K
H = 6.62607015e-34       # J s
NA = 6.02214076e23       # 1/mol
MASSA_N2 = 28.0134e-3 / NA


# ---------------------------------------------------------------------------
# 1. Langmuir
# ---------------------------------------------------------------------------


def lambda_termico(T, m=MASSA_N2):
    return H / np.sqrt(2 * np.pi * m * KB * T)


def K_langmuir(T, eps, m=MASSA_N2):
    """A pressão de meia ocupação. Vem de mu do gás ideal igualado ao sítio."""
    return KB * T / lambda_termico(T, m) ** 3 * np.exp(-eps / (KB * T))


def teta_langmuir(P, T, eps):
    k = K_langmuir(T, eps)
    return P / (P + k)


def teta_enumerado(nsitios, P, T, eps):
    """Ocupação média somando sobre TODOS os 2^n estados da superfície.

    Nada aqui supõe independência: monta-se a soma grã-canônica inteira,
    estado por estado, e dela se tira a ocupação média. Se a fatoração que
    o módulo 5 usou estiver certa, o resultado tem de ser o mesmo.
    """
    mu = KB * T * np.log(P * lambda_termico(T) ** 3 / (KB * T))
    beta = 1.0 / (KB * T)
    soma, soma_n = 0.0, 0.0
    for estado in itertools.product((0, 1), repeat=nsitios):
        n = sum(estado)
        energia = -eps * n
        peso = np.exp(-beta * (energia - mu * n))
        soma += peso
        soma_n += n * peso
    return soma_n / soma / nsitios


# ---------------------------------------------------------------------------
# 2. calor isostérico
# ---------------------------------------------------------------------------


def pressao_para_teta(teta, T, eps):
    """Inverte a isoterma: a pressão que dá uma certa ocupação."""
    return teta / (1 - teta) * K_langmuir(T, eps)


# ---------------------------------------------------------------------------
# 3. ajuste
# ---------------------------------------------------------------------------


def ajusta_linearizado(P, teta):
    """Gráfico de Langmuir: 1/teta contra 1/P é reta de coeficiente K."""
    x, y = 1.0 / P, 1.0 / teta
    a, b = np.polyfit(x, y, 1)
    return a / b            # K = coeficiente angular / linear


def ajusta_nao_linear(P, teta, chute):
    def modelo(p, k):
        return p / (p + k)
    popt, _ = curve_fit(modelo, P, teta, p0=[chute], maxfev=20000)
    return popt[0]


# ---------------------------------------------------------------------------
# 4. BET
# ---------------------------------------------------------------------------


def bet_fechada(x, c):
    """v/v_m pela fórmula fechada do BET."""
    return c * x / ((1 - x) * (1 - x + c * x))


def bet_serie(x, c, termos=200000):
    """v/v_m somando as camadas uma a uma, sem usar a fórmula fechada.

    A superfície tem sítios que podem ter 0, 1, 2, ... moléculas empilhadas.
    O peso de i camadas é c x^i, com o c cuidando da primeira camada, que
    tem energia diferente das outras. Então v/v_m = sum i w_i / sum w_i.
    """
    i = np.arange(1, termos + 1, dtype=float)
    w = c * x ** i
    return float((i * w).sum() / (1.0 + w.sum()))


def bet_plot(x, v):
    """Ajusta x/(v(1-x)) contra x e devolve (v_m, c)."""
    y = x / (v * (1 - x))
    a, b = np.polyfit(x, y, 1)          # a = inclinacao, b = intercepto
    vm = 1.0 / (a + b)
    c = a / b + 1.0
    return vm, c


# ---------------------------------------------------------------------------


def main():
    print('=' * 72)
    print('1. LANGMUIR, CONFERIDO POR ENUMERACAO EXATA')
    print('=' * 72)
    T, eps = 300.0, 0.35 * 1.602176634e-19       # 0,35 eV de ligacao
    print('   T = %.0f K, energia de ligacao = %.2f eV' % (T, 0.35))
    print('   pressao de meia ocupacao K(T) = %.4e Pa' % K_langmuir(T, eps))
    print()
    print('      sitios    P (Pa)      teta enumerado    teta de Langmuir   desvio')
    for nsit in (1, 4, 10):
        for P in (1e3, 1e5):
            a = teta_enumerado(nsit, P, T, eps)
            b = teta_langmuir(P, T, eps)
            print('      %5d   %.0e   %16.12f %18.12f   %.1e'
                  % (nsit, P, a, b, abs(a - b)))
    print()
    print('   A soma sobre os 2^n estados da superficie da exatamente a')
    print('   formula de um sitio so, para qualquer numero de sitios. Isso')
    print('   nao e surpresa, e sim a verificacao de que a fatoracao usada')
    print('   no modulo 5 esta correta: sem interacao entre sitios, a soma')
    print('   gra-canonica se fatora e o problema de N sitios e o de um.')
    print()
    print('   O que a enumeracao NAO pode consertar e a hipotese fisica. Se')
    print('   moleculas vizinhas se atraem, o peso deixa de ser produto de')
    print('   pesos e a isoterma ganha uma transicao de condensacao. Esse e')
    print('   o gas de rede, e ele se mapeia no modelo de Ising do modulo 10.')
    print()

    print('=' * 72)
    print('2. O CALOR ISOSTERICO NAO E A ENERGIA DE LIGACAO')
    print('=' * 72)
    print('   Medindo as pressoes que dao a MESMA ocupacao em temperaturas')
    print('   diferentes, e ajustando ln P contra 1/T, a inclinacao da o')
    print('   calor isosterico. Com eps = %.2f eV:' % 0.35)
    print()
    Ts = np.linspace(290.0, 310.0, 9)
    print('      teta     q_st medido (eV)   eps (eV)   q_st - eps (eV)   (5/2)kT (eV)')
    for teta in (0.2, 0.5, 0.8):
        P = np.array([pressao_para_teta(teta, t, eps) for t in Ts])
        incl = np.polyfit(1.0 / Ts, np.log(P), 1)[0]
        q = -KB * incl / 1.602176634e-19
        kT = 2.5 * KB * Ts.mean() / 1.602176634e-19
        print('      %.1f   %16.5f %10.5f %16.5f %13.5f'
              % (teta, q, 0.35, q - 0.35, kT))
    print()
    print('   O valor medido nao e 0,35 eV: sobra uma parcela, e ela e')
    print('   exatamente (5/2)kT, a entalpia por particula do gas ideal.')
    print('   A razao e que o calor isosterico mede a diferenca de entalpia')
    print('   entre a molecula adsorvida e a molecula no GAS, e o gas leva')
    print('   consigo (3/2)kT de energia cinetica mais kT de trabalho de')
    print('   expansao. Quem le a inclinacao como energia de ligacao erra')
    print('   por 0,065 eV a temperatura ambiente, que nao e pouco quando')
    print('   se quer distinguir fisissorcao de quimissorcao.')
    print()
    print('   Repare tambem que o valor independe de teta, como tem de ser')
    print('   num modelo de sitios identicos: se o calor medido CAIR com a')
    print('   ocupacao, a superficie e heterogenea ou ha repulsao entre as')
    print('   moleculas adsorvidas, e Langmuir nao serve.')
    print()

    print('=' * 72)
    print('3. AJUSTAR: O GRAFICO LINEARIZADO CONTRA O AJUSTE DIRETO')
    print('=' * 72)
    print('   A isoterma se lineariza como 1/teta = 1 + K/P, e por decadas')
    print('   foi assim que se ajustou: traca-se 1/teta contra 1/P e le-se')
    print('   K da reta. O problema e que o ruido de teta, uniforme na')
    print('   medida, deixa de ser uniforme depois de tomar 1/teta: os')
    print('   pontos de ocupacao baixa, que sao os mais incertos, viram os')
    print('   de maior alavanca no ajuste.')
    print()
    Kv = K_langmuir(T, eps)
    Pm = Kv * np.logspace(-1, 1.3, 12)
    rng = np.random.default_rng(7)
    print('      ruido    K linearizado        K nao linear      verdadeiro')
    print('               media     desvio     media     desvio')
    for sigma in (0.01, 0.03, 0.05):
        kl, kn = [], []
        for _ in range(400):
            dados = teta_langmuir(Pm, T, eps) + rng.normal(0, sigma, Pm.size)
            dados = np.clip(dados, 1e-3, 0.999)
            kl.append(ajusta_linearizado(Pm, dados))
            kn.append(ajusta_nao_linear(Pm, dados, Kv))
        kl, kn = np.array(kl), np.array(kn)
        print('      %.2f   %.4e %7.1f%%  %.4e %7.1f%%   %.4e'
              % (sigma, kl.mean(), 100 * (kl.mean() / Kv - 1),
                 kn.mean(), 100 * (kn.mean() / Kv - 1), Kv))
    print()
    print('   O ajuste nao linear fica centrado no valor verdadeiro; o')
    print('   linearizado se desloca, e o deslocamento cresce com o ruido.')
    print('   Nao e um detalhe de estatistica: e a diferenca entre medir')
    print('   uma energia de ligacao certa e medir uma errada. Hoje nao ha')
    print('   razao para linearizar, porque o ajuste direto e uma linha de')
    print('   programa; a linearizacao continua util apenas para OLHAR os')
    print('   dados e ver se eles sao mesmo de Langmuir.')
    print()

    print('=' * 72)
    print('4. BET: A FORMULA FECHADA CONTRA A SOMA DAS CAMADAS')
    print('=' * 72)
    print('   Empilhando camadas, com a primeira de energia diferente das')
    print('   demais, a soma das series da a isoterma BET. Conferindo a')
    print('   forma fechada contra a soma explicita, termo a termo:')
    print()
    print('      x = P/P0      c       serie somada    formula fechada   desvio')
    for c in (10.0, 100.0):
        for x in (0.05, 0.2, 0.5, 0.9):
            a = bet_serie(x, c)
            b = bet_fechada(x, c)
            print('      %8.2f %7.0f %14.8f %17.8f   %.1e'
                  % (x, c, a, b, abs(a - b)))
    print()
    print('   A formula fechada e a soma, e nao uma aproximacao dela.')
    print()
    print('   Repare no que acontece quando x tende a 1: a cobertura')
    print('   DIVERGE. Isso nao e defeito de conta, e o que o modelo diz:')
    print('   a pressao de saturacao e onde o gas condensa, e o numero de')
    print('   camadas empilhadas cresce sem limite. Por isso o BET nunca e')
    print('   usado perto da saturacao.')
    print()
    print('      x        camadas medias (c = 100)')
    for x in (0.3, 0.6, 0.9, 0.95, 0.99):
        print('      %.2f     %12.2f' % (x, bet_fechada(x, 100.0)))
    print()

    print('=' * 72)
    print('5. A AREA SUPERFICIAL QUE O BET MEDE')
    print('=' * 72)
    vm_verd, c_verd = 2.50e-5, 120.0          # m3 de N2 nas CNTP, por grama
    print('   Isoterma de um solido com v_m = %.3e m3/g e c = %.0f,'
          % (vm_verd, c_verd))
    print('   medida com nitrogenio a 77 K.')
    print()
    print('   Ajustar o grafico BET numa isoterma gerada pela PROPRIA')
    print('   formula devolveria os parametros em qualquer faixa, e nao')
    print('   diria nada. Por isso a isoterma sintetica aqui tem tambem os')
    print('   dois efeitos que existem no solido real e que o BET nao')
    print('   descreve: sitios fortes, que enchem antes de todo o resto e')
    print('   pesam em x baixo, e condensacao capilar nos poros, que')
    print('   acrescenta volume em x alto.')
    print()

    def isoterma_real(x):
        bet = vm_verd * bet_fechada(x, c_verd)
        fortes = 0.06 * vm_verd * x / (x + 0.004)        # sitios heterogeneos
        poros = 0.55 * vm_verd / (1 + np.exp(-(x - 0.62) / 0.05))  # capilar
        return bet + fortes + poros

    print('      faixa de x        v_m ajustado     erro       c ajustado')
    for lo, hi in ((0.05, 0.35), (0.01, 0.35), (0.05, 0.60),
                   (0.05, 0.90), (0.40, 0.90)):
        x = np.linspace(lo, hi, 14)
        vm, c = bet_plot(x, isoterma_real(x))
        print('      %.2f a %.2f    %.4e %9.1f%% %12.1f'
              % (lo, hi, vm, 100 * (vm / vm_verd - 1), c))
    print()
    print('   Agora a faixa importa, e importa de um jeito assimetrico. De')
    print('   0,05 a 0,35 o volume de monocamada sai com 4 por cento de')
    print('   erro, que para uma medida de area superficial e bom. Descer o')
    print('   limite de baixo ate 0,01 quase nao muda nada, porque os')
    print('   sitios fortes ja encheram. Subir o de cima e que estraga: a')
    print('   condensacao capilar entra e o erro triplica.')
    print()
    print('   O aviso mais claro, porem, nao esta no v_m e sim no c. Ele')
    print('   deveria ser propriedade do solido, e no entanto cai de 158')
    print('   para 24 conforme a faixa se alarga, um fator seis que depende')
    print('   so de onde se escolheu ajustar. Quando o c de um ajuste BET')
    print('   muda com a faixa, ou sai negativo, nao e erro numerico: e o')
    print('   ajuste avisando que foi usado onde o modelo nao vale.')
    print()
    print('   Daí a faixa classica de 0,05 a 0,35 nao vir da matematica do')
    print('   BET, que funciona em qualquer faixa, e sim de saber ONDE o')
    print('   solido real se comporta como o modelo supoe.')
    print()
    sigma_n2 = 0.162e-18                       # m2 por molecula de N2
    moleculas = vm_verd / 22.414e-3 * NA       # volume nas CNTP -> mols -> N
    area = moleculas * sigma_n2
    print('   Da monocamada para a area, com sigma(N2) = 0,162 nm2:')
    print('      moleculas na monocamada: %.4e por grama' % moleculas)
    print('      area superficial:        %.1f m2/g' % area)
    print()
    print('   Essa e a medida que se compra e se vende: um carvao ativado')
    print('   tem de 500 a 1500 m2/g, uma silica-gel umas 300, um catalisador')
    print('   de craqueamento algumas centenas. Um grama de carvao ativado')
    print('   tem area de duas quadras de tenis, e toda ela vem de contar')
    print('   quantas moleculas cabem numa camada.')
    print()


if __name__ == '__main__':
    main()
