const filledPrompt =
  "Stake 5 ETH with Lido, then use that staked position as collateral on Aave and borrow 1,000 USDC against it";

const suggestionRows = {
  primary: [
    "Swap 0.5 ETH to USDC",
    "Bridge USDC to Base",
    "Check my portfolio",
    "Deploy an ERC-20 token",
    "Find the best ETH yield",
  ],
  secondary: [
    "Send 0.01 ETH",
    "Supply USDC to Aave",
    "Review token approvals",
    "Create an NFT collection",
    "Track a transaction",
  ],
};

const composer = document.querySelector("#composer");
const composerDefaultContent = document.querySelector(".composer-default-content");
const prompt = document.querySelector("#prompt");
const chatInner = document.querySelector(".chat-inner");
const chatStream = document.querySelector(".chat-stream");
const chatHistory = document.querySelector(".chat-history");
const userMessage = document.querySelector(".user-message");
const workingRow = document.querySelector(".working-row");
const thinkingSpinner = document.querySelector(".thinking-spinner");
const thinkingDots = document.querySelector(".thinking-dots");
const thinkingLetters = [...document.querySelectorAll(".thinking-letter")];
const taskCard = document.querySelector(".task-card");
const collapsedTasksHint = document.querySelector(".collapsed-tasks-hint");
const collapsedTask = document.querySelector(".request-understood");
const walletCard = document.querySelector(".wallet-card");
const walletSpinner = document.querySelector(".wallet-task-spinner");
const walletComplete = document.querySelector(".wallet-complete");
const executionPlan = document.querySelector(".composer > .execution-plan");
const executionPlanContent = executionPlan.querySelector(".execution-plan-content");
const executionPlanActions = executionPlan.querySelector(".execution-plan-actions");
const acceptPlanButton = document.querySelector(".accept-plan-button");
const planComplete = document.querySelector(".plan-complete");
const stakeCard = document.querySelector(".stake-card");
const stakeComplete = document.querySelector(".stake-complete");
const aaveCard = document.querySelector(".aave-card");
const aaveComplete = document.querySelector(".aave-complete");
const borrowCard = document.querySelector(".borrow-card");
const borrowComplete = document.querySelector(".borrow-complete");
const simulationCard = document.querySelector(".simulation-card");
const simulationSpinner = document.querySelector(".simulation-spinner");
const simulationComplete = document.querySelector(".simulation-complete");
const simulationResult = document.querySelector(".simulation-result");
const simulationResultSpinner = document.querySelector(".simulation-result-spinner");
const approvalCard = document.querySelector(".approval-card");
const approvalCardContent = document.querySelector(".approval-card-content");
const approvalCardFooter = document.querySelector(".approval-card-footer");
const approveSignButton = document.querySelector(".approve-sign-button");
let approvalActionIcon = document.querySelector(".approval-action-icon");
const approvalHint = document.querySelector(".approval-hint");
const walletSignatureModal = document.querySelector(".wallet-signature-modal");
const walletSignatureOverlay = document.querySelector(".wallet-signature-overlay");
const walletSignatureCancelButton = document.querySelector(".wallet-signature-cancel");
const walletSignatureConfirmButton = document.querySelector(".wallet-signature-confirm");
const requestPromptHint = document.querySelector(".request-prompt-hint");
const transactionSubmittedCard = document.querySelector(".transaction-submitted-card");
const transactionSubmittedSpinner = document.querySelector(".transaction-submitted-spinner");
const transactionSteps = [...document.querySelectorAll(".transaction-step")];
const transactionSuccessCard = document.querySelector(".transaction-success-card");
const transactionSuccessReceipt = document.querySelector(".transaction-success-receipt");
const transactionSuccessActions = document.querySelector(".transaction-success-actions");
const transactionCompletionSummary = document.querySelector(
  ".transaction-completion-summary",
);
const transactionCompletionSummaryText =
  "Done. You staked 5 ETH with Lido, supplied the resulting stETH to Aave as collateral, and borrowed 1,000 USDC. Your Aave position is now active with a 10.72 health factor and a 4.40% borrow rate.";
const transactionCompletionSummaryWords = transactionCompletionSummaryText
  .split(" ")
  .map((word, index, words) => {
    const span = document.createElement("span");
    span.className = "transaction-completion-summary-word";
    span.textContent = `${word}${index === words.length - 1 ? "" : " "}`;
    transactionCompletionSummary.append(span);
    return span;
  });
const pauseControls = [...document.querySelectorAll(".task-pause-control")];
const progressStages = [
  {
    card: stakeCard,
    complete: stakeComplete,
    spinner: stakeCard.querySelector(".progress-spinner"),
  },
  {
    card: aaveCard,
    complete: aaveComplete,
    spinner: aaveCard.querySelector(".progress-spinner"),
  },
  {
    card: borrowCard,
    complete: borrowComplete,
    spinner: borrowCard.querySelector(".progress-spinner"),
  },
];
const historyItems = [...document.querySelectorAll("[data-history-target]")].map(
  (toggle) => ({
    toggle,
    detail: document.getElementById(toggle.dataset.historyTarget),
    label: document
      .getElementById(toggle.dataset.historyTarget)
      .getAttribute("aria-label"),
    historyLabel:
      document.getElementById(toggle.dataset.historyTarget).dataset.historyLabel ||
      document
        .getElementById(toggle.dataset.historyTarget)
        .getAttribute("aria-label"),
  }),
);
const sendButton = document.querySelector(".send-button");
const sendButtonLabel = sendButton.querySelector("span");
const sendButtonIcon = sendButton.querySelector("img");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const mobileViewport = window.matchMedia("(max-width: 640px)");
const appShell = document.querySelector(".app-shell");

function syncMobileViewport() {
  const viewport = window.visualViewport;
  if (mobileViewport.matches && viewport && viewport.scale === 1) {
    appShell.style.height = `${viewport.height}px`;
    if (document.activeElement === prompt) {
      // Keep the whole composer, including Send, inside the resized home scroller.
      composer.scrollIntoView({ block: "nearest", behavior: "instant" });
    }
  } else {
    appShell.style.removeProperty("height");
  }
}
window.visualViewport?.addEventListener("resize", syncMobileViewport);
window.addEventListener("resize", syncMobileViewport);
syncMobileViewport();

const defaultMotionValues = {
  composerMovement: {
    transition: {
      type: "easing",
      duration: 0.25,
      ease: [0.02, 0.08, 0, 0.98],
    },
  },
  responseEntrance: {
    delay: 0.2,
    transition: {
      type: "easing",
      duration: 0.5,
      ease: [0.23, 1, 0.32, 1],
    },
    blur: 4,
    scale: 0.9,
  },
  understandRequest: {
    delay: 0.5,
  },
  understandCollapse: {
    delay: 0.5,
    transition: {
      type: "easing",
      duration: 0.2,
      ease: [0.23, 1, 0.32, 1],
    },
    blur: 6,
    scale: 0.9,
  },
  executionPlanMorph: {
    transition: {
      type: "easing",
      duration: 0.45,
      ease: [0.77, 0, 0.175, 1],
    },
    blur: 2,
    contentDelay: 0.1,
    buttonsDelay: 0.3,
  },
  transactionSuccess: {
    wait: 1,
    transition: {
      type: "easing",
      duration: 0.2,
      ease: [0.23, 1, 0.32, 1],
    },
    receipt: {
      type: "easing",
      duration: 0.4,
      ease: [0.75, 0.74, 0.53, 0.52],
    },
    actionsDelay: 0.35,
    actionsBlur: 12,
    summary: {
      delay: 1,
      stagger: 0.04,
      startingOpacity: 0,
      transition: {
        type: "spring",
        stiffness: 161,
        damping: 20,
        mass: 2.6,
      },
    },
  },
  thinking: {
    entranceDuration: 0.2,
    dotsInterval: 0.69,
    pulse: {
      minOpacity: 0.1,
      duration: 1.7,
      stagger: 0.09,
    },
    spinner: {
      rotation: 720,
      transition: {
        type: "easing",
        duration: 2.4,
        ease: [0.17, 0.17, 0.83, 0.83],
      },
    },
  },
};

const motionValues = defaultMotionValues;
let composerAnimation;
let responseAnimation;
let taskAnimation;
let taskCollapseAnimation;
let collapsedTaskAnimation;
let collapsedTasksHintAnimation;
const taskHistoryAnimations = new Map();
let walletAnimation;
let walletCollapseAnimation;
let walletCompleteAnimation;
let executionPlanAnimation;
let composerContentAnimation;
let executionPlanContentAnimation;
let executionPlanActionsAnimation;
let planCollapseAnimation;
let planCompleteAnimation;
let simulationAnimation;
let simulationCollapseAnimation;
let simulationCompleteAnimation;
let simulationResultAnimation;
let simulationResultCollapseAnimation;
let spinnerAnimation;
let walletSpinnerAnimation;
let simulationSpinnerAnimation;
let simulationResultSpinnerAnimation;
let approvalSpinnerAnimation;
let approvalWalletAnimation;
let approvalIdleHeight;
let walletSignatureAnimation;
let walletSignatureBackdropAnimation;
let transactionSubmittedAnimation;
let transactionSubmittedSpinnerAnimation;
let transactionSuccessExitAnimation;
let transactionSuccessEnterAnimation;
let transactionSuccessReceiptAnimation;
let transactionSuccessActionsAnimation;
let transactionCompletionSummaryAnimations = [];
let transactionCompletionSummaryTimer;
let transactionSuccessTimer;
let thinkingEntranceAnimation;
let letterAnimations = [];
let progressAnimations = [];
let progressSpinnerAnimations = [];
let blueBoxHoldTimers = [];
let activeHold;
let activePauseContext;
let executionPaused = false;
let pauseControlAnimation;
let taskRevealTimer;
let dotsTimer;
let sequenceId = 0;
let executionStarted = false;
let approvalStarted = false;

function stopChatAnimations() {
  sequenceId += 1;
  composerAnimation?.stop();
  responseAnimation?.stop();
  taskAnimation?.stop();
  taskCollapseAnimation?.stop();
  collapsedTaskAnimation?.stop();
  collapsedTasksHintAnimation?.stop();
  taskHistoryAnimations.forEach((animation) => animation?.stop());
  taskHistoryAnimations.clear();
  walletAnimation?.stop();
  walletCollapseAnimation?.stop();
  walletCompleteAnimation?.stop();
  executionPlanAnimation?.stop();
  composerContentAnimation?.stop();
  executionPlanContentAnimation?.stop();
  executionPlanActionsAnimation?.stop();
  planCollapseAnimation?.stop();
  planCompleteAnimation?.stop();
  simulationAnimation?.stop();
  simulationCollapseAnimation?.stop();
  simulationCompleteAnimation?.stop();
  simulationResultAnimation?.stop();
  simulationResultCollapseAnimation?.stop();
  spinnerAnimation?.stop();
  walletSpinnerAnimation?.stop();
  simulationSpinnerAnimation?.stop();
  simulationResultSpinnerAnimation?.stop();
  approvalSpinnerAnimation?.stop();
  approvalWalletAnimation?.stop();
  walletSignatureAnimation?.stop();
  walletSignatureBackdropAnimation?.stop();
  transactionSubmittedAnimation?.stop();
  transactionSubmittedSpinnerAnimation?.stop();
  transactionSuccessExitAnimation?.stop();
  transactionSuccessEnterAnimation?.stop();
  transactionSuccessReceiptAnimation?.stop();
  transactionSuccessActionsAnimation?.stop();
  transactionCompletionSummaryAnimations.forEach((animation) => animation.stop());
  thinkingEntranceAnimation?.stop();
  pauseControlAnimation?.stop();
  letterAnimations.forEach((animation) => animation.stop());
  progressAnimations.forEach((animation) => animation.stop());
  progressSpinnerAnimations.forEach((animation) => animation.stop());
  blueBoxHoldTimers.forEach((timer) => window.clearTimeout(timer));
  if (activeHold?.timer) window.clearTimeout(activeHold.timer);
  window.clearTimeout(transactionSuccessTimer);
  window.clearTimeout(transactionCompletionSummaryTimer);
  window.clearTimeout(taskRevealTimer);
  window.clearInterval(dotsTimer);
  composerAnimation = undefined;
  responseAnimation = undefined;
  taskAnimation = undefined;
  taskCollapseAnimation = undefined;
  collapsedTaskAnimation = undefined;
  collapsedTasksHintAnimation = undefined;
  walletAnimation = undefined;
  walletCollapseAnimation = undefined;
  walletCompleteAnimation = undefined;
  executionPlanAnimation = undefined;
  composerContentAnimation = undefined;
  executionPlanContentAnimation = undefined;
  executionPlanActionsAnimation = undefined;
  planCollapseAnimation = undefined;
  planCompleteAnimation = undefined;
  simulationAnimation = undefined;
  simulationCollapseAnimation = undefined;
  simulationCompleteAnimation = undefined;
  simulationResultAnimation = undefined;
  simulationResultCollapseAnimation = undefined;
  spinnerAnimation = undefined;
  walletSpinnerAnimation = undefined;
  simulationSpinnerAnimation = undefined;
  simulationResultSpinnerAnimation = undefined;
  approvalSpinnerAnimation = undefined;
  approvalWalletAnimation = undefined;
  approvalIdleHeight = undefined;
  transactionSubmittedAnimation = undefined;
  transactionSubmittedSpinnerAnimation = undefined;
  transactionSuccessExitAnimation = undefined;
  transactionSuccessEnterAnimation = undefined;
  transactionSuccessReceiptAnimation = undefined;
  transactionSuccessActionsAnimation = undefined;
  transactionCompletionSummaryAnimations = [];
  transactionCompletionSummaryTimer = undefined;
  transactionSuccessTimer = undefined;
  thinkingEntranceAnimation = undefined;
  letterAnimations = [];
  progressAnimations = [];
  progressSpinnerAnimations = [];
  blueBoxHoldTimers = [];
  activeHold = undefined;
  activePauseContext = undefined;
  executionPaused = false;
  pauseControlAnimation = undefined;
  pauseControls.forEach((control) => setPauseControlState(control, false));
  taskRevealTimer = undefined;
  dotsTimer = undefined;
}

function toMotionTransition(transition, delay = 0) {
  if (transition.type === "spring") {
    return { ...transition, delay };
  }

  return {
    duration: transition.duration,
    ease: transition.ease,
    delay,
  };
}

function createSuggestionGroup(labels) {
  const group = document.createElement("div");
  group.className = "suggestion-group";

  labels.forEach((label, index) => {
    const card = document.createElement("span");
    card.className = "suggestion";

    const icon = document.createElement("img");
    icon.src = `/design-sync/shell-1/assets/cursorclick-${(index % 3) + 2}.svg`;
    icon.alt = "";

    card.append(icon, document.createTextNode(label));
    group.append(card);
  });

  return group;
}

Object.entries(suggestionRows).forEach(([rowName, labels]) => {
  const row = document.querySelector(`[data-suggestion-row="${rowName}"]`);
  const track = document.createElement("div");
  const group = createSuggestionGroup(labels);

  track.className = "suggestion-track";
  track.append(group, group.cloneNode(true));
  row.append(track);
});

function syncComposer() {
  const hasValue = prompt.value.trim().length > 0;
  composer.classList.toggle("has-value", hasValue);

  prompt.classList.remove("is-multiline");
  prompt.style.height = "48px";
  const isMultiline = prompt.scrollHeight > 48;
  prompt.classList.toggle("is-multiline", isMultiline);

  prompt.style.height = "48px";
  const nextHeight = Math.min(144, Math.max(48, prompt.scrollHeight));
  prompt.style.height = `${nextHeight}px`;
  prompt.style.overflowY = prompt.scrollHeight > 144 ? "auto" : "hidden";
}

function syncChatFade() {
  const fadeHeight = 40;
  const hasOverflowAbove = chatHistory.scrollTop > 1;
  const hasOverflowBelow =
    chatHistory.scrollTop + chatHistory.clientHeight <
    chatHistory.scrollHeight - 1;

  if (!hasOverflowAbove && !hasOverflowBelow) {
    chatHistory.style.removeProperty("mask-image");
    return;
  }

  const topStops = hasOverflowAbove
    ? `transparent 0, black ${fadeHeight}px`
    : "black 0";
  const bottomStops = hasOverflowBelow
    ? `black calc(100% - ${fadeHeight}px), transparent 100%`
    : "black 100%";
  const mask = `linear-gradient(to bottom, ${topStops}, ${bottomStops})`;

  if (chatHistory.style.maskImage !== mask) {
    chatHistory.style.maskImage = mask;
  }
}

// Native smooth scrolling keeps the receipt and summary in the same scroll
// coordinate system; no height animation or competing transform is needed.
function scrollConversationToLatest({ smooth = false } = {}) {
  requestAnimationFrame(() => {
    chatHistory.scrollTo({
      top: chatHistory.scrollHeight,
      behavior: smooth && !reduceMotion.matches ? "smooth" : "instant",
    });
    syncChatFade();
  });
}

function clearEntranceStyles(element) {
  element.style.removeProperty("opacity");
  element.style.removeProperty("transform");
}

function setHistoryCopy(item, completed) {
  item.detail.querySelectorAll("[data-history-text]").forEach((element) => {
    if (!element.dataset.liveText) element.dataset.liveText = element.textContent;
    element.textContent = completed
      ? element.dataset.historyText
      : element.dataset.liveText;
  });
}

function resetTaskHistory({ showHint = false } = {}) {
  taskHistoryAnimations.forEach((animation) => animation?.stop());
  taskHistoryAnimations.clear();
  historyItems.forEach(({ toggle, detail, label }) => {
    if (detail.classList.contains("history-detail-card")) {
      detail.hidden = true;
      toggle.hidden = false;
    }
    detail.classList.remove("history-detail-card");
    detail.removeAttribute("role");
    detail.removeAttribute("tabindex");
    detail.setAttribute("aria-label", label);
    setHistoryCopy({ detail }, false);
    toggle.setAttribute("aria-expanded", "false");
    clearEntranceStyles(detail);
    clearEntranceStyles(toggle);
  });
  collapsedTasksHint.hidden = !showHint;
  clearEntranceStyles(collapsedTasksHint);
}

// Card surfaces have explicit keyframes; start them synchronously instead of
// waiting for Motion's asynchronous keyframe resolution. Keep opacity and
// transform in one native animation so their first/last frames are atomic.
const surfaceAnimations = new WeakMap();

function animateSurface(element, keyframes, transition) {
  const previous = surfaceAnimations.get(element);
  if (previous) {
    // Retarget a rapid interaction from the frame currently on screen.
    const current = getComputedStyle(element);
    for (const property of Object.keys(keyframes)) {
      keyframes[property] = [current[property], keyframes[property].at(-1)];
    }
    previous.stop();
  }

  for (const [property, values] of Object.entries(keyframes)) {
    element.style[property] = values[0];
  }
  const animation = element.animate(keyframes, {
    duration: transition.duration * 1000,
    delay: (transition.delay || 0) * 1000,
    easing: `cubic-bezier(${transition.ease.join(",")})`,
    fill: "both",
  });
  let stopped = false;
  let completed = false;
  const finished = animation.finished.then(() => {
    if (stopped) return;
    completed = true;
    // Write the final frame BEFORE removing the fill effect. Exits remain
    // invisible until their owner hides them; delayed entrances never flash.
    for (const [property, values] of Object.entries(keyframes)) {
      element.style[property] = values.at(-1);
    }
    animation.cancel();
    surfaceAnimations.delete(element);
  }, () => {});
  const controls = {
    then(resolve, reject) {
      return finished.then(() => { if (!stopped) return resolve?.(); }, reject);
    },
    stop() {
      if (stopped || completed) return;
      stopped = true;
      // Snapshot all properties before writing any of them.
      const current = getComputedStyle(element);
      const styles = Object.fromEntries(Object.keys(keyframes).map(
        property => [property, current[property]],
      ));
      Object.assign(element.style, styles);
      animation.cancel();
      surfaceAnimations.delete(element);
    },
  };
  surfaceAnimations.set(element, controls);
  return controls;
}

function animateHistoryElement(element, opening) {
  if (!window.Motion) return undefined;

  const config = opening
    ? motionValues.responseEntrance
    : motionValues.understandCollapse;
  return animateSurface(
    element,
    reduceMotion.matches
      ? { opacity: opening ? [0, 1] : [1, 0] }
      : {
          opacity: opening ? [0, 1] : [1, 0],
          transform: opening
            ? [`scale(${config.scale})`, "scale(1)"]
            : ["scale(1)", `scale(${config.scale})`],
        },
    reduceMotion.matches
      ? { duration: 0.15, ease: [0.23, 1, 0.32, 1] }
      : toMotionTransition(config.transition),
  );
}

function expandHistoryItem(item) {
  const { toggle, detail, historyLabel } = item;
  if (toggle.hidden || !detail.hidden) return;

  taskHistoryAnimations.get(detail)?.stop();
  toggle.hidden = true;
  toggle.setAttribute("aria-expanded", "true");
  detail.hidden = false;
  detail.classList.add("history-detail-card");
  detail.setAttribute("role", "button");
  detail.setAttribute("tabindex", "0");
  detail.setAttribute("aria-label", `${historyLabel} — tap to collapse`);
  setHistoryCopy(item, true);
  detail
    .querySelectorAll(
      ".wallet-task-spinner, .progress-spinner, .simulation-result-spinner",
    )
    .forEach((spinner) => spinner.style.removeProperty("transform"));
  clearEntranceStyles(detail);
  taskHistoryAnimations.set(detail, animateHistoryElement(detail, true));
  requestAnimationFrame(syncChatFade);
}

function collapseHistoryItem(item) {
  const { toggle, detail, label } = item;
  if (!detail.classList.contains("history-detail-card") ||
      toggle.getAttribute("aria-expanded") !== "true") return;
  toggle.setAttribute("aria-expanded", "false");

  const collapseAnimation = animateHistoryElement(detail, false);
  taskHistoryAnimations.set(detail, collapseAnimation);

  const finish = () => {
    detail.hidden = true;
    detail.classList.remove("history-detail-card");
    detail.removeAttribute("role");
    detail.removeAttribute("tabindex");
    detail.setAttribute("aria-label", label);
    setHistoryCopy(item, false);
    clearEntranceStyles(detail);
    toggle.hidden = false;
    toggle.setAttribute("aria-expanded", "false");
    clearEntranceStyles(toggle);
    taskHistoryAnimations.delete(detail);
    requestAnimationFrame(syncChatFade);
  };

  if (collapseAnimation) collapseAnimation.then(finish);
  else finish();
}

function animateEntrance(element, delay = 0) {
  clearEntranceStyles(element);

  if (!window.Motion) {
    element.style.opacity = "1";
    return undefined;
  }

  if (reduceMotion.matches) {
    return animateSurface(
      element,
      { opacity: [0, 1] },
      { duration: 0.15, ease: [0.23, 1, 0.32, 1], delay },
    );
  }

  return animateSurface(
    element,
    {
      opacity: [0, 1],
      transform: [
        `scale(${motionValues.responseEntrance.scale})`,
        "scale(1)",
      ],
    },
    toMotionTransition(motionValues.responseEntrance.transition, delay),
  );
}

function animateExit(element, config = motionValues.understandCollapse) {
  clearEntranceStyles(element);

  if (!window.Motion) {
    element.style.opacity = "0";
    return undefined;
  }

  if (reduceMotion.matches) {
    return animateSurface(
      element,
      { opacity: [1, 0] },
      {
        duration: 0.15,
        ease: [0.23, 1, 0.32, 1],
        delay: config.delay,
      },
    );
  }

  return animateSurface(
    element,
    {
      opacity: [1, 0],
      transform: [
        "scale(1)",
        `scale(${config.scale})`,
      ],
    },
    toMotionTransition(config.transition, config.delay),
  );
}

function startThinkingMotion() {
  spinnerAnimation?.stop();
  letterAnimations.forEach((animation) => animation.stop());
  letterAnimations = [];
  window.clearInterval(dotsTimer);

  if (reduceMotion.matches || !window.Motion) {
    thinkingSpinner.style.removeProperty("transform");
    thinkingLetters.forEach((letter) => letter.style.removeProperty("opacity"));
    thinkingDots.textContent = "...";
    return;
  }

  spinnerAnimation = window.Motion.animate(
    thinkingSpinner,
    {
      transform: [
        "rotate(0deg)",
        `rotate(${motionValues.thinking.spinner.rotation}deg)`,
      ],
    },
    {
      ...toMotionTransition(motionValues.thinking.spinner.transition),
      repeat: Infinity,
      repeatType: "loop",
    },
  );

  letterAnimations = thinkingLetters.map((letter, index) => window.Motion.animate(
    letter,
    { opacity: [1, motionValues.thinking.pulse.minOpacity, 1] },
    {
      duration: motionValues.thinking.pulse.duration,
      ease: [0.45, 0, 0.55, 1],
      delay: index * motionValues.thinking.pulse.stagger,
      repeat: Infinity,
      repeatType: "loop",
    },
  ));

  if (!thinkingDots.hidden) {
    const dotFrames = [".", "..", "...", ".."];
    let dotFrame = 0;
    thinkingDots.textContent = dotFrames[dotFrame];
    dotsTimer = window.setInterval(() => {
      dotFrame = (dotFrame + 1) % dotFrames.length;
      thinkingDots.textContent = dotFrames[dotFrame];
    }, motionValues.thinking.dotsInterval * 1000);
  }
}

function startWalletSpinnerMotion() {
  walletSpinnerAnimation?.stop();

  if (reduceMotion.matches || !window.Motion) {
    walletSpinner.style.removeProperty("transform");
    return;
  }

  walletSpinnerAnimation = window.Motion.animate(
    walletSpinner,
    {
      transform: [
        "rotate(0deg)",
        `rotate(${motionValues.thinking.spinner.rotation}deg)`,
      ],
    },
    {
      ...toMotionTransition(motionValues.thinking.spinner.transition),
      repeat: Infinity,
      repeatType: "loop",
    },
  );
}

function startProgressSpinnerMotion(spinner) {
  if (reduceMotion.matches || !window.Motion) {
    spinner.style.removeProperty("transform");
    return undefined;
  }

  const animation = window.Motion.animate(
    spinner,
    {
      transform: [
        "rotate(0deg)",
        `rotate(${motionValues.thinking.spinner.rotation}deg)`,
      ],
    },
    {
      ...toMotionTransition(motionValues.thinking.spinner.transition),
      repeat: Infinity,
      repeatType: "loop",
    },
  );
  progressSpinnerAnimations.push(animation);
  return animation;
}

function setPauseControlState(control, paused, { animate = false } = {}) {
  const label = control.querySelector("span");
  const icon = control.querySelector("img");
  const card = control.closest(".task-card, .wallet-card, .progress-card");
  if (card && !card.querySelector(":scope > .paused-task-border")) {
    const border = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    border.classList.add("paused-task-border");
    border.setAttribute("aria-hidden", "true");
    border.setAttribute("preserveAspectRatio", "none");
    const outline = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    border.append(outline);
    card.append(border);
  }
  card?.classList.toggle("task-is-paused", paused);
  control.classList.toggle("is-paused", paused);
  control.setAttribute("aria-label", paused ? "Continue task" : "Pause task");
  label.hidden = !paused;
  icon.src = paused
    ? "/design-sync/paused-and-continue-state/assets/play.svg"
    : "/design-sync/paused-and-continue-state/assets/pause.svg";

  if (!animate || !window.Motion) return;
  pauseControlAnimation?.stop();
  pauseControlAnimation = window.Motion.animate(
    control,
    reduceMotion.matches
      ? { opacity: [0.6, 1] }
      : { opacity: [0.6, 1], transform: ["scale(0.96)", "scale(1)"] },
    {
      duration: reduceMotion.matches ? 0.15 : 0.16,
      ease: [0.23, 1, 0.32, 1],
    },
  );
}

function activatePauseControl(card, motion) {
  const control = card.querySelector(".task-pause-control");
  activePauseContext = { card, control, ...motion };
  executionPaused = false;
  setPauseControlState(control, false);
}

function deactivatePauseControl(card) {
  if (activePauseContext?.card !== card) return;
  setPauseControlState(activePauseContext.control, false);
  activePauseContext = undefined;
  executionPaused = false;
}

function pauseThinkingMotion() {
  spinnerAnimation?.stop();
  letterAnimations.forEach((animation) => animation.stop());
  window.clearInterval(dotsTimer);
}

function scheduleActiveHold() {
  if (!activeHold || executionPaused) return;
  activeHold.startedAt = performance.now();
  activeHold.timer = window.setTimeout(() => {
    const callback = activeHold?.callback;
    activeHold = undefined;
    callback?.();
  }, activeHold.remaining);
  blueBoxHoldTimers.push(activeHold.timer);
}

function holdBlueBox(callback) {
  if (activeHold?.timer) window.clearTimeout(activeHold.timer);
  activeHold = { callback, remaining: 1500, timer: undefined, startedAt: 0 };
  scheduleActiveHold();
}

function pauseCurrentTask() {
  if (!activePauseContext || executionPaused) return;
  executionPaused = true;
  if (activeHold?.timer) {
    window.clearTimeout(activeHold.timer);
    activeHold.remaining = Math.max(
      0,
      activeHold.remaining - (performance.now() - activeHold.startedAt),
    );
    activeHold.timer = undefined;
  }
  activePauseContext.pauseMotion?.();
  setPauseControlState(activePauseContext.control, true, { animate: true });
}

function continueCurrentTask() {
  if (!activePauseContext || !executionPaused) return;
  executionPaused = false;
  activePauseContext.resumeMotion?.();
  setPauseControlState(activePauseContext.control, false, { animate: true });
  scheduleActiveHold();
}

function hideWorkingIndicator() {
  spinnerAnimation?.stop();
  letterAnimations.forEach((animation) => animation.stop());
  letterAnimations = [];
  workingRow.hidden = true;
  workingRow.style.removeProperty("opacity");
}

function clearComposerPanelMorphStyles(panel, panelContent, panelActions) {
  composer.style.removeProperty("height");
  composerDefaultContent.style.removeProperty("opacity");
  composerDefaultContent.style.removeProperty("filter");
  panel.style.removeProperty("opacity");
  panelContent.style.removeProperty("opacity");
  panelContent.style.removeProperty("filter");
  panelActions.style.removeProperty("opacity");
  panelActions.style.removeProperty("filter");
}

function resetComposerPanel(panel, panelContent, panelActions) {
  composer.classList.remove("is-panel");
  panel.hidden = true;
  clearComposerPanelMorphStyles(panel, panelContent, panelActions);
}

function resetExecutionPlanMorph() {
  resetComposerPanel(
    executionPlan,
    executionPlanContent,
    executionPlanActions,
  );
}

function resetApprovalMorph() {
  resetComposerPanel(approvalCard, approvalCardContent, approvalCardFooter);
}

function replaceApprovalActionIcon(src, { spinning = false } = {}) {
  const nextIcon = approvalActionIcon.cloneNode(false);
  nextIcon.src = src;
  nextIcon.classList.toggle("is-spinning", spinning);
  if (spinning) nextIcon.style.removeProperty("transform");
  else nextIcon.style.transform = "none";
  approvalActionIcon.replaceWith(nextIcon);
  approvalActionIcon = nextIcon;
  return nextIcon;
}

function resetApprovalState() {
  approvalSpinnerAnimation?.stop();
  approvalWalletAnimation?.stop();
  approvalSpinnerAnimation = undefined;
  approvalWalletAnimation = undefined;
  approvalIdleHeight = undefined;
  closeWalletSignatureModal({ animate: false });
  approvalCard.classList.remove("is-awaiting-wallet");
  approvalHint.hidden = true;
  approveSignButton.disabled = false;
  approveSignButton.removeAttribute("aria-busy");
  replaceApprovalActionIcon(
    "/design-sync/transaction-ready-for-approval/assets/paperplane.svg",
  );
}

function closeWalletSignatureModal({ animate = false } = {}) {
  walletSignatureAnimation?.stop();
  walletSignatureBackdropAnimation?.stop();
  walletSignatureAnimation = undefined;
  walletSignatureBackdropAnimation = undefined;

  const finish = () => {
    walletSignatureModal.hidden = true;
    walletSignatureOverlay.hidden = true;
    walletSignatureModal.style.removeProperty("opacity");
    walletSignatureModal.style.removeProperty("transform");
    walletSignatureOverlay.style.removeProperty("opacity");
  };

  if (!animate || walletSignatureModal.hidden || !window.Motion) {
    finish();
    return Promise.resolve();
  }

  walletSignatureBackdropAnimation = window.Motion.animate(
    walletSignatureOverlay,
    { opacity: [1, 0] },
    { duration: reduceMotion.matches ? 0.15 : 0.16, ease: [0.23, 1, 0.32, 1] },
  );
  walletSignatureAnimation = window.Motion.animate(
    walletSignatureModal,
    reduceMotion.matches
      ? { opacity: [1, 0] }
      : {
          opacity: [1, 0],
          transform: [
            "translate3d(-50%, -50%, 0) scale(1)",
            "translate3d(-50%, -49%, 0) scale(0.98)",
          ],
        },
    { duration: reduceMotion.matches ? 0.15 : 0.16, ease: [0.23, 1, 0.32, 1] },
  );

  return Promise.all([walletSignatureBackdropAnimation, walletSignatureAnimation]).then(finish);
}

function showWalletSignatureModal() {
  walletSignatureOverlay.hidden = false;
  walletSignatureModal.hidden = false;

  if (!window.Motion) return;
  walletSignatureBackdropAnimation = window.Motion.animate(
    walletSignatureOverlay,
    { opacity: [0, 1] },
    { duration: reduceMotion.matches ? 0.15 : 0.2, ease: [0.23, 1, 0.32, 1] },
  );
  walletSignatureAnimation = window.Motion.animate(
    walletSignatureModal,
    reduceMotion.matches
      ? { opacity: [0, 1] }
      : {
          opacity: [0, 1],
          transform: [
            "translate3d(-50%, -49%, 0) scale(0.98)",
            "translate3d(-50%, -50%, 0) scale(1)",
          ],
        },
    {
      duration: reduceMotion.matches ? 0.15 : 0.2,
      ease: [0.23, 1, 0.32, 1],
    },
  );
}

function resetTransactionSubmitted() {
  transactionSubmittedSpinnerAnimation?.stop();
  transactionSubmittedCard.hidden = true;
  transactionSubmittedCard.classList.remove("is-complete");
  transactionSubmittedSpinner.hidden = false;
  transactionSubmittedSpinner.style.removeProperty("transform");
  clearEntranceStyles(transactionSubmittedCard);

  transactionSteps.forEach((step) => {
    step.classList.remove("is-active", "is-complete");
    step.querySelector(".transaction-step-icon").src =
      "/design-sync/transaction-submitted/assets/radiobutton-2.svg";
    step.removeAttribute("data-status");
    clearEntranceStyles(step);
  });
}

function resetTransactionSuccess() {
  window.clearTimeout(transactionSuccessTimer);
  window.clearTimeout(transactionCompletionSummaryTimer);
  transactionSuccessTimer = undefined;
  transactionCompletionSummaryTimer = undefined;
  transactionSuccessExitAnimation?.stop();
  transactionSuccessEnterAnimation?.stop();
  transactionSuccessReceiptAnimation?.stop();
  transactionSuccessActionsAnimation?.stop();
  transactionCompletionSummaryAnimations.forEach((animation) => animation.stop());
  transactionSuccessExitAnimation = undefined;
  transactionSuccessEnterAnimation = undefined;
  transactionSuccessReceiptAnimation = undefined;
  transactionSuccessActionsAnimation = undefined;
  transactionCompletionSummaryAnimations = [];
  transactionSuccessCard.hidden = true;
  transactionCompletionSummary.hidden = true;
  transactionCompletionSummary.style.removeProperty("opacity");
  transactionCompletionSummaryWords.forEach((word) =>
    word.style.removeProperty("opacity"),
  );
  clearEntranceStyles(transactionSuccessCard);
  clearEntranceStyles(transactionSuccessReceipt);
  clearEntranceStyles(transactionSuccessActions);
}

function showTransactionCompletionSummary(
  activeSequence,
  { animate = true } = {},
) {
  if (activeSequence !== sequenceId) return;

  transactionCompletionSummaryAnimations.forEach((animation) => animation.stop());
  transactionCompletionSummaryAnimations = [];
  transactionCompletionSummary.style.removeProperty("opacity");

  if (!animate || !window.Motion) {
    transactionCompletionSummaryWords.forEach((word) => {
      word.style.opacity = "1";
    });
    transactionCompletionSummary.hidden = false;
    scrollConversationToLatest();
    return;
  }

  if (reduceMotion.matches) {
    transactionCompletionSummaryWords.forEach((word) => {
      word.style.opacity = "1";
    });
    transactionCompletionSummary.style.opacity = "0";
    transactionCompletionSummary.hidden = false;
    transactionCompletionSummaryAnimations = [
      window.Motion.animate(
        transactionCompletionSummary,
        { opacity: [0, 1] },
        { duration: 0.15, ease: [0.23, 1, 0.32, 1] },
      ),
    ];
    scrollConversationToLatest();
    return;
  }

  transactionCompletionSummaryWords.forEach((word) => {
    word.style.opacity = String(
      motionValues.transactionSuccess.summary.startingOpacity,
    );
  });
  transactionCompletionSummary.hidden = false;
  scrollConversationToLatest({ smooth: mobileViewport.matches });

  transactionCompletionSummaryAnimations =
    transactionCompletionSummaryWords.map((word, index) =>
      window.Motion.animate(
        word,
        {
          opacity: [
            motionValues.transactionSuccess.summary.startingOpacity,
            1,
          ],
        },
        toMotionTransition(
          motionValues.transactionSuccess.summary.transition,
          index * motionValues.transactionSuccess.summary.stagger,
        ),
      ),
    );
}

function scheduleTransactionCompletionSummary(
  activeSequence,
  { animate = true } = {},
) {
  window.clearTimeout(transactionCompletionSummaryTimer);
  transactionCompletionSummaryTimer = window.setTimeout(() => {
    transactionCompletionSummaryTimer = undefined;
    showTransactionCompletionSummary(activeSequence, { animate });
  }, motionValues.transactionSuccess.summary.delay * 1000);
}

function replayTransactionCompletionSummary() {
  if (transactionSuccessCard.hidden) return;
  window.clearTimeout(transactionCompletionSummaryTimer);
  transactionCompletionSummaryAnimations.forEach((animation) => animation.stop());
  transactionCompletionSummaryAnimations = [];
  transactionCompletionSummary.hidden = true;
  transactionCompletionSummary.style.removeProperty("opacity");
  transactionCompletionSummaryWords.forEach((word) =>
    word.style.removeProperty("opacity"),
  );
  scheduleTransactionCompletionSummary(sequenceId, { animate: true });
}

function resetPostPlanState() {
  executionStarted = false;
  approvalStarted = false;
  resetExecutionPlanMorph();
  resetApprovalMorph();
  resetApprovalState();
  resetTransactionSubmitted();
  resetTransactionSuccess();
  requestPromptHint.hidden = true;
  planComplete.hidden = true;
  simulationCard.hidden = true;
  simulationComplete.hidden = true;
  simulationResult.hidden = true;
  clearEntranceStyles(planComplete);
  clearEntranceStyles(simulationCard);
  clearEntranceStyles(simulationComplete);
  clearEntranceStyles(simulationResult);
  simulationSpinner.style.removeProperty("transform");
  simulationResultSpinner.style.removeProperty("transform");

  progressStages.forEach((stage) => {
    stage.card.hidden = true;
    stage.complete.hidden = true;
    clearEntranceStyles(stage.card);
    clearEntranceStyles(stage.complete);
    stage.spinner.style.removeProperty("transform");
  });
}

function measurePanelHeight(panel, panelContent, panelActions) {
  const panelStyles = window.getComputedStyle(panel);
  const panelGap = Number.parseFloat(panelStyles.rowGap || panelStyles.gap) || 0;
  const paddingTop = Number.parseFloat(panelStyles.paddingTop) || 0;
  const paddingBottom = Number.parseFloat(panelStyles.paddingBottom) || 0;

  return Math.ceil(
    paddingTop
      + panelContent.getBoundingClientRect().height
      + panelGap
      + panelActions.getBoundingClientRect().height
      + paddingBottom,
  );
}

function morphComposerToPanel(
  activeSequence,
  panel,
  panelContent,
  panelActions,
  { animate = true } = {},
) {
  if (activeSequence !== sequenceId) return undefined;

  const startHeight = composer.getBoundingClientRect().height;
  const shouldAnimate = animate && Boolean(window.Motion);

  composer.style.height = `${startHeight}px`;
  if (shouldAnimate) {
    panel.style.opacity = "0";
  }

  panel.hidden = false;
  composer.classList.add("is-panel");
  const targetHeight = measurePanelHeight(panel, panelContent, panelActions);

  if (!shouldAnimate) {
    composer.style.height = `${targetHeight}px`;
    composerDefaultContent.style.opacity = "0";
    panel.style.opacity = "1";
    return undefined;
  }

  const config = motionValues.executionPlanMorph;
  const transition = toMotionTransition(config.transition);

  if (reduceMotion.matches) {
    composer.style.height = `${targetHeight}px`;
    composerContentAnimation = window.Motion.animate(
      composerDefaultContent,
      { opacity: [1, 0] },
      { duration: 0.15, ease: [0.23, 1, 0.32, 1] },
    );
    executionPlanContentAnimation = window.Motion.animate(
      panel,
      { opacity: [0, 1] },
      { duration: 0.15, ease: [0.23, 1, 0.32, 1] },
    );
    executionPlanActionsAnimation = undefined;
    return Promise.all([
      composerContentAnimation,
      executionPlanContentAnimation,
    ]);
  }

  executionPlanAnimation = window.Motion.animate(
    composer,
    { height: [`${startHeight}px`, `${targetHeight}px`] },
    transition,
  );
  composerContentAnimation = window.Motion.animate(
    composerDefaultContent,
    { opacity: [1, 0] },
    transition,
  );
  executionPlanContentAnimation = window.Motion.animate(
    panel,
    { opacity: [0, 1] },
    toMotionTransition(config.transition, config.contentDelay),
  );
  executionPlanActionsAnimation = undefined;

  return Promise.all([
    executionPlanAnimation,
    composerContentAnimation,
    executionPlanContentAnimation,
  ]);
}

function morphPanelToComposer(
  activeSequence,
  panelContent,
  panelActions,
) {
  if (activeSequence !== sequenceId) return undefined;

  const panel = panelContent.closest(".composer-panel");
  const startHeight = composer.getBoundingClientRect().height;
  const targetHeight = composerDefaultContent.scrollHeight;

  if (!window.Motion) {
    composer.style.height = `${targetHeight}px`;
    composerDefaultContent.style.opacity = "1";
    panel.style.opacity = "0";
    return undefined;
  }

  const config = motionValues.executionPlanMorph;
  const transition = reduceMotion.matches
    ? { duration: 0.15, ease: [0.23, 1, 0.32, 1] }
    : toMotionTransition(config.transition);

  if (reduceMotion.matches) composer.style.height = `${targetHeight}px`;
  else {
    planCollapseAnimation = window.Motion.animate(
      composer,
      { height: [`${startHeight}px`, `${targetHeight}px`] },
      transition,
    );
  }

  composerContentAnimation = window.Motion.animate(
    composerDefaultContent,
    { opacity: [0, 1] },
    transition,
  );
  executionPlanContentAnimation = window.Motion.animate(
    panel,
    { opacity: [1, 0] },
    transition,
  );
  executionPlanActionsAnimation = undefined;

  return Promise.all([
    planCollapseAnimation,
    composerContentAnimation,
    executionPlanContentAnimation,
  ].filter(Boolean));
}

function showExecutionPlan(activeSequence, { animate = true } = {}) {
  if (activeSequence !== sequenceId) return;
  hideWorkingIndicator();
  requestPromptHint.hidden = false;
  morphComposerToPanel(
    activeSequence,
    executionPlan,
    executionPlanContent,
    executionPlanActions,
    { animate },
  );
  scrollConversationToLatest();
}

function showApprovalCard(activeSequence, { animate = true } = {}) {
  if (activeSequence !== sequenceId) return;
  hideWorkingIndicator();
  requestPromptHint.hidden = false;
  resetApprovalState();
  morphComposerToPanel(
    activeSequence,
    approvalCard,
    approvalCardContent,
    approvalCardFooter,
    { animate },
  );
  scrollConversationToLatest();
}

function showSimulationResult(activeSequence) {
  if (activeSequence !== sequenceId) return;
  simulationResult.hidden = false;
  simulationResultSpinnerAnimation = startProgressSpinnerMotion(
    simulationResultSpinner,
  );
  simulationResultAnimation = animateEntrance(simulationResult);
  scrollConversationToLatest();

  if (simulationResultAnimation) {
    simulationResultAnimation.then(() => {
      holdBlueBox(() => collapseSimulationResult(activeSequence));
    });
  } else {
    holdBlueBox(() => collapseSimulationResult(activeSequence));
  }
}

function finishSimulationResult(activeSequence) {
  if (activeSequence !== sequenceId) return;
  simulationResultSpinnerAnimation?.stop();
  simulationResult.hidden = true;
  clearEntranceStyles(simulationResult);
  simulationComplete.hidden = false;
  simulationCompleteAnimation = animateEntrance(simulationComplete);

  if (simulationCompleteAnimation) {
    simulationCompleteAnimation.then(() => showApprovalCard(activeSequence));
  } else {
    showApprovalCard(activeSequence);
  }
}

function collapseSimulationResult(activeSequence) {
  if (activeSequence !== sequenceId) return;
  simulationResultCollapseAnimation = animateExit(
    simulationResult,
    defaultMotionValues.understandCollapse,
  );

  if (simulationResultCollapseAnimation) {
    simulationResultCollapseAnimation.then(() => {
      finishSimulationResult(activeSequence);
    });
  } else {
    finishSimulationResult(activeSequence);
  }
}

function finishSimulation(activeSequence) {
  if (activeSequence !== sequenceId) return;
  simulationSpinnerAnimation?.stop();
  simulationCard.hidden = true;
  clearEntranceStyles(simulationCard);
  showSimulationResult(activeSequence);
}

function collapseSimulation(activeSequence) {
  if (activeSequence !== sequenceId) return;
  simulationCollapseAnimation = animateExit(
    simulationCard,
    defaultMotionValues.understandCollapse,
  );

  if (simulationCollapseAnimation) {
    simulationCollapseAnimation.then(() => finishSimulation(activeSequence));
  } else {
    finishSimulation(activeSequence);
  }
}

function showSimulation(activeSequence) {
  if (activeSequence !== sequenceId) return;
  hideWorkingIndicator();
  simulationCard.hidden = false;
  simulationSpinnerAnimation = startProgressSpinnerMotion(simulationSpinner);
  simulationAnimation = animateEntrance(simulationCard);

  if (simulationAnimation) {
    simulationAnimation.then(() => {
      holdBlueBox(() => collapseSimulation(activeSequence));
    });
  } else {
    holdBlueBox(() => collapseSimulation(activeSequence));
  }
}

function finishProgressStage(activeSequence, stageIndex) {
  if (activeSequence !== sequenceId) return;
  const stage = progressStages[stageIndex];
  stage.card.hidden = true;
  clearEntranceStyles(stage.card);
  stage.spinner.style.removeProperty("transform");
  stage.complete.hidden = false;
  const completionAnimation = animateEntrance(stage.complete);
  if (completionAnimation) progressAnimations.push(completionAnimation);

  const showNext = () => {
    if (stageIndex === progressStages.length - 1) {
      showSimulation(activeSequence);
    } else {
      showProgressStage(activeSequence, stageIndex + 1);
    }
  };

  if (completionAnimation) {
    completionAnimation.then(showNext);
  } else {
    showNext();
  }
}

function collapseProgressStage(activeSequence, stageIndex) {
  if (activeSequence !== sequenceId) return;
  const stage = progressStages[stageIndex];
  deactivatePauseControl(stage.card);
  const collapseAnimation = animateExit(
    stage.card,
    defaultMotionValues.understandCollapse,
  );
  if (collapseAnimation) progressAnimations.push(collapseAnimation);

  if (collapseAnimation) {
    collapseAnimation.then(() => finishProgressStage(activeSequence, stageIndex));
  } else {
    finishProgressStage(activeSequence, stageIndex);
  }
}

function showProgressStage(activeSequence, stageIndex) {
  if (activeSequence !== sequenceId) return;
  const stage = progressStages[stageIndex];
  stage.card.hidden = false;
  stage.spinnerAnimation = startProgressSpinnerMotion(stage.spinner);
  activatePauseControl(stage.card, {
    pauseMotion: () => {
      pauseThinkingMotion();
      stage.spinnerAnimation?.stop();
    },
    resumeMotion: () => {
      startThinkingMotion();
      stage.spinnerAnimation = startProgressSpinnerMotion(stage.spinner);
    },
  });
  const entranceAnimation = animateEntrance(stage.card);
  if (entranceAnimation) progressAnimations.push(entranceAnimation);

  if (entranceAnimation) {
    entranceAnimation.then(() => {
      holdBlueBox(() => collapseProgressStage(activeSequence, stageIndex));
    });
  } else {
    holdBlueBox(() => collapseProgressStage(activeSequence, stageIndex));
  }
}

function finishExecutionPlan(activeSequence) {
  if (activeSequence !== sequenceId) return;
  resetExecutionPlanMorph();
  planComplete.hidden = false;
  planCompleteAnimation = animateEntrance(planComplete);

  if (planCompleteAnimation) {
    planCompleteAnimation.then(() => showProgressStage(activeSequence, 0));
  } else {
    showProgressStage(activeSequence, 0);
  }
}

function acceptExecutionPlan() {
  if (executionStarted || executionPlan.hidden) return;
  executionStarted = true;
  requestPromptHint.hidden = true;
  const activeSequence = sequenceId;
  showThinking(activeSequence, { showTask: false });
  const morphAnimation = morphPanelToComposer(
    activeSequence,
    executionPlanContent,
    executionPlanActions,
  );

  if (morphAnimation) {
    morphAnimation.then(() => finishExecutionPlan(activeSequence));
  } else {
    finishExecutionPlan(activeSequence);
  }
}

function setTransactionStepState(activeIndex, { animate = true } = {}) {
  transactionSteps.forEach((step, index) => {
    const icon = step.querySelector(".transaction-step-icon");
    const isComplete = index < activeIndex;
    const isActive = index === activeIndex;

    step.classList.toggle("is-complete", isComplete);
    step.classList.toggle("is-active", isActive);
    if (isComplete) clearEntranceStyles(step);
    step.dataset.status = isComplete ? "complete" : isActive ? "active" : "pending";
    if (isActive) step.setAttribute("aria-current", "step");
    else step.removeAttribute("aria-current");
    icon.src = isComplete
      ? "/design-sync/transaction-submitted/assets/radiobutton.svg"
      : isActive
        ? "/design-sync/transaction-submitted/assets/flagbannerfold.svg"
        : "/design-sync/transaction-submitted/assets/radiobutton-2.svg";

    if (isActive && animate && window.Motion) {
      clearEntranceStyles(step);
      const stepAnimation = window.Motion.animate(
        step,
        reduceMotion.matches
          ? { opacity: [0.6, 1] }
          : {
              opacity: [0.5, 1],
              transform: ["scale(0.98)", "scale(1)"],
            },
        {
          duration: reduceMotion.matches ? 0.15 : 0.2,
          ease: [0.23, 1, 0.32, 1],
        },
      );
      progressAnimations.push(stepAnimation);
    }
  });
}

function showTransactionSuccess(activeSequence, { animate = true } = {}) {
  if (activeSequence !== sequenceId) return;
  window.clearTimeout(transactionSuccessTimer);
  transactionSuccessTimer = undefined;

  const revealSuccess = () => {
    if (activeSequence !== sequenceId) return;
    transactionSubmittedSpinnerAnimation?.stop();
    transactionSubmittedSpinnerAnimation = undefined;
    transactionSubmittedSpinner.hidden = true;
    transactionSubmittedCard.hidden = true;
    clearEntranceStyles(transactionSubmittedCard);
    transactionSuccessCard.hidden = false;
    clearEntranceStyles(transactionSuccessCard);
    clearEntranceStyles(transactionSuccessReceipt);
    clearEntranceStyles(transactionSuccessActions);
    chatHistory.scrollTop = chatHistory.scrollHeight;
    syncChatFade();

    if (!animate) {
      showTransactionCompletionSummary(activeSequence, { animate: false });
      return;
    }

    if (!window.Motion) {
      scheduleTransactionCompletionSummary(activeSequence, { animate: false });
      return;
    }

    const transition = reduceMotion.matches
      ? { duration: 0.15, ease: [0.23, 1, 0.32, 1] }
      : toMotionTransition(motionValues.transactionSuccess.transition);
    transactionSuccessEnterAnimation = animateSurface(
      transactionSuccessCard,
      // A stationary clip avoids resampling the moving SVG/text at a
      // changing scale, especially on mobile GPU compositors.
      { opacity: [0, 1] },
      transition,
    );
    transactionSuccessReceiptAnimation = animateSurface(
      transactionSuccessReceipt,
      reduceMotion.matches
        ? { opacity: [0, 1] }
        : { transform: ["translate3d(0, -100%, 0)", "translate3d(0, 0, 0)"] },
      reduceMotion.matches
        ? { duration: 0.15, ease: [0.23, 1, 0.32, 1] }
        : toMotionTransition(motionValues.transactionSuccess.receipt),
    );
    transactionSuccessActionsAnimation = animateSurface(
      transactionSuccessActions,
      reduceMotion.matches
        ? { opacity: [0, 1] }
        : {
            opacity: [0, 1],
            transform: [
              `translate3d(0, 8px, 0) scale(${motionValues.responseEntrance.scale})`,
              "translate3d(0, 0, 0) scale(1)",
            ],
          },
      toMotionTransition(
        motionValues.transactionSuccess.transition,
        reduceMotion.matches ? 0 : motionValues.transactionSuccess.actionsDelay,
      ),
    );

    Promise.all([
      transactionSuccessEnterAnimation,
      transactionSuccessReceiptAnimation,
      transactionSuccessActionsAnimation,
    ]).then(() =>
      scheduleTransactionCompletionSummary(activeSequence, { animate: true }),
    );
  };

  if (!animate || !window.Motion) {
    revealSuccess();
    return;
  }

  const transition = reduceMotion.matches
    ? { duration: 0.15, ease: [0.23, 1, 0.32, 1] }
    : toMotionTransition(motionValues.transactionSuccess.transition);
  transactionSuccessExitAnimation = animateSurface(
    transactionSubmittedCard,
    reduceMotion.matches
      ? { opacity: [1, 0] }
      : {
          opacity: [1, 0],
          transform: ["translate3d(0, 0, 0) scale(1)", "translate3d(0, -4px, 0) scale(0.98)"],
        },
    transition,
  );
  transactionSuccessExitAnimation.then(revealSuccess);
}

function scheduleTransactionSuccess(activeSequence) {
  window.clearTimeout(transactionSuccessTimer);
  transactionSuccessTimer = window.setTimeout(
    () => showTransactionSuccess(activeSequence),
    motionValues.transactionSuccess.wait * 1000,
  );
}

function advanceTransactionStep(activeSequence, nextIndex) {
  if (activeSequence !== sequenceId) return;

  if (nextIndex >= transactionSteps.length) {
    setTransactionStepState(transactionSteps.length, { animate: false });
    transactionSubmittedCard.classList.add("is-complete");
    scrollConversationToLatest();
    scheduleTransactionSuccess(activeSequence);
    return;
  }

  setTransactionStepState(nextIndex);
  scrollConversationToLatest();
  holdBlueBox(() => advanceTransactionStep(activeSequence, nextIndex + 1));
}

function showTransactionSubmitted(activeSequence) {
  if (activeSequence !== sequenceId) return;
  requestPromptHint.hidden = true;
  sendButton.hidden = true;
  resetTransactionSuccess();
  resetTransactionSubmitted();
  transactionSubmittedCard.hidden = false;
  setTransactionStepState(0, { animate: false });
  transactionSubmittedSpinnerAnimation = startProgressSpinnerMotion(
    transactionSubmittedSpinner,
  );
  transactionSubmittedAnimation = animateEntrance(transactionSubmittedCard);
  scrollConversationToLatest();

  const startSteps = () => {
    if (activeSequence !== sequenceId) return;
    holdBlueBox(() => advanceTransactionStep(activeSequence, 1));
  };

  if (transactionSubmittedAnimation) {
    transactionSubmittedAnimation.then(startSteps);
  } else {
    startSteps();
  }
}

function finishApproval(activeSequence) {
  if (activeSequence !== sequenceId) return;
  approvalSpinnerAnimation?.stop();
  resetApprovalMorph();
  resetApprovalState();
  showTransactionSubmitted(activeSequence);
}

function submitApprovedTransaction(activeSequence) {
  if (activeSequence !== sequenceId) return;
  const morphAnimation = morphPanelToComposer(
    activeSequence,
    approvalCardContent,
    approvalCardFooter,
  );

  if (morphAnimation) {
    morphAnimation.then(() => finishApproval(activeSequence));
  } else {
    finishApproval(activeSequence);
  }
}

function showApprovalWalletState(activeSequence) {
  if (activeSequence !== sequenceId) return;
  const startHeight = composer.getBoundingClientRect().height;
  approvalIdleHeight = startHeight;
  approvalCard.classList.add("is-awaiting-wallet");
  approvalHint.hidden = false;
  approveSignButton.disabled = true;
  approveSignButton.setAttribute("aria-busy", "true");
  replaceApprovalActionIcon("/design-sync/step-3/assets/spinner-7.svg", {
    spinning: true,
  });
  approvalSpinnerAnimation = startProgressSpinnerMotion(approvalActionIcon);
  const targetHeight = approvalCard.scrollHeight;

  if (!window.Motion) {
    composer.style.height = `${targetHeight}px`;
    return;
  }

  const transition = {
    duration: reduceMotion.matches ? 0.15 : 0.2,
    ease: [0.23, 1, 0.32, 1],
  };
  approvalWalletAnimation = window.Motion.animate(
    composer,
    { height: [`${startHeight}px`, `${targetHeight}px`] },
    transition,
  );
  const hintAnimation = window.Motion.animate(
    approvalHint,
    reduceMotion.matches
      ? { opacity: [0, 1] }
      : {
          opacity: [0, 1],
          transform: ["translate3d(0, 4px, 0)", "translate3d(0, 0, 0)"],
        },
    transition,
  );
  progressAnimations.push(hintAnimation);

  progressAnimations.push(approvalWalletAnimation);
}

function cancelApprovalWalletState() {
  approvalSpinnerAnimation?.stop();
  approvalWalletAnimation?.stop();
  approvalSpinnerAnimation = undefined;
  approvalWalletAnimation = undefined;
  approvalCard.classList.remove("is-awaiting-wallet");
  approvalHint.hidden = true;
  approveSignButton.disabled = false;
  approveSignButton.removeAttribute("aria-busy");
  replaceApprovalActionIcon(
    "/design-sync/transaction-ready-for-approval/assets/paperplane.svg",
  );

  if (approvalIdleHeight !== undefined) {
    composer.style.height = `${approvalIdleHeight}px`;
    approvalIdleHeight = undefined;
  }
}

function approveAndSign() {
  if (approvalStarted || approvalCard.hidden) return;
  approvalStarted = true;
  requestPromptHint.hidden = true;
  showApprovalWalletState(sequenceId);
  showWalletSignatureModal();
}

function cancelWalletSignature() {
  if (walletSignatureModal.hidden) return;
  approvalStarted = false;
  closeWalletSignatureModal({ animate: true }).then(() => {
    cancelApprovalWalletState();
    requestPromptHint.hidden = false;
    approveSignButton.focus();
  });
}

function confirmWalletSignature() {
  if (walletSignatureModal.hidden) return;
  const activeSequence = sequenceId;
  closeWalletSignatureModal({ animate: true }).then(() => {
    if (activeSequence === sequenceId) submitApprovedTransaction(activeSequence);
  });
}

function finishWalletCheck(activeSequence, { animate = true } = {}) {
  if (activeSequence !== sequenceId) return;
  walletSpinnerAnimation?.stop();
  walletCard.hidden = true;
  clearEntranceStyles(walletCard);
  walletComplete.hidden = false;
  walletCompleteAnimation = animate
    ? animateEntrance(walletComplete)
    : undefined;

  if (walletCompleteAnimation) {
    walletCompleteAnimation.then(() => showExecutionPlan(activeSequence));
  } else {
    showExecutionPlan(activeSequence, { animate });
  }
}

function collapseWalletCheck(activeSequence) {
  if (activeSequence !== sequenceId || walletCard.hidden) return;
  deactivatePauseControl(walletCard);
  walletCollapseAnimation = animateExit(
    walletCard,
    defaultMotionValues.understandCollapse,
  );

  if (walletCollapseAnimation) {
    walletCollapseAnimation.then(() => finishWalletCheck(activeSequence));
  } else {
    finishWalletCheck(activeSequence, { animate: false });
  }
}

function showWalletCard(
  activeSequence,
  { animate = true, autoAdvance = true } = {},
) {
  if (activeSequence !== sequenceId) return;
  walletCard.hidden = false;
  startWalletSpinnerMotion();
  activatePauseControl(walletCard, {
    pauseMotion: () => {
      pauseThinkingMotion();
      walletSpinnerAnimation?.stop();
    },
    resumeMotion: () => {
      startThinkingMotion();
      startWalletSpinnerMotion();
    },
  });
  walletAnimation = animate ? animateEntrance(walletCard) : undefined;

  if (!autoAdvance) return;
  if (walletAnimation) {
    walletAnimation.then(() => {
      holdBlueBox(() => collapseWalletCheck(activeSequence));
    });
  } else {
    holdBlueBox(() => collapseWalletCheck(activeSequence));
  }
}

function finishUnderstandRequest(activeSequence, { animate = true } = {}) {
  if (activeSequence !== sequenceId) return;
  taskCard.hidden = true;
  clearEntranceStyles(taskCard);
  collapsedTasksHint.hidden = false;
  collapsedTask.hidden = false;
  collapsedTasksHintAnimation = animate
    ? animateEntrance(collapsedTasksHint)
    : undefined;
  collapsedTaskAnimation = animate ? animateEntrance(collapsedTask) : undefined;

  if (collapsedTaskAnimation) {
    collapsedTaskAnimation.then(() => showWalletCard(activeSequence));
  } else {
    showWalletCard(activeSequence, { animate });
  }
}

function collapseUnderstandRequest(activeSequence) {
  if (activeSequence !== sequenceId || taskCard.hidden) return;
  deactivatePauseControl(taskCard);
  taskCollapseAnimation = animateExit(
    taskCard,
    motionValues.understandCollapse,
  );

  if (taskCollapseAnimation) {
    taskCollapseAnimation.then(() => finishUnderstandRequest(activeSequence));
  } else {
    finishUnderstandRequest(activeSequence, { animate: false });
  }
}

function scheduleUnderstandCollapse(activeSequence) {
  if (activeSequence !== sequenceId) return;
  holdBlueBox(() => collapseUnderstandRequest(activeSequence));
}

function showTaskCard(activeSequence, { animate = true, autoAdvance = true } = {}) {
  if (activeSequence !== sequenceId) return;
  taskCard.hidden = false;
  activatePauseControl(taskCard, {
    pauseMotion: pauseThinkingMotion,
    resumeMotion: startThinkingMotion,
  });
  taskAnimation = animate ? animateEntrance(taskCard) : undefined;

  if (!autoAdvance) return;
  if (taskAnimation) {
    taskAnimation.then(() => scheduleUnderstandCollapse(activeSequence));
  } else {
    scheduleUnderstandCollapse(activeSequence);
  }
}

function showThinking(
  activeSequence,
  {
    animateThinking = true,
    animateTask = true,
    immediateTask = false,
    showTask = true,
  } = {},
) {
  if (activeSequence !== sequenceId) return;
  workingRow.hidden = false;

  if (animateThinking && window.Motion) {
    thinkingEntranceAnimation = window.Motion.animate(
      workingRow,
      { opacity: [0, 1] },
      {
        duration: reduceMotion.matches
          ? 0.15
          : motionValues.thinking.entranceDuration,
        ease: [0.23, 1, 0.32, 1],
      },
    );
  } else {
    workingRow.style.opacity = "1";
  }

  startThinkingMotion();

  if (!showTask) return;

  if (immediateTask) {
    showTaskCard(activeSequence, { animate: false, autoAdvance: false });
    return;
  }

  taskRevealTimer = window.setTimeout(
    () => showTaskCard(activeSequence, { animate: animateTask }),
    motionValues.understandRequest.delay * 1000,
  );
}

function animateChatEntrance(composerStart) {
  const composerEnd = composer.getBoundingClientRect();
  const distance = composerStart.top - composerEnd.top;

  if (reduceMotion.matches || !window.Motion) {
    composer.style.removeProperty("transform");
    responseAnimation = animateEntrance(
      userMessage,
      motionValues.responseEntrance.delay,
    );
  } else {
    composerAnimation = window.Motion.animate(
      composer,
      {
        transform: [
          `translate3d(0, ${distance}px, 0)`,
          "translate3d(0, 0, 0)",
        ],
      },
      toMotionTransition(motionValues.composerMovement.transition),
    );

    responseAnimation = animateEntrance(
      userMessage,
      motionValues.responseEntrance.delay,
    );
  }

  const activeSequence = sequenceId;
  if (responseAnimation) {
    responseAnimation.then(() => showThinking(activeSequence));
  } else {
    showThinking(activeSequence);
  }
}

function showUnderstandRequest({ animate = true } = {}) {
  stopChatAnimations();
  resetTaskHistory();
  resetPostPlanState();
  composer.style.removeProperty("transform");
  clearEntranceStyles(userMessage);
  clearEntranceStyles(taskCard);
  clearEntranceStyles(collapsedTask);
  clearEntranceStyles(walletCard);
  clearEntranceStyles(walletComplete);
  clearEntranceStyles(executionPlan);
  workingRow.hidden = true;
  requestPromptHint.hidden = true;
  workingRow.style.removeProperty("opacity");
  taskCard.hidden = true;
  collapsedTask.hidden = true;
  walletCard.hidden = true;
  walletComplete.hidden = true;
  executionPlan.hidden = true;
  thinkingDots.textContent = ".";

  const composerStart = composer.getBoundingClientRect();
  chatInner.classList.add("is-chatting");
  chatStream.hidden = false;
  composer.classList.add("is-working");
  prompt.value = "";
  prompt.readOnly = true;
  sendButton.hidden = false;
  sendButtonLabel.textContent = "Stop";
  sendButtonIcon.src = "/design-sync/step-1/assets/stop.svg";
  sendButton.setAttribute("aria-label", "Stop");
  syncComposer();
  syncChatFade();

  if (animate) {
    animateChatEntrance(composerStart);
  } else {
    showThinking(sequenceId, { animateThinking: false, showTask: false });
    collapsedTasksHint.hidden = false;
    collapsedTask.hidden = false;
    walletComplete.hidden = false;
    showExecutionPlan(sequenceId, { animate: false });
  }
}

function replayTransactionSuccessTransition() {
  showApprovalPreview();
  resetApprovalMorph();
  resetApprovalState();
  resetTransactionSuccess();
  resetTransactionSubmitted();
  transactionSubmittedCard.hidden = false;
  transactionSubmittedCard.classList.add("is-complete");
  transactionSubmittedSpinner.hidden = false;
  transactionSubmittedSpinnerAnimation = startProgressSpinnerMotion(
    transactionSubmittedSpinner,
  );
  setTransactionStepState(transactionSteps.length, { animate: false });
  requestPromptHint.hidden = true;
  scrollConversationToLatest();
  scheduleTransactionSuccess(sequenceId);
}

function showApprovalPreview() {
  showUnderstandRequest({ animate: false });
  resetExecutionPlanMorph();
  planComplete.hidden = false;
  stakeComplete.hidden = false;
  aaveComplete.hidden = false;
  borrowComplete.hidden = false;
  simulationComplete.hidden = false;
  showApprovalCard(sequenceId, { animate: false });
  scrollConversationToLatest();
}

function showSubmittedPreview() {
  showApprovalPreview();
  resetApprovalMorph();
  resetApprovalState();
  showTransactionSubmitted(sequenceId);
}

function showSuccessPreview() {
  showApprovalPreview();
  resetApprovalMorph();
  resetApprovalState();
  resetTransactionSubmitted();
  resetTransactionSuccess();
  requestPromptHint.hidden = true;
  sendButton.hidden = true;
  transactionSuccessCard.hidden = false;
  showTransactionCompletionSummary(sequenceId, { animate: false });
  scrollConversationToLatest();
}

function resetChatForReplay() {
  stopChatAnimations();
  resetTaskHistory();
  resetPostPlanState();
  composer.style.removeProperty("transform");
  clearEntranceStyles(userMessage);
  clearEntranceStyles(taskCard);
  clearEntranceStyles(collapsedTask);
  clearEntranceStyles(walletCard);
  clearEntranceStyles(walletComplete);
  clearEntranceStyles(executionPlan);
  thinkingSpinner.style.removeProperty("transform");
  walletSpinner.style.removeProperty("transform");
  thinkingLetters.forEach((letter) => letter.style.removeProperty("opacity"));
  workingRow.hidden = true;
  workingRow.style.removeProperty("opacity");
  taskCard.hidden = true;
  collapsedTask.hidden = true;
  walletCard.hidden = true;
  walletComplete.hidden = true;
  executionPlan.hidden = true;
  thinkingDots.textContent = ".";
  chatInner.classList.remove("is-chatting");
  chatStream.hidden = true;
  composer.classList.remove("is-working");
  prompt.readOnly = false;
  prompt.value = filledPrompt;
  sendButton.hidden = false;
  sendButtonLabel.textContent = "Send";
  sendButtonIcon.src = "/design-sync/shell-2/assets/paperplane.svg";
  sendButton.setAttribute("aria-label", "Send");
  syncComposer();
}

if (new URLSearchParams(window.location.search).get("state") === "filled") {
  prompt.value = filledPrompt;
}

prompt.addEventListener("input", syncComposer);
prompt.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
  event.preventDefault();
  composer.requestSubmit();
});
chatHistory.addEventListener("scroll", syncChatFade, { passive: true });
window.addEventListener("resize", syncChatFade);
acceptPlanButton.addEventListener("click", acceptExecutionPlan);
approveSignButton.addEventListener("click", approveAndSign);
walletSignatureCancelButton.addEventListener("click", cancelWalletSignature);
walletSignatureConfirmButton.addEventListener("click", confirmWalletSignature);
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") cancelWalletSignature();
});
pauseControls.forEach((control) => {
  control.addEventListener("click", (event) => {
    event.stopPropagation();
    if (activePauseContext?.control !== control) return;
    if (executionPaused) continueCurrentTask();
    else pauseCurrentTask();
  });
});
historyItems.forEach((item) => {
  item.toggle.addEventListener("click", () => expandHistoryItem(item));
  item.detail.addEventListener("click", () => collapseHistoryItem(item));
  item.detail.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    collapseHistoryItem(item);
  });
});

composer.addEventListener("submit", (event) => {
  event.preventDefault();
  if (composer.classList.contains("is-working")) return;
  if (!prompt.value.trim()) return;
  prompt.blur();
  prompt.value = filledPrompt;
  userMessage.textContent = filledPrompt;
  showUnderstandRequest();
});

syncComposer();

const requestedState = new URLSearchParams(window.location.search).get("state");

if (requestedState === "chat") {
  showUnderstandRequest({ animate: false });
} else if (requestedState === "approval") {
  showApprovalPreview();
} else if (requestedState === "submitted") {
  showSubmittedPreview();
} else if (requestedState === "success") {
  showSuccessPreview();
}
