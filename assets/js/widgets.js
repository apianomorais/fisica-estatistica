/* ===================================================================
   widgets.js: simuladores e calculadoras interativas
   Uso nas páginas: <div data-widget="nome"></div>
   Física Estatística / LFCA–URCA
   =================================================================== */

(function () {
  'use strict';

  /* ---------- utilitários de DOM ---------- */
  function el(tag, attrs, filhos) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else if (k === 'texto') n.textContent = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (filhos || []).forEach(function (c) { n.appendChild(c); });
    return n;
  }

  function moldura(raiz, titulo) {
    raiz.classList.add('widget');
    raiz.appendChild(el('div', { class: 'widget-cabeca', texto: titulo }));
    var corpo = el('div', { class: 'widget-corpo' });
    raiz.appendChild(corpo);
    return corpo;
  }

  /* Devolve o <input type=range>, para que o chamador possa movê-lo por código. */
  function deslizante(pai, rot, min, max, passo, inicial, aoMudar, formata) {
    var campo = el('div', { class: 'campo' });
    var lab = el('label');
    var val = el('span', { class: 'valor' });
    var inp = el('input', { type: 'range', min: min, max: max, step: passo, value: inicial });
    function mostrar() {
      val.innerHTML = formata ? formata(Number(inp.value)) : String(inp.value).replace('.', ',');
    }
    lab.innerHTML = rot + ' ';
    lab.appendChild(val);
    campo.appendChild(lab);
    campo.appendChild(inp);
    pai.appendChild(campo);
    inp.addEventListener('input', function () { mostrar(); aoMudar(Number(inp.value)); });
    mostrar();
    return inp;
  }

  /* Botões mutuamente exclusivos. Devolve uma função que troca a seleção. */
  function opcoes(pai, lista, inicial, aoMudar) {
    var cx = el('div', { class: 'botoes' });
    var bs = lista.map(function (o, i) {
      var b = el('button', { type: 'button', texto: o.rot });
      if (i !== inicial) b.classList.add('sec');
      b.addEventListener('click', function () {
        bs.forEach(function (x) { x.classList.add('sec'); });
        b.classList.remove('sec');
        aoMudar(o.v, o);
      });
      cx.appendChild(b);
      return b;
    });
    pai.appendChild(cx);
    return function (i) { bs[i].click(); };
  }

  function cartoes(pai, lista) {
    var g = el('div', { class: 'grade-num' });
    lista.forEach(function (c) {
      g.appendChild(el('div', { class: 'cartao-num', html:
        '<span class="rot">' + c.rot + '</span><span class="val" data-k="' + c.k + '">·</span>' }));
    });
    pai.appendChild(g);
    return function (vals) {
      Object.keys(vals).forEach(function (k) {
        var n = g.querySelector('[data-k="' + k + '"]');
        if (n) n.innerHTML = vals[k];
      });
    };
  }

  function tipografar(no) {
    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise([no]).catch(function () {});
    }
  }

  var REGISTRO = {};

  /* =================================================================
     1. Processos termodinâmicos num diagrama PV
     O trabalho é a área sob a curva: desenhá-lo é mais convincente do
     que afirmá-lo. A comparação isotérmica contra adiabática responde
     de olho à última parte da questão 5 do EUF 2019.
     ================================================================= */
  REGISTRO.processos = function (raiz) {
    var corpo = moldura(raiz, 'Diagrama PV: os quatro processos e o trabalho');

    var R = 8.314462618;
    var P0 = 101.0;        // kPa
    var V0 = 1.0;          // litros  (1 kPa·L = 1 J)
    var T0 = 330;          // K
    var n = P0 * V0 / (R * T0);   // mols, a partir do próprio estado inicial

    var est = { proc: 'iso', r: 0.1, g: 1.4, comparar: true };

    var cv = el('canvas');
    var ctr = el('div', { class: 'controles' });
    var alvoR = el('div');
    corpo.appendChild(cv);
    corpo.appendChild(ctr);

    var trocar = opcoes(ctr, [
      { rot: 'Isotérmico', v: 'iso' },
      { rot: 'Adiabático', v: 'adi' },
      { rot: 'Isobárico', v: 'isob' },
      { rot: 'Isocórico', v: 'isoc' }
    ], 0, function (v) { est.proc = v; rotularDeslizante(); desenhar(); });

    ctr.appendChild(alvoR);
    var desR = deslizante(alvoR, 'razão', 0.1, 3, 0.05, 0.1,
      function (v) { est.r = v; desenhar(); },
      function (v) { return v.toFixed(2).replace('.', ','); });
    var rotR = alvoR.querySelector('label');

    deslizante(ctr, '\\(\\gamma\\)', 1.1, 1.67, 0.01, 1.4,
      function (v) { est.g = v; desenhar(); },
      function (v) { return v.toFixed(2).replace('.', ','); });

    var cx = el('label', { class: 'caixa' });
    var chk = el('input', { type: 'checkbox', checked: 'checked' });
    cx.appendChild(chk);
    cx.appendChild(el('span', { texto: 'comparar isotérmica com adiabática' }));
    chk.addEventListener('change', function () { est.comparar = chk.checked; desenhar(); });
    ctr.appendChild(cx);

    function rotularDeslizante() {
      rotR.firstChild.nodeValue = est.proc === 'isoc'
        ? 'razão de pressões \\(P_2/P_1\\) ' : 'razão de volumes \\(V_2/V_1\\) ';
      tipografar(rotR);
    }

    var mostrar = cartoes(corpo, [
      { rot: 'P₂ (kPa)', k: 'P' }, { rot: 'T₂ (K)', k: 'T' },
      { rot: 'W sobre o gás (J)', k: 'W' }, { rot: 'ΔU (J)', k: 'U' },
      { rot: 'Q (J)', k: 'Q' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    /* Estado final e balanço energético de cada processo.
       Convenção: W é o trabalho realizado SOBRE o gás, e ΔU = Q + W. */
    function caminho(proc, r, g) {
      var V1 = V0, P1 = P0, V2, P2, T2, W;
      if (proc === 'isoc') { V2 = V0; P2 = P0 * r; } else if (proc === 'isob') { V2 = V0 * r; P2 = P0; } else { V2 = V0 * r; P2 = proc === 'iso' ? P0 * V0 / V2 : P0 * Math.pow(V0 / V2, g); }
      T2 = T0 * (P2 * V2) / (P0 * V0);
      if (proc === 'iso') W = n * R * T0 * Math.log(V1 / V2);
      else if (proc === 'adi') W = (P2 * V2 - P1 * V1) / (g - 1);
      else if (proc === 'isob') W = -P0 * (V2 - V1);
      else W = 0;
      var Cv = R / (g - 1);
      var dU = n * Cv * (T2 - T0);
      return { V1: V1, P1: P1, V2: V2, P2: P2, T2: T2, W: W, dU: dU, Q: dU - W };
    }

    function pontos(proc, r, g, qtd) {
      var c = caminho(proc, r, g), p = [], i;
      if (proc === 'isoc') {
        for (i = 0; i <= qtd; i++) p.push([V0, P0 + (c.P2 - P0) * i / qtd]);
      } else {
        for (i = 0; i <= qtd; i++) {
          var V = V0 + (c.V2 - V0) * i / qtd;
          var P = proc === 'isob' ? P0
                : proc === 'iso' ? P0 * V0 / V
                : P0 * Math.pow(V0 / V, g);
          p.push([V, P]);
        }
      }
      return p;
    }

    function desenhar() {
      var c = caminho(est.proc, est.r, est.g);
      var vmax = Math.max(V0, c.V2) * 1.15, vmin = 0;
      var pmax = Math.max(P0, c.P2,
        est.comparar ? P0 * Math.pow(V0 / (V0 * est.r), est.g) : 0) * 1.12;
      if (est.proc !== 'isoc' && est.r < 1) {
        pmax = Math.max(pmax, P0 * Math.pow(1 / est.r, est.comparar ? est.g : 1) * 1.12);
      }
      var ax = G.eixos(cv, {
        xmin: vmin, xmax: vmax, ymin: 0, ymax: pmax, altura: 320,
        rotX: 'volume V (L)', rotY: 'pressão P (kPa)',
        marcasX: G.marcasLineares(0, vmax, 5, 1),
        formataY: function (v) {
          return v < 1 ? '0' : Math.round(v).toLocaleString('pt-BR');
        }
      });

      var pts = pontos(est.proc, est.r, est.g, 160);

      // área sob a curva: é o trabalho
      ax.ct.save();
      ax.ct.globalAlpha = 0.16;
      ax.ct.fillStyle = G.COR.azul;
      ax.ct.beginPath();
      ax.ct.moveTo(ax.X(pts[0][0]), ax.Y(0));
      pts.forEach(function (p) { ax.ct.lineTo(ax.X(p[0]), ax.Y(p[1])); });
      ax.ct.lineTo(ax.X(pts[pts.length - 1][0]), ax.Y(0));
      ax.ct.closePath();
      ax.ct.fill();
      ax.ct.restore();

      function traco(p, cor, larg, tracejado) {
        ax.ct.save();
        ax.ct.strokeStyle = cor;
        ax.ct.lineWidth = larg;
        if (tracejado) ax.ct.setLineDash([5, 4]);
        ax.ct.beginPath();
        p.forEach(function (q, i) {
          var x = ax.X(q[0]), y = ax.Y(q[1]);
          if (i) ax.ct.lineTo(x, y); else ax.ct.moveTo(x, y);
        });
        ax.ct.stroke();
        ax.ct.restore();
      }

      var legenda = [{ cor: G.COR.azul, texto: nomeProc(est.proc) }];
      if (est.comparar && est.proc !== 'isoc') {
        var outro = est.proc === 'adi' ? 'iso' : 'adi';
        traco(pontos(outro, est.r, est.g, 160), G.COR.vinho, 1.6, true);
        legenda.push({ cor: G.COR.vinho, texto: nomeProc(outro) + ' (comparação)' });
      }
      traco(pts, G.COR.azul, 2.4);

      // marcas dos estados inicial e final
      [[V0, P0, '1'], [c.V2, c.P2, '2']].forEach(function (m) {
        ax.ct.save();
        ax.ct.fillStyle = G.COR.tinta;
        ax.ct.beginPath();
        ax.ct.arc(ax.X(m[0]), ax.Y(m[1]), 4, 0, 2 * Math.PI);
        ax.ct.fill();
        ax.ct.font = '600 12px system-ui, sans-serif';
        ax.ct.fillText(m[2], ax.X(m[0]) + 7, ax.Y(m[1]) - 7);
        ax.ct.restore();
      });
      G.legenda(ax, legenda);

      mostrar({
        P: F.fmt(c.P2, 1), T: F.fmt(c.T2, 1), W: F.fmt(c.W, 2),
        U: F.fmt(c.dU, 2), Q: F.fmt(c.Q, 2)
      });

      var txt;
      if (est.proc === 'iso') {
        txt = 'Isotérmico: \\(\\Delta U=0\\), então todo o trabalho feito sobre o gás sai como calor, \\(Q=-W\\). A área sombreada é \\(\\int P\\,dV\\).';
      } else if (est.proc === 'adi') {
        txt = 'Adiabático: \\(Q=0\\), então \\(\\Delta U=W\\). A curva \\(PV^{\\gamma}=\\) const é mais íngreme que a isoterma, e por isso comprimir adiabaticamente custa mais trabalho.';
      } else if (est.proc === 'isob') {
        txt = 'Isobárico: \\(W=-P\\,\\Delta V\\) é a área de um retângulo, e \\(Q=\\Delta U-W=nC_P\\Delta T\\).';
      } else {
        txt = 'Isocórico: sem variação de volume não há trabalho, \\(W=0\\), e todo o calor vira energia interna, \\(Q=\\Delta U=nC_V\\Delta T\\).';
      }
      if (est.comparar && est.proc !== 'isoc' && est.r < 1) {
        var wi = caminho('iso', est.r, est.g).W, wa = caminho('adi', est.r, est.g).W;
        txt += ' Para esta compressão, o trabalho sobre o gás é ' + F.fmt(wi, 2)
             + ' J no caminho isotérmico e ' + F.fmt(wa, 2)
             + ' J no adiabático: o menor é o <b>' + (wi < wa ? 'isotérmico' : 'adiabático') + '</b>.';
      }
      nota.innerHTML = txt;
      tipografar(nota);
    }

    function nomeProc(p) {
      return { iso: 'isotérmico', adi: 'adiabático',
               isob: 'isobárico', isoc: 'isocórico' }[p];
    }

    rotularDeslizante();
    registrarRedesenho(desenhar);
    tipografar(corpo);
  };

  /* =================================================================
     2. Quadrado termodinâmico
     Os quatro potenciais, suas diferenciais e as quatro relações de
     Maxwell saem todas de um desenho só. Clicar num potencial acende
     as variáveis que lhe pertencem.
     ================================================================= */
  REGISTRO.quadrado = function (raiz) {
    var corpo = moldura(raiz, 'O quadrado termodinâmico: potenciais e relações de Maxwell');

    var POT = {
      F: { nome: 'Energia livre de Helmholtz', def: 'F = U - TS',
           vars: ['T', 'V'],
           dif: 'dF = -S\\,dT - P\\,dV',
           der: ['S = -\\dpar{F}{T}{V}', 'P = -\\dpar{F}{V}{T}'],
           max: '\\dpar{S}{V}{T} = \\dpar{P}{T}{V}',
           uso: 'o potencial natural de quem controla temperatura e volume: é o que a função de partição canônica entrega, \\(F=-\\kB T\\ln Z\\).' },
      G: { nome: 'Energia livre de Gibbs', def: 'G = U - TS + PV',
           vars: ['T', 'P'],
           dif: 'dG = -S\\,dT + V\\,dP',
           der: ['S = -\\dpar{G}{T}{P}', 'V = \\dpar{G}{P}{T}'],
           max: '\\dpar{V}{T}{P} = -\\dpar{S}{P}{T}',
           uso: 'o potencial do laboratório comum, onde o que se fixa é a temperatura ambiente e a pressão atmosférica.' },
      E: { nome: 'Entalpia', def: 'E = U + PV',
           vars: ['S', 'P'],
           dif: 'dE = T\\,dS + V\\,dP',
           der: ['T = \\dpar{E}{S}{P}', 'V = \\dpar{E}{P}{S}'],
           max: '\\dpar{T}{P}{S} = \\dpar{V}{S}{P}',
           uso: 'a energia que se troca em processos a pressão constante: por isso o calor de reação é \\(\\Delta E\\).' },
      U: { nome: 'Energia interna', def: 'U = U(S,V)',
           vars: ['S', 'V'],
           dif: 'dU = T\\,dS - P\\,dV',
           der: ['T = \\dpar{U}{S}{V}', 'P = -\\dpar{U}{V}{S}'],
           max: '\\dpar{T}{V}{S} = -\\dpar{P}{S}{V}',
           uso: 'o ponto de partida, a primeira e a segunda lei reunidas numa linha só.' }
    };

    /* disposição em 3x3; os potenciais ficam no meio de cada lado,
       ladeados pelas suas variáveis naturais */
    var GRADE = [
      ['V', 'F', 'T'],
      ['U', '', 'G'],
      ['S', 'E', 'P']
    ];

    var tab = el('div', { class: 'quadrado' });
    var cels = {};
    GRADE.forEach(function (linha) {
      linha.forEach(function (c) {
        var cel = el('div', { class: c === '' ? 'vazio' : (POT[c] ? 'pot' : 'var') });
        if (c) {
          cel.innerHTML = '\\(' + c + '\\)';
          cels[c] = cel;
          if (POT[c]) {
            cel.setAttribute('role', 'button');
            cel.setAttribute('tabindex', '0');
            cel.setAttribute('aria-label', POT[c].nome);
            cel.addEventListener('click', function () { selecionar(c); });
            cel.addEventListener('keydown', function (e) {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selecionar(c); }
            });
          }
        }
        tab.appendChild(cel);
      });
    });
    corpo.appendChild(tab);
    corpo.appendChild(el('p', { class: 'legenda', html:
      'Clique num potencial. Em azul, ele e as suas variáveis naturais; '
      + 'em vinho, os conjugados que aparecem na diferencial.' }));

    var saida = el('div', { class: 'saida' });
    corpo.appendChild(saida);

    function selecionar(k) {
      Object.keys(cels).forEach(function (c) {
        cels[c].classList.remove('aceso', 'conjugado');
      });
      var p = POT[k];
      cels[k].classList.add('aceso');
      p.vars.forEach(function (v) { cels[v].classList.add('aceso'); });
      // o conjugado de cada variável natural é o que fica na diagonal oposta
      var oposto = { T: 'S', S: 'T', P: 'V', V: 'P' };
      p.vars.forEach(function (v) { cels[oposto[v]].classList.add('conjugado'); });

      saida.innerHTML =
        '<p><b>' + p.nome + '</b>, \\(' + p.def + '\\). Variáveis naturais: \\(' +
        p.vars.join('\\) e \\(') + '\\).</p>' +
        '<p>\\[' + p.dif + '\\]</p>' +
        '<p>Lendo os coeficientes: \\(' + p.der.join('\\) e \\(') + '\\).</p>' +
        '<p>Como a ordem das derivadas segundas não importa, \\(\\partial^2/\\partial x\\,\\partial y = \\partial^2/\\partial y\\,\\partial x\\), as duas derivadas acima se cruzam e dão a relação de Maxwell</p>' +
        '<p>\\[' + p.max + '\\]</p>' +
        '<p><b>Para que serve:</b> ' + p.uso + '</p>';
      tipografar(saida);
    }

    selecionar('U');
    tipografar(tab);
  };

  /* =================================================================
     3. Equipartição e o congelamento dos graus de liberdade
     A previsão clássica é constante; o experimento mostra degraus.
     O widget calcula a curva exata somando sobre os níveis.
     ================================================================= */
  REGISTRO.equiparticao = function (raiz) {
    var corpo = moldura(raiz, 'Graus de liberdade, calor específico e o valor de γ');

    var MOL = {
      mono: { rot: 'Monoatômico (He, Ar)', rot_: 0, vib: 0, tr: 3 },
      h2: { rot: 'Hidrogênio (H₂)', rot_: 2, vib: 1, tr: 3, tR: 85.3, tV: 6332 },
      di: { rot: 'Diatômico (N₂, O₂)', rot_: 2, vib: 1, tr: 3, tR: 2.9, tV: 3390 },
      lin: { rot: 'Triatômico linear (CO₂)', rot_: 2, vib: 4, tr: 3, tR: 0.56, tV: 960 },
      nlin: { rot: 'Não linear (H₂O, CH₄)', rot_: 3, vib: 3, tr: 3, tR: 20, tV: 2290 }
    };

    var est = { tipo: 'di', T: 300 };

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    opcoes(ctr, Object.keys(MOL).map(function (k) {
      return { rot: MOL[k].rot, v: k };
    }), 2, function (v) { est.tipo = v; desenhar(); });

    var cv = el('canvas');
    corpo.appendChild(cv);

    deslizante(corpo, 'temperatura \\(T\\)', 10, 4000, 10, 300,
      function (v) { est.T = v; desenhar(); },
      function (v) { return v + ' K'; });

    var mostrar = cartoes(corpo, [
      { rot: 'graus ativos f', k: 'f' }, { rot: 'U/Nk<sub>B</sub>T', k: 'u' },
      { rot: 'C<sub>V</sub>/R', k: 'cv' }, { rot: 'C<sub>P</sub>/R', k: 'cp' },
      { rot: '\u03b3 = C<sub>P</sub>/C<sub>V</sub>', k: 'g' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    /* Rotação: soma exata sobre J, com degenerescência 2J+1.
       Calcula-se Z, depois U e C por derivadas analíticas da soma. */
    function cRotacional(T, tR, linear) {
      if (!tR) return 0;
      var x = tR / T;
      if (linear) {
        var Z = 0, S1 = 0, S2 = 0;
        for (var J = 0; J < 400; J++) {
          var E = J * (J + 1) * x;              // em unidades de kB T
          var g = (2 * J + 1) * Math.exp(-E);
          if (J > 10 && g < 1e-16 * Z) break;
          Z += g; S1 += g * E; S2 += g * E * E;
        }
        return S2 / Z - (S1 / Z) * (S1 / Z);     // C/kB = <E²> - <E>²
      }
      // não linear: três eixos, clássica acima de ~T_rot, com corte suave
      return 1.5 * (1 - Math.exp(-T / (2 * tR)));
    }

    /* Vibração: osciladores harmônicos de Einstein, cada um com kB x²e^x/(e^x-1)² */
    function cVibracional(T, tV, modos) {
      return modos ? modos * F.cEinstein(T, tV) : 0;
    }

    function capacidades(tipo, T) {
      var m = MOL[tipo];
      var cT = 1.5;
      var cR = m.rot_ ? cRotacional(T, m.tR, m.rot_ === 2) : 0;
      var cV = cVibracional(T, m.tV, m.vib);
      var c = cT + cR + cV;
      return { cT: cT, cR: cR, cV: cV, cv: c, cp: c + 1, g: (c + 1) / c, f: 2 * c };
    }

    function desenhar() {
      var m = MOL[est.tipo];
      var ymax = est.tipo === 'mono' ? 3 : 2 * (1.5 + m.rot_ / 2 + m.vib) + 1;
      ymax = Math.max(3, Math.min(10, ymax));
      var lmin = Math.log10(10), lmax = Math.log10(5000);
      var ax = G.eixos(cv, {
        xmin: lmin, xmax: lmax, ymin: 0, ymax: ymax, altura: 300,
        rotX: 'temperatura (K, escala logarítmica)', rotY: '\u0043\u1D65/R',
        marcasX: [10, 30, 100, 300, 1000, 3000].map(function (v) {
          return { v: Math.log10(v), r: String(v) };
        }),
        divY: Math.max(3, Math.round(ymax)),
        formataY: function (v) { return v.toFixed(1).replace('.', ','); }
      });

      G.curva(ax, function (L) {
        return capacidades(est.tipo, Math.pow(10, L)).cv;
      }, G.COR.azul, 2.4);

      // patamares clássicos, as previsões de equipartição
      [[1.5, 'só translação: 3/2'],
       [1.5 + m.rot_ / 2, 'com rotação'],
       [1.5 + m.rot_ / 2 + m.vib, 'com vibração']].forEach(function (p, k) {
        if (k && p[0] === 1.5) return;
        ax.ct.save();
        ax.ct.strokeStyle = G.COR.grade;
        ax.ct.setLineDash([3, 3]);
        ax.ct.beginPath();
        ax.ct.moveTo(ax.X(lmin), ax.Y(p[0]));
        ax.ct.lineTo(ax.X(lmax), ax.Y(p[0]));
        ax.ct.stroke();
        ax.ct.fillStyle = G.COR.suave;
        ax.ct.font = '10px system-ui, sans-serif';
        ax.ct.textAlign = 'right';
        ax.ct.fillText(p[1], ax.X(lmax) - 4, ax.Y(p[0]) - 5);
        ax.ct.restore();
      });

      G.vertical(ax, Math.log10(est.T), G.COR.vinho, String(est.T) + ' K');

      var c = capacidades(est.tipo, est.T);
      mostrar({
        f: F.fmt(c.f, 2), u: F.fmt(c.cv, 2), cv: F.fmt(c.cv, 3),
        cp: F.fmt(c.cp, 3), g: F.fmt(c.g, 3)
      });

      var partes = ['translação ' + F.fmt(c.cT, 2)];
      if (m.rot_) partes.push('rotação ' + F.fmt(c.cR, 2));
      if (m.vib) partes.push('vibração ' + F.fmt(c.cV, 2));
      nota.innerHTML = 'Em ' + est.T + ' K, as contribuições para \\(C_V/R\\) são: '
        + partes.join(', ') + '. A equipartição clássica daria '
        + F.fmt(1.5 + m.rot_ / 2 + m.vib, 2)
        + ', e só esse valor aparece quando \\(\\kB T\\) é grande diante do espaçamento '
        + 'entre os níveis. Abaixo disso os modos <b>congelam</b>: a mecânica quântica '
        + 'entra na termodinâmica pela porta do calor específico.';
      tipografar(nota);
    }

    registrarRedesenho(desenhar);
    tipografar(corpo);
  };

  /* =================================================================
     4. Pressão cinética
     Um gás bidimensional de partículas que só batem nas paredes.
     Mede-se o impulso transferido e compara-se com NkT/A.
     Unidades reduzidas: m = 1, kB = 1, caixa 1x1.
     ================================================================= */
  REGISTRO.cinetica = function (raiz) {
    var corpo = moldura(raiz, 'De onde vem a pressão, e por que as parciais se somam');

    /* Duas espécies no mesmo recipiente, massas 1 e 4, em unidades
       reduzidas: kB = 1, caixa de lado 1, área 1. A previsão para cada
       espécie é P_i = N_i T / A, sem nenhuma referência à massa. */
    var MASSA = [1, 4];
    var COR = ['#2c5f8d', '#8c2f39'];

    var est = { N: 300, fraca: 0.5, T: 1, rodando: true, mistura: true };
    var part = [], imp = [0, 0], tempo = 0, NB = 14;

    var cv = el('canvas');
    corpo.appendChild(cv);
    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);

    deslizante(ctr, 'total de partículas \\(N\\)', 40, 800, 20, 300,
      function (v) { est.N = v; reiniciar(); });
    deslizante(ctr, 'fração da espécie leve', 0, 1, 0.05, 0.5,
      function (v) { est.fraca = v; reiniciar(); },
      function (v) { return F.pct(v, 0); });
    deslizante(ctr, 'temperatura \\(T\\) (unidades de \\(\\kB\\))', 0.2, 3, 0.1, 1,
      function (v) { est.T = v; reiniciar(); },
      function (v) { return v.toFixed(1).replace('.', ','); });

    var bot = el('div', { class: 'botoes' });
    var bPausa = el('button', { type: 'button', texto: 'pausar' });
    var bZerar = el('button', { type: 'button', class: 'sec', texto: 'reiniciar' });
    bPausa.addEventListener('click', function () {
      est.rodando = !est.rodando;
      bPausa.textContent = est.rodando ? 'pausar' : 'continuar';
    });
    bZerar.addEventListener('click', reiniciar);
    bot.appendChild(bPausa); bot.appendChild(bZerar);
    ctr.appendChild(bot);

    var mostrar = cartoes(corpo, [
      { rot: 'P<sub>leve</sub> medida', k: 'p1' },
      { rot: 'P<sub>pesada</sub> medida', k: 'p2' },
      { rot: 'soma das parciais', k: 'ps' },
      { rot: 'Nk<sub>B</sub>T/A no limite N→∞', k: 'pt' },
      { rot: '⟨½mv²⟩ leve / pesada', k: 'ek' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    function nLeve() { return Math.round(est.N * est.fraca); }

    function reiniciar() {
      part = [];
      var nl = nLeve();
      for (var i = 0; i < est.N; i++) {
        var esp = i < nl ? 0 : 1;
        var sig = Math.sqrt(est.T / MASSA[esp]);
        part.push({
          x: Math.random() * 0.96 + 0.02,
          y: Math.random() * 0.96 + 0.02,
          vx: F.normalAleatoria() * sig,
          vy: F.normalAleatoria() * sig,
          e: esp
        });
      }
      /* Cada espécie é preparada exatamente na temperatura pedida: tira-se o
         momento total e reescalam-se as velocidades para que a energia
         cinética média seja kB.T por grau de liberdade. Sem isso, o sorteio
         daria a uma espécie uma amostra fria e à outra uma quente, e as
         pressões parciais sairiam diferentes por um motivo que nada tem a ver
         com Dalton. A flutuação que resta é a da contagem de choques. */
      [0, 1].forEach(function (e) {
        var g = part.filter(function (q) { return q.e === e; });
        if (!g.length) return;
        var sx = 0, sy = 0;
        g.forEach(function (q) { sx += q.vx; sy += q.vy; });
        sx /= g.length; sy /= g.length;
        var ex = 0, ey = 0;
        g.forEach(function (q) {
          q.vx -= sx; q.vy -= sy;
          ex += q.vx * q.vx; ey += q.vy * q.vy;
        });
        ex /= g.length; ey /= g.length;
        /* Reescala cada eixo separadamente. Aqui as partículas não colidem
           entre si, e um choque na parede troca o sinal de vx sem tocar em
           vy: nada reparte energia entre as direções, de modo que o
           desequilíbrio do sorteio inicial ficaria congelado para sempre.
           Num gás real as colisões fazem esse trabalho. Impondo
           <vx²> = <vy²> = kB.T/m no instante zero, a equipartição vale
           dali em diante. */
        var fx = ex > 0 ? Math.sqrt(est.T / MASSA[e] / ex) : 1;
        var fy = ey > 0 ? Math.sqrt(est.T / MASSA[e] / ey) : 1;
        g.forEach(function (q) { q.vx *= fx; q.vy *= fy; });
      });

      imp = [0, 0]; tempo = 0;
    }

    function passo(dt) {
      for (var i = 0; i < part.length; i++) {
        var p = part[i];
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.x < 0) { p.x = -p.x; p.vx = -p.vx; }
        if (p.x > 1) {
          imp[p.e] += 2 * MASSA[p.e] * Math.abs(p.vx);   // impulso = 2m|vx|
          p.x = 2 - p.x; p.vx = -p.vx;
        }
        if (p.y < 0) { p.y = -p.y; p.vy = -p.vy; }
        if (p.y > 1) { p.y = 2 - p.y; p.vy = -p.vy; }
      }
      tempo += dt;
    }

    function desenhar() {
      var p = G.preparar(cv, 320);
      var ct = p.ct;
      var lado = Math.min(p.L * 0.42, p.A - 42);
      var x0 = 12, y0 = 8;

      ct.save();
      ct.strokeStyle = G.COR.tinta; ct.lineWidth = 1.2;
      ct.strokeRect(x0, y0, lado, lado);
      ct.strokeStyle = G.COR.ambar; ct.lineWidth = 3;
      ct.beginPath(); ct.moveTo(x0 + lado, y0); ct.lineTo(x0 + lado, y0 + lado); ct.stroke();
      part.forEach(function (q) {
        ct.fillStyle = COR[q.e];
        ct.beginPath();
        ct.arc(x0 + q.x * lado, y0 + (1 - q.y) * lado, q.e ? 2.8 : 1.8, 0, 2 * Math.PI);
        ct.fill();
      });
      ct.restore();

      ct.save();
      ct.font = '11px system-ui, sans-serif';
      ct.textAlign = 'left';
      ct.fillStyle = G.COR.ambar;
      ct.fillText('parede medida', x0 + lado - 86, y0 + lado + 14);
      ct.fillStyle = COR[0];
      ct.fillText('leve (m = 1)', x0, y0 + lado + 14);
      ct.fillStyle = COR[1];
      ct.fillText('pesada (m = 4)', x0, y0 + lado + 28);
      ct.restore();

      /* Histogramas das duas espécies, no mesmo eixo de velocidade.
         Normalizados por ÁREA, e não pelo pico: assim a comparação com a
         Maxwell teórica é quantitativa e o ruído de um bin isolado não
         estica a curva inteira. As duas têm área 1, logo a mais estreita
         é também a mais alta. */
      var gx = x0 + lado + 34, gl = p.L - gx - 14, ga = lado - 18;
      if (gl > 110) {
        var vmax = 3.9 * Math.sqrt(est.T / MASSA[0]);
        // pico teórico mais alto, que fixa a escala vertical
        var pico = 0, e, i;
        for (e = 0; e < 2; e++) {
          pico = Math.max(pico, Math.sqrt(MASSA[e] / est.T) * Math.exp(-0.5));
        }
        var dens = function (v, mm) {
          return (mm * v / est.T) * Math.exp(-mm * v * v / (2 * est.T));
        };
        /* O histograma é do instante, não acumulado: sem colisões entre
           partículas os módulos das velocidades nunca mudam, de modo que
           somar quadros apenas reamostraria as mesmas N moléculas. O que
           se vê é uma amostra finita, e é por isso que ela serrilha. */
        var conta = [new Array(NB).fill(0), new Array(NB).fill(0)];
        part.forEach(function (q) {
          var esc2 = 3.6 * Math.sqrt(est.T / MASSA[q.e]);
          var bb = Math.floor(Math.hypot(q.vx, q.vy) / esc2 * NB);
          if (bb >= 0 && bb < NB) conta[q.e][bb]++;
        });
        ct.save();
        for (e = 0; e < 2; e++) {
          var soma = 0;
          for (i = 0; i < NB; i++) soma += conta[e][i];
          var escalaV = 3.6 * Math.sqrt(est.T / MASSA[e]);
          var larguraBin = escalaV / NB;

          if (soma) {
            ct.strokeStyle = COR[e];
            ct.lineWidth = 2;
            ct.beginPath();
            for (i = 0; i < NB; i++) {
              var v = (i + 0.5) * larguraBin;
              var d = conta[e][i] / soma / larguraBin;
              var X = gx + Math.min(1, v / vmax) * gl;
              var Y = y0 + ga - (d / pico) * ga * 0.9;
              if (i) ct.lineTo(X, Y); else ct.moveTo(X, Y);
            }
            ct.stroke();
          }

          ct.strokeStyle = COR[e];
          ct.setLineDash([4, 3]);
          ct.lineWidth = 1.3;
          ct.beginPath();
          for (i = 0; i <= 140; i++) {
            var vv = vmax * i / 140;
            var XX = gx + vv / vmax * gl;
            var YY = y0 + ga - (dens(vv, MASSA[e]) / pico) * ga * 0.9;
            if (i) ct.lineTo(XX, YY); else ct.moveTo(XX, YY);
          }
          ct.stroke();
          ct.setLineDash([]);
        }
        ct.fillStyle = G.COR.suave;
        ct.font = '11px system-ui, sans-serif';
        ct.textAlign = 'center';
        ct.fillText('módulo da velocidade', gx + gl / 2, y0 + ga + 16);
        ct.textAlign = 'right';
        ct.fillText('tracejado: Maxwell 2D', gx + gl, y0 + ga + 30);
        ct.textAlign = 'left';
        ct.fillStyle = G.COR.tinta;
        ct.fillText('a pesada é mais lenta, na razão 1/\u221am', gx, y0 + ga + 30);
        ct.restore();
      }

      var nl = nLeve(), np = est.N - nl;
      var P1 = tempo > 0 ? imp[0] / tempo : 0;
      var P2 = tempo > 0 ? imp[1] / tempo : 0;
      var Pt = est.N * est.T;
      var ek = [0, 0], cnt = [0, 0];
      part.forEach(function (q) {
        ek[q.e] += 0.5 * MASSA[q.e] * (q.vx * q.vx + q.vy * q.vy);
        cnt[q.e]++;
      });
      mostrar({
        p1: F.fmt(P1, 2) + ' <small>(N=' + nl + ')</small>',
        p2: F.fmt(P2, 2) + ' <small>(N=' + np + ')</small>',
        ps: F.fmt(P1 + P2, 2),
        pt: F.fmt(Pt, 2),
        ek: (cnt[0] ? F.fmt(ek[0] / cnt[0], 2) : '·') + ' / '
          + (cnt[1] ? F.fmt(ek[1] / cnt[1], 2) : '·')
      });
    }

    function texto() {
      nota.innerHTML =
        '<p>A parede da direita registra cada choque. Num choque elástico a partícula devolve '
        + 'momento \\(2m|v_x|\\); somando esses impulsos e dividindo pelo tempo e pelo '
        + 'comprimento da parede obtém-se a pressão. Ela converge para \\(N\\kB T/A\\) sem '
        + 'que nada disso tenha sido imposto: a lei dos gases ideais é consequência dos '
        + 'choques, não um postulado.</p>'
        + '<p><b>E aqui está a lei de Dalton acontecendo.</b> As duas espécies têm massas '
        + 'diferentes por um fator 4, e as velocidades diferem por um fator 2, como mostram '
        + 'os dois histogramas. Ainda assim cada espécie contribui com \\(N_i\\kB T/A\\), '
        + 'proporcional apenas ao seu <b>número</b> de partículas. Mova a fração da espécie '
        + 'leve de 0 a 100% e veja as duas parciais trocarem de valor enquanto a soma não '
        + 'se mexe.</p>'
        + '<p>A razão está no último cartão: a energia cinética média é a mesma para as duas '
        + 'espécies, \\(\\med{\\tfrac12 mv^2}=\\kB T\\) em duas dimensões, porque é isso que '
        + 'a equipartição exige. A espécie pesada bate com mais força e menos frequência; a '
        + 'leve, com menos força e mais frequência. O produto \\(m\\med{v_x^2}\\), que é o '
        + 'que entra na pressão, é idêntico.</p>'
        + '<p>Qualquer resíduo entre a soma medida e \\(N\\kB T/A\\) é a flutuação da '
        + 'contagem de choques, que cai como o inverso da raiz do número de choques já '
        + 'registrados: deixe rodar e veja encolher. As partículas aqui não colidem entre '
        + 'si, apenas com as paredes, e por isso a equipartição entre as direções \\(x\\) '
        + 'e \\(y\\) precisa ser imposta no instante inicial; num gás real são as '
        + 'colisões mútuas que a estabelecem.</p>';
      tipografar(nota);
    }

    var ultimo = 0;
    function quadro(t) {
      var dt = Math.min(0.05, (t - ultimo) / 1000) || 0.016;
      ultimo = t;
      if (est.rodando) { for (var k = 0; k < 4; k++) passo(dt / 4); }
      desenhar();
      requestAnimationFrame(quadro);
    }

    reiniciar();
    texto();
    requestAnimationFrame(quadro);
    window.addEventListener('resize', desenhar);
    tipografar(corpo);
  };

  /* =================================================================
     5. Dois dados: a frequência vira densidade de probabilidade
     Reproduz a contagem dos slides. Com poucos lançamentos o
     histograma é irregular; com muitos ele assenta sobre a FDP exata,
     que se obtém contando as 36 configurações.
     ================================================================= */
  REGISTRO.dados = function (raiz) {
    var corpo = moldura(raiz, 'Dois dados: da contagem à densidade de probabilidade');

    var cont = new Array(13).fill(0);
    var total = 0;
    var EXATA = [];
    for (var s = 2; s <= 12; s++) EXATA[s] = (6 - Math.abs(s - 7)) / 36;

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    var bot = el('div', { class: 'botoes' });
    [['+1', 1], ['+10', 10], ['+100', 100], ['+1000', 1000]].forEach(function (b) {
      var x = el('button', { type: 'button', class: 'sec', texto: b[0] });
      x.addEventListener('click', function () { lancar(b[1]); });
      bot.appendChild(x);
    });
    var zerar = el('button', { type: 'button', texto: 'zerar' });
    zerar.addEventListener('click', function () {
      cont = new Array(13).fill(0); total = 0; desenhar();
    });
    bot.appendChild(zerar);
    ctr.appendChild(bot);

    var mostrar = cartoes(corpo, [
      { rot: 'lançamentos', k: 'n' }, { rot: 'média medida', k: 'm' },
      { rot: 'média exata', k: 'me' }, { rot: 'desvio medido', k: 'd' },
      { rot: 'desvio exato', k: 'de' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    function lancar(k) {
      for (var i = 0; i < k; i++) {
        var a = 1 + Math.floor(Math.random() * 6);
        var b = 1 + Math.floor(Math.random() * 6);
        cont[a + b]++; total++;
      }
      desenhar();
    }

    function desenhar() {
      var ax = G.eixos(cv, {
        xmin: 1.4, xmax: 12.6, ymin: 0, ymax: 0.21, altura: 290,
        rotX: 'soma dos dois dados', rotY: 'frequência relativa',
        marcasX: G.marcasInteiras(2, 12, 11),
        formataY: function (v) { return v.toFixed(2).replace('.', ','); }
      });

      var barras = [];
      for (var s = 2; s <= 12; s++) {
        barras.push({ x: s, y: total ? cont[s] / total : 0 });
      }
      G.barras(ax, barras, G.COR.azulClaro, 0.72);

      // a FDP exata, como degraus
      ax.ct.save();
      ax.ct.strokeStyle = G.COR.vinho;
      ax.ct.lineWidth = 2;
      ax.ct.beginPath();
      for (var k = 2; k <= 12; k++) {
        var meia = (ax.X(3) - ax.X(2)) * 0.36;
        var y = ax.Y(EXATA[k]);
        ax.ct.moveTo(ax.X(k) - meia, y);
        ax.ct.lineTo(ax.X(k) + meia, y);
      }
      ax.ct.stroke();
      ax.ct.restore();
      G.legenda(ax, [
        { cor: G.COR.azulClaro, texto: 'frequência observada' },
        { cor: G.COR.vinho, texto: 'FDP exata, das 36 configurações' }
      ]);

      var m = 0, m2 = 0;
      for (var j = 2; j <= 12; j++) {
        var p = total ? cont[j] / total : 0;
        m += j * p; m2 += j * j * p;
      }
      var dp = Math.sqrt(Math.max(0, m2 - m * m));
      mostrar({
        n: String(total),
        m: total ? F.fmt(m, 3) : '·',
        me: '7,000',
        d: total ? F.fmt(dp, 3) : '·',
        de: F.fmt(Math.sqrt(35 / 6), 3)
      });

      // distância máxima entre o observado e o exato
      var dmax = 0;
      for (var q = 2; q <= 12; q++) {
        dmax = Math.max(dmax, Math.abs((total ? cont[q] / total : 0) - EXATA[q]));
      }
      nota.innerHTML = total === 0
        ? 'Lance os dados. Com poucos lançamentos a contagem é irregular; conforme ela cresce, '
          + 'as barras assentam sobre a distribuição exata.'
        : 'Maior diferença entre a barra observada e a FDP exata: <b>' + F.fmt(dmax, 4)
          + '</b>. Ela encolhe como \\(1/\\sqrt{n}\\): com ' + total + ' lançamentos esperamos '
          + 'algo da ordem de ' + F.fmt(1 / Math.sqrt(total), 4)
          + '. É assim que uma frequência vira uma probabilidade, e é a mesma razão pela qual '
          + 'um gás com \\(10^{23}\\) moléculas tem pressão bem definida.';
      tipografar(nota);
    }

    registrarRedesenho(desenhar);
    tipografar(corpo);
  };

  /* =================================================================
     6. Princípio de Hamilton: a ação é mínima no caminho real
     Em vez de afirmar, calcula. O caminho é deformado por dois modos
     senoidais e a ação S = integral de L dt é obtida numericamente.
     ================================================================= */
  REGISTRO.acao = function (raiz) {
    var corpo = moldura(raiz, 'O princípio de Hamilton: calcule a ação e veja onde ela é mínima');

    var g = 9.8, m = 1, T = 2;          // queda e retorno em 2 s
    var est = { a1: 0, a2: 0, sis: 'queda' };

    var cv = el('canvas');
    corpo.appendChild(cv);
    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);

    opcoes(ctr, [
      { rot: 'Lançamento vertical', v: 'queda' },
      { rot: 'Oscilador harmônico', v: 'osc' }
    ], 0, function (v) { est.sis = v; desenhar(); });

    var d1 = deslizante(ctr, 'deformação \\(a_1\\sen(\\pi t/T)\\)', -3, 3, 0.05, 0,
      function (v) { est.a1 = v; desenhar(); },
      function (v) { return v.toFixed(2).replace('.', ','); });
    var d2 = deslizante(ctr, 'deformação \\(a_2\\sen(2\\pi t/T)\\)', -3, 3, 0.05, 0,
      function (v) { est.a2 = v; desenhar(); },
      function (v) { return v.toFixed(2).replace('.', ','); });

    var bZ = el('button', { type: 'button', class: 'sec', texto: 'voltar ao caminho real' });
    bZ.addEventListener('click', function () {
      [d1, d2].forEach(function (d) {
        d.value = 0; d.dispatchEvent(new Event('input'));
      });
    });
    ctr.appendChild(el('div', { class: 'botoes' }, [bZ]));

    var mostrar = cartoes(corpo, [
      { rot: 'ação S do caminho', k: 'S' },
      { rot: 'ação do caminho real', k: 'S0' },
      { rot: 'excesso S − S₀', k: 'dS' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    /* caminho verdadeiro e sua deformação */
    function real(t) {
      if (est.sis === 'queda') return 0.5 * g * t * (T - t);   // sai e volta a zero
      return Math.sin(Math.PI * t / T);                        // meio período, extremos fixos
    }
    function desvio(t, a1, a2) {
      return a1 * Math.sin(Math.PI * t / T) + a2 * Math.sin(2 * Math.PI * t / T);
    }
    function caminho(t, a1, a2) { return real(t) + desvio(t, a1, a2); }

    /* S = integral de (T_cin - V) dt, por Simpson sobre o caminho dado */
    function acao(a1, a2) {
      var n = 2000, h = T / n, soma = 0;
      function L(t) {
        var dt = 1e-6;
        var q = caminho(t, a1, a2);
        var qp = (caminho(Math.min(T, t + dt), a1, a2)
                - caminho(Math.max(0, t - dt), a1, a2))
                / (Math.min(T, t + dt) - Math.max(0, t - dt));
        var cin = 0.5 * m * qp * qp;
        var pot = est.sis === 'queda'
          ? m * g * q
          : 0.5 * m * Math.pow(Math.PI / T, 2) * q * q;   // ω = π/T
        return cin - pot;
      }
      for (var i = 0; i <= n; i++) {
        var peso = (i === 0 || i === n) ? 1 : (i % 2 ? 4 : 2);
        soma += peso * L(i * h);
      }
      return soma * h / 3;
    }

    function desenhar() {
      var qs = [], i, t;
      for (i = 0; i <= 200; i++) {
        t = T * i / 200;
        qs.push(caminho(t, est.a1, est.a2), real(t));
      }
      var ymin = Math.min.apply(null, qs), ymax = Math.max.apply(null, qs);
      var folga = 0.15 * (ymax - ymin || 1);

      var ax = G.eixos(cv, {
        xmin: 0, xmax: T, ymin: ymin - folga, ymax: ymax + folga, altura: 300,
        rotX: 'tempo t (s)', rotY: est.sis === 'queda' ? 'altura q (m)' : 'posição q (m)',
        marcasX: G.marcasLineares(0, T, 4, 1),
        formataY: function (v) { return v.toFixed(1).replace('.', ','); }
      });

      G.curva(ax, function (x) { return real(x); }, G.COR.grade, 4);
      G.curva(ax, function (x) { return real(x); }, G.COR.vinho, 1.6, [5, 4]);
      G.curva(ax, function (x) { return caminho(x, est.a1, est.a2); }, G.COR.azul, 2.4);
      G.legenda(ax, [
        { cor: G.COR.azul, texto: 'caminho escolhido' },
        { cor: G.COR.vinho, texto: 'caminho real (solução de Newton)' }
      ]);

      var S = acao(est.a1, est.a2), S0 = acao(0, 0);
      mostrar({ S: F.fmt(S, 4), S0: F.fmt(S0, 4), dS: F.fmt(S - S0, 4) });

      var e = S - S0;
      nota.innerHTML = Math.abs(est.a1) < 1e-9 && Math.abs(est.a2) < 1e-9
        ? 'Este é o caminho que Newton prevê. Mexa nos deslizantes: <b>qualquer</b> deformação '
          + 'aumenta a ação. O caminho real não é especial por ser bonito, e sim por ser o '
          + 'ponto estacionário de \\(S=\\int L\\,dt\\).'
        : 'O caminho azul não é o real, e a ação subiu <b>' + F.fmt(e, 4) + ' J·s</b>. '
          + 'Repare que o excesso é <b>quadrático</b> nas deformações: dobrando \\(a_1\\), ele '
          + 'quadruplica. É por isso que a primeira variação se anula, \\(\\delta S=0\\), e dela '
          + 'saem as equações de Euler e Lagrange.';
      tipografar(nota);
    }

    registrarRedesenho(desenhar);
    tipografar(corpo);
  };

  /* =================================================================
     7. Espaço de fase e o teorema de Liouville
     Uma mancha de condições iniciais escoa pelo espaço de fase. A
     integração é simplética, de modo que a área da mancha se conserva
     por construção: o widget mede essa área e mostra que não muda.
     ================================================================= */
  REGISTRO.liouville = function (raiz) {
    var corpo = moldura(raiz, 'Teorema de Liouville: a nuvem se deforma, a área não muda');

    var SIS = {
      osc: { rot: 'Oscilador harmônico', dV: function (q) { return q; },
             q0: 1.5, p0: 0, cq: 0, cp: 0, lq: 2.6, lp: 2.6 },
      pend: { rot: 'Pêndulo', dV: function (q) { return Math.sin(q); },
              q0: 1.7, p0: 0, cq: 0, cp: 0, lq: 4.4, lp: 3.0 },
      queda: { rot: 'Queda livre', dV: function () { return 1; },
               q0: 0, p0: 1.0, cq: 1.4, cp: 0, lq: 3.2, lp: 2.6 }
    };

    var est = { sis: 'osc', rodando: true, lado: 0.45 };
    var borda = [], tempo = 0, area0 = 0;

    var cv = el('canvas');
    corpo.appendChild(cv);
    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);

    opcoes(ctr, Object.keys(SIS).map(function (k) {
      return { rot: SIS[k].rot, v: k };
    }), 0, function (v) { est.sis = v; reiniciar(); });

    deslizante(ctr, 'lado da mancha inicial', 0.15, 0.9, 0.05, 0.45,
      function (v) { est.lado = v; reiniciar(); },
      function (v) { return v.toFixed(2).replace('.', ','); });

    var bP = el('button', { type: 'button', texto: 'pausar' });
    var bR = el('button', { type: 'button', class: 'sec', texto: 'reiniciar' });
    bP.addEventListener('click', function () {
      est.rodando = !est.rodando;
      bP.textContent = est.rodando ? 'pausar' : 'continuar';
    });
    bR.addEventListener('click', reiniciar);
    ctr.appendChild(el('div', { class: 'botoes' }, [bP, bR]));

    var mostrar = cartoes(corpo, [
      { rot: 'tempo decorrido', k: 't' }, { rot: 'área inicial', k: 'a0' },
      { rot: 'área agora', k: 'a' }, { rot: 'variação medida', k: 'e' }
    ]);
    var nota = el('div', { class: 'saida', html:
      '<p>Cada ponto da borda é um sistema com condições iniciais ligeiramente diferentes, e '
      + 'cada um segue as equações canônicas \\(\\dot q = \\partial H/\\partial p\\), '
      + '\\(\\dot p = -\\partial H/\\partial q\\). A mancha estica, torce e às vezes se enrola, '
      + 'mas a área que ela encerra permanece a mesma: é o teorema de Liouville, '
      + '\\(d\\rho/dt = 0\\), a incompressibilidade do escoamento no espaço de fase.</p>'
      + '<p>A consequência é profunda. A informação sobre o estado inicial nunca é destruída '
      + 'pela dinâmica, apenas espalhada em filamentos finos demais para serem acompanhados. '
      + 'É dessa impossibilidade prática, e não de uma perda real de informação, que nasce a '
      + 'necessidade de uma descrição estatística.</p>'
      + '<p>A área é medida pelo polígono de 400 pontos que traça a borda. A integração é '
      + 'simplética e conserva a área exatamente; qualquer variação que apareça no cartão é '
      + 'do polígono, que corta as curvas quando a mancha se estica muito. No pêndulo, com '
      + 'uma mancha grande o bastante para cruzar a separatriz, a borda vira um filamento e '
      + 'nenhum número finito de pontos dá conta dela: a própria medida mostra o limite.</p>' });
    corpo.appendChild(nota);

    function reiniciar() {
      var s = SIS[est.sis], L = est.lado, n = 400, i;
      borda = [];
      for (i = 0; i < n; i++) {   // percorre o quadrado inicial no sentido anti-horário
        var u = 4 * i / n;
        var dq, dp;
        if (u < 1) { dq = -L / 2 + u * L; dp = -L / 2; }
        else if (u < 2) { dq = L / 2; dp = -L / 2 + (u - 1) * L; }
        else if (u < 3) { dq = L / 2 - (u - 2) * L; dp = L / 2; }
        else { dq = -L / 2; dp = L / 2 - (u - 3) * L; }
        borda.push({ q: s.q0 + dq, p: s.p0 + dp });
      }
      tempo = 0;
      area0 = area();
    }

    function area() {   // fórmula do cadarço
      var A = 0, n = borda.length;
      for (var i = 0; i < n; i++) {
        var a = borda[i], b = borda[(i + 1) % n];
        A += a.q * b.p - b.q * a.p;
      }
      return Math.abs(A) / 2;
    }

    /* Verlet de velocidade: integrador simplético, preserva a área
       do espaço de fase até a precisão da máquina. */
    function passo(dt) {
      var dV = SIS[est.sis].dV;
      for (var i = 0; i < borda.length; i++) {
        var o = borda[i];
        var a1 = -dV(o.q);
        o.p += 0.5 * dt * a1;
        o.q += dt * o.p;
        o.p += 0.5 * dt * (-dV(o.q));
      }
      tempo += dt;
    }

    function desenhar() {
      var s = SIS[est.sis];
      var ax = G.eixos(cv, {
        xmin: s.cq - s.lq, xmax: s.cq + s.lq,
        ymin: s.cp - s.lp, ymax: s.cp + s.lp, altura: 330,
        rotX: 'coordenada q', rotY: 'momento p',
        marcasX: G.marcasLineares(s.cq - s.lq, s.cq + s.lq, 4, 1),
        formataY: function (v) { return v.toFixed(1).replace('.', ','); }
      });

      // curvas de nível da energia, que são as trajetórias
      var ct = ax.ct;
      ct.save();
      ct.strokeStyle = G.COR.grade;
      ct.lineWidth = 1;
      [0.3, 0.8, 1.5, 2.4, 3.5].forEach(function (E) {
        ct.beginPath();
        var primeiro = true;
        for (var k = 0; k <= 400; k++) {
          var q = s.cq - s.lq + 2 * s.lq * k / 400;
          var V = est.sis === 'osc' ? 0.5 * q * q
                : est.sis === 'pend' ? 1 - Math.cos(q)
                : q;
          var p2 = 2 * (E - V);
          if (p2 < 0) { primeiro = true; continue; }
          var p = Math.sqrt(p2);
          if (primeiro) { ct.moveTo(ax.X(q), ax.Y(p)); primeiro = false; }
          else ct.lineTo(ax.X(q), ax.Y(p));
        }
        ct.stroke();
        ct.beginPath();
        primeiro = true;
        for (var k2 = 0; k2 <= 400; k2++) {
          var q2 = s.cq - s.lq + 2 * s.lq * k2 / 400;
          var V2 = est.sis === 'osc' ? 0.5 * q2 * q2
                 : est.sis === 'pend' ? 1 - Math.cos(q2)
                 : q2;
          var pp = 2 * (E - V2);
          if (pp < 0) { primeiro = true; continue; }
          var pn = -Math.sqrt(pp);
          if (primeiro) { ct.moveTo(ax.X(q2), ax.Y(pn)); primeiro = false; }
          else ct.lineTo(ax.X(q2), ax.Y(pn));
        }
        ct.stroke();
      });
      ct.restore();

      // a mancha
      ct.save();
      ct.beginPath();
      borda.forEach(function (o, i) {
        var x = ax.X(o.q), y = ax.Y(o.p);
        if (i) ct.lineTo(x, y); else ct.moveTo(x, y);
      });
      ct.closePath();
      ct.fillStyle = 'rgba(44,95,141,.26)';
      ct.fill();
      ct.strokeStyle = G.COR.azul;
      ct.lineWidth = 2;
      ct.stroke();
      ct.fillStyle = G.COR.azul;
      for (var b = 0; b < borda.length; b += 10) {
        ct.beginPath();
        ct.arc(ax.X(borda[b].q), ax.Y(borda[b].p), 1.6, 0, 2 * Math.PI);
        ct.fill();
      }
      ct.restore();

      var A = area();
      mostrar({
        t: F.fmt(tempo, 2), a0: F.fmt(area0, 4), a: F.fmt(A, 4),
        e: area0 ? F.pct((A - area0) / area0, 3) : '·'
      });
    }

    var ultimo = 0;
    function quadro(t) {
      var dt = Math.min(0.04, (t - ultimo) / 1000) || 0.016;
      ultimo = t;
      if (est.rodando) { for (var k = 0; k < 4; k++) passo(dt / 4); }
      desenhar();
      requestAnimationFrame(quadro);
    }

    reiniciar();
    requestAnimationFrame(quadro);
    window.addEventListener('resize', desenhar);
    tipografar(corpo);
  };


  /* =================================================================
     8. O zero absoluto por extrapolação
     Gases diferentes, em quantidades diferentes, dão retas P contra t
     de inclinações diferentes. Prolongadas, todas cruzam o eixo no
     mesmo ponto. É a evidência experimental de que a temperatura mede
     algo universal, e não uma propriedade de cada substância.
     ================================================================= */
  REGISTRO.kelvin = function (raiz) {
    var corpo = moldura(raiz, 'Por que o zero absoluto é o mesmo para todos os gases');

    var ZERO = -273.15;

    /* P0 é a pressão a 0 °C, que depende só da quantidade de gás posta no
       bulbo. tmin é a temperatura abaixo da qual aquele gás deixa de ser gás:
       ali a medida acaba e começa a extrapolação. */
    var GASES = [
      { nome: 'hélio', P0: 118, tmin: -268.9, cor: '#2c5f8d' },
      { nome: 'hidrogênio', P0: 96, tmin: -252.9, cor: '#1f6f54' },
      { nome: 'nitrogênio', P0: 74, tmin: -195.8, cor: '#b5831f' },
      { nome: 'oxigênio', P0: 52, tmin: -183.0, cor: '#8c2f39' },
      { nome: 'gás carbônico', P0: 31, tmin: -78.5, cor: '#7a5ea8' },
      { nome: 'ar (mistura)', P0: 62, tmin: -194.0, cor: '#1b7f9e', mistura: true }
    ];

    var est = { P0: 140, zoom: false };

    var cv = el('canvas');
    corpo.appendChild(cv);
    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);

    deslizante(ctr, 'quantidade do seu gás (pressão a 0 °C)', 20, 180, 1, 140,
      function (v) { est.P0 = v; desenhar(); },
      function (v) { return v + ' kPa'; });

    var cx = el('label', { class: 'caixa' });
    var chk = el('input', { type: 'checkbox' });
    cx.appendChild(chk);
    cx.appendChild(el('span', { texto: 'aproximar o cruzamento' }));
    chk.addEventListener('change', function () { est.zoom = chk.checked; desenhar(); });
    ctr.appendChild(cx);

    var mostrar = cartoes(corpo, [
      { rot: 'cruzamento do seu gás', k: 'z' },
      { rot: 'coeficiente \\(\\alpha=\\frac{1}{P_0}\\frac{dP}{dt}\\)', k: 'a' },
      { rot: '1/α', k: 'ia' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    function desenhar() {
      var tmin = est.zoom ? -290 : -300;
      var tmax = est.zoom ? -255 : 160;
      var pmax = est.zoom ? 14 : 260;

      var ax = G.eixos(cv, {
        xmin: tmin, xmax: tmax, ymin: 0, ymax: pmax, altura: 340,
        rotX: 'temperatura t (°C)', rotY: 'pressão P (kPa)',
        marcasX: est.zoom
          ? [-290, -283, -273.15, -266, -259].map(function (v) {
              return { v: v, r: v === -273.15 ? '-273,15' : String(v) };
            })
          : [-300, -200, -100, 0, 100].map(function (v) {
              return { v: v, r: String(v) };
            }),
        formataY: function (v) { return String(Math.round(v)); }
      });

      var ct = ax.ct;
      var todos = GASES.concat([{ nome: 'o seu gás', P0: est.P0,
                                  tmin: -270, cor: '#1b1f24', seu: true }]);

      todos.forEach(function (g) {
        var P = function (t) { return g.P0 * (1 + t / 273.15); };

        // trecho medido: do ponto em que o gás liquefaz para cima
        ct.save();
        ct.strokeStyle = g.cor;
        ct.lineWidth = g.seu ? 2.6 : 2;
        ct.beginPath();
        ct.moveTo(ax.X(Math.max(g.tmin, tmin)), ax.Y(P(Math.max(g.tmin, tmin))));
        ct.lineTo(ax.X(tmax), ax.Y(P(tmax)));
        ct.stroke();

        // extrapolação: tracejada, até o eixo
        ct.setLineDash([5, 4]);
        ct.lineWidth = 1.3;
        ct.beginPath();
        ct.moveTo(ax.X(ZERO), ax.Y(0));
        ct.lineTo(ax.X(Math.max(g.tmin, tmin)), ax.Y(P(Math.max(g.tmin, tmin))));
        ct.stroke();
        ct.restore();

        // onde a medida acaba
        if (g.tmin > tmin && g.tmin < tmax && !g.seu) {
          ct.save();
          ct.fillStyle = g.cor;
          ct.beginPath();
          ct.arc(ax.X(g.tmin), ax.Y(P(g.tmin)), 3.4, 0, 2 * Math.PI);
          ct.fill();
          ct.restore();
        }

        // rótulo na ponta direita da reta
        if (!est.zoom) {
          ct.save();
          ct.fillStyle = g.cor;
          ct.font = (g.seu ? '600 ' : '') + '11px system-ui, sans-serif';
          ct.textAlign = 'right';
          ct.textBaseline = 'bottom';
          ct.fillText(g.nome, ax.X(tmax) - 4, ax.Y(P(tmax)) - 3);
          ct.restore();
        }
      });

      // o ponto de encontro
      ct.save();
      ct.strokeStyle = G.COR.vinho;
      ct.setLineDash([3, 3]);
      ct.lineWidth = 1.2;
      ct.beginPath();
      ct.moveTo(ax.X(ZERO), ax.y0);
      ct.lineTo(ax.X(ZERO), ax.y1);
      ct.stroke();
      ct.setLineDash([]);
      ct.fillStyle = G.COR.vinho;
      ct.beginPath();
      ct.arc(ax.X(ZERO), ax.Y(0), 4.5, 0, 2 * Math.PI);
      ct.fill();
      ct.font = '600 11px system-ui, sans-serif';
      ct.textAlign = 'left';
      ct.textBaseline = 'top';
      ct.fillText('-273,15 °C = 0 K', ax.X(ZERO) + 7, ax.y0 + 2);
      ct.restore();

      var alfa = 1 / 273.15;
      mostrar({
        z: '-273,15 °C',
        a: F.fmt(alfa, 6) + ' /°C',
        ia: F.fmt(1 / alfa, 2) + ' °C'
      });

      nota.innerHTML = est.zoom
        ? 'Ampliado em torno do cruzamento: as cinco retas e a sua chegam ao eixo no mesmo '
          + 'ponto. Nenhuma delas foi ajustada para isso. Nas medidas reais de Charles e de '
          + 'Gay-Lussac, feitas com instrumentos do início do século XIX, o encontro já '
          + 'aparecia dentro do erro experimental.'
        : 'Mude a quantidade do seu gás: a reta gira, mas <b>em torno do mesmo ponto</b>. '
          + 'Os círculos marcam onde cada gás liquefaz e a medida acaba: do hélio em -268,9 °C '
          + 'ao gás carbônico em -78,5 °C. Dali para a esquerda tudo é extrapolação '
          + 'tracejada, e é justamente por isso que o resultado impressiona: cinco '
          + 'substâncias quimicamente distintas, que nem sequer chegam juntas até lá, '
          + 'apontam todas para o mesmo lugar. Repare que o <b>ar</b> está na lista: é uma '
          + 'mistura de nitrogênio, oxigênio, argônio e vapor d\'água, e mesmo assim se '
          + 'comporta como um gás só. Pela lei de Dalton, cada componente contribui com sua '
          + 'pressão parcial segundo a mesma reta, e somar retas que cruzam no mesmo ponto '
          + 'dá outra reta que cruza ali também.';
      tipografar(nota);
    }

    registrarRedesenho(desenhar);
    tipografar(corpo);
  };


  /* =================================================================
     9. Caminhante aleatório: a binomial e seu limite gaussiano
     Simula muitos caminhantes e compara o histograma com a binomial
     exata e com a gaussiana de Stirling. Mostra também que a largura
     cresce como raiz de N, e não como N.
     ================================================================= */
  REGISTRO.caminhante = function (raiz) {
    var corpo = moldura(raiz, 'O caminhante aleatório e o alargamento como raiz de N');

    var est = { N: 40, p: 0.5, nc: 2000, vista: 'hist' };
    var hist = {}, feitos = 0;

    var cv = el('canvas');
    corpo.appendChild(cv);
    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);

    opcoes(ctr, [
      { rot: 'Distribuição de chegada', v: 'hist' },
      { rot: 'Trajetórias', v: 'traj' }
    ], 0, function (v) { est.vista = v; desenhar(); });

    deslizante(ctr, 'passos \\(N\\)', 4, 400, 2, 40,
      function (v) { est.N = v; simular(); });
    deslizante(ctr, 'probabilidade \\(p\\) de ir à direita', 0.05, 0.95, 0.05, 0.5,
      function (v) { est.p = v; simular(); },
      function (v) { return v.toFixed(2).replace('.', ','); });
    deslizante(ctr, 'caminhantes', 100, 20000, 100, 2000,
      function (v) { est.nc = v; simular(); });

    var mostrar = cartoes(corpo, [
      { rot: '⟨m⟩ medido', k: 'mm' }, { rot: '(p−q)N previsto', k: 'mt' },
      { rot: 'σ medido', k: 'sm' }, { rot: '2√(Npq) previsto', k: 'st' },
      { rot: 'σ/N', k: 'rel' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    var trajs = [];

    function simular() {
      hist = {}; feitos = 0; trajs = [];
      var N = est.N, p = est.p;
      for (var c = 0; c < est.nc; c++) {
        var m = 0, caminho = (c < 12) ? [0] : null;
        for (var i = 0; i < N; i++) {
          m += (Math.random() < p) ? 1 : -1;
          if (caminho) caminho.push(m);
        }
        hist[m] = (hist[m] || 0) + 1;
        feitos++;
        if (caminho) trajs.push(caminho);
      }
      desenhar();
    }

    /* binomial exata em termos do deslocamento m = 2n1 - N */
    function pExata(m, N, p) {
      if ((N + m) % 2 !== 0) return 0;
      var n1 = (N + m) / 2;
      if (n1 < 0 || n1 > N) return 0;
      return F.pBinomial(N, n1, p);
    }

    function desenhar() {
      var N = est.N, p = est.p, q = 1 - p;
      var mT = (p - q) * N, sT = 2 * Math.sqrt(N * p * q);

      if (est.vista === 'traj') {
        var lim = Math.max(6, Math.abs(mT) + 3.2 * sT);
        var ax = G.eixos(cv, {
          xmin: 0, xmax: N, ymin: -lim, ymax: lim, altura: 320,
          rotX: 'número de passos', rotY: 'posição m',
          marcasX: G.marcasLineares(0, N, 5, 0),
          formataY: function (v) { return String(Math.round(v)); }
        });
        // envelope de mais e menos um desvio padrão, que cresce como raiz do passo
        ax.ct.save();
        ax.ct.strokeStyle = G.COR.vinho;
        ax.ct.setLineDash([5, 4]);
        ax.ct.lineWidth = 1.6;
        [1, -1].forEach(function (sig) {
          ax.ct.beginPath();
          for (var k = 0; k <= 200; k++) {
            var n = N * k / 200;
            var y = (p - q) * n + sig * 2 * Math.sqrt(n * p * q);
            if (k) ax.ct.lineTo(ax.X(n), ax.Y(y)); else ax.ct.moveTo(ax.X(n), ax.Y(y));
          }
          ax.ct.stroke();
        });
        ax.ct.restore();

        ax.ct.save();
        ax.ct.strokeStyle = G.COR.azulClaro;
        ax.ct.lineWidth = 1.2;
        ax.ct.globalAlpha = 0.85;
        trajs.forEach(function (t) {
          ax.ct.beginPath();
          t.forEach(function (y, i) {
            if (i) ax.ct.lineTo(ax.X(i), ax.Y(y)); else ax.ct.moveTo(ax.X(i), ax.Y(y));
          });
          ax.ct.stroke();
        });
        ax.ct.restore();
        G.legenda(ax, [
          { cor: G.COR.azulClaro, texto: 'doze caminhantes' },
          { cor: G.COR.vinho, texto: '\u27e8m\u27e9 \u00b1 \u03c3, com \u03c3 \u221d \u221an' }
        ]);
      } else {
        var lim2 = Math.max(4, Math.abs(mT) + 4 * sT);
        var topo = 0;
        Object.keys(hist).forEach(function (k) {
          topo = Math.max(topo, hist[k] / feitos);
        });
        for (var mm = -N; mm <= N; mm++) topo = Math.max(topo, pExata(mm, N, p));

        var ax2 = G.eixos(cv, {
          xmin: -lim2, xmax: lim2, ymin: 0, ymax: topo * 1.15, altura: 320,
          rotX: 'posição final m', rotY: 'probabilidade',
          marcasX: G.marcasLineares(-lim2, lim2, 6, 0),
          formataY: function (v) { return v.toFixed(3).replace('.', ','); }
        });

        var barras = [];
        Object.keys(hist).forEach(function (k) {
          barras.push({ x: Number(k), y: hist[k] / feitos });
        });
        G.barras(ax2, barras, G.COR.azulClaro, 1.6);

        // binomial exata: só existe nos m de mesma paridade que N
        ax2.ct.save();
        ax2.ct.fillStyle = G.COR.azul;
        for (var m2 = -N; m2 <= N; m2 += 2) {
          var pe = pExata(m2, N, p);
          if (pe > 0 && m2 >= -lim2 && m2 <= lim2) {
            ax2.ct.beginPath();
            ax2.ct.arc(ax2.X(m2), ax2.Y(pe), 2.4, 0, 2 * Math.PI);
            ax2.ct.fill();
          }
        }
        ax2.ct.restore();

        // gaussiana de Stirling: como só metade dos m é acessível, a
        // densidade por valor de m vale o dobro do espaçamento
        G.curva(ax2, function (x) {
          return 2 * F.dNormal(x, mT, sT);
        }, G.COR.vinho, 2);

        G.vertical(ax2, mT, G.COR.tinta, '\u27e8m\u27e9');
        G.legenda(ax2, [
          { cor: G.COR.azulClaro, texto: 'simulação' },
          { cor: G.COR.azul, texto: 'binomial exata' },
          { cor: G.COR.vinho, texto: 'gaussiana de Stirling' }
        ]);
      }

      var som = 0, som2 = 0;
      Object.keys(hist).forEach(function (k) {
        var v = Number(k), c = hist[k];
        som += v * c; som2 += v * v * c;
      });
      var md = feitos ? som / feitos : 0;
      var sd = feitos ? Math.sqrt(Math.max(0, som2 / feitos - md * md)) : 0;

      mostrar({
        mm: F.fmt(md, 3), mt: F.fmt(mT, 3),
        sm: F.fmt(sd, 3), st: F.fmt(sT, 3),
        rel: F.fmt(sT / N, 4)
      });

      nota.innerHTML = 'Com \\(N=' + N + '\\) passos, o caminhante se afasta tipicamente '
        + F.fmt(sT, 2) + ' posições da média, e não ' + N + '. O que cresce com \\(N\\) é o '
        + 'caminho percorrido; o que cresce com \\(\\sqrt{N}\\) é o <b>deslocamento</b>. '
        + 'A razão \\(\\sigma/N=' + F.fmt(sT / N, 4) + '\\) encolhe conforme \\(N\\) aumenta: '
        + 'em escala relativa, o caminhante fica cada vez mais previsível. '
        + 'Essa é a mesma raiz de \\(N\\) que governa a difusão, o ruído de contagem e a '
        + 'nitidez das grandezas termodinâmicas.';
      tipografar(nota);
    }

    simular();
    registrarRedesenho(desenhar);
    tipografar(corpo);
  };

  /* =================================================================
     10. Os três sistemas resolvidos no ensemble microcanônico
     Dois níveis, sólido de Einstein e paramagneto ideal, lado a lado.
     Tudo sai de S = kB ln Omega e de 1/T = ds/du, sem nenhum postulado
     adicional.
     ================================================================= */
  REGISTRO.microcanonico = function (raiz) {
    var corpo = moldura(raiz, 'Três sistemas resolvidos por contagem de microestados');

    /* Todas as grandezas em unidades da escala de energia do próprio
       sistema: x = u/epsilon para dois níveis, y = u/hbar.omega para o
       sólido de Einstein, w = u/(mu.B) para o paramagneto.
       Temperatura em unidades de epsilon/kB. */
    var MOD = {
      dois: {
        rot: 'Sistema de dois níveis',
        esc: '\\(\\epsilon\\)',
        /* s(u)/kB com x entre 0 e 1 */
        s: function (x) {
          if (x <= 0 || x >= 1) return 0;
          return -(1 - x) * Math.log(1 - x) - x * Math.log(x);
        },
        xmin: 0, xmax: 1, rotU: 'energia por partícula u/\u03b5',
        u: function (t) { return t <= 0 ? 0 : 1 / (1 + Math.exp(1 / t)); },
        c: function (t) {
          if (t <= 0) return 0;
          var x = 1 / t, e = Math.exp(x);
          return x * x * e / ((1 + e) * (1 + e));
        },
        umax: 1, tmax: 4
      },
      einstein: {
        rot: 'Sólido de Einstein',
        esc: '\\(\\hbar\\omega\\)',
        /* s(u)/kB com y = u/hbar.omega, válido para y > 1/2 */
        s: function (y) {
          if (y <= 0.5) return 0;
          return (y + 0.5) * Math.log(y + 0.5) - (y - 0.5) * Math.log(y - 0.5);
        },
        xmin: 0.5, xmax: 3.5, rotU: 'energia por oscilador u/\u210f\u03c9',
        /* u = (1/2) coth(1/2t) */
        u: function (t) {
          if (t <= 0) return 0.5;
          return 0.5 / Math.tanh(0.5 / t);
        },
        c: function (t) {
          if (t <= 0) return 0;
          var x = 1 / t;
          if (x > 700) return 0;
          var e = Math.exp(x);
          return x * x * e / ((e - 1) * (e - 1));
        },
        umax: 3.5, tmax: 3
      },
      para: {
        rot: 'Paramagneto ideal',
        esc: '\\(\\mu_0 B\\)',
        /* s(u)/kB com w = u/(mu.B) entre -1 e 0 (energia negativa) */
        s: function (w) {
          var a = 0.5 * (1 - w), b = 0.5 * (1 + w);
          if (a <= 0 || b <= 0) return 0;
          return -a * Math.log(a) - b * Math.log(b);
        },
        xmin: -1, xmax: 1, rotU: 'energia por spin u/\u03bc\u2080B',
        u: function (t) { return t <= 0 ? -1 : -Math.tanh(1 / t); },
        c: function (t) {
          if (t <= 0) return 0;
          var x = 1 / t, ch = Math.cosh(x);
          return x * x / (ch * ch);
        },
        m: function (t) { return t <= 0 ? 1 : Math.tanh(1 / t); },
        umax: 0, tmax: 4
      }
    };

    var est = { mod: 'dois', q: 's', T: 1 };

    var ctr1 = el('div', { class: 'controles' });
    corpo.appendChild(ctr1);
    opcoes(ctr1, Object.keys(MOD).map(function (k) {
      return { rot: MOD[k].rot, v: k };
    }), 0, function (v) {
      est.mod = v;
      cxM.style.display = (v === 'para') ? '' : 'none';
      if (v !== 'para' && est.q === 'm') trocaQ(1);
      desenhar();
    });

    var ctr2 = el('div', { class: 'controles' });
    corpo.appendChild(ctr2);
    var cxM;
    var trocaQ = opcoes(ctr2, [
      { rot: 'entropia s(u)', v: 's' },
      { rot: 'energia u(T)', v: 'u' },
      { rot: 'calor específico c(T)', v: 'c' },
      { rot: 'magnetização m(T)', v: 'm' }
    ], 0, function (v) { est.q = v; desenhar(); });
    cxM = ctr2.querySelector('.botoes').lastChild;
    cxM.style.display = 'none';

    var cv = el('canvas');
    corpo.appendChild(cv);

    deslizante(corpo, 'temperatura \\(\\kB T\\) em unidades da escala de energia',
      0.05, 4, 0.05, 1,
      function (v) { est.T = v; desenhar(); },
      function (v) { return v.toFixed(2).replace('.', ','); });

    var mostrar = cartoes(corpo, [
      { rot: 'u nesta temperatura', k: 'u' }, { rot: 's/k<sub>B</sub>', k: 's' },
      { rot: 'c/k<sub>B</sub>', k: 'c' }, { rot: 'pico de c em', k: 'pc' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    function picoC(M) {
      var melhor = 0, tp = 0;
      for (var i = 1; i <= 800; i++) {
        var t = M.tmax * i / 800, v = M.c(t);
        if (v > melhor) { melhor = v; tp = t; }
      }
      return { t: tp, c: melhor };
    }

    function desenhar() {
      var M = MOD[est.mod], ax;

      if (est.q === 's') {
        var smax = 0;
        for (var i = 0; i <= 400; i++) {
          smax = Math.max(smax, M.s(M.xmin + (M.xmax - M.xmin) * i / 400));
        }
        ax = G.eixos(cv, {
          xmin: M.xmin, xmax: M.xmax, ymin: 0, ymax: smax * 1.18, altura: 310,
          rotX: M.rotU, rotY: 'entropia por partícula s/k\u1D2E',
          marcasX: G.marcasLineares(M.xmin, M.xmax, 5, 1),
          formataY: function (v) { return v.toFixed(2).replace('.', ','); }
        });
        G.curva(ax, function (x) { return M.s(x); }, G.COR.azul, 2.4);

        // a inclinação da curva é 1/T: desenha a tangente no ponto atual
        var u0 = M.u(est.T), s0 = M.s(u0), h = 1e-4;
        var inc = (M.s(u0 + h) - M.s(u0 - h)) / (2 * h);
        ax.ct.save();
        ax.ct.strokeStyle = G.COR.vinho;
        ax.ct.lineWidth = 1.8;
        ax.ct.beginPath();
        var d = (M.xmax - M.xmin) * 0.22;
        ax.ct.moveTo(ax.X(u0 - d), ax.Y(s0 - inc * d));
        ax.ct.lineTo(ax.X(u0 + d), ax.Y(s0 + inc * d));
        ax.ct.stroke();
        ax.ct.fillStyle = G.COR.vinho;
        ax.ct.beginPath();
        ax.ct.arc(ax.X(u0), ax.Y(s0), 4, 0, 2 * Math.PI);
        ax.ct.fill();
        ax.ct.restore();
        G.legenda(ax, [
          { cor: G.COR.azul, texto: 's(u) = ln \u03a9 por partícula' },
          { cor: G.COR.vinho, texto: 'inclinação = 1/T' }
        ]);
      } else {
        var f = est.q === 'u' ? M.u : est.q === 'c' ? M.c : M.m;
        var ymin = 0, ymax = 0;
        for (var k = 1; k <= 400; k++) {
          var v = f(M.tmax * k / 400);
          ymin = Math.min(ymin, v); ymax = Math.max(ymax, v);
        }
        if (est.q === 'u') { ymin = Math.min(ymin, M.u(0.01)); ymax = Math.max(ymax, 0); }
        var folga = 0.12 * (ymax - ymin || 1);
        ax = G.eixos(cv, {
          xmin: 0, xmax: M.tmax, ymin: ymin - folga, ymax: ymax + folga, altura: 310,
          rotX: 'temperatura k\u1D2E T em unidades da escala de energia',
          rotY: est.q === 'u' ? 'energia por partícula'
              : est.q === 'c' ? 'calor específico c/k\u1D2E' : 'magnetização m/\u03bc\u2080',
          marcasX: G.marcasLineares(0, M.tmax, 4, 1),
          formataY: function (v) { return v.toFixed(2).replace('.', ','); }
        });
        G.curva(ax, function (t) { return t <= 0 ? f(1e-6) : f(t); }, G.COR.azul, 2.4);
        G.vertical(ax, est.T, G.COR.vinho, 'T');
      }

      var u = M.u(est.T), c = M.c(est.T), s = M.s(u);
      var pc = picoC(M);
      mostrar({
        u: F.fmt(u, 4), s: F.fmt(s, 4), c: F.fmt(c, 4),
        pc: 'k\u1D2ET = ' + F.fmt(pc.t, 3)
      });

      var txt;
      if (est.mod === 'dois') {
        txt = 'A entropia tem um <b>máximo</b> em \\(u=\\epsilon/2\\), onde metade das '
            + 'partículas está excitada. Ali a inclinação \\(1/T\\) se anula, o que '
            + 'significa \\(T\\to\\infty\\). Para \\(u>\\epsilon/2\\) a inclinação fica '
            + 'negativa: são as famosas <b>temperaturas absolutas negativas</b>, mais '
            + 'quentes que infinito, possíveis apenas porque o espectro de energia é '
            + 'limitado por cima. É também a razão pela qual um sistema de dois níveis '
            + 'não serve como laser: a inversão de população que ele exigiria é '
            + 'inalcançável em equilíbrio.';
      } else if (est.mod === 'einstein') {
        txt = 'Em temperaturas altas, \\(c\\to\\kB\\) por oscilador, e como cada átomo do '
            + 'sólido vale três osciladores isso dá \\(3\\kB\\) por átomo: é a '
            + '<b>lei de Dulong e Petit</b>, de 1819. Em temperaturas baixas, \\(c\\) cai '
            + 'exponencialmente e a energia tende a \\(\\hbar\\omega/2\\), a energia de ponto '
            + 'zero, que não vai a lugar nenhum. Foi este modelo, em 1906, o primeiro uso da '
            + 'quantização fora da radiação.';
      } else {
        txt = 'A energia por spin é \\(u=-\\mu_0 B\\tanh(\\mu_0B/\\kB T)\\) e a magnetização '
            + 'segue a mesma tangente hiperbólica. Para campo fraco ou temperatura alta, '
            + '\\(\\tanh x\\approx x\\) e a susceptibilidade vira '
            + '\\(\\chi=\\mu_0^2/(\\kB T V)\\): é a <b>lei de Curie</b>, com '
            + '\\(\\chi\\propto 1/T\\), obtida aqui sem nenhum ajuste. O calor específico '
            + 'tem o mesmo pico de Schottky do sistema de dois níveis, e pela mesma razão: '
            + 'são o mesmo problema com outro nome.';
      }
      nota.innerHTML = txt;
      tipografar(nota);
    }

    desenhar();
    registrarRedesenho(desenhar);
    tipografar(corpo);
  };

  /* =================================================================
     11. Equilíbrio térmico por contagem
     Dois sólidos de Einstein trocam quanta. O produto Omega1.Omega2
     tem um pico, e o pico fica mais estreito conforme N cresce. É a
     origem microscópica da irreversibilidade.
     ================================================================= */
  REGISTRO.equilibrio = function (raiz) {
    var corpo = moldura(raiz, 'Equilíbrio térmico: por que a energia se reparte assim');

    var est = { NA: 60, NB: 40, q: 100 };

    var cv = el('canvas');
    corpo.appendChild(cv);
    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);

    deslizante(ctr, 'osciladores em A, \\(N_A\\)', 10, 600, 10, 60,
      function (v) { est.NA = v; desenhar(); });
    deslizante(ctr, 'osciladores em B, \\(N_B\\)', 10, 600, 10, 40,
      function (v) { est.NB = v; desenhar(); });
    deslizante(ctr, 'quanta de energia a repartir, \\(q\\)', 20, 1200, 10, 100,
      function (v) { est.q = v; desenhar(); });

    var mostrar = cartoes(corpo, [
      { rot: 'q<sub>A</sub> mais provável', k: 'qa' },
      { rot: 'previsto: q·N<sub>A</sub>/(N<sub>A</sub>+N<sub>B</sub>)', k: 'qp' },
      { rot: 'largura relativa do pico', k: 'lg' },
      { rot: 'fração dos estados no pico', k: 'fr' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    /* Omega de um sólido de Einstein com N osciladores e q quanta */
    function lnOmega(q, N) { return F.lnBinom(q + N - 1, q); }

    function desenhar() {
      var NA = est.NA, NB = est.NB, Q = est.q;
      var lnP = [], maior = -Infinity, iMax = 0, i;
      for (i = 0; i <= Q; i++) {
        var L = lnOmega(i, NA) + lnOmega(Q - i, NB);
        lnP.push(L);
        if (L > maior) { maior = L; iMax = i; }
      }
      // normaliza para probabilidade
      var soma = 0, prob = [];
      for (i = 0; i <= Q; i++) { prob.push(Math.exp(lnP[i] - maior)); soma += prob[i]; }
      for (i = 0; i <= Q; i++) prob[i] /= soma;

      var pmax = 0;
      for (i = 0; i <= Q; i++) pmax = Math.max(pmax, prob[i]);

      var ax = G.eixos(cv, {
        xmin: 0, xmax: Q, ymin: 0, ymax: pmax * 1.15, altura: 310,
        rotX: 'quanta no sólido A, q\u2090',
        rotY: 'probabilidade \u221d \u03a9\u2090\u03a9\u2091',
        marcasX: G.marcasLineares(0, Q, 5, 0),
        formataY: function (v) { return v.toFixed(3).replace('.', ','); }
      });

      var dados = [];
      for (i = 0; i <= Q; i++) dados.push({ x: i, y: prob[i] });
      G.barras(ax, dados, G.COR.azulClaro, 1);

      var qprev = Q * NA / (NA + NB);
      G.vertical(ax, qprev, G.COR.vinho, 'q\u00b7N\u2090/(N\u2090+N\u2091)');

      // desvio padrão da distribuição
      var md = 0, md2 = 0;
      for (i = 0; i <= Q; i++) { md += i * prob[i]; md2 += i * i * prob[i]; }
      var sig = Math.sqrt(Math.max(0, md2 - md * md));

      // fração dos estados dentro de um desvio padrão do pico
      var dentro = 0;
      for (i = 0; i <= Q; i++) if (Math.abs(i - md) <= sig) dentro += prob[i];

      mostrar({
        qa: String(iMax), qp: F.fmt(qprev, 2),
        lg: md > 0 ? F.pct(sig / md, 2) : '·',
        fr: F.pct(dentro, 1)
      });

      var Ntot = NA + NB;
      nota.innerHTML =
        'O pico fica em \\(q_A/N_A = q_B/N_B\\), isto é, onde a energia por oscilador é a '
        + 'mesma nos dois sólidos. Nenhuma lei nova foi usada: é só onde o produto '
        + '\\(\\Omega_A\\Omega_B\\) é máximo, ou seja, onde há mais maneiras de arranjar o '
        + 'sistema composto. A condição \\(\\partial S_A/\\partial U_A = \\partial S_B/'
        + '\\partial U_B\\) é exatamente \\(T_A=T_B\\).</p>'
        + '<p>Agora puxe os deslizantes de \\(N_A\\) e \\(N_B\\) para cima. A largura '
        + 'relativa do pico, agora em ' + (md > 0 ? F.pct(sig / md, 2) : '·')
        + ', encolhe como \\(1/\\sqrt{N}\\). Com ' + Ntot + ' osciladores ela ainda se vê; '
        + 'com \\(10^{23}\\) ela seria de uma parte em \\(10^{11}\\), e o sistema nunca, '
        + 'em tempo algum de observação, seria flagrado fora do pico. <b>A '
        + 'irreversibilidade é isto</b>: não uma proibição, mas um pico estreito demais '
        + 'para se escapar dele.';
      nota.innerHTML = '<p>' + nota.innerHTML;
      tipografar(nota);
    }

    registrarRedesenho(desenhar);
    tipografar(corpo);
  };


  /* =================================================================
     12. Estado de equilíbrio e o caminho que não existe
     Dois pistões lado a lado. Comprimindo devagar, o gás permanece
     uniforme e o estado percorre uma curva no diagrama PV. Comprimindo
     de repente, a pressão deixa de ser a mesma em toda parte e o
     sistema simplesmente não tem um ponto no diagrama: só os extremos.
     ================================================================= */
  REGISTRO.estadopv = function (raiz) {
    var corpo = moldura(raiz, 'Quando o sistema tem um ponto no diagrama PV, e quando não tem');

    var V1 = 1.0, V2 = 0.42, P1 = 100;       // isoterma: PV = const
    var est = { modo: 'lento', t: 0, rodando: false };
    var rastro = [];

    var cv = el('canvas');
    corpo.appendChild(cv);
    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);

    opcoes(ctr, [
      { rot: 'Compressão quase-estática', v: 'lento' },
      { rot: 'Compressão brusca', v: 'brusco' }
    ], 0, function (v) { est.modo = v; reiniciar(); });

    var bP = el('button', { type: 'button', texto: 'comprimir' });
    var bR = el('button', { type: 'button', class: 'sec', texto: 'reiniciar' });
    bP.addEventListener('click', function () {
      if (est.t >= 1) reiniciar();
      est.rodando = true;
    });
    bR.addEventListener('click', reiniciar);
    ctr.appendChild(el('div', { class: 'botoes' }, [bP, bR]));

    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    function reiniciar() { est.t = 0; est.rodando = false; rastro = []; texto(); }

    function volume(t) { return V1 + (V2 - V1) * t; }
    function pIsoterma(V) { return P1 * V1 / V; }

    /* Num processo brusco a pressão junto ao pistão é maior que longe
       dele: é essa diferença que impede falar em "a pressão do gás". */
    function desequilibrio(t) {
      if (est.modo === 'lento') return 0;
      return (t > 0 && t < 1) ? 0.55 * Math.sin(Math.PI * t) : 0;
    }

    function desenhar() {
      var p = G.preparar(cv, 330);
      var ct = p.ct;
      var larguraCil = Math.min(p.L * 0.40, 300);
      var alt = 150, cx = 14, cy = 40;

      var t = est.t, V = volume(t), d = desequilibrio(t);
      var Pmedia = pIsoterma(V);

      /* ---------- cilindro ---------- */
      var fracao = V / V1;
      var larg = larguraCil * fracao;

      // gás, com gradiente quando há desequilíbrio
      var g = ct.createLinearGradient(cx, 0, cx + larg, 0);
      if (d > 0) {
        g.addColorStop(0, 'rgba(44,95,141,.16)');
        g.addColorStop(1, 'rgba(140,47,57,.52)');
      } else {
        g.addColorStop(0, 'rgba(44,95,141,.30)');
        g.addColorStop(1, 'rgba(44,95,141,.30)');
      }
      ct.fillStyle = g;
      ct.fillRect(cx, cy, larg, alt);

      // paredes e pistão
      ct.strokeStyle = G.COR.tinta;
      ct.lineWidth = 1.6;
      ct.beginPath();
      ct.moveTo(cx, cy); ct.lineTo(cx, cy + alt);
      ct.moveTo(cx, cy); ct.lineTo(cx + larguraCil + 26, cy);
      ct.moveTo(cx, cy + alt); ct.lineTo(cx + larguraCil + 26, cy + alt);
      ct.stroke();
      ct.fillStyle = G.COR.suave;
      ct.fillRect(cx + larg, cy, 9, alt);

      // seta do empurrão, maior no caso brusco
      ct.save();
      ct.strokeStyle = d > 0 ? G.COR.vinho : G.COR.suave;
      ct.lineWidth = d > 0 ? 3 : 1.8;
      var xs = cx + larg + 12, ys = cy + alt / 2, cmp = d > 0 ? 34 : 20;
      ct.beginPath();
      ct.moveTo(xs + cmp, ys); ct.lineTo(xs, ys);
      ct.lineTo(xs + 7, ys - 5); ct.moveTo(xs, ys); ct.lineTo(xs + 7, ys + 5);
      ct.stroke();
      ct.restore();

      // rótulo do estado do gás
      ct.save();
      ct.font = '600 11px system-ui, sans-serif';
      ct.textAlign = 'left';
      ct.textBaseline = 'top';
      if (d > 0) {
        ct.fillStyle = G.COR.vinho;
        ct.fillText('pressão não uniforme: P não está definida', cx, cy + alt + 10);
        ct.font = '11px system-ui, sans-serif';
        ct.fillStyle = G.COR.suave;
        ct.fillText('mais densa junto ao pistão', cx, cy + alt + 26);
      } else {
        ct.fillStyle = G.COR.azul;
        ct.fillText('gás uniforme: P = ' + F.fmt(Pmedia, 1) + ' kPa', cx, cy + alt + 10);
        ct.font = '11px system-ui, sans-serif';
        ct.fillStyle = G.COR.suave;
        ct.fillText('um estado de equilíbrio a cada instante', cx, cy + alt + 26);
      }
      ct.restore();

      /* ---------- diagrama PV ---------- */
      var gx = cx + larguraCil + 80, gl = p.L - gx - 18;
      if (gl < 140) return;
      var gy = 22, ga = 230;
      var vmin = 0.3, vmax = 1.15, pmin = 60, pmax = 280;
      function X(v) { return gx + (v - vmin) / (vmax - vmin) * gl; }
      function Y(q) { return gy + ga - (q - pmin) / (pmax - pmin) * ga; }

      ct.save();
      ct.strokeStyle = G.COR.grade;
      ct.lineWidth = 1;
      for (var k = 0; k <= 4; k++) {
        var yy = gy + ga * k / 4;
        ct.beginPath(); ct.moveTo(gx, yy); ct.lineTo(gx + gl, yy); ct.stroke();
      }
      ct.strokeStyle = G.COR.suave;
      ct.lineWidth = 1.2;
      ct.beginPath();
      ct.moveTo(gx, gy); ct.lineTo(gx, gy + ga); ct.lineTo(gx + gl, gy + ga);
      ct.stroke();
      ct.fillStyle = G.COR.suave;
      ct.font = '600 11px system-ui, sans-serif';
      ct.textAlign = 'center';
      ct.fillText('volume V', gx + gl / 2, gy + ga + 26);
      ct.save();
      ct.translate(gx - 24, gy + ga / 2);
      ct.rotate(-Math.PI / 2);
      ct.fillText('pressão P', 0, 0);
      ct.restore();
      ct.restore();

      // a isoterma de referência, sempre em cinza claro
      ct.save();
      ct.strokeStyle = G.COR.grade;
      ct.lineWidth = 1.4;
      ct.beginPath();
      for (var i = 0; i <= 120; i++) {
        var v = vmin + (vmax - vmin) * i / 120, q = pIsoterma(v);
        if (q < pmin || q > pmax) continue;
        if (i) ct.lineTo(X(v), Y(q)); else ct.moveTo(X(v), Y(q));
      }
      ct.stroke();
      ct.restore();

      // estados inicial e final, sempre definidos
      [[V1, P1, '1'], [V2, pIsoterma(V2), '2']].forEach(function (s) {
        ct.save();
        ct.fillStyle = G.COR.tinta;
        ct.beginPath();
        ct.arc(X(s[0]), Y(s[1]), 4.5, 0, 2 * Math.PI);
        ct.fill();
        ct.font = '600 12px system-ui, sans-serif';
        ct.textAlign = 'center';
        ct.fillText(s[2], X(s[0]), Y(s[1]) - 11);
        ct.restore();
      });

      if (est.modo === 'lento') {
        // o rastro é o próprio caminho: cada ponto é um estado de equilíbrio
        ct.save();
        ct.strokeStyle = G.COR.azul;
        ct.lineWidth = 2.6;
        ct.beginPath();
        rastro.forEach(function (r, i) {
          if (i) ct.lineTo(X(r[0]), Y(r[1])); else ct.moveTo(X(r[0]), Y(r[1]));
        });
        ct.stroke();
        if (t > 0 && t < 1) {
          ct.fillStyle = G.COR.vinho;
          ct.beginPath();
          ct.arc(X(V), Y(Pmedia), 4, 0, 2 * Math.PI);
          ct.fill();
        }
        ct.restore();
      } else {
        // caminho inexistente: seta tracejada e uma interrogação
        ct.save();
        ct.strokeStyle = G.COR.vinho;
        ct.setLineDash([6, 5]);
        ct.lineWidth = 1.8;
        ct.beginPath();
        var xa = X(V1), ya = Y(P1), xb = X(V2), yb = Y(pIsoterma(V2));
        ct.moveTo(xa, ya);
        ct.quadraticCurveTo((xa + xb) / 2 - 26, (ya + yb) / 2 - 34, xb, yb);
        ct.stroke();
        ct.setLineDash([]);
        if (t > 0 && t < 1) {
          ct.fillStyle = G.COR.vinho;
          ct.font = '700 20px system-ui, sans-serif';
          ct.textAlign = 'center';
          ct.textBaseline = 'middle';
          ct.fillText('?', (xa + xb) / 2 - 16, (ya + yb) / 2 - 20);
        }
        ct.restore();
      }
    }

    function texto() {
      nota.innerHTML = est.modo === 'lento'
        ? '<p>Comprimindo devagar, o gás tem tempo de se reacomodar a cada instante. A '
          + 'pressão é a mesma em toda parte, e por isso o par \\((P,V)\\) existe e é único: '
          + 'o sistema <b>tem um ponto</b> no diagrama. Uma sucessão de equilíbrios desenha '
          + 'uma curva, e o trabalho \\(\\int P\\,dV\\) é a área sob ela.</p>'
        : '<p>Comprimindo de repente, o gás junto ao pistão fica mais denso antes que o resto '
          + 'perceba. Há pressões diferentes em pontos diferentes, e portanto <b>não existe '
          + '"a pressão do gás"</b>. Sem \\(P\\) definida, não há ponto no diagrama: o '
          + 'sistema some do gráfico durante o processo e só reaparece no fim, quando o '
          + 'equilíbrio se restabelece.</p>'
          + '<p>Por isso a seta aparece tracejada, com uma interrogação. Ela não é um '
          + 'caminho: é só um lembrete de que o sistema foi de 1 a 2. E por isso também '
          + '\\(\\int P\\,dV\\) não pode ser calculada aqui, embora o trabalho realizado '
          + 'exista e seja perfeitamente mensurável pela força no pistão. O estado inicial e '
          + 'o final continuam bem definidos, e com eles \\(\\Delta U\\) e \\(\\Delta S\\), '
          + 'que são funções de estado.</p>'
          + '<p>Os pontos 1 e 2 são os mesmos nos dois modos porque o cilindro está num '
          + 'banho térmico: depois da compressão brusca, espera-se o gás voltar à '
          + 'temperatura do banho. Mesmo estado inicial, mesmo estado final, caminhos '
          + 'incomparáveis. Compare agora os dois trabalhos: no caminho quase-estático '
          + 'ele é a área sob a curva; no brusco é maior, porque é preciso empurrar contra '
          + 'uma pressão que o próprio empurrão aumentou. A diferença foi dissipada, e é '
          + 'ela que faz \\(\\Delta S_{\\text{universo}}>0\\).</p>';
      tipografar(nota);
    }

    var ultimo = 0;
    function quadro(ts) {
      var dt = Math.min(0.05, (ts - ultimo) / 1000) || 0.016;
      ultimo = ts;
      if (est.rodando && est.t < 1) {
        est.t = Math.min(1, est.t + dt / (est.modo === 'lento' ? 4.5 : 0.9));
        if (est.modo === 'lento') {
          var V = volume(est.t);
          rastro.push([V, pIsoterma(V)]);
        }
        if (est.t >= 1) est.rodando = false;
      }
      desenhar();
      requestAnimationFrame(quadro);
    }

    texto();
    requestAnimationFrame(quadro);
    window.addEventListener('resize', desenhar);
    tipografar(corpo);
  };


  /* =================================================================
     13. Movimento browniano e a pesagem do átomo
     Integra a equação de Langevin superamortecida em unidades reais,
     mede o deslocamento quadrático médio e, de posse dele, refaz a
     medida de Perrin do número de Avogadro.
     ================================================================= */
  REGISTRO.browniano = function (raiz) {
    var corpo = moldura(raiz, 'Movimento browniano: medindo o número de Avogadro');

    var est = { T: 293, a: 0.5, eta: 1.0, n: 200, vista: 'traj', rodando: true };
    var part = [], tempo = 0, serie = [];
    var ESCALA = 40e-6;        // meio campo de visão, em metros

    var cv = el('canvas');
    corpo.appendChild(cv);
    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);

    opcoes(ctr, [
      { rot: 'Trajetórias', v: 'traj' },
      { rot: '⟨x²⟩ contra o tempo', v: 'msd' },
      { rot: 'Perfil de difusão', v: 'perfil' }
    ], 0, function (v) { est.vista = v; });

    deslizante(ctr, 'temperatura', 273, 350, 1, 293,
      function (v) { est.T = v; reiniciar(); },
      function (v) { return v + ' K'; });
    deslizante(ctr, 'raio do grão \\(a\\)', 0.1, 3, 0.1, 0.5,
      function (v) { est.a = v; reiniciar(); },
      function (v) { return v.toFixed(1).replace('.', ',') + ' µm'; });
    deslizante(ctr, 'viscosidade \\(\\eta\\)', 0.3, 5, 0.1, 1.0,
      function (v) { est.eta = v; reiniciar(); },
      function (v) { return v.toFixed(1).replace('.', ',') + ' mPa·s'; });
    deslizante(ctr, 'grãos observados', 20, 800, 20, 200,
      function (v) { est.n = v; reiniciar(); });

    var bP = el('button', { type: 'button', texto: 'pausar' });
    var bR = el('button', { type: 'button', class: 'sec', texto: 'reiniciar' });
    bP.addEventListener('click', function () {
      est.rodando = !est.rodando;
      bP.textContent = est.rodando ? 'pausar' : 'continuar';
    });
    bR.addEventListener('click', reiniciar);
    ctr.appendChild(el('div', { class: 'botoes' }, [bP, bR]));

    var mostrar = cartoes(corpo, [
      { rot: 'D previsto, k<sub>B</sub>T/6πηa', k: 'dt' },
      { rot: 'D medido do ajuste', k: 'dm' },
      { rot: 'tempo decorrido', k: 't' },
      { rot: 'N<sub>A</sub> obtido', k: 'na' },
      { rot: 'erro em N<sub>A</sub>', k: 'er' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    function Dteorico() {
      // a em micrômetros, eta em mPa.s
      return F.C.kB * est.T / (6 * Math.PI * (est.eta * 1e-3) * (est.a * 1e-6));
    }

    function reiniciar() {
      part = [];
      for (var i = 0; i < est.n; i++) part.push({ x: 0, y: 0, hx: [0], hy: [0] });
      tempo = 0; serie = [];
    }

    function passo(dt) {
      var D = Dteorico();
      var s = Math.sqrt(2 * D * dt);
      for (var i = 0; i < part.length; i++) {
        var p = part[i];
        p.x += s * F.normalAleatoria();
        p.y += s * F.normalAleatoria();
        if (i < 9 && p.hx.length < 4000) { p.hx.push(p.x); p.hy.push(p.y); }
      }
      tempo += dt;
      var m2 = 0;
      part.forEach(function (q) { m2 += q.x * q.x; });
      serie.push([tempo, m2 / part.length]);
      if (serie.length > 3000) serie.shift();
    }

    /* Ajuste de reta pela origem: <x²> = 2Dt, logo D = soma(t.y)/(2.soma(t²)) */
    function ajuste() {
      var sty = 0, stt = 0;
      serie.forEach(function (s) { sty += s[0] * s[1]; stt += s[0] * s[0]; });
      return stt > 0 ? sty / (2 * stt) : 0;
    }

    function desenhar() {
      var D = Dteorico(), Dm = ajuste();

      if (est.vista === 'traj') {
        var p = G.preparar(cv, 330);
        var ct = p.ct;
        var lado = Math.min(p.L - 24, p.A - 24);
        var ox = (p.L - lado) / 2, oy = (p.A - lado) / 2;
        function X(v) { return ox + (v / ESCALA + 1) / 2 * lado; }
        function Y(v) { return oy + (1 - (v / ESCALA + 1) / 2) * lado; }

        ct.save();
        ct.strokeStyle = G.COR.grade;
        ct.strokeRect(ox, oy, lado, lado);
        // barra de escala de 10 micrômetros
        var bl = lado * (10e-6 / (2 * ESCALA));
        ct.strokeStyle = G.COR.tinta;
        ct.lineWidth = 2;
        ct.beginPath();
        ct.moveTo(ox + 12, oy + lado - 14); ct.lineTo(ox + 12 + bl, oy + lado - 14);
        ct.stroke();
        ct.fillStyle = G.COR.tinta;
        ct.font = '11px system-ui, sans-serif';
        ct.fillText('10 µm', ox + 12, oy + lado - 20);

        // nuvem de grãos
        ct.fillStyle = 'rgba(44,95,141,.55)';
        part.forEach(function (q) {
          ct.beginPath();
          ct.arc(X(q.x), Y(q.y), 1.6, 0, 2 * Math.PI);
          ct.fill();
        });
        // algumas trajetórias, como nos desenhos de Perrin
        ct.strokeStyle = G.COR.vinho;
        ct.lineWidth = 1;
        part.slice(0, 9).forEach(function (q) {
          ct.beginPath();
          for (var k = 0; k < q.hx.length; k += 3) {
            if (k) ct.lineTo(X(q.hx[k]), Y(q.hy[k]));
            else ct.moveTo(X(q.hx[k]), Y(q.hy[k]));
          }
          ct.stroke();
        });
        ct.restore();

      } else if (est.vista === 'msd') {
        var tmax = Math.max(1, tempo) * 1.05;
        var ymax = Math.max(1e-14, 2 * D * tmax * 1.4);
        var ax = G.eixos(cv, {
          xmin: 0, xmax: tmax, ymin: 0, ymax: ymax, altura: 320,
          rotX: 'tempo (s)', rotY: '⟨x²⟩ (m²)',
          marcasX: G.marcasLineares(0, tmax, 5, 1),
          formataY: function (v) { return v === 0 ? '0' : (v * 1e12).toFixed(1).replace('.', ',') + 'µm²'; }
        });
        ax.ct.save();
        ax.ct.strokeStyle = G.COR.azul;
        ax.ct.lineWidth = 2;
        ax.ct.beginPath();
        serie.forEach(function (s, i) {
          if (i) ax.ct.lineTo(ax.X(s[0]), ax.Y(s[1]));
          else ax.ct.moveTo(ax.X(s[0]), ax.Y(s[1]));
        });
        ax.ct.stroke();
        ax.ct.restore();
        G.curva(ax, function (t) { return 2 * D * t; }, G.COR.vinho, 1.8, [6, 4]);
        G.legenda(ax, [
          { cor: G.COR.azul, texto: 'medido sobre ' + est.n + ' grãos' },
          { cor: G.COR.vinho, texto: '2Dt previsto' }
        ]);

      } else {
        var lim = Math.max(1e-7, 3.2 * Math.sqrt(2 * D * Math.max(tempo, 0.01)));
        var nb = 30, h = new Array(nb).fill(0);
        part.forEach(function (q) {
          var b = Math.floor((q.x + lim) / (2 * lim) * nb);
          if (b >= 0 && b < nb) h[b]++;
        });
        var larg = 2 * lim / nb;
        var dmax = 0, dens = h.map(function (c) {
          var d = c / part.length / larg;
          if (d > dmax) dmax = d;
          return d;
        });
        var teo = function (x) {
          var s2 = 2 * D * Math.max(tempo, 1e-6);
          return Math.exp(-x * x / (2 * s2)) / Math.sqrt(2 * Math.PI * s2);
        };
        dmax = Math.max(dmax, teo(0)) * 1.2;
        var ax2 = G.eixos(cv, {
          xmin: -lim, xmax: lim, ymin: 0, ymax: dmax, altura: 320,
          rotX: 'posição x (µm)', rotY: 'densidade de grãos',
          marcasX: G.marcasLineares(-lim, lim, 4, 0).map(function (m) {
            return { v: m.v, r: (m.v * 1e6).toFixed(0) };
          }),
          formataY: function () { return ''; }
        });
        var barras = [];
        for (var i = 0; i < nb; i++) {
          barras.push({ x: -lim + (i + 0.5) * larg, y: dens[i] });
        }
        G.barras(ax2, barras, G.COR.azulClaro, 0.9);
        G.curva(ax2, teo, G.COR.vinho, 2.2);
        G.legenda(ax2, [
          { cor: G.COR.azulClaro, texto: 'grãos' },
          { cor: G.COR.vinho, texto: 'solução de Fick, σ² = 2Dt' }
        ]);
      }

      /* Perrin: de D medido tira-se NA, porque kB = R/NA */
      var NA = Dm > 0
        ? F.C.R * est.T / (6 * Math.PI * (est.eta * 1e-3) * (est.a * 1e-6) * Dm)
        : 0;
      mostrar({
        dt: F.fmt(D * 1e12, 3) + ' µm²/s',
        dm: Dm > 0 ? F.fmt(Dm * 1e12, 3) + ' µm²/s' : '·',
        t: F.fmt(tempo, 2) + ' s',
        na: NA > 0 ? F.fmt(NA, 3) : '·',
        er: NA > 0 ? F.pct(Math.abs(NA - F.C.NA) / F.C.NA, 1) : '·'
      });
    }

    function texto() {
      nota.innerHTML =
        '<p>Cada grão segue a equação de Langevin no regime superamortecido, em que a '
        + 'inércia já foi esquecida e sobra o balanço entre o arrasto de Stokes e o '
        + 'bombardeio molecular. O deslocamento quadrático médio cresce linearmente no '
        + 'tempo, \\(\\med{x^2}=2Dt\\), com '
        + '\\[D=\\frac{\\kB T}{6\\pi\\eta a}.\\]</p>'
        + '<p><b>E aqui está a medida de Perrin.</b> A constante dos gases \\(R\\) era '
        + 'conhecida desde o século XIX, e \\(\\kB=R/N_A\\). Logo, medir \\(D\\) com um '
        + 'microscópio e um cronômetro dá</p>'
        + '\\[N_A=\\frac{RT}{6\\pi\\eta a D},\\]'
        + '<p>que é o número de Avogadro obtido sem nenhuma química. Jean Perrin fez '
        + 'exatamente isso em 1908, com grãos de resina de guta-percha, e publicou '
        + '\\(N_A\\approx 7\\times 10^{23}\\): errado por uns 15%, mas <b>da ordem certa</b> '
        + 'e em acordo com os valores vindos de experimentos completamente diferentes. Foi o '
        + 'argumento que convenceu os últimos céticos de que átomos existem, e rendeu a '
        + 'Perrin o Nobel de 1926. Einstein havia previsto a fórmula em 1905, num dos quatro '
        + 'artigos daquele ano.</p>'
        + '<p>Note o que o widget mostra: o \\(N_A\\) obtido aqui é exato até a flutuação '
        + 'estatística, porque a simulação <em>usa</em> \\(\\kB\\) para gerar os passos. O '
        + 'que se está testando não é a física, e sim quanta precisão a medida permite com '
        + '\\(n\\) grãos e um dado tempo de observação. Reduza o número de grãos para ver o '
        + 'erro crescer, que é exatamente a dificuldade que Perrin enfrentou no microscópio.</p>';
      tipografar(nota);
    }

    var ultimo = 0;
    function quadro(ts) {
      var dt = Math.min(0.05, (ts - ultimo) / 1000) || 0.016;
      ultimo = ts;
      if (est.rodando) passo(dt);
      desenhar();
      requestAnimationFrame(quadro);
    }

    reiniciar();
    texto();
    requestAnimationFrame(quadro);
    window.addEventListener('resize', desenhar);
    tipografar(corpo);
  };

  /* =================================================================
     14. O modelo das urnas de Ehrenfest e o teorema H
     N bolas em duas urnas; a cada instante uma bola sorteada troca de
     lado. A dinâmica é perfeitamente reversível e ainda assim H cai.
     Mostra também a recorrência de Poincaré, que leva 2^N passos.
     ================================================================= */
  REGISTRO.ehrenfest = function (raiz) {
    var corpo = moldura(raiz, 'Urnas de Ehrenfest: como uma dinâmica reversível produz H decrescente');

    var est = { N: 100, vel: 60, rodando: true };
    var nA = 0, passos = 0, serieN = [], serieH = [], minimoVisto = 0;

    var cv = el('canvas');
    corpo.appendChild(cv);
    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);

    deslizante(ctr, 'número de bolas \\(N\\)', 10, 400, 10, 100,
      function (v) { est.N = v; reiniciar(); });
    deslizante(ctr, 'passos por quadro', 1, 400, 1, 60,
      function (v) { est.vel = v; });

    var bP = el('button', { type: 'button', texto: 'pausar' });
    var bR = el('button', { type: 'button', class: 'sec', texto: 'reiniciar' });
    bP.addEventListener('click', function () {
      est.rodando = !est.rodando;
      bP.textContent = est.rodando ? 'pausar' : 'continuar';
    });
    bR.addEventListener('click', reiniciar);
    ctr.appendChild(el('div', { class: 'botoes' }, [bP, bR]));

    var mostrar = cartoes(corpo, [
      { rot: 'bolas na urna A', k: 'na' },
      { rot: 'passos dados', k: 'ps' },
      { rot: 'H atual', k: 'h' },
      { rot: 'mínimo de H já visto', k: 'hm' },
      { rot: 'tempo de recorrência ≈ 2ᴺ', k: 'rec' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    function H(k) {
      var N = est.N, p1 = k / N, p2 = 1 - p1;
      var h = 0;
      if (p1 > 0) h += p1 * Math.log(p1);
      if (p2 > 0) h += p2 * Math.log(p2);
      return h;                                   // H = soma f ln f, negativo
    }

    function reiniciar() {
      nA = est.N; passos = 0;                     // começa com tudo numa urna
      serieN = [[0, nA]]; serieH = [[0, H(nA)]];
      minimoVisto = H(nA);
      texto();
    }

    function passo() {
      // sorteia uma bola entre as N e a passa para a outra urna
      if (Math.random() < nA / est.N) nA--; else nA++;
      passos++;
      var h = H(nA);
      if (h < minimoVisto) minimoVisto = h;
      serieN.push([passos, nA]);
      serieH.push([passos, h]);
      if (serieN.length > 1800) { serieN.shift(); serieH.shift(); }
    }

    function desenhar() {
      var p = G.preparar(cv, 330);
      var ct = p.ct;

      /* ---- urnas ---- */
      var uw = Math.min(p.L * 0.17, 130), uh = 120, uy = 14;
      [0, 1].forEach(function (u) {
        var ux = 14 + u * (uw + 18);
        var qtd = u === 0 ? nA : est.N - nA;
        ct.save();
        ct.strokeStyle = G.COR.tinta; ct.lineWidth = 1.4;
        ct.strokeRect(ux, uy, uw, uh);
        ct.fillStyle = u === 0 ? 'rgba(44,95,141,.75)' : 'rgba(140,47,57,.75)';
        var cols = Math.ceil(Math.sqrt(est.N * uw / uh));
        var r = Math.max(1.2, Math.min(uw / cols / 2.4, 4));
        for (var i = 0; i < qtd; i++) {
          var cxp = ux + 4 + (i % cols) * (uw - 8) / cols + r;
          var cyp = uy + uh - 5 - Math.floor(i / cols) * (r * 2.3) - r;
          if (cyp < uy + 3) break;
          ct.beginPath(); ct.arc(cxp, cyp, r, 0, 2 * Math.PI); ct.fill();
        }
        ct.fillStyle = G.COR.tinta;
        ct.font = '600 12px system-ui, sans-serif';
        ct.textAlign = 'center';
        ct.fillText((u === 0 ? 'A: ' : 'B: ') + qtd, ux + uw / 2, uy + uh + 16);
        ct.restore();
      });

      /* ---- gráficos ---- */
      var gx = 14 + 2 * uw + 46, gl = p.L - gx - 16;
      if (gl < 140) return;
      var p0 = passos > 1800 ? passos - 1800 : 0;
      var pmax = Math.max(60, passos);

      // ocupação da urna A
      var ga = 112, gy = 14;
      function px(v) { return gx + (v - p0) / (pmax - p0 || 1) * gl; }
      function pyN(v) { return gy + ga - v / est.N * ga; }
      ct.save();
      ct.strokeStyle = G.COR.grade;
      ct.strokeRect(gx, gy, gl, ga);
      ct.setLineDash([4, 3]);
      ct.beginPath();
      ct.moveTo(gx, pyN(est.N / 2)); ct.lineTo(gx + gl, pyN(est.N / 2));
      ct.stroke();
      ct.setLineDash([]);
      ct.strokeStyle = G.COR.azul; ct.lineWidth = 1.4;
      ct.beginPath();
      serieN.forEach(function (s, i) {
        if (i) ct.lineTo(px(s[0]), pyN(s[1])); else ct.moveTo(px(s[0]), pyN(s[1]));
      });
      ct.stroke();
      ct.fillStyle = G.COR.suave;
      ct.font = '11px system-ui, sans-serif';
      ct.textAlign = 'left';
      ct.fillText('bolas na urna A (tracejado: N/2)', gx + 4, gy + 12);
      ct.restore();

      // H
      var gy2 = gy + ga + 30, ga2 = 112;
      var hmin = -Math.log(2) * 1.08, hmax = 0.06;
      function pyH(v) { return gy2 + ga2 - (v - hmin) / (hmax - hmin) * ga2; }
      ct.save();
      ct.strokeStyle = G.COR.grade;
      ct.strokeRect(gx, gy2, gl, ga2);
      ct.setLineDash([4, 3]);
      ct.beginPath();
      ct.moveTo(gx, pyH(-Math.log(2))); ct.lineTo(gx + gl, pyH(-Math.log(2)));
      ct.stroke();
      ct.setLineDash([]);
      ct.strokeStyle = G.COR.vinho; ct.lineWidth = 1.6;
      ct.beginPath();
      serieH.forEach(function (s, i) {
        if (i) ct.lineTo(px(s[0]), pyH(s[1])); else ct.moveTo(px(s[0]), pyH(s[1]));
      });
      ct.stroke();
      ct.fillStyle = G.COR.suave;
      ct.font = '11px system-ui, sans-serif';
      ct.fillText('H = Σ f ln f  (tracejado: o mínimo, −ln 2)', gx + 4, gy2 + 12);
      ct.textAlign = 'center';
      ct.fillText('passos', gx + gl / 2, gy2 + ga2 + 18);
      ct.restore();

      var rec = est.N * Math.LN2 / Math.LN10;
      mostrar({
        na: String(nA), ps: String(passos),
        h: F.fmt(H(nA), 4), hm: F.fmt(minimoVisto, 4),
        rec: '10' + '<sup>' + rec.toFixed(0) + '</sup> passos'
      });
    }

    function texto() {
      var rec = est.N * Math.LN2 / Math.LN10;
      nota.innerHTML =
        '<p>Duas urnas e \\(N\\) bolas numeradas. A cada passo, sorteia-se um número de 1 a '
        + '\\(N\\) e a bola correspondente <b>troca de urna</b>. Nada mais. A regra é '
        + 'simétrica no tempo: aplicada ao contrário, é exatamente a mesma regra.</p>'
        + '<p>Começamos com todas as bolas na urna A, e a quantidade \\(H=\\sum_i f_i\\ln f_i\\) '
        + 'despenca até o mínimo \\(-\\ln 2\\), onde as urnas estão equilibradas, e ali fica '
        + 'flutuando. Isso é o <b>teorema H</b> de Boltzmann acontecendo num modelo que cabe '
        + 'em cinco linhas de código. Note que \\(H=-S/\\kB N\\): H caindo é entropia '
        + 'subindo.</p>'
        + '<p><b>O paradoxo e sua dissolução.</b> Loschmidt objetou a Boltzmann que, se as '
        + 'leis da mecânica são reversíveis, nenhuma consequência delas pode ser '
        + 'irreversível. Ele estava certo quanto à premissa. A resposta está na tela: a '
        + 'dinâmica aqui é reversível e o estado inicial <em>pode</em> voltar. Só que o '
        + 'tempo típico para isso é da ordem de \\(2^{N}\\) passos, hoje cerca de '
        + '\\(10^{' + rec.toFixed(0) + '}\\). Com \\(N=20\\) a volta acontece enquanto o '
        + 'senhor observa; com \\(N=400\\), nunca.</p>'
        + '<p>Reduza \\(N\\) até 10 ou 20 e veja H subir de volta com frequência. Aumente '
        + 'para 400 e as flutuações somem. Não há nenhuma lei nova entre os dois casos: só '
        + 'há \\(1/\\sqrt N\\).</p>';
      tipografar(nota);
    }

    var ultimo = 0;
    function quadro() {
      if (est.rodando) {
        for (var k = 0; k < est.vel; k++) passo();
      }
      desenhar();
      requestAnimationFrame(quadro);
    }

    reiniciar();
    requestAnimationFrame(quadro);
    window.addEventListener('resize', desenhar);
    tipografar(corpo);
  };


  /* =================================================================
     15. Contar estados no espaço de fase
     A casca entre E e E+dE, com a malha de células de área h desenhada
     por cima. A contagem clássica é a área dividida por h; a quântica é
     o número de níveis na faixa. As duas coincidem, e é isso que
     justifica dividir toda integral de fase por h.
     Unidades reduzidas: m = 1, hbar = 1, logo h = 2*pi.
     ================================================================= */
  REGISTRO.contarestados = function (raiz) {
    var corpo = moldura(raiz, 'Contar estados: a casca de energia e as células de área h');

    var H = 2 * Math.PI;      // h, com hbar = 1
    var est = { sis: 'caixa', E: 2.0, dE: 1.0, L: 20, w: 1.0 };

    var ctr0 = el('div', { class: 'controles' });
    corpo.appendChild(ctr0);
    opcoes(ctr0, [
      { rot: 'Partícula na caixa', v: 'caixa' },
      { rot: 'Oscilador harmônico', v: 'osc' }
    ], 0, function (v) {
      est.sis = v;
      campoL.parentNode.style.display = v === 'caixa' ? '' : 'none';
      campoW.parentNode.style.display = v === 'osc' ? '' : 'none';
      desenhar();
    });

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    deslizante(ctr, 'energia \\(E\\)', 0.3, 8, 0.1, 2.0,
      function (v) { est.E = v; desenhar(); },
      function (v) { return v.toFixed(1).replace('.', ','); });
    deslizante(ctr, 'largura da faixa \\(\\delta E\\)', 0.05, 2, 0.05, 1.0,
      function (v) { est.dE = v; desenhar(); },
      function (v) { return v.toFixed(2).replace('.', ','); });
    var campoL = deslizante(ctr, 'lado da caixa \\(L\\)', 4, 30, 1, 20,
      function (v) { est.L = v; desenhar(); },
      function (v) { return v.toFixed(1).replace('.', ','); });
    var campoW = deslizante(ctr, 'frequência \\(\\omega\\)', 0.3, 3, 0.1, 1.0,
      function (v) { est.w = v; desenhar(); },
      function (v) { return v.toFixed(1).replace('.', ','); });
    campoW.parentNode.style.display = 'none';

    var mostrar = cartoes(corpo, [
      { rot: 'área da casca', k: 'a' },
      { rot: 'área / h', k: 'oc' },
      { rot: 'níveis quânticos na faixa', k: 'oq' },
      { rot: 'diferença', k: 'df' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    function pDe(E) { return Math.sqrt(2 * E); }        // m = 1

    /* Área da casca e contagem quântica, para cada sistema */
    function conta() {
      if (est.sis === 'caixa') {
        var area = 2 * est.L * (pDe(est.E + est.dE) - pDe(est.E));
        // E_n = pi^2 n^2 / (2 L^2), com n = 1, 2, 3...
        var k = Math.PI * Math.PI / (2 * est.L * est.L);
        var n1 = Math.ceil(Math.sqrt(est.E / k) - 1e-12);
        var n2 = Math.floor(Math.sqrt((est.E + est.dE) / k) + 1e-12);
        return { area: area, oc: area / H, oq: Math.max(0, n2 - n1 + 1) };
      }
      var a2 = 2 * Math.PI * est.dE / est.w;
      // E_n = (n + 1/2) omega, com n = 0, 1, 2...
      var m1 = Math.ceil(est.E / est.w - 0.5 - 1e-12);
      var m2 = Math.floor((est.E + est.dE) / est.w - 0.5 + 1e-12);
      return { area: a2, oc: a2 / H, oq: Math.max(0, m2 - m1 + 1) };
    }

    function desenhar() {
      var c = conta();
      var pmax = pDe(8 + 2) * 1.08;
      var qmax = est.sis === 'caixa' ? est.L * 1.18
               : Math.sqrt(2 * 10) / est.w * 1.15;

      var ax = G.eixos(cv, {
        xmin: est.sis === 'caixa' ? -0.1 * est.L : -qmax,
        xmax: qmax,
        ymin: -pmax, ymax: pmax, altura: 340,
        rotX: 'coordenada q', rotY: 'momento p',
        marcasX: G.marcasLineares(est.sis === 'caixa' ? 0 : -qmax, qmax, 4, 1),
        formataY: function (v) { return v.toFixed(1).replace('.', ','); }
      });
      var ct = ax.ct;

      /* ---- a casca acessível ---- */
      ct.save();
      ct.fillStyle = 'rgba(44,95,141,.26)';
      if (est.sis === 'caixa') {
        var pa = pDe(est.E), pb = pDe(est.E + est.dE);
        [1, -1].forEach(function (s) {
          ct.fillRect(ax.X(0), ax.Y(s > 0 ? pb : -pa),
                      ax.X(est.L) - ax.X(0),
                      Math.abs(ax.Y(pa) - ax.Y(pb)));
        });
      } else {
        // anel entre duas elipses: p = +-sqrt(2(E - w^2 q^2 / 2))
        function elipse(E, sentido) {
          var qm = Math.sqrt(2 * E) / est.w;
          ct.beginPath();
          for (var i = 0; i <= 160; i++) {
            var q = -qm + 2 * qm * i / 160;
            var v = 2 * (E - 0.5 * est.w * est.w * q * q);
            var pp = sentido * Math.sqrt(Math.max(0, v));
            if (i) ct.lineTo(ax.X(q), ax.Y(pp)); else ct.moveTo(ax.X(q), ax.Y(pp));
          }
          for (var j = 160; j >= 0; j--) {
            var q2 = -qm + 2 * qm * j / 160;
            var v2 = 2 * (E - 0.5 * est.w * est.w * q2 * q2);
            ct.lineTo(ax.X(q2), ax.Y(-sentido * Math.sqrt(Math.max(0, v2))));
          }
          ct.closePath();
        }
        ct.beginPath();
        elipse(est.E + est.dE, 1);
        ct.fill();
        ct.save();
        ct.globalCompositeOperation = 'destination-out';
        elipse(est.E, 1);
        ct.fill();
        ct.restore();
      }
      ct.restore();

      /* ---- contorno das curvas de energia ---- */
      ct.save();
      ct.strokeStyle = G.COR.azul;
      ct.lineWidth = 1.8;
      if (est.sis === 'caixa') {
        [pDe(est.E), -pDe(est.E), pDe(est.E + est.dE), -pDe(est.E + est.dE)]
          .forEach(function (pp) {
            ct.beginPath();
            ct.moveTo(ax.X(0), ax.Y(pp)); ct.lineTo(ax.X(est.L), ax.Y(pp));
            ct.stroke();
          });
        ct.strokeStyle = G.COR.tinta;
        ct.lineWidth = 2.2;
        [0, est.L].forEach(function (q) {
          ct.beginPath();
          ct.moveTo(ax.X(q), ax.Y(-pmax)); ct.lineTo(ax.X(q), ax.Y(pmax));
          ct.stroke();
        });
      } else {
        [est.E, est.E + est.dE].forEach(function (EE) {
          var qm = Math.sqrt(2 * EE) / est.w;
          [1, -1].forEach(function (s) {
            ct.beginPath();
            for (var i = 0; i <= 200; i++) {
              var q = -qm + 2 * qm * i / 200;
              var vv = 2 * (EE - 0.5 * est.w * est.w * q * q);
              var pp = s * Math.sqrt(Math.max(0, vv));
              if (i) ct.lineTo(ax.X(q), ax.Y(pp)); else ct.moveTo(ax.X(q), ax.Y(pp));
            }
            ct.stroke();
          });
        });
      }
      ct.restore();

      /* ---- malha de células de área h ---- */
      /* A célula tem área h fixa; escolhe-se o formato para que ela fique
         com proporção parecida com a do gráfico, e não um risco fino. */
      var faixaQ = qmax - ax.xmin, faixaP = 2 * pmax;
      var dq = Math.sqrt(H * faixaQ / faixaP);
      var dp = H / dq;
      ct.save();
      ct.strokeStyle = 'rgba(140,47,57,.45)';
      ct.lineWidth = 1;
      var q0 = est.sis === 'caixa' ? 0 : -Math.ceil(qmax / dq) * dq;
      for (var q = q0; q <= qmax + 1e-9; q += dq) {
        ct.beginPath();
        ct.moveTo(ax.X(q), ax.Y(-pmax)); ct.lineTo(ax.X(q), ax.Y(pmax));
        ct.stroke();
      }
      for (var pp2 = 0; pp2 <= pmax; pp2 += dp) {
        [pp2, -pp2].forEach(function (y) {
          ct.beginPath();
          ct.moveTo(ax.X(ax.xmin), ax.Y(y)); ct.lineTo(ax.X(qmax), ax.Y(y));
          ct.stroke();
        });
      }
      // uma célula destacada, para dar a escala
      ct.fillStyle = 'rgba(181,131,31,.45)';
      ct.strokeStyle = G.COR.ambar;
      ct.lineWidth = 1.6;
      var nf = Math.max(1, Math.floor(pmax / dp));
      var cxq = q0, cyp = -nf * dp;
      ct.fillRect(ax.X(cxq), ax.Y(cyp + dp), ax.X(cxq + dq) - ax.X(cxq),
                  ax.Y(cyp) - ax.Y(cyp + dp));
      ct.strokeRect(ax.X(cxq), ax.Y(cyp + dp), ax.X(cxq + dq) - ax.X(cxq),
                    ax.Y(cyp) - ax.Y(cyp + dp));
      ct.fillStyle = G.COR.ambar;
      ct.font = '600 11px system-ui, sans-serif';
      ct.textAlign = 'left';
      ct.fillText('uma célula tem área h', ax.X(cxq) + 4, ax.Y(cyp + dp) - 6);
      ct.restore();

      G.legenda(ax, [
        { cor: G.COR.azul, texto: 'curvas E e E + δE' },
        { cor: 'rgba(44,95,141,.6)', texto: 'casca acessível' }
      ]);

      mostrar({
        a: F.fmt(c.area, 3),
        oc: F.fmt(c.oc, 3),
        oq: String(c.oq),
        df: c.oq > 0 ? F.pct(Math.abs(c.oc - c.oq) / c.oq, 1)
                     : (c.oc < 1 ? 'faixa vazia' : '·')
      });

      var txt;
      if (est.sis === 'caixa') {
        txt = 'A região acessível são duas faixas, uma para cada sentido do momento, de '
            + 'comprimento \\(L\\) e altura \\(\\delta p\\). A área é '
            + '\\(\\Omega_{\\text{área}} = 2L\\,\\delta p = L\\sqrt{2m/E}\\,\\delta E\\), e '
            + 'dividindo por \\(h\\) obtém-se um número que o cartão compara com a contagem '
            + 'quântica exata dos níveis \\(E_n=\\hbar^2\\pi^2n^2/2mL^2\\) dentro da faixa. '
            + 'Para \\(\\delta E\\) pequeno a contagem quântica pula de um em um e a '
            + 'clássica varia continuamente: aumente \\(\\delta E\\) e veja as duas se '
            + 'aproximarem.';
      } else {
        txt = 'Aqui a casca é o anel entre duas elipses, de área '
            + '\\(2\\pi\\,\\delta E/\\omega\\), que não depende de \\(E\\): a densidade de '
            + 'estados do oscilador é constante. Dividindo por \\(h=2\\pi\\hbar\\) sobra '
            + '\\(\\delta E/\\hbar\\omega\\), que é <b>exatamente</b> o número de níveis '
            + '\\(E_n=(n+\\tfrac12)\\hbar\\omega\\) na faixa. O acordo aqui não é '
            + 'aproximado: é identidade.';
      }
      nota.innerHTML = '<p>' + txt + '</p>'
        + '<p>A moral é a mesma nos dois casos. A mecânica clássica fornece <b>áreas</b> no '
        + 'espaço de fase, que têm dimensão de ação e não são números puros. Para contar '
        + 'estados é preciso dividir por uma unidade de ação, e a natureza fornece uma: '
        + '\\(h\\). Cada estado quântico ocupa uma célula de área \\(h\\) por grau de '
        + 'liberdade, de modo que em \\(f\\) graus a divisão é por \\(h^f\\). Sem esse '
        + 'fator, a entropia ficaria indeterminada por uma constante aditiva, que é '
        + 'justamente o \\(K\\) que ficou pendente no fim do Módulo 1.</p>';
      tipografar(nota);
    }

    registrarRedesenho(desenhar);
    tipografar(corpo);
  };


  /* =================================================================
     16. A contagem, vista de perto
     Para N pequeno os microestados são desenhados um a um; para N
     grande resta o gráfico de Omega contra U, que é onde o pico
     aparece. O mesmo widget serve aos três sistemas do módulo.
     ================================================================= */
  REGISTRO.multiplicidade = function (raiz) {
    var corpo = moldura(raiz, 'A contagem de microestados, desenhada');

    var MOD = {
      dois: {
        rot: 'Dois níveis',
        /* k = número de partículas excitadas; U = k.epsilon */
        kmax: function (N) { return N; },
        lnOmega: function (k, N) { return F.lnBinom(N, k); },
        rotU: 'energia U / \u03b5',
        valU: function (k) { return k; },
        legenda: 'cada quadradinho é uma partícula: vazio no nível 0, cheio no nível \u03b5',
        /* devolve as configurações como vetores de 0 e 1 */
        enumera: function (k, N, limite) {
          var saida = [];
          (function rec(i, resta, atual) {
            if (saida.length >= limite) return;
            if (i === N) { if (resta === 0) saida.push(atual.slice()); return; }
            atual.push(0); rec(i + 1, resta, atual); atual.pop();
            if (resta > 0) { atual.push(1); rec(i + 1, resta - 1, atual); atual.pop(); }
          })(0, k, []);
          return saida;
        }
      },
      para: {
        rot: 'Paramagneto ideal',
        kmax: function (N) { return N; },
        lnOmega: function (k, N) { return F.lnBinom(N, k); },
        rotU: 'spins contra o campo',
        valU: function (k) { return k; },
        legenda: 'cada seta é um spin: para cima alinhado ao campo, para baixo contra ele',
        enumera: null          // usa o mesmo enumerador do caso de dois níveis
      },
      einstein: {
        rot: 'Sólido de Einstein',
        /* k = número de quanta distribuídos entre N osciladores */
        kmax: function () { return null; },
        lnOmega: function (k, N) { return F.lnBinom(k + N - 1, k); },
        rotU: 'quanta de energia q',
        valU: function (k) { return k; },
        legenda: 'cada coluna é um oscilador, e cada bolinha um quantum nele',
        enumera: function (k, N, limite) {
          var saida = [];
          (function rec(i, resta, atual) {
            if (saida.length >= limite) return;
            if (i === N - 1) { atual.push(resta); saida.push(atual.slice()); atual.pop(); return; }
            for (var v = resta; v >= 0; v--) {
              if (saida.length >= limite) return;
              atual.push(v); rec(i + 1, resta - v, atual); atual.pop();
            }
          })(0, k, []);
          return saida;
        }
      }
    };

    var est = { mod: 'dois', N: 6, k: 3, Q: 6 };

    var ctr0 = el('div', { class: 'controles' });
    corpo.appendChild(ctr0);
    opcoes(ctr0, Object.keys(MOD).map(function (m) {
      return { rot: MOD[m].rot, v: m };
    }), 0, function (v) {
      est.mod = v;
      campoQ.parentNode.style.display = (v === 'einstein') ? '' : 'none';
      if (v === 'einstein' && est.N > 5) {
        est.N = 4; campoN.value = 4; campoN.dispatchEvent(new Event('input'));
      }
      ajustar(); desenhar();
    });

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    var campoN = deslizante(ctr, 'partículas \\(N\\)', 2, 200, 1, 6,
      function (v) { est.N = v; ajustar(); desenhar(); });
    var campoQ = deslizante(ctr, 'quanta totais disponíveis', 2, 60, 1, 6,
      function (v) { est.Q = v; ajustar(); desenhar(); });
    campoQ.parentNode.style.display = 'none';
    var campoK = deslizante(ctr, 'macroestado em destaque', 0, 6, 1, 3,
      function (v) { est.k = v; desenhar(); });

    var mostrar = cartoes(corpo, [
      { rot: '\u03a9 do macroestado', k: 'om' },
      { rot: '\u03a9 total (todos os U)', k: 'ot' },
      { rot: 'fração dos microestados', k: 'fr' },
      { rot: 'S/k<sub>B</sub> = ln \u03a9', k: 's' }
    ]);
    var painel = el('div', { class: 'microestados' });
    corpo.appendChild(painel);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    function faixaK() {
      return est.mod === 'einstein' ? est.Q : est.N;
    }

    function ajustar() {
      var fk = faixaK();
      campoK.max = fk;
      if (est.k > fk) { est.k = Math.round(fk / 2); }
      campoK.value = est.k;
      campoK.dispatchEvent(new Event('input'));
    }

    function desenhar() {
      var M = MOD[est.mod], fk = faixaK(), i;
      var lns = [], maior = -Infinity;
      for (i = 0; i <= fk; i++) {
        var L = M.lnOmega(i, est.N);
        lns.push(L);
        if (L > maior) maior = L;
      }
      var om = [], total = 0;
      for (i = 0; i <= fk; i++) { om.push(Math.exp(lns[i] - maior)); total += om[i]; }

      var ax = G.eixos(cv, {
        xmin: -0.6, xmax: fk + 0.6, ymin: 0, ymax: 1.15, altura: 250,
        rotX: M.rotU, rotY: '\u03a9 (em unidades do máximo)',
        marcasX: G.marcasInteiras(0, fk, 12),
        formataY: function (v) { return v.toFixed(1).replace('.', ','); }
      });
      var dados = [];
      for (i = 0; i <= fk; i++) dados.push({ x: i, y: om[i] });
      G.barras(ax, dados, G.COR.azulClaro, 0.76);
      // destaque
      ax.ct.save();
      ax.ct.fillStyle = G.COR.vinho;
      var passo = (ax.x1 - ax.x0) / (ax.xmax - ax.xmin);
      var larg = Math.max(2, passo * 0.76);
      ax.ct.fillRect(ax.X(est.k) - larg / 2, ax.Y(om[est.k]), larg,
                     ax.y1 - ax.Y(om[est.k]));
      ax.ct.restore();

      var lnTotal = maior + Math.log(total);
      var lnEste = lns[est.k];
      mostrar({
        om: lnEste > 30 ? 'e<sup>' + F.fmt(lnEste, 1) + '</sup>'
                        : F.fmt(Math.exp(lnEste), 0),
        ot: lnTotal > 30 ? 'e<sup>' + F.fmt(lnTotal, 1) + '</sup>'
                         : F.fmt(Math.exp(lnTotal), 0),
        fr: F.pct(Math.exp(lnEste - lnTotal), 2),
        s: F.fmt(lnEste, 3)
      });

      /* ---- os microestados, um a um, quando couberem ---- */
      var LIM = 56;
      var qtd = Math.exp(lnEste);
      if (est.N <= 10 && qtd <= LIM && (est.mod !== 'einstein' || est.N <= 6)) {
        var enumera = M.enumera || MOD.dois.enumera;
        var confs = enumera(est.k, est.N, LIM);
        var html = '<p class="legenda">' + M.legenda + '. Aqui estão <b>todos</b> os '
                 + confs.length + ' microestados deste macroestado.</p><div class="grade-micro">';
        confs.forEach(function (c) {
          html += '<div class="micro">';
          c.forEach(function (v) {
            if (est.mod === 'para') {
              html += '<span class="spin' + (v ? ' baixo' : '') + '">'
                    + (v ? '\u2193' : '\u2191') + '</span>';
            } else if (est.mod === 'dois') {
              html += '<span class="cx' + (v ? ' cheio' : '') + '"></span>';
            } else {
              html += '<span class="osc">';
              for (var z = 0; z < v; z++) html += '<i></i>';
              html += '</span>';
            }
          });
          html += '</div>';
        });
        html += '</div>';
        painel.innerHTML = html;
      } else {
        painel.innerHTML = '<p class="legenda">Este macroestado tem microestados demais para '
          + 'desenhar um a um. Reduza \\(N\\) para dez ou menos, e escolha um macroestado '
          + 'perto das pontas, onde \\(\\Omega\\) é pequeno.</p>';
        tipografar(painel);
      }

      var txt;
      if (est.mod === 'einstein') {
        txt = 'Com \\(N\\) osciladores e \\(q\\) quanta, o número de maneiras de repartir é '
            + '\\(\\Omega=\\binom{q+N-1}{q}\\), o problema das barras e estrelas. Note que '
            + '\\(\\Omega\\) <b>cresce</b> com a energia sem limite: um sólido não tem teto '
            + 'de energia, e por isso nunca tem temperatura negativa.';
      } else if (est.mod === 'para') {
        txt = 'Com \\(k\\) spins apontando contra o campo, \\(\\Omega=\\binom{N}{k}\\) e a '
            + 'energia é \\(U=(2k-N)\\mu_0B\\). O máximo está em \\(k=N/2\\), a '
            + 'magnetização nula, que é o estado mais desordenado. Os extremos \\(k=0\\) e '
            + '\\(k=N\\) têm um único microestado cada, e portanto entropia zero.';
      } else {
        txt = 'Com \\(k\\) partículas excitadas, \\(\\Omega=\\binom{N}{k}\\) e \\(U=k\\epsilon\\). '
            + 'É literalmente a mesma conta do caminhante aleatório do início do módulo, com '
            + '"excitada" no lugar de "passo à direita". Daí a lição: três sistemas físicos '
            + 'diferentes, uma única combinatória.';
      }
      nota.innerHTML = '<p>' + txt + '</p>'
        + '<p>Aumente \\(N\\) e observe o que acontece com o gráfico: o pico <b>estreita</b>. '
        + 'Com \\(N=6\\) os macroestados das pontas ainda são visíveis; com \\(N=200\\) '
        + 'praticamente toda a probabilidade está concentrada numa vizinhança estreitíssima '
        + 'do máximo. Essa concentração é o que torna a termodinâmica possível: o valor mais '
        + 'provável vira o único valor observável.</p>';
      tipografar(nota);
    }

    ajustar();
    registrarRedesenho(desenhar);
    tipografar(corpo);
  };


  /* =================================================================
     17. A distribuição de Boltzmann e a função de partição
     Os níveis de energia com suas populações, e Z construída termo a
     termo. Tudo o mais sai por diferenciação de ln Z.
     ================================================================= */
  REGISTRO.boltzmann = function (raiz) {
    var corpo = moldura(raiz, 'Distribuição de Boltzmann: a função de partição em ação');

    /* Níveis em unidades da escala de energia de cada sistema.
       g é a degenerescência. T em unidades da mesma escala sobre kB. */
    var SIS = {
      dois: {
        rot: 'Dois níveis',
        niveis: function () { return [{ E: 0, g: 1 }, { E: 1, g: 1 }]; },
        esc: '\u03b5'
      },
      osc: {
        rot: 'Oscilador harmônico',
        niveis: function () {
          var v = [];
          for (var n = 0; n < 9; n++) v.push({ E: n + 0.5, g: 1 });
          return v;
        },
        esc: '\u210f\u03c9'
      },
      hid: {
        rot: 'Níveis degenerados (g = 2n+1)',
        niveis: function () {
          var v = [];
          for (var n = 0; n < 6; n++) v.push({ E: n, g: 2 * n + 1 });
          return v;
        },
        esc: '\u0394'
      }
    };

    var est = { sis: 'dois', T: 0.7 };

    var ctr0 = el('div', { class: 'controles' });
    corpo.appendChild(ctr0);
    opcoes(ctr0, Object.keys(SIS).map(function (k) {
      return { rot: SIS[k].rot, v: k };
    }), 0, function (v) { est.sis = v; desenhar(); });

    var cv = el('canvas');
    corpo.appendChild(cv);

    deslizante(corpo, 'temperatura \\(\\kB T\\), em unidades da escala de energia',
      0.05, 5, 0.05, 0.7,
      function (v) { est.T = v; desenhar(); },
      function (v) { return v.toFixed(2).replace('.', ','); });

    var mostrar = cartoes(corpo, [
      { rot: 'Z por partícula', k: 'z' },
      { rot: 'f = \u2212k<sub>B</sub>T ln Z', k: 'f' },
      { rot: 'u = \u2212\u2202 ln Z/\u2202\u03b2', k: 'u' },
      { rot: 's/k<sub>B</sub>', k: 's' },
      { rot: 'c/k<sub>B</sub>', k: 'c' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    /* Z, u e c calculados diretamente da soma sobre os níveis */
    function termo() {
      var nv = SIS[est.sis].niveis(), b = 1 / est.T;
      var Z = 0, s1 = 0, s2 = 0;
      nv.forEach(function (n) {
        var w = n.g * Math.exp(-b * n.E);
        Z += w; s1 += w * n.E; s2 += w * n.E * n.E;
      });
      var u = s1 / Z;
      var var2 = s2 / Z - u * u;             // <E²> - <E>² = kB T² c
      return { nv: nv, Z: Z, u: u, c: var2 * b * b,
               f: -est.T * Math.log(Z), s: (u + est.T * Math.log(Z)) / est.T, b: b };
    }

    function desenhar() {
      var r = termo();
      var p = G.preparar(cv, Math.min(320, 130 + 26 * r.nv.length));
      var ct = p.ct;
      var Emax = r.nv[r.nv.length - 1].E + 0.6;

      var mx = 54, my = 18, alt = p.A - 2 * my - 18;
      var larguraBar = Math.min(p.L * 0.42, 320);
      var x0 = mx, x1 = x0 + larguraBar;

      function Y(E) { return my + alt - E / Emax * alt; }

      // eixo de energia
      ct.save();
      ct.strokeStyle = G.COR.suave; ct.lineWidth = 1.2;
      ct.beginPath();
      ct.moveTo(x0 - 8, my); ct.lineTo(x0 - 8, my + alt);
      ct.stroke();
      ct.fillStyle = G.COR.suave;
      ct.font = '600 11px system-ui, sans-serif';
      ct.save();
      ct.translate(16, my + alt / 2); ct.rotate(-Math.PI / 2);
      ct.textAlign = 'center';
      ct.fillText('energia, em unidades de ' + SIS[est.sis].esc, 0, 0);
      ct.restore();
      ct.restore();

      // níveis e barras de população
      var pmaxB = 0;
      r.nv.forEach(function (n) {
        pmaxB = Math.max(pmaxB, n.g * Math.exp(-r.b * n.E) / r.Z);
      });
      r.nv.forEach(function (n) {
        var pr = n.g * Math.exp(-r.b * n.E) / r.Z;
        var y = Y(n.E);
        ct.save();
        ct.strokeStyle = G.COR.tinta;
        ct.lineWidth = 2;
        ct.beginPath();
        ct.moveTo(x0, y); ct.lineTo(x0 + 46, y);
        ct.stroke();
        // barra proporcional à população
        ct.fillStyle = G.COR.azulClaro;
        var w = (pr / pmaxB) * (x1 - x0 - 58);
        ct.fillRect(x0 + 54, y - 8, w, 16);
        ct.fillStyle = G.COR.tinta;
        ct.font = '11px system-ui, sans-serif';
        ct.textAlign = 'left';
        ct.textBaseline = 'middle';
        ct.fillText(F.pct(pr, 1) + (n.g > 1 ? '  (g = ' + n.g + ')' : ''),
                    x0 + 58 + w + 6, y);
        ct.restore();
      });

      /* ---- a soma que forma Z ---- */
      var gx = x1 + 70, gl = p.L - gx - 14;
      if (gl > 150) {
        ct.save();
        ct.fillStyle = G.COR.tinta;
        ct.font = '600 12px system-ui, sans-serif';
        ct.textAlign = 'left';
        ct.textBaseline = 'top';
        ct.fillText('Z = \u03a3 g e^(\u2212E/kT)', gx, my);
        ct.font = '11px ui-monospace, Menlo, monospace';
        var yy = my + 22;
        var acum = 0;
        r.nv.slice(0, 9).forEach(function (n) {
          var w = n.g * Math.exp(-r.b * n.E);
          acum += w;
          ct.fillStyle = G.COR.suave;
          ct.fillText('E = ' + n.E.toFixed(1).replace('.', ',')
            + '   ' + (n.g > 1 ? n.g + '\u00d7' : '  ')
            + ' e^(\u2212' + (r.b * n.E).toFixed(2).replace('.', ',') + ')'
            + ' = ' + w.toFixed(4).replace('.', ','), gx, yy);
          yy += 16;
        });
        if (r.nv.length > 9) {
          ct.fillText('\u2026', gx, yy); yy += 16;
        }
        ct.strokeStyle = G.COR.borda || '#d8dee6';
        ct.beginPath(); ct.moveTo(gx, yy - 4); ct.lineTo(gx + 190, yy - 4); ct.stroke();
        ct.fillStyle = G.COR.azul;
        ct.font = '600 12px ui-monospace, Menlo, monospace';
        ct.fillText('Z = ' + r.Z.toFixed(4).replace('.', ','), gx, yy + 2);
        ct.restore();
      }

      mostrar({
        z: F.fmt(r.Z, 4), f: F.fmt(r.f, 4), u: F.fmt(r.u, 4),
        s: F.fmt(r.s, 4), c: F.fmt(r.c, 4)
      });

      nota.innerHTML =
        '<p>As barras são as probabilidades \\(\\wp_i=g_i e^{-E_i/\\kB T}/Z\\). Baixe a '
        + 'temperatura e todas migram para o nível fundamental; suba-a e elas se igualam, '
        + 'porque \\(e^{-E/\\kB T}\\to 1\\) para todos os níveis. A competição entre o peso '
        + 'de Boltzmann, que favorece a energia baixa, e a degenerescência \\(g_i\\), que '
        + 'favorece a energia alta, é o que decide o estado de equilíbrio.</p>'
        + '<p>Tudo o mais nos cartões saiu de \\(Z\\) por diferenciação, sem nenhuma '
        + 'informação adicional: \\(f=-\\kB T\\ln Z\\), '
        + '\\(u=-\\partial\\ln Z/\\partial\\beta\\), \\(s=(u-f)/T\\) e '
        + '\\(c=\\partial u/\\partial T\\). Note ainda que o cálculo de \\(c\\) feito aqui '
        + 'usa \\(\\kB T^2 c = \\med{E^2}-\\med{E}^2\\): o calor específico <b>é</b> a '
        + 'flutuação da energia, assunto da próxima seção.</p>';
      tipografar(nota);
    }

    registrarRedesenho(desenhar);
    tipografar(corpo);
  };

  /* =================================================================
     18. Flutuações de energia: o canônico vira o microcanônico
     A distribuição da energia total de N partículas em banho térmico,
     com a largura relativa caindo como 1/raiz(N).
     ================================================================= */
  REGISTRO.flutuacoes = function (raiz) {
    var corpo = moldura(raiz, 'Flutuações de energia e por que os dois ensembles concordam');

    var est = { N: 40, T: 0.7 };

    var cv = el('canvas');
    corpo.appendChild(cv);
    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);

    deslizante(ctr, 'partículas \\(N\\)', 4, 2000, 4, 40,
      function (v) { est.N = v; desenhar(); });
    deslizante(ctr, 'temperatura \\(\\kB T/\\epsilon\\)', 0.1, 4, 0.05, 0.7,
      function (v) { est.T = v; desenhar(); },
      function (v) { return v.toFixed(2).replace('.', ','); });

    var mostrar = cartoes(corpo, [
      { rot: '\u27e8U\u27e9/\u03b5', k: 'u' },
      { rot: '\u03c3<sub>U</sub>/\u03b5', k: 'sg' },
      { rot: '\u03c3<sub>U</sub>/\u27e8U\u27e9', k: 'rel' },
      { rot: '\u221a(k<sub>B</sub>T\u00b2C) previsto', k: 'tp' },
      { rot: 'a mesma razão se N = 10\u00b2\u00b3', k: 'n23' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    function desenhar() {
      var N = est.N, b = 1 / est.T;
      /* Sistema de N partículas de dois níveis em banho térmico:
         P(U = k.eps) proporcional a C(N,k) e^{-b k}. */
      var lnP = [], maior = -Infinity, k;
      for (k = 0; k <= N; k++) {
        var L = F.lnBinom(N, k) - b * k;
        lnP.push(L);
        if (L > maior) maior = L;
      }
      var P = [], soma = 0;
      for (k = 0; k <= N; k++) { P.push(Math.exp(lnP[k] - maior)); soma += P[k]; }
      var md = 0, md2 = 0;
      for (k = 0; k <= N; k++) {
        P[k] /= soma; md += k * P[k]; md2 += k * k * P[k];
      }
      var sig = Math.sqrt(Math.max(0, md2 - md * md));

      /* previsão analítica: u = 1/(1+e^b) por partícula, c = b² e^b/(1+e^b)²,
         e sigma_U² = N kB T² c, em unidades de epsilon */
      var eb = Math.exp(b);
      var uPrev = N / (1 + eb);
      var cPrev = b * b * eb / ((1 + eb) * (1 + eb));
      var sigPrev = Math.sqrt(N * est.T * est.T * cPrev);

      var lo = Math.max(0, md - 5 * sig - 1), hi = Math.min(N, md + 5 * sig + 1);
      var pmax = 0;
      for (k = 0; k <= N; k++) pmax = Math.max(pmax, P[k]);

      var ax = G.eixos(cv, {
        xmin: lo, xmax: hi, ymin: 0, ymax: pmax * 1.18, altura: 300,
        rotX: 'energia total U/\u03b5 (número de partículas excitadas)',
        rotY: 'probabilidade',
        marcasX: G.marcasLineares(lo, hi, 5, 0),
        formataY: function (v) { return v.toFixed(3).replace('.', ','); }
      });
      var dados = [];
      for (k = Math.floor(lo); k <= Math.ceil(hi); k++) {
        if (k >= 0 && k <= N) dados.push({ x: k, y: P[k] });
      }
      G.barras(ax, dados, G.COR.azulClaro, 0.86);
      G.vertical(ax, md, G.COR.vinho, '\u27e8U\u27e9');
      // faixa de um desvio padrão
      ax.ct.save();
      ax.ct.strokeStyle = G.COR.ambar;
      ax.ct.lineWidth = 1.6;
      ax.ct.setLineDash([4, 3]);
      [md - sig, md + sig].forEach(function (x) {
        if (x >= lo && x <= hi) {
          ax.ct.beginPath();
          ax.ct.moveTo(ax.X(x), ax.y0); ax.ct.lineTo(ax.X(x), ax.y1);
          ax.ct.stroke();
        }
      });
      ax.ct.restore();
      G.legenda(ax, [
        { cor: G.COR.azulClaro, texto: 'P(U) no ensemble canônico' },
        { cor: G.COR.ambar, texto: '\u27e8U\u27e9 \u00b1 \u03c3' }
      ]);

      var rel = md > 0 ? sig / md : 0;
      mostrar({
        u: F.fmt(md, 3), sg: F.fmt(sig, 4),
        rel: md > 0 ? F.pct(rel, 3) : '\u00b7',
        tp: F.fmt(sigPrev, 4),
        n23: md > 0 ? F.fmt(rel * Math.sqrt(N / 6.022e23), 3) : '\u00b7'
      });

      nota.innerHTML =
        '<p>No ensemble canônico a energia <b>não</b> é fixa: o sistema troca calor com o '
        + 'banho e \\(U\\) flutua. A distribuição acima é '
        + '\\(\\wp(U)\\propto\\Omega(U)\\,e^{-U/\\kB T}\\), o produto de uma multiplicidade '
        + 'que cresce por um peso de Boltzmann que decresce. O resultado é um pico.</p>'
        + '<p>A largura obedece a uma identidade notável:</p>'
        + '\\[\\sigma_U^2=\\med{U^2}-\\med{U}^2=\\kB T^2 C_V.\\]'
        + '<p>Compare os cartões: o \\(\\sigma_U\\) medido da distribuição e o previsto por '
        + '\\(\\sqrt{\\kB T^2C}\\) coincidem. A flutuação da energia <b>é</b> o calor '
        + 'específico, e esse é o primeiro exemplo do teorema da flutuação e dissipação que '
        + 'apareceu no Módulo 4.</p>'
        + '<p>Agora o essencial. Como \\(U\\propto N\\) e \\(\\sigma_U\\propto\\sqrt N\\), a '
        + 'largura relativa cai como \\(1/\\sqrt N\\). Com \\(N=' + N + '\\) ela vale '
        + (md > 0 ? F.pct(rel, 2) : '\u00b7')
        + '; com \\(N=10^{23}\\) seria da ordem de \\(10^{-11}\\). É por isso que o '
        + 'resultado do ensemble canônico, onde \\(U\\) flutua, é o mesmo do microcanônico, '
        + 'onde \\(U\\) é fixa: <b>no limite termodinâmico a distinção deixa de ter '
        + 'consequência</b>. Escolhe-se o ensemble pela conveniência do cálculo, e não pela '
        + 'física.</p>';
      tipografar(nota);
    }

    registrarRedesenho(desenhar);
    tipografar(corpo);
  };


  /* =================================================================
     19. Distribuição de Maxwell e a atmosfera
     Gases reais, em unidades reais. A fração acima da velocidade de
     escape explica por que a Terra perdeu o hidrogênio e guardou o
     nitrogênio, e por que a Lua não guardou nada.
     ================================================================= */
  REGISTRO.maxwell = function (raiz) {
    var corpo = moldura(raiz, 'Distribuição de Maxwell: velocidades, escape e atmosfera');

    var u = 1.66053906660e-27;
    var GAS = [
      { nome: 'H\u2082', M: 2.016, cor: '#2c5f8d' },
      { nome: 'He', M: 4.003, cor: '#1f6f54' },
      { nome: 'N\u2082', M: 28.01, cor: '#b5831f' },
      { nome: 'O\u2082', M: 32.00, cor: '#8c2f39' },
      { nome: 'CO\u2082', M: 44.01, cor: '#7a5ea8' }
    ];
    var CORPOS = {
      terra: { rot: 'Terra', vesc: 11200, T: 290, g: 9.81 },
      lua: { rot: 'Lua', vesc: 2380, T: 250, g: 1.62 },
      marte: { rot: 'Marte', vesc: 5030, T: 210, g: 3.72 },
      jupiter: { rot: 'Júpiter', vesc: 59500, T: 165, g: 24.8 }
    };

    var est = { vista: 'vel', T: 290, corpo: 'terra', iGas: 2 };

    var ctr0 = el('div', { class: 'controles' });
    corpo.appendChild(ctr0);
    opcoes(ctr0, [
      { rot: 'Distribuição de velocidades', v: 'vel' },
      { rot: 'Atmosfera e escape', v: 'atm' }
    ], 0, function (v) { est.vista = v; desenhar(); });

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    var desT = deslizante(ctr, 'temperatura', 50, 1500, 5, 290,
      function (v) { est.T = v; desenhar(); },
      function (v) { return v + ' K'; });
    opcoes(ctr, Object.keys(CORPOS).map(function (k) {
      return { rot: CORPOS[k].rot, v: k };
    }), 0, function (v) {
      est.corpo = v;
      desT.value = CORPOS[v].T;
      desT.dispatchEvent(new Event('input'));
    });

    var mostrar = cartoes(corpo, [
      { rot: 'v mais provável', k: 'vp' }, { rot: '⟨v⟩', k: 'vm' },
      { rot: 'v<sub>rms</sub>', k: 'vq' }, { rot: 'v de escape', k: 've' },
      { rot: 'altura de escala', k: 'h' }
    ]);
    var tabela = el('div', { class: 'tabela-rolavel' });
    corpo.appendChild(tabela);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    function massa(i) { return GAS[i].M * u; }

    /* fração de moléculas com v > vc, por integração da Maxwell 3D */
    function fracaoAcima(m, T, vc) {
      var a = m / (2 * F.C.kB * T);
      var x = Math.sqrt(a) * vc;
      if (x > 30) {                      // cauda: assintótico, evita 0/0 numérico
        return (2 / Math.sqrt(Math.PI)) * x * Math.exp(-x * x);
      }
      var f = function (s) { return s * s * Math.exp(-s * s); };
      var topo = Math.max(x + 12, 14);
      return (4 / Math.sqrt(Math.PI)) * F.simpson(f, x, topo, 4000);
    }

    function desenhar() {
      var C = CORPOS[est.corpo], T = est.T, i;

      if (est.vista === 'vel') {
        var vmax = 1.1 * F.vQuadratica(massa(0), T) * 2.6;
        var ymax = 0;
        GAS.forEach(function (g) {
          ymax = Math.max(ymax, F.maxwell(F.vProvavel(g.M * u, T), g.M * u, T));
        });
        var ax = G.eixos(cv, {
          xmin: 0, xmax: vmax, ymin: 0, ymax: ymax * 1.12, altura: 320,
          rotX: 'velocidade (m/s)', rotY: 'densidade de probabilidade f(v)',
          marcasX: G.marcasLineares(0, vmax, 5, 0),
          formataY: function () { return ''; }
        });
        GAS.forEach(function (g, k) {
          G.curva(ax, function (v) { return F.maxwell(v, g.M * u, T); },
                  g.cor, k === est.iGas ? 3 : 1.6);
        });
        if (C.vesc < vmax) {
          G.vertical(ax, C.vesc, G.COR.tinta,
                     'escape da ' + C.rot + ': ' + C.vesc + ' m/s', false);
        }
        G.legenda(ax, GAS.map(function (g) {
          return { cor: g.cor, texto: g.nome };
        }));
      } else {
        /* perfil de densidade na atmosfera isotérmica */
        var hmax = 120e3;
        var ax2 = G.eixos(cv, {
          xmin: 0, xmax: 1.02, ymin: 0, ymax: hmax, altura: 320,
          rotX: 'densidade relativa n(y)/n\u2080', rotY: 'altitude (km)',
          marcasX: G.marcasLineares(0, 1, 5, 1),
          formataY: function (v) { return String(Math.round(v / 1000)); }
        });
        GAS.forEach(function (g, k) {
          var H = F.C.kB * T / (g.M * u * C.g);
          ax2.ct.save();
          ax2.ct.strokeStyle = g.cor;
          ax2.ct.lineWidth = k === est.iGas ? 3 : 1.6;
          ax2.ct.beginPath();
          for (var j = 0; j <= 200; j++) {
            var y = hmax * j / 200;
            var n = Math.exp(-y / H);
            if (j) ax2.ct.lineTo(ax2.X(n), ax2.Y(y));
            else ax2.ct.moveTo(ax2.X(n), ax2.Y(y));
          }
          ax2.ct.stroke();
          ax2.ct.restore();
        });
        G.legenda(ax2, GAS.map(function (g) {
          return { cor: g.cor, texto: g.nome + ': H = '
            + F.fmt(F.C.kB * T / (g.M * u * C.g) / 1000, 1) + ' km' };
        }));
      }

      var g0 = GAS[est.iGas], m0 = massa(est.iGas);
      mostrar({
        vp: F.fmt(F.vProvavel(m0, T), 0) + ' m/s',
        vm: F.fmt(F.vMedia(m0, T), 0) + ' m/s',
        vq: F.fmt(F.vQuadratica(m0, T), 0) + ' m/s',
        ve: C.vesc + ' m/s',
        h: F.fmt(F.C.kB * T / (m0 * C.g) / 1000, 1) + ' km'
      });

      /* tabela: fração acima da velocidade de escape, por gás */
      var linhas = GAS.map(function (g) {
        var m = g.M * u;
        var fr = fracaoAcima(m, T, C.vesc);
        var razao = C.vesc / F.vQuadratica(m, T);
        var veredito = razao > 6 ? 'retida com folga'
                     : razao > 4 ? 'retida'
                     : razao > 2.5 ? 'escapa em tempo geológico'
                     : 'escapa depressa';
        return '<tr><td><b>' + g.nome + '</b></td><td>' + g.M.toFixed(2).replace('.', ',')
             + '</td><td>' + F.fmt(F.vQuadratica(m, T), 0) + '</td><td>'
             + F.fmt(razao, 2) + '</td><td>'
             + (fr < 1e-300 ? '&lt; 10<sup>-300</sup>' : F.fmt(fr, 3))
             + '</td><td>' + veredito + '</td></tr>';
      }).join('');
      tabela.innerHTML = '<table><thead><tr><th>Gás</th><th>M (u)</th>'
        + '<th>v<sub>rms</sub> (m/s)</th><th>v<sub>esc</sub>/v<sub>rms</sub></th>'
        + '<th>fração acima de v<sub>esc</sub></th><th>destino</th></tr></thead><tbody>'
        + linhas + '</tbody></table>';

      nota.innerHTML = est.vista === 'vel'
        ? '<p>Todas as curvas são a mesma função, '
          + '\\(f(v)\\propto v^2e^{-mv^2/2\\kB T}\\), com massas diferentes. Como a '
          + 'energia cinética média é a mesma para todas, \\(\\tfrac32\\kB T\\), a '
          + 'velocidade típica escala como \\(1/\\sqrt m\\): o hidrogênio é quase quatro '
          + 'vezes mais rápido que o oxigênio na mesma temperatura.</p>'
          + '<p>A linha vertical é a velocidade de escape. O que importa não é a média, e '
          + 'sim a <b>cauda</b>: basta que uma fração ínfima ultrapasse \\(v_{\\rm esc}\\) '
          + 'para que, ao longo de bilhões de anos, o gás se perca. A regra prática dos '
          + 'planetólogos é \\(v_{\\rm esc}/v_{\\rm rms}>6\\) para reter um gás pela idade do '
          + 'Sistema Solar, e a tabela aplica esse critério.</p>'
        : '<p>Num campo gravitacional uniforme, a distribuição de Boltzmann no potencial '
          + '\\(u=mgy\\) dá \\(n(y)=n_0e^{-mgy/\\kB T}\\): é a '
          + '<b>fórmula barométrica</b>. A altura de escala \\(H=\\kB T/mg\\) é onde a '
          + 'densidade cai por um fator \\(e\\).</p>'
          + '<p>Repare que \\(H\\) depende da massa: o hidrogênio tem uma atmosfera muito '
          + 'mais alta que o gás carbônico. É por isso que as camadas superiores da '
          + 'atmosfera são relativamente mais ricas em gases leves, e é também a razão pela '
          + 'qual Perrin mediu \\(N_A\\) de um terceiro jeito, contando grãos suspensos em '
          + 'água a alturas diferentes: a mesma exponencial vale para eles.</p>';
      tipografar(nota);
    }

    registrarRedesenho(desenhar);
    tipografar(corpo);
  };

  /* =================================================================
     20. O paradoxo de Gibbs
     Duas câmaras, a divisória retirada. Sem o fator 1/N! a entropia
     aumenta mesmo quando os gases são idênticos, o que é absurdo.
     ================================================================= */
  REGISTRO.gibbs = function (raiz) {
    var corpo = moldura(raiz, 'O paradoxo de Gibbs e o fator 1/N!');

    var est = { iguais: true, N: 60, t: 0, rodando: false };
    var part = [];

    var cv = el('canvas');
    corpo.appendChild(cv);
    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);

    opcoes(ctr, [
      { rot: 'O mesmo gás dos dois lados', v: 1 },
      { rot: 'Gases diferentes', v: 0 }
    ], 0, function (v) { est.iguais = !!v; reiniciar(); });

    deslizante(ctr, 'partículas de cada lado \\(N\\)', 20, 200, 10, 60,
      function (v) { est.N = v; reiniciar(); });

    var bA = el('button', { type: 'button', texto: 'retirar a divisória' });
    var bR = el('button', { type: 'button', class: 'sec', texto: 'reiniciar' });
    bA.addEventListener('click', function () { est.rodando = true; });
    bR.addEventListener('click', reiniciar);
    ctr.appendChild(el('div', { class: 'botoes' }, [bA, bR]));

    var mostrar = cartoes(corpo, [
      { rot: '\u0394S sem o 1/N! (errado)', k: 'se' },
      { rot: '\u0394S com o 1/N! (correto)', k: 'sc' },
      { rot: 'o que o experimento mede', k: 'sx' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    function reiniciar() {
      part = [];
      for (var lado = 0; lado < 2; lado++) {
        for (var i = 0; i < est.N; i++) {
          part.push({
            x: lado * 0.5 + Math.random() * 0.48 + 0.01,
            y: Math.random() * 0.96 + 0.02,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5,
            e: lado
          });
        }
      }
      est.t = 0; est.rodando = false;
      texto();
    }

    function passo(dt) {
      est.t = Math.min(1, est.t + dt * 0.22);
      for (var i = 0; i < part.length; i++) {
        var p = part[i];
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.y < 0) { p.y = -p.y; p.vy = -p.vy; }
        if (p.y > 1) { p.y = 2 - p.y; p.vy = -p.vy; }
        if (p.x < 0) { p.x = -p.x; p.vx = -p.vx; }
        if (p.x > 1) { p.x = 2 - p.x; p.vx = -p.vx; }
        // enquanto a divisória existe, ela reflete
        if (!est.rodando) {
          if (p.e === 0 && p.x > 0.5) { p.x = 1 - p.x; p.vx = -p.vx; }
          if (p.e === 1 && p.x < 0.5) { p.x = 1 - p.x; p.vx = -p.vx; }
        }
      }
    }

    function desenhar() {
      var p = G.preparar(cv, 260);
      var ct = p.ct;
      var larg = Math.min(p.L - 28, 640), alt = p.A - 40;
      var x0 = (p.L - larg) / 2, y0 = 14;

      ct.save();
      ct.strokeStyle = G.COR.tinta; ct.lineWidth = 1.6;
      ct.strokeRect(x0, y0, larg, alt);
      if (!est.rodando) {
        ct.lineWidth = 3;
        ct.beginPath();
        ct.moveTo(x0 + larg / 2, y0); ct.lineTo(x0 + larg / 2, y0 + alt);
        ct.stroke();
      } else {
        ct.strokeStyle = G.COR.borda || '#d8dee6';
        ct.setLineDash([4, 4]);
        ct.lineWidth = 1;
        ct.beginPath();
        ct.moveTo(x0 + larg / 2, y0); ct.lineTo(x0 + larg / 2, y0 + alt);
        ct.stroke();
        ct.setLineDash([]);
      }
      part.forEach(function (q) {
        ct.fillStyle = est.iguais ? 'rgba(44,95,141,.8)'
                     : (q.e ? 'rgba(140,47,57,.85)' : 'rgba(44,95,141,.85)');
        ct.beginPath();
        ct.arc(x0 + q.x * larg, y0 + q.y * alt, 2.6, 0, 2 * Math.PI);
        ct.fill();
      });
      ct.fillStyle = G.COR.suave;
      ct.font = '11px system-ui, sans-serif';
      ct.textAlign = 'center';
      ct.fillText(est.iguais ? 'mesmo gás, N de cada lado'
                             : 'gás A à esquerda, gás B à direita',
                  x0 + larg / 2, y0 + alt + 18);
      ct.restore();

      var N = est.N;
      var errado = 2 * N * Math.LN2;         // em unidades de kB
      var correto = est.iguais ? 0 : 2 * N * Math.LN2;
      mostrar({
        se: F.fmt(errado, 2) + ' k<sub>B</sub>',
        sc: F.fmt(correto, 2) + ' k<sub>B</sub>',
        sx: est.iguais ? '0 (nada acontece)' : F.fmt(2 * N * Math.LN2, 2) + ' k<sub>B</sub>'
      });
    }

    function texto() {
      nota.innerHTML = est.iguais
        ? '<p>Dois recipientes do <b>mesmo</b> gás, mesma densidade, mesma temperatura. '
          + 'Retire a divisória e nada acontece: nenhuma propriedade macroscópica muda, e '
          + 'recolocando a divisória volta-se ao estado inicial. O processo é reversível, '
          + 'logo \\(\\Delta S=0\\).</p>'
          + '<p><b>Mas a conta ingênua diz outra coisa.</b> Com \\(Z=Z_1^N\\), sem o fator '
          + '\\(1/N!\\), a entropia sai '
          + '\\(S=N\\kB\\left[\\ln V+\\tfrac32\\ln T+\\text{const}\\right]\\), que contém '
          + '\\(\\ln V\\) e não \\(\\ln(V/N)\\). Dobrando \\(V\\) e \\(N\\) juntos, ela '
          + '<b>não</b> dobra: não é extensiva. O resultado é um ganho espúrio de '
          + '\\(2N\\kB\\ln 2\\) ao retirar uma divisória que não separa nada. Esse é o '
          + '<b>paradoxo de Gibbs</b>.</p>'
          + '<p>A culpa é de ter contado como estados distintos configurações que diferem '
          + 'apenas por uma <b>permutação de partículas idênticas</b>. Dividindo \\(Z\\) por '
          + '\\(N!\\) e usando Stirling, o \\(\\ln V\\) vira \\(\\ln(V/N)+1\\), a entropia '
          + 'fica extensiva e \\(\\Delta S=0\\), como deve ser.</p>'
        : '<p>Agora os gases são <b>diferentes</b>. Retirar a divisória faz cada gás ocupar '
          + 'o dobro do volume, e isso é irreversível: nenhuma recolocação da divisória '
          + 'desfaz a mistura.</p>'
          + '<p>Cada gás ganha \\(N\\kB\\ln 2\\) de entropia, e o total é '
          + '\\[\\Delta S = 2N\\kB\\ln 2,\\]'
          + 'que é a <b>entropia de mistura</b>. Note que aqui as duas contas concordam, '
          + 'porque o fator \\(1/N!\\) aplica-se separadamente a cada espécie e não cancela '
          + 'o efeito.</p>'
          + '<p>O desconfortável é o limite: faça os dois gases cada vez mais parecidos e '
          + '\\(\\Delta S\\) continua \\(2N\\kB\\ln 2\\), até que, no instante em que se '
          + 'tornam idênticos, despenca a zero. Não há transição suave. A resolução é que '
          + '"idênticas" não é uma questão de grau: ou as partículas são permutáveis ou não '
          + 'são, e isso é uma propriedade quântica, não clássica. O \\(N!\\) é a primeira '
          + 'aparição da indistinguibilidade no curso, e ela voltará com força no '
          + 'Módulo 8.</p>';
      tipografar(nota);
    }

    var ultimo = 0;
    function quadro(ts) {
      var dt = Math.min(0.05, (ts - ultimo) / 1000) || 0.016;
      ultimo = ts;
      passo(dt);
      desenhar();
      requestAnimationFrame(quadro);
    }

    reiniciar();
    requestAnimationFrame(quadro);
    window.addEventListener('resize', desenhar);
    tipografar(corpo);
  };


  /* =================================================================
     21. A função de Mayer e o segundo coeficiente do virial
     Do potencial entre duas moléculas sai B2(T), e dele a temperatura
     de Boyle. Unidades reduzidas: r em sigma, u em epsilon, T em
     epsilon/kB, B2 em sigma^3.
     ================================================================= */
  REGISTRO.virial = function (raiz) {
    var corpo = moldura(raiz, 'Do potencial molecular ao segundo coeficiente do virial');

    var POT = {
      lj: {
        rot: 'Lennard-Jones',
        u: function (r) { var s6 = Math.pow(r, -6); return 4 * (s6 * s6 - s6); },
        rmin: 0.85, TB: null
      },
      poco: {
        rot: 'Poço quadrado',
        u: function (r) { return r < 1 ? 1e6 : (r < 1.5 ? -1 : 0); },
        rmin: 0.9, TB: null
      },
      rigida: {
        rot: 'Esfera rígida',
        u: function (r) { return r < 1 ? 1e6 : 0; },
        rmin: 0.9, TB: null
      }
    };

    /* gases reais, com parâmetros de Lennard-Jones tabelados */
    var GASES = [
      { nome: 'He', eps: 10.22, sig: 0.2556, TBexp: 23 },
      { nome: 'H\u2082', eps: 37.0, sig: 0.293, TBexp: 110 },
      { nome: 'N\u2082', eps: 95.05, sig: 0.3698, TBexp: 327 },
      { nome: 'Ar', eps: 119.8, sig: 0.3405, TBexp: 410 },
      { nome: 'CO\u2082', eps: 195.0, sig: 0.3941, TBexp: 714 }
    ];

    var est = { pot: 'lj', T: 1.5 };

    var ctr0 = el('div', { class: 'controles' });
    corpo.appendChild(ctr0);
    opcoes(ctr0, Object.keys(POT).map(function (k) {
      return { rot: POT[k].rot, v: k };
    }), 0, function (v) { est.pot = v; desenhar(); });

    var cv = el('canvas');
    corpo.appendChild(cv);

    deslizante(corpo, 'temperatura reduzida \\(T^{*}=\\kB T/\\epsilon\\)', 0.4, 8, 0.05, 1.5,
      function (v) { est.T = v; desenhar(); },
      function (v) { return v.toFixed(2).replace('.', ','); });

    var mostrar = cartoes(corpo, [
      { rot: 'B\u2082* nesta temperatura', k: 'b2' },
      { rot: 'temperatura de Boyle T*<sub>B</sub>', k: 'tb' },
      { rot: 'sinal de B\u2082', k: 'sg' },
      { rot: 'desvio de PV = Nk<sub>B</sub>T', k: 'dv' }
    ]);
    var tabela = el('div', { class: 'tabela-rolavel' });
    corpo.appendChild(tabela);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    /* B2*(T) = -2.pi.integral de [e^{-u/T} - 1] r² dr, em unidades de sigma³ */
    function B2(T, pot) {
      var u = POT[pot].u;
      var f = function (r) {
        if (r < 1e-6) return -r * r;
        var x = -u(r) / T;
        if (x < -700) return -r * r;      // e^{-u/T} -> 0
        return (Math.exp(x) - 1) * r * r;
      };
      /* Três trechos: o caroço duro, onde o integrando é só -r²; a região
         do poço, onde tudo acontece; e a cauda, que decai depressa. */
      return -2 * Math.PI * (F.simpson(f, 1e-9, 0.9, 2000)
                           + F.simpson(f, 0.9, 2.5, 6000)
                           + F.simpson(f, 2.5, 20, 4000));
    }

    function boyle(pot) {
      if (POT[pot].TB !== null) return POT[pot].TB;
      var v = F.bissecao(function (t) { return B2(t, pot); }, 0.2, 60, 1e-9);
      POT[pot].TB = v;
      return v;
    }

    function desenhar() {
      var P = POT[est.pot], T = est.T;
      var p = G.preparar(cv, 320);
      var meia = p.L / 2 - 8;

      /* ---------- painel esquerdo: u(r) e a função de Mayer ---------- */
      var ct = p.ct;
      var mx = 48, my = 16, alt = p.A - 58, larg = meia - mx - 10;
      function X1(r) { return mx + (r - 0.7) / (3.0 - 0.7) * larg; }
      function Y1(y) { return my + alt / 2 - y / 3.2 * (alt / 2); }

      ct.save();
      ct.strokeStyle = G.COR.grade;
      ct.beginPath(); ct.moveTo(mx, Y1(0)); ct.lineTo(mx + larg, Y1(0)); ct.stroke();
      ct.strokeStyle = G.COR.suave; ct.lineWidth = 1.2;
      ct.beginPath(); ct.moveTo(mx, my); ct.lineTo(mx, my + alt); ct.stroke();
      ct.fillStyle = G.COR.suave;
      ct.font = '600 11px system-ui, sans-serif';
      ct.textAlign = 'center';
      ct.fillText('distância r/\u03c3', mx + larg / 2, p.A - 6);
      ct.fillText('0', mx - 14, Y1(0) + 4);
      ct.restore();

      function traco(fn, cor, larguraL) {
        ct.save();
        ct.strokeStyle = cor; ct.lineWidth = larguraL;
        ct.beginPath();
        var dentro = false;
        for (var i = 0; i <= 500; i++) {
          var r = 0.7 + (3.0 - 0.7) * i / 500;
          var y = fn(r);
          if (!isFinite(y) || y > 3.2 || y < -3.2) { dentro = false; continue; }
          var xx = X1(r), yy = Y1(y);
          if (dentro) ct.lineTo(xx, yy); else { ct.moveTo(xx, yy); dentro = true; }
        }
        ct.stroke();
        ct.restore();
      }
      traco(function (r) { return P.u(r); }, G.COR.azul, 2.4);
      traco(function (r) {
        var x = -P.u(r) / T;
        return x < -700 ? -1 : Math.exp(x) - 1;
      }, G.COR.vinho, 2.4);

      ct.save();
      ct.font = '11px system-ui, sans-serif';
      ct.textAlign = 'left';
      ct.fillStyle = G.COR.azul;
      ct.fillText('u(r)/\u03b5', mx + 6, my + 12);
      ct.fillStyle = G.COR.vinho;
      ct.fillText('\u03a6(r) = e\u207b\u1d58\u141f\u1d40 \u2212 1', mx + 6, my + 28);
      ct.restore();

      /* ---------- painel direito: B2(T) ---------- */
      var gx = p.L / 2 + 40, gl = p.L - gx - 14;
      var TB = boyle(est.pot);
      var tmax = Math.max(8, TB * 1.8);
      var b2max = 3.0, b2min = -6.0;
      function X2(t) { return gx + t / tmax * gl; }
      function Y2(b) { return my + alt - (b - b2min) / (b2max - b2min) * alt; }

      ct.save();
      ct.strokeStyle = G.COR.grade;
      ct.beginPath(); ct.moveTo(gx, Y2(0)); ct.lineTo(gx + gl, Y2(0)); ct.stroke();
      ct.strokeStyle = G.COR.suave; ct.lineWidth = 1.2;
      ct.beginPath(); ct.moveTo(gx, my); ct.lineTo(gx, my + alt); ct.stroke();
      ct.fillStyle = G.COR.suave;
      ct.font = '600 11px system-ui, sans-serif';
      ct.textAlign = 'center';
      ct.fillText('temperatura T* = \u03baT/\u03b5', gx + gl / 2, p.A - 6);
      ct.textAlign = 'right';
      ct.font = '10px system-ui, sans-serif';
      [-6, -3, 0, 3].forEach(function (b) {
        ct.fillText(String(b), gx - 5, Y2(b) + 3);
      });
      ct.restore();

      ct.save();
      ct.strokeStyle = G.COR.azul; ct.lineWidth = 2.4;
      ct.beginPath();
      var prim = true;
      for (var k = 1; k <= 160; k++) {
        var t = tmax * k / 160;
        var b = B2(t, est.pot);
        if (b < b2min || b > b2max) { prim = true; continue; }
        if (prim) { ct.moveTo(X2(t), Y2(b)); prim = false; }
        else ct.lineTo(X2(t), Y2(b));
      }
      ct.stroke();
      // temperatura de Boyle
      ct.strokeStyle = G.COR.ambar; ct.lineWidth = 1.6;
      ct.setLineDash([5, 4]);
      ct.beginPath(); ct.moveTo(X2(TB), my); ct.lineTo(X2(TB), my + alt); ct.stroke();
      ct.setLineDash([]);
      ct.fillStyle = G.COR.ambar;
      ct.font = '600 11px system-ui, sans-serif';
      ct.textAlign = 'left';
      ct.fillText('T*\u1d2e = ' + TB.toFixed(3).replace('.', ','), X2(TB) + 5, my + 12);
      // ponto da temperatura atual
      var bAtual = B2(T, est.pot);
      if (bAtual > b2min && bAtual < b2max && T < tmax) {
        ct.fillStyle = G.COR.vinho;
        ct.beginPath(); ct.arc(X2(T), Y2(bAtual), 4.5, 0, 2 * Math.PI); ct.fill();
      }
      ct.fillStyle = G.COR.suave;
      ct.font = '11px system-ui, sans-serif';
      ct.fillText('B\u2082*(T)', gx + 6, my + 12);
      ct.restore();

      mostrar({
        b2: F.fmt(bAtual, 4),
        tb: F.fmt(TB, 3),
        sg: bAtual > 0 ? 'positivo: repulsão domina'
          : bAtual < 0 ? 'negativo: atração domina' : 'nulo',
        dv: bAtual > 0 ? 'P maior que a do gás ideal'
                       : 'P menor que a do gás ideal'
      });

      if (est.pot === 'lj') {
        tabela.innerHTML = '<table><thead><tr><th>Gás</th><th>\u03b5/k<sub>B</sub> (K)</th>'
          + '<th>\u03c3 (nm)</th><th>T<sub>B</sub> previsto = 3,418 \u03b5/k<sub>B</sub></th>'
          + '<th>T<sub>B</sub> medido</th><th>desvio</th></tr></thead><tbody>'
          + GASES.map(function (g) {
              var prev = 3.4179 * g.eps;
              return '<tr><td><b>' + g.nome + '</b></td><td>'
                + g.eps.toFixed(2).replace('.', ',') + '</td><td>'
                + g.sig.toFixed(4).replace('.', ',') + '</td><td>'
                + prev.toFixed(0) + ' K</td><td>' + g.TBexp + ' K</td><td>'
                + F.pct(Math.abs(prev - g.TBexp) / g.TBexp, 0) + '</td></tr>';
            }).join('') + '</tbody></table>';
      } else {
        tabela.innerHTML = '';
      }

      nota.innerHTML =
        '<p>À esquerda, o potencial entre duas moléculas e a <b>função de Mayer</b> '
        + '\\(\\Phi(r)=e^{-u(r)/\\kB T}-1\\). Repare que \\(\\Phi\\) vale \\(-1\\) dentro do '
        + 'caroço duro, onde nenhuma configuração é possível, e tende a zero onde não há '
        + 'interação. Ela é, portanto, <b>diferente de zero apenas onde as moléculas se '
        + 'enxergam</b>, e é isso que torna a integral finita.</p>'
        + '<p>À direita, \\(B_2^*(T)=-2\\pi\\int\\Phi(r)r^2dr\\). O caroço duro contribui '
        + 'positivamente e não depende da temperatura; a atração contribui negativamente e '
        + 'vai com \\(1/T\\). Daí a forma \\(B_2 = b - a/\\kB T\\).</p>'
        + '<p>A <b>temperatura de Boyle</b> é onde as duas contribuições se cancelam e o gás '
        + 'imita o ideal apesar de não ser. Abaixo dela a atração domina, o gás é mais '
        + 'compressível que o ideal e pode liquefazer; acima, a repulsão domina e ele é '
        + 'menos compressível. Para Lennard-Jones ela vale \\(T^*_B=3{,}418\\), e a tabela '
        + 'mostra o acordo com gases reais: excelente para nitrogênio e argônio, pior para '
        + 'hélio e hidrogênio, que são leves o bastante para que efeitos quânticos contem.</p>';
      tipografar(nota);
    }

    registrarRedesenho(desenhar);
    tipografar(corpo);
  };

  /* =================================================================
     22. Isotermas de van der Waals e a construção de Maxwell
     Em unidades reduzidas, (P + 3/V²)(3V - 1) = 8T, sem parâmetro
     algum: todas as substâncias caem na mesma curva. É a lei dos
     estados correspondentes.
     ================================================================= */
  REGISTRO.vanderwaals = function (raiz) {
    var corpo = moldura(raiz, 'Isotermas de van der Waals e a construção de Maxwell');

    var est = { T: 0.9, maxwell: true };

    var cv = el('canvas');
    corpo.appendChild(cv);
    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);

    deslizante(ctr, 'temperatura reduzida \\(T_r=T/T_c\\)', 0.80, 1.25, 0.01, 0.90,
      function (v) { est.T = v; desenhar(); },
      function (v) { return v.toFixed(2).replace('.', ','); });

    var cx = el('label', { class: 'caixa' });
    var chk = el('input', { type: 'checkbox', checked: 'checked' });
    cx.appendChild(chk);
    cx.appendChild(el('span', { texto: 'construção de Maxwell' }));
    chk.addEventListener('change', function () { est.maxwell = chk.checked; desenhar(); });
    ctr.appendChild(cx);

    var mostrar = cartoes(corpo, [
      { rot: 'P de coexistência', k: 'p' },
      { rot: 'V do líquido', k: 'vl' },
      { rot: 'V do vapor', k: 'vg' },
      { rot: 'razão V<sub>vapor</sub>/V<sub>líq</sub>', k: 'rz' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    /* forma reduzida: P = 8T/(3V-1) - 3/V² */
    function Pvdw(V, T) { return 8 * T / (3 * V - 1) - 3 / (V * V); }

    /* raízes de Pvdw(V) = P, procuradas por varredura mais bisseção */
    function raizes(P, T) {
      var r = [], V0 = 0.36, V1 = 12, n = 4000, ant = Pvdw(V0, T) - P;
      for (var i = 1; i <= n; i++) {
        var V = V0 + (V1 - V0) * i / n;
        var f = Pvdw(V, T) - P;
        if (ant * f < 0) {
          var a = V0 + (V1 - V0) * (i - 1) / n, b = V;
          r.push(F.bissecao(function (x) { return Pvdw(x, T) - P; }, a, b, 1e-12));
        }
        ant = f;
      }
      return r;
    }

    /* Maxwell: a pressão do patamar é aquela em que as duas áreas entre a
       isoterma e a reta se igualam, o que equivale a igualar os potenciais
       químicos das duas fases. Ela tem de ficar entre o mínimo e o máximo
       locais da isoterma, e é isso que delimita a busca. */
    function extremos(T) {
      var Vmin = null, Vmax = null, ant = null, antV = null;
      for (var i = 0; i <= 4000; i++) {
        var V = 0.35 + (10 - 0.35) * i / 4000;
        var d = (Pvdw(V + 1e-6, T) - Pvdw(V - 1e-6, T)) / 2e-6;
        if (ant !== null && ant * d < 0) {
          if (d > 0) Vmin = 0.5 * (antV + V); else Vmax = 0.5 * (antV + V);
        }
        ant = d; antV = V;
      }
      return { Vmax: Vmax, Vmin: Vmin };
    }

    function maxwell(T) {
      if (T >= 1) return null;
      var ex = extremos(T);
      if (ex.Vmax === null || ex.Vmin === null) return null;
      var Palto = Pvdw(ex.Vmax, T);          // máximo local, do lado do líquido
      var Pbaixo = Pvdw(ex.Vmin, T);         // mínimo local, do lado do vapor
      var lo = Math.max(1e-6, Pbaixo), hi = Palto;
      if (!(hi > lo)) return null;

      function diff(P) {
        var r = raizes(P, T);
        if (r.length < 3) return null;
        var V1 = r[0], V3 = r[r.length - 1];
        return F.simpson(function (V) { return Pvdw(V, T); }, V1, V3, 2000)
             - P * (V3 - V1);
      }

      /* Afasta-se um pouco das pontas: junto ao mínimo e ao máximo locais
         duas das três raízes quase coincidem, e a varredura as perderia. */
      var a = lo + 0.03 * (hi - lo), b = hi - 0.03 * (hi - lo);
      var fa = diff(a), fb = diff(b);
      if (fa === null || fb === null || fa * fb > 0) return null;
      for (var k = 0; k < 90; k++) {
        var m = 0.5 * (a + b), fm = diff(m);
        if (fm === null) break;
        if (fa * fm <= 0) { b = m; fb = fm; } else { a = m; fa = fm; }
      }
      var Pf = 0.5 * (a + b), rr = raizes(Pf, T);
      if (rr.length < 3) return null;
      return { P: Pf, Vl: rr[0], Vg: rr[rr.length - 1] };
    }

    function desenhar() {
      var ax = G.eixos(cv, {
        xmin: 0.33, xmax: 4.2, ymin: 0, ymax: 2.0, altura: 330,
        rotX: 'volume reduzido V/V\u1d9c', rotY: 'pressão reduzida P/P\u1d9c',
        marcasX: G.marcasLineares(0.5, 4, 7, 1),
        formataY: function (v) { return v.toFixed(1).replace('.', ','); }
      });

      // família de isotermas, em cinza
      [0.85, 0.90, 0.95, 1.00, 1.05, 1.15].forEach(function (t) {
        G.curva(ax, function (V) { return Pvdw(V, t); },
                t === 1 ? G.COR.ambar : G.COR.grade, t === 1 ? 1.8 : 1.2);
      });
      // a isoterma escolhida
      G.curva(ax, function (V) { return Pvdw(V, est.T); }, G.COR.azul, 2.6);

      // ponto crítico
      ax.ct.save();
      ax.ct.fillStyle = G.COR.ambar;
      ax.ct.beginPath(); ax.ct.arc(ax.X(1), ax.Y(1), 5, 0, 2 * Math.PI); ax.ct.fill();
      ax.ct.font = '600 11px system-ui, sans-serif';
      ax.ct.fillStyle = G.COR.ambar;
      ax.ct.textAlign = 'left';
      ax.ct.fillText('ponto crítico', ax.X(1) + 8, ax.Y(1) - 6);
      ax.ct.restore();

      // curva de coexistência (binodal), traçada ponto a ponto
      ax.ct.save();
      ax.ct.strokeStyle = G.COR.vinho;
      ax.ct.lineWidth = 1.6;
      ax.ct.setLineDash([4, 3]);
      var esq = [], dir = [];
      for (var t = 0.80; t < 0.999; t += 0.01) {
        var mw = maxwell(t);
        if (mw) { esq.push([mw.Vl, mw.P]); dir.push([mw.Vg, mw.P]); }
      }
      var bin = esq.concat([[1, 1]]).concat(dir.reverse());
      ax.ct.beginPath();
      bin.forEach(function (q, i) {
        if (i) ax.ct.lineTo(ax.X(q[0]), ax.Y(q[1])); else ax.ct.moveTo(ax.X(q[0]), ax.Y(q[1]));
      });
      ax.ct.stroke();
      ax.ct.setLineDash([]);
      ax.ct.restore();

      var m = est.maxwell ? maxwell(est.T) : null;
      if (m) {
        // patamar e as duas áreas iguais
        ax.ct.save();
        ax.ct.fillStyle = 'rgba(181,131,31,.30)';
        var passo = (m.Vg - m.Vl) / 300;
        for (var V = m.Vl; V < m.Vg; V += passo) {
          var y1 = Pvdw(V, est.T), y2 = m.P;
          ax.ct.fillRect(ax.X(V), ax.Y(Math.max(y1, y2)),
                         Math.max(1, ax.X(V + passo) - ax.X(V)),
                         Math.abs(ax.Y(y1) - ax.Y(y2)));
        }
        ax.ct.strokeStyle = G.COR.vinho;
        ax.ct.lineWidth = 2.4;
        ax.ct.beginPath();
        ax.ct.moveTo(ax.X(m.Vl), ax.Y(m.P)); ax.ct.lineTo(ax.X(m.Vg), ax.Y(m.P));
        ax.ct.stroke();
        ax.ct.fillStyle = G.COR.vinho;
        [[m.Vl, 'líquido'], [m.Vg, 'vapor']].forEach(function (q) {
          ax.ct.beginPath(); ax.ct.arc(ax.X(q[0]), ax.Y(m.P), 4, 0, 2 * Math.PI); ax.ct.fill();
        });
        ax.ct.restore();
      }

      mostrar({
        p: m ? F.fmt(m.P, 4) : (est.T >= 1 ? 'acima de T\u1d9c' : '\u00b7'),
        vl: m ? F.fmt(m.Vl, 4) : '\u00b7',
        vg: m ? F.fmt(m.Vg, 4) : '\u00b7',
        rz: m ? F.fmt(m.Vg / m.Vl, 2) : '\u00b7'
      });

      nota.innerHTML = est.T >= 1
        ? '<p>Acima da temperatura crítica a isoterma é monótona: não há patamar, não há '
          + 'duas fases, e não existe distinção entre líquido e gás. Comprimir apenas deixa '
          + 'o fluido mais denso, continuamente. É por isso que não se liquefaz oxigênio à '
          + 'temperatura ambiente por mais pressão que se aplique: é preciso primeiro '
          + 'resfriar abaixo de \\(T_c=155\\) K.</p>'
          + '<p>Baixe \\(T_r\\) abaixo de 1 e o patamar aparece.</p>'
        : '<p>Abaixo de \\(T_c\\) a isoterma de van der Waals tem um trecho com '
          + '\\(\\partial P/\\partial V>0\\): comprimir aumentaria o volume. Isso é '
          + '<b>mecanicamente instável</b> e não pode ocorrer. A natureza resolve separando '
          + 'o sistema em duas fases que coexistem à mesma pressão.</p>'
          + '<p>A <b>construção de Maxwell</b> determina essa pressão exigindo que as duas '
          + 'áreas sombreadas sejam iguais, o que equivale a igualar os potenciais químicos '
          + 'das duas fases. O patamar em vinho liga o líquido, à esquerda, ao vapor, à '
          + 'direita; entre eles o sistema é uma mistura dos dois, e a proporção segue a '
          + 'regra da alavanca.</p>'
          + '<p>A curva tracejada é a <b>binodal</b>, o contorno da região de coexistência, '
          + 'que se fecha no ponto crítico. Como a equação em unidades reduzidas não tem '
          + 'nenhum parâmetro, esta figura é a mesma para <em>toda</em> substância: é a '
          + '<b>lei dos estados correspondentes</b>, e ela funciona surpreendentemente bem '
          + 'para gases simples.</p>';
      tipografar(nota);
    }

    registrarRedesenho(desenhar);
    tipografar(corpo);
  };

  /* =================================================================
     22b. O gás relativístico no espaço de fase
     A camada esférica 4πp²dp é a mesma nos dois casos: o espaço de fase
     não sabe de relatividade. O que muda é o peso de Boltzmann, porque
     muda como a energia depende do momento. Daí sai o 3/2 virando 3.
     ================================================================= */
  REGISTRO.relativistico = function (raiz) {
    var corpo = moldura(raiz, 'Espaço de fase: por que a energia dobra');

    var est = { logth: -2, vista: 'disp' };

    var ctr0 = el('div', { class: 'controles' });
    corpo.appendChild(ctr0);
    opcoes(ctr0, [
      { rot: 'Energia contra momento', v: 'disp' },
      { rot: 'Camada no espaço dos momentos', v: 'mom' },
      { rot: 'Distribuição de energia', v: 'ene' },
      { rot: 'A curva exata', v: 'exata' },
      { rot: 'A adiabática', v: 'adiab' }
    ], 0, function (v) { est.vista = v; desenhar(); });

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    deslizante(ctr, 'temperatura k<sub>B</sub>T/mc²', -3, 2, 0.05, -2,
      function (v) { est.logth = v; desenhar(); },
      function (v) { return F.fmt(Math.pow(10, v), 4); });

    var mostrar = cartoes(corpo, [
      { rot: 'k<sub>B</sub>T/mc²', k: 'th' },
      { rot: '⟨ε⟩/k<sub>B</sub>T', k: 'me' },
      { rot: 'c/k<sub>B</sub>', k: 'cv' },
      { rot: 'γ efetivo', k: 'ga' },
      { rot: 'T para elétrons', k: 'te' },
      { rot: 'T para prótons', k: 'tp' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    /* as temperaturas aqui varrem seis ordens de grandeza: sempre em potências de dez */
    function expo(x) {
      var e = x.toExponential(2).split('e');
      return e[0].replace('.', ',') + '×10<sup>' + Number(e[1]) + '</sup>';
    }

    /* tudo em unidades de mc² e mc: x = p/mc, e(x) = energia cinética/mc² */
    function ecin(x) { return Math.sqrt(1 + x * x) - 1; }

    /* O integrando x²e^{-e(x)/θ} é estreito para θ pequeno (largura ~√θ) e
       largo para θ grande (largura ~θ). O limite superior acompanha os dois. */
    function topo(th) { return 8 * Math.sqrt(th) + 40 * th; }

    function momentos(th) {
      var T = topo(th);
      var w = function (x) {
        var y = ecin(x) / th;
        return y > 700 ? 0 : x * x * Math.exp(-y);
      };
      var den = F.simpson(w, 0, T, 3000);
      var num = F.simpson(function (x) { return ecin(x) * w(x); }, 0, T, 3000);
      return den > 0 ? num / den / th : 1.5;
    }

    /* A solução exata, em função de Bessel modificada de segunda espécie:
       com a substituição p = mc·senh θ a integral vira a representação
       integral de K₂, e a energia cinética média fica
         ⟨ε⟩ = mc²[1/x − 1 + (K₁(x)+K₃(x))/2K₂(x)],   x = βmc² = mc²/kT.
       Aqui em unidades de kB T. Confere com a quadratura direta acima em
       cinco casas em toda a faixa do deslizante. */
    function besselMedia(th) {
      var x = 1 / th;
      return x * (1 / x - 1
        + (F.besselKe(1, x) + F.besselKe(3, x)) / (2 * F.besselKe(2, x)));
    }

    /* A adiabática, da seção 15: impor dS = 0 na entropia de Jüttner deixa
         x·R(x) + ln[V K₂(x)/x] = const,  R = (K₁+K₃)/2K₂,
       de onde o volume sai explicitamente, sem resolver equação nenhuma.
       Trabalha-se com e^x K₂ para que x grande não estoure. */
    function lnVolume(x) {
      var R = (F.besselKe(1, x) + F.besselKe(3, x)) / (2 * F.besselKe(2, x));
      return -x * R - Math.log(F.besselKe(2, x)) + x + Math.log(x);
    }

    function desenhar() {
      var th = Math.pow(10, est.logth);
      var med = besselMedia(th);
      var h = th * 1e-3;
      var cv1 = ((th + h) * besselMedia(th + h)
                 - (th - h) * besselMedia(th - h)) / (2 * h);
      /* γ = (c + kB)/c para um gás ideal com esse calor específico */
      var gama = (cv1 + 1) / cv1;
      /* momento típico: onde x²e^{-e/θ} é máximo */
      var xpico = F.bissecao(function (x) {
        return 2 / x - (x / Math.sqrt(1 + x * x)) / th;
      }, 1e-6, 1e4, 1e-12) || Math.sqrt(2 * th);

      if (est.vista === 'disp') {
        var xm = Math.max(3, 4 * xpico);
        var ax = G.eixos(cv, {
          xmin: 0, xmax: xm, ymin: 0, ymax: Math.max(2, ecin(xm)) * 1.05, altura: 300,
          rotX: 'momento p/mc', rotY: 'energia cinética ε/mc²',
          marcasX: G.marcasLineares(0, xm, 6, 1),
          formataY: function (v) { return F.fmt(v, 1); }
        });
        G.curva(ax, function (x) { return x * x / 2; }, G.COR.azul, 2, [6, 4]);
        G.curva(ax, function (x) { return x; }, G.COR.ambar, 2, [6, 4]);
        G.curva(ax, ecin, G.COR.vinho, 2.8);
        G.vertical(ax, xpico, G.COR.verde, 'p típico', true);
        G.legenda(ax, [
          { cor: G.COR.vinho, texto: 'exata: √(p²c²+m²c⁴) − mc²' },
          { cor: G.COR.azul, texto: 'não relativística: p²/2m' },
          { cor: G.COR.ambar, texto: 'ultrarrelativística: pc' }
        ]);
      } else if (est.vista === 'mom') {
        var xm2 = Math.max(4 * xpico, 1e-3);
        var w = function (x) {
          var y = ecin(x) / th;
          return y > 700 ? 0 : x * x * Math.exp(-y);
        };
        var norm = F.simpson(w, 0, topo(th), 3000);
        /* os dois limites, com a mesma normalização, para ver de qual
           dos dois a curva exata está perto nesta temperatura */
        var wnr = function (x) {
          var y = x * x / (2 * th);
          return y > 700 ? 0 : x * x * Math.exp(-y);
        };
        var wur = function (x) {
          var y = x / th;
          return y > 700 ? 0 : x * x * Math.exp(-y);
        };
        var nnr = F.simpson(wnr, 0, topo(th), 3000);
        var nur = F.simpson(wur, 0, topo(th) + 40 * th, 3000);
        /* a escala vertical tem de caber as três curvas */
        var alto = 0;
        for (var q = 0; q <= 300; q++) {
          var xq = xm2 * q / 300;
          alto = Math.max(alto, w(xq) / norm, wnr(xq) / nnr, wur(xq) / nur);
        }
        var ax2 = G.eixos(cv, {
          xmin: 0, xmax: xm2, ymin: 0, ymax: 1.15 * alto, altura: 300,
          rotX: 'momento p/mc',
          rotY: 'partículas por intervalo de momento',
          marcasX: G.marcasLineares(0, xm2, 6, xm2 < 1 ? 2 : 1),
          formataY: function () { return ''; }
        });
        /* a camada esférica sozinha, sem o peso de Boltzmann */
        var esc = 0.96 * 1.15 * alto / (xm2 * xm2);
        G.curva(ax2, function (x) { return esc * x * x; }, G.COR.suave, 1.4, [3, 3]);
        G.area(ax2, function (x) { return w(x) / norm; }, 0, xm2, 'rgba(140,47,57,.16)');
        /* a exata por baixo e grossa, os limites tracejados por cima: assim
           o que coincide aparece como tracejado montado sobre a curva cheia */
        G.curva(ax2, function (x) { return w(x) / norm; }, G.COR.vinho, 3.4);
        G.curva(ax2, function (x) { return wnr(x) / nnr; }, G.COR.azul, 1.8, [6, 4]);
        G.curva(ax2, function (x) { return wur(x) / nur; }, G.COR.ambar, 1.8, [6, 4]);
        G.vertical(ax2, xpico, G.COR.verde, 'p típico', true);
        G.legenda(ax2, [
          { cor: G.COR.suave, texto: 'camada 4πp²dp: só geometria' },
          { cor: G.COR.vinho, texto: 'camada × peso exato' },
          { cor: G.COR.azul, texto: 'peso não relativístico' },
          { cor: G.COR.ambar, texto: 'peso ultrarrelativístico' }
        ]);
      } else if (est.vista === 'exata') {
        /* a figura do resultado de Bessel: ⟨ε⟩/kT contra log₁₀(kT/mc²) */
        var ax4 = G.eixos(cv, {
          xmin: -3, xmax: 2, ymin: 1.3, ymax: 3.2, altura: 300,
          rotX: 'log₁₀(kT/mc²)', rotY: '⟨ε⟩ / kT',
          marcasX: G.marcasLineares(-3, 2, 5, 0),
          formataY: function (v) { return F.fmt(v, 1); }
        });
        G.curva(ax4, function () { return 1.5; }, G.COR.azul, 1.6, [6, 4]);
        G.curva(ax4, function () { return 3; }, G.COR.ambar, 1.6, [6, 4]);
        G.curva(ax4, function (lg) { return besselMedia(Math.pow(10, lg)); },
                G.COR.vinho, 3);
        /* os pontos verdes são a quadratura direta das mesmas integrais, sem
           passar por Bessel: se a dedução estiver certa, caem sobre a curva */
        ax4.ct.save();
        ax4.ct.fillStyle = G.COR.verde;
        for (var j = -3; j <= 2.0001; j += 0.25) {
          ax4.ct.beginPath();
          ax4.ct.arc(ax4.X(j), ax4.Y(Math.min(3.2, momentos(Math.pow(10, j)))),
                     3.2, 0, 2 * Math.PI);
          ax4.ct.fill();
        }
        ax4.ct.restore();
        G.vertical(ax4, est.logth, G.COR.tinta, 'aqui', true);
        G.legenda(ax4, [
          { cor: G.COR.vinho, texto: 'exata, via K₂(βmc²)' },
          { cor: G.COR.verde, texto: 'quadratura direta' },
          { cor: G.COR.azul, texto: '3/2' },
          { cor: G.COR.ambar, texto: '3' }
        ]);
      } else if (est.vista === 'adiab') {
        /* A adiabática em P-V quase não se dobra: o expoente passa de 4/3 a
           5/3, e numa escala log isso é uma curvatura imperceptível. O que
           vale a pena traçar é a própria inclinação local. */
        var ax5 = G.eixos(cv, {
          xmin: -6, xmax: 4, ymin: 1.28, ymax: 1.82, altura: 310,
          rotX: 'log₁₀(V/V\u2080) ao longo da adiabática',
          rotY: 'inclinação local −d ln P / d ln V',
          marcasX: G.marcasLineares(-6, 4, 10, 0),
          formataY: function (v) { return F.fmt(v, 2); }
        });
        G.curva(ax5, function () { return 4 / 3; }, G.COR.ambar, 1.8, [6, 4]);
        G.curva(ax5, function () { return 5 / 3; }, G.COR.azul, 1.8, [6, 4]);

        /* lnV é monótona decrescente em x (comprimir aquece), de modo que
           cada volume corresponde a um único x: a bisseção o encontra. */
        var lv0 = lnVolume(1);
        function xDoVolume(lv) {
          return F.bissecao(function (xx) {
            return lnVolume(xx) - lv0 - lv * Math.LN10;
          }, 1e-4, 1e4, 1e-12);
        }

        /* a curva: γ = 1 + kB/c_V, com c_V vindo da energia de Bessel */
        G.curva(ax5, function (lv) {
          var xx = xDoVolume(lv);
          if (!xx) return NaN;
          var t = 1 / xx, h = t * 1e-4;
          var c = ((t + h) * besselMedia(t + h)
                 - (t - h) * besselMedia(t - h)) / (2 * h);
          return 1 + 1 / c;
        }, G.COR.vinho, 3);

        /* os pontos: a inclinação medida na própria adiabática, por
           diferença finita em ln P e ln V. Nenhum c_V entra aqui. */
        ax5.ct.save();
        ax5.ct.fillStyle = G.COR.verde;
        for (var j = -5.5; j <= 3.51; j += 0.5) {
          var xa = xDoVolume(j - 0.05), xb = xDoVolume(j + 0.05);
          if (!xa || !xb) continue;
          var dlnV = lnVolume(xb) - lnVolume(xa);
          var dlnP = (-Math.log(xb) - lnVolume(xb))
                   - (-Math.log(xa) - lnVolume(xa));
          ax5.ct.beginPath();
          ax5.ct.arc(ax5.X(j), ax5.Y(-dlnP / dlnV), 3.2, 0, 2 * Math.PI);
          ax5.ct.fill();
        }
        ax5.ct.restore();

        var lvAqui = (lnVolume(1 / th) - lv0) / Math.LN10;
        if (lvAqui > -6 && lvAqui < 4) {
          G.vertical(ax5, lvAqui, G.COR.tinta, 'aqui', true);
        }
        G.legenda(ax5, [
          { cor: G.COR.vinho, texto: 'γ = 1 + k/c_V, do calor específico' },
          { cor: G.COR.verde, texto: 'inclinação medida na adiabática' },
          { cor: G.COR.ambar, texto: '4/3 e 5/3' }
        ]);
      } else {
        var ax3 = G.eixos(cv, {
          xmin: 0, xmax: 10, ymin: 0, ymax: 0.62, altura: 300,
          rotX: 'energia ε/kT', rotY: 'densidade de probabilidade',
          marcasX: G.marcasLineares(0, 10, 10, 0),
          formataY: function () { return ''; }
        });
        /* √π/2 e 2 são as normalizações de Γ(3/2) e Γ(3) */
        var fnr = function (u) {
          return u <= 0 ? 0 : 2 / Math.sqrt(Math.PI) * Math.sqrt(u) * Math.exp(-u);
        };
        var fur = function (u) {
          return u <= 0 ? 0 : 0.5 * u * u * Math.exp(-u);
        };
        G.area(ax3, fnr, 0, 10, 'rgba(44,95,141,.16)');
        G.area(ax3, fur, 0, 10, 'rgba(181,131,31,.16)');
        G.curva(ax3, fnr, G.COR.azul, 2.8);
        G.curva(ax3, fur, G.COR.ambar, 2.8);
        G.vertical(ax3, 1.5, G.COR.azul, '3/2', true);
        G.vertical(ax3, 3, G.COR.ambar, '3', true);
        G.legenda(ax3, [
          { cor: G.COR.azul, texto: 'não relativístico: g(ε) ∝ √ε' },
          { cor: G.COR.ambar, texto: 'ultrarrelativístico: g(ε) ∝ ε²' }
        ]);
      }

      mostrar({
        th: F.fmt(th, 4),
        me: F.fmt(med, 3),
        cv: F.fmt(cv1, 3),
        ga: F.fmt(gama, 3),
        te: expo(th * 5.9299e9) + ' K',
        tp: expo(th * 1.0889e13) + ' K'
      });

      nota.innerHTML = est.vista === 'disp'
        ? '<p>A curva exata encosta na parábola quando \\(p\\ll mc\\) e na reta quando '
          + '\\(p\\gg mc\\). A linha verde marca o momento típico das partículas na '
          + 'temperatura escolhida, e é só isso que decide em que regime o gás está: '
          + 'relatividade aqui não é uma propriedade da partícula, é uma propriedade do '
          + '<em>gás</em>.</p>'
          + '<p>Para elétrons, \\(mc^2/\\kB=5{,}9\\times10^9\\) K, de modo que um gás de '
          + 'elétrons só fica relativístico a bilhões de kelvin. Numa anã branca, porém, não é '
          + 'a temperatura que empurra os elétrons para cima na curva, e sim a densidade: a '
          + 'exclusão de Pauli obriga o momento de Fermi a crescer como \\(n^{1/3}\\), e em '
          + 'Sirius B ele já vale \\(p_Fc\\approx0{,}55\\) MeV, acima de \\(mc^2\\). É o '
          + 'assunto do Módulo 8.</p>'
        : est.vista === 'mom'
        ? '<p>Esta é a figura que explica tudo. A curva tracejada é a <b>camada esférica</b> '
          + 'do espaço dos momentos, \\(4\\pi p^2dp\\): quantos estados existem com módulo de '
          + 'momento entre \\(p\\) e \\(p+dp\\). Ela é pura geometria e <em>não muda</em> com '
          + 'a relatividade.</p>'
          + '<p>O que muda é o peso de Boltzmann que multiplica essa camada. Com '
          + '\\(\\epsilon=p^2/2m\\) o corte é gaussiano, \\(e^{-p^2/2m\\kB T}\\), e morre '
          + 'depressa. Com \\(\\epsilon=pc\\) o corte é uma exponencial simples, '
          + '\\(e^{-pc/\\kB T}\\), que tem cauda muito mais longa. Mais partículas sobrevivem '
          + 'com momento alto, e cada uma delas custa mais energia: é a composição dos dois '
          + 'efeitos que dobra \\(U\\).</p>'
        : est.vista === 'adiab'
        ? '<p>Esta é a adiabática da seção 15. Impor \\(dS=0\\) na entropia do gás de '
          + 'Jüttner deixa um invariante em forma fechada, '
          + '\\(xR(x)+\\ln\\!\\left[VK_2(x)/x\\right]=\\text{const}\\), e é ele que a '
          + 'curva vinho traça.</p>'
          + '<p>Em escala logarítmica, uma lei de potência \\(PV^\\gamma=\\) const é uma '
          + 'reta de inclinação \\(-\\gamma\\). A adiabática exata não é uma reta: ela '
          + 'encosta na tracejada âmbar à esquerda, onde o gás é quente e '
          + 'ultrarrelativístico, e vai se deitando até encostar na azul à direita, onde '
          + 'expandiu, esfriou e virou um gás comum. O expoente adiabático é uma função da '
          + 'temperatura, não uma constante do gás.</p>'
          + '<p>A inclinação local vale \\(\\gamma=1+\\kB/c_V\\), que para um gás ideal '
          + 'com \\(PV=N\\kB T\\) é identidade exata, mesmo com \\(c_V\\) dependendo da '
          + 'temperatura: de \\(N c_V\\,dT=-P\\,dV\\) sai '
          + '\\(c_V\\,d\\ln T=-\\kB\\,d\\ln V\\). O cartão de \\(\\gamma\\) acima, '
          + 'calculado do calor específico, bate com a inclinação desta curva em cinco '
          + 'casas decimais em toda a faixa, e são dois caminhos independentes.</p>'
        : est.vista === 'exata'
        ? '<p>Esta é a curva da seção 14, traçada pela solução exata '
          + '\\(\\med{\\epsilon}=mc^2\\left[\\frac1x-1+\\frac{K_1(x)+K_3(x)}{2K_2(x)}\\right]\\), '
          + 'com \\(x=mc^2/\\kB T\\), e com \\(K_a\\) calculada pela própria representação '
          + 'integral \\(K_a(x)=\\int_0^\\infty e^{-x\\cosh t}\\cosh(at)\\,dt\\) de onde ela '
          + 'veio.</p>'
          + '<p>Os pontos verdes são a quadratura direta de '
          + '\\(\\int p^2\\epsilon\\,e^{-\\beta\\epsilon}dp\\big/\\int p^2e^{-\\beta\\epsilon}dp\\), '
          + 'sem passar por Bessel em momento algum. Eles caem sobre a curva em cinco casas '
          + 'decimais, o que verifica a substituição '
          + '\\(p=mc\\,\\operatorname{senh}\\theta\\) e as identidades de \\(K_a\\) usadas na '
          + 'dedução.</p>'
          + '<p>Repare onde fica a transição: ela ocupa umas três décadas de temperatura e '
          + 'não tem nada de abrupto. Metade do caminho entre \\(3/2\\) e \\(3\\) é cruzada '
          + 'perto de \\(\\kB T\\approx mc^2/3\\), bem antes de a partícula típica ser '
          + 'relativística. Quem comanda é a cauda da distribuição.</p>'
        : '<p>Traduzida de momento para energia, a mesma camada vira a <b>densidade de '
          + 'estados</b>. Com \\(\\epsilon=p^2/2m\\), \\(p\\propto\\sqrt\\epsilon\\) e '
          + '\\(g(\\epsilon)\\propto\\sqrt\\epsilon\\); com \\(\\epsilon=pc\\), '
          + '\\(p\\propto\\epsilon\\) e \\(g(\\epsilon)\\propto\\epsilon^2\\). A segunda '
          + 'cresce muito mais rápido, e o pico da distribuição se desloca para a direita.</p>'
          + '<p>As médias saem de \\(\\int u^{s}e^{-u}du=\\Gamma(s+1)\\) e são exatamente as '
          + 'linhas tracejadas: \\(\\med{\\epsilon}=\\frac32\\kB T\\) num caso e '
          + '\\(3\\kB T\\) no outro. É a mesma equipartição de sempre, contada direito: o '
          + 'teorema dá \\(\\frac12\\kB T\\) por variável <em>quadrática</em>, e '
          + '\\(\\kB T\\) por variável <em>linear</em>. São três componentes do momento nos '
          + 'dois casos, e só muda a potência.</p>'
          + '<p>Os cartões acima usam a relação exata, não os dois limites: deslize a '
          + 'temperatura e veja \\(c/\\kB\\) subir continuamente de \\(3/2\\) para \\(3\\), '
          + 'levando \\(\\gamma\\) de \\(5/3\\) para \\(4/3\\).</p>';
      tipografar(nota);
    }

    registrarRedesenho(desenhar);
    tipografar(corpo);
  };

  /* =================================================================
     23. As três estatísticas de ocupação
     Fermi, Bose e Maxwell-Boltzmann na mesma figura. A segunda vista
     colapsa as três em curvas universais de (ε−μ)/kT, que é a única
     escala do problema.
     ================================================================= */
  REGISTRO.estatisticas = function (raiz) {
    var corpo = moldura(raiz, 'Fermi, Bose e Maxwell: a mesma conta, três resultados');

    var kBeV = 8.617333262e-5;        // eV/K
    var est = { mu: 5, T: 3000, vista: 'ev' };

    var ctr0 = el('div', { class: 'controles' });
    corpo.appendChild(ctr0);
    opcoes(ctr0, [
      { rot: 'Energia em elétron-volt', v: 'ev' },
      { rot: 'Escala universal', v: 'uni' }
    ], 0, function (v) { est.vista = v; desenhar(); });

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    deslizante(ctr, 'potencial químico μ', 0.5, 8, 0.1, 5,
      function (v) { est.mu = v; desenhar(); },
      function (v) { return F.fmt(v, 1) + ' eV'; });
    deslizante(ctr, 'temperatura', 200, 30000, 100, 3000,
      function (v) { est.T = v; desenhar(); },
      function (v) { return v + ' K'; });

    var mostrar = cartoes(corpo, [
      { rot: 'k<sub>B</sub>T', k: 'kt' },
      { rot: 'Fermi em ε = μ', k: 'nf' },
      { rot: 'largura do degrau', k: 'w' },
      { rot: 'ε − μ para 1% de erro', k: 'x1' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    function desenhar() {
      var kt = kBeV * est.T, mu = est.mu;

      if (est.vista === 'ev') {
        var ax = G.eixos(cv, {
          xmin: 0, xmax: 10, ymin: 0, ymax: 3, altura: 300,
          rotX: 'energia do estado individual ε (eV)',
          rotY: 'ocupação média n̄(ε)',
          marcasX: G.marcasLineares(0, 10, 10, 0),
          formataY: function (v) { return F.fmt(v, 1); }
        });
        G.curva(ax, function (e) {
          return e <= mu + 1e-9 ? NaN : 1 / (Math.exp((e - mu) / kt) - 1);
        }, G.COR.vinho, 2.4);
        G.curva(ax, function (e) { return Math.exp(-(e - mu) / kt); },
                G.COR.ambar, 2, [6, 4]);
        G.curva(ax, function (e) { return 1 / (Math.exp((e - mu) / kt) + 1); },
                G.COR.azul, 2.8);
        G.vertical(ax, mu, G.COR.tinta, 'μ', true);
        G.legenda(ax, [
          { cor: G.COR.azul, texto: 'Fermi-Dirac' },
          { cor: G.COR.vinho, texto: 'Bose-Einstein' },
          { cor: G.COR.ambar, texto: 'Maxwell-Boltzmann' }
        ]);
      } else {
        var ax2 = G.eixos(cv, {
          xmin: -5, xmax: 8, ymin: 0, ymax: 3, altura: 300,
          rotX: '(ε − μ) / kT',
          rotY: 'ocupação média n̄',
          marcasX: G.marcasLineares(-5, 8, 13, 0),
          formataY: function (v) { return F.fmt(v, 1); }
        });
        G.curva(ax2, function (x) {
          return x <= 1e-9 ? NaN : 1 / (Math.exp(x) - 1);
        }, G.COR.vinho, 2.4);
        G.curva(ax2, function (x) { return Math.exp(-x); }, G.COR.ambar, 2, [6, 4]);
        G.curva(ax2, function (x) { return 1 / (Math.exp(x) + 1); }, G.COR.azul, 2.8);
        G.vertical(ax2, 4.605, G.COR.verde, 'erro de 1%', true);
        G.legenda(ax2, [
          { cor: G.COR.azul, texto: 'Fermi-Dirac' },
          { cor: G.COR.vinho, texto: 'Bose-Einstein' },
          { cor: G.COR.ambar, texto: 'Maxwell-Boltzmann' }
        ]);
      }

      mostrar({
        kt: F.fmt(kt, 4) + ' eV',
        nf: '1/2',
        w: '≈ ' + F.fmt(4 * kt, 3) + ' eV',
        x1: F.fmt(4.605 * kt, 4) + ' eV'
      });

      nota.innerHTML = est.vista === 'ev'
        ? '<p>As três curvas saem da mesma grande função de partição. A diferença está '
          + 'apenas em quantos termos a soma \\(Y_j=\\sum_{n_j}e^{\\beta(\\mu-\\epsilon_j)n_j}\\) '
          + 'admite: dois para férmions (\\(n_j=0,1\\)), infinitos para bósons, e o limite '
          + 'diluído para Maxwell-Boltzmann.</p>'
          + '<p>Mexa no potencial químico e repare que <b>μ é a energia onde a curva de Fermi '
          + 'vale exatamente 1/2</b>, qualquer que seja a temperatura. A de Bose, ao '
          + 'contrário, diverge quando \\(\\epsilon\\to\\mu^+\\) e não existe abaixo de μ: é '
          + 'por isso que um gás de bósons é obrigado a manter \\(\\mu<\\epsilon_0\\), e é '
          + 'desse aperto que nasce a condensação.</p>'
        : '<p>Em função de \\((\\epsilon-\\mu)/\\kB T\\) as três curvas não têm mais nenhum '
          + 'parâmetro: toda a temperatura e toda a densidade do problema estão escondidas '
          + 'dentro do eixo. É a figura que vale para qualquer gás quântico.</p>'
          + '<p>À direita da linha verde as três coincidem dentro de 1%, porque '
          + '\\(e^{x}\\pm1\\approx e^{x}\\) quando \\(x\\gtrsim4{,}6\\). Essa é a resposta '
          + 'quantitativa à pergunta do Módulo 6: a estatística quântica só se manifesta nos '
          + 'estados cuja energia está a menos de uns poucos \\(\\kB T\\) do potencial '
          + 'químico. Num gás diluído, \\(\\mu\\) é tão negativo que <em>nenhum</em> estado '
          + 'satisfaz isso, e a contagem clássica volta a valer.</p>';
      tipografar(nota);
    }

    registrarRedesenho(desenhar);
    tipografar(corpo);
  };

  /* =================================================================
     24. O gás de Fermi
     O potencial químico é resolvido de verdade, impondo que a integral
     de n̄(ε)g(ε) devolva N. A integral é partida em três trechos porque
     a baixas temperaturas o integrando é um degrau de largura ~kT, e
     uma varredura uniforme o atravessaria sem ver.
     ================================================================= */
  REGISTRO.gasfermi = function (raiz) {
    var corpo = moldura(raiz, 'O gás de Fermi: mar preenchido, pressão no zero absoluto');

    /* n em m^-3 (um elétron de condução por átomo, exceto o alumínio, com três),
       gama medido em mJ/(mol·K²), theta de Debye em K */
    var METAIS = [
      { nome: 'Cu', rot: 'cobre', n: 8.47e28, gama: 0.695, thetaD: 343 },
      { nome: 'Ag', rot: 'prata', n: 5.86e28, gama: 0.646, thetaD: 225 },
      { nome: 'Au', rot: 'ouro', n: 5.90e28, gama: 0.729, thetaD: 165 },
      { nome: 'Na', rot: 'sódio', n: 2.65e28, gama: 1.38, thetaD: 158 },
      { nome: 'Li', rot: 'lítio', n: 4.70e28, gama: 1.63, thetaD: 344 },
      { nome: 'Al', rot: 'alumínio', n: 18.1e28, gama: 1.35, thetaD: 428 }
    ];

    var est = { i: 0, logT: 2.477, vista: 'dist' };

    var ctr0 = el('div', { class: 'controles' });
    corpo.appendChild(ctr0);
    opcoes(ctr0, [
      { rot: 'Distribuição e potencial químico', v: 'dist' },
      { rot: 'Metais reais', v: 'metais' }
    ], 0, function (v) { est.vista = v; desenhar(); });

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    deslizante(ctr, 'temperatura', 1, 5.4, 0.02, 2.477,
      function (v) { est.logT = v; desenhar(); },
      function (v) {
        var T = Math.pow(10, v);
        return T < 1e4 ? F.fmt(T, 0) + ' K' : F.fmt(T / 1000, 1) + ' mil K';
      });
    opcoes(ctr, METAIS.map(function (m) { return { rot: m.rot, v: m.nome }; }), 0,
      function (v) {
        METAIS.forEach(function (m, k) { if (m.nome === v) est.i = k; });
        desenhar();
      });

    var mostrar = cartoes(corpo, [
      { rot: 'ε<sub>F</sub>', k: 'ef' }, { rot: 'T<sub>F</sub>', k: 'tf' },
      { rot: 'T/T<sub>F</sub>', k: 'teq' }, { rot: 'μ/ε<sub>F</sub>', k: 'mu' },
      { rot: 'pressão a T = 0', k: 'p' }, { rot: 'v<sub>F</sub>', k: 'vf' }
    ]);
    var tabela = el('div', { class: 'tabela-rolavel' });
    corpo.appendChild(tabela);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    function energiaFermi(n) {
      return F.C.hbar * F.C.hbar / (2 * F.C.me)
             * Math.pow(3 * Math.PI * Math.PI * n, 2 / 3);
    }

    /* Em unidades reduzidas x = ε/εF e t = T/TF, o número de partículas é
       ∫₀^∞ √x n̄ dx = 2/3. Abaixo de μ−12t a ocupação é 1 a menos de e^-12,
       e lá a integral de √x é analítica: é o trecho que se resolve de graça. */
    function numeroReduzido(m, t) {
      var f = function (x) {
        if (x < 0) return 0;
        var y = (x - m) / t;
        return y > 700 ? 0 : Math.sqrt(x) / (Math.exp(y) + 1);
      };
      var a = Math.max(0, m - 12 * t);
      var s = (2 / 3) * Math.pow(a, 1.5);
      var b = Math.max(a + 1e-9, m + 14 * t);
      s += F.simpson(f, a, b, 1200);
      s += F.simpson(f, b, b + 60 * t, 400);
      return s;
    }

    function energiaReduzida(m, t) {
      var f = function (x) {
        if (x < 0) return 0;
        var y = (x - m) / t;
        return y > 700 ? 0 : Math.pow(x, 1.5) / (Math.exp(y) + 1);
      };
      var a = Math.max(0, m - 12 * t);
      var s = 0.4 * Math.pow(a, 2.5);
      var b = Math.max(a + 1e-9, m + 14 * t);
      s += F.simpson(f, a, b, 1200);
      s += F.simpson(f, b, b + 60 * t, 400);
      return 1.5 * s;                     // U/(N εF)
    }

    /* μ(t) por bisseção: o lado esquerdo cresce com m, de modo que há
       exatamente uma raiz de numeroReduzido − 2/3. */
    function muReduzido(t) {
      var r = F.bissecao(function (m) { return numeroReduzido(m, t) - 2 / 3; },
                         -60 * t - 1, 3, 1e-12);
      return r === null ? 1 : r;
    }

    function desenhar() {
      var M = METAIS[est.i];
      var eF = energiaFermi(M.n), TF = eF / F.C.kB;
      var T = Math.pow(10, est.logT);
      var t = T / TF, m = muReduzido(t);

      if (est.vista === 'dist') {
        /* Eixos absolutos, e não reduzidos: é o que faz a escolha do metal
           mudar a figura. O sódio tem o degrau em 3,2 eV e o alumínio em
           11,7 eV, e as alturas diferem porque as densidades diferem.
           dn/dε = (8√2 π m^{3/2}/h³)√ε, aqui em 10²⁸ m⁻³ por eV. */
        var CDE = 8 * Math.SQRT2 * Math.PI * Math.pow(F.C.me, 1.5)
                  / Math.pow(F.C.h, 3) * Math.pow(F.C.e, 1.5) / 1e28;
        var xmax = 20, ymax = 3.5;
        var dens = function (eV) { return eV <= 0 ? 0 : CDE * Math.sqrt(eV); };
        var ocup = function (eV) {
          if (eV <= 0) return 0;
          var y = (eV / (eF / F.C.e) - m) / t;
          return dens(eV) / (y > 700 ? Infinity : Math.exp(y) + 1);
        };
        var ax = G.eixos(cv, {
          xmin: 0, xmax: xmax, ymin: 0, ymax: ymax, altura: 310,
          rotX: 'energia do estado ε (eV)',
          rotY: 'elétrons por eV (10²⁸ m⁻³)',
          marcasX: G.marcasLineares(0, xmax, 10, 0),
          formataY: function (v) { return F.fmt(v, 1); }
        });
        G.area(ax, ocup, 0, xmax, 'rgba(44,95,141,.24)');
        G.curva(ax, dens, G.COR.suave, 1.6, [5, 4]);
        /* as pontas dos outros metais, para comparar */
        ax.ct.save();
        ax.ct.font = '600 10px system-ui, sans-serif';
        ax.ct.textAlign = 'center';
        ax.ct.textBaseline = 'bottom';
        METAIS.forEach(function (q, k) {
          if (k === est.i) return;
          var E = energiaFermi(q.n) / F.C.e;
          ax.ct.fillStyle = 'rgba(120,128,138,.85)';
          ax.ct.beginPath();
          ax.ct.arc(ax.X(E), ax.Y(dens(E)), 2.6, 0, 2 * Math.PI);
          ax.ct.fill();
          ax.ct.fillText(q.nome, ax.X(E), ax.Y(dens(E)) - 5);
        });
        ax.ct.restore();
        G.curva(ax, ocup, G.COR.azul, 2.8);
        G.vertical(ax, eF / F.C.e, G.COR.tinta, 'ε de Fermi', true);
        G.legenda(ax, [
          { cor: G.COR.suave, texto: 'densidade de estados g(ε) ∝ √ε' },
          { cor: G.COR.azul, texto: 'n̄(ε) g(ε): o que está ocupado' }
        ]);
        tabela.innerHTML = '';
      } else {
        var ax2 = G.eixos(cv, {
          xmin: 0, xmax: 20, ymin: 0, ymax: 14, altura: 300,
          rotX: 'densidade de elétrons de condução (10²⁸ m⁻³)',
          rotY: 'energia de Fermi (eV)',
          marcasX: G.marcasLineares(0, 20, 10, 0),
          formataY: function (v) { return F.fmt(v, 0); }
        });
        G.curva(ax2, function (x) {
          return x <= 0 ? 0 : energiaFermi(x * 1e28) / F.C.e;
        }, G.COR.azul, 2.4);
        ax2.ct.save();
        ax2.ct.font = '600 11px system-ui, sans-serif';
        ax2.ct.textAlign = 'center';
        ax2.ct.textBaseline = 'bottom';
        METAIS.forEach(function (q, k) {
          var x = ax2.X(q.n / 1e28), y = ax2.Y(energiaFermi(q.n) / F.C.e);
          ax2.ct.fillStyle = k === est.i ? G.COR.vinho : G.COR.tinta;
          ax2.ct.beginPath();
          ax2.ct.arc(x, y, k === est.i ? 5 : 3.5, 0, 2 * Math.PI);
          ax2.ct.fill();
          ax2.ct.fillText(q.nome, x, y - 7);
        });
        ax2.ct.restore();

        var linhas = METAIS.map(function (q) {
          var E = energiaFermi(q.n);
          var gt = Math.PI * Math.PI * F.C.R / (2 * E / F.C.kB) * 1000;
          return '<tr><td><b>' + q.nome + '</b></td>'
               + '<td>' + F.fmt(q.n / 1e28, 2) + '</td>'
               + '<td>' + F.fmt(E / F.C.e, 2) + '</td>'
               + '<td>' + F.fmt(E / F.C.kB / 1000, 1) + '</td>'
               + '<td>' + F.fmt(0.4 * q.n * E / 1e9, 1) + '</td>'
               + '<td>' + F.fmt(gt, 3) + '</td>'
               + '<td>' + F.fmt(q.gama, 3) + '</td>'
               + '<td>' + F.fmt(q.gama / gt, 2) + '</td></tr>';
        }).join('');
        tabela.innerHTML = '<table><thead><tr><th>Metal</th>'
          + '<th>n (10²⁸ m⁻³)</th><th>ε<sub>F</sub> (eV)</th>'
          + '<th>T<sub>F</sub> (10³ K)</th><th>P a T=0 (GPa)</th>'
          + '<th>γ teórico</th><th>γ medido</th><th>m*/m</th></tr></thead><tbody>'
          + linhas + '</tbody></table>'
          + '<p class="legenda-tabela">γ em mJ/(mol·K²).</p>';
      }

      mostrar({
        ef: F.fmt(eF / F.C.e, 3) + ' eV',
        tf: F.fmt(TF, 0) + ' K',
        teq: F.fmt(t, 4),
        mu: F.fmt(m, 4),
        p: F.fmt(0.4 * M.n * eF / 1e9, 1) + ' GPa',
        vf: F.fmt(Math.sqrt(2 * eF / F.C.me) / 1e6, 3) + '×10⁶ m/s'
      });

      nota.innerHTML = est.vista === 'dist'
        ? '<p>A curva tracejada é a densidade de estados, \\(g(\\epsilon)\\propto\\sqrt{\\epsilon}\\). '
          + 'A área sombreada é o que está de fato ocupado, \\(\\bar n(\\epsilon)g(\\epsilon)\\), e '
          + 'ela vale \\(N\\) seja qual for a temperatura: é essa condição que fixa \\(\\mu\\), e '
          + 'o widget a resolve numericamente a cada passo, sem usar a expansão de '
          + 'Sommerfeld.</p>'
          + '<p>Deslize a temperatura e veja o que acontece. O degrau só amolece numa faixa de '
          + 'largura \\(\\sim\\kB T\\) em volta de \\(\\mu\\), e \\(\\mu\\) mal se move enquanto '
          + '\\(T\\ll T_F\\): a correção é \\(\\mu\\approx\\epsilon_F[1-\\frac{\\pi^2}{12}(T/T_F)^2]\\). '
          + 'Para o ' + M.rot + ', \\(T_F=' + F.fmt(TF, 0).replace(/\u00a0/g, '')
          + '\\,\\)K, de modo que à temperatura ambiente \\(T/T_F\\approx'
          + F.fmt(300 / TF, 4) + '\\): o mar de Fermi está, para todos os efeitos, no zero '
          + 'absoluto. Um metal a 300 K é um sistema <em>frio</em>.</p>'
          + '<p>Repare também que a área não encosta no eixo na origem. Mesmo a \\(T=0\\) os '
          + 'elétrons têm energia \\(\\frac35\\epsilon_F\\) por partícula e exercem pressão '
          + '\\(P=\\frac25 n\\epsilon_F\\), aqui ' + F.fmt(0.4 * M.n * eF / 1e9, 1)
          + ' GPa. Não é energia térmica: é o princípio de exclusão cobrando aluguel pelo '
          + 'espaço de fase.</p>'
        : '<p>A energia de Fermi depende só da densidade, como \\(n^{2/3}\\), e a curva é a '
          + 'mesma para todos: os metais apenas ocupam pontos diferentes dela. Todos caem entre '
          + '3 e 12 eV, isto é, entre 37 mil e 135 mil kelvin.</p>'
          + '<p>As duas últimas colunas são o teste da teoria. O coeficiente '
          + '\\(\\gamma=\\pi^2 R/2T_F\\) é previsto sem nenhum parâmetro ajustável, e para '
          + 'prata e ouro acerta em poucos por cento. Onde erra, erra de forma informativa: a '
          + 'razão \\(m^*/m\\) entre o medido e o previsto é a <b>massa efetiva</b>, e ela '
          + 'mede o quanto a rede cristalina altera a inércia do elétron. No alumínio o fator '
          + '4,5 avisa que tratá-lo como três elétrons livres por átomo é generoso demais.</p>';
      tipografar(nota);
    }

    registrarRedesenho(desenhar);
    tipografar(corpo);
  };

  /* =================================================================
     25. Calor específico dos metais
     A figura canônica do laboratório: c/T contra T². O intercepto é o
     termo eletrônico, a inclinação é o de Debye.
     ================================================================= */
  REGISTRO.calormetal = function (raiz) {
    var corpo = moldura(raiz, 'Calor específico: elétrons contra fônons');

    var METAIS = [
      { nome: 'Cu', rot: 'cobre', n: 8.47e28, gama: 0.695, thetaD: 343 },
      { nome: 'Ag', rot: 'prata', n: 5.86e28, gama: 0.646, thetaD: 225 },
      { nome: 'Au', rot: 'ouro', n: 5.90e28, gama: 0.729, thetaD: 165 },
      { nome: 'Al', rot: 'alumínio', n: 18.1e28, gama: 1.35, thetaD: 428 }
    ];

    var est = { i: 0, vista: 'baixa' };

    var ctr0 = el('div', { class: 'controles' });
    corpo.appendChild(ctr0);
    opcoes(ctr0, [
      { rot: 'Baixas temperaturas: c/T contra T²', v: 'baixa' },
      { rot: 'Escala completa até 400 K', v: 'cheia' }
    ], 0, function (v) { est.vista = v; desenhar(); });

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    opcoes(ctr, METAIS.map(function (m) { return { rot: m.rot, v: m.nome }; }), 0,
      function (v) {
        METAIS.forEach(function (m, k) { if (m.nome === v) est.i = k; });
        desenhar();
      });

    var mostrar = cartoes(corpo, [
      { rot: 'γ medido', k: 'g' }, { rot: 'γ de elétrons livres', k: 'gt' },
      { rot: 'm*/m', k: 'me' }, { rot: 'θ<sub>D</sub>', k: 'td' },
      { rot: 'onde os dois se igualam', k: 'tc' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    function desenhar() {
      var M = METAIS[est.i];
      /* A em J/(mol·K⁴), do limite de Debye c = (12π⁴/5)R(T/θ)³ */
      var A = 12 * Math.pow(Math.PI, 4) * F.C.R / (5 * Math.pow(M.thetaD, 3));
      var Amj = A * 1000;
      var g = M.gama;                                  // mJ/(mol·K²)
      var eF = F.C.hbar * F.C.hbar / (2 * F.C.me)
               * Math.pow(3 * Math.PI * Math.PI * M.n, 2 / 3);
      var gt = Math.PI * Math.PI * F.C.R / (2 * eF / F.C.kB) * 1000;
      var Tcruz = Math.sqrt(g / Amj);

      if (est.vista === 'baixa') {
        var x2 = 36;                                   // até T = 6 K
        var ymax = (g + Amj * x2) * 1.1;
        var ax = G.eixos(cv, {
          xmin: 0, xmax: x2, ymin: 0, ymax: ymax, altura: 300,
          rotX: 'T² (K²)', rotY: 'c/T  (mJ mol⁻¹ K⁻²)',
          marcasX: G.marcasLineares(0, x2, 6, 0),
          formataY: function (v) { return F.fmt(v, 1); }
        });
        G.curva(ax, function () { return g; }, G.COR.azul, 1.8, [6, 4]);
        G.curva(ax, function (x) { return Amj * x; }, G.COR.ambar, 1.8, [6, 4]);
        G.curva(ax, function (x) { return g + Amj * x; }, G.COR.vinho, 2.8);
        G.vertical(ax, Tcruz * Tcruz, G.COR.verde,
                   'T = ' + F.fmt(Tcruz, 2) + ' K', true);
        G.legenda(ax, [
          { cor: G.COR.vinho, texto: 'c/T = γ + A T²' },
          { cor: G.COR.azul, texto: 'elétrons: γ' },
          { cor: G.COR.ambar, texto: 'fônons: A T²' }
        ]);
      } else {
        var ax2 = G.eixos(cv, {
          xmin: 0, xmax: 400, ymin: 0, ymax: 28, altura: 300,
          rotX: 'temperatura (K)', rotY: 'c (J mol⁻¹ K⁻¹)',
          marcasX: G.marcasLineares(0, 400, 8, 0),
          formataY: function (v) { return F.fmt(v, 0); }
        });
        G.curva(ax2, function () { return 3 * F.C.R; }, G.COR.suave, 1.4, [4, 4]);
        G.curva(ax2, function (T) { return g * 1e-3 * T; }, G.COR.azul, 2);
        G.curva(ax2, function (T) { return 3 * F.C.R * F.cDebye(T, M.thetaD); },
                G.COR.ambar, 2, [6, 4]);
        G.curva(ax2, function (T) {
          return g * 1e-3 * T + 3 * F.C.R * F.cDebye(T, M.thetaD);
        }, G.COR.vinho, 2.8);
        G.legenda(ax2, [
          { cor: G.COR.vinho, texto: 'total' },
          { cor: G.COR.ambar, texto: 'fônons (Debye)' },
          { cor: G.COR.azul, texto: 'elétrons' },
          { cor: G.COR.suave, texto: '3R (Dulong-Petit)' }
        ]);
      }

      mostrar({
        g: F.fmt(g, 3), gt: F.fmt(gt, 3), me: F.fmt(g / gt, 2),
        td: M.thetaD + ' K', tc: F.fmt(Tcruz, 2) + ' K'
      });

      nota.innerHTML = est.vista === 'baixa'
        ? '<p>Esta é a figura que todo laboratório de baixas temperaturas desenha. Dividindo o '
          + 'calor específico por \\(T\\) e traçando contra \\(T^2\\), as duas contribuições se '
          + 'separam: o <b>intercepto</b> é o termo eletrônico \\(\\gamma\\), linear em '
          + '\\(T\\), e a <b>inclinação</b> é o termo de Debye, cúbico. Medir γ é medir '
          + '\\(g(\\epsilon_F)\\), a densidade de estados no nível de Fermi.</p>'
          + '<p>No ' + M.rot + ' os dois termos se igualam a ' + F.fmt(Tcruz, 2)
          + ' K. Acima disso os fônons dominam de longe, e é por isso que o calor específico '
          + 'eletrônico ficou invisível por meio século: a 300 K ele responde por menos de 1% '
          + 'do total. A teoria clássica, que daria \\(\\frac32\\kB\\) por elétron, erraria o '
          + 'calor específico de um metal por quase duas ordens de grandeza.</p>'
        : '<p>Na escala completa o termo eletrônico (azul) é uma reta tão baixa que quase se '
          + 'confunde com o eixo, enquanto a curva de Debye sobe e satura em \\(3R\\), o valor '
          + 'de Dulong-Petit. O que se mede num calorímetro comum é essencialmente a rede.</p>'
          + '<p>É uma lição sobre como a física estatística funciona. Dois subsistemas no mesmo '
          + 'pedaço de cobre obedecem a estatísticas diferentes: os íons da rede são osciladores '
          + 'tratados como bósons, e seu calor específico cai como \\(T^3\\); os elétrons são '
          + 'férmions degenerados, e o deles cai como \\(T\\). Perto do zero absoluto a '
          + 'potência mais baixa ganha, e o metal volta a mostrar seus elétrons.</p>';
      tipografar(nota);
    }

    registrarRedesenho(desenhar);
    tipografar(corpo);
  };

  /* =================================================================
     26. Corpo negro
     O espectro de Planck contra as duas aproximações que ele substitui.
     A integral é feita de verdade e confere com σT⁴.
     ================================================================= */
  REGISTRO.corponegro = function (raiz) {
    var corpo = moldura(raiz, 'Radiação de corpo negro: Planck, Wien e a catástrofe');

    var FONTES = [
      { rot: 'Fundo cósmico', T: 2.725 },
      { rot: 'Terra', T: 288 },
      { rot: 'Lâmpada', T: 2800 },
      { rot: 'Sol', T: 5772 },
      { rot: 'Rigel', T: 12100 }
    ];

    var est = { T: 5772, aprox: true };

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    var desT = deslizante(ctr, 'temperatura', 2, 15000, 1, 5772,
      function (v) { est.T = v; desenhar(); },
      function (v) { return F.fmt(v, 0) + ' K'; });
    opcoes(ctr, FONTES.map(function (f) { return { rot: f.rot, v: f.T }; }), 3,
      function (v) { desT.value = v; desT.dispatchEvent(new Event('input')); });
    opcoes(ctr, [
      { rot: 'Mostrar aproximações', v: true },
      { rot: 'Só Planck', v: false }
    ], 0, function (v) { est.aprox = v; desenhar(); });

    var mostrar = cartoes(corpo, [
      { rot: 'λ do máximo', k: 'lm' }, { rot: 'emitância σT⁴', k: 'fl' },
      { rot: 'densidade de energia', k: 'ue' }, { rot: 'fótons por m³', k: 'nf' },
      { rot: 'fração visível', k: 'vis' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    /* Rayleigh-Jeans: a mesma conta com kT por modo em vez de ħω/(e^x−1) */
    function rj(lam, T) {
      return 2 * Math.PI * F.C.c * F.C.kB * T / Math.pow(lam, 4);
    }
    /* Wien: o limite de altas frequências, sem o −1 no denominador */
    function wienAprox(lam, T) {
      var a = 2 * Math.PI * F.C.h * F.C.c * F.C.c / Math.pow(lam, 5);
      var x = F.C.h * F.C.c / (lam * F.C.kB * T);
      return x > 700 ? 0 : a * Math.exp(-x);
    }

    function desenhar() {
      var T = est.T, lmax = F.wien(T);
      var xmax = 4.2 * lmax;
      var pico = F.planck(lmax, T);

      var escala, unid, casas;
      if (lmax > 1e-3) { escala = 1e3; unid = 'mm'; casas = 2; }
      else if (lmax > 1e-6) { escala = 1e6; unid = 'μm'; casas = 1; }
      else { escala = 1e9; unid = 'nm'; casas = 0; }

      var ax = G.eixos(cv, {
        xmin: 0, xmax: xmax * escala, ymin: 0, ymax: pico * 1.18, altura: 320,
        rotX: 'comprimento de onda (' + unid + ')',
        rotY: 'emitância espectral',
        marcasX: G.marcasLineares(0, xmax * escala, 6, casas),
        formataY: function () { return ''; }
      });

      /* faixa visível, quando ela cabe na figura */
      if (400e-9 * escala < xmax * escala) {
        var cores = ['#8b00ff', '#0040ff', '#00c000', '#ffd000', '#ff6000', '#e00000'];
        var xa = ax.X(Math.max(400e-9, 0) * escala);
        var xb = ax.X(Math.min(700e-9, xmax) * escala);
        if (xb > xa) {
          var gr = ax.ct.createLinearGradient(xa, 0, xb, 0);
          cores.forEach(function (c, k) {
            gr.addColorStop(k / (cores.length - 1), c);
          });
          ax.ct.save();
          ax.ct.globalAlpha = 0.14;
          ax.ct.fillStyle = gr;
          ax.ct.fillRect(xa, ax.y0, xb - xa, ax.y1 - ax.y0);
          ax.ct.restore();
        }
      }

      if (est.aprox) {
        G.curva(ax, function (l) { return rj(l / escala, T); }, G.COR.ambar, 2, [7, 4]);
        G.curva(ax, function (l) { return wienAprox(l / escala, T); },
                G.COR.verde, 2, [3, 3]);
      }
      G.area(ax, function (l) { return F.planck(l / escala, T); },
             0, xmax * escala, 'rgba(140,47,57,.18)');
      G.curva(ax, function (l) { return F.planck(l / escala, T); }, G.COR.vinho, 2.8);
      G.vertical(ax, lmax * escala, G.COR.tinta,
                 'λ_máx = ' + F.fmt(lmax * escala, casas + 1) + ' ' + unid, true);
      if (est.aprox) {
        G.legenda(ax, [
          { cor: G.COR.vinho, texto: 'Planck' },
          { cor: G.COR.ambar, texto: 'Rayleigh-Jeans (clássico)' },
          { cor: G.COR.verde, texto: 'Wien (altas frequências)' }
        ]);
      }

      /* fração no visível, integrando a própria lei de Planck */
      var total = F.C.sigmaSB * Math.pow(T, 4);
      var vis = F.simpson(function (l) { return F.planck(l, T); }, 400e-9, 700e-9, 400);
      /* densidade de fótons: 2ζ(3)(kT/ħc)³/π² */
      var nfot = 2 * 1.2020569 * Math.pow(F.C.kB * T / (F.C.hbar * F.C.c), 3)
                 / (Math.PI * Math.PI);

      mostrar({
        lm: F.fmt(lmax * escala, casas + 1) + ' ' + unid,
        fl: F.fmt(total, 3) + ' W/m²',
        ue: F.fmt(4 * total / F.C.c, 3) + ' J/m³',
        nf: F.fmt(nfot, 3),
        vis: F.pct(vis / total, 2)
      });

      nota.innerHTML =
        '<p>As duas curvas tracejadas são as leis que Planck precisou reconciliar. '
        + 'Rayleigh-Jeans sai de dar \\(\\kB T\\) a cada modo, como manda a equipartição, e '
        + 'acerta a cauda longa; mas cresce como \\(\\lambda^{-4}\\) e a energia total '
        + 'diverge: é a <b>catástrofe do ultravioleta</b>. A lei de Wien acerta o lado curto '
        + 'e erra o longo. A fórmula de Planck é a única que vale nos dois extremos, e o '
        + 'preço foi quantizar a energia do oscilador.</p>'
        + '<p>A diferença está num sinal. Planck dá '
        + '\\(\\bar n=1/(e^{\\beta\\hbar\\omega}-1)\\), Wien dá \\(e^{-\\beta\\hbar\\omega}\\), '
        + 'que é o mesmo sem o \\(-1\\), e Rayleigh-Jeans é o limite '
        + '\\(\\beta\\hbar\\omega\\to0\\), onde \\(\\bar n\\hbar\\omega\\to\\kB T\\). Os fótons '
        + 'são bósons com \\(\\mu=0\\), porque a parede da cavidade cria e destrói fótons '
        + 'livremente: nada conserva o número deles.</p>'
        + '<p>A área sob a curva é \\(\\sigma T^4\\), e os números abaixo da figura vêm de '
        + 'integrá-la de fato: \\(\\sigma=2\\pi^5\\kB^4/15h^3c^2\\) não é um parâmetro '
        + 'ajustado, é \\(\\pi^4/15\\) saindo de \\(\\int x^3dx/(e^x-1)\\). O deslocamento do '
        + 'máximo, \\(\\lambda_{\\max}T=2{,}898\\times10^{-3}\\) m·K, é a lei de Wien, e vem de '
        + 'resolver \\(5(1-e^{-x})=x\\), cuja raiz é 4,965.</p>';
      tipografar(nota);
    }

    registrarRedesenho(desenhar);
    tipografar(corpo);
  };

  /* =================================================================
     27. Condensado de Bose-Einstein
     A fração condensada e a distribuição de momento bimodal, que é a
     assinatura experimental do condensado.
     ================================================================= */
  REGISTRO.condensado = function (raiz) {
    var corpo = moldura(raiz, 'Condensação de Bose-Einstein');

    var ZETA32 = 2.612375348685488;
    var u = F.C.u;
    var SISTEMAS = [
      { rot: 'Rubídio 87 (JILA, 1995)', m: 86.909 * u, n: 2.5e19 },
      { rot: 'Sódio 23 (MIT, 1995)', m: 22.990 * u, n: 1.5e20 },
      { rot: 'Hélio 4 líquido', m: 4.0026 * u, n: 2.18e28 },
      { rot: 'Elétrons no cobre', m: F.C.me, n: 8.47e28 }
    ];

    var est = { i: 0, r: 0.6, vista: 'fracao' };

    var ctr0 = el('div', { class: 'controles' });
    corpo.appendChild(ctr0);
    opcoes(ctr0, [
      { rot: 'Fração condensada', v: 'fracao' },
      { rot: 'Distribuição de momento', v: 'momento' },
      { rot: 'O critério nλ³', v: 'criterio' }
    ], 0, function (v) { est.vista = v; desenhar(); });

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    deslizante(ctr, 'temperatura T/T<sub>c</sub>', 0, 1.6, 0.01, 0.6,
      function (v) { est.r = v; desenhar(); },
      function (v) { return F.fmt(v, 2); });
    opcoes(ctr, SISTEMAS.map(function (s) { return { rot: s.rot, v: s.rot }; }), 0,
      function (v) {
        SISTEMAS.forEach(function (s, k) { if (s.rot === v) est.i = k; });
        desenhar();
      });

    var mostrar = cartoes(corpo, [
      { rot: 'T<sub>c</sub>', k: 'tc' }, { rot: 'T', k: 't' },
      { rot: 'λ<sub>T</sub> em T<sub>c</sub>', k: 'lam' },
      { rot: 'separação média', k: 'd' },
      { rot: 'n λ³ em T', k: 'nl' }, { rot: 'n̄₀/N', k: 'f0' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    /* escolhe a potência de dez em que o momento desse sistema é legível */
    function escalaP(p) {
      if (p < 1e-30) return { f: 1e-33, rot: '10⁻³³ kg·m/s' };
      if (p < 1e-27) return { f: 1e-30, rot: '10⁻³⁰ kg·m/s' };
      if (p < 1e-24) return { f: 1e-27, rot: '10⁻²⁷ kg·m/s' };
      return { f: 1e-24, rot: '10⁻²⁴ kg·m/s' };
    }

    function Tc(n, m) {
      return 2 * Math.PI * F.C.hbar * F.C.hbar / (m * F.C.kB)
             * Math.pow(n / ZETA32, 2 / 3);
    }
    function lambdaT(T, m) {
      return F.C.h / Math.sqrt(2 * Math.PI * m * F.C.kB * T);
    }
    function fracao(r) { return r >= 1 ? 0 : 1 - Math.pow(r, 1.5); }
    /* as temperaturas aqui vão de 10⁻⁷ K a 10⁵ K: cada faixa, a sua unidade */
    function cartaoT(x) {
      if (x === 0) return '0';
      if (x < 1e-6) return F.fmt(x * 1e9, 1) + ' nK';
      if (x < 1e-3) return F.fmt(x * 1e6, 2) + ' μK';
      if (x < 1) return F.fmt(x * 1e3, 2) + ' mK';
      return F.fmt(x, 3) + ' K';
    }

    function desenhar() {
      var S = SISTEMAS[est.i];
      var tc = Tc(S.n, S.m), T = est.r * tc, f0 = fracao(est.r);

      if (est.vista === 'fracao') {
        /* Em T/T_c a curva é universal e não distingue os sistemas. Em
           temperatura absoluta, e em escala logarítmica, cada um ocupa a
           sua faixa: o rubídio em centenas de nanokelvin, o hélio em
           kelvin, os elétrons do cobre em dezenas de milhares. */
        var lc = Math.log10(tc);
        var xa = lc - 1.6, xb = lc + 0.5;
        var ax = G.eixos(cv, {
          xmin: xa, xmax: xb, ymin: 0, ymax: 1.08, altura: 300,
          rotX: 'log₁₀ da temperatura (K)', rotY: 'fração de partículas',
          marcasX: G.marcasLineares(xa, xb, 7, 1),
          formataY: function (v) { return F.fmt(v, 1); }
        });
        var fT = function (lg) { return fracao(Math.pow(10, lg) / tc); };
        G.area(ax, fT, xa, lc, 'rgba(44,95,141,.20)');
        G.curva(ax, function (lg) { return 1 - fT(lg); }, G.COR.ambar, 2, [6, 4]);
        G.curva(ax, fT, G.COR.azul, 2.8);
        G.vertical(ax, lc, G.COR.tinta, 'T_c = ' + cartaoT(tc), true);
        if (est.r > 0.02) {
          G.vertical(ax, Math.log10(T), G.COR.vinho,
                     'n̄₀/N = ' + F.fmt(f0, 3), true);
        }
        /* onde ficam os outros sistemas, na mesma escala */
        ax.ct.save();
        ax.ct.font = '600 10px system-ui, sans-serif';
        ax.ct.textAlign = 'center'; ax.ct.textBaseline = 'top';
        SISTEMAS.forEach(function (q, k) {
          if (k === est.i) return;
          var l2 = Math.log10(Tc(q.n, q.m));
          if (l2 < xa || l2 > xb) return;
          ax.ct.fillStyle = 'rgba(120,128,138,.9)';
          ax.ct.fillRect(ax.X(l2) - 0.5, ax.y0, 1, ax.y1 - ax.y0);
          ax.ct.fillText(q.rot.split(' ')[0], ax.X(l2), ax.y0 + 2);
        });
        ax.ct.restore();
        G.legenda(ax, [
          { cor: G.COR.azul, texto: 'no estado p = 0' },
          { cor: G.COR.ambar, texto: 'nos estados p > 0' }
        ]);
      } else if (est.vista === 'criterio') {
        /* nλ_T³ contra T, para os quatro sistemas de uma vez: a condensação
           começa onde a curva cruza ζ(3/2), e é esse cruzamento que separa
           um condensado de rubídio de um gás de elétrons degenerado. */
        var ax6 = G.eixos(cv, {
          xmin: -8, xmax: 6, ymin: -6, ymax: 14, altura: 310,
          rotX: 'log₁₀ da temperatura (K)', rotY: 'log₁₀(n λ_T³)',
          marcasX: G.marcasLineares(-8, 6, 7, 0),
          formataY: function (v) { return F.fmt(v, 0); }
        });
        G.curva(ax6, function () { return Math.log10(ZETA32); },
                G.COR.tinta, 1.8, [6, 4]);
        SISTEMAS.forEach(function (q, k) {
          G.curva(ax6, function (lg) {
            var TT = Math.pow(10, lg);
            var y = Math.log10(q.n * Math.pow(lambdaT(TT, q.m), 3));
            /* abaixo do piso a reta sairia correndo rente ao eixo: corta-se */
            return y < -6 ? NaN : y;
          }, k === est.i ? G.COR.vinho : G.COR.grade, k === est.i ? 3 : 1.4);
        });
        ax6.ct.save();
        ax6.ct.font = '600 10px system-ui, sans-serif';
        ax6.ct.textAlign = 'left'; ax6.ct.textBaseline = 'middle';
        SISTEMAS.forEach(function (q, k) {
          var l2 = Math.log10(Tc(q.n, q.m));
          if (l2 < -8 || l2 > 6) return;
          ax6.ct.fillStyle = k === est.i ? G.COR.vinho : 'rgba(120,128,138,.9)';
          ax6.ct.beginPath();
          ax6.ct.arc(ax6.X(l2), ax6.Y(Math.log10(ZETA32)),
                     k === est.i ? 5 : 3, 0, 2 * Math.PI);
          ax6.ct.fill();
          ax6.ct.fillText(q.rot.split(' ')[0], ax6.X(l2) + 7,
                          ax6.Y(Math.log10(ZETA32)) - 9 - 11 * k);
        });
        ax6.ct.restore();
        G.legenda(ax6, [
          { cor: G.COR.vinho, texto: SISTEMAS[est.i].rot },
          { cor: G.COR.tinta, texto: 'limiar ζ(3/2) = 2,612' }
        ]);
      } else {
        /* A nuvem térmica é uma maxwelliana em p com área 1−f₀; o condensado
           é um pico estreito em p = 0 com área f₀. A largura do pico aqui é
           escolhida para ser visível, não medida: num experimento real ela é
           fixada pelo tamanho da armadilha. */
        /* a largura térmica é √(2 m kT), que difere por mil entre o
           rubídio e o hélio: é o que põe o sistema no eixo */
        var pTc = Math.sqrt(2 * S.m * F.C.kB * tc);
        var s = Math.max(0.08, Math.sqrt(Math.max(est.r, 0.02)));
        var pmax = 3.2;
        var termica = function (p) {
          return (1 - f0) * 4 / Math.sqrt(Math.PI) * p * p
                 * Math.exp(-p * p / (s * s)) / (s * s * s);
        };
        var sp = 0.075;
        var cond = function (p) {
          return f0 * 4 / Math.sqrt(Math.PI) * p * p
                 * Math.exp(-p * p / (sp * sp)) / (sp * sp * sp);
        };
        var ymax = 0;
        for (var k = 0; k <= 400; k++) {
          var p = pmax * k / 400;
          ymax = Math.max(ymax, termica(p) + cond(p));
        }
        var ax2 = G.eixos(cv, {
          xmin: 0, xmax: pmax, ymin: 0, ymax: ymax * 1.1 || 1, altura: 300,
          rotX: 'momento p (' + escalaP(pTc).rot + ')',
          rotY: 'átomos por intervalo de momento',
          marcasX: G.marcasLineares(0, pmax, 8, 1).map(function (mm) {
            return { v: mm.v, r: F.fmt(mm.v * pTc / escalaP(pTc).f, 1) };
          }),
          formataY: function () { return ''; }
        });
        G.area(ax2, function (p) { return termica(p) + cond(p); }, 0, pmax,
               'rgba(44,95,141,.18)');
        G.curva(ax2, termica, G.COR.ambar, 2, [6, 4]);
        G.curva(ax2, function (p) { return termica(p) + cond(p); }, G.COR.azul, 2.8);
        G.legenda(ax2, [
          { cor: G.COR.azul, texto: 'total' },
          { cor: G.COR.ambar, texto: 'nuvem térmica' }
        ]);
      }

      var lam = lambdaT(tc, S.m);
      var lamT = T > 0 ? lambdaT(T, S.m) : Infinity;
      mostrar({
        tc: (tc < 1e-5 ? F.fmt(tc * 1e9, 1) + ' nK'
             : tc < 1 ? F.fmt(tc * 1e3, 2) + ' mK' : F.fmt(tc, 3) + ' K'),
        t: (T === 0 ? '0' : T < 1e-5 ? F.fmt(T * 1e9, 1) + ' nK'
            : T < 1 ? F.fmt(T * 1e3, 2) + ' mK' : F.fmt(T, 3) + ' K'),
        lam: F.fmt(lam * 1e9, 2) + ' nm',
        d: F.fmt(Math.pow(S.n, -1 / 3) * 1e9, 2) + ' nm',
        nl: (T === 0 ? '∞' : F.fmt(S.n * Math.pow(lamT, 3), 3)),
        f0: F.fmt(f0, 3)
      });

      nota.innerHTML = est.vista === 'criterio'
        ? '<p>Esta é a tabela do Módulo 6 transformada em figura. O eixo vertical é '
          + '\\(n\\lambda_T^3\\), a razão entre o volume que uma partícula ocupa '
          + 'quanticamente e o volume que ela tem disponível, e ele cresce como '
          + '\\(T^{-3/2}\\) porque \\(\\lambda_T\\propto T^{-1/2}\\). Cada sistema é '
          + 'uma reta, e a sua posição é fixada só por \\(n\\) e pela massa.</p>'
          + '<p>A condensação começa onde a reta cruza o limiar '
          + '\\(\\zeta(3/2)=2{,}612\\), e é esse cruzamento que define \\(T_c\\). '
          + 'Doze ordens de grandeza em temperatura separam o rubídio do gás de elétrons '
          + 'do cobre, e a razão está nas duas variáveis: o rubídio é cem mil vezes menos '
          + 'denso que o ar e tem um átomo pesado, ao passo que os elétrons são leves e '
          + 'estão a \\(8{,}5\\times10^{28}\\) por metro cúbico.</p>'
          + '<p>O detalhe que importa: <b>os elétrons do cobre cruzam o limiar a dezenas '
          + 'de milhares de kelvin</b>, de modo que à temperatura ambiente eles estão '
          + 'milhares de vezes acima dele. São mais degenerados que qualquer condensado '
          + 'jamais produzido, e ainda assim não condensam, porque são férmions. A reta é '
          + 'a mesma; o que muda é a simetria da função de onda.</p>'
        : est.vista === 'fracao'
        ? '<p>Abaixo de \\(T_c\\) a fração no estado de momento nulo é '
          + '\\(\\bar n_0/N=1-(T/T_c)^{3/2}\\), e ela não vem de nenhuma interação: vem de os '
          + 'estados excitados não conseguirem mais acomodar todas as partículas. A integral '
          + 'sobre \\(p>0\\) satura em \\(\\zeta(3/2)=2{,}612\\) em unidades de '
          + '\\(V/\\lambda_T^3\\), e o que sobra é obrigado a cair no fundo.</p>'
          + '<p>Compare os dois números do meio. A condensação começa exatamente quando o '
          + 'comprimento de onda térmico fica da ordem da separação entre as partículas, '
          + 'critério \\(n\\lambda_T^3\\geq2{,}612\\) que é o mesmo do Módulo 6. Aqui ele '
          + 'aparece com os dois lados medidos em nanômetros.</p>'
          + '<p>A última linha da lista é um lembrete: elétrons no cobre têm '
          + '\\(n\\lambda_T^3\\) enorme à temperatura ambiente, isto é, são tão degenerados '
          + 'quanto qualquer condensado. Mas são férmions, e o princípio de exclusão proíbe o '
          + 'acúmulo no fundo. A mesma degenerescência produz um mar de Fermi num caso e um '
          + 'condensado no outro, e o que decide é só a simetria da função de onda.</p>'
        : '<p>É esta a assinatura experimental, e a figura que correu o mundo em 1995: a '
          + 'distribuição de momento deixa de ser uma única maxwelliana e passa a ter '
          + '<b>duas componentes</b>, uma nuvem térmica larga e um pico estreito no centro. '
          + 'Abaixe a temperatura e veja o pico crescer às custas da nuvem.</p>'
          + '<p>Na região de coexistência o gás é literalmente uma mistura de duas fases, uma '
          + 'com \\(p=0\\) e outra com \\(p>0\\), e a fração de cada uma segue a curva da '
          + 'primeira vista. A transição é de primeira ordem, mas a separação de fases não '
          + 'acontece no espaço: acontece no espaço dos momentos.</p>'
          + '<p>A largura do pico aqui foi escolhida para ser visível. Num experimento real ela '
          + 'é fixada pela armadilha, pelo princípio de incerteza: um condensado confinado em '
          + 'alguns micrômetros tem a menor dispersão de momento que a mecânica quântica '
          + 'permite.</p>';
      tipografar(nota);
    }

    registrarRedesenho(desenhar);
    tipografar(corpo);
  };

  /* =================================================================
     28. Bandas: metal, semicondutor e isolante
     A mesma função de Fermi em três situações. O que muda é apenas
     onde está o nível de Fermi em relação às bandas.
     ================================================================= */
  REGISTRO.bandas = function (raiz) {
    var corpo = moldura(raiz, 'Bandas de energia: por que uns conduzem e outros não');

    /* Eg em eV; ni é a densidade intrínseca de portadores a 300 K, em cm⁻³ */
    var MAT = [
      { nome: 'metal', rot: 'Metal (cobre)', Eg: 0, ni: null },
      { nome: 'ge', rot: 'Germânio', Eg: 0.66, ni: 2.4e13 },
      { nome: 'si', rot: 'Silício', Eg: 1.12, ni: 1.0e10 },
      { nome: 'gaas', rot: 'Arseneto de gálio', Eg: 1.42, ni: 2.1e6 },
      { nome: 'c', rot: 'Diamante', Eg: 5.47, ni: 1e-27 }
    ];

    var est = { i: 2, T: 300 };

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    deslizante(ctr, 'temperatura', 100, 1200, 5, 300,
      function (v) { est.T = v; desenhar(); },
      function (v) { return v + ' K'; });
    opcoes(ctr, MAT.map(function (m) { return { rot: m.rot, v: m.nome }; }), 2,
      function (v) {
        MAT.forEach(function (m, k) { if (m.nome === v) est.i = k; });
        desenhar();
      });

    var mostrar = cartoes(corpo, [
      { rot: 'separação E<sub>g</sub>', k: 'eg' },
      { rot: 'k<sub>B</sub>T', k: 'kt' },
      { rot: 'E<sub>g</sub>/k<sub>B</sub>T', k: 'raz' },
      { rot: 'portadores (cm⁻³)', k: 'ni' },
      { rot: 'contra 300 K', k: 'rel' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    /* n_i(T) ancorado no valor medido a 300 K:
       n_i ∝ T^{3/2} e^{−Eg/2kT}, com Eg tratado como constante. */
    function portadores(M, T) {
      if (M.ni === null) return null;
      var kv = 8.617333262e-5;
      return M.ni * Math.pow(T / 300, 1.5)
             * Math.exp(-M.Eg / (2 * kv) * (1 / T - 1 / 300));
    }

    function desenhar() {
      var M = MAT[est.i], T = est.T;
      var kt = 8.617333262e-5 * T;
      var p = G.preparar(cv, 320);
      var ct = p.ct, L = p.L, A = p.A;

      /* eixo de energia: 0 no topo da banda de valência */
      var emin = -2.2, emax = Math.max(2.2, M.Eg + 1.8);
      var y0 = 20, y1 = A - 34;
      var Y = function (e) { return y1 - (e - emin) / (emax - emin) * (y1 - y0); };
      var xb0 = 56, xb1 = Math.min(L * 0.52, 300);
      var xf0 = xb1 + 46, xf1 = L - 20;

      var mu = M.Eg === 0 ? 0 : M.Eg / 2;      // no metal, meio da banda
      var n = function (e) {
        var x = (e - mu) / kt;
        return x > 700 ? 0 : x < -700 ? 1 : 1 / (Math.exp(x) + 1);
      };

      ct.font = '11px system-ui, sans-serif';

      /* bandas: valência de emin a 0, condução de Eg a emax.
         No metal a banda é uma só, de emin a emax, com μ no meio. */
      function pintarBanda(ea, eb) {
        var ya = Y(eb), yb = Y(ea), passos = 90;
        for (var k = 0; k < passos; k++) {
          var yy = ya + (yb - ya) * k / passos;
          var ee = emin + (y1 - yy) / (y1 - y0) * (emax - emin);
          var oc = n(ee);
          ct.fillStyle = 'rgba(44,95,141,' + (0.08 + 0.78 * oc).toFixed(3) + ')';
          ct.fillRect(xb0, yy, xb1 - xb0, (yb - ya) / passos + 0.8);
        }
        ct.strokeStyle = G.COR.suave;
        ct.lineWidth = 1.2;
        ct.strokeRect(xb0 + 0.5, ya + 0.5, xb1 - xb0 - 1, yb - ya - 1);
      }

      if (M.Eg === 0) {
        pintarBanda(emin, emax);
      } else {
        pintarBanda(emin, 0);
        pintarBanda(M.Eg, emax);
        /* a separação, hachurada */
        ct.save();
        ct.fillStyle = 'rgba(180,186,195,.16)';
        ct.fillRect(xb0, Y(M.Eg), xb1 - xb0, Y(0) - Y(M.Eg));
        ct.restore();
      }

      /* nível de Fermi */
      ct.save();
      ct.strokeStyle = G.COR.vinho;
      ct.lineWidth = 1.6;
      ct.setLineDash([6, 4]);
      ct.beginPath();
      ct.moveTo(xb0 - 10, Y(mu)); ct.lineTo(xf1, Y(mu)); ct.stroke();
      ct.restore();
      ct.fillStyle = G.COR.vinho;
      ct.font = '600 11px system-ui, sans-serif';
      ct.textAlign = 'left'; ct.textBaseline = 'bottom';
      ct.fillText('nível de Fermi', xb1 + 6, Y(mu) - 3);

      /* rótulos das bandas */
      ct.fillStyle = G.COR.tinta;
      ct.font = '600 11px system-ui, sans-serif';
      ct.textAlign = 'center'; ct.textBaseline = 'middle';
      if (M.Eg === 0) {
        ct.fillText('banda semipreenchida', (xb0 + xb1) / 2, Y(emax) + 16);
      } else {
        ct.fillText('banda de condução', (xb0 + xb1) / 2, Y((M.Eg + emax) / 2));
        ct.fillStyle = '#ffffff';
        ct.fillText('banda de valência', (xb0 + xb1) / 2, Y(emin / 2));
        ct.fillStyle = G.COR.suave;
        ct.fillText('separação: ' + F.fmt(M.Eg, 2) + ' eV',
                    (xb0 + xb1) / 2, Y(M.Eg * 0.22));
      }

      /* eixo de energia à esquerda */
      ct.strokeStyle = G.COR.suave; ct.lineWidth = 1.2;
      ct.beginPath(); ct.moveTo(xb0 - 14, y0); ct.lineTo(xb0 - 14, y1); ct.stroke();
      ct.save();
      ct.translate(16, (y0 + y1) / 2); ct.rotate(-Math.PI / 2);
      ct.fillStyle = G.COR.suave;
      ct.font = '600 11px system-ui, sans-serif';
      ct.textAlign = 'center'; ct.textBaseline = 'top';
      ct.fillText('energia do elétron', 0, 0);
      ct.restore();

      /* função de Fermi ao lado, com a energia no eixo vertical */
      ct.strokeStyle = G.COR.grade; ct.lineWidth = 1;
      [0, 0.5, 1].forEach(function (v) {
        var x = xf0 + v * (xf1 - xf0);
        ct.beginPath(); ct.moveTo(x, y0); ct.lineTo(x, y1); ct.stroke();
      });
      ct.strokeStyle = G.COR.azul; ct.lineWidth = 2.4;
      ct.beginPath();
      for (var k = 0; k <= 300; k++) {
        var ee = emin + (emax - emin) * k / 300;
        var xx = xf0 + n(ee) * (xf1 - xf0), yy = Y(ee);
        if (k === 0) ct.moveTo(xx, yy); else ct.lineTo(xx, yy);
      }
      ct.stroke();
      ct.fillStyle = G.COR.suave;
      ct.font = '11px system-ui, sans-serif';
      ct.textAlign = 'center'; ct.textBaseline = 'top';
      ct.fillText('n̄(ε) a ' + T + ' K', (xf0 + xf1) / 2, y1 + 6);
      ct.fillText('0', xf0, y1 + 6);
      ct.fillText('1', xf1, y1 + 6);

      var ni = portadores(M, T), ni300 = portadores(M, 300);
      mostrar({
        eg: M.Eg === 0 ? 'sem separação' : F.fmt(M.Eg, 2) + ' eV',
        kt: F.fmt(kt, 4) + ' eV',
        raz: M.Eg === 0 ? '—' : F.fmt(M.Eg / kt, 1),
        ni: ni === null ? '~10²²' : F.fmt(ni, 2),
        rel: ni === null ? 'não muda' : '×' + F.fmt(ni / ni300, 3)
      });

      nota.innerHTML =
        '<p>A mesma função de Fermi, três destinos. O que muda não é a estatística: é '
        + '<b>onde o nível de Fermi cai</b>. No metal ele fica no meio de uma banda, e há '
        + 'estados vazios a uma distância infinitesimal dos ocupados: basta um campo elétrico '
        + 'ínfimo para redistribuir elétrons e aparecer corrente. Num semicondutor ou isolante '
        + 'ele cai dentro de uma <b>separação</b> onde não existe nenhum estado, e conduzir '
        + 'exige promover um elétron por cima de \\(E_g\\).</p>'
        + '<p>Esse custo entra exponencialmente. A probabilidade de ocupação no fundo da banda '
        + 'de condução é da ordem de \\(e^{-E_g/2\\kB T}\\), e a razão \\(E_g/\\kB T\\) é o '
        + 'número que decide tudo. '
        + (M.Eg === 0
            ? 'No cobre não há separação alguma, e é por isso que a condutividade de um metal '
              + '<em>cai</em> com a temperatura em vez de subir: o número de portadores não '
              + 'muda, só o espalhamento pelos fônons aumenta.'
            : 'Para o ' + M.rot.toLowerCase() + ' a ' + T + ' K temos \\(E_g/\\kB T='
              + F.fmt(M.Eg / kt, 1) + '\\).')
        + '</p>'
        + '<p>Nada separa qualitativamente um semicondutor de um isolante: é a mesma física com '
        + 'um número diferente. Entre o germânio e o diamante o \\(E_g\\) cresce por um fator '
        + 'oito, e os portadores a 300 K caem por quarenta ordens de grandeza. Aqueça o '
        + 'silício de 300 para 400 K e os portadores aumentam umas trezentas vezes: é por isso '
        + 'que um transistor esquenta e muda de comportamento, e é também por isso que o '
        + 'diamante, que tem a mesma estrutura cristalina do silício, é um isolante '
        + 'excelente.</p>';
      tipografar(nota);
    }

    registrarRedesenho(desenhar);
    tipografar(corpo);
  };

  /* =================================================================
     22c. A superfície de energia constante: esfera contra octaedro
     No gás não relativístico, E = Σp²/2m é uma hiperesfera. No
     ultrarrelativístico, E = cΣ|p| é um hiper-octaedro. É essa troca de
     forma que muda o expoente de E em Ω, e daí sai tudo.
     ================================================================= */
  REGISTRO.politopo = function (raiz) {
    var corpo = moldura(raiz, 'A superfície de energia constante: esfera ou octaedro');

    var est = { vista: 'duas' };

    var ctr0 = el('div', { class: 'controles' });
    corpo.appendChild(ctr0);
    opcoes(ctr0, [
      { rot: 'Duas partículas', v: 'duas' },
      { rot: 'Três partículas', v: 'tres' },
      { rot: 'O expoente de E', v: 'escala' }
    ], 0, function (v) { est.vista = v; desenhar(); });

    var cv = el('canvas');
    corpo.appendChild(cv);

    var mostrar = cartoes(corpo, [
      { rot: 'não relativístico', k: 'nr' },
      { rot: 'ultrarrelativístico', k: 'ur' },
      { rot: 'Ω ∝', k: 'om' },
      { rot: 'energia', k: 'en' },
      { rot: 'calor específico', k: 'cc' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    /* ---- N = 2: círculo contra losango ---- */
    function duas(p) {
      var ct = p.ct, L = p.L, A = p.A;
      var R = Math.min(L * 0.46, A * 0.29);
      var cx = L / 2, cy = A / 2 + 6;

      /* eixos p1 e p2 */
      ct.strokeStyle = G.COR.grade; ct.lineWidth = 1;
      ct.beginPath();
      ct.moveTo(cx - R * 1.45, cy); ct.lineTo(cx + R * 1.45, cy);
      ct.moveTo(cx, cy - R * 1.45); ct.lineTo(cx, cy + R * 1.45);
      ct.stroke();

      /* o disco: todos os estados com energia até E */
      ct.fillStyle = 'rgba(44,95,141,.16)';
      ct.beginPath(); ct.arc(cx, cy, R, 0, 2 * Math.PI); ct.fill();
      ct.strokeStyle = G.COR.azul; ct.lineWidth = 2.6;
      ct.beginPath(); ct.arc(cx, cy, R, 0, 2 * Math.PI); ct.stroke();

      /* o losango */
      ct.fillStyle = 'rgba(181,131,31,.20)';
      ct.beginPath();
      ct.moveTo(cx + R, cy); ct.lineTo(cx, cy - R);
      ct.lineTo(cx - R, cy); ct.lineTo(cx, cy + R); ct.closePath();
      ct.fill();
      ct.strokeStyle = G.COR.ambar; ct.lineWidth = 2.6; ct.stroke();

      ct.font = '600 12px system-ui, sans-serif';
      ct.fillStyle = G.COR.suave;
      ct.textAlign = 'left'; ct.textBaseline = 'middle';
      ct.fillText('p₁', cx + R * 1.5, cy);
      ct.textAlign = 'center'; ct.textBaseline = 'bottom';
      ct.fillText('p₂', cx, cy - R * 1.5);

      ct.font = '600 12px system-ui, sans-serif';
      ct.textAlign = 'right';
      ct.fillStyle = G.COR.azul;
      ct.fillText('p₁² + p₂² = 2mE', cx - R * 0.82, cy - R * 0.82);
      ct.fillStyle = G.COR.ambar;
      ct.textAlign = 'left'; ct.textBaseline = 'top';
      ct.fillText('|p₁| + |p₂| = E/c', cx + R * 0.52, cy + R * 0.52);

      ct.fillStyle = G.COR.tinta;
      ct.font = '12px system-ui, sans-serif';
      ct.textAlign = 'center'; ct.textBaseline = 'top';
      ct.fillText('área do disco: πp²   ·   área do losango: 2p²', cx, A - 22);
    }

    /* ---- N = 3: esfera contra octaedro, em projeção isométrica ---- */
    function tres(p) {
      var ct = p.ct, L = p.L, A = p.A;
      /* Lado a lado só cabe em tela larga; numa estreita os dois sólidos
         se sobrepõem, e então vão um sobre o outro. */
      var estreito = L < 620;
      var R = estreito ? Math.min(L * 0.26, A * 0.20) : Math.min(L, A) * 0.30;
      var cxa = estreito ? L / 2 : L * 0.29;
      var cxb = estreito ? L / 2 : L * 0.71;
      var cya = estreito ? A * 0.26 : A / 2 - 6;
      var cyb = estreito ? A * 0.70 : A / 2 - 6;
      var co = Math.cos(Math.PI / 6), si = Math.sin(Math.PI / 6);

      function proj(cx, cy, v) {
        return { x: cx + R * (v[0] - v[1]) * co,
                 y: cy + R * ((v[0] + v[1]) * si - v[2]) * 0.86 };
      }
      function eixos3(cx, cy) {
        ct.strokeStyle = G.COR.grade; ct.lineWidth = 1;
        [[1.5, 0, 0], [0, 1.5, 0], [0, 0, 1.5]].forEach(function (v, k) {
          var a = proj(cx, cy, [0, 0, 0]), b = proj(cx, cy, v);
          ct.beginPath(); ct.moveTo(a.x, a.y); ct.lineTo(b.x, b.y); ct.stroke();
          ct.fillStyle = G.COR.suave;
          ct.font = '600 11px system-ui, sans-serif';
          ct.textAlign = 'center'; ct.textBaseline = 'middle';
          ct.fillText('p' + '₁₂₃'[k], b.x + (k === 2 ? 0 : k ? -9 : 9), b.y + (k === 2 ? -8 : 4));
        });
      }

      /* esfera */
      eixos3(cxa, cya);
      ct.fillStyle = 'rgba(44,95,141,.16)';
      ct.beginPath(); ct.arc(cxa, cya, R, 0, 2 * Math.PI); ct.fill();
      ct.strokeStyle = G.COR.azul; ct.lineWidth = 2.4;
      ct.beginPath(); ct.arc(cxa, cya, R, 0, 2 * Math.PI); ct.stroke();
      ct.lineWidth = 1.1;
      ct.strokeStyle = 'rgba(44,95,141,.5)';
      ct.beginPath(); ct.ellipse(cxa, cya, R, R * 0.36, 0, 0, 2 * Math.PI); ct.stroke();
      ct.beginPath(); ct.ellipse(cxa, cya, R * 0.36, R, 0, 0, 2 * Math.PI); ct.stroke();

      /* octaedro: as faces com soma de sinais positiva estão de frente */
      eixos3(cxb, cyb);
      var V = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
      var faces = [];
      [1, -1].forEach(function (a) {
        [1, -1].forEach(function (b) {
          [1, -1].forEach(function (c) {
            faces.push({ s: [a, b, c], frente: a + b + c > 0 });
          });
        });
      });
      /* primeiro as de trás, tracejadas */
      faces.forEach(function (f) {
        if (f.frente) return;
        var pts = [proj(cxb, cyb, [f.s[0], 0, 0]), proj(cxb, cyb, [0, f.s[1], 0]),
                   proj(cxb, cyb, [0, 0, f.s[2]])];
        ct.save();
        ct.setLineDash([4, 4]);
        ct.strokeStyle = 'rgba(181,131,31,.55)'; ct.lineWidth = 1.2;
        ct.beginPath();
        ct.moveTo(pts[0].x, pts[0].y);
        ct.lineTo(pts[1].x, pts[1].y); ct.lineTo(pts[2].x, pts[2].y);
        ct.closePath(); ct.stroke();
        ct.restore();
      });
      faces.forEach(function (f) {
        if (!f.frente) return;
        var pts = [proj(cxb, cyb, [f.s[0], 0, 0]), proj(cxb, cyb, [0, f.s[1], 0]),
                   proj(cxb, cyb, [0, 0, f.s[2]])];
        ct.fillStyle = 'rgba(181,131,31,' + (f.s[0] + f.s[1] + f.s[2] === 3 ? '.30' : '.17') + ')';
        ct.strokeStyle = G.COR.ambar; ct.lineWidth = 2;
        ct.beginPath();
        ct.moveTo(pts[0].x, pts[0].y);
        ct.lineTo(pts[1].x, pts[1].y); ct.lineTo(pts[2].x, pts[2].y);
        ct.closePath(); ct.fill(); ct.stroke();
      });

      ct.font = '600 12px system-ui, sans-serif';
      ct.textAlign = 'center'; ct.textBaseline = 'top';
      ct.fillStyle = G.COR.azul;
      ct.fillText('esfera: Σp² = 2mE  ·  volume 4πp³/3',
                  cxa, estreito ? cya + R * 0.98 : A - 40);
      ct.fillStyle = G.COR.ambar;
      ct.fillText('octaedro: Σ|p| = E/c  ·  volume 4p³/3',
                  cxb, estreito ? cyb + R * 1.15 : A - 40);
    }

    function desenhar() {
      if (est.vista === 'escala') {
        var ax = G.eixos(cv, {
          xmin: 0, xmax: 3, ymin: 0, ymax: 3.2, altura: 300,
          rotX: 'ln(E/E\u2080)', rotY: '[ln Ω(E) − ln Ω(E\u2080)] / N',
          marcasX: G.marcasLineares(0, 3, 6, 1),
          formataY: function (v) { return F.fmt(v, 1); }
        });
        G.curva(ax, function (x) { return 0.5 * x; }, G.COR.azul, 2.8);
        G.curva(ax, function (x) { return x; }, G.COR.ambar, 2.8);
        G.legenda(ax, [
          { cor: G.COR.ambar, texto: 'ultrarrelativístico: inclinação 1' },
          { cor: G.COR.azul, texto: 'não relativístico: inclinação 1/2' }
        ]);
      } else {
        var p = G.preparar(cv, 320);
        /* empilhado precisa de mais altura */
        if (est.vista === 'tres' && p.L < 620) p = G.preparar(cv, 500);
        if (est.vista === 'duas') duas(p); else tres(p);
      }

      mostrar({
        nr: 'hiperesfera',
        ur: 'hiper-octaedro',
        om: 'E^{N/2} ou E^{N}',
        en: '½NkT ou NkT',
        cc: '½k ou k'
      });

      nota.innerHTML = est.vista === 'duas'
        ? '<p>Duas partículas, um momento cada. Todos os estados com energia até \\(E\\) '
          + 'ficam <em>dentro</em> da curva, e contá-los é medir a área.</p>'
          + '<p>No caso de sempre, \\(E=(p_1^2+p_2^2)/2m\\) é a equação de um '
          + '<b>círculo</b> de raio \\(\\sqrt{2mE}\\), e a área é \\(\\pi\\cdot 2mE\\), '
          + 'proporcional a \\(E\\). No caso ultrarrelativístico, \\(E=c(|p_1|+|p_2|)\\) é a '
          + 'equação de um <b>losango</b> de semidiagonal \\(E/c\\), e a área é '
          + '\\(2(E/c)^2\\), proporcional a \\(E^2\\).</p>'
          + '<p>Já aqui está tudo. A potência de \\(E\\) dobrou, e é só isso que a '
          + 'termodinâmica vai enxergar.</p>'
        : est.vista === 'tres'
        ? '<p>Com três partículas a esfera continua esfera e o losango vira <b>octaedro</b>: '
          + 'o mesmo corpo com os vértices sobre os eixos e as faces planas cortando o '
          + 'caminho entre eles. O volume da esfera vale \\(\\frac43\\pi p^3\\) e o do '
          + 'octaedro \\(\\frac43 p^3\\), com \\(p\\) sendo o valor máximo de um momento '
          + 'isolado.</p>'
          + '<p>Em \\(N\\) dimensões o octaedro vira o <b>hiper-octaedro</b>, de volume '
          + '\\(2^N(E/c)^N/N!\\): são \\(2^N\\) ortantes, um para cada escolha de sinais, '
          + 'e em cada um deles o corpo é o simplex \\(\\sum p_i\\le E/c\\), de volume '
          + '\\((E/c)^N/N!\\). A hiperesfera, por sua vez, tem volume '
          + '\\(\\pi^{N/2}(2mE)^{N/2}/\\Gamma(\\frac N2+1)\\).</p>'
          + '<p>Os prefatores são feios e não importam: eles não dependem de \\(E\\). O que '
          + 'importa é o expoente, \\(E^{N/2}\\) contra \\(E^{N}\\).</p>'
        : '<p>Aqui está por que o expoente é tudo. A entropia é \\(S=\\kB\\ln\\Omega\\), e '
          + 'com \\(\\Omega\\propto E^{\\alpha N}\\) ela é \\(S=\\alpha N\\kB\\ln E + '
          + '\\text{const}\\): uma reta neste gráfico, de inclinação \\(\\alpha\\).</p>'
          + '<p>Mas \\(1/T=\\partial S/\\partial E=\\alpha N\\kB/E\\), de modo que '
          + '\\(E=\\alpha N\\kB T\\) e \\(c=\\alpha\\kB\\) por partícula. A inclinação da '
          + 'reta <em>é</em> o calor específico. Com \\(\\alpha=1/2\\) temos a equipartição '
          + 'de sempre; com \\(\\alpha=1\\), o dobro.</p>'
          + '<p>Nada disso usou a função de partição, o ensemble canônico ou a distribuição '
          + 'de Boltzmann. Saiu de contar pontos dentro de um sólido geométrico, que é o que '
          + 'o ensemble microcanônico sempre foi.</p>';
      tipografar(nota);
    }

    registrarRedesenho(desenhar);
    tipografar(corpo);
  };

  /* =================================================================
     29. A esfera de Fermi deslocada
     Sob campo, toda a esfera escorrega de δk = eEτ/ħ. Só a casquinha
     em forma de lua muda de ocupação, e é dela que vem a corrente.
     O deslocamento real é ridículo: no cobre a 1 V/m vale 3×10⁻⁹ do
     raio, e o widget precisa exagerá-lo para que apareça.
     ================================================================= */
  REGISTRO.deriva = function (raiz) {
    var corpo = moldura(raiz, 'A esfera de Fermi deslocada: de onde vem a corrente');

    var n = 8.47e28;               // elétrons de condução no cobre, m⁻³
    var sigma = 5.96e7;            // condutividade medida, S/m
    var est = { logE: 4, logAmp: 4 };

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    deslizante(ctr, 'campo elétrico', 0, 8, 0.1, 4,
      function (v) { est.logE = v; desenhar(); },
      function (v) { return F.fmt(Math.pow(10, v), 0) + ' V/m'; });
    deslizante(ctr, 'ampliação do deslocamento na figura', 0, 9, 0.1, 4,
      function (v) { est.logAmp = v; desenhar(); },
      function (v) { return '×' + F.fmt(Math.pow(10, v), 0); });

    var mostrar = cartoes(corpo, [
      { rot: 'k<sub>F</sub>', k: 'kf' }, { rot: 'v<sub>F</sub>', k: 'vf' },
      { rot: 'τ', k: 'tau' }, { rot: 'livre caminho médio', k: 'lc' },
      { rot: 'velocidade de deriva', k: 'vd' },
      { rot: 'δk/k<sub>F</sub> de verdade', k: 'dk' },
      { rot: 'δk/k<sub>F</sub> na figura', k: 'dkfig' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    var kF = Math.pow(3 * Math.PI * Math.PI * n, 1 / 3);
    var vF = F.C.hbar * kF / F.C.me;
    var tau = sigma * F.C.me / (n * F.C.e * F.C.e);

    function desenhar() {
      var campo = Math.pow(10, est.logE);
      var dkReal = F.C.e * campo * tau / F.C.hbar;
      var vd = F.C.e * campo * tau / F.C.me;

      /* Numa tela estreita não cabem a esfera e a legenda lado a lado: a
         legenda desce para baixo da figura e o quadro fica mais alto. */
      var p = G.preparar(cv, 320);
      var estreito = p.L < 560;
      if (estreito) p = G.preparar(cv, 430);
      var ct = p.ct, L = p.L, A = p.A;
      var R = estreito ? Math.min(L * 0.33, 118) : Math.min(L * 0.28, A * 0.34);
      var cx = estreito ? L / 2 : L * 0.42;
      var cy = estreito ? R + 46 : A / 2 - 4;
      /* O deslocamento desenhado é o real multiplicado pela ampliação do
         deslizante, e não um valor inventado: com ampliação 1 e campo de
         10^8 V/m a figura já mostra o deslocamento em escala verdadeira.
         O teto de meio raio é só para a figura não sair do quadro. */
      var fracao = Math.min(0.5, (dkReal / kF) * Math.pow(10, est.logAmp));
      var d = fracao * R;

      /* eixos */
      ct.strokeStyle = G.COR.grade; ct.lineWidth = 1;
      ct.beginPath();
      ct.moveTo(cx - R * 1.7, cy); ct.lineTo(cx + R * 1.7, cy);
      ct.moveTo(cx, cy - R * 1.5); ct.lineTo(cx, cy + R * 1.5);
      ct.stroke();

      /* a esfera deslocada, preenchida */
      ct.fillStyle = 'rgba(44,95,141,.20)';
      ct.beginPath(); ct.arc(cx + d, cy, R, 0, 2 * Math.PI); ct.fill();

      /* as duas luas: o que ganhou e o que perdeu ocupação */
      if (d > 0.5) {
        ct.save();
        ct.beginPath(); ct.arc(cx + d, cy, R, 0, 2 * Math.PI); ct.clip();
        ct.beginPath(); ct.arc(cx, cy, R, 0, 2 * Math.PI);
        ct.fillStyle = 'rgba(31,111,84,.55)';
        ct.rect(cx - 2 * R, cy - 2 * R, 4 * R, 4 * R);
        ct.fill('evenodd');
        ct.restore();

        ct.save();
        ct.beginPath(); ct.arc(cx, cy, R, 0, 2 * Math.PI); ct.clip();
        ct.beginPath(); ct.arc(cx + d, cy, R, 0, 2 * Math.PI);
        ct.fillStyle = 'rgba(140,47,57,.45)';
        ct.rect(cx - 2 * R, cy - 2 * R, 4 * R, 4 * R);
        ct.fill('evenodd');
        ct.restore();
      }

      /* contornos */
      ct.save();
      ct.setLineDash([5, 4]);
      ct.strokeStyle = G.COR.suave; ct.lineWidth = 1.6;
      ct.beginPath(); ct.arc(cx, cy, R, 0, 2 * Math.PI); ct.stroke();
      ct.restore();
      ct.strokeStyle = G.COR.azul; ct.lineWidth = 2.6;
      ct.beginPath(); ct.arc(cx + d, cy, R, 0, 2 * Math.PI); ct.stroke();

      /* a seta do deslocamento */
      if (d > 2) {
        ct.strokeStyle = G.COR.tinta; ct.lineWidth = 1.6;
        ct.beginPath(); ct.moveTo(cx, cy - R - 16); ct.lineTo(cx + d, cy - R - 16);
        ct.stroke();
        ct.beginPath();
        ct.moveTo(cx + d, cy - R - 16);
        ct.lineTo(cx + d - 6, cy - R - 19); ct.lineTo(cx + d - 6, cy - R - 13);
        ct.closePath(); ct.fillStyle = G.COR.tinta; ct.fill();
        ct.font = '600 11px system-ui, sans-serif';
        ct.textAlign = 'center'; ct.textBaseline = 'bottom';
        ct.fillText('δk = eEτ/ħ', cx + d / 2, cy - R - 20);
      }

      ct.font = '600 11px system-ui, sans-serif';
      ct.fillStyle = G.COR.suave;
      ct.textAlign = estreito ? 'center' : 'left';
      ct.textBaseline = 'top';
      ct.fillText('kₓ, na direção do campo',
                  estreito ? cx : cx - R * 1.6,
                  estreito ? cy + R + 12 : cy + 7);

      /* legenda: à direita quando há espaço, embaixo quando não há */
      var itens = [['rgba(31,111,84,.75)', 'passaram a ser ocupados'],
                   ['rgba(140,47,57,.65)', 'ficaram vazios'],
                   [G.COR.azul, 'esfera sob campo'],
                   [G.COR.suave, 'esfera em equilíbrio']];
      var lx = estreito ? 14 : Math.min(L - 16, cx + R * 1.75 + 14);
      var ly = estreito ? cy + R + 46 : cy - 40;
      ct.font = '11px system-ui, sans-serif';
      ct.textAlign = 'left'; ct.textBaseline = 'middle';
      itens.forEach(function (it, k) {
        var X = lx, Y = ly + k * 18;
        ct.fillStyle = it[0];
        ct.fillRect(X, Y - 5, 11, 10);
        ct.fillStyle = G.COR.tinta;
        ct.fillText(it[1], X + 17, Y);
      });

      mostrar({
        kf: F.fmt(kF / 1e10, 3) + '×10¹⁰ m⁻¹',
        vf: F.fmt(vF / 1e6, 3) + '×10⁶ m/s',
        tau: F.fmt(tau * 1e15, 1) + ' fs',
        lc: F.fmt(vF * tau * 1e9, 1) + ' nm',
        vd: (vd < 1 ? F.fmt(vd * 1000, 2) + ' mm/s' : F.fmt(vd, 3) + ' m/s'),
        dk: F.fmt(dkReal / kF, 2),
        dkfig: F.fmt(fracao, 3) + (fracao >= 0.4999 ? ' (no teto)' : '')
      });

      nota.innerHTML =
        '<p>Sob campo, a equação de Boltzmann no tempo de relaxação tem uma solução de '
        + 'uma linha: a distribuição de equilíbrio inteira <b>escorrega</b> no espaço dos '
        + '\\(\\vec k\\) por \\(\\delta k=eE\\tau/\\hbar\\), sem mudar de forma. É a esfera '
        + 'cheia deslocada da tracejada.</p>'
        + '<p>Repare no que isso significa. O interior das duas esferas se cancela: lá, para '
        + 'cada elétron movendo-se para a direita há outro movendo-se para a esquerda, e a '
        + 'contribuição à corrente é nula. Só as duas luas contam, e elas vivem na '
        + '<b>superfície de Fermi</b>. É a tradução geométrica de '
        + '\\(\\partial\\bar n/\\partial\\epsilon\\approx-\\delta(\\epsilon-\\epsilon_F)\\), e '
        + 'é por isso que a condutividade acaba sendo uma integral sobre a superfície, '
        + '\\(\\sigma=\\frac{e^2}{4\\pi^3\\hbar}\\int_{\\epsilon=\\epsilon_F}'
        + '\\frac{v_x^2}{v}\\tau\\,dS\\), e não sobre o volume.</p>'
        + '<p>Agora o escândalo das escalas, que é o motivo de a figura precisar de uma '
        + 'ampliação. No cobre, no campo escolhido, o deslocamento real é '
        + F.fmt(dkReal / kF, 2)
        + ' do raio da esfera, e a velocidade de deriva é a mesma fração da velocidade '
        + 'de Fermi. Os elétrons voam a ' + F.fmt(vF / 1e6, 2) + '×10⁶ m/s e derivam a '
        + (vd < 1 ? F.fmt(vd * 1000, 2) + ' mm/s' : F.fmt(vd, 3) + ' m/s')
        + ': a corrente é um viés minúsculo sobre um movimento caótico violentíssimo. '
        + 'E eles escorregam <em>contra</em> o campo, por terem carga negativa, ainda que '
        + 'a corrente convencional siga com ele.</p>'
        + '<p>O segundo deslizante é uma lupa, e ela é honesta: o que a figura desenha é o '
        + 'deslocamento verdadeiro multiplicado por ela, não um valor inventado. Ponha a '
        + 'ampliação em 1 e o campo no máximo, \\(10^8\\) V/m, e a figura passa a mostrar o '
        + 'deslocamento em escala real. Esse campo, porém, é dez vezes maior que a rigidez '
        + 'dielétrica do ar: para ver a esfera escorregar de verdade é preciso destruir a '
        + 'amostra antes.</p>'
        + '<p>Os três números do meio saem de \\(\\sigma=ne^2\\tau/m\\) com o \\(\\sigma\\) '
        + 'medido do cobre: \\(\\tau=25\\) fs e um livre caminho médio de 39 nm, uns cento e '
        + 'cinquenta espaçamentos atômicos. Drude, que não sabia de exclusão de Pauli, '
        + 'obteve a mesma fórmula com a velocidade térmica clássica no lugar de '
        + '\\(v_F\\), errando o livre caminho médio por cem vezes mas acertando '
        + '\\(\\sigma\\), porque \\(v\\) não aparece nela.</p>';
      tipografar(nota);
    }

    registrarRedesenho(desenhar);
    tipografar(corpo);
  };

  /* =================================================================
     30. O dicionário das analogias
     Toda a termodinâmica de um fluido é a de um par conjugado
     (extensiva, intensiva). Trocado o par, as fórmulas são as mesmas
     com outras letras. O widget gera todas elas do mesmo molde, para
     que fique claro que não há nada novo a decorar.
     ================================================================= */
  REGISTRO.analogias = function (raiz) {
    var corpo = moldura(raiz, 'O mesmo esqueleto, três sistemas');

    /* x é a variável extensiva e y a intensiva, com dU = T dS + y dx.
       corrV e corrP dizem o que, nesse sistema, faz o papel de V e de P
       nas fórmulas de fluido: a tradução é literal, termo a termo. */
    var SIS = {
      fluido: {
        rot: 'Fluido', trab: '-P\\,dV',
        x: 'V', y: '-P', xnome: 'volume', ynome: 'pressão',
        corrV: 'V', corrP: 'P',
        E: 'E = U + PV', G: 'G = U - TS + PV',
        max: '\\dpar{S}{V}{T} = \\dpar{P}{T}{V}',
        cx: 'C_V', cy: 'C_P',
        respT: '\\kappa_T = -\\frac1V\\dpar{V}{P}{T}',
        respS: '\\kappa_S = -\\frac1V\\dpar{V}{P}{S}',
        alfa: '\\alpha = \\frac1V\\dpar{V}{T}{P}',
        id1: '\\kappa_T\\left(C_P - C_V\\right) = TV\\alpha^2',
        id2: 'C_P\\left(\\kappa_T - \\kappa_S\\right) = TV\\alpha^2',
        obs: 'O caso de referência, deduzido nas seções 8 a 10. Tudo o que '
           + 'vem depois é esta mesma estrutura com outras letras.'
      },
      magM: {
        rot: 'Magnético, trabalho em M', trab: '\\mu_0\\Hm\\,dM',
        x: 'M', y: '\\mu_0\\Hm',
        xnome: 'momento magnético total', ynome: 'campo magnético',
        corrV: '-M', corrP: '\\mu_0\\Hm',
        E: 'E = U - \\mu_0\\Hm M', G: 'G = U - TS - \\mu_0\\Hm M',
        max: '\\dpar{S}{M}{T} = -\\mu_0\\dpar{\\Hm}{T}{M}',
        cx: 'C_M', cy: 'C_{\\Hm}',
        respT: '\\chi_T = \\frac{1}{\\mu_0 V}\\dpar{M}{\\Hm}{T}',
        respS: '\\chi_S = \\frac{1}{\\mu_0 V}\\dpar{M}{\\Hm}{S}',
        alfa: '\\alpha_{\\Hm} = \\dpar{\\Mg}{T}{\\Hm}',
        id1: '\\chi_T\\left(C_{\\Hm} - C_M\\right) = TV\\alpha_{\\Hm}^2',
        id2: 'C_{\\Hm}\\left(\\chi_T - \\chi_S\\right) = TV\\alpha_{\\Hm}^2',
        obs: 'O sinal da correspondência \\(V\\equiv-M\\) tem um motivo físico: '
           + 'aumentar a pressão <em>diminui</em> o volume, enquanto aumentar o '
           + 'campo <em>aumenta</em> o momento magnético. A compressibilidade '
           + 'vira susceptibilidade, e o coeficiente de dilatação vira o '
           + 'coeficiente térmico da magnetização.'
      },
      magH: {
        rot: 'Magnético, trabalho em 𝓗', trab: '-\\mu_0 M\\,d\\Hm',
        x: '\\mu_0\\Hm', y: '-M',
        xnome: 'campo magnético', ynome: 'momento magnético total',
        corrV: '\\mu_0\\Hm', corrP: 'M',
        E: 'E = U + \\mu_0\\Hm M', G: 'G = U - TS + \\mu_0\\Hm M',
        max: '\\dpar{S}{\\Hm}{T} = \\mu_0\\dpar{M}{T}{\\Hm}',
        cx: 'C_{\\Hm}', cy: 'C_M',
        respT: '\\tilde K_T = -\\frac{1}{\\mu_0\\Hm}\\dpar{\\mu_0\\Hm}{M}{T}',
        respS: '\\tilde K_S = -\\frac{1}{\\mu_0\\Hm}\\dpar{\\mu_0\\Hm}{M}{S}',
        alfa: '\\tilde\\alpha = \\frac{1}{\\Hm}\\dpar{\\Hm}{T}{M}',
        id1: '\\tilde K_T\\left(C_M - C_{\\Hm}\\right) = T\\mu_0\\Hm\\tilde\\alpha^2',
        id2: 'C_M\\left(\\tilde K_T - \\tilde K_S\\right) = T\\mu_0\\Hm\\tilde\\alpha^2',
        obs: 'A mesma amostra, outro par conjugado. Aqui o que se controla é o '
           + 'momento magnético e o que responde é o campo, e os papéis de '
           + '\\(V\\) e \\(P\\) se invertem em relação ao caso anterior. '
           + 'Na prática usa-se este quando o experimento fixa \\(M\\), e o '
           + 'anterior quando fixa \\(\\Hm\\).'
      },
      eleP: {
        rot: 'Elétrico, trabalho em ℘', trab: '\\Em\\,d\\wp',
        x: '\\wp', y: '\\Em',
        xnome: 'momento de dipolo total', ynome: 'campo elétrico',
        corrV: '-\\wp', corrP: '\\Em',
        E: 'E = U - \\Em\\wp', G: 'G = U - TS - \\Em\\wp',
        max: '\\dpar{S}{\\wp}{T} = -\\dpar{\\Em}{T}{\\wp}',
        cx: 'C_{\\wp}', cy: 'C_{\\Em}',
        respT: '\\chi_T = \\frac1V\\dpar{\\wp}{\\Em}{T}',
        respS: '\\chi_S = \\frac1V\\dpar{\\wp}{\\Em}{S}',
        alfa: '\\alpha_{\\Em} = \\dpar{\\Pol}{T}{\\Em}',
        id1: '\\chi_T\\left(C_{\\Em} - C_{\\wp}\\right) = TV\\alpha_{\\Em}^2',
        id2: 'C_{\\Em}\\left(\\chi_T - \\chi_S\\right) = TV\\alpha_{\\Em}^2',
        obs: 'Um dielétrico entre as placas de um capacitor ligado a uma bateria, '
           + 'isto é, a potencial constante. O trabalho para aumentar o momento '
           + 'de dipolo total da amostra é \\(\\Em\\,d\\wp\\), e a polarização '
           + '\\(\\Pol=d\\wp/dV\\) faz o papel da magnetização.'
      },
      eleE: {
        rot: 'Elétrico, trabalho em ℰ', trab: '-\\wp\\,d\\Em',
        x: '\\Em', y: '-\\wp',
        xnome: 'campo elétrico', ynome: 'momento de dipolo total',
        corrV: '\\Em', corrP: '\\wp',
        E: 'E = U + \\Em\\wp', G: 'G = U - TS + \\Em\\wp',
        max: '\\dpar{S}{\\Em}{T} = \\dpar{\\wp}{T}{\\Em}',
        cx: 'C_{\\Em}', cy: 'C_{\\wp}',
        respT: '\\tilde K_T = -\\frac{1}{\\Em}\\dpar{\\Em}{\\wp}{T}',
        respS: '\\tilde K_S = -\\frac{1}{\\Em}\\dpar{\\Em}{\\wp}{S}',
        alfa: '\\tilde\\alpha = \\frac{1}{\\Em}\\dpar{\\Em}{T}{\\wp}',
        id1: '\\tilde K_T\\left(C_{\\wp} - C_{\\Em}\\right) = T\\Em\\tilde\\alpha^2',
        id2: 'C_{\\wp}\\left(\\tilde K_T - \\tilde K_S\\right) = T\\Em\\tilde\\alpha^2',
        obs: 'O par invertido, como no caso magnético: aqui se controla o campo '
           + 'e o que responde é o momento de dipolo.'
      }
    };

    var ordem = ['fluido', 'magM', 'magH', 'eleP', 'eleE'];
    var est = { k: 'fluido' };

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    opcoes(ctr, ordem.map(function (k) { return { rot: SIS[k].rot, v: k }; }), 0,
      function (v) { est.k = v; mostrar(); });

    var tabela = el('div', { class: 'tabela-rolavel' });
    corpo.appendChild(tabela);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    function linha(rot, tex) {
      return '<tr><td>' + rot + '</td><td>\\(' + tex + '\\)</td></tr>';
    }

    function mostrar() {
      var s = SIS[est.k];
      tabela.innerHTML = '<table><thead><tr><th>Item</th><th>'
        + s.rot + '</th></tr></thead><tbody>'
        + linha('Variável extensiva', s.x + '\\quad\\text{(' + s.xnome + ')}')
        + linha('Variável intensiva', s.y + '\\quad\\text{(' + s.ynome + ')}')
        + linha('Trabalho \\(\\dbar W\\)', s.trab)
        + linha('Primeira lei', 'dU = T\\,dS '
            + (s.trab.charAt(0) === '-' ? '- ' + s.trab.slice(1) : '+ ' + s.trab))
        + linha('No lugar de \\(V\\)', s.corrV)
        + linha('No lugar de \\(P\\)', s.corrP)
        + linha('Energia livre de Helmholtz', 'F = U - TS')
        + linha('Análogo da entalpia', s.E)
        + linha('Análogo da energia de Gibbs', s.G)
        + linha('Uma relação de Maxwell', s.max)
        + linha('Capacidades caloríficas', s.cx + ',\\qquad ' + s.cy)
        + linha('Resposta isotérmica', s.respT)
        + linha('Resposta adiabática', s.respS)
        + linha('Coeficiente térmico', s.alfa)
        + linha('Identidade das capacidades', s.id1)
        + linha('Identidade das respostas', s.id2)
        + '</tbody></table>';

      nota.innerHTML = '<p>' + s.obs + '</p>'
        + '<p>Compare esta coluna com a do fluido e veja que <strong>nenhuma fórmula '
        + 'mudou de forma</strong>. Toda a termodinâmica das seções 5 a 10 foi deduzida '
        + 'a partir de \\(dU=T\\,dS-P\\,dV\\) sem usar nada sobre o que \\(P\\) e \\(V\\) '
        + 'são: só que formam um par conjugado cujo produto é energia. Trocado o par, as '
        + 'relações de Maxwell, os potenciais e as identidades entre funções resposta '
        + 'sobrevivem letra por letra.</p>'
        + '<p>Isso é mais do que economia de esforço. É o que permite medir uma '
        + 'susceptibilidade magnética e concluir alguma coisa sobre entropia, ou usar '
        + 'desmagnetização adiabática para resfriar uma amostra, que é a versão magnética '
        + 'da expansão adiabática de um gás e o método que chega aos microkelvin.</p>';
      tipografar(corpo);
    }

    mostrar();
  };

  /* =================================================================
     31. Modelo de Potts sem interação
     Um estado fundamental e q−1 estados excitados degenerados. Em q = 2
     é o sistema de dois níveis da seção 11; em q = 3 é o caso do
     σ = 0, ±1. A degenerescência entra como um 2^{n} na contagem, e é
     ela que desloca o pico de Schottky e leva a entropia a kB ln q.
     ================================================================= */
  REGISTRO.potts = function (raiz) {
    var est = { q: 3, vista: 'contagem', N: 6 };
    var corpo = moldura(raiz, 'O modelo de Potts: q estados por sítio');

    var ctr0 = el('div', { class: 'controles' });
    corpo.appendChild(ctr0);
    opcoes(ctr0, [
      { rot: 'Contagem de estados', v: 'contagem' },
      { rot: 'Energia e entropia', v: 'termo' },
      { rot: 'Calor específico', v: 'calor' }
    ], 0, function (v) { est.vista = v; desenhar(); });

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    deslizante(ctr, 'estados por sítio q', 2, 10, 1, 3,
      function (v) { est.q = v; desenhar(); },
      function (v) { return String(v); });
    var desN = deslizante(ctr, 'número de sítios N', 2, 14, 1, 6,
      function (v) { est.N = v; desenhar(); },
      function (v) { return String(v); });

    var mostrar = cartoes(corpo, [
      { rot: 'configurações q<sup>N</sup>', k: 'tot' },
      { rot: 'níveis de energia', k: 'niv' },
      { rot: 'u/μ quando T → ∞', k: 'uinf' },
      { rot: 's/k<sub>B</sub> quando T → ∞', k: 'sinf' },
      { rot: 'pico de c em k<sub>B</sub>T/μ', k: 'tp' },
      { rot: 'altura do pico', k: 'cp' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    /* Ω(n) = C(N,n)·(q−1)^n: escolhe quais n sítios estão excitados e,
       para cada um, qual dos q−1 estados excitados ele ocupa. */
    function lnOmega(n, N, q) {
      return F.lnBinom(N, n) + n * Math.log(q - 1);
    }
    function u(x, q) { return (q - 1) / (Math.exp(x) + q - 1); }      // u/μ
    function entropia(x, q) {                                         // s/kB
      return Math.log(1 + (q - 1) * Math.exp(-x)) + x * u(x, q);
    }
    function calor(x, q) {                                            // c/kB
      var g = q - 1, e = Math.exp(x);
      return g * x * x * e / ((e + g) * (e + g));
    }

    function desenhar() {
      var q = est.q, N = est.N;

      if (est.vista === 'contagem') {
        var maior = 0;
        for (var n = 0; n <= N; n++) maior = Math.max(maior, lnOmega(n, N, q));
        var ax = G.eixos(cv, {
          xmin: -0.6, xmax: N + 0.6, ymin: 0, ymax: Math.exp(maior) * 1.15,
          altura: 300,
          rotX: 'número de sítios excitados n (energia E = nμ)',
          rotY: 'microestados Ω(n)',
          marcasX: G.marcasInteiras(0, N),
          formataY: function (v) { return F.fmt(v, 0); }
        });
        for (var k = 0; k <= N; k++) {
          G.barras(ax, [{ x: k, y: Math.exp(lnOmega(k, N, q)) }],
                   k === 0 ? G.COR.azul : G.COR.vinho, 0.72);
        }
        /* para comparar: a binomial sem a degenerescência, que é o caso q=2 */
        if (q > 2) {
          ax.ct.save();
          ax.ct.strokeStyle = G.COR.ambar;
          ax.ct.lineWidth = 2;
          ax.ct.setLineDash([5, 4]);
          ax.ct.beginPath();
          for (var j = 0; j <= N; j++) {
            var yb = Math.exp(F.lnBinom(N, j));
            if (j === 0) ax.ct.moveTo(ax.X(j), ax.Y(yb));
            else ax.ct.lineTo(ax.X(j), ax.Y(yb));
          }
          ax.ct.stroke();
          ax.ct.restore();
          G.legenda(ax, [
            { cor: G.COR.vinho, texto: 'Ω(n) = C(N,n)(q−1)ⁿ' },
            { cor: G.COR.ambar, texto: 'só C(N,n): o caso q = 2' }
          ]);
        }
      } else if (est.vista === 'termo') {
        var ax2 = G.eixos(cv, {
          xmin: 0, xmax: 4, ymin: 0, ymax: Math.max(1.05, Math.log(q) * 1.12),
          altura: 300,
          rotX: 'temperatura kT/μ', rotY: 'por sítio',
          marcasX: G.marcasLineares(0, 4, 8, 0),
          formataY: function (v) { return F.fmt(v, 1); }
        });
        G.curva(ax2, function (t) { return t <= 0 ? 0 : u(1 / t, q); },
                G.COR.azul, 2.8);
        G.curva(ax2, function (t) { return t <= 0 ? 0 : entropia(1 / t, q); },
                G.COR.vinho, 2.8);
        G.curva(ax2, function () { return (q - 1) / q; }, G.COR.azul, 1.4, [5, 4]);
        G.curva(ax2, function () { return Math.log(q); }, G.COR.vinho, 1.4, [5, 4]);
        G.legenda(ax2, [
          { cor: G.COR.azul, texto: 'u/μ → (q−1)/q' },
          { cor: G.COR.vinho, texto: 's/k → ln q' }
        ]);
      } else {
        var ax3 = G.eixos(cv, {
          xmin: 0, xmax: 2.2, ymin: 0, ymax: 2.3, altura: 300,
          rotX: 'temperatura kT/μ', rotY: 'calor específico c/k',
          marcasX: G.marcasLineares(0, 2.2, 11, 1),
          formataY: function (v) { return F.fmt(v, 1); }
        });
        [2, 3, 4, 6, 10].forEach(function (qq) {
          var cor = qq === q ? G.COR.vinho : G.COR.grade;
          G.curva(ax3, function (t) { return t <= 0 ? 0 : calor(1 / t, qq); },
                  cor, qq === q ? 3 : 1.4);
        });
        G.legenda(ax3, [
          { cor: G.COR.vinho, texto: 'q = ' + q },
          { cor: G.COR.grade, texto: 'q = 2, 3, 4, 6, 10' }
        ]);
      }

      /* o pico de Schottky, achado pela raiz da derivada de c em x = μ/kT */
      var xp = F.bissecao(function (x) {
        var h = 1e-5;
        return calor(x + h, q) - calor(x - h, q);
      }, 0.5, 12, 1e-10);
      var tp = xp ? 1 / xp : NaN;

      mostrar({
        tot: F.fmt(Math.pow(q, N), 0),
        niv: '2 (0 e μ)',
        uinf: F.fmt((q - 1) / q, 4),
        sinf: F.fmt(Math.log(q), 4),
        tp: F.fmt(tp, 4),
        cp: F.fmt(calor(xp, q), 4)
      });

      nota.innerHTML = est.vista === 'contagem'
        ? '<p>Cada sítio tem \\(q\\) estados: um fundamental, de energia zero, e '
          + '\\(q-1\\) excitados, todos de energia \\(\\mu\\). No caso \\(q=3\\) dos '
          + 'slides, com \\(\\sigma=0,\\pm1\\) e '
          + '\\(\\hat{H}=\\mu\\sum_i\\sigma_i^2\\), os dois estados \\(\\sigma=\\pm1\\) '
          + 'têm a mesma energia porque \\(\\sigma^2\\) não distingue o sinal.</p>'
          + '<p>Contar é escolher <em>quais</em> \\(n\\) sítios estão excitados, o que dá '
          + '\\(\\binom{N}{n}\\), e depois <em>qual</em> dos \\(q-1\\) estados cada um '
          + 'ocupa, o que dá \\((q-1)^n\\):</p>'
          + '<p>\\[\\Omega(n)=\\binom{N}{n}\\left(q-1\\right)^{n}'
          + '=\\frac{N!}{n!\\left(N-n\\right)!}\\left(q-1\\right)^{n}.\\]</p>'
          + '<p>A curva tracejada é o que se teria sem a degenerescência, isto é, o '
          + 'sistema de dois níveis da seção 11. O fator \\((q-1)^n\\) <b>inclina</b> a '
          + 'distribuição para a direita: o máximo deixa de estar em \\(n=N/2\\) e vai '
          + 'para \\(n=N(q-1)/q\\), porque há mais maneiras de estar excitado do que de '
          + 'estar no fundamental. Toda a diferença entre Potts e dois níveis é essa '
          + 'inclinação.</p>'
        : est.vista === 'termo'
        ? '<p>Da entropia \\(s=\\kB\\ln\\Omega\\) com Stirling, e de '
          + '\\(\\partial s/\\partial u=1/T\\), sai</p>'
          + '<p>\\[\\frac{\\mu}{\\kB T}=\\ln\\frac{\\left(q-1\\right)\\left(1-u/\\mu\\right)}'
          + '{u/\\mu}\\quad\\Longrightarrow\\quad'
          + '\\boxed{\\;u=\\frac{\\left(q-1\\right)\\mu}{e^{\\mu/\\kB T}+q-1}\\;}\\]</p>'
          + '<p>que para \\(q=3\\) é o \\(u=2\\mu/(2+e^{\\mu/\\kB T})\\) dos slides. Vale a '
          + 'pena conferir pelo outro caminho: no ensemble canônico, '
          + '\\(z=1+(q-1)e^{-\\beta\\mu}\\) e \\(u=-\\partial\\ln z/\\partial\\beta\\) dão a '
          + 'mesma expressão em três linhas, e as duas entropias coincidem até a última '
          + 'casa da máquina. Os ensembles concordam, como têm de concordar.</p>'
          + '<p>Os dois patamares são o conteúdo físico. Em temperatura alta todos os '
          + '\\(q\\) estados ficam igualmente prováveis, de modo que '
          + '\\(s\\to\\kB\\ln q\\) (a entropia de \\(q\\) possibilidades equiprováveis) e '
          + '\\(u\\to\\mu(q-1)/q\\) (a fração de estados que custam \\(\\mu\\)). Em '
          + 'temperatura zero só o fundamental sobrevive, \\(s\\to0\\), que é a terceira '
          + 'lei aparecendo sozinha.</p>'
        : '<p>O calor específico é</p>'
          + '<p>\\[\\frac{c}{\\kB}=\\left(q-1\\right)'
          + '\\left(\\frac{\\mu}{\\kB T}\\right)^2'
          + '\\frac{e^{\\mu/\\kB T}}{\\left(e^{\\mu/\\kB T}+q-1\\right)^2},\\]</p>'
          + '<p>a <b>anomalia de Schottky</b>: um pico e nada mais. Não há calor '
          + 'específico em temperatura baixa, porque não há energia suficiente para '
          + 'excitar ninguém, nem em temperatura alta, porque os níveis já estão '
          + 'saturados e aquecer mais não muda as ocupações. Só na faixa '
          + '\\(\\kB T\\sim\\mu\\) o sistema absorve calor.</p>'
          + '<p>Aumentar \\(q\\) faz duas coisas ao pico: ele <b>sobe</b>, porque há mais '
          + 'entropia a liberar, e <b>desloca-se para a esquerda</b>, porque a '
          + 'degenerescência favorece a excitação e ela acontece mais cedo. Para '
          + '\\(q=2\\) o pico vale 0,4392 em \\(\\kB T/\\mu=0{,}4168\\), que é o número da '
          + 'seção 11; para \\(q=10\\) vale 2,0584 em 0,2859.</p>'
          + '<p>Esse perfil é assinatura experimental de nível discreto, e aparece em '
          + 'sais paramagnéticos, em defeitos de cristais e em sistemas de dois níveis de '
          + 'vidros a baixa temperatura. Encontrar um pico de Schottky num calorímetro é '
          + 'encontrar um conjunto de níveis separados por \\(\\mu\\approx\\kB T_{\\rm '
          + 'pico}/0{,}42\\).</p>';
      tipografar(nota);
      desN.parentNode.style.display = est.vista === 'contagem' ? '' : 'none';
    }

    registrarRedesenho(desenhar);
    tipografar(corpo);
  };

  /* =================================================================
     32. O modelo de Weiss
     A equação de autoconsistência m = tanh(T_C m/T + ℌ). A primeira
     vista é a construção gráfica que resolve a equação; a segunda é a
     magnetização espontânea comparada com dados de ferromagnetos reais.
     ================================================================= */
  REGISTRO.weiss = function (raiz) {
    var corpo = moldura(raiz, 'O modelo de Weiss: um ímã que se sustenta sozinho');

    /* T_C medido, momento por átomo em magnétons de Bohr e o spin efetivo
       que o campo médio precisaria para reproduzir aquele T_C */
    var MAT = [
      { nome: 'Fe', rot: 'ferro', Tc: 1043, mu: 2.22 },
      { nome: 'Co', rot: 'cobalto', Tc: 1388, mu: 1.72 },
      { nome: 'Ni', rot: 'níquel', Tc: 627, mu: 0.606 },
      { nome: 'Gd', rot: 'gadolínio', Tc: 292, mu: 7.63 },
      { nome: 'EuO', rot: 'óxido de európio', Tc: 69, mu: 6.9 }
    ];

    var est = { i: 0, T: 800, h: 0, vista: 'grafica' };

    var ctr0 = el('div', { class: 'controles' });
    corpo.appendChild(ctr0);
    opcoes(ctr0, [
      { rot: 'Construção gráfica', v: 'grafica' },
      { rot: 'Magnetização espontânea', v: 'ms' },
      { rot: 'Susceptibilidade', v: 'chi' }
    ], 0, function (v) { est.vista = v; desenhar(); });

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    var desT = deslizante(ctr, 'temperatura', 5, 2000, 5, 800,
      function (v) { est.T = v; desenhar(); },
      function (v) { return v + ' K'; });
    deslizante(ctr, 'campo reduzido ℌ', 0, 0.6, 0.01, 0,
      function (v) { est.h = v; desenhar(); },
      function (v) { return F.fmt(v, 2); });
    opcoes(ctr, MAT.map(function (m) { return { rot: m.rot, v: m.nome }; }), 0,
      function (v) {
        MAT.forEach(function (m, k) { if (m.nome === v) est.i = k; });
        /* cada material tem a sua escala de temperatura: o deslizante segue */
        desT.max = Math.round(2 * MAT[est.i].Tc);
        desT.value = Math.round(0.77 * MAT[est.i].Tc);
        desT.dispatchEvent(new Event('input'));
      });

    var mostrar = cartoes(corpo, [
      { rot: 'T<sub>C</sub> medido', k: 'tc' }, { rot: 'T/T<sub>C</sub>', k: 'r' },
      { rot: 'm = ℳ/ℳ₀', k: 'm' },
      { rot: 'momento por átomo', k: 'mu' },
      { rot: 'raízes da equação', k: 'nr' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    /* A solução estável é a de maior |m|: as três raízes em campo nulo são
       0 e ±m_s, e a do meio é instável, como mostra a energia de Landau. */
    function resolver(r, h) {
      if (r >= 1 && h === 0) return 0;
      var m = 0.999;
      for (var k = 0; k < 500; k++) {
        var novo = Math.tanh(h + m / r);
        m = m + 0.55 * (novo - m);
      }
      return m;
    }

    function desenhar() {
      var M = MAT[est.i], r = est.T / M.Tc, m = resolver(r, est.h);

      if (est.vista === 'grafica') {
        var ax = G.eixos(cv, {
          xmin: -1.25, xmax: 1.25, ymin: -1.25, ymax: 1.25, altura: 320,
          rotX: 'magnetização reduzida m', rotY: 'os dois lados da equação',
          marcasX: G.marcasLineares(-1.25, 1.25, 10, 1),
          formataY: function (v) { return F.fmt(v, 1); }
        });
        /* lado esquerdo: a reta y = m. Lado direito: a tangente hiperbólica */
        G.curva(ax, function (x) { return x; }, G.COR.suave, 1.8, [5, 4]);
        G.curva(ax, function (x) { return Math.tanh(est.h + x / r); },
                G.COR.vinho, 2.8);
        /* a solução é o cruzamento */
        ax.ct.save();
        ax.ct.fillStyle = G.COR.azul;
        [m, est.h === 0 ? -m : null, est.h === 0 && r < 1 ? 0 : null]
          .forEach(function (s) {
            if (s === null) return;
            ax.ct.beginPath();
            ax.ct.arc(ax.X(s), ax.Y(s), 5, 0, 2 * Math.PI);
            ax.ct.fill();
          });
        ax.ct.restore();
        G.legenda(ax, [
          { cor: G.COR.suave, texto: 'y = m' },
          { cor: G.COR.vinho, texto: 'y = tgh(ℌ + m T_C/T)' },
          { cor: G.COR.azul, texto: 'solução' }
        ]);
      } else if (est.vista === 'ms') {
        var ax2 = G.eixos(cv, {
          xmin: 0, xmax: 1.4, ymin: 0, ymax: 1.05, altura: 300,
          rotX: 'T / T_C', rotY: 'magnetização reduzida m_s',
          marcasX: G.marcasLineares(0, 1.4, 7, 1),
          formataY: function (v) { return F.fmt(v, 1); }
        });
        G.curva(ax2, function (x) { return resolver(x, 0); }, G.COR.vinho, 2.8);
        /* a aproximação de raiz quadrada, válida só junto a T_C */
        G.curva(ax2, function (x) {
          return x >= 1 ? NaN : Math.min(1, x * Math.sqrt(3 * (1 - x)));
        }, G.COR.ambar, 2, [6, 4]);
        G.vertical(ax2, Math.min(1.4, r), G.COR.azul,
                   'T = ' + est.T + ' K', true);
        G.legenda(ax2, [
          { cor: G.COR.vinho, texto: 'solução de m = tgh(m T_C/T)' },
          { cor: G.COR.ambar, texto: '(T/T_C)√(3(1−T/T_C)), junto a T_C' }
        ]);
      } else {
        /* Em T/T_C a reta é a mesma para todos. Em kelvin, cada material
           corta o eixo no seu próprio T_C, que é justamente o que a
           extrapolação mede: 69 K no EuO e 1043 K no ferro. */
        var Tm = 2200;
        var ax3 = G.eixos(cv, {
          xmin: 0, xmax: Tm, ymin: 0, ymax: 1600, altura: 310,
          rotX: 'temperatura (K)', rotY: '1/χ, em unidades de 1/C (K)',
          marcasX: G.marcasLineares(0, Tm, 8, 0),
          formataY: function (v) { return F.fmt(v, 0); }
        });
        MAT.forEach(function (q, k) {
          G.curva(ax3, function (x) { return x <= q.Tc ? NaN : x - q.Tc; },
                  k === est.i ? G.COR.vinho : G.COR.grade,
                  k === est.i ? 3 : 1.4);
        });
        G.curva(ax3, function (x) { return x; }, G.COR.suave, 1.8, [5, 4]);
        G.curva(ax3, function (x) { return x + 400 > 1600 ? NaN : x + 400; },
                G.COR.ambar, 2, [4, 4]);
        G.vertical(ax3, M.Tc, G.COR.tinta, M.nome + ': ' + M.Tc + ' K', true);
        ax3.ct.save();
        ax3.ct.font = '600 10px system-ui, sans-serif';
        ax3.ct.textAlign = 'left'; ax3.ct.textBaseline = 'bottom';
        MAT.forEach(function (q, k) {
          if (k === est.i) return;
          ax3.ct.fillStyle = 'rgba(120,128,138,.9)';
          ax3.ct.fillText(q.nome, ax3.X(q.Tc) + 3, ax3.y1 - 3);
        });
        ax3.ct.restore();
        G.legenda(ax3, [
          { cor: G.COR.vinho, texto: 'ferromagneto: 1/χ ∝ T − T_C' },
          { cor: G.COR.suave, texto: 'Curie, sem interação: 1/χ ∝ T' },
          { cor: G.COR.ambar, texto: 'antiferromagneto: 1/χ ∝ T + T_N' }
        ]);
      }

      mostrar({
        tc: M.Tc + ' K',
        r: F.fmt(r, 3),
        m: F.fmt(m, 4),
        mu: F.fmt(M.mu, 2) + ' μ_B',
        nr: (est.h > 0 ? '1 (campo quebra a simetria)'
             : r < 1 ? '3: 0 e ±m_s' : '1: só m = 0')
      });

      nota.innerHTML = est.vista === 'grafica'
        ? '<p>A equação \\(m=\\tanh\\left(\\mathfrak{H}+mT_C/T\\right)\\) não se resolve por '
          + 'álgebra, mas se resolve com os olhos: as soluções são os cruzamentos da reta '
          + '\\(y=m\\) com a tangente hiperbólica.</p>'
          + '<p>Tudo depende da <b>inclinação da tangente hiperbólica na origem</b>, que vale '
          + '\\(T_C/T\\). Se ela for menor que 1, isto é \\(T>T_C\\), a curva fica abaixo da '
          + 'reta e só há o cruzamento trivial \\(m=0\\): o material é paramagnético. Se for '
          + 'maior que 1, a curva sai por cima e volta, e aparecem <b>três</b> cruzamentos, '
          + '\\(0\\) e \\(\\pm m_s\\). Deslize a temperatura pelo \\(T_C\\) do '
          + M.rot + ', ' + M.Tc + ' K, e veja os dois nascerem.</p>'
          + '<p>Essa é a mágica do campo médio: o material cria o próprio campo que o '
          + 'mantém magnetizado. Nada de externo precisa estar ligado, e é por isso que um '
          + 'ímã continua sendo ímã dentro da gaveta.</p>'
        : est.vista === 'ms'
        ? '<p>A magnetização espontânea sai de 1 no zero absoluto e cai continuamente a zero '
          + 'em \\(T_C\\). Como ela muda <em>continuamente</em>, a transição é de '
          + '<b>segunda ordem</b>: não há calor latente, e o parâmetro de ordem some sem '
          + 'salto.</p>'
          + '<p>A curva tracejada é a expansão da seção 11, '
          + '\\(m_s\\approx(T/T_C)\\sqrt{3\\left(1-T/T_C\\right)}\\). Ela só vale junto a '
          + '\\(T_C\\), onde \\(m_s\\ll1\\) justifica cortar a série da tangente hiperbólica '
          + 'no termo cúbico, e de fato cola na curva exata só nos últimos 10% antes da '
          + 'transição. O expoente \\(\\beta=1/2\\) que ela carrega é a previsão de campo '
          + 'médio, e a seção 16 mostra por que ele está errado.</p>'
        : '<p>Acima de \\(T_C\\) a susceptibilidade segue a <b>lei de Curie-Weiss</b>, '
          + '\\(\\chi=C/\\left(T-T_C\\right)\\), e o jeito de medir isso é traçar '
          + '\\(1/\\chi\\) contra \\(T\\): dá uma reta, e <b>o ponto em que ela corta o eixo '
          + 'é \\(T_C\\)</b>. É assim que se mede a temperatura crítica sem precisar chegar '
          + 'perto dela.</p>'
          + '<p>As três retas contam a história inteira do sinal da interação de troca. Sem '
          + 'interação, \\(J=0\\), a reta passa pela origem: é a lei de Curie do Módulo 3, e '
          + 'o material é paramagnético em qualquer temperatura. Com \\(J>0\\) a reta se '
          + 'desloca para a direita e corta o eixo em \\(T_C>0\\): abaixo dali há '
          + 'ferromagnetismo. Com \\(J<0\\) ela corta em temperatura negativa, o que não '
          + 'significa nada fisicamente, mas avisa que os vizinhos querem apontar em '
          + 'sentidos opostos: é um antiferromagneto, e o que acontece em '
          + '\\(T_N\\) é um ordenamento alternado, não uma magnetização.</p>'
          + '<p>Na prática a reta medida quase nunca corta exatamente onde a magnetização '
          + 'espontânea aparece, e a diferença entre o \\(T_C\\) extrapolado e o observado é '
          + 'uma das primeiras evidências de que o campo médio não é a última palavra.</p>';
      tipografar(nota);
    }

    registrarRedesenho(desenhar);
    tipografar(corpo);
  };

  /* =================================================================
     33. A energia livre de Landau
     F(m) = (a/2)m² + (b/4)m⁴ − hm, com a ∝ (T − T_C). O poço duplo
     nasce quando a troca de sinal, e o campo o inclina.
     ================================================================= */
  REGISTRO.landau = function (raiz) {
    var corpo = moldura(raiz, 'A energia livre de Landau: o poço que se parte em dois');

    var est = { r: 0.8, h: 0, vista: 'livre' };

    var ctr0 = el('div', { class: 'controles' });
    corpo.appendChild(ctr0);
    opcoes(ctr0, [
      { rot: 'Energia livre', v: 'livre' },
      { rot: 'Mínimos contra temperatura', v: 'bifurca' }
    ], 0, function (v) { est.vista = v; desenhar(); });

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    deslizante(ctr, 'temperatura T/T<sub>C</sub>', 0.2, 1.8, 0.01, 0.8,
      function (v) { est.r = v; desenhar(); },
      function (v) { return F.fmt(v, 2); });
    deslizante(ctr, 'campo externo h', -0.12, 0.12, 0.002, 0,
      function (v) { est.h = v; desenhar(); },
      function (v) { return F.fmt(v, 3); });

    var mostrar = cartoes(corpo, [
      { rot: 'a = T/T<sub>C</sub> − 1', k: 'a' },
      { rot: 'mínimos', k: 'nm' },
      { rot: 'm de equilíbrio', k: 'm' },
      { rot: 'ℱ no mínimo', k: 'f' },
      { rot: 'barreira', k: 'b' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    /* ℱ(m) = (a/2)m² + (1/4)m⁴ − hm, com b absorvido na escala de m */
    function livre(m, a, h) { return a * m * m / 2 + m * m * m * m / 4 - h * m; }

    /* os extremos resolvem a m + m³ = h: busca por varredura fina */
    function extremos(a, h) {
      var r = [], ant = null;
      for (var i = 0; i <= 4000; i++) {
        var m = -1.6 + 3.2 * i / 4000;
        var d = a * m + m * m * m - h;
        if (ant !== null && ant.d * d <= 0 && d !== ant.d) {
          r.push({ m: 0.5 * (ant.m + m),
                   min: a + 3 * Math.pow(0.5 * (ant.m + m), 2) > 0 });
        }
        ant = { m: m, d: d };
      }
      return r;
    }

    function desenhar() {
      var a = est.r - 1, h = est.h;
      var ex = extremos(a, h);
      var mins = ex.filter(function (q) { return q.min; });
      var maxs = ex.filter(function (q) { return !q.min; });
      var eq = mins.length
        ? mins.reduce(function (p, q) { return livre(q.m, a, h) < livre(p.m, a, h) ? q : p; })
        : { m: 0 };

      if (est.vista === 'livre') {
        var ax = G.eixos(cv, {
          xmin: -1.5, xmax: 1.5, ymin: -0.32, ymax: 0.22, altura: 310,
          rotX: 'parâmetro de ordem m', rotY: 'energia livre ℱ(m)',
          marcasX: G.marcasLineares(-1.5, 1.5, 6, 1),
          formataY: function (v) { return F.fmt(v, 1); }
        });
        G.curva(ax, function (m) { return livre(m, a, h); }, G.COR.vinho, 3);
        ax.ct.save();
        mins.forEach(function (q) {
          ax.ct.fillStyle = q.m === eq.m ? G.COR.azul : G.COR.suave;
          ax.ct.beginPath();
          ax.ct.arc(ax.X(q.m), ax.Y(livre(q.m, a, h)), 5.5, 0, 2 * Math.PI);
          ax.ct.fill();
        });
        maxs.forEach(function (q) {
          ax.ct.strokeStyle = G.COR.ambar; ax.ct.lineWidth = 2;
          ax.ct.beginPath();
          ax.ct.arc(ax.X(q.m), ax.Y(livre(q.m, a, h)), 5, 0, 2 * Math.PI);
          ax.ct.stroke();
        });
        ax.ct.restore();
        G.legenda(ax, [
          { cor: G.COR.azul, texto: 'mínimo global: o estado de equilíbrio' },
          { cor: G.COR.suave, texto: 'mínimo local: metaestável' },
          { cor: G.COR.ambar, texto: 'máximo: instável' }
        ]);
      } else {
        var ax2 = G.eixos(cv, {
          xmin: 0.2, xmax: 1.8, ymin: -1.15, ymax: 1.15, altura: 310,
          rotX: 'T / T_C', rotY: 'm nos extremos de ℱ',
          marcasX: G.marcasLineares(0.2, 1.8, 8, 1),
          formataY: function (v) { return F.fmt(v, 1); }
        });
        /* o diagrama de bifurcação: ±√(−a) abaixo de T_C, zero acima */
        G.curva(ax2, function (x) {
          return x >= 1 ? NaN : Math.sqrt(1 - x);
        }, G.COR.vinho, 2.8);
        G.curva(ax2, function (x) {
          return x >= 1 ? NaN : -Math.sqrt(1 - x);
        }, G.COR.vinho, 2.8);
        G.curva(ax2, function (x) { return x >= 1 ? 0 : NaN; }, G.COR.vinho, 2.8);
        G.curva(ax2, function (x) { return x < 1 ? 0 : NaN; },
                G.COR.ambar, 2, [5, 4]);
        G.vertical(ax2, est.r, G.COR.azul, 'aqui', true);
        G.legenda(ax2, [
          { cor: G.COR.vinho, texto: 'estável' },
          { cor: G.COR.ambar, texto: 'instável' }
        ]);
      }

      var barreira = (mins.length === 2 && maxs.length === 1)
        ? livre(maxs[0].m, a, h) - Math.max(livre(mins[0].m, a, h), livre(mins[1].m, a, h))
        : null;

      mostrar({
        a: F.fmt(a, 3),
        nm: String(mins.length),
        m: F.fmt(eq.m, 4),
        f: F.fmt(livre(eq.m, a, h), 5),
        b: barreira === null ? '—' : F.fmt(barreira, 5)
      });

      nota.innerHTML = est.vista === 'livre'
        ? '<p>Landau não deduziu esta energia livre de microfísica nenhuma: ele a '
          + '<em>adivinhou</em>, a partir de três exigências. Que seja analítica em '
          + '\\(m\\), porque \\(m\\) é pequeno junto à transição; que respeite a simetria do '
          + 'problema, \\(\\mathcal F(m)=\\mathcal F(-m)\\) em campo nulo, o que elimina as '
          + 'potências ímpares; e que o coeficiente do termo quadrático troque de sinal em '
          + '\\(T_C\\). Daí \\(\\mathcal F=\\frac a2m^2+\\frac b4m^4-hm\\) com '
          + '\\(a\\propto T-T_C\\), e mais nada.</p>'
          + '<p>Com isso a transição inteira vira geometria de uma curva. Para \\(a>0\\) há '
          + 'um poço só, em \\(m=0\\). Quando \\(a\\) cruza zero, o fundo do poço vira um '
          + 'morro e nascem dois mínimos em \\(m=\\pm\\sqrt{-a/b}\\), isto é '
          + '\\(m_s\\propto\\left(T_C-T\\right)^{1/2}\\). O sistema tem de <b>escolher</b> um '
          + 'dos dois, e é esse ato de escolha que se chama quebra espontânea de '
          + 'simetria.</p>'
          + '<p>Ligue o campo e veja o que acontece: ele inclina a curva, um mínimo desce e '
          + 'o outro sobe. O que era um empate vira um preferido e um <b>metaestável</b>, '
          + 'separados por uma barreira. É dali que vem a histerese da seção 13: o sistema '
          + 'fica preso no mínimo errado até a barreira desaparecer.</p>'
        : '<p>Este é o <b>diagrama de bifurcação</b>, e ele é o retrato mais econômico de uma '
          + 'transição contínua. Vindo de temperatura alta há um único equilíbrio, '
          + '\\(m=0\\). Em \\(T_C\\) esse ramo se torna instável e dois ramos estáveis se '
          + 'destacam dele, como um garfo.</p>'
          + '<p>O ramo \\(m=0\\) não desaparece abaixo de \\(T_C\\): ele continua sendo '
          + 'solução, só que instável, como a bolinha no alto do morro. Um sistema '
          + 'resfriado muito depressa pode ficar ali por algum tempo, e qualquer flutuação '
          + 'o empurra para um dos lados.</p>'
          + '<p>A forma \\(\\pm\\sqrt{1-T/T_C}\\) dá o expoente crítico '
          + '\\(\\beta=1/2\\). Ele é o mesmo que saiu do modelo de Weiss, e não por '
          + 'coincidência: a expansão da tangente hiperbólica até \\(m^3\\) <em>é</em> a '
          + 'energia livre de Landau. Os dois caminhos são o mesmo caminho.</p>';
      tipografar(nota);
    }

    registrarRedesenho(desenhar);
    tipografar(corpo);
  };

  /* =================================================================
     34. Histerese
     A isoterma ℌ(m) = arctgh(m) − m T_C/T tem a mesma forma em S da
     isoterma de van der Waals, e pelo mesmo motivo: um laço de
     estados metaestáveis em torno de um trecho instável.
     ================================================================= */
  REGISTRO.histerese = function (raiz) {
    var corpo = moldura(raiz, 'Histerese: o ímã que lembra por onde passou');

    var est = { r: 0.7, vista: 'laco' };

    var ctr0 = el('div', { class: 'controles' });
    corpo.appendChild(ctr0);
    opcoes(ctr0, [
      { rot: 'O laço', v: 'laco' },
      { rot: 'A isoterma completa', v: 'iso' }
    ], 0, function (v) { est.vista = v; desenhar(); });

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    deslizante(ctr, 'temperatura T/T<sub>C</sub>', 0.3, 1.3, 0.01, 0.7,
      function (v) { est.r = v; desenhar(); },
      function (v) { return F.fmt(v, 2); });

    var mostrar = cartoes(corpo, [
      { rot: 'T/T<sub>C</sub>', k: 'r' },
      { rot: 'magnetização remanente', k: 'mr' },
      { rot: 'campo coercivo ℌ_c', k: 'hc' },
      { rot: 'trecho instável', k: 'ins' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    /* a função inversa: dado m, qual campo o sustenta */
    function campo(m, r) {
      if (Math.abs(m) >= 0.99999) return NaN;
      return 0.5 * Math.log((1 + m) / (1 - m)) - m / r;
    }
    /* o trecho instável é onde dℌ/dm < 0, entre ±m* com
       1/(1−m²) = 1/r, isto é m* = √(1−r) */
    function mEstrela(r) { return r < 1 ? Math.sqrt(1 - r) : 0; }

    function desenhar() {
      var r = est.r, me = mEstrela(r);
      /* o campo coercivo é o extremo da curva: onde o ramo metaestável acaba */
      var hc = me > 0 ? Math.abs(campo(me, r)) : 0;
      /* a magnetização remanente é a solução espontânea */
      var mr = 0.999;
      for (var k = 0; k < 400; k++) mr += 0.55 * (Math.tanh(mr / r) - mr);
      if (r >= 1) mr = 0;

      var hmax = Math.max(0.35, hc * 2.4);
      var ax = G.eixos(cv, {
        xmin: -hmax, xmax: hmax, ymin: -1.1, ymax: 1.1, altura: 320,
        rotX: 'campo reduzido ℌ', rotY: 'magnetização reduzida m',
        marcasX: G.marcasLineares(-hmax, hmax, 8, 2),
        formataY: function (v) { return F.fmt(v, 1); }
      });

      /* a isoterma, traçada como curva paramétrica em m */
      function tracar(m0, m1, cor, larg, tracos) {
        ax.ct.save();
        ax.ct.strokeStyle = cor; ax.ct.lineWidth = larg;
        if (tracos) ax.ct.setLineDash(tracos);
        ax.ct.beginPath();
        var primeiro = true;
        for (var i = 0; i <= 600; i++) {
          var m = m0 + (m1 - m0) * i / 600, h = campo(m, r);
          if (!isFinite(h) || h < -hmax || h > hmax) { primeiro = true; continue; }
          if (primeiro) { ax.ct.moveTo(ax.X(h), ax.Y(m)); primeiro = false; }
          else ax.ct.lineTo(ax.X(h), ax.Y(m));
        }
        ax.ct.stroke();
        ax.ct.restore();
      }

      if (est.vista === 'iso' || r >= 1) {
        tracar(-0.9999, 0.9999, G.COR.suave, 1.6, [4, 4]);
      }
      if (r < 1) {
        /* os dois ramos estáveis mais os trechos metaestáveis */
        tracar(me, 0.9999, G.COR.vinho, 3);
        tracar(-0.9999, -me, G.COR.vinho, 3);
        if (est.vista === 'iso') {
          tracar(-me, me, G.COR.ambar, 2.6, [6, 4]);
        }
        /* as setas do laço: subindo pelo ramo de baixo e caindo no coercivo */
        if (est.vista === 'laco') {
          ax.ct.save();
          ax.ct.strokeStyle = G.COR.azul; ax.ct.lineWidth = 2;
          [1, -1].forEach(function (s) {
            ax.ct.beginPath();
            ax.ct.moveTo(ax.X(s * hc), ax.Y(-s * me));
            ax.ct.lineTo(ax.X(s * hc), ax.Y(s * 0.999));
            ax.ct.stroke();
            ax.ct.beginPath();
            ax.ct.moveTo(ax.X(s * hc), ax.Y(s * 0.86));
            ax.ct.lineTo(ax.X(s * hc) - 5, ax.Y(s * 0.86) + s * 9);
            ax.ct.lineTo(ax.X(s * hc) + 5, ax.Y(s * 0.86) + s * 9);
            ax.ct.closePath();
            ax.ct.fillStyle = G.COR.azul; ax.ct.fill();
          });
          ax.ct.restore();
        }
        G.vertical(ax, 0, G.COR.grade, '', false);
        ax.ct.save();
        ax.ct.fillStyle = G.COR.verde;
        [mr, -mr].forEach(function (s) {
          ax.ct.beginPath();
          ax.ct.arc(ax.X(0), ax.Y(s), 5, 0, 2 * Math.PI);
          ax.ct.fill();
        });
        ax.ct.restore();
      }
      G.legenda(ax, est.vista === 'laco'
        ? [{ cor: G.COR.vinho, texto: 'ramos acessíveis' },
           { cor: G.COR.azul, texto: 'salto no campo coercivo' },
           { cor: G.COR.verde, texto: 'magnetização remanente' }]
        : [{ cor: G.COR.vinho, texto: 'estável e metaestável' },
           { cor: G.COR.ambar, texto: 'instável: dm/dℌ < 0' }]);

      mostrar({
        r: F.fmt(r, 2),
        mr: F.fmt(mr, 4),
        hc: r < 1 ? F.fmt(hc, 4) : '0',
        ins: r < 1 ? '|m| < ' + F.fmt(me, 3) : 'nenhum'
      });

      nota.innerHTML = est.vista === 'laco'
        ? '<p>Invertendo a equação de Weiss obtém-se o campo que sustenta uma dada '
          + 'magnetização, \\(\\mathfrak{H}=\\operatorname{arctgh}(m)-mT_C/T\\). Abaixo de '
          + '\\(T_C\\) essa curva é um <b>S deitado</b>, e um mesmo campo admite três '
          + 'magnetizações.</p>'
          + '<p>Quem já viu o Módulo 7 reconhece a figura: é a mesma estrutura da isoterma '
          + 'de van der Waals abaixo do ponto crítico, com \\(m\\) no lugar de \\(V\\) e '
          + '\\(\\mathfrak{H}\\) no lugar de \\(P\\). E o motivo é o mesmo: uma energia livre '
          + 'com dois mínimos e uma barreira entre eles. O trecho de inclinação negativa é '
          + 'mecanicamente instável, exatamente como o trecho com '
          + '\\(\\partial P/\\partial V>0\\).</p>'
          + '<p>Daí a histerese. Diminuindo o campo a partir de valores altos, o sistema '
          + 'desce pelo ramo de cima e <b>não cai</b> ao passar por zero: fica preso no '
          + 'mínimo metaestável, com a magnetização remanente marcada em verde. Só quando o '
          + 'campo atinge \\(-\\mathfrak{H}_c\\), onde o mínimo metaestável deixa de existir, '
          + 'é que ele salta. Essa memória é o que faz um disco rígido guardar bits, e a '
          + 'área do laço é a energia dissipada a cada ciclo, que é o que aquece o núcleo de '
          + 'um transformador.</p>'
          + '<p>Aumente a temperatura e veja o laço encolher até sumir em \\(T_C\\): acima '
          + 'dali não há dois mínimos, não há barreira e não há memória.</p>'
        : '<p>Aqui está a isoterma inteira, incluindo o trecho que o sistema nunca percorre. '
          + 'O ramo âmbar, entre \\(\\pm\\sqrt{1-T/T_C}\\), tem \\(dm/d\\mathfrak{H}<0\\): '
          + 'aumentar o campo <em>diminuiria</em> a magnetização, o que significa '
          + 'susceptibilidade negativa e instabilidade mecânica. Nenhum estado real mora '
          + 'ali.</p>'
          + '<p>Repare que os dois extremos do S, que delimitam o trecho instável, são '
          + 'exatamente onde os ramos metaestáveis acabam. São o análogo magnético da '
          + 'espinodal de um fluido, e o campo coercivo é a distância do zero até eles.</p>'
          + '<p>Uma diferença honesta em relação ao fluido: na transição líquido-vapor a '
          + 'construção de Maxwell escolhe um patamar, porque as duas fases coexistem no '
          + 'espaço. Aqui, por simetria, o patamar está em \\(\\mathfrak{H}=0\\) e liga '
          + '\\(-m_s\\) a \\(+m_s\\). Um ímã real resolve isso formando <b>domínios</b>, '
          + 'regiões de magnetização oposta separadas por paredes, e é por isso que um '
          + 'pedaço de ferro virgem não atrai nada apesar de estar ordenado internamente.</p>';
      tipografar(nota);
    }

    registrarRedesenho(desenhar);
    tipografar(corpo);
  };

  /* =================================================================
     35. O modelo de Ising por Metropolis
     Rede quadrada com condições periódicas. ΔE = 2J s_i Σ_viz s_j, e
     aceita-se o giro com probabilidade min(1, e^{−ΔE/kT}). Em duas
     dimensões a solução exata de Onsager dá kT_C/J = 2/ln(1+√2).
     ================================================================= */
  REGISTRO.ising = function (raiz) {
    var corpo = moldura(raiz, 'O modelo de Ising: a transição acontecendo');

    var TC = 2 / Math.log(1 + Math.SQRT2);      // 2,269185…
    var L = 64, N = L * L;
    var s = new Int8Array(N);
    var est = { T: 2.0, h: 0, rodando: true, vista: 'rede' };
    var hist = [];                              // magnetização ao longo do tempo
    var medias = {};                            // |m| médio por temperatura

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    deslizante(ctr, 'temperatura k<sub>B</sub>T/J', 0.6, 4, 0.02, 2.0,
      function (v) { est.T = v; hist = []; },
      function (v) { return F.fmt(v, 2); });
    deslizante(ctr, 'campo h/J', -0.3, 0.3, 0.01, 0,
      function (v) { est.h = v; hist = []; },
      function (v) { return F.fmt(v, 2); });

    var bot = el('div', { class: 'botoes' });
    var bPausa = el('button', { type: 'button', texto: 'pausar' });
    var bFrio = el('button', { type: 'button', class: 'sec', texto: 'alinhar tudo' });
    var bQuente = el('button', { type: 'button', class: 'sec', texto: 'sortear tudo' });
    bPausa.addEventListener('click', function () {
      est.rodando = !est.rodando;
      bPausa.textContent = est.rodando ? 'pausar' : 'continuar';
    });
    bFrio.addEventListener('click', function () { s.fill(1); hist = []; });
    bQuente.addEventListener('click', function () {
      for (var i = 0; i < N; i++) s[i] = Math.random() < 0.5 ? 1 : -1;
      hist = [];
    });
    bot.appendChild(bPausa); bot.appendChild(bFrio); bot.appendChild(bQuente);
    ctr.appendChild(bot);

    var mostrar = cartoes(corpo, [
      { rot: 'k<sub>B</sub>T/J', k: 'T' },
      { rot: 'T<sub>C</sub> de Onsager', k: 'tc' },
      { rot: 'magnetização |m|', k: 'm' },
      { rot: 'energia por sítio', k: 'e' },
      { rot: 'taxa de aceitação', k: 'ac' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    /* Parte alinhado: a 2,0, logo abaixo de T_C, uma rede sorteada leva
       muitas varreduras para ordenar e costuma travar num estado de duas
       faixas com m ≈ 0, que é verdadeiro mas não é o equilíbrio. O botão
       "sortear tudo" permite ver justamente esse resfriamento brusco. */
    s.fill(1);

    var aceitos = 0, tentados = 0;

    /* Uma varredura é N tentativas de giro. O vizinho se acha por
       aritmética de módulo, que é a condição periódica de contorno. */
    function varredura() {
      var T = est.T, h = est.h;
      /* tabela dos cinco ΔE possíveis em campo nulo, para não chamar
         Math.exp N vezes por varredura */
      for (var k = 0; k < N; k++) {
        var i = (Math.random() * N) | 0;
        var x = i % L, y = (i / L) | 0;
        var viz = s[((x + 1) % L) + y * L] + s[((x + L - 1) % L) + y * L]
                + s[x + ((y + 1) % L) * L] + s[x + ((y + L - 1) % L) * L];
        var dE = 2 * s[i] * viz + 2 * h * s[i];
        tentados++;
        if (dE <= 0 || Math.random() < Math.exp(-dE / T)) {
          s[i] = -s[i];
          aceitos++;
        }
      }
    }

    function medir() {
      var m = 0, e = 0;
      for (var i = 0; i < N; i++) {
        m += s[i];
        var x = i % L, y = (i / L) | 0;
        /* só dois vizinhos por sítio, para não contar cada ligação duas vezes */
        e -= s[i] * (s[((x + 1) % L) + y * L] + s[x + ((y + 1) % L) * L]);
      }
      return { m: m / N, e: (e - est.h * m) / N };
    }

    function desenhar(med) {
      if (est.vista === 'rede') {
        /* Lado a lado em tela larga; em tela estreita a série temporal
           desce para baixo da rede, em vez de desaparecer. */
        var p = G.preparar(cv, 340);
        var largo = p.L > 640;
        if (!largo) p = G.preparar(cv, 500);
        var ct = p.ct, Lp = p.L, A = p.A;
        var lado = largo ? Math.min(A - 30, Lp * 0.52)
                         : Math.min(Lp - 24, A * 0.60);
        var ox = largo ? (Lp - lado) / 2 - Lp * 0.17 : (Lp - lado) / 2;
        var oy = largo ? (A - lado) / 2 : 6;
        var img = ct.createImageData(L, L);
        for (var i = 0; i < N; i++) {
          var c = s[i] > 0 ? [140, 47, 57] : [237, 240, 243];
          img.data[4 * i] = c[0]; img.data[4 * i + 1] = c[1];
          img.data[4 * i + 2] = c[2]; img.data[4 * i + 3] = 255;
        }
        /* o ImageData vai para um canvas auxiliar e de lá é ampliado */
        if (!desenhar.aux) {
          desenhar.aux = document.createElement('canvas');
          desenhar.aux.width = L; desenhar.aux.height = L;
        }
        desenhar.aux.getContext('2d').putImageData(img, 0, 0);
        ct.imageSmoothingEnabled = false;
        ct.drawImage(desenhar.aux, ox, oy, lado, lado);
        ct.strokeStyle = G.COR.suave; ct.lineWidth = 1;
        ct.strokeRect(ox + 0.5, oy + 0.5, lado - 1, lado - 1);
        ct.font = '11px system-ui, sans-serif';
        ct.fillStyle = G.COR.suave;
        ct.textAlign = 'center'; ct.textBaseline = 'top';
        ct.fillText(L + ' × ' + L + ' spins, contorno periódico',
                    ox + lado / 2, oy + lado + 8);
        /* a série temporal da magnetização, ao lado ou abaixo */
        {
          var gx0 = largo ? ox + lado + 34 : 16;
          var gx1 = largo ? Lp - 16 : Lp - 16;
          var gy0 = largo ? oy + 10 : oy + lado + 48;
          var gy1 = largo ? oy + lado - 10 : A - 16;
          ct.strokeStyle = G.COR.grade; ct.lineWidth = 1;
          ct.beginPath();
          ct.moveTo(gx0, (gy0 + gy1) / 2); ct.lineTo(gx1, (gy0 + gy1) / 2);
          ct.stroke();
          ct.strokeRect(gx0 + 0.5, gy0 + 0.5, gx1 - gx0 - 1, gy1 - gy0 - 1);
          ct.strokeStyle = G.COR.azul; ct.lineWidth = 1.6;
          ct.beginPath();
          hist.forEach(function (v, k) {
            var X = gx0 + (gx1 - gx0) * k / 300;
            var Y = (gy0 + gy1) / 2 - v * (gy1 - gy0) / 2;
            if (k === 0) ct.moveTo(X, Y); else ct.lineTo(X, Y);
          });
          ct.stroke();
          ct.fillStyle = G.COR.suave;
          ct.textAlign = 'center'; ct.textBaseline = 'bottom';
          ct.fillText('magnetização m, entre −1 e +1', (gx0 + gx1) / 2, gy0 - 4);
        }
      } else {
        /* |m| medido contra T, acumulado, com a curva exata de Onsager */
        var ax = G.eixos(cv, {
          xmin: 0.6, xmax: 4, ymin: 0, ymax: 1.05, altura: 310,
          rotX: 'kₒT/J', rotY: 'magnetização |m|',
          marcasX: G.marcasLineares(0.6, 4, 7, 1),
          formataY: function (v) { return F.fmt(v, 1); }
        });
        /* Onsager: m = [1 − senh⁻⁴(2J/kT)]^{1/8} abaixo de T_C */
        G.curva(ax, function (T) {
          if (T >= TC) return 0;
          var sh = Math.sinh(2 / T);
          var y = 1 - 1 / Math.pow(sh, 4);
          return y <= 0 ? 0 : Math.pow(y, 0.125);
        }, G.COR.vinho, 2.8);
        G.vertical(ax, TC, G.COR.tinta, 'T_C = 2,269', true);
        ax.ct.save();
        ax.ct.fillStyle = G.COR.azul;
        Object.keys(medias).forEach(function (k) {
          var d = medias[k];
          if (d.n < 8) return;
          ax.ct.beginPath();
          ax.ct.arc(ax.X(Number(k)), ax.Y(d.s / d.n), 3.4, 0, 2 * Math.PI);
          ax.ct.fill();
        });
        ax.ct.restore();
        G.legenda(ax, [
          { cor: G.COR.vinho, texto: 'exata (Onsager, 1944)' },
          { cor: G.COR.azul, texto: 'medido nesta simulação' }
        ]);
      }
    }

    var ctr2 = el('div', { class: 'controles' });
    corpo.insertBefore(ctr2, cv);
    opcoes(ctr2, [
      { rot: 'A rede', v: 'rede' },
      { rot: 'Magnetização contra temperatura', v: 'curva' }
    ], 0, function (v) { est.vista = v; });

    var passo = 0;
    function quadro() {
      if (est.rodando) {
        for (var q = 0; q < 3; q++) { varredura(); passo++; }
        var med = medir();
        hist.push(med.m);
        if (hist.length > 301) hist.shift();
        /* a média só começa a acumular depois de o sistema esquecer o
           estado inicial, e por isso espera trinta varreduras */
        if (passo > 90) {
          var ch = F.fmt(est.T, 2).replace(',', '.');
          if (!medias[ch]) medias[ch] = { s: 0, n: 0 };
          medias[ch].s += Math.abs(med.m);
          medias[ch].n++;
        }
        desenhar(med);
        mostrar({
          T: F.fmt(est.T, 3),
          tc: F.fmt(TC, 4),
          m: F.fmt(Math.abs(med.m), 4),
          e: F.fmt(med.e, 4),
          ac: F.pct(tentados ? aceitos / tentados : 0, 1)
        });
        if (tentados > 40 * N) { aceitos = 0; tentados = 0; }
      }
      requestAnimationFrame(quadro);
    }

    nota.innerHTML =
      '<p>A regra é a de Metropolis, e cabe em duas linhas. Sorteia-se um sítio, calcula-se '
      + 'o custo de girá-lo, \\(\\Delta E=2Js_i\\sum_{\\rm viz}s_j\\), e aceita-se o giro com '
      + 'probabilidade \\(\\min\\left(1,e^{-\\Delta E/\\kB T}\\right)\\): sempre, se o giro '
      + 'baixa a energia; com a probabilidade de Boltzmann, se a sobe.</p>'
      + '<p>Por que isso funciona é a parte bonita. A regra satisfaz o <b>balanço '
      + 'detalhado</b>, \\(\\wp(A)W(A\\to B)=\\wp(B)W(B\\to A)\\), com \\(\\wp\\) a '
      + 'distribuição de Boltzmann. Qualquer cadeia que obedeça a isso e consiga alcançar '
      + 'todos os estados converge para \\(\\wp\\), independentemente de onde comece. Não se '
      + 'está resolvendo nada: está-se construindo um processo aleatório cujo estado '
      + 'estacionário é a resposta.</p>'
      + '<p>Olhe a rede nas três faixas. Bem abaixo de \\(T_C=2{,}269\\), domínios grandes e '
      + 'contornos quase lisos. Bem acima, ruído sem estrutura. <b>Em \\(T_C\\)</b>, '
      + 'manchas de todos os tamanhos ao mesmo tempo, aninhadas umas nas outras: o '
      + 'comprimento de correlação divergiu e o sistema perdeu a escala. É a invariância de '
      + 'escala, e é o que faz expoentes críticos de sistemas completamente diferentes '
      + 'coincidirem.</p>'
      + '<p>Repare também na magnetização ao lado: perto de \\(T_C\\) ela faz excursões '
      + 'enormes e lentas, porque as flutuações críticas custam quase nada em energia. E se '
      + 'esperar bastante numa rede finita em campo nulo, o sistema inteiro acaba virando de '
      + 'sinal, o que é certo: num sistema finito a simetria nunca é quebrada de verdade, '
      + 'só demora exponencialmente para ser restaurada.</p>';
    tipografar(corpo);
    requestAnimationFrame(quadro);
    window.addEventListener('resize', function () { desenhar(medir()); });
  };

  /* =================================================================
     36. Ginzburg-Landau dependente do tempo
     ∂ψ/∂t = −δℱ/δψ = −aψ − bψ³ + γ∇²ψ. Com a < 0 o sistema escolhe
     ±√(−a/b) em cada região e depois as fronteiras se engolem: é o
     engrossamento de domínios, com ℓ(t) ∝ √t.
     ================================================================= */
  REGISTRO.ginzburg = function (raiz) {
    var corpo = moldura(raiz, 'Ginzburg-Landau: como os domínios engrossam');

    var L = 96, N = L * L;
    var psi = new Float64Array(N), novo = new Float64Array(N);
    var est = { a: -1, gama: 1.2, rodando: true, t: 0 };
    var serie = [];

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    deslizante(ctr, 'a  (∝ T − T_C)', -1.5, 0.6, 0.05, -1,
      function (v) { est.a = v; },
      function (v) { return F.fmt(v, 2); });
    deslizante(ctr, 'rigidez γ', 0.3, 3, 0.1, 1.2,
      function (v) { est.gama = v; },
      function (v) { return F.fmt(v, 1); });

    var bot = el('div', { class: 'botoes' });
    var bPausa = el('button', { type: 'button', texto: 'pausar' });
    var bZerar = el('button', { type: 'button', class: 'sec', texto: 'reiniciar' });
    bPausa.addEventListener('click', function () {
      est.rodando = !est.rodando;
      bPausa.textContent = est.rodando ? 'pausar' : 'continuar';
    });
    bZerar.addEventListener('click', reiniciar);
    bot.appendChild(bPausa); bot.appendChild(bZerar);
    ctr.appendChild(bot);

    var mostrar = cartoes(corpo, [
      { rot: 'a', k: 'a' },
      { rot: 'fase', k: 'fase' },
      { rot: '±√(−a/b) previsto', k: 'eq' },
      { rot: '|ψ| médio', k: 'md' },
      { rot: 'tamanho típico ℓ', k: 'l' },
      { rot: 'tempo', k: 't' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    function reiniciar() {
      for (var i = 0; i < N; i++) psi[i] = 0.02 * (Math.random() - 0.5);
      est.t = 0; serie = [];
    }
    reiniciar();

    /* Euler explícito no laplaciano de cinco pontos, com contorno periódico.
       dt tem de respeitar dt < h²/(4γ) para não explodir, e aqui h = 1. */
    function passo() {
      var a = est.a, g = est.gama;
      var dt = Math.min(0.05, 0.2 / g);
      for (var y = 0; y < L; y++) {
        var ym = ((y + L - 1) % L) * L, yp = ((y + 1) % L) * L, y0 = y * L;
        for (var x = 0; x < L; x++) {
          var i = y0 + x;
          var lap = psi[y0 + ((x + 1) % L)] + psi[y0 + ((x + L - 1) % L)]
                  + psi[yp + x] + psi[ym + x] - 4 * psi[i];
          var p = psi[i];
          novo[i] = p + dt * (-a * p - p * p * p + g * lap);
        }
      }
      psi.set(novo);
      est.t += dt;
    }

    /* o tamanho típico sai da fração de ligações entre vizinhos de sinal
       oposto: quanto menos paredes, maiores os domínios */
    function medidas() {
      var soma = 0, paredes = 0;
      for (var y = 0; y < L; y++) {
        for (var x = 0; x < L; x++) {
          var i = y * L + x;
          soma += Math.abs(psi[i]);
          if (psi[i] * psi[y * L + ((x + 1) % L)] < 0) paredes++;
          if (psi[i] * psi[((y + 1) % L) * L + x] < 0) paredes++;
        }
      }
      return { md: soma / N, l: paredes > 0 ? 2 * N / paredes : N };
    }

    function desenhar() {
      var p = G.preparar(cv, 340);
      var largo = p.L > 640;
      if (!largo) p = G.preparar(cv, 500);
      var ct = p.ct, Lp = p.L, A = p.A;
      var lado = largo ? Math.min(A - 30, Lp * 0.52)
                       : Math.min(Lp - 24, A * 0.60);
      var ox = largo ? (Lp - lado) / 2 - Lp * 0.17 : (Lp - lado) / 2;
      var oy = largo ? (A - lado) / 2 : 6;
      if (!desenhar.aux) {
        desenhar.aux = document.createElement('canvas');
        desenhar.aux.width = L; desenhar.aux.height = L;
      }
      var img = desenhar.aux.getContext('2d').createImageData(L, L);
      var esc = Math.max(0.05, Math.sqrt(Math.max(0, -est.a)));
      for (var i = 0; i < N; i++) {
        /* vinho para ψ > 0, azul para ψ < 0, pálido onde ψ ≈ 0 */
        var u = Math.max(-1, Math.min(1, psi[i] / esc));
        var t = (u + 1) / 2;
        img.data[4 * i] = Math.round(44 + t * (140 - 44));
        img.data[4 * i + 1] = Math.round(95 + t * (47 - 95));
        img.data[4 * i + 2] = Math.round(141 + t * (57 - 141));
        img.data[4 * i + 3] = 255;
      }
      desenhar.aux.getContext('2d').putImageData(img, 0, 0);
      ct.imageSmoothingEnabled = false;
      ct.drawImage(desenhar.aux, ox, oy, lado, lado);
      ct.strokeStyle = G.COR.suave; ct.lineWidth = 1;
      ct.strokeRect(ox + 0.5, oy + 0.5, lado - 1, lado - 1);
      ct.font = '11px system-ui, sans-serif';
      ct.fillStyle = G.COR.suave;
      ct.textAlign = 'center'; ct.textBaseline = 'top';
      ct.fillText('ψ > 0 em vinho, ψ < 0 em azul', ox + lado / 2, oy + lado + 8);

      /* ℓ(t) em escala log-log, onde a lei √t é uma reta de inclinação 1/2 */
      if (serie.length > 3) {
        var gx0 = largo ? ox + lado + 34 : 16;
        var gx1 = Lp - 16;
        var gy0 = largo ? oy + 16 : oy + lado + 50;
        var gy1 = largo ? oy + lado - 10 : A - 16;
        ct.strokeStyle = G.COR.grade; ct.lineWidth = 1;
        ct.strokeRect(gx0 + 0.5, gy0 + 0.5, gx1 - gx0 - 1, gy1 - gy0 - 1);
        var teto = L / 3;
        var lx = function (v) { return gx0 + (gx1 - gx0) * (Math.log10(v) + 1) / 3.4; };
        var ly = function (v) {
          return gy1 - (gy1 - gy0) * Math.log10(v) / Math.log10(2 * teto);
        };
        /* a reta de referência passa por um ponto medido cedo, e não por um
           ponto inventado: assim o que se compara é só a inclinação */
        var anc = null;
        for (var q = 0; q < serie.length; q++) {
          if (serie[q].t > 2) { anc = serie[q]; break; }
        }
        if (anc) {
          ct.strokeStyle = G.COR.ambar; ct.lineWidth = 1.6;
          ct.setLineDash([5, 4]);
          ct.beginPath();
          ct.moveTo(lx(anc.t), ly(anc.l));
          ct.lineTo(lx(600), ly(anc.l * Math.sqrt(600 / anc.t)));
          ct.stroke();
          ct.setLineDash([]);
        }
        /* o limite da caixa: passado ele, não há mais o que engrossar */
        ct.strokeStyle = G.COR.suave; ct.lineWidth = 1;
        ct.beginPath();
        ct.moveTo(gx0, ly(teto)); ct.lineTo(gx1, ly(teto)); ct.stroke();
        ct.fillStyle = G.COR.suave;
        ct.font = '10px system-ui, sans-serif';
        ct.textAlign = 'left'; ct.textBaseline = 'bottom';
        ct.fillText('limite da caixa', gx0 + 4, ly(teto) - 2);
        ct.strokeStyle = G.COR.vinho; ct.lineWidth = 2;
        ct.beginPath();
        var primeiro = true;
        serie.forEach(function (d) {
          if (d.t <= 0.1 || d.l <= 0 || d.l > 2 * teto) { primeiro = true; return; }
          var X = lx(d.t), Y = ly(d.l);
          if (primeiro) { ct.moveTo(X, Y); primeiro = false; } else ct.lineTo(X, Y);
        });
        ct.stroke();
        ct.fillStyle = G.COR.suave;
        ct.textAlign = 'center'; ct.textBaseline = 'bottom';
        ct.fillText('ℓ contra t, escala log; tracejado: √t',
                    (gx0 + gx1) / 2, gy0 - 4);
      }
    }

    function quadro() {
      if (est.rodando) {
        for (var k = 0; k < 4; k++) passo();
        var m = medidas();
        serie.push({ t: est.t, l: m.l });
        if (serie.length > 2000) serie.shift();
        desenhar();
        mostrar({
          a: F.fmt(est.a, 2),
          fase: est.a < 0 ? 'ordenada (T < T_C)' : 'desordenada (T > T_C)',
          eq: est.a < 0 ? '±' + F.fmt(Math.sqrt(-est.a), 3) : '0',
          md: F.fmt(m.md, 4),
          l: F.fmt(m.l, 2),
          t: F.fmt(est.t, 1)
        });
      }
      requestAnimationFrame(quadro);
    }

    nota.innerHTML =
      '<p>Landau descreve o equilíbrio. Ginzburg e Landau acrescentam duas coisas: deixam o '
      + 'parâmetro de ordem <b>variar no espaço</b>, \\(\\psi(\\vec r)\\), e cobram por essa '
      + 'variação um termo \\(\\frac\\gamma2\\left|\\nabla\\psi\\right|^2\\) na energia '
      + 'livre. Esse termo é o que dá <b>rigidez</b>: criar uma parede entre duas regiões de '
      + 'sinal oposto custa energia.</p>'
      + '<p>A dinâmica mais simples compatível com isso é a relaxacional, em que o sistema '
      + 'desce o gradiente da energia livre:</p>'
      + '<p>\\[\\frac{\\partial\\psi}{\\partial t}=-\\frac{\\delta\\mathcal F}{\\delta\\psi}'
      + '=-a\\psi-b\\psi^3+\\gamma\\nabla^2\\psi.\\]</p>'
      + '<p>Comece com ruído e veja o que acontece quando \\(a<0\\). Primeiro, em toda parte '
      + 'ao mesmo tempo, \\(\\psi\\) foge de zero e se instala em \\(\\pm\\sqrt{-a/b}\\), '
      + 'escolhendo o sinal ao acaso conforme o ruído local. Isso é rápido. Depois vem a '
      + 'parte lenta: as paredes entre domínios custam energia, e o sistema se livra delas '
      + 'engolindo os domínios pequenos. O tamanho típico cresce como '
      + '\\(\\ell\\sim\\sqrt{\\gamma t}\\), que é a reta tracejada no gráfico ao lado.</p>'
      + '<p>Ponha \\(a>0\\) e tudo decai para zero: acima de \\(T_C\\) não há o que ordenar. '
      + 'Aumente \\(\\gamma\\) e as paredes ficam caras e grossas, e os domínios nascem '
      + 'maiores.</p>'
      + '<p>A mesma equação, com \\(\\psi\\) complexo, descreve supercondutores e '
      + 'superfluidos, e nesses casos a fase de \\(\\psi\\) carrega a supercorrente e os '
      + 'defeitos topológicos viram vórtices quantizados. Nada aqui é específico de '
      + 'magnetismo: é a física de qualquer parâmetro de ordem que tenha de escolher entre '
      + 'estados equivalentes.</p>';
    tipografar(corpo);
    requestAnimationFrame(quadro);
    window.addEventListener('resize', desenhar);
  };

  /* ---------- inicialização ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    Array.prototype.forEach.call(document.querySelectorAll('[data-widget]'), function (n) {
      var f = REGISTRO[n.getAttribute('data-widget')];
      if (f) {
        try { f(n); }
        catch (e) {
          n.innerHTML = '<div class="saida">Não foi possível carregar este componente.</div>';
          if (window.console) console.error(e);
        }
      }
    });
  });
})();
