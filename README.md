# dsh-file-upload-deepseek-harness-plug-in

> DeepSeek Harness 工作区文件上传插件 —— 支持普通文件上传、zip 自动解压、拖拽上传，并在设置面板中一键调整上传大小上限。

## ✨ 功能特性

- 📤 **上传到工作区**：点击输入框左侧的「文件」按钮选择文件，上传到当前会话工作区的 `.agent-hub/uploads/` 目录
- 🗜️ **zip 自动解压**：上传 zip 后自动解压到同目录，并把文件清单写入输入框，Agent 可直接读取解压后的文件
- 🖱️ **拖拽上传**：把文件直接拖到「文件」按钮上，松开即可上传（支持多文件）
- ⚙️ **图形化调整上限**：设置 → General → 「文件上传大小上限」，输入数字（MB）点保存立即生效，默认 25 MB，范围 1–2048 MB
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
- 或将文件**拖拽**到该按钮上松开
- 上传成功后，输入框会自动填入 `请读取工作区文件：\`路径\``，发送后 Agent 即可读取

### 上传 zip

上传 zip 后会自动解压，输入框会提示：

```
已上传并解压 zip：`路径.zip` → `解压目录/`，共 N 个文件：`a.txt`、`b.md`…。请读取解压后的文件。
```

Agent 可直接读取解压出的文件内容。

### 调整上传大小上限

1. 打开左下角 **设置**
2. 进入 **General（通用）** 区域
3. 找到「文件上传大小上限」，输入数字（单位 MB）后点 **保存**（或按回车）
4. 保存成功显示绿色「已保存」，立即生效

> 上限范围 1–2048 MB。超过上限的文件会被拒绝并提示当前限制值。

## ⚠️ 注意事项

- **上限默认 25 MB**，可在设置面板调整；`config.json` 为运行时配置，已被 `.gitignore` 排除
- 上传目录位于工作区内的 `.agent-hub/uploads/`，会占用工作区磁盘空间
- zip 解压有独立安全上限（默认解压总量 256 MB、条目 4096），超大压缩包建议先本地解压再上传

## 🔧 技术说明

- **宿主端**（`lib/index.js`）：通过 `webServer` 注册 `/agent-hub/file-upload` 上传路由与 `/agent-hub/file-upload/config` 配置路由；上传采用流式写入，zip 魔数嗅探 + 自动解压
- **解压器**（`lib/zip.js`）：零依赖纯 JS zip 解析（`node:zlib`），支持 STORE/DEFLATE、ZIP64、UTF-8 文件名
- **客户端**（`lib/client.js`）：注册 `conversation.input.left`（上传按钮）与 `settings.general.item`（上限设置行）两个 Slot

## 📄 License

MIT
