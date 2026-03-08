/*
 ******************************************************************
       /\ /|       @file       key-designer.js
       \ V/        @brief      单键矢量编辑器（Fabric.js 封装）
       | "")       @author     Catarina·RabbitNya, yingtu0401@gmail.com
       /  |
      /  \\        @Modified   2026-03-08 23:30:00
    *(__\_\        @Copyright  Copyright (c) 2026, Shadowrabbit
 ******************************************************************
*/

/* global fabric, paper, opentype */

// ==================== 常量 ====================
var EDIT_RES = 256;  // 编辑画布分辨率（每 1u 的像素数，256 已足够精细）
var SNAP_DIST = 4;
var SAFE_MARGIN = 0.1;
var MAX_HISTORY = 30;
var HISTORY_DEBOUNCE = 400; // 历史记录去抖动延迟(ms)
var GRID_CLR = 'rgba(255,255,255,0.06)';
var GUIDE_CLR = 'rgba(0,212,255,0.3)';
var SAFE_CLR = 'rgba(255,68,102,0.15)';
var SNAP_CLR = '#ff4466';

var BUILTIN_FONTS = ['Inter', 'Noto Sans SC', 'Arial', 'Georgia', 'Courier New', 'Impact', 'Verdana'];

// ==================== KeyDesigner ====================
export class KeyDesigner {

  constructor(container, cb) {
    this._el = container;
    this._cb = cb || {};
    this._fc = null;            // fabric.Canvas
    this._keyDef = null;
    this._cw = 0;
    this._ch = 0;
    this._baseColor = '#3c3c3c';
    this._baseZoom = 1;

    this._tool = 'select';
    this._hnd = {};             // 当前工具事件处理
    this._penPts = [];
    this._penPreview = null;
    this._penDrag = false;

    this._lyUid = 1;
    this._layers = [this._mkLy('图层 1')];
    this._aLy = 0;             // activeLayerIdx

    this._hist = [];
    this._hIdx = -1;
    this._hLock = false;

    this._gridOn = true;
    this._snapGrid = true;
    this._snapObj = true;
    this._gridSz = 32;
    this._guides = [];

    this._clip = null;
    this._customFonts = [];
    this._fontBufs = {};
    this._paperReady = false;
    this._kbFn = null;
    this._drawing = false;     // 正在绘制形状/线段中
    this._gridCache = null;    // 缓存网格图像
    this._gridCacheZ = 0;      // 缓存时的缩放值
    this._hTimer = 0;          // 历史去抖定时器
    this._selTimer = 0;        // 选择事件去抖定时器
    this._snapCache = null;    // 缓存的对象边界数据
    this._snapCacheDirty = true;
  }

  // ==================== 生命周期 ====================

  open(keyDef, baseColor, fabricData) {
    this._keyDef = keyDef;
    this._baseColor = baseColor || '#3c3c3c';
    var w = keyDef.w || 1, h = keyDef.h || 1;
    this._cw = Math.round(EDIT_RES * w);
    this._ch = Math.round(EDIT_RES * h);

    var el = document.createElement('canvas');
    el.id = 'kd-fc';
    this._el.innerHTML = '';
    this._el.appendChild(el);

    this._fc = new fabric.Canvas(el, {
      width: this._cw, height: this._ch,
      backgroundColor: this._baseColor,
      selection: true,
      preserveObjectStacking: true,
      stopContextMenu: true, fireRightClick: true,
      renderOnAddRemove: false,    // 手动控制渲染时机
      enableRetinaScaling: false   // 禁用 retina 倍率，减少像素量
    });

    this._fc.on('after:render', () => this._overlay());
    this._fc.on('selection:created', () => this._fireSel());
    this._fc.on('selection:updated', () => this._fireSel());
    this._fc.on('selection:cleared', () => this._fireSel());
    this._fc.on('object:modified', () => { this._snapCacheDirty = true; this._pushH(); });
    this._fc.on('object:added', () => { this._snapCacheDirty = true; });
    this._fc.on('object:removed', () => { this._snapCacheDirty = true; });
    this._fc.on('object:moving', e => this._onMoving(e));
    this._fc.on('mouse:up', () => {
      if (this._guides.length) { this._guides = []; this._fc.requestRenderAll(); }
    });

    if (fabricData) {
      if (fabricData._kdLayers) {
        this._layers = fabricData._kdLayers.map(l => ({ ...l, objects: [] }));
        this._aLy = fabricData._kdActiveLy || 0;
        this._lyUid = Math.max(...this._layers.map(l => l.id)) + 1;
      }
      this._fc.loadFromJSON(fabricData, () => {
        this._rebuildRefs();
        this._fc.renderAll();
        this._pushHNow();
      });
    } else {
      this._pushHNow();
    }

    this._fitZoom();
    this._kbFn = e => this._onKey(e);
    window.addEventListener('keydown', this._kbFn);
    this.setTool('select');
    this._fireLy();
  }

  close() {
    if (this._kbFn) { window.removeEventListener('keydown', this._kbFn); this._kbFn = null; }
    if (this._hTimer) { clearTimeout(this._hTimer); this._hTimer = 0; }
    if (this._selTimer) { clearTimeout(this._selTimer); this._selTimer = 0; }
    if (this._fc) { this._fc.dispose(); this._fc = null; }
    this._el.innerHTML = '';
    this._hist = []; this._hIdx = -1;
    this._layers = [this._mkLy('图层 1')]; this._aLy = 0;
    this._penPts = []; this._penPreview = null; this._guides = [];
    this._gridCache = null; this._drawing = false; this._snapCache = null;
  }

  save() {
    if (!this._fc) return null;
    var json = this._fc.toJSON(['_layerIdx', '_baseOp', '_locked']);
    json._kdLayers = this._layers.map(l => ({
      id: l.id, name: l.name, visible: l.visible,
      locked: l.locked, opacity: l.opacity, blendMode: l.blendMode
    }));
    json._kdActiveLy = this._aLy;

    // 导出纹理：重置缩放到1:1，渲染后再恢复
    var oldVpt = this._fc.viewportTransform.slice();
    this._fc.setViewportTransform([1, 0, 0, 1, 0, 0]);
    this._fc.setDimensions({ width: this._cw, height: this._ch });
    this._fc.renderAll();

    var texW = Math.round(128 * (this._keyDef.w || 1));
    var texH = Math.round(128 * (this._keyDef.h || 1));
    var tex = document.createElement('canvas');
    tex.width = texW; tex.height = texH;
    tex.getContext('2d').drawImage(this._fc.lowerCanvasEl, 0, 0, texW, texH);

    // 恢复编辑器视口
    this._fc.setViewportTransform(oldVpt);
    this._fitZoom();
    return { json, textureCanvas: tex };
  }

  // ==================== 缩放 ====================

  _fitZoom() {
    if (!this._fc || !this._el) return;
    var pw = this._el.clientWidth, ph = this._el.clientHeight;
    if (!pw || !ph) return;
    this._baseZoom = Math.min(pw / this._cw, ph / this._ch) * 0.88;
    this._applyZoom(100);
  }

  setZoom(pct) { this._applyZoom(pct); }

  _applyZoom(pct) {
    if (!this._fc) return;
    var z = this._baseZoom * (pct / 100);
    this._fc.setZoom(z);
    this._fc.setWidth(this._cw * z);
    this._fc.setHeight(this._ch * z);
    this._invalidateGridCache();
    this._fc.requestRenderAll();
  }

  getZoom() {
    if (!this._fc || !this._baseZoom) return 100;
    return Math.round((this._fc.getZoom() / this._baseZoom) * 100);
  }

  resize() { this._fitZoom(); }

  // ==================== 叠加绘制（性能优化） ====================

  _invalidateGridCache() { this._gridCache = null; }

  _buildGridCache(z) {
    var w = Math.round(this._cw * z), h = Math.round(this._ch * z);
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var ctx = c.getContext('2d');
    ctx.setTransform(z, 0, 0, z, 0, 0);

    // 网格（批量路径，一次 stroke）
    if (this._gridOn) {
      ctx.strokeStyle = GRID_CLR; ctx.lineWidth = 1 / z;
      ctx.beginPath();
      var gs = this._gridSz;
      for (var gx = gs; gx < this._cw; gx += gs) {
        ctx.moveTo(gx, 0); ctx.lineTo(gx, this._ch);
      }
      for (var gy = gs; gy < this._ch; gy += gs) {
        ctx.moveTo(0, gy); ctx.lineTo(this._cw, gy);
      }
      ctx.stroke();
    }

    // 中心十字
    ctx.strokeStyle = GUIDE_CLR; ctx.lineWidth = 1 / z;
    ctx.setLineDash([6 / z, 4 / z]);
    ctx.beginPath();
    var cx = this._cw / 2, cy = this._ch / 2;
    ctx.moveTo(cx, 0); ctx.lineTo(cx, this._ch);
    ctx.moveTo(0, cy); ctx.lineTo(this._cw, cy);
    ctx.stroke();

    // 安全区
    var m = SAFE_MARGIN * Math.min(this._cw, this._ch);
    ctx.strokeStyle = SAFE_CLR;
    ctx.strokeRect(m, m, this._cw - 2 * m, this._ch - 2 * m);
    ctx.setLineDash([]);

    this._gridCache = c;
    this._gridCacheZ = z;
  }

  _overlay() {
    var fc = this._fc; if (!fc) return;
    var ctx = fc.contextContainer;
    var z = fc.getZoom();

    // 绘制中跳过网格（只画对齐线）
    if (!this._drawing) {
      if (!this._gridCache || this._gridCacheZ !== z) this._buildGridCache(z);
      ctx.drawImage(this._gridCache, 0, 0);
    }

    // 动态对齐线（始终绘制）
    if (this._guides.length) {
      ctx.save();
      ctx.setTransform(z, 0, 0, z, 0, 0);
      ctx.strokeStyle = SNAP_CLR; ctx.lineWidth = 1 / z;
      for (var g of this._guides) {
        ctx.beginPath(); ctx.moveTo(g.x1, g.y1); ctx.lineTo(g.x2, g.y2); ctx.stroke();
      }
      ctx.restore();
    }
  }

  // ==================== 工具系统 ====================

  setTool(id) {
    this._clearTool();
    this._tool = id;
    if (!this._fc) return;
    var fc = this._fc;
    fc.isDrawingMode = false;
    fc.selection = (id === 'select');
    fc.defaultCursor = id === 'select' ? 'default' : 'crosshair';
    fc.forEachObject(o => { o.selectable = (id === 'select') && !o._locked; });

    switch (id) {
      case 'select': this._initSelect(); break;
      case 'rect':   this._initShape('rect'); break;
      case 'ellipse': this._initShape('ellipse'); break;
      case 'line':   this._initLine(); break;
      case 'pen':    this._initPen(); break;
      case 'text':   this._initText(); break;
      case 'image':  this._triggerImg(); break;
      case 'draw':   this._initDraw(); break;
    }
    this._cb.onToolChange?.(id);
  }

  _clearTool() {
    this._drawing = false;
    if (this._fc) {
      for (var ev of ['mouse:down', 'mouse:move', 'mouse:up', 'mouse:dblclick', 'path:created']) {
        if (this._hnd[ev]) this._fc.off(ev, this._hnd[ev]);
      }
    }
    this._hnd = {};
    if (this._penPreview) { this._fc?.remove(this._penPreview); this._penPreview = null; }
    this._penPts = []; this._penDrag = false;
  }

  _initSelect() {
    var fc = this._fc;
    fc.selection = true;
    fc.forEachObject(o => { o.selectable = !o._locked; });
  }

  _initShape(type) {
    var fc = this._fc, self = this, sx, sy, shape;

    this._hnd['mouse:down'] = function (opt) {
      if (opt.e.button !== 0) return;
      self._drawing = true;
      var p = fc.getPointer(opt.e); sx = p.x; sy = p.y;
      var cfg = {
        left: sx, top: sy, width: 0, height: 0,
        fill: '#7c4dff', stroke: '#ffffff', strokeWidth: 2,
        originX: 'left', originY: 'top', _layerIdx: self._aLy,
        objectCaching: false // 绘制中禁用缓存，完成后恢复
      };
      shape = type === 'rect' ? new fabric.Rect(cfg)
        : new fabric.Ellipse({ ...cfg, rx: 0, ry: 0 });
      fc.add(shape); fc.renderAll();
    };
    this._hnd['mouse:move'] = function (opt) {
      if (!shape) return;
      var p = fc.getPointer(opt.e);
      var w = p.x - sx, h = p.y - sy;
      if (opt.e.shiftKey) { var s = Math.max(Math.abs(w), Math.abs(h)); w = w < 0 ? -s : s; h = h < 0 ? -s : s; }
      shape.set({ left: w < 0 ? sx + w : sx, top: h < 0 ? sy + h : sy, width: Math.abs(w), height: Math.abs(h) });
      if (type === 'ellipse') shape.set({ rx: Math.abs(w) / 2, ry: Math.abs(h) / 2 });
      fc.renderAll(); // 同步渲染，避免异步延迟导致拖绘卡顿
    };
    this._hnd['mouse:up'] = function () {
      self._drawing = false;
      if (!shape) return;
      if (shape.width < 2 && shape.height < 2) { fc.remove(shape); }
      else { shape.set('objectCaching', true); self._addToLy(shape); fc.setActiveObject(shape); }
      fc.renderAll(); self._pushH();
      shape = null;
    };
    for (var e of ['mouse:down', 'mouse:move', 'mouse:up']) fc.on(e, this._hnd[e]);
  }

  _initLine() {
    var fc = this._fc, self = this, ln, x1, y1;
    this._hnd['mouse:down'] = function (opt) {
      if (opt.e.button !== 0) return;
      self._drawing = true;
      var p = fc.getPointer(opt.e); x1 = p.x; y1 = p.y;
      ln = new fabric.Line([x1, y1, x1, y1], {
        stroke: '#ffffff', strokeWidth: 2, originX: 'center', originY: 'center',
        _layerIdx: self._aLy, objectCaching: false
      });
      fc.add(ln);
    };
    this._hnd['mouse:move'] = function (opt) {
      if (!ln) return;
      var p = fc.getPointer(opt.e), x2 = p.x, y2 = p.y;
      if (opt.e.shiftKey) {
        var a = Math.atan2(y2 - y1, x2 - x1);
        var sn = Math.round(a / (Math.PI / 4)) * (Math.PI / 4);
        var d = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        x2 = x1 + Math.cos(sn) * d; y2 = y1 + Math.sin(sn) * d;
      }
      ln.set({ x2, y2 }); fc.renderAll(); // 同步渲染
    };
    this._hnd['mouse:up'] = function () {
      self._drawing = false;
      if (!ln) return;
      ln.set('objectCaching', true);
      if (Math.sqrt((ln.x2 - ln.x1) ** 2 + (ln.y2 - ln.y1) ** 2) < 3) fc.remove(ln);
      else { self._addToLy(ln); fc.setActiveObject(ln); }
      fc.renderAll(); self._pushH();
      ln = null;
    };
    for (var e of ['mouse:down', 'mouse:move', 'mouse:up']) fc.on(e, this._hnd[e]);
  }

  _initPen() {
    var fc = this._fc, self = this;
    var pts = this._penPts = [], dragging = false, cur = null;

    function buildD(closed) {
      if (pts.length < 2) return '';
      var d = 'M ' + pts[0].x + ' ' + pts[0].y;
      for (var i = 1; i < pts.length; i++) {
        var pv = pts[i - 1], c = pts[i];
        if (pv.hOut && c.hIn) d += ' C ' + pv.hOut.x + ' ' + pv.hOut.y + ' ' + c.hIn.x + ' ' + c.hIn.y + ' ' + c.x + ' ' + c.y;
        else d += ' L ' + c.x + ' ' + c.y;
      }
      if (closed) d += ' Z';
      return d;
    }
    function preview() {
      if (self._penPreview) fc.remove(self._penPreview);
      if (pts.length < 2) { self._penPreview = null; return; }
      self._penPreview = new fabric.Path(buildD(false), {
        fill: 'transparent', stroke: '#00d4ff', strokeWidth: 2,
        selectable: false, evented: false, strokeDashArray: [6, 4],
        objectCaching: false
      });
      fc.add(self._penPreview); fc.renderAll();
    }
    function finish(closed) {
      if (self._penPreview) fc.remove(self._penPreview);
      self._penPreview = null;
      if (pts.length < 2) { pts.length = 0; return; }
      var path = new fabric.Path(buildD(closed), {
        fill: closed ? '#7c4dff44' : 'transparent',
        stroke: '#ffffff', strokeWidth: 2, _layerIdx: self._aLy
      });
      fc.add(path); self._addToLy(path); fc.setActiveObject(path);
      fc.renderAll(); self._pushH(); pts.length = 0;
    }

    this._hnd['mouse:down'] = function (opt) {
      if (opt.e.button !== 0) return;
      var p = fc.getPointer(opt.e);
      if (pts.length > 1) {
        var dx = p.x - pts[0].x, dy = p.y - pts[0].y;
        if (Math.sqrt(dx * dx + dy * dy) < 10) { finish(true); return; }
      }
      cur = { x: p.x, y: p.y, hIn: null, hOut: null };
      pts.push(cur); dragging = true;
    };
    this._hnd['mouse:move'] = function (opt) {
      if (!dragging || !cur) return;
      var p = fc.getPointer(opt.e);
      var dx = p.x - cur.x, dy = p.y - cur.y;
      if (Math.sqrt(dx * dx + dy * dy) > 3) {
        cur.hOut = { x: p.x, y: p.y };
        cur.hIn = { x: cur.x - dx, y: cur.y - dy };
      }
      preview();
    };
    this._hnd['mouse:up'] = function () { dragging = false; preview(); };
    this._hnd['mouse:dblclick'] = function () { finish(false); };

    for (var ev of ['mouse:down', 'mouse:move', 'mouse:up', 'mouse:dblclick']) fc.on(ev, this._hnd[ev]);
  }

  _initText() {
    var fc = this._fc, self = this;
    this._hnd['mouse:down'] = function (opt) {
      if (opt.e.button !== 0) return;
      if (opt.target && opt.target.type === 'i-text') return;
      var p = fc.getPointer(opt.e);
      var t = new fabric.IText('文本', {
        left: p.x, top: p.y, fontSize: 36, fontFamily: 'Inter',
        fill: '#ffffff', _layerIdx: self._aLy
      });
      fc.add(t); self._addToLy(t); fc.setActiveObject(t);
      fc.requestRenderAll(); t.enterEditing(); t.selectAll(); self._pushH();
    };
    fc.on('mouse:down', this._hnd['mouse:down']);
  }

  _triggerImg() {
    var inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = e => {
      var f = e.target.files?.[0]; if (!f) return;
      var url = URL.createObjectURL(f);
      fabric.Image.fromURL(url, img => {
        var sc = Math.min(this._cw / img.width, this._ch / img.height) * 0.5;
        img.scale(sc);
        img.set({ left: this._cw / 2, top: this._ch / 2, originX: 'center', originY: 'center', _layerIdx: this._aLy });
        this._fc.add(img); this._addToLy(img); this._fc.setActiveObject(img);
        this._fc.requestRenderAll(); this._pushH(); URL.revokeObjectURL(url);
      });
    };
    inp.click();
    setTimeout(() => this.setTool('select'), 100);
  }

  _initDraw() {
    var fc = this._fc, self = this;
    fc.isDrawingMode = true;
    fc.freeDrawingBrush.color = '#ffffff';
    fc.freeDrawingBrush.width = 3;
    this._hnd['mouse:down'] = function () { self._drawing = true; };
    this._hnd['mouse:up'] = function () { self._drawing = false; };
    this._hnd['path:created'] = opt => {
      opt.path.set({ _layerIdx: this._aLy });
      this._addToLy(opt.path); this._pushH();
    };
    fc.on('mouse:down', this._hnd['mouse:down']);
    fc.on('mouse:up', this._hnd['mouse:up']);
    fc.on('path:created', this._hnd['path:created']);
  }

  setBrushWidth(w) { if (this._fc) this._fc.freeDrawingBrush.width = w; }
  setBrushColor(c) { if (this._fc) this._fc.freeDrawingBrush.color = c; }

  // ==================== 属性操作 ====================

  getSelInfo() {
    var obj = this._fc?.getActiveObject(); if (!obj) return null;
    var info = {
      type: obj.type, fill: obj.fill, stroke: obj.stroke,
      strokeWidth: obj.strokeWidth || 0, opacity: obj._baseOp ?? obj.opacity ?? 1,
      left: Math.round(obj.left), top: Math.round(obj.top),
      width: Math.round(obj.getScaledWidth()), height: Math.round(obj.getScaledHeight()),
      angle: Math.round(obj.angle || 0)
    };
    if (obj.fill && typeof obj.fill === 'object' && obj.fill.type) {
      info.fillType = obj.fill.type;
      var stops = obj.fill.colorStops || [];
      info.gradC1 = stops[0]?.color || '#7c4dff';
      info.gradC2 = stops[stops.length - 1]?.color || '#00d4ff';
    } else {
      info.fillType = 'solid';
    }
    if (obj.type === 'i-text' || obj.type === 'text') {
      info.fontFamily = obj.fontFamily; info.fontSize = obj.fontSize;
      info.charSpacing = obj.charSpacing || 0; info.lineHeight = obj.lineHeight || 1.2;
      info.fontWeight = obj.fontWeight; info.fontStyle = obj.fontStyle; info.text = obj.text;
    }
    return info;
  }

  setFill(v) {
    var o = this._fc?.getActiveObject(); if (!o) return;
    o.set('fill', v); this._fc.requestRenderAll(); this._pushH();
  }

  setStroke(c, w) {
    var o = this._fc?.getActiveObject(); if (!o) return;
    if (c !== undefined) o.set('stroke', c);
    if (w !== undefined) o.set('strokeWidth', w);
    this._fc.requestRenderAll(); this._pushH();
  }

  setOpacity(v) {
    var o = this._fc?.getActiveObject(); if (!o) return;
    o._baseOp = v;
    var ly = this._layers[o._layerIdx ?? 0];
    o.set('opacity', v * (ly?.opacity ?? 1));
    this._fc.requestRenderAll(); this._pushH();
  }

  setGradient(type, c1, c2, angle) {
    var o = this._fc?.getActiveObject(); if (!o) return;
    if (!type || type === 'solid') { o.set('fill', c1 || '#7c4dff'); }
    else {
      var w = o.width, h = o.height, rad = (angle || 0) * Math.PI / 180;
      var coords = type === 'linear'
        ? { x1: 0, y1: 0, x2: w * Math.cos(rad), y2: h * Math.sin(rad) }
        : { x1: w / 2, y1: h / 2, r1: 0, x2: w / 2, y2: h / 2, r2: Math.max(w, h) / 2 };
      o.set('fill', new fabric.Gradient({
        type, coords,
        colorStops: [{ offset: 0, color: c1 || '#7c4dff' }, { offset: 1, color: c2 || '#00d4ff' }]
      }));
    }
    this._fc.requestRenderAll(); this._pushH();
  }

  setTransform(p) {
    var o = this._fc?.getActiveObject(); if (!o) return;
    for (var k of ['left', 'top', 'angle', 'scaleX', 'scaleY']) {
      if (p[k] !== undefined) o.set(k, p[k]);
    }
    o.setCoords(); this._fc.requestRenderAll(); this._pushH();
  }

  // ==================== 文本属性 ====================

  setFontFamily(f) { this._setTP('fontFamily', f); }
  setFontSize(s)   { this._setTP('fontSize', s); }
  setCharSpacing(v) { this._setTP('charSpacing', v); }
  setLineHeight(v) { this._setTP('lineHeight', v); }

  toggleBold() {
    var o = this._txtObj(); if (!o) return;
    o.set('fontWeight', o.fontWeight === 'bold' ? 'normal' : 'bold');
    this._fc.requestRenderAll(); this._pushH();
  }

  toggleItalic() {
    var o = this._txtObj(); if (!o) return;
    o.set('fontStyle', o.fontStyle === 'italic' ? 'normal' : 'italic');
    this._fc.requestRenderAll(); this._pushH();
  }

  setStrokeText(c, w) {
    var o = this._txtObj(); if (!o) return;
    o.set({ stroke: c || null, strokeWidth: w || 0 });
    this._fc.requestRenderAll(); this._pushH();
  }

  _txtObj() {
    var o = this._fc?.getActiveObject();
    return (o && (o.type === 'i-text' || o.type === 'text')) ? o : null;
  }

  _setTP(prop, val) { var o = this._txtObj(); if (!o) return; o.set(prop, val); this._fc.requestRenderAll(); this._pushH(); }

  async textToPath() {
    var o = this._txtObj(); if (!o) return;
    var buf = this._fontBufs[o.fontFamily];
    if (!buf) { console.warn('textToPath: 仅支持已上传的自定义字体'); return; }
    try {
      var font = opentype.parse(buf);
      var p = font.getPath(o.text, 0, 0, o.fontSize);
      var fp = new fabric.Path(p.toPathData(3), {
        left: o.left, top: o.top, fill: o.fill,
        stroke: o.stroke, strokeWidth: o.strokeWidth, _layerIdx: o._layerIdx
      });
      this._fc.remove(o); this._rmFromLy(o);
      this._fc.add(fp); this._addToLy(fp);
      this._fc.setActiveObject(fp); this._pushH();
    } catch (err) { console.error('textToPath:', err); }
  }

  async uploadFont(file) {
    try {
      var buf = await file.arrayBuffer();
      var font = opentype.parse(buf);
      var name = font.names.fontFamily?.en || file.name.replace(/\.\w+$/, '');
      var face = new FontFace(name, buf);
      await face.load(); document.fonts.add(face);
      this._customFonts.push(name);
      this._fontBufs[name] = buf;
      this._cb.onFontsChange?.(this.getFonts());
      return name;
    } catch (err) { console.error('uploadFont:', err); return null; }
  }

  getFonts() { return [...BUILTIN_FONTS, ...this._customFonts]; }

  // ==================== 图层系统 ====================

  _mkLy(name) {
    return { id: this._lyUid++, name, visible: true, locked: false, opacity: 1, blendMode: 'source-over', objects: [] };
  }

  addLayer(name) {
    this._layers.push(this._mkLy(name || ('图层 ' + this._lyUid)));
    this._aLy = this._layers.length - 1;
    this._fireLy();
  }

  removeLayer(idx) {
    if (this._layers.length <= 1) return;
    var ly = this._layers[idx];
    for (var o of ly.objects) this._fc.remove(o);
    this._layers.splice(idx, 1);
    if (this._aLy >= this._layers.length) this._aLy = this._layers.length - 1;
    this._fc.requestRenderAll(); this._pushH(); this._fireLy();
  }

  setActiveLayer(idx) {
    if (idx >= 0 && idx < this._layers.length) { this._aLy = idx; this._fireLy(); }
  }

  toggleLayerVis(idx) {
    var ly = this._layers[idx]; if (!ly) return;
    ly.visible = !ly.visible;
    for (var o of ly.objects) o.set('visible', ly.visible);
    this._fc.requestRenderAll(); this._fireLy();
  }

  toggleLayerLock(idx) {
    var ly = this._layers[idx]; if (!ly) return;
    ly.locked = !ly.locked;
    for (var o of ly.objects) { o.set({ selectable: !ly.locked, evented: !ly.locked }); o._locked = ly.locked; }
    this._fc.requestRenderAll(); this._fireLy();
  }

  moveLayer(from, dir) {
    var to = from + dir;
    if (to < 0 || to >= this._layers.length) return;
    var t = this._layers[from]; this._layers[from] = this._layers[to]; this._layers[to] = t;
    if (this._aLy === from) this._aLy = to;
    else if (this._aLy === to) this._aLy = from;
    this._reorder(); this._fireLy();
  }

  setLayerOpacity(idx, v) {
    var ly = this._layers[idx]; if (!ly) return;
    ly.opacity = v;
    for (var o of ly.objects) o.set('opacity', (o._baseOp ?? 1) * v);
    this._fc.requestRenderAll(); this._fireLy();
  }

  setLayerBlend(idx, mode) {
    var ly = this._layers[idx]; if (!ly) return;
    ly.blendMode = mode;
    for (var o of ly.objects) o.set('globalCompositeOperation', mode);
    this._fc.requestRenderAll(); this._fireLy();
  }

  getLayers() {
    return this._layers.map((l, i) => ({
      id: l.id, name: l.name, visible: l.visible, locked: l.locked,
      opacity: l.opacity, blendMode: l.blendMode, count: l.objects.length,
      active: i === this._aLy
    }));
  }

  _addToLy(obj) {
    var ly = this._layers[this._aLy]; if (!ly) return;
    obj._layerIdx = this._aLy;
    obj._baseOp = obj.opacity ?? 1;
    obj.set('opacity', obj._baseOp * ly.opacity);
    obj.set('globalCompositeOperation', ly.blendMode);
    if (ly.locked) { obj.set({ selectable: false, evented: false }); obj._locked = true; }
    ly.objects.push(obj);
    this._reorder();
  }

  _rmFromLy(obj) {
    for (var ly of this._layers) {
      var idx = ly.objects.indexOf(obj);
      if (idx >= 0) { ly.objects.splice(idx, 1); break; }
    }
  }

  _reorder() {
    var fc = this._fc, n = 0;
    for (var ly of this._layers) for (var o of ly.objects) fc.moveTo(o, n++);
    fc.requestRenderAll();
  }

  _rebuildRefs() {
    for (var ly of this._layers) ly.objects = [];
    this._fc.forEachObject(obj => {
      var idx = obj._layerIdx ?? 0;
      if (idx >= 0 && idx < this._layers.length) this._layers[idx].objects.push(obj);
      else this._layers[0].objects.push(obj);
    });
  }

  _fireLy() { this._cb.onLayerChange?.(this.getLayers(), this._aLy); }

  // ==================== 编组 / 布尔运算 ====================

  groupSel() {
    var fc = this._fc, act = fc.getActiveObject();
    if (!act || act.type !== 'activeSelection') return;
    var objs = act.getObjects();
    fc.discardActiveObject();
    var grp = new fabric.Group(objs, { _layerIdx: this._aLy });
    objs.forEach(o => { fc.remove(o); this._rmFromLy(o); });
    fc.add(grp); this._addToLy(grp); fc.setActiveObject(grp);
    fc.requestRenderAll(); this._pushH();
  }

  ungroupSel() {
    var fc = this._fc, act = fc.getActiveObject();
    if (!act || act.type !== 'group') return;
    var items = act.getObjects();
    act._restoreObjectsState();
    fc.remove(act); this._rmFromLy(act);
    items.forEach(o => { fc.add(o); this._addToLy(o); });
    fc.requestRenderAll(); this._pushH();
  }

  booleanOp(type) {
    if (typeof paper === 'undefined') { console.warn('Paper.js 未加载'); return; }
    var fc = this._fc, objs = fc.getActiveObjects();
    if (objs.length < 2) return;

    if (!this._paperReady) {
      var c = document.createElement('canvas'); c.width = 1; c.height = 1;
      paper.setup(c); this._paperReady = true;
    }
    try {
      paper.project.clear();
      var pp = objs.map(obj => {
        var w = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        w.innerHTML = obj.toSVG();
        var item = paper.project.importSVG(w);
        if (item.className === 'Group' && item.children?.length) {
          var ch = item.children[0]; item.remove(); return ch;
        }
        return item;
      });
      var result = pp[0];
      for (var i = 1; i < pp.length; i++) result = result[type](pp[i]);
      var d = result.pathData;
      paper.project.clear();

      var fill = objs[0].fill || '#7c4dff';
      objs.forEach(o => { fc.remove(o); this._rmFromLy(o); });
      fc.discardActiveObject();
      var np = new fabric.Path(d, {
        fill, stroke: objs[0].stroke, strokeWidth: objs[0].strokeWidth, _layerIdx: this._aLy
      });
      fc.add(np); this._addToLy(np); fc.setActiveObject(np);
      fc.requestRenderAll(); this._pushH();
    } catch (err) { console.error('booleanOp:', err); paper.project.clear(); }
  }

  // ==================== 网格 / 对齐 ====================

  setGridVis(v) { this._gridOn = v; this._invalidateGridCache(); this._fc?.requestRenderAll(); }
  setSnapGrid(v) { this._snapGrid = v; }
  setSnapObj(v) { this._snapObj = v; }
  setGridSize(v) { this._gridSz = Math.max(4, v); this._invalidateGridCache(); this._fc?.requestRenderAll(); }

  _onMoving(opt) {
    var obj = opt.target; this._guides = [];
    if (this._snapGrid) {
      var g = this._gridSz;
      obj.set({ left: Math.round(obj.left / g) * g, top: Math.round(obj.top / g) * g });
    }
    if (this._snapObj) {
      // 缓存其他对象的边界，只在脏标记时重建
      if (this._snapCacheDirty || !this._snapCache) {
        this._snapCache = [];
        this._fc.forEachObject(o => {
          if (!o.visible || o === this._penPreview) return;
          this._snapCache.push({ obj: o, edges: this._edges(o) });
        });
        this._snapCacheDirty = false;
      }

      var ed = this._edges(obj);
      var snapX = false, snapY = false;
      for (var i = 0; i < this._snapCache.length && !(snapX && snapY); i++) {
        var sc = this._snapCache[i];
        if (sc.obj === obj) continue;
        var te = sc.edges;
        if (!snapX) {
          for (var ex of [ed.cx, ed.l, ed.r]) {
            if (snapX) break;
            for (var tx of [te.cx, te.l, te.r]) {
              if (Math.abs(ex - tx) < SNAP_DIST) {
                obj.set('left', obj.left + (tx - ex));
                this._guides.push({ x1: tx, y1: 0, x2: tx, y2: this._ch });
                snapX = true; break;
              }
            }
          }
        }
        if (!snapY) {
          for (var ey of [ed.cy, ed.t, ed.b]) {
            if (snapY) break;
            for (var ty of [te.cy, te.t, te.b]) {
              if (Math.abs(ey - ty) < SNAP_DIST) {
                obj.set('top', obj.top + (ty - ey));
                this._guides.push({ x1: 0, y1: ty, x2: this._cw, y2: ty });
                snapY = true; break;
              }
            }
          }
        }
      }
    }
  }

  _edges(o) {
    var b = o.getBoundingRect(true);
    return { l: b.left, t: b.top, r: b.left + b.width, b: b.top + b.height, cx: b.left + b.width / 2, cy: b.top + b.height / 2 };
  }

  alignSel(dir) {
    var fc = this._fc, act = fc.getActiveObject(); if (!act) return;
    var objs = act.type === 'activeSelection' ? act.getObjects() : [act];

    if (objs.length === 1) {
      var o = objs[0];
      switch (dir) {
        case 'left': o.set('left', 0); break;
        case 'centerH': o.set('left', this._cw / 2 - o.getScaledWidth() / 2); break;
        case 'right': o.set('left', this._cw - o.getScaledWidth()); break;
        case 'top': o.set('top', 0); break;
        case 'centerV': o.set('top', this._ch / 2 - o.getScaledHeight() / 2); break;
        case 'bottom': o.set('top', this._ch - o.getScaledHeight()); break;
      }
      o.setCoords(); fc.requestRenderAll(); this._pushH(); return;
    }

    var rs = objs.map(o => ({ o, b: o.getBoundingRect(true) }));
    var mnX = Math.min(...rs.map(r => r.b.left));
    var mxX = Math.max(...rs.map(r => r.b.left + r.b.width));
    var mnY = Math.min(...rs.map(r => r.b.top));
    var mxY = Math.max(...rs.map(r => r.b.top + r.b.height));

    for (var r of rs) {
      switch (dir) {
        case 'left':    r.o.set('left', r.o.left + (mnX - r.b.left)); break;
        case 'centerH': r.o.set('left', r.o.left + ((mnX + mxX) / 2 - r.b.left - r.b.width / 2)); break;
        case 'right':   r.o.set('left', r.o.left + (mxX - r.b.left - r.b.width)); break;
        case 'top':     r.o.set('top', r.o.top + (mnY - r.b.top)); break;
        case 'centerV': r.o.set('top', r.o.top + ((mnY + mxY) / 2 - r.b.top - r.b.height / 2)); break;
        case 'bottom':  r.o.set('top', r.o.top + (mxY - r.b.top - r.b.height)); break;
      }
      r.o.setCoords();
    }
    fc.requestRenderAll(); this._pushH();
  }

  distributeSel(axis) {
    var fc = this._fc, act = fc.getActiveObject();
    if (!act || act.type !== 'activeSelection') return;
    var objs = act.getObjects(); if (objs.length < 3) return;

    var rs = objs.map(o => ({ o, b: o.getBoundingRect(true) }));
    if (axis === 'horizontal') {
      rs.sort((a, b) => a.b.left - b.b.left);
      var tw = rs.reduce((s, r) => s + r.b.width, 0);
      var sp = (rs[rs.length - 1].b.left + rs[rs.length - 1].b.width - rs[0].b.left - tw) / (rs.length - 1);
      var x = rs[0].b.left;
      for (var r of rs) { r.o.set('left', r.o.left + (x - r.b.left)); r.o.setCoords(); x += r.b.width + sp; }
    } else {
      rs.sort((a, b) => a.b.top - b.b.top);
      var th = rs.reduce((s, r) => s + r.b.height, 0);
      var spV = (rs[rs.length - 1].b.top + rs[rs.length - 1].b.height - rs[0].b.top - th) / (rs.length - 1);
      var y = rs[0].b.top;
      for (var rv of rs) { rv.o.set('top', rv.o.top + (y - rv.b.top)); rv.o.setCoords(); y += rv.b.height + spV; }
    }
    fc.requestRenderAll(); this._pushH();
  }

  // ==================== 历史记录 ====================

  // 去抖版本：连续操作只在停顿后记录一次
  _pushH() {
    if (this._hLock || !this._fc) return;
    if (this._hTimer) clearTimeout(this._hTimer);
    this._hTimer = setTimeout(() => { this._hTimer = 0; this._pushHNow(); }, HISTORY_DEBOUNCE);
  }

  // 立即记录（初始化、加载时用）
  _pushHNow() {
    if (this._hLock || !this._fc) return;
    if (this._hTimer) { clearTimeout(this._hTimer); this._hTimer = 0; }
    var j = JSON.stringify(this._fc.toJSON(['_layerIdx', '_baseOp', '_locked']));
    this._hist = this._hist.slice(0, this._hIdx + 1);
    this._hist.push(j);
    if (this._hist.length > MAX_HISTORY) this._hist.shift();
    this._hIdx = this._hist.length - 1;
    this._cb.onHistoryChange?.(this.canUndo(), this.canRedo());
  }

  undo() { if (!this.canUndo()) return; this._hIdx--; this._restore(); }
  redo() { if (!this.canRedo()) return; this._hIdx++; this._restore(); }
  canUndo() { return this._hIdx > 0; }
  canRedo() { return this._hIdx < this._hist.length - 1; }

  _restore() {
    this._hLock = true;
    this._fc.loadFromJSON(this._hist[this._hIdx], () => {
      this._rebuildRefs(); this._fc.renderAll();
      this._hLock = false; this._fireSel(); this._fireLy();
      this._cb.onHistoryChange?.(this.canUndo(), this.canRedo());
    });
  }

  // ==================== 剪贴板 ====================

  copy() {
    var o = this._fc?.getActiveObject(); if (!o) return;
    o.clone(c => { this._clip = c; });
  }

  paste() {
    if (!this._clip || !this._fc) return;
    this._clip.clone(c => {
      c.set({ left: c.left + 20, top: c.top + 20, _layerIdx: this._aLy });
      if (c.type === 'activeSelection') {
        c.canvas = this._fc;
        c.forEachObject(o => { this._fc.add(o); this._addToLy(o); });
        c.setCoords();
      } else { this._fc.add(c); this._addToLy(c); }
      this._clip.set({ left: this._clip.left + 20, top: this._clip.top + 20 });
      this._fc.setActiveObject(c); this._fc.requestRenderAll(); this._pushH();
    });
  }

  duplicate() { this.copy(); this.paste(); }

  deleteSelected() {
    var fc = this._fc, act = fc?.getActiveObject(); if (!act) return;
    if (act.type === 'activeSelection') {
      act.forEachObject(o => { fc.remove(o); this._rmFromLy(o); });
      fc.discardActiveObject();
    } else { fc.remove(act); this._rmFromLy(act); }
    fc.requestRenderAll(); this._pushH();
  }

  // ==================== 键盘快捷键 ====================

  _onKey(e) {
    var act = this._fc?.getActiveObject();
    if (act && act.type === 'i-text' && act.isEditing) return;

    var ctrl = e.ctrlKey || e.metaKey, shift = e.shiftKey;
    var k = e.key.toLowerCase();

    if (!ctrl) {
      var toolMap = { v: 'select', r: 'rect', e: 'ellipse', l: 'line', p: 'pen', t: 'text', i: 'image', d: 'draw' };
      if (toolMap[k]) { e.preventDefault(); this.setTool(toolMap[k]); return; }
      if (k === 'delete' || k === 'backspace') { e.preventDefault(); this.deleteSelected(); return; }
      if (k === 'escape') {
        e.preventDefault();
        if (this._penPts.length) { this._clearTool(); this._initPen(); }
        else { this._fc?.discardActiveObject(); this._fc?.requestRenderAll(); }
        return;
      }
    }
    if (ctrl && !shift) {
      switch (k) {
        case 'z': e.preventDefault(); this.undo(); return;
        case 'c': e.preventDefault(); this.copy(); return;
        case 'v': e.preventDefault(); this.paste(); return;
        case 'd': e.preventDefault(); this.duplicate(); return;
        case 'g': e.preventDefault(); this.groupSel(); return;
        case 'a': e.preventDefault(); this._selectAll(); return;
      }
    }
    if (ctrl && shift) {
      if (k === 'z') { e.preventDefault(); this.redo(); return; }
      if (k === 'g') { e.preventDefault(); this.ungroupSel(); return; }
    }
  }

  _selectAll() {
    var fc = this._fc;
    var objs = fc.getObjects().filter(o => o.selectable);
    if (!objs.length) return;
    var sel = new fabric.ActiveSelection(objs, { canvas: fc });
    fc.setActiveObject(sel); fc.requestRenderAll();
  }

  // ==================== 事件触发 ====================

  _fireSel() {
    if (this._selTimer) return;
    this._selTimer = setTimeout(() => {
      this._selTimer = 0;
      this._cb.onSelectionChange?.(this.getSelInfo());
    }, 16); // ~1帧延迟，合并连续选择事件
  }
}
