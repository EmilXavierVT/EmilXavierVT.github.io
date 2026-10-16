const root = document.documentElement;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const updateScroll = () => {
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  const progress = maxScroll > 0 ? (window.scrollY / maxScroll) * 100 : 0;
  root.style.setProperty("--scroll-progress", `${progress}%`);
};

updateScroll();
window.addEventListener("scroll", updateScroll, { passive: true });

const clock = document.querySelector("[data-clock]");
const clockFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Copenhagen",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const updateClock = () => {
  if (clock) clock.textContent = `${clockFormatter.format(new Date())} CET`;
};

updateClock();
window.setInterval(updateClock, 1000);

if (!reduceMotion) {
  window.addEventListener("pointermove", (event) => {
    const x = (event.clientX / window.innerWidth - 0.5) * -8;
    const y = (event.clientY / window.innerHeight - 0.5) * -5;
    root.style.setProperty("--hero-x", `${x}px`);
    root.style.setProperty("--hero-y", `${y}px`);
  });
}

const revealTargets = document.querySelectorAll(
  ".story-grid, .project-console, .game-console, .manifest, .trail-log, .learning-lines, .link-index"
);

if ("IntersectionObserver" in window && !reduceMotion) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1 }
  );

  revealTargets.forEach((target) => {
    target.classList.add("reveal");
    revealObserver.observe(target);
  });
}

const navLinks = [...document.querySelectorAll("nav a[href^='#']")];
const observedSections = navLinks
  .map((link) => document.querySelector(link.getAttribute("href")))
  .filter(Boolean);

if ("IntersectionObserver" in window) {
  const navObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

      if (!visible) return;
      navLinks.forEach((link) => {
        link.classList.toggle("is-active", link.getAttribute("href") === `#${visible.target.id}`);
      });
    },
    { rootMargin: "-30% 0px -55%", threshold: [0.05, 0.25, 0.5] }
  );

  observedSections.forEach((section) => navObserver.observe(section));
}

const projectTabs = [...document.querySelectorAll("[data-project]")];
const projectPanels = [...document.querySelectorAll("[data-panel]")];

const activateProject = (tab, moveFocus = false) => {
  const project = tab.dataset.project;

  projectTabs.forEach((candidate) => {
    const selected = candidate === tab;
    candidate.setAttribute("aria-selected", String(selected));
    candidate.tabIndex = selected ? 0 : -1;
  });

  projectPanels.forEach((panel) => {
    panel.hidden = panel.dataset.panel !== project;
  });

  if (moveFocus) tab.focus();
  tab.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest", inline: "center" });
};

projectTabs.forEach((tab, index) => {
  tab.addEventListener("click", () => activateProject(tab));
  tab.addEventListener("keydown", (event) => {
    if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();

    let nextIndex = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (index + 1) % projectTabs.length;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (index - 1 + projectTabs.length) % projectTabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = projectTabs.length - 1;
    activateProject(projectTabs[nextIndex], true);
  });
});

const game = document.querySelector("[data-game]");
const startButton = document.querySelector("[data-game-start]");
const gameMessage = document.querySelector("[data-game-message]");
const timeDisplay = document.querySelector("[data-game-time]");
const bookingsDisplay = document.querySelector("[data-game-bookings]");
const invoicesDisplay = document.querySelector("[data-game-invoices]");
const ramDisplay = document.querySelector("[data-game-ram]");
const meter = document.querySelector("[data-game-meter]");
const gameWorld = document.querySelector("[data-game-world]");
const chef = document.querySelector("[data-game-chef]");
const opsNode = document.querySelector("[data-ops-node]");
const opsState = document.querySelector("[data-ops-state]");
const packet = document.querySelector("[data-automation-packet]");
const stationButtons = [...document.querySelectorAll("[data-station]")];
const automationButtons = [...document.querySelectorAll("[data-automation]")];
const stationElements = Object.fromEntries(stationButtons.map((button) => [button.dataset.station, button]));
const stationNames = {
  booking: "Reservations",
  groceries: "Groceries",
  kitchen: "Cooking",
  customer: "Customer",
  invoice: "Invoices",
  staff: "Employees",
  cleaning: "Cleaning",
};
const queueTemplate = { booking: 0, groceries: 0, kitchen: 0, customer: 0, invoice: 0, staff: 0, cleaning: 0 };
const queues = { ...queueTemplate };
const automatedStations = new Set();
const processingStations = new Set();
const spritePositions = ["0%", "33.333%", "66.667%", "100%"];

let gameRunning = false;
let workerBusy = false;
let bookings = 0;
let invoices = 0;
let ram = 0;
let lostBookings = 0;
let endAt = 0;
let frameId = 0;
let spawnTimer = 0;
let automationTimer = 0;
let walkTimer = 0;
let chefX = 0;
let chefY = 0;
let gameRunId = 0;
const shiftSeconds = Number(game?.dataset.shiftDuration || 90);

const wait = (duration) => new Promise((resolve) => window.setTimeout(resolve, duration));

const setChefFrame = (frame, direction = 0) => {
  if (!chef) return;
  chef.style.setProperty("--sprite-x", spritePositions[frame % spritePositions.length]);
  chef.style.setProperty("--sprite-y", spritePositions[direction]);
};

const getTargetPosition = (element) => {
  if (!gameWorld || !chef || !element) return { x: 0, y: 0 };
  const worldRect = gameWorld.getBoundingClientRect();
  const targetRect = element.getBoundingClientRect();
  return {
    x: targetRect.left - worldRect.left + targetRect.width / 2 - chef.offsetWidth / 2,
    y: targetRect.top - worldRect.top + targetRect.height / 2 - chef.offsetHeight / 2,
  };
};

const placeChefAtOps = () => {
  if (!chef || !opsNode) return;
  const target = getTargetPosition(opsNode);
  chefX = target.x;
  chefY = target.y + (opsNode.offsetHeight * 0.55);
  chef.style.setProperty("--chef-x", `${chefX}px`);
  chef.style.setProperty("--chef-y", `${chefY}px`);
  setChefFrame(0, 0);
};

const moveChefTo = async (element, runId) => {
  if (!chef || !element) return;
  const target = getTargetPosition(element);
  const dx = target.x - chefX;
  const dy = target.y - chefY;
  const direction = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : (dy < 0 ? 3 : 0);
  const distance = Math.hypot(dx, dy);
  const duration = reduceMotion ? 0 : Math.min(900, Math.max(260, distance * 2.2));
  let walkFrame = 0;

  window.clearInterval(walkTimer);
  chef.classList.add("is-walking");
  setChefFrame(walkFrame, direction);
  if (!reduceMotion) {
    walkTimer = window.setInterval(() => {
      walkFrame = (walkFrame + 1) % 4;
      setChefFrame(walkFrame, direction);
    }, 115);
  }

  chef.style.setProperty("--walk-duration", `${duration}ms`);
  chef.style.setProperty("--chef-x", `${target.x}px`);
  chef.style.setProperty("--chef-y", `${target.y}px`);
  await wait(duration);
  if (runId !== gameRunId) return;

  window.clearInterval(walkTimer);
  chefX = target.x;
  chefY = target.y;
  chef.classList.remove("is-walking");
  setChefFrame(0, direction);
};

const updateAutomation = () => {
  automationButtons.forEach((button) => {
    const threshold = Number(button.dataset.threshold);
    const key = button.dataset.automation;
    const unlocked = ram >= threshold;
    button.disabled = !unlocked || !gameRunning;
    button.classList.toggle("is-unlocked", unlocked);
    button.classList.toggle("is-active", automatedStations.has(key));
    button.setAttribute("aria-pressed", String(automatedStations.has(key)));
    button.title = unlocked ? `${stationNames[key]} automation available` : `Requires ${threshold} RAM`;
  });

  if (opsState) opsState.textContent = automatedStations.size ? `${automatedStations.size} LIVE` : "MANUAL";
  opsNode?.classList.toggle("is-live", automatedStations.size > 0);
};

const updateGame = () => {
  if (!game) return;
  bookingsDisplay.textContent = String(bookings);
  invoicesDisplay.textContent = String(invoices);
  ramDisplay.textContent = String(ram);
  game.style.setProperty("--ram-level", String(Math.min(ram, 10) / 10));

  stationButtons.forEach((button) => {
    const key = button.dataset.station;
    const count = queues[key];
    const processing = processingStations.has(key);
    const automated = automatedStations.has(key);
    button.classList.toggle("has-work", count > 0);
    button.classList.toggle("is-processing", processing);
    button.classList.toggle("is-automated", automated);
    button.disabled = !gameRunning || count === 0 || processing;
    const mode = automated ? "automated" : "manual";
    button.title = `${stationNames[key]} / ${mode} / ${count} waiting`;
    button.setAttribute("aria-label", `${stationNames[key]}, ${mode}, ${count} task${count === 1 ? "" : "s"} waiting, key ${button.dataset.key}`);
  });

  updateAutomation();
};

const sendAutomationPacket = (key) => {
  if (!packet || !opsNode || !stationElements[key]) return;
  const origin = getTargetPosition(opsNode);
  const target = getTargetPosition(stationElements[key]);
  packet.style.left = `${origin.x + (chef?.offsetWidth || 0) / 2}px`;
  packet.style.top = `${origin.y + (chef?.offsetHeight || 0) / 2}px`;
  packet.style.setProperty("--packet-x", `${target.x - origin.x}px`);
  packet.style.setProperty("--packet-y", `${target.y - origin.y}px`);
  packet.classList.remove("is-flying");
  void packet.offsetWidth;
  packet.classList.add("is-flying");
};

const completeWork = (key) => {
  queues[key] = Math.max(0, queues[key] - 1);

  if (key === "booking") {
    bookings += 1;
    ram += 1;
    queues.groceries += 1;
    if (bookings % 2 === 0) queues.staff += 1;
  }
  if (key === "groceries") queues.kitchen += 1;
  if (key === "kitchen") queues.customer += 1;
  if (key === "customer") {
    queues.invoice += 1;
    queues.cleaning += 1;
  }
  if (key === "invoice") {
    invoices += 1;
    ram += 1;
  }
};

const workAtStation = async (key, automated = false) => {
  if (!gameRunning || !stationElements[key] || queues[key] < 1 || processingStations.has(key)) return false;
  if (!automated && workerBusy) {
    gameMessage.textContent = "One operator, many systems. Finish the current task first.";
    return false;
  }

  const runId = gameRunId;
  processingStations.add(key);
  if (!automated) workerBusy = true;
  updateGame();

  if (automated) {
    sendAutomationPacket(key);
    await wait(reduceMotion ? 120 : 520);
  } else {
    gameMessage.textContent = `${stationNames[key]} selected. Operator moving.`;
    await moveChefTo(stationElements[key], runId);
    if (runId !== gameRunId || !gameRunning) return false;
    gameMessage.textContent = `${stationNames[key]} in progress.`;
    await wait(reduceMotion ? 140 : 620);
  }

  if (runId !== gameRunId || !gameRunning) return false;
  completeWork(key);
  processingStations.delete(key);
  if (!automated) workerBusy = false;
  gameMessage.textContent = automated
    ? `${stationNames[key]} handled by the ops node.`
    : `${stationNames[key]} complete. The next handoff is ready.`;
  updateGame();
  return true;
};

const addReservation = () => {
  if (!gameRunning) return;
  if (queues.booking >= 3) {
    lostBookings += 1;
    gameMessage.textContent = "The reservation queue overflowed. A request moved on.";
  } else {
    queues.booking += 1;
    gameMessage.textContent = "A new reservation is ringing.";
  }
  updateGame();
};

const runAutomation = () => {
  automatedStations.forEach((key) => {
    if (queues[key] > 0 && !processingStations.has(key)) workAtStation(key, true);
  });
};

const finishGame = () => {
  gameRunning = false;
  gameRunId += 1;
  window.clearInterval(spawnTimer);
  window.clearInterval(automationTimer);
  window.clearInterval(walkTimer);
  window.cancelAnimationFrame(frameId);
  processingStations.clear();
  workerBusy = false;
  chef?.classList.remove("is-walking");
  timeDisplay.textContent = "0";
  root.style.setProperty("--game-progress", "0");
  startButton.disabled = false;
  startButton.textContent = "Run another shift";
  const overflow = lostBookings ? ` ${lostBookings} request${lostBookings === 1 ? "" : "s"} escaped the queue.` : " No bookings were lost.";
  gameMessage.textContent = `Shift closed: ${bookings} bookings, ${invoices} invoices, ${ram} RAM, ${automatedStations.size} automations.${overflow}`;
  updateGame();
};

const gameTick = (now) => {
  if (!gameRunning) return;
  const remaining = Math.max(0, endAt - now);
  timeDisplay.textContent = String(Math.ceil(remaining / 1000));
  root.style.setProperty("--game-progress", String(remaining / (shiftSeconds * 1000)));
  if (remaining <= 0) {
    finishGame();
    return;
  }
  frameId = window.requestAnimationFrame(gameTick);
};

const startGame = () => {
  gameRunId += 1;
  window.clearInterval(spawnTimer);
  window.clearInterval(automationTimer);
  window.cancelAnimationFrame(frameId);
  Object.assign(queues, queueTemplate, { booking: 1, staff: 1 });
  automatedStations.clear();
  processingStations.clear();
  bookings = 0;
  invoices = 0;
  ram = 0;
  lostBookings = 0;
  workerBusy = false;
  gameRunning = true;
  endAt = performance.now() + shiftSeconds * 1000;
  timeDisplay.textContent = String(shiftSeconds);
  root.style.setProperty("--game-progress", "1");
  startButton.disabled = true;
  startButton.textContent = "Shift in progress";
  gameMessage.textContent = "First reservation in. The room is yours.";
  placeChefAtOps();
  updateGame();
  spawnTimer = window.setInterval(addReservation, 10000);
  automationTimer = window.setInterval(runAutomation, 1150);
  frameId = window.requestAnimationFrame(gameTick);
};

if (game && startButton) {
  startButton.addEventListener("click", startGame);
  stationButtons.forEach((button) => button.addEventListener("click", () => workAtStation(button.dataset.station)));
  automationButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.automation;
      if (automatedStations.has(key)) {
        automatedStations.delete(key);
        gameMessage.textContent = `${button.querySelector("span")?.textContent} paused.`;
      } else {
        automatedStations.add(key);
        gameMessage.textContent = `${button.querySelector("span")?.textContent} is live.`;
        runAutomation();
      }
      updateGame();
    });
  });

  window.addEventListener("keydown", (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLButtonElement) return;
    const station = stationButtons.find((button) => button.dataset.key === event.key);
    if (station) workAtStation(station.dataset.station);
  });
  window.addEventListener("resize", () => {
    if (!gameRunning && opsNode) placeChefAtOps();
  });

  window.portfolioShift = Object.freeze({
    start: startGame,
    visit: (key) => workAtStation(key),
    getState: () => ({
      running: gameRunning,
      bookings,
      invoices,
      ram,
      lostBookings,
      queues: { ...queues },
      automations: [...automatedStations],
    }),
  });

  updateGame();
  window.requestAnimationFrame(placeChefAtOps);
}

const guidePanel = document.querySelector("[data-guide-panel]");
const guideOpen = document.querySelector("[data-guide-open]");
const guideClose = document.querySelector("[data-guide-close]");
const guideReset = document.querySelector("[data-guide-reset]");
const guideScrim = document.querySelector("[data-guide-scrim]");
const guideStatus = document.querySelector("[data-guide-status]");
const guideLaunchState = document.querySelector("[data-guide-launch-state]");
const guideMessages = document.querySelector("[data-guide-messages]");
const guideForm = document.querySelector("[data-guide-form]");
const guideInput = document.querySelector("[data-guide-input]");
const guideSubmit = guideForm?.querySelector('button[type="submit"]');
const guidePrivacy = document.querySelector("[data-guide-privacy]");
const guideQuestions = [...document.querySelectorAll("[data-guide-question]")];
const ragProxyUrl = guidePanel?.dataset.proxyUrl?.trim().replace(/\/$/, "") || "";
const guideWelcome = ragProxyUrl
  ? "I know the systems, tools and real-world problems behind this portfolio. Ask me where Emil is strongest, how a project works or what shaped his route into software."
  : "AIDA is not connected through Cloudflare yet. Open AIDA directly below while the secure connection is completed.";
let guideSourceMap = {};
let guideConversationId = "";
let guideBusy = false;

try {
  const sourceMapNode = document.querySelector("#portfolio-source-map");
  guideSourceMap = sourceMapNode ? JSON.parse(sourceMapNode.textContent) : {};
} catch (error) {
  console.warn("Portfolio source map could not be loaded.", error);
}

const setGuideMode = (label) => {
  if (guideStatus) guideStatus.lastChild.textContent = label;
  if (guideLaunchState) guideLaunchState.textContent = label;
};

const openGuide = () => {
  if (!guidePanel || !guideOpen || !guideScrim) return;
  guidePanel.classList.add("is-open");
  guidePanel.setAttribute("aria-hidden", "false");
  guideOpen.setAttribute("aria-expanded", "true");
  guideScrim.hidden = false;
  document.body.classList.add("guide-open");
  window.setTimeout(() => guideInput?.focus(), reduceMotion ? 0 : 220);
};

const closeGuide = () => {
  if (!guidePanel || !guideOpen || !guideScrim) return;
  guidePanel.classList.remove("is-open");
  guidePanel.setAttribute("aria-hidden", "true");
  guideOpen.setAttribute("aria-expanded", "false");
  guideScrim.hidden = true;
  document.body.classList.remove("guide-open");
  guideOpen.focus();
};

const appendGuideMessage = (role, message) => {
  if (!guideMessages) return;
  const article = document.createElement("article");
  article.className = `guide-message is-${role}`;

  const label = document.createElement("span");
  label.textContent = role === "user" ? "QUERY / YOU" : "FIELD GUIDE / RESPONSE";
  article.append(label);

  const body = document.createElement("p");
  body.textContent = message;
  article.append(body);

  guideMessages.append(article);
  article.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "end" });
  return { article, body };
};

const renderGuideSources = (article, resources = []) => {
  if (!article || !Array.isArray(resources)) return;
  const seen = new Set();
  const sources = resources
    .map((resource) => {
      const name = resource?.document_name || resource?.document?.name || "";
      if (!name || seen.has(name)) return null;
      seen.add(name);
      return guideSourceMap[name] || null;
    })
    .filter(Boolean);

  if (!sources.length) return;
  const list = document.createElement("div");
  list.className = "guide-message-sources";
  sources.forEach((source) => {
    const link = document.createElement("a");
    link.href = source.url;
    link.textContent = `Source: ${source.label}`;
    if (!source.url.startsWith("#") && !source.url.startsWith("mailto:")) {
      link.target = "_blank";
      link.rel = "noopener";
    }
    list.append(link);
  });
  article.append(list);
};

const setGuideBusy = (busy) => {
  guideBusy = busy;
  if (guidePanel) guidePanel.setAttribute("aria-busy", String(busy));
  if (guideInput) guideInput.disabled = busy;
  if (guideSubmit) guideSubmit.disabled = busy;
  if (guideReset) guideReset.disabled = busy;
};

const getGuideUserId = () => {
  const storageKey = "emil-portfolio-rag-user";
  try {
    const saved = window.localStorage.getItem(storageKey);
    if (saved) return saved;
    const randomPart = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const userId = `portfolio_${randomPart}`;
    window.localStorage.setItem(storageKey, userId);
    return userId;
  } catch (_error) {
    return `portfolio_${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
};

const readDifyStream = async (response, onEvent) => {
  if (!response.body) throw new Error("The assistant returned no response stream.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const consume = (block) => {
    const payload = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!payload || payload === "[DONE]") return;
    let event;
    try {
      event = JSON.parse(payload);
    } catch (error) {
      console.warn("Ignored an unreadable Dify event.", error);
      return;
    }
    onEvent(event);
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() || "";
    blocks.forEach(consume);
    if (done) break;
  }
  if (buffer.trim()) consume(buffer);
};

const answerWithDify = async (cleanQuestion) => {
  const pending = appendGuideMessage("assistant", "");
  if (!pending) return;
  pending.article.classList.add("is-pending");
  let answer = "";
  let sources = [];

  setGuideBusy(true);
  setGuideMode("AIDA / THINKING");
  try {
    const response = await fetch(`${ragProxyUrl}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: cleanQuestion,
        conversation_id: guideConversationId,
        user: getGuideUserId()
      })
    });

    if (!response.ok) throw new Error("The field guide is temporarily unavailable.");

    await readDifyStream(response, (event) => {
      if (event.event === "message" || event.event === "agent_message") {
        answer += event.answer || "";
      } else if (event.event === "message_replace") {
        answer = event.answer || answer;
      } else if (event.event === "message_end") {
        guideConversationId = event.conversation_id || guideConversationId;
        sources = event.metadata?.retriever_resources || sources;
      } else if (event.event === "error") {
        throw new Error("Dify could not complete this answer.");
      }

      if (answer) {
        pending.article.classList.remove("is-pending");
        pending.body.textContent = answer;
        pending.article.scrollIntoView({ behavior: "auto", block: "end" });
      }
    });

    pending.article.classList.remove("is-pending");
    pending.body.textContent = answer || "I could not find enough portfolio evidence to answer that confidently.";
    renderGuideSources(pending.article, sources);
    setGuideMode("AIDA / ONLINE");
  } catch (error) {
    console.warn("Remote field guide request failed.", error);
    pending.article.classList.remove("is-pending");
    pending.body.textContent = "AIDA is temporarily unavailable. No local answer was generated; please try again shortly or open AIDA directly.";
    setGuideMode("AIDA / OFFLINE");
  } finally {
    setGuideBusy(false);
    guideInput?.focus();
  }
};

const answerGuideQuestion = async (question) => {
  const cleanQuestion = question.trim();
  if (!cleanQuestion || guideBusy) return;
  if (!ragProxyUrl) {
    appendGuideMessage("assistant", "AIDA is not connected through Cloudflare yet. Open AIDA directly below.");
    return;
  }
  appendGuideMessage("user", cleanQuestion);
  await answerWithDify(cleanQuestion);
};

const resetGuide = () => {
  if (!guideMessages || guideBusy) return;
  guideConversationId = "";
  guideMessages.replaceChildren();
  appendGuideMessage("assistant", guideWelcome);
  setGuideMode(ragProxyUrl ? "AIDA / READY" : "AIDA / SETUP");
  guideInput?.focus();
};

if (guidePanel && guideOpen) {
  setGuideMode(ragProxyUrl ? "AIDA / READY" : "AIDA / SETUP");
  if (guidePrivacy) guidePrivacy.hidden = !ragProxyUrl;
  if (!ragProxyUrl) {
    if (guideInput) guideInput.disabled = true;
    if (guideSubmit) guideSubmit.disabled = true;
    guideQuestions.forEach((button) => (button.disabled = true));
  }
  guideOpen.addEventListener("click", openGuide);
  guideClose?.addEventListener("click", closeGuide);
  guideReset?.addEventListener("click", resetGuide);
  guideScrim?.addEventListener("click", closeGuide);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && guidePanel.classList.contains("is-open")) closeGuide();
  });

  guideQuestions.forEach((button) => {
    button.addEventListener("click", () => answerGuideQuestion(button.dataset.guideQuestion || button.textContent));
  });

  guideForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    answerGuideQuestion(guideInput.value);
    guideInput.value = "";
  });
}
