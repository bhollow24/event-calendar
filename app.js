import { categories, seedEvents } from "./data/events.js";
import { calendarConfig } from "./config.js";

const STORAGE_KEY = "crypto-finance-calendar-events-v1";
const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MIN_MONTH = new Date("2026-01-01");
const MAX_MONTH = new Date("2027-12-01");
const GITHUB_EVENTS_CONFIG = {
  owner: "bhollow24",
  repo: "event-calendar",
  branch: "main",
  filePath: "events.json"
};

let githubEventsSha = null;

const monthLabel = document.querySelector("#current-month-label");
const monthSummary = document.querySelector("#current-month-summary");
const calendarGrid = document.querySelector("#calendar-grid");
const searchInput = document.querySelector("#search-input");
const categoryFilters = document.querySelector("#category-filters");
const monthRibbon = document.querySelector("#month-ribbon");
const monthEventsList = document.querySelector("#month-events-list");
const monthEventsCount = document.querySelector("#month-events-count");
const previousMonthButton = document.querySelector("#previous-month-button");
const nextMonthButton = document.querySelector("#next-month-button");
const addEventButton = document.querySelector("#add-event-button");
const syncButton = document.querySelector("#sync-button");
const syncStatus = document.querySelector("#sync-status");
const exportButton = document.querySelector("#export-button");
const importButton = document.querySelector("#import-button");
const importFileInput = document.querySelector("#import-file-input");
const resetButton = document.querySelector("#reset-button");

const eventDialog = document.querySelector("#event-dialog");
const eventForm = document.querySelector("#event-form");
const dialogTitle = document.querySelector("#dialog-title");
const deleteEventButton = document.querySelector("#delete-event-button");
const cancelButton = document.querySelector("#cancel-button");
const closeDialogButton = document.querySelector("#close-dialog-button");

const categorySelect = eventForm.elements.category;

const state = {
  currentMonth: new Date("2026-04-01"),
  searchTerm: "",
  activeCategories: new Set(Object.keys(categories)),
  events: loadEvents(),
  editingId: null,
  backend: createBackend(calendarConfig),
  syncState: {
    tone: "warn",
    message: "Running in local mode."
  }
};

renderCategorySelect();
renderCategoryFilters();
render();
bootstrap();

previousMonthButton.addEventListener("click", () => {
  state.currentMonth = clampMonth(addMonths(state.currentMonth, -3));
  render();
});

nextMonthButton.addEventListener("click", () => {
  state.currentMonth = clampMonth(addMonths(state.currentMonth, 3));
  render();
});

searchInput.addEventListener("input", (event) => {
  state.searchTerm = event.target.value.trim().toLowerCase();
  render();
});

addEventButton.addEventListener("click", () => openEditor());
syncButton.addEventListener("click", () => synchronizeFromRemote(true));

exportButton.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state.events, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "crypto-finance-calendar-events.json";
  link.click();
  URL.revokeObjectURL(url);
});

importButton.addEventListener("click", () => importFileInput.click());

importFileInput.addEventListener("change", async (event) => {
  const [file] = event.target.files || [];
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      throw new Error("Imported file must be an array of events.");
    }

    state.events = parsed.map(normalizeEvent);
    persistEvents();
    render();
    if (state.backend.isConfigured) {
      await pushAllEventsToRemote();
    } else {
      await saveEventsToGitHub(state.events);
    }
  } catch (error) {
    window.alert(error.message);
  } finally {
    importFileInput.value = "";
  }
});

resetButton.addEventListener("click", () => {
  const confirmed = window.confirm("Reset all local edits and restore the seeded calendar?");
  if (!confirmed) return;
  localStorage.removeItem(STORAGE_KEY);
  state.events = seedEvents.map(normalizeEvent);
  persistEvents();
  render();
  if (!state.backend.isConfigured) {
    saveEventsToGitHub(state.events);
  }
});

eventForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(eventForm);
  const draft = normalizeEvent({
    id: state.editingId || crypto.randomUUID(),
    title: formData.get("title"),
    category: formData.get("category"),
    status: formData.get("status"),
    location: formData.get("location"),
    start: formData.get("start"),
    end: formData.get("end"),
    sourceUrl: formData.get("sourceUrl"),
    notes: formData.get("notes")
  });

  if (draft.end < draft.start) {
    window.alert("End date cannot be before the start date.");
    return;
  }

  const index = state.events.findIndex((item) => item.id === draft.id);
  if (index === -1) {
    state.events.push(draft);
  } else {
    state.events[index] = draft;
  }

  state.events.sort((left, right) => left.start.localeCompare(right.start) || left.title.localeCompare(right.title));
  persistEvents();
  eventDialog.close();
  render();
  saveEventToRemote(draft);
});

deleteEventButton.addEventListener("click", () => {
  if (!state.editingId) return;
  const confirmed = window.confirm("Delete this event from the local calendar?");
  if (!confirmed) return;
  state.events = state.events.filter((event) => event.id !== state.editingId);
  persistEvents();
  eventDialog.close();
  render();
  deleteEventFromRemote(state.editingId);
});

cancelButton.addEventListener("click", () => eventDialog.close());
closeDialogButton.addEventListener("click", () => eventDialog.close());

function render() {
  const monthStart = new Date(state.currentMonth.getFullYear(), state.currentMonth.getMonth(), 1);
  const quarterStart = new Date(monthStart.getFullYear(), Math.floor(monthStart.getMonth() / 3) * 3, 1);
  const quarterEnd = new Date(quarterStart.getFullYear(), quarterStart.getMonth() + 3, 0);

  monthLabel.textContent = `Q${Math.floor(monthStart.getMonth() / 3) + 1} ${monthStart.getFullYear()}`;
  previousMonthButton.disabled = quarterStart <= MIN_MONTH;
  nextMonthButton.disabled = quarterStart >= MAX_MONTH;

  const visibleEvents = getVisibleEvents().filter((event) => intersectsMonth(event, quarterStart, quarterEnd));
  monthSummary.textContent = `${visibleEvents.length} visible event${visibleEvents.length === 1 ? "" : "s"} this quarter`;

  renderQuarterCalendar(quarterStart);
  renderMonthRibbon();
  renderMonthList(visibleEvents);
  renderCategoryFilters();
  renderSyncStatus();
}

function renderMonthRibbon() {
  const currentYear = state.currentMonth.getFullYear();
  const currentQuarterIndex = Math.floor(state.currentMonth.getMonth() / 3);
  monthRibbon.innerHTML = "";

  for (let year = 2026; year <= 2027; year += 1) {
    const yearBlock = document.createElement("section");
    yearBlock.className = "month-year-block";

    const yearHeader = document.createElement("div");
    yearHeader.className = "month-year-header";

    const yearTag = document.createElement("span");
    yearTag.className = "month-pill month-pill--year";
    yearTag.textContent = String(year);
    yearHeader.append(yearTag);

    const quarterGrid = document.createElement("div");
    quarterGrid.className = "quarter-grid";

    for (let quarter = 0; quarter < 4; quarter += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `quarter-select${year === currentYear && quarter === currentQuarterIndex ? " quarter-select--active" : ""}`;
      button.innerHTML = `
        <span class="quarter-select__label">Q${quarter + 1}</span>
        <span class="quarter-select__months">${formatQuarterMonths(year, quarter)}</span>
      `;
      button.addEventListener("click", () => {
        state.currentMonth = new Date(year, quarter * 3, 1);
        render();
      });
      quarterGrid.append(button);
    }

    yearBlock.append(yearHeader, quarterGrid);
    monthRibbon.append(yearBlock);
  }
}

function renderMonthCalendar(monthStart, monthEvents) {
  calendarGrid.innerHTML = "";
  calendarGrid.className = "calendar-grid";
  buildCalendarInto(calendarGrid, monthStart, monthEvents, false);
}

function renderQuarterCalendar(quarterStart) {
  calendarGrid.innerHTML = "";
  calendarGrid.className = "calendar-grid calendar-grid--quarter";

  for (let index = 0; index < 3; index += 1) {
    const monthStart = new Date(quarterStart.getFullYear(), quarterStart.getMonth() + index, 1);
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
    const monthEvents = getVisibleEvents().filter((event) => intersectsMonth(event, monthStart, monthEnd));
    const monthPanel = document.createElement("section");
    monthPanel.className = "quarter-month-panel";
    monthPanel.innerHTML = `
      <div class="quarter-month-heading">
        <h3>${monthStart.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h3>
        <p>${monthEvents.length} visible event${monthEvents.length === 1 ? "" : "s"}</p>
      </div>
    `;

    const monthGrid = document.createElement("div");
    monthGrid.className = "mini-calendar-grid";
    buildCalendarInto(monthGrid, monthStart, monthEvents, true);
    monthPanel.append(monthGrid);
    calendarGrid.append(monthPanel);
  }
}

function buildCalendarInto(target, monthStart, monthEvents, compact = false) {
  const days = buildCalendarDays(monthStart);
  const weeks = chunkDays(days, 7);

  weekdayLabels.forEach((label) => {
    const heading = document.createElement("div");
    heading.className = "weekday";
    heading.textContent = label;
    target.append(heading);
  });

  weeks.forEach((weekDates) => {
    const week = document.createElement("section");
    week.className = `week-row${compact ? " week-row--compact" : ""}`;

    const weekDays = document.createElement("div");
    weekDays.className = `week-days${compact ? " week-days--compact" : ""}`;

    weekDates.forEach((date) => {
      const isOutsideMonth = date.getMonth() !== monthStart.getMonth();
      const dayEvents = monthEvents.filter((event) => includesDate(event, date));

      const card = document.createElement("article");
      card.className = `day-card${compact ? " day-card--compact" : ""}${isOutsideMonth ? " day-card--outside" : ""}`;
      card.innerHTML = `
        <div class="day-card__header">
          <span class="day-number">${date.getDate()}</span>
          <span class="event-meta">${compact ? (dayEvents.length ? dayEvents.length : "") : dayEvents.length ? `${dayEvents.length} event${dayEvents.length === 1 ? "" : "s"}` : ""}</span>
        </div>
        <div class="day-card__meta">${date.toLocaleDateString(undefined, { weekday: "short" })}</div>
      `;

      if (!compact && dayEvents.length > 0) {
        const preview = document.createElement("div");
        preview.className = "day-preview-stack";
        dayEvents.slice(0, 2).forEach((event) => {
          const marker = document.createElement("button");
          marker.type = "button";
          marker.className = "day-preview";
          marker.textContent = event.title;
          marker.style.borderLeft = `3px solid ${categories[event.category].color}`;
          marker.addEventListener("click", () => openEditor(event.id));
          preview.append(marker);
        });
        if (dayEvents.length > 2) {
          const more = document.createElement("div");
          more.className = "day-preview day-preview--muted";
          more.textContent = `+${dayEvents.length - 2} more`;
          preview.append(more);
        }
        card.append(preview);
      }

      weekDays.append(card);
    });

    const lanes = document.createElement("div");
    lanes.className = `week-lanes${compact ? " week-lanes--compact" : ""}`;

    const segments = buildWeekSegments(weekDates, monthEvents);
    if (segments.length === 0) {
      const emptyLane = document.createElement("div");
      emptyLane.className = "week-empty";
      emptyLane.textContent = "No scheduled events in this week.";
      lanes.append(emptyLane);
    } else {
      const laneCount = Math.max(...segments.map((segment) => segment.lane)) + 1;

      for (let laneIndex = 0; laneIndex < laneCount; laneIndex += 1) {
        const lane = document.createElement("div");
        lane.className = `event-lane${compact ? " event-lane--compact" : ""}`;

        segments
          .filter((segment) => segment.lane === laneIndex)
          .forEach((segment) => {
            const bar = document.createElement("button");
            bar.type = "button";
            bar.className = `event-bar${compact ? " event-bar--compact" : ""}`;
            bar.style.gridColumn = `${segment.startIndex + 1} / ${segment.endIndex + 2}`;
            bar.style.setProperty("--event-color", categories[segment.event.category].color);
            bar.innerHTML = `
              <span class="event-bar__title">${segment.event.title}</span>
              <span class="event-bar__meta">${categories[segment.event.category].label} · ${formatRange(segment.event)}</span>
            `;
            if (segment.continuesBefore) bar.classList.add("event-bar--continues-before");
            if (segment.continuesAfter) bar.classList.add("event-bar--continues-after");
            if (segment.event.status !== "confirmed") bar.classList.add(`event-bar--${segment.event.status}`);
            bar.addEventListener("click", () => openEditor(segment.event.id));
            lane.append(bar);
          });

        lanes.append(lane);
      }
    }

    week.append(lanes, weekDays);
    target.append(week);
  });
}

function renderMonthList(monthEvents) {
  monthEventsCount.textContent = `${monthEvents.length} visible event${monthEvents.length === 1 ? "" : "s"}`;
  monthEventsList.innerHTML = "";

  if (monthEvents.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No events match the current month, category filters, and search.";
    monthEventsList.append(empty);
    return;
  }

  monthEvents
    .sort((left, right) => left.start.localeCompare(right.start) || left.title.localeCompare(right.title))
    .forEach((event) => {
      const card = document.createElement("article");
      card.className = "event-card";
      card.innerHTML = `
        <div class="event-card__top">
          <div>
            <div class="event-card__title">${event.title}</div>
            <div class="event-meta">${formatRange(event)} · ${event.location || "Location TBD"}</div>
          </div>
          <span class="event-category-dot" style="background:${categories[event.category].color}"></span>
        </div>
        <div class="event-badges">
          <span class="badge badge--${event.status}">${event.status}</span>
          <span class="badge">${categories[event.category].label}</span>
        </div>
        <p class="event-meta">${event.notes || "No notes yet."}</p>
        <div class="event-badges">
          <button class="button button--ghost event-edit-button" type="button">Edit</button>
          ${event.sourceUrl ? `<a class="event-link" href="${event.sourceUrl}" target="_blank" rel="noreferrer">Source</a>` : ""}
        </div>
      `;
      card.querySelector(".event-edit-button").addEventListener("click", () => openEditor(event.id));
      monthEventsList.append(card);
    });
}

function renderCategoryFilters() {
  const visibleEvents = getSearchMatchedEvents();
  categoryFilters.innerHTML = "";

  Object.entries(categories).forEach(([key, category]) => {
    const count = visibleEvents.filter((event) => event.category === key).length;
    const label = document.createElement("label");
    label.className = "filter-chip";
    label.innerHTML = `
      <input type="checkbox" ${state.activeCategories.has(key) ? "checked" : ""} />
      <span class="filter-chip__dot" style="background:${category.color}"></span>
      <span>${category.label}</span>
      <span class="filter-chip__meta">${count}</span>
    `;

    label.querySelector("input").addEventListener("change", (event) => {
      if (event.target.checked) {
        state.activeCategories.add(key);
      } else {
        state.activeCategories.delete(key);
      }
      render();
    });

    categoryFilters.append(label);
  });
}

function renderCategorySelect() {
  categorySelect.innerHTML = Object.entries(categories)
    .map(([value, category]) => `<option value="${value}">${category.label}</option>`)
    .join("");
}

function openEditor(id = null) {
  state.editingId = id;
  const event = state.events.find((item) => item.id === id);
  dialogTitle.textContent = event ? "Edit event" : "Add event";
  deleteEventButton.hidden = !event;

  eventForm.reset();

  const draft = event || {
    title: "",
    category: Object.keys(categories)[0],
    status: "confirmed",
    location: "",
    start: toDateInputValue(state.currentMonth),
    end: toDateInputValue(state.currentMonth),
    sourceUrl: "",
    notes: ""
  };

  eventForm.elements.title.value = draft.title;
  eventForm.elements.category.value = draft.category;
  eventForm.elements.status.value = draft.status;
  eventForm.elements.location.value = draft.location;
  eventForm.elements.start.value = draft.start;
  eventForm.elements.end.value = draft.end;
  eventForm.elements.sourceUrl.value = draft.sourceUrl;
  eventForm.elements.notes.value = draft.notes;

  eventDialog.showModal();
}

function getSearchMatchedEvents() {
  return state.events.filter((event) => {
    if (!state.searchTerm) return true;
    const haystack = [
      event.title,
      event.location,
      event.notes,
      categories[event.category]?.label,
      event.status
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(state.searchTerm);
  });
}

function getVisibleEvents() {
  return getSearchMatchedEvents().filter((event) => state.activeCategories.has(event.category));
}

function loadEvents() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return canonicalizeEvents(seedEvents);

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? mergeSeedEvents(parsed) : canonicalizeEvents(seedEvents);
  } catch {
    return canonicalizeEvents(seedEvents);
  }
}

function persistEvents() {
  state.events = canonicalizeEvents(state.events);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.events, null, 2));
}

function getGitHubToken() {
  return localStorage.getItem("github_token")?.trim() || "";
}

function promptForGitHubToken() {
  const token = window.prompt(
    "To save calendar changes permanently to GitHub, paste a GitHub Personal Access Token with repo access."
  );

  if (!token?.trim()) return false;
  localStorage.setItem("github_token", token.trim());
  return true;
}

function mergeSeedEvents(events) {
  const seedById = new Map(canonicalizeEvents(seedEvents).map((event) => [event.id, event]));
  const normalizedExisting = canonicalizeEvents(events).map((event) => {
    const normalized = normalizeEvent(event);

    // Upgrade a handful of known seeded events when official organizer dates replace placeholders.
    if (normalized.id === "token2049-dubai-2027-est" && seedById.has(normalized.id)) {
      return seedById.get(normalized.id);
    }

    return normalized;
  });
  const existingIds = new Set(normalizedExisting.map((event) => event.id));
  const missingSeedEvents = canonicalizeEvents(seedEvents).filter((event) => !existingIds.has(event.id));

  return canonicalizeEvents([...normalizedExisting, ...missingSeedEvents]);
}

function canonicalizeEvents(events) {
  const deduped = new Map();

  events.map(normalizeEvent).forEach((event) => {
    deduped.set(event.id, event);
  });

  return [...deduped.values()].sort((left, right) => left.start.localeCompare(right.start) || left.title.localeCompare(right.title));
}

async function bootstrap() {
  if (!state.backend.isConfigured) {
    await loadRepositoryEvents();
    return;
  }

  syncButton.disabled = false;
  await synchronizeFromRemote(false);
}

async function loadRepositoryEvents() {
  try {
    const response = await fetch(`./events.json?ts=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const events = await response.json();
    if (!Array.isArray(events) || events.length === 0) {
      throw new Error("Repository events file is empty.");
    }

    state.events = canonicalizeEvents(events);
    persistEvents();
    setSyncState("ok", "Loaded canonical event data from the repository.");
    render();
  } catch (error) {
    setSyncState(
      "warn",
      "Using local event cache. Repository-backed persistence is available once the app is served with events.json."
    );
    render();
  }
}

async function synchronizeFromRemote(showSuccessAlert) {
  if (!state.backend.isConfigured) {
    await loadRepositoryEvents();
    if (showSuccessAlert) {
      window.alert("Reloaded the repository-backed event data.");
    }
    return;
  }

  setSyncState("warn", "Syncing shared calendar from Supabase...");

  try {
    const remoteEvents = await state.backend.fetchEvents();

    if (remoteEvents.length === 0) {
      await pushAllEventsToRemote();
      setSyncState("ok", "Supabase is connected. Seed events were uploaded because the shared table was empty.");
    } else {
      state.events = remoteEvents;
      persistEvents();
      setSyncState("ok", `Supabase connected. Loaded ${remoteEvents.length} shared events.`);
    }

    render();

    if (showSuccessAlert) {
      window.alert("Shared calendar synced successfully.");
    }
  } catch (error) {
    setSyncState("error", `Supabase sync failed: ${error.message}`);
    render();
  }
}

async function pushAllEventsToRemote() {
  const uploads = state.events.map((event) => state.backend.upsertEvent(event));
  await Promise.all(uploads);
}

async function saveEventToRemote(event) {
  if (!state.backend.isConfigured) {
    await saveEventsToGitHub(state.events, `Saved "${event.title}" to GitHub.`);
    return;
  }

  setSyncState("warn", `Saving "${event.title}" to Supabase...`);
  render();

  try {
    await state.backend.upsertEvent(event);
    setSyncState("ok", `Saved "${event.title}" to the shared calendar.`);
    render();
  } catch (error) {
    setSyncState("error", `Could not save "${event.title}" to Supabase: ${error.message}`);
    render();
  }
}

async function deleteEventFromRemote(id) {
  if (!state.backend.isConfigured) {
    await saveEventsToGitHub(
      state.events,
      "Deleted the event and saved the updated calendar to GitHub."
    );
    return;
  }

  setSyncState("warn", "Deleting event from Supabase...");
  render();

  try {
    await state.backend.deleteEvent(id);
    setSyncState("ok", "Event deleted from the shared calendar.");
    render();
  } catch (error) {
    setSyncState("error", `Could not delete the event from Supabase: ${error.message}`);
    render();
  }
}

async function saveEventsToGitHub(events, successMessage = "Saved the calendar to GitHub.") {
  const token = getGitHubToken() || (promptForGitHubToken() ? getGitHubToken() : "");
  if (!token) {
    setSyncState(
      "warn",
      "GitHub token not configured. Changes are still cached locally in this browser."
    );
    render();
    return false;
  }

  setSyncState("warn", "Saving canonical events.json to GitHub...");
  render();

  try {
    const apiUrl = `https://api.github.com/repos/${GITHUB_EVENTS_CONFIG.owner}/${GITHUB_EVENTS_CONFIG.repo}/contents/${GITHUB_EVENTS_CONFIG.filePath}`;

    if (!githubEventsSha) {
      const currentResponse = await fetch(apiUrl, {
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github+json"
        }
      });

      if (currentResponse.ok) {
        const currentFile = await currentResponse.json();
        githubEventsSha = currentFile.sha;
      }
    }

    const payload = {
      message: `Update calendar events - ${new Date().toISOString()}`,
      content: btoa(JSON.stringify(canonicalizeEvents(events), null, 2)),
      branch: GITHUB_EVENTS_CONFIG.branch,
      sha: githubEventsSha || undefined
    };

    const response = await fetch(apiUrl, {
      method: "PUT",
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `HTTP ${response.status}`);
    }

    const result = await response.json();
    githubEventsSha = result.content?.sha || githubEventsSha;
    setSyncState("ok", successMessage);
    render();
    return true;
  } catch (error) {
    setSyncState("error", `GitHub save failed: ${error.message}`);
    render();
    return false;
  }
}

function setSyncState(tone, message) {
  state.syncState = { tone, message };
}

function renderSyncStatus() {
  syncStatus.className = `sync-status sync-status--${state.syncState.tone}`;
  syncStatus.textContent = state.syncState.message;
  syncButton.disabled = !state.backend.isConfigured;
}

function normalizeEvent(event) {
  return {
    id: String(event.id || crypto.randomUUID()),
    title: String(event.title || "").trim(),
    category: event.category in categories ? event.category : Object.keys(categories)[0],
    status: ["confirmed", "estimated", "watchlist"].includes(event.status) ? event.status : "watchlist",
    location: String(event.location || "").trim(),
    start: String(event.start || "").slice(0, 10),
    end: String(event.end || "").slice(0, 10),
    sourceUrl: String(event.sourceUrl || "").trim(),
    notes: String(event.notes || "").trim()
  };
}

function buildCalendarDays(monthStart) {
  const gridStart = new Date(monthStart);
  gridStart.setDate(1 - gridStart.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
}

function chunkDays(days, size) {
  return Array.from({ length: Math.ceil(days.length / size) }, (_, index) =>
    days.slice(index * size, index * size + size)
  );
}

function buildWeekSegments(weekDates, events) {
  const weekStart = toIsoDate(weekDates[0]);
  const weekEnd = toIsoDate(weekDates[6]);
  const lanes = [];

  return events
    .filter((event) => event.start <= weekEnd && event.end >= weekStart)
    .sort((left, right) => {
      if (left.start !== right.start) return left.start.localeCompare(right.start);
      return compareDateLength(right) - compareDateLength(left);
    })
    .map((event) => {
      const startIndex = Math.max(0, differenceInDays(weekStart, event.start));
      const endIndex = Math.min(6, differenceInDays(weekStart, event.end));
      const lane = findAvailableLane(lanes, startIndex, endIndex);
      lanes[lane] = [...(lanes[lane] || []), { startIndex, endIndex }];

      return {
        event,
        lane,
        startIndex,
        endIndex,
        continuesBefore: event.start < weekStart,
        continuesAfter: event.end > weekEnd
      };
    });
}

function findAvailableLane(lanes, startIndex, endIndex) {
  for (let laneIndex = 0; laneIndex < lanes.length; laneIndex += 1) {
    const hasCollision = lanes[laneIndex].some(
      (segment) => !(endIndex < segment.startIndex || startIndex > segment.endIndex)
    );
    if (!hasCollision) return laneIndex;
  }

  return lanes.length;
}

function differenceInDays(baseIsoDate, targetIsoDate) {
  const base = new Date(`${baseIsoDate}T00:00:00Z`);
  const target = new Date(`${targetIsoDate}T00:00:00Z`);
  return Math.round((target - base) / 86400000);
}

function compareDateLength(event) {
  return differenceInDays(event.start, event.end);
}

function includesDate(event, date) {
  const target = toIsoDate(date);
  return event.start <= target && event.end >= target;
}

function intersectsMonth(event, monthStart, monthEnd) {
  return event.start <= toIsoDate(monthEnd) && event.end >= toIsoDate(monthStart);
}

function addMonths(date, delta) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function clampMonth(date) {
  if (date < MIN_MONTH) return new Date(MIN_MONTH);
  if (date > MAX_MONTH) return new Date(MAX_MONTH);
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function toIsoDate(date) {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    .toISOString()
    .slice(0, 10);
}

function toDateInputValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatRange(event) {
  const start = new Date(`${event.start}T12:00:00`);
  const end = new Date(`${event.end}T12:00:00`);
  const startOptions = { month: "short", day: "numeric" };
  const endOptions = start.getFullYear() === end.getFullYear() ? { month: "short", day: "numeric" } : { year: "numeric", month: "short", day: "numeric" };

  if (event.start === event.end) {
    return start.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  return `${start.toLocaleDateString(undefined, startOptions)}-${end.toLocaleDateString(undefined, endOptions)}`;
}

function formatQuarterMonths(year, quarter) {
  return Array.from({ length: 3 }, (_, index) =>
    new Date(year, quarter * 3 + index, 1).toLocaleDateString(undefined, { month: "short" })
  ).join(" · ");
}

function createBackend(config) {
  const backend = config?.backend || {};
  const isConfigured =
    backend.provider === "supabase" &&
    Boolean(backend.projectUrl) &&
    Boolean(backend.anonKey) &&
    Boolean(backend.table);

  if (!isConfigured) {
    return { isConfigured: false };
  }

  const baseUrl = `${backend.projectUrl.replace(/\/$/, "")}/rest/v1/${backend.table}`;
  const headers = {
    apikey: backend.anonKey,
    Authorization: `Bearer ${backend.anonKey}`,
    "Content-Type": "application/json"
  };

  return {
    isConfigured: true,
    async fetchEvents() {
      const response = await fetch(
        `${baseUrl}?select=id,title,category,status,location,start_date,end_date,source_url,notes&order=start_date.asc,title.asc`,
        { headers }
      );
      await assertResponseOk(response, "fetch events");
      const data = await response.json();
      return data.map(fromRemoteEvent);
    },
    async upsertEvent(event) {
      const response = await fetch(`${baseUrl}?on_conflict=id`, {
        method: "POST",
        headers: {
          ...headers,
          Prefer: "resolution=merge-duplicates,return=representation"
        },
        body: JSON.stringify([toRemoteEvent(event)])
      });
      await assertResponseOk(response, "save event");
      return response.json();
    },
    async deleteEvent(id) {
      const response = await fetch(`${baseUrl}?id=eq.${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: {
          ...headers,
          Prefer: "return=minimal"
        }
      });
      await assertResponseOk(response, "delete event");
    }
  };
}

function toRemoteEvent(event) {
  return {
    id: event.id,
    title: event.title,
    category: event.category,
    status: event.status,
    location: event.location,
    start_date: event.start,
    end_date: event.end,
    source_url: event.sourceUrl,
    notes: event.notes
  };
}

function fromRemoteEvent(event) {
  return normalizeEvent({
    id: event.id,
    title: event.title,
    category: event.category,
    status: event.status,
    location: event.location,
    start: event.start_date,
    end: event.end_date,
    sourceUrl: event.source_url,
    notes: event.notes
  });
}

async function assertResponseOk(response, action) {
  if (response.ok) return;

  let detail = "";
  try {
    const payload = await response.json();
    detail = payload.message || payload.error_description || payload.error || JSON.stringify(payload);
  } catch {
    detail = await response.text();
  }

  throw new Error(`Unable to ${action}. ${detail || `HTTP ${response.status}`}`);
}
