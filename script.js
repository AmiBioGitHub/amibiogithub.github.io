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

// === Initialisation ===
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    messageInput.focus();
});

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
}

// === Gestion des exemples ===
function fillExample(text) {
    messageInput.value = text;
    messageInput.focus();
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
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
                flightId: `flight_${flightIndex}_${Date.now()}`,
                flightIndex,
                selectedFlight: flightData,
                passengers: 1,
                travelClass: 'ECONOMY',
                sessionId: bookingState.sessionId,
                timestamp: new Date().toISOString()
            })
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
            
            addMessage('✅ Vol confirmé ! Veuillez maintenant saisir les informations des passagers.', false);
            
            // Afficher le formulaire passager
            setTimeout(() => showPassengerForm(), 500);
        } else {
            addMessage(`❌ ${result?.error || 'Erreur lors de la sélection du vol'}`, false);
        }
    } catch (error) {
        showTyping(false);
        console.error('❌ Erreur sélection vol:', error);
        addMessage(`❌ Erreur de connexion: ${error.message}`, false);
    }
}

// === Affichage du formulaire passager ===
function showPassengerForm() {
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
    
    // Désactiver le bouton et afficher loading
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="loading-spinner"></div>Traitement...';
    
    try {
        const response = await fetch(BOOKING_WEBHOOKS.passengerData, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: bookingState.sessionId,
                flightId: bookingState.selectedFlightData?.flightId,
                passengers: [passengerData],
                contact: contactData,
                expectedPassengers: 1,
                timestamp: new Date().toISOString()
            })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        const result = await response.json();
        
        if (result && result.success) {
            bookingState.passengers = result.validatedPassengers;
            bookingState.contact = result.contactInfo;
            bookingState.currentStep = 'confirmation';
            
            addMessage('✅ Informations passager validées ! Procédons à la confirmation finale.', false);
            
            // Afficher l'étape de confirmation
            setTimeout(() => showBookingConfirmation(), 500);
        } else {
            throw new Error(result?.message || 'Validation des données échouée');
        }
        
    } catch (error) {
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
    addMessage('🎫 Finalisation de votre réservation...', false);
    showTyping(true);
    
    try {
        const response = await fetch(BOOKING_WEBHOOKS.bookingConfirm, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
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
                timestamp: new Date().toISOString()
            })
        });
        
        showTyping(false);
        
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        const result = await response.json();
        
        if (result && result.success) {
            addMessage(`🎉 Réservation confirmée !\n\nNuméro de confirmation: ${result.confirmationNumber}\nRéférence: ${result.booking.reference}\n\n📧 Un email de confirmation a été envoyé à ${bookingState.contact.email}`, false);
            
            // Reset pour nouvelle recherche
            setTimeout(() => {
                bookingState = {
                    selectedFlight: null,
                    selectedFlightData: null,
                    passengers: [],
                    contact: {},
                    currentStep: 'search',
                    sessionId: 'web-' + Date.now(),
                    pricing: null
                };
                addMessage('✈️ Vous pouvez maintenant effectuer une nouvelle recherche !', false);
            }, 3000);
        } else {
            throw new Error(result?.message || 'Erreur lors de la confirmation');
        }
        
    } catch (error) {
        showTyping(false);
        console.error('❌ Erreur confirmation:', error);
        addMessage(`❌ Erreur: ${error.message}`, false);
    }
}

// === Annulation ===
function cancelBooking() {
    bookingState = {
        selectedFlight: null,
        selectedFlightData: null,
        passengers: [],
        contact: {},
        currentStep: 'search',
        sessionId: 'web-' + Date.now(),
        pricing: null
    };
    
    addMessage('❌ Réservation annulée. Vous pouvez effectuer une nouvelle recherche.', false);
}
