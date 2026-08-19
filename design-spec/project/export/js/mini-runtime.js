/* mini-runtime.js — motor de plantillas mínimo (sin dependencias).
   Soporta: {{ ruta.punteada }} en texto y atributos, <sc-if value>, <sc-for list as>,
   manejadores onClick/onChange..., y style-hover / style-active / style-focus. */
(function (global) {
  'use strict';

  function get(path, scope, vals) {
    if (path === 'true') return true;
    if (path === 'false') return false;
    var parts = path.split('.');
    var src = Object.prototype.hasOwnProperty.call(scope, parts[0]) ? scope : vals;
    var cur = src;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  var HOLE = /\{\{\s*([\w$.]+)\s*\}\}/g;
  function isWholeHole(s) { return /^\{\{\s*[\w$.]+\s*\}\}$/.test(s.trim()); }

  function interpolate(str, scope, vals) {
    return str.replace(HOLE, function (_, p) {
      var v = get(p, scope, vals);
      return v === undefined || v === null || v === false ? '' : String(v);
    });
  }

  var EVENTS = { onclick: 'click', onchange: 'input', oninput: 'input', onsubmit: 'submit', onkeydown: 'keydown' };

  function processElement(el, scope, vals) {
    var attrs = Array.prototype.slice.call(el.attributes);
    attrs.forEach(function (a) {
      var name = a.name, value = a.value;
      var lower = name.toLowerCase();
      if (EVENTS[lower]) {
        el.removeAttribute(name);
        if (isWholeHole(value)) {
          var fn = get(value.trim().slice(2, -2).trim(), scope, vals);
          if (typeof fn === 'function') el.addEventListener(EVENTS[lower], fn);
        }
        return;
      }
      if (lower === 'style-hover' || lower === 'style-active' || lower === 'style-focus') {
        el.removeAttribute(name);
        var decls = interpolate(value, scope, vals);
        var pair = lower === 'style-hover' ? ['mouseenter', 'mouseleave']
          : lower === 'style-active' ? ['mousedown', 'mouseup'] : ['focus', 'blur'];
        var base = null;
        el.addEventListener(pair[0], function () { base = el.getAttribute('style') || ''; el.setAttribute('style', base + ';' + decls); });
        el.addEventListener(pair[1], function () { if (base !== null) el.setAttribute('style', base); });
        return;
      }
      if (value.indexOf('{{') === -1) return;
      if (lower === 'value' && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
        el.removeAttribute(name);
        var v = interpolate(value, scope, vals);
        el.value = v;
        return;
      }
      el.setAttribute(name, interpolate(value, scope, vals));
    });
  }

  function walk(node, scope, vals) {
    var child = node.firstChild;
    while (child) {
      var next = child.nextSibling;
      if (child.nodeType === 3) {
        if (child.nodeValue.indexOf('{{') !== -1) child.nodeValue = interpolate(child.nodeValue, scope, vals);
      } else if (child.nodeType === 1) {
        var tag = child.tagName.toLowerCase();
        if (tag === 'sc-if') {
          var raw = child.getAttribute('value') || '';
          var ok = isWholeHole(raw) ? get(raw.trim().slice(2, -2).trim(), scope, vals) : raw;
          if (ok) {
            var frag = document.createDocumentFragment();
            while (child.firstChild) frag.appendChild(child.firstChild);
            walk(frag, scope, vals);
            node.replaceChild(frag, child);
          } else {
            node.removeChild(child);
          }
        } else if (tag === 'sc-for') {
          var listRaw = child.getAttribute('list') || '';
          var as = child.getAttribute('as') || 'item';
          var list = isWholeHole(listRaw) ? get(listRaw.trim().slice(2, -2).trim(), scope, vals) : [];
          var out = document.createDocumentFragment();
          (list || []).forEach(function (item, i) {
            var inner = document.createDocumentFragment();
            for (var k = 0; k < child.childNodes.length; k++) inner.appendChild(child.childNodes[k].cloneNode(true));
            var s = Object.create(scope);
            s[as] = item; s.$index = i;
            walk(inner, s, vals);
            out.appendChild(inner);
          });
          node.replaceChild(out, child);
        } else {
          processElement(child, scope, vals);
          walk(child, scope, vals);
        }
      }
      child = next;
    }
  }

  function focusKey(el) {
    if (!el || !el.tagName) return null;
    var all = Array.prototype.slice.call(document.querySelectorAll('input,textarea,select'));
    var i = all.indexOf(el);
    return i < 0 ? null : { i: i, start: el.selectionStart, end: el.selectionEnd };
  }

  function restoreFocus(f) {
    if (!f) return;
    var all = document.querySelectorAll('input,textarea,select');
    var el = all[f.i];
    if (!el) return;
    el.focus();
    try { el.setSelectionRange(f.start, f.end); } catch (e) {}
  }

  function DCLogic() {}
  DCLogic.prototype.setState = function (patch) {
    var next = typeof patch === 'function' ? patch(this.state) : patch;
    this.state = Object.assign({}, this.state, next);
    if (this._mounted) this._render();
  };
  DCLogic.prototype.forceUpdate = function () { if (this._mounted) this._render(); };
  DCLogic.prototype.renderVals = function () { return {}; };

  function mount(ComponentClass, templateId, hostId) {
    var tplEl = document.getElementById(templateId);
    var host = document.getElementById(hostId);
    var inst = new ComponentClass();
    inst.props = inst.props || {};
    inst._render = function () {
      var f = focusKey(document.activeElement);
      var vals = inst.renderVals() || {};
      var frag = tplEl.content.cloneNode(true);
      walk(frag, Object.create(null), vals);
      host.innerHTML = '';
      host.appendChild(frag);
      if (typeof inst.componentDidUpdate === 'function') inst.componentDidUpdate();
      restoreFocus(f);
    };
    inst._mounted = true;
    inst._render();
    if (typeof inst.componentDidMount === 'function') inst.componentDidMount();
    return inst;
  }

  global.DCLogic = DCLogic;
  global.mountApp = mount;
})(window);
