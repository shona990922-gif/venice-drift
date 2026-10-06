# Venice Drift · 威尼斯水巷漫游

当前版本：ROUND 02.5 · Boat–Water Interaction。Three.js + TypeScript + Vite + WebGL2。

坐在贡多拉中自动前进，鼠标按住拖动或单指滑动自由环视。本轮只增加船头拨水、贴舷扰动、船尾持续尾流及其倒影响应，保留 ROUND 02 的水色、反射系统、125 m 样板段、相机与玩法。

## 运行

Node.js 22.12+，浏览器支持 WebGL2 / 硬件加速。

```sh
npm ci
npm run dev
```

默认地址 `http://localhost:5188/`；手机与电脑同局域网时使用终端给出的 Network 地址。

```sh
npm test
npm run build
npm run preview
```

`dist/` 可直接部署到静态托管。素材全部随项目提供，运行时不依赖外部 CDN、地图或字体；不能通过双击 HTML / file:// 运行。

## 体验与验收

- **Start Journey**：开始；不操作也会前进。拖动环视，松手带阻尼，不自动回正。
- 低头观察船头与船舷，回头观察船尾留下的窄 V 形尾流。经过的位置约 10 秒内逐渐恢复平静。
- 按 **D** 查看 FPS、Draw Calls、Triangles、尾流点数/更新耗时、反射分辨率和位置。
- `?debug=1&autostart=1&quality=high` 可直接进入检查。支持 High / Medium / Low / Auto。
- 调试面板的定位桥前、重置航线只用于验收，正常体验没有驾驶或位置控制。
- 开发模式或 `?debug=1` 暴露 `window.__VENICE_DEBUG__`；其中 `water.interaction.enabled` 可用于同场景 A/B 检查。

## 当前实现

- 125 m Hero Canal：12 个有意设计的威尼斯立面、石拱桥、背景钟楼、少量停靠船和系船设施。只开放原样条前 125 m，末端短淡出重回起点。
- 距离驱动 Catmull–Rom 航线；巡航 1.55 m/s，桥前和弯道平滑减速。船的路径、浮动和乘客环视分离。
- 69° 乘客视角，高约 1.52 m，向船头移至 -2.35 m；无缩放、油门、倒车、强制回正。
- 4 点采样、厘米级浮动；连续穿过真实开放桥洞，无切镜。
- 原有 PlanarReflection 镜像相机、斜裁剪与 Fresnel 系统保持；1024 / 512 / 256 反射，低档与触摸设备隔帧更新，始终保留倒影。
- 双尺度不规则水纹、深青绿色、岸边渐变、桥影；ROUND 02.5 在原 shader 上加局部梯度与倒影 UV 扭曲，不改变远处水面。
- 尾流以 24 cm 航程间隔留下世界坐标样本，256² / 36 m 局部纹理约 30 Hz 更新；10 s 衰减、每侧 0.28 m/s 缓慢扩散。转弯不会把旧尾流旋转或拖走。
- 船头轻微压力波和两道柔和扩散弧、贴合船体收尖轮廓的 20 cm 扰动带。没有白沫贴片、喷溅粒子或额外水面几何。
- 真实 CC0 PBR 和晴天下午 HDRI / PMREM、侧向太阳、ACES；没有 Bloom / 昼夜 / 天气 / NPC 系统。

## 验证与边界

`tests/journey.test.ts` 覆盖距离航行、环视、浮动、桥洞/航道净空、反射斜裁剪。`tests/water-interaction.test.ts` 覆盖慢速发射、转弯世界坐标留痕、停止后的衰减、重置清理与不同帧率的一致性。

`docs/ACCEPTANCE-ROUND025.json` 保存实际 Chrome 运行统计和同帧 A/B 数值；交付目录 `round025-evidence/` 有实际截图与连续录屏。绘制次数/三角形包含主画面、倒影及阴影 pass 的总量。手机测试为 Chrome 触摸仿真，不能代表中端手机真机帧率。

当前建筑为代码构建的模块组合，不是测绘导入的真实 Venice 街区。贡多拉仍为自制模型，尚未进入正式高精 GLB / KTX2 / Meshopt / 大规模流式加载管线。本轮没有扩大地图。

## 来源与许可

[docs/RESEARCH.md](docs/RESEARCH.md) 记录原始参考、源码位置、实验与限制。Poly Haven 材质和 HDRI 为 CC0，精确下载来源/校验值见 `public/licenses/materials.json`。Three.js、平面反射参考、Open Water 代码参考的 MIT 许可随 `public/licenses/` 提供。没有复制 Open Water 的船、音频或动物媒体。
