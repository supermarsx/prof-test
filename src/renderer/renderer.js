document.getElementById('listBtn').addEventListener('click', async () => {
  const out = document.getElementById('out');
  const qs = await window.profTestAPI.listQuestions();
  out.textContent = JSON.stringify(qs, null, 2);
});
