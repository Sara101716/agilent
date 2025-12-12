(async function init() {
  const startWorkflowButton = document.getElementById('startWorkflow');
  startWorkflowButton.addEventListener('click', async () => {
    startWorkflowButton.disabled = true;
    startWorkflowButton.innerText = 'Started!';
  });
}());
