// Map state
let map = null;
let currentMarker = null;

// Mock "AI" priority algorithm based on expiry time and quantity
function calculatePriority(expiryHours, quantity) {
  if (expiryHours < 3) return 'urgent';
  if (expiryHours < 12 && quantity > 20) return 'urgent';
  return 'normal';
}

// Mock Fake/Real Predictor
function predictTrustScore(ngoId, orgName = '') {
  const name = orgName.toLowerCase();
  
  // Rule-based identification
  if (name.includes('fake') || name.includes('test') || name.includes('scam')) {
    return { score: 12, status: 'Suspicious / Fake', type: 'fake', reasons: ['Blacklisted Keywords Found', 'Unknown Registration ID'] };
  }
  
  if (name.includes('foundation') || name.includes('charity') || name.includes('ngo') || name.includes('trust')) {
    return { score: 98, status: 'Verified Real', type: 'trust', reasons: ['Official Certificate Validated', 'Positive Community Feedback'] };
  }

  // Fallback to heuristic but much safer
  const hash = (ngoId * 37) % 100;
  if (hash > 95) return { score: 25, status: 'Unverified Profile', type: 'fake', reasons: ['Missing Documentation', 'New Account Status'] };
  
  return { score: 85 + (hash % 15), status: 'Verified Real', type: 'trust', reasons: ['Automatic Background Verification Passed'] };
}

// Mock Freshness Predictor
function analyzeFreshness(foodName, expiry) {
  const name = foodName.toLowerCase();

  if (name.includes('scrap') || name.includes('leftover') || name.includes('peel') || expiry < 2) {
    return { status: 'Likely Leftover/Scraps', confidence: 92, class: 'leftover' };
  } else {
    return { status: 'Fresh Food', confidence: 88, class: 'fresh' };
  }
}

const defaultListings = [
  { id: 1, food: 'Fresh Pastries', quantity: '5 kg', location: 'Downtown Bakery', lat: 51.505, lng: -0.09, expiry: 2, status: 'urgent', freshness: 'fresh', ngoClaimed: null, deliveryClaimed: null },
  { id: 2, food: 'Vegetable Curry', quantity: '15 meals', location: 'Spice Villa', lat: 51.51, lng: -0.1, expiry: 10, status: 'normal', freshness: 'fresh', ngoClaimed: null, deliveryClaimed: null },
  { id: 3, food: 'Vegetable Scraps', quantity: '10 units', location: 'Cafe Central', lat: 51.515, lng: -0.09, expiry: 4, status: 'normal', freshness: 'leftover', ngoClaimed: 'NGO-45', deliveryClaimed: null }
];

function getListings() {
  const listings = localStorage.getItem('foodListings');
  if (!listings) {
    localStorage.setItem('foodListings', JSON.stringify(defaultListings));
    return defaultListings;
  }
  return JSON.parse(listings);
}

function saveListing(listing) {
  const listings = getListings();
  listings.push(listing);
  localStorage.setItem('foodListings', JSON.stringify(listings));
}

// Init map function for Restaurant
function initRestaurantMap() {
  const mapEl = document.getElementById('map');
  if (!mapEl || !window.L) return;

  map = L.map('map').setView([51.505, -0.09], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    className: 'map-tiles'
  }).addTo(map);

  currentMarker = L.marker([51.505, -0.09], { draggable: true }).addTo(map);

  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(position => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      map.setView([lat, lng], 13);
      currentMarker.setLatLng([lat, lng]);
      const locInput = document.getElementById('location');
      if (locInput) locInput.value = `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
    });
  }
  // Set location on drag
  currentMarker.on('dragend', function (e) {
    const coords = e.target.getLatLng();
    document.getElementById('location').value = `Lat: ${coords.lat.toFixed(4)}, Lng: ${coords.lng.toFixed(4)}`;
  });

  // Set location on click
  map.on('click', function (e) {
    currentMarker.setLatLng(e.latlng);
    document.getElementById('location').value = `Lat: ${e.latlng.lat.toFixed(4)}, Lng: ${e.latlng.lng.toFixed(4)}`;
  });
}

// Init map function for NGO
function initNGOMap(listings) {
  const mapEl = document.getElementById('ngo-map');
  if (!mapEl || !window.L) return;

  map = L.map('ngo-map').setView([51.505, -0.09], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(position => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      map.setView([lat, lng], 12);

      L.marker([lat, lng], {
        icon: L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        })
      }).addTo(map).bindPopup("<b>You are here</b>").openPopup();
    });
  }

  listings.forEach(l => {
    if (l.lat && l.lng) {
      L.marker([l.lat, l.lng]).addTo(map)
        .bindPopup(`<b>${l.food}</b><br>${l.quantity}<br>Expiry: ${l.expiry}h`);
    }
  });
}

// Logic for Restaurant Dashboard
if (window.location.pathname.includes('restaurant-dashboard')) {
  document.addEventListener('DOMContentLoaded', () => {
    initRestaurantMap();
    
    // Display Org Name
    const orgName = sessionStorage.getItem('orgName') || 'Partner';
    const displayEl = document.getElementById('displayOrgName');
    if (displayEl) displayEl.innerText = orgName;

    // Freshness Predictor Button
    const analyzeBtn = document.getElementById('analyzeFreshnessBtn');
    if (analyzeBtn) {
      analyzeBtn.addEventListener('click', () => {
        const food = document.getElementById('foodType').value;
        const expiry = parseInt(document.getElementById('expiryTime').value) || 10;
        if (!food) { alert('Please enter food type first!'); return; }

        const prediction = analyzeFreshness(food, expiry);
        const predBox = document.getElementById('freshnessPrediction');
        predBox.style.display = 'block';
        predBox.innerHTML = `<strong>AI Analysis:</strong> <span class="badge ${prediction.class}">${prediction.status}</span> (Confidence: ${prediction.confidence}%)`;
      });
    }

    const form = document.getElementById('donateForm');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const food = document.getElementById('foodType').value;
        const quantity = document.getElementById('quantity').value;
        const expiry = parseInt(document.getElementById('expiryTime').value);
        const location = document.getElementById('location').value;

        const status = calculatePriority(expiry, parseInt(quantity) || 10);
        const freshness = analyzeFreshness(food, expiry).class;

        let lat = 51.505;
        let lng = -0.09;
        if (currentMarker) {
          lat = currentMarker.getLatLng().lat;
          lng = currentMarker.getLatLng().lng;
        }

        const newListing = {
          id: Date.now(),
          food,
          quantity,
          location,
          lat,
          lng,
          expiry,
          status,
          freshness,
          ngoClaimed: null,
          deliveryClaimed: null
        };

        saveListing(newListing);
        alert('Food listed successfully!');
        form.reset();
        const predBox = document.getElementById('freshnessPrediction');
        if (predBox) predBox.style.display = 'none';

        // Update dashboard stats
        const activeListingsEl = document.getElementById('active-listings');
        if (activeListingsEl) {
          activeListingsEl.innerText = parseInt(activeListingsEl.innerText) + 1;
        }
      });
    }
  });
}

// Logic for NGO Dashboard
if (window.location.pathname.includes('ngo-dashboard')) {
  document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('listings-container');
    
    // Display Org Name
    const orgName = sessionStorage.getItem('orgName') || 'NGO';
    const displayEl = document.getElementById('displayOrgName');
    if (displayEl) displayEl.innerText = orgName;

    function renderListings() {
      if (!container) return;
      let listings = getListings();
      listings = listings.filter(l => l.ngoClaimed === null);
      // Sort by urgency, then expiry
      listings.sort((a, b) => {
        if (a.status === 'urgent' && b.status !== 'urgent') return -1;
        if (b.status === 'urgent' && a.status !== 'urgent') return 1;
        return a.expiry - b.expiry;
      });

      container.innerHTML = '';

      if (listings.length === 0) {
        container.innerHTML = '<p style="color:var(--text-secondary)">No food available currently.</p>';
        if (window.L && !map) initNGOMap([]);
        return;
      }

      // We'll generate one NGO ID per session for demo purposes
      let mockNgoId = sessionStorage.getItem('ngoId');
      if (!mockNgoId) {
        mockNgoId = Math.floor(Math.random() * 100);
        sessionStorage.setItem('ngoId', mockNgoId);
      }
      const trust = predictTrustScore(mockNgoId, orgName);

      // Add a verification info panel if it doesn't exist
      if (!document.getElementById('verification-info-panel')) {
          const infoPanel = document.createElement('div');
          infoPanel.id = 'verification-info-panel';
          infoPanel.className = 'glass-panel';
          infoPanel.style.padding = '1rem';
          infoPanel.style.marginBottom = '2rem';
          infoPanel.style.border = trust.type === 'fake' ? '1px solid var(--accent-red)' : '1px solid var(--accent-green)';
          infoPanel.innerHTML = `
            <div style="display:flex; align-items:center; gap:15px;">
                <div style="font-size:2rem;">${trust.type === 'fake' ? '⚠️' : '✅'}</div>
                <div>
                    <h3 style="margin:0;">AI Identity Verification: <span class="badge ${trust.type}">${trust.status}</span></h3>
                    <p style="color:var(--text-secondary); font-size:0.85rem; margin-top:5px;">
                        Analysis for <b>${orgName}</b>: ${trust.reasons.join(', ')}. Trust Confidence: ${trust.score}%.
                    </p>
                </div>
            </div>
          `;
          container.parentNode.insertBefore(infoPanel, container);
      }

      listings.forEach(listing => {
        const card = document.createElement('div');
        card.className = 'glass-panel listing-card';
        card.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:flex-start">
            <h3>${listing.food}</h3>
            <div style="display:flex; gap: 5px; flex-direction: column; align-items: flex-end;">
              <span class="badge ${listing.freshness || 'fresh'}">${listing.freshness === 'leftover' ? 'Leftover' : 'Fresh'}</span>
              <span class="badge ${listing.status}">${listing.status}</span>
            </div>
          </div>
          <div class="listing-meta" style="margin-top:10px;">
            <span><i class="fas fa-boxes"></i> ${listing.quantity}</span>
            <span><i class="fas fa-clock"></i> Expires in ${listing.expiry}h</span>
          </div>
          <div style="margin-top: 10px;">
            <p style="color:var(--text-secondary); font-size:0.9rem"><i class="fas fa-map-marker-alt"></i> ${listing.location}</p>
          </div>
          <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--glass-border);">
            <p style="font-size:0.85rem; color:var(--text-primary);">
              Your NGO Trust AI: <span class="badge ${trust.type}">${trust.status} (${trust.score}%)</span>
            </p>
          </div>
          <button class="btn-primary" style="margin-top:1rem; opacity: ${trust.type === 'fake' ? '0.5' : '1'}; pointer-events: ${trust.type === 'fake' ? 'none' : 'auto'}" onclick="${trust.type !== 'fake' ? 'claimFood(' + listing.id + ')' : ''}">
            ${trust.type === 'fake' ? '<i class="fas fa-lock"></i> Verification Required' : 'Claim Food'}
          </button>
        `;
        container.appendChild(card);
      });

      if (window.L && !map) {
        initNGOMap(listings);
      } else if (map) {
        // Re-init map
        map.eachLayer((layer) => {
          if (layer instanceof L.Marker) { map.removeLayer(layer); }
        });
        listings.forEach(l => {
          if (l.lat && l.lng) {
            L.marker([l.lat, l.lng]).addTo(map)
              .bindPopup(`<b>${l.food}</b><br>${l.quantity}<br>Expiry: ${l.expiry}h`);
          }
        });
      }
    }

    renderListings();

    // Global function for inline onclick
    window.claimFood = function (id) {
      let listings = getListings();
      const listing = listings.find(l => l.id === id);
      if (listing) {
        let mockNgoId = sessionStorage.getItem('ngoId');
        listing.ngoClaimed = mockNgoId;
        localStorage.setItem('foodListings', JSON.stringify(listings));
        alert('Food claimed successfully! Alerting delivery personnel for pickup.');
        renderListings();

        const impactsEl = document.getElementById('meals-saved');
        if (impactsEl) {
          impactsEl.innerText = parseInt(impactsEl.innerText) + 15; // mock impact logic
        }
      }
    };
  });
}

// Simple Login logic
if (window.location.pathname.includes('login')) {
  document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        // Clear session storage to allow getting a new mock ID
        sessionStorage.removeItem('ngoId');
        
        const orgName = document.getElementById('orgName').value;
        sessionStorage.setItem('orgName', orgName);

        const role = document.getElementById('role').value;
        if (role === 'restaurant') {
          window.location.href = 'restaurant-dashboard.html';
        } else if (role === 'ngo') {
          window.location.href = 'ngo-dashboard.html';
        } else {
          window.location.href = 'delivery-dashboard.html';
        }
      });
    }
  });
}

// Logic for Delivery Dashboard
if (window.location.pathname.includes('delivery-dashboard')) {
  document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('delivery-tasks-container');

    // Display Org Name
    const orgName = sessionStorage.getItem('orgName') || 'Driver';
    const displayEl = document.getElementById('displayOrgName');
    if (displayEl) displayEl.innerText = orgName;

    function initDeliveryMap(tasks) {
      const mapEl = document.getElementById('delivery-map');
      if (!mapEl || !window.L) return;

      if (!map) {
        map = L.map('delivery-map').setView([51.505, -0.09], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap'
        }).addTo(map);
      } else {
        map.eachLayer((layer) => {
          if (layer instanceof L.Marker || layer instanceof L.Polyline) { map.removeLayer(layer); }
        });
      }

      let lat = 51.505; let lng = -0.09;

      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(position => {
          lat = position.coords.latitude;
          lng = position.coords.longitude;
          map.setView([lat, lng], 13);

          L.marker([lat, lng], {
            icon: L.icon({
              iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
              shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
              iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
            })
          }).addTo(map).bindPopup("<b>You (Delivery)</b>").openPopup();
        });
      }

      tasks.forEach(t => {
        if (t.lat && t.lng) {
          L.marker([t.lat, t.lng], {
            icon: L.icon({
              iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
              shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
              iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
            })
          }).addTo(map)
            .bindPopup(`<b>Pickup: ${t.food}</b><br>${t.location}`);

          // Mock route optimization by drawing a line from user to task, or just a mock line to an NGO target
          // Mock NGO location slightly offset
          const ngoLat = t.lat + 0.01;
          const ngoLng = t.lng + 0.01;

          L.marker([ngoLat, ngoLng], {
            icon: L.icon({
              iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
              shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
              iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
            })
          }).addTo(map).bindPopup("<b>Delivery Target (NGO)</b>");

          const routeLines = [[t.lat, t.lng], [ngoLat, ngoLng]];
          L.polyline(routeLines, { color: 'orange', dashArray: '5, 10', weight: 3 }).addTo(map);
        }
      });
    }

    function renderTasks() {
      if (!container) return;
      let listings = getListings();
      // Show only tasks claimed by NGO but not yet picked up/delivered by user
      const tasks = listings.filter(l => l.ngoClaimed !== null && l.deliveryClaimed === null);

      container.innerHTML = '';

      if (tasks.length === 0) {
        container.innerHTML = '<p style="color:var(--text-secondary)">No delivery tasks currently available.</p>';
        initDeliveryMap([]);
        return;
      }

      tasks.forEach(task => {
        // mock route distance
        const distanceStr = (Math.random() * 5 + 1).toFixed(1);

        const card = document.createElement('div');
        card.className = 'glass-panel task-card';
        card.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:flex-start">
            <h3 style="color: var(--accent-orange)"><i class="fas fa-box-open"></i> ${task.food}</h3>
            <span class="task-status">Ready for Pickup</span>
          </div>
          <div style="margin-top:10px;">
            <p style="color:var(--text-primary); font-size: 0.9rem;">
              <strong>From:</strong> ${task.location}<br>
              <strong>To:</strong> NGO Station (approx ${distanceStr} km away)<br>
              <strong>Qty:</strong> ${task.quantity}
            </p>
          </div>
          <div style="margin-top: 15px; background: rgba(0,0,0,0.2); padding: 8px; border-radius: 8px;">
            <p style="font-size:0.8rem; color:var(--text-secondary); margin:0;">
               <i class="fas fa-route"></i> Optimized Route Generated
            </p>
          </div>
          <button class="btn-green" onclick="acceptDelivery(${task.id})">Accept Delivery</button>
        `;
        container.appendChild(card);
      });

      initDeliveryMap(tasks);
    }

    renderTasks();

    window.acceptDelivery = function (id) {
      let listings = getListings();
      const listing = listings.find(l => l.id === id);
      if (listing) {
        listing.deliveryClaimed = 'ME'; // simple mock
        localStorage.setItem('foodListings', JSON.stringify(listings));
        alert('Delivery accepted! Route sent to your device API.');
        renderTasks();
      }
    };
  });
}
