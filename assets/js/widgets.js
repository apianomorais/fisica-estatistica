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
