# dsh-file-upload-deepseek-harness-plug-in

> DeepSeek Harness 工作区文件上传插件 —— 支持普通文件上传、zip 自动解压、页面级拖拽上传，上传/解压上限可在设置面板图形化调整，界面中英双语。

## ✨ 功能特性

- 📤 **上传到工作区**：点击输入框左侧的「文件」按钮选择文件，上传到当前会话工作区的 `.agent-hub/uploads/` 目录
- 🗜️ **zip 自动解压**：上传 zip 后自动解压到同目录，并把文件清单写入输入框，Agent 可直接读取解压后的文件
- 🖱️ **页面级拖拽上传**：把文件拖到**页面任意位置**即出现"松开上传"全屏提示，松手即可上传（图片拖拽保持原生附件行为，不拦截）
- ⚙️ **图形化调整上限**：设置 → General → 可分别调整「文件上传大小上限」和「zip 解压上限」（解压体积 + 条目数），输入数字点保存立即生效
- 🛠️ **系统工具兜底解压**：内置解压器无法处理的压缩格式（bzip2/lzma/zstd 等）或损坏 zip，自动尝试 7-Zip / tar / PowerShell Expand-Archive
- 🌐 **多语言**：界面中英双语，跟随 Harness 设置里的语言切换即时生效
- 🛡️ **安全设计**：仅允许本地回环同源（127.0.0.1 / localhost）上传；zip 解压内置防路径穿越、防 zip 炸弹、跳过加密/符号链接条目

## 📦 安装

### 前提

- 已安装 [DeepSeek Harness](https://github.com/deepseek-ai/DeepSeek-Harness)（Web 版）
- Node.js 环境可用

### 步骤

1. 将插件放入 Harness 用户插件目录：

```bash
# 将本仓库克隆到 Harness 的插件目录（Windows 示例）
git clone https://github.com/shililinghu/dsh-file-upload-deepseek-harness-plug-in.git "$HOME\.dsh\plugins\agent-hub-workspace-file-upload"
```

2. 在 Harness 的 profile 中引入该插件。编辑 `~/.dsh/profiles/<profile>/cordis.patch.yml`：

```yaml
- insert:
    - id: agent-hub-workspace-file-upload
      name: '@agent-hub/dsh-workspace-file-upload'
```

3. 在 profile 的 `package.json` 中添加依赖（指向插件目录）：

```json
{
  "dependencies": {
    "@agent-hub/dsh-workspace-file-upload": "link:C:/Users/<你>/.dsh/plugins/agent-hub-workspace-file-upload"
  }
}
```

4. 重启 DeepSeek Harness，刷新浏览器页面。

## 🚀 使用

### 上传文件

- 点击输入框左侧的 **「文件」** 按钮选择文件（可多选）
- 或把文件**拖到页面任意位置**，出现"松开以上传到工作区"遮罩后松手
- 上传成功后，输入框会自动填入 `请读取工作区文件：\`路径\``，发送后 Agent 即可读取

### 上传 zip

上传 zip 后会自动解压，输入框会提示：

```
已上传并解压 zip：`路径.zip` → `解压目录/`，共 N 个文件：`a.txt`、`b.md`…。请读取解压后的文件。
```

- 若由系统工具兜底解压（如 bzip2 压缩），会额外标注"（由 tar 解压）"
- 若解压超限，会给出中文/英文友好提示（"文件已保存但未解压，请调高 zip 解压上限…"），并保留 zip 文件本身

### 调整上传/解压上限

1. 打开左下角 **设置**
2. 进入 **General（通用）** 区域
3. 三组配置各自独立保存：
   - **文件上传大小上限**（MB）：默认 25，范围 1–2048
   - **zip 解压上限**（MB）：默认 4096，范围 1–65536
   - **zip 解压条目数**（个）：默认 100000，范围 1–10000000
4. 保存成功显示绿色「已保存」，立即生效

> 超过上传上限的文件会被拒绝并提示当前限制值。解压超限时 zip 文件仍保留，可调高上限后重新拖入。

## ⚠️ 注意事项

- 上限保存在插件目录的 `config.json`（运行时配置，已被 `.gitignore` 排除，不会入库）
- 上传目录位于工作区内的 `.agent-hub/uploads/`，会占用工作区磁盘空间；大 zip 解压后占用更多，请留意剩余空间
- 系统工具兜底依赖本机工具：Windows 10+ 自带 `tar`；`7z`（7-Zip）如已安装会优先使用；PowerShell `Expand-Archive` 作为最后兜底
- 插件改动生效规则：改 `lib/client.js`（客户端）刷新页面即可；改 `lib/index.js` / `lib/zip.js`（宿主端）需重启 Harness

## 🔧 技术说明

- **宿主端**（`lib/index.js`）：通过 `webServer` 注册 `/agent-hub/file-upload` 上传路由与 `/agent-hub/file-upload/config` 配置路由；上传采用流式写入，zip 魔数嗅探 + 自动解压；解压失败时按 7z → tar → PowerShell 顺序兜底
- **解压器**（`lib/zip.js`）：零依赖纯 JS zip 解析（`node:zlib`），支持 STORE/DEFLATE、ZIP64、UTF-8 文件名；结构化错误码（`ENTRY_LIMIT` / `SIZE_LIMIT` / `CORRUPT`）供客户端本地化提示
- **客户端**（`lib/client.js`）：注册 `conversation.input.left`（上传按钮）与 `settings.general.item`（上限设置行）两个 Slot；接入 DSH `locale` 服务实现中英双语；页面级拖拽通过 window 事件监听实现（非图片文件才拦截）
- **多语言**：词典注册在 `agent-hub-file-upload` 命名空间（`zh-CN` / `en`），组件订阅 locale 变更自动重渲染

## 📄 License

MIT
