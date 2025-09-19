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



    const messagesContainer = document.getElementById('chatContainer');

    // Protection contre l'élément manquant
    if (!messagesContainer) {
        console.error('Élément #messages non trouvé dans le HTML');
        return;
    }
    const messageDiv = document.createElement('div');
    messageDiv.className = isUser ? 'message user-message' : 'message bot-message';
    
    if (isHtml) {
        messageDiv.innerHTML = content;
    } else {
        messageDiv.textContent = content;
    }
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
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
async function searchFlights(userMessage) {
    console.log('Recherche de vols:', userMessage);
    
    addMessage('🔍 Recherche des meilleurs vols...', false);
    
    try {
        const response = await fetch(API_ENDPOINTS.flightSearch, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: userMessage,
                sessionId: bookingState.sessionId
            })
        });

        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }

        const data = await response.json();
        console.log('Réponse recherche:', data);

        if (data.success && data.bestFlights && data.bestFlights.length > 0) {
            bookingState.searchResults = data;
            bookingState.searchParams = data.searchParams;
            displayFlightResults(data);
        } else if (data.error === 'NO_FLIGHTS_FOUND') {
            addMessage('❌ Aucun vol trouvé pour votre recherche. Essayez avec d\'autres dates ou destinations.', false);
        } else {
            addMessage('❌ Erreur lors de la recherche de vols. Veuillez réessayer avec une demande plus précise.', false);
        }

    } catch (error) {
        console.error('Erreur recherche vols:', error);
        addMessage('❌ Erreur de connexion. Veuillez vérifier votre connexion internet et réessayer.', false);
    }
}

function displayFlightResults(data) {
    const flights = data.bestFlights || [];
    const searchInfo = data.searchParams || {};
    
    let resultHtml = `
        <div style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; border-radius: 16px; padding: 20px; margin: 15px 0;">
            <h3 style="margin: 0 0 10px 0;">✈️ Vols trouvés</h3>
            <p style="margin: 0; opacity: 0.9;">${searchInfo.originCity || 'Origine'} → ${searchInfo.destinationCity || 'Destination'}</p>
            <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.8;">${flights.length} vol(s) analysé(s) par IA</p>
        </div>
    `;
    
    flights.forEach((flight, index) => {
        const price = flight.price?.amount || flight.price?.total || 0;
        const currency = flight.price?.currency || 'EUR';
        const airline = flight.airline?.name || 'Compagnie inconnue';
        const departure = flight.schedule?.departure || 'N/A';
        const arrival = flight.schedule?.arrival || 'N/A';
        const duration = flight.schedule?.duration || 'N/A';
        const stops = flight.directFlight ? 'Direct' : `${flight.stops || 0} escale(s)`;
        const score = flight.score || 70;
        
        const medalEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅';
        
        resultHtml += `
            <div style="border: 1px solid #e5e7eb; border-radius: 12px; padding: 15px; margin: 10px 0; background: white;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                    <div>
                        <span style="font-size: 18px;">${medalEmoji}</span>
                        <strong style="color: #1f2937; font-size: 16px; margin-left: 5px;">${airline}</strong>
                        <div style="color: #059669; font-size: 14px; margin-top: 2px;">Score IA: ${score}/100</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 20px; font-weight: bold; color: #059669;">${price} ${currency}</div>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 15px; align-items: center; margin-bottom: 15px;">
                    <div style="text-align: left;">
                        <div style="font-weight: bold; font-size: 16px;">${departure}</div>
                        <div style="color: #6b7280; font-size: 14px;">Départ</div>
                    </div>
                    <div style="text-align: center; color: #6b7280;">
                        <div>${duration}</div>
                        <div style="font-size: 12px;">${stops}</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: bold; font-size: 16px;">${arrival}</div>
                        <div style="color: #6b7280; font-size: 14px;">Arrivée</div>
                    </div>
                </div>
                
                <button onclick="selectFlight(${index})" 
                        style="width: 100%; background: #059669; color: white; border: none; padding: 12px; border-radius: 8px; font-weight: 600; cursor: pointer;">
                    Sélectionner ce vol
                </button>
            </div>
        `;
    });
    
    addMessage(resultHtml, false, true);
}

function selectFlight(flightIndex) {
    if (!bookingState.searchResults || !bookingState.searchResults.bestFlights) {
        addMessage('❌ Erreur: données de vol non disponibles', false);
        return;
    }
    
    const selectedFlight = bookingState.searchResults.bestFlights[flightIndex];
    bookingState.selectedFlight = selectedFlight;
    bookingState.currentStep = 'passenger-info';
    
    const airline = selectedFlight.airline?.name || 'Compagnie inconnue';
    const price = selectedFlight.price?.amount || selectedFlight.price?.total || 0;
    const currency = selectedFlight.price?.currency || 'EUR';
    
    addMessage(`✅ Vol sélectionné: ${airline} - ${price} ${currency}`, false);
    
    sessionStorage.setItem('bookingState', JSON.stringify(bookingState));
    
    showPassengerForm();
}

// ===== FORMULAIRE PASSAGER =====
function showPassengerForm() {
    const formHtml = `
        <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin: 15px 0;">
            <h3 style="color: #1f2937; margin: 0 0 20px 0;">👤 Informations passager</h3>
            
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
                
                <h4 style="color: #1f2937; margin: 20px 0 15px 0;">📧 Contact</h4>
                
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
        addMessage('❌ Veuillez remplir tous les champs obligatoires', false);
        return;
    }
    
    bookingState.passengers = [passengerData];
    bookingState.contact = contactData;
    bookingState.currentStep = 'confirmation';
    
    sessionStorage.setItem('bookingState', JSON.stringify(bookingState));
    
    addMessage(`✅ Informations enregistrées pour ${passengerData.firstName} ${passengerData.lastName}`, false);
    
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
            <h3 style="color: #1f2937; margin: 0 0 20px 0;">📋 Récapitulatif de réservation</h3>
            
            <div style="background: white; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                <h4 style="margin: 0 0 10px 0; color: #059669;">✈️ Vol sélectionné</h4>
                <div><strong>${airline}</strong></div>
                <div>Prix: <strong>${price} ${currency}</strong></div>
                <div>Horaires: ${flight.schedule?.departure || 'N/A'} → ${flight.schedule?.arrival || 'N/A'}</div>
            </div>
            
            <div style="background: white; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                <h4 style="margin: 0 0 10px 0; color: #059669;">👤 Passager</h4>
                <div><strong>${passenger.fullName}</strong></div>
                <div>Né(e) le: ${passenger.dateOfBirth}</div>
                <div>Passeport: ${passenger.passportNumber || 'Non renseigné'}</div>
            </div>
            
            <div style="background: white; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                <h4 style="margin: 0 0 10px 0; color: #059669;">📧 Contact</h4>
                <div>Email: <strong>${contact.email}</strong></div>
                <div>Téléphone: ${contact.phone || 'Non renseigné'}</div>
            </div>
            
            <div style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                <div style="font-size: 14px; color: #92400e;">
                    <strong>⚠️ Important:</strong> Après confirmation, vous serez redirigé vers une page de paiement sécurisé. 
                    Votre réservation sera finalisée après paiement réussi.
                </div>
            </div>
            
            <div style="display: flex; gap: 10px;">
                <button onclick="confirmBooking()" 
                        style="flex: 1; background: #059669; color: white; border: none; padding: 12px; border-radius: 8px; font-weight: 600; cursor: pointer;">
                    💳 Confirmer et payer
                </button>
                <button onclick="showPassengerForm()" 
                        style="flex: 1; background: #6b7280; color: white; border: none; padding: 12px; border-radius: 8px; font-weight: 600; cursor: pointer;">
                    ✏️ Modifier
                </button>
            </div>
        </div>
    `;
    
    addMessage(confirmationHtml, false, true);
}

// ===== RÉSERVATION ET PAIEMENT =====
async function confirmBooking() {
    console.log('Confirmation finale - Paiement puis réservation');
    
    addMessage('💳 Préparation du paiement sécurisé...', false);
    
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
            addMessage(`❌ ${data.error?.message || 'Erreur lors de la réservation'}`, false);
        }

    } catch (error) {
        console.error('Erreur réservation:', error);
        addMessage('❌ Erreur de connexion. Veuillez réessayer.', false);
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
                    💳 Payer maintenant
                </button>
                
                <div style="font-size: 14px; margin-top: 15px; opacity: 0.9;">
                    Après paiement, vous recevrez automatiquement votre confirmation par email.
                </div>
            </div>
        </div>
    `;
    
    addMessage(paymentHtml, false, true);
}

function showRealBookingSuccess(data) {
    const passenger = safeGetPassengerData(bookingState.passengers?.[0]);
    const totalPrice = `${data.totalAmount || data.paymentAmount} ${data.totalCurrency || data.paymentCurrency}`;
    const confirmationNumber = data.confirmationNumber;
    
    const successHtml = `
        <div style="background: linear-gradient(135deg, #059669, #10b981); color: white; border-radius: 16px; padding: 25px; margin: 15px 0;">
            <div style="text-align: center; margin-bottom: 25px;">
                <div style="font-size: 24px; margin-bottom: 10px;">🎉</div>
                <div style="font-size: 20px; font-weight: bold;">Réservation CONFIRMÉE !</div>
                <div style="font-size: 14px; opacity: 0.9;">Votre vol est officiellement réservé</div>
            </div>
            
            <div style="background: white; color: #1f2937; border-radius: 12px; padding: 20px;">
                <div style="background: #10b981; color: white; padding: 15px; border-radius: 8px; text-align: center; margin-bottom: 20px;">
                    <div style="font-size: 14px; opacity: 0.9; margin-bottom: 5px;">✅ CONFIRMÉ - Numéro de confirmation</div>
                    <div style="font-size: 24px; font-weight: bold; letter-spacing: 1px;">${confirmationNumber}</div>
                </div>
                
                <div style="background: #dcfce7; color: #065f46; padding: 12px; border-radius: 8px; margin-bottom: 15px; text-align: center;">
                    <strong>📧 Email de confirmation envoyé !</strong><br>
                    Vérifiez votre boîte mail : ${bookingState.contact.email}
                </div>
                
                <div style="margin-bottom: 15px;">
                    <h4 style="margin: 0 0 8px 0; color: #1f2937;">👤 Passager</h4>
                    <div style="font-size: 14px; color: #6b7280;">
                        ${passenger.fullName}<br>
                        📧 ${bookingState.contact?.email}<br>
                        📞 ${bookingState.contact?.phone || 'Non renseigné'}
                    </div>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <h4 style="margin: 0 0 8px 0; color: #1f2937;">✈️ Vol confirmé</h4>
                    <div style="font-size: 14px; color: #6b7280;">
                        ${bookingState.selectedFlight?.airline?.name || 'Compagnie aérienne'}<br>
                        Prix total: <strong>${totalPrice}</strong><br>
                        Réservé via: <strong>Duffel API (réel)</strong>
                    </div>
                </div>
                
                <div style="background: #fef3c7; color: #92400e; padding: 12px; border-radius: 8px; margin: 15px 0;">
                    <div style="font-size: 13px;">
                        <strong>📋 Étapes suivantes :</strong><br>
                        • Vérifiez l'email de confirmation reçu<br>
                        • Enregistrement en ligne 24h avant le départ<br>
                        • Arrivez 2h avant l'heure de départ<br>
                        • Vérifiez la validité de vos documents de voyage
                    </div>
                </div>
                
                <div style="text-align: center; margin-top: 20px;">
                    <button onclick="resetBooking()" 
                            style="background: #10b981; color: white; border: none; padding: 10px 20px; border-radius: 20px; font-weight: 600; cursor: pointer;">
                        🔍 Nouvelle recherche
                    </button>
                </div>
            </div>
        </div>
    `;
    
    addMessage(successHtml, false, true);
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

// ===== GESTION DES MESSAGES =====
function sendMessage() {
    const input = document.getElementById('message-input');
    const message = input.value.trim();
    
    if (!message) return;
    
    addMessage(message, true);
    input.value = '';
    
    // Recherche de vols
    searchFlights(message);
}

// Gestion de la touche Entrée
document.getElementById('message-input')?.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// ===== INITIALISATION =====
document.addEventListener('DOMContentLoaded', function() {
    // Restaurer l'état depuis sessionStorage
    const savedState = sessionStorage.getItem('bookingState');
    if (savedState) {
        try {
            bookingState = JSON.parse(savedState);
        } catch (e) {
            console.error('Erreur parsing bookingState:', e);
        }
    }
    
    // Message de bienvenue
    addMessage('Bonjour ! Je suis votre assistant de réservation de vols. Décrivez votre voyage (origine, destination, date) et je trouverai les meilleures options pour vous !', false);
});
