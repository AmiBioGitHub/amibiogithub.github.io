// ===== CONFIGURATION =====
const API_ENDPOINTS = {
    flightSearch: 'https://amibio.app.n8n.cloud/webhook/flight-search',
    bookingConfirm: 'https://amibio.app.n8n.cloud/webhook/booking-confirm'
};

// ===== ÉTAT GLOBAL =====
let bookingState = {
    selectedFlight: null,
    passengers: [],
    contact: {},
    currentStep: 'search',
    sessionId: 'web-' + Date.now(),
    pricing: null,
    searchResults: null,
    searchParams: null,
    realBooking: true
};

// ===== FONCTIONS UTILITAIRES =====
function addMessage(content, isUser = false, isHtml = false) {
    const chatContainer = document.getElementById('chatContainer');
    if (!chatContainer) {
        console.error('Élément #chatContainer non trouvé');
        return;
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = isUser ? 'message user' : 'message bot';
    
    // Structure cohérente avec votre HTML
    const avatarDiv = document.createElement('div');
    avatarDiv.className = isUser ? 'avatar user' : 'avatar bot';
    avatarDiv.textContent = isUser ? '👤' : '🤖';
    
    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'message-bubble';
    
    if (isHtml) {
        bubbleDiv.innerHTML = content;
    } else {
        bubbleDiv.textContent = content;
    }
    
    messageDiv.appendChild(avatarDiv);
    messageDiv.appendChild(bubbleDiv);
    chatContainer.appendChild(messageDiv);
    
    // Scroll vers le bas
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function showTypingIndicator(show = true) {
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
        typingIndicator.style.display = show ? 'flex' : 'none';
    }
}

function clearMessageInput() {
    const messageInput = document.getElementById('userMessage');
    if (messageInput) {
        messageInput.value = '';
        messageInput.style.height = 'auto';
    }
}

function safeGetPassengerData(passenger) {
    if (!passenger) return { fullName: 'N/A', firstName: '', lastName: '' };
    
    return {
        fullName: `${passenger.firstName || ''} ${passenger.lastName || ''}`.trim() || 'N/A',
        firstName: passenger.firstName || '',
        lastName: passenger.lastName || '',
        dateOfBirth: passenger.dateOfBirth || '',
        gender: passenger.gender || '',
        passportNumber: passenger.passportNumber || ''
    };
}

// ===== RECHERCHE DE VOLS =====
async function searchFlights() {
    const messageInput = document.getElementById('userMessage');
    if (!messageInput) {
        console.error('Input userMessage introuvable');
        return;
    }
    
    const userMessage = messageInput.value.trim();
    if (!userMessage) {
        addMessage('Veuillez entrer votre recherche de vol.', false);
        return;
    }
    
    // Afficher le message utilisateur
    addMessage(userMessage, true);
    clearMessageInput();
    
    // Afficher l'indicateur de frappe
    showTypingIndicator(true);
    addMessage('Recherche des meilleurs vols...', false);
    
    try {
        const response = await fetch(API_ENDPOINTS.flightSearch, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                message: userMessage,
                sessionId: bookingState.sessionId
            })
        });

        showTypingIndicator(false);

        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }

        const data = await response.json();
        console.log('Réponse API:', data);

        if (data.success && data.bestFlights && data.bestFlights.length > 0) {
            bookingState.searchResults = data;
            bookingState.searchParams = data.searchParams;
            displayFlightResults(data);
        } else if (data.error === 'NO_FLIGHTS_FOUND') {
            addMessage('Aucun vol trouvé pour votre recherche. Essayez avec d\'autres dates ou destinations.', false);
        } else {
            addMessage(`Erreur: ${data.error?.message || 'Erreur lors de la recherche'}`, false);
        }

    } catch (error) {
        showTypingIndicator(false);
        console.error('Erreur recherche vols:', error);
        addMessage(`Erreur de connexion: ${error.message}`, false);
    }
}

// ====================
// FONCTION displayFlightResults - MANQUANTE DANS VOTRE CODE
// À ajouter dans votre script.js
// ====================

function displayFlightResults(data) {
    const flights = data.bestFlights || [];
    const searchParams = data.searchParams || {};
    
    console.log('Affichage de', flights.length, 'vols');
    
    let resultsHtml = `
        <div style="background: linear-gradient(135deg, #1e40af, #3b82f6); color: white; border-radius: 16px; padding: 20px; margin: 15px 0;">
            <div style="text-align: center; margin-bottom: 15px;">
                <div style="font-size: 20px; font-weight: bold;">✈️ Vols Disponibles</div>
                <div style="font-size: 14px; opacity: 0.9;">
                    ${searchParams.originCity || 'Origine'} → ${searchParams.destinationCity || 'Destination'}
                    ${searchParams.departureDate ? ` | ${new Date(searchParams.departureDate).toLocaleDateString('fr-FR')}` : ''}
                    ${searchParams.returnDate ? ` | Retour: ${new Date(searchParams.returnDate).toLocaleDateString('fr-FR')}` : ''}
                </div>
            </div>
    `;

    flights.forEach((flight, index) => {
        const pricing = safeGetPricing(flight);
        const score = Math.min(flight.score || 70, 100);
        const medalEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅';
        
        // Extraire les informations de vol
        const airlineName = flight.airline?.name || 'Compagnie aérienne';
        const scheduleOut = flight.schedule || {};
        const scheduleIn = flight.inbound || null;
        
        resultsHtml += `
            <div style="background: white; color: #1f2937; border-radius: 12px; padding: 18px; margin: 10px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border: 1px solid #e5e7eb;">
                
                <!-- En-tête compact -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <div style="font-size: 16px; font-weight: bold; color: #1f2937;">
                        ${medalEmoji} Vol ${index + 1}
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 18px; font-weight: bold; color: #059669;">
                            ${pricing.formatted}
                        </div>
                        <div style="font-size: 12px; color: #6b7280;">
                            Score: ${score}/100
                        </div>
                    </div>
                </div>
                
                <!-- Vol ALLER -->
                <div style="margin: 8px 0; padding: 8px 0; border-left: 3px solid #3b82f6; padding-left: 12px;">
                    <div style="font-size: 14px; font-weight: 600; color: #1f2937; margin-bottom: 6px;">
                        🛫 ALLER - ${airlineName}
                    </div>
                    <div style="font-size: 14px; color: #374151; margin-bottom: 4px;">
                        ${scheduleOut.departure || 'N/A'} → ${scheduleOut.arrival || 'N/A'} | ${formatDuration(scheduleOut.duration)}${flight.stops > 0 ? ` | ${flight.stops} escale${flight.stops > 1 ? 's' : ''}` : ''}
                    </div>
                </div>
                
                <!-- Vol RETOUR (si existe) -->
                ${scheduleIn ? `
                <div style="margin: 8px 0; padding: 8px 0; border-left: 3px solid #8b5cf6; padding-left: 12px;">
                    <div style="font-size: 14px; font-weight: 600; color: #1f2937; margin-bottom: 6px;">
                        🛬 RETOUR - ${airlineName}
                    </div>
                    <div style="font-size: 14px; color: #374151; margin-bottom: 4px;">
                        ${scheduleIn.departure || 'N/A'} → ${scheduleIn.arrival || 'N/A'} | ${formatDuration(scheduleIn.duration)}
                    </div>
                </div>
                ` : ''}
                
                <!-- Bouton de sélection -->
                <div style="text-align: center; margin-top: 15px;">
                    <button onclick="selectFlight(${index})" 
                            style="background: linear-gradient(135deg, #059669, #047857); color: white; border: none; padding: 10px 20px; border-radius: 20px; font-weight: 600; cursor: pointer; font-size: 14px;">
                        Sélectionner ce vol
                    </button>
                </div>
            </div>
        `;
    });

    resultsHtml += '</div>';
    
    // Sauvegarder les résultats
    bookingState.searchResults = flights;
    bookingState.searchParams = searchParams;
    
    addMessage(resultsHtml, false, true);
}

// ====================
// FONCTION UTILITAIRE POUR FORMATAGE DURÉE
// ====================

// Cette fonction existe déjà dans votre code mais voici une version améliorée
function formatDuration(duration) {
    if (!duration) return 'N/A';
    
    // Convertir P1DT7H10M en format lisible
    if (duration.startsWith('P')) {
        const dayMatch = duration.match(/(\d+)D/);
        const hourMatch = duration.match(/(\d+)H/);
        const minMatch = duration.match(/(\d+)M/);
        
        const days = dayMatch ? parseInt(dayMatch[1]) : 0;
        const hours = hourMatch ? parseInt(hourMatch[1]) : 0;
        const minutes = minMatch ? parseInt(minMatch[1]) : 0;
        
        const totalHours = days * 24 + hours;
        return `${totalHours}h${minutes.toString().padStart(2, '0')}m`;
    }
    
    // Format simple comme "15h30m"
    if (duration.includes('h') || duration.includes('H')) {
        return duration.toLowerCase();
    }
    
    return duration;
}

function selectFlight(flightIndex) {
    if (!bookingState.searchResults || !bookingState.searchResults.bestFlights) {
        addMessage('Erreur: données de vol non disponibles', false);
        return;
    }
    
    const selectedFlight = bookingState.searchResults.bestFlights[flightIndex];
    bookingState.selectedFlight = selectedFlight;
    bookingState.currentStep = 'passenger-info';
    
    const airline = selectedFlight.airline?.name || 'Compagnie inconnue';
    const price = selectedFlight.price?.amount || selectedFlight.price?.total || 0;
    const currency = selectedFlight.price?.currency || 'EUR';
    
    addMessage(`Vol sélectionné: ${airline} - ${price} ${currency}`, false);
    
    sessionStorage.setItem('bookingState', JSON.stringify(bookingState));
    
    showPassengerForm();
}

// ===== FORMULAIRE PASSAGER =====
function showPassengerForm() {
    const formHtml = `
        <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin: 15px 0;">
            <h3 style="color: #1f2937; margin: 0 0 20px 0;">Informations passager</h3>
            
            <form id="passenger-form" onsubmit="submitPassengerInfo(event)">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                    <div>
                        <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #374151;">Prénom *</label>
                        <input type="text" name="firstName" required 
                               style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #374151;">Nom *</label>
                        <input type="text" name="lastName" required 
                               style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                    <div>
                        <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #374151;">Date de naissance *</label>
                        <input type="date" name="dateOfBirth" required 
                               style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #374151;">Genre *</label>
                        <select name="gender" required 
                                style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
                            <option value="">Sélectionner</option>
                            <option value="MALE">Homme</option>
                            <option value="FEMALE">Femme</option>
                        </select>
                    </div>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #374151;">Numéro de passeport</label>
                    <input type="text" name="passportNumber" 
                           style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
                </div>
                
                <h4 style="color: #1f2937; margin: 20px 0 15px 0;">Contact</h4>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #374151;">Email *</label>
                    <input type="email" name="email" required 
                           style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
                </div>
                
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #374151;">Téléphone</label>
                    <input type="tel" name="phone" 
                           style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
                </div>
                
                <button type="submit" 
                        style="width: 100%; background: #059669; color: white; border: none; padding: 12px; border-radius: 8px; font-weight: 600; cursor: pointer;">
                    Continuer vers la réservation
                </button>
            </form>
        </div>
    `;
    
    addMessage(formHtml, false, true);
}

function submitPassengerInfo(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const passengerData = {
        firstName: formData.get('firstName'),
        lastName: formData.get('lastName'),
        dateOfBirth: formData.get('dateOfBirth'),
        gender: formData.get('gender'),
        passportNumber: formData.get('passportNumber')
    };
    
    const contactData = {
        email: formData.get('email'),
        phone: formData.get('phone')
    };
    
    // Validation
    if (!passengerData.firstName || !passengerData.lastName || !contactData.email) {
        addMessage('Veuillez remplir tous les champs obligatoires', false);
        return;
    }
    
    bookingState.passengers = [passengerData];
    bookingState.contact = contactData;
    bookingState.currentStep = 'confirmation';
    
    sessionStorage.setItem('bookingState', JSON.stringify(bookingState));
    
    addMessage(`Informations enregistrées pour ${passengerData.firstName} ${passengerData.lastName}`, false);
    
    showBookingConfirmation();
}

// ===== CONFIRMATION DE RÉSERVATION =====
function showBookingConfirmation() {
    const flight = bookingState.selectedFlight;
    const passenger = safeGetPassengerData(bookingState.passengers[0]);
    const contact = bookingState.contact;
    
    const price = flight.price?.amount || flight.price?.total || 0;
    const currency = flight.price?.currency || 'EUR';
    const airline = flight.airline?.name || 'Compagnie inconnue';
    
    const confirmationHtml = `
        <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin: 15px 0;">
            <h3 style="color: #1f2937; margin: 0 0 20px 0;">Récapitulatif de réservation</h3>
            
            <div style="background: white; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                <h4 style="margin: 0 0 10px 0; color: #059669;">Vol sélectionné</h4>
                <div><strong>${airline}</strong></div>
                <div>Prix: <strong>${price} ${currency}</strong></div>
                <div>Horaires: ${flight.schedule?.departure || 'N/A'} → ${flight.schedule?.arrival || 'N/A'}</div>
            </div>
            
            <div style="background: white; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                <h4 style="margin: 0 0 10px 0; color: #059669;">Passager</h4>
                <div><strong>${passenger.fullName}</strong></div>
                <div>Né(e) le: ${passenger.dateOfBirth}</div>
                <div>Passeport: ${passenger.passportNumber || 'Non renseigné'}</div>
            </div>
            
            <div style="background: white; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                <h4 style="margin: 0 0 10px 0; color: #059669;">Contact</h4>
                <div>Email: <strong>${contact.email}</strong></div>
                <div>Téléphone: ${contact.phone || 'Non renseigné'}</div>
            </div>
            
            <div style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                <div style="font-size: 14px; color: #92400e;">
                    <strong>Important:</strong> Après confirmation, vous serez redirigé vers une page de paiement sécurisé. 
                    Votre réservation sera finalisée après paiement réussi.
                </div>
            </div>
            
            <div style="display: flex; gap: 10px;">
                <button onclick="confirmBooking()" 
                        style="flex: 1; background: #059669; color: white; border: none; padding: 12px; border-radius: 8px; font-weight: 600; cursor: pointer;">
                    Confirmer et payer
                </button>
                <button onclick="showPassengerForm()" 
                        style="flex: 1; background: #6b7280; color: white; border: none; padding: 12px; border-radius: 8px; font-weight: 600; cursor: pointer;">
                    Modifier
                </button>
            </div>
        </div>
    `;
    
    addMessage(confirmationHtml, false, true);
}

// ===== RÉSERVATION ET PAIEMENT =====
async function confirmBooking() {
    console.log('Confirmation finale - Paiement puis réservation');
    
    addMessage('Préparation du paiement sécurisé...', false);
    
    try {
        const response = await fetch(API_ENDPOINTS.bookingConfirm, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: bookingState.sessionId,
                flightId: bookingState.selectedFlight?.id,
                passengers: bookingState.passengers,
                contact: bookingState.contact
            })
        });

        const data = await response.json();
        console.log('Réponse backend:', data);

        if (data.success && data.paymentRequired) {
            showSimplePaymentPage(data);
        } else if (data.success && data.duffelOrder) {
            showRealBookingSuccess(data);
        } else {
            addMessage(`Erreur: ${data.error?.message || 'Erreur lors de la réservation'}`, false);
        }

    } catch (error) {
        console.error('Erreur réservation:', error);
        addMessage('Erreur de connexion. Veuillez réessayer.', false);
    }
}

function showSimplePaymentPage(data) {
    const paymentHtml = `
        <div style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; border-radius: 16px; padding: 25px; margin: 15px 0;">
            <div style="text-align: center;">
                <div style="font-size: 24px; margin-bottom: 10px;">💳</div>
                <div style="font-size: 20px; font-weight: bold;">Paiement Requis</div>
                
                <div style="font-size: 24px; font-weight: bold; margin: 15px 0;">
                    ${data.paymentAmount} ${data.paymentCurrency}
                </div>
                
                <button onclick="window.open('${data.paymentUrl}', '_blank')" 
                        style="background: #059669; color: white; border: none; padding: 15px 30px; border-radius: 25px; font-size: 16px; font-weight: 600; cursor: pointer; margin: 15px;">
                    Payer maintenant
                </button>
                
                <div style="font-size: 14px; margin-top: 15px; opacity: 0.9;">
                    Après paiement, vous recevrez automatiquement votre confirmation par email.
                </div>
            </div>
        </div>
    `;
    
    addMessage(paymentHtml, false, true);
}

// ===== RÉINITIALISATION =====
function resetBooking() {
    console.log('Reset booking state');
    
    bookingState = {
        selectedFlight: null,
        passengers: [],
        contact: {},
        currentStep: 'search',
        sessionId: 'web-' + Date.now(),
        pricing: null,
        searchResults: null,
        searchParams: null,
        realBooking: true
    };
    
    sessionStorage.setItem('bookingState', JSON.stringify(bookingState));
    
    addMessage('Nouvelle recherche initialisée. Décrivez votre voyage et je trouverai les meilleurs vols !', false);
}

// ===== INITIALISATION =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM chargé, initialisation...');
    
    // Restaurer l'état depuis sessionStorage
    const savedState = sessionStorage.getItem('bookingState');
    if (savedState) {
        try {
            bookingState = JSON.parse(savedState);
        } catch (e) {
            console.error('Erreur parsing bookingState:', e);
        }
    }
    
    // Masquer l'indicateur de frappe au démarrage
    showTypingIndicator(false);
    
    console.log('Interface initialisée avec succès');
});
