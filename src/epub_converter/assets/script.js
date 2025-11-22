// --- START: Embedded toc_and_topbar.js logic ---
// (The 'export' keyword has been removed to work in a single script tag)

function truncateText(text, maxLength = 50) {
    if (!text || text.length <= maxLength) {
        return text;
    }

    // Try to cut at a word boundary if possible
    const truncated = text.substring(0, maxLength);
    const lastSpaceIndex = truncated.lastIndexOf(' ');

    // If we can find a good word boundary and it's not too short, use it
    if (lastSpaceIndex > maxLength * 0.7) {
        return truncated.substring(0, lastSpaceIndex).trim() + '...';
    }

    // Otherwise, just cut at the character limit
    return truncated.trim() + '...';
}

function buildTocList(items, onTocClick) {
    const ul = document.createElement('ul');
    for (const item of items) {
        const li = document.createElement('li');
        if (item.href) {
            const a = document.createElement('a');
            a.textContent = truncateText(item.label, 45); // Truncate TOC labels to 45 characters
            a.title = item.label; // Add full label as tooltip
            // Use actual anchor href for standard navigation
            a.href = item.href;
            // Handle click to use custom scroll that accounts for topbar
            a.onclick = e => {
                e.preventDefault(); // Prevent default anchor behavior
                if (onTocClick) onTocClick(item, e);
            };
            li.appendChild(a);
        } else {
            const span = document.createElement('span');
            span.textContent = truncateText(item.label, 45); // Truncate TOC labels to 45 characters
            span.title = item.label; // Add full label as tooltip
            span.style.color = 'GrayText';
            li.appendChild(span);
        }
        if (item.children && item.children.length) {
            li.appendChild(buildTocList(item.children, onTocClick));
        }
        ul.appendChild(li);
    }
    return ul;
}
// --- END: Embedded toc_and_topbar.js logic ---

// --- START: Application Logic ---

// Lazy Load Generators

const handleTocClick = (item, event) => {
    // Close sidebar on mobile
    if (window.innerWidth < 768) {
        toggleSidebar();
    }

    // Navigate to the target using custom scroll that accounts for topbar
    if (item.href) {
        // Extract just the hash from href (e.g., "#chapter-1")
        const hash = item.href.includes('#') ? item.href.substring(item.href.indexOf('#') + 1) : null;
        if (hash) {
            const targetElement = document.getElementById(hash);
            if (targetElement) {
                const mainContent = document.getElementById('main-content');
                const topbarContainer = document.getElementById('topbar-container');
                const topbarHeight = topbarContainer ? topbarContainer.offsetHeight : 0;

                // Disable scrollspy observer during navigation
                if (window.setScrollspyNavigating) {
                    window.setScrollspyNavigating(true);
                }

                // Account for topbar height so content at the top isn't covered
                // On mobile, add extra padding (8px) for better visibility
                const extraPadding = window.innerWidth <= 768 ? 8 : 0;
                // Content wrapper has margin-top, so we don't need to subtract topbarHeight
                const scrollPosition = Math.max(0, targetElement.offsetTop - extraPadding);

                if (mainContent) {
                    mainContent.scrollTo(0, scrollPosition);
                }

                // Update URL hash without creating history entry
                // Always use replaceState to avoid polluting browser history
                history.replaceState(null, null, '#' + hash);

                // Re-enable scrollspy after a delay to let scroll settle
                setTimeout(() => {
                    if (window.setScrollspyNavigating) {
                        window.setScrollspyNavigating(false);
                    }
                }, 500);
            }
        }
    }
};

const createTopbar = () => {
    const topbarContainer = document.getElementById('topbar-container');
    if (!topbarContainer) return;

    // Get epub filename from metadata
    const appDataElement = document.getElementById('app-data');
    let epubFilename = '';
    if (appDataElement) {
        try {
            const appData = JSON.parse(appDataElement.textContent);
            epubFilename = appData.epub_filename || '';
        } catch (e) {
            console.error('Error parsing app data:', e);
        }
    }

    topbarContainer.innerHTML = `
        <div class="top-toolbar">
            <div class="top-left-controls">
                <button type="button" title="Show sidebar" aria-label="Show sidebar" id="sidebar-toggle">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor"
                        class="bi bi-list" viewBox="0 0 16 16">
                        <path fill-rule="evenodd"
                            d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5" />
                    </svg>
                </button>
                <button type="button" title="Previous Chapter" aria-label="Previous Chapter" id="prev-chapter">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor"
                        class="bi bi-arrow-left-short" viewBox="0 0 16 16">
                        <path fill-rule="evenodd"
                            d="M12 8a.5.5 0 0 1-.5.5H5.707l2.147 2.146a.5.5 0 0 1-.708.708l-3-3a.5.5 0 0 1 0-.708l3-3a.5.5 0 1 1 .708.708L5.707 7.5H11.5a.5.5 0 0 1 .5.5" />
                    </svg>
                </button>
                <button type="button" title="Next Chapter" aria-label="Next Chapter" id="next-chapter">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor"
                        class="bi bi-arrow-right-short" viewBox="0 0 16 16">
                        <path fill-rule="evenodd"
                            d="M4 8a.5.5 0 0 1 .5-.5h5.793L8.146 5.354a.5.5 0 1 1 .708-.708l3 3a.5.5 0 0 1 0 .708l-3 3a.5.5 0 0 1-.708-.708L10.293 8.5H4.5A.5.5 0 0 1 4 8" />
                    </svg>
                </button>
            </div>
            <div class="top-right-controls">
                <button id="settings-toggle" class="icon-button" aria-label="Settings">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor"
                        class="bi bi-sliders" viewBox="0 0 16 16">
                        <path fill-rule="evenodd"
                            d="M11.5 2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3M9.05 3a2.5 2.5 0 0 1 4.9 0H16v1h-2.05a2.5 2.5 0 0 1-4.9 0H0V3zM4.5 7a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3M2.05 8a2.5 2.5 0 0 1 4.9 0H16v1H6.95a2.5 2.5 0 0 1-4.9 0H0V8zm9.45 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3m-2.45 1a2.5 2.5 0 0 1 4.9 0H16v1h-2.05a2.5 2.5 0 0 1-4.9 0H0v-1z" />
                    </svg>
                </button>
                ${epubFilename ? `<a href="/epub/${epubFilename}" title="Download EPUB" aria-label="Download EPUB" id="download-epub" download>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor"
                        class="bi bi-download" viewBox="0 0 16 16">
                        <path
                            d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5" />
                        <path
                            d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708z" />
                    </svg>
                </a>` : ''}
                <button type="button" title="Toggle fullscreen" aria-label="Toggle fullscreen"
                    id="fullscreen-toggle">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor"
                        class="bi bi-fullscreen" viewBox="0 0 16 16">
                        <path
                            d="M1.5 1a.5.5 0 0 0-.5.5v4a.5.5 0 0 1-1 0v-4A1.5 1.5 0 0 1 1.5 0h4a.5.5 0 0 1 0 1zM10 .5a.5.5 0 0 1 .5-.5h4A1.5 1.5 0 0 1 16 1.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 1-.5-.5M.5 10a.5.5 0 0 1 .5.5v4a.5.5 0 0 0 .5.5h4a.5.5 0 0 1 0 1h-4A1.5 1.5 0 0 1 0 14.5v-4a.5.5 0 0 1 .5-.5m15 0a.5.5 0 0 1 .5.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a.5.5 0 0 1 0-1h4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 1 .5-.5" />
                    </svg>
                </button>
            </div>
        </div>
    `;
};


const createSidebar = (metadata) => {
    const sidebarContainer = document.createElement('aside');
    sidebarContainer.id = 'sidebar-container';
    sidebarContainer.innerHTML = `
        <div class="toc-sidebar">
            <div class="toc-sidebar-header">
                ${metadata.cover_image_url ? `<img id="book-cover" src="${metadata.cover_image_url}" alt="Book cover" loading="lazy">` : `<img id="book-cover" src="" alt="Book cover" style="display: none;">`}
                <div class="book-info">
                    <h1 id="book-title" style="${metadata.title ? '' : 'display: none;'}">${metadata.title ? truncateText(metadata.title, 60) : ''}</h1>
                    <p id="book-author" style="${metadata.author ? '' : 'display: none;'}">${metadata.author ? truncateText(metadata.author, 40) : ''}</p>
                </div>
            </div>
            <div class="toc-view" id="toc-list">
            </div>
        </div>
    `;
    document.getElementById('app-container').appendChild(sidebarContainer);

    // Populate TOC
    const tocList = document.getElementById('toc-list');
    if (metadata.toc && tocList) {
        tocList.appendChild(buildTocList(metadata.toc, handleTocClick));
    }

    // Add title tooltips
    if (metadata.title) document.getElementById('book-title').title = metadata.title;
    if (metadata.author) document.getElementById('book-author').title = metadata.author;

    return sidebarContainer;
};

const createSettingsPanel = () => {
    const settingsContainer = document.createElement('aside');
    settingsContainer.id = 'settings-sidebar-container';
    settingsContainer.innerHTML = `
        <div class="settings-sidebar">
            <div class="settings-header">
                <h2>Reader Settings</h2>
                <button id="settings-close" aria-label="Close settings">×</button>
            </div>
            <div class="settings-content">
                <!-- Font Size Section -->
                <div class="settings-section">
                    <div class="font-size-control">
                        <div id="font-size-preview" class="font-size-preview">Lorem ipsum</div>

                        <!-- Bionic Reading Button -->
                        <div style="margin-top: 1rem; margin-bottom: 1rem;">
                            <button id="bionic-reading-toggle" class="font-option" data-no-bionic="true"
                                style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                                <span>Bionic Reading</span>
                            </button>
                        </div>

                        <h3>Font Size</h3>
                        <div class="slider-container">
                            <span class="size-label small">A</span>
                            <input type="range" id="font-size-slider" min="12" max="40" step="2" value="18"
                                aria-label="Font size">
                            <span class="size-label large">A</span>
                        </div>
                    </div>
                </div>

                <!-- Font Family Section -->
                <div class="settings-section">
                    <h3>Font Family</h3>
                    <div class="font-family-grid">
                        <button class="font-option active" data-font="original"
                            style="font-family: serif;">Original</button>
                        <button class="font-option" data-font="montserrat"
                            style="font-family: 'Montserrat', sans-serif;">Montserrat</button>
                        <button class="font-option" data-font="arial"
                            style="font-family: Arial, sans-serif;">Arial</button>
                        <button class="font-option" data-font="verdana"
                            style="font-family: Verdana, sans-serif;">Verdana</button>
                        <button class="font-option" data-font="roboto-condensed"
                            style="font-family: 'Roboto Condensed', sans-serif;">Roboto</button>
                        <button class="font-option" data-font="comic-sans"
                            style="font-family: 'Comic Sans MS', cursive;">Comic</button>
                    </div>


                    <div class="setting-group">
                        <div class="theme-header">
                            <h3>Theme</h3>
                            <div class="mode-toggle">
                                <span class="mode-label">Light</span>
                                <label class="switch">
                                    <input type="checkbox" id="theme-mode-toggle" aria-label="Toggle Dark Mode">
                                    <span class="slider round"></span>
                                </label>
                                <span class="mode-label">Dark</span>
                            </div>
                        </div>
                        <div class="theme-options">
                            <button class="theme-option active" data-theme="classic" aria-label="Classic theme">
                                <div class="theme-preview classic"></div>
                                <span>Classic</span>
                            </button>
                            <button class="theme-option" data-theme="vintage" aria-label="Vintage theme">
                                <div class="theme-preview vintage"></div>
                                <span>Vintage</span>
                            </button>
                            <button class="theme-option" data-theme="lipstick" aria-label="Lipstick theme">
                                <div class="theme-preview lipstick"></div>
                                <span>Lipstick</span>
                            </button>
                            <button class="theme-option" data-theme="ocean" aria-label="Ocean theme">
                                <div class="theme-preview ocean"></div>
                                <span>Ocean</span>
                            </button>
                            <button class="theme-option" data-theme="cyber" aria-label="Cyber theme">
                                <div class="theme-preview cyber"></div>
                                <span>Cyber</span>
                            </button>
                            <button class="theme-option" data-theme="nature" aria-label="Nature theme">
                                <div class="theme-preview nature"></div>
                                <span>Nature</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.getElementById('app-container').appendChild(settingsContainer);

    // Initialize settings logic now that elements exist
    initSettings();

    return settingsContainer;
};

const createImageModal = () => {
    const modal = document.createElement('div');
    modal.id = 'image-modal';
    modal.className = 'image-modal';
    modal.innerHTML = `
        <div class="image-modal-content">
            <img id="modal-image" src="" alt="Image">
            <button id="modal-close" class="image-modal-close" title="Close">×</button>
        </div>
    `;
    document.body.appendChild(modal);
    return modal;
};

const createSidebarOverlay = () => {
    if (document.getElementById('sidebar-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'sidebar-overlay';
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);

    // Add click listener to close panels
    overlay.addEventListener('click', (event) => {
        // Don't close if clicking on the sidebar itself (though overlay should be behind it)
        if (event.target.closest('#sidebar-container') || event.target.closest('#settings-sidebar-container')) {
            return;
        }

        // Close any open panel when overlay is clicked
        const appContainer = document.getElementById('app-container');
        if (appContainer) {
            event.preventDefault();
            event.stopPropagation();

            if (appContainer.classList.contains('sidebar-open')) {
                toggleSidebar();
            } else if (appContainer.classList.contains('settings-open')) {
                toggleSettings();
            }
        }
    });
};


// Define handlers that work immediately
const togglePanel = (panelType) => {
    const appContainer = document.getElementById('app-container');

    // Ensure overlay exists
    createSidebarOverlay();
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    if (!appContainer) return;

    const isSidebar = panelType === 'sidebar';
    const isSettings = panelType === 'settings';

    // Lazy load panels if they don't exist
    if (isSidebar && !document.getElementById('sidebar-container')) {
        const appData = JSON.parse(document.getElementById('app-data').textContent);
        createSidebar(appData);
    }

    if (isSettings && !document.getElementById('settings-sidebar-container')) {
        createSettingsPanel();
    }

    const targetClass = isSidebar ? 'sidebar-open' : 'settings-open';
    const otherClass = isSidebar ? 'settings-open' : 'sidebar-open';

    // Close the other panel if it's open (mutual exclusivity)
    if (appContainer.classList.contains(otherClass)) {
        appContainer.classList.remove(otherClass);
    }

    // Toggle the target panel
    const isOpening = !appContainer.classList.contains(targetClass);

    // Force a reflow before adding class to ensure transition plays if we just created it
    if (isOpening && ((isSidebar && !document.getElementById('sidebar-container').offsetHeight) || (isSettings && !document.getElementById('settings-sidebar-container').offsetHeight))) {
        // void
    }

    // Small delay to allow DOM insertion to complete if just created
    requestAnimationFrame(() => {
        appContainer.classList.toggle(targetClass);

        // Handle overlay for mobile
        if (window.innerWidth <= 768) {
            if (sidebarOverlay) {
                if (isOpening) {
                    sidebarOverlay.classList.add('active');
                } else {
                    // Only remove overlay if no panels are open
                    if (!appContainer.classList.contains('sidebar-open') &&
                        !appContainer.classList.contains('settings-open')) {
                        sidebarOverlay.classList.remove('active');
                    }
                }
            }
        }
    });
};

const toggleSidebar = () => togglePanel('sidebar');
const toggleSettings = () => togglePanel('settings');


// Settings Logic
const updateFontSize = (size) => {
    const contentBody = document.querySelector('.content-body');
    const slider = document.getElementById('font-size-slider');
    if (!contentBody) return; // Slider might not exist yet if settings not opened

    // Size mapping: 1=xs, 2=base, 3=lg, 4=xl, 5=2xl
    const sizeClasses = ['text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl'];
    const sizeIndex = parseInt(size) - 1;

    // Remove all size classes
    sizeClasses.forEach(cls => contentBody.classList.remove(cls));

    // Add new size class
    if (sizeIndex >= 0 && sizeIndex < sizeClasses.length) {
        contentBody.classList.add(sizeClasses[sizeIndex]);
    }

    // Update slider value if needed (e.g. on load)
    if (slider && slider.value !== size) slider.value = size;

    // Update preview text size
    const preview = document.getElementById('font-size-preview');
    if (preview) {
        // Remove existing size classes from preview
        sizeClasses.forEach(cls => preview.classList.remove(cls));
        // Add new size class
        if (sizeIndex >= 0 && sizeIndex < sizeClasses.length) {
            preview.classList.add(sizeClasses[sizeIndex]);
        }
    }

    // localStorage removed - no storage
};

// Lazy load Google Fonts
const loadedFonts = new Set();

const loadGoogleFont = (fontName) => {
    if (loadedFonts.has(fontName)) return;

    let fontUrl = '';
    if (fontName === 'montserrat') {
        fontUrl = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap';
    } else if (fontName === 'roboto-condensed') {
        fontUrl = 'https://fonts.googleapis.com/css2?family=Roboto+Condensed:wght@400;700&display=swap';
    }

    if (fontUrl) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = fontUrl;
        document.head.appendChild(link);
        loadedFonts.add(fontName);
    }
};

const updateFontFamily = (font) => {
    const contentBody = document.querySelector('.content-body');
    const fontSizePreview = document.getElementById('font-size-preview');

    if (!contentBody) return;

    // Lazy load Google Fonts if needed
    if (font === 'montserrat' || font === 'roboto-condensed') {
        loadGoogleFont(font);
    }

    let fontFamily = '';
    if (font === 'original') {
        fontFamily = 'serif';
    } else if (font === 'montserrat') {
        fontFamily = "'Montserrat', sans-serif";
    } else if (font === 'arial') {
        fontFamily = 'Arial, sans-serif';
    } else if (font === 'verdana') {
        fontFamily = 'Verdana, sans-serif';
    } else if (font === 'roboto-condensed') {
        fontFamily = "'Roboto Condensed', sans-serif";
    } else if (font === 'comic-sans') {
        fontFamily = "'Comic Sans MS', cursive";
    } else {
        fontFamily = font;
    }

    contentBody.style.fontFamily = fontFamily;

    // Also apply to preview
    if (fontSizePreview) {
        fontSizePreview.style.fontFamily = fontFamily;
    }

    // Update active state in UI (only for font family buttons)
    const buttons = document.querySelectorAll('.font-option[data-font]');
    if (buttons.length > 0) {
        buttons.forEach(btn => {
            if (btn.dataset.font === font) btn.classList.add('active');
            else btn.classList.remove('active');
        });
    }

    // localStorage removed - no storage
};

// Bionic Reading Logic
// Bionic Reading Logic
let bionicObserver = null;

const processBionicElement = (element) => {
    if (element.dataset.bionicProcessed === 'true') return;

    // Use TreeWalker to find all text nodes within this specific element
    const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: (node) => {
                // Skip if empty
                if (!node.textContent.trim()) return NodeFilter.FILTER_REJECT;
                // Skip if parent is already processed
                if (node.parentElement.classList.contains('b-word') ||
                    node.parentElement.classList.contains('b-bold') ||
                    node.parentElement.classList.contains('b-fade')) {
                    return NodeFilter.FILTER_REJECT;
                }
                // Skip script, style, buttons, etc.
                const tag = node.parentElement.tagName.toLowerCase();
                if (tag === 'script' || tag === 'style' || tag === 'noscript' || tag === 'button') return NodeFilter.FILTER_REJECT;

                // Also check if any ancestor is a button or has data-no-bionic
                let parent = node.parentElement;
                while (parent && parent !== element) {
                    if (parent.tagName.toLowerCase() === 'button' || parent.dataset.noBionic === 'true') {
                        return NodeFilter.FILTER_REJECT;
                    }
                    parent = parent.parentElement;
                }

                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );

    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
        textNodes.push(node);
    }

    textNodes.forEach(textNode => {
        const text = textNode.textContent;
        const parts = text.split(/(\s+)/);
        const fragment = document.createDocumentFragment();

        parts.forEach(part => {
            if (!part.trim()) {
                // Preserve whitespace as text node (not wrapped)
                fragment.appendChild(document.createTextNode(part));
                return;
            }

            const word = part;
            const len = word.length;

            if (len === 1) {
                const span = document.createElement('span');
                span.className = 'b-word';
                const b = document.createElement('b');
                b.className = 'b-bold';
                b.textContent = word;
                span.appendChild(b);
                fragment.appendChild(span);
            } else {
                let boldLen = Math.ceil(len / 2);
                const boldPart = word.substring(0, boldLen);
                const fadePart = word.substring(boldLen);

                const span = document.createElement('span');
                span.className = 'b-word';

                const b = document.createElement('b');
                b.className = 'b-bold';
                b.textContent = boldPart;

                const s = document.createElement('span');
                s.className = 'b-fade';
                s.textContent = fadePart;

                span.appendChild(b);
                span.appendChild(s);
                fragment.appendChild(span);
            }
        });

        if (textNode.parentNode) {
            textNode.parentNode.replaceChild(fragment, textNode);
        }
    });

    element.dataset.bionicProcessed = 'true';
};

const applyBionicReading = () => {
    const contentBody = document.querySelector('.content-body');
    if (!contentBody) return;

    if (contentBody.classList.contains('bionic-active')) return;
    contentBody.classList.add('bionic-active');
    // localStorage removed - no storage

    // Disconnect existing observer if any
    if (bionicObserver) {
        bionicObserver.disconnect();
    }

    // Create new observer
    bionicObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                processBionicElement(entry.target);
                // Stop observing once processed to save resources
                bionicObserver.unobserve(entry.target);
            }
        });
    }, {
        root: null, // viewport
        rootMargin: '500px 0px', // Pre-load content well ahead of scrolling
        threshold: 0.01
    });

    // Observe block-level elements that contain text
    // We target p, div, li, h1-h6 to be granular enough
    const targets = contentBody.querySelectorAll('p, div, li, h1, h2, h3, h4, h5, h6, blockquote');

    // If no specific tags found (e.g. plain text file wrapped in pre), fallback to body
    if (targets.length === 0) {
        processBionicElement(contentBody);
    } else {
        targets.forEach(target => bionicObserver.observe(target));
    }

    // Apply to preview text as well
    const preview = document.getElementById('font-size-preview');
    if (preview) {
        processBionicElement(preview);
    }
};

const removeBionicReading = () => {
    const contentBody = document.querySelector('.content-body');
    if (!contentBody) return;

    if (bionicObserver) {
        bionicObserver.disconnect();
        bionicObserver = null;
    }

    if (!contentBody.classList.contains('bionic-active')) return;
    contentBody.classList.remove('bionic-active');
    // localStorage removed - no storage

    // Remove all bionic spans
    // This might still be heavy if the user read the whole book, but it's necessary.
    // We can chunk this too if needed, but let's keep it simple for now.
    const bWords = contentBody.querySelectorAll('.b-word');

    bWords.forEach(span => {
        const originalText = span.textContent;
        const textNode = document.createTextNode(originalText);
        if (span.parentNode) {
            span.parentNode.replaceChild(textNode, span);
        }
    });

    // Clean up processed flags
    const processed = contentBody.querySelectorAll('[data-bionic-processed="true"]');
    processed.forEach(el => delete el.dataset.bionicProcessed);

    contentBody.normalize();

    // Remove from preview text as well
    const preview = document.getElementById('font-size-preview');
    if (preview) {
        const bWords = preview.querySelectorAll('.b-word');
        bWords.forEach(span => {
            const originalText = span.textContent;
            const textNode = document.createTextNode(originalText);
            if (span.parentNode) {
                span.parentNode.replaceChild(textNode, span);
            }
        });
        delete preview.dataset.bionicProcessed;
        preview.normalize();
    }
};

let currentThemeFamily = 'classic';
let currentThemeMode = 'dark'; // Default to dark mode

const themes = {
    classic: {
        light: {
            '--bg-color': '#f4f6f8',
            '--text-color': '#1f2937',
            '--sidebar-bg': '#f4f6f8',
            '--sidebar-border': '#e5e7eb',
            '--sidebar-text': '#1f2937',
            '--sidebar-hover-bg': '#e5e7eb',
            '--topbar-bg': '#f4f6f8',
            '--topbar-button-hover': '#e5e7eb',
            '--separator-color': '#e5e7eb',
            '--link-color': '#2563eb',
            '--link-visited': '#1d4ed8'
        },
        dark: {
            '--bg-color': '#000000',
            '--text-color': '#ffffff',
            '--sidebar-bg': '#000000',
            '--sidebar-border': '#333333',
            '--sidebar-text': '#ffffff',
            '--sidebar-hover-bg': '#1a1a1a',
            '--topbar-bg': '#000000',
            '--topbar-button-hover': '#1a1a1a',
            '--separator-color': '#333333',
            '--link-color': '#60a5fa',
            '--link-visited': '#3b82f6'
        }
    },
    vintage: {
        light: { // Sepia - More vibrant
            '--bg-color': '#f5e6d3',
            '--text-color': '#5c4033',
            '--sidebar-bg': '#f5e6d3',
            '--sidebar-border': '#e6d2b5',
            '--sidebar-text': '#5c4033',
            '--sidebar-hover-bg': '#e6d2b5',
            '--topbar-bg': '#f5e6d3',
            '--topbar-button-hover': '#e6d2b5',
            '--separator-color': '#e6d2b5',
            '--link-color': '#a0522d',
            '--link-visited': '#8b4513'
        },
        dark: { // Yellow Dark
            '--bg-color': '#2b2b00',
            '--text-color': '#ffffcc',
            '--sidebar-bg': '#3d3d00',
            '--sidebar-border': '#5c5c00',
            '--sidebar-text': '#ffffcc',
            '--sidebar-hover-bg': '#5c5c00',
            '--topbar-bg': '#3d3d00',
            '--topbar-button-hover': '#5c5c00',
            '--separator-color': '#5c5c00',
            '--link-color': '#edc152ff',
            '--link-visited': '#cccc00'
        }
    },
    lipstick: {
        light: { // Pink - Vibrant
            '--bg-color': '#ffc0cb',
            '--text-color': '#880e4f',
            '--sidebar-bg': '#ffc0cb',
            '--sidebar-border': '#ff69b4',
            '--sidebar-text': '#880e4f',
            '--sidebar-hover-bg': '#ff69b4',
            '--topbar-bg': '#ffc0cb',
            '--topbar-button-hover': '#ff69b4',
            '--separator-color': '#ff69b4',
            '--link-color': '#c2185b',
            '--link-visited': '#880e4f'
        },
        dark: { // Pink
            '--bg-color': '#2a0a18',
            '--text-color': '#ffd1ea',
            '--sidebar-bg': '#3d0f23',
            '--sidebar-border': '#5c1635',
            '--sidebar-text': '#ffd1ea',
            '--sidebar-hover-bg': '#5c1635',
            '--topbar-bg': '#3d0f23',
            '--topbar-button-hover': '#5c1635',
            '--separator-color': '#5c1635',
            '--link-color': '#ff6b9d',
            '--link-visited': '#ff4d88'
        }
    },
    ocean: {
        light: { // Blue - Vibrant
            '--bg-color': '#87ceeb',
            '--text-color': '#0d47a1',
            '--sidebar-bg': '#87ceeb',
            '--sidebar-border': '#4fc3f7',
            '--sidebar-text': '#0d47a1',
            '--sidebar-hover-bg': '#4fc3f7',
            '--topbar-bg': '#87ceeb',
            '--topbar-button-hover': '#4fc3f7',
            '--separator-color': '#4fc3f7',
            '--link-color': '#1565c0',
            '--link-visited': '#0d47a1'
        },
        dark: { // Ocean
            '--bg-color': '#001e3c',
            '--text-color': '#b4dcff',
            '--sidebar-bg': '#002850',
            '--sidebar-border': '#004080',
            '--sidebar-text': '#b4dcff',
            '--sidebar-hover-bg': '#004080',
            '--topbar-bg': '#002850',
            '--topbar-button-hover': '#004080',
            '--separator-color': '#004080',
            '--link-color': '#38bdf8',
            '--link-visited': '#0ea5e9'
        }
    },
    cyber: {
        light: { // White with Neon Purple text - More vibrant bg
            '--bg-color': '#f9f0ff',
            '--text-color': '#4b0082',
            '--sidebar-bg': '#f9f0ff',
            '--sidebar-border': '#d8bfd8',
            '--sidebar-text': '#4b0082',
            '--sidebar-hover-bg': '#d8bfd8',
            '--topbar-bg': '#f9f0ff',
            '--topbar-button-hover': '#d8bfd8',
            '--separator-color': '#d8bfd8',
            '--link-color': '#9400d3',
            '--link-visited': '#8a2be2'
        },
        dark: { // Neon
            '--bg-color': '#0a001e',
            '--text-color': '#ffffff',
            '--sidebar-bg': '#140028',
            '--sidebar-border': '#2a0050',
            '--sidebar-text': '#ffffff',
            '--sidebar-hover-bg': '#2a0050',
            '--topbar-bg': '#140028',
            '--topbar-button-hover': '#2a0050',
            '--separator-color': '#2a0050',
            '--link-color': '#ff00ff',
            '--link-visited': '#d500d5'
        }
    },
    nature: {
        light: { // Pale Green - More vibrant
            '--bg-color': '#f0fff4',
            '--text-color': '#006400',
            '--sidebar-bg': '#f0fff4',
            '--sidebar-border': '#98fb98',
            '--sidebar-text': '#006400',
            '--sidebar-hover-bg': '#98fb98',
            '--topbar-bg': '#f0fff4',
            '--topbar-button-hover': '#98fb98',
            '--separator-color': '#98fb98',
            '--link-color': '#32cd32',
            '--link-visited': '#228b22'
        },
        dark: { // Forest
            '--bg-color': '#143214',
            '--text-color': '#c8e6b4',
            '--sidebar-bg': '#1e461e',
            '--sidebar-border': '#2d692d',
            '--sidebar-text': '#c8e6b4',
            '--sidebar-hover-bg': '#2d692d',
            '--topbar-bg': '#1e461e',
            '--topbar-button-hover': '#2d692d',
            '--separator-color': '#2d692d',
            '--link-color': '#4ade80',
            '--link-visited': '#22c55e'
        }
    }
};

const updateTheme = () => {
    const root = document.documentElement;
    const selectedTheme = themes[currentThemeFamily]?.[currentThemeMode];

    if (selectedTheme) {
        Object.entries(selectedTheme).forEach(([property, value]) => {
            root.style.setProperty(property, value);
        });
    }

    // Update active state for theme family buttons
    document.querySelectorAll('.theme-option').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === currentThemeFamily);
    });

    // Update mode toggle state
    const modeToggle = document.getElementById('theme-mode-toggle');
    if (modeToggle) {
        modeToggle.checked = currentThemeMode === 'dark';
    }

    // Update body class for preview styling
    document.body.classList.remove('light-mode', 'dark-mode');
    document.body.classList.add(`${currentThemeMode}-mode`);

    // localStorage removed - no storage
};

const initSettings = () => {
    // Font size control - use pixel values directly from slider
    const fontSizeSlider = document.getElementById('font-size-slider');
    const fontSizePreview = document.getElementById('font-size-preview');
    const contentBody = document.querySelector('.content-body');

    const setFontSize = (size) => {
        const fontSize = `${size}px`;

        // Apply to content body
        if (contentBody) {
            contentBody.style.fontSize = fontSize;
        }

        // Update preview
        if (fontSizePreview) {
            fontSizePreview.style.fontSize = fontSize;
        }

        // localStorage removed - no storage
    };

    if (fontSizeSlider) {
        // Remove existing listeners to avoid duplicates if called multiple times
        const newSlider = fontSizeSlider.cloneNode(true);
        fontSizeSlider.parentNode.replaceChild(newSlider, fontSizeSlider);

        newSlider.addEventListener('input', (e) => {
            setFontSize(e.target.value);
        });

        // Load saved font size or use default (18px) - localStorage removed
        const savedSize = '18';
        newSlider.value = savedSize;
        setFontSize(savedSize);
    }

    // Initialize Font Family - localStorage removed
    // Default to 'original' font

    // Initialize Theme - localStorage removed
    // Use default theme (classic dark)

    updateTheme();

    // Theme Family Listeners
    document.querySelectorAll('.theme-option').forEach(button => {
        // Clone to remove old listeners
        const newBtn = button.cloneNode(true);
        button.parentNode.replaceChild(newBtn, button);

        newBtn.addEventListener('click', () => {
            currentThemeFamily = newBtn.dataset.theme;
            updateTheme();
        });
    });

    // Theme Mode Toggle Listener
    const modeToggle = document.getElementById('theme-mode-toggle');
    if (modeToggle) {
        const newToggle = modeToggle.cloneNode(true);
        modeToggle.parentNode.replaceChild(newToggle, modeToggle);

        newToggle.addEventListener('change', (e) => {
            currentThemeMode = e.target.checked ? 'dark' : 'light';
            updateTheme();
        });
    }

    // Font Family Listeners (exclude Bionic button)
    document.querySelectorAll('.font-option[data-font]').forEach(button => {
        const newBtn = button.cloneNode(true);
        button.parentNode.replaceChild(newBtn, button);

        newBtn.addEventListener('click', () => {
            updateFontFamily(newBtn.dataset.font);
        });
    });

    // Bionic Reading Toggle
    const bionicToggle = document.getElementById('bionic-reading-toggle');
    if (bionicToggle) {
        // Click handled by global listener
        // Initialize state - localStorage removed
        // Default to bionic reading off
    }

    // Font Family - ensure active state is shown correctly
    document.querySelectorAll('.font-option[data-font]').forEach(button => {
        const font = button.dataset.font;
        const savedFont = 'original'; // localStorage removed
        if (font === savedFont) {
            button.classList.add('active');
        }
    });
};

const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.log('Error attempting to enable fullscreen:', err);
        });
    } else {
        document.exitFullscreen();
    }
};

const downloadEpub = () => {
    // Get the EPUB filename from the app data
    const appDataElement = document.getElementById('app-data');
    if (!appDataElement) return;

    const appData = JSON.parse(appDataElement.textContent);
    const epubFilename = appData.epub_filename;

    if (!epubFilename) {
        console.log('No EPUB filename found in metadata');
        return;
    }

    // Create download link pointing to the EPUB file in the parent directory
    const downloadLink = document.createElement('a');
    downloadLink.href = '../' + epubFilename;
    downloadLink.download = epubFilename;
    downloadLink.style.display = 'none';

    // Add to DOM, trigger download, then remove
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
};

const navigateChapter = (direction) => {
    const chapters = Array.from(document.querySelectorAll('.chapter'));
    if (chapters.length === 0) return;

    const mainContent = document.getElementById('main-content');
    const topbarContainer = document.getElementById('topbar-container');
    if (!mainContent || !topbarContainer) return;

    const currentScroll = mainContent.scrollTop;
    const topbarHeight = topbarContainer.offsetHeight;
    const viewportHeight = mainContent.clientHeight;
    let targetChapter = null;

    if (direction === 'next') {
        // Find the next chapter that is not currently visible
        for (const chapter of chapters) {
            const chapterTop = chapter.offsetTop;
            const chapterBottom = chapterTop + chapter.offsetHeight;
            const visibleBottom = currentScroll + viewportHeight;

            // If this chapter is below the current viewport, navigate to it
            if (chapterTop >= visibleBottom) {
                targetChapter = chapter;
                break;
            }
        }

        // If no chapter found below viewport, go to the last chapter
        if (!targetChapter) {
            targetChapter = chapters[chapters.length - 1];
        }
    } else { // 'prev'
        // Find the previous chapter by looking for the last chapter that starts before the current scroll position
        for (let i = chapters.length - 1; i >= 0; i--) {
            const chapter = chapters[i];
            const chapterTop = chapter.offsetTop;
            const chapterBottom = chapterTop + chapter.offsetHeight;
            const visibleTop = currentScroll;

            // If this chapter starts before the current viewport, it's a valid previous chapter
            // Use a small buffer (50px) to make navigation more forgiving
            if (chapterTop < visibleTop - 50) {
                targetChapter = chapter;
                break;
            }
        }

        // If no previous chapter found, go to the first chapter
        if (!targetChapter) {
            targetChapter = chapters[0];
        }
    }

    if (targetChapter) {
        // Account for topbar height so images at the top aren't covered
        // On mobile, add a bit of extra padding (8px) for better visibility
        const extraPadding = window.innerWidth <= 768 ? 8 : 0;
        const scrollPosition = Math.max(0, targetChapter.offsetTop - topbarHeight - extraPadding);
        mainContent.scrollTo(0, scrollPosition);
    }
};

// Image Modal Functionality (Mobile Only)
let savedScrollPosition = 0;

const openImageModal = (imageSrc, imageAlt) => {
    // Only work on mobile devices
    // if (window.innerWidth > 768) return;

    // Lazy load modal if needed
    if (!document.getElementById('image-modal')) {
        createImageModal();
    }

    const modal = document.getElementById('image-modal');
    const modalImage = document.getElementById('modal-image');
    const mainContent = document.getElementById('main-content');

    if (!modal || !modalImage || !mainContent) return;

    // Save current scroll position
    savedScrollPosition = mainContent.scrollTop;

    modalImage.src = imageSrc;
    modalImage.alt = imageAlt || 'Image';

    modal.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
};

const closeImageModal = () => {
    const modal = document.getElementById('image-modal');
    const mainContent = document.getElementById('main-content');

    if (!modal || !mainContent) return;

    // Reset viewport zoom to 1.0 to prevent staying zoomed
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
        // After a short delay, re-enable user scaling for normal reading
        setTimeout(() => {
            viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes');
        }, 100);
    }

    modal.classList.remove('active');
    document.body.style.overflow = ''; // Restore scrolling

    // Restore scroll position after a short delay to ensure modal is closed
    setTimeout(() => {
        mainContent.scrollTo(0, savedScrollPosition);
    }, 100);
};

// Add event delegation for immediate button functionality
document.addEventListener('click', (event) => {
    const target = event.target.closest('button');
    if (!target) return;

    switch (target.id) {
        case 'sidebar-toggle':
            event.preventDefault();
            // Only allow toggle if not in loading state
            if (!target.classList.contains('button-loading')) {
                toggleSidebar();
            }
            break;
        case 'prev-chapter':
            event.preventDefault();
            navigateChapter('prev');
            break;
        case 'next-chapter':
            event.preventDefault();
            navigateChapter('next');
            break;
        case 'settings-toggle':
            event.preventDefault();
            toggleSettings();
            break;
        case 'settings-close':
            event.preventDefault();
            toggleSettings();
            break;
        case 'download-epub':
            event.preventDefault();
            downloadEpub();
            break;
        case 'fullscreen-toggle':
            event.preventDefault();
            toggleFullscreen();
            break;
        case 'modal-close':
            event.preventDefault();
            closeImageModal();
            break;
        case 'bionic-reading-toggle':
            event.preventDefault();
            const isBionicEnabled = target.classList.contains('active'); // localStorage removed - check current state
            if (!isBionicEnabled) {
                applyBionicReading();
                target.classList.add('active');
            } else {
                removeBionicReading();
                target.classList.remove('active');
            }
            break;
    }
});

// Image click handler - overlay handles TOC blocking
document.addEventListener('click', (event) => {
    // Only work on mobile devices
    // if (window.innerWidth > 768) return;

    const img = event.target.closest('img');
    if (!img || !img.closest('.content-body')) return;

    // Check if any sidebar is open
    const appContainer = document.getElementById('app-container');
    if (appContainer && (appContainer.classList.contains('sidebar-open') || appContainer.classList.contains('settings-open'))) {
        return;
    }

    // Open modal - overlay will prevent this from being reached if TOC is open
    event.preventDefault();
    event.stopPropagation();
    openImageModal(img.src, img.alt);
});

// Handle modal background clicks to close
// Handle modal background clicks to close (click anywhere outside the image)
document.addEventListener('click', (event) => {
    const modal = document.getElementById('image-modal');
    const modalImage = document.getElementById('modal-image');

    if (modal && modal.classList.contains('active')) {
        // If the click is NOT on the image (and NOT on the content image that opened it, handled by stopPropagation), close it
        if (!event.target.closest('#modal-image') && event.target.closest('#image-modal')) {
            closeImageModal();
        }
    }
});

// Handle keyboard shortcuts for modal (mobile only)
document.addEventListener('keydown', (event) => {
    // Only work on mobile devices
    // if (window.innerWidth > 768) return;

    const modal = document.getElementById('image-modal');
    if (!modal || !modal.classList.contains('active')) return;

    if (event.key === 'Escape') {
        closeImageModal();
    }
});

// Handle internal links to prevent history pollution
document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;

    // If it's a TOC link, it's already handled by the specific onclick handler which calls preventDefault
    if (event.defaultPrevented) return;

    const hash = link.getAttribute('href');
    if (hash && hash.length > 1) {
        const targetId = hash.substring(1);
        const targetElement = document.getElementById(targetId);

        if (targetElement) {
            event.preventDefault();

            // Use the existing scrollToElement function
            scrollToElement(targetElement);

            // Update URL hash without creating history entry
            history.replaceState(null, null, hash);
        }
    }
});

document.addEventListener('DOMContentLoaded', () => {
    // Create topbar buttons
    createTopbar();

    // Initialize settings - MOVED to lazy load
    // initSettings();

    const APP_DATA = JSON.parse(document.getElementById('app-data').textContent);

    // Remove loading state from TOC button - NO LONGER NEEDED since topbar is generated fresh
    // const sidebarToggle = document.getElementById('sidebar-toggle');
    // if (sidebarToggle) {
    //     sidebarToggle.classList.remove('button-loading');
    //     sidebarToggle.classList.remove('loading-spinner');
    //     sidebarToggle.title = 'Show sidebar';
    //     sidebarToggle.setAttribute('aria-label', 'Show sidebar');
    //     // Remove loading spinner class from SVG
    //     const svg = sidebarToggle.querySelector('svg');
    //     if (svg) {
    //         svg.classList.remove('loading-spinner');
    //     }
    // }


    // No redirect - / stays as /
    let isRedirected = false;

    // Track TOC panel state for fullscreen transitions
    let wasTocOpenBeforeFullscreen = false;

    // Get DOM elements first
    const appContainer = document.getElementById('app-container');
    // const sidebarContainer = document.getElementById('sidebar-container'); // REMOVED - lazy loaded
    const topbarContainer = document.getElementById('topbar-container');
    const mainContent = document.getElementById('main-content');

    // Close panels when clicking on the overlay shield - MOVED to createSidebarOverlay

    // Utility function for instant navigation without scrolling
    let scrollToElement = (element, smooth = false) => {
        if (!element) return;

        const topbarContainer = document.getElementById('topbar-container');
        const topbarHeight = topbarContainer ? topbarContainer.offsetHeight : 0;

        // Account for topbar height so content at the top isn't covered
        // On mobile, add extra padding (8px) for better visibility
        const extraPadding = window.innerWidth <= 768 ? 8 : 0;
        // Content wrapper has margin-top, so we don't need to subtract topbarHeight
        const scrollPosition = Math.max(0, element.offsetTop - extraPadding);

        // Instant scroll without animation
        mainContent.scrollTo(0, scrollPosition);
    };

    const contentIdMapping = APP_DATA.content_id_mapping || {};

    // --- Handlers ---


    const toggleFullscreen = () => {
        const topbarContainer = document.getElementById('topbar-container');
        const mainContent = document.getElementById('main-content');

        // Use async-friendly fullscreen requests and rely on the
        // fullscreenchange event for final state; set classes proactively
        // so UI updates immediately on success. Use feature-detection and
        // vendor fallbacks where necessary.
        const appContainer = document.getElementById('app-container');
        const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);

        const enter = async () => {
            try {
                // Close TOC panel if open before entering fullscreen
                if (appContainer.classList.contains('sidebar-open')) {
                    wasTocOpenBeforeFullscreen = true;
                    appContainer.classList.remove('sidebar-open');
                } else {
                    wasTocOpenBeforeFullscreen = false;
                }

                const el = document.documentElement;
                if (el.requestFullscreen) await el.requestFullscreen();
                else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
                else if (el.mozRequestFullScreen) await el.mozRequestFullScreen();
                else if (el.msRequestFullscreen) await el.msRequestFullscreen();
                // optimistic UI update — the fullscreenchange handler will ensure final state
                appContainer.classList.add('is-fullscreen');
                // add class to the actual toolbar element (child) so CSS selector matches
                const topToolbar = topbarContainer.querySelector('.top-toolbar');
                if (topToolbar) topToolbar.classList.add('fullscreen-hidden');
                // start a polling fallback for mobile/webview to detect exit
                startFullscreenPoll();
                // safety: ensure final state sync after short delays (mobile browsers
                // can be flaky with fullscreenchange events)
                setTimeout(handleFullscreenChange, 300);
                setTimeout(handleFullscreenChange, 1000);
            } catch (e) {
                // Failed to enter fullscreen
            }
        };

        const exit = async () => {
            try {
                if (document.exitFullscreen) await document.exitFullscreen();
                else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
                else if (document.mozCancelFullScreen) await document.mozCancelFullScreen();
                else if (document.msExitFullscreen) await document.msExitFullscreen();
                // optimistic UI update
                appContainer.classList.remove('is-fullscreen');
                const topToolbar = topbarContainer.querySelector('.top-toolbar');
                if (topToolbar) topToolbar.classList.remove('fullscreen-hidden');
                // stop polling if we were polling
                stopFullscreenPoll();
                // Restore TOC panel state if it was open before fullscreen
                if (wasTocOpenBeforeFullscreen) {
                    appContainer.classList.add('sidebar-open');
                }
                setTimeout(handleFullscreenChange, 300);
                setTimeout(handleFullscreenChange, 1000);
            } catch (e) {
                // Failed to exit fullscreen
            }
        };

        if (!isFs) enter(); else exit();
    };

    // Handle fullscreen change events
    const handleFullscreenChange = () => {
        const topbarContainer = document.getElementById('topbar-container');
        const appContainer = document.getElementById('app-container');
        const isFullscreen = !!(document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement);

        const topToolbar = topbarContainer && topbarContainer.querySelector('.top-toolbar');

        if (isFullscreen) {
            appContainer.classList.add('is-fullscreen');
            if (topToolbar) topToolbar.classList.add('fullscreen-hidden');
        } else {
            appContainer.classList.remove('is-fullscreen');
            if (topToolbar) {
                topToolbar.classList.remove('fullscreen-hidden');
                // Force visibility restoration on mobile
                topToolbar.style.opacity = '1';
                topToolbar.style.visibility = 'visible';
                topToolbar.style.pointerEvents = 'auto';
            }
            // ensure any polling is stopped when we detect exit
            stopFullscreenPoll();
        }

        // Force a reflow to ensure the UI updates correctly, especially on mobile
        if (topToolbar) {
            topToolbar.style.display = 'none';
            topToolbar.offsetHeight; // Trigger a reflow
            topToolbar.style.display = '';
        }
    };

    // Polling fallback for mobile/webview where fullscreenchange may not fire
    let _fullscreenPollId = null;
    let _fullscreenPollTimeout = null;
    const startFullscreenPoll = () => {
        if (_fullscreenPollId) return;
        _fullscreenPollId = setInterval(() => {
            const isFsNow = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
            if (!isFsNow) {
                // exited fullscreen, sync state and stop polling
                handleFullscreenChange();
                clearInterval(_fullscreenPollId);
                _fullscreenPollId = null;
                if (_fullscreenPollTimeout) { clearTimeout(_fullscreenPollTimeout); _fullscreenPollTimeout = null; }
            }
        }, 300);
        // Safety timeout: stop polling after 10s to avoid leaks
        _fullscreenPollTimeout = setTimeout(() => {
            if (_fullscreenPollId) { clearInterval(_fullscreenPollId); _fullscreenPollId = null; }
            _fullscreenPollTimeout = null;
        }, 10000);
    };
    const stopFullscreenPoll = () => {
        if (_fullscreenPollId) { clearInterval(_fullscreenPollId); _fullscreenPollId = null; }
        if (_fullscreenPollTimeout) { clearTimeout(_fullscreenPollTimeout); _fullscreenPollTimeout = null; }
    };

    // Add event listeners for all fullscreen change events
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    // Mobile/browser quirks: listen to visibility, orientation and resize events
    // to recover toolbar state when fullscreenchange might not fire.
    document.addEventListener('visibilitychange', () => { if (!document.hidden) handleFullscreenChange(); });
    window.addEventListener('orientationchange', handleFullscreenChange);
    window.addEventListener('resize', handleFullscreenChange);
    window.addEventListener('focus', handleFullscreenChange);
    window.addEventListener('resize', handleFullscreenChange);



    // --- Keyboard Controls (optimized) ---
    const handleKeyDown = (event) => {
        // Don't handle keyboard shortcuts when typing in input fields
        if (event.target && (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.contentEditable === 'true')) {
            return;
        }

        const key = (event.key || '').toLowerCase();

        // Prevent default for our handled keys (except scrolling keys)
        if (['a', 'd', 'arrowleft', 'arrowright', 'f', 't'].includes(key)) {
            event.preventDefault();
        }

        switch (key) {
            case 'a': case 'arrowleft':
                navigateChapter('prev');
                break;
            case 'd': case 'arrowright':
                navigateChapter('next');
                break;
            case 'arrowup': case 'w':
                // Allow default scrolling behavior
                return;
            case 'arrowdown': case 's':
                // Allow default scrolling behavior
                return;
            case 'f':
                toggleFullscreen();
                break;
            case 't':
                toggleFontSize();
                break;
        }
    };

    // Add keyboard event listeners
    document.addEventListener('keydown', handleKeyDown, { passive: false });

    // --- UI Initialization ---
    // initSettings(); // REMOVED - lazy loaded

    // Populate TOC sidebar with data - REMOVED - lazy loaded
    /*
    const bookCover = document.getElementById('book-cover');
    const bookTitle = document.getElementById('book-title');
    const bookAuthor = document.getElementById('book-author');
    const tocList = document.getElementById('toc-list');

    // Set book cover
    if (APP_DATA.cover_image_url && bookCover) {
        // Only set src if it's not already set in the HTML (server-side rendered)
        if (!bookCover.src || bookCover.src === '') {
            bookCover.src = APP_DATA.cover_image_url;
        }
        bookCover.style.display = 'block';
    }

    // Set book title
    if (APP_DATA.title && bookTitle) {
        bookTitle.textContent = truncateText(APP_DATA.title, 60);
        bookTitle.title = APP_DATA.title; // Add full title as tooltip
        bookTitle.style.display = 'block';
    }

    // Set book author
    if (APP_DATA.author && bookAuthor) {
        bookAuthor.textContent = truncateText(APP_DATA.author, 40);
        bookAuthor.title = APP_DATA.author; // Add full author as tooltip
        bookAuthor.style.display = 'block';
    }

    // Populate TOC list
    if (APP_DATA.toc && tocList) {
        tocList.appendChild(buildTocList(APP_DATA.toc, handleTocClick));
    }
    */

    // Function to update active TOC link based on current hash
    const updateActiveTocLink = () => {
        const hash = window.location.hash;
        if (!hash) return;

        // Remove active class from all TOC links
        const allTocLinks = document.querySelectorAll('.toc-view a');
        allTocLinks.forEach(link => link.classList.remove('active'));

        // Add active class to the link that matches the current hash
        const activeLink = document.querySelector(`.toc-view a[href="${hash}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }
    };

    // Update active link on hash change
    window.addEventListener('hashchange', updateActiveTocLink);

    // Update active link on initial load
    updateActiveTocLink();



    // Close sidebar or settings when clicking on main content area if open
    mainContent.addEventListener('click', (event) => {
        if (appContainer.classList.contains('sidebar-open')) {
            event.preventDefault();
            event.stopPropagation();
            toggleSidebar();
        } else if (appContainer.classList.contains('settings-open')) {
            event.preventDefault();
            event.stopPropagation();
            toggleSettings();
        }
    });

    // --- Scrollspy for URL Hash Updates ---
    // Track which page is currently visible and update the URL hash
    const chapters = Array.from(document.querySelectorAll('.chapter[id]'));

    if (chapters.length > 0) {
        // Create an Intersection Observer to track visible chapters
        const observerOptions = {
            root: mainContent,
            rootMargin: '-20% 0px -60% 0px', // Trigger when chapter is in the upper 40% of viewport
            threshold: 0
        };

        let currentVisibleChapter = null;
        let isNavigating = false; // Flag to disable observer during programmatic navigation

        const observerCallback = (entries) => {
            // Don't update hash if we're in the middle of programmatic navigation
            if (isNavigating) return;

            // Find the most visible chapter in the viewport
            let mostVisibleEntry = null;
            let maxIntersectionRatio = 0;

            entries.forEach(entry => {
                if (entry.isIntersecting && entry.intersectionRatio > maxIntersectionRatio) {
                    maxIntersectionRatio = entry.intersectionRatio;
                    mostVisibleEntry = entry;
                }
            });

            // Update hash if we have a new visible chapter
            if (mostVisibleEntry && mostVisibleEntry.target.id !== currentVisibleChapter) {
                currentVisibleChapter = mostVisibleEntry.target.id;

                // Update URL hash without creating history entry
                // Always use replaceState to avoid polluting browser history
                history.replaceState(null, null, '#' + currentVisibleChapter);
            }
        };

        // Make isNavigating accessible to navigation functions
        window._scrollspyNavigating = false;
        Object.defineProperty(window, 'setScrollspyNavigating', {
            value: (value) => {
                isNavigating = value;
                window._scrollspyNavigating = value;
            }
        });

        const chapterObserver = new IntersectionObserver(observerCallback, observerOptions);

        // Observe all chapters
        chapters.forEach(chapter => {
            chapterObserver.observe(chapter);
        });
    }

    // Handle initial page load with hash
    if (window.location.hash) {
        const targetId = window.location.hash.substring(1);
        const targetElement = document.getElementById(targetId);
        if (targetElement) {
            // Small delay to ensure page is fully loaded
            setTimeout(() => {
                scrollToElement(targetElement, false);
            }, 100);
        }
    }
});
// --- END: Application Logic ---