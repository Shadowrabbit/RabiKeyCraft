// ******************************************************************
// /\ /| @file editor.js
// \ V/ @brief KeyCraft 键帽编辑器 Vue 应用（多图层 + 自定义配色）
// | "") @author Catarina·RabbitNya, yingtu0401@gmail.com
// / |
// / \\ @Modified 2026-03-09 03:30:00
// *(__\_\ @Copyright Copyright (c) 2026, Shadowrabbit
// ******************************************************************

import { layouts, groupNames } from './lib/layout-data.js';
import { colorSchemes } from './lib/color-schemes.js';
import { KeycapRenderer } from './lib/keycap-renderer.js';

var _layerUid = 0;

const { createApp } = Vue;

createApp({
  data() {
    return {
      layouts,
      groupNames,
      colorSchemes,
      currentLayout: 'tkl',
      currentScheme: 'classic-dark',
      mode: 'pro',
      keycapProfile: 'cherry',
      keycapMaterial: 'pbt',
      caseColor: '#2a2a2e',
      caseMaterial: 'plastic',

      // 自定义配色
      useCustomScheme: false,
      customScheme: {
        base: '#3c3c3c',
        legend: '#ffffff',
        modBase: '#5a5a5a',
        modLegend: '#ffffff',
        accentBase: '#00d4ff',
        accentLegend: '#000000'
      },

      // 选中键帽（专业模式）
      selectedKey: null,
      selectedDef: null,
      propBase: '#3c3c3c',
      propLegend: '#ffffff',
      propLabel: '',
      propFont: '',

      // 简易模式 - 多图层
      layers: [],
      activeLayerIdx: -1,
      simpleShowLegend: true,
      simpleLegendColor: '#ffffff',
      dragOver: false,

      // 单键覆盖（专业模式）
      overrides: {}
    };
  },

  computed: {
    /** 当前活跃图层对象 */
    activeLayer() {
      return this.layers[this.activeLayerIdx] ?? null;
    },
    /** 是否有任何图层包含图片 */
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
    // ==================== 布局 / 配色 ====================

    _loadCurrentLayout() {
      var layout = this.layouts[this.currentLayout];
      if (!layout) return;
      this._renderer.loadLayout(layout);
      this._applyCurrentScheme();
    },

    _applyCurrentScheme() {
      if (this.useCustomScheme) {
        this._applyCustomScheme();
        return;
      }
      var scheme = this.colorSchemes.find(s => s.id === this.currentScheme);
      if (!scheme) return;
      this._renderer.setColorScheme(scheme);

      for (var [keyId, ov] of Object.entries(this.overrides)) {
        this._renderer.updateKeycap(keyId, ov);
      }

      if (this.mode === 'simple') this._refreshLayers();
    },

    /** 构造并应用自定义配色 */
    _applyCustomScheme() {
      var cs = this.customScheme;
      var scheme = {
        id: 'custom',
        name: '自定义',
        base: cs.base,
        legend: cs.legend,
        accent: cs.modBase,
        accentLegend: cs.modLegend,
        groups: {
          alpha: { base: cs.base, legend: cs.legend },
          mod:   { base: cs.modBase, legend: cs.modLegend },
          frow:  { base: cs.modBase, legend: cs.modLegend },
          nav:   { base: cs.modBase, legend: cs.modLegend },
          space: { base: cs.accentBase, legend: cs.accentLegend },
          num:   { base: cs.base, legend: cs.legend }
        }
      };
      this._renderer.setColorScheme(scheme);
      for (var [keyId, ov] of Object.entries(this.overrides)) {
        this._renderer.updateKeycap(keyId, ov);
      }
      if (this.mode === 'simple') this._refreshLayers();
    },

    toggleCustomScheme() {
      this._applyCurrentScheme();
      this._saveDraft();
    },

    onCustomColorChange() {
      if (!this.useCustomScheme) return;
      this._applyCustomScheme();
      this._saveDraft();
    },

    onLayoutChange() {
      this.selectedKey = null;
      this.selectedDef = null;
      this.overrides = {};
      this._loadCurrentLayout();
    },

    onSchemeChange() {
      this.useCustomScheme = false;
      this._applyCurrentScheme();
    },

    applyScheme(id) {
      this.currentScheme = id;
      this.useCustomScheme = false;
      this._applyCurrentScheme();
    },

    getGroupColor(groupKey) {
      if (this.useCustomScheme) {
        var cs = this.customScheme;
        if (groupKey === 'alpha' || groupKey === 'num') return cs.base;
        if (groupKey === 'space') return cs.accentBase;
        return cs.modBase;
      }
      var scheme = this.colorSchemes.find(s => s.id === this.currentScheme);
      if (!scheme) return '#888';
      return scheme.groups?.[groupKey]?.base ?? scheme.base;
    },

    // ==================== 轮廓切换 ====================

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

    // ==================== 模式切换 ====================

    setMode(m) {
      this.mode = m;
      if (m === 'pro') {
        this._renderer.clearImageOverlay();
        this._applyCurrentScheme();
      } else {
        // 进入简易模式，自动创建第一个图层
        if (this.layers.length === 0) this.addLayer();
        this._refreshLayers();
      }
    },

    // ==================== 键帽选中（专业模式） ====================

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
      var scheme = this.colorSchemes.find(s => s.id === this.currentScheme);
      var groupOv = scheme?.groups?.[def.group];

      this.propBase = ov?.base ?? groupOv?.base ?? scheme?.base ?? '#3c3c3c';
      this.propLegend = ov?.legend ?? groupOv?.legend ?? scheme?.legend ?? '#ffffff';
      this.propLabel = ov?.label ?? def.label;
      this.propFont = ov?.font ?? '';
    },

    onDeselectKey() {
      this._renderer.deselectKey();
    },

    applyProp() {
      if (!this.selectedKey) return;
      var ov = {
        base: this.propBase,
        legend: this.propLegend,
        label: this.propLabel,
        legendFont: this.propFont
      };
      this.overrides[this.selectedKey] = ov;
      this._renderer.updateKeycap(this.selectedKey, ov);
      this._saveDraft();
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
      // 调整活跃索引
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

    /** 图层排序（dir: -1 上移 / +1 下移） */
    moveLayer(idx, dir) {
      var target = idx + dir;
      if (target < 0 || target >= this.layers.length) return;
      var tmp = this.layers[idx];
      this.layers[idx] = this.layers[target];
      this.layers[target] = tmp;
      // 跟随活跃索引
      if (this.activeLayerIdx === idx) this.activeLayerIdx = target;
      else if (this.activeLayerIdx === target) this.activeLayerIdx = idx;
      this._refreshLayers();
    },

    // ==================== 图层图片上传 ====================

    onFileSelect(e) {
      var file = e.target.files?.[0];
      if (file) this._loadLayerImage(file);
      // 清空 input 以便重复选择同一文件
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

    // ==================== 图层参数更新 ====================

    onLayerUpdate() {
      this._refreshLayers();
    },

    onToggleLegend() {
      this._refreshLayers();
    },

    onLegendColorChange() {
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

    /** 构建简易模式渲染选项 */
    _getSimpleOpts() {
      return {
        showLegend: this.simpleShowLegend,
        legendColor: this.simpleLegendColor,
        legendOutline: true,
        bgColor: '#222222'
      };
    },

    /** 将图层数据送入渲染器 */
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
        this._renderer.applyLayers(layerData, this._getSimpleOpts());
      } else {
        // 无可见图片时恢复配色方案（直接调用渲染器避免递归）
        this._renderer.clearImageOverlay();
        var scheme = this.colorSchemes.find(s => s.id === this.currentScheme);
        if (scheme) this._renderer.setColorScheme(scheme);
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
          scheme: this.currentScheme,
          profile: this.keycapProfile,
          material: this.keycapMaterial,
          caseColor: this.caseColor,
          caseMaterial: this.caseMaterial,
          useCustomScheme: this.useCustomScheme,
          customScheme: { ...this.customScheme },
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
        if (draft.scheme) this.currentScheme = draft.scheme;
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
        if (draft.overrides) this.overrides = draft.overrides;
        if (draft.useCustomScheme !== undefined) this.useCustomScheme = draft.useCustomScheme;
        if (draft.customScheme) Object.assign(this.customScheme, draft.customScheme);
        this._loadCurrentLayout();
      } catch (_) { /* 静默 */ }
    }
  }
}).mount('#app');
