// ******************************************************************
// /\ /| @file keycap-renderer.js
// \ V/ @brief Three.js 键帽 3D 渲染引擎（真实轮廓 / 高级材质 / 键盘外壳）
// | "") @author Catarina·RabbitNya, yingtu0401@gmail.com
// / |
// / \\ @Modified 2026-03-09 00:30:00
// *(__\_\ @Copyright Copyright (c) 2026, Shadowrabbit
// ******************************************************************

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ============ 基本常量 ============
var UNIT = 1;
var GAP = 0.06;
var TEX_BASE = 128;
var HIGHLIGHT_EMISSIVE = 0x335566;
var CLICK_THRESHOLD_SQ = 9; // 鼠标移动 ≤3px 才视为点击

// ============ 轮廓参数 ============
// 高度: 键帽厂商行业标准 + Signature Plastics 官方尺寸
// 形状: KeyV2 实测 + keycaps.info 截面图参考
// curve: 侧面曲线指数 — 1.0=直线(Cherry/OEM) >1=弧线(SA/DSA/XDA)
// taperX/Z: 顶面宽/深 ÷ 底面  dish/dishType: 凹面  skew: 顶面后偏
// round: 侧面圆润  rows[]/h: 行高/统一高度(UNIT)
var PROFILES = {
  cherry: {
    taperX: 0.65, taperZ: 0.81, dish: 0.041, dishType: 'cyl',
    skew: 0.105, round: 0, curve: 1.0,
    rows: [
      { h: 0.493, tilt:  0     }, // R0 F-row     9.4mm    0°
      { h: 0.446, tilt:  0.021 }, // R1 数字行    8.5mm    2.5°
      { h: 0.420, tilt:  0.041 }, // R2 QWERTY    8.0mm    5°
      { h: 0.394, tilt:  0.041 }, // R3 Home      7.5mm    5°
      { h: 0.420, tilt:  0.096 }, // R4 底部      8.0mm   11.5°
    ]
  },
  oem: {
    taperX: 0.68, taperZ: 0.78, dish: 0.063, dishType: 'cyl',
    skew: 0.092, round: 0, curve: 1.0,
    rows: [
      { h: 0.630, tilt: -0.025 }, // R0 F-row    12.0mm   -3°
      { h: 0.577, tilt:  0.008 }, // R1 数字行   11.0mm    1°
      { h: 0.525, tilt:  0.049 }, // R2 QWERTY   10.0mm    6°
      { h: 0.551, tilt:  0.074 }, // R3 Home     10.5mm    9°
      { h: 0.551, tilt:  0.083 }, // R4 底部     10.5mm   10°
    ]
  },
  sa: {
    taperX: 0.69, taperZ: 0.69, dish: 0.054, dishType: 'sph',
    skew: 0, round: 0.08, curve: 1.4,
    rows: [
      { h: 0.866, tilt: -0.109 }, // R0 F-row    16.5mm  -13°
      { h: 0.866, tilt: -0.058 }, // R1 数字行   16.5mm   -7°
      { h: 0.771, tilt:  0     }, // R2 QWERTY   14.7mm    0°
      { h: 0.672, tilt:  0     }, // R3 Home     12.8mm    0°
      { h: 0.745, tilt:  0.058 }, // R4 底部     14.2mm    7°
    ]
  },
  dsa: {
    taperX: 0.67, taperZ: 0.67, dish: 0.076, dishType: 'sph',
    skew: 0, round: 0.06, curve: 1.3,
    h: 0.399, tilt: 0   // 7.6mm 统一
  },
  xda: {
    taperX: 0.78, taperZ: 0.78, dish: 0.031, dishType: 'sph',
    skew: 0, round: 0.03, curve: 1.2,
    h: 0.499, tilt: 0   // 9.5mm 统一
  },
  moa: {
    taperX: 0.72, taperZ: 0.72, dish: 0.050, dishType: 'sph',
    skew: 0, round: 0.06, curve: 1.3,
    h: 0.525, tilt: 0   // 10.0mm 统一
  },
};

// ============ 材质参数（envMapIntensity 控制环境反射强度）============
var MATERIALS = {
  pbt:         { roughness: 0.72, metalness: 0.0,  physical: false, envMapIntensity: 0.4 },
  abs:         { roughness: 0.22, metalness: 0.0,  physical: false, envMapIntensity: 0.9 },
  translucent: { roughness: 0.15, metalness: 0.0,  physical: true,  envMapIntensity: 1.0, transmission: 0.35, thickness: 1.2, ior: 1.45 },
  metal:       { roughness: 0.10, metalness: 0.92, physical: true,  envMapIntensity: 1.6, clearcoat: 1.0, clearcoatRoughness: 0.08 },
};

export class KeycapRenderer {
  /** @param {HTMLElement} container  @param {Function} onKeySelect 回调(keyId|null) */
  constructor(container, onKeySelect) {
    this._container = container;
    this._onKeySelect = onKeySelect;
    this._keycaps = new Map();
    this._selectedId = null;
    this._layoutBounds = null;
    this._cameraGoal = null;
    this._overviewGoal = null;
    this._layersData = null;
    this._mode = 'pro';
    this._profile = 'cherry';
    this._material = 'pbt';
    this._caseColor = '#2a2a2e';
    this._caseMaterialType = 'plastic';
    this._caseMesh = null;
    this._pointerStart = null;

    this._initScene();
    this._initLights();
    this._initGround();
    this._initEnvironment();
    this._initInteraction();
    this._animate();
  }

  // ==================== 场景初始化 ====================

  _initScene() {
    this._scene = new THREE.Scene();
    this._scene.background = new THREE.Color(0x12121a);

    var { clientWidth: w, clientHeight: h } = this._container;
    this._camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    this._camera.position.set(0, 12, 10);

    this._renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this._renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this._renderer.setSize(w, h);
    this._renderer.shadowMap.enabled = true;
    this._renderer.shadowMap.type = THREE.PCFShadowMap;
    this._renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this._renderer.toneMappingExposure = 1.25;
    this._container.appendChild(this._renderer.domElement);

    this._controls = new OrbitControls(this._camera, this._renderer.domElement);
    this._controls.enableDamping = true;
    this._controls.dampingFactor = 0.08;
    this._controls.maxPolarAngle = Math.PI * 0.48;
    this._controls.minDistance = 3;
    this._controls.maxDistance = 40;
  }

  _initLights() {
    this._scene.add(new THREE.AmbientLight(0xffffff, 0.30));
    this._scene.add(new THREE.HemisphereLight(0x8899cc, 0x443322, 0.45));

    // 主光源（偏暖白，模拟顶部左前方灯光）
    var dir = new THREE.DirectionalLight(0xfff5e6, 1.05);
    dir.position.set(-6, 14, 6);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    dir.shadow.camera.near = 1;
    dir.shadow.camera.far = 35;
    dir.shadow.camera.left = -16;
    dir.shadow.camera.right = 16;
    dir.shadow.camera.top = 16;
    dir.shadow.camera.bottom = -16;
    dir.shadow.bias = -0.0008;
    dir.shadow.normalBias = 0.02;
    this._scene.add(dir);

    // 补光（冷色偏右）
    var fill = new THREE.DirectionalLight(0xaaccff, 0.35);
    fill.position.set(8, 8, -5);
    this._scene.add(fill);

    // 背光 / 边缘光（勾勒键帽轮廓）
    var rim = new THREE.DirectionalLight(0x6688aa, 0.30);
    rim.position.set(0, 6, -10);
    this._scene.add(rim);

    // 桌面漫反射暖光
    var bounce = new THREE.PointLight(0x554433, 0.12, 30);
    bounce.position.set(0, -2, 0);
    this._scene.add(bounce);
  }

  _initGround() {
    var geo = new THREE.PlaneGeometry(60, 60);
    var mat = new THREE.MeshStandardMaterial({ color: 0x16161e, roughness: 0.95, metalness: 0 });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = -0.01;
    mesh.receiveShadow = true;
    this._scene.add(mesh);
    this._ground = mesh;
  }

  /** 生成高对比度渐变天空球 + 模拟窗口亮斑作为环境反射源 */
  _initEnvironment() {
    var pmrem = new THREE.PMREMGenerator(this._renderer);
    var envScene = new THREE.Scene();

    var geo = new THREE.IcosahedronGeometry(20, 3);
    var pos = geo.getAttribute('position');
    var colors = [];
    var zenith  = new THREE.Color(0x667799);
    var horizon = new THREE.Color(0xccbbaa);
    var nadir   = new THREE.Color(0x1a1a22);
    var white   = new THREE.Color(0xffffff);
    var tmp = new THREE.Color();

    for (var i = 0; i < pos.count; i++) {
      var ny = pos.getY(i) / 20;
      if (ny > 0) {
        tmp.lerpColors(horizon, zenith, ny);
      } else {
        tmp.lerpColors(horizon, nadir, -ny);
      }
      // 窗口亮斑（左前上方）增加反射高光
      var px = pos.getX(i) / 20;
      var pz = pos.getZ(i) / 20;
      var spot = Math.sqrt((px - 0.3) ** 2 + (ny - 0.6) ** 2 + (pz + 0.2) ** 2);
      if (spot < 0.4) {
        tmp.lerp(white, (1 - spot / 0.4) * 0.55);
      }
      colors.push(tmp.r, tmp.g, tmp.b);
    }

    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    envScene.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));

    this._scene.environment = pmrem.fromScene(envScene, 0.04).texture;
    geo.dispose();
    pmrem.dispose();
  }

  /** 点击 vs 拖拽区分：pointerdown 记录起点，pointerup 判断位移 */
  _initInteraction() {
    this._raycaster = new THREE.Raycaster();
    this._mouse = new THREE.Vector2();

    var el = this._renderer.domElement;
    el.addEventListener('pointerdown', (e) => {
      if (e.button === 0) this._pointerStart = { x: e.clientX, y: e.clientY };
    });
    el.addEventListener('pointerup', (e) => {
      if (!this._pointerStart || e.button !== 0) return;
      var dx = e.clientX - this._pointerStart.x;
      var dy = e.clientY - this._pointerStart.y;
      if (dx * dx + dy * dy < CLICK_THRESHOLD_SQ) this._onClick(e);
      this._pointerStart = null;
    });
  }

  // ==================== 轮廓 / 材质 / 外壳 设置 ====================

  setProfile(profile) { this._profile = profile; }

  setMaterial(material) { this._material = material; }

  setCaseColor(color) {
    this._caseColor = color;
    if (this._caseMesh) this._caseMesh.material.color.set(color);
  }

  setCaseMaterial(type) {
    this._caseMaterialType = type;
    if (this._caseMesh) {
      var isM = type === 'metal';
      this._caseMesh.material.roughness = isM ? 0.25 : 0.65;
      this._caseMesh.material.metalness = isM ? 0.80 : 0.02;
    }
  }

  // ==================== 布局加载 ====================

  loadLayout(layoutData) {
    for (var cap of this._keycaps.values()) {
      this._scene.remove(cap.mesh);
      cap.mesh.geometry.dispose();
      cap.bodyMat.dispose();
      cap.topMat.dispose();
      cap.texture.dispose();
    }
    this._keycaps.clear();
    this._selectedId = null;

    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (var k of layoutData.keys) {
      minX = Math.min(minX, k.x);
      maxX = Math.max(maxX, k.x + k.w);
      minY = Math.min(minY, k.y);
      maxY = Math.max(maxY, k.y + (k.h || 1));
    }
    var cx = (minX + maxX) / 2;
    var cy = (minY + maxY) / 2;
    this._layoutBounds = { minX, maxX, minY, maxY, cx, cy, w: maxX - minX, h: maxY - minY };

    for (var def of layoutData.keys) {
      this._createKeycap(def, cx, cy);
    }

    this._buildCase();

    var dist = Math.max(this._layoutBounds.w, this._layoutBounds.h) * 0.85;
    this._overviewGoal = {
      pos: new THREE.Vector3(0, dist * 0.8, dist * 0.55),
      target: new THREE.Vector3(0, 0, 0)
    };
    this._cameraGoal = { ...this._overviewGoal };
    this._camera.position.copy(this._overviewGoal.pos);
    this._controls.target.copy(this._overviewGoal.target);
  }

  // ==================== 键帽创建 ====================

  _createKeycap(def, cx, cy) {
    var w = def.w * UNIT - GAP;
    var d = (def.h || 1) * UNIT - GAP;

    var { geo, h } = this._buildProfileGeo(w, d, def.row);

    var texW = Math.round(TEX_BASE * def.w);
    var texH = Math.round(TEX_BASE * (def.h || 1));
    var canvas = document.createElement('canvas');
    canvas.width = texW;
    canvas.height = texH;
    var texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    var mp = MATERIALS[this._material] || MATERIALS.pbt;
    var MatCls = mp.physical ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;

    var bodyProps = {
      color: 0x3c3c3c,
      roughness: mp.roughness,
      metalness: mp.metalness,
      envMapIntensity: mp.envMapIntensity ?? 1.0
    };
    var topProps = {
      map: texture,
      roughness: mp.roughness * 0.92,
      metalness: mp.metalness,
      envMapIntensity: mp.envMapIntensity ?? 1.0
    };

    if (mp.physical) {
      if (mp.transmission) {
        bodyProps.transmission = mp.transmission;
        bodyProps.thickness = mp.thickness || 0.5;
        bodyProps.ior = mp.ior || 1.5;
        bodyProps.transparent = true;
        topProps.transmission = mp.transmission * 0.5;
        topProps.thickness = mp.thickness || 0.5;
        topProps.ior = mp.ior || 1.5;
        topProps.transparent = true;
      }
      if (mp.clearcoat) {
        bodyProps.clearcoat = mp.clearcoat;
        bodyProps.clearcoatRoughness = mp.clearcoatRoughness || 0.1;
        topProps.clearcoat = mp.clearcoat;
        topProps.clearcoatRoughness = mp.clearcoatRoughness || 0.1;
      }
    }

    var bodyMat = new MatCls(bodyProps);
    var topMat  = new MatCls(topProps);
    var materials = [bodyMat, bodyMat, topMat, bodyMat, bodyMat, bodyMat];

    var mesh = new THREE.Mesh(geo, materials);
    mesh.position.set(
      (def.x + def.w / 2 - cx) * UNIT,
      h / 2,
      (def.y + (def.h || 1) / 2 - cy) * UNIT
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.keyId = def.id;

    this._scene.add(mesh);
    this._keycaps.set(def.id, { mesh, def, canvas, texture, bodyMat, topMat });
  }

  // ==================== 轮廓几何体 ====================

  /** 根据当前轮廓类型分派构建几何体 */
  _buildProfileGeo(w, d, row) {
    var p = PROFILES[this._profile] || PROFILES.cherry;
    if (p.rows) return this._buildSculptedGeo(w, d, row, p);
    return this._buildUniformGeo(w, d, p);
  }

  /**
   * 行雕刻轮廓（Cherry / OEM / SA）
   * 参考来源: KeyV2 参数化键帽库 + keycaps.info 截面图
   * Cherry/OEM: 直线侧面(curve=1) + 柱面凹陷 + 顶面skew
   * SA: 弧线侧面(curve>1) + 侧面雕刻(side_sculpting) + 球面凹陷
   */
  _buildSculptedGeo(w, d, row, p) {
    var rp = p.rows[Math.min(row ?? 3, p.rows.length - 1)];
    var h = rp.h;
    var geo = new THREE.BoxGeometry(w, h, d, 14, 10, 14);
    var pos = geo.getAttribute('position');
    var halfH = h / 2;
    var halfW = w / 2;
    var halfD = d / 2;

    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i);
      var y = pos.getY(i);
      var z = pos.getZ(i);
      var t = Math.max(0, Math.min(1, (y + halfH) / h));

      // 1. 锥度 — curve=1.0 直线(Cherry/OEM)，>1 弧线(SA)
      var taperT = Math.pow(t, p.curve || 1.0);
      var txF = 1 - (1 - p.taperX) * taperT;
      var tzF = 1 - (1 - p.taperZ) * taperT;
      x *= txF;
      z *= tzF;

      // 2. 侧面雕刻 — KeyV2: side_sculpting = (1-progress)*4.5
      // 底部侧面更圆润，顶部保持矩形（SA/DSA 特有）
      if (p.round > 0) {
        var sculptAmt = (1 - t) * p.round;
        var curHalfW = halfW * txF + 0.001;
        var curHalfD = halfD * tzF + 0.001;
        var edgeNx = Math.abs(x) / curHalfW;
        var edgeNz = Math.abs(z) / curHalfD;
        // 使用平滑的超椭圆距离来判断边缘
        var eDist2 = edgeNx * edgeNx + edgeNz * edgeNz;
        if (eDist2 > 0.36) {
          var sFac = Math.min(1, (Math.sqrt(eDist2) - 0.6) / 0.4);
          var push = sFac * sFac * sculptAmt;
          x *= (1 - push * 0.15);
          z *= (1 - push * 0.15);
          y -= push * 0.8;
        }
      }

      // 3. 倾斜（基于已锥化的 z 位置）
      if (t > 0.2 && rp.tilt) {
        var tiltBlend = Math.min(1, (t - 0.2) / 0.8);
        y += (z / (halfD * tzF + 0.001)) * rp.tilt * tiltBlend;
      }

      // 4. 顶部倒角 — Cherry/OEM 有明显平台边缘
      if (t > 0.78) {
        var edgeT = (t - 0.78) / 0.22;
        var absNx = Math.abs(x) / (halfW * txF + 0.001);
        var absNz = Math.abs(z) / (halfD * tzF + 0.001);
        var edgeDist = Math.max(absNx, absNz);
        if (edgeDist > 0.5) {
          var chamfer = Math.pow((edgeDist - 0.5) / 0.5, 2.0) * edgeT;
          y -= chamfer * h * 0.08;
        }
      }

      // 5. 凹陷 — 从 t>0.7 开始逐渐过渡，让 dish 更平滑可见
      if (t > 0.7) {
        var dishT = Math.min(1, (t - 0.7) / 0.3);
        var dishSmooth = dishT * dishT * (3 - 2 * dishT); // smoothstep
        var nx = x / (halfW * txF + 0.001);
        if (p.dishType === 'sph') {
          var nz = z / (halfD * tzF + 0.001);
          var r2 = Math.min(1, nx * nx + nz * nz);
          y -= p.dish * (1 - r2) * dishSmooth;
        } else {
          y -= p.dish * (1 - nx * nx) * dishSmooth;
        }
      }

      // 6. 顶面后偏 (skew)
      if (p.skew) {
        z += p.skew * t;
      }

      // 7. 底部倒角
      if (t < 0.12) {
        var bt = (0.12 - t) / 0.12;
        var bnx = Math.abs(x) / (halfW || 0.001);
        var bnz = Math.abs(z) / (halfD || 0.001);
        var be = Math.max(bnx, bnz);
        if (be > 0.82) {
          var shrink = Math.pow(Math.max(0, (be - 0.82) / 0.18), 1.5) * bt;
          x *= (1 - shrink * 0.03);
          z *= (1 - shrink * 0.03);
        }
      }

      pos.setXYZ(i, x, y, z);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return { geo, h };
  }

  /**
   * 统一高度轮廓（DSA / XDA / MOA）
   * 参考来源: KeyV2 参数化键帽库 + keycaps.info 截面图
   * DSA: sculpted_square 带 side_sculpting — 弧线侧面 + 深球面凹陷
   * XDA: 较平缓弧线 + 浅球面凹陷 + 宽顶面
   */
  _buildUniformGeo(w, d, p) {
    var h = p.h;
    var geo = new THREE.BoxGeometry(w, h, d, 14, 10, 14);
    var pos = geo.getAttribute('position');
    var halfH = h / 2;
    var halfW = w / 2;
    var halfD = d / 2;

    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i);
      var y = pos.getY(i);
      var z = pos.getZ(i);
      var t = Math.max(0, Math.min(1, (y + halfH) / h));

      // 1. 锥度 — curve 控制侧面弧度
      var taperT = Math.pow(t, p.curve || 1.2);
      var txF = 1 - (1 - p.taperX) * taperT;
      var tzF = 1 - (1 - p.taperZ) * taperT;
      x *= txF;
      z *= tzF;

      // 2. 侧面雕刻 — 同行雕刻版本，底部更圆润
      if (p.round > 0) {
        var sculptAmt = (1 - t) * p.round;
        var curHalfW = halfW * txF + 0.001;
        var curHalfD = halfD * tzF + 0.001;
        var edgeNx = Math.abs(x) / curHalfW;
        var edgeNz = Math.abs(z) / curHalfD;
        var eDist2 = edgeNx * edgeNx + edgeNz * edgeNz;
        if (eDist2 > 0.36) {
          var sFac = Math.min(1, (Math.sqrt(eDist2) - 0.6) / 0.4);
          var push = sFac * sFac * sculptAmt;
          x *= (1 - push * 0.15);
          z *= (1 - push * 0.15);
          y -= push * 0.8;
        }
      }

      // 3. 倾斜
      if (t > 0.2 && p.tilt) {
        var tiltBlend = Math.min(1, (t - 0.2) / 0.8);
        y += (z / (halfD * tzF + 0.001)) * p.tilt * tiltBlend;
      }

      // 4. 顶部倒角
      if (t > 0.78) {
        var edgeT = (t - 0.78) / 0.22;
        var absNx = Math.abs(x) / (halfW * txF + 0.001);
        var absNz = Math.abs(z) / (halfD * tzF + 0.001);
        var edgeDist = Math.max(absNx, absNz);
        if (edgeDist > 0.5) {
          var chamfer = Math.pow((edgeDist - 0.5) / 0.5, 2.0) * edgeT;
          y -= chamfer * h * 0.08;
        }
      }

      // 5. 球面凹陷 — 从 t>0.65 开始过渡
      if (t > 0.65) {
        var dishT = Math.min(1, (t - 0.65) / 0.35);
        var dishSmooth = dishT * dishT * (3 - 2 * dishT);
        var nx = x / (halfW * txF + 0.001);
        var nz = z / (halfD * tzF + 0.001);
        var r2 = Math.min(1, nx * nx + nz * nz);
        y -= p.dish * (1 - r2) * dishSmooth;
      }

      // 6. 底部倒角
      if (t < 0.12) {
        var bt = (0.12 - t) / 0.12;
        var bnx = Math.abs(x) / (halfW || 0.001);
        var bnz = Math.abs(z) / (halfD || 0.001);
        var be = Math.max(bnx, bnz);
        if (be > 0.82) {
          var shrink = Math.pow(Math.max(0, (be - 0.82) / 0.18), 1.5) * bt;
          x *= (1 - shrink * 0.03);
          z *= (1 - shrink * 0.03);
        }
      }

      pos.setXYZ(i, x, y, z);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return { geo, h };
  }

  // ==================== 键盘外壳 ====================

  _buildCase() {
    if (this._caseMesh) {
      this._scene.remove(this._caseMesh);
      this._caseMesh.geometry.dispose();
      this._caseMesh.material.dispose();
      this._caseMesh = null;
    }

    var b = this._layoutBounds;
    if (!b) return;

    var pad = 0.4;
    var w = b.w + pad * 2;
    var d = b.h + pad * 2;
    var caseH = 0.22;
    var r = Math.min(0.3, w * 0.03, d * 0.03);

    // 圆角矩形轮廓
    var shape = new THREE.Shape();
    shape.moveTo(-w / 2 + r, -d / 2);
    shape.lineTo(w / 2 - r, -d / 2);
    shape.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r);
    shape.lineTo(w / 2, d / 2 - r);
    shape.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2);
    shape.lineTo(-w / 2 + r, d / 2);
    shape.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r);
    shape.lineTo(-w / 2, -d / 2 + r);
    shape.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2);

    var geo = new THREE.ExtrudeGeometry(shape, {
      depth: caseH,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.04,
      bevelSegments: 3
    });

    // 旋转使挤出方向朝下（shape XY → 场景 XZ，挤出 Z → 场景 -Y）
    geo.rotateX(Math.PI / 2);

    var isM = this._caseMaterialType === 'metal';
    var mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(this._caseColor),
      roughness: isM ? 0.25 : 0.65,
      metalness: isM ? 0.80 : 0.02,
    });

    this._caseMesh = new THREE.Mesh(geo, mat);
    this._caseMesh.position.y = -0.02;
    this._caseMesh.castShadow = true;
    this._caseMesh.receiveShadow = true;
    this._scene.add(this._caseMesh);
  }

  // ==================== 配色 ====================

  setColorScheme(scheme) {
    for (var [, cap] of this._keycaps) {
      var groupOv = scheme.groups?.[cap.def.group];
      var base = groupOv?.base ?? scheme.base;
      var legend = groupOv?.legend ?? scheme.legend;
      cap.bodyMat.color.set(base);
      cap.topMat.color.set(0xffffff);
      this._drawLegend(cap, base, legend);
    }
  }

  updateKeycap(keyId, props) {
    var cap = this._keycaps.get(keyId);
    if (!cap) return;
    var base = props.base ?? '#' + cap.bodyMat.color.getHexString();
    var legend = props.legend ?? '#ffffff';
    var label = props.label ?? cap.def.label;
    cap.bodyMat.color.set(base);
    if (props.label !== undefined) cap.def.label = props.label;
    this._drawLegend(cap, base, legend, label, props.legendFont);
  }

  _drawLegend(cap, baseColor, legendColor, label, font) {
    var { canvas, texture, def } = cap;
    var ctx = canvas.getContext('2d');
    var w = canvas.width;
    var h = canvas.height;

    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, w, h);

    var text = label ?? def.label;
    if (text) {
      var fontSize = Math.min(w, h) * (text.length > 3 ? 0.28 : text.length > 1 ? 0.36 : 0.5);
      ctx.fillStyle = legendColor;
      ctx.font = `bold ${fontSize}px ${font || "'Inter','Noto Sans SC',sans-serif"}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, w / 2, h / 2);
    }
    texture.needsUpdate = true;
  }

  // ==================== 多图层切割模式（简易模式） ====================

  getLayoutBounds() {
    return this._layoutBounds;
  }

  /**
   * 应用多个图层覆盖到所有键帽（保持宽高比）
   * @param {Array} layers [{ image, ox, oy, scale, opacity }]
   * @param {object} opts  { showLegend, legendColor, legendOutline, bgColor }
   */
  applyLayers(layers, opts = {}) {
    this._layersData = { layers, opts };
    this._mode = 'simple';
    var bounds = this._layoutBounds;
    if (!bounds) return;

    for (var [, cap] of this._keycaps) {
      this._drawLayeredSlice(cap, layers, bounds, opts);
    }
  }

  updateLayers(layers, opts = {}) {
    this._layersData = { layers, opts };
    this.applyLayers(layers, opts);
  }

  _drawLayeredSlice(cap, layers, bounds, opts) {
    var { canvas, texture, def } = cap;
    var ctx = canvas.getContext('2d');
    var cw = canvas.width;
    var ch = canvas.height;

    ctx.fillStyle = opts.bgColor || '#222';
    ctx.fillRect(0, 0, cw, ch);

    for (var layer of layers) {
      if (!layer.image) continue;
      var prevAlpha = ctx.globalAlpha;
      ctx.globalAlpha = layer.opacity ?? 1;
      this._drawSingleSlice(ctx, cw, ch, layer.image, def, bounds,
        layer.ox ?? 0.5, layer.oy ?? 0.5, layer.scale ?? 1);
      ctx.globalAlpha = prevAlpha;
    }

    if (opts.showLegend && def.label) {
      var text = def.label;
      var fontSize = Math.min(cw, ch) * (text.length > 3 ? 0.26 : text.length > 1 ? 0.34 : 0.46);
      ctx.font = `bold ${fontSize}px 'Inter','Noto Sans SC',sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (opts.legendOutline !== false) {
        ctx.strokeStyle = opts.legendOutlineColor || 'rgba(0,0,0,0.65)';
        ctx.lineWidth = fontSize * 0.14;
        ctx.lineJoin = 'round';
        ctx.strokeText(text, cw / 2, ch / 2);
      }
      var lc = this._autoLegendColor(cap.bodyMat.color);
      ctx.fillStyle = lc;
      ctx.fillText(text, cw / 2, ch / 2);
    }

    texture.needsUpdate = true;
  }

  /** 单层图片切片绘制（cover 策略保持宽高比） */
  _drawSingleSlice(ctx, cw, ch, img, def, bounds, ox, oy, scale) {
    var kbW = bounds.w, kbH = bounds.h;
    var kbAR = kbW / kbH;
    var imgAR = img.width / img.height;

    var mapW, mapH;
    if (imgAR > kbAR) {
      mapH = kbH;
      mapW = kbH * imgAR;
    } else {
      mapW = kbW;
      mapH = kbW / imgAR;
    }

    mapW /= scale;
    mapH /= scale;

    var imgX0 = (kbW - mapW) * ox;
    var imgY0 = (kbH - mapH) * oy;

    var keyX = def.x - bounds.minX;
    var keyY = def.y - bounds.minY;
    var keyW = def.w;
    var keyH = def.h || 1;

    var sx = ((keyX - imgX0) / mapW) * img.width;
    var sy = ((keyY - imgY0) / mapH) * img.height;
    var sw = (keyW / mapW) * img.width;
    var sh = (keyH / mapH) * img.height;

    try {
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
    } catch (_) { /* 静默 */ }
  }

  applyImageOverlay(img, ox, oy, scale, opts) {
    this.applyLayers([{ image: img, ox, oy, scale, opacity: 1 }], opts);
  }

  clearImageOverlay() {
    this._layersData = null;
    this._mode = 'pro';
  }

  /** 根据 THREE.Color 亮度自动返回对比文字色 */
  _autoLegendColor(threeColor) {
    var r = threeColor.r * 255;
    var g = threeColor.g * 255;
    var b = threeColor.b * 255;
    var lum = (r * 299 + g * 587 + b * 114) / 1000;
    return lum > 140 ? '#333333' : '#ffffff';
  }

  // ==================== 选中 / 高亮（不移动相机） ====================

  selectKey(keyId) {
    this.deselectKey();
    var cap = this._keycaps.get(keyId);
    if (!cap) return;
    this._selectedId = keyId;
    cap.bodyMat.emissive.set(HIGHLIGHT_EMISSIVE);
    cap.topMat.emissive.set(HIGHLIGHT_EMISSIVE);
    this._onKeySelect?.(keyId);
  }

  deselectKey() {
    if (this._selectedId) {
      var cap = this._keycaps.get(this._selectedId);
      if (cap) {
        cap.bodyMat.emissive.set(0x000000);
        cap.topMat.emissive.set(0x000000);
      }
    }
    this._selectedId = null;
    this._onKeySelect?.(null);
  }

  /** 重置相机到俯瞰位置 */
  resetCamera() {
    if (this._overviewGoal) {
      this._cameraGoal = { ...this._overviewGoal };
    }
  }

  // ==================== 交互 ====================

  _onClick(e) {
    var rect = this._renderer.domElement.getBoundingClientRect();
    this._mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this._mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this._raycaster.setFromCamera(this._mouse, this._camera);
    var meshes = [...this._keycaps.values()].map(c => c.mesh);
    var hits = this._raycaster.intersectObjects(meshes, false);

    if (hits.length > 0) {
      var keyId = hits[0].object.userData.keyId;
      if (keyId === this._selectedId) this.deselectKey();
      else this.selectKey(keyId);
    } else {
      this.deselectKey();
    }
  }

  // ==================== 导出 ====================

  exportImage(width = 1920, height = 1080) {
    var oldW = this._renderer.domElement.width;
    var oldH = this._renderer.domElement.height;
    this._renderer.setSize(width, height);
    this._camera.aspect = width / height;
    this._camera.updateProjectionMatrix();
    this._renderer.render(this._scene, this._camera);

    var dataUrl = this._renderer.domElement.toDataURL('image/png');

    this._renderer.setSize(oldW, oldH);
    this._camera.aspect = oldW / oldH;
    this._camera.updateProjectionMatrix();
    return dataUrl;
  }

  // ==================== 渲染循环 ====================

  _animate = () => {
    requestAnimationFrame(this._animate);

    if (this._cameraGoal) {
      this._camera.position.lerp(this._cameraGoal.pos, 0.06);
      this._controls.target.lerp(this._cameraGoal.target, 0.06);
      if (this._camera.position.distanceTo(this._cameraGoal.pos) < 0.02) {
        this._cameraGoal = null;
      }
    }
    this._controls.update();
    this._renderer.render(this._scene, this._camera);
  };

  // ==================== 尺寸适配 ====================

  resize() {
    var { clientWidth: w, clientHeight: h } = this._container;
    if (w === 0 || h === 0) return;
    this._camera.aspect = w / h;
    this._camera.updateProjectionMatrix();
    this._renderer.setSize(w, h);
  }

  // ==================== 销毁 ====================

  dispose() {
    this._renderer.dispose();
    this._controls.dispose();
    for (var cap of this._keycaps.values()) {
      cap.mesh.geometry.dispose();
      cap.bodyMat.dispose();
      cap.topMat.dispose();
      cap.texture.dispose();
    }
    if (this._caseMesh) {
      this._caseMesh.geometry.dispose();
      this._caseMesh.material.dispose();
    }
  }
}
