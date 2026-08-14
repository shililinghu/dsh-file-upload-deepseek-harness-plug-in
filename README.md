# dsh-file-upload-deepseek-harness-plug-in

**中文** | [English](README.en.md)

> DeepSeek Harness 工作区文件上传插件 —— 支持普通文件上传、zip 自动解压、页面级拖拽上传，上传/解压上限可在设置面板图形化调整，界面中英双语。

## ✨ 功能特性

- 📤 **上传到工作区**：点击输入框左侧的「文件」按钮选择文件，上传到当前会话工作区的 `.agent-hub/uploads/` 目录
- 🗜️ **zip 自动解压**：上传 zip 后自动解压到同目录，Agent 可直接读取解压后的文件（支持 bzip2/lzma/zstd 等格式，见系统工具兜底）
- 🖱️ **页面级拖拽上传**：把文件拖到**页面任意位置**即出现"松开上传"全屏提示，松手即可上传（图片拖拽保持原生附件行为，不拦截）
- 🏷️ **上传文件列表**：上传成功后，文件以带序号的 chip 显示在「文件」按钮旁（文件名 + 大小，zip 带徽标），鼠标悬停显示完整路径/解压目录；每个 chip 可单独删除、可一键清空，删除会同时移除工作区中的副本
- 💬 **命令自由输入**：上传不会自动往输入框塞提示文本，命令完全由你写（"帮我改这个" / "只读这个" 等），按需引用 chip 路径即可
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
- 上传成功后，文件会以 chip 形式显示在「文件」按钮旁（带序号），**输入框保持空白**，命令由你自己输入

### 管理已上传文件

每个文件 chip 显示序号、文件名、大小（zip 带徽标）：

```
已上传： 1. report.zip  2.3 MB [zip] [✕]  2. 文档.md  12 KB [✕]  3. ….zip  [✕]  [清空]
```

- **查看路径**：鼠标悬停 chip，显示完整路径（zip 显示解压目录和文件数）
- **删除单个**：点 chip 末尾的 ✕（悬停变红），会**同时删除工作区 `.agent-hub/uploads/` 里的文件副本**（zip 连同解压目录）
- **清空全部**：点「清空」，删除本会话所有已上传文件的副本
- 删除只影响当前会话的列表，不会影响其他会话的上传

### 上传 zip

上传 zip 后会自动解压，chip 带 `zip` 徽标，悬停可看到解压目录。之后你可以在输入框里自由下命令，比如：

- "读取 `.agent-hub/uploads/xxx/` 下的 README"
- "修改解压目录里 `config.json` 的某个配置"

- 若由系统工具兜底解压（如 bzip2 压缩），悬停提示会标注解压方式
- 若解压超限，chip 会显示红色 ⚠️，悬停给出中文/英文友好提示（"文件已保存但未解压，请调高 zip 解压上限…"），zip 文件本身保留

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

- **宿主端**（`lib/index.js`）：通过 `webServer` 注册 `/agent-hub/file-upload` 上传路由、`/agent-hub/file-upload/delete` 删除路由与 `/agent-hub/file-upload/config` 配置路由；上传采用流式写入，zip 魔数嗅探 + 自动解压；解压失败时按 7z → tar → PowerShell 顺序兜底；删除路由校验路径必须位于 uploads 目录内，防止路径穿越
- **解压器**（`lib/zip.js`）：零依赖纯 JS zip 解析（`node:zlib`），支持 STORE/DEFLATE、ZIP64、UTF-8 文件名；结构化错误码（`ENTRY_LIMIT` / `SIZE_LIMIT` / `CORRUPT`）供客户端本地化提示
- **客户端**（`lib/client.js`）：注册 `conversation.input.left`（上传按钮 + 文件列表）与 `settings.general.item`（上限设置行）两个 Slot；文件列表为模块级 store（按会话隔离，删除/清空只影响当前会话）；接入 DSH `locale` 服务实现中英双语；页面级拖拽通过 window 事件监听实现（非图片文件才拦截）
- **多语言**：词典注册在 `agent-hub-file-upload` 命名空间（`zh` / `en`，对应 DSH 的语言 id），组件订阅 locale 变更自动重渲染

## 📄 License

MIT
