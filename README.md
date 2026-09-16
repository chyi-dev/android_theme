# android_theme

最小可用的 **动态 Android 主题（颜色 + 图片 + 语言包）** 端到端 Demo：Web 管理台改色/换图/改文案 → 后端保存并 **一次发布** Theme Manifest + i18n shards → Android（**仅 XML Views**）拉取并应用到界面。

本仓库证明的是产品方案里的正确抽象：

```
语义 Token / Slot / String Key（稳定）
    → 远程 Theme Manifest + 独立 Language Pack（snapshotId + 绝对 URL）
    → 客户端 ThemeRuntime / t(key) 应用到 View
    → 内置 res/ 与 last-good 缓存作为永久降级
```

**不会**在运行时替换 `R.color` / `R.drawable` / `R.string`。协议里也没有 Android resource int id。审批/灰度、完整 ICU 复数不在本 Demo 范围。占位符支持简单 `{name}`。包含一个 **`.9.png` 九宫格槽位**（`chat.bubble`）。

```
/README.md
/server/     Node + Express：草稿/发布、上传、Theme + i18n Manifest、静态资源
/web/        管理台（纯 HTML/JS，由 server 一起托管）
/android/    Kotlin + XML Views（零 Compose）
```

默认端口：**8787**。

---

## 1. 启动服务端 + 管理台

需要 Node 18+。

```bash
cd server
npm install
npm start
```

然后打开：

- 管理台：http://localhost:8787/
- Theme Manifest：http://localhost:8787/v1/theme/manifest
- i18n Manifest：http://localhost:8787/v1/i18n/manifest
- 健康检查：http://localhost:8787/health

服务监听 `0.0.0.0:8787`。首次启动会写入种子主题 + `zh-CN`/`en` 语言包到 `server/data/`。同一局域网的真机也能访问。

可选环境变量：

| 变量 | 含义 |
|------|------|
| `PORT` | 监听端口，默认 `8787` |
| `PUBLIC_BASE_URL` | 强制 Manifest 里的资源绝对 URL 前缀（一般不用；默认按请求 Host 生成） |

运行测试：

```bash
cd server && npm test
```

---

## 2. Web：改颜色 / Banner / 文案 → 发布

1. 打开 http://localhost:8787/
2. 修改颜色 Token（`brand.primary` 等）和/或上传 `home.banner`
3. 在 **文案 Key / 语言包** 里切换 `zh-CN` / `en`，修改例如 `string.home.welcome`（可用 `{name}`，App 里会填 `Ada`）
4. 可选：上传合法 **`.9.png`** 到 `chat.bubble`（聊天气泡背景）
5. 右侧可切换预览语言；点 **发布到客户端**（同一按钮同时发布 theme snapshot + i18n snapshot）

只有 **发布** 之后，`GET /v1/theme/manifest` 与 `GET /v1/i18n/manifest` 才会变化。

---

## 3. Android 模拟器

1. 用 Android Studio 打开 `android/`（minSdk 24，ViewBinding，**无 Compose**）。
2. 安装 SDK 34 + API 24+ 模拟器。确认 Node 服务在 **8787**。
3. Run `app`。默认 Base URL：`http://10.0.2.2:8787`。
4. 启动立刻应用 **builtin 或 last-good**（文案带「内置」），再后台拉取。种子远程文案是「你好，Ada！」这类，与内置可区分。
5. 首页有 **中文 zh-CN / English** 切换；切换后 TextView 经 `t(key)` 重绑，不必重装。
6. Web 改文案并发布后，App 点 **立即拉取**：新文案出现，`i18nSnapshotId` 变化。

### 真机（局域网 IP）

模拟器才能用 `10.0.2.2`。真机在右上角 **服务地址** 改成：

```text
http://192.168.x.x:8787
```

```bash
# Linux
hostname -I
# macOS
ipconfig getifaddr en0
```

本 Demo 允许 HTTP cleartext，仅用于本地。

---

## 4. 离线 / 错误 URL / 同步后无需再请求后端

**绘制路径是 cache-first，不依赖网络：**

1. `Application.onCreate` 同步读取 last-good：theme JSON、已下载的图片/`.9.png` 文件、i18n manifest + locale shards。
2. 首帧立刻用这些本地文件 + `t(key)` 绑到 View。Banner/Logo 用 `BitmapFactory.decodeFile`；`chat.bubble` 用 `NinePatchDrawable`（解析 .9 标记，不是 URL / Coil HTTP）。
3. 进前台才 **后台** `fetchAsync`。失败只更新 error 字段，**不改已经画上去的 last-good**。
4. 因此：成功同步一次 → 关服务端 / 飞行模式 → 杀进程再开 App → 颜色、位图、九宫格气泡、文案都应还在，`source` 为 `cache`（或从未成功过则 `builtin`）。

坏 URL 验证：设置里填 `http://10.0.2.2:1` 再拉取。不崩溃；`error` / `i18n error` 有内容。

语言 fallback：`zh-CN` → `zh` → `en` → builtin `strings.xml`。

---

## 5. 协议（简化）

`GET /v1/theme/manifest` 增加 `linkedI18nSnapshotId`。

`GET /v1/i18n/manifest`：

```json
{
  "schemaVersion": 1,
  "i18nSnapshotId": "i18n_snap_...",
  "publishedAt": "2026-09-16T03:00:00.000Z",
  "defaultLocale": "en",
  "locales": ["zh-CN", "en"],
  "linkedThemeSnapshotId": "snap_...",
  "shards": [
    {
      "locale": "zh-CN",
      "url": "http://10.0.2.2:8787/i18n/zh-CN-xxxx.json",
      "hash": "sha256:...",
      "keyCount": 6
    },
    { "locale": "en", "url": "...", "hash": "sha256:...", "keyCount": 4 }
  ]
}
```

Shard 示例：

```json
{
  "locale": "zh-CN",
  "messages": {
    "string.app.title": "动态主题 Demo",
    "string.home.welcome": "你好，{name}！",
    "string.home.body": "这段文字来自远程语言包（zh-CN）。",
    "string.action.pull": "立即拉取",
    "string.chat.short": "你好",
    "string.chat.bubble": "这是可拉伸的九宫格气泡。"
  }
}
```

管理 API：

| 方法 | 路径 | 作用 |
|------|------|------|
| GET | `/admin/theme` | 草稿（含 strings）+ 已发布 theme/i18n |
| PUT | `/admin/theme/colors` | 更新草稿颜色 |
| PUT | `/admin/i18n` | 更新草稿文案 `{ messages: { "zh-CN": {...}, "en": {...} } }` |
| POST | `/admin/theme/assets/:slot` | 上传图片 |
| POST | `/admin/theme/publish` | **同时**发布 theme + language pack |
| GET | `/v1/theme/manifest` | 客户端主题 |
| GET | `/v1/i18n/manifest` | 客户端语言包索引 |

上传图片：`server/data/assets/`。语言包分片：`server/data/i18n/`。

---

## 6. QA 验收清单

Tester 按下面打勾即可（无需重装 APK）：

1. **启动服务** `cd server && npm install && npm start`，浏览器打开 http://localhost:8787/ ，预览能在 zh-CN / en 之间切换。
2. **改文案**：把 `string.home.welcome` 的 zh-CN 改成例如 `QA你好，{name}`，en 改成 `QA Hello, {name}`，点 **发布到客户端**。记下新的 `i18n snapshotId`。
3. **Android 拉取**：模拟器打开 App → **立即拉取**。标题应变为 `QA你好，Ada`（占位符 `Ada`）。状态区 `i18nSnapshotId` 与 Web 一致，`i18n source` 为 `network`。
4. **切语言**：点 **English**，标题变为 `QA Hello, Ada`，正文为英文；再切回中文。不要求 Activity 重启。
5. **主题仍在**：改 `brand.primary` 并发布后，工具栏颜色与 Banner 仍随主题更新（语言包与主题同一次 Publish）。
6. **九宫格拉伸**：首页有短气泡和长气泡，共用 `chat.bubble` `.9.png`。长文案应变宽/变高，**圆角保持、不是整图被 ImageView 拉变形**。可选：Web 上传另一张合法 `.9.png` 后发布再拉取，背景更换且拉伸仍正确。离线 builtin 使用 `res/drawable/chat_bubble.9.png`。
7. **同步后完全离线**：先成功拉取一次 → **关掉 Node 服务或开飞行模式** → 杀进程再打开 App（不要点拉取也可以）。颜色、Banner、两个九宫格气泡、中英文案都还在；`source` / `i18n source` 为 `cache`；状态 `render: local cache`。过程中不应再为了**绘制**去请求后端（后台刷新失败只显示 error）。
8. **坏 URL**：设置里改成 `http://10.0.2.2:1` → 立即拉取。App 不崩溃；继续显示 last-good；`error` / `i18n error` 有内容。
9. **约束**：Android 工程无 Compose 依赖、无 `@Composable`；协议与 UI 均无 `R.string` int id。绘制路径不使用 Coil HTTP URL。

---

## 7. Android 模块约束

- 仅 Activities + XML layouts + Views。
- 网络：OkHttp（仅 fetch/download）。绘制：本地文件 + `BitmapFactory` / `NinePatchDrawable` / `t(key)`。
- `R.color` / `R.drawable` / `R.string` **只作为 builtin fallback**。
- 仓库内不应出现 Jetpack Compose 依赖或 `@Composable`。
