
const clamp = (val, min, max) => Math.min(Math.max(val, min), max);
export { clamp };

const write = (vals, $el, prefix = '') => {
    if (!$el) return;
    $el.innerText = `${prefix} ${vals ? JSON.stringify(vals, null, 4) : 'N/A'}`.trim();
}
export { write };

const browserUpdatesScrollPositionsOnOverscroll = () => {
    // WebKit based browsers do this.
    // @TODO: Move away from UA Sniffing
    return CSS.supports("selector(:nth-child(1 of x))");
}

const getVisualViewPortValues = ({ clampOffsets = false, resizeDimensions = false }) => {
    let {
        width,
        height,
        widthOrig = null,
        heightOrig = null,
        scale,
        offsetTop,
        offsetLeft,
        offsetTopOrig = null,
        offsetLeftOrig = null,
        pageLeft,
        pageTop,
        pageLeftOrig = null,
        pageTopOrig = null,
    } = window.visualViewport;

    // Adjust values by clamping
    if (clampOffsets) {
        // Cache original values
        pageTopOrig = pageTop;
        pageLeftOrig = pageLeft;
        offsetTopOrig = offsetTop;
        offsetLeftOrig = offsetLeft;
        
        // Offsets measured against the page cannot go negative, nor exceed the max scroll offset
        // @note: Values below only used for absolute positioning
        pageTop = clamp(pageTop, 0, document.body.offsetHeight - height);
        pageLeft = clamp(pageLeft, 0, document.body.offsetWidth - width);

        // Offsets measured against the Layout Viewport cannot go negative, nor exceed the max offset within the Layout Viewport
        // @note: Values below only used for fixed positioning
        const layoutViewportHeight = (window.innerHeight * scale); // @TODO: This only is true when window.innerHeight resizes. Which is not always the case when pinch-zooming (or which happens too late as UA UI shows/hides)
        const layoutViewportWidth = (window.innerWidth * scale); // @TODO: This only is true when window.innerHeight resizes. Which is not always the case when pinch-zooming (or which happens too late as UA UI shows/hides)
        offsetTop = clamp(offsetTop, 0, layoutViewportHeight - height);
        offsetLeft = clamp(offsetLeft, 0, layoutViewportWidth - width);
    }

    // Adjust values by resizing height/width
    // Only needed for browsers that expose overscrolling through scrollX/scrollY
    if (resizeDimensions) {
        widthOrig = width;
        heightOrig = height;
        pageTopOrig = pageTop;
        pageLeftOrig = pageLeft;
        offsetTopOrig = offsetTop;
        offsetLeftOrig = offsetLeft;

        // Mobile Safari: Fixed Viewport does overscroll. Max value can overshoot 0 (inverse of overScrollY) and min value can exceed inverted max scroll distance
        // Desktop Safari: Fixed Viewport does not overscroll. Max value is 0, Min value is inverted max scroll distance.
        // We need a way to distinguish between both, because they need a different fix
        // @TODO: No longer rely on UA sniffing here, and find a way to detect wether the Fixed Viewport can overscroll or not …
        const isMobileSafari = (!!window.navigator.userAgent.match(/iPad/i) || !!window.navigator.userAgent.match(/iPhone/i));
        const isDesktopSafari = !isMobileSafari; 

        // Overscrolling at the right edge
        if (width + pageLeft > document.body.offsetWidth) {
            width = document.body.offsetWidth - pageLeft;

            // @note: Value below only used for fixed positioning
            if (isMobileSafari) {
                if (scale == 1) offsetLeft -= (widthOrig - width);
                if (offsetLeft < 0) offsetLeft = -offsetLeft;
            }            
            else {
                offsetLeft += (widthOrig - width); // Add overscroll value to the offset
            }
        }

        // Overscrolling at the bottom edge
        if (height + pageTop > document.body.offsetHeight) {
            height = document.body.offsetHeight - pageTop;

            // @note: Value below only used for fixed positioning
            if (isMobileSafari) {
                if (scale == 1) offsetTop -= (heightOrig - height);
                if (offsetTop < 0) offsetTop = -offsetTop;
            }
            else {
                offsetTop += (heightOrig - height); // Add overscroll value to the offset
            }
        }

        // Overscrolling at the left edge
        // @note: Might be tricky to achieve as you might trigger back navigation
        if (pageLeft < 0) {
            width += pageLeft;

            // @note: Value below only used for abs position
            pageLeft = 0;

            // @note: Value below only used for fixed positioning
            offsetLeft = Math.abs(offsetLeft);
        }

        // Overscrolling at the top edge
        // @note: Might be tricky to achieve as you might trigger pull-to-refresh
        if (pageTop < 0) {
            height += pageTop;

            // @note: Value below only used for abs positioning
            pageTop = 0;

            // @note: Value below only used for fixed positioning
            offsetTop = Math.abs(offsetTop);
        }

    }

    return Object.fromEntries(
        Object.entries({
            width,
            widthOrig,
            height,
            heightOrig,
            scale,
            offsetTop,
            offsetTopOrig,
            offsetLeft,
            offsetLeftOrig,
            pageLeft,
            pageLeftOrig,
            pageTop,
            pageTopOrig,
        })
        .filter(([k, v]) => v !== null)
    );
};
export { getVisualViewPortValues };

const syncVisualViewportValuesToCustomProperties = (vvv, $el = document.documentElement) => {
    $el.style.setProperty('--vvw', `${vvv.width}px`);
    $el.style.setProperty('--vvh', `${vvv.height}px`);
    $el.style.setProperty('--vvpt', `${vvv.pageTop}px`);
    $el.style.setProperty('--vvpl', `${vvv.pageLeft}px`);
    $el.style.setProperty('--vvot', `${vvv.offsetTop}px`);
    $el.style.setProperty('--vvol', `${vvv.offsetLeft}px`);
    $el.style.setProperty('--vvz', vvv.scale);
}
export { syncVisualViewportValuesToCustomProperties };

const getScrollValues = () => {
    // @note: document.documentElement.scrollTop/Left = window.scrollY/scrollX = window.pageYOffset/pageXOffset
    let {
        scrollX,
        scrollY,
    } = window;

    // Calc overscroll
    const overScrollX = scrollX < 0 ? scrollX : Math.max(0, scrollX + window.innerWidth - document.body.offsetWidth);
    const overScrollY = scrollY < 0 ? scrollY : Math.max(0, scrollY + window.innerHeight - document.body.offsetHeight);

    return {
        scrollX,
        scrollY,
        overScrollX,
        overScrollY,
    };
}
export { getScrollValues };

const getBodyValues = () => {
    let {
        offsetHeight,
        offsetWidth,
    } = document.body;

    return {
        offsetHeight,
        offsetWidth,
    };
}
export { getBodyValues };

const getLayoutViewportValues = () => {
    // @NOTE: You might think we could use window.innerHeight/innerWidth for this
    // but this is not true: when overscrolling Safari into a pull-to-refresh,
    // the window.innerHeight shrinks, but the layout viewport remains the same.
    const layoutViewport = document.querySelector("#layoutviewport");

    if (!layoutViewport) return;

    const {
        width,
        height,
    } = layoutViewport.getBoundingClientRect();

    return {
        width,
        height,
    };
};
export { getLayoutViewportValues };

const getICBValues = () => {
    // @NOTE: Instead of getting the values through by measuring the root element
    // (i.e `document.documentElement,getBoundingClientRect()`), we can use
    // `documentElement.clientHeight/clientWidth` which yield the correct values.
    // These values do not require the ICB to be sized as 100% x 100%.
    return {
        width: document.documentElement.clientWidth,
        height: document.documentElement.clientHeight,
    };
};
export { getICBValues };

const getWindowValues = () => {
    let {
        innerWidth,
        innerHeight,
        outerWidth,
        outerHeight,
    } = window;

    return {
        innerWidth,
        innerHeight,
        outerWidth,
        outerHeight,
    };
}
export { getWindowValues };

const getScreenValues = () => {
    let {
        width,
        height,
    } = screen;

    return {
        width,
        height,
    };
}
export { getScreenValues };

const initOptionsModal = (update) => {
    if (!document.querySelector('#btnOptions')) return;

    // Show/Hide Modal
    document.querySelector('#btnOptions').addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelector('#options').showModal();
    });
    document.querySelector('#btnOptionsClose').addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelector('#options').close();
    });

    // Update after closing the options
    document.querySelector('#options').addEventListener('close', update);

};
const initVirtualKeyboardIntegration = () => {
    if (!document.querySelector('#optVirtualKeyboardOverlaysContent')) return;

    if ("virtualKeyboard" in navigator) {
        navigator.virtualKeyboard.overlaysContent = document.querySelectorAll('#optVirtualKeyboardOverlaysContent:checked').length > 0;
        
        navigator.virtualKeyboard.addEventListener('geometrychange', () => {
            // Values a reported by Virtual Keyboard API
            write(navigator.virtualKeyboard.boundingRect, document.querySelector("#vk-values"), 'Virtual Keyboard');
            
            // Read values from the #vkdebugger
            const rect = document.querySelector('#vkdebugger').getBoundingClientRect();		
            write({ width: rect.width, height: rect.height }, document.querySelector('#vkdebugger-values'), 'Virtual Keyboard Spacetaker');
        });

        // Hook up toggle
        document.querySelector('#optVirtualKeyboardOverlaysContent').addEventListener('change', (e) => {
            navigator.virtualKeyboard.overlaysContent = e.target.checked;
        });

        // Values on load
        const vkRect = navigator.virtualKeyboard.boundingRect;
        write({ width: vkRect.width, height: vkRect.height }, document.querySelector("#vk-values"), 'Virtual Keyboard');

        if (document.querySelector('#vkdebugger')) {
            const rect = document.querySelector('#vkdebugger').getBoundingClientRect();
            write({ width: rect.width, height: rect.height }, document.querySelector('#vkdebugger-values'), 'Virtual Keyboard Spacetaker');
        }

    } else {
        document.querySelector('#optVirtualKeyboardOverlaysContent').disabled = "disabled";

        if (document.querySelector("#vk-values")) {
            write(null, document.querySelector("#vk-values"), 'Virtual Keyboard');
        }

        if (document.querySelector('#vkdebugger')) {
            const rect = document.querySelector('#vkdebugger').getBoundingClientRect();		
            write({ width: rect.width, height: rect.height }, document.querySelector('#vkdebugger-values'), 'Virtual Keyboard Spacetaker');
        }
    }
}
const initVisualViewportIntegration = () => {
    // Browsers that do no update scroll position on overscroll do not need this
    if (browserUpdatesScrollPositionsOnOverscroll()) return;

    // No options included? Bail out
    if (!document.querySelectorAll('[name="vvAdjustValues"]').length) return;

    document.querySelectorAll('[name="vvAdjustValues"]').forEach((checkbox) => {
        checkbox.disabled = "disabled";
    });
}

const init = (update, autoTick = 0) => {
    initOptionsModal(update);
    initVirtualKeyboardIntegration();
    initVisualViewportIntegration();

    // Update on scroll/resize
    window.addEventListener('scroll', update, { passive: true });
    window.visualViewport.addEventListener('scroll', update, { passive: true });
    window.visualViewport.addEventListener('resize', update, { passive: true });

    // Make sure we have values on load
    setTimeout(update, 100);

    if (autoTick) {
        setInterval(update, autoTick);
    }
}
export { init };