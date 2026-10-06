# Venice Drift · 威尼斯水巷漫游

ROUND 01：可直接运行的 Three.js + TypeScript + Vite + WebGL2 乘船技术原型。

船自动沿运河前进。鼠标按住拖动或单指滑动环视，不提供方向、油门、倒车或缩放。建筑和桥为中性白盒，贡多拉为自制轮廓模型；本阶段不是写实美术交付。

## 运行

需要 Node.js 22.12+（或兼容的较新版本）。

```sh
npm ci
npm run dev
```

打开终端显示的地址，默认 `http://localhost:5188/`。同一局域网中的手机可用终端显示的 Network 地址访问。WebGL2 和浏览器硬件加速必须可用。

```sh
npm run build
npm run preview
npm test -- --maxWorkers=1
```

`dist/` 是完整静态站点，可部署到普通静态托管。运行时不请求 CDN、字体、地图或第三方媒体；不是直接双击 HTML 的 file:// 项目。

## 验收入口

- 点击 **Start Journey** 开始自动航行；提示约 3 秒后淡出。
- 鼠标按住拖动 / 单指拖动：自由环视，松手阻尼收敛，不自动回正。
- 按 **D** 或在启动页点击 **技术检查**：显示实时 FPS、绘制次数、三角形、纹理数、反射缓冲估算、航速、相机 / 船坐标、驻留分区。
- `?debug=1`：开启验收模式。`?debug=1&autostart=1`：自动进入。
- `?quality=high|medium|low`：固定画质。正常 UI 也可选择 Auto / High / Medium / Low。
- 调试面板的“定位桥前”只供验收；点击后船仍自动连续穿过桥洞。正常游览没有位置控制。

## 已实现

- 约 259.5 m 的闭合 Catmull–Rom 测试航道，以实际距离推进。巡航 1.55 m/s，弯道及桥前平滑降至约 1.29 m/s，一圈约 3 分钟。航道是明确标注的自制测试空间，尚未使用真实 Venice / OSM 数据。
- `BoatRoot → PassengerRig → CameraYawRig → CameraPitchRig → Camera`。69° FOV，视点距水面约 1.34 m。船转弯时乘客朝向有轻微滞后，用户的环视偏移始终保留。
- 4 点水面采样、厘米级 heave、限幅 pitch / roll。物理视觉层不修改航线根节点。
- 一座有实际开放拱洞的白盒桥，中心下缘距水面 3.45 m。桥体、建筑投射真实阴影，穿桥连续无切镜。
- 独立镜像相机、斜近平面裁剪、浮点反射纹理、Fresnel、沿运河方向变化的细波法线、岸边颜色渐变、阴影接收、轻微船侧局部水纹。建筑、桥、天空、船体均进入反射层。
- 官方 WebGL Sky、PMREM、太阳光、轻空气透视、ACES 色调映射。没有 Bloom。
- 高 / 中 / 低反射分辨率为 1024 / 512 / 256；低档与触摸设备隔帧更新。低档始终保持动态反射。自动模式先逐步降低像素比，再降低反射和阴影分辨率，有持续负载判断和恢复等待。
- 白盒分为四个具名驻留分区，静态几何按材质合批。**不是**生产版流式加载、LOD 或 GLB 资产管线。

## 检查与限制

`tests/journey.test.ts` 检查一整圈运动、曲线闭合、弯道/桥前加速度、环视不回正、船体浮动限幅、实际桥几何净空、斜裁剪投影。弧长采样表包含所有样条节点，避免节点附近微小的速度误差。

浏览器实测与截图、连续穿桥录屏位于交付目录旁的 `evidence/`。性能测量包含主画面、平面反射与阴影，三角形统计是所有渲染 pass 的总和。调试面板的反射缓冲内存为分辨率计算值，不是整个 GPU 显存实测。手机触摸使用 Chrome 触摸设备仿真测试；没有把桌面 GPU 仿真数据当作中端手机真机帧率。

阶段边界：真实 OSM 空间、精修 Venice 立面/PBR、正式 Gondola GLB、额外桥、完整尾流、合法环境音、动态天气与昼夜、生产 LOD/Chunks/KTX2/Meshopt 都在后续阶段。先验收 ROUND 01，不自动进入 ROUND 02。

## 研究记录和许可

详细到源码路径、提交、运行证据与未验证项的记录见 [docs/RESEARCH.md](docs/RESEARCH.md)。核心体验基准为 [Sakura River Valley](https://valley.mengto.here.now/)，实际连续体验约 188 秒并测试拖动；没有复制其代码、美术或具体场景。

平面反射数学实现改编自 m2-md 的 MIT 示例，许可保留在 `public/licenses/planar-reference-MIT.txt`；Three.js MIT 许可在 `public/licenses/three-MIT.txt`。其余工程代码和白盒几何为本项目编写。Open Water 的船、声音、动物资源均未使用。

## 源码结构

```text
src/core/            WebGL2 renderer / quality
src/journey/         route / gondola / hull float / passenger camera
src/interaction/     unified pointer look (mouse + touch)
src/water/           mirror camera / shader / wave sampling
src/environment/     Clear Day sky + sun + IBL
src/city/            whitebox volumes, canal walls and solid arch
src/main.ts          application lifecycle, UI and debug instrumentation
routes/              ordered metre-scale route points
tests/               numerical and geometry acceptance tests
```

开发模式或 `?debug=1` 会暴露 `window.__VENICE_DEBUG__`，用于读取实际渲染状态和可复现验收。普通生产入口没有该调试接口。
