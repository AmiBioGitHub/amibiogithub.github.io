// Flight Bot - Interface Web JavaScript - Version UX Optimisée
console.log('Flight Bot Interface - Version UX Optimisée démarrée');

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

// ===================================
// SYSTÈME DE MESSAGES ET AUTO-SCROLL OPTIMISÉ
// ===================================

class MessageManager {
    constructor() {
        this.chatContainer = document.getElementById('chatContainer');
        this.scrollTimeout = null;
    }

    addMessage(content, isUser = false, isHtml = false) {
        if (!this.chatContainer) {
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
        this.chatContainer.appendChild(messageDiv);
        
        // Auto-scroll optimisé avec gestion des doublons
        this.scheduleScroll();
    }

    scheduleScroll(delay = 200) {
        // Annuler le scroll précédent pour éviter les conflits
        if (this.scrollTimeout) {
            clearTimeout(this.scrollTimeout);
        }

        this.scrollTimeout = setTimeout(() => {
            if (this.chatContainer) {
                // Attendre que le DOM soit stable
                requestAnimationFrame(() => {
                    this.chatContainer.scrollTo({
                        top: this.chatContainer.scrollHeight,
                        behavior: 'smooth'
                    });
                });
            }
        }, delay);
    }

    forceScroll(delay = 500) {
        // Pour les éléments complexes comme les formulaires
        this.scheduleScroll(delay);
    }
}

// Instance globale du gestionnaire de messages
const messageManager = new MessageManager();

// Fonction globale pour compatibilité
function addMessage(content, isUser = false, isHtml = false) {
    messageManager.addMessage(content, isUser, isHtml);
}

// ===================================
// GESTION DES INPUTS ET INTERFACE
// ===================================

class InputManager {
    constructor() {
        this.messageInput = document.getElementById('userMessage');
        this.sendButton = document.getElementById('sendButton');
        this.isProcessing = false;
    }

    initialize() {
        if (this.messageInput) {
            // Gestion de l'auto-resize
            this.messageInput.addEventListener('input', () => {
                this.resizeInput();
                this.updateSendButton();
            });

            // Gestion de la touche Enter
            this.messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey && !this.isProcessing) {
                    e.preventDefault();
                    this.handleSubmit();
                }
            });
        }

        if (this.sendButton) {
            this.sendButton.addEventListener('click', () => {
                if (!this.isProcessing) {
                    this.handleSubmit();
                }
            });
        }

        this.updateSendButton();
    }

    resizeInput() {
        if (this.messageInput) {
            this.messageInput.style.height = 'auto';
            this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 120) + 'px';
        }
    }

    updateSendButton() {
        if (this.sendButton && this.messageInput) {
            const hasText = this.messageInput.value.trim().length > 0;
            this.sendButton.disabled = !hasText || this.isProcessing;
            
            // Feedback visuel
            if (this.isProcessing) {
                this.sendButton.innerHTML = '⏳';
                this.sendButton.style.cursor = 'not-allowed';
            } else {
                this.sendButton.innerHTML = '➤';
                this.sendButton.style.cursor = hasText ? 'pointer' : 'not-allowed';
            }
        }
    }

    clearInput() {
        if (this.messageInput) {
            this.messageInput.value = '';
            this.resizeInput();
            this.updateSendButton();
        }
    }

    setProcessing(isProcessing) {
        this.isProcessing = isProcessing;
        this.updateSendButton();
        
        if (this.messageInput) {
            this.messageInput.disabled = isProcessing;
        }
    }

    handleSubmit() {
        const message = this.messageInput?.value?.trim();
        if (message && !this.isProcessing) {
            searchFlights();
        }
    }
}

// Instance globale du gestionnaire d'input
const inputManager = new InputManager();

// ===================================
// FONCTIONS UTILITAIRES
// ===================================

function safeGetPricing(flightData) {
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
            break;
        }
    }

    if (!finalPrice) {
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

function formatDurationInternal(duration) {
    if (!duration) return 'N/A';
    
    try {
        const durationStr = duration.toString().toLowerCase();
        
        if (durationStr.startsWith('pt') || durationStr.startsWith('p')) {
            const dayMatch = durationStr.match(/(\d+)d/);
            const hourMatch = durationStr.match(/(\d+)h/);
            const minMatch = durationStr.match(/(\d+)m(?!o)/);
            
            const days = dayMatch ? parseInt(dayMatch[1]) : 0;
            const hours = hourMatch ? parseInt(hourMatch[1]) : 0;
            const minutes = minMatch ? parseInt(minMatch[1]) : 0;
            
            const totalHours = (days * 24) + hours;
            
            if (totalHours > 0) {
                return `${totalHours}h${minutes.toString().padStart(2, '0')}m`;
            } else {
                return `${minutes}min`;
            }
        }
        
        if (durationStr.includes('h')) {
            return duration;
        }
        
        return duration;
    } catch (error) {
        console.error('Erreur formatage durée:', error);
        return duration;
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
        console.warn('Erreur formatage heure:', isoString);
        return 'N/A';
    }
}

function extractLayoverInfo(flight, sliceIndex) {
    const layovers = [];
    
    try {
        if (flight.duffelData?.slices?.[sliceIndex]) {
            const slice = flight.duffelData.slices[sliceIndex];
            const segments = slice.segments || [];
            
            for (let i = 0; i < segments.length - 1; i++) {
                const currentSegment = segments[i];
                const nextSegment = segments[i + 1];
                
                if (currentSegment.arriving_at && nextSegment.departing_at) {
                    const arrivalTime = new Date(currentSegment.arriving_at);
                    const departureTime = new Date(nextSegment.departing_at);
                    const layoverMinutes = (departureTime.getTime() - arrivalTime.getTime()) / (1000 * 60);
                    
                    if (layoverMinutes >= 30 && layoverMinutes <= 1440) {
                        let duration;
                        if (layoverMinutes < 60) {
                            duration = `${Math.round(layoverMinutes)}min`;
                        } else {
                            const hours = Math.floor(layoverMinutes / 60);
                            const mins = Math.round(layoverMinutes % 60);
                            duration = mins > 0 ? `${hours}h${mins.toString().padStart(2, '0')}m` : `${hours}h`;
                        }
                        
                        let status = '✅';
                        if (layoverMinutes < 60) status = '⚠️';
                        else if (layoverMinutes > 300) status = '⏰';
                        
                        layovers.push({
                            airport: currentSegment.destination?.iata_code || 'XXX',
                            duration: duration,
                            status: status
                        });
                    }
                }
            }
        }
    } catch (error) {
        console.error('Erreur extraction escales:', error);
    }
    
    return layovers;
}

function fillExample(text) {
    if (inputManager.messageInput) {
        inputManager.messageInput.value = text;
        inputManager.messageInput.focus();
        inputManager.resizeInput();
        inputManager.updateSendButton();
    }
}

// ===================================
// RECHERCHE DE VOLS
// ===================================

async function searchFlights() {
    const userMessage = inputManager.messageInput?.value?.trim();
    
    if (!userMessage) {
        addMessage('Veuillez entrer votre recherche de vol.', false);
        return;
    }

    console.log('=== DÉBUT RECHERCHE ===');
    console.log('Message utilisateur:', userMessage);
    
    // Interface feedback
    inputManager.setProcessing(true);
    addMessage(userMessage, true);
    addMessage('🔍 Analyse de votre demande...', false);
    
    // Nettoyer l'input immédiatement
    inputManager.clearInput();

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
            signal: AbortSignal.timeout(60000) // 60 secondes
        });

        if (!response.ok) {
            throw new Error(`Erreur serveur: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Données reçues:', data);

        if (data.success && data.bestFlights?.length > 0) {
            displayFlightResults(data);
        } else {
            const errorMsg = data.message || 'Aucun vol trouvé pour votre recherche.';
            addMessage('❌ ' + errorMsg, false);
            
            if (data.suggestions?.length > 0) {
                addMessage('💡 Suggestions:\n• ' + data.suggestions.join('\n• '), false);
            }
        }

    } catch (error) {
        console.error('Erreur recherche:', error);
        
        let errorMessage = '❌ ';
        if (error.name === 'AbortError') {
            errorMessage += 'Délai d\'attente dépassé - Le serveur met trop de temps à répondre';
        } else if (error.message.includes('404')) {
            errorMessage += 'Service non trouvé - Vérifiez votre configuration n8n';
        } else if (error.message.includes('500')) {
            errorMessage += 'Erreur serveur - Vérifiez les logs de votre workflow';
        } else {
            errorMessage += 'Problème de connexion - Vérifiez que le workflow n8n est actif';
        }
        
        addMessage(errorMessage, false);
        
        // Bouton de retry
        setTimeout(() => {
            const retryHtml = `
                <div style="text-align: center; margin: 15px 0;">
                    <button onclick="testConnection()" 
                            style="background: #f59e0b; color: white; border: none; padding: 8px 16px; border-radius: 12px; cursor: pointer;">
                        🧪 Tester la connexion
                    </button>
                </div>
            `;
            addMessage(retryHtml, false, true);
        }, 1000);
        
    } finally {
        inputManager.setProcessing(false);
    }
}

// ===================================
// AFFICHAGE DES RÉSULTATS DE VOL
// ===================================

function displayFlightResults(data) {
    const flights = data.bestFlights || [];
    const searchParams = data.searchParams || {};
    
    if (flights.length === 0) {
        addMessage('Aucun vol trouvé pour votre recherche.', false);
        return;
    }
    
    let resultsHtml = `
        <div style="background: linear-gradient(135deg, #1e40af, #3b82f6); color: white; border-radius: 16px; padding: 20px; margin: 15px 0;">
            <div style="text-align: center; margin-bottom: 15px;">
                <div style="font-size: 20px; font-weight: bold;">✈️ ${flights.length} Vols Disponibles</div>
                <div style="font-size: 14px; opacity: 0.9;">
                    ${searchParams.originCity || searchParams.originLocationCode || 'Origine'} → ${searchParams.destinationCity || searchParams.destinationLocationCode || 'Destination'}
                    ${searchParams.departureDate ? ` | ${new Date(searchParams.departureDate).toLocaleDateString('fr-FR')}` : ''}
                    ${searchParams.returnDate ? ` | Retour: ${new Date(searchParams.returnDate).toLocaleDateString('fr-FR')}` : ''}
                </div>
            </div>
    `;

    flights.forEach((flight, index) => {
        resultsHtml += createFlightCard(flight, index);
    });

    resultsHtml += '</div>';
    
    // Sauvegarder les résultats
    bookingState.searchResults = flights;
    bookingState.searchParams = searchParams;
    
    addMessage(resultsHtml, false, true);
}

function createFlightCard(flight, index) {
    // Extraction des données
    const pricing = safeGetPricing(flight);
    const score = Math.min(Math.max(flight.score || flight.aiAnalysis?.score || 70, 0), 100);
    const medalEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅';
    
    // Compagnie aérienne
    let airlineName = 'Compagnie aérienne';
    if (flight.airline?.name) {
        airlineName = flight.airline.name;
    } else if (flight.validatingAirlineCodes?.[0]) {
        airlineName = getAirlineNameFromCode(flight.validatingAirlineCodes[0]);
    } else if (flight.duffelData?.slices?.[0]?.segments?.[0]) {
        const segment = flight.duffelData.slices[0].segments[0];
        airlineName = segment.marketing_carrier?.name || segment.operating_carrier?.name || 'Compagnie';
    }
    
    // Horaires aller
    const outboundInfo = extractFlightInfo(flight, 0);
    const inboundInfo = extractFlightInfo(flight, 1);
    
    return `
        <div style="background: white; color: #1f2937; border-radius: 12px; padding: 18px; margin: 10px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border: 1px solid #e5e7eb;">
            
            <!-- En-tête -->
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
            ${createFlightSegmentHtml(outboundInfo, '🛫 ALLER', airlineName)}
            
            <!-- Vol RETOUR (si existe) -->
            ${inboundInfo.exists ? createFlightSegmentHtml(inboundInfo, '🛬 RETOUR', airlineName) : ''}
            
            <!-- Bouton de sélection -->
            <div style="text-align: center; margin-top: 15px;">
                <button onclick="selectFlight(${index})" 
                        style="background: linear-gradient(135deg, #059669, #047857); color: white; border: none; padding: 10px 20px; border-radius: 20px; font-weight: 600; cursor: pointer; font-size: 14px; transition: transform 0.2s;">
                    ✈️ Sélectionner ce vol
                </button>
            </div>
        </div>
    `;
}

function extractFlightInfo(flight, sliceIndex) {
    const info = {
        exists: false,
        departure: { time: 'N/A', airport: 'N/A' },
        arrival: { time: 'N/A', airport: 'N/A' },
        duration: 'N/A',
        layovers: []
    };
    
    try {
        // Source 1: données formatées
        if (sliceIndex === 0 && flight.schedule) {
            info.exists = true;
            info.departure.time = flight.schedule.departure || 'N/A';
            info.arrival.time = flight.schedule.arrival || 'N/A';
            info.duration = formatDurationInternal(flight.schedule.duration);
            return info;
        }
        
        if (sliceIndex === 1 && flight.inbound) {
            info.exists = true;
            info.departure.time = flight.inbound.departure || 'N/A';
            info.arrival.time = flight.inbound.arrival || 'N/A';
            info.duration = formatDurationInternal(flight.inbound.duration);
            return info;
        }
        
        // Source 2: données Duffel natives
        if (flight.duffelData?.slices?.[sliceIndex]) {
            const slice = flight.duffelData.slices[sliceIndex];
            const segments = slice.segments || [];
            
            if (segments.length > 0) {
                info.exists = true;
                const firstSegment = segments[0];
                const lastSegment = segments[segments.length - 1];
                
                info.departure.time = formatTimeFromISO(firstSegment.departing_at);
                info.departure.airport = firstSegment.origin?.iata_code || 'XXX';
                info.arrival.time = formatTimeFromISO(lastSegment.arriving_at);
                info.arrival.airport = lastSegment.destination?.iata_code || 'XXX';
                info.duration = formatDurationInternal(slice.duration);
                info.layovers = extractLayoverInfo(flight, sliceIndex);
            }
        }
    } catch (error) {
        console.error(`Erreur extraction info vol slice ${sliceIndex}:`, error);
    }
    
    return info;
}

function createFlightSegmentHtml(segmentInfo, title, airlineName) {
    if (!segmentInfo.exists) return '';
    
    const stops = segmentInfo.layovers?.length || 0;
    const stopsText = stops > 0 ? ` | ${stops} escale${stops > 1 ? 's' : ''}` : '';
    
    let html = `
        <div style="margin: 8px 0; padding: 8px 0; border-left: 3px solid ${title.includes('ALLER') ? '#3b82f6' : '#8b5cf6'}; padding-left: 12px;">
            <div style="font-size: 14px; font-weight: 600; color: #1f2937; margin-bottom: 6px;">
                ${title} - ${airlineName}
            </div>
            <div style="font-size: 14px; color: #374151; margin-bottom: 4px;">
                ${segmentInfo.departure.time} ${segmentInfo.departure.airport} → ${segmentInfo.arrival.time} ${segmentInfo.arrival.airport} | ${segmentInfo.duration}${stopsText}
            </div>
    `;
    
    if (segmentInfo.layovers?.length > 0) {
        const layoverTexts = segmentInfo.layovers.map(l => `${l.airport} - ${l.duration} ${l.status}`);
        html += `
            <div style="font-size: 12px; color: #6b7280; margin-top: 4px; padding-left: 8px;">
                🔄 Correspondances: ${layoverTexts.join(' • ')}
            </div>
        `;
    }
    
    html += '</div>';
    return html;
}

// ===================================
// SÉLECTION ET NAVIGATION
// ===================================

function selectFlight(flightIndex) {
    console.log('Sélection du vol', flightIndex + 1);
    
    if (!bookingState.searchResults?.[flightIndex]) {
        addMessage('❌ Erreur: vol non trouvé', false);
        return;
    }

    const selectedFlight = bookingState.searchResults[flightIndex];
    bookingState.selectedFlight = selectedFlight;
    bookingState.currentStep = 'selected';
    
    showSelectedFlightSummary(selectedFlight);
    
    // Auto-scroll avec délai approprié pour le rendu
    messageManager.forceScroll(600);
}

function showSelectedFlightSummary(selectedFlight) {
    const pricing = safeGetPricing(selectedFlight);
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
                            style="background: #6b7280; color: white; border: none; padding: 12px 24px; border-radius: 20px; font-weight: 600; cursor: pointer; transition: background-color 0.2s;">
                        ← Changer de vol
                    </button>
                    <button onclick="proceedToPassengerForm()" 
                            style="background: linear-gradient(135deg, #7c3aed, #8b5cf6); color: white; border: none; padding: 12px 30px; border-radius: 20px; font-weight: 600; cursor: pointer; transition: transform 0.2s;">
                        👤 Continuer vers passagers
                    </button>
                </div>
            </div>
        </div>
    `;
    
    addMessage(summaryHtml, false, true);
}

function goBackToResults() {
    bookingState.currentStep = 'search';
    bookingState.selectedFlight = null;
    
    addMessage('Voici à nouveau les vols disponibles :', false);
    
    if (bookingState.searchResults?.length > 0) {
        displayFlightResults({
            bestFlights: bookingState.searchResults,
            searchParams: bookingState.searchParams
        });
    }
}

function proceedToPassengerForm() {
    bookingState.currentStep = 'passengers';
    showPassengerForm();
    messageManager.forceScroll(700); // Délai plus long pour le formulaire
}

// ===================================
// FORMULAIRE PASSAGERS
// ===================================

function showPassengerForm() {
    const pricing = safeGetPricing(bookingState.selectedFlight);
    
    const formHtml = `
        <div style="background: linear-gradient(135deg, #7c3aed, #8b5cf6); color: white; border-radius: 16px; padding: 20px; margin: 15px 0;">
            <div style="text-align: center; margin-bottom: 20px;">
                <div style="font-size: 20px; font-weight: bold;">👤 Informations Passager</div>
                <div style="font-size: 14px; opacity: 0.9;">Prix confirmé: ${pricing.formatted}</div>
            </div>
            
            <div style="background: white; color: #1f2937; border-radius: 12px; padding: 20px;">
                <div style="text-align: center; margin-bottom: 15px; padding: 10px; background: #fef3c7; border-radius: 8px;">
                    <div style="font-size: 12px; color: #92400e; margin-bottom: 8px;">
                        <strong>🧪 MODE TEST</strong> - Remplissage automatique
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
        
        Object.entries(fields).forEach(([fieldName, field]) => {
            if (field && dummyData[fieldName]) {
                field.value = dummyData[fieldName];
                filledCount++;
                
                // Animation de feedback
                field.style.backgroundColor = '#dcfce7';
                field.style.transition = 'background-color 0.5s ease';
                
                setTimeout(() => {
                    field.style.backgroundColor = '';
                }, 1500);
            }
        });
        
        if (filledCount > 0) {
            addMessage(`✅ Formulaire pré-rempli avec données de test (${filledCount} champs)`, false);
        }
        
    } catch (error) {
        console.error('Erreur remplissage données test:', error);
        addMessage('❌ Erreur lors du remplissage des données test', false);
    }
}

function submitPassengerData() {
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

    bookingState.passengers = [formData];
    bookingState.contact = { email: formData.email, phone: formData.phone };
    bookingState.currentStep = 'confirm';
    
    addMessage('✅ Informations validées avec succès !', false);
    showBookingConfirmation();
    messageManager.forceScroll(600);
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

// ===================================
// CONFIRMATION DE RÉSERVATION
// ===================================

function showBookingConfirmation() {
    const pricing = safeGetPricing(bookingState.selectedFlight);
    const passenger = bookingState.passengers[0];
    
    const confirmationHtml = `
        <div style="background: linear-gradient(135deg, #dc2626, #ef4444); color: white; border-radius: 16px; padding: 20px; margin: 15px 0;">
            <div style="text-align: center; margin-bottom: 20px;">
                <div style="font-size: 20px; font-weight: bold;">🎯 Confirmation de Réservation</div>
                <div style="font-size: 14px; opacity: 0.9;">Dernière étape avant la réservation</div>
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
                        ${passenger.firstName} ${passenger.lastName}<br>
                        ${passenger.email}
                    </div>
                </div>
                
                <div style="background: #fef3c7; padding: 12px; border-radius: 8px; margin: 15px 0;">
                    <div style="font-size: 13px; color: #92400e;">
                        <strong>⚠️ Simulation de réservation</strong><br>
                        Démonstration - Réservation via n8n/Duffel
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
    addMessage('🎯 Finalisation de votre réservation...', false);
    inputManager.setProcessing(true);

    try {
        const response = await fetch(API_ENDPOINTS.bookingConfirm, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: bookingState.sessionId,
                flightId: bookingState.selectedFlight?.id,
                selectedFlight: bookingState.selectedFlight,
                passengers: bookingState.passengers,
                contact: bookingState.contact,
                metadata: {
                    bookingSource: 'web_optimized',
                    timestamp: new Date().toISOString()
                }
            })
        });

        const data = await response.json();

        if (data.success || data.webResponse?.success) {
            bookingState.currentStep = 'completed';
            const finalResponse = data.webResponse || data;
            
            if (finalResponse.html) {
                addMessage(finalResponse.html, false, true);
            } else {
                showBookingSuccess(data);
            }
        } else {
            addMessage(`❌ ${data.message || 'Erreur lors de la confirmation'}`, false);
        }

    } catch (error) {
        console.error('Erreur confirmation:', error);
        addMessage('❌ Erreur de connexion. Veuillez réessayer.', false);
    } finally {
        inputManager.setProcessing(false);
    }
}

function showBookingSuccess(data) {
    const passenger = bookingState.passengers[0];
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
                    <div style="background: #ecfdf5; color: #065f46; padding: 12px; border-radius: 8px;">
                        <strong>✅ Votre vol est réservé</strong><br>
                        Confirmation envoyée à ${bookingState.contact.email}
                    </div>
                </div>
                
                <div style="display: flex; gap: 10px; justify-content: center;">
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
    
    inputManager.setProcessing(false);
    addMessage('Nouvelle recherche initialisée. Que puis-je vous aider à trouver ?', false);
}

// ===================================
// FONCTIONS DE TEST
// ===================================

async function testConnection() {
    addMessage('🔧 Test de connexion en cours...', false);
    inputManager.setProcessing(true);
    
    try {
        const response = await fetch(API_ENDPOINTS.search, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
    } finally {
        inputManager.setProcessing(false);
    }
}

// ===================================
// INITIALISATION
// ===================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('Flight Bot Interface UX Optimisée initialisée');
    
    // Initialiser les gestionnaires
    inputManager.initialize();
    
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
    
    console.log('✅ Interface UX optimisée prête');
});
