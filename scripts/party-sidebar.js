// ============================================
// party-sidebar.js (v1.1.3 - filtered token refreshes)
// ============================================

Hooks.once("init", function () {
game.settings.register("party-sidebar", "portraitSize", {
  name: "Portrait Size",
  hint: "Size of party portraits (75–200)",
  scope: "client",
  config: true,
  type: Number,
  default: 100,

  range: {
    min: 75,
    max: 200,
    step: 1
  },

  onChange: function () { PartySidebar.render(); }
});

  game.settings.register("party-sidebar", "offsetY", {
    name: "Vertical Offset",
    scope: "client",
    config: true,
    type: Number,
    default: 200,
    onChange: function () { PartySidebar.render(); }
  });
});

Hooks.on("ready", () => {
  PartySidebar.init();
});

Hooks.on("updateActor", () => PartySidebar.requestRender());
// Token position/hover updates happen frequently while moving or selecting.
// Re-render only when a token change affects data actually displayed here.
Hooks.on("updateToken", (_token, changes) => {
  const relevantKeys = [
    "movementAction",
    "actorId",
    "actorLink",
    "name",
    "texture.src"
  ];
  if (relevantKeys.some(key => Object.prototype.hasOwnProperty.call(changes, key))) {
    PartySidebar.requestRender();
  }
});

// Selection is not displayed in the Party Sidebar, so controlToken does not
// need to trigger a DOM rebuild. This avoids a one-frame flick on selection.


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

static requestRender() {
  // Token refresh fires continuously during hover/movement. Do not rebuild the
  // sidebar on every refresh; debounce meaningful updates instead.
  if (this._isHovered) return;
  if (this._renderTimer) clearTimeout(this._renderTimer);

  this._renderTimer = setTimeout(() => {
    this._renderTimer = null;
    if (!this._isHovered) this.render();
  }, 100);
}

  static init() {
	this._isHovered = false;
    this.observe();
    this.render();
  }

  static observe() {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;

    const observer = new ResizeObserver(() => {
      PartySidebar.requestRender();
    });

    observer.observe(sidebar);
  }

  static getContainer() {
    let el = document.getElementById("party-sidebar-container");

  if (!el) {
    el = document.createElement("div");
    el.id = "party-sidebar-container";
    document.body.appendChild(el);

    // ✅ attach listeners ONLY when created
    el.addEventListener("mouseenter", () => {
      PartySidebar._isHovered = true;
    });

    el.addEventListener("mouseleave", () => {
      PartySidebar._isHovered = false;

      // optional: instant refresh after hover ends
      PartySidebar.requestRender();
    });
  }

    return el;
  }

static render() {
  const container = this.getContainer();
  if (!container) return;

  // Keep existing DOM nodes while the pointer is over the sidebar; replacing
  // them causes hover state to reset and produces visible flicker.
  if (this._isHovered && container.childElementCount > 0) return;

  container.innerHTML = "";

let size = game.settings.get("party-sidebar", "portraitSize");
size = Math.clamp(size, 75, 200);
  const offsetY = game.settings.get("party-sidebar", "offsetY");

  const actors = game.users.players
    .map(u => u.character)
    .filter(a => a);

  // 1️⃣ FIRST: build content
  for (let actor of actors) {
    container.appendChild(this.createPortrait(actor, size));
  }

  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;

  const rect = sidebar.getBoundingClientRect();
  const sidebarWidth = rect.width;

  // 2️⃣ NOW measure correctly
  //const containerWidth = container.offsetWidth;

container.style.position = "fixed";

// 🔥 ensure correct width calculation
container.style.display = "flex";
container.style.flexDirection = "column";
container.style.alignItems = "flex-end";
container.style.width = "max-content";

// clear conflicting property
container.style.right = "auto";

// NOW measurement is correct
const containerWidth = container.offsetWidth;

container.style.left = (rect.left - containerWidth - 8) + "px";
container.style.top = (rect.top + offsetY) + "px";
}

static createPortrait(actor, size) {

const container = document.createElement("div");
container.className = "party-entry";
container.style.width = size + "px"; // 🔥 THIS FIXES EVERYTHING

  // NAME BAR
  const name = document.createElement("div");
  name.className = "name";

function shortenName(str, max = 18) {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + "…";
}

const tokenName = actor.prototypeToken?.name || actor.name;
name.textContent = shortenName(tokenName);

  // PORTRAIT WRAPPER
  const wrapper = document.createElement("div");
  wrapper.className = "party-portrait";
  wrapper.style.width = size + "px";
  wrapper.style.height = size + "px";

  // CLICK
let clickTimer = null;
let clickCount = 0;

wrapper.addEventListener("click", function (e) {
  e.stopPropagation();

  clickCount++;

  if (clickCount === 1) {
    clickTimer = setTimeout(() => {
      // SINGLE CLICK
      const token = actor.getActiveTokens()?.[0];
      if (token) {
        token.control({ releaseOthers: true });
        canvas.animatePan({
          x: token.center.x,
          y: token.center.y,
          duration: 250
        });
      } else if (actor.sheet) {
        actor.sheet.render(true);
      }

      clickCount = 0;
    }, 200);
  } else if (clickCount === 2) {
    // DOUBLE CLICK
    clearTimeout(clickTimer);
    clickTimer = null;
    clickCount = 0;

    if (actor.sheet) {
      actor.sheet.render(true);
    }
  }
});

  // DRAG
  wrapper.draggable = true;

  wrapper.addEventListener("dragstart", function (event) {
    const dragData = {
      type: "Actor",
      uuid: actor.uuid
    };

    const json = JSON.stringify(dragData);

    event.dataTransfer.setData("application/x-foundry-drag-data", json);
    event.dataTransfer.setData("text/plain", json);
    event.dataTransfer.effectAllowed = "copy";

    const dragImg = document.createElement("img");
    dragImg.src = actor.img;
    dragImg.style.width = size + "px";
    dragImg.style.height = size + "px";
    dragImg.style.objectFit = "cover";
    dragImg.style.position = "absolute";
    dragImg.style.top = "-1000px";

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
  
  // HP LOSS OVERLAY
const hpLoss = document.createElement("div");
hpLoss.className = "hp-loss";

const hp = actor.system?.attributes?.hp || { value: 0, max: 0 };
const temp = hp.temp ?? 0;

let missingPct = 0;
if (hp.max > 0) {
  missingPct = 1 - (hp.value / hp.max);
}

// height = missing HP
hpLoss.style.height = (missingPct * 100) + "%";

// opacity scales with severity (subtle → strong)
hpLoss.style.opacity = Math.min(0.75, missingPct * 1.2);

if (missingPct > 0.75) {
  wrapper.style.boxShadow = "0 0 8px rgba(255,0,0,0.8)";
} else {
  // reset to default from CSS
  wrapper.style.boxShadow = "";
}

wrapper.appendChild(hpLoss);

// TEMP HP OVERLAY
if (temp > 0 && hp.max > 0) {
  const hpTemp = document.createElement("div");
  hpTemp.className = "hp-temp";

  const tempPct = Math.min(1, temp / hp.max);

  // thin bar proportional to temp HP
  hpTemp.style.height = (tempPct * 100) + "%";

  wrapper.appendChild(hpTemp);
}

  // STATS
  const ac = actor.system?.attributes?.ac?.value ?? "-";
// D&D 5e 6.x stores movement modes under movement.speeds.
// Keep the legacy path as a fallback for older system data.
const movementData = actor.system?.attributes?.movement || {};
const movement = movementData.speeds || movementData;
const walk = movement.walk ?? 0;

const token = actor.getActiveTokens()?.[0];

// default
let mode = "walk";

if (token?.document?.movementAction) {
  mode = token.document.movementAction.toLowerCase();
}

// normalize edge cases
if (mode === "jump" || mode === "teleport") {
  mode = "walk";
}

// calculate speed
let speed = walk;

if (mode === "crawl") {
  speed = Math.floor(walk / 2);
} else {
  speed = movement[mode] ?? walk;
}

// icon map
const iconMap = {
  walk: "icons/svg/walk.svg",
  fly: "icons/svg/wing.svg",
  swim: "icons/svg/whale.svg",
  burrow: "icons/svg/burrow.svg",
  climb: "icons/svg/ladder.svg",
  crawl: "icons/svg/leg.svg"
};

const icon = iconMap[mode] || iconMap.walk;

// final display (NO brackets anymore)
const speedText = `${speed}ft`;
const iconHTML = `
  <span class="move-icon-wrapper">
    <img src="${icon}">
  </span>
`;

  const overlay = document.createElement("div");
overlay.className = "overlay";

let hpText;

if (temp > 0) {
  hpText = `${hp.value}<span class="temp-hp">+${temp}</span>/${hp.max}`;
} else {
  hpText = `${hp.value}/${hp.max}`;
}

overlay.innerHTML =
  `<div>${hpText}</div>` +
  `<div>AC:${ac} | ${speedText} ${iconHTML}</div>`;

  wrapper.appendChild(overlay);

  // EFFECTS
const effectsContainer = document.createElement("div");
effectsContainer.className = "effects-container";

// scale icons
const iconSize = Math.max(12, Math.floor(size * 0.22));
effectsContainer.style.setProperty("--effect-size", iconSize + "px");

// create columns
const leftCol = document.createElement("div");
leftCol.className = "effects-col left";

const rightCol = document.createElement("div");
rightCol.className = "effects-col right";

// collect valid effects
function getRemainingSeconds(effect) {
  const d = effect.duration;

  if (!d) return Infinity;

  // seconds-based
  if (d.remaining != null) return d.remaining;

  // round-based (DnD combat)
  if (d.rounds != null) {
    const combat = game.combat;
    if (!combat) return Infinity;

    const roundTime = CONFIG.time.roundTime || 6;
    return d.rounds * roundTime;
  }

  return Infinity;
}

const validEffects = actor.effects
  .filter(e => !e.disabled && e.isTemporary)
  .map(e => ({
    effect: e,
    remaining: getRemainingSeconds(e)
  }))
  .sort((a, b) => a.remaining - b.remaining);

// limit to 6
const shown = validEffects.slice(0, 6);

function formatTime(sec) {
  if (!isFinite(sec)) return "";

  if (sec >= 3600) return Math.floor(sec / 3600) + "h";
  if (sec >= 60) return Math.floor(sec / 60) + "m";
  return Math.floor(sec) + "s";
}

shown.forEach((entry, i) => {
  const e = entry.effect;
  const remaining = entry.remaining;
const iconWrapper = document.createElement("div");
iconWrapper.className = "effect-icon-wrapper";

const icon = document.createElement("img");
const effectIcon = e.img || e.icon || e._source?.img || "icons/svg/aura.svg";
icon.src = effectIcon;
icon.alt = e.name || "Active effect";
icon.loading = "lazy";
icon.addEventListener("error", () => {
  // A malformed or missing effect icon must not trigger repeated /undefined
  // requests; use Foundry's generic aura icon as a safe fallback.
  if (icon.dataset.fallbackApplied === "true") return;
  icon.dataset.fallbackApplied = "true";
  icon.src = "icons/svg/aura.svg";
});

const label = document.createElement("div");
label.className = "effect-timer";
label.textContent = formatTime(remaining);

if (remaining <= 10) {
  label.style.color = "#ff5252";
}

iconWrapper.appendChild(icon);
iconWrapper.appendChild(label);

if (i < 3) {
  leftCol.appendChild(iconWrapper);
} else {
  rightCol.appendChild(iconWrapper);
}
});

if (validEffects.length > 6) {
  const more = document.createElement("div");
  more.textContent = "+" + (validEffects.length - 6);
  more.className = "effects-more";
  rightCol.appendChild(more);
}

effectsContainer.appendChild(leftCol);
effectsContainer.appendChild(rightCol);

wrapper.appendChild(effectsContainer);

  // ASSEMBLE
  container.appendChild(name);
  container.appendChild(wrapper);

  return container;
}
}
