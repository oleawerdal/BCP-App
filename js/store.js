/* Datalag for BCP-appen. Lagrer alt i localStorage og eksponerer et enkelt API
   via det globale objektet BCP. Ingen byggesteg eller server kreves. */
const BCP = (function () {
  "use strict";

  const LS_KEY = "bcp-iso-5.30-v1";

  const CRITICALITY = ["Kritisk", "Høy", "Middels", "Lav"];
  const SYSTEM_TYPES = [
    "Applikasjon",
    "Database",
    "Infrastruktur",
    "Nettverk",
    "Skytjeneste",
    "Endepunkt",
    "Annet",
  ];
  const HOSTING = ["On-premise", "Skytjeneste", "Hybrid", "Leverandørdrift"];
  const TIME_UNITS = ["minutter", "timer", "dager"];
  const IMPACT_AREAS = ["Økonomi", "Omdømme", "Juridisk/etterlevelse", "Drift/HMS"];
  const IMPACT_LEVELS = ["Ingen", "Lav", "Middels", "Høy", "Kritisk"];
  const TEST_TYPES = [
    "Skrivebordsøvelse",
    "Failover-test",
    "Backup-gjenoppretting",
    "Full øvelse",
    "Komponenttest",
  ];
  const TEST_RESULTS = ["Bestått", "Delvis bestått", "Ikke bestått", "Planlagt"];
  const PLAN_STATUS = ["Utkast", "Aktiv", "Under revisjon"];
  const RECOVERY_STRATEGIES = [
    "Failover til reserveløsning",
    "Gjenoppretting fra backup",
    "Manuell nødprosedyre",
    "Leverandøravtale/SLA",
    "Reetablering på alternativ lokasjon",
    "Annet",
  ];

  function emptyState() {
    return {
      meta: { orgName: "", updatedAt: null },
      processes: [],
      systems: [],
      bia: [],
      tests: [],
      plans: [],
    };
  }

  let state = emptyState();

  function uid() {
    return "id-" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
  }

  function touch() {
    state.meta.updatedAt = new Date().toISOString();
  }

  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        state = Object.assign(emptyState(), parsed);
        state.meta = Object.assign({ orgName: "", updatedAt: null }, parsed.meta || {});
      }
    } catch (e) {
      console.error("Kunne ikke lese lagrede data:", e);
    }
    return state;
  }

  function save() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("Kunne ikke lagre data:", e);
    }
  }

  /* ---- Generisk CRUD ---- */

  function upsert(collection, item) {
    if (item.id) {
      const i = state[collection].findIndex((x) => x.id === item.id);
      if (i >= 0) {
        state[collection][i] = Object.assign({}, state[collection][i], item);
      } else {
        state[collection].push(item);
      }
    } else {
      item.id = uid();
      state[collection].push(item);
    }
    touch();
    save();
    return item;
  }

  function remove(collection, id) {
    state[collection] = state[collection].filter((x) => x.id !== id);
    cleanupRefs(collection, id);
    touch();
    save();
  }

  function cleanupRefs(collection, id) {
    if (collection === "systems") {
      state.processes.forEach((p) => {
        p.systemIds = (p.systemIds || []).filter((sid) => sid !== id);
      });
      state.tests.forEach((t) => {
        t.systemIds = (t.systemIds || []).filter((sid) => sid !== id);
      });
      state.plans.forEach((pl) => {
        pl.systemIds = (pl.systemIds || []).filter((sid) => sid !== id);
      });
    }
    if (collection === "processes") {
      state.bia = state.bia.filter((b) => b.processId !== id);
      state.tests.forEach((t) => {
        t.processIds = (t.processIds || []).filter((pid) => pid !== id);
      });
      state.plans.forEach((pl) => {
        pl.processIds = (pl.processIds || []).filter((pid) => pid !== id);
      });
    }
  }

  function getById(collection, id) {
    return state[collection].find((x) => x.id === id) || null;
  }

  /* ---- BIA-hjelpere (1:1 med prosess) ---- */

  function biaForProcess(processId) {
    return state.bia.find((b) => b.processId === processId) || null;
  }

  /* ---- Tidshåndtering ---- */

  function toMinutes(value, unit) {
    const v = Number(value);
    if (!isFinite(v) || v < 0) return null;
    if (unit === "minutter") return v;
    if (unit === "timer") return v * 60;
    if (unit === "dager") return v * 60 * 24;
    return null;
  }

  function formatDuration(value, unit) {
    if (value === "" || value === null || value === undefined) return "–";
    return value + " " + (unit || "");
  }

  /* Strengeste (minste) RTO blant prosessene et system støtter, i minutter. */
  function minRtoMinutesForSystem(systemId) {
    let best = null;
    state.processes.forEach((p) => {
      if ((p.systemIds || []).includes(systemId)) {
        const b = biaForProcess(p.id);
        if (b && b.rtoValue !== "" && b.rtoValue != null) {
          const m = toMinutes(b.rtoValue, b.rtoUnit);
          if (m != null && (best === null || m < best.minutes)) {
            best = { minutes: m, value: b.rtoValue, unit: b.rtoUnit, process: p.name };
          }
        }
      }
    });
    return best;
  }

  function criticalityRank(level) {
    const i = CRITICALITY.indexOf(level);
    return i < 0 ? 99 : i; // 0 = Kritisk (høyest)
  }

  function lastTestForSystem(systemId) {
    const relevant = state.tests
      .filter((t) => (t.systemIds || []).includes(systemId) && t.result !== "Planlagt" && t.date)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    return relevant[0] || null;
  }

  /* ---- Eksport / import ---- */

  function exportJSON() {
    return JSON.stringify(state, null, 2);
  }

  function importJSON(obj) {
    if (!obj || typeof obj !== "object") throw new Error("Ugyldig fil");
    state = Object.assign(emptyState(), obj);
    state.meta = Object.assign({ orgName: "", updatedAt: null }, obj.meta || {});
    ["processes", "systems", "bia", "tests", "plans"].forEach((c) => {
      if (!Array.isArray(state[c])) state[c] = [];
    });
    touch();
    save();
  }

  function setOrgName(name) {
    state.meta.orgName = name;
    save();
  }

  function clearAll() {
    state = emptyState();
    save();
  }

  function loadExampleData() {
    state = emptyState();
    state.meta.orgName = "Eksempel AS";

    const sErp = upsert("systems", {
      name: "ERP (økonomi/ordre)",
      type: "Applikasjon",
      hosting: "Skytjeneste",
      owner: "Økonomisjef",
      vendor: "Visma",
      description: "Sentralt system for ordre, faktura og regnskap.",
    });
    const sDb = upsert("systems", {
      name: "Kundedatabase",
      type: "Database",
      hosting: "On-premise",
      owner: "IT-drift",
      vendor: "Microsoft SQL",
      description: "Lagrer kunde- og kontraktsdata.",
    });
    const sNet = upsert("systems", {
      name: "Internett/WAN",
      type: "Nettverk",
      hosting: "Leverandørdrift",
      owner: "IT-drift",
      vendor: "Telenor",
      description: "Tilgang til skytjenester og kontorlokasjoner.",
    });

    const pOrder = upsert("processes", {
      name: "Ordrebehandling",
      owner: "Salgsleder",
      criticality: "Kritisk",
      description: "Mottak og behandling av kundeordrer.",
      systemIds: [sErp.id, sDb.id, sNet.id],
    });
    const pPay = upsert("processes", {
      name: "Lønnskjøring",
      owner: "HR/Lønn",
      criticality: "Høy",
      description: "Månedlig utbetaling av lønn.",
      systemIds: [sErp.id],
    });

    upsert("bia", {
      processId: pOrder.id,
      mtpdValue: 8,
      mtpdUnit: "timer",
      rtoValue: 4,
      rtoUnit: "timer",
      rpoValue: 1,
      rpoUnit: "timer",
      impacts: {
        Økonomi: "Kritisk",
        Omdømme: "Høy",
        "Juridisk/etterlevelse": "Middels",
        "Drift/HMS": "Lav",
      },
      minResources: "ERP, kundedatabase, 2 saksbehandlere, internett.",
      notes: "Tap av ordrebehandling rammer omsetning direkte.",
    });

    upsert("tests", {
      date: "2026-03-15",
      type: "Backup-gjenoppretting",
      scope: "Gjenoppretting av kundedatabase fra nattbackup.",
      processIds: [pOrder.id],
      systemIds: [sDb.id],
      responsible: "IT-drift",
      result: "Bestått",
      findings: "Gjenoppretting tok 2t 40m – innenfor RTO.",
      nextDate: "2026-09-15",
    });

    upsert("plans", {
      name: "Gjenoppretting av kundedatabase",
      strategy: "Gjenoppretting fra backup",
      status: "Aktiv",
      systemIds: [sDb.id],
      processIds: [pOrder.id],
      owner: "IT-drift",
      activation: "Aktiveres ved datatap eller utilgjengelig database utover 1 time.",
      prerequisites: "Tilgang til backup-lagring (Azure), administratortilgang til SQL.",
      contacts: "IT-drift vakttelefon 99 00 00 00, leverandør Microsoft support.",
      lastReviewed: "2026-04-01",
      steps: [
        { desc: "Bekreft omfang og varsle beredskapsledelsen.", role: "IT-leder", time: "15 min" },
        { desc: "Isoler berørt system og stopp skrivetrafikk.", role: "IT-drift", time: "15 min" },
        { desc: "Hent siste verifiserte backup fra lagring.", role: "IT-drift", time: "30 min" },
        { desc: "Gjenopprett database og verifiser integritet.", role: "IT-drift", time: "90 min" },
        { desc: "Gjenåpne for produksjon og bekreft med fagansvarlig.", role: "Salgsleder", time: "30 min" },
      ],
    });

    touch();
    save();
  }

  return {
    constants: {
      CRITICALITY,
      SYSTEM_TYPES,
      HOSTING,
      TIME_UNITS,
      IMPACT_AREAS,
      IMPACT_LEVELS,
      TEST_TYPES,
      TEST_RESULTS,
      PLAN_STATUS,
      RECOVERY_STRATEGIES,
    },
    get state() {
      return state;
    },
    load,
    save,
    upsert,
    remove,
    getById,
    biaForProcess,
    toMinutes,
    formatDuration,
    minRtoMinutesForSystem,
    criticalityRank,
    lastTestForSystem,
    exportJSON,
    importJSON,
    setOrgName,
    clearAll,
    loadExampleData,
  };
})();
