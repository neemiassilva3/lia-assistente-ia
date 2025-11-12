// --- VARIÁVEIS GLOBAIS E REFERÊNCIAS DE ELEMENTOS ---
const avatarVideoMain = document.getElementById('avatarVideoMain');
const avatarVideoCamera = document.getElementById('avatarVideoCamera');
const allAvatarVideos = [avatarVideoMain, avatarVideoCamera];
// Caminhos dos vídeos agora são relativos à pasta static
const IDLE_VIDEO_SRC = "/static/lia_idle.mp4";
const SPEAKING_VIDEO_SRC = "/static/lia_speaking.mp4";

const tts = window.speechSynthesis;
let ptBRVoice = null;
const responseCache = new Map();
let userQuestionHistory = []; 
const body = document.body;
const mainView = document.getElementById('mainView');
const cameraView = document.getElementById('cameraView');
const reviewView = document.getElementById('reviewView');
const reviewImage = document.getElementById('reviewImage');
const btnRetake = document.getElementById('btnRetake');
const btnConfirm = document.getElementById('btnConfirm');
const welcomeTitle = document.getElementById('welcomeTitle');
const cameraWelcomeTitle = document.getElementById('cameraWelcomeTitle');
const avatarContainer = document.getElementById('avatarContainer');
const tokenSection = document.getElementById('tokenSection');
const tokenInputs = document.querySelectorAll('.token-inputs input');
const actionButtons = document.getElementById('actionButtons');
const btnYes = document.getElementById('btnYes');
const btnNo = document.getElementById('btnNo');
const video = document.getElementById('cameraFeed');
const canvas = document.getElementById('photoCanvas');
const captureBtn = document.getElementById('captureBtn');
const pointsDisplay = document.getElementById('pointsDisplay');
const chatContainer = document.getElementById('chatContainer');
const liaSpeechBubble = document.getElementById('liaSpeechBubble');
const bubbleText = document.getElementById('bubbleText');
const liaFollowUp = document.getElementById('liaFollowUp');
const followUpText = document.getElementById('followUpText');
const followUpBtn = document.getElementById('followUpBtn');
const questionHistoryPills = document.getElementById('questionHistoryPills');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const micIcon = document.getElementById('micIcon');
const sendIcon = document.getElementById('sendIcon');

// URL do Backend (o Flask está servindo na mesma raiz)
const BACKEND_URL = "/"; // Pode ser simplificado
let currentUserToken = null;
let capturedImageDataUrl = null;
const greetings = ["Ei! Você!", "Chega mais!", "Se aproxime!"];
let greetingInterval = setInterval(() => {
    if (!document.body.classList.contains('camera-mode') && !currentUserToken && !chatContainer.classList.contains('visible')) {
      setAndSpeakTitle(greetings[Math.floor(Math.random() * greetings.length)]);
    }
}, 3000);
let titleTimeout = null;

// --- LÓGICA DE TTS E CONTROLE DE VÍDEO ---
function loadTTSVoices() {
    if (!tts) return;
    let voices = tts.getVoices();
    if (voices.length === 0) {
        console.warn("TTS: Vozes ainda não carregadas, tentando novamente.");
        return; 
    }
    const ptVoices = voices.filter(v => v.lang === 'pt-BR');
    if (ptVoices.length === 0) {
         console.warn("TTS: Nenhuma voz 'pt-BR' encontrada.");
         return;
    }
    const femaleNames = ['Maria', 'Luciana', 'Helena', 'Camila', 'Francisca']; 
    ptBRVoice = ptVoices.find(v => femaleNames.some(name => v.name.includes(name)));
    if (!ptBRVoice) {
        ptBRVoice = ptVoices.find(v => v.name.includes('Google'));
    }
    if (!ptBRVoice) {
        ptBRVoice = ptVoices[0];
    }
    console.log("TTS: Vozes carregadas.");
    if (ptBRVoice) {
        console.log(`TTS: Voz 'pt-BR' selecionada: ${ptBRVoice.name}`);
    } else {
        console.warn("TTS: Nenhuma voz 'pt-BR' pôde ser selecionada.");
    }
}
loadTTSVoices();
if (tts && tts.onvoiceschanged !== undefined) {
    tts.onvoiceschanged = loadTTSVoices;
}
function setAvatarState(state) {
    const isSpeaking = state === 'speaking';
    // Caminhos de vídeo precisam ser corrigidos para o Flask
    const newSrc = isSpeaking ? avatarVideoMain.src.replace("lia_idle.mp4", "lia_speaking.mp4") : avatarVideoMain.src.replace("lia_speaking.mp4", "lia_idle.mp4");
    
    allAvatarVideos.forEach(videoEl => {
        if (!videoEl) return;
        
        if (videoEl.src !== newSrc) {
            videoEl.src = newSrc;
        }
        videoEl.loop = true; 
        videoEl.muted = true;
        videoEl.play().catch(e => console.warn("Erro ao tocar vídeo do avatar:", e));
    });
}
function speakMessage(text) {
    if (!tts || !text) {
        console.warn("TTS não suportado ou texto vazio.");
        return;
    }
    tts.cancel(); 
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    if (ptBRVoice) {
        utterance.voice = ptBRVoice;
    }
    utterance.onstart = () => {
        console.log("TTS: Começou a falar.");
        setAvatarState('speaking');
    };
    utterance.onend = () => {
        console.log("TTS: Terminou de falar.");
        setAvatarState('idle');
    };
    utterance.onerror = (e) => {
        console.error("Erro no TTS:", e);
        setAvatarState('idle');
    };
    tts.speak(utterance);
}
function setAndSpeakTitle(text, view = 'main') {
    const titleElement = (view === 'camera') ? cameraWelcomeTitle : welcomeTitle;
    if (titleElement) { titleElement.innerHTML = text; }
    speakMessage(text);
}

// --- LÓGICA DE RECONHECIMENTO DE VOZ ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isListening = false; 
if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = 'pt-BR';
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  console.log("API de Reconhecimento de Voz suportada.");
  recognition.onresult = (event) => {
    const speechResult = event.results[0][0].transcript;
    console.log('Voz:', speechResult);
    chatInput.value = speechResult;
    chatInput.dispatchEvent(new Event('input')); 
    if (chatInput.value.trim() !== '') { sendBtn.click(); } 
  };
  recognition.onerror = (event) => {
    console.error('Erro voz:', event.error);
    let errorMsg = "Não ouvi direito.";
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      errorMsg = "Preciso de permissão para o microfone.";
      alert(errorMsg);
    } else if (event.error === 'no-speech') { errorMsg = "Não detectei fala."; }
    stopListening();
  };
  recognition.onend = () => { stopListening(); };
} else {
  console.warn("API de Reconhecimento de Voz NÃO suportada.");
  micIcon.style.opacity = '0.5'; 
}
function startListening() {
    if (recognition && !isListening) {
        if (tts) tts.cancel(); 
        try {
            recognition.start();
            isListening = true;
            sendBtn.classList.add('listening'); 
            micIcon.style.display = 'block';
            sendIcon.style.display = 'none';
            console.log("Ouvindo...");
        } catch (e) { console.error("Erro startListen:", e); isListening = false; sendBtn.classList.remove('listening'); }
    }
}
function stopListening() {
    if (recognition && isListening) { recognition.stop(); } 
    isListening = false; 
    sendBtn.classList.remove('listening'); 
    chatInput.dispatchEvent(new Event('input')); 
    console.log("Parou ouvir.");
}

// --- CONTROLE DE UI (TELAS E INTERAÇÕES) ---
function showScreen(screenToShow) {
    ['mainView', 'cameraView', 'reviewView'].forEach(screenId => {
        document.getElementById(screenId).classList.add('hidden');
    });
    document.getElementById(screenToShow).classList.remove('hidden');
}
function showInteraction(interactionToShow) {
    ['tokenSection', 'actionButtons', 'chatContainer'].forEach(elemId => {
        const elem = document.getElementById(elemId);
        if (elemId === interactionToShow) { elem.classList.add('visible'); }
        else { elem.classList.remove('visible'); }
    });
}
function handleFirstInteraction() {
    clearInterval(greetingInterval);
    setAndSpeakTitle("Você tem VIP?!");
    showInteraction('tokenSection');
    tokenInputs[0].focus();
}
function triggerCelebration() { confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } }); }
function showPointsNotification(message) {
    const container = document.getElementById('notificationContainer');
    const notification = document.createElement('div');
    notification.className = 'toast-notification'; notification.textContent = message;
    container.appendChild(notification); setTimeout(() => { notification.remove(); }, 4800);
}

// --- FLUXO DE LOGIN E CÂMERA ---
async function validateToken() {
    const token = Array.from(tokenInputs).map(input => input.value).join('');
    if (token.length < 3) return;
    tokenInputs.forEach(input => input.disabled = true);
    try {
        const response = await fetch(`/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
        if (!response.ok) throw new Error('Erro rede.');
        const result = await response.json();
        if (result.valido) {
            currentUserToken = token.toUpperCase();
            setAndSpeakTitle(`Boas-vindas, ${result.nome}!`);
            pointsDisplay.textContent = result.totalPoints;
            if (result.achievementUnlocked) { showPointsNotification(result.achievementMessage); triggerCelebration(); }
            showInteraction(null);
            setTimeout(() => {
                setAndSpeakTitle("Vamos tirar uma foto?!");
                showInteraction('actionButtons');
                btnYes.onclick = () => { clearTimeout(titleTimeout); showInteraction(null); enterCameraMode(); };
                btnNo.onclick = () => { clearTimeout(titleTimeout); showInteraction(null); enterChatMode("Sem problemas! Sobre o que gostaria de saber?"); };
            }, 2000);
            titleTimeout = setTimeout(() => { 
              setAndSpeakTitle("É pra guardar de lembrança!"); 
            }, 3500);
        } else {
            setAndSpeakTitle("VIP inválido! Tente novamente.");
            tokenInputs.forEach(input => { input.value = ''; input.disabled = false; }); tokenInputs[0].focus();
        }
    } catch (error) {
        console.error("Erro validação:", error);
        setAndSpeakTitle("Erro conexão.");
        tokenInputs.forEach(input => { input.value = ''; input.disabled = false; }); tokenInputs[0].focus();
    }
}
function enterCameraMode() {
    body.classList.remove('chat-mode');
    body.classList.add('camera-mode');
    showScreen('cameraView');
    setAndSpeakTitle("Prepare-se...", 'camera');
    setTimeout(() => { setAndSpeakTitle("Seguro, nada armazenado.", 'camera'); }, 1000);
    setTimeout(() => { setAndSpeakTitle("Foto direto pra você.", 'camera'); }, 4500);
    startCameraStream();
}
function exitToMainScreen(nextMessage) {
    body.classList.remove('camera-mode');
    showScreen('mainView');
    if (video.srcObject) { video.srcObject.getTracks().forEach(track => track.stop()); }
    setAndSpeakTitle(nextMessage);
}
async function startCameraStream() {
    try { const stream = await navigator.mediaDevices.getUserMedia({ video: true }); video.srcObject = stream; }
    catch (err) { console.error("Erro câmera: ", err); exitToMainScreen("Não acessei sua câmera!"); }
}
async function enviarFotoParaBackend(imageDataUrl) {
    if (!currentUserToken) return;
    try {
        const response = await fetch(`/foto-lembranca`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: currentUserToken, imageData: imageDataUrl }) });
        const result = await response.json();
        if (result.sucesso) { pointsDisplay.textContent = result.novaPontuacao; showPointsNotification(result.mensagem); if (result.achievementUnlocked) triggerCelebration(); }
        else { console.error("Erro backend pontos:", result.mensagem); }
    } catch (error) { console.error("Erro rede foto:", error); }
}
captureBtn.addEventListener('click', () => { /* ... (código original da captura) */ });
btnRetake.addEventListener('click', () => { /* ... (código original do retake) */ });
btnConfirm.addEventListener('click', async () => {
    exitToMainScreen("Enviando foto...");
    await enviarFotoParaBackend(capturedImageDataUrl);
    enterChatMode("Foto enviada! Agora, o que gostaria de saber?");
});

// --- LÓGICA DE CHAT (PÍLULAS E NUVEM) ---
function enterChatMode(initialMessage) {
  if (tts) tts.cancel();
  welcomeTitle.innerHTML = "Pode perguntar o que quiser!";
  updateQuestionPills(null); 
  showInteraction('chatContainer');
  if (initialMessage) { 
    displayLiasMessage({ resposta: initialMessage }); 
  }
  chatInput.focus();
}
function updateQuestionPills(newQuestion) {
  if (newQuestion) {
    userQuestionHistory = userQuestionHistory.filter(q => q !== newQuestion);
    userQuestionHistory.unshift(newQuestion);
    userQuestionHistory = userQuestionHistory.slice(0, 3);
  }
  questionHistoryPills.innerHTML = ''; 
  userQuestionHistory.slice().reverse().forEach((question, indexInReversed) => {
    const pill = document.createElement('button');
    pill.className = 'question-pill';
    const originalIndex = (userQuestionHistory.length - 1) - indexInReversed;
    if (originalIndex === 0) {
      pill.classList.add('question-pill--primary'); 
    } else {
      pill.classList.add('question-pill--secondary'); 
    }
    pill.innerText = question;
    pill.title = question; 
    pill.style.animationDelay = `${indexInReversed * 0.1}s`;
    pill.onclick = () => handlePillClick(question);
    questionHistoryPills.appendChild(pill);
  });
}
function handlePillClick(questionText) {
  if (isListening) { stopListening(); }
  chatInput.value = questionText;
  chatInput.dispatchEvent(new Event('input'));
  sendBtn.click();
}
function displayLiasMessage(data) {
  bubbleText.innerHTML = data.resposta;
  speakMessage(data.resposta);
  if (data.followUpQuestion && data.followUpAction) {
    followUpText.innerText = data.followUpQuestion;
    followUpBtn.onclick = () => {
      handlePillClick(data.followUpAction); 
    };
    liaFollowUp.style.display = 'flex'; 
  } else {
    liaFollowUp.style.display = 'none'; 
  }
  liaSpeechBubble.classList.add('visible');
}
chatInput.addEventListener('input', () => {
    if (tts) tts.cancel(); 
    if (isListening) return; 
    micIcon.style.display = (chatInput.value.length > 0) ? 'none' : 'block';
    sendIcon.style.display = (chatInput.value.length > 0) ? 'block' : 'none';
});
sendBtn.addEventListener('click', async () => {
    if (chatInput.value.trim() === '' && recognition && !isListening) { startListening(); return; }
    if (isListening) { stopListening(); return; }
    if (tts) tts.cancel();
    const userMessage = chatInput.value;
    liaSpeechBubble.classList.remove('visible'); 
    updateQuestionPills(userMessage); 
    chatInput.value = '';
    chatInput.dispatchEvent(new Event('input')); 
    chatInput.disabled = true; sendBtn.disabled = true;
    if (responseCache.has(userMessage)) {
        console.log("CACHE: Resposta encontrada no cache.");
        const cachedResult = responseCache.get(userMessage);
        setTimeout(() => {
          displayLiasMessage(cachedResult);
          chatInput.disabled = false; 
          sendBtn.disabled = false; 
          chatInput.focus();
        }, 400); 
        return; 
    }
    try {
        const response = await fetch(`/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pergunta: userMessage }) });
        if (!response.ok) { let errorMsg = 'Erro servidor.'; try { const e = await response.json(); errorMsg = e.resposta || errorMsg; } catch(_) {} throw new Error(errorMsg); }
        const result = await response.json();
        responseCache.set(userMessage, result);
         setTimeout(() => {
            displayLiasMessage(result);
         }, 400);
    } catch (error) {
        console.error("Erro chat:", error);
        setTimeout(() => {
          displayLiasMessage({ resposta: error.message || "Problema conexão." });
        }, 400);
    } finally {
        chatInput.disabled = false; 
        sendBtn.disabled = false; 
        chatInput.focus();
    }
});
chatInput.addEventListener('keyup', (e) => { if(e.key === 'Enter' && !isListening) sendBtn.click(); });

// --- LISTENERS DE EVENTOS INICIAIS ---
tokenInputs.forEach((input, index) => {
    input.addEventListener('keyup', (e) => {
        const val = input.value;
        if (e.key === "Backspace" && index > 0) { tokenInputs[index - 1].focus(); }
        if (val.length === 1 && /^[a-zA-Z0-9]$/.test(val)) { if (index < tokenInputs.length - 1) tokenInputs[index + 1].focus(); else validateToken(); }
    });
});
window.addEventListener('mousemove', handleFirstInteraction, { once: true });
welcomeTitle.innerHTML = greetings[0];