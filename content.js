// Hardcoded instructor name mappings (more to come through manual testing/feedback)
const manualInstructorReplacements = {
    "Joseph Janes": "Joe Janes"
};

// Formats numerical values to one decimal place and appends '/ 5' if value is not 'N/A'
function formatToOneDecimal(value) {
    if (value === 'N/A') return 'N/A';
    const numericValue = parseFloat(value);
    return numericValue.toFixed(1);
}

// Returns the background color based on the given rating or percentage value
function getBackgroundColor(value, isDifficulty) {
    let color = '#d3d3d3';  // Default light grey for 'N/A'
    if (value === 'N/A') return color;

    const numericValue = parseFloat(value);

    if (isDifficulty) {
        // Reversed color scheme for "Difficulty"
        if (numericValue < 3.0) {
            color = 'rgb(127, 246, 195)';  // Green for below 3.0
        } else if (numericValue >= 3.0 && numericValue < 4.0) {
            color = 'rgb(255, 241, 112)';  // Yellow for 3.0 to 3.99
        } else {
            color = 'rgb(255, 156, 156)';  // Red for 4.0 and above
        }
    } else {
        // Standard color scheme for "Rating"
        if (numericValue >= 4.0) {
            color = 'rgb(127, 246, 195)';  // Green for 4.0 and above
        } else if (numericValue >= 3.0 && numericValue < 4.0) {
            color = 'rgb(255, 241, 112)';  // Yellow for 3.0 to 3.99
        } else {
            color = 'rgb(255, 156, 156)';  // Red for below 3.0
        }
    }
    return color;
}

// Removes middle names, always returns the first and last words of the name, and applies manual name corrections
function removeMiddleName(professorName) {
    // Check if the professorName is in the hardcoded mappings
    if (manualInstructorReplacements[professorName]) {
        return manualInstructorReplacements[professorName]; // Return the mapped name if it exists
    }

    const nameParts = professorName.split(' '); // Split the name into parts by spaces
    
    if (nameParts.length > 1) {
        // Return the first word and the last word (with hyphens and apostrophes intact)
        return `${nameParts[0]} ${nameParts[nameParts.length - 1]}`;
    }
    return professorName; // If there's only one word, return it as is
}

// Performs exact and fuzzy matching on professor names to handle slight variations
function matchProfessorName(inputName, fetchedName) {
    const normalizedInputName = inputName.trim().toLowerCase();
    const normalizedFetchedName = fetchedName.trim().toLowerCase();
    return normalizedFetchedName === normalizedInputName || normalizedFetchedName.includes(normalizedInputName);
}

// Fetches professor rating, difficulty, would-take-again, and href link from RateMyProfessors
function getProfessorRating(professorName) {
    return new Promise((resolve, reject) => {
        const nameWithoutMiddle = removeMiddleName(professorName);
        const searchLink = `https://www.ratemyprofessors.com/search/professors/1530?q=${encodeURIComponent(nameWithoutMiddle)}`;

        chrome.runtime.sendMessage(
            { type: "fetchRating", professorName: nameWithoutMiddle },
            (response) => {
                if (response.htmlText) {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(response.htmlText, "text/html");

                    const professorCard = doc.querySelector('.TeacherCard__StyledTeacherCard-syjs0d-0');
                    if (!professorCard) {
                        resolve({ rating: 'N/A', difficulty: 'N/A', wouldTakeAgain: 'N/A', href: searchLink });
                        return;
                    }

                    const fetchedNameElement = professorCard.querySelector('.CardName__StyledCardName-sc-1gyrgim-0');
                    const fetchedName = fetchedNameElement ? fetchedNameElement.textContent.trim() : null;

                    if (!fetchedName || !matchProfessorName(nameWithoutMiddle, fetchedName)) {
                        resolve({ rating: 'N/A', difficulty: 'N/A', wouldTakeAgain: 'N/A', href: searchLink });
                        return;
                    }

                    // Extract the href from the <a> tag
                    const hrefElement = professorCard.closest('a.TeacherCard__StyledTeacherCard-syjs0d-0');
                    const professorLink = hrefElement ? `https://www.ratemyprofessors.com${hrefElement.getAttribute('href')}` : searchLink;

                    const ratingElement = professorCard.querySelector('.CardNumRating__CardNumRatingNumber-sc-17t4b9u-2');
                    let ratingNumber = ratingElement ? ratingElement.textContent.trim() : 'N/A';

                    const difficultyElement = [...professorCard.querySelectorAll('.CardFeedback__CardFeedbackItem-lq6nix-1')]
                        .find(el => el.innerText.includes('level of difficulty'));

                    const wouldTakeAgainElement = professorCard.querySelector('.CardFeedback__CardFeedbackItem-lq6nix-1:nth-child(1) .CardFeedback__CardFeedbackNumber-lq6nix-2');

                    let rating = ratingNumber || 'N/A';
                    let difficulty = difficultyElement ? difficultyElement.querySelector('.CardFeedback__CardFeedbackNumber-lq6nix-2').textContent.trim() : 'N/A';
                    let wouldTakeAgain = wouldTakeAgainElement ? wouldTakeAgainElement.textContent.trim().replace(/%+/g, '') : 'N/A';

                    if (rating === '0' || rating === '0.0') rating = 'N/A';
                    if (difficulty === '0' || difficulty === '0.0') difficulty = 'N/A';
                    if (wouldTakeAgain === '0' || wouldTakeAgain === '0.0') wouldTakeAgain = 'N/A';

                    rating = formatToOneDecimal(rating);
                    difficulty = formatToOneDecimal(difficulty);

                    if (wouldTakeAgain === 'N/A') {
                        wouldTakeAgain = 'N/A';
                    } else {
                        wouldTakeAgain = wouldTakeAgain + "%";
                    }

                    // Set the link to the professor's specific page if ratings exist, otherwise use the search page
                    const finalLink = (rating === 'N/A' && difficulty === 'N/A' && wouldTakeAgain === 'N/A') ? searchLink : professorLink;

                    resolve({ rating, difficulty, wouldTakeAgain, href: finalLink });

                } else {
                    reject('Failed to fetch professor data');
                }
            }
        );
    });
}

// Adds a legend describing the color scheme used for the rating fields
function addLegend() {
    const navTabs = document.querySelector('.mt-3.nav.nav-tabs');
    if (navTabs && !document.querySelector('.rating-legend')) {
        const legend = document.createElement('div');
        legend.classList.add('rating-legend');
        legend.style.position = 'absolute';
        legend.style.right = '20px';
        legend.style.top = '-10px';
        legend.style.marginTop = '0px';
        legend.style.marginBottom = '10px';
        legend.style.flexWrap = 'wrap';

        legend.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <div></div>
                <div style="font-weight: normal; font-style: italic">(Values Out of 5)</div>
            </div>
            <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                <div><span style="background-color: rgb(255, 156, 156); padding: 5px; border-radius: 5px;">Poor</span></div>
                <div><span style="background-color: rgb(255, 241, 112); padding: 5px; border-radius: 5px;">Average</span></div>
                <div><span style="background-color: rgb(127, 246, 195); padding: 5px; border-radius: 5px;">Excellent</span></div>
                <div><span style="background-color: #d3d3d3; padding: 5px; border-radius: 5px;">Field Not Found</span></div>
            </div>
        `;
        navTabs.style.position = 'relative';
        navTabs.appendChild(legend);
    }
}

// Adds rating, difficulty, would-take-again columns, and a link to the RateMyProfessors profile
function addRatingColumn() {
    const courseTable = document.querySelector('.cdpSectionsTable table.mb-0');
    if (!courseTable) {
        console.error("Table not found!");
        return;
    }

    const headerRow = courseTable.querySelector('thead tr');

    // Avoid adding columns multiple times
    if (headerRow.querySelector('.professor-rating')) {
        return;
    }

    // Add the legend
    addLegend();

    // Create and add new columns for Rating, Difficulty, Would Take Again, and Link
    const ratingHeader = document.createElement('th');
    ratingHeader.innerText = 'Professor Rating';
    ratingHeader.classList.add('professor-rating');

    const difficultyHeader = document.createElement('th');
    difficultyHeader.innerText = 'Professor Difficulty';
    difficultyHeader.classList.add('professor-difficulty');

    const wouldTakeAgainHeader = document.createElement('th');
    wouldTakeAgainHeader.innerText = 'Would Take Again';
    wouldTakeAgainHeader.classList.add('would-take-again');

    const rmpLinkHeader = document.createElement('th');
    rmpLinkHeader.innerText = '';  // Blank title for RMP link column
    rmpLinkHeader.classList.add('rmp-link-header');

    ratingHeader.style.width = '150px';
    difficultyHeader.style.width = '150px';
    wouldTakeAgainHeader.style.width = '150px';
    rmpLinkHeader.style.width = '150px';

    headerRow.appendChild(ratingHeader);
    headerRow.appendChild(difficultyHeader);
    headerRow.appendChild(wouldTakeAgainHeader);
    headerRow.appendChild(rmpLinkHeader);

    const rows = courseTable.querySelectorAll('tbody tr');
    rows.forEach(async (row) => {

        // Select the first professor name from a <ul> list or a single <div>
        const professorCell = row.querySelector('td:nth-child(5) ul li:first-child') || row.querySelector('td:nth-child(5) div.mb-1');
        const professorName = professorCell ? professorCell.textContent : null;

        // Skip row if there's no professor name
        if (!professorName || row.querySelector('.professor-rating')) {
            return;
        }

        try {
            const professorData = await getProfessorRating(professorName);

            // Check if all fields are N/A, then blank out those columns
            const allFieldsNA = professorData.rating === 'N/A' && professorData.difficulty === 'N/A' && professorData.wouldTakeAgain === 'N/A';

            const ratingCell = document.createElement('td');
            const difficultyCell = document.createElement('td');
            const wouldTakeAgainCell = document.createElement('td');
            
            if (!allFieldsNA) {
                // Create cells for the 3 fields if not all N/A
                const ratingSpan = document.createElement('span');
                ratingSpan.innerText = professorData.rating;
                ratingSpan.style.backgroundColor = getBackgroundColor(professorData.rating, false);
                ratingSpan.style.padding = '5px';
                ratingSpan.style.borderRadius = '5px';
                ratingSpan.style.display = 'inline-block';
                ratingSpan.style.textAlign = 'center';
                ratingCell.style.verticalAlign = 'middle';
                ratingCell.appendChild(ratingSpan);
                ratingCell.classList.add('professor-rating');

                const difficultySpan = document.createElement('span');
                difficultySpan.innerText = professorData.difficulty;
                difficultySpan.style.backgroundColor = getBackgroundColor(professorData.difficulty, true);
                difficultySpan.style.padding = '5px';
                difficultySpan.style.borderRadius = '5px';
                difficultySpan.style.display = 'inline-block';
                difficultySpan.style.textAlign = 'center';
                difficultyCell.style.verticalAlign = 'middle';
                difficultyCell.appendChild(difficultySpan);
                difficultyCell.classList.add('professor-difficulty');

                const wouldTakeAgainSpan = document.createElement('span');
                wouldTakeAgainSpan.innerText = professorData.wouldTakeAgain;
                wouldTakeAgainSpan.style.backgroundColor = professorData.wouldTakeAgain === 'N/A' ? '#d3d3d3' : '';
                wouldTakeAgainSpan.style.padding = '5px';
                wouldTakeAgainSpan.style.borderRadius = '5px';
                wouldTakeAgainSpan.style.display = 'inline-block';
                wouldTakeAgainSpan.style.textAlign = 'center';
                wouldTakeAgainCell.style.verticalAlign = 'middle';
                wouldTakeAgainCell.appendChild(wouldTakeAgainSpan);
                wouldTakeAgainCell.classList.add('would-take-again');
            }

            const rmpLinkCell = document.createElement('td');
            const rmpLink = document.createElement('a');
            rmpLink.href = professorData.href;
            rmpLink.target = '_blank';
            rmpLink.style.textDecoration = 'underline';
            rmpLink.style.cursor = 'pointer';
            rmpLink.style.color = 'inherit';
            rmpLink.innerText = 'Link';
            rmpLinkCell.appendChild(rmpLink);
            rmpLinkCell.style.verticalAlign = 'middle';
            rmpLinkCell.classList.add('rmp-link');

            row.appendChild(ratingCell);
            row.appendChild(difficultyCell);
            row.appendChild(wouldTakeAgainCell);
            row.appendChild(rmpLinkCell);

        } catch (error) {
            console.error("Error fetching professor data:", error);
        }
    });
}

// Observes the DOM for the presence of the sections table and adds the ratings columns
function observeForSectionTable() {
    const observer = new MutationObserver((mutations, obs) => {
        const sectionTable = document.querySelector('.cdpSectionsTable');
        if (sectionTable) {
            obs.disconnect();
            addRatingColumn();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

// Checks if the user is signed in
function checkUserLoginStatus() {
    const observer = new MutationObserver(() => {
        const signInElement = document.querySelector('#sign-in-header');
        const userAccountElement = document.querySelector('#user-account');

        if (!signInElement && userAccountElement) {
            console.log("User is logged in, starting extension.");
            observeForSectionTable();
        } else {
            console.log("User is not logged in, extension will not run.");
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

// Initialize the login check when the page is loaded or navigated
window.addEventListener('load', checkUserLoginStatus);
window.addEventListener('popstate', checkUserLoginStatus);
window.addEventListener('pushstate', checkUserLoginStatus);
window.addEventListener('replaceState', checkUserLoginStatus);
