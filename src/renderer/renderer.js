document.getElementById('listBtn').addEventListener('click', async () => {
  const out = document.getElementById('out');
  const qs = await window.profTestAPI.listQuestions();
  out.textContent = JSON.stringify(qs, null, 2);
});

// search UI
const searchInput = document.createElement('input');
searchInput.id = 'searchInput';
searchInput.placeholder = 'Search questions...';
document.getElementById('app').insertBefore(searchInput, document.getElementById('listBtn'));

const searchBtn = document.createElement('button');
searchBtn.textContent = 'Search';
searchBtn.id = 'searchBtn';
document.getElementById('app').insertBefore(searchBtn, document.getElementById('out'));

searchBtn.addEventListener('click', async () => {
  const out = document.getElementById('out');
  const q = document.getElementById('searchInput').value;
  const results = await window.profTestAPI.searchQuestions(q);
  out.textContent = JSON.stringify(results, null, 2);
});
