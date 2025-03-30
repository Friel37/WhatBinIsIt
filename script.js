document.addEventListener('DOMContentLoaded', () => {
    // --- Timezone Detection ---
    let userTimeZone = 'Europe/London'; // Default timezone
    try {
        const detectedTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        // Basic check if it looks like a valid IANA zone
        if (detectedTimeZone && detectedTimeZone.includes('/')) {
            userTimeZone = detectedTimeZone;
        }
    } catch (e) {
        console.warn("Could not detect user timezone, defaulting to Europe/London.", e);
    }
    console.log(`Using timezone: ${userTimeZone}`);

    // --- UI Elements ---
    // Setup elements
    const setupContainer = document.getElementById('setup-container');
    const setupForm = document.getElementById('setup-form');
    const collectionDaySelect = document.getElementById('collectionDay');
    const lastCollectionDateInput = document.getElementById('lastCollectionDate');
    const lastTypeRecyclingRadio = document.getElementById('lastTypeRecycling');
    const lastTypeGeneralRadio = document.getElementById('lastTypeGeneral');
    const calculateBtn = document.getElementById('calculateBtn');
    
    // Main view elements
    const mainView = document.getElementById('main-view');
    const resultElement = document.getElementById('result');
    const nextCollectionElement = document.getElementById('nextCollection');
    const resultsArea = document.getElementById('results-area');
    const resetBtn = document.getElementById('resetBtn');
    const notificationBtn = document.getElementById('notificationBtn');

    // --- App State Flag ---
    const APP_SETUP_KEY = 'binApp_setupComplete';
    let setupComplete = localStorage.getItem(APP_SETUP_KEY) === 'true';

    // --- View Management Functions ---
    function showSetupView() {
        mainView.style.display = 'none';
        setupContainer.style.display = 'block';
        // Clear any previous error states
        resultElement.textContent = '';
        resultElement.removeAttribute('data-error');
    }

    function showMainView() {
        setupContainer.style.display = 'none';
        mainView.style.display = 'block';
        // Update the display with saved data
        updateDisplay();
    }

    // Determine which view to show on start
    function initializeView() {
        // If setup is complete, show main view, otherwise show setup
        if (setupComplete) {
            showMainView();
        } else {
            showSetupView();
            
            // Check if we have partial saved data to pre-fill the form
            const savedData = loadCollectionData();
            if (savedData) {
                // Pre-fill form with saved data
                collectionDaySelect.value = savedData.collectionDay;
                lastCollectionDateInput.value = savedData.lastCollectionDate;
                
                if (savedData.lastCollectionType === 'Recycling') {
                    lastTypeRecyclingRadio.checked = true;
                } else {
                    lastTypeGeneralRadio.checked = true;
                }
            }
        }

        // Check notification permission status and show button if appropriate
        checkAndUpdateNotificationButton();
    }

    // --- Notification Functions ---
    let notificationsEnabled = false;

    // Check if notifications are supported and permission has been granted
    function checkNotificationPermission() {
        if (!('Notification' in window)) {
            console.log("This browser does not support notifications");
            return false;
        }
        
        if (Notification.permission === 'granted') {
            notificationsEnabled = true;
            return true;
        } else if (Notification.permission !== 'denied') {
            return false;
        }
        return false;
    }

    // Request permission for notifications
    function requestNotificationPermission() {
        if (!('Notification' in window)) {
            alert("This browser does not support desktop notifications");
            return Promise.resolve(false);
        }
        
        return Notification.requestPermission()
            .then(permission => {
                if (permission === 'granted') {
                    notificationsEnabled = true;
                    return true;
                } else {
                    return false;
                }
            });
    }

    // Update notification button visibility based on permission state
    function checkAndUpdateNotificationButton() {
        // Only show notification button when setup is complete
        if (setupComplete) {
            if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
                notificationBtn.style.display = 'inline-block';
            } else {
                notificationBtn.style.display = 'none';
            }
        }
    }

    // Schedule a notification for an upcoming collection
    function scheduleNotification(collectionType, collectionDate) {
        if (!notificationsEnabled) return false;
        
        // Get the day before collection at 6 PM
        const notificationDate = new Date(collectionDate);
        notificationDate.setDate(collectionDate.getDate() - 1); // Day before
        notificationDate.setHours(18, 0, 0, 0); // 6 PM
        
        const now = new Date();
        
        // Calculate time difference in milliseconds
        const timeUntilNotification = notificationDate.getTime() - now.getTime();
        
        // Only schedule if it's in the future
        if (timeUntilNotification > 0) {
            console.log(`Scheduling notification for ${notificationDate.toLocaleString()}`);
            
            // Use setTimeout for demo purposes
            // In a real app, you might want to use a service worker's Push API for more reliable scheduling
            setTimeout(() => {
                new Notification("Bin Collection Reminder", {
                    body: `Don't forget to put your ${collectionType} bin out for tomorrow's collection!`,
                    icon: "icon-192.png"
                });
            }, timeUntilNotification);
            
            return true;
        }
        
        return false;
    }

    // --- Check notification permission when page loads ---
    checkNotificationPermission();
    
    // --- Storage Functions ---
    function saveCollectionData(collectionDay, lastCollectionDate, lastCollectionType, nextCollectionDate, nextCollectionType) {
        try {
            localStorage.setItem('binApp_collectionDay', collectionDay);
            localStorage.setItem('binApp_lastCollectionDate', lastCollectionDate);
            localStorage.setItem('binApp_lastCollectionType', lastCollectionType);
            
            // Store the calculated next collection details for quick access
            localStorage.setItem('binApp_nextCollectionDate', nextCollectionDate.toISOString());
            localStorage.setItem('binApp_nextCollectionType', nextCollectionType);
            
            // Store when this calculation was performed
            localStorage.setItem('binApp_lastCalculation', new Date().toISOString());
            
            // Set the setup complete flag
            localStorage.setItem(APP_SETUP_KEY, 'true');
            setupComplete = true;
            
            // Schedule notification if enabled
            if (notificationsEnabled) {
                scheduleNotification(nextCollectionType, nextCollectionDate);
            }
            
            return true;
        } catch (e) {
            console.error('Error saving data to localStorage:', e);
            return false;
        }
    }

    function loadCollectionData() {
        try {
            // Get core saved values
            const data = {
                collectionDay: localStorage.getItem('binApp_collectionDay'),
                lastCollectionDate: localStorage.getItem('binApp_lastCollectionDate'),
                lastCollectionType: localStorage.getItem('binApp_lastCollectionType'),
                nextCollectionDate: localStorage.getItem('binApp_nextCollectionDate'),
                nextCollectionType: localStorage.getItem('binApp_nextCollectionType'),
                lastCalculation: localStorage.getItem('binApp_lastCalculation')
            };
            
            // Check if we have valid data
            if (data.collectionDay && data.lastCollectionDate && data.lastCollectionType) {
                // Convert date strings back to Date objects if needed
                if (data.nextCollectionDate) {
                    data.nextCollectionDate = new Date(data.nextCollectionDate);
                }
                if (data.lastCalculation) {
                    data.lastCalculation = new Date(data.lastCalculation);
                }
                return data;
            }
            return null;
        } catch (e) {
            console.error('Error loading data from localStorage:', e);
            return null;
        }
    }

    function resetApp() {
        // Keep timezone, but clear all app data
        if (confirm('Are you sure you want to reset your collection details?')) {
            localStorage.removeItem('binApp_collectionDay');
            localStorage.removeItem('binApp_lastCollectionDate');
            localStorage.removeItem('binApp_lastCollectionType');
            localStorage.removeItem('binApp_nextCollectionDate'); 
            localStorage.removeItem('binApp_nextCollectionType');
            localStorage.removeItem('binApp_lastCalculation');
            localStorage.removeItem(APP_SETUP_KEY);
            setupComplete = false;
            showSetupView();
        }
    }
    
    // Function to update the display with current calculation
    function updateDisplay() {
        const savedData = loadCollectionData();
        if (!savedData) {
            console.error("No saved data found but main view requested");
            showSetupView();
            return;
        }
        
        // Show the results container
        resultsArea.style.display = 'block';
        
        // Get the current time info to determine if we need to recalculate
        const { localDateMidnight, currentLocalHour } = getLocalTimeInfo(userTimeZone);
        const lastCalcTime = savedData.lastCalculation || new Date(0);
        const needsRecalculation = isRecalculationNeeded(lastCalcTime, savedData);
        
        if (needsRecalculation) {
            // Recalculate based on the saved collection day and type
            performCalculation(
                savedData.collectionDay,
                savedData.lastCollectionDate, 
                savedData.lastCollectionType,
                true // This is a refresh, not initial setup
            );
        } else {
            // Use the saved calculation results
            displayResults(savedData);
        }
        
        // Update notification button visibility
        checkAndUpdateNotificationButton();
    }
    
    // Check if we need to recalculate (e.g., day changed, calculations are old)
    function isRecalculationNeeded(lastCalcTime, savedData) {
        // Always recalculate if it's been more than 12 hours
        const RECALC_INTERVAL = 12 * 60 * 60 * 1000; // 12 hours in ms
        const now = new Date();
        
        if ((now - lastCalcTime) > RECALC_INTERVAL) {
            return true;
        }
        
        // If the next collection date is in the past, recalculate
        if (savedData.nextCollectionDate && savedData.nextCollectionDate < now) {
            return true;
        }
        
        return false;
    }
    
    // Display results from saved or calculated data
    function displayResults(data) {
        // Format the next collection date for display
        let nextDateDisplayString;
        const { localDateMidnight } = getLocalTimeInfo(userTimeZone);
        const nextDate = data.nextCollectionDate;
        
        // Create tomorrow date for comparison
        const tomorrowLocal = new Date(localDateMidnight);
        tomorrowLocal.setUTCDate(localDateMidnight.getUTCDate() + 1);
        
        // Determine display text based on date
        if (nextDate.toDateString() === localDateMidnight.toDateString()) {
            // The collection is today
            nextDateDisplayString = "today";
        } else if (nextDate.toDateString() === tomorrowLocal.toDateString()) {
            // The collection is tomorrow
            nextDateDisplayString = "tomorrow";
        } else {
            // Format the date
            nextDateDisplayString = `on <strong>${formatDate(nextDate, userTimeZone)}</strong>`;
        }
        
        // Calculate the following collection date (add 7 days)
        const followingDate = new Date(nextDate);
        followingDate.setDate(nextDate.getDate() + 7);
        const followingType = (data.nextCollectionType === 'Recycling') ? 'General Waste' : 'Recycling';
        
        // Update the display
        nextCollectionElement.innerHTML = `Next collection: <strong>${data.nextCollectionType}</strong> ${nextDateDisplayString}.<br>` +
                                     `Following collection: <strong>${followingType}</strong> on <strong>${formatDate(followingDate, userTimeZone)}</strong>.`;
    }

    // Helper function to format dates nicely using the detected/default timezone
    function formatDate(date, timeZone) {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: timeZone };
        return date.toLocaleDateString('en-GB', options); // Keep en-GB for format consistency for now
    }

    // Helper to get the current date (set to midnight UTC representing local date)
    // and the current hour in the specified local timezone.
    function getLocalTimeInfo(timeZone) {
        const now = new Date(); // Current moment

        // Get current hour in the specified timezone
        const localHourOptions = { timeZone: timeZone, hour: '2-digit', hour12: false };
        const localHourFormatter = new Intl.DateTimeFormat('en-GB', localHourOptions);
        const currentLocalHour = parseInt(localHourFormatter.format(now), 10);

        // Format to YYYY-MM-DD using the specified timezone, then parse back to get midnight UTC *representing* that local date
        const localDateOptions = { timeZone: timeZone, year: 'numeric', month: '2-digit', day: '2-digit' };
        const localDateFormatter = new Intl.DateTimeFormat('en-CA', localDateOptions); // en-CA gives YYYY-MM-DD
        const parts = localDateFormatter.formatToParts(now);
        const year = parts.find(p => p.type === 'year').value;
        const month = parts.find(p => p.type === 'month').value;
        const day = parts.find(p => p.type === 'day').value;
        // Return UTC date representing midnight of the current date in the specified timezone
        const localDateMidnight = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));

        return { localDateMidnight, currentLocalHour };
    }

    // Main calculation function that can be called from setup or refreshes
    function performCalculation(collectionDay, lastCollectionDateValue, lastCollectionType, isRefresh = false) {
        // --- Clear previous results and errors ---
        resultElement.textContent = ''; // Clear error message
        nextCollectionElement.textContent = ''; // Clear previous results
        resultElement.removeAttribute('data-error'); // Remove error styling attribute if present

        // --- Validate Inputs ---
        if (isNaN(collectionDay)) {
            resultElement.textContent = 'Please select your bin collection day.';
            resultElement.setAttribute('data-error', 'true');
            return false;
        }

        if (!lastCollectionDateValue) {
            resultElement.textContent = 'Please select the date of your last collection.';
            resultElement.setAttribute('data-error', 'true');
            return false;
        }

        // Parse the last collection date using UTC
        let parts;
        let lastCollectionDate;
        
        // Handle date being either a string (from input) or Date object (from saved data)
        if (typeof lastCollectionDateValue === 'string') {
            parts = lastCollectionDateValue.split('-');
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
            const day = parseInt(parts[2], 10);
            lastCollectionDate = new Date(Date.UTC(year, month, day));
        } else {
            lastCollectionDate = lastCollectionDateValue;
        }

        if (isNaN(lastCollectionDate.getTime())) { // Check if the date is valid
             resultElement.textContent = 'Invalid date entered for last collection.';
             resultElement.setAttribute('data-error', 'true');
             return false;
        }

        // Get the current date (midnight UTC representing local date)
        const { localDateMidnight, currentLocalHour } = getLocalTimeInfo(userTimeZone);

        // Prevent calculation if last collection date (UTC midnight) is after current local date (UTC midnight)
        if (lastCollectionDate.getTime() > localDateMidnight.getTime()) {
            resultElement.textContent = 'Last collection date cannot be in the future.';
            resultElement.setAttribute('data-error', 'true');
            return false;
        }

        // --- Core Calculation Logic ---
        // NOTE: Keep this section using the UTC-based dates (lastCollectionDate and referenceWeekStartDate)
        // to ensure week differences are calculated correctly across DST changes.
        // ... Reference Point calculation remains the same using lastCollectionDate (UTC) ...
        const lastCollectionDayOfWeek = lastCollectionDate.getUTCDay();
        const daysToSubtract = (lastCollectionDayOfWeek === 0) ? 6 : lastCollectionDayOfWeek - 1;
        const referenceWeekStartDate = new Date(lastCollectionDate);
        referenceWeekStartDate.setUTCDate(lastCollectionDate.getUTCDate() - daysToSubtract);
        const referenceWeekType = lastCollectionType;

        // 2. Calculate Current Bin Week (using UTC dates for consistency)
        const weeksDifferenceCurrent = Math.floor((localDateMidnight.getTime() - referenceWeekStartDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
        const currentCycleWeek = weeksDifferenceCurrent % 2;
        let currentBinWeekType;
        if (currentCycleWeek === 0) {
            currentBinWeekType = referenceWeekType;
        } else {
            currentBinWeekType = (referenceWeekType === 'Recycling') ? 'General Waste' : 'Recycling';
        }

        // 3. Find the first potential collection date on or after today (local time)
        let potentialNextCollectionDate = new Date(localDateMidnight);
        while (potentialNextCollectionDate.getUTCDay() !== collectionDay) {
            potentialNextCollectionDate.setUTCDate(potentialNextCollectionDate.getUTCDate() + 1);
        }

        // 4. Adjust based on 10 PM collection time
        let nextCollectionDate;
        let nextDateDisplayString;
        const collectionTimeCutoffHour = 22; // 10 PM

        // Check if the potential collection day is actually today (in local time)
        if (potentialNextCollectionDate.getTime() === localDateMidnight.getTime()) {
            // If it's today, check the current local time
            if (currentLocalHour < collectionTimeCutoffHour) {
                // Before 10 PM today: Collection is still today
                nextCollectionDate = potentialNextCollectionDate;
                nextDateDisplayString = "today";
            } else {
                // 10 PM or later today: Collection is effectively next week
                nextCollectionDate = new Date(potentialNextCollectionDate);
                nextCollectionDate.setUTCDate(potentialNextCollectionDate.getUTCDate() + 7);
                // Display next week's date
                nextDateDisplayString = `on <strong>${formatDate(nextCollectionDate, userTimeZone)}</strong>`;
            }
        } else {
            // Potential collection day is in the future
            nextCollectionDate = potentialNextCollectionDate;
            // Check if it's tomorrow for display purposes
            const tomorrowLocal = new Date(localDateMidnight);
            tomorrowLocal.setUTCDate(localDateMidnight.getUTCDate() + 1);
            if (nextCollectionDate.getTime() === tomorrowLocal.getTime()) {
                nextDateDisplayString = "tomorrow";
            } else {
                nextDateDisplayString = `on <strong>${formatDate(nextCollectionDate, userTimeZone)}</strong>`;
            }
        }

        // 5. Determine Bin Type for the *actual* Next Collection Date
        const weeksDifferenceNext = Math.floor((nextCollectionDate.getTime() - referenceWeekStartDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
        const nextCollectionCycleWeek = weeksDifferenceNext % 2;
        let nextCollectionType;
        if (nextCollectionCycleWeek === 0) {
            nextCollectionType = referenceWeekType;
        } else {
            nextCollectionType = (referenceWeekType === 'Recycling') ? 'General Waste' : 'Recycling';
        }

        // 6. Calculate Following Collection Date and Type (based on the actual nextCollectionDate)
        let followingCollectionDate = new Date(nextCollectionDate);
        followingCollectionDate.setUTCDate(nextCollectionDate.getUTCDate() + 7);
        let followingCollectionType = (nextCollectionType === 'Recycling') ? 'General Waste' : 'Recycling';

        // --- Format the Next Collection Date String (Done above in step 4) ---

        // --- Update the HTML Output for Next Collections ---
        // Use the determined nextDateDisplayString and calculated following date/type
        nextCollectionElement.innerHTML = `Next collection: <strong>${nextCollectionType}</strong> ${nextDateDisplayString}.<br>` +
                                          `Following collection: <strong>${followingCollectionType}</strong> on <strong>${formatDate(followingCollectionDate, userTimeZone)}</strong>.`;
        resultsArea.style.display = 'block'; // Show results area

        // Optional: Log values for debugging
        console.log("--- Inputs ---");
        console.log("Collection Day Selected (0-6):", collectionDay);
        console.log("Last Collection Date:", lastCollectionDate.toUTCString());
        console.log("Last Collection Type:", lastCollectionType);
        console.log("--- Current Week (Local) ---");
        console.log("Current Date (Local Midnight UTC):", localDateMidnight.toUTCString());
        console.log("Current Hour (Local):", currentLocalHour);
        console.log("Weeks Since Reference Start:", weeksDifferenceCurrent);
        console.log("Current Cycle Week (0 or 1):", currentCycleWeek);
        console.log("--- Next Collections (Calculated based on Local day & time) ---");
        console.log("Potential Next Collection Date (UTC Midnight):", potentialNextCollectionDate.toUTCString());
        console.log("Final Next Collection Date (UTC Midnight):", nextCollectionDate.toUTCString());
        console.log("Weeks Diff for Next Collection:", weeksDifferenceNext);
        console.log("Next Collection Cycle Week:", nextCollectionCycleWeek);
        console.log("Next Collection Type:", nextCollectionType);
        console.log("Following Collection Date (UTC Midnight):", followingCollectionDate.toUTCString());
        console.log("Following Collection Type:", followingCollectionType);

        // After calculation is successful and display is updated, save the data
        // Don't create a string version of the lastCollectionDate if it's a refresh
        const dateToSave = typeof lastCollectionDateValue === 'string' ? 
                           lastCollectionDateValue : lastCollectionDate.toISOString().split('T')[0];
        
        saveCollectionData(
            collectionDay, // Collection day (0-6)
            dateToSave, // Last collection date (YYYY-MM-DD string)
            lastCollectionType, // Last collection type (string)
            nextCollectionDate, // Next collection date (Date object)
            nextCollectionType // Next collection type (string)
        );
        
        return true;
    }

    // --- Event Listeners ---
    // Calculate button click handler (initial setup)
    calculateBtn.addEventListener('click', () => {
        const collectionDay = parseInt(collectionDaySelect.value, 10);
        const lastCollectionDateValue = lastCollectionDateInput.value;
        const lastCollectionType = document.querySelector('input[name="lastCollectionType"]:checked').value;
        
        const success = performCalculation(collectionDay, lastCollectionDateValue, lastCollectionType);
        if (success) {
            // Switch to main view if calculation was successful
            showMainView();
        }
    });
    
    // Reset button click handler
    resetBtn.addEventListener('click', resetApp);
    
    // Notification button click handler
    notificationBtn.addEventListener('click', () => {
        requestNotificationPermission()
            .then(granted => {
                if (granted) {
                    notificationBtn.style.display = 'none';
                    alert("Reminders enabled! You'll be notified the evening before collection day.");
                    
                    // If we already have collection data, schedule notifications
                    const savedData = loadCollectionData();
                    if (savedData && savedData.nextCollectionDate) {
                        scheduleNotification(savedData.nextCollectionType, savedData.nextCollectionDate);
                    }
                } else {
                    alert("You need to allow notifications for reminders to work.");
                }
            });
    });

    // Initialize the app with the correct view
    initializeView();
}); 