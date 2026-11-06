(() => {
  const script = document.currentScript;
  if (!script || document.querySelector("[data-aide-root]")) return;
  const base = new URL(script.src).origin;
  const root = document.createElement("div");
  root.dataset.aideRoot = "";
  const shadow = root.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent =
    ":host{all:initial}button{position:fixed;bottom:24px;right:24px;z-index:2147483646;border:1px solid #ffffff33;border-radius:50%;width:56px;height:56px;background:#285c49;color:white;box-shadow:0 3px 15px #0002;cursor:pointer;font:24px system-ui}button:focus-visible{outline:3px solid #94b29d;outline-offset:4px}iframe{position:fixed;right:24px;bottom:92px;width:390px;height:min(650px,calc(100dvh - 120px));border:1px solid #dce3d3;border-radius:12px;box-shadow:0 10px 50px #0002;z-index:2147483645;background:white}iframe[hidden]{display:none}@media(max-width:480px){iframe{left:12px;right:12px;width:calc(100vw - 24px);bottom:88px;height:calc(100dvh - 110px)}button{right:16px;bottom:16px}}";
  const launcher = document.createElement("button");
  launcher.type = "button";
  launcher.textContent = "↗";
  launcher.setAttribute("aria-label", "Open business assistant");
  launcher.setAttribute("aria-expanded", "false");
  const frame = document.createElement("iframe");
  frame.src = `${base}/widget`;
  frame.title = "Business AI assistant";
  frame.hidden = true;
  frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms");
  function close() {
    frame.hidden = true;
    launcher.setAttribute("aria-expanded", "false");
    launcher.setAttribute("aria-label", "Open business assistant");
    launcher.textContent = "↗";
    launcher.focus();
  }
  launcher.onclick = () => {
    if (!frame.hidden) {
      close();
      return;
    }
    frame.hidden = false;
    launcher.setAttribute("aria-expanded", "true");
    launcher.setAttribute("aria-label", "Close business assistant");
    launcher.textContent = "×";
    frame.focus();
  };
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !frame.hidden) close();
  });
  window.addEventListener("message", (e) => {
    if (e.origin !== base || e.source !== frame.contentWindow) return;
    if (e.data?.type === "aide:close") close();
    if (e.data?.type === "aide:config") {
      if (/^#[0-9a-fA-F]{6}$/.test(e.data.color))
        launcher.style.background = e.data.color;
      if (e.data.position === "left") {
        launcher.style.left = "24px";
        launcher.style.right = "auto";
        frame.style.left = "12px";
        frame.style.right = "auto";
      }
    }
  });
  shadow.append(style, frame, launcher);
  document.body.append(root);
})();
