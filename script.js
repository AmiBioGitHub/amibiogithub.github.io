// Flight Bot - Interface Web JavaScript - Version Simplifiée
console.log('Flight Bot Interface démarrée - Version Simplifiée');

// Configuration des APIs - VERSION SIMPLIFIÉE
const API_BASE_URL = 'https://amibio.app.n8n.cloud/webhook';

// ENDPOINTS SIMPLIFIÉS - Moins d'appels backend
const API_ENDPOINTS = {
    search: `${API_BASE_URL}

// ====================
// FONCTION POUR DONNÉES DUMMY (TESTS)
// ====================

function fillDummyData() {
    console.log('Remplissage avec données de test');
    
    // Données dummy pour faciliter les tests
    const dummyData = {
        firstName: 'Jean',
        lastName: 'Dupont',
        dateOfBirth: '1985-06-15',
        gender: 'MALE',
        email: 'jean.dupont@example.com',
        phone: '+32 2 123 45 67',
        passportNumber: 'BE123456789'
    };
    
    // Remplir les champs
    const firstNameField = document.getElementById('firstName');
    const lastNameField = document.getElementById('lastName');
    const dateOfBirthField = document.getElementById('dateOfBirth');
    const genderField = document.getElementById('gender');
    const emailField = document.getElementById('email');
    const phoneField = document.getElementById('phone');
    const passportNumberField = document.getElementById('passportNumber');
    
    if (firstNameField) firstNameField.value = dummyData.firstName;
    if (lastNameField) lastNameField.value = dummyData.lastName;
    if (dateOfBirthField) dateOfBirthField.value = dummyData.dateOfBirth;
    if (genderField) genderField.value = dummyData.gender;
    if (emailField) emailField.value = dummyData.email;
    if (phoneField) phoneField.value = dummyData.phone;
    if (passportNumberField) passportNumberField.value = dummyData.passportNumber;
    
    // Animation visuelle pour confirmer le remplissage
    [firstNameField, lastNameField, dateOfBirthField, genderField, emailField, phoneField, passportNumberField].forEach(field => {
        if (field) {
            field.style.background = '#dcfce7'; // Vert clair
            setTimeout(() => {
                field.style.background = '';
            }, 1000);
        }
    });
    
    console.log('✅ Formulaire pré-rempli avec données de test');
    
    // Message de confirmation
    addMessage('✅ Formulaire pré-rempli avec données de test Jean Dupont', false);
}/flight-search`,           // ✅ Nécessaire pour rechercher
    bookingConfirm: `${API_BASE_URL}/booking-confirm`  // ✅ Nécessaire pour réserver final
    // select: SUPPRIMÉ - Traitement local
    // passengerData: SUPPRIMÉ - Validation locale
};

// État global de la réservation
let bookingState = {
    selectedFlight: null,
    passengers: [],
    contact: {},
    currentStep: 'search',
    sessionId: 'web-' + Date.now(),
    pricing: null,
    searchResults: null,
    searchParams: null
};

// ====================
// FONCTIONS HELPERS
// ====================

// Fonction helper pour gérer les noms de passagers
function safeGetPassengerData(passenger, index = 0) {
    if (!passenger || typeof passenger !== 'object') {
        console.warn(`Passager ${index + 1} invalide:`, passenger);
        return {
            firstName: 'Passager',
            lastName: `${index + 1}`,
            fullName: `Passager ${index + 1}`,
            dateOfBirth: '',
            gender: 'MALE',
            passportNumber: ''
        };
    }

    const firstName = passenger.firstName || 
                     passenger.given_name || 
                     passenger.name?.firstName || 
                     'Prénom';

    const lastName = passenger.lastName || 
                    passenger.family_name || 
                    passenger.name?.lastName || 
                    'Nom';

    const dateOfBirth = passenger.dateOfBirth || 
                       passenger.born_on || 
                       '';

    const gender = passenger.gender || 'MALE';

    const passportNumber = passenger.passportNumber ||
                          passenger.passport_number ||
                          '';

    return {
        firstName: firstName.toString().trim(),
        lastName: lastName.toString().trim(),
        fullName: `${firstName.toString().trim()} ${lastName.toString().trim()}`,
        dateOfBirth: dateOfBirth.toString().trim(),
        gender: gender.toString().toUpperCase(),
        passportNumber: passportNumber.toString().trim()
    };
}

// Fonction helper pour gérer les prix
function safeGetPricing(flightData) {
    console.log('Debug pricing data:', flightData);
    
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
        if (priceSource && (priceSource.total || priceSource.grandTotal || priceSource.amount)) {
            finalPrice = priceSource.total || priceSource.grandTotal || priceSource.amount;
            finalCurrency = priceSource.currency || 'EUR';
            console.log('Prix trouvé depuis', priceSource.constructor?.name || 'source', ':', finalPrice, finalCurrency);
            break;
        }
    }

    if (!finalPrice) {
        console.warn('Aucun prix trouvé, utilisation prix par défaut');
        finalPrice = '0.00';
    }

    return {
        amount: parseFloat(finalPrice),
        currency: finalCurrency,
        formatted: `${parseFloat(finalPrice).toFixed(2)} ${finalCurrency}`
    };
}

// Fonction pour formater la durée
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

// Fonction pour obtenir la couleur du score
function getScoreColor(score) {
    if (score >= 90) return '22c55e'; // Vert
    if (score >= 80) return '3b82f6'; // Bleu
    if (score >= 70) return 'f59e0b'; // Orange
    return 'ef4444'; // Rouge
}

// Extraction des données Duffel
function extractDuffelData(selectedFlight) {
    console.log('Extraction données Duffel depuis:', selectedFlight);
    
    // Option 1: Données déjà dans duffelData
    if (selectedFlight.duffelData && selectedFlight.duffelData.id) {
        console.log('✅ Données Duffel trouvées dans duffelData');
        return selectedFlight.duffelData;
    }
    
    // Option 2: Données dans originalData
    if (selectedFlight.originalData && selectedFlight.originalData.id) {
        console.log('✅ Données Duffel trouvées dans originalData');
        return selectedFlight.originalData;
    }
    
    // Option 3: L'ID commence par 'off_' (format Duffel)
    if (selectedFlight.id && selectedFlight.id.startsWith('off_')) {
        console.log('✅ ID Duffel détecté, reconstruction des données');
        return {
            id: selectedFlight.id,
            total_amount: selectedFlight.price?.amount || selectedFlight.price?.total || 0,
            total_currency: selectedFlight.price?.currency || 'EUR',
            expires_at: selectedFlight.expires_at,
            slices: selectedFlight.slices || [],
            // Ajouter d'autres champs Duffel si disponibles
            ...(selectedFlight.duffelOffer || {})
        };
    }
    
    // Option 4: Fallback - créer une structure minimale
    console.warn('⚠️ Aucune donnée Duffel trouvée, création fallback');
    const pricing = safeGetPricing(selectedFlight);
    
    return {
        id: selectedFlight.id || `fallback_${Date.now()}`,
        total_amount: pricing.amount || 0,
        total_currency: pricing.currency || 'EUR',
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // +30 min
        slices: [],
        _fallback: true,
        _originalFlight: selectedFlight
    };
}

// ====================
// GESTION DE L'INTERFACE
// ====================

function addMessage(content, isUser = false, isHtml = false) {
    const chatContainer = document.getElementById('chatContainer');
    
    if (!chatContainer) {
        console.error('Element chatContainer non trouvé');
        return;
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user' : 'bot'}`;
    
    const avatarDiv = document.createElement('div');
    avatarDiv.className = `avatar ${isUser ? 'user' : 'bot'}`;
    avatarDiv.textContent = isUser ? '👤' : '🤖';
    
    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'message-bubble';
    
    if (isHtml) {
        bubbleDiv.innerHTML = content;
    } else {
        bubbleDiv.textContent = content;
        if (!isUser) {
            console.log('bot:', content);
        }
    }
    
    messageDiv.appendChild(avatarDiv);
    messageDiv.appendChild(bubbleDiv);
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function fillExample(text) {
    const messageInput = document.getElementById('userMessage');
    if (messageInput) {
        messageInput.value = text;
        messageInput.focus();
        messageInput.style.height = 'auto';
        messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
    }
}

// ====================
// RECHERCHE DE VOLS - SEUL APPEL BACKEND POUR RECHERCHE
// ====================

async function searchFlights() {
    const userMessage = document.getElementById('userMessage').value.trim();
    
    if (!userMessage) {
        addMessage('Veuillez entrer votre recherche de vol.', false);
        return;
    }

    console.log('Recherche:', userMessage);
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
        console.log('Réponse recherche:', data);

        if (data.success && data.bestFlights && data.bestFlights.length > 0) {
            displayFlightResults(data);
        } else {
            const errorMsg = data.message || 'Aucun vol trouvé pour votre recherche.';
            addMessage(`❌ ${errorMsg}`, false);
            
            if (data.suggestions && data.suggestions.length > 0) {
                addMessage('💡 Suggestions:\n' + data.suggestions.join('\n'), false);
            }
        }

        document.getElementById('userMessage').value = '';

    } catch (error) {
        console.error('Erreur recherche:', error);
        addMessage('❌ Erreur lors de la recherche. Veuillez réessayer.', false);
    }
}

function displayFlightResults(data) {
    const flights = data.bestFlights || [];
    const searchParams = data.searchParams || {};
    
    console.log('Search params:', searchParams);
    console.log('Flights data:', flights);
    
    let resultsHtml = `
        <div style="background: linear-gradient(135deg, #1e40af, #3b82f6); color: white; border-radius: 16px; padding: 20px; margin: 15px 0;">
            <div style="text-align: center; margin-bottom: 15px;">
                <div style="font-size: 20px; font-weight: bold;">✈️ Vols Disponibles</div>
                <div style="font-size: 14px; opacity: 0.9;">
                    ${searchParams.originCity || 'Origine'} → ${searchParams.destinationCity || 'Destination'}
                    ${searchParams.departureDate ? ` | ${new Date(searchParams.departureDate).toLocaleDateString('fr-FR')}` : ''}
                </div>
            </div>
    `;

    flights.forEach((flight, index) => {
        console.log(`Flight ${index + 1} data:`, flight);
        
        const pricing = safeGetPricing(flight);
        const scheduleOut = flight.schedule || {};
        const scheduleIn = flight.inbound || null;
        
        // Score limité à 100
        const score = Math.min(flight.score || 70, 100);
        
        console.log(`Flight ${index + 1} pricing:`, pricing);
        console.log(`Flight ${index + 1} schedule:`, { scheduleOut, scheduleIn });
        
        resultsHtml += `
            <div style="background: white; color: #1f2937; border-radius: 12px; padding: 15px; margin: 10px 0;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <div style="font-weight: bold; font-size: 16px;">
                        ${flight.airline?.name || 'Compagnie inconnue'}
                        <span style="background: #${getScoreColor(score)}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; margin-left: 8px;">
                            ${score}/100
                        </span>
                    </div>
                    <div style="font-size: 18px; font-weight: bold; color: #059669;">
                        ${pricing.formatted}
                    </div>
                </div>
                
                <div style="font-size: 14px; color: #6b7280; margin-bottom: 12px;">
                    <strong>🛫 ALLER:</strong> ${scheduleOut.departure || 'N/A'} → ${scheduleOut.arrival || 'N/A'} | ⏱️ ${formatDuration(scheduleOut.duration)}
                    ${scheduleIn ? `<br><strong>🛬 RETOUR:</strong> ${scheduleIn.departure || 'N/A'} → ${scheduleIn.arrival || 'N/A'} | ⏱️ ${formatDuration(scheduleIn.duration)}` : ''}
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
    
    bookingState.searchResults = flights;
    bookingState.searchParams = searchParams;
    
    addMessage(resultsHtml, false, true);
}

// ====================
// SÉLECTION DE VOL - VERSION SIMPLIFIÉE (TRAITEMENT LOCAL)
// ====================

function selectFlight(flightIndex) {
    console.log('Sélection du vol', flightIndex + 1, '- Traitement local');
    
    if (!bookingState.searchResults || !bookingState.searchResults[flightIndex]) {
        addMessage('❌ Erreur: vol non trouvé', false);
        return;
    }

    const selectedFlight = bookingState.searchResults[flightIndex];
    console.log('Vol sélectionné:', selectedFlight);
    
    // SAUVEGARDER LA SÉLECTION
    bookingState.selectedFlight = selectedFlight;
    bookingState.currentStep = 'selected';
    
    // AFFICHER LE RÉSUMÉ DU VOL SÉLECTIONNÉ (LOCAL)
    showSelectedFlightSummary(selectedFlight);
}

// ====================
// RÉSUMÉ DU VOL SÉLECTIONNÉ - TRAITEMENT LOCAL
// ====================

function showSelectedFlightSummary(selectedFlight) {
    console.log('Affichage résumé vol sélectionné - local');
    
    const pricing = safeGetPricing(selectedFlight);
    const scheduleOut = selectedFlight.schedule || {};
    const scheduleIn = selectedFlight.inbound || null;
    const score = Math.min(selectedFlight.score || 70, 100);
    
    const summaryHtml = `
        <div style="background: linear-gradient(135deg, #059669, #047857); color: white; border-radius: 16px; padding: 20px; margin: 15px 0;">
            <div style="text-align: center; margin-bottom: 20px;">
                <div style="font-size: 20px; font-weight: bold;">✈️ Vol Sélectionné</div>
                <div style="font-size: 14px; opacity: 0.9;">Vérifiez les détails avant de continuer</div>
            </div>
            
            <div style="background: white; color: #1f2937; border-radius: 12px; padding: 20px;">
                
                <!-- Compagnie et Prix -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #f3f4f6;">
                    <div>
                        <div style="font-size: 18px; font-weight: bold; color: #1f2937;">
                            ${selectedFlight.airline?.name || 'Compagnie aérienne'}
                        </div>
                        <div style="font-size: 14px; color: #6b7280; margin-top: 4px;">
                            Score qualité: 
                            <span style="background: #${getScoreColor(score)}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px;">
                                ${score}/100
                            </span>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 24px; font-weight: bold; color: #059669;">
                            ${pricing.formatted}
                        </div>
                        <div style="font-size: 12px; color: #6b7280;">
                            Prix par personne
                        </div>
                    </div>
                </div>
                
                <!-- Détails Vol Aller -->
                <div style="margin-bottom: 15px;">
                    <div style="font-weight: bold; color: #1f2937; margin-bottom: 8px; display: flex; align-items: center;">
                        🛫 <span style="margin-left: 8px;">Vol Aller</span>
                    </div>
                    <div style="background: #f9fafb; padding: 12px; border-radius: 8px; font-size: 14px;">
                        <div style="display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 15px;">
                            <div style="text-align: left;">
                                <div style="font-weight: 600;">${scheduleOut.departure || 'N/A'}</div>
                                <div style="font-size: 12px; color: #6b7280;">Départ</div>
                            </div>
                            <div style="text-align: center; color: #6b7280;">
                                <div>✈️</div>
                                <div style="font-size: 12px;">⏱️ ${formatDuration(scheduleOut.duration)}</div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-weight: 600;">${scheduleOut.arrival || 'N/A'}</div>
                                <div style="font-size: 12px; color: #6b7280;">Arrivée</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Détails Vol Retour (si existe) -->
                ${scheduleIn ? `
                <div style="margin-bottom: 20px;">
                    <div style="font-weight: bold; color: #1f2937; margin-bottom: 8px; display: flex; align-items: center;">
                        🛬 <span style="margin-left: 8px;">Vol Retour</span>
                    </div>
                    <div style="background: #f9fafb; padding: 12px; border-radius: 8px; font-size: 14px;">
                        <div style="display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 15px;">
                            <div style="text-align: left;">
                                <div style="font-weight: 600;">${scheduleIn.departure || 'N/A'}</div>
                                <div style="font-size: 12px; color: #6b7280;">Départ</div>
                            </div>
                            <div style="text-align: center; color: #6b7280;">
                                <div>✈️</div>
                                <div style="font-size: 12px;">⏱️ ${formatDuration(scheduleIn.duration)}</div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-weight: 600;">${scheduleIn.arrival || 'N/A'}</div>
                                <div style="font-size: 12px; color: #6b7280;">Arrivée</div>
                            </div>
                        </div>
                    </div>
                </div>
                ` : ''}
                
                <!-- Informations additionnelles -->
                <div style="background: #eff6ff; padding: 12px; border-radius: 8px; margin-bottom: 20px;">
                    <div style="font-size: 13px; color: #1e40af;">
                        <strong>ℹ️ Informations importantes</strong><br>
                        • Prix affiché pour 1 adulte en classe économique<br>
                        • Bagages selon conditions de la compagnie<br>
                        • Modification/annulation selon tarif choisi
                    </div>
                </div>
                
                <!-- Boutons d'action -->
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button onclick="goBackToResults()" 
                            style="background: #6b7280; color: white; border: none; padding: 12px 24px; border-radius: 20px; font-weight: 600; cursor: pointer;">
                        ← Changer de vol
                    </button>
                    <button onclick="proceedToPassengerForm()" 
                            style="background: linear-gradient(135deg, #7c3aed, #8b5cf6); color: white; border: none; padding: 12px 30px; border-radius: 20px; font-weight: 600; cursor: pointer;">
                        👤 Continuer vers passagers
                    </button>
                </div>
                
            </div>
        </div>
    `;
    
    addMessage(summaryHtml, false, true);
}

// ====================
// FONCTIONS DE NAVIGATION
// ====================

function goBackToResults() {
    console.log('Retour aux résultats de recherche');
    bookingState.currentStep = 'search';
    bookingState.selectedFlight = null;
    
    addMessage('Voici à nouveau les vols disponibles pour votre recherche :', false);
    
    // Réafficher les résultats précédents
    if (bookingState.searchResults && bookingState.searchResults.length > 0) {
        displayFlightResults({
            bestFlights: bookingState.searchResults,
            searchParams: bookingState.searchParams
        });
    }
}

function proceedToPassengerForm() {
    console.log('Passage au formulaire passager');
    bookingState.currentStep = 'passengers';
    
    // Afficher directement le formulaire passager
    showPassengerForm();
}

// ====================
// FORMULAIRE PASSAGERS - TRAITEMENT LOCAL
// ====================

function showPassengerForm() {
    console.log('Affichage formulaire passager - local');
    
    const pricing = safeGetPricing(bookingState.selectedFlight);
    
    const formHtml = `
        <div style="background: linear-gradient(135deg, #7c3aed, #8b5cf6); color: white; border-radius: 16px; padding: 20px; margin: 15px 0;">
            <div style="text-align: center; margin-bottom: 20px;">
                <div style="font-size: 20px; font-weight: bold;">👤 Informations Passager</div>
                <div style="font-size: 14px; opacity: 0.9;">
                    Prix confirmé: ${pricing.formatted}
                </div>
            </div>
            
            <div style="background: white; color: #1f2937; border-radius: 12px; padding: 20px;">
                
                <!-- Bouton de test avec données dummy -->
                <div style="text-align: center; margin-bottom: 15px; padding: 10px; background: #fef3c7; border-radius: 8px;">
                    <div style="font-size: 12px; color: #92400e; margin-bottom: 8px;">
                        <strong>🧪 MODE TEST</strong> - Remplissage automatique pour tests
                    </div>
                    <button onclick="fillDummyData()" 
                            style="background: #f59e0b; color: white; border: none; padding: 6px 16px; border-radius: 16px; font-size: 12px; cursor: pointer;">
                        ⚡ Remplir avec données de test
                    </button>
                </div>
                
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

// ====================
// VALIDATION PASSAGERS - VERSION SIMPLIFIÉE (LOCALE)
// ====================

function submitPassengerData() {
    console.log('Validation locale des données passager');
    
    const formData = {
        firstName: document.getElementById('firstName')?.value?.trim() || '',
        lastName: document.getElementById('lastName')?.value?.trim() || '',
        dateOfBirth: document.getElementById('dateOfBirth')?.value || '',
        gender: document.getElementById('gender')?.value || '',
        email: document.getElementById('email')?.value?.trim() || '',
        phone: document.getElementById('phone')?.value?.trim() || '',
        passportNumber: document.getElementById('passportNumber')?.value?.trim() || ''
    };

    // VALIDATION LOCALE (sans backend)
    const errors = validatePassengerData(formData);

    if (errors.length > 0) {
        addMessage('❌ Erreurs dans le formulaire:\n• ' + errors.join('\n• '), false);
        return;
    }

    // TRAITEMENT LOCAL
    const passengerData = safeGetPassengerData(formData);
    console.log('Données passager validées localement:', passengerData.fullName);

    // SAUVEGARDER DANS L'ÉTAT
    bookingState.passengers = [passengerData];
    bookingState.contact = {
        email: formData.email,
        phone: formData.phone
    };
    bookingState.currentStep = 'confirm';
    
    // Message de confirmation locale
    addMessage('✅ Informations passager validées avec succès !', false);
    
    // PASSAGE DIRECT À LA CONFIRMATION
    showBookingConfirmation();
}

// ====================
// FONCTION DE VALIDATION LOCALE
// ====================

function validatePassengerData(formData) {
    const errors = [];
    
    // Validation prénom
    if (!formData.firstName || formData.firstName.length < 2) {
        errors.push('Prénom requis (minimum 2 caractères)');
    }
    
    // Validation nom
    if (!formData.lastName || formData.lastName.length < 2) {
        errors.push('Nom requis (minimum 2 caractères)');
    }
    
    // Validation date de naissance
    if (!formData.dateOfBirth) {
        errors.push('Date de naissance requise');
    } else {
        const birthDate = new Date(formData.dateOfBirth);
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear();
        
        if (age < 0 || age > 120) {
            errors.push('Date de naissance invalide');
        }
        if (age < 18) {
            console.log('⚠️ Passager mineur détecté');
            // On pourrait ajouter des validations spécifiques pour mineurs
        }
    }
    
    // Validation genre
    if (!formData.gender || !['MALE', 'FEMALE'].includes(formData.gender)) {
        errors.push('Genre requis');
    }
    
    // Validation email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email || !emailRegex.test(formData.email)) {
        errors.push('Email valide requis');
    }
    
    // Validation téléphone
    if (!formData.phone || formData.phone.length < 10) {
        errors.push('Téléphone valide requis');
    }
    
    // Validation passeport
    if (!formData.passportNumber || formData.passportNumber.length < 6) {
        errors.push('Numéro de passeport requis (minimum 6 caractères)');
    }
    
    return errors;
}

// ====================
// CONFIRMATION DE RÉSERVATION
// ====================

function showBookingConfirmation() {
    console.log('Showing booking confirmation - local');
    
    const pricing = safeGetPricing(bookingState.selectedFlight);
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
                        Ceci est une démonstration. Une réservation sera créée via n8n/Duffel.
                    </div>
                </div>
                
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button onclick="showPassengerForm()" 
                            style="background: #6b7280; color: white; border: none; padding: 12px 24px; border-radius: 20px; font-weight: 600; cursor: pointer;">
                        ← Modifier passager
                    </button>
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

// ====================
// CONFIRMATION FINALE - SEUL CONTACT BACKEND RESTANT
// ====================

async function confirmBooking() {
    console.log('Confirmation finale - Contact backend pour réservation');
    
    addMessage('🎯 Finalisation de votre réservation...', false);

    try {
        const passenger = safeGetPassengerData(bookingState.passengers?.[0]);
        const duffelOffer = extractDuffelData(bookingState.selectedFlight);
        
        // SEUL APPEL BACKEND - Pour la réservation finale
        const response = await fetch(API_ENDPOINTS.bookingConfirm, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sessionId: bookingState.sessionId,
                
                // Données vol avec Duffel natif
                flightId: duffelOffer.id || bookingState.selectedFlight?.id,
                selectedFlight: {
                    ...bookingState.selectedFlight,
                    duffelData: duffelOffer
                },
                
                // Données passager validées localement
                passengers: [{
                    firstName: passenger.firstName,
                    lastName: passenger.lastName,
                    name: {
                        firstName: passenger.firstName,
                        lastName: passenger.lastName
                    },
                    dateOfBirth: passenger.dateOfBirth,
                    gender: passenger.gender,
                    // Ajouter données passeport si nécessaire
                    passportNumber: passenger.passportNumber || ''
                }],
                
                // Contact
                contact: bookingState.contact,
                
                // Métadonnées de réservation
                payment: {
                    method: 'simulation',
                    status: 'pending'
                },
                metadata: {
                    bookingSource: 'web_simplified',
                    timestamp: new Date().toISOString(),
                    userAgent: navigator.userAgent
                }
            })
        });

        const data = await response.json();
        console.log('Réponse confirmation backend:', data);

        if (data.success || data.webResponse?.success) {
            bookingState.currentStep = 'completed';
            
            // Afficher le résultat final
            const finalResponse = data.webResponse || data;
            if (finalResponse.html) {
                addMessage(finalResponse.html, false, true);
            } else {
                showBookingSuccess(data);
            }
            
        } else {
            const errorMsg = data.message || 'Erreur lors de la confirmation.';
            addMessage(`❌ ${errorMsg}`, false);
            
            // En cas d'erreur, proposer de recommencer
            setTimeout(() => {
                addMessage('Voulez-vous recommencer la réservation ?', false);
                addBookingRetryButton();
            }, 2000);
        }

    } catch (error) {
        console.error('Erreur confirmation:', error);
        addMessage('❌ Erreur de connexion. Veuillez réessayer.', false);
        
        setTimeout(() => {
            addBookingRetryButton();
        }, 2000);
    }
}

// ====================
// AFFICHAGE SUCCÈS LOCAL (si pas de HTML backend)
// ====================

function showBookingSuccess(data) {
    const passenger = safeGetPassengerData(bookingState.passengers?.[0]);
    const pricing = safeGetPricing(bookingState.selectedFlight);
    const confirmationNumber = data.confirmationNumber || `WEB${Date.now()}`;
    
    const successHtml = `
        <div style="background: linear-gradient(135deg, #059669, #10b981); color: white; border-radius: 16px; padding: 25px; margin: 15px 0;">
            <div style="text-align: center; margin-bottom: 25px;">
                <div style="font-size: 24px; margin-bottom: 10px;">🎉</div>
                <div style="font-size: 20px; font-weight: bold;">Réservation Confirmée !</div>
                <div style="font-size: 14px; opacity: 0.9;">Numéro de confirmation: ${confirmationNumber}</div>
            </div>
            
            <div style="background: white; color: #1f2937; border-radius: 12px; padding: 20px;">
                
                <div style="text-align: center; margin-bottom: 20px;">
                    <div style="background: #ecfdf5; color: #065f46; padding: 12px; border-radius: 8px; margin-bottom: 15px;">
                        <strong>✅ Votre vol est réservé</strong><br>
                        Un email de confirmation va vous être envoyé à ${bookingState.contact.email}
                    </div>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <h4 style="margin: 0 0 8px 0; color: #1f2937;">👤 Passager</h4>
                    <div style="font-size: 14px; color: #6b7280;">
                        ${passenger.fullName}<br>
                        ${bookingState.contact?.email || 'Email non disponible'}
                    </div>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <h4 style="margin: 0 0 8px 0; color: #1f2937;">✈️ Vol</h4>
                    <div style="font-size: 14px; color: #6b7280;">
                        ${bookingState.selectedFlight?.airline?.name || 'Compagnie aérienne'}<br>
                        Prix total: ${pricing.formatted}
                    </div>
                </div>
                
                <div style="display: flex; gap: 10px; justify-content: center; margin-top: 20px;">
                    <button onclick="downloadTicket('${confirmationNumber}')" 
                            style="background: #3b82f6; color: white; border: none; padding: 10px 20px; border-radius: 20px; font-weight: 600; cursor: pointer;">
                        📄 Télécharger billet
                    </button>
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

// ====================
// GESTION D'ERREUR - BOUTON RETRY
// ====================

function addBookingRetryButton() {
    const retryHtml = `
        <div style="text-align: center; margin: 15px 0;">
            <button onclick="showBookingConfirmation()" 
                    style="background: #f59e0b; color: white; border: none; padding: 10px 20px; border-radius: 20px; font-weight: 600; cursor: pointer;">
                🔄 Réessayer la réservation
            </button>
            <button onclick="resetBooking()" 
                    style="background: #6b7280; color: white; border: none; padding: 10px 20px; border-radius: 20px; font-weight: 600; cursor: pointer; margin-left: 10px;">
                🏠 Recommencer
            </button>
        </div>
    `;
    
    addMessage(retryHtml, false, true);
}

// ====================
// FONCTIONS UTILITAIRES
// ====================

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
        searchParams: null
    };
    
    addMessage('Nouvelle recherche initialisée. Que puis-je vous aider à trouver ?', false);
}

function downloadTicket(confirmationNumber) {
    console.log('Download ticket:', confirmationNumber);
    addMessage(`📄 Fonction de téléchargement à implémenter pour: ${confirmationNumber}`, false);
    
    // Ici on pourrait implémenter:
    // - Génération PDF du billet
    // - Téléchargement automatique
    // - Envoi par email
}

// ====================
// INITIALISATION
// ====================

document.addEventListener('DOMContentLoaded', function() {
    console.log('Flight Bot Interface initialisée - Version Simplifiée');
    
    const userMessageInput = document.getElementById('userMessage');
    if (userMessageInput) {
        // Enter pour envoyer
        userMessageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                searchFlights();
            }
        });
        
        // Auto-resize du textarea
        userMessageInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 120) + 'px';
        });
    }
    
    // Message de bienvenue
    addMessage('👋 Bonjour ! Je suis votre assistant de réservation de vols. Dites-moi où vous souhaitez aller et quand !', false);
});
