// Menú móvil
document.addEventListener('DOMContentLoaded', function () {
  var toggle = document.querySelector('.nav__toggle');
  var links = document.querySelector('.nav__links');
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      links.classList.toggle('open');
    });
    links.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { links.classList.remove('open'); });
    });
  }
  // Año dinámico en el footer
  var y = document.querySelectorAll('.js-year');
  y.forEach(function (el) { el.textContent = new Date().getFullYear(); });

  // Arranca el cotizador conversacional
  AlfaCotizador.init();
});

/* =========================================================
   AlfaCotizador — Chatbot / asistente de cotización (ES/EN)
   ---------------------------------------------------------
   • Detecta el idioma del documento (<html lang>): 'es' o 'en'.
   • Preguntas UNA POR UNA, con validación y opción de corregir.
   • Cada respuesta se guarda NORMALIZADA (clave estable) para
     poder analizarla después (no texto libre cuando se puede).
   • Al terminar: resumen + "Enviar por WhatsApp".
   • Sin backend: guarda en localStorage y deja un HOOK listo
     para conectar Google Sheets / Airtable (ver CONNECTOR).
   ========================================================= */
var AlfaCotizador = (function () {
  'use strict';

  /* --- Configuración de contacto y conector de datos --------------- */
  var WHATSAPP = '526691160439'; // número destino (sin +, formato wa.me)

  // HOOK DE ANÁLISIS (opcional). Cada cotización se guarda SIEMPRE en
  // localStorage; si configuras CONNECTOR, además se envía a un destino
  // externo (Google Sheets o Airtable). Deja tipo:'' para solo localStorage.
  var CONNECTOR = {
    tipo: '',                 // '' | 'sheets' | 'airtable'
    url: '',                  // (sheets) URL del Web App de Apps Script
    airtable: {
      base: '',               // (airtable) ID de la base, ej. 'appXXXXXXXX'
      tabla: 'Cotizaciones',  // (airtable) nombre o ID de la tabla
      token: ''               // (airtable) Personal Access Token
    }
  };

  /* --- Idioma de la página ----------------------------------------- */
  var LANG = (document.documentElement.getAttribute('lang') || 'es')
    .toLowerCase().indexOf('en') === 0 ? 'en' : 'es';

  var HOY = new Date().toISOString().slice(0, 10);

  /* =================== Utilidades de normalización ================= */

  // "guadalajara , jal" -> "Guadalajara" (Title Case, sin estado)
  function tituloCiudad(str) {
    return String(str).split(',')[0].trim().toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/(^|\s|-)([a-záéíóúñ])/g, function (m, sep, ch) { return sep + ch.toUpperCase(); });
  }

  // Extrae un entero: "42" -> 42 ; "cuarenta y dos" -> 42 (solo ES)
  function parseNumero(str) {
    var s = String(str).toLowerCase().trim();
    var soloDigitos = s.replace(/[^\d]/g, '');
    if (soloDigitos.length) return parseInt(soloDigitos, 10);
    var unid = { cero:0, uno:1, una:1, dos:2, tres:3, cuatro:4, cinco:5, seis:6, siete:7, ocho:8, nueve:9,
      diez:10, once:11, doce:12, trece:13, catorce:14, quince:15, dieciseis:16, dieciséis:16, diecisiete:17,
      dieciocho:18, diecinueve:19, veinte:20, veintiuno:21, veintidos:22, veintidós:22, veintitres:23,
      veintitrés:23, veinticuatro:24, veinticinco:25, veintiseis:26, veintiséis:26, veintisiete:27,
      veintiocho:28, veintinueve:29 };
    var decenas = { treinta:30, cuarenta:40, cincuenta:50, sesenta:60, setenta:70, ochenta:80, noventa:90 };
    if (unid[s] != null) return unid[s];
    if (decenas[s] != null) return decenas[s];
    var partes = s.split(/\s+y\s+|\s+/).filter(Boolean);
    var total = 0, ok = false;
    partes.forEach(function (p) {
      if (decenas[p] != null) { total += decenas[p]; ok = true; }
      else if (unid[p] != null) { total += unid[p]; ok = true; }
      else if (p === 'cien' || p === 'ciento') { total += 100; ok = true; }
    });
    return ok ? total : NaN;
  }

  // Escapa HTML para evitar inyección al pintar texto del usuario
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  // Valor legible para mostrar/enviar según la clave
  function legible(key, val) {
    if (Array.isArray(val)) return val.join(', ');
    return String(val);
  }

  /* =================== Diccionarios de idioma ===================== */
  var I18N = {
    es: {
      SI: 'Sí', NO: 'No', ESPECIAL: 'Viaje especial',
      SERVICIOS: ['Viaje especial', 'Evento', 'Transporte de personal', 'Contrato por tiempo', 'Varios servicios'],
      ETIQUETAS: {
        tipo_servicio: 'Servicio',
        origen: 'Origen', destino: 'Destino', num_personas: 'Personas',
        fecha_salida: 'Fecha de salida', franja_salida: 'Hora de salida',
        fecha_regreso: 'Fecha de regreso', franja_regreso: 'Hora de regreso',
        ruta_multiple: 'Ruta con paradas', num_paradas: 'N.º de paradas',
        paradas: 'Paradas', movimientos_locales: 'Movimientos locales',
        nombre_contacto: 'Nombre', es_organizacion: 'Es organización',
        tipo_organizacion: 'Tipo de organización', organizacion: 'Organización'
      },
      ui: {
        dialogLabel: 'Cotizador de Alfa Tours',
        headTitle: 'Cotiza tu viaje', headSub: 'Alfa Tours · responde en minutos',
        close: 'Cerrar cotizador', openLabel: 'Abrir cotizador',
        greet: '¡Hola! Soy el asistente de Alfa Tours 🚌\n¿Qué tipo de servicio necesitas?',
        needed: 'Este dato es necesario.',
        summaryIntro: '¡Listo! Este es el resumen de tu cotización. Revísalo y envíalo por WhatsApp 👇',
        sendWa: 'Enviar por WhatsApp',
        restart: 'Empezar de nuevo',
        chooseOther: 'Elegir otro servicio',
        continueWa: 'Continuar por WhatsApp',
        edit: 'Editar', fixPrefix: 'Corrijamos: ',
        back: '&larr; Regresar',
        placeholderDefault: 'Escribe tu respuesta…',
        otraDefault: 'Escribe aquí…',
        otraCityErr: 'Escribe la ciudad de origen.',
        directo: function (tipo) { return 'Para ' + tipo.toLowerCase() + ' te atendemos directo por WhatsApp y te preparamos una cotización a la medida. 👇'; },
        directoMsg: function (tipo) { return 'Hola Alfa Tours, me interesa cotizar: ' + tipo + '. ¿Me pueden ayudar?'; }
      },
      PREGUNTAS: [
        { key: 'origen', type: 'options', pregunta: '¿Desde qué ciudad sale el viaje?',
          opciones: ['Mazatlán', 'Concordia', 'El Rosario', 'Villa Unión', 'Otra'],
          otroSi: 'Otra', otroPrompt: 'Escribe la ciudad de origen:' },
        { key: 'destino', type: 'text', pregunta: '¿A qué ciudad quieren viajar? (destino principal)',
          placeholder: 'Ej. Guadalajara', normaliza: tituloCiudad,
          valida: function (v) { return v.trim().length >= 2 ? '' : 'Escribe el nombre de una ciudad.'; } },
        { key: 'num_personas', type: 'number', pregunta: '¿Cuántas personas viajan? (solo el número)',
          placeholder: 'Ej. 42', normaliza: parseNumero,
          valida: function (v) { var n = parseNumero(v); return (Number.isInteger(n) && n > 0 && n <= 1000) ? '' : 'Indica un número válido de personas.'; } },
        { key: 'fecha_salida', type: 'date', pregunta: '¿Qué día es la salida (aproximada)?', min: HOY,
          valida: function (v) { return v ? '' : 'Selecciona una fecha.'; } },
        { key: 'franja_salida', type: 'options', pregunta: '¿A qué hora aproximada salen?',
          opciones: ['Mañana', 'Tarde', 'Noche'] },
        { key: 'fecha_regreso', type: 'date', pregunta: '¿Qué día es el regreso? (puede ser el mismo día)', min: HOY,
          valida: function (v, a) { if (!v) return 'Selecciona una fecha.'; if (a.fecha_salida && v < a.fecha_salida) return 'El regreso no puede ser antes de la salida.'; return ''; } },
        { key: 'franja_regreso', type: 'options', pregunta: '¿A qué hora aproximada regresan?',
          opciones: ['Mañana', 'Tarde', 'Noche'] },
        { key: 'ruta_multiple', type: 'options', pregunta: 'Aparte del destino, ¿visitarán otros lugares en el camino (ruta de varias paradas)?',
          opciones: ['Sí', 'No'] },
        { key: 'num_paradas', type: 'number', pregunta: '¿Cuántas paradas adicionales?', placeholder: 'Ej. 2',
          skipIf: function (a) { return a.ruta_multiple !== 'Sí'; }, normaliza: parseNumero,
          valida: function (v) { var n = parseNumero(v); return (Number.isInteger(n) && n > 0 && n <= 50) ? '' : 'Indica cuántas paradas.'; } },
        { key: 'paradas', type: 'text', pregunta: '¿Cuáles? Sepáralas con comas.', placeholder: 'Ej. Tepic, Guadalajara',
          skipIf: function (a) { return a.ruta_multiple !== 'Sí'; },
          normaliza: function (v) { return v.split(',').map(function (s) { return tituloCiudad(s); }).filter(Boolean); },
          valida: function (v) { return v.trim().length >= 2 ? '' : 'Escribe al menos un lugar.'; } },
        { key: 'movimientos_locales', type: 'options', pregunta: '¿Tendrán movimientos locales dentro de la ciudad de destino?',
          opciones: ['Sí', 'No'] },
        { key: 'nombre_contacto', type: 'text', pregunta: '¿A nombre de quién hacemos la cotización?', placeholder: 'Tu nombre',
          normaliza: function (v) { return v.trim().replace(/\s+/g, ' '); },
          valida: function (v) { return v.trim().length >= 2 ? '' : 'Escribe tu nombre.'; } },
        { key: 'es_organizacion', type: 'options', pregunta: '¿La cotización es de parte de una empresa, club, iglesia, escuela u otra organización?',
          opciones: ['Sí', 'No'] },
        { key: 'tipo_organizacion', type: 'options', pregunta: '¿De qué tipo?',
          opciones: ['Empresa', 'Club', 'Iglesia', 'Escuela', 'Otra'],
          skipIf: function (a) { return a.es_organizacion !== 'Sí'; } },
        { key: 'organizacion', type: 'text', pregunta: '¿Cuál es el nombre de la organización?', placeholder: 'Ej. Colegio San José',
          skipIf: function (a) { return a.es_organizacion !== 'Sí'; },
          normaliza: function (v) { return v.trim().replace(/\s+/g, ' '); },
          valida: function (v) { return v.trim().length >= 2 ? '' : 'Escribe el nombre.'; } }
      ],
      mensaje: function (display, respuestas) {
        var l = [];
        l.push('Hola Alfa Tours, quiero una cotización:');
        l.push('• Servicio: ' + (display.tipo_servicio || 'Viaje especial'));
        l.push('• Origen: ' + display.origen);
        l.push('• Destino: ' + display.destino);
        l.push('• Personas: ' + display.num_personas);
        l.push('• Salida: ' + display.fecha_salida + ' (' + display.franja_salida + ')');
        l.push('• Regreso: ' + display.fecha_regreso + ' (' + display.franja_regreso + ')');
        if (respuestas.ruta_multiple === 'Sí') l.push('• Ruta con paradas: Sí (' + display.num_paradas + '): ' + display.paradas);
        else l.push('• Ruta con paradas: No');
        l.push('• Movimientos locales: ' + display.movimientos_locales);
        l.push('• Nombre: ' + display.nombre_contacto);
        if (respuestas.es_organizacion === 'Sí') l.push('• Organización: ' + display.organizacion + ' (' + display.tipo_organizacion + ')');
        l.push('Gracias.');
        return l.join('\n');
      }
    },

    en: {
      SI: 'Yes', NO: 'No', ESPECIAL: 'Special trip',
      SERVICIOS: ['Special trip', 'Event', 'Staff transportation', 'Time contract', 'Several services'],
      ETIQUETAS: {
        tipo_servicio: 'Service',
        origen: 'Origin', destino: 'Destination', num_personas: 'People',
        fecha_salida: 'Departure date', franja_salida: 'Departure time',
        fecha_regreso: 'Return date', franja_regreso: 'Return time',
        ruta_multiple: 'Multi-stop route', num_paradas: 'No. of stops',
        paradas: 'Stops', movimientos_locales: 'Local movements',
        nombre_contacto: 'Name', es_organizacion: 'Is organization',
        tipo_organizacion: 'Organization type', organizacion: 'Organization'
      },
      ui: {
        dialogLabel: 'Alfa Tours quote assistant',
        headTitle: 'Get a quote', headSub: 'Alfa Tours · replies in minutes',
        close: 'Close quote assistant', openLabel: 'Open quote assistant',
        greet: "Hi! I'm the Alfa Tours assistant 🚌\nWhat type of service do you need?",
        needed: 'This field is required.',
        summaryIntro: "All set! Here's your quote summary. Review it and send it via WhatsApp 👇",
        sendWa: 'Send via WhatsApp',
        restart: 'Start over',
        chooseOther: 'Choose another service',
        continueWa: 'Continue on WhatsApp',
        edit: 'Edit', fixPrefix: "Let's fix it: ",
        back: '&larr; Back',
        placeholderDefault: 'Type your answer…',
        otraDefault: 'Type here…',
        otraCityErr: 'Type the departure city.',
        directo: function (tipo) { return 'For ' + tipo.toLowerCase() + " we'll assist you directly on WhatsApp and prepare a custom quote. 👇"; },
        directoMsg: function (tipo) { return "Hi Alfa Tours, I'd like a quote for: " + tipo + '. Can you help me?'; }
      },
      PREGUNTAS: [
        { key: 'origen', type: 'options', pregunta: 'Which city does the trip depart from?',
          opciones: ['Mazatlán', 'Concordia', 'El Rosario', 'Villa Unión', 'Other'],
          otroSi: 'Other', otroPrompt: 'Type the departure city:' },
        { key: 'destino', type: 'text', pregunta: 'Which city are you traveling to? (main destination)',
          placeholder: 'E.g. Guadalajara', normaliza: tituloCiudad,
          valida: function (v) { return v.trim().length >= 2 ? '' : 'Enter a city name.'; } },
        { key: 'num_personas', type: 'number', pregunta: 'How many people are traveling? (number only)',
          placeholder: 'E.g. 42', normaliza: parseNumero,
          valida: function (v) { var n = parseNumero(v); return (Number.isInteger(n) && n > 0 && n <= 1000) ? '' : 'Enter a valid number of people.'; } },
        { key: 'fecha_salida', type: 'date', pregunta: 'What is the (approximate) departure date?', min: HOY,
          valida: function (v) { return v ? '' : 'Select a date.'; } },
        { key: 'franja_salida', type: 'options', pregunta: 'Around what time do you leave?',
          opciones: ['Morning', 'Afternoon', 'Evening'] },
        { key: 'fecha_regreso', type: 'date', pregunta: 'What is the return date? (can be the same day)', min: HOY,
          valida: function (v, a) { if (!v) return 'Select a date.'; if (a.fecha_salida && v < a.fecha_salida) return 'The return cannot be before departure.'; return ''; } },
        { key: 'franja_regreso', type: 'options', pregunta: 'Around what time do you return?',
          opciones: ['Morning', 'Afternoon', 'Evening'] },
        { key: 'ruta_multiple', type: 'options', pregunta: 'Besides the destination, will you visit other places along the way (multi-stop route)?',
          opciones: ['Yes', 'No'] },
        { key: 'num_paradas', type: 'number', pregunta: 'How many additional stops?', placeholder: 'E.g. 2',
          skipIf: function (a) { return a.ruta_multiple !== 'Yes'; }, normaliza: parseNumero,
          valida: function (v) { var n = parseNumero(v); return (Number.isInteger(n) && n > 0 && n <= 50) ? '' : 'Enter how many stops.'; } },
        { key: 'paradas', type: 'text', pregunta: 'Which ones? Separate them with commas.', placeholder: 'E.g. Tepic, Guadalajara',
          skipIf: function (a) { return a.ruta_multiple !== 'Yes'; },
          normaliza: function (v) { return v.split(',').map(function (s) { return tituloCiudad(s); }).filter(Boolean); },
          valida: function (v) { return v.trim().length >= 2 ? '' : 'Enter at least one place.'; } },
        { key: 'movimientos_locales', type: 'options', pregunta: 'Will you have local movements within the destination city?',
          opciones: ['Yes', 'No'] },
        { key: 'nombre_contacto', type: 'text', pregunta: 'Who should we prepare the quote for?', placeholder: 'Your name',
          normaliza: function (v) { return v.trim().replace(/\s+/g, ' '); },
          valida: function (v) { return v.trim().length >= 2 ? '' : 'Enter your name.'; } },
        { key: 'es_organizacion', type: 'options', pregunta: 'Is the quote on behalf of a company, club, church, school or other organization?',
          opciones: ['Yes', 'No'] },
        { key: 'tipo_organizacion', type: 'options', pregunta: 'What type?',
          opciones: ['Company', 'Club', 'Church', 'School', 'Other'],
          skipIf: function (a) { return a.es_organizacion !== 'Yes'; } },
        { key: 'organizacion', type: 'text', pregunta: 'What is the name of the organization?', placeholder: 'E.g. St. Joseph School',
          skipIf: function (a) { return a.es_organizacion !== 'Yes'; },
          normaliza: function (v) { return v.trim().replace(/\s+/g, ' '); },
          valida: function (v) { return v.trim().length >= 2 ? '' : 'Enter the name.'; } }
      ],
      mensaje: function (display, respuestas) {
        var l = [];
        l.push('Hi Alfa Tours, I would like a quote:');
        l.push('• Service: ' + (display.tipo_servicio || 'Special trip'));
        l.push('• Origin: ' + display.origen);
        l.push('• Destination: ' + display.destino);
        l.push('• People: ' + display.num_personas);
        l.push('• Departure: ' + display.fecha_salida + ' (' + display.franja_salida + ')');
        l.push('• Return: ' + display.fecha_regreso + ' (' + display.franja_regreso + ')');
        if (respuestas.ruta_multiple === 'Yes') l.push('• Multi-stop route: Yes (' + display.num_paradas + '): ' + display.paradas);
        else l.push('• Multi-stop route: No');
        l.push('• Local movements: ' + display.movimientos_locales);
        l.push('• Name: ' + display.nombre_contacto);
        if (respuestas.es_organizacion === 'Yes') l.push('• Organization: ' + display.organizacion + ' (' + display.tipo_organizacion + ')');
        l.push('Thank you.');
        return l.join('\n');
      }
    }
  };

  var T = I18N[LANG];
  var SERVICIOS = T.SERVICIOS;
  var PREGUNTAS = T.PREGUNTAS;
  var ETIQUETAS = T.ETIQUETAS;
  var UI = T.ui;

  /* --- Estado -------------------------------------------------------- */
  var respuestas = {};   // datos NORMALIZADos por clave
  var display = {};      // versión legible para mostrar
  var indice = 0;        // pregunta actual (índice en PREGUNTAS)
  var editando = false;  // true si venimos del resumen a corregir un campo
  var $chat, $body, $input; // referencias DOM

  /* =================== Construcción del DOM ======================== */
  function construir() {
    $chat = document.createElement('div');
    $chat.className = 'af-chat';
    $chat.setAttribute('role', 'dialog');
    $chat.setAttribute('aria-label', UI.dialogLabel);
    $chat.setAttribute('aria-modal', 'false');
    $chat.innerHTML =
      '<div class="af-head">' +
        '<div class="af-head__avatar" aria-hidden="true">' +
          '<svg viewBox="0 0 24 24"><path d="M3 6a2 2 0 012-2h14a2 2 0 012 2v9a2 2 0 01-2 2H8l-5 4V6z"/></svg>' +
        '</div>' +
        '<div>' +
          '<div class="af-head__title">' + esc(UI.headTitle) + '</div>' +
          '<div class="af-head__sub">' + esc(UI.headSub) + '</div>' +
        '</div>' +
        '<button class="af-head__close" aria-label="' + esc(UI.close) + '">&times;</button>' +
      '</div>' +
      '<div class="af-body" aria-live="polite"></div>' +
      '<div class="af-input"></div>';
    document.body.appendChild($chat);
    $body = $chat.querySelector('.af-body');
    $input = $chat.querySelector('.af-input');
    $chat.querySelector('.af-head__close').addEventListener('click', cerrar);
  }

  /* =================== Pintado de mensajes ========================= */
  function burbujaBot(texto) {
    var d = document.createElement('div');
    d.className = 'af-msg af-msg--bot';
    d.innerHTML = esc(texto).replace(/\n/g, '<br>');
    $body.appendChild(d);
    scroll();
  }
  function burbujaUser(texto) {
    var d = document.createElement('div');
    d.className = 'af-msg af-msg--user';
    d.innerHTML = esc(texto).replace(/\n/g, '<br>');
    $body.appendChild(d);
    scroll();
  }
  function scroll() { $body.scrollTop = $body.scrollHeight; }

  function conDelay(cb, ms) {
    var t = document.createElement('div');
    t.className = 'af-typing';
    t.innerHTML = '<span></span><span></span><span></span>';
    $body.appendChild(t); scroll();
    setTimeout(function () { t.remove(); cb(); }, ms || 550);
  }

  /* =================== Motor de preguntas ========================= */
  function siguienteIndice(desde) {
    var i = desde;
    while (i < PREGUNTAS.length && PREGUNTAS[i].skipIf && PREGUNTAS[i].skipIf(respuestas)) i++;
    return i;
  }
  function anteriorIndice(desde) {
    var i = desde - 1;
    while (i >= 0 && PREGUNTAS[i].skipIf && PREGUNTAS[i].skipIf(respuestas)) i--;
    return i;
  }

  function preguntarServicio() {
    conDelay(function () {
      burbujaBot(UI.greet);
      $input.innerHTML = '';
      var wrap = document.createElement('div');
      wrap.className = 'af-options';
      SERVICIOS.forEach(function (op) {
        var b = document.createElement('button');
        b.className = 'af-opt'; b.type = 'button'; b.textContent = op;
        b.addEventListener('click', function () { elegirServicio(op); });
        wrap.appendChild(b);
      });
      $input.appendChild(wrap);
    });
  }

  function elegirServicio(tipo) {
    respuestas.tipo_servicio = tipo;
    display.tipo_servicio = tipo;
    burbujaUser(tipo);
    if (tipo === T.ESPECIAL) { indice = 0; preguntar(); }
    else { handoffDirecto(tipo); }
  }

  function handoffDirecto(tipo) {
    guardarLead(tipo);
    $input.innerHTML = '';
    conDelay(function () {
      burbujaBot(UI.directo(tipo));
      var texto = UI.directoMsg(tipo);
      var url = 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(texto);
      var wa = document.createElement('button');
      wa.className = 'af-wa'; wa.type = 'button';
      wa.innerHTML = '<svg viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 018.413 3.488 11.82 11.82 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24z"/></svg> ' + esc(UI.continueWa);
      wa.addEventListener('click', function () { window.open(url, '_blank', 'noopener'); });
      $body.appendChild(wa);
      var re = document.createElement('button');
      re.className = 'af-restart'; re.type = 'button'; re.textContent = UI.chooseOther;
      re.addEventListener('click', reiniciar);
      $body.appendChild(re);
      scroll();
    });
  }

  function preguntar() {
    indice = siguienteIndice(indice);
    if (indice >= PREGUNTAS.length) { mostrarResumen(); return; }
    var q = PREGUNTAS[indice];
    conDelay(function () {
      burbujaBot(q.pregunta);
      pintarControl(q);
    });
  }

  function pintarControl(q, forzarOtro) {
    $input.innerHTML = '';

    if (q.type === 'options' && !forzarOtro) {
      var wrap = document.createElement('div');
      wrap.className = 'af-options';
      q.opciones.forEach(function (op) {
        var b = document.createElement('button');
        b.className = 'af-opt'; b.type = 'button'; b.textContent = op;
        b.addEventListener('click', function () {
          if (q.otroSi && op === q.otroSi) { pintarControl(q, true); return; }
          aceptar(q, op, op);
        });
        wrap.appendChild(b);
      });
      $input.appendChild(wrap);
    } else {
      var field = document.createElement('div');
      field.className = 'af-field';
      var inp = document.createElement('input');
      inp.type = q.type === 'number' ? 'text' : (q.type === 'date' ? 'date' : 'text');
      if (q.type === 'number') inp.inputMode = 'numeric';
      if (q.type === 'date' && q.min) inp.min = q.min;
      inp.placeholder = forzarOtro ? (q.otroPrompt || UI.otraDefault) : (q.placeholder || UI.placeholderDefault);
      inp.setAttribute('aria-label', q.pregunta);
      var send = document.createElement('button');
      send.className = 'af-send'; send.type = 'button'; send.setAttribute('aria-label', UI.sendWa);
      send.innerHTML = '<svg viewBox="0 0 24 24"><path d="M3 20.5l18-8.5L3 3.5 3 10l12 2-12 2z"/></svg>';
      field.appendChild(inp); field.appendChild(send);
      $input.appendChild(field);

      var enviar = function () {
        var raw = inp.value;
        var norm = forzarOtro ? tituloCiudad(raw) : (q.normaliza ? q.normaliza(raw) : raw.trim());
        var err = q.valida ? q.valida(raw, respuestas) : (String(raw).trim() ? '' : UI.needed);
        if (forzarOtro && !String(raw).trim()) err = UI.otraCityErr;
        if (err) { mostrarError(err); return; }
        aceptar(q, norm, legible(q.key, norm));
      };
      send.addEventListener('click', enviar);
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); enviar(); } });
      setTimeout(function () { inp.focus(); }, 60);
    }

    var acc = document.createElement('div');
    acc.className = 'af-actions';
    var prev = anteriorIndice(indice);
    if (prev >= 0 && !editando) {
      var back = document.createElement('button');
      back.className = 'af-back'; back.type = 'button';
      back.innerHTML = UI.back;
      back.addEventListener('click', regresar);
      acc.appendChild(back);
    }
    var errBox = document.createElement('div');
    errBox.className = 'af-error'; errBox.id = 'af-error';
    acc.appendChild(errBox);
    $input.appendChild(acc);
  }

  function mostrarError(msg) {
    var e = document.getElementById('af-error');
    if (e) e.textContent = msg;
  }

  function aceptar(q, valorNorm, textoUser) {
    respuestas[q.key] = valorNorm;
    display[q.key] = textoUser;
    burbujaUser(textoUser);

    if (q.key === 'ruta_multiple' && valorNorm === T.NO) {
      delete respuestas.num_paradas; delete respuestas.paradas;
      delete display.num_paradas; delete display.paradas;
    }
    if (q.key === 'es_organizacion' && valorNorm === T.NO) {
      delete respuestas.tipo_organizacion; delete respuestas.organizacion;
      delete display.tipo_organizacion; delete display.organizacion;
    }

    if (editando) { editando = false; mostrarResumen(); return; }
    indice++;
    preguntar();
  }

  function regresar() {
    var prev = anteriorIndice(indice);
    if (prev < 0) return;
    quitarUltimosMensajes(2);
    indice = prev;
    var q = PREGUNTAS[indice];
    delete respuestas[q.key]; delete display[q.key];
    pintarControl(q);
    scroll();
  }

  function quitarUltimosMensajes(n) {
    var msgs = $body.querySelectorAll('.af-msg');
    for (var i = 0; i < n && msgs.length; i++) {
      msgs[msgs.length - 1 - i] && msgs[msgs.length - 1 - i].remove();
    }
  }

  /* =================== Resumen + handoff =========================== */
  function ordenClaves() {
    return PREGUNTAS.map(function (q) { return q.key; })
      .filter(function (k) { return respuestas[k] !== undefined && respuestas[k] !== ''; });
  }

  function mostrarResumen() {
    $input.innerHTML = '';
    conDelay(function () {
      burbujaBot(UI.summaryIntro);

      var box = document.createElement('div');
      box.className = 'af-summary';
      ordenClaves().forEach(function (k) {
        var row = document.createElement('div');
        row.className = 'af-summary__row';
        row.innerHTML =
          '<div><div class="af-summary__k">' + esc(ETIQUETAS[k] || k) + '</div>' +
          '<div class="af-summary__v">' + esc(display[k]) + '</div></div>';
        var edit = document.createElement('button');
        edit.className = 'af-summary__edit'; edit.type = 'button'; edit.textContent = UI.edit;
        edit.addEventListener('click', function () { editarCampo(k); });
        row.appendChild(edit);
        box.appendChild(row);
      });
      $body.appendChild(box);

      var wa = document.createElement('button');
      wa.className = 'af-wa'; wa.type = 'button';
      wa.innerHTML = '<svg viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 018.413 3.488 11.82 11.82 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24z"/></svg> ' + esc(UI.sendWa);
      wa.addEventListener('click', enviarWhatsApp);
      $body.appendChild(wa);

      var re = document.createElement('button');
      re.className = 'af-restart'; re.type = 'button'; re.textContent = UI.restart;
      re.addEventListener('click', reiniciar);
      $body.appendChild(re);
      scroll();
    });
  }

  function editarCampo(key) {
    editando = true;
    indice = PREGUNTAS.findIndex(function (q) { return q.key === key; });
    var q = PREGUNTAS[indice];
    burbujaBot(UI.fixPrefix + q.pregunta);
    pintarControl(q);
    scroll();
  }

  function enviarWhatsApp() {
    guardarRegistro();
    var texto = T.mensaje(display, respuestas);
    var url = 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(texto);
    window.open(url, '_blank', 'noopener');
  }

  /* =================== Persistencia / análisis ==================== */
  function guardarLead(tipo) {
    persistir({ timestamp: new Date().toISOString(), tipo_servicio: tipo, idioma: LANG, via: 'whatsapp_directo' });
  }

  function guardarRegistro() {
    var reg = {
      timestamp: new Date().toISOString(),
      idioma: LANG,
      via: 'chat',
      tipo_servicio: respuestas.tipo_servicio || T.ESPECIAL,
      origen: respuestas.origen || '',
      destino: respuestas.destino || '',
      num_personas: respuestas.num_personas || null,
      fecha_salida: respuestas.fecha_salida || '',
      franja_salida: respuestas.franja_salida || '',
      fecha_regreso: respuestas.fecha_regreso || '',
      franja_regreso: respuestas.franja_regreso || '',
      ruta_multiple: respuestas.ruta_multiple === T.SI,
      num_paradas: respuestas.num_paradas || 0,
      paradas: respuestas.paradas || [],
      movimientos_locales: respuestas.movimientos_locales === T.SI,
      nombre_contacto: respuestas.nombre_contacto || '',
      es_organizacion: respuestas.es_organizacion === T.SI,
      tipo_organizacion: respuestas.tipo_organizacion || '',
      organizacion: respuestas.organizacion || ''
    };
    persistir(reg);
    return reg;
  }

  function persistir(reg) {
    try {
      var arr = JSON.parse(localStorage.getItem('af_cotizaciones') || '[]');
      arr.push(reg);
      localStorage.setItem('af_cotizaciones', JSON.stringify(arr));
    } catch (e) { /* almacenamiento no disponible */ }

    try {
      if (CONNECTOR.tipo === 'sheets' && CONNECTOR.url) {
        fetch(CONNECTOR.url, {
          method: 'POST', mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reg)
        });
      } else if (CONNECTOR.tipo === 'airtable' && CONNECTOR.airtable.base && CONNECTOR.airtable.token) {
        var at = CONNECTOR.airtable;
        var campos = Object.assign({}, reg, { paradas: (reg.paradas || []).join(', ') });
        fetch('https://api.airtable.com/v0/' + at.base + '/' + encodeURIComponent(at.tabla), {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + at.token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ records: [{ fields: campos }], typecast: true })
        });
      }
    } catch (e) { /* silencioso: no debe romper la UX */ }
    return reg;
  }

  /* =================== Control de apertura ======================== */
  function reiniciar() {
    respuestas = {}; display = {}; indice = 0; editando = false;
    $body.innerHTML = '';
    preguntarServicio();
  }
  function abrir() {
    $chat.classList.add('af-open');
    if (!$body.children.length) preguntarServicio();
  }
  function cerrar() { $chat.classList.remove('af-open'); }
  function toggle() { $chat.classList.contains('af-open') ? cerrar() : abrir(); }

  /* =================== Inicialización ============================= */
  function init() {
    if (document.querySelector('.af-chat')) return; // evita duplicados
    construir();

    var float = document.querySelector('.wa-float');
    if (float) {
      float.classList.add('af-launch');
      float.removeAttribute('href');
      float.removeAttribute('target');
      float.setAttribute('role', 'button');
      float.setAttribute('tabindex', '0');
      float.setAttribute('aria-label', UI.openLabel);
      float.innerHTML = '<svg viewBox="0 0 24 24"><path d="M3 6a2 2 0 012-2h14a2 2 0 012 2v9a2 2 0 01-2 2H8l-5 4V6z"/></svg>';
      float.addEventListener('click', function (e) { e.preventDefault(); toggle(); });
      float.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
      });
    }

    document.querySelectorAll('[data-af-cotizar]').forEach(function (el) {
      el.addEventListener('click', function (e) { e.preventDefault(); abrir(); });
    });

    // Apertura automática cuando la URL trae #cotizar / #quote
    function autoAbrir() { if (location.hash === '#cotizar' || location.hash === '#quote') abrir(); }
    autoAbrir();
    window.addEventListener('hashchange', autoAbrir);
  }

  return { init: init, abrir: abrir, cerrar: cerrar };
})();
