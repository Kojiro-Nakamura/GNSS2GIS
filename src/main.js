import 'leaflet/dist/leaflet.css';
import './style.css';
import { GNSSMappingApp } from './app/GNSSMappingApp.js';

window.onload = () => new GNSSMappingApp();
