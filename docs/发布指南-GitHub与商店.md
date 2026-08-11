# 发布指南：GitHub + 软件商店

> 目标：把 Study desktop 变成可以分发、可以自动更新的正式版本。

## 一、GitHub 发布（最快、免费、带自动更新）——推荐

项目已具备：GitHub Actions 工作流（`.github/workflows/release.yml`）、electron-builder 配置（`publish: github`）、`latest.yml` 更新清单（electron-updater 用它做增量更新）。

### 步骤（需要你的 GitHub 账号操作，我无法代劳登录）

1. **建仓库**：GitHub 新建仓库，名字建议 `study-desktop`（Public 即可）。
2. **关联并推送**（在 `E:\code\learning-desktop` 执行）：
   ```
   git remote add origin https://github.com/<你的用户名>/study-desktop.git
   git branch -M main
   git push -u origin main
   ```
3. **把 `electron-builder.yml` 里的占位替换为你的用户名**：
   ```
   publish:
     provider: github
     owner: <你的用户名>
     repo: study-desktop
   ```
   （工作流里已有 `-c.publish.provider=github` 兜底，不填 owner/repo 也能用 Actions 自动识别。）
4. **打标签触发自动构建发布**：
   ```
   git add -A && git commit -m "v1.3.0 发布"
   git tag v1.3.0
   git push origin main --tags
   ```
   GitHub Actions 会在 `windows-latest` 上执行 `npm ci && npx electron-builder --publish always`，自动产出安装包并发布到 Releases。
5. **用户下载**：Releases 页面下载 `Study desktop Setup 1.3.0.exe`；应用内更新检查（`app:checkUpdate`）会读取 GitHub 最新版，后续发新标签即可自动提示升级。

> 注：首次 `git push` 前建议把仓库里的 `release/`（构建产物）、`node_modules` 加入 `.gitignore`（仓库根已有 `.gitignore`，确认包含即可）。工作流依赖 `package-lock.json`（已存在）。

## 二、软件商店评估

| 渠道 | 可行性 | 门槛 | 建议 |
|---|---|---|---|
| **GitHub Releases** | ✅ 现在就能上 | 免费、一个账号 | 第一站 |
| **Microsoft Store** | 可上 | 微软开发者账号（2025-09 起个人注册免费，原 $19 已免除）、需政府证件+自拍实名验证、需 MSIX 打包改造（商店自动签名，免费） | 第二站（GitHub 稳定后） |
| **腾讯/华为/小米等国内商店** | 可上 | 需软件著作权、ICP 备案、个人/企业资质、各平台审核 | 门槛高，暂缓 |
| **Gitee Releases** | 可上 | 免费，国内下载快 | 可作国内镜像（免费） |

### 建议路线
1. **现在**：GitHub Releases 发布 v1.3.0（上文步骤）。
2. **可选**：同步一个 Gitee 镜像，国内用户下载更快。
3. **后期**：GitHub 稳定 + 用户反馈 OK 后，评估 Microsoft Store。费用已归零（个人注册免费、商店自动签名免费），主要成本是 MSIX 打包改造 + 实名验证 + 审核（1-3 个工作日）。
4. 国内商店等你有正式用户量/资质后再评估。

## 三、当前构建产物
- `release/Study desktop Setup 1.3.1.exe`（约 127.5 MB，NSIS 安装包；含小咕品牌图标、最大化不盖任务栏、小咕「×」可关闭等修复）
- 默认数据：仅「高等数学」一个科目，两章示例（函数与极限 / 导数与微分）；全新安装即全新体验。
- 历史使用数据已备份至 `C:\Users\20541\AppData\Roaming\study-desktop-data-backup-20260811\`（可随时找回，不参与新体验）。