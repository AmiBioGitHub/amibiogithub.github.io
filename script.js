// ===== VERSION INFO =====
// Version: 2.1.0
// Last Updated: 2024-12-19 14:30:00
// Features: Version tracking, Debug console, Enhanced booking flow

const APP_VERSION = {
    js: '2.1.0',
    buildDate: '2024-12-19',
    buildTime: '14:30:00',
    features: ['Version tracking', 'Debug console', 'Passenger booking', 'API integration']
};

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
    selectedFlightData: null,
    passengers: [],
    contact: {},
    currentStep: 'search',
    sessionId: 'web-' + Date.now(),
    pricing: null
};

// === Éléments DOM ===
const chatContainer = document.getElementById('chatContainer');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const typingIndicator = document.getElementById('typingIndicator');

// === Initialisation avec versioning ===
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    messageInput.focus();
    
    debugLog(`🚀 Application v${APP_VERSION.js} initialized`, 'success');
    debugLog(`📡 API Endpoint: ${N8N_SUBDOMAIN}`, 'info');
    debugLog(`🆔 Session ID: ${bookingState.sessionId}`, 'info');
});

function initializeApp() {
    // Mettre à jour les informations de version
    updateVersionInfo();
    
    // Test de connectivité initial - DÉSACTIVÉ pour éviter les appels automatiques
    // setTimeout(() => {
    //     testAPIConnection();
    // }, 1000);
    
    // Afficher un statut neutre au lieu de tester automatiquement
    const statusElement = document.getElementById('apiStatus');
    if (statusElement) {
        statusElement.textContent = '⚪ Prêt pour test';
    }
    
    // Afficher la version dans la console
    console.log(`%c✈️ AI Flight Search Bot v${APP_VERSION.js}`, 'color: #2196F3; font-size: 16px; font-weight: bold;');
    console.log(`%cBuild: ${APP_VERSION.buildDate} ${APP_VERSION.buildTime}`, 'color: #6b7280;');
    console.log(`%cFeatures: ${APP_VERSION.features.join(', ')}`, 'color: #10b981;');
}

function updateVersionInfo() {
    // Mettre à jour la version JS
    const jsVersionElement = document.getElementById('jsVersion');
    if (jsVersionElement) {
        jsVersionElement.textContent = `v${APP_VERSION.js}`;
    }
    
    // Mettre à jour les infos de session
    const sessionElement = document.getElementById('sessionInfo');
    if (sessionElement) {
        sessionElement.textContent = bookingState.sessionId;
    }
}

// === Test de connectivité API ===
async function testAPIConnection() {
    const statusElement = document.getElementById('apiStatus');
    if (!statusElement) return;
    
    statusElement.textContent = '🔄 Test en cours...';
    debugLog('🔍 Testing API connection...', 'info');
    
    try {
        const testPayload = {
            message: 'API connection test',
            sessionId: 'test-' + Date.now(),
            timestamp: new Date().toISOString(),
            source: 'web-test'
        };
        
        const response = await fetch(N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testPayload),
            signal: AbortSignal.timeout(5000) // 5 secondes timeout
        });
        
        if (response.ok) {
            statusElement.textContent = '✅ API Connectée';
            debugLog('✅ API connection successful', 'success');
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
        
    } catch (error) {
        statusElement.textContent = '❌ API Déconnectée';
        debugLog(`❌ API connection failed: ${error.message}`, 'error');
    }
}

function setupEventListeners() {
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

    // Raccourcis clavier
    document.addEventListener('keydown', function(e) {
        // Ctrl/Cmd + ` pour toggle debug console
        if (e.key === '`' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            toggleDebugConsole();
        }
        
        // Ctrl/Cmd + I pour toggle version info
        if (e.key === 'i' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            toggleVersionInfo();
        }
    });
}

// === Gestion des exemples ===
function fillExample(text) {
    messageInput.value = text;
    messageInput.focus();
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
    
    debugLog(`📝 Example filled: "${text.substring(0, 30)}..."`, 'info');
}

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
    
    // Log du message
    const messageType = isUser ? 'user' : 'bot';
    const messagePreview = content.replace(/<[^>]*>/g, '').substring(0, 50);
    debugLog(`💬 ${messageType}: ${messagePreview}...`, 'info');
}

// Afficher/masquer l'indicateur de frappe
function showTyping(show = true) {
    typingIndicator.style.display = show ? 'flex' : 'none';
    if (show) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
        debugLog('⌨️ Typing indicator shown', 'info');
    } else {
        debugLog('⌨️ Typing indicator hidden', 'info');
    }
}

// === Recherche de vol ===
async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;

    debugLog(`🔍 Sending search query: "${message}"`, 'info');
    
    addMessage(message, true);
    messageInput.value = '';
    messageInput.style.height = 'auto';
    showTyping(true);

    try {
        const startTime = performance.now();
        const result = await callFlightAPI(message);
        const endTime = performance.now();
        const responseTime = Math.round(endTime - startTime);
        
        showTyping(false);
        debugLog(`⚡ API response time: ${responseTime}ms`, 'info');

        if (result) {
            const html = formatFlightResult(result);
            addMessage(html, false, true);
            
            if (result.success && result.bestFlights) {
                debugLog(`✈️ Found ${result.bestFlights.length} flights`, 'success');
            }
        }
    } catch (error) {
        showTyping(false);
        debugLog(`❌ Search error: ${error.message}`, 'error');
        addMessage(`❌ Erreur: ${error.message}`, false);
    }
}

// === Affichage des résultats ===
function displayFlightResults(response) {
    if (!response.success || !response.bestFlights || response.bestFlights.length === 0) {
        debugLog('⚠️ No flights found in response', 'warning');
        addMessage("❌ Aucun vol trouvé ou erreur de recherche.", false);
        return;
    }

    debugLog(`✈️ Displaying ${response.bestFlights.length} flight results`, 'success');

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
            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin-bottom: 12px; cursor: pointer; transition: all 0.3s ease;" 
                 onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(0,0,0,0.1)'"
                 onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 10px rgba(0,0,0,0.05)'"
                 onclick="selectFlight(${index}, ${JSON.stringify(flight.originalAmadeusData || flight).replace(/"/g, '&quot;')})">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: #1e293b; margin-bottom: 8px;">
                            ${flight.airline?.name || 'Compagnie'} (${flight.airline?.code || ''})
                        </div>
                        <div style="font-size: 13px; color: #64748b; margin-bottom: 8px;">
                            🕐 ALLER: ${flight.outbound?.departure || flight.schedule?.departure || 'N/A'} → ${flight.outbound?.arrival || flight.schedule?.arrival || 'N/A'} | ⏱️ ${flight.outbound?.duration || flight.schedule?.duration || 'N/A'}
                            ${retourHtml}
                        </div>
                        <div style="font-size: 12px; color: #6b7280;">
                            ${flight.route?.stopsText || (flight.route?.stops === 0 ? 'Direct' : flight.route?.stops + ' escale(s)' || '')}
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: bold; color: #1e293b; margin-bottom: 8px; font-size: 18px;">
                            ${flight.price?.amount || 'N/A'} ${flight.price?.currency || 'EUR'}
                        </div>
                        <div style="font-size: 12px; color: #10b981; margin-bottom: 8px;">
                            ${flight.category || 'Standard'} • Score: ${flight.score || 'N/A'}/100
                        </div>
                        <button style="background: #10b981; color: white; border: none; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: bold; cursor: pointer; transition: all 0.3s ease;">
                            🎫 Sélectionner
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
        debugLog(`❌ Flight search failed: ${result.message}`, 'error');
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
        debugLog(`📡 Calling flight API...`, 'info');
        
        const payload = {
            message,
            sessionId: bookingState.sessionId,
            timestamp: new Date().toISOString(),
            source: 'web',
            version: APP_VERSION.js
        };
        
        const response = await fetch(N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        debugLog(`✅ API response received`, 'success');
        return result;

    } catch (error) {
        debugLog(`❌ API call failed: ${error.message}`, 'error');
        console.error('❌ Erreur API n8n:', error);
        return { success: false, message: "Erreur API" };
    }
}

// === Sélection d'un vol ===
async function selectFlight(flightIndex, flightData) {
    debugLog(`🎫 Selecting flight ${flightIndex}`, 'info');
    
    addMessage('🎫 Vol sélectionné ! Vérification du prix en temps réel...', false);
    showTyping(true);

    try {
        const payload = {
            flightId: `flight_${flightIndex}_${Date.now()}`,
            flightIndex,
            selectedFlight: flightData,
            passengers: 1,
            travelClass: 'ECONOMY',
            sessionId: bookingState.sessionId,
            timestamp: new Date().toISOString(),
            version: APP_VERSION.js
        };
        
        debugLog(`📡 Sending flight selection...`, 'info');
        
        const response = await fetch(BOOKING_WEBHOOKS.flightSelect, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        showTyping(false);

        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        const result = await response.json();

        if (result && result.success) {
            // Sauvegarder les données de vol et pricing
            bookingState.selectedFlight = flightData;
            bookingState.selectedFlightData = result.flightSelection;
            bookingState.pricing = result.pricing;
            bookingState.currentStep = 'passengers';
            
            debugLog(`✅ Flight selected successfully, price: ${result.pricing?.totalPrice}`, 'success');
            addMessage('✅ Vol confirmé ! Veuillez maintenant saisir les informations des passagers.', false);
            
            // Afficher le formulaire passager
            setTimeout(() => showPassengerForm(), 500);
        } else {
            debugLog(`❌ Flight selection failed: ${result?.error}`, 'error');
            addMessage(`❌ ${result?.error || 'Erreur lors de la sélection du vol'}`, false);
        }
    } catch (error) {
        showTyping(false);
        debugLog(`❌ Flight selection error: ${error.message}`, 'error');
        console.error('❌ Erreur sélection vol:', error);
        addMessage(`❌ Erreur de connexion: ${error.message}`, false);
    }
}

// === Affichage du formulaire passager ===
function showPassengerForm() {
    debugLog('👤 Showing passenger form', 'info');
    
    const flightInfo = bookingState.selectedFlightData?.selectedFlight || {};
    const pricing = bookingState.pricing || {};
    
    const formHtml = `
        <div class="passenger-form">
            <div class="booking-summary">
                <h4>📋 Résumé de votre réservation</h4>
                <div class="summary-item">
                    <span>Vol sélectionné:</span>
                    <strong>${flightInfo.airline?.name || 'Compagnie'}</strong>
                </div>
                <div class="summary-item">
                    <span>Prix estimé:</span>
                    <strong>${pricing.totalPrice || pricing.basePrice || 'N/A'} ${pricing.currency || 'EUR'}</strong>
                </div>
                <div class="summary-item">
                    <span>Passagers:</span>
                    <strong>${bookingState.selectedFlightData?.passengers || 1} adulte(s)</strong>
                </div>
            </div>

            <form id="passengerForm">
                <div class="form-section">
                    <h4>👤 Informations du passager</h4>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Prénom <span class="required">*</span></label>
                            <input type="text" class="form-input" name="firstName" required 
                                   placeholder="Prénom tel qu'indiqué sur le passeport">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Nom <span class="required">*</span></label>
                            <input type="text" class="form-input" name="lastName" required 
                                   placeholder="Nom tel qu'indiqué sur le passeport">
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Date de naissance <span class="required">*</span></label>
                            <input type="date" class="form-input" name="dateOfBirth" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Genre <span class="required">*</span></label>
                            <select class="form-select" name="gender" required>
                                <option value="">Sélectionner</option>
                                <option value="MALE">Masculin</option>
                                <option value="FEMALE">Féminin</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div class="form-section document-section">
                    <h4>📄 Document de voyage</h4>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Numéro de passeport <span class="required">*</span></label>
                            <input type="text" class="form-input" name="passportNumber" required 
                                   placeholder="Numéro de passeport">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Date d'expiration <span class="required">*</span></label>
                            <input type="date" class="form-input" name="passportExpiry" required>
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Nationalité <span class="required">*</span></label>
                            <select class="form-select" name="nationality" required>
                                <option value="">Sélectionner</option>
                                <option value="BE">Belgique</option>
                                <option value="FR">France</option>
                                <option value="DE">Allemagne</option>
                                <option value="NL">Pays-Bas</option>
                                <option value="GB">Royaume-Uni</option>
                                <option value="ES">Espagne</option>
                                <option value="IT">Italie</option>
                                <option value="US">États-Unis</option>
                                <option value="CA">Canada</option>
                                <option value="AU">Australie</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div class="form-section contact-section">
                    <h4>📧 Informations de contact</h4>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Email <span class="required">*</span></label>
                            <input type="email" class="form-input" name="email" required 
                                   placeholder="votre.email@exemple.com">
                            <div class="form-help-text">Votre confirmation de vol sera envoyée à cette adresse</div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Téléphone <span class="required">*</span></label>
                            <input type="tel" class="form-input" name="phone" required 
                                   placeholder="+32 123 456 789">
                        </div>
                    </div>
                </div>

                <div class="button-group">
                    <button type="button" class="form-button secondary" onclick="cancelBooking()">
                        Annuler
                    </button>
                    <button type="submit" class="form-button" id="submitPassengerBtn">
                        Continuer la réservation
                    </button>
                </div>
            </form>
        </div>
    `;

    addMessage(formHtml, false, true);
    
    // Attacher les event listeners au formulaire
    setTimeout(() => {
        const form = document.getElementById('passengerForm');
        if (form) {
            form.addEventListener('submit', handlePassengerFormSubmit);
            setupFormValidation();
            debugLog('📝 Passenger form initialized', 'success');
        }
    }, 100);
}

// === Validation du formulaire ===
function setupFormValidation() {
    const form = document.getElementById('passengerForm');
    if (!form) return;

    const inputs = form.querySelectorAll('.form-input, .form-select');
    
    inputs.forEach(input => {
        input.addEventListener('blur', validateField);
        input.addEventListener('input', clearFieldError);
    });
}

function validateField(event) {
    const field = event.target;
    const value = field.value.trim();
    const name = field.name;
    
    clearFieldError(event);
    
    // Validation spécifique par champ
    switch (name) {
        case 'firstName':
        case 'lastName':
            if (value.length < 2) {
                showFieldError(field, 'Minimum 2 caractères requis');
                return false;
            }
            break;
            
        case 'dateOfBirth':
            if (!value) {
                showFieldError(field, 'Date de naissance requise');
                return false;
            }
            const age = calculateAge(value);
            if (age < 0 || age > 120) {
                showFieldError(field, 'Date de naissance invalide');
                return false;
            }
            break;
            
        case 'passportNumber':
            if (value.length < 6) {
                showFieldError(field, 'Numéro de passeport invalide');
                return false;
            }
            break;
            
        case 'passportExpiry':
            if (!value) {
                showFieldError(field, 'Date d\'expiration requise');
                return false;
            }
            const expiryDate = new Date(value);
            const today = new Date();
            if (expiryDate <= today) {
                showFieldError(field, 'Passeport expiré');
                return false;
            }
            break;
            
        case 'email':
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
                showFieldError(field, 'Email invalide');
                return false;
            }
            break;
            
        case 'phone':
            if (value.length < 10) {
                showFieldError(field, 'Numéro de téléphone invalide');
                return false;
            }
            break;
    }
    
    return true;
}

function showFieldError(field, message) {
    field.classList.add('error');
    
    let errorDiv = field.parentNode.querySelector('.form-error');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.className = 'form-error';
        field.parentNode.appendChild(errorDiv);
    }
    errorDiv.textContent = message;
    
    debugLog(`⚠️ Form validation error: ${field.name} - ${message}`, 'warning');
}

function clearFieldError(event) {
    const field = event.target;
    field.classList.remove('error');
    
    const errorDiv = field.parentNode.querySelector('.form-error');
    if (errorDiv) {
        errorDiv.remove();
    }
}

function calculateAge(dateOfBirth) {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    
    return age;
}

// === Soumission du formulaire passager ===
async function handlePassengerFormSubmit(event) {
    event.preventDefault();
    
    debugLog('📝 Submitting passenger form', 'info');
    
    const form = event.target;
    const formData = new FormData(form);
    const submitBtn = document.getElementById('submitPassengerBtn');
    
    // Validation complète
    let isValid = true;
    const inputs = form.querySelectorAll('.form-input, .form-select');
    
    inputs.forEach(input => {
        if (!validateField({ target: input })) {
            isValid = false;
        }
    });
    
    if (!isValid) {
        addMessage('❌ Veuillez corriger les erreurs dans le formulaire.', false);
        debugLog('❌ Form validation failed', 'error');
        return;
    }
    
    // Préparer les données
    const passengerData = {
        firstName: formData.get('firstName'),
        lastName: formData.get('lastName'),
        dateOfBirth: formData.get('dateOfBirth'),
        gender: formData.get('gender'),
        document: {
            number: formData.get('passportNumber'),
            expiryDate: formData.get('passportExpiry'),
            nationality: formData.get('nationality')
        }
    };
    
    const contactData = {
        email: formData.get('email'),
        phone: formData.get('phone')
    };
    
    debugLog(`📋 Passenger data prepared: ${passengerData.firstName} ${passengerData.lastName}`, 'info');
    
    // Désactiver le bouton et afficher loading
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="loading-spinner"></div>Traitement...';
    
    try {
        const payload = {
            sessionId: bookingState.sessionId,
            flightId: bookingState.selectedFlightData?.flightId,
            passengers: [passengerData],
            contact: contactData,
            expectedPassengers: 1,
            timestamp: new Date().toISOString(),
            version: APP_VERSION.js
        };
        
        debugLog('📡 Sending passenger data to API...', 'info');
        
        const response = await fetch(BOOKING_WEBHOOKS.passengerData, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        const result = await response.json();
        
        if (result && result.success) {
            bookingState.passengers = result.validatedPassengers;
            bookingState.contact = result.contactInfo;
            bookingState.currentStep = 'confirmation';
            
            debugLog('✅ Passenger data validated successfully', 'success');
            addMessage('✅ Informations passager validées ! Procédons à la confirmation finale.', false);
            
            // Afficher l'étape de confirmation
            setTimeout(() => showBookingConfirmation(), 500);
        } else {
            throw new Error(result?.message || 'Validation des données échouée');
        }
        
    } catch (error) {
        debugLog(`❌ Passenger validation error: ${error.message}`, 'error');
        console.error('❌ Erreur validation passager:', error);
        addMessage(`❌ Erreur: ${error.message}`, false);
    } finally {
        // Réactiver le bouton
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Continuer la réservation';
    }
}

// === Confirmation de réservation ===
function showBookingConfirmation() {
    debugLog('🎉 Showing booking confirmation', 'info');
    
    const passenger = bookingState.passengers[0];
    const pricing = bookingState.pricing;
    const flightInfo = bookingState.selectedFlightData?.selectedFlight;
    
    const confirmationHtml = `
        <div class="passenger-form">
            <div class="booking-summary">
                <h4>🎉 Confirmation de réservation</h4>
                <div class="summary-item">
                    <span>Passager:</span>
                    <strong>${passenger.name.firstName} ${passenger.name.lastName}</strong>
                </div>
                <div class="summary-item">
                    <span>Email:</span>
                    <strong>${bookingState.contact.email}</strong>
                </div>
                <div class="summary-item">
                    <span>Prix total:</span>
                    <strong>${pricing.totalPrice} ${pricing.currency}</strong>
                </div>
            </div>
            
            <div style="text-align: center; margin: 20px 0;">
                <p style="margin-bottom: 15px;">En cliquant sur "Confirmer la réservation", vous acceptez nos conditions générales.</p>
                <p style="font-size: 14px; color: #6b7280;">Cette réservation est une simulation. Aucun paiement ne sera effectué.</p>
            </div>
            
            <div class="button-group">
                <button type="button" class="form-button secondary" onclick="cancelBooking()">
                    Annuler
                </button>
                <button type="button" class="form-button" onclick="confirmBooking()">
                    Confirmer la réservation
                </button>
            </div>
        </div>
    `;
    
    addMessage(confirmationHtml, false, true);
}

// === Confirmation finale ===
async function confirmBooking() {
    debugLog('🎫 Starting final booking confirmation', 'info');
    
    addMessage('🎫 Finalisation de votre réservation...', false);
    showTyping(true);
    
    try {
        const payload = {
            sessionId: bookingState.sessionId,
            flightId: bookingState.selectedFlightData?.flightId,
            selectedFlight: bookingState.selectedFlight,
            passengers: bookingState.passengers,
            contact: bookingState.contact,
            payment: {
                method: 'simulation',
                amount: bookingState.pricing?.totalPrice,
                currency: bookingState.pricing?.currency
            },
            timestamp: new Date().toISOString(),
            version: APP_VERSION.js
        };
        
        debugLog('📡 Sending booking confirmation...', 'info');
        
        const response = await fetch(BOOKING_WEBHOOKS.bookingConfirm, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        showTyping(false);
        
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        const result = await response.json();
        
        if (result && result.success) {
            debugLog(`🎉 Booking confirmed! Reference: ${result.booking.reference}`, 'success');
            
            addMessage(`🎉 Réservation confirmée !\n\nNuméro de confirmation: ${result.confirmationNumber}\nRéférence: ${result.booking.reference}\n\n📧 Un email de confirmation a été envoyé à ${bookingState.contact.email}`, false);
            
            // Reset pour nouvelle recherche
            setTimeout(() => {
                debugLog('🔄 Resetting booking state for new search', 'info');
                
                bookingState = {
                    selectedFlight: null,
                    selectedFlightData: null,
                    passengers: [],
                    contact: {},
                    currentStep: 'search',
                    sessionId: 'web-' + Date.now(),
                    pricing: null
                };
                
                updateVersionInfo(); // Mettre à jour la nouvelle session
                addMessage('✈️ Vous pouvez maintenant effectuer une nouvelle recherche !', false);
            }, 3000);
        } else {
            throw new Error(result?.message || 'Erreur lors de la confirmation');
        }
        
    } catch (error) {
        showTyping(false);
        debugLog(`❌ Booking confirmation error: ${error.message}`, 'error');
        console.error('❌ Erreur confirmation:', error);
        addMessage(`❌ Erreur: ${error.message}`, false);
    }
}

// === Annulation ===
function cancelBooking() {
    debugLog('❌ Booking cancelled by user', 'warning');
    
    bookingState = {
        selectedFlight: null,
        selectedFlightData: null,
        passengers: [],
        contact: {},
        currentStep: 'search',
        sessionId: 'web-' + Date.now(),
        pricing: null
    };
    
    updateVersionInfo(); // Mettre à jour la nouvelle session
    addMessage('❌ Réservation annulée. Vous pouvez effectuer une nouvelle recherche.', false);
}

// === Fonctions de gestion du versioning et debug ===

function toggleVersionInfo() {
    const panel = document.getElementById('versionPanel');
    if (panel) {
        panel.classList.toggle('visible');
        
        if (panel.classList.contains('visible')) {
            debugLog('📊 Version panel opened', 'info');
            // Mettre à jour les informations en temps réel
            updateVersionInfo();
        } else {
            debugLog('📊 Version panel closed', 'info');
        }
    }
}

function toggleDebugConsole() {
    const console = document.getElementById('debugConsole');
    const content = document.getElementById('debugContent');
    const toggle = document.querySelector('.debug-toggle');
    
    if (console && toggle) {
        console.classList.toggle('expanded');
        if (console.classList.contains('expanded')) {
            toggle.textContent = '▲';
            debugLog('🐛 Debug console expanded', 'info');
        } else {
            toggle.textContent = '▼';
            debugLog('🐛 Debug console collapsed', 'info');
        }
    }
}

function reloadPage() {
    debugLog('🔄 Page reload requested', 'info');
    window.location.reload();
}

// === Fonctions utilitaires de debug ===

// Fonction de log de debug déjà définie dans le HTML, mais on peut l'étendre ici
window.originalDebugLog = window.debugLog;
window.debugLog = function(message, type = 'info') {
    // Appeler la fonction originale
    if (window.originalDebugLog) {
        window.originalDebugLog(message, type);
    }
    
    // Également logger dans la console du navigateur
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    
    switch (type) {
        case 'error':
            console.error(logMessage);
            break;
        case 'warning':
            console.warn(logMessage);
            break;
        case 'success':
            console.log(`%c${logMessage}`, 'color: #10b981');
            break;
        default:
            console.log(logMessage);
    }
};

// === Performance monitoring ===

// Mesurer les performances de l'application
window.performance.mark('app-start');

function trackPerformance(eventName, data = {}) {
    const now = performance.now();
    debugLog(`⚡ Performance: ${eventName} - ${now.toFixed(2)}ms`, 'info');
    
    // Vous pouvez également envoyer ces métriques à un service d'analytics
    if (window.gtag) {
        window.gtag('event', eventName, {
            custom_parameter_1: data,
            value: Math.round(now)
        });
    }
}

// === Gestion des erreurs globales ===

window.addEventListener('error', function(event) {
    debugLog(`💥 Global error: ${event.error?.message || event.message}`, 'error');
    console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', function(event) {
    debugLog(`💥 Unhandled promise rejection: ${event.reason}`, 'error');
    console.error('Unhandled promise rejection:', event.reason);
});

// === Nettoyage et optimisations ===

// Nettoyer les logs de debug après un certain temps
setInterval(() => {
    const debugLog = document.getElementById('debugLog');
    if (debugLog && debugLog.children.length > 100) {
        // Garder seulement les 50 derniers logs
        while (debugLog.children.length > 50) {
            debugLog.removeChild(debugLog.firstChild);
        }
        window.debugLog('🧹 Debug log cleaned (keeping last 50 entries)', 'info');
    }
}, 30000); // Toutes les 30 secondes

// === Export pour tests et debugging ===

// Exposer certaines fonctions pour les tests
window.FlightBot = {
    version: APP_VERSION,
    bookingState,
    testAPI: testAPIConnection,
    resetState: cancelBooking,
    debugLog: window.debugLog,
    trackPerformance
};

// Log final d'initialisation
window.debugLog(`🎯 FlightBot v${APP_VERSION.js} fully loaded and ready!`, 'success');
trackPerformance('app-loaded');
