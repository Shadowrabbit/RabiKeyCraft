const express = require("express");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;
const webDir = path.join(__dirname, "web");

// 静态托管 web 目录，默认会返回 index.html
app.use(express.static(webDir));

// 保底路由：当没有命中静态文件时，返回首页
app.get("/", (req, res) => {
  res.sendFile(path.join(webDir, "index.html"));
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});