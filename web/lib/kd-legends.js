// ******************************************************************
// /\ /| @file kd-legends.js
// \ V/ @brief 键帽预设文字模板（单键编辑器用）
// | "") @author Catarina·RabbitNya, yingtu0401@gmail.com
// / |
// / \\ @Modified 2026-03-08 14:00:00
// *(__\_\ @Copyright Copyright (c) 2026, Shadowrabbit
// ******************************************************************

/* global fabric */

// 预设文字模板：每项包含 label（显示名）、text（实际文字）、样式参数
export var KD_LEGENDS = [
  { label: 'ESC',   text: 'ESC',   fontSize: 28, fontWeight: 'bold' },
  { label: 'F1',    text: 'F1',    fontSize: 24 },
  { label: 'F2',    text: 'F2',    fontSize: 24 },
  { label: 'F3',    text: 'F3',    fontSize: 24 },
  { label: 'F4',    text: 'F4',    fontSize: 24 },
  { label: 'F5',    text: 'F5',    fontSize: 24 },
  { label: 'F6',    text: 'F6',    fontSize: 24 },
  { label: 'F7',    text: 'F7',    fontSize: 24 },
  { label: 'F8',    text: 'F8',    fontSize: 24 },
  { label: 'F9',    text: 'F9',    fontSize: 24 },
  { label: 'F10',   text: 'F10',   fontSize: 22 },
  { label: 'F11',   text: 'F11',   fontSize: 22 },
  { label: 'F12',   text: 'F12',   fontSize: 22 },
  { label: 'CTRL',  text: 'CTRL',  fontSize: 20, fontWeight: 'bold' },
  { label: 'ALT',   text: 'ALT',   fontSize: 22 },
  { label: 'SHIFT', text: 'SHIFT', fontSize: 18, fontWeight: 'bold' },
  { label: 'ENTER', text: '⏎',    fontSize: 36 },
  { label: 'TAB',   text: '⇥',    fontSize: 36 },
  { label: 'SPACE', text: 'SPACE', fontSize: 18 },
  { label: 'BKSP',  text: '⌫',    fontSize: 32 },
  { label: 'CAPS',  text: 'CAPS',  fontSize: 18, fontWeight: 'bold' },
  { label: 'DEL',   text: 'DEL',   fontSize: 20 },
  { label: 'INS',   text: 'INS',   fontSize: 20 },
  { label: 'HOME',  text: 'HOME',  fontSize: 16 },
  { label: 'END',   text: 'END',   fontSize: 18 },
  { label: 'PGUP',  text: 'PgUp',  fontSize: 16 },
  { label: 'PGDN',  text: 'PgDn',  fontSize: 16 },
  { label: '↑',     text: '↑',    fontSize: 36 },
  { label: '↓',     text: '↓',    fontSize: 36 },
  { label: '←',     text: '←',    fontSize: 36 },
  { label: '→',     text: '→',    fontSize: 36 },
  { label: 'WIN',   text: '⊞',    fontSize: 32 },
  { label: 'FN',    text: 'Fn',    fontSize: 22 },
];

/**
 * 向 Fabric.js 画布中插入一个预设文字对象
 * @param {fabric.Canvas} fc  目标画布
 * @param {object} tmpl       KD_LEGENDS 中的一项
 * @param {number} cx         画布中心 x
 * @param {number} cy         画布中心 y
 * @returns {fabric.IText}    创建的文本对象
 */
export function insertLegend(fc, tmpl, cx, cy) {
  var t = new fabric.IText(tmpl.text, {
    left: cx, top: cy,
    originX: 'center', originY: 'center',
    fontSize: tmpl.fontSize || 24,
    fontWeight: tmpl.fontWeight || 'normal',
    fontFamily: 'Inter',
    fill: '#ffffff',
    textAlign: 'center'
  });
  fc.add(t);
  fc.setActiveObject(t);
  fc.renderAll();
  return t;
}
