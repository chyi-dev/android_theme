# android_theme

最小可用的 **动态 Android 主题（颜色 + 图片）** 端到端 Demo：Web 管理台上传/改色 → 后端保存并发布 Manifest → Android（**仅 XML Views**）拉取并应用到界面。

本仓库证明的是产品方案里的正确抽象：

```
语义 Token / Slot（稳定）
    → 远程 Theme Manifest（version / snapshotId + 绝对资源 URL）
    → 客户端 ThemeRuntime 应用到 View
    → 内置 res/ 与 last-good 缓存作为永久降级
```

**不会**在运行时替换 `R.color` / `R.drawable` / `R.string`。协议里也没有 Android resource int id。完整 i18n OTA、审批/灰度、SVG/Nine-patch 不在本 Demo 范围。

```
/README.md
/server/     Node + Express：草稿/发布、上传、Manifest、静态资源
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
- 客户端 Manifest：http://localhost:8787/v1/theme/manifest
- 健康检查：http://localhost:8787/health

服务监听 `0.0.0.0:8787`，同一局域网的真机也能访问。首次启动会写入种子主题到 `server/data/`（橙色品牌色 + 默认 Banner/Logo），Android 在还没人上传时也能拉到一份完整 Manifest。

可选环境变量：

| 变量 | 含义 |
|------|------|
| `PORT` | 监听端口，默认 `8787` |
| `PUBLIC_BASE_URL` | 强制 Manifest 里的资源绝对 URL 前缀（一般不用；默认按请求 Host 生成，所以模拟器请求 `10.0.2.2` 时图片 URL 也是 `10.0.2.2`） |

运行测试：

```bash
cd server && npm test
```

---

## 2. Web：改颜色 + 上传 Banner → 发布

1. 打开 http://localhost:8787/
2. 修改 **品牌主色** `brand.primary`（以及 `text.primary` / `surface` / `background`）
3. 为 **首页 Banner** `home.banner` 选择一张 PNG/JPEG/WebP（可选再换 Logo）
4. 右侧预览会即时更新（草稿）
5. 点 **发布到客户端**（会先保存草稿再生成新的 `snapshotId`）

只有 **发布** 之后，`GET /v1/theme/manifest` 才会变化。Android 拉到的是已发布快照，不是未发布草稿。

---

## 3. Android 模拟器

1. 用 Android Studio 打开目录 `android/`（Gradle 工程，minSdk 24，ViewBinding，**无 Compose 依赖**）。
2. 如提示 SDK，安装 Android SDK 34 + 一个 API 24+ 的模拟器（建议 Pixel + API 34）。
3. 确认电脑上的 Node 服务已在 **8787** 运行。
4. Run `app`。默认 Base URL 是 `http://10.0.2.2:8787`（模拟器访问宿主 localhost 的标准地址）。
5. 启动后会立刻应用 **内置蓝色主题或上次缓存**，再在后台拉取远程主题。种子主题是橙色，所以第一次成功拉取时，工具栏/Banner 会从蓝变橙。
6. 回到 Web 改色、换 Banner、发布，然后在 App 里点 **立即拉取** 或下拉刷新：颜色和 Banner 应更新，**无需重装 APK**。
7. 状态区会显示 `snapshotId`、`source`（`network` | `cache` | `builtin`）和 `error`。

### 真机（局域网 IP）

模拟器才能用 `10.0.2.2`。真机请在 App 右上角 **服务地址** 改成电脑的局域网 IP：

```text
http://192.168.x.x:8787
```

查 IP 示例：

```bash
# Linux
hostname -I
# macOS
ipconfig getifaddr en0
```

手机和电脑必须同一 Wi-Fi；本 Demo 已开启 HTTP cleartext（`usesCleartextTraffic` + `network_security_config`），仅用于本地演示。

---

## 4. 离线 / 错误 URL

- 启动时主线程只读本地 **last-good** JSON；没有缓存则用 APK 内 `res/values/colors.xml` + `res/drawable/*_default`。
- 远程拉取在后台进行；失败时保留当前主题，状态区显示 error，**不会崩溃**。
- 可在设置里填一个错误地址（例如 `http://10.0.2.2:1`）再拉取验证。

降级阶梯：network 新包失败 → 继续显示当前（通常是 last-good）→ 从未成功过则 builtin。

---

## 5. 协议（简化）

`GET /v1/theme/manifest`：

```json
{
  "schemaVersion": 1,
  "snapshotId": "snap_...",
  "publishedAt": "2026-09-16T03:00:00.000Z",
  "ttlSeconds": 60,
  "colors": {
    "brand.primary": "#E65100",
    "text.primary": "#3E2723",
    "surface": "#FFF3E0",
    "background": "#FFF8F1"
  },
  "assets": {
    "home.banner": {
      "url": "http://10.0.2.2:8787/assets/home.banner-xxxx.png",
      "hash": "sha256:...",
      "mime": "image/png"
    },
    "logo": { "url": "...", "hash": "sha256:...", "mime": "image/png" }
  }
}
```

管理 API：

| 方法 | 路径 | 作用 |
|------|------|------|
| GET | `/admin/theme` | 草稿 + 已发布快照 |
| PUT | `/admin/theme/colors` | 更新草稿颜色 |
| POST | `/admin/theme/assets/:slot` | 上传 `file` 到 `home.banner` 或 `logo` |
| POST | `/admin/theme/publish` | 把草稿写成新 snapshot，供 Android 拉取 |

上传文件落在 `server/data/assets/`。

---

## 6. Android 模块约束

- 仅 Activities + XML layouts + Views。
- 图片加载：Coil；网络：OkHttp。
- 语义 Token 在客户端映射到运行时色值；`R.color.*` / `R.drawable.*` **只作为 builtin fallback**。
- 仓库内不应出现 Jetpack Compose 依赖或 `@Composable`。
