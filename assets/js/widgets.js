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
    var corpo = moldura(raiz, 'De onde vem a pressão: impulso nas paredes');

    var est = { N: 120, T: 1, rodando: true };
    var part = [], impulso = 0, tempo = 0, NB = 22, hist = new Array(NB).fill(0);

    var cv = el('canvas');
    corpo.appendChild(cv);
    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);

    deslizante(ctr, 'número de partículas \\(N\\)', 20, 400, 10, 120,
      function (v) { est.N = v; reiniciar(); });
    deslizante(ctr, 'temperatura \\(T\\) (unidades de \\(\\kB\\))', 0.2, 3, 0.1, 1,
      function (v) { est.T = v; reiniciar(); },
      function (v) { return v.toFixed(1).replace('.', ','); });

    var bot = el('div', { class: 'botoes' });
    var bPausa = el('button', { type: 'button', texto: 'pausar' });
    var bZerar = el('button', { type: 'button', texto: 'reiniciar' });
    bPausa.addEventListener('click', function () {
      est.rodando = !est.rodando;
      bPausa.textContent = est.rodando ? 'pausar' : 'continuar';
    });
    bZerar.addEventListener('click', reiniciar);
    bot.appendChild(bPausa); bot.appendChild(bZerar);
    ctr.appendChild(bot);

    var mostrar = cartoes(corpo, [
      { rot: 'P medida', k: 'pm' },
      { rot: 'Nm⟨v<sub>x</sub>²⟩/A desta amostra', k: 'pa' },
      { rot: 'Nk<sub>B</sub>T/A no limite N→∞', k: 'pt' },
      { rot: 'diferença para o limite', k: 'err' }
    ]);
    var nota = el('div', { class: 'saida', html:
      '<p>A parede direita registra cada choque. Num choque elástico a partícula devolve '
      + 'momento \\(2m|v_x|\\); somando esses impulsos e dividindo pelo tempo e pelo '
      + 'comprimento da parede obtém-se a pressão. Ela converge para \\(N\\kB T/A\\) '
      + 'sem que nada disso tenha sido imposto: a lei dos gases ideais é consequência '
      + 'dos choques, não um postulado.</p><p>Repare que a pressão medida acompanha de perto '
      + '\\(Nm\\med{v_x^2}/A\\) desta amostra, e não exatamente \\(N\\kB T/A\\). A diferença é '
      + 'a flutuação estatística de uma amostra com poucas centenas de partículas: ela cai '
      + 'como \\(1/\\sqrt{N}\\). Aumente \\(N\\) e veja encolher. Num gás real, com '
      + '\\(N\\sim 10^{23}\\), essa flutuação é de uma parte em \\(10^{11}\\), e é por isso '
      + 'que a termodinâmica pode tratar a pressão como um número exato.' });
    corpo.appendChild(nota);

    function reiniciar() {
      part = [];
      for (var i = 0; i < est.N; i++) {
        part.push({
          x: Math.random() * 0.96 + 0.02,
          y: Math.random() * 0.96 + 0.02,
          vx: F.normalAleatoria() * Math.sqrt(est.T),
          vy: F.normalAleatoria() * Math.sqrt(est.T)
        });
      }
      impulso = 0; tempo = 0; hist = new Array(NB).fill(0);
    }

    function passo(dt) {
      for (var i = 0; i < part.length; i++) {
        var p = part[i];
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.x < 0) { p.x = -p.x; p.vx = -p.vx; }
        if (p.x > 1) { impulso += 2 * Math.abs(p.vx); p.x = 2 - p.x; p.vx = -p.vx; }
        if (p.y < 0) { p.y = -p.y; p.vy = -p.vy; }
        if (p.y > 1) { p.y = 2 - p.y; p.vy = -p.vy; }
      }
      tempo += dt;
      var vmax = 3.6 * Math.sqrt(est.T);
      for (i = 0; i < part.length; i++) {
        var b = Math.floor(Math.hypot(part[i].vx, part[i].vy) / vmax * NB);
        if (b >= 0 && b < NB) hist[b]++;
      }
    }

    function desenhar() {
      var p = G.preparar(cv, 300);
      var ct = p.ct;
      var lado = Math.min(p.L * 0.46, p.A - 34);
      var x0 = 12, y0 = 8;

      ct.save();
      ct.strokeStyle = G.COR.tinta; ct.lineWidth = 1.2;
      ct.strokeRect(x0, y0, lado, lado);
      ct.strokeStyle = G.COR.vinho; ct.lineWidth = 3;
      ct.beginPath(); ct.moveTo(x0 + lado, y0); ct.lineTo(x0 + lado, y0 + lado); ct.stroke();
      ct.fillStyle = G.COR.azul;
      part.forEach(function (q) {
        ct.beginPath();
        ct.arc(x0 + q.x * lado, y0 + (1 - q.y) * lado, 1.9, 0, 2 * Math.PI);
        ct.fill();
      });
      ct.restore();

      // histograma das velocidades contra a Maxwell bidimensional
      var gx = x0 + lado + 34, gl = p.L - gx - 14, ga = lado;
      if (gl > 90) {
        var vmax = 3.6 * Math.sqrt(est.T), nb = NB;
        var h = hist, soma = 0, k;
        for (k = 0; k < nb; k++) soma += h[k];
        var hmax = 0;
        var hn = h.map(function (c) {
          var y = soma ? c / soma * est.N : 0;
          if (y > hmax) hmax = y;
          return y;
        });
        hmax = hmax || 1;
        // Maxwell em 2D: f(v) = (m v /kT) exp(-m v²/2kT)
        var teo = [], tmax = 0, i;
        for (i = 0; i < nb; i++) {
          var v0 = (i + 0.5) / nb * vmax;
          var ft = (v0 / est.T) * Math.exp(-v0 * v0 / (2 * est.T)) * (vmax / nb) * est.N;
          teo.push(ft); if (ft > tmax) tmax = ft;
        }
        var esc = Math.max(hmax, tmax);
        ct.save();
        ct.fillStyle = G.COR.azulClaro;
        for (i = 0; i < nb; i++) {
          var altura = hn[i] / esc * ga;
          ct.fillRect(gx + i * gl / nb, y0 + ga - altura, gl / nb - 1, altura);
        }
        ct.strokeStyle = G.COR.vinho; ct.lineWidth = 2;
        ct.beginPath();
        for (i = 0; i < nb; i++) {
          var X = gx + (i + 0.5) * gl / nb, Y = y0 + ga - teo[i] / esc * ga;
          if (i) ct.lineTo(X, Y); else ct.moveTo(X, Y);
        }
        ct.stroke();
        ct.fillStyle = G.COR.suave;
        ct.font = '11px system-ui, sans-serif';
        ct.textAlign = 'center';
        ct.fillText('módulo da velocidade', gx + gl / 2, y0 + ga + 16);
        ct.textAlign = 'left';
        ct.fillStyle = G.COR.vinho;
        ct.fillText('Maxwell 2D', gx + 4, y0 + 12);
        ct.restore();
      }

      var vx2 = 0;
      part.forEach(function (q) { vx2 += q.vx * q.vx; });
      vx2 /= (part.length || 1);
      var pm = tempo > 0 ? impulso / tempo : 0;   // parede de comprimento 1
      var pa = est.N * vx2;                        // previsão para ESTA amostra
      var pt = est.N * est.T;                      // limite termodinâmico, área 1
      mostrar({
        pm: F.fmt(pm, 2), pa: F.fmt(pa, 2), pt: F.fmt(pt, 2),
        err: tempo > 0 ? F.pct((pm - pt) / pt, 1) : '·'
      });
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
    requestAnimationFrame(quadro);
    window.addEventListener('resize', desenhar);
    tipografar(corpo);
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
