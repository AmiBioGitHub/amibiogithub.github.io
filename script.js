// Flight Bot - Interface Web JavaScript - Version Duffel Corrigée
console.log('🚀 Flight Bot Interface démarrée - Version Duffel');

// Configuration des APIs
const API_BASE_URL = 'https://amibio.app.n8n.cloud/webhook';
const API_ENDPOINTS = {
    search: `${API_BASE_URL}/flight-search`,
    select: `${API_BASE_URL}/flight-select`,
    passengerData: `${API_BASE_URL}/passenger-data`,
    bookingConfirm: `${API_BASE_URL}/booking-confirm`
};

// État global de la réservation
let bookingState = {
    selectedFlight: null,
    passengers: [],
    contact: {},
    currentStep: 'search', // search, select, passengers, confirm, completed
    sessionId: 'web-' + Date.now(),
    pricing: null
};

// ====================
// FONCTIONS HELPERS ROBUSTES
// ====================

// Fonction helper pour gérer les noms de passagers de façon robuste
function safeGetPassengerData(passenger, index = 0) {
    if (!passenger || typeof passenger !== 'object') {
        console.warn(`⚠️ Passager ${index + 1} invalide:`, passenger);
        return {
            firstName: 'Passager',
            lastName: `${index + 1}`,
            fullName: `Passager ${index + 1}`,
            dateOfBirth: '',
            gender: 'MALE'
        };
    }

    // Toutes les variantes possibles de prénom
    const firstName = passenger.firstName || 
                     passenger.given_name || 
                     passenger.name?.firstName || 
                     passenger.name?.given_name ||
                     passenger.first_name ||
                     'Prénom';

    // Toutes les variantes possibles de nom
    const lastName = passenger.lastName || 
                    passenger.family_name || 
                    passenger.name?.lastName || 
                    passenger.name?.family_name ||
                    passenger.last_name ||
                    'Nom';

    // Autres données
    const dateOfBirth = passenger.dateOfBirth || 
                       passenger.born_on || 
                       passenger.date_of_birth ||
                       '';

    const gender = passenger.gender || 
                   passenger.sex ||
                   'MALE';

    return {
        firstName: firstName.toString().trim(),
        lastName: lastName.toString().trim(),
        fullName: `${firstName.toString().trim()} ${lastName.toString().trim()}`,
        dateOfBirth: dateOfBirth.toString().trim(),
        gender: gender.toString().toUpperCase()
    };
}

// Fonction helper pour gérer les prix de façon robuste
function safeGetPricing(flightData) {
    console.log('📊 Debug pricing data:');
    
    // Plusieurs sources possibles pour le prix
    const priceSources = [
        flightData?.price,
        flightData?.pricing,
        flightData?.selectedFlight?.price,
        flightData?.duffelOffer?.price,
        flightData?.data?.price
    ];

    let finalPrice = null;
    let finalCurrency = 'EUR';

    for (const priceSource of priceSources) {
        if (priceSource && (priceSource.total || priceSource.grandTotal)) {
            finalPrice = priceSource.total || priceSource.grandTotal;
            finalCurrency = priceSource.currency || 'EUR';
            console.log('💰 Prix depuis', priceSource.constructor?.name || 'source', ':', finalPrice, finalCurrency);
            break;
        }
    }

    if (!finalPrice) {
        console.warn('⚠️ Aucun prix trouvé, utilisation prix par défaut');
        finalPrice = '0.00';
    }

    return {
        amount: parseFloat(finalPrice),
        currency: finalCurrency,
        formatted: `${parseFloat(finalPrice).toFixed(2)} ${finalCurrency}`
    };
}

// ====================
// RECHERCHE DE VOLS
// ====================

async function searchFlights() {
    const userMessage = document.getElementById('userMessage').value.trim();
    
    if (!userMessage) {
        addMessage('Veuillez entrer votre recherche de vol.', false);
        return;
    }

    console.log('🔍 Recherche:', userMessage);
    addMessage(userMessage, true);
    addMessage('Recherche en cours...', false);

    try {
        const response = await fetch(API_ENDPOINTS.search, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: userMessage,
                sessionId: bookingState.sessionId
            })
        });

        const data = await response.json();
        console.log('📡 Réponse recherche:', data);

        if (data.success && data.bestFlights && data.bestFlights.length > 0) {
            displayFlightResults(data);
        } else {
            const errorMsg = data.message || 'Aucun vol trouvé pour votre recherche.';
            addMessage(`❌ ${errorMsg}`, false);
            
            if (data.suggestions && data.suggestions.length > 0) {
                addMessage('💡 Suggestions:\n' + data.suggestions.join('\n'), false);
            }
        }

        // Réinitialiser le champ
        document.getElementById('userMessage').value = '';

    } catch (error) {
        console.error('💥 Erreur recherche:', error);
        addMessage('❌ Erreur lors de la recherche. Veuillez réessayer.', false);
    }
}

function displayFlightResults(data) {
    const flights = data.bestFlights || [];
    const searchParams = data.searchParams || {};
    
    let resultsHtml = `
        <div style="background: linear-gradient(135deg, #1e40af, #3b82f6); color: white; border-radius: 16px; padding: 20px; margin: 15px 0;">
            <div style="text-align: center; margin-bottom: 15px;">
                <div style="font-size: 20px; font-weight: bold;">✈️ Vols Disponibles</div>
                <div style="font-size: 14px; opacity: 0.9;">
                    ${searchParams.originCity} → ${searchParams.destinationCity}
                    ${searchParams.departureDate ? ` | ${new Date(searchParams.departureDate).toLocaleDateString('fr-FR')}` : ''}
                </div>
            </div>
    `;

    flights.forEach((flight, index) => {
        const pricing = safeGetPricing(flight);
        const scheduleOut = flight.schedule || {};
        const scheduleIn = flight.inbound || null;
        
        resultsHtml += `
            <div style="background: white; color: #1f2937; border-radius: 12px; padding: 15px; margin: 10px 0;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <div style="font-weight: bold; font-size: 16px;">
                        ${flight.airline?.name || 'Compagnie inconnue'}
                        <span style="background: #${getScoreColor(flight.score)}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; margin-left: 8px;">
                            ${flight.score || 70}/100
                        </span>
                    </div>
                    <div style="font-size: 18px; font-weight: bold; color: #059669;">
                        ${pricing.formatted}
                    </div>
                </div>
                
                <div style="font-size: 14px; color: #6b7280; margin-bottom: 12px;">
                    <strong>🛫 ALLER:</strong> ${scheduleOut.departure} → ${scheduleOut.arrival} | ⏱️ ${scheduleOut.duration}
                    ${scheduleIn ? `<br><strong>🛬 RETOUR:</strong> ${scheduleIn.departure} → ${scheduleIn.arrival} | ⏱️ ${scheduleIn.duration}` : ''}
                </div>
                
                <div style="text-align: center; margin-top: 12px;">
                    <button onclick="selectFlight(${index})" 
                            style="background: linear-gradient(135deg, #059669, #047857); color: white; border: none; padding: 10px 20px; border-radius: 20px; font-weight: 600; cursor: pointer;">
                        📋 Réserver ce vol
                    </button>
                </div>
            </div>
        `;
    });

    resultsHtml += '</div>';
    
    // Stocker les données pour la sélection
    bookingState.searchResults = flights;
    bookingState.searchParams = searchParams;
    
    addMessage(resultsHtml, false, true);
}

// ====================
// SÉLECTION DE VOL
// ====================

async function selectFlight(flightIndex) {
    console.log('✈️ Sélection du vol', flightIndex + 1);
    
    if (!bookingState.searchResults || !bookingState.searchResults[flightIndex]) {
        addMessage('❌ Erreur: vol non trouvé', false);
        return;
    }

    const selectedFlight = bookingState.searchResults[flightIndex];
    addMessage('Vérification du prix en temps réel...', false);

    try {
        const response = await fetch(API_ENDPOINTS.select, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                flightIndex: flightIndex,
                flightId: selectedFlight.duffelData?.offerId || `flight_${flightIndex}`,
                selectedFlight: selectedFlight,
                sessionId: bookingState.sessionId,
                passengers: 1,
                travelClass: bookingState.searchParams?.travelClass || 'ECONOMY'
            })
        });

        const data = await response.json();
        console.log('📡 Réponse sélection:', data);

        if (data.success) {
            bookingState.selectedFlight = selectedFlight;
            bookingState.pricing = data.pricing;
            bookingState.currentStep = 'passengers';
            
            showPassengerForm();
        } else {
            const errorMsg = data.message || 'Erreur lors de la sélection du vol.';
            addMessage(`❌ ${errorMsg}`, false);
        }

    } catch (error) {
        console.error('💥 Erreur sélection:', error);
        addMessage('❌ Erreur lors de la sélection. Veuillez réessayer.', false);
    }
}

// ====================
// FORMULAIRE PASSAGERS
// ====================

function showPassengerForm() {
    console.log('👤 Affichage formulaire passager');
    
    const pricing = safeGetPricing(bookingState.pricing || bookingState.selectedFlight);
    
    const formHtml = `
        <div style="background: linear-gradient(135deg, #7c3aed, #8b5cf6); color: white; border-radius: 16px; padding: 20px; margin: 15px 0;">
            <div style="text-align: center; margin-bottom: 20px;">
                <div style="font-size: 20px; font-weight: bold;">👤 Informations Passager</div>
                <div style="font-size: 14px; opacity: 0.9;">
                    Prix confirmé: ${pricing.formatted}
                </div>
            </div>
            
            <div style="background: white; color: #1f2937; border-radius: 12px; padding: 20px;">
                <form id="passengerForm">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                        <div>
                            <label style="display: block; font-weight: 600; margin-bottom: 5px;">Prénom *</label>
                            <input type="text" id="firstName" required 
                                   style="width: 100%; padding: 8px; border: 2px solid #e5e7eb; border-radius: 8px;">
                        </div>
                        <div>
                            <label style="display: block; font-weight: 600; margin-bottom: 5px;">Nom *</label>
                            <input type="text" id="lastName" required 
                                   style="width: 100%; padding: 8px; border: 2px solid #e5e7eb; border-radius: 8px;">
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                        <div>
                            <label style="display: block; font-weight: 600; margin-bottom: 5px;">Date de naissance *</label>
                            <input type="date" id="dateOfBirth" required 
                                   style="width: 100%; padding: 8px; border: 2px solid #e5e7eb; border-radius: 8px;">
                        </div>
                        <div>
                            <label style="display: block; font-weight: 600; margin-bottom: 5px;">Genre *</label>
                            <select id="gender" required 
                                    style="width: 100%; padding: 8px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                <option value="">Sélectionner</option>
                                <option value="MALE">Homme</option>
                                <option value="FEMALE">Femme</option>
                            </select>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; font-weight: 600; margin-bottom: 5px;">Email *</label>
                        <input type="email" id="email" required 
                               style="width: 100%; padding: 8px; border: 2px solid #e5e7eb; border-radius: 8px;">
                    </div>
                    
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; font-weight: 600; margin-bottom: 5px;">Téléphone *</label>
                        <input type="tel" id="phone" required 
                               style="width: 100%; padding: 8px; border: 2px solid #e5e7eb; border-radius: 8px;"
                               placeholder="+32 123 456 789">
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; font-weight: 600; margin-bottom: 5px;">Numéro de passeport *</label>
                        <input type="text" id="passportNumber" required 
                               style="width: 100%; padding: 8px; border: 2px solid #e5e7eb; border-radius: 8px;">
                    </div>
                    
                    <div style="text-align: center;">
                        <button type="button" onclick="submitPassengerData()" 
                                style="background: linear-gradient(135deg, #059669, #047857); color: white; border: none; padding: 12px 30px; border-radius: 20px; font-weight: 600; cursor: pointer;">
                            📝 Valider les informations
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    addMessage(formHtml, false, true);
}

async function submitPassengerData() {
    console.log('📝 Submitting passenger form');
    
    // Récupération sécurisée des données du formulaire
    const formData = {
        firstName: document.getElementById('firstName')?.value?.trim() || '',
        lastName: document.getElementById('lastName')?.value?.trim() || '',
        dateOfBirth: document.getElementById('dateOfBirth')?.value || '',
        gender: document.getElementById('gender')?.value || '',
        email: document.getElementById('email')?.value?.trim() || '',
        phone: document.getElementById('phone')?.value?.trim() || '',
        passportNumber: document.getElementById('passportNumber')?.value?.trim() || ''
    };

    // Validation côté client
    const errors = [];
    if (!formData.firstName) errors.push('Prénom requis');
    if (!formData.lastName) errors.push('Nom requis');
    if (!formData.dateOfBirth) errors.push('Date de naissance requise');
    if (!formData.gender) errors.push('Genre requis');
    if (!formData.email || !formData.email.includes('@')) errors.push('Email valide requis');
    if (!formData.phone) errors.push('Téléphone requis');
    if (!formData.passportNumber) errors.push('Numéro de passeport requis');

    if (errors.length > 0) {
        addMessage('❌ Erreurs dans le formulaire:\n' + errors.join('\n'), false);
        return;
    }

    const passengerData = safeGetPassengerData(formData);
    console.log('📋 Passenger data prepared:', passengerData.fullName);

    try {
        console.log('📡 Sending passenger data to API...');
        
        const response = await fetch(API_ENDPOINTS.passengerData, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sessionId: bookingState.sessionId,
                flightId: bookingState.selectedFlight?.duffelData?.offerId || 'unknown',
                passengers: [formData], // Utiliser formData original
                contact: {
                    email: formData.email,
                    phone: formData.phone
                },
                expectedPassengers: 1
            })
        });

        const data = await response.json();
        console.log('📡 Réponse passager:', data);

        if (data.success) {
            console.log('✅ Passenger data validated successfully');
            
            // Stockage sécurisé des données validées
            bookingState.passengers = [passengerData]; // Utiliser les données formatées
            bookingState.contact = {
                email: formData.email,
                phone: formData.phone
            };
            bookingState.currentStep = 'confirm';
            
            showBookingConfirmation();
        } else {
            const errorMsg = data.message || 'Erreur de validation des données passager.';
            addMessage(`❌ ${errorMsg}`, false);
            
            if (data.errors && data.errors.length > 0) {
                addMessage('📋 Détails:\n' + data.errors.join('\n'), false);
            }
        }

    } catch (error) {
        console.error('💥 Erreur passager:', error);
        addMessage('❌ Erreur lors de la validation. Veuillez réessayer.', false);
    }
}

// ====================
// CONFIRMATION DE RÉSERVATION
// ====================

function showBookingConfirmation() {
    console.log('🎉 Showing booking confirmation');
    
    const pricing = safeGetPricing(bookingState.pricing || bookingState.selectedFlight);
    const passenger = safeGetPassengerData(bookingState.passengers?.[0]);
    
    const confirmationHtml = `
        <div style="background: linear-gradient(135deg, #dc2626, #ef4444); color: white; border-radius: 16px; padding: 20px; margin: 15px 0;">
            <div style="text-align: center; margin-bottom: 20px;">
                <div style="font-size: 20px; font-weight: bold;">🎯 Confirmation de Réservation</div>
                <div style="font-size: 14px; opacity: 0.9;">Vérifiez vos informations avant de confirmer</div>
            </div>
            
            <div style="background: white; color: #1f2937; border-radius: 12px; padding: 20px;">
                <div style="margin-bottom: 15px;">
                    <h4 style="margin: 0 0 8px 0; color: #1f2937;">✈️ Vol sélectionné</h4>
                    <div style="font-size: 14px; color: #6b7280;">
                        ${bookingState.selectedFlight?.airline?.name || 'Compagnie aérienne'}<br>
                        Prix: ${pricing.formatted}
                    </div>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <h4 style="margin: 0 0 8px 0; color: #1f2937;">👤 Passager</h4>
                    <div style="font-size: 14px; color: #6b7280;">
                        ${passenger.fullName}<br>
                        ${bookingState.contact?.email || 'Email non disponible'}
                    </div>
                </div>
                
                <div style="background: #fef3c7; padding: 12px; border-radius: 8px; margin: 15px 0;">
                    <div style="font-size: 13px; color: #92400e;">
                        <strong>⚠️ Simulation de réservation</strong><br>
                        Ceci est une démonstration. Aucune réservation réelle ne sera effectuée.
                    </div>
                </div>
                
                <div style="text-align: center;">
                    <button onclick="confirmBooking()" 
                            style="background: linear-gradient(135deg, #dc2626, #b91c1c); color: white; border: none; padding: 12px 30px; border-radius: 20px; font-weight: 600; cursor: pointer;">
                        🎯 Confirmer la réservation
                    </button>
                </div>
            </div>
        </div>
    `;
    
    addMessage(confirmationHtml, false, true);
}

async function confirmBooking() {
    console.log('🎯 Confirming booking');
    
    addMessage('Finalisation de votre réservation...', false);

    try {
        const passenger = safeGetPassengerData(bookingState.passengers?.[0]);
        
        const response = await fetch(API_ENDPOINTS.bookingConfirm, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sessionId: bookingState.sessionId,
                flightId: bookingState.selectedFlight?.duffelData?.offerId || 'unknown',
                selectedFlight: {
                    ...bookingState.selectedFlight,
                    price: bookingState.pricing || bookingState.selectedFlight?.price
                },
                passengers: [{
                    firstName: passenger.firstName,
                    lastName: passenger.lastName,
                    name: {
                        firstName: passenger.firstName,
                        lastName: passenger.lastName
                    },
                    dateOfBirth: passenger.dateOfBirth,
                    gender: passenger.gender
                }],
                contact: bookingState.contact,
                payment: {
                    method: 'simulation',
                    status: 'confirmed'
                }
            })
        });

        const data = await response.json();
        console.log('📡 Réponse confirmation:', data);

        if (data.webResponse?.success) {
            bookingState.currentStep = 'completed';
            addMessage(data.webResponse.html, false, true);
        } else {
            const errorMsg = data.message || 'Erreur lors de la confirmation.';
            addMessage(`❌ ${errorMsg}`, false);
        }

    } catch (error) {
        console.error('💥 Global error:', error);
        addMessage('❌ Erreur lors de la confirmation. Veuillez réessayer.', false);
    }
}

// ====================
// FONCTIONS UTILITAIRES
// ====================

function addMessage(content, isUser = false, isHtml = false) {
    const chatBox = document.getElementById('chatBox');
    const messageDiv = document.createElement('div');
    
    messageDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;
    
    if (isHtml) {
        messageDiv.innerHTML = content;
    } else {
        messageDiv.textContent = content;
        if (!isUser) {
            console.log('💬 bot:', content);
        }
    }
    
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function getScoreColor(score) {
    if (score >= 90) return '22c55e'; // Vert
    if (score >= 80) return '3b82f6'; // Bleu
    if (score >= 70) return 'f59e0b'; // Orange
    return 'ef4444'; // Rouge
}

function resetBooking() {
    console.log('🔄 Reset booking state');
    bookingState = {
        selectedFlight: null,
        passengers: [],
        contact: {},
        currentStep: 'search',
        sessionId: 'web-' + Date.now(),
        pricing: null
    };
    
    addMessage('Nouvelle recherche initialisée. Que puis-je vous aider à trouver ?', false);
}

function downloadTicket(confirmationNumber) {
    console.log('📄 Download ticket:', confirmationNumber);
    addMessage(`📄 Fonction de téléchargement à implémenter pour: ${confirmationNumber}`, false);
}

// Gestion de l'événement Enter
document.addEventListener('DOMContentLoaded', function() {
    const userMessageInput = document.getElementById('userMessage');
    if (userMessageInput) {
        userMessageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                searchFlights();
            }
        });
    }
    
    console.log('✅ Flight Bot Interface initialisée');
});
