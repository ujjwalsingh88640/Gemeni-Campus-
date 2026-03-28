import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==========================================
// 🚨 FIREBASE CONFIGURATION
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyCkvc5FhBhKfUJL3ZbGi4ds3lVDWDduKcs",
  authDomain: "campus1-87cdc.firebaseapp.com",
  projectId: "campus1-87cdc",
  storageBucket: "campus1-87cdc.firebasestorage.app",
  messagingSenderId: "428407156924",
  appId: "1:428407156924:web:814d7c832089b33e43e0b9",
  measurementId: "G-MM1QZ3RNS1"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ==========================================
// APP STATE & DOM ELEMENTS
// ==========================================
let currentCollection = null;
let postsUnsubscribe = null; 
const activeCommentListeners = {}; 

const views = {
    home: document.getElementById('home-view'),
    feed: document.getElementById('feed-view')
};

const elements = {
    goHome: document.getElementById('go-home'),
    backBtn: document.getElementById('back-btn'),
    navTitle: document.getElementById('nav-dynamic-title'),
    fab: document.getElementById('fab'),
    modal: document.getElementById('post-modal'),
    closeModal: document.getElementById('close-modal'),
    postForm: document.getElementById('post-form'),
    feedContainer: document.getElementById('feed-container'),
    imageInput: document.getElementById('post-image'),
    imagePreview: document.getElementById('image-preview'),
    dynamicFields: document.getElementById('dynamic-fields')
};

let uploadedImageBase64 = null;

// ==========================================
// NAVIGATION LOGIC
// ==========================================
document.querySelectorAll('.category-card').forEach(card => {
    card.addEventListener('click', () => {
        currentCollection = card.dataset.collection;
        const title = card.querySelector('h3').innerText;
        
        views.home.classList.remove('active');
        views.feed.classList.add('active');
        elements.fab.classList.remove('hidden');
        elements.navTitle.innerText = title;
        
        setupDynamicForm(currentCollection);
        loadPosts(currentCollection);
    });
});

const goHome = () => {
    currentCollection = null;
    views.feed.classList.remove('active');
    views.home.classList.add('active');
    elements.fab.classList.add('hidden');
    elements.navTitle.innerText = "Home";
    
    if(postsUnsubscribe) postsUnsubscribe();
    Object.values(activeCommentListeners).forEach(unsub => unsub());
};

elements.backBtn.addEventListener('click', goHome);
elements.goHome.addEventListener('click', goHome);

// ==========================================
// MODAL & FORM LOGIC
// ==========================================
elements.fab.addEventListener('click', () => {
    elements.modal.classList.add('active');
});

elements.closeModal.addEventListener('click', () => {
    elements.modal.classList.remove('active');
    elements.postForm.reset();
    elements.imagePreview.classList.add('hidden');
    uploadedImageBase64 = null;
});

function setupDynamicForm(collectionName) {
    elements.dynamicFields.innerHTML = '';
    if (collectionName === 'lostfound_posts') {
        elements.dynamicFields.innerHTML = `
            <input type="text" id="lf-item" placeholder="Item Name (e.g., Blue AirPods)" required>
            <input type="text" id="lf-location" placeholder="Last seen / Found location" required>
        `;
    }
}

elements.imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if(!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800;
            const scaleSize = MAX_WIDTH / img.width;
            canvas.width = MAX_WIDTH;
            canvas.height = img.height * scaleSize;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            uploadedImageBase64 = canvas.toDataURL('image/jpeg', 0.7); 
            elements.imagePreview.src = uploadedImageBase64;
            elements.imagePreview.classList.remove('hidden');
        }
    };
    reader.readAsDataURL(file);
});

elements.postForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submit-post-btn');
    btn.disabled = true;
    btn.innerText = "Posting...";

    const nameInput = document.getElementById('post-name').value.trim();
    const textInput = document.getElementById('post-text').value.trim();
    
    const postData = {
        name: nameInput || "Anonymous",
        text: textInput,
        image: uploadedImageBase64,
        timestamp: serverTimestamp()
    };

    if (currentCollection === 'lostfound_posts') {
        postData.lfItem = document.getElementById('lf-item').value.trim();
        postData.lfLocation = document.getElementById('lf-location').value.trim();
    }

    try {
        await addDoc(collection(db, currentCollection), postData);
        showToast("Post shared with campus!");
        elements.closeModal.click(); 
    } catch (error) {
        console.error("Error adding post: ", error);
        showToast("Error posting. Check console.");
    } finally {
        btn.disabled = false;
        btn.innerText = "Post to Campus";
    }
});

// ==========================================
// REAL-TIME POSTS FEED
// ==========================================
function loadPosts(collectionName) {
    elements.feedContainer.innerHTML = `<div class="empty-state"><i class="ph ph-spinner ph-spin"></i><p>Loading campus vibes...</p></div>`;
    
    const q = query(collection(db, collectionName), orderBy("timestamp", "desc"));
    
    if(postsUnsubscribe) postsUnsubscribe(); 

    postsUnsubscribe = onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            elements.feedContainer.innerHTML = `<div class="empty-state"><i class="ph ph-ghost"></i><p>It's quiet here... Be the first to post!</p></div>`;
            return;
        }

        elements.feedContainer.innerHTML = ''; 

        snapshot.forEach((docSnap) => {
            const post = docSnap.data();
            const postId = docSnap.id;
            const timeString = post.timestamp ? formatTime(post.timestamp.toDate()) : "Just now";

            const postEl = document.createElement('div');
            postEl.className = 'post-card glass-panel';
            
            let lfTag = '';
            if (post.lfItem) {
                lfTag = `<div class="lf-badge">Item: ${post.lfItem} | Location: ${post.lfLocation}</div>`;
            }

            postEl.innerHTML = `
                <div class="post-header">
                    <div class="post-author"><i class="ph ph-user-circle"></i> ${post.name}</div>
                    <div class="post-time">${timeString}</div>
                </div>
                ${lfTag}
                <div class="post-content">${post.text}</div>
                ${post.image ? `<img src="${post.image}" class="post-image" alt="Post Image">` : ''}
                
                <div class="post-actions">
                    <button class="action-btn toggle-comments" data-id="${postId}">
                        <i class="ph ph-chat-circle"></i> Comments
                    </button>
                </div>

                <div class="comments-container" id="comments-${postId}">
                    <div class="comments-list" id="comments-list-${postId}"></div>
                    <form class="comment-input-wrapper" id="comment-form-${postId}">
                        <input type="text" placeholder="Add a comment... (Enter to post)" required>
                        <button type="submit">Send</button>
                    </form>
                </div>
            `;

            elements.feedContainer.appendChild(postEl);

            postEl.querySelector('.toggle-comments').addEventListener('click', () => {
                const commentBox = document.getElementById(`comments-${postId}`);
                commentBox.classList.toggle('active');
                if (commentBox.classList.contains('active')) {
                    loadComments(postId, collectionName);
                }
            });

            postEl.querySelector(`#comment-form-${postId}`).addEventListener('submit', async (e) => {
                e.preventDefault();
                const inputEl = e.target.querySelector('input');
                const commentText = inputEl.value.trim();
                inputEl.value = ''; 
                
                try {
                    await addDoc(collection(db, `${collectionName}/${postId}/comments`), {
                        name: "Anonymous", 
                        text: commentText,
                        timestamp: serverTimestamp()
                    });
                } catch(error) {
                    console.error("Error adding comment", error);
                }
            });
        });
    }, (error) => {
        console.error("Firebase Snapshot Error:", error);
    });
}

// ==========================================
// REAL-TIME COMMENTS LOGIC
// ==========================================
function loadComments(postId, collectionName) {
    const commentsList = document.getElementById(`comments-list-${postId}`);
    
    if (activeCommentListeners[postId]) return; 

    const q = query(collection(db, `${collectionName}/${postId}/comments`), orderBy("timestamp", "asc"));
    
    activeCommentListeners[postId] = onSnapshot(q, (snapshot) => {
        commentsList.innerHTML = ''; 
        
        if (snapshot.empty) {
            commentsList.innerHTML = `<div class="post-time" style="text-align:center; margin-bottom: 1rem;">No comments yet.</div>`;
            return;
        }

        snapshot.forEach((docSnap) => {
            const comment = docSnap.data();
            const div = document.createElement('div');
            div.className = 'comment';
            div.innerHTML = `
                <div class="comment-author">${comment.name}</div>
                <div class="comment-text">${comment.text}</div>
            `;
            commentsList.appendChild(div);
        });
    });
}

// ==========================================
// UTILITIES
// ==========================================
function showToast(message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function formatTime(date) {
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
}
