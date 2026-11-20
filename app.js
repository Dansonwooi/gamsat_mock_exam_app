(() => {
  "use strict";

  const STORAGE_KEY = "gamsat-practice-journal-v1";
  const letters = ["A", "B", "C", "D"];
  const freshState = () => ({ questions: [], results: [] });
  let state = loadState();
  let activeTest = null;
  let noticeTimer = null;

  const $ = (selector) => document.querySelector(selector);
  const views = ["test", "bank", "results"];

  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return freshState();
      const parsed = JSON.parse(saved);
      if (!parsed || !Array.isArray(parsed.questions) || !Array.isArray(parsed.results)) {
        throw new Error("Saved data has an unexpected format.");
      }
      return parsed;
    } catch (error) {
      console.error("Could not load saved practice data:", error);
      window.addEventListener("DOMContentLoaded", () => {
        showNotice("Saved practice data could not be loaded. Your existing browser data has not been changed.", false);
      });
      return freshState();
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      console.error("Could not save practice data:", error);
      showNotice("Your browser could not save this change. Check available device storage and try again.", false);
      return false;
    }
  }

  function showNotice(message, success = true) {
    const notice = $("#notice");
    notice.textContent = message;
    notice.classList.toggle("success", success);
    notice.hidden = false;
    window.clearTimeout(noticeTimer);
    noticeTimer = window.setTimeout(() => { notice.hidden = true; }, 5000);
  }

  function sectionName(section) {
    return `Section ${section}`;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  function switchView(name) {
    views.forEach((view) => {
      const section = $(`#view-${view}`);
      const tab = $(`.tab[data-view="${view}"]`);
      const active = name === view;
      section.hidden = !active;
      section.classList.toggle("is-visible", active);
      tab.classList.toggle("is-active", active);
      if (active) tab.setAttribute("aria-current", "page");
      else tab.removeAttribute("aria-current");
    });
    if (name === "test") renderTestSetup();
    if (name === "bank") renderBank();
    if (name === "results") renderResults();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderCounts() {
    $("#question-total").textContent = state.questions.length;
    $("#bank-total").textContent = state.questions.length;
    $("#bank-tab-count").textContent = state.questions.length;
    $("#results-total").textContent = state.results.length;
    $("#results-tab-count").textContent = state.results.length;
  }

  function renderTestSetup() {
    const selectedSection = $("#test-section").value;
    const count = state.questions.filter((question) => question.section === selectedSection).length;
    $("#test-setup-hint").textContent = count
      ? `${count} ${count === 1 ? "question" : "questions"} ready in ${sectionName(selectedSection)}.`
      : `No questions in ${sectionName(selectedSection)} yet. Add some in your question bank to get started.`;
    $("#start-test-button").disabled = count === 0;
    $("#start-test-button").classList.toggle("is-disabled", count === 0);
    $("#test-empty").hidden = state.questions.length !== 0;
    $("#test-setup").hidden = activeTest !== null || state.questions.length === 0;
    $("#test-panel").hidden = activeTest === null;
    if (activeTest) renderTest();
  }

  function renderBank() {
    const filter = $("#bank-filter").value;
    const questions = state.questions.filter((question) => filter === "all" || question.section === filter);
    const container = $("#question-list");
    if (!questions.length) {
      const message = state.questions.length
        ? "No questions in this section yet."
        : "Your question bank is empty. Add your first question using the form.";
      container.innerHTML = `<div class="bank-empty">${escapeHtml(message)}</div>`;
      return;
    }
    container.innerHTML = questions.map((question) => `
      <article class="question-card">
        <div class="question-card-top">
          <span class="section-tag">${sectionName(escapeHtml(question.section))}</span>
          <button class="text-button" type="button" data-delete-question="${escapeHtml(question.id)}" aria-label="Delete question">Remove</button>
        </div>
        <p>${escapeHtml(question.prompt)}</p>
        <div class="question-preview-options">
          ${question.options.map((option, index) => `
            <span class="question-preview-option ${index === question.correctIndex ? "correct-preview" : ""}">
              <strong>${letters[index]}.</strong> ${escapeHtml(option)}${index === question.correctIndex ? " · correct" : ""}
            </span>
          `).join("")}
        </div>
      </article>
    `).join("");
  }

  function renderTest() {
    if (!activeTest) return;
    const { questions, index, answers, section } = activeTest;
    const question = questions[index];
    const selected = answers[index];
    const progress = Math.round(((index + 1) / questions.length) * 100);
    $("#test-panel").innerHTML = `
      <div class="test-card panel">
        <div class="test-progress-row">
          <span>${sectionName(escapeHtml(section))}</span>
          <span>Question ${index + 1} of ${questions.length}</span>
        </div>
        <div class="progress-track" role="progressbar" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100" aria-label="Test progress">
          <div class="progress-bar" style="width: ${progress}%"></div>
        </div>
        <h3 class="test-question">${escapeHtml(question.prompt)}</h3>
        <div class="answer-list" role="group" aria-label="Answer options">
          ${question.options.map((option, optionIndex) => `
            <button class="answer-option ${selected === optionIndex ? "is-selected" : ""}" type="button" data-answer="${optionIndex}" aria-pressed="${selected === optionIndex}">
              <span class="answer-letter">${letters[optionIndex]}</span>
              <span class="answer-text">${escapeHtml(option)}</span>
            </button>
          `).join("")}
        </div>
        <div class="test-controls">
          <button class="button button-quiet" type="button" data-test-action="exit">Exit test</button>
          <div class="test-controls-right">
            <button class="button button-quiet" type="button" data-test-action="previous" ${index === 0 ? "disabled" : ""}>← Previous</button>
            ${index === questions.length - 1
              ? '<button class="button finish-button" type="button" data-test-action="finish">Finish test</button>'
              : '<button class="button button-primary" type="button" data-test-action="next">Next question →</button>'}
          </div>
        </div>
      </div>
    `;
  }

  function renderResults() {
    const container = $("#results-list");
    if (!state.results.length) {
      container.innerHTML = `
        <div class="empty-state panel">
          <div class="empty-icon" aria-hidden="true">↗</div>
          <h3>No results just yet.</h3>
          <p>Finish a practice test and your score and answers will appear here.</p>
          <button class="button button-secondary" type="button" data-go="test">Take your first test <span aria-hidden="true">→</span></button>
        </div>`;
      return;
    }
    container.innerHTML = [...state.results].reverse().map((result) => {
      const percent = result.questionCount ? Math.round((result.correctCount / result.questionCount) * 100) : 0;
      const date = new Date(result.finishedAt).toLocaleString(undefined, {
        dateStyle: "medium", timeStyle: "short"
      });
      return `
        <article class="result-card">
          <div class="result-summary">
            <div class="result-meta">
              <span class="section-tag">${sectionName(escapeHtml(result.section))}</span>
              <span class="result-date">${escapeHtml(date)}</span>
            </div>
            <div class="result-score">${percent}% <small>${result.correctCount} / ${result.questionCount} correct</small></div>
          </div>
          <p class="result-breakdown">${result.answers.filter((answer) => answer.selectedIndex === null).length} unanswered</p>
          <details>
            <summary>Review your answers</summary>
            <div class="review-list">
              ${result.answers.map((answer, index) => {
                const isCorrect = answer.selectedIndex === answer.correctIndex;
                const selectedText = answer.selectedIndex === null ? "Not answered" : `${letters[answer.selectedIndex]}. ${answer.options[answer.selectedIndex]}`;
                const correctText = `${letters[answer.correctIndex]}. ${answer.options[answer.correctIndex]}`;
                return `
                  <div class="review-question">
                    <p>${index + 1}. ${escapeHtml(answer.prompt)}</p>
                    <div class="review-answer ${answer.selectedIndex === null ? "is-unanswered" : isCorrect ? "is-correct" : "is-wrong"}">
                      Your answer: ${escapeHtml(selectedText)}${isCorrect ? " · Correct" : ""}
                    </div>
                    ${isCorrect ? "" : `<div class="review-answer is-correct">Correct answer: ${escapeHtml(correctText)}</div>`}
                  </div>`;
              }).join("")}
            </div>
          </details>
        </article>`;
    }).join("");
  }

  function finishTest() {
    const answers = activeTest.questions.map((question, index) => ({
      questionId: question.id,
      prompt: question.prompt,
      options: [...question.options],
      correctIndex: question.correctIndex,
      selectedIndex: activeTest.answers[index] ?? null
    }));
    const result = {
      id: createId(),
      section: activeTest.section,
      startedAt: activeTest.startedAt,
      finishedAt: new Date().toISOString(),
      questionCount: answers.length,
      correctCount: answers.filter((answer) => answer.selectedIndex === answer.correctIndex).length,
      answers
    };
    state.results.push(result);
    if (!saveState()) {
      state.results.pop();
      return;
    }
    activeTest = null;
    renderCounts();
    showNotice("Test complete. Your result has been saved.", true);
    switchView("results");
  }

  function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => switchView(tab.dataset.view));
  });

  document.addEventListener("click", (event) => {
    const goButton = event.target.closest("[data-go]");
    if (goButton) {
      switchView(goButton.dataset.go);
      return;
    }

    const deleteButton = event.target.closest("[data-delete-question]");
    if (deleteButton) {
      const questionId = deleteButton.dataset.deleteQuestion;
      const questionIndex = state.questions.findIndex((question) => question.id === questionId);
      if (questionIndex === -1) return;
      const [removed] = state.questions.splice(questionIndex, 1);
      if (!saveState()) {
        state.questions.splice(questionIndex, 0, removed);
        return;
      }
      renderCounts();
      renderBank();
      renderTestSetup();
      showNotice("Question removed from your bank. Completed results are unchanged.", true);
      return;
    }

    if (!activeTest) return;
    const answerButton = event.target.closest("[data-answer]");
    if (answerButton) {
      activeTest.answers[activeTest.index] = Number(answerButton.dataset.answer);
      renderTest();
      return;
    }
    const action = event.target.closest("[data-test-action]")?.dataset.testAction;
    if (action === "previous" && activeTest.index > 0) {
      activeTest.index -= 1;
      renderTest();
    } else if (action === "next" && activeTest.index < activeTest.questions.length - 1) {
      activeTest.index += 1;
      renderTest();
    } else if (action === "finish") {
      finishTest();
    } else if (action === "exit") {
      activeTest = null;
      renderTestSetup();
      showNotice("Test closed. Your answers were not saved as a result.", false);
    }
  });

  $("#start-test-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const section = $("#test-section").value;
    const questions = state.questions.filter((question) => question.section === section);
    if (!questions.length) {
      showNotice(`Add questions to ${sectionName(section)} before starting a test.`, false);
      return;
    }
    activeTest = {
      section,
      questions: questions.map((question) => ({ ...question, options: [...question.options] })),
      answers: [],
      index: 0,
      startedAt: new Date().toISOString()
    };
    renderTestSetup();
  });

  $("#test-section").addEventListener("change", renderTestSetup);
  $("#bank-filter").addEventListener("change", renderBank);

  $("#question-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const question = {
      id: createId(),
      section: String(data.get("section")),
      prompt: String(data.get("prompt")).trim(),
      options: ["a", "b", "c", "d"].map((letter) => String(data.get(`option-${letter}`)).trim()),
      correctIndex: Number(data.get("correctAnswer")),
      createdAt: new Date().toISOString()
    };
    if (!question.prompt || question.options.some((option) => !option)) return;
    state.questions.push(question);
    if (!saveState()) {
      state.questions.pop();
      return;
    }
    form.reset();
    renderCounts();
    renderBank();
    renderTestSetup();
    showNotice("Question added to your bank.", true);
  });

  renderCounts();
  renderTestSetup();
  renderBank();
  renderResults();
})();
