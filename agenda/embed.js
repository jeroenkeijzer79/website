import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getFirestore, collection, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { showAgendaMap } from "./map.js";

const db = getFirestore(initializeApp(firebaseConfig));
const list = document.getElementById("event-list");
const futureOnly = document.getElementById("future-only");

function sendHeight() {
  const height = Math.ceil(document.documentElement.scrollHeight);
  window.parent.postMessage({ type: "agenda-height", height }, "*");
}

function observeHeight() {
  if (!window.ResizeObserver) {
    window.addEventListener("load", sendHeight);
    window.addEventListener("resize", sendHeight);
    return;
  }
  const observer = new ResizeObserver(sendHeight);
  observer.observe(document.body);
  observer.observe(document.documentElement);
}

window.addEventListener("load", () => {
  observeHeight();
  sendHeight();
});

const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
}[c]));

const fmt = d => {
  const x = new Date(d + "T12:00:00");
  return {
    day: x.toLocaleDateString("nl-NL", { day:"2-digit" }),
    month: x.toLocaleDateString("nl-NL", { month:"short" }).replace(".","").toUpperCase()
  };
};

const isPast = e => e.date && new Date(
  e.date + "T" + (e.time || "23:59") + ":00"
) < new Date();

let allEvents = [];

function render() {
  const upcoming = allEvents.filter(e => !isPast(e)).sort((a,b) => (a.date || "").localeCompare(b.date || "") || (a.time || "").localeCompare(b.time || ""));
  const pastEvents = allEvents.filter(e => isPast(e)).sort((a,b) => (b.date || "").localeCompare(a.date || "") || (b.time || "").localeCompare(a.time || ""));

  if (!upcoming.length && (!pastEvents.length || futureOnly?.checked)) {
    list.innerHTML = '<div class="message">Geen optredens gepland.</div>';
    return;
  }

  const renderEvent = e => {
    const f = fmt(e.date);
    const past = isPast(e);
    const hasDetails = !!(e.description || e.url || e.imageUrl);

    return `
      <article class="event${past ? " past" : ""}">
        <div class="event-date">
          <span class="event-day">${esc(f.day)}</span>
          <span class="event-month">${esc(f.month)}</span>
        </div>

        <div class="event-thumb">${e.imageUrl ? `<img src="${esc(e.imageUrl)}" alt="" loading="lazy">` : ""}</div>

        <div class="event-main">
          <div class="event-time">${esc(e.time || "")}</div>
          <p class="event-name">${esc(e.name || "")}</p>
          <p class="event-location">${esc(e.location || "")}${e.place ? " · " + esc(e.place) : ""}</p>
        </div>

        ${hasDetails ? `
          <button class="event-expand" type="button" aria-expanded="false" aria-label="Meer informatie tonen">
            <span class="event-arrow">⌄</span>
          </button>

          <div class="event-details" hidden>
            <div class="event-details-inner">
              ${e.imageUrl
                ? `<img class="event-image" src="${esc(e.imageUrl)}" alt="" loading="lazy">`
                : ""}
              ${e.description
                ? `<div class="event-description">${esc(e.description).replace(/\n/g,"<br>")}</div>`
                : ""}
              ${e.url
                ? `<a class="event-link" href="${esc(e.url)}" target="_blank" rel="noopener">Meer informatie ↗</a>`
                : ""}
            </div>
          </div>
        ` : ""}
      </article>
    `;
  };

  const sections = [];
  if (upcoming.length) sections.push('<section class="event-section"><h2 class="event-section-title">Aankomende optredens</h2><div class="event-list event-section-list">' + upcoming.map(renderEvent).join("") + '</div></section>');
  if (!futureOnly?.checked && pastEvents.length) sections.push('<section class="event-section past-section"><h2 class="event-section-title">Optredens die geweest zijn</h2><div class="event-list event-section-list">' + pastEvents.map(renderEvent).join("") + '</div></section>');
  list.innerHTML = sections.join("");

  list.querySelectorAll(".event-expand").forEach(button => {
    button.addEventListener("click", () => {
      const details = button.parentElement.querySelector(".event-details");
      const arrow = button.querySelector(".event-arrow");
      const opening = button.getAttribute("aria-expanded") !== "true";

      button.setAttribute("aria-expanded", String(opening));
      arrow.textContent = opening ? "⌃" : "⌄";

      if (opening) {
        details.hidden = false;
        details.style.maxHeight = "0px";
        details.style.opacity = "0";
        requestAnimationFrame(() => {
          details.style.maxHeight = details.scrollHeight + "px";
          details.style.opacity = "1";
        });
        details.addEventListener("transitionend", function handler() {
          if (button.getAttribute("aria-expanded") === "true") {
            details.style.maxHeight = "none";
            sendHeight();
          }
          details.removeEventListener("transitionend", handler);
        });
      } else {
        details.style.maxHeight = details.scrollHeight + "px";
        requestAnimationFrame(() => {
          details.style.maxHeight = "0px";
          details.style.opacity = "0";
        });
        details.addEventListener("transitionend", function handler() {
          if (button.getAttribute("aria-expanded") === "false") {
            details.hidden = true;
            sendHeight();
          }
          details.removeEventListener("transitionend", handler);
        });
      }
    });
  });

  requestAnimationFrame(sendHeight);
}

document.getElementById("show-map")?.addEventListener("click",async()=>{const panel=document.getElementById("agenda-map-panel");panel.hidden=false;await showAgendaMap(document.getElementById("agenda-map"),allEvents);});
document.getElementById("close-map")?.addEventListener("click",()=>document.getElementById("agenda-map-panel").hidden=true);

futureOnly?.addEventListener("change", () => {
  render();
  requestAnimationFrame(sendHeight);
});

const q = query(collection(db, "optredens"), orderBy("date"));

onSnapshot(q, snap => {
  allEvents = snap.docs
    .map(d => ({ id:d.id, ...d.data() }))
    .sort((a,b) => {
      const dateCompare = (a.date || "").localeCompare(b.date || "");
      return dateCompare || (a.time || "").localeCompare(b.time || "");
    });
  render();
}, err => {
  console.error("Agenda load error:", err);
  list.innerHTML = '<div class="message">Agenda kon niet worden geladen.</div>';
});
