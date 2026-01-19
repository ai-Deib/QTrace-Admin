import { db } from './config.js';
import { collection, addDoc, getDocs, doc, deleteDoc, getDoc, updateDoc, Timestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const IMGBB_KEY = '679c2ed64c23cfbde43bf6fdb94aaed6'; // MUST BE VALID
let currentUserId = null; // Will be set from auth context

// --- 1. IMAGE UPLOAD TO IMGBB ---
async function uploadImg(file) {
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, { method: 'POST', body: formData });
    
    if (!res.ok) throw new Error("ImgBB Upload Failed. Check your API Key.");
    
    const data = await res.json();
    return data.data.url;
}

// --- 2. LOAD PROJECTS DROPDOWN ---
async function loadProjects() {
    const select = document.getElementById('projectId');
    if (!select) return;
    
    const snap = await getDocs(collection(db, 'projects'));
    select.innerHTML = '<option value="">Select Project</option>';
    snap.forEach(doc => {
        select.innerHTML += `<option value="${doc.id}">${doc.data().title}</option>`;
    });
}

// --- 3. FORM SUBMISSION - CREATE/PUBLISH ARTICLE ---
document.getElementById('articleForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const projectId = document.getElementById('projectId').value;
    if (!projectId) return alert("Please select a project!");

    const btn = document.getElementById('publishBtn');
    btn.disabled = true;
    btn.innerText = "Publishing...";

    try {
        let photoUrl = null;
        const photoFile = document.getElementById('articlePhoto').files[0];
        const photoUrlInput = document.getElementById('articlePhotoUrl').value;
        
        // Priority: File upload first, then URL
        if (photoFile) {
            photoUrl = await uploadImg(photoFile);
        } else if (photoUrlInput) {
            photoUrl = photoUrlInput;
        }

        const article = {
            project_id: projectId,
            user_id: currentUserId,
            article_type: document.getElementById('articleType').value,
            article_description: document.getElementById('articleDescription').value,
            article_photo_url: photoUrl,
            article_status: document.getElementById('articleStatus').value,
            article_created_at: Timestamp.now(),
            article_updated_at: Timestamp.now()
        };

        await addDoc(collection(db, 'articles'), article);
        alert("Article Published Successfully!");
        document.getElementById('articleForm').reset();
        renderArticles();
    } catch (err) {
        console.error("FULL ERROR DETAILS:", err);
        alert("Error: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "Publish Article";
    }
});

// --- 4. DELETE ARTICLE ---
window.deleteArticle = async (id) => {
    if (confirm("Delete this article?")) {
        await deleteDoc(doc(db, "articles", id));
        renderArticles();
    }
};

// --- 5. UPDATE ARTICLE STATUS ---
window.updateArticleStatus = async (id, newStatus) => {
    try {
        await updateDoc(doc(db, "articles", id), {
            article_status: newStatus,
            article_updated_at: Timestamp.now()
        });
        renderArticles();
    } catch (err) {
        alert("Error updating status: " + err.message);
    }
};

// --- 6. RENDER ARTICLES TABLE ---
async function renderArticles() {
    const tbody = document.getElementById('articlesTableBody');
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Loading...</td></tr>';
    
    try {
        const snap = await getDocs(collection(db, 'articles'));
        tbody.innerHTML = '';

        for (const d of snap.docs) {
            const a = d.data();
            const statusBadge = a.article_status === 'Published' ? 'badge bg-success' : 
                               a.article_status === 'Archived' ? 'badge bg-secondary' : 'badge bg-warning';
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td id="project-${d.id}">Loading...</td>
                <td>${a.article_type}</td>
                <td><small>${a.article_description.substring(0, 50)}...</small></td>
                <td class="text-center">
                    ${a.article_photo_url ? `<img src="${a.article_photo_url}" width="40" height="40" style="border-radius:4px; object-fit:cover;">` : 'No Image'}
                </td>
                <td class="text-center">
                    <span class="${statusBadge}">${a.article_status}</span>
                </td>
                <td class="text-center">
                    <select class="form-select form-select-sm" onchange="updateArticleStatus('${d.id}', this.value)">
                        <option value="Draft" ${a.article_status === 'Draft' ? 'selected' : ''}>Draft</option>
                        <option value="Published" ${a.article_status === 'Published' ? 'selected' : ''}>Published</option>
                        <option value="Archived" ${a.article_status === 'Archived' ? 'selected' : ''}>Archived</option>
                    </select>
                </td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteArticle('${d.id}')">Delete</button>
                </td>
            `;
            tbody.appendChild(row);

            // Fetch project name asynchronously
            if (a.project_id) {
                getDoc(doc(db, "projects", a.project_id)).then(projSnap => {
                    if (projSnap.exists()) {
                        document.getElementById(`project-${d.id}`).innerText = projSnap.data().title;
                    }
                });
            }
        }

        if (snap.empty) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">No articles yet</td></tr>';
        }
    } catch (err) {
        console.error("RENDER ERROR:", err);
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Error loading articles</td></tr>`;
    }
}

// --- 7. FILTER ARTICLES BY STATUS ---
window.filterArticlesByStatus = async (status) => {
    const tbody = document.getElementById('articlesTableBody');
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Loading...</td></tr>';
    
    try {
        const snap = await getDocs(collection(db, 'articles'));
        tbody.innerHTML = '';
        let count = 0;

        for (const d of snap.docs) {
            const a = d.data();
            if (a.article_status !== status) continue;
            
            count++;
            const statusBadge = a.article_status === 'Published' ? 'badge bg-success' : 
                               a.article_status === 'Archived' ? 'badge bg-secondary' : 'badge bg-warning';
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td id="project-${d.id}">Loading...</td>
                <td>${a.article_type}</td>
                <td><small>${a.article_description.substring(0, 50)}...</small></td>
                <td class="text-center">
                    ${a.article_photo_url ? `<img src="${a.article_photo_url}" width="40" height="40" style="border-radius:4px; object-fit:cover;">` : 'No Image'}
                </td>
                <td class="text-center">
                    <span class="${statusBadge}">${a.article_status}</span>
                </td>
                <td class="text-center">
                    <select class="form-select form-select-sm" onchange="updateArticleStatus('${d.id}', this.value)">
                        <option value="Draft" ${a.article_status === 'Draft' ? 'selected' : ''}>Draft</option>
                        <option value="Published" ${a.article_status === 'Published' ? 'selected' : ''}>Published</option>
                        <option value="Archived" ${a.article_status === 'Archived' ? 'selected' : ''}>Archived</option>
                    </select>
                </td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteArticle('${d.id}')">Delete</button>
                </td>
            `;
            tbody.appendChild(row);

            if (a.project_id) {
                getDoc(doc(db, "projects", a.project_id)).then(projSnap => {
                    if (projSnap.exists()) {
                        document.getElementById(`project-${d.id}`).innerText = projSnap.data().title;
                    }
                });
            }
        }

        if (count === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No articles with status: ${status}</td></tr>`;
        }
    } catch (err) {
        console.error("FILTER ERROR:", err);
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Error filtering articles</td></tr>`;
    }
};

// --- 8. INITIALIZE ---
loadProjects();
renderArticles();

