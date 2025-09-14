// Configuration Webhooks - URLs DE PRODUCTION n8n
const N8N_WEBHOOK_URL = 'https://1a8b7c488aa126c181004b8df481658d.serveo.net/webhook/flight-search';

const BOOKING_WEBHOOKS = {
    flightSelect: 'https://1a8b7c488aa126c181004b8df481658d.serveo.net/webhook/flight-select',
    passengerData: 'https://1a8b7c488aa126c181004b8df481658d.serveo.net/webhook/passenger-data', 
    bookingConfirm: 'https://1a8b7c488aa126c181004b8df481658d.serveo.net/webhook/booking-confirm'
};

// État de l'application
let isProcessing = false;
let sessionId = 'web-' + Date.now();

// État global de la réservation
let bookingState = {
    selectedFlight: null,
    passengers: [],
    contact: {},
    currentStep: 'search',
    sessionId: sessionId
};

// Éléments DOM
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

// Focus automatique
messageInput.focus();

// Fonction pour remplir un exemple
function fillExample(text) {
    messageInput.value = text;
    messageInput.focus();
    messageInput.style.height = 'auto';
    messageInput.style.height = messageInput.scrollHeight + 'px';
}

// Ajouter un message au chat
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
    if (show) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
}

// Afficher notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 100);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Dictionnaire des compagnies aériennes
const airlineNames = {
    'AF': 'Air France', 'LH': 'Lufthansa', 'BA': 'British Airways', 'IB': 'Iberia',
    'KL': 'KLM', 'AZ': 'ITA Airways', 'SN': 'Brussels Airlines', 'LX': 'Swiss',
    'OS': 'Austrian Airlines', 'SK': 'SAS', 'AY': 'Finnair', 'TP': 'TAP Portugal',
    'EI': 'Aer Lingus', 'FR': 'Ryanair', 'U2': 'easyJet', 'VY': 'Vueling',
    'W6': 'Wizz Air', 'EW': 'Eurowings', 'HV': 'Transavia', 'QR': 'Qatar Airways'
};

function getAirlineName(code) {
    return airlineNames[code] || `${code} Airlines`;
}

function getClassEmoji(travelClass) {
    switch(travelClass) {
        case 'FIRST': return '👑';
        case 'BUSINESS': return '💼';
        case 'PREMIUM_ECONOMY': return '⭐';
        default: return '🎫';
    }
}

function formatTravelClass(travelClass) {
    switch(travelClass) {
        case 'FIRST': return 'Première';
        case 'BUSINESS': return 'Affaires';
        case 'PREMIUM_ECONOMY': return 'Premium Eco';
        default: return 'Économique';
    }
}

// Fonction d’envoi message
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

// Afficher les résultats de recherche
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
        flightsHtml += `
            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin-bottom: 12px; cursor: pointer; transition: all 0.2s;" 
                 onclick="selectFlight(${index}, ${JSON.stringify(flight.originalAmadeusData || flight).replace(/"/g, '&quot;')})">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div style="flex: 1;">
                        <div style="font-size: 13px; color: #64748b; margin-bottom: 8px;">
                            🕐 ALLER: ${flight.schedule?.departure || 'N/A'} → ${flight.schedule?.arrival || 'N/A'} | ⏱️ ${flight.schedule?.duration || 'N/A'}
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

// Formater résultats
function formatFlightResult(result) {
    if (!result.success) {
        const suggestions = result.suggestions ? result.suggestions.map(s => `• ${s}`).join('<br>') : '';
        return `
            <div class="error-message">
                <strong>❌ ${result.message || 'Erreur lors de l\'analyse'}</strong>
                ${suggestions ? '<br><br><strong>Suggestions:</strong><br>' + suggestions : ''}
            </div>
        `;
    }

    const confidence = result.searchParams?.aiConfidence || result.confidence || 0;
    const confidenceColor = confidence >= 80 ? '#22c55e' : confidence >= 60 ? '#f59e0b' : '#ef4444';
    const params = result.searchParams || result;

    let flightResultsHtml = '';
    
    if (result.bestFlights && result.bestFlights.length > 0) {
        setTimeout(() => displayFlightResults(result), 100);
        flightResultsHtml = '';
    }

    return `
        <div class="flight-result">
            <div class="flight-header">
                ✈️ Recherche de vol analysée par l'IA
                <div class="confidence-badge" style="background: ${confidenceColor}">
                    🎯 ${confidence}% confiance
                </div>
            </div>
            
            <div class="flight-route">
                ${params.originCity || params.originLocationCode} → ${params.destinationCity || params.destinationLocationCode}
            </div>
            
            <div class="flight-details">
                <div class="detail-item">
                    <div class="detail-label">Départ</div>
                    <div class="detail-value">${params.departureDate || 'À définir'}</div>
                </div>
                ${params.returnDate ? `
                    <div class="detail-item">
                        <div class="detail-label">Retour</div>
                        <div class="detail-value">${params.returnDate}</div>
                    </div>
                ` : ''}
                <div class="detail-item">
                    <div class="detail-label">Classe</div>
                    <div class="detail-value">${getClassEmoji(params.travelClass)} ${formatTravelClass(params.travelClass)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Passagers</div>
                    <div class="detail-value">👥 ${params.adults || 1}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Type</div>
                    <div class="detail-value">${params.tripType === 'round-trip' ? '🔄 Aller-retour' : '➡️ Aller simple'}</div>
                </div>
            </div>
            
            <div style="margin-top: 15px; padding: 12px; background: rgba(34, 197, 94, 0.1); border-radius: 8px; border-left: 4px solid #22c55e;">
                <strong>🤖 Analyse IA:</strong> ${params.naturalRequest || 'Recherche analysée avec succès'}
                ${params.aiModel ? `<br><small>Modèle: ${params.aiModel}</small>` : ''}
            </div>
            
            ${flightResultsHtml}
        </div>
    `;
}

// Appel API vers n8n
async function callFlightAPI(message) {
    try {
        const response = await fetch(N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: message,
                sessionId: sessionId,
                timestamp: new Date().toISOString(),
                source: 'web'
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('❌ Erreur API n8n:', error);
        return simulateFlightSearch(message);
    }
}

// Simulation démo
function simulateFlightSearch(message) {
    return {
        success: true,
        searchParams: {
            originCity: 'Brussels',
            destinationCity: 'Bangkok',
            originLocationCode: 'BRU',
            destinationLocationCode: 'BKK',
            departureDate: '2025-03-15',
            returnDate: '2025-03-25',
            travelClass: 'ECONOMY',
            nonStop: true,
            adults: 1,
            tripType: 'round-trip',
            naturalRequest: 'Vol Brussels vers Bangkok',
            aiConfidence: 85,
            aiModel: 'demo-mode'
        },
        bestFlights: [
            { schedule: { departure: '08:30', arrival: '01:15+1', duration: '15h45m' }, price: { amount: 750, currency: 'EUR' } },
            { schedule: { departure: '14:20', arrival: '09:45+1', duration: '17h25m' }, price: { amount: 680, currency: 'EUR' } }
        ]
    };
}

// Fonction de sélection de vol
async function selectFlight(flightIndex, flightData) {
    console.log('🎫 Sélection du vol:', flightIndex, flightData);
    bookingState.selectedFlight = { index: flightIndex, data: flightData, timestamp: new Date().toISOString() };

    addMessage('🎫 Vol sélectionné ! Vérification du prix en temps réel...', false);
    showTyping(true);

    try {
        const response = await fetch(BOOKING_WEBHOOKS.flightSelect, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                flightIndex: flightIndex,
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
            showNotification('❌ Erreur de sélection', 'error');
        }
    } catch (error) {
        showTyping(false);
        console.error('❌ Erreur sélection vol:', error);
        addMessage(`❌ Erreur de connexion: ${error.message}`, false);
        showNotification('❌ Erreur de sélection', 'error');
    }
}
