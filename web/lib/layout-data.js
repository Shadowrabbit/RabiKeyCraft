/*
 ******************************************************************
       /\ /|       @file       layout-data.js
       \ V/        @brief      键盘布局预设数据（60%/TKL/104）
       | "")       @author     Catarina·RabbitNya, yingtu0401@gmail.com
       /  |
      /  \\        @Modified   2026-03-08 22:00:00
    *(__\_\        @Copyright  Copyright (c) 2026, Shadowrabbit
 ******************************************************************
*/

/**
 * 行构建器：根据紧凑定义生成键位对象数组
 * @param {number} y 行 y 坐标（单位 U）
 * @param {number} rowIdx 物理行号，影响 profile 高度
 * @param {string} group 默认分组
 * @param {Array} keys number → 间距；Array [id, label?, w?, h?, group?] → 键
 */
function buildRow(y, rowIdx, group, keys) {
  const result = [];
  let x = 0;
  for (const k of keys) {
    if (typeof k === 'number') { x += k; continue; }
    result.push({
      id: k[0],
      label: k[1] ?? k[0],
      x,
      y,
      w: k[2] ?? 1,
      h: k[3] ?? 1,
      row: rowIdx,
      group: k[4] ?? group
    });
    x += k[2] ?? 1;
  }
  return result;
}

/** 复制键位并整体偏移 */
function offsetKeys(keys, dx, dy) {
  return keys.map(k => ({ ...k, x: k.x + dx, y: k.y + dy }));
}

// ======================== 60% 主区域 ========================
const mainBlock = [
  // 数字行
  ...buildRow(0, 0, 'num', [
    ['grave', '`'], ['d1', '1'], ['d2', '2'], ['d3', '3'], ['d4', '4'],
    ['d5', '5'], ['d6', '6'], ['d7', '7'], ['d8', '8'], ['d9', '9'],
    ['d0', '0'], ['minus', '-'], ['equal', '='], ['backspace', 'Back', 2, 1, 'mod']
  ]),
  // QWERTY 行
  ...buildRow(1, 1, 'alpha', [
    ['tab', 'Tab', 1.5, 1, 'mod'],
    ['q', 'Q'], ['w', 'W'], ['e', 'E'], ['r', 'R'], ['t', 'T'],
    ['y', 'Y'], ['u', 'U'], ['i', 'I'], ['o', 'O'], ['p', 'P'],
    ['lbracket', '['], ['rbracket', ']'], ['backslash', '\\', 1.5]
  ]),
  // Home 行
  ...buildRow(2, 2, 'alpha', [
    ['caps', 'Caps', 1.75, 1, 'mod'],
    ['a', 'A'], ['s', 'S'], ['d', 'D'], ['f', 'F'], ['g', 'G'],
    ['h', 'H'], ['j', 'J'], ['k', 'K'], ['l', 'L'],
    ['semicolon', ';'], ['quote', "'"], ['enter', 'Enter', 2.25, 1, 'mod']
  ]),
  // Shift 行
  ...buildRow(3, 3, 'alpha', [
    ['lshift', 'Shift', 2.25, 1, 'mod'],
    ['z', 'Z'], ['x', 'X'], ['c', 'C'], ['v', 'V'], ['b', 'B'],
    ['n', 'N'], ['m', 'M'], ['comma', ','], ['period', '.'], ['slash', '/'],
    ['rshift', 'Shift', 2.75, 1, 'mod']
  ]),
  // 底部行
  ...buildRow(4, 4, 'mod', [
    ['lctrl', 'Ctrl', 1.25], ['lwin', 'Win', 1.25], ['lalt', 'Alt', 1.25],
    ['space', '', 6.25, 1, 'space'],
    ['ralt', 'Alt', 1.25], ['rwin', 'Win', 1.25],
    ['menu', 'Fn', 1.25], ['rctrl', 'Ctrl', 1.25]
  ])
];

// ======================== F 行 ========================
const fRow = buildRow(0, 0, 'frow', [
  ['esc', 'Esc', 1, 1, 'frow'], 1,
  ['f1', 'F1'], ['f2', 'F2'], ['f3', 'F3'], ['f4', 'F4'], 0.5,
  ['f5', 'F5'], ['f6', 'F6'], ['f7', 'F7'], ['f8', 'F8'], 0.5,
  ['f9', 'F9'], ['f10', 'F10'], ['f11', 'F11'], ['f12', 'F12']
]);

// ======================== 导航区 + 方向键 ========================
const navCluster = [
  ...buildRow(0, 0, 'nav', [15.5, ['prtsc', 'PrtSc'], ['scrlk', 'ScrLk'], ['pause', 'Pause']]),
  ...buildRow(1.5, 0, 'nav', [15.5, ['ins', 'Ins'], ['home', 'Home'], ['pgup', 'PgUp']]),
  ...buildRow(2.5, 1, 'nav', [15.5, ['del', 'Del'], ['end', 'End'], ['pgdn', 'PgDn']]),
  ...buildRow(4.5, 3, 'arrow', [16.5, ['up', '↑']]),
  ...buildRow(5.5, 4, 'arrow', [15.5, ['left', '←'], ['down', '↓'], ['right', '→']])
];

// ======================== 数字小键盘 ========================
const numpad = [
  ...buildRow(1.5, 0, 'numpad', [
    19, ['numlock', 'Num'], ['numdiv', '/'], ['nummul', '*'], ['numsub', '-']
  ]),
  ...buildRow(2.5, 1, 'numpad', [
    19, ['num7', '7'], ['num8', '8'], ['num9', '9'], ['numadd', '+', 1, 2]
  ]),
  ...buildRow(3.5, 2, 'numpad', [19, ['num4', '4'], ['num5', '5'], ['num6', '6']]),
  ...buildRow(4.5, 3, 'numpad', [
    19, ['num1', '1'], ['num2', '2'], ['num3', '3'], ['numenter', 'Ent', 1, 2]
  ]),
  ...buildRow(5.5, 4, 'numpad', [19, ['num0', '0', 2], ['numdot', '.']])
];

// ======================== 65% 布局（68 键，16u 宽）========================
const layout65 = [
  ...buildRow(0, 0, 'num', [
    ['grave', '`'], ['d1', '1'], ['d2', '2'], ['d3', '3'], ['d4', '4'],
    ['d5', '5'], ['d6', '6'], ['d7', '7'], ['d8', '8'], ['d9', '9'],
    ['d0', '0'], ['minus', '-'], ['equal', '='], ['backspace', 'Back', 2, 1, 'mod'],
    ['del65', 'Del', 1, 1, 'nav']
  ]),
  ...buildRow(1, 1, 'alpha', [
    ['tab', 'Tab', 1.5, 1, 'mod'],
    ['q', 'Q'], ['w', 'W'], ['e', 'E'], ['r', 'R'], ['t', 'T'],
    ['y', 'Y'], ['u', 'U'], ['i', 'I'], ['o', 'O'], ['p', 'P'],
    ['lbracket', '['], ['rbracket', ']'], ['backslash', '\\', 1.5],
    ['pgup', 'PgUp', 1, 1, 'nav']
  ]),
  ...buildRow(2, 2, 'alpha', [
    ['caps', 'Caps', 1.75, 1, 'mod'],
    ['a', 'A'], ['s', 'S'], ['d', 'D'], ['f', 'F'], ['g', 'G'],
    ['h', 'H'], ['j', 'J'], ['k', 'K'], ['l', 'L'],
    ['semicolon', ';'], ['quote', "'"], ['enter', 'Enter', 2.25, 1, 'mod'],
    ['pgdn', 'PgDn', 1, 1, 'nav']
  ]),
  ...buildRow(3, 3, 'alpha', [
    ['lshift', 'Shift', 2.25, 1, 'mod'],
    ['z', 'Z'], ['x', 'X'], ['c', 'C'], ['v', 'V'], ['b', 'B'],
    ['n', 'N'], ['m', 'M'], ['comma', ','], ['period', '.'], ['slash', '/'],
    ['rshift', 'Shift', 1.75, 1, 'mod'],
    ['up', '↑', 1, 1, 'arrow'], ['end65', 'End', 1, 1, 'nav']
  ]),
  ...buildRow(4, 4, 'mod', [
    ['lctrl', 'Ctrl', 1.25], ['lwin', 'Win', 1.25], ['lalt', 'Alt', 1.25],
    ['space', '', 6.25, 1, 'space'],
    ['ralt', 'Alt', 1], ['menu', 'Fn', 1], ['rctrl', 'Ctrl', 1],
    ['left', '←', 1, 1, 'arrow'], ['down', '↓', 1, 1, 'arrow'], ['right', '→', 1, 1, 'arrow']
  ])
];

// ======================== 75% 布局（84 键，紧凑 F 行 + 65% 主体）========================
const fRow75 = buildRow(0, 0, 'frow', [
  ['esc', 'Esc'], 0.5,
  ['f1', 'F1'], ['f2', 'F2'], ['f3', 'F3'], ['f4', 'F4'], 0.25,
  ['f5', 'F5'], ['f6', 'F6'], ['f7', 'F7'], ['f8', 'F8'], 0.25,
  ['f9', 'F9'], ['f10', 'F10'], ['f11', 'F11'], ['f12', 'F12'],
  ['prtsc75', 'PrtSc', 1, 1, 'nav'], ['del75', 'Del', 1, 1, 'nav']
]);
const layout75 = [...fRow75, ...offsetKeys(layout65, 0, 1.25)];

// ======================== 98% 布局（紧凑全尺寸，箭头集成 + 导航/数字盘合并）========================
// 主区域（箭头键集成到 Shift 和底部行）
const main98 = [
  ...buildRow(0, 0, 'num', [
    ['grave', '`'], ['d1', '1'], ['d2', '2'], ['d3', '3'], ['d4', '4'],
    ['d5', '5'], ['d6', '6'], ['d7', '7'], ['d8', '8'], ['d9', '9'],
    ['d0', '0'], ['minus', '-'], ['equal', '='], ['backspace', 'Back', 2, 1, 'mod']
  ]),
  ...buildRow(1, 1, 'alpha', [
    ['tab', 'Tab', 1.5, 1, 'mod'],
    ['q', 'Q'], ['w', 'W'], ['e', 'E'], ['r', 'R'], ['t', 'T'],
    ['y', 'Y'], ['u', 'U'], ['i', 'I'], ['o', 'O'], ['p', 'P'],
    ['lbracket', '['], ['rbracket', ']'], ['backslash', '\\', 1.5]
  ]),
  ...buildRow(2, 2, 'alpha', [
    ['caps', 'Caps', 1.75, 1, 'mod'],
    ['a', 'A'], ['s', 'S'], ['d', 'D'], ['f', 'F'], ['g', 'G'],
    ['h', 'H'], ['j', 'J'], ['k', 'K'], ['l', 'L'],
    ['semicolon', ';'], ['quote', "'"], ['enter', 'Enter', 2.25, 1, 'mod']
  ]),
  ...buildRow(3, 3, 'alpha', [
    ['lshift', 'Shift', 2.25, 1, 'mod'],
    ['z', 'Z'], ['x', 'X'], ['c', 'C'], ['v', 'V'], ['b', 'B'],
    ['n', 'N'], ['m', 'M'], ['comma', ','], ['period', '.'], ['slash', '/'],
    ['rshift', 'Shift', 1.75, 1, 'mod'], ['up', '↑', 1, 1, 'arrow']
  ]),
  ...buildRow(4, 4, 'mod', [
    ['lctrl', 'Ctrl', 1.25], ['lwin', 'Win', 1.25], ['lalt', 'Alt', 1.25],
    ['space', '', 6.25, 1, 'space'],
    ['ralt', 'Alt', 1], ['menu', 'Fn', 1],
    ['left', '←', 1, 1, 'arrow'], ['down', '↓', 1, 1, 'arrow'], ['right', '→', 1, 1, 'arrow']
  ])
];
const shifted98 = offsetKeys(main98, 0, 1.5);
// 右侧紧凑区（导航 + 数字小键盘合并，4 列，起始 x=15.25）
const right98 = [
  ...buildRow(0, 0, 'nav', [
    15.25, ['prtsc', 'PrtSc'], ['scrlk', 'ScrLk'], ['pause', 'Pause'], ['numlock', 'Num', 1, 1, 'numpad']
  ]),
  ...buildRow(1.5, 0, 'nav', [
    15.25, ['ins', 'Ins'], ['home', 'Home'], ['pgup', 'PgUp'], ['numdiv', '/', 1, 1, 'numpad']
  ]),
  ...buildRow(2.5, 1, 'nav', [
    15.25, ['del98', 'Del'], ['end', 'End'], ['pgdn', 'PgDn'], ['nummul', '*', 1, 1, 'numpad']
  ]),
  ...buildRow(3.5, 2, 'numpad', [15.25, ['num7', '7'], ['num8', '8'], ['num9', '9'], ['numsub', '-']]),
  ...buildRow(4.5, 3, 'numpad', [15.25, ['num4', '4'], ['num5', '5'], ['num6', '6'], ['numadd', '+']]),
  ...buildRow(5.5, 4, 'numpad', [15.25, ['num1', '1'], ['num2', '2'], ['num3', '3'], ['numenter', 'Ent']]),
  ...buildRow(6.5, 4, 'numpad', [15.25, ['num0', '0', 2], ['numdot', '.']])
];

// ======================== ISO TKL 布局（ISO Enter 1.5u×2h + 短左 Shift）========================
const isoMain = [
  ...buildRow(0, 0, 'num', [
    ['grave', '`'], ['d1', '1'], ['d2', '2'], ['d3', '3'], ['d4', '4'],
    ['d5', '5'], ['d6', '6'], ['d7', '7'], ['d8', '8'], ['d9', '9'],
    ['d0', '0'], ['minus', '-'], ['equal', '='], ['backspace', 'Back', 2, 1, 'mod']
  ]),
  // QWERTY 行末尾改为 ISO Enter（1.5u×2h）
  ...buildRow(1, 1, 'alpha', [
    ['tab', 'Tab', 1.5, 1, 'mod'],
    ['q', 'Q'], ['w', 'W'], ['e', 'E'], ['r', 'R'], ['t', 'T'],
    ['y', 'Y'], ['u', 'U'], ['i', 'I'], ['o', 'O'], ['p', 'P'],
    ['lbracket', '['], ['rbracket', ']'],
    ['enter', 'Enter', 1.5, 2, 'mod']
  ]),
  // Home 行多一个 # 键（0.75u），Enter 由上行覆盖此区域
  ...buildRow(2, 2, 'alpha', [
    ['caps', 'Caps', 1.75, 1, 'mod'],
    ['a', 'A'], ['s', 'S'], ['d', 'D'], ['f', 'F'], ['g', 'G'],
    ['h', 'H'], ['j', 'J'], ['k', 'K'], ['l', 'L'],
    ['semicolon', ';'], ['quote', "'"], ['hash', '#', 0.75]
  ]),
  // Shift 行：短左 Shift（1.25u）+ 额外 \ 键
  ...buildRow(3, 3, 'alpha', [
    ['lshift', 'Shift', 1.25, 1, 'mod'], ['backslash', '\\'],
    ['z', 'Z'], ['x', 'X'], ['c', 'C'], ['v', 'V'], ['b', 'B'],
    ['n', 'N'], ['m', 'M'], ['comma', ','], ['period', '.'], ['slash', '/'],
    ['rshift', 'Shift', 2.75, 1, 'mod']
  ]),
  ...buildRow(4, 4, 'mod', [
    ['lctrl', 'Ctrl', 1.25], ['lwin', 'Win', 1.25], ['lalt', 'Alt', 1.25],
    ['space', '', 6.25, 1, 'space'],
    ['ralt', 'Alt', 1.25], ['rwin', 'Win', 1.25],
    ['menu', 'Fn', 1.25], ['rctrl', 'Ctrl', 1.25]
  ])
];
const isoShifted = offsetKeys(isoMain, 0, 1.5);

// ======================== 组装布局 ========================
const shifted = offsetKeys(mainBlock, 0, 1.5);

export const layouts = {
  '60':      { name: '60%（61 键）',    keys: [...mainBlock] },
  '65':      { name: '65%（68 键）',    keys: [...layout65] },
  '75':      { name: '75%（84 键）',    keys: [...layout75] },
  'tkl':     { name: 'TKL（87 键）',    keys: [...fRow, ...shifted, ...navCluster] },
  'iso-tkl': { name: 'ISO TKL（88 键）', keys: [...fRow, ...isoShifted, ...navCluster] },
  '98':      { name: '98 紧凑全尺寸',    keys: [...fRow, ...shifted98, ...right98] },
  '104':     { name: '104 全尺寸',      keys: [...fRow, ...shifted, ...navCluster, ...numpad] }
};

/** 分组中文名 */
export const groupNames = {
  alpha: '字母区',
  num: '数字行',
  mod: '修饰键',
  frow: 'F 功能行',
  nav: '导航区',
  arrow: '方向键',
  numpad: '小键盘',
  space: '空格'
};
