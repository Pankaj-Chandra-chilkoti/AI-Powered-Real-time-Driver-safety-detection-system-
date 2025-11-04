// --- GLOBAL STATE --- 
 const state = { 
 	 isAuthenticated: false, 
 	 currentPage: 'dashboard', 
 	 user: null, 
 	  
 	 // Dashboard State 
 	 isCapturing: false, 
 	 isProcessing: false, 
 	 activeTrip: null, 
 	 alerts: [], 
 	 isMuted: false, 
 	 volume: 80, 
 	 tripDuration: 0, 
 	 alertIntervalId: null, 

 	 // Reports State 
 	 trips: [], 
 	 selectedTrip: null, 
 	 tripEvents: [], 
 	 safetyScore: null, 
 	 reportsLoading: false, 
 	 activeTab: 'history', // Added to state for persistence 
 }; 

 // --- UTILITIES & CONFIGURATION --- 
 const FAKE_USER = { id: 'd-4567', name: 'Pankaj Chilkoti ', role: 'driver', email: 'Pankaj@example.com' }; 
 const ALERT_TYPES = ['drowsiness', 'yawning', 'smoking', 'mobile phone use', 'seat belt absence', 'speeding', 'seat belt absence']; 
 const API_BASE_URL = 'http://localhost:8080/api'; // Placeholder 
 const ALERT_SOUND_URL = 'https://s3.amazonaws.com/cdn.freshdesk.com/data/helpdesk/attachments/production/60007877148/original/alarm-horn-01.mp3?1577749437'; 
 const audioPlayer = new Audio(ALERT_SOUND_URL); 
 let tripTimerInterval = null; 

 // Function to create Lucide icon HTML 
 const getIconHtml = (iconName, classes = 'w-5 h-5') => { 
 	 return `<i data-lucide="${iconName}" class="${classes}"></i>`; 
 }; 

 const getRandomAlert = () => ({ 
 	 id: crypto.randomUUID(), 
 	 type: ALERT_TYPES[Math.floor(Math.random() * ALERT_TYPES.length)], 
 	 severity: Math.random() < 0.2 ? 'High' : (Math.random() < 0.6 ? 'Medium' : 'Low'), 
 	 timestamp: new Date().toISOString(), 
 	 location: '30.3398 N, 78.0263 E', 
 }); 

 const formatDuration = (seconds) => { 
 	 const h = Math.floor(seconds / 3600).toString().padStart(2, '0'); 
 	 const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0'); 
 	 const s = Math.floor(seconds % 60).toString().padStart(2, '0'); 
 	 return `${h}:${m}:${s}`; 
 }; 

 // --- ICON INITIALIZATION (Called after the page loads) --- 
 const initializeIcons = () => { 
 	 if (window.lucide && window.lucide.createIcons) { 
 	 	 // Ensure Lucide icons are processed 
 	 	 window.lucide.createIcons(); 
 	 } 
 }; 

 // --- UI RENDER FUNCTIONS --- 

 const updateSidebar = () => { 
 	 document.getElementById('username-display').textContent = state.user?.name || 'Guest'; 
 	 document.getElementById('user-role').textContent = state.user?.role || ''; 
 	  
 	 // Update active link class 
 	 ['dashboard', 'reports'].forEach(page => { 
 	 	 const btn = document.getElementById(`nav-${page}`); 
 	 	 if (btn) { 
 	 	 	 btn.classList.toggle('bg-indigo-600', state.currentPage === page); 
 	 	 	 btn.classList.toggle('border-l-4', state.currentPage === page); 
 	 	 	 btn.classList.toggle('border-indigo-400', state.currentPage === page); 
 	 	 } 
 	 }); 
 }; 

 const renderPage = () => { 
 	 const mainContent = document.getElementById('main-content'); 
 	 if (!state.isAuthenticated) { 
 	 	 renderAuthPage(); 
 	 	 return; 
 	 } 

 	 document.getElementById('auth-overlay').classList.add('hidden'); 
 	 document.getElementById('sidebar').classList.remove('hidden'); 

 	 updateSidebar(); 

 	 switch (state.currentPage) { 
 	 	 case 'dashboard': 
 	 	 	 mainContent.innerHTML = renderDashboardPage(); 
 	 	 	 // Re-render icons and update dashboard content 
 	 	 	 setTimeout(() => {  
 	 	 	 	 initializeIcons();  
 	 	 	 	 updateDashboard();  
 	 	 	 }, 0);  
 	 	 	 break; 
 	 	 case 'reports': 
 	 	 	 mainContent.innerHTML = renderReportsPage(); 
 	 	 	 // Re-render icons and fetch report data 
 	 	 	 setTimeout(() => {  
 	 	 	 	 initializeIcons();  
 	 	 	 	 fetchTripHistory();  
 	 	 	 }, 0);  
 	 	 	 break; 
 	 	 default: 
 	 	 	 state.currentPage = 'dashboard'; 
 	 	 	 renderPage(); 
 	 } 
 }; 

 // --- AUTHENTICATION LOGIC --- 

 const renderAuthPage = (isRegister = false, message = '', isError = false) => { 
 	 document.getElementById('auth-overlay').classList.remove('hidden'); 
 	 document.getElementById('sidebar').classList.add('hidden'); 
 	  
 	 const title = isRegister ? 'Create an Account' : 'Sign in to your Dashboard'; 
 	 const buttonText = isRegister ? 'Register' : 'Login'; 
 	 const switchText = isRegister ? 'Already have an account?' : "Don't have an account?"; 
 	 const switchButtonText = isRegister ? 'Sign in' : 'Register here'; 
 	  
 	 const messageHtml = message ? ` 
 	 	 <div class="p-3 text-sm rounded-lg ${isError ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}"> 
 	 	 	 ${message} 
 	 	 </div> 
 	 ` : ''; 

 	 const registerFields = isRegister ? ` 
 	 	 <input id="auth-name" type="text" placeholder="Full Name" required  
 	 	 	 class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500" /> 
 	 ` : ''; 

 	 document.getElementById('auth-overlay').innerHTML = ` 
        <video autoplay loop muted playsinline id="bg-video">
            <source src="Driver_Safety_Video_Generation.mp4" type="video/mp4">
            Your browser does not support the video tag.
        </video>

 	 	 <div class="relative z-10 w-full max-w-md bg-white p-8 rounded-xl shadow-2xl border border-gray-100"> 
 	 	 	 <div class="text-center mb-6"> 
 	 	 	 	 <h1 class="text-3xl font-extrabold text-indigo-700">Driver Safety Monitor</h1> 
 	 	 	 	 <p class="text-gray-500 mt-1">${title}</p> 
 	 	 	 </div> 
 	 	 	  
 	 	 	 <form id="auth-form" class="space-y-4"> 
 	 	 	 	 ${registerFields} 
 	 	 	 	 <input id="auth-email" type="email" placeholder="Email Address" value="driver@example.com" required  
 	 	 	 	 	 class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500" /> 
 	 	 	 	 <input id="auth-password" type="password" placeholder="Password" value="password" required  
 	 	 	 	 	 class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500" /> 
 	 	 	 	  
 	 	 	 	 ${messageHtml} 

 	 	 	 	 <button type="submit" id="auth-submit" class="w-full flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-lg transition duration-150 disabled:bg-indigo-400"> 
 	 	 	 	 	 ${buttonText} 
 	 	 	 	 </button> 
 	 	 	 </form> 

 	 	 	 <p class="mt-6 text-center text-sm text-gray-600"> 
 	 	 	 	 ${switchText} 
 	 	 	 	 <button onclick="renderAuthPage(${!isRegister})" class="text-indigo-600 hover:text-indigo-800 font-medium ml-1"> 
 	 	 	 	 	 ${switchButtonText} 
 	 	 	 	 </button> 
 	 	 	 </p> 
 	 	 </div> 
 	 `; 
 	  
 	 // Attach form submission handler 
 	 document.getElementById('auth-form').onsubmit = (e) => { 
 	 	 e.preventDefault(); 
 	 	 const email = document.getElementById('auth-email').value; 
 	 	 const password = document.getElementById('auth-password').value; 
 	 	 const name = isRegister ? document.getElementById('auth-name').value : null; 

 	 	 const submitBtn = document.getElementById('auth-submit'); 
 	 	 submitBtn.disabled = true; 
 	 	 submitBtn.innerHTML = `${getIconHtml('loader-2', 'w-5 h-5 mr-2 animate-spin')} Loading...`; 

 	 	 if (isRegister) { 
 	 	 	 handleRegister(name, email, password); 
 	 	 } else { 
 	 	 	 handleLogin(email, password); 
 	 	 } 
 	 }; 
 	 initializeIcons(); // Render icons in the auth form 
 }; 

 const handleLogin = async (email, password) => { 
 	 // SIMULATED API CALL: POST /api/auth/login 
 	 await new Promise(r => setTimeout(r, 1000)); 
 	  
 	 if (email === FAKE_USER.email && password === 'password@321') { 
 	 	 localStorage.setItem('auth_token', 'fake-jwt-token'); 
 	 	 state.user = FAKE_USER; 
 	 	 state.isAuthenticated = true; 
 	 	 renderPage(); // Go to dashboard 
 	 } else { 
 	 	 renderAuthPage(false, 'Invalid email or password.', true); 
 	 } 
 }; 

 const handleRegister = async (name, email, password) => { 
 	 // SIMULATED API CALL: POST /api/auth/register 
 	 await new Promise(r => setTimeout(r, 1000)); 
 	  
 	 renderAuthPage(false, `Registration successful for ${name}. Please log in.`, false); 
 }; 

 const handleLogout = () => { 
 	 localStorage.removeItem('auth_token'); 
 	 state.user = null; 
 	 state.isAuthenticated = false; 
 	 stopTripTimer(); 
 	 if (state.alertIntervalId) clearInterval(state.alertIntervalId); 
 	 state.alerts = []; 
 	 state.isCapturing = false; 
 	 state.isProcessing = false; 
 	 state.activeTrip = null; 
 	 renderPage(); 
 }; 

 // --- DASHBOARD LOGIC --- 

 const startTripTimer = () => { 
 	 if (tripTimerInterval) clearInterval(tripTimerInterval); 
 	 state.tripDuration = 0; 
 	 tripTimerInterval = setInterval(() => { 
 	 	 state.tripDuration += 1; 
 	 	 updateDashboard(); 
 	 }, 1000); 
 }; 

 const stopTripTimer = () => { 
 	 if (tripTimerInterval) clearInterval(tripTimerInterval); 
 	 tripTimerInterval = null; 
 }; 

 const startAlertSimulation = () => { 
 	 if (state.alertIntervalId) clearInterval(state.alertIntervalId); 
 	 const id = setInterval(() => { 
 	 	 if (Math.random() > 0.6) { 
 	 	 	 state.alerts.unshift(getRandomAlert()); 
 	 	 	 state.alerts = state.alerts.slice(0, 50); // Keep max 50 alerts 
 	 	 	 updateAlerts(); 
 	 	 	 playAlertSound(); 
 	 	 } 
 	 }, Math.floor(Math.random() * 5000) + 3000); 
 	 state.alertIntervalId = id; 
 }; 

 const stopAlertSimulation = () => { 
 	 if (state.alertIntervalId) { 
 	 	 clearInterval(state.alertIntervalId); 
 	 	 state.alertIntervalId = null; 
 	 } 
 }; 

 const playAlertSound = () => { 
 	 if (!state.isMuted) { 
 	 	 // Only play sound for High severity alerts 
 	 	 const highAlerts = state.alerts.filter(a => a.severity === 'High'); 
 	 	 if (highAlerts.length > 0) { 
 	 	 	 audioPlayer.volume = state.volume / 100; 
 	 	 	 audioPlayer.play().catch(e => console.error("Audio playback failed (browser restriction):", e)); 
 	 	 } 
 	 } 
 }; 

 const handleStartTrip = async () => { 
 	 // SIMULATED API CALL: POST /api/trips/start 
 	 await new Promise(r => setTimeout(r, 500)); 
 	  
 	 const newTripId = 'TRIP-' + Math.floor(Math.random() * 90000 + 10000); 
 	 state.activeTrip = { id: newTripId, start: new Date().toISOString() }; 
 	 state.isCapturing = true; 
 	 state.isProcessing = true; 
 	 state.alerts = []; 

 	 startTripTimer(); 
 	 startAlertSimulation(); 
 	 updateDashboard(); 
 }; 

 const handleEndTrip = async () => { 
 	 if (!state.activeTrip) return; 

 	 // SIMULATED API CALL: POST /api/trips/end 
 	 await new Promise(r => setTimeout(r, 500)); 
 	  
 	 stopTripTimer(); 
 	 stopAlertSimulation(); 

 	 state.activeTrip = null; 
 	 state.isCapturing = false; 
 	 state.isProcessing = false; 
 	  
 	 // Optionally save current alerts as trip events to show in reports 
 	 localStorage.setItem('last_trip_events', JSON.stringify(state.alerts)); 
 	  
 	 updateDashboard(); 
 }; 

 const handleToggleProcessing = () => { 
 	 if (!state.isCapturing) return; 

 	 state.isProcessing = !state.isProcessing; 
 	 if (state.isProcessing) { 
 	 	 startAlertSimulation(); 
 	 } else { 
 	 	 stopAlertSimulation(); 
 	 } 
 	 updateDashboard(); 
 }; 

 const handleToggleMute = () => { 
 	 state.isMuted = !state.isMuted; 
 	 updateDashboard(); 
 }; 

 const handleVolumeChange = (value) => { 
 	 state.volume = parseInt(value); 
 	 audioPlayer.volume = state.isMuted ? 0 : state.volume / 100; 
 	 updateDashboard(); 
 }; 

 const handleClearAlerts = () => { 
 	 state.alerts = []; 
 	 updateAlerts(); 
 }; 

 const updateDashboard = () => { 
 	 // Update Webcam Status 
 	 const webcamStatus = document.getElementById('webcam-status'); 
 	 if (webcamStatus) { 
 	 	 webcamStatus.textContent = state.isCapturing ? "LIVE FEED ACTIVE" : "CAMERA INACTIVE"; 
 	 	 const processingOverlay = document.getElementById('processing-overlay'); 
 	 	 if (processingOverlay) { 
 	 	 	 processingOverlay.classList.toggle('hidden', !(state.isCapturing && state.isProcessing)); 
 	 	 } 
 	 } 
 	  
 	 // Update Trip Status Badges 
 	 document.getElementById('trip-id-value').textContent = state.activeTrip ? state.activeTrip.id : 'N/A'; 
 	 document.getElementById('trip-duration-value').textContent = formatDuration(state.tripDuration); 
 	  
 	 // Update Trip Management Buttons 
 	 document.getElementById('btn-start-trip').disabled = !!state.activeTrip; 
 	 document.getElementById('btn-end-trip').disabled = !state.activeTrip; 

 	 // Update Processing Button 
 	 const procBtn = document.getElementById('btn-processing-toggle'); 
 	 if (procBtn) { 
 	 	 procBtn.disabled = !state.isCapturing; 
 	 	 procBtn.textContent = state.isProcessing ? 'Stop Processing' : 'Start Processing Frames'; 
 	 	 procBtn.className = `px-4 py-2 rounded-lg font-semibold transition duration-150 w-full ${ 
 	 	 	 state.isProcessing  
 	 	 	 ? 'bg-yellow-500 text-gray-900 hover:bg-yellow-600'  
 	 	 	 : 'bg-indigo-600 text-white hover:bg-indigo-700' 
 	 	 } disabled:bg-gray-400`; 
 	 } 
 	  
 	 // Update Mute/Volume Controls 
 	 const muteBtn = document.getElementById('btn-mute-toggle'); 
 	 const volRange = document.getElementById('volume-range'); 
 	 if (muteBtn) { 
 	 	 muteBtn.className = `px-4 py-2 rounded-lg font-semibold transition duration-150 flex items-center justify-center w-full ${ 
 	 	 	 state.isMuted  
 	 	 	 ? 'bg-red-500 text-white hover:bg-red-600'  
 	 	 	 : 'bg-green-500 text-white hover:bg-green-600' 
 	 	 }`; 
 	 	 muteBtn.innerHTML = state.isMuted  
 	 	 	 ? `${getIconHtml('volume-x', 'w-5 h-5 mr-1')} Muted`  
 	 	 	 : `${getIconHtml('volume-2', 'w-5 h-5 mr-1')} Volume: ${state.volume}%`; 
 	 } 
 	 if (volRange) { 
 	 	 volRange.value = state.volume; 
 	 	 volRange.disabled = state.isMuted; 
 	 } 

 	 updateAlerts(); 
 	 initializeIcons(); // Call icon render 
 }; 

 const updateAlerts = () => { 
 	 const alertList = document.getElementById('alert-list'); 
 	 if (!alertList) return; 

 	 const counts = state.alerts.reduce((acc, alert) => { 
 	 	 acc[alert.severity] = (acc[alert.severity] || 0) + 1; 
 	 	 return acc; 
 	 }, { High: 0, Medium: 0, Low: 0 }); 

 	 document.getElementById('alert-count-high').textContent = `High: ${counts.High}`; 
 	 document.getElementById('alert-count-medium').textContent = `Medium: ${counts.Medium}`; 
 	 document.getElementById('alert-count-low').textContent = `Low: ${counts.Low}`; 
 	 document.getElementById('alert-header-count').textContent = `Real-time Alerts (${state.alerts.length})`; 

 	 if (state.alerts.length === 0) { 
 	 	 alertList.innerHTML = '<p class="text-gray-500 text-center py-4">No recent unsafe events detected.</p>'; 
 	 } else { 
 	 	 alertList.innerHTML = state.alerts.map(alert => { 
 	 	 	 const color = alert.severity === 'High' ? 'text-red-500' : (alert.severity === 'Medium' ? 'text-yellow-500' : 'text-green-500'); 
 	 	 	 const bgColor = alert.severity === 'High' ? 'bg-red-100' : (alert.severity === 'Medium' ? 'bg-yellow-100' : 'bg-green-100'); 
 	 	 	  
 	 	 	 return ` 
 	 	 	 	 <div class="p-3 mb-2 rounded-lg flex items-start space-x-3 ${bgColor}"> 
 	 	 	 	 	 ${getIconHtml('zap', `w-5 h-5 flex-shrink-0 ${color}`)} 
 	 	 	 	 	 <div class="flex-grow"> 
 	 	 	 	 	 	 <p class="font-semibold capitalize ${color}">${alert.type.replace(' ', ' ')}</p> 
 	 	 	 	 	 	 <p class="text-xs text-gray-700">Severity: ${alert.severity} | ${new Date(alert.timestamp).toLocaleTimeString()}</p> 
 	 	 	 	 	 </div> 
 	 	 	 	 </div> 
 	 	 	 `; 
 	 	 }).join(''); 
 	 } 
 	 initializeIcons(); 
 }; 


 const renderDashboardPage = () => { 
 	 return ` 
 	 	 <h2 class="text-3xl font-bold text-gray-800 mb-6">Driver Safety Dashboard</h2> 

 	 	 <div class="grid grid-cols-1 lg:grid-cols-3 gap-6"> 
 	 	 	 <div class="lg:col-span-2 space-y-6"> 
 	 	 	 	 <div class="relative w-full aspect-video bg-gray-900 rounded-xl overflow-hidden shadow-2xl border-4 border-gray-700"> 
 	 	 	 	 	 <div class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70"> 
 	 	 	 	 	 	 ${getIconHtml('camera', 'w-12 h-12 text-gray-500')} 
 	 	 	 	 	 	 <span id="webcam-status" class="ml-3 text-lg text-gray-400">CAMERA INACTIVE</span> 
 	 	 	 	 	 </div> 
 	 	 	 	 	 <div id="processing-overlay" class="absolute top-0 left-0 right-0 p-2 bg-yellow-500 text-gray-900 font-bold text-center animate-pulse hidden"> 
 	 	 	 	 	 	 Processing Frames... 
 	 	 	 	 	 </div> 
 	 	 	 	 </div> 

 	 	 	 	 <div class="bg-white p-6 rounded-xl shadow-lg"> 
 	 	 	 	 	 <h3 class="text-xl font-semibold mb-4 text-gray-700 flex items-center"> 
 	 	 	 	 	 	 ${getIconHtml('history', 'w-5 h-5 mr-2 text-indigo-500')} Trip Management 
 	 	 	 	 	 </h3> 
 	 	 	 	 	  
 	 	 	 	 	 <div class="flex flex-col sm:flex-row gap-4 mb-4"> 
 	 	 	 	 	 	 <button id="btn-start-trip" onclick="handleStartTrip()" class="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition duration-150 disabled:bg-gray-400"> 
 	 	 	 	 	 	 	 Start New Trip 
 	 	 	 	 	 	 </button> 
 	 	 	 	 	 	 <button id="btn-end-trip" onclick="handleEndTrip()" disabled class="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition duration-150 disabled:bg-gray-400"> 
 	 	 	 	 	 	 	 End Trip 
 	 	 	 	 	 	 </button> 
 	 	 	 	 	 </div> 
 	 	 	 	 	  
 	 	 	 	 	 <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4"> 
 	 	 	 	 	 	 <div class="bg-white p-3 rounded-lg shadow flex items-center justify-between transition duration-300 hover:shadow-md"> 
 	 	 	 	 	 	 	 <span class="text-sm font-medium text-gray-500">Active Trip ID</span> 
 	 	 	 	 	 	 	 <span id="trip-id-value" class="text-xl font-bold text-gray-500">N/A</span> 
 	 	 	 	 	 	 </div> 
 	 	 	 	 	 	 <div class="bg-white p-3 rounded-lg shadow flex items-center justify-between transition duration-300 hover:shadow-md"> 
 	 	 	 	 	 	 	 <span class="text-sm font-medium text-gray-500">Duration</span> 
 	 	 	 	 	 	 	 <span id="trip-duration-value" class="text-xl font-bold text-gray-700">00:00:00</span> 
 	 	 	 	 	 	 </div> 

 	 	 	 	 	 	 <div class="p-3 rounded-lg shadow bg-gray-50 flex flex-col justify-center"> 
 	 	 	 	 	 	 	 <span class="text-sm font-medium text-gray-500 mb-1">Processing Toggle</span> 
 	 	 	 	 	 	 	 <button id="btn-processing-toggle" onclick="handleToggleProcessing()" disabled class="px-4 py-2 rounded-lg font-semibold transition duration-150 bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-gray-400"> 
 	 	 	 	 	 	 	 	 Start Processing Frames 
 	 	 	 	 	 	 	 </button> 
 	 	 	 	 	 	 </div> 
 	 	 	 	 	 	  
 	 	 	 	 	 	 <div class="p-3 rounded-lg shadow bg-gray-50 flex flex-col justify-center"> 
 	 	 	 	 	 	 	 <span class="text-sm font-medium text-gray-500 mb-1">Audible Alerts</span> 
 	 	 	 	 	 	 	 <button id="btn-mute-toggle" onclick="handleToggleMute()" class="px-4 py-2 rounded-lg font-semibold transition duration-150 flex items-center justify-center bg-green-500 text-white hover:bg-green-600"> 
 	 	 	 	 	 	 	 	 ${getIconHtml('volume-2', 'w-5 h-5 mr-1')} Volume: ${state.volume}% 
 	 	 	 	 	 	 	 </button> 
 	 	 	 	 	 	 	 <input type="range" id="volume-range" min="0" max="100" value="${state.volume}" oninput="handleVolumeChange(this.value)" class="mt-2 w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"> 
 	 	 	 	 	 	 </div> 
 	 	 	 	 	 </div> 
 	 	 	 	 </div> 
 	 	 	 </div> 

 	 	 	 <div class="lg:col-span-1 space-y-6"> 
 	 	 	 	 <div class="bg-white p-6 rounded-xl shadow-lg"> 
 	 	 	 	 	 <h3 class="text-xl font-semibold mb-4 text-gray-700 flex items-center justify-between"> 
 	 	 	 	 	 	 <div class="flex items-center"> 
 	 	 	 	 	 	 	 ${getIconHtml('zap', 'w-5 h-5 mr-2 text-red-500')} <span id="alert-header-count">Real-time Alerts (0)</span> 
 	 	 	 	 	 	 </div> 
 	 	 	 	 	 	 <button onclick="handleClearAlerts()" class="text-xs text-indigo-500 hover:text-indigo-700 font-medium"> 
 	 	 	 	 	 	 	 Clear All 
 	 	 	 	 	 	 </button> 
 	 	 	 	 	 </h3> 

 	 	 	 	 	 <div class="grid grid-cols-3 gap-2 text-center text-xs font-semibold mb-4"> 
 	 	 	 	 	 	 <div id="alert-count-high" class="p-2 rounded bg-red-500 text-white">High: 0</div> 
 	 	 	 	 	 	 <div id="alert-count-medium" class="p-2 rounded bg-yellow-500 text-gray-900">Medium: 0</div> 
 	 	 	 	 	 	 <div id="alert-count-low" class="p-2 rounded bg-green-500 text-white">Low: 0</div> 
 	 	 	 	 	 </div> 

 	 	 	 	 	 <div id="alert-list" class="max-h-96 overflow-y-auto pr-2"> 
 	 	 	 	 	 	 <p class="text-gray-500 text-center py-4">No recent unsafe events detected.</p> 
 	 	 	 	 	 </div> 
 	 	 	 	 </div> 
 	 	 	 </div> 
 	 	 </div> 
 	 `; 
 }; 

 // --- REPORTS LOGIC --- 

 const fetchTripHistory = async () => { 
 	 state.reportsLoading = true; 
 	 renderReportsDetails(); // Show loading state 

 	 // SIMULATED API CALL: GET /api/trips/:userId 
 	 await new Promise(r => setTimeout(r, 800)); 
 	  
 	 const fakeTrips = [ 
 	 	 { id: 'TRIP-92837', start: '2025-09-25T08:00:00Z', end: '2025-09-25T10:30:00Z', duration: '2h 30m', score: 85 }, 
 	 	 { id: 'TRIP-12345', start: '2025-09-24T14:15:00Z', end: '2025-09-24T15:05:00Z', duration: '50m', score: 92 }, 
 	 	 { id: 'TRIP-67890', start: '2025-09-23T19:00:00Z', end: '2025-09-23T20:10:00Z', duration: '1h 10m', score: 71 }, 
 	 ]; 
 	 state.trips = fakeTrips; 
 	 state.reportsLoading = false; 
 	  
 	 // Auto-select the first trip 
 	 state.selectedTrip = state.trips.length > 0 ? state.trips[0] : null; 
 	  
 	 renderReportsDetails(); 
 }; 

 const selectTrip = (tripId) => { 
 	 state.selectedTrip = state.trips.find(t => t.id === tripId); 
 	 state.activeTab = 'history'; 
 	 fetchTripDetails(); 
 }; 

 const fetchTripDetails = async () => { 
 	 if (!state.selectedTrip) return; 
 	 state.reportsLoading = true; 
 	 renderReportsDetails(); 

 	 // SIMULATED API CALLS: GET /api/events/:tripId, GET /api/score/:tripId 
 	 await new Promise(r => setTimeout(r, 500)); 
 	  
 	 const fakeEvents = [ 
 	 	 { type: 'Yawning', timestamp: '2025-09-25T08:15:20Z', severity: 'Low', location: 'Start Point' }, 
 	 	 { type: 'Mobile Phone Use', timestamp: '2025-09-25T09:05:45Z', severity: 'High', location: 'Highway 5' }, 
 	 	 { type: 'Drowsiness', timestamp: '2025-09-25T09:40:10Z', severity: 'Medium', location: 'City Center' }, 
 	 	 // Use alerts from last trip if available (simulating real log data) 
 	 	 ...(JSON.parse(localStorage.getItem('last_trip_events') || '[]').map(e => ({ 
 	 	 	 ...e, 
 	 	 	 timestamp: new Date().toISOString() // use current time for display simplicity 
 	 	 }))), 
 	 ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)); // Sort by time 

 	 state.tripEvents = fakeEvents; 
 	 state.safetyScore = state.selectedTrip.score; 
 	 state.reportsLoading = false; 
 	  
 	 renderReportsDetails(); 
 }; 

 const scoreColor = (safetyScore) => { 
 	 if (safetyScore >= 80) return 'text-green-500 bg-green-100'; 
 	 if (safetyScore >= 50) return 'text-yellow-500 bg-yellow-100'; 
 	 return 'text-red-500 bg-red-100'; 
 }; 

 const handleExportCSV = () => { 
 	 const tripId = state.selectedTrip.id; 
 	 console.log(`Generating CSV report for ${tripId}. (Simulated Download)`); 
 }; 

 const handleRequestPDF = async () => { 
 	 const tripId = state.selectedTrip.id; 
 	 console.log(`Requesting PDF report for ${tripId} from backend. (Simulated Request)`); 
 }; 

 const renderTripHistoryList = () => { 
 	 if (state.reportsLoading && state.trips.length === 0) { 
 	 	 return `<div class="flex justify-center items-center py-10">${getIconHtml('loader-2', 'w-6 h-6 animate-spin text-indigo-500')}</div>`; 
 	 } 
 	  
 	 if (state.trips.length === 0) { 
 	 	 return `<p class="text-gray-500 text-center py-4">No trip history available.</p>`; 
 	 } 

 	 return state.trips.map(trip => ` 
 	 	 <div onclick="selectTrip('${trip.id}')" 
 	 	 	 class="p-4 mb-3 rounded-lg border cursor-pointer transition duration-150 ${ 
 	 	 	 	 state.selectedTrip?.id === trip.id  
 	 	 	 	 ? 'bg-indigo-50 border-indigo-400 shadow-md'  
 	 	 	 	 : 'bg-gray-50 border-gray-200 hover:bg-gray-100' 
 	 	 	 }"> 
 	 	 	 <p class="font-bold text-gray-800">${trip.id}</p> 
 	 	 	 <p class="text-sm text-gray-600">Start: ${new Date(trip.start).toLocaleDateString()} ${new Date(trip.start).toLocaleTimeString()}</p> 
 	 	 	 <div class="flex justify-between items-center mt-1"> 
 	 	 	 	 <span class="text-xs font-medium text-gray-500">Duration: ${trip.duration}</span> 
 	 	 	 	 <span class="text-sm font-bold px-3 py-1 rounded-full ${scoreColor(trip.score)}">Score: ${trip.score}</span> 
 	 	 	 </div> 
 	 	 </div> 
 	 `).join(''); 
 }; 

 const renderTripDetails = () => { 
 	 if (!state.selectedTrip) { 
 	 	 return '<p class="text-gray-500 text-center py-20">Select a trip from the history to view details, logs, and safety score.</p>'; 
 	 } 

 	 const trip = state.selectedTrip; 
 	 const scoreClass = scoreColor(state.safetyScore); 

 	 const summaryContent = ` 
 	 	 <div class="space-y-4"> 
 	 	 	 <p><span class="font-semibold">Start Time:</span> ${new Date(trip.start).toLocaleString()}</p> 
 	 	 	 <p><span class="font-semibold">End Time:</span> ${new Date(trip.end).toLocaleString()}</p> 
 	 	 	 <p><span class="font-semibold">Total Duration:</span> ${trip.duration}</p> 
 	 	 	 <p><span class="font-semibold">Unsafe Events Recorded:</span> ${state.tripEvents.length}</p> 
 	 	 	 <p class="mt-4 text-gray-600 italic">This summary provides a high-level view of the trip. Check the Event Logs tab for detailed behavior records.</p> 
 	 	 </div> 
 	 `; 
 	  
 	 const logsContent = state.reportsLoading ? ( 
 	 	 `<tr><td colspan="4" class="text-center py-6 text-gray-500">${getIconHtml('loader-2', 'w-5 h-5 mx-auto animate-spin')} Loading events...</td></tr>` 
 	 ) : ( 
 	 	 state.tripEvents.map((event, index) => ` 
 	 	 	 <tr class="hover:bg-gray-50"> 
 	 	 	 	 <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${event.type}</td> 
 	 	 	 	 <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${new Date(event.timestamp).toLocaleTimeString()}</td> 
 	 	 	 	 <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold"> 
 	 	 	 	 	 <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${ 
 	 	 	 	 	 	 event.severity === 'High' ? 'bg-red-100 text-red-800' :  
 	 	 	 	 	 	 event.severity === 'Medium' ? 'bg-yellow-100 text-yellow-800' :  
 	 	 	 	 	 	 'bg-green-100 text-green-800' 
 	 	 	 	 	 }"> 
 	 	 	 	 	 	 ${event.severity} 
 	 	 	 	 	 </span> 
 	 	 	 	 </td> 
 	 	 	 	 <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${event.location}</td> 
 	 	 	 </tr> 
 	 	 `).join('') 
 	 ); 

 	 const logsTable = ` 
 	 	 <div class="overflow-x-auto"> 
 	 	 	 <table class="min-w-full divide-y divide-gray-200"> 
 	 	 	 	 <thead class="bg-gray-50"> 
 	 	 	 	 	 <tr> 
 	 	 	 	 	 	 <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th> 
 	 	 	 	 	 	 <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th> 
 	 	 	 	 	 	 <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Severity</th> 
 	 	 	 	 	 	 <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th> 
 	 	 	 	 	 </tr> 
 	 	 	 	 </thead> 
 	 	 	 	 <tbody class="bg-white divide-y divide-gray-200"> 
 	 	 	 	 	 ${logsContent} 
 	 	 	 	 </tbody> 
 	 	 	 </table> 
 	 	 </div> 
 	 `; 
 	  
 	 return ` 
 	 	 <h3 class="text-2xl font-bold text-gray-800 mb-4">Details for Trip: ${trip.id}</h3> 
 	 	  
 	 	 <div class="flex flex-col sm:flex-row justify-between items-center p-4 bg-indigo-50 rounded-lg mb-6 border border-indigo-200"> 
 	 	 	 <div class="text-center sm:text-left mb-4 sm:mb-0"> 
 	 	 	 	 <p class="text-sm font-medium text-indigo-700">Overall Safety Score</p> 
 	 	 	 	 <p class="text-4xl font-extrabold ${scoreClass}"> 
 	 	 	 	 	 ${state.reportsLoading ? getIconHtml('loader-2', 'w-8 h-8 animate-spin') : state.safetyScore} 
 	 	 	 	 </p> 
 	 	 	 </div> 
 	 	 	 <div class="flex space-x-3"> 
 	 	 	 	 <button onclick="handleExportCSV()" class="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition duration-150 text-sm"> 
 	 	 	 	 	 ${getIconHtml('download', 'w-4 h-4 mr-2')} Export CSV 
 	 	 	 	 </button> 
 	 	 	 	 <button onclick="handleRequestPDF()" class="flex items-center px-4 py-2 border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 transition duration-150 text-sm"> 
 	 	 	 	 	 ${getIconHtml('file-text', 'w-4 h-4 mr-2')} Request PDF 
 	 	 	 	 </button> 
 	 	 	 </div> 
 	 	 </div> 

 	 	 <div class="border-b border-gray-200 mb-4"> 
 	 	 	 <nav class="flex space-x-4"> 
 	 	 	 	 <button id="tab-history" onclick="setActiveTab('history')" 
 	 	 	 	 	 class="px-3 py-2 text-sm font-medium rounded-t-lg transition duration-150  
 	 	 	 	 	 ${state.activeTab === 'history' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}"> 
 	 	 	 	 	 Trip Summary 
 	 	 	 	 </button> 
 	 	 	 	 <button id="tab-logs" onclick="setActiveTab('logs')" 
 	 	 	 	 	 class="px-3 py-2 text-sm font-medium rounded-t-lg transition duration-150  
 	 	 	 	 	 ${state.activeTab === 'logs' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}"> 
 	 	 	 	 	 Event Logs (${state.tripEvents.length}) 
 	 	 	 	 </button> 
 	 	 	 </nav> 
 	 	 </div> 

 	 	 <div id="tab-content"> 
 	 	 	 ${state.activeTab === 'history' ? summaryContent : logsTable} 
 	 	 </div> 
 	 `; 
 }; 

 const renderReportsDetails = () => { 
 	 const historyList = document.getElementById('trip-history-list'); 
 	 const detailsArea = document.getElementById('trip-details-area'); 

 	 if (historyList) { 
 	 	 historyList.innerHTML = renderTripHistoryList(); 
 	 } 
 	 if (detailsArea) { 
 	 	 detailsArea.innerHTML = renderTripDetails(); 
 	 } 
 	 initializeIcons(); 
 }; 

 const setActiveTab = (tab) => { 
 	 state.activeTab = tab; 
 	 renderReportsDetails(); 
 }; 

 const renderReportsPage = () => { 
 	 state.activeTab = 'history'; 

 	 return ` 
 	 	 <h2 class="text-3xl font-bold text-gray-800 mb-6 flex items-center"> 
 	 	 	 ${getIconHtml('bar-chart-2', 'w-6 h-6 mr-2 text-indigo-500')} Trip Reports & History 
 	 	 </h2> 

 	 	 <div class="grid grid-cols-1 lg:grid-cols-3 gap-6"> 
 	 	 	 <div class="lg:col-span-1 bg-white p-6 rounded-xl shadow-lg h-full max-h-[80vh] overflow-y-auto"> 
 	 	 	 	 <h3 class="text-xl font-semibold mb-4 text-gray-700 border-b pb-2">Past Trips</h3> 
 	 	 	 	 <div id="trip-history-list"> 
 	 	 	 	 	 </div> 
 	 	 	 </div> 

 	 	 	 <div id="trip-details-area" class="lg:col-span-2 bg-white p-6 rounded-xl shadow-lg"> 
 	 	 	 	 </div> 
 	 	 </div> 
 	 `; 
 }; 

 // --- INITIALIZATION --- 
 const initApp = () => { 
 	 const token = localStorage.getItem('auth_token'); 
 	 if (token) { 
 	 	 // Simplified token validation for demo 
 	 	 state.user = FAKE_USER; 
 	 	 state.isAuthenticated = true; 
 	 } 
 	 renderPage(); 
 }; 

 // --- Expose functions globally for HTML event handlers --- 
 window.initApp = initApp; 
 window.setPage = (page) => { state.currentPage = page; renderPage(); }; 
 window.handleLogin = handleLogin; 
 window.handleRegister = handleRegister; 
 window.handleLogout = handleLogout; 
 window.handleStartTrip = handleStartTrip; 
 window.handleEndTrip = handleEndTrip; 
 window.handleToggleProcessing = handleToggleProcessing; 
 window.handleToggleMute = handleToggleMute; 
 window.handleVolumeChange = handleVolumeChange; 
 window.handleClearAlerts = handleClearAlerts; 
 window.fetchTripHistory = fetchTripHistory; 
 window.selectTrip = selectTrip; 
 window.handleExportCSV = handleExportCSV; 
 window.handleRequestPDF = handleRequestPDF; 
 window.setActiveTab = setActiveTab; 
 window.renderAuthPage = renderAuthPage; 

 // --- CRITICAL FIX: Ensure the app initializes once the document is fully loaded --- 
 document.addEventListener('DOMContentLoaded', initApp); 
 // Ensure icons are rendered after ALL content is initially loaded 
 window.addEventListener('load', initializeIcons);