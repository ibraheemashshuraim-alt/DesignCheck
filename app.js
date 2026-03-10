const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');

// UI Elements
const uploadContent = document.getElementById('uploadContent');
const previewContent = document.getElementById('previewContent');
const previewImage = document.getElementById('previewImage');
const scannerLine = document.getElementById('scannerLine');
const previewActions = document.getElementById('previewActions');

const resultsPanel = document.getElementById('resultsPanel');
const resultsOverlay = document.getElementById('resultsOverlay');
const panelHeaderText = document.getElementById('panelHeaderText');
const exportActions = document.getElementById('exportActions');
const overallScoreText = document.getElementById('overallScoreText');
const loadingOverlay = document.getElementById('loadingOverlay');

// Auth Buttons
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const authContainer = document.getElementById('authContainer');

// API Key Elements
const apiKeyInput = document.getElementById('apiKeyInput');
const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
const editApiKeyBtn = document.getElementById('editApiKeyBtn');
const apiHintText = document.getElementById('apiHintText');

let currentFile = null;

// User Auth State
let userState = {
    loggedIn: false,
    uid: null,
    email: null,
    isPremium: false,
    credits: 5
};

// ================ API KEY ================
function initApiKey() {
    const savedKey = localStorage.getItem('geminiApiKey');
    if (savedKey) {
        apiKeyInput.value = savedKey;
        apiKeyInput.type = 'password';
        apiKeyInput.disabled = true;
        saveApiKeyBtn.classList.add('hidden');
        editApiKeyBtn.classList.remove('hidden');
        apiHintText.innerText = "API Key محفوظ ہے۔";
        apiHintText.style.color = "#00f0ff";
    }
}
initApiKey();

window.saveApiKey = function() {
    const key = apiKeyInput.value.trim();
    if (!key) { alert("براہ کرم پہلے API Key درج کریں۔"); return; }
    localStorage.setItem('geminiApiKey', key);
    apiKeyInput.type = 'password'; apiKeyInput.disabled = true;
    saveApiKeyBtn.classList.add('hidden'); editApiKeyBtn.classList.remove('hidden');
    apiHintText.innerText = "API Key محفوظ ہو گئی۔"; apiHintText.style.color = "#00f0ff";
    setTimeout(() => { document.getElementById('apiSettingsModal').classList.add('hidden') }, 1000);
}

window.editApiKey = function() {
    apiKeyInput.disabled = false; apiKeyInput.type = 'text'; apiKeyInput.focus();
    saveApiKeyBtn.classList.remove('hidden'); editApiKeyBtn.classList.add('hidden');
    apiHintText.innerText = "اپنی نئی API Key درج کریں"; apiHintText.style.color = "#ff9100";
}

// ================ FIREBASE AUTH ================
// ================ FIREBASE AUTH ================
function setupFirebaseAuth() {
    if (typeof firebase === 'undefined') {
        console.warn("Firebase JS not loaded.");
        return;
    }
    
    // Check local storage for instant UI update before auth state resolves
    const looksLoggedIn = localStorage.getItem('dc_user_logged_in') === 'true';
    if (looksLoggedIn) {
        loginBtn.style.display = 'none';
        logoutBtn.classList.remove('hidden');
    }

    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            userState.loggedIn = true;
            userState.uid = user.uid;
            userState.email = user.email;
            localStorage.setItem('dc_user_logged_in', 'true');
            await loadUserCreditsFromFirestore(user.uid);
            updateAuthUI(user);
        } else {
            userState.loggedIn = false;
            userState.uid = null;
            userState.email = null;
            userState.isPremium = false;
            localStorage.setItem('dc_user_logged_in', 'false');
            userState.credits = localStorage.getItem('dcGuestCredits') ? parseInt(localStorage.getItem('dcGuestCredits')) : 5;
            
            // Reset UI
            loginBtn.style.display = 'flex';
            logoutBtn.classList.add('hidden');
            const chip = document.getElementById('profileChip');
            if(chip) chip.remove();
        }
    });

    loginBtn.addEventListener('click', () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        firebase.auth().signInWithPopup(provider).catch((error) => {
            console.error("Login Error:", error);
            alert("لاگ ان میں مسئلہ پیش آیا: " + error.message);
        });
    });

    logoutBtn.addEventListener('click', () => {
        firebase.auth().signOut().then(() => {
            localStorage.setItem('dc_user_logged_in', 'false');
        });
    });
}

async function loadUserCreditsFromFirestore(uid) {
    try {
        const userRef = firebase.firestore().collection('users').doc(uid);
        const docSnap = await userRef.get();
        
        if (docSnap.exists) {
            const data = docSnap.data();
            userState.credits = data.credits !== undefined ? data.credits : (5 - (data.reportsUsed || 0));
            userState.isPremium = data.isPremium || false;
            localStorage.setItem(`dc_${uid}_credits`, userState.credits);
        } else {
            await userRef.set({
                email: userState.email,
                credits: 5,
                isPremium: false,
                createdAt: new Date()
            });
            userState.credits = 5;
            userState.isPremium = false;
            localStorage.setItem(`dc_${uid}_credits`, 5);
        }
    } catch (e) {
        console.error("Firestore read error, falling back to local storage", e);
        const cached = localStorage.getItem(`dc_${uid}_credits`);
        if(cached) { userState.credits = parseInt(cached); }
    }
}

async function decrementUserCredits() {
    if (userState.isPremium) return; 
    
    if (userState.loggedIn) {
        userState.credits--;
        localStorage.setItem(`dc_${userState.uid}_credits`, userState.credits); 
        try {
            const userRef = firebase.firestore().collection('users').doc(userState.uid);
            await userRef.update({
                credits: userState.credits
            });
        } catch (e) { console.error("Error updating credits in Firestore", e); }
        updateAuthUI(firebase.auth().currentUser);
    } else {
        userState.credits--;
        localStorage.setItem('dcGuestCredits', userState.credits);
    }
}

function updateAuthUI(user) {
    if(!user) return;
    loginBtn.style.display = 'none';
    logoutBtn.classList.remove('hidden');
    
    let planBadge = userState.isPremium 
        ? '<span style="color:#b500ff; font-weight:bold; font-size: 0.8rem; margin-right:5px;"><i class="fa-solid fa-crown"></i> Pro</span>' 
        : `<span style="font-size:0.8rem; color:#8ba5b0;">Credits: ${userState.credits}</span>`;
    
    let chip = document.getElementById('profileChip');
    if (!chip) {
        chip = document.createElement('div');
        chip.id = 'profileChip';
        chip.className = 'profile-chip';
        authContainer.prepend(chip);
    }
    
    const initial = user.email ? user.email.charAt(0).toUpperCase() : 'U';
    chip.innerHTML = `${planBadge}<div class="avatar">${initial}</div>`;
}

if (typeof firebase !== 'undefined') {
    setupFirebaseAuth();
} else {
    window.addEventListener('load', setupFirebaseAuth);
}

// ================ CORE LOGIC ================
function canAnalyze() {
    if (userState.isPremium) return true;
    if (userState.loggedIn) {
        if (userState.credits <= 0) {
            alert("Your free credits have been exhausted. Please upgrade to Pro.");
            document.getElementById('upgradeModal').classList.remove('hidden');
            return false;
        }
        return true;
    }
    alert("تجزیہ شروع کرنے کے لیے براہ کرم پہلے گوگل سے سائن ان (Login) کریں۔");
    return false;
}

dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = '#00f0ff'; });
dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = ''; });
dropZone.addEventListener('drop', (e) => {
    e.preventDefault(); dropZone.style.borderColor = '';
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});

// Removed the click override so the file dialog always opens
fileInput.addEventListener('change', function () {
    if (this.files.length) handleFile(this.files[0]);
});

function handleFile(file) {
    if (!file.type.startsWith('image/')) {
        alert('براہ کرم صرف تصویر (Image) فائل اپلوڈ کریں۔'); return;
    }
    currentFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        // Show image immediately
        uploadContent.classList.add('hidden');
        previewContent.classList.remove('hidden');
        previewImage.src = e.target.result;
        
        // Then attempt analysis
        if (canAnalyze()) {
            startAnalysis();
        } else {
            // Revert state if they cancel the logic to login
            resetApp();
        }
    };
    reader.readAsDataURL(file);
}

window.resetApp = function() {
    previewContent.classList.add('hidden');
    uploadContent.classList.remove('hidden');
    scannerLine.classList.remove('hidden');
    previewActions.classList.add('hidden');
    fileInput.value = '';
    currentFile = null;

    panelHeaderText.innerText = "WAITING FOR DESIGN...";
    panelHeaderText.style.color = "#00f0ff";
    resultsOverlay.style.opacity = "1";
    resultsOverlay.classList.remove('hidden');
    resultsOverlay.style.display = 'flex';
    exportActions.classList.add('hidden');
    document.getElementById('cardGood')?.classList.add('hidden');
    document.getElementById('cardBad')?.classList.add('hidden');
    document.getElementById('cardAdvice')?.classList.add('hidden');
}

// Helper: Resize image to speed up AI payload
function compressImage(file, maxSize = 512) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let w = img.width, h = img.height;
                if (w > h && w > maxSize) { h = Math.round((h * maxSize)/w); w = maxSize; }
                else if (h > maxSize) { w = Math.round((w * maxSize)/h); h = maxSize; }
                canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

async function startAnalysis() {
    let userApiKey = apiKeyInput.value.trim();
    if (!userApiKey) {
        // Fallback to the user's hardcoded key if they haven't saved it in UI
        userApiKey = "AIzaSyAIAv-_LWqKfQbqA_TQ3HpSi82Iv3gv1H0";
        apiKeyInput.value = userApiKey;
        localStorage.setItem('geminiApiKey', userApiKey);
    }

    uploadContent.classList.add('hidden');
    previewContent.classList.remove('hidden');
    scannerLine.classList.remove('hidden');
    previewActions.classList.add('hidden');

    panelHeaderText.innerText = "AI is analyzing your design...";
    panelHeaderText.style.color = "#b500ff";
    resultsOverlay.style.opacity = "1";
    resultsOverlay.classList.remove('hidden');
    exportActions.classList.add('hidden');
    document.getElementById('cardGood')?.classList.add('hidden');
    document.getElementById('cardBad')?.classList.add('hidden');
    document.getElementById('cardAdvice')?.classList.add('hidden');
    
    // Show Loading Overlay
    loadingOverlay.classList.remove('hidden');
    
    // MOCK ANALYSIS BYPASS (For quick local testing)
    if (userApiKey.toLowerCase() === 'mock') {
        setTimeout(async () => {
            loadingOverlay.classList.add('hidden');
            await decrementUserCredits();
            showResults({
                accessibilityScore: 95,
                spaceTip: "ڈیزائن میں مارجن بہت اچھے ہیں۔",
                fontTip: "توجہ کے لیے فونٹس بہترین ہیں۔",
                colorTip: "رنگوں کا امتزاج شاندار ہے۔",
                balanceTip: "ڈیزائن بہت متوازن اور جدید ہے۔",
                balanceScore: "Excellent (بہترین)",
                reportSummary: {    
                    strengths: ["Great Contrast", "Clean Layout"],
                    weaknesses: ["No major issues"],
                    advice: ["Ship it!"]
                },
                extractedColors: ["#00f0ff", "#b500ff", "#050b14", "#ffffff"],
                suggestedFonts: "Noto Nastaliq Urdu, Outfit"
            });
        }, 3000);
        return;
    }

    const promptText = `You are "DesignCheck", a fast AI design critic. Output ONLY a raw JSON string like this:
{
  "accessibilityScore": 85,
  "spaceTip": "عناصر کے درمیان خالی جگہ بہتر کریں۔",
  "fontTip": "فونٹس کا سائز بڑا کریں۔",
  "colorTip": "کنٹراسٹ بہتر کریں۔",
  "balanceTip": "تصویر متوازن ہے۔",
  "balanceScore": "Good | Fair | Poor",
  "reportSummary": {
    "strengths": ["Clean Layout", "Good Contrast"],
    "weaknesses": ["Text too small", "Cluttered footer"],
    "advice": ["Increase whitespace"]
  },
  "extractedColors": ["#FF0000", "#00FF00", "#0000FF", "#111111"],
  "suggestedFonts": "Font Name 1, Font Name 2"
}

- For the "Tip" fields (spaceTip, fontTip, colorTip, balanceTip), provide one SHORT sentence (max 10 words) in Urdu giving an actionable 'AI Tip'.
- For reportSummary arrays, keep items very short (2-4 words) in English or Urdu. Max 2 items per array.
- No markdown formatting, NO backticks around the JSON. Raw JSON only.`;

    const compressedBase64 = await compressImage(currentFile);
    const base64Image = compressedBase64.split(',')[1];
    const mimeType = 'image/jpeg';

    fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${userApiKey}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contents: [{
                parts: [
                    { text: promptText },
                    {
                        inlineData: {
                            mimeType: mimeType,
                            data: base64Image
                        }
                    }
                ]
            }]
        })
    })
    .then(async response => {
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error?.message || "نامعلوم خرابی (Unknown Error)");
        }
        
        let jsonStr = result.candidates[0].content.parts[0].text.trim();
        if (jsonStr.startsWith('\`\`\`json')) jsonStr = jsonStr.substring(7);
        if (jsonStr.startsWith('\`\`\`')) jsonStr = jsonStr.substring(3);
        if (jsonStr.endsWith('\`\`\`')) jsonStr = jsonStr.substring(0, jsonStr.length - 3);

        const data = JSON.parse(jsonStr.trim());

        loadingOverlay.classList.add('hidden');
        await decrementUserCredits();
        showResults(data);
    })
    .catch(error => {
        loadingOverlay.classList.add('hidden');
        console.error('API Error:', error);
        alert(`تجزیے میں مسئلہ پیش آیا:\n\n${error.message}\n\nبراہ کرم یقینی بنائیں کہ آپ کی API Key درست ہے۔`);
        resetApp();
    });
}

function showResults(data) {
    scannerLine.classList.add('hidden');
    previewActions.classList.remove('hidden');
    resultsOverlay.classList.add('hidden');
    setTimeout(()=> resultsOverlay.style.display = 'none', 500);

    panelHeaderText.innerText = "ANALYSIS COMPLETE";
    panelHeaderText.style.color = "#00e676";
    exportActions.classList.remove('hidden');
    document.getElementById('cardGood')?.classList.remove('hidden');
    document.getElementById('cardBad')?.classList.remove('hidden');
    document.getElementById('cardAdvice')?.classList.remove('hidden');

    // Score
    overallScoreText.innerText = data.accessibilityScore ?? 85;

    // Layout
    document.getElementById('spaceTipOut').innerText = data.spaceTip || "عناصر کے درمیان خالی جگہ کو بہتر بنائیں۔";

    // Typography
    document.getElementById('suggestedFontsOut').innerText = data.suggestedFonts || "Montserrat, Arial";
    document.getElementById('fontTipOut').innerText = data.fontTip || "فونٹ کا سائز اور کنٹراسٹ بہتر کریں۔";

    // Color
    const colors = data.extractedColors || ['#000000', '#ffffff'];
    document.getElementById('colorPaletteOut').innerHTML = colors.map(currColor => `
        <div class="color-item" style="background-color: ${currColor}" title="${currColor}"></div>
    `).join('');
    document.getElementById('colorTipOut').innerText = data.colorTip || "برانڈ کے مطابق رنگوں کا انتخاب کریں۔";

    // Balance
    document.getElementById('contrastOut').innerText = data.balanceScore || "Good (متوازن)";
    document.getElementById('accessTipOut').innerText = data.balanceTip || "عناصر کا وزن بہتر ہے، مزید بہتری کے لیے کنٹراسٹ کا خیال رکھیں۔";

    // Detailed Report Summary Chips
    if (data.reportSummary) {
        const { strengths, weaknesses, advice } = data.reportSummary;
        let p_good = (strengths || []).map(p => `<span class="chip chip-green">${p}</span>`).join(' ');
        let p_bad = (weaknesses || []).map(p => `<span class="chip chip-red">${p}</span>`).join(' ');
        let p_adv = (advice || []).map(p => `<span class="chip chip-purple">${p}</span>`).join(' ');
        
        document.getElementById('reportGoodOut').innerHTML = p_good || `<span class="chip chip-green">Good Design</span>`;
        document.getElementById('reportBadOut').innerHTML = p_bad || `<span class="chip chip-red">Minor adjustments needed</span>`;
        document.getElementById('reportAdviceOut').innerHTML = p_adv || `<span class="chip chip-purple">Keep it up!</span>`;
    }
}

// ============== Export Functions ===============
window.mockUpgradePremium = function() {
    userState.isPremium = true;
    if (userState.loggedIn && typeof firebase !== 'undefined') {
        const userRef = firebase.firestore().collection('users').doc(userState.uid);
        userRef.update({ isPremium: true }).catch(console.error);
        updateAuthUI(firebase.auth().currentUser);
    }
    document.getElementById('upgradeModal').classList.add('hidden');
    alert("Welcome to Pro! You now have unlimited analysis, PDF Downloads, and Printing.");
}

window.exportPNG = function() {
    html2canvas(document.getElementById('resultsPanel'), { backgroundColor: "#0c1626", scale: 2, useCORS: true }).then(canvas => {
        let link = document.createElement('a');
        link.download = 'DesignCheck-Report.png';
        link.href = canvas.toDataURL();
        link.click();
    });
}

window.exportPDF = function() {
    const { jsPDF } = window.jspdf;
    const target = document.getElementById('resultsPanel');
    
    // Save state
    const originalMaxHeight = target.style.maxHeight;
    const originalOverflow = target.style.overflow;
    target.style.maxHeight = 'none';
    target.style.overflow = 'visible';
    
    // Hide scrolling elements temporarily if needed, target the scroll area directly
    const scrollArea = target.querySelector('.results-scroll-area');
    const origScrollOverflow = scrollArea ? scrollArea.style.overflow : '';
    if (scrollArea) scrollArea.style.overflow = 'visible';

    html2canvas(target, { 
        backgroundColor: "#0c1626", 
        scale: 2, 
        useCORS: true, 
        logging: false,
        windowWidth: target.scrollWidth,
        windowHeight: target.scrollHeight
    }).then(canvas => {
        // Restore styles
        target.style.maxHeight = originalMaxHeight;
        target.style.overflow = originalOverflow;
        if (scrollArea) scrollArea.style.overflow = origScrollOverflow;

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save("DesignCheck-Report.pdf");
    });
}

window.exportPrint = function() {
    window.print();
}
