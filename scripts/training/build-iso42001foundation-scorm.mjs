import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const sourceRoot = path.join(repoRoot, "training-content", "iso42001foundation");
const buildRoot = path.join(repoRoot, "training-build", "iso42001foundation");
const moduleRoot = path.join(sourceRoot, "modules");
const assessmentRoot = path.join(sourceRoot, "assessments");
const sourceAssetsRoot = path.join(sourceRoot, "assets");

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function listFilesRecursive(rootDir, relativeDir = "") {
  const currentDir = path.join(rootDir, relativeDir);
  const entries = await readdir(currentDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryRelativePath = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(rootDir, entryRelativePath)));
      continue;
    }
    files.push(entryRelativePath.replaceAll(path.sep, "/"));
  }
  return files;
}

function buildManifest(course, assetFiles) {
  const fileEntries = ["index.html", "course-data.json", ...assetFiles]
    .map((filePath) => `      <file href="${escapeXml(filePath)}" />`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${escapeXml(course.slug)}" version="1.2"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 ims_xml.xsd
  http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="ORG-1">
    <organization identifier="ORG-1">
      <title>${escapeXml(course.title)}</title>
      <item identifier="ITEM-1" identifierref="RES-1" isvisible="true">
        <title>${escapeXml(course.title)}</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES-1" type="webcontent" adlcp:scormtype="sco" href="index.html">
${fileEntries}
    </resource>
  </resources>
</manifest>
`;
}

function buildHtml(course) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${course.title}</title>
    <link rel="stylesheet" href="assets/app.css" />
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="assets/app.js"></script>
  </body>
</html>
`;
}

function buildCss() {
  return `:root {
  --bg: #f3f7f6;
  --surface: rgba(255, 255, 255, 0.94);
  --surface-strong: #ffffff;
  --text: #0f172a;
  --muted: #475569;
  --line: rgba(15, 23, 42, 0.12);
  --brand: #0f766e;
  --brand-strong: #115e59;
  --brand-soft: rgba(16, 185, 129, 0.14);
  --accent: #164e63;
  --warning: #b45309;
  --danger: #991b1b;
  --success: #166534;
  --shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
  color: var(--text);
  background:
    radial-gradient(circle at top left, rgba(16, 185, 129, 0.18), transparent 32%),
    linear-gradient(180deg, #f8fbfa 0%, var(--bg) 100%);
}

a {
  color: inherit;
}

.shell {
  max-width: 1180px;
  margin: 0 auto;
  padding: 32px 20px 48px;
}

.frame {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 24px;
}

.sidebar,
.content {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 24px;
  box-shadow: var(--shadow);
}

.sidebar {
  padding: 24px 20px;
  position: sticky;
  top: 20px;
  height: fit-content;
}

.brand {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.eyebrow {
  display: inline-flex;
  width: fit-content;
  padding: 6px 10px;
  border-radius: 999px;
  background: var(--brand-soft);
  color: var(--brand-strong);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.sidebar h1 {
  margin: 0;
  font-size: 1.15rem;
  line-height: 1.3;
}

.sidebar p {
  color: var(--muted);
  font-size: 0.95rem;
  margin: 0;
}

.metric {
  margin-top: 18px;
  display: grid;
  gap: 8px;
}

.metric-card {
  padding: 12px 14px;
  border-radius: 16px;
  background: #f8fbfa;
  border: 1px solid rgba(15, 118, 110, 0.12);
}

.metric-card strong {
  display: block;
  font-size: 1.2rem;
}

.outline {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--line);
}

.outline h2 {
  margin: 0 0 12px;
  font-size: 0.95rem;
}

.outline ol {
  padding-left: 18px;
  margin: 0;
  display: grid;
  gap: 10px;
  color: var(--muted);
  font-size: 0.92rem;
}

.content {
  overflow: hidden;
}

.content-header {
  padding: 22px 28px 0;
}

.progress-top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  color: var(--muted);
  font-size: 0.92rem;
}

.progress-track {
  width: 100%;
  height: 10px;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(15, 23, 42, 0.08);
  margin-top: 14px;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #14b8a6 0%, #0f766e 100%);
  transition: width 180ms ease;
}

.panel {
  padding: 28px;
}

.panel h2 {
  margin: 0 0 10px;
  font-size: 2rem;
  line-height: 1.1;
}

.panel h3 {
  margin: 24px 0 10px;
  font-size: 1.08rem;
}

.lede {
  font-size: 1.06rem;
  color: var(--muted);
  line-height: 1.7;
}

.section {
  margin-top: 22px;
}

.section p,
.section li {
  font-size: 1rem;
  line-height: 1.72;
  color: #1f2937;
}

.section ul {
  margin: 12px 0 0;
  padding-left: 22px;
}

.figure-grid {
  display: grid;
  gap: 18px;
  margin-top: 24px;
}

.figure {
  margin: 0;
  border: 1px solid var(--line);
  border-radius: 22px;
  overflow: hidden;
  background: var(--surface-strong);
  box-shadow: 0 16px 32px rgba(15, 23, 42, 0.08);
}

.figure img {
  display: block;
  width: 100%;
  height: auto;
  background: white;
}

.figure figcaption {
  padding: 14px 18px 18px;
  color: var(--muted);
  line-height: 1.6;
}

.callout {
  margin-top: 24px;
  padding: 16px 18px;
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(20, 184, 166, 0.12), rgba(15, 118, 110, 0.05));
  border: 1px solid rgba(15, 118, 110, 0.18);
  color: var(--brand-strong);
  font-weight: 600;
}

.nav {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 0 28px 28px;
}

.btn {
  appearance: none;
  border: none;
  border-radius: 14px;
  padding: 12px 18px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 120ms ease, background 120ms ease, color 120ms ease;
}

.btn:hover {
  transform: translateY(-1px);
}

.btn-primary {
  background: var(--brand);
  color: white;
}

.btn-secondary {
  background: #e8efee;
  color: var(--text);
}

.btn[disabled] {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
}

.quiz {
  display: grid;
  gap: 20px;
}

.question {
  border: 1px solid var(--line);
  border-radius: 18px;
  padding: 18px;
  background: var(--surface-strong);
}

.question h4 {
  margin: 0 0 12px;
  font-size: 1rem;
  line-height: 1.5;
}

.option-list {
  display: grid;
  gap: 10px;
}

.option {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: #fbfdfd;
}

.option input {
  margin-top: 3px;
}

.text-answer {
  width: 100%;
  border: 1px solid rgba(15, 23, 42, 0.16);
  border-radius: 14px;
  padding: 12px 14px;
  font: inherit;
  color: var(--text);
  background: #fbfdfd;
}

.select-answer {
  width: 100%;
  border: 1px solid rgba(15, 23, 42, 0.16);
  border-radius: 14px;
  padding: 12px 14px;
  font: inherit;
  color: var(--text);
  background: #fbfdfd;
}

.mapping-list,
.ordering-list {
  display: grid;
  gap: 12px;
}

.mapping-row,
.ordering-row {
  display: grid;
  gap: 12px;
  align-items: center;
}

.mapping-row {
  grid-template-columns: minmax(0, 1fr) minmax(220px, 0.9fr);
}

.ordering-row {
  grid-template-columns: minmax(0, 1fr) 120px;
}

.mapping-label,
.ordering-label {
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: #fbfdfd;
}

.helper-text {
  margin-top: 10px;
  color: var(--muted);
  font-size: 0.92rem;
  line-height: 1.6;
}

.question.correct {
  border-color: rgba(22, 101, 52, 0.28);
  background: rgba(22, 101, 52, 0.05);
}

.question.incorrect {
  border-color: rgba(153, 27, 27, 0.22);
  background: rgba(153, 27, 27, 0.04);
}

.result {
  margin-top: 18px;
  padding: 16px 18px;
  border-radius: 16px;
  border: 1px solid var(--line);
  background: #f8fbfa;
}

.result.pass {
  border-color: rgba(22, 101, 52, 0.28);
}

.result.fail {
  border-color: rgba(153, 27, 27, 0.22);
}

.explanation {
  margin-top: 10px;
  color: var(--muted);
}

.pill-grid {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 16px;
}

.pill {
  border-radius: 999px;
  padding: 8px 12px;
  background: #edf7f6;
  color: var(--accent);
  font-size: 0.86rem;
  font-weight: 700;
}

@media (max-width: 960px) {
  .frame {
    grid-template-columns: 1fr;
  }

  .sidebar {
    position: static;
  }

  .panel h2 {
    font-size: 1.65rem;
  }
}

@media (max-width: 640px) {
  .shell {
    padding: 16px 12px 28px;
  }

  .content-header,
  .panel,
  .nav {
    padding-left: 18px;
    padding-right: 18px;
  }

  .nav {
    flex-direction: column-reverse;
  }

  .btn {
    width: 100%;
  }

  .mapping-row,
  .ordering-row {
    grid-template-columns: 1fr;
  }
}
`;
}

function buildJs() {
  return `const app = document.getElementById("app");

const state = {
  course: null,
  steps: [],
  currentStepIndex: 0,
  quizAnswers: {},
  quizResults: {},
  finalScore: null,
  finalPassed: false
};

function safeParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function findScormApi(win = window) {
  let current = win;
  let depth = 0;
  while (current && depth < 10) {
    if (current.API) return current.API;
    if (current.parent && current.parent !== current) {
      current = current.parent;
      depth += 1;
      continue;
    }
    break;
  }
  return null;
}

const scorm = {
  api: null,
  connected: false,
  init() {
    this.api = findScormApi();
    if (!this.api) return;
    try {
      this.connected = this.api.LMSInitialize("") === "true";
      if (this.connected) {
        const suspendData = this.api.LMSGetValue("cmi.suspend_data");
        const lessonLocation = this.api.LMSGetValue("cmi.core.lesson_location");
        const restored = safeParse(suspendData);
        if (restored) {
          Object.assign(state, restored);
        }
        if (lessonLocation && Number.isFinite(Number(lessonLocation))) {
          state.currentStepIndex = Number(lessonLocation);
        }
      }
    } catch {
      this.connected = false;
    }
  },
  save() {
    if (!this.connected) return;
    const payload = JSON.stringify({
      currentStepIndex: state.currentStepIndex,
      quizAnswers: state.quizAnswers,
      quizResults: state.quizResults,
      finalScore: state.finalScore,
      finalPassed: state.finalPassed
    });
    try {
      this.api.LMSSetValue("cmi.core.lesson_location", String(state.currentStepIndex));
      this.api.LMSSetValue("cmi.suspend_data", payload);
      const rawScore = state.finalScore ?? calculateModuleScore();
      this.api.LMSSetValue("cmi.core.score.raw", String(rawScore));
      this.api.LMSSetValue("cmi.core.score.min", "0");
      this.api.LMSSetValue("cmi.core.score.max", "100");
      const status = state.finalScore == null
        ? "incomplete"
        : state.finalPassed
          ? "passed"
          : "failed";
      this.api.LMSSetValue("cmi.core.lesson_status", status);
      this.api.LMSCommit("");
    } catch {
      // ignore unavailable runtime errors in local preview
    }
  },
  finish() {
    if (!this.connected) return;
    this.save();
    try {
      this.api.LMSFinish("");
    } catch {
      // ignore unavailable runtime errors in local preview
    }
  }
};

window.addEventListener("beforeunload", () => scorm.finish());

function flattenSteps(course) {
  const steps = [
    { type: "intro", id: "intro", title: course.title }
  ];

  for (const module of course.modules) {
    steps.push({
      type: "module-intro",
      id: \`\${module.id}-intro\`,
      moduleId: module.id,
      title: module.title,
      module
    });
    for (const page of module.pages) {
      steps.push({
        type: "page",
        id: \`\${module.id}-\${page.id}\`,
        moduleId: module.id,
        title: page.title,
        module,
        page
      });
    }
    steps.push({
      type: "knowledge-check",
      id: \`\${module.id}-knowledge-check\`,
      moduleId: module.id,
      title: module.knowledgeCheck.title,
      module
    });
  }

  steps.push({
    type: "final-assessment",
    id: "final-assessment",
    title: course.finalAssessment.title
  });

  steps.push({
    type: "completion",
    id: "completion",
    title: "Completion"
  });

  return steps;
}

function progressLabel() {
  return \`Step \${state.currentStepIndex + 1} of \${state.steps.length}\`;
}

function progressPercent() {
  return ((state.currentStepIndex + 1) / state.steps.length) * 100;
}

function countCompletedChecks() {
  return Object.keys(state.quizResults).length;
}

function calculateModuleScore() {
  const entries = Object.values(state.quizResults);
  if (!entries.length) return 0;
  const total = entries.reduce((sum, entry) => sum + entry.score, 0);
  return Math.round(total / entries.length);
}

function renderSection(section) {
  const paragraphs = (section.paragraphs || [])
    .map((paragraph) => \`<p>\${paragraph}</p>\`)
    .join("");
  const bullets = (section.bullets || []).length
    ? \`<ul>\${section.bullets.map((bullet) => \`<li>\${bullet}</li>\`).join("")}</ul>\`
    : "";
  return \`<section class="section">
    \${section.heading ? \`<h3>\${section.heading}</h3>\` : ""}
    \${paragraphs}
    \${bullets}
  </section>\`;
}

function renderImages(images = []) {
  if (!images.length) return "";
  return \`<div class="figure-grid">
    \${images
      .map(
        (image) => \`<figure class="figure">
          <img src="\${image.src}" alt="\${image.alt || ""}" loading="lazy" />
          \${image.caption ? \`<figcaption>\${image.caption}</figcaption>\` : ""}
        </figure>\`
      )
      .join("")}
  </div>\`;
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\\s+/g, " ");
}

function isQuestionCorrect(question, answer) {
  const type = question.type || "single-select";
  if (type === "multi-select") {
    if (!Array.isArray(answer)) return false;
    const selected = [...answer].sort((left, right) => left - right);
    const correct = [...(question.correctIndices || [])].sort((left, right) => left - right);
    return JSON.stringify(selected) === JSON.stringify(correct);
  }
  if (type === "short-text") {
    const acceptedAnswers = question.acceptedAnswers || [];
    return acceptedAnswers.some((candidate) => normalizeText(candidate) === normalizeText(answer));
  }
  if (type === "ordering") {
    if (!Array.isArray(answer) || answer.length !== (question.items || []).length) return false;
    const selectedPositions = answer.map((value) => Number(value));
    const uniquePositions = new Set(selectedPositions);
    if (
      selectedPositions.some((value) => !Number.isInteger(value) || value < 1 || value > question.items.length) ||
      uniquePositions.size !== question.items.length
    ) {
      return false;
    }
    const orderedIndices = selectedPositions
      .map((position, index) => ({ index, position }))
      .sort((left, right) => left.position - right.position)
      .map((entry) => entry.index);
    return JSON.stringify(orderedIndices) === JSON.stringify(question.correctOrder || []);
  }
  if (type === "matching") {
    if (!Array.isArray(answer) || answer.length !== (question.leftItems || []).length) return false;
    return answer.every((selectedIndex, index) => Number(selectedIndex) === question.correctMatches[index]);
  }
  return answer === question.correctIndex;
}

function renderSingleSelectQuestion(question, answer, quizKey) {
  return \`<div class="option-list">
    \${question.options
      .map(
        (option, index) => \`<label class="option">
          <input type="radio" name="\${quizKey}-\${question.id}" value="\${index}" \${answer === index ? "checked" : ""} data-question-id="\${question.id}" data-quiz-key="\${quizKey}" data-question-type="single-select" />
          <span>\${option}</span>
        </label>\`
      )
      .join("")}
  </div>\`;
}

function renderMultiSelectQuestion(question, answer, quizKey) {
  const selected = Array.isArray(answer) ? answer : [];
  return \`<div class="option-list">
    \${question.options
      .map(
        (option, index) => \`<label class="option">
          <input type="checkbox" name="\${quizKey}-\${question.id}" value="\${index}" \${selected.includes(index) ? "checked" : ""} data-question-id="\${question.id}" data-quiz-key="\${quizKey}" data-question-type="multi-select" />
          <span>\${option}</span>
        </label>\`
      )
      .join("")}
  </div>\`;
}

function renderShortTextQuestion(question, answer, quizKey) {
  return \`<div>
    <input class="text-answer" type="text" value="\${answer || ""}" placeholder="\${question.placeholder || "Type your answer"}" data-question-id="\${question.id}" data-quiz-key="\${quizKey}" data-question-type="short-text" />
    \${question.helperText ? \`<div class="helper-text">\${question.helperText}</div>\` : ""}
  </div>\`;
}

function renderOrderingQuestion(question, answer, quizKey) {
  const selected = Array.isArray(answer) ? answer : [];
  return \`<div class="ordering-list">
    \${question.items
      .map(
        (item, index) => \`<label class="ordering-row">
          <span class="ordering-label">\${item}</span>
          <select class="select-answer" data-question-id="\${question.id}" data-quiz-key="\${quizKey}" data-question-type="ordering" data-item-index="\${index}">
            <option value="">Select position</option>
            \${question.items
              .map(
                (_, optionIndex) => \`<option value="\${optionIndex + 1}" \${selected[index] === optionIndex + 1 ? "selected" : ""}>\${optionIndex + 1}</option>\`
              )
              .join("")}
          </select>
        </label>\`
      )
      .join("")}
    \${question.helperText ? \`<div class="helper-text">\${question.helperText}</div>\` : ""}
  </div>\`;
}

function renderMatchingQuestion(question, answer, quizKey) {
  const selected = Array.isArray(answer) ? answer : [];
  return \`<div class="mapping-list">
    \${question.leftItems
      .map((item, index) => \`<label class="mapping-row">
        <span class="mapping-label">\${item}</span>
        <select class="select-answer" data-question-id="\${question.id}" data-quiz-key="\${quizKey}" data-question-type="matching" data-item-index="\${index}">
          <option value="">Select match</option>
          \${question.rightOptions
            .map(
              (option, optionIndex) => \`<option value="\${optionIndex}" \${selected[index] === optionIndex ? "selected" : ""}>\${option}</option>\`
            )
            .join("")}
        </select>
      </label>\`)
      .join("")}
    \${question.helperText ? \`<div class="helper-text">\${question.helperText}</div>\` : ""}
  </div>\`;
}

function renderQuestion(question, answer, quizKey, revealed) {
  const type = question.type || "single-select";
  const answerState = revealed
    ? isQuestionCorrect(question, answer)
      ? "correct"
      : "incorrect"
    : "";

  let controlMarkup = "";
  if (type === "multi-select") {
    controlMarkup = renderMultiSelectQuestion(question, answer, quizKey);
  } else if (type === "short-text") {
    controlMarkup = renderShortTextQuestion(question, answer, quizKey);
  } else if (type === "ordering") {
    controlMarkup = renderOrderingQuestion(question, answer, quizKey);
  } else if (type === "matching") {
    controlMarkup = renderMatchingQuestion(question, answer, quizKey);
  } else {
    controlMarkup = renderSingleSelectQuestion(question, answer, quizKey);
  }

  return \`<div class="question \${answerState}">
    <h4>\${question.prompt}</h4>
    \${controlMarkup}
    \${revealed ? \`<div class="explanation"><strong>Explanation:</strong> \${question.explanation}</div>\` : ""}
  </div>\`;
}

function renderIntro(course) {
  return \`<div class="panel">
    <span class="eyebrow">LeadAI Academy</span>
    <h2>\${course.title}</h2>
    <p class="lede">\${course.description}</p>
    <div class="pill-grid">
      <span class="pill">\${course.modules.length} modules</span>
      <span class="pill">\${course.estimatedMinutes} min</span>
      <span class="pill">Pass mark \${course.passScore}%</span>
    </div>
    <div class="section">
      <h3>Who this course is for</h3>
      <ul>\${course.targetAudience.map((item) => \`<li>\${item}</li>\`).join("")}</ul>
    </div>
    <div class="section">
      <h3>What you will learn</h3>
      <ul>\${course.learningOutcomes.map((item) => \`<li>\${item}</li>\`).join("")}</ul>
    </div>
    <div class="callout">This package is designed for Moodle SCORM delivery and tracks progress, score, and completion.</div>
  </div>\`;
}

function renderModuleIntro(step) {
  return \`<div class="panel">
    <span class="eyebrow">Module</span>
    <h2>\${step.module.title}</h2>
    <p class="lede">\${step.module.summary}</p>
    <div class="section">
      <h3>In this module</h3>
      <ul>\${step.module.pages.map((page) => \`<li>\${page.title}</li>\`).join("")}</ul>
    </div>
  </div>\`;
}

function renderPage(step) {
  return \`<div class="panel">
    <span class="eyebrow">\${step.module.title}</span>
    <h2>\${step.page.title}</h2>
    \${step.page.sections.map(renderSection).join("")}
    \${renderImages(step.page.images)}
    \${step.page.callout ? \`<div class="callout">\${step.page.callout}</div>\` : ""}
  </div>\`;
}

function getQuizState(quizKey) {
  return state.quizAnswers[quizKey] || {};
}

function renderKnowledgeCheck(step) {
  const quizKey = step.id;
  const selected = getQuizState(quizKey);
  const result = state.quizResults[quizKey];
  return \`<div class="panel">
    <span class="eyebrow">Knowledge check</span>
    <h2>\${step.module.knowledgeCheck.title}</h2>
    <p class="lede">Confirm the key points before moving to the next module.</p>
    <div class="quiz">
      \${step.module.knowledgeCheck.questions
        .map((question) => renderQuestion(question, selected[question.id], quizKey, Boolean(result)))
        .join("")}
    </div>
    <div class="result \${result ? (result.score >= 80 ? "pass" : "fail") : ""}">
      <button class="btn btn-primary" data-action="grade-module-check" data-quiz-key="\${quizKey}">Check answers</button>
      \${result ? \`<p><strong>Score:</strong> \${result.score}%</p>\` : "<p>Answer all questions, then check your score.</p>"}
    </div>
  </div>\`;
}

function renderFinalAssessment(course) {
  const quizKey = "final-assessment";
  const selected = getQuizState(quizKey);
  const result = state.quizResults[quizKey];
  return \`<div class="panel">
    <span class="eyebrow">Final assessment</span>
    <h2>\${course.finalAssessment.title}</h2>
    <p class="lede">You need \${course.passScore}% to pass the course.</p>
    <div class="quiz">
      \${course.finalAssessment.questions
        .map((question) => renderQuestion(question, selected[question.id], quizKey, Boolean(result)))
        .join("")}
    </div>
    <div class="result \${result ? (result.score >= course.passScore ? "pass" : "fail") : ""}">
      <button class="btn btn-primary" data-action="grade-final">Submit final assessment</button>
      \${result ? \`<p><strong>Score:</strong> \${result.score}%</p><p><strong>Result:</strong> \${result.score >= course.passScore ? "Pass" : "Fail"}</p>\` : "<p>Submit when you are ready.</p>"}
    </div>
  </div>\`;
}

function renderCompletion(course) {
  const status = state.finalPassed ? "passed" : "completed with outstanding items";
  return \`<div class="panel">
    <span class="eyebrow">Completion</span>
    <h2>Course \${status}</h2>
    <p class="lede">Your final assessment score is \${state.finalScore ?? 0}%.</p>
    <div class="pill-grid">
      <span class="pill">\${countCompletedChecks()} knowledge checks completed</span>
      <span class="pill">Final score \${state.finalScore ?? 0}%</span>
      <span class="pill">\${state.finalPassed ? "Pass" : "Review recommended"}</span>
    </div>
    <div class="section">
      <h3>Next steps</h3>
      <ul>
        <li>Review any incorrect answers with your governance owner or course administrator.</li>
        <li>Capture how ISO/IEC 42001 maps to your current AI operating model.</li>
        <li>Use the implementation roadmap to define ownership, controls, and evidence priorities.</li>
      </ul>
    </div>
    <div class="callout">\${course.certificateLabel}</div>
  </div>\`;
}

function renderCurrentStep() {
  const course = state.course;
  const step = state.steps[state.currentStepIndex];

  let inner = "";
  if (step.type === "intro") inner = renderIntro(course);
  if (step.type === "module-intro") inner = renderModuleIntro(step);
  if (step.type === "page") inner = renderPage(step);
  if (step.type === "knowledge-check") inner = renderKnowledgeCheck(step);
  if (step.type === "final-assessment") inner = renderFinalAssessment(course);
  if (step.type === "completion") inner = renderCompletion(course);

  app.innerHTML = \`<div class="shell">
    <div class="frame">
      <aside class="sidebar">
        <div class="brand">
          <span class="eyebrow">LeadAI</span>
          <h1>\${course.shortTitle}</h1>
          <p>\${course.tagline}</p>
        </div>
        <div class="metric">
          <div class="metric-card">
            <span>Overall progress</span>
            <strong>\${Math.round(progressPercent())}%</strong>
          </div>
          <div class="metric-card">
            <span>Checks completed</span>
            <strong>\${countCompletedChecks()}</strong>
          </div>
        </div>
        <div class="outline">
          <h2>Course modules</h2>
          <ol>\${course.modules.map((module) => \`<li>\${module.title}</li>\`).join("")}</ol>
        </div>
      </aside>
      <main class="content">
        <div class="content-header">
          <div class="progress-top">
            <span>\${progressLabel()}</span>
            <span>\${step.title}</span>
          </div>
          <div class="progress-track"><div class="progress-bar" style="width: \${progressPercent()}%"></div></div>
        </div>
        \${inner}
        <div class="nav">
          <button class="btn btn-secondary" data-action="prev" \${state.currentStepIndex === 0 ? "disabled" : ""}>Previous</button>
          <button class="btn btn-primary" data-action="next" \${state.currentStepIndex === state.steps.length - 1 ? "disabled" : ""}>Next</button>
        </div>
      </main>
    </div>
  </div>\`;

  wireEvents();
  scorm.save();
}

function ensureQuestionAnswered(question, answer) {
  const type = question.type || "single-select";
  if (type === "multi-select") {
    return Array.isArray(answer) && answer.length > 0;
  }
  if (type === "short-text") {
    return typeof answer === "string" && normalizeText(answer).length > 0;
  }
  if (type === "ordering") {
    if (!Array.isArray(answer) || answer.length !== (question.items || []).length) return false;
    const selectedPositions = answer.map((value) => Number(value));
    return (
      selectedPositions.every((value) => Number.isInteger(value) && value >= 1 && value <= question.items.length) &&
      new Set(selectedPositions).size === question.items.length
    );
  }
  if (type === "matching") {
    return (
      Array.isArray(answer) &&
      answer.length === (question.leftItems || []).length &&
      answer.every((value) => value !== "" && Number.isInteger(Number(value)))
    );
  }
  return Number.isInteger(answer);
}

function ensureAllAnswered(questions, selected) {
  return questions.every((question) => ensureQuestionAnswered(question, selected[question.id]));
}

function gradeQuiz(quizKey, questions, passScore) {
  const selected = getQuizState(quizKey);
  if (!ensureAllAnswered(questions, selected)) {
    window.alert("Please answer every question before submitting.");
    return;
  }
  let correct = 0;
  for (const question of questions) {
    if (isQuestionCorrect(question, selected[question.id])) {
      correct += 1;
    }
  }
  const score = Math.round((correct / questions.length) * 100);
  state.quizResults[quizKey] = { score, correct, total: questions.length };
  if (quizKey === "final-assessment") {
    state.finalScore = score;
    state.finalPassed = score >= passScore;
  }
  renderCurrentStep();
}

function wireEvents() {
  app.querySelectorAll("input[type=radio]").forEach((input) => {
    input.addEventListener("change", (event) => {
      const target = event.currentTarget;
      const quizKey = target.dataset.quizKey;
      const questionId = target.dataset.questionId;
      state.quizAnswers[quizKey] = state.quizAnswers[quizKey] || {};
      state.quizAnswers[quizKey][questionId] = Number(target.value);
      delete state.quizResults[quizKey];
      if (quizKey === "final-assessment") {
        state.finalScore = null;
        state.finalPassed = false;
      }
      scorm.save();
    });
  });

  app.querySelectorAll("input[type=checkbox]").forEach((input) => {
    input.addEventListener("change", (event) => {
      const target = event.currentTarget;
      const quizKey = target.dataset.quizKey;
      const questionId = target.dataset.questionId;
      const optionIndex = Number(target.value);
      const answers = state.quizAnswers[quizKey] = state.quizAnswers[quizKey] || {};
      const current = Array.isArray(answers[questionId]) ? answers[questionId] : [];
      answers[questionId] = target.checked
        ? [...new Set([...current, optionIndex])].sort((left, right) => left - right)
        : current.filter((value) => value !== optionIndex);
      delete state.quizResults[quizKey];
      if (quizKey === "final-assessment") {
        state.finalScore = null;
        state.finalPassed = false;
      }
      scorm.save();
    });
  });

  app.querySelectorAll("input[data-question-type=short-text]").forEach((input) => {
    input.addEventListener("input", (event) => {
      const target = event.currentTarget;
      const quizKey = target.dataset.quizKey;
      const questionId = target.dataset.questionId;
      state.quizAnswers[quizKey] = state.quizAnswers[quizKey] || {};
      state.quizAnswers[quizKey][questionId] = target.value;
      delete state.quizResults[quizKey];
      if (quizKey === "final-assessment") {
        state.finalScore = null;
        state.finalPassed = false;
      }
      scorm.save();
    });
  });

  app.querySelectorAll("select[data-question-type=ordering]").forEach((select) => {
    select.addEventListener("change", (event) => {
      const target = event.currentTarget;
      const quizKey = target.dataset.quizKey;
      const questionId = target.dataset.questionId;
      const itemIndex = Number(target.dataset.itemIndex);
      const answers = state.quizAnswers[quizKey] = state.quizAnswers[quizKey] || {};
      const current = Array.isArray(answers[questionId]) ? [...answers[questionId]] : [];
      current[itemIndex] = target.value === "" ? "" : Number(target.value);
      answers[questionId] = current;
      delete state.quizResults[quizKey];
      if (quizKey === "final-assessment") {
        state.finalScore = null;
        state.finalPassed = false;
      }
      scorm.save();
    });
  });

  app.querySelectorAll("select[data-question-type=matching]").forEach((select) => {
    select.addEventListener("change", (event) => {
      const target = event.currentTarget;
      const quizKey = target.dataset.quizKey;
      const questionId = target.dataset.questionId;
      const itemIndex = Number(target.dataset.itemIndex);
      const answers = state.quizAnswers[quizKey] = state.quizAnswers[quizKey] || {};
      const current = Array.isArray(answers[questionId]) ? [...answers[questionId]] : [];
      current[itemIndex] = target.value === "" ? "" : Number(target.value);
      answers[questionId] = current;
      delete state.quizResults[quizKey];
      if (quizKey === "final-assessment") {
        state.finalScore = null;
        state.finalPassed = false;
      }
      scorm.save();
    });
  });

  app.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;
      if (action === "prev" && state.currentStepIndex > 0) {
        state.currentStepIndex -= 1;
        renderCurrentStep();
        return;
      }
      if (action === "next" && state.currentStepIndex < state.steps.length - 1) {
        state.currentStepIndex += 1;
        renderCurrentStep();
        return;
      }
      if (action === "grade-module-check") {
        const quizKey = button.dataset.quizKey;
        const step = state.steps.find((item) => item.id === quizKey);
        gradeQuiz(quizKey, step.module.knowledgeCheck.questions, 80);
        return;
      }
      if (action === "grade-final") {
        gradeQuiz("final-assessment", state.course.finalAssessment.questions, state.course.passScore);
      }
    });
  });
}

async function start() {
  const response = await fetch("./course-data.json");
  const course = await response.json();
  state.course = course;
  state.steps = flattenSteps(course);
  scorm.init();
  renderCurrentStep();
}

start();
`;
}

async function main() {
  const course = await readJson(path.join(sourceRoot, "course.json"));
  const modules = [];
  for (const fileName of course.modules) {
    modules.push(await readJson(path.join(moduleRoot, fileName)));
  }
  const finalAssessment = await readJson(
    path.join(assessmentRoot, "final-assessment.json")
  );

  const bundle = {
    ...course,
    modules,
    finalAssessment
  };

  await rm(buildRoot, { recursive: true, force: true });
  await mkdir(path.join(buildRoot, "assets"), { recursive: true });

  await cp(sourceAssetsRoot, path.join(buildRoot, "assets"), { recursive: true });

  await writeFile(path.join(buildRoot, "course-data.json"), JSON.stringify(bundle, null, 2));
  await writeFile(path.join(buildRoot, "index.html"), buildHtml(course));
  await writeFile(path.join(buildRoot, "assets", "app.css"), buildCss());
  await writeFile(path.join(buildRoot, "assets", "app.js"), buildJs());
  const assetFiles = await listFilesRecursive(buildRoot, "assets");
  await writeFile(path.join(buildRoot, "imsmanifest.xml"), buildManifest(course, assetFiles));
}

await main();
