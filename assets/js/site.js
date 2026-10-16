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
const scoreDisplay = document.querySelector("[data-game-score]");
const missesDisplay = document.querySelector("[data-game-misses]");
const meter = document.querySelector("[data-game-meter]");
const nodes = [...document.querySelectorAll("[data-node]")];
const nodeNames = ["API", "container", "network", "fire"];

let running = false;
let activeNode = -1;
let previousNode = -1;
let hits = 0;
let misses = 0;
let endAt = 0;
let frameId = 0;
let nodeTimer = 0;
let nextNodeTimer = 0;

const clearNodeState = () => {
  nodes.forEach((node) => node.classList.remove("is-hot", "was-hit"));
  activeNode = -1;
};

const updateScoreboard = () => {
  const attempts = hits + misses;
  const uptime = attempts === 0 ? 100 : Math.round((hits / attempts) * 100);
  scoreDisplay.textContent = `${uptime}%`;
  missesDisplay.textContent = String(misses);
  game.style.setProperty("--heat", String(Math.min(hits, 12)));
};

const queueNode = () => {
  if (!running) return;
  clearNodeState();

  do {
    activeNode = Math.floor(Math.random() * nodes.length);
  } while (activeNode === previousNode && nodes.length > 1);

  previousNode = activeNode;
  nodes[activeNode].classList.add("is-hot");
  gameMessage.textContent = `Signal fault: ${nodeNames[activeNode]} node.`;

  const responseWindow = Math.max(520, 1080 - hits * 28);
  nodeTimer = window.setTimeout(() => {
    if (!running || activeNode < 0) return;
    misses += 1;
    updateScoreboard();
    gameMessage.textContent = `${nodeNames[activeNode]} signal dropped.`;
    clearNodeState();
    nextNodeTimer = window.setTimeout(queueNode, 170);
  }, responseWindow);
};

const finishGame = () => {
  running = false;
  window.clearTimeout(nodeTimer);
  window.clearTimeout(nextNodeTimer);
  window.cancelAnimationFrame(frameId);
  clearNodeState();
  timeDisplay.textContent = "0.0";
  root.style.setProperty("--game-progress", "0");
  startButton.disabled = false;
  startButton.textContent = "Run field test again";

  const grade = hits >= 18 && misses <= 3 ? "Operator grade." : hits >= 12 ? "Relay held." : "Field notes required.";
  gameMessage.textContent = `${grade} ${hits} signals restored, ${misses} dropped.`;
};

const gameTick = (now) => {
  if (!running) return;
  const remaining = Math.max(0, endAt - now);
  timeDisplay.textContent = (remaining / 1000).toFixed(1);
  root.style.setProperty("--game-progress", String(remaining / 20000));

  if (remaining <= 0) {
    finishGame();
    return;
  }

  frameId = window.requestAnimationFrame(gameTick);
};

const hitNode = (index) => {
  if (!running || activeNode < 0) return;
  window.clearTimeout(nodeTimer);

  if (index === activeNode) {
    hits += 1;
    nodes[index].classList.remove("is-hot");
    nodes[index].classList.add("was-hit");
    gameMessage.textContent = `${nodeNames[index]} restored.`;
  } else {
    misses += 1;
    gameMessage.textContent = `Wrong layer. ${nodeNames[activeNode]} dropped.`;
  }

  updateScoreboard();
  activeNode = -1;
  nextNodeTimer = window.setTimeout(queueNode, 140);
};

const startGame = () => {
  window.clearTimeout(nodeTimer);
  window.clearTimeout(nextNodeTimer);
  window.cancelAnimationFrame(frameId);
  hits = 0;
  misses = 0;
  previousNode = -1;
  running = true;
  endAt = performance.now() + 20000;
  clearNodeState();
  updateScoreboard();
  timeDisplay.textContent = "20.0";
  root.style.setProperty("--game-progress", "1");
  startButton.disabled = true;
  startButton.textContent = "Field test running";
  gameMessage.textContent = "Relay online. Watch the nodes.";
  nextNodeTimer = window.setTimeout(queueNode, 450);
  frameId = window.requestAnimationFrame(gameTick);
};

if (game && startButton) {
  startButton.addEventListener("click", startGame);
  nodes.forEach((node, index) => node.addEventListener("click", () => hitNode(index)));

  window.addEventListener("keydown", (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    const index = Number(event.key) - 1;
    if (index >= 0 && index < nodes.length) hitNode(index);
  });
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
