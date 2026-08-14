window.__ModuleLoader__.load({
  id: "@agent-hub/dsh-workspace-file-upload",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const React = require("react");

    const inject = ["slots"];
    const MAX_LISTED_FILES = 12;
    const CONFIG_URL = "/agent-hub/file-upload/config";

    /** Small fetch helper shared by the upload button and the settings row. */
    async function fetchConfig() {
      const response = await fetch(CONFIG_URL, { cache: "no-store" });
      const result = await response.json().catch(() => ({ ok: false }));
      return result.ok
        ? { maxUploadMb: Number(result.maxUploadMb) || 25, minMb: Number(result.minMb) || 1, maxMb: Number(result.maxMb) || 2048 }
        : { maxUploadMb: 25, minMb: 1, maxMb: 2048 };
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
        if (file.size > maxBytes) throw new Error(`${file.name} 超过 ${maxBytes / 1024 / 1024} MB 限制（可在 设置 中调整）`);
        const query = new URLSearchParams({ sessionId: String(props.sessionId), name: file.name });
        const response = await fetch(`/agent-hub/file-upload?${query}`, {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: file,
          cache: "no-store",
        });
        const result = await response.json().catch(() => ({ ok: false, error: "上传响应无效" }));
        if (!response.ok || !result.ok) throw new Error(result.error || `上传失败 (${response.status})`);
        return result;
      }

      function describeUpload(result) {
        if (result.kind === "zip") {
          if (result.extracted) {
            const files = result.files || [];
            const listed = files.slice(0, MAX_LISTED_FILES).map((f) => `\`${f}\``).join("、");
            const more = files.length > MAX_LISTED_FILES ? `等 ${files.length} 个文件` : "";
            const skippedNote = result.skipped && result.skipped.length
              ? `（跳过 ${result.skipped.length} 个不支持条目）`
              : "";
            return `已上传并解压 zip：\`${result.path}\` → \`${result.extracted}/\`，共 ${files.length} 个文件${skippedNote}：${listed}${more}。请读取解压后的文件。`;
          }
          return `已上传 zip：\`${result.path}\`${result.extractError ? `（解压失败：${result.extractError}）` : ""}。`;
        }
        return `请读取工作区文件：\`${result.path}\``;
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
            setStatus({ tone: "info", text: `正在上传 ${file.name}（${i + 1}/${files.length}）…` });
            results.push(await uploadOne(file, maxBytes));
          }
          const refs = results.map(describeUpload).join("\n");
          // Append to the LATEST draft (not the snapshot from when upload
          // started) so typing during the upload is preserved.
          const currentDraft = latestDraftRef.current;
          const prefix = currentDraft && !/\s$/.test(currentDraft) ? "\n" : "";
          props.inputActions.setDraft(`${currentDraft}${prefix}${refs}`);
          setStatus({ tone: "ok", text: `已上传 ${results.length} 个文件` });
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
          title: "上传普通文件或 zip 压缩包到当前工作区（zip 会自动解压，最多 " + limit + " MB/个）；也可直接拖拽文件到页面任意位置",
          "aria-label": "上传文件",
          onClick: () => inputRef.current && inputRef.current.click(),
          onDragOver: (event) => { event.preventDefault(); if (!busy) setDragOver(true); },
          onDragLeave: () => setDragOver(false),
          onDrop,
          style: buttonStyle,
        }, busy ? "上传中…" : dragOver ? "松开上传" : "文件"),
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
        }, "松开以上传到工作区"))
      );
    }

    /** One compact row in Settings → General: a number + 保存. */
    function UploadLimitRow() {
      const [draft, setDraft] = React.useState("25");
      const [limit, setLimit] = React.useState(25);
      const [bounds, setBounds] = React.useState({ min: 1, max: 2048 });
      const [busy, setBusy] = React.useState(false);
      const [message, setMessage] = React.useState(null);

      React.useEffect(() => {
        let cancelled = false;
        fetchConfig().then((config) => {
          if (cancelled) return;
          setLimit(config.maxUploadMb);
          setDraft(String(config.maxUploadMb));
          setBounds({ min: config.minMb, max: config.maxMb });
        }).catch(() => {});
        return () => { cancelled = true; };
      }, []);

      async function save() {
        const value = Number(draft);
        if (!Number.isInteger(value) || value < bounds.min || value > bounds.max) {
          setMessage({ tone: "error", text: `请输入 ${bounds.min}–${bounds.max} 之间的整数（单位 MB）` });
          return;
        }
        setBusy(true);
        setMessage(null);
        try {
          const response = await fetch(CONFIG_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ maxUploadMb: value }),
            cache: "no-store",
          });
          const result = await response.json().catch(() => ({ ok: false, error: "保存响应无效" }));
          if (!response.ok || !result.ok) throw new Error(result.error || `保存失败 (${response.status})`);
          setLimit(result.maxUploadMb);
          setMessage({ tone: "ok", text: "已保存" });
        } catch (error) {
          setMessage({ tone: "error", text: error instanceof Error ? error.message : String(error) });
        } finally {
          setBusy(false);
        }
      }

      return React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: "8px",
          flexWrap: "wrap",
          padding: "2px 0",
          fontSize: "13px",
        },
      },
        React.createElement("label", { style: { color: "inherit" } }, "文件上传大小上限"),
        React.createElement("input", {
          type: "number",
          min: bounds.min,
          max: bounds.max,
          step: 1,
          value: draft,
          onChange: (event) => setDraft(event.target.value),
          onKeyDown: (event) => { if (event.key === "Enter") save(); },
          disabled: busy,
          style: {
            width: "72px",
            padding: "3px 6px",
            borderRadius: "6px",
            border: "1px solid var(--border-color, rgba(128,128,128,.35))",
            background: "transparent",
            color: "inherit",
            fontSize: "13px",
          },
        }),
        React.createElement("span", { style: { color: "inherit", opacity: 0.75 } }, "MB"),
        React.createElement("button", {
          type: "button",
          onClick: save,
          disabled: busy,
          style: {
            padding: "3px 12px",
            borderRadius: "6px",
            border: "1px solid var(--border-color, rgba(128,128,128,.35))",
            background: "transparent",
            color: "inherit",
            cursor: busy ? "wait" : "pointer",
            fontSize: "13px",
          },
        }, busy ? "保存中…" : "保存"),
        message && React.createElement("span", {
          style: {
            fontSize: "12px",
            color: message.tone === "error" ? "#e5484d" : "#46a758",
          },
        }, message.text)
      );
    }

    function apply(ctx) {
      ctx.slots.inject("conversation.input.left", () => ctx.slots.register({
        name: "conversation.input.left",
        id: "agent-hub-workspace-file-upload",
        order: 35,
        label: "文件上传",
      }, UploadButton));
      ctx.slots.inject("settings.general.item", () => ctx.slots.register({
        name: "settings.general.item",
        id: "agent-hub-workspace-file-upload-limit",
        order: 30,
        label: "文件上传大小上限",
      }, UploadLimitRow));
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});
