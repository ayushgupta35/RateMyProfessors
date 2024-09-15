chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "fetchRating") {
      const queryURL = `https://www.ratemyprofessors.com/search/professors/1530?q=${encodeURIComponent(message.professorName)}`;
      
      fetch(queryURL)
        .then(response => response.text())
        .then(htmlText => {
        // Return raw HTML to the content script
          sendResponse({ htmlText });
        })
        .catch(error => {
          console.error("Error fetching professor data from background script:", error);
          sendResponse({ error: 'Error fetching data' });
        });
        // Indicate async response
      return true;
    }
  });
