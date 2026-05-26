/* Visninger, skjemaer og navigasjon. Bruker BCP (datalag) og UI (hjelpere). */
(function () {
  "use strict";

  const C = BCP.constants;
  const content = document.getElementById("content");
  let currentView = "oversikt";

  /* ---------- Hjelpere ---------- */

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function readForm(form) {
    const data = {};
    form.querySelectorAll("input, select, textarea").forEach((el) => {
      if (!el.name || el.type === "checkbox") return;
      data[el.name] = el.value.trim ? el.value.trim() : el.value;
    });
    return data;
  }

  function readChecked(form, name) {
    return Array.from(form.querySelectorAll('input[name="' + name + '"]:checked')).map(
      (el) => el.value
    );
  }

  function formShell(innerHtml, submitLabel) {
    const form = document.createElement("form");
    form.className = "form";
    form.innerHTML =
      innerHtml +
      '<div class="modal-footer">' +
      '<button type="button" class="btn btn-ghost" data-act="cancel">Avbryt</button>' +
      '<button type="submit" class="btn btn-primary">' +
      UI.esc(submitLabel || "Lagre") +
      "</button></div>";
    form.querySelector('[data-act="cancel"]').addEventListener("click", UI.closeModal);
    return form;
  }

  function timeFields(prefix, label, obj, hint) {
    const v = obj ? obj[prefix + "Value"] : "";
    const u = obj ? obj[prefix + "Unit"] : "timer";
    return UI.field(
      label,
      '<div class="time-field">' +
        UI.input(prefix + "Value", v, { type: "number", min: "0", step: "0.5", placeholder: "f.eks. 4" }) +
        UI.select(prefix + "Unit", C.TIME_UNITS, u || "timer") +
        "</div>",
      hint
    );
  }

  function emptyHint(text) {
    return '<div class="empty">' + UI.esc(text) + "</div>";
  }

  function processName(id) {
    const p = BCP.getById("processes", id);
    return p ? p.name : "(slettet prosess)";
  }

  function systemName(id) {
    const s = BCP.getById("systems", id);
    return s ? s.name : "(slettet system)";
  }

  /* ---------- Visning: Oversikt / Dashboard ---------- */

  function viewOversikt() {
    const s = BCP.state;
    const totalP = s.processes.length;
    const withBia = s.processes.filter((p) => BCP.biaForProcess(p.id)).length;
    const critProcs = s.processes.filter(
      (p) => p.criticality === "Kritisk" || p.criticality === "Høy"
    );
    const critGaps = critProcs.filter((p) => !BCP.biaForProcess(p.id));
    const unmapped = s.processes.filter((p) => !(p.systemIds || []).length);

    // Kritiske systemer = systemer som støtter en kritisk/høy prosess
    const critSystemIds = new Set();
    critProcs.forEach((p) => (p.systemIds || []).forEach((id) => critSystemIds.add(id)));
    const critSystems = s.systems.filter((sys) => critSystemIds.has(sys.id));
    const testedCrit = critSystems.filter((sys) => {
      const t = BCP.lastTestForSystem(sys.id);
      return t && t.result === "Bestått";
    });

    // Tester forfalt / kommende
    const today = todayISO();
    const overdue = s.tests.filter((t) => t.nextDate && t.nextDate < today);
    const upcoming = s.tests
      .filter((t) => t.nextDate && t.nextDate >= today)
      .sort((a, b) => (a.nextDate < b.nextDate ? -1 : 1))
      .slice(0, 5);

    // Beredskapsscore – snitt av definerte komponenter
    const comps = [];
    if (totalP) comps.push(withBia / totalP);
    if (totalP) comps.push((totalP - unmapped.length) / totalP);
    if (critSystems.length) comps.push(testedCrit.length / critSystems.length);
    const score = comps.length
      ? Math.round((comps.reduce((a, b) => a + b, 0) / comps.length) * 100)
      : 0;

    let html = '<div class="view-head"><h1>Oversikt</h1>';
    if (s.meta.updatedAt) {
      html +=
        '<span class="muted">Sist endret ' +
        UI.esc(new Date(s.meta.updatedAt).toLocaleString("no-NO")) +
        "</span>";
    }
    html += "</div>";

    if (totalP === 0 && s.systems.length === 0) {
      html +=
        '<div class="panel intro">' +
        "<h2>Velkommen</h2>" +
        "<p>Denne appen hjelper dere å dokumentere IKT-beredskap i tråd med " +
        "<strong>ISO/IEC 27001 Annex A 5.30 – IKT-beredskap for forretningskontinuitet</strong>. " +
        "Den utfyller beredskapsplanen ved å koble forretningsprosesser til IKT-systemer, " +
        "fastsette gjenopprettingsmål (RTO/RPO/MTPD) gjennom en BIA, og dokumentere tester.</p>" +
        '<p>Kom i gang ved å registrere prosesser og systemer – eller last inn eksempeldata.</p>' +
        '<button class="btn btn-primary" id="btnExample">Last inn eksempeldata</button>' +
        "</div>";
      content.innerHTML = html;
      const be = document.getElementById("btnExample");
      if (be)
        be.addEventListener("click", () => {
          BCP.loadExampleData();
          syncOrgName();
          render("oversikt");
          UI.toast("Eksempeldata lastet inn", "ok");
        });
      return;
    }

    // Nøkkeltall
    html += '<div class="cards">';
    html += scoreCard(score);
    html += statCard("Prosesser", totalP, withBia + " med BIA");
    html += statCard("Systemer", s.systems.length, critSystems.length + " kritiske");
    html += statCard(
      "Tester gjennomført",
      s.tests.filter((t) => t.result !== "Planlagt").length,
      overdue.length ? overdue.length + " forfalt" : "ingen forfalt"
    );
    html += "</div>";

    // Avvik / mangler
    html += '<div class="grid-2">';

    html += '<div class="panel"><h2>Mangler i BIA</h2>';
    if (critGaps.length) {
      html +=
        '<p class="muted">Kritiske/høye prosesser uten Business Impact Analysis:</p><ul class="gaplist">';
      html += critGaps
        .map(
          (p) =>
            "<li>" +
            UI.badge(p.criticality, UI.criticalityVariant(p.criticality)) +
            " " +
            UI.esc(p.name) +
            ' <button class="link" data-bia="' +
            p.id +
            '">Lag BIA →</button></li>'
        )
        .join("");
      html += "</ul>";
    } else {
      html += '<p class="ok-text">Alle kritiske og høye prosesser har en BIA. ✓</p>';
    }
    if (unmapped.length) {
      html +=
        '<p class="muted" style="margin-top:14px">Prosesser uten koblede systemer: ' +
        unmapped.map((p) => UI.esc(p.name)).join(", ") +
        "</p>";
    }
    html += "</div>";

    html += '<div class="panel"><h2>Testdekning – kritiske systemer</h2>';
    if (critSystems.length) {
      html += '<table class="table"><thead><tr><th>System</th><th>Avledet RTO</th><th>Siste test</th></tr></thead><tbody>';
      html += critSystems
        .map((sys) => {
          const rto = BCP.minRtoMinutesForSystem(sys.id);
          const t = BCP.lastTestForSystem(sys.id);
          const rtoTxt = rto ? rto.value + " " + rto.unit : '<span class="muted">ikke satt</span>';
          let testTxt;
          if (!t) testTxt = '<span class="badge badge-crit">Aldri testet</span>';
          else
            testTxt =
              UI.badge(t.result, UI.resultVariant(t.result)) +
              ' <span class="muted">' +
              UI.esc(t.date) +
              "</span>";
          return (
            "<tr><td>" + UI.esc(sys.name) + "</td><td>" + rtoTxt + "</td><td>" + testTxt + "</td></tr>"
          );
        })
        .join("");
      html += "</tbody></table>";
    } else {
      html += emptyHint("Ingen systemer er koblet til kritiske/høye prosesser enda.");
    }
    html += "</div>";

    html += "</div>"; // grid-2

    // Tester
    html += '<div class="panel"><h2>Kommende og forfalte tester</h2>';
    if (overdue.length) {
      html +=
        '<p class="crit-text">' +
        overdue.length +
        " test(er) er forfalt: " +
        overdue
          .map((t) => UI.esc(t.type + " (" + t.nextDate + ")"))
          .join(", ") +
        "</p>";
    }
    if (upcoming.length) {
      html += '<table class="table"><thead><tr><th>Neste dato</th><th>Type</th><th>Omfang</th></tr></thead><tbody>';
      html += upcoming
        .map(
          (t) =>
            "<tr><td>" +
            UI.esc(t.nextDate) +
            "</td><td>" +
            UI.esc(t.type) +
            "</td><td>" +
            UI.esc(t.scope || "") +
            "</td></tr>"
        )
        .join("");
      html += "</tbody></table>";
    } else if (!overdue.length) {
      html += emptyHint("Ingen planlagte tester. Legg inn neste testdato under Tester & øvelser.");
    }
    html += "</div>";

    content.innerHTML = html;

    content.querySelectorAll("[data-bia]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const p = BCP.getById("processes", btn.getAttribute("data-bia"));
        if (p) openBiaForm(p);
      });
    });
  }

  function scoreCard(score) {
    const variant = score >= 75 ? "ok" : score >= 40 ? "warn" : "crit";
    return (
      '<div class="card card-score card-' +
      variant +
      '"><div class="card-label">Beredskapsscore</div>' +
      '<div class="card-value">' +
      score +
      "%</div>" +
      '<div class="card-sub">BIA-dekning · systemkobling · testing</div></div>'
    );
  }

  function statCard(label, value, sub) {
    return (
      '<div class="card"><div class="card-label">' +
      UI.esc(label) +
      '</div><div class="card-value">' +
      UI.esc(value) +
      '</div><div class="card-sub">' +
      UI.esc(sub || "") +
      "</div></div>"
    );
  }

  /* ---------- Visning: Prosesser ---------- */

  function viewProsesser() {
    const s = BCP.state;
    let html =
      '<div class="view-head"><h1>Forretningsprosesser</h1>' +
      '<button class="btn btn-primary" id="btnNew">+ Ny prosess</button></div>' +
      '<p class="muted">Registrer prosessene virksomheten er avhengig av, og koble dem til IKT-systemene som støtter dem.</p>';

    if (!s.processes.length) {
      html += emptyHint("Ingen prosesser registrert enda.");
    } else {
      html +=
        '<table class="table"><thead><tr><th>Prosess</th><th>Eier</th><th>Kritikalitet</th>' +
        "<th>Systemer</th><th>BIA</th><th></th></tr></thead><tbody>";
      html += s.processes
        .slice()
        .sort((a, b) => BCP.criticalityRank(a.criticality) - BCP.criticalityRank(b.criticality))
        .map((p) => {
          const sysTxt = (p.systemIds || []).length
            ? p.systemIds.map((id) => UI.esc(systemName(id))).join(", ")
            : '<span class="muted">ingen</span>';
          const bia = BCP.biaForProcess(p.id);
          const biaTxt = bia
            ? UI.badge("Fullført", "ok")
            : UI.badge("Mangler", "crit");
          return (
            "<tr><td><strong>" +
            UI.esc(p.name) +
            "</strong>" +
            (p.description ? '<div class="cell-sub">' + UI.esc(p.description) + "</div>" : "") +
            "</td><td>" +
            UI.esc(p.owner || "–") +
            "</td><td>" +
            UI.badge(p.criticality, UI.criticalityVariant(p.criticality)) +
            "</td><td>" +
            sysTxt +
            "</td><td>" +
            biaTxt +
            '</td><td class="row-actions">' +
            '<button class="link" data-edit="' + p.id + '">Rediger</button>' +
            '<button class="link link-danger" data-del="' + p.id + '">Slett</button>' +
            "</td></tr>"
          );
        })
        .join("");
      html += "</tbody></table>";
    }
    content.innerHTML = html;

    document.getElementById("btnNew").addEventListener("click", () => openProcessForm(null));
    content.querySelectorAll("[data-edit]").forEach((b) =>
      b.addEventListener("click", () => openProcessForm(BCP.getById("processes", b.dataset.edit)))
    );
    content.querySelectorAll("[data-del]").forEach((b) =>
      b.addEventListener("click", () => {
        const p = BCP.getById("processes", b.dataset.del);
        UI.confirmDialog('Slette prosessen "' + p.name + '"? Tilhørende BIA slettes også.', () => {
          BCP.remove("processes", p.id);
          render("prosesser");
          UI.toast("Prosess slettet", "ok");
        });
      })
    );
  }

  function openProcessForm(proc) {
    const sysChecks = BCP.state.systems.length
      ? BCP.state.systems
          .map(
            (sys) =>
              '<label class="check"><input type="checkbox" name="systemIds" value="' +
              sys.id +
              '"' +
              (proc && (proc.systemIds || []).includes(sys.id) ? " checked" : "") +
              "> " +
              UI.esc(sys.name) +
              "</label>"
          )
          .join("")
      : '<p class="muted">Ingen systemer registrert enda. Legg til systemer først for å koble dem.</p>';

    const inner =
      UI.field("Navn på prosess", UI.input("name", proc && proc.name, { required: "required", placeholder: "f.eks. Ordrebehandling" })) +
      UI.field("Prosesseier", UI.input("owner", proc && proc.owner, { placeholder: "rolle eller person" })) +
      UI.field("Kritikalitet", UI.select("criticality", C.CRITICALITY, proc ? proc.criticality : "Middels")) +
      UI.field("Beskrivelse", UI.textarea("description", proc && proc.description)) +
      UI.field("Støttende systemer", '<div class="check-group">' + sysChecks + "</div>");

    const form = formShell(inner);
    const body = UI.openModal(proc ? "Rediger prosess" : "Ny prosess", form);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = readForm(form);
      if (!data.name) return UI.toast("Navn er påkrevd", "warn");
      data.systemIds = readChecked(form, "systemIds");
      if (proc) data.id = proc.id;
      BCP.upsert("processes", data);
      UI.closeModal();
      render(currentView);
      UI.toast("Prosess lagret", "ok");
    });
    body.querySelector('input[name="name"]').focus();
  }

  /* ---------- Visning: Systemer ---------- */

  function viewSystemer() {
    const s = BCP.state;
    let html =
      '<div class="view-head"><h1>IKT-systemer</h1>' +
      '<button class="btn btn-primary" id="btnNew">+ Nytt system</button></div>' +
      '<p class="muted">Registrer applikasjoner, infrastruktur og tjenester som understøtter prosessene.</p>';

    if (!s.systems.length) {
      html += emptyHint("Ingen systemer registrert enda.");
    } else {
      html +=
        '<table class="table"><thead><tr><th>System</th><th>Type</th><th>Drift</th>' +
        "<th>Eier</th><th>Leverandør</th><th>Avledet RTO</th><th></th></tr></thead><tbody>";
      html += s.systems
        .map((sys) => {
          const rto = BCP.minRtoMinutesForSystem(sys.id);
          const rtoTxt = rto
            ? rto.value + " " + rto.unit + ' <span class="muted">(' + UI.esc(rto.process) + ")</span>"
            : '<span class="muted">–</span>';
          return (
            "<tr><td><strong>" +
            UI.esc(sys.name) +
            "</strong>" +
            (sys.description ? '<div class="cell-sub">' + UI.esc(sys.description) + "</div>" : "") +
            "</td><td>" +
            UI.esc(sys.type || "–") +
            "</td><td>" +
            UI.esc(sys.hosting || "–") +
            "</td><td>" +
            UI.esc(sys.owner || "–") +
            "</td><td>" +
            UI.esc(sys.vendor || "–") +
            "</td><td>" +
            rtoTxt +
            '</td><td class="row-actions">' +
            '<button class="link" data-edit="' + sys.id + '">Rediger</button>' +
            '<button class="link link-danger" data-del="' + sys.id + '">Slett</button>' +
            "</td></tr>"
          );
        })
        .join("");
      html += "</tbody></table>";
    }
    content.innerHTML = html;

    document.getElementById("btnNew").addEventListener("click", () => openSystemForm(null));
    content.querySelectorAll("[data-edit]").forEach((b) =>
      b.addEventListener("click", () => openSystemForm(BCP.getById("systems", b.dataset.edit)))
    );
    content.querySelectorAll("[data-del]").forEach((b) =>
      b.addEventListener("click", () => {
        const sys = BCP.getById("systems", b.dataset.del);
        UI.confirmDialog('Slette systemet "' + sys.name + '"? Koblinger fjernes fra prosesser og tester.', () => {
          BCP.remove("systems", sys.id);
          render("systemer");
          UI.toast("System slettet", "ok");
        });
      })
    );
  }

  function openSystemForm(sys) {
    const inner =
      UI.field("Navn på system", UI.input("name", sys && sys.name, { required: "required", placeholder: "f.eks. ERP" })) +
      UI.field("Type", UI.select("type", C.SYSTEM_TYPES, sys ? sys.type : "Applikasjon")) +
      UI.field("Drift/plassering", UI.select("hosting", C.HOSTING, sys ? sys.hosting : "Skytjeneste")) +
      UI.field("Systemeier", UI.input("owner", sys && sys.owner, { placeholder: "rolle eller person" })) +
      UI.field("Leverandør", UI.input("vendor", sys && sys.vendor)) +
      UI.field("Beskrivelse", UI.textarea("description", sys && sys.description));

    const form = formShell(inner);
    const body = UI.openModal(sys ? "Rediger system" : "Nytt system", form);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = readForm(form);
      if (!data.name) return UI.toast("Navn er påkrevd", "warn");
      if (sys) data.id = sys.id;
      BCP.upsert("systems", data);
      UI.closeModal();
      render(currentView);
      UI.toast("System lagret", "ok");
    });
    body.querySelector('input[name="name"]').focus();
  }

  /* ---------- Visning: BIA ---------- */

  function viewBia() {
    const s = BCP.state;
    let html =
      '<div class="view-head"><h1>Business Impact Analysis</h1></div>' +
      '<p class="muted">For hver prosess fastsettes maksimal tolerabel nedetid (MTPD) og gjenopprettingsmål ' +
      "(RTO/RPO). Dette gir grunnlaget for IKT-beredskapen etter A.5.30.</p>";

    if (!s.processes.length) {
      html += emptyHint("Registrer prosesser først – BIA gjøres per prosess.");
      content.innerHTML = html;
      return;
    }

    html +=
      '<table class="table"><thead><tr><th>Prosess</th><th>Kritikalitet</th><th>MTPD</th>' +
      "<th>RTO</th><th>RPO</th><th>Største konsekvens</th><th></th></tr></thead><tbody>";
    html += s.processes
      .slice()
      .sort((a, b) => BCP.criticalityRank(a.criticality) - BCP.criticalityRank(b.criticality))
      .map((p) => {
        const b = BCP.biaForProcess(p.id);
        let worst = "–";
        if (b && b.impacts) {
          let rank = -1;
          Object.keys(b.impacts).forEach((k) => {
            const idx = C.IMPACT_LEVELS.indexOf(b.impacts[k]);
            if (idx > rank) {
              rank = idx;
              worst = b.impacts[k];
            }
          });
        }
        return (
          "<tr><td><strong>" +
          UI.esc(p.name) +
          "</strong></td><td>" +
          UI.badge(p.criticality, UI.criticalityVariant(p.criticality)) +
          "</td><td>" +
          (b ? UI.esc(BCP.formatDuration(b.mtpdValue, b.mtpdUnit)) : '<span class="muted">–</span>') +
          "</td><td>" +
          (b ? UI.esc(BCP.formatDuration(b.rtoValue, b.rtoUnit)) : '<span class="muted">–</span>') +
          "</td><td>" +
          (b ? UI.esc(BCP.formatDuration(b.rpoValue, b.rpoUnit)) : '<span class="muted">–</span>') +
          "</td><td>" +
          (b && worst !== "–" ? UI.badge(worst, UI.impactVariant(worst)) : '<span class="muted">–</span>') +
          '</td><td class="row-actions">' +
          '<button class="link" data-bia="' + p.id + '">' + (b ? "Rediger" : "Lag BIA") + "</button>" +
          (b ? '<button class="link link-danger" data-delbia="' + p.id + '">Slett</button>' : "") +
          "</td></tr>"
        );
      })
      .join("");
    html += "</tbody></table>";
    content.innerHTML = html;

    content.querySelectorAll("[data-bia]").forEach((btn) =>
      btn.addEventListener("click", () => openBiaForm(BCP.getById("processes", btn.dataset.bia)))
    );
    content.querySelectorAll("[data-delbia]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const p = BCP.getById("processes", btn.dataset.delbia);
        UI.confirmDialog('Slette BIA for "' + p.name + '"?', () => {
          const b = BCP.biaForProcess(p.id);
          if (b) BCP.remove("bia", b.id);
          render("bia");
          UI.toast("BIA slettet", "ok");
        });
      })
    );
  }

  function openBiaForm(proc) {
    if (!proc) return;
    const b = BCP.biaForProcess(proc.id);
    const impacts = (b && b.impacts) || {};

    const impactRows = C.IMPACT_AREAS.map(
      (area) =>
        '<div class="impact-row"><span>' +
        UI.esc(area) +
        "</span>" +
        UI.select("impact__" + area, C.IMPACT_LEVELS, impacts[area] || "Ingen") +
        "</div>"
    ).join("");

    const inner =
      '<div class="form-note">Prosess: <strong>' +
      UI.esc(proc.name) +
      "</strong> " +
      UI.badge(proc.criticality, UI.criticalityVariant(proc.criticality)) +
      "</div>" +
      timeFields("mtpd", "MTPD – maks tolerabel nedetid", b, "Hvor lenge kan prosessen være nede før uakseptabel skade oppstår?") +
      '<div class="grid-2-tight">' +
      timeFields("rto", "RTO – gjenopprettingstid", b, "Mål for hvor raskt prosessen skal være oppe igjen.") +
      timeFields("rpo", "RPO – maks datatap", b, "Hvor mye data (i tid) kan gå tapt?") +
      "</div>" +
      UI.field("Konsekvensvurdering", '<div class="impact-grid">' + impactRows + "</div>") +
      UI.field("Minimumsressurser ved gjenoppretting", UI.textarea("minResources", b && b.minResources, 2)) +
      UI.field("Notater", UI.textarea("notes", b && b.notes, 2));

    const form = formShell(inner);
    const body = UI.openModal("BIA – " + proc.name, form, { wide: true });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = readForm(form);
      const out = {
        processId: proc.id,
        mtpdValue: data.mtpdValue,
        mtpdUnit: data.mtpdUnit,
        rtoValue: data.rtoValue,
        rtoUnit: data.rtoUnit,
        rpoValue: data.rpoValue,
        rpoUnit: data.rpoUnit,
        minResources: data.minResources,
        notes: data.notes,
        impacts: {},
      };
      C.IMPACT_AREAS.forEach((area) => {
        out.impacts[area] = data["impact__" + area];
      });
      if (b) out.id = b.id;
      BCP.upsert("bia", out);
      UI.closeModal();
      render(currentView);
      UI.toast("BIA lagret", "ok");
    });
    void body;
  }

  /* ---------- Visning: Tester ---------- */

  function viewTester() {
    const s = BCP.state;
    let html =
      '<div class="view-head"><h1>Tester &amp; øvelser</h1>' +
      '<button class="btn btn-primary" id="btnNew">+ Ny test</button></div>' +
      '<p class="muted">Dokumenter testing og øvelser av beredskapen, slik A.5.30 krever. ' +
      "Registrer omfang, resultat, funn og neste planlagte dato.</p>";

    if (!s.tests.length) {
      html += emptyHint("Ingen tester registrert enda.");
    } else {
      html +=
        '<table class="table"><thead><tr><th>Dato</th><th>Type</th><th>Omfang</th>' +
        "<th>Resultat</th><th>Neste</th><th></th></tr></thead><tbody>";
      html += s.tests
        .slice()
        .sort((a, b) => ((a.date || "") < (b.date || "") ? 1 : -1))
        .map((t) => {
          const refs = []
            .concat((t.processIds || []).map((id) => processName(id)))
            .concat((t.systemIds || []).map((id) => systemName(id)));
          return (
            "<tr><td>" +
            UI.esc(t.date || "–") +
            "</td><td>" +
            UI.esc(t.type || "") +
            "</td><td>" +
            UI.esc(t.scope || "") +
            (refs.length ? '<div class="cell-sub">' + UI.esc(refs.join(", ")) + "</div>" : "") +
            "</td><td>" +
            UI.badge(t.result || "", UI.resultVariant(t.result)) +
            "</td><td>" +
            UI.esc(t.nextDate || "–") +
            '</td><td class="row-actions">' +
            '<button class="link" data-edit="' + t.id + '">Rediger</button>' +
            '<button class="link link-danger" data-del="' + t.id + '">Slett</button>' +
            "</td></tr>"
          );
        })
        .join("");
      html += "</tbody></table>";
    }
    content.innerHTML = html;

    document.getElementById("btnNew").addEventListener("click", () => openTestForm(null));
    content.querySelectorAll("[data-edit]").forEach((b) =>
      b.addEventListener("click", () => openTestForm(BCP.getById("tests", b.dataset.edit)))
    );
    content.querySelectorAll("[data-del]").forEach((b) =>
      b.addEventListener("click", () => {
        const t = BCP.getById("tests", b.dataset.del);
        UI.confirmDialog("Slette denne testen?", () => {
          BCP.remove("tests", t.id);
          render("tester");
          UI.toast("Test slettet", "ok");
        });
      })
    );
  }

  function openTestForm(test) {
    const s = BCP.state;
    const procChecks = s.processes.length
      ? s.processes
          .map(
            (p) =>
              '<label class="check"><input type="checkbox" name="processIds" value="' +
              p.id +
              '"' +
              (test && (test.processIds || []).includes(p.id) ? " checked" : "") +
              "> " +
              UI.esc(p.name) +
              "</label>"
          )
          .join("")
      : '<span class="muted">Ingen prosesser</span>';
    const sysChecks = s.systems.length
      ? s.systems
          .map(
            (sys) =>
              '<label class="check"><input type="checkbox" name="systemIds" value="' +
              sys.id +
              '"' +
              (test && (test.systemIds || []).includes(sys.id) ? " checked" : "") +
              "> " +
              UI.esc(sys.name) +
              "</label>"
          )
          .join("")
      : '<span class="muted">Ingen systemer</span>';

    const inner =
      '<div class="grid-2-tight">' +
      UI.field("Dato", UI.input("date", test && test.date, { type: "date" })) +
      UI.field("Type", UI.select("type", C.TEST_TYPES, test ? test.type : C.TEST_TYPES[0])) +
      "</div>" +
      UI.field("Omfang", UI.input("scope", test && test.scope, { placeholder: "Hva ble testet?" })) +
      UI.field("Omfattede prosesser", '<div class="check-group">' + procChecks + "</div>") +
      UI.field("Omfattede systemer", '<div class="check-group">' + sysChecks + "</div>") +
      '<div class="grid-2-tight">' +
      UI.field("Ansvarlig", UI.input("responsible", test && test.responsible)) +
      UI.field("Resultat", UI.select("result", C.TEST_RESULTS, test ? test.result : "Planlagt")) +
      "</div>" +
      UI.field("Funn og tiltak", UI.textarea("findings", test && test.findings, 3)) +
      UI.field("Neste planlagte test", UI.input("nextDate", test && test.nextDate, { type: "date" }));

    const form = formShell(inner);
    const body = UI.openModal(test ? "Rediger test" : "Ny test", form, { wide: true });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = readForm(form);
      data.processIds = readChecked(form, "processIds");
      data.systemIds = readChecked(form, "systemIds");
      if (test) data.id = test.id;
      BCP.upsert("tests", data);
      UI.closeModal();
      render(currentView);
      UI.toast("Test lagret", "ok");
    });
    void body;
  }

  /* ---------- Router ---------- */

  const views = {
    oversikt: viewOversikt,
    prosesser: viewProsesser,
    systemer: viewSystemer,
    bia: viewBia,
    tester: viewTester,
  };

  function render(view) {
    currentView = view;
    document.querySelectorAll(".nav-item").forEach((n) =>
      n.classList.toggle("active", n.dataset.view === view)
    );
    (views[view] || viewOversikt)();
    content.focus();
  }

  function syncOrgName() {
    document.getElementById("orgName").value = BCP.state.meta.orgName || "";
  }

  /* ---------- Init ---------- */

  function init() {
    BCP.load();
    syncOrgName();

    document.querySelectorAll(".nav-item").forEach((n) =>
      n.addEventListener("click", () => render(n.dataset.view))
    );

    document.getElementById("orgName").addEventListener("input", (e) => {
      BCP.setOrgName(e.target.value);
    });

    document.getElementById("btnExport").addEventListener("click", exportData);
    document.getElementById("btnImport").addEventListener("click", () =>
      document.getElementById("fileImport").click()
    );
    document.getElementById("fileImport").addEventListener("change", importData);

    render("oversikt");
  }

  function exportData() {
    const blob = new Blob([BCP.exportJSON()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const name = (BCP.state.meta.orgName || "bcp").replace(/[^a-z0-9æøå]+/gi, "-").toLowerCase();
    a.href = url;
    a.download = "bcp-" + name + "-" + todayISO() + ".json";
    a.click();
    URL.revokeObjectURL(url);
    UI.toast("Data eksportert", "ok");
  }

  function importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result);
        UI.confirmDialog(
          "Importere data fra fil? Dette erstatter alt som ligger lagret nå.",
          () => {
            BCP.importJSON(obj);
            syncOrgName();
            render("oversikt");
            UI.toast("Data importert", "ok");
          }
        );
      } catch (err) {
        UI.toast("Kunne ikke lese filen – ugyldig JSON", "crit");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  document.addEventListener("DOMContentLoaded", init);
})();
