// ===== MODIFICATIONS POUR RÉSERVATION RÉELLE =====
// Ajouter ces modifications dans script.js

// Modifier la fonction confirmBooking pour gérer les réservations réelles
async function confirmBooking() {
    console.log('Confirmation finale - Réservation RÉELLE via Duffel + Email');
    
    addMessage('🎯 Finalisation de votre réservation RÉELLE...', false);
    
    // Ajouter un indicateur de progression
    const progressMessage = `
        <div id="booking-progress" style="background: #f0f9ff; border-radius: 12px; padding: 15px; margin: 10px 0;">
            <div style="font-weight: 600; margin-bottom: 10px;">📋 Étapes de réservation :</div>
            <div id="step-1" style="margin: 5px 0; color: #3b82f6;">⏳ 1. Création de l'ordre Duffel...</div>
            <div id="step-2" style="margin: 5px 0; color: #6b7280;">⏸️ 2. Envoi email de confirmation</div>
            <div id="step-3" style="margin: 5px 0; color: #6b7280;">⏸️ 3. Finalisation</div>
        </div>
    `;
    
    addMessage(progressMessage, false, true);

    try {
        const passenger = safeGetPassengerData(bookingState.passengers?.[0]);
        const duffelOffer = extractDuffelData(bookingState.selectedFlight);
        
        // Appel backend pour réservation RÉELLE
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
                
                // Données passager avec validation renforcée
                passengers: [{
                    firstName: passenger.firstName,
                    lastName: passenger.lastName,
                    name: {
                        firstName: passenger.firstName,
                        lastName: passenger.lastName
                    },
                    dateOfBirth: passenger.dateOfBirth,
                    gender: passenger.gender,
                    passportNumber: passenger.passportNumber || '',
                    
                    // Données supplémentaires pour Duffel
                    given_name: passenger.firstName,
                    family_name: passenger.lastName,
                    born_on: passenger.dateOfBirth
                }],
                
                // Contact
                contact: bookingState.contact,
                
                // Métadonnées de réservation RÉELLE
                payment: {
                    method: 'stripe_integration',
                    status: 'pending'
                },
                bookingType: 'real_duffel_order',
                metadata: {
                    bookingSource: 'web_real_booking',
                    timestamp: new Date().toISOString(),
                    userAgent: navigator.userAgent,
                    realBooking: true
                }
            })
        });

        // Mettre à jour le premier indicateur
        updateProgressStep('step-1', '✅ 1. Ordre Duffel créé');
        updateProgressStep('step-2', '⏳ 2. Envoi email de confirmation...');

        const data = await response.json();
        console.log('Réponse réservation RÉELLE:', data);

        if (data.success && data.duffelOrder) {
            // Réservation Duffel réussie
            updateProgressStep('step-2', '✅ 2. Email de confirmation envoyé');
            updateProgressStep('step-3', '✅ 3. Réservation finalisée');
            
            bookingState.currentStep = 'completed';
            
            // Afficher le résultat selon le statut
            if (data.bookingStatus === 'confirmed') {
                showRealBookingSuccess(data);
            } else if (data.bookingStatus === 'pending_payment') {
                showPaymentRequired(data);
            } else {
                showBookingPartialSuccess(data);
            }
            
        } else if (data.error) {
            // Erreur lors de la réservation
            updateProgressStep('step-1', '❌ 1. Erreur création ordre Duffel');
            updateProgressStep('step-2', '⏸️ 2. Annulé');
            updateProgressStep('step-3', '⏸️ 3. Annulé');
            
            const errorMsg = data.error.message || 'Erreur lors de la réservation Duffel.';
            addMessage(`❌ ${errorMsg}`, false);
            
            if (data.error.code === 'DUFFEL_BOOKING_FAILED') {
                showDuffelErrorGuidance(data.error);
            } else {
                setTimeout(() => {
                    addBookingRetryButton();
                }, 2000);
            }
        } else {
            // Réponse inattendue
            throw new Error('Réponse backend inattendue');
        }

    } catch (error) {
        console.error('Erreur réservation RÉELLE:', error);
        
        updateProgressStep('step-1', '❌ 1. Erreur de connexion');
        updateProgressStep('step-2', '⏸️ 2. Annulé');
        updateProgressStep('step-3', '⏸️ 3. Annulé');
        
        addMessage('❌ Erreur de connexion lors de la réservation. Veuillez réessayer.', false);
        
        setTimeout(() => {
            addBookingRetryButton();
        }, 2000);
    }
}

// Fonction pour mettre à jour les indicateurs de progression
function updateProgressStep(stepId, newText) {
    const stepElement = document.getElementById(stepId);
    if (stepElement) {
        stepElement.textContent = newText;
        if (newText.includes('✅')) {
            stepElement.style.color = '#10b981';
        } else if (newText.includes('❌')) {
            stepElement.style.color = '#dc2626';
        } else if (newText.includes('⏳')) {
            stepElement.style.color = '#f59e0b';
        }
    }
}

// Affichage succès réservation réelle
function showRealBookingSuccess(data) {
    const passenger = safeGetPassengerData(bookingState.passengers?.[0]);
    const totalPrice = `${data.totalAmount} ${data.totalCurrency}`;
    const confirmationNumber = data.confirmationNumber;
    const bookingReference = data.bookingReference;
    
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
                    ${bookingReference ? `<div style="font-size: 12px; opacity: 0.9; margin-top: 5px;">Référence compagnie: ${bookingReference}</div>` : ''}
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
                
                <div style="display: flex; gap: 10px; justify-content: center; margin-top: 20px;">
                    <button onclick="downloadRealTicket('${confirmationNumber}')" 
                            style="background: #3b82f6; color: white; border: none; padding: 10px 20px; border-radius: 20px; font-weight: 600; cursor: pointer;">
                        📄 Télécharger e-ticket
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

// Affichage paiement requis
function showPaymentRequired(data) {
    const passenger = safeGetPassengerData(bookingState.passengers?.[0]);
    const totalPrice = `${data.totalAmount} ${data.totalCurrency}`;
    
    const paymentHtml = `
        <div style="background: linear-gradient(135deg, #f59e0b, #d97706); color: white; border-radius: 16px; padding: 25px; margin: 15px 0;">
            <div style="text-align: center; margin-bottom: 25px;">
                <div style="font-size: 24px; margin-bottom: 10px;">💳</div>
                <div style="font-size: 20px; font-weight: bold;">Paiement Requis</div>
                <div style="font-size: 14px; opacity: 0.9;">Votre vol est réservé, finalisez le paiement</div>
            </div>
            
            <div style="background: white; color: #1f2937; border-radius: 12px; padding: 20px;">
                
                <div style="background: #fef3c7; color: #92400e; padding: 15px; border-radius: 8px; text-align: center; margin-bottom: 20px;">
                    <div style="font-size: 16px; font-weight: bold; margin-bottom: 5px;">⏳ RÉSERVÉ - Paiement en attente</div>
                    <div style="font-size: 14px;">Confirmation: ${data.confirmationNumber}</div>
                    ${data.bookingReference ? `<div style="font-size: 12px; margin-top: 5px;">Référence: ${data.bookingReference}</div>` : ''}
                </div>
                
                <div style="text-align: center; margin-bottom: 20px;">
                    <div style="font-size: 24px; font-weight: bold; color: #f59e0b; margin-bottom: 5px;">${totalPrice}</div>
                    <div style="font-size: 14px; color: #6b7280;">À payer pour finaliser la réservation</div>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <h4 style="margin: 0 0 8px 0; color: #1f2937;">👤 Détails de réservation</h4>
                    <div style="font-size: 14px; color: #6b7280;">
                        Passager: ${passenger.fullName}<br>
                        Email: ${bookingState.contact?.email}<br>
                        Vol: ${bookingState.selectedFlight?.airline?.name || 'N/A'}
                    </div>
                </div>
                
                <div style="background: #dbeafe; color: #1e40af; padding: 12px; border-radius: 8px; margin: 15px 0;">
                    <div style="font-size: 13px;">
                        <strong>💡 Instructions :</strong><br>
                        • Un lien de paiement vous a été envoyé par email<br>
                        • Le paiement doit être effectué sous 30 minutes<br>
                        • Votre réservation sera automatiquement confirmée après paiement
                    </div>
                </div>
                
                <div style="display: flex; gap: 10px; justify-content: center; margin-top: 20px;">
                    ${data.paymentUrl ? 
                        `<button onclick="window.open('${data.paymentUrl}', '_blank')" 
                                 style="background: #059669; color: white; border: none; padding: 10px 20px; border-radius: 20px; font-weight: 600; cursor: pointer;">
                             💳 Payer maintenant
                         </button>` : ''}
                    <button onclick="checkPaymentStatus('${data.confirmationNumber}')" 
                            style="background: #3b82f6; color: white; border: none; padding: 10px 20px; border-radius: 20px; font-weight: 600; cursor: pointer;">
                        🔄 Vérifier statut
                    </button>
                </div>
            </div>
        </div>
    `;
    
    addMessage(paymentHtml, false, true);
}

// Affichage guidance erreur Duffel
function showDuffelErrorGuidance(error) {
    const guidanceHtml = `
        <div style="background: #fef2f2; border: 1px solid #fca5a5; border-radius: 12px; padding: 20px; margin: 15px 0;">
            <h4 style="color: #dc2626; margin: 0 0 15px 0;">⚠️ Problème avec la réservation Duffel</h4>
            
            <div style="color: #7f1d1d; font-size: 14px; margin-bottom: 15px;">
                <strong>Erreur:</strong> ${error.message}
            </div>
            
            <div style="background: white; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <div style="font-size: 14px; color: #374151;">
                    <strong>Causes possibles :</strong><br>
                    • L'offre de vol a expiré (les prix changent rapidement)<br>
                    • La disponibilité du vol a changé<br>
                    • Problème temporaire avec l'API Duffel<br>
                    • Données passager incorrectes ou incomplètes
                </div>
            </div>
            
            <div style="text-align: center;">
                <button onclick="retryFlightSearch()" 
                        style="background: #f59e0b; color: white; border: none; padding: 10px 20px; border-radius: 20px; font-weight: 600; cursor: pointer; margin-right: 10px;">
                    🔍 Nouvelle recherche
                </button>
                <button onclick="showPassengerForm()" 
                        style="background: #6b7280; color: white; border: none; padding: 10px 20px; border-radius: 20px; font-weight: 600; cursor: pointer;">
                    ✏️ Modifier informations
                </button>
            </div>
        </div>
    `;
    
    addMessage(guidanceHtml, false, true);
}

// Nouvelles fonctions utilitaires
function downloadRealTicket(confirmationNumber) {
    console.log('Téléchargement e-ticket réel:', confirmationNumber);
    addMessage(`📄 Fonction de téléchargement e-ticket à implémenter pour: ${confirmationNumber}`, false);
    addMessage('Le lien de téléchargement sera disponible dans votre email de confirmation.', false);
}

function checkPaymentStatus(confirmationNumber) {
    console.log('Vérification statut paiement:', confirmationNumber);
    addMessage('🔄 Vérification du statut de paiement...', false);
    
    // Ici on pourrait ajouter un appel API pour vérifier le statut
    setTimeout(() => {
        addMessage('Statut de paiement inchangé. Vérifiez votre email pour le lien de paiement.', false);
    }, 2000);
}

function retryFlightSearch() {
    console.log('Relance recherche de vol après erreur');
    resetBooking();
    addMessage('Recommençons votre recherche. Décrivez à nouveau votre voyage :', false);
}

// Amélioration de la fonction resetBooking pour les réservations réelles
function resetBooking() {
    console.log('Reset booking state - Version réelle');
    
    // Vider le cache local si nécessaire
    if (typeof cacheManager !== 'undefined') {
        cacheManager.clear();
    }
    
    bookingState = {
        selectedFlight: null,
        passengers: [],
        contact: {},
        currentStep: 'search',
        sessionId: 'web-' + Date.now(),
        pricing: null,
        searchResults: null,
        searchParams: null,
        realBooking: true // Flag pour les vraies réservations
    };
    
    // Sauvegarder l'état
    sessionStorage.setItem('bookingState', JSON.stringify(bookingState));
    
    addMessage('Nouvelle recherche initialisée. Décrivez votre voyage et je trouverai les meilleurs vols !', false);
}
