// Flight Bot - Interface Web JavaScript - Version Complète Corrigée
console.log('Flight Bot Interface démarrée - Version avec escales détaillées');

// Configuration des APIs
const API_BASE_URL = 'https://amibio.app.n8n.cloud/webhook';

const API_ENDPOINTS = {
    search: `${API_BASE_URL}/flight-search`,
    bookingConfirm: `${API_BASE_URL}/booking-confirm`
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

function getScoreColor(score) {
    if (score >= 90) return '22c55e';
    if (score >= 80) return '3b82f6';
    if (score >= 70) return 'f59e0b';
    return 'ef4444';
}

function extractDuffelData(selectedFlight) {
    console.log('Extraction données Duffel depuis:', selectedFlight);
    
    if (selectedFlight.duffelData && selectedFlight.duffelData.id) {
        console.log('✅ Données Duffel trouvées dans duffelData');
        return selectedFlight.duffelData;
    }
    
    if (selectedFlight.originalData && selectedFlight.originalData.id) {
        console.log('✅ Données Duffel trouvées dans originalData');
        return selectedFlight.originalData;
    }
    
    if (selectedFlight.id && selectedFlight.id.startsWith('off_')) {
        console.log('✅ ID Duffel détecté, reconstruction des données');
        return {
            id: selectedFlight.id,
            total_amount: selectedFlight.price?.amount || selectedFlight.price?.total || 0,
            total_currency: selectedFlight.price?.currency || 'EUR',
            expires_at: selectedFlight.expires_at,
            slices: selectedFlight.slices || [],
            ...(selectedFlight.duffelOffer || {})
        };
    }
    
    console.warn('⚠️ Aucune donnée Duffel trouvée, création fallback');
    const pricing = safeGetPricing(selectedFlight);
    
    return {
        id: selectedFlight.id || `fallback_${Date.now()}`,
        total_amount: pricing.amount || 0,
        total_currency: pricing.currency || 'EUR',
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
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
// RECHERCHE DE VOLS
// ====================

async function searchFlights() {
    var userMessage = document.getElementById('userMessage').value.trim();
    
    if (!userMessage) {
        addMessage('Veuillez entrer votre recherche de vol.', false);
        return;
    }

    console.log('=== DÉBUT RECHERCHE ===');
    console.log('Message utilisateur:', userMessage);
    
    addMessage(userMessage, true);
    addMessage('🔍 Recherche en cours...', false);

    try {
        const response = await fetch(API_ENDPOINTS.search, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                message: userMessage,
                sessionId: bookingState.sessionId
            }),
            signal: AbortSignal.timeout(45000)
        });

        console.log('Réponse reçue:', response.status, response.statusText);

        if (!response.ok) {
            throw new Error(`Erreur serveur: ${response.status} ${response.statusText}`);
        }

        var data = await response.json();
        console.log('Données de réponse:', data);

        if (data.success && data.bestFlights && data.bestFlights.length > 0) {
            displayFlightResults(data);
        } else {
            var errorMsg = data.message || 'Aucun vol trouvé pour votre recherche.';
            addMessage('❌ ' + errorMsg, false);
            
            if (data.suggestions && data.suggestions.length > 0) {
                addMessage('💡 Suggestions:\n• ' + data.suggestions.join('\n• '), false);
            }
        }

        document.getElementById('userMessage').value = '';

    } catch (error) {
        console.error('Erreur recherche détaillée:', error);
        
        let errorMessage = '❌ ';
        
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            errorMessage += 'Problème de connexion réseau - Vérifiez que le workflow n8n est actif';
        } else if (error.name === 'AbortError') {
            errorMessage += 'Timeout - Le serveur met plus de 45 secondes à répondre';
        } else if (error.message.includes('CORS')) {
            errorMessage += 'Erreur CORS - Configurez les en-têtes Access-Control dans n8n';
        } else if (error.message.includes('404')) {
            errorMessage += 'Webhook non trouvé - Vérifiez l\'URL de votre webhook n8n';
        } else if (error.message.includes('500')) {
            errorMessage += 'Erreur serveur n8n - Vérifiez les logs de votre workflow';
        } else {
            errorMessage += `Erreur: ${error.message}`;
        }
        
        addMessage(errorMessage, false);
    }
}

// ====================
// AFFICHAGE DES VOLS AVEC ESCALES DÉTAILLÉES
// ====================

function displayFlightResults(data) {
    const flights = data.bestFlights || [];
    const searchParams = data.searchParams || {};
    
    console.log('Affichage de', flights.length, 'vols avec détails escales');
    
    if (flights.length === 0) {
        addMessage('Aucun vol trouvé pour votre recherche.', false);
        return;
    }
    
    let resultsHtml = `
        <div style="background: linear-gradient(135deg, #1e40af, #3b82f6); color: white; border-radius: 16px; padding: 20px; margin: 15px 0;">
            <div style="text-align: center; margin-bottom: 15px;">
                <div style="font-size: 20px; font-weight: bold;">✈️ Vols Disponibles</div>
                <div style="font-size: 14px; opacity: 0.9;">
        
                    ${searchParams.originCity || searchParams.originLocationCode || 'Origine'} → ${searchParams.destinationCity || searchParams.destinationLocationCode || 'Destination'}

                    ${searchParams.departureDate ? ` | ${new Date(searchParams.departureDate).toLocaleDateString('fr-FR')}` : ''}
                    ${searchParams.returnDate ? ` | Retour: ${new Date(searchParams.returnDate).toLocaleDateString('fr-FR')}` : ''}
                </div>
            </div>
    `;

    flights.forEach((flight, index) => {
        // Extraction du prix
        let price = 0;
        let currency = 'EUR';
        let priceFormatted = '0 EUR';
        
        try {
            if (flight.price && flight.price.total) {
                price = parseFloat(flight.price.total);
                currency = flight.price.currency || 'EUR';
            } else if (flight.price && flight.price.amount) {
                price = parseFloat(flight.price.amount);
                currency = flight.price.currency || 'EUR';
            } else if (flight.total_amount) {
                price = parseFloat(flight.total_amount);
                currency = flight.total_currency || 'EUR';
            } else if (flight.price && flight.price.grandTotal) {
                price = parseFloat(flight.price.grandTotal);
                currency = flight.price.currency || 'EUR';
            }
            
            priceFormatted = `${price.toFixed(2)} ${currency}`;
        } catch (error) {
            console.warn('Erreur extraction prix vol', index + 1, ':', error);
            priceFormatted = 'Prix N/A';
        }
        
        // Score IA
        const score = Math.min(Math.max(flight.score || flight.aiAnalysis?.score || 70, 0), 100);
        
        // Médaille
        const medalEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅';
        
        // Compagnie aérienne
        let airlineName = 'Compagnie aérienne';
        try {
            if (flight.airline && flight.airline.name) {
                airlineName = flight.airline.name;
            } else if (flight.validatingAirlineCodes && flight.validatingAirlineCodes[0]) {
                const code = flight.validatingAirlineCodes[0];
                airlineName = getAirlineNameFromCode(code);
            } else if (flight.duffelData && flight.duffelData.slices && flight.duffelData.slices[0] && 
                      flight.duffelData.slices[0].segments && flight.duffelData.slices[0].segments[0]) {
                const segment = flight.duffelData.slices[0].segments[0];
                airlineName = segment.marketing_carrier?.name || segment.operating_carrier?.name || 'Compagnie';
            }
        } catch (error) {
            console.warn('Erreur extraction compagnie vol', index + 1, ':', error);
        }
        
        // Horaires vol aller
        let scheduleOutText = 'Horaires non disponibles';
        try {
            if (flight.schedule) {
                const dep = flight.schedule.departure || 'N/A';
                const arr = flight.schedule.arrival || 'N/A';
                const dur = formatDurationInternal(flight.schedule.duration) || 'N/A';
                const stops = flight.stops || 0;
                const stopsText = stops > 0 ? ` | ${stops} escale${stops > 1 ? 's' : ''}` : '';
                scheduleOutText = `${dep} → ${arr} | ${dur}${stopsText}`;
            } else if (flight.duffelData && flight.duffelData.slices && flight.duffelData.slices[0]) {
                const slice = flight.duffelData.slices[0];
                const segments = slice.segments || [];
                if (segments.length > 0) {
                    const firstSeg = segments[0];
                    const lastSeg = segments[segments.length - 1];
                    
                    const depTime = formatTimeFromISO(firstSeg.departing_at);
                    const arrTime = formatTimeFromISO(lastSeg.arriving_at);
                    const depAirport = firstSeg.origin?.iata_code || 'XXX';
                    const arrAirport = lastSeg.destination?.iata_code || 'XXX';
                    const duration = formatDurationInternal(slice.duration);
                    const stops = Math.max(0, segments.length - 1);
                    const stopsText = stops > 0 ? ` | ${stops} escale${stops > 1 ? 's' : ''}` : '';
                    
                    scheduleOutText = `${depTime} ${depAirport} → ${arrTime} ${arrAirport} | ${duration}${stopsText}`;
                }
            }
        } catch (error) {
            console.warn('Erreur extraction horaires aller vol', index + 1, ':', error);
        }
        
        // Horaires vol retour (si existe)
        let scheduleInText = '';
        let hasReturn = false;
        try {
            if (flight.inbound) {
                hasReturn = true;
                const dep = flight.inbound.departure || 'N/A';
                const arr = flight.inbound.arrival || 'N/A';
                const dur = formatDurationInternal(flight.inbound.duration) || 'N/A';
                scheduleInText = `${dep} → ${arr} | ${dur}`;
            } else if (flight.duffelData && flight.duffelData.slices && flight.duffelData.slices[1]) {
                hasReturn = true;
                const slice = flight.duffelData.slices[1];
                const segments = slice.segments || [];
                if (segments.length > 0) {
                    const firstSeg = segments[0];
                    const lastSeg = segments[segments.length - 1];
                    
                    const depTime = formatTimeFromISO(firstSeg.departing_at);
                    const arrTime = formatTimeFromISO(lastSeg.arriving_at);
                    const depAirport = firstSeg.origin?.iata_code || 'XXX';
                    const arrAirport = lastSeg.destination?.iata_code || 'XXX';
                    const duration = formatDurationInternal(slice.duration);
                    
                    scheduleInText = `${depTime} ${depAirport} → ${arrTime} ${arrAirport} | ${duration}`;
                }
            }
        } catch (error) {
            console.warn('Erreur extraction horaires retour vol', index + 1, ':', error);
        }
        
        // Construction HTML du vol
        resultsHtml += `
            <div style="background: white; color: #1f2937; border-radius: 12px; padding: 18px; margin: 10px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border: 1px solid #e5e7eb;">
                
                <!-- En-tête compact -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <div style="font-size: 16px; font-weight: bold; color: #1f2937;">
                        ${medalEmoji} Vol ${index + 1}
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 18px; font-weight: bold; color: #059669;">
                            ${priceFormatted}
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
                        ${scheduleOutText}
                    </div>
                    ${(() => {
                        const layovers = extractLayoverInfo(flight, 0);
                        return layovers.length > 0 ? 
                            `<div style="font-size: 12px; color: #6b7280; margin-top: 4px; padding-left: 8px;">
                                🔄 Correspondances: ${layovers.map(l => `${l.airport} - ${l.duration} ${l.status}`).join(' • ')}
                            </div>` : '';
                    })()}
                </div>
                
                <!-- Vol RETOUR (si existe) -->
                ${hasReturn ? `
                <div style="margin: 8px 0; padding: 8px 0; border-left: 3px solid #8b5cf6; padding-left: 12px;">
                    <div style="font-size: 14px; font-weight: 600; color: #1f2937; margin-bottom: 6px;">
                        🛬 RETOUR - ${airlineName}
                    </div>
                    <div style="font-size: 14px; color: #374151; margin-bottom: 4px;">
                        ${scheduleInText}
                    </div>
                    ${(() => {
                        const layovers = extractLayoverInfo(flight, 1);
                        return layovers.length > 0 ? 
                            `<div style="font-size: 12px; color: #6b7280; margin-top: 4px; padding-left: 8px;">
                                🔄 Correspondances: ${layovers.map(l => `${l.airport} - ${l.duration} ${l.status}`).join(' • ')}
                            </div>` : '';
                    })()}
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
// FONCTIONS UTILITAIRES POUR AFFICHAGE
// ====================

function getAirlineNameFromCode(code) {
    const airlines = {
        'AF': 'Air France', 'LH': 'Lufthansa', 'BA': 'British Airways',
        'KL': 'KLM', 'SN': 'Brussels Airlines', 'FR': 'Ryanair',
        'U2': 'easyJet', 'EK': 'Emirates', 'QR': 'Qatar Airways',
        'AZ': 'ITA Airways', 'TK': 'Turkish Airlines', 'IB': 'Iberia',
        'VY': 'Vueling', 'W6': 'Wizz Air', 'DL': 'Delta', 'AA': 'American'
    };
    return airlines[code] || `${code} Airlines`;
}

/ ====================
// CORRECTION 1: Fonction formatDurationInternal - Version corrigée
// Remplacez votre fonction existante par celle-ci
// ====================

function formatDurationInternal(duration) {
    if (!duration) return 'N/A';
    
    console.log('Formatage durée input:', duration);
    
    try {
        // CORRECTION: Traitement correct des formats Duffel PT1DT7H10M
        const durationStr = duration.toString().toLowerCase();
        
        if (durationStr.startsWith('pt') || durationStr.startsWith('p')) {
            let totalMinutes = 0;
            
            // Pattern pour extraire jours, heures et minutes
            const dayMatch = durationStr.match(/(\d+)d/);
            const hourMatch = durationStr.match(/(\d+)h/);
            const minMatch = durationStr.match(/(\d+)m(?!o)/); // Eviter "month"
            
            const days = dayMatch ? parseInt(dayMatch[1]) : 0;
            const hours = hourMatch ? parseInt(hourMatch[1]) : 0;
            const minutes = minMatch ? parseInt(minMatch[1]) : 0;
            
            console.log('Durée parsée:', { days, hours, minutes });
            
            // Convertir en heures et minutes totales
            const totalHours = (days * 24) + hours;
            
            let result;
            if (totalHours > 0) {
                result = `${totalHours}h${minutes.toString().padStart(2, '0')}m`;
            } else {
                result = `${minutes}min`;
            }
            
            console.log('Durée formatée:', result);
            return result;
        }
        
        // Format déjà lisible (15h30m, etc.)
        if (durationStr.includes('h')) {
            return duration;
        }
        
        return duration;
        
    } catch (error) {
        console.error('Erreur formatage durée:', error, 'Input:', duration);
        return duration; // Retourner tel quel si erreur
    }
}

function formatTimeFromISO(isoString) {
    if (!isoString) return 'N/A';
    
    try {
        const date = new Date(isoString);
        return date.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'UTC'
        });
    } catch (error) {
        console.warn('Erreur formatage heure:', isoString, error);
        return 'N/A';
    }
}

/ ====================
// CORRECTION 2: Fonction extractLayoverInfo - Version corrigée  
// Remplacez votre fonction existante par celle-ci
// ====================

function extractLayoverInfo(flight, sliceIndex) {
    const layovers = [];
    
    try {
        if (flight.duffelData && flight.duffelData.slices && flight.duffelData.slices[sliceIndex]) {
            const slice = flight.duffelData.slices[sliceIndex];
            const segments = slice.segments || [];
            
            console.log(`Analyse escales slice ${sliceIndex}:`, segments.length, 'segments');
            
            // Calculer les correspondances entre segments consécutifs
            for (let i = 0; i < segments.length - 1; i++) {
                const currentSegment = segments[i];
                const nextSegment = segments[i + 1];
                
                console.log(`Segment ${i} -> ${i + 1}:`);
                console.log('  Arrivée:', currentSegment.arriving_at);
                console.log('  Départ suivant:', nextSegment.departing_at);
                
                if (currentSegment.arriving_at && nextSegment.departing_at) {
                    const arrivalTime = new Date(currentSegment.arriving_at);
                    const departureTime = new Date(nextSegment.departing_at);
                    
                    // CORRECTION: Calcul correct de la différence
                    const layoverMilliseconds = departureTime.getTime() - arrivalTime.getTime();
                    const layoverMinutes = layoverMilliseconds / (1000 * 60);
                    
                    console.log(`  Temps d'escale: ${layoverMinutes} minutes`);
                    
                    // Vérification que le calcul est sensé (entre 30min et 24h)
                    if (layoverMinutes >= 30 && layoverMinutes <= 1440) {
                        let duration;
                        if (layoverMinutes < 60) {
                            duration = `${Math.round(layoverMinutes)}min`;
                        } else {
                            const hours = Math.floor(layoverMinutes / 60);
                            const mins = Math.round(layoverMinutes % 60);
                            if (mins > 0) {
                                duration = `${hours}h${mins.toString().padStart(2, '0')}m`;
                            } else {
                                duration = `${hours}h`;
                            }
                        }
                        
                        // Statut de la correspondance
                        let status = '✅'; // OK
                        if (layoverMinutes < 60) {
                            status = '⚠️'; // Court
                        } else if (layoverMinutes > 300) { // Plus de 5h
                            status = '⏰'; // Long
                        }
                        
                        layovers.push({
                            airport: currentSegment.destination?.iata_code || 'XXX',
                            airportName: currentSegment.destination?.name || 'Aéroport',
                            duration: duration,
                            durationMinutes: layoverMinutes,
                            status: status
                        });
                        
                        console.log(`  Escale ajoutée: ${currentSegment.destination?.iata_code} - ${duration} ${status}`);
                    } else {
                        console.warn(`  Durée d'escale anormale: ${layoverMinutes} minutes - ignorée`);
                    }
                } else {
                    console.warn(`  Données manquantes pour calculer l'escale ${i}->${i + 1}`);
                }
            }
        }
    } catch (error) {
        console.error('Erreur extraction escales:', error);
    }
    
    console.log(`Escales extraites pour slice ${sliceIndex}:`, layovers.length, layovers);
    return layovers;
}


// ====================
// SÉLECTION DE VOL - LOCAL
// ====================

function selectFlight(flightIndex) {
    console.log('Sélection du vol', flightIndex + 1, '- Traitement local');
    
    if (!bookingState.searchResults || !bookingState.searchResults[flightIndex]) {
        addMessage('❌ Erreur: vol non trouvé', false);
        return;
    }

    const selectedFlight = bookingState.searchResults[flightIndex];
    console.log('Vol sélectionné:', selectedFlight);
    
    bookingState.selectedFlight = selectedFlight;
    bookingState.currentStep = 'selected';
    
    showSelectedFlightSummary(selectedFlight);
}

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
                        <div style="font-size: 12px; color: #6b7280;">Prix par personne</div>
                    </div>
                </div>
                
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
    showPassengerForm();
}

// ====================
// FORMULAIRE PASSAGERS
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

function fillDummyData() {
    console.log('Remplissage avec données de test');
    
    try {
        const dummyData = {
            firstName: 'Jean',
            lastName: 'Dupont',
            dateOfBirth: '1985-06-15',
            gender: 'MALE',
            email: 'jean.dupont@example.com',
            phone: '+32 2 123 45 67',
            passportNumber: 'BE123456789'
        };
        
        const fields = {
            firstName: document.getElementById('firstName'),
            lastName: document.getElementById('lastName'),
            dateOfBirth: document.getElementById('dateOfBirth'),
            gender: document.getElementById('gender'),
            email: document.getElementById('email'),
            phone: document.getElementById('phone'),
            passportNumber: document.getElementById('passportNumber')
        };
        
        let filledCount = 0;
        
        for (const [fieldName, field] of Object.entries(fields)) {
            if (field && dummyData[fieldName]) {
                field.value = dummyData[fieldName];
                filledCount++;
                
                field.style.backgroundColor = '#dcfce7';
                field.style.transition = 'background-color 0.5s ease';
                
                setTimeout(() => {
                    field.style.backgroundColor = '';
                    setTimeout(() => {
                        field.style.transition = '';
                    }, 500);
                }, 1500);
            }
        }
        
        if (filledCount > 0) {
            addMessage(`✅ Formulaire pré-rempli avec données de test (${filledCount} champs)`, false);
        } else {
            addMessage('❌ Impossible de pré-remplir - Formulaire non trouvé', false);
        }
        
    } catch (error) {
        console.error('Erreur remplissage données test:', error);
        addMessage('❌ Erreur lors du remplissage: ' + error.message, false);
    }
}

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

    const errors = validatePassengerData(formData);

    if (errors.length > 0) {
        addMessage('❌ Erreurs dans le formulaire:\n• ' + errors.join('\n• '), false);
        return;
    }

    const passengerData = safeGetPassengerData(formData);
    console.log('Données passager validées:', passengerData.fullName);

    bookingState.passengers = [passengerData];
    bookingState.contact = {
        email: formData.email,
        phone: formData.phone
    };
    bookingState.currentStep = 'confirm';
    
    addMessage('✅ Informations passager validées avec succès !', false);
    showBookingConfirmation();
}

function validatePassengerData(formData) {
    const errors = [];
    
    if (!formData.firstName || formData.firstName.length < 2) {
        errors.push('Prénom requis (minimum 2 caractères)');
    }
    
    if (!formData.lastName || formData.lastName.length < 2) {
        errors.push('Nom requis (minimum 2 caractères)');
    }
    
    if (!formData.dateOfBirth) {
        errors.push('Date de naissance requise');
    } else {
        const birthDate = new Date(formData.dateOfBirth);
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear();
        
        if (age < 0 || age > 120) {
            errors.push('Date de naissance invalide');
        }
    }
    
    if (!formData.gender || !['MALE', 'FEMALE'].includes(formData.gender)) {
        errors.push('Genre requis');
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email || !emailRegex.test(formData.email)) {
        errors.push('Email valide requis');
    }
    
    if (!formData.phone || formData.phone.length < 10) {
        errors.push('Téléphone valide requis');
    }
    
    if (!formData.passportNumber || formData.passportNumber.length < 6) {
        errors.push('Numéro de passeport requis (minimum 6 caractères)');
    }
    
    return errors;
}

// ====================
// CONFIRMATION DE RÉSERVATION
// ====================

function showBookingConfirmation() {
    console.log('Affichage confirmation réservation');
    
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

async function confirmBooking() {
    console.log('Confirmation finale - Contact backend');
    
    addMessage('🎯 Finalisation de votre réservation...', false);

    try {
        const passenger = safeGetPassengerData(bookingState.passengers?.[0]);
        const duffelOffer = extractDuffelData(bookingState.selectedFlight);
        
        const response = await fetch(API_ENDPOINTS.bookingConfirm, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sessionId: bookingState.sessionId,
                flightId: duffelOffer.id || bookingState.selectedFlight?.id,
                selectedFlight: {
                    ...bookingState.selectedFlight,
                    duffelData: duffelOffer
                },
                passengers: [{
                    firstName: passenger.firstName,
                    lastName: passenger.lastName,
                    name: {
                        firstName: passenger.firstName,
                        lastName: passenger.lastName
                    },
                    dateOfBirth: passenger.dateOfBirth,
                    gender: passenger.gender,
                    passportNumber: passenger.passportNumber || ''
                }],
                contact: bookingState.contact,
                payment: {
                    method: 'simulation',
                    status: 'pending'
                },
                metadata: {
                    bookingSource: 'web_simplified',
                    timestamp: new Date().toISOString()
                }
            })
        });

        const data = await response.json();
        console.log('Réponse confirmation:', data);

        if (data.success || data.webResponse?.success) {
            bookingState.currentStep = 'completed';
            
            const finalResponse = data.webResponse || data;
            if (finalResponse.html) {
                addMessage(finalResponse.html, false, true);
            } else {
                showBookingSuccess(data);
            }
            
        } else {
            const errorMsg = data.message || 'Erreur lors de la confirmation.';
            addMessage(`❌ ${errorMsg}`, false);
        }

    } catch (error) {
        console.error('Erreur confirmation:', error);
        addMessage('❌ Erreur de connexion. Veuillez réessayer.', false);
    }
}

function showBookingSuccess(data) {
    const passenger = safeGetPassengerData(bookingState.passengers?.[0]);
    const pricing = safeGetPricing(bookingState.selectedFlight);
    const confirmationNumber = data.confirmationNumber || `WEB${Date.now()}`;
    
    const successHtml = `
        <div style="background: linear-gradient(135deg, #059669, #10b981); color: white; border-radius: 16px; padding: 25px; margin: 15px 0;">
            <div style="text-align: center; margin-bottom: 25px;">
                <div style="font-size: 24px; margin-bottom: 10px;">🎉</div>
                <div style="font-size: 20px; font-weight: bold;">Réservation Confirmée !</div>
                <div style="font-size: 14px; opacity: 0.9;">Numéro: ${confirmationNumber}</div>
            </div>
            
            <div style="background: white; color: #1f2937; border-radius: 12px; padding: 20px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <div style="background: #ecfdf5; color: #065f46; padding: 12px; border-radius: 8px; margin-bottom: 15px;">
                        <strong>✅ Votre vol est réservé</strong><br>
                        Email de confirmation envoyé à ${bookingState.contact.email}
                    </div>
                </div>
                
                <div style="display: flex; gap: 10px; justify-content: center; margin-top: 20px;">
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

// ====================
// FONCTIONS DE TEST ET DEBUG
// ====================

async function testConnection() {
    console.log('Test de connectivité n8n...');
    addMessage('🔧 Test de connexion en cours...', false);
    
    try {
        const response = await fetch(API_ENDPOINTS.search, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: "Test de connectivité",
                sessionId: 'test-' + Date.now()
            }),
            signal: AbortSignal.timeout(10000)
        });
        
        if (response.ok) {
            addMessage('✅ Connexion n8n réussie !', false);
            addMessage(`📡 Status: ${response.status} ${response.statusText}`, false);
        } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
    } catch (error) {
        console.error('Test connection error:', error);
        addMessage('❌ Test de connexion échoué: ' + error.message, false);
    }
}

// ====================
// INITIALISATION
// ====================

document.addEventListener('DOMContentLoaded', function() {
    console.log('Flight Bot Interface initialisée - Version Complète');
    
    const userMessageInput = document.getElementById('userMessage');
    const sendButton = document.getElementById('sendButton');
    
    if (userMessageInput) {
        userMessageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                searchFlights();
            }
        });
        
        userMessageInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 120) + 'px';
            
            if (sendButton) {
                sendButton.disabled = this.value.trim().length === 0;
            }
        });
    }
    
    if (sendButton) {
        sendButton.disabled = true;
    }
    
    // Message de bienvenue
    addMessage('Bonjour ! Je suis votre assistant de réservation de vols intelligent. Décrivez-moi votre voyage en langage naturel !', false);
    
    // Bouton de test
    const testButtonHtml = `
        <div style="text-align: center; margin: 10px 0; padding: 10px; background: #f0f9ff; border-radius: 8px;">
            <div style="font-size: 12px; color: #1e40af; margin-bottom: 8px;">
                <strong>🔧 Outils de diagnostic</strong>
            </div>
            <button onclick="testConnection()" 
                    style="background: #3b82f6; color: white; border: none; padding: 6px 12px; border-radius: 12px; cursor: pointer;">
                🧪 Test connexion
            </button>
        </div>
    `;
    addMessage(testButtonHtml, false, true);
    
    console.log('✅ Interface initialisée avec succès');
});
