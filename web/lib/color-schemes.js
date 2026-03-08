// ******************************************************************
// /\ /| @file color-schemes.js
// \ V/ @brief 键帽配色方案预设
// | "") @author Catarina·RabbitNya, yingtu0401@gmail.com
// / |
// / \\ @Modified 2026-03-07 19:45:00
// *(__\_\ @Copyright Copyright (c) 2026, Shadowrabbit
// ******************************************************************

/**
 * 配色方案结构：
 *   name   - 方案显示名
 *   base   - 主体底色（大部分键帽）
 *   legend - 主体字符色
 *   accent - 强调色底色（修饰键等）
 *   accentLegend - 强调色字符色
 *   groups - 按分组覆盖 { groupName: { base, legend } }
 */
export const colorSchemes = [
  {
    id: 'classic-dark',
    name: '经典深灰',
    base: '#3c3c3c',
    legend: '#ffffff',
    accent: '#5a5a5a',
    accentLegend: '#ffffff',
    groups: {
      mod: { base: '#5a5a5a', legend: '#ffffff' },
      frow: { base: '#5a5a5a', legend: '#cccccc' },
      space: { base: '#5a5a5a', legend: '#ffffff' }
    }
  },
  {
    id: 'gmk-olivia',
    name: 'GMK Olivia',
    base: '#1a1a1a',
    legend: '#e8a0bf',
    accent: '#e8a0bf',
    accentLegend: '#1a1a1a',
    groups: {
      mod: { base: '#e8a0bf', legend: '#1a1a1a' },
      space: { base: '#1a1a1a', legend: '#e8a0bf' }
    }
  },
  {
    id: 'nord',
    name: 'Nord 极光',
    base: '#2e3440',
    legend: '#88c0d0',
    accent: '#3b4252',
    accentLegend: '#81a1c1',
    groups: {
      mod: { base: '#3b4252', legend: '#81a1c1' },
      frow: { base: '#3b4252', legend: '#5e81ac' },
      space: { base: '#3b4252', legend: '#88c0d0' }
    }
  },
  {
    id: 'dracula',
    name: 'Dracula',
    base: '#282a36',
    legend: '#f8f8f2',
    accent: '#44475a',
    accentLegend: '#bd93f9',
    groups: {
      mod: { base: '#44475a', legend: '#bd93f9' },
      frow: { base: '#44475a', legend: '#ff79c6' },
      space: { base: '#44475a', legend: '#f8f8f2' }
    }
  },
  {
    id: 'botanical',
    name: 'Botanical 植物',
    base: '#2d4a3e',
    legend: '#8fbc8f',
    accent: '#1b3329',
    accentLegend: '#a8d8a8',
    groups: {
      mod: { base: '#1b3329', legend: '#a8d8a8' },
      space: { base: '#1b3329', legend: '#8fbc8f' }
    }
  },
  {
    id: 'laser',
    name: 'Laser 镭射',
    base: '#1a0a3e',
    legend: '#ff00ff',
    accent: '#2a1a5e',
    accentLegend: '#00ffff',
    groups: {
      mod: { base: '#2a1a5e', legend: '#00ffff' },
      frow: { base: '#2a1a5e', legend: '#ff44cc' },
      space: { base: '#1a0a3e', legend: '#ff00ff' }
    }
  },
  {
    id: 'bento',
    name: 'Bento 便当',
    base: '#2b2b2b',
    legend: '#ff6a5e',
    accent: '#ff6a5e',
    accentLegend: '#2b2b2b',
    groups: {
      mod: { base: '#ff6a5e', legend: '#2b2b2b' },
      space: { base: '#2b2b2b', legend: '#ff6a5e' }
    }
  },
  {
    id: 'milkshake',
    name: 'Milkshake 奶昔',
    base: '#f5e6d3',
    legend: '#5a4a3a',
    accent: '#e8a0bf',
    accentLegend: '#ffffff',
    groups: {
      mod: { base: '#e8a0bf', legend: '#ffffff' },
      frow: { base: '#d4a0c0', legend: '#ffffff' },
      space: { base: '#f5e6d3', legend: '#5a4a3a' }
    }
  },
  {
    id: 'cyberpunk',
    name: '赛博朋克',
    base: '#0a0a12',
    legend: '#fcee09',
    accent: '#fcee09',
    accentLegend: '#0a0a12',
    groups: {
      mod: { base: '#fcee09', legend: '#0a0a12' },
      frow: { base: '#1a1a2e', legend: '#ff4081' },
      space: { base: '#0a0a12', legend: '#fcee09' }
    }
  },
  {
    id: 'pure-white',
    name: '纯白极简',
    base: '#f0f0f0',
    legend: '#333333',
    accent: '#d0d0d0',
    accentLegend: '#555555',
    groups: {
      mod: { base: '#d0d0d0', legend: '#555555' },
      space: { base: '#e0e0e0', legend: '#333333' }
    }
  }
];
