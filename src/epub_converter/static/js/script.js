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
            a.href = '#';
            a.onclick = e => { e.preventDefault(); if (onTocClick) onTocClick(item); };
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

// Define handlers that work immediately
// Define handlers that work immediately
const togglePanel = (panelType) => {
    const appContainer = document.getElementById('app-container');
    const sidebarOverlay = document.querySelector('.sidebar-overlay');

    if (!appContainer) return;

    const isSidebar = panelType === 'sidebar';
    const isSettings = panelType === 'settings';

    const targetClass = isSidebar ? 'sidebar-open' : 'settings-open';
    const otherClass = isSidebar ? 'settings-open' : 'sidebar-open';

    // Close the other panel if it's open (mutual exclusivity)
    if (appContainer.classList.contains(otherClass)) {
        appContainer.classList.remove(otherClass);
    }

    // Toggle the target panel
    const isOpening = !appContainer.classList.contains(targetClass);
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
};

const toggleSidebar = () => togglePanel('sidebar');
const toggleSettings = () => togglePanel('settings');


// Settings Logic
const updateFontSize = (size) => {
    const contentBody = document.querySelector('.content-body');
    const slider = document.getElementById('font-size-slider');
    if (!contentBody || !slider) return;

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
    if (slider.value !== size) slider.value = size;

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

    // Save to localStorage
    localStorage.setItem('reader-font-size', size);
};

const updateFontFamily = (font) => {
    const contentBody = document.querySelector('.content-body');
    const fontSizePreview = document.getElementById('font-size-preview');

    if (!contentBody) return;

    let fontFamily = '';
    if (font === 'original') {
        fontFamily = '';
    } else if (font === 'georgia') {
        fontFamily = 'Georgia, serif';
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

    // Update active state in UI
    document.querySelectorAll('.font-option').forEach(btn => {
        if (btn.dataset.font === font) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    // Save to localStorage
    localStorage.setItem('reader-font-family', font);
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
            '--link-color': '#ffff66',
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

    // Save to localStorage
    localStorage.setItem('reader-theme-family', currentThemeFamily);
    localStorage.setItem('reader-theme-mode', currentThemeMode);
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

        // Save to localStorage
        localStorage.setItem('reader-font-size', size);
    };

    if (fontSizeSlider) {
        fontSizeSlider.addEventListener('input', (e) => {
            setFontSize(e.target.value);
        });

        // Load saved font size or use default (18px)
        const savedSize = localStorage.getItem('reader-font-size') || '18';
        fontSizeSlider.value = savedSize;
        setFontSize(savedSize);
    }

    // Initialize Font Family
    const savedFontFamily = localStorage.getItem('reader-font-family');
    if (savedFontFamily) {
        updateFontFamily(savedFontFamily);
    }

    // Initialize Theme
    const savedThemeFamily = localStorage.getItem('reader-theme-family');
    const savedThemeMode = localStorage.getItem('reader-theme-mode');

    if (savedThemeFamily && themes[savedThemeFamily]) {
        currentThemeFamily = savedThemeFamily;
    }

    if (savedThemeMode && (savedThemeMode === 'light' || savedThemeMode === 'dark')) {
        currentThemeMode = savedThemeMode;
    }

    updateTheme();

    // Theme Family Listeners
    document.querySelectorAll('.theme-option').forEach(button => {
        button.addEventListener('click', () => {
            currentThemeFamily = button.dataset.theme;
            updateTheme();
        });
    });

    // Theme Mode Toggle Listener
    const modeToggle = document.getElementById('theme-mode-toggle');
    if (modeToggle) {
        modeToggle.addEventListener('change', (e) => {
            currentThemeMode = e.target.checked ? 'dark' : 'light';
            updateTheme();
        });
    }

    // Font Family Listeners
    document.querySelectorAll('.font-option').forEach(button => {
        button.addEventListener('click', () => {
            updateFontFamily(button.dataset.font);
        });
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
        // Use CSS scroll-padding-top instead of manual calculation
        const scrollPosition = Math.max(0, targetChapter.offsetTop);
        mainContent.scrollTo(0, scrollPosition);
    }
};

// Image Modal Functionality (Mobile Only)
let savedScrollPosition = 0;

const openImageModal = (imageSrc, imageAlt) => {
    // Only work on mobile devices
    if (window.innerWidth > 768) return;

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
    }
});

// Image click handler - overlay handles TOC blocking
document.addEventListener('click', (event) => {
    // Only work on mobile devices
    if (window.innerWidth > 768) return;

    const img = event.target.closest('img');
    if (!img || !img.closest('.content-body')) return;

    // Open modal - overlay will prevent this from being reached if TOC is open
    event.preventDefault();
    event.stopPropagation();
    openImageModal(img.src, img.alt);
});

// Handle modal background clicks to close
document.addEventListener('click', (event) => {
    const modal = document.getElementById('image-modal');
    if (event.target === modal) {
        closeImageModal();
    }
});

// Handle keyboard shortcuts for modal (mobile only)
document.addEventListener('keydown', (event) => {
    // Only work on mobile devices
    if (window.innerWidth > 768) return;

    const modal = document.getElementById('image-modal');
    if (!modal || !modal.classList.contains('active')) return;

    if (event.key === 'Escape') {
        closeImageModal();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    // Initialize settings
    initSettings();

    const APP_DATA = JSON.parse(document.getElementById('app-data').textContent);

    // Remove loading state from TOC button
    const sidebarToggle = document.getElementById('sidebar-toggle');
    if (sidebarToggle) {
        sidebarToggle.classList.remove('button-loading');
        sidebarToggle.classList.remove('loading-spinner');
        sidebarToggle.title = 'Show sidebar';
        sidebarToggle.setAttribute('aria-label', 'Show sidebar');
        // Remove loading spinner class from SVG
        const svg = sidebarToggle.querySelector('svg');
        if (svg) {
            svg.classList.remove('loading-spinner');
        }
    }

    // No redirect - / stays as /
    let isRedirected = false;

    // Track TOC panel state for fullscreen transitions
    let wasTocOpenBeforeFullscreen = false;

    // Get DOM elements first
    const appContainer = document.getElementById('app-container');
    const sidebarContainer = document.getElementById('sidebar-container');
    const topbarContainer = document.getElementById('topbar-container');
    const mainContent = document.getElementById('main-content');

    // Close panels when clicking on the overlay shield
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', (event) => {
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
    }

    // Utility function for instant navigation without scrolling
    let scrollToElement = (element, smooth = false) => {
        if (!element) return;

        // Use CSS scroll-padding-top instead of manual calculation
        // The CSS already handles the topbar offset with scroll-padding-top
        const scrollPosition = Math.max(0, element.offsetTop);

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

    const handleTocClick = (item) => {
        if (!item.href) return;

        // Extract page ID from href (should now be in format "#page01", "#page02", etc.)
        let pageId = item.href;

        // Remove leading # if present
        if (pageId.startsWith('#')) {
            pageId = pageId.substring(1);
        }

        // Look for target element with the page ID
        let targetElement = document.getElementById(pageId);

        // If not found, try to find the closest chapter
        if (!targetElement) {
            // Try to find any chapter element that might be close
            const chapterElements = document.querySelectorAll('.chapter');
            if (chapterElements.length > 0) {
                // Use the first chapter as fallback
                targetElement = chapterElements[0];
                pageId = targetElement.id;
            }
        }

        if (targetElement) {
            // Update URL hash to show current page
            history.replaceState(null, '', '#' + pageId);
            scrollToElement(targetElement, false);
        } else {
            // Could not find target element
        }

        if (window.innerWidth < 768) {
            toggleSidebar();
        }
    };

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
    initSettings();

    // Populate TOC sidebar with data
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


    // Close sidebar or settings when clicking on main content area if open
    mainContent.addEventListener('click', () => {
        if (appContainer.classList.contains('sidebar-open')) {
            toggleSidebar();
        } else if (appContainer.classList.contains('settings-open')) {
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

        const observerCallback = (entries) => {
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

                // Update URL hash without scrolling
                if (history.replaceState) {
                    history.replaceState(null, null, '#' + currentVisibleChapter);
                } else {
                    // Fallback for older browsers
                    window.location.hash = currentVisibleChapter;
                }
            }
        };

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

// Fallback: Remove loading state when window is fully loaded
window.addEventListener('load', () => {
    const sidebarToggle = document.getElementById('sidebar-toggle');
    if (sidebarToggle && sidebarToggle.classList.contains('button-loading')) {
        sidebarToggle.classList.remove('button-loading');
        sidebarToggle.classList.remove('loading-spinner');
        sidebarToggle.title = 'Show sidebar';
        sidebarToggle.setAttribute('aria-label', 'Show sidebar');
        const svg = sidebarToggle.querySelector('svg');
        if (svg) {
            svg.classList.remove('loading-spinner');
        }
    }
});
// --- END: Application Logic ---