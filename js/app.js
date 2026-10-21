
/* Art Atlas - Infinite Scroll Edition */

// Register the service worker.
if ("serviceWorker" in navigator) {
    window.addEventListener("load", function() {
        navigator.serviceWorker.register("./service-worker.js")
            .catch(function() {});
    });
}

// Main page elements.
var sections = document.querySelectorAll(".app-section");
var navLinks = document.querySelectorAll(".nav-link");
var searchForm = document.querySelector("#search-form");
var searchInput = document.querySelector("#art-search");
var artworkResults = document.querySelector("#artwork-results");
var savedArtworksContainer = document.querySelector("#saved-artworks");

// Infinite scrolling settings.
var batchSize = 30;
var currentQuery = "";
var nextSkip = 0;
var totalResults = 0;
var isLoading = false;
var searchFinished = false;
var searchVersion = 0;
var shownArtworkIds = {};
var scrollObserver = null;
var scrollSentinel = null;
var scrollStatus = null;

// Load saved artworks from browser storage.
var savedArtworks = [];

try {
    savedArtworks = JSON.parse(
        localStorage.getItem("artAtlasSavedArtworks") || "[]"
    );

    if (!Array.isArray(savedArtworks)) {
        savedArtworks = [];
    }
} catch (error) {
    savedArtworks = [];
}

// Save collection to browser storage.
function storeSavedArtworks() {
    try {
        localStorage.setItem(
            "artAtlasSavedArtworks",
            JSON.stringify(savedArtworks)
        );
    } catch (error) {
        alert("Your collection could not be saved in this browser.");
    }
}

// Navigate between app sections.
function showSection(sectionId) {
    sections.forEach(function(section) {
        section.hidden = section.id !== sectionId;
    });

    navLinks.forEach(function(link) {
        var active = link.getAttribute("href") === "#" + sectionId;

        link.classList.toggle("active", active);

        if (active) {
            link.setAttribute("aria-current", "page");
        } else {
            link.removeAttribute("aria-current");
        }
    });

    if (sectionId === "collection") {
        renderSavedArtworks();
    }
}

navLinks.forEach(function(link) {
    link.addEventListener("click", function(event) {
        event.preventDefault();

        var sectionId = link.getAttribute("href").substring(1);
        showSection(sectionId);
        history.replaceState(null, "", "#" + sectionId);
    });
});

// Open the correct section when the app loads.
var initialSection = window.location.hash.substring(1);
var validSection = false;

sections.forEach(function(section) {
    if (section.id === initialSection) {
        validSection = true;
    }
});

showSection(validSection ? initialSection : "discover");

// Get artist names.
function getArtistName(artwork) {
    if (artwork.creators && artwork.creators.length > 0) {
        return artwork.creators.map(function(creator) {
            return creator.description ||
                creator.name ||
                "Not listed";
        }).join(", ");
    }

    return "Not listed";
}

// Build an artwork card.
function createArtworkCard(artwork, isSavedView) {
    var card = document.createElement("article");
    card.className = "artwork-card";

    var image = document.createElement("img");
    image.className = "artwork-image";
    image.alt = "Artwork: " + (artwork.title || "Untitled");
    image.loading = "lazy";
    image.src = artwork.imageUrl || "";

    image.addEventListener("error", function() {
        image.hidden = true;

        if (!card.querySelector(".image-error-message")) {
            var notice = document.createElement("p");
            notice.className = "image-error-message";
            notice.textContent = "Image unavailable.";

            card.insertBefore(notice, card.firstChild);
        }
    });

    card.appendChild(image);

    var title = document.createElement("h3");
    title.textContent = artwork.title || "Untitled";
    card.appendChild(title);

    var artist = document.createElement("p");
    artist.textContent = "Artist: " + (artwork.artist || "Not listed");
    card.appendChild(artist);

    var date = document.createElement("p");
    date.textContent = "Date: " + (artwork.date || "Not listed");
    card.appendChild(date);

    var medium = document.createElement("p");
    medium.textContent = "Medium: " + (artwork.medium || "Not listed");
    card.appendChild(medium);

    var type = document.createElement("p");
    type.textContent = "Classification: " +
        (artwork.classification || "Not listed");
    card.appendChild(type);

    var culture = document.createElement("p");
    culture.textContent = "Culture: " + (artwork.culture || "Not listed");
    card.appendChild(culture);

    var source = document.createElement("a");
    source.href = artwork.url || "https://www.clevelandart.org/";
    source.textContent = "View museum record";
    source.target = "_blank";
    source.rel = "noopener noreferrer";
    card.appendChild(source);

    if (isSavedView) {
        var removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "remove-artwork";
        removeButton.textContent = "Remove from collection";

        removeButton.addEventListener("click", function() {
            savedArtworks = savedArtworks.filter(function(item) {
                return String(item.id) !== String(artwork.id);
            });

            storeSavedArtworks();
            renderSavedArtworks();
        });

        card.appendChild(removeButton);
    } else {
        var saveButton = document.createElement("button");
        saveButton.type = "button";

        var alreadySaved = savedArtworks.some(function(item) {
            return String(item.id) === String(artwork.id);
        });

        saveButton.textContent = alreadySaved
            ? "Saved to My Collection"
            : "Save to My Collection";

        saveButton.disabled = alreadySaved;

        saveButton.addEventListener("click", function() {
            var exists = savedArtworks.some(function(item) {
                return String(item.id) === String(artwork.id);
            });

            if (!exists) {
                savedArtworks.push(artwork);
                storeSavedArtworks();

                saveButton.textContent = "Saved to My Collection";
                saveButton.disabled = true;
            }
        });

        card.appendChild(saveButton);
    }

    return card;
}

// Display the saved collection.
function renderSavedArtworks() {
    savedArtworksContainer.textContent = "";

    if (savedArtworks.length === 0) {
        var emptyMessage = document.createElement("p");
        emptyMessage.textContent =
            "Your collection is empty. Explore artworks and save your favorites here.";

        savedArtworksContainer.appendChild(emptyMessage);
        return;
    }

    savedArtworks.forEach(function(artwork) {
        savedArtworksContainer.appendChild(
            createArtworkCard(artwork, true)
        );
    });
}

// Create the infinite-scroll loading indicator.
function createScrollControls() {
scrollStatus = document.createElement("p");
scrollStatus.className = "scroll-status";
scrollStatus.setAttribute("role", "status");
scrollStatus.setAttribute("aria-live", "polite");
scrollStatus.hidden = true;

    scrollSentinel = document.createElement("div");
    scrollSentinel.className = "scroll-sentinel";
    scrollSentinel.setAttribute("aria-hidden", "true");
    scrollSentinel.style.height = "24px";

    artworkResults.appendChild(scrollStatus);
    artworkResults.appendChild(scrollSentinel);
}

// Stop observing the previous search.
function resetInfiniteScroll() {
    if (scrollObserver) {
        scrollObserver.disconnect();
        scrollObserver = null;
    }

    if (scrollSentinel && scrollSentinel.parentNode) {
        scrollSentinel.parentNode.removeChild(scrollSentinel);
    }

    if (scrollStatus && scrollStatus.parentNode) {
        scrollStatus.parentNode.removeChild(scrollStatus);
    }

    scrollSentinel = null;
    scrollStatus = null;
}

// Set up automatic loading when the user approaches the bottom.
function setupInfiniteScroll(version) {
    if (scrollObserver) {
        scrollObserver.disconnect();
    }

    if ("IntersectionObserver" in window) {
        scrollObserver = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting &&
                    version === searchVersion &&
                    !isLoading &&
                    !searchFinished) {
                    loadNextBatch(version);
                }
            });
        }, {
            root: null,
            rootMargin: "500px",
            threshold: 0
        });

        scrollObserver.observe(scrollSentinel);
    } else {
        // Fallback for browsers without IntersectionObserver.
        window.addEventListener("scroll", fallbackScrollHandler);
    }
}

// Fallback scrolling handler.
function fallbackScrollHandler() {
    if (!scrollSentinel || isLoading || searchFinished) {
        return;
    }

    var rect = scrollSentinel.getBoundingClientRect();

    if (rect.top < window.innerHeight + 500) {
        loadNextBatch(searchVersion);
    }
}

// Convert a museum record into the app's artwork format.
function formatArtwork(item) {
    var imageUrl = item.images &&
        item.images.web &&
        item.images.web.url
        ? item.images.web.url
        : "";

    if (!imageUrl) {
        return null;
    }

    return {
        id: item.id,
        title: item.title || "Untitled",
        artist: getArtistName(item),
        date: item.creation_date || "Not listed",
        medium: item.technique || "Not listed",
        classification: item.type || "Not listed",
        culture: item.culture || "Not listed",
        imageUrl: imageUrl,
        url: item.url || "https://www.clevelandart.org/"
    };
}

// Load the next batch of artworks.
function loadNextBatch(version) {
    if (isLoading || searchFinished || version !== searchVersion) {
        return;
    }

    isLoading = true;

if (scrollStatus) {
    scrollStatus.hidden = true;
}

    var apiUrl =
        "https://openaccess-api.clevelandart.org/api/artworks/" +
        "?q=" + encodeURIComponent(currentQuery) +
        "&has_image=1" +
        "&skip=" + nextSkip +
        "&limit=" + batchSize;

    fetch(apiUrl)
        .then(function(response) {
            if (!response.ok) {
                throw new Error("Museum API request failed.");
            }

            return response.json();
        })
        .then(function(data) {
            if (version !== searchVersion) {
                return;
            }

            var records = data.data || [];

            // Use the API's total count when available.
            if (data.info && typeof data.info.total === "number") {
                totalResults = data.info.total;
            }

            // Advance by the number of records received,
            // including records without usable images.
            nextSkip += records.length;

            var addedCount = 0;

            records.forEach(function(item) {
                var artwork = formatArtwork(item);

                if (!artwork) {
                    return;
                }

                var artworkId = String(artwork.id);

                if (shownArtworkIds[artworkId]) {
                    return;
                }

                shownArtworkIds[artworkId] = true;

                artworkResults.insertBefore(
                    createArtworkCard(artwork, false),
                    scrollStatus
                );

                addedCount++;
            });

            if (records.length === 0 ||
                nextSkip >= totalResults) {
                searchFinished = true;

                if (scrollStatus) {
                    scrollStatus.textContent = addedCount > 0
                        ? "You've reached the end of these results."
                        : "No more matching artworks with usable images were found.";
                }

                if (scrollObserver) {
                    scrollObserver.disconnect();
                }

                window.removeEventListener(
                    "scroll",
                    fallbackScrollHandler
                );

                return;
            }

if (scrollStatus) {
    scrollStatus.hidden = true;
}

            // If a batch contains no usable images, try the next batch
            // instead of leaving the user stuck at an empty loading state.
            if (addedCount === 0) {
                loadNextBatch(version);
            }
        })
        .catch(function(error) {
            if (version !== searchVersion) {
                return;
            }

            if (scrollStatus) {
                scrollStatus.textContent =
                    "We couldn't load more artworks. " +
                    "Scroll down to try again.";
            }

            console.log("Art Atlas API error:", error);
        })
        .then(function() {
            if (version === searchVersion) {
                isLoading = false;
            }
        });
}

// Start a new artwork search.
searchForm.addEventListener("submit", function(event) {
    event.preventDefault();

    var query = searchInput.value.trim();

    if (!query) {
        artworkResults.textContent =
            "Enter an artist or artwork to search.";
        return;
    }

    // Reset state for the new search.
    searchVersion++;
    var version = searchVersion;

    currentQuery = query;
    nextSkip = 0;
    totalResults = 0;
    isLoading = false;
    searchFinished = false;
    shownArtworkIds = {};

    window.removeEventListener("scroll", fallbackScrollHandler);
    resetInfiniteScroll();

artworkResults.textContent = "";

createScrollControls();
setupInfiniteScroll(version);

// Load the first batch immediately.
loadNextBatch(version);
});

// Render the saved collection when the app opens.
renderSavedArtworks();


/* Discover - Rotating art wheel */

var discoverArtworks = [];
var discoverIndex = 0;




function loadDiscoverArtworks() {
    var gallery = document.querySelector("#discover-artworks");

    if (!gallery) {
        return;
    }

    var savedDiscoverArtworks = [];

    try {
        savedDiscoverArtworks = JSON.parse(
            localStorage.getItem("artAtlasDiscoverArtworks") || "[]"
        );

        if (!Array.isArray(savedDiscoverArtworks)) {
            savedDiscoverArtworks = [];
        }
    } catch (error) {
        savedDiscoverArtworks = [];
    }

    if (!navigator.onLine && savedDiscoverArtworks.length > 0) {
        discoverArtworks = savedDiscoverArtworks;
        discoverIndex = 0;
        showDiscoverArtwork();
        return;
    }

    gallery.textContent = "Finding artworks for you...";

    var randomSkip = Math.floor(Math.random() * 30000);

    var apiUrl =
        "https://openaccess-api.clevelandart.org/api/artworks/" +
        "?has_image=1&skip=" + randomSkip + "&limit=30";

    fetch(apiUrl)
        .then(function(response) {
            if (!response.ok) {
                throw new Error("Could not load artworks.");
            }
            return response.json();
        })
        .then(function(data) {
            var records = (data.data || []).filter(function(item) {
                return item.images &&
                    item.images.web &&
                    item.images.web.url;
            });

            for (var i = records.length - 1; i > 0; i--) {
                var j = Math.floor(Math.random() * (i + 1));
                var temp = records[i];
                records[i] = records[j];
                records[j] = temp;
            }

            discoverArtworks = records.map(function(item) {
                return formatArtwork(item);
            }).filter(function(item) {
                return item !== null;
            });

            if (discoverArtworks.length === 0) {
                throw new Error("No usable artworks found.");
            }

            localStorage.setItem(
                "artAtlasDiscoverArtworks",
                JSON.stringify(discoverArtworks)
            );

            // Download and cache the actual image files.
            return caches.open("art-atlas-images-v1").then(function(cache) {
                var imageRequests = discoverArtworks.map(function(artwork) {
                    return fetch(artwork.imageUrl)
                        .then(function(response) {
                            if (response.ok || response.type === "opaque") {
                                return cache.put(
                                    artwork.imageUrl,
                                    response
                                );
                            }
                        })
                        .catch(function(error) {
                            console.log(
                                "Could not cache image:",
                                artwork.imageUrl,
                                error
                            );
                        });
                });

                return Promise.all(imageRequests);
            }).then(function() {
                discoverIndex = 0;
                showDiscoverArtwork();
            });
        })
        .catch(function(error) {
            console.log("Discover gallery error:", error);

            if (savedDiscoverArtworks.length > 0) {
                discoverArtworks = savedDiscoverArtworks;
                discoverIndex = 0;
                showDiscoverArtwork();
            } else {
                gallery.textContent =
                    "No saved artworks are available offline yet. " +
                    "Reconnect to the internet to load artworks.";
            }
        });
}


function showDiscoverArtwork() {
    var gallery = document.querySelector("#discover-artworks");
    var counter = document.querySelector("#art-wheel-counter");

    if (!gallery || discoverArtworks.length === 0) {
        if (counter) {
            counter.textContent = "";
        }
        return;
    }

    gallery.textContent = "";

    var artwork = discoverArtworks[discoverIndex];

    gallery.appendChild(createArtworkCard(artwork, false));

    if (counter) {
        counter.textContent =
            (discoverIndex + 1) + " of " + discoverArtworks.length;
    }
}

// Previous artwork.
document.querySelector("#art-previous").addEventListener(
    "click",
    function() {
        if (discoverArtworks.length === 0) {
            return;
        }

        discoverIndex--;

        if (discoverIndex < 0) {
            discoverIndex = discoverArtworks.length - 1;
        }

        showDiscoverArtwork();
    }
);

// Next artwork.
document.querySelector("#art-next").addEventListener(
    "click",
    function() {
        if (discoverArtworks.length === 0) {
            return;
        }

        discoverIndex++;

        if (discoverIndex >= discoverArtworks.length) {
            discoverIndex = 0;
        }

        showDiscoverArtwork();
    }
);

// Load a new random selection on refresh.
loadDiscoverArtworks();
