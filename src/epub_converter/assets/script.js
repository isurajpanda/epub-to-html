// --- START: Embedded toc_and_topbar.js logic ---

function truncateText(text, maxLength = 50) {
    if (!text || text.length <= maxLength) return text;
    const truncated = text.substring(0, maxLength);
    const lastSpaceIndex = truncated.lastIndexOf(' ');
    return (lastSpaceIndex > maxLength * 0.7)
        ? truncated.substring(0, lastSpaceIndex).trim() + '...'
        : truncated.trim() + '...';
}

function buildTocList(items, onTocClick) {
    const ul = document.createElement('ul');
    const fragment = document.createDocumentFragment();

    for (let i = 0, len = items.length; i < len; i++) {
        const item = items[i];
        const li = document.createElement('li');

        if (item.href) {
            const a = document.createElement('a');
            a.textContent = truncateText(item.label, 45);
            a.title = item.label;
            a.href = item.href;
            a.onclick = (e) => {
                e.preventDefault();
                if (onTocClick) onTocClick(item, e);
            };
            li.appendChild(a);
        } else {
            const span = document.createElement('span');
            span.textContent = truncateText(item.label, 45);
            span.title = item.label;
            span.style.color = 'GrayText';
            li.appendChild(span);
        }

        if (item.children && item.children.length) {
            li.appendChild(buildTocList(item.children, onTocClick));
        }
        fragment.appendChild(li);
    }
    ul.appendChild(fragment);
    return ul;
}
// --- END: Embedded toc_and_topbar.js logic ---

// --- START: Application Logic ---

let _appDataCache = null;
const getAppData = () => {
    if (_appDataCache) return _appDataCache;
    const dataElement = document.getElementById('app-data');
    if (dataElement) {
        try {
            _appDataCache = JSON.parse(dataElement.textContent);
            dataElement.textContent = '';
            dataElement.remove();
        } catch (e) {
            _appDataCache = {};
        }
    } else {
        _appDataCache = {};
    }
    return _appDataCache;
};

// CSS Injection for Memory & Visuals
const injectMemoryStyles = () => {
    const style = document.createElement('style');
    style.textContent = `
        /* Virtualization */
        .chapter {
            content-visibility: auto;
            contain-intrinsic-size: 1px 1000px;
            contain: layout paint style;
        }
        #main-content { will-change: transform, scroll-position; }
        img { content-visibility: auto; }
        
        /* Bionic Reading Visuals */
        .bionic-active .bionic-wrapper { display: inline; }
        .b-word { display: inline; }
        .b-bold { font-weight: 700; }
        .b-fade { opacity: 0.65; } /* Faded effect */
        
        /* Button Active State */
        .font-option.active {
            background-color: var(--link-color);
            color: #ffffff;
            border-color: var(--link-color);
        }
    `;
    document.head.appendChild(style);
};

const handleTocClick = (item, event) => {
    if (window.innerWidth < 768) toggleSidebar();

    if (item.href) {
        const hash = item.href.includes('#') ? item.href.substring(item.href.indexOf('#') + 1) : null;
        if (hash) {
            const targetElement = document.getElementById(hash);
            if (targetElement) {
                if (window.setScrollspyNavigating) window.setScrollspyNavigating(true);

                const mainContent = document.getElementById('main-content');
                const extraPadding = window.innerWidth <= 768 ? 8 : 0;

                const topPos = targetElement.offsetTop - extraPadding;
                mainContent.scrollTo({ top: topPos, behavior: 'auto' });

                history.replaceState(null, null, '#' + hash);

                setTimeout(() => {
                    if (window.setScrollspyNavigating) window.setScrollspyNavigating(false);
                }, 100);
            }
        }
    }
};

const createTopbar = () => {
    const topbarContainer = document.getElementById('topbar-container');
    if (!topbarContainer) return;

    const appData = getAppData();
    const epubFilename = appData.epub_filename || '';

    const htmlParts = [
        '<div class="top-toolbar">',
        '<div class="top-left-controls">',
        '<button type="button" title="Show sidebar" aria-label="Show sidebar" id="sidebar-toggle"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-list" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5"/></svg></button>',
        '<button type="button" title="Previous Chapter" aria-label="Previous Chapter" id="prev-chapter"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-left-short" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M12 8a.5.5 0 0 1-.5.5H5.707l2.147 2.146a.5.5 0 0 1-.708.708l-3-3a.5.5 0 0 1 0-.708l3-3a.5.5 0 1 1 .708.708L5.707 7.5H11.5a.5.5 0 0 1 .5.5"/></svg></button>',
        '<button type="button" title="Next Chapter" aria-label="Next Chapter" id="next-chapter"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-right-short" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M4 8a.5.5 0 0 1 .5-.5h5.793L8.146 5.354a.5.5 0 1 1 .708-.708l3 3a.5.5 0 0 1 0 .708l-3 3a.5.5 0 0 1-.708-.708L10.293 8.5H4.5A.5.5 0 0 1 4 8"/></svg></button>',
        '</div>',
        '<div class="top-right-controls">',
        '<button id="settings-toggle" class="icon-button" aria-label="Settings"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-sliders" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M11.5 2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3M9.05 3a2.5 2.5 0 0 1 4.9 0H16v1h-2.05a2.5 2.5 0 0 1-4.9 0H0V3zM4.5 7a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3M2.05 8a2.5 2.5 0 0 1 4.9 0H16v1H6.95a2.5 2.5 0 0 1-4.9 0H0V8zm9.45 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3m-2.45 1a2.5 2.5 0 0 1 4.9 0H16v1h-2.05a2.5 2.5 0 0 1-4.9 0H0v-1z"/></svg></button>',
        epubFilename ? `<a href="/epub/${epubFilename}" title="Download EPUB" aria-label="Download EPUB" id="download-epub" download><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-download" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/><path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708z"/></svg></a>` : '',
        '<button type="button" title="Toggle fullscreen" aria-label="Toggle fullscreen" id="fullscreen-toggle"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-fullscreen" viewBox="0 0 16 16"><path d="M1.5 1a.5.5 0 0 0-.5.5v4a.5.5 0 0 1-1 0v-4A1.5 1.5 0 0 1 1.5 0h4a.5.5 0 0 1 0 1zM10 .5a.5.5 0 0 1 .5-.5h4A1.5 1.5 0 0 1 16 1.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 1-.5-.5M.5 10a.5.5 0 0 1 .5.5v4a.5.5 0 0 0 .5.5h4a.5.5 0 0 1 0 1h-4A1.5 1.5 0 0 1 0 14.5v-4a.5.5 0 0 1 .5-.5m15 0a.5.5 0 0 1 .5.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a.5.5 0 0 1 0-1h4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 1 .5-.5"/></svg></button>',
        '</div></div>'
    ];
    topbarContainer.innerHTML = htmlParts.join('');
};

const createSidebar = (metadata) => {
    const sidebarContainer = document.createElement('aside');
    sidebarContainer.id = 'sidebar-container';

    const coverHtml = metadata.cover_image_url
        ? `<img id="book-cover" src="${metadata.cover_image_url}" alt="Book cover" loading="lazy">`
        : `<img id="book-cover" src="" alt="Book cover" style="display: none;">`;

    sidebarContainer.innerHTML = `
        <div class="toc-sidebar">
            <div class="toc-sidebar-header">
                ${coverHtml}
                <div class="book-info">
                    <h1 id="book-title">${metadata.title ? truncateText(metadata.title, 60) : ''}</h1>
                    <p id="book-author">${metadata.author ? truncateText(metadata.author, 40) : ''}</p>
                </div>
            </div>
            <div class="toc-view" id="toc-list"></div>
        </div>
    `;

    if (!metadata.title) sidebarContainer.querySelector('#book-title').style.display = 'none';
    if (!metadata.author) sidebarContainer.querySelector('#book-author').style.display = 'none';

    document.getElementById('app-container').appendChild(sidebarContainer);

    const tocList = document.getElementById('toc-list');
    if (metadata.toc && tocList) {
        tocList.appendChild(buildTocList(metadata.toc, handleTocClick));
    }

    return sidebarContainer;
};

const createSettingsPanel = () => {
    const settingsContainer = document.createElement('aside');
    settingsContainer.id = 'settings-sidebar-container';
    settingsContainer.innerHTML = `
        <div class="settings-sidebar">
            <div class="settings-header"><h2>Reader Settings</h2><button id="settings-close" aria-label="Close settings">×</button></div>
            <div class="settings-content">
                <div class="settings-section">
                    <div class="font-size-control">
                        <div id="font-size-preview" class="font-size-preview">Lorem ipsum</div>
                        <div style="margin: 1rem 0;"><button id="bionic-reading-toggle" class="font-option" style="width:100%"><span>Bionic Reading</span></button></div>
                        <h3>Font Size</h3>
                        <div class="slider-container"><span class="size-label small">A</span><input type="range" id="font-size-slider" min="12" max="40" step="2" value="18" aria-label="Font size"><span class="size-label large">A</span></div>
                    </div>
                </div>
                <div class="settings-section">
                    <h3>Font Family</h3>
                    <div class="font-family-grid">
                        <button class="font-option active" data-font="original" style="font-family: serif;">Original</button>
                        <button class="font-option" data-font="montserrat" style="font-family: sans-serif;">Montserrat</button>
                        <button class="font-option" data-font="arial" style="font-family: Arial, sans-serif;">Arial</button>
                        <button class="font-option" data-font="verdana" style="font-family: Verdana, sans-serif;">Verdana</button>
                        <button class="font-option" data-font="roboto-condensed" style="font-family: sans-serif;">Roboto</button>
                        <button class="font-option" data-font="comic-sans" style="font-family: cursive;">Comic</button>
                    </div>
                    <div class="setting-group">
                        <div class="theme-header"><h3>Theme</h3><div class="mode-toggle"><span class="mode-label">Light</span><label class="switch"><input type="checkbox" id="theme-mode-toggle"><span class="slider round"></span></label><span class="mode-label">Dark</span></div></div>
                        <div class="theme-options">
                            <button class="theme-option active" data-theme="classic"><div class="theme-preview classic"></div><span>Classic</span></button>
                            <button class="theme-option" data-theme="vintage"><div class="theme-preview vintage"></div><span>Vintage</span></button>
                            <button class="theme-option" data-theme="lipstick"><div class="theme-preview lipstick"></div><span>Lipstick</span></button>
                            <button class="theme-option" data-theme="ocean"><div class="theme-preview ocean"></div><span>Ocean</span></button>
                            <button class="theme-option" data-theme="cyber"><div class="theme-preview cyber"></div><span>Cyber</span></button>
                            <button class="theme-option" data-theme="nature"><div class="theme-preview nature"></div><span>Nature</span></button>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
    document.getElementById('app-container').appendChild(settingsContainer);
    initSettings();
    return settingsContainer;
};

const createImageModal = () => {
    const modal = document.createElement('div');
    modal.id = 'image-modal';
    modal.className = 'image-modal';
    modal.innerHTML = `<div class="image-modal-content"><img id="modal-image" src="" alt="Image"><button id="modal-close" class="image-modal-close" title="Close">×</button></div>`;
    document.body.appendChild(modal);
    return modal;
};

const createSidebarOverlay = () => {
    if (document.getElementById('sidebar-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'sidebar-overlay';
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => {
        if (!e.target.closest('aside')) {
            const app = document.getElementById('app-container');
            if (app.classList.contains('sidebar-open')) toggleSidebar();
            else if (app.classList.contains('settings-open')) toggleSettings();
        }
    });
};

const togglePanel = (panelType) => {
    const appContainer = document.getElementById('app-container');
    createSidebarOverlay();

    if (panelType === 'sidebar' && !document.getElementById('sidebar-container')) createSidebar(getAppData());
    if (panelType === 'settings' && !document.getElementById('settings-sidebar-container')) createSettingsPanel();

    const targetClass = panelType === 'sidebar' ? 'sidebar-open' : 'settings-open';
    const otherClass = panelType === 'sidebar' ? 'settings-open' : 'sidebar-open';

    appContainer.classList.remove(otherClass);
    appContainer.classList.toggle(targetClass);

    if (window.innerWidth <= 768) {
        const overlay = document.getElementById('sidebar-overlay');
        if (overlay) overlay.classList.toggle('active', appContainer.classList.contains(targetClass));
    }

    // Sync buttons whenever panels are opened
    if (panelType === 'settings') {
        syncBionicButtonState();
    }
};
const toggleSidebar = () => togglePanel('sidebar');
const toggleSettings = () => togglePanel('settings');

const updateFontSize = (size) => {
    document.querySelector('.content-body').style.fontSize = `${size}px`;
    const preview = document.getElementById('font-size-preview');
    if (preview) preview.style.fontSize = `${size}px`;
    const slider = document.getElementById('font-size-slider');
    if (slider) slider.value = size;
};

const updateFontFamily = (font) => {
    const families = {
        'original': 'serif',
        'montserrat': "system-ui, -apple-system, sans-serif",
        'arial': 'Arial, sans-serif',
        'verdana': 'Verdana, sans-serif',
        'roboto-condensed': "'Arial Narrow', sans-serif",
        'comic-sans': "'Comic Sans MS', cursive"
    };
    const family = families[font] || font;
    document.querySelector('.content-body').style.fontFamily = family;
    const preview = document.getElementById('font-size-preview');
    if (preview) preview.style.fontFamily = family;

    document.querySelectorAll('.font-option').forEach(btn =>
        btn.classList.toggle('active', btn.dataset.font === font)
    );
};

// OPTIMIZATION: Transient Bionic Reading
let bionicObserver = null;
const bionicProcessedSet = new WeakSet();

const processBionicNode = (element) => {
    if (bionicProcessedSet.has(element)) return;

    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
        if (node.nodeValue.trim().length > 0) textNodes.push(node);
    }

    const fragment = document.createDocumentFragment();
    textNodes.forEach(textNode => {
        const text = textNode.nodeValue;
        const words = text.split(/(\s+)/);
        const spanWrapper = document.createElement('span');
        spanWrapper.className = 'bionic-wrapper';

        words.forEach(part => {
            if (!part.trim()) {
                spanWrapper.appendChild(document.createTextNode(part));
                return;
            }
            const len = part.length;
            const boldLen = Math.ceil(len / 2);

            const wordSpan = document.createElement('span');
            wordSpan.className = 'b-word';

            const b = document.createElement('b');
            b.className = 'b-bold';
            b.textContent = part.substring(0, boldLen);
            wordSpan.appendChild(b);

            // Wrap remainder in span for fading
            const fade = document.createElement('span');
            fade.className = 'b-fade';
            fade.textContent = part.substring(boldLen);
            wordSpan.appendChild(fade);

            spanWrapper.appendChild(wordSpan);
        });

        if (textNode.parentNode) {
            textNode.parentNode.replaceChild(spanWrapper, textNode);
        }
    });
    bionicProcessedSet.add(element);
};

const revertBionicNode = (element) => {
    if (!bionicProcessedSet.has(element)) return;
    const wrappers = element.querySelectorAll('.bionic-wrapper');
    wrappers.forEach(wrapper => {
        if (wrapper.parentNode) wrapper.parentNode.replaceChild(document.createTextNode(wrapper.textContent), wrapper);
    });
    bionicProcessedSet.delete(element);
    element.normalize();
};

const applyBionicReading = () => {
    const contentBody = document.querySelector('.content-body');
    if (!contentBody) return;

    // Add class immediately to prevent toggle mismatch
    contentBody.classList.add('bionic-active');
    syncBionicButtonState();

    if (bionicObserver) bionicObserver.disconnect();

    // High rootMargin ensures current viewport + buffers are processed immediately
    bionicObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) processBionicNode(entry.target);
            else revertBionicNode(entry.target);
        });
    }, { rootMargin: '200% 0px 200% 0px', threshold: 0 });

    const targets = contentBody.querySelectorAll('p, li, blockquote');
    targets.forEach(t => bionicObserver.observe(t));
};

const removeBionicReading = () => {
    const contentBody = document.querySelector('.content-body');
    if (!contentBody) return;

    contentBody.classList.remove('bionic-active');
    syncBionicButtonState();

    if (bionicObserver) {
        bionicObserver.disconnect();
        bionicObserver = null;
    }

    // Clean up only the wrappers that currently exist (active in DOM)
    // This is fast because off-screen nodes were already reverted by the observer
    const wrappers = contentBody.querySelectorAll('.bionic-wrapper');
    wrappers.forEach(w => {
        w.parentNode.replaceChild(document.createTextNode(w.textContent), w);
    });
};

const toggleBionic = () => {
    const body = document.querySelector('.content-body');
    if (body.classList.contains('bionic-active')) {
        removeBionicReading();
    } else {
        applyBionicReading();
    }
};

const syncBionicButtonState = () => {
    const btn = document.getElementById('bionic-reading-toggle');
    const body = document.querySelector('.content-body');
    if (btn && body) {
        const isActive = body.classList.contains('bionic-active');
        if (isActive) btn.classList.add('active');
        else btn.classList.remove('active');
    }
};

const themes = { classic: { light: { '--bg-color': '#f4f6f8', '--text-color': '#1f2937', '--sidebar-bg': '#f4f6f8', '--sidebar-border': '#e5e7eb', '--sidebar-text': '#1f2937', '--sidebar-hover-bg': '#e5e7eb', '--topbar-bg': '#f4f6f8', '--topbar-button-hover': '#e5e7eb', '--separator-color': '#e5e7eb', '--link-color': '#2563eb', '--link-visited': '#1d4ed8' }, dark: { '--bg-color': '#000000', '--text-color': '#ffffff', '--sidebar-bg': '#000000', '--sidebar-border': '#333333', '--sidebar-text': '#ffffff', '--sidebar-hover-bg': '#1a1a1a', '--topbar-bg': '#000000', '--topbar-button-hover': '#1a1a1a', '--separator-color': '#333333', '--link-color': '#60a5fa', '--link-visited': '#3b82f6' } }, vintage: { light: { '--bg-color': '#f5e6d3', '--text-color': '#5c4033', '--sidebar-bg': '#f5e6d3', '--sidebar-border': '#e6d2b5', '--sidebar-text': '#5c4033', '--sidebar-hover-bg': '#e6d2b5', '--topbar-bg': '#f5e6d3', '--topbar-button-hover': '#e6d2b5', '--separator-color': '#e6d2b5', '--link-color': '#a0522d', '--link-visited': '#8b4513' }, dark: { '--bg-color': '#2b2b00', '--text-color': '#ffffcc', '--sidebar-bg': '#3d3d00', '--sidebar-border': '#5c5c00', '--sidebar-text': '#ffffcc', '--sidebar-hover-bg': '#5c5c00', '--topbar-bg': '#3d3d00', '--topbar-button-hover': '#5c5c00', '--separator-color': '#5c5c00', '--link-color': '#edc152ff', '--link-visited': '#cccc00' } }, lipstick: { light: { '--bg-color': '#ffc0cb', '--text-color': '#880e4f', '--sidebar-bg': '#ffc0cb', '--sidebar-border': '#ff69b4', '--sidebar-text': '#880e4f', '--sidebar-hover-bg': '#ff69b4', '--topbar-bg': '#ffc0cb', '--topbar-button-hover': '#ff69b4', '--separator-color': '#ff69b4', '--link-color': '#c2185b', '--link-visited': '#880e4f' }, dark: { '--bg-color': '#2a0a18', '--text-color': '#ffd1ea', '--sidebar-bg': '#3d0f23', '--sidebar-border': '#5c1635', '--sidebar-text': '#ffd1ea', '--sidebar-hover-bg': '#5c1635', '--topbar-bg': '#3d0f23', '--topbar-button-hover': '#5c1635', '--separator-color': '#5c1635', '--link-color': '#ff6b9d', '--link-visited': '#ff4d88' } }, ocean: { light: { '--bg-color': '#87ceeb', '--text-color': '#0d47a1', '--sidebar-bg': '#87ceeb', '--sidebar-border': '#4fc3f7', '--sidebar-text': '#0d47a1', '--sidebar-hover-bg': '#4fc3f7', '--topbar-bg': '#87ceeb', '--topbar-button-hover': '#4fc3f7', '--separator-color': '#4fc3f7', '--link-color': '#1565c0', '--link-visited': '#0d47a1' }, dark: { '--bg-color': '#001e3c', '--text-color': '#b4dcff', '--sidebar-bg': '#002850', '--sidebar-border': '#004080', '--sidebar-text': '#b4dcff', '--sidebar-hover-bg': '#004080', '--topbar-bg': '#002850', '--topbar-button-hover': '#004080', '--separator-color': '#004080', '--link-color': '#38bdf8', '--link-visited': '#0ea5e9' } }, cyber: { light: { '--bg-color': '#f9f0ff', '--text-color': '#4b0082', '--sidebar-bg': '#f9f0ff', '--sidebar-border': '#d8bfd8', '--sidebar-text': '#4b0082', '--sidebar-hover-bg': '#d8bfd8', '--topbar-bg': '#f9f0ff', '--topbar-button-hover': '#d8bfd8', '--separator-color': '#d8bfd8', '--link-color': '#9400d3', '--link-visited': '#8a2be2' }, dark: { '--bg-color': '#0a001e', '--text-color': '#ffffff', '--sidebar-bg': '#140028', '--sidebar-border': '#2a0050', '--sidebar-text': '#ffffff', '--sidebar-hover-bg': '#2a0050', '--topbar-bg': '#140028', '--topbar-button-hover': '#2a0050', '--separator-color': '#2a0050', '--link-color': '#ff00ff', '--link-visited': '#d500d5' } }, nature: { light: { '--bg-color': '#f0fff4', '--text-color': '#006400', '--sidebar-bg': '#f0fff4', '--sidebar-border': '#98fb98', '--sidebar-text': '#006400', '--sidebar-hover-bg': '#98fb98', '--topbar-bg': '#f0fff4', '--topbar-button-hover': '#98fb98', '--separator-color': '#98fb98', '--link-color': '#32cd32', '--link-visited': '#228b22' }, dark: { '--bg-color': '#143214', '--text-color': '#c8e6b4', '--sidebar-bg': '#1e461e', '--sidebar-border': '#2d692d', '--sidebar-text': '#c8e6b4', '--sidebar-hover-bg': '#2d692d', '--topbar-bg': '#1e461e', '--topbar-button-hover': '#2d692d', '--separator-color': '#2d692d', '--link-color': '#4ade80', '--link-visited': '#22c55e' } } };

let currentThemeFamily = 'classic';
let currentThemeMode = 'dark';

const updateTheme = () => {
    const root = document.documentElement;
    const theme = themes[currentThemeFamily]?.[currentThemeMode];
    if (theme) {
        for (const [prop, val] of Object.entries(theme)) root.style.setProperty(prop, val);
    }
    document.body.classList.remove('light-mode', 'dark-mode');
    document.body.classList.add(`${currentThemeMode}-mode`);
    document.querySelectorAll('.theme-option').forEach(btn =>
        btn.classList.toggle('active', btn.dataset.theme === currentThemeFamily)
    );
    const toggle = document.getElementById('theme-mode-toggle');
    if (toggle) toggle.checked = currentThemeMode === 'dark';
};

const initSettings = () => {
    updateTheme();
    document.getElementById('font-size-slider')?.addEventListener('input', e => updateFontSize(e.target.value));

    // Explicitly sync the button state when settings initialize
    syncBionicButtonState();

    const container = document.querySelector('.settings-content');
    if (container) {
        container.addEventListener('click', e => {
            const btn = e.target.closest('button');
            if (!btn) return;
            if (btn.dataset.font) updateFontFamily(btn.dataset.font);
            if (btn.dataset.theme) {
                currentThemeFamily = btn.dataset.theme;
                updateTheme();
            }
        });
        document.getElementById('theme-mode-toggle')?.addEventListener('change', e => {
            currentThemeMode = e.target.checked ? 'dark' : 'light';
            updateTheme();
        });
    }
    updateFontSize('18');
};

const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => { });
    else document.exitFullscreen();
};

const downloadEpub = () => {
    const fn = getAppData().epub_filename;
    if (fn) {
        const a = document.createElement('a');
        a.href = '../' + fn;
        a.download = fn;
        a.click();
    }
};

const navigateChapter = (dir) => {
    const chapters = Array.from(document.querySelectorAll('.chapter[id]'));
    if (!chapters.length) return;
    const main = document.getElementById('main-content');
    const scroll = main.scrollTop;
    const height = main.clientHeight;
    let target = null;
    if (dir === 'next') {
        target = chapters.find(ch => ch.offsetTop >= scroll + height);
        if (!target) target = chapters[chapters.length - 1];
    } else {
        for (let i = chapters.length - 1; i >= 0; i--) {
            if (chapters[i].offsetTop < scroll - 50) {
                target = chapters[i];
                break;
            }
        }
        if (!target) target = chapters[0];
    }
    if (target) main.scrollTo({ top: target.offsetTop, behavior: 'auto' });
};

let savedScroll = 0;
const openImageModal = (src, alt) => {
    if (!document.getElementById('image-modal')) createImageModal();
    const modal = document.getElementById('image-modal');
    const img = document.getElementById('modal-image');
    if (!modal || !img) return;

    savedScroll = document.getElementById('main-content').scrollTop;
    img.src = src;
    img.alt = alt || '';
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
};

const closeImageModal = () => {
    const modal = document.getElementById('image-modal');
    if (!modal) return;
    modal.classList.remove('active');
    document.body.style.overflow = '';
    const img = document.getElementById('modal-image');
    if (img) img.src = '';
    document.getElementById('main-content').scrollTo(0, savedScroll);
};

document.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (btn) {
        const id = btn.id;
        if (id === 'sidebar-toggle') toggleSidebar();
        else if (id === 'prev-chapter') navigateChapter('prev');
        else if (id === 'next-chapter') navigateChapter('next');
        else if (id === 'settings-toggle' || id === 'settings-close') toggleSettings();
        else if (id === 'download-epub') downloadEpub();
        else if (id === 'fullscreen-toggle') toggleFullscreen();
        else if (id === 'modal-close') closeImageModal();
        else if (id === 'bionic-reading-toggle') toggleBionic();
    }

    const img = e.target.closest('img');
    if (img && img.closest('.content-body')) {
        const app = document.getElementById('app-container');
        if (!app.classList.contains('sidebar-open') && !app.classList.contains('settings-open')) {
            e.preventDefault();
            openImageModal(img.src, img.alt);
        }
    }

    if (e.target.id === 'image-modal' && !e.target.closest('#modal-image')) closeImageModal();

    const link = e.target.closest('a[href^="#"]');
    if (link && !e.defaultPrevented) {
        const hash = link.getAttribute('href');
        const el = document.getElementById(hash.substring(1));
        if (el) {
            e.preventDefault();
            document.getElementById('main-content').scrollTo(0, el.offsetTop);
            history.replaceState(null, null, hash);
        }
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeImageModal();
    if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (['a', 'd', 'arrowleft', 'arrowright'].includes(k)) {
        e.preventDefault();
        if (k === 'a' || k === 'arrowleft') navigateChapter('prev');
        else navigateChapter('next');
    } else if (k === 'f') {
        e.preventDefault();
        toggleFullscreen();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    injectMemoryStyles();
    createTopbar();
    const main = document.getElementById('main-content');
    let isNav = false;
    window.setScrollspyNavigating = (v) => isNav = v;
    let timer = null;
    const chapters = Array.from(document.querySelectorAll('.chapter[id]'));
    if (chapters.length) {
        const observer = new IntersectionObserver((entries) => {
            if (isNav) return;
            const visible = entries.reduce((max, entry) => entry.intersectionRatio > max.intersectionRatio ? entry : max);
            if (visible.intersectionRatio > 0 && visible.target.id !== window.location.hash.substring(1)) {
                if (timer) clearTimeout(timer);
                timer = setTimeout(() => {
                    history.replaceState(null, null, '#' + visible.target.id);
                }, 150);
            }
        }, { root: main, threshold: [0, 0.1] });
        chapters.forEach(c => observer.observe(c));
    }
    if (window.location.hash) {
        setTimeout(() => {
            const el = document.getElementById(window.location.hash.substring(1));
            if (el) main.scrollTo(0, el.offsetTop);
        }, 50);
    }
    document.addEventListener('fullscreenchange', () => {
        const isFs = document.fullscreenElement;
        const app = document.getElementById('app-container');
        const toolbar = document.querySelector('.top-toolbar');
        app.classList.toggle('is-fullscreen', isFs);
        if (toolbar) toolbar.classList.toggle('fullscreen-hidden', isFs);
        if (!isFs && toolbar) { toolbar.style.display = 'none'; toolbar.offsetHeight; toolbar.style.display = ''; }
    });
});
// --- END: Application Logic ---