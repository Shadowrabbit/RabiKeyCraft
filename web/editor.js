// ******************************************************************
// /\ /| @file editor.js
// \ V/ @brief KeyCraft 键帽编辑器 Vue 应用（底色 + 图案图层统一架构）
// | "") @author Catarina·RabbitNya, yingtu0401@gmail.com
// / |
// / \\ @Modified 2026-03-08 22:30:00
// *(__\_\ @Copyright Copyright (c) 2026, Shadowrabbit
// ******************************************************************

import { layouts, groupNames } from './lib/layout-data.js';
import { KeycapRenderer } from './lib/keycap-renderer.js';
import { KeyDesigner } from './lib/key-designer.js';
import { KD_LEGENDS, insertLegend } from './lib/kd-legends.js';

var _layerUid = 0;

// 默认分区底色（文字色由底色自动推导）
var DEFAULT_ZONES = {
  alpha:  { base: '#3c3c3c' },
  num:    { base: '#3c3c3c' },
  mod:    { base: '#5a5a5a' },
  frow:   { base: '#5a5a5a' },
  nav:    { base: '#5a5a5a' },
  arrow:  { base: '#5a5a5a' },
  numpad: { base: '#3c3c3c' },
  space:  { base: '#5a5a5a' }
};

/** 根据底色亮度自动计算文字色（深底→白字，浅底→黑字） */
function autoLegend(hex) {
  var c = hex.replace('#', '');
  if (c.length === 3) c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
  var r = parseInt(c.substring(0,2), 16);
  var g = parseInt(c.substring(2,4), 16);
  var b = parseInt(c.substring(4,6), 16);
  var lum = (r * 299 + g * 587 + b * 114) / 1000;
  return lum > 140 ? '#333333' : '#ffffff';
}

const { createApp } = Vue;

createApp({
  data() {
    return {
      layouts,
      groupNames,
      currentLayout: 'tkl',
      keycapProfile: 'cherry',
      keycapMaterial: 'pbt',
      caseColor: '#2a2a2e',
      caseMaterial: 'plastic',

      // 底色图层 — 分区颜色
      zoneColors: JSON.parse(JSON.stringify(DEFAULT_ZONES)),
      showZoneOverride: false, // 分区覆盖折叠态
      clipboard: null, // 颜色剪贴板 { base }

      // 图案图层
      layers: [],
      activeLayerIdx: -1,
      showLegend: true,
      dragOver: false,

      // 选中键帽（只读信息）
      selectedKey: null,
      selectedDef: null,
      propBase: '#3c3c3c',
      propLegend: '#ffffff',

      // 单键覆盖
      overrides: {},

      // ===== 单键矢量编辑器 =====
      showDesigner: false,
      dTool: 'select',
      dZoom: 100,
      dGridOn: true,
      dSnapGrid: true,
      dCanUndo: false,
      dCanRedo: false,
      dSel: null,         // 当前选中对象属性
      dLayers: [],
      dActiveLy: 0,
      dFonts: [],
      dFillType: 'solid',
      dFillC1: '#7c4dff',
      dFillC2: '#00d4ff',
      dGradAngle: 0,
      dStrokeC: '#ffffff',
      dStrokeW: 2,
      dOpacity: 1,
      kdTools: [
        { id: 'select',  icon: '⇢', name: '选择', tip: '选择 (V)' },
        { id: 'rect',    icon: '⬜', name: '矩形', tip: '矩形 (R)' },
        { id: 'ellipse', icon: '⭕', name: '椭圆', tip: '椭圆 (E)' },
        { id: 'line',    icon: '╱',  name: '线段', tip: '线段 (L)' },
        { id: 'pen',     icon: '✒',  name: '钢笔', tip: '贝塞尔钢笔 (P)' },
        { id: 'text',    icon: 'T',  name: '文本', tip: '文本 (T)' },
        { id: 'image',   icon: '🖼', name: '图片', tip: '图片 (I)' },
        { id: 'draw',    icon: '✏',  name: '画笔', tip: '自由画笔 (D)' },
      ],
      kdLegends: KD_LEGENDS
    };
  },

  computed: {
    activeLayer() {
      return this.layers[this.activeLayerIdx] ?? null;
    },
    hasAnyImage() {
      return this.layers.some(l => l.image);
    }
  },

  mounted() {
    this._renderer = new KeycapRenderer(this.$refs.viewport, (keyId) => {
      this._onKeySelected(keyId);
    });
    this._renderer.setProfile(this.keycapProfile);
    this._renderer.setMaterial(this.keycapMaterial);
    this._renderer.setCaseColor(this.caseColor);
    this._renderer.setCaseMaterial(this.caseMaterial);
    this._loadCurrentLayout();

    window.addEventListener('resize', () => this._renderer?.resize());
    this._restoreDraft();
  },

  methods: {
    // ==================== 布局加载 ====================

    _loadCurrentLayout() {
      var layout = this.layouts[this.currentLayout];
      if (!layout) return;
      this._renderer.loadLayout(layout);
      this._applyAll();
    },

    /** 总入口：先应用底色，再叠加图案图层 */
    _applyAll() {
      var zc = this.zoneColors;
      var first = zc.alpha || { base: '#3c3c3c' };
      var scheme = {
        id: 'user',
        name: '用户自定义',
        base: first.base,
        legend: autoLegend(first.base),
        groups: {}
      };
      for (var key in zc) {
        var base = zc[key].base || '#3c3c3c';
        scheme.groups[key] = { base: base, legend: autoLegend(base) };
      }
      this._renderer.setColorScheme(scheme);

      // 应用单键覆盖
      for (var [keyId, ov] of Object.entries(this.overrides)) {
        this._renderer.updateKeycap(keyId, ov);
      }

      // 叠加图案图层
      this._refreshLayers();
    },

    // ==================== 底色设计 ====================

    /** 全键底色：设置所有分区为同一底色 */
    applyGlobalBase(color) {
      for (var key in this.zoneColors) {
        this.zoneColors[key].base = color;
      }
      this._applyAll();
      this._saveDraft();
    },

    setZoneBase(gkey, color) {
      if (!this.zoneColors[gkey]) this.zoneColors[gkey] = { base: '#3c3c3c' };
      this.zoneColors[gkey].base = color;
      this._applyAll();
      this._saveDraft();
    },

    copyZoneColor(gkey) {
      var zc = this.zoneColors[gkey];
      if (!zc) return;
      this.clipboard = { base: zc.base };
    },

    pasteZoneColor(gkey) {
      if (!this.clipboard) return;
      if (!this.zoneColors[gkey]) this.zoneColors[gkey] = { base: '#3c3c3c' };
      this.zoneColors[gkey].base = this.clipboard.base;
      this._applyAll();
      this._saveDraft();
    },

    resetZoneColors() {
      this.zoneColors = JSON.parse(JSON.stringify(DEFAULT_ZONES));
      this.overrides = {};
      this._applyAll();
      this._saveDraft();
    },

    // ==================== 布局 / 轮廓 / 材质 ====================

    onLayoutChange() {
      this.selectedKey = null;
      this.selectedDef = null;
      this.overrides = {};
      this._loadCurrentLayout();
    },

    onProfileChange() {
      this._renderer.setProfile(this.keycapProfile);
      this._loadCurrentLayout();
    },

    onMaterialChange() {
      this._renderer.setMaterial(this.keycapMaterial);
      this._loadCurrentLayout();
    },

    onCaseColorChange() {
      this._renderer.setCaseColor(this.caseColor);
    },

    onCaseMaterialChange() {
      this._renderer.setCaseMaterial(this.caseMaterial);
    },

    // ==================== 键帽选中（只读信息） ====================

    _onKeySelected(keyId) {
      if (!keyId) {
        this.selectedKey = null;
        this.selectedDef = null;
        return;
      }
      var layout = this.layouts[this.currentLayout];
      var def = layout.keys.find(k => k.id === keyId);
      if (!def) return;

      this.selectedKey = keyId;
      this.selectedDef = def;

      var ov = this.overrides[keyId];
      var zc = this.zoneColors[def.group] || { base: '#3c3c3c' };
      this.propBase = ov?.base ?? zc.base;
      this.propLegend = autoLegend(this.propBase);
    },

    onDeselectKey() {
      this._renderer.deselectKey();
    },

    // ==================== 单键矢量编辑器 ====================

    openDesigner() {
      if (!this.selectedKey || !this.selectedDef) return;
      this.showDesigner = true;
      this.$nextTick(() => {
        var el = this.$refs.kdCanvas;
        if (!el) return;
        this.designer = new KeyDesigner(el, {
          onSelectionChange: info => this._onDSel(info),
          onLayerChange: (layers, active) => { this.dLayers = layers; this.dActiveLy = active; },
          onHistoryChange: (u, r) => { this.dCanUndo = u; this.dCanRedo = r; },
          onToolChange: id => { this.dTool = id; },
          onFontsChange: fonts => { this.dFonts = fonts; }
        });
        this.dFonts = this.designer.getFonts();
        var ov = this.overrides[this.selectedKey];
        var zc = this.zoneColors[this.selectedDef.group] || { base: '#3c3c3c' };
        var baseColor = ov?.base ?? zc.base;
        this.designer.open(this.selectedDef, baseColor, ov?.fabricData || null);
        this.dZoom = this.designer.getZoom();
      });
    },

    closeDesigner() {
      if (this.designer) { this.designer.close(); this.designer = null; }
      this.showDesigner = false;
      this.dSel = null;
    },

    saveDesigner() {
      if (!this.designer || !this.selectedKey) return;
      var result = this.designer.save();
      if (!result) return;

      // 存储 Fabric.js JSON 到覆盖
      if (!this.overrides[this.selectedKey]) this.overrides[this.selectedKey] = {};
      this.overrides[this.selectedKey].fabricData = result.json;

      // 将画布渲染到 3D 纹理
      this._renderer.updateKeycapTexture(this.selectedKey, result.textureCanvas);

      this._saveDraft();
      this.closeDesigner();
    },

    setDTool(id) {
      this.dTool = id;
      this.designer?.setTool(id);
    },

    _onDSel(info) {
      this.dSel = info;
      if (info) {
        this.dOpacity = info.opacity ?? 1;
        this.dStrokeC = info.stroke || '#ffffff';
        this.dStrokeW = info.strokeWidth || 0;
        this.dFillType = info.fillType || 'solid';
        if (info.fillType === 'solid') {
          this.dFillC1 = (typeof info.fill === 'string') ? info.fill : '#7c4dff';
        } else {
          this.dFillC1 = info.gradC1 || '#7c4dff';
          this.dFillC2 = info.gradC2 || '#00d4ff';
        }
      }
    },

    applyFill() {
      if (!this.designer) return;
      if (this.dFillType === 'solid') {
        this.designer.setFill(this.dFillC1);
      } else {
        this.designer.setGradient(this.dFillType, this.dFillC1, this.dFillC2, this.dGradAngle);
      }
    },

    applyTransform() {
      if (!this.designer || !this.dSel) return;
      this.designer.setTransform({ left: this.dSel.left, top: this.dSel.top, angle: this.dSel.angle });
    },

    insertLegendItem(lg) {
      if (!this.designer?._fc) return;
      var fc = this.designer._fc;
      var t = insertLegend(fc, lg, this.designer._cw / 2, this.designer._ch / 2);
      t._layerIdx = this.designer._aLy;
      this.designer._addToLy(t);
      this.designer._pushH();
    },

    async onFontUpload(e) {
      var file = e.target.files?.[0];
      if (!file || !this.designer) return;
      await this.designer.uploadFont(file);
      e.target.value = '';
    },

    // ==================== 图层管理 ====================

    addLayer() {
      var layer = {
        id: 'L' + (++_layerUid),
        name: '图层 ' + (this.layers.length + 1),
        image: null,
        imageUrl: '',
        offsetX: 0.5,
        offsetY: 0.5,
        scale: 1,
        opacity: 1,
        visible: true
      };
      this.layers.push(layer);
      this.activeLayerIdx = this.layers.length - 1;
    },

    removeLayer(idx) {
      var layer = this.layers[idx];
      if (layer?.imageUrl) URL.revokeObjectURL(layer.imageUrl);
      this.layers.splice(idx, 1);
      if (this.activeLayerIdx >= this.layers.length) {
        this.activeLayerIdx = Math.max(0, this.layers.length - 1);
      }
      if (this.layers.length === 0) this.activeLayerIdx = -1;
      this._refreshLayers();
    },

    selectLayer(idx) {
      this.activeLayerIdx = idx;
    },

    toggleLayerVisible(idx) {
      this.layers[idx].visible = !this.layers[idx].visible;
      this._refreshLayers();
    },

    moveLayer(idx, dir) {
      var target = idx + dir;
      if (target < 0 || target >= this.layers.length) return;
      var tmp = this.layers[idx];
      this.layers[idx] = this.layers[target];
      this.layers[target] = tmp;
      if (this.activeLayerIdx === idx) this.activeLayerIdx = target;
      else if (this.activeLayerIdx === target) this.activeLayerIdx = idx;
      this._refreshLayers();
    },

    // ==================== 图层图片 ====================

    onFileSelect(e) {
      var file = e.target.files?.[0];
      if (file) this._loadLayerImage(file);
      e.target.value = '';
    },

    onDrop(e) {
      this.dragOver = false;
      var file = e.dataTransfer.files?.[0];
      if (file && file.type.startsWith('image/')) this._loadLayerImage(file);
    },

    _loadLayerImage(file) {
      var layer = this.activeLayer;
      if (!layer) return;
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = () => {
        if (layer.imageUrl) URL.revokeObjectURL(layer.imageUrl);
        layer.image = img;
        layer.imageUrl = url;
        layer.offsetX = 0.5;
        layer.offsetY = 0.5;
        layer.scale = 1;
        this._refreshLayers();
      };
      img.src = url;
    },

    clearLayerImage() {
      var layer = this.activeLayer;
      if (!layer) return;
      if (layer.imageUrl) URL.revokeObjectURL(layer.imageUrl);
      layer.image = null;
      layer.imageUrl = '';
      this._refreshLayers();
    },

    // ==================== 图层刷新 ====================

    onLayerUpdate() {
      this._refreshLayers();
    },

    onToggleLegend() {
      this._refreshLayers();
    },

    resetLayerPos() {
      var layer = this.activeLayer;
      if (!layer) return;
      layer.offsetX = 0.5;
      layer.offsetY = 0.5;
      layer.scale = 1;
      this._refreshLayers();
    },

    _getLayerOpts() {
      return {
        showLegend: this.showLegend,
        legendOutline: true,
        bgColor: '#222222'
      };
    },

    /** 将可见图案图层送入渲染器 */
    _refreshLayers() {
      var layerData = this.layers
        .filter(l => l.visible && l.image)
        .map(l => ({
          image: l.image,
          ox: l.offsetX,
          oy: l.offsetY,
          scale: l.scale,
          opacity: l.opacity
        }));

      if (layerData.length > 0) {
        this._renderer.applyLayers(layerData, this._getLayerOpts());
      } else {
        this._renderer.clearImageOverlay();
      }
    },

    // ==================== 视角 / 导出 ====================

    resetView() {
      this._renderer.deselectKey();
      this._renderer.resetCamera();
    },

    exportPNG() {
      var dataUrl = this._renderer.exportImage(2560, 1440);
      var a = document.createElement('a');
      a.href = dataUrl;
      a.download = `keycap-design-${Date.now()}.png`;
      a.click();
    },

    // ==================== 草稿 ====================

    _saveDraft() {
      try {
        var draft = {
          layout: this.currentLayout,
          profile: this.keycapProfile,
          material: this.keycapMaterial,
          caseColor: this.caseColor,
          caseMaterial: this.caseMaterial,
          zoneColors: this.zoneColors,
          overrides: this.overrides
        };
        localStorage.setItem('kc_editor_draft', JSON.stringify(draft));
      } catch (_) { /* 静默 */ }
    },

    _restoreDraft() {
      try {
        var raw = localStorage.getItem('kc_editor_draft');
        if (!raw) return;
        var draft = JSON.parse(raw);
        if (draft.layout && this.layouts[draft.layout]) {
          this.currentLayout = draft.layout;
        }
        if (draft.profile) {
          this.keycapProfile = draft.profile;
          this._renderer.setProfile(draft.profile);
        }
        if (draft.material) {
          this.keycapMaterial = draft.material;
          this._renderer.setMaterial(draft.material);
        }
        if (draft.caseColor) {
          this.caseColor = draft.caseColor;
          this._renderer.setCaseColor(draft.caseColor);
        }
        if (draft.caseMaterial) {
          this.caseMaterial = draft.caseMaterial;
          this._renderer.setCaseMaterial(draft.caseMaterial);
        }
        if (draft.zoneColors) {
          for (var k in draft.zoneColors) {
            if (this.zoneColors[k]) Object.assign(this.zoneColors[k], draft.zoneColors[k]);
          }
        }
        if (draft.overrides) this.overrides = draft.overrides;
        this._loadCurrentLayout();
      } catch (_) { /* 静默 */ }
    }
  }
}).mount('#app');
