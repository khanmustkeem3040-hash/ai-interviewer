// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCnU1eZUG6W6898iWqaHG7V8N2pE9Yhv6A",
  authDomain: "world-quiz-leaderboard.firebaseapp.com",
  databaseURL: "https://world-quiz-leaderboard-default-rtdb.firebaseio.com",
  projectId: "world-quiz-leaderboard",
  storageBucket: "world-quiz-leaderboard.firebasestorage.app",
  messagingSenderId: "1007495686390",
  appId: "1:1007495686390:web:86a37a5ad6cd72eb2c24d7"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Variables
let finalName = ""; let phoneVerified = false; let userPhoneNum = "";
let score = 0; let correctAnswer = ''; let answered = false; let timer; let timeLeft = 30;
let questionCount = 0; let currentTimerLabel = "Time Left";
let currentQuestionText = ""; let currentOptionsTexts = [];
let hintUsed = false;

// Audio
const correctSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3');
const wrongSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3');
const tickSound = new Audio('https://assets.mixkit.co/active_storage/sfx/588/588-preview.mp3');
tickSound.loop = true;

// Registration & Navigation
function handlePhone() {
    let phone = document.getElementById("userPhone").value;
    if(phone.length < 10) { alert("Sahi number daalein!"); return; }
    if(!phoneVerified) {
        document.getElementById("otp-area").style.display = "block";
        document.getElementById("phoneBtn").innerText = "Verify OTP";
        phoneVerified = true; userPhoneNum = phone;
    } else {
        let otp = document.getElementById("otpInput").value;
        if(otp === "1234") {
            document.getElementById("step-phone").style.display = "none";
            document.getElementById("step-name").style.display = "block";
        } else { alert("Galat OTP! 1234 try karein."); }
    }
}

function startQuiz() {
    let f = document.getElementById("fName").value;
    let l = document.getElementById("lName").value;
    if(f === "" || l === "") { alert("Naam aur Surname bhariye!"); return; }
    finalName = f + " " + l;
    document.getElementById("step-name").style.display = "none";
    document.getElementById("quiz-content").style.display = "block";
    document.getElementById("display-name").innerText = finalName;
}

function playAgainWithoutReg() {
    score = 0; questionCount = 0; hintUsed = false;
    window.speechSynthesis.cancel();
    tickSound.pause(); tickSound.currentTime = 0;
    document.getElementById("leaderboard-area").style.display = "none";
    document.getElementById("quiz-content").style.display = "block";
    document.getElementById("score").textContent = "Score: 0";
    document.getElementById("nextBtn").textContent = "Start Quiz Now 🚀";
    document.getElementById("languageSelect").disabled = false;
    document.getElementById("categorySelect").disabled = false;
    document.getElementById("hintBtn").disabled = false;
}

function resetScore() {
    score = 0; questionCount = 0; hintUsed = false;
    window.speechSynthesis.cancel();
    tickSound.pause(); tickSound.currentTime = 0;
    updateInterface();
    clearInterval(timer);
}

// Utility & Translation
function decode(html) { const txt = document.createElement("textarea"); txt.innerHTML = html; return txt.value; }

async function translate(text, targetLang){
    if(targetLang==='en') return text;
    try {
        const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${targetLang}`);
        const data = await res.json();
        return data.responseData.translatedText || text;
    } catch(err){ return text; }
}

async function updateInterface() {
    const lang = document.getElementById('languageSelect').value;
    document.getElementById("label-lang").textContent = await translate("Select Language", lang);
    document.getElementById("label-cat").textContent = await translate("Select Category", lang);
    document.getElementById("sub-label-cat").textContent = await translate("Select Category", lang);
    currentTimerLabel = await translate("Time Left", lang);
    updateTimerUI();
}

function updateTimerUI() {
    const timerEl = document.getElementById("timer");
    timerEl.textContent = `${currentTimerLabel}: ${timeLeft}s`;
    if (timeLeft > 10) { timerEl.style.color = "#333"; timerEl.classList.remove("timer-low"); }
    else { timerEl.style.color = "red"; timerEl.classList.add("timer-low"); }
}

// Quiz Features
function toggleSpeech() {
    if (window.speechSynthesis.speaking) { window.speechSynthesis.cancel(); }
    else {
        const lang = document.getElementById('languageSelect').value;
        const speech = new SpeechSynthesisUtterance();
        speech.text = currentQuestionText + ". Options are: " + currentOptionsTexts.join(", ");
        speech.lang = lang; speech.rate = 0.9;
        window.speechSynthesis.speak(speech);
    }
}

function useHint() {
    if(hintUsed || answered) return;
    hintUsed = true;
    document.getElementById("hintBtn").disabled = true;
    const buttons = document.querySelectorAll(".option");
    let hidden = 0;
    buttons.forEach(btn => {
        if(!btn.textContent.includes(correctAnswer) && hidden < 2) {
            btn.style.visibility = "hidden";
            hidden++;
        }
    });
}

// Game Core Logic
async function loadQuestion(){
    if (questionCount >= 5) { showFinalResult(); return; }
    document.getElementById("languageSelect").disabled = true;
    document.getElementById("categorySelect").disabled = true;
    const lang = document.getElementById('languageSelect').value;

    clearInterval(timer); tickSound.pause(); tickSound.currentTime = 0;
    timeLeft = 30; answered = false; window.speechSynthesis.cancel(); 
    document.getElementById("quiz-box").classList.remove("vibrate");
    document.getElementById("message").textContent = "";
    document.getElementById("left-column").innerHTML = "";
    document.getElementById("right-column").innerHTML = "";
    document.getElementById("question").textContent = "Loading...";
    
    hintUsed = false;
    document.getElementById("hintBtn").disabled = false;
    document.getElementById("hintBtn").style.display = "inline-block";
    
    const cat = document.getElementById('categorySelect').value;
    try {
        const res = await fetch(`https://opentdb.com/api.php?amount=1&category=${cat}&type=multiple`);
        const data = await res.json();
        if(data.results && data.results.length > 0){
            questionCount++; 
            const q = data.results[0];
            let qT = decode(q.question); let cA = decode(q.correct_answer);
            let iA = q.incorrect_answers.map(a => decode(a));
            if(lang !== 'en'){
                qT = await translate(qT, lang); cA = await translate(cA, lang);
                for(let i=0; i<iA.length; i++) iA[i] = await translate(iA[i], lang);
            }
            correctAnswer = cA;
            const allOptions = [...iA, cA].sort(() => Math.random() - 0.5);
            currentQuestionText = qT; currentOptionsTexts = allOptions;
            document.getElementById("question").textContent = "Q. " + qT;
            document.getElementById("speaker-area").style.display = "block"; 
            
            allOptions.forEach((opt, index) => {
                const btn = document.createElement("button");
                btn.innerHTML = `<span>${String.fromCharCode(65+index)}.</span> ${opt}`;
                btn.className = "option";
                btn.style.backgroundColor = ['#3498db', '#e67e22', '#9b59b6', '#e74c3c'][index];
                btn.onclick = () => checkAnswer(btn, opt);
                
                if(index < 2) document.getElementById("left-column").appendChild(btn);
                else document.getElementById("right-column").appendChild(btn);
            });
            document.getElementById("nextBtn").textContent = await translate("Next Question", lang);
            startTimer();
        }
    } catch(e) { document.getElementById("question").textContent = "Error!"; }
}

function startTimer(){
    timer = setInterval(() => {
        timeLeft--; updateTimerUI();
        if(timeLeft <= 10 && timeLeft > 0 && !answered) { tickSound.play().catch(e => {}); }
        if(timeLeft <= 0) { 
            clearInterval(timer); tickSound.pause(); wrongSound.play();
            document.getElementById("quiz-box").classList.add("vibrate");
            answered = true;
            revealCorrect(); 
            setTimeout(() => { loadQuestion(); }, 3000);
        }
    }, 1000);
}

function checkAnswer(btn, selected){
    if(answered) return; answered = true; clearInterval(timer); tickSound.pause();
    const buttons = document.querySelectorAll(".option");
    buttons.forEach(b => b.disabled = true);
    
    if(selected === correctAnswer){
        correctSound.play(); btn.classList.add("correct", "reveal-correct");
        score++; 
        document.getElementById("score").textContent = "Score: " + score;
        confetti({ particleCount: 300, spread: 100, origin: { y: 0.6 } }); 
    } else {
        wrongSound.play(); btn.classList.add("incorrect");
        document.getElementById("quiz-box").classList.add("vibrate");
        revealCorrect();
    }
    
    setTimeout(() => {
        if(questionCount < 5) loadQuestion();
        else showFinalResult();
    }, 2000);
}

function revealCorrect(){
    const buttons = document.querySelectorAll(".option");
    buttons.forEach(b => {
        if(b.textContent.includes(correctAnswer)) b.classList.add("correct", "reveal-correct");
    });
}

// Data Storage & Results
function saveToFirebase() {
    if(!userPhoneNum) return;
    database.ref('quiz_scores/' + userPhoneNum).set({
        name: finalName, score: score, total: questionCount, timestamp: new Date().toLocaleString()
    });
}

async function showFinalResult() {
    clearInterval(timer); tickSound.pause();
    saveToFirebase();
    document.getElementById("quiz-content").style.display = "none";
    document.getElementById("leaderboard-area").style.display = "block";
    confetti({ particleCount: 300, spread: 100, origin: { y: 0.6 } }); 
    loadLeaderboardData();
}

function loadLeaderboardData() {
    database.ref('quiz_scores').on('value', (snapshot) => {
        const data = snapshot.val();
        let scoresArray = [];
        for(let phone in data) {
            if(data[phone] && data[phone].name) { scoresArray.push(data[phone]); }
        }
        scoresArray.sort((a, b) => b.score - a.score);
        const tbody = document.getElementById("leaderboard-body");
        tbody.innerHTML = scoresArray.slice(0, 10).map((u, i) => 
            `<tr class="${i===0?'rank-1':''}">
                <td>${i+1}</td>
                <td>${u.name}</td>
                <td>${u.score}/${u.total || 5}</td>
            </tr>`
        ).join('');
    });
}