/* LIPOTEC — site interactions. No dependencies. */
(() => {
  "use strict";
  const doc = document.documentElement;
  doc.classList.add("js");
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

  /* ---------- header ---------- */
  const header = $("[data-header]");
  const toggle = $("[data-menu-toggle]");
  const menu = $("#mobile-menu");
  const onScrollHeader = () => header && header.classList.toggle("is-solid", scrollY > 24 || document.body.classList.contains("menu-open"));
  addEventListener("scroll", onScrollHeader, { passive: true });
  onScrollHeader();
  function setMenu(open) {
    if (!toggle || !menu) return;
    toggle.setAttribute("aria-expanded", String(open));
    menu.hidden = !open;
    document.body.classList.toggle("menu-open", open);
    onScrollHeader();
    if (open) menu.querySelector("a")?.focus();
  }
  toggle?.addEventListener("click", () => setMenu(toggle.getAttribute("aria-expanded") !== "true"));
  addEventListener("keydown", (e) => { if (e.key === "Escape" && toggle?.getAttribute("aria-expanded") === "true") { setMenu(false); toggle.focus(); } });
  addEventListener("resize", () => { if (innerWidth > 980) setMenu(false); });

  /* ---------- hero entrance + studio tilt ---------- */
  const hero = $(".hero, .product-hero");
  if (hero) requestAnimationFrame(() => requestAnimationFrame(() => hero.classList.add("is-in")));
  $$(".showcase").forEach((sc) => {
    if (!("IntersectionObserver" in window)) return sc.classList.add("is-in");
    const so = new IntersectionObserver(([e]) => { if (e.isIntersecting) { sc.classList.add("is-in"); so.disconnect(); } }, { threshold: 0.2 });
    so.observe(sc);
  });
  $$("[data-tilt]").forEach((stage) => {
    const rig = $(".stage-rig", stage);
    if (!rig) return;
    let raf = 0;
    stage.addEventListener("pointermove", (e) => {
      if (reduced.matches || !finePointer.matches) return;
      const r = stage.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        rig.style.setProperty("--ry", `${(x * 9).toFixed(2)}deg`);
        rig.style.setProperty("--rx", `${(-y * 4).toFixed(2)}deg`);
      });
    });
    stage.addEventListener("pointerleave", () => { rig.style.setProperty("--ry", "0deg"); rig.style.setProperty("--rx", "0deg"); });
  });

  /* ---------- sparse reveals ---------- */
  const io = "IntersectionObserver" in window
    ? new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("seen"); io.unobserve(e.target); } }), { threshold: 0.15, rootMargin: "0px 0px -8% 0px" })
    : null;
  $$("[data-reveal]").forEach((el) => (io ? io.observe(el) : el.classList.add("seen")));

  /* ---------- headings rise, icons draw, rules draw ---------- */
  if (io && !reduced.matches) {
    $$("main .h-section, main .page-hero .h-display").forEach((h) => {
      if (h.closest(".hero, .product-hero")) return;
      const lines = $$(".line", h);
      if (!lines.length) h.innerHTML = `<span class="line">${h.innerHTML}</span>`;
      $$(".line", h).forEach((l) => {
        const gold = l.classList.contains("gold-text");
        l.classList.remove("gold-text");
        l.innerHTML = `<span${gold ? ' class="gold-text"' : ""}>${l.innerHTML}</span>`;
      });
      h.setAttribute("data-rise", "");
      io.observe(h);
    });
    $$(".feature-row, .perspective, .stage-card, .icon-ring").forEach((el) => {
      if (!el.querySelector(".icon") || el.closest("[data-draw]")) return;
      el.setAttribute("data-draw", "");
      io.observe(el);
    });
    $$(".draw-rule").forEach((el) => io.observe(el));
  }

  /* ---------- counters ---------- */
  const counters = $$("[data-count]");
  if (counters.length && io && !reduced.matches) {
    const co = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      co.unobserve(e.target);
      const el = e.target, to = +el.dataset.count, pre = el.dataset.prefix || "", t0 = performance.now(), dur = 1600;
      const tick = (t) => {
        const k = Math.min(1, (t - t0) / dur), v = Math.round(to * (1 - Math.pow(1 - k, 4)));
        el.textContent = pre + v;
        if (k < 1) requestAnimationFrame(tick);
      };
      el.textContent = pre + "0";
      requestAnimationFrame(tick);
    }), { threshold: 0.6 });
    counters.forEach((c) => co.observe(c));
  }

  /* ---------- cursor spotlight on dark sections ---------- */
  $$(".spot").forEach((sec) => sec.addEventListener("pointermove", (e) => {
    if (!finePointer.matches) return;
    const r = sec.getBoundingClientRect();
    sec.style.setProperty("--mx", `${e.clientX - r.left}px`);
    sec.style.setProperty("--my", `${e.clientY - r.top}px`);
  }));

  /* ---------- video loops: play only while visible ---------- */
  $$("[data-loop] video").forEach((v) => {
    if (reduced.matches || !io) return; // poster only
    const vo = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { v.preload = "auto"; v.play().catch(() => {}); } else v.pause();
    }, { threshold: 0.25 });
    vo.observe(v);
  });

  /* ---------- scroll progress hairline ---------- */
  if (header) {
    let sq = false;
    const sp = () => { sq = false; const h = document.documentElement; header.style.setProperty("--sp", (scrollY / Math.max(1, h.scrollHeight - innerHeight)).toFixed(4)); };
    addEventListener("scroll", () => { if (!sq) { sq = true; requestAnimationFrame(sp); } }, { passive: true });
    sp();
  }

  /* ---------- macro hover tilt ---------- */
  $$(".macro").forEach((m) => {
    m.addEventListener("pointermove", (e) => {
      if (!finePointer.matches || reduced.matches) return;
      const r = m.getBoundingClientRect();
      m.style.setProperty("--try", `${(((e.clientX - r.left) / r.width) - 0.5) * 5}deg`);
      m.style.setProperty("--trx", `${(0.5 - ((e.clientY - r.top) / r.height)) * 4}deg`);
    });
    m.addEventListener("pointerleave", () => { m.style.setProperty("--try", "0deg"); m.style.setProperty("--trx", "0deg"); });
  });

  /* ---------- macro parallax ---------- */
  const px = $$("[data-parallax]");
  if (px.length && !reduced.matches) {
    let q = false;
    const run = () => {
      q = false;
      const vh = innerHeight;
      px.forEach((f) => {
        const r = f.getBoundingClientRect();
        if (r.bottom < -100 || r.top > vh + 100) return;
        const k = (r.top + r.height / 2 - vh / 2) / vh; // -1..1
        f.querySelector("img").style.setProperty("--py", `${(-k * r.height * 0.09 - r.height * 0.09).toFixed(1)}px`);
      });
    };
    addEventListener("scroll", () => { if (!q) { q = true; requestAnimationFrame(run); } }, { passive: true });
    addEventListener("resize", run);
    run();
  }

  /* ---------- process line ---------- */
  $$(".process").forEach((el) => {
    if (!io) { el.classList.add("lit"); return el.style.setProperty("--p", 1); }
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.style.setProperty("--p", 1); el.classList.add("lit"); o.disconnect(); } }, { threshold: 0.35 });
    o.observe(el);
  });

  /* ---------- pinned scroll story: camera moves over the real render ---------- */
  $$("[data-story]").forEach((story) => {
    const img = $(".story-img", story);
    const steps = $$(".story-step", story);
    const shots = steps.map((s) => ({ x: +s.dataset.x || 0.5, y: +s.dataset.y || 0.5, s: +s.dataset.s || 1 }));
    let queued = false;
    let active = -1;
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    function frame() {
      queued = false;
      if (reduced.matches) { img.style.cssText = ""; steps.forEach((s) => s.classList.add("on")); return; }
      const r = story.getBoundingClientRect();
      const total = story.offsetHeight - innerHeight;
      const p = clamp(-r.top / total);
      story.style.setProperty("--p", p.toFixed(4));
      const n = shots.length;
      const pos = p * (n - 1);
      const i = Math.min(n - 2, Math.floor(pos));
      // hold on each shot, then travel to the next
      const local = pos - i;
      const t = ease(clamp((local - 0.35) / 0.65));
      const a = shots[i], b = shots[i + 1] || a;
      const s = a.s + (b.s - a.s) * t;
      const fx = a.x + (b.x - a.x) * t;
      const fy = a.y + (b.y - a.y) * t;
      img.style.setProperty("--s", s.toFixed(4));
      img.style.setProperty("--tx", `${((0.5 - fx) * 100 * s).toFixed(3)}%`);
      img.style.setProperty("--ty", `${((0.5 - fy) * 100 * s).toFixed(3)}%`);
      const idx = Math.min(n - 1, Math.round(pos));
      if (idx !== active) {
        active = idx;
        steps.forEach((el, k) => { el.classList.toggle("on", k === idx); el.setAttribute("aria-hidden", String(k !== idx)); });
      }
    }
    const req = () => { if (!queued) { queued = true; requestAnimationFrame(frame); } };
    addEventListener("scroll", req, { passive: true });
    addEventListener("resize", req);
    reduced.addEventListener?.("change", req);
    frame();
  });

  /* ---------- product explorer: hotspots, tabs, loupe ---------- */
  $$("[data-explorer]").forEach((ex) => {
    const box = $(".explorer-img", ex);
    const src = box.dataset.src;
    const spots = $$(".hotspot", ex);
    const tabs = $$("[role=tab]", ex);
    const panels = $$(".explorer-detail", ex);
    // zoom previews use the same render, positioned on the hotspot
    panels.forEach((p) => {
      const z = $(".explorer-zoom > div", p);
      if (!z) return;
      const x = +p.dataset.x, y = +p.dataset.y, zoom = +p.dataset.zoom || 3;
      z.style.backgroundImage = `url(${src})`;
      z.style.backgroundSize = `${zoom * 100}% auto`;
      // image aspect 1100x1650 inside a 16:9 box
      const boxRatio = 9 / 16, imgH = zoom * (1650 / 1100) / boxRatio; // image height in box-height units
      const px = clamp((x * zoom - 0.5) / (zoom - 1)) * 100;
      const py = clamp((y * imgH - 0.5) / (imgH - 1)) * 100;
      z.style.backgroundPosition = `${px}% ${py}%`;
    });
    function select(i, focusTab = false) {
      spots.forEach((s, k) => s.setAttribute("aria-pressed", String(k === i)));
      tabs.forEach((t, k) => { t.setAttribute("aria-selected", String(k === i)); t.tabIndex = k === i ? 0 : -1; });
      panels.forEach((p, k) => (p.hidden = k !== i));
      if (focusTab) tabs[i]?.focus();
    }
    spots.forEach((s, i) => s.addEventListener("click", () => {
      select(i);
      if (innerWidth <= 980) $(".explorer-panel", ex)?.scrollIntoView({ behavior: reduced.matches ? "auto" : "smooth", block: "start" });
    }));
    tabs.forEach((t, i) => {
      t.addEventListener("click", () => select(i));
      t.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          e.preventDefault();
          select((i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length, true);
        }
      });
    });
    select(0);

    // loupe (desktop, fine pointer)
    const loupe = document.createElement("div");
    loupe.className = "loupe";
    loupe.setAttribute("aria-hidden", "true");
    box.appendChild(loupe);
    const Z = 2.6;
    box.addEventListener("pointermove", (e) => {
      if (!finePointer.matches || e.target.closest(".hotspot")) { loupe.classList.remove("on"); return; }
      const r = box.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      loupe.style.left = `${x}px`;
      loupe.style.top = `${y}px`;
      loupe.style.backgroundImage = `url(${src})`;
      loupe.style.backgroundSize = `${r.width * Z}px ${r.height * Z}px`;
      loupe.style.backgroundPosition = `${-(x * Z - 95)}px ${-(y * Z - 95)}px`;
      loupe.classList.add("on");
    });
    box.addEventListener("pointerleave", () => loupe.classList.remove("on"));
  });

  /* ---------- contact form ---------- */
  $$("[data-contact-form]").forEach((form) => {
    const status = $(".form-status", form);
    const btn = $("button[type=submit]", form);
    const started = Date.now();
    const email = form.dataset.email;
    const msgs = {
      name: "Podaj imię i nazwisko.",
      clinic: "Podaj nazwę placówki.",
      email: "Podaj poprawny adres e-mail.",
      phone: "Podaj numer telefonu w formacie np. +48 600 000 000.",
      topic: "Wybierz rodzaj zapytania.",
      message: "Napisz kilka słów o zapytaniu (min. 10 znaków).",
      consent: "Potwierdź zapoznanie się z informacją o przetwarzaniu danych.",
    };
    function validate(el) {
      if (!el.name || !(el.name in msgs)) return true;
      const ok = el.checkValidity();
      el.setAttribute("aria-invalid", String(!ok));
      const err = form.querySelector(`#err-${el.name}`);
      if (err) err.textContent = ok ? "" : msgs[el.name];
      return ok;
    }
    $$("input, select, textarea", form).forEach((el) => el.addEventListener("blur", () => el.value && validate(el)));
    function mailtoHref(data) {
      const body = [
        `Imię i nazwisko: ${data.name}`, `Placówka: ${data.clinic}`, `E-mail: ${data.email}`,
        data.phone ? `Telefon: ${data.phone}` : "", `Rodzaj zapytania: ${data.topic}`, "", data.message,
      ].filter((l) => l !== null).join("\n");
      return `mailto:${email}?subject=${encodeURIComponent(`Zapytanie: ${data.topic} — ${data.clinic}`)}&body=${encodeURIComponent(body)}`;
    }
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      status.className = "form-status";
      status.textContent = "";
      const fields = $$("input:not(.hp input), select, textarea", form);
      const invalid = fields.filter((el) => !validate(el));
      if (invalid.length) { invalid[0].focus(); return; }
      const data = Object.fromEntries(new FormData(form));
      data.elapsed = Date.now() - started;
      btn.disabled = true;
      const label = btn.querySelector("span");
      const original = label.textContent;
      label.textContent = "Wysyłanie…";
      try {
        const res = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
        const out = await res.json().catch(() => ({}));
        if (res.ok && out.ok) {
          form.reset();
          status.textContent = "Dziękujemy. Wiadomość została wysłana — odpowiemy na podany adres e-mail.";
          status.focus?.();
        } else if (out.code === "not_configured") {
          status.classList.add("is-error");
          status.innerHTML = "";
          const p = document.createElement("span");
          p.textContent = "Wysyłka formularzem jest w trakcie uruchamiania i wiadomość nie została wysłana. Aby nie tracić czasu, otwórz gotową wiadomość w programie pocztowym: ";
          const a = document.createElement("a");
          a.href = mailtoHref(data);
          a.textContent = `wyślij na ${email}`;
          status.append(p, a, document.createTextNode("."));
        } else {
          status.classList.add("is-error");
          status.textContent = out.error || `Nie udało się wysłać wiadomości. Spróbuj ponownie lub napisz na ${email}.`;
        }
      } catch {
        status.classList.add("is-error");
        status.innerHTML = "";
        status.append(document.createTextNode("Brak połączenia z serwerem — wiadomość nie została wysłana. "));
        const a = document.createElement("a");
        a.href = mailtoHref(data);
        a.textContent = `Otwórz wiadomość do ${email}`;
        status.append(a);
      } finally {
        btn.disabled = false;
        label.textContent = original;
      }
    });
  });
})();
