// ============================================
// party-sidebar.js (v1.2.0 - interactive layout)
// ============================================

Hooks.once("init", function () {
  game.settings.register("party-sidebar", "portraitSize", {
    name: "Portrait Size",
    hint: "Size of party portraits (75–200)",
    scope: "client",
    config: true,
    type: Number,
    default: 100,
    range: { min: 75, max: 200, step: 1 },
    onChange: value => PartySidebar.applyPortraitSize(value)
  });

  game.settings.register("party-sidebar", "offsetY", {
    name: "Vertical Offset",
    scope: "client",
    config: true,
    type: Number,
    default: 200,
    onChange: () => PartySidebar.applyLayout()
  });

  game.settings.register("party-sidebar", "layout", {
    name: "Sidebar Layout",
    hint: "Stored per client. Can also be changed with the on-screen controls.",
    scope: "client",
    config: false,
    type: Object,
    default: { orientation: "vertical", docked: true, locked: true, x: null, y: null }
  });
});

Hooks.on("ready", () => PartySidebar.init());
Hooks.on("updateActor", () => PartySidebar.requestRender());
Hooks.on("updateToken", (_token, changes) => {
  const relevantKeys = ["movementAction", "actorId", "actorLink", "name", "texture.src"];
  if (relevantKeys.some(key => Object.prototype.hasOwnProperty.call(changes, key))) {
    PartySidebar.requestRender();
  }
});
Hooks.on("createActiveEffect", () => PartySidebar.requestRender());
Hooks.on("updateActiveEffect", () => PartySidebar.requestRender());
Hooks.on("deleteActiveEffect", () => PartySidebar.requestRender());
Hooks.on("updateCombat", () => PartySidebar.requestRender());
Hooks.on("updateWorldTime", () => PartySidebar.requestRender());
Hooks.on("canvasReady", () => PartySidebar.requestRender());
Hooks.on("updateScene", () => PartySidebar.requestRender());
Hooks.on("collapseSidebar", () => PartySidebar.requestRender());
Hooks.on("renderSidebar", () => PartySidebar.requestRender());

class PartySidebar {
  static init() {
    this._isHovered = false;
    this._dragging = false;
    this._resizeObserver = null;
    this._savedLayout = this.getLayout();
    this.observe();
    this.render();
  }

  static getLayout() {
    const raw = game.settings.get("party-sidebar", "layout") || {};
    return {
      orientation: raw.orientation === "horizontal" ? "horizontal" : "vertical",
      docked: raw.docked !== false,
      locked: raw.locked !== false,
      x: Number.isFinite(raw.x) ? raw.x : null,
      y: Number.isFinite(raw.y) ? raw.y : null
    };
  }

  static saveLayout(patch = {}) {
    this._savedLayout = { ...this.getLayout(), ...patch };
    game.settings.set("party-sidebar", "layout", this._savedLayout);
    this.applyLayout();
  }

  static requestRender() {
    if (this._isHovered || this._dragging) return;
    if (this._renderTimer) clearTimeout(this._renderTimer);
    this._renderTimer = setTimeout(() => {
      this._renderTimer = null;
      if (!this._isHovered && !this._dragging) this.render();
    }, 100);
  }

  static observe() {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar || this._resizeObserver) return;
    this._resizeObserver = new ResizeObserver(() => {
      if (this.getLayout().docked) this.applyLayout();
    });
    this._resizeObserver.observe(sidebar);
  }

  static getContainer() {
    let el = document.getElementById("party-sidebar-container");
    if (!el) {
      el = document.createElement("div");
      el.id = "party-sidebar-container";
      document.body.appendChild(el);
      el.addEventListener("mouseenter", () => { this._isHovered = true; });
      el.addEventListener("mouseleave", () => {
        this._isHovered = false;
        this.requestRender();
      });
    }
    return el;
  }

  static render() {
    const container = this.getContainer();
    if (!container || (this._isHovered && container.childElementCount > 0)) return;

    const layout = this.getLayout();
    const size = Math.clamp(game.settings.get("party-sidebar", "portraitSize"), 75, 200);
    const actors = game.users.players.map(u => u.character).filter(Boolean);
    const existingPopup = container.querySelector(".party-sidebar-config-popup");

    container.innerHTML = "";
    container.classList.toggle("is-horizontal", layout.orientation === "horizontal");

    for (const actor of actors) container.appendChild(this.createPortrait(actor, size));

    this.createToolbar(container);
    if (existingPopup) container.appendChild(existingPopup);
    this.applyLayout();
  }

  static createToolbar(container) {
    const toolbar = document.createElement("div");
    toolbar.className = "party-sidebar-toolbar";
    toolbar.setAttribute("aria-label", "Party Sidebar controls");

    const layout = this.getLayout();
    const makeButton = (icon, title, click, context = null) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "party-sidebar-control";
      button.innerHTML = icon;
      button.title = title;
      button.setAttribute("aria-label", title);
      button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        click(event);
      });
      if (context) button.addEventListener("contextmenu", event => {
        event.preventDefault();
        event.stopPropagation();
        context(event);
      });
      toolbar.appendChild(button);
      return button;
    };

    const grip = makeButton('<i class="fa-solid fa-grip"></i>', "Drag sidebar", () => {});
    grip.classList.add("drag-handle");
    grip.addEventListener("pointerdown", event => this.startDrag(event, container));

    const lockButton = makeButton(
      layout.locked ? '<i class="fa-solid fa-lock"></i>' : '<i class="fa-solid fa-lock-open"></i>',
      layout.docked ? "Unlock and move sidebar" : (layout.locked ? "Unlock sidebar position" : "Lock sidebar position"),
      () => {
        const current = this.getLayout();
        if (current.docked) {
          const rect = container.getBoundingClientRect();
          this.saveLayout({ docked: false, locked: false, x: rect.left, y: rect.top });
        } else {
          this.saveLayout({ locked: !current.locked });
        }
        this.updateToolbarControls(container);
      },
      () => {
        this.saveLayout({ docked: true, locked: true, x: null, y: null });
        this.updateToolbarControls(container);
      }
    );
    lockButton.classList.add("dock-control", "lock-control");
    lockButton.classList.toggle("is-locked", layout.locked);
    lockButton.classList.toggle("is-unlocked", !layout.locked);

    const orientationButton = makeButton(
      layout.orientation === "vertical" ? '<i class="fa-solid fa-left-right"></i>' : '<i class="fa-solid fa-up-down"></i>',
      layout.orientation === "vertical" ? "Switch to horizontal layout" : "Switch to vertical layout",
      () => this.toggleOrientation(container)
    );
    orientationButton.classList.add("orientation-control");

    makeButton('<i class="fa-solid fa-sliders"></i>', "Party Sidebar configuration", () => {
      this.toggleConfigPopup(container);
    });

    container.appendChild(toolbar);
  }

  static toggleConfigPopup(container) {
    const existing = container.querySelector(".party-sidebar-config-popup");
    if (existing) {
      existing.remove();
      return;
    }

    const popup = document.createElement("div");
    popup.className = "party-sidebar-config-popup";
    popup.addEventListener("pointerdown", event => event.stopPropagation());

    const size = Math.clamp(game.settings.get("party-sidebar", "portraitSize"), 75, 200);
    const offset = Math.clamp(Number(game.settings.get("party-sidebar", "offsetY")) || 0, 0, 1000);

    const addSlider = (labelText, min, max, value, suffix, onInput) => {
      const group = document.createElement("label");
      group.className = "party-sidebar-slider";
      const header = document.createElement("span");
      const label = document.createElement("span");
      label.textContent = labelText;
      const output = document.createElement("strong");
      output.textContent = value + suffix;
      header.append(label, output);
      const input = document.createElement("input");
      input.type = "range";
      input.min = String(min);
      input.max = String(max);
      input.step = "1";
      input.value = String(value);
      input.addEventListener("input", () => {
        output.textContent = input.value + suffix;
        onInput(Number(input.value));
      });
      group.append(header, input);
      popup.appendChild(group);
    };

    addSlider("Portrait size", 75, 200, size, " px", value => {
      game.settings.set("party-sidebar", "portraitSize", value);
      this.render();
    });

    addSlider("Vertical position", 0, 1000, offset, " px", value => {
      game.settings.set("party-sidebar", "offsetY", value);
      const layout = this.getLayout();
      if (!layout.docked) {
        const y = Math.clamp(value, 0, Math.max(0, window.innerHeight - container.offsetHeight));
        this.saveLayout({ y });
      } else {
        this.applyLayout();
      }
    });

    // Position the popup against the viewport, not against the sidebar.
    // Once opened, it stays where it was opened even if the sidebar is moved.
    const anchor = container.getBoundingClientRect();
    popup.style.position = "fixed";
    popup.style.top = Math.max(8, anchor.top) + "px";
    popup.style.left = Math.max(8, anchor.right + 8) + "px";
    container.appendChild(popup);

    const popupRect = popup.getBoundingClientRect();
    let popupLeft = anchor.right + 8;
    if (popupLeft + popupRect.width > window.innerWidth - 8) {
      popupLeft = anchor.left - popupRect.width - 8;
    }
    popupLeft = Math.clamp(popupLeft, 8, Math.max(8, window.innerWidth - popupRect.width - 8));
    const popupTop = Math.clamp(anchor.top, 8, Math.max(8, window.innerHeight - popupRect.height - 8));
    popup.style.left = popupLeft + "px";
    popup.style.top = popupTop + "px";
  }

  static applyPortraitSize(value = game.settings.get("party-sidebar", "portraitSize")) {
    const size = Math.clamp(Number(value) || 100, 75, 200);
    const container = this.getContainer();
    if (!container) return;

    // Resize existing nodes instead of rebuilding the actor portraits. This
    // keeps slider input responsive and preserves the open configuration popup.
    for (const entry of container.querySelectorAll(".party-entry")) {
      entry.style.width = size + "px";
    }
    for (const portrait of container.querySelectorAll(".party-portrait")) {
      portrait.style.width = size + "px";
      portrait.style.height = size + "px";
    }
    for (const effects of container.querySelectorAll(".effects-container")) {
      effects.style.setProperty("--effect-size", Math.max(12, Math.floor(size * 0.22)) + "px");
    }
    this.applyLayout();
  }

  static updateToolbarControls(container = this.getContainer()) {
    if (!container) return;
    const layout = this.getLayout();
    const lockButton = container.querySelector(".lock-control");
    if (lockButton) {
      lockButton.innerHTML = layout.locked
        ? '<i class="fa-solid fa-lock"></i>'
        : '<i class="fa-solid fa-lock-open"></i>';
      lockButton.classList.toggle("is-locked", layout.locked);
      lockButton.classList.toggle("is-unlocked", !layout.locked);
      lockButton.title = layout.locked ? "Locked — click to unlock" : "Unlocked — click to lock";
      lockButton.setAttribute("aria-label", lockButton.title);
    }

    const orientationButton = container.querySelector(".orientation-control");
    if (orientationButton) {
      orientationButton.innerHTML = layout.orientation === "vertical"
        ? '<i class="fa-solid fa-left-right"></i>'
        : '<i class="fa-solid fa-up-down"></i>';
      orientationButton.title = layout.orientation === "vertical"
        ? "Switch to horizontal layout"
        : "Switch to vertical layout";
      orientationButton.setAttribute("aria-label", orientationButton.title);
    }

    container.classList.toggle("is-horizontal", layout.orientation === "horizontal");
    container.classList.toggle("is-free", !layout.docked);
    container.classList.toggle("is-locked", layout.locked);
  }

  static toggleOrientation(container = this.getContainer()) {
    const layout = this.getLayout();
    const orientation = layout.orientation === "vertical" ? "horizontal" : "vertical";
    this.saveLayout({ orientation });
    // Do not call render(): all existing portrait nodes remain in place.
    this.updateToolbarControls(container);
    this.applyLayout();
  }

  static moveBy(dx, dy) {
    const container = this.getContainer();
    const layout = this.getLayout();
    if (layout.docked) {
      this.saveLayout({ docked: false, locked: false });
    }
    const rect = container.getBoundingClientRect();
    this.saveLayout({ x: rect.left + dx, y: rect.top + dy });
  }

  static startDrag(event, container) {
    const layout = this.getLayout();
    if (layout.locked && !layout.docked) return;
    if (event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();

    const rect = container.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const originX = rect.left;
    const originY = rect.top;
    this._dragging = true;

    const move = moveEvent => {
      const maxX = Math.max(0, window.innerWidth - container.offsetWidth);
      const maxY = Math.max(0, window.innerHeight - container.offsetHeight);
      const x = Math.clamp(originX + moveEvent.clientX - startX, 0, maxX);
      const y = Math.clamp(originY + moveEvent.clientY - startY, 0, maxY);
      container.style.left = x + "px";
      container.style.top = y + "px";
    };

    const stop = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", stop);
      this._dragging = false;
      const current = container.getBoundingClientRect();
      this.saveLayout({ x: current.left, y: current.top, docked: false, locked: false });
    };

    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", stop, { once: true });
  }

  static applyLayout() {
    const container = this.getContainer();
    if (!container) return;

    const layout = this.getLayout();
    const sidebar = document.getElementById("sidebar");
    container.style.position = "fixed";
    container.style.right = "auto";
    container.style.bottom = "auto";

    if (layout.docked && sidebar) {
      const rect = sidebar.getBoundingClientRect();
      const width = container.offsetWidth;
      const offsetY = game.settings.get("party-sidebar", "offsetY");
      container.style.left = Math.max(0, rect.left - width - 8) + "px";
      container.style.top = Math.max(0, rect.top + offsetY) + "px";
    } else {
      const rect = container.getBoundingClientRect();
      const fallbackX = Math.max(0, window.innerWidth - rect.width - 24);
      const fallbackY = Math.max(0, game.settings.get("party-sidebar", "offsetY"));
      const x = layout.x ?? fallbackX;
      const y = layout.y ?? fallbackY;
      container.style.left = Math.clamp(x, 0, Math.max(0, window.innerWidth - container.offsetWidth)) + "px";
      container.style.top = Math.clamp(y, 0, Math.max(0, window.innerHeight - container.offsetHeight)) + "px";
    }
    container.classList.toggle("is-free", !layout.docked);
    container.classList.toggle("is-locked", layout.locked);
  }

  static createPortrait(actor, size) {
    const entry = document.createElement("div");
    entry.className = "party-entry";
    entry.style.width = size + "px";

    const name = document.createElement("div");
    name.className = "name";
    const tokenName = actor.prototypeToken?.name || actor.name;
    name.textContent = tokenName.length > 18 ? tokenName.slice(0, 17) + "…" : tokenName;

    const wrapper = document.createElement("div");
    wrapper.className = "party-portrait";
    wrapper.style.width = size + "px";
    wrapper.style.height = size + "px";

    let clickTimer = null;
    let clickCount = 0;
    wrapper.addEventListener("click", event => {
      event.stopPropagation();
      clickCount++;
      if (clickCount === 1) {
        clickTimer = setTimeout(() => {
          const token = actor.getActiveTokens()?.[0];
          if (token) {
            token.control({ releaseOthers: true });
            canvas.animatePan({ x: token.center.x, y: token.center.y, duration: 250 });
          } else if (actor.sheet) actor.sheet.render(true);
          clickCount = 0;
        }, 200);
      } else if (clickCount === 2) {
        clearTimeout(clickTimer);
        clickTimer = null;
        clickCount = 0;
        if (actor.sheet) actor.sheet.render(true);
      }
    });

    wrapper.draggable = true;
    wrapper.addEventListener("dragstart", event => {
      const json = JSON.stringify({ type: "Actor", uuid: actor.uuid });
      event.dataTransfer.setData("application/x-foundry-drag-data", json);
      event.dataTransfer.setData("text/plain", json);
      event.dataTransfer.effectAllowed = "copy";
      const dragImg = document.createElement("img");
      dragImg.src = actor.img;
      dragImg.style.cssText = `width:${size}px;height:${size}px;object-fit:cover;position:absolute;top:-1000px`;
      document.body.appendChild(dragImg);
      event.dataTransfer.setDragImage(dragImg, size / 2, size / 2);
      setTimeout(() => dragImg.remove(), 0);
    });

    const img = document.createElement("img");
    img.src = actor.img || actor.prototypeToken?.texture?.src || "icons/svg/mystery-man.svg";
    img.alt = actor.name || "Character portrait";
    img.draggable = false;
    img.addEventListener("error", () => {
      if (img.dataset.fallbackApplied === "true") return;
      img.dataset.fallbackApplied = "true";
      img.src = "icons/svg/mystery-man.svg";
    });
    wrapper.appendChild(img);

    const hpLoss = document.createElement("div");
    hpLoss.className = "hp-loss";
    const hp = actor.system?.attributes?.hp || { value: 0, max: 0 };
    const temp = hp.temp ?? 0;
    const missingPct = hp.max > 0 ? 1 - (hp.value / hp.max) : 0;
    hpLoss.style.height = (missingPct * 100) + "%";
    hpLoss.style.opacity = Math.min(0.75, missingPct * 1.2);
    wrapper.style.boxShadow = missingPct > 0.75 ? "0 0 8px rgba(255,0,0,0.8)" : "";
    wrapper.appendChild(hpLoss);

    if (temp > 0 && hp.max > 0) {
      const hpTemp = document.createElement("div");
      hpTemp.className = "hp-temp";
      hpTemp.style.height = (Math.min(1, temp / hp.max) * 100) + "%";
      wrapper.appendChild(hpTemp);
    }

    const ac = actor.system?.attributes?.ac?.value ?? "-";
    const movementData = actor.system?.attributes?.movement || {};
    const movement = movementData.speeds || movementData;
    const walk = movement.walk ?? 0;
    const token = actor.getActiveTokens()?.[0];
    let mode = token?.document?.movementAction?.toLowerCase() || "walk";
    if (mode === "jump" || mode === "teleport") mode = "walk";
    const speed = mode === "crawl" ? Math.floor(walk / 2) : (movement[mode] ?? walk);
    const iconMap = {
      walk: "icons/svg/walk.svg",
      fly: "icons/svg/wing.svg",
      swim: "icons/svg/whale.svg",
      burrow: "icons/svg/burrow.svg",
      climb: "icons/svg/ladder.svg",
      crawl: "icons/svg/leg.svg"
    };
    const speedText = `${speed}ft`;
    const iconHTML = `<span class="move-icon-wrapper"><img src="${iconMap[mode] || iconMap.walk}"></span>`;

    const overlay = document.createElement("div");
    overlay.className = "overlay";
    const hpText = temp > 0
      ? `${hp.value}<span class="temp-hp">+${temp}</span>/${hp.max}`
      : `${hp.value}/${hp.max}`;
    overlay.innerHTML = `<div>${hpText}</div><div>AC:${ac} | ${speedText} ${iconHTML}</div>`;
    wrapper.appendChild(overlay);

    const effectsContainer = document.createElement("div");
    effectsContainer.className = "effects-container";
    effectsContainer.style.setProperty("--effect-size", Math.max(12, Math.floor(size * 0.22)) + "px");
    const leftCol = document.createElement("div");
    leftCol.className = "effects-col left";
    const rightCol = document.createElement("div");
    rightCol.className = "effects-col right";

    const getRemainingSeconds = effect => {
      const duration = effect.duration;
      if (!duration) return Infinity;
      if (duration.remaining != null) return duration.remaining;
      if (duration.rounds != null) {
        if (!game.combat) return Infinity;
        return duration.rounds * (CONFIG.time.roundTime || 6);
      }
      return Infinity;
    };

    const validEffects = actor.effects
      .filter(effect => !effect.disabled && effect.isTemporary)
      .map(effect => ({ effect, remaining: getRemainingSeconds(effect) }))
      .sort((a, b) => a.remaining - b.remaining);

    const formatTime = seconds => {
      if (!isFinite(seconds)) return "";
      if (seconds >= 3600) return Math.floor(seconds / 3600) + "h";
      if (seconds >= 60) return Math.floor(seconds / 60) + "m";
      return Math.floor(seconds) + "s";
    };

    validEffects.slice(0, 6).forEach((entry, index) => {
      const effectIcon = document.createElement("div");
      effectIcon.className = "effect-icon-wrapper";
      const img = document.createElement("img");
      img.src = entry.effect.img || entry.effect.icon || entry.effect._source?.img || "icons/svg/aura.svg";
      img.alt = entry.effect.name || "Active effect";
      img.loading = "lazy";
      img.addEventListener("error", () => {
        if (img.dataset.fallbackApplied === "true") return;
        img.dataset.fallbackApplied = "true";
        img.src = "icons/svg/aura.svg";
      });
      const label = document.createElement("div");
      label.className = "effect-timer";
      label.textContent = formatTime(entry.remaining);
      if (entry.remaining <= 10) label.style.color = "#ff5252";
      effectIcon.append(img, label);
      (index < 3 ? leftCol : rightCol).appendChild(effectIcon);
    });

    if (validEffects.length > 6) {
      const more = document.createElement("div");
      more.textContent = "+" + (validEffects.length - 6);
      more.className = "effects-more";
      rightCol.appendChild(more);
    }

    effectsContainer.append(leftCol, rightCol);
    wrapper.appendChild(effectsContainer);
    entry.append(name, wrapper);
    return entry;
  }
}

window.PartySidebar = PartySidebar;
