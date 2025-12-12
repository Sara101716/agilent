const defaultTooltipSettings = {
  tooltipLocation: 'auto', // 'top', 'bottom', 'left', 'right', 'auto'
  arrowPosition: 'auto', // 'start', 'end', 'center', 'auto'
};

const determineTooltipLocation = (buttonRect, tooltipRect) => {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const space = {
    top: 0,
    bottom: viewportHeight,
    left: 0,
    right: viewportWidth,
  };
  let tooltipLocation = 'top';

  if (buttonRect.top >= tooltipRect.height) {
    tooltipLocation = 'top';
  } else if (space.bottom - buttonRect.bottom >= tooltipRect.height) {
    tooltipLocation = 'bottom';
  } else if (space.right - buttonRect.right >= tooltipRect.width) {
    tooltipLocation = 'right';
  } else if (buttonRect.left >= tooltipRect.width) {
    tooltipLocation = 'left';
  }

  return tooltipLocation;
};

const determineArrowPosition = (tooltip, buttonRect, tooltipRect, tooltipLocation) => {
  const offsetMargin = parseInt(getComputedStyle(tooltip).getPropertyValue('--tooltip-arrow-margin'), 10) || 8;
  let arrowPosition = 'center';

  // reflow to get updated tooltipRect
  tooltip.offsetHeight;
  tooltipRect = tooltip.getBoundingClientRect();

  const buttonCenterX = buttonRect.left + (buttonRect.width / 2);
  const tooltipMinX = tooltipRect.left + offsetMargin;
  const tooltipCenterX = tooltipRect.left + (tooltipRect.width / 2);
  const tooltipMaxX = tooltipRect.right - offsetMargin;

  if (tooltipLocation === 'top' || tooltipLocation === 'bottom') {
    if (Math.abs(tooltipMinX - buttonCenterX) < Math.abs(tooltipCenterX - buttonCenterX)) {
      arrowPosition = 'start';
    } else if (Math.abs(tooltipMaxX - buttonCenterX) < Math.abs(tooltipCenterX - buttonCenterX)) {
      arrowPosition = 'end';
    } else {
      arrowPosition = 'center';
    }
  } else if (tooltipLocation === 'left' || tooltipLocation === 'right') {
    const buttonCenterY = buttonRect.top + (buttonRect.height / 2);
    const tooltipMinY = tooltipRect.top + offsetMargin;
    const tooltipCenterY = tooltipRect.top + (tooltipRect.height / 2);
    const tooltipMaxY = tooltipRect.bottom - offsetMargin;

    if (Math.abs(tooltipMinY - buttonCenterY) < Math.abs(tooltipCenterY - buttonCenterY)) {
      arrowPosition = 'start';
    } else if (Math.abs(tooltipMaxY - buttonCenterY) < Math.abs(tooltipCenterY - buttonCenterY)) {
      arrowPosition = 'end';
    }
  }

  return arrowPosition;
};

export default (tooltip, customSettings = defaultTooltipSettings) => {
  const settings = {...defaultTooltipSettings, ...customSettings};
  const button = tooltip.previousElementSibling;
  let isMouseOverTooltip = false;
  let isMouseOverButton = false;

  const setPositionOfTooltip = (tooltip, button) => {
    const buttonRect = button.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const offset = parseInt(getComputedStyle(tooltip).getPropertyValue('--tooltip-arrow-size'), 10) || 8;

    let tooltipLocation = settings.tooltipLocation || 'auto';
    let arrowPosition = settings.arrowPosition || 'auto';

    if (settings.tooltipLocation === 'auto') {
      tooltipLocation = determineTooltipLocation(buttonRect, tooltipRect);
    }

    let top = 0;
    let left = 0;

    switch (tooltipLocation) {
      case 'top':
        top = buttonRect.top - tooltipRect.height - offset;
        left = buttonRect.left + (buttonRect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'bottom':
        top = buttonRect.bottom + offset;
        left = buttonRect.left + (buttonRect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'left':
        top = buttonRect.top + (buttonRect.height / 2) - (tooltipRect.height / 2);
        left = buttonRect.left - tooltipRect.width - offset;
        break;
      case 'right':
        top = buttonRect.top + (buttonRect.height / 2) - (tooltipRect.height / 2);
        left = buttonRect.right + offset;
        break;
    }

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;

    if (settings.arrowPosition === 'auto') {
      arrowPosition = determineArrowPosition(tooltip, buttonRect, tooltipRect, tooltipLocation);
    }

    tooltip.querySelector('.agt-tooltip__arrow').className = `agt-tooltip__arrow agt-tooltip__arrow--location-${tooltipLocation} agt-tooltip__arrow--position-${arrowPosition}`;
    tooltip.querySelector('.agt-tooltip__arrow-background').className = `agt-tooltip__arrow-background agt-tooltip__arrow-background--${tooltipLocation}`;
  };

  const showTooltip = () => {
    tooltip.style.visibility = 'visible';
    tooltip.style.opacity = '1';

    setPositionOfTooltip(tooltip, button);
  };

  const hideTooltipIfNeeded = () => {
    setTimeout(() => {
      if (tooltip.contains(document.activeElement) || document.activeElement === button || isMouseOverButton || isMouseOverTooltip) {
        return;
      }
      tooltip.style.visibility = 'hidden';
      tooltip.style.opacity = '0';
    }, 300);
  };

  const focusTarget = settings.focusTarget || button;

  focusTarget.addEventListener('keyup', () => {
    setTimeout(() => {
      if (!focusTarget.classList.contains('mouse-focus')) {
        showTooltip();
      }
    }, 100);
  });

  focusTarget.addEventListener('blur', () => {
    hideTooltipIfNeeded();
  });

  tooltip.addEventListener('focus', () => {
    showTooltip();
  });

  tooltip.addEventListener('focusout', () => {
    hideTooltipIfNeeded();
  });

  button.addEventListener('mouseenter', () => {
    isMouseOverButton = true;
    showTooltip();
  });

  button.addEventListener('mouseleave', () => {
    isMouseOverButton = false;
    hideTooltipIfNeeded();
  });

  tooltip.addEventListener('mouseenter', () => {
    isMouseOverTooltip = true;
  });

  tooltip.addEventListener('mouseleave', () => {
    isMouseOverTooltip = false;
    hideTooltipIfNeeded();
  });

  document.addEventListener('scroll', () => {
    if (tooltip.style.visibility !== 'visible') {
      return;
    }

    showTooltip();
  });

  tooltip.style.visibility = 'hidden';
  tooltip.style.opacity = '0';
};
