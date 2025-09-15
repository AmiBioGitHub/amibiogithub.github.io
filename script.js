// === Configuration Webhooks - URLs DE PRODUCTION n8n ===

// Sous-domaine configurable (changer ici seulement 👇)
const N8N_SUBDOMAIN = "44a3a42b59cf1a057677b52c66d40d12.serveo.net";

// Générateur d'URL webhook
const WEBHOOK = (path) => `https://${N8N_SUBDOMAIN}/webhook/${path}`;

// Endpoints
const N8N_WEBHOOK_URL = WEBHOOK("flight-search");

const BOOKING_WEBHOOKS = {
    flightSelect: WEBHOOK("flight-select"),
    passengerData: WEBHOOK("passenger-data"),
    bookingConfirm: WEBHOOK("booking-confirm")
};

// === État global de la réservation ===
let bookingState = {
    selectedFlight: null,
    passengers: [],
    contact: {},
    currentStep: 'search',
    sessionId: 'web-' + Date.now()
};

// === Éléments DOM ===
const chatContainer = document.getElementById('chatContainer');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const typingIndicator = document.getElementById('typingIndicator');

// Auto-resize textarea
messageInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
});

// Envoyer avec Entrée
messageInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

messageInput.focus();

// === Affichage messages dans le chat ===
function addMessage(content, isUser = false, isFlightResult = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user' : 'bot'}`;
    
    const avatar = document.createElement('div');
    avatar.className = `avatar ${isUser ? 'user' : 'bot'}`;
    avatar.textContent = isUser ? '👤' : '🤖';
    
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    
    if (isFlightResult) {
        bubble.innerHTML = content;
        bubble.classList.add('success-animation');
    } else {
        bubble.innerHTML = content.replace(/\n/g, '<br>');
    }
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(bubble);
    
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Afficher/masquer l'indicateur de frappe
function showTyping(show = true) {
    typingIndicator.style.display = show ? 'flex' : 'none';
    if (show) chatContainer.scrollTop = chatContainer.scrollHeight;
}

// === Recherche de vol ===
async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;

    addMessage(message, true);
    messageInput.value = '';
    messageInput.style.height = 'auto';
    showTyping(true);

    try {
        const result = await callFlightAPI(message);
        showTyping(false);

        if (result) {
            const html = formatFlightResult(result);
            addMessage(html, false, true);
        }
    } catch (error) {
        showTyping(false);
        addMessage(`❌ Erreur: ${error.message}`, false);
    }
}

// === Affichage des résultats ===
function displayFlightResults(response) {
    if (!response.success || !response.bestFlights || response.bestFlights.length === 0) {
        addMessage("❌ Aucun vol trouvé ou erreur de recherche.", false);
        return;
    }

    let flightsHtml = `
        <div style="background: linear-gradient(135deg, #f8fafc, #e2e8f0); border-radius: 16px; padding: 20px; margin-top: 15px;">
            <h3 style="color: #1e293b; margin-bottom: 15px;">✈️ Vols disponibles</h3>
    `;

    response.bestFlights.forEach((flight, index) => {
        // Bloc retour si dispo
        let retourHtml = '';
        if (flight.inbound) {
            retourHtml = `
                <div style="font-size: 13px; color: #64748b; margin-top: 6px;">
                    🕐 RETOUR: ${flight.inbound.departure || 'N/A'} → ${flight.inbound.arrival || 'N/A'} | ⏱️ ${flight.inbound.duration || 'N/A'}
                </div>
            `;
        }

        flightsHtml += `
            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin-bottom: 12px; cursor: pointer;" 
                 onclick="selectFlight(${index}, ${JSON.stringify(flight.originalAmadeusData || flight).replace(/"/g, '&quot;')})">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div style="flex: 1;">
                        <div style="font-size: 13px; color: #64748b; margin-bottom: 8px;">
                            🕐 ALLER: ${flight.outbound?.departure || flight.schedule?.departure || 'N/A'} → ${flight.outbound?.arrival || flight.schedule?.arrival || 'N/A'} | ⏱️ ${flight.outbound?.duration || flight.schedule?.duration || 'N/A'}
                            ${retourHtml}
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: bold; color: #1e293b; margin-bottom: 4px;">
                            Prix ${flight.price?.amount || 'N/A'} ${flight.price?.currency || 'EUR'}
                        </div>
                        <button style="background: #10b981; color: white; border: none; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: bold; cursor: pointer;">
                            🎫 Réserver
                        </button>
                    </div>
                </div>
            </div>
        `;
    });

    flightsHtml += '</div>';
    addMessage(flightsHtml, false, true);
}

// === Formatage des résultats pour affichage initial ===
function formatFlightResult(result) {
    if (!result.success) {
        return `<div class="error-message"><strong>❌ ${result.message || 'Erreur lors de l\'analyse'}</strong></div>`;
    }

    if (result.bestFlights && result.bestFlights.length > 0) {
        setTimeout(() => displayFlightResults(result), 100);
    }

    return `
        <div class="flight-result">
            <div class="flight-header">
                ✈️ Recherche de vol analysée par l'IA
            </div>
            <div class="flight-route">
                ${result.searchParams?.originCity} → ${result.searchParams?.destinationCity}
            </div>
        </div>
    `;
}

// === API call vers n8n ===
async function callFlightAPI(message) {
    try {
        const response = await fetch(N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message,
                sessionId: bookingState.sessionId,
                timestamp: new Date().toISOString(),
                source: 'web'
            })
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        return await response.json();

    } catch (error) {
        console.error('❌ Erreur API n8n:', error);
        return { success: false, message: "Erreur API" };
    }
}

// === Sélection d'un vol ===
async function selectFlight(flightIndex, flightData) {
    addMessage('🎫 Vol sélectionné ! Vérification du prix en temps réel...', false);
    showTyping(true);

    try {
        const response = await fetch(BOOKING_WEBHOOKS.flightSelect, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                flightIndex,
                selectedFlight: flightData,
                passengers: 1,
                sessionId: bookingState.sessionId,
                timestamp: new Date().toISOString()
            })
        });

        showTyping(false);

        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        const result = await response.json();

        if (result && result.success) {
            addMessage('✅ Vol confirmé. Étape suivante : informations passagers.', false);
            bookingState.currentStep = 'passengers';
        } else {
            addMessage(`❌ ${result?.error || 'Erreur lors de la sélection du vol'}`, false);
        }
    } catch (error) {
        showTyping(false);
        console.error('❌ Erreur sélection vol:', error);
        addMessage(`❌ Erreur de connexion: ${error.message}`, false);
    }
}
