# Plan to Fix Mobile Content Sliding Issue

## 1. Problem Analysis

On mobile devices, when a user navigates to the root URL (`/`), the page content appears to "slide up" slightly after the initial load. This issue does not occur when navigating directly to a chapter hash (e.g., `/#page01`).

The root cause is likely a race condition between the browser's rendering and the JavaScript's dynamic viewport height calculation:

*   **Dynamic Viewport Height:** The `script.js` file uses `window.innerHeight` to calculate and set a `--vh` CSS variable. On mobile browsers, the value of `window.innerHeight` can change as the browser's UI (like the address bar) appears or disappears.
*   **Initial Load vs. Hash Navigation:**
    *   When loading `/`, the browser may perform its own scroll restoration or react to the change in viewport height, causing the visible "slide."
    *   When loading `/#page01`, the `initializeScrollPosition` function in the JavaScript immediately takes control and scrolls to the specified chapter, effectively overriding the problematic default behavior.

## 2. Proposed Solution

The goal is to ensure a consistent and stable initial scroll position when the root URL is loaded.

I will modify the `initializeScrollPosition` function in `src/epub_converter/static/js/script.js`.

The logic will be updated as follows:

1.  **Check for URL Hash:** The function already checks if `window.location.hash` exists.
2.  **Handle No Hash:**
    *   If the hash **exists**, the current logic of scrolling to the target element will be maintained.
    *   If the hash **does not exist** (i.e., the user is at the root `/`), I will add new logic to explicitly scroll the main content area to the top (`scrollTop = 0`).
3.  **Instant Scroll:** The scroll will be performed instantly, without a smooth animation, to prevent any perception of sliding. The existing `scrollToElement` utility is suitable for this.

This change will enforce a predictable starting position, eliminating the unwanted sliding effect by taking control of the scroll position before the browser's default behavior can interfere.

## 3. Implementation Steps

1.  **Locate `initializeScrollPosition` function in `src/epub_converter/static/js/script.js`.**
2.  **Modify the function to include an `else` block that handles the no-hash case.**
3.  **Inside the `else` block, call `mainContent.scrollTo(0, 0)` to instantly reset the scroll position.**
