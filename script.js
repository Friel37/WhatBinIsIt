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

    // Get references to all input and output elements
    const collectionDaySelect = document.getElementById('collectionDay');
    const lastCollectionDateInput = document.getElementById('lastCollectionDate');
    const lastTypeRecyclingRadio = document.getElementById('lastTypeRecycling');
    const lastTypeGeneralRadio = document.getElementById('lastTypeGeneral'); // Need this to get the value if selected
    const calculateBtn = document.getElementById('calculateBtn');
    const resultElement = document.getElementById('result');
    const nextCollectionElement = document.getElementById('nextCollection');
    const resultsArea = document.getElementById('results-area'); // Get the results article

    // Hide results area initially
    resultsArea.style.display = 'none';

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

    calculateBtn.addEventListener('click', () => {
        // --- Clear previous results and errors ---
        resultElement.textContent = ''; // Clear error message
        nextCollectionElement.textContent = ''; // Clear previous results
        resultsArea.style.display = 'none'; // Hide results area
        resultElement.removeAttribute('data-error'); // Remove error styling attribute if present

        // --- Get and Validate Inputs ---
        const collectionDay = parseInt(collectionDaySelect.value, 10);
        if (isNaN(collectionDay)) {
            resultElement.textContent = 'Please select your bin collection day.';
            resultElement.setAttribute('data-error', 'true'); // Add attribute for potential styling
            resultsArea.style.display = 'block'; // Show results area for error
            return;
        }

        const lastCollectionDateValue = lastCollectionDateInput.value;
        if (!lastCollectionDateValue) {
            resultElement.textContent = 'Please select the date of your last collection.';
            resultElement.setAttribute('data-error', 'true');
            resultsArea.style.display = 'block';
            return;
        }

        // Parse the last collection date using UTC
        const parts = lastCollectionDateValue.split('-');
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
        const day = parseInt(parts[2], 10);
        const lastCollectionDate = new Date(Date.UTC(year, month, day));

        if (isNaN(lastCollectionDate.getTime())) { // Check if the date is valid
             resultElement.textContent = 'Invalid date entered for last collection.';
             resultElement.setAttribute('data-error', 'true');
             resultsArea.style.display = 'block';
             return;
        }

        const lastCollectionType = document.querySelector('input[name="lastCollectionType"]:checked').value;

        // Get the current date (midnight UTC representing local date)
        const { localDateMidnight, currentLocalHour } = getLocalTimeInfo(userTimeZone);

        // Prevent calculation if last collection date (UTC midnight) is after current local date (UTC midnight)
        if (lastCollectionDate.getTime() > localDateMidnight.getTime()) {
            resultElement.textContent = 'Last collection date cannot be in the future.';
            resultElement.setAttribute('data-error', 'true');
            resultsArea.style.display = 'block';
            return;
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
        // ...
        console.log("--- Reference ---");
        // ...
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
        console.log("--- Display Strings --- ");
        console.log("Next Date Display:", nextDateDisplayString);

    });
}); 