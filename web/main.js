/*
 ******************************************************************
       /\ /|       @file       main.js
       \ V/        @brief      KeyCraft Studio 首页业务数据与交互
       | "")       @author     Catarina·RabbitNya, yingtu0401@gmail.com
       /  |
      /  \\        @Modified   2026-03-07 14:17:16
    *(__\_\        @Copyright  Copyright (c) 2026, Shadowrabbit
 ******************************************************************
*/
(function () {
  const { createApp } = Vue;

  createApp({
    data() {
      return {
        // Hero 视觉旋转角，模拟 3D 键帽拖动
        heroRotateX: -14,
        heroRotateY: 18,
        steps: [
          {
            no: "1",
            title: "设计键帽",
            desc: "在浏览器中打开 3D 设计器，选择轮廓、配色、字符，实时预览效果。"
          },
          {
            no: "2",
            title: "保存图纸",
            desc: "设计完成后登录账户保存到云端，支持后续复用和下单。"
          },
          {
            no: "3",
            title: "工厂生产",
            desc: "提交图纸并填写收货信息，工厂按固定五面热升华 PBT 工艺生产发货。"
          }
        ],
        designs: [
          { name: "GMK Olivia", author: "olivia_d", likes: 2847, uses: 512, base: "#1a1a1a", legend: "#e8a0bf", char: "O" },
          { name: "Laser Purple", author: "synthwave", likes: 1923, uses: 340, base: "#1a0a3e", legend: "#ff00ff", char: "L" },
          { name: "Botanical", author: "greenkey", likes: 1654, uses: 289, base: "#2d4a3e", legend: "#8fbc8f", char: "B" },
          { name: "Nord Blue", author: "arctic", likes: 1456, uses: 267, base: "#2e3440", legend: "#88c0d0", char: "N" },
          { name: "Dracula", author: "vampire", likes: 1398, uses: 234, base: "#282a36", legend: "#bd93f9", char: "D" },
          { name: "Bento Red", author: "sushi_k", likes: 1267, uses: 198, base: "#2b2b2b", legend: "#ff6a5e", char: "R" },
          { name: "Milkshake", author: "sweet_", likes: 1189, uses: 176, base: "#f5e6d3", legend: "#e8a0bf", char: "M" },
          { name: "Bliss Pink", author: "blissful", likes: 1045, uses: 156, base: "#f0e8e0", legend: "#c76b7a", char: "P" }
        ],
        templates: [
          { name: "猫爪键帽", tag: "可爱", bg: "linear-gradient(135deg,#ff9a9e,#fecfef)", char: "🐾" },
          { name: "像素风", tag: "复古", bg: "linear-gradient(135deg,#a8edea,#fed6e3)", char: "👾" },
          { name: "复古打字机", tag: "经典", bg: "linear-gradient(135deg,#d4a373,#e8c49a)", char: "⌨" },
          { name: "霓虹灯效", tag: "RGB", bg: "linear-gradient(135deg,#7c4dff,#00d4ff)", char: "💡" },
          { name: "极简纯色", tag: "简约", bg: "linear-gradient(135deg,#2e3440,#4c566a)", char: "◼" },
          { name: "日系和风", tag: "文化", bg: "linear-gradient(135deg,#c76b7a,#f5e6d3)", char: "🌸" },
          { name: "赛博朋克", tag: "科幻", bg: "linear-gradient(135deg,#0a0a12,#ff4081)", char: "🤖" }
        ],
        showcase: [
          { title: "单键帽实物照", desc: "多角度展示键帽材质细节", tag: "五面热升华 PBT" },
          { title: "键盘搭配效果", desc: "展示装机后的整体视觉方案", tag: "配色方案整体展示" },
          { title: "设计 vs 实物对比", desc: "渲染图与实拍照对比展示", tag: "所见即所得" }
        ]
      };
    },
    computed: {
      heroVisualStyle() {
        return {
          "--rotateX": `${this.heroRotateX}deg`,
          "--rotateY": `${this.heroRotateY}deg`
        };
      }
    },
    methods: {
      onHeroMove(event) {
        const rect = event.currentTarget.getBoundingClientRect();
        const offsetX = (event.clientX - rect.left) / rect.width - 0.5;
        const offsetY = (event.clientY - rect.top) / rect.height - 0.5;

        this.heroRotateY = offsetX * 30;
        this.heroRotateX = -offsetY * 20;
      },
      onHeroLeave() {
        this.heroRotateX = -14;
        this.heroRotateY = 18;
      },
      viewDesign(name) {
        // 业务占位：后续可替换为详情页跳转
        window.alert(`查看设计详情：${name}`);
      },
      cloneDesign(name) {
        // 业务占位：后续可接入复制到工作台接口
        window.alert(`已复制设计到工作台：${name}`);
      },
      applyTemplate(name) {
        // 业务占位：后续可接入模板加载并跳转编辑器
        window.alert(`加载模板并进入设计器：${name}`);
      }
    }
  }).mount("#app");
})();
