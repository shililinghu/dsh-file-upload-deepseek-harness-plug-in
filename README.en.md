# dsh-file-upload-deepseek-harness-plug-in

> Workspace file upload plugin for DeepSeek Harness — upload files, auto-extract zips, drag & drop anywhere on the page, adjust upload/extract limits from the Settings panel, with a bilingual (zh/en) UI.

## ✨ Features

- 📤 **Upload to the workspace**: click the **Files** button on the left of the input box to upload files into the current session's workspace `.agent-hub/uploads/` directory
- 🗜️ **Zip auto-extract**: uploaded zips are extracted next to the archive; the Agent can read the extracted files directly (bzip2/lzma/zstd etc. via the system-tool fallback below)
- 🖱️ **Page-wide drag & drop**: drop files **anywhere on the page** — a full-screen "Drop to upload" overlay appears, release to upload (image drags keep the native attach flow and are not intercepted)
- 🏷️ **Uploaded-file list**: after uploading, files appear as numbered chips next to the **Files** button (name + size, zips carry a badge); hovering shows the full path / extraction dir; each chip can be removed individually or all cleared at once — deleting also removes the workspace copy
- 💬 **Free-form commands**: uploading never writes text into the input box; the command is entirely up to you ("edit this", "just read this", …), referencing a chip's path as needed
- ⚙️ **Graphical limit controls**: Settings → General — adjust **max upload size** and **zip extraction limit** (extracted bytes + entry count) independently, type a number and hit Save
- 🛠️ **System-tool extraction fallback**: compression methods the built-in reader can't handle (bzip2/lzma/zstd…) or corrupt archives fall back to 7-Zip / tar / PowerShell Expand-Archive automatically
- 🌐 **Bilingual UI**: Chinese and English, switching instantly with the Harness language setting
- 🛡️ **Security**: uploads are restricted to loopback same-origin (127.0.0.1 / localhost); zip extraction guards against path traversal, zip bombs, and skips encrypted / symlink entries

## 📦 Installation

### Prerequisites

- [DeepSeek Harness](https://github.com/deepseek-ai/DeepSeek-Harness) (Web) installed
- Node.js available

### Steps

1. Put the plugin into the Harness user plugin directory:

```bash
# Clone this repo into the Harness plugins dir (Windows example)
git clone https://github.com/shililinghu/dsh-file-upload-deepseek-harness-plug-in.git "$HOME\.dsh\plugins\agent-hub-workspace-file-upload"
```

2. Register the plugin in the Harness profile. Edit `~/.dsh/profiles/<profile>/cordis.patch.yml`:

```yaml
- insert:
    - id: agent-hub-workspace-file-upload
      name: '@agent-hub/dsh-workspace-file-upload'
```

3. Add the dependency in the profile's `package.json` (pointing at the plugin dir):

```json
{
  "dependencies": {
    "@agent-hub/dsh-workspace-file-upload": "link:C:/Users/<you>/.dsh/plugins/agent-hub-workspace-file-upload"
  }
}
```

4. Restart DeepSeek Harness and refresh the browser page.

## 🚀 Usage

### Uploading files

- Click the **Files** button on the left of the input box and pick files (multi-select supported)
- Or **drag files anywhere on the page** — release over the "Drop to upload to the workspace" overlay
- After uploading, files appear as chips next to the **Files** button (numbered). The **input box stays empty** — you write the command.

### Managing uploaded files

Each chip shows an index, file name and size (zips carry a badge):

```
Uploaded: 1. report.zip  2.3 MB [zip] [✕]  2. doc.md  12 KB [✕]  3. ….zip  [✕]  [Clear]
```

- **See the path**: hover a chip to show its full path (zips show the extraction dir and file count)
- **Remove one**: click the ✕ at the end of a chip (turns red on hover) — this **also deletes the copy in the workspace `.agent-hub/uploads/`** (for zips, the extraction dir too)
- **Clear all**: click **Clear** to delete every uploaded copy of the current session
- Removal only affects the current session's list, never another session's uploads

### Uploading a zip

Uploaded zips extract automatically; the chip gets a `zip` badge and hovering shows the extraction dir. Then type whatever command you want, e.g.:

- "Read the README under `.agent-hub/uploads/xxx/`"
- "Change a setting in `config.json` inside the extracted folder"

- If a system tool handled the extraction (e.g. bzip2), the hover tooltip notes the tool used
- If extraction exceeds the limits, the chip shows a red ⚠️ and the tooltip gives a friendly (zh/en) message — the zip file itself is kept, so you can raise the limit and re-drop it

### Adjusting upload / extract limits

1. Open **Settings** (bottom-left)
2. Go to the **General** section
3. Three settings, each saved independently:
   - **Max upload size** (MB): default 25, range 1–2048
   - **Zip extraction limit** (MB): default 4096, range 1–65536
   - **Zip extraction entries**: default 100000, range 1–10000000
4. A green "Saved" confirms, taking effect immediately

> Files over the upload limit are rejected with the current limit shown. When extraction exceeds a limit the zip is kept; raise the limit and re-drop it.

## ⚠️ Notes

- Limits live in the plugin dir's `config.json` (runtime config, excluded via `.gitignore`, never committed)
- Uploads go to `.agent-hub/uploads/` inside the workspace and consume disk space; large zips extract to even more — watch your free space
- The system-tool fallback needs a local tool: Windows 10+ ships `tar`; `7z` (7-Zip) is preferred if installed; PowerShell `Expand-Archive` is the last resort
- Applying changes: edits to `lib/client.js` (client) only need a page refresh; edits to `lib/index.js` / `lib/zip.js` (host) require a Harness restart

## 🔧 Technical overview

- **Host** (`lib/index.js`): registers `/agent-hub/file-upload` (upload), `/agent-hub/file-upload/delete` (delete) and `/agent-hub/file-upload/config` (config) routes on `webServer`; streaming writes, zip magic sniffing + auto-extract; fallback order 7z → tar → PowerShell on failure; the delete route validates that the target stays inside the uploads directory (path-traversal proof)
- **Extractor** (`lib/zip.js`): dependency-free pure-JS zip parsing (`node:zlib`), STORE/DEFLATE, ZIP64, UTF-8 names; structured error codes (`ENTRY_LIMIT` / `SIZE_LIMIT` / `CORRUPT`) drive localized client messages
- **Client** (`lib/client.js`): registers `conversation.input.left` (upload button + file list) and `settings.general.item` (limit rows); the file list is a module-level store scoped per session (delete/clear only touch the current session); DSH `locale` service powers the bilingual UI; page-wide drag & drop via window event listeners (only non-image files are intercepted)
- **i18n**: dictionaries live in the `agent-hub-file-upload` namespace (`zh` / `en`, matching DSH's locale ids); components subscribe to locale changes and re-render automatically

## 📄 License

MIT
