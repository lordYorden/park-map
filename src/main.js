import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.offline";
import "../css/styles.css";
import {
  TILE_URL_TEMPLATE,
  ATTR,
  TILE_OPTS,
  INITIAL_VIEW,
  MAX_BOUNDS,
} from "./config";
import { openDB } from "idb";

function substituteVersion(url, version) {
  if (!url) return url;
  return url.replace("{version}", version || "");
}

function showMessage(msg, timeout = 3000) {
  const el = document.getElementById("message");
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("hidden");
  if (timeout) setTimeout(() => el.classList.add("hidden"), timeout);
}

function formatLatLng(latlng) {
  const { lat, lng } = latlng;
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

document.addEventListener("DOMContentLoaded", async () => {
  // Init map
  const map = L.map("map", {
    minZoom: TILE_OPTS.minZoom,
    maxZoom: TILE_OPTS.maxZoom,
  }).setView(INITIAL_VIEW.center, INITIAL_VIEW.zoom);

  if (MAX_BOUNDS) {
    const sw = MAX_BOUNDS.southWest;
    const ne = MAX_BOUNDS.northEast;
    map.setMaxBounds([
      [sw.lat, sw.lng],
      [ne.lat, ne.lng],
    ]);
  }

  const tileUrl = substituteVersion(TILE_URL_TEMPLATE, TILE_OPTS.version);
  // Use offline-enabled tile layer
  const offlineLayer = L.tileLayer.offline(tileUrl, {
    attribution: ATTR,
    minZoom: TILE_OPTS.minZoom,
    maxZoom: TILE_OPTS.maxZoom,
    crossOrigin: "anonymous", // required for caching tiles from remote servers
  });
  offlineLayer.addTo(map);

  // Add a simple save/remove tiles control
  const allZooms = [];
  for (let z = TILE_OPTS.minZoom ?? 0; z <= (TILE_OPTS.maxZoom ?? 19); z++)
    allZooms.push(z);
  const saveControl = L.control.savetiles(offlineLayer, {
    position: "topleft",
    zoomlevels: allZooms, // which zoom levels to cache
    confirm: (layer, ok) => {
      const count =
        layer && layer._tilesforSave ? layer._tilesforSave.length : "selected";
      if (confirm(`Save ${count} tile(s) for offline use?`)) ok();
    },
    confirmRemoval: (layer, ok) => {
      const count =
        layer && layer._tilesforSave ? layer._tilesforSave.length : "selected";
      if (confirm(`Remove ${count} cached tile(s)?`)) ok();
    },
    saveText: "⬇",
    rmText: "✕",
  });
  saveControl.addTo(map);

  // Progress and status messages
  offlineLayer.on("savestart", () => showMessage("Caching tiles…"));
  offlineLayer.on("saveend", (ev) => {
    const n = (ev && ev._tilesforSave && ev._tilesforSave.length) || "";
    showMessage(`Caching complete ${n ? `(${n} tiles)` : ""}`);
  });
  offlineLayer.on("loadend", () => {
    // Fired when a tile load completes (from network or cache)
  });
  offlineLayer.on("tilecachehit", (e) => {
    console.debug("[offline] cache hit", e && e.url);
  });
  offlineLayer.on("tilecachemiss", (e) => {
    console.debug("[offline] cache miss", e && e.url);
  });
  offlineLayer.on("tilesremoved", (ev) => {
    const n = (ev && ev._tilesforSave && ev._tilesforSave.length) || "";
    showMessage(`Removed cached tiles ${n ? `(${n})` : ""}`);
  });

  // Draggable markers layer
  const markersLayer = L.layerGroup().addTo(map);
  // Internal store for markers
  const markersState = new Map(); // id -> { id, marker, label, type }
  let idCounter = 1;

  const TYPES = [
    "food",
    "ride",
    "show",
    "shop",
    "restroom",
    "service",
    "photo",
    "misc",
  ];

  // Helper to detect mobile viewport; used to disable dragging on small screens
  function isMobileViewport() {
    return window.matchMedia && window.matchMedia("(max-width: 768px)").matches;
  }

  // Icons by type
  const DefaultIcon = new L.Icon.Default();
  const FoodIcon = L.divIcon({
    className: "marker marker-food",
    html: '<div class="pin">🍔</div>',
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -24],
  });
  const RideIcon = L.divIcon({
    className: "marker marker-ride",
    html: '<div class="pin">\ud83c\udfa2</div>',
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -24],
  });

  function getIconForType(type) {
    if (type === "food") return FoodIcon;
    if (type === "ride") return RideIcon;
    return DefaultIcon;
  }

  // DOM elements for panel
  const listEl = document.getElementById("markerList");
  const panelEl = document.getElementById("markerPanel");
  const panelToggle = document.getElementById("panelToggle");
  const typeFilterEl = document.getElementById("typeFilter");
  let activeTypeFilter = "all";

  // Plan tab elements
  const tabMarkers = document.getElementById("tabMarkers");
  const tabPlan = document.getElementById("tabPlan");
  const markersView = document.getElementById("markersView");
  const planView = document.getElementById("planView");
  const planListEl = document.getElementById("planList");
  const exportPlanBtn = document.getElementById("exportPlanBtn");
  const importPlanBtn = document.getElementById("importPlanBtn");
  const importPlanFile = document.getElementById("importPlanFile");
  const clearPlanBtn = document.getElementById("clearPlanBtn");
  const savePlanChanges = document.getElementById("savePlanChanges");

  // Plan state: array of marker ids in order
  const planOrder = [];
  // Track active tab to decide which icon mode to use
  let activeTab = "markers";

  function setActiveTab(which) {
    const isPlan = which === "plan";
    activeTab = isPlan ? "plan" : "markers";
    tabMarkers && tabMarkers.classList.toggle("active", !isPlan);
    tabPlan && tabPlan.classList.toggle("active", isPlan);
    markersView && markersView.classList.toggle("hidden", isPlan);
    planView && planView.classList.toggle("hidden", !isPlan);
    // Show/hide filter only on Markers tab
    typeFilterEl && typeFilterEl.classList.toggle("hidden", isPlan);
    // Swap marker icons depending on active tab
    updateIconsForActiveTab();
  }

  tabMarkers &&
    tabMarkers.addEventListener("click", () => setActiveTab("markers"));
  tabPlan && tabPlan.addEventListener("click", () => setActiveTab("plan"));

  function buildTypeFilterOptions() {
    if (!typeFilterEl) return;
    const opts = ["all", ...TYPES];
    typeFilterEl.innerHTML = opts
      .map((t) => `<option value="${t}">${t}</option>`)
      .join("");
    typeFilterEl.value = activeTypeFilter;
    typeFilterEl.addEventListener("change", () => {
      activeTypeFilter = typeFilterEl.value || "all";
      applyFilter();
      renderList();
      showMessage(
        activeTypeFilter === "all"
          ? "Showing all markers"
          : `Filter: ${activeTypeFilter}`
      );
    });
  }

  function applyFilter() {
    const wantsAll = activeTypeFilter === "all";
    markersState.forEach((s) => {
      const visible = wantsAll || s.type === activeTypeFilter;
      if (visible) {
        if (!markersLayer.hasLayer(s.marker)) s.marker.addTo(markersLayer);
        s.marker.getElement() && (s.marker.getElement().style.display = "");
      } else {
        // More efficient than removing from layer: hide DOM element
        s.marker.getElement() && (s.marker.getElement().style.display = "none");
      }
    });
  }
  function renderList() {
    if (!listEl) return;
    const wantsAll = activeTypeFilter === "all";
    const items = Array.from(markersState.values()).filter(
      (s) => wantsAll || s.type === activeTypeFilter
    );
    if (!items.length) {
      listEl.innerHTML =
        '<li class="marker-item" style="opacity:.7">No markers</li>';
      return;
    }
    listEl.innerHTML = items
      .map((s) => {
        const { lat, lng } = s.marker.getLatLng();
        const coords = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        const label = s.label || s.id;
        const type = s.type || "misc";
        return `
        <li class="marker-item" data-id="${s.id}">
          <span class="badge badge-${type}">${type}</span>
          <span>${label}</span>
          <span class="meta">${coords}</span>
          <button class="add-to-plan" title="Add to plan">＋</button>
        </li>`;
      })
      .join("");

    // Attach click handlers
    listEl.querySelectorAll(".marker-item").forEach((li) => {
      li.addEventListener("click", () => {
        const id = li.getAttribute("data-id");
        const s = id && markersState.get(id);
        if (!s) return;
        const latlng = s.marker.getLatLng();
        map.flyTo(latlng, Math.max(map.getZoom(), 19), { duration: 0.7 });
        s.marker.openPopup();
      });
      const addBtn = li.querySelector("button.add-to-plan");
      if (addBtn) {
        addBtn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          const id = li.getAttribute("data-id");
          if (!id) return;
          addToPlan(id);
        });
      }
    });
  }

  function addToPlan(id) {
    if (!markersState.has(id)) return;
    if (!planOrder.includes(id)) {
      planOrder.push(id);
      updateIconsForActiveTab();
      renderPlan();
      showMessage("Added to plan");
    } else {
      showMessage("Already in plan");
    }
  }

  function removeFromPlan(id) {
    const idx = planOrder.indexOf(id);
    if (idx !== -1) {
      planOrder.splice(idx, 1);
      updateIconsForActiveTab();
      renderPlan();
      showMessage("Removed from plan");
    }
  }

  function renderPlan() {
    if (!planListEl) return;
    if (!planOrder.length) {
      planListEl.innerHTML =
        '<li class="plan-empty">No items in your plan. Add from the Markers tab.</li>';
      return;
    }
    planListEl.innerHTML = planOrder
      .map((id, i) => {
        const s = markersState.get(id);
        if (!s) return "";
        const label = s.label || id;
        const type = s.type || "misc";
        return `
        <li class="plan-item" data-id="${id}" draggable="true">
          <span class="order">${i + 1}</span>
          <span class="badge badge-${type}">${type}</span>
          <span class="label">${label}</span>
          <div class="plan-actions-inline">
            <button class="plan-up" title="Move up">↑</button>
            <button class="plan-down" title="Move down">↓</button>
            <button class="plan-remove" title="Remove">✕</button>
          </div>
        </li>`;
      })
      .join("");

    // wire move/remove
    planListEl.querySelectorAll(".plan-item").forEach((li) => {
      const id = li.getAttribute("data-id");
      const up = li.querySelector(".plan-up");
      const down = li.querySelector(".plan-down");
      const rem = li.querySelector(".plan-remove");
      // clicking the row should move to the marker; prevent action buttons from triggering it
      li.addEventListener("click", () => {
        const s = markersState.get(id);
        if (!s) return;
        const latlng = s.marker.getLatLng();
        map.flyTo(latlng, Math.max(map.getZoom(), 19), { duration: 0.7 });
        //s.marker.openPopup();
      });
      up &&
        up.addEventListener("click", (ev) => {
          ev.stopPropagation();
          moveInPlan(id, -1);
        });
      down &&
        down.addEventListener("click", (ev) => {
          ev.stopPropagation();
          moveInPlan(id, +1);
        });
      rem &&
        rem.addEventListener("click", (ev) => {
          ev.stopPropagation();
          removeFromPlan(id);
        });
    });

    // drag & drop
    enableDragAndDrop();
  }

  function moveInPlan(id, delta) {
    const i = planOrder.indexOf(id);
    if (i === -1) return;
    const j = i + delta;
    if (j < 0 || j >= planOrder.length) return;
    const tmp = planOrder[i];
    planOrder[i] = planOrder[j];
    planOrder[j] = tmp;
    updateIconsForActiveTab();
    renderPlan();
  }

  function enableDragAndDrop() {
    if (!planListEl) return;
    let draggedId = null;
    planListEl.querySelectorAll(".plan-item").forEach((item) => {
      item.addEventListener("dragstart", () => {
        draggedId = item.getAttribute("data-id");
        item.classList.add("dragging");
      });
      item.addEventListener("dragend", () => {
        draggedId = null;
        item.classList.remove("dragging");
      });
      item.addEventListener("dragover", (ev) => {
        ev.preventDefault();
        const overId = item.getAttribute("data-id");
        if (!draggedId || draggedId === overId) return;
        const from = planOrder.indexOf(draggedId);
        const to = planOrder.indexOf(overId);
        if (from === -1 || to === -1) return;
        planOrder.splice(to, 0, planOrder.splice(from, 1)[0]);
        renderPlan();
        updateIconsForActiveTab();
      });
    });
  }

  function exportPlan() {
    const items = planOrder
      .map((id, idx) => {
        const s = markersState.get(id);
        if (!s) return null;
        const { lat, lng } = s.marker.getLatLng();
        return {
          order: idx + 1,
          id,
          label: s.label || "",
          type: s.type || "misc",
          lat,
          lng,
        };
      })
      .filter(Boolean);
    const payload = {
      createdAt: new Date().toISOString(),
      count: items.length,
      plan: items,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "trip-plan.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showMessage(`Exported ${items.length} item(s)`);
  }

  async function saveCurrentPlan() {
    // get current plan items
    const items = planOrder
      .map((id, idx) => {
        const s = markersState.get(id);
        if (!s) return null;
        const { lat, lng } = s.marker.getLatLng();
        return {
          order: idx + 1,
          id,
          label: s.label || "",
          type: s.type || "misc",
          lat,
          lng,
        };
      })
      .filter(Boolean);

    const payload = {
      createdAt: new Date().toISOString(),
      count: items.length,
      plan: items,
    };

    try {
      const db = await openDB("park-map", 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains("plans"))
            db.createObjectStore("plans");
        },
      });
      await db.put("plans", payload, "current-plan");
      alert("Plan saved successfully");
    } catch (e) {
      console.warn("Could not write plan to IndexedDB", e);
    }
  }

  exportPlanBtn && exportPlanBtn.addEventListener("click", exportPlan);
  clearPlanBtn &&
    clearPlanBtn.addEventListener("click", () => {
      planOrder.splice(0, planOrder.length);
      updateIconsForActiveTab();
      renderPlan();
    });
  savePlanChanges && savePlanChanges.addEventListener("click", saveCurrentPlan);

  function validateImportedPlan(data) {
    if (!data || typeof data !== "object") return "Invalid JSON";
    if (!Array.isArray(data.plan)) return "Missing plan array";
    for (const p of data.plan) {
      if (typeof p !== "object") return "Invalid plan item";
      if (typeof p.order !== "number") return "Plan item missing order";
      if (typeof p.lat !== "number" || typeof p.lng !== "number")
        return "Plan item missing numeric lat/lng";
    }
    return null;
  }

  async function importPlanFromObject(data) {
    const err = validateImportedPlan(data);
    if (err) {
      showMessage(`Import failed: ${err}`);
      return;
    }
    // Sort by order just in case
    const items = [...data.plan].sort((a, b) => a.order - b.order);
    // Ensure markers exist (match by id when possible, otherwise create)
    for (const item of items) {
      let id = item.id || null;
      let state = id ? markersState.get(id) : null;
      if (!state) {
        // Try to find an existing marker at near-same coords
        const existing = Array.from(markersState.values()).find((s) => {
          const ll = s.marker.getLatLng();
          return (
            Math.abs(ll.lat - item.lat) < 1e-6 &&
            Math.abs(ll.lng - item.lng) < 1e-6
          );
        });
        state =
          existing ||
          addDraggableMarker(
            { lat: item.lat, lng: item.lng },
            item.label || undefined,
            item.type || "misc",
            { openPopup: false }
          );
        id = state.id;
      }
    }
    // Build planOrder from items in order
    planOrder.splice(
      0,
      planOrder.length,
      ...items
        .map((it) => {
          // prefer input id if present and exists; else match by coords
          if (it.id && markersState.has(it.id)) return it.id;
          const match = Array.from(markersState.values()).find((s) => {
            const ll = s.marker.getLatLng();
            return (
              Math.abs(ll.lat - it.lat) < 1e-6 &&
              Math.abs(ll.lng - it.lng) < 1e-6
            );
          });
          return match ? match.id : null;
        })
        .filter(Boolean)
    );

    updateIconsForActiveTab();
    renderPlan();
    showMessage(`Imported plan with ${planOrder.length} item(s)`);
  }

  if (importPlanBtn && importPlanFile) {
    importPlanBtn.addEventListener("click", () => importPlanFile.click());
    importPlanFile.addEventListener("change", async () => {
      const file = importPlanFile.files && importPlanFile.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const json = JSON.parse(text);
        await importPlanFromObject(json);
      } catch (e) {
        console.error(e);
        showMessage("Import failed: invalid JSON");
      } finally {
        importPlanFile.value = "";
      }
    });
  }

  // Numbered icons for items in the plan
  function makeNumberedIcon(n, baseType) {
    const color =
      baseType === "food"
        ? "var(--food)"
        : baseType === "ride"
        ? "var(--ride)"
        : "var(--misc)";
    return L.divIcon({
      className: "marker marker-numbered",
      html: `<div class="pin" style="background:${color};border-color:${color}"><span class="num">${n}</span></div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 28],
      popupAnchor: [0, -24],
    });
  }

  function updateNumberedIcons() {
    // For markers in plan, assign a number; others keep type icon
    const idToIndex = new Map();
    planOrder.forEach((id, i) => idToIndex.set(id, i + 1));
    markersState.forEach((s, id) => {
      const n = idToIndex.get(id);
      if (n) {
        s.marker.setIcon(makeNumberedIcon(n, s.type));
      } else {
        s.marker.setIcon(getIconForType(s.type));
      }
    });
  }

  // Update all marker icons to reflect current tab: type icons on Markers tab, numbers on Plan tab
  function updateIconsForActiveTab() {
    if (activeTab === "plan") {
      updateNumberedIcons();
    } else {
      markersState.forEach((s) => s.marker.setIcon(getIconForType(s.type)));
    }
  }

  function setMarkerPopup(m, state) {
    const { lat, lng } = m.getLatLng();
    const coords = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    const safeLabel = String((state && state.label) || "Marker");
    const type = (state && state.type) || "misc";

    const options = TYPES.map(
      (t) =>
        `<option value="${t}" ${t === type ? "selected" : ""}>${t}</option>`
    ).join("");

    const html = `
      <div class="popup-card">
        <div class="popup-header">
          <strong class="popup-title">${safeLabel}</strong>
          <span class="badge badge-${type}">${type}</span>
          <button class="btn btn-primary" data-action="rename" title="Rename marker">Rename</button>
        </div>
        <div class="popup-row">
          <label class="popup-label">Type</label>
          <select name="marker-type" class="popup-select">
            ${options}
          </select>
        </div>
        <div class="popup-row">
          <label class="popup-label">Lat,Lng</label>
          <code class="popup-code">${coords}</code>
        </div>
        <div class="popup-actions">
          <button class="btn btn-primary popup-add-to-plan" title="Add to plan">Add to plan</button>
        </div>
        <div class="popup-tip">Tip: drag to move, right-click to remove</div>
      </div>`;
    m.bindPopup(html, { closeButton: true, className: "modern-popup" });
  }

  function addDraggableMarker(latlng, label, type, { openPopup = true } = {}) {
    const id = `m${idCounter++}`;
    const t = type || "misc";
    const marker = L.marker(latlng, {
      draggable: !isMobileViewport(),
      autoPan: true,
      icon: getIconForType(t),
    }).addTo(markersLayer);
    const state = {
      id,
      marker,
      label: label || `Marker ${idCounter - 1}`,
      type: t,
    };
    markersState.set(id, state);
    setMarkerPopup(marker, state);

    // Wire rename before opening so it works for the first open
    marker.on("popupopen", (e) => {
      // wire rename button in the popup
      const popupEl = e.popup.getElement();
      if (!popupEl) return;
      const btn = popupEl.querySelector('button[data-action="rename"]');
      if (btn) {
        btn.addEventListener("click", () => {
          const newLabel = prompt("Marker label:", state.label || "");
          if (newLabel !== null) {
            state.label = newLabel.trim() || state.label;
            setMarkerPopup(marker, state);
            marker.openPopup();
            showMessage(`Renamed to "${state.label}"`);
            renderList();
          }
        });
      }

      const sel = popupEl.querySelector('select[name="marker-type"]');
      if (sel) {
        sel.addEventListener("change", () => {
          state.type = sel.value || "misc";
          // update icon based on type
          marker.setIcon(getIconForType(state.type));
          setMarkerPopup(marker, state);
          marker.openPopup();
          showMessage(`Type set to ${state.type}`);
          updateIconsForActiveTab();
          renderList();
        });
      }

      const addBtn = popupEl.querySelector(".popup-add-to-plan");
      if (addBtn) {
        addBtn.addEventListener("click", () => {
          addToPlan(state.id);
        });
      }
    });

    if (openPopup) marker.openPopup();
    showMessage(
      `Added ${state.label} (${state.type}) at ${formatLatLng(
        marker.getLatLng()
      )}`
    );
    applyFilter();
    renderList();

    marker.on("dragend", () => {
      setMarkerPopup(marker, state);
      marker.openPopup();
      showMessage(
        `${state.label} (${state.type}) moved to ${formatLatLng(
          marker.getLatLng()
        )}`
      );
      applyFilter();
      renderList();
    });

    marker.on("contextmenu", () => {
      markersLayer.removeLayer(marker);
      // delete from state
      markersState.delete(id);
      showMessage(`${state.label} removed`);
      applyFilter();
      renderList();
    });

    return state;
  }

  // Click to place markers
  map.on("click", (e) => {
    addDraggableMarker(e.latlng);
  });

  // Panel toggle (especially for mobile bottom sheet)
  if (panelToggle && panelEl) {
    // Simplified toggle logic with debug logs
    const setExpanded = (expanded) => {
      const isMobile =
        window.matchMedia && window.matchMedia("(max-width: 768px)").matches;
      if (isMobile) {
        panelEl.classList.toggle("collapsed", !expanded);
        panelEl.classList.remove("collapsed-desktop");
      } else {
        panelEl.classList.toggle("collapsed-desktop", !expanded);
        panelEl.classList.remove("collapsed");
      }
      panelToggle.setAttribute("aria-expanded", String(expanded));
      panelToggle.textContent = expanded ? "▾" : "▴";
      console.debug(
        "[panelToggle] isMobile=%s expanded=%s classes=%o",
        isMobile,
        expanded,
        panelEl.className
      );
    };

    // default expanded on desktop, collapsed on mobile
    const initialExpanded = !(
      window.matchMedia && window.matchMedia("(max-width: 768px)").matches
    );
    setExpanded(initialExpanded);

    panelToggle.addEventListener("click", () => {
      // read current from attribute (truthy if 'true')
      const current = panelToggle.getAttribute("aria-expanded") === "true";
      setExpanded(!current);
    });
  }

  // Controls wiring (existing buttons in header)
  const locateBtn = document.getElementById("locateBtn");
  const resetBtn = document.getElementById("resetBtn");
  const saveBtn = document.getElementById("saveBtn");
  const importBtn = document.getElementById("importBtn");
  const importFile = document.getElementById("importFile");

  if (locateBtn) {
    locateBtn.addEventListener("click", () => {
      map.locate({
        setView: true,
        maxZoom: Math.min(16, TILE_OPTS.maxZoom || 16),
      });
    });
  }
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      map.setView(INITIAL_VIEW.center, INITIAL_VIEW.zoom);
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      // Build JSON array of markers
      const items = [];
      markersState.forEach((s) => {
        const { lat, lng } = s.marker.getLatLng();
        items.push({
          id: s.id,
          label: s.label || "",
          type: s.type || "misc",
          lat,
          lng,
        });
      });
      const payload = {
        createdAt: new Date().toISOString(),
        count: items.length,
        markers: items,
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "markers.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showMessage(`Saved ${items.length} marker(s) to markers.json`);
    });
  }

  function clearAllMarkers() {
    markersLayer.clearLayers();
    markersState.clear();
  }

  function validateImported(data) {
    if (!data || typeof data !== "object") return "Invalid JSON";
    if (!Array.isArray(data.markers)) return "Missing markers array";
    for (const m of data.markers) {
      if (typeof m !== "object") return "Invalid marker item";
      if (typeof m.lat !== "number" || typeof m.lng !== "number")
        return "Marker missing numeric lat/lng";
      if (m.label != null && typeof m.label !== "string")
        return "Marker label must be a string";
      if (m.type != null && typeof m.type !== "string")
        return "Marker type must be a string";
    }
    return null;
  }

  function importMarkersFromObject(data, { clear = true } = {}) {
    const err = validateImported(data);
    if (err) {
      showMessage(`Import failed: ${err}`);
      return;
    }
    if (clear) clearAllMarkers();
    let added = 0;
    // reset plan when importing fresh markers
    planOrder.splice(0, planOrder.length);
    for (const m of data.markers) {
      try {
        const type =
          m.type && TYPES.includes(m.type) ? m.type : m.type || "misc";
        // don't open popups when bulk importing
        addDraggableMarker(
          { lat: m.lat, lng: m.lng },
          m.label || undefined,
          type,
          { openPopup: false }
        );
        added++;
      } catch (_) {
        // skip invalid
      }
    }
    showMessage(`Imported ${added} marker(s)`);
    updateIconsForActiveTab();
    renderList();
  }

  if (importBtn && importFile) {
    importBtn.addEventListener("click", () => importFile.click());
    importFile.addEventListener("change", async () => {
      const file = importFile.files && importFile.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const json = JSON.parse(text);
        importMarkersFromObject(json, { clear: true });
      } catch (e) {
        console.error(e);
        showMessage("Import failed: invalid JSON");
      } finally {
        importFile.value = "";
      }
    });
  }

  map.on("locationfound", (e) => {
    const radius = e.accuracy || 50;
    L.circle(e.latlng, { radius }).addTo(map);
    showMessage(`Location found (±${Math.round(radius)}m)`);
  });

  map.on("locationerror", () => showMessage("Could not get location"));

  showMessage(
    "Tip: Click anywhere to add a draggable marker. Right-click a marker to remove."
  );

  // Load default markers from markers_new.json on startup (fallback to markers.json)
  async function loadDefaultMarkers() {
    try {
      const resp = await fetch("./markers_new.json", { cache: "no-store" });
      if (!resp.ok) throw new Error("markers_new.json not found");
      const json = await resp.json();
      importMarkersFromObject(json, { clear: true });
      const count = Array.isArray(json.markers)
        ? json.markers.length
        : "unknown";
      showMessage(`Loaded ${count} marker(s) from markers_new.json`);
      return;
    } catch (e) {
      console.warn("markers_new.json not loaded:", e);
    }

    // fallback to markers.json if present
    try {
      const resp2 = await fetch("./markers.json", { cache: "no-store" });
      if (!resp2.ok) throw new Error("markers.json not found");
      const json2 = await resp2.json();
      importMarkersFromObject(json2, { clear: true });
      const count2 = Array.isArray(json2.markers)
        ? json2.markers.length
        : "unknown";
      showMessage(`Loaded ${count2} marker(s) from markers.json`);
      return;
    } catch (e) {
      console.warn("markers.json not loaded:", e);
    }

    showMessage("No default marker file (markers_new.json) found.");
  }

  await loadDefaultMarkers();

  // Render list initially so the placeholder is visible
  buildTypeFilterOptions();
  applyFilter();
  renderList();
  renderPlan();

  // Try to load a default trip plan from /trip-plan.json
  async function loadDefaultPlan() {
    // First try loading a locally saved plan from IndexedDB (static-only option)
    try {
      const db = await openDB("park-map", 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains("plans"))
            db.createObjectStore("plans");
        },
      });
      const local = await db.get("plans", "current-plan");
      if (
        local &&
        typeof local === "object" &&
        Array.isArray(local.plan) &&
        local.plan.length
      ) {
        await importPlanFromObject(local);
        showMessage(`Loaded trip plan (local) (${local.plan.length} item(s))`);
        return;
      }
    } catch (e) {
      console.warn("Could not read local plan from IndexedDB", e);
    }
    try {
      const resp = await fetch("./trip-plan.json", { cache: "no-store" });
      if (!resp.ok) throw new Error("trip-plan.json not found");
      const json = await resp.json();
      await importPlanFromObject(json);
      const count = Array.isArray(json.plan) ? json.plan.length : "unknown";
      showMessage(`Loaded trip plan (${count} item(s))`);
    } catch (e) {
      // optional; silently ignore if not present
      console.warn("trip-plan.json not loaded:", e);
    }
  }

  await loadDefaultPlan();

  // end DOMContentLoaded
});
