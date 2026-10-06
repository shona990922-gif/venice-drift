# VENICE DRIFT FINAL REPORT

**版本：1.0.0-rc.1 · 本地 Release Candidate**  
**日期：2026-10-07**  
**预览：<http://127.0.0.1:4188/>**  
项目目录：`outputs/venice-drift/`。已完成本地构建与验证；未执行线上部署或远程推送。

## A. 已完成功能

- 自动贡多拉航行、独立鼠标/触摸环视、阻尼、自然俯仰限制；没有驾驶、任务、金币或 NPC 系统。
- 五段运河空间、三座不同桥梁、近景威尼斯立面、水线污渍、系船桩、停靠贡多拉、花盆、露台与教堂/钟楼。
- Day → Golden Hour → Sunset 连续环境变化，暖窗与路灯逐步亮起。
- 自然水声、城市远声、鸟声、轻微船体声与钟声；桥下与开阔段平滑混音。
- 简洁启动页，短暂环视提示，Sound / Quality / Fullscreen。正式模式隐藏所有调试面板。
- 真正的 Meshopt GLB 分块加载、预载、LOD、释放；三档画质和渐进降级。

## B. Journey 长度与时间

路线 **499.73 m**，标称航行约 **5 分 34 秒**，巡航 1.55 m/s，弯道和桥前平滑减速。

五段：Rio quieto → Sotto i ponti → Canale aperto → Case della sera → Bacino del sole。三个桥洞分别约位于 46 m、157 m、434 m；宽运河展开及 381 m 后的夕阳构图提供额外视觉事件。

路线是开放式设计。末尾在继续移动中缓慢淡出，完全遮盖时回到起点，再淡入；七秒过渡与运动重叠。没有镜头切换或突然刹停，亦不宣称它是几何闭环。

## C. Water V2

直接保留实际 5194 项目的 **Ocean.js、Sky.js、Post.js、common.js**；四个模块的字节哈希验证通过。没有重新仿写一个相似水 shader。

保留多层 Gerstner/micro ripple、光学深度、Beer–Lambert 吸收、折射、Fresnel 和 sun glitter。运河使用暗河底与克制大波幅；正式模式选择 Planar Reflection，保留屏幕外建筑和桥梁倒影。

Bow、左右船舷及 Stern 驱动世界坐标下的高度/速度扰动。最终 1080p 对照渲染中，**100,112 个反射像素**、**64,365 个最终画面像素**随船体扰动改变。停止发射十秒后能量剩余约 **0.0794%**；没有继续产生尾流。Low 档的同类测试亦通过。

## D. Environment / Sunset

统一控制太阳方向与颜色、天空、云色、雾、IBL、曝光、城市灯及水面环境。保持青绿水体；夕阳暖色来自天空、建筑与太阳反射。

完成夕阳桥、教堂、钟楼、餐厅露台与暖窗的乘客视角构图。实际截图及带环境音的视频位于 `showcase/`。轻雨依照优先级主动延期，本版本没有雨天入口或未完成天气系统。

## E. Mobile 与浏览器

验证了 **390×844 竖屏、844×390 横屏、820×1180 平板尺寸**。浏览器派发的触摸事件改变了视线，船同时前进 2.343 m，松手后不回正。Low 保留反射、微波纹和船体交互；使用 1K plaster 和较低渲染分辨率。

**测试边界：**这些是 Apple M2 桌面 GPU 上的尺寸/事件仿真，不是中端手机真机 FPS。Safari 原生测试因电脑锁定未能进行，仍需复查。Chromium 中启动、音频、自由环视及正常画面已实际运行；不支持全屏的浏览器具有非阻断提示。

## F. Performance

本机：**MacBook Air / Apple M2 / 8 GB RAM / Chromium**。

| 场景 | 实测结果 |
|---|---|
| 连续两趟，Medium，1280×720 | 689.61 秒，41,372 帧，平均 **59.99 FPS**；P95 **18.60 ms**，P99 **18.70 ms**；仅 1 帧超过 50 ms |
| Desktop Day，1920×1080 | **59.86 FPS**；GPU 平均 **11.29 ms** / P95 **12.95 ms**；约 **229 draws / 927K triangles** |
| Desktop Sunset，1920×1080 | 约 **60 FPS**；GPU 平均 **11.35 ms** / P95 **13.42 ms**；约 **237 draws / 819K triangles** |
| Low，手机竖屏尺寸，331×717 framebuffer | 约 **60 FPS**；GPU 平均 **6.35 ms** / P95 **10.15 ms**；约 **166 draws / 536K triangles**，桌面 GPU 仿真 |
| High，1707×960 framebuffer | 约 **60 FPS**；完整 1024 反射 / 512 扰动网格 |

Draw calls / triangles 包括辅助渲染。GPU 使用真实 disjoint timer queries；长跑基线的 GPU 局部统计未含偶发 IBL 刷新，最终计时已移到其前方；上表长跑帧时间始终包括全部工作。

- 纹理数量两趟保持 **27**。首次遍历有静态资源延迟上传；第二趟几何峰值 306，第三次循环仍为 306，未观察到持续增长。
- 最多四个城市块驻留；两趟结束记录 27 次加载、24 次释放、三个驻留块。
- 六个主要自定义水面/画面 Render Targets；环境贴图和阴影另计。上游五个未使用后处理目标保留为 1×1 对象。
- PBR 贴图未压缩显存估算：Medium/High **128 MiB**，Low **80 MiB**；这不是驱动总显存读数。
- 桌面贴图下载 **14.12 MB → 6.65 MB**；首次进入与邻近块预载记录约 **15.4 MB**，缓存会影响此读数。完整静态运行文件约 **35.5 MB**，截图和视频不计入网站 build。

原始证据：`docs/validation/evidence/`。两趟测试后仅进行结束淡出与界面防护修正，相关最终录制另存为 `final-loop.webm`。

## G. 保留的边界与小问题

- 真机性能和 Safari 尚未认证，建议上线前补测。
- Low 反射较软；远处立面使用简化轮廓。部分立面仍可看出模块化重复，后续美术迭代可继续细化。
- 场景是有威尼斯辨识度的人工编排片区，并非真实街区的测绘复刻。
- 需要 WebGL2 与浮点渲染目标。缺少这些能力时显示说明，不以静态水面冒充正常体验。
- 本次资源与帧时间测试没有发现持续增长或严重错误，但不等于对所有设备作无限时长保证。

## H. 资产与许可

外部代码使用随包保留的 MIT notices：Three.js、WaterThreeJS、jeantimex / Evan Wallace 高度场、Planar 参考与 meshoptimizer。

PBR 来自 Poly Haven CC0；水声/城市环境来自 krakenkraft 的 CC0 Venice 录音，鸟声来自 isaiah658 的 CC0 录音。钟声、木质声及桥下混响为本项目合成。建筑、船、桥、路线和装饰为项目几何资产；无付费模型、商业音乐或未经许可的 Open Water 媒体。

详见根目录 **THIRD_PARTY_LICENSES.md**；必要 notice 随 `dist/licenses/` 一同发布。

## I. Build 与验证

**Production Build：**`outputs/venice-drift/dist/`  
**可分发压缩包：**`outputs/venice-drift/releases/venice-drift-1.0.0-rc.1.zip`（13.96 MB，47 个运行文件，已验证 ZIP 完整性；旁附 SHA-256）  
**运行说明：**根目录 `README.md`

`lint`、严格 TypeScript 检查、**17 项测试**及 Production Build 通过。运行期依赖审计无已知漏洞。开发服务器 5188 与构建预览 4188 都已实际启动。各阶段都有独立本地 commit；无远程推送或线上发布。

## J. 建议醒来后优先看的五处

1. 从正式入口开始：确认第一眼的乘客位置、Sound 音量及拖动环视。
2. 第一座桥：观察桥体从头顶经过、水色变暗及桥内声音变化。
3. 中段金色时刻：检查暖立面与冷阴影之间的层次，确认没有橙色滤镜感。
4. 约 381 m 后的夕阳区域：看桥、教堂、暖窗和水面金色倒影；回头看尾流扰乱反射。
5. 用真实手机复查横竖屏、触控、音量和 Low/Medium 选择，并补一次 Safari 检查。

交付保持为当前 Venice Drift 候选版本，不继续扩张城市或增加玩法。
