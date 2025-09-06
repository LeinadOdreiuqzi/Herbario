import { apiClient } from './apiClient.js';

const btnHealth = document.getElementById('btnHealth');
const plantsList = document.getElementById('plantsList');

async function testAPI() {
  try {
    const { data, error } = await apiClient.request('/health', { auth: false });
    if (error) throw error;
    console.log('API Health:', data);
    // El backend responde { ok: true, service: 'Herbario API' }
    alert(`API: ${data.service || 'Desconocida'} — Estado: ${data.ok ? 'OK' : 'NO DISPONIBLE'}`);
  } catch (error) {
    console.error('API Error:', error);
    alert('Error connecting to API');
  }
}

async function loadPlants() {
  try {
    // El listado público solo permite status=accepted
    const { data: plants, error } = await apiClient.request('/plants?status=accepted', { auth: false });
    if (error) throw error;
    
    plantsList.innerHTML = '';
    plants.forEach(plant => {
      const li = document.createElement('li');
      li.textContent = `${plant.name} (${plant.family || 'Sin familia'})`;
      plantsList.appendChild(li);
    });
  } catch (error) {
    console.error('Error loading plants:', error);
    plantsList.innerHTML = '<li>Error loading plants</li>';
  }
}

btnHealth.addEventListener('click', testAPI);
loadPlants();