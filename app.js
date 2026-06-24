const views = document.querySelectorAll(".view");
const appScreen = document.querySelector("#app");
const splashScreen = document.querySelector("#splashScreen");
const splashStart = document.querySelector("#splashStart");
const progressRow = document.querySelector(".progress-row");
const backButton = document.querySelector(".back-button");
const questionInput = document.querySelector("#questionInput");
const questionHint = document.querySelector("#questionHint");
const questionCount = document.querySelector("#questionCount");
const questionMeta = document.querySelector(".question-meta");
const questionSubmit = document.querySelector(".question-submit");
let quickQuestions = document.querySelectorAll(".quick-questions button");
const questionMemory = document.querySelector("#questionMemory");
const cardStage = document.querySelector("#cardStage");
const drawSubmit = document.querySelector(".draw-submit");
const drawCards = Array.from(document.querySelectorAll(".draw-card"));
const analysisBox = document.querySelector("#analysisBox");
const moreCards = document.querySelector("#moreCards");
const particleCanvas = document.querySelector("#particleCanvas");
const resultCard = document.querySelector(".result-card");
const resultCardImage = document.querySelector(".result-card-image");
const cardTitle = document.querySelector("#cardTitle");
const lyricCover = document.querySelector(".lyric-cover");
const lyricCoverImage = document.querySelector(".lyric-cover-image");
const todayLyric = document.querySelector("#todayLyric");
const songMeta = document.querySelector("#songMeta");

const STORAGE_KEY = "qqmusic_answer_book_question";
const MAX_RECOMMENDED_LENGTH = 40;
const QUESTION_TRANSITION_MS = 340;
const ANALYSIS_ENDPOINT = "/api/analyze";
const SPLASH_EXIT_MS = 720;
const DRAW_ENTER_MS = 980;
const RITUAL_FLIP_MS = 980;
const RESULT_REVEAL_MS = 2380;
const CARD_STREAM_STEP = 86;

let currentView = "question";
let question = localStorage.getItem(STORAGE_KEY) || "";
let drawIndex = 0;
let carouselOffset = 0;
let isDrawing = false;
let dragStartX = 0;
let dragDeltaX = 0;
let isDraggingCards = false;
let particleAnimationId = 0;
let wasQuestionReady = false;
let selectedCard = null;
let drawEnterTimer = 0;

function enterApp() {
  if (!splashScreen || splashScreen.classList.contains("is-leaving")) return;

  appScreen.classList.add("is-entering");
  splashScreen.classList.add("is-leaving");
  window.setTimeout(() => {
    splashScreen.hidden = true;
    appScreen.classList.remove("is-entering");
  }, SPLASH_EXIT_MS);
}

const drawProgressMarkup = `
  <span class="progress-dot done">✓</span>
  <span class="progress-dot done">✓</span>
  <span class="progress-dot done">✓</span>
  <span class="progress-dot done">✓</span>
  <span class="progress-dot today">今</span>
  <span class="progress-dot future">4</span>
  <span class="progress-dot future">SSR</span>
`;

const resultProgressMarkup = `
  <span class="progress-dot done">✓</span>
  <span class="progress-dot done">✓</span>
  <span class="progress-dot done">✓</span>
  <span class="progress-dot done">✓</span>
  <span class="progress-dot done">✓</span>
  <span class="progress-dot done">✓</span>
  <span class="progress-dot today">✓</span>
`;

const fallbackCards = [
  {
    cardImage: "",
    cardName: "【SSR】 - 后来的我们",
    songCover: "",
    lyric: "只期待后来的你能快乐，那就是后来的我最想的",
    songInfo: "《后来的我们》 五月天",
  },
];

const cardPool = Array.isArray(window.ANSWER_BOOK_CARDS) && window.ANSWER_BOOK_CARDS.length
  ? window.ANSWER_BOOK_CARDS
  : fallbackCards;

function setView(name) {
  currentView = name;
  appScreen.classList.toggle("is-result-view", name === "result");
  appScreen.classList.remove("is-draw-entering");
  window.clearTimeout(drawEnterTimer);
  progressRow.innerHTML = name === "result" ? resultProgressMarkup : drawProgressMarkup;
  views.forEach((view) => {
    view.classList.toggle("is-active", view.dataset.view === name);
  });

  document.querySelector(".bottom-nav").style.display = "grid";

  if (name === "draw") {
    questionMemory.textContent = `你的问题：${question}`;
    appScreen.classList.add("is-draw-entering");
    drawEnterTimer = window.setTimeout(() => {
      appScreen.classList.remove("is-draw-entering");
    }, DRAW_ENTER_MS);
  }
}

function syncQuestionState() {
  question = questionInput.value.trim();
  const isReady = question.length >= 4;

  questionCount.textContent = `${question.length}/${MAX_RECOMMENDED_LENGTH}`;
  questionMeta.classList.toggle("is-warning", question.length > MAX_RECOMMENDED_LENGTH);
  questionSubmit.textContent = isReady ? "去抽答案" : "写下问题后抽答案";
  questionSubmit.classList.toggle("is-ready", isReady && !wasQuestionReady);
  window.setTimeout(() => questionSubmit.classList.remove("is-ready"), 700);
  wasQuestionReady = isReady;

  if (!question) {
    questionHint.textContent = "写下问题，歌词会替你保存";
    syncQuickQuestionState();
    return;
  }

  if (question.length < 4) {
    questionHint.textContent = "再多写一点，歌词更容易回应你";
    syncQuickQuestionState();
    return;
  }

  if (question.length > MAX_RECOMMENDED_LENGTH) {
    questionHint.textContent = "问题有点长，仍可继续抽卡";
    syncQuickQuestionState();
    return;
  }

  questionHint.textContent = "歌词会记住这个问题";
  syncQuickQuestionState();
}

function showQuestionHint(message) {
  questionHint.textContent = message;
  questionMeta.classList.add("is-warning");
  window.setTimeout(() => {
    questionMeta.classList.remove("is-warning");
    syncQuestionState();
  }, 1400);
}

function submitQuestion() {
  syncQuestionState();

  if (!question) {
    showQuestionHint("先写下你的问题");
    questionInput.focus();
    return;
  }

  if (question.length < 4) {
    showQuestionHint("问题再具体一点，至少 4 个字");
    questionInput.focus();
    return;
  }

  localStorage.setItem(STORAGE_KEY, question);
  const questionView = document.querySelector('[data-view="question"]');
  questionView.classList.add("is-leaving");
  questionSubmit.disabled = true;
  window.setTimeout(() => {
    questionView.classList.remove("is-leaving");
    questionSubmit.disabled = false;
    setView("draw");
  }, QUESTION_TRANSITION_MS);
}

function rotateCards(direction, animate = true) {
  carouselOffset += direction;
  drawIndex = normalizeIndex(carouselOffset, drawCards.length);
  applyCardPositions();

  if (!animate) return;

  drawCards.forEach((card) => {
    card.classList.add("is-shifting");
    window.setTimeout(() => card.classList.remove("is-shifting"), 280);
  });
}

function normalizeIndex(value, length) {
  return ((value % length) + length) % length;
}

function normalizeSlot(value, length) {
  return ((value + 2 + length * 100) % length) - 2;
}

function applyCardPositions() {
  const slotClassByPosition = {
    "-2": "card-left-far",
    "-1": "card-left",
    0: "card-current",
    1: "card-right",
    2: "card-right-far",
  };

  drawCards.forEach((card, index) => {
    card.classList.remove("card-left-far", "card-left", "card-current", "card-right", "card-right-far");
    const slot = normalizeSlot(index - carouselOffset, drawCards.length);
    card.classList.add(slotClassByPosition[slot]);
    card.setAttribute("aria-hidden", slot === 0 ? "false" : "true");
  });
}

function setCardDragOffset(offset) {
  const maxOffset = 124;
  const clampedOffset = Math.max(-maxOffset, Math.min(maxOffset, offset));
  const progress = clampedOffset / maxOffset;

  cardStage.style.setProperty("--drag-x", `${clampedOffset}px`);
  cardStage.style.setProperty("--drag-near", `${clampedOffset}px`);
  cardStage.style.setProperty("--drag-far", `${clampedOffset}px`);
  cardStage.style.setProperty("--drag-rotation", `${progress * 2}deg`);
  cardStage.style.setProperty("--drag-rotation-near", `${progress * 1.2}deg`);
  cardStage.style.setProperty("--drag-rotation-far", `${progress * 0.8}deg`);
}

function resetCardDragOffset() {
  setCardDragOffset(0);
}

function finishCardDrag() {
  if (!isDraggingCards) return;

  isDraggingCards = false;
  cardStage.classList.remove("is-dragging");

  if (Math.abs(dragDeltaX) > 38) {
    rotateCards(dragDeltaX > 0 ? -1 : 1);
  }

  window.requestAnimationFrame(resetCardDragOffset);
  dragStartX = 0;
  dragDeltaX = 0;
}

function getCurrentDrawCard() {
  return document.querySelector(".draw-card.card-current");
}

function startDrawing() {
  if (isDrawing) return;

  isDrawing = true;
  selectedCard = getRandomCard();
  drawSubmit.textContent = "翻开中";
  drawSubmit.classList.add("is-loading");
  drawSubmit.disabled = true;
  cardStage.classList.add("is-ritual");
  const currentDrawCard = getCurrentDrawCard();
  setDrawCardPreview(currentDrawCard, selectedCard);
  currentDrawCard.classList.add("is-chosen");

  window.setTimeout(() => {
    currentDrawCard.classList.add("is-flipping");
  }, RITUAL_FLIP_MS);

  window.setTimeout(() => {
    renderResultCard(selectedCard);
    setView("result");
    renderAnalysis("loading");
  }, RESULT_REVEAL_MS);

  window.setTimeout(async () => {
    const shouldFail = question.includes("失败") || new URLSearchParams(window.location.search).get("fail") === "analysis";

    if (shouldFail) {
      renderAnalysis("error");
    } else {
      try {
        const analysis = await requestLyricAnalysis(selectedCard);
        renderAnalysis("success", selectedCard, analysis);
      } catch (error) {
        renderAnalysis("error", selectedCard);
      }
    }

    currentDrawCard.classList.remove("is-flipping", "is-chosen", "has-preview");
    clearDrawCardPreview(currentDrawCard);
    cardStage.classList.remove("is-ritual");
    drawSubmit.textContent = "抽这张";
    drawSubmit.classList.remove("is-loading");
    drawSubmit.disabled = false;
    isDrawing = false;
  }, RESULT_REVEAL_MS + 830);
}

function setDrawCardPreview(cardElement, card) {
  if (!cardElement) return;

  const normalizedCard = normalizeCard(card);
  let preview = cardElement.querySelector(".draw-card-preview");
  if (!preview) {
    preview = document.createElement("img");
    preview.className = "draw-card-preview";
    preview.alt = "";
    cardElement.append(preview);
  }

  if (normalizedCard.cardImage) {
    preview.src = normalizedCard.cardImage;
    cardElement.classList.add("has-preview");
  } else {
    clearDrawCardPreview(cardElement);
  }
}

function clearDrawCardPreview(cardElement) {
  const preview = cardElement?.querySelector(".draw-card-preview");
  if (preview) {
    preview.removeAttribute("src");
  }
}

function getRandomCard() {
  const randomIndex = Math.floor(Math.random() * cardPool.length);
  return cardPool[randomIndex] || fallbackCards[0];
}

function renderResultCard(card) {
  const normalizedCard = normalizeCard(card);
  const lyricLines = normalizeLines(normalizedCard.lyric);

  cardTitle.textContent = normalizedCard.cardName;
  todayLyric.innerHTML = lyricLines.map(escapeHtml).join("<br />");
  songMeta.textContent = `——${normalizedCard.songInfo}`;

  setOptionalImage(resultCard, resultCardImage, normalizedCard.cardImage);
  setOptionalImage(lyricCover, lyricCoverImage, normalizedCard.songCover);
}

function setOptionalImage(container, image, src) {
  if (!container || !image) return;

  if (!src) {
    image.removeAttribute("src");
    image.removeAttribute("alt");
    container.classList.remove("has-image");
    return;
  }

  image.src = src;
  image.alt = "";
  container.classList.add("has-image");
}

function normalizeCard(card) {
  return {
    cardImage: card.cardImage || "",
    cardName: card.cardName || "未命名歌词卡",
    songCover: card.songCover || "",
    lyric: card.lyric || "这句歌词还没有配置",
    songInfo: card.songInfo || "《未知歌曲》 未知作者",
  };
}

function normalizeLines(lyric) {
  return String(lyric)
    .split(/[，,。；;！!？?\n]/)
    .map((line) => line.trim())
    .filter(Boolean);
}

async function requestLyricAnalysis(card) {
  const normalizedCard = normalizeCard(card);

  if (window.location.protocol === "file:") {
    return buildLocalAnalysis(normalizedCard);
  }

  const response = await fetch(ANALYSIS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      question,
      lyric: normalizedCard.lyric,
      cardName: normalizedCard.cardName,
      songInfo: normalizedCard.songInfo,
    }),
  });

  if (!response.ok) {
    throw new Error(`Analysis request failed: ${response.status}`);
  }

  const data = await response.json();
  if (!data.analysis) {
    throw new Error("Analysis response is empty");
  }

  return data.analysis;
}

function buildLocalAnalysis(card) {
  return [
    `你问「${question}」，这张牌没有给一个斩钉截铁的答案，而是把重点放回到你的感受上。`,
    `「${card.lyric}」是 ${card.songInfo} 给你的线索。它把答案放得很轻：先照顾好当下的感受，再决定下一步怎么走。`,
    "如果今天要做一个小决定，可以先选那个让你更平静的方向。往前走一点，答案会比现在更清楚。",
  ].join("\n\n");
}

function buildPersonalizedAnalysis(card) {
  const normalizedCard = normalizeCard(card);
  const song = parseSongInfo(normalizedCard.songInfo);
  const rank = pick([88, 100, 166, 520, 616, 777, 1001, 1314]);
  const listenCount = pick([16, 23, 52, 66, 88, 99, 166, 233]);
  const guardDays = pick([7, 21, 33, 66, 88, 100, 168]);
  const hour = String(pick([0, 8, 12, 18, 21, 22, 23])).padStart(2, "0");
  const minute = String(pick([0, 6, 12, 18, 24, 30, 45, 56])).padStart(2, "0");
  const weekday = pick(["周一", "周二", "周三", "周四", "周五", "周末"]);
  const season = pick(["夏天", "夜晚", "这个清晨", "这段日子", "六月"]);
  const lyricLine = normalizeLines(normalizedCard.lyric)[0] || normalizedCard.lyric;
  const templates = [
    [
      `To Justin，您是今天第 ${mark(rank)} 位抽到这张歌词卡的用户。`,
      `《${mark(song.title)}》您已经累计听了 ${mark(listenCount)} 次，果然偏爱藏不住呀。${weekday}啦，别再盯着「${mark(lyricLine)}」的节奏赶啦。`,
    ],
    [
      `To Justin，您是今天第 ${mark(rank)} 位抽到这张歌词卡的用户。`,
      `${season}里，您已经守护您的乐伴歌手 ${mark(guardDays)} 天。${mark(song.artist)} 这份鲜活，正好唱进了你今天的问题里。`,
    ],
    [
      `To Justin，您是今天第 ${mark(rank)} 位抽到这张歌词卡的用户。`,
      `还记得昨天 ${mark(`${hour}:${minute}`)}，你在静静循环《${mark(song.title)}》吗？这句「${mark(lyricLine)}」像专属于你的提示，提醒你把心里的答案听完整。`,
    ],
    [
      `To Justin，您是今天第 ${mark(rank)} 位抽到这张歌词卡的用户。`,
      `最近你和《${mark(song.title)}》重逢了 ${mark(listenCount)} 次，${mark(song.artist)} 的声音像把今天的问题轻轻托住：先别急着定义结果。`,
    ],
  ];

  return pick(templates).map((line) => `<p class="personalized-line">${line}</p>`).join("");
}

function parseSongInfo(songInfo) {
  const match = String(songInfo).match(/《(.+?)》\s*(.*)/);
  return {
    title: match?.[1] || "这首歌",
    artist: match?.[2] || "这位歌手",
  };
}

function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function mark(value) {
  return `<span class="analysis-highlight">${escapeHtml(String(value))}</span>`;
}

function renderAnalysis(state, selectedCard = cardPool[normalizeIndex(drawIndex, cardPool.length)], analysis = "") {
  if (state === "loading") {
    analysisBox.innerHTML = `
      <p class="analysis-loading">正在从歌词里找答案</p>
      <div class="skeleton-lines" aria-hidden="true">
        <span></span><span></span><span></span>
      </div>
    `;
    return;
  }

  if (state === "error") {
    analysisBox.innerHTML = `
      <div class="analysis-error">
        <p>这次答案没能完整生成，但歌词已经给出了方向。可以再试一次。</p>
        <button type="button" id="retryAnalysis">再试一次</button>
      </div>
    `;
    document.querySelector("#retryAnalysis").addEventListener("click", () => {
      renderAnalysis("loading");
      window.setTimeout(async () => {
        try {
          const analysis = await requestLyricAnalysis(selectedCard);
          renderAnalysis("success", selectedCard, analysis);
        } catch (error) {
          renderAnalysis("error", selectedCard);
        }
      }, 900);
    });
    return;
  }

  const personalizedAnalysis = buildPersonalizedAnalysis(selectedCard);
  const lyricAnalysis = analysis
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join("");
  analysisBox.innerHTML = `${personalizedAnalysis}${lyricAnalysis}`;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderQuickQuestions() {
  quickQuestions = document.querySelectorAll(".quick-questions button");
  quickQuestions.forEach((button) => {
    button.addEventListener("click", () => {
      questionInput.value = button.dataset.question || button.textContent;
      syncQuestionState();
      questionInput.focus();
    });
  });
}

function syncQuickQuestionState() {
  quickQuestions.forEach((button) => {
    const isSelected = question === (button.dataset.question || button.textContent);
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });
}

renderQuickQuestions();
questionInput.value = question;
syncQuestionState();
applyCardPositions();

splashStart?.addEventListener("click", enterApp);

splashScreen?.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    enterApp();
  }
});

questionInput.addEventListener("input", syncQuestionState);
questionSubmit.addEventListener("click", submitQuestion);

cardStage.addEventListener("pointerdown", (event) => {
  if (isDrawing) return;

  dragStartX = event.clientX;
  dragDeltaX = 0;
  isDraggingCards = true;
  cardStage.classList.add("is-dragging");
  cardStage.setPointerCapture?.(event.pointerId);
});

cardStage.addEventListener("pointermove", (event) => {
  if (!isDraggingCards) return;

  dragDeltaX = event.clientX - dragStartX;

  while (dragDeltaX > CARD_STREAM_STEP) {
    rotateCards(-1, false);
    dragStartX += CARD_STREAM_STEP;
    dragDeltaX -= CARD_STREAM_STEP;
  }

  while (dragDeltaX < -CARD_STREAM_STEP) {
    rotateCards(1, false);
    dragStartX -= CARD_STREAM_STEP;
    dragDeltaX += CARD_STREAM_STEP;
  }

  setCardDragOffset(dragDeltaX);
  event.preventDefault();
});

cardStage.addEventListener("pointerup", finishCardDrag);

cardStage.addEventListener("pointercancel", finishCardDrag);

drawSubmit.addEventListener("click", startDrawing);

backButton.addEventListener("click", () => {
  if (currentView === "result") {
    setView("draw");
    return;
  }

  if (currentView === "draw") {
    setView("question");
  }
});

moreCards.addEventListener("click", () => {
  setView("draw");
});

function setupParticleBackground() {
  if (!particleCanvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const context = particleCanvas.getContext("2d");
  const particles = [];
  const particleCount = 220;
  let width = 0;
  let height = 0;
  let pixelRatio = 1;

  function resize() {
    const bounds = particleCanvas.getBoundingClientRect();
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    width = bounds.width;
    height = bounds.height;
    particleCanvas.width = Math.floor(width * pixelRatio);
    particleCanvas.height = Math.floor(height * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }

  function seedParticles() {
    particles.length = 0;
    for (let index = 0; index < particleCount; index += 1) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: 0.45 + Math.random() * 1.15,
        speedX: -0.08 + Math.random() * 0.16,
        speedY: 0.08 + Math.random() * 0.34,
        alpha: 0.2 + Math.random() * 0.68,
      });
    }
  }

  function draw() {
    context.clearRect(0, 0, width, height);
    particles.forEach((particle) => {
      particle.x += particle.speedX;
      particle.y += particle.speedY;

      if (particle.y > height + 8) particle.y = -8;
      if (particle.x < -8) particle.x = width + 8;
      if (particle.x > width + 8) particle.x = -8;

      context.beginPath();
      context.fillStyle = `rgba(255,255,255,${particle.alpha})`;
      context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      context.fill();
    });

    particleAnimationId = window.requestAnimationFrame(draw);
  }

  resize();
  seedParticles();
  draw();

  window.addEventListener("resize", () => {
    window.cancelAnimationFrame(particleAnimationId);
    resize();
    seedParticles();
    draw();
  });
}

setupParticleBackground();
