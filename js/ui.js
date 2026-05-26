/* Delte UI-hjelpere: escaping, modal, toast og skjemafelt-byggere. */
const UI = (function () {
  "use strict";

  function esc(value) {
    if (value === null || value === undefined) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function toast(message, type) {
    const root = document.getElementById("toastRoot");
    const el = document.createElement("div");
    el.className = "toast toast-" + (type || "info");
    el.textContent = message;
    root.appendChild(el);
    setTimeout(() => el.classList.add("show"), 10);
    setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => el.remove(), 300);
    }, 3200);
  }

  /* Åpner en modal. content kan være en HTML-streng eller et DOM-element.
     Returnerer modalens body-element slik at kallende kode kan koble på lyttere. */
  function openModal(title, content, options) {
    options = options || {};
    closeModal();
    const root = document.getElementById("modalRoot");

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";

    const modal = document.createElement("div");
    modal.className = "modal";
    if (options.wide) modal.classList.add("modal-wide");

    const header = document.createElement("div");
    header.className = "modal-header";
    const h = document.createElement("h2");
    h.textContent = title;
    const close = document.createElement("button");
    close.className = "modal-close";
    close.setAttribute("aria-label", "Lukk");
    close.innerHTML = "&times;";
    close.addEventListener("click", closeModal);
    header.appendChild(h);
    header.appendChild(close);

    const body = document.createElement("div");
    body.className = "modal-body";
    if (typeof content === "string") body.innerHTML = content;
    else if (content) body.appendChild(content);

    modal.appendChild(header);
    modal.appendChild(body);
    overlay.appendChild(modal);
    root.appendChild(overlay);

    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) closeModal();
    });
    document.addEventListener("keydown", escHandler);

    return body;
  }

  function escHandler(e) {
    if (e.key === "Escape") closeModal();
  }

  function closeModal() {
    const root = document.getElementById("modalRoot");
    root.innerHTML = "";
    document.removeEventListener("keydown", escHandler);
  }

  function confirmDialog(message, onConfirm) {
    const wrap = document.createElement("div");
    wrap.innerHTML =
      '<p class="confirm-text">' +
      esc(message) +
      '</p><div class="modal-footer">' +
      '<button class="btn btn-ghost" data-act="cancel">Avbryt</button>' +
      '<button class="btn btn-danger" data-act="ok">Slett</button></div>';
    const body = openModal("Bekreft", wrap);
    body.querySelector('[data-act="cancel"]').addEventListener("click", closeModal);
    body.querySelector('[data-act="ok"]').addEventListener("click", () => {
      closeModal();
      onConfirm();
    });
  }

  /* ---- Skjemafelt-byggere (returnerer HTML-strenger) ---- */

  function field(label, inner, hint) {
    return (
      '<label class="field"><span class="field-label">' +
      esc(label) +
      "</span>" +
      inner +
      (hint ? '<span class="field-hint">' + esc(hint) + "</span>" : "") +
      "</label>"
    );
  }

  function input(name, value, attrs) {
    attrs = attrs || {};
    const a = Object.keys(attrs)
      .map((k) => k + '="' + esc(attrs[k]) + '"')
      .join(" ");
    return (
      '<input name="' + esc(name) + '" value="' + esc(value == null ? "" : value) + '" ' + a + " />"
    );
  }

  function textarea(name, value, rows) {
    return (
      '<textarea name="' +
      esc(name) +
      '" rows="' +
      (rows || 3) +
      '">' +
      esc(value == null ? "" : value) +
      "</textarea>"
    );
  }

  function select(name, options, value) {
    const opts = options
      .map(
        (o) =>
          '<option value="' +
          esc(o) +
          '"' +
          (String(o) === String(value) ? " selected" : "") +
          ">" +
          esc(o) +
          "</option>"
      )
      .join("");
    return '<select name="' + esc(name) + '">' + opts + "</select>";
  }

  function badge(text, variant) {
    return '<span class="badge badge-' + (variant || "default") + '">' + esc(text) + "</span>";
  }

  function criticalityVariant(level) {
    return (
      {
        Kritisk: "crit",
        Høy: "high",
        Middels: "med",
        Lav: "low",
      }[level] || "default"
    );
  }

  function resultVariant(result) {
    return (
      {
        Bestått: "ok",
        "Delvis bestått": "warn",
        "Ikke bestått": "crit",
        Planlagt: "info",
      }[result] || "default"
    );
  }

  function planStatusVariant(status) {
    return (
      {
        Aktiv: "ok",
        "Under revisjon": "warn",
        Utkast: "info",
      }[status] || "default"
    );
  }

  function impactVariant(level) {
    return (
      {
        Kritisk: "crit",
        Høy: "high",
        Middels: "med",
        Lav: "low",
        Ingen: "default",
      }[level] || "default"
    );
  }

  return {
    esc,
    toast,
    openModal,
    closeModal,
    confirmDialog,
    field,
    input,
    textarea,
    select,
    badge,
    criticalityVariant,
    resultVariant,
    planStatusVariant,
    impactVariant,
  };
})();
