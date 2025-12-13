
function truncateText(t, e = 50) { if (!t || t.length <= e) return t; const n = t.substring(0, e), r = n.lastIndexOf(" "); return r > e * .7 ? n.substring(0, r).trim() + "..." : n.trim() + "..." }

// --- START: Application Logic ---
let _appDataCache = null, _bionicObserver = null, _bionicSet = new WeakSet;
const getAppData = () => { if (_appDataCache) return _appDataCache; const t = document.getElementById("app-data"); try { _appDataCache = JSON.parse(t.textContent), t.textContent = "", t.remove() } catch (e) { _appDataCache = {} } return _appDataCache };

const scrollToElement = t => { t && (window.setScrollspyNavigating && window.setScrollspyNavigating(!0), t.scrollIntoView({ behavior: "auto", block: "start" }), setTimeout(() => { window.setScrollspyNavigating && window.setScrollspyNavigating(!1) }, 100)) };

const handleTocClick = (t, e) => {
    // Close sidebar on mobile when a link is clicked
    if (window.innerWidth < 768) toggleSidebar();

    // Standard hash navigation happens by default if we simply don't preventDefault
    // However, the smooth scroll logic above suggests we might want to intervene.
    // If JS is active, we can do smooth scroll.

    if (t.hash) {
        const id = t.hash.substring(1);
        const target = document.getElementById(id);
        if (target) {
            e.preventDefault();
            scrollToElement(target);
            history.replaceState(null, null, "#" + id);
        }
    }
};

const createSettingsPanel = () => { const t = document.createElement("aside"); return t.id = "settings-sidebar-container", t.innerHTML = `<div class="settings-sidebar"><div class="settings-header"><h2>Reader Settings</h2><button id="settings-close" aria-label="Close settings">×</button></div><div class="settings-content"><div class="settings-section"><div class="font-size-control"><div id="font-size-preview" class="font-size-preview">Lorem ipsum</div><button id="bionic-reading-toggle" class="font-option" aria-label="Toggle Bionic Reading"><span>Bionic Reading</span></button><h3>Font Size</h3><div class="slider-container"><span class="size-label small">A</span><input type="range" id="font-size-slider" min="12" max="40" step="2" value="18" aria-label="Font size"><span class="size-label large">A</span></div></div></div><div class="settings-section"><h3>Font Family</h3><div class="font-family-grid"><button class="font-option active" data-font="original" style="font-family: serif">Original</button><button class="font-option" data-font="montserrat" style="font-family: sans-serif">Montserrat</button><button class="font-option" data-font="arial" style="font-family: Arial, sans-serif">Arial</button><button class="font-option" data-font="verdana" style="font-family: Verdana, sans-serif">Verdana</button><button class="font-option" data-font="roboto-condensed" style="font-family: sans-serif">Roboto</button><button class="font-option" data-font="comic-sans" style="font-family: cursive">Comic</button></div><div class="setting-group"><div class="theme-header"><h3>Theme</h3><div class="mode-toggle"><span class="mode-label">Light</span><label class="switch"><input type="checkbox" id="theme-mode-toggle"><span class="slider round"></span></label><span class="mode-label">Dark</span></div></div><div class="theme-options"><button class="theme-option active" data-theme="classic"><div class="theme-preview classic"></div><span>Classic</span></button><button class="theme-option" data-theme="vintage"><div class="theme-preview vintage"></div><span>Vintage</span></button><button class="theme-option" data-theme="lipstick"><div class="theme-preview lipstick"></div><span>Lipstick</span></button><button class="theme-option" data-theme="ocean"><div class="theme-preview ocean"></div><span>Ocean</span></button><button class="theme-option" data-theme="cyber"><div class="theme-preview cyber"></div><span>Cyber</span></button><button class="theme-option" data-theme="nature"><div class="theme-preview nature"></div><span>Nature</span></button></div></div></div></div></div>`, document.getElementById("app-container").appendChild(t), initSettings(), t };

const createImageModal = () => { const t = document.createElement("div"); return t.id = "image-modal", t.className = "image-modal", t.innerHTML = '<div class="image-modal-content"><picture id="modal-picture"><img id="modal-image" src="" alt="Image"></picture><button id="modal-close" class="image-modal-close" title="Close">×</button></div>', document.body.appendChild(t), t };

const createSidebarOverlay = () => {
    // Standard JS overlay for settings or desktop sidebar clicks
    if (document.getElementById("sidebar-overlay")) return;
    const t = document.createElement("div");
    t.id = "sidebar-overlay", t.className = "sidebar-overlay", document.body.appendChild(t),
        t.addEventListener("click", t => {
            if (t.target.closest("aside")) return;

            const container = document.getElementById("app-container");
            if (container.classList.contains("settings-open")) toggleSettings();
            if (container.classList.contains("sidebar-open")) toggleSidebar();
        })
};

// Toggle Sidebar Logic - Mixed Mode (JS + Checkbox)
// If JS is present, we prefer manipulating the class for "Desktop" (which didn't use checkbox before)
// But for "Mobile", we are now using the checkbox.
// Actually, simple solution: 
// The checkbox controls the sidebar. If we want to toggle via JS, we click the checkbox or change its checked state.
const toggleSidebar = () => {
    const container = document.getElementById("app-container");
    const isMobile = window.innerWidth < 768;

    // If settings is open and we're opening the sidebar, close settings first
    if (!container.classList.contains("sidebar-open") && container.classList.contains("settings-open")) {
        container.classList.remove("settings-open");
    }

    // Toggle class
    container.classList.toggle("sidebar-open");
    const isOpen = container.classList.contains("sidebar-open");

    // Manage overlay for mobile
    if (isMobile) {
        createSidebarOverlay();
        const overlay = document.getElementById("sidebar-overlay");
        if (overlay) {
            if (isOpen) {
                overlay.classList.add("active");
            } else {
                overlay.classList.remove("active");
            }
        }
    }
};

const togglePanel = t => {
    const e = document.getElementById("app-container");
    createSidebarOverlay();
    let a = null;

    if ("settings" === t && !document.getElementById("settings-sidebar-container")) {
        a = createSettingsPanel();
    }

    // settings matches 'settings-open' class
    if ("settings" === t) {
        const isOpen = e.classList.contains("settings-open");
        if (isOpen) {
            e.classList.remove("settings-open");
            // Also hide JS overlay
            document.getElementById("sidebar-overlay").classList.remove("active");
        } else {
            // Close sidebar if open
            if (e.classList.contains("sidebar-open")) {
                toggleSidebar(); // uses class list logic now
            }

            e.classList.add("settings-open");
            document.getElementById("sidebar-overlay").classList.add("active");
            syncBionicButtonState();
        }
    } else if ("sidebar" === t) {
        toggleSidebar();
    }
};

const toggleSettings = () => togglePanel("settings");

const updateFontSize = t => { document.querySelector('.content-body').style.fontSize = `${t}px`; const e = document.getElementById("font-size-preview"), n = document.getElementById("font-size-slider"); e && (e.style.fontSize = `${t}px`), n && (n.value = t) };

const updateFontFamily = t => { const e = { original: "serif", montserrat: "system-ui, -apple-system, sans-serif", arial: "Arial, sans-serif", verdana: "Verdana, sans-serif", "roboto-condensed": "'Arial Narrow', sans-serif", "comic-sans": "'Comic Sans MS', cursive" }, n = e[t] || t; document.querySelector('.content-body').style.fontFamily = n; const r = document.getElementById("font-size-preview"); r && (r.style.fontFamily = n), document.querySelectorAll(".font-option[data-font]").forEach(e => e.classList.toggle("active", e.dataset.font === t)) };

const processBionicNode = t => { if (_bionicSet.has(t)) return; const e = document.createTreeWalker(t, NodeFilter.SHOW_TEXT, null), n = []; let r; while (r = e.nextNode()) r.nodeValue.trim().length > 0 && n.push(r); n.forEach(t => { const e = t.nodeValue, n = e.split(/(\s+)/), r = document.createElement("span"); r.className = "bionic-wrapper", n.forEach(t => { if (!t.trim()) return r.appendChild(document.createTextNode(t)), void 0; const e = t.length, n = Math.ceil(e / 2), o = document.createElement("span"); o.className = "b-word"; const a = document.createElement("span"); a.className = "b-bold", a.textContent = t.substring(0, n), o.appendChild(a); const i = document.createElement("span"); i.className = "b-fade", i.textContent = t.substring(n), o.appendChild(i), r.appendChild(o) }), t.parentNode && t.parentNode.replaceChild(r, t) }), _bionicSet.add(t) };

const revertBionicNode = t => { if (!_bionicSet.has(t)) return; const e = t.querySelectorAll(".bionic-wrapper"); e.forEach(t => { t.parentNode && t.parentNode.replaceChild(document.createTextNode(t.textContent), t) }), _bionicSet.delete(t), t.normalize() };

const applyBionicReading = () => { const t = document.querySelector(".content-body"); if (!t) return; t.classList.add("bionic-active"), syncBionicButtonState(), _bionicObserver && _bionicObserver.disconnect(), _bionicSet = new WeakSet, _bionicObserver = new IntersectionObserver(t => { t.forEach(t => { t.isIntersecting ? processBionicNode(t.target) : revertBionicNode(t.target) }) }, { rootMargin: "100% 0px 100% 0px", threshold: 0 }); const e = document.querySelectorAll(".content-body p, .content-body li, .content-body blockquote, #font-size-preview"); e.forEach(t => _bionicObserver.observe(t)) };

const removeBionicReading = () => { const t = document.querySelector(".content-body"); if (!t) return; t.classList.remove("bionic-active"), syncBionicButtonState(), _bionicObserver && (_bionicObserver.disconnect(), _bionicObserver = null); const e = document.querySelectorAll(".bionic-wrapper"); e.forEach(t => { t.parentNode.replaceChild(document.createTextNode(t.textContent), t) }) };

const toggleBionic = () => { document.querySelector(".content-body").classList.contains("bionic-active") ? removeBionicReading() : applyBionicReading() };

const syncBionicButtonState = () => { const t = document.getElementById("bionic-reading-toggle"), e = document.querySelector(".content-body"); t && e && (e.classList.contains("bionic-active") ? t.classList.add("active") : t.classList.remove("active")) };

const themes = { classic: { light: { "--bg-color": "#f4f6f8", "--text-color": "#1f2937", "--sidebar-bg": "#f4f6f8", "--sidebar-border": "#e5e7eb", "--sidebar-text": "#1f2937", "--sidebar-hover-bg": "#e5e7eb", "--topbar-bg": "#f4f6f8", "--topbar-button-hover": "#e5e7eb", "--separator-color": "#e5e7eb", "--link-color": "#2563eb", "--link-visited": "#1d4ed8" }, dark: { "--bg-color": "#000000", "--text-color": "#ffffff", "--sidebar-bg": "#000000", "--sidebar-border": "#333333", "--sidebar-text": "#ffffff", "--sidebar-hover-bg": "#1a1a1a", "--topbar-bg": "#000000", "--topbar-button-hover": "#1a1a1a", "--separator-color": "#333333", "--link-color": "#60a5fa", "--link-visited": "#3b82f6" } }, vintage: { light: { "--bg-color": "#f5e6d3", "--text-color": "#5c4033", "--sidebar-bg": "#f5e6d3", "--sidebar-border": "#e6d2b5", "--sidebar-text": "#5c4033", "--sidebar-hover-bg": "#e6d2b5", "--topbar-bg": "#f5e6d3", "--topbar-button-hover": "#e6d2b5", "--separator-color": "#e6d2b5", "--link-color": "#a0522d", "--link-visited": "#8b4513" }, dark: { "--bg-color": "#2b2b00", "--text-color": "#ffffcc", "--sidebar-bg": "#3d3d00", "--sidebar-border": "#5c5c00", "--sidebar-text": "#ffffcc", "--sidebar-hover-bg": "#5c5c00", "--topbar-bg": "#3d3d00", "--topbar-button-hover": "#5c5c00", "--separator-color": "#5c5c00", "--link-color": "#edc152ff", "--link-visited": "#cccc00" } }, lipstick: { light: { "--bg-color": "#ffc0cb", "--text-color": "#880e4f", "--sidebar-bg": "#ffc0cb", "--sidebar-border": "#ff69b4", "--sidebar-text": "#880e4f", "--sidebar-hover-bg": "#ff69b4", "--topbar-bg": "#ffc0cb", "--topbar-button-hover": "#ff69b4", "--separator-color": "#ff69b4", "--link-color": "#c2185b", "--link-visited": "#880e4f" }, dark: { "--bg-color": "#2a0a18", "--text-color": "#ffd1ea", "--sidebar-bg": "#3d0f23", "--sidebar-border": "#5c1635", "--sidebar-text": "#ffd1ea", "--sidebar-hover-bg": "#5c1635", "--topbar-bg": "#3d0f23", "--topbar-button-hover": "#5c1635", "--separator-color": "#5c1635", "--link-color": "#ff6b9d", "--link-visited": "#ff4d88" } }, ocean: { light: { "--bg-color": "#87ceeb", "--text-color": "#0d47a1", "--sidebar-bg": "#87ceeb", "--sidebar-border": "#4fc3f7", "--sidebar-text": "#0d47a1", "--sidebar-hover-bg": "#4fc3f7", "--topbar-bg": "#87ceeb", "--topbar-button-hover": "#4fc3f7", "--separator-color": "#4fc3f7", "--link-color": "#1565c0", "--link-visited": "#0d47a1" }, dark: { "--bg-color": "#001e3c", "--text-color": "#b4dcff", "--sidebar-bg": "#002850", "--sidebar-border": "#004080", "--sidebar-text": "#b4dcff", "--sidebar-hover-bg": "#004080", "--topbar-bg": "#002850", "--topbar-button-hover": "#004080", "--separator-color": "#004080", "--link-color": "#38bdf8", "--link-visited": "#0ea5e9" } }, cyber: { light: { "--bg-color": "#f9f0ff", "--text-color": "#4b0082", "--sidebar-bg": "#f9f0ff", "--sidebar-border": "#d8bfd8", "--sidebar-text": "#4b0082", "--sidebar-hover-bg": "#d8bfd8", "--topbar-bg": "#f9f0ff", "--topbar-button-hover": "#d8bfd8", "--separator-color": "#d8bfd8", "--link-color": "#9400d3", "--link-visited": "#8a2be2" }, dark: { "--bg-color": "#0a001e", "--text-color": "#ffffff", "--sidebar-bg": "#140028", "--sidebar-border": "#2a0050", "--sidebar-text": "#ffffff", "--sidebar-hover-bg": "#2a0050", "--topbar-bg": "#140028", "--topbar-button-hover": "#2a0050", "--separator-color": "#2a0050", "--link-color": "#ff00ff", "--link-visited": "#d500d5" } }, nature: { light: { "--bg-color": "#f0fff4", "--text-color": "#006400", "--sidebar-bg": "#f0fff4", "--sidebar-border": "#98fb98", "--sidebar-text": "#006400", "--sidebar-hover-bg": "#98fb98", "--topbar-bg": "#f0fff4", "--topbar-button-hover": "#98fb98", "--separator-color": "#98fb98", "--link-color": "#32cd32", "--link-visited": "#228b22" }, dark: { "--bg-color": "#143214", "--text-color": "#c8e6b4", "--sidebar-bg": "#1e461e", "--sidebar-border": "#2d692d", "--sidebar-text": "#c8e6b4", "--sidebar-hover-bg": "#2d692d", "--topbar-bg": "#1e461e", "--topbar-button-hover": "#2d692d", "--separator-color": "#2d692d", "--link-color": "#4ade80", "--link-visited": "#22c55e" } } };
let currentThemeFamily = "classic", currentThemeMode = "dark";
const updateTheme = () => { const t = document.documentElement, e = themes[currentThemeFamily]?.[currentThemeMode]; e && Object.entries(e).forEach(([e, n]) => t.style.setProperty(e, n)); document.body.classList.remove("light-mode", "dark-mode"), document.body.classList.add(`${currentThemeMode}-mode`), document.querySelectorAll(".theme-option").forEach(t => t.classList.toggle("active", t.dataset.theme === currentThemeFamily)); const n = document.getElementById("theme-mode-toggle"); n && (n.checked = "dark" === currentThemeMode) };

const initSettings = () => { updateTheme(), document.getElementById("font-size-slider")?.addEventListener("input", t => updateFontSize(t.target.value)), syncBionicButtonState(); const t = document.querySelector(".settings-content"); t && (t.addEventListener("click", t => { const e = t.target.closest("button"); e && (e.dataset.font && updateFontFamily(e.dataset.font), e.dataset.theme && (currentThemeFamily = e.dataset.theme, updateTheme())) }), document.getElementById("theme-mode-toggle")?.addEventListener("change", t => { currentThemeMode = t.target.checked ? "dark" : "light", updateTheme() })); const e = document.querySelector('.content-body'), n = e ? parseInt(window.getComputedStyle(e).fontSize, 10) : 18, r = document.getElementById("font-size-slider"), o = document.getElementById("font-size-preview"); r && (r.value = n), o && (o.style.fontSize = `${n}px`) };

const toggleFullscreen = () => { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => { }) };
const downloadEpub = () => { const t = getAppData().epub_filename; if (t) { const e = document.createElement("a"); e.href = "../" + t, e.download = t, e.click() } };

const navigateChapter = t => { const e = Array.from(document.querySelectorAll(".chapter[id]")); if (!e.length) return; const n = window.location.hash.substring(1); let r = e.findIndex(t => t.id === n); -1 === r && (r = e.findIndex(t => t.offsetTop >= document.getElementById("main-content").scrollTop) || 0); const a = "next" === t ? r + 1 : r - 1; a >= 0 && a < e.length && (scrollToElement(e[a]), history.replaceState(null, null, "#" + e[a].id)) };

let savedScroll = 0;
const openImageModal = (t, e) => {
    document.getElementById("image-modal") || createImageModal();
    const n = document.getElementById("image-modal");
    const p = document.getElementById("modal-picture");
    const r = document.getElementById("modal-image");

    // Clear dynamic sources
    const sources = p.querySelectorAll("source");
    sources.forEach(s => s.remove());

    if (n && r) {
        // Inject sources if compressed images are available
        const appData = getAppData();
        if (appData.images_compressed && (t.endsWith('.jpg') || t.endsWith('.avif'))) {
            const basePath = t.substring(0, t.lastIndexOf('.'));
            const s1 = document.createElement("source"); s1.srcset = basePath + ".jxl"; s1.type = "image/jxl";
            const s2 = document.createElement("source"); s2.srcset = basePath + ".avif"; s2.type = "image/avif";
            p.prepend(s2);
            p.prepend(s1);
        }

        savedScroll = document.getElementById("main-content").scrollTop;
        r.src = t;
        r.alt = e || "";
        n.classList.add("active");
        document.body.style.overflow = "hidden";
    }
};

const closeImageModal = () => {
    const t = document.getElementById("image-modal");
    if (!t) return;
    t.classList.remove("active");
    document.body.style.overflow = "";
    const e = document.getElementById("modal-image");
    if (e) e.src = "";

    // Clear sources to be clean
    const p = document.getElementById("modal-picture");
    if (p) {
        const sources = p.querySelectorAll("source");
        sources.forEach(s => s.remove());
    }

    document.getElementById("main-content").scrollTo(0, savedScroll);
};


const createTopbar = () => {
    const t = document.getElementById("topbar-container");
    if (!t) return;
    const data = getAppData();
    const e = data.epub_filename || "";

    t.innerHTML = `<div class="top-toolbar"><div class="top-left-controls"><button type="button" title="Show sidebar" aria-label="Show sidebar" id="sidebar-toggle"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5"/></svg></button><button type="button" title="Previous Chapter" aria-label="Previous Chapter" id="prev-chapter"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M12 8a.5.5 0 0 1-.5.5H5.707l2.147 2.146a.5.5 0 0 1-.708.708l-3-3a.5.5 0 0 1 0-.708l3-3a.5.5 0 1 1 .708.708L5.707 7.5H11.5a.5.5 0 0 1 .5.5"/></svg></button><button type="button" title="Next Chapter" aria-label="Next Chapter" id="next-chapter"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M4 8a.5.5 0 0 1 .5-.5h5.793L8.146 5.354a.5.5 0 1 1 .708-.708l3 3a.5.5 0 0 1 0 .708l-3 3a.5.5 0 0 1-.708-.708L10.293 8.5H4.5A.5.5 0 0 1 4 8"/></svg></button></div><div class="top-right-controls"><button id="settings-toggle" class="icon-button" aria-label="Settings"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M11.5 2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3M9.05 3a2.5 2.5 0 0 1 4.9 0H16v1h-2.05a2.5 2.5 0 0 1-4.9 0H0V3zM4.5 7a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3M2.05 8a2.5 2.5 0 0 1 4.9 0H16v1H6.95a2.5 2.5 0 0 1-4.9 0H0V8zm9.45 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3m-2.45 1a2.5 2.5 0 0 1 4.9 0H16v1h-2.05a2.5 2.5 0 0 1-4.9 0H0v-1z"/></svg></button>${e ? `<a href="../${e}" title="Download EPUB" aria-label="Download EPUB" id="download-epub" download><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/><path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708z"/></svg></a>` : ""}<button type="button" title="Toggle fullscreen" aria-label="Toggle fullscreen" id="fullscreen-toggle"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M1.5 1a.5.5 0 0 0-.5.5v4a.5.5 0 0 1-1 0v-4A1.5 1.5 0 0 1 1.5 0h4a.5.5 0 0 1 0 1zM10 .5a.5.5 0 0 1 .5-.5h4A1.5 1.5 0 0 1 16 1.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 1-.5-.5M.5 10a.5.5 0 0 1 .5.5v4a.5.5 0 0 0 .5.5h4a.5.5 0 0 1 0 1h-4A1.5 1.5 0 0 1 0 14.5v-4a.5.5 0 0 1 .5-.5m15 0a.5.5 0 0 1 .5.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a.5.5 0 0 1 0-1h4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 1 .5-.5"/></svg></button></div></div>`;
};

const injectSidebarCover = () => {
    const t = getAppData();
    const header = document.querySelector(".toc-sidebar-header");
    if (!header || !t.cover_image_url) return;

    let n;
    if (t.images_compressed && (t.cover_image_url.endsWith('.jpg') || t.cover_image_url.endsWith('.avif'))) {
        const basePath = t.cover_image_url.substring(0, t.cover_image_url.lastIndexOf('.'));
        n = `<picture>
        <source srcset="${basePath}.jxl" type="image/jxl">
        <source srcset="${basePath}.avif" type="image/avif">
        <img id="book-cover" src="${t.cover_image_url}" alt="Book cover" loading="lazy">
    </picture>`;
    } else {
        n = `<img id="book-cover" src="${t.cover_image_url}" alt="Book cover" loading="lazy">`;
    }

    // Create temp container to turn string into node
    const div = document.createElement('div');
    div.innerHTML = n;
    const imgNode = div.firstElementChild;

    // Insert before the book info div
    header.insertBefore(imgNode, header.firstElementChild);
};

// Event Delegation
document.addEventListener("click", t => {
    // Handle TOC Links explicitly to allow JS-based smooth operations if loaded
    const tocLink = t.target.closest("#toc-list a");
    if (tocLink) {
        handleTocClick(tocLink, t);
        return;
    }

    const e = t.target.closest("button");
    if (e) {
        switch (e.id) {
            case "sidebar-toggle":
                // Manually toggle the checkbox
                toggleSidebar();
                break;
            case "prev-chapter": navigateChapter("prev"); break;
            case "next-chapter": navigateChapter("next"); break;
            case "settings-toggle": case "settings-close": toggleSettings(); break;
            case "download-epub": downloadEpub(); break;
            case "fullscreen-toggle": toggleFullscreen(); break;
            case "modal-close": closeImageModal(); break;
            case "bionic-reading-toggle": toggleBionic(); break;
        }
    }

    const n = t.target.closest("img"); n && n.closest(".content-body") && !document.getElementById("app-container").classList.contains("settings-open") && !document.getElementById("app-container").classList.contains("sidebar-open") && (t.preventDefault(), openImageModal(n.src, n.alt));
    t.target.closest(".image-modal") && !t.target.closest("#modal-image") && closeImageModal();

    // Existing hash link logic
    const r = t.target.closest('a[href^="#"]');
    if (r && !t.defaultPrevented && !tocLink) {
        const e = r.getAttribute("href"), n = document.getElementById(e.substring(1));
        n && (t.preventDefault(), scrollToElement(n), history.replaceState(null, null, e))
    }
});

document.addEventListener("keydown", t => { "Escape" === t.key && closeImageModal(); if (["INPUT", "TEXTAREA"].includes(t.target.tagName)) return; const e = t.key.toLowerCase();["a", "d", "arrowleft", "arrowright"].includes(e) && (t.preventDefault(), "a" === e || "arrowleft" === e ? navigateChapter("prev") : navigateChapter("next")), "f" === e && (t.preventDefault(), toggleFullscreen()) });

document.addEventListener("DOMContentLoaded", () => {
    createTopbar();
    injectSidebarCover();

    const mainContent = document.getElementById("main-content");
    let isNavigating = false;
    let scrollTimeout = null;
    let initialLock = true;

    // Helper to signal manual navigation (prevents scrollspy updates)
    window.setScrollspyNavigating = (state) => {
        isNavigating = state;
    };

    const chapters = Array.from(document.querySelectorAll(".chapter[id]"));

    // Throttled Scrollspy Logic
    const updateActiveChapter = () => {
        if (isNavigating || initialLock || !chapters.length) return;

        const scrollTop = mainContent.scrollTop;
        const containerHeight = mainContent.clientHeight;
        const scrollHeight = mainContent.scrollHeight;

        // 1. Top of page -> Force first chapter
        if (scrollTop < 50) {
            setHash(chapters[0].id);
            return;
        }

        // 2. Bottom of page -> Force last chapter
        if (scrollHeight - scrollTop <= containerHeight + 50) {
            setHash(chapters[chapters.length - 1].id);
            return;
        }

        // 3. Find active chapter based on "reading line" (approx 15% down the screen)
        const readingLine = 100; // px from top
        const containerTop = mainContent.getBoundingClientRect().top;

        let activeId = null;

        // Find the last chapter that has started (top is above reading line)
        for (let i = 0; i < chapters.length; i++) {
            const rect = chapters[i].getBoundingClientRect();
            const relativeTop = rect.top - containerTop;

            if (relativeTop <= readingLine) {
                activeId = chapters[i].id;
            } else {
                // Determine if we should stop
                break;
            }
        }

        if (activeId) {
            setHash(activeId);
        }
    };

    let currentHash = null;
    const setHash = (id) => {
        if (currentHash === id) return;
        currentHash = id;

        if (scrollTimeout) clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            if (history.replaceState) {
                history.replaceState(null, null, "#" + id);
            }
        }, 100);
    };

    // Throttle implementation
    let tick = false;
    mainContent.addEventListener("scroll", () => {
        if (!tick) {
            window.requestAnimationFrame(() => {
                updateActiveChapter();
                tick = false;
            });
            tick = true;
        }
    });

    // Initial Load Handling
    if (window.location.hash) {
        const targetId = window.location.hash.substring(1);
        const target = document.getElementById(targetId);
        if (target) {
            // Set flag immediately
            isNavigating = true;
            // Scroll to element
            scrollToElement(target);
            // Update internal state so we don't overwrite it later
            currentHash = targetId;

            // Release lock after a generous delay to allow layout/scroll to settle
            setTimeout(() => {
                isNavigating = false;
                initialLock = false;
            }, 600);
        } else {
            initialLock = false;
        }
    } else {
        initialLock = false;
    }

    document.addEventListener("fullscreenchange", () => {
        const t = document.fullscreenElement,
            e = document.getElementById("app-container"),
            n = document.querySelector(".top-toolbar");
        e.classList.toggle("is-fullscreen", t), n && n.classList.toggle("fullscreen-hidden", t), !t && n && (n.style.display = "none", n.offsetHeight, n.style.display = "")
    })
});
// --- END: Application Logic ---