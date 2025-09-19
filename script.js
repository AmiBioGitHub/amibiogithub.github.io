// ====================
// AJOUT DE LA FONCTION DE TEST MANQUANTE
// ====================

// Fonction de test de connectivité n8n (référencée dans le HTML mais manquante)
async function testConnection() {
    console.log('Test de connectivité n8n...');
    addMessage('🔧 Test de connexion en cours...', false);
    
    try {
        const testPayload = {
            message: "Test de connectivité",
            sessionId: 'test-' + Date.now()
        };
        
        console.log('Test endpoint:', API_ENDPOINTS.search);
        console.log('Test payload:', testPayload);
        
        const response = await fetch(API_ENDPOINTS.search, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(testPayload),
            signal: AbortSignal.timeout(10000) // 10 secondes pour test
        });
        
        console.log('Test response status:', response.status);
        console.log('Test response headers:', [...response.headers.entries()]);
        
        if (response.ok) {
            const data = await response.json();
            console.log('Test response data:', data);
            
            addMessage('✅ Connexion n8n réussie !', false);
            addMessage(`📡 Status: ${response.status} ${response.statusText}`, false);
            addMessage(`🔗 Endpoint actif: ${API_ENDPOINTS.search}`, false);
            
            if (data.success) {
                addMessage('🎯 Workflow prêt à traiter les demandes', false);
            } else {
                addMessage('⚠️ Workflow répond mais avec erreurs possibles', false);
            }
            
        } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
    } catch (error) {
        console.error('Test connection error:', error);
        
        let errorMessage = '❌ Test de connexion échoué: ';
        
        if (error.name === 'AbortError') {
            errorMessage += 'Timeout (>10s) - Serveur trop lent';
        } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
            errorMessage += 'Réseau inaccessible - Vérifiez votre URL n8n';
        } else if (error.message.includes('404')) {
            errorMessage += 'Webhook non trouvé - Vérifiez l\'URL';
        } else if (error.message.includes('CORS')) {
            errorMessage += 'Problème CORS - Configurez les en-têtes n8n';
        } else {
            errorMessage += error.message;
        }
        
        addMessage(errorMessage, false);
        
        // Diagnostic détaillé
        addMessage('🔍 Diagnostic:', false);
        addMessage(`• URL testée: ${API_ENDPOINTS.search}`, false);
        addMessage(`• Méthode: POST`, false);
        addMessage(`• Headers: Content-Type: application/json`, false);
        addMessage(`• Timeout: 10 secondes`, false);
        
        // Suggestions de dépannage
        addMessage('💡 Vérifications suggérées:', false);
        addMessage('1. Workflow n8n est-il activé ?', false);
        addMessage('2. URL webhook correcte ?', false);
        addMessage('3. Headers CORS configurés ?', false);
        addMessage('4. Pare-feu/proxy bloquant ?', false);
    }
}

// ====================
// AMÉLIORATION DU LOGGING POUR DEBUG
// ====================

// Override de la fonction addMessage pour meilleur logging
const originalAddMessage = addMessage;
function addMessage(content, isUser = false, isHtml = false) {
    // Logging amélioré avec timestamp
    const timestamp = new Date().toLocaleTimeString();
    if (!isUser && !isHtml) {
        console.log(`[${timestamp}] BOT:`, content);
    } else if (isUser) {
        console.log(`[${timestamp}] USER:`, content);
    }
    
    // Appel fonction originale
    originalAddMessage(content, isUser, isHtml);
}

// ====================
// AMÉLIORATION DE LA GESTION D'ERREUR DANS searchFlights
// ====================

// Override de searchFlights avec meilleur diagnostic
async function searchFlights() {
    var userMessage = document.getElementById('userMessage').value.trim();
    
    if (!userMessage) {
        addMessage('Veuillez entrer votre recherche de vol.', false);
        return;
    }

    console.log('=== DÉBUT RECHERCHE ===');
    console.log('Message utilisateur:', userMessage);
    console.log('Session ID:', bookingState.sessionId);
    console.log('API endpoint:', API_ENDPOINTS.search);
    
    addMessage(userMessage, true);
    addMessage('🔍 Recherche en cours...', false);

    // Afficher l'indicateur de frappe
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
        typingIndicator.style.display = 'flex';
    }

    try {
        const requestPayload = {
            message: userMessage,
            sessionId: bookingState.sessionId,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent
        };
        
        console.log('Payload envoyé:', requestPayload);
        
        const response = await fetch(API_ENDPOINTS.search, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'FlightBot-WebApp/1.0'
            },
            body: JSON.stringify(requestPayload),
            signal: AbortSignal.timeout(45000) // 45 secondes pour recherche complète
        });

        console.log('Statut réponse:', response.status, response.statusText);
        console.log('Headers réponse:', [...response.headers.entries()]);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('=== RÉPONSE COMPLÈTE ===');
        console.log(JSON.stringify(data, null, 2));

        if (data.success && data.bestFlights && data.bestFlights.length > 0) {
            console.log(`✅ ${data.bestFlights.length} vols trouvés`);
            displayFlightResults(data);
        } else {
            console.log('❌ Aucun vol ou erreur:', data);
            const errorMsg = data.message || 'Aucun vol trouvé pour votre recherche.';
            addMessage('❌ ' + errorMsg, false);
            
            if (data.suggestions && data.suggestions.length > 0) {
                addMessage('💡 Suggestions:\n• ' + data.suggestions.join('\n• '), false);
            }
        }

        document.getElementById('userMessage').value = '';

    } catch (error) {
        console.error('=== ERREUR RECHERCHE ===');
        console.error('Type:', error.name);
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);
        
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
        
        // Debug info détaillé
        console.log('=== INFO DEBUG ===');
        console.log('URL testée:', API_ENDPOINTS.search);
        console.log('User message:', userMessage);
        console.log('Timestamp:', new Date().toISOString());
        
        // Proposer le test de connectivité
        setTimeout(() => {
            const debugHtml = `
                <div style="text-align: center; margin: 15px 0; padding: 12px; background: #fef3c7; border-radius: 8px;">
                    <div style="font-size: 14px; color: #92400e; margin-bottom: 8px;">
                        <strong>🔧 Diagnostic recommandé</strong>
                    </div>
                    <button onclick="testConnection()" 
                            style="background: #f59e0b; color: white; border: none; padding: 8px 16px; border-radius: 16px; cursor: pointer; margin-right: 8px;">
                        🧪 Tester la connexion
                    </button>
                    <button onclick="showDebugInfo()" 
                            style="background: #6b7280; color: white; border: none; padding: 8px 16px; border-radius: 16px; cursor: pointer;">
                        📊 Voir debug
                    </button>
                </div>
            `;
            addMessage(debugHtml, false, true);
        }, 1000);
        
    } finally {
        // Masquer l'indicateur de frappe
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) {
            typingIndicator.style.display = 'none';
        }
        
        console.log('=== FIN RECHERCHE ===');
    }
}

// ====================
// NOUVELLE FONCTION DEBUG INFO
// ====================

function showDebugInfo() {
    const debugInfo = {
        timestamp: new Date().toISOString(),
        sessionId: bookingState.sessionId,
        currentStep: bookingState.currentStep,
        userAgent: navigator.userAgent,
        apiEndpoint: API_ENDPOINTS.search,
        searchResults: bookingState.searchResults?.length || 0,
        selectedFlight: !!bookingState.selectedFlight,
        passengers: bookingState.passengers.length
    };
    
    console.log('=== DEBUG INFO COMPLÈTE ===');
    console.log(JSON.stringify(debugInfo, null, 2));
    
    const debugHtml = `
        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; font-family: monospace; font-size: 12px; max-height: 200px; overflow-y: auto;">
            <strong>🐛 Informations de debug:</strong><br><br>
            <strong>Session:</strong> ${debugInfo.sessionId}<br>
            <strong>Étape:</strong> ${debugInfo.currentStep}<br>
            <strong>API:</strong> ${debugInfo.apiEndpoint}<br>
            <strong>Résultats:</strong> ${debugInfo.searchResults} vols<br>
            <strong>Vol sélectionné:</strong> ${debugInfo.selectedFlight ? 'Oui' : 'Non'}<br>
            <strong>Passagers:</strong> ${debugInfo.passengers}<br>
            <strong>Navigateur:</strong> ${navigator.userAgent.substring(0, 50)}...<br>
            <strong>Timestamp:</strong> ${debugInfo.timestamp}<br>
        </div>
    `;
    
    addMessage(debugHtml, false, true);
}

// ====================
// AMÉLIORATION FONCTION DUMMY DATA
// ====================

// Fonction dummy data améliorée avec gestion d'erreur
function fillDummyData() {
    console.log('=== REMPLISSAGE DONNÉES TEST ===');
    
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
        let missingFields = [];
        
        for (const [fieldName, field] of Object.entries(fields)) {
            if (field && dummyData[fieldName]) {
                field.value = dummyData[fieldName];
                filledCount++;
                
                // Animation améliorée
                field.style.backgroundColor = '#dcfce7';
                field.style.transition = 'background-color 0.5s ease';
                
                setTimeout(() => {
                    field.style.backgroundColor = '';
                    setTimeout(() => {
                        field.style.transition = '';
                    }, 500);
                }, 1500);
                
                console.log(`✅ ${fieldName}: ${dummyData[fieldName]}`);
            } else {
                missingFields.push(fieldName);
                console.warn(`❌ Champ ${fieldName} non trouvé`);
            }
        }
        
        console.log(`Résultats: ${filledCount} champs remplis, ${missingFields.length} manquants`);
        
        if (filledCount > 0) {
            addMessage(`✅ Formulaire pré-rempli avec données de test (${filledCount}/${Object.keys(dummyData).length} champs)`, false);
            if (missingFields.length > 0) {
                addMessage(`⚠️ Champs non trouvés: ${missingFields.join(', ')}`, false);
            }
        } else {
            addMessage('❌ Impossible de pré-remplir - Formulaire non trouvé', false);
        }
        
    } catch (error) {
        console.error('Erreur remplissage données test:', error);
        addMessage('❌ Erreur lors du remplissage des données test: ' + error.message, false);
    }
}

// ====================
// AMÉLIORATION GESTION D'ERREURS GLOBALES
// ====================

// Gestionnaire d'erreur global pour capturer les erreurs non gérées
window.addEventListener('error', function(event) {
    console.error('Erreur JavaScript globale:', event.error);
    console.error('Source:', event.filename, 'Ligne:', event.lineno);
    
    // Ne pas spammer l'utilisateur, juste logger
    if (event.error.name !== 'AbortError') {
        addMessage('⚠️ Une erreur technique s\'est produite. Consultez la console pour plus de détails.', false);
    }
});

// Gestionnaire pour les promesses rejetées
window.addEventListener('unhandledrejection', function(event) {
    console.error('Promesse rejetée non gérée:', event.reason);
    
    // Éviter de montrer les erreurs de timeout/abort à l'utilisateur
    if (event.reason?.name !== 'AbortError') {
        console.warn('Promesse rejetée:', event.reason);
    }
});

// ====================
// FONCTIONS UTILITAIRES AMÉLIORÉES
// ====================

// Fonction pour valider l'URL de l'API
function validateApiUrl(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.protocol === 'https:' && urlObj.hostname.includes('n8n');
    } catch {
        return false;
    }
}

// Fonction pour nettoyer les anciens messages (éviter l'accumulation)
function cleanOldMessages() {
    const chatContainer = document.getElementById('chatContainer');
    const messages = chatContainer?.querySelectorAll('.message');
    
    // Garder seulement les 50 derniers messages
    if (messages && messages.length > 50) {
        for (let i = 0; i < messages.length - 50; i++) {
            messages[i].remove();
        }
        console.log(`Nettoyage: ${messages.length - 50} anciens messages supprimés`);
    }
}

// Fonction pour formater la taille des données
function formatDataSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ====================
// INITIALISATION AMÉLIORÉE
// ====================

document.addEventListener('DOMContentLoaded', function() {
    console.log('=== INITIALISATION FLIGHT BOT ===');
    console.log('Version: Simplifiée avec debug avancé');
    console.log('API Base URL:', API_BASE_URL);
    console.log('Endpoints configurés:', Object.keys(API_ENDPOINTS));
    
    // Validation de l'URL API
    if (!validateApiUrl(API_ENDPOINTS.search)) {
        console.warn('⚠️ URL API potentiellement invalide:', API_ENDPOINTS.search);
    }
    
    const userMessageInput = document.getElementById('userMessage');
    const sendButton = document.getElementById('sendButton');
    
    if (userMessageInput) {
        // Enter pour envoyer (avec Shift+Enter pour nouvelle ligne)
        userMessageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                searchFlights();
            }
        });
        
        // Auto-resize du textarea avec limites
        userMessageInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 120) + 'px';
            
            // Activer/désactiver le bouton selon le contenu
            if (sendButton) {
                sendButton.disabled = this.value.trim().length === 0;
            }
        });
        
        // Placeholder dynamique
        const placeholders = [
            "Vol Brussels Bangkok 15 mars",
            "Business Paris Tokyo aller-retour", 
            "Direct flight London Sydney",
            "Vol première classe Madrid New York"
        ];
        
        let placeholderIndex = 0;
        setInterval(() => {
            if (!userMessageInput.value && document.activeElement !== userMessageInput) {
                userMessageInput.placeholder = `Exemple: ${placeholders[placeholderIndex]}...`;
                placeholderIndex = (placeholderIndex + 1) % placeholders.length;
            }
        }, 3000);
        
        console.log('✅ Event listeners configurés');
    } else {
        console.error('❌ Élément userMessage non trouvé');
    }
    
    // Initialiser le bouton d'envoi
    if (sendButton) {
        sendButton.disabled = true;
        console.log('✅ Bouton d\'envoi configuré');
    }
    
    // Message de bienvenue
    addMessage('Bonjour ! Je suis votre assistant de réservation de vols intelligent. Décrivez-moi votre voyage en langage naturel !', false);
    
    // Bouton de test de connectivité
    const testButtonHtml = `
        <div style="text-align: center; margin: 10px 0; padding: 10px; background: #f0f9ff; border-radius: 8px;">
            <div style="font-size: 12px; color: #1e40af; margin-bottom: 8px;">
                <strong>🔧 Outils de diagnostic</strong>
            </div>
            <button onclick="testConnection()" 
                    style="background: #3b82f6; color: white; border: none; padding: 6px 12px; border-radius: 12px; cursor: pointer; margin: 0 4px;">
                🧪 Test connexion
            </button>
            <button onclick="showDebugInfo()" 
                    style="background: #6b7280; color: white; border: none; padding: 6px 12px; border-radius: 12px; cursor: pointer; margin: 0 4px;">
                📊 Debug info
            </button>
        </div>
    `;
    addMessage(testButtonHtml, false, true);
    
    // Nettoyage périodique des anciens messages
    setInterval(cleanOldMessages, 60000); // Toutes les minutes
    
    // État de la session
    console.log('Session ID:', bookingState.sessionId);
    console.log('État initial:', bookingState);
    
    console.log('✅ Flight Bot Interface initialisée avec succès');
});

// ====================
// FONCTION DE NETTOYAGE AU DÉCHARGEMENT
// ====================

window.addEventListener('beforeunload', function() {
    console.log('=== NETTOYAGE SESSION ===');
    console.log('Session terminée:', bookingState.sessionId);
    console.log('Étape finale:', bookingState.currentStep);
    console.log('Vols en cache:', bookingState.searchResults?.length || 0);
});
