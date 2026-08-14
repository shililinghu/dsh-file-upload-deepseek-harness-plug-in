window.__ModuleLoader__.load({
  id: "@agent-hub/dsh-workspace-file-upload",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const React = require("react");

    const inject = ["slots", "locale"];
    const NS = "agent-hub-file-upload";
    const MAX_LISTED_FILES = 8;
    const CONFIG_URL = "/agent-hub/file-upload/config";

    /** zh / en dictionaries for this plugin's namespace (DSH locale ids are "zh" and "en"). */
    const DICTIONARIES = {
      zh: {
        "button.title": "上传普通文件或 zip 压缩包到当前工作区（zip 会自动解压，最多 {limit} MB/个）；也可直接拖拽文件到页面任意位置",
        "button.uploading": "上传中…",
        "button.drop": "松开上传",
        "button.file": "文件",
        "upload.overLimit": "{name} 超过 {mb} MB 限制（可在 设置 中调整）",
        "upload.badResponse": "上传响应无效",
        "upload.failed": "上传失败 ({status})",
        "upload.progress": "正在上传 {name}（{current}/{total}）…",
        "upload.done": "已上传 {count} 个文件",
        "drop.overlay": "松开以上传到工作区",
        "zip.extracted": "已上传并解压 zip：`{path}` → `{dir}/`，共 {count} 个文件{skipped}{via}：{listed}。请读取解压后的文件。",
        "zip.extractedLarge": "已上传并解压 zip：`{path}` → `{dir}/`，共 {count} 个文件{skipped}{via}。请先查看该目录下的文件列表，再读取需要的文件。",
        "zip.via": "（由 {tool} 解压）",
        "zip.skippedNote": "（跳过 {count} 个不支持条目）",
        "zip.extractFailed": "已上传 zip：`{path}`（解压失败：{reason}）。",
        "zip.read": "请读取工作区文件：`{path}`",
        "zip.errEntryLimit": "压缩包包含的文件数超过解压上限（{limit} 个）。文件已保存但未解压，请到 设置 → General 调高 zip 解压上限，或先用压缩软件手动解压。",
        "zip.errSizeLimit": "压缩包解压后体积超过上限（{limit} MB）。文件已保存但未解压，请到 设置 → General 调高 zip 解压上限，或先用压缩软件手动解压。",
        "zip.errCorrupt": "压缩包已保存，但解压失败（文件可能损坏或格式不受支持）。",
        "settings.uploadLabel": "文件上传大小上限",
        "settings.extractLabel": "zip 解压上限",
        "settings.unitMb": "MB",
        "settings.unitEntries": "个文件",
        "settings.save": "保存",
        "settings.saving": "保存中…",
        "settings.saved": "已保存",
        "settings.invalidUpload": "请输入 {min}–{max} 之间的整数（单位 MB）",
        "settings.invalidExtractMb": "请输入 {min}–{max} 之间的整数（单位 MB）",
        "settings.invalidExtractEntries": "请输入 {min}–{max} 之间的整数",
        "settings.saveBadResponse": "保存响应无效",
        "settings.saveFailed": "保存失败 ({status})",
        "slot.uploadLabel": "文件上传",
        "slot.uploadLimitLabel": "文件上传大小上限",
        "slot.extractLimitLabel": "zip 解压上限",
      },
      en: {
        "button.title": "Upload files or zip archives to the current workspace (zips auto-extract, max {limit} MB each); you can also drag & drop files anywhere on the page",
        "button.uploading": "Uploading…",
        "button.drop": "Drop to upload",
        "button.file": "Files",
        "upload.overLimit": "{name} exceeds the {mb} MB limit (adjust it in Settings)",
        "upload.badResponse": "Invalid upload response",
        "upload.failed": "Upload failed ({status})",
        "upload.progress": "Uploading {name} ({current}/{total})…",
        "upload.done": "Uploaded {count} file(s)",
        "drop.overlay": "Drop to upload to the workspace",
        "zip.extracted": "Uploaded and extracted zip: `{path}` → `{dir}/`, {count} file(s){skipped}{via}: {listed}. Please read the extracted files.",
        "zip.extractedLarge": "Uploaded and extracted zip: `{path}` → `{dir}/`, {count} file(s){skipped}{via}. Please list the files in that directory first, then read what you need.",
        "zip.via": " (extracted by {tool})",
        "zip.skippedNote": " ({count} unsupported entries skipped)",
        "zip.extractFailed": "Uploaded zip: `{path}` (extraction failed: {reason}).",
        "zip.read": "Please read the workspace file: `{path}`",
        "zip.errEntryLimit": "The archive contains more entries than the extraction limit ({limit}). The file was saved but not extracted — raise the zip extraction limit in Settings → General, or extract it manually with an archive tool.",
        "zip.errSizeLimit": "The archive would extract to more than the {limit} MB limit. The file was saved but not extracted — raise the zip extraction limit in Settings → General, or extract it manually with an archive tool.",
        "zip.errCorrupt": "The archive was saved, but extraction failed (the file may be corrupt or use an unsupported format).",
        "settings.uploadLabel": "Max upload size",
        "settings.extractLabel": "Zip extraction limit",
        "settings.unitMb": "MB",
        "settings.unitEntries": "entries",
        "settings.save": "Save",
        "settings.saving": "Saving…",
        "settings.saved": "Saved",
        "settings.invalidUpload": "Enter an integer between {min} and {max} (MB)",
        "settings.invalidExtractMb": "Enter an integer between {min} and {max} (MB)",
        "settings.invalidExtractEntries": "Enter an integer between {min} and {max}",
        "settings.saveBadResponse": "Invalid save response",
        "settings.saveFailed": "Save failed ({status})",
        "slot.uploadLabel": "File upload",
        "slot.uploadLimitLabel": "Max upload size",
        "slot.extractLimitLabel": "Zip extraction limit",
      },
    };

    /** Small fetch helper shared by the upload button and the settings rows. */
    async function fetchConfig() {
      const response = await fetch(CONFIG_URL, { cache: "no-store" });
      const result = await response.json().catch(() => ({ ok: false }));
      return result.ok
        ? {
            maxUploadMb: Number(result.maxUploadMb) || 25,
            maxExtractMb: Number(result.maxExtractMb) || 4096,
            maxExtractEntries: Number(result.maxExtractEntries) || 100000,
            minMb: Number(result.minMb) || 1,
            maxMb: Number(result.maxMb) || 2048,
            minExtractMb: Number(result.minExtractMb) || 1,
            maxExtractMbBound: Number(result.maxExtractMbCap) || 65536,
            minExtractEntries: Number(result.minExtractEntries) || 1,
            maxExtractEntriesBound: Number(result.maxExtractEntriesCap) || 10000000,
          }
        : {
            maxUploadMb: 25,
            maxExtractMb: 4096,
            maxExtractEntries: 100000,
            minMb: 1,
            maxMb: 2048,
            minExtractMb: 1,
            maxExtractMbBound: 65536,
            minExtractEntries: 1,
            maxExtractEntriesBound: 10000000,
          };
    }

    /** True when the drag payload contains at least one non-image file. */
    function hasNonImageFiles(dataTransfer) {
      if (!dataTransfer) return false;
      const types = Array.from(dataTransfer.types || []);
      if (!types.includes("Files")) return false;
      const items = Array.from(dataTransfer.items || []);
      // Items are unavailable in some browsers during dragover; when in
      // doubt, treat the drag as ours so non-image files can be received.
      if (!items.length) return true;
      return items.some((item) => item.kind === "file" && !(item.type || "").startsWith("image/"));
    }

    function UploadButton(props) {
      const t = props.t;
      const inputRef = React.useRef(null);
      const [busy, setBusy] = React.useState(false);
      const [status, setStatus] = React.useState(null);
      const [limit, setLimit] = React.useState(25);
      const [dragOver, setDragOver] = React.useState(false);
      const [dragActive, setDragActive] = React.useState(false);
      const dragDepthRef = React.useRef(0);
      const inputState = props.useInput((state) => state);
      // Track the latest draft across renders so an async upload never
      // clobbers text the user typed while the upload was in flight.
      const latestDraftRef = React.useRef(inputState.draft);
      latestDraftRef.current = inputState.draft;

      React.useEffect(() => {
        fetchConfig().then((config) => setLimit(config.maxUploadMb)).catch(() => {});
      }, []);

      // Re-render when the active locale changes so translated strings refresh.
      const [localeRev, setLocaleRev] = React.useState(0);
      React.useEffect(() => {
        if (!props.localeSubscribe) return undefined;
        return props.localeSubscribe(() => setLocaleRev((rev) => rev + 1));
      }, []);
      void localeRev;

      // Page-level drag & drop: anywhere in the window, non-image files are
      // received and uploaded; pure image drags keep the native attach flow.
      React.useEffect(() => {
        function onDragEnter(event) {
          if (!hasNonImageFiles(event.dataTransfer)) return;
          event.preventDefault();
          dragDepthRef.current += 1;
          setDragActive(true);
        }
        function onDragOver(event) {
          if (!hasNonImageFiles(event.dataTransfer)) return;
          // Required to allow drop; also stops the browser from opening files.
          event.preventDefault();
        }
        function onDragLeave(event) {
          if (!hasNonImageFiles(event.dataTransfer)) return;
          dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
          if (dragDepthRef.current === 0) setDragActive(false);
        }
        async function onDrop(event) {
          if (!hasNonImageFiles(event.dataTransfer)) return;
          event.preventDefault();
          dragDepthRef.current = 0;
          setDragActive(false);
          const files = Array.from(event.dataTransfer?.files || [])
            .filter((file) => !(file.type || "").startsWith("image/"));
          await uploadFilesRef.current(files);
        }
        window.addEventListener("dragenter", onDragEnter);
        window.addEventListener("dragover", onDragOver);
        window.addEventListener("dragleave", onDragLeave);
        window.addEventListener("drop", onDrop);
        return () => {
          window.removeEventListener("dragenter", onDragEnter);
          window.removeEventListener("dragover", onDragOver);
          window.removeEventListener("dragleave", onDragLeave);
          window.removeEventListener("drop", onDrop);
        };
      }, []);

      // Kept in a ref so the effect above never needs re-binding.
      const uploadFilesRef = React.useRef(null);

      async function uploadOne(file, maxBytes) {
        if (file.size > maxBytes) throw new Error(t("upload.overLimit", { name: file.name, mb: maxBytes / 1024 / 1024 }));
        const query = new URLSearchParams({ sessionId: String(props.sessionId), name: file.name });
        const response = await fetch(`/agent-hub/file-upload?${query}`, {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: file,
          cache: "no-store",
        });
        const result = await response.json().catch(() => ({ ok: false, error: t("upload.badResponse") }));
        if (!response.ok || !result.ok) throw new Error(result.error || t("upload.failed", { status: response.status }));
        return result;
      }

      function describeUpload(result) {
        if (result.kind === "zip") {
          if (result.extracted) {
            const files = result.files || [];
            const skippedNote = result.skipped && result.skipped.length
              ? t("zip.skippedNote", { count: result.skipped.length })
              : "";
            const viaNote = result.extractedVia ? t("zip.via", { tool: result.extractedVia }) : "";
            // Small archives: list the few file names. Large archives: give
            // the directory and count only — the agent explores with glob/read.
            if (files.length <= MAX_LISTED_FILES) {
              const listed = files.map((f) => `\`${f}\``).join("、");
              return t("zip.extracted", {
                path: result.path,
                dir: result.extracted,
                count: files.length,
                skipped: skippedNote,
                via: viaNote,
                listed,
                more: "",
              });
            }
            return t("zip.extractedLarge", {
              path: result.path,
              dir: result.extracted,
              count: files.length,
              skipped: skippedNote,
              via: viaNote,
            });
          }
          const reason = result.extractErrorCode === "ENTRY_LIMIT"
            ? t("zip.errEntryLimit", { limit: result.extractLimit })
            : result.extractErrorCode === "SIZE_LIMIT"
              ? t("zip.errSizeLimit", { limit: result.extractLimit })
              : t("zip.errCorrupt");
          return t("zip.extractFailed", { path: result.path, reason });
        }
        return t("zip.read", { path: result.path });
      }

      async function uploadFiles(files) {
        if (!files || !files.length) return;
        setBusy(true);
        setStatus(null);
        try {
          const config = await fetchConfig();
          const maxBytes = config.maxUploadMb * 1024 * 1024;
          const results = [];
          for (let i = 0; i < files.length; i += 1) {
            const file = files[i];
            setStatus({ tone: "info", text: t("upload.progress", { name: file.name, current: i + 1, total: files.length }) });
            results.push(await uploadOne(file, maxBytes));
          }
          const refs = results.map(describeUpload).join("\n");
          // Append to the LATEST draft (not the snapshot from when upload
          // started) so typing during the upload is preserved.
          const currentDraft = latestDraftRef.current;
          const prefix = currentDraft && !/\s$/.test(currentDraft) ? "\n" : "";
          props.inputActions.setDraft(`${currentDraft}${prefix}${refs}`);
          setStatus({ tone: "ok", text: t("upload.done", { count: results.length }) });
        } catch (error) {
          setStatus({ tone: "error", text: error instanceof Error ? error.message : String(error) });
        } finally {
          setBusy(false);
        }
      }
      uploadFilesRef.current = uploadFiles;

      async function onFiles(event) {
        const files = Array.from(event.target.files || []);
        event.target.value = "";
        await uploadFiles(files);
      }

      async function onDrop(event) {
        event.preventDefault();
        event.stopPropagation();
        setDragOver(false);
        if (busy || inputState.phase !== "plain") return;
        await uploadFiles(Array.from(event.dataTransfer?.files || []));
      }

      const buttonStyle = {
        border: dragOver ? "1px dashed var(--border-color, rgba(128,128,128,.55))" : "0",
        background: dragOver ? "var(--color-bg-active, rgba(128,128,128,.15))" : "transparent",
        color: "inherit",
        opacity: busy ? 0.55 : 0.78,
        cursor: busy ? "wait" : "pointer",
        padding: "4px 7px",
        borderRadius: "6px",
        fontSize: "12px",
        lineHeight: "20px",
      };

      return React.createElement(React.Fragment, null,
        React.createElement("input", {
          ref: inputRef,
          type: "file",
          multiple: true,
          hidden: true,
          onChange: onFiles,
        }),
        React.createElement("button", {
          type: "button",
          disabled: busy || inputState.phase !== "plain",
          title: t("button.title", { limit }),
          "aria-label": t("button.file"),
          onClick: () => inputRef.current && inputRef.current.click(),
          onDragOver: (event) => { event.preventDefault(); if (!busy) setDragOver(true); },
          onDragLeave: () => setDragOver(false),
          onDrop,
          style: buttonStyle,
        }, busy ? t("button.uploading") : dragOver ? t("button.drop") : t("button.file")),
        status && React.createElement("span", {
          style: {
            marginLeft: "4px",
            fontSize: "11px",
            lineHeight: "20px",
            color: status.tone === "error" ? "#e5484d" : status.tone === "ok" ? "#46a758" : "inherit",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: "240px",
            verticalAlign: "middle",
          },
        }, status.text),
        dragActive && React.createElement("div", {
          style: {
            position: "fixed",
            inset: "0",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,.45)",
            pointerEvents: "auto",
            fontFamily: "inherit",
          },
        }, React.createElement("div", {
          style: {
            padding: "28px 44px",
            borderRadius: "12px",
            background: "var(--color-bg, rgba(24,24,27,.92))",
            border: "2px dashed var(--border-color, rgba(128,128,128,.6))",
            color: "inherit",
            fontSize: "16px",
            fontWeight: 600,
            boxShadow: "0 8px 32px rgba(0,0,0,.35)",
          },
        }, t("drop.overlay")))
      );
    }

    /** Compact settings rows in Settings → General: upload limit + zip extract limit. */
    function UploadLimitRow(props) {
      const t = props.t;
      const [draft, setDraft] = React.useState("25");
      const [extractDraft, setExtractDraft] = React.useState("4096");
      const [entriesDraft, setEntriesDraft] = React.useState("100000");
      const [bounds, setBounds] = React.useState({ min: 1, max: 2048, minExtractMb: 1, maxExtractMb: 65536, minEntries: 1, maxEntries: 10000000 });
      const [busy, setBusy] = React.useState(false);
      const [message, setMessage] = React.useState(null);

      // Re-render when the active locale changes so translated strings refresh.
      const [localeRev, setLocaleRev] = React.useState(0);
      React.useEffect(() => {
        if (!props.localeSubscribe) return undefined;
        return props.localeSubscribe(() => setLocaleRev((rev) => rev + 1));
      }, []);
      void localeRev;

      React.useEffect(() => {
        let cancelled = false;
        fetchConfig().then((config) => {
          if (cancelled) return;
          setDraft(String(config.maxUploadMb));
          setExtractDraft(String(config.maxExtractMb));
          setEntriesDraft(String(config.maxExtractEntries));
          setBounds({
            min: config.minMb,
            max: config.maxMb,
            minExtractMb: config.minExtractMb,
            maxExtractMb: config.maxExtractMbBound,
            minEntries: config.minExtractEntries,
            maxEntries: config.maxExtractEntriesBound,
          });
        }).catch(() => {});
        return () => { cancelled = true; };
      }, []);

      async function postConfig(patch) {
        const response = await fetch(CONFIG_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
          cache: "no-store",
        });
        const result = await response.json().catch(() => ({ ok: false, error: t("settings.saveBadResponse") }));
        if (!response.ok || !result.ok) throw new Error(result.error || t("settings.saveFailed", { status: response.status }));
        return result;
      }

      async function saveUpload() {
        const value = Number(draft);
        if (!Number.isInteger(value) || value < bounds.min || value > bounds.max) {
          setMessage({ tone: "error", text: t("settings.invalidUpload", { min: bounds.min, max: bounds.max }) });
          return;
        }
        setBusy(true);
        setMessage(null);
        try {
          const result = await postConfig({ maxUploadMb: value });
          setDraft(String(result.maxUploadMb));
          setMessage({ tone: "ok", text: t("settings.saved") });
        } catch (error) {
          setMessage({ tone: "error", text: error instanceof Error ? error.message : String(error) });
        } finally {
          setBusy(false);
        }
      }

      async function saveExtract() {
        const value = Number(extractDraft);
        if (!Number.isInteger(value) || value < bounds.minExtractMb || value > bounds.maxExtractMb) {
          setMessage({ tone: "error", text: t("settings.invalidExtractMb", { min: bounds.minExtractMb, max: bounds.maxExtractMb }) });
          return;
        }
        setBusy(true);
        setMessage(null);
        try {
          const result = await postConfig({ maxExtractMb: value });
          setExtractDraft(String(result.maxExtractMb));
          setMessage({ tone: "ok", text: t("settings.saved") });
        } catch (error) {
          setMessage({ tone: "error", text: error instanceof Error ? error.message : String(error) });
        } finally {
          setBusy(false);
        }
      }

      async function saveEntries() {
        const value = Number(entriesDraft);
        if (!Number.isInteger(value) || value < bounds.minEntries || value > bounds.maxEntries) {
          setMessage({ tone: "error", text: t("settings.invalidExtractEntries", { min: bounds.minEntries, max: bounds.maxEntries }) });
          return;
        }
        setBusy(true);
        setMessage(null);
        try {
          const result = await postConfig({ maxExtractEntries: value });
          setEntriesDraft(String(result.maxExtractEntries));
          setMessage({ tone: "ok", text: t("settings.saved") });
        } catch (error) {
          setMessage({ tone: "error", text: error instanceof Error ? error.message : String(error) });
        } finally {
          setBusy(false);
        }
      }

      const rowStyle = { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", padding: "2px 0", fontSize: "13px" };
      const labelStyle = { color: "inherit" };
      const inputStyle = {
        width: "72px",
        padding: "3px 6px",
        borderRadius: "6px",
        border: "1px solid var(--border-color, rgba(128,128,128,.35))",
        background: "transparent",
        color: "inherit",
        fontSize: "13px",
      };
      const unitStyle = { color: "inherit", opacity: 0.75 };
      const buttonStyle = {
        padding: "3px 12px",
        borderRadius: "6px",
        border: "1px solid var(--border-color, rgba(128,128,128,.35))",
        background: "transparent",
        color: "inherit",
        cursor: busy ? "wait" : "pointer",
        fontSize: "13px",
      };

      return React.createElement(React.Fragment, null,
        React.createElement("div", { style: rowStyle },
          React.createElement("label", { style: labelStyle }, t("settings.uploadLabel")),
          React.createElement("input", {
            type: "number", min: bounds.min, max: bounds.max, step: 1,
            value: draft,
            onChange: (event) => setDraft(event.target.value),
            onKeyDown: (event) => { if (event.key === "Enter") saveUpload(); },
            disabled: busy, style: inputStyle,
          }),
          React.createElement("span", { style: unitStyle }, t("settings.unitMb")),
          React.createElement("button", { type: "button", onClick: saveUpload, disabled: busy, style: buttonStyle },
            busy ? t("settings.saving") : t("settings.save")),
        ),
        React.createElement("div", { style: rowStyle },
          React.createElement("label", { style: labelStyle }, t("settings.extractLabel")),
          React.createElement("input", {
            type: "number", min: bounds.minExtractMb, max: bounds.maxExtractMb, step: 1,
            value: extractDraft,
            onChange: (event) => setExtractDraft(event.target.value),
            onKeyDown: (event) => { if (event.key === "Enter") saveExtract(); },
            disabled: busy, style: inputStyle,
          }),
          React.createElement("span", { style: unitStyle }, t("settings.unitMb")),
          React.createElement("input", {
            type: "number", min: bounds.minEntries, max: bounds.maxEntries, step: 1,
            value: entriesDraft,
            onChange: (event) => setEntriesDraft(event.target.value),
            onKeyDown: (event) => { if (event.key === "Enter") saveEntries(); },
            disabled: busy, style: inputStyle,
          }),
          React.createElement("span", { style: unitStyle }, t("settings.unitEntries")),
          React.createElement("button", { type: "button", onClick: saveEntries, disabled: busy, style: buttonStyle },
            busy ? t("settings.saving") : t("settings.save")),
        ),
        message && React.createElement("div", { style: { padding: "2px 0" } },
          React.createElement("span", { style: { fontSize: "12px", color: message.tone === "error" ? "#e5484d" : "#46a758" } }, message.text)
        )
      );
    }

    function apply(ctx) {
      const t = ctx.locale.bind(NS);
      // ctx.effect(cb) runs cb immediately and keeps ITS RETURN VALUE as the
      // cleanup disposer. So we must pass () => register(...) — passing the
      // disposer itself would call it right away and unregister the dicts.
      ctx.effect(() => ctx.locale.register(NS, DICTIONARIES));
      // Pass the locale subscription through so components re-render on
      // language switch (t() reads the active locale at call time, but the
      // component must re-render for new strings to show).
      const localeSubscribe = ctx.locale.subscribe.bind(ctx.locale);

      ctx.slots.inject("conversation.input.left", () => ctx.slots.register({
        name: "conversation.input.left",
        id: "agent-hub-workspace-file-upload",
        order: 35,
        label: t("slot.uploadLabel"),
      }, (props) => React.createElement(UploadButton, Object.assign({}, props, { t, localeSubscribe }))));
      ctx.slots.inject("settings.general.item", () => ctx.slots.register({
        name: "settings.general.item",
        id: "agent-hub-workspace-file-upload-limit",
        order: 30,
        label: t("slot.uploadLimitLabel"),
      }, (props) => React.createElement(UploadLimitRow, Object.assign({}, props, { t, localeSubscribe }))));
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});
