// ===== Global State =====
let appState = {
  currentPlatform: 'facebook',
  currentContestId: null,
  currentPostId: null,
  allComments: [],
  filteredComments: [],
  winners: [],
  restoredSettings: false
};

// ===== Initialization =====
document.addEventListener('DOMContentLoaded', () => {
  console.log('🎉 Comment Winner App Initialized');
  loadSettingsFromStorage();
  setupEventListeners();
});

// ===== Event Listeners =====
function setupEventListeners() {
  // Platform selection
  document.querySelectorAll('.platform-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.platform-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      appState.currentPlatform = btn.dataset.platform;
    });
  });

  // Enter key on URL input
  document.getElementById('postUrl').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') resolvePostUrl();
  });
}

// ===== Settings Management =====
function openSettings() {
  document.getElementById('settingsModal').classList.remove('hidden');
  loadSettingsToForm();
}

function closeSettings() {
  document.getElementById('settingsModal').classList.add('hidden');
}

function saveSettings() {
  const accessToken = document.getElementById('accessToken').value.trim();
  const facebookPageId = document.getElementById('facebookPageId').value.trim();
  const instagramAccountId = document.getElementById('instagramAccountId').value.trim();

  if (!accessToken) {
    showMessage('Please enter Meta Access Token', 'error');
    return;
  }

  localStorage.setItem('metaSettings', JSON.stringify({
    accessToken,
    facebookPageId,
    instagramAccountId,
    savedAt: new Date().toISOString()
  }));

  showMessage('✓ Settings saved successfully', 'success');
  setTimeout(() => closeSettings(), 500);
}

function loadSettingsFromStorage() {
  try {
    const settings = localStorage.getItem('metaSettings');
    if (settings) {
      const parsed = JSON.parse(settings);
      // Settings are loaded in memory, not exposed in UI after initial load
      console.log('✓ Settings loaded from storage');
      appState.restoredSettings = true;
      return parsed;
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
  return null;
}

function loadSettingsToForm() {
  const settings = localStorage.getItem('metaSettings');
  if (settings) {
    try {
      const parsed = JSON.parse(settings);
      document.getElementById('accessToken').value = parsed.accessToken || '';
      document.getElementById('facebookPageId').value = parsed.facebookPageId || '';
      document.getElementById('instagramAccountId').value = parsed.instagramAccountId || '';
    } catch (error) {
      console.error('Error parsing settings:', error);
    }
  }
}

function getSettings() {
  const settings = localStorage.getItem('metaSettings');
  if (settings) {
    try {
      return JSON.parse(settings);
    } catch (error) {
      return null;
    }
  }
  return null;
}

// ===== Platform Selection =====
function selectPlatform(platform) {
  appState.currentPlatform = platform;
  document.querySelectorAll('.platform-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.platform === platform);
  });
}

// ===== Post URL Resolution =====
async function resolvePostUrl() {
  const url = document.getElementById('postUrl').value.trim();
  const platform = appState.currentPlatform;

  if (!url) {
    showMessage('Please enter a post URL', 'error');
    return;
  }

  showLoading(true);

  try {
    const response = await fetch('/api/posts/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, platform })
    });

    const data = await response.json();

    if (!response.ok) {
      showMessage(`Error: ${data.error || 'Failed to resolve post'}\n${data.message || ''}`, 'error');
      document.getElementById('postIdSection').classList.add('hidden');
      showLoading(false);
      return;
    }

    appState.currentPostId = data.postId;
    document.getElementById('postId').value = data.postId;
    document.getElementById('postIdSection').classList.remove('hidden');
    showMessage(`✓ Post ID detected: ${data.postId}`, 'success');
  } catch (error) {
    showMessage(`Error: ${error.message}`, 'error');
  }

  showLoading(false);
}

// ===== Fetch Comments =====
async function fetchComments() {
  const postUrl = document.getElementById('postUrl').value.trim();
  const postId = document.getElementById('postId').value.trim();
  const platform = appState.currentPlatform;

  if (!postUrl || !postId) {
    showMessage('Please enter Post URL and verify Post ID', 'error');
    return;
  }

  const settings = getSettings();
  if (!settings || !settings.accessToken) {
    showMessage('Please configure Meta Access Token in Settings', 'error');
    openSettings();
    return;
  }

  showLoading(true);

  try {
    // Create a contest first
    const contestName = `${platform.toUpperCase()} - ${new Date().toLocaleDateString('ar')}`;
    appState.currentContestId = Date.now(); // Simple ID generation

    // Simulate API call to fetch comments
    // TODO: Replace with actual Meta API call
    const mockComments = generateMockComments(platform, postId);

    appState.allComments = mockComments;
    appState.filteredComments = [...mockComments];

    updateCommentStats();
    document.getElementById('statsSection').classList.remove('hidden');
    document.getElementById('drawSection').classList.remove('hidden');

    showMessage(`✓ Fetched ${mockComments.length} comments from ${platform}`, 'success');
  } catch (error) {
    showMessage(`Error fetching comments: ${error.message}`, 'error');
  }

  showLoading(false);
}

// ===== Mock Data Generator (for testing) =====
function generateMockComments(platform, postId) {
  const names = ['أحمد محمود', 'فاطمة علي', 'محمد حسن', 'زينب أحمد', 'عمر خالد', 'سارة محمد', 'علي إبراهيم', 'ليلى حسن'];
  const usernames = ['ahmed_m', 'fatima_ali', 'mohammad_h', 'zainab_a', 'omar_k', 'sarah_m', 'ali_i', 'leila_h'];
  const commentTexts = [
    'تم المشاركة ✅',
    'منشن صديقي @ahmed_m',
    'شكراً على المسابقة! 🎉',
    'متشوق للنتائج',
    'تم التعليق @fatima_ali @mohammad_h',
    'أحب هذه المسابقات',
    'منشن صديقاتي @zainab_a @sarah_m @leila_h',
    'شكراً 🙏 تم'
  ];

  const comments = [];
  for (let i = 0; i < 50; i++) {
    const nameIdx = Math.floor(Math.random() * names.length);
    comments.push({
      comment_id: `${postId}_${i}`,
      user_id: `user_${i}`,
      username: usernames[nameIdx],
      name: names[nameIdx],
      text: commentTexts[Math.floor(Math.random() * commentTexts.length)],
      likes_count: Math.floor(Math.random() * 50),
      created_time: new Date(Date.now() - Math.random() * 86400000).toISOString(),
      is_reply: Math.random() > 0.7 ? 1 : 0,
      mentions_count: (commentTexts[Math.floor(Math.random() * commentTexts.length)].match(/@/g) || []).length,
      is_eligible: 1,
      platform: platform,
      post_url: 'https://example.com/post'
    });
  }

  return comments;
}

// ===== Comment Stats =====
function updateCommentStats() {
  const totalComments = appState.allComments.length;
  const uniqueUsers = new Set(appState.allComments.map(c => c.user_id || c.username)).size;
  const eligibleComments = appState.allComments.filter(c => c.is_eligible).length;

  document.getElementById('totalComments').textContent = totalComments;
  document.getElementById('uniqueUsers').textContent = uniqueUsers;
  document.getElementById('eligibleComments').textContent = eligibleComments;
}

// ===== Apply Filters =====
function applyFilters() {
  let filtered = [...appState.allComments];

  // Remove empty comments
  if (document.getElementById('excludeEmpty').checked) {
    filtered = filtered.filter(c => c.text && c.text.trim().length > 0);
  }

  // Exclude replies
  if (document.getElementById('excludeReplies').checked) {
    filtered = filtered.filter(c => !c.is_reply);
  }

  // Exclude page owner (would need actual detection)
  if (document.getElementById('excludePageOwner').checked) {
    // TODO: Implement page owner detection
  }

  // Minimum mentions
  const minMentions = parseInt(document.getElementById('minimumMentions').value) || 0;
  if (minMentions > 0) {
    filtered = filtered.filter(c => c.mentions_count >= minMentions);
  }

  // Required keyword
  const keyword = document.getElementById('requiredKeyword').value.trim();
  if (keyword) {
    filtered = filtered.filter(c =>
      c.text && c.text.includes(keyword)
    );
  }

  // Search comments
  const searchTerm = document.getElementById('searchComments').value.trim();
  if (searchTerm) {
    filtered = filtered.filter(c =>
      c.text && c.text.includes(searchTerm) ||
      c.name && c.name.includes(searchTerm) ||
      c.username && c.username.includes(searchTerm)
    );
  }

  // Remove duplicates (same user)
  if (document.getElementById('removeDuplicates').checked || document.getElementById('onePerUser').checked) {
    const seen = new Set();
    filtered = filtered.filter(c => {
      const key = c.user_id || c.username;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  appState.filteredComments = filtered;

  // Update stats
  document.getElementById('eligibleComments').textContent = filtered.length;

  showMessage(`✓ Filters applied: ${filtered.length} eligible comments`, 'success');
}

// ===== Draw Winners =====
async function drawWinners() {
  if (!appState.filteredComments.length) {
    showMessage('No eligible comments to draw from', 'error');
    return;
  }

  const winnerCount = parseInt(document.getElementById('winnerCount').value) || 1;

  if (appState.filteredComments.length < winnerCount) {
    showMessage(`Not enough comments! Available: ${appState.filteredComments.length}, Requested: ${winnerCount}`, 'error');
    return;
  }

  showLoading(true);

  try {
    // Use secure random selection
    const winners = secureRandomSelect(appState.filteredComments, winnerCount);
    appState.winners = winners;

    displayWinners(winners);
    document.getElementById('winnersSection').classList.remove('hidden');

    showMessage(`🎉 ${winnerCount} winners selected!`, 'success');
  } catch (error) {
    showMessage(`Error drawing winners: ${error.message}`, 'error');
  }

  showLoading(false);
}

// ===== Secure Random Selection =====
function secureRandomSelect(array, count) {
  const shuffled = [...array];

  // Fisher-Yates shuffle using crypto random
  for (let i = shuffled.length - 1; i > 0; i--) {
    // Use Web Crypto API for secure random
    const randomBytes = new Uint32Array(1);
    crypto.getRandomValues(randomBytes);
    const j = randomBytes[0] % (i + 1);

    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, count);
}

// ===== Display Winners =====
function displayWinners(winners) {
  const container = document.getElementById('winnersContainer');
  container.innerHTML = '';

  winners.forEach((winner, index) => {
    const card = document.createElement('div');
    card.className = 'winner-card';
    card.innerHTML = `
      <div class="winner-rank">${index + 1}</div>
      <div class="winner-name">${winner.name}</div>
      <div class="winner-username">@${winner.username || 'N/A'}</div>
      <div class="winner-comment">"${winner.text || 'بدون نص'}"</div>
      <div class="winner-platform">📱 ${winner.platform.toUpperCase()}</div>
    `;
    container.appendChild(card);
  });
}

// ===== Redraw =====
function redraw() {
  document.getElementById('winnersContainer').innerHTML = '';
  drawWinners();
}

// ===== Select Alternate Winner =====
function selectAlternate() {
  if (appState.filteredComments.length <= appState.winners.length) {
    showMessage('No more eligible comments available', 'error');
    return;
  }

  // Get remaining comments (not already winners)
  const winnerUserIds = new Set(appState.winners.map(w => w.user_id || w.username));
  const remaining = appState.filteredComments.filter(c =>
    !winnerUserIds.has(c.user_id || c.username)
  );

  if (!remaining.length) {
    showMessage('No alternate winners available', 'error');
    return;
  }

  const alternate = secureRandomSelect(remaining, 1)[0];
  const newWinners = [...appState.winners, alternate];
  appState.winners = newWinners;

  displayWinners(newWinners);
  showMessage(`✓ Added alternate winner`, 'success');
}

// ===== Export CSV =====
function exportCSV() {
  if (!appState.currentContestId) {
    showMessage('No contest to export', 'error');
    return;
  }

  window.location.href = `/api/export/csv?contestId=${appState.currentContestId}`;
}

// ===== Export XLSX =====
function exportXLSX() {
  if (!appState.currentContestId) {
    showMessage('No contest to export', 'error');
    return;
  }

  window.location.href = `/api/export/xlsx?contestId=${appState.currentContestId}`;
}

// ===== Message Display =====
function showMessage(message, type = 'info') {
  const container = document.getElementById('messageContainer');
  const messageEl = document.createElement('div');
  messageEl.className = `message ${type}`;
  messageEl.textContent = message;

  container.appendChild(messageEl);

  // Auto-remove after 5 seconds
  setTimeout(() => {
    messageEl.style.opacity = '0';
    setTimeout(() => messageEl.remove(), 300);
  }, 5000);
}

// ===== Loading Indicator =====
function showLoading(show) {
  const loader = document.getElementById('loadingIndicator');
  if (show) {
    loader.classList.remove('hidden');
  } else {
    loader.classList.add('hidden');
  }
}

// ===== Close Modal on Click Outside =====
document.addEventListener('click', (e) => {
  const modal = document.getElementById('settingsModal');
  if (e.target === modal) {
    closeSettings();
  }
});

console.log('✓ App script loaded successfully');
