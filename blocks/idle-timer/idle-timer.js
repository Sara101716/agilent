import {
  html,
  getPlaceholder,
  logout,
  refreshSSOSession,
} from '../../scripts/aem.js';

// Function to create the idle timer HTML template
function createIdleTimerTemplate() {
  return html`
    <div class="idle-timer__popup" role="alertdialog" aria-modal="true" aria-labelledby="idle-timer-heading">
      <div class="idle-timer__title" role="heading" id="idle-timer-heading" aria-level="2">
        ${getPlaceholder('idle timer heading')}
      </div>
      <span class="idle-timer__countdown"></span>
      <span id="sr-announcement" class="sr-only" aria-live="polite" role="status"></span>
      <div class="idle-timer__content">
        ${getPlaceholder('idle timer content 2')}
      </div>
      <div class="idle-timer__buttons">
        <button class="agt-button agt-button--primary idle-timer__resume-session">
          ${getPlaceholder('idle timer keep login btn')}
        </button>
        <button class="agt-button agt-button--secondary idle-timer__logout">
          ${getPlaceholder('idle timer log out btn')}
        </button>
      </div>
      <div class="idle-timer__note">${getPlaceholder('idle timer note')}</div>
    </div>
  `;
}

function announceTime(sec) {
  const srAnnouncement = document.getElementById('sr-announcement');
  if (!srAnnouncement) return;

  let message = '';

  if (sec === 0) {
    message = getPlaceholder('idle timer sr logout inactive');
  } else if (sec % 60 === 0 && sec >= 60) {
    const minutes = Math.floor(sec / 60).toString();
    message = getPlaceholder('idle timer sr logout mins', [minutes]);
  } else if (sec <= 60 && [45, 30, 15, 10, 5].includes(sec)) {
    message = getPlaceholder('idle timer sr logout sec', [sec]);
  }

  if (message) {
    srAnnouncement.textContent = message;
  }
}

// Function to start and update the countdown timer
async function startCountdown(block, beforeAutoLogout) {
  const countdownElement = block.querySelector('.idle-timer__countdown');
  let time = beforeAutoLogout;

  const updateTimer = () => {
    const min = String(Math.floor(time / 60)).padStart(2, '0');
    const sec = String(time % 60).padStart(2, '0');
    countdownElement.textContent = `${min}:${sec}`;
    if (time > 0) {
      time -= 1;
      announceTime(time);
    } else {
      clearInterval(block.timerInterval);
      logout();
    }
  };

  updateTimer();
  block.timerInterval = setInterval(updateTimer, 1000);
}

function attachIdleTimerEvents(block, logoutTimerId) {
  const resumeBtn = block.querySelector('.idle-timer__resume-session');
  const logoutBtn = block.querySelector('.idle-timer__logout');
  const dialog = block.closest('dialog');

  if (resumeBtn && logoutBtn && dialog) {
    resumeBtn.addEventListener('click', async (event) => {
      try {
        dialog.close();
        event.preventDefault();
        clearTimeout(logoutTimerId);
        clearInterval(block.timerInterval);
        await refreshSSOSession();
      } catch (error) {
        console.error('Failed to update idle session', error);
        logout();
      }
    });

    logoutBtn.addEventListener('click', () => {
      dialog.close();
      clearInterval(block.timerInterval);
      logout();
    });
  }
}
const startTimer = (block, logoutTimerId, beforeAutoLogout) => {
  attachIdleTimerEvents(block, logoutTimerId);
  startCountdown(block, beforeAutoLogout);
};

function trapFocus(dialogElement) {
  const focusableElements = dialogElement.querySelectorAll('button');
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  if (firstElement) {
    firstElement.focus();
  }
  dialogElement.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === firstElement) {
        // Shift + Tab on first element
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        // Tab on last element
        e.preventDefault();
        firstElement.focus();
      }
    }
  });
}

export default async function decorate(block) {
  const template = createIdleTimerTemplate();
  block.appendChild(template);

  block.startTimer = (logoutTimerId, beforeAutoLogout) => {
    startTimer(block, logoutTimerId, beforeAutoLogout);
  };

  trapFocus(block);

  return block;
}
