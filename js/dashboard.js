// ─── Firebase Config ────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyC47j_zGeawZaI6gm0nE4EccIt4afrIIjE",
  authDomain: "bipbooks.firebaseapp.com",
  projectId: "bipbooks",
  storageBucket: "bipbooks.firebasestorage.app",
  messagingSenderId: "102356999864",
  appId: "1:102356999864:web:16fa5845df6eaed245de4d"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

// ─── DOM Elements ──────────────────────────────────────────
const navLinks = document.querySelectorAll('.sidebar-nav a[href^="#"]');
const sections = document.querySelectorAll('.dashboard-section');

// Navigation Logic
navLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    navLinks.forEach(l => l.classList.remove('active'));
    link.classList.add('active');

    const targetId = link.getAttribute('href').replace('#', 'sec-');
    sections.forEach(sec => {
      sec.classList.remove('active');
      if (sec.id === targetId) sec.classList.add('active');
    });
  });
});

// Toast Helper
function showToast(msg) {
  const toast = document.getElementById('dashboard-toast');
  const msgEl = document.getElementById('toast-msg');
  if (!toast || !msgEl) return;
  msgEl.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ─── Auth & Data Logic ─────────────────────────────────────
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    // Redirect if not logged in
    window.location.href = 'index.html';
    return;
  }

  // Update Header Info
  document.getElementById('header-profile-img').src = user.photoURL || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%23ffd700"/></svg>';
  document.getElementById('header-user-name').textContent = user.displayName || 'User';
  document.getElementById('welcome-name').textContent = user.displayName || 'User';
  document.getElementById('p-name').value = user.displayName || '';

  // Fetch Firestore Data
  try {
    const docRef = db.collection('users').doc(user.uid);
    const docSnap = await docRef.get();
    
    if (docSnap.exists) {
      const data = docSnap.data();
      
      // Update Stats
      if (data.epapersRead) {
        document.getElementById('stat-epapers-read').textContent = data.epapersRead;
      }

      // Populate Form
      document.getElementById('p-name').value = data.name || user.displayName || '';
      document.getElementById('p-mobile').value = data.mobile || '';
      document.getElementById('p-country').value = data.country || '';
      document.getElementById('p-state').value = data.state || '';
      document.getElementById('p-district').value = data.district || '';
    }
  } catch (error) {
    console.error("Error fetching data:", error);
  }
});

// Logout
document.getElementById('logout-btn').addEventListener('click', () => {
  auth.signOut().then(() => {
    window.location.href = 'index.html';
  });
});

// Profile Form Submit
document.getElementById('profile-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) return;

  const btn = document.getElementById('p-save-btn');
  btn.disabled = true;
  btn.textContent = "সংরক্ষণ করা হচ্ছে...";

  const data = {
    name: document.getElementById('p-name').value,
    mobile: document.getElementById('p-mobile').value,
    country: document.getElementById('p-country').value,
    state: document.getElementById('p-state').value,
    district: document.getElementById('p-district').value,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    await db.collection('users').doc(user.uid).set(data, { merge: true });
    showToast('✅ প্রোফাইল সফলভাবে আপডেট হয়েছে!');
    document.getElementById('header-user-name').textContent = data.name;
    document.getElementById('welcome-name').textContent = data.name;
  } catch (err) {
    console.error(err);
    alert('Failed to update: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "তথ্য সেভ করুন";
  }
});
